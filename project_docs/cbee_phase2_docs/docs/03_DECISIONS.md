# 03 — Decisions

**Every architectural decision Phase 2 makes, why we made it, and the alternative we rejected.**

The point of this doc is to prevent re-litigation. When in Week 3 someone asks "wait, why aren't we using Mux for video?" — the answer is here, with the trade-off spelled out, so the conversation lasts 30 seconds, not 30 minutes.

---

## ADR-001 — Capacitor 8, not 7

**Decision:** Upgrade from Capacitor 7.4.3 to Capacitor 8 on Day 1.

**Why:**
- Cap 8 is the current major (released Dec 2025). Cap 7 is in security-only support.
- The capgo camera-preview plugin's gridlines API (`setGridMode`) shipped in v8.0.0 — staying on Cap 7 means we'd build the entire gridlines layer ourselves.
- Cap 8 ships native edge-to-edge support for Android — modern Android (15+) requires this anyway.
- The Cap 7→8 migration is mostly version bumps + a 30-minute edge-to-edge refactor of `MOBILE_SAFE_AREAS.md`.

**Rejected: Stay on Cap 7.**
- Saves ~0.5 day of upgrade work.
- But: we'd need a custom SVG gridlines layer (more code to maintain), and we'd be on a near-deprecated runtime at handoff. Net loss.

**Effort:** ~0.5 day on Day 1, blocks nothing else.

---

## ADR-002 — `@capgo/camera-preview`, not `@capacitor-community/camera-preview`

**Decision:** Use `@capgo/camera-preview@^8` as the camera plugin.

**Why:**
- **Active maintenance.** Last release: March 2026. The capacitor-community fork hasn't released in months.
- **Native gridlines.** `setGridMode({ gridMode: '3x3' | '4x4' })` since v8.0.0. The community fork has none of this.
- **EXIF data returned on capture.** Solves video orientation handling in the photo path automatically.
- **`getSafeAreaInsets()`.** Built-in notch-aware insets. Fits Cap 8's edge-to-edge mandate cleanly.
- **`storeToFile: true` + `getBase64FromFilePath`.** Avoids 30MB base64 strings crossing the Capacitor bridge — the perf foot-gun on the video path.
- **`requestPermissions({ showSettingsAlert: true })`.** Built-in deep link to Settings on permission denial. Cuts our `useNativeCamera` hook by ~40 lines.
- **Native tap-to-focus DISABLED by default.** Plugin explicitly recommends JS gestures + `setFocus({ x, y })`. Fewer native gesture recognizers = fewer iOS WebView audio-session conflicts.
- **SPM-ready.** Works with Cap 8's new Swift Package Manager default.

**Rejected: `@capacitor-community/camera-preview`.**
- The original tech plan picked this.
- Same JS API surface (roughly), so switching costs ~0 effort.
- But: less maintained, no built-in gridlines, no EXIF, no safe-area helper, no settings-deep-link convenience.

**Rejected: `@capacitor/camera` (official Apple-style camera).**
- Stills only, opens the system camera UI, no overlay control.
- We need a custom overlay (gridlines, frame guides) — impossible with the system camera.

**Effort:** ~0.5 day Day-2 spike to verify Cap 8 compat + permission flow on a real device.

---

## ADR-003 — Rename bundle ID `app.netlify.cbee` → `app.cbee.in` on Day 1

**Decision:** Rename the Android applicationId and iOS bundle identifier from `app.netlify.cbee` to `app.cbee.in` before `npx cap add ios` runs.

**Why:**
- `app.netlify.cbee` is technical debt from when this was a Netlify-hosted PWA. It looks unprofessional in the iOS Settings → About list.
- Once a bundle ID is on the Play Store or App Store, it's effectively permanent. A new bundle ID = a new app (loses all reviews, ratings, installs).
- Doing it now: ~30 minutes (edit `capacitor.config.ts`, `android/app/build.gradle`, move the MainActivity.java file). Doing it post-launch: impossible.
- `app.cbee.in` mirrors the cbee domain (`cbee.in` if Swaroop owns it) and the Spurt convention (`spurtstudios.in`). Apple and Google both accept it.

