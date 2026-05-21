# 02 — Data Model

**Schema as it exists today, the additions Phase 2 makes, and the critical backfill that fixes the silent home-feed bug.**

This doc supersedes the SQL inlined in the original tech plan. The original plan had a subtle bug — adding `media_kind` with `default 'image'` would mark every pre-existing video post as an image, breaking the Reels feed query for legacy content. The migration below fixes that with an explicit backfill.

---

## Phase 1 schema (already shipped)

Tables you'll touch in Phase 2:

```sql
-- profiles
id uuid primary key references auth.users(id) on delete cascade
username text unique
full_name text
avatar_url text
bio text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()

-- posts (this one matters most)
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
type text not null check (type in ('photo', 'video'))     -- EXISTS in Phase 1
media_url text not null
caption text
location text
hashtags text[] default '{}'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()

-- likes
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
post_id uuid not null references public.posts(id) on delete cascade
created_at timestamptz not null default now()
unique (user_id, post_id)

-- comments
id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
post_id uuid not null references public.posts(id) on delete cascade
text text not null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Other Phase 1 tables (out of Phase 2 scope, listed for orientation): `follows`, `messages` (DMs), `notifications`, `push_tokens`, `donations`, `pets`.

All of the above have RLS enabled. The policy patterns are: "users can read all profiles," "users can update their own row," "users can delete their own row." Match these patterns exactly for new tables.

---

## Phase 2 additions — what we add and why

### On the `posts` table — 5 new columns

| Column                 | Type            | Why                                                                                                   |
| ---------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| `media_kind`           | text            | New canonical content kind (`'image' \| 'video' \| 'reel'`). Differentiates reels from regular videos. |
| `media_aspect_ratio`   | text            | `'1:1' \| '4:5' \| '9:16' \| '16:9'` — drives layout decisions in the feed and Reels.                  |
| `duration_seconds`     | numeric(5,2)    | Video duration. NULL for images. Lets us cap reels at 60s in the query.                                |
| `thumbnail_url`        | text            | Pre-generated thumbnail for video posts. NULL for images. Avoids loading the full video in the feed.   |
| `is_featured`          | boolean         | Admin override: floats this post to the top of the Reels feed. Default `false`.                        |
| `view_count`           | integer         | Denormalized count from `reel_views`. Maintained by trigger. Default `0`.                              |

### New tables

```
reel_views          1 row per (reel_id, user_id) the first time the user dwells >1.5s on a reel.
                    Powers analytics and the view_count column.
                    RLS: users insert their own; users read their own; post owner reads aggregates.

reports             1 row per content report.  See docs/features/moderation_mvp.md.
                    Columns: id, reporter_id, post_id, reason, status, created_at.
                    RLS: users can insert (against any post except their own);
                         no client-side read (admin queries via service role in Supabase Studio).
```

### New storage location — Cloudflare R2 (NOT Supabase Storage)

Per ADR-017, all new photo and video media lives in a Cloudflare R2 bucket served via the `media.cbee.in` subdomain. **We do not create a Supabase Storage bucket for Phase 2 content.** Phase 1's `messages` bucket stays as-is (chat attachments). Phase 1's legacy post media continues to serve from wherever it currently is, no migration.

Full setup, edge function code, and upload flow: see `docs/features/media_storage.md`.

---

## The full Phase 2 migration

**File:** `supabase/migrations/<YYYYMMDDhhmmss>_phase2_camera_reels.sql`

Match the existing migration timestamp format (`YYYYMMDDhhmmss` followed by `_<descriptive_name>.sql`). Use the date/time when you first commit it.

```sql
-- ============================================================================
-- Phase 2: Native Camera + Reels Feed
-- Author: Spurt Studios
-- Purpose: Schema additions for camera capture and vertical-swipe video feed
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend posts table — 5 new columns
-- ----------------------------------------------------------------------------
alter table public.posts
  add column if not exists media_kind text
    check (media_kind in ('image', 'video', 'reel'))
    default 'image',
  add column if not exists media_aspect_ratio text
    check (media_aspect_ratio in ('1:1', '4:5', '9:16', '16:9'))
    default '1:1',
  add column if not exists duration_seconds numeric(5,2),
  add column if not exists thumbnail_url text,
  add column if not exists is_featured boolean default false,
  add column if not exists view_count integer default 0;

