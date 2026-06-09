# Focus Goal App — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working prototype with auth, goal creation via Claude, LLM chat, and a basic friend list.

**Architecture:** Expo (React Native) app with Expo Router for navigation, Supabase for auth/database/realtime, and Claude API called through Supabase Edge Functions. Zustand manages client state.

**Tech Stack:** Expo SDK 52+, TypeScript, Expo Router, Zustand, Supabase (Auth, Postgres, Edge Functions), Claude API (@anthropic-ai/sdk)

---

## File Map

```
app1/
├── app/
│   ├── _layout.tsx              # Root layout — auth gate + providers
│   ├── (auth)/
│   │   ├── _layout.tsx          # Auth layout (no tabs)
│   │   ├── login.tsx            # Email login screen
│   │   └── signup.tsx           # Email signup screen
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab navigator layout
│   │   ├── goal.tsx             # Goal setup + active session chat
│   │   ├── friends.tsx          # Friends list + add friend
│   │   └── profile.tsx         # User profile + goal history
├── components/
│   ├── ChatBubble.tsx           # Single chat message (user/llm/friend)
│   ├── ChatInput.tsx            # Message input with visibility toggle
│   ├── GoalPlanCard.tsx         # Displays Claude's generated plan
│   └── FriendRow.tsx            # Friend list item with status
├── lib/
│   ├── supabase.ts              # Supabase client init
│   └── types.ts                 # Shared TypeScript types
├── hooks/
│   ├── useAuth.ts               # Auth state hook (wraps Supabase auth)
│   ├── useGoal.ts               # Active goal state + mutations
│   └── useChat.ts               # Chat messages + realtime subscription
├── stores/
│   └── appStore.ts              # Zustand store (session state)
├── supabase/
│   ├── config.toml              # Supabase local config
│   ├── migrations/
│   │   └── 00001_initial_schema.sql  # All Phase 1 tables
│   └── functions/
│       ├── chat/
│       │   └── index.ts         # Claude API — chat handler
│       └── goal/
│           └── index.ts         # Claude API — plan generation
├── .env.local                   # EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
├── app.json                     # Expo config
├── package.json
└── tsconfig.json
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `app1/` (Expo project root)
- Create: `.env.local`
- Create: `app.json` (modified from template)

- [ ] **Step 1: Create Expo project**

```bash
cd "C:/Users/Yuto Maruyama/Documents/study"
npx create-expo-app@latest app1 --template default
```

Expected: Expo project created with default template (includes Expo Router + TypeScript).

- [ ] **Step 2: Install dependencies**

```bash
cd "C:/Users/Yuto Maruyama/Documents/study/app1"
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
npm install zustand
```

Expected: All packages install without errors.

- [ ] **Step 3: Create environment file**

Create `.env.local`:
```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

- [ ] **Step 4: Verify app starts**

```bash
npx expo start
```

Expected: Metro bundler starts, app loads in simulator or Expo Go.

- [ ] **Step 5: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Expo project with dependencies"
```

---

### Task 2: Supabase Local Setup + Database Schema

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/00001_initial_schema.sql`

- [ ] **Step 1: Initialize Supabase**

```bash
cd "C:/Users/Yuto Maruyama/Documents/study/app1"
supabase init
```

Expected: `supabase/` directory created with `config.toml`.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/00001_initial_schema.sql`:

```sql
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
```

- [ ] **Step 3: Start Supabase locally and apply migration**

```bash
supabase start
```

Expected: Local Supabase starts. Output shows API URL, anon key, etc. Migration auto-applies.

- [ ] **Step 4: Update `.env.local` with local keys**

Copy the `API URL` and `anon key` from the `supabase start` output into `.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-output>
```

- [ ] **Step 5: Verify schema in Supabase Studio**

Open `http://127.0.0.1:54323` in browser. Confirm tables `profiles`, `friendships`, `goals`, `messages` exist with correct columns.

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: add initial database schema with RLS policies"
```

---

### Task 3: Supabase Client + TypeScript Types

**Files:**
- Create: `lib/supabase.ts`
- Create: `lib/types.ts`

- [ ] **Step 1: Write TypeScript types**

Create `lib/types.ts`:

```typescript
export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

export type Friendship = {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted";
  created_at: string;
};

export type GoalStatus = "planning" | "active" | "completed" | "abandoned";

export type GoalPlanStep = {
  step: number;
  description: string;
  completed: boolean;
};

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  plan: GoalPlanStep[];
  status: GoalStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

