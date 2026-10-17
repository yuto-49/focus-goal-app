-- Goal watchers — which friends are watching a goal session
-- Created first because location_pings and goal_photos policies reference it
create table public.goal_watchers (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (goal_id, friend_id)
);

alter table public.goal_watchers enable row level security;

create policy "Goal owner can read watchers"
  on public.goal_watchers for select
  using (
    auth.uid() = (select user_id from public.goals where id = goal_id)
  );

create policy "Watchers can read co-watchers"
  on public.goal_watchers for select
  using (auth.uid() = friend_id);

create policy "Accepted friends can join as watchers"
  on public.goal_watchers for insert
  with check (
    auth.uid() = friend_id
    and exists (
      select 1 from public.friendships
      where status = 'accepted'
        and (
          (user_id = auth.uid() and friend_id = (select user_id from public.goals where id = goal_watchers.goal_id))
          or (friend_id = auth.uid() and user_id = (select user_id from public.goals where id = goal_watchers.goal_id))
        )
    )
  );

-- Location pings during active goals
create table public.location_pings (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

alter table public.location_pings enable row level security;

create policy "Goal owner can read own location pings"
  on public.location_pings for select
  using (auth.uid() = user_id);

create policy "Goal owner can insert location pings"
  on public.location_pings for insert
  with check (auth.uid() = user_id);

create policy "Watchers can read location pings"
  on public.location_pings for select
  using (
    exists (
      select 1 from public.goal_watchers
      where goal_watchers.goal_id = location_pings.goal_id
        and goal_watchers.friend_id = auth.uid()
    )
  );

-- Goal photos
create table public.goal_photos (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  caption text not null default '',
  created_at timestamptz not null default now()
);

alter table public.goal_photos enable row level security;

create policy "Goal owner can read own photos"
  on public.goal_photos for select
  using (auth.uid() = user_id);

create policy "Goal owner can insert photos"
  on public.goal_photos for insert
  with check (auth.uid() = user_id);

create policy "Watchers can read goal photos"
  on public.goal_photos for select
  using (
    exists (
      select 1 from public.goal_watchers
      where goal_watchers.goal_id = goal_photos.goal_id
        and goal_watchers.friend_id = auth.uid()
    )
  );

-- Watchers can read public messages for goals they watch
create policy "Watchers can read public messages"
  on public.messages for select
  using (
    visibility = 'public'
    and exists (
      select 1 from public.goal_watchers
      where goal_watchers.goal_id = messages.goal_id
        and goal_watchers.friend_id = auth.uid()
    )
  );

-- Watchers can read goals they are watching
create policy "Watchers can read watched goals"
  on public.goals for select
  using (
    exists (
      select 1 from public.goal_watchers
      where goal_watchers.goal_id = goals.id
        and goal_watchers.friend_id = auth.uid()
    )
  );

-- Enable realtime on new tables
alter publication supabase_realtime add table public.location_pings;
alter publication supabase_realtime add table public.goal_photos;

-- Create storage bucket for goal photos
insert into storage.buckets (id, name, public)
values ('goal-photos', 'goal-photos', true)
on conflict (id) do nothing;

-- Storage policies: authenticated users can upload to their own folder
create policy "Users can upload own goal photos"
  on storage.objects for insert
  with check (
    bucket_id = 'goal-photos'
    and auth.role() = 'authenticated'
  );

-- Anyone can read goal photos (bucket is public)
create policy "Public read goal photos"
  on storage.objects for select
  using (bucket_id = 'goal-photos');
