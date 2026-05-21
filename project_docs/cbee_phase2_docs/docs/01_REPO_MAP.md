# 01 — Repo Map

**File-by-file tour of the cbee codebase.** When you need to find where something lives, search here first, then `grep` the codebase.

The repo follows the standard Vite + Capacitor layout. Phase 1 was bootstrapped on Lovable, so a few Lovable-isms remain (the `lovable-tagger` dev dep, the `src/integrations/lovable/` directory) — those are flagged below as "remove or quarantine on Day 1."

---

## Top level

```
.
├── .env                        Supabase URL + anon key.  Committed (the anon key is public-safe).  Do NOT add service-role keys here.
├── .gitignore                  Standard React + Capacitor ignores.  Verify dist/, build/, *.jks, *.keystore are in here.
├── android/                    Native Android Studio project.  Already scaffolded.  Phase 2 edits AndroidManifest.xml + adds signingConfigs.
├── ios/                        DOES NOT EXIST YET.  Created via `npx cap add ios` on Day 1.
├── public/                     Static assets served at root.  favicon, splash, _redirects (Netlify legacy).
├── src/                        The React app.  See "Src layout" below.
├── supabase/                   Migrations + edge functions.  See "Supabase layout" below.
├── bun.lockb                   Bun lockfile.  Treat as binary — never edit by hand.
├── package-lock.json           NPM lockfile.  Coexists with bun.lockb because Lovable used npm originally.  We use npm.
├── package.json                Dependencies.  See "Dependencies of note" below.
├── capacitor.config.ts         Capacitor config: appId, scheme, plugin settings.  Bundle ID lives here.
├── components.json             shadcn/ui config.  Points to src/components/ui/.
├── eslint.config.js            ESLint flat config.  TypeScript + react-hooks + react-refresh.
├── index.html                  Vite entry HTML.  Mostly empty — React owns rendering.
├── postcss.config.js           PostCSS for Tailwind.
├── tailwind.config.ts          Tailwind config.  Custom theme tokens live here, but the #26A69A teal is mostly used inline.
├── tsconfig.json               TS project root.
├── tsconfig.app.json           App TS config (browser env).
├── tsconfig.node.json          Node TS config (config files only).
├── vite.config.ts              Vite + react-swc + @ alias to /src.
├── MOBILE_SAFE_AREAS.md        REQUIRED READING before touching anything near a screen edge.  Cap 8 changes this.
├── README.md                   Project README — overview, quickstart, dashboard config.
└── docs/                       Phase 2 documentation tree (this file is here).
```

---

## `src/` layout

