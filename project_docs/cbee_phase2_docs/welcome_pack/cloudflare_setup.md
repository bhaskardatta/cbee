# Cloudflare R2 — Setup Guide

**For Swaroop B S, cbee.** A complete walkthrough for setting up Cloudflare R2 — the storage layer where all of cbee's photos and videos will live.

This is the easiest of the three account setups in the Welcome Pack. There's no identity review, no enrollment fee, no waiting period. You can finish this in one sitting in about 30 minutes.

---

## TL;DR

1. **Cost: $0 to start.** The free tier covers 10 GB storage, 1 million uploads, and 10 million downloads per month — comfortably more than cbee's first few months will use.
2. **What you're setting up:** A Cloudflare account, an R2 storage bucket called `cbee-media`, and a public domain `media.cbee.in` that serves the photos and videos to users.
3. **Time: ~30 minutes total** end to end.
4. **You'll need:** A credit/debit card (for the Cloudflare account, even though you won't be charged on the free tier), and access to either the domain `cbee.in` or whatever domain you want to use for media.

---

## Why we're doing this

Cloudflare R2 stores your photos and videos. Cloudflare's network then delivers them to your users worldwide, fast, with no per-download charge from Cloudflare to you.

Compare to alternatives:
- **AWS S3 or Google Cloud Storage** — charge ~$0.09 per gigabyte sent to users. At cbee scale, this becomes hundreds or thousands of dollars per month.
- **Supabase Storage (which Phase 1 used)** — same pattern: free up to a quota, then $0.09/GB. Fine at small scale, expensive at growth.
- **Cloudflare R2** — $0 per GB sent. Storage is $0.015/GB/month. The math at scale is roughly 10× cheaper than the alternatives.

This is the architecture decision (ADR-017 in the tech docs) that lets cbee grow without surprise bills. Read `docs/operations/cost_model.md` for the full breakdown if you're curious.

---

## Before you start

### What you need

