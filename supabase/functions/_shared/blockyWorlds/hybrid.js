// Blocky Worlds: the HYBRID writer (owner, 2026-11-08). Pure: prompts, schemas, the plan -> card mapping and the checks.
// llm.js makes the calls (writeHybrid).
//
// The owner: "Opus plans the story (premise, twist, clues, jokes, beats), Sonnet writes the lines from that plan. One
// draft, no 3-draft runs." and "Checks: make them about MEANING, not exact wording." and "Judge: keep it as feedback
// only, not as a blocker."
//   1. Opus 5.5 writes the PLAN: the premise, the twist with its clue(s) and WHERE each is planted (which neighbour joke
//      or "Me" line), the planted prop and its climax job, the price, three named neighbour jokes, the narrator's
//      exception, three escalation steps, the discovery, how the climax wins, the closer flipping line 1, and the
//      7-beat outline with line-level intents.
//   2. Sonnet 5.5 writes the LINES from that plan (the reference examples in its system prompt, "In this town, " opener).
//   3. Free checks. HARD (block): the opener, the length band, real copying of a reference, the premise lost entirely,
//      and the safety words. Everything else is an advisory note shown with the script.
//   4. At most ONE cheap fix call, only when a hard check fails (never for an advisory note).
//   5. The judge: a score and notes as feedback only. It never blocks and never triggers a rewrite.
import { BAND, checkScript, partLines, WORDS_PER_LINE_PLAN } from "./script.js";
import { FORMULAS, MOODS, SETTINGS, TWISTS } from "./formulas.js";
import { PART_IDS, PARTS } from "./script.js";
import { BROAD_SCRIPT_SYSTEM } from "./broad.js";
import { normalizeIdea } from "./ideas.js";
import { callbackProblem, propProblems } from "./protocol.js";
import { skeletonProblems } from "./skeleton.js";
import { copyProblems, copyReasons } from "./antiCopy.js";
import { mentions, ruleMissing, topicBlock, topicElements, topicProblems } from "./topic.js";
import { blockedWordsRule } from "./safety.js";
import { targetWords } from "./config.js";

/**
 * Every word the safety check throws out (safety.js: famous names, a game platform's terms, gore), named in BOTH system
 * prompts (owner, 2026-11-08: the 2026-11-08 run planned a "piggy bank" and needed a paid fix). Built from safety.js,
 * so the prompt and the check never drift apart; the same text every call (the prompts are cached).
 */
export const TRAP_WORDS = blockedWordsRule();

/**
 * The length numbers for a length: the band (both ends checked in code), the line count, per part. 2026-11-08 run:
 * topic 2 came back 264 words for a 286-300 band and needed a paid fix, so the minimum is as firm as the maximum and
 * the writer must count.
 */
export function lengthNumbers(lengthSec) {
  const total = targetWords(lengthSec), lo = Math.round(total * BAND.written[0]), hi = Math.round(total * BAND.written[1]);
  const parts = partLines(lengthSec), lines = parts.reduce((a, b) => a + b.lines, 0);
  return { total, lo, hi, lines, parts };
}

/** The plan's LENGTH block: exactly how many line intents per part (the writer writes one line per intent). */
export function planLengthBlock(lengthSec) {
  const n = lengthNumbers(lengthSec);
  return [
    `LENGTH: ${lengthSec} seconds = ${n.lo} to ${n.hi} spoken words = ${n.lines} lines of about ${WORDS_PER_LINE_PLAN} words. The writer writes ONE line per line intent, so your line intents set the length.`,
    `GIVE EXACTLY THIS MANY LINE INTENTS PER PART (${n.lines} in total):\n${n.parts.map((b) => `- ${b.id}: ${b.lines}`).join("\n")}`,
    `BEFORE YOU ANSWER: count the line intents of every part. Fewer than ${n.lines} makes a script that is too short, and a short script is thrown away like a long one.`,
  ].join("\n");
}

/** The line writer's LENGTH block: a firm band at BOTH ends, the line count, and a count before answering. */
export function linesLengthBlock(lengthSec) {
  const n = lengthNumbers(lengthSec);
  return [
    `LENGTH: ${lengthSec} seconds = AT LEAST ${n.lo} and AT MOST ${n.hi} words in total, in ${n.lines} lines (one per planned line intent, 6 to 10 words each). Both ends are checked in code: under ${n.lo} is too short, over ${n.hi} is too long.`,
    `PER PART (lines, words):\n${n.parts.map((b) => `- ${b.id}: ${b.lines} line${b.lines > 1 ? "s" : ""}, about ${b.words} words`).join("\n")}`,
    `BEFORE YOU ANSWER: count the words of every line, part by part, and add them up. Under ${n.lo}: add a real line (a joke, an escalation beat, a climax moment) to the tour, until or climax, never filler words. Over ${n.hi}: cut whole lines from the parts over their plan (never the first line, the planted object, the climax win or the last line). Answer only when the total is ${n.lo} to ${n.hi}.`,
  ].join("\n");
}

