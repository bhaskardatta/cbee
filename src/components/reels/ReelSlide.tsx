// src/components/reels/ReelSlide.tsx
//
// One reel = one native HTML5 `<video>` (per ADR-005). No video.js, no
// hls.js — R2 serves MP4 directly with `206 Partial Content` (verified
// 2026-05-21) so progressive playback and seeking work natively.
//
// Lifecycle:
//   - When `isActive` flips true and we're not user-paused → `.play()`.
//   - When `isActive` flips false → `.pause()` + `currentTime = 0`. We
//     fully reset on leave so a returning viewer starts from the top.
//   - The slide subscribes to `useNetwork()` to set `preload`:
//       wifi/ethernet → "metadata" (poster + first byte range)
//       cellular/unknown/none → "none" (tap-to-start; no auto-buffer)
//
// Gesture state machine — see plan-properly-and-do-temporal-lobster.md §5.
//
// Like state — local-only on this slide. We DO call `useLikePost` for the
// server-side write, but the cache it updates is `['posts']` (home feed),
// not `['reels']`. Mirroring the slide's own state is simpler than a
// cross-cache merge for Week 3.

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import Lottie from "lottie-react";
import Like_anime from "@/components/ui/heart_animation_like.json";
import { Volume2, VolumeX } from "lucide-react";
import { useNetwork } from "@/hooks/useNetwork";
import { useReelView } from "@/hooks/useReelView";
import { useLikePost } from "@/hooks/usePosts";
import type { Reel } from "@/hooks/useReels";
import ReelProgressBar from "./ReelProgressBar";
import ReelOverlay from "./ReelOverlay";

interface ReelSlideProps {
  reel: Reel;
  isActive: boolean;
}

const LONG_PRESS_MS = 250;
const TAP_WINDOW_MS = 280;
const MOVE_SLOP = 8; // px — anything beyond this is a swipe, let embla own it

