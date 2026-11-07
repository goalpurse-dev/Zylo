// node --test dev/vision.test.mjs   (lib/vision: the shot review; no network, no Chrome: a fake judge and a fake renderer)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { lineRequirements, stillPicks, subTimeline, stillTimeline } from "../lib/vision/requirements.js";
import { normalizeVerdict, verdictsOf, batchesOf, batchContent, judgeSchema, worstCaseUsd, inputTokens, imageTokens, anthropicJudge, MISS_TYPES } from "../lib/vision/judge.js";
import { suggestFixes, applyFixes, settleObjects, finalFallback, poseForVerb, exprForFeeling } from "../lib/vision/replan.js";
import { reviewShots } from "../lib/vision/shotReview.js";
import { mockJudge } from "../lib/vision/mock.js";
import { makeReviewStills, reviewForPrepare } from "../lib/vision/index.js";

// ------------------------------------------------------------------------------------------ a small timeline
const shot = (i, start, end, extra = {}) => ({ start, end, line: i, lines: [i], set: "creature:turtle_inside", light: "day", camera: "medium", focus: "me", actors: [{ id: "me", spot: "center", pose: "stand", expr: "neutral", facing: "camera", hold: null }], seed: i + 1, subject: "me", ...extra });
function mkTl() {
  return {
    version: 1, fps: 24, width: 1080, height: 1920, duration: 12,
    cast: { me: { role: "kid", name: "Nell", seed: 2 }, oddy: { role: "adult", name: "Mrs. Oddy", seed: 4 } },
    worlds: { turtle_inside: { creature: "turtle", view: "inside", size: 120 } },
    visualWorld: { narrator: "Nell", gender: { oddy: "f" } },
    lines: [{ text: "I live inside a giant turtle.", start: 0, end: 3 }, { text: "Mrs. Oddy ran from the army at night.", start: 3, end: 7 }, { text: "I was scared of the drum.", start: 7, end: 12 }],
    production: { perLine: [
      { line: 0, subject: "me", light: "day", required: [{ id: "w", kind: "world", name: "inside a giant turtle" }, { id: "me", kind: "cast", name: "Nell" }] },
      { line: 1, subject: "oddy", light: "night", required: [{ id: "oddy", kind: "cast", name: "Mrs Oddy" }, { id: "army", kind: "crowd", name: "army" }] },
      { line: 2, subject: "me", light: "day", required: [{ id: "me", kind: "cast", name: "Nell" }, { id: "drum", kind: "prop", name: "drum" }] },
    ] },
    shots: [shot(0, 0, 3), shot(1, 3, 5, { set: "street" }), shot(1, 5, 7), shot(2, 7, 12)],
    captions: [{ word: "I", start: 0, end: 0.2 }],
  };
}
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const fakeStills = () => {
  const calls = [];
  return { calls, async renderTimeline(tl, picks, { onLoad } = {}) { calls.push({ shots: tl.shots.length, picks: picks.length, captions: tl.captions?.length ?? 0 }); onLoad?.(5); return { stills: picks.map((p) => ({ ...p, jpeg, w: 432, h: 768, file: null, ms: 1 })), loadMs: 5, ms: 6 }; } };
};

// ------------------------------------------------------------------------------------------ requirements + picks
test("requirements come from the story (production list + text), not the plan", () => {
  const tl = mkTl();
  const r = lineRequirements(tl, { premise: "a giant turtle" });
  assert.equal(r.length, 3);
  assert.equal(r[1].who.id, "oddy");
  assert.match(r[1].who.hint, /woman/);
  assert.deepEqual(r[1].nouns, ["army"]);
  assert.equal(r[1].light, "night");
  assert.equal(r[1].moving, true);
  assert.equal(r[1].action, "ran");
  assert.deepEqual(r[1].shots, [1, 2]);
  assert.equal(r[0].place, "inside a giant turtle");
  assert.equal(r[2].emotion, "scared");
  assert.match(r[0].who.name, /narrator/);
});

