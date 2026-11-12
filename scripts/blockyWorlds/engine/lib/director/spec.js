// Blocky Worlds director: the PRODUCTION LIST, its json_schema (the AI answers in it) and its validation (pure; never
// throws). CONTRACT.md addendum "the story director" documents every field for the planner.
//
//   validateProduction(raw, { lineCount, lines }) -> { production, problems }
//     a clean copy: unknown enums -> defaults, ids unique and referenced ids existing, one entry for every script line
//     (missing lines get the main world, the narrator, no needs). problems are fed back to the AI on its one retry.
import { WORLD_KINDS, BASE_SETS, CREATURE_RELATIONS, ROLES, CHAR_KINDS, SCALES, BEHAVIOURS, CROWD_ACTIONS, VEHICLE_MOTIONS, PROP_SIZES, EFFECT_KINDS, EVENT_KINDS, CAMERA_BEATS, LIGHTS, POSES_N, ACTION_WORDS } from "./vocab.js";
import { cleanName } from "../names.js";

/** the line actions: the people kit's poses + the verbs the registry knows (character.action) */
export const ACTIONS = Object.freeze([...new Set([...POSES_N, ...Object.keys(ACTION_WORDS)])]);

export const PRODUCTION_VERSION = 1;
const S = { type: "string" }, N = { type: "number" }, B = { type: "boolean" };
const E = (list) => ({ type: "string", enum: [...list] });
const A = (items) => ({ type: "array", items });
const O = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });

/** The json_schema of the production list (structured outputs: every field required, no maxItems). */
export function productionSchema() {
  return O({
    summary: S,
    // the WORLD BIBLE's hints (lib/worldBible.js builds the full bible from them; enum-free on purpose, small)
    // rule_visual (BEAT-SHEET 2026-11-10, owner: "THE STORY IS IN THE PICTURE"): the one visible parameter that shows the
    // world's rule (house height, a cloud over each head), each named character's value and the hero's
    bible: O({ creature_look: S, town_name: S, building_style: S, palette: A(S), streets: A(S), places: A(O({ name: S, kind: S })), landmarks: A(S),
      rule_visual: O({ parameter: S, description: S, values: A(O({ who: S, shows: S })), hero: S }) }),
    worlds: A(O({ id: S, name: S, kind: E(WORLD_KINDS), base: E(BASE_SETS), description: S, creature: O({ species: S, relation: E(CREATURE_RELATIONS), heightM: N }), light: E(LIGHTS) })),
    // species: the animal of a kind "animal" cast member (a named pet / animal character at real size: "dog", "cat"); "" for people
    cast: A(O({ id: S, name: S, kind: E(CHAR_KINDS), role: E(ROLES), look: S, job: S, species: S })),
    creatures: A(O({ id: S, name: S, species: S, look: S, scale: E(SCALES), heightM: N, count: N, behaviours: A(E(BEHAVIOURS)), monster: B })),
    crowds: A(O({ id: S, name: S, member: E(["person", "creature", "robot", "vehicle"]), of: S, count: N, actions: A(E(CROWD_ACTIONS)) })),
    vehicles: A(O({ id: S, name: S, kind: S, motion: E(VEHICLE_MOTIONS) })),
    props: A(O({ id: S, name: S, size: E(PROP_SIZES), heldBy: S, storyProp: B })),
    effects: A(O({ id: S, kind: E(EFFECT_KINDS), target: S, into: S })),
    events: A(O({ id: S, kind: E(EVENT_KINDS), what: S, scope: E(["shot", "world"]) })),
    scaleMoments: A(O({ line: N, big: S, small: S })),
    // ruleVisual: what the rule visual shows on this line ("Mr. Pell's house ten floors up"; "" on lines without it)
    lines: A(O({ line: N, world: S, subject: S, who: A(S), action: S, needs: A(S), camera: E(CAMERA_BEATS), light: E(LIGHTS), ruleVisual: S })),
  });
}

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const str = (v, n = 80) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const oneOf = (v, list, d) => (list.includes(String(v ?? "").toLowerCase()) ? String(v).toLowerCase() : d);
const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const slug = (s) => str(s, 40).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "x";

export const ITEM_LISTS = Object.freeze(["worlds", "cast", "creatures", "crowds", "vehicles", "props", "effects", "events"]);
export const KIND_OF_LIST = Object.freeze({ worlds: "world", cast: "cast", creatures: "creature", crowds: "crowd", vehicles: "vehicle", props: "prop", effects: "effect", events: "event" });

