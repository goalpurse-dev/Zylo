// Blocky Worlds builder: the two specs the AI designer writes, and their validation (pure, Node + browser).
//   BLUEPRINT  an object made of coloured blocks/shapes in the locked look (page/kit/blueprint.js builds it)
//   WORLD SPEC a place made of procedural parts (page/sets/worldspec.js builds it)
// Safe by design: hard limits, sizes clamped, colours validated, unknown fields ignored. validateBlueprint /
// validateWorld never throw: they return a clean copy (only what is valid) and the list of problems (fed back to the
// designer on a retry). CONTRACT.md addendum "Built on demand" documents both.

export const LIMITS = Object.freeze({
  parts: 120, labels: 12, anims: 24, aliases: 12, nameLen: 60, textLen: 24,
  size: [0.02, 30], pos: 40, objectHeight: [0.1, 40], giantHeight: 200, worldProps: 16, palette: 6, practicals: 6,
  giants: 6, crowds: 6, crowdCount: 2000,
});
export const SHAPES = Object.freeze(["box", "roundedBox", "cylinder", "cone", "sphere", "wedge", "torus"]);
export const MATERIALS = Object.freeze(["matte", "plastic", "metal", "glass", "glow", "fabric", "wood", "stone"]);
export const PATTERNS = Object.freeze(["none", "stripes", "dots", "plaid"]);
export const ANIMS = Object.freeze(["bob", "spin", "swing", "blink", "wobble", "open"]);
export const AXES = Object.freeze(["x", "y", "z"]);
export const FACES = Object.freeze(["front", "back", "left", "right", "top"]);

// creature_world: a city on / inside a giant creature (the EPIC agent's page/sets/creatureWorld.js buildCreatureWorld
// takes it when present; worldspec.js builds the inside_creature / sky version otherwise)
export const WORLD_KINDS = Object.freeze(["outdoor", "indoor", "enclosure", "creature_world"]);
export const CROWD_FORMATIONS = Object.freeze(["scatter", "line", "block", "ring", "march"]);
export const CROWD_ACTIONS = Object.freeze(["stand", "cheer", "march", "run", "flee", "fight", "wave"]);
export const GROUNDS = Object.freeze(["grass", "dirt", "sand", "rock", "snow", "tiles", "wood", "flesh", "metal", "water", "moon", "gravel"]);
export const GROUND_SHAPES = Object.freeze(["flat", "hilly", "rocky", "wet"]);
export const ENCLOSURES = Object.freeze(["sky", "cave", "room", "inside_creature", "underwater", "space"]);
export const WALL_PATTERNS = Object.freeze(["none", "ribs", "scales", "flesh", "rock", "panels", "bricks", "planks"]);
export const OPENINGS = Object.freeze(["none", "mouth", "hole", "window", "door"]);
export const PARTICLES = Object.freeze(["none", "dust", "bubbles", "snow", "spores"]);
export const LIGHT_BASES = Object.freeze(["day", "night", "warm"]);
export const PROP_SPOTS = Object.freeze(["side_left", "side_right", "back_left", "back_right", "far", "scatter"]);

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : d);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** a colour as "#rrggbb", or null */
export function hexColor(c) {
  if (typeof c !== "string" || !HEX.test(c.trim())) return null;
  let h = c.trim().slice(1).toLowerCase();
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  return `#${h}`;
}
const str = (v, max) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
const vec3 = (v, d, lo, hi) => {
  const a = Array.isArray(v) ? v : d;
  return [0, 1, 2].map((i) => clamp(num(a?.[i], d[i]), lo, hi));
};
const oneOf = (v, list, d) => (list.includes(v) ? v : d);

/** a name as the library keys it: lower case, spaces, no articles, singular last word */
export function normName(s) {
  let n = String(s ?? "").toLowerCase().replace(/[_\-]+/g, " ").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
  n = n.replace(/^(the|a|an|some|my|our|his|her|their) /, "");
  const w = n.split(" "), last = w.at(-1) ?? "";
  w[w.length - 1] = singular(last);
  return w.join(" ").trim();
}
export function singular(w) {
  if (!w || w.length < 4) return w;
  if (/(ss|us|is)$/.test(w)) return w;
  if (/ies$/.test(w)) return w.slice(0, -3) + "y";
  if (/(ches|shes|xes|zes|sses)$/.test(w)) return w.slice(0, -2);
  if (/ves$/.test(w) && !/(eaves|ooves)$/.test(w)) return w.slice(0, -3) + "f";
  if (/s$/.test(w)) return w.slice(0, -1);
  return w;
}

