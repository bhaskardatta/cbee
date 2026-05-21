# cbee — Pet Social App (Phase 2)

A short-form vertical-video social app for pet owners. Built on Capacitor 8 so the same React codebase ships as native Android and iOS apps plus a web build.

> **Status:** Phase 2 — Weeks 1, 2, and 3 complete (foundation, native camera UI, vertical Reels feed with view tracking + moderation). Week 4 (final QA + signed release) is the remaining work. See [STATUS.md](STATUS.md) for the full live picture.

---

## Highlights

- **Vertical Reels feed** with native HTML5 video, Embla vertical carousel, 3-slide mount window (OOM-safe on low-end Android), 1.5 s dwell view-tracking, tap-to-mute / double-tap-to-like / long-press-to-pause gestures, comments drawer.
- **Instagram-style inline auto-play** on the home feed. Tap a video → opens the immersive `/reels` view at that exact reel (`?startId=` deep-link).
- **In-app camera capture** via `@capgo/camera-preview`: photo + 60 s video with gridlines (off / thirds / 1:1 / 4:5 / 9:16), flash, flip, pinch-zoom, tap-to-focus.
- **Direct R2 uploads** for media (Cloudflare R2 via SigV4-signed PUT URLs minted by a Supabase Edge Function). Zero egress cost vs. Supabase Storage.
- **Auth**: Google OAuth + email signup/login. Auto-confirm trigger on `auth.users` means signup → immediate session, no email required for now.
- **Moderation MVP**: 7-reason report flow with unique-constraint dedup. RLS hides own-posts from the report menu.

---

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui (Radix-based) |
| State / data | TanStack Query (`react-query`) with persistent localStorage cache |
| Mobile shell | Capacitor 8 (Android + iOS) |
| Native camera | `@capgo/camera-preview@8.3.7` |
| Carousel | `embla-carousel-react@8` (vertical mode for Reels) |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Media storage | Cloudflare R2 (`media.cbee.online`) via signed PUT URLs |
| Animations | Framer Motion + Lottie |

---

## Project structure

```
.
├── android/                       Capacitor Android shell (Gradle, Kotlin)
├── ios/                           Capacitor iOS shell (Xcode, CocoaPods)
├── public/                        Static assets served by Vite
├── src/
│   ├── App.tsx                    Routes + providers
│   ├── main.tsx                   Entry; OAuth deep-link handler
│   ├── pages/                     Route components (HomePage, ReelsPage, …)
│   ├── components/
│   │   ├── camera/                Native camera sheet, gridlines, shutter
│   │   ├── reels/                 Reels feed, slide, overlay, progress bar
│   │   ├── ui/                    shadcn primitives
│   │   ├── PostCard.tsx           Home-feed card (photo + InlineFeedVideo)
│   │   ├── InlineFeedVideo.tsx    Instagram-style autoplay-on-visible video
│   │   ├── ReportButton.tsx       Three-dot menu trigger
│   │   ├── ReportDialog.tsx       7-reason report modal
│   │   └── …
│   ├── hooks/
│   │   ├── useReels.ts            Keyset-paginated reels feed
│   │   ├── useReelView.ts         1.5 s dwell → reel_views insert
│   │   ├── useNetwork.ts          wifi / cellular / none status
│   │   ├── useReport.ts           Report mutation
│   │   ├── useNativeCamera.ts     @capgo/camera-preview wrapper
│   │   ├── useMediaUpload.ts      R2 signed URL → PUT, Supabase fallback
│   │   └── …
│   ├── contexts/AuthContext.tsx
│   ├── integrations/supabase/     Generated client + types
│   ├── lib/media.ts               Video / image probing + thumbnail
│   └── index.css                  Tailwind + camera-active transparency cascade
├── supabase/
│   ├── functions/
│   │   ├── get-upload-url/        R2 SigV4-signed PUT URL minter
│   │   ├── initiate-payment/      Razorpay donation flow
│   │   ├── payment-callback/      Razorpay webhook
│   │   ├── payment-status/        Donation status poller
│   │   ├── register-push/         Web push subscription
│   │   ├── send-push/             FCM/APNs sender (deferred until google-services.json)
│   │   └── send-donation-notification/
│   └── migrations/                Schema (RLS, triggers, reports, reel_views, …)
├── project_docs/                  Sprint plan, ADRs, gotchas, feature specs
├── capacitor.config.ts
├── STATUS.md                      Live status / what's verified
├── WEEK1_STATUS.md                Historical: Week 1 sign-off
└── MOBILE_SAFE_AREAS.md           Insets / nav-bar gotchas
```

---

## Quickstart

### Prerequisites

- Node 18+ and npm
- For Android builds: JDK 21, Android Studio + SDK 35
- For iOS builds: Xcode 16+, CocoaPods (`brew install cocoapods`), Ruby 3+

### Install

```bash
git clone git@github.com:bhaskardatta/cbee.git
cd cbee
npm install
cp .env.example .env
# fill in VITE_SUPABASE_PUBLISHABLE_KEY (anon key from Supabase dashboard → Project Settings → API)
```

### Run the web dev server

```bash
npm run dev          # http://localhost:8080
```

### Build the web bundle (used by Capacitor sync)

```bash
npm run build        # outputs to dist/
```

### Sync to native shells

```bash
npx cap sync android
npx cap sync ios
```

### Build + run Android (emulator or USB-connected device)

```bash
# Build the debug APK
cd android
JAVA_HOME=$(/usr/libexec/java_home -v 21) bash gradlew assembleDebug --no-daemon

# Install on the first connected device / emulator
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Launch
adb shell am start -n app.cbee.online/.MainActivity
```

