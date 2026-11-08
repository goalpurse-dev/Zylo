// Blocky Worlds: the idea library. Pure logic, no network:
//   - dedup: an idea's key words, and when two ideas are the same idea
//   - the AI judge: the A-tier rubric from the study (ANALYSIS.md 4.2), its schema, and the accept rule
//   - learning: an idea's rank from its judge score and what users did with it; the formula/twist/mood mix the batch job
//     makes more of
//   - serving: a user's next cards (only unseen, mixed across formulas and moods)
// The rulebook for all of it: docs/blocky-worlds-protocol.md.
import { FORMULA_IDS, FORMULAS, MOOD_IDS, MOOD_TWISTS, MOODS, SETTINGS, TWIST_IDS, TWISTS } from "./formulas.js";
import { REFERENCE_RULE } from "./references.js";

// ---------- dedup ----------
const STOP = new Set("a an the in this world town every everyone each of to and or but is are was be you your their its it his her our we they who that when if for on at by with from as into than then so not no nobody anyone has have had gets get got only one can will".split(" "));
/** The content words of a text (lowercase, no stop words, simple plural/-ing trimming). */
export function contentWords(text) {
  return [...new Set(String(text ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.replace(/(ies)$/, "y").replace(/(ing|es|s)$/, "")))];
}
/** A stable key for exact-duplicate checks: the opener's content words, sorted. */
export const openerKey = (opener) => contentWords(opener).sort().join(" ");
const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); let n = 0; for (const x of A) if (B.has(x)) n++; return n / Math.max(1, A.size + B.size - n); };
/** How alike two ideas are (0-1): their rules (opener + price) and their twists. */
export function similarity(a, b) {
  const rule = jaccard(contentWords(`${a.opener} ${a.price}`), contentWords(`${b.opener} ${b.price}`));
  const twist = jaccard(contentWords(a.twist), contentWords(b.twist));
  return Number((0.75 * rule + 0.25 * twist).toFixed(3));
}
export const DUPLICATE_AT = 0.42;

// Ideas that are the same rule with the nouns swapped for near-synonyms ("a candle" / "a nightlight", "the cellar" /
// "the basement") share no words, so similarity() misses them. Each word below stands for its family; two openers
// whose family words mostly match are the same rule. (2026-11-04: six such groups were found in the live library.)
const FAMILIES = {
  light: "light nightlight candle lantern torch flame glow glowing lamp flashlight bulb firefly mushroom",
  below: "basement cellar underground downstairs",
  above: "upstairs attic",
  store: "store shop mall supermarket department toy",
};
const FAMILY_OF = new Map(Object.entries(FAMILIES).flatMap(([fam, words]) => words.split(" ").map((w) => [contentWords(w)[0] ?? w, fam])));
// the formulas' own words ("every family leaves...", "we all live inside a giant...", "everyone... except me") are
// shared by design, so they never make two ideas the same rule
const FORMULA_WORDS = new Set(contentWords("family families leave leaves night nights live lives inside giant except everyone born kid kids whole all who own get gets"));
/** The opener's distinctive words, each near-synonym replaced by its family. */
export const ruleWords = (opener) => [...new Set(contentWords(opener).filter((w) => !FORMULA_WORDS.has(w)).map((w) => FAMILY_OF.get(w) ?? w))];
/** How alike two rules are once synonyms count as the same word (0-1, openers only). */
export const ruleSimilarity = (a, b) => Number(jaccard(ruleWords(a.opener), ruleWords(b.opener)).toFixed(3));
export const SWAP_AT = 0.4;

/** The library idea this one duplicates (same key, similarity >= DUPLICATE_AT, or the same rule with swapped nouns), or null. */
export function duplicateOf(idea, library) {
  const key = openerKey(idea.opener);
  for (const other of library) {
    if (other.key === key || openerKey(other.opener) === key) return other;
    if (similarity(idea, other) >= DUPLICATE_AT) return other;
    if (ruleSimilarity(idea, other) >= SWAP_AT) return other;
  }
  return null;
}

