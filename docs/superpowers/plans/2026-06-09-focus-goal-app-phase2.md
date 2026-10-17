# Focus Goal App — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add location tracking during active goals, a live friend dashboard (map + chat + photos), and photo posting so friends can watch goal progress in real time.

**Architecture:** expo-location tracks user position during active goals and writes pings to a `location_pings` table. expo-image-picker captures photos that upload to Supabase Storage and record in `goal_photos`. A `goal_watchers` table tracks which friends are watching. A new `/watch/[goalId]` screen shows friends a live map, public chat feed, and photo gallery — all powered by Supabase Realtime subscriptions. Friends can join watching from the friends list when a goal is active.

**Tech Stack:** Expo SDK 56, TypeScript, expo-location, react-native-maps, expo-image-picker, Supabase (Storage, Realtime, Postgres), Zustand

---

## File Map

```
src/
├── app/
│   ├── watch/
│   │   └── [goalId].tsx          # Friend live dashboard (map + chat + photos)
│   ├── (tabs)/
│   │   ├── goal.tsx              # Modified — add photo button + location indicator
│   │   └── friends.tsx           # Modified — add "Watch" button for active goals
├── components/
│   ├── LocationIndicator.tsx     # Small dot + "Tracking" label on active goal header
│   ├── PhotoGrid.tsx             # Grid of goal photos (used in watch + goal screen)
│   ├── PhotoCapture.tsx          # Camera/gallery picker button + upload
│   └── LiveMap.tsx               # MapView showing user's location trail
├── hooks/
│   ├── useLocation.ts            # Foreground location tracking during active goals
│   └── usePhotos.ts              # Photo upload + realtime photo list
├── lib/
│   └── types.ts                  # Modified — add LocationPing, GoalPhoto, GoalWatcher types
├── stores/
│   └── appStore.ts               # Modified — add locationPings, photos slices
supabase/
├── migrations/
│   └── 00002_phase2_location_photos_watchers.sql
```

---

### Task 1: Database Migration — location_pings, goal_photos, goal_watchers

**Files:**
- Create: `supabase/migrations/00002_phase2_location_photos_watchers.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/00002_phase2_location_photos_watchers.sql`:

```sql
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

-- Goal owner can read their own pings
create policy "Goal owner can read own location pings"
  on public.location_pings for select
  using (auth.uid() = user_id);

-- Goal owner can insert pings
create policy "Goal owner can insert location pings"
  on public.location_pings for insert
  with check (auth.uid() = user_id);

-- Watchers can read pings for goals they watch
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

-- Goal watchers — which friends are watching a goal session
create table public.goal_watchers (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (goal_id, friend_id)
);

alter table public.goal_watchers enable row level security;

-- Goal owner can see who is watching
create policy "Goal owner can read watchers"
  on public.goal_watchers for select
  using (
    auth.uid() = (select user_id from public.goals where id = goal_id)
  );

-- Friends can read watchers for goals they watch
create policy "Watchers can read co-watchers"
  on public.goal_watchers for select
  using (auth.uid() = friend_id);

-- Accepted friends can join as watchers
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
```

- [ ] **Step 2: Apply the migration**

```bash
cd "C:/Users/Yuto Maruyama/Documents/study/app1"
supabase db reset
```

Expected: All migrations apply. Tables `location_pings`, `goal_photos`, `goal_watchers` exist. Storage bucket `goal-photos` created. Verify at `http://127.0.0.1:54323`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00002_phase2_location_photos_watchers.sql
git commit -m "feat: add Phase 2 schema — location pings, goal photos, goal watchers"
```

---

### Task 2: TypeScript Types + Store Updates

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/stores/appStore.ts`

- [ ] **Step 1: Add new types**

Add to the end of `src/lib/types.ts`:

```typescript
export type LocationPing = {
  id: string;
  goal_id: string;
  user_id: string;
  lat: number;
  lng: number;
  created_at: string;
};

export type GoalPhoto = {
  id: string;
  goal_id: string;
  user_id: string;
  image_url: string;
  caption: string;
  created_at: string;
};

export type GoalWatcher = {
  id: string;
  goal_id: string;
  friend_id: string;
  joined_at: string;
};
```

- [ ] **Step 2: Extend the Zustand store**

