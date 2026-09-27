// deno-lint-ignore-file no-explicit-any
// continue-long-form-episode-generation/index.ts — "Continue Generation".
//
// 2026-09-21 emergency pause feature. Clears is_paused on the project's
// currently active episode generation charge and immediately kicks the
// scene-generation worker so remaining eligible work resumes right away
// (rather than waiting up to a minute for the recovery cron). Resumes the
// SAME generation run/charge — never creates a new charge, never touches
// already-completed or already-submitted scenes, and only ever re-enables
// claiming of scenes still 'pending' (or an expired 'running' lease) for
// this exact visual_world_version_id.
//
// POST { projectId }
// Returns { ok: true, chargeId, isPaused: false }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_SCENE_ADVANCE_SECRET") ?? "";
const ADVANCE_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-scene-generation`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: charge, error } = await admin.rpc("continue_long_form_episode_generation", { p_project_id: projectId, p_user_id: user.id });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("NO_ACTIVE_GENERATION") ? 404 : 500;
    return err(req, status === 404 ? "There is no active generation to continue." : "Could not continue generation", status);
  }

  fetch(ADVANCE_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualWorldVersionId: charge.visual_world_version_id }) }).catch(() => {});

  return ok(req, { ok: true, chargeId: charge.id, isPaused: charge.is_paused });
});
