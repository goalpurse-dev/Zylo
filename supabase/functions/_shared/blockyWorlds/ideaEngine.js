// Blocky Worlds: the IDEA ENGINE (owner, 2026-11-14). "AI can decide" and every idea list come from here: the BEST model (Opus) writes a pool
// of ~40 ideas drawn from everywhere, a judge keeps the best 10 (or the best 1 for "AI can decide"), and free code rejects near-duplicates
// of everything we already have. Pure: prompts, schemas, the uniqueness filter and the card mapping; llm.js writeIdeaPool makes the calls.
//
// Draw from everywhere: everyday life (body, school, family, food, pets, jobs, holidays, weather, phones and money), fears and dreams,
// myths and fairy tales, AND tropes and premises INSPIRED by movies, series and games. Never their names, characters, logos or exact
// plots: each becomes our own town rule.
// Each idea: the one-line HOOK, a RULE a kid gets in 2 seconds, the STYLE (funny / dark), a one-line TWIST TEASER.
// Uniqueness: against the idea library (the DB fixture), every past script, the reference analyses and the kit's examples, and against
// the LOG of ideas already given out (db table blocky_worlds_idea_log, migration 20261215100000; the log's keys come in as `given`).
import { contentWords } from "./library.js";
import { BANNED_TEXT, bannedConcepts, BANNED_NAMES } from "./bans.js";
import { REFERENCE_RULE } from "./references.js";
import { normalizeIdea } from "./ideas.js";
import { REFERENCE_PREMISES } from "./references.js";
import { REFERENCE_TEXTS } from "./referenceTexts.js";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "./examples.js";

export const IDEA_STYLES = Object.freeze(["funny", "dark"]);
export const POOL_SIZE = 40;
/** Where ideas are drawn from (the prompt asks for a spread over all of them). */
export const IDEA_SOURCES = Object.freeze([
  "the body (a hiccup, a yawn, a sneeze-free habit, hair, teeth, sleep)", "school (homework, recess, the bell, lunch, tests, the bus)", "family (siblings, grandparents, chores, bedtime, dinner)",
  "food (breakfast, candy, soup, leftovers, a birthday cake)", "pets and animals", "jobs (the mail, the baker, the bus driver, the lifeguard, the dentist)",
  "holidays and birthdays", "weather (rain, wind, snow, heat, a rainbow)", "phones, screens and money (a score, a coin, a tip jar, a price tag)",
  "fears (the dark, the basement, the mirror, being forgotten)", "dreams and wishes", "myths and fairy tales (trolls, wishes, a magic bargain, a sleeping giant)",
  "tropes and premises INSPIRED by movies, series and games (a game's rules, a heist, a tournament, a time loop, a last human), turned into our own town rule with no names, characters, logos or exact plots",
]);

export const IDEA_POOL_SYSTEM = `You invent story ideas for Blocky Worlds: 60 to 165 second vertical videos narrated by one kid in a blocky toy-like town. Every idea is ONE simple rule a ten-year-old gets in 2 seconds, tied to an everyday thing, that the town lives by.

Write ${POOL_SIZE} ideas. Spread them over ALL these sources, several from each:
${IDEA_SOURCES.map((s) => `- ${s}`).join("\n")}

For each idea give: "hook" (ONE line, the craziest result or a secret + danger, first person), "rule" (the town rule, starting exactly "In this town, " and plain fact, 8 to 16 words), "style" ("funny": a chaos with jokes and a clever solution; or "dark": a quiet, creepy story with one character to love and a holy twist), "twist" (ONE line teaser of the ending twist, not the whole plot), "source" (which source above), "visual" (what a camera shows in the first second, a few words). About half funny, half dark. Every idea must be filmable in a blocky toy town and PG (danger suggested, no gore, no weapons).

BE ORIGINAL. ${BANNED_TEXT}
${REFERENCE_RULE}
Never use a real game, film, series, brand, platform, book or person; take only the TROPE and turn it into our own town rule. No two ideas may share a rule, a prop or a twist.

Return only the JSON object.`;

