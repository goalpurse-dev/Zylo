import test from "node:test";
import assert from "node:assert/strict";
import { sequenceEpisode } from "../supabase/functions/_shared/visualDirectorReliability.js";

// 2026-09-23 "root-contract stabilization" pass — real Atlantis finding: a
// macro correctly scoped as a 7-beat "explainer" graphic run got 6 of its 7
// PROGRAMMATIC_GRAPHIC beats forced into raster GENERATE purely by the
// "no more than 2 consecutive graphics" pacing cap, with zero awareness of
// whether the resulting illustration had anything coherent to draw. Several
// of those beats had NO illustratable entity bound at all (their only
// candidate was a DIAGRAM_SUBJECT — a dialogue voice, a bullet-list concept
// — already excluded from `entities` by shotEntityIds) and a claim whose
// real content (a multi-item on-screen list) can never be conveyed by any
// single illustration without baking in forbidden text. Deliberately
// generic fixtures (no Atlantis names) — this is a content-shape/entity-
// binding fix, not a topic-specific patch.

function graphicBeat(overrides) {
  return { renderMethod: "PROGRAMMATIC_GRAPHIC", intentionalVisualComparison: false, visualType: "DIAGRAM", entities: [], locationId: null, ...overrides };
}

test("a PROGRAMMATIC_GRAPHIC beat with no illustratable entity and no location is NEVER pacing-downgraded, even past the normal 2-in-a-row cap", () => {
  const beats = Array.from({ length: 5 }, (_, i) => graphicBeat({ id: `b${i}`, sequenceIndex: i + 1 }));
  sequenceEpisode(beats);
  assert.ok(beats.every((b) => b.renderMethod === "PROGRAMMATIC_GRAPHIC"), "every beat with nothing illustratable to fall back to must stay a graphic");
});

test("a PROGRAMMATIC_GRAPHIC beat WITH a real illustratable entity still gets pacing-spaced normally (the existing behavior is preserved)", () => {
  const beats = Array.from({ length: 5 }, (_, i) => graphicBeat({ id: `b${i}`, sequenceIndex: i + 1, entities: ["ent_hero"] }));
  sequenceEpisode(beats);
  assert.equal(beats[0].renderMethod, "PROGRAMMATIC_GRAPHIC");
  assert.notEqual(beats[2].renderMethod, "PROGRAMMATIC_GRAPHIC", "the 3rd consecutive graphic should still be spaced out when a real subject exists");
});

test("a beat whose claim is inherently multi-fact graphic-shaped (contractVisualForm TEXT_EMPHASIS, no exactText reduction) never downgrades even with a real entity bound — the content itself cannot become one illustration", () => {
  const beats = Array.from({ length: 4 }, (_, i) => graphicBeat({ id: `b${i}`, sequenceIndex: i + 1, entities: ["ent_hero"], contractVisualForm: "TEXT_EMPHASIS", exactText: null }));
  sequenceEpisode(beats);
  assert.ok(beats.every((b) => b.renderMethod === "PROGRAMMATIC_GRAPHIC"), "a multi-fact TEXT_EMPHASIS claim with no single short label must never be forced into a raster illustration");
});

test("a genuine SHORT exact-text label (contractVisualForm + real exactText) still downgrades as before — the narrower, pre-existing 'move onto an overlay' case is preserved", () => {
  const beats = [graphicBeat({ id: "b0", sequenceIndex: 1, entities: ["ent_hero"], contractVisualForm: "NUMBER_EMPHASIS", exactText: "42" })];
  sequenceEpisode(beats);
  assert.equal(beats[0].renderMethod, "GENERATE");
});

test("a location-anchored beat (no entity, but a real locationId) counts as illustratable and can still be pacing-downgraded", () => {
  const beats = Array.from({ length: 5 }, (_, i) => graphicBeat({ id: `b${i}`, sequenceIndex: i + 1, locationId: "loc_harbor" }));
  sequenceEpisode(beats);
  assert.notEqual(beats[2].renderMethod, "PROGRAMMATIC_GRAPHIC");
});
