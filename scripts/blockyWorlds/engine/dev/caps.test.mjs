// CAPABILITIES agent tests (2026-11-06): lib/caps.js (schema, determinism per frame, planner vocabulary, the old gap
// kinds), the registry entries, the back-town plan, and the camera moves (Node + three, no browser).
//   node --test dev/caps.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  MOVES, TETHER_STATES, tetherState, tetherPoint, snapHalf, burstPiece, siegeTiming, ballistic, parseAnchor, validateCaps,
  validateCapsShot, capsSfxCues, suggestCaps, capabilityForGap, usesCaps, usesCapsTimeline, moveSpec,
} from "../lib/caps.js";
import { CAPABILITIES, supports, registryForPrompt } from "../lib/capabilities.js";
import { nowMetBy, annotateGaps } from "../lib/gaps.js";
import { buildCapsTimeline, SHOTS } from "./capsTimeline.mjs";
import { validateEpic } from "../lib/epic.js";
import { applyMove } from "../page/cameraMoves.js";
import { planBackTown, terraceLayout } from "../page/kit/backTown.js";

test("schema: the proof timeline is valid (EPIC + caps) and every capability field is used", () => {
  const tl = buildCapsTimeline();
  assert.deepEqual([...validateEpic(tl), ...validateCaps(tl)], []);
  const used = new Set(tl.shots.flatMap((s) => Object.keys(s).filter((k) => ["move", "tethers", "siege", "fx", "acts", "grade", "tilt"].includes(k))));
  for (const k of ["move", "tethers", "siege", "fx", "acts", "grade", "tilt"]) assert.ok(used.has(k), k);
  assert.ok(usesCapsTimeline(tl));
  assert.equal(tl.shots.length, SHOTS.length);
});

test("schema: bad fields are named, not thrown", () => {
  const tl = { giants: { wolf: { kind: "wolf" } }, shots: [] };
  const bad = validateCapsShot({ set: "street", move: "spin", tethers: [{ from: "giant:nobody.head", to: [0, 0, 0], kind: "noodle", state: "melt" }], siege: [{ kind: "laser", at: "spot:x" }], fx: [{ kind: "rainbow" }], acts: [{ kind: "nuzzle", giant: "wolf" }], grade: "noir", tilt: { deg: 90 } }, tl, 3);
  for (const w of ["move", "from", "kind", "state", "siege[0] kind", "fx[0]", "needs \"to\"", "grade", "tilt"]) assert.ok(bad.some((b) => b.includes(w)), `${w}: ${bad.join(" | ")}`);
  // "world" anchors need a creature set
  assert.ok(validateCapsShot({ set: "street", tethers: [{ from: "world.head", to: [0, 0, 0] }] }, tl, 0).length === 1);
  assert.deepEqual(validateCapsShot({ set: "creature:t", tethers: [{ from: "world.head", to: "giant:wolf.leg2", state: "snap", at: 0.4 }] }, tl, 0), []);
  assert.equal(usesCaps({}), false); assert.equal(usesCaps({ move: "orbit" }), true);
});

test("anchors parse", () => {
  assert.deepEqual(parseAnchor("giant:wolf.leg0"), { type: "giant", id: "wolf", part: "leg0" });
  assert.deepEqual(parseAnchor("world.back"), { type: "giant", id: "world", part: "back" });
  assert.deepEqual(parseAnchor("crowd:2"), { type: "crowd", id: 2 });
  assert.deepEqual(parseAnchor([1, 2, 3]), { type: "pos", pos: [1, 2, 3] });
  assert.deepEqual(parseAnchor({ at: "actor:me", off: [0, 1, 0] }), { type: "actor", id: "me", off: [0, 1, 0] });
  assert.equal(parseAnchor("nonsense"), null);
});

