// node --test scripts/blockyWorlds/blenderKit/sock.test.mjs   (free: THE SOCK LESSONS, owner 2026-11-18 after watching
// "The Sock That Heard Nothing": 73% of the shots in one living room, runs of close-ups, the animal-nose gag never built,
// puffs over faces, a look that changed when the line said it stays normal, only 8 weak shots in the report)
import test from "node:test";
import assert from "node:assert/strict";
import { varietyPlanProblems, minLocations, tileShots, SOCK_RULES, LOCATION_MAX_SHARE, CLOSE_RUN_MAX, GAG_MIN_VERSIONS, systemPrompt } from "./director.mjs";
import { fxOffFaces, reaimPlan } from "./camFix.mjs";
import { spreadScenes } from "./notes.mjs";
import { renderGate, weakShotList } from "./renderGate.mjs";
import { summary } from "../studioWorker/runner.mjs";

const SIZES = ["wide", "medium", "close", "reaction"];
const plan = (locs, sizes = locs.map((_, i) => SIZES[i % 4])) => locs.map((location, i) => ({ id: i + 1, w0: i, desc: `shot ${i + 1}`, location, size: sizes[i] }));
const cast = [{ name: "Mo", hero: true, looks: "nose: normal all video" }];

test("variety: a varied, sized plan passes; the constants are the owner's numbers", () => {
  assert.equal(LOCATION_MAX_SHARE, 0.4);
  assert.equal(CLOSE_RUN_MAX, 2);
  assert.equal(GAG_MIN_VERSIONS, 4);
  assert.equal(minLocations(90), 4);
  assert.equal(minLocations(45), 3);
  const p = plan(Array.from({ length: 40 }, (_, i) => ["room", "street", "shop", "park"][Math.floor(i / 10) % 4]));
  assert.deepEqual(varietyPlanProblems({ shots: p, style_sheet: cast, gag: null }, 90), []);
});

test("variety: one location over 40% of the time is a problem (word timings when given)", () => {
  const locs = Array.from({ length: 20 }, (_, i) => (i < 12 ? "living room" : ["shop", "kitchen", "street", "park"][i % 4]));
  const p = varietyPlanProblems({ shots: plan(locs), style_sheet: cast }, 90);
  assert.ok(p.some((x) => /living room holds 60% of the video/.test(x)), p.join(" | "));
  // by time: the same 12 shots, but they are short (0.5 s each) and the others long (6 s each) -> under 40%
  const words = []; let t = 0;
  for (let i = 0; i < 20; i++) { words.push({ start: t, end: t + 0.4 }); t += i < 12 ? 0.5 : 6; }
  const q = varietyPlanProblems({ shots: plan(locs), style_sheet: cast }, 90, { words });
  assert.ok(!q.some((x) => /holds/.test(x)), q.join(" | "));
});

test("variety: a 90 s story needs 4 locations (3 is fine for 45 s); an owner-edited scene plan is never re-planned for it", () => {
  const locs = Array.from({ length: 30 }, (_, i) => ["a", "b", "c"][i % 3]);
  assert.ok(varietyPlanProblems({ shots: plan(locs), style_sheet: cast }, 90).some((x) => /at least 4 clearly different locations/.test(x)));
  assert.ok(!varietyPlanProblems({ shots: plan(locs), style_sheet: cast }, 45).some((x) => /locations/.test(x)));
  const one = Array.from({ length: 30 }, (_, i) => (i < 20 ? "a" : ["b", "c"][i % 2]));
  assert.ok(!varietyPlanProblems({ shots: plan(one), style_sheet: cast }, 90, { sceneLocked: true }).some((x) => /holds|locations/.test(x)));
});

