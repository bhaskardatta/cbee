# 00 — System Overview

**What it is, who it's for, and how the pieces fit together.** This is the human entry point. Read this before opening any other doc.

---

## In one paragraph

cbee is a Capacitor-wrapped Vite + React + TypeScript app backed by Supabase. The web bundle is the source of truth for UI; Capacitor wraps it as a signed native Android AAB today and (after Phase 2 Day 1) a signed iOS Xcode archive. Supabase provides Postgres, Storage, Auth, and Edge Functions. The Phase 1 product gives pet parents a feed, profiles, messaging, donations, and basic photo upload via a system file picker. **Phase 2 replaces the file picker with a true in-app camera, adds a Reels-style vertical-swipe video feed, and ships the iOS build alongside Android.** The 4-week sprint pivots on the fact that ~90% of the plumbing already works — auth, storage, navigation, push notifications, theming, Android scaffolding — so Phase 2 is additive, not a rebuild.

---

## The map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            USER'S PHONE                                 │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  Capacitor 8 Native Shell  (Android AAB  /  iOS .xcarchive)     │   │
│   │                                                                 │   │
│   │   ┌─────────────────────────────────────────────────────────┐   │   │
│   │   │              WebView (Chrome / WKWebView)               │   │   │
│   │   │                                                         │   │   │
│   │   │   ┌─────────────────────────────────────────────────┐   │   │   │
│   │   │   │   Vite-built React bundle  (the "app")          │   │   │   │
│   │   │   │                                                 │   │   │   │
│   │   │   │   Pages   ←   AppLayout   ←   App.tsx (router) │   │   │   │
│   │   │   │     │             │                             │   │   │   │
│   │   │   │     ▼             ▼                             │   │   │   │
│   │   │   │   Components   Hooks  ←  TanStack Query cache  │   │   │   │
│   │   │   │     │             │                             │   │   │   │
│   │   │   │     └────────┬────┘                             │   │   │   │
│   │   │   │              │                                  │   │   │   │
│   │   │   │              ▼                                  │   │   │   │
│   │   │   │     Supabase JS client (typed)                 │   │   │   │
│   │   │   └─────────────────────────────────────────────────┘   │   │   │
│   │   └─────────────────────────────────────────────────────────┘   │   │
│   │                                                                 │   │
│   │     Capacitor Plugins (the JS↔native bridge):                   │   │
│   │       App  •  StatusBar  •  Keyboard  •  Network                │   │
│   │       Push (FCM / APNs)  •  Preferences  •  Splash              │   │
│   │       Haptics  •  Browser                                       │   │
│   │       NEW IN PHASE 2:  @capgo/camera-preview  (camera + video)  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
                            │  HTTPS  (Supabase JS via PostgREST + RLS)
                            │  HTTPS  (Storage uploads/downloads, CDN-fronted)
                            │  WSS    (Realtime, if used — currently minimal)
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       SUPABASE PROJECT                                  │
│                   (under Swaroop's account, not Spurt's)                │
│                                                                         │
│   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐    │
│   │   Postgres DB    │   │     Storage      │   │   Edge Funcs     │    │
│   │                  │   │                  │   │                  │    │
│   │  profiles        │   │  messages/   ← chat │ initiate-payment │   │
│   │  posts           │   │   (Phase 1 only)  │ │ payment-callback │    │
│   │  likes           │   │                   │ │ register-push    │    │
│   │  comments        │   │  Photo + video    │ │ send-push        │    │
│   │  follows         │   │  posts go to R2,  │ │ get-upload-url ← │    │
│   │  messages        │   │  NOT here.        │ │   (NEW: signs    │    │
│   │  notifications   │   │                   │ │    R2 PUT URLs)  │    │
│   │  push_tokens     │   │                   │ │ etc.             │    │
│   │  donations       │   │                   │ │                  │    │
│   │                  │   │                   │ │                  │    │
│   │  PHASE 2 ADDS:   │   │                   │ │                  │    │
│   │  reel_views      │   │                   │ │                  │    │
│   │  reports         │   │                   │ │                  │    │
│   │  + columns on    │   │                   │ │                  │    │
│   │    posts table   │   │                   │ │                  │    │
│   └──────────────────┘   └──────────────────┘   └──────────────────┘    │
│                                                                         │
│   Auth: Supabase Auth (email + Google OAuth via deep link)              │
└─────────────────────────────────────────────────────────────────────────┘
                            │
                            │  Direct PUT (signed URL from edge fn)
                            │  Direct GET (public CDN URL)
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE R2 + CDN                                  │
│              (under Swaroop's Cloudflare account)                       │
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │  Bucket: cbee-media                                          │      │
│   │  Public domain: media.cbee.in                                │      │
│   │                                                              │      │
│   │  Object key pattern: <user_id>/<timestamp>_<kind>.<ext>      │      │
│   │  e.g.   media.cbee.in/abc-123/1747841200_video.mp4           │      │
│   │                                                              │      │
│   │  Free tier: 10GB storage, 1M writes, 10M reads / month       │      │
│   │  Egress: ALWAYS FREE — at any scale                          │      │
│   │  See ADR-017 + docs/features/media_storage.md                │      │
│   └──────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## What changes in Phase 2 — visualized

The architecture above is mostly Phase 1. Phase 2 adds three things and only three things:

| Layer        | Phase 1                                   | Phase 2 adds                                                              |
| ------------ | ----------------------------------------- | ------------------------------------------------------------------------- |
| Native shell | Android only                              | iOS (`ios/` folder created Day 1, signed Xcode archive at handoff)        |
| Capacitor    | No camera plugin                          | `@capgo/camera-preview@^8` for in-app camera + video capture              |
| UI pages     | Home, Search, Upload, Activity, Profile, Messages | + Reels page at `/reels`                                          |
| UI components | PostCard, PostGrid, etc.                 | + `NativeCameraSheet`, `GridlinesOverlay`, `ShutterButton`, `ReelSlide`, `ReelOverlay`, `ReelProgressBar`, `ReportButton` |
| DB schema    | Already supports type=photo/video         | + `media_kind`, `media_aspect_ratio`, `duration_seconds`, `thumbnail_url`, `is_featured`, `view_count` on `posts`; new `reel_views` table; new `reports` table |
| Storage      | `messages/` bucket only                   | + **Cloudflare R2 bucket `cbee-media`** for all photo+video posts, served from `media.cbee.in`. See ADR-017 and `docs/features/media_storage.md`. |
| Bottom nav   | 5 tabs: Home / Search / Upload / Trove / Space | 5 tabs (re-arranged): Home / Search / Reels / Trove / Space + floating camera FAB |
| Bundle ID    | `app.netlify.cbee`                        | `app.cbee.in` (renamed Day 1)                                              |

Everything else — auth, RLS, navigation, theming, push, safe areas, query cache, edge functions — is reused as-is.

---

## The four boundaries that matter

A lot of Phase 2 thinking comes down to four boundaries you'll cross constantly. Each has its own gotchas; the docs they point to are where the detail lives.

1. **JS ↔ Native (the Capacitor bridge).** Camera plugin, push, keyboard, etc. all cross this. Large base64 strings are slow across it; use `storeToFile: true` + `getBase64FromFilePath` for the camera path. See `docs/features/camera.md`.

2. **Client ↔ Database (PostgREST + RLS).** Every Supabase query goes through PostgREST and is gated by RLS policies. If a query returns empty when you expect rows, **check the RLS policy first** — it's the most common foot-gun. See `docs/02_DATA_MODEL.md`.

3. **App ↔ R2 (media uploads + reads via CDN).** Uploads go to R2 via a signed PUT URL issued by the `get-upload-url` Supabase Edge Function. Reads come from the `media.cbee.in` CDN — free egress at any scale. See `docs/features/media_storage.md` for the architecture and ADR-017 for why R2 instead of Supabase Storage.

4. **App ↔ App Stores (build artifacts + review).** Spurt's job ends at handoff of signed AAB + Xcode archive. Submission, the 14-day Google Play closed test for personal accounts, and the 1-14 day Apple review are Swaroop's job (with the Going Live guide). See `docs/handoff/going_live.md` and `welcome_pack/`.

---

## The thing that surprises people most

Once you understand cbee, the genuinely non-obvious thing is this:

> **The schema for "posts" already supports videos.** The `posts.type` column has accepted `'photo' | 'video'` since Migration 2 (June 2025). Phase 1 simply never built the camera, recording, or vertical-feed UI on top. So Phase 2 is unlocking capability the database has had all along, not adding a new content type.

This is why the migration is additive (columns + tables, no schema rewrites) and why the budget can be ₹60k.

---

## What "done" looks like

End of Week 4, the handoff zip contains:

1. Signed Android `app-release.aab` + Android `cbee-release.jks` keystore (transferred securely)
2. iOS `cbee-2.0.0.xcarchive` + exported `cbee-2.0.0.ipa`
3. Source code at git tag `v2.0.0`, all Phase 2 commits squash-merged into `main`
4. Two training videos (~3 min each): user feature tour, admin content moderation
5. Store-listing kit (short + long descriptions, keywords, screenshot templates, privacy disclosure)
6. "Going Live" 1-pager guide for Swaroop to upload to stores
7. Welcome Pack with Apple Developer + Google Play registration walkthroughs

Phase 2 is not "live on stores at Week 4." Phase 2 is "production-ready artifacts in Swaroop's hands at Week 4." Going live then depends on Swaroop's developer-account status and the stores' review timelines (1-14 days Apple, plus mandatory 14-day Google closed test for personal accounts).

---

**Next:** open `docs/01_REPO_MAP.md` for the file-by-file directory tour, or `docs/03_DECISIONS.md` if you want to understand the "why" behind every architecture choice.
