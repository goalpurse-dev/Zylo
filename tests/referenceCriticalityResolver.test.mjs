import test from "node:test";
import assert from "node:assert/strict";
import { resolveReferenceCriticality, selectMinimalReferenceSet } from "../supabase/functions/_shared/sceneRenderPlan.ts";

// Section 14 (2026-09-15 "rebuild the Visual Director" pass) — Reference
// Resolver. Real incident this fixes: "a real final scene literally showed
// the CHARACTER REFERENCE SHEET" — root cause was always bundling every
// canonical reference a beat COULD use into one collage whenever the count
// exceeded the renderer's slot limit, regardless of how critical each
// reference actually was. These tests lock in the fix: choose the minimum
// necessary references, never pad or blindly bundle everything.

function registry(entries) {
  return new Map(entries.map((e) => [e.id, e]));
}

test("resolveReferenceCriticality prefers the contract claim's own entityRequirements over the deterministic default", () => {
  const reg = registry([{ id: "e1", name: "Protagonist", category: "CHARACTER", importance: "HERO" }]);
  const lookups = [{ entityId: "e1", angle: "character_reference_sheet" }];
  const claim = { entityRequirements: [{ entity: "protagonist", criticality: "EXACT" }] };
  const result = resolveReferenceCriticality(lookups, reg, claim);
  assert.equal(result[0].criticality, "EXACT");
});

test("resolveReferenceCriticality falls back to a HERO->HIGH / RECURRING->MEDIUM default when no claim covers this entity", () => {
  const reg = registry([
    { id: "hero", name: "Hero", category: "CHARACTER", importance: "HERO" },
    { id: "side", name: "Technician", category: "CHARACTER", importance: "RECURRING" },
  ]);
  const lookups = [{ entityId: "hero", angle: "a" }, { entityId: "side", angle: "b" }];
  const result = resolveReferenceCriticality(lookups, reg, null);
  assert.equal(result.find((r) => r.entityId === "hero").criticality, "HIGH");
  assert.equal(result.find((r) => r.entityId === "side").criticality, "MEDIUM");
});

test("example from the task: protagonist close-up (character EXACT, location LOW, tablet NONE)", () => {
  const reg = registry([
    { id: "protagonist", name: "Protagonist", category: "CHARACTER", importance: "HERO" },
    { id: "habitat", name: "Habitat", category: "LOCATION" },
    { id: "tablet", name: "Tablet", category: "IMPORTANT_OBJECT" },
  ]);
  const lookups = [{ entityId: "protagonist", angle: "a" }, { entityId: "habitat", angle: "b" }, { entityId: "tablet", angle: "c" }];
  const claim = { entityRequirements: [{ entity: "protagonist", criticality: "EXACT" }, { entity: "habitat", criticality: "LOW" }, { entity: "tablet", criticality: "NONE" }] };
  const result = resolveReferenceCriticality(lookups, reg, claim);
  assert.equal(result.find((r) => r.entityId === "protagonist").criticality, "EXACT");
  assert.equal(result.find((r) => r.entityId === "habitat").criticality, "LOW");
  assert.equal(result.find((r) => r.entityId === "tablet").criticality, "NONE");
});

/* selectMinimalReferenceSet */
test("when everything fits the renderer's slot limit, nothing is dropped and no multi-reference flag is raised", () => {
  const list = [{ entityId: "a", angle: "x", criticality: "HIGH" }];
  const result = selectMinimalReferenceSet(list, 1);
  assert.equal(result.selected.length, 1);
  assert.equal(result.droppedForCapacity.length, 0);
  assert.equal(result.wouldBenefitFromMultiReference, false);
});

test("example from the task: tablet close-up (tablet HIGH, character LOW, location LOW) with a 1-slot renderer sends ONLY the tablet, no collage needed", () => {
  const list = [
    { entityId: "tablet", angle: "a", criticality: "HIGH" },
    { entityId: "protagonist", angle: "b", criticality: "LOW" },
    { entityId: "habitat", angle: "c", criticality: "LOW" },
  ];
  const result = selectMinimalReferenceSet(list, 1);
  assert.deepEqual(result.selected.map((r) => r.entityId), ["tablet"]);
  assert.equal(result.wouldBenefitFromMultiReference, false, "the critical set (1) fits the slot limit (1) — no collage, no multi-ref need");
});

test("two independently HIGH/EXACT references exceeding a 1-slot renderer flags wouldBenefitFromMultiReference — this is Section 15's real routing signal", () => {
  const list = [
    { entityId: "hero1", angle: "a", criticality: "EXACT" },
    { entityId: "hero2", angle: "b", criticality: "HIGH" },
    { entityId: "location", angle: "c", criticality: "LOW" },
  ];
  const result = selectMinimalReferenceSet(list, 1);
  assert.equal(result.wouldBenefitFromMultiReference, true);
  assert.equal(result.selected.length, 1, "capped to the renderer's real limit even though 2 are truly critical");
  assert.equal(result.selected[0].entityId, "hero1", "EXACT outranks HIGH when forced to choose");
});

test("a renderer with real multi-reference capacity (e.g. Seedream, 14 slots) never needs to drop anything for a normal beat", () => {
  const list = [
    { entityId: "hero1", angle: "a", criticality: "EXACT" },
    { entityId: "hero2", angle: "b", criticality: "HIGH" },
    { entityId: "location", angle: "c", criticality: "LOW" },
  ];
  const result = selectMinimalReferenceSet(list, 14);
  assert.equal(result.selected.length, 3);
  assert.equal(result.wouldBenefitFromMultiReference, false);
});

test("low-criticality references are dropped from the image set (not padded in) even when slots would technically be free after taking the critical ones", () => {
  // 1 HIGH + 3 LOW, slot limit 3: the critical set (1) fits well within 3,
  // so per Section 14 ("choose the MINIMUM necessary references") the LOW
  // ones are still dropped rather than padded in just because slots exist.
  const list = [
    { entityId: "hero", angle: "a", criticality: "HIGH" },
    { entityId: "l1", angle: "b", criticality: "LOW" },
    { entityId: "l2", angle: "c", criticality: "LOW" },
    { entityId: "l3", angle: "d", criticality: "LOW" },
  ];
  const result = selectMinimalReferenceSet(list, 3);
  assert.deepEqual(result.selected.map((r) => r.entityId), ["hero"]);
  assert.equal(result.droppedForCapacity.length, 3);
});
