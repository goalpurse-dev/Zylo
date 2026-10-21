import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { EASES, channelValue, resolveAnchor, sentencesOf, rampValue } from "../scripts/cutaway/proto3d/m2/curves.js";
import { compile, marksFor, END } from "../scripts/cutaway/proto3d/m2/compile.mjs";
import { validateLayout } from "../scripts/cutaway/proto3d/m2/format.js";
import { KINDS, KIND_CHANNELS } from "../scripts/cutaway/proto3d/m2/parts.js";
import { MATERIAL_NAMES } from "../scripts/cutaway/proto3d/m2/materials.js";
import { span, eOut, eIn, eInOut, pop } from "../scripts/cutaway/proto3d/kit/verbs.js";

const L = (k) => JSON.parse(readFileSync(new URL(`../scripts/cutaway/proto3d/m2/layouts/${k}.json`, import.meta.url), "utf8"));
const WORDS = [
  { w: "If", s: 0, e: 0.2 }, { w: "you", s: 0.2, e: 0.4 }, { w: "dig", s: 0.4, e: 0.7 }, { w: "a", s: 0.7, e: 0.8 }, { w: "hole.", s: 0.8, e: 1.2 },
  { w: "But", s: 1.5, e: 1.7 }, { w: "it", s: 1.7, e: 1.8 }, { w: "floods.", s: 1.8, e: 2.3 }, { w: "So", s: 2.6, e: 2.8 }, { w: "dig", s: 2.8, e: 3.1 }, { w: "deeper.", s: 3.1, e: 3.6 },
];
const tiny = () => ({
  key: "tiny", parts: [{ id: "cut", kind: "dig", params: { mound: { x: 4, z: -4 } } }, { id: "sign", kind: "sign", params: { at: [0, 0, -2] } }],
  cues: [{ p: "cut", c: "dig", a: { w: "dig", o: 0.02 }, b: { w: "dig", o: 1 } }, { p: "sign", c: "pop", a: { mark: "signPop" } }],
  camera: { keys: [{ at: { abs: 0 }, pos: [10, 10, 30], tgt: [0, 0, -4] }, { at: { mark: "lengthEnd" }, pos: [12, 12, 34], tgt: [0, 0, -4] }] },
});

test("m2 easings match the kit verbs", () => {
  for (const u of [0, 0.1, 0.37, 0.5, 0.81, 1]) {
    assert.equal(EASES.out(u), eOut(u)); assert.equal(EASES.in2(u), eIn(u)); assert.equal(EASES.inOut(u), eInOut(u));
  }
  assert.equal(EASES.bump(0.5), 1); assert.equal(EASES.step(0), 0); assert.equal(EASES.step(0.01), 1);
});

test("m2 a channel is its base plus its ramps; a ramp with no length is a step", () => {
  const tr = { base: -40, ramps: [{ t0: 0, t1: 1, amp: 27.4, e: "out" }, { t0: 3, t1: 5, amp: -36, e: "inOut" }] };
  for (const t of [0, 0.4, 1, 2, 3.7, 6]) assert.ok(Math.abs(channelValue(tr, t) - (-40 + 27.4 * eOut(span(t, 0, 1)) - 36 * eInOut(span(t, 3, 5)))) < 1e-12);
  assert.equal(rampValue({ t0: 2, t1: 2, amp: -1, e: "step" }, 1.99), 0);
  assert.equal(rampValue({ t0: 2, t1: 2, amp: -1, e: "step" }, 2), -1);
  // a back ramp is the kit's pop
  for (const t of [0.9, 1.05, 1.2, 1.5]) assert.equal(rampValue({ t0: 1, t1: 1.4, amp: 1, e: "back" }, t), pop(t, 1, 0.4));
  // a shift moves the cue later (staggered fence posts)
  assert.equal(channelValue({ base: 0, ramps: [{ t0: 1, t1: 2, amp: 1, e: "lin" }] }, 1.5, 0.25), 0.25);
});

test("m2 anchors: nth word, punctuation, exact match, marks, offsets", () => {
  const ctx = { words: WORDS, marks: { signPop: 4, lengthEnd: 6.2 } };
  assert.equal(resolveAnchor({ w: "dig" }, ctx), 0.4);
  assert.equal(resolveAnchor({ w: "dig", n: 2, o: 0.1 }, ctx), 2.9);
  assert.equal(resolveAnchor({ w: "floods" }, ctx), 1.8);
  assert.throws(() => resolveAnchor({ w: "floods", exact: true }, ctx));
  assert.equal(resolveAnchor({ w: "floods.", exact: true }, ctx), 1.8);
  assert.equal(resolveAnchor({ mark: "signPop", o: 0.1 }, ctx), 4.1);
  assert.equal(resolveAnchor({ abs: 1.25 }, ctx), 1.25);
  assert.throws(() => resolveAnchor({ w: "missing" }, ctx), /not found/);
  const ss = sentencesOf(WORDS, ["hook", "problem", "fix1"]);
  assert.deepEqual(ss.map((s) => s.role), ["hook", "problem", "fix1"]);
  assert.equal(resolveAnchor({ s: "fix1", w: "dig" }, { ...ctx, sentences: ss }), 2.8);
});

test("m2 end card marks: sign 0.4 s after the measured end of the voice, then 0.45 s pop + 1.75 s hold", () => {
  const m = marksFor(WORDS, 3.5);
  assert.equal(m.signPop, 3.9); assert.equal(m.lengthEnd, +(3.9 + END.pop + END.hold).toFixed(3)); assert.equal(m.lengthNoEnd, 5);
});

