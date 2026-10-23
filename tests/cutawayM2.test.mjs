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

// ---------- step B: the camera director, the verbs, the templates ----------
import { frameBox, directCamera, projectBox, bandHits, MOVE } from "../scripts/cutaway/proto3d/m2/director.js";
import { verbCues, expandBeats } from "../scripts/cutaway/proto3d/m2/verbs.js";

test("m2 director frames a box at the asked width, in a free zone, clear of the card and caption bands", () => {
  const box = { min: [-1, -3, -0.6], max: [1, -1.5, 0] };
  const f = frameBox(box, { width: 0.4 });
  assert.ok(Math.abs(f.rect.w - 0.4) < 0.02, `width ${f.rect.w}`);
  assert.ok(f.ok, f.why.join());
  const r = projectBox(f.pos, f.tgt, box), hits = bandHits(r);
  assert.ok(!hits.card && !hits.caption);
  // a hero box too tall for any zone is shrunk into the bottom zone, never under 15%
  const tall = frameBox({ min: [-1, -8, -0.5], max: [1, 2, 0] }, { width: 0.6 });
  assert.ok(tall.rect.w >= 0.13 && tall.rect.y0 >= 0.57 - 0.01 && tall.rect.y1 <= 0.96, JSON.stringify(tall.rect));
});

test("m2 director: home first, a move 0.4 s before each shot, too-close shots dropped, the end card pull-back and push", () => {
  const lay = { world: { cut: { x0: -5, x1: 5, z0: -8, depth: 6 } }, parts: [{ id: "tank", kind: "tank", params: { pos: [8, 0, -1] } }, { id: "sign", kind: "sign", params: { at: [0, 0.25, -2.2] } }] };
  const marks = { signPop: 20, lengthEnd: 22.2, lengthNoEnd: 21.5 };
  const d = directCamera(lay, [{ t: 5, focus: ["tank"] }, { t: 5.5, focus: "home" }, { t: 12, focus: "home" }], marks);
  assert.equal(d.end[0][0], 0);
  assert.ok(d.end.some((k) => Math.abs(k[0] - (5 - MOVE.lead)) < 1e-6) && d.end.some((k) => Math.abs(k[0] - (5 + MOVE.settle)) < 1e-6));
  assert.equal(d.notes.filter((n) => /dropped/.test(n)).length, 1);
  assert.deepEqual(d.end.slice(-2).map((k) => k[0]), [20.1, 22.2]);
  assert.equal(d.noend.at(-1)[0], 21.5);
  for (let i = 1; i < d.end.length; i++) assert.ok(d.end[i][0] - d.end[i - 1][0] >= 0.05);
});

test("m2 verbs: a verb on its word gives the account's timing; d stretches it", () => {
  const part = { id: "p", kind: "pipe" };
  const [c] = verbCues(part, { v: "grow" }, { s: "fix2", w: "pipe" });
  assert.deepEqual([c.a.o, c.b.o, c.e], [-0.1, 0.7, "lin"]);
  const [d] = verbCues(part, { v: "grow", d: 1.6, o: 0.2 }, { s: "fix2", w: "pipe" });
  assert.deepEqual([d.a.o, d.b.o], [0.1, 1.7]);
  assert.throws(() => verbCues(part, { v: "explode" }, { s: "x" }), /no verb/);
  const lay = { parts: [{ id: "t", kind: "tank" }], beats: [{ s: "how", do: [{ p: "t", v: "show", w: "tank" }], shot: { focus: ["t"] } }] };
  const ex = expandBeats(lay);
  assert.equal(ex.cues[0].e, "back"); assert.deepEqual(ex.shots[0].at, { s: "how" });
});

