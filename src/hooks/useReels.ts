// src/hooks/useReels.ts
//
// Phase 2, Week 3 — vertical Reels feed data layer.
//
// `useInfiniteQuery` with KEYSET cursor on `(created_at, id)` instead of OFFSET.
// At any meaningful scale (100k+ posts) offset pagination scans every row up
// to the offset on every page fetch — keyset only scans `limit` rows per call.
// See ADR-006 in `docs/03_DECISIONS.md`.
//
// Page size 8 — small enough that the very first page renders in <300 ms on
// 4G, big enough that a user has to scroll past ~3 reels before the next
// page lands (which is the prefetch trigger in `ReelsFeed`).
//
// Filter: `media_kind = 'video'` and `duration_seconds <= 60`. The data model
// also defines `'reel'` as a valid `media_kind` but the upload flow currently
// stores videos under `'video'`; if we ever start writing `'reel'` we'll add
// it to the filter then.
//
// Caveat — sort order: `is_featured DESC, created_at DESC, id DESC`. A
// keyset on `(created_at, id)` is not strictly stable across `is_featured`
// boundaries: if a featured row is older than a non-featured row, both end
// up on the same boundary. In practice featured posts are a handful pinned
// in Studio so they all land on page 1. Acceptable Phase 2 trade-off.

import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

export type Reel = Tables<"posts"> & {
  profiles: Pick<
    Tables<"profiles">,
    "username" | "full_name" | "avatar_url"
  > | null;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
};

export interface ReelsCursor {
  created_at: string;
  id: string;
}

export const REELS_PAGE_SIZE = 8;

const fetchReelsPage = async (
  cursor: ReelsCursor | undefined,
): Promise<Reel[]> => {
  // Cache the current user once per page fetch (one extra getSession is
  // cheaper than letting it fail later when we hydrate `is_liked`).
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user?.id;

  let q = supabase
    .from("posts")
    .select("*")
    .eq("media_kind", "video")
    .lte("duration_seconds", 60)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(REELS_PAGE_SIZE);

  // Keyset: descending order, so "next page" = rows strictly older than the
  // last row we returned, with `id` as the deterministic tiebreaker when
  // two posts share the same `created_at` (rare but possible in burst inserts).
  if (cursor) {
    q = q.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    );
  }

  const { data: posts, error } = await q;
  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  // Batch the profile + likes lookups in parallel — mirrors usePosts.ts so
  // the network shape is identical. Two round-trips total per page.
  const userIds = Array.from(new Set(posts.map((p) => p.user_id)));
  const postIds = posts.map((p) => p.id);

  const [profilesRes, likesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", userIds),
    userId
      ? supabase
          .from("likes")
          .select("post_id")
          .eq("user_id", userId)
          .in("post_id", postIds)
      : Promise.resolve({ data: [] as { post_id: string }[], error: null }),
  ]);

  const profileMap = new Map(
    (profilesRes.data || []).map((p) => [p.id, p]),
  );
  const likedSet = new Set(
    (likesRes.data || []).map((l) => l.post_id),
  );

  return posts.map((post) => {
    const profile = profileMap.get(post.user_id) || null;
    const displayName =
      profile?.full_name?.trim() || profile?.username?.trim() || null;
    return {
      ...post,
      likes_count: post.likes_count || 0,
      comments_count: post.comments_count || 0,
      is_liked: likedSet.has(post.id),
      profiles: profile
        ? {
            username: displayName || profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          }
        : null,
    };
  }) as Reel[];
};

export const useReels = () => {
  return useInfiniteQuery({
    queryKey: ["reels"],
    queryFn: ({ pageParam }) =>
      fetchReelsPage(pageParam as ReelsCursor | undefined),
    initialPageParam: undefined as ReelsCursor | undefined,
    getNextPageParam: (lastPage) => {
      // Terminal condition — partial page means we hit the tail.
      if (lastPage.length < REELS_PAGE_SIZE) return undefined;
      const last = lastPage[lastPage.length - 1];
      return { created_at: last.created_at, id: last.id } as ReelsCursor;
    },
    // 5 min stale matches App.tsx's QueryClient default — reels are an
    // append-only stream; we don't need to refetch aggressively.
    staleTime: 5 * 60 * 1000,
  });
};
