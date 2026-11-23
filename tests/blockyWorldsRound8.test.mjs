// In This Town round 8 (owner 2026-11-23): one continuous take per scene, the state carried line to line and checked in
// code, the cast looks locked, the cameras on the running scene, the round 8 writer's checks.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyCard, cutProblems, compileTakes, initialState, lockLooks, namedIn, ACTIONS8 } from "../scripts/blockyWorlds/blenderKit/takes.mjs";
import { fixCuts, plan3Problems, normalPlan } from "../scripts/blockyWorlds/blenderKit/director3.mjs";
import { writer3Problems } from "../supabase/functions/_shared/blockyWorlds/writer3.js";
import { ACTIONS8 as GEN8, THINGS, engineKitText8 } from "../supabase/functions/_shared/blockyWorlds/engineKit.js";
import { staticCheck } from "../scripts/blockyWorlds/blenderKit/director.mjs";

const plan = normalPlan({
  cast: [{ name: "Me", kid: true, hair: "spiky" }, { name: "Ben", kid: true, hair: "messy" }],
  monster: { present: true, style: "shadow", size: 3.8 },
  rule: { sentence: "Hold the bell.", object: { thing: "bell", where: "in_hand", who: "Ben", what_it_does: "rings to keep it away" } },
  places: { main: "suburb_street", side: "none" },
  stage: [{ place: "suburb_street", camera_side: "front", monster_starts_here: false, marks: [{ who: "Me", mark: "left" }, { who: "Ben", mark: "right" }, { who: "drain_grate", mark: "front" }] }],
  scenes: [{ id: 1, from_line: 1, to_line: 2, place: "suburb_street", time: "day", busy: "empty" }, { id: 2, from_line: 3, to_line: 3, place: "suburb_street", time: "night", busy: "empty" }],
  props: [{ kind: "bell", size: 1 }],
}, { title: "T", lines: [] });
const lines = [
  { text: "In this town, Ben rings his bell.", speaker: "narrator", start: 0.0, end: 2.0, next: 2.1, w0: 0 },
  { text: "I grab a ball and Ben laughs.", speaker: "narrator", start: 2.1, end: 4.0, next: 4.2, w0: 7 },
  { text: "Then the monster climbs out of the drain!", speaker: "narrator", start: 4.2, end: 6.4, next: 6.6, w0: 14 },
].map((l) => ({ ...l, words: l.text.split(" ").map((w, i) => ({ word: w, start: l.start + i * 0.28 })) }));

test("the state: everyone starts on the stage map; the rule object is in its person's hand", () => {
  const S = initialState(plan);
  assert.equal(S.suburb_street.people.me.mark, "left");
  assert.equal(S.suburb_street.people.ben.holding, "bell");
  assert.equal(S.suburb_street.things.bell.held_by, "ben");
  assert.equal(S.suburb_street.things.drain_grate.mark, "front");
});

test("a card that contradicts the state is rejected in code (nobody acts who is not there, nothing given that is not held)", () => {
  const S = initialState(plan);
  const bad = { actions: [{ who: "Mia", do: "wave", on_word: 0 }, { who: "Me", do: "give", target: "ben", on_word: 1 }, { who: "monster", do: "roar", on_word: 2 }, { who: "Ben", do: "pick_up", target: "ball", on_word: 3 }], cuts: [] };
  const r = applyCard(S, bad, { place: "suburb_street", line: lines[1], plan });
  assert.equal(r.problems.length, 4, r.problems.join(" | "));
  assert.match(r.problems.join(" "), /not in the cast/); assert.match(r.problems.join(" "), /holds nothing to give/);
  assert.match(r.problems.join(" "), /monster is not in the scene/); assert.match(r.problems.join(" "), /not in the scene to pick up/);
  const good = applyCard(S, { actions: [{ who: "ball", do: "appear", target: "ball", to: "me", on_word: 1 }, { who: "Me", do: "pick_up", target: "ball", on_word: 2 }], cuts: [] }, { place: "suburb_street", line: lines[1], plan });
  assert.deepEqual(good.problems, []);
  assert.equal(good.state.suburb_street.people.me.holding, "ball", "the state after the line: I hold the ball");
  assert.equal(S.suburb_street.people.me.holding, null, "the state before is never changed");
});

test("the cuts: 1-3 a line, from word 0, every named thing shown, never the same shot twice in a row", () => {
  const S = initialState(plan);
  const card = { cuts: [{ from_word: 0, shot: "medium", show: ["ben"], move: "push_in" }, { from_word: 3, shot: "medium", show: ["ben"], move: "push_in" }] };
  const p = cutProblems(card, { line: lines[0], plan, stateBefore: S, stateAfter: S, place: "suburb_street", dur: 2.0 });
  assert.match(p.join(" "), /names "bell" but no cut shows it/);
  assert.match(p.join(" "), /same shot of the same thing/);
  const fixed = fixCuts(card, { line: lines[0], plan, stateBefore: S, stateAfter: S, place: "suburb_street" });
  assert.ok(fixed.cuts.some((c) => c.show.includes("bell")), "the code adds the named thing to a cut");
  assert.deepEqual(namedIn("Then the monster climbs out of the drain!", plan), ["monster"]);
});