- A computer with a web browser (any modern one)
- An email address (use the one you want to use for cbee admin going forward — Bhaskar suggests it match your Supabase admin email so all infrastructure for cbee is in one place)
- A credit card or debit card (used for verification only — Cloudflare's free tier doesn't charge for what we'll use)
- Access to the `cbee.in` domain (or whatever domain you want media served from) — specifically, the ability to update its DNS records at the registrar where you bought it (GoDaddy / Namecheap / Hostinger / etc.)

### If you don't own `cbee.in`

If you haven't bought the domain yet, do that first. **A domain is around ₹800-1,200 per year** from any Indian registrar (Hostinger, GoDaddy India, BigRock). It's not required for the app to work — we can use a Cloudflare-provided URL — but it's much more professional. If you want to skip the domain step entirely, see "Without your own domain" near the end of this doc.

---

## Step-by-step setup

### Step 1: Create your Cloudflare account

1. Go to https://dash.cloudflare.com/sign-up
2. Enter your email and a strong password
3. Verify the email (click the link in your inbox)
4. You're in the Cloudflare dashboard

That's it. No identity verification, no waiting.

### Step 2: Add your domain to Cloudflare

(Skip this step if you don't have your own domain — see "Without your own domain" at the end.)

1. In the Cloudflare dashboard, click **"Add a domain"** (or "Add a site" in some UI versions)
2. Type `cbee.in` (or whatever your domain is) — **do not include `www`**
3. Choose the **Free plan** — it's all you need
4. Click **Continue**

Cloudflare will scan your existing DNS records. Review them. Click Continue.

### Step 3: Update your nameservers (one-time, at your registrar)

Cloudflare gives you two nameservers (something like `juan.ns.cloudflare.com` and `kate.ns.cloudflare.com`). These vary per account.

You need to point your domain to these nameservers at your registrar:

1. Log into your domain registrar's site (where you bought `cbee.in` — Hostinger, GoDaddy, etc.)
2. Find the DNS or Nameserver settings for `cbee.in`
3. Change the nameservers from the registrar's default to the two Cloudflare ones
4. Save

**This propagates in 1 minute to 24 hours** (usually < 1 hour). You'll get an email from Cloudflare when it's active.

While waiting, you can continue to Step 4.

### Step 4: Create the R2 bucket

1. In Cloudflare dashboard, look at the left sidebar → **R2 Object Storage**
2. First time only: Cloudflare asks you to **enable R2**. Click "Enable R2" or "Get Started."
3. It may ask for a payment method even on the free tier — add your card. You won't be charged unless you exceed the free tier.
4. Click **"Create bucket"**
5. Name it exactly: `cbee-media`
6. Location: **Asia-Pacific** (best latency for Indian users)
7. Storage class: **Standard** (the default)
8. Click **Create bucket**

The bucket is now live but private — only authenticated requests can access it.

### Step 5: Connect a public domain to the bucket

1. With the `cbee-media` bucket open, click the **Settings** tab
2. Scroll to **Public Access**
3. Click **Connect Domain**
4. Type: `media.cbee.in`
5. Click **Connect Domain** to confirm
6. Cloudflare auto-creates a DNS CNAME record. You'll see a green checkmark.

After this, `https://media.cbee.in/anything.jpg` will serve files from your R2 bucket via Cloudflare's CDN.

### Step 6: Set the CORS policy

CORS (Cross-Origin Resource Sharing) tells the browser which web origins can upload to your bucket. cbee's mobile app needs this configured.

1. In the `cbee-media` bucket → Settings → **CORS Policy**
2. Click **Add CORS policy** or **Edit**
3. Paste this JSON exactly:

```json
[
  {
    "AllowedOrigins": [
      "capacitor://localhost",
      "http://localhost",
      "https://localhost",
      "https://cbee.in",
      "https://app.cbee.in"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

4. Save

If the cbee app eventually adds a website at, say, `www.cbee.in`, you'd add that to AllowedOrigins later. For Phase 2 just the above.

### Step 7: Create the API token

This is what Bhaskar needs to put into the Supabase Edge Function so cbee can upload files to your bucket.

1. In Cloudflare dashboard, **R2 Object Storage** → **Manage R2 API Tokens** (top-right area)
2. Click **Create API token**
3. Name it: `cbee-upload-token`
4. Permissions: **Object Read & Write**
5. Specify bucket: select **only `cbee-media`** (not all buckets)
6. TTL: leave as "Forever" (no expiration)
7. Allowed IP addresses: leave blank (allow any)
8. Click **Create API Token**

You'll see, once and only once:

- **Access Key ID** (a long string)
- **Secret Access Key** (a longer string)
- **Endpoint** (a URL like `https://abc123.r2.cloudflarestorage.com`)
- **Account ID** (a 32-character string visible in the R2 dashboard too)

**SAVE ALL FOUR.** You won't be able to see the Secret Access Key again. Put them in your password manager (1Password / Bitwarden) as a secure note labeled "cbee-media R2 token."

### Step 8: Securely share the credentials with Bhaskar

Use the same two-channel approach as the keystore handoff (described in `docs/handoff/keystore_handoff.md`):

- **Channel A** (the credentials): paste the four values into a 1Password / Bitwarden shared vault, or a Google Doc shared only with Bhaskar.
- **Channel B** (encryption key, if you encrypted): voice call or different messaging app.

Never put the Secret Access Key in WhatsApp, email subject lines, plain Slack/Discord, or any unencrypted long-term log.

Tell Bhaskar in chat: "R2 credentials are in [vault/doc]. Access key starts with [first 4 characters as a hint]."

Bhaskar will put them into the Supabase Edge Function configuration and confirm receipt.

---

## Verification — make sure it's working

After Step 5 is done and nameservers have propagated (Step 3), test:

1. Open https://media.cbee.in in your browser
2. You should see a Cloudflare error page that says something like "404 Object Not Found" or "The bucket is empty" — that's correct. It means the domain is connected.
3. If you see a registrar parking page or "site not found," the DNS hasn't propagated yet. Wait an hour, try again.

Bhaskar will do a fuller end-to-end test once the Edge Function is configured.

---

## Without your own domain

If you don't have `cbee.in` (yet), R2 can still serve content via a Cloudflare-provided URL like `https://pub-abc123def456.r2.dev/anything.jpg`. Steps differ slightly:

1. Skip Steps 2 and 3 above (no domain to add)
2. In the R2 bucket Settings, instead of "Connect Domain" use **R2.dev subdomain**
3. Enable public access on the R2.dev URL
4. Note the URL Cloudflare gives you — that's your `R2_PUBLIC_HOST` for the Edge Function config

This works fine. The cost and performance are identical. The only downside is the URL looks less professional. You can always switch to a custom domain later by repeating Steps 2-5; the URLs in your database will all change but that's a 1-line SQL UPDATE Bhaskar can run.

**Recommendation:** spend the ₹1,000 on `cbee.in`. It's a one-time decision that makes everything cleaner.

---

## What happens next

After this is done:

1. Bhaskar gets the credentials from you (Step 8)
2. He configures the Supabase Edge Function during Week 1 of the sprint
3. He builds and tests against your R2 bucket
4. By the end of Week 1, cbee uploads are flowing to your R2 bucket
5. You'll start to see objects appearing in the R2 dashboard once people start posting

---

## Monthly check-in (after launch)

Once cbee is live, bookmark this and skim once a month:

**https://dash.cloudflare.com → R2 → cbee-media → Metrics**

What to look at:
- **Storage size** — grows with each post. Free up to 10 GB.
- **Class A operations (writes)** — should track new posts. Free up to 1 million per month.
- **Class B operations (reads)** — tracks how many times users view content. Free up to 10 million per month.
- **Bandwidth** — informational only; you never pay for this on R2.

When you exceed the free tier you'll start to see charges, but they're small and predictable. The full forecast at every scale is in `docs/operations/cost_model.md`.

---

## Frequently-stuck moments

### "Cloudflare wants my credit card even though I'm on the free tier"

That's normal. They want it for fraud prevention. As long as your usage stays under the free tier, your card won't be charged. Cloudflare also emails you before any usage-based charges start.

### "My nameservers aren't propagating"

Cloudflare emails when they're active. If it's been more than 24 hours: log into your registrar, verify the nameservers were saved (sometimes registrars silently revert changes). If still stuck, contact your registrar's support — they can force-refresh.

### "I see 'CNAME Cross-User Banned' when connecting media.cbee.in"

This happens if `media.cbee.in` was previously pointed somewhere else (like a different Cloudflare account, or a hosting provider). Go to your domain's DNS settings in Cloudflare, delete any existing record for `media`, then try Step 5 again.

### "I lost the Secret Access Key"

Tokens are one-time-view. If you lost it: in the R2 dashboard, delete the token and create a new one. Update Bhaskar with the new credentials.

### "Can I use Cloudflare R2 with cbee's existing data?"

Phase 1 posts (already in Supabase Storage) stay there. They don't break. They just keep being served from Supabase. New posts (Phase 2 onwards) go to R2. Over a few months, R2 dominates because new posts vastly outnumber old ones. No migration needed.

### "What if I want to switch away from Cloudflare R2 later?"

R2 uses the standard S3 API. Any S3-compatible service (AWS, Bunny, DigitalOcean Spaces, Hetzner Object Storage) works the same way. Switching would mean Bhaskar (or any future dev) updates the Edge Function's endpoint URL — about 30 minutes of work, no other code changes. So this is a low-risk decision.

---

## Final checklist

Before telling Bhaskar you're done:

- [ ] Cloudflare account created with strong password
- [ ] `cbee.in` domain added to Cloudflare (if applicable)
- [ ] Nameservers updated at registrar (if applicable)
- [ ] DNS propagation complete (you got the email from Cloudflare)
- [ ] R2 bucket `cbee-media` created in Asia-Pacific region
- [ ] Public domain `media.cbee.in` (or R2.dev URL) connected
- [ ] CORS policy added with the exact JSON above
- [ ] API token `cbee-upload-token` created with Object Read & Write
- [ ] All four credentials saved to password manager (Access Key ID, Secret Access Key, Endpoint, Account ID)
- [ ] Credentials shared with Bhaskar via secure channel

When all checked, you're done. Send Bhaskar a chat: "Cloudflare R2 setup complete, credentials in [vault]."

---

**Next:** continue with `apple_developer_setup.md` and `google_play_setup.md` if you haven't, or read `docs/handoff/going_live.md` once your dev accounts are also active.
