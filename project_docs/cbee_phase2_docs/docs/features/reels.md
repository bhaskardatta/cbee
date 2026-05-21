# Feature: Reels Feed

**Goal:** A vertical-swipe, full-screen video feed at `/reels`. Pet videos auto-play with sound muted, double-tap likes, long-press pauses, swipe-up advances. Powered by `embla-carousel-react` (already in the codebase) in vertical mode.

**Estimated effort:** 5 days (Day 11–15, Week 3 of the sprint).

---

## What ships

| Capability                                          | Status        |
| --------------------------------------------------- | ------------- |
| Vertical full-screen swipe between reels            | ✓ in Phase 2  |
| Auto-play on snap, auto-pause on leave              | ✓ in Phase 2  |
| Muted by default, tap-to-unmute                     | ✓ in Phase 2  |
| Long-press to pause / release to resume             | ✓ in Phase 2  |
| Double-tap to like                                  | ✓ in Phase 2  |
| Tap to open comments drawer                         | ✓ in Phase 2  |
| Owner avatar + caption overlay                      | ✓ in Phase 2  |
| Share button (Capacitor Share plugin or web Share)  | ✓ in Phase 2  |
| Report button (three-dot menu)                      | ✓ in Phase 2 (via moderation_mvp) |
| View count (denormalized, trigger-maintained)       | ✓ in Phase 2  |
| Network-aware preload (off on cellular)             | ✓ in Phase 2  |
| Infinite scroll via cursor pagination               | ✓ in Phase 2  |
| Pull-to-refresh                                     | ✗ Phase 3+ (low value for this UX) |
| Save/bookmark reels                                 | ✗ Phase 3+    |
| Sound-on swiping                                    | ✗ Phase 3+    |
| Music attribution                                   | ✗ Phase 3+    |
| Skip-to-end / scrub                                 | ✗ Phase 3+    |

---

## New / changed files

| File                                                | Action  | Lines (est) |
| --------------------------------------------------- | ------- | ----------- |
| `src/pages/ReelsPage.tsx`                           | NEW     | ~110        |
| `src/components/reels/ReelsFeed.tsx`                | NEW     | ~180        |
| `src/components/reels/ReelSlide.tsx`                | NEW     | ~220        |
| `src/components/reels/ReelOverlay.tsx`              | NEW     | ~140        |
| `src/components/reels/ReelProgressBar.tsx`          | NEW     | ~50         |
| `src/components/reels/ReportButton.tsx`             | NEW (shared with moderation_mvp) | ~60 |
| `src/hooks/useReels.ts`                             | NEW     | ~80         |
| `src/hooks/useReelView.ts`                          | NEW     | ~50         |
| `src/App.tsx`                                       | EDIT    | +3 lines (route)        |
| `src/components/Layout.tsx`                         | EDIT    | (covered in `bottom_nav.md`) |

---

## Route wiring (`src/App.tsx`)

Add the route alongside the other lazy-loaded ones:

```tsx
const ReelsPage = lazy(() => import("./pages/ReelsPage"));

// inside the Routes block (under ProtectedRoute, since we want auth):
<Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
  …
  <Route path="/reels" element={<ReelsPage />} />
</Route>
```

Deep link from a post share URL `app.cbee.in://post/<id>` should still hit `PostDetailPage` — Reels is a feed view, not a single-post view. Future: `/reels/<id>` for deep-linking to a specific reel and seeding the cursor. Phase 3.

---

## `useReels.ts` — the pagination hook

Use `useInfiniteQuery`. Cursor = `{ created_at, id }` of the last returned row. Page size 8.

```ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Reel = Tables<'posts'> & {
  profile: Pick<Tables<'profiles'>, 'username' | 'avatar_url' | 'full_name'>;
  like_count: number;
  comment_count: number;
};

interface Cursor {
  created_at: string;
  id: string;
}

const PAGE_SIZE = 8;

async function fetchReelsPage({ pageParam }: { pageParam: Cursor | undefined }) {
  let q = supabase
    .from('posts')
    .select(`
      *,
      profile:profiles!user_id(username, avatar_url, full_name),
      likes(count),
      comments(count)
    `)
    .eq('media_kind', 'video')   // include 'reel' once we differentiate
    .lte('duration_seconds', 60)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);

  if (pageParam) {
    q = q.or(
      `created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`
    );
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Reel[];
}

export function useReels() {
  return useInfiniteQuery({
    queryKey: ['reels'],
    queryFn: fetchReelsPage,
    initialPageParam: undefined as Cursor | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined;   // end of feed
      const last = lastPage[lastPage.length - 1];
      return { created_at: last.created_at, id: last.id };
    },
    staleTime: 5 * 60 * 1000,   // 5 min, matches global cache config
  });
}
```

**Note:** The `.or(...)` with `and(...)` is the keyset pagination dance for `(created_at, id)` tuples. It says: "rows where created_at < cursor OR (created_at = cursor AND id < cursor)". This handles ties on created_at correctly.

---

## `useReelView.ts` — view tracking

Insert one row into `reel_views` per (user, reel) the first time the user dwells on the reel for ≥1.5 seconds. The trigger on `reel_views` bumps `posts.view_count` automatically.

```ts
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const DWELL_MS = 1500;

export function useReelView(reelId: string, isActive: boolean) {
  const { user } = useAuth();
  const recordedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user || !isActive || recordedRef.current) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    timeoutRef.current = window.setTimeout(async () => {
      if (recordedRef.current) return;
      recordedRef.current = true;

      // Fire-and-forget. If user has already viewed (unique constraint),
      // the insert errors but it's harmless.
      await supabase
        .from('reel_views')
        .insert({ reel_id: reelId, user_id: user.id })
        .then(() => {}, () => {});
    }, DWELL_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [user, reelId, isActive]);
}
```

The unique constraint `(reel_id, user_id)` in the schema means duplicates are a no-op. `recordedRef` is a local optimization — avoids the round-trip on every re-snap.

---

## `ReelsFeed.tsx` — the embla container

Owns the embla instance, the visible-window-of-mounted-slides state, and the active-index state.

```tsx
import useEmblaCarousel from 'embla-carousel-react';
import { useReels } from '@/hooks/useReels';
import ReelSlide from '@/components/reels/ReelSlide';

export default function ReelsFeed() {
  const { data, fetchNextPage, hasNextPage } = useReels();
  const allReels = data?.pages.flat() ?? [];

  const [emblaRef, emblaApi] = useEmblaCarousel({
    axis: 'y',
    loop: false,
    skipSnaps: false,
    containScroll: 'trimSnaps',
    dragFree: false,
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [mountedIndices, setMountedIndices] = useState(new Set([0, 1]));

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const i = emblaApi.selectedScrollSnap();
      setActiveIndex(i);
      setMountedIndices(new Set([i - 1, i, i + 1].filter(n => n >= 0 && n < allReels.length)));

      // Prefetch next page when within 3 of the end
      if (i >= allReels.length - 3 && hasNextPage) {
        fetchNextPage();
      }
    };
    emblaApi.on('select', onSelect);
    onSelect();
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, allReels.length, hasNextPage, fetchNextPage]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="h-full flex flex-col touch-pan-y">
          {allReels.map((reel, i) => (
            <div
              key={reel.id}
              className="flex-[0_0_100%] h-screen w-screen relative"
            >
              {mountedIndices.has(i) ? (
                <ReelSlide reel={reel} isActive={i === activeIndex} />
              ) : (
                <div className="absolute inset-0 bg-black" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Why the mount window?** Each `<video>` element holds a decoder, a buffer, and (when playing) a render layer. Mounting 50 reels = 50 video decoders = guaranteed OOM on Redmi 12. Three mounted at a time (prev/current/next) keeps memory flat regardless of how far the user scrolls.

---

## `ReelSlide.tsx` — one slide

Renders the `<video>`, listens to `isActive`, owns play/pause, exposes tap/double-tap/long-press gestures.

Key behaviors:

- On mount with `isActive=true`: load video, attempt autoplay (muted) once `canplay` fires.
- On `isActive` flipping false: pause, optionally seek to 0.
- Tap (no double-tap): toggle mute (default muted on first paint).
- Double-tap (`<300ms`): like / unlike with heart pop animation (reuse `HeartAnimation.tsx`).
- Long-press (`>250ms`): pause for as long as the press is held; release resumes.
- Single-tap on caption overlay: open comments drawer.

```tsx
import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { useReelView } from '@/hooks/useReelView';
import HeartAnimation from '@/components/HeartAnimation';
import ReelOverlay from './ReelOverlay';
import ReelProgressBar from './ReelProgressBar';
import type { Reel } from '@/hooks/useReels';