test("stills: one frame per shot within the line, two for moving or long single shots; a sub-timeline re-times", () => {
  const tl = mkTl();
  const p = stillPicks(tl);
  assert.equal(p.filter((x) => x.line === 0).length, 1);
  assert.equal(p.filter((x) => x.line === 1).length, 4);       // moving: 2 shots x 2
  assert.equal(p.filter((x) => x.line === 2).length, 2);       // one 5 s shot
  assert.ok(p.every((x) => x.t >= tl.shots[x.shot].start && x.t <= tl.shots[x.shot].end));
  const only = stillPicks(tl, { only: new Set([2]), lines: new Set([1]) });
  assert.deepEqual([...new Set(only.map((x) => x.shot))], [2]);
  const sub = subTimeline(tl, [2, 0]);
  assert.equal(sub.tl.shots.length, 2);
  assert.equal(sub.tl.shots[0].start, 0); assert.equal(sub.tl.shots[1].start, 3);
  assert.equal(sub.map(2, 6), 4);
  assert.equal(sub.tl.captions.length, 0);
  const st = stillTimeline(tl);
  assert.equal(st.height, 768); assert.equal(st.width, 432); assert.equal(st.captions.length, 0);
  assert.equal(tl.captions.length, 1, "the original timeline is untouched");
});

// ------------------------------------------------------------------------------------------ verdicts
test("verdict parsing: the verdict follows the checks; bad shots map to this line's shots; never throws", () => {
  const item = { line: 1, moving: true, stills: [{ key: "L1-s1a", shot: 1 }, { key: "L1-s1b", shot: 1 }, { key: "L1-s2", shot: 2 }] };
  const ok = { line: 1, shows: "x", who_ok: true, missing: [], action_ok: true, static: false, place_ok: true, time_ok: true, emotion_ok: true, card: false, verdict: "miss", types: ["wrong_place"], bad_shots: ["L1-s1a"], fix: "" };
  assert.equal(normalizeVerdict({ ...ok, types: [] }, item).verdict, "match");
  const a = normalizeVerdict({ ...ok, verdict: "match", missing: ["army"] }, item);
  assert.equal(a.verdict, "partial"); assert.ok(a.types.includes("missing_object")); assert.deepEqual(a.bad_shots, [1]);
  const b = normalizeVerdict({ ...ok, who_ok: false, place_ok: false, verdict: "partial", bad_shots: ["s2", "s99", "L1-s1b"] }, item);
  assert.equal(b.verdict, "miss"); assert.deepEqual(b.bad_shots.sort(), [1, 2]); assert.ok(b.types.includes("wrong_character") && b.types.includes("wrong_place"));
  const c = normalizeVerdict({ ...ok, verdict: "match", static: true }, item);
  assert.equal(c.verdict, "partial"); assert.ok(c.types.includes("static_pose"));
  const d = normalizeVerdict({ verdict: "nonsense", types: ["evil"], who_ok: "yes" }, item);
  assert.ok(["match", "partial", "miss"].includes(d.verdict)); assert.ok(d.types.every((t) => MISS_TYPES.includes(t)));
  assert.doesNotThrow(() => normalizeVerdict(null, null));
  const vs = verdictsOf({ lines: [{ ...ok, types: [] }] }, [item, { line: 2, stills: [] }]);
  assert.equal(vs[0].verdict, "match"); assert.equal(vs[1].verdict, "unjudged");
  assert.equal(verdictsOf(null, [item])[0].verdict, "unjudged");
});

