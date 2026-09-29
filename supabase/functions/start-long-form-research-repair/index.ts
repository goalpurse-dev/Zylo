// deno-lint-ignore-file no-explicit-any
// start-long-form-research-repair/index.ts
//
// 2026-09-20 "clarify the completed research screen" fix — real user
// report: a finished research run showed a generic "Try Again" next to an
// enabled "Write Script," and "Try Again" (research.jsx's handleRegenerate)
// actually started a completely FRESH research run from scratch, discarding
// every source/fact already found, just to fix a handful of weak chapters.
//
// The codebase already has a real, proven TARGETED repair pipeline —
// advance-long-form-research's repair_planning -> repair_search ->
// repair_extraction -> repair_coverage stages, which explicitly MERGE with
// the parent version's existing sources/facts (see stageRepairExtraction's
// own parentRow/existingFacts/existingSources read) rather than starting
// over. Until now it was only ever triggered server-side by the Script
// Engine's Critic (advance-long-form-script's triggerTargetedRepair). This
// is the SAME mechanism, exposed as a real user-facing action so the
// Research page's own "affected chapters" action can call it directly,
// instead of relabeling a full restart.
//
// POST { projectId }
// Returns { project, research: { id, version, status, stage, ... } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { fetchActiveGenerationProfile, isStickmanProfile } from "../_shared/stickman/recipeProfile.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_RESEARCH_ADVANCE_SECRET") ?? "";
const ADVANCE_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-research`;
const RESEARCH_PAUSED = (Deno.env.get("LONG_FORM_RESEARCH_PAUSED") ?? "").trim().toLowerCase() === "true";

function backgroundDispatch(promise: Promise<unknown>) {
  if (RESEARCH_PAUSED) return;
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = promise.catch((e: unknown) => console.error("[start-long-form-research-repair] dispatch failed", e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}

// Same construction as advance-long-form-script's buildRepairChapters, but
// sourced from the research row's OWN coverage.chapterCoverage (its real,
// already-computed per-chapter note) rather than a ScriptEvidencePack that
// doesn't exist yet at this stage — the Research page's own "why" data for
// each affected chapter.
function buildRepairChapters(storyPlan: any, chapterCoverage: any[]) {
  return chapterCoverage
    .filter((c: any) => c.status !== "strong")
    .map((c: any) => {
      const planChapter = (storyPlan?.chapters ?? []).find((ch: any) => ch.id === c.chapterId);
      return {
        chapterId: c.chapterId,
        title: planChapter?.title ?? c.chapterId,
        purpose: planChapter?.purpose ?? "",
        keyQuestions: planChapter?.keyQuestions ?? [],
        missingEvidenceDescription: c.note || "This chapter's evidence is thinner than the rest of the video.",
      };
    });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Phase 6a: research-lite is a helper for Stickman — it never gates, and
  // the legacy "Research missing sections" repair never runs for Stickman
  // (the stuck "How did ancient humans hunt" run started exactly this).
  if (isStickmanProfile(await fetchActiveGenerationProfile(admin, projectId))) {
    return err(req, "Stickman projects don't use repair research", 409, { code: "STICKMAN_NO_REPAIR" });
  }

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return err(req, "Project not found", 404);
  if (project.user_id !== user.id) return err(req, "Forbidden", 403);
  if (!project.current_story_plan_version_id) return err(req, "This project has no Story Plan", 400);

  const storyPlanVersionId = project.current_story_plan_version_id;

  const { data: current } = await admin
    .from("long_form_research_versions")
    .select("id, status, coverage, repair_round")
    .eq("project_id", projectId)
    .eq("story_plan_version_id", storyPlanVersionId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!current) return err(req, "No research found for this project yet", 400);
  if (current.status !== "needs_attention") return err(req, "This research doesn't have any flagged gaps to repair", 400);

  // Idempotent: a repair already in flight for this exact research version
  // is handed back rather than starting a second one — same convention as
  // start-long-form-research's own non-regenerate branch.
  const { data: inFlight } = await admin
    .from("long_form_research_versions")
    .select("id, status, stage")
    .eq("parent_research_version_id", current.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (inFlight && inFlight.status === "researching") return ok(req, { project, research: inFlight });

  const { data: storyPlan } = await admin.from("long_form_story_plan_versions").select("story_plan").eq("id", storyPlanVersionId).maybeSingle();
  const chapterCoverage = current.coverage?.chapterCoverage ?? [];
  const repairChapters = buildRepairChapters(storyPlan?.story_plan, chapterCoverage);
  if (!repairChapters.length) return err(req, "No specific chapters are flagged for repair right now", 400);

  const { count } = await admin.from("long_form_research_versions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("story_plan_version_id", storyPlanVersionId);
  const nextVersion = (count ?? 0) + 1;

  const { data: inserted, error: insertError } = await admin
    .from("long_form_research_versions")
    .insert({
      project_id: projectId,
      story_plan_version_id: storyPlanVersionId,
      version: nextVersion,
      status: "researching",
      stage: "repair_planning",
      parent_research_version_id: current.id,
      repair_round: (current.repair_round ?? 0) + 1,
      repair_context: { chapters: repairChapters },
      research_started_at: new Date().toISOString(),
    })
    .select("id, status, stage")
    .single();
  if (insertError || !inserted) return err(req, "Could not start targeted repair", 500);

  backgroundDispatch(fetch(ADVANCE_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ researchVersionId: inserted.id }) }));

  return ok(req, { project, research: inserted });
});
