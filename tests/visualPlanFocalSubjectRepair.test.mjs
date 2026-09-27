import test from "node:test";
import assert from "node:assert/strict";
import { detectFocalSubjectRepairRegions, mergeFocalSubjectRepairIntoPlan, buildFocalSubjectRepairInput, buildFocalSubjectRepairSchema, FOCAL_SUBJECT_REPETITION_THRESHOLD } from "../supabase/functions/_shared/visualPlanFocalSubjectRepair.ts";

// 2026-09-22 "targeted Visual Plan repair" pass — real, live Atlantis
// finding (confirmed by reading actual persisted contracts, never a
// screenshot): a macro sequence's OWN primaryEntityIds correctly listed
// several distinct valid subjects, yet EVERY one of its expanded shots
// still resolved subject to the same single fallback entity, because
// per-shot subject resolution (visualShotPlanning.js) falls through to the
// shared narration claim's one primarySubject whenever no candidate
// entity's name is literally quoted in that shot's own narration slice.
// These tests are deliberately generic — no Atlantis/Plato/Pillars string
// anywhere — using invented macro/entity ids to prove the detector and
// merge logic work for ANY topic.

function beat(overrides) {
  return { id: "b", sequenceIndex: 0, subject: "x", sourceMacroBeatId: "m1", shotNarrationText: "text", visualType: "STORY_ILLUSTRATION", ...overrides };
}

test("detectFocalSubjectRepairRegions: a run at/above threshold sharing one macro is flagged, snapped to the WHOLE macro (never split mid-macro)", () => {
  const plan = {
    visualBeats: [
      beat({ id: "m1_s1", sequenceIndex: 0, subject: "ent_a", sourceMacroBeatId: "m1" }),
      beat({ id: "m1_s2", sequenceIndex: 1, subject: "ent_a", sourceMacroBeatId: "m1" }),
      beat({ id: "m1_s3", sequenceIndex: 2, subject: "ent_a", sourceMacroBeatId: "m1" }),
      beat({ id: "m1_s4", sequenceIndex: 3, subject: "ent_a", sourceMacroBeatId: "m1" }),
    ],
  };
  const regions = detectFocalSubjectRepairRegions(plan, 4);
  assert.equal(regions.length, 1);
  assert.deepEqual(regions[0].beatIds, ["m1_s1", "m1_s2", "m1_s3", "m1_s4"]);
  assert.deepEqual(regions[0].macroSequenceIds, ["m1"]);
});

test("detectFocalSubjectRepairRegions: same subject is flagged regardless of visualType — a differing pre-compile visualType is NOT trusted as proof of real visual variety (it can still compile down to a plain GENERATE illustration — see §7)", () => {
  const plan = {
    visualBeats: [
      beat({ id: "m1_s1", sequenceIndex: 0, subject: "ent_a", visualType: "CHARACTER", sourceMacroBeatId: "m1" }),
      beat({ id: "m1_s2", sequenceIndex: 1, subject: "ent_a", visualType: "ENVIRONMENT", sourceMacroBeatId: "m1" }),
      beat({ id: "m1_s3", sequenceIndex: 2, subject: "ent_a", visualType: "OBJECT_DETAIL", sourceMacroBeatId: "m1" }),
      beat({ id: "m1_s4", sequenceIndex: 3, subject: "ent_a", visualType: "STORY_ILLUSTRATION", sourceMacroBeatId: "m1" }),
    ],
  };
  assert.equal(detectFocalSubjectRepairRegions(plan, 4).length, 1, "subject repetition is flagged even though visualType varies per shot");
});

test("detectFocalSubjectRepairRegions: below-threshold repeats and genuinely varied subjects are never flagged", () => {
  const plan = {
    visualBeats: [
      beat({ id: "m1_s1", sequenceIndex: 0, subject: "ent_a", sourceMacroBeatId: "m1" }),
      beat({ id: "m1_s2", sequenceIndex: 1, subject: "ent_a", sourceMacroBeatId: "m1" }),
      beat({ id: "m1_s3", sequenceIndex: 2, subject: "ent_b", sourceMacroBeatId: "m1" }),
      beat({ id: "m2_s1", sequenceIndex: 3, subject: "ent_c", sourceMacroBeatId: "m2" }),
    ],
  };
  assert.deepEqual(detectFocalSubjectRepairRegions(plan, 4), []);
});