```
src/
├── App.tsx                     Root component.  Defines the router, providers (QueryClient, ThemeProvider, AuthProvider, OfflineDetector, BrowserRouter).  All routes lazy-loaded except HomePage.
├── App.css                     Empty / minimal.  Tailwind is the styling system.
├── index.css                   Tailwind imports + the few global CSS variables.
├── main.tsx                    React 18 createRoot entry.
├── vite-env.d.ts               Vite-injected types.
│
├── pages/                      One file per route.  All lazy-loaded in App.tsx.
│   ├── ActivityPage.tsx        Notification / activity feed (called "Trove" in nav).
│   ├── FeedbackPage.tsx        User feedback form.
│   ├── HomePage.tsx            Main feed (followed users + chronological).  NOT lazy-loaded — first render hot path.
│   ├── Index.tsx               Legacy / unused.  Routes redirect to /splash.
│   ├── LoginPage.tsx           Email + Google OAuth login.
│   ├── MessagesPage.tsx        DM list + thread view (single component, route-param-driven).
│   ├── NotFound.tsx            404.
│   ├── PaymentStatusPage.tsx   Razorpay-style payment status landing.
│   ├── PostDetailPage.tsx      Single post deep link.  Likes, comments, share.
│   ├── ProfilePage.tsx         Current user's profile (called "Space" in nav).
│   ├── SearchPage.tsx          User + post search.
│   ├── SignupPage.tsx          Email signup with username availability check.
│   ├── SplashScreen.tsx        First-launch splash (separate from Capacitor SplashScreen plugin).
│   ├── SupportPage.tsx         Help / contact.
│   ├── UploadPage.tsx          ★ PHASE 2 EDITS HERE — adds camera button alongside the file picker.
│   └── UserProfilePage.tsx     Other-user profile view.
│
├── components/                 Shared components.
│   ├── ActivityItem.tsx        Notification list row.
│   ├── AnimatedEmoji.tsx       Lottie-driven emoji animations.
│   ├── AppHeader.tsx           Per-page top bar.
│   ├── AppLayout.tsx           Wraps protected routes; renders bottom nav and outlet.
│   ├── AppNavbar.tsx           Top bar variant (vs AppHeader — used selectively).
│   ├── CommentItem.tsx         Comment list row.
│   ├── EmojiPicker.tsx         Emoji input for comments / messages.
│   ├── FeedbackSupport.tsx     Embedded feedback widget.
│   ├── HeartAnimation.tsx      Double-tap-like animation.  REUSED FOR REELS.
│   ├── Layout.tsx              The bottom nav.  ★ PHASE 2 EDITS HERE — reshuffles tabs, adds camera FAB.
│   ├── OfflineDetector.tsx     Network-state banner.
│   ├── OptimizedImage.tsx      Wrapper around <img> with lazy + blur-up loading.
│   ├── PetAvatar.tsx           User avatar with fallback initials.
│   ├── PostCard.tsx            Feed post card (the unit of the home feed).
│   ├── PostGrid.tsx            Profile post grid (3-col image grid).
│   ├── PrivacyPolicyDialog.tsx Privacy policy modal.
│   ├── ProfilePhotoEditor.tsx  Avatar crop / upload.
│   ├── ProtectedRoute.tsx      Auth gate.  Redirects to /login if no session.
│   ├── SignOutDialog.tsx       Confirm sign-out.
│   ├── StatusBarConfig.tsx     Sets native status bar style per route.
│   ├── ThemeProvider.tsx       next-themes wrapper.  Light mode is default; dark is supported but not used much.
│   ├── ui/                     shadcn/ui primitives (button, dialog, tabs, etc.).  AUTO-GENERATED by shadcn CLI.  Don't hand-edit; re-run the shadcn CLI to add more.
│   │
│   ├── camera/                 ★ NEW IN PHASE 2.
│   │   ├── NativeCameraSheet.tsx   Full-screen camera UI (Dialog/Drawer).
│   │   ├── GridlinesOverlay.tsx    SVG overlay (mode prop: off/thirds/1:1/4:5/9:16).
│   │   └── ShutterButton.tsx       Tap=photo, hold=video, max-60s progress ring.
│   │
│   └── reels/                  ★ NEW IN PHASE 2.
│       ├── ReelsFeed.tsx           Owns the embla instance + mount window.
│       ├── ReelSlide.tsx           One slide: <video> + overlay + tap gestures.
│       ├── ReelOverlay.tsx         Caption, like, comment, share, owner avatar.
│       ├── ReelProgressBar.tsx     Video scrub indicator at top of slide.
│       └── ReportButton.tsx        Three-dot menu → Report (uses moderation_mvp).
│
├── contexts/                   React Contexts.
│   └── AuthContext.tsx         Wraps Supabase Auth state.  useAuth() pulls session, user, signOut.
│
├── hooks/                      Custom hooks.
│   ├── use-mobile.tsx          Tailwind-aware mobile breakpoint check.
│   ├── use-toast.ts            shadcn toast variant (vs sonner).
│   ├── useAndroidBackHandler.ts Capacitor App back-button → router back.
│   ├── useComments.ts          TanStack Query wrapper for post comments.
│   ├── useMediaUpload.ts       ★ PHASE 2 REWRITE — goes through Cloudflare R2 via get-upload-url edge fn. See docs/features/media_storage.md.
│   ├── useMessages.ts          TanStack Query wrapper for DMs.
│   ├── useMobileKeyboard.ts    Soft-keyboard height tracking.
│   ├── useMobileKeyboardGap.ts Padding helper for keyboard-aware UIs.
│   ├── useNativeKeyboard.ts    Capacitor Keyboard plugin wrapper.  .pb-keyboard class hooks in here.
│   ├── useNativePush.ts        Capacitor PushNotifications wrapper.  Registers token, listens for push.
│   ├── usePets.ts              Pet profile queries.
│   ├── usePlatform.ts          isNative / isAndroid / isIOS / isWeb checks.
│   ├── usePosts.ts             ★ PHASE 2 EDITS — round-trips media_kind, media_aspect_ratio, duration_seconds, thumbnail_url.
│   ├── useProfile.ts           User profile queries + updates.
│   ├── usePushNotifications.ts Higher-level push helper (subscribes, marks-read, etc.).
│   ├── useSearch.ts            Search query, debounced.
│   ├── useUserPosts.ts         Posts by a specific user (for ProfilePage).
│   ├── useUsernameCheck.ts     Live availability check at signup.
│   │
│   ├── useNativeCamera.ts      ★ NEW IN PHASE 2.  Wraps @capgo/camera-preview.
│   ├── useReels.ts             ★ NEW IN PHASE 2.  useInfiniteQuery, 8 per page, cursor on (created_at, id).
│   ├── useReelView.ts          ★ NEW IN PHASE 2.  1.5s dwell → insert reel_view + bump posts.view_count via trigger.
│   └── useReport.ts            ★ NEW IN PHASE 2.  Insert into reports table.  Used by ReportButton.
│
├── integrations/
│   ├── supabase/
│   │   ├── client.ts           Typed Supabase client.  Always import from here.
│   │   └── types.ts            AUTO-GENERATED.  Regenerate via `supabase gen types typescript --project-id <id>`.
│   └── lovable/
│       └── index.ts            Lovable cloud auth helper.  QUARANTINE on Day 1 — we use Supabase Auth, not Lovable's auth.
│
├── lib/                        Utility functions.
│   └── (TBD — `theme.ts` mentioned in the tech plan; verify on Day 1)
│
├── styles/                     Additional CSS.  Mostly empty; Tailwind is the system.
│
└── assets/                     Image assets imported by React (vs static public/ ones).
```

