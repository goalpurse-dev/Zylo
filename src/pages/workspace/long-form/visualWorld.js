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
  const { data, error } = await supabase.from("long_form_reference_assets").select("*").eq("visual_world_version_id", visualWorldVersionId).order("created_at", { ascending: true });
  if (error) throw error;
  const assets = data ?? [];
  const jobIds = assets.filter(a => a.job_id && ["pending", "running"].includes(a.status)).map(a => a.job_id);
  if (!jobIds.length) return assets;
  const { data: jobs, error: jobError } = await supabase.from("jobs").select("id,status,submission_state,provider_task_id").in("id", jobIds);
  if (jobError) throw jobError;
  const statuses = new Map((jobs ?? []).map(j => [j.id, j]));
  return assets.map(a => {
    const job = statuses.get(a.job_id);
    return { ...a, provider_status: job?.status ?? null, provider_submission_state: job?.submission_state ?? null, provider_task_id: job?.provider_task_id ?? null };
  });
}

// 2026-09-20 "Rebuild Visual World" fix — the explicit "Review & Adopt"
// action for a rebuild that finished ready but wasn't auto-promoted (see
// the matching migration's reconcile_visual_world_completion_status fix:
// a rebuild never auto-replaces an already-adopted, still-usable Visual
// World). Calls the RPC directly with the user's own session, same pattern
// as adopt_visual_plan_version has no dedicated wrapper elsewhere either.
export async function adoptVisualWorldVersion(visualWorldVersionId) {
  const { data, error } = await supabase.rpc("adopt_visual_world_version", { p_visual_world_version_id: visualWorldVersionId });
  if (error) return { ok: false, message: error.message ?? "We couldn't switch to the rebuilt Visual World right now." };
  return { ok: true, project: data };
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

// 2026-09-19 "Visual World incremental reconciliation" pass — "Update
// Visual World": distinct from startVisualWorld's regenerate:true (a FULL
// rebuild of every reference). Creates a new VisualWorldVersion that reuses
// every compatible canonical reference from the current world (zero cost)
// and only plans/generates the genuinely missing ones. Idempotent — a
// double-click/refresh/retry returns the SAME world version, never a
// duplicate or a second round of generation (see start_visual_world_
// reconciliation's own idempotency key).
export async function reconcileVisualWorld(projectId) {
  const { data, error } = await supabase.functions.invoke("reconcile-long-form-visual-world", { body: { projectId } });
  if (error) {
    const context = error.context;
    let payload = null;
    try {
      payload = context && typeof context.json === "function" ? await context.json() : null;
    } catch {
      payload = null;
    }
    return { ok: false, status: context?.status ?? 500, code: payload?.code ?? null, message: payload?.error ?? "We couldn't update your Visual World right now." };
  }
  if (data?.alreadyCompatible) return { ok: true, alreadyCompatible: true };
  return { ok: true, project: data.project, visualWorld: data.visualWorld };
}

// Regenerates ONE reference asset — never the whole Visual World (see
// regenerate-long-form-reference-asset). Fire-and-forget from the caller's
// perspective; the asset's own status/job_id transitions are watched via
// the normal fetchReferenceAssets poll, same as everything else here.
export async function regenerateReferenceAsset(assetId) {
  const { data, error } = await supabase.functions.invoke("regenerate-long-form-reference-asset", { body: { assetId } });
  if (error) return { ok: false, message: "Couldn't regenerate this reference. Please try again." };
  return { ok: data?.ok === true, assetId: data?.assetId };
}

// Edit is a controlled transformation of the CURRENT image via a natural-
// language instruction ("make his jacket darker") — distinct from
// regenerateReferenceAsset's fresh-from-spec attempt. Same history contract:
// the prior asset is preserved, a new one becomes current (see
// edit_long_form_reference_asset).
export async function editReferenceAsset(assetId, instruction) {
  const { data, error } = await supabase.functions.invoke("edit-long-form-reference-asset", { body: { assetId, instruction } });
  if (error) {
    const context = error.context;
    let payload = null;
    try {
      payload = context && typeof context.json === "function" ? await context.json() : null;
    } catch {
      payload = null;
    }
    return { ok: false, message: payload?.error ?? "Couldn't edit this reference. Please try again." };
  }
  return { ok: data?.ok === true, assetId: data?.assetId };
}

// Part 2's escalation path: Character Pack QA is a strong default, not a
// hard wall. Approving overrides qa_status to 'approved' — the SAME
// accepted_reference_identity gate every dependent Profile/Back/Face row
// already checks unblocks them automatically on the worker's next tick, no
// separate "release the dependents" call needed.
export async function approveReferenceIdentity(assetId) {
  const { data, error } = await supabase.functions.invoke("approve-long-form-reference-identity", { body: { assetId } });
  if (error) {
    const context = error.context;
    let payload = null;
    try {
      payload = context && typeof context.json === "function" ? await context.json() : null;
    } catch {
      payload = null;
    }
    return { ok: false, message: payload?.error ?? "Couldn't approve this reference. Please try again." };
  }
  return { ok: data?.ok === true, assetId: data?.assetId };
}

// Part 8 of the 2026-09-14 fix: "Approve Anyway" for a current Needs Review
// reference — a deliberate human override of an automated QA rejection.
// Never edits pixels, never calls a provider; just promotes the asset and
// records who/when, keeping the original automated QA result intact.
export async function approveReferenceAssetManually(assetId) {
  const { data, error } = await supabase.functions.invoke("approve-long-form-reference-asset", { body: { assetId } });
  if (error) {
    const context = error.context;
    let payload = null;
    try {
      payload = context && typeof context.json === "function" ? await context.json() : null;
    } catch {
      payload = null;
    }
    return { ok: false, message: payload?.error ?? "Couldn't approve this reference. Please try again." };
  }
  return { ok: data?.ok === true, assetId: data?.assetId };
}

// Promote an already-generated historical image to the head of its slot.
// The database creates a zero-cost alias row atomically; no Edge Function,
// jobs row, provider request, or pixel copy is involved.
export async function promoteReferenceAssetVersion(assetId) {
  const { data, error } = await supabase.rpc("promote_long_form_reference_asset_version", { p_asset_id: assetId });
  if (error) return { ok: false, message: error.message ?? "Couldn't use this saved version right now." };
  return { ok: true, assetId: data?.id ?? null };
}
