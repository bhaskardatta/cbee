# 04 — Gotchas

**The quirks log.** Things you'll trip over that aren't in any official doc. Update this file every time you spend more than 30 minutes on something weird; future-you (and the AI IDE) will thank you.

Read this once on Day 1, skim once a week, dive in when a bug doesn't make sense.

---

## Capacitor 8 / WebView gotchas

### G-1. iOS WebView treats `file://` URIs as opaque

`@capgo/camera-preview` returns video paths like `file:///var/mobile/Containers/Data/Application/.../tmp/video.mp4`. Loading that into a `<video src=...>` element directly **fails silently** on iOS. The WebView doesn't have permission.

**Fix:** Always wrap with `Capacitor.convertFileSrc(path)`:

```ts
import { Capacitor } from '@capacitor/core';
const playableUrl = Capacitor.convertFileSrc(filePath);
videoElement.src = playableUrl;
```

This translates `file://` to `capacitor://localhost/_capacitor_file_/...` which the WebView is allowed to load.

### G-2. Android 14 / 15 photo picker permission shift

`READ_EXTERNAL_STORAGE` is deprecated in Android 13+. Use:
```xml
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
```

The `@capgo/camera-preview` plugin handles its own runtime permission prompts — these manifest entries are just declarations.

### G-3. iOS audio session collision between `<video>` autoplay and camera record

If a `<video>` is playing on the Reels page and the user opens the camera to record, iOS's `AVAudioSession` enters a contention state and the recording can come out with zero audio (no error thrown).

**Fix:** Before opening `NativeCameraSheet`, explicitly tear down all video elements:

```ts
document.querySelectorAll('video').forEach(v => {
  v.pause();
  v.src = '';
  v.removeAttribute('src');
  v.load();
});
```

Pause alone is not enough. iOS 16+ holds the session active until the src is cleared.

### G-4. Cap 8 Android edge-to-edge changes safe-area math

Cap 8 removed `android.adjustMarginsForEdgeToEdge`. The new model: views draw under system bars by default; you add `env(safe-area-inset-*)` CSS variables to opt out.

**Migration step (Day 1):**
- Open `MOBILE_SAFE_AREAS.md` at repo root.
- Find any references to `adjustMarginsForEdgeToEdge` — remove.
- Audit any `padding-top`/`padding-bottom` that was previously hard-coded for status bar / nav bar height. Replace with `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` Tailwind arbitrary properties: `pt-[env(safe-area-inset-top)]`, `pb-[env(safe-area-inset-bottom)]`.

### G-5. iOS SPM default in Cap 8 breaks CocoaPods-only plugins

Cap 8 defaults new iOS projects to Swift Package Manager. Most Capacitor community plugins are still CocoaPods-only.

**Fix:** When running `npx cap add ios`, opt into CocoaPods explicitly:
```bash
npx cap add ios --packagemanager Cocoapods
```

If you forget and SPM is initialized, you can convert back, but it's messy. Easier to delete `ios/` and re-run.

### G-6. The Capacitor bridge has a base64 size cliff

Sending strings >5MB across the Capacitor JS↔native bridge is slow (~500ms+) and OOM-prone on low-end Android.

**Fix:** For images and especially videos, use `storeToFile: true` when calling `CameraPreview.capture()` / `startRecordVideo()`. You get back a file path instead of base64. Use `getBase64FromFilePath()` only when you absolutely need base64 (and even then, do it lazily).

### G-7. Push notifications break after Cap upgrade unless re-wired on iOS

