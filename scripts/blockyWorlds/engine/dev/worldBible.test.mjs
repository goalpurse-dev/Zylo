// WORLD CONTINUITY (owner, 2026-11-06, PERMANENT RULE; docs/blocky-worlds-protocol.md): one world bible per story,
// built before the shots; every shot stands in it; checkTimeline and the shot review flag anything that is not it.
// Free: the stored director lists of the real turtle runs (dev/scripts/run1620fc3e.json, run7b4c0d8b.json) + the mock.
//   node --test dev/worldBible.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as plan from "../plan.mjs";
import { planCriticalFirst } from "./criticalFakes.mjs";
import { directStory } from "../lib/director/index.js";
import { mockProduction } from "../lib/director/mock.js";
import { validateProduction, productionSchema } from "../lib/director/spec.js";
import { DIRECTOR_SYSTEM } from "../lib/director/design.js";
import { buildWorldBible, applyBible, worldBibleProblems, spotFor, bibleSummary, saveWorldBible } from "../lib/worldBible.js";
import { normalizeVerdict, MISS_TYPES, batchContent, judgeSchema } from "../lib/vision/judge.js";
import { suggestFixes, applyFixes } from "../lib/vision/replan.js";
import { mockJudge } from "../lib/vision/mock.js";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
const RUNS = ["run1620fc3e.json", "run7b4c0d8b.json"];
const cache = new Map();
async function planned(file) {
  if (cache.has(file)) return cache.get(file);
  const R = JSON.parse(fs.readFileSync(path.join(ENGINE, "dev", "scripts", file), "utf8"));
  const script = { title: R.title, lines: R.lines };
  const words = (R.words ?? []).map(([word, start, end]) => ({ word, start, end }));
  const idea = { opener: R.lines[0].text, title: R.title, topic: R.topic, setting: "inside a giant turtle" };
  const direction = await directStory({ script, idea, exists, provider: { direct: async () => ({ data: R.production, costUsd: 0 }) } });
  const { tl } = planCriticalFirst(plan, { script, words: words.length ? words : undefined, idea, lengthSec: R.lengthSec, direction, exists }); // STORY-CRITICAL FIRST
  const out = { R, script, idea, direction, tl };
  cache.set(file, out);
  return out;
}
const copy = (o) => JSON.parse(JSON.stringify(o));

test("bible: deterministic (same story -> same bible), seeded from the creature, every field there", async () => {
  const { R, script, idea } = await planned(RUNS[0]);
  const P = validateProduction(R.production, { lineCount: R.lines.length }).production;
  const a = buildWorldBible({ production: P, script, idea, title: R.title });
  const b = buildWorldBible({ production: copy(P), script, idea, title: R.title });
  assert.deepEqual(a, b);
  assert.equal(a.kind, "creature");
  assert.equal(a.creature.species, "turtle");
  assert.equal(a.creature.townView, "inside");
  assert.ok(a.creature.heightM >= 120);
  for (const k of ["name", "seed", "style", "palette", "streets", "buildings", "landmarks"]) assert.ok(a.town[k] != null, k);
  assert.ok(a.town.buildings.some((x) => x.kind === "school"), "a real town has a school");
  assert.ok(a.town.buildings.every((x) => Array.isArray(x.pos) && x.pos.length === 2 && x.wall && x.roof));
  assert.ok(a.spots.some((s) => s.id === "outside_wide") && a.spots.some((s) => s.id === "main_street"));
  assert.ok(a.spots.filter((s) => s.view === "inside").every((s) => s.onCreature && "shellEdge" in s.onCreature && "walkTilt" in s.onCreature));
  assert.deepEqual(a.cast.me.look, b.cast.me.look);
  assert.equal(a.cast.me.look.top, "#2e9e4f", "the director's 'green hoodie' is the narrator's top");
  assert.ok(a.time.length >= 2 && a.time[0].from === 0);
  // another creature: another town seed
  const whale = buildWorldBible({ production: { ...P, worlds: P.worlds.map((w) => ({ ...w, creature: { ...w.creature, species: w.creature.species ? "whale" : "" } })) }, script, idea });
  assert.notEqual(whale.town.seed, a.town.seed);
  assert.ok(whale.sets.every((s) => s.startsWith("creature:whale_")));
});

for (const file of RUNS) {
  test(`${file}: every shot stands in the bible (a bible set + spot, bible looks, one town seed); the checks pass`, async () => {
    const { tl } = await planned(file);
    const B = tl.world;
    assert.ok(B, "tl.world");
    const spots = new Map(B.spots.map((s) => [s.id, s]));
    for (const [i, s] of tl.shots.entries()) {
      assert.ok(B.sets.includes(s.set), `shot ${i}: ${s.set}`);
      assert.ok(spots.get(s.worldSpot)?.set === s.set, `shot ${i}: spot ${s.worldSpot}`);
      if (spots.get(s.worldSpot).view === "inside" && s.camera !== "insert") assert.ok(s.onCreature?.shellEdge !== undefined, `shot ${i}: on-creature cues`);
      for (const a of s.actors ?? []) { const c = tl.cast[a.id]; assert.ok(B.cast[c.bibleId], `${a.id} in the bible`); assert.deepEqual(c.look, B.cast[c.bibleId].look); assert.equal(c.seed, B.cast[c.bibleId].seed); }
    }
    for (const w of Object.values(tl.worlds)) assert.equal(w.seed, B.town.seed);
    assert.deepEqual(worldBibleProblems(tl), []);
    assert.deepEqual(plan.checkTimeline(tl), []);
    // the outside view and the town view are both used (the town on the creature, seen from outside)
    assert.ok(tl.shots.some((s) => s.worldSpot === "outside_wide") && tl.shots.some((s) => B.spots.find((x) => x.id === s.worldSpot)?.view === "inside"));
  });
}

