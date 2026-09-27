// deno-lint-ignore-file no-explicit-any
import { estimatedCreditsForRenderStrategy } from "./sceneGenerationPricing.ts";
// sceneSampleSelection.ts — 2026-09-22 "permanently separate PLAN/COMPILE
// from PAID GENERATION" pass, §6: "Select representative scenes, NOT
// blindly the first three." A pure, deterministic selector over already-
// compiled scene/render-plan rows — no DB access, no provider call, fully
// unit-testable, and generic across any topic/project (reads only
// structural fields: render_strategy, requiredCharacterIds, overlay
// ownership, scene_type — never an entity name or topic).
//
// Picks up to 3 distinct scenes, one per category, preferring the
// EARLIEST (lowest sequence_index) match in each so the sample is a real,
// reviewable cross-section of the episode's actual opening rather than an
// arbitrary scatter:
//   1. character/reference-heavy GENERATE — a real identity-anchored shot
//   2. environment/concept GENERATE — no required character, a landmark/
//      object/concept shot (exercises reference routing + style with no
//      identity risk)
//   3. overlay/diagram/continuity-sensitive — the designated exact-text
//      overlay owner if one exists, else a PROGRAMMATIC_GRAPHIC (zero
//      provider cost, still worth including so the user sees one), else a
//      REUSE/CROP/EDIT (continuity-lineage) scene
//
// If fewer than 3 distinct categories are satisfiable (a very short or
// unusual plan), returns fewer than 3 — never pads with a duplicate or an
// arbitrary filler pick.

export type SampleCandidateRow = {
  sceneId: string;
  beatId: string;
  sequenceIndex: number;
  renderStrategy: string;
  requiredCharacterIds: string[];
  referenceAssetIds: string[];
  isTextOverlayOwner: boolean;
  estimatedCredits: number;
  displaySubject?: string | null;
};

export type SampleSelectionResult = { sceneId: string; beatId: string; category: string; reason: string; estimatedCredits: number };

