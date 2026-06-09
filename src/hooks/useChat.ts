import { useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../stores/appStore";
import type { Message } from "../lib/types";

export function useChat(goalId: string | undefined) {
  const { messages, setMessages, addMessage } = useAppStore();

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
