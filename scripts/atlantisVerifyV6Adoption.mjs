import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PROJECT_ID = "e7a6fd5e-0d3d-416e-8e44-02d52491000b";
const V6 = "65412f9f-591b-425f-a380-782f887753ae";
const V5 = "dae92f04-912f-4053-b348-ac11471c2b8d";

const { data: project } = await admin.from("long_form_projects").select("current_visual_plan_version_id,current_visual_world_version_id").eq("id", PROJECT_ID).maybeSingle();
const { data: v6Row } = await admin.from("long_form_visual_plan_versions").select("id,version,status,parent_visual_plan_version_id,visual_plan").eq("id", V6).maybeSingle();
const { data: v5Row } = await admin.from("long_form_visual_plan_versions").select("id,version,status").eq("id", V5).maybeSingle();
const { data: compat } = await admin.rpc("long_form_visual_world_compatibility", { p_project_id: PROJECT_ID });

const changedBeats = v6Row.visual_plan.visualBeats.filter((b) => b.repairMethod === "semantic_binding_llm_repair");
const byRenderMethod = {};
for (const b of v6Row.visual_plan.visualBeats) byRenderMethod[b.renderMethod] = (byRenderMethod[b.renderMethod] ?? 0) + 1;
const ch1Beats = v6Row.visual_plan.visualBeats.filter((b) => b.chapterId === "ch1");
const ch1ByRenderMethod = {};
for (const b of ch1Beats) ch1ByRenderMethod[b.renderMethod] = (ch1ByRenderMethod[b.renderMethod] ?? 0) + 1;

console.log(JSON.stringify({
  projectNowPointsAtV6: project.current_visual_plan_version_id === V6,
  v6: { id: v6Row.id, version: v6Row.version, status: v6Row.status, parent: v6Row.parent_visual_plan_version_id, parentIsV5: v6Row.parent_visual_plan_version_id === V5 },
  v5StillExistsImmutable: { id: v5Row.id, version: v5Row.version, status: v5Row.status },
  worldCompatibility: compat,
  totalBeats: v6Row.visual_plan.visualBeats.length,
  changedBeatCount: changedBeats.length,
  preservedBeatCount: v6Row.visual_plan.visualBeats.length - changedBeats.length,
  byRenderMethodWholePlan: byRenderMethod,
  chapter1: { totalBeats: ch1Beats.length, byRenderMethod: ch1ByRenderMethod, changedInCh1: ch1Beats.filter(b => b.repairMethod === "semantic_binding_llm_repair").length },
}, null, 2));