---

## `supabase/` layout

```
supabase/
├── config.toml                 Supabase CLI config.  Project ID, local-dev ports.
├── functions/                  Edge Functions (Deno).
│   ├── initiate-payment/       Razorpay-like payment initiation.
│   ├── payment-callback/       Razorpay-like payment webhook.
│   ├── payment-status/         Payment status polling endpoint.
│   ├── register-push/          Stores FCM/APNs tokens in push_tokens table.
│   ├── send-donation-notification/ Notification fan-out for donations.
│   ├── send-push/              Sends push via Supabase → FCM/APNs.
│   └── get-upload-url/         ★ NEW IN PHASE 2 — issues signed PUT URLs for direct uploads to Cloudflare R2. See docs/features/media_storage.md.
│
└── migrations/                 28 SQL migrations as of repo snapshot.  Phase 2 adds ONE more:
    ├── 20250610050010_*.sql                                          profiles table + handle_new_user trigger
    ├── 20250610064359_*.sql                                          posts, likes, comments tables
    ├── (... 24 more, chronological — see git log for context ...)
    ├── 20251014130102_*.sql                                          messages table + media_url, media_type
    ├── 20260427142509_*.sql                                          (recent — read these to understand the latest schema)
    ├── 20260502165558_*.sql                                          (recent)
    ├── 20260503045242_*.sql                                          (most recent before Phase 2)
    └── 20260512xxxxxx_phase2_camera_reels.sql                        ★ NEW IN PHASE 2 — see docs/02_DATA_MODEL.md for the full SQL.
```

---

## `android/` layout — what changes

```
android/
├── app/
│   ├── build.gradle                                Phase 2 edits: versionCode 1→2, versionName "1.0"→"2.0", signingConfigs.release block
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml                     Phase 2 edits: + CAMERA, RECORD_AUDIO, READ_MEDIA_IMAGES, READ_MEDIA_VIDEO
│       └── java/app/netlify/cbee/MainActivity.java MOVES Day 1 to java/in/cbee/app/MainActivity.java when bundle ID renames
├── build.gradle
├── settings.gradle
├── variables.gradle
└── ... (Gradle wrapper, etc.)
```

---

## `ios/` layout — what gets created

After `npx cap add ios` on Day 1, this appears:

