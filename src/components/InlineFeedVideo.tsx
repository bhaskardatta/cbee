// src/components/InlineFeedVideo.tsx
//
// Instagram-style inline video for the home feed card. Muted, autoplay,
// loop, playsInline; auto-plays when scrolled into view, auto-pauses
// when off-screen. Tap → navigate to `/reels?startId=<postId>` so the
// full immersive Reels view opens at that exact post.
//
// We deliberately do NOT show the native HTML5 controls — they conflict
// with the card layout and double-tap-to-like. Single tap = open reel,
// double tap = like (handled by parent PostCard's onDoubleClick).

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Volume2, VolumeX } from "lucide-react";

interface InlineFeedVideoProps {
  postId: string;
  src: string;
  posterUrl?: string | null;
  onDoubleClick?: () => void;
}

const InlineFeedVideo = ({
  postId,
  src,
  posterUrl,
  onDoubleClick,
}: InlineFeedVideoProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  // Track visibility so we play only when scrolled in view (saves
  // battery + bandwidth + keeps the feed scrolling smooth).
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Require >50% on-screen before counting as "active" — keeps the
          // top + bottom of the screen quiet and only plays the card
          // the user is actually looking at.
          setIsVisible(entry.intersectionRatio > 0.5);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isVisible) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      v.pause();
    }
  }, [isVisible]);

  // Tap once = open the reel in the immersive feed. We use pointerup so
  // the tap doesn't fight with the card-level double-click handler (the
  // double-click event will fire BEFORE our pointerup if a second tap
  // arrives — onDoubleClick wins the race because we delay-navigate).
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    // If a parent had focus or the tap was on the mute toggle, bail.
    if ((e.target as HTMLElement).closest("[data-mute-toggle]")) return;
    navigate(`/reels?startId=${postId}`);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-lg overflow-hidden"
      onClick={handleTap}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={posterUrl ?? undefined}
        muted={isMuted}
        autoPlay
        playsInline
        loop
        preload="metadata"
        disableRemotePlayback
        controls={false}
        className="w-full h-auto object-contain max-h-96 pointer-events-none"
      />
      {/* Mute toggle — small chip in the corner, not the giant native overlay */}
      <button
        type="button"
        data-mute-toggle
        aria-label={isMuted ? "Unmute" : "Mute"}
        onClick={(e) => {
          e.stopPropagation();
          setIsMuted((m) => !m);
        }}
        className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm rounded-full p-2"
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4 text-white" />
        ) : (
          <Volume2 className="w-4 h-4 text-white" />
        )}
      </button>
    </div>
  );
};

export default InlineFeedVideo;
