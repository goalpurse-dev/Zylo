import test from "node:test";
import assert from "node:assert/strict";
import { selectRepresentativeSampleScenes, determineTextOverlayOwnerSceneIds } from "../supabase/functions/_shared/sceneSampleSelection.ts";

// 2026-09-22 "permanently separate PLAN/COMPILE from PAID GENERATION" pass
// §6 — "this must NOT mean first three blindly." Deliberately generic
// fixtures (no Atlantis/Plato/topic-specific names) to prove the selector
// works for any project.

function row(overrides) {
  return { sceneId: "s", beatId: "b", sequenceIndex: 0, renderStrategy: "GENERATE", requiredCharacterIds: [], referenceAssetIds: [], isTextOverlayOwner: false, estimatedCredits: 1, ...overrides };
}

test("selects one character-heavy, one environment/concept, and one overlay/graphic/continuity scene — never blindly the first three", () => {
  const rows = [
    row({ sceneId: "s1", beatId: "b1", sequenceIndex: 0, renderStrategy: "GENERATE", requiredCharacterIds: ["hero"], referenceAssetIds: ["ref1"] }),
    row({ sceneId: "s2", beatId: "b2", sequenceIndex: 1, renderStrategy: "GENERATE", requiredCharacterIds: ["hero"], referenceAssetIds: ["ref1"] }), // also character-heavy — should NOT be picked, s1 already satisfies that category
    row({ sceneId: "s3", beatId: "b3", sequenceIndex: 2, renderStrategy: "GENERATE", requiredCharacterIds: [] }),
    row({ sceneId: "s4", beatId: "b4", sequenceIndex: 3, renderStrategy: "PROGRAMMATIC_GRAPHIC" }),
  ];
  const result = selectRepresentativeSampleScenes(rows);
  assert.deepEqual(result.map((r) => r.sceneId), ["s1", "s3", "s4"]);
  assert.deepEqual(result.map((r) => r.category), ["character_reference_heavy", "environment_or_concept", "programmatic_graphic"]);
});

test("prefers the designated text-overlay owner over a plain PROGRAMMATIC_GRAPHIC for the third slot when both exist", () => {
  const rows = [
    row({ sceneId: "s1", beatId: "b1", sequenceIndex: 0, requiredCharacterIds: ["hero"], referenceAssetIds: ["ref1"] }),
    row({ sceneId: "s2", beatId: "b2", sequenceIndex: 1, requiredCharacterIds: [] }),
    row({ sceneId: "s3", beatId: "b3", sequenceIndex: 2, renderStrategy: "PROGRAMMATIC_GRAPHIC" }),
    row({ sceneId: "s4", beatId: "b4", sequenceIndex: 3, isTextOverlayOwner: true }),
  ];
  const result = selectRepresentativeSampleScenes(rows);
  assert.equal(result[2].sceneId, "s4");
  assert.equal(result[2].category, "overlay_owner");
});

test("falls back to a REUSE/CROP/EDIT scene for the third slot when no overlay owner or graphic exists", () => {
  const rows = [
    row({ sceneId: "s1", beatId: "b1", sequenceIndex: 0, requiredCharacterIds: ["hero"], referenceAssetIds: ["ref1"] }),
    row({ sceneId: "s2", beatId: "b2", sequenceIndex: 1, requiredCharacterIds: [] }),
    row({ sceneId: "s3", beatId: "b3", sequenceIndex: 2, renderStrategy: "REUSE" }),
  ];
  const result = selectRepresentativeSampleScenes(rows);
  assert.equal(result[2].sceneId, "s3");
  assert.equal(result[2].category, "continuity_dependent");
});

test("selects the EARLIEST match in each category, not just any match — a reviewable cross-section of the episode's real opening", () => {
  const rows = [
    row({ sceneId: "s_late_char", beatId: "b1", sequenceIndex: 10, requiredCharacterIds: ["hero"], referenceAssetIds: ["ref1"] }),
    row({ sceneId: "s_early_char", beatId: "b2", sequenceIndex: 1, requiredCharacterIds: ["hero"], referenceAssetIds: ["ref1"] }),
    row({ sceneId: "s3", beatId: "b3", sequenceIndex: 2, requiredCharacterIds: [] }),
  ];
  const result = selectRepresentativeSampleScenes(rows);
  assert.equal(result[0].sceneId, "s_early_char");
});

test("never pads with a duplicate or arbitrary filler when fewer than 3 categories are satisfiable", () => {
  const rows = [row({ sceneId: "s1", beatId: "b1", requiredCharacterIds: ["hero"], referenceAssetIds: ["ref1"] })];
  const result = selectRepresentativeSampleScenes(rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].sceneId, "s1");
});

test("returns an empty array for an empty candidate list — never throws", () => {
  assert.deepEqual(selectRepresentativeSampleScenes([]), []);
});

test("determineTextOverlayOwnerSceneIds: the earliest-sequence GENERATE/EDIT/PROGRAMMATIC_GRAPHIC scene sharing a claim is the owner, later siblings are not", () => {
  const rows = [
    { sceneId: "s_late", sequenceIndex: 5, renderStrategy: "GENERATE", narrationClaimId: "claim1", narrationContractVersionId: "cv1" },
    { sceneId: "s_early", sequenceIndex: 2, renderStrategy: "GENERATE", narrationClaimId: "claim1", narrationContractVersionId: "cv1" },
    { sceneId: "s_other_claim", sequenceIndex: 1, renderStrategy: "GENERATE", narrationClaimId: "claim2", narrationContractVersionId: "cv1" },
  ];
  const owners = determineTextOverlayOwnerSceneIds(rows);
  assert.deepEqual([...owners].sort(), ["s_early", "s_other_claim"]);
});

test("determineTextOverlayOwnerSceneIds: a scene with no narration claim is never an owner", () => {
  const owners = determineTextOverlayOwnerSceneIds([{ sceneId: "s1", sequenceIndex: 0, renderStrategy: "GENERATE", narrationClaimId: null, narrationContractVersionId: null }]);
  assert.equal(owners.size, 0);
});

test("determineTextOverlayOwnerSceneIds: REUSE/CROP siblings never compete for or win ownership", () => {
  const rows = [
    { sceneId: "s_reuse", sequenceIndex: 0, renderStrategy: "REUSE", narrationClaimId: "claim1", narrationContractVersionId: "cv1" },
    { sceneId: "s_generate", sequenceIndex: 1, renderStrategy: "GENERATE", narrationClaimId: "claim1", narrationContractVersionId: "cv1" },
  ];
  const owners = determineTextOverlayOwnerSceneIds(rows);
  assert.deepEqual([...owners], ["s_generate"]);
});

test("each selected scene reports its own estimatedCredits, never a shared/guessed number", () => {
  const rows = [
    row({ sceneId: "s1", beatId: "b1", sequenceIndex: 0, requiredCharacterIds: ["hero"], referenceAssetIds: ["ref1"], estimatedCredits: 5 }),
    row({ sceneId: "s2", beatId: "b2", sequenceIndex: 1, requiredCharacterIds: [], estimatedCredits: 3 }),
    row({ sceneId: "s3", beatId: "b3", sequenceIndex: 2, renderStrategy: "PROGRAMMATIC_GRAPHIC", estimatedCredits: 0 }),
  ];
  const result = selectRepresentativeSampleScenes(rows);
  assert.deepEqual(result.map((r) => r.estimatedCredits), [5, 3, 0]);
});
