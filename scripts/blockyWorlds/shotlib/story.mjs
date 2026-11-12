// Blocky Worlds shot library, step 3: the STORY + CONTINUITY layer over the reference analysis (not single shots).
//   node scripts/blockyWorlds/shotlib/story.mjs                     # FREE (default): story-stats.json per video, the
//                                                                     placeholder patterns file, and the DRY-RUN PRICE
//   node scripts/blockyWorlds/shotlib/story.mjs --paid --yes --max-usd 0.10 [--synth-model haiku|sonnet] [--only <id>]
//        [--skip-synth] [--synth-only] [--allow-partial]           # PAID (owner's go): per-video analysis + one synthesis
// Needs ANTHROPIC_API_KEY (or ANTHROPIC_KEY) for the paid run. Refuses to call the API without ALL of --paid, --yes and
// --max-usd; stops before any request whose worst case would pass the cap; never retries a failed request; incremental
// (a video whose story-analysis.json is current is skipped).
//
// Reads  reference/blocky-worlds/analysis/<id>/{shots.json, visual.json, descriptions.json}     (git-ignored)
// Writes reference/blocky-worlds/analysis/<id>/story-stats.json      FREE: beats, sequences, wides, places, arc, characters
//        reference/blocky-worlds/analysis/<id>/story-analysis.json   PAID: the abstracted STORY ANALYSIS (Haiku, text only)
//        reference/blocky-worlds/analysis/_story-synthesis.json     PAID: the raw synthesis answer
//        scripts/blockyWorlds/engine/lib/data/storyPatterns.json    COMMITTED: abstract patterns + measured numbers only
// PATTERNS ONLY: every model answer is scrubbed of the names found in the transcripts, and the committed file is refused
// if any still leaks. Never copy a reference video's story, names, characters, footage or exact shots.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BEATS, BEAT_SHARES, SEQ_ROLES, CATEGORY_ROLE, DISTANCE_INDEX, DEFAULT_PATTERNS, STORY_PATTERNS_FILE } from "../engine/lib/storyPatterns.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..", "..");
export const ANALYSIS_DIR = path.join(ROOT, "reference", "blocky-worlds", "analysis");
export const STORY_VERSION = 1;
export const MODELS = Object.freeze({ haiku: "claude-haiku-5-5", sonnet: "claude-sonnet-5-5" });

// USD per 1M tokens: engine/lib/builder/design.js PRICE wins when it loads (this mirrors it). Haiku 5.5 bills prompts
// over 100K tokens at $0.50 / $2.50.
let PRICE = { [MODELS.haiku]: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 }, [MODELS.sonnet]: { input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5 } };
try { const m = await import("../engine/lib/builder/design.js"); if (m.PRICE?.[MODELS.haiku] && m.PRICE?.[MODELS.sonnet]) PRICE = m.PRICE; } catch { /* engine mid-edit: keep the fallback */ }
const HAIKU_LONG = { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 };
const rateOf = (model, inputTokens) => (model === MODELS.haiku && inputTokens > 100000 ? HAIKU_LONG : PRICE[model]);

/** tokens from text (rounded up, a little pessimistic): ~3.6 chars a token for prose, ~3.0 for JSON / rows */
export const tok = (s, json = false) => Math.ceil(String(s ?? "").length / (json ? 3.0 : 3.6));

// ============================================================================================ small helpers
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : null);
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const countBy = (a) => { const m = {}; for (const x of a) if (x != null) m[x] = (m[x] ?? 0) + 1; return m; };
const top = (m, n = 3) => Object.entries(m).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n);
const mode = (a) => top(countBy(a), 1)[0]?.[0] ?? null;
/** quantiles of a list -> { p10, p25, p50, p75, p90, n } (null when empty) */
export function quant(list) {
  const a = list.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const at = (q) => { const i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return r2(a[lo] + (a[hi] - a[lo]) * (i - lo)); };
  return { p10: at(0.1), p25: at(0.25), p50: at(0.5), p75: at(0.75), p90: at(0.9), n: a.length };
}
/** runs of a key along the shots (how often something "comes back") */
const runsOf = (keys) => { let runs = 0, prev; for (const k of keys) { if (k != null && k !== prev) runs++; prev = k; } return runs; };

