# Feature: Media Storage (Cloudflare R2 + Edge Function)

**Goal:** All photo and video uploads in cbee Phase 2 land in a Cloudflare R2 bucket and are served from `media.cbee.in` via Cloudflare's CDN. Postgres holds the metadata (URL, kind, aspect, duration); R2 holds the bytes. This is the architecture the app uses from Day 1 — see ADR-017 for the rationale.

**Estimated effort:** ~0.5 day (Day 4 of the sprint, overlapping with the camera hook work).

---

## Architecture

```
                ┌────────────────────────────────────────┐
                │             cbee app (phone)           │
                └─────────────────┬──────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
   1. INSERT  │    2. CALL EDGE FN│   3. PUT FILE     │
      post    │      get-upload-  │     directly to   │
      row     │      url          │     R2 via signed │
              │                   │     URL           │
              ▼                   ▼                   ▼
   ┌──────────────┐    ┌──────────────────┐   ┌─────────────────────┐
   │ Supabase     │    │ Supabase Edge Fn │   │ Cloudflare R2       │
   │ Postgres     │    │ get-upload-url   │──▶│ private bucket      │
   │ posts.media_ │    │  • verify JWT    │ s3│ cbee-media          │
   │   url stored │    │  • build path    │API│                     │
   │   as         │    │  • aws-sig PUT   │   │ public reads via    │
   │   media.cbee │    │  • return URL    │   │ media.cbee.in CDN   │
   │   .in/...    │    └──────────────────┘   └─────────────────────┘
   └──────────────┘                                    ▲
                                                       │
                                4. GET file via CDN   │
                                   (free egress)      │
                                                       │
                  ┌────────────────────────────────────┘
                  │
        Other users' Reels feed
        / Home feed loading
```

The four moves, in order:

1. **Client wants to upload.** It calls Supabase Edge Function `get-upload-url` with the user's JWT and tells it what kind of file is coming (image vs video, content-type, content-length).
2. **Edge function returns a signed PUT URL.** A 15-minute one-time write URL scoped to `<user_id>/<timestamp>.<ext>` in the R2 bucket. The function also returns the eventual public URL (`https://media.cbee.in/<user_id>/<timestamp>.<ext>`).
3. **Client PUTs the file directly to R2.** No Supabase involvement. The bytes go from the device's network stack straight to Cloudflare's edge.
4. **Client inserts the post row.** Sets `posts.media_url = "https://media.cbee.in/..."`. From this point on, the post is read like any other.

When other users view the post or reel, their `<video src="https://media.cbee.in/...">` or `<img>` hits Cloudflare's edge. The egress is free.

---

## What's NEW in this architecture

| Thing                              | Where it lives                                          |
| ---------------------------------- | ------------------------------------------------------- |
| Cloudflare R2 bucket               | `cbee-media` (created via Cloudflare dashboard)         |
| R2 API token                       | Stored as a Supabase Edge Function secret               |
| CDN subdomain                      | `media.cbee.in` → R2 bucket (configured in Cloudflare)  |
| New Supabase Edge Function         | `supabase/functions/get-upload-url/index.ts`            |
| Modified hook                      | `src/hooks/useMediaUpload.ts`                           |

---

## Cloudflare R2 setup (Swaroop does this once, ~15 minutes)

Detailed step-by-step in `welcome_pack/cloudflare_setup.md` (Swaroop-facing). The summary for Bhaskar:

1. Swaroop signs up at https://cloudflare.com (free).
2. Adds `cbee.in` as a Cloudflare domain (free; he updates nameservers at his registrar).
3. Goes to R2 → "Create bucket" → names it `cbee-media`. Region: Asia-Pacific recommended.
4. Creates an R2 API Token with scope "Object Read & Write" on bucket `cbee-media`. Saves the Access Key ID + Secret Access Key.
5. Connects the bucket to a public domain: R2 bucket → Settings → Public Access → "Connect Domain" → `media.cbee.in`. Cloudflare auto-creates the DNS CNAME.
6. Shares the Access Key ID + Secret Access Key with Bhaskar (via encrypted channel — see keystore-handoff procedure).

After this, Bhaskar configures the Supabase Edge Function with the credentials.

---

## Supabase Edge Function: `get-upload-url`

File: `supabase/functions/get-upload-url/index.ts`. Standard Deno + Supabase Edge Function.

**Secrets it needs** (set via `supabase secrets set <KEY>=<value>` or in Supabase Studio → Project Settings → Edge Functions → Secrets):

