# Going Live — From Handoff to App Stores

**This is the 1-pager (well, a few pages) Swaroop reads to take the handoff zip and turn it into apps on the Google Play Store and Apple App Store.** Written in plain language, technical only where it has to be.

Bhaskar and the Spurt team will be reachable during the submission window for questions, but the work below is yours, Swaroop.

---

## What you got from Spurt

At handoff, you received:

1. A signed Android App Bundle (`app-release.aab`) — uploadable to Google Play
2. The Android keystore (`cbee-release.jks` + passwords) — see `keystore_handoff.md`. Guard this with your life.
3. An iOS archive (`cbee-2.0.0.xcarchive`) and exported `.ipa` — uploadable to App Store Connect
4. Two training videos
5. A store-listing kit (descriptions, screenshots, keywords)
6. The Welcome Pack — instructions for setting up your Apple Developer and Google Play Developer accounts (if you haven't already)
7. This document

---

## Realistic timeline

| Step                                                | If accounts ready | If starting from scratch |
| --------------------------------------------------- | ----------------- | ------------------------ |
| Upload to Apple App Store Connect                   | Day 1             | Day 1 of having account  |
| Apple review                                        | 24 hours – 14 days | (same)                  |
| Upload to Google Play Console (internal test)       | Day 1             | Day 1 of having account  |
| Google Play closed-test 14-day wait (personal account) | 14 days        | 14 days                  |
| Production access granted by Google                 | +1-3 days after test | +1-3 days              |

**Worst case from a cold start:** ~28 days from "I want to publish" to "live on both stores." Best case (accounts already active, no review hiccups): ~2-7 days.

**Plan accordingly with any marketing or launch announcement.**

---

## Step 1: Make sure your developer accounts are active

If you haven't set these up yet, **stop here and complete the Welcome Pack first**:

- `welcome_pack/apple_developer_setup.md` — Apple Developer Program ($99/year)
- `welcome_pack/google_play_setup.md` — Google Play Console ($25 one-time)

These accounts must exist before anything else.

---

## Step 2: Upload to Apple App Store Connect

### 2a. App Store Connect — create the app record

1. Go to https://appstoreconnect.apple.com
2. Sign in with your Apple Developer Program account
3. My Apps → blue "+" button → "New App"
4. Fill in:
   - **Platforms:** iOS
   - **Name:** `cbee` (this is the app name shown in the App Store; max 30 chars)
   - **Primary Language:** English (India) or English (U.K.)
   - **Bundle ID:** select `app.cbee.in` from the dropdown (it appears after you create an App ID — see Step 2b below)
   - **SKU:** `cbee-mobile` (any unique string you'll recognize; not user-facing)
   - **User Access:** Full Access
5. Click "Create"

### 2b. Apple Developer Portal — register the App ID (one-time)

If the bundle ID `app.cbee.in` isn't in the dropdown:

1. Go to https://developer.apple.com/account
2. Certificates, Identifiers & Profiles → Identifiers
3. Blue "+" → App IDs → App
4. Description: "cbee"
5. Bundle ID: Explicit → `app.cbee.in`
6. Capabilities — check: Push Notifications, Associated Domains (the rest leave unchecked unless prompted)
7. Continue → Register

Then go back to App Store Connect and the bundle ID should now appear.

### 2c. Upload the build via Transporter (or Xcode)

You have two options:

**Option A: Transporter app (easiest, free from Mac App Store)**
1. Install "Transporter" from the Mac App Store
2. Open Transporter, sign in with your Apple ID
3. Drag the `cbee-2.0.0.ipa` file into the window
4. Click "Deliver"
5. Wait for processing (~10 min). It'll appear in App Store Connect → TestFlight tab.

**Option B: Xcode Organizer (if you have the Mac that built the archive)**
1. Open Xcode → Window → Organizer
2. Select the `cbee-2.0.0` archive
3. Click "Distribute App" → "App Store Connect" → "Upload"
4. Same outcome as Transporter.

### 2d. Fill the App Store listing

Inside App Store Connect → your app → App Information and 1.0 Prepare for Submission tabs:

- **App Name:** cbee
- **Subtitle:** Bangalore's pet parent network (max 30 chars)
- **Category:** Social Networking (Primary), Lifestyle (Secondary)
- **Content Rights:** Does your app contain, show, or access third-party content? → No
- **Age Rating:** Run the questionnaire honestly. cbee likely rates 12+ due to user-generated content.
- **Promotional Text:** (max 170 chars) — see the store-listing kit
- **Description:** (max 4000 chars) — see the store-listing kit
- **Keywords:** (100 chars, comma-separated) — see the store-listing kit
- **Support URL:** must work; put your cbee help page or a Google Sites
- **Marketing URL:** optional
- **Privacy Policy URL:** **required** — see Step 4 below

Upload screenshots from the store-listing kit:
- 6.7" iPhone screenshots (1290 × 2796) — minimum 3, recommended 5

Pricing: Free.

Availability: All countries, or restrict to India initially.

### 2e. App Privacy disclosure (the hardest screen)

Apple requires you to declare every type of data your app collects.

For cbee, you collect (approximately):
- **Contact info:** email, name
- **User content:** photos, videos, audio, posts, comments, messages
- **Identifiers:** user ID, device ID for push
- **Usage data:** product interaction (which posts viewed)
- **Diagnostics:** crash data (if any analytics SDK is in use)

For each: declare what it's used for (App Functionality, Analytics, etc.) and whether it's linked to user identity (Yes for everything that's user-scoped) and used to track them (No — cbee doesn't do ad tracking).

If you're unsure, fill conservatively and submit. Apple will tell you if a category is missing during review.

### 2f. Provide a demo account for the reviewer

App Review wants to log into the app to test it. In the "App Review Information" section:

- Demo account username: a test user you created in cbee (e.g., `appreview@cbee.in`)
- Demo account password: that account's password
- Contact info: your name and phone
- Notes: brief — "This app is a social network for pet owners in Bangalore. Sign in with the demo account to see existing pets and posts. To test posting, tap the camera icon on the home tab."

### 2g. Submit for review

Hit "Add for Review" → "Submit". Apple's review typically takes 24-48 hours; rejections come with specific feedback. Address feedback, resubmit, repeat.

---

## Step 3: Upload to Google Play Console

### 3a. Create the app in Play Console

1. Go to https://play.google.com/console
2. Create app
   - App name: cbee
   - Default language: English (United Kingdom) or English (India)
   - App or game: App
   - Free or paid: Free
   - Declarations: tick the policy boxes (yes you'll follow Play policies, etc.)
3. Click "Create app"

### 3b. Upload the AAB to Internal Testing first

Don't go straight to Production. Internal Testing is the safe playground.

1. Play Console sidebar → Test and release → Testing → Internal testing
2. Create a new release
3. Upload `app-release.aab`
4. Release name: `2.0 — Phase 2 (initial)`
5. Release notes: "Initial release with native camera, Reels feed, and iOS parity."
6. Save → Review release → Rollout to internal testing

Add yourself (and a couple of trusted testers) as internal testers:
- Testers tab → Create email list → add your gmail + a few others → Save
- Tester URL → share this with them. They install via Play Store ✓

### 3c. If this is a brand-new personal Play Console account: the 12-tester closed test

(Skip this section if your account is older than November 13, 2023 or is an Organization account.)

After internal testing works, you have to run a **Closed Test with at least 12 testers for 14 consecutive days** before Google will let you publish to Production. This is THE Google Play rule that surprises everyone — see the Welcome Pack for the full backstory.

1. Sidebar → Testing → Closed testing → Create track
2. Upload the same `app-release.aab` (or a new version)
3. Create an email list with **at least 12 unique Gmail addresses** — recruit friends, family, Spurt teammates, anyone with an Android phone willing to install and keep installed for 14 days
4. Save the release → Rollout
5. Send the opt-in link to each tester (Play Console shows it in the Testers tab)
6. Each tester must:
   - Click the link from their Android phone
   - Tap "Become a tester"
   - Install the app from Play Store (it'll show up after a few minutes)
   - LEAVE IT INSTALLED for 14 days
7. After 14 days with 12+ active testers: sidebar → Dashboard → "Apply for production access". Answer the questionnaire honestly. Submit. Google reviews; usually 1-3 days.

**Practical tip:** Aim for 18-20 testers, not exactly 12. Some inevitably opt out or uninstall. If your count drops below 12 the 14-day timer can pause or restart.

### 3d. Fill the Play Store listing

Sidebar → Grow → Store presence → Main store listing.

- App name: cbee
- Short description: (80 chars max)
- Full description: (4000 chars max) — see store-listing kit
- App icon (512 × 512 PNG)
- Feature graphic (1024 × 500 JPG / PNG)
- Phone screenshots: minimum 2, recommend 4-8 (1080 × 1920 portrait JPG / PNG)
- Tablet screenshots: optional
- Promo video: optional

### 3e. App content (policy disclosures)

Sidebar → Policy → App content. Fill EVERY section honestly:

- Privacy policy (URL required)
- Ads (cbee has no ads → No)
- App access (do reviewers need credentials? → Yes, provide demo account)
- Content rating (run the questionnaire; UGC will tip it to ~Teen)
- Target audience (13+ probably)
- News app (No)
- COVID-19 contact tracing (No)
- Data safety (the equivalent of Apple's privacy disclosure — declare what you collect)
- Government apps (No)
- Financial features (Donations are not "financial products" in most interpretations — check the latest Google guidance)

### 3f. After closed-test approval — production rollout

When you have production access:

1. Sidebar → Test and release → Production
2. Create release
3. Upload the AAB (same one — or a fresh build if needed)
4. Release notes for users (multi-language if you support more than English)
5. Review release → Start rollout to production

You can choose a staged rollout (e.g., 10% → 50% → 100%) over a few days to catch crashes before they affect everyone.

### 3g. Privacy Policy — required for both stores

Both Apple and Google require a working privacy policy URL.

Quick options:
- Host on cbee.in/privacy (best)
- Free template at https://www.termsfeed.com/privacy-policy-generator/ — generate, host as a Google Doc set to "Anyone with link," paste link

Cover at minimum: what data you collect, why, how it's stored, how a user can delete it (Supabase Auth → delete user → cascades).

---

## Step 4: After both apps are live

Now you have an iOS app and an Android app shipping the same Phase 2 features. A few hygiene items:

### 4a. Set up Supabase Push Notifications properly

If push wasn't fully working at handoff:

**Android (FCM):**
1. Get your Firebase project's "google-services.json" — see `welcome_pack/google_play_setup.md` Firebase section
2. Drop into `android/app/`
3. The Edge Function `send-push` should already be configured. Verify by tapping a "Like" on someone's post → other user gets a push.

**iOS (APNs):**
1. Apple Developer portal → Keys → Create new APNs key (.p8)
2. Note the Key ID and your Team ID
3. In Supabase Studio → Settings → Edge Functions → APNs configuration → upload the .p8, paste Key ID + Team ID + Bundle ID `app.cbee.in`
4. Test by sending yourself a notification

### 4b. Run the moderation triage query once a day

Bookmark this in Supabase Studio → SQL Editor:

```sql
select
  r.id, r.created_at, r.reason, r.details, r.status,
  p.id as post_id, p.user_id as author, p.media_url, p.caption
from public.reports r
join public.posts p on r.post_id = p.id
where r.status = 'open'
order by r.created_at desc
limit 100;
```

For any genuinely policy-violating post:
```sql
delete from public.posts where id = '<post_id>';
update public.reports set status = 'actioned', reviewed_at = now() where post_id = '<post_id>';
```

For false positives:
```sql
update public.reports set status = 'dismissed', reviewed_at = now() where id = '<report_id>';
```

### 4c. Bill monitoring — both Cloudflare R2 and Supabase

cbee's bill comes from two providers. Bookmark both dashboards and skim them once a month — about 5 minutes total.

**Cloudflare R2 dashboard** — https://dash.cloudflare.com → R2 → `cbee-media` bucket → Metrics
- Storage size — grows linearly with your active users; no alarm bells until 100+ GB
- Class A operations (writes) — should track ~1 per post + 1 per thumbnail
- Class B operations (reads) — this is your engagement signal; will grow with usage
- Bandwidth — **always $0 on R2, this is the whole point**; nice to see how much you're saving

**Supabase dashboard** — https://supabase.com/dashboard/project/<id> → Reports
- Database size — should stay under 8 GB for the first year
- MAU count — when it nears 100,000, look at scaling to Team or splitting projects
- Compute usage — bump to "Small" tier ($10/month extra) if sustained >80% on the default Micro

For the full cost model — what to expect at every scale, when to act on each line item — read `docs/operations/cost_model.md`. The trigger thresholds are documented there.

### 4d. Renewals — calendar these

- **Apple Developer Program: $99/year**, auto-renews. Cancel via Apple Developer app if you ever stop the app. Calendar reminder for one year out.
- **Google Play Console: $25 one-time**, no renewal.
- **Supabase: monthly**, $25 Pro tier. Watch the dashboard.
- **Cloudflare R2: monthly, usage-based.** Free up to 10 GB storage and ~10M reads. Beyond that, see cost_model.md.
- **Domain name (cbee.in if applicable):** typically yearly.

---

## Step 5: When something goes wrong

| Symptom                                                  | What to do                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| Apple rejection: missing privacy policy                   | Put privacy policy at cbee.in/privacy, link to it in App Store Connect → App Information |
| Apple rejection: demo account doesn't work               | Test the demo account credentials before resubmitting              |
| Apple rejection: app crashes on launch                    | Ask Spurt for help — they can repro and fix                       |
| Google "your app has been removed from sale"             | Read the reason carefully (Play Console → Policy violations). Usually a content issue. |
| Google closed test stuck at "fewer than 12 testers"      | Recruit more. Don't rely on the minimum exactly.                  |
| Push notifications don't work                            | Step 4a — check FCM / APNs configuration                          |
| Reels feed shows no videos                                | Make a video post first! Empty feed has no reels.                 |
| User reports something abusive                           | Run the moderation query in 4b; action or dismiss                  |
| Storage limit hit                                        | Won't happen with R2 architecture; see cost_model.md for guardrails  |

---

## Spurt's continuing involvement

After handoff, the engagement is technically complete. Spurt is reachable for:
- Submission-time issues (rejection feedback, build issues) — best-effort during the submission window
- Phase 3 quote requests
- Critical-bug fixes — quoted separately

Day-to-day operations (uploading new releases, content moderation, user support, marketing) are on you.

---

## You did it

When the app is live on both stores, take a screenshot. You've shipped a real native mobile app to two app stores in 4 weeks of build + ~4 weeks of submission. That's worth something.

---

**See also:** `welcome_pack/` for Apple Developer + Google Play account setup, `docs/handoff/keystore_handoff.md` for keystore care.
