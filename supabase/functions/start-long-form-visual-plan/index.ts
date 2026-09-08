// deno-lint-ignore-file no-explicit-any
// start-long-form-visual-plan/index.ts
//
// Client-facing entry point for the VisualBeat Director — mirrors
// start-long-form-script's contract: creates/claims the Visual Plan Version
// row, kicks off the async worker, returns almost immediately. The client
// polls for completion.
//
// HARD INPUT CONTRACT: may only start from ScriptVersion.status === "ready"
// — never needs_research, needs_attention, failed, drafting, or a stale
// script. This is enforced here, server-side, not just by the frontend
// disabling a button.
//
// POST { projectId, regenerate?: boolean }
// Returns { project, visualPlan: { id, status, stage, ... } }.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_VISUAL_PLAN_ADVANCE_SECRET") ?? "";
const ADVANCE_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-visual-plan`;
const MAX_VERSIONS_PER_PROJECT = 6;

const VISUAL_PLAN_PAUSED = (Deno.env.get("LONG_FORM_VISUAL_PLAN_PAUSED") ?? "").trim().toLowerCase() === "true";

function backgroundDispatch(promise: Promise<unknown>) {
  if (VISUAL_PLAN_PAUSED) return;
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = promise.catch((e: unknown) => console.error("[start-long-form-visual-plan] dispatch failed", e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}
async function dispatchFirstStage(visualPlanVersionId: string) {
  await fetch(ADVANCE_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualPlanVersionId }) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const regenerate = body?.regenerate === true;
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return err(req, "Project not found", 404);
  if (project.user_id !== user.id) return err(req, "Forbidden", 403);
  if (!project.current_script_version_id) return err(req, "This project needs a finished script before Look can begin", 400);

  const { data: scriptRow } = await admin.from("long_form_script_versions").select("id, status").eq("id", project.current_script_version_id).maybeSingle();
  // HARD gate — see file header. Never needs_research/needs_attention/failed/drafting.
  if (!scriptRow || scriptRow.status !== "ready") {
    return err(req, "The script for this project isn't ready yet", 400, { code: "SCRIPT_NOT_READY" });
  }

  const scriptVersionId = scriptRow.id;

  if (!regenerate) {
    const { data: existing } = await admin
      .from("long_form_visual_plan_versions")
      .select("id, status, stage")
      .eq("project_id", projectId)
      .eq("script_version_id", scriptVersionId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.status !== "failed") {
      return ok(req, { project, visualPlan: existing });
    }
    if (existing && existing.status === "failed") {
      const { data: resumed, error: resumeError } = await admin
        .from("long_form_visual_plan_versions")
        .update({ status: "planning", stage: "planning", stage_attempt: 0, worker_lock_until: null, last_error_code: null })
        .eq("id", existing.id)
        .select("id, status, stage")
        .single();
      if (resumeError || !resumed) return err(req, "Could not resume visual planning", 500);
      backgroundDispatch(dispatchFirstStage(resumed.id));
      return ok(req, { project, visualPlan: resumed });
    }
  }

  if (regenerate) {
    const { count } = await admin.from("long_form_visual_plan_versions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("script_version_id", scriptVersionId);
    if ((count ?? 0) >= MAX_VERSIONS_PER_PROJECT) {
      return err(req, "You've reached the storyboard regeneration limit for this script.", 429, { code: "TOO_MANY_VERSIONS" });
    }
  }

  const { count: versionCount } = await admin.from("long_form_visual_plan_versions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("script_version_id", scriptVersionId);
  const nextVersion = (versionCount ?? 0) + 1;

  const { data: inserted, error: insertError } = await admin
    .from("long_form_visual_plan_versions")
    .insert({ project_id: projectId, script_version_id: scriptVersionId, version: nextVersion, status: "planning", stage: "planning" })
    .select("id, status, stage")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: race } = await admin
        .from("long_form_visual_plan_versions")
        .select("id, status, stage")
        .eq("project_id", projectId)
        .eq("script_version_id", scriptVersionId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (race) return ok(req, { project, visualPlan: race });
    }
    return err(req, "Could not start visual planning", 500);
  }

  backgroundDispatch(dispatchFirstStage(inserted.id));
  return ok(req, { project, visualPlan: inserted });
});