test("checkTimeline fails a shot outside the bible: the old bus-stop street, another creature, a drifted look, a foreign prop", async () => {
  const { tl } = await planned(RUNS[1]);
  const i = tl.shots.findIndex((s) => s.actors?.length && s.camera !== "insert");
  const street = copy(tl); street.shots[i].set = "street";
  assert.ok(plan.checkTimeline(street).some((p) => /world bible: shot \d+: set street is not in the world bible/.test(p)));
  const whale = copy(tl); whale.shots[i].set = "creature:whale_on"; whale.worlds.whale_on = { creature: "whale", view: "on", size: 120, seed: 9 };
  const pw = plan.checkTimeline(whale);
  assert.ok(pw.some((p) => /set creature:whale_on is not in the world bible/.test(p)) && pw.some((p) => /a whale world/.test(p)));
  const look = copy(tl); const id = look.shots[i].actors[0].id; look.cast[id].look = { ...look.cast[id].look, top: "#000001" };
  assert.ok(plan.checkTimeline(look).some((p) => p.includes(`${id}'s look is not the world bible's`)));
  const spot = copy(tl); spot.shots[i].worldSpot = "bus_stop";
  assert.ok(plan.checkTimeline(spot).some((p) => /spot bus_stop is not in the world bible/.test(p)));
  const prop = copy(tl); prop.shots[i].objects = [...(prop.shots[i].objects ?? []), { name: "bench", spot: "far", propId: "golden_bus" }];
  assert.ok(worldBibleProblems(prop).some((p) => /prop golden_bus/.test(p)));
  const seed = copy(tl); Object.values(seed.worlds)[0].seed += 1;
  assert.ok(worldBibleProblems(seed).some((p) => /town seed/.test(p)));
});

test("the planner re-homes a foreign set into the bible (applyBible), spots follow the words", async () => {
  const { tl } = await planned(RUNS[0]);
  const t = copy(tl);
  t.shots[2].set = "school"; delete t.shots[2].worldSpot;
  const r = applyBible(t, t.world);
  assert.equal(r.homed, 1);
  assert.equal(t.shots[2].set, "creature:turtle_inside");
  assert.deepEqual(worldBibleProblems(t), []);
  const B = t.world;
  assert.equal(spotFor(B, { set: "creature:turtle_inside", text: "I climbed the stairs" }), "stairs");
  assert.equal(spotFor(B, { set: "creature:turtle_inside", text: "Baker Bell wraps his bread" }), "market");
  assert.equal(spotFor(B, { set: "creature:turtle_inside", text: "I fell asleep in bed" }), "home");
  assert.equal(spotFor(B, { set: "creature:turtle_outside", text: "anything" }), "outside_wide");
});