/** A script short by at most this share of the band's minimum is only flagged (no paid fix); shorter is the one fix. */
export const SHORT_GRACE = 0.1;

/** Where a clue can be planted. */
export const CLUE_SPOTS = Object.freeze(["neighbour1", "neighbour2", "neighbour3", "price", "me", "until"]);

export const HYBRID_PLAN_SYSTEM = `You are the story planner for Blocky Worlds: 1-2 minute vertical videos narrated by one kid, in an original blocky toy-like world. Another writer will turn your plan into the spoken lines, so your plan carries every story decision: premise, twist, clues, jokes, beats. You do NOT write the final narration.

THE SHAPE (seven parts, in order): ${PARTS.map((p) => `${p.id} (${p.what})`).join("; ")}.

WHAT MAKES THESE VIDEOS WORK (from the reference examples)
- Line 1 states the user's topic as the world's rule, plain fact, starting with exactly "In this town, ". The price of breaking it comes in line 1, 2 or 3, concrete and seen by everyone.
- The tour: three NAMED neighbours, one quick joke each (a name each, new names, never from the references).
- The narrator is the exception or the underdog of the rule.
- An ordinary planted object is shown in "Me" and wins the climax (or the rule itself wins).
- "Until one night" escalates in three visible steps, each bigger than the last.
- The discovery reveals a hidden truth ABOUT THE RULE. The climax wins with the rule or the planted object: no outside help, no new magic.
- The closer flips line 1 (reuse its key word). The most quotable line of the video.

THE TWIST (the most important decision): crazy but SET UP EARLIER. Plant its clue where the viewer laughs at it first, best inside one named neighbour's joke, so they remember it at the reveal. A hint only, never the explanation. For each clue say where it is planted (neighbour1, neighbour2, neighbour3, price, me or until) and the line that plants it, as the intent of that line.

THE BEATS: one per part, in order, each with a short intent, what the camera shows (filmable in a blocky world), and the LINE INTENTS: one short note per spoken line (what that line does, not its final wording). Keep the line counts given in LENGTH.

THE LENGTH: the request gives the exact number of line intents per part. Keep to it: the writer writes one line per intent, and a plan with too few lines makes a script that is thrown away as too short.

RULES: the user's topic is the core of every part, never replaced by an invented gimmick. Original names; never a real game, platform, brand, film, book or person; PG fear only (danger suggested, no gore, no weapons). The names, the prop and every joke you plan must pass the word list below.

${TRAP_WORDS}

Return only the JSON object.`;

export function hybridPlanSchema() {
  const s = { type: "string" };
  const obj = (props, req = Object.keys(props)) => ({ type: "object", additionalProperties: false, required: req, properties: props });
  return obj({
    title: s, premise: s, opener: s, price: s, teaser: s,
    narrator: obj({ name: s, who: s, exception: s }),
    neighbours: { type: "array", items: obj({ name: s, joke: s }) },
    prop: obj({ object: s, setup: s, climax_job: s }),
    twist: obj({ sentence: s, clues: { type: "array", items: obj({ clue: s, where: { type: "string", enum: [...CLUE_SPOTS] }, planted_by: s }) } }),
    escalation: { type: "array", items: s },
    discovery: s,
    climax: obj({ how: s, by: { type: "string", enum: ["rule", "prop"] } }),
    closer: s,
    formula: { type: "string", enum: Object.keys(FORMULAS) },
    twistType: { type: "string", enum: Object.keys(TWISTS) },
    mood: { type: "string", enum: Object.keys(MOODS) },
    setting: s,
    beats: { type: "array", items: obj({ part: { type: "string", enum: [...PART_IDS] }, intent: s, shows: s, lines: { type: "array", items: s } }) },
  });
}

/**
 * The plan call's user message (everything that changes per call is here, after the cached system blocks). recipe:
 * { id, name, what }; idea: the idea card the user picked (the app: "Your topic" gives three, the first is written).
 */
export function hybridPlanPrompt({ topic, recipe = null, lengthSec, note = "", idea = null }) {
  return [
    topicBlock(topic) || `THE USER'S TOPIC: "${String(topic).slice(0, 240)}"`,
    recipe?.id ? `THE RECIPE: ${recipe.id} (${recipe.what ?? recipe.name ?? ""}).` : "",
    pickedIdeaBlock(idea),
    planLengthBlock(lengthSec),
    `SETTING: one of: ${SETTINGS.join("; ")}.`,
    note,
  ].filter(Boolean).join("\n\n");
}

