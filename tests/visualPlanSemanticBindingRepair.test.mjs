import test from "node:test";
import assert from "node:assert/strict";
import {
  detectSemanticBindingDefects, groupSemanticBindingDefectsIntoRegions,
  buildSemanticBindingRepairSchema, buildSemanticBindingRepairInput, mergeSemanticBindingRepairIntoPlan,
} from "../supabase/functions/_shared/visualPlanSemanticBindingRepair.ts";

// 2026-09-23 "final targeted Atlantis Visual Plan repair" pass — deliberately
// generic fixtures (no Atlantis/Plato/Timaeus names anywhere) to prove this
// is a category-driven, topic-agnostic detector/repairer.

function entity(overrides) { return { id: "e", name: "Entity", category: "CHARACTER", importance: "HERO", referenceNeeded: true, ...overrides }; }
function beat(overrides) {
  return { id: "b", sequenceIndex: 0, sourceMacroBeatId: "m1", renderMethod: "GENERATE", subject: "ent_hero", primaryEntityIds: ["ent_hero"], supportingEntityIds: [], ...overrides };
}

test("detects a DIAGRAM_SUBJECT entity used as a raster shot's subject", () => {
  const plan = {
    entityRegistry: [entity({ id: "ent_voice", category: "DIAGRAM_SUBJECT" })],
    visualBeats: [beat({ id: "b1", subject: "ent_voice", primaryEntityIds: ["ent_voice"] })],
  };
  const defects = detectSemanticBindingDefects(plan);
  assert.equal(defects.length, 1);
  assert.ok(defects[0].reasons.includes("DIAGRAM_SUBJECT_AS_RASTER_SUBJECT"));
});

test("never flags a beat merely for carrying multiple tagged entities alongside its real CHARACTER subject", () => {
  const plan = {
    entityRegistry: [entity({ id: "ent_hero" }), entity({ id: "obj_thing", category: "IMPORTANT_OBJECT", importance: "RECURRING" })],
    visualBeats: [beat({ id: "b1", subject: "ent_hero", primaryEntityIds: ["ent_hero", "obj_thing"] })],
  };
  assert.deepEqual(detectSemanticBindingDefects(plan), []);
});

test("detects a HERO character tagged (and therefore reference-routed) on a beat whose real subject is something else entirely", () => {
  const plan = {
    entityRegistry: [entity({ id: "ent_hero" }), entity({ id: "obj_thing", category: "IMPORTANT_OBJECT", importance: "RECURRING" })],
    visualBeats: [beat({ id: "b1", subject: "obj_thing", primaryEntityIds: ["ent_hero", "obj_thing"] })],
  };
  const defects = detectSemanticBindingDefects(plan);
  assert.equal(defects.length, 1);
  assert.ok(defects[0].reasons.includes("UNRELATED_CHARACTER_REFERENCE_WILL_BE_ROUTED"));
});

test("never flags an INCIDENTAL-importance character tagged alongside a different subject — only HERO/RECURRING get a routed reference", () => {
  const plan = {
    entityRegistry: [entity({ id: "ent_bystander", importance: "INCIDENTAL" }), entity({ id: "obj_thing", category: "IMPORTANT_OBJECT", importance: "RECURRING" })],
    visualBeats: [beat({ id: "b1", subject: "obj_thing", primaryEntityIds: ["ent_bystander", "obj_thing"] })],
  };
  assert.deepEqual(detectSemanticBindingDefects(plan), []);
});

test("detects an unresolvable entity-id-shaped subject (a dangling reference with nothing in the registry)", () => {
  const plan = { entityRegistry: [], visualBeats: [beat({ id: "b1", subject: "ent_ghost", primaryEntityIds: [] })] };
  const defects = detectSemanticBindingDefects(plan);
  assert.ok(defects[0].reasons.includes("UNRESOLVABLE_ENTITY_TOKEN"));
});

test("detects a pacing-downgraded graphic beat with no illustratable fallback", () => {
  const plan = {
    entityRegistry: [entity({ id: "ent_voice", category: "DIAGRAM_SUBJECT" })],
    visualBeats: [beat({ id: "b1", subject: "some free text", primaryEntityIds: ["ent_voice"], graphicClusterCapped: true, locationId: null })],
  };
  const defects = detectSemanticBindingDefects(plan);
  assert.ok(defects[0].reasons.includes("INCORRECTLY_PACING_DOWNGRADED_GRAPHIC"));
});

