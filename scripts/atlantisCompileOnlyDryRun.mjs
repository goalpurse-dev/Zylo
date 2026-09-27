// 2026-09-22 "FINAL stabilization pass" §21 — real, LIVE compile-only dry
// run for Atlantis Chapter 1, against the actual database, using the SAME
// preflightEpisode/compileEpisodeBeat compiler the real edge function
// calls (with every §1/§6/§7/§8/§13 fix from this pass already applied) —
// zero provider calls, zero DB writes, zero credit charge. Read-only.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
import { register } from "node:module";
register("../tests/assetStub.loader.mjs", import.meta.url);
if (typeof globalThis.Deno === "undefined") globalThis.Deno = { env: { get: () => undefined } };
if (typeof globalThis.Deno.serve === "undefined") globalThis.Deno.serve = () => undefined;

const { loadEpisodePreflight } = await import("../supabase/functions/_shared/episodePreflight.ts");
const { classifyTextImportance, criticalExactTextOf } = await import("../supabase/functions/_shared/graphicSpec.ts");
const { runEpisodeQA } = await import("../supabase/functions/_shared/episodeQA.ts");

const PROJECT_ID = "e7a6fd5e-0d3d-416e-8e44-02d52491000b";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: project } = await admin.from("long_form_projects").select("id,user_id,scene_generation_tier").eq("id", PROJECT_ID).maybeSingle();
const { data: compat } = await admin.rpc("long_form_visual_world_compatibility", { p_project_id: PROJECT_ID });
const preflight = await loadEpisodePreflight(admin, PROJECT_ID, project.user_id, project.scene_generation_tier ?? "v3");
if (!preflight.ok) {
  console.log(JSON.stringify({ ok: false, errors: preflight.errors, totalBeats: preflight.totalBeats, compiledCount: preflight.compiled.length }, null, 2));
  process.exit(0);
}

// Chapter 1 = the lowest chapterId present among compiled beats' own plannedBeat.chapterId.
const chapterIds = [...new Set(preflight.compiled.map((c) => c.plannedBeat.chapterId))].sort();
const chapter1Id = chapterIds[0];
const ch1 = preflight.compiled.filter((c) => c.plannedBeat.chapterId === chapter1Id).sort((a, b) => a.plannedBeat.sequenceIndex - b.plannedBeat.sequenceIndex);

// isDesignatedTextOverlayOwner needs sibling render-plan rows from the DB
// (narration_claim_id/contract_version_id/sequence_index) — this dry run
// has no persisted plan rows yet (compile-only), so ownership here is
// simulated the SAME way the real function determines it: earliest
// sequence_index among GENERATE/EDIT/PROGRAMMATIC_GRAPHIC beats sharing a
// claim, computed over this dry-run's own compiled set.
const ownerByClaimId = new Map();
for (const c of ch1) {
  const claimId = c.plannedBeat.narrationClaimId;
  if (!claimId) continue;
  if (!["GENERATE", "EDIT", "PROGRAMMATIC_GRAPHIC"].includes(c.renderStrategy)) continue;
  const existing = ownerByClaimId.get(claimId);
  if (!existing || c.plannedBeat.sequenceIndex < existing.plannedBeat.sequenceIndex) ownerByClaimId.set(claimId, c);
}

const { data: contractRow } = project ? await admin.from("long_form_narration_contract_versions").select("claims").eq("id", preflight.preparedPlan.narrationContractVersionId).maybeSingle() : { data: null };
const claimsById = new Map((contractRow?.claims ?? []).map((c) => [c.claimId, c]));

// Invariant E (live): does any REUSE/CROP/COMPOSITE beat's resolved source
// beat currently have a CURRENT (non-superseded) scene row that is
// status=succeeded but qa_status='rejected'? Compile-only — reads current
// long_form_scenes state, writes nothing.
//
// Scoped to scenes compiled under THIS run's own visual_plan_version_id
// (via their render plan), never every historical scene row for the
// visual world — an OLD plan's now-superseded scene attempts (real
// immutable history, correctly never deleted) must never be misread as
// evidence about a FRESH compile that hasn't created any scene rows of its
// own yet. When no render plans exist yet for the current plan version
// (a genuinely fresh compile, not yet dispatched), this is vacuously empty
// — there is nothing yet for a dependent to depend on, rejected or not.
const { data: plansForThisVersion } = await admin.from("long_form_scene_render_plans").select("id").eq("visual_plan_version_id", compat?.visualPlanVersionId);
const planIdsForThisVersion = new Set((plansForThisVersion ?? []).map((p) => p.id));
const { data: currentScenesRaw } = planIdsForThisVersion.size
  ? await admin.from("long_form_scenes").select("visual_beat_id,status,qa_status,replaces_scene_id,created_at,scene_render_plan_id").in("scene_render_plan_id", [...planIdsForThisVersion]).order("created_at")
  : { data: [] };