export type SenderType = "user" | "llm" | "friend";
export type Visibility = "public" | "private";

export type Message = {
  id: string;
  goal_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  content: string;
  visibility: Visibility;
  created_at: string;
};
```

- [ ] **Step 2: Write Supabase client**

Create `lib/supabase.ts`:

```typescript
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add lib/
git commit -m "feat: add Supabase client and TypeScript types"
```

---

### Task 4: Auth Hook + Zustand Store

**Files:**
- Create: `hooks/useAuth.ts`
- Create: `stores/appStore.ts`

- [ ] **Step 1: Write the Zustand store**

Create `stores/appStore.ts`:

```typescript
import { create } from "zustand";
import type { Goal, Message } from "../lib/types";

type AppState = {
  activeGoal: Goal | null;
  setActiveGoal: (goal: Goal | null) => void;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeGoal: null,
  setActiveGoal: (goal) => set({ activeGoal: goal }),
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
}));
```

- [ ] **Step 2: Write the auth hook**

Create `hooks/useAuth.ts`:

```typescript
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return { session, loading, signIn, signUp, signOut };
}
```

- [ ] **Step 3: Commit**

```bash
git add stores/ hooks/useAuth.ts
git commit -m "feat: add Zustand store and auth hook"
```

---

### Task 5: Root Layout + Auth Gate

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Write root layout with auth gate**

Replace `app/_layout.tsx`:

```typescript
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { ActivityIndicator, View } from "react-native";

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)/goal");
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Slot />;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: add root layout with auth gate"
```

---

### Task 6: Auth Screens (Login + Signup)

**Files:**
- Create: `app/(auth)/_layout.tsx`
- Create: `app/(auth)/login.tsx`
- Create: `app/(auth)/signup.tsx`

- [ ] **Step 1: Write auth layout**

Create `app/(auth)/_layout.tsx`:

```typescript
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Write login screen**

Create `app/(auth)/login.tsx`:

```typescript
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../hooks/useAuth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error: any) {
      Alert.alert("Login failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Focus Goal</Text>
      <Text style={styles.subtitle}>Achieve goals. Stay focused.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Signing in..." : "Sign In"}
        </Text>
      </TouchableOpacity>

      <Link href="/(auth)/signup" style={styles.link}>
        <Text style={styles.linkText}>Don't have an account? Sign up</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 40,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#000",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { marginTop: 20, alignSelf: "center" },
  linkText: { color: "#666", fontSize: 14 },
});
```

- [ ] **Step 3: Write signup screen**

Create `app/(auth)/signup.tsx`:

```typescript
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../hooks/useAuth";

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSignup = async () => {
    if (!displayName || !email || !password) return;
    setLoading(true);
    try {
      await signUp(email, password, displayName);
      Alert.alert("Success", "Check your email to confirm your account.");
    } catch (error: any) {
      Alert.alert("Signup failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        style={styles.input}
        placeholder="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSignup}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating account..." : "Sign Up"}
        </Text>
      </TouchableOpacity>

      <Link href="/(auth)/login" style={styles.link}>
        <Text style={styles.linkText}>Already have an account? Sign in</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 40,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#000",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { marginTop: 20, alignSelf: "center" },
  linkText: { color: "#666", fontSize: 14 },
});
```

- [ ] **Step 4: Verify auth flow**

Start app, confirm:
1. App redirects to login screen
2. Can navigate to signup screen
3. Creating account triggers Supabase auth
4. After login, redirects to tabs

```bash
npx expo start
```

- [ ] **Step 5: Commit**

```bash
git add app/(auth)/
git commit -m "feat: add login and signup screens"
```

---

### Task 7: Tab Navigator Layout

