// Client for the Script Engine. A script version is keyed to BOTH the
// EXACT Story Plan version and the EXACT Research version it was written
// from — either changing makes it stale, same dependency philosophy as
// Research's own staleness relative to its Story Plan version (see
// research.js). Script runs as a durable async worker (see
// advance-long-form-script) — starting it only creates/claims the row and
// returns immediately; the actual Draft/Critic/Revision pipeline progresses
// server-side across several short invocations, tracked entirely through
// this row's `status` and `stage` columns.
import { supabase } from "../../../lib/supabaseClient";

// The latest script version row for a SPECIFIC (story plan version, research
// version) pair, regardless of status. Same reasoning as
// fetchLatestResearchForStoryPlanVersion — this is how the Script page tells
// "already running for the current dependencies" apart from "nothing
// started yet" without relying on project.current_script_version_id, which
// only ever points at the last version that finished non-failed.
export async function fetchLatestScriptForVersions(projectId, storyPlanVersionId, researchVersionId) {
  if (!projectId || !storyPlanVersionId || !researchVersionId) return null;
  const { data, error } = await supabase
    .from("long_form_script_versions")
    .select("*")
    .eq("project_id", projectId)
    .eq("story_plan_version_id", storyPlanVersionId)
    .eq("research_version_id", researchVersionId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// The most recently COMPLETED (ready or needs_research) script for this
// project, whatever dependencies it was originally built against. Used only
// to detect and display a stale script — never treated as current.
export async function fetchLastCompletedScript(project) {
  if (!project?.current_script_version_id) return null;
  const { data, error } = await supabase.from("long_form_script_versions").select("*").eq("id", project.current_script_version_id).maybeSingle();
  if (error || !data) return null;
  return data;
}

// Creates/claims the Script Version and kicks off the async worker — returns
// almost immediately, not once the script is complete. The caller must poll
// fetchLatestScriptForVersions afterward to watch progress.
export async function startScript(projectId, { regenerate = false } = {}) {
  const { data, error } = await supabase.functions.invoke("start-long-form-script", {
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
    return { ok: false, status: context?.status ?? 500, code: payload?.code ?? null, message: payload?.error ?? "We couldn't write the script right now." };
  }
  return { ok: true, project: data.project, script: data.script };
}
