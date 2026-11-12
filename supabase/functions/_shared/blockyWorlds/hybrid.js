// Blocky Worlds: the HYBRID writer (owner, 2026-11-08). Pure: prompts, schemas, the plan -> card mapping and the checks.
// llm.js makes the calls (writeHybrid).
//
// The owner: "Opus plans the story (premise, twist, clues, jokes, beats), Sonnet writes the lines from that plan. One
// draft, no 3-draft runs." and "Checks: make them about MEANING, not exact wording." and "Judge: keep it as feedback
// only, not as a blocker."
// 2026-11-10 (owner): the writer follows the BEAT SHEET of 15 viral videos (beatSheet.js) instead of the old 7-beat
// skeleton, and "THE STORY IS IN THE PICTURE": the plan carries a RULE VISUAL (one visible parameter of the world that
// shows the rule, with its value for the three named neighbours and the hero), the ally's planted line, the adults'
// failed attempts and how the hero's flaw + that line save everyone.
//   1. Opus 5.5 writes the PLAN: the rule visual, the origin, three named neighbours, the hero (the worst at the rule)
//      and their flaw, the ally's planted line, the trigger, the adults' failed attempts, the save, the callback, and the
//      beat-by-beat outline with line-level intents.
//   2. Sonnet 5.5 writes the LINES from that plan (the reference examples in its system prompt, "In this town, " opener),
//      each line tagged with its beat; the part (the engine's seven) follows from the beat.
//   3. Free checks. HARD (block): the opener, the length band, real copying of a reference, the premise lost entirely,
//      and the safety words. The beat-sheet checks and everything else are advisory notes shown with the script.
//   4. At most ONE cheap fix call, only when a hard check fails (never for an advisory note).
//   5. The judge: a score and notes as feedback only. It never blocks and never triggers a rewrite.
import { BAND, checkScript, SCRIPT_SYSTEM, scriptSchema, wordCount } from "./script.js";
import { FORMULAS, MOODS, SETTINGS, TWISTS } from "./formulas.js";
import { normalizeIdea } from "./ideas.js";
import { aimWords, BEAT_IDS, BEAT_MAP_TEXT, BEAT_PART, BEAT_SHEET_TEXT, BEAT_WORDS_PER_LINE, BEATS, beatBudgets, LINE_MAX_WORDS, beatMapSchema, beatPlanNotes, beatSheetProblems, RULE_VISUAL_TEXT, ruleVisualOf } from "./beatSheet.js";
import { copyProblems, copyReasons } from "./antiCopy.js";
import { callbackProblem, propProblems } from "./protocol.js";
import { skeletonProblems } from "./skeleton.js";
import { mentions, ruleMissing, topicBlock, topicElements, topicProblems } from "./topic.js";
import { blockedWordsRule } from "./safety.js";
import { targetWords } from "./config.js";
import { buttonProblems, formulaProblems } from "./formula.js";
import { BOARD_KIT } from "./boardKit.js";
import { boardFitProblems, kitBlock, swapHint } from "./boardFit.js";

/**
 * Every word the safety check throws out (safety.js: famous names, a game platform's terms, gore), named in BOTH system
 * prompts (owner, 2026-11-08: the 2026-11-08 run planned a "piggy bank" and needed a paid fix). Built from safety.js,
 * so the prompt and the check never drift apart; the same text every call (the prompts are cached).
 */
export const TRAP_WORDS = blockedWordsRule();

/**
 * The length numbers for a length: the band (both ends checked in code), the line count, per beat. 2026-11-08 run:
 * topic 2 came back 264 words for a 286-300 band and needed a paid fix, so the minimum is as firm as the maximum and
 * the writer must count.
 */
export function lengthNumbers(lengthSec) {
  const total = targetWords(lengthSec), lo = Math.round(total * BAND.written[0]), hi = Math.round(total * BAND.written[1]);
  const beats = beatBudgets(lengthSec), lines = beats.reduce((a, b) => a + b.lines, 0);
  return { total, lo, hi, aim: aimWords(lengthSec), lines, beats, parts: beats };
}