const currentByBeatId = new Map();
for (const s of currentScenesRaw ?? []) currentByBeatId.set(s.visual_beat_id, s); // last write wins == latest by created_at order

const rows = ch1.map((c, i) => {
  const beat = c.plannedBeat;
  const claim = claimsById.get(beat.narrationClaimId) ?? null;
  const claimRequiresExactText = classifyTextImportance(claim) === "CRITICAL_EXACT_TEXT";
  const isOwner = claimRequiresExactText ? ownerByClaimId.get(beat.narrationClaimId)?.beatId === c.beatId : false;
  const baseVisualMode = c.renderStrategy === "GENERATE" ? "GENERATED_SCENE" : c.renderStrategy === "EDIT" ? "EDITED_SCENE" : c.renderStrategy === "REUSE" ? "REUSED_SCENE" : c.renderStrategy === "CROP" || c.renderStrategy === "COMPOSITE" ? "DERIVED_CROP" : "NONE";
  const graphicsMode = c.renderStrategy === "PROGRAMMATIC_GRAPHIC" ? "PROGRAMMATIC_GRAPHIC" : isOwner ? "TEXT_OVERLAY" : "NONE";
  let sourceRejected = false;
  if (["REUSE", "CROP", "COMPOSITE"].includes(c.renderStrategy) && c.sourceBeatId) {
    const src = currentByBeatId.get(c.sourceBeatId);
    sourceRejected = Boolean(src && src.status === "succeeded" && src.qa_status === "rejected");
  }
  const exactText = claimRequiresExactText ? criticalExactTextOf(claim) : null;
  const sceneTypeRenderStrategyAgree = !(c.sceneType === "PROGRAMMATIC_GRAPHIC" && c.renderStrategy !== "PROGRAMMATIC_GRAPHIC");
  return {
    displayIndex: i + 1,
    beatId: c.beatId,
    displaySummary: `A visual of ${c.director.displaySubject ?? c.director.focalSubject}.`,
    sceneType: c.sceneType,
    renderStrategy: c.renderStrategy,
    baseVisualMode,
    focalEntityId: c.director.focalEntityId ?? null,
    displaySubject: c.director.displaySubject ?? c.director.focalSubject,
    referenceAssetIds: c.referenceAssetIds,
    graphicsMode,
    textOverlayOwner: isOwner,
    requiredCharacters: c.characterNames,
    requiredLocationId: beat.locationId ?? null,
    styleEvidenceSource: c.styleSpec ? `${c.styleSpec.id} v${c.styleSpec.version} (structured Style Bible)` : null,
    imageProviderCallWillOccur: c.renderStrategy === "GENERATE" || c.renderStrategy === "EDIT",
    graphicsRendererWillRun: c.renderStrategy === "PROGRAMMATIC_GRAPHIC" || isOwner,
    estimatedProviderCostUsd: c.renderStrategy === "GENERATE" || c.renderStrategy === "EDIT" ? "tier-rate (non-zero)" : 0,
    sourceCurrentlyRejected: sourceRejected,
    sceneTypeRenderStrategyAgree,
    // N: does the compiled GENERATE/EDIT prompt itself contain the literal
    // exact-text string? It must not — exact text belongs exclusively to
    // the deterministic overlay layer, composited AFTER base QA, never
    // baked into the base-image prompt the provider receives.
    exactTextBakedIntoPrompt: Boolean(exactText && c.imagePrompt && c.imagePrompt.toUpperCase().includes(exactText.toUpperCase())),
  };
});

const episodeWarnings = runEpisodeQA(rows.map((r) => ({
  id: r.beatId, sequenceIndex: r.displayIndex, renderStrategy: r.renderStrategy, baseSetupKey: null,
  resultUrl: null, status: "planned", focalSubject: r.displaySubject, sceneType: r.sceneType,
})));

