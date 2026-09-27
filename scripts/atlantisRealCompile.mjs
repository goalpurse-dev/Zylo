// 2026-09-22 "permanently separate PLAN/COMPILE from PAID GENERATION" pass
// — §11: the REAL live invocation of the newly-deployed compile-long-form-
// scenes function against the real Atlantis project + adopted Visual Plan
// v5, creating REAL persisted long_form_scene_render_plans/long_form_scenes
// rows for inspection. Zero image/video provider calls (compile-long-form-
// scenes never calls Runware/Kling/job-worker — see
// compileLongFormScenesNeverDispatches.test.mjs), zero credit charge (no
// generationRunId is ever passed — every newly-compiled scene lands in
// AWAITING_GENERATION_STATUS with generation_run_id=null, structurally
// unclaimable by claim_long_form_scene_for_render until an explicit,
// separate authorization step later flips it). Calls the ACTUAL deployed
// HTTP endpoint (not a local import) so this exercises the real artifact,
// batched in groups of <=40 beats (the function's own per-call cap),
// scopeBeatIdsOnly:true on every call so this script's own loop is the only
// thing driving batching (the function's internal self-chain is for an
// unattended/internal caller — this script wants full, synchronous
// visibility into every batch's result instead).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";

const PROJECT_ID = "e7a6fd5e-0d3d-416e-8e44-02d52491000b";
const EXPECTED_PLAN_V5 = "dae92f04-912f-4053-b348-ac11471c2b8d";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const { data: project } = await admin.from("long_form_projects").select("id,user_id,current_visual_plan_version_id,current_visual_world_version_id,scene_generation_tier").eq("id", PROJECT_ID).maybeSingle();
if (project.current_visual_plan_version_id !== EXPECTED_PLAN_V5) {
  console.error("REFUSING: project is not currently pointed at the expected adopted v5 plan.", project.current_visual_plan_version_id);
  process.exit(1);
}
const { data: planRow } = await admin.from("long_form_visual_plan_versions").select("visual_plan").eq("id", project.current_visual_plan_version_id).maybeSingle();
const beatIds = (planRow.visual_plan.visualBeats ?? []).map((b) => b.id);
console.error(`Compiling ${beatIds.length} beats for project ${PROJECT_ID} under plan v5 (${EXPECTED_PLAN_V5})...`);

const BATCH = 40;
const compiled = [];
const skipped = [];
for (let i = 0; i < beatIds.length; i += BATCH) {
  const batch = beatIds.slice(i, i + BATCH);
  console.error(`  batch ${i}-${i + batch.length - 1}...`);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/compile-long-form-scenes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ projectId: PROJECT_ID, beatIds: batch, ownerUserId: project.user_id, scopeBeatIdsOnly: true }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("  BATCH FAILED", res.status, JSON.stringify(json));
    process.exit(1);
  }
  compiled.push(...(json.compiled ?? []));
  skipped.push(...(json.skipped ?? []));
  console.error(`    compiled ${json.compiled?.length ?? 0}, skipped ${json.skipped?.length ?? 0}`);
}

const byStrategy = {};
for (const c of compiled) byStrategy[c.renderStrategy] = (byStrategy[c.renderStrategy] ?? 0) + 1;

console.log(JSON.stringify({
  ok: true, totalRequestedBeats: beatIds.length, totalCompiled: compiled.length, totalSkipped: skipped.length,
  byRenderStrategy: byStrategy, skipped,
}, null, 2));
