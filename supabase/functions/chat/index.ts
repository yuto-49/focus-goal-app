import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
});

// Service-role client for system inserts (LLM messages) that bypass RLS
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return Response.json({ error: "Missing authorization header" }, { status: 401 });
  }

  // User-scoped client for auth verification and user message insertion
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

  // Save Claude's response using service-role client (RLS only allows sender_type='user' inserts)
  const { data: llmMessage, error: llmError } = await supabaseAdmin
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
