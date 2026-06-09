# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Focus Goal App — a digital detox app where users set real-world goals, get AI coaching from Claude, and have friends monitor progress via a live dashboard. Built with Expo (React Native) + Supabase + Claude API.

## Architecture

```
Expo App (React Native + TypeScript)
  → Supabase Client SDK
  → Supabase (Auth, Postgres, Realtime, Edge Functions, Storage)
  → Claude API (via Edge Functions)
```

Three roles: User (sets goals, chats with Claude), Friend (monitors via live dashboard), Claude (coaches user, incorporates friend advice).

All source code lives under `src/` (Expo SDK 56 default template structure).

## Commands

```bash
# App Development
npx expo start                    # Start Metro bundler
npx expo start --clear            # Start with cache cleared

# Supabase
supabase start                    # Start local Supabase (Postgres, Auth, Realtime)
supabase stop                     # Stop local Supabase
supabase functions serve          # Serve all Edge Functions locally
supabase db reset                 # Reset database and re-run migrations
supabase migration new <name>     # Create a new migration
```

## Environment

```bash
# .env.local (required for app)
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>

# supabase/.env.local (required for Edge Functions)
ANTHROPIC_API_KEY=sk-ant-...
```

## Key Patterns

- **Edge Functions wrap Claude API** — API key never touches the client. All LLM calls go through `supabase/functions/`.
- **Unified messages table** — user, Claude, and friend messages in one table. `sender_type` distinguishes them. `visibility` (public/private) controls friend access. Claude sees all messages regardless of visibility.
- **Realtime via Postgres changes** — `messages` table has `supabase_realtime` publication enabled. Client subscribes to `postgres_changes` events filtered by `goal_id`.
- **Auth gate in root layout** — `src/app/_layout.tsx` redirects based on session state.
- **Zustand for session state** — active goal and messages in Zustand store, reloaded from Supabase on mount.

## Data Model

Core tables: `profiles`, `friendships`, `goals`, `messages`. All have RLS policies. See `supabase/migrations/00001_initial_schema.sql` for full schema. LLM and friend messages are inserted via Edge Functions using service role (bypasses RLS insert policy which only allows `sender_type = 'user'`).

## Phasing

- **Phase 1 (current):** Auth, goal creation + Claude planning, LLM chat, friends list
- **Phase 2:** Location tracking, live friend dashboard, photo posting
- **Phase 3:** Push notifications, watcher comments, progress summaries
- **Phase 4:** iOS app blocking via Screen Time API
