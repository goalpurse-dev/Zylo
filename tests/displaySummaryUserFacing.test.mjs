import test from "node:test";
import assert from "node:assert/strict";
import { deriveDisplaySummary, buildSceneCards } from "../src/pages/workspace/long-form/sceneCardModel.js";

// 2026-09-22 "FINAL stabilization pass" §16 — real Atlantis finding: cards
// exposed internal planning wording verbatim, e.g. "Help the viewer
// understand this exact narration moment (Return to the subject...)" —
// visualShotPlanning.js's own deterministic shotPurpose TEMPLATE, never an
// authored user-facing description. The full fix (a short LLM-authored
// displaySummary) is deferred — the Scene Director call it would hook into
// (runSceneDirector) is dead code, never invoked in the live pipeline, and
// wiring a new model call wasn't authorized in this scoped pass. What's
// fixed: the known internal-wrapper shape is never shown verbatim.
//
// 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
// the fallback used composition.focalSubject (a RAW value — often a literal
// entity id like "ent_timaeus") and templated "A visual of ent_timaeus." —
// exactly the internal-id leak and lazy phrasing the user explicitly asked
// to be removed. Now reads displaySubject (already human-readable) and
// never uses the "A visual of..." template; also strips any raw id-shaped
// token defensively, and caps overlong text to a readable card length.

function beat(overrides) {
  return { id: "b1", informationToCommunicate: "x", ...overrides };
}

test("§16: a normal, non-wrapper informationToCommunicate string passes through unchanged", () => {
  assert.equal(deriveDisplaySummary(beat({ informationToCommunicate: "A quiet harbor at dawn." }), null), "A quiet harbor at dawn.");
});

test("§16: the known internal shotPurpose wrapper is NEVER shown verbatim to the user", () => {
  const raw = "Help the viewer understand this exact narration moment (Return to the subject established earlier).";
  const result = deriveDisplaySummary(beat({ informationToCommunicate: raw }), { composition: { displaySubject: "the harbor" } });
  assert.doesNotMatch(result, /Help the viewer/i);
  assert.doesNotMatch(result, /^A visual of/i, "the 'A visual of...' template must never be used");
  assert.match(result, /the harbor/);
});

test("§16: a wrapper with no compiled displaySubject available still falls back to a plain, honest phrase — never a blank card or raw internal text", () => {
  const raw = "Help the viewer understand this exact narration moment (Establish the subject).";
  const result = deriveDisplaySummary(beat({ informationToCommunicate: raw }), null);
  assert.equal(result, "Visual for this moment in the story.");
});

test("§16: an empty/missing informationToCommunicate also falls back cleanly rather than rendering an empty card", () => {
  const result = deriveDisplaySummary(beat({ informationToCommunicate: "" }), { composition: { displaySubject: "Some Landmark" } });
  assert.doesNotMatch(result, /^A visual of/i);
  assert.match(result, /Some Landmark/);
});

test("§16: buildSceneCards wires the fixed description through end to end", () => {
  const beats = [beat({ informationToCommunicate: "Help the viewer understand this exact narration moment (foo)." })];
  const plans = new Map([["b1", { composition: { displaySubject: "the ancient scroll" } }]]);
  const cards = buildSceneCards(beats, new Map(), new Map(), plans);
  assert.doesNotMatch(cards[0].description, /^A visual of/i);
  assert.match(cards[0].description, /the ancient scroll/);
});

// 2026-09-23 "root-contract stabilization" pass — new coverage.
test("a raw entity-id-shaped token is stripped from the summary even if it somehow slips through from either source (defense in depth)", () => {
  const result = deriveDisplaySummary(beat({ informationToCommunicate: "ent_timaeus explains the point to the audience." }), null);
  assert.doesNotMatch(result, /\bent_timaeus\b/);
});

