// Blocky Worlds builder: the NAMES a built thing is saved under, and when a library asset is the same thing as a request.
// (2026-11-09, the BUILDS run: the bell tower's designer aliases "tower" and "clock tower" made the clock tower request
// reuse the bell tower; "window" sat on a curtain, "cart" / "pumpkins" on a pumpkin cart, "cottage" on Odette's
// cottage, and resolve.js saved the long look phrase itself as a name.)
//   parseName(s)                -> { head, mods (noun modifiers), adjs, owner, ofNouns, withNouns, words }
//   cleanAliases(name, aliases) -> only names of THIS thing: the same head noun (or a true synonym), no other object's
//                                  noun, never a long phrase, never the bare head noun when the name has a defining
//                                  noun ("bell tower", "cart of pumpkins", "Odette's cottage")
//   sameThing(request, assetName) -> may a library asset named assetName serve a request named request? Same head noun
//                                  (or synonym), the asset's defining nouns all named by the request, and no noun of
//                                  the request missing from the asset ("clock tower" never gets a "bell tower")
// Pure, no imports beyond spec.js's singular.
import { singular } from "./spec.js";

/** describing words: never a defining noun (sizes, colours, looks, materials, ages) */
const ADJ = new Set(`big small tiny huge giant large little tall short long wide thin thick fat old new young ancient modern
  red blue green yellow orange purple pink black white brown grey gray golden silver gold cream teal dark bright pale shiny
  rusty dusty muddy soggy fancy plain simple decorative main cosy cozy cute scary spooky creepy happy sad angry funny
  open closed empty full broken cracked chipped wooden wood metal metallic iron steel brass copper stone glass plastic
  paper cardboard timber leather woolen woollen velvet fluffy fuzzy furry hairy round square flat heavy light soft hard
  hot cold warm wet dry clean dirty messy magic magical secret special strange weird odd mysterious lonely only very
  first last next other same whole half double single extra mini jumbo mega super ornate jeweled jewelled gilded
  painted striped spotted dotted patterned frosty snowy icy rainy sunny windy foggy mossy grassy sandy rocky leafy
  sleepy lazy busy quiet loud noisy famous local public private royal grand humble poor rich cheap expensive
  shaped like style type kind sort`.split(/\s+/).filter(Boolean));
const ADJ_SUFFIX = /(ed|ous|ful|less)$/;
const STOP = new Set("a an the some my our his her their its this that these those one two three four five six seven eight nine ten many few lots lot and or".split(" "));
const PREPS = ["full of", "filled with", "made of", "of", "with", "on", "in", "at", "under", "over", "by", "for", "from", "near", "inside", "behind", "above", "below", "into", "onto", "like"];
const PREP_RE = new RegExp(`\\s(${PREPS.map((p) => p.replace(/ /g, "\\s")).join("|")})\\s`);
/** true synonyms of a head noun: word -> { head, mods } (the mods it implies) */
const SYN = {
  drape: { head: "curtain" }, drapery: { head: "curtain" },
  lift: { head: "elevator" },
  wagon: { head: "cart" }, handcart: { head: "cart" },
  belfry: { head: "tower", mods: ["bell"] }, clocktower: { head: "tower", mods: ["clock"] },
  billfold: { head: "wallet" },
  cord: { head: "rope" },
  pail: { head: "bucket" },
  couch: { head: "sofa" },
  automobile: { head: "car" },
  lamppost: { head: "lamp post" }, streetlight: { head: "lamp post" },
};

const clean = (s) => String(s ?? "").toLowerCase().replace(/[_\-]+/g, " ").replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
const isAdj = (w) => ADJ.has(w) || (w.length > 4 && ADJ_SUFFIX.test(w) && !/(shed|bed|sled|reed|seed|steed|weed|bread)$/.test(w));
const nounsOf = (ws) => ws.filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w) && !isAdj(w)).map(singular);