/** The idea the user picked, as a starting point for the plan (its words may be sharpened; the topic stays the core). */
export function pickedIdeaBlock(idea) {
  if (!idea?.opener) return "";
  const rows = [["Opener", idea.opener], ["Premise", idea.premise], ["Price", idea.price], ["Narrator", idea.narrator], ["Planted object", idea.prop], ["Twist", idea.twist], ["Closer", idea.closer], ["Setting", idea.setting]].filter(([, v]) => v);
  return `THE IDEA THE USER PICKED (build the plan on it: keep its world, narrator, object and twist unless one breaks a rule; you plan everything it leaves open):\n${rows.map(([k, v]) => `- ${k}: ${String(v).slice(0, 300)}`).join("\n")}`;
}

/** The plan as an idea card (the shape every check and the judge read), with the twist's first clue and the topic. */
export function planCard(plan, topic) {
  const p = plan ?? {};
  const card = normalizeIdea({
    opener: p.opener, title: p.title, premise: p.premise, price: p.price,
    examples: (p.neighbours ?? []).map((n) => `${n?.name ?? ""}: ${n?.joke ?? ""}`.trim()),
    narrator: [p.narrator?.name, p.narrator?.who, p.narrator?.exception].filter(Boolean).join(", "),
    prop: p.prop?.object, twist: p.twist?.sentence, teaser: p.teaser, closer: p.closer,
    formula: p.formula, twistType: p.twistType, mood: p.mood, setting: p.setting,
  });
  return { ...card, twist_clue: String(p.twist?.clues?.[0]?.clue ?? "").trim(), topic: String(topic ?? "").slice(0, 240) };
}

/** What a plan is missing (free; shown as notes, never a block). */
export function planNotes(plan) {
  const p = plan ?? {}, out = [];
  if ((p.neighbours ?? []).length !== 3) out.push(`the plan has ${(p.neighbours ?? []).length} neighbours, not three`);
  if (!(p.twist?.clues ?? []).length) out.push("the plan's twist has no clue");
  if ((p.escalation ?? []).length !== 3) out.push(`the plan has ${(p.escalation ?? []).length} escalation steps, not three`);
  const parts = (p.beats ?? []).map((b) => b.part);
  const missing = PART_IDS.filter((id) => !parts.includes(id));
  if (missing.length) out.push(`the plan's beats miss ${missing.join(", ")}`);
  return out;
}

const spotLabel = (plan, where) => {
  const m = /^neighbour([123])$/.exec(where ?? "");
  return m ? `${plan?.neighbours?.[Number(m[1]) - 1]?.name ?? `neighbour ${m[1]}`}'s joke` : where === "me" ? '"Me"' : where === "until" ? '"Until one night"' : where === "price" ? "the price line" : String(where ?? "");
};

/** The plan as text for the line writer. */
export function planText(plan) {
  const p = plan ?? {};
  return [
    `TITLE: ${p.title}`,
    `PREMISE: ${p.premise}`,
    `LINE 1 (the rule; tighten if needed, keep "In this town, "): ${p.opener}`,
    `THE PRICE (in line 1, 2 or 3): ${p.price}`,
    `THE THREE NAMED NEIGHBOURS (one quick joke each, in the tour, each line names its neighbour):\n${(p.neighbours ?? []).map((n, i) => `${i + 1}. ${n.name}: ${n.joke}`).join("\n")}`,
    `THE NARRATOR: ${p.narrator?.name}, ${p.narrator?.who}. The exception: ${p.narrator?.exception}`,
    `THE PLANTED OBJECT: ${p.prop?.object}. Set up in "Me": ${p.prop?.setup}. Its job in the climax: ${p.prop?.climax_job}`,
    `THE TWIST: ${p.twist?.sentence}`,
    `ITS CLUES (plant each where it says, as a hint only, never the explanation; pay them off in the discovery or climax):\n${(p.twist?.clues ?? []).map((c) => `- "${c.clue}" in ${spotLabel(p, c.where)}: ${c.planted_by}`).join("\n")}`,
    `THE THREE ESCALATION STEPS ("Until one night"):\n${(p.escalation ?? []).map((e, i) => `${i + 1}. ${e}`).join("\n")}`,
    `THE DISCOVERY (a truth about the rule): ${p.discovery}`,
    `THE CLIMAX (won by the ${p.climax?.by}): ${p.climax?.how}`,
    `THE CLOSER (flips line 1): ${p.closer}`,
    `THE BEATS, LINE BY LINE (one spoken line per intent; write the words, keep the order):\n${(p.beats ?? []).map((b) => `[${b.part}] ${b.intent} | on screen: ${b.shows}\n${(b.lines ?? []).map((l, i) => `  ${i + 1}. ${l}`).join("\n")}`).join("\n")}`,
  ].join("\n\n");
}

