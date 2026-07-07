# Expo to React Native CLI Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Focus Goal App from Expo to React Native CLI so it builds natively in Xcode on Mac and runs on iOS Simulator.

**Architecture:** Replace expo-router with @react-navigation (stack + tabs), swap Expo-specific native modules (location, image-picker, image) with community RN equivalents, and create a standard RN CLI project structure. Backend (Supabase, Edge Functions, migrations) stays untouched.

**Tech Stack:** React Native 0.79 (CLI), @react-navigation/native v7, react-native-image-picker, @react-native-community/geolocation, react-native-config, TypeScript

**Bundle ID:** `com.focusgoal.app`

---

## File Structure

### Files to CREATE

| File | Purpose |
|------|---------|
| `index.js` | RN CLI entry point, registers App component |
| `src/App.tsx` | Root component with NavigationContainer + auth gate |
| `src/navigation/AuthStack.tsx` | Stack navigator for login/signup |
| `src/navigation/MainTabs.tsx` | Bottom tab navigator for goal/friends/profile |
| `src/navigation/RootNavigator.tsx` | Switches between AuthStack and MainTabs based on session |
| `src/navigation/types.ts` | Navigation type definitions for type-safe navigation |
| `src/screens/LoginScreen.tsx` | Login screen (migrated from app/(auth)/login.tsx) |
| `src/screens/SignupScreen.tsx` | Signup screen (migrated from app/(auth)/signup.tsx) |
| `src/screens/GoalScreen.tsx` | Goal screen (migrated from app/(tabs)/goal.tsx) |
| `src/screens/FriendsScreen.tsx` | Friends screen (migrated from app/(tabs)/friends.tsx) |
| `src/screens/ProfileScreen.tsx` | Profile screen (migrated from app/(tabs)/profile.tsx) |
| `src/screens/WatchScreen.tsx` | Watch screen (migrated from app/watch/[goalId].tsx) |
| `react-native.config.js` | RN CLI config |
| `.env` | Environment variables (SUPABASE_URL, SUPABASE_ANON_KEY) |
| `.env.example` | Template for env vars |
| `babel.config.js` | Babel config for RN CLI (replaces Expo's) |
| `metro.config.js` | Metro bundler config |
| `setup-mac.sh` | Script to run on Mac: installs deps, pods, opens Xcode |

### Files to MODIFY

| File | Purpose |
|------|---------|
| `package.json` | Remove Expo deps, add RN CLI deps |
| `tsconfig.json` | Remove Expo extends, standalone TS config |
| `src/lib/supabase.ts` | Replace EXPO_PUBLIC_ env vars with react-native-config |
| `src/hooks/useLocation.ts` | Replace expo-location with @react-native-community/geolocation |
| `src/hooks/usePhotos.ts` | Replace expo-image-picker with react-native-image-picker |
| `src/components/PhotoGrid.tsx` | Replace expo-image with RN Image |
| `CLAUDE.md` | Update commands and architecture |

### Files to DELETE

| File | Purpose |
|------|---------|
| `src/app/` (entire directory) | Expo Router file-based routing — replaced by src/navigation/ + src/screens/ |
| `app.json` | Expo config — replaced by native project config |
| `expo-env.d.ts` | Expo type definitions |
| `.expo/` | Expo cache |

### Files UNCHANGED

| File | Purpose |
|------|---------|
| `src/lib/types.ts` | Type definitions (no Expo deps) |
| `src/stores/appStore.ts` | Zustand store (no Expo deps) |
| `src/hooks/useAuth.ts` | Auth hook (no Expo deps) |
| `src/hooks/useChat.ts` | Chat hook (no Expo deps) |
| `src/hooks/useGoal.ts` | Goal hook (no Expo deps) |
| `src/components/ChatBubble.tsx` | Chat bubble (no Expo deps) |
| `src/components/ChatInput.tsx` | Chat input (no Expo deps) |
| `src/components/GoalPlanCard.tsx` | Goal plan card (no Expo deps) |
| `src/components/FriendRow.tsx` | Friend row (no Expo deps) |
| `src/components/LocationIndicator.tsx` | Location indicator (no Expo deps) |
| `src/components/PhotoCapture.tsx` | Photo capture modal (no Expo deps) |
| `src/components/LiveMap.tsx` | Map component (uses react-native-maps, no Expo) |
| `supabase/` (entire directory) | Backend — completely untouched |

---

### Task 1: Update package.json — Remove Expo, Add RN CLI deps

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace package.json contents**

Replace the entire `package.json` with RN CLI dependencies:

```json
{
  "name": "FocusGoal",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "react-native start",
    "ios": "react-native run-ios",
    "android": "react-native run-android",
    "clean": "cd ios && rm -rf build Pods && pod install && cd .."
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "^2.1.0",
    "@react-native-community/geolocation": "^3.4.0",
    "@react-navigation/bottom-tabs": "^7.3.0",
    "@react-navigation/native": "^7.1.0",
    "@react-navigation/native-stack": "^7.3.0",
    "@supabase/supabase-js": "^2.108.0",
    "react": "19.0.0",
    "react-native": "0.79.2",
    "react-native-config": "^1.5.3",
    "react-native-gesture-handler": "^2.24.0",
    "react-native-image-picker": "^7.2.3",
    "react-native-maps": "^1.20.1",
    "react-native-reanimated": "^3.17.4",
    "react-native-safe-area-context": "^5.4.0",
    "react-native-screens": "^4.10.0",
    "react-native-url-polyfill": "^3.0.0",
    "zustand": "^5.0.14"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@babel/preset-env": "^7.25.0",
    "@babel/runtime": "^7.25.0",
    "@react-native/babel-preset": "0.79.2",
    "@react-native/metro-config": "0.79.2",
    "@react-native/typescript-config": "0.79.2",
    "@types/react": "~19.1.10",
    "typescript": "~5.9.2"
  }
}
```

- [ ] **Step 2: Verify package.json is valid JSON**

Run: `node -e "require('./package.json'); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: replace Expo deps with React Native CLI deps"
```

---

### Task 2: Create RN CLI config files

**Files:**
- Create: `index.js`
- Create: `babel.config.js`
- Create: `metro.config.js`
- Create: `react-native.config.js`
- Create: `.env.example`
- Create: `.env`
- Modify: `tsconfig.json`

- [ ] **Step 1: Create index.js entry point**

```javascript
import { AppRegistry } from 'react-native';
import App from './src/App';

AppRegistry.registerComponent('FocusGoal', () => App);
```

- [ ] **Step 2: Create babel.config.js**

```javascript
module.exports = {
  presets: ['@react-native/babel-preset'],
  plugins: ['react-native-reanimated/plugin'],
};
```

- [ ] **Step 3: Create metro.config.js**

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

- [ ] **Step 4: Create react-native.config.js**

```javascript
module.exports = {};
```

- [ ] **Step 5: Create .env.example**

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 6: Create .env with same content as .env.example**

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 7: Update tsconfig.json**

Replace with standalone config (no Expo extends):

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "commonjs",
    "lib": ["es2021"],
    "jsx": "react-native",
    "strict": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "ios", "android"]
}
```

- [ ] **Step 8: Commit**

```bash
git add index.js babel.config.js metro.config.js react-native.config.js .env.example .env tsconfig.json
git commit -m "chore: add RN CLI config files and entry point"
```

---

### Task 3: Create navigation types and structure

**Files:**
- Create: `src/navigation/types.ts`
- Create: `src/navigation/AuthStack.tsx`
- Create: `src/navigation/MainTabs.tsx`
- Create: `src/navigation/RootNavigator.tsx`

- [ ] **Step 1: Create navigation type definitions**

Create `src/navigation/types.ts`:

```typescript
export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  Goal: undefined;
  Friends: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Watch: { goalId: string };
};
```

- [ ] **Step 2: Create AuthStack**

Create `src/navigation/AuthStack.tsx`:

```typescript
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import type { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 3: Create MainTabs**

Create `src/navigation/MainTabs.tsx`:

```typescript
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import GoalScreen from "../screens/GoalScreen";
import FriendsScreen from "../screens/FriendsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#000",
        headerShown: true,
      }}
    >
      <Tab.Screen
        name="Goal"
        component={GoalScreen}
        options={{ tabBarLabel: "Goal" }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{ tabBarLabel: "Friends" }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: "Profile" }}
      />
    </Tab.Navigator>
  );
}
```

- [ ] **Step 4: Create RootNavigator**

Create `src/navigation/RootNavigator.tsx`:

```typescript
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { MainTabs } from "./MainTabs";
import WatchScreen from "../screens/WatchScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Watch"
        component={WatchScreen}
        options={{ title: "Watch Goal" }}
      />
    </Stack.Navigator>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/navigation/
git commit -m "feat: add react-navigation structure (auth stack, tabs, root)"
```

---

### Task 4: Create App.tsx root component

**Files:**
- Create: `src/App.tsx`

- [ ] **Step 1: Create App.tsx with auth gate**

```typescript
import { NavigationContainer } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuth } from "./hooks/useAuth";
import { AuthStack } from "./navigation/AuthStack";
import { RootNavigator } from "./navigation/RootNavigator";

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          {session ? <RootNavigator /> : <AuthStack />}
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add App.tsx root with auth gate and navigation container"
```

---

### Task 5: Migrate screens from Expo Router to React Navigation

**Files:**
- Create: `src/screens/LoginScreen.tsx`
- Create: `src/screens/SignupScreen.tsx`
- Create: `src/screens/GoalScreen.tsx`
- Create: `src/screens/FriendsScreen.tsx`
- Create: `src/screens/ProfileScreen.tsx`
- Create: `src/screens/WatchScreen.tsx`

- [ ] **Step 1: Create LoginScreen.tsx**

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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../hooks/useAuth";
import type { AuthStackParamList } from "../navigation/types";

type LoginNav = NativeStackNavigationProp<AuthStackParamList, "Login">;

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigation = useNavigation<LoginNav>();

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Login failed", message);
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

      <TouchableOpacity
        style={styles.link}
        onPress={() => navigation.navigate("Signup")}
      >
        <Text style={styles.linkText}>Don't have an account? Sign up</Text>
      </TouchableOpacity>
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

- [ ] **Step 2: Create SignupScreen.tsx**

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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../hooks/useAuth";
import type { AuthStackParamList } from "../navigation/types";

type SignupNav = NativeStackNavigationProp<AuthStackParamList, "Signup">;

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigation = useNavigation<SignupNav>();

  const handleSignup = async () => {
    if (!displayName || !email || !password) return;
    setLoading(true);
    try {
      await signUp(email, password, displayName);
      Alert.alert("Success", "Check your email to confirm your account.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Signup failed", message);
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

      <TouchableOpacity
        style={styles.link}
        onPress={() => navigation.navigate("Login")}
      >
        <Text style={styles.linkText}>Already have an account? Sign in</Text>
      </TouchableOpacity>
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

- [ ] **Step 3: Create GoalScreen.tsx**

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
import { useGoal } from "../hooks/useGoal";
import { useChat } from "../hooks/useChat";
import { useLocation } from "../hooks/useLocation";
import { usePhotos } from "../hooks/usePhotos";
import { GoalPlanCard } from "../components/GoalPlanCard";
import { ChatBubble } from "../components/ChatBubble";
import { ChatInput } from "../components/ChatInput";
import { LocationIndicator } from "../components/LocationIndicator";
import { PhotoCapture } from "../components/PhotoCapture";
import { PhotoGrid } from "../components/PhotoGrid";
import type { GoalPlanStep } from "../lib/types";

export default function GoalScreen() {
  const [title, setTitle] = useState("");
  const [tips, setTips] = useState("");
  const [showPhotos, setShowPhotos] = useState(false);
  const { activeGoal, loading, createGoal, activateGoal, completeGoal, loadActiveGoal } =
    useGoal();
  const { messages, sendMessage } = useChat(activeGoal?.id);
  const isActive = activeGoal?.status === "active";
  const { hasPermission, currentLocation } = useLocation({
    goalId: activeGoal?.id,
    enabled: isActive,
  });
  const { photos, uploading, pickAndUpload, takeAndUpload } = usePhotos(
    isActive ? activeGoal?.id : undefined
  );

  useEffect(() => {
    loadActiveGoal();
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const result = await createGoal(title.trim());
      setTips(result.tips || "");
      setTitle("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error", message);
    }
  };

  const handleActivate = async () => {
    try {
      await activateGoal();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error", message);
    }
  };

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

  return (
    <KeyboardAvoidingView
      style={styles.chatContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <View style={styles.activeHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.activeTitle}>{activeGoal.title}</Text>
          <LocationIndicator
            hasPermission={hasPermission}
            isTracking={currentLocation !== null}
          />
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowPhotos((v) => !v)}>
            <Text style={styles.toggleLink}>
              {showPhotos ? "Chat" : `Photos (${photos.length})`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={completeGoal}>
            <Text style={styles.completeLink}>Complete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showPhotos ? (
        <ScrollView style={{ flex: 1 }}>
          <PhotoGrid photos={photos} />
        </ScrollView>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={{ padding: 16 }}
          style={{ flex: 1 }}
        />
      )}

      <PhotoCapture
        uploading={uploading}
        onPickFromGallery={pickAndUpload}
        onTakePhoto={takeAndUpload}
      />

      <ChatInput onSend={async (content, visibility) => { await sendMessage(content, visibility); }} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#fff" },
  chatContainer: { flex: 1, backgroundColor: "#fff" },
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
  activeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerLeft: { flex: 1, gap: 4 },
  headerRight: { flexDirection: "row", gap: 16, alignItems: "center" },
  activeTitle: { fontSize: 16, fontWeight: "600" },
  toggleLink: { fontSize: 13, color: "#0077cc", fontWeight: "600" },
  completeLink: { fontSize: 14, color: "#888", fontWeight: "600" },
});
```

- [ ] **Step 4: Create FriendsScreen.tsx**

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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../lib/supabase";
import { FriendRow } from "../components/FriendRow";
import type { Profile, Friendship } from "../lib/types";
import { useAuth } from "../hooks/useAuth";
import type { RootStackParamList } from "../navigation/types";

type FriendsNav = NativeStackNavigationProp<RootStackParamList>;

type FriendWithProfile = {
  friendship: Friendship;
  profile: Profile;
  activeGoalId?: string;
};

export default function FriendsScreen() {
  const { session } = useAuth();
  const navigation = useNavigation<FriendsNav>();
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

    const { data: activeGoals } = await supabase
      .from("goals")
      .select("id, user_id")
      .in("user_id", friendIds)
      .eq("status", "active");

    const activeGoalMap = new Map(
      (activeGoals || []).map((g) => [g.user_id, g.id])
    );

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const result: FriendWithProfile[] = friendships
      .map((f) => {
        const friendId = f.user_id === userId ? f.friend_id : f.user_id;
        const profile = profileMap.get(friendId);
        if (!profile) return null;
        return {
          friendship: f as Friendship,
          profile: profile as Profile,
          activeGoalId: activeGoalMap.get(friendId),
        };
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

  const handleWatch = async (goalId: string) => {
    if (!userId) return;

    await supabase
      .from("goal_watchers")
      .upsert({ goal_id: goalId, friend_id: userId }, { onConflict: "goal_id,friend_id" });

    navigation.navigate("Watch", { goalId });
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
            activeGoalId={item.activeGoalId}
            onAccept={() => handleAccept(item.friendship.id)}
            onWatch={
              item.activeGoalId
                ? () => handleWatch(item.activeGoalId!)
                : undefined
            }
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

- [ ] **Step 5: Create ProfileScreen.tsx**

```typescript
import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import type { Goal } from "../lib/types";

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

- [ ] **Step 6: Create WatchScreen.tsx**

```typescript
import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { LiveMap } from "../components/LiveMap";
import { ChatBubble } from "../components/ChatBubble";
import { PhotoGrid } from "../components/PhotoGrid";
import type { Goal, Message, LocationPing, GoalPhoto } from "../lib/types";
import type { RootStackParamList } from "../navigation/types";

type WatchRoute = RouteProp<RootStackParamList, "Watch">;
type Tab = "chat" | "photos";

export default function WatchScreen() {
  const route = useRoute<WatchRoute>();
  const navigation = useNavigation();
  const { goalId } = route.params;
  const [goal, setGoal] = useState<Goal | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pings, setPings] = useState<LocationPing[]>([]);
  const [photos, setPhotos] = useState<GoalPhoto[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  useEffect(() => {
    if (!goalId) return;

    const load = async () => {
      const { data } = await supabase
        .from("goals")
        .select("*")
        .eq("id", goalId)
        .single();

      if (data) setGoal(data as Goal);
    };

    load();
  }, [goalId]);

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

    const channel = supabase
      .channel(`watch:${goalId}:messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `goal_id=eq.${goalId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.visibility === "public") {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [goalId]);

  useEffect(() => {
    if (!goalId) return;

    const load = async () => {
      const { data } = await supabase
        .from("location_pings")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: true });

      if (data) setPings(data as LocationPing[]);
    };

    load();

    const channel = supabase
      .channel(`watch:${goalId}:location`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "location_pings",
          filter: `goal_id=eq.${goalId}`,
        },
        (payload) => {
          setPings((prev) => [...prev, payload.new as LocationPing]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [goalId]);

  useEffect(() => {
    if (!goalId) return;

    const load = async () => {
      const { data } = await supabase
        .from("goal_photos")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: true });

      if (data) setPhotos(data as GoalPhoto[]);
    };

    load();

    const channel = supabase
      .channel(`watch:${goalId}:photos`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "goal_photos",
          filter: `goal_id=eq.${goalId}`,
        },
        (payload) => {
          setPhotos((prev) => [...prev, payload.new as GoalPhoto]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [goalId]);

  if (!goal) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (goal.status === "completed" || goal.status === "abandoned") {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>{goal.title}</Text>
        <Text style={styles.statusText}>
          Goal {goal.status}
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LiveMap pings={pings} height={200} />

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "chat" && styles.tabActive]}
          onPress={() => setActiveTab("chat")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "chat" && styles.tabTextActive,
            ]}
          >
            Chat ({messages.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "photos" && styles.tabActive]}
          onPress={() => setActiveTab("photos")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "photos" && styles.tabTextActive,
            ]}
          >
            Photos ({photos.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "chat" ? (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={{ padding: 16 }}
          style={{ flex: 1 }}
        />
      ) : (
        <FlatList
          data={[{ key: "grid" }]}
          keyExtractor={(item) => item.key}
          renderItem={() => <PhotoGrid photos={photos} />}
          style={{ flex: 1 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  heading: { fontSize: 18, fontWeight: "600" },
  loadingText: { fontSize: 16, color: "#888" },
  statusText: {
    fontSize: 16,
    color: "#888",
    marginTop: 8,
    textTransform: "capitalize",
  },
  backButton: {
    backgroundColor: "#000",
    borderRadius: 8,
    padding: 14,
    paddingHorizontal: 24,
    marginTop: 24,
  },
  backButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#000",
  },
  tabText: { fontSize: 14, color: "#888" },
  tabTextActive: { color: "#000", fontWeight: "600" },
});
```

- [ ] **Step 7: Commit**

```bash
git add src/screens/
git commit -m "feat: migrate all screens from expo-router to react-navigation"
```

---

### Task 6: Update hooks — Replace Expo native modules

**Files:**
- Modify: `src/hooks/useLocation.ts`
- Modify: `src/hooks/usePhotos.ts`
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Rewrite useLocation.ts with @react-native-community/geolocation**

Replace `src/hooks/useLocation.ts`:

```typescript
import { useEffect, useRef, useState } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import Geolocation from "@react-native-community/geolocation";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../stores/appStore";

type UseLocationOptions = {
  goalId: string | undefined;
  enabled: boolean;
};

export function useLocation({ goalId, enabled }: UseLocationOptions) {
  const [hasPermission, setHasPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const { addLocationPing } = useAppStore();

  useEffect(() => {
    if (!enabled) return;

    const requestPermission = async () => {
      if (Platform.OS === "ios") {
        Geolocation.requestAuthorization("whenInUse");
        setHasPermission(true);
        return;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
    };

    requestPermission();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !hasPermission || !goalId) return;

    const startTracking = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      watchIdRef.current = Geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          setCurrentLocation({ lat, lng });

          const { data, error } = await supabase
            .from("location_pings")
            .insert({
              goal_id: goalId,
              user_id: user.id,
              lat,
              lng,
            })
            .select()
            .single();

          if (data && !error) {
            addLocationPing(data);
          }
        },
        () => {
          setHasPermission(false);
        },
        {
          enableHighAccuracy: false,
          distanceFilter: 20,
          interval: 15000,
          fastestInterval: 10000,
        }
      );
    };

    startTracking();

    return () => {
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, hasPermission, goalId]);

  return { hasPermission, currentLocation };
}
```

- [ ] **Step 2: Rewrite usePhotos.ts with react-native-image-picker**

Replace `src/hooks/usePhotos.ts`:

```typescript
import { useEffect, useCallback, useState } from "react";
import { launchImageLibrary, launchCamera } from "react-native-image-picker";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../stores/appStore";
import type { GoalPhoto } from "../lib/types";

export function usePhotos(goalId: string | undefined) {
  const { photos, setPhotos, addPhoto } = useAppStore();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!goalId) return;

    const load = async () => {
      const { data } = await supabase
        .from("goal_photos")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: true });

      if (data) setPhotos(data as GoalPhoto[]);
    };

    load();
  }, [goalId]);

  useEffect(() => {
    if (!goalId) return;

    const channel = supabase
      .channel(`goal:${goalId}:photos`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "goal_photos",
          filter: `goal_id=eq.${goalId}`,
        },
        (payload) => {
          const newPhoto = payload.new as GoalPhoto;
          addPhoto(newPhoto);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [goalId]);

  const uploadAsset = useCallback(
    async (uri: string, type: string | undefined, caption: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = uri.split(".").pop() || "jpg";
      const fileName = `${goalId}/${Date.now()}.${fileExt}`;

      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("goal-photos")
        .upload(fileName, arrayBuffer, {
          contentType: type || "image/jpeg",
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("goal-photos").getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from("goal_photos")
        .insert({
          goal_id: goalId,
          user_id: user.id,
          image_url: publicUrl,
          caption,
        });

      if (insertError) throw insertError;
    },
    [goalId]
  );

  const pickAndUpload = useCallback(
    async (caption: string) => {
      if (!goalId) return;

      const result = await launchImageLibrary({
        mediaType: "photo",
        quality: 0.7,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) return;

      setUploading(true);
      try {
        const asset = result.assets[0];
        if (!asset.uri) return;
        await uploadAsset(asset.uri, asset.type, caption);
      } finally {
        setUploading(false);
      }
    },
    [goalId, uploadAsset]
  );

  const takeAndUpload = useCallback(
    async (caption: string) => {
      if (!goalId) return;

      const result = await launchCamera({
        mediaType: "photo",
        quality: 0.7,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) return;

      setUploading(true);
      try {
        const asset = result.assets[0];
        if (!asset.uri) return;
        await uploadAsset(asset.uri, asset.type, caption);
      } finally {
        setUploading(false);
      }
    },
    [goalId, uploadAsset]
  );

  return { photos, uploading, pickAndUpload, takeAndUpload };
}
```

- [ ] **Step 3: Update supabase.ts — use react-native-config**

Replace `src/lib/supabase.ts`:

```typescript
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Config from "react-native-config";

const supabaseUrl = Config.SUPABASE_URL!;
const supabaseAnonKey = Config.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useLocation.ts src/hooks/usePhotos.ts src/lib/supabase.ts
git commit -m "feat: replace expo-location and expo-image-picker with RN community modules"
```

---

### Task 7: Update PhotoGrid and LiveMap — Remove Expo deps

**Files:**
- Modify: `src/components/PhotoGrid.tsx`
- Modify: `src/components/LiveMap.tsx`

- [ ] **Step 1: Replace expo-image with React Native Image in PhotoGrid**

Replace `src/components/PhotoGrid.tsx`:

```typescript
import { View, Text, Image, StyleSheet, Dimensions } from "react-native";
import type { GoalPhoto } from "../lib/types";

type Props = {
  photos: GoalPhoto[];
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const PHOTO_SIZE = (SCREEN_WIDTH - 48 - 8) / 3;

export function PhotoGrid({ photos }: Props) {
  if (photos.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Photos ({photos.length})</Text>
      <View style={styles.grid}>
        {photos.map((photo) => (
          <View key={photo.id} style={styles.photoWrapper}>
            <Image
              source={{ uri: photo.image_url }}
              style={styles.photo}
              resizeMode="cover"
            />
            {photo.caption ? (
              <Text style={styles.caption} numberOfLines={1}>
                {photo.caption}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: "#555" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  photoWrapper: { width: PHOTO_SIZE },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
  },
  caption: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
});
```

- [ ] **Step 2: Simplify LiveMap — iOS only, direct imports**

Replace `src/components/LiveMap.tsx`:

```typescript
import { StyleSheet } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import type { LocationPing } from "../lib/types";

type Props = {
  pings: LocationPing[];
  height?: number;
};

export function LiveMap({ pings, height = 200 }: Props) {
  if (pings.length === 0) {
    return (
      <MapView
        style={[styles.map, { height }]}
        initialRegion={{
          latitude: 35.6762,
          longitude: 139.6503,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      />
    );
  }

  const latestPing = pings[pings.length - 1];
  const coordinates = pings.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  }));

  return (
    <MapView
      style={[styles.map, { height }]}
      region={{
        latitude: latestPing.lat,
        longitude: latestPing.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }}
    >
      {coordinates.length > 1 && (
        <Polyline
          coordinates={coordinates}
          strokeColor="#000"
          strokeWidth={3}
        />
      )}
      <Marker
        coordinate={{
          latitude: latestPing.lat,
          longitude: latestPing.lng,
        }}
        title="Current Location"
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PhotoGrid.tsx src/components/LiveMap.tsx
git commit -m "refactor: remove expo-image and web fallback from components"
```

---

### Task 8: Delete old Expo files and web-only components

**Files:**
- Delete: `src/app/` (entire directory)
- Delete: `app.json`
- Delete: `expo-env.d.ts`
- Delete: web-only components and hooks

- [ ] **Step 1: Delete old Expo router directory**

```bash
rm -rf src/app
```

- [ ] **Step 2: Delete Expo config files**

```bash
rm -f app.json expo-env.d.ts
```

- [ ] **Step 3: Delete web-only and Expo-only components/hooks**

```bash
rm -f src/hooks/use-color-scheme.ts src/hooks/use-color-scheme.web.ts
rm -f src/components/animated-icon.tsx src/components/animated-icon.web.tsx src/components/animated-icon.module.css
rm -f src/components/app-tabs.tsx src/components/app-tabs.web.tsx
rm -f src/components/themed-text.tsx src/components/themed-view.tsx
rm -f src/components/external-link.tsx src/components/hint-row.tsx src/components/web-badge.tsx
rm -rf src/components/ui
rm -f src/constants/theme.ts
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove Expo router, config, and web-only components"
```

---

### Task 9: Create Mac setup script and update .gitignore

**Files:**
- Create: `setup-mac.sh`
- Modify: `.gitignore`

- [ ] **Step 1: Create setup-mac.sh**

```bash
#!/bin/bash
set -e

echo "=== Focus Goal App — Mac Setup ==="
echo ""

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v pod >/dev/null 2>&1 || { echo "CocoaPods is required. Run: sudo gem install cocoapods"; exit 1; }

# Install JS dependencies
echo "Installing npm dependencies..."
npm install

# Initialize React Native iOS project if ios/ doesn't exist
if [ ! -d "ios" ]; then
  echo "Generating iOS project..."
  npx @react-native-community/cli init FocusGoal --directory /tmp/rn-init-temp --version 0.79.2 --skip-install
  cp -r /tmp/rn-init-temp/ios ./ios
  rm -rf /tmp/rn-init-temp

  # Update bundle identifier
  find ios -name "*.pbxproj" -exec sed -i '' 's/org.reactjs.native.example.FocusGoal/com.focusgoal.app/g' {} +

  echo "iOS project generated with bundle ID: com.focusgoal.app"
fi

# Install CocoaPods
echo "Installing CocoaPods dependencies..."
cd ios
pod install
cd ..

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To run the app:"
echo "  npx react-native run-ios"
echo ""
echo "Or open in Xcode:"
echo "  open ios/FocusGoal.xcworkspace"
```

- [ ] **Step 2: Update .gitignore — add iOS build artifacts and env**

Append to `.gitignore`:

```
# iOS
ios/build/
ios/Pods/
ios/*.xcworkspace/xcuserdata/

# Environment
.env
.env.local

# Node
node_modules/

# Metro
.metro-health-check*

# React Native
*.jsbundle
```

- [ ] **Step 3: Commit**

```bash
chmod +x setup-mac.sh
git add setup-mac.sh .gitignore
git commit -m "chore: add Mac setup script and update .gitignore"
```

---

### Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md for RN CLI**

Update the commands, architecture, and key patterns sections to reflect the new React Native CLI setup instead of Expo.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for React Native CLI migration"
```

---

## Mac Workflow (after git pull)

Once you push from Windows and pull on your MacBook:

```bash
git clone <repo-url>
cd app1

# Copy .env.example to .env and fill in Supabase credentials
cp .env.example .env

# Run the setup script
./setup-mac.sh

# Start Metro + build iOS
npx react-native run-ios
```

This will build the app and launch it in the iOS Simulator.
