// The owner's rules of 2026-11-05, for every topic: every event word happens on screen, never a still moment, and the
// "Add ..." line adds its things one by one on their own words, all over before "Congratulations".
import test from "node:test";
import assert from "node:assert/strict";
import { storyFx, motionGaps } from "../scripts/cutaway/proto3d/m2/storyFx.js";
import { compile } from "../scripts/cutaway/proto3d/m2/compile.mjs";
import { draftWords } from "../scripts/cutaway/proto3d/m2/plan.js";

const S = (role, text) => ({ role, text });
const yard = (beats, parts = []) => ({ key: "story_test", codeShots: true, world: { cut: { x0: -5, x1: 5, z0: -6, depth: 4 } }, parts: [{ id: "light", kind: "light", params: { storm: false } }, { id: "dig", kind: "dig", params: { mound: { x: 8, z: -4, rx: 1.5, rz: 1.2, h: 0.8 } } }, ...parts], beats });

test("an event word with nothing on screen gets its effect there; one already shown, or said as not happening, does not", () => {
  const L = yard([{ s: "hook", do: [{ p: "dig", v: "dig", w: "dig" }], shows: { p: "dig" } }, { s: "problem", do: [{ p: "light", v: "storm", w: "But" }], shows: { p: "dig" } }]);
  const r = storyFx(L, [S("hook", "If you dig a hole, you have a bunker."), S("problem", "But a blast sends fallout drifting down.")]);
  assert.equal(r.stats.events, 1);
  const fx = L.parts.find((p) => p.kind === "fx");
  assert.equal(fx.params.type, "blast");
  assert.ok(L.beats[1].do.some((a) => a.p === fx.id && a.v === "go" && a.w === "blast"));
  // idempotent: a second compile does not add another
  storyFx(L, [S("hook", "If you dig a hole, you have a bunker."), S("problem", "But a blast sends fallout drifting down.")]);
  assert.equal(L.parts.filter((p) => p.kind === "fx").length, 1);
  const N = yard([{ s: "myth", do: [], shows: { p: "dig" } }]);
  assert.equal(storyFx(N, [S("myth", "That flame is not garbage burning.")]).stats.events, 0);
});

test("the Add line: each thing on the word that names it (lamp = light), its lead dropped, a gauge shown for a moment not counted", () => {
  const L = yard([{ s: "finish", shows: { p: "stairs" }, do: [{ p: "decay", v: "show", w: "Add" }, { p: "decay", v: "hide", w: "Add" }, { p: "stairs", v: "show", w: "stairs" }, { p: "lamp", v: "show", w: "Add" }, { p: "capGrass", v: "show", w: "grass", o: -0.7 }] }],
    [{ id: "decay", kind: "counter", params: {} }, { id: "stairs", kind: "boxPop", params: {} }, { id: "lamp", kind: "boxPop", params: {} }, { id: "capGrass", kind: "boxPop", params: {} }]);
  storyFx(L, [S("finish", "Add stairs, a ceiling light and grass back on top.")]);
  const w = Object.fromEntries(L.beats[0].do.filter((a) => a.v === "show").map((a) => [a.p, [a.w, a.o]]));
  assert.deepEqual(w.stairs, ["stairs", undefined]); assert.deepEqual(w.lamp, ["light", undefined]); assert.deepEqual(w.capGrass, ["grass", undefined]);
  assert.equal(w.decay[0], "Add");
});

test("never a still moment: a planned video's gaps over 2.5 s are filled, and nothing of the Add line runs into Congratulations", () => {
  const sentences = [S("hook", "If you dig a hole in your yard, you have a pit."), S("problem", "But the hole just sits there and nothing at all happens to it for a long long while."), S("finish", "Add a bench."), S("congrats", "Congratulations, you have built a pit.")];
  const L = yard([{ s: "hook", do: [{ p: "dig", v: "dig", w: "dig" }], shows: { p: "dig" }, shots: [{ focus: ["dig"] }] }, { s: "problem", do: [], shows: { p: "dig" }, shots: [{ focus: ["dig"] }] }, { s: "finish", do: [{ p: "bench", v: "pop", w: "bench" }], shows: { p: "bench" }, shots: [{ focus: ["dig", "bench"] }] }, { s: "congrats", do: [], shots: [{ focus: ["dig"] }] }],
    [{ id: "bench", kind: "boxPop", params: { size: [1, 0.5, 0.4], pos: [6, 0.25, -1] } }]);
  const words = draftWords(sentences), roles = sentences.map((s) => s.role);
  const tl = compile(L, words, words.at(-1).e + 0.1, { roles });
  assert.ok(tl.story.gaps >= 1);
  assert.equal(motionGaps(L, tl.tracks, tl.sentences, { from: tl.sentences[0].t0, to: tl.sentences.at(-1).t1 }).length, 0);
  const con = tl.sentences.find((s) => s.role === "congrats");
  for (const tr of Object.values(tl.tracks)) for (const r of tr.ramps) if (r.s === "finish") assert.ok(r.t1 <= con.t0, JSON.stringify(r));
});