// ============================================================================================ 1. beats (free)
const ME_RE = /\b(except me|but (not )?me\b|but I\b|I'm the only|I was the only|I'm not|I don't|I never|my (mom|mum|dad|mother|father|grandma|grandpa|gran|brother|sister|family|name|best friend)|as for me|me\? I|I was born|I live|I'm \w+ years)/i;
const UNTIL_RE = /\b(until (one|that|the|last)|one (night|day|morning|evening|afternoon|winter|summer)|that (night|morning|day)|but (then|one)|then one|last (night|week|year))\b/i;
const DISC_RE = /\b(that's when|realiz|realis|found out|turns out|the truth|knew why|figured out|discover|that's why|was never|wasn't (a|an|the)|weren't|actually|the real reason|secret|it was (a|an|the|never))\b/i;
const CLIMAX_RE = /\b(so I|I grabbed|I ran|I took|I climbed|I jumped|I pulled|I threw|I blew|I held|I used|I yelled|I screamed|I pushed|with all my|I had an idea|I remembered|just in time|I didn't think)\b/i;
const CLOSER_RE = /\b(now|ever since|to this day|from that day|and that's why|these days|since then|still|every (night|day|year) since|never again)\b/i;
const CUM = (() => { let c = 0; const o = {}; for (const b of BEATS) { o[b] = c; c += BEAT_SHARES[b]; } return o; })();

/**
 * Transcript lines -> the protocol's seven beats. Each boundary is found by its beat words (in order: me after the
 * tour, until after me...) or, when the words are missing, by the protocol's word shares on the time line.
 * -> [{ beat, from, to (line indexes, to exclusive), t0, t1, method: "words" | "share" }]
 */
export function segmentBeats(lines, duration = null) {
  const L = lines.length, D = duration ?? lines.at(-1)?.t1 ?? 0;
  if (!L) return [];
  const atTime = (f) => { const t = f * D; const i = lines.findIndex((l) => (l.t0 ?? 0) >= t - 1e-6); return i < 0 ? L - 1 : i; };
  const find = (re, from, to) => { for (let i = Math.max(0, from); i < Math.min(L, to); i++) if (re.test(lines[i].text ?? "")) return i; return -1; };
  const start = { rule: 0 }, method = { rule: "words" };
  start.tour = Math.min(1, L - 1); method.tour = "words";
  // each beat's words are searched only near where the protocol's shares put it (-15% .. +20% of the time line), so a
  // stray "actually" late in the climax does not make a one-line climax
  const pick = (b, re, after, to) => {
    const from = Math.max(after, atTime(Math.max(0, CUM[b] - 0.15))), end = Math.min(to, atTime(Math.min(1, CUM[b] + 0.2)) + 1);
    const i = find(re, from, end);
    start[b] = i >= 0 ? i : Math.max(after, atTime(CUM[b])); method[b] = i >= 0 ? "words" : "share";
  };
  pick("me", ME_RE, Math.max(2, start.tour + 1), L);
  pick("until", UNTIL_RE, start.me + 1, L);
  pick("discovery", DISC_RE, start.until + 2, L - 2);
  pick("climax", CLIMAX_RE, start.discovery + 1, L - 1);
  pick("closer", CLOSER_RE, Math.max(start.climax + 1, Math.floor(L * 0.8)), L);
  if (method.closer === "share") start.closer = Math.max(start.climax + 1, Math.min(L - 1, atTime(CUM.closer)));
  // non-decreasing, inside the script
  let prev = 0;
  for (const b of BEATS) { start[b] = Math.min(L, Math.max(prev, start[b])); prev = start[b]; }
  return BEATS.map((b, k) => {
    const from = start[b], to = k + 1 < BEATS.length ? start[BEATS[k + 1]] : L;
    return { beat: b, from, to, t0: lines[from]?.t0 ?? D, t1: to > from ? lines[to - 1].t1 : lines[from]?.t0 ?? D, method: method[b] };
  });
}

// ============================================================================================ 2. per-video stats (free)
const ANCHOR_WHO = new Set(["creature_only", "people_and_creature", "town_or_place_only"]);
const CREATURE_WHO = new Set(["creature_only", "people_and_creature"]);
const PEOPLE_WHO = new Set(["people_only", "people_and_creature"]);
const PLACE_STOP = new Set(["the", "a", "an", "of", "on", "in", "at", "near", "by", "with", "and", "its", "his", "her", "their", "to", "from", "over", "under", "inside", "outside", "top", "edge", "side", "view", "area", "small", "big", "large", "giant", "blocky", "little", "old", "new", "creature's", "giant's"]);
/** a place string -> a short key ("the town square at dusk" -> "square") */
export const placeKey = (s) => String(s ?? "").toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter((w) => w && !PLACE_STOP.has(w)).slice(0, 4).at(-1) ?? null;
const ROLE_WORDS = Object.freeze({
  kid: /\b(kid|kids|child|children|boy|girl|son|daughter|teen|toddler)\b/i,
  parent: /\b(mom|mum|mother|dad|father|parent|parents)\b/i,
  elder: /\b(grandma|grandpa|grandmother|grandfather|granny|elder|elderly|old (man|woman|lady))\b/i,
  baby: /\b(baby|infant)\b/i,
  neighbour: /\b(neighbou?r|villager|townsperson|resident|shopkeeper|baker|farmer|fisherman|teacher|doctor)\b/i,
  soldier: /\b(soldier|soldiers|knight|knights|guard|guards|army|warrior|archer|archers)\b/i,
  leader: /\b(king|queen|mayor|chief|leader|captain|general)\b/i,
  crowd: /\b(crowd|townsfolk|villagers|citizens|townspeople|everyone|people)\b/i,
});
const CUES = /\b(red|blue|green|yellow|orange|purple|pink|white|black|brown|grey|gray|gold|hoodie|hat|cap|cape|helmet|armou?r|dress|scarf|backpack|glasses|beard|apron|crown|jacket|overalls|boots|lantern|torch|shield|sword)\b/gi;
const FIRST_PERSON = /\b(I|me|my|I'm|I've|I'd|mine|myself)\b/;

/** roles a description's subject / who / action text names */
export const rolesIn = (text) => Object.entries(ROLE_WORDS).filter(([, re]) => re.test(text ?? "")).map(([r]) => r);

/**
 * One video's STORY STATS from its shots (+ transcript lines) and, when present, the shot descriptions.
 * Pure: { id, sh (shots.json), desc (descriptions.json | null) } -> stats.
 */
export function computeStats({ id, sh, desc = null }) {
  const shots = sh?.shots ?? [], lines = sh?.lines ?? [], D = sh?.duration ?? shots.at(-1)?.t1 ?? 0;
  const beats = segmentBeats(lines, D);
  const lineBeat = new Map();
  for (const b of beats) for (let i = b.from; i < b.to; i++) lineBeat.set(lines[i].n ?? i + 1, b.beat);
  const beatOfShot = (s) => {
    const n = (s.lines ?? [])[0];
    if (n != null && lineBeat.has(n)) return lineBeat.get(n);
    const mid = (s.t0 + s.t1) / 2;
    return beats.find((b) => mid >= b.t0 - 1e-6 && mid < b.t1 + 1e-6)?.beat ?? beats.at(-1)?.beat ?? null;
  };
  const D2 = desc?.shots ?? {};
  const rows = shots.map((s) => {
    const d = D2[s.n] ?? D2[String(s.n)] ?? null;
    return {
      n: s.n, t0: s.t0, dur: s.dur, beat: beatOfShot(s), line: (s.lines ?? [])[0] ?? null, move: s.move?.family ?? "unknown", d,
      role: d ? CATEGORY_ROLE[d.libraryCategory] ?? "other" : null,
      dist: d ? DISTANCE_INDEX[d.distance] ?? null : null,
      anchor: !!d && (d.distance === "extreme_wide" || d.distance === "wide") && ANCHOR_WHO.has(d.who),
      creature: !!d && CREATURE_WHO.has(d.who), people: !!d && PEOPLE_WHO.has(d.who),
      night: !!d && (d.timeOfDay === "night" || d.timeOfDay === "dusk"),
      place: d ? placeKey(d.place) : null,
      roles: d && PEOPLE_WHO.has(d.who) ? rolesIn(`${d.subject} ${d.action}`) : [],
    };
  });
  const described = rows.filter((r) => r.d).length;
  const hasDesc = described > 0;

  // per beat: pace, moves, and (with descriptions) distance, wides, creature vs people, night, roles, emotion
  const perBeat = {};
  for (const b of beats) {
    const own = rows.filter((r) => r.beat === b.beat);
    if (!own.length) continue;
    const dd = own.filter((r) => r.d), ds = own.map((r) => r.dur).sort((x, y) => x - y);
    perBeat[b.beat] = {
      sec: r2(b.t1 - b.t0), share: D ? r2((b.t1 - b.t0) / D) : null, shots: own.length, lines: b.to - b.from,
      meanShot: r2(mean(own.map((r) => r.dur))), medianShot: r2(ds[Math.floor(ds.length / 2)]),
      moves: countBy(own.map((r) => r.move)),
      ...(dd.length ? {
        distance: r2(mean(dd.map((r) => r.dist).filter(Number.isFinite))), wideShare: r2(dd.filter((r) => r.dist != null && r.dist <= 1).length / dd.length),
        creatureShare: r2(dd.filter((r) => r.creature).length / dd.length), peopleShare: r2(dd.filter((r) => r.people).length / dd.length),
        nightShare: r2(dd.filter((r) => r.night).length / dd.length), timeOfDay: countBy(dd.map((r) => r.d.timeOfDay)),
        roles: dd.map((r) => r.role), emotions: top(countBy(dd.map((r) => String(r.d.emotion ?? "").toLowerCase().split(/[ ,/]+/)[0]).filter(Boolean))).map(([e]) => e),
        funny: dd.filter((r) => r.d.funnyBeat).length,
      } : {}),
    };
  }

  const out = {
    version: STORY_VERSION, video: id, duration: D, shots: shots.length, lines: lines.length, described, hasDescriptions: hasDesc,
    patternsOnly: "study material: never copy story, characters, names, footage or exact shots",
    beats: beats.map(({ beat, from, to, t0, t1, method }) => ({ beat, lines: [from, to], t0: r2(t0), t1: r2(t1), method })),
    perBeat,
  };
  if (!hasDesc) return out;

  // world establishing: the first shots (first 5 s, at least 3, at most 8)
  const firstN = Math.min(8, Math.max(3, rows.filter((r) => r.t0 < 5).length));
  const fw = rows.findIndex((r) => r.anchor), fp = rows.find((r) => r.people), fc = rows.find((r) => r.creature);
  out.establish = {
    firstShots: rows.slice(0, firstN).map((r) => ({ role: r.role, dist: r.d?.distance ?? null, who: r.d?.who ?? null })),
    shotsToWide: fw >= 0 ? fw + 1 : null, firstWideSec: fw >= 0 ? r2(rows[fw].t0) : null,
    firstPeopleSec: fp ? r2(fp.t0) : null, firstCreatureSec: fc ? r2(fc.t0) : null,
  };
  // recurring wides of the creature / town
  const wt = rows.filter((r) => r.anchor).map((r) => r.t0);
  const gaps = [...wt.map((t, i) => t - (i ? wt[i - 1] : 0)), D - (wt.at(-1) ?? 0)].filter((g) => g > 0.05);
  out.wides = { count: wt.length, perMin: D ? r2(wt.length / (D / 60)) : null, gapSec: quant(gaps), maxGapSec: r2(Math.max(0, ...gaps)), perBeat: countBy(rows.filter((r) => r.anchor).map((r) => r.beat)) };
  // recurring places: shots, how often the story comes back to them, where
  const pk = countBy(rows.map((r) => r.place));
  out.places = top(pk, 8).map(([key, n]) => ({ key, shots: n, returns: rows.reduce((a, r, i) => a + (r.place === key && rows[i - 1]?.place !== key ? 1 : 0), 0), beats: [...new Set(rows.filter((r) => r.place === key).map((r) => r.beat))] }));
  out.recurringPlaces = out.places.filter((p) => p.returns >= 2).length;
  // sequences: each beat's role string (repeats collapsed) and the n-grams across the video
  const collapsed = (a) => a.filter((x, i) => x !== a[i - 1]);
  out.sequences = { perBeat: Object.fromEntries(Object.entries(perBeat).map(([b, p]) => [b, collapsed(p.roles ?? [])])) };
  const grams = (k) => { const m = {}; for (const seq of Object.values(out.sequences.perBeat)) for (let i = 0; i + k <= seq.length; i++) { const g = seq.slice(i, i + k).join(">"); m[g] = (m[g] ?? 0) + 1; } return m; };
  out.sequences.bigrams = top(grams(2), 10); out.sequences.trigrams = top(grams(3), 10);
  // arc in pictures: per beat
  out.arc = BEATS.filter((b) => perBeat[b]?.roles).map((b) => ({ beat: b, timeOfDay: mode((rows.filter((r) => r.beat === b && r.d)).map((r) => r.d.timeOfDay)), meanShot: perBeat[b].meanShot, distance: perBeat[b].distance, creatureShare: perBeat[b].creatureShare, peopleShare: perBeat[b].peopleShare }));
  // characters: narrator (first-person lines with a kid on screen) and side roles: entrance, returns, intro distance, cues
  const fpLines = new Set(lines.filter((l) => FIRST_PERSON.test(l.text ?? "")).map((l) => l.n));
  const narr = rows.filter((r) => r.line != null && fpLines.has(r.line) && r.roles.includes("kid"));
  out.characters = {
    narrator: { firstPersonLines: fpLines.size, onScreenShots: narr.length, onScreenShare: r2(narr.length / Math.max(1, rows.length)), firstSec: narr[0] ? r2(narr[0].t0) : null, beats: countBy(narr.map((r) => r.beat)) },
    roles: Object.keys(ROLE_WORDS).map((role) => {
      const own = rows.filter((r) => r.roles.includes(role));
      if (!own.length) return null;
      const cues = countBy(own.flatMap((r) => (`${r.d.subject} ${r.d.action}`.match(CUES) ?? []).map((w) => w.toLowerCase())));
      return { role, shots: own.length, returns: rows.reduce((a, r, i) => a + (r.roles.includes(role) && !(rows[i - 1]?.roles ?? []).includes(role) ? 1 : 0), 0), firstSec: r2(own[0].t0), firstBeat: own[0].beat, introDist: own[0].d.distance, beats: [...new Set(own.map((r) => r.beat))], cues: top(cues, 4).map(([w]) => w) };
    }).filter(Boolean),
  };
  return out;
}

// ============================================================================================ 3. aggregate + placeholder (free)
/** many videos' stats -> the MEASURED block of the patterns file (numbers only) */
export function aggregate(list) {
  const S = list.filter(Boolean), D = S.filter((s) => s.hasDescriptions);
  const perBeat = {};
  for (const b of BEATS) {
    const own = S.map((s) => s.perBeat?.[b]).filter(Boolean), od = own.filter((p) => p.roles);
    if (!own.length) continue;
    perBeat[b] = {
      share: quant(own.map((p) => p.share)), meanShot: quant(own.map((p) => p.meanShot)),
      ...(od.length ? { distance: quant(od.map((p) => p.distance)), wideShare: quant(od.map((p) => p.wideShare)), creatureShare: quant(od.map((p) => p.creatureShare)), peopleShare: quant(od.map((p) => p.peopleShare)), nightShare: quant(od.map((p) => p.nightShare)), timeOfDay: mode(od.flatMap((p) => Object.entries(p.timeOfDay ?? {}).flatMap(([k, n]) => Array(n).fill(k)))) } : {}),
    };
  }
  const m = { videos: S.length, described: D.length, beatsByWords: Object.fromEntries(BEATS.map((b) => [b, S.filter((s) => s.beats?.find((x) => x.beat === b)?.method === "words").length])), perBeat };
  if (!D.length) return m;
  m.establish = { shotsToWide: quant(D.map((s) => s.establish?.shotsToWide)), firstWideSec: quant(D.map((s) => s.establish?.firstWideSec)), firstPeopleSec: quant(D.map((s) => s.establish?.firstPeopleSec)) };
  m.wideGapSec = { ...quant(D.map((s) => s.wides?.gapSec?.p50)), p90: quant(D.map((s) => s.wides?.maxGapSec))?.p50 ?? null };
  m.widesPerMin = quant(D.map((s) => s.wides?.perMin));
  m.recurringPlaces = quant(D.map((s) => s.recurringPlaces));
  m.narrator = { onScreenShare: quant(D.map((s) => s.characters?.narrator?.onScreenShare)), onScreenShots: quant(D.map((s) => s.characters?.narrator?.onScreenShots)) };
  // which side roles appear / recur, in how many videos; where they enter
  const roles = {};
  for (const s of D) for (const r of s.characters?.roles ?? []) { const o = (roles[r.role] ??= { videos: 0, recurs: 0, enter: [], closeIntro: 0 }); o.videos++; if (r.returns >= 2) o.recurs++; o.enter.push(r.firstBeat); if (DISTANCE_INDEX[r.introDist] >= 2) o.closeIntro++; }
  m.roles = Object.fromEntries(Object.entries(roles).map(([k, o]) => [k, { videos: o.videos, recurs: o.recurs, entersIn: mode(o.enter), closeIntro: o.closeIntro }]));
  // sequences: per beat, the trigrams with the number of videos that use them (support)
  const support = (k, beat = null) => { const m2 = {}; for (const s of D) { const seen = new Set(); for (const [b, seq] of Object.entries(s.sequences?.perBeat ?? {})) { if (beat && b !== beat) continue; for (let i = 0; i + k <= seq.length; i++) seen.add(seq.slice(i, i + k).join(">")); } for (const g of seen) m2[g] = (m2[g] ?? 0) + 1; } return m2; };
  m.sequences = { overall: top(support(3), 12).map(([g, n]) => ({ seq: g.split(">"), support: n })), perBeat: Object.fromEntries(BEATS.map((b) => [b, top(support(3, b), 3).map(([g, n]) => ({ seq: g.split(">"), support: n }))])) };
  m.firstShots = top(countBy(D.map((s) => (s.establish?.firstShots ?? []).slice(0, 3).map((f) => f.role).join(">"))), 3).map(([g, n]) => ({ seq: g.split(">"), support: n }));
  return m;
}

const label = (x, cuts, names) => (Number.isFinite(x) ? names[cuts.findIndex((c) => x <= c) < 0 ? names.length - 1 : cuts.findIndex((c) => x <= c)] : null);
/** the placeholder PATTERNS from the measured numbers alone (deterministic text; no model) */
export function placeholderPatterns(measured) {
  const P = JSON.parse(JSON.stringify(DEFAULT_PATTERNS.patterns)), M = measured ?? {};
  const nVid = M.described ?? 0;
  if (M.establish?.shotsToWide?.p50) P.worldEstablishing = { rule: `Open on the world: the first wide of the creature / town by shot ${Math.ceil(M.establish.shotsToWide.p75 ?? M.establish.shotsToWide.p50)} (median shot ${M.establish.shotsToWide.p50}, ~${M.establish.firstWideSec?.p50 ?? "?"} s in).`, firstShots: M.firstShots?.[0]?.seq ?? P.worldEstablishing.firstShots, support: M.firstShots?.[0]?.support ?? 0 };
  if (M.wideGapSec?.p50) P.recurringWide = { rule: `Return to a wide of the creature or town about every ${M.wideGapSec.p50} s (${M.wideGapSec.p25}-${M.wideGapSec.p75} s across videos).`, everySecMax: Math.max(6, Math.ceil(M.wideGapSec.p90 ?? M.wideGapSec.p75 * 1.5)), support: M.wideGapSec.n ?? 0 };
  const bt = [];
  for (const b of BEATS) { const s = M.sequences?.perBeat?.[b]?.[0]; if (s && s.support >= 2) bt.push({ beat: b, sequence: s.seq, rule: `${b}: ${s.seq.join(" > ")} (most common in this beat)`, support: s.support }); }
  if (bt.length) P.beatTemplates = bt;
  const ms = (M.sequences?.overall ?? []).filter((s) => new Set(s.seq).size === s.seq.length && s.support >= 2).slice(0, 5);
  if (ms.length) P.miniSequences = ms.map((s) => ({ sequence: s.seq, rule: "", support: s.support }));
  const all = BEATS.map((b) => M.perBeat?.[b]?.meanShot?.p50).filter(Number.isFinite), mid = all.length ? all.sort((a, b) => a - b)[Math.floor(all.length / 2)] : null;
  P.arc = BEATS.filter((b) => M.perBeat?.[b]).map((b) => {
    const p = M.perBeat[b];
    const pace = mid && p.meanShot?.p50 ? (p.meanShot.p50 < mid * 0.9 ? "fast" : p.meanShot.p50 > mid * 1.1 ? "slow" : "medium") : null;
    const focus = p.creatureShare?.p50 != null ? (p.creatureShare.p50 >= (p.peopleShare?.p50 ?? 0) + 0.15 ? "creature" : (p.peopleShare?.p50 ?? 0) >= p.creatureShare.p50 + 0.15 ? "people" : "both") : null;
    return { beat: b, timeOfDay: p.timeOfDay ?? null, pace, distance: label(p.distance?.p50, [1.4, 2.3], ["far", "medium", "close"]), focus, rule: "", support: p.meanShot?.n ?? 0 };
  });
  if (M.narrator?.onScreenShare?.p50 != null) P.characters = [{ rule: `The narrator is on screen in about ${Math.round(M.narrator.onScreenShare.p50 * 100)}% of shots (${Math.round((M.narrator.onScreenShare.p25 ?? 0) * 100)}-${Math.round((M.narrator.onScreenShare.p75 ?? 0) * 100)}%): introduced in the me part, back at the crisis and the climax.`, support: M.narrator.onScreenShare.n }];
  if (M.recurringPlaces?.p50 != null) P.continuity = [{ rule: `About ${M.recurringPlaces.p50} places recur per video (${M.recurringPlaces.p25}-${M.recurringPlaces.p75}): the story keeps coming back to the same few spots of one world.`, support: M.recurringPlaces.n }];
  P.note = nVid ? `placeholder from free stats of ${nVid} described videos` : "placeholder: pace per beat measured from the shot cuts; the rest are defaults until the shot descriptions exist";
  return P;
}

// ============================================================================================ 4. names guard (patterns only)
const COMMON_CAPS = new Set(["I", "I'm", "I've", "I'd", "I'll", "In", "The", "A", "An", "And", "But", "So", "Then", "Until", "One", "That", "This", "It", "It's", "We", "They", "He", "She", "You", "My", "Our", "Their", "His", "Her", "Every", "Everyone", "No", "Not", "Now", "When", "If", "Because", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "God", "Earth", "Mom", "Dad", "Grandma", "Grandpa", "Mr", "Mrs", "Ms", "Dr", "OK", "Okay"]);
/** names in the transcripts: capitalised words that are not a sentence start, never lowercase elsewhere, not common */
export function namesIn(lineTexts) {
  const caps = new Map(), lower = new Set();
  for (const t of lineTexts) {
    const words = String(t ?? "").split(/\s+/);
    words.forEach((w0, i) => {
      const w = w0.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, "").replace(/'s$/, "");
      if (!w) return;
      if (/^[a-z]/.test(w)) { lower.add(w); return; }
      const sentenceStart = i === 0 || /[.!?]["']?$/.test(words[i - 1]);
      if (/^[A-Z][a-z]{2,}$/.test(w) && !sentenceStart) caps.set(w, (caps.get(w) ?? 0) + 1);
    });
  }
  return [...caps.keys()].filter((w) => !COMMON_CAPS.has(w) && !lower.has(w.toLowerCase()));
}
/** replace every name in every string of obj with "[name]" -> { value, leaks } */
export function scrubNames(obj, names) {
  if (!names?.length) return { value: obj, leaks: 0 };
  const re = new RegExp(`\\b(${names.map((n) => n.replace(/[^A-Za-z']/g, "")).filter(Boolean).join("|")})\\b`, "g");
  let leaks = 0;
  const walk = (x) => {
    if (typeof x === "string") return x.replace(re, () => { leaks++; return "[name]"; });
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, walk(v)]));
    return x;
  };
  return { value: walk(obj), leaks };
}

// ============================================================================================ 5. the paid prompts
const ROLE_LIST = SEQ_ROLES.join(", ");
export const ANALYSIS_SYSTEM = `You study ONE short 9:16 narrated "world" video (blocky toy-like 3D world: a town, often on or near a giant creature, little people, a kid narrator) as TEXT: its narration lines (with the story beat each line belongs to), one compact row per shot (from an earlier per-shot description), and measured stats. Write a STORY ANALYSIS a director can learn reusable patterns from.

The beats are the format's seven parts: rule (first line: the world rule), tour (how the world works, examples), me (the narrator and how they are the exception), until ("until one night": the threat or the rule breaking), discovery (the hidden truth), climax (the win), closer (the last line, echo or sting).
Shot roles (use only these): ${ROLE_LIST}.

Cover four areas:
1. World continuity: how the first shots establish the world; which kinds of places recur and why; how often and when the video returns to a wide of the creature or the town; how buildings, characters and props are kept consistent (same angle, same colours, a landmark always in the background...).
2. Shot sequences: the mini-sequences shots link into (e.g. reveal > reaction > consequence, cause > consequence > reaction) and how EACH beat turns into a sequence of shot roles.
3. The arc in pictures: how time of day / lighting, pace (shot length), camera distance and creature-vs-people on screen change across the beats.
4. Characters: how the narrator and side characters are introduced (which beat, what shot), how often they come back, and how the audience recognises them (a colour, a prop, a place, a pose).

RULES: patterns only. Never write a name, a channel, a caption or a quote; never retell the story. Use generic roles: "narrator kid", "parent", "neighbour", "elder", "giant creature", "rival giant", "villain army", "townsfolk", "the town", "the creature's back". Specific nouns of THIS story become generic ("the hero prop", "a landmark building"). Counts must come from the rows and stats given. Keep every string short (under 25 words). Return JSON matching the schema.`;

export const SYNTH_SYSTEM = `You merge STORY ANALYSES of many short 9:16 narrated "world" videos of one format (blocky toy-like 3D world, a town on or near a giant creature, a kid narrator, seven beats: rule, tour, me, until, discovery, climax, closer) into one compact, ranked set of STORY PATTERNS that an AI director uses to plan a WHOLE new video (not line by line), and that code checks plans against.

Shot roles (use only these): ${ROLE_LIST}.

For every pattern give support = the number of analyses that show it (count honestly; drop patterns with support under 3 unless nothing better exists). Rank by support. Prefer concrete, checkable rules ("a wide of the creature or town every 8-12 s", "the narrator is on screen in 1-2 lines of me, then back at the climax doing something") over vague ones. Numbers in the MEASURED block are facts: keep your ranges consistent with them.

RULES: patterns only. No names, quotes, channels, story specifics or characters of any video; generic roles only ("narrator kid", "giant creature", "villain army", "neighbour"). Keep each rule under 30 words. Return JSON matching the schema.`;

const S = { type: "string" }, I = { type: "integer" }, N = { type: "number" };
const E = (list) => ({ type: "string", enum: [...list] });
const A = (items) => ({ type: "array", items });
const O = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const TOD = ["day", "golden_hour", "dusk", "night", "storm", "mixed"], PACE = ["fast", "medium", "slow"], DIST = ["far", "medium", "close", "mixed"], FOCUS = ["creature", "people", "both", "place"];
export function analysisSchema() {
  return O({
    worldEstablishing: O({ how: S, shotsUntilClear: I, firstRoles: A(E(SEQ_ROLES)) }),
    recurringPlaces: A(O({ place: S, returns: I, purpose: S })),
    recurringWide: O({ everySec: N, when: S }),
    continuity: A(S),
    miniSequences: A(O({ sequence: A(E(SEQ_ROLES)), count: I, use: S })),
    beatSequences: A(O({ beat: E(BEATS), sequence: A(E(SEQ_ROLES)), how: S })),
    arc: A(O({ beat: E(BEATS), timeOfDay: E(TOD), pace: E(PACE), distance: E(DIST), focus: E(FOCUS) })),
    arcSummary: S,
    narrator: O({ introducedIn: E(BEATS), introShot: S, onScreenShots: I, returnsIn: A(E(BEATS)), recognisedBy: A(S) }),
    characters: A(O({ role: S, introducedIn: E(BEATS), introShot: S, returns: I, recognisedBy: A(S) })),
    patterns: A(S),
  });
}
export function synthSchema() {
  const sup = { support: I };
  return O({
    worldEstablishing: O({ rule: S, firstShots: A(E(SEQ_ROLES)), shotsUntilClear: N, ...sup }),
    recurringWide: O({ rule: S, everySecMin: N, everySecMax: N, ...sup }),
    beatTemplates: A(O({ beat: E(BEATS), sequence: A(E(SEQ_ROLES)), rule: S, ...sup })),
    miniSequences: A(O({ sequence: A(E(SEQ_ROLES)), rule: S, ...sup })),
    arc: A(O({ beat: E(BEATS), timeOfDay: E(TOD), pace: E(PACE), distance: E(DIST), focus: E(FOCUS), rule: S, ...sup })),
    characters: A(O({ rule: S, ...sup })),
    continuity: A(O({ rule: S, ...sup })),
  });
}

/** one compact row per shot: n|start|dur|beat|line|distance/height|move|role|who|time|place|subject|action -> effect|emotion|funny */
export function shotRow(r) {
  const d = r.d ?? {};
  const f = (x) => String(x ?? "").replace(/[|\n]/g, " ").trim();
  return [r.n, r.t0?.toFixed(1), r.dur?.toFixed(1), r.beat, r.line ?? "-", `${d.distance ?? "?"}/${d.height ?? "?"}`, d.cameraMove ?? r.move, r.role ?? "?", d.who ?? "?", d.timeOfDay ?? "?", f(d.place), f(d.subject), `${f(d.action)}${d.causeEffect ? ` -> ${f(d.causeEffect)}` : ""}`, f(d.emotion), d.funnyBeat ? "funny" : ""].join("|");
}
/** the per-video user message: the beat-labelled lines, the shot rows, the stats (without what the rows already say) */
export function analysisPrompt({ sh, desc, stats }) {
  const lines = sh?.lines ?? [];
  const beatOfLine = (i) => stats.beats.find((b) => i >= b.lines[0] && i < b.lines[1])?.beat ?? "-";
  const rows = (sh?.shots ?? []).map((s) => {
    const d = desc?.shots?.[s.n] ?? desc?.shots?.[String(s.n)] ?? null;
    const n0 = (s.lines ?? [])[0];
    const li = lines.findIndex((l) => l.n === n0);
    return shotRow({ n: s.n, t0: s.t0, dur: s.dur, beat: li >= 0 ? beatOfLine(li) : "-", line: n0 ?? null, move: s.move?.family, role: d ? CATEGORY_ROLE[d.libraryCategory] ?? "other" : null, d });
  });
  const { perBeat, ...rest } = stats;
  const slimBeat = Object.fromEntries(Object.entries(perBeat ?? {}).map(([b, p]) => { const { roles, ...q } = p; return [b, q]; }));
  return [
    `VIDEO: ${r2(stats.duration)} s, ${stats.shots} shots, ${stats.lines} lines.`,
    `NARRATION (line number [beat] text):`,
    ...lines.map((l, i) => `${l.n ?? i + 1} [${beatOfLine(i)}] ${l.text}`),
    ``,
    `SHOTS (n|start s|dur s|beat|line|distance/height|camera move|role|who|time|place|subject|action -> effect|emotion|funny):`,
    ...rows,
    ``,
    `STATS: ${JSON.stringify({ ...rest, perBeat: slimBeat, version: undefined, video: undefined, patternsOnly: undefined })}`,
  ].join("\n");
}
export function synthPrompt({ analyses, measured }) {
  return [`MEASURED (free stats over ${measured?.videos ?? 0} videos, ${measured?.described ?? 0} with shot descriptions):`, JSON.stringify(measured), ``, `STORY ANALYSES (${analyses.length}, one JSON per line):`, ...analyses.map((a) => JSON.stringify(a))].join("\n");
}

// ============================================================================================ 6. price
export const OUT = Object.freeze({
  analysis: { typical: 1900, thinking: 700, max: 8000 },   // ~11 sections of short JSON + effort-low thinking
  synth: { typical: 3500, thinking: 1500, max: 16000 },
});
/** one request -> { input, typicalUsd, worstUsd } (worst: every input token at the cache-write rate, x1.15 for the
 *  estimate's error, and every max_tokens output token) */
export function requestPrice(model, input, kind) {
  const o = OUT[kind], p = rateOf(model, input * 1.15);
  const typical = (input * p.input + (o.typical + o.thinking) * p.output) / 1e6;
  const worst = (input * 1.15 * Math.max(p.input, p.cacheWrite) + o.max * p.output) / 1e6;
  return { input, typicalUsd: typical, worstUsd: worst };
}

/** deterministic fixture descriptions with the schema's typical field lengths (tests + the dry-run size estimate) */
export function fixtureDescriptions(sh, seed = 1) {
  const cats = Object.keys(CATEGORY_ROLE), dists = Object.keys(DISTANCE_INDEX), who = ["creature_only", "people_only", "people_and_creature", "town_or_place_only"];
  const places = ["the town square on the creature's back", "a forest edge near the town", "a kid's bedroom at night", "the main street of the town", "a hill above the sea"];
  const shots = {};
  for (const s of sh?.shots ?? []) {
    const k = (s.n * 7 + seed * 13) % 97;
    shots[s.n] = {
      id: `${sh.video}:s${s.n}`, distance: dists[k % dists.length], height: ["eye_level", "high", "aerial", "ground_low"][k % 4], cameraMove: s.move?.family && s.move.family !== "unknown" ? s.move.family : "push_in",
      moveRole: "slow push to stress the scale", subject: k % 3 ? "a giant mossy tortoise carrying a town" : "a kid in a red hoodie and two parents", subjectSize: "bigger_than_frame",
      scaleCues: "houses reach only its knee, people are dots", action: "walks slowly through the trees", causeEffect: "foot lands -> dust rises and houses shake",
      place: places[k % places.length], timeOfDay: k % 5 === 0 ? "night" : "day", who: who[k % who.length], emotion: ["awe", "calm", "fear", "funny"][k % 4], funnyBeat: k % 9 === 0,
      coversLine: "the narration words of the shot", lineFit: "literal", libraryLabel: "giant walks through forest", libraryCategory: cats[k % cats.length],
      pattern: "a slow push on a giant walking past tiny houses sells its size", captionsVisible: true,
    };
  }
  return { version: 1, model: "fixture", shots };
}

// ============================================================================================ 7. IO
export function loadVideos({ dir = ANALYSIS_DIR, only = null } = {}) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((d) => !d.startsWith("_") && fs.statSync(path.join(dir, d)).isDirectory() && (!only || d === only)).sort().map((id) => {
    const p = (f) => path.join(dir, id, f);
    const vis = readJson(p("visual.json")), sh0 = readJson(p("shots.json"));
    const sh = sh0 && vis && sh0.version === vis.version ? sh0 : null;   // a shots.json older than the visual pass is stale
    return { id, dir: path.join(dir, id), sh, vis, meta: readJson(p("meta.json")), desc: readJson(p("descriptions.json")), analysis: readJson(p("story-analysis.json")) };
  });
}
const writeJson = (p, obj) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p + ".tmp", JSON.stringify(obj, null, 1)); fs.renameSync(p + ".tmp", p); };
const descComplete = (v) => !!v.sh && !!v.desc && Object.keys(v.desc.shots ?? {}).length >= v.sh.shots.length;

