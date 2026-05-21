# Google Play Console — Setup Guide

**For Swaroop B S, cbee.** A complete walkthrough for setting up a Google Play Console developer account, fully updated for 2026 including the 12-tester closed-test requirement that catches everyone off guard.

This is the prerequisite for publishing the cbee Android app to the Google Play Store. You already have a signed AAB from Spurt — this gets you the account to upload it to.

---

## TL;DR

1. **Cost: $25 USD one-time** (no annual renewal). Charged in INR equivalent + GST: roughly ₹2,100-2,400 total.
2. **Time to account approval: 1-3 days typical** (some accounts approved within hours).
3. **THEN — and this is the big surprise — if you're a brand-new personal account, Google requires you to run a 14-day closed test with 12 active testers before you can publish to production.** This rule started in November 2023.
4. **Organization accounts skip the 14-day test** but require a D-U-N-S Number (free, takes 1-5 days). Trade-off.
5. **You'll need:** A Google Account with 2-Step Verification, a credit card with international transactions enabled, a government photo ID, and a developer name that will be PUBLICLY VISIBLE on the Play Store.

---

## Personal vs Organization — the strategic decision

Google offers two account types, and the choice matters more than it sounds:

| Aspect                          | Personal Account                                  | Organization Account                              |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| Cost                            | $25 one-time                                       | $25 one-time                                       |
| D-U-N-S Number required         | No                                                | Yes (free, 1-5 days to obtain)                    |
| 14-day closed test before production | YES — must have ≥12 testers for 14 consecutive days | NO — exempt                                  |
| Publicly visible name           | Your real legal name on the Play Store as developer | Your registered company name                      |
| Identity verification           | Photo ID                                          | D-U-N-S + business documents + photo ID            |
| Time to first publish (cold start) | ~3 weeks (account + 14-day test + review)        | ~2 weeks (account + review, no closed-test wait)  |
| Good for...                     | Indie developers, personal projects, solo founders | Companies with registered entity, want company branding |

**For cbee right now:** if Swaroop has cbee as a personal project (no Pvt Ltd registration yet), go Personal. The 14-day closed test is annoying but not blocking — Spurt's handoff includes signed builds you can put into testing IMMEDIATELY, so the 14-day clock starts as soon as you create the account.

