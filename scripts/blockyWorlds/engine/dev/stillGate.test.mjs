// THE HARD STILL GATE (owner, 2026-11-09): lib/stillGate.js (pixel + geometry rules), lib/vision/gatePass.js (the
// prepare step: gate -> re-plan ladder -> gate again), the worker's verdict (runpod/worker.mjs stillGateFailure).
// Free: no render, no Chrome, no paid call. The step-3 calibration test runs only when that folder + ffmpeg exist.
//   node --test dev/stillGate.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GRID, pixelStats, pixelReasons, measureGeometry, geoReasons, gateStill, subjectSpec } from "../lib/stillGate.js";
import { gateShots, alternatives, borrowedFraming, makeGateCache, shotKey, frameKey, gateSummary, gateRejects } from "../lib/vision/gatePass.js";
import { stillGateFailure, stillGateMode, gateBrief } from "../runpod/worker.mjs";
import { calibrate, score, STEP3_DEFAULT } from "./stillGateCalibrate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = JSON.parse(fs.readFileSync(path.join(HERE, "fixtures", "stillGate", "grids.json"), "utf8"));
const rgba = (b64) => { const rgb = Buffer.from(b64, "base64"), n = rgb.length / 3, o = new Uint8Array(n * 4); for (let i = 0; i < n; i++) { o[i * 4] = rgb[i * 3]; o[i * 4 + 1] = rgb[i * 3 + 1]; o[i * 4 + 2] = rgb[i * 3 + 2]; o[i * 4 + 3] = 255; } return o; };
const solid = (r, g, b) => { const o = new Uint8Array(GRID.w * GRID.h * 4); for (let i = 0; i < o.length; i += 4) { o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = 255; } return o; };

// ------------------------------------------------------------------------------------------------ pixels
test("pixel gate: every labelled blank fixture fails, every good one passes (step-3 stills)", () => {
  for (const it of FIX.items) {
    const codes = pixelReasons(pixelStats(rgba(it.rgb), FIX.w, FIX.h)).map((r) => r.code);
    if (it.label === "blank") assert.ok(codes.length, `${it.id} should fail`);
    else assert.deepEqual(codes, [], `${it.id} should pass (got ${codes.join("+")})`);
  }
});

test("pixel gate: the owner's rules on synthetic frames", () => {
  assert.ok(pixelReasons(pixelStats(solid(200, 180, 140))).some((r) => r.code === "flat"), "one beige colour = flat");
  assert.ok(pixelReasons(pixelStats(solid(90, 160, 235))).some((r) => r.code === "sky_only"), "all day-sky blue = sky only");
  assert.ok(pixelReasons(pixelStats(solid(8, 8, 10))).some((r) => r.code === "too_dark"), "black = too dark");
  assert.ok(pixelReasons(pixelStats(solid(250, 250, 250))).some((r) => r.code === "blown_out"), "white = blown out");
  // 55% one colour + a busy rest: under the owner's 60 %, no flat
  const px = solid(200, 180, 140);
  for (let i = 0; i < GRID.w * GRID.h; i++) if (i / (GRID.w * GRID.h) > 0.55) { const k = i * 4, c = (i * 97) % 255; px[k] = c; px[k + 1] = 255 - c; px[k + 2] = (c * 3) % 255; }
  assert.ok(!pixelReasons(pixelStats(px)).some((r) => r.code === "flat"));
});

const STEP3 = process.env.STEP3_DIR ?? STEP3_DEFAULT;
const hasFfmpeg = spawnSync(process.env.FFMPEG ?? "ffmpeg", ["-version"]).status === 0;
test("pixel gate calibration on the step-3 stills (skipped when the folder or ffmpeg is missing)", { skip: !(fs.existsSync(path.join(STEP3, "problems.json")) && hasFfmpeg) && "no step-3 folder / ffmpeg" }, () => {
  const s = score(calibrate(STEP3));
  // 2026-11-09: 22 / 39 labelled blanks caught by pixels alone, 3 / 263 good stills flagged (two of them a dog on a
  // 62 % plain floor: the owner's literal 60 % rule). The rest of the blanks need the geometry rules (in the page).
  assert.ok(s.caught >= 22, `pixel recall fell: ${s.caught}/${s.blank} (missed ${s.missed.join(" ")})`);
  // GATE 2026-11-09: the owner's blank rule (one smooth region > 45%, the look gate's measure) also fails frames the step-3
  // reviewers had passed: 3:s36 / 3:s45 (night sky), 4:s21 / 4:s22 (the dog on a plain floor), 5:s17: allowed here
  const BLANK_OK = new Set(["3:s36", "3:s45", "4:s21", "4:s22", "5:s17"]);
  const others = s.falseList.filter((x) => !BLANK_OK.has(x.split(" ")[0]));
  assert.ok(others.length <= 3, `false alarms rose: ${others.join(", ")}`);
});