-- ----------------------------------------------------------------------------
-- 2. ★ CRITICAL BACKFILL — fixes the silent legacy-video-as-image bug
-- ----------------------------------------------------------------------------
-- The `add column ... default 'image'` above sets every existing row's
-- media_kind to 'image'.  But existing posts where `type = 'video'` SHOULD
-- have media_kind = 'video' — without this backfill, the Reels feed's
-- WHERE media_kind = 'video' query misses every pre-Phase-2 video post.
--
-- This backfill is idempotent: only updates rows where media_kind doesn't
-- match the legacy `type` column.
update public.posts
set media_kind = case
  when type = 'video' then 'video'
  when type = 'photo' then 'image'
  else 'image'
end
where (type = 'video' and media_kind <> 'video')
   or (type = 'photo' and media_kind <> 'image');

-- ----------------------------------------------------------------------------
-- 3. Keep type and media_kind in sync going forward
-- ----------------------------------------------------------------------------
-- We don't drop `type` yet (would break Phase 1 code paths that read it).
-- Instead a BEFORE trigger keeps them aligned, regardless of which column
-- the caller writes.  Drop the trigger + the `type` column in Phase 3.
create or replace function public.sync_posts_type_and_media_kind()
returns trigger as $$
begin
  -- If media_kind is set and type isn't, derive type
  if new.media_kind is not null and new.type is null then
    new.type := case
      when new.media_kind in ('video', 'reel') then 'video'
      else 'photo'
    end;
  end if;
  -- If type is set and media_kind isn't, derive media_kind
  if new.type is not null and new.media_kind is null then
    new.media_kind := case
      when new.type = 'video' then 'video'
      else 'image'
    end;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists posts_sync_type_media_kind on public.posts;
create trigger posts_sync_type_media_kind
  before insert or update on public.posts
  for each row execute function public.sync_posts_type_and_media_kind();

-- ----------------------------------------------------------------------------
-- 4. Indexes that actually matter
-- ----------------------------------------------------------------------------
create index if not exists posts_media_kind_created_at_idx
  on public.posts (media_kind, created_at desc);

create index if not exists posts_user_id_created_at_idx
  on public.posts (user_id, created_at desc);

-- Partial index — only featured posts get this row, keeps the index small.
create index if not exists posts_is_featured_created_at_idx
  on public.posts (is_featured, created_at desc)
  where is_featured = true;

-- ----------------------------------------------------------------------------
-- 5. reel_views table
-- ----------------------------------------------------------------------------
create table if not exists public.reel_views (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (reel_id, user_id)
);

create index if not exists reel_views_reel_id_idx on public.reel_views (reel_id);

alter table public.reel_views enable row level security;

create policy "users insert own reel views"
  on public.reel_views for insert
  with check (auth.uid() = user_id);

create policy "users read own reel views"
  on public.reel_views for select
  using (auth.uid() = user_id);

create policy "post owner reads aggregate views"
  on public.reel_views for select
  using (exists (
    select 1 from public.posts p
    where p.id = reel_views.reel_id and p.user_id = auth.uid()
  ));

-- ----------------------------------------------------------------------------
-- 6. Denormalize view count via trigger
-- ----------------------------------------------------------------------------
-- count(*) on reel_views for a popular reel hits 100k+ rows and is slow.
-- Maintain posts.view_count via insert trigger.  Cheap insert cost, fast read.
create or replace function public.increment_reel_view_count()
returns trigger as $$
begin
  update public.posts
  set view_count = view_count + 1
  where id = new.reel_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists reel_view_count_increment on public.reel_views;