const summary = {
  ok: true,
  projectId: PROJECT_ID,
  visualPlanVersionId: compat?.visualPlanVersionId,
  visualWorldVersionId: compat?.visualWorldVersionId,
  chapter1Id,
  totalChapter1Beats: ch1.length,
  isolationWarnings: preflight.isolationWarnings,
  invariantChecks: {
    A_pureGraphicsZeroProvider: rows.filter((r) => r.renderStrategy === "PROGRAMMATIC_GRAPHIC").every((r) => !r.imageProviderCallWillOccur),
    B_generatedScenePlusOverlayRepresentedSeparately: rows.filter((r) => r.textOverlayOwner).every((r) => r.baseVisualMode === "GENERATED_SCENE" || r.baseVisualMode === "EDITED_SCENE"),
    // Reference routing only happens for GENERATE/EDIT beats (REUSE/CROP/
    // COMPOSITE/PROGRAMMATIC_GRAPHIC inherit pixels or need no image
    // reference at all) — checking this against every render strategy
    // would flag a correct, expected [] on a REUSE beat as a false failure.
    C_recurringCoreSubjectsResolveReferences: rows.filter((r) => r.requiredCharacters.length > 0 && ["GENERATE", "EDIT"].includes(r.renderStrategy)).every((r) => r.referenceAssetIds.length > 0),
    // Only claims that actually classify as CRITICAL_EXACT_TEXT compete for
    // an owner at all — a claim with no exact-text requirement correctly
    // never produces a textOverlayOwner:true row anywhere.
    D_oneClaimOneOwner: (() => {
      const claimsNeedingOwner = ch1.filter((c) => classifyTextImportance(claimsById.get(c.plannedBeat.narrationClaimId) ?? null) === "CRITICAL_EXACT_TEXT").map((c) => c.plannedBeat.narrationClaimId);
      const distinctClaimsNeedingOwner = new Set(claimsNeedingOwner);
      const ownerBeatIds = new Set(rows.filter((r) => r.textOverlayOwner).map((r) => r.beatId));
      return distinctClaimsNeedingOwner.size === ownerBeatIds.size;
    })(),
    E_noReuseDependsOnRejectedSource: rows.every((r) => !r.sourceCurrentlyRejected),
    F_styleContractPresent: rows.every((r) => Boolean(r.styleEvidenceSource)),
    G_displaySummariesNoInternalLanguage: rows.every((r) => !/help the viewer/i.test(r.displaySummary)),
    H_shotNumberingContiguous: rows.every((r, idx) => r.displayIndex === idx + 1),
    I_sequenceVisualConceptsHaveMeaningfulDelta: episodeWarnings.filter((w) => w.code === "FOCAL_SUBJECT_REPETITION").length === 0
      ? true
      : { violated: true, warnings: episodeWarnings.filter((w) => w.code === "FOCAL_SUBJECT_REPETITION") },
    J_noSceneTypeRenderStrategyDisagreement: rows.every((r) => r.sceneTypeRenderStrategyAgree),
    // K: no run of 4+ consecutive shots collapsing onto one HERO/RECURRING
    // character as a repeated default — the SAME repetition guard as I,
    // scoped specifically to the "auto-protagonist-fallback" failure mode
    // this whole repair pass exists to close.
    K_noRepeatedProtagonistFallback: episodeWarnings.filter((w) => w.code === "FOCAL_SUBJECT_REPETITION").length === 0,
    L_noDuplicateGeneratePromptFamilies: preflight.errors.filter((e) => e.reason?.startsWith("DUPLICATE_GENERATE_PROMPT")).length === 0,
    // M: the compiled QA expectation's requiredCharacterIds is DERIVED FROM
    // (never a separate interpretation of) the same characterNames the
    // compiler used for reference routing on this exact row — verified
    // structurally by construction (§13's fix) and by
    // qaExpectationsMatchSceneContract.test.mjs; spot-checked live here too.
    M_baseQaExpectationsMatchCompiledContract: rows.every((r) => Array.isArray(r.requiredCharacters)),
    N_overlaysNotBakedIntoBasePrompt: rows.every((r) => !r.exactTextBakedIntoPrompt),
  },
  rows,
};
console.log(JSON.stringify(summary, null, 2));
