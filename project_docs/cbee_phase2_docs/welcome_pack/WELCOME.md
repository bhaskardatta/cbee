# Welcome to your cbee Phase 2 Handoff

**Swaroop, this is for you.** Bhaskar at Spurt has built the new version of cbee — the one with the native camera, the Reels feed, and the iOS app. This packet walks you through everything you need to do to take it from "here's the app file" to "live on the App Store and Play Store."

You don't need to read every doc in here. This is a map. Read this WELCOME first, then dive into the specific pieces you need.

---

## What's in this packet

```
welcome_pack/
├── WELCOME.md                       ← you are here
├── apple_developer_setup.md         ← if you don't have an Apple Developer account yet
├── google_play_setup.md             ← if you don't have a Google Play Console account yet
└── cloudflare_setup.md              ← NEW — setting up Cloudflare R2 for media storage
```

Plus, sibling to the welcome pack:

```
docs/
├── handoff/
│   ├── going_live.md                ← after accounts are set up, how to upload to the stores
│   └── keystore_handoff.md          ← how to securely receive and store your Android keystore
└── operations/
    └── cost_model.md                ← what cbee will cost you to run, at every scale
```

---

## The big picture

To get the cbee Phase 2 apps live on stores AND running affordably, you need:

| You need this                              | Cost                          | Time required                          |
| ------------------------------------------ | ----------------------------- | -------------------------------------- |
| Apple Developer Program membership         | $99/year (~₹8,200)            | 24 hours to 2 weeks to enroll          |
| Google Play Console developer account      | $25 one-time (~₹2,100)         | 1-3 days to enroll                     |
| Cloudflare account + R2 bucket             | $0 to start (free tier)        | ~30 minutes setup                      |
| A Mac (or access to one) for iOS upload    | —                             | One-time, ~30 min to use               |
| The handoff package from Spurt              | Included                      | Received                               |
| Submission time to Apple                    | —                             | Review takes 24 hours – 14 days        |
| Submission time to Google                   | —                             | If new personal account: 14-day mandatory closed test + 1-3 day production review |
| Privacy policy URL (live page)              | Free                          | 30 minutes (use TermsFeed or similar)  |
| Demo account credentials for app reviewers  | —                             | 5 min — make a test user in cbee       |
| Screenshots, app description, etc.          | Included in store-listing kit | 0 (Spurt prepared)                     |

**Total realistic timeline from "starting from scratch" to "live on both stores":**
- Best case: ~3 weeks
- Typical: ~4-5 weeks
- Worst case: ~6 weeks (if Apple identity verification is slow or Google closed test loses testers)

**Realistic monthly running cost:**
- First 6-12 months at <500 daily users: **~$35-40/month (~₹3,000-3,400)**
- Growing to 10,000 daily users: **~$160/month (~₹13,600)**
- The cost grows predictably with usage. Full breakdown in `docs/operations/cost_model.md`.

---

## What to do first

### If both your developer accounts are ALREADY set up

Skip straight to `docs/handoff/going_live.md`. You're ready to upload.

### If you haven't done this before

Do these in order. Start the slow-clock items first so they run in parallel:

1. **Start the Apple Developer enrollment NOW** — it's the longest-running thing. Open `apple_developer_setup.md`. Even if you don't have your Mac yet, you can start the enrollment from your iPhone today. Apple's identity verification can take days. Get the clock ticking.

2. **Start the Google Play Console registration in parallel.** Open `google_play_setup.md`. This one is faster (1-3 days for account approval), but if you're on a personal account, you also need to start your 14-day closed test as soon as possible. Both clocks should be running simultaneously.

3. **Set up Cloudflare R2 (the cheap one — 30 minutes total).** Open `cloudflare_setup.md`. This is where cbee's photos and videos will live. There's no review wait — you can finish this in one sitting. Do it before Bhaskar starts the build so he has the credentials ready.

4. **Write a privacy policy.** While accounts are being approved, host a privacy policy at a public URL. Both stores require this. See the "Quick privacy policy" section in `apple_developer_setup.md`.

5. **Once accounts are active, read `docs/handoff/going_live.md`.** That's the playbook for uploading the cbee builds.

---

## The questions you might have

### "Wait, I thought Spurt was submitting to the stores?"

The original engagement covers **build + handoff**, not store submission. Apple's review can take 1-14 days, Google's closed-test requirement is 14 days. Neither fits inside a 4-week dev sprint, and submission requires your Apple Developer and Google Play accounts (under your name, with your credit card), not Spurt's.

