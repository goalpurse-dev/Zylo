// Blocky Worlds: the script writer (prompt, schema) and the checks every script passes, generated or the user's own.
// Pure. llm.js makes the calls.
//
// The pace: the references run ~260 words a minute (ANALYSIS.md 2.3). The voice is already at its top speed (config.js
// NARRATOR), so the pace comes from the writing: short, punchy, single-clause lines, contractions, and no punctuation
// that makes the voice pause (semicolons, colons, dashes, ellipses, brackets). Code cleans that punctuation out
// (paceClean) and sizes the script to the length (targetWords).
import { LENGTHS, PACE, targetWords } from "./config.js";
import { FORMULAS, MOODS, TWISTS } from "./formulas.js";
import { fixOpener, hasOpener, openerProblem } from "./opener.js";
import { safetyProblems } from "./safety.js";
import { EXAMPLE_SCRIPT } from "./examples.js";
import { topicBlock } from "./topic.js";

/** The seven parts, in order, and their share of the words (ANALYSIS.md 2.2). */
export const PARTS = Object.freeze([
  Object.freeze({ id: "rule", label: "Rule", share: 0.03, what: "the first line: the world rule as plain fact" }),
  Object.freeze({ id: "tour", label: "World tour", share: 0.17, what: '"You see," then how it works, the price, and three quick examples with named neighbours' }),
  Object.freeze({ id: "me", label: "Me", share: 0.13, what: "the narrator, how they're the exception, the person they love, and the planted object" }),
  Object.freeze({ id: "until", label: "Until one night", share: 0.22, what: '"Until one night..." the rule breaks or the threat arrives; three rising, visible steps' }),
  Object.freeze({ id: "discovery", label: "Discovery", share: 0.15, what: "the hidden truth about the rule" }),
  Object.freeze({ id: "climax", label: "Climax", share: 0.22, what: "the narrator wins with the rule itself or the planted object, never with outside help" }),
  Object.freeze({ id: "closer", label: "Closer", share: 0.08, what: "the world changed, and a last line that flips or echoes the first (or a horror sting)" }),
]);
export const PART_IDS = Object.freeze(PARTS.map((p) => p.id));

/** The pace rules, in numbers. The opener may be longer: the references' run up to ~22 words. */
export const LINE = Object.freeze({ maxWords: 16, softMaxWords: 12, targetMedian: 8, maxCommas: 1, openerMaxWords: 24 });
/**
 * How close to the target the word count must be: a generated script / the user's own script. A generated script never
 * goes over the target (2026-11-06: +6% made a 90 s video 95.8 s), so the video lands on the chosen length.
 */
export const BAND = Object.freeze({ written: Object.freeze([0.9, 1.0]), own: Object.freeze([0.5, 1.1]) });

/** Lazy writing the references' best videos never use. Each is a warning the rewrite fixes. */
export const LAZY = Object.freeze([
  /\bsuddenly\b/i, /\bI realized something\b/i, /\blittle did (I|we|they) know\b/i, /\bI was an? \d+-year-old\b/i,
  /\bthe moral\b/i, /\blesson\b/i, /\bin conclusion\b/i, /\bto be honest\b/i, /\bit turns out that\b/i, /\bsubscribe\b/i,
]);

const words = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean);
export const wordCount = (s) => words(s).length;

/**
 * A line with the pausing punctuation replaced: ";" ":" and dashes become a full stop or a comma, ellipses a full stop,
 * brackets dropped, curly quotes made straight, spaces tidied. Meaning is kept; only the pauses go.
 */