test("detectFocalSubjectRepairRegions: two adjacent flagged macros merge into ONE region rather than two overlapping ones", () => {
  const plan = {
    visualBeats: [
      beat({ id: "m1_s1", sequenceIndex: 0, subject: "ent_a", sourceMacroBeatId: "m1" }),
      beat({ id: "m1_s2", sequenceIndex: 1, subject: "ent_a", sourceMacroBeatId: "m1" }),
      beat({ id: "m1_s3", sequenceIndex: 2, subject: "ent_a", sourceMacroBeatId: "m1" }),
      beat({ id: "m1_s4", sequenceIndex: 3, subject: "ent_a", sourceMacroBeatId: "m1" }),
      beat({ id: "m2_s1", sequenceIndex: 4, subject: "ent_b", sourceMacroBeatId: "m2" }),
      beat({ id: "m2_s2", sequenceIndex: 5, subject: "ent_b", sourceMacroBeatId: "m2" }),
      beat({ id: "m2_s3", sequenceIndex: 6, subject: "ent_b", sourceMacroBeatId: "m2" }),
      beat({ id: "m2_s4", sequenceIndex: 7, subject: "ent_b", sourceMacroBeatId: "m2" }),
    ],
  };
  const regions = detectFocalSubjectRepairRegions(plan, 4);
  assert.equal(regions.length, 1, "two adjacent flagged macros must merge into one coherent region");
  assert.deepEqual(regions[0].macroSequenceIds, ["m1", "m2"]);
  assert.equal(regions[0].beatIds.length, 8);
});

test("detectFocalSubjectRepairRegions: an UNFLAGGED macro between two flagged ones is never pulled into the region (minimum repair region — never replan unrelated content)", () => {
  const plan = {
    visualBeats: [
      ...["s1", "s2", "s3", "s4"].map((s, i) => beat({ id: `m1_${s}`, sequenceIndex: i, subject: "ent_a", sourceMacroBeatId: "m1" })),
      beat({ id: "m2_s1", sequenceIndex: 4, subject: "ent_varied", sourceMacroBeatId: "m2" }),
      ...["s1", "s2", "s3", "s4"].map((s, i) => beat({ id: `m3_${s}`, sequenceIndex: 5 + i, subject: "ent_c", sourceMacroBeatId: "m3" })),
    ],
  };
  const regions = detectFocalSubjectRepairRegions(plan, 4);
  assert.equal(regions.length, 2, "m1 and m3 are separate regions since m2 (genuinely varied) sits between them");
  assert.ok(!regions.some((r) => r.macroSequenceIds.includes("m2")));
});

test("mergeFocalSubjectRepairIntoPlan: only beats in the region are touched; every other beat is byte-identical", () => {
  const plan = {
    visualBeats: [
      beat({ id: "m1_s1", sequenceIndex: 0, subject: "ent_a", sourceMacroBeatId: "m1", renderMethod: "GENERATE", baseSetupKey: "k1" }),
      beat({ id: "m2_s1", sequenceIndex: 1, subject: "untouched_subject", sourceMacroBeatId: "m2" }),
    ],
  };
  const region = { regionId: "r1", macroSequenceIds: ["m1"], beatIds: ["m1_s1"], reason: "test", repeatedSubjects: ["ent_a"] };
  const repaired = [{ beatId: "m1_s1", focalEntityId: "ent_b", displaySubject: "A different thing entirely", narrationMeaning: "means something else", visualType: "OBJECT_DETAIL", continuityWithPrevious: false, meaningfulDelta: "new subject" }];
  const { plan: next, changedCount, unchangedInRegionCount } = mergeFocalSubjectRepairIntoPlan(plan, region, repaired, "src-version-id");
  assert.equal(changedCount, 1);
  assert.equal(unchangedInRegionCount, 0);
  assert.deepEqual(next.visualBeats[1], plan.visualBeats[1], "the untouched beat in a different macro must be byte-identical");
  const changed = next.visualBeats[0];
  assert.equal(changed.subject, "ent_b", "subject is set to the entity ID itself so the compiler's existing focalEntityId resolution picks it up");
  assert.equal(changed.visualType, "OBJECT_DETAIL");
  assert.equal(changed.renderMethod, "GENERATE", "render_strategy is never touched by this repair");
  assert.equal(changed.baseSetupKey, "k1", "baseSetupKey is never touched by this repair");
  assert.equal(changed.repairRegionId, "r1");
  assert.equal(changed.sourceVisualPlanVersionId, "src-version-id");
  assert.equal(changed.preservedFromParent, false);
});

