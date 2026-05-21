// src/components/reels/ReelsFeed.tsx
//
// Vertical Reels carousel.
//
// Why embla vertical (ADR-004) — it's already in `package.json`, has a
// native `axis: 'y'` mode, handles inertial snapping cleanly, and emits
// the lifecycle events we need (`select`, `reInit`) without us having to
// reimplement pointer drag.
//
// 3-slide mount window — the critical performance gate (per `gotchas:G-?`
// and `acceptance_criteria.md`). 50 mounted `<video>` elements OOM Redmi
// 12; 3 mounted stays flat across 20+ slides. We render only the slides
// at indices `{ i-1, i, i+1 }`. The non-mounted slots render a placeholder
// `<div>` of the same height so embla's snap math remains correct.
//
// Prefetch trigger — when `activeIndex >= reels.length - 3`, we kick off
// `fetchNextPage()`. By the time the user has swiped 5 more slides the
// next page is in cache.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Link, useSearchParams } from "react-router-dom";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import Lottie from "lottie-react";
import LoaderAnimation from "@/components/ui/cbee_loding.json";
import DarkLoaderAnimation from "@/components/ui/dark_loader.json";
import { useTheme } from "next-themes";
import { useReels, type Reel } from "@/hooks/useReels";
import ReelSlide from "./ReelSlide";

const ReelsFeed = () => {
  const { theme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  // When the user taps a video on the home feed we navigate here with
  // `?startId=<postId>`. We use it once on first page load to snap embla
  // to that slide, then strip it from the URL so back-nav stays clean.
  const startId = searchParams.get("startId");
  const startIdConsumedRef = useRef(false);
  const {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useReels();

  // Flatten paginated reels once per render. `useMemo` keeps the ReelSlide
  // children referentially stable across re-renders so embla doesn't
  // re-mount slides on every state change.
  const reels: Reel[] = useMemo(
    () => (data?.pages ?? []).flat() as Reel[],
    [data],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: "y",
    loop: false,
    skipSnaps: false,
    containScroll: "trimSnaps",
    dragFree: false,
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState<Set<number>>(
    () => new Set([0, 1]),
  );

  // Keep a stable ref to the latest reels length / pagination flags so the
  // embla event handler closure doesn't need to be rebuilt on each fetch.
  const stateRef = useRef({
    length: 0,
    hasNextPage: false,
    isFetchingNextPage: false,
  });
  stateRef.current = {
    length: reels.length,
    hasNextPage,
    isFetchingNextPage,
  };

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const i = emblaApi.selectedScrollSnap();
    setActiveIndex(i);
    const { length, hasNextPage: hasNext, isFetchingNextPage: fetching } =
      stateRef.current;
    setMounted(
      new Set(
        [i - 1, i, i + 1].filter((n) => n >= 0 && n < length),
      ),
    );
    // Prefetch when the user is 3 from the end of what we currently hold.
    if (i >= length - 3 && hasNext && !fetching) {
      void fetchNextPage();
    }
  }, [emblaApi, fetchNextPage]);

  // If we got here via `/reels?startId=...`, snap to that reel as soon as
  // it's in the loaded set. We may need to fetchNextPage once or twice to
  // find it (page size 8, so usually it's on page 1). If we can't find it
  // after 3 page fetches, give up and play from the top.
  useEffect(() => {
    if (!emblaApi || !startId || startIdConsumedRef.current) return;
    const idx = reels.findIndex((r) => r.id === startId);
    if (idx >= 0) {
      // jump=true so the user doesn't see the carousel scroll past 8 slides.
      emblaApi.scrollTo(idx, true);
      startIdConsumedRef.current = true;
      // Clean up the URL so a back/forward doesn't re-jump.
      setSearchParams({}, { replace: true });
    } else if (hasNextPage && !isFetchingNextPage) {
      // Not in the loaded set yet — load the next page and re-check.
      void fetchNextPage();
    } else if (!hasNextPage) {
      // Exhausted pages without finding the id. Give up cleanly.
      startIdConsumedRef.current = true;
      setSearchParams({}, { replace: true });
    }
  }, [
    emblaApi,
    startId,
    reels,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    setSearchParams,
  ]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    // reInit fires when the slide count changes (new page lands). Without
    // it the mount window is computed against the stale length and the
    // newly-loaded slides stay unmounted.
    emblaApi.on("reInit", onSelect);
    // Initial sync so the mount window includes index 0/1 on mount.
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Loading state — first page in flight, no reels yet.
  if (isLoading && reels.length === 0) {
    return (
      <div className="fixed inset-0 z-20 bg-black flex items-center justify-center">
        <Lottie
          animationData={
            theme === "dark" ? DarkLoaderAnimation : LoaderAnimation
          }
          loop
          autoplay
          className="w-40 h-40"
        />
      </div>
    );
  }

  // Empty state — first page finished, zero reels in the system.
  if (!isLoading && reels.length === 0) {
    return (
      <div className="fixed inset-0 z-20 bg-black flex flex-col items-center justify-center px-6 text-center text-white">
        <DotLottieReact
          src="https://lottie.host/d646ef2a-ad32-42b8-92ab-98b8179af0d1/x6La597nfI.lottie"
          autoplay
          loop
          style={{ width: 220, height: 220 }}
        />
        <h2 className="text-xl font-semibold mb-2">No reels yet</h2>
        <p className="text-sm text-white/70 max-w-xs mb-6">
          Be the first to share a short pet clip. Tap the camera button on
          Home and shoot something.
        </p>
        <Link
          to="/upload"
          className="inline-flex items-center rounded-full bg-[#26A69A] px-6 py-3 text-sm font-medium text-white hover:bg-[#26A69A]/90"
        >
          Upload a reel
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-20 bg-black">
      <div className="embla h-full overflow-hidden" ref={emblaRef}>
        <div className="embla__container flex flex-col h-full touch-pan-y">
          {reels.map((reel, i) => (
            <div
              key={reel.id}
              className="embla__slide flex-[0_0_100%] h-full w-full relative bg-black"
            >
              {mounted.has(i) ? (
                <ReelSlide reel={reel} isActive={i === activeIndex} />
              ) : (
                // Placeholder for unmounted slides. The black background
                // matches and keeps embla's snap measurements correct.
                <div className="absolute inset-0 bg-black" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReelsFeed;
