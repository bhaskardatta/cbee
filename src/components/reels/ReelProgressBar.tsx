// src/components/reels/ReelProgressBar.tsx
//
// Top-of-slide progress bar. Pure presentation, CSS-only transition —
// avoids the framer-motion runtime cost on a per-frame `timeupdate`
// re-render (~30 Hz). 100 ms ease-linear matches the average gap
// between `timeupdate` events on Chrome / WebKit so the bar looks
// smooth instead of stepping.

interface ReelProgressBarProps {
  progress: number; // 0–1
}

const ReelProgressBar = ({ progress }: ReelProgressBarProps) => {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <div
      className="absolute left-0 right-0 z-10 h-0.5 bg-white/20"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0px)" }}
    >
      <div
        className="h-full bg-white transition-[width] duration-100 ease-linear"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

export default ReelProgressBar;
