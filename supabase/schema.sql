-- Microblog backend schema for Supabase
-- Run in Supabase SQL editor

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  bio text,
  location text,
  website text,
  avatar_url text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Posts (includes replies)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) <= 140),
  reply_to_id uuid references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_author_id_idx on public.posts(author_id);
create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_reply_to_id_idx on public.posts(reply_to_id);
create index if not exists profiles_username_idx on public.profiles(username);

create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

-- Pin post to profile
alter table public.profiles
add column if not exists pinned_post_id uuid references public.posts(id) on delete set null;

-- Reposts and Quotes (single table)
create table if not exists public.reposts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  type text not null default 'repost' check (type in ('repost', 'quote')),
  quote_text text,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create index if not exists reposts_post_id_idx on public.reposts(post_id);
create index if not exists reposts_user_id_idx on public.reposts(user_id);
create index if not exists follows_follower_id_idx on public.follows(follower_id);
create index if not exists follows_followee_id_idx on public.follows(followee_id);

-- Likes
create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists likes_post_id_idx on public.likes(post_id);

-- Follows
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists follows_followee_id_idx on public.follows(followee_id);

-- Mutes
create table if not exists public.mutes (
  muter_id uuid not null references public.profiles(id) on delete cascade,
  muted_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);

create index if not exists mutes_muted_id_idx on public.mutes(muted_id);

-- Blocks
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_id_idx on public.blocks(blocked_id);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  type text not null check (type in ('follow', 'like', 'repost', 'quote', 'reply')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_id_idx on public.notifications(user_id, created_at desc);

-- Media (for uploaded images)
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  bucket text not null default 'media',
  path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists media_post_id_idx on public.media(post_id);

-- Create media bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Profiles auto-create on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  base_username text;
begin
  base_username := coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  insert into public.profiles (id, username, display_name)
  values (new.id, lower(base_username), new.raw_user_meta_data->>'name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.reposts enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.mutes enable row level security;
alter table public.blocks enable row level security;
alter table public.notifications enable row level security;
alter table public.media enable row level security;

-- Profiles policies
create policy profiles_select_public
on public.profiles for select
using (
  is_private = false
  or auth.uid() = id
  or exists (
    select 1 from public.follows f
    where f.followee_id = profiles.id and f.follower_id = auth.uid()
  )
);

create policy profiles_insert_own
on public.profiles for insert
with check (auth.uid() = id);

create policy profiles_update_own
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Posts policies
create policy posts_select_public
on public.posts for select
using (
  exists (
    select 1 from public.profiles p
    where p.id = posts.author_id
      and (
        p.is_private = false
        or p.id = auth.uid()
        or exists (
          select 1 from public.follows f
          where f.followee_id = p.id and f.follower_id = auth.uid()
        )
      )
  )
);

create policy posts_insert_own
on public.posts for insert
with check (auth.uid() = author_id);

create policy posts_update_own
on public.posts for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy posts_delete_own
on public.posts for delete
using (auth.uid() = author_id);

-- Reposts policies
create policy reposts_select_public
on public.reposts for select
using (
  exists (
    select 1 from public.posts p
    join public.profiles pr on pr.id = p.author_id
    where p.id = reposts.post_id
      and (
        pr.is_private = false
        or pr.id = auth.uid()
        or exists (
          select 1 from public.follows f
          where f.followee_id = pr.id and f.follower_id = auth.uid()
        )
      )
  )
);

create policy reposts_insert_own
on public.reposts for insert
with check (auth.uid() = user_id);

create policy reposts_delete_own
on public.reposts for delete
using (auth.uid() = user_id);

-- Likes policies
create policy likes_select_public
on public.likes for select
using (
  exists (
    select 1 from public.posts p
    join public.profiles pr on pr.id = p.author_id
    where p.id = likes.post_id
      and (
        pr.is_private = false
        or pr.id = auth.uid()
        or exists (
          select 1 from public.follows f
          where f.followee_id = pr.id and f.follower_id = auth.uid()
        )
      )
  )
);

create policy likes_insert_own
on public.likes for insert
with check (auth.uid() = user_id);

create policy likes_delete_own
on public.likes for delete
using (auth.uid() = user_id);

-- Follows policies
create policy follows_select_all
on public.follows for select
using (true);

create policy follows_insert_own
on public.follows for insert
with check (auth.uid() = follower_id);

create policy follows_delete_own
on public.follows for delete
using (auth.uid() = follower_id);

-- Mutes policies
create policy mutes_select_own
on public.mutes for select
using (auth.uid() = muter_id);

create policy mutes_insert_own
on public.mutes for insert
with check (auth.uid() = muter_id);

create policy mutes_delete_own
on public.mutes for delete
using (auth.uid() = muter_id);

-- Blocks policies
create policy blocks_select_own
on public.blocks for select
using (auth.uid() = blocker_id);

create policy blocks_insert_own
on public.blocks for insert
with check (auth.uid() = blocker_id);

create policy blocks_delete_own
on public.blocks for delete
using (auth.uid() = blocker_id);

-- Notifications policies
create policy notifications_select_own
on public.notifications for select
using (auth.uid() = user_id);

create policy notifications_insert_actor
on public.notifications for insert
with check (auth.uid() = actor_id);

create policy notifications_update_own
on public.notifications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Media policies
create policy media_select_public
on public.media for select
using (
  exists (
    select 1 from public.posts p
    join public.profiles pr on pr.id = p.author_id
    where p.id = media.post_id
      and (
        pr.is_private = false
        or pr.id = auth.uid()
        or exists (
          select 1 from public.follows f
          where f.followee_id = pr.id and f.follower_id = auth.uid()
        )
      )
  )
);

create policy media_insert_own
on public.media for insert
with check (auth.uid() = owner_id);

create policy media_delete_own
on public.media for delete
using (auth.uid() = owner_id);

-- Storage policies for 'media' bucket
-- Allow public read
create policy storage_media_read
on storage.objects for select
using (bucket_id = 'media');

-- Allow authenticated uploads to their own folder: /<uid>/...
create policy storage_media_insert
on storage.objects for insert
with check (
  bucket_id = 'media'
  and auth.uid()::text = split_part(name, '/', 1)
);

-- Allow owners to delete their own objects
create policy storage_media_delete
on storage.objects for delete
using (
  bucket_id = 'media'
  and auth.uid()::text = split_part(name, '/', 1)
);
