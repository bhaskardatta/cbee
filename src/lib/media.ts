/**
 * Media helpers — pure browser primitives, no Capacitor / network deps.
 *
 * Used by:
 *  - `useNativeCamera` after capture, to compute duration + thumbnail
 *  - `UploadPage` gallery import path, to enforce the 60s reels cap
 *  - `useMediaUpload` callers that want a thumbnail before posting
 *
 * Why no MediaInfo / ffmpeg dep: HTMLVideoElement.duration is reliable for
 * MP4 / QuickTime captured by phones; we don't need frame-accurate timing
 * and we'd rather not ship a 2MB WASM blob to enforce a 60s cap.
 */

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

/** The four canonical aspect ratios cbee supports. Order = preference. */
const ASPECT_TARGETS: { label: AspectRatio; value: number }[] = [
  { label: "1:1",  value: 1 },
  { label: "4:5",  value: 4 / 5 },
  { label: "9:16", value: 9 / 16 },
  { label: "16:9", value: 16 / 9 },
];

/** Snap (width, height) to the nearest of cbee's canonical aspect ratios. */
export function nearestAspect(width: number, height: number): AspectRatio {
  if (!width || !height) return "1:1";
  const r = width / height;
  let best: AspectRatio = "1:1";
  let bestDelta = Infinity;
  for (const t of ASPECT_TARGETS) {
    const d = Math.abs(Math.log(r / t.value));
    if (d < bestDelta) {
      bestDelta = d;
      best = t.label;
    }
  }
  return best;
}

/**
 * Read a video file's duration via a hidden <video> element.
 * Resolves to seconds (float). Rejects if the file can't decode.
 *
 * Used to enforce the 60s pet-video cap on gallery imports.
 */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    v.onloadedmetadata = () => {
      const d = v.duration;
      URL.revokeObjectURL(url);
      if (!Number.isFinite(d) || d <= 0) reject(new Error("Could not read video duration"));
      else resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video metadata"));
    };
  });
}

/**
 * Probe a video for duration + frame dimensions in one pass.
 * Saves a duplicate decode when the caller needs both (camera capture path).
 *
 * Gallery imports on Android can hand us a File whose underlying data is
 * still being copied from a content:// URI. `loadedmetadata` may take a
 * couple of seconds. We add a 8 s timeout and degrade gracefully (return
 * 1:1 / 0 s) rather than crash the upload flow — the user will still see
 * the preview render and can submit; the 60 s cap is enforced server-side
 * in the edge function anyway.
 */
export function getVideoMetadata(file: File): Promise<{
  durationSeconds: number;
  width: number;
  height: number;
  aspectRatio: AspectRatio;
}> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;

    let settled = false;
    const finish = (
      payload:
        | { ok: true; duration: number; w: number; h: number }
        | { ok: false; reason: string },
    ) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      try {
        v.load();
      } catch {
        /* ignore */
      }
      if (payload.ok) {
        resolve({
          durationSeconds: Math.round(payload.duration * 100) / 100,
          width: payload.w,
          height: payload.h,
          aspectRatio: nearestAspect(payload.w, payload.h),
        });
      } else {
        console.warn(
          "[getVideoMetadata] could not probe video, using safe defaults:",
          payload.reason,
        );
        // Don't reject — let the upload flow continue with conservative defaults.
        resolve({
          durationSeconds: 0,
          width: 0,
          height: 0,
          aspectRatio: "1:1",
        });
      }
    };

    v.onloadedmetadata = () => {
      const w = v.videoWidth;
      const h = v.videoHeight;
      const d = v.duration;
      if (!Number.isFinite(d) || d <= 0 || !w || !h) {
        finish({ ok: false, reason: `bad metadata d=${d} w=${w} h=${h}` });
      } else {
        finish({ ok: true, duration: d, w, h });
      }
    };
    v.onerror = (e) =>
      finish({ ok: false, reason: `video load error: ${(e as Event).type}` });

    // Hard timeout — Android WebView occasionally never fires onloadedmetadata
    // for content:// backed files until the user interacts.
    const timeoutId = window.setTimeout(() => {
      finish({ ok: false, reason: "8s timeout" });
    }, 8000);
    const clearOnSettle = () => window.clearTimeout(timeoutId);
    v.addEventListener("loadedmetadata", clearOnSettle, { once: true });
    v.addEventListener("error", clearOnSettle, { once: true });

    v.src = url;
  });
}

/**
 * Read image file dimensions via HTMLImageElement.
 * Returns conservative defaults rather than rejecting — same rationale as
 * getVideoMetadata (Android gallery edge cases shouldn't block the upload).
 */
export function getImageMetadata(file: File): Promise<{
  width: number;
  height: number;
  aspectRatio: AspectRatio;
}> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let settled = false;
    const finish = (
      payload: { ok: true; w: number; h: number } | { ok: false; reason: string },
    ) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      if (payload.ok) {
        resolve({
          width: payload.w,
          height: payload.h,
          aspectRatio: nearestAspect(payload.w, payload.h),
        });
      } else {
        console.warn(
          "[getImageMetadata] could not probe image, defaulting to 1:1:",
          payload.reason,
        );
        resolve({ width: 0, height: 0, aspectRatio: "1:1" });
      }
    };
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) finish({ ok: false, reason: "zero dimensions" });
      else finish({ ok: true, w, h });
    };
    img.onerror = () => finish({ ok: false, reason: "image load error" });
    // 8 s timeout — same rationale as videos.
    window.setTimeout(() => finish({ ok: false, reason: "8s timeout" }), 8000);
    img.src = url;
  });
}

/**
 * Extract a JPEG thumbnail from a video at t = min(0.5s, duration/2).
 * Returns a File ready to upload via `useMediaUpload(thumb, "thumbnail")`.
 *
 * Quality 0.75 — visibly fine at feed sizes, ~30-60KB typical.
 */
export function makeVideoThumbnail(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = "anonymous";
    v.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    v.onloadedmetadata = () => {
      // Seek slightly past the first frame — first frames are sometimes black
      // on phone-recorded clips.
      const target = Math.min(0.5, (v.duration || 1) / 2);
      try {
        v.currentTime = target;
      } catch {
        // Some browsers fire onseeked anyway; ignore
      }
    };

    v.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width  = v.videoWidth;
        canvas.height = v.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { cleanup(); reject(new Error("No 2d context")); return; }
        ctx.drawImage(v, 0, 0);
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) reject(new Error("toBlob returned null"));
            else resolve(new File([blob], "thumb.jpg", { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.75,
        );
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };

    v.onerror = () => {
      cleanup();
      reject(new Error("Could not decode video for thumbnail"));
    };
  });
}

/** Max bytes the get-upload-url edge function will accept. Mirror these
 *  numbers client-side so we can short-circuit before round-tripping. */
export const MAX_UPLOAD_BYTES = {
  image:     10 * 1024 * 1024,
  thumbnail:  1 * 1024 * 1024,
  video:     60 * 1024 * 1024,
} as const;

/** Reels duration cap (seconds). Matches the 60s product constraint. */
export const MAX_REEL_DURATION_SECONDS = 60;
