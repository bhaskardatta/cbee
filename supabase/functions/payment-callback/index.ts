import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const MERCHANT_KEY = Deno.env.get("PHONEPE_MERCHANT_KEY");
    
    if (!MERCHANT_KEY) {
      throw new Error("PhonePe merchant key not configured");
    }

    // Get callback payload
    const body = await req.json();
    const { response: encodedResponse } = body;

    if (!encodedResponse) {
      throw new Error("No response payload provided");
    }

    // Verify X-VERIFY header signature
    const xVerifyHeader = req.headers.get("X-VERIFY");
    if (!xVerifyHeader) {
      throw new Error("Missing X-VERIFY header");
    }

    // Calculate expected checksum
    const expectedChecksumString = encodedResponse + MERCHANT_KEY;
    const encoder = new TextEncoder();
    const data = encoder.encode(expectedChecksumString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const expectedChecksum = Array.from(hashArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Extract checksum from header (format: sha256###keyIndex)
    const receivedChecksum = xVerifyHeader.split('###')[0];

    // Verify checksum matches
    if (receivedChecksum !== expectedChecksum) {
      console.error("Checksum verification failed");
      throw new Error("Invalid signature - checksum mismatch");
    }

    // Decode the response payload
    const decodedResponse = JSON.parse(atob(encodedResponse));
    
    const {
      merchantTransactionId,
      transactionId,
      amount,
      state,
      responseCode
    } = decodedResponse;

    console.log("Payment callback received:", {
      merchantTransactionId,
      state,
      responseCode
    });

    // Find the order by transaction ID
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("phonepe_transaction_id", merchantTransactionId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // Determine final status
    let finalStatus = "FAILED";
    if (state === "COMPLETED" && responseCode === "SUCCESS") {
      finalStatus = "SUCCESS";
    }

    // Update order status using secure function
    const { error: updateError } = await supabaseAdmin
      .rpc("update_order_status", {
        order_id: order.id,
        new_status: finalStatus
      });

    if (updateError) {
      console.error("Failed to update order:", updateError);
      throw updateError;
    }

    // Send notification for successful payment
    if (finalStatus === "SUCCESS") {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-donation-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            donorName: order.name,
            donorEmail: order.email,
            donorPhone: order.phone,
            amount: order.amount / 100,
            transactionId: merchantTransactionId
          })
        });
      } catch (notifError) {
        console.error("Failed to send notification:", notifError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      status: finalStatus
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: unknown) {
    console.error("Payment callback error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