for (const [key, wf, tf] of GOLD) {
  test(`m2 template ${key}: compiles on the approved script, every shot framed`, { skip: !existsSync(wf) && "approved voice not on this machine" }, () => {
    const lay = L(`${key}.template`), words = JSON.parse(readFileSync(wf, "utf8")), TM = JSON.parse(readFileSync(tf, "utf8"));
    const tl = compile(lay, words, TM.speechEnd, { roles: lay.roles });
    assert.equal(tl.sentences.filter((s) => s.role).length, lay.roles.length);
    // only re-aims (the saved side-story shots looked at open lawn): no shot dropped, none replaced by home
    assert.deepEqual(tl.director.notes.filter((n) => !/re-aimed/.test(n)), []);
    for (const f of tl.director.frames) assert.ok(f.anchored || f.rect.w >= 0.15, `${f.ids} ${f.rect.w}`);
    for (const f of tl.director.frames) if (!f.hero) assert.ok(f.measure.empty <= CAMERA_LIMITS.emptyMax && f.measure.subject >= CAMERA_LIMITS.subjectMin, `${f.ids} ${JSON.stringify(f.measure)}`);
    assert.ok(tl.director.frames.filter((f) => f.ok).length >= tl.director.frames.length - 1);
    assert.equal(tl.tracks["sign.pop"].ramps[0].t0, TM.signPop);
    // it opens close on its hook object, and every sentence passes the camera checks
    assert.ok(tl.director.frames[0].opening);
    assert.deepEqual(timelineChecks(lay, tl).problems, []);
  });
}

// ---------- steps C and D: the planner shapes, the solver, the checks ----------
import { sceneFromLayout, layoutFromScene, draftWords, SCENE_REPLY_SCHEMA } from "../scripts/cutaway/proto3d/m2/plan.js";
import { solveLayout } from "../scripts/cutaway/proto3d/m2/solver.js";
import { timelineChecks, previewTimes } from "../scripts/cutaway/proto3d/m2/checks.mjs";
import { catalogText } from "../scripts/cutaway/proto3d/m2/catalog.js";
import { costOf } from "../scripts/cutaway/proto3d/m2/llm.mjs";
import { sentencesOf as sOf } from "../scripts/cutaway/proto3d/m2/curves.js";

test("m2 catalog documents every part kind with its verbs", () => {
  const t = catalogText();
  for (const k of Object.keys(KIND_CHANNELS)) assert.ok(t.includes(`- ${k}:`), k);
  assert.ok(t.includes("MATERIALS") && t.includes("water_rush"));
});

test("m2 planner prices: Sonnet 5.5 tokens and web searches", () => {
  assert.equal(costOf("claude-sonnet-5-5", { input_tokens: 1e6, output_tokens: 1e5, server_tool_use: { web_search_requests: 3 } }), 2 + 1 + 0.03);
  assert.equal(costOf("claude-opus-5-5", { output_tokens: 1e6 }), 20);
});

test("m2 the scene reply schema stays tiny (a full layout schema compiles to a grammar the API refuses)", () => {
  assert.ok(JSON.stringify(SCENE_REPLY_SCHEMA).length < 300);
});

for (const [key, wf] of GOLD) {
  test(`m2 template ${key}: round-trips through the planner's scene shape and passes the solver`, { skip: !existsSync(wf) && "approved voice not on this machine" }, () => {
    const lay = L(`${key}.template`);
    const back = layoutFromScene(JSON.parse(JSON.stringify(sceneFromLayout(lay))), { key, title: lay.title, roles: lay.roles });
    assert.deepEqual(back.problems, []);
    const ss = sOf(JSON.parse(readFileSync(wf, "utf8")), lay.roles).map((s) => ({ role: s.role, text: s.text }));
    assert.deepEqual(solveLayout({ ...back.layout, camera: lay.camera }, ss).problems, []);
  });
}

test("m2 solver catches a bad plan", () => {
  const lay = L("french_drain.template");
  const ss = [{ role: "hook", text: "If you dig a ditch, you have a drain." }, { role: "name", text: "This is a drain." }, { role: "congrats", text: "Congratulations, you built it." }];
  const bad = { ...lay, world: { ...lay.world, house: [0, 0, -1] }, parts: [...lay.parts.filter((p) => p.kind !== "sign"), { id: "x", kind: "tank", params: {} }], audio: { ...lay.audio, sfx: [{ lib: "explosion", at: { s: "hook" } }] } };
  const P = solveLayout(bad, ss).problems.join(" | ");
  for (const want of ["house stands on the cut", "needs pos", "no library sound", "no sign part", "no sentence with that role"]) assert.ok(P.includes(want), `${want} in ${P}`);
});