/**
 * The plan's LENGTH block: exactly how many line intents per beat AND each beat's word budget (LENGTH-V2: the plan's
 * intents are sized so the writer's lines can keep to it).
 */
export function planLengthBlock(lengthSec) {
  const n = lengthNumbers(lengthSec);
  return [
    `LENGTH: ${lengthSec} seconds = ${n.lo} to ${n.hi} spoken words, aim ${n.aim} = ${n.lines} lines of about ${BEAT_WORDS_PER_LINE} words. The writer writes ONE line per line intent, so your line intents set the length: each intent is ONE short beat of action or one joke, never two.`,
    `GIVE EXACTLY THIS MANY LINE INTENTS PER BEAT (${n.lines} in total):\n${n.beats.map((b) => `- ${b.id}: ${b.lines}`).join("\n")}`,
    `WORD BUDGET PER BEAT (the writer keeps to it; plan no more content than fits):\n${n.beats.map((b) => `- ${b.id}: about ${b.words} words`).join("\n")}`,
    `BEFORE YOU ANSWER: count the line intents of every beat. Fewer than ${n.lines} makes a script that is too short, and a short script is thrown away like a long one.`,
  ].join("\n");
}

/**
 * The line writer's LENGTH block: the aim and the band at BOTH ends, the per-beat lines and words, the per-line limit,
 * and counting AS IT WRITES (each line's "words" field; LENGTH-V2).
 */
export function linesLengthBlock(lengthSec) {
  const n = lengthNumbers(lengthSec);
  return [
    `LENGTH: ${lengthSec} seconds. AIM FOR ${n.aim} words in ${n.lines} lines (one per planned line intent). Checked in code: under ${n.lo} is too short, over ${n.hi} is too long, both are thrown away.`,
    // stored drafts of 2026-11-10: the line count was kept, the line SIZE was not (up to 10.6 words a line, 22 lines over 10)
    `LINE SIZE: about ${BEAT_WORDS_PER_LINE} words a line, NEVER more than ${LINE_MAX_WORDS} (the first line excepted). One short sentence per line; a joke that needs more is split over two of its beat's lines or cut, never a longer line, never an extra line.`,
    `PER BEAT (lines, word budget):\n${n.beats.map((b) => `- ${b.id}: ${b.lines} line${b.lines > 1 ? "s" : ""}, ${b.words} words`).join("\n")}`,
    `COUNT AS YOU WRITE: give every line its "words" (the number of words in its text, counted one by one). When a beat is done, add up its lines: over its budget, shorten its lines before you write the next beat. Running total after the adults beat: about ${n.beats.slice(0, BEAT_IDS.indexOf("adults") + 1).reduce((a, b) => a + b.words, 0)} words; much more means the save and callback must be shorter.`,
    `BEFORE YOU ANSWER: add up the "words" of all lines. Over ${n.hi}: shorten lines (never the first line, the planted line or the last line). Under ${n.lo}: add a real beat moment, never filler. Answer only when the total is ${n.lo} to ${n.hi}.`,
  ].join("\n");
}

/** A script short by at most this share of the band's minimum is only flagged (no paid fix); shorter is the one fix. */
export const SHORT_GRACE = 0.1;

