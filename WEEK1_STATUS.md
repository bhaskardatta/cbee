# Week 1 Status — cbee Phase 2 Foundation

**Date:** 2026-05-13
**Build status:** ✅ TypeScript clean, `npm run build` green, `cap sync android` green, iOS pod install pending Xcode.

---

## What shipped (code-side, ready to test)

### Capacitor 8 upgrade
- All `@capacitor/*` packages on `^8.x`. New: `@capacitor/ios@8.3.4`, `@capacitor/filesystem@8.1.2`.
- `@capgo/camera-preview@8.3.7` installed and registered at app boot ([src/main.tsx:5](src/main.tsx)).
- `lovable-tagger` removed from devDeps; `componentTagger()` stripped from [vite.config.ts](vite.config.ts).

### Bundle ID rename → `app.cbee.in`
- [capacitor.config.ts](capacitor.config.ts) — `appId`
- [android/app/build.gradle](android/app/build.gradle) — `namespace`, `applicationId`
- [android/app/src/main/java/app/cbee/in/MainActivity.java](android/app/src/main/java/app/cbee/in/MainActivity.java) — moved package
- [android/app/src/main/AndroidManifest.xml](android/app/src/main/AndroidManifest.xml) — OAuth `app.cbee.in://callback` deep-link intent-filter
- [android/app/src/main/res/values/strings.xml](android/app/src/main/res/values/strings.xml) — `package_name`, `custom_url_scheme`
- [src/main.tsx](src/main.tsx) — OAuth handler matches new scheme + legacy (Phase 1 installs may still emit old scheme)
- [src/pages/LoginPage.tsx](src/pages/LoginPage.tsx) + [src/pages/SignupPage.tsx](src/pages/SignupPage.tsx) — `redirectUrl`
- [ios/App/App/Info.plist](ios/App/App/Info.plist) — `CFBundleURLTypes` for `cbee` + `app.cbee.in` schemes

### Android camera permissions
- [AndroidManifest.xml](android/app/src/main/AndroidManifest.xml): CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, READ_MEDIA_IMAGES, READ_MEDIA_VIDEO
- `uses-feature` declarations marked `required="false"` so the app installs on tablets without rear cameras

### iOS Info.plist usage strings
- [ios/App/App/Info.plist](ios/App/App/Info.plist): NSCameraUsageDescription, NSMicrophoneUsageDescription, NSPhotoLibraryUsageDescription, NSPhotoLibraryAddUsageDescription

### Phase 2 DB migration
- [supabase/migrations/20260513000000_phase2_camera_reels.sql](supabase/migrations/20260513000000_phase2_camera_reels.sql)
- 5 new columns on `posts` (`media_kind`, `media_aspect_ratio`, `duration_seconds`, `thumbnail_url`, `is_featured`, `view_count`)
- **★ Critical backfill** — sets `media_kind='video'` for every existing `type='video'` post. Without this, the Reels feed silently misses every Phase 1 video.
- BEFORE-INSERT/UPDATE trigger keeps `type` and `media_kind` in sync so Phase 1 code writing `type` still works.
- Indexes: `(media_kind, created_at desc)`, `(user_id, created_at desc)`, partial `(is_featured, created_at desc) WHERE is_featured=true`.
- `reel_views` table + 3 RLS policies + view-count increment trigger.
- `reports` table (moderation MVP) + 2 RLS policies + duplicate-prevention unique index.

### React Query cache buster
- [src/App.tsx](src/App.tsx) — `buster: "v2"` (was `v1`). Forces a cache flush so old cached `posts` rows without `media_kind` don't render incorrectly.

### Cloudflare R2 upload pipeline
- [supabase/functions/get-upload-url/index.ts](supabase/functions/get-upload-url/index.ts) — signs 15-min PUT URLs via AWS SigV4, validates JWT, content-type allowlist (image/png|jpeg|webp, video/mp4|quicktime), 10MB image / 60MB video / 1MB thumbnail caps.
- [src/lib/media.ts](src/lib/media.ts) — `getVideoDuration`, `getVideoMetadata`, `getImageMetadata`, `makeVideoThumbnail`, `nearestAspect`. Pure browser primitives.
- [src/hooks/useMediaUpload.ts](src/hooks/useMediaUpload.ts) — `upload(file, kind)` does the R2 signed-PUT flow with XMLHttpRequest progress events; legacy `uploadMedia(file, userId, mediaType)` kept intact for chat (Supabase Storage `messages` bucket stays Phase 1, per ADR-017).
- [src/hooks/useNativeCamera.ts](src/hooks/useNativeCamera.ts) — wraps `@capgo/camera-preview` with permission, preview, photo/video capture, flip/flash/focus/zoom, grid mode. `storeToFile: true` (avoids G-6 base64 cliff), `lockAndroidOrientation: true`, `videoQuality: 'medium'` (closest the plugin exposes to the 3.5 Mbps cost target).