// ------------------------------------------------------------------------------------------------ geometry (three.js, no GL)
function scene0() {
  const scene = new THREE.Scene();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial()); ground.name = "ground"; scene.add(ground);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 8, 6), new THREE.MeshBasicMaterial({ side: THREE.BackSide })); scene.add(sky); // a sky dome never counts
  const p = new THREE.Group(); p.name = "person:me"; p.userData.id = "me";
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.3), new THREE.MeshStandardMaterial()); body.position.y = 0.85; p.add(body);
  const head = new THREE.Group(); head.position.y = 1.55; p.add(head); p.userData.joints = { head };
  scene.add(p);
  const cam = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 1000); cam.position.set(0, 1.5, 4); cam.lookAt(0, 1.2, 0);
  scene.updateMatrixWorld(true);
  return { scene, p, cam };
}
const SHOT = { focus: "me", camera: "medium", actors: [{ id: "me" }] };
const codesOf = (g, shot = SHOT) => geoReasons(g, shot).fail.map((f) => f.code);

test("geometry gate: a normal medium shot passes; looking away / at the sky misses the subject", () => {
  const { scene, cam } = scene0();
  assert.deepEqual(codesOf(measureGeometry(THREE, scene, cam, SHOT)), []);
  cam.lookAt(0, 1.5, 10);
  assert.deepEqual(codesOf(measureGeometry(THREE, scene, cam, SHOT)), ["subject_missing"]);
  cam.lookAt(0, 40, 3.5);
  const g = measureGeometry(THREE, scene, cam, SHOT);
  assert.ok(codesOf(g).includes("sky_only") && g.sky > 0.9, JSON.stringify(g));
});

test("geometry gate: the camera inside a box, a wall in front of the subject (never a wall behind it)", () => {
  const { scene, cam } = scene0();
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial()); box.name = "object:crate:on"; scene.add(box);
  box.position.set(0, 1.5, 4); scene.updateMatrixWorld(true);
  let g = measureGeometry(THREE, scene, cam, SHOT);
  assert.ok(codesOf(g).includes("camera_inside"), JSON.stringify(g));
  assert.equal(box.material.side, THREE.FrontSide, "materials are put back after the rays");
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 0.2), new THREE.MeshStandardMaterial()); scene.add(wall);
  box.visible = false; wall.position.set(0, 1.5, 2.5); scene.updateMatrixWorld(true);
  g = measureGeometry(THREE, scene, cam, SHOT);
  assert.ok(codesOf(g).includes("blocked") && codesOf(g).includes("subject_missing"), JSON.stringify(g));
  wall.position.set(0, 1.5, -1.5); scene.updateMatrixWorld(true);
  assert.deepEqual(codesOf(measureGeometry(THREE, scene, cam, SHOT)), [], "a wall behind the subject is the background");
});

test("geometry gate: subjects by focus (group, crowd, giant, object) and the face warning", () => {
  assert.equal(subjectSpec({ focus: "group", actors: [{ id: "a" }] }).mode, "any");
  assert.deepEqual(subjectSpec({ focus: "giant:wolf" }).names, ["giant:wolf"]);
  assert.equal(subjectSpec({ focus: "x", camera: "insert" }).mode, "none");
  const { scene, p, cam } = scene0();
  // a giant the shot is about but that is not on the set (the indoor Watcher): subject missing
  assert.ok(codesOf(measureGeometry(THREE, scene, cam, { focus: "giant:watcher" }), { focus: "giant:watcher" }).includes("subject_missing"));
  const giant = new THREE.Group(); giant.name = "giant:watcher"; const gm = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 3), new THREE.MeshStandardMaterial()); gm.position.y = 4; giant.add(gm); giant.position.set(2, 0, -6); scene.add(giant); scene.updateMatrixWorld(true);
  assert.deepEqual(codesOf(measureGeometry(THREE, scene, cam, { focus: "giant:watcher" }), { focus: "giant:watcher" }), []);
  giant.visible = false;
  assert.ok(codesOf(measureGeometry(THREE, scene, cam, { focus: "giant:watcher" }), { focus: "giant:watcher" }).includes("subject_missing"), "an invisible giant is not on screen");
  // INSERTS 2026-11-10 (#3 s67 / s68): a wolf whose head pokes in at the frame's edge, the body out of frame, is NOT
  // seen (the head anchor alone passed it); the whole wolf in frame is; its close-up keeps the head-anchor rule
  const wolf = new THREE.Group(); wolf.name = "giant:wolf"; const mat = new THREE.MeshStandardMaterial();
  for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); b.position.set(-k * 1.0, 1, 0); wolf.add(b); }
  const hj = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mat); hj.position.set(0.8, 1.2, 0); wolf.add(hj); wolf.userData.joints = { head: hj };
  wolf.position.set(-1.85, 0, -2); scene.add(wolf); scene.updateMatrixWorld(true);
  const W = { focus: "giant:wolf", camera: "establish", actors: [] };
  const gw = measureGeometry(THREE, scene, cam, W);
  assert.ok(gw.subject.anchors[0].inFrame, "the head anchor is in frame");
  assert.ok(codesOf(gw, W).includes("subject_missing"), `a head at the edge is no wolf: ${JSON.stringify(gw.subject)}`);
  assert.deepEqual(codesOf(measureGeometry(THREE, scene, cam, { ...W, camera: "giant_close" }), { ...W, camera: "giant_close" }).filter((c) => c === "subject_missing"), [], "giant_close: the head is the subject");
  wolf.position.set(1.0, 0, -12); scene.updateMatrixWorld(true);
  assert.ok(!codesOf(measureGeometry(THREE, scene, cam, W), W).includes("subject_missing"), "the whole wolf in frame is seen");
  wolf.visible = false; scene.updateMatrixWorld(true);
  p.rotation.y = Math.PI; scene.updateMatrixWorld(true);
  const w = geoReasons(measureGeometry(THREE, scene, cam, SHOT), SHOT);
  assert.deepEqual(w.fail, []); assert.equal(w.warn[0]?.code, "face_hidden");
});

