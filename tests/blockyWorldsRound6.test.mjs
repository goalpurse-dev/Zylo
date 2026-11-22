// In This Town round 6 (owner 2026-11-22): story logic + rare voices, full actions, real sizes, room for monsters.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { compileScene } from "../scripts/blockyWorlds/blenderKit/cards.mjs";
import { ACTIONS, THINGS } from "../supabase/functions/_shared/blockyWorlds/engineKit.js";
import { WRITER2_SYSTEM, wordBudget } from "../supabase/functions/_shared/blockyWorlds/writer2.js";
import { planUser } from "../scripts/blockyWorlds/blenderKit/director2.mjs";

const T = fs.readFileSync("scripts/blockyWorlds/blenderKit/worlds/town.py", "utf8");
const P = (who, mark, pose, face = "happy") => ({ who, mark, pose, face, looks_at: "camera" });
const FR = (cam, people, props = []) => ({ place: "suburb_street", time: "day", camera: { type: cam, side: "front" }, people, props });
const SC = (words) => ({ start: 0, end: 3, words, wordList: words.split(" ").map((w, i) => ({ word: w, start: i * 0.4 })) });
const PLAN = { cast: [{ name: "Grandma" }, { name: "Max" }, { name: "Lily" }], monster: { present: true, style: "slime", size: 3.5 } };

test("writer: rare voices introduced by the narrator, the who-is-where self-test, a measured word budget", () => {
  assert.match(WRITER2_SYSTEM, /SPEECH IS RARE: at most ONE quoted line/);
  assert.match(WRITER2_SYSTEM, /WHO IS WHERE, for EVERY line/);
  assert.match(WRITER2_SYSTEM, /Nobody suddenly appears or talks from nowhere/);
  assert.equal(wordBudget(45), 194, "about 4.3 words a second at 1.3x (measured)");
  const u = planUser({ title: "T", lines: [{ text: "a", speaker: "" }], where: [{ line: 1, who_where: "Me: on the street" }] });
  assert.match(u, /WHO IS WHERE.*\n1\. Me: on the street/s, "the plan reads the writer's who-is-where");
});

test("full actions: kids PLAY moving (tag / a ball), GIVE from hand to hand, an ice cream cart", () => {
  assert.ok(ACTIONS.play && ACTIONS.give); assert.ok(THINGS.includes("ice_cream_cart"));
  const play = compileScene({ start: FR("wide", [P("Max", "left", "stand"), P("Lily", "right", "stand")]), end: FR("wide", [P("Max", "left", "stand"), P("Lily", "right", "stand")]), motion: [{ on_word: 0, who: "Max", action: "play", target: "Lily" }] }, { plan: PLAN, scene: SC("Kids play on the street.") });
  assert.match(play, /zm_tag\(\[max_0, lily_1\]/);
  const give = compileScene({ start: FR("medium", [P("Grandma", "center", "stand"), P("Max", "right", "walk")], [{ kind: "ice_cream", mark: "center", state: "held", held_by: "Grandma", count: 1 }]), end: FR("medium", [P("Grandma", "center", "stand"), P("Max", "right", "walk")]), motion: [{ on_word: 0, who: "Grandma", action: "give", target: "Max" }] }, { plan: PLAN, scene: SC("Grandma sells ice cream.") });
  assert.match(give, /zm_give\(grandma_0, max_1, ice_cream_100/);
  assert.match(T, /def zm_give\(/); assert.match(T, /def zt_build_cart\(/); assert.match(T, /def zm_tag\(/); assert.match(T, /def zm_pass_ball\(/);
});

test("no running on the spot: a run pose with no step moves forward; run_away to a mark is the motion library's run", () => {
  const py = compileScene({ start: FR("wide", [P("Lily", "left", "run")]), end: FR("wide", [P("Lily", "left", "run")]), motion: [] }, { plan: PLAN, scene: SC("Lily runs home.") });
  assert.match(py, /zm_walk\(lily_0, t0, t1, zw_ahead\(lily_0, t0, 7 \* zw_ps\(\) \* \(t1 - t0\)\), run=True/);
  const ra = compileScene({ start: FR("wide", [P("Max", "left", "stand")]), end: FR("wide", [P("Max", "right", "run")]), motion: [{ on_word: 0, who: "Max", action: "run_away", target: "" }] }, { plan: PLAN, scene: SC("Max runs away.") });
  assert.match(ra, /zm_walk\(max_0, .*run=True\)/); assert.doesNotMatch(ra, /max_0\.run\(/);
});

test("real sizes + room: people 0.55 outdoors, houses 1.5x taller (doors / fences / yards kept), the monster made last on a cleared spot", () => {
  assert.match(T, /ZW_PS_OUT = 0\.55/); assert.match(T, /ZW_HOUSE_TALL = 1\.5/);
  assert.match(T, /ZW_HOUSE_KEEP = \("zw_hdoor", "zw_hf", "zw_hmb", "zw_hhedge", "zw_hpath", "zw_hdrive"\)/);
  assert.match(T, /return ZW_MONSTER1\(name, zw_clear_spot\(loc, 2\.2 \* size \* zw_ps\(\)\)/);
  const py = compileScene({ start: FR("wide", [P("monster", "center", "stand", "angry"), P("Max", "center", "stand")]), end: FR("wide", [P("monster", "center", "stand", "angry"), P("Max", "center", "stand")]), motion: [{ on_word: 0, who: "monster", action: "climb_out", target: "" }] }, { plan: PLAN, scene: SC("The monster climbs out.") });
  assert.ok(py.indexOf("max_") < py.indexOf("mon = zw_monster"), "everyone else is placed before the monster");
  assert.match(py, /zw_climb_out\(mon, .*hole=\(mon\.root\.location\.x, mon\.root\.location\.y\)\)/, "the hole is the monster's own cleared spot");
});

test("camera: never against a fence / a wall / a person; a driving car never passes the lens; tested spots at the people's size", () => {
  assert.match(T, /def zw_near_clear\(/); assert.match(T, /the lens was against a person/);
  assert.match(T, /def zw_cars_clear_lens\(/); assert.match(T, /def zw_spot\(cam, place, spot, t0, t1, push=0\.08, lens=None\):/);
});