```
R2_ACCOUNT_ID         = <Cloudflare account ID, visible in R2 dashboard>
R2_ACCESS_KEY_ID      = <from R2 API token>
R2_SECRET_ACCESS_KEY  = <from R2 API token>
R2_BUCKET             = cbee-media
R2_PUBLIC_HOST        = media.cbee.in
```

**The function itself** (~80 lines, AWS SigV4 signed URL generation):

```ts
// supabase/functions/get-upload-url/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  contentType: string;        // e.g. 'image/jpeg' | 'video/mp4'
  contentLength: number;      // bytes — used as a sanity cap
  kind: 'image' | 'video' | 'thumbnail';
}

const MAX_BYTES = {
  image:     10 * 1024 * 1024,    // 10 MB
  thumbnail:  1 * 1024 * 1024,    //  1 MB
  video:     60 * 1024 * 1024,    // 60 MB
};

const ALLOWED_TYPES = {
  image:     new Set(['image/jpeg', 'image/png', 'image/webp']),
  thumbnail: new Set(['image/jpeg']),
  video:     new Set(['video/mp4', 'video/quicktime']),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST')    return json(405, { error: 'Method not allowed' });

  // 1. Verify the user's JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json(401, { error: 'Unauthorized' });

  // 2. Validate request body
  let body: RequestBody;
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }

  const { contentType, contentLength, kind } = body;
  if (!ALLOWED_TYPES[kind]?.has(contentType)) {
    return json(400, { error: `Bad content-type for kind=${kind}` });
  }
  if (typeof contentLength !== 'number' || contentLength <= 0 || contentLength > MAX_BYTES[kind]) {
    return json(400, { error: `Bad content-length (max ${MAX_BYTES[kind]} bytes)` });
  }

  // 3. Build the object key
  const ext = contentType.split('/')[1] === 'quicktime' ? 'mov' : contentType.split('/')[1];
  const objectKey = `${user.id}/${Date.now()}_${kind}.${ext}`;

  // 4. Sign a PUT URL for R2 (15 min expiry)
  const r2 = new AwsClient({
    accessKeyId:     Deno.env.get('R2_ACCESS_KEY_ID')!,
    secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
    region: 'auto',
    service: 's3',
  });

  const endpoint = `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${Deno.env.get('R2_BUCKET')}/${objectKey}`;

  const signed = await r2.sign(
    new Request(endpoint + '?X-Amz-Expires=900', {
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'Content-Length': String(contentLength) },
    }),
    { aws: { signQuery: true } },
  );

  return json(200, {
    uploadUrl: signed.url,
    publicUrl: `https://${Deno.env.get('R2_PUBLIC_HOST')}/${objectKey}`,
    objectKey,
    expiresIn: 900,
  });
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
```

Deploy with `supabase functions deploy get-upload-url`.

---

## `useMediaUpload.ts` — the new shape

Replace the body of `useMediaUpload` so it calls the edge function then PUTs to R2 directly.

```ts
// src/hooks/useMediaUpload.ts
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type MediaUploadKind = 'image' | 'video' | 'thumbnail';

interface UploadResult {
  publicUrl: string;
  objectKey: string;
}

