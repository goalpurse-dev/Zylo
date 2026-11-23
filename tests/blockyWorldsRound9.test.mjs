// In This Town round 9 (owner 2026-11-23): the replica's lessons as defaults + the fixes for normal stories.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { applyCard, initialState, compileTakes, lockLooks, kindOf, trimShow, isMark } from "../scripts/blockyWorlds/blenderKit/takes.mjs";
import { normalPlan } from "../scripts/blockyWorlds/blenderKit/director3.mjs";
import { autoActions, sceneStartState, movementProblems, plan4Problems } from "../scripts/blockyWorlds/blenderKit/director4.mjs";
import { writer4Problems, MOVE_VERBS, EVERYONE } from "../supabase/functions/_shared/blockyWorlds/writer4.js";
import { THINGS } from "../supabase/functions/_shared/blockyWorlds/engineKit.js";

const E = fs.readFileSync("scripts/blockyWorlds/blenderKit/worlds/stage9.py", "utf8");
const plan = normalPlan({
  cast: [{ name: "Me", kid: true }, { name: "Max", kid: true }],
  monster: { present: true, style: "shadow", size: 4 },
  rule: { sentence: "Ring a bell.", object: { thing: "bell", where: "in_hand", who: "Max" } },
  stage: [{ place: "suburb_street", camera_side: "front", monster_starts_here: false, marks: [{ who: "Me", mark: "left" }, { who: "Max", mark: "right" }, { who: "bell#me", mark: "left" }, { who: "bell#max", mark: "right" }] },
    { place: "living_room", camera_side: "front", monster_starts_here: false, marks: [{ who: "Me", mark: "center" }, { who: "Max", mark: "left" }] }],
  scenes: [{ id: 1, from_line: 1, to_line: 2, place: "living_room", time: "night" }, { id: 2, from_line: 3, to_line: 4, place: "suburb_street", time: "night" }],
}, { title: "t", lines: [] });
const script = { lines: [
  { text: "Max and I sit inside.", place: "living_room", on_stage: ["me", "max"], subject: "I", speaker: "narrator" },
  { text: "Max sneaks out the door.", place: "living_room", on_stage: ["me", "max"], subject: "Max", speaker: "narrator" },
  { text: "Max runs down the street.", place: "suburb_street", on_stage: ["max"], subject: "Max", speaker: "narrator" },
  { text: "Then everyone rings their bell!", place: "suburb_street", on_stage: ["max", "me"], subject: "everyone", speaker: "narrator" },
] };
const sceneOf = (n) => plan.scenes.find((x) => n >= x.lines[0] && n <= x.lines[1]);

test("many copies per owner: a bell for each person, in their own hand; kindOf reads the kind", () => {
  const S = initialState(plan);
  assert.equal(S.suburb_street.things["bell#me"].held_by, "me");
  assert.equal(S.suburb_street.things["bell#max"].held_by, "max");
  assert.equal(kindOf("chalk_line#house"), "chalk_line");
  assert.ok(["dog", "car", "chalk", "roof", "chalk_line"].every((k) => THINGS.includes(k)), "the replica's props are on the generated list");
});

test("who is on stage: at a scene's start the on-stage people are there (and nowhere else); enter / exit added in code", () => {
  let S = initialState(plan);
  S = sceneStartState(S, script, 1, plan, sceneOf);
  assert.equal(S.living_room.people.max.here, true);
  assert.equal(S.suburb_street.people.max.here, false, "Max is in one place at a time");
  // the street scene: only Max is out; I come out on line 4 (an enter at word 0)
  let T = sceneStartState(S, script, 3, plan, sceneOf);
  assert.equal(T.suburb_street.people.me.here, false); assert.equal(T.suburb_street.people.max.here, true);
  const a4 = autoActions(script, 4, plan, T, sceneOf);
  assert.ok(a4.some((a) => a.who === "me" && a.do === "enter" && a.on_word === 0), "I enter where the list says I come out");
  assert.ok(a4.some((a) => a.do === "crowd" && a.target === "bell"), '"everyone" = a crowd, each with their own bell');
});

