// Blocky Worlds STORY-CRITICAL ITEMS (VISUAL-FIX 2026-11-08, owner's review of step-2 #1: "The story's core visuals
// aren't built: stacked towers, gold penthouse, plaque, base block. A story about towers with no towers can't work. The
// builder must build every story-critical object BEFORE planning, or the plan must be rejected.")
//
// Story-critical = the things the story can't be told without:
//   rule      a thing the rule line(s) name (the town's rule is ABOUT it)
//   planted   the director's storyProp (planted early, paid off later)
//   twist     a thing the discovery / climax lines are about (the line subject the director gave)
//   recurring a set piece the script names on >= 2 lines
//   creature  the creatures / giants / monster of the story (the threat)
// Each must resolve kit -> library -> build BEFORE planVideo; one that can't is a builder need, and the plan is
// REJECTED with the list (never planned with a lookalike). The kit match obeys the HEAD-NOUN GUARD: a matched kit item
// must share the phrase's head noun (or a known synonym), so "small wooden broom" is never a mop, "stone plaque" never
// a rock, "the towers" never a water tower, "gold penthouse" never a gold star.
//
//   headNoun(phrase) / kitMatchOk(phrase, kitName, aliases)
//   storyObjects(production)                 -> { head word: catalog object }  (lib/visuals extractKeys reads it)
//   criticalItems({ production, script })     -> [{ id, name, why: [...], kind }]
//   resolveCritical(items, { library })       -> [{ ...item, source: kit|library|built|null, kitName? }]
//   criticalGate({ production, script, resolved, mode }) -> report { items, unresolved }; mode "reject" throws
import { OBJECT_CATALOG, heldKind, objectForNoun } from "./visuals.js";
import { HELD } from "./catalog.js";

