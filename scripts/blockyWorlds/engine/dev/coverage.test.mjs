// node --test dev/coverage.test.mjs   (the 130 library ideas as stand-in scripts: every noun / subject on screen; the kit
// builds every name the planner can emit)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAll, summarize, CARD_TARGET, standInScript, loadIdeas } from "./coverage.mjs";
import { planVideo, estimateWords, checkTimeline, checkVisuals, checkSubjects } from "../plan.mjs";
import { OBJECT_CATALOG, HOLDABLE } from "../lib/visuals.js";
import { HELD, CREATURES, THINGS, ANIMALS, CREATURE_OBJECTS } from "../lib/catalog.js";
import { INSERT_THINGS } from "../lib/insertKit.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = runAll();
const sum = summarize(results);

test("all 130 ideas plan without errors, checkTimeline clean", () => {
  assert.equal(results.length, 130);
  assert.deepEqual(results.filter((r) => r.error).map((r) => `${r.i}: ${r.error.split("\n")[0]}`), []);
  assert.deepEqual(results.flatMap((r) => r.tlProblems.map((p) => `${r.i} ${r.title}: ${p}`)), []);
});

test("zero checkVisuals misses and zero checkSubjects problems on all 130 ideas", () => {
  assert.deepEqual(results.flatMap((r) => r.visual.map((v) => `${r.i} L${v.line}: ${v.missing.join(", ")}`)), []);
  assert.deepEqual(results.flatMap((r) => r.subj.map((p) => `${r.i} s${p.shot}: ${p.problem}`)), []);
});

test(`picture cards stay under ${CARD_TARGET * 100}% of shots; badges stay rare`, () => {
  assert.ok(sum.cardShare <= CARD_TARGET, `card share ${(sum.cardShare * 100).toFixed(1)}%`);
  assert.ok(sum.badges / sum.shots <= 0.04, `badge share ${((sum.badges / sum.shots) * 100).toFixed(1)}%`);
  // no idea leans on cards: at most 4 a video
  assert.deepEqual(results.filter((r) => r.cards.length > 4).map((r) => `${r.i} ${r.title}: ${r.cards.join(", ")}`), []);
});

test("named creatures get a look of their own (not the two default rigs)", () => {
  const named = { 0: "dragon", 1: "bird", 2: "yeti", 3: "serpent", 17: "squid", 21: "stump", 30: "boxy", 36: "fish", 59: "troll", 66: "beast", 74: "dragon", 78: "scarecrow", 103: "beast" };
  for (const [i, v] of Object.entries(named)) assert.equal(results[i].tl.monster?.variant, v, `${i} ${results[i].title}: ${results[i].monster}`);
  // rank groups ("the Boomers", "the Hat Stackers") are people, never a monster
  for (const i of [7, 10, 69, 87, 105, 124]) assert.equal(results[i].tl.monster, null, `${i} ${results[i].title}`);
});

test("deterministic: the same idea plans to the same timeline", () => {
  const ideas = loadIdeas();
  for (const i of [0, 37, 74]) {
    const s = standInScript(ideas[i].idea);
    const a = planVideo({ script: s, words: estimateWords(s), idea: ideas[i].idea, lengthSec: 90 });
    const b = planVideo({ script: s, words: estimateWords(s), idea: ideas[i].idea, lengthSec: 90 });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  }
});

test("every name the planner can emit is in the kit catalog (objects, states, hand props, creature looks)", () => {
  // objects: the planner's catalog is the kit's (lib/catalog.js THINGS / ANIMALS / creatures + kit/objects.js's first nine)
  const kitSrc = fs.readFileSync(path.join(ROOT, "page/kit/objects.js"), "utf8") + fs.readFileSync(path.join(ROOT, "page/kit/things.js"), "utf8") + fs.readFileSync(path.join(ROOT, "page/kit/inserts.js"), "utf8"); // + the designed inserts (INSERTS 2026-11-10)
  const first = ["ice_cream_truck", "football_field", "birthday_party", "bakery", "car", "photo_set", "crib", "house_front", "stories_book"];
  for (const name of Object.keys(OBJECT_CATALOG)) {
    const built = first.includes(name) ? new RegExp(`\\n  ${name}\\(g`).test(kitSrc)
      : name in THINGS || name in INSERT_THINGS ? new RegExp(`\\n  ${name}\\(g`).test(kitSrc) || name === "item"
      : name in ANIMALS || name.replace(/_creature$/, "") in CREATURE_OBJECTS || name === "item";
    assert.ok(built, `object ${name} has no kit builder`);
  }
  // every object any of the 130 ideas (and The Listener) used is in the catalog with a known state
  for (const r of results) for (const s of r.tl.shots) for (const o of s.objects ?? []) {
    assert.ok(OBJECT_CATALOG[o.name], `${r.i}: object ${o.name}`);
    if (o.state) assert.ok(OBJECT_CATALOG[o.name].states.includes(o.state), `${r.i}: ${o.name}/${o.state}`);
  }
  // hand props: every HELD kind has a builder in kit/heldMore.js or kit/props.js
  const heldSrc = fs.readFileSync(path.join(ROOT, "page/kit/heldMore.js"), "utf8") + fs.readFileSync(path.join(ROOT, "page/kit/props.js"), "utf8") + fs.readFileSync(path.join(ROOT, "page/kit/inserts.js"), "utf8"); // the music box: kit/inserts.js
  for (const k of Object.keys(HELD)) assert.ok(new RegExp(`\\n  ${k}\\(g`).test(heldSrc), `hand prop ${k} has no builder`);
  assert.ok(HOLDABLE.size > 200);
  // creature looks
  const monSrc = fs.readFileSync(path.join(ROOT, "page/kit/monsters.js"), "utf8");
  for (const v of Object.keys(CREATURES)) assert.ok(new RegExp(`\\n  ${v}: \\{ base: "${CREATURES[v].base}"`).test(monSrc), `creature look ${v} missing in kit/monsters.js`);
});

test("The Listener (paid1, 58 lines) and EXAMPLE_SCRIPT: clean checks, every object in the kit", async () => {
  const { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } = await import("../../../../supabase/functions/_shared/blockyWorlds/examples.js");
  const runs = [[EXAMPLE_SCRIPT, estimateWords(EXAMPLE_SCRIPT), EXAMPLE_IDEAS[0]]];
  const pf = path.join(ROOT, "out/paid1/script.json");
  if (fs.existsSync(pf)) { const p = JSON.parse(fs.readFileSync(pf, "utf8")); runs.push([p.script ?? p, JSON.parse(fs.readFileSync(path.join(ROOT, "out/paid1/words.json"), "utf8")), p.idea ?? EXAMPLE_IDEAS[0]]); }
  for (const [script, words, idea] of runs) {
    const tl = planVideo({ script, words, idea, lengthSec: 90 });
    assert.deepEqual(checkTimeline(tl), []);
    assert.deepEqual(checkVisuals(tl, script), []);
    assert.deepEqual(checkSubjects(tl), []);
    for (const s of tl.shots) for (const o of s.objects ?? []) assert.ok(OBJECT_CATALOG[o.name], o.name);
  }
});

// The browser build check (every object / state / hand prop / creature look really builds) is dev/coverageKit.mjs
// (headless Chrome, ~20 s): run it with BW_KIT_CHECK=1.
test("kit builds in the browser (BW_KIT_CHECK=1)", { skip: !process.env.BW_KIT_CHECK }, async () => {
  const { checkKit } = await import("./coverageKit.mjs");
  const r = await checkKit();
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.fallbackHeld, []);
});