### Build + run iOS (simulator)

```bash
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath ./build CODE_SIGNING_ALLOWED=NO build

xcrun simctl install booted ./build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted app.cbee.online
```

---

## Required dashboard configuration

Some pieces of infra are deliberately outside the repo. Set these up once per project:

### 1. Supabase Edge Function secrets (`get-upload-url`)

The R2 credentials must be set in **Project Settings → Edge Functions → Secrets** in the Supabase dashboard:

| Key | Value |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account ID (32 hex chars) |
| `R2_ACCESS_KEY_ID` | R2 API token Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API token Secret Access Key |
| `R2_BUCKET` | `cbee-media` |
| `R2_PUBLIC_HOST` | `media.cbee.online` |

Until those are set, the function returns `500 "R2 secrets not configured"` and the client transparently falls back to Supabase Storage uploads. See [supabase/functions/get-upload-url/index.ts](supabase/functions/get-upload-url/index.ts) for the contract.

### 2. Cloudflare R2

- Bucket `cbee-media` in APAC, Standard storage class.
- CORS allows `capacitor://localhost`, `https://localhost`, `http://localhost`, `https://cbee.online`, `https://app.cbee.online`, `http://localhost:8080` for `PUT, GET, HEAD`.
- Public domain `media.cbee.online` connected to the bucket (CNAME via Cloudflare zone).
- One R2 API token (Object R/W, scoped to `cbee-media`).

The detailed walkthrough lives in [`project_docs/cbee_phase2_docs/welcome_pack/cloudflare_setup.md`](project_docs/cbee_phase2_docs/welcome_pack/cloudflare_setup.md).

### 3. Google OAuth client

In the Supabase dashboard → Authentication → Providers → Google, set the OAuth client ID + secret. Then in Authentication → URL Configuration, the **Redirect URLs** allowlist must include:

- `app.cbee.online://callback` (native deep link)
- `https://cbee.online/**`
- `https://app.cbee.online/**`
- `http://localhost:8080/**` (dev)

### 4. Android Firebase (optional — for push notifications)

Push notifications are **gated off** on Android until a real Firebase project is wired up — `src/hooks/useNativePush.ts` short-circuits the FCM registration call. To enable:

1. Create a Firebase project, add an Android app with bundle ID `app.cbee.online`.
2. Download `google-services.json` and place it in `android/app/`.
3. Remove the Android short-circuit at the top of [`src/hooks/useNativePush.ts`](src/hooks/useNativePush.ts).

---

## Database schema

11 tables under `public`, all with RLS enabled.

| Table | Purpose |
|---|---|
| `profiles` | Username, avatar, full name (1:1 with `auth.users`) |
| `posts` | Photo / video posts; Phase 2 adds `media_kind`, `duration_seconds`, `thumbnail_url`, `is_featured`, `view_count` |
| `likes` | Heart relationship (denormalized count on `posts.likes_count`) |
| `comments` | Threaded comments on posts |
| `follows` | Follower graph |
| `messages` | Direct messages (Phase 1) |
| `pets` | Pet profiles (Phase 1) |
| `search_history` | Per-user search cache |
| `device_tokens` | Push device tokens (FCM / APNs) |
| `reel_views` | Per-user-per-reel view records; trigger increments `posts.view_count` |
| `reports` | 7-reason moderation reports; `UNIQUE (reporter_id, post_id)` |

Notable triggers:

- `auto_confirm_new_user_trigger` on `auth.users` — auto-sets `email_confirmed_at` on signup. Drop and wire real SMTP when going to production.
- `on_auth_user_created` → `handle_new_user` — auto-creates a `profiles` row from `raw_user_meta_data`.
- `reel_views` insert → increments `posts.view_count`.
- `posts.type` ↔ `posts.media_kind` keep in sync.

---

## Auth flow

Implicit OAuth + custom deep-link handler (because Capacitor's WebView post-deep-link fetch can flake during the first call). See `src/main.tsx`:

1. User taps "Continue with Google" → `signInWithOAuth({ skipBrowserRedirect: true })` opens the system browser.
2. Google redirects to `app.cbee.online://callback#access_token=…&refresh_token=…`.
3. `CapacitorApp.addListener('appUrlOpen', …)` in `src/main.tsx` catches the deep link, closes the in-app browser, calls `supabase.auth.setSession(...)`.
4. If `setSession()` fails (transient post-deep-link fetch issue), we fall back to decoding the JWT and persisting the session straight into `localStorage`. AuthContext picks it up on the next render.

Result: a single auth round-trip that's robust to network flakes on real Android devices.

---

## What's verified vs. what's left

See [STATUS.md](STATUS.md) for the full table. Highlights:

✅ Auth (Google + email signup auto-confirm + email login)
✅ Camera UI (sheet, gridlines, shutter, photo + 60 s video) — code-verified, **needs physical-device retest after the Week 3 fix-pass**
✅ Gallery upload (with conservative defaults if probe fails)
✅ R2 upload pipeline (end-to-end via curl; pending dashboard env vars on a fresh project)
✅ Reels feed: pagination, mount window, gestures, view tracking, comments drawer
✅ Report flow (5 API scenarios all pass)
✅ Home-feed inline autoplay + tap-to-reels
🟡 Week 4: device matrix QA, signed Android AAB, Xcode archive + `.ipa`, training videos
⏭️ Push notifications on Android — waiting on Firebase project

---

## License

Private / proprietary — © cbee, all rights reserved.
