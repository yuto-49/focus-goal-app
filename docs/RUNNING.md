# How to Verify the Focus Goal App Works

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`)
- [Expo Go](https://expo.dev/go) app on your phone, or an iOS/Android emulator
- An [Anthropic API key](https://console.anthropic.com/)

## Step 1: Start All Services

Open **three terminals** from the project root (`C:/Users/Yuto Maruyama/Documents/study/app1`):

**Terminal 1 — Supabase:**
```bash
# Make sure Docker Desktop is running first
supabase db reset    # Resets DB and applies all migrations (00001 + 00002)
supabase start       # Starts Postgres, Auth, Realtime, Storage
```

After `supabase start`, note the output:
```
Project URL:  http://127.0.0.1:54321
Studio:       http://127.0.0.1:54323
Publishable:  sb_publishable_...    ← this is the anon key
Secret:       sb_secret_...         ← this is the service role key
```

Create `.env.local` in the project root (for the Expo app):
```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<Publishable key from above>
```

Create `supabase/.env.local` (for Edge Functions):
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Terminal 2 — Edge Functions:**
```bash
supabase functions serve
```

**Terminal 3 — Expo App:**
```bash
npx expo start --clear
```

Scan the QR code with Expo Go, press `i` (iOS sim), `a` (Android emu), or `w` (web).

## Step 2: Verify Database Schema

Open Supabase Studio at `http://127.0.0.1:54323`. Confirm these 7 tables exist:

| Table | Phase | Purpose |
|-------|-------|---------|
| `profiles` | 1 | User profiles (auto-created on signup) |
| `friendships` | 1 | Friend connections (pending/accepted) |
| `goals` | 1 | Goal sessions with plan JSON |
| `messages` | 1 | Unified chat (user/llm/friend messages) |
| `goal_watchers` | 2 | Which friends are watching a goal |
| `location_pings` | 2 | GPS trail during active goals |
| `goal_photos` | 2 | Photo metadata for goal progress |

Also confirm the `goal-photos` storage bucket exists under Storage.

## Step 3: Verify Phase 1 — Auth + Goal + Chat

### 3a. Auth Flow
1. App loads → redirects to **Login** screen
2. Tap "Don't have an account? Sign up"
3. Enter display name, email, password → tap **Sign Up**
4. If email confirmation is disabled in Supabase, you're logged in immediately
5. Three tabs appear: **Goal**, **Friends**, **Profile**

**Pass criteria:** Login/signup works, tabs show after auth.

### 3b. Goal Creation + Claude Plan
1. Go to **Goal** tab
2. Type a goal: `Do 30 minutes of stretching at home`
3. Tap **Generate Plan**
4. Wait for Claude → a plan card appears with numbered steps
5. Review the plan → tap **Start Goal**

**Pass criteria:** Claude returns a plan with 3-7 steps. Goal status changes to "active".

### 3c. Chat with Claude
1. In the active goal chat, type: `I just finished step 1, what's next?`
2. Tap **Send**
3. Claude responds with coaching advice
4. Toggle visibility to **Private** → send another message → "Private" label appears

**Pass criteria:** Messages send/receive. Claude responds contextually. Private label shows.

### 3d. Complete Goal
1. Tap **Complete** in the header
2. Goal screen returns to "What do you want to achieve?"
3. Go to **Profile** tab → goal appears in history with "completed" status

**Pass criteria:** Goal completes. Shows in profile history.

## Step 4: Verify Phase 1 — Friends

### 4a. Create a Second Account
1. Sign out (Profile tab → Sign Out)
2. Sign up with a different email and display name (e.g., "TestFriend")
3. Note this account's display name

### 4b. Add Friend
1. Sign out, log back in as the first account
2. Go to **Friends** tab
3. Type the second account's display name → tap **Add**
4. "Request sent" appears under their name

### 4c. Accept Friend Request
1. Sign out, log in as the second account
2. Go to **Friends** tab
3. See "Wants to be your friend" → tap **Accept**
4. Friend now shows without pending status