test("ONE TAKE PER SCENE: the scene built once, every shot calls the take and only puts a camera on it; looks locked", () => {
  let S = initialState(plan);
  const cards = [
    { line: 1, actions: [{ who: "ben", do: "wave", target: "", to: "", on_word: 4 }], faces: { ben: "happy", me: "happy" }, cuts: [{ from_word: 0, shot: "wide", show: ["ben", "bell", "me"], move: "push_in" }, { from_word: 4, shot: "insert", show: ["bell"], move: "push_in" }] },
    { line: 2, actions: [{ who: "ball", do: "appear", target: "ball", to: "me", on_word: 2 }, { who: "me", do: "pick_up", target: "ball", to: "", on_word: 2 }, { who: "ben", do: "laugh", target: "", to: "", on_word: 5 }], faces: { ben: "laughing" }, cuts: [{ from_word: 0, shot: "medium", show: ["me", "ball"], move: "push_in" }, { from_word: 4, shot: "close", show: ["ben"], move: "static" }] },
    { line: 3, actions: [{ who: "monster", do: "climb_out", target: "drain_grate", to: "front", on_word: 3 }], faces: { me: "terrified", ben: "scared" }, cuts: [{ from_word: 0, shot: "low", show: ["monster", "ben"], move: "tilt_up" }, { from_word: 6, shot: "insert", show: ["drain_grate"], move: "top_down" }] },
  ];
  const states = [];
  cards.forEach((c, i) => { states[i + 1] = S; const r = applyCard(S, c, { place: plan.scenes[i < 2 ? 0 : 1].place, line: lines[i], plan }); assert.deepEqual(r.problems, []); S = r.state; });
  states[4] = S;
  const looks = lockLooks(plan.cast);
  assert.notEqual(looks.me.shirt, looks.ben.shirt, "one bold colour per character");
  const T = compileTakes({ plan, cards, states, lines, looks });
  assert.deepEqual(Object.keys(T.takes), ["1", "2"]);
  assert.equal((T.takes[1].match(/zw_person\(/g) ?? []).length, 2, "the cast built once per scene");
  assert.match(T.takes[1], /zo_appear\(H\.get\("ball"\)/); assert.match(T.takes[1], /zs_hide\(H\["ball"\]\)/, "the ball is built with the scene, hidden until it appears");
  assert.match(T.takes[2], /H\["ball"\] = zw_thing/, "the night scene starts from the state the street was left in: I still hold the ball");
  assert.match(T.takes[2], /zw_grab\(H\["me"\], T0 - 0\.3, H\["ball"\]\)/);
  assert.match(T.takes[2], /style="shadow"/); assert.match(T.takes[2], /zw_climb_out\(H\["monster"\]/);
  assert.match(T.takes[1], new RegExp(looks.ben.shirt), "the locked look");
  assert.equal(T.shots.length, 6); assert.equal(T.shots[0].w0, 0);
  // the shots file the runner sends, through the real static check
  const KIT = "scripts/blockyWorlds/blenderKit";
  const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py", "worlds/effects.py", "worlds/stage.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
  const src = ['"""t"""', "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", LIB, "", ...Object.values(T.takes), "",
    ...T.shots.map((s) => `@S(${s.id}, ${s.w0}, ${s.w1 ?? "None"}, "x")\ndef s${String(s.id).padStart(3, "0")}(t0, t1):\n    H = take_${s.scene}(0.0)\n    ${T.cutCall(s)}\n`)].join("\n");
  const r = staticCheck(src, path.join(os.tmpdir(), "r8_shots.py"));
  assert.ok(r.ok, JSON.stringify(r.problems?.slice(0, 4)));
  for (const s of T.shots) assert.doesNotMatch(src.slice(src.indexOf(`def s${String(s.id).padStart(3, "0")}(`)).split("\n@S(")[0], /zw_person|zw_build/, "a shot builds nothing");
});

test("the plan: one main place + at most one side place, scenes cover every line, the rule object", () => {
  const p = { cast: [{ name: "Me" }, { name: "Ben" }], scenes: [{ id: 1, from_line: 1, to_line: 2, place: "suburb_street" }, { id: 2, from_line: 3, to_line: 3, place: "kitchen" }, { id: 3, from_line: 4, to_line: 4, place: "shop" }], stage: [], rule: { object: { thing: "bell", where: "in_hand", who: "Ben" } } };
  const pr = plan3Problems(p, { lines: [1, 2, 3, 4].map(() => ({ text: "x" })) });
  assert.match(pr.join(" "), /3 places/); assert.match(pr.join(" "), /no stage map/);
});

test("the round 8 writer: one subject doing one thing, the key sentence early and at the climax, a twist last, only listed things", () => {
  const s = { opening: "rule_first", key_sentence: "Ring it, run it.", loved_one: "Ben", danger_line: 5, rule_trick_line: 7, twist_line: 9, cast: [{ name: "Ben" }],
    lines: Array.from({ length: 9 }, (_, i) => ({ text: i === 0 ? "In this town, every kid has a bell. Ring it, run it." : `Line ${i + 1} it's fine.`, speaker: "narrator", subject: "Ben", does: "rings", shows: i === 3 ? ["trumpet"] : ["ben", "bell"] })),
    where: Array.from({ length: 9 }, (_, i) => ({ line: i + 1, who_where: "Ben: street" })), self_test: ["a", "b", "c"], kid_gets_it: true };
  const p = writer3Problems(s, { lengthSec: 20 });
  assert.match(p.join(" "), /AGAIN, word for word, at the climax/);
  assert.match(p.join(" "), /line 4 shows trumpet: not on the engine's lists/);
  assert.match(p.join(" "), /sound word/);
});

test("the engine list is generated: the round 8 actions are the take compiler's, the new props are listed", () => {
  assert.deepEqual(Object.keys(GEN8).sort(), Object.keys(ACTIONS8).sort());
  for (const k of ["chalk_line", "splat"]) assert.ok(THINGS.includes(k), k);
  assert.match(engineKitText8(), /switch_all_on/); assert.match(engineKitText8(), /windows_open/); assert.match(engineKitText8(), /shadow/);
});

test("the first test's fixes: only a light turns on, the stage is cleared once per take, the drain behind the cast, the story checks", async () => {
  const S = initialState(plan);
  const r = applyCard(S, { actions: [{ who: "ben", do: "turn_on", target: "bell", on_word: 1 }], cuts: [] }, { place: "suburb_street", line: lines[0], plan });
  assert.match(r.problems.join(" "), /only a light switches on/);
  const T = compileTakes({ plan, cards: [{ line: 1, actions: [], faces: {}, cuts: [{ from_word: 0, shot: "wide", show: ["ben", "bell"], move: "push_in" }] }, { line: 2, actions: [], faces: {}, cuts: [{ from_word: 0, shot: "medium", show: ["me"], move: "track" }] }, { line: 3, actions: [], faces: {}, cuts: [{ from_word: 0, shot: "close", show: ["ben"], move: "static" }] }], states: [null, S, S, S, S], lines, looks: lockLooks(plan.cast) });
  assert.match(T.takes[1], /zs_clear_stage\("suburb_street"\)/, "the yard clutter leaves the take once (every shot the same street)");
  const { storyChecks } = await import("../scripts/blockyWorlds/blenderKit/director3.mjs");
  const sc = storyChecks(plan, [{ cuts: [{ shot: "wide", show: ["ben", "bell"], move: "push_in" }, { shot: "close", show: ["me"], move: "static" }] }]);
  assert.match(sc.problems.join(" "), /drain is at "front"/, "a drain in the middle blocks every camera: behind the cast");
  assert.ok(!sc.problems.some((p) => /line 1's first cut/.test(p)), "line 1 opens on a wide with the rule object");
  const E = fs.readFileSync("scripts/blockyWorlds/blenderKit/worlds/stage.py", "utf8");
  assert.match(E, /o\.scale = \(0\.0001, 0\.0001, 0\.0001\)/, "the shadow's face parts are scaled away (set_visible would show hidden ones again)");
});

test("the engine pieces: the shadow monster, many switches, faces, the light, the cameras on the stage side", () => {
  const E = fs.readFileSync("scripts/blockyWorlds/blenderKit/worlds/stage.py", "utf8");
  for (const f of ["zc_cut", "zs_switch_all", "zs_windows_open", "zf_star_eyes", "zf_x_eyes", "zf_sweat", "zf_splat", "zf_sign", "zs_light", "zo_drop", "zo_state", "zo_move", "zs_dive", "zs_enter"]) assert.match(E, new RegExp(`def ${f}\\(`), f);
  assert.match(E, /ZW_MON_STYLES\["shadow"\]/);
  assert.match(E, /far = aim \+ \(loc - aim\) \* 1\.18/, "the push-in starts wider and ends on the framing");
  assert.match(E, /a0 = math\.radians\(ZS\["side"\]/, "the camera stays on the stage's side");
});