/** the patterns file: measured numbers + patterns (placeholder or synthesis), checked for name leaks; -> { written, leaks } */
export function writePatternsFile({ measured, patterns, source, names = [], file = STORY_PATTERNS_FILE }) {
  const obj = { version: 1, source, videos: measured?.videos ?? 0, described: measured?.described ?? 0, updated: new Date().toISOString().slice(0, 10), patternsOnly: DEFAULT_PATTERNS.patternsOnly, measured: { ...measured, sequences: undefined }, patterns };
  const { leaks } = scrubNames(obj, names);
  if (leaks) return { written: false, leaks };
  writeJson(file, obj);
  return { written: true, leaks: 0, file };
}

// ============================================================================================ 8. the paid run (guarded)
/**
 * Per-video analyses then one synthesis. provider.call({ model, system, content, schema, maxTokens }) -> { data, costUsd }
 * (the real one wraps builder/design.js callClaude; tests pass a fake). Stops before a request whose worst case would
 * pass maxUsd; a failed request stops the run (no paid retries). -> { spent, analysed, synthesised, stopped, log }
 */
export async function runPaid({ videos, provider, maxUsd, synthModel = MODELS.haiku, skipSynth = false, synthOnly = false, allowPartial = false, names = [], dir = ANALYSIS_DIR, patternsFile = STORY_PATTERNS_FILE, log = console.log }) {
  if (!(maxUsd > 0)) throw new Error("maxUsd must be a positive number");
  let spent = 0, analysed = 0, synthesised = false, stopped = null;
  const statsOf = (v) => computeStats({ id: v.id, sh: v.sh, desc: v.desc });
  if (!synthOnly) {
    for (const v of videos) {
      if (!v.sh) { log(`skip ${v.id}: no shots.json with transcript yet`); continue; }
      if (!descComplete(v) && !allowPartial) { log(`skip ${v.id}: shot descriptions not complete (${Object.keys(v.desc?.shots ?? {}).length}/${v.sh.shots.length})`); continue; }
      const nDesc = Object.keys(v.desc?.shots ?? {}).length;
      if (v.analysis?.version === STORY_VERSION && v.analysis?.described === nDesc) continue;   // incremental
      const stats = statsOf(v), content = analysisPrompt({ sh: v.sh, desc: v.desc, stats });
      const pr = requestPrice(MODELS.haiku, tok(ANALYSIS_SYSTEM) + tok(JSON.stringify(analysisSchema()), true) + tok(content, true), "analysis");
      if (spent + pr.worstUsd > maxUsd) { stopped = `cap: spent $${spent.toFixed(4)}, ${v.id} could cost $${pr.worstUsd.toFixed(4)} (cap $${maxUsd})`; log(`STOP ${stopped}`); break; }
      let r;
      try { r = await provider.call({ model: MODELS.haiku, system: ANALYSIS_SYSTEM, content, schema: analysisSchema(), maxTokens: OUT.analysis.max }); }
      catch (e) { spent += e.costUsd ?? 0; stopped = `request failed for ${v.id}: ${e.message}`; log(`${stopped} (spent $${spent.toFixed(4)}); stopping (no paid retries)`); break; }
      spent += r.costUsd ?? 0;
      const { value, leaks } = scrubNames(r.data, names);
      writeJson(path.join(dir, v.id, "story-analysis.json"), { version: STORY_VERSION, video: v.id, model: MODELS.haiku, described: nDesc, costUsd: r.costUsd ?? 0, scrubbedNames: leaks, patternsOnly: "abstract story patterns only", at: new Date().toISOString(), analysis: value });
      v.analysis = { version: STORY_VERSION, described: nDesc, analysis: value };
      analysed++;
      log(`analysed ${v.id}: $${(r.costUsd ?? 0).toFixed(5)}${leaks ? ` (${leaks} name(s) scrubbed)` : ""} (total $${spent.toFixed(4)})`);
    }
  }
  if (!skipSynth && !stopped) {
    const ready = videos.filter((v) => v.analysis?.version === STORY_VERSION);
    const missing = videos.filter((v) => v.sh && v.analysis?.version !== STORY_VERSION).length;
    if (!ready.length) log("synthesis: no analyses yet");
    else if (missing && !allowPartial) log(`synthesis waits: ${missing} video(s) without a current analysis (use --allow-partial to synthesise anyway)`);
    else {
      const measured = aggregate(videos.filter((v) => v.sh).map(statsOf));
      const content = synthPrompt({ analyses: ready.map((v) => v.analysis.analysis), measured: { ...measured } });
      const pr = requestPrice(synthModel, tok(SYNTH_SYSTEM) + tok(JSON.stringify(synthSchema()), true) + tok(content, true), "synth");
      if (spent + pr.worstUsd > maxUsd) { stopped = `cap: synthesis could cost $${pr.worstUsd.toFixed(4)}, spent $${spent.toFixed(4)} (cap $${maxUsd})`; log(`STOP ${stopped}`); }
      else {
        try {
          const r = await provider.call({ model: synthModel, system: SYNTH_SYSTEM, content, schema: synthSchema(), maxTokens: OUT.synth.max });
          spent += r.costUsd ?? 0;
          const { value, leaks } = scrubNames(r.data, names);
          writeJson(path.join(dir, "_story-synthesis.json"), { version: STORY_VERSION, model: synthModel, analyses: ready.length, costUsd: r.costUsd ?? 0, scrubbedNames: leaks, at: new Date().toISOString(), patterns: value });
          const w = writePatternsFile({ measured, patterns: { ...placeholderPatterns(measured), ...value, note: `synthesis of ${ready.length} story analyses (${synthModel})` }, source: `free stats + ${synthModel} synthesis of ${ready.length} analyses`, names, file: patternsFile });
          synthesised = w.written;
          log(w.written ? `synthesis: $${(r.costUsd ?? 0).toFixed(5)}; patterns file written` : `synthesis: REFUSED to write the patterns file (${w.leaks} name leak(s))`);
        } catch (e) { spent += e.costUsd ?? 0; stopped = `synthesis failed: ${e.message}`; log(`${stopped} (no paid retries)`); }
      }
    }
  }
  log(`done: spent $${spent.toFixed(4)}`);
  return { spent, analysed, synthesised, stopped };
}

