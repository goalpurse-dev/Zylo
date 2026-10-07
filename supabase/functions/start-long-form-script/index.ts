// deno-lint-ignore-file no-explicit-any
// start-long-form-script/index.ts
//
// Client-facing entry point for the Script Engine — mirrors
// start-long-form-research's contract exactly: creates/claims the Script
// Version row, kicks off the async worker (advance-long-form-script), and
// returns almost immediately. The actual Draft → Critic → optional Revision
// pipeline progresses server-side across several short invocations, tracked
// through this row's status/stage columns. The client polls for completion
// (see script.js's fetchLatestScriptForVersions) rather than waiting here.
//
// A Script Version is keyed to BOTH the exact Story Plan version AND the
// exact Research version it was written from — either changing makes an
// existing script stale, same dependency philosophy as Research's own
// staleness relative to its Story Plan version.
//
// POST { projectId, regenerate?: boolean }
// Returns { project, script: { id, status, stage, ... } }.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUserOrAutopilot } from "../shared/auth.ts";
import { STICKMAN_BACKUP_MODEL } from "../_shared/stickman/scriptModels.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_SCRIPT_ADVANCE_SECRET") ?? "";
const ADVANCE_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-script`;
const MAX_VERSIONS_PER_PROJECT = 6;

// Same kill-switch defense-in-depth as start-long-form-research: the Script
// Version can still be created/returned while paused (the user isn't
// blocked from "starting" it), it just sits at status:drafting with nothing
// acting on it until unpaused.
const SCRIPT_PAUSED = (Deno.env.get("LONG_FORM_SCRIPT_PAUSED") ?? "").trim().toLowerCase() === "true";

function backgroundDispatch(promise: Promise<unknown>) {
  if (SCRIPT_PAUSED) return;
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = promise.catch((e: unknown) => console.error("[start-long-form-script] dispatch failed", e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}

async function dispatchFirstStage(scriptVersionId: string) {
  await fetch(ADVANCE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET },
    body: JSON.stringify({ scriptVersionId }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError, internal } = await requireUserOrAutopilot(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const regenerate = body?.regenerate === true;
  // Only our own autopilot may ask for the backup model (its last try after the default model failed).
  const useBackupModel = internal === true && body?.backupModel === true;
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return err(req, "Project not found", 404);
  if (project.user_id !== user.id) return err(req, "Forbidden", 403);
  if (!project.current_story_plan_version_id) return err(req, "This project needs a Story Plan before Script can begin", 400);
  if (!project.current_research_version_id) return err(req, "This project needs completed Research before Script can begin", 400);

  const { data: researchRow } = await admin.from("long_form_research_versions").select("id, status, meta, detail").eq("id", project.current_research_version_id).maybeSingle();
  if (!researchRow || (researchRow.status !== "ready" && researchRow.status !== "needs_attention")) {
    return err(req, "Research for this project isn't finished yet", 400);
  }
  // Phase 1d — research-lite is a best-effort HELPER for Stickman now, never
  // a gate: Script writes at full length from its own knowledge and verifies
  // specific claims itself afterward (see advance-long-form-script's
  // runStickmanClaimVerify), so a thin or empty research pass is no longer a
  // reason to refuse Script outright (the old STICKMAN_MIN_FACTS/
  // "insufficient_facts_below_minimum" block this replaced required Script's
  // OLD evidence-first draft, which could only write from cited facts).

  const storyPlanVersionId = project.current_story_plan_version_id;
  const researchVersionId = project.current_research_version_id;

  if (!regenerate) {
    const { data: existing } = await admin
      .from("long_form_script_versions")
      .select("id, status, stage")
      .eq("project_id", projectId)
      .eq("story_plan_version_id", storyPlanVersionId)
      .eq("research_version_id", researchVersionId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.status !== "failed") {
      return ok(req, { project, script: existing });
    }

    if (existing && existing.status === "failed") {
      const { data: resumed, error: resumeError } = await admin
        .from("long_form_script_versions")
        .update({ status: "drafting", stage_attempt: 0, worker_lock_until: null, last_error_code: null })
        .eq("id", existing.id)
        .select("id, status, stage")
        .single();
      if (resumeError || !resumed) return err(req, "Could not resume script generation", 500);
      backgroundDispatch(dispatchFirstStage(resumed.id));
      return ok(req, { project, script: resumed });
    }
  }

  if (regenerate) {
    const { count } = await admin
      .from("long_form_script_versions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("story_plan_version_id", storyPlanVersionId)
      .eq("research_version_id", researchVersionId);
    if ((count ?? 0) >= MAX_VERSIONS_PER_PROJECT) {
      return err(req, "You've reached the script regeneration limit for this Research version.", 429, { code: "TOO_MANY_VERSIONS" });
    }
  }

  const { count: versionCount } = await admin
    .from("long_form_script_versions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("story_plan_version_id", storyPlanVersionId)
    .eq("research_version_id", researchVersionId);
  const nextVersion = (versionCount ?? 0) + 1;

  const { data: inserted, error: insertError } = await admin
    .from("long_form_script_versions")
    .insert({ project_id: projectId, story_plan_version_id: storyPlanVersionId, research_version_id: researchVersionId, version: nextVersion, status: "drafting", stage: "draft", ...(useBackupModel ? { meta: { modelOverride: STICKMAN_BACKUP_MODEL } } : {}) })
    .select("id, status, stage")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: race } = await admin
        .from("long_form_script_versions")
        .select("id, status, stage")
        .eq("project_id", projectId)
        .eq("story_plan_version_id", storyPlanVersionId)
        .eq("research_version_id", researchVersionId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (race) return ok(req, { project, script: race });
    }
    return err(req, "Could not start script generation", 500);
  }

  backgroundDispatch(dispatchFirstStage(inserted.id));

  return ok(req, { project, script: inserted });
});
