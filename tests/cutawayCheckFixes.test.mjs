// The check fixes of 2026-11-04 (phase 1, step 2): rigs may stand on other rigs and a floating rig is set down instead
// of failing the plan; the voice check no longer stops on British spellings, units said in full or "round"/"around";
// a failed check names the sentence, so only that line is said again (voice.mjs spliceLine).
import test from "node:test";
import assert from "node:assert/strict";
import { rigProblems } from "../scripts/cutaway/proto3d/m2/rig.js";
import { compareWords, badSentences } from "../scripts/cutaway/proto3d/m2/voiceCheck.mjs";
import { sentenceSpans } from "../scripts/cutaway/proto3d/m2/voice.mjs";

const box = (id, pos, size) => ({ id, kind: "rig", params: { name: id, pos, nodes: [{ id: "n", at: [0, 0, 0], shapes: [{ shape: "box", size, at: [0, size[1] / 2, 0] }] }] } });

test("a rig standing on another rig is on the floor (the cart on the ancient bridge deck)", () => {
  const deck = box("deck", [0, 0, 0], [8, 4.2, 2]), cart = box("cart", [0, 4.2, 0], [1.4, 1, 0.9]);
  const deckBox = { min: [-4, 0, -1], max: [4, 4.2, 1] };
  assert.equal(rigProblems(cart, { floor: 0, supports: [deckBox] }).some((p) => /not on the floor/.test(p)), false);
  assert.equal(rigProblems(cart, { floor: 0, supports: [] }).some((p) => /not on the floor/.test(p)), true, "with nothing under it, it floats");
  assert.equal(rigProblems(deck, { floor: 0 }).some((p) => /not on the floor/.test(p)), false);
});

test("voice check: the false alarms of the fish and bridge videos pass, real mistakes still fail", () => {
  const ok = [
    ["A meter of water fills the centre, 6 centimetres a day.", "A metre of water fills the center, 6 centimeters a day."],
    ["Pile rocks round the pond.", "Pile rocks around the pond."],
    ["Keep it above about 0.02 mg of ammonia.", "Keep it above about 0.02 milligrams of ammonia."],
    ["Bacteria start nitrifying the water.", "Bacteria start nutrifying the water."],
    ["The colour turns grey.", "The color turns gray."],
  ];
  for (const [a, b] of ok) assert.equal(compareWords(a, b).ok, true, a);
  for (const [a, b] of [["The pit fills up fast.", "The pot fills up fast."], ["It holds 1952 litres.", "It holds 1950 liters."], ["A car stops.", "A car, car stops."]]) assert.equal(compareWords(a, b).ok, false, a);
});

test("voice check: a problem names its sentence; a whole-take problem asks for a whole new take", () => {
  const S = ["If you dig a hole, you have a pond.", "But the water turns green.", "So you add a pump."];
  const r = compareWords(S.join(" "), "If you dig a hole, you have a pond. But the water turns brown. So you add a pump.");
  assert.equal(r.ok, false);
  assert.deepEqual(badSentences(S, S.join(" "), r.spots), [1]);
  assert.equal(badSentences(S, S.join(" "), [null]), null);
});

test("voice splice: sentence spans follow the take's words, and refuse a take that doesn't match", () => {
  const S = ["If you dig a hole, you have a pond.", "But it turns green."];
  const words = "If you dig a hole, you have a pond. But it turns green.".split(" ").map((w, i) => ({ w, s: i * 0.3, e: i * 0.3 + 0.25 }));
  assert.deepEqual(sentenceSpans(S, words), [[0, 8], [9, 12]]);
  assert.equal(sentenceSpans(S, words.slice(1)), null);
});