When you run `npx cap add ios` for the first time, push notifications are NOT auto-configured. You need:
- Add "Push Notifications" capability in Xcode → Signing & Capabilities
- Add Background Modes capability with "Remote notifications" checked
- AppDelegate.swift needs the APNs registration callbacks (Cap 8's plugin docs show the exact code)
- An APNs auth key (.p8) generated in Apple Developer portal, uploaded to Supabase Auth → Settings → Phone (well, push) provider

Budget half a day in Week 4 for iOS push QA. See `docs/build/ios_setup.md`.

### G-8. Capacitor live-reload eats the back button on Android during dev

When running `npx cap run android --livereload`, the WebView loads from your dev server (e.g. `http://192.168.x.x:5173`), and `useAndroidBackHandler` sometimes loses its handler reference. The back button kills the app instead of navigating back.

**Workaround:** Restart the app (don't reload). The handler attaches correctly on cold launch.

---

## Supabase gotchas

### G-9. RLS-empty-result is silent

If your RLS policy denies a SELECT, the query returns an empty array, not an error. You think the table is empty. It's not.

**Fix:** When a Supabase query returns `[]` and you expect rows:
1. Check `.error` first — sometimes the error IS there and you missed it.
2. Test the same query in Supabase Studio with the `auth.uid()` set to a real user via the "Run as" feature.
3. If Studio shows rows but the app doesn't, the policy is wrong.

### G-10. `auth.uid()` is NULL in policies if the request is unauthenticated

Especially in storage RLS: if your storage policy uses `auth.uid()::text` and the user is browsing without auth, `auth.uid()` is NULL, NULL::text is NULL, and the policy returns NULL (which is falsy). Looks like a deny, but it's a "no auth" silent fail.

**Fix:** For storage buckets that need ANY public access (like our `messages` bucket for chat attachment reads), the SELECT policy must not reference `auth.uid()`. Use only `bucket_id = '<name>'` as the condition. (Phase 2 media doesn't have this concern since it lives in Cloudflare R2, not Supabase Storage — see ADR-017.)

### G-11. Migrations applied via Studio don't auto-create a file in the repo

If you copy-paste SQL into the Supabase Studio SQL Editor and run it, the change is live in production, but there's no corresponding file under `supabase/migrations/`. Future `supabase db reset` will leave production in a state the repo doesn't describe.

**Discipline:** Every SQL change MUST land in a `supabase/migrations/<timestamp>_<name>.sql` file, even if you applied it via Studio first. The timestamp in the filename should match when you applied it.

### G-12. Edge functions can't see secrets you set in `.env`

Local `.env` is for Vite (client-side). Edge functions read from `Deno.env.get(...)` and need secrets set via the Supabase CLI:
```bash
supabase secrets set SOME_SECRET=foo
```
Or in the Studio: Project Settings → Edge Functions → Secrets.

### G-13. Realtime subscriptions DO cost connections, even idle

If you ever wire up `supabase.channel(...).on('postgres_changes', ...)`, each open subscription is a connection on the Supabase project. The Free tier has 200, Pro has 500. For cbee's scale this isn't a problem yet, but don't fan out per-user subscriptions to every chat — use a single channel with filters server-side.

### G-14. Supabase Storage CDN cache invalidation is best-effort

If you upload a file with the same path as a previous one (e.g. avatar.jpg in a user's folder), the public URL returns the old version for up to ~10 minutes from CDN caches.

**Workaround:** New uploads always use a unique filename (e.g. `<timestamp>.<ext>`). The existing `useMediaUpload` does this; don't change the pattern.

---

## Lovable-isms left over

### G-15. `lovable-tagger` adds `data-lov-id` to every JSX node

If you see PR diffs polluted with `data-lov-id="..."` attributes on every component, `lovable-tagger` is back in the build. Strip it from `devDependencies` and from `vite.config.ts`.

### G-16. `@lovable.dev/cloud-auth-js` is in deps but probably unused

The codebase uses Supabase Auth, not Lovable's auth. Day 1, grep for `@lovable.dev/cloud-auth-js` and `lovable/cloud-auth`:
```bash
grep -rn "lovable.dev/cloud-auth\|@lovable.dev" src/
```
If no production imports, remove the dep. If something imports it, quarantine and replace with Supabase Auth.

### G-17. The README.md is auto-generated by Lovable

The current `README.md` is the boilerplate Lovable generates for every project. Replace with a hand-written one at handoff. Don't waste effort polishing it mid-sprint.

### G-18. Lovable project ID in the repo metadata

The README references `https://lovable.dev/projects/d0b97d9e-a95c-4878-b70e-88a50a54a394`. That's the Lovable project. After we disconnect, this URL still works for Swaroop if he wants to re-open in Lovable later. Don't remove it from history; do remove it from the new handoff README.

---

## Bandwidth & cost gotchas

### G-19. Egress is on Cloudflare R2 — free at any scale (NOT Supabase Storage)

This used to be the gotcha that would have eaten Swaroop alive. Phase 2 architecture (ADR-017) moves all media to Cloudflare R2 where egress is free, eliminating the issue entirely.

Watch out for two things:
- **R2 Class B read ops are billed** at $0.36/million. At 10,000 DAU with ~47 reads/day each, that's ~14M reads/month = $5. Totally fine.
- **Don't accidentally re-introduce Supabase Storage** for posts content. The chat `messages` bucket stays as-is (Phase 1 legacy), but new post media must go to R2. If you see `supabase.storage.from('posts-media')` anywhere in new code, that's wrong — should be `useMediaUpload` which routes to R2 via the edge function.

For the full cost picture and monitoring procedure, see `docs/operations/cost_model.md`.

### G-20. Video bitrate cap — the single most impactful cost decision

The capgo camera plugin defaults to whatever the device's native encoder produces, often 6-8 Mbps at 1080p. Always pass `videoBitrate: 3500000` (3.5 Mbps) explicitly in `startRecordVideo()`. Same visual quality on a phone screen, 40% fewer bytes for life.

Set this in `useNativeCamera.ts` and document why in the inline comment. If anyone removes it, the lifetime bandwidth bill for cbee jumps ~40% with no quality gain.

---

## React / Vite / TS gotchas

### G-21. TanStack Query persister can serialize stale data forever

The query cache is persisted to `localStorage` via `createSyncStoragePersister` in `App.tsx`. The `buster: 'v1'` string is the invalidation knob: change it to `'v2'` if Phase 2 schema changes cause stale-cache rendering issues.

**Specifically:** When `media_kind` / `media_aspect_ratio` columns are added to posts, the old cached posts in localStorage don't have those fields. If components assume they exist, they'll crash on first render before the network fetch resolves.

**Fix:** Either (a) bump `buster` to `'v2'` in Week 1, OR (b) write components defensively (`post.media_kind ?? 'image'`).

### G-22. Lazy-loaded routes show a blank screen for the first ~200ms

`React.lazy` + `Suspense fallback={null}` means routes show nothing while their chunk loads. On a 3G connection this can be 1-2 seconds.

**Already mitigated:** `HomePage` is NOT lazy-loaded (eager import in `App.tsx`). Don't change that.

**For Reels:** lazy-load is fine (no one cold-launches into Reels), but consider a skeleton fallback instead of `null` to avoid the flash.

### G-23. SWC plugin + Vite 7 + Bun lockfile = occasional dev-server hot-reload glitches

Symptom: Save a TSX file, dev server doesn't update, browser hangs on the old version. Logs show no error.

**Fix:** Stop the dev server, `rm -rf node_modules/.vite`, restart. Happens ~once per day.

---

## Git / workflow gotchas

### G-24. The repo has both `bun.lockb` AND `package-lock.json`

Pick one and stick with it for the sprint. Recommendation: **npm**, because the Capacitor docs assume npm and most plugin install guides use it. Delete `bun.lockb` Day 1 if going with npm, or delete `package-lock.json` if going with Bun.

(Keeping both means whichever package manager you used last is the source of truth, and they can drift.)

### G-25. iOS folder = lots of generated files, gitignore carefully

After `npx cap add ios`, the `ios/` folder has ~50MB of stuff. Most of it should be committed (Xcode project files, Podfile.lock, Swift sources). But:
- `ios/App/App/public/` is auto-mirrored from `dist/` — gitignore it.
- `ios/Pods/` (if using CocoaPods) — gitignore.
- `ios/build/` — gitignore.
- `*.xcuserdata` — gitignore (per-user Xcode preferences).

The Capacitor CLI's auto-generated `.gitignore` inside `ios/` handles most of this.

---

## When you hit a NEW gotcha

Add it here. Format:

```markdown
### G-NN. <One-line title>

<2-3 sentences describing the symptom and the fix.>

**Fix:** <The actual fix, code or commands.>
```

Don't bother explaining context past what future-you needs to grok the issue quickly. This is a log, not a tutorial.

---

**Next:** `docs/05_CAPACITOR_8_NOTES.md` for the Cap 8 upgrade walkthrough specifically.