**Rejected: Keep `app.netlify.cbee`.**
- Saves 30 minutes.
- Permanent embarrassment in the metadata of every install.

**Rejected: `com.cbee.mobile`, `in.cbee.app`, `app.cbee.mobile`.**
- Equivalent quality. We arbitrarily chose `app.cbee.in` to match the existing `app.netlify.cbee` prefix pattern (less code to change).

**Effort:** ~30 min Day 1.

---

## ADR-004 — `embla-carousel-react` in vertical mode, not Swiper.js, not custom

**Decision:** Use `embla-carousel-react` (already in `package.json` at v8.3) configured with `axis: 'y'` + `containScroll: 'trimSnaps'`.

**Why:**
- **Zero new deps.** Already in the codebase.
- **Snap-per-slide is built in.** No custom IntersectionObserver gymnastics.
- **Mount-window control.** We can manually choose to mount only `[current-1, current, current+1]` slides, unmount the rest. Critical for memory on low-end Android.
- **Active embla snap change event** is the natural place to hook `.pause()` on the leaving video and `.play()` on the entering one.

**Rejected: Swiper.js.**
- Heavier bundle, extra dep.
- More features than we need.

**Rejected: Custom IntersectionObserver + scroll-snap CSS.**
- Would work, but we'd own all the edge cases (rubber-banding on iOS, momentum-stop detection, etc.).
- Embla has them solved.

**Effort:** Already done — just config.

---

## ADR-005 — `<video>` element + `playsInline muted preload=`, not video.js / hls.js

**Decision:** Native HTML5 `<video>` element. `playsInline muted preload="metadata"` on WiFi; `preload="none"` + tap-to-start on cellular.

**Why:**
- **Phase 2 is not streaming HLS.** Direct MP4 progressive download from Supabase Storage (CDN-fronted).
- **iOS autoplay rules** require `playsInline + muted` for un-tapped playback. The native `<video>` handles this correctly out of the box.
- **Tap-to-unmute is a 1-line handler.** No library needed.
- **No DRM, no adaptive bitrate, no licensing.**

**Rejected: video.js.**
- Overkill for non-streaming MP4.
- Heavier bundle, extra dep, extra surface.

**Rejected: hls.js.**
- We're not on HLS. Mux/Bunny is Phase 3.

**Effort:** Already minimal — see `docs/features/reels.md` Section 7.5.

---

## ADR-006 — Cursor-based pagination on `(created_at, id)`, not OFFSET/LIMIT

**Decision:** Cursor pagination with last `(created_at, id)` tuple as cursor, 8 items per page.

**Why:**
- **Stable under concurrent inserts.** A new reel posted while you're scrolling doesn't duplicate or skip rows.
- **Fast on large tables.** `OFFSET` makes Postgres scan + discard N rows; cursor seek hits the `(created_at, id)` index directly.
- **Plays cleanly with TanStack `useInfiniteQuery`** — built-in `pageParam` is the cursor.
- **Same pattern the existing `usePosts` hook uses.** Consistency.

**Rejected: OFFSET/LIMIT.**
- Drifts under inserts. Slow on big tables.

**Rejected: keyset on `id` alone (assuming serial / uuid v7 ordering).**
- We have random UUIDs (not v7), so `id` alone isn't time-ordered. Need the timestamp.

**Effort:** ~30 min for the `useReels` hook.

---

## ADR-007 — Newest-first + `is_featured` boolean override, not ML ranking

**Decision:** Reels feed query: `order by is_featured desc, created_at desc, id desc`.

**Why:**
- **Deterministic.** Same query, same result. Easy to QA.
- **Phase 2 scope is locked at "no ML."** Personalization is Phase 3+.
- **`is_featured` gives Swaroop a manual lever.** Mark a great pet video as featured via Supabase Studio; it pins to the top of every user's feed.
- **The partial index** on `is_featured = true` keeps the index small (only ~tens or hundreds of featured posts ever) while the join stays fast.

