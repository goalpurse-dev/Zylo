import test from "node:test";
import assert from "node:assert/strict";
import { buildSceneCards, deriveSceneCardStatus, deriveEpisodeGenerationProgress } from "../src/pages/workspace/long-form/sceneCardModel.js";

// 2026-09-22 "FINAL stabilization pass" §17 + §18 — real Atlantis findings:
// (17) the visible shot sequence read "01 02 03 05 06..." because internal
// sequence_index 4 was absent after prior planning/version work — internal
// ids may have gaps, but the user-facing shot NUMBER must be contiguous.
// (18) most rejected scenes carry severity=HARD_FAIL, requiresReview=false
// (an objectively broken result), yet the UI labeled every rejection "Needs
// review," implying a human judgment call that isn't there for a HARD_FAIL.

function beat(overrides) {
  return { id: "b1", sequenceIndex: 1, chapterId: "ch1", estimatedStartSeconds: 0, estimatedEndSeconds: 5, informationToCommunicate: "x", renderMethod: "GENERATE", primaryEntityIds: [], supportingEntityIds: [], ...overrides };
}

test("§17: displayIndex is a contiguous 1-based position even when internal sequenceIndex has a gap", () => {
  const beats = [
    beat({ id: "b1", sequenceIndex: 1 }),
    beat({ id: "b2", sequenceIndex: 2 }),
    beat({ id: "b3", sequenceIndex: 3 }),
    // sequenceIndex 4 is missing entirely — matches the real Atlantis shape
    beat({ id: "b5", sequenceIndex: 5 }),
    beat({ id: "b6", sequenceIndex: 6 }),
  ];
  const cards = buildSceneCards(beats, new Map(), new Map(), new Map());
  assert.deepEqual(cards.map((c) => c.displayIndex), [1, 2, 3, 4, 5]);
  assert.deepEqual(cards.map((c) => c.sequenceIndex), [1, 2, 3, 5, 6], "the internal id itself is left untouched, gap and all");
});

test("§17: nextQueuedShotLabel and currentActivities shot labels read the contiguous displayIndex, never the gapped sequenceIndex", () => {
  const beats = [
    beat({ id: "b1", sequenceIndex: 1 }),
    beat({ id: "b3", sequenceIndex: 3 }), // sequenceIndex 2 missing
  ];
  const scenes = new Map([
    ["b1", { id: "s1", status: "pending" }],
    ["b3", { id: "s3", status: "running", job_id: "j1" }],
  ]);
  const cards = buildSceneCards(beats, new Map(), scenes, new Map());
  // b1 is queued (a real pending scene row), b3 is generating.
  const progress = deriveEpisodeGenerationProgress(cards, { hasActiveRun: true });
  assert.equal(progress.nextQueuedShotLabel, "Shot 01");
  assert.equal(progress.currentActivities[0].shotLabel, "Shot 02", "b3 is the 2nd displayed shot despite sequenceIndex 3");
});

test("§18: a HARD_FAIL (requiresReview:false) rejection reads 'Needs fix', not 'Needs review'", () => {
  const scene = { status: "succeeded", qa_status: "rejected", qa_result: { severity: "HARD_FAIL", requiresReview: false } };
  const status = deriveSceneCardStatus(scene);
  assert.equal(status.label, "Needs fix");
  assert.equal(status.key, "needs_review", "the operational bucket stays unified — filtering/counting/manual-approve must still treat this as actionable");
});

test("§18: a genuinely soft/ambiguous rejection (requiresReview:true) still reads 'Needs review'", () => {
  const scene = { status: "succeeded", qa_status: "rejected", qa_result: { severity: "SOFT_WARNING", requiresReview: true } };
  const status = deriveSceneCardStatus(scene);
  assert.equal(status.label, "Needs review");
  assert.equal(status.key, "needs_review");
});

test("§18: a rejection with no qa_result at all (legacy row) defaults to 'Needs fix' rather than falsely implying a human judgment call exists", () => {
  const scene = { status: "succeeded", qa_status: "rejected" };
  const status = deriveSceneCardStatus(scene);
  assert.equal(status.label, "Needs fix");
});