test("m2 compile resolves every cue and camera key to seconds", () => {
  const tl = compile(tiny(), WORDS, 3.5);
  assert.deepEqual(tl.tracks["cut.dig"].ramps, [{ t0: 0.42, t1: 1.4, amp: 1, e: "lin" }]);
  assert.deepEqual(tl.tracks["sign.pop"].ramps, [{ t0: 3.9, t1: 3.9, amp: 1, e: "step" }]);
  assert.equal(tl.camera.end.length, 2); assert.equal(tl.camera.end[1][0], tl.marks.lengthEnd);
  assert.equal(tl.lengthSec, tl.marks.lengthEnd);
});

test("m2 format check catches bad layouts", () => {
  assert.deepEqual(validateLayout(tiny()), []);
  const bad = tiny(); bad.parts.push({ id: "cut", kind: "nope", params: { mat: "plutonium" } }); bad.cues.push({ p: "cut", c: "fly", a: { w: "" } }, { p: "ghost", c: "on", a: { abs: 0 } }, { p: "sign", c: "pop", a: { mark: "never" }, e: "wobble" });
  const P = validateLayout(bad).join(" | ");
  for (const want of ["duplicate id", "unknown kind nope", "unknown material plutonium", "no channel fly", "bad word", "no part ghost", "unknown mark never", "unknown easing wobble"]) assert.ok(P.includes(want), `${want} in ${P}`);
  assert.ok(validateLayout({ ...tiny(), camera: { keys: [] } }).some((p) => /camera/.test(p)));
});

test("m2 every kind has its channel list and a builder", () => {
  assert.deepEqual(Object.keys(KINDS).sort(), Object.keys(KIND_CHANNELS).sort());
  assert.ok(MATERIAL_NAMES.length >= 30);
});

for (const key of ["landfill", "french_drain"]) {
  test(`m2 golden layout ${key} passes the format check and uses exact word anchors`, () => {
    const lay = L(key);
    assert.deepEqual(validateLayout(lay), []);
    assert.equal(lay.anchorMatch, "exact");
    assert.ok(lay.parts.length >= 20 && lay.cues.length >= 50 && lay.camera.keys.length >= 20);
    assert.ok(lay.audio.sfx.length >= 4 && lay.audio.chimes.length >= 4 && lay.audio.cards.length >= 2);
  });
}

// The golden layouts compiled with the approved voices give the approved cue times (the hand-built timelines).
const RS = "C:/Users/Public/Zylo/research/seamless-niche";
const GOLD = [
  ["landfill", `${RS}/m1/voice_tests/voice_final_eric.words.json`, `${RS}/work/m1full_v2/times.json`],
  ["french_drain", `${RS}/m2drain/voice/voice_final.words.json`, `${RS}/work/m2drain/times.json`],
];
for (const [key, wf, tf] of GOLD) {
  test(`m2 golden ${key} compiles to the approved times`, { skip: !existsSync(wf) && "approved voice not on this machine" }, () => {
    const words = JSON.parse(readFileSync(wf, "utf8")), TM = JSON.parse(readFileSync(tf, "utf8"));
    const tl = compile(L(key), words, TM.speechEnd);
    assert.equal(tl.marks.signPop, TM.signPop); assert.equal(tl.marks.lengthEnd, TM.lengthEnd);
    const T = tl.tracks, near = (a, b) => Math.abs(a - b) < 1e-3;
    if (key === "landfill") {
      assert.ok(near(T["dig.dig"].ramps[0].t0, TM.dig + 0.02));
      assert.ok(near(T["pit.linerLips"].ramps[0].t0, TM.plastic - 0.35 + 0.75));
      assert.ok(near(T["bags1.drop"].ramps[0].t0, TM.throw + 0.2));
      for (const t of [0, 0.5, 1, 2.5, 3.5, 5]) assert.ok(near(channelValue(T["truck.z"], t), -40 + 27.4 * eOut(span(t, 0, 1)) - 36 * eInOut(span(t, TM.landfill + 0.6, TM.landfill + 2.8))));
      for (const t of [4, 5, 7.2, 8, 9.5, 10, 11]) {
        const arr = span(t, TM.leaks - 0.05, TM.leaks + 0.2) * (1 - span(t, TM.so - 0.1, TM.so + 0.25)) + 0.8 * span(t, TM.not, TM.not + 0.2) * (1 - span(t, TM.add - 0.1, TM.add + 0.2));
        assert.ok(near(channelValue(T["seepArrows.on"], t), arr));
      }
      assert.ok(near(tl.camera.end.at(-2)[0], TM.signPop + 0.1));
    } else {
      for (const t of [2, 4.5, 7, 7.3, 8, 12]) assert.ok(near(channelValue(T["trenchWater.flood"], t), 0.22 * span(t, TM.dumps, TM.ditch - 0.1) + 0.78 * eOut(span(t, TM.ditch - 0.05, TM.floods + 0.45))));
      for (const t of [22, 23.5, 25, 26.5, 28]) assert.ok(near(channelValue(T["soakPit.wetY"], t), -6.1 + 2.25 * eOut(span(t, TM.away - 0.1, TM.away + 0.9)) * (1 - 0.6 * span(t, TM.mud, TM.and1 + 1.5))));
      assert.ok(near(T["flag.cross"].ramps[0].t0, TM.not));
      assert.equal(tl.camera.end.length, 26);
    }
  });
}
