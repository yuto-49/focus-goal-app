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