test("m2 draft words: one per script word, sentences split for role anchors", () => {
  const w = draftWords([{ role: "hook", text: "If you dig." }, { role: "name", text: "This is it." }]);
  assert.equal(w.length, 6); assert.ok(w[3].s - w[2].e > 0.2);
});

for (const [key, wf, tf] of GOLD) {
  test(`m2 timeline checks pass on the approved ${key} (a calm end, the sign 0.4 s after the voice)`, { skip: !existsSync(wf) && "approved voice not on this machine" }, () => {
    const lay = L(`${key}.template`), TM = JSON.parse(readFileSync(tf, "utf8"));
    const tl = compile(lay, JSON.parse(readFileSync(wf, "utf8")), TM.speechEnd, { roles: lay.roles });
    const c = timelineChecks(lay, tl);
    assert.deepEqual(c.problems, []);
    assert.ok(c.stats.movesPer10s < 3.5);
    const pv = previewTimes(tl);
    assert.equal(pv.length, lay.roles.length);
    pv.forEach((p, i) => assert.ok(p.t >= tl.sentences[i].t0 && p.t <= (tl.sentences[i + 1]?.t0 ?? tl.marks.lengthEnd)));
    // a storm left on at "Congratulations" is caught
    const bad = { ...lay, beats: lay.beats.map((b) => ({ ...b, do: (b.do ?? []).filter((a) => !(a.p === "light" && a.v === "clear") && !(a.p === "rain" && a.v === "stop")) })) };
    const tl2 = compile(bad, JSON.parse(readFileSync(wf, "utf8")), TM.speechEnd, { roles: lay.roles });
    if (lay.parts.some((p) => p.kind === "rain")) assert.ok(timelineChecks(bad, tl2).problems.some((p) => /calm/.test(p)));
  });
}

// ---------- calibration: grading, the field floor, the hero rule ----------
import { gradingFor, SAT } from "../scripts/cutaway/proto3d/m2/checks.mjs";
import { MIN_FIELD } from "../scripts/cutaway/proto3d/m2/director.js";

test("m2 grading: inside 0.38-0.45 nothing changes; outside, one step toward 0.42, clamped", () => {
  assert.equal(gradingFor(0.41), null); assert.equal(gradingFor(0.38), null); assert.equal(gradingFor(0.45), null);
  assert.ok(Math.abs(gradingFor(0.521) - (SAT.base - (0.521 - 0.42) / SAT.slope)) < 1e-3);
  assert.equal(gradingFor(0.05), 1.6); assert.equal(gradingFor(0.99), 0.8);
});

test("m2 director: a thin part is never framed tighter than the field floor, except as the hero", () => {
  const pipe = { min: [-0.3, -6, -0.4], max: [0.3, 0, 0] };
  const f = frameBox(pipe, { width: 0.6, fit: "loose" });
  const fieldW = (pipe.max[0] - pipe.min[0]) / projectBox(f.pos, f.tgt, pipe).w; // world width across the frame
  assert.ok(fieldW >= MIN_FIELD * 0.8, `field ${fieldW}`); // (the box depth makes the front face read a little wider)
  const h = frameBox(pipe, { width: 0.3, minField: 0, fit: "loose" });
  assert.ok(projectBox(h.pos, h.tgt, pipe).w > 0.25);
});

import { missingWords, applyWords, anchorWords } from "../scripts/cutaway/proto3d/m2/planner.mjs";
test("m2 saved layout: only the words missing from the new sentences are re-anchored, in place", () => {
  const L = JSON.parse(readFileSync(new URL("../scripts/cutaway/proto3d/m2/layouts/french_drain.template.json", import.meta.url), "utf8"));
  const kw = anchorWords(L);
  // sentences that hold every anchor word: nothing to re-anchor
  const full = L.roles.map((r) => ({ role: r, text: (kw[r] ?? []).join(" ") }));
  assert.equal(missingWords(L, full).length, 0);
  // one sentence rewritten: only its anchors are listed, and the picked words land on them
  const r0 = L.roles.find((r) => kw[r]?.length);
  const changed = full.map((s) => (s.role === r0 ? { ...s, text: "brand new words here" } : s));
  const miss = missingWords(L, changed);
  assert.ok(miss.length >= 1 && miss.every((m) => m.s === r0));
  const next = applyWords(L, miss, miss.map((_, i) => ({ index: i, word: "new," })));
  assert.equal(missingWords(next, changed.map((s) => (s.role === r0 ? { ...s, text: "brand new words here" } : s))).length, 0);
  assert.deepEqual(next.parts, L.parts); // the world and parts stay exactly as saved
  assert.ok(L.facts?.length >= 2); // and the verified facts travel with it
});

