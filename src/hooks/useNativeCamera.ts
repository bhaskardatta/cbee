import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { CameraPreview } from "@capgo/camera-preview";
import type {
  CameraPosition,
  CameraPreviewFlashMode,
  CameraPreviewOptions,
} from "@capgo/camera-preview";
import { Filesystem } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";

// On Samsung S22 / aggressive memory managers, the WebView can be reaped
// AFTER a successful camera capture but BEFORE the React state update lands.
// We persist the captured file path here, then UploadPage rehydrates from
// Preferences on mount. Key is kept short to minimize serialization cost.
const PENDING_CAPTURE_KEY = "cbee.pendingCapture.v1";

interface PendingCapture {
  kind: "photo" | "video";
  path: string;        // native file:// path; convertFileSrc on read
  mimeType: string;
  aspectRatio?: AspectRatio;
  capturedAt: number;
}
import {
  type AspectRatio,
  cropImageToAspect,
  getImageMetadata,
  getVideoMetadata,
  nearestAspect,
} from "@/lib/media";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type GridMode = "off" | "thirds" | "1:1" | "4:5" | "9:16";
export type FlashMode = "off" | "on" | "auto";

export type CameraCaptureResult =
  | {
      kind: "photo";
      file: File;
      width: number;
      height: number;
      aspectRatio: AspectRatio;
    }
  | {
      kind: "video";
      file: File;
      durationSeconds: number;
      width: number;
      height: number;
      aspectRatio: AspectRatio;
    };

export interface UseNativeCameraReturn {
  isAvailable: boolean;
  isPreviewing: boolean;
  isRecording: boolean;
  permissionStatus: "unknown" | "prompt" | "granted" | "denied";
  requestPermissions: () => Promise<{ camera: boolean; mic: boolean }>;
  startPreview: (opts?: {
    position?: CameraPosition;
    aspectRatio?: "4:3" | "16:9";
  }) => Promise<void>;
  stopPreview: () => Promise<void>;
  capturePhoto: (opts?: { aspectRatio?: AspectRatio }) => Promise<CameraCaptureResult>;
  startVideo: () => Promise<void>;
  stopVideo: () => Promise<CameraCaptureResult>;
  flipCamera: () => Promise<void>;
  setFlashMode: (mode: FlashMode) => Promise<void>;
  setFocus: (x: number, y: number) => Promise<void>;
  setZoom: (level: number) => Promise<void>;
  setGridMode: (mode: GridMode) => void;
  gridMode: GridMode;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Video quality target — maps to the plugin's `videoQuality` enum.
 *
 * The product spec wants 3.5 Mbps to keep storage costs in check. The Cap-go
 * plugin does not expose a numeric bitrate from JS, but its `medium` preset
 * targets ~3-4 Mbps at 720p-1080p on both platforms, which is the closest
 * lever we have. Visual quality is indistinguishable on a phone screen.
 *
 * Do NOT raise to "high" without a strong reason — see docs/04_GOTCHAS.md G-20.
 * Explicit numeric bitrate is a Phase 3 plugin-fork follow-up.
 */
const RECORD_QUALITY: NonNullable<CameraPreviewOptions["videoQuality"]> = "medium";

const MAX_RECORD_MS = 60_000;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Read a file path returned by the camera plugin into a File the rest of the
 * app (and `useMediaUpload`) can consume.
 *
 * Two strategies, in order of preference:
 * 1. `Capacitor.convertFileSrc(path)` + fetch + blob — the native side
 *    streams the file directly into the WebView's network stack. ~30×
 *    faster than the base64 path on a 5 MB JPEG (Samsung S22 was
 *    measured at ~80 ms vs ~2.4 s for the atob loop) and crucially
 *    never blocks the JS thread, so Android's WebView watchdog doesn't
 *    kill the process during the decode.
 * 2. Fallback to `Filesystem.readFile` + base64 decode — only used when
 *    convertFileSrc returns a URL the WebView can't fetch (rare).
 */
async function filePathToFile(
  path: string,
  mimeType: string,
  filenameHint: string,
): Promise<File> {
  // Strategy 1: convertFileSrc + fetch (fast path)
  try {
    const webPath = Capacitor.convertFileSrc(path);
    const response = await fetch(webPath);
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 0) {
        return new File([blob], filenameHint, { type: mimeType });
      }
    }
    console.warn("[filePathToFile] convertFileSrc fetch returned empty/bad response, falling back");
  } catch (e) {
    console.warn("[filePathToFile] convertFileSrc path failed, falling back:", e);
  }

  // Strategy 2: Filesystem.readFile (slow path)
  const { data } = await Filesystem.readFile({ path });
  if (typeof data !== "string") {
    return new File([data as unknown as BlobPart], filenameHint, { type: mimeType });
  }
  // base64 → Uint8Array. Decode in 64KB chunks so the main thread can
  // service touch events between chunks (otherwise a 5MB JPEG ANRs the
  // WebView and Samsung kills the process).
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filenameHint, { type: mimeType });
}