**Pass criteria:** Friend request sends, receives, and accepts. Both users see the friendship.

## Step 5: Verify Phase 2 — Location Tracking

1. Log in as any account
2. Create and activate a goal
3. **Location permission prompt** appears → grant it
4. Header shows green dot with **"Tracking"** text
5. In Supabase Studio, check `location_pings` table → rows appear with lat/lng

**Pass criteria:** Permission prompt shows. Green indicator appears. Pings are written to DB.

> **Note:** On web, location uses browser geolocation. On physical device, use real GPS. On emulator, you may need to set a mock location.

## Step 6: Verify Phase 2 — Photo Posting

1. With an active goal, tap **Add Photo**
2. Bottom sheet modal appears with "Take Photo" and "Choose from Gallery"
3. Optionally type a caption
4. Pick/take a photo → "Uploading..." indicator shows
5. Tap **Photos (N)** toggle in header → photo grid shows the uploaded photo
6. In Supabase Studio: check `goal_photos` table and Storage `goal-photos` bucket

**Pass criteria:** Photo uploads. Appears in grid. Stored in Supabase Storage.

> **Note:** Camera may not work on emulator/web. Gallery picker should work everywhere.

## Step 7: Verify Phase 2 — Friend Watch Dashboard

This requires **two accounts** with an accepted friendship.

### Setup
1. **Account A:** Create and activate a goal (location tracking on)
2. **Account A:** Send a chat message to Claude
3. **Account A:** Upload a photo

### Watch
4. **Account B:** Go to Friends tab
5. Account A shows **"Has an active goal"** + blue **Watch** button
6. Tap **Watch** → dashboard opens with:
   - **Map** at top showing Account A's location trail
   - **Chat tab** with public messages between Account A and Claude
   - **Photos tab** with Account A's uploaded photos

### Live Updates
7. **Account A:** Send another message → it appears on Account B's chat tab in real time
8. **Account A:** Upload another photo → it appears on Account B's photos tab
9. **Account A:** Move (or mock location change) → map updates on Account B

### Goal End
10. **Account A:** Tap Complete → Account B sees "Goal completed"

**Pass criteria:** Watch dashboard opens. Map shows trail. Chat and photos stream in real time.

## Quick Verification Checklist

| # | Feature | Status |
|---|---------|--------|
| 1 | Signup/Login works | |
| 2 | Goal creation → Claude generates plan | |
| 3 | Start goal → chat with Claude | |
| 4 | Complete goal → shows in profile | |
| 5 | Add friend → accept request | |
| 6 | Location tracking green indicator | |
| 7 | Photo upload + grid display | |
| 8 | Friend sees Watch button | |
| 9 | Watch dashboard: map + chat + photos | |
| 10 | Real-time updates on watch screen | |

## Troubleshooting

**"supabase start" fails:**
- Make sure Docker Desktop is running
- Try `supabase stop` then `supabase start` again

**Edge Functions return 401:**
- Check `.env.local` has correct `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Make sure you're logged in (auth session exists)

**Claude returns errors:**
- Verify `ANTHROPIC_API_KEY` in `supabase/.env.local` is valid
- Check Edge Function logs in Terminal 2

**App can't connect to Supabase:**
- Ensure `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` in `.env.local`
- On physical device, replace `127.0.0.1` with your computer's local IP

**Location not tracking:**
- Grant location permission when prompted
- On emulator, set a mock location in device settings
- Check `location_pings` table in Supabase Studio for rows

**Photos not uploading:**
- Check `goal-photos` bucket exists in Supabase Studio → Storage
- Camera may not work on emulator — use gallery instead
- Check Terminal 2 for storage policy errors

**Watch button not showing:**
- Friendship must be "accepted" (both sides)
- Friend must have an "active" goal (not planning/completed)
- Refresh the friends list by navigating away and back
