// Blocky Worlds: the rule-based shot planner (owner: PLANNER). No AI: script + word timings + idea card -> timeline.
// Deterministic. The timeline format is CONTRACT.md's.
//
//   planVideo({ script, words, idea, lengthSec }) -> timeline
//   checkTimeline(timeline) -> string[]            (problems; empty = valid)
//   estimateWords(script, wpm = 260) -> [{ word, start, end }]   (silent fallback timings)
//
// The rules, in order: time every line from the words -> cut lines into shots at word starts (long lines into 2-3,
// short shots merged) -> read the world once (cast, monster, prop, rule sign, night) -> read every shot's own words
// (set, light, who, doing what, the monster's state, inserts) -> pick a camera with variety.
import { hashSeed } from "./lib/rng.js";
import { norm, tokens, estimateWords, alignTokens } from "./lib/planText.js";

export { estimateWords };

export const SETS = ["street", "bedroom", "school", "woods"];
export const CAMERAS = ["wide", "medium", "closeup", "low", "over_shoulder", "insert"];
export const LIGHTS = ["day", "night", "warm"];
export const POSES = ["stand", "walk", "run", "point", "scared", "sit", "carry", "wave", "look_up", "talk", "sleep", "cheer"];
export const EXPRS = ["neutral", "happy", "sad", "scared", "surprised", "angry", "sleepy", "smirk", "cry", "excited", "shush"];
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
  const lines = script.lines.map((l, i) => ({ i, part: l.part, text: l.text, toks: flat.filter((t) => t.line === i) }));
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
function splitLine(L) {
  const dur = L.end - L.start;
  let n = dur > PACE.split3At ? 3 : dur > PACE.splitAt ? 2 : 1;
  if (L.i === 0) n = dur > PACE.split3At ? 3 : dur >= 2 * PACE.minShot ? 2 : 1; // rule: the sign, then the world
  const cuts = [];
  for (let j = 1; j < n; j++) {
    const target = L.start + (dur * j) / n;
    const lo = (cuts.at(-1)?.t ?? L.start) + PACE.minShot, hi = L.end - PACE.minShot * (n - j);
    let best = null, bestScore = Infinity;
    L.toks.forEach((tok, k) => {
      if (k === 0 || tok.t < lo || tok.t > hi || tok.w === L.toks[k - 1].w) return;
      const before = L.toks[k - 1].raw;
      // cut only where a phrase ends: after punctuation, or before a preposition / conjunction (never "the | sock")
      const bonus = /[.!?]["']?$/.test(before) ? 0.8 : /,$/.test(before) ? 0.6 : PHRASE_START.test(tok.n) && !PHRASE_GLUE.test(norm(before)) ? 0.3 : -1;
      if (bonus < 0) return;
      const score = Math.abs(tok.t - target) - bonus;
      if (score < bestScore) { bestScore = score; best = { k, t: tok.t }; }
    });
    if (best) cuts.push(best);
  }
  const edges = [{ k: 0, t: L.start }, ...cuts, { k: L.toks.length, t: L.end }];
  const segs = [];
  for (let j = 0; j + 1 < edges.length; j++) {
    const toks = L.toks.slice(edges[j].k, edges[j + 1].k);
    segs.push({ start: edges[j].t, end: edges[j + 1].t, line: L.i, lines: [L.i], part: L.part, toks, text: toks.map((t) => t.raw).join(" "), sub: j, subs: edges.length - 1 });
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
const TITLE_RE = /\b(Mr|Mrs|Ms|Miss|Dr|Coach|Aunt|Uncle|Grandma|Grandpa|Granny|Nana|Officer|Principal|Sheriff|Mayor)\.?\s+([A-Z][a-z]+)/g;
const NOT_NAMES = new Set(["i", "im", "id", "ive", "ill", "the", "a", "an", "and", "but", "then", "now", "so", "until", "past", "even", "still", "every", "our", "my", "we", "it", "its", "in", "at", "on", "one", "two", "three", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "shh", "you", "he", "she", "they", "that", "this", "not", "no", "any", "long", "up", "god"]);
const SUBJECT_VERB = /^(\w+ed|is|was|has|had|says|said|ran|sat|got|took|held|made|went|came|saw|told|keeps?|kept|learned|screams?|cries|cried|laughs?|grabbed|woke|slept|threw|knew|lives?|loves?|can|could|would|will)$/;
const MONSTER_WORDS = /\b(monster|beast|creature|yeti|ghost|giant|troll|ogre)\b/i;
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

  // monster
  let monster = null;
  const theX = {};
  for (const m of `${idea?.opener ?? ""} ${idea?.twist ?? ""} ${idea?.teaser ?? ""} ${lines.join(" ")}`.matchAll(/\b[Tt]he ([A-Z][a-z]+)\b/g)) theX[m[1]] = (theX[m[1]] ?? 0) + 1;
  const mName = Object.entries(theX).filter(([w, c]) => c >= 2 && !FAMILY[w.toLowerCase()]).sort((a, b) => b[1] - a[1])[0]?.[0];
  const ideaText = `${idea?.opener ?? ""} ${idea?.premise ?? ""} ${idea?.twist ?? ""} ${idea?.teaser ?? ""} ${idea?.price ?? ""}`;
  if (mName) monster = { name: `The ${mName}`, key: norm(mName) };
  else if (MONSTER_WORDS.test(ideaText)) { const w = ideaText.match(MONSTER_WORDS)[1].toLowerCase(); monster = { name: `The ${w[0].toUpperCase()}${w.slice(1)}`, key: w }; }
  if (monster) {
    const about = [ideaText, ...lines.filter((l) => norm(l).includes(monster.key))].join(" ");
    monster.type = FURRY.test(about) ? "furry" : "tall";
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
    if (!people.has(id)) people.set(id, { role: "adult", name: `${m[1]}${/^(Mr|Mrs|Ms|Dr)$/.test(m[1]) ? "." : ""} ${m[2]}`, elder: /^(Grandma|Grandpa|Granny|Nana)$/.test(m[1]) || undefined });
  }
  // untitled names: capitalized mid-sentence, the subject of a verb at least once, or named ("call her Bean")
  const alias = {};
  lines.forEach((text, li) => {
    const toks = tokens(text);
    toks.forEach((raw, k) => {
      const word = raw.replace(/[^A-Za-z']/g, "").replace(/'s$/, "");
      if (!/^[A-Z][a-z]+$/.test(word)) return;
      const n = word.toLowerCase();
      if (NOT_NAMES.has(n) || FAMILY[n] || n === narrator.toLowerCase() || n === monster?.key || people.has(n)) return;
      const sentenceStart = k === 0 || /[.!?]["']?$/.test(toks[k - 1]);
      const named = k >= 2 && /^(call|called|named|name's|is)$/i.test(norm(toks[k - 2])) || k >= 1 && /^(named)$/i.test(norm(toks[k - 1]));
      const subject = !sentenceStart && !/'s$/.test(raw) && !/[.,!?]$/.test(raw) && SUBJECT_VERB.test(norm(toks[k + 1] ?? ""));
      const subject2 = sentenceStart && SUBJECT_VERB.test(norm(toks[k + 1] ?? "")) && !/[.,!?]$/.test(raw) && lines.join(" ").split(word).length > 2;
      if (!(named || subject || subject2)) return;
      const near = `${lines[li - 1] ?? ""} ${text}`.toLowerCase();
      const baby = /\bbaby\b/.test(near);
      const rel = (near.match(/\b(sister|brother)\b/) ?? [])[1];
      people.set(n, { role: "kid", name: word, baby: baby || undefined });
      if (named && rel) { alias[rel] = n; if (baby) alias.baby = n; }
    });
  });
  // the prop
  const propWords = tokens(idea?.prop ?? "").map(norm);
  const propKey = propWords.at(-1) ?? null;
  // the rule's marker (something above heads)
  const rule = String(idea?.opener ?? lines[0] ?? "");
  const mk = rule.toLowerCase().match(/\b(numbers?|tags?|price|crowns?|stars?|halos?|labels?|scores?|timers?|counters?)\b/);
  const marker = mk ? { on: "all", kind: /crown|halo|star/.test(mk[1]) ? "ring" : /price|tag|label/.test(mk[1]) ? "tag" : "icon", text: (rule.match(/\d+|[$¢€]\S*/) ?? ["?"])[0] } : null;
  return { narrator, people, alias, monster, propKey, marker, sign: signText(rule), baseSet: settingToSet(idea?.setting),
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
      if (world.people.has(noun) || world.alias[noun]) { const id = world.alias[noun] ?? noun; return { pose: "carry", hold: world.people.get(id)?.baby ? "baby" : null, carries: id }; }
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
function whoIn(seg, world, ctx) {
  const toks = seg.toks.map((t) => t.raw);
  const found = [];
  const push = (id, k, possessive) => { if (!found.some((f) => f.id === id)) found.push({ id, k, possessive }); };
  for (let k = 0; k < toks.length; k++) {
    const raw = toks[k], n = norm(raw), poss = /'s[,.!?]*$/i.test(raw) && !/^(it|that|he|she|there|here|what|who|let)'s/i.test(raw);
    const base = poss ? norm(raw.replace(/'s[,.!?]*$/i, "")) : n;
    const title = raw.match(/^(Mr|Mrs|Ms|Miss|Dr|Coach|Aunt|Uncle|Grandma|Grandpa|Officer|Principal|Sheriff|Mayor)\.?$/);
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
    if (/^(he|she|him|her|they)$/.test(n) && ctx.last && ctx.lastLine >= seg.line - 2) { push(ctx.last, k, false); continue; }
    if (/^(we|us)$/.test(n)) { push("me", k, false); if (ctx.last && ctx.lastLine >= seg.line - 2) push(ctx.last, k, false); continue; }
  }
  if (found.some((f) => f.id !== "me")) { ctx.last = found.filter((f) => f.id !== "me").at(-1).id; ctx.lastLine = seg.line; }
  const low = seg.text.toLowerCase();
  return { found, group: GROUP_RE.test(low), place: PLACE_RE.test(low) };
}

function monsterIn(seg, world, ctx, lineIdx, partInfo) {
  const M = world.monster;
  if (!M) return null;
  const low = seg.text.toLowerCase(), n = seg.toks.map((t) => t.n);
  const named = n.some((w) => w.startsWith(M.key)) || MONSTER_WORDS.test(low) || (seg.part !== "rule" && seg.part !== "tour" && /\bsomething\b/.test(low));
  const lair = M.lair && n.includes(M.lair);
  const active = ctx.monsterLine != null && seg.line - ctx.monsterLine <= 4;
  const itSubject = active && /(^|[.!?,]\s*|\band\s+|\bthen\s+)it\b(?!'s)/i.test(seg.text);
  const body = active && seg.part !== "rule" && /\b(arms|legs|head|eyes|ear|ears|claws|teeth|fingers|fur|shaped like)\b/.test(low);
  const fragment = active && ctx.prevMonster && !seg.toks.some((t) => ME_RE.test(t.n)) && /^(still|any|and still|just|long|no|nothing)\b/i.test(seg.text);
  if (!(named || lair || itSubject || body || fragment)) return null;
  ctx.monsterLine = seg.line;
  if (seg.part === "closer" && /\b(never came back|gone|never again|left)\b/.test(low)) return { spot: "far", state: "flee", absent: true };
  const flee = /\b(turned away|away|past me|over the hill|looking for|ran off|left|fled|gone|followed)\b/.test(low);
  let state;
  if (seg.part === "rule" || seg.part === "tour" || seg.part === "me") state = "lurk";
  else if (seg.part === "until") {
    const pos = partInfo.until ? (lineIdx - partInfo.until[0]) / Math.max(1, partInfo.until[1] - partInfo.until[0]) : 1;
    state = /\b(unfolded|appeared|rose|emerged|arms|legs|head|shaped like|faster|toward|towards|closer|climbed down|reached|coming)\b/.test(low) || pos >= 0.5 ? "reach" : "lurk";
    if (lair && !named && !itSubject && state === "lurk") state = "lurk";
  } else if (seg.part === "discovery") state = "reveal";
  else state = flee ? "flee" : "reveal";
  if (seg.part === "closer") state = "flee";
  let spot = state === "lurk" || state === "flee" ? "far" : "back";
  // a monster that lives in a tower (the street and woods sets have one, spot "tower") is shown up on it while it lurks
  // there and while it comes down from it
  if (/\btower\b/.test(M.lairPhrase ?? "") && (state === "lurk" || state === "reach") && (lair || /\b(top of it|unfolded|ladder|climbed down)\b/.test(low))) spot = "tower";
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
  const passing = hit && (/\bpast the\b/.test(low) || opts.place);
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
  return [...prefs, "medium", "closeup", "wide", "low", "over_shoulder"].find(ok) ?? "medium";
}

// ---------------------------------------------------------------- 6. the plan
export function planVideo({ script, words, idea = {}, lengthSec = null } = {}) {
  if (!script?.lines?.length) throw new Error("planVideo: script.lines is empty");
  const W = Array.isArray(words) && words.length ? words : estimateWords(script);
  const duration = r3(W.at(-1).end + PACE.tail);
  const lines = timeLines(script, W, duration);
  const segs = mergeShort(lines.flatMap(splitLine));
  const world = readWorld(script, idea);
  const title = script.title ?? idea.title ?? "Untitled";
  const mood = idea.mood ?? "horror";

  const partRange = {};
  script.lines.forEach((l, i) => { partRange[l.part] = partRange[l.part] ? [partRange[l.part][0], i] : [i, i]; });
  const lateNight = script.lines.some((l, i) => i >= (partRange.until?.[0] ?? Infinity) && l.part !== "closer" && NIGHT_WORDS.test(l.text.toLowerCase()));
  const nightFrom = (mood === "horror" || lateNight) && partRange.until ? partRange.until[0] : Infinity;

  const ctx = { set: world.baseSet, outdoor: ["street", "woods"].includes(world.baseSet) ? world.baseSet : "street", last: null, lastLine: -9, monsterLine: null, prevMonster: false };
  const used = new Set(["me"]);
  const hist = [];
  const shots = [];
  const towns = ["town1", "town2", "town3"];

  segs.forEach((seg, si) => {
    const low = seg.text.toLowerCase();
    const who = whoIn(seg, world, ctx);
    const monsterState = monsterIn(seg, world, ctx, seg.line, partRange);
    ctx.prevMonster = !!monsterState;
    const ms = monsterState && !monsterState.absent ? { spot: monsterState.spot, state: monsterState.state } : null;
    const actorIds = who.found.filter((f) => !f.possessive).map((f) => f.id);
    const placeShot = (who.place && !actorIds.length) || !!monsterState?.absent;
    let { set, moved, passing } = setFor(seg, world, ctx, actorIds, { place: placeShot, monster: !!ms });
    // the townsfolk as a crowd live in the town: a group line with no place named cuts there (without moving the story)
    if (who.group && !actorIds.length && !ms && set !== world.townSet && !Object.values(SET_WORDS).some((re) => re.test(low))) { moved = true; passing = true; set = world.townSet; }
    seg.set = set; seg.passing = passing;

    // light
    const light = seg.part === "closer" ? "warm" : seg.line >= nightFrom || NIGHT_WORDS.test(low) ? "night" : "day";

    // inserts
    let insert = null;
    if (si === 0) insert = { kind: "sign", text: world.sign };   // the video opens on the rule sign
    else if (/\b(sign|note|letter|poster|list|notice|newspaper)\b/.test(low) && !/sign language/.test(low)) {
      const says = seg.text.match(/\b(?:says|said|reads|read)\s+["']?([^"'.!?]+)/i);
      insert = { kind: /\b(note|letter|list)\b/.test(low) ? "note" : "sign", text: (says ? says[1] : seg.text.replace(/^(past|and|then|now)\s+/i, "")).replace(/[^A-Za-z0-9' ]/g, " ").trim().split(/\s+/).slice(0, 6).join(" ").toUpperCase() };
    } else if (/\bfor sale\b/.test(low)) insert = { kind: "sign", text: "FOR SALE" };
    else if (/\bclosed\b/.test(low)) insert = { kind: "sign", text: "CLOSED" };
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
    const groupShot = who.group && !insert;
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
    if (!actors.length && !ms && !insert && !placeShot && prev?.actors.length && !prev.monsterState && seg.line - prev.line <= 1 && !who.group) {
      const gp = poseFrom(seg.toks.map((t) => t.raw), 0, world);
      actors = prev.actors.map((a) => ({ id: a.id, pose: gp.pose !== "stand" && gp.pose !== "carry" ? gp.pose : a.pose, hold: a.hold, neg: gp.neg }));
    }
    // the monster alone twice in a row: cut to the kid watching it (threat / face / threat)
    if (ms && !actors.length && prev?.monsterState && !prev.actors.length && ms.state !== "flee") actors.push({ id: "me", pose: ms.state === "lurk" ? "look_up" : "scared", hold: null });
    // nobody named, no group, no monster, no insert: townsfolk doing the line (tour examples), or a place shot
    if (!actors.length && !ms && !insert) {
      if (placeShot) actors = [];
      else {
        const gp = poseFrom(seg.toks.map((t) => t.raw), 0, world);
        actors = [0, 1].map((k) => ({ id: towns[k], pose: gp.pose === "carry" ? "stand" : gp.pose, hold: null, neg: gp.neg }));
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
    actors.forEach((a) => used.add(a.id));

    // focus + camera
    const named = actors.filter((a) => !a.id.startsWith("town"));
    let focus = insert ? "insert" : ms && (ms.state !== "lurk" || !actors.length) ? "monster" : groupShot || (!named.length && actors.length > 1) ? "group" : actors[0]?.id ?? (ms ? "monster" : "group");
    const prefs = [];
    const feeling = /\b(love|best friend|secret|remembered|just|not on purpose|real|only|loudest|scared|alone|breath)\b/.test(low);
    if (insert) prefs.push("insert");
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
    if (camera === "low" && ms) focus = "monster";
    if (camera === "closeup" && focus === "group") focus = actors.find((a) => a.id === "me")?.id ?? actors[0]?.id ?? "group";
    hist.push({ camera, focus, set, line: seg.line });

    const inRuleOrTour = seg.part === "rule" || seg.part === "tour";
    shots.push({
      start: r3(seg.start), end: r3(seg.end), line: seg.line, lines: seg.lines, part: seg.part, set, light, camera, focus,
      actors, monsterState: ms, insert, marker: world.marker && inRuleOrTour && actors.length ? world.marker : null,
      seed: R("seed") % 1000, text: seg.text,
    });
  });

  // cast: everyone used, plus 2-3 townsfolk for the group shots
  const cast = {};
  for (const id of used) {
    const p = id.startsWith("town") ? { role: "adult", name: `Townsperson ${id.slice(4)}` } : world.people.get(id) ?? familyPerson(id);
    cast[id] = { role: p.role, name: p.name, seed: hashSeed(`${title}:${p.name}`) % 1000, ...(p.baby ? { baby: true } : {}), ...(p.elder ? { elder: true } : {}) };
  }
  for (const t of towns.slice(0, 2)) if (!cast[t]) cast[t] = { role: "adult", name: `Townsperson ${t.slice(4)}`, seed: hashSeed(`${title}:${t}`) % 1000 };

  return {
    version: 1, fps: 24, width: 1080, height: 1920, duration, title, lengthSec,
    cast,
    monster: world.monster ? { type: world.monster.type, name: world.monster.name, glow: world.monster.glow, ...(world.monster.lairPhrase ? { lair: world.monster.lairPhrase } : {}) } : null,
    shots,
    captions: W.map((w) => ({ word: w.word, start: r3(w.start), end: r3(w.end) })),
    audio: { voice: "voice.wav", music: "music.wav" },
    lines: lines.map((L) => ({ part: L.part, text: L.text, start: r3(L.start), end: r3(L.end) })),
  };
}

function familyPerson(id) {
  const adult = /^(mom|dad|grandma|grandpa)$/.test(id);
  return { role: adult ? "adult" : "kid", name: id[0].toUpperCase() + id.slice(1), baby: id === "baby" || undefined, elder: /^grand/.test(id) || undefined };
}

// ---------------------------------------------------------------- 7. the check
export function checkTimeline(tl) {
  const out = [];
  if (!tl || typeof tl !== "object") return ["no timeline"];
  if (tl.version !== 1 || tl.fps !== 24 || tl.width !== 1080 || tl.height !== 1920) out.push("header must be version 1, 24 fps, 1080x1920");
  if (!(tl.duration > 0)) out.push("duration must be > 0");
  const shots = tl.shots ?? [];
  if (!shots.length) return [...out, "no shots"];
  const eps = 1e-6;
  if (Math.abs(shots[0].start) > eps) out.push("the first shot must start at 0");
  if (Math.abs(shots.at(-1).end - tl.duration) > eps) out.push("the last shot must end at the duration");
  if (!["wide", "insert"].includes(shots[0].camera)) out.push("the first shot must be wide or insert");
  shots.forEach((s, i) => {
    const at = `shot ${i}`;
    if (i > 0 && Math.abs(s.start - shots[i - 1].end) > eps) out.push(`${at}: gap/overlap with the previous shot`);
    if (!(s.end > s.start)) out.push(`${at}: empty`);
    else if (s.end - s.start < 0.5) out.push(`${at}: shorter than 0.5 s`);
    if (!SETS.includes(s.set)) out.push(`${at}: unknown set ${s.set}`);
    if (!LIGHTS.includes(s.light)) out.push(`${at}: unknown light ${s.light}`);
    if (!CAMERAS.includes(s.camera)) out.push(`${at}: unknown camera ${s.camera}`);
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
    if (s.monsterState) {
      if (!tl.monster) out.push(`${at}: monsterState without a monster`);
      if (!MONSTER_STATES.includes(s.monsterState.state) || !SPOTS.includes(s.monsterState.spot) && s.monsterState.spot !== "tower") out.push(`${at}: bad monsterState`);
    }
    if (s.focus === "monster" && !s.monsterState) out.push(`${at}: focus monster without the monster`);
    if (s.focus !== "monster" && s.focus !== "insert" && s.focus !== "group" && !ids.includes(s.focus)) out.push(`${at}: focus ${s.focus} is not on screen`);
    if (s.insert && !(s.insert.text && s.insert.text.split(/\s+/).length <= 6)) out.push(`${at}: insert text missing or longer than 6 words`);
  });
  if (tl.lines) {
    const covered = new Set(shots.flatMap((s) => s.lines ?? [s.line]));
    tl.lines.forEach((_, i) => { if (!covered.has(i)) out.push(`line ${i} has no shot`); });
  }
  const caps = tl.captions ?? [];
  if (!caps.length) out.push("no captions");
  caps.forEach((c, i) => {
    if (!(c.end >= c.start) || c.start < 0 || c.end > tl.duration + eps) out.push(`caption ${i} out of range`);
    if (i && c.start < caps[i - 1].start - eps) out.push(`caption ${i} out of order`);
  });
  if (!tl.audio?.voice) out.push("no audio.voice");
  return out;
}
