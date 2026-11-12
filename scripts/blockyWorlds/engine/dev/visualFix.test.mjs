// VISUAL-FIX 2026-11-08 (owner's review of step-2 #1): camera moves on every shot, one person = one cast id, the
// head-noun guard for kit matches, the story-critical gate, the story shape (mini-sequences + recurring wide). Free.
import test from "node:test";
import assert from "node:assert/strict";
import { camMoveOf, applyCamMove, movesReport, camMoveProblems } from "../lib/camMove.js";
import { duplicateCastProblems, cameraMovePass, storyShapePass } from "../lib/shotFlow.js";
import { kitFor, kitMatchOk, headNoun, criticalItems, criticalGate, storyObjects } from "../lib/critical.js";
import { mergeDirectorCast, checkTimeline } from "../plan.mjs";
import { extractKeys } from "../lib/visuals.js";
import { rolesOf } from "../lib/storyPatterns.js";

test("camMove: a recipe slot's move reaches the shot (push in default; caps-only moves fall back to a push in)", () => {
  assert.deepEqual(camMoveOf("push_in", "slow"), { type: "push_in", speed: "slow" });
  assert.deepEqual(camMoveOf("track", "fast"), { type: "track", speed: "fast" });
  assert.equal(camMoveOf("orbit").type, "push_in");
  assert.equal(camMoveOf("static").type, "static");
  // the page zooms the framed lens over the shot (eased), static leaves it
  const cam = (fov) => ({ fov, rotateY() {}, rotateX() {}, updateProjectionMatrix() {}, updateMatrixWorld() {} });
  const a = cam(50); applyCamMove(a, { type: "push_in", speed: "medium" }, 0, 2); assert.equal(Math.round(a.fov), 50);
  const b = cam(50); applyCamMove(b, { type: "push_in", speed: "medium" }, 2, 2); assert.ok(b.fov < 44);
  const c = cam(50); applyCamMove(c, { type: "static" }, 2, 2); assert.equal(c.fov, 50);
  assert.deepEqual(camMoveProblems([{ camMove: { type: "wobble" } }]).length, 1);
});

test("cameraMovePass: every real shot moves, a card none, a caps move wins", () => {
  const tl = { shots: [{ part: "tour", camera: "wide" }, { part: "until", camera: "medium" }, { part: "tour", camera: "insert", insert: { kind: "sign" } }, { part: "climax", camera: "establish", move: { type: "orbit", deg: 70 } }] };
  cameraMovePass(tl);
  assert.equal(tl.shots[0].camMove.type, "push_in");
  assert.equal(tl.shots[1].camMove.speed, "medium");
  assert.equal(tl.shots[2].camMove, undefined);
  assert.equal(tl.shots[3].camMove, undefined);
  assert.equal(movesReport(tl.shots).pct, 100);
});

test("one person = one cast id: the director's narrator entry is 'me'; checkTimeline fails a duplicate", () => {
  const world = { people: new Map([["me", { name: "Pip", role: "kid" }]]), alias: {} };
  const prod = { cast: [{ id: "pip", name: "Pip", kind: "human", role: "narrator", look: "small kid, grey overalls, red hat" }], lines: [{ line: 0, who: ["pip"], subject: "pip" }], props: [] };
  const out = mergeDirectorCast(prod, world);
  assert.deepEqual(out.cast.map((c) => c.id), ["me"]);
  assert.deepEqual(out.lines[0].who, ["me"]);
  assert.equal(out.lines[0].subject, "me");
  assert.equal(duplicateCastProblems({ cast: { me: { name: "Pip" }, pip: { name: "Pip" } } }).length, 1);
  assert.ok(checkTimeline({ version: 1, fps: 24, width: 1080, height: 1920, duration: 2, cast: { me: { name: "Pip" }, pip: { name: "Pip" } }, shots: [{ start: 0, end: 2, camera: "wide" }], captions: [], audio: {} }).some((p) => /one person = one cast id/.test(p)));
});