test("determinism per frame: the same (state, time, seed) gives the same numbers; any frame stands alone", () => {
  for (const st of TETHER_STATES) for (const u of [0, 0.2, 0.45, 0.46, 0.7, 1]) {
    const a = tetherState(st, u, { at: 0.45, seed: 3, dur: 2.4 }), b = tetherState(st, u, { at: 0.45, seed: 3, dur: 2.4 });
    assert.deepEqual(a, b, `${st} ${u}`);
    for (const v of Object.values(a)) if (typeof v === "number") assert.ok(Number.isFinite(v), `${st} ${u}`);
  }
  // snap: whole before, broken after, the jolt at the break
  assert.equal(tetherState("snap", 0.4, { at: 0.45 }).broken, false);
  const s = tetherState("snap", 0.47, { at: 0.45, dur: 2 }); assert.equal(s.broken, true); assert.ok(s.jolt > 0.8);
  // fire: the line pays out, then lands
  assert.equal(tetherState("fire", 0.05, { at: 0.1, until: 0.5 }).reach, 0);
  assert.ok(tetherState("fire", 0.3, { at: 0.1, until: 0.5 }).reach > 0.3);
  assert.equal(tetherState("fire", 0.6, { at: 0.1, until: 0.5 }).reach, 1);
  // pieces and points
  assert.deepEqual(burstPiece(3, 12, 0.5, { seed: 9 }), burstPiece(3, 12, 0.5, { seed: 9 }));
  assert.notDeepEqual(burstPiece(3, 12, 0.5, { seed: 9 }), burstPiece(4, 12, 0.5, { seed: 9 }));
  const p0 = tetherPoint([0, 10, 0], [100, 10, 0], 0, { sag: 0.1, swing: 0 }), pm = tetherPoint([0, 10, 0], [100, 10, 0], 0.5, { sag: 0.1, swing: 0 });
  assert.deepEqual(p0, [0, 10, 0]); assert.ok(Math.abs(pm[1] - 0) < 1e-9); // 10 - 0.1 * 100 * 4 * 0.25
  const h = snapHalf([0, 20, 0], [50, 18, 0], 1, 1, 30); assert.ok(h[1] < 18 && Math.abs(h[0]) < 50);
});

test("siege timing and the ballistic arc", () => {
  const tm = siegeTiming({ fireAt: 0.2 }, 2.5, 90);
  assert.ok(Math.abs(tm.fireAt - 0.5) < 1e-9 && tm.impactAt < 2.5);
  assert.equal(ballistic([0, 0, 0], [90, 0, 0], 0.4, tm), null);
  const mid = ballistic([0, 0, 0], [90, 0, 0], tm.fireAt + tm.flight / 2, tm); assert.ok(mid.pos[1] > 10 && Math.abs(mid.pos[0] - 45) < 1e-6);
  const end = ballistic([0, 0, 0], [90, 5, 0], tm.impactAt + 0.3, tm); assert.equal(end.landed, true); assert.deepEqual(end.pos.map((v) => +v.toFixed(6)), [90, 5, 0]);
  const cues = capsSfxCues({ start: 0, end: 2.5, siege: [{ kind: "cannon", at: [0, 0, 0], fireAt: 0.2 }], tethers: [{ from: [0, 0, 0], to: [1, 0, 0], state: "snap", at: 0.5 }] });
  assert.deepEqual(cues.map((c) => c.cue).sort(), ["cannon_fire", "chain_snap", "impact_boom"]); assert.ok(cues.every((c, i) => i === 0 || c.at >= cues[i - 1].at));
});

test("camera moves: every move frames a giant and a person, deterministic, aimed at the subject", () => {
  const cam = () => { const c = new THREE.PerspectiveCamera(50, 9 / 16, 0.1, 5000); return c; };
  for (const move of MOVES) for (const subj of [{ focus: new THREE.Vector3(0, 0, -100), focusHeight: 60, span: 130 }, { focus: new THREE.Vector3(2, 0, 1), focusHeight: 1.2, span: 4 }]) {
    const run = (t) => { const c = cam(); applyMove(move, { THREE, camera: c, ...subj, focus: subj.focus.clone(), t, dur: 2.5, seed: 7 }); return c; };
    const a = run(1.1), b = run(1.1);
    assert.deepEqual(a.position.toArray(), b.position.toArray(), move);
    assert.ok(a.position.toArray().every(Number.isFinite), move);
    // the subject is in front of the lens
    const toS = subj.focus.clone().add(new THREE.Vector3(0, subj.focusHeight / 2, 0)).sub(a.position).normalize();
    assert.ok(toS.dot(a.getWorldDirection(new THREE.Vector3())) > 0.2, `${move} looks at it`);
  }
  // tilt_up really tilts up; orbit really goes round
  const pitch = (t) => { const c = cam(); applyMove("tilt_up", { THREE, camera: c, focus: new THREE.Vector3(), focusHeight: 60, span: 100, t, dur: 2 }); return c.getWorldDirection(new THREE.Vector3()).y; };
  assert.ok(pitch(1.9) > pitch(0.1) + 0.3);
  const yawAt = (t) => { const c = cam(); applyMove("orbit", { THREE, camera: c, focus: new THREE.Vector3(), focusHeight: 60, span: 100, t, dur: 2, seed: 3 }); return Math.atan2(c.position.x, c.position.z); };
  assert.ok(Math.abs(yawAt(1.9) - yawAt(0.1)) > 0.8);
  assert.equal(moveSpec("orbit", 3).type, "orbit");
});