test("a raw entity id in the fallback's displaySubject is also stripped defensively", () => {
  const result = deriveDisplaySummary(beat({ informationToCommunicate: "" }), { composition: { displaySubject: "ent_timaeus" } });
  assert.doesNotMatch(result, /\bent_timaeus\b/);
  assert.equal(result, "Visual for this moment in the story.");
});

test("an overlong informationToCommunicate is capped to a readable card length, never dumping a full paragraph onto the card", () => {
  const longText = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ") + ".";
  const result = deriveDisplaySummary(beat({ informationToCommunicate: longText }), null);
  assert.ok(result.split(/\s+/).length <= 15, "must be capped to roughly 14 words plus an ellipsis marker");
});

// 2026-09-23 "systemic production stabilization" pass, Item D — real
// Atlantis finding: "Operational checklist graphic appears in this scene."
// was the ENTIRE description shown for every PROGRAMMATIC_GRAPHIC beat,
// regardless of what the graphic actually contained. Now derives a specific,
// deterministic sentence from the compiled overlay_spec (Item B made this
// genuinely per-beat, so each sibling graphic gets its own honest summary).
test("Item D: a BULLET_LIST graphic describes its actual item count and subject, never a generic 'graphic appears' phrase", () => {
  const b = beat({ informationToCommunicate: "", renderMethod: "PROGRAMMATIC_GRAPHIC" });
  const plan = { composition: { displaySubject: "Plato's account" }, overlay_spec: { template: "BULLET_LIST", items: [{ icon: "generic", text: "a" }, { icon: "generic", text: "b" }, { icon: "generic", text: "c" }] } };
  const result = deriveDisplaySummary(b, plan);
  assert.match(result, /Three key details about Plato's account/);
  assert.doesNotMatch(result, /appears in this scene/);
});

test("Item D: a COMPARISON graphic names both sides being compared", () => {
  const b = beat({ informationToCommunicate: "", renderMethod: "PROGRAMMATIC_GRAPHIC" });
  const plan = { composition: { displaySubject: "the two mechanisms" }, overlay_spec: { template: "COMPARISON", leftLabel: "Sonar scan", rightLabel: "Satellite photo" } };
  const result = deriveDisplaySummary(b, plan);
  assert.equal(result, "Sonar scan and Satellite photo are compared side by side.");
});

test("Item D: an unrecognized/empty overlay_spec falls back to the honest subject-appears phrase, never a crash or blank card", () => {
  const b = beat({ informationToCommunicate: "", renderMethod: "PROGRAMMATIC_GRAPHIC" });
  const plan = { composition: { displaySubject: "the topic" }, overlay_spec: { template: "TEXT_EMPHASIS", text: "SOMETHING" } };
  const result = deriveDisplaySummary(b, plan);
  assert.equal(result, "the topic appears in this scene.");
});

test("Item D: a real, substantial visualDelta is preferred over the generic subject-appears fallback for a non-graphic beat", () => {
  const b = beat({ informationToCommunicate: "", renderMethod: "GENERATE", visualDelta: "The scroll unrolls to reveal a hidden map." });
  const result = deriveDisplaySummary(b, { composition: { displaySubject: "the scroll" } });
  assert.equal(result, "The scroll unrolls to reveal a hidden map.");
});

test("Item D: the legacy hydration templates ('Establish X.' / 'Change the visual...') are never shown verbatim as if they were a real description", () => {
  const b1 = beat({ informationToCommunicate: "", renderMethod: "GENERATE", visualDelta: "Establish the harbor." });
  assert.equal(deriveDisplaySummary(b1, { composition: { displaySubject: "the harbor" } }), "the harbor appears in this scene.");
  const b2 = beat({ informationToCommunicate: "", renderMethod: "GENERATE", visualDelta: "Change the visual to the new action or state described now." });
  assert.equal(deriveDisplaySummary(b2, { composition: { displaySubject: "the harbor" } }), "the harbor appears in this scene.");
});
