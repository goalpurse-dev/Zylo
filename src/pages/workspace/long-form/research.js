// Client for the Research + Factuality Engine. A research version is keyed
// to the EXACT Story Plan version it was built from. Research runs as a
// durable async worker (see advance-long-form-research) — starting it only
// creates/claims the row and returns immediately; the actual Planner/
// Search/Extractor/Critic pipeline progresses server-side across many short
// invocations, tracked entirely through this row's `status` and `stage`
// columns. Everything here reads/writes long_form_research_versions +
// long_form_research_sources.
import { supabase } from "../../../lib/supabaseClient";
import { safeResult } from "./connectionState";

// Same query as fetchLatestResearchForStoryPlanVersion below, but returns a
// result that DISTINGUISHES "no row exists" from "we couldn't tell" (a
// network/auth/timeout error) — see connectionState.js. This is the fetch
// research.jsx's polling loop must use: the plain version below collapses
// both cases to a bare `null`, which is exactly what turned a client
// network hiccup (offline laptop, a Supabase auth refresh-token request
// failing while offline) into a false "Research failed" screen for a run
// that was still healthy server-side.
export async function fetchLatestResearchForStoryPlanVersionSafe(projectId, storyPlanVersionId) {
  if (!projectId || !storyPlanVersionId) return { ok: true, data: null };
  const { data, error } = await supabase
    .from("long_form_research_versions")
    .select("*")
    .eq("project_id", projectId)
    .eq("story_plan_version_id", storyPlanVersionId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return safeResult(data, error);
}

// The latest research version row for a SPECIFIC story plan version,
// regardless of status (researching/ready/needs_attention/failed). This is
// how the Research page tells "an update is already in progress for the
// CURRENT plan" apart from "no research yet for the current plan" without
// relying on project.current_research_version_id — that pointer only ever
// points at the last version that finished successfully, so on its own it
// can't distinguish "nothing started yet" from "already running."
export async function fetchLatestResearchForStoryPlanVersion(projectId, storyPlanVersionId) {
  if (!projectId || !storyPlanVersionId) return null;
  const { data, error } = await supabase
    .from("long_form_research_versions")
    .select("*")
    .eq("project_id", projectId)
    .eq("story_plan_version_id", storyPlanVersionId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// A targeted Research repair (see advance-long-form-research's repair
// pipeline) is a new long_form_research_versions row with
// parent_research_version_id pointing back at the version a Script's
// Critic determined couldn't support certain chapters. Used by the Script
// page to watch for that repair completing, entirely without the user
// needing to understand that a new Research Version was created at all.
export async function fetchRepairResearchVersion(parentResearchVersionId) {
  if (!parentResearchVersionId) return null;
  const { data, error } = await supabase
    .from("long_form_research_versions")
    .select("*")
    .eq("parent_research_version_id", parentResearchVersionId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// A specific research version row by id, regardless of status — used to
// recover the last real completed research (the PARENT) when the LATEST
// version for a story plan is a failed targeted-repair attempt, so a dead
// repair round never hides real, valid, previously-completed research
// behind a blank failure screen (see research.jsx's settleFromVersionRow).
export async function fetchResearchVersionById(researchVersionId) {
  if (!researchVersionId) return null;
  const { data, error } = await supabase.from("long_form_research_versions").select("*").eq("id", researchVersionId).maybeSingle();
  if (error || !data) return null;
  return data;
}

// Maps a source object from a research version's own intermediate.*SourcesFull
// (camelCase, exactly what the compiler works with in-memory) into the same
// snake_case shape long_form_research_sources rows already have, so callers
// never have to know which of the two this came from.
function intermediateSourceToRowShape(s) {
  return { id: s.id, url: s.url, title: s.title, publisher: null, source_type: s.sourceType, quality_tier: s.qualityTier, relevance: s.relevance, credibility_notes: s.credibilityNotes, chapters_supported: s.chaptersSupported ?? [] };
}

// 2026-09-20 real-incident fix: a completed research version (real facts,
// research_completed_at set) can still have ZERO rows in
// long_form_research_sources if that version's own persistence upsert failed
// silently (see advance-long-form-research's stageFinalizing — it only
// console.errors on failure, never throws or retries) — confirmed live on a
// real repair version (b8049220-..., 29 merged facts, 57 real sources sitting
// in intermediate.repairSourcesFull, 0 rows in the sources table). Without
// this, the UI showed "0 sources" for research that had genuinely found and
// kept real evidence — provenance was never actually lost, just unreadable
// from the one place the UI looked. Never fabricates anything: only reads
// back the exact source objects the compiler itself already extracted and
// persisted onto the version row.
export async function fetchResearchSources(researchVersionId) {
  if (!researchVersionId) return [];
  const { data } = await supabase.from("long_form_research_sources").select("*").eq("research_version_id", researchVersionId);
  if (data?.length) return data;
  const { data: versionRow } = await supabase.from("long_form_research_versions").select("intermediate").eq("id", researchVersionId).maybeSingle();
  const fallback = versionRow?.intermediate?.finalSourcesFull ?? versionRow?.intermediate?.repairSourcesFull ?? versionRow?.intermediate?.v1SourcesFull ?? [];
  return fallback.map(intermediateSourceToRowShape);
}

// The most recently COMPLETED research for this project, whatever Story
// Plan version it was originally built for. Used only to detect and display
// stale research (a "View Previous Research" read) — never treated as
// current, and never promoted to current just because it's the only thing
// on hand.
export async function fetchLastCompletedResearch(project) {
  if (!project?.current_research_version_id) return null;
  const { data, error } = await supabase.from("long_form_research_versions").select("*").eq("id", project.current_research_version_id).maybeSingle();
  if (error || !data) return null;
  return data;
}

// Creates/claims the Research Version and kicks off the async worker —
// returns almost immediately (just a DB insert + a fire-and-forget dispatch
// server-side), NOT once research is complete. The caller must poll
// fetchLatestResearchForStoryPlanVersion afterward to watch progress; this
// call only ever hands back a thin { id, status, stage } row.
//
// Idempotent when regenerate is false — safe to call unconditionally
// whenever the current Story Plan version has no research yet, whether
// that's the project's first-ever research or "Update Research" after the
// Story Plan changed (a new Story Plan version has no rows of its own yet,
// so this naturally creates version 1 for it rather than colliding with the
// old plan's research).
export async function startResearch(projectId, { regenerate = false } = {}) {
  const { data, error } = await supabase.functions.invoke("start-long-form-research", {
    body: { projectId, regenerate },
  });
  if (error) {
    const context = error.context;
    let payload = null;
    try {
      payload = context && typeof context.json === "function" ? await context.json() : null;
    } catch {
      payload = null;
    }
    return { ok: false, status: context?.status ?? 500, code: payload?.code ?? null, message: payload?.error ?? "We couldn't complete the research right now." };
  }
  return { ok: true, project: data.project, research: data.research };
}

// 2026-09-20 "clarify the completed research screen" fix — the REAL
// targeted repair pipeline (advance-long-form-research's repair_planning ->
// repair_search -> repair_extraction -> repair_coverage, which explicitly
// merges with the parent version's own existing sources/facts rather than
// discarding them), exposed as a direct user action for the first time —
// previously only ever triggered server-side by the Script Engine's Critic.
// Never a full restart: this only ever narrows to the specific chapters the
// current research's own coverage.chapterCoverage already flagged as not
// "strong".
export async function startResearchRepair(projectId) {
  const { data, error } = await supabase.functions.invoke("start-long-form-research-repair", { body: { projectId } });
  if (error) {
    const context = error.context;
    let payload = null;
    try {
      payload = context && typeof context.json === "function" ? await context.json() : null;
    } catch {
      payload = null;
    }
    return { ok: false, status: context?.status ?? 500, message: payload?.error ?? "We couldn't start the targeted repair right now." };
  }
  return { ok: true, project: data.project, research: data.research };
}