test("variety: never more than 2 close-ups in a row, never 3 of one size in a row, every shot sized", () => {
  const locs = Array.from({ length: 12 }, (_, i) => ["a", "b", "c", "d"][i % 4]);
  const sizes = ["wide", "close", "reaction", "close", "medium", "wide", "wide", "wide", "medium", "close", "wide", "medium"];
  const p = varietyPlanProblems({ shots: plan(locs, sizes), style_sheet: cast }, 30);
  assert.ok(p.some((x) => /more than 2 close \/ reaction shots in a row \(shots 2, 3, 4\)/.test(x)), p.join(" | "));
  assert.ok(p.some((x) => /3 shots of the same size in a row \(shots 6, 7, 8 \(wide\)\)/.test(x)), p.join(" | "));
  const unsized = plan(locs, locs.map(() => ""));
  assert.ok(varietyPlanProblems({ shots: unsized, style_sheet: cast }, 30).some((x) => /12 shots have no size/.test(x)));
});

test("the gag: a visible change needs 4+ clearly different versions, each shown in a desc", () => {
  const locs = Array.from({ length: 16 }, (_, i) => ["a", "b", "c", "d"][i % 4]);
  const shots = plan(locs).map((s, i) => ({ ...s, desc: ["Mo with a pig snout", "Dad with a duck beak", "Gran with an elephant trunk", "a row of animal noses: pig snout, duck beak, trunk, frog mouth"][i % 4] }));
  const few = varietyPlanProblems({ shots, style_sheet: cast, gag: { change: "noses turn into animal noses", versions: ["pig snout", "duck beak"] } }, 30);
  assert.ok(few.some((x) => /has 2 version\(s\): build and show at least 4/.test(x)), few.join(" | "));
  const unseen = varietyPlanProblems({ shots, style_sheet: cast, gag: { change: "noses turn into animal noses", versions: ["pig snout", "duck beak", "elephant trunk", "frog mouth", "fox nose"] } }, 30);
  assert.deepEqual(unseen.filter((x) => /gag/.test(x)), ["the gag's versions fox nose are in no shot's desc: show each one (and the line naming the set shows them side by side)"]);
  assert.ok(!varietyPlanProblems({ shots, style_sheet: cast, gag: { change: "", versions: [] } }, 30).some((x) => /gag/.test(x)), "no gag, no gag check");
});

test("looks: a style sheet without any looks is a problem; the rules are in the director's instructions", () => {
  const locs = Array.from({ length: 12 }, (_, i) => ["a", "b", "c", "d"][i % 4]);
  assert.ok(varietyPlanProblems({ shots: plan(locs), style_sheet: [{ name: "Mo", hero: true }] }, 30).some((x) => /no looks/.test(x)));
  assert.equal(SOCK_RULES.length, 5);
  for (const k of ["VARIETY", "SHOT SIZES ALTERNATE", "THE STORY'S GAG IS BUILT", "EFFECTS NEVER COVER FACES", "RIGHT CHARACTER, RIGHT LOOK"]) assert.ok(SOCK_RULES.some((r) => r.startsWith(k)), k);
  assert.equal(typeof systemPrompt, "function");
});

test("the tiled shots keep their size", () => {
  const words = Array.from({ length: 20 }, (_, i) => ({ start: i * 0.5, end: i * 0.5 + 0.4 }));
  const t = tileShots([{ id: 1, w0: 0, desc: "a", location: "x", size: "wide" }, { id: 2, w0: 4, desc: "b", location: "y", size: "close" }], words);
  assert.deepEqual(t.shots.map((s) => s.size), ["wide", "close"]);
});

// the Sock's shot 20: R stands at (0, 3.4); the puff sat on R's face
const SOCK20 = `R.pose(t0, loc=(0, 3.4, 0), rot=0)
cam.key(t0, (0, -6, 4.4), (0, 3.4, 4.2), lens=26)
cam.key(t1, (0, -5.4, 4.4), (0, 3.4, 4.2), lens=26)
story.puff('pf_r', (0, 3.4, 4.5), tp, 1.2)`;

