// EPIC agent tests: the pure parts (lib/epic.js) — formations, crowd motion, gait / footfalls, shake, beats, schema,
// SFX candidates — and the dev timeline + the EPIC SFX catalog.   node --test dev/epic.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formationSlots, formationExtent, FORMATIONS, crowdMotion, CROWD_ACTIONS, gaitOf, giantFootfalls, shake, SHAKES,
  BEATS, BEAT_TYPES, beatPlan, beatProgress, validateEpicShot, validateEpic, epicSfxCandidates, EPIC_SFX_TIMING,
} from "../lib/epic.js";
import { buildTimeline } from "./epicTimeline.mjs";
import { CROWD_FORMATIONS, CROWD_ACTIONS as BUILDER_ACTIONS } from "../lib/builder/spec.js";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

test("formations: exact count, centred, deterministic, no two characters on the same place", () => {
  for (const f of FORMATIONS) for (const n of [1, 7, 50, 150, 500]) {
    const s = formationSlots(f, n, { seed: 4 });
    assert.equal(s.length, n, `${f} ${n}`);
    const mx = s.reduce((a, o) => a + o.x, 0) / n, mz = s.reduce((a, o) => a + o.z, 0) / n;
    assert.ok(Math.abs(mx) < 0.35 && Math.abs(mz) < 0.35, `${f} ${n} centred (${mx.toFixed(2)}, ${mz.toFixed(2)})`);
    assert.deepEqual(s, formationSlots(f, n, { seed: 4 }), `${f} deterministic`);
    if (n <= 150) { let min = Infinity; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) min = Math.min(min, Math.hypot(s[i].x - s[j].x, s[i].z - s[j].z)); if (n > 1) assert.ok(min > 0.45, `${f} ${n}: min gap ${min.toFixed(2)}`); }
    for (const o of s) { assert.ok(o.phase >= 0 && o.phase < 1 && o.jitter >= 0 && o.jitter < 1); }
  }
});
test("formations: shapes read as their names (block wider than deep, column narrow, wedge tip in front, line 1 deep)", () => {
  const ext = (f, n) => formationExtent(formationSlots(f, n, { seed: 2 }));
  const b = ext("block", 200), c = ext("column", 200), l = ext("line", 30);
  assert.ok(b.halfW > b.halfD, "block wider than deep");
  assert.ok(c.halfD > c.halfW, "column deeper than wide");
  assert.ok(l.halfD < 1, "a line is one rank");
  const w = formationSlots("wedge", 16, { seed: 1 }), front = w.reduce((m, o) => (o.z > m.z ? o : m));
  assert.equal(front.row, 0); assert.ok(Math.abs(front.x) < 0.3, "the wedge's tip is the single front character");
  assert.equal(formationSlots("nonsense", 9).length, 9, "unknown -> block");
  assert.deepEqual(formationSlots("block", 0), []);
});
test("the builder's crowd vocabulary is a subset of ours", () => {
  for (const f of CROWD_FORMATIONS) assert.ok(FORMATIONS.includes(f), f);
  for (const a of BUILDER_ACTIONS) assert.ok(CROWD_ACTIONS.includes(a), a);
});
test("crowd motion: march keeps step and moves forward; charge faster; flee turns around; cheer jumps; deterministic", () => {
  const s1 = { phase: 0.1, jitter: 0.3, row: 0 }, s2 = { phase: 0.7, jitter: 0.8, row: 3 };
  const m1 = crowdMotion("march", 2, s1), m2 = crowdMotion("march", 2, s2);
  assert.ok(near(m1.legSwing, m2.legSwing, 1e-3), "marching soldiers keep step");
  assert.ok(m1.dz > 2 && m1.dz < 3.5, `march ~1.5 m/s (${m1.dz})`);
  const c = crowdMotion("charge", 2, s1);
  assert.ok(c.dz > m1.dz * 2, "charge faster than march"); assert.ok(c.weapon > 0.9, "spears levelled"); assert.ok(c.lean > 0.2);
  const f = crowdMotion("flee", 2, s1);
  assert.ok(f.dz < -2, "flee runs back"); assert.ok(Math.abs(f.yaw - Math.PI) < 0.6, "and faces away");
  const jumps = [0.1, 0.2, 0.3, 0.4].map((t) => crowdMotion("cheer", t, s1).jump);
  assert.ok(Math.max(...jumps) > 0.1, "cheer jumps"); assert.ok(crowdMotion("cheer", 1, s1).armL < -2, "arms up");
  assert.deepEqual(crowdMotion("charge", 1.234, s2), crowdMotion("charge", 1.234, s2));
  const st = crowdMotion("stand", 5, s1); assert.equal(st.dz, 0); assert.equal(st.dx, 0);
  assert.equal(crowdMotion("charge", 0, s2).dz, 0, "no jump at the cut");
  for (const a of CROWD_ACTIONS) for (const k of Object.values(crowdMotion(a, 1.7, s2))) assert.ok(Number.isFinite(k), a);
});
test("giants: bigger walks slower; footfalls inside the window, ordered, about cadence x feet", () => {
  const small = gaitOf("turtle", "walk", 30), big = gaitOf("turtle", "walk", 120);
  assert.ok(big.cadence < small.cadence && big.stride > small.stride);
  const ff = giantFootfalls("wolf", "walk", 0, 4, { size: 75 });
  assert.ok(ff.length >= 2 && ff.every((t, i) => t >= 0 && t < 4 && (i === 0 || t > ff[i - 1])));
  const g = gaitOf("wolf", "walk", 75); assert.ok(Math.abs(ff.length - 4 * g.cadence * 2) <= 1.01);
  const st = giantFootfalls("elephant", "stomp", 0, 5, { size: 80 });
  assert.ok(st.length >= 1 && st.length <= 4, `stomps ${st}`);
  assert.deepEqual(giantFootfalls("whale", "swim", 0, 5), [], "whales have no feet");
});
test("shake: zero before the hit, peaks after it, decays; deterministic; none is zero", () => {
  assert.equal(shake("impact", 0.4, { at: 0.5 }).k, 0);
  const a = shake("impact", 0.56, { at: 0.5 }), b = shake("impact", 1.6, { at: 0.5 });
  assert.ok(a.k > 0.5 && b.k < 0.05);
  assert.deepEqual(shake("impact", 0.73, { at: 0.5, seed: 9 }), shake("impact", 0.73, { at: 0.5, seed: 9 }));
  assert.notDeepEqual(shake("impact", 0.73, { at: 0.5, seed: 9 }), shake("impact", 0.73, { at: 0.5, seed: 10 }));
  assert.equal(shake("none", 1).k, 0); assert.equal(shake("bogus", 1).k, 0);
  const st = [0.62, 2.02].map((t) => shake("stomp", t, { at: 0.6 }).k); assert.ok(st[0] > 0.5 && st[1] > 0.5, "stomp repeats each period");
  const r = shake("rumble", 1, { dur: 3 }); assert.ok(r.k > 0.9 && Math.abs(r.roll) < 0.01, "rumble: continuous, small");
  for (const p of SHAKES) { const s = shake(p, 0.7, { at: 0.5, dur: 2 }); assert.ok(Math.abs(s.pitch) < 0.08 && Math.abs(s.x) < 0.2, p); }
});
test("beats: every beat has a plan; times inside the shot; roles and sfx names known", () => {
  for (const type of BEAT_TYPES) {
    const p = beatPlan(type, 2.5);
    assert.ok(p, type); assert.ok(SHAKES.includes(p.shake.preset));
    assert.ok(p.shake.at >= 0 && p.shake.at <= 2.5);
    for (const s of p.sfx) { assert.ok(s.at >= 0 && s.at <= 2.5, `${type} ${s.name}`); assert.ok(EPIC_SFX_TIMING[s.name] || ["whoosh_2", "crowd_cheer"].includes(s.name), `${type}: sfx ${s.name} has a sound`); }
    assert.ok(Object.keys(p.roles).length >= 1);
  }
  assert.equal(beatPlan("attack", 2, { shake: "none" }).shake.preset, "none");
  assert.equal(beatPlan("nope", 2), null);
  const mv = BEATS.chase.roles.chaser.move; assert.equal(beatProgress(mv, 0), 0); assert.equal(beatProgress(mv, 1), 1);
  const at = BEATS.attack; assert.equal(beatPlan("attack", 2).shake.at, at.shake.at * 2, "the impact shake lands on the attack's hit");
  assert.ok(beatPlan("attack", 2).sfx.some((s) => s.name === "impact_big" && s.at === beatPlan("attack", 2).shake.at), "impact SFX on the hit");
});
test("schema: the dev timeline is valid; bad EPIC fields are each reported", () => {
  const tl = buildTimeline();
  assert.deepEqual(validateEpic(tl), []);
  const base = { start: 0, end: 2, set: "creature:x", camera: "establish" };
  const T = { giants: { wolf: { kind: "wolf", size: 70 } }, worlds: { x: { creature: "turtle", view: "inside" } } };
  assert.deepEqual(validateEpicShot({ ...base, giants: [{ id: "wolf", action: "walk", spot: "far" }] }, T), []);
  const bad = validateEpicShot({ ...base, set: "creature:nope", giants: [{ id: "bob", action: "dance", spot: "moon", pos: [1, 2] }], crowds: [{ kind: "aliens", count: 0, formation: "blob", action: "sing", spot: "moon" }, 5], beat: { type: "attack", shake: "earthquake" }, world: { kind: "town", view: "under" } }, T);
  for (const re of [/creature:nope/, /giant "bob"/, /action "dance"/, /spot "moon"/, /pos must be/, /kind "aliens"/, /count must be/, /formation "blob"/, /action "sing"/, /crowds\[1\]/, /shake "earthquake"/, /world.kind/, /world.view/]) assert.ok(bad.some((b) => re.test(b)), `${re} in ${bad.join(" | ")}`);
  assert.ok(validateEpicShot({ start: 0, end: 1, set: "street", camera: "establish" }, T).some((b) => /needs giants/.test(b)), "an EPIC camera on an empty shot is refused");
  assert.ok(validateEpic({ giants: { g: { kind: "wolf", size: 900 } }, shots: [] }).some((b) => /size/.test(b)));
  assert.ok(validateEpic({ giants: { g: { kind: "unicorn" } }, shots: [] }).some((b) => /params/.test(b)), "unknown kinds need params");
});
test("SFX: the dev timeline gives EPIC candidates (roar, march, charge, impact, splash) in the lib/sfx.js shape", () => {
  const c = epicSfxCandidates(buildTimeline());
  const names = new Set(c.map((x) => x.name));
  for (const n of ["roar_big", "army_march", "impact_big", "splash_big"]) assert.ok(names.has(n), `${n} in ${[...names]}`);
  for (const x of c) { assert.ok(Number.isFinite(x.at) && x.at >= 0 && x.prio > 0 && x.why); assert.ok(EPIC_SFX_TIMING[x.name] || ["crowd_cheer", "whoosh_2"].includes(x.name), x.name); }
});
test("EPIC SFX: the catalog matches EPIC_SFX_TIMING and the built files exist (if built)", async () => {
  const { SFX_EPIC } = await import("../audio/sfxEpic.mjs");
  assert.deepEqual(Object.keys(SFX_EPIC).sort(), Object.keys(EPIC_SFX_TIMING).sort());
  for (const [n, [dur, anchor, gain]] of Object.entries(EPIC_SFX_TIMING)) { assert.equal(SFX_EPIC[n].dur, dur, n); assert.equal(SFX_EPIC[n].anchor, anchor, n); assert.equal(SFX_EPIC[n].gainDb, gain, n); }
  const dir = path.join(ENGINE, "audio", "sfx");
  for (const n of Object.keys(SFX_EPIC)) { const f = path.join(dir, `${n}.wav`); if (fs.existsSync(f)) assert.ok(fs.statSync(f).size > 10000, n); }
});
