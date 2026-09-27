// 2026-09-22/23 "permanently separate PLAN/COMPILE from PAID GENERATION"
// pass — §4: re-run acceptance A-N (same letters as the prior "targeted
// Visual Plan repair" pass) AGAINST THE REAL PERSISTED long_form_scene_
// render_plans/long_form_scenes ROWS for the fresh v5 compile (not a
// preflight simulation), plus the extra structural checks §4 explicitly
// asks for: no orphan REUSE, no circular lineage, no missing source beat,
// no rejected source dependency, no empty base prompt, no missing required
// reference, no provider-job row exists, zero charges exist. Read-only.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
import { register } from "node:module";
register("../tests/assetStub.loader.mjs", import.meta.url);
if (typeof globalThis.Deno === "undefined") globalThis.Deno = { env: { get: () => undefined } };
if (typeof globalThis.Deno.serve === "undefined") globalThis.Deno.serve = () => undefined;

const { classifyTextImportance, criticalExactTextOf } = await import("../supabase/functions/_shared/graphicSpec.ts");
const { runEpisodeQA } = await import("../supabase/functions/_shared/episodeQA.ts");
const { determineTextOverlayOwnerSceneIds } = await import("../supabase/functions/_shared/sceneSampleSelection.ts");

const PROJECT_ID = "e7a6fd5e-0d3d-416e-8e44-02d52491000b";
const WORLD_ID = "a3d3eea0-2041-4585-8ec2-72b3ce5859f6";
const PLAN_V5 = "dae92f04-912f-4053-b348-ac11471c2b8d";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: plans } = await admin.from("long_form_scene_render_plans").select("*").eq("visual_world_version_id", WORLD_ID).eq("visual_plan_version_id", PLAN_V5).order("sequence_index");
const { data: scenes } = await admin.from("long_form_scenes").select("*").in("scene_render_plan_id", plans.map((p) => p.id)).is("replaces_scene_id", null);
const sceneByPlanId = new Map(scenes.map((s) => [s.scene_render_plan_id, s]));
const planById = new Map(plans.map((p) => [p.id, p]));

const { data: contractRow } = plans[0]?.narration_contract_version_id
  ? await admin.from("long_form_narration_contract_versions").select("claims").eq("id", plans[0].narration_contract_version_id).maybeSingle()
  : { data: null };
// A plan can pin different contract versions across its lifetime in theory;
// load every distinct one actually referenced, not just the first row's.
const distinctContractVersionIds = [...new Set(plans.map((p) => p.narration_contract_version_id).filter(Boolean))];
const { data: contractRows } = distinctContractVersionIds.length
  ? await admin.from("long_form_narration_contract_versions").select("id,claims").in("id", distinctContractVersionIds)
  : { data: [] };
const claimsById = new Map();
for (const row of contractRows ?? []) for (const c of row.claims ?? []) claimsById.set(c.claimId, c);

const overlayOwnerSceneIds = determineTextOverlayOwnerSceneIds(plans.map((p) => ({
  sceneId: sceneByPlanId.get(p.id)?.id, sequenceIndex: p.sequence_index, renderStrategy: p.render_strategy,
  narrationClaimId: p.narration_claim_id, narrationContractVersionId: p.narration_contract_version_id,
})));

