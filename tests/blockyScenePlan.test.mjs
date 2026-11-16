// The Blender kit engine's LOCATION LIBRARY + SCENE PLAN (owner-only) + PATTERN BANK: pure logic and the wiring.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LOCATIONS, locationById, pickLocation } from "../supabase/functions/_shared/blockyWorlds/locations.js";
import { autoScenePlan, cleanScenePlan, locationFromText, PICKER, DEFAULT_LOCATION } from "../supabase/functions/_shared/blockyWorlds/scenePlan.js";
import { PATTERN_BANK, patternNotes } from "../supabase/functions/_shared/blockyWorlds/patternBank.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the location library: unique ids, every location has wide / street / close spots, and the world code has a spot for each", () => {
  const ids = LOCATIONS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  const py = read("scripts/blockyWorlds/blenderKit/worlds/worlds.py");
  for (const l of LOCATIONS) {
    for (const s of ["wide", "street", "close"]) assert.ok(l.spots.includes(s), `${l.id} lacks ${s}`);
    assert.match(py, new RegExp(`"${l.id}": \\{"wide"`), `worlds.py has no spots for ${l.id}`);
    assert.match(py, new RegExp(`"${l.id}": zw_`), `worlds.py has no builder for ${l.id}`);
  }
  assert.equal(locationById("nope"), null);
});

test("a free-text place maps to the closest library location (or none)", () => {
  assert.equal(pickLocation("We robbed the bank on Friday."), "downtown_landmark");
  assert.equal(pickLocation("I hid under my bed all night."), "bedroom");
  assert.equal(pickLocation("The pilot left the cockpit."), "cockpit");
  assert.equal(pickLocation("moon"), "moon");
  assert.equal(pickLocation("downtown_plaza"), "downtown_plaza");
  assert.equal(pickLocation("Nothing here names a place."), null);
  assert.deepEqual(locationFromText("a shop that sells jokes"), { id: "shop", label: "Shop inside" });
});

test("the automatic scene plan groups lines by location and carries a place over lines that name none", () => {
  const lines = [{ text: "In this town, laughing makes money." }, { text: "The bank pays you per giggle." }, { text: "Grandpa counts coins." }, { text: "At night, I hid in my bedroom." }, { text: "Then the moon laughed back." }];
  const { scenes } = autoScenePlan(lines);
  assert.deepEqual(scenes.map((s) => [s.lines, s.location]), [[[0, 0], "downtown_street"], [[1, 2], "downtown_landmark"], [[3, 3], "bedroom"], [[4, 4], "moon"]]);
  assert.ok(scenes.every((s) => s.auto));
  assert.equal(autoScenePlan([{ text: "Nothing at all." }]).scenes[0].location, DEFAULT_LOCATION);
  assert.equal(PICKER.length, LOCATIONS.length);
});

test("the owner's edited plan is checked: library ids or a typed place that maps to one, every line covered in order", () => {
  const ok = cleanScenePlan({ scenes: [{ lines: [0, 1], location: "downtown_street" }, { lines: [2, 2], location: "x", typed: "the moon" }] }, 3);
  assert.deepEqual(ok, { ok: true, plan: { scenes: [{ lines: [0, 1], location: "downtown_street", auto: false }, { lines: [2, 2], location: "moon", auto: false }] } });
  assert.equal(cleanScenePlan({ scenes: [{ lines: [0, 0], location: "x", typed: "a submarine lair" }] }, 1).ok, false);
  // a MISSING PLACE (placeBuilds.js, owner 2026-11-16) maps to its host, where the director builds it
  assert.equal(cleanScenePlan({ scenes: [{ lines: [0, 0], location: "x", typed: "a volcano lair" }] }, 1).plan.scenes[0].location, "downtown_landmark");
  assert.equal(cleanScenePlan({ scenes: [{ lines: [0, 0], location: "moon" }] }, 2).ok, false, "a line left uncovered");
  assert.equal(cleanScenePlan({ scenes: [{ lines: [1, 1], location: "moon" }] }, 2).ok, false, "a gap at the start");
  assert.equal(cleanScenePlan({}, 2).ok, false);
});

test("the scene plan is owner-only in the API, the page and the worker", () => {
  const api = read("supabase/functions/blocky-worlds-api/index.ts");
  assert.match(api, /action === "scenePlan"[\s\S]{0,200}if \(!who\.owner\) throw new ApiError/);
  assert.match(api, /if \(who\.owner && body\?\.scenePlan\)/);
  assert.match(api, /scenePlan: Boolean\(who\?\.owner\)/);
  assert.match(read("src/components/viral-tools/blocky-worlds/ScriptStep.jsx"), /access\?\.scenePlan && <ScenePlan/);
  assert.match(read("src/components/viral-tools/blocky-worlds/hooks/useBlockyWorlds.js"), /access\?\.scenePlan && scenePlan\?\.draftId === draft\.id/);
  assert.match(read("scripts/blockyWorlds/blenderKit/workerSteps.mjs"), /card\?\.scene_plan\?\.scenes\?\.length/);
});

test("the pattern bank is style only and reaches the writer and the idea engine", () => {
  assert.equal(PATTERN_BANK.source.videos, 38);
  for (const k of ["hooks", "rules", "examples", "twists", "endings"]) assert.ok(PATTERN_BANK[k].length >= 3, k);
  for (const kind of ["plan", "lines", "ideas"]) assert.match(patternNotes(kind), /never copy any line, name or plot/);
  const llm = read("supabase/functions/_shared/blockyWorlds/llm.js");
  for (const k of ['patternNotes("ideas")', 'patternNotes("plan")', 'patternNotes("lines")']) assert.ok(llm.includes(k), k);
});
