// SHOT GRAMMAR v2 (owner 2026-11-09): the framing mix, readable faces, crowd cap + busy crowds, lived-in town, hero
// inserts of every story-critical object (first mention + payoff, framed whole at 40-70 %, a slow push in). Free.
import test from "node:test";
import assert from "node:assert/strict";
import { GRAMMAR, classOf, crowdPeople, faceProblem, mixReport, shotGrammarPass, lifeGroups, wideGap, targetsOf } from "../lib/shotGrammar.js";
import { headShare } from "../page/camera.js";
import { applyCamMove, camMoveProblems } from "../lib/camMove.js";
import { isAnchorWide } from "../lib/storyPatterns.js";
import { styleReport } from "../lib/style.js";
import { validateRecipe } from "../lib/recipes/schema.js";
import { loadRecipe, RECIPE_IDS } from "../lib/recipes/index.js";

const A = (id, extra = {}) => ({ id, spot: "center", pose: "stand", expr: "happy", facing: "camera", hold: null, ...extra });
const shot = (i, extra = {}) => ({ start: i, end: i + 1, line: i, lines: [i], part: "tour", set: "street", light: "day", camera: "medium", focus: "me", actors: [A("me")], insert: null, marker: null, seed: i, text: "x", subject: "me", ...extra });

test("classOf: character / insert / world / action / card", () => {
  assert.equal(classOf(shot(0)), "character");
  assert.equal(classOf(shot(0, { camera: "closeup" })), "character");
  assert.equal(classOf(shot(0, { camera: "wide" })), "world");                      // a lone person small in the world
  assert.equal(classOf(shot(0, { camera: "wide", actors: [A("me"), A("town1"), A("town2")] })), "action"); // a group of 3
  assert.equal(classOf(shot(0, { focus: "object", camera: "medium", actors: [], objects: [{ name: "bell", spot: "center" }] })), "insert");
  assert.equal(classOf(shot(0, { focus: "crowd", camera: "aerial", actors: [], crowds: [{ kind: "townsfolk", count: 8 }] })), "world");
  assert.equal(classOf(shot(0, { focus: "giant:wolf", camera: "giant_close", actors: [] })), "action");
  assert.equal(classOf(shot(0, { camera: "insert", insert: { kind: "sign", text: "X" } })), "card");
  assert.equal(classOf(shot(0, { camera: "wide", focus: "object", hero: { item: "a" }, actors: [], objects: [{ name: "bell", spot: "center" }] })), "insert");
  assert.equal(crowdPeople(shot(0, { crowds: [{ count: 3 }, { count: 4 }] })), 7);
});

test("faces: the focus person faces the lens (3/4 max) and the head is big enough", () => {
  assert.ok(headShare("closeup", 1.75) > headShare("medium", 1.75));
  assert.ok(headShare("medium", 1.75) >= GRAMMAR.headMin);
  assert.ok(headShare("wide", 1.75) < GRAMMAR.headMin);
  assert.equal(faceProblem(shot(0), {}), null);
  assert.match(faceProblem(shot(0, { actors: [A("me", { facing: "odette" }), A("odette", { spot: "right" })] }), {}), /profile/);
  assert.match(faceProblem(shot(0, { actors: [A("me", { facing: "left" })] }), {}), /profile/);
  // over the shoulder: the focus faces the near shoulder
  // (facing right, but honest about size: from ~4.3 m the head is ~11 % of the frame, so the pass re-frames it medium)
  assert.match(faceProblem(shot(0, { camera: "over_shoulder", actors: [A("me", { facing: "odette" }), A("odette")] }), {}), /head is 1[01]%/);
  assert.match(faceProblem(shot(0, { camera: "over_shoulder", actors: [A("me", { facing: "left" }), A("odette")] }), {}), /near shoulder/);
  // a kid from the low camera: the head is too small
  assert.match(faceProblem(shot(0, { camera: "low" }), { me: { role: "kid" } }), /head is/);
  // a whole-action pose (push, build, climb) on a close-up renders full body / side-on: an action shot, not a face shot
  assert.equal(classOf(shot(0, { camera: "closeup", actors: [A("me", { pose: "build" })] })), "action");
  // the creature town's roomier framing makes the head smaller (honest estimate)
  assert.ok(headShare("medium", 1.75, { framing: 1.8 }) < headShare("medium", 1.75));
  // a wide is not a character shot: no face rule
  assert.equal(faceProblem(shot(0, { camera: "wide", actors: [A("me", { facing: "left" })] }), {}), null);
});

