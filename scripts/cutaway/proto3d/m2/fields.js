// M2: the typed field list of every part kind (scene language v2, phase 1b; SCENE_LANGUAGE_V2.md).
// Written from each kind's builder (m3/fieldScan.mjs reads what the code really reads) and checked against the 62 saved
// plans. The validator (language.js validateScene) refuses a field that is not here, a value of the wrong type and a
// missing required field, each with a named error the planner can fix; the handbook (phase 1c) prints these lists.
//
// A field spec is a type name, "a|b" for either, "one:a,b,c" for one of those words, {obj: {...fields}} for an object
// with known fields, {each: {...fields}} for a list of such objects. `need` lists the fields the builder reads with no
// default (the part cannot be built without them).
import { MATERIAL_NAMES } from "./materials.js";
import { RIG_SHAPES, RIG_MOVES } from "./rig.js";

const BOX = { obj: { x0: "num", x1: "num", y0: "num", y1: "num", z0: "num", z1: "num" } };
const AREA = { obj: { x0: "num", x1: "num", z0: "num", z1: "num" } };

// fields every part may carry: the layout's own bookkeeping, read by layoutRules, compile, framing and the page
export const COMMON = Object.freeze({ main: "bool", label: "str", note: "str" });

export const FIELDS = Object.freeze({
  settle: { f: { box: BOX, wallColor: "color", lid: "bool", murky: "bool", clearColor: "color", oilColor: "color", sandColor: "color", grains: "num" }, need: ["box"] },
  creek: { f: { x0: "num", x1: "num", width: "num", depth: "num", y: "num", dir: "num", axis: "one:x,z", x: "num", z0: "num", z: "num", color: "color", dirtyColor: "color" } },
  flow: { f: { path: "path", look: "one:water,spray,sludge,soap,oil,mud", size: "num", speed: "num", count: "num" }, need: ["path"] },
  prop: { f: { type: "str", pos: "vec3", rotY: "num", scale: "num", size: "nums", h: "num", w: "num", open: "strs", drop: "num", text: "str" }, need: ["type", "pos"] },
  grate: { f: { pos: "vec3", width: "num", depth: "num" }, need: ["pos"] },
  canopy: { f: { x0: "num", x1: "num", z0: "num", z1: "num", y: "num", h: "num", color: "color", postColor: "color" }, need: ["x0", "x1", "z0", "z1"] },
  car: { f: { pos: "vec3", from: "num", to: "num", color: "color", model: "one:sedan,suv,taxi,police,ambulance,firetruck", scale: "num", axis: "one:x,z", mud: "bool" } },
  traffic: { f: { lane: "vec2", dir: "num", n: "num", gap: "num", colors: "strs", y: "num" }, need: ["lane"] },
  cabinet: { f: { pos: "vec3", size: "vec3" } },
  counter: { f: { pos: "vec3", size: "num", from: "num", to: "num", color: "color", bar: "bool", danger: "num" }, need: ["pos"] },
  carWash: { f: { pos: "vec3", width: "num", height: "num", car: "id" }, need: ["pos"] },
  trafficLight: { f: { pos: "vec3", height: "num", arm: "num", armDir: "num", loop: "vec4", phase: "num" }, need: ["pos"] },
  hydrant: { f: { pos: "vec3", depth: "num", color: "color" } },
  atm: { f: { pos: "vec3", color: "color" } },
  vendingMachine: { f: { pos: "vec3", color: "color", header: "str", rotY: "num" } },
  miniMachines: { f: { area: AREA, count: "num", avoid: "list", y: "num" }, need: ["area"] },
  dig: { f: { mound: { obj: { x: "num", z: "num", rx: "num", rz: "num", h: "num", clumpScale: "num", flat: "num", base: "num", gain: "num", sx: "num", sy: "num", sz: "num" } }, clumps: "num", dark: "bool", haul: "bool", margin: "num", endY: "num", arc: "num", uvFlip: "bool", mat: "mat", cut: { obj: { x0: "num", x1: "num", z0: "num", depth: "num" } } }, need: ["mound"] },
  panels: { f: { panels: { each: { ch: "str", mat: "mat", size: "vec3", anchor: "vec3", pos: "vec3", axis: "one:x,y,z|null", vis: "num", r: "num", uv: "vec2" } }, mat: "mat" }, need: ["panels"] },
  box: { f: { mat: "mat", size: "vec3", pos: "vec3", r: "num", receiveShadow: "bool" }, need: ["mat", "size", "pos"] },
  bags: { f: { area: AREA, h: "num", grid: "vec2", n0: "num", y0: "num", stagger: "num", dur: "num", liftStagger: { obj: { up: "num", down: "num" } }, fromAbove: { obj: { xScale: "num", y: "num" } }, fromTruck: { obj: { part: "id", x: "num", y: "num", dz: "num" } } }, need: ["area", "y0"] },
  dumpTruck: { f: { x: "num" } },
  pipeRun: { f: { path: "path", r: "num", radial: "num", jointR: "num", joints: "bool", mat: "mat" }, need: ["path", "r"] },
  pipeRunFlow: { f: { pipe: "id", count: "num", size: "num", speed: "num", dz: "num", mat: "mat" }, need: ["pipe"] },
  tank: { f: { pos: "vec3", r: "num", h: "num", bands: "nums", mat: "mat" }, need: ["pos"] },
  riser: { f: { x: "num", z: "num", y0: "num", y1: "num", r: "num", radial: "num", mat: "mat" }, need: ["x", "z", "y0", "y1"] },
  boxPop: { f: { size: "vec3", pos: "vec3", r: "num", mat: "mat" }, need: ["size", "pos"] },
  flare: { f: { pos: "vec3", intensity: "num" }, need: ["pos"] },
  bubbles: { f: { x0: "num", x1: "num", y0: "num", y1: "num", z: "num", count: "num", speed: "num" }, need: ["x0", "x1", "y0", "y1"] },
  machine: { f: { pos: "vec3", rotY: "num" }, need: ["pos"] },
  fence: { f: { x0: "num", x1: "num", step: "num", zBack: "num", sideStart: "num", zFront: "num", railZ: "num", railLen: "num", stagger: "num" }, need: ["x0", "x1", "step", "zBack", "sideStart", "zFront"] },
  youngTrees: { f: { trees: "points", stagger: "num" }, need: ["trees"] },
  sheet: { f: { masthead: "str", date: "str", headline: "str", from: "vec3", to: "vec3", sink: "num|bool" }, need: ["from", "to"] },
  book: { f: { w: "num", h: "num", bg: "color", book: "bool", spine: "color", lines: { each: { text: "str", font: "str", color: "color", y: "num", rule: "bool" } }, from: "vec3", to: "vec3", rot: "vec3" }, need: ["from", "to"] },
  flag: { f: { at: "vec3", colors: "strs", w: "num", h: "num", pole: "num" }, need: ["at"] },
  shrubs: { f: { list: "points", stagger: "num" }, need: ["list"] },
  sign: { f: { at: "vec3", rotY: "num", scale: "num", postsReceiveShadow: "bool" }, need: ["at"] },
  crack: { f: { points: "path", r: "num" }, need: ["points"] },
  drops: { f: { x0: "num", x1: "num", count: "num", fromY: "num", landY: "num", z: "num", mat: "mat", size: "num" }, need: ["x0", "x1", "landY"] },
  water: { f: { box: BOX, gravel: "id", mat: "mat", dirtyColor: "color", r: "num" }, need: ["box"] },
  gravel: { f: { box: BOX, faceBox: BOX, pourBox: AREA, pourFrom: "num", pourCount: "num", water: "id", waterTop: "num", waterSpan: "num", drainDrop: "num", mat: "mat", pebbleMat: "mat" }, need: ["box", "faceBox", "pourBox"] },
  soakPit: { f: { box: BOX, faceBox: BOX, mat: "mat", pebbleMat: "mat" }, need: ["box", "faceBox"] },
  wipe: { f: { box: BOX, mat: "mat", axis: "one:x,y,z", r: "num", uvScale: "num" }, need: ["box", "mat"] },
  wrap: { f: { box: BOX, opts: { obj: { thick: "num", sides: "strs", along: "one:x,z", stagger: "num", dur: "num" } }, mat: "mat" }, need: ["box"] },
  pipe: { f: { path: "path", opts: { obj: { r: "num", color: "color", perforated: "bool", holeSpacing: "num", joints: "bool" } } }, need: ["path"] },
  pipeFlow: { f: { pipe: "id", opts: { obj: { count: "num", size: "num", color: "color", offset: "vec3", from: "num" } }, speed: "num" }, need: ["pipe"] },
  puddles: { f: { list: "points", rise: "vec2", fall: "vec2", mat: "mat" }, need: ["list"] },
  rain: { f: { x0: "num", x1: "num", z0: "num", z1: "num", yTop: "num", yBot: "num", count: "num", speed: "num", slant: "num", len: "num", width: "num", color: "color", opacity: "num", style: "one:rain,ash" }, need: ["x0", "x1", "z0", "z1"] },
  stream: { f: { x0: "num", x1: "num", z: "num", yTop: "num", yBot: "num", count: "num", speed: "num", color: "color", opacity: "num" }, need: ["x0", "x1", "z", "yTop", "yBot"] },
  light: { f: { storm: "bool", night: "bool" } },
  lawnWet: { f: {} },
  soilLeak: { f: { x1: "num", x2: "num", murkX: "num" } },
  wetBand: { f: { cx: "num", halfW: "num", bottom: "num" }, need: ["cx", "halfW", "bottom"] },
  soak: { f: { x0: "num", x1: "num", top: "num" }, need: ["x0", "x1", "top"] },
  arrows: { f: { list: { each: { at: "vec3", dir: "vec2|vec3", travel: "num", phase: "num" } }, opts: { obj: { color: "color", scale: "num", speed: "num", flat: "bool" } } }, need: ["list"] },
  outline: { f: { of: "str", points: "path", opts: { obj: { color: "color", r: "num", closed: "bool", over: "bool" } } } },
  seepFlow: { f: { count: "num", width: "num", y0: "num", fall: "num", floor: "num" } },
  fx: { f: { type: "one:blast,crash,crack,collapse,fire,smoke,drip,splash,spark,frost,swirl,motes", at: "vec3", size: "num" }, need: ["type", "at"] },
  waterBody: { f: { body: "one:sea,river,lake,pool", x0: "num", x1: "num", level: "num", z0: "num", depth: "num", waves: "bool", color: "color", murky: "bool", rise: "num", flood: "num" }, need: ["x0", "x1", "level"] },
  // (one field list for every block type: each type reads its own, kit/terrain.js terrainModel)
  terrain: { f: { blocks: { each: { type: "one:flat,hill,mountain,cliff,gorge,coast,riverbed,pit,tunnel", x0: "num", x1: "num", y: "num", z: "num", z0: "num", at: "num", height: "num", width: "num", top: "num", bottom: "num", high: "one:left,right", face: "one:rock,earth", depth: "num", wall: "num", walls: "one:rock,earth", sea: "one:left,right", beach: "num", r: "num", lining: "bool", crater: { obj: { r: "num", depth: "num" } }, chamber: { obj: { y: "num", rx: "num", ry: "num", dx: "num", color: "color", vent: "bool" } } } }, trees: "points" }, need: ["blocks"] },
  rig: { f: { name: "str", synonyms: "strs", pos: "vec3", rotY: "num", scale: "num", mount: "one:wall", nodes: "list" }, need: ["name", "pos", "nodes"] },
});

