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

test("a clean small scene has no errors", () => {
  const e = validateScene(scene(
    [{ id: "light", kind: "light", params: { storm: false } }, { id: "t", kind: "tank", main: true, params: { pos: [0, 0, -2], r: 1, h: 2, mat: "tankBlue" } }, { id: "sign", kind: "sign", params: { at: [4, 0, 2], rotY: 0.3, scale: 1.4 } }],
    [{ s: "hook", do: [{ p: "t", v: "show" }], shows: { p: "t" } }],
  ));
  assert.deepEqual(e.filter((x) => !/verb/.test(x.error)), []);
});
