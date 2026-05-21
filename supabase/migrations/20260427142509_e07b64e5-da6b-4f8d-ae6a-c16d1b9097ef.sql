
-- =========================================================
-- Helper: updated_at trigger
-- =========================================================
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- profiles
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  bio text,
  avatar_url text,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  posts_count integer not null default 0,
  privacy_policy_accepted boolean not null default false,
  privacy_policy_accepted_at timestamptz,
  account_deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users can delete their own profile"
  on public.profiles for delete using (auth.uid() = id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', null),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', null),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- posts
-- =========================================================
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  caption text,
  media_url text,
  type text not null default 'photo' check (type in ('photo','video')),
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_posts_user_id on public.posts(user_id);
create index idx_posts_created_at on public.posts(created_at desc);

alter table public.posts enable row level security;

create policy "Posts are viewable by everyone"
  on public.posts for select using (true);

create policy "Users can insert their own posts"
  on public.posts for insert with check (auth.uid() = user_id);

create policy "Users can update their own posts"
  on public.posts for update using (auth.uid() = user_id);

create policy "Users can delete their own posts"
  on public.posts for delete using (auth.uid() = user_id);

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.update_updated_at_column();

-- Maintain profiles.posts_count
create or replace function public.handle_post_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.profiles set posts_count = posts_count + 1 where id = new.user_id;
  elsif (tg_op = 'DELETE') then
    update public.profiles set posts_count = greatest(posts_count - 1, 0) where id = old.user_id;
  end if;
  return null;
end;
$$;

create trigger posts_count_trigger
  after insert or delete on public.posts
  for each row execute function public.handle_post_count();

-- =========================================================
-- likes
-- =========================================================
create table public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index idx_likes_post_id on public.likes(post_id);
create index idx_likes_user_id on public.likes(user_id);

alter table public.likes enable row level security;

create policy "Likes are viewable by everyone"
  on public.likes for select using (true);

create policy "Users can like as themselves"
  on public.likes for insert with check (auth.uid() = user_id);

create policy "Users can unlike their own likes"
  on public.likes for delete using (auth.uid() = user_id);

create or replace function public.handle_like_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger likes_count_trigger
  after insert or delete on public.likes
  for each row execute function public.handle_like_count();

-- =========================================================
-- comments
-- =========================================================
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_comments_post_id on public.comments(post_id);
create index idx_comments_user_id on public.comments(user_id);

alter table public.comments enable row level security;

create policy "Comments are viewable by everyone"
  on public.comments for select using (true);

create policy "Users can create comments as themselves"
  on public.comments for insert with check (auth.uid() = user_id);

create policy "Users can update their own comments"
  on public.comments for update using (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on public.comments for delete using (auth.uid() = user_id);

create trigger comments_updated_at
  before update on public.comments
  for each row execute function public.update_updated_at_column();

create or replace function public.handle_comment_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set comments_count = comments_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger comments_count_trigger
  after insert or delete on public.comments
  for each row execute function public.handle_comment_count();

-- =========================================================
-- follows
-- =========================================================
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create index idx_follows_follower on public.follows(follower_id);
create index idx_follows_following on public.follows(following_id);

alter table public.follows enable row level security;

create policy "Follows are viewable by everyone"
  on public.follows for select using (true);

create policy "Users can follow as themselves"
  on public.follows for insert with check (auth.uid() = follower_id);

create policy "Users can unfollow their own follows"
  on public.follows for delete using (auth.uid() = follower_id);

create or replace function public.handle_follow_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    update public.profiles set following_count = following_count + 1 where id = new.follower_id;
    update public.profiles set followers_count = followers_count + 1 where id = new.following_id;
  elsif (tg_op = 'DELETE') then
    update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    update public.profiles set followers_count = greatest(followers_count - 1, 0) where id = old.following_id;
  end if;
  return null;
end;
$$;

create trigger follows_count_trigger
  after insert or delete on public.follows
  for each row execute function public.handle_follow_count();

-- =========================================================
-- messages
-- =========================================================
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  media_url text,
  media_type text check (media_type in ('image','video','gif','sticker')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_messages_sender on public.messages(sender_id);
create index idx_messages_receiver on public.messages(receiver_id);
create index idx_messages_created_at on public.messages(created_at desc);

alter table public.messages enable row level security;

create policy "Sender or receiver can view messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send messages as themselves"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "Receiver can update read status"
  on public.messages for update
  using (auth.uid() = receiver_id or auth.uid() = sender_id);

create policy "Sender can delete their messages"
  on public.messages for delete
  using (auth.uid() = sender_id);

alter publication supabase_realtime add table public.messages;
alter table public.messages replica identity full;

-- =========================================================
-- pets
-- =========================================================
create table public.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text,
  breed text,
  age text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_pets_user_id on public.pets(user_id);

alter table public.pets enable row level security;

create policy "Pets are viewable by everyone"
  on public.pets for select using (true);

create policy "Users can create their own pets"
  on public.pets for insert with check (auth.uid() = user_id);

create policy "Users can update their own pets"
  on public.pets for update using (auth.uid() = user_id);

create policy "Users can delete their own pets"
  on public.pets for delete using (auth.uid() = user_id);

create trigger pets_updated_at
  before update on public.pets
  for each row execute function public.update_updated_at_column();

-- =========================================================
-- search_history
-- =========================================================
create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  query text not null,
  created_at timestamptz not null default now()
);

create index idx_search_history_user on public.search_history(user_id, created_at desc);

alter table public.search_history enable row level security;

create policy "Users view their own search history"
  on public.search_history for select using (auth.uid() = user_id);

create policy "Users insert their own search history"
  on public.search_history for insert with check (auth.uid() = user_id);

create policy "Users delete their own search history"
  on public.search_history for delete using (auth.uid() = user_id);

-- =========================================================
-- Storage buckets
-- =========================================================
insert into storage.buckets (id, name, public) values ('posts', 'posts', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('messages', 'messages', true)
  on conflict (id) do nothing;

-- posts bucket policies (public read, authenticated users write to their own folder)
create policy "Posts media public read"
  on storage.objects for select
  using (bucket_id = 'posts');

create policy "Authenticated users upload posts media"
  on storage.objects for insert
  with check (bucket_id = 'posts' and auth.uid() is not null);

create policy "Users update their own posts media"
  on storage.objects for update
  using (bucket_id = 'posts' and auth.uid() is not null);

create policy "Users delete their own posts media"
  on storage.objects for delete
  using (bucket_id = 'posts' and auth.uid() is not null);

-- messages bucket policies
create policy "Messages media public read"
  on storage.objects for select
  using (bucket_id = 'messages');

create policy "Authenticated users upload messages media"
  on storage.objects for insert
  with check (bucket_id = 'messages' and auth.uid() is not null);

create policy "Users update their own messages media"
  on storage.objects for update
  using (bucket_id = 'messages' and auth.uid() is not null);

create policy "Users delete their own messages media"
  on storage.objects for delete
  using (bucket_id = 'messages' and auth.uid() is not null);