**Files:**
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/goal.tsx` (placeholder)
- Create: `app/(tabs)/friends.tsx` (placeholder)
- Create: `app/(tabs)/profile.tsx` (placeholder)

- [ ] **Step 1: Write tab layout**

Create `app/(tabs)/_layout.tsx`:

```typescript
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#000",
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="goal"
        options={{ title: "Goal", tabBarLabel: "Goal" }}
      />
      <Tabs.Screen
        name="friends"
        options={{ title: "Friends", tabBarLabel: "Friends" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarLabel: "Profile" }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Write placeholder screens**

Create `app/(tabs)/goal.tsx`:

```typescript
import { View, Text, StyleSheet } from "react-native";

export default function GoalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Goal Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 18 },
});
```

Create `app/(tabs)/friends.tsx`:

```typescript
import { View, Text, StyleSheet } from "react-native";

export default function FriendsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Friends Screen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  text: { fontSize: 18 },
});
```

Create `app/(tabs)/profile.tsx`:

```typescript
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useAuth } from "../../hooks/useAuth";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.email}>{session?.user.email}</Text>
      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  email: { fontSize: 16, marginBottom: 24, color: "#666" },
  button: {
    backgroundColor: "#000",
    borderRadius: 8,
    padding: 16,
    paddingHorizontal: 32,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 3: Verify tab navigation**

Start app, login, confirm three tabs appear and are navigable.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/
git commit -m "feat: add tab navigator with placeholder screens"
```

---

### Task 8: Goal Plan Edge Function (Claude API)

**Files:**
- Create: `supabase/functions/goal/index.ts`

- [ ] **Step 1: Create the edge function**

```bash
cd "C:/Users/Yuto Maruyama/Documents/study/app1"
supabase functions new goal
```

- [ ] **Step 2: Write the goal plan generator**

Replace `supabase/functions/goal/index.ts`:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const authHeader = req.headers.get("authorization")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { authorization: authHeader } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title } = await req.json();
  if (!title || typeof title !== "string") {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are a goal planning coach. The user will describe a real-world goal they want to achieve right now. Generate a concrete, actionable plan.

Respond with valid JSON only — no markdown, no explanation. Format:
{
  "steps": [
    { "step": 1, "description": "First thing to do", "completed": false },
    { "step": 2, "description": "Second thing to do", "completed": false }
  ],
  "estimated_minutes": 30,
  "tips": "One sentence of encouragement or advice"
}

Keep plans to 3-7 steps. Be specific and practical.`,
    messages: [{ role: "user", content: title }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  let plan;
  try {
    plan = JSON.parse(responseText);
  } catch {
    return Response.json(
      { error: "Failed to parse plan from Claude" },
      { status: 500 }
    );
  }

  const { data: goal, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      title,
      plan: plan.steps,
      status: "planning",
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    goal,
    estimated_minutes: plan.estimated_minutes,
    tips: plan.tips,
  });
});
```

- [ ] **Step 3: Set the Anthropic API key locally**

```bash
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> supabase/.env.local
```

- [ ] **Step 4: Test the edge function locally**

```bash
supabase functions serve goal
```

In another terminal, test with curl:

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/goal \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Do 30 minutes of stretching"}'
```

Expected: JSON response with a goal object containing plan steps.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/goal/
git commit -m "feat: add goal plan generation edge function with Claude"
```

---

### Task 9: Chat Edge Function (Claude API)

**Files:**
- Create: `supabase/functions/chat/index.ts`

- [ ] **Step 1: Create the edge function**

```bash
supabase functions new chat
```

- [ ] **Step 2: Write the chat handler**

Replace `supabase/functions/chat/index.ts`:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const authHeader = req.headers.get("authorization")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { authorization: authHeader } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goal_id, content, visibility } = await req.json();
  if (!goal_id || !content) {
    return Response.json(
      { error: "goal_id and content are required" },
      { status: 400 }
    );
  }

  // Save user message
  const { error: insertError } = await supabase.from("messages").insert({
    goal_id,
    sender_type: "user",
    sender_id: user.id,
    content,
    visibility: visibility || "public",
  });
  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  // Fetch goal + history
  const { data: goal } = await supabase
    .from("goals")
    .select("*")
    .eq("id", goal_id)
    .single();

  const { data: history } = await supabase
    .from("messages")
    .select("*")
    .eq("goal_id", goal_id)
    .order("created_at", { ascending: true });

  if (!goal || !history) {
    return Response.json({ error: "Goal not found" }, { status: 404 });
  }

  // Build Claude messages from chat history
  const claudeMessages = history.map((msg) => ({
    role: (msg.sender_type === "user" || msg.sender_type === "friend"
      ? "user"
      : "assistant") as "user" | "assistant",
    content:
      msg.sender_type === "friend"
        ? `[Friend message]: ${msg.content}`
        : msg.content,
  }));

  const planText = (goal.plan as any[])
    .map(
      (s: any) =>
        `${s.completed ? "[DONE]" : "[ ]"} Step ${s.step}: ${s.description}`
    )
    .join("\n");

  const systemPrompt = `You are a focused goal coach helping someone achieve a real-world goal RIGHT NOW.

Goal: "${goal.title}"

Current plan:
${planText}

Rules:
- Keep responses short and actionable (2-3 sentences max unless asked for more)
- If a friend sends a message (marked [Friend message]), acknowledge their input naturally
- Encourage the user to stay focused on the current step
- If the user reports completing a step, congratulate briefly and guide to the next one
- Be warm but not over-the-top`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    system: systemPrompt,
    messages: claudeMessages,
  });

  const responseText =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Save Claude's response
  const { data: llmMessage, error: llmError } = await supabase
    .from("messages")
    .insert({
      goal_id,
      sender_type: "llm",
      sender_id: null,
      content: responseText,
      visibility: "public",
    })
    .select()
    .single();

  if (llmError) {
    return Response.json({ error: llmError.message }, { status: 500 });
  }

  return Response.json({ message: llmMessage });
});
```

- [ ] **Step 3: Test the chat function locally**

```bash
supabase functions serve chat
```

Test with curl (use a valid goal_id from the previous task's test):

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/chat \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"goal_id": "<goal-id>", "content": "I just arrived at the gym, what should I do first?", "visibility": "public"}'
```