```
ios/
└── App/
    ├── App.xcworkspace                             ← Open THIS, not the .xcodeproj
    ├── App.xcodeproj
    ├── Podfile                                      ← If we opt into CocoaPods (Cap 8 defaults to SPM)
    ├── App/
    │   ├── AppDelegate.swift
    │   ├── Info.plist                              Phase 2 edits: + NSCameraUsageDescription, NSMicrophoneUsageDescription, NSPhotoLibraryUsageDescription, NSPhotoLibraryAddUsageDescription
    │   ├── Main.storyboard
    │   ├── LaunchScreen.storyboard
    │   ├── Assets.xcassets/
    │   ├── capacitor.config.json                   Auto-mirrored from capacitor.config.ts
    │   └── public/                                  Auto-mirrored from /dist
    └── Pods/                                        Only if CocoaPods (gitignored)
```

---

## Dependencies of note

From `package.json`. The codebase is dependency-heavy — most things Phase 2 needs are already present.

**Already there, will reuse:**
- `embla-carousel-react@8.3` → Reels vertical swiper.
- `framer-motion@12.23` → Shutter button animations, heart pop on double-tap-like.
- `lottie-react`, `@lottiefiles/dotlottie-react` → Empty-state animations.
- `@tanstack/react-query@5.56` + `@tanstack/react-query-persist-client` → All server data.
- `@radix-ui/react-dialog` → NativeCameraSheet base.
- `vaul@0.9` → Drawer primitive (alternative to Dialog if it looks cleaner).
- `sonner` → Toasts.
- `uuid` → Reel slide keys, etc.

**Already there, NOT used in Phase 2:**
- `socket.io`, `socket.io-client` → Possibly Phase 3 (Live).  Don't reuse for Reels.
- `express`, `body-parser`, `cors`, `axios` → Likely legacy / dev-server-only.  Investigate Day 1 and remove if unused.
- `@lovable.dev/cloud-auth-js` → Lovable's auth.  Quarantine alongside `src/integrations/lovable/`.
- `lovable-tagger` (devDep) → Strip Day 1 (pollutes diffs with `data-lov-id` attrs).

**Adding in Phase 2:**
- `@capgo/camera-preview@^8.1.4` — the camera plugin.
- `@capgo/capacitor-uploader@^8` — optional, for direct S3-presigned-URL uploads.  Decide Day 1 spike whether to use it.

**Upgrading on Day 1 (Cap 7 → Cap 8):**
- `@capacitor/android` 7→8
- `@capacitor/app` 7→8
- `@capacitor/browser` 8 (already)
- `@capacitor/cli` 7→8
- `@capacitor/core` 7→8
- `@capacitor/haptics` 8 (already)
- `@capacitor/keyboard` 8 (already)
- `@capacitor/network` 8 (already)
- `@capacitor/preferences` 8 (already)
- `@capacitor/push-notifications` 8 (already)
- `@capacitor/splash-screen` 8 (already)
- `@capacitor/status-bar` 7→8

The migration is mostly version bumps; see `docs/05_CAPACITOR_8_NOTES.md` for the breaking changes that actually affect us.

---

## Files you'll touch most often, in Phase 2

In order of how many times you'll open each file across the 4-week sprint:

1. `src/pages/UploadPage.tsx` — the camera entry point gets added here.
2. `src/components/Layout.tsx` — bottom nav reshuffle + camera FAB.
3. `src/hooks/useNativeCamera.ts` — new file, you'll iterate on this.
4. `src/components/camera/NativeCameraSheet.tsx` — new file, Week 2.
5. `src/pages/ReelsPage.tsx` — new file, Week 3.
6. `src/components/reels/ReelSlide.tsx` — new file, Week 3.
7. `src/hooks/useReels.ts` — new file, Week 3.
8. `supabase/migrations/<new>_phase2_camera_reels.sql` — write once Day 3, edit if RLS issues.
9. `android/app/src/main/AndroidManifest.xml` — once Day 1.
10. `ios/App/App/Info.plist` — once Day 1 (after `cap add ios`).
11. `capacitor.config.ts` — once Day 1 (bundle ID change).
12. `package.json` — Day 1 (Cap 8 upgrade + new deps).

Everything else gets touched once or twice across the sprint.

---

**Next:** `docs/02_DATA_MODEL.md` for the schema additions and the critical backfill SQL.
