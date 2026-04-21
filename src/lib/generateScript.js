import { buildOpenAIRequest } from "./scriptPrompt.js";
import { supabase } from "./supabaseClient";

export const SCRIPT_CREDIT_COST = 2;

async function deductCredits() {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) throw new Error("Not signed in");

  // Check balance first (mirrors image gen flow)
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("credit_balance")
    .eq("id", uid)
    .single();

  if (profErr) throw new Error("Could not check credits. Try again.");

  const balance = Number(profile?.credit_balance ?? 0);
  if (balance < SCRIPT_CREDIT_COST) throw new Error("INSUFFICIENT_CREDITS");

  // Atomically deduct
  const { error } = await supabase.rpc("deduct_credits", { uid, amount: SCRIPT_CREDIT_COST });
  if (error) {
    if (error.message?.includes("INSUFFICIENT_CREDITS")) throw new Error("INSUFFICIENT_CREDITS");
    throw error;
  }
}

export async function generateScript(form, stylePreset) {
  await deductCredits();

  // In dev, Vercel serverless routes don't run — call OpenAI directly.
  // In production (Vercel), go through the server route so the key stays server-side.
  if (import.meta.env.DEV) {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) throw new Error("VITE_OPENAI_API_KEY not set in .env.local");

    const body = buildOpenAIRequest(form, stylePreset);
    // Use Vite proxy (/api/openai → https://api.openai.com) to avoid CORS
    const response = await fetch("/api/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI ${response.status}: ${err.slice(0, 200)}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error("OpenAI returned empty content");

    const script = JSON.parse(raw);
    if (!script.meta?.presetIcon && stylePreset?.icon) script.meta.presetIcon = stylePreset.icon;
    return script;
  }

  // Production: use the Vercel serverless route
  const response = await fetch("/api/generate-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ form, stylePreset }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `Request failed: ${response.status}`);
  }

  return response.json();
}
