// src/hooks/useReelView.ts
//
// Phase 2 view tracking — fires a single `reel_views` insert per (reel,user)
// after the user dwells on a reel for 1.5 s.
//
// Why we don't increment posts.view_count directly:
// A DB trigger on `reel_views` increments `posts.view_count` automatically.
// That trigger also enforces the once-per-user-per-reel rule via the table's
// UNIQUE (reel_id, user_id) constraint — so even if our client double-fires
// the insert, the count only goes up once. The hook is a soft optimization
// to avoid even sending the duplicate insert.
//
// Behaviour:
//   - On `isActive` going true: start a 1500 ms timer.
//   - When the timer fires: insert into `reel_views`. Swallow any error
//     (including the 23505 unique violation that's expected on revisits).
//   - On `isActive` going false (slide swiped away) or unmount: clear timer.
//   - `recordedRef` prevents firing twice on the same hook instance — for
//     example if a user pauses (`isActive` stays true) and re-renders, we
//     don't re-fire. Revisiting after unmount/remount IS allowed (the DB
//     unique constraint catches it).

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const DWELL_MS = 1500;

export const useReelView = (reelId: string, isActive: boolean) => {
  const { user } = useAuth();
  const timeoutRef = useRef<number | null>(null);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!isActive || !user) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    if (recordedRef.current) return;

    timeoutRef.current = window.setTimeout(async () => {
      timeoutRef.current = null;
      try {
        const { error } = await supabase
          .from("reel_views")
          .insert({ reel_id: reelId, user_id: user.id });
        // 23505 = unique_violation — the user already viewed this reel.
        // That's fine; the DB-side count is correct.
        if (error && error.code !== "23505") {
          console.warn("[useReelView] insert failed", error);
        }
        recordedRef.current = true;
      } catch (e) {
        console.warn("[useReelView] insert threw", e);
      }
    }, DWELL_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isActive, user, reelId]);
};
