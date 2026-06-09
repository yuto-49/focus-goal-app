# Focus Goal App — Design Spec

## Problem

People struggle with digital detox. They want to accomplish real-world goals but get pulled back into their phones. Existing focus apps just block apps — they don't provide guidance, accountability, or social engagement.

## Solution

A mobile app where users set real-world goals, get AI-powered coaching from Claude, and have friends monitor their progress live. The app becomes the user's primary interaction surface during a goal session, replacing aimless app-hopping with purposeful LLM-guided action.

## Core Concept

**Three roles:**
- **User:** Sets a goal, chats with Claude for guidance, posts progress (photos), completes the goal
- **Friend (Monitor):** Gets notified when a goal starts, watches live dashboard (map + chat + photos), comments/advises inline in the chat
- **Claude (Middleman):** Creates the goal plan, coaches the user, incorporates friend advice, generates progress updates

**The experience:** Like a live stream, but for real-life goal achievement. Friends watch and help through location tracking, chat visibility, and photo updates.

## Architecture

```
┌─────────────────────────────────────────────┐
│              Expo (React Native)            │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │Goal Setup│  │ LLM Chat │  │  Friend   │ │
│  │  Screen  │  │  Screen  │  │ Dashboard │ │
│  └──────────┘  └──────────┘  └───────────┘ │
└──────────────────┬──────────────────────────┘
                   │
          Supabase Client SDK
                   │
┌──────────────────▼──────────────────────────┐
│              Supabase                        │
│                                              │
│  ┌────────┐  ┌──────────┐  ┌─────────────┐  │
│  │  Auth  │  │ Postgres │  │  Realtime   │  │
│  │(email/ │  │ (goals,  │  │ (chat, loc, │  │
│  │ social)│  │  users,  │  │  updates)   │  │
│  │        │  │ friends) │  │             │  │
│  └────────┘  └──────────┘  └─────────────┘  │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │        Edge Functions                │    │
│  │  • /chat  → Claude API (with MCP)   │    │
│  │  • /goal  → plan generation         │    │
│  │  • /notify → push notifications     │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

- **Supabase Auth** handles signup/login (email + social providers)
- **Postgres** stores all persistent data (users, goals, friendships, messages)
- **Realtime channels** power the live dashboard — chat messages, location pings, and photo updates stream to friends instantly
- **Edge Functions** wrap the Claude API so the API key never touches the client. MCP tools (location context, goal state) are assembled server-side before each Claude call.

## Data Model

| Table | Key Columns | Purpose |
|-------|------------|---------|
| `users` | id, display_name, avatar_url | User profiles |
| `friendships` | user_id, friend_id, status (pending/accepted) | Bidirectional friend connections |
| `goals` | id, user_id, title, plan (JSON), status (active/completed/abandoned), started_at, ended_at | The goal session |
| `messages` | id, goal_id, sender_type (user/llm/friend), sender_id, content, visibility (public/private), created_at | Unified chat — user, Claude, and friend messages in one thread |
| `location_pings` | id, goal_id, user_id, lat, lng, created_at | Location trail during active goal |
| `goal_photos` | id, goal_id, user_id, image_url, caption, created_at | Progress photos posted by user |
| `goal_watchers` | goal_id, friend_id, joined_at | Which friends are watching a goal session |

**Key relationships:**
- A `goal` belongs to one `user`
- `messages` all live under a `goal` — `sender_type` distinguishes user, Claude, and friend messages
- `visibility` on messages controls what friends see (public vs private) — Claude sees all messages regardless
- `goal_watchers` tracks which friends opted in to monitor a specific goal
- `location_pings` are write-only during a session, read by the friend dashboard via Realtime subscription

**Realtime channels:**
- `goal:{goal_id}:messages` — new chat messages stream to all watchers
- `goal:{goal_id}:location` — location pings stream to friend dashboard map
- `goal:{goal_id}:photos` — new photos appear on friend dashboard

## User Flows

### Flow 1: Setting a Goal
1. User opens app → lands on goal setup screen
2. User types what they want to achieve (free text, e.g., "Talk to 3 strangers at the coffee shop")
3. App sends goal to Edge Function → Claude generates a structured plan (steps, estimated time, tips)
4. User reviews the plan, can ask Claude to adjust
5. User confirms → goal goes `active`, location tracking starts, friends get notified

### Flow 2: Active Goal Session (User Side)
1. Screen shows: LLM chat (main area) + small progress bar/checklist of plan steps
2. User chats with Claude for guidance ("I'm nervous, what should I say?")
3. User can toggle message visibility (public/private) per message before sending
4. User can post photos with captions as proof/updates
5. User marks steps as done or tells Claude they completed something → Claude updates progress
6. User finishes → taps "Complete Goal" → session ends, summary generated

### Flow 3: Active Goal Session (Friend Side)
1. Friend receives push notification: "Alex started a goal: Talk to 3 strangers"
2. Friend taps in → live dashboard opens:
   - **Left/top:** Live map with user's pin moving
   - **Center:** Chat feed (public messages between user and Claude)
   - **Bottom:** Photo feed as user posts them
3. Friend can type a message → it appears inline in the user's chat thread (Claude sees it too and can respond)
4. Goal completes → friend sees the summary and stats

### Flow 4: App Blocking (Future Phase)
Not in the prototype. The app encourages focus by being the primary interaction surface. App blocking via iOS Screen Time API is a future feature once the concept is validated.

## Claude API & MCP Integration

Every user message goes through the `/chat` Edge Function:

```
User message
    ↓
