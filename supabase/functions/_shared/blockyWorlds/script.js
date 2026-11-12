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
import { mapNearSounds, sfxTags } from "./sfxTags.js";

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
- The very first line MUST start with exactly "In this town, " (capital I, a comma after "town"; never "In this world"). It states the rule as plain fact.

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

/**
 * Lines per part for a length: its word budget at ~7.5 words a line (the rule is one line). 2026-11-07: a 60 s script
 * came back 33 lines / 257 words for a 212-word cap (the writer wrote ~6 lines more than the words allow); a line count
 * per part is something the writer keeps, a word count alone is not.
 */
export const WORDS_PER_LINE_PLAN = 7.5;
export const partLines = (lengthSec) => partBudgets(lengthSec).map((b) => ({ ...b, lines: b.id === "rule" ? 1 : Math.max(1, Math.round(b.words / WORDS_PER_LINE_PLAN)) }));

/** The LENGTH block of the script prompt: the total, the band, per-part words AND lines, and a count before answering. */
export function lengthBlock(lengthSec) {
  const total = targetWords(lengthSec), lo = Math.round(total * BAND.written[0]), hi = Math.round(total * BAND.written[1]);
  const plan = partLines(lengthSec), lines = plan.reduce((a, b) => a + b.lines, 0);
  return [
    `LENGTH: ${lengthSec} seconds = ${lo} to ${hi} words in total, in about ${lines} lines. Never more than ${hi} words: the video must not run longer than ${lengthSec} s, and a longer script is thrown away.`,
    `THE PLAN PER PART (keep to it; the line counts matter as much as the words):\n${plan.map((b) => `- ${b.id}: ${b.lines} line${b.lines > 1 ? "s" : ""}, about ${b.words} words`).join("\n")}`,
    `BEFORE YOU ANSWER: count the words of every part and add them up. If the total is over ${hi}, cut whole lines from the parts that are over their plan (never the first line, the planted object, the climax win or the last line) until it is ${hi} or less.`,
  ].join("\n");
}

/** The user message for a new script (or a rewrite: previous + the user's note). */
export function scriptPrompt({ idea, lengthSec, previous = null, note = "", beats = null, failed = [] }) {
  const lines = Object.fromEntries(partLines(lengthSec).map((b) => [b.id, b]));
  return [
    ...(idea?.topic && topicBlock(idea.topic) ? [topicBlock(idea.topic)] : []),
    `THE IDEA\n${ideaText(idea)}`,
    // the plan's numbers, not the beat writer's (2026-11-07: its words were right, the script still ran 21% over)
    ...(beats?.length ? [`THE BEAT SHEET (follow it part by part)\n${beats.map((b) => `[${b.part}] ${b.summary} | on screen: ${b.shows} | ${lines[b.part] ? `${lines[b.part].lines} line(s), ~${lines[b.part].words} words` : `~${b.words} words`}`).join("\n")}`] : []),
    lengthBlock(lengthSec),
    ...(previous ? [`THE PREVIOUS VERSION (write a better one, keep what works):\n${previous.lines.map((l) => `[${l.part}] ${l.text}`).join("\n")}`] : []),
    ...(note ? [`THE USER ASKS: ${String(note).slice(0, 300)}`] : []),
    ...(failed?.length ? [`THE PREVIOUS VERSION FAILED THESE CHECKS (the new one must pass every one):\n${failed.map((p) => `- ${p}`).join("\n")}`] : []),
  ].join("\n\n");
}