test("gateStill joins pixels and geometry", () => {
  const v = gateStill({ stats: pixelStats(solid(200, 180, 140)), geo: { inside: 0.9, near: 0, sky: 0, block: 0, subject: { mode: "none" } } });
  assert.equal(v.pass, false); assert.deepEqual(v.codes.sort(), ["blank", "camera_inside", "flat"]); // (a solid frame is also blank)
  assert.equal(gateSummary({ verdict: v }).pass, false);
});

// ------------------------------------------------------------------------------------------------ the pass (fake renderer)
const shotsTl = () => ({ duration: 8, width: 1080, height: 1920, cast: { me: {}, ann: {} }, shots: [
  { start: 0, end: 2, line: 0, set: "street", camera: "wide", focus: "me", actors: [{ id: "me" }, { id: "ann" }] },
  { start: 2, end: 4, line: 1, set: "street", camera: "low", focus: "me", subject: "me", actors: [{ id: "me", pose: "run" }, { id: "ann" }], camMove: { type: "push_in" } },
  { start: 4, end: 6, line: 2, set: "street", camera: "insert", focus: "me", actors: [] },
  { start: 6, end: 8, line: 3, set: "street", camera: "over_shoulder", focus: "ann", actors: [{ id: "me" }, { id: "ann" }] },
] });
/** a renderer whose verdict is a function of the framing: judge(shot) -> codes[] */
function fakeRenderer(judge) {
  const calls = [];
  return { calls, async renderTimeline(tl, picks, { onLoad } = {}) {
    calls.push(picks.map((p) => p.idx));
    onLoad?.(5);
    return { loadMs: 5, ms: 10, stills: picks.map((p) => { const s = tl.shots.find((x) => p.t >= x.start && p.t < x.end); const codes = judge(s); return { ...p, shotKey: shotKey(s), gate: { pass: !codes.length, codes, reasons: codes.map((c) => `${c}: test`), warn: [] } }; }) };
  } };
}

test("gate pass: the ladder fixes a failing shot (action first), inserts are never gated", async () => {
  const tl = shotsTl();
  const R = fakeRenderer((s) => (s.camera === "low" ? ["sky_only"] : []));
  const { report } = await gateShots({ tl, stills: R, until: Date.now() + 60000 });
  assert.deepEqual(R.calls[0], [0, 1, 3], "pass 1: every shot but the insert");
  assert.deepEqual(R.calls[1], [1], "pass 2: only the re-planned shot");
  assert.equal(tl.shots[1].camera, "medium"); assert.equal(tl.shots[1].focus, "me");
  assert.deepEqual(report.fixed, [{ shot: 1, how: "action", was: ["sky_only"] }]);
  assert.equal(gateRejects(report), null);
});

