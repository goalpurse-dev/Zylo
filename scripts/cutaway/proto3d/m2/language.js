// M2: the scene language's registry (scene language v2, SCENE_LANGUAGE_V2.md; the owner's direction of 2026-11-08).
// ONE place that says what the kit can build: part kinds and their fields, verbs, designed-part shapes and moves, shot
// types and views, roles, light moods. The planner's handbook and the scene validator are both made from it, so the AI
// is never told about something the kit cannot build, and nothing it writes is dropped silently: every problem comes
// back as a named error it can fix.
import { KIND_DOCS } from "./catalog.js";
import { VERBS } from "./verbs.js";
import { RIG_SHAPES, RIG_MOVES } from "./rig.js";
import { ROLES, VIEWS, SHOT_TYPES, SETTINGS } from "./plan.js";
import { MOODS } from "./moods.js";

import { FIELDS, partFieldProblems } from "./fields.js";
import { modelMoves, resolveModel } from "./recipes.js";

// (phase 1b: every kind's typed field list, m2/fields.js; a kind without one would be a gap in the kit's language)
for (const k of Object.keys(KIND_DOCS)) if (!FIELDS[k]) throw new Error(`language.js: kind ${k} has no typed field list in fields.js`);
// the keys a part itself may carry, besides id, kind and params: base (its channels' starting values), main (the
// video's subject), at/of (older plans)
const PART_KEYS = new Set(["id", "kind", "params", "base", "main", "label", "note"]);

export const REGISTRY = Object.freeze({
  kinds: Object.freeze(Object.fromEntries(Object.entries(KIND_DOCS).map(([k, [what, params, notes]]) => [k, Object.freeze({ what, params, notes: notes ?? "", fields: new Set(Object.keys(FIELDS[k].f)), need: FIELDS[k].need ?? [], typed: FIELDS[k].f, verbs: Object.keys(VERBS[k] ?? {}) })]))),
  rig: Object.freeze({ shapes: RIG_SHAPES, moves: RIG_MOVES }),
  roles: ROLES, views: VIEWS, shotTypes: SHOT_TYPES, settings: SETTINGS, moods: Object.keys(MOODS),
});

// the verbs a part answers to: its kind's verbs; a designed part (rig) also every move it names, plus show/hide
const rigNames = (p) => (p.params?.nodes ?? []).flatMap((n) => (n.moves ?? []).map((m) => m.name).filter(Boolean));
export function verbsOf(part) {
  const k = REGISTRY.kinds[part?.kind];
  if (!k) return [];
  // (a designed part: each move by name, and <name>Back plays it backwards; rig.js rigVerb)
  if (part.kind === "rig") return [...new Set(["show", "hide", "pop", ...k.verbs, ...rigNames(part).flatMap((n) => [n, `${n}Back`])])];
  if (part.kind === "panels") return ["grow", "pop", ...k.verbs];
  if (part.kind === "model") return [...new Set(["show", "hide", "pop", ...modelMoves(part.params).flatMap((n) => [n, `${n}Back`])])];
  return k.verbs;
}

// closest names, for a helpful error ("unknown verb 'spinn' for rig drum: did you mean spin?")
const dist = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const near = (x, list) => { const s = [...list].map((y) => [y, dist(String(x).toLowerCase(), String(y).toLowerCase())]).sort((p, q) => p[1] - q[1]); return s.length && s[0][1] <= Math.max(2, Math.floor(String(x).length / 3)) ? ` (did you mean ${s[0][0]}?)` : ""; };

/**
 * Every place where a scene asks for something the kit cannot build: unknown kinds, unknown fields, unknown verbs,
 * shots on parts that do not exist, unknown views and shot types, beats with an unknown role, unknown moods.
 * scene: the planner's layout (world, parts, beats). Returns [{at, error}] (empty: the kit understands all of it).
 */