// ---------- the judge ----------
/** The A-tier rubric (ANALYSIS.md 4.2), each criterion 1-5. Weights add up to 100. */
export const RUBRIC = Object.freeze([
  Object.freeze({ id: "hook", weight: 16, ask: "Is the opener an outrageous rule stated as plain fact, clear to a ten-year-old from that line alone, and visual?" }),
  Object.freeze({ id: "price", weight: 8, ask: "Does breaking the rule have a price everyone has seen (stated early, concrete)?" }),
  Object.freeze({ id: "examples", weight: 10, ask: "Are the three examples concrete, funny or creepy, with named neighbours or specific jobs (not summaries)?" }),
  Object.freeze({ id: "exception", weight: 8, ask: "Is the narrator the exception or the underdog of the rule, in a way that creates sympathy?" }),
  Object.freeze({ id: "prop", weight: 10, ask: "Is the planted object set up early and does it (or the rule itself) win the climax?" }),
  Object.freeze({ id: "escalation", weight: 10, ask: "Can it escalate in three visible, filmable steps?" }),
  Object.freeze({ id: "twist", weight: 14, ask: "Does the twist use the world's own logic (guessable in hindsight), with no new magic at the end?" }),
  Object.freeze({ id: "closer", weight: 10, ask: "Is the closer quotable and does it flip or echo the opener?" }),
  Object.freeze({ id: "originality", weight: 8, ask: "Is it original (not a famous story with names changed, not a tired plot)? Score 1 if it copies one of the reference premises below together with its twist, at most 2 if it copies the premise only." }),
  Object.freeze({ id: "buildable", weight: 6, ask: "Can it be shown in one or two blocky sets with a few characters (no crowds of special effects, no real places)?" }),
]);
// The accept line, calibrated on 2026-11-03: the same judge scored six real ~300k-like hits as cards at 45-69 (the four
// strongest 67-69; scripts/blockyWorlds/calibrateJudge.mjs). 65 lets ideas as strong as the best hits in and keeps the rest out.
export const ACCEPT = Object.freeze({ minScore: 65, minCore: 3, core: Object.freeze(["hook", "twist", "closer"]) });

export const JUDGE_SYSTEM = `You are the strict judge of story ideas for Blocky Worlds: 1-2 minute narrated videos where a kid explains an absurd world rule ("In this town, ...") and the story pushes it to its most extreme consequence. Only ideas as strong as viral hits (about 300k likes each) may pass.

Score each idea on every criterion from 1 (weak) to 5 (as strong as the best hits). Be harsh: a 5 is rare. Then say in one short sentence what would make it better.

CRITERIA
${RUBRIC.map((c) => `- ${c.id}: ${c.ask}`).join("\n")}

Also set safe=false if anything is not fine for a young audience (gore, weapons, romance, anything copyable and dangerous) or names a real game, platform, brand, film, book or person.

${REFERENCE_RULE}

Return only the JSON object, one verdict per idea, in the same order.`;

export function judgeSchema() {
  const n = { type: "integer" };
  const scores = Object.fromEntries(RUBRIC.map((c) => [c.id, n]));
  return {
    type: "object", additionalProperties: false, required: ["verdicts"],
    properties: { verdicts: { type: "array", items: { type: "object", additionalProperties: false, required: ["scores", "safe", "better"], properties: { scores: { type: "object", additionalProperties: false, required: Object.keys(scores), properties: scores }, safe: { type: "boolean" }, better: { type: "string" } } } } },
  };
}
export const judgePrompt = (ideas) => ideas.map((i, k) => `IDEA ${k + 1}\n${JSON.stringify({ opener: i.opener, title: i.title, premise: i.premise, price: i.price, examples: i.examples, narrator: i.narrator, prop: i.prop, twist: i.twist, closer: i.closer, mood: i.mood, setting: i.setting })}`).join("\n\n");

/**
 * The same judge on a FINISHED SCRIPT (owner, 2026-11-07: a custom topic must pass the library's bar too, judged on the
 * script, not only the idea). Same system prompt, rubric, schema and accept line (scoreVerdict); the user message gives
 * the card as a summary and the narration as the thing to score. A card with the user's own topic adds one stricter
 * line: a story that drifts from the premise scores low on hook and twist.
 */
export function judgeScriptPrompt(script, card = {}, { exemptOriginality = false } = {}) {
  const lines = (script?.lines ?? []).map((l) => `[${l.part}] ${l.text}`).join("\n");
  return [
    "IDEA 1 is judged by its FINISHED SCRIPT. Score what the narration below actually delivers (its first line is the opener, its last line the closer; the price, examples, narrator, planted object, escalation and twist as they are WRITTEN), not what the card promises. The card is only a summary.",
    ...(card?.topic ? [`THE USER'S OWN PREMISE: "${String(card.topic).slice(0, 200)}". The story must be about it from the first line to the last. If the narration swaps it for another gimmick, leaves it in the background, or turns its threat into a friend or a gag (a meal, a deal, a chore) instead of ending it, score hook and twist at most 2 and say so in "better".`] : []),
    // broad topics may start from a reference premise (owner, 2026-11-08); copying is caught by antiCopy.js instead
    ...(exemptOriginality ? ["THE PREMISE IS THE USER'S CHOICE and may match a reference premise: that is allowed. Score originality ONLY on the story events, the twist, the names and the lines (a reference's twist or events copied still score 1-2), never on the premise."] : []),
    judgePrompt([card ?? {}]),
    `THE SCRIPT OF IDEA 1\n${lines}`,
    "Return exactly one verdict.",
  ].join("\n\n");
}

