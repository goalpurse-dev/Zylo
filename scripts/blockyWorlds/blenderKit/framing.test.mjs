// node --test scripts/blockyWorlds/blenderKit/framing.test.mjs   (free: THE FRAMING RULES, owner 2026-11-18)
import test from "node:test";
import assert from "node:assert/strict";
import { framingPlanProblems, facesSeenProblems, FRAMING_RULES, MIX, SHOT_SIZES, SHOT_MOVES } from "./director.mjs";
import { classify, renderGate } from "./renderGate.mjs";
import { pickTwist } from "../../../supabase/functions/_shared/blockyWorlds/craft.js";

// a 60 s plan of 40 shots: the mix, angles, moves, a twist dolly zoom, a 5 s hold at the twist, a faster end
const SIZES = ["wide", "close", "medium", "insert", "reaction", "close", "medium", "wide", "close", "medium"];
const ANGLES = ["eye", "low", "eye", "top", "high", "eye", "low", "eye", "high", "eye"];
const MOVES = ["push_slow", "push_fast", "track", "orbit", "whip", "push_slow", "handheld", "crash", "track", "orbit"];
function plan() {
  const words = [], shots = [];
  let t = 0;
  for (let i = 0; i < 40; i++) {
    const d = i === 24 ? 5 : i >= 34 ? 0.8 : 1.4;
    shots.push({ id: i + 1, w0: words.length, size: SIZES[i % 10], angle: ANGLES[i % 10], move: i === 24 ? "dolly_zoom" : i === 39 ? "pull_slow" : MOVES[i % 10], location: ["room", "street", "shop", "park", "school"][Math.floor(i / 8)], desc: i === 0 ? "a big sign: the nose rule" : "Mo and the nose" });
    const n = Math.max(1, Math.round(d / 0.4));
    for (let k = 0; k < n; k++) { words.push({ start: t, end: t + 0.35 }); t += d / n; }
  }
  return { shots, words };
}

test("framing: a plan with the owner's mix, angles, moves, hold and sign passes", () => {
  const { shots, words } = plan();
  assert.deepEqual(framingPlanProblems({ shots, rule_object: "the nose", twist_shot: 25 }, 60, { words, twistMove: "dolly_zoom" }), []);
  assert.ok(SHOT_SIZES.includes("insert") && SHOT_MOVES.includes("dolly_zoom") && SHOT_MOVES.includes("rack_focus"));
  assert.equal(FRAMING_RULES.length, 9);
  assert.equal(MIX.closeMin, 0.25); assert.equal(MIX.offEyeMin, 0.35); assert.equal(MIX.faceMin, 0.6);
});

test("framing: the mix, eye level, one move type, the end, the twist move, setups, the sign and the rule object", () => {
  const { words } = plan();
  const flat = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, w0: i * 2, size: "medium", angle: "eye", move: "track", location: "room", desc: "Mo talks" }));
  const p = framingPlanProblems({ shots: flat, rule_object: "", twist_shot: 20 }, 60, { words, twistMove: "rack_focus" });
  for (const re of [/the shot mix is off: close-ups 0%.*medium 100%/, /only 0% of the shots are off eye level/, /track is 100% of the moves/, /end on a slow pull-out/, /twist shot 20 moves "track": give it a rack focus/, /same setup .* more than 2 times/, /shot 1 does not show the rule as a sign/, /no rule_object/]) assert.ok(p.some((x) => re.test(x)), `${re}: ${p.join(" | ")}`);
});

test("framing: no hold at the twist or the ending, and an end paced like the rest, are flagged", () => {
  const { shots, words } = plan();
  const even = Array.from({ length: 160 }, (_, i) => ({ start: i * 0.375, end: i * 0.375 + 0.3 }));
  const p = framingPlanProblems({ shots: shots.map((s, i) => ({ ...s, w0: i * 4 })), rule_object: "the nose", twist_shot: 25 }, 60, { words: even, twistMove: "dolly_zoom" });
  assert.ok(p.some((x) => /no hold of 4-6 s/.test(x)), p.join(" | "));
  assert.ok(p.some((x) => /last 15 s are paced like the rest/.test(x)), p.join(" | "));
  assert.equal(words.length > 0, true);
});

test("faces as seen: key shots without a face and the 60% share go to the fix rounds, never the render gate", () => {
  const shots = [{ id: 1, key: true }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5, size: "insert" }];
  const out = facesSeenProblems({ shots, faces: { 1: false, 2: false, 3: true, 4: false, 5: false } });
  assert.match(out[1], /^FRAMING: a key line without a readable face/);
  assert.equal(Object.keys(out).length, 2, JSON.stringify(out));
  assert.ok(!out[5], "an insert never needs a face");
  assert.equal(classify({ kind: "vision", text: out[1] }), "ignore");
  assert.equal(classify({ kind: "vision", text: `${out[1]}; the frame is black` }), "cut");
  assert.equal(classify({ kind: "vision", text: `the hero is tiny; ${out[2]}` }), "weak");
  const g = renderGate({ shots: Array.from({ length: 10 }, (_, i) => ({ id: i + 1 })), failing: { 1: { kind: "vision", text: out[1] }, 2: { kind: "vision", text: out[2] } } });
  assert.equal(g.ok, true); assert.deepEqual(g.weak, []);
});

test("the twist shot's move alternates between a user's videos", () => {
  assert.equal(pickTwist([]).move, "dolly_zoom");
  assert.equal(pickTwist([{ twistFamily: "T1", twistPct: 60, twistMove: "dolly_zoom" }]).move, "rack_focus");
  assert.equal(pickTwist([{ twistFamily: "T1", twistPct: 60, twistMove: "rack_focus" }]).move, "dolly_zoom");
});
