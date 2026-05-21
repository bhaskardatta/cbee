# Feature: Upload Flow (Phase 2 refactor)

**Goal:** Wire the new `NativeCameraSheet` into `UploadPage` without disrupting the existing gallery-import flow. Pass the new media metadata (`media_kind`, `media_aspect_ratio`, `duration_seconds`, `thumbnail_url`) through to the database.

**Estimated effort:** 1 day (overlaps with Week 2 camera work).

---

## Current Phase 1 flow

```
UploadPage
  → <input type="file"> click
  → file selected
  → resize image to <2MB if image
  → preview rendered
  → user types caption, hashtags
  → tap "Post"
  → useCreatePost mutation:
      → useMediaUpload (uploads to messages bucket)    ← will change
      → INSERT into posts with { type, media_url, caption, hashtags, location }
  → toast success, navigate to home
```

## Phase 2 flow

```
UploadPage
  ├── [Take Photo or Video]   ←  NEW BUTTON
  │     → opens NativeCameraSheet
  │     → on capture: result with kind, file, dims, aspect, duration
  │     → close sheet, set selectedFile + meta
  │
  └── [Choose from Gallery]   ←  EXISTING BUTTON
        → <input type="file">
        → ENFORCE video duration ≤ 60s   ←  NEW CHECK
        → derive aspect ratio from file metadata
        → preview rendered
        → user types caption, hashtags

both branches converge:
  → tap "Post"
  → makeVideoThumbnail() if video    ←  NEW
  → useCreatePost mutation:
      → useMediaUpload → R2 via edge function (see media_storage.md)   ←  CHANGED architecture
      → useMediaUpload for thumbnail (if video)
      → INSERT into posts with {
          type, media_kind, media_url, thumbnail_url,
          media_aspect_ratio, duration_seconds,
          caption, hashtags, location
        }
  → toast success, navigate to home
```

The trigger `posts_sync_type_media_kind` (see `docs/02_DATA_MODEL.md`) keeps `type` and `media_kind` aligned, so we can write either or both with no risk of drift.

---

## File-by-file edits

### `src/pages/UploadPage.tsx`

State additions:
```ts
const [cameraOpen, setCameraOpen] = useState(false);
const [captureMeta, setCaptureMeta] = useState<{
  mediaKind: 'image' | 'video';
  mediaAspectRatio: '1:1' | '4:5' | '9:16' | '16:9';
  durationSeconds?: number;
} | null>(null);
```

The existing `selectedFile` and `preview` state stays. We just augment with metadata.

Handler additions:
```ts
const handleCameraCapture = (result: CameraCaptureResult) => {
  setCameraOpen(false);
  setSelectedFile(result.file);
  setPreview(URL.createObjectURL(result.file));
  setCaptureMeta({
    mediaKind: result.kind === 'photo' ? 'image' : 'video',
    mediaAspectRatio: result.aspectRatio,
    durationSeconds: result.kind === 'video' ? result.durationSeconds : undefined,
  });
};

const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // NEW: video duration guardrail
  if (file.type.startsWith('video/')) {
    const duration = await getVideoDuration(file);   // helper defined below
    if (duration > 60) {
      toast({
        title: 'Video too long',
        description: 'Pet videos must be 60 seconds or less.',
        variant: 'destructive',
      });
      return;
    }
    const aspect = await getVideoAspectRatio(file);   // helper
    setCaptureMeta({
      mediaKind: 'video',
      mediaAspectRatio: aspect,
      durationSeconds: duration,
    });
  } else {
    const aspect = await getImageAspectRatio(file);
    setCaptureMeta({
      mediaKind: 'image',
      mediaAspectRatio: aspect,
    });
  }

  // … existing resize-then-preview logic unchanged …
};
```

UI additions, after the existing "Choose from gallery" button and before the preview:

```tsx
<Button
  variant="default"
  size="lg"
  className="w-full bg-[#26A69A] hover:bg-[#1f8c81] text-white"
  onClick={() => setCameraOpen(true)}
>
  <CameraIcon className="mr-2 h-5 w-5" />
  Take Photo or Video
</Button>

<NativeCameraSheet
  open={cameraOpen}
  onClose={() => setCameraOpen(false)}
  onCapture={handleCameraCapture}
/>
```

### Helper functions (in `src/lib/media.ts`, new file)

```ts
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(v.duration);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video duration'));
    };
    v.src = url;
  });
}

export function getVideoAspectRatio(file: File): Promise<'1:1' | '4:5' | '9:16' | '16:9'> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(matchAspectRatio(v.videoWidth, v.videoHeight));
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read video dimensions'));
    };
    v.src = url;
  });
}

export function getImageAspectRatio(file: File): Promise<'1:1' | '4:5' | '9:16' | '16:9'> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(matchAspectRatio(img.naturalWidth, img.naturalHeight));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image dimensions'));
    };
    img.src = url;
  });
}

function matchAspectRatio(w: number, h: number): '1:1' | '4:5' | '9:16' | '16:9' {
  const r = w / h;
  // distances to canonical ratios
  const candidates: Array<['1:1' | '4:5' | '9:16' | '16:9', number]> = [
    ['1:1', 1.0],
    ['4:5', 4 / 5],
    ['9:16', 9 / 16],
    ['16:9', 16 / 9],
  ];
  let best = candidates[0];
  let bestDist = Math.abs(Math.log(r / candidates[0][1]));
  for (const c of candidates.slice(1)) {
    const dist = Math.abs(Math.log(r / c[1]));
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best[0];
}

export async function makeVideoThumbnail(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.src = url;
  v.crossOrigin = 'anonymous';
  v.playsInline = true;
  v.muted = true;

  await new Promise<void>((resolve, reject) => {
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(0.5, v.duration / 2);
    };
    v.onseeked = () => resolve();
    v.onerror = () => reject(new Error('Could not seek video'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = v.videoWidth;
  canvas.height = v.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(v, 0, 0);
  URL.revokeObjectURL(url);

  return new Promise<File>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(new File([blob!], `thumb_${Date.now()}.jpg`, { type: 'image/jpeg' })),
      'image/jpeg',
      0.75
    );
  });
}
```

