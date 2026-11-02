// supabase/functions/generate-script/index.ts
// The Script Builder (/workspace/viral-script): writes a short-video script with OpenAI gpt-4o-mini.
// Input:  { form, stylePreset }  (the same shapes as src/lib/scriptPrompt.js)
// Output: the script JSON that ScriptResult shows
//
// Replaces the old Vercel route api/generate-script.js, which anyone could call without logging in
// (2026-10-27). Here: the user must be logged in, the 2 credits are taken on the server before the
// call and given back if it fails, and the OpenAI key (OPENAI_API_KEY secret) never leaves the server.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { buildOpenAIRequest } from "../../../src/lib/scriptPrompt.js";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
// Kept equal to SCRIPT_CREDIT_COST in src/lib/generateScript.js (the price shown on the button).
const SCRIPT_CREDIT_COST = 2;
const MAX_INPUT_CHARS = 20_000;

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (authError || !user) return err(req, "Unauthorized", 401);

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await req.json(); } catch { return err(req, "Invalid JSON", 400); }
  const { form, stylePreset } = body ?? {};
  if (!form || typeof form !== "object" || !stylePreset || typeof stylePreset !== "object") return err(req, "Missing form or stylePreset", 400);
  if (JSON.stringify({ form, stylePreset }).length > MAX_INPUT_CHARS) return err(req, "Request too large", 413);
  if (!OPENAI_KEY) return err(req, "Script writing is not available right now", 503);

  // Take the credits first (atomic: fails when the balance is too low), give them back on any failure.
  const { error: payErr } = await admin.rpc("deduct_credits", { uid: user.id, amount: SCRIPT_CREDIT_COST });
  if (payErr) {
    if (String(payErr.message).includes("INSUFFICIENT_CREDITS")) return err(req, "INSUFFICIENT_CREDITS", 402);
    console.error("[generate-script] deduct failed:", payErr.message);
    return err(req, "Could not check credits. Try again.", 500);
  }
  const refund = async (why: string) => {
    const { error } = await admin.rpc("deduct_credits", { uid: user.id, amount: -SCRIPT_CREDIT_COST });
    if (error) console.error(`[generate-script] REFUND FAILED for ${user.id} (${why}):`, error.message);
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify(buildOpenAIRequest(form, stylePreset)),
    });
    if (!response.ok) {
      console.error("[generate-script] OpenAI", response.status, (await response.text()).slice(0, 300));
      await refund(`openai ${response.status}`);
      return err(req, "Script writing failed. Your credits were returned. Please try again.", 502);
    }
    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    const script = raw ? JSON.parse(raw) : null;
    if (!script || typeof script !== "object") throw new Error("empty content");
    if (script.meta && !script.meta.presetIcon && stylePreset?.icon) script.meta.presetIcon = stylePreset.icon;
    return ok(req, script);
  } catch (e) {
    console.error("[generate-script] error:", e instanceof Error ? e.message : e);
    await refund("error");
    return err(req, "Script writing failed. Your credits were returned. Please try again.", 502);
  }
});
