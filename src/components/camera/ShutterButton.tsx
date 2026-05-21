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
 * Camera shutter button.
 *
 *  Photo mode: tap → onPhotoCapture()
 *  Video mode: press-and-hold → onVideoStart(); release or hit maxVideoMs → onVideoStop()
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
  // Local "progress armed" flag — set when recording starts so the ring
  // animation only mounts during a real recording, not on stale prop flips.
  const [recordingArmed, setRecordingArmed] = useState(false);

  useEffect(() => {
    setRecordingArmed(isRecording);
    return () => {
      if (autoStopTimerRef.current !== undefined) {
        window.clearTimeout(autoStopTimerRef.current);
      }
    };
  }, [isRecording]);

  const haptic = async (style: ImpactStyle) => {
    try {
      await Haptics.impact({ style });
    } catch {
      // Web / unsupported → ignore
    }
  };

  const handlePointerDown = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || inFlightRef.current) return;
    // Mouse: only respond to left click
    if (e.pointerType === "mouse" && e.button !== 0) return;
    inFlightRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);

    if (mode === "photo") {
      try {
        haptic(ImpactStyle.Medium);
        await onPhotoCapture();
      } finally {
        inFlightRef.current = false;
      }
      return;
    }

    // Video mode: start recording
    try {
      haptic(ImpactStyle.Heavy);
      await onVideoStart();
      // Hard ceiling — defensive auto-stop even if the parent forgets.
      autoStopTimerRef.current = window.setTimeout(async () => {
        if (inFlightRef.current) {
          haptic(ImpactStyle.Light);
          try {
            await onVideoStop();
          } finally {
            inFlightRef.current = false;
          }
        }
      }, maxVideoMs + 200);
    } catch {
      inFlightRef.current = false;
    }
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLButtonElement>) => {
    if (mode !== "video" || !inFlightRef.current) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    if (autoStopTimerRef.current !== undefined) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = undefined;
    }
    try {
      haptic(ImpactStyle.Light);
      await onVideoStop();
    } finally {
      inFlightRef.current = false;
    }
  };

  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <button
      type="button"
      aria-label={mode === "photo" ? "Take photo" : recordingArmed ? "Stop recording" : "Start recording"}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      className="relative flex items-center justify-center bg-transparent border-0 select-none touch-none disabled:opacity-50"
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

      {/* Inner dot — white solid in photo, red rounded-square in recording, red dot in video idle */}
      <motion.span
        aria-hidden
        layout
        animate={{
          backgroundColor:
            mode === "video"
              ? recordingArmed
                ? "#EF4444"
                : "#EF4444"
              : "#FFFFFF",
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