// a designed part's pieces (rig.js): node fields, each shape's fields, each move type's fields
export const RIG_NODE = Object.freeze({ id: "str", parent: "str", at: "vec3", shapes: "list", moves: "list" });
const SHAPE_COMMON = { shape: "str", at: "vec3", rot: "vec3", look: "one:metal,plastic,wood,glass,rubber,paint,concrete", color: "color", radius: "num" };
export const RIG_SHAPE_FIELDS = Object.freeze({
  box: { size: "vec3" }, panel: { size: "vec2", thick: "num" }, cylinder: { r: "num", h: "num", axis: "one:x,y,z" },
  wheel: { r: "num", w: "num", axis: "one:x,y,z" }, gear: { r: "num", w: "num", teeth: "num", axis: "one:x,y,z" }, hinge: { r: "num", h: "num", axis: "one:x,y,z" },
  spring: { r: "num", h: "num", turns: "num", wire: "num", axis: "one:x,y,z" },
  tube: { path: "path", r: "num" }, cable: { path: "path", r: "num" }, rail: { path: "path", w: "num", r: "num" }, track: { path: "path", w: "num", r: "num" },
  chain: { path: "path", w: "num", r: "num" }, belt: { path: "path", w: "num", r: "num" },
  button: { r: "num" }, light: { r: "num" }, beam: { from: "vec3", to: "vec3", r: "num" }, screen: { size: "vec2" },
  model: { file: "str", size: "num", rotY: "num" }, drum: { r: "num", h: "num", axis: "one:x,y,z", holes: "bool|num" },
  cone: { r: "num", r2: "num", h: "num", axis: "one:x,y,z" }, sphere: { r: "num" }, torus: { r: "num", tube: "num", axis: "one:x,y,z" },
  fan: { r: "num", blades: "num", w: "num", axis: "one:x,y,z" }, element: { r: "num", turns: "num", wire: "num", axis: "one:x,y,z" },
  flame: { r: "num", h: "num", cap: "bool" }, bellows: { r: "num", h: "num", folds: "num", axis: "one:x,y,z" },
});
const MOVE_COMMON = { name: "str", type: "str" };
export const RIG_MOVE_FIELDS = Object.freeze({
  appear: {}, slide: { to: "vec3" }, swing: { axis: "one:x,y,z", angle: "num" }, track: { path: "path" }, spin: { axis: "one:x,y,z", turns: "num" },
  extend: { axis: "one:x,y,z", k: "num" }, light: {}, blink: { rate: "num" }, fill: { box: { obj: { size: "vec3", at: "vec3", color: "color" } } },
  flow: { path: "path", color: "color", speed: "num" }, count: { from: "num", to: "num" }, snap: { axis: "one:x,y,z", gap: "num" }, heat: { color: "color" }, chill: { color: "color" },
  burn: {}, pump: { axis: "one:x,y,z", stroke: "num", rate: "num" }, shake: { amp: "num", rate: "num" }, follow: { of: "str", ratio: "num", axis: "one:x,y,z" }, crank: { of: "str", axis: "one:x,y,z", throw: "num", phase: "num" },
});
// (both lists cover every shape and move rig.js builds)
for (const s of RIG_SHAPES) if (!RIG_SHAPE_FIELDS[s]) throw new Error(`fields.js: rig shape ${s} has no field list`);
for (const m of RIG_MOVES) if (!RIG_MOVE_FIELDS[m]) throw new Error(`fields.js: rig move ${m} has no field list`);