export function validateProduction(raw, { lineCount = null, lines = null } = {}) {
  const problems = [];
  const r = isObj(raw) ? raw : {};
  if (!isObj(raw)) problems.push("the production list is not an object");
  const ids = new Set();
  const uid = (want, prefix) => { let id = slug(want || prefix); if (!want) problems.push(`a ${prefix} without an id`); let k = 2; const base = id; while (ids.has(id)) id = `${base}_${k++}`; ids.add(id); return id; };
  const arr = (k) => (Array.isArray(r[k]) ? r[k].filter(isObj) : []);
  const strs = (v, list) => [...new Set((Array.isArray(v) ? v : []).map((x) => String(x).toLowerCase()).filter((x) => list.includes(x)))];

  const worlds = arr("worlds").map((w) => {
    const c = isObj(w.creature) ? w.creature : {};
    const kind = oneOf(w.kind, WORLD_KINDS, "outdoor");
    return { id: uid(w.id, "world"), name: str(w.name, 60) || "the town", kind, base: oneOf(w.base, BASE_SETS, kind === "indoor" ? "bedroom" : "street"), description: str(w.description, 200),
      creature: { species: str(c.species, 40).toLowerCase(), relation: oneOf(c.relation, CREATURE_RELATIONS, kind === "creature" ? "on" : "none"), heightM: num(c.heightM, 0, 0, 200) }, light: oneOf(w.light, LIGHTS, "day") };
  });
  if (!worlds.length) { problems.push("no world"); worlds.push({ id: uid("town", "world"), name: "the town", kind: "outdoor", base: "street", description: "", creature: { species: "", relation: "none", heightM: 0 }, light: "day" }); }
  const cast = arr("cast").map((c) => ({ id: uid(c.id, "cast"), name: cleanName(str(c.name, 40)), kind: oneOf(c.kind, CHAR_KINDS, "human"), role: oneOf(c.role, ROLES, "adult"), look: str(c.look, 120), job: str(c.job, 40), species: str(c.species, 40).toLowerCase() }));
  if (!cast.some((c) => c.role === "narrator")) {
    const me = cast.find((c) => c.id === "me");
    if (me) me.role = "narrator"; else cast.unshift({ id: ids.has("me") ? uid("narrator", "cast") : (ids.add("me"), "me"), name: "", kind: "human", role: "narrator", look: "", job: "", species: "" });
  }
  const creatures = arr("creatures").map((c) => ({ id: uid(c.id, "creature"), name: str(c.name, 60), species: str(c.species, 40).toLowerCase() || str(c.name, 40).toLowerCase(), look: str(c.look, 120), scale: oneOf(c.scale, SCALES, "human"),
    heightM: num(c.heightM, 0, 0, 200), count: Math.round(num(c.count, 1, 1, 2000)), behaviours: strs(c.behaviours, BEHAVIOURS), monster: c.monster === true }));
  const crowds = arr("crowds").map((c) => ({ id: uid(c.id, "crowd"), name: str(c.name, 60), member: oneOf(c.member, ["person", "creature", "robot", "vehicle"], "person"), of: slug(c.of ?? ""), count: Math.round(num(c.count, 20, 2, 2000)), actions: strs(c.actions, CROWD_ACTIONS) }));
  const vehicles = arr("vehicles").map((v) => ({ id: uid(v.id, "vehicle"), name: str(v.name, 40), kind: str(v.kind, 30).toLowerCase() || str(v.name, 30).toLowerCase(), motion: oneOf(v.motion, VEHICLE_MOTIONS, "parked") }));
  const props = arr("props").map((p) => ({ id: uid(p.id, "prop"), name: str(p.name, 50), size: oneOf(p.size, PROP_SIZES, "object"), heldBy: slug(p.heldBy ?? "") === "x" ? "" : slug(p.heldBy), storyProp: p.storyProp === true }));
  const effects = arr("effects").map((f) => ({ id: uid(f.id, "effect"), kind: oneOf(f.kind, EFFECT_KINDS, "glow"), target: str(f.target, 50), into: str(f.into, 50) }));
  const events = arr("events").map((e) => ({ id: uid(e.id, "event"), kind: oneOf(e.kind, EVENT_KINDS, "storm"), what: str(e.what, 80), scope: oneOf(e.scope, ["shot", "world"], "shot") }));
  for (const c of crowds) if (c.of === "x") c.of = "";
  const all = new Map([...worlds, ...cast, ...creatures, ...crowds, ...vehicles, ...props, ...effects, ...events].map((x) => [x.id, x]));
  for (const c of crowds) if (c.of && !all.has(c.of)) { problems.push(`crowd ${c.id}: of "${c.of}" is not an item`); c.of = ""; }
  for (const p of props) if (p.heldBy && !cast.some((c) => c.id === p.heldBy)) p.heldBy = "";

  const n = Number.isInteger(lineCount) ? lineCount : (Array.isArray(lines) ? lines.length : arr("lines").length);
  const byLine = new Map();
  for (const l of arr("lines")) {
    const i = Math.round(num(l.line, -1, -1, 10000));
    if (i < 0 || i >= n) { problems.push(`line ${l.line} is out of range (0-${n - 1})`); continue; }
    if (byLine.has(i)) continue;
    const keep = (id) => all.has(slug(id));
    const needs = [...new Set((Array.isArray(l.needs) ? l.needs : []).map(slug).filter((id) => { if (all.has(id)) return true; problems.push(`line ${i}: need "${id}" is not an item`); return false; }))];
    const who = [...new Set((Array.isArray(l.who) ? l.who : []).map(slug).filter(keep))];
    const world = all.get(slug(l.world))?.id && worlds.some((w) => w.id === slug(l.world)) ? slug(l.world) : worlds[0].id;
    const subject = keep(l.subject) ? slug(l.subject) : (who[0] ?? needs[0] ?? "");
    const rv = str(l.ruleVisual, 160);
    byLine.set(i, { line: i, world, subject, who, action: oneOf(l.action, ACTIONS, str(l.action, 20).toLowerCase().replace(/[^a-z_]/g, "") || "stand"),
      needs, camera: oneOf(l.camera, CAMERA_BEATS, "normal"), light: oneOf(l.light, LIGHTS, worlds.find((w) => w.id === world)?.light ?? "day"), ...(rv ? { ruleVisual: rv } : {}) });
  }
  const outLines = [];
  for (let i = 0; i < n; i++) {
    if (!byLine.has(i)) { problems.push(`line ${i} has no entry`); outLines.push({ line: i, world: worlds[0].id, subject: "me", who: ["me"].filter((x) => all.has(x)), action: "stand", needs: [], camera: "normal", light: worlds[0].light }); }
    else outLines.push(byLine.get(i));
  }
  const scaleMoments = arr("scaleMoments").map((m) => ({ line: Math.round(num(m.line, 0, 0, Math.max(0, n - 1))), big: slug(m.big), small: slug(m.small) })).filter((m) => all.has(m.big));
  // an item no line needs is still kept (the planner may use it for the establishing shot), but reported
  const used = new Set(outLines.flatMap((l) => [l.world, l.subject, ...l.who, ...l.needs]));
  for (const [id, x] of all) if (!used.has(id) && !worlds.includes(x) && x.role !== "narrator") problems.push(`item ${id} is on no line`);
  // the world bible's hints: optional (an old stored list has none), never a retry reason
  const b = isObj(r.bible) ? r.bible : {};
  const sl = (v, n, len = 40) => (Array.isArray(v) ? v : []).map((x) => str(x, len)).filter(Boolean).slice(0, n);
  const bible = { creature_look: str(b.creature_look, 120), town_name: str(b.town_name, 40), building_style: str(b.building_style, 120), palette: sl(b.palette, 8, 20), streets: sl(b.streets, 4),
    places: (Array.isArray(b.places) ? b.places : []).filter(isObj).map((p) => ({ name: str(p.name, 40), kind: str(p.kind, 20).toLowerCase() })).filter((p) => p.name).slice(0, 10), landmarks: sl(b.landmarks, 6) };
  // the rule visual (optional; only when the director gave a parameter)
  const rvb = isObj(b.rule_visual) ? b.rule_visual : {};
  if (str(rvb.parameter, 80)) bible.rule_visual = { parameter: str(rvb.parameter, 80), description: str(rvb.description, 240), values: (Array.isArray(rvb.values) ? rvb.values : []).filter(isObj).map((v) => ({ who: str(v.who, 40), shows: str(v.shows, 160) })).filter((v) => v.who).slice(0, 8), hero: str(rvb.hero, 160) };
  return {
    production: { version: PRODUCTION_VERSION, summary: str(r.summary, 300), bible, worlds, cast, creatures, crowds, vehicles, props, effects, events, scaleMoments, lines: outLines },
    problems,
  };
}

/** every item of a production list with its list kind: [{ id, kind, item }] */
export function itemsOf(p) {
  return ITEM_LISTS.flatMap((k) => (p[k] ?? []).map((item) => ({ id: item.id, kind: KIND_OF_LIST[k], item })));
}
/** which lines need an item (by id): Map id -> [line] */
export function linesByItem(p) {
  const m = new Map();
  for (const l of p.lines) for (const id of new Set([l.world, l.subject, ...l.who, ...l.needs].filter(Boolean))) { if (!m.has(id)) m.set(id, []); m.get(id).push(l.line); }
  return m;
}
