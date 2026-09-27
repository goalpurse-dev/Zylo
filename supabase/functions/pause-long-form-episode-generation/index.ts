// deno-lint-ignore-file no-explicit-any
// pause-long-form-episode-generation/index.ts — "Pause Generation".
//
// 2026-09-21 emergency pause feature. Sets is_paused=true on the project's
// currently active (status='charged') long_form_episode_generation_charges
// row — the SAME durable flag claim_long_form_scene_for_render and
// enqueue_long_form_scene_job already refuse to dispatch/submit for
// (20260930440000). This is backend-authoritative: once this call returns,
// no worker, cron sweeper, retry, or self-chain can submit a new Runware
// job for this generation, across refresh/browser-close/server-restart —
// there is no frontend-only flag anywhere in this path.
//
// POST { projectId }
// Returns { ok: true, chargeId, isPaused: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: charge, error } = await admin.rpc("pause_long_form_episode_generation", { p_project_id: projectId, p_user_id: user.id });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("NO_ACTIVE_GENERATION") ? 404 : 500;
    return err(req, status === 404 ? "There is no active generation to pause." : "Could not pause generation", status);
  }
  return ok(req, { ok: true, chargeId: charge.id, isPaused: charge.is_paused });
});