import { measureKey, CAMERA_LIMITS, placeLifeProps, turnBetween } from "../scripts/cutaway/proto3d/m2/framing.js";
import { homeView } from "../scripts/cutaway/proto3d/m2/director.js";
test("m2 framing: the hand-built paths pass the camera limits (their story keys), the Gate 2 lawn shots would not", () => {
  for (const key of ["french_drain", "landfill"]) {
    const lay = L(key), keys = lay.camera.keys.filter((k) => !k.at.mark);
    for (const k of keys) { const m = measureKey(lay, k.pos, k.tgt); assert.ok(m.empty <= CAMERA_LIMITS.emptyMax && m.subject >= CAMERA_LIMITS.subjectMin, `${key} ${JSON.stringify(k.at)} ${JSON.stringify(m)}`); }
    for (let i = 1; i < keys.length; i++) assert.ok(turnBetween(keys[i - 1], keys[i]) <= CAMERA_LIMITS.turnMax);
  }
  // a camera on the open lawn beside the house (the Gate 2 book shot): mostly empty, the cut out of view
  const fd = L("french_drain");
  const m = measureKey(fd, [16, 3, 10], [11, 1.5, -6]);
  assert.ok(m.empty > CAMERA_LIMITS.emptyMax || m.subject < CAMERA_LIMITS.subjectMin, JSON.stringify(m));
});
test("m2 framing: a side-story prop far out on the lawn is moved beside the cut, inside the home frame", () => {
  const lay = { world: { cut: { x0: -11.4, x1: 0.8, z0: -2, depth: 3.6 }, house: [-8, 0, -5.5] }, parts: [{ id: "flag", kind: "flag", params: { at: [16, 0, -9], w: 3, pole: 5 } }, { id: "dig", kind: "dig", params: {} }], beats: [] };
  const r = placeLifeProps(lay, homeView(lay), projectBox);
  assert.deepEqual(r.moved, ["flag"]);
  const at = r.layout.parts[0].params.at;
  assert.ok(at[0] < 4 && at[0] > -14 && at[2] < -2, JSON.stringify(at));
  // already beside the action: left where it is
  const near = { ...lay, parts: [{ ...lay.parts[0], params: { ...lay.parts[0].params, at: [-1, 0, -3.2] } }, lay.parts[1]] };
  assert.deepEqual(placeLifeProps(near, homeView(near), projectBox).moved, []);
});