test("does NOT flag a pacing-downgraded graphic beat that has a real illustratable fallback and reduces to a short exact-text label", () => {
  const plan = {
    entityRegistry: [entity({ id: "ent_hero" })],
    visualBeats: [beat({ id: "b1", subject: "ent_hero", primaryEntityIds: ["ent_hero"], graphicClusterCapped: true, contractVisualForm: "NUMBER_EMPHASIS", exactText: "42" })],
  };
  assert.deepEqual(detectSemanticBindingDefects(plan), []);
});

test("detects graphic-shaped content (multi-fact, no short label) rendered as raster even without graphicClusterCapped ever being stamped", () => {
  const plan = {
    entityRegistry: [entity({ id: "ent_hero" })],
    visualBeats: [beat({ id: "b1", subject: "ent_hero", primaryEntityIds: ["ent_hero"], contractVisualForm: "TEXT_EMPHASIS", exactText: null })],
  };
  const defects = detectSemanticBindingDefects(plan);
  assert.ok(defects[0].reasons.includes("GRAPHIC_SHAPED_CONTENT_RENDERED_AS_RASTER"));
});

test("detects a raster beat with no illustratable subject at all (only DIAGRAM_SUBJECT candidates, no location, no usable subject text)", () => {
  const plan = {
    entityRegistry: [entity({ id: "ent_voice", category: "DIAGRAM_SUBJECT" })],
    visualBeats: [beat({ id: "b1", subject: "ent_voice", primaryEntityIds: ["ent_voice"], locationId: null })],
  };
  const defects = detectSemanticBindingDefects(plan);
  assert.ok(defects[0].reasons.includes("NO_ILLUSTRATABLE_SUBJECT"));
});

test("detects a raw internal id token leaking into display text", () => {
  const plan = { entityRegistry: [entity({ id: "ent_hero" })], visualBeats: [beat({ id: "b1", displaySubjectHint: "A visual of ent_hero" })] };
  const defects = detectSemanticBindingDefects(plan);
  assert.ok(defects[0].reasons.includes("DISPLAY_TEXT_EXPOSES_INTERNAL_TOKEN"));
});

// 2026-09-23 real Atlantis regression: grouping by whole macro used to
// include EVERY sibling beat in a defective macro's region, even ones never
// flagged — the repair schema only offers GENERATE/PROGRAMMATIC_GRAPHIC, so
// two perfectly valid, zero-cost REUSE beats (never flagged, nothing wrong
// with them) got swept in and silently force-converted into new paid
// GENERATE calls. A region's beatIds must be ONLY the beats actually
// flagged defective — never a macro's untouched siblings.
test("groupSemanticBindingDefectsIntoRegions includes ONLY the beats actually flagged defective — never an untouched sibling in the same macro", () => {
  const plan = { visualBeats: [beat({ id: "m1_s1", sequenceIndex: 1, sourceMacroBeatId: "m1" }), beat({ id: "m1_s2", sequenceIndex: 2, sourceMacroBeatId: "m1", renderMethod: "REUSE" }), beat({ id: "m2_s1", sequenceIndex: 3, sourceMacroBeatId: "m2" })] };
  const defects = [{ beatId: "m1_s1", sourceMacroBeatId: "m1", reasons: ["DIAGRAM_SUBJECT_AS_RASTER_SUBJECT"] }];
  const regions = groupSemanticBindingDefectsIntoRegions(defects, plan);
  assert.equal(regions.length, 1);
  assert.deepEqual(regions[0].beatIds, ["m1_s1"], "the untouched REUSE sibling (m1_s2) must never be included");
});

test("groupSemanticBindingDefectsIntoRegions: when a macro has multiple defective beats, all of THOSE (and only those) are included, ordered by sequenceIndex", () => {
  const plan = { visualBeats: [beat({ id: "m1_s1", sequenceIndex: 1, sourceMacroBeatId: "m1" }), beat({ id: "m1_s2", sequenceIndex: 2, sourceMacroBeatId: "m1" }), beat({ id: "m1_s3", sequenceIndex: 3, sourceMacroBeatId: "m1" })] };
  const defects = [{ beatId: "m1_s3", sourceMacroBeatId: "m1", reasons: ["X"] }, { beatId: "m1_s1", sourceMacroBeatId: "m1", reasons: ["Y"] }];
  const regions = groupSemanticBindingDefectsIntoRegions(defects, plan);
  assert.deepEqual(regions[0].beatIds, ["m1_s1", "m1_s3"], "must exclude the untouched m1_s2 and be ordered by sequenceIndex");
});

