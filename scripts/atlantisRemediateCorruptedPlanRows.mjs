// 2026-09-22/23 remediation for the real Atlantis finding: MY OWN first
// (buggy) live compile call earlier this pass overwrote 15 pre-existing,
// pre-repair (v3-era) long_form_scene_render_plans rows' visual_plan_
// version_id field to the newly-adopted v5 id in place, via the very bug
// this pass's fix (compile-long-form-scenes) now closes for every FUTURE
// compile. Those 15 rows' PAIRED long_form_scenes rows were never touched
// by the compile (they already existed) — they remain the real, unaltered,
// terminal (succeeded/failed) scene attempts from that earlier v3-era run,
// now falsely labeled as belonging to v5. This script restores their
// visual_plan_version_id back to the id recorded on the ORIGINAL charge
// that actually paid for that real attempt (long_form_episode_generation_
// charges.visual_plan_version_id for the exact generation_run_id already
// stamped on each scene) — removing the false v5 attribution so no v5-
// scoped query (billing "already ready" checks, acceptance runs, etc.) can
// ever see them — WITHOUT touching result_url/status/qa_status/cost or any
// other real historical fact about what actually happened. Content fields
// (image_prompt/composition/etc, which my earlier buggy call DID overwrite
// to v5's text) are left as-is — restoring their exact original v3-era
// text was not attempted (would require temporarily re-pointing the
// project at v3, avoided per this pass's explicit "do not touch the
// Visual Plan" instruction) and does not affect billing/generation
// correctness, which depends only on visual_plan_version_id.
//
// Pass --apply to write; default is a dry run reporting exactly what would
// change.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");
const WORLD_ID = "a3d3eea0-2041-4585-8ec2-72b3ce5859f6";
const PLAN_V5 = "dae92f04-912f-4053-b348-ac11471c2b8d";

const { data: plans } = await admin.from("long_form_scene_render_plans")
  .select("id,visual_beat_id,plan_version,visual_plan_version_id")
  .eq("visual_world_version_id", WORLD_ID).eq("visual_plan_version_id", PLAN_V5);
const { data: scenes } = await admin.from("long_form_scenes")
  .select("id,scene_render_plan_id,status,generation_run_id")
  .in("scene_render_plan_id", plans.map((p) => p.id)).is("replaces_scene_id", null);
const sceneByPlanId = new Map(scenes.map((s) => [s.scene_render_plan_id, s]));

const corrupted = plans.filter((p) => {
  const s = sceneByPlanId.get(p.id);
  return s && s.status !== "awaiting_generation";
});

const runIds = [...new Set(corrupted.map((p) => sceneByPlanId.get(p.id).generation_run_id).filter(Boolean))];
const { data: charges } = await admin.from("long_form_episode_generation_charges").select("id,visual_plan_version_id").in("id", runIds);
const originalPlanVersionByRunId = new Map(charges.map((c) => [c.id, c.visual_plan_version_id]));

const actions = corrupted.map((p) => {
  const scene = sceneByPlanId.get(p.id);
  const originalPlanVersionId = originalPlanVersionByRunId.get(scene.generation_run_id) ?? null;
  return { planRowId: p.id, visualBeatId: p.visual_beat_id, planVersion: p.plan_version, sceneStatus: scene.status, generationRunId: scene.generation_run_id, restoreVisualPlanVersionIdTo: originalPlanVersionId };
});

console.log(JSON.stringify({ apply: APPLY, count: actions.length, actions }, null, 2));

if (APPLY) {
  for (const a of actions) {
    if (!a.restoreVisualPlanVersionIdTo) { console.error("SKIPPING (no resolvable original plan version):", a.planRowId); continue; }
    const { error } = await admin.from("long_form_scene_render_plans").update({ visual_plan_version_id: a.restoreVisualPlanVersionIdTo }).eq("id", a.planRowId);
    if (error) { console.error("UPDATE FAILED", a.planRowId, error); process.exit(1); }
  }
  console.error("Restoration applied.");
}
