// node --test dev/integration.test.mjs   (INTEGRATION: the story director's production list drives the planner; free)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planVideo, checkTimeline, checkVisuals, checkSubjects, checkProduction, estimateWords } from "../plan.mjs";
import { directStory } from "../lib/director/index.js";
import { refineProduction, onScreen } from "../lib/direction.js";
import { validateEpic } from "../lib/epic.js";
import { cases, runCase } from "./integration.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
const TW = JSON.parse(fs.readFileSync(path.join(ENGINE, "dev", "scripts", "turtle_wolf.json"), "utf8"));
const direction = await directStory({ script: TW, idea: TW.idea, provider: "mock", exists });
const words = estimateWords(TW);
const tl = planVideo({ script: TW, words, idea: TW.idea, lengthSec: 90, direction, exists });
const shotsOf = (i) => tl.shots.filter((s) => (s.lines ?? [s.line]).includes(i));

test("turtle-wolf via the mock director: all four pre-render checks are clean", () => {
  assert.deepEqual(checkTimeline(tl), []);
  assert.deepEqual(checkVisuals(tl, TW), []);
  assert.deepEqual(checkSubjects(tl), []);
  assert.deepEqual(checkProduction(tl), []);
  assert.deepEqual(validateEpic(tl), []);
  assert.ok(tl.production?.perLine?.length === TW.lines.length, "the timeline keeps the production list per line");
});

test("turtle-wolf: a creature world seen inside, from outside, on its back, and at sea once it swims", () => {
  const views = new Set(Object.values(tl.worlds).map((w) => w.view));
  assert.ok(["inside", "outside", "on"].every((v) => views.has(v)), [...views].join(","));
  assert.ok(Object.values(tl.worlds).every((w) => w.creature === "turtle"));
  // line 0 (the rule): the sign, then the turtle from outside
  assert.ok(shotsOf(0).some((s) => s.camera === "establish" && /^creature:turtle_outside/.test(s.set)));
  // line 1 (our streets): inside the turtle
  assert.ok(shotsOf(1).every((s) => /^creature:turtle_inside/.test(s.set)));
  // "It swam." and after: the sea
  const swim = tl.shots.findIndex((s) => s.beat?.type === "swim_away");
  assert.ok(swim > 0 && tl.worlds[tl.shots[swim].set.slice(9)].water === true);
  assert.ok(tl.shots.slice(swim).filter((s) => /^creature:/.test(s.set) && tl.worlds[s.set.slice(9)].view !== "inside").every((s) => tl.worlds[s.set.slice(9)].water));
});

test("turtle-wolf: the Big Bad Wolf is an EPIC giant (taller than the turtle), never the old monster rig", () => {
  assert.equal(tl.monster, null);
  assert.equal(tl.giants.wolf.kind, "wolf");
  assert.ok(tl.giants.wolf.size >= 60, `size ${tl.giants.wolf.size}`);
  assert.ok(shotsOf(11).some((s) => s.giants?.some((g) => g.id === "wolf")), "Outside, on the hill, stood the Big Bad Wolf");
  assert.ok(shotsOf(15).some((s) => s.giants?.some((g) => g.id === "wolf" && g.action === "roar") && s.beat?.type === "roar"));
  assert.ok(shotsOf(28).some((s) => s.giants?.some((g) => g.id === "wolf" && g.action === "fall") && s.beat?.type === "fall"));
  // "He was taller than our turtle": he is the wolf (lib/subjects.js beings), not Grandpa
  assert.ok(shotsOf(12).every((s) => s.camera === "insert" || s.subject === "thing:wolf"), shotsOf(12).map((s) => s.subject).join(","));
});

test("turtle-wolf: crowds (the wolf army, the town, the knights) and action beats are emitted", () => {
  const kinds = new Set(tl.shots.flatMap((s) => (s.crowds ?? []).map((c) => c.kind)));
  for (const k of ["wolf_soldier", "townsfolk", "knight"]) assert.ok(kinds.has(k), `crowd ${k}`);
  assert.ok(shotsOf(13).some((s) => s.crowds?.some((c) => c.kind === "wolf_soldier" && c.action === "march")), "the army marched");
  assert.ok(shotsOf(16).some((s) => s.crowds?.some((c) => c.action === "charge") && s.beat?.type === "charge" && s.camera === "behind_army"), "the army charged at our turtle");
  assert.ok(shotsOf(17).some((s) => s.beat?.type === "impact"), "Boom. The whole world shook.");
  const beats = new Set(tl.shots.filter((s) => s.beat).map((s) => s.beat.type));
  for (const b of ["roar", "march", "charge", "impact", "stomp", "swim_away", "fall", "cheer"]) assert.ok(beats.has(b), `beat ${b}`);
  assert.ok(tl.shots.some((s) => s.camera === "hero_low" || s.camera === "establish"), "a scale shot");
});

test("refinements: describing words are not things, the army is one, the knights get their crowd", () => {
  const { production: p, notes } = refineProduction(direction.production, { script: TW, mock: true });
  assert.ok(!p.props.some((x) => ["massive", "brass", "long"].includes(x.name)), p.props.map((x) => x.name).join(","));
  assert.equal(p.crowds.filter((c) => /army|soldier/.test(c.name)).length, 1);
  assert.ok(p.lines[23].needs.some((id) => p.crowds.find((c) => c.id === id && /knight/.test(c.name))));
  assert.ok(notes.length > 5);
});

test("strict check: a required item without a needId never matches an object without one", () => {
  const r = { id: "shore", kind: "prop", name: "shore", route: "builder" };
  assert.equal(onScreen(r, { camera: "medium", objects: [{ name: "bell", spot: "center" }], actors: [] }, {}), false);
  assert.equal(onScreen({ ...r, needId: "dir7" }, { camera: "medium", objects: [{ name: "x", needId: "dir7" }], actors: [] }, {}), true);
});

test("no direction: today's behaviour (no production, no EPIC fields), the four checks clean", () => {
  const plain = planVideo({ script: TW, words, idea: TW.idea, lengthSec: 90 });
  assert.equal(plain.production, undefined);
  assert.equal(plain.giants, undefined);
  assert.equal(plain.worlds, undefined);
  assert.ok(plain.shots.every((s) => !s.crowds && !s.giants && !s.beat));
  assert.deepEqual(checkProduction(plain), []);
  assert.deepEqual(checkVisuals(plain, TW), []);
  assert.deepEqual(checkSubjects(plain), []);
});

test("every integration case (10 stress topics, The Listener, 5 library ideas) plans clean from the mock director", async () => {
  for (const c of await cases()) {
    if (c.name === "turtle_wolf") continue;
    const r = await runCase(c);
    for (const [k, v] of Object.entries(r.checks)) assert.deepEqual(v, [], `${c.name}: ${k}`);
  }
});
