# Operations: Cost Model

**What cbee costs Swaroop to run, at every scale, with the R2 architecture we chose.** This doc answers two questions: "what's the bill today?" and "what will it be when we have N users?"

The TL;DR is that the architecture (ADR-017) is designed so the bill grows roughly linearly with usage and the codebase doesn't change between 0 and 100,000 DAU. Swaroop pays more in dashboards as usage grows — never in code.

---

## What flows through the app — the bytes audit

To estimate costs, you have to know what's actually being moved. Three categories, in descending order of bytes:

**1. Video egress (the dominant cost driver).** Every reel autoplay, preload of an adjacent slide, and replay. With the `videoBitrate: 3500000` cap in `useNativeCamera` (see `docs/features/camera.md`), a 30-second 1080p video is ~13MB. Without the cap, default device encoding produces ~22MB — 70% more bandwidth for life. This single setting is worth real money.

**2. Image egress.** Feed posts, profile avatars, thumbnails in the reels feed. With the upload pipeline's resize to ≤2MB (and we should push that to 400KB-ish for posts), images are 200-500KB each.

**3. Everything else (negligible).** DB queries, auth tokens, push registration, chat messages, edge function responses, signed URL issuance. Combined, this is rounding error against video egress.

**Storage growth is small.** Cumulative media per active user works out to roughly 50MB over the first year (posts × average size, accounting for some thumbnail overhead). At 10,000 DAU that's 500GB total — about $7.50/month on R2. Storage is essentially free at our scale. Egress is what matters, and on R2 egress is free at any scale. This is the whole point of ADR-017.

---

## Bill components

cbee has four billable lines after Phase 2 ships. Per-month, in USD:

| Line item                   | Cost driver                                 | Floor    | What grows it                              |
| --------------------------- | ------------------------------------------- | -------- | ------------------------------------------ |
| Supabase Pro                | Subscription                                | $25      | Compute tier (Micro → Small) at scale     |
| Supabase MAU overage        | Monthly active users over 100k              | $0       | $0.00325/MAU over 100k                     |
| Cloudflare R2 storage       | GB-months stored                            | $0       | $0.015/GB/month (10GB free)               |
| Cloudflare R2 ops           | Class A writes + Class B reads              | $0       | $4.50 / 1M writes, $0.36 / 1M reads       |
| Cloudflare R2 egress        | n/a                                         | $0       | **always $0** — the whole point           |
| Apple Dev (annualized)      | $99/year                                    | ~$8.25   | flat                                       |
| Google Play Console         | $25 one-time                                | ~$0      | flat                                       |
| Domain (cbee.in)            | Yearly registration                          | ~$1      | flat                                       |

The "floor" is what Swaroop pays even with zero users. Everything else is usage-driven.

---

## Cost at five scales

Assumptions, stated for honesty:
- Per active user: 5 reels fully watched + 12 partial preloads + 30 feed images per day
- Average reel size with bitrate cap: 13 MB
- Average image size: 350 KB
- Average user lifetime media accumulation: 50 MB/year (3 posts/month × 1 MB average)
- 30 days per month
- Reads = views; we ignore the small CDN cache-hit benefit since R2 doesn't bill egress regardless

**Per-DAU monthly data:**
- Video: 5 watched × 13 MB + 12 preloads × 4 MB ≈ 113 MB/day = 3.4 GB/month per DAU
- Image: 30 × 350 KB = 10 MB/day = 0.3 GB/month per DAU
- **Total per DAU: ~3.7 GB/month egress**
- Reads (R2 GET ops): 5 + 12 + 30 = ~47 reads/day per DAU = ~1,400/month

| Scale       | Monthly egress | R2 storage | R2 read ops | R2 cost | Supabase | **Monthly total** |
| ----------- | -------------- | ---------- | ----------- | ------- | -------- | ------------------ |
| 0 DAU       | 0              | 0          | 0           | $0      | $25      | **$25 + $9 fixed = ~$34** |
| 100 DAU     | 370 GB         | 5 GB       | 140k        | $0 (free tier) | $25     | **~$34**         |
| 1,000 DAU   | 3.7 TB         | 50 GB      | 1.4M        | $1 + $11 = $12 | $25 | **~$46**         |
| 10,000 DAU  | 37 TB          | 500 GB     | 14M         | $8 + $108 = $116 | $25 + ~$10 compute | **~$160** |
| 100,000 DAU | 370 TB         | 5 TB       | 140M        | $75 + $1,080 = $1,155 | $25 + ~$10 MAU overage + ~$25 compute | **~$1,225** |

The "$9 fixed" is the amortized Apple Dev + Google Play + domain — same at every scale.

In INR (at ₹85/$): 100 DAU is roughly **₹2,900/month**. 1,000 DAU is **₹3,900/month**. 10,000 DAU is **₹13,600/month**. 100,000 DAU is **₹1,04,000/month** — for serving the equivalent of mid-Instagram engagement to a hundred thousand people every day.

---

## What it would have cost on Supabase Storage (the rejected alternative)

For context, what Swaroop avoided by choosing R2:

| Scale       | Supabase egress overage              | **Supabase-only monthly total**     |
| ----------- | ------------------------------------ | ----------------------------------- |
| 0-100 DAU   | within 250 GB Pro quota              | $25                                 |
| 1,000 DAU   | 3.7 TB - 0.25 TB = 3.45 TB × $0.09  | $25 + $311 = **$336**               |
| 10,000 DAU  | 37 TB - 0.25 TB = ~37 TB × $0.09    | $25 + $3,330 = **$3,355**           |
| 100,000 DAU | 370 TB × $0.09                       | $25 + $33,300 = **$33,325**         |

