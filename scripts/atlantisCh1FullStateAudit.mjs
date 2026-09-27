import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const WORLD_ID = "a3d3eea0-2041-4585-8ec2-72b3ce5859f6";
const V7 = "96e84cf2-799e-482b-a3d2-b924b44c9d53";

const { data: plans } = await admin.from("long_form_scene_render_plans").select("*").eq("visual_world_version_id", WORLD_ID).eq("visual_plan_version_id", V7).eq("chapter_id", "ch1").order("sequence_index");
const { data: scenes } = await admin.from("long_form_scenes").select("*").in("scene_render_plan_id", plans.map(p=>p.id)).is("replaces_scene_id", null);
const sceneByPlanId = new Map(scenes.map(s=>[s.scene_render_plan_id, s]));

const rows = plans.map(p => {
  const s = sceneByPlanId.get(p.id);
  return {
    beatId: p.visual_beat_id, seq: p.sequence_index, renderStrategy: p.render_strategy, sceneType: p.scene_type,
    displaySubject: p.composition?.displaySubject, focalEntityId: p.composition?.focalEntityId,
    referenceAssetIds: p.reference_asset_ids, styleId: p.style_preset_id, styleVersion: p.style_contract_version,
    sourcePlanId: p.source_scene_render_plan_id, overlaySpec: p.overlay_spec,
    imagePromptFull: p.image_prompt, negativePrompt: p.director_meta?.negativePrompt,
    sceneId: s?.id, sceneStatus: s?.status, qaStatus: s?.qa_status, qaResult: s?.qa_result,
    resultUrl: s?.result_url, baseResultUrl: s?.base_result_url, finalResultUrl: s?.final_result_url,
    renderModel: s?.render_model, costUsd: s?.cost_usd, lastErrorCode: s?.last_error_code,
    generationRunId: s?.generation_run_id, overlayApplied: s?.overlay_applied,
  };
});
console.log(JSON.stringify(rows, null, 2));