test("batching keeps a line's frames together and caps lines + images; request shape + worst case", () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ line: i, text: `line ${i}`, stills: Array.from({ length: i % 3 + 1 }, (_, k) => ({ key: `L${i}-s${k}`, shot: i, jpeg, w: 432, h: 768 })) }));
  const bs = batchesOf(items, { size: 8, maxImages: 14 });
  assert.equal(bs.flat().length, 20);
  assert.ok(bs.every((b) => b.length <= 8 && b.reduce((n, it) => n + it.stills.length, 0) <= 14));
  const content = batchContent(bs[0], { premise: "a turtle" });
  assert.equal(content.filter((c) => c.type === "image").length, bs[0].reduce((n, it) => n + it.stills.length, 0));
  assert.equal(content[0].type, "text");
  assert.equal(imageTokens(432, 768), 443);
  const s = judgeSchema();
  assert.equal(s.properties.lines.items.additionalProperties, false);
  assert.ok(inputTokens(bs[0]) > 443 * 10);
  assert.ok(worstCaseUsd("claude-haiku-5-5", bs[0]) < 0.01);
  assert.ok(worstCaseUsd("claude-sonnet-5-5", bs[0]) > worstCaseUsd("claude-haiku-5-5", bs[0]) * 10);
});

test("the paid judge's request (a fake fetch: nothing leaves the machine)", async () => {
  let body = null;
  const fetchFn = async (url, init) => { body = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ model: "claude-haiku-5-5", stop_reason: "end_turn", usage: { input_tokens: 6000, output_tokens: 900 }, content: [{ type: "text", text: JSON.stringify({ lines: [{ line: 4, shows: "a kid", who_ok: true, missing: [], action_ok: true, static: false, place_ok: true, time_ok: true, emotion_ok: true, card: false, verdict: "match", types: [], bad_shots: [], fix: "" }] }) }] }) }; };
  const j = anthropicJudge({ apiKey: "test", fetchFn });
  const r = await j.judge([{ line: 4, text: "I ran.", stills: [{ key: "L4-s9", shot: 9, jpeg, w: 432, h: 768 }] }]);
  assert.equal(body.model, "claude-haiku-5-5");
  assert.equal(body.output_config.format.type, "json_schema");
  assert.equal(body.output_config.effort, "low");
  assert.equal(body.messages[0].content.filter((c) => c.type === "image")[0].source.media_type, "image/jpeg");
  assert.equal(r.lines[0].verdict, "match");
  assert.equal(r.costUsd, Number(((6000 * 0.1 + 900 * 0.5) / 1e6).toFixed(6)));
});

// ------------------------------------------------------------------------------------------ re-plan
test("re-plan suggestions speak the planner's vocabulary", () => {
  const tl = mkTl(), reqs = lineRequirements(tl);
  const v = { line: 1, verdict: "miss", types: ["wrong_character", "missing_object", "wrong_place", "wrong_time", "static_pose"], missing: ["army", "a sock"], bad_shots: [1], fix: "show Mrs Oddy running" };
  const f = suggestFixes(v, reqs[1], tl, reqs);
  const ops = new Set(f.map((x) => x.op));
  for (const op of ["castFix", "needCrowd", "setOverride", "timeOfDay"]) assert.ok(ops.has(op), op);
  assert.equal(f.find((x) => x.op === "setOverride").set, "creature:turtle_inside");
  assert.equal(f.find((x) => x.op === "timeOfDay").light, "night");
  assert.equal(f.find((x) => x.op === "needCrowd").kind, "soldier");
  assert.ok(f.some((x) => x.op === "propHeld" && x.hold === "sock" && x.actor === "oddy") || f.some((x) => x.op === "needObject"));
  assert.deepEqual(suggestFixes({ line: 0, verdict: "match", types: [] }, reqs[0], tl), []);
  assert.equal(poseForVerb("ran"), "run"); assert.equal(poseForVerb("marched"), "walk"); assert.equal(exprForFeeling("scared"), "scared");
  const e = suggestFixes({ line: 2, verdict: "partial", types: ["wrong_emotion"], missing: [], bad_shots: [3] }, reqs[2], tl, reqs);
  assert.deepEqual(e.map((x) => [x.op, x.expr]), [["exprFix", "scared"]]);
});