export function ideaPoolSchema() {
  const s = { type: "string" };
  return { type: "object", additionalProperties: false, required: ["ideas"], properties: { ideas: { type: "array", items: { type: "object", additionalProperties: false, required: ["hook", "rule", "style", "twist", "source", "visual"], properties: { hook: s, rule: s, style: { type: "string", enum: [...IDEA_STYLES] }, twist: s, source: s, visual: s } } } } };
}
export const ideaPoolPrompt = ({ count = POOL_SIZE, style = null, avoid = [], topic = "" } = {}) => [
  topic ? `THE USER'S TOPIC (every idea builds on it): "${String(topic).slice(0, 240)}"` : "",
  `Write ${count} ideas${style ? `, all in the ${style} style` : ""}.`,
  avoid.length ? `ALREADY GIVEN OUT (never repeat or echo these rules):\n${avoid.slice(0, 60).map((a) => `- ${a}`).join("\n")}` : "",
].filter(Boolean).join("\n\n");

// ---------- the judge (a cheap call scoring the whole pool at once) ----------
export const IDEA_CRITERIA = Object.freeze([
  Object.freeze({ id: "hook", weight: 1.5, ask: "the hook works in ONE line: you need the explanation" }),
  Object.freeze({ id: "rule", weight: 1.5, ask: "the rule is one a kid gets in 2 seconds" }),
  Object.freeze({ id: "visual", weight: 1.5, ask: "it is very VISUAL in a blocky toy town" }),
  Object.freeze({ id: "twist", weight: 1.5, ask: "the twist has real potential (clever, surprising, built from the rule)" }),
  Object.freeze({ id: "fit", weight: 1, ask: "it fits its style (funny: jokes with punchlines; dark: someone to love and a holy twist)" }),
  Object.freeze({ id: "fresh", weight: 2, ask: "freshness: nothing like a famous story, game or video; surprising" }),
]);
export const IDEA_JUDGE_SYSTEM = `You judge story ideas for short vertical videos. You get a numbered list; score EVERY idea from 0 to 10 on each criterion and be harsh (5 is flat, 7 good, 9 great).
${IDEA_CRITERIA.map((c) => `- ${c.id}: ${c.ask}.`).join("\n")}
Return only the JSON object: { "scores": [ { "n": 1, ${IDEA_CRITERIA.map((c) => `"${c.id}": n`).join(", ")} }, ... ] } with one row per idea.`;
export function ideaJudgeSchema() {
  const n = { type: "integer" };
  const row = { type: "object", additionalProperties: false, required: ["n", ...IDEA_CRITERIA.map((c) => c.id)], properties: { n, ...Object.fromEntries(IDEA_CRITERIA.map((c) => [c.id, n])) } };
  return { type: "object", additionalProperties: false, required: ["scores"], properties: { scores: { type: "array", items: row } } };
}
export const ideaJudgePrompt = (ideas) => ideas.map((x, i) => `${i + 1}. [${x.style}] ${x.hook} | RULE: ${x.rule} | TWIST: ${x.twist} | SHOWS: ${x.visual}`).join("\n");
const clamp = (v) => Math.max(0, Math.min(10, Math.round(Number(v) || 0)));
/** The judge's rows as totals per idea (0-100), in the order of the ideas; an idea left out scores 0. */
export function readIdeaScores(data, count) {
  const rows = Array.isArray(data?.scores) ? data.scores : [];
  const wsum = IDEA_CRITERIA.reduce((a, c) => a + c.weight, 0);
  return Array.from({ length: count }, (_, i) => {
    const r = rows.find((x) => Number(x?.n) === i + 1) ?? {};
    const scores = Object.fromEntries(IDEA_CRITERIA.map((c) => [c.id, clamp(r[c.id])]));
    return { scores, total: Math.round((IDEA_CRITERIA.reduce((a, c) => a + c.weight * scores[c.id], 0) / wsum) * 10) };
  });
}

// ---------- uniqueness (free) ----------
/** A stable key of an idea's rule: its content words, sorted. */
export const ideaKey = (idea) => contentWords(`${idea?.rule ?? ""}`).sort().join(" ");
const jaccard = (a, b) => { const A = new Set(a), B = new Set(b); let n = 0; for (const x of A) if (B.has(x)) n++; return n / Math.max(1, A.size + B.size - n); };
/** Is the idea (words w) the same as something we have (words h): alike by Jaccard, or most of the idea's words sit inside it (the corpus texts are longer). */
const alike = (h, w) => { const H = new Set(h); const inside = w.filter((x) => H.has(x)).length; return jaccard(h, w) >= NEAR_DUPLICATE || (w.length >= 3 && inside / w.length >= 0.75); };
/** How alike two idea texts are (0-1) by content words. */
export const likeness = (a, b) => jaccard(contentWords(a), contentWords(b));
export const NEAR_DUPLICATE = 0.5;