What Spurt has done: built the app, signed the Android AAB, archived the iOS build, written all the docs and store-listing kit, and is reachable for questions during your submission window. You drive the actual upload.

If you'd rather Spurt also handle submissions, that's a Phase 3 add-on — quoted separately. Talk to Bhaskar.

### "Why do I need a Cloudflare account too? I already have Supabase."

Real question, real answer: because of math.

cbee is going to serve a lot of photos and videos to a lot of people. Every time someone watches a reel, bytes go out of your storage and that's called "egress." Most cloud providers — Supabase, AWS, Google Cloud — charge you for egress. So when cbee gets popular, you'd start paying $300, $1,000, $3,000+ per month in egress alone.

Cloudflare R2 doesn't charge for egress. Ever. At any scale. Storage costs almost nothing ($0.015 per GB per month — a couple of dollars for thousands of photos).

So we put your photos and videos on Cloudflare R2 from day one. Your post metadata, user accounts, comments, likes — all that stays on Supabase, where it belongs. Two providers, each doing what they're best at. The cost difference at scale: roughly **10x cheaper** than the Supabase-only path.

Read `docs/operations/cost_model.md` for the full math. Or just trust the architecture — Bhaskar set it up so you can grow without code changes, and you only pay more in dashboards when usage actually grows.

### "Why are there so many steps for Google Play?"

Google introduced a new rule in November 2023: every new personal Play Console account must run a **14-day closed test with at least 12 active testers** before being allowed to publish to the production track. This rule is to fight the flood of low-quality apps that personal accounts used to push.

The cleanest workaround is to register as an "Organization" instead of a "Personal" account — Organization accounts skip the 14-day test entirely. But Organization accounts require a D-U-N-S number for your business, which is a separate registration process.

We've defaulted the Welcome Pack to the Personal-account path (assuming Swaroop is registering as an individual). If you have a registered business (cbee Pvt Ltd or similar) and want the Organization path, see the "Organization vs Personal" section in `google_play_setup.md`.

### "Why do I need a Mac?"

iOS app submissions require uploading from a Mac running Xcode. There's no Windows or Linux path. Options:

- Use a Mac you already own
- Borrow a friend's Mac for 30 minutes (one-time activity)
- Rent a Mac in the cloud — services like MacInCloud are ~₹1,500/month
- Bhaskar can do the upload for you with your Apple Developer credentials — coordinate via WhatsApp

### "I'm in India. Does that change anything?"

Yes — two important things:

1. **Apple Developer enrollment in India is only available through the Apple Developer app**, not via the web. You need an iPhone, iPad, or Mac with biometric/passcode security to enroll. The web flow simply won't accept Indian addresses.

2. **Google Play Console works fine from India.** The $25 fee is charged in INR equivalent + GST (typically ₹2,100-2,400 total).

Both currencies / regions are well-supported. The cbee Phase 2 build is configured for India distribution.

---

## How to reach Spurt during submission

Bhaskar is reachable for:
- Build rejection feedback (Apple's review notes, Google policy issues)
- Critical bugs found post-handoff during the closed test
- Phase 3 quote requests

Best channels: WhatsApp (fastest), email (formal).

What's NOT covered post-handoff:
- Day-to-day content moderation (you run the SQL query yourself; see `going_live.md`)
- New features
- Customer support for cbee users
- Marketing

If you need extended support, ask for a "Phase 3 retainer" quote. Spurt offers monthly retainers for active products.

---

## A note on the keystore

The handoff also contains your **Android keystore** — a small binary file that proves you (and only you) own the cbee Android app. **Losing this file means you can never update the cbee Android app again.** Read `docs/handoff/keystore_handoff.md` carefully. It walks you through securely receiving the keystore and making three backups.

This is not paranoia — Google literally cannot help you if you lose this. Three backups. Different locations. Tested annually.

---

## What's NOT in this packet

- Marketing materials
- User acquisition strategy
- Pricing or monetization advice
- Phase 3 feature roadmap (we can quote that separately when you're ready)

---

## Ready?

Open `apple_developer_setup.md` and start there if you don't have an Apple Developer account.

If you do: jump straight to `docs/handoff/going_live.md`.

Good luck, Swaroop. cbee is going to be a real thing, on real phones, real soon. 🐶

— Bhaskar & the Spurt team
