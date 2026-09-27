import test from "node:test";
import assert from "node:assert/strict";
import { requiredReferenceLookups } from "../supabase/functions/_shared/sceneRenderPlan.ts";

// 2026-09-22 "FINAL stabilization pass" §6 — real Atlantis finding: a
// Visual World had a READY canonical reference for entity_id
// "Gibraltar_region" (asset succeeded), yet scene plans whose focal subject
// WAS that landmark ("Pillars of Heracles") compiled with
// reference_asset_ids=[]. Root cause: requiredReferenceLookups only ever
// looked at CHARACTER and IMPORTANT_OBJECT/VEHICLE_MACHINE entities in
// primaryEntityIds/supportingEntityIds — a LOCATION-category entity
// referenced as the shot's own SUBJECT (as opposed to beat.locationId, the
// beat's "set", handled separately by the caller with a camera-anchor-aware
// angle) was never looked up at all, regardless of how correctly it was
// tagged upstream by stable entity id. These tests are deliberately generic
// (no Atlantis/Gibraltar-specific string anywhere in the source fix) — they
// prove the routing works off entity CATEGORY + referenceNeeded, never
// free-text subject matching.

function registry(entries) {
  return new Map(entries.map((e) => [e.id, e]));
}

test("§6: a LOCATION-category entity referenced as a beat's SUBJECT (not its set) is looked up when referenceNeeded is true", () => {
  const reg = registry([{ id: "landmark_1", name: "Some Landmark", category: "LOCATION", referenceNeeded: true }]);
  const beat = { renderMethod: "GENERATE", primaryEntityIds: ["landmark_1"], supportingEntityIds: [] };
  const lookups = requiredReferenceLookups(beat, reg);
  assert.deepEqual(lookups, [{ entityId: "landmark_1", angle: "wide_establishing" }]);
});

test("§6: a subject LOCATION with referenceNeeded:false is never forced into the lookup set (legitimate Visual Director decision, not a bug)", () => {
  const reg = registry([{ id: "landmark_1", name: "Some Landmark", category: "LOCATION", referenceNeeded: false }]);
  const beat = { renderMethod: "GENERATE", primaryEntityIds: ["landmark_1"], supportingEntityIds: [] };
  assert.deepEqual(requiredReferenceLookups(beat, reg), []);
});

test("§6: the beat's own set location (beat.locationId) is excluded here — the caller (episodePreflight.ts) already resolves it with a camera-anchor-aware angle, and must not receive a second, differently-angled lookup for the same entity", () => {
  const reg = registry([{ id: "set_a", name: "Set A", category: "LOCATION", referenceNeeded: true }]);
  const beat = { renderMethod: "GENERATE", locationId: "set_a", primaryEntityIds: ["set_a"], supportingEntityIds: [] };
  assert.deepEqual(requiredReferenceLookups(beat, reg), [], "set_a is beat.locationId, so it must not be double-booked as a subject lookup too");
});

test("§6: a subject LOCATION coexists with a HERO character in the same lookup set — both stable-entity-id routed, no string matching involved", () => {
  const reg = registry([
    { id: "hero_1", name: "Hero", category: "CHARACTER", importance: "HERO" },
    { id: "landmark_1", name: "Some Landmark", category: "LOCATION", referenceNeeded: true },
  ]);
  const beat = { renderMethod: "GENERATE", primaryEntityIds: ["hero_1", "landmark_1"], supportingEntityIds: [], shotSize: "WIDE" };
  const lookups = requiredReferenceLookups(beat, reg);
  assert.equal(lookups.length, 2);
  assert.ok(lookups.some((l) => l.entityId === "hero_1"));
  assert.ok(lookups.some((l) => l.entityId === "landmark_1" && l.angle === "wide_establishing"));
});

test("§6: REUSE/CROP/COMPOSITE/PROGRAMMATIC_GRAPHIC beats never request a fresh subject-location lookup — they condition on the source scene, exactly like the existing character/object rule", () => {
  const reg = registry([{ id: "landmark_1", name: "Some Landmark", category: "LOCATION", referenceNeeded: true }]);
  const beat = { renderMethod: "REUSE", primaryEntityIds: ["landmark_1"], supportingEntityIds: [] };
  assert.deepEqual(requiredReferenceLookups(beat, reg), []);
});
