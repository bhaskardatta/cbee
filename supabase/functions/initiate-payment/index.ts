import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  name: string;
  email: string;
  phone: string;
  amount: number; // Amount in rupees
}

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
    // Initialize Supabase with service role key for database operations
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

    const { name, email, phone, amount }: PaymentRequest = await req.json();

    // Validate inputs
    if (!name || !email || !amount || amount <= 0) {
      throw new Error("Invalid request data");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    // Validate amount (between 1 and 100000 rupees)
    if (amount < 1 || amount > 100000) {
      throw new Error("Invalid amount - must be between ₹1 and ₹100,000");
    }

    // Generate unique order ID
    const orderId = uuidv4();
    const transactionId = `TXN_${Date.now()}_${orderId.slice(0, 8)}`;

    // Store order in database
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: user.id,
        name,
        email,
        phone,
        amount: amount * 100, // Convert to paise
        phonepe_order_id: orderId,
        phonepe_transaction_id: transactionId,
        status: "PENDING"
      })
      .select()
      .single();

    if (orderError) {
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    // PhonePe v2 configuration
    const CLIENT_ID = Deno.env.get("PHONEPE_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("PHONEPE_CLIENT_SECRET");
    const CLIENT_VERSION = Deno.env.get("PHONEPE_CLIENT_VERSION");
    const MERCHANT_ID = Deno.env.get("PHONEPE_MERCHANT_ID");
    const BASE_URL = Deno.env.get("PHONEPE_BASE_URL") || "https://api.phonepe.com/apis/pg";
    const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || req.headers.get("origin");
    
    // Determine environment (sandbox or production)
    const environment = BASE_URL.includes("api-preprod") ? "sandbox" : "production";

    if (!CLIENT_ID || !CLIENT_SECRET || !CLIENT_VERSION || !MERCHANT_ID) {
      throw new Error("PhonePe configuration missing");
    }

    console.log("Getting PhonePe auth token...");
    // Get OAuth token
    const authToken = await getPhonePeAuthToken(CLIENT_ID, CLIENT_SECRET, CLIENT_VERSION, environment);

    // Create v2 payment payload
    const paymentPayload = {
      merchantOrderId: transactionId,
      amount: amount * 100, // Amount in paise
      expireAfter: 1200, // 20 minutes
      metaInfo: {
        udf1: name,
        udf2: email,
        udf3: phone || "",
      },
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: "Payment for donation",
        merchantUrls: {
          redirectUrl: `${FRONTEND_URL}/payment-status?orderId=${order.id}`,
        },
      },
    };

    console.log("Initiating payment with PhonePe...");
    
    async function createPayment(baseUrl: string, token: string) {
      const response = await fetch(`${baseUrl}/checkout/v2/pay`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `O-Bearer ${token}`,
          "X-MERCHANT-ID": MERCHANT_ID as string,
        },
        body: JSON.stringify(paymentPayload),
      });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data } as const;
    }

    let currentBaseUrl = BASE_URL;
    let currentEnv = environment as "sandbox" | "production";
    let currentToken = authToken;

    let result = await createPayment(currentBaseUrl, currentToken);
    console.log("PhonePe response:", JSON.stringify(result.data));

    // Fallback to alternate environment if API mapping is incorrect
    if ((!result.ok && (result.status === 404 || (result.data?.message || "").includes("Api Mapping Not Found"))) ||
        (!result.data?.redirectUrl && (result.data?.message || "").includes("Api Mapping Not Found"))) {
      console.warn("Api Mapping Not Found. Retrying with alternate environment...");
      if (currentEnv === "production") {
        currentBaseUrl = "https://api-preprod.phonepe.com/apis/pg-sandbox";
        currentEnv = "sandbox";
      } else {
        currentBaseUrl = "https://api.phonepe.com/apis/pg";
        currentEnv = "production";
      }
      currentToken = await getPhonePeAuthToken(CLIENT_ID, CLIENT_SECRET, CLIENT_VERSION, currentEnv);
      result = await createPayment(currentBaseUrl, currentToken);
      console.log("PhonePe response (retry):", JSON.stringify(result.data));
    }

    if (result.data?.redirectUrl) {
      return new Response(JSON.stringify({
        success: true,
        redirectUrl: result.data.redirectUrl,
        orderId: order.id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      console.error("Payment initiation failed:", result.data);
      throw new Error(result.data?.message || "Failed to initiate payment with PhonePe");
    }

  } catch (error: unknown) {
    console.error("Payment initiation error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});