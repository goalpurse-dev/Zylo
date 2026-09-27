import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PROJECT_ID = "e7a6fd5e-0d3d-416e-8e44-02d52491000b";
const V7 = "96e84cf2-799e-482b-a3d2-b924b44c9d53";
const V6 = "65412f9f-591b-425f-a380-782f887753ae";
const V5 = "dae92f04-912f-4053-b348-ac11471c2b8d";

const { data: project } = await admin.from("long_form_projects").select("current_visual_plan_version_id").eq("id", PROJECT_ID).maybeSingle();
const { data: v7Row } = await admin.from("long_form_visual_plan_versions").select("id,version,status,parent_visual_plan_version_id,visual_plan").eq("id", V7).maybeSingle();
const { data: v6Row } = await admin.from("long_form_visual_plan_versions").select("id,version,status").eq("id", V6).maybeSingle();
const { data: v5Row } = await admin.from("long_form_visual_plan_versions").select("id,version,status").eq("id", V5).maybeSingle();
const { data: compat } = await admin.rpc("long_form_visual_world_compatibility", { p_project_id: PROJECT_ID });

const byRenderMethod = {};
for (const b of v7Row.visual_plan.visualBeats) byRenderMethod[b.renderMethod] = (byRenderMethod[b.renderMethod] ?? 0) + 1;
const ch1Beats = v7Row.visual_plan.visualBeats.filter((b) => b.chapterId === "ch1").sort((a, b) => a.sequenceIndex - b.sequenceIndex);
const ch1ByRenderMethod = {};
for (const b of ch1Beats) ch1ByRenderMethod[b.renderMethod] = (ch1ByRenderMethod[b.renderMethod] ?? 0) + 1;

console.log(JSON.stringify({
  projectNowPointsAtV7: project.current_visual_plan_version_id === V7,
  v7: { id: v7Row.id, version: v7Row.version, status: v7Row.status, parent: v7Row.parent_visual_plan_version_id, parentIsV6: v7Row.parent_visual_plan_version_id === V6 },
  v6StillExistsImmutable: v6Row,
  v5StillExistsImmutable: v5Row,
  worldCompatibility: compat,
  totalBeats: v7Row.visual_plan.visualBeats.length,
  byRenderMethodWholePlan: byRenderMethod,
  chapter1: {
    totalBeats: ch1Beats.length, byRenderMethod: ch1ByRenderMethod,
    beats: ch1Beats.map((b) => ({ id: b.id, seq: b.sequenceIndex, renderMethod: b.renderMethod, subject: b.subject, displaySubjectHint: b.displaySubjectHint, sourceBeatId: b.sourceBeatId })),
  },
}, null, 2));
