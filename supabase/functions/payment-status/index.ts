import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get PhonePe OAuth token
async function getPhonePeAuthToken(
  clientId: string,
  clientSecret: string,
  clientVersion: string,
  environment: string
): Promise<string> {
  // Use different token URLs for sandbox vs production
  const tokenUrl = environment === "production"
    ? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";
  
  // Create form-encoded body
  const body = new URLSearchParams({
    client_id: clientId,
    client_version: clientVersion,
    client_secret: clientSecret,
    grant_type: "client_credentials"
  });
  
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get auth token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    const user = userData.user;
    
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get order ID from URL or request body
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId") || 
                   (req.method === "POST" ? (await req.json()).orderId : null);

    if (!orderId) {
      throw new Error("Order ID is required");
    }

    // Get order from database
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // If order is already processed, return cached status
    if (order.status !== "PENDING") {
      return new Response(JSON.stringify({
        success: true,
        status: order.status,
        order: order
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check payment status with PhonePe v2
    const CLIENT_ID = Deno.env.get("PHONEPE_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("PHONEPE_CLIENT_SECRET");
    const CLIENT_VERSION = Deno.env.get("PHONEPE_CLIENT_VERSION");
    const MERCHANT_ID = Deno.env.get("PHONEPE_MERCHANT_ID");
    const BASE_URL = Deno.env.get("PHONEPE_BASE_URL") || "https://api.phonepe.com/apis/pg";
    
    // Determine environment (sandbox or production)
    const environment = BASE_URL.includes("api-preprod") ? "sandbox" : "production";

    if (!CLIENT_ID || !CLIENT_SECRET || !CLIENT_VERSION || !MERCHANT_ID) {
      throw new Error("PhonePe configuration missing");
    }

    console.log("Getting PhonePe auth token for status check...");
    // Get OAuth token
    const authToken = await getPhonePeAuthToken(CLIENT_ID, CLIENT_SECRET, CLIENT_VERSION, environment);

    const merchantOrderId = order.phonepe_transaction_id;
    
    console.log("Checking payment status with PhonePe...");
    async function checkStatus(baseUrl: string, token: string) {
      const response = await fetch(`${baseUrl}/checkout/v2/order/${merchantOrderId}/status`, {
        method: "GET",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `O-Bearer ${token}`,
          "X-MERCHANT-ID": MERCHANT_ID as string,
        },
      });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data } as const;
    }

    let baseUrl = BASE_URL;
    let env = environment as "sandbox" | "production";
    let tokenForEnv = authToken;

    let statusResult = await checkStatus(baseUrl, tokenForEnv);
    console.log("PhonePe status response:", JSON.stringify(statusResult.data));

    if ((!statusResult.ok && (statusResult.status === 404 || (statusResult.data?.message || "").includes("Api Mapping Not Found")))) {
      console.warn("Api Mapping Not Found (status). Retrying with alternate environment...");
      if (env === "production") {
        baseUrl = "https://api-preprod.phonepe.com/apis/pg-sandbox";
        env = "sandbox";
      } else {
        baseUrl = "https://api.phonepe.com/apis/pg";
        env = "production";
      }
      tokenForEnv = await getPhonePeAuthToken(CLIENT_ID, CLIENT_SECRET, CLIENT_VERSION, env);
      statusResult = await checkStatus(baseUrl, tokenForEnv);
      console.log("PhonePe status response (retry):", JSON.stringify(statusResult.data));
    }

    let finalStatus = "FAILED";

    // Map PhonePe status to our status
    if (statusResult.data?.state === "COMPLETED") {
      finalStatus = "SUCCESS";
      
      // Send email notification for successful payment
      try {
        const emailResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-donation-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
          },
          body: JSON.stringify({
            donorName: order.name,
            donorEmail: order.email,
            amount: order.amount / 100, // Convert back to rupees
            transactionId: order.phonepe_transaction_id
          })
        });
        
        if (!emailResponse.ok) {
          console.error("Failed to send email notification");
        }
      } catch (emailError) {
        console.error("Error sending email notification:", emailError);
      }
    }

    // Update order status using secure function
    const { error: updateError } = await supabaseAdmin
      .rpc("update_order_status", {
        order_id: orderId,
        new_status: finalStatus
      });

    if (updateError) {
      console.error("Failed to update order status:", updateError);
    }

    // Return updated order
    const { data: updatedOrder } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    return new Response(JSON.stringify({
      success: true,
      status: finalStatus,
      order: updatedOrder || { ...order, status: finalStatus }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: unknown) {
    console.error("Payment status check error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});