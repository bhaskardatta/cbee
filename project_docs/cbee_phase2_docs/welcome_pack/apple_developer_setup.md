# Apple Developer Program — Setup Guide

**For Swaroop B S, cbee.** A complete walkthrough for enrolling in the Apple Developer Program from India, fully updated for 2026.

This is the prerequisite for publishing the cbee iOS app to the App Store. Without it, you have a `.ipa` file and nowhere to put it.

---

## TL;DR

1. **You're in India**, so enrollment is **only available through the Apple Developer app** on an iPhone, iPad, or Mac with biometrics/passcode. The web flow won't accept your address. This is the most important thing to know going in.
2. **Cost: $99/year**, auto-renewing subscription, charged in INR equivalent.
3. **Time to fully active: 24 hours to ~48 hours typical**, occasionally up to 2 weeks if Apple flags your verification.
4. **You'll need:** an Apple Account with 2-Factor Auth, a government photo ID (Passport or Driving License or Aadhaar — Passport works best), a credit/debit card, your full legal name (no nicknames!), and your real address.

---

## Before you start

### Devices

You need one of:
- **iPhone** running iOS 16+ with Face ID, Touch ID, or passcode enabled
- **iPad** running iPadOS 16+ with Face ID, Touch ID, or passcode enabled
- **Mac** with the T2 Security Chip or Apple Silicon (M1, M2, M3, M4) running macOS 14+

You'll use this same device throughout the entire enrollment. Apple links the enrollment to the device's secure enclave.

### Apple Account

You need an Apple Account (formerly called Apple ID). If you already use an iPhone, you already have one. If not, set one up at https://account.apple.com.

**Critical:** Two-Factor Authentication must be enabled. Without it, the Developer app won't let you proceed.

To check / enable 2FA:
- iPhone: Settings → tap your name at the top → Sign-In & Security → Two-Factor Authentication → On
- Web: account.apple.com → Sign-In and Security → Two-Factor Authentication

### Legal name

In Apple Account settings, your **first and last name must be your real legal name** as it appears on your government ID. No nicknames, no "Swaroop B" — use the full name on your Passport or Aadhaar. Mismatched names are the single biggest cause of enrollment review delays.

Edit: account.apple.com → Personal Information → Name. Save before proceeding.

### Address

Enter your residential address in Apple Account → Personal Information → Shipping Address (or via the Developer app during enrollment). P.O. Boxes are not accepted. Use your home or office address — this is the address on Apple's records, not displayed publicly.

### Government ID

You'll be asked to photograph an ID document. Apple accepts:
- **Passport** (recommended — clearest, internationally recognized)
- **Driving License** (most Indian states accepted)
- **Aadhaar Card** (accepted for Indian residents, but Passport is preferred if you have one)

Have a clean photo of the front (and back, if double-sided) ready. The Developer app will guide you through taking these photos.

### Payment method

A credit or debit card that supports international transactions. RuPay-only cards won't work. Most Indian Visa and Mastercard credit/debit cards work fine. The fee is auto-deducted yearly via this card (or your iCloud Apple Pay if you've set that up).

**Apple Gift Card balances are NOT accepted** for Developer Program membership in India.