test("back town plan: scales with the host, landmarks with signs, a castle skyline for a villain, terraces on a dome", () => {
  const flat = (x, z) => (Math.abs(x) < 40 && Math.abs(z) < 60 ? 30 : null), region = { x0: -40, x1: 40, z0: -60, z1: 60 };
  const town = planBackTown(region, flat, { style: "town", landmarks: ["school", "grocery", "hospital"], seed: 4 });
  assert.ok(town.houses.length >= 20, `${town.houses.length} houses`);
  assert.deepEqual(town.landmarks.map((l) => l.text), ["SCHOOL", "GROCERY", "HOSPITAL"]);
  assert.equal(town.towers.length, 0);
  const castle = planBackTown(region, flat, { style: "castle", seed: 4 });
  assert.ok(castle.towers.length >= 30 && castle.wall, `${castle.towers.length} towers`);
  assert.deepEqual(planBackTown(region, flat, { style: "castle", seed: 4 }), castle); // deterministic
  const small = planBackTown({ x0: -8, x1: 8, z0: -10, z1: 10 }, (x, z) => (Math.abs(x) < 8 && Math.abs(z) < 10 ? 5 : null), { style: "town", seed: 2 });
  assert.ok(small.scale < town.scale);
  // a dome: houses step down it (sink), none hangs off the edge
  const dome = (x, z) => { const q = 1 - (x / 40) ** 2 - (z / 60) ** 2; return q <= 0.02 ? null : 30 * Math.sqrt(q); };
  const ter = terraceLayout({ surface: dome, region, count: 60, seed: 3, size: [6, 9], tall: [4.5, 8] });
  assert.ok(ter.length >= 25, `${ter.length} on the dome`);
  assert.ok(ter.some((h) => h.sink > 1));
});

test("planner vocabulary: words -> capability fields (valid against the schema)", () => {
  const ctx = { giants: ["wolf"], set: "creature:turtle_out", focus: "giant:wolf" };
  const cases = [
    ["From his paws up to his towers.", (o) => o.move === "tilt_up"],
    ["Then the chain snapped.", (o) => o.tethers?.[0].state === "snap"],
    ["They threw their ropes around his legs.", (o) => o.tethers?.[0].state === "fire" && o.tethers[0].kind === "rope"],
    ["Fire the cannons!", (o) => o.siege?.[0].kind === "cannon"],
    ["The catapults hurled rocks.", (o) => o.siege?.[0].kind === "catapult"],
    ["Long ago, he was just a pup.", (o) => o.grade === "flashback"],
    ["The whole street tipped, and we slid.", (o) => o.tilt?.slide === true],
    ["He pressed his head to her shell.", (o) => o.acts?.[0].kind === "nuzzle"],
    ["Our turtle eats whole trees.", (o) => o.acts?.[0].kind === "eat_tree"],
    ["A shield went up over the shell.", (o) => o.fx?.[0].kind === "shield_dome"],
    ["Now a bridge joins our towns.", (o) => o.tethers?.some((t) => t.kind === "bridge")],
    ["We flew down our own street.", (o) => o.move === "fpv"],
  ];
  for (const [line, ok] of cases) {
    const o = suggestCaps(line, ctx);
    assert.ok(ok(o), `${line} -> ${JSON.stringify(o)}`);
    const shot = { set: ctx.set, ...o };
    assert.deepEqual(validateCapsShot(shot, { giants: { wolf: {} } }, 0), [], line);
  }
  assert.equal(suggestCaps("I was asleep when it began.", { focus: "me", set: "bedroom" }).move, "top_down");
  assert.deepEqual(suggestCaps("We had pancakes for breakfast.", ctx), {});
  const horn = suggestCaps("I blew the horn as hard as I could.", { ...ctx, focus: "me" });
  assert.equal(horn.fx[0].at, "actor:me");
});

