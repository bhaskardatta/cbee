import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export type CaptureMode = "photo" | "video";

interface ShutterButtonProps {
  mode: CaptureMode;
  isRecording: boolean;
  onPhotoCapture: () => Promise<void> | void;
  onVideoStart: () => Promise<void> | void;
  onVideoStop: () => Promise<void> | void;
  /** Auto-stop the video after this many ms. Default 60_000. */
  maxVideoMs?: number;
  /** Pixel size of the outer ring. Default 84. */
  size?: number;
  disabled?: boolean;
}

const DEFAULT_MAX_VIDEO_MS = 60_000;
const DEFAULT_SIZE = 84;

/**
 * Camera shutter button — Instagram-style tap interactions.
 *
 *  Photo mode: tap → onPhotoCapture()
 *  Video mode: tap to START recording; tap again to STOP. The hard ceiling
 *  at `maxVideoMs` auto-stops the recording.
 *
 * Why not press-and-hold for video any more: on Samsung gesture navigation,
 * holding the shutter sometimes never delivers a `pointerup` event because
 * Samsung's edge-swipe handler intercepts it. The user would start recording
 * and then have no way to stop it (the exact bug reported). Tap-to-toggle
 * is bulletproof.
 *
 * Recording UI is an animated SVG progress ring drawn with Framer Motion,
 * filling from 0 → 360° over `maxVideoMs`. Haptic feedback fires on every
 * state transition (start, stop, photo) — `@capacitor/haptics` is a no-op
 * on web so this is platform-safe.
 */
export default function ShutterButton({
  mode,
  isRecording,
  onPhotoCapture,
  onVideoStart,
  onVideoStop,
  maxVideoMs = DEFAULT_MAX_VIDEO_MS,
  size = DEFAULT_SIZE,
  disabled = false,
}: ShutterButtonProps) {
  // Track an in-flight tap so duplicate pointer events don't double-fire.
  const inFlightRef = useRef(false);
  const autoStopTimerRef = useRef<number | undefined>(undefined);
  const [recordingArmed, setRecordingArmed] = useState(false);

  useEffect(() => {
    setRecordingArmed(isRecording);
  }, [isRecording]);

  // Clear the auto-stop timer on unmount so it doesn't fire on a stale sheet.
  useEffect(() => {
    return () => {
      if (autoStopTimerRef.current !== undefined) {
        window.clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = undefined;
      }
    };
  }, []);

  const haptic = async (style: ImpactStyle) => {
    try {
      await Haptics.impact({ style });
    } catch {
      // Web / unsupported → ignore
    }
  };

  // Run the actual capture/start/stop action. Called from both onPointerUp
  // (the reliable path on Android WebView) AND onClick (fallback for when
  // pointer events get swallowed by Samsung's gesture-nav). Re-entry guarded
  // by `inFlightRef` so we never double-fire.
  const runAction = async () => {
    if (disabled || inFlightRef.current) return;
    inFlightRef.current = true;

    console.log("[ShutterButton] action fired, mode=", mode, "armed=", recordingArmed);
    try {
      if (mode === "photo") {
        haptic(ImpactStyle.Medium);
        await onPhotoCapture();
        return;
      }

      // Video mode: toggle start ↔ stop.
      if (recordingArmed) {
        // Stop the recording.
        if (autoStopTimerRef.current !== undefined) {
          window.clearTimeout(autoStopTimerRef.current);
          autoStopTimerRef.current = undefined;
        }
        haptic(ImpactStyle.Light);
        await onVideoStop();
      } else {
        // Start the recording.
        haptic(ImpactStyle.Heavy);
        await onVideoStart();
        // Hard ceiling — defensive auto-stop even if the parent forgets.
        if (autoStopTimerRef.current !== undefined) {
          window.clearTimeout(autoStopTimerRef.current);
        }
        autoStopTimerRef.current = window.setTimeout(async () => {
          autoStopTimerRef.current = undefined;
          try {
            haptic(ImpactStyle.Light);
            await onVideoStop();
          } catch (err) {
            console.warn("[ShutterButton] auto-stop failed", err);
          }
        }, maxVideoMs + 200);
      }
    } catch (err) {
      console.error("[ShutterButton] action failed", err);
    } finally {
      inFlightRef.current = false;
    }
  };

  // Stamp the latest pointer-fired time so onClick can ignore the synthetic
  // click that fires ~50–300 ms after pointerup on Android.
  const lastPointerUpRef = useRef(0);

  const handlePointerUp = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    // Only fire on the primary touch / left mouse.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    lastPointerUpRef.current = Date.now();
    await runAction();
  };

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    // Ignore synthetic click that fires shortly after our pointerup handler
    // already ran. Prevents the action from firing twice per tap.
    if (Date.now() - lastPointerUpRef.current < 500) return;
    e.preventDefault();
    await runAction();
  };

  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <button
      type="button"
      aria-label={
        mode === "photo"
          ? "Take photo"
          : recordingArmed
            ? "Stop recording"
            : "Start recording"
      }
      disabled={disabled}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      onContextMenu={(e) => e.preventDefault()}
      // touch-manipulation (NOT touch-none) — keeps the browser's click
      // synthesis working while disabling double-tap zoom. `touch-none`
      // breaks click delivery on Samsung WebView.
      className="relative flex items-center justify-center bg-transparent border-0 select-none touch-manipulation disabled:opacity-50 cursor-pointer"
      style={{ width: size, height: size }}
    >
      {/* Outer white ring */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full border-[3px] border-white/95"
        style={{ borderWidth: stroke }}
      />

      {/* Progress ring (only mounted while recording) */}
      {mode === "video" && recordingArmed && (
        <svg
          aria-hidden
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 -rotate-90"
        >
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#EF4444" /* red-500 */
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: maxVideoMs / 1000, ease: "linear" }}
          />
        </svg>
      )}

      {/* Inner dot — white solid in photo, red rounded-square while recording */}
      <motion.span
        aria-hidden
        layout
        animate={{
          backgroundColor: mode === "video" ? "#EF4444" : "#FFFFFF",
          borderRadius: recordingArmed ? 6 : 999,
          scale: recordingArmed ? 0.55 : 0.75,
        }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        style={{ width: size, height: size }}
        className="block"
      />
    </button>
  );
}
