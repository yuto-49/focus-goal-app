# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Focus Goal App — a digital detox app where users set real-world goals, get AI coaching from Claude, and have friends monitor progress via a live dashboard. Built with Expo (React Native) + Supabase + Claude API.

## Architecture

```
React Native CLI App (TypeScript, iOS-only)
  → Supabase Client SDK
  → Supabase (Auth, Postgres, Realtime, Edge Functions, Storage)
  → Claude API (via Edge Functions)
```

Three roles: User (sets goals, chats with Claude), Friend (monitors via live dashboard), Claude (coaches user, incorporates friend advice).

All source code lives under `src/`. Navigation uses `@react-navigation` (native-stack + bottom-tabs). Bundle ID: `com.focusgoal.app`.

## Phase 2 Features

- **Location tracking:** `expo-location` foreground tracking during active goals. Pings written to `location_pings` table every 15s / 20m distance.
- **Photo posting:** `expo-image-picker` for camera/gallery. Photos uploaded to Supabase Storage `goal-photos` bucket, metadata in `goal_photos` table.
- **Friend watch dashboard:** `/watch/[goalId]` screen shows live map (react-native-maps), public chat feed, and photo gallery via Realtime subscriptions.
- **Goal watchers:** `goal_watchers` table tracks which friends are watching. Friends join by tapping "Watch" on the friends list. RLS policies grant watchers read access to public messages, location pings, and photos.

## Commands

```bash
# Mac Setup (first time after git clone)
cp .env.example .env              # Fill in Supabase credentials
./setup-mac.sh                    # Install deps, generate ios/, pod install

# App Development
npx react-native start            # Start Metro bundler
npx react-native run-ios          # Build and run on iOS Simulator
open ios/FocusGoal.xcworkspace     # Open in Xcode

# Supabase
supabase start                    # Start local Supabase (Postgres, Auth, Realtime)
supabase stop                     # Stop local Supabase
supabase functions serve          # Serve all Edge Functions locally
supabase db reset                 # Reset database and re-run migrations
supabase migration new <name>     # Create a new migration
```

## Environment

```bash
# .env (required for app, created from .env.example)
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<from supabase start output>

# supabase/.env.local (required for Edge Functions)
ANTHROPIC_API_KEY=sk-ant-...
```

## Key Patterns

- **Edge Functions wrap Claude API** — API key never touches the client. All LLM calls go through `supabase/functions/`.
- **Unified messages table** — user, Claude, and friend messages in one table. `sender_type` distinguishes them. `visibility` (public/private) controls friend access. Claude sees all messages regardless of visibility.
- **Realtime via Postgres changes** — `messages` table has `supabase_realtime` publication enabled. Client subscribes to `postgres_changes` events filtered by `goal_id`.
- **Auth gate in App.tsx** — `src/App.tsx` switches between `AuthStack` and `RootNavigator` based on session state.
- **Zustand for session state** — active goal and messages in Zustand store, reloaded from Supabase on mount.
- **react-native-config for env vars** — `SUPABASE_URL` and `SUPABASE_ANON_KEY` loaded from `.env` via `react-native-config`.

## Data Model

Core tables: `profiles`, `friendships`, `goals`, `messages`, `location_pings`, `goal_photos`, `goal_watchers`. All have RLS policies. See `supabase/migrations/` for full schema. LLM and friend messages are inserted via Edge Functions using service role (bypasses RLS insert policy which only allows `sender_type = 'user'`).

## Phasing

- **Phase 1 (complete):** Auth, goal creation + Claude planning, LLM chat, friends list
- **Phase 2 (current):** Location tracking, live friend dashboard, photo posting
- **Phase 3:** Push notifications, watcher comments, progress summaries
- **Phase 4:** iOS app blocking via Screen Time API
