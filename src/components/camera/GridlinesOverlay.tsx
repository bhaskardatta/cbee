import { useEffect, useState } from "react";

export type GridMode = "off" | "thirds" | "1:1" | "4:5" | "9:16";

interface GridlinesOverlayProps {
  mode: GridMode;
  className?: string;
}

/**
 * Composition gridlines overlay for the camera sheet.
 *
 *   off     → renders nothing
 *   thirds  → 3×3 rule-of-thirds grid spanning the entire viewport
 *   1:1     → centered 1:1 square with a 3×3 grid inside
 *   4:5     → centered 4:5 rectangle with a 3×3 grid inside (Instagram portrait)
 *   9:16    → centered 9:16 rectangle with a 3×3 grid inside (Stories / Reels)
 *
 * The component is pointer-events:none so taps pass through to the focus
 * gesture layer below. Lines have a 1px black drop-shadow so they remain
 * visible against any backdrop the camera might be pointing at.
 */
export default function GridlinesOverlay({ mode, className }: GridlinesOverlayProps) {
  // Resize-aware viewport tracking — needed because the inscribed frame for
  // 1:1 / 4:5 / 9:16 modes depends on the actual pixel size of the overlay.
  const [vw, setVw] = useState<number>(() => (typeof window === "undefined" ? 1080 : window.innerWidth));
  const [vh, setVh] = useState<number>(() => (typeof window === "undefined" ? 1920 : window.innerHeight));

  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  if (mode === "off") return null;

  /* ----------------------------- thirds (full-bleed) ----------------------------- */
  if (mode === "thirds") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={
          "absolute inset-0 w-full h-full pointer-events-none " + (className ?? "")
        }
        style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,0.8))" }}
      >
        <g stroke="white" strokeOpacity="0.6" strokeWidth="0.2">
          {/* horizontal */}
          <line x1="0" y1="33.333" x2="100" y2="33.333" />
          <line x1="0" y1="66.666" x2="100" y2="66.666" />
          {/* vertical */}
          <line x1="33.333" y1="0" x2="33.333" y2="100" />
          <line x1="66.666" y1="0" x2="66.666" y2="100" />
        </g>
      </svg>
    );
  }

  /* ------------------------ aspect-ratio framed (1:1 / 4:5 / 9:16) ------------------------ */
  const targetRatio =
    mode === "1:1" ? 1 :
    mode === "4:5" ? 4 / 5 :
    9 / 16; // 9:16

  // Inscribed rectangle: maximize the rect of given ratio that fits in (vw, vh).
  const viewportRatio = vw / vh;
  let frameW: number;
  let frameH: number;
  if (viewportRatio > targetRatio) {
    // Viewport is wider than target → frame is height-bounded
    frameH = vh;
    frameW = frameH * targetRatio;
  } else {
    // Viewport is narrower than target → frame is width-bounded
    frameW = vw;
    frameH = frameW / targetRatio;
  }

  const x = (vw - frameW) / 2;
  const y = (vh - frameH) / 2;
  const x2 = x + frameW;
  const y2 = y + frameH;
  // 1/3 split lines inside the frame
  const xa = x + frameW / 3;
  const xb = x + (frameW * 2) / 3;
  const ya = y + frameH / 3;
  const yb = y + (frameH * 2) / 3;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="none"
      className={
        "absolute inset-0 w-full h-full pointer-events-none " + (className ?? "")
      }
      style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,0.8))" }}
    >
      {/* Dim the area OUTSIDE the inscribed frame so the user clearly sees the crop. */}
      <defs>
        <mask id="frameMask">
          <rect x="0" y="0" width={vw} height={vh} fill="white" />
          <rect x={x} y={y} width={frameW} height={frameH} fill="black" />
        </mask>
      </defs>
      <rect x="0" y="0" width={vw} height={vh} fill="black" fillOpacity="0.35" mask="url(#frameMask)" />

      {/* Frame outline */}
      <rect
        x={x}
        y={y}
        width={frameW}
        height={frameH}
        fill="none"
        stroke="white"
        strokeOpacity="0.95"
        strokeWidth="1.5"
      />

      {/* Inner rule-of-thirds grid */}
      <g stroke="white" strokeOpacity="0.6" strokeWidth="1">
        <line x1={x} y1={ya} x2={x2} y2={ya} />
        <line x1={x} y1={yb} x2={x2} y2={yb} />
        <line x1={xa} y1={y} x2={xa} y2={y2} />
        <line x1={xb} y1={y} x2={xb} y2={y2} />
      </g>
    </svg>
  );
}

/**
 * Order the camera sheet's grid-mode toggle button cycles through.
 * Keep in sync with the `GridMode` union above.
 */
export const GRID_MODE_CYCLE: readonly GridMode[] = ["off", "thirds", "1:1", "4:5", "9:16"] as const;

/** Human label rendered inside the cycle button. */
export function labelForGridMode(mode: GridMode): string {
  switch (mode) {
    case "off": return "Grid";
    case "thirds": return "3 × 3";
    case "1:1": return "1:1";
    case "4:5": return "4:5";
    case "9:16": return "9:16";
  }
}