import { fixOpening, INDOOR, OPEN_AT } from "../scripts/cutaway/proto3d/m2/planner.mjs";
import { heroBox } from "../scripts/cutaway/proto3d/m2/director.js";
const openLay = (hookDo, laterDo, hookShot) => ({
  key: "open_test", title: "t", roles: ["hook", "problem", "name", "congrats"],
  world: { cut: { x0: -1, x1: 3, z0: -5, depth: 4 }, house: false, backdrop: { type: "carwash" } },
  parts: [{ id: "dig", kind: "dig", params: { mound: { x: 6, z: -3, rx: 1, rz: 1, h: 1 } } }, { id: "car", kind: "car", params: { pos: [-3, 0.1, -2.5] } }, { id: "sign", kind: "sign", params: { at: [6, 0.1, -4] } }],
  cues: [], audio: { cards: [], sfx: [], chimes: [] },
  beats: [{ s: "hook", do: hookDo, shots: [hookShot] }, { s: "problem", do: laterDo, shots: [{ focus: "home" }] }, { s: "name", shots: [{ focus: ["dig"], hero: true, width: 0.5 }] }, { s: "congrats", shots: [{ focus: "home" }] }],
});
const openSentences = [{ role: "hook", text: "You drive your dirty car into the bay here." }, { role: "problem", text: "Then the water drains away below." }, { role: "name", text: "This is a car wash." }, { role: "congrats", text: "Congratulations, it is clean." }];
test("m2 opening: the hook object is on screen at 0.3 s (a car already in the bay, a dig mostly open)", () => {
  // the car drives in on a later word of the hook: moved so it has arrived by 0.3 s
  const L = openLay([{ p: "dig", v: "dig", w: "here." }, { p: "car", v: "arrive", w: "bay" }], [], { focus: ["car"], type: "close" });
  const { layout, moved } = fixOpening(L);
  assert.equal(moved.part, "car");
  const words = draftWords(openSentences), tl = compile(layout, words, words.at(-1).e, { roles: layout.roles });
  assert.ok(channelValue(tl.tracks["car.drive"], OPEN_AT) >= 0.99, String(channelValue(tl.tracks["car.drive"], OPEN_AT)));
  // a dig framed close opens mostly dug, at mid distance
  const D = fixOpening(openLay([{ p: "dig", v: "dig", w: "here." }], [{ p: "car", v: "arrive", w: "water" }], { focus: ["dig"], type: "close" }));
  const tl2 = compile(D.layout, words, words.at(-1).e, { roles: D.layout.roles });
  const dg = channelValue(tl2.tracks["dig.dig"], OPEN_AT);
  assert.ok(dg > 0.6 && dg < 0.95, String(dg));
  assert.equal(D.layout.beats[0].shots[0].type, "mid");
  // a home opening is not touched
  assert.equal(fixOpening(openLay([], [], { focus: "home" })).moved, null);
});
test("m2 home view: a small named part reaches 15% of the frame width, and indoor topics go to the room setting", () => {
  const lay = { world: { cut: { x0: -1.2, x1: 1.2, z0: -3.2, depth: 0.7 }, backdrop: { type: "street" } }, parts: [{ id: "dig", kind: "dig", params: {} }], beats: [{ s: "name", shots: [{ box: { min: [-1.5, -0.9, -3], max: [1.5, 0.5, 0.3] }, hero: true, width: 0.7 }] }] };
  const h = homeView(lay);
  assert.ok(projectBox(h.pos, h.tgt, heroBox(lay)).w >= 0.15);
  assert.ok(INDOOR.test("How a sump pump keeps a basement dry") && INDOOR.test("how a water heater works") && !INDOOR.test("How a car wash works"));
});

import { cameraAt } from "../scripts/cutaway/proto3d/m2/director.js";
import { makePage } from "../scripts/cutaway/proto3d/m2/makePage.mjs";
import { focusOf } from "../scripts/cutaway/proto3d/m2/focus.js";
import { mustFor } from "../scripts/cutaway/proto3d/m2/checks.mjs";
test("m2 clarity camera: the soap is seen running into the creek, and the canopy is up in its sentence's frame (car wash)", () => {
  const { layout, sentences } = JSON.parse(readFileSync(new URL("./fixtures/cutaway_car_wash_c.json", import.meta.url), "utf8"));
  const w = draftWords(sentences), tl = compile(layout, w, w.at(-1).e + 0.1, { roles: sentences.map((s) => s.role) });
  const pts = previewTimes(tl, layout), at = (role) => pts.find((p) => p.role === role).t, cut = layout.world.cut;
  const on = (role, id) => { const k = cameraAt(tl.camera.end, at(role)), r = projectBox(k.pos, k.tgt, focusOf(layout.parts.find((p) => p.id === id), cut)); return !r.behind && Math.min(1, r.x1) - Math.max(0, r.x0) >= 0.15; };
  // the creek the soap runs into is in the frame (a planned shot and an auto shot 1.1 s apart: the auto one used to be dropped)
  assert.ok(on("problem2", "soapFlow") && on("problem2", "creek"));
  // the canopy goes up on "canopy", the sentence's last word: its frame waits for the roof (it used to show the posts only)
  const roof = tl.tracks["canopy.roof"].ramps[0];
  assert.ok(at("finish") >= roof.t1 && at("finish") < at("congrats"));
  // the side sentences only need their thing in view; congrats is judged before the end card
  assert.match(mustFor("myth", { p: "wasteWater", does: "x" }), /visible, no action needed/);
  assert.ok(at("congrats") < tl.marks.signPop);
  // the end view holds the whole build: the canopy the "Add ..." line put at the far end of the bay too
  const whole = (role, id) => { const k = cameraAt(tl.camera.end, at(role)), r = projectBox(k.pos, k.tgt, focusOf(layout.parts.find((p) => p.id === id), cut)); return !r.behind && r.x0 >= 0 && r.x1 <= 1; };
  assert.ok(["canopy", "kiosk", "vacuum"].every((id) => whole("congrats", id)));
  // a creek is the water in this story: no blue groundwater band under it to be taken for the creek
  assert.match(makePage(layout), /water.visible = false/);
});