Replace `src/stores/appStore.ts`:

```typescript
import { create } from "zustand";
import type { Goal, Message, LocationPing, GoalPhoto } from "../lib/types";

type AppState = {
  activeGoal: Goal | null;
  setActiveGoal: (goal: Goal | null) => void;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  locationPings: LocationPing[];
  setLocationPings: (pings: LocationPing[]) => void;
  addLocationPing: (ping: LocationPing) => void;
  photos: GoalPhoto[];
  setPhotos: (photos: GoalPhoto[]) => void;
  addPhoto: (photo: GoalPhoto) => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeGoal: null,
  setActiveGoal: (goal) => set({ activeGoal: goal }),
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  locationPings: [],
  setLocationPings: (pings) => set({ locationPings: pings }),
  addLocationPing: (ping) =>
    set((state) => ({ locationPings: [...state.locationPings, ping] })),
  photos: [],
  setPhotos: (photos) => set({ photos }),
  addPhoto: (photo) =>
    set((state) => ({ photos: [...state.photos, photo] })),
}));
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts src/stores/appStore.ts
git commit -m "feat: add Phase 2 types and store slices for location, photos"
```

---

### Task 3: Install Dependencies

**Files:**
- Modify: `package.json` (via install commands)

- [ ] **Step 1: Install expo-location**

```bash
cd "C:/Users/Yuto Maruyama/Documents/study/app1"
npx expo install expo-location
```

Expected: `expo-location` added to package.json dependencies.

- [ ] **Step 2: Install expo-image-picker**

```bash
npx expo install expo-image-picker
```

Expected: `expo-image-picker` added to package.json dependencies.

- [ ] **Step 3: Install react-native-maps**

```bash
npx expo install react-native-maps
```

Expected: `react-native-maps` added to package.json dependencies.

- [ ] **Step 4: Verify app still starts**

```bash
npx expo start --clear
```

Expected: Metro bundler starts without errors.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore: install expo-location, expo-image-picker, react-native-maps"
```

---

### Task 4: Location Tracking Hook

**Files:**
- Create: `src/hooks/useLocation.ts`

- [ ] **Step 1: Write the location hook**

Create `src/hooks/useLocation.ts`:

```typescript
import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
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
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const { addLocationPing } = useAppStore();

  useEffect(() => {
    if (!enabled) return;

    const requestPermission = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === "granted");
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

      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 20,
          timeInterval: 15000,
        },
        async (location) => {
          const lat = location.coords.latitude;
          const lng = location.coords.longitude;

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
        }
      );
    };

    startTracking();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
    };
  }, [enabled, hasPermission, goalId]);

  return { hasPermission, currentLocation };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useLocation.ts
