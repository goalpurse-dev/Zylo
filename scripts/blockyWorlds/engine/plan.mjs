// Blocky Worlds: the rule-based shot planner (owner: PLANNER). No AI: script + word timings + idea card -> timeline.
// Deterministic. The timeline format is CONTRACT.md's.
//
//   planVideo({ script, words, idea, lengthSec }) -> timeline
//   checkTimeline(timeline) -> string[]            (problems; empty = valid)
//   estimateWords(script, wpm = 260) -> [{ word, start, end }]   (silent fallback timings)
//   checkVisuals(timeline, script) -> [{ line, text, missing: [...] }]   (lines whose key nouns/actions are not on screen)
//   checkSubjects(timeline) -> [{ shot, line, text, subject, problem }]  (shots whose subject is off screen / not featured)
//   subjectOf(line, ctx) -> { id, kind, with, absent, sentences, refs }  (lib/subjects.js: who a line is about)
//
// Every shot records `subject` (cast id | "me" | "monster" | "group" | "babies" | "someone" | "thing:<label>" | null),
// `subjectWith` (who it acts on: in frame too) and `subjectAbsent` ("It never came back."). The subject is on screen and
// is the focus; a name it is "looking for" is a "NAME?" badge on it, never a tag on the narrator.
//
// The rules, in order: time every line from the words -> cut lines into shots at word starts (long lines into 2-3,
// a line with two places ("Past the school. Past the bakery.") into one shot per place, short shots merged) -> read
// the world once (cast, monster, prop, rule sign, night, loose names) -> read every shot's own words (set, light, who,
// doing what, the monster's state, inserts) -> the visual pass (lib/visuals.js: every key noun / action of the shot
// gets its object, pose, hold, name tag or window state) -> pick a camera with variety -> the visual check: a line
// still missing a noun first gets a catalog visual, else a picture card shot cut into its time -> timeline.visualReport.
import { hashSeed } from "./lib/rng.js";
import { norm, tokens, estimateWords, alignTokens, badgeWord } from "./lib/planText.js";
import { OBJECT_CATALOG, HOLDABLE, extractKeys, covers, describeShot, cardFor, anchorsOf, ruleById, cleanTokens, heldKind, objectForNoun, ABSTRACT, ICONS } from "./lib/visuals.js";
import { subjectOf, genderOf, subjectLabel } from "./lib/subjects.js";
import { creatureFor, CREATURES } from "./lib/catalog.js";
import { readDirection, directShots, compactProduction, checkProduction as checkProductionStrict, fixProduction, isCreatureSet, epicVariety } from "./lib/direction.js";
import { EPIC_CAMERAS, validateEpic } from "./lib/epic.js";

export { estimateWords, subjectOf };
/**
 * The production check (pre-render, next to checkVisuals / checkSubjects / checkTimeline): every line's required items
 * from the story director's production list (tl.production, kept by planVideo) are on screen in that line's shots.
 * [{ line, text, missing: [{ id, kind, name, route }] }]; empty = clean (and always empty without a direction).
 */
export const checkProduction = (tl, prod) => checkProductionStrict(tl, prod ?? tl?.production);

export const SETS = ["street", "bedroom", "school", "woods"];
export const CAMERAS = ["wide", "medium", "closeup", "low", "over_shoulder", "insert"];
export const LIGHTS = ["day", "night", "warm"];
export const POSES = ["stand", "walk", "run", "point", "scared", "sit", "carry", "wave", "look_up", "talk", "sleep", "cheer", "yell", "sneeze", "blow",
  // 2026-11-05 (GAPS): the actions (page/kit/people.js); hold-poses keep the thing held (eat, throw, dig, hug)
  "hug", "climb", "push", "eat", "fall", "jump", "ride", "hide", "throw", "fly", "swim", "build", "dig", "dance", "kick", "fight", "drive"];
/** poses that use the thing in the hand (a held thing does not turn them into "carry") */
const HOLD_POSES = new Set(["blow", "yell", "point", "sit", "run", "walk", "eat", "throw", "dig", "hug", "build", "ride", "fly", "climb", "push", "jump", "dance", "kick", "fall", "hide", "swim", "drive", "fight"]);
/** the actions that belong to their own line (a fragment after it does not carry them on) */
const ONE_LINE_POSES = new Set(["hug", "climb", "push", "eat", "fall", "jump", "ride", "hide", "throw", "fly", "swim", "build", "dig", "dance", "kick", "fight", "drive"]);
/** what such a pose was before it had its own (a fragment carries this on, as it always did) */
const LEGACY_POSE = { climb: "walk", jump: "cheer", hide: "scared", dance: "cheer", hug: "carry" };
/** the actions that override "carry" while keeping the thing held */
const ACTION_HOLD = new Set(["eat", "throw", "dig", "hug", "build"]);
/** a shot's thing a person can ride (an animal, a vehicle, a built thing): the engine seats the rider on it */
const RIDEABLE = (o) => !!o && (!!o.asset || !!OBJECT_CATALOG[o.name]?.animal || /^(car|tractor|ice_cream_truck|pumpkin|haystack|cloud|snow_pile|rock|stump|bridge|whale|turtle)$/.test(o.name));
export const EXPRS = ["neutral", "happy", "sad", "scared", "surprised", "angry", "sleepy", "smirk", "cry", "excited", "shush", "yell", "sneeze"];
export const INSERT_KINDS = ["sign", "note", "card"];
export const OBJECTS = Object.keys(OBJECT_CATALOG);
const TOWN_NAMES = ["Rosa", "Gus", "Edna", "Otto", "Mae", "Hank", "Ida", "Lou"];
const BABY_NAMES = ["Mae", "Otto", "Ivy", "Rudy"];
export const SPOTS = ["center", "left", "right", "back", "far", "door"];
export const MONSTER_STATES = ["lurk", "reach", "reveal", "flee"];

export const PACE = Object.freeze({ minShot: 0.8, splitAt: 2.3, split3At: 4.6, tail: 0.4 });

const r3 = (x) => Math.round(x * 1000) / 1000;
const has = (re, s) => re.test(s);

// ---------------------------------------------------------------- 1. timing
function timeLines(script, words, duration) {
  const flat = [];
  script.lines.forEach((l, line) => tokens(l.text).forEach((raw, k) => flat.push({ line, k, raw, n: norm(raw) })));
  const al = alignTokens(flat, words);
  flat.forEach((t, i) => { t.w = al[i].word; t.matched = al[i].matched; t.t = words[t.w]?.start ?? 0; });
  const lines = script.lines.map((l, i) => { const toks = flat.filter((t) => t.line === i); return { i, part: l.part, text: l.text, toks, wordToks: toks }; });
  let prev = 0;
  for (const L of lines) {
    const s = L.i === 0 ? 0 : (L.toks[0]?.t ?? prev);
    L.start = Math.max(prev, s);
    prev = L.start;
  }
  lines.forEach((L, i) => { L.end = i + 1 < lines.length ? lines[i + 1].start : duration; });
  return lines;
}

