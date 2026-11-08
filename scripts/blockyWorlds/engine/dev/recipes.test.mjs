// RECIPES tests (free): node --test dev/recipes.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planVideo, checkTimeline, checkVisuals, checkSubjects, checkProduction, estimateWords } from "../plan.mjs";
import { directStory } from "../lib/director/index.js";
import { loadRecipe, recipeFor, RECIPE_IDS, ALIASES, validateRecipe, shotCount, cutTimes, engineCamera, BEATS } from "../lib/recipes/index.js";
import { draftRecipe } from "../../shotlib/recipeFromVideo.mjs";
import { FAKE_SCRIPTS } from "./recipesFakes.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
const counts = (tl, script) => ({ timeline: checkTimeline(tl).length, visuals: checkVisuals(tl, script).length, subjects: checkSubjects(tl).length, production: checkProduction(tl).length });

test("every launch recipe loads, validates and holds enums only", () => {
  for (const id of RECIPE_IDS) {
    const r = loadRecipe(id);
    assert.ok(r, `${id} loads`);
    assert.deepEqual(validateRecipe(r), [], id);
    for (const b of BEATS) assert.ok(r.beats[b].slots.length >= 1, `${id} ${b}`);
    // patterns only: no free text inside the beats (every string is an enum value)
    const strings = (JSON.stringify(r.beats).match(/:"[^"]*"/g) ?? []).map((s) => s.slice(2, -1));
    assert.ok(strings.length > 10);
    for (const s of strings) assert.match(s, /^[a-z_0-9]+$/, `${id}: "${s}" is not an enum`);
  }
});

test("aliases and the idea's story type pick a recipe; nothing picks none", () => {
  assert.equal(loadRecipe("giant_reveal").id, "creature_town_attack");
  assert.equal(loadRecipe("everyone_except_me").id, ALIASES.everyone_except_me);
  assert.equal(recipeFor({ idea: { recipe: { id: "lost_pet_in_town" } } }).id, "lost_pet_in_town");
  assert.equal(recipeFor({ idea: {} }), null);
  assert.equal(loadRecipe("no_such_type"), null);
});

test("a validator refuses free text and unknown values", () => {
  const r = JSON.parse(JSON.stringify(loadRecipe("curfew_monster")));
  r.beats.tour.slots[0].subject = "Mr. Pickle";
  r.beats.tour.slots[0].note = "copied line";
  const p = validateRecipe(r);
  assert.ok(p.some((x) => /subject/.test(x)) && p.some((x) => /unknown field/.test(x)));
});

test("shot counts and cuts: on word starts, never shorter than the minimum", () => {
  assert.equal(shotCount(4.4, 1.1), 4);
  assert.equal(shotCount(1.2, 1.1), 1);
  assert.equal(shotCount(1.7, 0.85, { minShot: 0.8 }), 2);
  const words = [0, 0.3, 0.7, 1.1, 1.5, 1.9, 2.3, 2.8, 3.2].map((s, i) => ({ word: i % 2 ? "the" : "turtle", start: s }));
  const cuts = cutTimes(0, 3.6, 3, words, { minShot: 0.8 });
  assert.equal(cuts[0], 0); assert.equal(cuts.at(-1), 3.6);
  for (let k = 1; k < cuts.length - 1; k++) assert.ok(words.some((w) => w.start === cuts[k]), `cut ${cuts[k]} on a word start`);
  for (let k = 1; k < cuts.length; k++) assert.ok(cuts[k] - cuts[k - 1] >= 0.8 - 1e-9);
});

test("camera map: the world close is the low hero angle; a rival giant never aerial / close / track", () => {
  const s = { set: "creature:turtle_outside", giants: [{ id: "world" }], seed: 3 };
  assert.equal(engineCamera({ distance: "close", height: "eye_level", move: "orbit" }, "world", s).camera, "hero_low");
  assert.equal(engineCamera({ distance: "close", height: "eye_level", move: "orbit" }, "world", s).move, null);
  assert.equal(engineCamera({ distance: "extreme_wide", height: "eye_level", move: "orbit" }, "world", s).move.type, "orbit");
  for (const c of [{ distance: "wide", height: "aerial" }, { distance: "close", height: "eye_level" }, { distance: "medium", height: "eye_level", move: "track" }]) assert.ok(["establish", "hero_low"].includes(engineCamera(c, "giant", s).camera));
  assert.equal(engineCamera({ distance: "close", height: "eye_level" }, "person", { set: "street" }).camera, "closeup");
});

test("the extractor makes a valid enum-only draft from a synthetic analysis", () => {
  const shots = Array.from({ length: 14 }, (_, i) => ({ n: i + 1, t0: i, t1: i + 1, dur: 1, lines: [Math.floor(i / 2) + 1], move: { family: "push_in", intensity: "slow" }, cut: { kind: "on_word_start" } }));
  const lines = Array.from({ length: 7 }, (_, i) => ({ n: i + 1, t0: i * 2, t1: i * 2 + 2, text: ["In this town, Bob Smith rules.", "Everyone hums.", "I'm the only one who can't.", "Until one night, it came.", "That's when I realized the truth.", "So I grabbed the horn.", "Now we sing."][i] }));
  const desc = { shots: Object.fromEntries(shots.map((s) => [s.n, { distance: "wide", height: "high", cameraMove: "push_in", who: s.n % 2 ? "creature_only" : "people_only", subject: "Bob Smith the kid", action: "walks", libraryCategory: s.n % 3 ? "giant_walk" : "people_reaction", emotion: "scared", scaleCues: "houses below", timeOfDay: "night", causeEffect: "x" }])) };
  const r = draftRecipe({ id: "123", storyType: "test_type", sh: { shots, lines, duration: 14 }, desc });
  assert.deepEqual(validateRecipe(r), []);
  assert.ok(!JSON.stringify(r.beats).includes("Bob"), "no names from the source");
});

test("no recipe given: the plan is unchanged (no tl.recipe)", async () => {
  const { script, idea } = FAKE_SCRIPTS.rigged_system;
  const direction = await directStory({ script, idea, provider: "mock", exists });
  const words = estimateWords(script, 212);
  const a = planVideo({ script, words, idea, lengthSec: 90, direction, exists });
  const b = planVideo({ script, words, idea, lengthSec: 90, direction, exists, recipe: null });
  assert.equal(a.recipe, undefined);
  assert.deepEqual(a.shots, b.shots);
});

for (const id of RECIPE_IDS) {
  test(`${id}: the recipe plan passes the checks (never worse than without), no cards, shots tile the video`, async () => {
    const { script, idea } = FAKE_SCRIPTS[id];
    const direction = await directStory({ script, idea, provider: "mock", exists });
    const words = estimateWords(script, 212);
    const plain = planVideo({ script, words, idea, lengthSec: 90, direction, exists });
    const tl = planVideo({ script, words, idea, lengthSec: 90, direction, exists, recipe: id });
    const c0 = counts(plain, script), c1 = counts(tl, script);
    for (const k of Object.keys(c0)) assert.ok(c1[k] <= c0[k], `${k}: ${c1[k]} > ${c0[k]}`);
    assert.equal(tl.recipe.id, id);
    assert.ok(tl.shots.length >= plain.shots.length);
    assert.ok(tl.shots.some((s) => s.recipe), "recipe slots used");
    assert.equal(tl.shots.filter((s) => s.camera === "insert" || s.insert || [s.marker, ...(s.markers ?? [])].some((m) => m && m.kind !== "ring")).length, 0);
    assert.equal(tl.shots[0].start, 0);
    for (let i = 1; i < tl.shots.length; i++) assert.ok(Math.abs(tl.shots[i].start - tl.shots[i - 1].end) < 1e-6, `gap at shot ${i}`);
    assert.ok(Math.abs(tl.shots.at(-1).end - tl.duration) < 0.05);
    // deterministic
    const again = planVideo({ script, words, idea, lengthSec: 90, direction, exists, recipe: id });
    assert.deepEqual(again.shots, tl.shots);
  });
}

test("creature_town_attack: the faster rhythm (median shot near the source's ~1.1 s)", async () => {
  const { script, idea } = FAKE_SCRIPTS.creature_town_attack;
  const direction = await directStory({ script, idea, provider: "mock", exists });
  const tl = planVideo({ script, words: estimateWords(script, 212), idea, lengthSec: 90, direction, exists, recipe: "creature_town_attack" });
  const d = tl.shots.map((s) => s.end - s.start).sort((a, b) => a - b);
  assert.ok(d[Math.floor(d.length / 2)] <= 1.35, `median ${d[Math.floor(d.length / 2)]}`);
  assert.ok(tl.shots.some((s) => s.focus === "world" && /^creature:/.test(s.set)), "the creature is a subject");
});