### `src/hooks/useMediaUpload.ts`

Phase 2 replaces the body of `useMediaUpload` to go through the Cloudflare R2 path. Full details in `docs/features/media_storage.md`. The summary:

```ts
const { upload, uploading, progress } = useMediaUpload();
const result = await upload(file, 'image' | 'video' | 'thumbnail');
// result = { publicUrl: 'https://media.cbee.in/<uid>/<ts>.jpg', objectKey: '...' } | null
```

Internally the hook calls the `get-upload-url` Supabase Edge Function to get a signed R2 PUT URL, then PUTs the file directly to R2 with progress events. Returns the permanent public URL which gets stored in `posts.media_url`.

Updates needed at callsites:
- `MessagesPage.tsx` → leave on existing Supabase `messages` bucket for Phase 2 (low volume, pre-existing). Phase 3 candidate for R2 migration.
- `UploadPage.tsx` → new hook signature: `upload(file, 'image' | 'video')`.
- `ProfilePhotoEditor.tsx` → call `upload(file, 'image')`. Avatar URL gets stored in `profiles.avatar_url`.

### `src/hooks/usePosts.ts` (`useCreatePost`)

Add the new fields to the insert payload:

```ts
const { data, error } = await supabase
  .from('posts')
  .insert({
    user_id: user.id,
    type: mediaKind === 'video' ? 'video' : 'photo',   // legacy column, trigger keeps in sync
    media_kind: mediaKind,                              // canonical Phase 2 column
    media_url: uploadedUrl,
    thumbnail_url: thumbnailUrl ?? null,
    media_aspect_ratio: mediaAspectRatio,
    duration_seconds: durationSeconds ?? null,
    caption,
    hashtags,
    location,
  })
  .select()
  .single();
```

Then in the submit flow:

```ts
const handleSubmit = async () => {
  if (!selectedFile || !captureMeta) return;

  const mediaResult = await upload(selectedFile, captureMeta.mediaKind);
  if (!mediaResult) throw new Error('Upload failed');

  let thumbnailUrl: string | null = null;
  if (captureMeta.mediaKind === 'video') {
    const thumbFile = await makeVideoThumbnail(selectedFile);
    const thumbResult = await upload(thumbFile, 'thumbnail');
    thumbnailUrl = thumbResult?.publicUrl ?? null;
  }

  await createPostMutation.mutateAsync({
    mediaUrl: mediaResult.publicUrl,
    thumbnailUrl,
    mediaKind: captureMeta.mediaKind,
    mediaAspectRatio: captureMeta.mediaAspectRatio,
    durationSeconds: captureMeta.durationSeconds,
    caption,
    hashtags,
    location,
  });
};
```

---

## Why the gallery import needs the duration cap

Without it: a user picks their 5-minute pet video → it uploads (50MB-ish if compressed) → it tries to play in the Reels feed → 30 seconds of buffering on Jio → user bounces. Worse, it inflates Supabase Storage egress.

With the cap: the user gets a polite rejection upfront with an explanation. They go back to their phone's gallery and pick a clip instead. Or they hit "Take Photo or Video" and capture a fresh 30-second clip from the native camera (which is already enforced at the source).

---

## Backward compatibility for existing posts

The `posts.thumbnail_url` column was added in Phase 2 — pre-Phase-2 video posts have NULL. The Reels feed:
- If `thumbnail_url` is non-null, set `<video poster="...">` to it.
- If null, the `<video>` shows its built-in first-frame (browser-dependent; usually fine).

No backfill needed. Posts without thumbnails still work; they just don't pre-render a poster.

---

## Acceptance criteria (DoD)

- [ ] Tapping "Take Photo or Video" opens NativeCameraSheet (covered in `camera.md`).
- [ ] Capturing a photo via camera fills the preview and the captureMeta state.
- [ ] Capturing a video via camera fills preview, captureMeta, and `durationSeconds` is set correctly.
- [ ] Importing a 65-second video from gallery shows an error toast and does NOT advance to preview.
- [ ] Importing a 30-second video correctly detects aspect ratio.
- [ ] Submitting a photo post writes a row with `media_kind='image'`, `type='photo'`, `media_aspect_ratio` set.
- [ ] Submitting a video post writes a row with `media_kind='video'`, `type='video'`, `duration_seconds`, `thumbnail_url`, `media_aspect_ratio`.
- [ ] Submitting fires upload to Cloudflare R2 (verify object exists at media.cbee.in URL).
- [ ] No regression: messages page still uploads to `messages` bucket.

---

**Next:** `docs/features/bottom_nav.md` for the navigation reshuffle, or `docs/features/moderation_mvp.md` for the report button.
