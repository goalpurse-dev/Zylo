// Blocky Worlds: the STORY JUDGE (owner, 2026-11-13: "render quality is excellent, the STORY is weak"). Pure: the criteria, the
// shared rules text (the system prompt, the same bytes every call so it caches), the schema, and the pick.
//
// The writer makes THREE versions of the lines from one plan (llm.js writeHybrid, versions: 3, the default for the Studio
// engine); one cheap judge call scores all three against the formula's rules, per criterion, and the best is kept. The
// scores of all three are logged on the run (out.versions). The judge never rewrites: it only scores and picks.
import { SOUND_ALLOWED } from "./soundLibrary.js";

/** The criteria, 0-10 each; weight = how much of the total it carries (the ending and the hook carry the most). */
export const STORY_CRITERIA = Object.freeze([
  Object.freeze({ id: "rule", weight: 1, ask: "ONE simple rule a ten-year-old gets in 2 seconds, tied to an everyday thing (a sneeze, a laugh, a hiccup, a lie, a seatbelt), said as 'You see, in this town, ...' right after the hook" }),
  Object.freeze({ id: "examples", weight: 1.5, ask: "2 or 3 society examples that are real JOKES, each in its own place with a named neighbour and ENDING ON A PUNCHLINE" }),
  Object.freeze({ id: "solution", weight: 1.5, ask: "'Then I noticed something': the narrator solves it CLEVERLY by using the rule ITSELF (the rule turned against the trouble), no outside help, no new magic" }),
  Object.freeze({ id: "ending", weight: 2, ask: "a clear BIG WIN, then in the last 1 or 2 lines a HOLY TWIST that flips it or restarts the chaos, ideally a callback to the hook or an example; never soft, sentimental or abstract" }),
  Object.freeze({ id: "hook", weight: 1.5, ask: "line 1 is the craziest result or moment of the story, first person, instantly visual, makes you need the explanation" }),
  Object.freeze({ id: "visible", weight: 1.5, ask: "EVERY line is something a camera can SEE (an action, an object, a reaction); the escalation gets bigger and funnier each step; at most 3 named characters" }),
]);
export const CRITERIA_IDS = Object.freeze(STORY_CRITERIA.map((c) => c.id));

/** The shared rules (the cached system prompt). */
export const STORY_JUDGE_SYSTEM = `You are a tough judge of short story scripts for a viral vertical video format: a kid narrates one impossible rule in a blocky toy town ("In this town, sneezing teleports you"). You get several VERSIONS of the same story (same plan, different wording). Score EACH version, from 0 to 10, on these criteria, and be harsh: 5 is flat, 7 is good, 9 is great, 10 is rare. A version that hits the criterion only in words but not in picture (a feeling, an explanation) scores low.
${STORY_CRITERIA.map((c) => `- ${c.id}: ${c.ask}.`).join("\n")}

THE FORMULA (what a good script does): line 1 the hook; line 2 "You see, in this town, [the one simple rule]."; 2-3 jokes with punchlines; a "But" pivot with a number; an escalation, each step bigger and funnier, in short sentences with sound words (${SOUND_ALLOWED.slice(0, 12).join(", ")}...); "Then I noticed something" and a clever rule-based win; then a holy twist in the last 1-2 lines and a 2-6 word button.

Judge only what is written. Give each version a one-sentence note (its biggest weakness). Return only the JSON object: { "versions": [ { "version": 1, "rule": n, "examples": n, "solution": n, "ending": n, "hook": n, "visible": n, "note": "..." }, ... ], "best": <the number of the best version> }.`;

export function storyJudgeSchema() {
  const n = { type: "integer" }, s = { type: "string" };
  const one = { type: "object", additionalProperties: false, required: ["version", ...CRITERIA_IDS, "note"], properties: { version: n, ...Object.fromEntries(CRITERIA_IDS.map((id) => [id, n])), note: s } };
  return { type: "object", additionalProperties: false, required: ["versions", "best"], properties: { versions: { type: "array", items: one }, best: n } };
}

/** The user message: the versions, numbered, one line per row. */
export function storyJudgePrompt(scripts, { topic = "" } = {}) {
  return [
    topic ? `THE TOPIC: ${String(topic).slice(0, 240)}` : "",
    ...scripts.map((s, i) => `VERSION ${i + 1}\n${(s?.lines ?? []).map((l, k) => `${k + 1}. ${l.text}`).join("\n")}`),
  ].filter(Boolean).join("\n\n");
}

const clamp = (v) => Math.max(0, Math.min(10, Math.round(Number(v) || 0)));
/**
 * The judge's answer as scores per version: [{ version, scores: { rule, examples, ... }, total (0-100), note }], in the order
 * of the versions asked; a version the judge left out scores 0 everywhere (never picked over a scored one).
 */
export function readStoryScores(data, count) {
  const rows = Array.isArray(data?.versions) ? data.versions : [];
  return Array.from({ length: count }, (_, i) => {
    const r = rows.find((x) => Number(x?.version) === i + 1) ?? {};
    const scores = Object.fromEntries(CRITERIA_IDS.map((id) => [id, clamp(r[id])]));
    const wsum = STORY_CRITERIA.reduce((a, c) => a + c.weight, 0);
    const total = Math.round((STORY_CRITERIA.reduce((a, c) => a + c.weight * scores[c.id], 0) / wsum) * 10);
    return { version: i + 1, scores, total, note: String(r.note ?? "").slice(0, 240) };
  });
}

/**
 * The best version's index: no hard problem first (a draft the checks refuse is the last resort), then the judge's total,
 * then fewer advisory notes, then the earlier version. items: [{ hard, advisory, total }].
 */
export function pickBest(items) {
  let best = 0;
  items.forEach((x, i) => {
    const b = items[best];
    const better = (x.hard === 0) !== (b.hard === 0) ? x.hard === 0 : x.hard === 0 ? (x.total - b.total) || (b.advisory - x.advisory) : (b.hard - x.hard) || (x.total - b.total);
    if (better > 0 || better === true) best = i;
  });
  return best;
}

/** The three versions' angles (the same plan; a different push for each, so the three really differ). */
export const VERSION_NOTES = Object.freeze([
  "",
  "VERSION ANGLE: make the three society examples punchier (each ends on a surprising short punchline) and make every escalation step weirder and funnier than the last.",
  "VERSION ANGLE: make the ending the star: a bigger, clearer win, then a holy twist in the last 1 or 2 lines that restarts the chaos with a callback to the hook, and make the 'Then I noticed something' solution cleverer.",
]);