test("mergeSemanticBindingRepairIntoPlan: switching to PROGRAMMATIC_GRAPHIC clears all entity tags and the stale pacing-cap marker", () => {
  const plan = { visualBeats: [beat({ id: "b1", sourceMacroBeatId: "m1", subject: "ent_hero", primaryEntityIds: ["ent_hero"], graphicClusterCapped: true, graphicReason: "stale reason" })] };
  const region = { regionId: "r1", macroSequenceIds: ["m1"], beatIds: ["b1"], reason: "test" };
  const repaired = [{ beatId: "b1", narrationMeaning: "m", renderMethod: "PROGRAMMATIC_GRAPHIC", focalEntityId: null, displaySubject: "A checklist graphic", visualType: "PROGRAMMATIC_GRAPHIC" }];
  const { plan: next, changedCount } = mergeSemanticBindingRepairIntoPlan(plan, region, repaired, "src");
  assert.equal(changedCount, 1);
  const changed = next.visualBeats[0];
  assert.equal(changed.renderMethod, "PROGRAMMATIC_GRAPHIC");
  assert.deepEqual(changed.primaryEntityIds, []);
  assert.deepEqual(changed.entities, []);
  assert.equal(changed.graphicClusterCapped, false);
  assert.equal(changed.graphicReason, null);
  assert.equal(changed.subject, "A checklist graphic");
});

test("mergeSemanticBindingRepairIntoPlan: switching to GENERATE with a chosen entity rebuilds entity tags consistently, never leaves a stale unrelated entity", () => {
  const plan = { visualBeats: [beat({ id: "b1", sourceMacroBeatId: "m1", subject: "ent_old", primaryEntityIds: ["ent_old", "ent_hero"] })] };
  const region = { regionId: "r1", macroSequenceIds: ["m1"], beatIds: ["b1"], reason: "test" };
  const repaired = [{ beatId: "b1", narrationMeaning: "m", renderMethod: "GENERATE", focalEntityId: "ent_hero", displaySubject: "Hero Character", visualType: "STORY_ILLUSTRATION" }];
  const { plan: next } = mergeSemanticBindingRepairIntoPlan(plan, region, repaired, "src");
  const changed = next.visualBeats[0];
  assert.deepEqual(changed.primaryEntityIds, ["ent_hero"]);
  assert.ok(!JSON.stringify(changed).includes("ent_old"));
});

test("mergeSemanticBindingRepairIntoPlan: clears the stale contractVisualForm on every repaired beat, so this repair's own detector never re-flags an already-repaired beat forever (real non-convergence bug this fixes)", () => {
  const plan = { visualBeats: [beat({ id: "b1", sourceMacroBeatId: "m1", contractVisualForm: "TEXT_EMPHASIS", exactText: null })] };
  const region = { regionId: "r1", macroSequenceIds: ["m1"], beatIds: ["b1"], reason: "test" };
  const repaired = [{ beatId: "b1", narrationMeaning: "m", renderMethod: "GENERATE", focalEntityId: "ent_hero", displaySubject: "Hero Character", visualType: "STORY_ILLUSTRATION" }];
  const { plan: next } = mergeSemanticBindingRepairIntoPlan(plan, region, repaired, "src");
  assert.equal(next.visualBeats[0].contractVisualForm, null);
  // Re-running detection on the repaired beat must find NOTHING wrong —
  // proving the fix actually closes the non-convergence loop, not just
  // clearing a field cosmetically.
  const rescanned = detectSemanticBindingDefects({ entityRegistry: [entity({ id: "ent_hero" })], visualBeats: next.visualBeats });
  assert.deepEqual(rescanned, []);
});

test("buildSemanticBindingRepairSchema requires renderMethod and restricts it to GENERATE/PROGRAMMATIC_GRAPHIC", () => {
  const schema = buildSemanticBindingRepairSchema(["b1"]);
  const itemSchema = schema.properties.shots.items;
  assert.ok(itemSchema.required.includes("renderMethod"));
  assert.deepEqual(itemSchema.properties.renderMethod.enum, ["GENERATE", "PROGRAMMATIC_GRAPHIC"]);
});

test("buildSemanticBindingRepairInput scopes candidate entities to the shot's OWN macro only", () => {
  const plan = {
    entityRegistry: [entity({ id: "ent_a" }), entity({ id: "ent_b" })],
    visualSequences: [{ sourceMacroBeatId: "m1", primaryEntityIds: ["ent_a"], purpose: "p" }],
    visualBeats: [beat({ id: "b1", sourceMacroBeatId: "m1" })],
  };
  const region = { regionId: "r1", macroSequenceIds: ["m1"], beatIds: ["b1"], reason: "test" };
  const input = buildSemanticBindingRepairInput(region, plan, new Map(plan.entityRegistry.map((e) => [e.id, e])), new Map());
  assert.deepEqual(input.shots[0].candidateEntities.map((c) => c.id), ["ent_a"]);
});