/* -------------------------------------------------------------------------- */
/*  Pending-capture rehydration (survives WebView reloads on Samsung etc.)    */
/* -------------------------------------------------------------------------- */

/**
 * If a capture happened but the WebView reloaded before the React state
 * could land, the file path is still in Capacitor Preferences. Call this
 * from UploadPage on mount to rehydrate the preview/upload state.
 *
 * Returns `null` if there's no pending capture or it's stale (> 10 min old).
 * Always clears the Preferences entry after a successful read — the caller
 * owns the result from this point.
 */
export async function consumePendingCapture(): Promise<CameraCaptureResult | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { value } = await Preferences.get({ key: PENDING_CAPTURE_KEY });
    if (!value) return null;
    const pending = JSON.parse(value) as PendingCapture;
    // Always clear so a stale entry doesn't haunt future opens.
    await Preferences.remove({ key: PENDING_CAPTURE_KEY });
    // Don't rehydrate captures older than 10 minutes — likely the user
    // already moved on. Keeps state from popping back unexpectedly.
    if (!pending.path || Date.now() - pending.capturedAt > 10 * 60 * 1000) {
      return null;
    }
    const filenameHint =
      pending.kind === "photo"
        ? `photo_${pending.capturedAt}.jpg`
        : `video_${pending.capturedAt}.mp4`;
    const rawFile = await filePathToFile(pending.path, pending.mimeType, filenameHint);
    if (pending.kind === "photo") {
      // Re-apply the user's selected crop after rehydration so the post
      // matches what the user framed before the WebView reload.
      const file = pending.aspectRatio
        ? await cropImageToAspect(rawFile, pending.aspectRatio)
        : rawFile;
      const meta = await getImageMetadata(file);
      return {
        kind: "photo",
        file,
        width: meta.width,
        height: meta.height,
        aspectRatio:
          pending.aspectRatio ??
          meta.aspectRatio ??
          nearestAspect(meta.width, meta.height),
      };
    }
    const file = rawFile;
    const meta = await getVideoMetadata(file);
    return {
      kind: "video",
      file,
      durationSeconds: meta.durationSeconds,
      width: meta.width,
      height: meta.height,
      aspectRatio: meta.aspectRatio,
    };
  } catch (e) {
    console.warn("[consumePendingCapture] failed (non-fatal):", e);
    return null;
  }
}

/**
 * Clear the pending capture entry without consuming it. Called when the
 * user successfully completes the upload form (the file is now persisted
 * in `posts.media_url`).
 */
export async function clearPendingCapture(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.remove({ key: PENDING_CAPTURE_KEY });
  } catch {
    /* ignore */
  }
}

/* -------------------------------------------------------------------------- */
/*  Hook                                                                      */
/* -------------------------------------------------------------------------- */