export const HYBRID_PLAN_SYSTEM = `You are the story planner for Blocky Worlds: 1-2 minute vertical videos narrated by one kid, in an original blocky toy-like world. Another writer will turn your plan into the spoken lines, so your plan carries every story decision. You do NOT write the final narration.

${BEAT_SHEET_TEXT}

${RULE_VISUAL_TEXT}

WHAT EACH PIECE OF THE PLAN MUST DO
- opener: line 1, the user's topic as the world's rule, plain fact, starting with exactly "In this town, " (8 to 14 words).
- hook: line 2, the RESULT-FIRST HOOK: the craziest consequence the narrator is in RIGHT NOW, first person, 5 to 12 words, an exclamation (the example's shape: "And I just sneezed in the cockpit of a flying plane!"). It must be filmable with what the world can show, and it must be a result of the rule that the story then explains. price: what the rule costs, concrete and seen by everyone (said in the origin).
- rule_visual: parameter (the one visible thing: "how high your house floats", "the colour of the cloud over your head"), description (how it looks in the world, filmable), neighbours (each named neighbour and the value they show), hero (the hero's value: the worst of all), opening_shot (what the first shot shows so a viewer gets the rule with the sound off).
- neighbours: three NAMED neighbours (new names, never from the references), each living the rule with one quick joke, and what the rule visual shows for them. Three clearly different values. Each neighbour lives in its OWN place ("place": a kitchen, the school, the bus stop; three different places).
- pivot: the "But..." line, starting with "But", that puts the hero in the worst case of the rule WITH A NUMBER ("But I had ten minutes and four hundred stairs."). It lands about 15 seconds in.
- hero: the narrator's name, who they are, how they are the WORST at the rule, and their FLAW (the very thing that makes them worst, which later saves everyone).
- ally: a friend, grandparent or sibling who says ONE line (quoted, 4 to 12 words) that sounds like a joke or odd advice. It must be the key to the save. Plan it so the viewer laughs at it first and remembers it at the save.
- trigger: what goes wrong, visible to everyone. THE THREAT COMES FROM THE RULE'S OWN WORLD: it grows out of the rule, its rule visual or something the viewer already saw (the machine that runs the rule, a neighbour's habit, the meter, the creature, the festival), never from nowhere. A giant flower that simply blooms on a hill in a sneezing contest town is from nowhere; the Sneeze Meter overloading after one sneeze too many is from the rule's world. trigger_root: the earlier detail it grows from, and where the viewer saw it.
- adults: two or three grown-ups (neighbours from the tour are best) each try their fix and FAIL in a funny, VISIBLE way (a camera can show it), each worse than the last. The trouble DOUBLES every 8 to 12 seconds (one, ten, a hundred): plan the numbers, and a sound word (Boom! Crash! Poof!) on each hit.
- save: how the hero's flaw, together with the ally's line, saves everyone. It starts with the line "Then I noticed something." No outside help, no new magic, no new power: only the flaw, the line and the world's own rule.
- callback: the last line, a 2 to 6 word BUTTON, a callback joke to something from the first half (a neighbour's joke, the ally's line, the rule) that reopens the loop, and what it calls back.
- beats: one entry per beat of the beat sheet, in order, each with a short intent, what the camera shows (filmable in a blocky world; the origin and neighbour beats show the rule visual), and the LINE INTENTS: one short note per spoken line (what that line does, not its final wording). Keep the line counts given in LENGTH.

THE LENGTH: the request gives the exact number of line intents per beat. Keep to it: the writer writes one line per intent, and a plan with too few lines makes a script that is thrown away as too short.

RULES: the user's topic is the core of every beat, never replaced by an invented gimmick. Original names; never a real game, platform, brand, film, book or person; PG fear only (danger suggested, no gore, no weapons). The names, the ally's line and every joke you plan must pass the word list below.

${TRAP_WORDS}

Return only the JSON object.`;

/**
 * The board-only launch mode (boardFit.js): the same prompts with the kit as HARD rules. The planner gets it right after the
 * rule visual (the rule visual is what the storyboard must film); the line writer just before its answer. The text is the
 * same every call for the same kit, so the cached prefix stays cached. Off: the constants above, byte for byte.
 */
export function hybridPlanSystem({ board = false } = {}) {
  if (!board) return HYBRID_PLAN_SYSTEM;
  return HYBRID_PLAN_SYSTEM.replace(`${RULE_VISUAL_TEXT}\n`, `${RULE_VISUAL_TEXT}\nThe rule visual must be filmable with the kit below: its parameter shown with the kit's places, props and actions.\n\n${kitBlock(BOARD_KIT, "plan")}\n\nWORLD AND MOVED: "world" lists the places, the creature look (one of ${BOARD_KIT.creatures.map((c) => c.id).join(", ")}, or "none"), the animals and the weather the story uses, all from the kit. "moved" says in one plain sentence what you changed from the user's idea to fit the kit ("" when nothing moved).\n`);
}
export function hybridLinesSystem({ board = false } = {}) {
  if (!board) return HYBRID_LINES_SYSTEM;
  return HYBRID_LINES_SYSTEM.replace(/\n\nReturn only the JSON object: /, `\n\n${kitBlock(BOARD_KIT, "lines")}\n\nReturn only the JSON object: `);
}

