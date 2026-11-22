// In This Town round 4 (owner 2026-11-22): 12 global rules + story rules, motion, town shots, the faster pace.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { GLOBAL_RULES, globalRulesText, RULES_FOR, storyRulesText } from "../supabase/functions/_shared/blockyWorlds/rules.js";
import { WRITER2_SYSTEM } from "../supabase/functions/_shared/blockyWorlds/writer2.js";
import { PLAN_SYSTEM, planSchema } from "../scripts/blockyWorlds/blenderKit/director2.mjs";
import { SCENE_SYSTEM, sceneProblems } from "../scripts/blockyWorlds/blenderKit/sceneCards.mjs";
import { compileScene } from "../scripts/blockyWorlds/blenderKit/cards.mjs";
import { ACTIONS } from "../supabase/functions/_shared/blockyWorlds/engineKit.js";
import { keepRanges, tempoFor } from "../scripts/blockyWorlds/engine/voice/eleven.mjs";
import { NARRATOR } from "../supabase/functions/_shared/blockyWorlds/config.js";

test("rules: exactly 12 short global rules, the same text in every step that reads them", () => {
  assert.equal(GLOBAL_RULES.length, 12);
  for (const r of GLOBAL_RULES) assert.ok(r.length < 230, r);
  for (const n of RULES_FOR.writer) assert.ok(WRITER2_SYSTEM.includes(GLOBAL_RULES[n - 1]));
  for (const n of RULES_FOR.plan) assert.ok(PLAN_SYSTEM.includes(GLOBAL_RULES[n - 1]));
  for (const n of RULES_FOR.scene) assert.ok(SCENE_SYSTEM.includes(GLOBAL_RULES[n - 1]));
  assert.doesNotMatch(SCENE_SYSTEM, /A new place starts with a wide camera/, "the old contradicting rule is gone");
  assert.match(globalRulesText([4]), /^THE GLOBAL RULES/);
});

test("rules: the plan writes STORY RULES fresh (schema + prompt), and they reach the scene step", () => {
  assert.ok(planSchema().properties.story_rules);
  assert.match(PLAN_SYSTEM, /STORY RULES/);
  const t = storyRulesText({ story_rules: { mood: "spooky", colours: "blue", camera_style: "glide", cut_every_s: 1.2, places_why: "x", outside: "y" }, town: { rule: "nobody out at night", habits: ["home at dusk"] } });
  assert.match(t, /mood spooky/); assert.match(t, /every 1.2 s/); assert.match(t, /nobody out at night/);
});

test("rules: the first scene of a place is no longer forced wide (rule 8: the engine opens it with a moving shot)", () => {
  const fr = (cam) => ({ place: "suburb_street", time: "day", camera: { type: cam, side: "front" }, people: [], props: [] });
  const card = { purpose: "action", start: fr("medium"), end: fr("medium"), motion: [] };
  const p = sceneProblems(card, { scene: { words: "We go out.", wordList: [{ word: "We" }] }, plan: { cast: [], places: ["suburb_street"] }, firstOfPlace: true, monsterSeen: true });
  assert.ok(!p.some((x) => /starts wide/.test(x)));
});

test("motion: the new actions are in the engine kit and compile to the motion library", () => {
  for (const a of ["turn", "look_around", "stand_up", "lie_down", "read", "phone", "kick", "catch", "nod", "shake_head", "pick_up", "carry", "open_door", "peek", "shiver", "cry", "cheer", "hug", "wave"]) assert.ok(ACTIONS[a], a);
  const fr = (people, props = []) => ({ place: "suburb_street", time: "day", camera: { type: "medium", side: "front" }, people, props });
  const P = (mark) => ({ who: "Mia", mark, pose: "stand", face: "happy", looks_at: "camera" });
  const card = { start: fr([P("center")], [{ kind: "book", mark: "center", state: "normal", held_by: "", count: 1 }]), end: fr([P("center")], [{ kind: "book", mark: "center", state: "normal", held_by: "", count: 1 }]),
    motion: [{ on_word: 0, who: "Mia", action: "read", target: "book" }, { on_word: 1, who: "Mia", action: "nod", target: "" }, { on_word: 1, who: "Mia", action: "walk", target: "" }] };
  const scene = { start: 0, end: 2.4, words: "Mia reads a book", wordList: [{ word: "Mia", start: 0 }, { word: "reads", start: 0.4 }, { word: "a", start: 0.8 }, { word: "book", start: 1.0 }] };
  const py = compileScene(card, { plan: { cast: [{ name: "Mia" }] }, scene, cut: true });
  assert.match(py, /zm_read\(mia_0, .*book_100\)/); assert.match(py, /zm_nod\(mia_0/);
  assert.match(py, /size=zw_tsize\("book", 1\.2\) \* 1\.7/, "a thing the words name is drawn bigger (real size at the people's scale x 1.7; x 1.3 when held)");
  assert.match(py, /zw_scene_cam\(.*"left"\), cut=True\)/, "a cut halfway; equal framings: the second half from another side");
  const est = compileScene(card, { plan: { cast: [{ name: "Mia" }] }, scene, establish: "follow" });
  assert.match(est, /zw_establish\(cam, t0, t1, "suburb_street", "follow", follow=mia_0, end=\("medium", \[mia_0\]/, "it ends on the card's end framing");
});

test("motion: the engine library has the reel's actions and the walk matches the ground", () => {
  const m = fs.readFileSync("scripts/blockyWorlds/blenderKit/worlds/motion.py", "utf8");
  for (const f of ["zm_walk", "zm_turn", "zm_look_around", "zm_sit", "zm_stand_up", "zm_lie", "zm_read", "zm_phone", "zm_kick", "zm_throw_ball", "zm_catch", "zm_play_catch", "zm_wave", "zm_talk", "zm_nod", "zm_shake_head", "zm_pick_up", "zm_carry", "zm_door", "zm_jump", "zm_fall", "zm_hide_peek", "zm_shiver", "zm_cheer", "zm_cry", "zm_hug", "zm_alive"]) assert.match(m, new RegExp(`def ${f}\\(`), f);
  assert.match(m, /rate = v \/ \(4\.0 \* L \* math\.sin\(math\.radians\(swing\)\)\)/, "steps per second from the speed: no sliding");
  const w = fs.readFileSync("scripts/blockyWorlds/blenderKit/worlds/worlds.py", "utf8");
  for (const f of ["zw_establish", "zw_preview_res"]) assert.match(w, new RegExp(`def ${f}\\(`));
  assert.match(w, /lambda: zm_alive_all\(S\)/, "idle life on every character in the hook");
});

test("pace: pauses after a sentence become 0.15 s (inside a line 0.08 s); 1.25x and 1.3x from the same take", () => {
  const spoken = [{ w: "home.", s: 0, e: 0.5 }, { w: "Then", s: 1.2, e: 1.5 }, { w: "we", s: 1.9, e: 2.1 }];
  const r = keepRanges(spoken, 3);
  assert.equal(r.length, 3);
  assert.equal(+((r[0][1] - 0.5) + (1.2 - r[1][0])).toFixed(3), 0.15, "the sentence pause keeps 0.15 s");
  assert.equal(+(1.9 - r[2][0]).toFixed(3), 0.04);
  assert.equal(tempoFor({ ...NARRATOR, pace: 1.25 }), 1.0417);
  assert.equal(tempoFor(NARRATOR), 1.0833, "1.3x is the default (round 5)");
});