test("director: the bible hints are in the schema + prompt (enum-free), validated, used by the bible; the mock writes them", async () => {
  const sch = productionSchema();
  assert.ok(sch.properties.bible && !JSON.stringify(sch.properties.bible).includes("enum"));
  assert.ok(/WORLD CONTINUITY/.test(DIRECTOR_SYSTEM) && /bible \(write it first\)/.test(DIRECTOR_SYSTEM));
  assert.ok(/never copy another video's shots/.test(DIRECTOR_SYSTEM));
  // an old stored list (no bible) is fine and not a problem
  const old = validateProduction({ worlds: [], lines: [] }, { lineCount: 1 });
  assert.deepEqual(old.production.bible.places, []);
  assert.ok(!old.problems.some((p) => /bible/.test(p)));
  // hints win
  const { R, script, idea } = await planned(RUNS[0]);
  const P = validateProduction({ ...R.production, bible: { creature_look: "mossy green shell with brown plates", town_name: "Shellbrook", building_style: "stone houses with slate roofs", palette: ["grey", "cream", "green"], streets: ["Kelp Road", "Rim Walk"], places: [{ name: "the clock shop", kind: "shop" }], landmarks: ["the bell tower"] } }, { lineCount: R.lines.length }).production;
  const B = buildWorldBible({ production: P, script, idea });
  assert.equal(B.town.name, "Shellbrook");
  assert.equal(B.town.style.id, "stone");
  assert.equal(B.town.streets[0].name, "Kelp Road");
  assert.ok(B.town.buildings.some((b) => b.name === "the clock shop"));
  assert.ok(B.town.landmarks.some((l) => l.name === "the bell tower"));
  assert.equal(B.creature.colors.skin, "#2e9e4f");
  // the mock director: a bible with the places the script names
  const lines = [{ part: "rule", text: "In this town, we live on the back of a giant turtle." }, { part: "tour", text: "The baker sells bread by the school." }, { part: "me", text: "I'm Pip, and I sleep in my house near the bell tower." }];
  const mp = mockProduction({ script: { lines }, idea: { setting: "on a giant turtle" } });
  assert.ok(mp.bible && Array.isArray(mp.bible.places));
  assert.ok(["the school", "the bakery", "my house"].every((n) => mp.bible.places.some((p) => p.name === n)), JSON.stringify(mp.bible));
  assert.ok(mp.bible.landmarks.includes("the bell tower"));
  const d = await directStory({ script: { lines }, idea: { setting: "on a giant turtle" }, provider: "mock", exists });
  const tl = plan.planVideo({ script: { title: "Pip", lines }, idea: { setting: "on a giant turtle" }, direction: d, exists });
  assert.ok(tl.world?.town.buildings.some((b) => b.name === "the bakery"));
  assert.deepEqual(worldBibleProblems(tl), []);
});

test("vision: world_mismatch + render defect types parse; fixes map to the bible's spot / look, camera, render flags", async () => {
  for (const t of ["world_mismatch", "clipping", "camera_inside", "sky_only", "washed_out"]) assert.ok(MISS_TYPES.includes(t));
  assert.ok(judgeSchema().properties.lines.items.required.includes("world_ok"));
  const item = { line: 3, stills: [{ key: "L3-s5a", shot: 5 }] };
  const v = normalizeVerdict({ line: 3, shows: "a plain suburb street", who_ok: true, missing: [], action_ok: true, place_ok: true, time_ok: true, emotion_ok: true, world_ok: false, card: false, verdict: "match", types: ["clipping"], bad_shots: ["L3-s5a"], fix: "" }, item);
  assert.equal(v.verdict, "partial");
  assert.ok(v.types.includes("world_mismatch") && v.types.includes("clipping"));
  const ok = normalizeVerdict({ line: 3, who_ok: true, missing: [], action_ok: true, place_ok: true, time_ok: true, emotion_ok: true, card: false, verdict: "match", types: [] }, item);
  assert.equal(ok.verdict, "match"); // world_ok missing (an old reply) = ok

  const { tl } = await planned(RUNS[1]);
  const t = copy(tl);
  const i = t.shots.findIndex((s) => s.actors?.length && s.camera !== "insert" && s.camera !== "medium");
  const id = t.shots[i].actors[0].id;
  t.shots[i].set = "street"; t.cast[id].look = { ...t.cast[id].look, top: "#000001" };
  const req = { line: t.shots[i].line, text: t.shots[i].text, shots: [i] };
  const fixes = suggestFixes({ verdict: "partial", types: ["world_mismatch", "camera_inside", "washed_out"], bad_shots: [i], missing: [], fix: "" }, req, t);
  const so = fixes.find((f) => f.op === "setOverride");
  assert.equal(so.set, "creature:turtle_inside"); assert.ok(t.world.spots.some((s) => s.id === so.spot));
  assert.ok(fixes.some((f) => f.op === "castFix" && f.id === id && f.bibleLook));
  assert.ok(fixes.some((f) => f.op === "cameraFix") && fixes.some((f) => f.op === "renderFlag" && f.flag === "washed_out"));
  const r = applyFixes(t, fixes, { check: () => worldBibleProblems(t) });
  assert.ok(r.applied.some((f) => f.op === "setOverride") && r.applied.some((f) => f.op === "castFix"), JSON.stringify(r));
  assert.deepEqual(worldBibleProblems(t), []);
  assert.deepEqual(t.shots[i].renderFlags, ["washed_out"]);

  // the free mock judge sees a foreign set / look as world_mismatch
  const bad = copy(tl); bad.shots[i].set = "street";
  const j = mockJudge();
  const it = { line: req.line, text: req.text, stills: [{ key: "k", shot: i }], plan: [bad.shots[i]], bible: bad.world, cast: bad.cast };
  const out = await j.judge([it]);
  assert.ok(out.lines[0].types.includes("world_mismatch"));
  const good = await j.judge([{ ...it, plan: [tl.shots[i]] }]);
  assert.ok(!good.lines[0].types.includes("world_mismatch"));
  // the paid judge's request carries the bible summary
  const content = batchContent([{ ...it, stills: [] }], { world: bibleSummary(tl.world) });
  assert.ok(/THE WORLD BIBLE/.test(content[0].text) && content[0].text.includes(tl.world.town.name));
});

test("world-bible.json is saved next to the timeline", async () => {
  const { tl } = await planned(RUNS[0]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-"));
  const f = await saveWorldBible(dir, tl);
  assert.deepEqual(JSON.parse(fs.readFileSync(f, "utf8")), tl.world);
  fs.rmSync(dir, { recursive: true, force: true });
});