/**
 * Reject near-duplicates and banned pieces. corpus: texts we already have (the idea library's openers and twists, past scripts' first
 * lines, the reference premises and transcripts, the kit's examples); given: the log of ideas already given out (each a rule text or
 * its key). Returns { kept: [{ ...idea, text }], rejected: [{ idea, why }] }; the pool's own duplicates go too (the first is kept).
 */
export function filterIdeas(ideas, { corpus = [], given = [] } = {}) {
  const kept = [], rejected = [];
  const have = [...corpus, ...given].map((t) => contentWords(t)).filter((w) => w.length >= 3);
  for (const idea of ideas ?? []) {
    const text = `${idea.rule} ${idea.hook}`;
    const w = contentWords(idea.rule);
    if (!/^In this town, \S/.test(String(idea.rule ?? ""))) { rejected.push({ idea, why: "the rule must start with 'In this town, '" }); continue; }
    const banned = bannedConcepts([{ text }], "");
    if (banned.length) { rejected.push({ idea, why: `reuses a piece of the examples (${banned[0].id})` }); continue; }
    const name = (String(text).match(/\b[A-Z][a-z]+\b/g) ?? []).find((n) => BANNED_NAMES.includes(n.toLowerCase()));
    if (name) { rejected.push({ idea, why: `uses a banned name (${name})` }); continue; }
    const hit = have.find((h) => alike(h, w));
    if (hit) { rejected.push({ idea, why: "a near-duplicate of something we already have or gave out" }); continue; }
    const twin = kept.find((k) => jaccard(contentWords(k.rule), w) >= NEAR_DUPLICATE);
    if (twin) { rejected.push({ idea, why: "a near-duplicate of another idea in this pool" }); continue; }
    kept.push(idea);
  }
  return { kept, rejected };
}

/** The idea card (the shape every flow reads) from a pool idea: hook, style and the twist teaser ride along. */
export function cardFromPoolIdea(idea) {
  const rule = String(idea.rule ?? "").trim();
  return {
    ...normalizeIdea({
      opener: rule, title: String(idea.hook ?? "").replace(/[!.]+$/, "").slice(0, 70), premise: String(idea.hook ?? ""), price: "", examples: [],
      narrator: "", prop: "", twist: String(idea.twist ?? ""), teaser: String(idea.twist ?? ""), closer: "", formula: "F1", twistType: "T1",
      mood: idea.style === "dark" ? "horror" : "funny", setting: "town square",
    }),
    hook: String(idea.hook ?? "").trim(), style: idea.style === "dark" ? "dark" : "funny", twistTeaser: String(idea.twist ?? "").trim(), source: String(idea.source ?? ""),
  };
}

/** Rank scored ideas (best first); `count` of them, or the single best. Ties: the funnier-looking order of the pool is kept. */
export function topIdeas(ideas, scores, count = 10) {
  return ideas.map((idea, i) => ({ ...idea, scores: scores[i]?.scores ?? {}, total: scores[i]?.total ?? 0 })).sort((a, b) => b.total - a.total).slice(0, count);
}

/**
 * What we already have, as texts to compare new ideas against (the reference premises, the references' first two sentences, the
 * kit-style examples and the example script's first line). The caller adds the idea library's openers, past scripts' first lines and
 * the log of ideas already given out.
 */
export function defaultCorpus() {
  return [
    ...REFERENCE_PREMISES,
    ...Object.values(REFERENCE_TEXTS).map((t) => String(t).split(/(?<=[.!?])\s+/).slice(0, 2).join(" ")),
    ...EXAMPLE_IDEAS.map((i) => `${i.opener} ${i.price ?? ""}`),
    EXAMPLE_SCRIPT.lines?.[0]?.text ?? "",
    "In this town, sneezing teleports you somewhere random.", "In this town, laughing makes you float.", "In this town, the people have taken the faces of the humans they ate.",
  ].filter(Boolean);
}