### Lovable disconnect
- `@lovable.dev/cloud-auth-js` uninstalled.
- `src/integrations/lovable/` deleted.
- [LoginPage.tsx](src/pages/LoginPage.tsx) — Google OAuth now goes through `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: isNative }})` and opens the URL in `@capacitor/browser` on native. Same iOS/Android deep-link callback flow as before.

---

## What's blocked / what you (Swaroop or Bhaskar) need to do

| Item | Owner | Blocker |
|---|---|---|
| **Apply migration to staging Supabase** | Bhaskar | Supabase CLI not installed locally (Install: `brew install supabase/tap/supabase`). Or paste SQL into Studio. |
| **Verify backfill counts** | Bhaskar | After applying — run the 4 sanity queries from `project_docs/cbee_phase2_docs/docs/02_DATA_MODEL.md` §"Verifying the backfill worked". |
| **Apply migration to production** | Bhaskar | Gate on staging counts matching. |
| **Regenerate `src/integrations/supabase/types.ts`** | Bhaskar | `supabase gen types typescript --linked > src/integrations/supabase/types.ts` after migration applied. |
| **Cloudflare R2 setup** | Swaroop | Bucket `cbee-media`, API token, `media.cbee.in` CNAME, CORS policy. Walkthrough: [project_docs/cbee_phase2_docs/welcome_pack/cloudflare_setup.md](project_docs/cbee_phase2_docs/welcome_pack/cloudflare_setup.md). |
| **Edge fn secrets** | Bhaskar | `supabase secrets set R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=cbee-media R2_PUBLIC_HOST=media.cbee.in` then `supabase functions deploy get-upload-url` |
| **R2 CORS policy** | Swaroop | Allow `capacitor://localhost`, `http://localhost`, `https://localhost`, `https://cbee.in`, `https://app.cbee.in` for PUT/GET/HEAD. |
| **Supabase OAuth redirect URLs** | Bhaskar | Studio → Auth → URL Configuration → add `app.cbee.in://callback` to Additional Redirect URLs. Keep old `app.netlify.cbee://callback` for 2 weeks. |
| **Install Xcode** | Bhaskar | Required for iOS build/test. ~13 GB App Store download + ~30 GB installed. **Currently blocked: only 19 GB free on this Mac.** Free up ~40 GB or move ~/Downloads etc. before installing. |
| **Install Android Studio + SDK** | Bhaskar | Required to test the Android build on an emulator. ~3-10 GB. |
| **iOS `pod install`** | Bhaskar | After Xcode is installed: `cd ios/App && pod install`. Then `open App.xcworkspace`. |
| **Xcode capabilities** | Bhaskar | App target → Signing & Capabilities → + Capability → Push Notifications. + Background Modes → Remote notifications. |

---

## Disk pressure note

This Mac currently has **19 GB free**. The iOS toolchain alone wants ~40 GB peak (Xcode download + install + simulators + derived data). I would not attempt to install Xcode without first freeing ~50 GB. Suggestion: move `~/Downloads/*.zip`, old `~/Desktop/*` folders, and any unused apps before adding Xcode.

---

## Verification you can do now (no Xcode required)

```bash
# Build verifies code is syntactically + semantically valid
cd /Users/bhaskar/Desktop/cbee-pet-pals
npm run build            # green
npx tsc --noEmit -p tsconfig.app.json   # 0 errors

# Android sync — produces app/src/main/assets ready for AVD
npx cap sync android     # green; 11 plugins detected including camera-preview

# Inspect the iOS scaffold (won't open Xcode but proves the structure)
ls ios/App/App/Info.plist            # should contain the 4 usage strings
cat ios/App/App/Info.plist | grep NSCameraUsageDescription
```

---

## What's next (Week 2 — Days 6-10)

Build the camera UI on top of `useNativeCamera`:
- `NativeCameraSheet.tsx` — full-screen Radix Dialog, transparent body, native preview behind
- `GridlinesOverlay.tsx` — SVG overlay with off / thirds / 1:1 / 4:5 / 9:16 modes
- `ShutterButton.tsx` — tap = photo, hold = video, 60s cap with animated progress ring
- `UploadPage.tsx` edit — "Take Photo or Video" entry point alongside existing gallery picker; video gallery-import duration cap (uses `getVideoDuration` from `src/lib/media`)

CSS rule needed on Day 6 (transparent-WebView trick — see [docs/features/camera.md](project_docs/cbee_phase2_docs/docs/features/camera.md)):

```css
body.camera-active,
body.camera-active #root { background: transparent !important; }
```

The hook already toggles `body.camera-active` on `startPreview` / `stopPreview`.