test("mergeFocalSubjectRepairIntoPlan: when focalEntityId is null, subject falls back to the free-text displaySubject", () => {
  const plan = { visualBeats: [beat({ id: "m1_s1", sequenceIndex: 0, sourceMacroBeatId: "m1" })] };
  const region = { regionId: "r1", macroSequenceIds: ["m1"], beatIds: ["m1_s1"], reason: "test", repeatedSubjects: ["x"] };
  const repaired = [{ beatId: "m1_s1", focalEntityId: null, displaySubject: "A reconstructed diagram of the process", narrationMeaning: "m", visualType: "STORY_ILLUSTRATION", continuityWithPrevious: false, meaningfulDelta: "d" }];
  const { plan: next } = mergeFocalSubjectRepairIntoPlan(plan, region, repaired, "src");
  assert.equal(next.visualBeats[0].subject, "A reconstructed diagram of the process");
});

// 2026-09-23 "root-contract stabilization" pass — real Atlantis finding: a
// beat originally about ent_a (a CHARACTER) was repaired to a different
// subject (ent_c, an unrelated object), but its OWN primaryEntityIds/
// supportingEntityIds/entities were left pointing at the OLD subject —
// requiredReferenceLookups (sceneRenderPlan.ts) and episodePreflight.ts's
// character-presence derivation read ONLY those fields (never subject/
// displaySubject), so the compiler kept routing ent_a's identity reference
// and ent_a kept appearing in the rendered scene despite the "repaired"
// subject having nothing to do with it. Generic fixture — no Atlantis names.
test("mergeFocalSubjectRepairIntoPlan: repairing the focal entity also rebuilds primaryEntityIds/supportingEntityIds/entities — never leaves them pointing at the OLD subject", () => {
  const plan = {
    visualBeats: [beat({
      id: "m1_s1", sequenceIndex: 0, sourceMacroBeatId: "m1", subject: "ent_a",
      primaryEntityIds: ["ent_a", "ent_b"], supportingEntityIds: ["ent_x"], entities: ["ent_a", "ent_b"],
      referenceEntityIds: ["ent_a"], castBindings: [{ characterId: "ent_a", screenPosition: "focal" }],
    })],
  };
  const region = { regionId: "r1", macroSequenceIds: ["m1"], beatIds: ["m1_s1"], reason: "test", repeatedSubjects: ["ent_a"] };
  const repaired = [{ beatId: "m1_s1", focalEntityId: "ent_c", displaySubject: "An unrelated object", narrationMeaning: "m", visualType: "OBJECT_DETAIL", continuityWithPrevious: false, meaningfulDelta: "d" }];
  const { plan: next } = mergeFocalSubjectRepairIntoPlan(plan, region, repaired, "src");
  const changed = next.visualBeats[0];
  assert.deepEqual(changed.primaryEntityIds, ["ent_c"], "the OLD entity (ent_a) must never survive into the repaired beat's reference-routing field");
  assert.deepEqual(changed.supportingEntityIds, []);
  assert.deepEqual(changed.entities, ["ent_c"]);
  assert.deepEqual(changed.referenceEntityIds, ["ent_c"]);
  assert.equal(changed.castBindings[0].characterId, "ent_c");
  assert.ok(!JSON.stringify(changed).includes("ent_a"), "ent_a must not appear anywhere in the repaired beat");
});

