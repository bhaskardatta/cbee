# Device Test Matrix

**Which features get tested on which devices.** Phase 2 supports 5 reference devices. QA is manual — no automated test suite (see `docs/03_DECISIONS.md` ADR-015).

---

## Reference devices

| Tier        | Device           | OS                       | RAM    | Test purpose                              |
| ----------- | ---------------- | ------------------------ | ------ | ----------------------------------------- |
| **A. iOS Flagship** | iPhone 13 or 14    | iOS 17 or 18              | 4-6GB  | Apple parity, OAuth, push, signed install |
| **B. Android Flagship** | Google Pixel 7     | Android 14 / 15           | 8GB    | Mid-range hero, 60fps target              |
| **C. Android Mid-range** | Samsung Galaxy A55 | Android 14 / OneUI 6      | 8GB    | Samsung-specific quirks, OneUI nav        |
| **D. Android Low-end** | Xiaomi Redmi 12    | Android 13 / MIUI 14      | 4GB    | Memory pressure, jank floor               |
| **E. Android Emulator** | Pixel 4a (API 30)  | Android 11                | 4GB    | Older Android cheap check                 |

If access to any physical device is unavailable, an Android Studio emulator can sub for the Android ones — but ALL of A through D should be physical for handoff sign-off.

---

## Test mode matrix

✅ = must pass on this tier · ☐ = nice-to-pass · ❌ = not tested · N/A = not applicable

| Feature / Capability                          | A iPhone | B Pixel 7 | C A55 | D Redmi 12 | E Emul |
| --------------------------------------------- | -------- | --------- | ----- | ---------- | ------ |
| App launches without crash                    | ✅       | ✅        | ✅    | ✅         | ✅     |
| Splash screen renders                         | ✅       | ✅        | ✅    | ✅         | ✅     |
| Sign in with email                            | ✅       | ✅        | ✅    | ✅         | ✅     |
| Sign in with Google (OAuth deep link)         | ✅       | ✅        | ✅    | ✅         | ☐      |
| Bottom nav: 5 tabs visible without overflow   | ✅       | ✅        | ✅    | ✅         | ✅     |
| Bottom nav: gesture nav vs 3-button safe area | ✅       | ✅        | ✅    | ✅         | ☐      |
| FAB appears on Home and Search only            | ✅       | ✅        | ✅    | ✅         | ✅     |
| Tap camera FAB opens NativeCameraSheet        | ✅       | ✅        | ✅    | ✅         | ❌     |
| Camera permission prompt shows correct text   | ✅       | ✅        | ✅    | ✅         | N/A    |
| Camera preview renders (transparent body)     | ✅       | ✅        | ✅    | ✅         | N/A    |
| Gridlines toggle cycles through 5 modes       | ✅       | ✅        | ✅    | ✅         | N/A    |
| Front/back camera flip                        | ✅       | ✅        | ✅    | ✅         | N/A    |
| Flash toggle (auto/on/off)                    | ✅       | ✅        | ✅    | ✅         | N/A    |
| Photo capture → preview state populated       | ✅       | ✅        | ✅    | ✅         | N/A    |
| Photo upload completes (≤5MB image)           | ✅       | ✅        | ✅    | ✅         | ☐      |
| Video record up to 60s                        | ✅       | ✅        | ✅    | ✅         | N/A    |
| Video audio is captured (no silent recordings) | ✅      | ✅        | ✅    | ✅         | N/A    |
| Video upload completes (≤30MB video)          | ✅       | ✅        | ✅    | ✅         | ☐      |
| Tap-to-focus visibly works                    | ✅       | ✅        | ✅    | ☐          | N/A    |
| Pinch-to-zoom smoothly transitions             | ✅       | ✅        | ✅    | ☐          | N/A    |
| Gallery import: <60s video accepted           | ✅       | ✅        | ✅    | ✅         | ✅     |
| Gallery import: >60s video rejected w/ toast  | ✅       | ✅        | ✅    | ✅         | ✅     |
| Reels: first reel autoplay <1.5s on WiFi      | ✅       | ✅        | ✅    | ☐ (best effort) | ☐ |
| Reels: cellular preload="none" + tap-to-start | ✅       | ✅        | ✅    | ✅         | N/A    |
| Reels: 60fps swipe                            | ✅       | ✅        | ✅    | ☐          | ☐      |
| Reels: no jank > 200ms                        | ✅       | ✅        | ✅    | ✅         | ☐      |
| Reels: scroll 20 reels, no crash, flat memory | ✅       | ✅        | ✅    | ✅         | ☐      |
| Reels: tap toggles mute                       | ✅       | ✅        | ✅    | ✅         | ✅     |
| Reels: long-press pauses + release resumes    | ✅       | ✅        | ✅    | ✅         | ☐      |
| Reels: double-tap fires heart pop + like      | ✅       | ✅        | ✅    | ✅         | ✅     |
| Reels: comments drawer opens, pauses video    | ✅       | ✅        | ✅    | ✅         | ✅     |
| Reels: empty feed shows Lottie + CTA          | ✅       | ✅        | ✅    | ✅         | ✅     |
| Reel view tracked after 1.5s dwell             | ✅       | ✅        | ✅    | ✅         | ✅     |
| `posts.view_count` increments via trigger      | ✅       | ✅        | ✅    | ✅         | ✅     |
| Report dialog opens from three-dot menu       | ✅       | ✅        | ✅    | ✅         | ✅     |
| Report submit writes row to `reports`         | ✅       | ✅        | ✅    | ✅         | ✅     |
| Duplicate report shows "already reported"     | ✅       | ✅        | ✅    | ✅         | ✅     |
| Push notification received (lock screen)      | ✅       | ✅        | ✅    | ☐          | ☐      |
| Push notification deep-links into app          | ✅       | ✅        | ✅    | ☐          | ☐      |
| Phase 1 regression: feed scrolls + likes work | ✅       | ✅        | ✅    | ✅         | ✅     |
| Phase 1 regression: profile editing works     | ✅       | ✅        | ✅    | ✅         | ✅     |
| Phase 1 regression: messaging works           | ✅       | ✅        | ✅    | ✅         | ✅     |
| Phase 1 regression: donations work            | ✅       | ✅        | ✅    | ☐          | ☐      |
| App background → resume preserves state       | ✅       | ✅        | ✅    | ✅         | ✅     |
| Network drop → OfflineDetector banner shows   | ✅       | ✅        | ✅    | ✅         | ✅     |
| Battery drain reasonable during reels scroll   | ☐       | ☐         | ☐     | ☐          | N/A    |