const ReelSlide = ({ reel, isActive }: ReelSlideProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { connectionType } = useNetwork();
  const preload: "metadata" | "none" =
    connectionType === "wifi" ? "metadata" : "none";

  // Capacitor `file://` URLs need conversion for the WebView. All real
  // posts come from R2 (https://media.cbee.online/...) so this only
  // fires for in-dev previews.
  const videoSrc = reel.media_url?.startsWith("file://")
    ? Capacitor.convertFileSrc(reel.media_url)
    : reel.media_url || "";

  // -------- Playback state --------
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showMutePill, setShowMutePill] = useState(false);
  // We delay-clear `showMutePill` so the icon fades cleanly after a tap.
  const mutePillTimerRef = useRef<number | null>(null);

  // Reel-view tracking (1.5 s dwell). Hook handles the once-only logic.
  useReelView(reel.id, isActive);

  // -------- Like state (local) --------
  // PostCard.tsx:56-86 pattern: optimistic UI, server reconciliation,
  // revert on error. Phase 2 keeps this duplicated here because the
  // ['posts'] cache update doesn't reach the ['reels'] cache.
  const [isLiked, setIsLiked] = useState<boolean>(reel.is_liked);
  const [likesCount, setLikesCount] = useState<number>(reel.likes_count);
  const [playLikeAnim, setPlayLikeAnim] = useState(false);
  const likeAnimTimerRef = useRef<number | null>(null);
  const { mutate: likePost } = useLikePost();

  // Reset like state when the reel object changes (e.g., when the same
  // slide index gets a different reel after a prefetch).
  useEffect(() => {
    setIsLiked(reel.is_liked);
    setLikesCount(reel.likes_count);
  }, [reel.id, reel.is_liked, reel.likes_count]);

  // -------- Video play/pause effect --------
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      if (isPaused) {
        v.pause();
      } else {
        // play() returns a promise on Chrome; rejections (e.g. autoplay
        // policy violated by the user) are non-fatal — we'll just stay
        // paused until the user taps to unmute, which counts as a gesture.
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    } else {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {
        /* iOS Safari throws if metadata not loaded; ignore */
      }
    }
  }, [isActive, isPaused]);

  // -------- timeupdate → progress --------
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      const d = v.duration || 0;
      setProgress(d > 0 ? v.currentTime / d : 0);
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, []);

  // -------- Cleanup mute-pill / like-anim timers on unmount --------
  useEffect(() => {
    return () => {
      if (mutePillTimerRef.current) clearTimeout(mutePillTimerRef.current);
      if (likeAnimTimerRef.current) clearTimeout(likeAnimTimerRef.current);
    };
  }, []);

  // -------- Like handler (PostCard.handleLike pattern) --------
  const handleLike = useCallback(
    (forceLike = false) => {
      if (forceLike && isLiked) {
        // Double-tap on an already-liked reel still plays the heart pop
        // but doesn't toggle off. Instagram parity.
        setPlayLikeAnim(true);
        if (likeAnimTimerRef.current)
          clearTimeout(likeAnimTimerRef.current);
        likeAnimTimerRef.current = window.setTimeout(
          () => setPlayLikeAnim(false),
          1000,
        );
        return;
      }
      const willLike = !isLiked;
      setIsLiked(willLike);
      setLikesCount((c) => c + (willLike ? 1 : -1));
      if (willLike) {
        setPlayLikeAnim(true);
        if (navigator.vibrate) navigator.vibrate(150);
        if (likeAnimTimerRef.current)
          clearTimeout(likeAnimTimerRef.current);
        likeAnimTimerRef.current = window.setTimeout(
          () => setPlayLikeAnim(false),
          1000,
        );
      }
      likePost(
        { postId: reel.id, isLiked },
        {
          onSuccess: (data) => {
            setIsLiked(data.isLiked);
            setLikesCount(data.likes);
          },
          onError: () => {
            setIsLiked(!willLike);
            setLikesCount((c) => c + (willLike ? -1 : 1));
          },
        },
      );
    },
    [isLiked, likePost, reel.id],
  );

  // -------- Gesture state machine --------
  const pressTimerRef = useRef<number | null>(null);
  const tapTimerRef = useRef<number | null>(null);
  const longPressActiveRef = useRef(false);
  const downPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };
  const clearTapTimer = () => {
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
  };

  const flashMutePill = useCallback(() => {
    setShowMutePill(true);
    if (mutePillTimerRef.current) clearTimeout(mutePillTimerRef.current);
    mutePillTimerRef.current = window.setTimeout(
      () => setShowMutePill(false),
      600,
    );
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    downPosRef.current = { x: e.clientX, y: e.clientY };
    longPressActiveRef.current = false;
    clearPressTimer();
    pressTimerRef.current = window.setTimeout(() => {
      // Long-press fires → enter paused state until pointer-up.
      longPressActiveRef.current = true;
      setIsPaused(true);
      pressTimerRef.current = null;
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!downPosRef.current) return;
    const dx = e.clientX - downPosRef.current.x;
    const dy = e.clientY - downPosRef.current.y;
    if (Math.abs(dx) > MOVE_SLOP || Math.abs(dy) > MOVE_SLOP) {
      // The user is swiping. Cancel the long-press timer so we don't
      // suddenly pause mid-swipe. Embla owns the gesture from here.
      clearPressTimer();
      downPosRef.current = null;
    }
  };

  const handlePointerUp = () => {
    if (longPressActiveRef.current) {
      // We were in a long-press pause; release resumes playback.
      longPressActiveRef.current = false;
      setIsPaused(false);
      downPosRef.current = null;
      return;
    }
    if (!pressTimerRef.current && !downPosRef.current) {
      // Pointer was lifted after the swipe-slop kicked in; ignore.
      return;
    }
    clearPressTimer();
    downPosRef.current = null;

    // Tap. Disambiguate single vs double within TAP_WINDOW_MS.
    if (tapTimerRef.current) {
      // Second tap inside the window → double-tap.
      clearTapTimer();
      handleLike(/* forceLike */ true);
      return;
    }
    tapTimerRef.current = window.setTimeout(() => {
      // No second tap arrived; treat as single tap → mute toggle.
      tapTimerRef.current = null;
      setIsMuted((m) => !m);
      flashMutePill();
    }, TAP_WINDOW_MS);
  };

  const handlePointerCancel = () => {
    clearPressTimer();
    clearTapTimer();
    downPosRef.current = null;
    if (longPressActiveRef.current) {
      longPressActiveRef.current = false;
      setIsPaused(false);
    }
  };

  // -------- Comments drawer pause coupling --------
  // ReelOverlay tells us when the drawer opens/closes so we can pause.
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (drawerOpen) setIsPaused(true);
    else if (longPressActiveRef.current === false) setIsPaused(false);
  }, [drawerOpen]);

  return (
    <div
      className="absolute inset-0 bg-black overflow-hidden touch-pan-y"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        poster={reel.thumbnail_url ?? undefined}
        muted={isMuted}
        autoPlay
        playsInline
        loop
        preload={preload}
        // disableRemotePlayback hides AirPlay/Chromecast affordances and
        // (more importantly) tells Chrome WebView this is a UI-managed
        // player so it stops drawing the giant native play-overlay when
        // a slide is mounted but not yet playing.
        disableRemotePlayback
        controls={false}
        className="absolute inset-0 w-full h-full object-cover bg-black pointer-events-none"
      />

      <ReelProgressBar progress={progress} />

      {/* Heart-pop animation on double-tap (or like button tap) */}
      {playLikeAnim && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="w-48 h-48 sm:w-56 sm:h-56">
            <Lottie
              animationData={Like_anime}
              loop={false}
              autoplay
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* Mute pill — fades in on tap, fades out 600ms later */}
      <div
        className={`absolute top-6 right-4 z-20 transition-opacity duration-300 ${
          showMutePill ? "opacity-100" : "opacity-0"
        }`}
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 24px)" }}
      >
        <div className="bg-black/50 backdrop-blur-sm rounded-full p-2">
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-white" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </div>
      </div>

      {/* Pause indicator during long-press */}
      {isPaused && !drawerOpen && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 backdrop-blur-sm rounded-full p-5">
            <svg
              className="w-12 h-12 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </div>
        </div>
      )}

      <ReelOverlay
        reel={reel}
        isLiked={isLiked}
        likesCount={likesCount}
        onLikeClick={() => handleLike(false)}
        onDrawerOpenChange={setDrawerOpen}
        drawerOpen={drawerOpen}
      />
    </div>
  );
};

export default ReelSlide;