/** a name's parts: head noun, noun modifiers ("bell" in "bell tower"), describing words, owner ("odette"), of / with nouns */
export function parseName(s) {
  let n = ` ${clean(s)} `;
  const m = PREP_RE.exec(n);
  let core = n, prep = null, rest = "";
  if (m) { core = n.slice(0, m.index); prep = m[1].replace(/\s+/g, " "); rest = n.slice(m.index + m[0].length); }
  let words = core.trim().split(" ").filter((w) => w && !STOP.has(w));
  let owner = null;
  words = words.filter((w) => { if (/'s$|s'$/.test(w)) { owner = w.replace(/'s?$/, "").replace(/'$/, ""); return false; } return true; }).map((w) => w.replace(/'/g, ""));
  let head = singular(words.at(-1) ?? "");
  const before = words.slice(0, -1);
  const mods = [], adjs = [];
  for (const w of before) (isAdj(w) ? adjs : mods).push(singular(w));
  if (SYN[head]) { const s2 = SYN[head]; const hw = s2.head.split(" "); head = hw.at(-1); mods.push(...hw.slice(0, -1), ...(s2.mods ?? [])); }
  // "cart of pumpkins" / "elevator for hats": the tail names what it IS; "house with a coin gauge": an extra
  const tailNouns = nounsOf(rest.trim().split(" "));
  const defining = ["of", "full of", "filled with", "made of", "for"].includes(prep);
  return {
    head, mods: [...new Set(mods)], adjs, owner,
    ofNouns: defining ? tailNouns : [], withNouns: defining ? [] : tailNouns,
    words: clean(s).split(" ").filter(Boolean).length,
  };
}

/** the nouns that make it THIS kind of thing (not just any <head>) */
const definingNouns = (p) => [...p.mods, ...p.ofNouns, ...(p.owner ? [p.owner] : [])];
const allNouns = (p) => new Set([...p.mods, ...p.ofNouns, ...p.withNouns, ...(p.owner ? [p.owner] : []), p.head]);
const LONG = { words: 5, chars: 40 };
const sameNouns = (A, B) => { const a = allNouns(A), b = allNouns(B); return a.size > 1 && a.size === b.size && [...a].every((w) => b.has(w)); };

/** why an alias is not a name of the thing called `name` (null = it is) */
export function aliasProblem(name, alias) {
  const a = clean(alias);
  if (!a) return "empty";
  if (a.split(" ").length > LONG.words || a.length > LONG.chars) return "a long phrase, not a name";
  const P = parseName(name), A = parseName(alias);
  if (!A.head) return "no noun";
  if (sameNouns(A, P)) return null; // the same nouns in another order ("dentist robot" for "robot dentist")
  if (A.head !== P.head) return `another thing ("${A.head}", not a ${P.head})`;
  const mine = allNouns(P);
  const extra = [...allNouns(A)].filter((w) => !mine.has(w));
  if (extra.length) return `names another object ("${extra.join(" ")}")`;
  if (!definingNouns(A).length && definingNouns(P).length) return `too generic (a bare "${A.head}" for "${clean(name)}")`;
  return null;
}

/** only the aliases that are names of THIS thing (deduped by their library key, the name itself left out) */
export function cleanAliases(name, aliases = [], { max = 8 } = {}) {
  const key = (s) => clean(s).split(" ").map(singular).join(" ");
  const seen = new Set([key(name)]), out = [];
  for (const a of aliases ?? []) {
    if (typeof a !== "string") continue;
    const k = key(a);
    if (!k || seen.has(k) || aliasProblem(name, a)) continue;
    seen.add(k); out.push(a.trim());
    if (out.length >= max) break;
  }
  return out;
}

/** may a library asset called assetName serve a request called request? */
export function sameThing(request, assetName) {
  const key = (s) => clean(s).split(" ").map(singular).join(" ");
  if (key(request) && key(request) === key(assetName)) return true;
  const R = parseName(request), N = parseName(assetName);
  if (R.head && sameNouns(R, N)) return true;
  if (!R.head || R.head !== N.head) return false;
  const rn = allNouns(R), nn = allNouns(N);
  // the asset's defining nouns must all be asked for ("cart" never gets the pumpkin cart, "cottage" never Odette's)
  if (!definingNouns(N).every((w) => rn.has(w))) return false;
  // the request's nouns must all be in the asset ("clock tower" never gets the bell tower)
  if (![...definingNouns(R), ...R.withNouns].every((w) => nn.has(w))) return false;
  return true;
}