test("fixes apply one by one; a fix that adds a check problem is undone; an unknown object waits for the builder", () => {
  const tl = mkTl();
  const check = (t) => t.shots.flatMap((s, i) => [...(s.light === "warm" ? [`shot ${i}: warm is not allowed here`] : []), ...(s.objects ?? []).filter((o) => !["drum"].includes(o.name) && !o.asset).map((o) => `shot ${i}: unknown object ${o.name}`)]);
  const r = applyFixes(tl, [
    { op: "timeOfDay", shot: 1, light: "night" }, { op: "timeOfDay", shot: 2, light: "warm" },
    { op: "needObject", shot: 3, name: "drum" }, { op: "needObject", shot: 3, name: "kazoo" },
    { op: "exprFix", shot: 3, actor: "me", expr: "scared" }, { op: "exprFix", shot: 3, actor: "ghost", expr: "sad" },
    { op: "bogus", shot: 0 }, { op: "castFix", shot: 99, id: "me" },
  ], { check });
  assert.equal(tl.shots[1].light, "night");
  assert.equal(tl.shots[2].light, "day", "warm undone");
  assert.ok(r.reverted.some((f) => f.light === "warm"));
  assert.deepEqual(tl.shots[3].objects.map((o) => o.name), ["drum", "kazoo"]);
  assert.deepEqual(r.pendingObjects, [{ shot: 3, name: "kazoo" }]);
  assert.equal(tl.shots[3].actors[0].expr, "scared");
  assert.equal(r.unapplied.length, 3);
  assert.deepEqual(r.changedShots.sort(), [1, 3]);
  const s = settleObjects(tl, r.pendingObjects, { check });
  assert.deepEqual(s.removed, [{ shot: 3, name: "kazoo" }]);
  assert.deepEqual(tl.shots[3].objects.map((o) => o.name), ["drum"]);
  assert.equal(check(tl).length, 0);
});

test("castFix puts the subject in focus; a card is the last fallback, capped, re-checked", () => {
  const tl = mkTl();
  applyFixes(tl, [{ op: "castFix", shot: 1, id: "oddy" }]);
  assert.equal(tl.shots[1].focus, "oddy"); assert.equal(tl.shots[1].actors[0].id, "oddy"); assert.equal(tl.shots[1].subject, "oddy");
  const reqs = lineRequirements(tl);
  const fb = finalFallback(tl, [{ line: 2, verdict: "partial", types: ["missing_object"], missing: ["the drum"] }, { line: 0, verdict: "miss", types: ["wrong_character"], missing: [] }, { line: 1, verdict: "partial", types: ["missing_object"], missing: ["army"] }], reqs, { maxCards: 1 });
  assert.equal(fb.cards.length, 1);
  assert.equal(fb.cards[0].text, "DRUM");
  const card = tl.shots.find((s) => s.insert?.kind === "card");
  assert.equal(card.set, "creature:turtle_inside");
  assert.ok(Math.abs(card.start - 10) < 0.01 && card.end === 12);
  assert.equal(fb.unresolved.length, 2);
  // shots still tile
  for (let i = 1; i < tl.shots.length; i++) assert.ok(Math.abs(tl.shots[i].start - tl.shots[i - 1].end) < 1e-6);
  // a check that refuses cards: undone, recorded
  const tl2 = mkTl();
  const fb2 = finalFallback(tl2, [{ line: 2, verdict: "partial", types: ["missing_object"], missing: ["drum"] }], lineRequirements(tl2), { check: (t) => t.shots.filter((s) => s.insert).map(() => "shot 9: no cards") });
  assert.equal(fb2.cards.length, 0); assert.match(fb2.unresolved[0].why, /broke the check/);
  assert.equal(tl2.shots.length, 4);
});

// ------------------------------------------------------------------------------------------ the loop
test("the review loop: pass 1 all lines, re-plan, pass 2 only the changed shots (a sub-timeline), shot-review.json", async () => {
  const tl = mkTl(), stills = fakeStills();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "bw-review-"));
  const { tl: after, report } = await reviewShots({ tl, judge: mockJudge({ costUsd: 0.002 }), stills, check: () => [], outDir: out, budget: { loadMs: 0, callMs: 0, minPassMs: 0 } });
  assert.equal(report.passes[0].lines, 3);
  assert.ok(report.passes.length >= 2);
  assert.ok(stills.calls[1].shots < stills.calls[0].shots, "pass 2 renders only the changed shots");
  assert.equal(after.shots[1].set, "creature:turtle_inside");
  assert.equal(after.shots[1].light, "night");
  assert.ok(after.shots[1].crowds?.some((c) => c.kind === "soldier"));
  assert.ok(report.costUsd > 0);
  const saved = JSON.parse(fs.readFileSync(path.join(out, "shot-review.json"), "utf8"));
  assert.equal(saved.lines.length, 3);
  assert.ok(saved.first.matchPct < 100);
});