Expected: JSON response with Claude's coaching message.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/chat/
git commit -m "feat: add chat edge function with Claude coaching"
```

---

### Task 10: Goal Hook + Goal Screen

**Files:**
- Create: `hooks/useGoal.ts`
- Create: `components/GoalPlanCard.tsx`
- Modify: `app/(tabs)/goal.tsx`

- [ ] **Step 1: Write the goal hook**

Create `hooks/useGoal.ts`:

```typescript
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../stores/appStore";
import type { Goal } from "../lib/types";

export function useGoal() {
  const [loading, setLoading] = useState(false);
  const { activeGoal, setActiveGoal } = useAppStore();

  const createGoal = async (title: string) => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("goal", {
        body: { title },
      });

      if (response.error) throw response.error;

      const goal = response.data.goal as Goal;
      setActiveGoal(goal);
      return { goal, tips: response.data.tips };
    } finally {
      setLoading(false);
    }
  };

  const activateGoal = async () => {
    if (!activeGoal) return;
    const { data, error } = await supabase
      .from("goals")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", activeGoal.id)
      .select()
      .single();

    if (error) throw error;
    setActiveGoal(data as Goal);
  };

  const completeGoal = async () => {
    if (!activeGoal) return;
    const { data, error } = await supabase
      .from("goals")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", activeGoal.id)
      .select()
      .single();

    if (error) throw error;
    setActiveGoal(null);
  };

  const loadActiveGoal = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["planning", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) setActiveGoal(data as Goal);
  };

  return { activeGoal, loading, createGoal, activateGoal, completeGoal, loadActiveGoal };
}
```

- [ ] **Step 2: Write the GoalPlanCard component**

Create `components/GoalPlanCard.tsx`:

```typescript
import { View, Text, StyleSheet } from "react-native";
import type { GoalPlanStep } from "../lib/types";

type Props = {
  steps: GoalPlanStep[];
};

