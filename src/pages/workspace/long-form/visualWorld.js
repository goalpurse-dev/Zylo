// Client for Visual World / Canonical References. A Visual World version is
// keyed to the EXACT VisualPlanVersion (and its ScriptVersion) it was
// planned from — if the storyboard changes, the old Visual World becomes
// stale (never deleted), same dependency philosophy as every earlier stage.
// Runs as a durable async worker (see advance-long-form-visual-world) —
// starting it only creates/claims the row and returns immediately.
import { supabase } from "../../../lib/supabaseClient";

export async function fetchLatestVisualWorldForVisualPlan(projectId, visualPlanVersionId) {
  if (!projectId || !visualPlanVersionId) return null;
  const { data, error } = await supabase
    .from("long_form_visual_world_versions")
    .select("*")
    .eq("project_id", projectId)
    .eq("visual_plan_version_id", visualPlanVersionId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// The most recently COMPLETED (ready/needs_attention) Visual World for this
// project, whatever storyboard it was originally built against. Used only
// to detect and display a stale Visual World — never treated as current.
export async function fetchLastCompletedVisualWorld(project) {
  if (!project?.current_visual_world_version_id) return null;
  const { data, error } = await supabase.from("long_form_visual_world_versions").select("*").eq("id", project.current_visual_world_version_id).maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function fetchReferenceAssets(visualWorldVersionId) {
  if (!visualWorldVersionId) return [];
  const { data } = await supabase.from("long_form_reference_assets").select("*").eq("visual_world_version_id", visualWorldVersionId).order("created_at", { ascending: true });
  return data ?? [];
}

export async function startVisualWorld(projectId, { regenerate = false, rendererToolKey, styleKey, excludedViews } = {}) {
  const { data, error } = await supabase.functions.invoke("start-long-form-visual-world", { body: { projectId, regenerate, rendererToolKey, styleKey, excludedViews } });
  if (error) {
    const context = error.context;
    let payload = null;
    try {
      payload = context && typeof context.json === "function" ? await context.json() : null;
    } catch {
      payload = null;
    }
    return { ok: false, status: context?.status ?? 500, code: payload?.code ?? null, message: payload?.error ?? "We couldn't build your Visual World right now." };
  }
  return { ok: true, project: data.project, visualWorld: data.visualWorld };
}

// Regenerates ONE reference asset — never the whole Visual World (see
// regenerate-long-form-reference-asset). Fire-and-forget from the caller's
// perspective; the asset's own status/job_id transitions are watched via
// the normal fetchReferenceAssets poll, same as everything else here.
export async function regenerateReferenceAsset(assetId) {
  const { data, error } = await supabase.functions.invoke("regenerate-long-form-reference-asset", { body: { assetId } });
  if (error) return { ok: false };
  return { ok: data?.ok === true };
}
