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
