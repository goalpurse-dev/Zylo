// 2026-09-23 "final targeted Atlantis Visual Plan repair" — §"Then run
// Chapter 1 through the actual compile pipeline in COMPILE-ONLY mode." Real
// live invocation of the deployed compile-long-form-scenes function,
// scoped to Chapter 1's 15 beats, against the newly-adopted, repaired
// Visual Plan v7. Zero image/video provider calls, zero credit charge (no
// generationRunId passed — every compiled scene lands in
// AWAITING_GENERATION_STATUS, structurally unclaimable until an explicit
// separate authorization step). The already-fixed plan-version-bump logic
// in compile-long-form-scenes guarantees this creates GENUINELY FRESH rows
// for v7 — it will never resurrect/mutate the real historical scene rows
// from the actual paid generation that happened under v5.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";

const PROJECT_ID = "e7a6fd5e-0d3d-416e-8e44-02d52491000b";
const EXPECTED_PLAN_V7 = "96e84cf2-799e-482b-a3d2-b924b44c9d53";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const { data: project } = await admin.from("long_form_projects").select("id,user_id,current_visual_plan_version_id,current_visual_world_version_id,scene_generation_tier").eq("id", PROJECT_ID).maybeSingle();
if (project.current_visual_plan_version_id !== EXPECTED_PLAN_V7) {
  console.error("REFUSING: project is not currently pointed at the expected adopted v7 plan.", project.current_visual_plan_version_id);
  process.exit(1);
}
const { data: planRow } = await admin.from("long_form_visual_plan_versions").select("visual_plan").eq("id", project.current_visual_plan_version_id).maybeSingle();
const ch1BeatIds = (planRow.visual_plan.visualBeats ?? []).filter((b) => b.chapterId === "ch1").sort((a, b) => a.sequenceIndex - b.sequenceIndex).map((b) => b.id);
console.error(`Compiling ${ch1BeatIds.length} Chapter 1 beats for project ${PROJECT_ID} under plan v7 (${EXPECTED_PLAN_V7})...`);

const res = await fetch(`${SUPABASE_URL}/functions/v1/compile-long-form-scenes`, {
  method: "POST",
  headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ projectId: PROJECT_ID, beatIds: ch1BeatIds, ownerUserId: project.user_id, scopeBeatIdsOnly: true }),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("BATCH FAILED", res.status, JSON.stringify(json));
  process.exit(1);
}

const byStrategy = {};
for (const c of json.compiled ?? []) byStrategy[c.renderStrategy] = (byStrategy[c.renderStrategy] ?? 0) + 1;
console.log(JSON.stringify({
  ok: true, totalRequestedBeats: ch1BeatIds.length, totalCompiled: (json.compiled ?? []).length, totalSkipped: (json.skipped ?? []).length,
  byRenderStrategy: byStrategy, skipped: json.skipped,
}, null, 2));
