// src/pages/ReelsPage.tsx
//
// Week-3 immersive Reels feed. The page is intentionally a thin wrapper —
// everything lives in `ReelsFeed`. We do NOT use `AppHeader` or `Layout`
// here because the feed is full-bleed; the bottom navbar is rendered by
// `AppLayout` at z-30 and overlays the feed (which sits at z-20).
import ReelsFeed from "@/components/reels/ReelsFeed";

const ReelsPage = () => {
  return <ReelsFeed />;
};

export default ReelsPage;