/** The judge's verdict as instructions for a rewrite: the score vs the bar, the weakest criteria, the judge's note. */
export function judgeReasons(v) {
  if (!v) return [];
  const out = [];
  const weak = RUBRIC.filter((c) => (v.scores?.[c.id] ?? 5) <= 2 || (ACCEPT.core.includes(c.id) && (v.scores?.[c.id] ?? 5) < ACCEPT.minCore));
  out.push(`The AI judge scored the script ${v.score}/100; the bar is ${ACCEPT.minScore}, with hook, twist and closer at ${ACCEPT.minCore}/5 or more${v.reason ? ` (${v.reason})` : ""}.`);
  for (const c of weak) out.push(`Weak ${c.id} (${v.scores[c.id]}/5): ${c.ask}`);
  if (v.better) out.push(`The judge says: ${v.better}`);
  return out;
}

/** A verdict as a 0-100 score and the accept decision. */
export function scoreVerdict(v) {
  const s = v?.scores ?? {};
  const clamp = (x) => Math.min(5, Math.max(1, Math.round(Number(x) || 1)));
  const total = RUBRIC.reduce((a, c) => a + ((clamp(s[c.id]) - 1) / 4) * c.weight, 0);
  const score = Math.round(total);
  const weakCore = ACCEPT.core.filter((id) => clamp(s[id]) < ACCEPT.minCore);
  const accepted = v?.safe === true && score >= ACCEPT.minScore && !weakCore.length;
  const reason = v?.safe !== true ? "not safe or names a real thing" : weakCore.length ? `weak ${weakCore.join(", ")}` : score < ACCEPT.minScore ? `score ${score} < ${ACCEPT.minScore}` : null;
  return { score, accepted, reason, scores: Object.fromEntries(RUBRIC.map((c) => [c.id, clamp(s[c.id])])), better: String(v?.better ?? "").slice(0, 240) };
}

// ---------- learning ----------
/** Smoothed rate: (hits + prior * strength) / (tries + strength). */
const rate = (hits, tries, prior, strength) => (Number(hits || 0) + prior * strength) / (Number(tries || 0) + strength);
/**
 * An idea's rank (0-1, higher is shown first). The judge score is the prior; what users did moves it:
 * picked / shown, generated / picked, downloaded / generated, thumbs, and the owner's real TikTok likes (counted most).
 * A small exploration bonus lets new ideas get shown before they have numbers.
 */
export const RANK_WEIGHTS = Object.freeze({ judge: 0.3, pick: 0.22, generate: 0.14, download: 0.08, thumbs: 0.08, likes: 0.18, explore: 0.06 });
export function rankOf(row) {
  const st = row.stats ?? row;
  const judge = Math.max(0, Math.min(1, Number(row.score ?? 0) / 100));
  const pick = rate(st.picked, st.shown, 0.15, 20);
  const generate = rate(st.generated, st.picked, 0.4, 5);
  const download = rate(st.downloaded, st.generated, 0.6, 3);
  const thumbs = rate(st.thumbs_up, Number(st.thumbs_up || 0) + Number(st.thumbs_down || 0), 0.7, 4);
  const likes = Math.min(1, Math.log10(1 + Number(st.likes_total || 0)) / 6); // 1M likes = 1
  const explore = 1 / Math.sqrt(1 + Number(st.shown || 0));
  const w = RANK_WEIGHTS;
  return Number((w.judge * judge + w.pick * (pick / 0.3) * 0.5 + w.generate * generate + w.download * download + w.thumbs * thumbs + w.likes * likes + w.explore * explore).toFixed(4));
}

/**
 * The mix the batch job makes more of: per formula, twist and mood, a weight from how its ideas do (generated per shown,
 * plus likes), relative to the average, kept between 0.5 and 2 so nothing disappears. rows: library rows with stats.
 */
