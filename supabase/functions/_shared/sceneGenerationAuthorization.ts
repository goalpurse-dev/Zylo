// deno-lint-ignore-file no-explicit-any
// sceneGenerationAuthorization.ts — 2026-09-22 "permanently separate
// PLAN/COMPILE from PAID GENERATION" pass, §9/§10: the explicit,
// project/version/charge-scoped authorization step that moves EXACTLY the
// scenes covered by one specific charge from 'awaiting_generation' (compiled,
// structurally unclaimable) to 'pending' (claimable by claim_long_form_
// scene_for_render), stamping scene.generation_run_id with that charge's id
// at the same time.
//
// This is the ONLY place in the codebase allowed to make a freshly-compiled
// scene claimable. It requires an already-'charged', non-paused charge row
// to exist FIRST (see charge_long_form_episode_generation) — it never
// charges anything itself and never compiles anything itself (see
// compile-long-form-scenes). Deliberately keyed by each render plan's
// visual_beat_id (never a scene id captured earlier), since a fresh compile
// may still be resolving which scene row represents a beat when this runs.
//
// Idempotent by construction: a beat whose scene has already left
// 'awaiting_generation' (pending/running/succeeded/failed, under this run OR
// any other) is left completely untouched — calling this twice for the same
// charge never double-authorizes, never resets an in-flight/finished scene,
// and the update itself is conditioned on status still being
// 'awaiting_generation' at write time as a race guard.

export type AuthorizeResult = {
  authorized: string[];
  alreadyAuthorized: string[];
  skipped: { beatId: string; reason: string }[];
};

export async function authorizeCompiledScenesForDispatch(
  admin: any,
  params: { visualWorldVersionId: string; beatIds: string[]; generationRunId: string },
): Promise<AuthorizeResult> {
  const { visualWorldVersionId, beatIds, generationRunId } = params;
  const authorized: string[] = [];
  const alreadyAuthorized: string[] = [];
  const skipped: { beatId: string; reason: string }[] = [];
  if (!beatIds.length) return { authorized, alreadyAuthorized, skipped };

  // A charge that isn't 'charged' (or is paused) authorizes nothing — this
  // function only ever ACTS on a charge already known-good; it never decides
  // whether one is.
  const { data: run } = await admin.from("long_form_episode_generation_charges").select("status,is_paused").eq("id", generationRunId).maybeSingle();
  if (!run || run.status !== "charged" || run.is_paused) {
    for (const beatId of beatIds) skipped.push({ beatId, reason: "GENERATION_RUN_NOT_CHARGED" });
    return { authorized, alreadyAuthorized, skipped };
  }

  const { data: plans } = await admin.from("long_form_scene_render_plans").select("id, visual_beat_id")
    .eq("visual_world_version_id", visualWorldVersionId).in("visual_beat_id", beatIds);
  const planIdByBeatId = new Map<string, string>();
  for (const p of plans ?? []) planIdByBeatId.set(p.visual_beat_id, p.id);

  for (const beatId of beatIds) {
    const planId = planIdByBeatId.get(beatId);
    if (!planId) { skipped.push({ beatId, reason: "NOT_COMPILED_YET" }); continue; }
    const { data: scene } = await admin.from("long_form_scenes").select("id, status")
      .eq("scene_render_plan_id", planId).is("replaces_scene_id", null).maybeSingle();
    if (!scene) { skipped.push({ beatId, reason: "NOT_COMPILED_YET" }); continue; }
    if (scene.status !== "awaiting_generation") {
      // Already pending/running/succeeded/failed under this run or any other
      // — never reset, never re-authorized, just reported as already moved
      // past the point this function exists to move it past.
      alreadyAuthorized.push(beatId);
      continue;
    }
    const { error } = await admin.from("long_form_scenes")
      .update({ status: "pending", generation_run_id: generationRunId, updated_at: new Date().toISOString() })
      .eq("id", scene.id).eq("status", "awaiting_generation");
    if (error) { skipped.push({ beatId, reason: error.message ?? "AUTHORIZE_UPDATE_FAILED" }); continue; }
    authorized.push(beatId);
  }

  return { authorized, alreadyAuthorized, skipped };
}