export function paceClean(line) {
  let t = String(line ?? "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  t = t.replace(/[()[\]]/g, "");                                  // brackets
  t = t.replace(/\s*(\.\s*){2,}|\s*…\s*/g, ". ");               // ellipses
  t = t.replace(/\s+[—–-]{1,2}\s+|—|–/g, ", ");                 // dashes between words
  t = t.replace(/\s*;\s*/g, ". ").replace(/(\w)\s*:\s+/g, "$1. "); // semicolons, colons
  t = t.replace(/\s+([,.!?])/g, "$1").replace(/([,.!?])(?=[A-Za-z])/g, "$1 ").replace(/,\s*,/g, ",").replace(/\.\s*\./g, ".");
  t = t.replace(/\.\s+([a-z])/g, (_, c) => `. ${c.toUpperCase()}`).replace(/\s+/g, " ").trim();
  if (t && !/[.!?"]$/.test(t)) t += ".";
  return t;
}

/** Seconds the narration should take at the target pace (plus the trimmed gaps between lines). */
export function estimateSeconds(lines) {
  const n = lines.reduce((a, l) => a + wordCount(l.text ?? l), 0);
  return Number(((n / PACE.targetWpm) * 60 + Math.max(0, lines.length - 1) * PACE.sentenceGapSec * 0.3).toFixed(1));
}

/**
 * Per-part word budgets for a length (they add up to the target, within a word or two). The rule is the opener, which
 * runs 12-22 words at any length, so it gets at least 14 and the other six parts share the rest by their shares (at
 * least 8 each): a 30 s script (110 words) still fits all seven parts inside its own band.
 */
export const RULE_MIN_WORDS = 14;
export function partBudgets(lengthSec) {
  const total = targetWords(lengthSec);
  const rule = Math.max(RULE_MIN_WORDS, Math.round(total * PARTS[0].share));
  const rest = total - rule, restShare = 1 - PARTS[0].share;
  const out = PARTS.map((p) => ({ id: p.id, words: p.id === "rule" ? rule : Math.max(8, Math.round((rest * p.share) / restShare)) }));
  // rounding never takes the plan over the target (the band's top): the biggest part gives the extra words back
  for (let over = out.reduce((a, b) => a + b.words, 0) - total; over > 0; over--) out.reduce((m, b) => (b.id !== "rule" && b.words > m.words ? b : m), out[1]).words--;
  return out;
}

const SAMPLE_WORDS = EXAMPLE_SCRIPT.lines.reduce((a, l) => a + wordCount(l.text), 0);
export const SCRIPT_SYSTEM = `You write the narration for Blocky Worlds: 30-second to 3-minute vertical videos narrated by one kid, set in an original blocky toy-like world, for TikTok and YouTube Shorts. The narration is read by a text-to-speech voice that is already at its top speed, and the videos must sound FAST (about 260 words a minute) like the viral references. The pace comes from YOUR LINES.

THE SHAPE (seven parts, in order)
${PARTS.map((p, i) => `${i + 1}. ${p.id}: ${p.what}`).join("\n")}

THE HARD RULE
- The very first line MUST start with exactly "In this world, " or "In this town, " (capital I, a comma after "world" or "town"). It states the rule as plain fact.

PACE (this is what makes it fast)
- One line = one short spoken sentence or fragment. Most lines 5 to 10 words. Never more than ${LINE.maxWords} words.
- One idea per line. Cut "and then", "which", "that was when", "so that". Start the next line instead.
- At most one comma in a line. NEVER use semicolons, colons, dashes, ellipses or brackets (each makes the voice stop).
- Contractions always (it's, didn't, we'd). Short, everyday words.
- Fragments are good: "Heavy. Soaked. Stuck." Sound words get their own line: "Scratch. Scratch."
- Dialogue is short and inline: "Hey rope boy, need a lift?" Never a speaker label.
- Numbers under a hundred as words (twelve, not 12).

VOICE
- First person, past tense, a kid telling a friend what happened. Deadpan about the absurd rule, wry jokes ("She was lying, but it was nice.").
- Concrete, named details beat summaries: "Mr. Pickett wished for a brand new truck. Now he has a truck and an empty cage."
- Line two usually starts "You see,".
- Never: "Suddenly", "I realized something", "Little did I know", "I was a 12-year-old boy who", spelled-out morals, "subscribe".

STORY RULES
- Escalate in three visible steps. Every step is something a camera can show.
- The planted object or the rule itself wins the climax. No new magic at the end.
- The last line is the most quotable line in the video and calls back the first.
- Original world and names only: never a real game, platform, film, book, brand or person, and never the words "Roblox", "Robux", "noob", "obby", "oof".
- PG fear only: suggest danger, never gore, weapons or anything a kid could copy dangerously.

POST (the upload text)
- title: up to 70 characters, a hook, no hashtags. description: one or two sentences. hashtags: 3 to 6, lowercase, no "#roblox".

A STYLE SAMPLE (${SAMPLE_WORDS} words, about ${Math.round((SAMPLE_WORDS / PACE.targetWpm) * 60)} seconds: its LENGTH is not your target, the LENGTH line of the request is). Match its line length, rhythm and voice. Never reuse its story, names or lines.
${EXAMPLE_SCRIPT.lines.map((l) => `[${l.part}] ${l.text}`).join("\n")}

Return only the JSON object.`;

/** The tool schema (no array size limits). */
export function scriptSchema() {
  const s = { type: "string" };
  return {
    type: "object", additionalProperties: false, required: ["title", "lines", "post"],
    properties: {
      title: s,
      lines: { type: "array", items: { type: "object", additionalProperties: false, required: ["part", "text"], properties: { part: { type: "string", enum: [...PART_IDS] }, text: s } } },
      post: { type: "object", additionalProperties: false, required: ["title", "description", "hashtags"], properties: { title: s, description: s, hashtags: { type: "array", items: s } } },
    },
  };
}

const ideaText = (idea) => [
  `Opener (use it as the first line, you may tighten it): ${idea.opener}`,
  `Premise: ${idea.premise}`,
  `Price of breaking the rule: ${idea.price}`,
  `Examples to build on: ${(idea.examples ?? []).join(" | ")}`,
  `Narrator: ${idea.narrator}`,
  `Planted object: ${idea.prop}`,
  `Twist: ${idea.twist}`,
  `Closer to aim for: ${idea.closer}`,
  `Setting: ${idea.setting}`,
  `Formula ${idea.formula} (${FORMULAS[idea.formula]?.name ?? "-"}), twist ${idea.twistType} (${TWISTS[idea.twistType]?.name ?? "-"}), mood ${idea.mood} (${MOODS[idea.mood]?.tone ?? "-"})`,
].join("\n");

/** The user message for a new script (or a rewrite: previous + the user's note). */
export function scriptPrompt({ idea, lengthSec, previous = null, note = "", beats = null, failed = [] }) {
  const total = targetWords(lengthSec);
  const budgets = partBudgets(lengthSec).map((b) => `${b.id} ~${b.words}`).join(", ");
  return [
    ...(idea?.topic && topicBlock(idea.topic) ? [topicBlock(idea.topic)] : []),
    `THE IDEA\n${ideaText(idea)}`,
    ...(beats?.length ? [`THE BEAT SHEET (follow it part by part)\n${beats.map((b) => `[${b.part}] ${b.summary} | on screen: ${b.shows} | ~${b.words} words`).join("\n")}`] : []),
    `LENGTH: ${lengthSec} seconds = ${total} words in total (between ${Math.round(total * BAND.written[0])} and ${Math.round(total * BAND.written[1])}, never more: the video must not run longer than ${lengthSec} s). Words per part: ${budgets}. That is about ${Math.round(total / LINE.targetMedian)} lines.`,
    ...(previous ? [`THE PREVIOUS VERSION (write a better one, keep what works):\n${previous.lines.map((l) => `[${l.part}] ${l.text}`).join("\n")}`] : []),
    ...(note ? [`THE USER ASKS: ${String(note).slice(0, 300)}`] : []),
    ...(failed?.length ? [`THE PREVIOUS VERSION FAILED THESE CHECKS (the new one must pass every one):\n${failed.map((p) => `- ${p}`).join("\n")}`] : []),
  ].join("\n\n");
}

/** A script as returned (or edited), cleaned: pausing punctuation out, the opener fixed when it's a near miss. */
export function normalizeScript(raw) {
  const lines = (Array.isArray(raw?.lines) ? raw.lines : [])
    .map((l) => ({ part: PART_IDS.includes(l?.part) ? l.part : "own", text: paceClean(l?.text) }))
    .filter((l) => l.text && l.text !== ".");
  if (lines.length) {
    const fixed = fixOpener(lines[0].text);
    if (fixed) lines[0] = { ...lines[0], text: fixed };
  }
  const post = raw?.post ?? {};
  return {
    title: String(raw?.title ?? "").trim().slice(0, 80),
    lines,
    post: {
      title: String(post.title ?? raw?.title ?? "").trim().slice(0, 70),
      description: String(post.description ?? "").trim().slice(0, 400),
      hashtags: (Array.isArray(post.hashtags) ? post.hashtags : []).map((h) => `#${String(h).replace(/^#+/, "").toLowerCase().replace(/[^a-z0-9_]/g, "")}`).filter((h) => h.length > 1 && !/roblox/.test(h)).slice(0, 6),
    },
  };
}

/** The user's own script, pasted as text: one line per sentence (blank lines and line breaks split too). */
export function scriptFromText(text, title = "") {
  const sentences = String(text ?? "").replace(/\r/g, "").split(/\n+/).flatMap((para) => para.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
  return normalizeScript({ title, lines: sentences.map((t) => ({ part: "own", text: t })), post: { title } });
}

/** The narration exactly as the voice reads it. */
export const narrationOf = (script) => script.lines.map((l) => l.text).join(" ");

/**
 * The checks. problems: refuse (a generated script is rewritten, the user's own is shown the reasons); warnings: the
 * rewrite fixes them, but they don't stop a video. kind: "written" (ours: the parts must be there) or "own".
 */
export function checkScript(script, lengthSec, kind = "written") {
  const problems = [], warnings = [];
  const lines = script?.lines ?? [];
  if (!LENGTHS.includes(lengthSec)) problems.push(`The length must be ${LENGTHS[0]} to ${LENGTHS.at(-1)} seconds, in 10 s steps.`);
  if (!lines.length) return { problems: ["The script is empty."], warnings, words: 0, seconds: 0 };
  const op = openerProblem(lines[0].text);
  if (op) problems.push(op);
  const total = lines.reduce((a, l) => a + wordCount(l.text), 0);
  const target = targetWords(lengthSec), [lo, hi] = BAND[kind] ?? BAND.written;
  if (total < Math.round(target * lo)) problems.push(`Too short: ${total} words, a ${lengthSec} s video needs at least ${Math.round(target * lo)}.`);
  if (total > Math.round(target * hi)) problems.push(`Too long: ${total} words, a ${lengthSec} s video fits ${Math.round(target * hi)} at most.`);
  lines.forEach((l, i) => {
    const n = wordCount(l.text), max = i === 0 ? LINE.openerMaxWords : LINE.maxWords;
    if (n > max) (kind === "written" ? problems : warnings).push(`Line ${i + 1} has ${n} words (keep it under ${max}): "${l.text.slice(0, 50)}..."`);
    else if (i > 0 && n > LINE.softMaxWords) warnings.push(`Line ${i + 1} is long (${n} words).`);
    if (i > 0 && (l.text.match(/,/g) ?? []).length > LINE.maxCommas) warnings.push(`Line ${i + 1} has more than one comma.`);
    for (const re of LAZY) if (re.test(l.text)) warnings.push(`Line ${i + 1} uses "${l.text.match(re)[0]}".`);
  });
  const sorted = lines.map((l) => wordCount(l.text)).sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
  if (median > LINE.targetMedian + 2) warnings.push(`Lines are long on average (median ${median} words): split them for pace.`);
  if (kind === "written") {
    const order = lines.map((l) => PART_IDS.indexOf(l.part));
    if (lines[0].part !== "rule") problems.push('The first line must be the "rule" part.');
    if (order.some((p, i) => p < 0 || (i && p < order[i - 1]))) problems.push("The parts are out of order.");
    const missing = PART_IDS.filter((p) => !lines.some((l) => l.part === p));
    if (missing.length) problems.push(`Missing parts: ${missing.join(", ")}.`);
  }
  problems.push(...safetyProblems(`${script.title ?? ""}\n${narrationOf(script)}\n${script.post?.title ?? ""}\n${script.post?.description ?? ""}`));
  return { problems, warnings, words: total, seconds: estimateSeconds(lines) };
}

/**
 * The part repair ("Fix it" on a blocked script): rewrite only the lines a check flagged (one part, or one line), keep
 * every other line word for word. The reasons are the checks' own sentences.
 */
export const PART_FIX_SYSTEM = `You fix one part of a Blocky Worlds story narration that failed a check. You get the whole script (for context), the lines to replace, and exactly why they failed. Write replacement lines for ONLY those lines, so the checks pass.
- Keep the story, the names and what happens; change only what the reasons require.
- About the same number of words as the lines you replace (within a few), one short spoken sentence per line, most lines 5 to 10 words, never more than ${LINE.maxWords}.
- No semicolons, colons, dashes, ellipses or brackets. Contractions. First person, past tense, the same voice.
- If the planted object must pay off, the hero wins WITH it, and the line names it (its own word, like "the tape").
- If the ending must call back the first line, the last lines reuse a word or picture from line 1.
- If the story drifted from the user's own idea, the new lines bring its named elements (its world, its threat, its characters) back into the action, by name.
- Original names only, PG fear only.
Return only the JSON object: { "lines": ["...", "..."] }.`;
export const partFixSchema = () => ({ type: "object", additionalProperties: false, required: ["lines"], properties: { lines: { type: "array", items: { type: "string" } } } });
export function partFixPrompt({ script, indexes, reasons, card = null }) {
  const set = new Set(indexes);
  return [
    `THE SCRIPT (the lines marked >> are the ones to replace)\n${script.lines.map((l, i) => `${set.has(i) ? ">>" : "  "} ${i + 1} [${l.part}] ${l.text}`).join("\n")}`,
    ...(card?.topic && topicBlock(card.topic) ? [topicBlock(card.topic)] : []),
    ...(card ? [`THE IDEA: planted object: ${card.prop ?? "-"} | twist: ${card.twist ?? "-"} | closer to aim for: ${card.closer ?? "-"}`] : []),
    `WHY THEY FAILED (fix every one):\n${reasons.map((r) => `- ${r}`).join("\n")}`,
    `Replace lines ${indexes.map((i) => i + 1).join(", ")} (${indexes.reduce((a, i) => a + wordCount(script.lines[i]?.text), 0)} words now).`,
  ].join("\n\n");
}

/** The opener repair (one small call): rewrite only the first line, keeping its meaning. */
export const OPENER_SYSTEM = `You fix the first line of a story narration. Rewrite it so it starts with exactly "In this world, " or "In this town, " and states the same world rule as plain fact, in 8 to 20 words, with no semicolons, colons, dashes or ellipses. Keep its meaning and its names. Return only the JSON object.`;
export const openerSchema = () => ({ type: "object", additionalProperties: false, required: ["line"], properties: { line: { type: "string" } } });
export const openerPrompt = (line, next = "") => `The first line: ${line}\nThe line after it: ${next}`;
export const openerOk = (line) => hasOpener(paceClean(line)) && safetyProblems(line).length === 0;
