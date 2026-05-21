# Acceptance Criteria

**The full definition of done for Phase 2.** This is the contract — what we promised, what we'll demo at handoff, what gets verified before invoicing the final 30%.

Each feature has its own DoD inside its feature spec. This doc is the master checklist Bhaskar walks through end of Week 4, before requesting the final payment.

---

## Performance scope qualifications

Before listing criteria, the envelope:

- **Network qualified.** "<1.5s video start" = WiFi. Cellular falls back to `preload="none"` and tap-to-start; no time promise on cellular.
- **Device qualified.** "60 fps" = mid-range Android (Pixel 7, Samsung A55) on a modern build of Android. "No jank > 200ms" = low-end Android (Redmi 12, 4GB RAM). iPhone 12-and-later inherits the mid-range expectations.
- **Empty-state qualified.** Performance criteria assume at least 8 reels exist in the database. Empty-feed performance is just "the empty state renders fast."

See `docs/03_DECISIONS.md` ADR-013 for why.

---

## Feature 1: Native In-App Camera

| Criterion                                                          | Where verified | Status  |
| ------------------------------------------------------------------ | -------------- | ------- |
| Camera preview opens full-screen on Android emulator              | Manual         | [ ]     |
| Camera preview opens full-screen on Pixel 7 real device           | Manual         | [ ]     |
| Camera preview opens full-screen on Samsung A55 real device       | Manual         | [ ]     |
| Camera preview opens full-screen on Redmi 12 real device          | Manual         | [ ]     |
| Camera preview opens full-screen on iPhone real device            | Manual         | [ ]     |
| Open → preview ready in <800ms on Pixel 7 (cold)                  | Stopwatch / video record | [ ]   |
| Gridlines toggle cycles: off → 3x3 → 1:1 → 4:5 → 9:16 → off       | Manual         | [ ]     |
| Front/back camera flip works                                       | Manual         | [ ]     |
| Flash mode cycles auto/on/off and visibly affects output           | Manual         | [ ]     |
| Tap-to-focus shows reticle and sharpens the tapped point          | Manual         | [ ]     |
| Pinch-to-zoom smoothly transitions zoom level                      | Manual         | [ ]     |
| Photo capture writes a JPEG, returns a File to the upload page    | Manual + DB    | [ ]     |
| Video capture (10s) writes an MP4, returns File + duration         | Manual + DB    | [ ]     |
| Video record stops automatically at 60s                            | Manual         | [ ]     |
| Video record audio is captured correctly (audio plays back)        | Manual         | [ ]     |
| Camera permission denied → toast with "Open Settings" deep-link    | Manual (denied state) | [ ] |
| Gallery import of >60s video → rejected with clear message        | Manual         | [ ]     |
| Gallery import of <60s video → correctly detects aspect ratio     | Manual + DB    | [ ]     |
| iOS audio session collision fixed (record after Reels page visit)  | Manual         | [ ]     |

---

## Feature 2: Reels Feed

| Criterion                                                          | Where verified | Status  |
| ------------------------------------------------------------------ | -------------- | ------- |
| `/reels` route loads without console errors                       | Manual         | [ ]     |
| First reel auto-plays muted within 1.5s of route load (Pixel 7 WiFi) | Manual + video | [ ] |
| Cellular: first reel shows poster + tap-to-start; starts within 2s of tap | Manual on cellular | [ ] |
| Vertical swipe snaps to next reel (no overshoot past one slide)   | Manual         | [ ]     |
| Snap forward: previous reel pauses; next reel auto-plays           | Manual         | [ ]     |
| Snap backward: forward reel pauses; new active reel resumes        | Manual         | [ ]     |
| Single tap toggles mute                                            | Manual         | [ ]     |
| Mute state persists across snaps                                   | Manual         | [ ]     |
| Long-press pauses; release resumes                                 | Manual         | [ ]     |
| Double-tap fires heart pop + optimistically inserts a like        | Manual + DB    | [ ]     |
| Reaching 5 reels from end triggers `fetchNextPage`                | Network tab    | [ ]     |
| `reel_views` table gets 1 row per (user, reel) on ≥1.5s dwell      | DB             | [ ]     |
| `posts.view_count` increments correctly via trigger                | DB             | [ ]     |
| `is_featured = true` post appears at the top of `/reels`           | DB + manual    | [ ]     |
| Empty feed shows Lottie + CTA → links to `/upload`                 | Manual         | [ ]     |
| 60fps confirmed on Pixel 7 with Chrome DevTools FPS meter          | DevTools       | [ ]     |
| 60fps confirmed on Samsung A55                                     | DevTools       | [ ]     |
| No jank > 200ms on Redmi 12                                         | Manual feel    | [ ]     |
| Scrolling through 20 reels on Redmi 12 doesn't crash               | Manual         | [ ]     |
| Memory stays flat through 20 reels (Android Studio Profiler)       | Profiler       | [ ]     |