At 100,000 DAU, the difference is **$32,000/month** ≈ **₹27 lakh/month** of money saved by choosing R2 on Day 1.

This is not a hypothetical optimization. It's the difference between cbee being a viable business at scale vs being financially destroyed by its own success.

---

## What dev-side decisions are baked in to keep costs low

These are already in the Phase 2 plan; documenting them here so the connection to costs is explicit.

| Decision                                     | Cost impact                                  | Where it lives                |
| -------------------------------------------- | -------------------------------------------- | ----------------------------- |
| `videoBitrate: 3500000` cap in camera        | -40% video bytes forever                     | `docs/features/camera.md`     |
| Image resize to ≤2MB at upload                | -80% vs raw camera image                     | `docs/features/upload_flow.md` |
| `preload="metadata"` on WiFi, `"none"` on cellular | Cellular users only pay for what they tap | `docs/features/reels.md`      |
| Three-slide mount window in Reels            | -90% wasted preload from scrolling fast      | `docs/features/reels.md`      |
| 60-second hard cap on video duration         | Bounds per-video size                        | `docs/features/upload_flow.md` |
| `object-fit: contain` (not crop+re-upload)    | One file per post, no derivatives             | `docs/features/reels.md`      |

If any of these are removed, the cost curve shifts upward proportionally.

---

## Cost monitoring — what Swaroop should check monthly

The early-warning system. ~5 minutes once a month.

### Cloudflare R2 dashboard
URL: https://dash.cloudflare.com → R2 → `cbee-media` bucket → Metrics

Look at:
- **Storage size** — should grow linearly with active users
- **Class A operations (writes)** — should track ~1 per post + 1 per thumbnail
- **Class B operations (reads)** — the biggest line; tracks user engagement
- **Bandwidth** — informational only, NEVER billed; nice to see the savings

If any line spikes 5×+ in a single month without a known cause (a viral reel, a marketing push, new feature launch), investigate. Could be an abuse pattern (someone uploading max-size videos at high frequency) or a bug (a loop that keeps re-uploading).

### Supabase dashboard
URL: https://supabase.com/dashboard/project/<id> → Reports

Look at:
- **Database size** — should stay well under 8 GB for the first ~year
- **Egress (Database)** — this is API responses, not media. Watch for unexpected spikes; could indicate an inefficient query
- **MAU count** — once it nears 100,000, plan to scale the project
- **Compute usage** — bump to Small ($10/month extra) if you see >70% sustained

### A simple monthly trigger system

Bookmark these and run as a habit:

| If you see this in the dashboard...                  | Do this                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| R2 storage > 50 GB                                   | Nothing yet, just acknowledge growth                                   |
| R2 storage > 500 GB                                  | Sanity check — are old/deleted posts cleaning up?                      |
| R2 Class A ops > 10M/month                           | Investigate — that's a lot of writes for the user base                 |
| R2 Class B ops > 100M/month                          | Working as intended at scale; bill is fine                             |
| Supabase database > 4 GB                             | Look at table sizes; usually a denormalization gone wrong              |
| Supabase MAU near 95,000                             | Plan project scaling — Team plan, or split into multi-project          |
| Supabase compute "Micro" at >80% sustained           | Bump to "Small" ($10/month) — dashboard click, no code                |
| Total monthly bill > $80                             | You're past the "free flow" — schedule a Phase 3 conversation         |
| Total monthly bill > $500                            | Worth optimizing — image sizes, video bitrate, query patterns          |
| Total monthly bill > $2,000                          | Time for Mux/Bunny conversation, dedicated infra review                |

---

## When to revisit the architecture

The R2 architecture scales cleanly to ~100,000 DAU. Beyond that, here's when each piece becomes worth a Phase 4+ conversation:

| When you hit...                              | Consider...                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 50,000+ DAU                                  | Server-side video transcoding for adaptive bitrate (Mux $0.005/min, or a self-hosted ffmpeg) — phones get HLS based on their bandwidth |
| 100,000+ DAU on a single Supabase project    | Multi-region setup or split into multiple projects                                                |
| Video content moderation becomes a 4hr/day job | Migrate from manual SQL triage to automated ML classification (Cloud Vision, Hive, Sightengine) |
| Latency in India poor                        | R2 region selection (currently auto); also consider a separate Mumbai-hosted Postgres replica   |
| Cold-start lag on Edge Function uploads      | Pre-warm strategy or move to Cloudflare Workers for the signing                                  |

None of these are Phase 2 problems. They're milestones to watch for, with rough trigger points.

---

## What this means for ongoing operating cost — Swaroop's honest expectation

For the first 6-12 months at <500 DAU, cbee will cost Swaroop:

- Supabase Pro: $25/month
- Cloudflare R2: $0 (within free tier)
- Apple Developer annualized: ~$8.25/month
- Google Play, domain: ~$1/month combined

**Total realistic monthly cost: $35-40 = ₹3,000-3,400.**

If cbee grows past 1,000 DAU, expect ~$50/month = ~₹4,200. If it grows past 10,000 DAU, expect ~$160/month = ~₹13,600.

These are real, predictable numbers. There's no "iceberg" hidden in this architecture.

---

**See also:** `docs/03_DECISIONS.md` ADR-017 for the architectural rationale, `docs/features/media_storage.md` for the implementation, `welcome_pack/cloudflare_setup.md` for Swaroop's R2 setup walkthrough.
