-- ============================================================================
-- Phase 2: Native Camera + Reels Feed
-- Author: Spurt Studios
-- Date:   2026-05-13
-- Purpose: Schema additions for camera capture and vertical-swipe video feed.
--          Includes the CRITICAL backfill that fixes the silent legacy-video-
--          as-image bug (see docs/02_DATA_MODEL.md).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extend posts table — 5 new columns (+ view_count)
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
-- Idempotent: only touches rows where media_kind doesn't match legacy type.
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

drop policy if exists "users insert own reel views" on public.reel_views;
create policy "users insert own reel views"
  on public.reel_views for insert
  with check (auth.uid() = user_id);

drop policy if exists "users read own reel views" on public.reel_views;
create policy "users read own reel views"
  on public.reel_views for select
  using (auth.uid() = user_id);

drop policy if exists "post owner reads aggregate views" on public.reel_views;
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
  set view_count = coalesce(view_count, 0) + 1
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
drop policy if exists "users file reports" on public.reports;
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
drop policy if exists "users read own reports" on public.reports;
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
-- Phase 1's `messages` bucket stays as-is (chat attachments continue to use it).