import { normWords, compareWords } from "../scripts/cutaway/proto3d/m2/voiceCheck.mjs";
test("m2 voice check: the Flash take's garbles fail, number words and a misheard little word pass", () => {
  assert.deepEqual(normWords("up to 80 % of it, about one hundred forty gallons"), ["up", "to", "80", "percent", "of", "it", "about", "140", "gallons"]);
  const script = "Sand sinks, oil rises, and clean water goes to a pump. It uses about 15 gallons of fresh water a car.";
  // what faster-whisper heard in the car wash's Flash take (2026-10-24)
  const flash = compareWords(script, "Sand sinks, oil rises, and in mind, clean water goes to a pump. It uses about fifteen gallons of fresh water or a car, car.");
  assert.equal(flash.ok, false);
  assert.ok(flash.problems.some((p) => /extra "mind"/.test(p)) && flash.problems.some((p) => /extra "car"/.test(p)));
  // the approved French drain: "the French in French drain" heard with "and" is a mishearing, not a failure
  const drain = compareWords("And the French in French drain is not France.", "And the French and French drain is not France.");
  assert.equal(drain.ok, true); assert.equal(drain.notes.length, 1);
  // a run-together sentence ("140. Add a pay kiosk" heard "140 at a pay kiosk") fails: a content word changed
  assert.equal(compareWords("up to 140. Add a pay kiosk.", "up to 140 at a pay kiosk.").ok, false);
});

import { underground } from "../scripts/cutaway/proto3d/m2/director.js";
test("m2 look: the cut face at most ~35% of a frame above ground, the hook car a quarter of the width, a moving opening", () => {
  const { layout, sentences } = JSON.parse(readFileSync(new URL("./fixtures/cutaway_car_wash_c.json", import.meta.url), "utf8"));
  const w = draftWords(sentences), tl = compile(layout, w, w.at(-1).e + 0.1, { roles: sentences.map((s) => s.role) });
  const cut = layout.world.cut, box = (id) => focusOf(layout.parts.find((p) => p.id === id), cut);
  for (const p of previewTimes(tl, layout)) {
    const b = layout.beats.find((x) => x.s === p.role), shows = b?.shows && layout.parts.find((q) => q.id === b.shows.p);
    if (shows && underground(focusOf(shows, cut))) continue;
    const k = cameraAt(tl.camera.end, p.t);
    assert.ok(measureKey(layout, k.pos, k.tgt).soil <= CAMERA_LIMITS.soilMax + 0.03, `${p.role}: ${measureKey(layout, k.pos, k.tgt).soil}`);
  }
  // the hook car's box at least a third of the width once the opening push-in lands (the car itself: a quarter)
  const k1 = cameraAt(tl.camera.end, 1.5);
  assert.ok(projectBox(k1.pos, k1.tgt, box("car")).w >= 0.3);
  // the camera moves in the first half second
  const a = cameraAt(tl.camera.end, 0), c = cameraAt(tl.camera.end, 0.5);
  assert.ok(Math.hypot(...a.pos.map((v, i) => v - c.pos[i])) > 0.2);
  // the approved pair keep their own framing (their home view is hand-set)
  assert.ok(underground({ min: [0, -4.8, 0], max: [1, -1.4, 1] }) && !underground({ min: [0, -0.9, 0], max: [1, 0.3, 1] }));
});