The fee is $99 USD — typically charged as ₹8,000-8,400 in INR (depends on conversion rate and your bank's forex markup). Plus 18% GST may be added by Apple's India billing.

---

## Step-by-step enrollment

### Step 1: Install the Apple Developer app

On your iPhone, iPad, or Mac:

- iPhone/iPad: Open the App Store, search "Apple Developer", install
- Mac: It comes pre-installed on Apple Silicon Macs; if not, install from the Mac App Store

App Store link: https://apps.apple.com/app/apple-developer/id640199958

### Step 2: Sign in

1. Open the Apple Developer app
2. Tap the Account tab
3. Sign in with your Apple Account
4. Authenticate with Face ID / Touch ID / passcode

### Step 3: Start enrollment

1. Inside the Developer app → Account → tap "Enroll" (a prominent button)
2. Review the Apple Developer Agreement → tap "Agree"
3. Review program benefits and requirements → tap "Continue"

### Step 4: Choose entity type

Select **Individual / Sole Proprietor**.

You can change this later (to Organization) but it's a complicated migration. For cbee starting out as your personal project, Individual is correct. If cbee is a registered private limited company (e.g., "cbee Technologies Pvt Ltd"), and you want the company name on the App Store as the seller, choose Organization — but you'll need a D-U-N-S Number first (see "Organization path" section at the bottom of this doc).

**For most users, Individual is the right call.**

### Step 5: Identity verification

You'll be prompted to verify your identity:

1. Confirm your legal name (must match Apple Account exactly)
2. Confirm your phone number
3. Confirm your address (no P.O. Box)
4. Take a photo of your government ID
   - Hold the ID flat under good light
   - Frame the entire document in the photo
   - The app may ask you to retake — that's normal
5. Some accounts get a follow-up: "Take a selfie holding your ID." Follow the prompts.

Apple may also ask for your **government identification number** in some cases — for Indian residents this could be a Passport number or Aadhaar number. They store this for verification purposes only, not for any other use.

### Step 6: Review and submit

The app shows you everything you entered. Verify carefully — name typos cause review delays. Tap "Continue".

### Step 7: Wait for review

Apple's review typically takes **24-48 hours**. Some accounts get approved in 4-6 hours. Occasionally accounts get held for 1-2 weeks (especially first-time individual accounts that need extra verification).

During review:
- You can sign in to the Developer app and check status
- An email lands in your inbox when there's an update
- DON'T try to enroll again — duplicates make it worse

If you're stuck >7 days: contact Apple Developer Support https://developer.apple.com/contact

### Step 8: Pay the fee

Once approved, the app shows you the membership subscription screen.

1. Confirm: $99 USD / year, auto-renewing
2. Confirm payment method (the one tied to your Apple Account)
3. Tap "Subscribe"
4. Authenticate with Face ID / Touch ID
5. Done

The fee is charged immediately. You can cancel anytime via the Developer app → Account → manage subscription, but no refund for partial years.

### Step 9: You're a developer

After payment processes (a few minutes), you can:

- Visit https://developer.apple.com/account on a web browser and sign in
- Visit https://appstoreconnect.apple.com and sign in
- Both should show your developer account active

Now proceed to `docs/handoff/going_live.md` for the actual app upload.

---

## Tutorial videos

Watch one or both of these. They walk through the exact screens. The Developer app's UI changes occasionally — if the video shows a different screen than what you see, trust your screen but use the video's overall flow.

**1. WebToNative — "How to Enroll in the Apple Developer Program – Step-by-Step Tutorial 2026"** (written guide with screenshots, updated for 2026):
> https://www.webtonative.com/blog/apple-developer-program-enrollment

**2. Apple's official documentation — "Enrolling, verifying, and renewing with the Apple Developer app":**
> https://developer.apple.com/help/account/membership/enrolling-in-the-app/

**3. Apple's official program enrollment page:**
> https://developer.apple.com/programs/enroll/

For India-specific guidance, Apple's official page explicitly notes: *"Enrollment in India is only available through the Apple Developer app."* If a YouTube tutorial walks through the web enrollment flow, **it doesn't apply to India**.

---

## Quick privacy policy

Both stores require a public URL pointing to a privacy policy. Set this up while waiting for Apple's enrollment review.

### Fast option: Google Sites

1. Go to https://sites.google.com (sign in with your Google Account)
2. Click + to create a new site
3. Title it "cbee Privacy Policy"
4. On the page, paste the template below (edit the bracketed parts):

```
Privacy Policy — cbee

Effective: [DATE]

cbee is a social network for pet parents in Bangalore, operated by Swaroop B S.

What we collect:
- Account information: your email, name, and chosen username when you sign up.
- User content: photos, videos, captions, comments, messages you create within the app.
- Usage data: which posts you view, like, or report (used to improve the feed and detect abuse).
- Device identifiers: a token used to send push notifications.

How we use it:
- To operate cbee (show posts, deliver notifications, enable messaging).
- To moderate content (review reports of abusive content).
- To improve cbee over time (anonymous, aggregated insights).

We do not sell or share your data with advertisers.

Storage:
- We use Supabase (https://supabase.com) as our database and storage provider.
- Data is stored in Supabase's [region] region.

Your rights:
- Delete your account at any time from app Settings → Delete Account. This permanently removes your profile, posts, comments, messages, and reports.
- Email [your email] with privacy questions or to request data export.

Contact:
- cbee, c/o Swaroop B S
- [Your address or "Bangalore, India"]
- Email: [your contact email]
```

5. Click Publish (top right) → choose a URL like `cbee-privacy` (becomes `sites.google.com/view/cbee-privacy`) → Publish
6. Save this URL — you'll paste it into App Store Connect and Play Console.

### Faster option: TermsFeed Free Generator

https://www.termsfeed.com/privacy-policy-generator/ — generates a more formal policy. Free for basic, paid for advanced. Then host it via Google Sites or Notion (public page) or cbee's own website.

### Best option (eventually): cbee.in/privacy

If you own the cbee.in domain, host the policy at `cbee.in/privacy` for a more professional look. Phase 3 task; Google Sites is fine for launch.

---

## Frequently-stuck moments

### "My Apple Account name doesn't match my photo ID"

You probably entered "Swaroop B" but your Passport says "Swaroop Bharadwaj Subramanian". Edit your Apple Account name first (account.apple.com → Personal Information). Then restart the enrollment flow.

### "The Developer app says 'Unable to verify your identity'"

Three common causes:
1. Your photo ID image is blurry — retake with better light
2. The name on your ID and your Apple Account don't match
3. The address you entered is incomplete (Apple wants full street, city, state, PIN)

### "I don't get the option to enroll, only to view my Apple Account"

You're not eligible yet because 2FA isn't enabled. Enable it on account.apple.com first.

### "Payment failed"

Common with Indian cards. Try:
1. A different card (international transactions enabled)
2. Set up Apple Pay with the card first, then try via Apple Pay during enrollment
3. Increase your daily international transaction limit with your bank

### "It's been 5 days, no update"

If your enrollment has been "pending review" for more than 7 days, contact https://developer.apple.com/contact and provide your enrollment ID (shown in the Developer app). They typically respond within a business day.

### "I want to use a company name as the seller, not my personal name"

You need the Organization path — see below. It requires a registered legal entity (cbee Pvt Ltd, or similar) and a D-U-N-S Number.

---

## Organization path (advanced — skip if Individual works for you)

If cbee is a registered company and you want the company name shown as "Seller" on the App Store:

1. **Get a D-U-N-S Number** for your company (free from Dun & Bradstreet)
   - Apply at https://developer.apple.com/enroll/duns-lookup/
   - Takes 1-5 business days
2. Your company must be a registered legal entity (you have a Certificate of Incorporation or similar)
3. You must have legal binding authority (you're the director / authorized signatory)
4. Enroll via the Developer app, but select Organization at the entity type step
5. Apple verifies via D-U-N-S, your role, and may call your registered business phone number
6. Total time: 1-3 weeks usually

**Pros:** Cleaner App Store presence ("by cbee Pvt Ltd"), professional-looking.
**Cons:** Slower, more paperwork, requires a registered company.

For cbee's launch, Individual is faster. You can transfer ownership to a company later if cbee incorporates.

---

## After enrollment

You now have:
- Access to App Store Connect (https://appstoreconnect.apple.com)
- Access to Apple Developer Portal (https://developer.apple.com/account)
- A 12-month subscription that auto-renews $99/year

**Save** these to your calendar:
- Renewal date — set a reminder for one month before so you can confirm or cancel
- Apple Developer Support contact (if you ever need it)

Next: register the bundle ID `app.cbee.in` and create the app record in App Store Connect — these steps are in `docs/handoff/going_live.md` Step 2.

---

## Final checklist

Before moving on to the upload step:

- [ ] Apple Account exists with 2FA enabled
- [ ] Legal name matches government photo ID exactly
- [ ] Address entered (no P.O. Box)
- [ ] Apple Developer app installed
- [ ] Enrollment submitted via the Developer app
- [ ] $99/year payment processed
- [ ] App Store Connect account active (https://appstoreconnect.apple.com loads with your name)
- [ ] Privacy policy URL live and reachable
- [ ] Renewal date saved to calendar

When all checked, open `docs/handoff/going_live.md` for the actual app submission.

---

**Next:** `google_play_setup.md` for the Google side, or `docs/handoff/going_live.md` for the upload itself.