// ---------- the type checks: a reason string when v is not of type t, else null ----------
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const vecN = (n) => (v) => (Array.isArray(v) && v.length === n && v.every(isNum) ? null : `a list of ${n} numbers`);
const BASIC = {
  num: (v) => (isNum(v) ? null : "a number"),
  bool: (v) => (typeof v === "boolean" ? null : "true or false"),
  str: (v) => (typeof v === "string" && v.length ? null : "a word or text"),
  id: (v) => (typeof v === "string" && v.length ? null : "a part id"),
  color: (v) => (typeof v === "string" && /^(#[0-9a-f]{3}|#[0-9a-f]{6}|[a-z]+)$/i.test(v) ? null : "a colour like \"#3d6fb0\""),
  mat: (v) => (MATERIAL_NAMES.includes(v) ? null : `a material name (${MATERIAL_NAMES.join(", ")})`),
  null: (v) => (v === null ? null : "null"),
  vec2: vecN(2), vec3: vecN(3), vec4: vecN(4),
  nums: (v) => (Array.isArray(v) && v.length && v.every(isNum) ? null : "a list of numbers"),
  strs: (v) => (Array.isArray(v) && v.every((x) => typeof x === "string") ? null : "a list of words"),
  path: (v) => (Array.isArray(v) && v.length >= 2 && v.every((q) => !vecN(3)(q)) ? null : "a list of 2 or more points [x, y, z]"),
  points: (v) => (Array.isArray(v) && v.length >= 1 && v.every((q) => Array.isArray(q) && q.length >= 2 && q.every(isNum)) ? null : "a list of number lists ([x, z, scale] each)"),
  list: (v) => (Array.isArray(v) ? null : "a list"),
};

/**
 * The problems of value v against spec t, at path `at`: [{at, error}]. Unknown fields of a known object are errors too.
 * near(x, list) gives the " (did you mean y?)" hint.
 */
export function checkValue(v, t, at, near = () => "") {
  if (t && typeof t === "object") {
    if (t.obj) {
      if (!v || typeof v !== "object" || Array.isArray(v)) return [{ at, error: `should be an object {${Object.keys(t.obj).join(", ")}}` }];
      return checkFields(v, t.obj, at, near);
    }
    if (t.each) {
      if (!Array.isArray(v)) return [{ at, error: `should be a list of {${Object.keys(t.each).join(", ")}}` }];
      return v.flatMap((x, i) => checkValue(x, { obj: t.each }, `${at}[${i}]`, near));
    }
  }
  const opts = String(t).split("|"), why = [];
  for (const o of opts) {
    if (o.startsWith("one:")) { const words = o.slice(4).split(","); if (words.includes(v)) return []; why.push(`one of ${words.join(", ")}`); continue; }
    const r = BASIC[o] ? BASIC[o](v) : `(unknown type ${o})`;
    if (r === null) return [];
    why.push(r);
  }
  return [{ at, error: `is ${JSON.stringify(v)?.slice(0, 40)}: should be ${why.join(" or ")}${typeof v === "string" ? near(v, opts.flatMap((o) => (o.startsWith("one:") ? o.slice(4).split(",") : o === "mat" ? MATERIAL_NAMES : []))) : ""}` }];
}

/** every field of obj against the field list f: unknown fields and wrong types */
export function checkFields(obj, f, at, near = () => "") {
  const out = [];
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (v === undefined) continue;
    if (!(k in f)) { out.push({ at: `${at}.${k}`, error: `is not a field here (fields: ${Object.keys(f).join(", ") || "none"})${near(k, Object.keys(f))}` }); continue; }
    out.push(...checkValue(v, f[k], `${at}.${k}`, near));
  }
  return out;
}

/** a part's field problems: [{at, error}] (unknown kind: none here, the validator reports it) */
export function partFieldProblems(part, at, near = () => "") {
  const spec = FIELDS[part?.kind];
  if (!spec) return [];
  const params = part.params ?? {}, out = [];
  out.push(...checkFields(params, { ...spec.f, ...COMMON }, `${at}.params`, near));
  for (const k of spec.need ?? []) if (params[k] === undefined) out.push({ at: `${at}.params.${k}`, error: `is missing: a ${part.kind} needs ${k}` });
  if (part.kind === "rig") for (const [i, n] of (Array.isArray(params.nodes) ? params.nodes : []).entries()) {
    const nat = `${at}.params.nodes[${i}]${n?.id ? ` (${n.id})` : ""}`;
    out.push(...checkFields(n, RIG_NODE, nat, near));
    for (const [j, s] of (Array.isArray(n?.shapes) ? n.shapes : []).entries()) {
      const sf = RIG_SHAPE_FIELDS[s?.shape];
      if (sf) out.push(...checkFields(s, { ...SHAPE_COMMON, ...sf }, `${nat}.shapes[${j}] (${s.shape})`, near));
    }
    for (const [j, m] of (Array.isArray(n?.moves) ? n.moves : []).entries()) {
      const mf = RIG_MOVE_FIELDS[m?.type];
      if (mf) out.push(...checkFields(m, { ...MOVE_COMMON, ...mf }, `${nat}.moves[${j}] (${m.name ?? m.type})`, near));
    }
  }
  return out;
}