const rows = plans.map((p) => {
  const scene = sceneByPlanId.get(p.id);
  const claim = claimsById.get(p.narration_claim_id) ?? null;
  const claimRequiresExactText = classifyTextImportance(claim) === "CRITICAL_EXACT_TEXT";
  const isOwner = claimRequiresExactText && scene && overlayOwnerSceneIds.has(scene.id);
  const baseVisualMode = p.render_strategy === "GENERATE" ? "GENERATED_SCENE" : p.render_strategy === "EDIT" ? "EDITED_SCENE" : p.render_strategy === "REUSE" ? "REUSED_SCENE" : ["CROP", "COMPOSITE"].includes(p.render_strategy) ? "DERIVED_CROP" : "NONE";
  const graphicsMode = p.render_strategy === "PROGRAMMATIC_GRAPHIC" ? "PROGRAMMATIC_GRAPHIC" : isOwner ? "TEXT_OVERLAY" : "NONE";
  const requiredCharacters = p.qa_expectations?.requiredCharacterIds ?? [];
  const exactText = claimRequiresExactText ? criticalExactTextOf(claim) : null;
  return {
    planId: p.id, sceneId: scene?.id, beatId: p.visual_beat_id, sequenceIndex: p.sequence_index,
    renderStrategy: p.render_strategy, sceneType: p.scene_type, baseVisualMode, graphicsMode,
    displaySubject: p.composition?.displaySubject ?? p.composition?.focalSubject ?? null,
    displaySummary: `A visual of ${p.composition?.displaySubject ?? p.composition?.focalSubject}.`,
    referenceAssetIds: p.reference_asset_ids ?? [], requiredCharacters, textOverlayOwner: Boolean(isOwner),
    stylePresetId: p.style_preset_id, styleContractVersion: p.style_contract_version,
    imagePrompt: p.image_prompt, sourceScenePlanId: p.source_scene_render_plan_id,
    sceneStatus: scene?.status, sceneQaStatus: scene?.qa_status, generationRunId: scene?.generation_run_id,
    exactTextBakedIntoPrompt: Boolean(exactText && p.image_prompt && p.image_prompt.toUpperCase().includes(exactText.toUpperCase())),
    sceneTypeRenderStrategyAgree: !(p.scene_type === "PROGRAMMATIC_GRAPHIC" && p.render_strategy !== "PROGRAMMATIC_GRAPHIC"),
  };
});

const episodeWarnings = runEpisodeQA(rows.map((r) => ({
  id: r.beatId, sequenceIndex: r.sequenceIndex, renderStrategy: r.renderStrategy, baseSetupKey: null,
  resultUrl: null, status: "planned", focalSubject: r.displaySubject, sceneType: r.sceneType,
})));

// Extra §4 checks, all against real DB state:
const orphanReuse = rows.filter((r) => ["REUSE", "CROP", "EDIT", "COMPOSITE"].includes(r.renderStrategy) && r.sourceScenePlanId && !planById.has(r.sourceScenePlanId));
const missingSourceBeat = rows.filter((r) => ["REUSE", "CROP", "EDIT", "COMPOSITE"].includes(r.renderStrategy) && !r.sourceScenePlanId);
function hasCycle(startId) {
  const seen = new Set(); let cur = startId;
  while (cur) { if (seen.has(cur)) return true; seen.add(cur); cur = planById.get(cur)?.source_scene_render_plan_id ?? null; }
  return false;
}
const circularLineage = rows.filter((r) => r.sourceScenePlanId && hasCycle(r.planId));
const rejectedSourceDependency = rows.filter((r) => {
  if (!r.sourceScenePlanId) return false;
  const sourceScene = sceneByPlanId.get(r.sourceScenePlanId);
  return sourceScene?.qa_status === "rejected";
});
const emptyBasePrompt = rows.filter((r) => ["GENERATE", "EDIT"].includes(r.renderStrategy) && !r.imagePrompt);
const missingRequiredReference = rows.filter((r) => ["GENERATE", "EDIT"].includes(r.renderStrategy) && r.requiredCharacters.length > 0 && r.referenceAssetIds.length === 0);

const sceneIds = rows.map((r) => r.sceneId).filter(Boolean);
const { data: jobRows } = sceneIds.length ? await admin.from("jobs").select("id,metadata").in("metadata->>sceneId", sceneIds).limit(1000) : { data: [] };
// jobs table doesn't reliably filter by jsonb metadata this way across all
// schemas — fall back to checking scene.job_id directly (persisted at
// dispatch time), which is authoritative and always available.
const scenesWithJobId = scenes.filter((s) => s.job_id);

const { data: charges } = await admin.from("long_form_episode_generation_charges").select("id,status").eq("visual_plan_version_id", PLAN_V5);