**Rejected: ML-personalized ranking.**
- Phase 3+. Needs a recommender service, training data, A/B framework, evaluation.

**Rejected: Chronological only, no override.**
- No way to surface the great content Swaroop curates. Worse for early growth.

**Effort:** ~5 min in the query.

---

## ADR-008 — Supabase Storage public URLs (Cloudflare-fronted), not Mux / Bunny

**Decision:** Video files live in Supabase Storage. Public-read URLs are served via Supabase's CDN edge (Cloudflare).

**Why:**
- **Zero new infra.** No third-party signup, no API integration, no extra invoice for Swaroop.
- **Adequate for the stated scale.** Up to ~100k DAU on cbee, this works.
- **CDN edge means good global latency** even though the origin is Supabase's US-East / EU region.

**Document the upgrade trigger:**
> If Supabase egress > 250GB/month (Pro tier included quota), consider Mux ($0.005/min stored, $0.005/min streamed) or Bunny ($0.01/GB egress) as Phase 3 add-ons. Math: a 30s 1080p reel ≈ 30MB. 250GB / 30MB = ~8,333 views before overage at $0.09/GB. For 1,000 DAU watching 20 reels/day = 300GB/day = blow-through in <1 day.

**Rejected: Mux from day one.**
- $0.005/min stored × 1,000 stored reels of 30s avg = $2.50/mo storage. Streaming on top.
- Overkill for Phase 2 scale, real cost driver if cbee grows.

**Rejected: Bunny CDN from day one.**
- Cheaper than Mux. But still extra infra to provision, secure, and hand off.

**Effort:** Already done — Supabase Storage is set up.

---

## ADR-009 — Keep 5 tabs in bottom nav, move Upload to floating action button

**Decision:** Bottom nav tabs become Home / Search / **Reels** / Trove / Space. The existing CirclePlus Upload icon moves to a floating action button (FAB) anchored bottom-right above the nav, visible only on Home and Search. The FAB taps directly into NativeCameraSheet in photo mode.

