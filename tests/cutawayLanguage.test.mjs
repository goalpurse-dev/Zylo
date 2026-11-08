// Scene language v2 (SCENE_LANGUAGE_V2.md): the registry, the typed field lists (phase 1b) and the validator.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REGISTRY, validateScene } from "../scripts/cutaway/proto3d/m2/language.js";
import { FIELDS, COMMON, RIG_SHAPE_FIELDS, RIG_MOVE_FIELDS } from "../scripts/cutaway/proto3d/m2/fields.js";
import { RIG_SHAPES, RIG_MOVES } from "../scripts/cutaway/proto3d/m2/rig.js";
import { KINDS } from "../scripts/cutaway/proto3d/m2/parts.js";
import { scanKinds } from "../scripts/cutaway/proto3d/m3/fieldScan.mjs";

const PLANS = path.join(path.dirname(fileURLToPath(import.meta.url)), "../scripts/cutaway/proto3d/m3/sweep/plans");
const scene = (parts, beats = []) => ({ world: {}, parts, beats });

test("every kind the renderer builds has a typed field list, and every rig shape and move has one", () => {
  for (const k of Object.keys(KINDS)) assert.ok(FIELDS[k], `kind ${k} has no field list`);
  for (const k of Object.keys(REGISTRY.kinds)) assert.ok(REGISTRY.kinds[k].typed, `registry kind ${k} is not typed`);
  for (const s of RIG_SHAPES) assert.ok(RIG_SHAPE_FIELDS[s], s);
  for (const m of RIG_MOVES) assert.ok(RIG_MOVE_FIELDS[m], m);
});

test("the field lists cover every field the builders read (m3/fieldScan.mjs)", () => {
  const scan = scanKinds(Object.keys(FIELDS));
  for (const [k, read] of Object.entries(scan)) {
    assert.ok(read, `no builder found for ${k}`);
    const f = FIELDS[k].f;
    for (const x of read) {
      const [a, b] = x.split(".");
      assert.ok(a in f || a in COMMON, `${k} reads ${a}, not in its field list`);
      if (b && f[a]?.obj) assert.ok(b in f[a].obj, `${k} reads ${x}, not in its field list`);
    }
  }
});

test("the 62 saved plans: only the known real errors", () => {
  const all = [];
  for (const f of fs.readdirSync(PLANS)) {
    const L = JSON.parse(fs.readFileSync(path.join(PLANS, f), "utf8")).layout;
    for (const e of validateScene(L)) all.push(`${f}: ${e.at} ${e.error}`);
  }
  // the bridge's pier model has size [1.6, 5.4, 1.6] (a model's size is one number: it was drawn 1 m tall); the chainsaw's
  // arrows are given start/stop (arrows have show/hide)
  assert.equal(all.length, 3, all.join("\n"));
  assert.equal(all.filter((s) => s.startsWith("bridge.json") && /model\)\.size .*should be a number/.test(s)).length, 1);
  assert.equal(all.filter((s) => s.startsWith("kitplan_chainsaw.json") && /arrows legWarn has no verb/.test(s)).length, 2);
});

test("named, fixable field errors: unknown field with a hint, wrong type, missing required field, bad material", () => {
  const e = validateScene(scene([{ id: "slab", kind: "box", params: { mat: "concret", size: [4, 0.2], pos: [0, 0, -2], recieveShadow: true } }]));
  const text = e.map((x) => `${x.at} ${x.error}`).join("\n");
  assert.match(text, /slab\)\.params\.mat .*material name.*did you mean concrete/);
  assert.match(text, /params\.size .*a list of 3 numbers/);
  assert.match(text, /params\.recieveShadow is not a field here.*did you mean receiveShadow/);
  const miss = validateScene(scene([{ id: "p", kind: "pipeRun", params: { r: 0.2 } }]));
  assert.match(miss.map((x) => x.at + " " + x.error).join("\n"), /params\.path is missing: a pipeRun needs path/);
  const top = validateScene(scene([{ id: "c", kind: "counter", pos: [0, 1, 0], params: { pos: [0, 1, 0] } }]));
  assert.match(top.map((x) => x.at + " " + x.error).join("\n"), /\(c\)\.pos is not a part key/);
});