test("money cap: no request starts past it; the lines stay unjudged; never a failure", async () => {
  const tl = mkTl();
  let calls = 0;
  const judge = { name: "fake", model: "x", worstCase: () => 0.06, judge: async (b) => { calls++; return { costUsd: 0.05, lines: b.map((it) => ({ line: it.line, verdict: "match", types: [], bad_shots: [], missing: [] })) }; } };
  const { report } = await reviewShots({ tl, judge, stills: fakeStills(), budget: { maxUsd: 0.1, batchSize: 1, concurrency: 1, loadMs: 0, callMs: 0, minPassMs: 0 } });
  assert.equal(calls, 1);
  assert.ok(report.costUsd <= 0.1);
  assert.equal(report.passes[0].counts.unjudged, 2);
});

test("time budget: a pass that does not fit is skipped; a slow judge is cut off; still no failure", async () => {
  const tl = mkTl();
  const r1 = await reviewShots({ tl, judge: mockJudge(), stills: fakeStills(), budget: { until: Date.now() + 5000, loadMs: 40000 } });
  assert.match(r1.report.stopped, /time/);
  assert.equal(r1.report.passes[0].calls, 0);
  const slow = mockJudge({ delayMs: 400 });
  const r2 = await reviewShots({ tl: mkTl(), judge: slow, stills: fakeStills(), budget: { maxMs: 150, loadMs: 0, stillMs: 0, callMs: 0, minPassMs: 0 } });
  assert.equal(r2.report.passes[0].counts.unjudged, 3);
  assert.ok(r2.report.passes[0].errors.some((e) => /time budget/.test(e)));
});

test("never fails: judge errors, renderer errors, a throwing check, no judge", async () => {
  const a = await reviewShots({ tl: mkTl(), judge: mockJudge({ fail: 99 }), stills: fakeStills(), budget: { loadMs: 0, callMs: 0, minPassMs: 0 } });
  assert.equal(a.report.passes[0].counts.unjudged, 3);
  const b = await reviewShots({ tl: mkTl(), judge: mockJudge(), stills: { renderTimeline: async () => { throw new Error("Chrome died"); } }, budget: { loadMs: 0, callMs: 0, minPassMs: 0 } });
  assert.match(b.report.stopped, /Chrome died/);
  const c = await reviewShots({ tl: mkTl(), judge: mockJudge(), stills: fakeStills(), check: () => { throw new Error("bad check"); }, budget: { loadMs: 0, callMs: 0, minPassMs: 0 } });
  assert.ok(c.report.fixes.applied.length === 0, "a throwing check undoes every fix");
  const d = await reviewShots({ tl: mkTl(), judge: null, stills: fakeStills() });
  assert.match(d.report.stopped, /off/);
  const e = await reviewShots({ tl: { shots: [] }, judge: mockJudge(), stills: fakeStills() });
  assert.equal(e.report.stopped, "no shots");
});

// ------------------------------------------------------------------------------------------ timing (2026-11-07)
// a fake renderer with real-ish waits: the first page load in a Chrome is "cold", later ones "warm"
const timedStills = ({ coldMs = 300, warmMs = 60, stillMs = 2 } = {}) => {
  const calls = []; let loads = 0;
  const r = { calls, opened: 0, closed: 0, async renderTimeline(tl, picks, { onLoad, name } = {}) {
    const load = loads++ === 0 ? coldMs : warmMs; await new Promise((s) => setTimeout(s, load)); onLoad?.(load);
    calls.push({ name, shots: tl.shots.length, picks: picks.length, load });
    await new Promise((s) => setTimeout(s, stillMs * picks.length));
    return { stills: picks.map((p) => ({ ...p, jpeg, w: 270, h: 480, file: null, ms: stillMs })), loadMs: load, ms: load + stillMs * picks.length };
  }, async close() { r.closed++; } };
  return r;
};

