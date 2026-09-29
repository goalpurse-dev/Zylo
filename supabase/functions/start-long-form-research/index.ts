// deno-lint-ignore-file no-explicit-any
// start-long-form-research/index.ts
//
// The new client-facing contract for Research, replacing the old
// generate-long-form-research (which awaited the ENTIRE Planner → Search →
// Extractor → Critic → optional Gap → final Extractor pipeline inside one
// HTTP response — confirmed to hit Supabase's flat 150s "Request idle
// timeout" on a real production run). This function does almost no work
// itself: it creates/claims the Research Version row, kicks off the async
// worker (advance-long-form-research) for its first stage, and returns
// immediately. The client then watches the row via polling (see
// research.js's fetchLatestResearchForStoryPlanVersion) rather than waiting
// on this call.
//
// Idempotent on (project_id, story_plan_version_id) — unchanged from the
// synchronous version: a partial unique index on "researching" rows still
// prevents two concurrent RUNS for the same Story Plan version; the new
// per-stage worker_lock_until lease (see advance-long-form-research)
// separately prevents two WORKERS from executing the same stage within one
// run. Both are needed, for different races.
//
// POST { projectId, regenerate?: boolean }
// Returns { project, research: { id, version, status, stage, ... } } —
// notice there is no fact_graph/sources payload worth waiting for yet on a
// fresh start; the client polls for that once status reaches ready.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUserOrAutopilot } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_RESEARCH_ADVANCE_SECRET") ?? "";
const ADVANCE_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-research`;
const MAX_VERSIONS_PER_PROJECT = 6;

// Same kill switch as advance-long-form-research. advance() already refuses
// to do any work while paused, so this is defense in depth, not the primary
// gate — but it means a paused system doesn't even fire the dispatch
// network call: the Research Version can still be created/returned (the
// user isn't blocked from "starting" it), it just sits at status:researching
// with nothing acting on it until unpaused.
const RESEARCH_PAUSED = (Deno.env.get("LONG_FORM_RESEARCH_PAUSED") ?? "").trim().toLowerCase() === "true";

function backgroundDispatch(promise: Promise<unknown>) {
  if (RESEARCH_PAUSED) return;
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = promise.catch((e: unknown) => console.error("[start-long-form-research] dispatch failed", e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}

async function dispatchFirstStage(researchVersionId: string) {
  await fetch(ADVANCE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET },
    body: JSON.stringify({ researchVersionId }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUserOrAutopilot(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const regenerate = body?.regenerate === true;
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return err(req, "Project not found", 404);
  if (project.user_id !== user.id) return err(req, "Forbidden", 403);
  if (!project.current_story_plan_version_id) return err(req, "This project needs a Story Plan before Research can begin", 400);

  const storyPlanVersionId = project.current_story_plan_version_id;

  if (!regenerate) {
    const { data: existing } = await admin
      .from("long_form_research_versions")
      .select("id, status, stage")
      .eq("project_id", projectId)
      .eq("story_plan_version_id", storyPlanVersionId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.status !== "failed") {
      // researching or a completed terminal state — hand it back rather
      // than starting a second run; the client's own polling handles all of
      // researching/ready/needs_attention uniformly.
      return ok(req, { project, research: existing });
    }

    if (existing && existing.status === "failed") {
      // "Try Again" on a genuinely failed run: RESUME the same version from
      // the stage it died on rather than returning the same dead row
      // forever, and rather than starting a brand new version from scratch
      // — planning/search/etc. already persisted on this row stay exactly
      // as they are, so a resume never re-pays for a stage that already
      // succeeded (see stage_attempt=0 reset moving it back into
      // claim_long_form_research_stage's pool at its existing `stage`).
      const { data: resumed, error: resumeError } = await admin
        .from("long_form_research_versions")
        .update({ status: "researching", stage_attempt: 0, worker_lock_until: null, last_error_code: null })
        .eq("id", existing.id)
        .select("id, status, stage")
        .single();
      if (resumeError || !resumed) return err(req, "Could not resume research", 500);
      backgroundDispatch(dispatchFirstStage(resumed.id));
      return ok(req, { project, research: resumed });
    }
  }

  if (regenerate) {
    const { count } = await admin
      .from("long_form_research_versions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("story_plan_version_id", storyPlanVersionId);
    if ((count ?? 0) >= MAX_VERSIONS_PER_PROJECT) {
      return err(req, "You've reached the research regeneration limit for this Story Plan.", 429, { code: "TOO_MANY_VERSIONS" });
    }
  }

  const { count: versionCount } = await admin
    .from("long_form_research_versions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("story_plan_version_id", storyPlanVersionId);
  const nextVersion = (versionCount ?? 0) + 1;

  const { data: inserted, error: insertError } = await admin
    .from("long_form_research_versions")
    .insert({ project_id: projectId, story_plan_version_id: storyPlanVersionId, version: nextVersion, status: "researching", stage: "planning", research_started_at: new Date().toISOString() })
    .select("id, status, stage")
    .single();

  if (insertError) {
    // A concurrent start for the same (project, plan version) races past the
    // check above and hits the partial unique index — that's the
    // idempotency guarantee working, not a real failure.
    if (insertError.code === "23505") {
      const { data: race } = await admin
        .from("long_form_research_versions")
        .select("id, status, stage")
        .eq("project_id", projectId)
        .eq("story_plan_version_id", storyPlanVersionId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (race) return ok(req, { project, research: race });
    }
    return err(req, "Could not start research", 500);
  }

  backgroundDispatch(dispatchFirstStage(inserted.id));

  return ok(req, { project, research: inserted });
});