export function validateScene(scene) {
  const out = [], err = (at, error) => out.push({ at, error }), warns = [], warn = (at, warning) => warns.push({ at, warning });
  const parts = Array.isArray(scene?.parts) ? scene.parts : [], ids = new Set();
  for (const [i, p] of parts.entries()) {
    const at = `parts[${i}]${p?.id ? ` (${p.id})` : ""}`;
    if (!p?.id) err(at, "a part needs an id");
    else if (ids.has(p.id)) err(at, `the id ${p.id} is used twice`);
    else ids.add(p.id);
    const k = REGISTRY.kinds[p?.kind];
    if (!k) { err(at, `unknown kind '${p?.kind}'${near(p?.kind, Object.keys(REGISTRY.kinds))}`); continue; }
    // (fields: typed per kind since phase 1b, m2/fields.js: unknown fields, wrong types and missing required fields)
    for (const f of Object.keys(p)) if (!PART_KEYS.has(f)) err(`${at}.${f}`, `is not a part key (a part is {id, kind, params, base?, main?}: put ${p.kind} settings in params)`);
    for (const e of partFieldProblems(p, at, near)) err(e.at, e.error);
    if (p.kind === "model" && p.params?.keyword && !resolveModel(p.params)) err(`${at}.params.keyword`, `no recipe or CC0 model for "${p.params.keyword}": use another word or design it as a rig`);
    if (p.kind === "rig") for (const n of p.params?.nodes ?? []) {
      for (const s of n.shapes ?? []) if (s?.shape && !RIG_SHAPES.includes(s.shape)) err(`${at} node ${n.id}`, `unknown shape '${s.shape}'${near(s.shape, RIG_SHAPES)}`);
      for (const m of n.moves ?? []) if (m?.type && !RIG_MOVES.includes(m.type)) err(`${at} node ${n.id}`, `unknown move type '${m.type}'${near(m.type, RIG_MOVES)}`);
    }
  }
  const byId = new Map(parts.map((p) => [p?.id, p]));
  for (const [i, b] of (scene?.beats ?? []).entries()) {
    const at = `beats[${i}] (${b?.s ?? "?"})`;
    if (!REGISTRY.roles.includes(b?.s)) err(at, `unknown role '${b?.s}'${near(b?.s, REGISTRY.roles)}`);
    if (b?.shows?.p && !byId.has(b.shows.p)) err(at, `shows a part that does not exist: ${b.shows.p}${near(b.shows.p, ids)}`);
    for (const a of b?.do ?? []) {
      const p = byId.get(a?.p);
      if (!p) { err(at, `acts on a part that does not exist: ${a?.p}${near(a?.p, ids)}`); continue; }
      const vs = verbsOf(p);
      if (vs.length && !vs.includes(a.v)) err(at, `${p.kind} ${p.id} has no verb '${a.v}'${near(a.v, vs)} (its verbs: ${vs.join(", ")})`);
    }
    for (const s of [b?.shot, ...(b?.shots ?? [])].filter(Boolean)) {
      for (const id of [].concat(s.focus ?? [])) { const base = String(id).split(".")[0]; if (id !== "home" && !byId.has(base)) err(at, `a shot frames a part that does not exist: ${id}${near(base, ids)}`); }
      if (s.view && typeof s.view === "string" && !REGISTRY.views.includes(s.view)) err(at, `unknown view '${s.view}'${near(s.view, REGISTRY.views)}`);
      if (s.type && !REGISTRY.shotTypes.includes(s.type)) err(at, `unknown shot type '${s.type}'${near(s.type, REGISTRY.shotTypes)}`);
    }
  }
  const mood = scene?.world?.mood;
  if (mood && !REGISTRY.moods.includes(mood)) err("world.mood", `unknown mood '${mood}'${near(mood, REGISTRY.moods)}`);
  const bd = scene?.world?.backdrop?.type;
  if (bd && !REGISTRY.settings.includes(bd)) err("world.backdrop", `unknown setting '${bd}'${near(bd, REGISTRY.settings)}`);
  validateScene.lastWarnings = warns;
  return out;
}
