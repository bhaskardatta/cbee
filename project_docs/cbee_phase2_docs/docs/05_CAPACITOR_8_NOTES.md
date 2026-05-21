# 05 — Capacitor 8 Notes

**The Cap 7→8 upgrade is a Day-1 activity.** Most of it is version bumps and a few config touches. This doc is the exact playbook plus the breaking changes that actually affect cbee.

---

## Why we're on Cap 8

Cap 8 was released December 2025. Cap 7 is in security-only support. For a new build with a 4-week budget, staying on Cap 7 means:
- Missing the native `setGridMode` API in `@capgo/camera-preview` v8 (Cap 7 fork doesn't have it)
- Future bumps to Cap 8 cost more later than now
- Shipping on a near-deprecated runtime at handoff

See `docs/03_DECISIONS.md` ADR-001 for the full decision.

---

## What's in scope for Day 1

In order:

1. Verify Node 22+ is installed locally
2. Bump all `@capacitor/*` packages to v8
3. Bump `@capacitor/cli` to v8
4. Run `npx cap sync`
5. Fix the breaking changes listed below
6. Run on Android emulator/device — verify no regression
7. Then proceed to bundle ID rename + iOS bootstrap

If steps 1-7 take more than 1 day, escalate. Cap migrations are usually under a day for a project this size.

---

## Step 1: Node 22+

Cap 8 requires Node 22 or higher. Check:

```bash
node -v
# Need v22.x.x or higher
```

If you're on Node 18 or 20, upgrade via nvm:
```bash
nvm install 22
nvm use 22
nvm alias default 22
```

After upgrading, blow away `node_modules` to be safe:
```bash
rm -rf node_modules package-lock.json
npm install
```

(If using Bun: `rm -rf node_modules bun.lockb && bun install`.)

---

## Step 2-4: Bump Capacitor packages

```bash
npm install \
  @capacitor/core@^8 \
  @capacitor/cli@^8 \
  @capacitor/android@^8 \
  @capacitor/app@^8 \
  @capacitor/browser@^8 \
  @capacitor/haptics@^8 \
  @capacitor/keyboard@^8 \
  @capacitor/network@^8 \
  @capacitor/preferences@^8 \
  @capacitor/push-notifications@^8 \
  @capacitor/splash-screen@^8 \
  @capacitor/status-bar@^8
```

Then:
```bash
npx cap sync
```

If `cap sync` errors, read the error carefully — Cap 8 added stricter checks for things like missing required plugin fields. Fix as needed.

---

## Step 5: Breaking changes that affect cbee

The official Cap 7→8 migration guide (`https://capacitorjs.com/docs/updating/8-0`) lists ~10 breaking changes. Of those, these are the ones that affect cbee:

### 5a. Android edge-to-edge is mandatory

**The change:** Cap 8 removes the `android.adjustMarginsForEdgeToEdge` config option. The new model: views draw under system bars by default; opt out per-element with `env(safe-area-inset-*)` CSS.

**What to do:**

Open `MOBILE_SAFE_AREAS.md` at the repo root. Whatever logic is currently there for status bar and navigation bar padding needs to use CSS environment variables.

If your current bottom nav looks like:
```jsx
<div className="fixed bottom-0 w-full pb-4">…</div>
```
…it should become:
```jsx
<div className="fixed bottom-0 w-full pb-[max(env(safe-area-inset-bottom),1rem)]">…</div>
```

Similarly for status bar:
```jsx
<header className="pt-[env(safe-area-inset-top)]">…</header>
```

**Test on:**
- Pixel 7 (gesture nav, no nav bar — `safe-area-inset-bottom` is small)
- Samsung A55 (some users have 3-button nav — `safe-area-inset-bottom` is larger)
- Older Android with notch (Redmi 12) — `safe-area-inset-top` includes notch height

### 5b. `appendUserAgent` whitespace bug fixed on iOS

**The change:** Previously, iOS appended two extra whitespaces before the UA suffix. Now fixed.

**What to do:** Probably nothing. We don't customize the user agent. If you ever depended on the buggy whitespace (you didn't), add an extra space to `ios.appendUserAgent`.

### 5c. New `System Bars` core plugin

**The change:** Cap 8 introduces a new System Bars plugin that handles the old `StatusBar.overlaysWebView` behavior plus edge-to-edge consistently across platforms.

**What to do:** Our current `src/components/StatusBarConfig.tsx` uses `@capacitor/status-bar`. That still works in Cap 8 (no rip-and-replace required). But if we hit edge-cases, the System Bars plugin is the modern path. Document and revisit Phase 3.

### 5d. iOS Package Management default = Swift Package Manager

**The change:** New `ios/` projects from `npx cap add ios` use SPM by default. Most community plugins are CocoaPods-only.

**What to do:** When bootstrapping iOS, force CocoaPods:

```bash
npx cap add ios --packagemanager Cocoapods
```

If you already ran `npx cap add ios` with the default SPM, the simplest fix is `rm -rf ios && npx cap add ios --packagemanager Cocoapods`. SPM-to-Pods conversion of an already-initialized project is fragile.

### 5e. Node 18 support dropped (already covered in Step 1)

Cap 8 dropped Node 18 (Active LTS ended Oct 2023). Node 22 is the new floor.

---

## Step 6: Verify the upgrade on Android

After steps 1-5:

```bash
npm run build
npx cap sync android
npx cap run android
```

You should get a working app on the emulator or connected device. Smoke-test:

- App launches without crash
- Login / OAuth deep link still works (`app.cbee.in://callback` after bundle ID rename, or `app.netlify.cbee://callback` if you haven't done that yet on Day 1)
- Push notifications still register (regression test — see `useNativePush.ts`)
- Status bar style is correct on home screen
- Bottom nav doesn't overlap with system gesture area

If anything is broken, fix before proceeding to iOS bootstrap.

---

## Step 7: Then bundle ID rename + iOS bootstrap

After Cap 8 is working on Android, proceed to:
- Bundle ID rename `app.netlify.cbee` → `app.cbee.in` (see `docs/build/ios_setup.md`)
- `npx cap add ios --packagemanager Cocoapods`
- iOS configuration (see `docs/build/ios_setup.md`)

These are documented separately so they can be tackled in sequence without conflating.

---

## Things to NOT touch during the upgrade

Resist the temptation to "while I'm in here, let me also..." Things to leave alone:

- **TypeScript version.** Cap 8 doesn't require a TS bump; the current 5.9 is fine.
- **Vite version.** Cap 8 doesn't care; current Vite 7 is fine.
- **React version.** Cap 8 doesn't care; React 18.3 is fine.
- **Tailwind version.** Independent of Cap.
- **shadcn/ui components.** Independent of Cap.

If you upgrade Cap 8 AND any of these simultaneously, you'll spend an hour figuring out which one broke things.

---

## Verifying you're actually on Cap 8

```bash
npx cap --version
# Should output: 8.x.x

cat node_modules/@capacitor/core/package.json | grep version
# Should show: "version": "8.x.x"
```

If `package.json` shows `^8` but `node_modules` shows `7.x`, you have a stale install. Remove and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Reference

- Cap 8 release announcement: https://ionic.io/blog/announcing-capacitor-8
- Official Cap 7→8 migration guide: https://capacitorjs.com/docs/updating/8-0
- `@capgo/camera-preview` Cap 8 compat: https://github.com/Cap-go/capacitor-camera-preview (we use v8.x for Cap 8)

---

**Next:** `docs/build/dev_environment.md` for the rest of the local setup, or jump straight to `docs/features/camera.md` if your environment is already configured.
