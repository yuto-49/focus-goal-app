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