export function useMediaUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = useCallback(async (file: File, kind: MediaUploadKind): Promise<UploadResult | null> => {
    setUploading(true);
    setProgress(0);
    try {
      // 1. Ask edge function for a signed URL
      const { data, error } = await supabase.functions.invoke('get-upload-url', {
        body: {
          contentType: file.type,
          contentLength: file.size,
          kind,
        },
      });
      if (error || !data) throw new Error(error?.message ?? 'No signed URL');
      const { uploadUrl, publicUrl, objectKey } = data as { uploadUrl: string; publicUrl: string; objectKey: string };

      // 2. PUT the file directly to R2
      await putWithProgress(uploadUrl, file, setProgress);

      return { publicUrl, objectKey };
    } catch (e) {
      console.error('Upload failed:', e);
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, progress };
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 PUT failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error during R2 PUT'));
    xhr.send(file);
  });
}
```

**Why `XMLHttpRequest` and not `fetch`:** `fetch` doesn't expose upload progress events. For a 25MB video on slow connection, the progress bar matters to UX. `XMLHttpRequest` is otherwise just as well-supported as `fetch` in modern WebViews (Capacitor 8 = Chrome 100+ / WKWebView 16+).

**Old call sites that need updating:**
- `MessagesPage.tsx` — chat attachments. Choice: either migrate them to R2 too (recommended; consistency), or leave them on the existing Supabase `messages` bucket. Phase 2 leaves Supabase Storage in place for chat; only `posts-media`-equivalent content goes to R2.
- `UploadPage.tsx` — uses the new hook with `kind: 'image' | 'video'`.
- `ProfilePhotoEditor.tsx` — avatars. Same call as before but `kind: 'image'`.

---

## CORS configuration on R2

R2 needs to allow PUT requests from the cbee app's origin(s). In the Cloudflare R2 dashboard:

R2 → `cbee-media` bucket → Settings → CORS Policy → paste this:

```json
[
  {
    "AllowedOrigins": [
      "capacitor://localhost",
      "http://localhost",
      "https://localhost",
      "https://cbee.in",
      "https://app.cbee.in"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

The `capacitor://localhost` origin is what iOS Capacitor uses; `http://localhost` is Android. Without these, the WebView will block the PUT request with a CORS error.

---

## What the camera flow looks like end-to-end

When a user captures a video in `NativeCameraSheet`:

1. `useNativeCamera.capturePhoto()` or `stopVideo()` returns a `File` from the device's filesystem.
2. `useMediaUpload.upload(file, 'video')` is called.
3. Hook calls `supabase.functions.invoke('get-upload-url', { ... })`.
4. Edge function verifies JWT, returns `{ uploadUrl, publicUrl }`.
5. Hook PUTs the file to `uploadUrl` (R2 directly).
6. Hook returns `publicUrl`.
7. `useCreatePost.mutate({ media_url: publicUrl, ... })` inserts the post row.

A 25MB video at home WiFi takes 10-20 seconds for the PUT. On 4G, 30-60 seconds. The progress bar shows real-time bytes-uploaded.

---

## Edge cases

| Case                                                          | Behavior                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| User loses connectivity mid-PUT                               | XHR.onerror fires. Hook returns `null`. UI shows retry button.                |
| Signed URL expires before upload completes                    | R2 returns 403. Hook handles it by requesting a fresh URL and retrying once.   |
| User exceeds `contentLength` declared to edge function        | R2 server enforces the signed `Content-Length`. PUT fails. We re-validate client-side too. |
| User passes a wrong content-type                              | Edge function rejects with 400 before issuing the signed URL.                 |
| Edge function secret leaks                                    | Worst case: someone uploads ANY file to the cbee-media bucket under their own user_id. Storage costs go up, but not catastrophically; rotate the R2 API token. |
| Public URL hits the wrong file                                | `objectKey` includes `Date.now()` to dodge collisions; user_id namespace prevents cross-tenant clobber. |
| Cache invalidation needed (rare — a takedown)                 | Cloudflare Cache → Purge → enter the URL. Or delete the R2 object directly.    |

---

## Why this scales without code changes

The whole point of this architecture: the codebase stays the same as cbee grows. The knobs that change are all in dashboards.

**At 100 DAU:**
- R2 free tier covers it (10GB storage, 1M writes, 10M reads/month).
- Supabase Pro at $25/month is the entire bill.

**At 1,000 DAU:**
- R2 paid usage starts. Maybe $10-15/month.
- Same code.

**At 10,000 DAU:**
- R2 ~$120/month.
- Supabase may need a compute tier bump (Micro → Small, $10-25 extra). Dashboard click.
- Same code.

**At 100,000 DAU:**
- R2 ~$1,200/month.
- Supabase MAU overage kicks in (~$10/month over the 100k included).
- Same code.

The dashboards do the scaling. The codebase is untouched.

---

## Acceptance criteria (DoD)

- [ ] Cloudflare R2 bucket `cbee-media` exists with public domain `media.cbee.in` connected
- [ ] CORS policy on the bucket allows `capacitor://localhost`, `http://localhost`, `https://localhost`, `https://cbee.in`, `https://app.cbee.in`
- [ ] Edge function `get-upload-url` deployed and reachable
- [ ] Edge function secrets set (R2_*, R2_PUBLIC_HOST)
- [ ] Edge function rejects unauthenticated calls (401)
- [ ] Edge function rejects bad content-types (400)
- [ ] Edge function rejects oversized files (400)
- [ ] `useMediaUpload` end-to-end: image upload via camera → posts row with R2 URL, image visible from another device
- [ ] Same flow for video upload (≤60MB)
- [ ] Upload progress events fire during PUT
- [ ] Signed URL expiry works (manually delay 16 min, retry, get 403, fresh URL succeeds)
- [ ] No code paths still reference a Supabase `posts-media` bucket
- [ ] Cost monitoring set up: Cloudflare R2 dashboard bookmarked, Supabase Studio → Reports bookmarked

---

**Next:** `docs/features/upload_flow.md` for the page-level wiring, or `docs/operations/cost_model.md` for the financial picture.