test("review stills warmed early: pass 1 gets the warm load; one Chrome for every pass; closed once by its owner", async () => {
  const fake = timedStills({ coldMs: 300, warmMs: 40 });
  let made = 0;
  const rs = makeReviewStills({ dir: os.tmpdir(), factory: async ({ size }) => { made++; assert.equal(size, 480); return fake; } });
  rs.warm(mkTl());                       // fire and forget, as the prepare job does after the director
  await new Promise((s) => setTimeout(s, 20));
  assert.equal(rs.warming, true);
  const t0 = Date.now();
  const rv = await reviewForPrepare({ tl: mkTl(), script: null, config: { provider: "mock" }, plan: {}, dir: fs.mkdtempSync(path.join(os.tmpdir(), "bw-warm-")), until: Date.now() + 60000, stills: rs });
  assert.equal(made, 1, "one renderer for the warm-up and every pass");
  assert.equal(fake.calls[0].name, "warm"); assert.equal(fake.calls[0].picks, 0);
  assert.ok(fake.calls.slice(1).every((c) => c.load === 40), "every pass loads warm");
  assert.ok(rv.summary.passes >= 2 && rv.summary.timing[0].load === 40, JSON.stringify(rv.summary.timing));
  assert.ok(rv.summary.warmMs >= 300);
  assert.equal(fake.closed, 0, "reviewShots does not close the shared renderer");
  await rs.close(); await rs.close(); assert.equal(fake.closed, 1);
  assert.ok(Date.now() - t0 < 3000);
});

test("pass 2 is estimated from pass 1's MEASURED load (not capped at 20 s): a pass that can't finish is not started", async () => {
  // pass 1 loads in 600 ms; the window leaves ~250 ms after it: pass 2 (estimated from 600 ms) is skipped, not cut
  const fake = timedStills({ coldMs: 600, warmMs: 600, stillMs: 0 });
  const { report } = await reviewShots({ tl: mkTl(), judge: mockJudge(), stills: fake, check: () => [], budget: { until: Date.now() + 900, loadMs: 100, stillMs: 0, callMs: 0, minPassMs: 0, minLoadMs: 0, minCallMs: 0 } });
  assert.equal(report.passes.length, 2);
  assert.match(report.passes[1].skipped, /time/);
  assert.equal(fake.calls.length, 1, "no pass-2 page load was started");
  assert.ok(report.lines.length === 3 && report.lines.every((l) => l.verdict), "pass 1's verdicts are kept");
});

test("a pass cut by the time budget keeps the verdicts and the report (the dog run lost them all)", async () => {
  // the estimate says it fits (loadMs 10), the real load takes 800 ms: cut during the stills of pass 2
  let n = 0;
  const fake = { async renderTimeline(tl, picks, { onLoad } = {}) { const ms = n++ === 0 ? 10 : 800; await new Promise((s) => setTimeout(s, ms)); onLoad?.(ms); return { stills: picks.map((p) => ({ ...p, jpeg, w: 270, h: 480, file: null, ms: 1 })), loadMs: ms, ms }; } };
  const { report } = await reviewShots({ tl: mkTl(), judge: mockJudge(), stills: fake, check: () => [], budget: { until: Date.now() + 400, loadMs: 10, stillMs: 0, callMs: 0, minPassMs: 0, minLoadMs: 0, minCallMs: 0 } });
  assert.doesNotMatch(String(report.stopped), /^error/);
  assert.match(String(report.stopped), /pass 2: time budget reached during the stills/);
  assert.equal(report.error, undefined);
  assert.ok(report.lines.every((l) => l.verdict), "pass 1 verdicts kept");
  assert.ok(report.unresolved.some((u) => u.unverified), "fixed lines are marked as not re-judged");
});
