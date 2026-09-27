import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const WORLD_ID = "a3d3eea0-2041-4585-8ec2-72b3ce5859f6";
const PLAN_V5 = "dae92f04-912f-4053-b348-ac11471c2b8d";
const { data: plans, count: planCount } = await admin.from("long_form_scene_render_plans").select("id,visual_beat_id,render_strategy", { count: "exact" }).eq("visual_world_version_id", WORLD_ID).eq("visual_plan_version_id", PLAN_V5);
const distinctBeatIds = new Set(plans.map((p) => p.visual_beat_id));
const { data: scenes, count: sceneCount } = await admin.from("long_form_scenes").select("id,status,generation_run_id,scene_render_plan_id", { count: "exact" }).in("scene_render_plan_id", plans.map((p) => p.id)).is("replaces_scene_id", null);
const statusCounts = {};
const genRunIds = new Set();
for (const s of scenes) { statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1; genRunIds.add(s.generation_run_id); }
const byStrategy = {};
for (const p of plans) byStrategy[p.render_strategy] = (byStrategy[p.render_strategy] ?? 0) + 1;
console.log(JSON.stringify({
  planRowCount: planCount, distinctBeatIdsWithPlanRows: distinctBeatIds.size,
  sceneRowCount: sceneCount, sceneStatusCounts: statusCounts, distinctGenerationRunIds: [...genRunIds],
  byRenderStrategy: byStrategy,
}, null, 2));
