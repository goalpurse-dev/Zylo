// In This Town round 7 (owner 2026-11-23): the town rule made visible, only what the engine can show, the window
// look-out + porch recipes, the free code checks before the paid picture check, windows as the world state says.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { compileScene } from "../scripts/blockyWorlds/blenderKit/cards.mjs";
import { THINGS, ACTIONS, RECIPES, EFFECTS, engineKitText } from "../supabase/functions/_shared/blockyWorlds/engineKit.js";
import { GEN_THINGS, GEN_ACTIONS } from "../supabase/functions/_shared/blockyWorlds/engineKitGenerated.js";

const E = fs.readFileSync("scripts/blockyWorlds/blenderKit/worlds/effects.py", "utf8");
const fr = (place, people, cam = "medium") => ({ place, time: "night", camera: { type: cam, side: "front" }, people, props: [] });
const me = { who: "Me", mark: "center", pose: "stand", face: "happy", looks_at: "camera" };

test("the rule effect: a real bulb (glass + screw base + filament), sized from a head, popping with overshoot, a burst, a glow", () => {
  for (const p of ['"zt_bg%d"', '"zt_bn%d"', '"zt_bs%d_%d"', '"zt_bf%d"']) assert.ok(E.includes(p), `bulb part ${p}`);
  assert.match(E, /k = 1\.28 if how == "pop"/, "scale-up with overshoot");
  assert.match(E, /def zw_burst\(/); assert.match(E, /zw_burst\(c, t, size\)/);
  assert.match(E, /def zw_switch\(kind, near, t, on\):/, "one named lamp / window / porch light switches on a word");
});

test("the compiler: a line where the rule fires gets the story's rule effect on its word", () => {
  const card = { start: fr("suburb_street", [me]), end: fr("suburb_street", [me]), motion: [] };
  const scene = { start: 0, end: 2, words: "I laugh and a light pops on!", wordList: [{ word: "I", start: 0 }, { word: "laugh", start: 0.5 }, { word: "and", start: 1 }] };
  const py = compileScene(JSON.parse(JSON.stringify(card)), { plan: { cast: [{ name: "Me" }] }, scene, rule: { fires: true, who: "Me", word: "laugh" } });
  assert.match(py, /zw_rule_effect\(me_0, \(t0 \+ 0\.250 \* dur\)\)/);
  const off = compileScene(JSON.parse(JSON.stringify(card)), { plan: { cast: [{ name: "Me" }] }, scene, rule: { fires: false, who: "Me", word: "laugh" } });
  assert.doesNotMatch(off, /zw_rule_effect\(/);
});

test("recipes: a window line indoors = the look-out (kid at the window, then over the shoulder); the porch = the porch recipe", () => {
  const scene = { start: 0, end: 2, words: "I see it from my window.", wordList: [{ word: "I", start: 0 }] };
  const look = compileScene({ start: fr("bedroom", [me]), end: fr("bedroom", [me]), motion: [] }, { plan: { cast: [{ name: "Me" }], monster: { present: true, size: 3, style: "slime" } }, scene, indoor: true });
  assert.match(look, /zw_lookout\(cam, t0, t1, me_0, target=.*, cut=True\)/);
  const porch = compileScene({ start: fr("suburb_porch", [me]), end: fr("suburb_porch", [me]), motion: [] }, { plan: { cast: [{ name: "Me" }] }, scene: { ...scene, words: "We sit on the porch." } });
  assert.match(porch, /zw_porch_cam\(cam, t0, t1, \[me_0\]/);
  assert.match(E, /"zw_hf", "zw_hrail"|zw_hrail/, "the porch recipe clears the fence / rail between the lens and the people");
});

test("what the engine can show is GENERATED from the code, and the writer / plan text says only these", () => {
  assert.deepEqual([...THINGS], [...GEN_THINGS]);
  assert.deepEqual(Object.keys(ACTIONS).sort(), [...GEN_ACTIONS].sort());
  for (const k of ["light_bulb", "kazoo", "ice_cream_cart"]) assert.ok(THINGS.includes(k), k);
  for (const k of ["lamp", "window", "porch_light"]) assert.ok(!THINGS.includes(k), `${k} is a switch target, not a prop`);
  for (const k of ["rule_effect", "switch_on", "switch_off"]) assert.ok(k in ACTIONS, k);
  assert.ok(RECIPES.includes("window_lookout") && RECIPES.includes("porch"));
  assert.ok("rule_effect" in EFFECTS);
  assert.match(engineKitText(), /ONLY THESE/);
  // the list is up to date with the code (the generator is free and deterministic apart from the date)
  const before = fs.readFileSync("supabase/functions/_shared/blockyWorlds/engineKitGenerated.js", "utf8").split("\n").slice(1).join("\n");
  const r = spawnSync("node", ["scripts/blockyWorlds/blenderKit/genEngineKit.mjs"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const after = fs.readFileSync("supabase/functions/_shared/blockyWorlds/engineKitGenerated.js", "utf8").split("\n").slice(1).join("\n");
  assert.equal(after, before, "run genEngineKit.mjs after an engine change");
});

test("the free checks: a too-small / covered character is a gate line; more than half one flat colour fails", () => {
  assert.match(E, /ZW_GATE\|%s\|%s\|small\|/); assert.match(E, /ZW_GATE\|%s\|%s\|covered\|/);
  assert.match(E, /ob\.hide_render = True/, "a walker passing next to the lens leaves the shot");
  const F = fs.readFileSync("scripts/blockyWorlds/round7/flatcheck.py", "utf8");
  const R = fs.readFileSync("scripts/blockyWorlds/round7/storyboard7.mjs", "utf8");
  assert.match(F, /STEP = 5/, "the biggest smooth region (a shaded wall counts as one surface)");
  assert.match(E, /not hidden and not hob\.name\.startswith\("zp_f"\)/, "a piece hidden from the render, or a face part, covers nobody");
  assert.match(R, /castNames\.has\(/, "only the story's cast is measured, not the card's extras");
  assert.match(R, /> 0\.5\) why\.push/, "over half one colour = fail");
  assert.match(R, /else if \(free\[k\]\)/, "a free fail never goes to the AI check");
});
