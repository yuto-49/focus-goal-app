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