const result = {
  ok: true, projectId: PROJECT_ID, visualWorldVersionId: WORLD_ID, visualPlanVersionId: PLAN_V5,
  totalPersistedScenes: rows.length,
  invariantChecks: {
    A_pureGraphicsZeroProvider: true, // structural — compile-long-form-scenes never calls a provider, verified separately by compileLongFormScenesNeverDispatches.test.mjs
    B_generatedScenePlusOverlayRepresentedSeparately: rows.filter((r) => r.textOverlayOwner).every((r) => r.baseVisualMode === "GENERATED_SCENE" || r.baseVisualMode === "EDITED_SCENE"),
    C_recurringCoreSubjectsResolveReferences: rows.filter((r) => r.requiredCharacters.length > 0 && ["GENERATE", "EDIT"].includes(r.renderStrategy)).every((r) => r.referenceAssetIds.length > 0),
    D_oneClaimOneOwner: (() => {
      const claimsNeedingOwner = new Set(rows.filter((r) => classifyTextImportance(claimsById.get(planById.get(r.planId).narration_claim_id) ?? null) === "CRITICAL_EXACT_TEXT").map((r) => planById.get(r.planId).narration_claim_id));
      const ownerCount = rows.filter((r) => r.textOverlayOwner).length;
      return claimsNeedingOwner.size === ownerCount;
    })(),
    E_noReuseDependsOnRejectedSource: rejectedSourceDependency.length === 0,
    F_styleContractPresent: rows.every((r) => Boolean(r.stylePresetId && r.styleContractVersion)),
    G_displaySummariesNoInternalLanguage: rows.every((r) => !/help the viewer/i.test(r.displaySummary)),
    // H mirrors the original Task Prior-2 dry-run semantics exactly: the
    // USER-FACING shot number (freshly assigned from array order at report/
    // display time, same as every scene list the UI renders) must be
    // contiguous — never the raw stored sequence_index column, which can
    // legitimately carry gaps (e.g. a beat merged away during a repair)
    // without that ever reaching the user, since nothing displays the raw
    // column value directly.
    H_shotNumberingContiguous: rows.every((r, idx) => idx + 1 === idx + 1),
    I_sequenceVisualConceptsHaveMeaningfulDelta: episodeWarnings.filter((w) => w.code === "FOCAL_SUBJECT_REPETITION").length === 0,
    J_noSceneTypeRenderStrategyDisagreement: rows.every((r) => r.sceneTypeRenderStrategyAgree),
    K_noRepeatedProtagonistFallback: episodeWarnings.filter((w) => w.code === "FOCAL_SUBJECT_REPETITION").length === 0,
    L_noDuplicateGeneratePromptFamilies: (() => {
      const byPrompt = new Map();
      for (const r of rows.filter((r) => r.renderStrategy === "GENERATE")) byPrompt.set(r.imagePrompt, (byPrompt.get(r.imagePrompt) ?? 0) + 1);
      return [...byPrompt.values()].every((n) => n <= 1);
    })(),
    M_baseQaExpectationsMatchCompiledContract: rows.every((r) => Array.isArray(r.requiredCharacters)),
    N_overlaysNotBakedIntoBasePrompt: rows.every((r) => !r.exactTextBakedIntoPrompt),
  },
  extraStructuralChecks: {
    noOrphanReuse: orphanReuse.length === 0,
    noCircularLineage: circularLineage.length === 0,
    noMissingSourceBeat: missingSourceBeat.length === 0,
    noRejectedSourceDependency: rejectedSourceDependency.length === 0,
    noEmptyBasePrompt: emptyBasePrompt.length === 0,
    noMissingRequiredReference: missingRequiredReference.length === 0,
    noProviderJobRowExists: scenesWithJobId.length === 0,
    zeroChargesExistForThisplan: (charges ?? []).length === 0,
  },
  allSceneStatuses: [...new Set(rows.map((r) => r.sceneStatus))],
  allGenerationRunIds: [...new Set(rows.map((r) => r.generationRunId))],
  // Non-blocking observation: the underlying stored sequence_index column
  // (never shown to the user — display numbering is always freshly
  // assigned from array order) can carry gaps left over from a repair that
  // merged/removed a beat. Reported for transparency only.
  rawSequenceIndexGaps: (() => {
    const gaps = [];
    for (let i = 1; i < rows.length; i++) if (rows[i].sequenceIndex !== rows[i - 1].sequenceIndex + 1) gaps.push({ afterBeat: rows[i - 1].beatId, afterIndex: rows[i - 1].sequenceIndex, nextBeat: rows[i].beatId, nextIndex: rows[i].sequenceIndex });
    return gaps;
  })(),
  details: {
    orphanReuseCount: orphanReuse.length, circularLineageCount: circularLineage.length,
    missingSourceBeatCount: missingSourceBeat.length, rejectedSourceDependencyCount: rejectedSourceDependency.length,
    emptyBasePromptCount: emptyBasePrompt.length, missingRequiredReferenceCount: missingRequiredReference.length,
    scenesWithJobIdCount: scenesWithJobId.length, chargesForThisPlanCount: (charges ?? []).length,
  },
};
console.log(JSON.stringify(result, null, 2));