/** The line writer's system prompt (after the examples block): the writer's rules, the skeleton and its map. */
export const HYBRID_LINES_SYSTEM = BROAD_SCRIPT_SYSTEM.replace(
  "Return only the JSON object: the title, the lines, the post, and the skeleton map.",
  `YOU GET A PLAN from the story planner: every story decision is made (premise, twist, clues and where they go, the neighbour jokes, the beats line by line). Your job is the WORDS: write each planned line in the fast, punchy, deadpan kid voice of the reference examples, keep the plan's order, names, clues and twist, and keep to the length. Make the jokes land; you may sharpen a joke's wording, never its job. The price goes in line 2 or 3.\n\nTHE LENGTH IS A HARD RULE AT BOTH ENDS: the request gives the minimum and the maximum word count and the line count. Count your words before you answer; a script under the minimum is thrown away exactly like one over the maximum.\n\n${TRAP_WORDS}\n\nReturn only the JSON object: the title, the lines, the post, and the skeleton map.`,
);

/**
 * The line writer's user message: the user's idea, the plan, the length; a fix (or the user's rewrite) adds the previous
 * lines, what failed and the user's note.
 */
export function hybridLinesPrompt({ plan, topic, lengthSec, previous = null, failed = [], note = "" }) {
  return [
    topicBlock(topic),
    `THE PLAN\n${planText(plan)}`,
    linesLengthBlock(lengthSec),
    ...(previous ? [`THE PREVIOUS VERSION (keep every line that is fine, change only what the failed checks need):\n${previous.lines.map((l) => `[${l.part}] ${l.text}`).join("\n")}`] : []),
    ...(note ? [`THE USER ASKS: ${String(note).slice(0, 300)}`] : []),
    ...(failed?.length ? [`IT FAILED THESE HARD CHECKS (fix exactly these):\n${failed.map((p) => `- ${p}`).join("\n")}`] : []),
  ].filter(Boolean).join("\n\n");
}

/**
 * The premise is lost ENTIRELY (the only topic check that blocks): line 1 names none of the topic's elements AND none
 * comes back after the opening. Anything less (a word missing, a quieter climax) is an advisory note.
 */
export function premiseLost(topic, script) {
  const els = topicElements(topic), lines = script?.lines ?? [];
  if (!els.length || !lines.length) return null;
  const first = lines[0].text;
  const firstNone = !els.some((e) => mentions(first, e)) || ruleMissing(els, first).length >= els.length;
  const later = lines.slice(2).map((l) => l.text).join(" ");
  const laterNone = !els.some((e) => mentions(later, e));
  if (firstNone && laterNone) return `The premise is lost: the story never states or uses your idea (${els.map((e) => e.label).join(", ")}).`;
  if (laterNone) return `The premise is lost after the opening: ${els.map((e) => e.label).join(", ")} never come back.`;
  return null;
}

/** Which problems of checkScript block: the opener, the length band, the safety words. */
const HARD_SCRIPT = /^(?:The first line must start|Too long:|Too short:|Uses "|The script is empty)/;

/**
 * Every free check of a hybrid draft, split: hard (blocks; the one fix call is only for these) and advisory (notes shown
 * with the script). Returns { hard, advisory, copy, words, seconds }.
 */
export function hybridChecks({ script, skeleton = {}, card, examples = [], lengthSec = 90 }) {
  const base = checkScript(script, lengthSec, "written");
  const copy = copyProblems({ script, twist: skeleton?.twist || card?.twist || "", topic: card?.topic ?? "", examples });
  const lost = card?.topic ? premiseLost(card.topic, script) : null;
  // the free pad check: short by at most SHORT_GRACE of the minimum is only flagged (no paid fix, the video runs a few
  // seconds shorter); shorter than that stays hard (the one fix)
  const { lo } = lengthNumbers(lengthSec);
  const slightlyShort = (p) => /^Too short:/.test(p) && base.words >= Math.ceil(lo * (1 - SHORT_GRACE));
  const flagged = base.problems.filter(slightlyShort).map(() => `A bit short: ${base.words} words, the band is ${lo} to ${lengthNumbers(lengthSec).hi} (the video runs about ${base.seconds} s).`);
  const hard = [...base.problems.filter((p) => HARD_SCRIPT.test(p) && !slightlyShort(p)), ...copyReasons(copy), ...(lost ? [lost] : [])];
  const advisory = [
    ...flagged,
    ...base.problems.filter((p) => !HARD_SCRIPT.test(p)),
    ...(card ? propProblems(card, script) : []),
    ...(card && callbackProblem(card, script) ? [callbackProblem(card, script)] : []),
    ...(card?.topic && !lost ? topicProblems(card.topic, script) : []),
    ...skeletonProblems(script, skeleton, card),
    ...base.warnings,
  ];
  return { hard, advisory: [...new Set(advisory)], copy, words: base.words, seconds: base.seconds };
}
