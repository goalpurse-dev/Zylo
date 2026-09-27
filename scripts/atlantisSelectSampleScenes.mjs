// 2026-09-22/23 pass — §12: select (never generate) the recommended 3
// sample scenes from the REAL persisted v5 compile, using the exact same
// shared, generic selectRepresentativeSampleScenes/determineTextOverlay
// OwnerSceneIds modules generate-long-form-scene-sample calls — this script
// exercises the identical logic directly against the live DB (the deployed
// HTTP endpoint requires a real signed-in user JWT, which this offline
// script doesn't have; the selection logic itself is the same shared,
// already-unit-tested module either way). Read-only. Zero dispatch.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";

const { selectRepresentativeSampleScenes, determineTextOverlayOwnerSceneIds } = await import("../supabase/functions/_shared/sceneSampleSelection.ts");
const { estimatedCreditsForRenderStrategy } = await import("../supabase/functions/_shared/sceneGenerationPricing.ts");

const WORLD_ID = "a3d3eea0-2041-4585-8ec2-72b3ce5859f6";
const PLAN_V7 = "96e84cf2-799e-482b-a3d2-b924b44c9d53";
const TIER = "v3";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: plans } = await admin.from("long_form_scene_render_plans").select("*").eq("visual_world_version_id", WORLD_ID).eq("visual_plan_version_id", PLAN_V7).order("sequence_index");
const { data: scenes } = await admin.from("long_form_scenes").select("id,scene_render_plan_id,input_reference_asset_ids").in("scene_render_plan_id", plans.map((p) => p.id)).is("replaces_scene_id", null);
const sceneByPlanId = new Map(scenes.map((s) => [s.scene_render_plan_id, s]));

const overlayOwnerSceneIds = determineTextOverlayOwnerSceneIds(plans.map((p) => ({
  sceneId: sceneByPlanId.get(p.id)?.id, sequenceIndex: p.sequence_index, renderStrategy: p.render_strategy,
  narrationClaimId: p.narration_claim_id, narrationContractVersionId: p.narration_contract_version_id,
})));

const candidates = plans.map((p) => {
  const scene = sceneByPlanId.get(p.id);
  const requiredCharacterIds = p.composition?.focalEntityId ? [p.composition.focalEntityId] : [];
  return {
    sceneId: scene.id, beatId: p.visual_beat_id, sequenceIndex: p.sequence_index, renderStrategy: p.render_strategy,
    requiredCharacterIds, referenceAssetIds: p.reference_asset_ids ?? scene.input_reference_asset_ids ?? [],
    isTextOverlayOwner: overlayOwnerSceneIds.has(scene.id),
    estimatedCredits: estimatedCreditsForRenderStrategy(p.render_strategy, TIER),
    displaySubject: p.composition?.displaySubject ?? p.composition?.focalSubject ?? null,
  };
});

const selected = selectRepresentativeSampleScenes(candidates);
const planByBeatId = new Map(plans.map((p) => [p.visual_beat_id, p]));

const sampleScenes = selected.map((s) => {
  const plan = planByBeatId.get(s.beatId);
  return {
    sceneId: s.sceneId, beatId: s.beatId, category: s.category, reason: s.reason,
    sequenceIndex: plan.sequence_index, renderStrategy: plan.render_strategy, estimatedCredits: s.estimatedCredits,
    referenceAssetIds: plan.reference_asset_ids ?? [], hasOverlay: Boolean(plan.overlay_spec),
    displaySubject: plan.composition?.displaySubject ?? plan.composition?.focalSubject ?? null,
    basePromptSummary: typeof plan.image_prompt === "string" ? plan.image_prompt.slice(0, 240) : null,
  };
});

console.log(JSON.stringify({
  ok: true, charged: false, totalCompiledScenes: plans.length, tier: TIER,
  sampleScenes, estimatedSampleCredits: sampleScenes.reduce((sum, s) => sum + s.estimatedCredits, 0),
}, null, 2));
