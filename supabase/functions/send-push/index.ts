import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  icon?: string;
  data?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidEmail = Deno.env.get('VAPID_EMAIL');
    
    if (!supabaseUrl || !supabaseServiceKey || !vapidPublicKey || !vapidPrivateKey || !vapidEmail) {
      throw new Error('Missing configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { userId, title, body, icon, data }: NotificationPayload = await req.json();
    
    // Validate inputs
    if (!userId || !title || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return new Response(JSON.stringify({ error: 'Invalid user ID format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      throw fetchError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ message: 'No subscriptions found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const notificationPayload = {
      title,
      body,
      icon: icon || '/favicon.ico',
      data: data || {}
    };

    // Send push notification to each subscription
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const payload = JSON.stringify(notificationPayload);
          
          // Create proper VAPID JWT
          const jwt = await createVapidJWT(vapidEmail, vapidPrivateKey);
          
          const vapidHeaders = {
            'Content-Type': 'application/octet-stream',
            'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
            'TTL': '86400'
          };

          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: vapidHeaders,
            body: payload,
          });

          if (!response.ok) {
            if (response.status === 410 || response.status === 404) {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('id', sub.id);
              console.log('Removed invalid subscription:', sub.id);
            }
            throw new Error(`Push failed: ${response.status}`);
          }

          return { success: true, subscription: sub.id };
        } catch (error: unknown) {
          console.error('Push notification failed for subscription:', sub.id, error);
          return { success: false, subscription: sub.id, error: error instanceof Error ? error.message : "Unknown error" };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failureCount = results.length - successCount;

    // ---- Native fan-out (iOS + Android) via FCM legacy HTTP if configured ----
    let nativeSent = 0;
    let nativeFailed = 0;
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
    if (fcmServerKey) {
      const { data: deviceTokens } = await supabase
        .from('device_tokens')
        .select('id, token, platform')
        .eq('user_id', userId);

      if (deviceTokens && deviceTokens.length > 0) {
        const nativeResults = await Promise.allSettled(
          deviceTokens.map(async (dt: any) => {
            const fcmPayload = {
              to: dt.token,
              notification: { title, body, sound: 'default' },
              data: data || {},
              priority: 'high',
              content_available: true,
            };
            const r = await fetch('https://fcm.googleapis.com/fcm/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `key=${fcmServerKey}`,
              },
              body: JSON.stringify(fcmPayload),
            });
            const json = await r.json().catch(() => ({}));
            // Clean up invalid tokens
            if (json?.results?.[0]?.error === 'NotRegistered' || json?.results?.[0]?.error === 'InvalidRegistration') {
              await supabase.from('device_tokens').delete().eq('id', dt.id);
            }
            if (!r.ok || (json?.failure && !json?.success)) throw new Error(JSON.stringify(json));
            return true;
          })
        );
        nativeSent = nativeResults.filter(r => r.status === 'fulfilled').length;
        nativeFailed = nativeResults.length - nativeSent;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      web: { sent: successCount, failed: failureCount },
      native: { sent: nativeSent, failed: nativeFailed },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in send-push function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Proper VAPID JWT creation using Web Crypto API with ECDSA P-256
async function createVapidJWT(email: string, privateKeyBase64: string): Promise<string> {
  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };

  const payload = {
    aud: 'https://fcm.googleapis.com',
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
    sub: `mailto:${email}`
  };

  // Base64URL encode
  const base64UrlEncode = (str: string): string => {
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  try {
    // Decode the base64 private key
    const privateKeyBytes = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));
    
    // Import the private key for signing
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBytes,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      false,
      ['sign']
    );

    // Sign the token
    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256'
      },
      cryptoKey,
      new TextEncoder().encode(unsignedToken)
    );

    // Base64URL encode the signature
    const signatureB64 = base64UrlEncode(
      String.fromCharCode(...new Uint8Array(signature))
    );

    return `${unsignedToken}.${signatureB64}`;
  } catch (error) {
    console.error('Error creating VAPID JWT:', error);
    throw new Error('Failed to create VAPID JWT');
  }
}
