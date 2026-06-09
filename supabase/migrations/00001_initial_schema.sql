-- Users profile (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read any profile"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Friendships
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id)
);

alter table public.friendships enable row level security;

create policy "Users can read own friendships"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can insert friendship requests"
  on public.friendships for insert
  with check (auth.uid() = user_id);

create policy "Users can accept friendships sent to them"
  on public.friendships for update
  using (auth.uid() = friend_id);

-- Goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  plan jsonb not null default '[]'::jsonb,
  status text not null default 'planning' check (status in ('planning', 'active', 'completed', 'abandoned')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "Users can read own goals"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals"
  on public.goals for update
  using (auth.uid() = user_id);

-- Messages (unified chat: user, llm, friend)
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'llm', 'friend')),
  sender_id uuid references public.profiles(id),
  content text not null,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Goal owner can read all messages"
  on public.messages for select
  using (
    auth.uid() = (select user_id from public.goals where id = goal_id)
  );

create policy "Goal owner can insert messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and sender_type = 'user'
  );

-- Enable realtime on messages
alter publication supabase_realtime add table public.messages;