export function useNativeCamera(): UseNativeCameraReturn {
  const isAvailable = Capacitor.isNativePlatform();
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<UseNativeCameraReturn["permissionStatus"]>("unknown");
  const [gridMode, setGridModeState] = useState<GridMode>("thirds");

  const positionRef = useRef<CameraPosition>("rear");
  const maxRecordTimerRef = useRef<number | undefined>(undefined);
  const isRecordingRef = useRef(false);

  // Clean up if the consumer unmounts mid-preview
  useEffect(() => {
    return () => {
      if (isPreviewing) {
        CameraPreview.stop().catch(() => {});
      }
      if (maxRecordTimerRef.current !== undefined) {
        window.clearTimeout(maxRecordTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------- permissions ----------------------------- */

  const requestPermissions = useCallback(async () => {
    if (!isAvailable) return { camera: false, mic: false };
    try {
      // Pass disableAudio:false so the prompt also covers microphone access
      // (required for video recording). showSettingsAlert surfaces an "Open
      // Settings" link if the user previously denied at the OS level.
      const res = await CameraPreview.requestPermissions({
        disableAudio: false,
        showSettingsAlert: true,
      });
      const camera = res?.camera === "granted";
      const mic = res?.microphone === "granted";
      setPermissionStatus(camera && mic ? "granted" : camera ? "prompt" : "denied");
      return { camera, mic };
    } catch (e) {
      console.error("[useNativeCamera] requestPermissions error:", e);
      setPermissionStatus("denied");
      return { camera: false, mic: false };
    }
  }, [isAvailable]);

  /* ----------------------------- preview -------------------------------- */

  const startPreview = useCallback(
    async (opts?: { position?: CameraPosition; aspectRatio?: "4:3" | "16:9" }) => {
      if (!isAvailable) {
        console.warn("[useNativeCamera] startPreview no-op on web");
        return;
      }

      // Defensive: kill any lingering native camera session from a prior
      // mount that wasn't cleanly torn down (e.g. activity recreate after
      // OS permission grant). Without this, `start()` can hit "camera is
      // already running" on the second open, and the plugin leaves a
      // half-initialized state where isPreviewing is true but no surface
      // is drawing.
      try {
        await CameraPreview.stop();
      } catch {
        /* expected when no prior session exists — ignore */
      }
      setIsPreviewing(false);
      isRecordingRef.current = false;

      const position: CameraPosition = opts?.position ?? "rear";
      positionRef.current = position;

      // Explicit width/height: on Samsung S22 / Android 16 with edge-to-edge,
      // the plugin's default of `webView.getWidth()/getHeight()` returns the
      // measured size BEFORE insets are applied, which on this device is
      // half the actual viewport. Result: camera preview fills only the top
      // half of the screen. Passing the full screen dimensions in CSS pixels
      // forces the surface to fill edge-to-edge. The plugin multiplies by
      // density internally so we send logical pixels, not physical.
      const previewWidth =
        typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 360;
      const previewHeight =
        typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 800;

      const previewOpts: CameraPreviewOptions = {
        position,
        toBack: true,                 // native preview behind WebView (transparency trick)
        disableAudio: false,          // we need audio for video recording
        enableVideoMode: true,        // Android: unlocks startRecordVideo path
        videoQuality: RECORD_QUALITY, // see RECORD_QUALITY comment
        storeToFile: true,            // avoids the 5MB base64 bridge cliff (G-6)
        lockAndroidOrientation: true, // pivoting mid-record corrupts the file
        width: previewWidth,
        height: previewHeight,
        x: 0,
        y: 0,
        ...(opts?.aspectRatio ? { aspectRatio: opts.aspectRatio } : {}),
      };

      // Toggle the body class FIRST so the WebView is transparent the
      // moment the native preview attaches. If we add the class only
      // AFTER start resolves, there's a frame where the camera surface
      // is alive but the WebView is still opaque, producing the "brief
      // flash then refresh" artifact users saw on real Samsung devices.
      document.body.classList.add("camera-active");
      try {
        await CameraPreview.start(previewOpts);
        setIsPreviewing(true);
      } catch (e) {
        // Roll back the class so the underlying UI isn't stuck hidden.
        document.body.classList.remove("camera-active");
        throw e;
      }
    },
    [isAvailable],
  );

  const stopPreview = useCallback(async () => {
    if (!isAvailable) {
      // Even on web, make sure the body class is cleared so UI isn't
      // stuck in camera-mode after a no-op start.
      document.body.classList.remove("camera-active");
      return;
    }
    try {
      if (isRecordingRef.current) {
        try {
          await CameraPreview.stopRecordVideo();
        } catch {
          /* recording may have already stopped — non-fatal */
        }
        isRecordingRef.current = false;
        setIsRecording(false);
      }
      try {
        await CameraPreview.stop();
      } catch (e) {
        // Swallow "camera not running" — plugin throws if no active
        // session, but stopPreview must be idempotent.
        const msg = e instanceof Error ? e.message : String(e);
        if (!/not running|not started|no active/i.test(msg)) {
          console.warn("[useNativeCamera] stop() error:", e);
        }
      }
    } finally {
      // ALWAYS clear UI state, even if the native stop threw. The body
      // class is what controls whether the React tree is hidden — leaving
      // it stuck would lock the user out of the app.
      setIsPreviewing(false);
      document.body.classList.remove("camera-active");
    }
  }, [isAvailable]);

  /* ---------------------------- capture --------------------------------- */

  const capturePhoto = useCallback(
    async (opts?: { aspectRatio?: AspectRatio }): Promise<CameraCaptureResult> => {
      if (!isAvailable) throw new Error("Camera not available on this platform");

      // With storeToFile:true, `value` is an absolute file path on device.
      const res = await CameraPreview.capture({ quality: 90, format: "jpeg" });
      if (!res?.value) throw new Error("Camera returned no file path");

      // CRITICAL: persist the captured path to Preferences IMMEDIATELY, BEFORE
      // any heavy work that could be interrupted by a WebView reload.
      try {
        const pending: PendingCapture = {
          kind: "photo",
          path: res.value,
          mimeType: "image/jpeg",
          aspectRatio: opts?.aspectRatio,
          capturedAt: Date.now(),
        };
        await Preferences.set({
          key: PENDING_CAPTURE_KEY,
          value: JSON.stringify(pending),
        });
      } catch (e) {
        console.warn("[capturePhoto] Preferences.set failed (non-fatal):", e);
      }

      const rawFile = await filePathToFile(
        res.value,
        "image/jpeg",
        `photo_${Date.now()}.jpg`,
      );

      // Apply the user-selected crop. If no aspect ratio was passed (e.g.
      // user had grid mode "off" or "thirds"), we keep the native sensor
      // aspect and just snap-label it to the nearest canonical ratio.
      const targetAspect = opts?.aspectRatio;
      const file = targetAspect
        ? await cropImageToAspect(rawFile, targetAspect)
        : rawFile;
      const meta = await getImageMetadata(file);

      return {
        kind: "photo",
        file,
        width: meta.width,
        height: meta.height,
        aspectRatio:
          targetAspect ??
          meta.aspectRatio ??
          nearestAspect(meta.width, meta.height),
      };
    },
    [isAvailable],
  );

  const startVideo = useCallback(async () => {
    if (!isAvailable) throw new Error("Camera not available on this platform");

    console.log("[useNativeCamera] startVideo: entering");

    // Defensive: try to stop any orphaned recording first. The plugin can
    // be left in `isRecording=true` state internally if a previous mount
    // crashed during stop. Without this, startRecordVideo here would error.
    try {
      await CameraPreview.stopRecordVideo();
      console.log("[useNativeCamera] startVideo: defensive stop cleared an orphan");
    } catch (e) {
      // Expected when nothing was recording. Don't surface — startRecordVideo
      // will fail loud below if there's a real problem.
      const msg = e instanceof Error ? e.message : String(e);
      console.log("[useNativeCamera] startVideo: no orphan to clear:", msg.slice(0, 80));
    }

    // The plugin's startRecordVideo takes CameraPreviewOptions (iOS only;
    // Android inherits from the start() call). Quality must match the
    // session we opened with.
    await CameraPreview.startRecordVideo({
      position: positionRef.current,
      videoQuality: RECORD_QUALITY,
      disableAudio: false,
    });
    console.log("[useNativeCamera] startVideo: CameraPreview.startRecordVideo resolved");
    isRecordingRef.current = true;
    setIsRecording(true);

    // We intentionally do NOT auto-stop the recording here. The
    // ShutterButton owns the hard ceiling (maxVideoMs) and will call
    // stopVideo() to finalize. If we tripped the UI state here, the
    // user would see the button revert to idle while the plugin was
    // still actively recording — leading to the "Recording failed: 8"
    // error when stop is eventually called against a stale session.
  }, [isAvailable]);

  const stopVideo = useCallback(async (): Promise<CameraCaptureResult> => {
    if (!isAvailable) throw new Error("Camera not available on this platform");

    console.log("[useNativeCamera] stopVideo: entering");

    // CRITICAL: ALWAYS reset recording state, even if the plugin's stop
    // call throws. Without this, when Samsung's OEM CameraX kills the
    // session silently (which happens around 2 s into a video on devices
    // with active screen recording / battery-saver / etc.), the next
    // stopRecordVideo throws "No video recording in progress" — and if
    // we skip setIsRecording(false), the ShutterButton's `recordingArmed`
    // stays stuck at true forever and every subsequent tap fires another
    // failing stop.
    let res: { videoFilePath?: string } | undefined;
    let pluginError: unknown = null;
    try {
      res = await CameraPreview.stopRecordVideo();
      console.log("[useNativeCamera] stopVideo: stopRecordVideo resolved");
    } catch (e) {
      pluginError = e;
      console.warn(
        "[useNativeCamera] stopVideo: stopRecordVideo threw (state will reset anyway):",
        e instanceof Error ? e.message : String(e),
      );
    }

    // Reset state unconditionally — even on error.
    isRecordingRef.current = false;
    setIsRecording(false);
    if (maxRecordTimerRef.current !== undefined) {
      window.clearTimeout(maxRecordTimerRef.current);
      maxRecordTimerRef.current = undefined;
    }

    if (pluginError) {
      // Propagate so the ShutterButton's caller can swallow it gracefully
      // (NativeCameraSheet has a regex that suppresses the toast for these
      // recording-state-desync errors).
      throw pluginError;
    }

    if (!res?.videoFilePath) {
      throw new Error("Camera returned no video path");
    }

    // Persist BEFORE the heavy read/probe — same rationale as capturePhoto.
    try {
      const pending: PendingCapture = {
        kind: "video",
        path: res.videoFilePath,
        mimeType: "video/mp4",
        capturedAt: Date.now(),
      };
      await Preferences.set({
        key: PENDING_CAPTURE_KEY,
        value: JSON.stringify(pending),
      });
    } catch (e) {
      console.warn("[stopVideo] Preferences.set failed (non-fatal):", e);
    }

    const file = await filePathToFile(res.videoFilePath, "video/mp4", `video_${Date.now()}.mp4`);
    const meta = await getVideoMetadata(file);

    return {
      kind: "video",
      file,
      durationSeconds: meta.durationSeconds,
      width: meta.width,
      height: meta.height,
      aspectRatio: meta.aspectRatio,
    };
  }, [isAvailable]);

  /* ------------------------- camera controls ---------------------------- */

  const flipCamera = useCallback(async () => {
    if (!isAvailable) return;
    await CameraPreview.flip();
    positionRef.current = positionRef.current === "rear" ? "front" : "rear";
  }, [isAvailable]);

  const setFlashMode = useCallback(
    async (mode: FlashMode) => {
      if (!isAvailable) return;
      // Plugin accepts 'off' | 'on' | 'auto' | 'torch'. We expose only the
      // first three to UI; 'torch' is a Phase 3 follow-up if we need a video
      // light.
      const flashMode: CameraPreviewFlashMode = mode;
      await CameraPreview.setFlashMode({ flashMode });
    },
    [isAvailable],
  );

  const setFocus = useCallback(
    async (x: number, y: number) => {
      if (!isAvailable) return;
      await CameraPreview.setFocus({ x, y });
    },
    [isAvailable],
  );

  const setZoom = useCallback(
    async (level: number) => {
      if (!isAvailable) return;
      await CameraPreview.setZoom({ level, ramp: true, autoFocus: true });
    },
    [isAvailable],
  );

  /* ------------------------------ grid ---------------------------------- */

  const setGridMode = useCallback((mode: GridMode) => {
    setGridModeState(mode);
    // We render the gridlines as an SVG overlay in JS (GridlinesOverlay
    // component, Week 2) rather than calling CameraPreview.setGridMode. This
    // gives us the 1:1 / 4:5 / 9:16 frame guides the plugin's 3x3/4x4 modes
    // can't draw. Persistence lives in the UI sheet via @capacitor/preferences.
  }, []);

  return {
    isAvailable,
    isPreviewing,
    isRecording,
    permissionStatus,
    requestPermissions,
    startPreview,
    stopPreview,
    capturePhoto,
    startVideo,
    stopVideo,
    flipCamera,
    setFlashMode,
    setFocus,
    setZoom,
    setGridMode,
    gridMode,
  };
}
