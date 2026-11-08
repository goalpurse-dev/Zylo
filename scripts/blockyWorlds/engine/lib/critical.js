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
  for (const p of props) {
    if (p.storyProp) add(p.id, p.name, "planted");
    if (mentions(p) >= 2 && p.size !== "hand") add(p.id, p.name, "recurring");
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

/** kit -> library -> built; library(name) -> asset | null, built: { [name]: asset } (the builder's results) */
export function resolveCritical(items, { library = null, built = null, own = null } = {}) {
  return items.map((it) => {
    if (it.kind === "creature") return { ...it, source: "creature" }; // giants / monsters: the director's EPIC + monster kit
    if (SCENERY.has(headNoun(it.name))) return { ...it, source: "set" };  // the world's own ground: the set builds it
    const k = kitFor(it.name, { own });
    if (k) return { ...it, source: "kit", kitName: k.name, kitKind: k.kind };
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