// ---------------------------------------------------------------------------------------------- the blueprint
/**
 * validateBlueprint(raw) -> { blueprint, problems: string[] }. Never throws. Keeps every valid part; a part with a bad
 * field gets that field's default (and a problem line); parts beyond the limit, unknown parents and cycles are dropped.
 */
export function validateBlueprint(raw) {
  const problems = [];
  const bp = isObj(raw) ? raw : {};
  if (!isObj(raw)) problems.push("the blueprint is not an object");
  const name = str(bp.name, LIMITS.nameLen) || "thing";
  const aliases = [...new Set((Array.isArray(bp.aliases) ? bp.aliases : []).map((a) => str(a, LIMITS.nameLen)).filter(Boolean))].slice(0, LIMITS.aliases);
  const giant = bp.giant === true; // a giant (EPIC stories): up to 200 m tall; the parts stay in small units, the height scales them
  const height = bp.height == null ? null : clamp(num(bp.height, 1), LIMITS.objectHeight[0], giant ? LIMITS.giantHeight : LIMITS.objectHeight[1]);
  if (bp.height != null && !Number.isFinite(Number(bp.height))) problems.push("height is not a number");
  const width = bp.width == null ? null : clamp(num(bp.width, 1), 0.05, 60);
  const rawParts = Array.isArray(bp.parts) ? bp.parts : [];
  if (!rawParts.length) problems.push("no parts");
  if (rawParts.length > LIMITS.parts) problems.push(`${rawParts.length} parts: only the first ${LIMITS.parts} are built`);
  const ids = new Set(), parts = [];
  rawParts.slice(0, LIMITS.parts).forEach((p, i) => {
    if (!isObj(p)) { problems.push(`part ${i} is not an object`); return; }
    let id = str(p.id, 40) || `p${i}`;
    if (ids.has(id)) { problems.push(`part id "${id}" used twice`); id = `${id}_${i}`; }
    ids.add(id);
    const shape = oneOf(p.shape, SHAPES, "box");
    if (p.shape !== shape) problems.push(`part ${id}: unknown shape "${p.shape}" (box used)`);
    const color = hexColor(p.color) ?? "#9aa4ad";
    if (!hexColor(p.color)) problems.push(`part ${id}: bad colour "${p.color}"`);
    const material = oneOf(p.material, MATERIALS, "matte");
    if (p.material != null && p.material !== material) problems.push(`part ${id}: unknown material "${p.material}"`);
    const size = vec3(p.size, [0.3, 0.3, 0.3], ...LIMITS.size);
    if (!Array.isArray(p.size) || p.size.length < 3) problems.push(`part ${id}: size must be [x, y, z] metres`);
    const out = {
      id, shape, size, color, material,
      pos: vec3(p.pos, [0, size[1] / 2, 0], -LIMITS.pos, LIMITS.pos),
      rot: vec3(p.rot, [0, 0, 0], -360, 360),
    };
    if (material === "fabric") out.pattern = oneOf(p.pattern, PATTERNS, "none");
    if (p.parent != null && p.parent !== "") out.parent = str(p.parent, 40);
    if (Array.isArray(p.pivot)) out.pivot = vec3(p.pivot, out.pos, -LIMITS.pos, LIMITS.pos);
    parts.push(out);
  });
  // parents: must exist and be acyclic
  const byId = new Map(parts.map((p) => [p.id, p]));
  for (const p of parts) {
    if (p.parent == null) continue;
    if (!byId.has(p.parent) || p.parent === p.id) { problems.push(`part ${p.id}: unknown parent "${p.parent}"`); delete p.parent; continue; }
    const seen = new Set([p.id]); let q = byId.get(p.parent);
    while (q) { if (seen.has(q.id)) { problems.push(`part ${p.id}: parent cycle`); delete p.parent; break; } seen.add(q.id); q = q.parent != null ? byId.get(q.parent) : null; }
  }
  const labels = [];
  for (const [i, l] of (Array.isArray(bp.labels) ? bp.labels : []).slice(0, LIMITS.labels).entries()) {
    if (!isObj(l) || !byId.has(l.part)) { problems.push(`label ${i}: unknown part "${l?.part}"`); continue; }
    const text = str(l.text, LIMITS.textLen);
    if (!text) { problems.push(`label ${i}: no text`); continue; }
    labels.push({ part: l.part, text, color: hexColor(l.color) ?? "#ffffff", bg: hexColor(l.bg) ?? null, face: oneOf(l.face, FACES, "front") });
  }
  const anims = [];
  for (const [i, a] of (Array.isArray(bp.anims) ? bp.anims : []).slice(0, LIMITS.anims).entries()) {
    if (!isObj(a) || !byId.has(a.part)) { problems.push(`anim ${i}: unknown part "${a?.part}"`); continue; }
    const kind = oneOf(a.kind, ANIMS, null);
    if (!kind) { problems.push(`anim ${i}: unknown kind "${a.kind}"`); continue; }
    anims.push({ part: a.part, kind, axis: oneOf(a.axis, AXES, kind === "spin" ? "y" : "x"), amount: clamp(num(a.amount, kind === "bob" ? 0.1 : 20), -360, 360), speed: clamp(num(a.speed, 1), 0, 6) });
  }
  const focus = Array.isArray(bp.focus) ? vec3(bp.focus, [0, 0, 0], -LIMITS.pos, LIMITS.pos) : null;
  const footprint = Array.isArray(bp.footprint) ? [clamp(num(bp.footprint[0], 1), 0.05, 60), clamp(num(bp.footprint[1], 1), 0.05, 60)] : null;
  const blueprint = { name, aliases, height, width, parts, labels, anims, focus, footprint };
  if (bp.place === "street" || bp.place === "floor") blueprint.place = bp.place;
  if (giant) blueprint.giant = true;
  return { blueprint, problems };
}

