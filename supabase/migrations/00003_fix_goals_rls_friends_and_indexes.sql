-- Allow accepted friends to read active goals (needed for FriendsScreen watch feature)
-- Without this, the goals query in FriendsScreen returns empty due to RLS
create policy "Friends can read active goals"
  on public.goals for select
  using (
    status = 'active'
    and exists (
      select 1 from public.friendships
      where status = 'accepted'
        and (
          (friendships.user_id = auth.uid() and friendships.friend_id = goals.user_id)
          or (friendships.friend_id = auth.uid() and friendships.user_id = goals.user_id)
        )
    )
  );

-- Performance indexes for common query patterns
create index if not exists idx_messages_goal_id_created on public.messages(goal_id, created_at);
create index if not exists idx_goals_user_id_status on public.goals(user_id, status);
create index if not exists idx_goal_watchers_goal_id on public.goal_watchers(goal_id);
create index if not exists idx_location_pings_goal_id on public.location_pings(goal_id);
create index if not exists idx_goal_photos_goal_id on public.goal_photos(goal_id);