**If cbee Pvt Ltd exists** (or you're willing to register it for ₹6,000-10,000 via IndiaFilings or similar): Organization is faster and looks more professional.

**Default recommendation for this Welcome Pack: Personal account.**

---

## Before you start

### Google Account

You need a Google Account (Gmail) with **2-Step Verification** enabled.

To enable 2-Step Verification:
1. Go to https://myaccount.google.com/security
2. Find "2-Step Verification" → Get Started
3. Follow prompts (typically: add your phone for SMS codes; optionally add Google Authenticator for stronger auth)

### Payment method

A credit or debit card supporting international transactions. Most Indian Visa and Mastercard credit/debit cards work. UPI is NOT accepted for account fees. RuPay cards rarely work for international fees.

### Government photo ID

Same as Apple — Passport, Driving License, or Aadhaar. You'll be asked to upload one during identity verification (after account creation). Google may also accept additional documents if their initial verification doesn't go through.

### Developer name

The "developer name" you choose at registration is **publicly displayed on every cbee Play Store listing**. Options:

- Your full real name: "Swaroop B S"
- A brand name: "cbee" — but as a personal account this might confuse buyers about whether you're a business
- "cbee by Swaroop B S"

You can change this once after registration, then it's locked. Choose carefully.

---

## Step-by-step: Personal account setup

### Step 1: Go to Google Play Console

URL: https://play.google.com/console/signup

Sign in with the Google Account you'll use as the cbee admin.

### Step 2: Accept the developer agreement

Read the Google Play Developer Distribution Agreement. Tick the boxes (you confirm you've read it, you're at least 18, etc.). Click "Continue".

### Step 3: Pay the $25 fee

The next screen asks for payment.

1. Click "Continue to payment"
2. Add a credit/debit card (the form requires international card support)
3. Confirm $25 USD charge (will appear as ~₹2,100-2,400 on your statement)
4. Submit

The payment is one-time. No recurring charges.

### Step 4: Choose account type

The form now asks: **Yourself / An organization**

Select **Yourself** for personal account.

(If choosing Organization, see "Organization path" section below.)

### Step 5: Developer details

Fill in:
- **Developer name** (public): your choice (real name, brand, or "X by Y"). 50 char max.
- **Public email address**: an email users can contact you at. Must be verifiable (Google sends a confirmation code). Use a real address, not a throwaway. This shows on the Play Store listing.
- **Public phone number**: optional but recommended for trust
- **Public website**: cbee.in if you own it; otherwise leave blank for now
- **Contact name**: your real name (private — Google's records only)
- **Private email**: a Google-only contact email (different from public email)
- **Private phone**: a Google-only contact phone number

### Step 6: About you (identity questions)

Google asks a few yes/no questions:
- Is this for distributing apps?
- Do you have any apps already published anywhere else?
- (Various others — answer honestly)

### Step 7: Identity verification

Within a few hours to a few days, you'll get an email asking for identity verification:

1. Click the email link → opens Play Console
2. Upload a photo of your government ID (Passport works best)
3. Take a selfie if prompted
4. Submit

Google verifies (usually 1-3 days). If approved, you'll get a confirmation email saying you can now publish apps.

If they ask for more (e.g., a bank statement proving address): comply. Don't try to argue with Google's verification team.

### Step 8: Account is active

You can now create apps in the console. Verify by visiting https://play.google.com/console and seeing the dashboard.

---

## The 14-day closed-test gauntlet (personal account only)

**This is the part that catches everyone.**

Brand-new personal Google Play developer accounts (created after November 13, 2023) cannot publish to the production track immediately. Google requires:

> A closed test with at least **12 testers**, who must be **opted-in for at least 14 consecutive days continuously**, before you can apply for production access.

Until you complete this, the "Production" option in Play Console is grayed out for your apps.

### Why this rule exists

Pre-2023, individual developers were flooding Play Store with low-quality / cloned / scam apps. The 14-day test forces real testing on real devices before publication, which has visibly reduced spam.

### The fastest path through

You don't have to wait until your final build is ready. Start the closed test on Day 1 with ANY uploadable AAB — even a Hello World. The 14-day clock starts as soon as your AAB is approved AND you have 12 opted-in testers.

Here's the sequence:

1. Day 1 (today): create the app in Play Console, upload the cbee AAB to Internal Testing first (no review needed, fast)
2. Day 1: also create a Closed Testing track, upload the same AAB
3. Day 1-2: recruit 12+ testers (see "Finding testers" below), share opt-in link, get them to install
4. Day 2-3: Google approves the closed-test release (usually 1-3 days)
5. Day 3: 14-day countdown starts ONCE both: release is approved AND 12+ testers are opted in
6. Day 17 (3 + 14): apply for production access
7. Day 17-20: Google reviews production access application (1-3 days)
8. Day 20+: publish to production

### Finding 12 testers

Each tester needs:
- A Gmail address
- An Android phone (real device — emulators don't count)
- Willingness to opt in and leave the app installed for 14 days

Sources:
1. **Friends and family** — easiest. Ask for their Gmail address.
2. **Spurt team** — Bhaskar + 2-3 colleagues should be in there
3. **WhatsApp group of pet parents in Bangalore** — natural cbee target market, willing testers
4. **Testers Community app** (free) — https://play.google.com/store/apps/details?id=com.testerscommunity — community of devs trading testing for each other's apps. 40k+ users.
5. **Reddit / Discord / Telegram closed-test exchange communities** — exist but flaky; testers often opt out mid-test.
6. **Paid services** — PrimeTestLab, AppDadz, ClosedTestHelp. ~$15-30 for 12 testers. Faster but costs money. Some testers may not be in India.

**Practical tip:** Aim for **18-20 testers, not 12**. Some inevitably opt out or uninstall. If you drop below 12 the 14-day timer can pause or reset. Buffer protects you.

### Setting up the closed test (Step-by-step)

After your account is active:

1. **Play Console → Create app**
   - App name: cbee
   - Default language: English (United Kingdom) or English (India)
   - App / Game: App
   - Free / Paid: Free
   - Tick the declarations
2. **Test and release → Testing → Closed testing → Create track**
3. Name the track: "alpha" or "internal_alpha" (doesn't matter)
4. Upload the cbee `app-release.aab` from Spurt's handoff
5. Fill release name + release notes
6. Save → Review release → Rollout
7. **Testers tab → Create email list**
   - Paste all 12+ Gmail addresses, one per line
   - Save the list
   - Attach the list to your alpha track
8. **Testers tab → Copy the opt-in URL** (it's in the form `https://play.google.com/apps/testing/in.cbee.app` or similar)
9. Share that URL with each tester via WhatsApp / email
10. Each tester:
    - Opens the URL on their Android phone
    - Taps "Become a tester"
    - After 5-10 minutes, the app appears on Play Store
    - Installs it
    - Leaves it installed for 14 days (doesn't have to open daily — opt-in status is what counts)

### The 14-day countdown — what to watch

In Play Console → Dashboard, after the release is approved AND you have 12+ testers opted in, you'll see a countdown like: "Production access available in 12 days, 6 hours, ..."

DON'T let the count drop below 12 testers during the 14 days. If it does, the timer pauses (some sources say it resets — Google's docs are vague). Monitor daily and recruit replacements if anyone opts out.

After 14 days at 12+ testers:

1. **Play Console → Dashboard → Apply for production access**
2. Fill the questionnaire:
   - How many testers did you have? (Be honest)
   - What testing did you do? (Functional testing across devices)
   - What feedback did you get? (Even minor stuff is fine — be specific, don't copy-paste templates)
   - What changes did you make? (Even small UI tweaks count)
3. Submit
4. Google reviews (1-3 days)
5. If approved: production access granted, and you can now upload to the Production track

If rejected: read the feedback carefully and address it. Common rejection reasons: vague questionnaire answers, suspicious tester engagement patterns (all from one country, all installed simultaneously), or content/policy issues.

---

## Tutorial videos

These walk through the exact screens with hands-on demos. Watch at least one before starting:

**1. CodeVenturePro — "2025 UPDATED — How to publish app in google play console — 12 testers for closed testing android"** (YouTube, step-by-step closed-test setup):
> https://www.youtube.com/watch?v=y50-tgrdOcY (or search "CodeVenturePro 12 testers 2025")

This is the most up-to-date walkthrough of the 12-tester rule.

**2. Testers Community — Step-by-step closed testing guide**:
> https://www.testerscommunity.com/blog/google-play-closed-testing-setup-step-by-step

Written guide with screenshots, plus the free Testers Community app for recruiting testers.

**3. Google's official documentation:**
> https://support.google.com/googleplay/android-developer/answer/14151465

Google's own help article on the 12-tester requirement. The authoritative source.

**4. PrimeTestLab — 2026 guide on the 12 testers rule:**
> https://primetestlab.com/blog/google-play-12-testers-closed-testing-guide

Comprehensive guide; they also sell tester services if you can't recruit 12 friends.

---

## Set up Firebase Cloud Messaging (FCM) for push notifications

cbee uses push notifications. They work via FCM on Android. Set this up in parallel with the developer account.

1. Go to https://console.firebase.google.com
2. Sign in with the same Google Account
3. Add project: "cbee-mobile"
4. Disable Google Analytics for now (skip the Analytics step)
5. Once project created: project settings → cloud icon → Add Android app
6. Android package name: `app.cbee.in`
7. Download `google-services.json`
8. Send this file to Bhaskar — it goes in `android/app/google-services.json` in the codebase
9. Generate a Firebase Server Key:
   - Project settings → Cloud Messaging → "Cloud Messaging API (Legacy)" — enable if disabled
   - Server key — copy it
10. In Supabase Studio → Project Settings → Edge Functions → secrets → set `FCM_SERVER_KEY=<the key>`

Once these are in place, push notifications work on Android. (iOS uses APNs — separate flow; see `docs/handoff/going_live.md` step 4a.)

---

## Quick privacy policy

Same as the Apple guide — both stores require this. If you set up Google Sites / TermsFeed for Apple, re-use the same URL. See `apple_developer_setup.md` "Quick privacy policy" section.

---

## Frequently-stuck moments

### "My credit card was declined"

Common with Indian cards. Try:
1. Confirm international transactions are enabled (call your bank or check via your bank's app)
2. Increase your daily international transaction limit
3. Try a different card
4. Use Google Pay if your card supports it

### "I haven't received the verification email"

Check spam. If still missing after 24 hours:
- Play Console → Inbox (in the dashboard) — Google's communications also show here
- Contact https://support.google.com/googleplay/android-developer/contact

### "I can't find 12 testers"

Combine sources:
- 5 friends/family (ask via WhatsApp)
- 3 Spurt teammates
- 4 from Testers Community app (free)
- = 12 ✓

If still short: pay for the rest via PrimeTestLab (~$15 for 12 testers; you only need a top-up).

### "Some testers opted in but the count is still <12"

Make sure they're using the SAME Gmail address they're opted in with on the Android device. Some people opt in with a personal Gmail then install on a phone signed in with a work account — doesn't count.

Also: opt-in can take 5-10 minutes to register in Play Console. Check again later.

### "Production access was rejected"

Read the feedback carefully. Most rejections are because:
- Questionnaire answers were too generic ("we tested it" — not specific enough)
- Testers all opted in on the same day (looks like fake testing)
- Tester engagement was zero (no one opened the app even once)
- Policy violation discovered during their review

Fix the specific issue and reapply. Don't reapply with the same submission.

### "I created the account in 2022 — do I still have to do the 14-day test?"

NO. The rule applies only to personal accounts created **after November 13, 2023**. Older accounts are grandfathered. Check your account creation date in Play Console → Setup → Developer account → About developer.

---

## Organization path (skip if Personal works)

If you're choosing Organization to skip the 14-day test:

1. **Get a D-U-N-S Number** for cbee Pvt Ltd (or whatever your company is called)
   - Apply at https://www.dnb.com/duns-number/get-a-duns.html (or via Google Play's own D-U-N-S form when prompted)
   - It's FREE in most countries including India
   - Takes 1-5 business days
2. Have your Certificate of Incorporation handy
3. Have your company's registered address (matches D-U-N-S records)
4. During registration, select "An organization" as the account type
5. Provide D-U-N-S Number, company name, address
6. Google verifies — may take 1-3 weeks for the first time
7. Once verified, you can publish to production without the 14-day test

**Pros:**
- Skip the 14-day test
- Company name on the Play Store as developer ("cbee Pvt Ltd")
- More professional look

**Cons:**
- Requires a registered company (₹6,000-10,000 to incorporate via IndiaFilings or VakilSearch if you don't have one)
- Slower account verification

---

## After approval

You now have:
- A Google Play Console account
- Ability to upload AABs and create app listings
- If personal: a 14-day countdown to start ASAP
- If organization: ability to publish to production immediately after the regular review

**Save these to your calendar:**
- The 14-day deadline (if personal)
- Yearly "review of declared data safety" — Play Console may prompt you to re-declare annually

Next: open `docs/handoff/going_live.md` for the actual upload steps.

---

## Final checklist

Before moving to upload:

- [ ] Google Account exists with 2-Step Verification
- [ ] Play Console account created at https://play.google.com/console
- [ ] $25 fee paid
- [ ] Identity verified (photo ID accepted)
- [ ] Developer name confirmed (public, locked after first change)
- [ ] Account type chosen (Personal or Organization)
- [ ] If Personal: 12+ testers recruited, app uploaded to Closed Testing, 14-day countdown started
- [ ] Firebase project created, `google-services.json` shared with Bhaskar
- [ ] Privacy policy URL live (same as Apple side)
- [ ] (After 14 days) Production access applied for and granted

When checked, open `docs/handoff/going_live.md`.

---

**Next:** `docs/handoff/going_live.md` for the actual upload, or `docs/handoff/keystore_handoff.md` for keystore care.