interface ReelSlideProps {
  reel: Reel;
  isActive: boolean;
}

export default function ReelSlide({ reel, isActive }: ReelSlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [progress, setProgress] = useState(0);
  const [networkType, setNetworkType] = useState<string>('wifi');

  // Track view
  useReelView(reel.id, isActive);

  // Determine preload strategy based on network
  useEffect(() => {
    Network.getStatus().then(s => setNetworkType(s.connectionType));
    const sub = Network.addListener('networkStatusChange', s => setNetworkType(s.connectionType));
    return () => { sub.then(s => s.remove()); };
  }, []);

  const preloadStrategy = networkType === 'wifi' ? 'metadata' : 'none';

  // Play/pause based on isActive
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && !isPaused) {
      const playPromise = v.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    } else {
      v.pause();
      if (!isActive) v.currentTime = 0;
    }
  }, [isActive, isPaused]);

  // Progress
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTimeUpdate = () => setProgress(v.currentTime / (v.duration || 1));
    v.addEventListener('timeupdate', onTimeUpdate);
    return () => v.removeEventListener('timeupdate', onTimeUpdate);
  }, []);

  // Gestures
  const tapTimeout = useRef<number | null>(null);
  const pressTimer = useRef<number | null>(null);

  const handlePointerDown = () => {
    pressTimer.current = window.setTimeout(() => {
      setIsPaused(true);
      pressTimer.current = null;
    }, 250);
  };

  const handlePointerUp = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
      // It was a tap, not a long-press. Disambiguate single vs double tap.
      if (tapTimeout.current) {
        clearTimeout(tapTimeout.current);
        tapTimeout.current = null;
        handleDoubleTap();
      } else {
        tapTimeout.current = window.setTimeout(() => {
          tapTimeout.current = null;
          handleSingleTap();
        }, 280);
      }
    } else {
      // Long-press was active; release pauses end
      setIsPaused(false);
    }
  };

  const handleSingleTap = () => setIsMuted((m) => !m);
  const handleDoubleTap = () => {
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
    // TODO: optimistic like via mutation (see usePostLike pattern)
  };

  // Convert the URL through Capacitor if needed (G-1 in GOTCHAS)
  const videoSrc = reel.media_url.startsWith('file://')
    ? Capacitor.convertFileSrc(reel.media_url)
    : reel.media_url;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
        setIsPaused(false);
      }}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        poster={reel.thumbnail_url ?? undefined}
        playsInline
        muted={isMuted}
        loop
        preload={preloadStrategy}
        className="w-full h-full object-contain"
      />

      <ReelProgressBar progress={progress} />
      <ReelOverlay reel={reel} isMuted={isMuted} />

      {showHeart && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <HeartAnimation />
        </div>
      )}

      {isPaused && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="bg-black/40 rounded-full p-4">
            <PauseIcon className="w-12 h-12 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## `ReelOverlay.tsx` — caption + actions

Right rail (vertical stack): like, comment, share, three-dot-menu (Report). Bottom: owner avatar + username + caption.

```
┌───────────────────────────────────┐
│                                   │
│                                   │
│                                   │
│                                   │  ←  video fills the screen behind
│                                   │
│                                   │                     ┌──────┐
│                                   │                     │ 🤍   │  ← like
│                                   │                     │ 1.2k │
│                                   │                     │      │
│                                   │                     │ 💬   │  ← comments
│                                   │                     │ 84   │
│                                   │                     │      │
│                                   │                     │ ↗    │  ← share
│                                   │                     │      │
│                                   │                     │ ⋯    │  ← more (Report)
│                                   │                     └──────┘
│ ●avatar  @swaroop                 │
│ My pet learning to fetch! #cbee 🐶 │
└───────────────────────────────────┘
```

Make the right rail icons ~32px, white with subtle drop-shadow for contrast against any frame. Tap targets ≥44px.

---

## `ReelProgressBar.tsx` — scrub indicator at top of slide

Thin (2-3px) bar pinned to top under the status bar. Width = `progress * 100%`. Tailwind:

```tsx
<div className="absolute top-0 left-0 right-0 h-0.5 bg-white/20 z-10">
  <div
    className="h-full bg-white transition-[width] duration-100 ease-linear"
    style={{ width: `${progress * 100}%` }}
  />
</div>
```

For Phase 2, the bar is read-only (no scrub-to-seek). Tap-to-seek is Phase 3+.

---

## Performance details that matter

- **`<video preload="metadata">` on WiFi**, `preload="none"` on cellular. This is the single biggest knob for first-play latency.
- **Hardware decoding:** the browser does this for you on `<video>`. No knob to flip; it just works on modern Android/iOS.
- **`object-fit: contain` over `object-fit: cover`** — preserves the creator's framing. For a 9:16 video on a 9:19 phone, we get pillarbox bars top/bottom — acceptable. For a 1:1 video on a 9:19 phone, we get larger bars. Letterboxing is preferable to cropping the subject (the pet).
- **No GIF placeholders.** Skip the gradient-shimmer "loading" pattern — it conflicts with the immersive black background. Just black while loading, then fade in.
- **Don't `seek(0)` on snap-out.** Pausing + leaving `currentTime` alone means the next time the user swipes back, the video resumes mid-play (Instagram does this). Reset only on full unmount.

---

## Edge cases

| Case                                              | Behavior                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| No reels exist yet (empty feed)                   | Empty state with Lottie animation + "Be the first to post a reel" CTA → links to `/upload`. |
| Reel video URL 404s                               | `onError` handler: skip to next reel, log error, show fleeting "Couldn't load" toast.  |
| User is offline                                   | OfflineDetector renders banner (existing component); video shows poster only.   |
| Reel was deleted while user was looking at it     | Detect via realtime delete event or 404. Auto-advance to next. |
| Comments drawer opens while video playing         | Pause video. Resume on drawer close.                              |
| User receives push notification mid-scroll        | App backgrounded → onPause event → pause video. Foregrounded → resume isActive reel. |
| Phone call interrupts                             | iOS pauses for us. Resume on call end.                          |
| Slow connection: video buffers forever            | After 5s of buffering, show "tap to retry" button.              |

---

## Acceptance criteria (DoD)

- [ ] `/reels` route loads without errors.
- [ ] On Pixel 7 WiFi: first reel starts playing within 1.5s of route load.
- [ ] On Pixel 7 4G: tap-to-start affordance is visible; first reel starts within 2s of tap.
- [ ] Vertical swipe between reels snaps cleanly; no inertial overshoot past one slide.
- [ ] Active reel auto-plays; prev/next reels are paused.
- [ ] Tap toggles mute. State persists across snaps.
- [ ] Double-tap fires the heart pop animation AND optimistically inserts a like.
- [ ] Long-press pauses; release resumes.
- [ ] Scrolling through 20 reels on Redmi 12 doesn't crash; memory stays flat (verified via Android Studio Profiler).
- [ ] `reel_views` table gets one row per (user, reel) on ≥1.5s dwell.
- [ ] `posts.view_count` increments correctly via trigger.
- [ ] Reaching the bottom of a page triggers `fetchNextPage` (verified via Network tab).
- [ ] When `is_featured = true` on a post in Supabase Studio, that post appears at top of `/reels` for all users.
- [ ] Empty feed shows the empty-state Lottie + CTA.

---

**Next:** `docs/features/upload_flow.md` for the small upload refactor, or `docs/features/bottom_nav.md` for the navigation reshuffle.