test("movement verbs move: a line that says someone runs must move them", () => {
  assert.ok(MOVE_VERBS.test("Max runs down the street.") && !MOVE_VERBS.test("Max shivers."));
  assert.equal(movementProblems(script, 3, plan, { actions: [{ who: "max", do: "shiver" }] }).length, 1);
  assert.equal(movementProblems(script, 3, plan, { actions: [{ who: "max", do: "run_to", to: "front" }] }).length, 0);
  assert.match(E, /def zs_moved\(/); assert.match(E, /def zs_door_to_door\(/);
  assert.ok(EVERYONE.test("The whole street rings!"));
});

test("the round 9 writer: only the monster speaks (one short introduced line), the rule plain in lines 1-3, places + on stage", () => {
  const s = { opening: "rule_first", key_sentence: "Ring it.", loved_one: "Max", danger_line: 5, fix_line: 6, rule_test: "", kid_understands_rule: false, twist_line: 3, places: ["suburb_street"], cast: [{ name: "Max" }],
    lines: [{ text: "In this town, ring it.", speaker: "narrator", subject: "I", does: "ring", shows: ["bell"], place: "suburb_street", on_stage: ["me"] }, { text: "Grandma said,", speaker: "narrator", subject: "Grandma", does: "talks", shows: ["me"], place: "suburb_street", on_stage: ["me", "grandma"] }, { text: "\"Always ring it, my dear child.\"", speaker: "Grandma", subject: "Grandma", does: "talks", shows: ["me"], place: "kitchen", on_stage: ["me"] }],
    where: [], self_test: ["a", "b", "c"], kid_gets_it: true };
  const p = writer4Problems(s, { lengthSec: 10 }).join(" | ");
  assert.match(p, /Grandma speaks: only the narrator tells the story/);
  assert.match(p, /danger is said plainly in line 1-3/); assert.match(p, /fix_line/); assert.match(p, /9-year-old understand the rule/);
  assert.match(p, /line 3: place "kitchen" is not one of the story's places/); assert.match(p, /on_stage has grandma/);
});

test("the plan: 1-3 places, each line's scene in the writer's place", () => {
  const p = { cast: [{ name: "Me" }, { name: "Max" }], scenes: [{ id: 1, from_line: 1, to_line: 4, place: "suburb_street" }], stage: [{ place: "suburb_street", marks: [] }], rule: { object: { thing: "bell", where: "on_ground" } } };
  assert.match(plan4Problems(p, script).join(" "), /line 1 is in living_room/);
});

test("the camera defaults: the subjects' side of the road, 35-60 % of the frame, kid + monster low, a ground thing alone", () => {
  assert.match(E, /ZC_FRAC\.update\(\{"medium": 0\.5, "two": 0\.45, "close": 0\.55, "insert": 0\.4\}\)/);
  assert.match(E, /def zc_side_ok\(/); assert.match(E, /def zc_kid_monster\(/); assert.match(E, /kind = "close2"/);
  assert.deepEqual(trimShow({ shot: "insert", show: ["me", "drain_grate"] }, "the drain", plan), ["drain_grate"]);
  assert.ok(isMark("@-4,1.5") && isMark("left") && !isMark("somewhere"));
});

test("the night, the monster, the chalk: deep blue-black, taller than the lamps, lines drawn and washed", () => {
  assert.match(E, /def zs_deep_night\(/); assert.match(E, /\(0\.006, 0\.009, 0\.03, 1\.0\)/, "a nearly black-blue sky");
  assert.match(E, /want = max\(lamp_top \* 1\.35/, "taller than the street lamps");
  for (const f of ["zs_house_rings", "zs_draw_around", "zs_draw_line", "zs_wash", "zs_reveal", "zs_crowd"]) assert.match(E, new RegExp(`def ${f}\\(`), f);
  const S = initialState({ ...plan, house_rings: true });
  assert.ok(S.suburb_street.things["chalk_line#house"].here, "the house's own chalk line");
  const T = compileTakes({ plan: { ...plan, house_rings: true }, cards: [{ line: 1, actions: [], faces: {}, cuts: [{ from_word: 0, shot: "wide", show: ["me"], move: "push_in" }] }, { line: 2, actions: [], faces: {}, cuts: [] }, { line: 3, actions: [], faces: {}, cuts: [] }, { line: 4, actions: [], faces: {}, cuts: [] }], states: [null, S, S, S, S, S], lines: script.lines.map((l, i) => ({ ...l, start: i * 2, end: i * 2 + 1.8, next: i * 2 + 2, w0: i * 5, words: l.text.split(" ").map((w, j) => ({ word: w, start: i * 2 + j * 0.3 })) })), looks: lockLooks(plan.cast) });
  assert.match(T.takes[2], /zs_house_rings\("suburb_street"/);
  const r = applyCard(S, { actions: [{ who: "me", do: "draw_around", target: "max", on_word: 1 }] }, { place: "suburb_street", line: script.lines[3], plan });
  assert.deepEqual(r.problems, []); assert.ok(r.state.suburb_street.things["chalk_line#max"].here);
});

test("round 9b: if the engine doesn't have it, build it: the replica's pieces are on the engine and the generated list", () => {
  const B = fs.readFileSync("scripts/blockyWorlds/blenderKit/worlds/stage9b.py", "utf8");
  for (const f of ["zs_draw_path", "zs_wash2", "zs_wall_flash", "zs_monster_hits_wall", "zs_dad", "zs_gait", "zs_roof_over", "zs_rain_streaks", "zs_melt", "zc_fix_frame", "zt_build_pizza_box"]) assert.ok(B.includes(`def ${f}(`), f);
  for (const g of ["panic", "sprint", "chalk_run", "crouch", "monster"]) assert.ok(B.includes(`"${g}": (`), `the ${g} gait`);
  assert.match(B, /if kind == "aerial":/); assert.match(B, /if kind == "legs" and people:/);
  assert.ok(THINGS.includes("pizza_box"), "the pizza box is on the generated list");
  assert.match(B, /nd\.inputs\["Roughness"\]\.default_value = 1\.0/, "the monster is matte, never shiny");
});