// ---------------------------------------------------------------------------------------------- the world spec
/** validateWorld(raw) -> { spec, problems }. Never throws. */
export function validateWorld(raw) {
  const problems = [];
  const w = isObj(raw) ? raw : {};
  if (!isObj(raw)) problems.push("the world spec is not an object");
  const name = str(w.name, LIMITS.nameLen) || "world";
  const aliases = [...new Set((Array.isArray(w.aliases) ? w.aliases : []).map((a) => str(a, LIMITS.nameLen)).filter(Boolean))].slice(0, LIMITS.aliases);
  const kind = oneOf(w.kind, WORLD_KINDS, "outdoor");
  if (w.kind !== kind) problems.push(`unknown kind "${w.kind}"`);
  const g = isObj(w.ground) ? w.ground : {};
  const ground = { material: oneOf(g.material, GROUNDS, "dirt"), color: hexColor(g.color) ?? "#8a7a5a", shape: oneOf(g.shape, GROUND_SHAPES, "flat") };
  if (g.material != null && g.material !== ground.material) problems.push(`unknown ground material "${g.material}"`);
  const e = isObj(w.enclosure) ? w.enclosure : {};
  const enclosure = {
    type: oneOf(e.type, ENCLOSURES, kind === "indoor" ? "room" : kind === "enclosure" ? "cave" : kind === "creature_world" ? "inside_creature" : "sky"),
    color: hexColor(e.color) ?? null, color2: hexColor(e.color2) ?? null,
    pattern: oneOf(e.pattern, WALL_PATTERNS, "none"), opening: oneOf(e.opening, OPENINGS, "none"), glow: hexColor(e.glow) ?? null,
  };
  if (e.type != null && e.type !== enclosure.type) problems.push(`unknown enclosure type "${e.type}"`);
  const palette = (Array.isArray(w.palette) ? w.palette : []).map(hexColor).filter(Boolean).slice(0, LIMITS.palette);
  let fog = null;
  if (isObj(w.fog)) fog = { color: hexColor(w.fog.color) ?? "#9fb4c8", density: clamp(num(w.fog.density, 0.3), 0, 1) };
  const particles = oneOf(w.particles, PARTICLES, "none");
  const l = isObj(w.light) ? w.light : {};
  const light = {
    base: oneOf(l.base, LIGHT_BASES, "day"), tint: hexColor(l.tint) ?? null, ambient: clamp(num(l.ambient, 1), 0.2, 2.5),
    practicals: (Array.isArray(l.practicals) ? l.practicals : []).slice(0, LIMITS.practicals).filter(isObj).map((p) => ({ color: hexColor(p.color) ?? "#ffd08a", pos: vec3(p.pos, [0, 3, -4], -30, 30), intensity: clamp(num(p.intensity, 6), 0, 40) })),
  };
  const props = [];
  for (const [i, p] of (Array.isArray(w.props) ? w.props : []).slice(0, LIMITS.worldProps).entries()) {
    if (!isObj(p)) continue;
    const spot = oneOf(p.spot, PROP_SPOTS, "scatter");
    const count = clamp(Math.round(num(p.count, 1)), 1, spot === "scatter" ? 24 : 3);
    if (isObj(p.blueprint)) {
      const v = validateBlueprint(p.blueprint);
      problems.push(...v.problems.map((x) => `prop ${i}: ${x}`));
      if (v.blueprint.parts.length) props.push({ blueprint: v.blueprint, spot, count });
    } else if (typeof p.kit === "string" && p.kit.trim()) props.push({ kit: str(p.kit, 40), spot, count });
    else problems.push(`prop ${i}: needs a blueprint or a kit name`);
  }
  let landmark = null;
  if (isObj(w.landmark)) {
    const v = validateBlueprint(w.landmark);
    problems.push(...v.problems.map((x) => `landmark: ${x}`));
    if (v.blueprint.parts.length) landmark = v.blueprint;
  }
  // hooks for EPIC stories (built by the EPIC agent's modules, passed through here validated): the creature a city sits
  // on / in, giants at scale, instanced crowds
  let creature = null;
  if (isObj(w.creature)) creature = { species: str(w.creature.species, 40) || "turtle", scale: clamp(num(w.creature.scale, 60), 5, LIMITS.giantHeight), city: oneOf(w.creature.city, ["on", "inside"], "on") };
  const giants = [];
  for (const [i, g] of (Array.isArray(w.giants) ? w.giants : []).slice(0, LIMITS.giants).entries()) {
    if (!isObj(g)) continue;
    const bp2 = isObj(g.blueprint) ? validateBlueprint({ ...g.blueprint, giant: true }) : null;
    if (bp2) problems.push(...bp2.problems.map((x) => `giant ${i}: ${x}`));
    giants.push({ kind: str(g.kind, 40) || null, blueprint: bp2?.blueprint ?? null, height: clamp(num(g.height, 30), 3, LIMITS.giantHeight), spot: oneOf(g.spot, PROP_SPOTS, "far") });
  }
  const crowds = [];
  for (const c of (Array.isArray(w.crowds) ? w.crowds : []).slice(0, LIMITS.crowds)) {
    if (!isObj(c)) continue;
    crowds.push({ kind: str(c.kind, 40) || "townsfolk", count: clamp(Math.round(num(c.count, 20)), 1, LIMITS.crowdCount), formation: oneOf(c.formation, CROWD_FORMATIONS, "scatter"), action: oneOf(c.action, CROWD_ACTIONS, "stand"), spot: oneOf(c.spot, PROP_SPOTS, "far") });
  }
  const spec = { name, aliases, kind, ground, enclosure, palette, fog, particles, light, props, landmark };
  if (creature) spec.creature = creature;
  if (giants.length) spec.giants = giants;
  if (crowds.length) spec.crowds = crowds;
  return { spec, problems };
}

/** a short text summary of a blueprint for logs / the vision prompt */
export const blueprintSummary = (bp) => `${bp.name}: ${bp.parts.length} parts, ${bp.labels?.length ?? 0} labels, ${bp.anims?.length ?? 0} anims, height ${bp.height ?? "auto"} m`;