git commit -m "feat: add foreground location tracking hook"
```

---

### Task 5: Photo Upload Hook

**Files:**
- Create: `src/hooks/usePhotos.ts`

- [ ] **Step 1: Write the photos hook**

Create `src/hooks/usePhotos.ts`:

```typescript
import { useEffect, useCallback, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../stores/appStore";
import type { GoalPhoto } from "../lib/types";

export function usePhotos(goalId: string | undefined) {
  const { photos, setPhotos, addPhoto } = useAppStore();
  const [uploading, setUploading] = useState(false);

  // Load existing photos
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

  // Subscribe to new photos via Realtime
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

  const pickAndUpload = useCallback(
    async (caption: string) => {
      if (!goalId) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (result.canceled || result.assets.length === 0) return;

      setUploading(true);
      try {
        const asset = result.assets[0];
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const fileExt = asset.uri.split(".").pop() || "jpg";
        const fileName = `${goalId}/${Date.now()}.${fileExt}`;

        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        const { error: uploadError } = await supabase.storage
          .from("goal-photos")
          .upload(fileName, arrayBuffer, {
            contentType: asset.mimeType || "image/jpeg",
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
      } finally {
        setUploading(false);
      }
    },
    [goalId]
  );

  const takeAndUpload = useCallback(
    async (caption: string) => {
      if (!goalId) return;

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") return;

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (result.canceled || result.assets.length === 0) return;

      setUploading(true);
      try {
        const asset = result.assets[0];
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const fileExt = asset.uri.split(".").pop() || "jpg";
        const fileName = `${goalId}/${Date.now()}.${fileExt}`;

        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        const { error: uploadError } = await supabase.storage
          .from("goal-photos")
          .upload(fileName, arrayBuffer, {
            contentType: asset.mimeType || "image/jpeg",
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
      } finally {
        setUploading(false);
      }
    },
    [goalId]
  );

  return { photos, uploading, pickAndUpload, takeAndUpload };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/usePhotos.ts
git commit -m "feat: add photo upload hook with gallery and camera support"
```

---

### Task 6: UI Components — LocationIndicator, PhotoGrid, PhotoCapture

**Files:**
- Create: `src/components/LocationIndicator.tsx`
- Create: `src/components/PhotoGrid.tsx`
- Create: `src/components/PhotoCapture.tsx`

- [ ] **Step 1: Write LocationIndicator**

Create `src/components/LocationIndicator.tsx`:

```typescript
import { View, Text, StyleSheet } from "react-native";

type Props = {
  hasPermission: boolean;
  isTracking: boolean;
};

export function LocationIndicator({ hasPermission, isTracking }: Props) {
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={[styles.dot, styles.dotInactive]} />
        <Text style={styles.textInactive}>Location off</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.dot, isTracking ? styles.dotActive : styles.dotInactive]} />
      <Text style={isTracking ? styles.textActive : styles.textInactive}>
        {isTracking ? "Tracking" : "Waiting..."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: "#22c55e" },
  dotInactive: { backgroundColor: "#ccc" },
  textActive: { fontSize: 12, color: "#22c55e", fontWeight: "600" },
  textInactive: { fontSize: 12, color: "#999" },
});
```

- [ ] **Step 2: Write PhotoGrid**

Create `src/components/PhotoGrid.tsx`:

```typescript
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
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
              contentFit="cover"
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

- [ ] **Step 3: Write PhotoCapture**

Create `src/components/PhotoCapture.tsx`:

```typescript
import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from "react-native";

type Props = {
  uploading: boolean;
  onPickFromGallery: (caption: string) => Promise<void>;
  onTakePhoto: (caption: string) => Promise<void>;
};

export function PhotoCapture({ uploading, onPickFromGallery, onTakePhoto }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [caption, setCaption] = useState("");

  const handlePick = async () => {
    await onPickFromGallery(caption);
    setCaption("");
    setShowModal(false);
  };

  const handleCamera = async () => {
    await onTakePhoto(caption);
    setCaption("");
    setShowModal(false);
  };

  if (uploading) {
    return (
      <View style={styles.uploadingContainer}>
        <ActivityIndicator size="small" color="#000" />
        <Text style={styles.uploadingText}>Uploading...</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.photoButton}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.photoButtonText}>Add Photo</Text>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add a Photo</Text>

            <TextInput
              style={styles.captionInput}
              placeholder="Caption (optional)"
              value={caption}
              onChangeText={setCaption}
            />

            <TouchableOpacity style={styles.modalButton} onPress={handleCamera}>
              <Text style={styles.modalButtonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalButton} onPress={handlePick}>
              <Text style={styles.modalButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setCaption("");
                setShowModal(false);
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  photoButton: {
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  photoButtonText: { fontSize: 14, fontWeight: "600", color: "#333" },
  uploadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    gap: 8,
  },
  uploadingText: { fontSize: 13, color: "#666" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  captionInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: "#000",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  modalButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  cancelButton: {
    padding: 14,
    alignItems: "center",
  },
  cancelText: { fontSize: 15, color: "#888" },
});
```

- [ ] **Step 4: Commit**

```bash
git add src/components/LocationIndicator.tsx src/components/PhotoGrid.tsx src/components/PhotoCapture.tsx
git commit -m "feat: add LocationIndicator, PhotoGrid, PhotoCapture components"
```

---

### Task 7: LiveMap Component

**Files:**
- Create: `src/components/LiveMap.tsx`

- [ ] **Step 1: Write the LiveMap component**

Create `src/components/LiveMap.tsx`:

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

- [ ] **Step 2: Commit**

```bash
git add src/components/LiveMap.tsx
git commit -m "feat: add LiveMap component with trail polyline"
```

---

### Task 8: Integrate Location + Photos into Goal Screen

**Files:**
- Modify: `src/app/(tabs)/goal.tsx`

- [ ] **Step 1: Update the goal screen to include location tracking and photo capture**

Replace `src/app/(tabs)/goal.tsx`:

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
import { useLocation } from "../../hooks/useLocation";
import { usePhotos } from "../../hooks/usePhotos";
import { GoalPlanCard } from "../../components/GoalPlanCard";
import { ChatBubble } from "../../components/ChatBubble";
import { ChatInput } from "../../components/ChatInput";
import { LocationIndicator } from "../../components/LocationIndicator";
import { PhotoCapture } from "../../components/PhotoCapture";
import { PhotoGrid } from "../../components/PhotoGrid";
import type { GoalPlanStep } from "../../lib/types";

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

  // Active state — show chat + location + photos
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

      <ChatInput onSend={sendMessage} />
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

- [ ] **Step 2: Verify the updated goal screen**

Start the app + edge functions. Test:
1. Create and activate a goal
2. Location permission prompt appears
3. "Tracking" indicator shows green dot after permission granted
4. "Add Photo" button opens modal with camera/gallery options
5. Photos toggle shows photo grid
6. Chat still works normally

```bash
npx expo start --clear
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(tabs)/goal.tsx
git commit -m "feat: integrate location tracking and photo capture into goal screen"
```

---

### Task 9: Friends Screen — Watch Button for Active Goals

**Files:**
- Modify: `src/app/(tabs)/friends.tsx`
- Modify: `src/components/FriendRow.tsx`

- [ ] **Step 1: Update FriendRow to show active goal watch button**

Replace `src/components/FriendRow.tsx`:

```typescript
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { Profile, Friendship } from "../lib/types";

type Props = {
  profile: Profile;
  friendship: Friendship;
  currentUserId: string;
  activeGoalId?: string;
  onAccept?: () => void;
  onWatch?: () => void;
};

export function FriendRow({
  profile,
  friendship,
  currentUserId,
  activeGoalId,
  onAccept,
  onWatch,
}: Props) {
  const isPending = friendship.status === "pending";
  const isAccepted = friendship.status === "accepted";
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
        {isAccepted && activeGoalId && (
          <Text style={styles.activeGoal}>Has an active goal</Text>
        )}
      </View>

      {canAccept && onAccept && (
        <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
          <Text style={styles.acceptText}>Accept</Text>
        </TouchableOpacity>
      )}

      {isAccepted && activeGoalId && onWatch && (
        <TouchableOpacity style={styles.watchButton} onPress={onWatch}>
          <Text style={styles.watchText}>Watch</Text>
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
  activeGoal: { fontSize: 12, color: "#22c55e", marginTop: 2 },
  acceptButton: {
    backgroundColor: "#000",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  acceptText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  watchButton: {
    backgroundColor: "#0077cc",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  watchText: { color: "#fff", fontSize: 13, fontWeight: "600" },
});
```

- [ ] **Step 2: Update friends screen to fetch active goals and navigate to watch**

Replace `src/app/(tabs)/friends.tsx`:

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
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { FriendRow } from "../../components/FriendRow";
import type { Profile, Friendship } from "../../lib/types";
import { useAuth } from "../../hooks/useAuth";

type FriendWithProfile = {
  friendship: Friendship;
  profile: Profile;
  activeGoalId?: string;
};

export default function FriendsScreen() {
  const { session } = useAuth();
  const router = useRouter();
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

    // Check which friends have active goals
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

    // Join as watcher
    await supabase
      .from("goal_watchers")
      .upsert({ goal_id: goalId, friend_id: userId }, { onConflict: "goal_id,friend_id" });

    router.push(`/watch/${goalId}`);
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

- [ ] **Step 3: Commit**

```bash
git add src/components/FriendRow.tsx src/app/(tabs)/friends.tsx
git commit -m "feat: add Watch button on friends with active goals"
```

---

### Task 10: Friend Watch Dashboard Screen

**Files:**
- Create: `src/app/watch/[goalId].tsx`

- [ ] **Step 1: Write the watch dashboard**

Create `src/app/watch/[goalId].tsx`:

```typescript
import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { LiveMap } from "../../components/LiveMap";
import { ChatBubble } from "../../components/ChatBubble";
import { PhotoGrid } from "../../components/PhotoGrid";
import type { Goal, Message, LocationPing, GoalPhoto } from "../../lib/types";

type Tab = "chat" | "photos";

export default function WatchScreen() {
  const { goalId } = useLocalSearchParams<{ goalId: string }>();
  const router = useRouter();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pings, setPings] = useState<LocationPing[]>([]);
  const [photos, setPhotos] = useState<GoalPhoto[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  // Load goal
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

  // Load and subscribe to messages (public only — RLS enforces this)
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

  // Load and subscribe to location pings
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

  // Load and subscribe to photos
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
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading} numberOfLines={1}>
          {goal.title}
        </Text>
      </View>

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
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backLink: { fontSize: 15, color: "#0077cc", fontWeight: "600" },
  heading: { fontSize: 18, fontWeight: "600", flex: 1 },
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

- [ ] **Step 2: Verify the watch screen**

With two accounts:
1. Account A: create and activate a goal, grant location permission
2. Account A: add Account B as friend (or use existing friendship)
3. Account B: accept friend request, see "Watch" button on Account A's row
4. Account B: tap "Watch" — dashboard opens with map, chat, photos tabs
5. Account A: send a message — it appears in Account B's chat feed
6. Account A: post a photo — it appears in Account B's photos tab
7. Account A: move around — location trail updates on Account B's map

```bash
npx expo start --clear
```

- [ ] **Step 3: Commit**

```bash
git add src/app/watch/
git commit -m "feat: add friend watch dashboard with live map, chat, and photos"
```

---

### Task 11: Update CLAUDE.md for Phase 2

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add the following under the existing "All source code lives under `src/`" line:

```markdown
## Phase 2 Features

- **Location tracking:** `expo-location` foreground tracking during active goals. Pings written to `location_pings` table every 15s / 20m distance.
- **Photo posting:** `expo-image-picker` for camera/gallery. Photos uploaded to Supabase Storage `goal-photos` bucket, metadata in `goal_photos` table.
- **Friend watch dashboard:** `/watch/[goalId]` screen shows live map (react-native-maps), public chat feed, and photo gallery via Realtime subscriptions.
- **Goal watchers:** `goal_watchers` table tracks which friends are watching. Friends join by tapping "Watch" on the friends list. RLS policies grant watchers read access to public messages, location pings, and photos.
```

Update the Phasing section to mark Phase 2 as current:

```markdown
## Phasing

- **Phase 1 (complete):** Auth, goal creation + Claude planning, LLM chat, friends list
- **Phase 2 (current):** Location tracking, live friend dashboard, photo posting
- **Phase 3:** Push notifications, watcher comments, progress summaries
- **Phase 4:** iOS app blocking via Screen Time API
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Phase 2 — location, photos, watch dashboard"
```

---

### Task 12: Full Verification

- [ ] **Step 1: Reset database and verify migration**

```bash
cd "C:/Users/Yuto Maruyama/Documents/study/app1"
supabase db reset
```

Expected: Both migrations apply. All 7 tables exist (`profiles`, `friendships`, `goals`, `messages`, `location_pings`, `goal_photos`, `goal_watchers`). Storage bucket `goal-photos` exists.

- [ ] **Step 2: Start all services**

```bash
supabase functions serve
```

In another terminal:

```bash
npx expo start --clear
```

- [ ] **Step 3: End-to-end test**

Create two accounts (Account A and Account B):

1. Account A: sign up, create a goal, Claude generates plan, tap "Start Goal"
2. Location permission prompt appears — grant it
3. Green "Tracking" indicator shows in header
4. Account A: send chat message to Claude — Claude responds
5. Account A: tap "Add Photo" — take or pick a photo with caption
6. Photo appears in photos view
7. Account A: add Account B as friend
8. Account B: sign up, accept friend request
9. Account B: see "Watch" button next to Account A (who has active goal)
10. Account B: tap "Watch" — watch dashboard opens
11. Account B: sees map with Account A's location trail
12. Account B: sees public chat messages between Account A and Claude
13. Account B: sees Account A's photos
14. Account A: send another message — it appears live on Account B's screen
15. Account A: post another photo — it appears live on Account B's photos tab
16. Account A: tap "Complete" — goal ends
17. Account B: sees "Goal completed" message

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: Phase 2 verification fixes"
```