test("hero insert fit: the lens widens to the fit share, then pushes in; fit is validated", () => {
  const cam = (fov) => ({ fov, rotateY() {}, rotateX() {}, updateProjectionMatrix() {}, updateMatrixWorld() {} });
  const share = (c) => Math.tan((50 * Math.PI) / 360) / Math.tan((c.fov * Math.PI) / 360); // the framed object's share
  const a = cam(50); applyCamMove(a, { type: "push_in", speed: "slow", fit: 0.6 }, 0, 2);
  const b = cam(50); applyCamMove(b, { type: "push_in", speed: "slow", fit: 0.6 }, 2, 2);
  assert.ok(Math.abs(share(a) - 0.6) < 0.01 && share(b) > share(a) && share(b) <= 0.7, `${share(a)} -> ${share(b)}`);
  assert.equal(camMoveProblems([{ camMove: { type: "push_in", fit: 0.1 } }]).length, 1);
  assert.equal(camMoveProblems([{ camMove: { type: "push_in", fit: 0.6 } }]).length, 0);
  assert.equal(isAnchorWide({ camera: "wide", hero: { item: "a" } }), false);
  assert.equal(isAnchorWide({ camera: "wide" }), true);
});

test("lifeGroups: 3-12 people in groups doing different things; the line's own crowd action wins", () => {
  for (let seed = 1; seed < 40; seed++) {
    const g = lifeGroups({ kind: "townsfolk", item: "townsfolk", aliases: ["people"], count: 40, seed: 5 }, seed);
    const n = g.reduce((a, c) => a + c.count, 0);
    assert.ok(n >= GRAMMAR.life[0] && n <= GRAMMAR.life[1], `seed ${seed}: ${n}`);
    assert.ok(new Set(g.map((c) => c.action)).size >= 2 || g.length === 1, `seed ${seed}: one action`);
    assert.ok(g.every((c) => c.item === "townsfolk" && c.aliases?.includes("people")), "the crowd's item / aliases stay (the word checks)");
  }
  const f = lifeGroups({ kind: "townsfolk", count: 40 }, 3, { action: "flee", total: 10 });
  assert.ok(f.every((c) => c.action === "flee"));
});

/** a small timeline: a town of standing crowds of 40, a story object named on lines 1 and 6 */
function town(n = 12) {
  const shots = [];
  for (let i = 0; i < n; i++) {
    const t0 = i * 2;
    const base = { start: t0, end: t0 + 2, line: i, lines: [i], part: i >= 6 ? "climax" : "tour", set: "street", light: "day", insert: null, marker: null, seed: i * 17 + 3, text: i === 0 ? "In this town everyone keeps a bell." : "line", subject: "me" };
    if (i % 3 === 0) shots.push({ ...base, camera: i ? "wide" : "aerial", focus: "crowd", actors: [], subject: null, crowds: [{ kind: "townsfolk", count: 40, formation: "scatter", action: "stand", spot: "back", facing: "camera", seed: 20, item: "townsfolk", aliases: ["people"] }] });
    else shots.push({ ...base, camera: i % 2 ? "medium" : "closeup", focus: "me", actors: [A("me", { facing: "odette" }), A("odette", { spot: "right" })] });
  }
  const captions = shots.flatMap((s) => [0, 0.5, 1, 1.5].map((d, k) => ({ word: k === 2 && (s.line === 1 || s.line === 6) ? "bell" : "w", start: s.start + d, end: s.start + d + 0.4 })));
  return {
    duration: n * 2, shots, captions, cast: { me: { role: "kid" }, odette: { role: "adult" } },
    lines: shots.map((s) => ({ part: s.part, text: s.text })),
    production: { perLine: [{ line: 1, required: [{ id: "bell" }] }, { line: 6, required: [{ id: "bell" }] }] },
  };
}

