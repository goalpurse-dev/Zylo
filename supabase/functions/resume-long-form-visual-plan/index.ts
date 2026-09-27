// deno-lint-ignore-file no-explicit-any
// resume-long-form-visual-plan/index.ts — "Resume Storyboard".
//
// 2026-09-21 emergency reliability fix (real Atlantis incident). A FAILED
// visual plan version previously had no way back to life except
// start-long-form-visual-plan's regenerate:true path, which always creates
// a brand new version and reruns every chapter's paid model call from
// scratch. This reopens the SAME row (resume_long_form_visual_plan_version)
// and re-dispatches the normal worker, which resumes at the exact stage it
// failed at using everything already persisted — zero chapters replanned
// that had already succeeded, zero new provider calls beyond whatever work
// genuinely never finished.
//
// POST { visualPlanVersionId }
// Returns { ok: true, visualPlan }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_VISUAL_PLAN_ADVANCE_SECRET") ?? "";

async function dispatch(id: string) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/advance-long-form-visual-plan`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualPlanVersionId: id }) });
  const result = await response.json().catch(() => ({}));
  console.info("[visual-plan] resume dispatch", { id, httpStatus: response.status, claimed: result.claimed });
  if (!response.ok) throw new Error(`Dispatch HTTP ${response.status}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const visualPlanVersionId = String(body?.visualPlanVersionId ?? "").trim();
  if (!visualPlanVersionId) return err(req, "Missing visualPlanVersionId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: visualPlan, error } = await admin.rpc("resume_long_form_visual_plan_version", { p_visual_plan_version_id: visualPlanVersionId, p_user_id: user.id });
  if (error) {
    const message = error.message ?? "";
    const status = message.includes("FORBIDDEN") ? 403 : message.includes("VISUAL_PLAN_NOT_FOUND") ? 404 : 500;
    return err(req, status === 404 ? "Storyboard not found" : "Could not resume this storyboard", status);
  }

  if (visualPlan.status === "planning") EdgeRuntime.waitUntil(dispatch(visualPlan.id).catch((e) => console.error("[visual-plan] resume dispatch failed; recovery will retry", e.message)));

  return ok(req, { ok: true, visualPlan });
});
