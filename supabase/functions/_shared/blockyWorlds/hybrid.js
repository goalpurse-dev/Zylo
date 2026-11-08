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
import { checkScript } from "./script.js";
import { FORMULAS, MOODS, SETTINGS, TWISTS } from "./formulas.js";
import { PART_IDS, PARTS, lengthBlock } from "./script.js";
import { BROAD_SCRIPT_SYSTEM } from "./broad.js";
import { normalizeIdea } from "./ideas.js";
import { callbackProblem, propProblems } from "./protocol.js";
import { skeletonProblems } from "./skeleton.js";
import { copyProblems, copyReasons } from "./antiCopy.js";
import { mentions, ruleMissing, topicBlock, topicElements, topicProblems } from "./topic.js";

/**
 * Everyday words the safety check throws out (safety.js: a game platform's terms, famous names, gore). 2026-11-08 run:
 * Opus planned a "piggy bank" and the script needed a paid fix. Both prompts name them.
 */
export const TRAP_WORDS = "never these words, not even as ordinary words (the code throws the script out): piggy (say coin bank), doors (say the door), guy, boo, oof, noob, obby, blood, gun, bomb, stab, murder, frozen, ember, silo, wool";

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

RULES: the user's topic is the core of every part, never replaced by an invented gimmick. Original names; never a real game, platform, brand, film, book or person; PG fear only (danger suggested, no gore, no weapons); ${TRAP_WORDS}.
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

/** The plan call's user message. recipe: { id, name, what }. */
export function hybridPlanPrompt({ topic, recipe = null, lengthSec, note = "" }) {
  return [
    topicBlock(topic) || `THE USER'S TOPIC: "${String(topic).slice(0, 240)}"`,
    recipe?.id ? `THE RECIPE: ${recipe.id} (${recipe.what ?? recipe.name ?? ""}).` : "",
    lengthBlock(lengthSec).split("\nBEFORE YOU ANSWER")[0],
    `SETTING: one of: ${SETTINGS.join("; ")}.`,
    note,
  ].filter(Boolean).join("\n\n");
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
  `YOU GET A PLAN from the story planner: every story decision is made (premise, twist, clues and where they go, the neighbour jokes, the beats line by line). Your job is the WORDS: write each planned line in the fast, punchy, deadpan kid voice of the reference examples, keep the plan's order, names, clues and twist, and keep to the length. Make the jokes land; you may sharpen a joke's wording, never its job. The price goes in line 2 or 3. ${TRAP_WORDS}.\n\nReturn only the JSON object: the title, the lines, the post, and the skeleton map.`,
);

/** The line writer's user message: the user's idea, the plan, the length; a fix adds the previous lines and what failed. */
export function hybridLinesPrompt({ plan, topic, lengthSec, previous = null, failed = [] }) {
  return [
    topicBlock(topic),
    `THE PLAN\n${planText(plan)}`,
    lengthBlock(lengthSec),
    ...(previous ? [`THE PREVIOUS VERSION (keep every line that is fine, change only what the failed checks need):\n${previous.lines.map((l) => `[${l.part}] ${l.text}`).join("\n")}`] : []),
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
  const hard = [...base.problems.filter((p) => HARD_SCRIPT.test(p)), ...copyReasons(copy), ...(lost ? [lost] : [])];
  const advisory = [
    ...base.problems.filter((p) => !HARD_SCRIPT.test(p)),
    ...(card ? propProblems(card, script) : []),
    ...(card && callbackProblem(card, script) ? [callbackProblem(card, script)] : []),
    ...(card?.topic && !lost ? topicProblems(card.topic, script) : []),
    ...skeletonProblems(script, skeleton, card),
    ...base.warnings,
  ];
  return { hard, advisory: [...new Set(advisory)], copy, words: base.words, seconds: base.seconds };
}