export function hybridPlanSchema({ board = false } = {}) {
  const s = { type: "string" };
  const obj = (props, req = Object.keys(props)) => ({ type: "object", additionalProperties: false, required: req, properties: props });
  const world = board ? {
    world: obj({ places: { type: "array", items: { type: "string", enum: BOARD_KIT.places.map((p) => p.id) } }, creature_look: { type: "string", enum: [...BOARD_KIT.creatures.map((c) => c.id), "none"] }, animals: { type: "array", items: s }, weather: { type: "array", items: s } }),
    moved: s,
  } : {};
  return obj({
    ...world,
    title: s, premise: s, opener: s, hook: s, pivot: s, price: s, teaser: s,
    rule_visual: obj({ parameter: s, description: s, neighbours: { type: "array", items: obj({ name: s, shows: s }) }, hero: s, opening_shot: s }),
    origin: s,
    neighbours: { type: "array", items: obj({ name: s, joke: s, shows: s, place: s }) },
    hero: obj({ name: s, who: s, worst: s, flaw: s }),
    ally: obj({ name: s, who: s, line: s, why: s }),
    trigger: s, trigger_root: s,
    adults: { type: "array", items: obj({ who: s, attempt: s, fail: s }) },
    save: obj({ how: s, uses_line: s }),
    callback: obj({ line: s, calls_back: s }),
    formula: { type: "string", enum: Object.keys(FORMULAS) },
    twistType: { type: "string", enum: Object.keys(TWISTS) },
    mood: { type: "string", enum: Object.keys(MOODS) },
    setting: s,
    beats: { type: "array", items: obj({ beat: { type: "string", enum: [...BEAT_IDS] }, intent: s, shows: s, lines: { type: "array", items: s } }) },
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
  // the board-only launch mode's planted-object swap (boardFit.js swapIdea): the kit thing that keeps the object's job
  const swap = idea.swap ? `\n- ${swapHint(idea.swap)}` : "";
  return `THE IDEA THE USER PICKED (build the plan on it: keep its world and narrator unless one breaks a rule; fit it to the beat sheet; you plan everything it leaves open):\n${rows.map(([k, v]) => `- ${k}: ${String(v).slice(0, 300)}`).join("\n")}${swap}`;
}

/** Whether a plan is a beat-sheet plan (2026-11-10) or an older 7-part one (a saved draft's). */
export const isBeatPlan = (plan) => Boolean(plan && (plan.ally || plan.rule_visual || (plan.beats ?? []).some((b) => b?.beat)));

/**
 * The plan as an idea card (the shape every check, the judge, the director and the world bible read), with the topic.
 * The beat sheet's pieces ride along: ruleVisual, plantedLine, ally, flaw, neighbourNames, adults.
 */
export function planCard(plan, topic) {
  const p = plan ?? {};
  if (!isBeatPlan(p)) return legacyPlanCard(p, topic);
  const card = normalizeIdea({
    opener: p.opener, title: p.title, premise: p.premise, price: p.price,
    examples: (p.neighbours ?? []).map((n) => `${n?.name ?? ""}: ${n?.joke ?? ""}`.trim()),
    narrator: [p.hero?.name, p.hero?.who, p.hero?.worst].filter(Boolean).join(", "),
    // the beat sheet plants a LINE, not an object: no planted object on the card
    prop: "", twist: p.save?.how, teaser: p.teaser, closer: p.callback?.line,
    formula: p.formula, twistType: p.twistType, mood: p.mood, setting: p.setting,
  });
  return {
    ...card,
    twist_clue: String(p.ally?.line ?? "").trim(),
    topic: String(topic ?? "").slice(0, 240),
    ruleVisual: ruleVisualOf(p),
    plantedLine: String(p.ally?.line ?? "").trim(),
    ally: [p.ally?.name, p.ally?.who].filter(Boolean).join(", "),
    flaw: String(p.hero?.flaw ?? "").trim(),
    neighbourNames: (p.neighbours ?? []).map((n) => String(n?.name ?? "").trim()).filter(Boolean),
    adults: (p.adults ?? []).map((a) => String(a?.who ?? "").trim()).filter(Boolean),
    // launch mode: the kit world the plan chose and what it moved from the user's idea (shown to the user)
    ...(p.world ? { world: p.world, moved: String(p.moved ?? "").trim() } : {}),
  };
}
function legacyPlanCard(p, topic) {
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
  return beatPlanNotes(plan);
}

/** The plan as text for the line writer. */
export function planText(plan) {
  const p = plan ?? {};
  if (!isBeatPlan(p)) return legacyPlanText(p);
  const rv = p.rule_visual ?? {};
  return [
    `TITLE: ${p.title}`,
    `PREMISE: ${p.premise}`,
    `LINE 1 (the rule; tighten if needed, keep "In this town, "): ${p.opener}`,
    ...(p.hook ? [`LINE 2 (the RESULT-FIRST HOOK, inside the first 5 seconds; keep its meaning, 5 to 12 words, an exclamation): ${p.hook}`] : []),
    ...(p.pivot ? [`THE "BUT" PIVOT (starts with "But", has a number, about 15 seconds in): ${p.pivot}`] : []),
    `THE PRICE (in the origin): ${p.price}`,
    `THE RULE VISUAL (the rule is SEEN, not explained: name it in the origin and in each neighbour's joke): ${rv.parameter}. ${rv.description}\n${(rv.neighbours ?? []).map((n) => `- ${n.name}: ${n.shows}`).join("\n")}\n- the hero: ${rv.hero}`,
    `THE ORIGIN: ${p.origin}`,
    `THE THREE NAMED NEIGHBOURS (one quick joke each, each line names its neighbour):\n${(p.neighbours ?? []).map((n, i) => `${i + 1}. ${n.name}: ${n.joke} (shows: ${n.shows})${n.place ? ` (place: ${n.place})` : ""}`).join("\n")}`,
    `THE HERO ("Then there's me."): ${p.hero?.name}, ${p.hero?.who}. The worst at the rule: ${p.hero?.worst}. The flaw: ${p.hero?.flaw}`,
    `THE ALLY'S PLANTED LINE (said by ${p.ally?.name}, ${p.ally?.who}, word for word, in quotes): "${p.ally?.line}". Why it matters later: ${p.ally?.why}`,
    `THE TRIGGER (it grows out of the rule's own world, never from nowhere): ${p.trigger}${p.trigger_root ? ` It grows from: ${p.trigger_root}` : ""}`,
    `THE ADULTS TRY AND FAIL (each a funny, visible failure, worse each time):\n${(p.adults ?? []).map((a, i) => `${i + 1}. ${a.who}: ${a.attempt} -> ${a.fail}`).join("\n")}`,
    `THE SAVE (the hero's flaw + the planted line; say the planted line again here): ${p.save?.how} The line pays off: ${p.save?.uses_line}`,
    `THE CALLBACK (the last line): ${p.callback?.line} (calls back: ${p.callback?.calls_back})`,
    `THE BEATS, LINE BY LINE (one spoken line per intent; write the words, keep the order, tag each line with its beat):\n${(p.beats ?? []).map((b) => `[${b.beat}] ${b.intent} | on screen: ${b.shows}\n${(b.lines ?? []).map((l, i) => `  ${i + 1}. ${l}`).join("\n")}`).join("\n")}`,
  ].join("\n\n");
}
const spotLabel = (plan, where) => {
  const m = /^neighbour([123])$/.exec(where ?? "");
  return m ? `${plan?.neighbours?.[Number(m[1]) - 1]?.name ?? `neighbour ${m[1]}`}'s joke` : where === "me" ? '"Me"' : where === "until" ? '"Until one night"' : where === "price" ? "the price line" : String(where ?? "");
};
/** A saved draft's older 7-part plan as text (a rewrite of a draft written before the beat sheet). */
function legacyPlanText(p) {
  return [
    `TITLE: ${p.title}`, `PREMISE: ${p.premise}`, `LINE 1 (the rule; keep "In this town, "): ${p.opener}`, `THE PRICE: ${p.price}`,
    `THE THREE NAMED NEIGHBOURS:\n${(p.neighbours ?? []).map((n, i) => `${i + 1}. ${n.name}: ${n.joke}`).join("\n")}`,
    `THE NARRATOR: ${p.narrator?.name}, ${p.narrator?.who}. The exception: ${p.narrator?.exception}`,
    `THE PLANTED OBJECT: ${p.prop?.object}. Its job in the climax: ${p.prop?.climax_job}`,
    `THE TWIST: ${p.twist?.sentence}`,
    `ITS CLUES:\n${(p.twist?.clues ?? []).map((c) => `- "${c.clue}" in ${spotLabel(p, c.where)}: ${c.planted_by}`).join("\n")}`,
    `THE CLIMAX: ${p.climax?.how}`, `THE CLOSER: ${p.closer}`,
    `THE OUTLINE (keep the order; tag each line with the nearest beat of the beat sheet):\n${(p.beats ?? []).map((b) => `[${b.part}] ${b.intent}\n${(b.lines ?? []).map((l, i) => `  ${i + 1}. ${l}`).join("\n")}`).join("\n")}`,
  ].join("\n\n");
}

/** The line writer's system prompt (after the examples block): the writer's voice and pace, the beat sheet, the map. */
export const HYBRID_LINES_SYSTEM = SCRIPT_SYSTEM
  .replace(/THE SHAPE \(seven parts, in order\)\n[\s\S]*?\n\nTHE HARD RULE/, `${BEAT_SHEET_TEXT}\nTag every line with its beat.\n\nTHE HARD RULE`)
  .replace(/STORY RULES\n[\s\S]*?\n- Original world/, `STORY RULES
- The rule is SEEN, not explained: name the RULE VISUAL of the plan (the parameter and each neighbour's value) in the origin and in each neighbour's joke, so the picture tells the story.
- The ally's planted line is said word for word, in quotes, in the ally beat, and said again in the save.
- Each adult's attempt fails in a way a camera can show, and it is funny.
- The hero's flaw saves everyone. No outside help, no new magic at the end.
- The last line is the most quotable line in the video and is a callback joke to the first half.
- Original world`)
  .replace('- Line two usually starts "You see,".', "- Line two is the RESULT-FIRST HOOK (see THE STORY FORMULA); the rule is explained right after it, \"You see,\" is fine there.")
  .replace(/\n\nReturn only the JSON object\.$/, `

YOU GET A PLAN from the story planner: every story decision is made (the rule visual, the neighbours, the hero and the flaw, the ally's line, the adults' attempts, the save, the callback, the beats line by line). Your job is the WORDS: write each planned line in the fast, punchy, deadpan kid voice of the reference examples, keep the plan's order, names and planted line, and keep to the length. Make the jokes land; you may sharpen a joke's wording, never its job.

THE LENGTH IS A HARD RULE AT BOTH ENDS: the request gives the minimum and the maximum word count and the line count. Count your words before you answer; a script under the minimum is thrown away exactly like one over the maximum.

${BEAT_MAP_TEXT}

${TRAP_WORDS}

Return only the JSON object: the title, the lines (each with its beat), the post, and the beat map.`);

/** The line writer's schema: the lines carry a beat (the part follows from it), plus the beat map. */
export function hybridLinesSchema() {
  const base = scriptSchema(), s = { type: "string" };
  const lines = { type: "array", items: { type: "object", additionalProperties: false, required: ["beat", "text", "words"], properties: { beat: { type: "string", enum: [...BEAT_IDS] }, text: s, words: { type: "integer" } } } };
  return { ...base, required: [...base.required, "map"], properties: { ...base.properties, lines, map: beatMapSchema() } };
}

/** The writer's raw answer with each line's part set from its beat (normalizeScript keeps the beat). */
export function withParts(raw) {
  return { ...(raw ?? {}), lines: (Array.isArray(raw?.lines) ? raw.lines : []).map((l) => ({ ...l, part: BEAT_PART[l?.beat] ?? l?.part ?? "own" })) };
}

/**
 * The line writer's user message: the user's idea, the plan, the length; a fix (or the user's rewrite) adds the previous
 * lines, what failed and the user's note.
 */
export function hybridLinesPrompt({ plan, topic, lengthSec, previous = null, failed = [], note = "" }) {
  return [
    topicBlock(topic),
    `THE PLAN\n${planText(plan)}`,
    linesLengthBlock(lengthSec),
    ...(previous ? [`THE PREVIOUS VERSION (keep every line that is fine, change only what the failed checks need):\n${previous.lines.map((l) => `[${l.beat ?? l.part}] ${l.text}`).join("\n")}`] : []),
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
/** checkScript's part checks the beat sheet replaces (its seven parts: a beat-sheet script has no "discovery"). */
const PART_SHAPE = /^(?:Missing parts:|The parts are out of order)/;

/** Whether a draft follows the beat sheet: its lines carry beats, its map has the ally's line, or its card the planted line. */
export const beatDraft = (script, map, card) => Boolean((script?.lines ?? []).some((l) => l.beat) || map?.ally_line || card?.plantedLine !== undefined);

/**
 * Every free check of a hybrid draft, split: hard (blocks; the one fix call is only for these) and advisory (notes shown
 * with the script). skeleton: the writer's beat map. Returns { hard, advisory, copy, words, seconds }.
 */
export function hybridChecks({ script, skeleton = {}, card, examples = [], lengthSec = 90, board = false }) {
  const base = checkScript(script, lengthSec, "written");
  const copy = copyProblems({ script, twist: card?.twist || "", topic: card?.topic ?? "", examples });
  const lost = card?.topic ? premiseLost(card.topic, script) : null;
  // the free pad check: short by at most SHORT_GRACE of the minimum is only flagged (no paid fix, the video runs a few
  // seconds shorter); shorter than that stays hard (the one fix)
  const { lo, hi } = lengthNumbers(lengthSec);
  const slightlyShort = (p) => /^Too short:/.test(p) && base.words >= Math.ceil(lo * (1 - SHORT_GRACE));
  const flagged = base.problems.filter(slightlyShort).map(() => `A bit short: ${base.words} words, the band is ${lo} to ${hi} (the video runs about ${base.seconds} s).`);
  // the board-only launch mode: what the board kit can't film blocks (a must-have miss; boardFit.js on kitCheck.js); a
  // one-off mention is a note
  const kit = board ? boardFitProblems(script, card) : { problems: [], warnings: [] };
  // the button (formula.js) is HARD for a beat-sheet draft: the last line is 2 to 6 words and calls back the rule or the hook
  const button = beatDraft(script, skeleton, card) ? buttonProblems(script) : [];
  const hard = [...base.problems.filter((p) => HARD_SCRIPT.test(p) && !slightlyShort(p)), ...copyReasons(copy), ...(lost ? [lost] : []), ...kit.problems, ...button];
  const advisory = [
    ...kit.warnings,
    ...flagged,
    ...base.problems.filter((p) => !HARD_SCRIPT.test(p) && !PART_SHAPE.test(p)),
    ...(card?.topic && !lost ? topicProblems(card.topic, script) : []),
    // a beat-sheet draft gets the beat-sheet notes; a draft written before it (2026-11-10) keeps the old skeleton notes
    ...(beatDraft(script, skeleton, card) ? beatSheetProblems(script, skeleton ?? {}, card, lengthSec) : [...(card ? propProblems(card, script) : []), ...(card && callbackProblem(card, script) ? [callbackProblem(card, script)] : []), ...skeletonProblems(script, skeleton ?? {}, card)]),
    ...base.warnings,
    // the story formula (formula.js): the hook, the places, the "But" pivot, the escalation, "Then I noticed", the button
    ...formulaProblems(script, lengthSec),
  ];
  return { hard, advisory: [...new Set(advisory)].filter((x) => !hard.includes(x)), copy, words: base.words, seconds: base.seconds };
}

export { BEATS, BEAT_IDS, BEAT_PART };
