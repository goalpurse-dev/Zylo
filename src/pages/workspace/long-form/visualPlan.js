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
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// The most recently COMPLETED (ready) visual plan for this project,
// whatever script it was originally built against. Used only to detect and
// display a stale plan — never treated as current.
export async function fetchLastCompletedVisualPlan(project) {
  if (!project?.current_visual_plan_version_id) return null;
  const { data, error } = await supabase.from("long_form_visual_plan_versions").select("*").eq("id", project.current_visual_plan_version_id).maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function startVisualPlan(projectId, { regenerate = false } = {}) {
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
