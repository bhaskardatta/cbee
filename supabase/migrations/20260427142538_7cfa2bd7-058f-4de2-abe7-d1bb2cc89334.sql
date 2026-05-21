
-- Add missing post fields used by the UI
alter table public.posts
  add column if not exists location text,
  add column if not exists hashtags text[];

-- Tighten storage policies: scope writes to the user's own folder (first path segment = auth.uid())
drop policy if exists "Authenticated users upload posts media" on storage.objects;
drop policy if exists "Users update their own posts media" on storage.objects;
drop policy if exists "Users delete their own posts media" on storage.objects;
drop policy if exists "Authenticated users upload messages media" on storage.objects;
drop policy if exists "Users update their own messages media" on storage.objects;
drop policy if exists "Users delete their own messages media" on storage.objects;

create policy "Users upload to their own posts folder"
  on storage.objects for insert
  with check (
    bucket_id = 'posts'
    and auth.uid() is not null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] = 'avatars'
    )
  );

create policy "Users update their own posts files"
  on storage.objects for update
  using (
    bucket_id = 'posts'
    and auth.uid() is not null
    and owner = auth.uid()
  );

create policy "Users delete their own posts files"
  on storage.objects for delete
  using (
    bucket_id = 'posts'
    and auth.uid() is not null
    and owner = auth.uid()
  );

create policy "Users upload to their own messages folder"
  on storage.objects for insert
  with check (
    bucket_id = 'messages'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update their own messages files"
  on storage.objects for update
  using (
    bucket_id = 'messages'
    and auth.uid() is not null
    and owner = auth.uid()
  );

create policy "Users delete their own messages files"
  on storage.objects for delete
  using (
    bucket_id = 'messages'
    and auth.uid() is not null
    and owner = auth.uid()
  );