---

## Feature 3: iOS Build

| Criterion                                                          | Where verified | Status  |
| ------------------------------------------------------------------ | -------------- | ------- |
| `ios/` folder bootstrapped via `npx cap add ios --packagemanager Cocoapods` | File presence | [ ] |
| Bundle identifier is `app.cbee.in` (matches Android)               | project.pbxproj | [ ]   |
| `pod install` succeeds without errors                              | Terminal       | [ ]     |
| App builds for iOS simulator                                       | Xcode          | [ ]     |
| App installs on real iPhone via free signing                       | Xcode + device | [ ]     |
| Login flow works on iPhone (email + Google OAuth)                  | Manual         | [ ]     |
| Push notifications register on iPhone (token logged)               | Console        | [ ]     |
| Camera permission prompt shows correct usage string                | Manual         | [ ]     |
| Camera works end-to-end on iPhone                                  | Manual         | [ ]     |
| Reels feed works end-to-end on iPhone                              | Manual         | [ ]     |
| All Info.plist usage strings are present and accurate              | Info.plist     | [ ]     |
| Xcode archive succeeds for distribution                            | Xcode          | [ ]     |
| Exported .ipa is signed correctly                                  | jarsigner      | [ ]     |

---

## Feature 4: Database Migration

| Criterion                                                          | Where verified | Status  |
| ------------------------------------------------------------------ | -------------- | ------- |
| Migration file exists at `supabase/migrations/<ts>_phase2_camera_reels.sql` | File | [ ] |
| Migration applies cleanly to staging                               | Supabase CLI   | [ ]     |
| `posts.media_kind` column exists, NOT NULL implied                 | DB             | [ ]     |
| Backfill ran: every Phase 1 video has `media_kind='video'`         | DB query       | [ ]     |
| Backfill ran: every Phase 1 photo has `media_kind='image'`         | DB query       | [ ]     |
| Sync trigger keeps `type` and `media_kind` aligned on insert       | DB test        | [ ]     |
| `reel_views` table exists with proper RLS                          | DB             | [ ]     |
| `reports` table exists with proper RLS                             | DB             | [ ]     |
| Cloudflare R2 bucket `cbee-media` exists with custom domain        | Cloudflare     | [ ]     |
| `get-upload-url` edge function deployed and rejects bad requests   | Manual test    | [ ]     |
| Upload via signed URL to R2 succeeds end-to-end                    | Manual test    | [ ]     |
| Public URL `media.cbee.in/...` is readable from a fresh device     | Manual test    | [ ]     |

---

## Feature 5: Bottom Navigation

| Criterion                                                          | Where verified | Status  |
| ------------------------------------------------------------------ | -------------- | ------- |
| 5 tabs render: Home / Find / Reels / Trove / Space                 | Manual         | [ ]     |
| No nav overflow on 360px-wide screen                               | DevTools       | [ ]     |
| Reels tab navigates to `/reels`                                    | Manual         | [ ]     |
| Active tab uses teal color `#26A69A`                               | Manual         | [ ]     |
| FAB appears on `/home` and `/search`                               | Manual         | [ ]     |
| FAB hidden on `/reels`, `/activity`, `/profile`, etc.              | Manual         | [ ]     |
| FAB navigates to `/upload`                                         | Manual         | [ ]     |
| FAB doesn't overlap safe areas on Pixel 7 (gesture nav)            | Manual         | [ ]     |
| FAB doesn't overlap safe areas on Redmi 12 (3-button nav)          | Manual         | [ ]     |

---

## Feature 6: Moderation MVP