test("effects never cover faces: a puff on a face moves beside it, in frame; a puff by the feet stays", () => {
  const r = fxOffFaces(SOCK20);
  assert.equal(r.fixed.length, 1, r.left.join(" | "));
  const m = r.body.match(/story\.puff\('pf_r', \((-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\), tp, 1\.2\)/);
  assert.ok(m, r.body);
  assert.ok(Math.abs(Number(m[1])) >= 1.2, `moved sideways: ${m[1]}`);
  assert.ok(Math.abs(Number(m[1])) <= 2.5, `still in frame: ${m[1]}`);
  const feet = SOCK20.replace("(0, 3.4, 4.5), tp, 1.2", "(0, 3.4, 0.4), tp, 0.6");
  assert.deepEqual(fxOffFaces(feet).fixed, []);
  const far = SOCK20.replace("(0, 3.4, 4.5)", "(4, 3.4, 4.5)");
  assert.deepEqual(fxOffFaces(far).fixed, []);
});

test("effects never cover faces: the camera fix runs it on every shot and reports what it moved", () => {
  const bodies = { 1: SOCK20 };
  const r = reaimPlan(bodies, [{ id: 1, desc: "R gasps" }]);
  assert.ok((r.fixed[1] ?? []).some((x) => /covered R's face -> moved beside it/.test(x)), JSON.stringify(r));
  assert.notEqual(bodies[1], SOCK20);
});

test("the scene spread: the Sock's automatic scene plan (living room 28 of 38 lines) ends with no place over 40%", () => {
  const lines = Array.from({ length: 38 }, () => "one two three four five six seven eight");
  const sock = { scenes: [[0, 6, "living_room"], [7, 8, "shop"], [9, 10, "classroom"], [11, 11, "bedroom"], [12, 12, "downtown_street"], [13, 16, "living_room"], [17, 20, "kitchen"], [21, 37, "living_room"]].map(([a, b, location]) => ({ lines: [a, b], location, auto: true })) };
  const ids = new Set(["living_room", "shop", "classroom", "bedroom", "downtown_street", "kitchen", "moon"]);
  const out = spreadScenes(sock, lines, ids);
  const share = {};
  for (const s of out.scenes) share[s.location] = (share[s.location] ?? 0) + (s.lines[1] - s.lines[0] + 1) / 38;
  assert.ok(Object.values(share).every((v) => v <= 0.42), JSON.stringify(share));
  assert.ok(!share.moon, "never an exotic place its lines don't name");
  let next = 0;
  for (const s of out.scenes) { assert.equal(s.lines[0], next); next = s.lines[1] + 1; }
  assert.equal(next, 38, "every line still covered, in order");
  const short = { scenes: [{ lines: [0, 4], location: "living_room", auto: true }] };
  assert.equal(spreadScenes(short, lines.slice(0, 5), ids), short, "a short script stays as it is");
});

test("the full weak-shot list: every cut and weak shot, with its desc and why, in the report summary", () => {
  const shots = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, w0: i * 3, desc: `shot ${i + 1} desc` }));
  const failing = {};
  for (let i = 1; i <= 12; i++) failing[i] = { kind: "vision", text: `weak reason ${i}` };
  failing[13] = { kind: "vision", text: "the frame is black" };
  const g = renderGate({ shots, failing });
  const list = weakShotList({ ...g }, shots);
  assert.equal(list.length, 13, "all of them, not the first 8");
  assert.deepEqual(list.find((w) => w.id === 13), { id: 13, status: "cut", at: 36, desc: "shot 13 desc", why: "unwatchable: cut from the final" });
  assert.equal(list.find((w) => w.id === 9).why, "weak reason 9");
  const s = summary({ title: "Sock", shots: 20, total: 1.2, gate: { ...g, list }, stillFailing: failing });
  assert.equal(s.weakShots.length, 13);
  assert.equal(s.gate.list.length, 13);
  assert.equal(s.title, "Sock");
  assert.equal(summary({ model: "x" }).weakShots, undefined, "the three.js report is unchanged");
});