create trigger reel_view_count_increment
  after insert on public.reel_views
  for each row execute function public.increment_reel_view_count();

-- ----------------------------------------------------------------------------
-- 7. reports table (moderation MVP)
-- ----------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  reason text not null check (reason in (
    'spam',
    'nudity_or_sexual',
    'violence_or_gore',
    'hate_speech',
    'not_pet_content',
    'harassment',
    'other'
  )),
  details text,                       -- optional free-text from the reporter
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists reports_status_created_at_idx
  on public.reports (status, created_at desc);

create index if not exists reports_post_id_idx
  on public.reports (post_id);

-- Prevent duplicate reports from the same user on the same post
create unique index if not exists reports_unique_user_post_idx
  on public.reports (reporter_id, post_id);

alter table public.reports enable row level security;

-- Users can file reports on others' posts (not their own)
create policy "users file reports"
  on public.reports for insert
  with check (
    auth.uid() = reporter_id
    and exists (
      select 1 from public.posts p
      where p.id = reports.post_id
        and p.user_id <> auth.uid()
    )
  );

-- Users can see their own filed reports (for "report submitted" feedback)
create policy "users read own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

-- No public read of all reports — admin queries via service role in Supabase Studio.

-- ----------------------------------------------------------------------------
-- 8. Storage — NOT in Supabase
-- ----------------------------------------------------------------------------
-- Per ADR-017, photo and video media for Phase 2 lives in Cloudflare R2,
-- not Supabase Storage. There is no Supabase storage bucket to create here.
-- Upload happens via a Supabase Edge Function (`get-upload-url`) that issues
-- a signed PUT URL for R2. See docs/features/media_storage.md.
--
-- Phase 1's `messages` bucket stays as-is (chat attachments use it).
```

---

## What you can and can't change later

**Safely additive (can ship in a hotfix later):**
- New columns on `posts` (use `add column if not exists ... default ...`)
- New indexes
- New RLS policies (additive — never restrictive without checking app behavior)
- New tables
- New storage buckets

**Will break things in production (don't do mid-sprint):**
- Dropping `posts.type` — breaks Phase 1 code that reads it
- Changing `media_kind` enum values — breaks any client that hasn't updated yet
- Changing aspect_ratio enum values — same
- Changing storage RLS to be more restrictive — silently breaks uploads

If we need to change any of the last category mid-sprint, treat it as a full deploy event with client coordination.

---

## How to apply the migration

Locally (with Supabase CLI):

```bash
# From repo root, against the local Supabase dev instance
supabase db reset                                    # nuke and re-apply all migrations (DEV ONLY)

# Or, to apply just the new migration against staging:
supabase db push --linked
```

Against production: Supabase Studio → SQL Editor → paste the migration → run. Then commit the file to `supabase/migrations/` with the same timestamp it ran with in production.

Save the run timestamp; we want migration history in sync between the repo and Supabase.

---

## Verifying the backfill worked

After running the migration, sanity-check:

```sql
-- These two counts should match
select count(*) from public.posts where type = 'video';
select count(*) from public.posts where media_kind = 'video';

-- And these
select count(*) from public.posts where type = 'photo';
select count(*) from public.posts where media_kind = 'image';

-- And there should be no rows with media_kind = NULL
select count(*) from public.posts where media_kind is null;   -- expect 0

-- Plus the trigger should keep them aligned on new inserts:
insert into public.posts (user_id, type, media_url) values
  ('<some-test-uuid>', 'video', 'https://example.com/test.mp4');
-- Then verify media_kind got set to 'video' automatically:
select type, media_kind from public.posts where media_url = 'https://example.com/test.mp4';
```

If any of these don't match, **stop, don't ship the migration to production**. The backfill is the most important line in the file.

---

**Next:** `docs/03_DECISIONS.md` for the architectural rationale, or `docs/features/camera.md` if you're starting the camera implementation.