// ---------------------------------------------------------------- 2. cutting
const PHRASE_START = /^(in|on|at|for|from|to|into|onto|over|under|past|through|toward|towards|with|without|and|but|then|until|while|when|because|so|up|down|behind|across|after|before)$/;
const PHRASE_GLUE = /^(the|a|an|my|our|his|her|their|its|your|this|that|of|to|very|so|just|was|is|were|are|be)$/;
/** Splits a line into 1-3 segments at word starts (prefers cuts after punctuation, keeps every piece >= minShot). */
function splitLine(L, idx, all) {
  const dur = L.end - L.start;
  let n = dur > PACE.split3At ? 3 : dur > PACE.splitAt ? 2 : 1;
  if (L.i === 0) n = dur > PACE.split3At ? 3 : dur >= 2 * PACE.minShot ? 2 : 1; // rule: the sign, then the world
  // two places in one line ("Past the school. Past the bakery.", "out the back door and up the far hill"): one shot each
  const anchors = anchorsOf(L.text);
  const second = anchors.findIndex((a) => a.set !== anchors[0]?.set);
  const idea = second > 0 ? { lo: anchors[second - 1].k + 1, hi: anchors[second].k } : null;
  if (idea && n < 2 && dur >= 2 * PACE.minShot) n = 2;
  const cuts = [];
  for (let j = 1; j < n; j++) {
    const target = L.start + (dur * j) / n;
    const lo = (cuts.at(-1)?.t ?? L.start) + PACE.minShot, hi = L.end - PACE.minShot * (n - j);
    let best = null, bestScore = Infinity;
    L.toks.forEach((tok, k) => {
      if (k === 0 || tok.t < lo || tok.t > hi || tok.w === L.toks[k - 1].w) return;
      const before = L.toks[k - 1].raw;
      // cut only where a phrase ends: after punctuation, or before a preposition / conjunction (never "the | sock")
      let bonus = /[.!?]["']?$/.test(before) ? 0.8 : /,$/.test(before) ? 0.6 : PHRASE_START.test(tok.n) && !PHRASE_GLUE.test(norm(before)) ? 0.3 : -1;
      if (bonus < 0) return;
      if (idea && k >= idea.lo && k <= idea.hi && !cuts.some((c) => c.k >= idea.lo && c.k <= idea.hi)) bonus += 2;
      const score = Math.abs(tok.t - target) - bonus;
      if (score < bestScore) { bestScore = score; best = { k, t: tok.t }; }
    });
    if (best) cuts.push(best);
  }
  // a two-place line too short for two shots on its own word grid: the second place borrows the next line's first word
  // ("Past the school. Past | the bakery. Past | the sign...": both places on screen, every shot >= minShot)
  const next = all?.[idx + 1];
  if (idea && next && !cuts.some((c) => c.k >= idea.lo && c.k <= idea.hi) && n <= 2) {
    outer: for (let k = idea.lo; k <= idea.hi; k++) {
      const t = L.toks[k]?.t;
      if (t == null || t - L.start < PACE.minShot || L.toks[k - 1]?.w === L.toks[k].w) continue;
      for (let j = 1; j < next.toks.length; j++) {
        const e = next.toks[j].t;
        if (e - t < PACE.minShot || e === next.toks[j - 1].t) continue;
        if (next.end - e < PACE.minShot) break outer;
        cuts.length = 0; cuts.push({ k, t });
        L.end = e; L.toks = [...L.toks, ...next.toks.slice(0, j)];
        next.start = e; next.toks = next.toks.slice(j);
        break outer;
      }
    }
  }
  const edges = [{ k: 0, t: L.start }, ...cuts, { k: L.toks.length, t: L.end }];
  const segs = [];
  for (let j = 0; j + 1 < edges.length; j++) {
    const toks = L.toks.slice(edges[j].k, edges[j + 1].k);
    segs.push({ start: edges[j].t, end: edges[j + 1].t, line: L.i, lines: [...new Set([L.i, ...toks.map((t) => t.line)])].sort((a, b) => a - b), part: L.part, toks, text: toks.map((t) => t.raw).join(" "), lineText: L.text, sub: j, subs: edges.length - 1 });
  }
  return segs;
}

/** Merges every segment shorter than minShot into a neighbour (same line first, then same part, then the shorter). */
function mergeShort(segs) {
  const out = segs.slice();
  for (;;) {
    let i = -1, shortest = PACE.minShot;
    out.forEach((s, k) => { const d = s.end - s.start; if (d < shortest - 1e-9) { shortest = d; i = k; } });
    if (i < 0 || out.length < 2) return out;
    const s = out[i], p = out[i - 1], q = out[i + 1];
    const score = (o) => !o ? Infinity : (o.line === s.line ? 0 : o.part === s.part ? 10 : 100) + (o.end - o.start);
    const j = score(p) <= score(q) ? i - 1 : i + 1;
    const [a, b] = j < i ? [out[j], s] : [s, out[j]];
    const keep = a.part === b.part ? a : (a.end - a.start >= b.end - b.start ? a : b);
    const merged = { ...keep, start: a.start, end: b.end, lines: [...new Set([...a.lines, ...b.lines])].sort((x, y) => x - y), toks: [...a.toks, ...b.toks], text: `${a.text} ${b.text}`, sub: a.sub, subs: Math.max(a.subs, b.subs) };
    out.splice(Math.min(i, j), 2, merged);
  }
}

// ---------------------------------------------------------------- 3. the world
const FAMILY = { mom: "mom", mum: "mom", mommy: "mom", mother: "mom", dad: "dad", daddy: "dad", father: "dad", grandma: "grandma", granny: "grandma", nana: "grandma", grandpa: "grandpa", grandad: "grandpa", brother: "brother", sister: "sister", baby: "baby" };
// titles before a name ("Mr. Dobbs", "Baker Nell", "Captain Peg", "Old Wick"): that person joins the cast
const TITLES_SRC = "Mr|Mrs|Ms|Miss|Dr|Coach|Aunt|Uncle|Grandma|Grandpa|Granny|Nana|Officer|Principal|Sheriff|Mayor|Baker|Farmer|Postman|Mailman|Captain|Lady|Lord|King|Queen|Sir|Dame|Fisher|Cook|Chef|Nurse|Judge|Professor|Prince|Princess|Old|Big|Little|Young|Sergeant|Doctor|Mister|Madam|Janitor|Teacher|Count|Duke|Baron";
const TITLE_RE = new RegExp(`\\b(${TITLES_SRC})\\.?\\s+([A-Z][a-z]+)\\b(?!\\s+(?:Street|Road|Avenue|Lane|Park|Square|Hill|School|Woods))`, "g");
const TITLE_WORDS = new RegExp(`^(${TITLES_SRC})$`);
const KID_TITLES = /^(Big|Little|Young|Prince|Princess)$/;
const ELDER_TITLES = /^(Grandma|Grandpa|Granny|Nana|Old)$/;
const PLACE_NAME = /^(street|road|avenue|lane|drive|way|park|square|hill|lake|river|school|elementary|high|town|city|village|bridge|mountain|woods|forest|creek|bay|beach|mall|market|library|hospital|station|farm|tower)$/i;
/** "Maple Street", "Elm Park": a place's name, never a person. */
const isPlaceName = (toks, k) => PLACE_NAME.test(norm(toks[k])) || (PLACE_NAME.test(norm(toks[k + 1] ?? "")) && /^[A-Z]/.test(toks[k + 1] ?? "") && !/[.,!?;:]$/.test(toks[k]));
const CALENDAR = /^(mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|autumn|winter|christmas|halloween|easter)$/;
const NOT_NAMES = new Set(["i", "im", "id", "ive", "ill", "the", "a", "an", "and", "but", "then", "now", "so", "until", "past", "even", "still", "every", "our", "my", "we", "it", "its", "in", "at", "on", "one", "two", "three", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "shh", "you", "he", "she", "they", "that", "this", "not", "no", "any", "long", "up", "god"]);
const SUBJECT_VERB = /^(\w+ed|is|was|has|had|says|said|ran|sat|got|took|held|made|went|came|saw|told|keeps?|kept|learned|screams?|cries|cried|laughs?|grabbed|woke|slept|threw|knew|lives?|loves?|can|could|would|will)$/;
const MONSTER_WORDS = /\b(monster|beast|creature|yeti|ghost|troll|ogre|dragon|squid|octopus|kraken|serpent|goblin)\b/i;
const FURRY = /\b(furry|hairy|yeti|beast|bear|shaggy|fur|fluffy|big|huge|wolf)\b/i;
const GLOW = { horror: "#9be8ff", funny: "#ffd84a", epic: "#ff8a3d", wholesome: "#a8ff9b" };

const SET_WORDS = {
  bedroom: /\b(bedroom|beds?|room|closet|pillows?|night light|cribs?|blankets?|kitchen|home|upstairs|bathroom|living room|tuck(ed)?)\b/,
  school: /\b(school|class|classroom|teachers?|hallway|lockers?|bell|desks?|cafeteria|recess|principal|homework)\b/,
  woods: /\b(woods|forest|trees?|trail|hills?|creek|stump|campfire|cave|river|lake|mountain)\b/,
  street: /\b(streets?|road|sidewalk|porch|yard|bakery|truck|bus|shops?|store|outside|houses?|town square|fountain|back door|front door|lawn|driveway|neighbou?rs?)\b/,
};
const NIGHT_WORDS = /\b(night|nights|tonight|dark|midnight|lamps?|moon|moonlight|asleep|bedtime|stars)\b/;

function settingToSet(setting) {
  const s = String(setting ?? "").toLowerCase();
  if (/house|bedroom|kitchen|home/.test(s)) return "bedroom";
  if (/school|class/.test(s)) return "school";
  if (/wood|forest|farm|cave|canyon|cliff|snow|mountain/.test(s)) return "woods";
  return "street";
}

/** The rule as a short ALL CAPS sign (<= 6 words): "if you talk above a whisper" -> "NO TALKING ABOVE A WHISPER". */
export function signText(opener) {
  const t = String(opener ?? "").replace(/^\s*in this (town|world),\s*/i, "").replace(/[.!?]+$/, "");
  const ing = (v) => {
    v = v.toLowerCase();
    if (/ie$/.test(v)) return v.slice(0, -2) + "ying";
    if (/[^aeiou]e$/.test(v) && v !== "be") return v.slice(0, -1) + "ing";
    if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(v)) return v + v.at(-1) + "ing";
    return v + "ing";
  };
  const cond = t.match(/^(?:if|when|whenever) you ([a-z]+)\b([^,]*)/i);
  let out;
  if (cond) out = `NO ${ing(cond[1])}${cond[2]}`;
  else out = t.split(",")[0];
  const words = out.replace(/[^A-Za-z0-9' ]/g, " ").trim().split(/\s+/).slice(0, 6);
  while (words.length > 2 && (PHRASE_START.test(norm(words.at(-1))) || PHRASE_GLUE.test(norm(words.at(-1))) || /^(of|adds|gets|is|are|has|takes|makes)$/i.test(words.at(-1)))) words.pop();
  return words.join(" ").toUpperCase();
}

/** The head noun of a noun phrase starting at tokens[i] ("Grandpa's old brass whistle over" -> "whistle"). */
function headNoun(toks, i) {
  const STOP = /^(of|over|in|on|from|to|at|and|with|into|for|by|then|but|so|up|down|out|off|away)$/;
  let last = null;
  for (let k = i; k < toks.length && k < i + 6; k++) {
    const raw = toks[k], n = norm(raw);
    if (STOP.test(n)) break;
    last = n.replace(/s$/, (m) => (n.endsWith("ss") ? m : "")) || n;
    if (/[.,!?;]$/.test(raw)) break;
  }
  return last;
}

function readWorld(script, idea) {
  const lines = script.lines.map((l) => l.text);
  const all = [idea?.opener, ...lines, ...(idea?.examples ?? [])].filter(Boolean).join(" \n ");
  const narrator = (String(idea?.narrator ?? "").split(/[,(]/)[0].match(/[A-Z][a-z]+/) ?? [])[0]
    ?? (lines.join(" ").match(/\bI'?m ([A-Z][a-z]+)\b/) ?? [])[1] ?? "Me";
  const people = new Map(); // id -> { role, name, baby?, elder? }
  people.set("me", { role: "kid", name: narrator });

  // monster: "the Listener", "the Detention Dragon", "the Pigeon Mayor" (a capitalized name said twice, counting its
  // head word in lowercase: "the dragon"); never a group of people ("the Boomers", "the Tall Ones") or a place
  let monster = null;
  const ideaText = `${idea?.opener ?? ""} ${idea?.premise ?? ""} ${idea?.twist ?? ""} ${idea?.teaser ?? ""} ${idea?.price ?? ""}`;
  const srcText = `${idea?.opener ?? ""} ${idea?.twist ?? ""} ${idea?.teaser ?? ""} ${lines.join(" ")}`;
  const theX = {};
  for (const m of srcText.matchAll(/\b[Tt]he ((?:[A-Z][a-z]+)(?:[ -][A-Z][a-z]+){0,2})\b/g)) {
    const ws = m[1].split(/[ -]/);
    // "the Detention Dragon takes your chair" (verb follows) / "the Boomers sit": groups and places are not monsters
    if (/s$/.test(ws.at(-1)) && !/(ss|us)$/.test(ws.at(-1))) continue;
    if (ws.some((w) => FAMILY[w.toLowerCase()]) || PLACE_NAME.test(ws.at(-1)) || /^(Ones?|Rest|End|One|Rule|Law|Board|Cellar|Hall|Room|Wall|Line|Edge|Contest|Union|Council|Club|Book|List|Day|Festival|Cup|Fair|Show|Race|Parade|Prize|Award|Office|Shop|Store|Cafe)$/.test(ws.at(-1))) continue;
    if (ws.length === 1 && /^(Mayor|King|Queen|Lord|Lady|Captain|Sheriff|Principal|Coach|Baker|Rule|Law|Deal|Town|World|First|Last|Only|Next|Same|Other|Whole|Great|Big|Little|Old|New)$/.test(ws[0])) continue;
    theX[m[1]] = (theX[m[1]] ?? 0) + 1;
  }
  const lowAll = srcText.toLowerCase();
  // one name, said in long and short forms ("the Deep Drum", "the Drum", "the drum"): grouped by its head word, named by
  // its longest form
  const head = (p) => p.split(/[ -]/).at(-1);
  const groupOf = (p) => Object.keys(theX).filter((q) => head(q) === head(p));
  const score = (p) => groupOf(p).reduce((a, q) => a + theX[q], 0) + (groupOf(p).some((q) => q.includes(" ")) ? (lowAll.match(new RegExp(`\\bthe ${head(p).toLowerCase()}\\b`, "g")) ?? []).length * 0.5 : 0);
  const mName = Object.keys(theX).filter((p) => score(p) >= 2).sort((a, b) => score(b) - score(a) || b.length - a.length)[0];
  if (mName) {
    const words = mName.toLowerCase().split(/[ -]/);
    const creatureWords = words.filter((w) => creatureFor([w]) && !/^(night|dark|dim|wind|gale|fog|echo|hush|shade|lamp|clock|drum)$/.test(w));
    monster = { name: `The ${mName}`, key: words.at(-1), keys: [...new Set([words.at(-1), ...creatureWords])], words };
  } else if (MONSTER_WORDS.test(ideaText)) { const w = ideaText.match(MONSTER_WORDS)[1].toLowerCase(); monster = { name: `The ${w[0].toUpperCase()}${w.slice(1)}`, key: w, keys: [w], words: [w] }; }
  if (monster) {
    const about = [ideaText, ...lines.filter((l) => monster.keys.some((k) => norm(l).includes(k)))].join(" ");
    monster.variant = creatureFor(monster.words, monster.words.length > 1 || !/^(monster|beast|creature)$/.test(monster.key) ? "" : about) ?? (monster.key === "beast" ? "beast" : null);
    // a generic name ("the Beast", "the Monster") never takes a bird / fish look from a passing word in the idea
    if (/^(monster|beast|creature)$/.test(monster.key) && monster.variant && CREATURES[monster.variant].base === "tall" && !["giant", "ghost", "goblin"].includes(monster.variant)) monster.variant = monster.key === "beast" ? "beast" : null;
    monster.type = monster.variant ? CREATURES[monster.variant].base : FURRY.test(about) ? "furry" : "tall";
    // the very creature ("goat", "moose", "pigeon"): the look's species (kit/monsters.js)
    if (monster.variant) monster.species = [...monster.words].reverse().find((w) => CREATURES[monster.variant].words.includes(w)) ?? null;
    monster.glow = GLOW[idea?.mood] ?? GLOW.horror;
    const lair = (String(idea?.opener ?? "").match(new RegExp(`${monster.key}\\w*\\s+(?:in|on|under|inside|at|behind) the ((?:[a-z]+ ){0,2}[a-z]+)`, "i")) ?? [])[1];
    if (lair) {
      const ws = lair.toLowerCase().split(" ").filter((w) => !/^(hears|sees|lives|waits|watches|listens|knows|takes|eats|comes|is|was)$/.test(w));
      monster.lair = ws.at(-1) ?? null;
      monster.lairPhrase = ws.join(" ") || null;   // a hint for the sets ("water tower"): where it lurks
    }
  }

  // titled neighbours (script + examples)
  for (const m of all.matchAll(TITLE_RE)) {
    const id = m[2].toLowerCase();
    if (/^(Old|Big|Little|Young)$/.test(m[1]) && !/^[A-Z][a-z]+$/.test(m[2])) continue;
    if (!people.has(id) && id !== narrator.toLowerCase() && !(monster?.words ?? []).includes(id)) people.set(id, { role: KID_TITLES.test(m[1]) ? "kid" : "adult", name: `${m[1]}${/^(Mr|Mrs|Ms|Dr)$/.test(m[1]) ? "." : ""} ${m[2]}`, elder: ELDER_TITLES.test(m[1]) || undefined });
  }
  // untitled names: capitalized mid-sentence, the subject of a verb at least once, or named ("call her Bean")
  const alias = {};
  lines.forEach((text, li) => {
    const toks = tokens(text);
    toks.forEach((raw, k) => {
      const word = raw.replace(/[^A-Za-z']/g, "").replace(/'s$/, "");
      if (!/^[A-Z][a-z]+$/.test(word)) return;
      const n = word.toLowerCase();
      if (NOT_NAMES.has(n) || FAMILY[n] || n === narrator.toLowerCase() || monster?.words?.includes(n) || people.has(n) || isPlaceName(toks, k)) return;
      const sentenceStart = k === 0 || /[.!?]["']?$/.test(toks[k - 1]);
      const named = k >= 2 && /^(call|called|named|name's|is)$/i.test(norm(toks[k - 2])) || k >= 1 && /^(named)$/i.test(norm(toks[k - 1]));
      const subject = !sentenceStart && !/'s$/.test(raw) && !/[.,!?]$/.test(raw) && SUBJECT_VERB.test(norm(toks[k + 1] ?? ""));
      // a sentence-start name that does something: said twice, or a word the dictionary doesn't know ("Gary has been...")
      const unknownWord = !ABSTRACT.has(n) && !ICONS[n] && !objectForNoun(n) && !heldKind(n) && !creatureFor([n]) && !/^(nobody|everyone|everybody|someone|somebody|nothing|everything|anyone|anybody|people|kids|children|grown|adults|parents|families|neighbors|neighbours|teachers|dogs|cats|babies|snow|rain|wind|night|nights|mornings|winter|summer|spring|autumn|today|tonight|yesterday|tomorrow|last|next|first|every|each|some|most|many|all|both|none|one|two|three|here|there|maybe|someday|once|still|even|soon|later|now|then|also|plus|instead|luckily|sadly|sometimes|always|never|usually|nobody's|mine)$/.test(n);
      const subject2 = sentenceStart && SUBJECT_VERB.test(norm(toks[k + 1] ?? "")) && !/[.,!?]$/.test(raw) && (lines.join(" ").split(word).length > 2 || unknownWord);
      if (!(named || subject || subject2)) return;
      const near = `${lines[li - 1] ?? ""} ${text}`.toLowerCase();
      const baby = /\bbaby\b/.test(near);
      const rel = (near.match(/\b(sister|brother)\b/) ?? [])[1];
      people.set(n, { role: "kid", name: word, baby: baby || undefined });
      if (named && rel) { alias[rel] = n; if (baby) alias.baby = n; }
    });
  });
  // loose names: said aloud mid-sentence, capitalized, owned by nobody in the cast ("Barnaby") -> name tags with that text
  const looseNames = new Set();
  lines.forEach((text) => {
    const toks = tokens(text);
    toks.forEach((raw, k) => {
      const word = raw.replace(/[^A-Za-z']/g, "").replace(/'s$/, "");
      if (!/^[A-Z][a-z]+$/.test(word)) return;
      const n = word.toLowerCase();
      // mid-sentence only, never right after a comma ("You see, Say your name..."), never a day / month / a plural of a cast name
      const sentenceStart = k === 0 || /[.!?,;:]["']?$/.test(toks[k - 1]);
      const sing = n.replace(/s$/, "");
      if (sentenceStart || isPlaceName(toks, k) || NOT_NAMES.has(n) || NOT_NAMES.has(sing) || CALENDAR.test(n) || FAMILY[n] || [n, sing].includes(narrator.toLowerCase()) || monster?.words?.includes(n) || people.has(n) || people.has(sing) || TITLE_WORDS.test(word)) return;
      if (lines.some((l) => new RegExp(`(^|[^A-Za-z'])${n}([^A-Za-z']|$)`).test(l))) return;   // also said in lowercase: a word, not a name
      looseNames.add(n);
    });
  });
  // the prop
  const propWords = tokens(idea?.prop ?? "").map(norm);
  const propHead = tokens(String(idea?.prop ?? "").split(/\b(?:from|of|with|that|in|on|for)\b/i)[0]).map(norm);
  // "a roll of tape", "a slice of toast": the thing is what it is a roll / slice of
  const ofThing = (String(idea?.prop ?? "").match(/\b(?:roll|slice|piece|pair|bit|stack|pile|ball|scrap|chunk)\s+of\s+(?:\w+\s+)?(\w+)/i) ?? [])[1];
  const propKey = (ofThing ? norm(ofThing) : null) ?? propHead.at(-1) ?? propWords.at(-1) ?? null;
  // the rule's marker (something above heads)
  const rule = String(idea?.opener ?? lines[0] ?? "");
  const mk = rule.toLowerCase().match(/\b(numbers?|tags?|price|crowns?|stars?|halos?|labels?|scores?|timers?|counters?)\b/);
  const marker = mk ? { on: "all", kind: /crown|halo|star/.test(mk[1]) ? "ring" : /price|tag|label/.test(mk[1]) ? "tag" : "icon", text: (rule.match(/\d+|[$¢€]\S*/) ?? ["?"])[0] } : null;
  return { narrator, people, alias, monster, propKey, marker, looseNames, sign: signText(rule), baseSet: settingToSet(idea?.setting),
    townSet: settingToSet(idea?.setting) === "school" ? "school" : "street" };
}

// ---------------------------------------------------------------- 4. reading one shot
const POSE_RULES = [
  [/^(ran|run|runs|running|rushed|chased|raced|sprinted|fled|bolted)$/, "run"],
  [/^(walked|walk|walks|walking|climbed|climbs|went|marched|crept|tiptoed)$/, "walk"],
  [/^(pointed|points|point|pointing)$/, "point"],
  [/^(sat|sits|sitting)$/, "sit"],
  [/^(froze|hid|hides|shaking|shook|scared|terrified|trembled|cowered|screamed|screams|scream)$/, "scared"],
  [/^(grabbed|grabs|held|holds|carried|carries|brought|keep|keeps|kept|taped|blew|blows|picked|hugged|hugs|lifted|caught)$/, "carry"],
  [/^(waved|waves|wave)$/, "wave"],
  [/^(slept|asleep|sleeps|sleeping)$/, "sleep"],
  [/^(cheered|cheers|won|celebrated|danced)$/, "cheer"],
  [/^(said|says|whispered|whispers|told|tells|yelled|yells|shouted|asked|sneezed|sang|talks|talk|talked|called|sign)$/, "talk"],
];
const NEG = /^(never|nobody|no|not|cant|dont|doesnt|didnt|wont|isnt|wasnt)$/;

function poseFrom(toks, from, world) {
  for (let k = from; k < toks.length && k < from + 4; k++) {
    const n = norm(toks[k]);
    if (/^(looked|look|looks|stared|staring|glanced)$/.test(n) && norm(toks[k + 1] ?? "") === "up") return { pose: "look_up" };
    const rule = POSE_RULES.find(([re]) => re.test(n));
    if (!rule) { if (/[.!?]$/.test(toks[k]) && k > from) break; continue; }
    const neg = toks.slice(Math.max(from, k - 3), k).some((t) => NEG.test(norm(t)));
    if (neg) return { pose: "stand", neg: rule[1] };
    if (rule[1] === "carry") {
      const noun = headNoun(toks, k + 1);
      if (!noun) return { pose: "stand" };
      if (world.people.has(noun) || world.alias[noun]) { const id = world.alias[noun] ?? noun; return { pose: "carry", hold: world.people.get(id)?.baby ? id : null, carries: id }; }
      if (/^(breath|time|look|turn|step|chance|nap|seat|deep)$/.test(noun)) return { pose: "stand" };
      return { pose: "carry", hold: noun };
    }
    return { pose: rule[1] };
  }
  return { pose: "stand" };
}

const EXPR_RULES = [
  [/\b(scared|afraid|froze|terrified|shaking|trembl\w*|panic\w*)\b/, "scared"],
  [/\b(cried|cry|crying|tears|sobbed)\b/, "cry"],
  [/\b(scream\w*|yell\w*|shout\w*|car alarm)\b/, "surprised"],
  [/\b(whisper\w*|quiet\w*|shh|silent|sign language|mime|secret)\b/, "shush"],
  [/\b(angry|mad|furious|glared)\b/, "angry"],
  [/\b(surprised|wow|gasped|remembered|realized)\b/, "surprised"],
  [/\b(laughed|smiled|smiling|happy|best friend|love|loved|party|parties)\b/, "happy"],
  [/\b(asleep|sleep\w*|tired|yawn\w*)\b/, "sleepy"],
  [/\b(won|cheer\w*|hooray)\b/, "excited"],
];
function exprFor(text, part, mood, id, pose, neg, monsterNear) {
  const low = text.toLowerCase();
  if (neg === "talk") return "shush";
  if (neg) return "sad";
  if (pose === "scared") return id === "me" || !/scream/.test(low) ? "scared" : "surprised";
  if (pose === "sleep") return "sleepy";
  if (pose === "cheer") return "excited";
  const hit = EXPR_RULES.find(([re]) => re.test(low));
  const negated = /\b(never|nobody|not|no)\b/.test(low);
  if (hit) return negated && (hit[1] === "happy" || hit[1] === "excited") ? "sad" : hit[1];
  if (monsterNear) return id === "me" && part === "climax" ? "angry" : "scared";
  const light = mood === "funny" || mood === "wholesome";
  return ({ rule: "neutral", tour: light ? "happy" : "neutral", me: id === "me" ? "smirk" : "happy", until: "scared", discovery: "surprised", climax: id === "me" ? "excited" : "surprised", closer: "happy" })[part] ?? "neutral";
}

const GROUP_RE = /\b(everyone|everybody|whole town|people|neighbou?rs|kids|we all|all of us|crowd|team|parties|town yelled)\b|(^|[.!?,]\s*|\bso\s+)nobody\b/i;
const PLACE_RE = /\b(every (window|house|light|door|street)|lights?|windows?|houses|the town)\b/i;
const ME_RE = /^(i|me|my|im|id|ive|ill|myself|mine)$/;

/** Who is in a segment: [{ id, k (token index), possessive }], plus the group flag. */
function whoIn(seg, world, ctx, refOf = () => undefined) {
  const toks = seg.toks.map((t) => t.raw);
  const found = [];
  const push = (id, k, possessive) => { if (!found.some((f) => f.id === id)) found.push({ id, k, possessive }); };
  for (let k = 0; k < toks.length; k++) {
    const raw = toks[k], n = norm(raw), poss = /'s[,.!?]*$/i.test(raw) && !/^(it|that|he|she|there|here|what|who|let)'s/i.test(raw);
    const base = poss ? norm(raw.replace(/'s[,.!?]*$/i, "")) : n;
    const title = raw.match(new RegExp(`^(${TITLES_SRC})\\.?$`));
    if (title && /^[A-Z]/.test(toks[k + 1] ?? "")) {
      const id = norm(toks[k + 1]).replace(/s$/, (m) => (world.people.has(norm(toks[k + 1])) ? m : ""));
      if (world.people.has(id) || world.people.has(norm(toks[k + 1]))) { push(world.people.has(id) ? id : norm(toks[k + 1]), k, /'s/.test(toks[k + 1])); k++; continue; }
    }
    if (ME_RE.test(n) || base === norm(world.narrator)) { push("me", k, false); continue; }
    if (FAMILY[base]) {
      const prevNorm = norm(toks[k - 1] ?? "");
      if (FAMILY[prevNorm] === "baby" && /^(sister|brother)$/.test(base)) continue; // "baby sister" counted once
      const id = world.alias[FAMILY[base]] ?? FAMILY[base];
      if (!/^(baby)$/.test(id) || world.alias.baby || /^(my|our|the|a)$/.test(prevNorm)) { push(id, k, poss); ctx.last = id; }
      continue;
    }
    if (world.people.has(base) && base !== "me") { push(base, k, poss); ctx.last = base; continue; }
    // he / she / him / her: the subject resolver's person (lib/subjects.js: gender + recency), else the last person named
    const ref = /^(he|she|him|her|his)$/.test(n) ? refOf(seg.toks[k]) : undefined;
    if (ref) { if (n !== "his") push(ref, k, false); ctx.last = ref; ctx.lastLine = seg.line; continue; }
    if (/^(he|she|him|her|they)$/.test(n) && ctx.last && ctx.lastLine >= seg.line - 2) { push(ctx.last, k, false); continue; }
    if (/^(we|us)$/.test(n)) { push("me", k, false); if (ctx.last && ctx.lastLine >= seg.line - 2) push(ctx.last, k, false); continue; }
  }
  if (found.some((f) => f.id !== "me")) { ctx.last = found.filter((f) => f.id !== "me").at(-1).id; ctx.lastLine = seg.line; }
  const low = seg.text.toLowerCase();
  return { found, group: GROUP_RE.test(low), place: PLACE_RE.test(low) };
}

function monsterIn(seg, world, ctx, lineIdx, partInfo, sj = null) {
  const M = world.monster;
  if (!M) return null;
  const low = seg.text.toLowerCase(), n = seg.toks.map((t) => t.n);
  // the subject resolver says the shot is about the monster ("It turned away...", "Still looking for Barnaby.")
  const forced = sj?.id === "monster" || (sj?.with ?? []).includes("monster");
  const named = forced || n.some((w) => (M.keys ?? [M.key]).some((k) => w.startsWith(k))) || MONSTER_WORDS.test(low) || (seg.part !== "rule" && seg.part !== "tour" && /\bsomething\b/.test(low));
  const lair = M.lair && n.includes(M.lair);
  const active = ctx.monsterLine != null && seg.line - ctx.monsterLine <= 4;
  // "it" is the monster only when the resolver doesn't say it is a thing ("Everyone knew that whistle. It meant help.")
  const itSubject = active && !(sj?.kind === "thing" && /^it=/.test(sj.via ?? "")) && /(^|[.!?,]\s*|\band\s+|\bthen\s+)it\b(?!'s)/i.test(seg.text);
  const body = active && seg.part !== "rule" && /\b(arms|legs|head|eyes|ear|ears|claws|teeth|fingers|fur|shaped like)\b/.test(low);
  const fragment = active && ctx.prevMonster && !seg.toks.some((t) => ME_RE.test(t.n)) && /^(still|any|and still|just|long|no|nothing)\b/i.test(seg.text);
  if (!(named || lair || itSubject || body || fragment)) return null;
  ctx.monsterLine = seg.line;
  if (sj?.id === "monster" && sj.absent) return { spot: "far", state: "flee", absent: true };
  if (seg.part === "closer" &&/\b(never came back|gone|never again|left)\b/.test(low)) return { spot: "far", state: "flee", absent: true };
  const flee = /\b(turned away|away|past me|over the hill|looking for|ran off|left|fled|gone|followed)\b/.test(low);
  let state;
  if (seg.part === "rule" || seg.part === "tour" || seg.part === "me") state = /\b(comes? down|climbs? down|comes for|coming)\b/.test(low) ? "reach" : "lurk";
  else if (seg.part === "until") {
    const pos = partInfo.until ? (lineIdx - partInfo.until[0]) / Math.max(1, partInfo.until[1] - partInfo.until[0]) : 1;
    state = /\b(unfolded|appeared|rose|emerged|arms|legs|head|shaped like|faster|toward|towards|closer|climbed down|reached|coming)\b/.test(low) || pos >= 0.5 ? "reach" : "lurk";
    if (lair && !named && !itSubject && state === "lurk") state = "lurk";
  } else if (seg.part === "discovery") state = "reveal";
  else state = flee ? "flee" : "reveal";
  if (seg.part === "closer") state = "flee";
  let spot = state === "lurk" || state === "flee" ? "far" : "back";
  // leaving past someone ("It walked right past me"): close enough to share the frame with them
  if (state === "flee" && (sj?.with ?? []).some((id) => id !== "monster")) spot = "back";
  // a monster that lives in a tower (the street and woods sets have one, spot "tower") is shown up on it while it lurks
  // there and while it comes down from it
  if (/\btower\b/.test(M.lairPhrase ?? "") && (state === "lurk" || state === "reach") && (lair || /\b(top of it|unfolded|ladder|climbed down|comes? down)\b/.test(low) || (state === "lurk" && (seg.part === "rule" || seg.part === "tour")))) spot = "tower";
  return { spot, state, lairOnly: lair && !named && !itSubject && !body };
}

function setFor(seg, world, ctx, persons, opts = {}) {
  const low = seg.text.toLowerCase();
  let hit = null, at = -1;
  for (const [set, re] of Object.entries(SET_WORDS)) {
    const g = new RegExp(re.source, "g");
    for (const m of low.matchAll(g)) if (m.index > at) { at = m.index; hit = set; }
  }
  // a baby on screen and no place named: the baby's room
  if (!hit && persons.some((p) => world.people.get(p)?.baby) && seg.part !== "climax") hit = "bedroom";
  const indoor = (s) => s === "bedroom" || s === "school";
  // the monster is never indoors (it is ~4.5 m tall): its shots cut to the last outdoor set without moving the story
  if (opts.monster && indoor(hit ?? ctx.set)) return { set: ctx.outdoor, moved: ctx.set !== ctx.outdoor, passing: true };
  // "past the school", "every window went dark": a cutaway that doesn't move the story
  const passing = hit && (/\bpast the\b/.test(low) || /^past the\b/i.test(seg.lineText ?? "") || opts.place);
  if (!hit) return { set: ctx.set, moved: false };
  if (passing) return { set: hit, moved: hit !== ctx.set, passing: true };
  const moved = hit !== ctx.set;
  ctx.set = hit;
  if (!indoor(hit)) ctx.outdoor = hit;
  return { set: hit, moved };
}

// ---------------------------------------------------------------- 5. cameras
function pickCamera(prefs, hist, seg, focus, actorsN, monster) {
  const ok = (c) => {
    if (c === "insert" && !seg.insert) return false;
    if (c === "over_shoulder" && actorsN < 2 && !(monster && actorsN >= 1)) return false;
    const [a, b] = [hist.at(-1), hist.at(-2)];
    if (a && b && a.camera === c && b.camera === c) return false;            // never 3 in a row
    if (a && a.camera === c && a.focus === focus && a.set === seg.set) return false; // a jump cut
    if (a && a.line === seg.line && a.camera === c) return false;            // a split line changes camera
    return true;
  };
  // three or more people (a crowd yelling, a row of cribs) never get a closeup: nobody would be in it
  const list = [...prefs, "medium", "closeup", "wide", "low", "over_shoulder"].filter((c) => !(c === "closeup" && actorsN >= 3));
  return list.find(ok) ?? "medium";
}

// ---------------------------------------------------------------- 6. the plan
export function planVideo({ script, words, idea = {}, lengthSec = null, direction = null, exists = null } = {}) {
  if (!script?.lines?.length) throw new Error("planVideo: script.lines is empty");
  idea ??= {};
  const W = Array.isArray(words) && words.length ? words : estimateWords(script);
  const duration = r3(W.at(-1).end + PACE.tail);
  const lines = timeLines(script, W, duration);
  const segs = mergeShort(lines.flatMap(splitLine));
  const world = readWorld(script, idea);
  const title = script.title ?? idea.title ?? "Untitled";
  const mood = idea.mood ?? "horror";
  // the story director's production list (lib/direction.js): when given, it is the source of truth for worlds, giants,
  // crowds, the line's items, its camera beat and its light; a monster the list makes an EPIC giant is that giant
  const D = direction?.production ? readDirection(direction, { script, idea, mood, exists }) : null;
  if (D && world.monster) {
    const epicWords = new Set([...Object.values(D.giants).flatMap((g) => [g.kind, ...g.aliases]), ...[...D.worldCreature.values()].map((w) => w.species)]);
    if ((world.monster.keys ?? [world.monster.key]).some((k) => epicWords.has(k)) || (world.monster.species && epicWords.has(world.monster.species))) world.monster = null;
  }
  // the EPIC giants are characters: "he" / "she" can be the Big Bad Wolf (lib/subjects.js beings)
  if (D) world.beings = [...new Set(Object.values(D.giants).flatMap((g) => [g.kind, ...g.aliases]).filter((w) => !/s$/.test(w) || w.endsWith("ss")))];

  const partRange = {};
  script.lines.forEach((l, i) => { partRange[l.part] = partRange[l.part] ? [partRange[l.part][0], i] : [i, i]; });
  const lateNight = script.lines.some((l, i) => i >= (partRange.until?.[0] ?? Infinity) && l.part !== "closer" && NIGHT_WORDS.test(l.text.toLowerCase()));
  const nightFrom = (mood === "horror" || lateNight) && partRange.until ? partRange.until[0] : Infinity;

  const ctx = { set: world.baseSet, outdoor: ["street", "woods"].includes(world.baseSet) ? world.baseSet : "street", last: null, lastLine: -9, monsterLine: null, prevMonster: false };
  const used = new Set(["me"]);
  const hist = [];
  const shots = [];
  const towns = ["town1", "town2", "town3"];
  const vw = visualWorld(world);
  const names = nameBook(world, title);
  const lineKeys = lines.map((L) => extractKeys(L.text, vw));
  const family = new Set(lines.flatMap((L) => tokens(L.text).map((w) => FAMILY[norm(w.replace(/'s\W*$/i, ""))])).filter(Boolean));
  // who each line (each sentence) is about: lib/subjects.js, one story context for the whole script
  const gender = genderMap(world);
  const lineSubj = subjectsFor(lines, vw, gender);
  const refOf = (t) => (t ? lineSubj[t.line]?.refs[t.k] : undefined);

  segs.forEach((seg, si) => {
    const low = seg.text.toLowerCase();
    const sj = segSubject(seg, lineSubj);
    const who = whoIn(seg, world, ctx, refOf);
    const monsterState = monsterIn(seg, world, ctx, seg.line, partRange, sj);
    ctx.prevMonster = !!monsterState;
    const ms = monsterState && !monsterState.absent ? { spot: monsterState.spot, state: monsterState.state } : null;
    const keys = extractKeys(seg.text, vw);
    const objKeys = keys.filter((k) => k.kind === "rule" && ruleById(k.rule).object && !k.neg);
    const personKeys = keys.filter((k) => k.kind === "person" && !k.poss && k.id !== "me");
    // the object is the point of the line ("Now the bakery's for sale.", "Even the ice cream truck plays its song in mime.")
    const pointRule = !ms && !personKeys.length ? objKeys.map((k) => ruleById(k.rule)).find((r) => r.point) ?? null : null;
    const actorIds = who.found.filter((f) => !f.possessive).map((f) => f.id);
    const placeShot = (who.place && !actorIds.length) || !!monsterState?.absent;
    let { set, moved, passing } = setFor(seg, world, ctx, actorIds, { place: placeShot, monster: !!ms });
    // the townsfolk as a crowd live in the town: a group line with no place named cuts there (without moving the story)
    if (who.group && !actorIds.length && !ms && set !== world.townSet && !Object.values(SET_WORDS).some((re) => re.test(low))) { moved = true; passing = true; set = world.townSet; }
    seg.set = set; seg.passing = passing;

    // light
    const light = seg.part === "closer" ? (/\b(night|nights|tonight|midnight|dark)\b/.test(low) ? "night" : "warm") : seg.line >= nightFrom || NIGHT_WORDS.test(low) ? "night" : "day";

    // inserts
    let insert = null;
    // the video opens on the rule sign, when line 1 has room for it and a real shot after it (or the sign says it all)
    if (si === 0 && (seg.subs > 1 || keys.every((k) => world.sign.includes(String(k.label).toUpperCase())))) insert = { kind: "sign", text: world.sign };
    else if (/\b(sign|note|letter|poster|list|notice|newspaper)\b/.test(low) && !/sign language/.test(low)) {
      const says = seg.text.match(/\b(?:says|said|reads|read)\s+["']?([^"'.!?]+)/i);
      insert = { kind: /\b(note|letter|list)\b/.test(low) ? "note" : "sign", text: (says ? says[1] : seg.text.replace(/^(past|and|then|now)\s+/i, "")).replace(/[^A-Za-z0-9' ]/g, " ").trim().split(/\s+/).slice(0, 6).join(" ").toUpperCase() };
    } else if (/\bfor sale\b/.test(low) && !objKeys.length) insert = { kind: "sign", text: "FOR SALE" };
    else if (/\bclosed\b/.test(low) && !objKeys.length) insert = { kind: "sign", text: "CLOSED" };
    seg.insert = insert;

    // actors
    const R = (salt) => hashSeed(`${title}:${si}:${salt}`);
    let actors = [];
    const carried = new Set();
    for (const f of who.found) {
      if (f.possessive && !(f.id === "me" && actorIds.length <= 1 && actorIds.includes("me"))) continue;
      const pz = poseFrom(seg.toks.map((t) => t.raw), f.k + 1, world);
      if (pz.carries) carried.add(pz.carries);
      actors.push({ id: f.id, pose: pz.pose, hold: pz.hold ?? null, neg: pz.neg });
    }
    // "my X" with nobody else: the narrator is in the shot
    if (!actors.length && who.found.some((f) => f.id === "me")) actors.push({ id: "me", pose: "stand", hold: null });
    actors = actors.filter((a) => !carried.has(a.id));
    // a crowd object (the football field's bleachers) brings its own people: no townsfolk in front of it
    const groupShot = who.group && !insert && !(pointRule && !pointRule.guests);
    if (groupShot) {
      const wantMe = /\b(we|us|our|all of us|with me)\b/.test(low) && !actors.some((a) => a.id === "me");
      if (wantMe) actors.unshift({ id: "me", pose: "stand", hold: null });
      const nTown = 2 + (R("n") % 2);
      const gp = poseFrom(seg.toks.map((t) => t.raw), 0, world);
      const groupPose = /yell|shout/.test(low) ? "cheer" : /sign language/.test(low) ? "wave" : gp.pose === "carry" ? "stand" : gp.pose;
      for (let k = 0; k < nTown && actors.length < 4; k++) actors.push({ id: towns[k], pose: groupPose, hold: null, neg: gp.neg });
      actors.forEach((a) => { if (a.id === "me" && a.pose === "stand") a.pose = groupPose; });
    }
    // prop planted / paid off: the narrator holds it
    if (world.propKey && seg.toks.some((t) => t.n === world.propKey) && /\b(keep|kept|have|had|blew|blow|held|hold|pulled|took|grabbed|gave|found)\b/.test(low)) {
      const me = actors.find((a) => a.id === "me") ?? (actors.unshift({ id: "me", pose: "carry", hold: world.propKey }), actors[0]);
      me.pose = "carry"; me.hold = world.propKey;
    }
    // a fragment with nobody named ("Not on purpose.", "Barnaby! Barnaby!"): the people of the shot before carry on
    const prev = shots.at(-1);
    let carryOver = null, fallbackTown = false;
    // ...but a new thing or place on another line is its own shot ("The rain never stops on our street." is not the kid
    // from the line before), unless the runner of the shot before runs on past it ("Past the bakery.")
    const runsOn = prev?.actors.some((x) => x.pose === "run" || x.pose === "walk") && /^(past|then|and|through|over|across|up|down|into)\b/i.test(seg.text);
    const ownThing = keys.some((k) => k.kind === "noun" || (k.kind === "rule" && ["object", "place", "hold", "people"].includes(ruleById(k.rule).kind)));
    if (!actors.length && !ms && !insert && !placeShot && !keys.some((k) => k.kind === "person" && !(k.poss && k.soft)) && prev?.actors.length && !prev.monsterState && seg.line - prev.line <= 1 && !who.group && (seg.line === prev.line || !ownThing || runsOn)) {
      const gp = poseFrom(seg.toks.map((t) => t.raw), 0, world);
      // a lone fragment after a row of babies in cribs: the one in front carries on (a closer look)
      const from = prev.actors.length >= 3 && (prev.objects ?? []).some((o) => o.name === "crib") && seg.line !== prev.line ? prev.actors.filter((a) => a.spot === "center").slice(0, 1) : prev.actors;
      actors = (from.length ? from : prev.actors.slice(0, 1)).map((a) => ({ id: a.id, pose: gp.pose !== "stand" && gp.pose !== "carry" ? gp.pose : ONE_LINE_POSES.has(a.pose) ? LEGACY_POSE[a.pose] ?? "stand" : a.pose, hold: a.hold, neg: gp.neg }));
      carryOver = { prev, ids: actors.map((a) => a.id) };
    }
    // the subject (and whoever it acts on) is in the shot: "She screamed..." is Bean, "He said..." is Grandpa; a
    // fragment that carried the wrong people over gives way to its subject
    if (sj && !insert) {
      const need = [...(sj.kind === "person" || sj.kind === "narrator" ? [sj.id] : []), ...sj.with.filter((id) => id !== "monster")];
      for (const id of need) {
        if (actors.some((a) => a.id === id) || carried.has(id)) continue;
        if (carryOver && id === sj.id) { actors = []; carryOver = null; }
        const gp = poseFrom(seg.toks.map((t) => t.raw), 0, world);
        const a = { id, pose: id === sj.id && gp.pose !== "carry" ? gp.pose : "stand", hold: null, neg: id === sj.id ? gp.neg : undefined };
        if (id === sj.id) actors.unshift(a); else actors.push(a);
      }
    }
    // the monster alone twice in a row: cut to the kid watching it (threat / face / threat)
    if (ms && !actors.length && prev?.monsterState && !prev.actors.length && ms.state !== "flee") actors.push({ id: "me", pose: ms.state === "lurk" ? "look_up" : "scared", hold: null });
    // nobody named, no group, no monster, no insert: townsfolk doing the line (tour examples), or a place shot
    if (!actors.length && !ms && !insert) {
      if (placeShot || pointRule) actors = [];
      else {
        const gp = poseFrom(seg.toks.map((t) => t.raw), 0, world);
        actors = [0, 1].map((k) => ({ id: towns[k], pose: gp.pose === "carry" ? "stand" : gp.pose, hold: null, neg: gp.neg }));
        fallbackTown = true;
      }
    }
    // a monster close by and only one or no kid: the narrator faces it (the kid tiny at its feet) in the climax
    if (ms && ms.state === "reveal" && seg.part === "climax" && !actors.length) actors.push({ id: "me", pose: "scared", hold: null });
    if (insert) actors = [];
    actors = actors.slice(0, 4);

    // expressions, spots, facing
    const monsterNear = ms && (ms.state === "reach" || ms.state === "reveal");
    const spotsFor = { 1: ["center"], 2: ["left", "right"], 3: ["left", "center", "right"], 4: ["left", "center", "right", "back"] }[actors.length] ?? [];
    const mover = R("dir") % 2 ? "left" : "right";
    actors = actors.map((a, k) => {
      const expr = exprFor(seg.text, seg.part, mood, a.id, a.pose, a.neg, monsterNear);
      let pose = a.pose;
      if (ms && ms.state === "lurk" && pose === "stand" && seg.part !== "rule") pose = "look_up";
      if (monsterNear && pose === "stand") pose = "scared";
      let facing = "camera";
      if (ms) facing = "monster";
      else if (pose === "walk" || pose === "run") facing = mover;
      else if (actors.length === 2 && !who.group) facing = actors[1 - k].id;
      return { id: a.id, spot: spotsFor[k], pose, expr, facing, hold: a.hold ?? null };
    });

    // the visual pass: every key noun / action of this shot gets its object, pose, hold, name tag, window state
    const draft = { set, light, actors, monsterState: ms, insert, objects: [], markers: [], setState: null, part: seg.part, line: seg.line };
    const V = { world, vw, who, ms, seg, keys, lineKeys, lines, names, pointRule, carryOver, fallbackTown, mood, ctx, mover, family, subject: sj,
      sentSubj: (i) => { const t = seg.toks[i]; return t ? lineSubj[t.line]?.sentences.find((x) => t.k >= x.k0 && t.k <= x.k1) ?? null : null; } };
    if (!insert) applyVisuals(draft, V);
    actors = draft.actors;
    actors.forEach((a) => used.add(a.id));
    for (const o of draft.objects) if (o.babies) o.babies.forEach((id) => used.add(id));
    set = draft.set;
    const shotLight = draft.light;

    // focus + camera
    const named = actors.filter((a) => !a.id.startsWith("town"));
    const objectFocus = draft.objects.length && !ms && (draft.point || !named.length);
    let focus = insert ? "insert" : ms && (ms.state !== "lurk" || !actors.length) ? "monster" : objectFocus ? "object" : groupShot || (!named.length && actors.length > 1) ? "group" : actors[0]?.id ?? (ms ? "monster" : "group");
    // the subject is the focus (a person: unless the shot is about the object they are at, which frames them both)
    const subjFocus = insert || !sj?.id ? null : sj.id === "monster" ? (ms ? "monster" : null)
      : (sj.kind === "person" || sj.kind === "narrator") && (actors.some((a) => a.id === sj.id) || actors.some((a) => a.hold === sj.id)) ? sj.id : null;
    if (subjFocus && !(focus === "object" && subjFocus !== "monster")) focus = subjFocus;
    const prefs = [];
    // the monster acting on someone ("It walked right past me"): over the shoulder of the one it passes, the monster featured
    if (subjFocus === "monster" && sj.with.some((id) => actors.some((a) => a.id === id))) prefs.push("over_shoulder");
    const feeling = /\b(love|best friend|secret|remembered|just|not on purpose|real|only|loudest|scared|alone|breath)\b/.test(low);
    if (insert) prefs.push("insert");
    else if (objectFocus) prefs.push(OBJECT_CATALOG[draft.objects[0].name]?.big ? "wide" : "medium", "wide", "medium", "low");
    else if (draft.objects.length && !ms) prefs.push("wide", "medium");
    else if (seg.part === "rule") prefs.push("wide");   // after the sign: the town, establishing
    else if (ms?.state === "reveal") prefs.push(actors.length ? "over_shoulder" : "low", "low", "wide");
    else if (ms?.state === "reach") prefs.push("low", "wide", "over_shoulder");
    else if (ms) prefs.push("wide", "low");
    else if (moved && !seg.passing) prefs.push("wide", "medium");
    else if (groupShot || (!actors.length)) prefs.push("wide", "medium");
    else if (named.length >= 2) prefs.push("over_shoulder", "medium");
    else if (actors[0]?.hold) prefs.push("closeup", "medium");
    else if (named.length === 1 && named[0].id === "me" && (feeling || seg.part === "me" || seg.part === "discovery")) prefs.push("closeup", "medium");
    else if (actors.some((a) => ["walk", "run", "point", "wave", "carry", "cheer"].includes(a.pose))) prefs.push("medium", "wide");
    else if (named.length === 1) prefs.push(seg.part === "until" || seg.part === "climax" ? "closeup" : "medium", "closeup");
    else prefs.push("medium", "wide");
    if (ms?.state === "reveal" && seg.part === "climax" && hist.at(-1)?.camera !== "low") prefs.unshift("low");
    const camera = pickCamera(prefs, hist, seg, focus, actors.length, !!ms);
    if (camera === "low" && ms && !(subjFocus && subjFocus !== "monster")) focus = "monster";
    if (camera === "closeup" && focus === "group") focus = actors.find((a) => a.id === "me")?.id ?? actors[0]?.id ?? "group";
    if (focus === "group" && !actors.length && draft.objects.length) focus = "object";
    hist.push({ camera, focus, set, line: seg.line });

    const inRuleOrTour = seg.part === "rule" || seg.part === "tour";
    const markers = draft.markers.length ? draft.markers : world.marker && inRuleOrTour && actors.length ? [world.marker] : [];
    const shot = {
      start: r3(seg.start), end: r3(seg.end), line: seg.line, lines: seg.lines, part: seg.part, set, light: shotLight, camera, focus,
      actors, monsterState: ms, insert, marker: markers[0] ?? null,
      seed: R("seed") % 1000, text: seg.text,
      subject: sj?.id ?? null,
    };
    if (sj?.with?.length) shot.subjectWith = [...sj.with];
    if (sj?.absent) shot.subjectAbsent = true;
    if (markers.length > 1) shot.markers = markers;
    if (draft.objects.length) shot.objects = draft.objects.map(({ babies, ...o }) => o);
    if (draft.setState) shot.setState = draft.setState;
    shots.push(shot);
  });

  // cast: everyone used, plus 2-3 townsfolk for the group shots
  const buildCast = () => {
    const cast = {};
    for (const id of used) {
      const p = id.startsWith("town") ? { role: "adult", name: names.of(id) } : /^baby\d$/.test(id) ? { role: "baby", name: names.of(id), baby: true } : world.people.get(id) ?? familyPerson(id);
      cast[id] = { role: p.baby ? "baby" : p.role, name: p.name, seed: hashSeed(`${title}:${p.name}:${id}`) % 1000, ...(p.baby ? { baby: true } : {}), ...(p.elder ? { elder: true } : {}) };
    }
    for (const t of towns.slice(0, 2)) if (!cast[t]) cast[t] = { role: "adult", name: names.of(t), seed: hashSeed(`${title}:${names.of(t)}:${t}`) % 1000 };
    return cast;
  };

  // the visual check, then the re-plan of every line still missing a noun: a catalog visual, else a picture card
  fixVisuals(shots, lines, vw, buildCast, { used, names, W });
  // the subject check, then the re-plan of every shot whose subject is off screen / not the focus; the framing touches
  // may move a focus, so the check runs again after them (and the noun check once more: a subject fix only adds, but a
  // monster moved outdoors leaves its crib behind)
  const keysOfShot = (s) => (s.lines ?? [s.line]).flatMap((i) => lineKeys[i]);
  const subjAux = { used, names, W, world, vw, family, buildCast, keysOfShot, loose: new Set(world.looseNames) };
  fixSubjects(shots, subjAux);
  for (const s of shots) if (s.marker === undefined) s.marker = null;
  framingPass(shots, buildCast());
  fixSubjects(shots, subjAux);
  fixVisuals(shots, lines, vw, buildCast, { used, names, W });
  framingPass(shots, buildCast());
  fixSubjects(shots, subjAux);
  for (const s of shots) if (s.marker === undefined) s.marker = null;
  // the director's production list over the plan (lib/direction.js): worlds, giants, crowds, beats, EPIC cameras, light;
  // then the picture cards those now show give their time back, the word + subject checks run again, and every line's
  // required item that is still missing is re-planned (its system, else a picture card of it)
  let production = null, prodFixes = [];
  const tlStub = { shots, worlds: undefined, giants: undefined };
  if (D) {
    const split = (list, i, t) => splitShot(list, i, t, W);
    directShots(tlStub, D, { lines, W, used, recam, split, objectAliases: (n) => OBJECT_CATALOG[n]?.aliases ?? [] });
    directActions(shots, D, lineKeys, buildCast, used); // GAPS: the line's action (hug, climb, ride...) and the animals' motions
    dropCoveredCards(shots, lineKeys, buildCast);
    fixVisuals(shots, lines, vw, buildCast, { used, names, W });
    fixSubjects(shots, subjAux);
    production = compactProduction(D);
    tlStub.production = production; tlStub.lines = lines.map((L) => ({ text: L.text }));
    const cardFn = (list, li, card, r) => {
      const L = lines[li];
      const lineShots = list.filter((s) => (s.lines ?? [s.line]).includes(li));
      const need = r?.needId ? D.match.builderNeeds.find((n) => n.id === r.needId) : null;
      // the middle of the line first, then its start, then its end (a word start with room for both pieces)
      return [0.5, 0.15, 0.85].some((f) => cardShot(list, list.filter((s) => (s.lines ?? [s.line]).includes(li)), { kind: "director", label: r?.name ?? card.text }, L.start + (L.end - L.start) * f, L, card, need));
    };
    const badgeFn = (s, card) => {
      if (!s) return false;
      if (!s.actors?.length) { const t = ["town1", "town2", "town3"][0]; s.actors = [{ id: t, spot: "center", pose: "point", expr: "surprised", facing: "camera", hold: null }]; used.add(t); if (!["group", "object"].includes(s.focus) && !/^(giant:|crowd|world)/.test(s.focus ?? "") && s.focus !== "monster") s.focus = t; } const text = `${card.icon} ${badgeWord(card.text)}`; if (!markersList(s).some((m) => m.text === text)) setMarkers(s, [...markersList(s), { on: s.actors[0].id, kind: "icon", text }]); return true; };
    prodFixes = fixProduction(tlStub, D, { used, card: cardFn, badge: badgeFn, isObject: (n) => !!OBJECT_CATALOG[n], stateOf: (r) => (r.kind === "event" && OBJECT_CATALOG[r.kitName]?.states?.includes(D.calls.get(r.id)?.state) ? D.calls.get(r.id).state : null) });
    fixSubjects(shots, subjAux);
    fixVisuals(shots, lines, vw, buildCast, { used, names, W });
    epicVariety(shots, recam);
    for (const s of shots) if (s.marker === undefined) s.marker = null;
  }
  // the video opens wide (or on the rule sign, or an EPIC establishing shot)
  if (!["wide", "insert", ...(D ? ["establish", "aerial"] : [])].includes(shots[0].camera)) {
    shots[0].camera = "wide";
    if (shots[1]?.camera === "wide" && shots[2]?.camera === "wide") shots[1].camera = recam(shots, 1, "wide");
  }
  if (D) epicVariety(shots, recam);
  const cast = buildCast();
  // what each shot shows of its lines' key nouns / actions (for the check and the report; the engine ignores it)
  for (const s of shots) {
    const ks = (s.lines ?? [s.line]).flatMap((i) => requiredKeys(lineKeys[i]));
    s.visuals = [...new Set(ks.filter((k) => covers(k, s, cast)).map((k) => k.label))];
  }

  const tl = {
    version: 1, fps: 24, width: 1080, height: 1920, duration, title, lengthSec,
    cast,
    monster: world.monster ? { type: world.monster.type, name: world.monster.name, glow: world.monster.glow, ...(world.monster.variant ? { variant: world.monster.variant, ...(world.monster.species ? { species: world.monster.species } : {}) } : {}), ...(world.monster.lairPhrase ? { lair: world.monster.lairPhrase } : {}) } : null,
    shots,
    captions: W.map((w) => ({ word: w.word, start: r3(w.start), end: r3(w.end) })),
    audio: { voice: "voice.wav", music: "music.wav" },
    lines: lines.map((L, i) => ({ part: L.part, text: L.text, start: r3(L.start), end: r3(L.end), subject: lineSubj[i].id ?? null })),
    visualWorld: { narrator: world.narrator, people: Object.fromEntries([...world.people].filter(([id]) => id !== "me").map(([id, p]) => [id, p.name])), alias: world.alias, monster: vw.monster, looseNames: [...world.looseNames], prop: world.propKey, gender, ...(world.beings?.length ? { beings: world.beings } : {}) },
  };
  // the report's subject column: who each of the line's shots is about (cards and signs left out)
  const label = (id) => subjectLabel(id, { cast, monsterName: world.monster?.name });
  const subjCol = (i) => [...new Set(shots.filter((s) => (s.lines ?? [s.line]).includes(i) && s.camera !== "insert").map((s) => `${label(s.subject)}${s.subjectAbsent ? " (gone)" : ""}`))].join(" / ") || label(lineSubj[i].id);
  tl.visualReport = lineReport(shots, lines, vw, cast).map((r) => ({ line: r.line, text: r.text, subject: subjCol(r.line), nouns: r.keys.map((k) => k.label), shows: r.shows, ok: !r.missing.length, ...(r.missing.length ? { missing: r.missing.map((k) => k.label) } : {}) }));
  if (D) {
    if (tlStub.worlds) tl.worlds = tlStub.worlds;
    if (tlStub.giants) tl.giants = tlStub.giants;
    tl.production = production;
    tl.direction = { provider: D.provider, mock: D.mock, notes: D.notes, fixes: prodFixes, gaps: D.match.gaps.length, summary: D.match.summary };
  }
  tl.needs = collectNeeds(tl, script, idea, world.baseSet, mood, D);
  return tl;
}

/** Splits shot i at the word start nearest t (both halves >= minShot). Returns true when it did. */
function splitShot(shots, i, t, W) {
  const s = shots[i];
  const starts = W.map((w) => w.start).filter((c) => c >= s.start + PACE.minShot - 1e-9 && c <= s.end - PACE.minShot + 1e-9);
  if (!starts.length) return false;
  const c = r3(starts.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), starts[0]));
  const a = JSON.parse(JSON.stringify(s)), b = JSON.parse(JSON.stringify(s));
  a.end = c; b.start = c; b.seed = (s.seed + 7) % 1000;
  shots.splice(i, 1, a, b);
  return true;
}

/**
 * A picture card whose noun another shot of its line now shows (an EPIC army, the creature world's shell) gives its time
 * back to its neighbour of the same line (the card was the stand-in; the real thing is on screen).
 */
function dropCoveredCards(shots, lineKeys, buildCast) {
  const cast = buildCast();
  for (let i = shots.length - 1; i >= 0; i--) {
    const c = shots[i];
    if (c.camera !== "insert" || c.insert?.kind !== "card" || !(c.visuals ?? []).length) continue;
    const mine = shots.filter((s) => s !== c && s.camera !== "insert" && (s.lines ?? [s.line]).includes(c.line));
    const keys = (c.visuals ?? []).map((lab) => (lineKeys[c.line] ?? []).find((k) => k.label === lab)).filter(Boolean);
    if (!mine.length || keys.length !== c.visuals.length || !keys.every((k) => mine.some((s) => covers(k, s, cast)))) continue;
    const nb = [shots[i - 1], shots[i + 1]].find((s) => s && s.camera !== "insert" && s.line === c.line);
    if (!nb) continue;
    nb.start = Math.min(nb.start, c.start); nb.end = Math.max(nb.end, c.end);
    shots.splice(i, 1);
  }
}

/**
 * What the builder (lib/builder/resolve.js) is asked to make for this video (the protocol's rule: a missing kit object or
 * world never fails a run). The plan is complete and checked WITHOUT them (cards, the nearest of the 4 sets); a need
 * that gets built replaces its stand-in in lib/builder/apply.js, and the checks run again.
 *   { id, kind: "object" | "world", name, phrase, line, lineText, mood, fallbackSet }
 * Objects: every picture card cut for a noun (shot.need = the need's id). Worlds: a setting none of the 4 sets fits
 * (worldNeedOf); every shot on the base set carries shot.world = the need's id.
 */
function collectNeeds(tl, script, idea, baseSet, mood, D = null) {
  const needs = [], byName = new Map();
  const add = (n) => { const k = `${n.kind}|${n.name}`; if (byName.has(k)) return byName.get(k); const id = `need${needs.length + 1}`; const x = { id, ...n }; needs.push(x); byName.set(k, x); return x; };
  for (const s of tl.shots) {
    if (!s.need || typeof s.need !== "object") continue;
    const { name, label, host, kind, ...extra } = s.need;
    const n = add({ kind: "object", name, phrase: label, line: s.line, lineText: script.lines[s.line]?.text ?? s.text ?? "", mood, fallbackSet: isCreatureSet(s) ? (s.worldBase ?? "street") : s.set, ...extra });
    s.need = { id: n.id, host };
  }
  if (D) {
    // the director decides the worlds: a world routed to the builder (a place no set or EPIC world can make) is a need
    // for every shot of its lines still on the fallback set
    for (const L of D.lines) {
      const c = L.worldCall;
      if (c?.route !== "builder" || !c.needId) continue;
      const dn = D.match.builderNeeds.find((x) => x.id === c.needId);
      if (!dn) continue;
      const n = add({ kind: "world", name: dn.name, phrase: dn.phrase, line: dn.line, lineText: dn.lineText, mood, fallbackSet: dn.fallbackSet, source: "director", item: dn.item, ...(dn.hint ? { hint: dn.hint } : {}), setting: idea?.setting ?? null });
      for (const s of tl.shots) if (s.line === L.i && (s.set === c.set || s.set === dn.fallbackSet)) s.world = n.id;
    }
    return needs;
  }
  const w = worldNeedOf(script, idea);
  if (w) {
    const n = add({ kind: "world", name: w.name, phrase: w.phrase, line: 0, lineText: script.lines[0]?.text ?? "", mood, fallbackSet: baseSet, setting: idea?.setting ?? null });
    for (const s of tl.shots) if (s.set === baseSet) s.world = n.id; // inserts too: the card / sign stands in the world
  }
  return needs;
}

// the settings the 4 hand-built sets show well (lib formulas' settings + common words); anything else is a built world
const SET_FITS = /\b(suburb|street|streets|town square|square|snowy town|neighbou?rhood|village|downtown|main street|road|park|house|home|bedroom|kitchen|living room|attic|basement|apartment|school|classroom|hallway|cafeteria|stage|gym|woods?|forest|farm|canyon|cliff|mountain|trail|castle|town|city)\b/;
const WORLD_WORDS = /\b(inside (?:of )?(?:a|an|the) [a-z' -]{3,40}|on the moon|on mars|in (?:outer )?space|under(?:neath)? the (?:sea|ocean|lake)|underwater|under ?ground|in a cave|in the clouds|on a cloud)\b/;
/**
 * The world a video needs built, or null when one of the 4 sets fits: { name, phrase }. Read from the idea's setting,
 * and, for the "inside something giant" / unknown settings, the opener or premise ("we all live inside a giant turtle").
 */
export function worldNeedOf(script, idea = {}) {
  const setting = String(idea?.setting ?? "").toLowerCase().trim();
  const text = [script?.lines?.[0]?.text, idea?.opener, idea?.premise].filter(Boolean).join(" ").toLowerCase();
  const said = (() => {
    const m = text.match(WORLD_WORDS);
    if (!m) return null;
    let p = m[1].replace(/\b(that|which|where|who|when|and|but|so|because|with|everyone|everybody|people)\b.*$/, "").replace(/[^a-z' -]/g, " ").replace(/\s+/g, " ").trim();
    p = p.split(" ").slice(0, 5).join(" ");
    return p.length > 6 ? p : null;
  })();
  if (/inside something giant/.test(setting)) return said && /^inside/.test(said) ? { name: said, phrase: said } : null;
  if (/underwater|submarine/.test(setting)) return { name: said && !/^inside/.test(said) ? said : "underwater town", phrase: setting };
  if (/underground|cave/.test(setting)) return { name: "cave town", phrase: setting };
  if (setting && !SET_FITS.test(setting)) return { name: setting.replace(/[^a-z' -]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40), phrase: setting };
  if (!setting && said) return { name: said, phrase: said };
  return null;
}

/**
 * The last framing touches, from the first object render (2026-11-04): a kid at the school photo sits on its stool
 * (same spot, pose sit); several objects in one shot (three cribs) need a wide shot; an adult carrying a baby is
 * filmed medium on the carrier, so the baby in the arms reads.
 */
function framingPass(shots, cast) {
  shots.forEach((s, i) => {
    const objs = s.objects ?? [];
    const photo = objs.find((o) => o.name === "photo_set");
    if (photo) {
      const kid = (s.actors ?? []).find((a) => cast[a.id]?.role === "kid") ?? s.actors?.[0];
      if (kid && ["stand", "talk"].includes(kid.pose)) { kid.spot = photo.spot; kid.pose = "sit"; kid.facing = "camera"; }
    }
    // a seat in the shot and a line about sitting in / on it: its person sits on it (kit/things.js chair, couch: "seat")
    const seat = objs.find((o) => o.name === "chair" || o.name === "couch");
    if (seat && /\b(sit\w*|sat|seated|in (?:his|her|my|their|the|a|your) (?:own )?(?:chair|seat)|on (?:the|a|his|her|my|their) (?:chair|throne|couch|sofa|cushions?|stool|bench))\b/i.test(s.text ?? "")) {
      const who = (s.actors ?? []).find((a) => a.id === s.subject && !a.inCrib) ?? (s.actors ?? []).find((a) => cast[a.id]?.role !== "baby");
      if (who && ["stand", "talk", "sit"].includes(who.pose)) {
        const other = (s.actors ?? []).find((a) => a !== who && a.spot === seat.spot);
        if (other) other.spot = who.spot;
        who.spot = seat.spot; who.pose = "sit"; who.facing = "camera";
      }
    }
    // (not when it would make three wides in a row: the variety rule)
    const wideAround = (shots[i - 1]?.camera === "wide" && (shots[i - 2]?.camera === "wide" || shots[i + 1]?.camera === "wide")) || (shots[i + 1]?.camera === "wide" && shots[i + 2]?.camera === "wide");
    if (objs.length > 1 && s.camera !== "insert" && !wideAround) s.camera = "wide";
    // an object in the shot next to the person it's about (the coverage stills, 2026-11-04: a medium on the person left a
    // hat on its crate out of frame): a wide shot fits them both; with no room for another wide, the object is the focus
    // (a person subject may share the frame with the object they are at)
    else if (objs.length && s.camera !== "insert" && s.camera !== "wide" && s.focus !== "object" && s.focus !== "monster" && !objs.some((o) => o.name === "crib" || o.name === "photo_set") && s.actors?.length) {
      if (!wideAround) s.camera = "wide";
      else s.focus = "object";
    }
    const carrier = (s.actors ?? []).find((a) => a.hold && cast[a.hold]?.role === "baby");
    if (carrier && s.camera === "wide" && !objs.length) { s.camera = "medium"; s.focus = carrier.id; }
  });
}

function familyPerson(id) {
  const adult = /^(mom|dad|grandma|grandpa)$/.test(id);
  return { role: adult ? "adult" : "kid", name: id[0].toUpperCase() + id.slice(1), baby: id === "baby" || undefined, elder: /^grand/.test(id) || undefined };
}

// ---------------------------------------------------------------- 6b. the visual pass (lib/visuals.js)
/** What the dictionary reads names against (see lib/visuals.js extractKeys). */
function visualWorld(world) {
  return {
    people: new Map([...world.people].filter(([id]) => id !== "me").map(([id, p]) => [id, { name: p.name, baby: !!p.baby }])),
    alias: world.alias ?? {}, narrator: world.narrator,
    monster: world.monster ? { key: world.monster.key, keys: world.monster.keys ?? [world.monster.key], words: world.monster.words ?? [world.monster.key], name: world.monster.name } : null,
    looseNames: new Set(world.looseNames ?? []), prop: world.propKey ?? null, ...(world.beings?.length ? { beings: world.beings } : {}),
  };
}
function visualWorldFrom(v) {
  return { people: new Map(Object.entries(v.people ?? {}).map(([id, name]) => [id, { name }])), alias: v.alias ?? {}, narrator: v.narrator ?? "Me",
    monster: v.monster ?? null, looseNames: new Set(v.looseNames ?? []), prop: v.prop ?? null, ...(v.beings?.length ? { beings: v.beings } : {}) };
}

/** Names for the people the script doesn't name: townsfolk and extra babies get real first names (for name tags). */
function nameBook(world, title) {
  const taken = new Set([world.narrator, ...[...world.people.values()].map((p) => p.name), ...(world.looseNames ?? [])].map((n) => String(n).toLowerCase()));
  const pool = [...TOWN_NAMES, ...BABY_NAMES].filter((n, i, a) => a.indexOf(n) === i && !taken.has(n.toLowerCase()));
  const off = hashSeed(title) % pool.length;
  const of = (id) => {
    if (/^town\d$/.test(id)) return pool[(off + Number(id.slice(4)) - 1) % pool.length];
    if (/^baby\d$/.test(id)) return pool[(off + 2 + Number(id.slice(4))) % pool.length];
    if (id === "me") return world.narrator;
    return world.people.get(id)?.name ?? familyPerson(id).name;
  };
  return { of, tag: (id) => of(id).toUpperCase() };
}

const NUM = { two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10, hundred: 100 };
const HAVE_RE = /\b(keep|keeps|kept|have|has|had|hold|holds|held|grab\w*|took|take|takes|carr\w*|found|find|brought|bring|gave|give|pull\w*|picked|taped|lift\w*|wav\w*|ate|eat\w*)\b/;
const isAdultId = (id, world) => /^(mom|dad|grandma|grandpa)$/.test(id) || world.people.get(id)?.role === "adult";
const isBabyId = (id, world) => !!world.people.get(id)?.baby || /^baby\d?$/.test(id);

/**
 * The visual pass of one shot (mutates the draft): objects + states + set, babies in cribs or in arms, holds, actions
 * (poses / exprs on whoever does them), name tags / count badges, places, night, people, then the spots.
 */
function applyVisuals(d, V) {
  const { world, seg, keys, ms, names } = V;
  const toks = cleanTokens(seg.text);
  const low = seg.text.toLowerCase();
  const lineText = V.lines[seg.line].text, lineLow = lineText.toLowerCase();
  const prevLow = (V.lines[seg.line - 1]?.text ?? "").toLowerCase();
  const facing0 = ms ? "monster" : "camera";
  const R = (k) => ruleById(k.rule);
  const add = (id, pose = "stand", expr = "neutral", hold = null, front = false) => {
    let a = d.actors.find((x) => x.id === id);
    if (a) return a;
    if (d.actors.length >= 4) d.actors.pop();
    a = { id, spot: "center", pose, expr, facing: facing0, hold };
    if (front) d.actors.unshift(a); else d.actors.push(a);
    return a;
  };
  const lurk = ms?.state === "lurk";
  const addTown = (pose = lurk ? "look_up" : "stand", expr = "neutral") => { const t = ["town1", "town2", "town3"].find((x) => !d.actors.some((a) => a.id === x)); return t ? add(t, pose, expr) : null; };
  const holdsBaby = (a) => a.hold && isBabyId(a.hold, world);

  // who is the subject of the word at token k: the nearest person / "it" / group word before it, in its sentence
  const subjAt = new Map();
  for (const f of V.who.found) if (!f.possessive) subjAt.set(f.k, f.id);
  toks.forEach((t, i) => {
    if (/^(i|im|ive|id|ill)$/.test(t.c)) subjAt.set(i, "me");
    else if (/^(we|everyone|everybody|they|people|town|crowd|nobody)$/.test(t.c)) subjAt.set(i, "all");
    else if (t.c === "it" && !subjAt.has(i)) subjAt.set(i, "it");
  });
  for (const k of keys) if (k.kind === "monster") subjAt.set(k.k, "monster");
  toks.forEach((t, i) => { if (t.c === "something" && ms) subjAt.set(i, "monster"); });
  // "her name" / "his own name": the person the sentence (or the line before) is about
  const lastPersonBefore = (k) => keys.filter((x) => x.kind === "person" && x.k < k && x.id !== "me").at(-1)?.id ?? (V.ctx.last && V.ctx.lastLine >= seg.line - 2 ? V.ctx.last : null);
  const propRecent = !!world.propKey && (lineLow.includes(world.propKey) || prevLow.includes(world.propKey));
  const subjAtTok = (k) => {
    for (let i = k - 1; i >= 0; i--) {
      if (toks[i].end) break;
      if (subjAt.has(i)) {
        const s = subjAt.get(i);
        if (s === "it") return ms ? "monster" : propRecent ? "prop" : null;
        return s;
      }
    }
    return null;
  };

  // 1. objects (+ their states and sets); a line's place object also stands behind the line's other shots
  let objKeys = keys.filter((k) => k.kind === "rule" && R(k).object && !k.neg);
  const segSets = new Set(anchorsOf(seg.text).map((a) => a.set));
  if (!objKeys.length && !ms) {
    objKeys = V.lineKeys[seg.line].filter((k) => k.kind === "rule" && R(k).object && !k.neg && R(k).set && !R(k).babies && !R(k).reader && [...segSets].every((s) => s === R(k).set));
  }
  // townsfolk put in only because nobody was named make way for the line's thing
  if (V.fallbackTown && objKeys.length) d.actors = d.actors.filter((a) => !a.id.startsWith("town"));
  for (const k of objKeys) {
    const r = R(k);
    if (r.babies) {
      if (!ms) d.set = "bedroom";
      const ids = [V.vw.alias.baby ?? "baby1", "baby2", "baby3"];
      d.actors = [];
      ["center", "left", "right"].forEach((spot, i) => {
        d.objects.push({ name: "crib", spot, facing: "camera", with: ids[i] });
        d.actors.push({ id: ids[i], spot, pose: "sit", expr: "happy", facing: "camera", hold: null, inCrib: true });
      });
      continue;
    }
    if (d.objects.some((o) => o.name === r.object.name)) continue;
    if (r.id === "ladder" && ms?.spot === "tower") continue;   // the water tower has its own ladder
    const state = Object.entries(r.object.states ?? {}).find(([, re]) => re.test(lineLow))?.[0];
    d.objects.push({ name: r.object.name, spot: "center", ...(state ? { state } : {}), facing: "camera" });
    if (r.setState) d.setState = { windows: state ?? "lit" };
    const s = r.setIf?.find(([re]) => re.test(k.text))?.[1] ?? r.set;
    // the object goes where the line says ("stories by the campfire": the woods); else to its own set
    // (a portable thing follows the line's place; a place-like thing — a shop, a field, a truck — keeps its own)
    const portable = !OBJECT_CATALOG[r.object.name]?.big;
    const named = (portable ? V.lineKeys[seg.line] : keys).some((x) => x.kind === "rule" && R(x).kind === "place" && R(x).set && R(x).id !== "door");
    if (s && (!named || r.setIf?.some(([re]) => re.test(k.text))) && !(ms && (s === "bedroom" || s === "school"))) d.set = s;
    if (r.reader) {
      // "Grandpa's stories": Grandpa reads them to the kid (a memory: warm light outside the night part)
      const owner = keys.filter((x) => x.kind === "person" && x.poss && x.end < k.k).at(-1);
      const teller = keys.filter((x) => x.kind === "person" && x.id !== "me" && x.k < k.k && !isBabyId(x.id, world)).at(-1)?.id;
      const reader = owner?.id && owner.id !== "me" ? owner.id : teller ?? null;
      if (reader) { const a = add(reader, "talk", "happy"); if (a.pose === "stand") a.pose = "talk"; }
      if (!reader || /\b(i|me|my|we)\b/.test(low)) { const me = add("me", "sit", "happy"); if (me.pose === "stand") me.pose = "sit"; }
      if (/\bremember\w*|\bused to\b/.test(lineLow) && d.part !== "until" && d.part !== "climax") d.light = "warm";
    }
  }

  // 2. babies: in their crib in the bedroom, else in an adult's arms
  for (const a of [...d.actors]) {
    if (!isBabyId(a.id, world) || a.inCrib) continue;
    if (d.set === "bedroom" && !ms) {
      if (!d.objects.some((o) => o.name === "crib" && o.with === a.id)) d.objects.push({ name: "crib", spot: "center", facing: "camera", with: a.id });
      a.inCrib = true; a.pose = "sit"; a.facing = "camera";
      continue;
    }
    let c = d.actors.find((x) => x !== a && !isBabyId(x.id, world) && isAdultId(x.id, world) && (!x.hold || x.hold === a.id));
    if (!c) c = add(["mom", "dad", "grandma", "grandpa"].find((id) => V.family.has(id)) ?? "town1", "carry", a.expr);
    c.pose = "carry"; c.hold = a.id;
    d.actors = d.actors.filter((x) => x !== a);
  }

  // 3. holds: the prop / a holdable noun in the hand of whoever has it
  const holder = (k) => {
    const s = k != null ? subjAtTok(k) : null;
    const id = s && s !== "all" && s !== "monster" && s !== "prop" ? s : d.actors.find((x) => !isBabyId(x.id, world) && !holdsBaby(x) && !x.id.startsWith("town"))?.id ?? "me";
    if (isBabyId(id, world)) return null;
    return add(id, "carry", "neutral", null, id === "me");
  };
  for (const k of keys) {
    const r = k.kind === "rule" ? R(k) : null;
    if (r?.kind === "hold" || (k.kind === "noun" && HOLDABLE.has(k.noun) && !k.neg && (HAVE_RE.test(low) || propRecent && k.noun === world.propKey))) {
      const item = r?.hold ?? k.noun;
      if (d.actors.some((a) => a.hold === item)) continue;
      const a = holder(k.k);
      if (!a || holdsBaby(a)) continue;
      a.hold = item;
      if (!["blow", "yell", "point"].includes(a.pose)) a.pose = "carry";
    }
  }
  // "He said it was the loudest thing in town." right after the whistle: "it" is the whistle, in the speaker's hand
  if (propRecent && !ms && /\bit\b(?! (?:started|walked|climbed|came|turned))/.test(low) && !d.actors.some((a) => a.hold === world.propKey)) {
    const a = d.actors.find((x) => !isBabyId(x.id, world) && !holdsBaby(x));
    if (a && /\bit (was|is|s)\b|\bit's\b/.test(low.replace(/’/g, "'"))) { a.hold = world.propKey; a.pose = "carry"; }
  }

  // 3b. the line's other things: the kit's object for every noun it builds (the pigeons, the fountain, the gate, the
  // snowman); a hand prop nobody holds yet goes to whoever the line is about (coverage kit, 2026-11-04)
  for (const k of keys) {
    if (k.kind !== "noun" || k.neg) continue;
    const hk = heldKind(k.noun) ?? heldKind(k.label);
    if (hk && d.actors.some((a) => a.hold && (heldKind(a.hold) === hk || a.hold === k.noun))) continue;
    const name = objectForNoun(k.noun) ?? objectForNoun(k.label);
    if (!name) {
      if (hk && !ms) { const a = holder(k.k); if (a && !holdsBaby(a) && !a.hold) { a.hold = k.noun; if (!HOLD_POSES.has(a.pose)) a.pose = "carry"; } }
      continue;
    }
    if (d.objects.some((o) => o.name === name) || d.objects.length >= 3) continue;
    const cat = OBJECT_CATALOG[name];
    if (ms && cat.sets && cat.sets.every((s) => s === "bedroom" || s === "school")) continue;
    const state = thingState(name, lineLow);
    d.objects.push({ name, spot: "center", facing: "camera", ...(state ? { state } : {}) });
    // a thing that belongs somewhere (a barn, a fridge) moves an untied shot there
    const placed = keys.some((x) => x.kind === "rule" && R(x).kind === "place" && R(x).set);
    if (cat.sets && !cat.sets.includes(d.set) && !placed && !(ms && cat.sets.every((s) => s === "bedroom" || s === "school"))) d.set = cat.sets[0];
    if (V.subject?.kind === "thing" && V.subject.id === `thing:${k.label}` || V.subject?.id === `thing:${k.noun}`) d.pointNoun = true;
  }

  // 4. actions: the pose / face on whoever does them (a negated one: the hush)
  const STRONG = new Set(["yell", "sneeze", "blow"]);
  for (const k of keys) {
    if (k.kind !== "rule" || R(k).kind !== "action") continue;
    const r = R(k);
    if (k.neg) {
      const crowdObj = d.objects.some((o) => o.name === "football_field");
      for (const a of d.actors) { if (a.pose === r.pose) a.pose = "stand"; if (!isBabyId(a.id, world)) a.expr = "shush"; }
      if (!d.actors.length && !crowdObj && !ms) { addTown("stand", "shush"); addTown("stand", "shush"); }
      continue;
    }
    let s = subjAtTok(k.k);
    if (s === "monster") { if (r.show?.monsterMove) continue; s = null; }
    if (s === "prop") { if (d.actors.some((a) => a.hold === world.propKey)) continue; s = null; }
    let targets;
    if (s === "all") targets = d.actors.filter((a) => !holdsBaby(a) || r.expr);
    else if (s) targets = [d.actors.find((a) => a.id === s) ?? (d.actors.find((a) => a.hold === s) ? null : add(s, r.pose ?? "stand", r.expr ?? "neutral"))].filter(Boolean);
    else if (r.id === "whisper") targets = d.actors.filter((a) => !isBabyId(a.id, world) || /whisper/.test(low));
    else targets = [d.actors.find((a) => !a.id.startsWith("town") && !holdsBaby(a)) ?? d.actors[0]].filter(Boolean);
    if (!targets.length) {
      if (d.objects.some((o) => (r.show?.objects ?? []).includes(o.name))) continue;
      const t = addTown(r.pose ?? "stand", r.expr ?? "neutral");
      targets = t ? [t] : [];
    }
    for (const a of targets) {
      let rpose = k.pose ?? r.pose;
      if (rpose === "ride" && !d.objects.some(RIDEABLE)) rpose = "walk"; // nothing to ride in the shot: on the way
      const keepPose = (a.hold && a.pose === "carry" && !STRONG.has(rpose) && !ACTION_HOLD.has(rpose)) || holdsBaby(a) || (STRONG.has(a.pose) && !STRONG.has(rpose)) || (a.inCrib && !STRONG.has(rpose) && rpose !== "sleep");
      if (rpose && !keepPose) { a.pose = rpose; if (rpose !== "carry" && rpose !== "blow" && a.hold && !isBabyId(a.hold, world) && STRONG.has(rpose) && rpose !== "yell") a.hold = null; }
      if (r.hold && !a.hold) a.hold = r.hold;
      if (r.expr && !(STRONG.has(a.expr) && !STRONG.has(r.expr))) a.expr = r.expr;
      if (a.pose === "run" || a.pose === "walk") a.facing = ms ? "monster" : V.mover;
    }
  }
  // 4b (GAPS, 2026-11-05). A hug needs two: the hugger and the other person of the shot hug each other face to face
  // (the engine stands them together); climbers, fliers, swimmers, kickers and drivers are seen side-on
  pairHugs(d.actors, (id) => isBabyId(id, world));
  for (const a of d.actors) if (["climb"].includes(a.pose)) a.facing = "away"; else if (["fly", "swim", "kick", "drive", "throw", "push"].includes(a.pose) && (a.facing === "camera" || !a.facing)) a.facing = V.mover;

  // 5. markers: name tags, count badges, a music note
  const looseIn = (ks) => ks.find((x) => x.kind === "name" && !x.on)?.name;
  const loose = looseIn(keys) ?? looseIn(V.lineKeys[seg.line]) ?? looseIn(V.lineKeys[seg.line + 1] ?? []);
  const anyLoose = [...V.vw.looseNames][0];
  const mark = (on, kind, text) => { if (!d.markers.some((m) => m.on === on)) d.markers.push({ on, kind, text }); };
  for (const k of keys) {
    const isNames = k.kind === "rule" && k.rule === "names";
    if (k.kind !== "name" && !isNames) continue;
    if (k.kind === "name" && k.on === "me") { add("me"); mark("me", "tag", names.tag("me")); continue; }
    if (k.kind === "name") {
      // a name the subject is looking for (or the monster's line): a "NAME?" badge on the subject, never a tag on the
      // narrator ("Still looking for Barnaby." is the monster's)
      const lookFor = k.k >= 2 && /^(looking|searching|hunting|calling|asking|waiting|listening|lookin)$/.test(toks[k.k - 2]?.c ?? "") && toks[k.k - 1]?.c === "for";
      const sid = V.sentSubj?.(k.k)?.id ?? V.subject?.id;
      if (sid === "monster" && ms) { mark("monster", "icon", `${k.name.toUpperCase()}?`); continue; }
      if (lookFor && sid && sid !== "group" && sid !== "babies" && !sid.startsWith("thing:")) {
        const a = d.actors.find((x) => x.id === sid) ?? add(sid);
        if (a) { mark(a.id, "icon", `${k.name.toUpperCase()}?`); continue; }
      }
      const s = subjAtTok(k.k);
      const a = (s && s !== "all" && s !== "monster" && d.actors.find((x) => x.id === s)) || d.actors.find((x) => x.pose === "yell") || d.actors[0];
      if (s === "all" || (!a && false)) { mark("all", "tag", k.name.toUpperCase()); continue; }
      if (a) mark(d.actors.filter((x) => x.pose === "yell").length >= 2 ? "all" : a.id, "tag", k.name.toUpperCase());
      else if (ms) mark("monster", "icon", `${k.name.toUpperCase()}?`);
      else { const t = addTown("yell", "yell"); if (t) mark(t.id, "tag", k.name.toUpperCase()); }
      continue;
    }
    // "name(s)": whose? "call her Bean" -> Bean; "his own name" -> the subject; "your name" -> a townsperson
    let j = k.k - 1;
    while (j > 0 && /^(own|real|secret|last|first|new|old|louder|loud|loudest|whole|full|true|middle|other|same|baby|two|three)$/.test(toks[j].c)) j--;
    const det = toks[j]?.c;
    let owner = null;
    if (/^call/.test(k.text)) owner = keys.find((x) => x.kind === "person" && x.k > k.k)?.id ?? null;
    else if (det === "my") owner = "me";
    else if (det === "his" || det === "her" || det === "their") { owner = subjAtTok(k.k); if (!owner || owner === "all" || owner === "me") owner = lastPersonBefore(k.k) ?? owner; }
    if (owner === "all" || owner === "monster" || owner === "prop") owner = null;
    const secret = !/^call/.test(k.text) && /\b(secret|real name)\b/.test(low);
    const two = /\btwo names\b/.test(low) && anyLoose;
    const text = (id) => secret ? "???" : two ? `${names.tag(id)} + ${(loose ?? anyLoose).toUpperCase()}` : loose && !owner ? loose.toUpperCase() : names.tag(id);
    if (k.plural) {
      let ppl = d.actors.filter((a) => !holdsBaby(a) || true);
      while (ppl.length < 3 && !d.objects.some((o) => o.name === "crib")) { const t = addTown(ms && !lurk ? "scared" : undefined, ms && !lurk ? "scared" : "neutral"); if (!t) break; ppl = d.actors; }
      d.actors.slice(0, 3).forEach((a) => mark(a.id, "tag", text(a.id)));
      continue;
    }
    let a = owner ? d.actors.find((x) => x.id === owner) : null;
    if (owner && !a && d.actors.some((x) => x.hold === owner)) { mark(d.actors.find((x) => x.hold === owner).id, "tag", text(owner)); continue; }
    if (owner && !a) a = add(owner);
    if (!a) a = d.actors.find((x) => x.pose === "yell") ?? d.actors.find((x) => !x.id.startsWith("town")) ?? d.actors[0];
    if (!a) a = ms && loose ? null : addTown(ms && !lurk ? "scared" : undefined, ms && !lurk ? "scared" : "neutral");
    if (a) mark(a.id, "tag", text(a.id));
    else if (ms) mark("monster", "icon", `${(loose ?? "NAME").toUpperCase()}?`);
  }
  // a fragment that carries on the shot before keeps its people's name tags ("...two names. | One for whispering.":
  // the first of the two names)
  if (V.carryOver && !d.markers.length) {
    const pm = [...(V.carryOver.prev.markers ?? []), ...(V.carryOver.prev.marker ? [V.carryOver.prev.marker] : [])];
    for (const m of pm) if (m.kind === "tag" && d.actors.some((a) => a.id === m.on)) mark(m.on, "tag", / \+ /.test(m.text) ? m.text.split(" + ")[0] : m.text);
  }
  for (const k of keys) {
    if (k.kind !== "rule") continue;
    if (k.rule === "times") {
      const n = NUM[k.count] ?? (Number(k.count) || 3);
      const a = d.actors.find((x) => x.pose === "yell") ?? d.actors[0];
      if (a) { if (d.markers.some((m) => m.on === a.id)) d.markers = d.markers.filter((m) => m.on !== a.id); mark(a.id, "icon", `x${n}`); }
    }
    if (k.rule === "sing" && !d.objects.some((o) => o.name === "ice_cream_truck" || o.name === "birthday_party")) {
      const a = d.actors[0] ?? addTown("talk", "happy");
      if (a) mark(a.id, "icon", "♪");
    }
  }

  // 6. places, night, people, bodies
  let placeKeys = keys.filter((k) => k.kind === "rule" && R(k).kind === "place" && R(k).set);
  // no place of its own: the line's one place holds for all its shots ("Grandma reads us stories | by the campfire.")
  if (!placeKeys.length && !ms && !d.objects.some((o) => OBJECT_CATALOG[o.name]?.big)) {
    const lp = V.lineKeys[seg.line].filter((k) => k.kind === "rule" && R(k).kind === "place" && R(k).set && R(k).id !== "door");
    if (lp.length && new Set(lp.map((k) => R(k).set)).size === 1) placeKeys = lp;
  }
  if (placeKeys.length && !placeKeys.some((k) => R(k).set === d.set) && !d.objects.some((o) => o.name === "photo_set" && d.set === "school")) {
    const want = R(placeKeys.at(-1)).set;
    if (!(ms && (want === "bedroom" || want === "school"))) d.set = want;
  }
  if (V.lineKeys[seg.line].some((k) => k.kind === "rule" && k.rule === "night")) d.light = "night";
  const crowd = d.objects.some((o) => o.name === "football_field" || o.name === "birthday_party");
  if (keys.some((k) => k.kind === "rule" && k.rule === "people") && !d.actors.length && !crowd) { addTown(); if (/\b(people|everyone|everybody|neighbou?rs|kids|friends|crowd|town)\b/.test(low)) addTown(); }
  if (keys.some((k) => k.kind === "rule" && k.rule === "body") && !d.actors.length && !ms) add("me");
  if (keys.some((k) => k.kind === "person" && !(k.poss && k.soft) && !d.actors.some((a) => a.id === k.id || a.hold === k.id))) {
    for (const k of keys) if (k.kind === "person" && !(k.poss && k.soft) && !d.actors.some((a) => a.id === k.id || a.hold === k.id)) add(k.id, "stand", ms ? "scared" : "neutral");
  }

  for (const a of d.actors) if (a.pose === "yell") a.expr = "yell";
  d.point = !!V.pointRule || !!d.pointNoun || (d.objects.length > 0 && !d.actors.some((a) => !a.id.startsWith("town") && !isBabyId(a.id, world)));
  placeAll(d);
}

/** The state a coverage-kit object shows for a line (lib/catalog.js THINGS states), or null for its default. */
function thingState(name, low) {
  const st = OBJECT_CATALOG[name]?.states ?? [];
  const pick = (s) => (st.includes(s) ? s : null);
  switch (name) {
    case "cloud": return /\b(snow\w*|blizzard|flurr\w*)\b/.test(low) ? pick("snow") : /\b(storm\w*|thunder\w*|lightning)\b/.test(low) ? pick("storm") : /\b(rain\w*|drizzl\w*|wet|damp|pour\w*|soak\w*)\b/.test(low) ? pick("rain") : /\bcloud/.test(low) && !/\brain/.test(low) ? pick("plain") : null;
    case "fridge": return /\b(open\w*)\b/.test(low) ? pick("open") : null;
    case "drawer": return /\b(shut|closed|close)\b/.test(low) ? pick("closed") : null;
    case "mailbox": return /\bflag\b/.test(low) && /\b(down|lowered)\b/.test(low) ? pick("down") : null;
    case "porthole": return /\b(cover\w*|curtain\w*|shut)\b/.test(low) ? pick("covered") : null;
    case "chair": return /\bthrones?\b/.test(low) ? pick("throne") : /\b(cushions?|pillows?|stack\w*|tower)\b/.test(low) ? pick("pile") : null;
    case "fountain": return /\b(stops?|stopped|dry|off)\b/.test(low) ? pick("off") : null;
    case "lamp": return /\b(goes out|went out|off|dark|dim)\b/.test(low) ? pick("off") : null;
    case "wall": return /\b(crack\w*|break\w*|broke|through)\b/.test(low) ? pick("crack") : null;
    default: return null;
  }
}

/** Spots: a point object at center (big backdrops behind, small ones beside), babies in their cribs, people around. */
function placeAll(d) {
  const taken = new Set();
  const cribs = d.objects.filter((o) => o.name === "crib");
  const others = d.objects.filter((o) => o.name !== "crib");
  const people = d.actors.filter((a) => !a.inCrib);
  others.forEach((o, i) => {
    const want = i === 0 ? (d.point || !people.length ? "center" : OBJECT_CATALOG[o.name]?.big ? "back" : "right") : "back";
    o.spot = [want, "back", "right", "left", "far"].find((s) => !taken.has(s));
    taken.add(o.spot);
  });
  const ORDER = { 1: ["center", "left", "right", "back"], 2: ["left", "right", "center", "back"], 3: ["left", "center", "right", "back"] }[Math.min(3, d.actors.length)] ?? ["left", "center", "right", "back"];
  const freeSpots = () => [...ORDER, "door", "back", "far"].filter((s, i, a) => a.indexOf(s) === i && !taken.has(s));
  // babies first: each baby and its crib share a spot
  for (const a of d.actors.filter((x) => x.inCrib)) {
    const c = cribs.find((o) => o.with === a.id) ?? cribs.find((o) => !o.with);
    const spot = c && cribs.length > 1 ? c.spot : freeSpots()[0];
    if (c) { c.spot = spot; c.with = a.id; }
    a.spot = spot; taken.add(spot);
  }
  for (const a of people) { a.spot = freeSpots()[0] ?? "far"; taken.add(a.spot); }
  if (d.actors.length === 2 && d.actors.every((a) => a.facing !== "monster" && a.pose !== "run" && a.pose !== "walk" && !a.inCrib)) d.actors.forEach((a, k) => { a.facing = d.actors[1 - k].id; });
  d.actors = d.actors.map(({ id, spot, pose, expr, facing, hold }) => ({ id, spot, pose, expr, facing, hold: hold ?? null }));
  d.objects = d.objects.map(({ name, spot, state, facing }) => ({ name, spot, ...(state ? { state } : {}), facing: facing ?? "camera" }));
}

/** Per line: its key nouns/actions, which are missing on screen, what its shots show. */
function lineReport(shots, lines, vw, cast) {
  return lines.map((L, i) => {
    const keys = requiredKeys(extractKeys(L.text, vw));
    const ss = shots.filter((s) => (s.lines ?? [s.line]).includes(i));
    const missing = keys.filter((k) => !ss.some((s) => covers(k, s, cast)));
    return { line: i, text: L.text, keys, missing, shows: ss.map((s) => describeShot(s, cast)) };
  });
}
/** The keys a line must show: soft ones (a possessive owner, "said") are left out. */
function requiredKeys(keys) {
  return keys.filter((k) => !(k.kind === "person" && k.poss && k.soft) && !(k.kind === "noun" && k.neg) && !(k.kind === "rule" && ruleById(k.rule).soft && !k.neg) && !(k.kind === "rule" && k.rule === "talk" && !k.neg));
}

/** Lines still missing a visual: first a catalog visual on the line's own shot, else a picture card cut into its time. */
function fixVisuals(shots, lines, vw, buildCast, aux) {
  aux.vw ??= vw; aux.buildCast ??= buildCast;
  for (let pass = 0; pass < 4; pass++) {
    const rep = lineReport(shots, lines, vw, buildCast());
    const bad = rep.filter((r) => r.missing.length);
    if (!bad.length) return;
    for (const r of bad) {
      const L = lines[r.line];
      // a line shown only by a sign / note insert that misses another noun ("Who keeps a note stuck to the door with a
      // magnet."): its insert gives way to a real shot of the line (split when long enough), so the things can be shown
      const own = shots.filter((s) => (s.lines ?? [s.line]).includes(r.line));
      if (own.length && own.every((s) => s.camera === "insert")) demoteInsert(shots, own, aux, L);
      for (const key of r.missing) {
        const lineShots = shots.filter((s) => (s.lines ?? [s.line]).includes(r.line));
        const t = Math.max(L.start, L.wordToks[key.k]?.t ?? L.start);
        const real = lineShots.filter((s) => s.camera !== "insert");
        const host = real.find((s) => t >= s.start - 1e-9 && t < s.end) ?? real[0];
        if (pass < 2 && host && forceKey(host, key, aux)) continue;
        if (pass >= 1 && !cardShot(shots, lineShots, key, t, L)) badge(host ?? lineShots[0], key, aux);
      }
    }
  }
}

/** Turns (part of) a line's only insert shot into a real shot of its place: the insert keeps its first half if long. */
function demoteInsert(shots, own, aux, L) {
  const s = own.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a), own[0]);
  const i = shots.indexOf(s);
  const prevReal = shots.slice(0, i).reverse().find((x) => x.camera !== "insert");
  const real = { ...s, camera: "medium", focus: "group", actors: [], monsterState: null, insert: null, marker: null, set: s.set ?? prevReal?.set ?? "street" };
  delete real.markers; delete real.objects;
  // a note / letter / sign in the line: someone holds it on the real shot
  if (s.insert?.kind === "note" || s.insert?.kind === "sign") { real.actors = [{ id: "town1", spot: "center", pose: "carry", expr: "neutral", facing: "camera", hold: s.insert.kind === "note" ? "note" : "sign" }]; aux.used.add("town1"); real.focus = "town1"; }
  const target = s.start + (s.end - s.start) / 2;
  const cuts = [...new Set((L?.toks ?? []).map((x) => x.t))].filter((c) => c >= s.start + PACE.minShot - 1e-9 && c <= s.end - PACE.minShot + 1e-9);
  if (cuts.length && i > 0) {
    const mid = r3(cuts.reduce((b, x) => (Math.abs(x - target) < Math.abs(b - target) ? x : b), cuts[0]));
    shots.splice(i, 1, { ...s, end: mid }, { ...real, start: mid });
    shots[i + 1].camera = recam(shots, i + 1, "insert");
  } else {
    shots[i] = real;
    shots[i].camera = recam(shots, i, "insert");
  }
}

function freeSpot(s) {
  const taken = new Set([...(s.actors ?? []).map((a) => a.spot), ...(s.objects ?? []).map((o) => o.spot)]);
  return ["center", "left", "right", "back", "door", "far"].find((x) => !taken.has(x)) ?? "far";
}
/** A catalog visual for one missing key on an existing shot. Returns true when something was added. */
function forceKey(s, key, aux) {
  const addActor = (id, pose = "stand", expr = "neutral") => {
    if ((s.actors ?? []).some((a) => a.id === id)) return s.actors.find((a) => a.id === id);
    if (s.actors.length >= 4) return null;
    const a = { id, spot: freeSpot(s), pose, expr, facing: s.monsterState ? "monster" : "camera", hold: null };
    s.actors.push(a); aux.used.add(id);
    if (s.focus === "group" && s.actors.length === 1) s.focus = id;
    return a;
  };
  const town = () => ["town1", "town2", "town3"].find((t) => !s.actors.some((a) => a.id === t));
  if (key.kind === "person") return !!addActor(key.id, "stand", s.monsterState ? "scared" : "neutral");
  if (key.kind === "noun") {
    if (s.camera === "insert") return false;
    // a hand prop in a free hand (the subject's first), else the kit's object for it in the shot
    if (HOLDABLE.has(key.noun) || heldKind(key.noun)) {
      const free = (s.actors ?? []).filter((x) => !x.hold && !/^baby/.test(x.id) && aux.buildCast?.()[x.id]?.role !== "baby");
      const a = free.find((x) => x.id === s.subject) ?? free.find((x) => !x.id.startsWith("town")) ?? free[0];
      if (a) { a.hold = key.noun; if (!HOLD_POSES.has(a.pose)) a.pose = "carry"; return true; }
    }
    let name = objectForNoun(key.noun) ?? objectForNoun(key.label);
    // nobody can hold it: the hand prop itself, big, on a little crate (the "item" display)
    const hk = heldKind(key.noun) ?? heldKind(key.label);
    let state = null;
    if (!name && hk && OBJECT_CATALOG.item.states.includes(hk)) { name = "item"; state = hk; }
    if (!name || (s.objects ?? []).length >= 3) return false;
    if ((s.objects ?? []).some((o) => o.name === name && (o.state ?? null) === state)) return false;
    const cat = OBJECT_CATALOG[name];
    if (s.monsterState && cat.sets?.every((x) => x === "bedroom" || x === "school")) return false;
    state ??= thingState(name, String(s.text ?? "").toLowerCase());
    const about = s.subject === `thing:${key.label}` || s.subject === `thing:${key.noun}`;
    const o = { name, spot: freeSpot(s), facing: "camera", ...(state ? { state } : {}) };
    s.objects = about ? [o, ...(s.objects ?? [])] : [...(s.objects ?? []), o];
    if ((s.focus === "group" && !s.actors.length) || about) s.focus = "object";
    return true;
  }
  if (key.kind === "name") {
    const a = s.actors[0] ?? (town() && addActor(town()));
    if (!a) return false;
    s.markers = [...(s.markers ?? (s.marker ? [s.marker] : [])), { on: a.id, kind: "tag", text: key.name.toUpperCase() }];
    s.marker = s.markers[0];
    return true;
  }
  if (key.kind !== "rule") return false;
  const r = ruleById(key.rule);
  if (r.kind === "action" && !key.neg && (r.pose || r.expr)) {
    // someone not busy showing another action ("Loud dreams shake houses": one yells, another sleeps)
    const idle = (x) => ["stand", "carry", "talk", "look_up"].includes(x.pose);
    const a = s.actors.find((x) => !x.id.startsWith("town") && idle(x)) ?? s.actors.find(idle) ?? (s.actors.length && town() && s.actors.length < 4 ? addActor(town()) : null) ?? s.actors.find((x) => !x.id.startsWith("town")) ?? s.actors[0] ?? (town() && addActor(town()));
    if (!a) return false;
    if (r.pose) a.pose = r.pose;
    if (r.expr) a.expr = r.expr;
    if (r.hold) a.hold = r.hold;
    if (r.marker && !markersList(s).some((m) => m.on === a.id)) setMarkers(s, [...markersList(s), { on: a.id, kind: r.marker.kind, text: r.marker.text }]);
    return true;
  }
  if (r.kind === "action" && key.neg) { s.actors.forEach((a) => { a.expr = "shush"; }); if (!s.actors.length && town()) addActor(town(), "stand", "shush"); return s.actors.length > 0; }
  if (r.kind === "place" && r.set) {
    // the shot's own set is another place of the same line ("...the trees wrap everyone, so the kids come home"), or
    // the monster is in it (it never goes indoors): that place stays, this one comes in as its object (a house front, a
    // stump, a couch)
    const indoorMonster = s.monsterState && (r.set === "bedroom" || r.set === "school");
    if (indoorMonster && !r.stand) return false;
    const other = indoorMonster || (aux.vw && s.set !== r.set && extractKeys(s.text ?? "", aux.vw).some((x) => x.kind === "rule" && ruleById(x.rule).kind === "place" && ruleById(x.rule).set === s.set));
    if (other && r.stand && !(s.objects ?? []).some((o) => o.name === r.stand) && (s.objects ?? []).length < 3) {
      s.objects = [...(s.objects ?? []), { name: r.stand, spot: freeSpot(s), facing: "camera" }];
      return true;
    }
    s.set = r.set; return true;
  }
  if (r.kind === "light" && r.light) { s.light = r.light; return true; }
  if (r.kind === "people") { const t = town(); return !!(t && addActor(t)); }
  if (r.kind === "body" && !s.actors.length) return !!addActor("me");
  if (r.kind === "marker" && r.id === "names") {
    const a = s.actors[0] ?? (town() && addActor(town()));
    if (!a) return false;
    s.markers = [...(s.markers ?? (s.marker ? [s.marker] : [])), { on: a.id, kind: "tag", text: aux.names.tag(a.id) }];
    s.marker = s.markers[0];
    return true;
  }
  if (r.object && !s.monsterState && !(s.objects ?? []).some((o) => o.name === r.object.name) && !r.babies) {
    s.objects = [...(s.objects ?? []), { name: r.object.name, spot: freeSpot(s), facing: "camera" }];
    if (s.focus === "group" && !s.actors.length) s.focus = "object";
    return true;
  }
  if (r.hold && s.actors.length) { const a = s.actors.find((x) => !x.hold) ?? s.actors[0]; a.hold = r.hold; if (a.pose !== "blow") a.pose = "carry"; return true; }
  return false;
}

/**
 * Cuts a picture card for the key into the line's time (>= minShot, at a word start, at most 2 cards a line, never 3
 * inserts in a row). Returns false when it doesn't fit (the caller then puts a badge on someone in the shot).
 */
function cardShot(shots, lineShots, key, t, L, insert = null, dirNeed = null) {
  if (lineShots.filter((s) => s.insert?.kind === "card").length >= (insert ? 3 : 2)) return false;
  const host = lineShots.filter((s) => s.camera !== "insert").find((s) => t >= s.start - 1e-9 && t < s.end) ?? lineShots.find((s) => s.camera !== "insert");
  if (!host) return false;
  const i = shots.indexOf(host);
  const ins = (s) => s?.camera === "insert";
  const starts = [...new Set([...L.wordToks, ...L.toks].map((x) => x.t))].filter((c) => c >= host.start + PACE.minShot - 1e-9 && c <= host.end - PACE.minShot + 1e-9);
  if (!starts.length) return false;
  const c = starts.reduce((b, x) => (Math.abs(x - t) < Math.abs(b - t) ? x : b), starts[0]);
  const cardFirst = t < c;
  // never three inserts in a row: the card's neighbours after the cut
  if (cardFirst ? ins(shots[i - 1]) && ins(shots[i - 2]) : ins(shots[i + 1]) && ins(shots[i + 2])) return false;
  const card = { start: cardFirst ? host.start : r3(c), end: cardFirst ? r3(c) : host.end, line: host.line, lines: host.lines, part: host.part, set: host.set, light: host.light,
    camera: "insert", focus: "insert", actors: [], monsterState: null, insert: insert ?? cardFor(key), marker: null, seed: host.seed, text: host.text, visuals: [key.label],
    subject: host.subject ?? null };
  // the builder (lib/builder): a noun the kit can't show is a "need"; when it gets built, the card gives its time back to
  // the host shot and the built object stands in it (lib/builder/apply.js), else the card stays
  if (key.kind === "noun") card.need = { kind: "object", name: key.noun ?? key.label, label: key.label, host: cardFirst ? "next" : "prev" };
  // the director's builder need (an object, a static giant blueprint): the same, with its hints (giant, heightM, hint)
  if (dirNeed?.kind === "object") card.need = { kind: "object", name: dirNeed.name, label: dirNeed.phrase ?? dirNeed.name, host: cardFirst ? "next" : "prev", source: "director", item: dirNeed.item, ...(dirNeed.giant ? { giant: true, heightM: dirNeed.heightM } : {}), ...(dirNeed.hint ? { hint: dirNeed.hint } : {}) };
  if (insert) delete card.visuals;
  const rest = { ...host, ...(cardFirst ? { start: r3(c) } : { end: r3(c) }) };
  shots.splice(i, 1, ...(cardFirst ? [card, rest] : [rest, card]));
  return true;
}

/** The last resort: a round badge with the thing's icon and word over someone in the shot (or over the monster). */
function badge(s, key, aux) {
  if (!s) return false;
  const c = cardFor(key);
  const text = `${c.icon} ${badgeWord(c.text)}`;
  s.markers = [...(s.markers ?? (s.marker ? [s.marker] : []))];
  const has = new Set(s.markers.map((m) => m.on));
  let on = (s.actors ?? []).find((a) => !has.has(a.id))?.id ?? (s.monsterState && !has.has("monster") ? "monster" : null);
  if (!on && s.camera !== "insert") {
    const t = ["town1", "town2", "town3"].find((x) => !(s.actors ?? []).some((a) => a.id === x));
    if (t && s.actors.length < 4) { s.actors.push({ id: t, spot: freeSpot(s), pose: "point", expr: "surprised", facing: "camera", hold: null }); aux.used.add(t); on = t; }
  }
  if (!on) return false;
  s.markers.push({ on, kind: "icon", text });
  s.marker = s.markers[0];
  if (s.markers.length === 1) delete s.markers;
  return true;
}

// ---------------------------------------------------------------- 6c. subjects (lib/subjects.js): who each shot is about
/** he / she for every cast member and family word: family words, titles, alias relations, common first names. */
function genderMap(world) {
  const g = {};
  const ids = [...world.people.keys()].filter((id) => id !== "me");
  for (const id of [...ids, "mom", "dad", "grandma", "grandpa", "brother", "sister"]) g[id] = genderOf(id, world.people.get(id) ?? { name: id }, world.alias);
  return g;
}
/** Every line's subjects, read in order with one story context. */
function subjectsFor(lines, vw, gender) {
  const sctx = { people: vw.people, alias: vw.alias, narrator: vw.narrator, monster: vw.monster, looseNames: [...(vw.looseNames ?? [])], prop: vw.prop, gender, ...(vw.beings?.length ? { beings: vw.beings } : {}) };
  return lines.map((L) => subjectOf(L.text, sctx));
}
/**
 * A shot's subject: the sentence with most of its words (a shot holding "Barnaby! The Listener stopped..." is the
 * monster's); the other sentences' people / monster must be on screen too (`with`).
 */
function segSubject(seg, lineSubj) {
  const count = new Map();
  for (const t of seg.toks) {
    const S = lineSubj[t.line];
    const si = S ? S.sentences.findIndex((x) => t.k >= x.k0 && t.k <= x.k1) : -1;
    if (si < 0) continue;
    const key = `${t.line}:${si}`;
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  if (!count.size) return null;
  let best = null, bc = -1;
  for (const [k, c] of count) if (c > bc) { bc = c; best = k; }
  const [li, si] = best.split(":").map(Number);
  const main = lineSubj[li].sentences[si];
  const withIds = [...(main.with ?? [])];
  for (const k of count.keys()) {
    if (k === best) continue;
    const [l2, s2] = k.split(":").map(Number);
    const o = lineSubj[l2].sentences[s2];
    if (o.id && o.id !== main.id && ["person", "narrator", "monster"].includes(o.kind) && !o.absent && !withIds.includes(o.id)) withIds.push(o.id);
  }
  return { id: main.id, kind: main.kind, via: main.via, absent: !!main.absent, with: withIds.filter((x) => x !== main.id) };
}

const markersList = (s) => {
  const list = [...(s.markers ?? [])];
  if (s.marker && !list.some((m) => m.on === s.marker.on && m.text === s.marker.text)) list.unshift(s.marker);
  return list;
};
const setMarkers = (s, list) => { if (list.length > 1) s.markers = list; else delete s.markers; s.marker = list[0] ?? null; };

/**
 * What is wrong with a shot's subject: [{ code, msg, id?, key?, marker? }]. The rule: the subject is on screen and is
 * the focus (a person may share the frame with the object they are at: focus "object" / "group"; a carried baby is
 * featured by its carrier); whoever the subject acts on is in frame; a loose name's tag sits on the subject.
 * Inserts (signs, picture cards) are cutaways and have no subject rule.
 */
function subjectIssues(s, cast, keysOfShot, loose) {
  if (s.camera === "insert" || s.focus === "insert" || !s.subject) return [];
  const out = [];
  const actors = s.actors ?? [];
  const ids = actors.map((a) => a.id);
  const carrierOf = (id) => actors.find((a) => a.hold === id && cast[id]?.role === "baby");
  const on = (id) => (id === "monster" ? !!s.monsterState : ids.includes(id) || !!carrierOf(id));
  const nm = (id) => (id === "monster" ? "the monster" : cast[id]?.name ?? id);
  const S = s.subject;
  const objs = (s.objects ?? []).map((o) => o.name);
  const people = actors.length + (objs.includes("football_field") || objs.includes("birthday_party") ? 3 : 0) + (s.crowds ?? []).reduce((n, c) => n + Math.min(10, c.count ?? 0), 0);
  if (S === "monster") {
    if (!s.subjectAbsent) {
      if (!s.monsterState) out.push({ code: "monster", id: S, msg: "the monster (the subject) is not on screen" });
      else if (s.focus !== "monster") out.push({ code: "focus", id: S, msg: `focus is ${s.focus}, not the monster (the subject)` });
    }
  } else if (S === "group") {
    if (people < 2) out.push({ code: "group", msg: `a line about everyone with ${people} person(s) on screen` });
    else if (s.camera === "closeup") out.push({ code: "closeup", msg: "a closeup on a line about everyone" });
  } else if (S === "babies") {
    if (!actors.some((a) => cast[a.id]?.role === "baby" || cast[a.hold]?.role === "baby")) out.push({ code: "babies", msg: "no baby on screen" });
  } else if (S === "someone") {
    if (!actors.length && !(s.crowds ?? []).length) out.push({ code: "someone", msg: "nobody on screen" });
  } else if (S.startsWith("thing:")) {
    const label = S.slice(6);
    const key = keysOfShot(s).find((k) => k.label === label || k.noun === label);
    if (key && !covers(key, s, cast)) out.push({ code: "thing", key, msg: `the ${label} (the subject) is not on screen` });
  } else if (!on(S)) out.push({ code: "person", id: S, msg: `${nm(S)} (the subject) is not on screen` });
  else if (![S, carrierOf(S)?.id, "object", "group"].includes(s.focus)) out.push({ code: "focus", id: S, msg: `focus is ${s.focus}, not ${nm(S)} (the subject)` });
  for (const w of s.subjectWith ?? []) if (!on(w)) out.push({ code: "with", id: w, msg: `${nm(w)} (acted on by the subject) is not on screen` });
  if (S === "me" || S === "monster" || (cast[S] && !S.startsWith("thing:"))) {
    for (const m of markersList(s)) {
      if (m.kind !== "tag" || m.on === "all" || m.on === "monster" || !loose.has(String(m.text ?? "").toLowerCase())) continue;
      // on the subject, or on a co-subject of a shot that holds two sentences ("Barnaby! | The Listener stopped...")
      if (m.on !== S && !(s.subjectWith ?? []).includes(m.on)) out.push({ code: "tag", marker: m, msg: `tag "${m.text}" on ${nm(m.on)}, not on the subject (${nm(S)})` });
    }
  }
  return out;
}

/** A camera for shot i other than `not`, that keeps the variety rule (never 3 in a row) and suits the shot. */
function recam(shots, i, not) {
  const s = shots[i], n = (s.actors ?? []).length;
  const ok = (c) => {
    if (c === not) return false;
    if (c === "over_shoulder" && !(n >= 2 || (s.monsterState && n >= 1))) return false;
    if (c === "closeup" && (n >= 3 || s.subject === "group" || !n)) return false;
    if (i === 0 && c !== "wide") return false;
    const p1 = shots[i - 1]?.camera, p2 = shots[i - 2]?.camera, n1 = shots[i + 1]?.camera, n2 = shots[i + 2]?.camera;
    return !(c === p1 && c === p2) && !(c === p1 && c === n1) && !(c === n1 && c === n2);
  };
  return ["medium", "wide", "low", "over_shoulder", "closeup"].find(ok) ?? s.camera;
}

/** Re-plans every shot whose subject is not on screen / not the focus (the planner's own pre-render check). */
function fixSubjects(shots, aux) {
  for (let pass = 0; pass < 3; pass++) {
    const cast = aux.buildCast();
    let any = false;
    shots.forEach((s, i) => {
      for (const p of subjectIssues(s, cast, aux.keysOfShot, aux.loose)) { any = true; fixSubjectIssue(shots, i, p, aux, cast); }
    });
    if (!any) return;
  }
}

function fixSubjectIssue(shots, i, p, aux, cast) {
  const s = shots[i];
  const { world } = aux;
  const isBaby = (id) => cast[id]?.role === "baby" || !!world.people.get(id)?.baby || /^baby\d$/.test(id);
  const dropActor = (id) => { s.actors = s.actors.filter((a) => a.id !== id); setMarkers(s, markersList(s).filter((m) => m.on !== id)); };
  const addPerson = (id) => {
    const have = s.actors.find((a) => a.id === id) ?? s.actors.find((a) => a.hold === id);
    if (have) return have;
    if (isBaby(id)) {
      if (s.set === "bedroom" && !s.monsterState) {
        const spot = freeSpot(s);
        s.objects = [...(s.objects ?? []), { name: "crib", spot, facing: "camera" }];
        const a = { id, spot, pose: "sit", expr: "happy", facing: "camera", hold: null };
        s.actors.push(a); aux.used.add(id); return a;
      }
      let c = s.actors.find((a) => (isAdultId(a.id, world) || /^town/.test(a.id)) && !a.hold);
      if (!c) c = addPerson(["mom", "dad", "grandma", "grandpa"].find((x) => aux.family.has(x)) ?? "town1");
      if (!c) return null;
      c.hold = id; c.pose = "carry"; aux.used.add(id);
      return c;
    }
    if (s.actors.length >= 4) { const t = s.actors.find((a) => a.id.startsWith("town")); if (!t) return null; dropActor(t.id); }
    const a = { id, spot: freeSpot(s), pose: "stand", expr: s.monsterState ? "scared" : "neutral", facing: s.monsterState ? "monster" : "camera", hold: null };
    s.actors.push(a); aux.used.add(id);
    return a;
  };
  const addMonster = () => {
    if (!world.monster || s.monsterState) return;
    if (s.set === "bedroom" || s.set === "school") {
      s.set = "street";
      s.objects = (s.objects ?? []).filter((o) => o.name !== "crib");
      for (const a of [...s.actors]) if (isBaby(a.id)) dropActor(a.id);
      if (!s.objects.length) delete s.objects;
      if (s.focus === "object" && !s.objects?.length) s.focus = s.actors[0]?.id ?? "group";
    }
    const low = String(s.text ?? "").toLowerCase();
    const state = s.part === "closer" ? "flee" : s.part === "climax" ? (/\b(away|past|over|looking for|left|gone|followed)\b/.test(low) ? "flee" : "reveal")
      : s.part === "until" ? "reach" : s.part === "discovery" ? "reveal" : "lurk";
    s.monsterState = { spot: state === "lurk" || state === "flee" ? "far" : "back", state };
    for (const a of s.actors) if (a.facing === "camera") a.facing = "monster";
  };
  const focusOn = (id) => { const c = s.actors.find((a) => a.hold === id && isBaby(id)); s.focus = c ? c.id : id; };
  switch (p.code) {
    case "person": if (addPerson(p.id)) focusOn(p.id); break;
    case "focus":
      if (p.id === "monster") s.focus = "monster";
      else focusOn(p.id);
      if (s.camera === "closeup" && s.focus === "group") s.camera = recam(shots, i, "closeup");
      break;
    case "with": if (p.id === "monster") addMonster(); else addPerson(p.id); break;
    case "monster": addMonster(); if (s.monsterState) s.focus = "monster"; break;
    case "group": {
      const pose = s.actors[0]?.pose ?? "stand";
      for (const t of ["town1", "town2", "town3"]) {
        if ((s.actors?.length ?? 0) >= 2) break;
        if (!s.actors.some((a) => a.id === t)) { const a = addPerson(t); if (a) a.pose = pose === "carry" ? "stand" : pose; }
      }
      if (s.camera === "closeup") s.camera = recam(shots, i, "closeup");
      break;
    }
    case "closeup": s.camera = recam(shots, i, "closeup"); break;
    case "babies": addPerson(aux.vw.alias.baby ?? "baby2"); break;
    case "someone": addPerson(["town1", "town2", "town3"].find((t) => !s.actors.some((a) => a.id === t)) ?? "town1"); break;
    case "thing": if (!forceKey(s, p.key, aux)) badge(s, p.key, aux); break;
    case "tag": {
      const list = markersList(s).filter((m) => m !== p.marker && !(m.on === p.marker.on && m.text === p.marker.text));
      if (s.subject === "monster" && s.monsterState) list.push({ on: "monster", kind: "icon", text: `${p.marker.text}?` });
      else if (s.actors.some((a) => a.id === s.subject)) list.push({ ...p.marker, on: s.subject });
      setMarkers(s, list);
      break;
    }
  }
  if (s.focus === "monster" && !s.monsterState) s.focus = s.actors[0]?.id ?? "group";
}

// ---------------------------------------------------------------- 7. the check
/**
 * The subject check (pre-render, next to checkVisuals): every shot's subject is on screen and featured, whoever it acts
 * on is in frame, a looked-for name is not a tag on someone else; and every shot's recorded subject is one its lines
 * are about (re-read from the text). [{ shot, line, text, subject, problem }]; empty = clean.
 */
export function checkSubjects(tl) {
  const out = [];
  if (!tl?.shots) return out;
  const cast = tl.cast ?? {};
  const vw = tl.visualWorld ? visualWorldFrom(tl.visualWorld) : null;
  const lines = tl.lines ?? [];
  const lineSubj = vw && lines.length ? subjectsFor(lines, vw, tl.visualWorld.gender ?? {}) : null;
  const lineKeys = vw ? lines.map((l) => extractKeys(l.text, vw)) : [];
  const keysOfShot = (s) => (s.lines ?? [s.line]).flatMap((i) => lineKeys[i] ?? []);
  const loose = new Set(tl.visualWorld?.looseNames ?? []);
  tl.shots.forEach((s, i) => {
    if (s.camera === "insert" || s.focus === "insert") return;
    const base = { shot: i, line: s.line, text: s.text, subject: s.subject ?? null };
    if (!("subject" in s)) { out.push({ ...base, problem: "no subject recorded" }); return; }
    if (lineSubj && s.subject != null) {
      const said = (s.lines ?? [s.line]).flatMap((l) => lineSubj[l]?.sentences.map((x) => x.id) ?? []);
      if (!said.includes(s.subject)) out.push({ ...base, problem: `subject ${s.subject} is not who its line is about (${[...new Set(said)].join(", ")})` });
    }
    for (const p of subjectIssues(s, cast, keysOfShot, loose)) out.push({ ...base, problem: p.msg });
  });
  return out;
}

/** Every line's key nouns/actions on screen: [{ line, text, missing: [labels] }] for the lines that miss one. */
export function checkVisuals(tl, script) {
  const src = script?.lines ?? tl?.lines ?? [];
  const lines = src.map((l) => ({ text: l.text ?? String(l) }));
  const vw = tl?.visualWorld ? visualWorldFrom(tl.visualWorld) : visualWorld(readWorld({ lines: src.map((l) => ({ text: l.text ?? String(l), part: l.part })) }, { opener: lines[0]?.text }));
  return lineReport(tl?.shots ?? [], lines, vw, tl?.cast ?? {}).filter((r) => r.missing.length).map((r) => ({ line: r.line, text: r.text, missing: r.missing.map((k) => k.label) }));
}

export function checkTimeline(tl) {
  const out = [];
  if (!tl || typeof tl !== "object") return ["no timeline"];
  if (tl.version !== 1 || tl.fps !== 24 || tl.width !== 1080 || tl.height !== 1920) out.push("header must be version 1, 24 fps, 1080x1920");
  if (!(tl.duration > 0)) out.push("duration must be > 0");
  const shots = tl.shots ?? [];
  if (!shots.length) return [...out, "no shots"];
  const eps = 1e-6;
  // EPIC fields (lib/epic.js; the director's giants / crowds / creature worlds): their own schema check too
  const epicTl = !!(tl.giants || tl.worlds || shots.some((s) => s.giants?.length || s.crowds?.length || s.beat || isCreatureSet(s) || EPIC_CAMERAS.includes(s.camera)));
  // (a string shot.world is the builder's world-need marker, not EPIC's { kind, creature, view }: apply.js removes it)
  if (epicTl) out.push(...validateEpic({ ...tl, shots: shots.map((s) => (typeof s.world === "string" ? { ...s, world: undefined } : s)) }).map((p) => `epic: ${p}`));
  if (Math.abs(shots[0].start) > eps) out.push("the first shot must start at 0");
  if (Math.abs(shots.at(-1).end - tl.duration) > eps) out.push("the last shot must end at the duration");
  if (!["wide", "insert", ...(epicTl ? ["establish", "aerial"] : [])].includes(shots[0].camera)) out.push("the first shot must be wide or insert");
  shots.forEach((s, i) => {
    const at = `shot ${i}`;
    if (i > 0 && Math.abs(s.start - shots[i - 1].end) > eps) out.push(`${at}: gap/overlap with the previous shot`);
    if (!(s.end > s.start)) out.push(`${at}: empty`);
    else if (s.end - s.start < 0.5) out.push(`${at}: shorter than 0.5 s`);
    const builtWorld = /^world:/.test(s.set ?? "") && tl.assets?.[s.set.slice(6)]?.kind === "world";
    const creatureWorld = isCreatureSet(s) && !!tl.worlds?.[s.set.slice(9)];
    if (!SETS.includes(s.set) && !builtWorld && !creatureWorld) out.push(`${at}: unknown set ${s.set}`);
    if (!LIGHTS.includes(s.light)) out.push(`${at}: unknown light ${s.light}`);
    if (!CAMERAS.includes(s.camera) && !(epicTl && EPIC_CAMERAS.includes(s.camera))) out.push(`${at}: unknown camera ${s.camera}`);
    if (s.camera === "insert" && !s.insert) out.push(`${at}: insert camera without an insert`);
    if (i >= 2 && s.camera === shots[i - 1].camera && s.camera === shots[i - 2].camera) out.push(`${at}: the same camera 3 times in a row`);
    for (const a of s.actors ?? []) {
      if (!tl.cast?.[a.id]) out.push(`${at}: actor ${a.id} is not in the cast`);
      if (!POSES.includes(a.pose)) out.push(`${at}: unknown pose ${a.pose}`);
      if (!EXPRS.includes(a.expr)) out.push(`${at}: unknown expr ${a.expr}`);
      if (!SPOTS.includes(a.spot)) out.push(`${at}: unknown spot ${a.spot}`);
    }
    const ids = (s.actors ?? []).map((a) => a.id);
    if (new Set(ids).size !== ids.length) out.push(`${at}: an actor twice`);
    for (const a of s.actors ?? []) if (a.hold && tl.cast?.[a.hold] && tl.cast[a.hold].role !== "baby") out.push(`${at}: ${a.id} holds ${a.hold}, who is not a baby`);
    for (const o of s.objects ?? []) {
      if (o.asset) { if (tl.assets?.[o.asset]?.kind !== "object") out.push(`${at}: object ${o.name}: unknown built asset ${o.asset}`); }
      else if (!OBJECTS.includes(o.name)) out.push(`${at}: unknown object ${o.name}`);
      else if (o.state && !OBJECT_CATALOG[o.name].states.includes(o.state)) out.push(`${at}: object ${o.name} has no state ${o.state}`);
      if (!SPOTS.includes(o.spot)) out.push(`${at}: object ${o.name} at unknown spot ${o.spot}`);
    }
    if (s.focus === "object" && !(s.objects ?? []).length) out.push(`${at}: focus object without an object`);
    if (s.insert && !INSERT_KINDS.includes(s.insert.kind)) out.push(`${at}: unknown insert kind ${s.insert.kind}`);
    if (s.setState && !["dark", "lit", "open"].includes(s.setState.windows)) out.push(`${at}: bad setState`);
    for (const m of [...(s.markers ?? []), ...(s.marker ? [s.marker] : [])]) {
      if (m.on !== "all" && m.on !== "monster" && !ids.includes(m.on)) out.push(`${at}: marker on ${m.on}, who is not in the shot`);
      if (m.on === "monster" && !s.monsterState) out.push(`${at}: marker on the monster without the monster`);
    }
    if (s.monsterState) {
      if (!tl.monster) out.push(`${at}: monsterState without a monster`);
      if (!MONSTER_STATES.includes(s.monsterState.state) || !SPOTS.includes(s.monsterState.spot) && s.monsterState.spot !== "tower") out.push(`${at}: bad monsterState`);
    }
    if (s.focus === "monster" && !s.monsterState) out.push(`${at}: focus monster without the monster`);
    if (s.focus !== "monster" && s.focus !== "insert" && s.focus !== "group" && s.focus !== "object" && !(epicTl && (/^(giant:|crowd)/.test(String(s.focus)) || s.focus === "world")) && !ids.includes(s.focus)) out.push(`${at}: focus ${s.focus} is not on screen`);
    if (s.insert && !(s.insert.text && s.insert.text.split(/\s+/).length <= 6)) out.push(`${at}: insert text missing or longer than 6 words`);
  });
  if (tl.lines) {
    const covered = new Set(shots.flatMap((s) => s.lines ?? [s.line]));
    tl.lines.forEach((_, i) => { if (!covered.has(i)) out.push(`line ${i} has no shot`); });
    for (const m of checkVisuals(tl, { lines: tl.lines })) out.push(`line ${m.line} shows nothing for: ${m.missing.join(", ")}`);
  }
  for (const m of checkProductionStrict(tl)) out.push(`line ${m.line} misses the production items: ${m.missing.map((x) => x.name).join(", ")}`);
  const caps = tl.captions ?? [];
  if (!caps.length) out.push("no captions");
  caps.forEach((c, i) => {
    if (!(c.end >= c.start) || c.start < 0 || c.end > tl.duration + eps) out.push(`caption ${i} out of range`);
    if (i && c.start < caps[i - 1].start - eps) out.push(`caption ${i} out of order`);
  });
  if (!tl.audio?.voice) out.push("no audio.voice");
  return out;
}

/** GAPS (2026-11-05): a hugger and the other (non-baby) person of the shot hug each other, facing each other */
export function pairHugs(actors, isBaby = () => false) {
  for (const h of actors) {
    if (h.pose !== "hug" || actors.some((x) => x !== h && x.pose === "hug" && x.facing === h.id)) continue;
    const q = actors.find((x) => x !== h && x.id === h.facing && !isBaby(x.id)) ?? actors.find((x) => x !== h && !isBaby(x.id) && x.pose !== "hug" && !x.id.startsWith("town")) ?? actors.find((x) => x !== h && !isBaby(x.id) && x.pose !== "hug");
    if (!q) continue;
    q.pose = "hug"; q.facing = h.id; h.facing = q.id; if (q.expr === "neutral") q.expr = "happy";
  }
}

/**
 * GAPS (2026-11-05): the director's action per line on the planned shots (directed plans only).
 *   a person: the line's subject does the line's action when it has its own pose (hug, climb, push, eat, fall, jump,
 *     ride, hide, throw, fly, swim, build, dig, dance, kick, fight, drive): a hug brings the other person of the line in
 *     (face to face), a ride needs a thing to ride in the shot; a change that would leave one of the line's words
 *     unshown is undone (the PERMANENT RULE: checkVisuals must still pass)
 *   an animal / built creature on screen: its behaviour (the line's action when it is the subject, else its own:
 *     a sleeping cat sleeps) as the object's state (page/kit/motion.js)
 */
function directActions(shots, D, lineKeys, buildCast, used) {
  const ANIMAL_STATES = OBJECT_CATALOG.dog?.states?.filter((x) => x !== "on") ?? [];
  const MAP = { stand: null, idle: null, charge: "charge", chase: "chase", attack: "attack", reveal: "lurk" };
  const humans = new Map((D.production.cast ?? []).filter((c) => c.kind === "human").map((c) => [c.id, c]));
  const free = (s) => { const t = new Set([...(s.actors ?? []).map((a) => a.spot), ...(s.objects ?? []).map((o) => o.spot)]); return ["center", "left", "right", "back"].find((x) => !t.has(x)) ?? null; };
  let changed = 0;
  for (const L of D.lines) {
    const own = shots.filter((s) => s.line === L.i && s.camera !== "insert");
    if (!own.length) continue;
    // a person's action
    const act = L.action;
    if (humans.has(L.subject) && ONE_LINE_POSES.has(act)) {
      for (const s of own) {
        const a = (s.actors ?? []).find((x) => x.id === L.subject);
        if (!a || !["stand", "talk", "look_up", "walk", "carry", "scared", "cheer"].includes(a.pose) || (a.hold && buildCast()[a.hold]?.role === "baby")) continue;
        if (act === "ride" && !(s.objects ?? []).some(RIDEABLE)) continue;
        const cast = buildCast(), keys = (s.lines ?? [s.line]).flatMap((i) => requiredKeys(lineKeys[i]));
        const before = new Set(keys.filter((k) => covers(k, s, cast)).map((k) => k.label));
        const saved = JSON.stringify(s.actors), savedUsed = new Set(used);
        a.pose = act;
        if (act === "climb") a.facing = "away"; else if (["fly", "swim", "kick", "drive", "throw", "push"].includes(act) && a.facing === "camera") a.facing = "right";
        if (act === "hug" && !(s.actors ?? []).some((x) => x !== a && !/^town\d$/.test(x.id))) {
          const other = L.who.find((id) => id !== a.id && humans.has(id)) ?? null, spot = free(s);
          if (other && spot && s.actors.length < 4) { s.actors.push({ id: other, spot, pose: "hug", expr: "happy", facing: a.id, hold: null }); used.add(other); }
        }
        if (act === "hug") pairHugs(s.actors, (id) => buildCast()[id]?.role === "baby");
        const cast2 = buildCast();
        const after = new Set(keys.filter((k) => covers(k, s, cast2)).map((k) => k.label));
        if ([...before].some((k) => !after.has(k))) { s.actors = JSON.parse(saved); used.clear(); for (const x of savedUsed) used.add(x); continue; }
        changed++;
      }
    }
    // an animal / built creature doing something
    for (const r of D.match.perLine[L.i]?.required ?? []) {
      if (!["creature.animal", "creature.built"].includes(r.capability)) continue;
      const cr = (D.production.creatures ?? []).find((c) => c.id === r.id) ?? (D.production.cast ?? []).find((c) => c.id === r.id);
      const asked = [L.subject === r.id ? act : null, ...(cr?.behaviours ?? [])].filter(Boolean).map((b) => (b in MAP ? MAP[b] : b));
      const st = asked.find((b) => ANIMAL_STATES.includes(b));
      if (!st) continue;
      for (const s of own) for (const o of s.objects ?? []) {
        const mine = (r.kitName && o.name === r.kitName) || (r.needId && o.needId === r.needId);
        if (!mine) continue;
        if (o.needId || OBJECT_CATALOG[o.name]?.states?.includes(st)) { o.state = st; changed++; }
      }
    }
  }
  return changed;
}