**Why:**
- **6 tabs cram visually on small Android screens** (5.5" 720p phones still in cbee's target market). Safe-area math from `MOBILE_SAFE_AREAS.md` is tuned for 5.
- **Reels deserves the center slot** — it's the visual anchor position, à la Instagram. Center = "this is the big thing in this app."
- **FAB for camera matches the Instagram + WhatsApp pattern users already know.**

**Rejected: 6 tabs.**
- Cramped, breaks safe area math.

**Rejected: Replace Trove or Space with Reels.**
- Destroys existing user habits — Phase 1 users learned where Notifications and Profile live.

**Rejected: Hide the upload entry behind a Home-header icon.**
- Discoverability hit. A FAB on the home screen is the most-clicked button pattern in social apps for a reason.

**Effort:** ~3 hours editing `src/components/Layout.tsx`.

---

## ADR-010 — Carve in a "Report MVP" inside the ₹60k, vs strict Phase 3

**Decision:** Add a one-button report flow + `reports` table + admin SQL query Swaroop runs in Supabase Studio. ~4 hours of work inside Phase 2 budget.

**Why:**
- **As soon as Reels ships, ANY uploaded content can become a Play Store / App Store / legal problem.** Google's content policies require an in-app way to report content. Without it, the app can be rejected.
- **A "report button → reports table" is the smallest possible compliance layer.** Doesn't need a UI queue, doesn't need notification fan-out, doesn't need automated moderation.
- **Admin "queue" is Supabase Studio + a saved SQL query.** Zero UI to build.
- **4 hours is well within budget slack.**

**Rejected: Strict Phase 3 punt.**
- Saves 4 hours. Risks an entire shipped app that can't pass Play Store review.

**What's NOT in this MVP** (still Phase 3): admin moderation queue UI, user blocking, automatic content classification, ML safety filters, takedown notification to the reporter, ban appeals flow.

**Effort:** ~4 hours total (1 hr migration + RLS, 2 hrs ReportButton + dialog UI, 1 hr admin SQL doc).

---

## ADR-011 — Disconnect from Lovable for the sprint, reconnect at handoff (optional)

**Decision:** Tell Swaroop on Day 1: "We're disconnecting the project from Lovable for the next 4 weeks so we own the git history cleanly. After handoff you can reconnect."

**Why:**
- **Lovable's bi-directional sync** (described in the README) means any edit in the Lovable UI commits to the repo, racing our PRs.
- **`lovable-tagger` (devDep) instruments every JSX node with `data-lov-id` attributes** — generates noisy diffs that hurt PR review and AI IDE context.
- **Standard IDE workflows work cleaner on a normal git repo** without Lovable's auto-sync layer.

**Rejected: Leave Lovable connected bi-directionally.**
- Sync conflicts will eat developer time.

**Rejected: Lovable in pull-only-from-git mode.**
- Possible, but still requires `lovable-tagger` in deps, still pollutes diffs.

**Effort:**
- Day 1: Swaroop disconnects via Lovable dashboard (~5 min).
- Day 1: We remove `lovable-tagger` from devDependencies + `vite.config.ts`.
- Day 1: We quarantine `src/integrations/lovable/` (review what it does, remove if unused; else leave but document).

---

## ADR-012 — Keep `posts.type` parallel to new `media_kind`, with sync trigger

**Decision:** Don't drop the existing `posts.type` column in Phase 2. Add a BEFORE trigger that keeps `type` and `media_kind` in sync regardless of which column the caller writes.

**Why:**
- **Phase 1 code reads `posts.type`.** Dropping it = breaking Phase 1.
- **A sync trigger is ~15 lines of SQL.** Cheap.
- **Phase 3 deprecation path is clear** — when no Phase 1 code references `type` anymore, drop the column + trigger in one migration.

**Rejected: Drop `posts.type` immediately.**
- Breaks Phase 1 reads. Even if we update every Phase 1 query, users on old app versions still hit broken queries.

**Rejected: Don't add `media_kind`, just keep `type`.**
- `type` doesn't differentiate "reel" from regular video. Reels feed needs that distinction.

**Effort:** ~15 lines added to the migration. See `docs/02_DATA_MODEL.md` section 3.

---

## ADR-013 — Performance promises gated by network + device, not absolute

**Decision:** "Video starts in <1.5s" is **on WiFi**. On cellular (4G/3G detected via `@capacitor/network`), the player drops to `preload="none"` and requires an explicit tap to start — no <1.5s promise. "60fps swipe" is **on Pixel 7 / Samsung A55 (mid-range Android)**. On Redmi 12 (low-end, 4GB RAM), the promise is **no jank > 200ms**, not 60fps.

**Why:**
- **Both promises are achievable** in the qualified envelope.
- **The original "Reels start in <1.5s + 60fps" was a quietly impossible promise** if interpreted as universal — on a Jio 3G connection, a 30MB MP4 progressive-download just doesn't start in 1.5s.
- **Explicit acceptance criteria** mean we can demo at handoff against agreed targets, not feel-based interpretation.

**Rejected: Universal <1.5s + 60fps on all devices.**
- Not honest. Will fail QA on cellular and on low-end Android.

**Effort:** Already factored in. See `docs/testing/acceptance_criteria.md`.

---

## ADR-014 — Spurt does not submit to stores; Swaroop does, with the Welcome Pack and Going Live guide

**Decision:** The engagement ends at handoff of signed AAB + Xcode archive. Swaroop submits to Google Play and Apple App Store himself, using the Welcome Pack instructions and Going Live 1-pager. Phase 3 add-on quote available if he wants Spurt to do submissions.

**Why:**
- **Apple review can take 1-14 days.** Google Play personal accounts must run a 14-day closed test before production. Neither timeline fits inside a 4-week build sprint.
- **Submission requires Swaroop's developer accounts** (Apple Dev $99/yr, Google Play $25 one-time) under his name, not Spurt's. He has to be the one logged in.
- **The Welcome Pack** is the carve-out that makes this realistic — comprehensive enough that Swaroop can do this himself, with linked tutorials, screenshots, and a checklist.

**Rejected: Spurt handles submissions inside ₹60k.**
- Eats 1-2 weeks of calendar time on review back-and-forth. Budget can't absorb it.

**Rejected: Hand off and walk away with no submission guide.**
- Sets Swaroop up to fail on day 1 of going live. Bad relationship outcome.

**Effort:** Welcome Pack + Going Live 1-pager are Week 4 deliverables. ~4 hours total.

---

## ADR-015 — No automated test suite in Phase 2

**Decision:** No Vitest, no Jest, no Playwright, no Detox. QA is manual on the device matrix.

**Why:**
- **The 4-week budget doesn't include a test harness setup.** Even a minimal Vitest install + test patterns + CI integration is ~1 day, then test-writing on every PR slows velocity.
- **The codebase has zero tests today.** Writing tests for legacy code without changing it is low-leverage.
- **Real-device QA on 4 phones (Pixel 7, Samsung A55, Redmi 12, iPhone) catches what matters** for a 4-week feature sprint.

**Rejected: Add Vitest + write tests for new code only.**
- Reasonable but still ~0.5 day of overhead. Punt to Phase 3 when the codebase warrants it.

**Note:** This is an honest scope-limit, not a quality claim. The codebase deserves tests eventually; Phase 2 isn't the moment.

**Effort:** Avoided.

---

## ADR-016 — `@capgo/capacitor-uploader` for video uploads is a Day-1 spike decision

**Decision:** Day 1, decide whether to use `@capgo/capacitor-uploader` for the video upload path, or stick with the existing `useMediaUpload` → Supabase JS client path.

**Why this is a decision, not a default:**
- **The Supabase JS client uploads through the WebView (fetch).** Fine for images (≤5MB). For videos at 30-50MB, the WebView's memory pressure on low-end Android can cause OOM kills mid-upload.
- **`@capgo/capacitor-uploader` does the upload natively** via a presigned URL → S3 PUT, with progress events. Skips the WebView entirely.
- **But** it requires Supabase to issue presigned URLs (an edge function we'd need to write) — adds infra surface.

**Decision rule:**
- If, in the Day 2 spike, uploading a 30MB MP4 via Supabase JS client succeeds reliably on the Redmi 12: **stay with the existing path**, document the limit.
- If it OOMs or fails: **add `@capgo/capacitor-uploader` + a Supabase edge function** that issues presigned URLs (~0.5 day extra).

**Rejected: Always use uploader.**
- Adds infra unnecessarily if the JS client works for our file sizes.

**Rejected: Never use uploader.**
- Risk of OOM on low-end devices.

**Effort:** Either 0 or +0.5 day, decided Day 2.

---

## ADR-017 — Cloudflare R2 for media storage from Day 1, not Supabase Storage

**Decision:** All photo and video media (uploads and reads) lives in a Cloudflare R2 bucket from Day 1, served via a `media.cbee.in` CDN subdomain. Supabase Storage is NOT used for the new `posts-media` content (Phase 1 legacy posts continue to serve from Supabase Storage and are not migrated).

**Why:**
- **Zero egress fees, at any scale.** R2 is the only major object store that doesn't bill for bandwidth out. A reel watched 100,000 times costs the same as a reel watched once. Supabase Storage charges $0.09/GB uncached / $0.03/GB cached for every byte served — at ~1,000 DAU and modest reels engagement, that's $100-300/month; at 10,000 DAU it's $1,200-3,000/month.
- **Scaling is pay-more-not-rebuild.** Once R2 is in the architecture, the codebase doesn't change as cbee grows. Swaroop adds zero lines of code between 0 and 100,000 DAU. He just pays the bill. The alternative (Supabase Storage now, R2 later) means a forced migration in 6-12 months at exactly the worst time — when the product is working and users are growing.
- **R2 free tier covers cbee's first ~6 months.** 10 GB storage, 1M write ops, 10M read ops included monthly. The first paid R2 bill probably arrives somewhere around 500-1,000 DAU.
- **S3-compatible API.** R2 speaks the same protocol as AWS S3 / Bunny / DigitalOcean Spaces — if Cloudflare ever stops being the right choice, the migration is endpoint config only, not code rewrite.
- **Direct-from-client uploads** via signed PUT URLs from a Supabase Edge Function. Big files never traverse the WebView's `fetch()` (which OOMs on low-end Android with 30MB videos). Native browser PUT to R2's edge handles it.

**Rejected: Supabase Storage from Day 1, migrate to R2 later.**
- The original plan in Phase 2 used Supabase Storage's `posts-media` bucket.
- It works at 0-100 DAU. It breaks (financially) at 1,000+ DAU.
- Migrating later means rewriting `useMediaUpload`, updating every `media_url` in the `posts` table, and managing a hybrid period where some posts are on Supabase Storage and some are on R2. Realistic effort: 2-3 days, plus weeks of careful migration of historical data.
- vs the 0.5 day extra it costs to set up R2 on Day 1.

**Rejected: Mux for video, R2 for images.**
- Mux is $0.005/min stored + $0.005/min streamed. For cbee at 1,000 DAU it's roughly $10-30/month — competitive with R2.
- But: Mux is video-only. We'd still need R2 (or Supabase Storage) for images. Two systems instead of one. Two billing accounts.
- Mux's value (adaptive bitrate, HLS, live streaming, transcoding) is a Phase 3+ feature. Don't pay for it before you need it.

**Rejected: Bunny CDN + Bunny Storage.**
- Bunny is cheaper than most CDNs (~$0.01/GB egress, vs $0.09 for AWS / Supabase). 
- But "cheaper than $0.09" is still meaningfully more than R2's $0. At 10TB egress (1,000 DAU heavy), Bunny costs $100/month for the egress alone vs R2's $0.
- Also: Bunny's free tier is smaller, and you pay from the first byte.

**Rejected: AWS S3 + Cloudflare CDN in front.**
- Works, but you still pay AWS S3 egress to the Cloudflare cache ($0.09/GB to the cache's first hit). At cbee's scale, this is ~$30-300/month wasted on origin-to-CDN traffic.
- R2 → Cloudflare CDN is the same product, no origin egress.

**Effort:** ~0.5 day on Day 1 — see `docs/features/media_storage.md` for the full setup.

**Cost trajectory (vs the rejected Supabase-only path):**

| DAU      | Supabase-only (with overage) | R2 architecture |
| -------- | ---------------------------- | --------------- |
| 100      | $25/month                    | $25/month       |
| 1,000    | $135-300/month               | ~$37/month      |
| 10,000   | $1,200-3,000/month           | ~$140/month     |
| 100,000  | budget-burning                | ~$1,200/month   |

The R2 architecture is 10x cheaper at every scale above 1,000 DAU and equivalent below. The 0.5-day setup cost pays for itself in the first month past 1,000 DAU.

---

## What we did NOT decide on (and why)

These are explicitly Phase 3 conversations. Don't litigate them in Phase 2.

- **Stories** (24h ephemeral content). Phase 3+.
- **In-app video editing, filters, music.** Phase 3+.
- **ML feed ranking.** Phase 3+.
- **Live streaming.** Phase 3+.
- **Monetization** (tipping, subscriptions, ads). Phase 3+.
- **Web companion app.** Phase 3+.
- **Migration of `messages` bucket media → `posts-media` bucket.** Out of scope. New posts only.
- **Performance optimizations beyond the acceptance criteria.** Out of scope.
- **Onboarding redesign.** Out of scope.
- **A real moderation queue UI.** Phase 3+ (only the report-button MVP is Phase 2).
- **A test framework.** Phase 3+.

---

**Next:** `docs/04_GOTCHAS.md` for the WebView / Cap / Supabase quirks log, or jump to the feature spec you're implementing.