| Criterion                                                          | Where verified | Status  |
| ------------------------------------------------------------------ | -------------- | ------- |
| Three-dot menu appears on every PostCard (non-owner)               | Manual         | [ ]     |
| Three-dot menu appears on every ReelSlide (non-owner)              | Manual         | [ ]     |
| Owner does NOT see report button on their own posts                | Manual         | [ ]     |
| Tapping "Report" opens dialog with 7 reason options                | Manual         | [ ]     |
| Selecting "Other" reveals details textarea                          | Manual         | [ ]     |
| Submitting writes a row to `reports`                               | DB             | [ ]     |
| Duplicate report (same user, same post) → friendly "already reported" message | Manual | [ ] |
| Triage SQL query returns open reports for Swaroop                  | Studio         | [ ]     |

---

## Feature 7: Capacitor 8 Upgrade

| Criterion                                                          | Where verified | Status  |
| ------------------------------------------------------------------ | -------------- | ------- |
| All `@capacitor/*` packages on v8.x                                | package.json   | [ ]     |
| `npx cap --version` shows 8.x                                      | Terminal       | [ ]     |
| Node 22+ in use                                                    | `node -v`      | [ ]     |
| Android edge-to-edge handled via CSS env() variables                | MOBILE_SAFE_AREAS.md | [ ] |
| No regression on Phase 1 features (login, feed, profile, messages, donations) | Manual | [ ] |
| Push notifications still register correctly                         | Manual         | [ ]     |

---

## Cross-cutting quality

| Criterion                                                          | Where verified | Status  |
| ------------------------------------------------------------------ | -------------- | ------- |
| `npm run typecheck` passes                                          | Terminal       | [ ]     |
| `npm run lint` passes (or all warnings triaged)                     | Terminal       | [ ]     |
| `npm run build` produces dist/ without warnings                    | Terminal       | [ ]     |
| All Phase 2 PRs squash-merged into `main`                          | Git log        | [ ]     |
| Git tag `v2.0.0` exists pointing at the handoff commit             | Git log        | [ ]     |
| `lovable-tagger` removed from `devDependencies`                    | package.json   | [ ]     |
| `data-lov-id` attributes not present in built dist                 | grep dist/     | [ ]     |
| `bun.lockb` removed; `package-lock.json` is the only lockfile      | Repo           | [ ]     |
| README.md replaced with hand-written Spurt version                 | Manual         | [ ]     |
| `.env.example` exists with placeholder Supabase values             | Repo           | [ ]     |
| All Phase 2 docs in `docs/` are committed                          | Repo           | [ ]     |

---

## Handoff deliverables

| Item                                                               | Status |
| ------------------------------------------------------------------ | ------ |
| Signed `app-release.aab` (Android)                                 | [ ]    |
| `cbee-release.jks` keystore (transferred securely — see keystore_handoff.md) | [ ] |
| `cbee-2.0.0.xcarchive` (iOS)                                       | [ ]    |
| Exported `cbee-2.0.0.ipa` (iOS, ad-hoc and / or app-store signed)  | [ ]    |
| `cbee_user_tour.mp4` — 3-min training video for users              | [ ]    |
| `cbee_admin_moderation.mp4` — 3-min training video for Swaroop     | [ ]    |
| Store-listing kit (descriptions, keywords, screenshots)            | [ ]    |
| `docs/handoff/going_live.md` — Swaroop's submission walkthrough    | [ ]    |
| `welcome_pack/` (Apple Dev + Google Play account setup)            | [ ]    |
| Final invoice for 30% balance                                       | [ ]    |

---

## Acceptance day procedure

End of Week 4, Bhaskar runs this:

1. Open this file on a tablet or laptop.
2. Walk through every checkbox above on real devices with Swaroop watching.
3. Demo each criterion. Check the box if passing; note the failure if not.
4. If <95% of boxes are checked: discuss with Swaroop whether to ship-and-fix-later or extend timeline.
5. If ≥95% are checked: hand off, invoice, celebrate.

Document the final checked state in this same file, then commit it (this becomes part of the handoff record).

---

**Next:** `docs/testing/device_matrix.md` for the test plan, or `docs/handoff/going_live.md` for the Swaroop-facing submission guide.
