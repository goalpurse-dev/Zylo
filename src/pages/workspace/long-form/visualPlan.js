// Client for the VisualBeat Director + Rough Storyboard. A visual plan
// version is keyed to the EXACT ScriptVersion it was planned from — if the
// script changes, the old plan becomes stale (never deleted), same
// dependency philosophy as Research->Script->VisualPlan. Runs as a durable
// async worker (see advance-long-form-visual-plan) — starting it only
// creates/claims the row and returns immediately.
import { supabase } from "../../../lib/supabaseClient";

export async function fetchLatestVisualPlanForScript(projectId, scriptVersionId) {
  if (!projectId || !scriptVersionId) return null;
  const { data, error } = await supabase
    .from("long_form_visual_plan_versions")
    .select("*")
    .eq("project_id", projectId)
    .eq("script_version_id", scriptVersionId)
    .is("meta->>supersededBy", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data;
}

// The most recently COMPLETED (ready) visual plan for this project,
// whatever script it was originally built against. Used only to detect and
// display a stale plan — never treated as current.
export async function fetchLastCompletedVisualPlan(project) {
  if (!project?.current_visual_plan_version_id) return null;
  const { data, error } = await supabase.from("long_form_visual_plan_versions").select("*").eq("id", project.current_visual_plan_version_id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data;
}

const pendingStarts = new Map();
export function startVisualPlan(projectId, { regenerate = false } = {}) {
  const key = `${projectId}:${regenerate}`;
  if (!pendingStarts.has(key)) pendingStarts.set(key, invokeStart(projectId, regenerate).finally(() => pendingStarts.delete(key)));
  return pendingStarts.get(key);
}
async function invokeStart(projectId, regenerate) {
  const { data, error } = await supabase.functions.invoke("start-long-form-visual-plan", { body: { projectId, regenerate } });
  if (error) {
    const context = error.context;
    let payload = null;
    try {
      payload = context && typeof context.json === "function" ? await context.json() : null;
    } catch {
      payload = null;
    }
    return { ok: false, status: context?.status ?? 500, code: payload?.code ?? null, message: payload?.error ?? "We couldn't build the storyboard right now." };
  }
  return { ok: true, project: data.project, visualPlan: data.visualPlan };
}

// 2026-09-21 emergency reliability fix: resumes the SAME failed visual plan
// version at the stage it failed at — never creates a new version, never
// reruns an already-succeeded chapter. Distinct from startVisualPlan's
// regenerate:true, which is a deliberate creative replan (see look.jsx's
// separate "Regenerate Storyboard" action on an already-READY plan).
export async function resumeVisualPlan(visualPlanVersionId) {
  const { data, error } = await supabase.functions.invoke("resume-long-form-visual-plan", { body: { visualPlanVersionId } });
  if (error) {
    const context = error.context;
    let payload = null;
    try {
      payload = context && typeof context.json === "function" ? await context.json() : null;
    } catch {
      payload = null;
    }
    return { ok: false, status: context?.status ?? 500, code: payload?.code ?? null, message: payload?.error ?? "We couldn't resume the storyboard right now." };
  }
  return { ok: true, visualPlan: data.visualPlan };
}

export async function saveStoryboardEdits(sourceId, patches) {
  const { data, error } = await supabase.rpc("save_storyboard_edits", { p_source_id: sourceId, p_patches: patches });
  if (error) throw new Error(error.message);
  return data;
}

// 2026-09-19 "Replan Episode Visuals" pass (items 2/3/8): the ONLY action
// that promotes an explicit replan (a VisualPlanVersion with a real
// parent_visual_plan_version_id) to the project's active
// current_visual_plan_version_id — a real user click ("Use This Plan") after
// reviewing the new storyboard, never automatic. See adopt_visual_plan_
// version's own comment for why the project's very first plan for a script
// never needs this (still auto-promoted the instant it's ready).
export async function adoptVisualPlanVersion(visualPlanVersionId) {
  const { data, error } = await supabase.rpc("adopt_visual_plan_version", { p_visual_plan_version_id: visualPlanVersionId });
  if (error) throw new Error(error.message);
  return data;
}
