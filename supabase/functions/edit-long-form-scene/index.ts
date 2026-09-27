// deno-lint-ignore-file no-explicit-any
// edit-long-form-scene/index.ts — "Edit Scene". Always Qwen Image Edit
// Plus, always the current scene image + a natural-language instruction,
// always additive (a new scene row referencing the previous one via
// replaces_scene_id — history is never overwritten). edit_long_form_scene
// charges the flat, server-authoritative Qwen price atomically before
// creating that new row; double-click safe structurally, same as retry
// (a second call finds the replacement row already exists and returns it
// unchanged, never re-billing).
//
// POST { sceneId, instruction }
// Returns { ok: true, sceneId: <the new scene id to now poll/display>, creditsCharged: <credits actually debited> }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SELF_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-scene-generation`;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_SCENE_ADVANCE_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const sceneId = String(body?.sceneId ?? "").trim();
  const instruction = String(body?.instruction ?? "").trim();
  if (!sceneId || !instruction) return err(req, "Missing sceneId or instruction", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: newSceneId, error } = await admin.rpc("edit_long_form_scene", { p_scene_id: sceneId, p_user_id: user.id, p_instruction: instruction });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("SCENE_NOT_FOUND") ? 404 : message.includes("NOTHING_TO_EDIT") ? 400
      : message.includes("GENERATION_PAUSED") ? 409 : message.includes("INVALID_INSTRUCTION") ? 400 : message.includes("INSUFFICIENT_CREDITS") ? 402 : 500;
    const fallback = message.includes("GENERATION_PAUSED") ? "Generation is paused — continue generation to edit this scene."
      : status === 402 ? "Not enough credits to edit this scene." : status === 400 ? "This scene can't be edited right now, or the instruction is invalid." : "Could not edit this scene";
    return err(req, fallback, status);
  }
  const { data: newScene } = await admin.from("long_form_scenes").select("credits_charged").eq("id", newSceneId).maybeSingle();
  fetch(SELF_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({}) }).catch(() => {});
  return ok(req, { ok: true, sceneId: newSceneId, creditsCharged: newScene?.credits_charged ?? 0 });
});
