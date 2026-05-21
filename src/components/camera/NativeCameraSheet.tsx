import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera as CameraIcon,
  Zap,
  ZapOff,
  RotateCcw,
  X,
} from "lucide-react";
import { Preferences } from "@capacitor/preferences";
import { useNativeCamera } from "@/hooks/useNativeCamera";
import type { CameraCaptureResult } from "@/hooks/useNativeCamera";
import GridlinesOverlay, {
  GRID_MODE_CYCLE,
  labelForGridMode,
  type GridMode,
} from "./GridlinesOverlay";
import ShutterButton, { type CaptureMode } from "./ShutterButton";
import { toast } from "@/hooks/use-toast";

/* -------------------------------------------------------------------------- */
/*  Props                                                                     */
/* -------------------------------------------------------------------------- */

interface NativeCameraSheetProps {
  open: boolean;
  onClose: () => void;
  onCapture: (result: CameraCaptureResult) => void;
}

type FlashState = "off" | "on" | "auto";
const FLASH_CYCLE: readonly FlashState[] = ["off", "auto", "on"] as const;
const GRID_PREFERENCE_KEY = "cbee.camera.gridMode";

/* -------------------------------------------------------------------------- */
/*  Reset videos before mount (iOS audio session collision — gotcha G-3)       */
/* -------------------------------------------------------------------------- */

/**
 * Pause and unload any <video> elements in the DOM before opening the camera.
 *
 * iOS shares a single AVAudioSession across the WebView; a playing <video>
 * elsewhere on screen (e.g. the Reels feed) silently steals the mic when the
 * camera starts, producing soundless recordings. Tear them down first.
 */