test("nested fields: opts, panel items, one-of words, rig shapes and moves", () => {
  const e = validateScene(scene([
    { id: "a", kind: "arrows", params: { list: [{ at: [0, 1, 0], dir: [1, 0], travel: 1 }], opts: { scale: 1, colour: "#fff" } } },
    { id: "f", kind: "fx", params: { type: "explosion", at: [0, 1, 0] } },
    { id: "r", kind: "rig", params: { name: "door", pos: [0, 0, -2], nodes: [{ id: "d", at: [0, 0, 0], shapes: [{ shape: "box", size: [2, 2, 0.1], at: [0, 1, 0], colr: "#fff" }], moves: [{ name: "open", type: "swing", axis: "y", angel: 90 }] }] } },
  ]));
  const text = e.map((x) => `${x.at} ${x.error}`).join("\n");
  assert.match(text, /opts\.colour is not a field here.*did you mean color/);
  assert.match(text, /params\.type .*one of blast/);
  assert.match(text, /shapes\[0\] \(box\)\.colr is not a field here.*did you mean color/);
  assert.match(text, /moves\[0\] \(open\)\.angel is not a field here.*did you mean angle/);
});

test("1c: the handbook is generated from the registry and is what the planner reads", async () => {
  const { handbookText, typeText } = await import("../scripts/cutaway/proto3d/m2/handbook.js");
  const { SCENE_SYSTEM } = await import("../scripts/cutaway/proto3d/m2/planner.mjs");
  const h = handbookText();
  for (const [k, d] of Object.entries(REGISTRY.kinds)) {
    assert.ok(h.includes(`- ${k}: `), `kind ${k} missing`);
    for (const f of d.need) assert.ok(h.includes(`${f}* `), `${k}: needed field ${f} not marked`);
  }
  for (const s of RIG_SHAPES) assert.ok(h.includes(`  ${s}: `), `rig shape ${s} missing`);
  for (const w of [...REGISTRY.roles, ...REGISTRY.moods, ...REGISTRY.settings]) assert.ok(h.includes(w), w);
  assert.match(h, /CAMERA SIZES[\s\S]*36% of the frame width/);
  assert.match(h, /a model\s+shape's size is ONE number/);
  assert.match(h, /one shape at most 16 m long, the whole part at most 18 m across/);
  assert.ok(SCENE_SYSTEM.includes(h), "the scene planner's system prompt carries the handbook");
  assert.equal(typeText("one:x,z"), '"x"|"z"');
  // (every example in the handbook passes the validator)
  const ex = JSON.parse(fs.readFileSync(new URL("../scripts/cutaway/proto3d/m2/handbookExamples.json", import.meta.url), "utf8"));
  for (const [k, e] of Object.entries(ex)) assert.deepEqual(validateScene(scene([{ id: "x", kind: k, params: e.params }])), [], k);
});

test("1c: the contradiction list of 2026-11-07, resolved", async () => {
  const { VISIBLE } = await import("../scripts/cutaway/proto3d/m2/chain.js");
  const { speakable, fixStory, draftSentences } = await import("../scripts/cutaway/proto3d/m2/planner.mjs");
  const { clarityChecks } = await import("../scripts/cutaway/proto3d/m2/clarity.js");
  const { moodFor } = await import("../scripts/cutaway/proto3d/m2/moods.js");
  const { handbookText } = await import("../scripts/cutaway/proto3d/m2/handbook.js");
  const h = handbookText();
  // a. brown and grey are visible problems (the prompt's own example)
  assert.ok(VISIBLE.test("the creek turning grey") && VISIBLE.test("the water goes brown"));
  // b. a car arriving finishes a street video; a new machine still does not
  const fin = (backdrop, kind) => clarityChecks({ world: { backdrop: { type: backdrop } }, parts: [{ id: "c", kind, params: { pos: [0, 0.12, -2] } }], beats: [{ s: "finish", do: [{ p: "c", v: "arrive" }], shows: { p: "c" } }] }, [{ role: "finish", text: "Add a car." }]).problems.filter((p) => /finishing touch/.test(p));
  assert.deepEqual(fin("street", "car"), []);
  assert.equal(fin("room", "car").length, 1);
  assert.equal(fin("street", "machine").length, 1);
  // d. agencies are said without "US"; "a US home" is "an American home"
  assert.equal(speakable("The US Department of Energy says so."), "The Department of Energy says so.");
  assert.equal(speakable("A US home uses 300 gallons."), "An American home uses 300 gallons.");
  // e. the dig may be on the beat that digs
  const { SCENE_SYSTEM } = await import("../scripts/cutaway/proto3d/m2/planner.mjs");
  assert.match(SCENE_SYSTEM, /in the beat that digs/);
  assert.doesNotMatch(SCENE_SYSTEM, /its cue is "dig" in the hook\./);
  // f. the bookkeeping says what it changed
  const st = fixStory({ chain: [{ problem: "problem", causedBy: "fix1", size: 1 }] }, { beats: [{ s: "hook", do: [{ p: "a", v: "show", w: "dig!" }] }, { s: "problem" }] });
  assert.ok(st.notes.some((n) => /causedBy fix1 -> hook/.test(n)) && st.notes.some((n) => /cue word "dig!" -> "dig"/.test(n)));
  assert.ok(!Object.keys(st).includes("notes"), "the notes do not change the story's shape");
  const d = draftSentences({ beats: [{ s: "hook", do: [{ p: "a", v: "show", w: "pipe" }] }] }, { hook: "you dig a hole" });
  assert.match(d.notes[0], /hook: .*"pipe"/);
  // g. the setting props are scenery, not finishing touches
  assert.match(h, /SETTING PROPS are the setting's scenery, never the "Add \.\.\." finishing touches/);
  // h. the plain lawn takes young trees and is described
  const plain = clarityChecks({ world: { house: false }, parts: [{ id: "t", kind: "youngTrees", params: { trees: [[2, -3, 1]] } }], beats: [] }, []).problems;
  assert.ok(!plain.some((p) => /does not belong/.test(p)), plain.join("\n"));
  assert.match(h, /The plain lawn \(world\.house false and no backdrop/);
  // i. night stays night; a lighthouse is a night video
  assert.match(h, /it stays night until a line turns it\s+back/);
  assert.equal(moodFor({ title: "How a lighthouse works" }), "night");
  // k. a water heater goes in the room only
  assert.doesNotMatch(h, /It suits a car, a garage door, a water heater/);
  // l. deep water is a water box, a creek is shallow
  assert.match(h, /A creek is a SHALLOW strip/);
});

test("1d: the plan reply carries the narration; checked numbers go into it for free", async () => {
  const { applyFactChanges } = await import("../scripts/cutaway/proto3d/m2/planner.mjs");
  const s = [{ role: "fact", text: "A pool holds about 20,000 gallons of water." }, { role: "myth", text: "It takes 8 hours to fill." }, { role: "hook", text: "If you dig a hole, you have a pool." }];
  const r = applyFactChanges(s, [
    { role: "fact", verdict: "reword", planned: "A pool holds 20,000 gallons", claim: "A pool holds 18,000 gallons" },
    { role: "myth", verdict: "reword", planned: "8 hours", claim: "8 to 10 hours" },
    { role: "hook", verdict: "keep", planned: "x", claim: "x" },
  ]);
  assert.equal(r.sentences[0].text, "A pool holds about 18,000 gallons of water.");
  assert.equal(r.sentences[1].text, "It takes 8 hours to fill.", "a number that became a range is left to the words checks");
  assert.ok(r.notes.some((n) => /20000 -> 18,000/.test(n)) && r.notes.some((n) => /myth: the checked claim has other numbers/.test(n)));
  assert.equal(s[0].text, "A pool holds about 20,000 gallons of water.", "the input is not changed");
});

test("1d: the merged prompts: sentences in the plan schema and prompt, one fact call", () => {
  const src = fs.readFileSync(new URL("../scripts/cutaway/proto3d/m2/planner.mjs", import.meta.url), "utf8");
  assert.match(src, /const BEATS_REPLY_SCHEMA = \{[^\n]*required: \["why", "story", "sentences", "sceneJson"\]/);
  assert.match(src, /Reply also with "sentences": THE NARRATION[\s\S]{0,600}\$\{WRITING_RULES\}/);
  assert.match(src, /step\("facts", \{ system: FACTS_ONE_SYSTEM/);
  assert.doesNotMatch(src.slice(src.indexOf("async function planCustom"), src.indexOf("export async function rewordBeats")), /step\("fact research"/);
});

test("a clean small scene has no errors", () => {
  const e = validateScene(scene(
    [{ id: "light", kind: "light", params: { storm: false } }, { id: "t", kind: "tank", main: true, params: { pos: [0, 0, -2], r: 1, h: 2, mat: "tankBlue" } }, { id: "sign", kind: "sign", params: { at: [4, 0, 2], rotY: 0.3, scale: 1.4 } }],
    [{ s: "hook", do: [{ p: "t", v: "show" }], shows: { p: "t" } }],
  ));
  assert.deepEqual(e.filter((x) => !/verb/.test(x.error)), []);
});