test("registry: the new capabilities are registered with examples, and the old gap kinds map to them", () => {
  for (const id of ["tether", "siege", "world.backtown", "camera.move", "fx.caps", "giant.act", "grade.flashback", "world.tilt"]) {
    const c = CAPABILITIES[id]; assert.ok(c, id);
    assert.ok(c.examples?.length >= 1, `${id} examples`);
    assert.equal(c.status, "ready");
  }
  assert.equal(supports("camera.move", { move: "tilt_up" }).ok, true);
  assert.deepEqual(supports("tether", { kind: "chain", state: ["snap", "fire"] }).unsupported, []);
  assert.deepEqual(supports("siege", { kind: "laser" }).unsupported, ["kind=laser"]);
  assert.match(registryForPrompt(), /- tether: .* e\.g\. tethers:/);
  const gaps = ["chain / ropes / hooks tying two giants (+ ballista/cannons firing them)", "a lit skyscraper/castle city on the wolf's back", "tilt-up reveal (chain -> city, legs -> head)", "orbit move around a giant", "giant eats a tree (chewing + leaves burst)", "first-person POV fly-through down a street", "transparent shield dome over the shell", "flashback look (young white wolf)", "true top-down camera on a person", "tilted world (street on the shell tips, people slide)", "sound-wave rings VFX from a horn", "two giants touching (affection beat: forehead to shell)", "bridge between two creatures' backs", "giant preset missing: bird", "giant preset missing: deer"];
  const want = ["tethers", "backTown", "move:tilt_up", "move:orbit", "acts:eat_tree", "move:fpv", "fx:shield_dome", "grade:flashback", "move:top_down", "tilt", "fx:sound_rings", "acts:nuzzle", "tethers:bridge", "giants.kind", "giants.kind"];
  gaps.forEach((g, i) => assert.equal(capabilityForGap(g)?.field, want[i], g));
  for (const r of annotateGaps(gaps.map((g) => ({ detail: g })))) assert.ok(CAPABILITIES[r.nowMetBy.capability], r.detail);
  assert.equal(nowMetBy({ detail: "set missing: house_interior" }), null);
});

// REBUILD agent (2026-11-06): the planner wiring (plan.mjs runs lib/caps.js capsPass after the coast pass)
test("planner: capsPass adds capability fields from each shot's own words, keeps the checks clean, cards get none", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { planVideo, checkTimeline, estimateWords } = await import("../plan.mjs");
  const { directStory } = await import("../lib/director/index.js");
  const { openingSec } = await import("../lib/opening.js");
  const { capsPass } = await import("../lib/caps.js");
  const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
  const TW = JSON.parse(fs.readFileSync(path.join(ENGINE, "dev", "scripts", "turtle_wolf.json"), "utf8"));
  const direction = await directStory({ script: TW, idea: TW.idea, provider: "mock", exists });
  const tl = planVideo({ script: TW, words: estimateWords(TW), idea: TW.idea, lengthSec: 90, direction, exists });
  assert.deepEqual(checkTimeline(tl), []);
  assert.ok(tl.direction.caps?.added >= 1, "some shot got a capability field");
  const F = ["move", "tethers", "siege", "fx", "acts", "grade", "tilt"];
  const w0 = openingSec(tl.shots);
  for (const s of tl.shots) {
    if (s.camera === "insert" || s.insert) assert.ok(!F.some((k) => s[k] != null), "a card gets no capability field");
    if (s.start < w0 - 1e-6) assert.ok(!F.filter((k) => k !== "move").some((k) => s[k] != null), "the opening window gets only a move");
  }
  // idempotent: a second pass adds nothing new
  assert.equal(capsPass(tl, { check: checkTimeline, openUntil: w0 }).added, 0);
  // a hand-made shot: the snap word gives a snapping chain to the villain; a field that breaks the schema is undone
  const t2 = { giants: { wolf: {} }, captions: [{ word: "Snap!", start: 0.1, end: 0.4 }, { word: "The", start: 0.5, end: 0.6 }, { word: "chain", start: 0.6, end: 0.9 }], shots: [{ start: 0, end: 2, set: "creature:t", camera: "giant_close", focus: "giant:wolf", giants: [{ id: "world" }, { id: "wolf" }] }] };
  assert.equal(capsPass(t2).added, 1);
  assert.equal(t2.shots[0].tethers[0].state, "snap");
  const t3 = { giants: {}, captions: [{ word: "chain", start: 0.1, end: 0.4 }], shots: [{ start: 0, end: 2, set: "street", camera: "wide", focus: "me", giants: [{ id: "ghost" }] }] };
  assert.equal(capsPass(t3).added, 0);
});
