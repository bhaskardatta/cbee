import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { CameraPreview } from "@capgo/camera-preview";
import type {
  CameraPosition,
  CameraPreviewFlashMode,
  CameraPreviewOptions,
} from "@capgo/camera-preview";
import { Filesystem } from "@capacitor/filesystem";
import {
  type AspectRatio,
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
  capturePhoto: () => Promise<CameraCaptureResult>;
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
 * iOS returns file:// URIs that the WebView can't fetch directly (gotcha
 * G-1); we go through @capacitor/filesystem instead.
 */
async function filePathToFile(
  path: string,
  mimeType: string,
  filenameHint: string,
): Promise<File> {
  const { data } = await Filesystem.readFile({ path });
  if (typeof data !== "string") {
    // Web returns Blob — convert directly.
    return new File([data as unknown as BlobPart], filenameHint, { type: mimeType });
  }
  // Native returns base64 string — decode to Uint8Array → File.
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filenameHint, { type: mimeType });
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

      const position: CameraPosition = opts?.position ?? "rear";
      positionRef.current = position;

      const previewOpts: CameraPreviewOptions = {
        position,
        toBack: true,                 // native preview behind WebView (transparency trick)
        disableAudio: false,          // we need audio for video recording
        enableVideoMode: true,        // Android: unlocks startRecordVideo path
        videoQuality: RECORD_QUALITY, // see RECORD_QUALITY comment
        storeToFile: true,            // avoids the 5MB base64 bridge cliff (G-6)
        lockAndroidOrientation: true, // pivoting mid-record corrupts the file
        ...(opts?.aspectRatio ? { aspectRatio: opts.aspectRatio } : {}),
      };

      await CameraPreview.start(previewOpts);
      setIsPreviewing(true);
      // Toggle the body class so the WebView background is transparent and
      // the native preview shows through. CSS rule lives in index.css —
      // see docs/features/camera.md "Transparent background".
      document.body.classList.add("camera-active");
    },
    [isAvailable],
  );

  const stopPreview = useCallback(async () => {
    if (!isAvailable) return;
    try {
      if (isRecordingRef.current) {
        await CameraPreview.stopRecordVideo().catch(() => {});
        isRecordingRef.current = false;
        setIsRecording(false);
      }
      await CameraPreview.stop();
    } finally {
      setIsPreviewing(false);
      document.body.classList.remove("camera-active");
    }
  }, [isAvailable]);

  /* ---------------------------- capture --------------------------------- */

  const capturePhoto = useCallback(async (): Promise<CameraCaptureResult> => {
    if (!isAvailable) throw new Error("Camera not available on this platform");

    // With storeToFile:true, `value` is an absolute file path on device.
    const res = await CameraPreview.capture({ quality: 90, format: "jpeg" });
    if (!res?.value) throw new Error("Camera returned no file path");

    const file = await filePathToFile(res.value, "image/jpeg", `photo_${Date.now()}.jpg`);
    const meta = await getImageMetadata(file);

    return {
      kind: "photo",
      file,
      width: meta.width,
      height: meta.height,
      aspectRatio: meta.aspectRatio ?? nearestAspect(meta.width, meta.height),
    };
  }, [isAvailable]);

  const startVideo = useCallback(async () => {
    if (!isAvailable) throw new Error("Camera not available on this platform");

    // The plugin's startRecordVideo takes CameraPreviewOptions (iOS only;
    // Android inherits from the start() call). Quality must match the
    // session we opened with.
    await CameraPreview.startRecordVideo({
      position: positionRef.current,
      videoQuality: RECORD_QUALITY,
      disableAudio: false,
    });
    isRecordingRef.current = true;
    setIsRecording(true);

    // Defensive auto-stop — plugin maxDuration support is platform-dependent.
    maxRecordTimerRef.current = window.setTimeout(() => {
      if (isRecordingRef.current) {
        // Just trip the UI state; the ShutterButton's onVideoStop will
        // finalize via stopVideo() which actually reads the file.
        setIsRecording(false);
      }
    }, MAX_RECORD_MS + 500);
  }, [isAvailable]);

  const stopVideo = useCallback(async (): Promise<CameraCaptureResult> => {
    if (!isAvailable) throw new Error("Camera not available on this platform");

    const res = await CameraPreview.stopRecordVideo();
    isRecordingRef.current = false;
    setIsRecording(false);
    if (maxRecordTimerRef.current !== undefined) {
      window.clearTimeout(maxRecordTimerRef.current);
      maxRecordTimerRef.current = undefined;
    }

    if (!res?.videoFilePath) throw new Error("Camera returned no video path");
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