test("gate pass: action -> reaction -> world wide -> a passing shot's framing; a check problem undoes a step", async () => {
  const tl = shotsTl();
  // only a wide passes for shot 1; the check refuses a closeup (the reaction step is undone and skipped)
  const R = fakeRenderer((s) => (s.line === 1 && s.camera !== "wide" ? ["wall"] : []));
  const check = (t) => (t.shots.some((s) => s.camera === "closeup") ? ["subject shot 1: closeup refused"] : []);
  const { report } = await gateShots({ tl, stills: R, check, until: Date.now() + 60000 });
  const r = report.shots.find((x) => x.shot === 1);
  assert.deepEqual(r.tries.map((t) => t.how + (t.reverted ? " (undone)" : "")), ["action", "reaction (undone)", "world"]);
  assert.equal(tl.shots[1].camera, "wide"); assert.equal(tl.shots[1].camMove, undefined, "the world wide has no camera move");
  assert.equal(r.final, "pass");
});

test("gate pass: the last resort borrows a passing shot's framing; a hard failure left rejects the run", async () => {
  let tl = shotsTl();
  tl.shots[0].place = "square"; tl.shots[0].worldSpot = "square";
  // shot 1 fails everything except the framing of shot 0 (its place)
  let R = fakeRenderer((s) => (s.line === 1 && s.place !== "square" ? ["camera_inside"] : []));
  let { report } = await gateShots({ tl, stills: R, until: Date.now() + 60000 });
  assert.equal(report.shots.find((x) => x.shot === 1).tries.at(-1).how, "borrowed");
  assert.equal(tl.shots[1].place, "square"); assert.equal(report.unresolved.length, 0);
  // nothing passes: unresolved + hard -> STILL_GATE; subject_missing alone never rejects
  tl = shotsTl();
  R = fakeRenderer((s) => (s.line === 1 ? ["flat"] : s.line === 3 ? ["subject_missing"] : []));
  ({ report } = await gateShots({ tl, stills: R, until: Date.now() + 60000 }));
  assert.deepEqual(report.unresolved.map((u) => [u.shot, u.hard]), [[1, true], [3, false]]);
  const e = stillGateFailure(report, "reject");
  assert.equal(e.code, "STILL_GATE"); assert.match(e.message, /shot 1 \(#1\) flat/);
  assert.equal(stillGateFailure(report, "report"), null);
  assert.equal(gateBrief(report).unresolved.length, 2);
});

test("gate pass: the review's measurements are reused (no render for unchanged shots)", async () => {
  const tl = shotsTl(), cache = makeGateCache();
  for (const i of [0, 1, 3]) cache.add({ shotKey: shotKey(JSON.parse(JSON.stringify(tl.shots[i]))), gate: { pass: i !== 1, codes: i === 1 ? ["blocked"] : [], reasons: [] } });
  const R = fakeRenderer(() => []);
  const { report } = await gateShots({ tl, stills: R, cache, until: Date.now() + 60000 });
  assert.equal(report.cached, 3);
  assert.deepEqual(R.calls, [[1]], "only the re-planned shot is rendered");
  assert.equal(report.fixed.length, 1);
  assert.equal(frameKey(tl.shots[0], 0.5), frameKey({ ...tl.shots[0], start: 10, end: 12 }, 0.5), "timing does not change the key");
});

test("gate pass: out of time -> unverified, never a rejection", async () => {
  const tl = shotsTl();
  const R = fakeRenderer(() => ["flat"]);
  const { report } = await gateShots({ tl, stills: R, until: Date.now() + 1000 });
  assert.equal(R.calls.length, 0); assert.equal(report.unverified.length, 3);
  assert.equal(stillGateFailure(report), null);
});

test("alternatives: own content only; epic shots stay epic; borrowedFraming needs a passing shot on the same set", () => {
  const s = { set: "street", camera: "low", focus: "me", subject: "me", actors: [{ id: "me" }, { id: "ann" }] };
  assert.deepEqual(alternatives(s).map((a) => [a.how, a.patch.camera, a.patch.focus]), [["action", "medium", "me"], ["reaction", "closeup", "ann"], ["world", "wide", "group"]]);
  const e = { set: "creature:turtle_outside", camera: "giant_close", focus: "giant:wolf", actors: [] };
  assert.deepEqual(alternatives(e).map((a) => [a.how, a.patch.camera]), [["action", "establish"], ["world", "establish"]]);
  const tl = shotsTl();
  assert.equal(borrowedFraming(tl, 1, new Set()), null);
  assert.equal(borrowedFraming(tl, 1, new Set([0, 3])).from, 0, "a wide first");
});

test("worker: the gate mode (default reject; off / report)", () => {
  assert.equal(stillGateMode({}), process.env.BLOCKY_WORLDS_STILL_GATE ? stillGateMode({}) : "reject");
  assert.equal(stillGateMode({ stillGate: { mode: "off" } }), "off");
  assert.equal(stillGateMode({ stillGate: { mode: "nonsense" } }), "reject");
  if (!process.env.BLOCKY_WORLDS_STILL_GATE) assert.equal(stillGateMode({}, "local"), "off", "a laptop job never opens Chrome for the gate unasked");
});