/** A script as returned (or edited), cleaned: pausing punctuation out, the opener fixed when it's a near miss. */
export function normalizeScript(raw) {
  const lines = (Array.isArray(raw?.lines) ? raw.lines : [])
    // the hybrid writer's beat (beatSheet.js) rides along on the line; the part stays one of the seven
    .map((l) => ({ part: PART_IDS.includes(l?.part) ? l.part : "own", text: mapNearSounds(paceClean(l?.text)), ...(typeof l?.beat === "string" && /^[a-z]{2,12}$/.test(l.beat) ? { beat: l.beat } : {}) }))
    .filter((l) => l.text && l.text !== ".")
    // the sound-word tags the engine reads (sfxTags.js): always taken from the text, so they never drift from it
    .map((l) => { const sfx = sfxTags(l.text); return sfx.length ? { ...l, sfx } : l; });
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
 * The free length fix: a script over its length is trimmed in code before any paid rewrite (2026-11-07: a 60 s script
 * at 257 words, then 213, cost three extra Sonnet calls, $0.10). Two passes, each change kept only when the checks find
 * nothing new (check: the caller's full check, protocol included):
 *   1. filler words: a leading "Then" / "And then" / "So", and "really", "very", "just", "actually", "totally", "literally"
 *   2. whole lines, from the part furthest over its budget first; never line 1 (the rule), the first line of a part (its
 *      hook: "You see", "Until one night"), the last line (the callback), or a line `keep` protects (the climax win); a
 *      part keeps at least two lines and 60% of its budget; the cheapest line goes first (the fewest words that other
 *      lines share: a line nothing else refers to is filler)
 * The trim never goes under the band. Returns { script, words, changes: [{ index, from, to }], fits }.
 */
const TRIM_LEAD = /^(?:and then|then|so)[,]?\s+(?=\S)/i;
// lowercase only: a sentence's own first word stays (2026-11-10: "Just like that, he was gone" became "like that")
const TRIM_INNER = /\s+(?:really|very|just|actually|totally|literally)\b/g;
const SHARE_STOP = new Set("the and was were that this with from they them their then there into onto what when where have had has his her she him our out all one but not you your for are its it's i'm i'd didn't don't can't".split(" "));
const keyWords = (t) => String(t ?? "").toLowerCase().replace(/[’]/g, "'").split(/[^a-z']+/).map((w) => w.replace(/'s$/, "")).filter((w) => w.length > 3 && !SHARE_STOP.has(w));
const PRONOUN_START = /^(?:\S+\s+){0,2}(?:he|she|it|they|him|her|them|his|its|their)\b/i;
// frozen(line, i): a line neither pass may touch, not even its filler words (the beat sheet's "Then there's me.");
// groupOf / budgets: the groups whole lines are counted in (default the seven parts; the beat sheet passes its beats)
export function trimScript(script, lengthSec, { check = (s) => checkScript(s, lengthSec, "written"), keep = () => false, frozen = () => false, anchors = "", groupOf = (l) => l.part, budgets = null } = {}) {
  const anchorWords = new Set(keyWords(anchors));
  const target = targetWords(lengthSec), hi = Math.round(target * BAND.written[1]), lo = Math.round(target * BAND.written[0]);
  const count = (ls) => ls.reduce((a, l) => a + wordCount(l.text), 0);
  let lines = script.lines.map((l) => ({ ...l }));
  const changes = [];
  if (count(lines) <= hi) return { script, words: count(lines), changes, fits: true };
  const lengthKey = (p) => /^Too (long|short):/.test(p);
  const norm = (p) => p.replace(/\d+/g, "#");
  const had = new Set(check(script).problems.filter((p) => !lengthKey(p)).map(norm));
  const ok = (ls) => check({ ...script, lines: ls }).problems.every((p) => lengthKey(p) || had.has(norm(p)));
  // 1. filler words
  for (let i = 1; i < lines.length - 1 && count(lines) > hi; i++) {
    if (wordCount(lines[i].text) <= 3 || frozen(lines[i], i)) continue;
    const t = lines[i].text.replace(TRIM_LEAD, "").replace(TRIM_INNER, "").replace(/^./, (c) => c.toUpperCase());
    if (t === lines[i].text || count(lines) - (wordCount(lines[i].text) - wordCount(t)) < lo) continue;
    const next = lines.map((l, k) => (k === i ? { ...l, text: t } : l));
    if (ok(next)) { changes.push({ index: i, from: lines[i].text, to: t }); lines = next; }
  }
  // 2. whole lines
  const budget = budgets ?? Object.fromEntries(partBudgets(lengthSec).map((b) => [b.id, b.words]));
  const g = groupOf;
  const tried = new Set();
  while (count(lines) > hi) {
    const used = {};
    for (const l of lines) used[g(l)] = (used[g(l)] ?? 0) + wordCount(l.text);
    const firstOf = new Set([...new Set(lines.map(g))].map((p) => lines.findIndex((l) => g(l) === p)));
    const total = count(lines);
    // what dropping line i loses: words other lines share (set-ups, payoffs), the card's key words (twist, object) count
    // double, and a next line that leans on it with a pronoun ("...rang right after her") counts 2 more
    const shared = (i) => {
      const others = new Set(lines.flatMap((l, k) => (k === i ? [] : keyWords(l.text))));
      const own = keyWords(lines[i].text);
      const lean = lines[i + 1] && g(lines[i + 1]) === g(lines[i]) && PRONOUN_START.test(lines[i + 1].text) ? 2 : 0;
      return own.filter((w) => others.has(w)).length + 2 * own.filter((w) => anchorWords.has(w)).length + lean;
    };
    const cands = lines.map((l, i) => ({ l, i, n: wordCount(l.text) }))
      .filter(({ l, i, n }) => i > 0 && i < lines.length - 1 && !firstOf.has(i) && !keep(l, i) && !frozen(l, i) && !tried.has(l.text)
        && lines.filter((m) => g(m) === g(l)).length > 2 && used[g(l)] - n >= 0.6 * (budget[g(l)] ?? 0) && total - n >= lo)
      .map((c) => ({ ...c, over: (used[g(c.l)] - (budget[g(c.l)] ?? used[g(c.l)])) / Math.max(1, budget[g(c.l)] ?? 1), cost: shared(c.i) }))
      .sort((a, b) => b.over - a.over || a.cost - b.cost || b.n - a.n);
    let done = false;
    for (const c of cands) {
      tried.add(c.l.text);
      const next = lines.filter((_, k) => k !== c.i);
      if (ok(next)) { changes.push({ index: c.i, from: c.l.text, to: null }); lines = next; done = true; break; }
    }
    if (!done) break;
  }
  const words = count(lines);
  return { script: { ...script, lines }, words, changes, fits: words <= hi };
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
export const OPENER_SYSTEM = `You fix the first line of a story narration. Rewrite it so it starts with exactly "In this town, " and states the same world rule as plain fact, in 8 to 20 words, with no semicolons, colons, dashes or ellipses. Keep its meaning and its names. Return only the JSON object.`;
export const openerSchema = () => ({ type: "object", additionalProperties: false, required: ["line"], properties: { line: { type: "string" } } });
export const openerPrompt = (line, next = "") => `The first line: ${line}\nThe line after it: ${next}`;
export const openerOk = (line) => hasOpener(paceClean(line)) && safetyProblems(line).length === 0;
