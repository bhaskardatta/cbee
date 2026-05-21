// supabase/functions/get-upload-url/index.ts
//
// Issues a 15-minute, single-use AWS-SigV4-signed PUT URL for the Cloudflare R2
// bucket `cbee-media`. Per ADR-017, all Phase 2 photo/video media is uploaded
// directly to R2 from the client; this function is the only place R2
// credentials live. The client never sees them.
//
// Request body:
//   { contentType: string, contentLength: number, kind: 'image'|'video'|'thumbnail' }
// Response 200:
//   { uploadUrl: string, publicUrl: string, objectKey: string, expiresIn: 900 }
//
// REQUIRED ENV VARS — set in Supabase dashboard:
//   Project Settings → Edge Functions → Secrets
//
//   R2_ACCOUNT_ID         — Cloudflare account ID (32 hex chars)
//   R2_ACCESS_KEY_ID      — R2 API token Access Key ID
//   R2_SECRET_ACCESS_KEY  — R2 API token Secret Access Key
//   R2_BUCKET             — bucket name (e.g. `cbee-media`)
//   R2_PUBLIC_HOST        — public CDN host (e.g. `media.cbee.online`)
//
// When the secrets aren't set, the function returns 500 and the client
// (`useMediaUpload.ts`) falls back to the Supabase Storage `posts` bucket.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Kind = "image" | "video" | "thumbnail";

interface RequestBody {
  contentType: string;
  contentLength: number;
  kind: Kind;
}

const MAX_BYTES: Record<Kind, number> = {
  image:     10 * 1024 * 1024, // 10 MB
  thumbnail:  1 * 1024 * 1024, //  1 MB
  video:     60 * 1024 * 1024, // 60 MB
};

const ALLOWED_TYPES: Record<Kind, Set<string>> = {
  image:     new Set(["image/jpeg", "image/png", "image/webp"]),
  thumbnail: new Set(["image/jpeg"]),
  video:     new Set(["video/mp4", "video/quicktime"]),
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function extFor(contentType: string): string {
  const [, sub = ""] = contentType.split("/");
  if (sub === "quicktime") return "mov";
  if (sub === "jpeg") return "jpg";
  return sub || "bin";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST")    return json(405, { error: "Method not allowed" });

  // 1. Verify the user's JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json(401, { error: "Authorization required" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnon) return json(500, { error: "Server misconfigured" });

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json(401, { error: "Unauthorized" });

  // 2. Validate request body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const { contentType, contentLength, kind } = body;
  if (kind !== "image" && kind !== "video" && kind !== "thumbnail") {
    return json(400, { error: "kind must be image | video | thumbnail" });
  }
  if (!ALLOWED_TYPES[kind].has(contentType)) {
    return json(400, { error: `Bad content-type "${contentType}" for kind=${kind}` });
  }
  if (typeof contentLength !== "number" || contentLength <= 0 || contentLength > MAX_BYTES[kind]) {
    return json(400, { error: `Bad content-length (max ${MAX_BYTES[kind]} bytes)` });
  }

  // 3. Build object key — namespaced by user, timestamped to avoid collisions
  const r2AccountId  = Deno.env.get("R2_ACCOUNT_ID");
  const r2AccessKey  = Deno.env.get("R2_ACCESS_KEY_ID");
  const r2SecretKey  = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const r2Bucket     = Deno.env.get("R2_BUCKET");
  const r2PublicHost = Deno.env.get("R2_PUBLIC_HOST");
  if (!r2AccountId || !r2AccessKey || !r2SecretKey || !r2Bucket || !r2PublicHost) {
    return json(500, { error: "R2 secrets not configured" });
  }

  const objectKey = `${user.id}/${Date.now()}_${kind}.${extFor(contentType)}`;

  // 4. Sign a PUT URL for R2 (15-min expiry)
  const r2 = new AwsClient({
    accessKeyId:     r2AccessKey,
    secretAccessKey: r2SecretKey,
    region:  "auto",
    service: "s3",
  });

  const endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com/${r2Bucket}/${objectKey}`;

  const signed = await r2.sign(
    new Request(`${endpoint}?X-Amz-Expires=900`, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(contentLength),
      },
    }),
    { aws: { signQuery: true } },
  );

  return json(200, {
    uploadUrl: signed.url,
    publicUrl: `https://${r2PublicHost}/${objectKey}`,
    objectKey,
    expiresIn: 900,
  });
});