/** the real provider (paid): builder/design.js callClaude, effort low, structured output */
export async function anthropicProvider(apiKey) {
  const { callClaude } = await import("../engine/lib/builder/design.js");
  return { call: ({ model, system, content, schema, maxTokens }) => callClaude({ apiKey, model, system, content, schema, effort: "low", maxTokens, timeoutMs: 300000 }) };
}

// ============================================================================================ 9. dry-run price
/** the price of the paid run from the real data sizes (descriptions estimated with the fixture where missing) */
export function dryRunPrice(videos) {
  const withSh = videos.filter((v) => v.sh), noSh = videos.filter((v) => !v.sh && v.vis?.shots);
  // measured sizes from the videos that have a transcript: the prompt with real lines + fixture-size descriptions
  const sized = withSh.map((v) => {
    const desc = descComplete(v) ? v.desc : fixtureDescriptions(v.sh);
    const stats = computeStats({ id: v.id, sh: v.sh, desc });
    const content = analysisPrompt({ sh: v.sh, desc, stats });
    return { id: v.id, shots: v.sh.shots.length, dur: v.sh.duration, content: tok(content, true), stats, real: descComplete(v) };
  });
  const perShot = sized.length ? sum(sized.map((s) => s.content)) / sum(sized.map((s) => s.shots)) : 75;
  const perSec = sized.length ? sum(sized.map((s) => s.content)) / sum(sized.map((s) => s.dur)) : 60;
  const base = tok(ANALYSIS_SYSTEM) + tok(JSON.stringify(analysisSchema()), true);
  const est = [
    ...sized.map((s) => ({ id: s.id, measured: true, input: base + s.content })),
    // no transcript yet: scale by shots and seconds (the mean of both)
    ...noSh.map((v) => ({ id: v.id, measured: false, input: base + Math.ceil(((v.vis.shots.length * perShot) + ((v.vis.shots.at(-1)?.t1 ?? 60) * perSec)) / 2) })),
  ];
  const per = est.map((e) => ({ ...e, ...requestPrice(MODELS.haiku, e.input, "analysis") }));
  // the synthesis: every analysis answer (typical size) + the measured block
  const measured = aggregate(sized.map((s) => s.stats));
  const synthIn = tok(SYNTH_SYSTEM) + tok(JSON.stringify(synthSchema()), true) + tok(JSON.stringify(measured), true) + 200 + est.length * Math.ceil(OUT.analysis.typical * 1.05);
  return { per, base, perShot, perSec, synthIn, synth: { haiku: requestPrice(MODELS.haiku, synthIn, "synth"), sonnet: requestPrice(MODELS.sonnet, synthIn, "synth") } };
}