const STOP = new Set("a an the of to in on at by for with from my our your his her their its this that these those some every all one two big small little tiny old new huge giant tall short whole".split(" "));
const words = (s) => String(s ?? "").toLowerCase().replace(/['’]s\b/g, "").replace(/[^a-z ]+/g, " ").split(/\s+/).filter(Boolean);
const sing = (w) => (/ies$/.test(w) ? w.slice(0, -3) + "y" : /(ss|us)$/.test(w) ? w : /(ches|shes|xes)$/.test(w) ? w.slice(0, -2) : /s$/.test(w) ? w.slice(0, -1) : w);

/** the head noun of a noun phrase: the last content word before a "reading / saying / with / on / of" tail */
export function headNoun(phrase) {
  const ws = words(String(phrase ?? "").split(/\b(?:reading|saying|that|which|with|on a|on the|of the|of a|from|over|beyond|under|above|behind|painted|sewn|made|covered|filled|full|tied)\b/i)[0]);
  const content = ws.filter((w) => !STOP.has(w));
  return content.length ? sing(content.at(-1)) : null;
}

/** real synonyms (the same thing under another name); a lookalike (mop for broom, rock for plaque) is NOT one */
export const SYNONYMS = Object.freeze({
  tower: ["tower", "towers", "high rise", "highrise"], plaque: ["plaque", "tablet", "inscription", "engraving"], block: ["block", "cornerstone", "foundation"],
  house: ["house", "home", "building"], sign: ["sign", "placard", "notice", "poster", "board"], broom: ["broom", "broomstick"], hat: ["hat", "cap", "top hat"],
  crate: ["crate", "box"], key: ["key", "keys"], basket: ["basket", "hamper"], cup: ["cup", "teacup", "mug"], teacup: ["teacup", "cup"], bell: ["bell", "handbell"],
  scarf: ["scarf", "muffler"], crown: ["crown", "tiara"],
});

/** does a kit item (its name + aliases) name the phrase's head noun (or a synonym of it)? */
export function kitMatchOk(phrase, kitName, aliases = []) {
  const head = headNoun(phrase);
  if (!head || !kitName) return false;
  const syn = new Set([head, ...(SYNONYMS[head] ?? [])].map(sing));
  const own = [kitName, ...aliases].flatMap((a) => String(a).toLowerCase().split(/[_\s]+/)).map(sing);
  // the kit item's own NAME words carry the identity; an alias counts only when it IS the head word / a synonym
  const nameWords = String(kitName).toLowerCase().split(/[_\s]+/).map(sing);
  if (nameWords.some((w) => syn.has(w))) return true;
  return aliases.some((a) => { const aw = String(a).toLowerCase().split(/\s+/).map(sing); return aw.length === 1 && syn.has(aw[0]); }) && own.length > 0;
}

/** scenery the world sets already build (a creature world's forest, the sea, the hills, the town square) */
export const SCENERY = new Set(["door", "wall", "window", "forest", "wood", "woods", "tree", "sea", "ocean", "sky", "hill", "hillside", "mountain", "valley", "field", "meadow", "street", "square", "road", "town", "village", "city", "shore", "beach", "coast", "edge", "ground", "floor"]);

/** the kit's view of a phrase: a scene object or a hand prop that passes the head-noun guard (else null) */
export function kitFor(phrase, { own = null } = {}) {
  // the story's own things first: "Fennick tower" in a stacked-tower story is its stacked block tower
  const h0 = headNoun(phrase);
  if (own && h0 && (own[h0] || own[`${h0}s`])) return { kind: "object", name: own[h0] ?? own[`${h0}s`] };
  const ws = words(phrase), joined = ws.join(" "), under = ws.join("_");
  const cands = [];
  if (OBJECT_CATALOG[under]) cands.push(under);
  for (const [k, o] of Object.entries(OBJECT_CATALOG)) if ((o.aliases ?? []).includes(joined)) cands.push(k);
  const head = headNoun(phrase);
  const byHead = head ? objectForNoun(head) : null; if (byHead) cands.push(byHead);
  for (const k of cands) if (kitMatchOk(phrase, k, OBJECT_CATALOG[k]?.aliases ?? [])) return { kind: "object", name: k };
  const h = heldKind(head ?? "");
  if (h && kitMatchOk(phrase, h, HELD[h] ?? [])) return { kind: "held", name: h };
  return null;
}

/** the story's own things by head word -> its catalog object (story objects win over generic rules / lookalikes) */
export function storyObjects(production) {
  const out = {};
  for (const p of production?.props ?? []) {
    const k = kitFor(p.name);
    if (k?.kind !== "object") continue;
    const head = headNoun(p.name);
    if (head && !out[head]) out[head] = k.name;
    // the plural the lines say ("the towers")
    if (head && !out[`${head}s`]) out[`${head}s`] = k.name;
  }
  return out;
}

/** a sound, a body part, a word that is no thing to build (old director lists carry them as props) */
export const NOT_A_THING = new Set(["tick", "tock", "drumbeat", "beat", "boom", "bang", "crack", "clang", "sound", "noise", "hum", "song", "note", "squeak", "yell", "scream", "roar", "sneeze", "cough", "wrist", "hand", "arm", "leg", "head", "face", "eye", "ear", "nose", "foot", "feet", "finger", "single", "only", "one", "thing", "glow", "light", "shadow"]);

/** the story-critical items of a production + script */
export function criticalItems({ production = null, script = null } = {}) {
  if (!production) return [];
  const lines = (script?.lines ?? []).map((l) => ({ part: l.part, text: String(l.text ?? "").toLowerCase() }));
  const dirLines = production.lines ?? [];
  const items = new Map();
  const add = (id, name, why, kind = "object") => {
    if (!name || (kind === "object" && NOT_A_THING.has(headNoun(name) ?? ""))) return;
    const key = id ?? name;
    const it = items.get(key) ?? { id: key, name, kind, why: [] };
    if (!it.why.includes(why)) it.why.push(why);
    items.set(key, it);
  };
  const props = production.props ?? [];
  const mentions = (p) => {
    const head = headNoun(p.name); if (!head) return 0;
    const re = new RegExp(`\\b${head}(e?s)?\\b`);
    return lines.filter((l) => re.test(l.text)).length;
  };
  const partOf = (i) => script?.lines?.[i]?.part ?? null;
  // PLANNER-BUGS 2026-11-08 (owner: "every 'not shown' story object - stilt houses, the hat elevator, mirrors, the Dirt
  // Fee slot, pipes - must be built and shown"): a named set piece (landmark / big, said on a line), anything the opening
  // / rule line names, anything said on >= 2 lines (hand things too), and the world-defining object
  const first = lines[0]?.text ?? "";
  const wo = worldObject({ production, script });
  for (const p of props) {
    if (p.storyProp) add(p.id, p.name, "planted");
    if (mentions(p) >= 2) add(p.id, p.name, "recurring");
    if ((p.size === "landmark" || p.size === "big") && mentions(p) >= 1) add(p.id, p.name, "setpiece");
    const head = headNoun(p.name);
    if (head && new RegExp(`\\b${head}(e?s)?\\b`).test(first)) add(p.id, p.name, "opening");
    if (wo?.kind === "object" && wo.id === p.id) add(p.id, p.name, "world");
  }
  for (const L of dirLines) {
    const part = partOf(L.line);
    const subj = props.find((p) => p.id === L.subject);
    if (part === "rule") for (const n of L.needs ?? []) { const p = props.find((x) => x.id === n); if (p) add(p.id, p.name, "rule"); }
    if (subj && (part === "discovery" || part === "climax")) add(subj.id, subj.name, "twist");
  }
  for (const c of production.creatures ?? []) add(c.id, c.name || c.species, "creature", "creature");
  return [...items.values()];
}

/**
 * The world-defining object (PLANNER-BUGS 2026-11-08, owner: "the thing the rule / premise is about - #1's stilt houses,
 * #3's giant turtle with the town, #4's bell tower, #5's clock tower - must be in the OPENING shots"): the creature
 * world when the town lives on / in a creature, else the director's landmark the opening line (or the most lines) names,
 * else a big prop the opening line names. -> { kind: "creature", id, name } | { kind: "object", id, name } | null
 */
export function worldObject({ production = null, script = null } = {}) {
  if (!production) return null;
  const lines = (script?.lines ?? []).map((l) => String(l.text ?? l).toLowerCase());
  const cw = (production.worlds ?? []).find((w) => w.kind === "creature" || w.creature) ?? null;
  const sp = cw ? String(cw.creature?.species ?? cw.creature ?? "").toLowerCase() : "";
  const cr = cw ? (production.creatures ?? []).find((c) => c.id === sp || String(c.species ?? "").toLowerCase() === sp) ?? (sp ? { id: sp, species: sp, name: sp } : null) : null;
  if (cw && cr) return { kind: "creature", id: cr.id, name: cr.name || cr.species, species: cr.species };
  const props = production.props ?? [];
  const score = (p) => {
    const ws = words(p.name).filter((w) => !STOP.has(w) && w.length > 2).map(sing);
    const head = headNoun(p.name);
    const on = (t) => ws.some((w) => new RegExp(`\\b${w}(e?s)?\\b`).test(t));
    return (on(lines[0] ?? "") ? 100 : 0) + (on(lines[1] ?? "") ? 50 : 0) + lines.filter((t) => head && new RegExp(`\\b${head}(e?s)?\\b`).test(t)).length * 3 + lines.filter(on).length;
  };
  const landmarks = props.filter((p) => p.size === "landmark" && !/\b(cottage|house|home)\b/.test(String(p.name).toLowerCase()) || (p.size === "landmark" && score(p) >= 50)).map((p) => [p, score(p)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  if (landmarks.length) return { kind: "object", id: landmarks[0][0].id, name: landmarks[0][0].name };
  const big = props.filter((p) => p.size !== "hand").map((p) => [p, score(p)]).filter(([, s]) => s >= 100).sort((a, b) => b[1] - a[1]);
  return big.length ? { kind: "object", id: big[0][0].id, name: big[0][0].name } : null;
}

/**
 * A set piece is the kit item only when the kit covers its defining words too ("tall stilt houses": the stilts make it,
 * a plain house front is a lookalike); colour / size / material words and a "with ..." tail don't count.
 */
const LOOSE = new Set("tall short big small huge giant tiny little old new brass wooden wood stone golden gold silver iron red blue green yellow white black grey gray brown purple orange pink dark bright shiny rusty cracked chipped empty main".split(" "));
export function kitCoversAll(phrase, kitName, aliases = []) {
  const all = words(String(phrase ?? "").split(/\b(?:with|of|that|which|from|on|in)\b/i)[0]).filter((w) => !STOP.has(w) && !LOOSE.has(w)).map(sing);
  // a place word before the head is where it is ("tower steps", "kitchen table"), not what it is
  const ws = all.filter((w, i) => i === all.length - 1 || !(SCENERY.has(w) || /^(tower|town|kitchen|garden|school|bedroom|church|market)$/.test(w)));
  const own = new Set([kitName, ...aliases].flatMap((a) => String(a).toLowerCase().split(/[_\s]+/)).map(sing));
  for (const w of [...own]) for (const s of SYNONYMS[w] ?? []) own.add(sing(s));
  return ws.every((w) => own.has(w) || (SYNONYMS[w] ?? []).some((s) => own.has(sing(s))));
}
const SETPIECE_WHY = new Set(["setpiece", "world", "opening"]);

/** kit -> library -> built; library(name) -> asset | null, built: { [name]: asset } (the builder's results) */
export function resolveCritical(items, { library = null, built = null, own = null } = {}) {
  return items.map((it) => {
    if (it.kind === "creature") return { ...it, source: "creature" }; // giants / monsters: the director's EPIC + monster kit
    if (SCENERY.has(headNoun(it.name))) return { ...it, source: "set" };  // the world's own ground: the set builds it
    const k = kitFor(it.name, { own });
    const setPiece = (it.why ?? []).some((w) => SETPIECE_WHY.has(w));
    if (k && (!setPiece || kitCoversAll(it.name, k.name, (k.kind === "object" ? OBJECT_CATALOG[k.name]?.aliases : HELD[k.name]) ?? []))) return { ...it, source: "kit", kitName: k.name, kitKind: k.kind };
    const lib = library?.(it.name) ?? null;
    if (lib) return { ...it, source: "library", asset: lib };
    const b = built?.[it.name] ?? built?.[it.id] ?? null;
    if (b) return { ...it, source: "built", asset: b };
    return { ...it, source: null };
  });
}

/**
 * The gate before planning: every story-critical item resolved, else (mode "reject") an Error whose .critical lists
 * them; mode "report" only returns the report (the free harness / dev runs).
 */
export function criticalGate({ production = null, script = null, library = null, built = null, mode = "reject" } = {}) {
  const resolved = resolveCritical(criticalItems({ production, script }), { library, built, own: storyObjects(production) });
  const unresolved = resolved.filter((r) => !r.source);
  const report = { items: resolved, unresolved: unresolved.map((r) => ({ id: r.id, name: r.name, why: r.why })) };
  if (mode === "reject" && unresolved.length) {
    const e = new Error(`plan rejected: ${unresolved.length} story-critical item(s) not built: ${unresolved.map((r) => `${r.name} (${r.why.join("+")})`).join("; ")} — the builder must make them before planning`);
    e.critical = report;
    throw e;
  }
  return report;
}