function teardownActiveVideos(): void {
  document.querySelectorAll<HTMLVideoElement>("video").forEach((v) => {
    try {
      v.pause();
      v.removeAttribute("src");
      v.load();
    } catch {
      /* ignore */
    }
  });
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function NativeCameraSheet({ open, onClose, onCapture }: NativeCameraSheetProps) {
  const camera = useNativeCamera();
  const [captureMode, setCaptureMode] = useState<CaptureMode>("photo");
  const [flash, setFlash] = useState<FlashState>("off");
  const [grid, setGrid] = useState<GridMode>("thirds");
  const [previewReady, setPreviewReady] = useState(false);
  const [reticle, setReticle] = useState<{ x: number; y: number; id: number } | null>(null);

  const previewLayerRef = useRef<HTMLDivElement | null>(null);
  // For pinch-to-zoom
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const zoomRef = useRef<number>(1);

  /* ---------------------------- mount lifecycle --------------------------- */

  // Restore grid mode preference on first mount.
  useEffect(() => {
    (async () => {
      try {
        const { value } = await Preferences.get({ key: GRID_PREFERENCE_KEY });
        if (value && (GRID_MODE_CYCLE as readonly string[]).includes(value)) {
          setGrid(value as GridMode);
        }
      } catch {
        /* unsupported → keep default */
      }
    })();
  }, []);

  // Open / close lifecycle.
  //
  // Uses a ref for the cancellation flag so it survives across React's
  // double-render in StrictMode AND across the activity-resume re-mount
  // some Android permission flows can cause.
  //
  // Permission is expected to be pre-granted by the caller (UploadPage's
  // openCameraSheet does the request BEFORE flipping `open` to true).
  // We re-check defensively but never trigger the OS dialog from inside
  // the effect, because that dialog is what causes the activity lifecycle
  // to recreate the WebView and crash the camera start.
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    cancelledRef.current = false;

    (async () => {
      try {
        teardownActiveVideos();
      } catch (e) {
        console.warn("[NativeCameraSheet] teardownActiveVideos threw:", e);
      }

      // Quick non-prompting permission check (won't trigger OS dialog).
      const perm = await camera.requestPermissions();
      if (cancelledRef.current) return;
      if (!perm.camera) {
        toast({
          title: "Camera access needed",
          description: "Enable camera in Settings to take photos and videos.",
          variant: "destructive",
        });
        onClose();
        return;
      }

      try {
        await camera.startPreview({ position: "rear" });
        if (cancelledRef.current) {
          await camera.stopPreview();
          return;
        }
        try {
          await camera.setFlashMode(flash);
        } catch (e) {
          console.warn("[NativeCameraSheet] setFlashMode failed (non-fatal):", e);
        }
        setPreviewReady(true);
      } catch (e) {
        console.error("[NativeCameraSheet] startPreview failed:", e);
        toast({
          title: "Could not open camera",
          description: e instanceof Error ? e.message : "Please try again.",
          variant: "destructive",
        });
        onClose();
      }
    })();

    return () => {
      cancelledRef.current = true;
      setPreviewReady(false);
      // Always run stopPreview — even if startPreview was still in flight,
      // useNativeCamera.stopPreview is idempotent (B3) and ALWAYS clears
      // the body.camera-active class. Without that, the React tree stays
      // visibility:hidden and the user is locked out of the app.
      camera.stopPreview().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ----------------------------- handlers ------------------------------ */

  const cycleFlash = useCallback(async () => {
    const idx = FLASH_CYCLE.indexOf(flash);
    const next = FLASH_CYCLE[(idx + 1) % FLASH_CYCLE.length];
    setFlash(next);
    try {
      await camera.setFlashMode(next);
    } catch (e) {
      console.warn("[NativeCameraSheet] setFlashMode failed:", e);
    }
  }, [flash, camera]);

  const cycleGrid = useCallback(async () => {
    const idx = GRID_MODE_CYCLE.indexOf(grid);
    const next = GRID_MODE_CYCLE[(idx + 1) % GRID_MODE_CYCLE.length];
    setGrid(next);
    try {
      await Preferences.set({ key: GRID_PREFERENCE_KEY, value: next });
    } catch {
      /* ignore — non-critical */
    }
  }, [grid]);

  const flip = useCallback(async () => {
    try {
      await camera.flipCamera();
    } catch (e) {
      console.warn("[NativeCameraSheet] flipCamera failed:", e);
    }
  }, [camera]);

  const handlePhoto = useCallback(async () => {
    try {
      // Belt-and-braces: re-apply the flash mode right before capture.
      // On Samsung's OEM CameraX (and some Pixel variants), the flash mode
      // set during preview-start can get reset by lifecycle events; setting
      // it again immediately before capture ensures the LED actually fires.
      try {
        await camera.setFlashMode(flash);
      } catch (e) {
        console.warn("[NativeCameraSheet] re-apply flash failed:", e);
      }

      // Map the grid overlay choice to a target aspect ratio for the crop.
      // "off" and "thirds" don't change the framing — capture native sensor
      // aspect; "1:1" / "4:5" / "9:16" trigger a centered Canvas crop.
      const targetAspect =
        grid === "1:1" || grid === "4:5" || grid === "9:16" ? grid : undefined;
      const res = await camera.capturePhoto({ aspectRatio: targetAspect });
      onCapture(res);
    } catch (e) {
      toast({
        title: "Capture failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [camera, onCapture, grid, flash]);

  const handleVideoStart = useCallback(async () => {
    try {
      await camera.startVideo();
    } catch (e) {
      toast({
        title: "Could not start recording",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [camera]);

  const handleVideoStop = useCallback(async () => {
    try {
      const res = await camera.stopVideo();
      onCapture(res);
    } catch (e) {
      // Recording-state desync (plugin thinks one thing, OS thinks another)
      // produces messages like "Video recording failed: 8" or "No video
      // recording in progress". These happen when the OS killed our session
      // or when stop is called against a session that already ended. We
      // swallow these silently — there's no captured file to deliver, and
      // the user already knows something's wrong because the recording ring
      // disappeared. A red toast here just confuses them.
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[NativeCameraSheet] stopVideo failed:", msg);
      if (
        /Video recording failed:?\s*\d+/i.test(msg) ||
        /no video recording/i.test(msg) ||
        /not recording/i.test(msg) ||
        /recording.*progress/i.test(msg)
      ) {
        return;
      }
      toast({
        title: "Recording failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [camera, onCapture]);

  /* ----------------------- tap-to-focus + pinch-to-zoom ---------------------- */

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointersRef.current.size === 2) {
        const pts = Array.from(activePointersRef.current.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        pinchStateRef.current = { startDist: dist, startZoom: zoomRef.current };
      }
    },
    [],
  );

  const handlePointerMove = useCallback(
    async (e: React.PointerEvent<HTMLDivElement>) => {
      if (!activePointersRef.current.has(e.pointerId)) return;
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointersRef.current.size === 2 && pinchStateRef.current) {
        const pts = Array.from(activePointersRef.current.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const ratio = dist / pinchStateRef.current.startDist;
        const next = Math.max(1, Math.min(8, pinchStateRef.current.startZoom * ratio));
        zoomRef.current = next;
        try {
          await camera.setZoom(next);
        } catch {
          /* swallow — some platforms reject mid-gesture */
        }
      }
    },
    [camera],
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent<HTMLDivElement>) => {
      const wasTwoFinger = activePointersRef.current.size === 2;
      activePointersRef.current.delete(e.pointerId);
      if (wasTwoFinger) {
        pinchStateRef.current = null;
        return; // pinch end — do not treat as tap-to-focus
      }

      // Single-finger tap → focus
      const layer = previewLayerRef.current;
      if (!layer) return;
      const rect = layer.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      const id = Date.now();
      setReticle({ x: e.clientX - rect.left, y: e.clientY - rect.top, id });
      window.setTimeout(() => {
        setReticle((curr) => (curr?.id === id ? null : curr));
      }, 700);
      try {
        await camera.setFocus(nx, ny);
      } catch {
        /* ignore — best-effort */
      }
    },
    [camera],
  );

  /* -------------------------------- render -------------------------------- */

  if (!open) return null;

  // We portal into <body> rather than rendering inline so the WebView
  // transparency rule (body.camera-active) can cleanly override every parent.
  //
  // Flash icon — "off" is the slashed bolt, "auto" / "on" are both the bolt
  // but we badge the auto variant with a small "A" so users can tell them
  // apart at a glance. Color: yellow for "on" so it pops, white otherwise.
  const FlashIcon = flash === "off" ? ZapOff : Zap;
  const flashColor = flash === "on" ? "text-yellow-300" : "text-white";
  const flashLabel = flash === "off" ? "Off" : flash === "on" ? "On" : "Auto";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Camera"
      className="fixed inset-0 z-[100] flex flex-col"
      // No background here — the native preview shows through the WebView.
    >
      {/* Gesture + focus layer covers the full preview */}
      <div
        ref={previewLayerRef}
        className="absolute inset-0 touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Gridlines — pointer-events:none built in */}
      <GridlinesOverlay mode={grid} />

      {/* Focus reticle */}
      {reticle && (
        <div
          aria-hidden
          className="pointer-events-none absolute w-16 h-16 -ml-8 -mt-8 rounded-md border-2 border-white/95 animate-[ping_700ms_ease-out]"
          style={{ left: reticle.x, top: reticle.y }}
        />
      )}

      {/* Top controls bar — matching gradient backdrop. */}
      <div
        className="relative z-10 flex items-center justify-between px-4 pb-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close camera"
          className="grid place-items-center w-10 h-10 rounded-full bg-black/40 backdrop-blur text-white"
        >
          <X size={22} />
        </button>

        <button
          type="button"
          onClick={cycleGrid}
          aria-label={`Grid mode ${grid}`}
          className="px-3 h-10 rounded-full bg-black/40 backdrop-blur text-white text-sm font-medium"
        >
          {labelForGridMode(grid)}
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={cycleFlash}
            aria-label={`Flash ${flashLabel}`}
            className={`relative grid place-items-center w-10 h-10 rounded-full bg-black/40 backdrop-blur ${flashColor} active:scale-95 transition-transform`}
          >
            <FlashIcon size={20} />
            {flash === "auto" && (
              <span className="absolute -top-1 -right-1 grid place-items-center w-4 h-4 rounded-full bg-yellow-300 text-[9px] font-bold text-black leading-none">
                A
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={flip}
            aria-label="Flip camera"
            className="grid place-items-center w-10 h-10 rounded-full bg-black/40 backdrop-blur text-white"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </div>

      {/* Spacer pushes the bottom controls to safe-area bottom */}
      <div className="flex-1" />

      {/* Bottom controls. The black gradient backdrop hides the compositor
         seam between the camera surface and the bottom of the screen, AND
         masks the AppNavbar / gesture-bar area which can briefly flicker
         visible during the open / close transition on Android. */}
      <div
        className="relative z-10 flex flex-col items-center gap-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-12"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)" }}
      >
        {/* Photo / Video mode pill */}
        <div className="flex bg-black/40 backdrop-blur rounded-full p-1">
          {(["photo", "video"] as CaptureMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setCaptureMode(m)}
              disabled={camera.isRecording}
              className={
                "px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wide transition " +
                (captureMode === m
                  ? "bg-white text-black"
                  : "text-white/90 hover:text-white")
              }
            >
              {m === "photo" ? "Photo" : "Video"}
            </button>
          ))}
        </div>

        <ShutterButton
          mode={captureMode}
          isRecording={camera.isRecording}
          disabled={!previewReady}
          onPhotoCapture={handlePhoto}
          onVideoStart={handleVideoStart}
          onVideoStop={handleVideoStop}
        />

        {/* Empty placeholder div to keep height stable while bottom row is sparse */}
        <div className="h-6" />
      </div>

      {/* Web-platform stub UI — the native preview won't render in a browser. */}
      {!camera.isAvailable && (
        <div className="absolute inset-0 grid place-items-center bg-zinc-900 text-white text-center px-8">
          <div>
            <CameraIcon className="mx-auto mb-3 opacity-70" size={48} />
            <p className="text-base">Native camera is only available on iOS / Android builds.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 px-4 py-2 rounded-md bg-white text-black"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
