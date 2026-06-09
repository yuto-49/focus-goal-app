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
