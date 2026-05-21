import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DonationNotification {
  donorName: string;
  donorEmail: string;
  donorPhone: string;
  amount: number;
  transactionId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { donorName, donorEmail, donorPhone, amount, transactionId }: DonationNotification = await req.json();

    // Create email content
    const subject = `New Donation Received - ₹${amount} from ${donorName}`;
    const body = `
Dear Cbee Team,

You have received a new donation!

Donor Details:
- Name: ${donorName}
- Email: ${donorEmail}
- Phone: ${donorPhone}
- Amount: ₹${amount}
- Transaction ID: ${transactionId}
- Date: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

Thank you for using Cbee!

Best regards,
Cbee App
    `;

    // Create mailto URL
    const mailtoUrl = `mailto:cbee69a@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    return new Response(JSON.stringify({
      success: true,
      message: "Donation notification prepared",
      mailtoUrl: mailtoUrl
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: unknown) {
    console.error("Email notification error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});