test("head-noun guard: a kit match shares the head noun or a real synonym, never a lookalike", () => {
  assert.equal(headNoun("sign reading Ground Floor, Keeper"), "sign");
  assert.equal(headNoun("Hunting ropes over the shell"), "rope");
  assert.equal(kitFor("small wooden broom")?.name, "broom");          // not the mop
  assert.equal(kitFor("stone plaque")?.name, "stone_plaque");         // not a rock
  assert.equal(kitFor("stacked block towers")?.name, "block_tower");  // not a water tower
  assert.equal(kitFor("gold penthouse")?.name, "penthouse");          // not a gold star
  assert.equal(kitFor("ground floor base block")?.name, "base_block");
  assert.equal(kitFor("sign reading Ground Floor, Keeper")?.name, "sign");
  assert.equal(kitMatchOk("small wooden broom", "mop", ["mop", "mops"]), false);
  assert.equal(kitMatchOk("stone plaque", "rock", ["rock", "stone", "boulder"]), false);
  assert.equal(kitFor("Fennick tower", { own: { tower: "block_tower" } })?.name, "block_tower");
});

test("the line reading: the story's own things win over generic rules and adjectives", () => {
  const prod = { props: [{ name: "stacked block towers" }, { name: "gold penthouse" }, { name: "stone plaque" }, { name: "ground floor base block" }] };
  const vw = { people: new Map(), alias: {}, narrator: "Pip", monster: null, looseNames: new Set(), prop: null, own: storyObjects(prod) };
  const nouns = (t) => extractKeys(t, vw).map((k) => k.object ?? k.rule ?? k.noun ?? k.label);
  assert.ok(nouns("Then the gold penthouse swayed high above everyone.").includes("penthouse"));
  assert.ok(!nouns("Then the gold penthouse swayed high above everyone.").includes("gold"));
  assert.ok(nouns("The towers shivered, then bowed.").includes("block_tower"));
  assert.ok(!nouns("The towers shivered, then bowed.").includes("tower"));
  assert.ok(nouns("A stone plaque glowed through the dust.").includes("stone_plaque"));
  const plain = { ...vw, own: undefined };
  assert.ok(!extractKeys("I read it twice.", plain).some((k) => k.rule === "book"));   // "read" alone is no book
  assert.equal(extractKeys("I hung a sign saying Ground Floor.", plain).find((k) => k.rule === "sign")?.rule, "sign");
});

test("story-critical items: collected before planning; an unbuilt one rejects the plan with the list", () => {
  const production = { props: [{ id: "mask", name: "sleep mask with painted eyes", storyProp: true, size: "hand" }, { id: "towers", name: "stacked block towers", size: "landmark" }], creatures: [], lines: [] };
  const script = { lines: [{ part: "rule", text: "the towers" }, { part: "tour", text: "my towers" }] };
  const items = criticalItems({ production, script });
  assert.deepEqual(items.map((i) => i.id).sort(), ["mask", "towers"]);
  assert.throws(() => criticalGate({ production, script, mode: "reject" }), (e) => /sleep mask/.test(e.message) && e.critical.unresolved.length === 1);
  const ok = criticalGate({ production, script, built: { mask: { blueprint: {} } }, mode: "reject" });
  assert.equal(ok.unresolved.length, 0);
});

test("story shape: a threat gets reaction > threat > reaction; a wide comes back at least every 12 s", () => {
  const mk = (i, extra) => ({ start: i * 2, end: i * 2 + 2, line: i, lines: [i], part: "until", set: "street", light: "night", camera: "medium", focus: "me", actors: [{ id: "me", spot: "center", pose: "stand", expr: "neutral", facing: "camera", hold: null }], seed: i, ...extra });
  const shots = Array.from({ length: 14 }, (_, i) => mk(i, i === 6 ? { monsterState: { state: "lurk", spot: "far" }, focus: "monster", actors: [] } : {}));
  shots[0].camera = "wide";
  const tl = { duration: 28, shots };
  const r = storyShapePass(tl, { check: null });
  const roles = rolesOf(tl.shots);
  const k = roles.indexOf("threat");
  assert.ok(k > 0 && roles[k - 1] === "reaction" && roles[k + 1] === "reaction", roles.join(" "));
  assert.ok(r.wides >= 1);
  const wides = tl.shots.filter((s) => ["wide", "establish", "aerial", "behind_army"].includes(s.camera)).map((s) => s.start);
  const marks = [0, ...wides, 28];
  assert.ok(marks.every((m, i) => !i || m - marks[i - 1] <= 12 + 1e-6));
});
