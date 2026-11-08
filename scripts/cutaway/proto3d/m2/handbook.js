// M2: the master handbook the scene planner reads (scene language v2, phase 1c; SCENE_LANGUAGE_V2.md).
// Generated from the registry (language.js) and the typed field lists (fields.js), so the planner is told exactly what
// the kit builds and the validator checks exactly that: each kind with its typed fields (* = needed), how to set them,
// its verbs and a worked example from a saved plan (handbookExamples.json, m3/handbookExamples.mjs); the designed-part
// field lists; the words a beat may use (roles, shot types, views, moods); the camera's size rules with their numbers
// (director.js LOOK: the planner writes them, the director no longer has to fix them quietly).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WORLD_DOC, RIG_DOC } from "./catalog.js";
import { REGISTRY } from "./language.js";
import { RIG_SHAPE_FIELDS, RIG_MOVE_FIELDS, COMMON } from "./fields.js";
import { MATERIAL_NAMES } from "./materials.js";
import { LOOK, SUBJECT_FILL } from "./director.js";

const here = path.dirname(fileURLToPath(import.meta.url));
let EXAMPLES = {};
try { EXAMPLES = JSON.parse(fs.readFileSync(path.join(here, "handbookExamples.json"), "utf8")); } catch { EXAMPLES = {}; }

/** a field spec as the planner reads it: "[x, y, z]", "number", "sedan|suv", "{x0, x1, y0, y1, z0, z1}" */
export function typeText(t) {
  if (t && typeof t === "object") {
    if (t.obj) return `{${Object.entries(t.obj).map(([k, v]) => (typeof v === "string" && ["num"].includes(v) ? k : `${k} ${typeText(v)}`)).join(", ")}}`;
    if (t.each) return `[{${Object.entries(t.each).map(([k, v]) => `${k} ${typeText(v)}`).join(", ")}}, ...]`;
  }
  return String(t).split("|").map((o) => {
    if (o.startsWith("one:")) return o.slice(4).split(",").map((w) => `"${w}"`).join("|");
    return { num: "number", bool: "true|false", str: "text", id: "a part id", color: "\"#rrggbb\"", mat: "material", null: "null", vec2: "[a, b]", vec3: "[x, y, z]", vec4: "[4 numbers]", nums: "[numbers]", strs: "[words]", path: "[[x, y, z], ...] (2+ points)", points: "[[x, z, scale?], ...]", list: "[...]" }[o] ?? o;
  }).join(" or ");
}
const fieldLine = (f, need = []) => Object.entries(f).map(([k, t]) => `${k}${need.includes(k) ? "*" : ""} ${typeText(t)}`).join("; ");

function kindsText() {
  return Object.entries(REGISTRY.kinds).map(([k, d]) => {
    const verbs = k === "panels" ? "grow (ch), pop (ch)" : k === "rig" ? "show, hide, each of its moves by name, <name>Back" : d.verbs.length ? d.verbs.join(", ") : "(none)";
    const ex = EXAMPLES[k] ? `\n    example: ${JSON.stringify(EXAMPLES[k].params)}` : "";
    return `- ${k}: ${d.what}\n    fields: ${k === "rig" ? `${fieldLine(d.typed, d.need)} (nodes: see NEW PARTS)` : fieldLine(d.typed, d.need) || "(none)"}\n    how: ${d.params}${d.notes ? `\n    notes: ${d.notes}` : ""}\n    verbs: ${verbs}${ex}`;
  }).join("\n");
}

function rigFieldsText() {
  return `DESIGNED PART FIELDS (every field a rig piece may have; anything else is refused with its name)
- node: id* text; parent a node id; at [x, y, z] (its pivot, from the parent's pivot); shapes [...]; moves [...]
- every shape: shape*, at [x, y, z], rot [deg x, y, z], look ${typeText("one:metal,plastic,wood,glass,rubber,paint,concrete")}, color "#rrggbb"; and its own:
${Object.entries(RIG_SHAPE_FIELDS).map(([s, f]) => `  ${s}: ${fieldLine(f) || "-"}`).join("\n")}
- every move: name* (its verb), type*; and its own:
${Object.entries(RIG_MOVE_FIELDS).map(([m, f]) => `  ${m}: ${fieldLine(f) || "-"}`).join("\n")}`;
}

// the camera's size rules, with the numbers the director measures (it used to apply them quietly after the plan)
export function cameraRulesText() {
  const pc = (x) => `${Math.round(x * 100)}%`;
  return `CAMERA SIZES (the director measures every shot against these; write shots that already meet them)
- THE HOOK: the hook's first shot frames the hook object at least ${pc(LOOK.hookMin)} of the frame width.
- THE LINE'S PART: in a story shot the part the line is about fills at least ${pc(LOOK.closeMin)} of the width, whole.
- THE BUILD: from the second line on, the build fills at least ${pc(SUBJECT_FILL)} of the frame; the camera never goes
  closer than keeping the main part whole (at most ${pc(LOOK.mainFill)} of the width, never cut at the sides or the top).
- INDOORS (room, kitchen, workshop, carwash, garage): the closing and "Add ..." shots frame the main part with a margin,
  not the whole room; the camera stays below the ceiling.
- A car never fills more than 45% of the width and is never cut by the frame's bottom edge.
- A part that is stopped or hidden in a beat is not in that beat's shot focus.`;
}

function wordsText() {
  return `THE WORDS A BEAT MAY USE (anything else is refused with its name)
- roles (beats[].s): ${REGISTRY.roles.join(", ")}
- shot types: ${REGISTRY.shotTypes.join(", ")}; views: ${REGISTRY.views.join(", ")}
- settings (world.backdrop.type): ${REGISTRY.settings.join(", ")} (or none: the yard; world.house false: the plain lawn)
- moods (world.mood): ${REGISTRY.moods.join(", ")}
- fields every part may also carry: ${Object.keys(COMMON).join(", ")}; a part itself is {id, kind, params, base?, main?}`;
}

/** the whole handbook: the world, the part kinds, the designed parts, the words, the camera sizes, materials, sounds */
export function handbookText() {
  return `${WORLD_DOC}

PART KINDS (fields marked * are needed; every other field is optional and has a default)
${kindsText()}

${RIG_DOC}

${rigFieldsText()}

${wordsText()}

${cameraRulesText()}

MATERIALS (the only names a 'mat' may use)
${MATERIAL_NAMES.join(", ")}

SOUND LIBRARY (sfx 'lib' names)
dirt (digging, pouring), drip (seeping), water_rush (water flowing in a pipe or flooding), flame, motor_hum (a pump or machine running); rain is only the rain bed (audio.rain)`;
}