// ============================================================================================ main
const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

async function main() {
  const only = opt("--only", null);
  const videos = loadVideos({ only });
  const names = namesIn(videos.flatMap((v) => (v.sh?.lines ?? []).map((l) => l.text)));
  const fmt = (x) => `$${x.toFixed(4)}`;

  // FREE: stats per video + the placeholder patterns file (never over a synthesis unless --force)
  const stats = videos.filter((v) => v.sh).map((v) => { const s = computeStats({ id: v.id, sh: v.sh, desc: v.desc }); writeJson(path.join(v.dir, "story-stats.json"), s); return s; });
  const measured = aggregate(stats);
  console.log(`FREE: story-stats.json for ${stats.length}/${videos.length} videos (${measured.described} with descriptions); beats found by their words: ${Object.entries(measured.beatsByWords).map(([b, n]) => `${b} ${n}`).join(", ")}`);
  const cur = readJson(STORY_PATTERNS_FILE);
  if (!only && (!cur || !/synthesis/.test(cur.source ?? "") || flag("--force"))) {
    const w = writePatternsFile({ measured, patterns: placeholderPatterns(measured), source: `free stats (${stats.length} videos, ${measured.described} described)`, names });
    console.log(w.written ? `placeholder patterns -> ${path.relative(ROOT, STORY_PATTERNS_FILE)}` : `REFUSED to write the patterns file (${w.leaks} name leak(s))`);
  }

  if (!(flag("--paid") && flag("--yes") && opt("--max-usd", null))) {
    if (flag("--paid") || flag("--yes")) console.log("REFUSED: a paid run needs ALL of --paid --yes --max-usd <usd>. Showing the dry run instead.\n");
    const d = dryRunPrice(videos);
    const typ = sum(d.per.map((p) => p.typicalUsd)), worst = sum(d.per.map((p) => p.worstUsd)), inTok = sum(d.per.map((p) => p.input));
    console.log(`\nDRY RUN (no API call). Per-video analysis: ${MODELS.haiku} ($${PRICE[MODELS.haiku].input} in / $${PRICE[MODELS.haiku].output} out per 1M), effort low, max_tokens ${OUT.analysis.max}`);
    console.log(`system+schema ${d.base} tok; prompt ~${d.perShot.toFixed(1)} tok/shot (measured on ${d.per.filter((p) => p.measured).length} videos with transcripts, fixture-size descriptions)`);
    console.log(`  ${d.per.length} requests, input ${inTok} tok (min ${Math.min(...d.per.map((p) => p.input))}, max ${Math.max(...d.per.map((p) => p.input))}), output typical ${OUT.analysis.typical + OUT.analysis.thinking}/req, max ${OUT.analysis.max}/req`);
    console.log(`  per-video total: typical ${fmt(typ)}  worst ${fmt(worst)}   (per new video: typical ${fmt(typ / d.per.length)}, worst ${fmt(worst / d.per.length)})`);
    console.log(`Synthesis (1 request, input ~${d.synthIn} tok, output typical ${OUT.synth.typical + OUT.synth.thinking}, max ${OUT.synth.max}):`);
    console.log(`  haiku  typical ${fmt(d.synth.haiku.typicalUsd)}  worst ${fmt(d.synth.haiku.worstUsd)}`);
    console.log(`  sonnet typical ${fmt(d.synth.sonnet.typicalUsd)}  worst ${fmt(d.synth.sonnet.worstUsd)}`);
    for (const [k, s] of Object.entries(d.synth)) console.log(`TOTAL with ${k} synthesis: typical ${fmt(typ + s.typicalUsd)}, worst ${fmt(worst + s.worstUsd)}`);
    const cap = (s) => Math.max(0.05, Math.ceil((worst + s.worstUsd) * 1.1 * 100) / 100).toFixed(2);
    console.log(`\npaid command (after the owner's go, once describe.mjs has finished):`);
    console.log(`  node scripts/blockyWorlds/shotlib/story.mjs --paid --yes --max-usd ${cap(d.synth.haiku)} --synth-model haiku`);
    console.log(`  node scripts/blockyWorlds/shotlib/story.mjs --paid --yes --max-usd ${cap(d.synth.sonnet)} --synth-model sonnet`);
    return;
  }

  const maxUsd = Number(opt("--max-usd", "0"));
  if (!(maxUsd > 0)) throw new Error("--max-usd must be a positive number");
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_KEY;
  if (!apiKey) throw new Error("no ANTHROPIC_API_KEY / ANTHROPIC_KEY in the environment");
  const synthModel = MODELS[opt("--synth-model", "haiku")] ?? MODELS.haiku;
  await runPaid({ videos, provider: await anthropicProvider(apiKey), maxUsd, synthModel, skipSynth: flag("--skip-synth"), synthOnly: flag("--synth-only"), allowPartial: flag("--allow-partial"), names });
}

if (isMain) main().catch((e) => { console.error(e.message); process.exit(1); });