test("shotGrammarPass: crowd cap + busy crowds, small life groups, faces to the lens, hero inserts at first mention + payoff", () => {
  const tl = town(12);
  const critical = { items: [{ id: "bell", name: "old town bell", kind: "object", source: "kit", kitName: "bell", why: ["planted", "recurring"] }] };
  const rep = shotGrammarPass(tl, { critical, production: tl.production });
  const mix = mixReport(tl);
  // crowds: at most 10 % crowd shots (here 1 of ~13), none just standing, every other town background 3-12 people
  assert.ok(mix.crowd.share <= GRAMMAR.crowdMax + 1e-9 || mix.crowd.shots <= 1, JSON.stringify(mix.crowd));
  assert.equal(mix.crowd.standing.length, 0);
  for (const s of tl.shots) if (crowdPeople(s) && crowdPeople(s) <= GRAMMAR.crowdPeople) assert.ok(crowdPeople(s) >= GRAMMAR.life[0]);
  // hero inserts: the bell at its first mention (line 1) and its payoff (line 6), alone, whole, a slow push in from the fit
  const heroes = tl.shots.filter((s) => s.hero);
  assert.deepEqual(heroes.map((s) => s.line).sort((a, b) => a - b), [1, 6], JSON.stringify(rep.inserts));
  for (const h of heroes) {
    assert.equal(h.focus, "object"); assert.equal(h.actors.length, 0); assert.equal(h.objects[0].name, "bell");
    assert.deepEqual(h.camMove, { type: "push_in", speed: "slow", fit: GRAMMAR.insertFit });
    assert.notEqual(h.camera, "insert"); assert.equal(h.insert, null); // never a card
    assert.ok(Math.abs(h.start - (h.line * 2 + 1)) < 1e-6, "the cut lands on the item's word");
  }
  // faces: every character shot readable (the kid's low shots turned medium if any)
  assert.equal(mix.faces.bad.length, 0, JSON.stringify(mix.faces.bad));
  // the timeline stays contiguous
  tl.shots.forEach((s, i) => { if (i) assert.ok(Math.abs(s.start - tl.shots[i - 1].end) < 1e-6); });
  assert.ok(wideGap(tl) > 0);
});

test("shotGrammarPass: a change that makes a check worse is undone", () => {
  const tl = town(9);
  let calls = 0;
  const check = (t) => ({ hero: t.shots.filter((s) => s.hero).length, x: 0, calls: calls++ * 0 });
  shotGrammarPass(tl, { check, critical: { items: [{ id: "bell", name: "bell", kind: "object", source: "kit", kitName: "bell", why: [] }] }, production: tl.production });
  assert.equal(tl.shots.filter((s) => s.hero).length, 0);
});

test("styleReport: the measured mix (R9), crowd shots (R10), faces (R11)", () => {
  const tl = town(12);
  const r = styleReport(tl);
  assert.ok(r.metrics.mix && r.metrics.mix.n === 12);
  assert.ok(r.problems.some((p) => p.rule === "R10 crowd shots"));
  assert.ok(r.problems.some((p) => p.rule === "R11 faces"));
  assert.ok(r.problems.some((p) => p.rule === "R9 framing mix"));
});

test("recipes: every recipe carries the owner's mix; a bad mix is refused", () => {
  for (const id of RECIPE_IDS) {
    const r = loadRecipe(id);
    assert.ok(r, id);
    assert.deepEqual(targetsOf(r.mix), { character: 0.39, insert: 0.21, world: 0.24, action: 0.16 });
    assert.equal(r.mix.crowdMax, GRAMMAR.crowdMax);
  }
  const r = JSON.parse(JSON.stringify(loadRecipe("rigged_system")));
  r.mix = { character: 0.9, insert: 0.2, world: 0.25, action: 0.15 };
  assert.ok(validateRecipe(r).some((p) => /sum to 1/.test(p)));
  assert.deepEqual(targetsOf({ character: 2 }), { ...GRAMMAR.targets });
});