// Best-effort mirror of advance-long-form-scene-generation's own
// isDesignatedTextOverlayOwner (same earliest-sequence-index, tie-break-by-
// id ownership rule among GENERATE/EDIT/PROGRAMMATIC_GRAPHIC siblings
// sharing a narration claim) — used ONLY to help pick a representative
// sample scene, never to decide anything at actual dispatch time (that
// still happens live, from real contract data, exactly as it always has).
// Deliberately independent of contract criticality (whether the claim is
// CRITICAL_EXACT_TEXT) since a compile-time reporting pass has no cheap way
// to know that without re-loading the narration contract — a reasonable
// nominal "owner" is still a useful category to show the user even when
// the claim turns out not to require exact text at dispatch time.
export function determineTextOverlayOwnerSceneIds(
  rows: { sceneId: string; sequenceIndex: number; renderStrategy: string; narrationClaimId?: string | null; narrationContractVersionId?: string | null }[],
): Set<string> {
  const owners = new Set<string>();
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.narrationClaimId || !row.narrationContractVersionId) continue;
    if (!["GENERATE", "EDIT", "PROGRAMMATIC_GRAPHIC"].includes(row.renderStrategy)) continue;
    const key = `${row.narrationClaimId}::${row.narrationContractVersionId}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const owner = [...group].sort((a, b) => (a.sequenceIndex - b.sequenceIndex) || String(a.sceneId).localeCompare(String(b.sceneId)))[0];
    owners.add(owner.sceneId);
  }
  return owners;
}

export function selectRepresentativeSampleScenes(rows: SampleCandidateRow[], sampleSize = 3): SampleSelectionResult[] {
  const sorted = [...rows].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  const used = new Set<string>();
  const results: SampleSelectionResult[] = [];

  const characterHeavy = sorted.find((r) =>
    !used.has(r.sceneId) && r.renderStrategy === "GENERATE" && r.requiredCharacterIds.length > 0 && r.referenceAssetIds.length > 0);
  if (characterHeavy) {
    used.add(characterHeavy.sceneId);
    results.push({ sceneId: characterHeavy.sceneId, beatId: characterHeavy.beatId, category: "character_reference_heavy", reason: "A GENERATE scene requiring a canonical character reference — exercises identity routing and reference-image conditioning.", estimatedCredits: characterHeavy.estimatedCredits });
  }

  const environmentConcept = sorted.find((r) =>
    !used.has(r.sceneId) && r.renderStrategy === "GENERATE" && r.requiredCharacterIds.length === 0);
  if (environmentConcept) {
    used.add(environmentConcept.sceneId);
    results.push({ sceneId: environmentConcept.sceneId, beatId: environmentConcept.beatId, category: "environment_or_concept", reason: "A GENERATE scene with no required character — exercises location/object/concept visualization and style fidelity without identity risk.", estimatedCredits: environmentConcept.estimatedCredits });
  }

  const overlayOwner = sorted.find((r) => !used.has(r.sceneId) && r.isTextOverlayOwner);
  const programmaticGraphic = sorted.find((r) => !used.has(r.sceneId) && r.renderStrategy === "PROGRAMMATIC_GRAPHIC");
  const continuityDependent = sorted.find((r) => !used.has(r.sceneId) && ["REUSE", "CROP", "EDIT"].includes(r.renderStrategy));
  const third = overlayOwner ?? programmaticGraphic ?? continuityDependent;
  if (third) {
    const category = third === overlayOwner ? "overlay_owner" : third === programmaticGraphic ? "programmatic_graphic" : "continuity_dependent";
    const reason = category === "overlay_owner" ? "The designated exact-text overlay owner for its claim — exercises base QA before overlay compositing."
      : category === "programmatic_graphic" ? "A PROGRAMMATIC_GRAPHIC scene — zero provider cost, verifies the deterministic graphics renderer end to end."
      : "A REUSE/CROP/EDIT scene — exercises source-lineage validity and continuity, not a fresh generation.";
    used.add(third.sceneId);
    results.push({ sceneId: third.sceneId, beatId: third.beatId, category, reason, estimatedCredits: third.estimatedCredits });
  }

  return results.slice(0, sampleSize);
}

// 2026-09-23 "systemic production stabilization" pass, Item E — the ONE
// authoritative "load compiled scenes for this plan and pick the sample"
// query, shared by BOTH generate-long-form-scene-sample's quote (read-only)
// and its dispatch counterpart's charge (which must recompute the exact
// same selection server-side rather than trusting a client-supplied list) —
// so the two can never silently drift into disagreeing about what "the
// sample" means for a given plan.
export async function resolveSampleCandidates(admin: any, worldId: string, planVersionId: string, tier: string): Promise<{
  compiledPlanCount: number;
  sampleScenes: (SampleSelectionResult & { renderStrategy: string; referenceAssetIds: string[]; hasOverlay: boolean; basePromptSummary: string | null; displaySubject: string | null; sequenceIndex: number })[];
  estimatedSampleCredits: number;
}> {
  const { data: planRows } = await admin.from("long_form_scene_render_plans")
    .select("id, visual_beat_id, sequence_index, render_strategy, reference_asset_ids, narration_claim_id, narration_contract_version_id, composition, image_prompt, overlay_spec")
    .eq("visual_world_version_id", worldId).eq("visual_plan_version_id", planVersionId);
  if (!planRows?.length) return { compiledPlanCount: 0, sampleScenes: [], estimatedSampleCredits: 0 };

  const { data: sceneRows } = await admin.from("long_form_scenes")
    .select("id, scene_render_plan_id, status, input_reference_asset_ids")
    .in("scene_render_plan_id", planRows.map((p: any) => p.id)).is("replaces_scene_id", null);
  const sceneByPlanId = new Map((sceneRows ?? []).map((s: any) => [s.scene_render_plan_id, s]));
  const compiledPlans = planRows.filter((p: any) => sceneByPlanId.has(p.id));
  if (!compiledPlans.length) return { compiledPlanCount: 0, sampleScenes: [], estimatedSampleCredits: 0 };

  const overlayOwnerSceneIds = determineTextOverlayOwnerSceneIds(compiledPlans.map((p: any) => ({
    sceneId: sceneByPlanId.get(p.id)!.id, sequenceIndex: p.sequence_index, renderStrategy: p.render_strategy,
    narrationClaimId: p.narration_claim_id, narrationContractVersionId: p.narration_contract_version_id,
  })));

  const candidates: SampleCandidateRow[] = compiledPlans.map((p: any) => {
    const scene = sceneByPlanId.get(p.id)!;
    const requiredCharacterIds: string[] = p.composition?.focalEntityId ? [p.composition.focalEntityId] : [];
    return {
      sceneId: scene.id, beatId: p.visual_beat_id, sequenceIndex: p.sequence_index, renderStrategy: p.render_strategy,
      requiredCharacterIds, referenceAssetIds: p.reference_asset_ids ?? scene.input_reference_asset_ids ?? [],
      isTextOverlayOwner: overlayOwnerSceneIds.has(scene.id),
      estimatedCredits: estimatedCreditsForRenderStrategy(p.render_strategy, tier),
      displaySubject: p.composition?.displaySubject ?? p.composition?.focalSubject ?? null,
    };
  });

  const selected = selectRepresentativeSampleScenes(candidates);
  const planByBeatId = new Map(compiledPlans.map((p: any) => [p.visual_beat_id, p]));
  const sampleScenes = selected.map((s) => {
    const plan = planByBeatId.get(s.beatId)!;
    return {
      ...s, renderStrategy: plan.render_strategy, sequenceIndex: plan.sequence_index,
      referenceAssetIds: plan.reference_asset_ids ?? [], hasOverlay: Boolean(plan.overlay_spec),
      basePromptSummary: typeof plan.image_prompt === "string" ? plan.image_prompt.slice(0, 240) : null,
      displaySubject: plan.composition?.displaySubject ?? plan.composition?.focalSubject ?? null,
    };
  });

  return { compiledPlanCount: compiledPlans.length, sampleScenes, estimatedSampleCredits: sampleScenes.reduce((sum, s) => sum + s.estimatedCredits, 0) };
}
