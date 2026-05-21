import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera as CameraIcon,
  FlashlightOff,
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

  // Open / close lifecycle
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      teardownActiveVideos();

      const perm = await camera.requestPermissions();
      if (cancelled) return;
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
        if (cancelled) {
          await camera.stopPreview();
          return;
        }
        await camera.setFlashMode(flash);
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
      cancelled = true;
      setPreviewReady(false);
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
      const res = await camera.capturePhoto();
      onCapture(res);
    } catch (e) {
      toast({
        title: "Capture failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [camera, onCapture]);

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
  const FlashIcon = flash === "off" ? ZapOff : flash === "on" ? Zap : FlashlightOff;

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

      {/* Top controls bar */}
      <div
        className="relative z-10 flex items-center justify-between px-4"
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
            aria-label={`Flash ${flash}`}
            className="grid place-items-center w-10 h-10 rounded-full bg-black/40 backdrop-blur text-white"
          >
            <FlashIcon size={20} />
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

      {/* Bottom controls */}
      <div
        className="relative z-10 flex flex-col items-center gap-4"
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