Edge Function assembles:
  - System prompt (goal coach persona + current plan + rules)
  - Conversation history (all messages, including friend messages)
  - MCP tool results (current location, goal progress, time elapsed)
    ↓
Claude API call (with tools)
    ↓
Response saved to messages table (visibility: public)
    ↓
Streamed back to user + Realtime broadcast to watchers
```

**System prompt responsibilities:**
- Act as a focused goal coach — keep user on track
- Incorporate friend advice naturally ("Your friend Sam suggested...")
- Generate progress updates periodically for watchers
- Flag when user seems stuck and nudge friends to help

**MCP Tools available to Claude:**

| Tool | Purpose |
|------|---------|
| `get_goal_plan` | Read current goal, plan steps, completion status |
| `update_progress` | Mark a step as complete, update goal status |
| `get_location` | Read user's latest location coordinates |
| `get_nearby_context` | Suggest relevant nearby places |
| `send_watcher_update` | Push a summary update to all watching friends |
| `complete_goal` | End the session and generate a completion summary |

**Privacy:** Claude always sees private messages (full context) but the Realtime broadcast skips private messages when sending to friends.

## Tech Stack

- **Frontend:** Expo (SDK 52+), React Native, TypeScript
- **Navigation:** Expo Router (file-based routing)
- **State:** Zustand
- **Maps:** react-native-maps
- **Location:** expo-location (foreground tracking during active goals)
- **Backend:** Supabase (Auth, Postgres, Realtime, Edge Functions, Storage)
- **LLM:** Claude API via Anthropic SDK (Deno runtime in Edge Functions)
- **Push notifications:** expo-notifications + Supabase webhook triggers

## Project Structure

```
app1/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Login, signup
│   ├── (tabs)/             # Main tab navigation
│   │   ├── goal.tsx        # Goal setup + active session chat
│   │   ├── friends.tsx     # Friends list + pending requests
│   │   └── profile.tsx     # User profile + goal history
│   └── watch/[goalId].tsx  # Friend live dashboard
├── components/             # Reusable UI components
├── lib/                    # Supabase client, API helpers, types
├── hooks/                  # Custom React hooks (useGoal, useChat, useLocation)
├── supabase/
│   ├── migrations/         # SQL migration files
│   └── functions/          # Edge Functions
│       ├── chat/           # Claude API integration
│       ├── goal/           # Goal creation + plan generation
│       └── notify/         # Push notification dispatch
├── assets/                 # Images, fonts
└── app.json                # Expo config
```

## Phasing

- **Phase 1 (prototype):** Auth, goal creation with Claude planning, LLM chat, basic friend list
- **Phase 2:** Location tracking, live friend dashboard, photo posting
- **Phase 3:** Push notifications, watcher comments inline, progress summaries
- **Phase 4 (future):** iOS native app blocking via Screen Time API
