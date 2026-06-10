# Running the Focus Goal App

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`)
- [Expo Go](https://expo.dev/go) app on your phone, or an iOS/Android emulator
- An [Anthropic API key](https://console.anthropic.com/)

## Setup (First Time)

```bash
cd "C:/Users/Yuto Maruyama/Documents/study/app1"

# 1. Install dependencies
npm install

# 2. Start Docker Desktop (must be running before supabase start)

# 3. Start local Supabase
supabase start
```

After `supabase start`, you'll see output like:

```
API URL: http://127.0.0.1:54321
anon key: eyJhbGciOiJIUzI1NiIs...
service_role key: eyJhbGciOiJIUzI1NiIs...
Studio URL: http://127.0.0.1:54323
```

```bash
# 4. Update .env.local with the anon key from above
# Edit .env.local and replace "your-local-anon-key" with the actual anon key

# 5. Add your Anthropic API key for Edge Functions
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > supabase/.env.local
```

## Running

Open **three terminals**:

**Terminal 1 — Supabase (if not already running):**
```bash
cd "C:/Users/Yuto Maruyama/Documents/study/app1"
supabase start
```

**Terminal 2 — Edge Functions:**
```bash
cd "C:/Users/Yuto Maruyama/Documents/study/app1"
supabase functions serve
```

**Terminal 3 — Expo App:**
```bash
cd "C:/Users/Yuto Maruyama/Documents/study/app1"
npx expo start
```

Then either:
- Scan the QR code with Expo Go on your phone
- Press `i` for iOS simulator or `a` for Android emulator
- Press `w` for web browser

## Useful Commands

```bash
# Reset database (wipes all data, re-runs migrations)
supabase db reset

# View database in browser
# Open http://127.0.0.1:54323

# Stop Supabase
supabase stop

# Clear Expo cache
npx expo start --clear
```

## Troubleshooting

**"supabase start" fails:**
- Make sure Docker Desktop is running
- Try `supabase stop` then `supabase start` again

**Edge Functions return 401:**
- Check that `.env.local` has the correct `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Make sure you're logged in (auth session exists)

**Claude returns errors:**
- Verify `ANTHROPIC_API_KEY` in `supabase/.env.local` is valid
- Check Edge Function logs: `supabase functions serve` terminal output

**App can't connect to Supabase:**
- Ensure `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` in `.env.local`
- On physical device, replace `127.0.0.1` with your computer's local IP address
