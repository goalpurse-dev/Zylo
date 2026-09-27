import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const WORLD_ID = "a3d3eea0-2041-4585-8ec2-72b3ce5859f6";
const PLAN_V5 = "dae92f04-912f-4053-b348-ac11471c2b8d";

const { data: plans } = await admin.from("long_form_scene_render_plans")
  .select("id,visual_beat_id,plan_version,visual_plan_version_id,sequence_index,render_strategy,composition,created_at,updated_at")
  .eq("visual_world_version_id", WORLD_ID).eq("visual_plan_version_id", PLAN_V5);
const { data: scenes } = await admin.from("long_form_scenes")
  .select("id,scene_render_plan_id,status,qa_status,generation_run_id,result_url,created_at,updated_at,last_error_code")
  .in("scene_render_plan_id", plans.map((p) => p.id)).is("replaces_scene_id", null);
const sceneByPlanId = new Map(scenes.map((s) => [s.scene_render_plan_id, s]));

const nonFresh = plans.filter((p) => {
  const s = sceneByPlanId.get(p.id);
  return s && s.status !== "awaiting_generation";
}).map((p) => {
  const s = sceneByPlanId.get(p.id);
  return {
    visualBeatId: p.visual_beat_id, sequenceIndex: p.sequence_index, renderStrategy: p.render_strategy,
    displaySubject: p.composition?.displaySubject, planRowCreatedAt: p.created_at, planRowUpdatedAt: p.updated_at,
    sceneStatus: s.status, sceneQaStatus: s.qa_status, generationRunId: s.generation_run_id,
    sceneCreatedAt: s.created_at, sceneUpdatedAt: s.updated_at, lastErrorCode: s.last_error_code, hasResultUrl: Boolean(s.result_url),
  };
}).sort((a, b) => a.sequenceIndex - b.sequenceIndex);

console.log(JSON.stringify({ count: nonFresh.length, nonFresh }, null, 2));