export function mixWeights(rows) {
  const by = (field, ids) => {
    const acc = Object.fromEntries(ids.map((id) => [id, { hits: 0, tries: 0, likes: 0 }]));
    for (const r of rows) { const a = acc[r[field]]; if (!a) continue; a.hits += Number(r.generated || 0); a.tries += Number(r.shown || 0); a.likes += Math.log10(1 + Number(r.likes_total || 0)); }
    const perf = Object.fromEntries(ids.map((id) => [id, rate(acc[id].hits, acc[id].tries, 0.05, 50) + acc[id].likes * 0.01]));
    const avg = Object.values(perf).reduce((x, y) => x + y, 0) / ids.length || 1;
    return Object.fromEntries(ids.map((id) => [id, Number(Math.min(2, Math.max(0.5, perf[id] / avg)).toFixed(3))]));
  };
  return { formula: by("formula", FORMULA_IDS), twist: by("twist", TWIST_IDS), mood: by("mood", MOOD_IDS) };
}

/** A seeded random number generator (the batch plan and the tests are repeatable). */
export function seeded(seed) { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
const pickWeighted = (rnd, weights, allowed) => {
  const ids = allowed.filter((id) => weights[id] > 0), total = ids.reduce((a, id) => a + weights[id], 0);
  let x = rnd() * total;
  for (const id of ids) { x -= weights[id]; if (x <= 0) return id; }
  return ids.at(-1);
};
/**
 * The slots of one generation call: `count` formula/twist/mood/setting combinations drawn by the mix weights (20% drawn
 * evenly, to keep exploring), no repeated formula+twist pair inside a call.
 */
export function planSlots(weights, count, seed = 1) {
  const rnd = seeded(seed), even = (ids) => Object.fromEntries(ids.map((id) => [id, 1]));
  const out = [], used = new Set();
  for (let guard = 0; out.length < count && guard < count * 30; guard++) {
    const explore = rnd() < 0.2;
    const mood = pickWeighted(rnd, explore ? even(MOOD_IDS) : weights.mood, MOOD_IDS);
    const formula = pickWeighted(rnd, explore ? even(FORMULA_IDS) : weights.formula, FORMULA_IDS);
    const twist = pickWeighted(rnd, explore ? even(TWIST_IDS) : weights.twist, MOOD_TWISTS[mood]);
    if (used.has(formula + twist)) continue;
    used.add(formula + twist);
    out.push({ formula, twist, mood, setting: SETTINGS[Math.floor(rnd() * SETTINGS.length)] });
  }
  return out;
}

// ---------- serving ----------
/**
 * A user's next cards from the unseen candidates (live library rows, best rank first): the best idea of each formula in
 * turn, never two of the same formula+mood, so a batch is always mixed. mood: only that mood.
 * @param {any[]} candidates @param {number} [count] @param {string | null} [mood]
 */
export function pickForUser(candidates, count = 6, mood = null) {
  const pool = candidates.filter((c) => !mood || c.mood === mood).slice().sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
  const out = [], usedPair = new Set(), usedFormula = new Map();
  for (let round = 0; out.length < count && round < 4; round++) {
    for (const c of pool) {
      if (out.length >= count) break;
      if (out.includes(c)) continue;
      const pair = `${c.formula}/${c.mood}`;
      if (usedPair.has(pair) && round < 2) continue;
      if ((usedFormula.get(c.formula) ?? 0) > round) continue;
      out.push(c); usedPair.add(pair); usedFormula.set(c.formula, (usedFormula.get(c.formula) ?? 0) + 1);
    }
  }
  return out;
}

// ---------- the batch: size and cost ----------
/**
 * Expected cost of a library batch (USD), from token estimates per call (6 ideas a call):
 * generation ~2.6k cached system + ~0.9k prompt in, ~2.6k out (with thinking); judging ~2.2k cached + ~1.6k in, ~1.4k out.
 * acceptRate: the share that passes the judge (and dedup) — 0.5 until measured.
 */
export const BATCH_TOKENS = Object.freeze({ perCall: 6, gen: { cachedIn: 2600, in: 900, out: 2600 }, judge: { cachedIn: 2200, in: 1600, out: 1400 } });
export function batchCost({ accepted, acceptRate = 0.5, price }) {
  const generated = Math.ceil(accepted / acceptRate), calls = Math.ceil(generated / BATCH_TOKENS.perCall);
  const callUsd = (t, p) => ((t.cachedIn * p.cacheRead + t.in * p.input + t.out * p.output) / 1e6);
  const gen = calls * callUsd(BATCH_TOKENS.gen, price.gen), judge = calls * callUsd(BATCH_TOKENS.judge, price.judge);
  return { generated, calls, genUsd: Number(gen.toFixed(2)), judgeUsd: Number(judge.toFixed(2)), totalUsd: Number((gen + judge).toFixed(2)) };
}

export const LIBRARY = Object.freeze({ target: 500, minUnseenBeforeLive: 6, formulas: FORMULAS, twists: TWISTS, moods: MOODS });
