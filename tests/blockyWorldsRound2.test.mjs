// ROUND 2 (owner 2026-11-21): the writer v2's measurable rules, the scene splitting on real voice timing, THE WORDS
// CHECK (all cards' words joined = the script), the scene-card rules and the card compiler.
import test from "node:test";
import assert from "node:assert/strict";
import { writer2Problems, openingHint } from "../supabase/functions/_shared/blockyWorlds/writer2.js";
import { timedWords, scenesOf, wordsProblems, sceneProblems, capCloseUps } from "../scripts/blockyWorlds/blenderKit/sceneCards.mjs";
import { compileScene } from "../scripts/blockyWorlds/blenderKit/cards.mjs";

const lines = (n, f = (i) => `Line ${i} is short and simple.`) => Array.from({ length: n }, (_, i) => ({ text: f(i), speaker: "" }));
const good = () => ({ opening: "rule_first", story_type: "rescue_rule", title: "T", rule: "r", rule_again_line: 3, cast: [{ name: "Max", who: "a kid" }],
  lines: [{ text: "In this town, every time you laugh, a flower grows.", speaker: "" }, ...lines(33)], self_test: ["a", "b", "c"], kid_gets_it: true,
  // round 6: the who-is-where self-test, one entry per line
  where: Array.from({ length: 34 }, (_, i) => ({ line: i + 1, who_where: "Me: on the street" })) });

test("writer v2: a clean script passes; the openings, hard words, names and self-test are caught", () => {
  assert.deepEqual(writer2Problems(good()), []);
  assert.match(writer2Problems({ ...good(), opening: "result_first" }).join(" "), /And I just/);
  const hard = good(); hard.lines[5] = { text: "The warden plucks a flower.", speaker: "" };
  assert.match(writer2Problems(hard).join(" "), /hard words.*pluck/);
  assert.match(writer2Problems({ ...good(), cast: [{ name: "Max" }, { name: "Lily" }, { name: "Sam" }, { name: "Mia" }] }).join(" "), /at most 3/);
  assert.match(writer2Problems({ ...good(), cast: [{ name: "Hobartius" }] }).join(" "), /unusual names/);
  assert.match(writer2Problems({ ...good(), kid_gets_it: false }).join(" "), /10-year-old/);
  assert.match(writer2Problems({ ...good(), rule_again_line: 9 }).join(" "), /again/);
  assert.match(openingHint(["result_first", "result_first"]), /other one/);
});

const script = { title: "S", lines: [{ text: "And I just stopped a monster by sitting on a box!" }, { text: "You see, in this town, when the street lamps turn on, a monster climbs out of the storm drain." }, { text: "Click!" }, { text: "Max ran home." }] };
const voice = () => { const w = []; let t = 0; for (const l of script.lines) for (const x of l.text.split(/\s+/)) { w.push({ word: x.replace(/[!,.]/g, ""), start: t, end: t + 0.2 }); t += 0.25; } return w; };

test("scenes from the real timing: 1-3 s, a long line split, a short line joined, the words check passes", () => {
  const tw = timedWords(script, voice());
  assert.equal(tw.filter((w) => w.start == null).length, 0);
  const sc = scenesOf(script, tw);
  assert.deepEqual(wordsProblems(script, sc), []);
  assert.ok(sc.length >= 3);
  for (const s of sc) assert.ok(s.end - s.start <= 3.3, `${s.words}: ${s.end - s.start}`);
  // the 1-word "Click!" joined a neighbour
  assert.ok(!sc.some((s) => s.words === "Click!"));
  // a broken partition is caught
  const bad = sc.map((s) => ({ ...s })); bad[1].words = bad[1].words.replace("town,", "city,");
  assert.match(wordsProblems(script, bad).join(" "), /do not equal the script/);
});