---

## Acceptance bar

For handoff, ALL ✅ rows must pass on their tiers. Note any ☐ rows that fail; they're acknowledged-known issues, not deal-breakers.

---

## Test cadence

| When                          | What to test                                         |
| ----------------------------- | ---------------------------------------------------- |
| End of every dev day          | Whatever you touched, on whatever device is nearest  |
| End of every week (Fri)       | Full smoke on Pixel 7 + one other device             |
| Week 4, Day 18-19             | Full matrix above, all tiers                         |
| Week 4, Day 20 (handoff day)  | Demo against Acceptance Criteria with Swaroop watching |

---

## Reels memory profiling — how

On Pixel 7 / Redmi 12:

1. Connect device, `adb shell` works
2. Open Android Studio → View → Tool Windows → Profiler
3. Attach to the cbee process (release build)
4. Switch to Memory profiler
5. In the app, scroll through 20 reels quickly
6. Watch Java/Kotlin + Native memory traces — should plateau, not climb

If memory climbs without plateauing, the mount window in `ReelsFeed` isn't working. Verify `mountedIndices` is shrinking as you scroll.

---

## FPS profiling — how

Chrome DevTools remote-debugging:

1. Connect Pixel 7 via USB, enable USB debugging
2. Chrome on desktop → `chrome://inspect`
3. cbee's WebView shows up; click "inspect"
4. DevTools opens. Performance panel → record a 5-second swipe-through
5. Look at the FPS meter in the rendered frames track. Should sit near 60.

For Redmi 12 the target is "no jank > 200ms" — look for any frame longer than 200ms. They'll appear as red bars in the frames track.

---

## How to file a test failure

When a checkbox above fails:

1. Note the device, OS version, app version.
2. Steps to reproduce — be specific.
3. Expected vs actual behavior.
4. Screenshot or screen recording if visual.
5. Logcat snippet if it's a crash (`adb logcat -d > crash.txt`).
6. Capture in a Notion / Linear / GitHub issue with label `phase2-qa`.

These go into the sprint backlog and are triaged daily.

---

**Next:** `docs/handoff/going_live.md` for the submission-to-stores walkthrough.