test("mergeFocalSubjectRepairIntoPlan: when focalEntityId is null (a concept/detail with no entity), every entity-tagging field is emptied — never left pointing at a stale entity", () => {
  const plan = { visualBeats: [beat({ id: "m1_s1", sequenceIndex: 0, sourceMacroBeatId: "m1", primaryEntityIds: ["ent_a"], entities: ["ent_a"], referenceEntityIds: ["ent_a"] })] };
  const region = { regionId: "r1", macroSequenceIds: ["m1"], beatIds: ["m1_s1"], reason: "test", repeatedSubjects: ["ent_a"] };
  const repaired = [{ beatId: "m1_s1", focalEntityId: null, displaySubject: "A reconstructed diagram", narrationMeaning: "m", visualType: "STORY_ILLUSTRATION", continuityWithPrevious: false, meaningfulDelta: "d" }];
  const { plan: next } = mergeFocalSubjectRepairIntoPlan(plan, region, repaired, "src");
  const changed = next.visualBeats[0];
  assert.deepEqual(changed.primaryEntityIds, []);
  assert.deepEqual(changed.entities, []);
  assert.deepEqual(changed.referenceEntityIds, []);
  assert.deepEqual(changed.castBindings, []);
});

test("mergeFocalSubjectRepairIntoPlan: a region beat the LLM didn't return is marked preservedFromParent, never silently dropped", () => {
  const plan = { visualBeats: [beat({ id: "m1_s1", sequenceIndex: 0, sourceMacroBeatId: "m1" })] };
  const region = { regionId: "r1", macroSequenceIds: ["m1"], beatIds: ["m1_s1"], reason: "test", repeatedSubjects: ["x"] };
  const { plan: next, changedCount, unchangedInRegionCount } = mergeFocalSubjectRepairIntoPlan(plan, region, [], "src");
  assert.equal(changedCount, 0);
  assert.equal(unchangedInRegionCount, 1);
  assert.equal(next.visualBeats[0].preservedFromParent, true);
});

test("buildFocalSubjectRepairInput: candidate entities are scoped to each shot's OWN macro, never a global list", () => {
  const plan = {
    visualBeats: [
      beat({ id: "m1_s1", sequenceIndex: 0, sourceMacroBeatId: "m1", shotNarrationText: "about the harbor" }),
      beat({ id: "m2_s1", sequenceIndex: 1, sourceMacroBeatId: "m2", shotNarrationText: "about the manuscript" }),
    ],
    visualSequences: [
      { sourceMacroBeatId: "m1", primaryEntityIds: ["ent_harbor"], supportingEntityIds: [] },
      { sourceMacroBeatId: "m2", primaryEntityIds: ["ent_manuscript"], supportingEntityIds: [] },
    ],
  };
  const entityRegistryById = new Map([
    ["ent_harbor", { id: "ent_harbor", name: "Harbor", category: "LOCATION" }],
    ["ent_manuscript", { id: "ent_manuscript", name: "Manuscript", category: "IMPORTANT_OBJECT" }],
  ]);
  const region = { regionId: "r1", macroSequenceIds: ["m1", "m2"], beatIds: ["m1_s1", "m2_s1"], reason: "test", repeatedSubjects: [] };
  const input = buildFocalSubjectRepairInput(region, plan, entityRegistryById, new Map());
  assert.deepEqual(input.shots[0].candidateEntities.map((c) => c.id), ["ent_harbor"]);
  assert.deepEqual(input.shots[1].candidateEntities.map((c) => c.id), ["ent_manuscript"]);
});

test("buildFocalSubjectRepairSchema: beatId enum is exactly the region's own beat ids, and focalEntityId is nullable", () => {
  const schema = buildFocalSubjectRepairSchema(["a", "b"]);
  assert.deepEqual(schema.properties.shots.items.properties.beatId.enum, ["a", "b"]);
  assert.deepEqual(schema.properties.shots.items.properties.focalEntityId.type, ["string", "null"]);
});