const plan = { cast: [{ name: "Me" }, { name: "Max", shirt: "#34c759" }], places: ["downtown_street"], lines: [], props: [{ kind: "box", size: 3 }], monster: { present: true, style: "slime", size: 3.5 } };
const frame = (over = {}) => ({ place: "downtown_street", time: "night", camera: { type: "wide", side: "front" }, people: [], props: [], ...over });
test("scene-card rules: the named person / thing / monster, close-ups, one place", () => {
  const scene = { id: 2, words: "Max grabbed a big box near the monster", wordList: "Max grabbed a big box near the monster".split(" ").map((w, i) => ({ word: w, start: i * 0.3 })) };
  const card = { purpose: "action", start: frame(), end: frame(), motion: [], sfx: [] };
  const p = sceneProblems(card, { scene, plan, firstOfPlace: false, monsterSeen: true }).join(" | ");
  assert.match(p, /Max must be visible/); assert.match(p, /box/); assert.match(p, /monster/);
  const ok = { purpose: "action", start: frame({ people: [{ who: "Max", mark: "center", pose: "reach", face: "determined", looks_at: "box" }, { who: "monster", mark: "back", pose: "stand", face: "angry", looks_at: "camera" }], props: [{ kind: "box", mark: "center", state: "normal", held_by: "", count: 1 }] }), end: frame(), motion: [{ on_word: 1, who: "Max", action: "grab", target: "box" }], sfx: [] };
  assert.deepEqual(sceneProblems(ok, { scene, plan, firstOfPlace: false, monsterSeen: true }), []);
  const close = { ...ok, start: { ...ok.start, camera: { type: "close", side: "front" } } };
  assert.match(sceneProblems(close, { scene, plan, firstOfPlace: false, monsterSeen: true }).join(" "), /close camera is only/);
  assert.match(sceneProblems({ ...ok, end: frame({ place: "shop" }) }, { scene, plan, firstOfPlace: false, monsterSeen: true }).join(" "), /same place/);
  const many = Array.from({ length: 8 }, () => ({ card: { purpose: "reaction", start: { camera: { type: "close" } }, end: { camera: { type: "close" } } } }));
  assert.equal(capCloseUps(many), 6);
  assert.equal(many.filter((c) => c.card.start.camera.type === "close").length, 2);
});

test("the compiler: marks, poses, the monster climbing out of the drain, a grab on its word, the start -> end camera", () => {
  const scene = { id: 4, line: 2, words: "a monster climbs out of the storm drain", start: 10, end: 12.4, wordList: "a monster climbs out of the storm drain".split(" ").map((w, i) => ({ word: w, start: 10 + i * 0.3 })) };
  const card = { purpose: "action", start: frame({ camera: { type: "monster_reveal", side: "front" }, props: [{ kind: "drain_grate", mark: "far", state: "normal", held_by: "", count: 1 }, { kind: "lamp_bulb", mark: "left", state: "normal", held_by: "", count: 1 }] }), end: frame({ camera: { type: "monster_full", side: "front" }, props: [{ kind: "drain_grate", mark: "far", state: "normal", held_by: "", count: 1 }] }),
    motion: [{ on_word: 2, who: "monster", action: "climb_out", target: "drain_grate" }], camera_move: "push", sfx: [] };
  const code = compileScene(card, { plan, scene });
  assert.match(code, /mon = zw_monster\("Monster", zw_mark\("downtown_street", "far"/);
  assert.match(code, /zw_climb_out\(mon, \(t0 \+ 0\.250 \* dur\)/);
  // round 5 (owner): the climbing monster IS framed with its drain (it is already half out when the words begin)
  assert.match(code, /zw_scene_cam\(cam, t0, t1, \("monster_reveal", \[mon\], \[drain_grate_100\]/);
  assert.match(code, /\("monster_full", \[mon\]/);
  assert.doesNotMatch(code, /lamp_bulb/);                                       // the street lamp is the world's own lamp
  assert.match(code, /zw_flee\(mon, t0, t1, n=3\)/);
});