export function GoalPlanCard({ steps }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Your Plan</Text>
      {steps.map((step) => (
        <View key={step.step} style={styles.stepRow}>
          <Text style={styles.stepNumber}>{step.step}</Text>
          <Text style={styles.stepText}>{step.description}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: "row",
    marginBottom: 10,
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#000",
    color: "#fff",
    textAlign: "center",
    lineHeight: 24,
    fontSize: 12,
    fontWeight: "bold",
    marginRight: 10,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
```

- [ ] **Step 3: Write the goal screen**

Replace `app/(tabs)/goal.tsx`:

```typescript
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useGoal } from "../../hooks/useGoal";
import { GoalPlanCard } from "../../components/GoalPlanCard";
import type { GoalPlanStep } from "../../lib/types";

export default function GoalScreen() {
  const [title, setTitle] = useState("");
  const [tips, setTips] = useState("");
  const { activeGoal, loading, createGoal, activateGoal, completeGoal, loadActiveGoal } =
    useGoal();

  useEffect(() => {
    loadActiveGoal();
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const result = await createGoal(title.trim());
      setTips(result.tips || "");
      setTitle("");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleActivate = async () => {
    try {
      await activateGoal();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // No active goal — show goal creation
  if (!activeGoal) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>What do you want to achieve?</Text>
        <Text style={styles.hint}>
          Describe your goal — be specific about what and where.
        </Text>

        <TextInput
          style={styles.input}
          placeholder='e.g. "Talk to 3 strangers at the coffee shop"'
          value={title}
          onChangeText={setTitle}
          multiline
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleCreate}
          disabled={loading || !title.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Generate Plan</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Planning state — show plan for review
  if (activeGoal.status === "planning") {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.heading}>{activeGoal.title}</Text>
        {tips ? <Text style={styles.tips}>{tips}</Text> : null}

        <GoalPlanCard steps={activeGoal.plan as GoalPlanStep[]} />

        <TouchableOpacity style={styles.button} onPress={handleActivate}>
          <Text style={styles.buttonText}>Start Goal</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Active state — placeholder for chat (replaced in Task 11)
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{activeGoal.title}</Text>
      <Text style={styles.hint}>Goal is active — chat coming next</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#333" }]}
        onPress={completeGoal}
      >
        <Text style={styles.buttonText}>Complete Goal</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  heading: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  hint: { fontSize: 14, color: "#888", marginBottom: 24 },
  tips: {
    fontSize: 14,
    color: "#555",
    fontStyle: "italic",
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#000",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 4: Verify goal creation flow**

Start app + edge functions. Test:
1. Type a goal → tap "Generate Plan"
2. Claude returns a plan → displayed in GoalPlanCard
3. Tap "Start Goal" → status changes to active
4. Tap "Complete Goal" → returns to goal creation screen

- [ ] **Step 5: Commit**

```bash
git add hooks/useGoal.ts components/GoalPlanCard.tsx app/(tabs)/goal.tsx
git commit -m "feat: add goal creation with Claude plan generation"
```

---

### Task 11: Chat UI with Realtime

**Files:**
- Create: `hooks/useChat.ts`
- Create: `components/ChatBubble.tsx`
- Create: `components/ChatInput.tsx`
- Modify: `app/(tabs)/goal.tsx`

- [ ] **Step 1: Write the chat hook**

Create `hooks/useChat.ts`:

```typescript
import { useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../stores/appStore";
import type { Message } from "../lib/types";

export function useChat(goalId: string | undefined) {
  const { messages, setMessages, addMessage } = useAppStore();

  // Load existing messages
  useEffect(() => {
    if (!goalId) return;

    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: true });

      if (data) setMessages(data as Message[]);
    };

    load();
  }, [goalId]);

  // Subscribe to new messages via Realtime
  useEffect(() => {
    if (!goalId) return;

    const channel = supabase
      .channel(`goal:${goalId}:messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `goal_id=eq.${goalId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          addMessage(newMessage);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [goalId]);

  const sendMessage = useCallback(
    async (content: string, visibility: "public" | "private") => {
      if (!goalId) return;

      const response = await supabase.functions.invoke("chat", {
        body: { goal_id: goalId, content, visibility },
      });

      if (response.error) throw response.error;
      return response.data.message as Message;
    },
    [goalId]
  );

  return { messages, sendMessage };
}
```

- [ ] **Step 2: Write ChatBubble component**

Create `components/ChatBubble.tsx`:

```typescript
import { View, Text, StyleSheet } from "react-native";
import type { Message } from "../lib/types";

type Props = {
  message: Message;
};

export function ChatBubble({ message }: Props) {
  const isUser = message.sender_type === "user";
  const isFriend = message.sender_type === "friend";
  const isPrivate = message.visibility === "private";

  return (
    <View
      style={[
        styles.bubble,
        isUser ? styles.userBubble : isFriend ? styles.friendBubble : styles.llmBubble,
      ]}
    >
      {isFriend && <Text style={styles.friendLabel}>Friend</Text>}
      {isPrivate && <Text style={styles.privateLabel}>Private</Text>}
      <Text
        style={[styles.text, isUser ? styles.userText : styles.otherText]}
      >
        {message.content}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    backgroundColor: "#000",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  llmBubble: {
    backgroundColor: "#f0f0f0",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  friendBubble: {
    backgroundColor: "#e8f4ff",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  text: { fontSize: 15, lineHeight: 20 },
  userText: { color: "#fff" },
  otherText: { color: "#000" },
  friendLabel: {
    fontSize: 11,
    color: "#0077cc",
    fontWeight: "600",
    marginBottom: 4,
  },
  privateLabel: {
    fontSize: 10,
    color: "#999",
    fontStyle: "italic",
    marginBottom: 4,
  },
});
```

- [ ] **Step 3: Write ChatInput component**

Create `components/ChatInput.tsx`:

```typescript
import { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import type { Visibility } from "../lib/types";

type Props = {
  onSend: (content: string, visibility: Visibility) => Promise<void>;
};

export function ChatInput({ onSend }: Props) {
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSend(text.trim(), visibility);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.visibilityToggle}
        onPress={() =>
          setVisibility((v) => (v === "public" ? "private" : "public"))
        }
      >
        <Text style={styles.visibilityText}>
          {visibility === "public" ? "Public" : "Private"}
        </Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Ask your coach..."
        multiline
      />

      <TouchableOpacity
        style={styles.sendButton}
        onPress={handleSend}
        disabled={!text.trim() || sending}
      >
        {sending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.sendText}>Send</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
  },
  visibilityToggle: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginRight: 4,
  },
  visibilityText: {
    fontSize: 11,
    color: "#888",
    fontWeight: "600",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#000",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 8,
  },
  sendText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
```

- [ ] **Step 4: Integrate chat into the goal screen active state**

Replace `app/(tabs)/goal.tsx` entirely with:

```typescript
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useGoal } from "../../hooks/useGoal";
import { useChat } from "../../hooks/useChat";
import { GoalPlanCard } from "../../components/GoalPlanCard";
import { ChatBubble } from "../../components/ChatBubble";
import { ChatInput } from "../../components/ChatInput";
import type { GoalPlanStep } from "../../lib/types";

export default function GoalScreen() {
  const [title, setTitle] = useState("");
  const [tips, setTips] = useState("");
  const { activeGoal, loading, createGoal, activateGoal, completeGoal, loadActiveGoal } =
    useGoal();
  const { messages, sendMessage } = useChat(activeGoal?.id);

  useEffect(() => {
    loadActiveGoal();
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const result = await createGoal(title.trim());
      setTips(result.tips || "");
      setTitle("");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleActivate = async () => {
    try {
      await activateGoal();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // No active goal — show goal creation
  if (!activeGoal) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>What do you want to achieve?</Text>
        <Text style={styles.hint}>
          Describe your goal — be specific about what and where.
        </Text>

        <TextInput
          style={styles.input}
          placeholder='e.g. "Talk to 3 strangers at the coffee shop"'
          value={title}
          onChangeText={setTitle}
          multiline
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleCreate}
          disabled={loading || !title.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Generate Plan</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Planning state — show plan for review
  if (activeGoal.status === "planning") {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.heading}>{activeGoal.title}</Text>
        {tips ? <Text style={styles.tips}>{tips}</Text> : null}

        <GoalPlanCard steps={activeGoal.plan as GoalPlanStep[]} />

        <TouchableOpacity style={styles.button} onPress={handleActivate}>
          <Text style={styles.buttonText}>Start Goal</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Active state — show chat
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <View style={styles.activeHeader}>
        <Text style={styles.activeTitle}>{activeGoal.title}</Text>
        <TouchableOpacity onPress={completeGoal}>
          <Text style={styles.completeLink}>Complete</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        contentContainerStyle={{ padding: 16 }}
        style={{ flex: 1 }}
      />

      <ChatInput onSend={sendMessage} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 0, backgroundColor: "#fff" },
  heading: { fontSize: 24, fontWeight: "bold", marginBottom: 8, padding: 24, paddingBottom: 0 },
  hint: { fontSize: 14, color: "#888", marginBottom: 24, paddingHorizontal: 24 },
  tips: {
    fontSize: 14,
    color: "#555",
    fontStyle: "italic",
    marginBottom: 16,
    padding: 12,
    marginHorizontal: 24,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 16,
    marginHorizontal: 24,
  },
  button: {
    backgroundColor: "#000",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
    marginHorizontal: 24,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  activeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  activeTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
  completeLink: { fontSize: 14, color: "#888", fontWeight: "600" },
});
```

- [ ] **Step 5: Verify chat flow**

Start app + both edge functions (`supabase functions serve`). Test:
1. Create a goal → activate it
2. Type a message → Claude responds
3. Toggle visibility to "Private" → send → message shows "Private" label
4. Messages persist on reload

- [ ] **Step 6: Commit**

```bash
git add hooks/useChat.ts components/ChatBubble.tsx components/ChatInput.tsx app/(tabs)/goal.tsx
git commit -m "feat: add chat UI with Claude coaching and realtime updates"
```

---

### Task 12: Friends List Screen

**Files:**
- Create: `components/FriendRow.tsx`
- Modify: `app/(tabs)/friends.tsx`

- [ ] **Step 1: Write FriendRow component**

Create `components/FriendRow.tsx`:

```typescript
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { Profile, Friendship } from "../lib/types";

type Props = {
  profile: Profile;
  friendship: Friendship;
  currentUserId: string;
  onAccept?: () => void;
};

export function FriendRow({ profile, friendship, currentUserId, onAccept }: Props) {
  const isPending = friendship.status === "pending";
  const canAccept = isPending && friendship.friend_id === currentUserId;

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {profile.display_name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{profile.display_name}</Text>
        {isPending && (
          <Text style={styles.pending}>
            {canAccept ? "Wants to be your friend" : "Request sent"}
          </Text>
        )}
      </View>

      {canAccept && onAccept && (
        <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "500" },
  pending: { fontSize: 12, color: "#888", marginTop: 2 },
  acceptButton: {
    backgroundColor: "#000",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  acceptText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
```

- [ ] **Step 2: Write the friends screen**

Replace `app/(tabs)/friends.tsx`:

```typescript
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { FriendRow } from "../../components/FriendRow";
import type { Profile, Friendship } from "../../lib/types";
import { useAuth } from "../../hooks/useAuth";

type FriendWithProfile = {
  friendship: Friendship;
  profile: Profile;
};

export default function FriendsScreen() {
  const { session } = useAuth();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [searchName, setSearchName] = useState("");

  const userId = session?.user.id;

  const loadFriends = useCallback(async () => {
    if (!userId) return;

    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (!friendships || friendships.length === 0) {
      setFriends([]);
      return;
    }

    const friendIds = friendships.map((f) =>
      f.user_id === userId ? f.friend_id : f.user_id
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", friendIds);

    if (!profiles) return;

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const result: FriendWithProfile[] = friendships
      .map((f) => {
        const friendId = f.user_id === userId ? f.friend_id : f.user_id;
        const profile = profileMap.get(friendId);
        if (!profile) return null;
        return { friendship: f as Friendship, profile: profile as Profile };
      })
      .filter(Boolean) as FriendWithProfile[];

    setFriends(result);
  }, [userId]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const handleAddFriend = async () => {
    if (!searchName.trim() || !userId) return;

    const { data: foundProfiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .ilike("display_name", searchName.trim());

    if (!foundProfiles || foundProfiles.length === 0) {
      Alert.alert("Not found", "No user found with that name.");
      return;
    }

    const friendId = foundProfiles[0].id;
    if (friendId === userId) {
      Alert.alert("Error", "You can't add yourself.");
      return;
    }

    const { error } = await supabase.from("friendships").insert({
      user_id: userId,
      friend_id: friendId,
    });

    if (error) {
      if (error.code === "23505") {
        Alert.alert("Already sent", "Friend request already exists.");
      } else {
        Alert.alert("Error", error.message);
      }
      return;
    }

    setSearchName("");
    loadFriends();
  };

  const handleAccept = async (friendshipId: string) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendshipId);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    loadFriends();
  };

  return (
    <View style={styles.container}>
      <View style={styles.addSection}>
        <TextInput
          style={styles.input}
          placeholder="Friend's display name"
          value={searchName}
          onChangeText={setSearchName}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddFriend}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={friends}
        keyExtractor={(item) => item.friendship.id}
        renderItem={({ item }) => (
          <FriendRow
            profile={item.profile}
            friendship={item.friendship}
            currentUserId={userId!}
            onAccept={() => handleAccept(item.friendship.id)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No friends yet. Add someone above!</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  addSection: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginRight: 8,
  },
  addButton: {
    backgroundColor: "#000",
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  addButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  empty: {
    textAlign: "center",
    color: "#888",
    marginTop: 40,
    fontSize: 15,
  },
});
```

- [ ] **Step 3: Verify friends flow**

Create two accounts. From account A, add account B by display name. From account B, see pending request and accept it. Verify both users see the friendship.

- [ ] **Step 4: Commit**

```bash
git add components/FriendRow.tsx app/(tabs)/friends.tsx
git commit -m "feat: add friends list with add and accept flow"
```

---

### Task 13: Profile Screen + Goal History

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Write the full profile screen**

Replace `app/(tabs)/profile.tsx`:

```typescript
import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import type { Goal } from "../../lib/types";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!session?.user.id) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", session.user.id)
        .single();

      if (profile) setDisplayName(profile.display_name);

      const { data: goalHistory } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", session.user.id)
        .in("status", ["completed", "abandoned"])
        .order("ended_at", { ascending: false });

      if (goalHistory) setGoals(goalHistory as Goal[]);
    };

    load();
  }, [session?.user.id]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {displayName.charAt(0).toUpperCase() || "?"}
          </Text>
        </View>
        <Text style={styles.name}>{displayName || "Anonymous"}</Text>
        <Text style={styles.email}>{session?.user.email}</Text>
        <Text style={styles.stat}>
          {goals.filter((g) => g.status === "completed").length} goals completed
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Goal History</Text>

      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.goalRow}>
            <View style={styles.goalInfo}>
              <Text style={styles.goalTitle}>{item.title}</Text>
              <Text style={styles.goalDate}>
                {item.ended_at
                  ? new Date(item.ended_at).toLocaleDateString()
                  : ""}
              </Text>
            </View>
            <Text
              style={[
                styles.goalStatus,
                item.status === "completed"
                  ? styles.completed
                  : styles.abandoned,
              ]}
            >
              {item.status}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No completed goals yet.</Text>
        }
      />

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { alignItems: "center", padding: 24, borderBottomWidth: 1, borderBottomColor: "#eee" },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  name: { fontSize: 20, fontWeight: "600" },
  email: { fontSize: 14, color: "#888", marginTop: 4 },
  stat: { fontSize: 14, color: "#555", marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "600", padding: 16, paddingBottom: 8 },
  goalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  goalInfo: { flex: 1 },
  goalTitle: { fontSize: 15, fontWeight: "500" },
  goalDate: { fontSize: 12, color: "#888", marginTop: 2 },
  goalStatus: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  completed: { color: "#22c55e" },
  abandoned: { color: "#ef4444" },
  empty: { textAlign: "center", color: "#888", marginTop: 24, fontSize: 15 },
  signOutButton: {
    margin: 24,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  signOutText: { fontSize: 15, color: "#888", fontWeight: "500" },
});
```

- [ ] **Step 2: Verify profile screen**

Complete a goal, navigate to profile tab. Confirm:
1. Display name and email shown
2. Completed goals count is correct
3. Goal history list shows completed/abandoned goals
4. Sign out works

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/profile.tsx
git commit -m "feat: add profile screen with goal history"
```

---

### Task 14: CLAUDE.md + Final Verification

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write CLAUDE.md**

Create `CLAUDE.md` at project root:

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Focus Goal App — a digital detox app where users set real-world goals, get AI coaching from Claude, and have friends monitor progress via a live dashboard. Built with Expo (React Native) + Supabase + Claude API.

## Architecture

Expo App (React Native + TypeScript) → Supabase Client SDK → Supabase (Auth, Postgres, Realtime, Edge Functions, Storage) → Claude API (via Edge Functions).

Three roles: User (sets goals, chats with Claude), Friend (monitors via live dashboard), Claude (coaches user, incorporates friend advice).

## Commands

### App Development

npx expo start                    # Start Metro bundler
npx expo start --clear            # Start with cache cleared

### Supabase

supabase start                    # Start local Supabase (Postgres, Auth, Realtime)
supabase stop                     # Stop local Supabase
supabase functions serve          # Serve all Edge Functions locally
supabase db reset                 # Reset database and re-run migrations
supabase migration new <name>     # Create a new migration

### Environment

.env.local requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
supabase/.env.local requires ANTHROPIC_API_KEY.

## Key Patterns

- Edge Functions wrap Claude API — API key never touches the client. All LLM calls go through supabase/functions/.
- Unified messages table — user, Claude, and friend messages in one table. sender_type distinguishes them. visibility controls friend access.
- Realtime via Postgres changes — messages table has supabase_realtime publication enabled. Client subscribes to postgres_changes events.
- Auth gate in root layout — app/_layout.tsx redirects based on session state.
- Zustand for session state — active goal and messages stored in Zustand. Reloaded from Supabase on mount.

## Data Model

Core tables: profiles, friendships, goals, messages. All have RLS policies. See supabase/migrations/00001_initial_schema.sql for full schema.

## Phasing

- Phase 1 (current): Auth, goal creation + Claude planning, LLM chat, friends list
- Phase 2: Location tracking, live friend dashboard, photo posting
- Phase 3: Push notifications, watcher comments, progress summaries
- Phase 4: iOS app blocking via Screen Time API
```

- [ ] **Step 2: Full verification**

Run through the complete flow:
1. `supabase start` — local Supabase running
2. `supabase functions serve` — edge functions running
3. `npx expo start` — app running
4. Sign up with two accounts
5. Account A: create a goal → Claude generates plan → activate goal → chat with Claude
6. Account A: add Account B as friend
7. Account B: accept friend request
8. Account A: complete goal → shows in profile history
9. Sign out and back in — state persists

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with project overview and commands"
```
