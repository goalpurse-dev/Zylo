import test from "node:test";
import assert from "node:assert/strict";
import { buildSceneCards } from "../src/pages/workspace/long-form/sceneCardModel.js";

// Part 5 (2026-09-15 "content grounding + UX" pass) — "if [an EDIT's promised
// visual delta] is not happening, escalate it to NEW SCENE". weakEditDelta is
// the pure derivation the scene modal uses to decide whether to offer "Try as
// New Scene" instead of (or alongside) plain Regenerate.

function beat(overrides = {}) {
  return { id: "b1", sequenceIndex: 1, chapterId: "c1", estimatedStartSeconds: 0, estimatedEndSeconds: 5, informationToCommunicate: "x", renderMethod: "EDIT", primaryEntityIds: [], supportingEntityIds: [], ...overrides };
}

test("an EDIT scene whose QA found visualDeltaSatisfied:false is flagged weakEditDelta", () => {
  const scene = { id: "s1", render_strategy: "EDIT", qa_result: { visualDeltaSatisfied: false, reasons: ["Near-identical to its source image (91% similar)."] } };
  const [card] = buildSceneCards([beat()], new Map(), new Map([["b1", scene]]), new Map());
  assert.equal(card.weakEditDelta, true);
});

test("an EDIT scene whose QA found visualDeltaSatisfied:true is NOT flagged", () => {
  const scene = { id: "s1", render_strategy: "EDIT", qa_result: { visualDeltaSatisfied: true } };
  const [card] = buildSceneCards([beat()], new Map(), new Map([["b1", scene]]), new Map());
  assert.equal(card.weakEditDelta, false);
});

test("a GENERATE scene is never flagged weakEditDelta even if visualDeltaSatisfied is somehow false", () => {
  const scene = { id: "s1", render_strategy: "GENERATE", qa_result: { visualDeltaSatisfied: false } };
  const [card] = buildSceneCards([beat({ renderMethod: "GENERATE" })], new Map(), new Map([["b1", scene]]), new Map());
  assert.equal(card.weakEditDelta, false);
});

test("an EDIT scene with no qa_result at all (not yet analyzed, e.g. REUSE/CROP/GRAPHIC or pending) is not flagged", () => {
  const scene = { id: "s1", render_strategy: "EDIT", qa_result: null };
  const [card] = buildSceneCards([beat()], new Map(), new Map([["b1", scene]]), new Map());
  assert.equal(card.weakEditDelta, false);
});

test("no scene row at all (not yet rendered) is not flagged", () => {
  const [card] = buildSceneCards([beat()], new Map(), new Map(), new Map());
  assert.equal(card.weakEditDelta, false);
});
