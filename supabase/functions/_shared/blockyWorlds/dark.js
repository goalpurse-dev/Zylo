// Blocky Worlds: the DARK TWIST story style (owner, 2026-11-14). Style B of the two story styles (A is the funny chaos of formula.js).
// Studied from a viral reference: ONLY its structure and what is shown per line, never its rule, props, characters or twist
// (bans.js keeps those out). Pure: prompts, schemas and the free checks; llm.js writeStory makes the calls.
//
//   line 1  a SECRET + DANGER ("In this town, I'm the only ...")
//   the world through 3-4 short, visual, SLIGHTLY WRONG details
//   "You see, in this town, [the one simple rule]" (inside the first 2 sentences; the phrase may come after the secret)
//   the hero's own 1-2 RULES (they pay off later)
//   ONE character to LOVE, built from small, specific KINDNESSES that secretly become CLUES
//   a TICKING CLOCK; a mid-story EMOTIONAL GUT PUNCH
//   FALSE HOPE -> the hero trusts or reveals something -> a HOLY TWIST that changes the meaning of earlier moments
//   the LAST LINE is a chilling callback in DIALOGUE and the final image shows the consequence
// Length: up to 2:45 (the funny style runs 60-90 s). Max 3 named characters + "me"; every line showable; fresh names.
import { SOUND_ALLOWED } from "./soundLibrary.js";
import { setupsSchemaProps, SETUPS_TEXT } from "./plantPayoff.js";
import { BANNED_TEXT, bannedProblems } from "./bans.js";
import { namedCharacters, SOFT_ENDING } from "./formula.js";
import { wordCount, BAND } from "./script.js";
import { targetWords } from "./config.js";

export const DARK_PREFIX = "Dark twist:";
/** The beats of the dark style, in order, and the engine part each belongs to (the renderer and director read parts). */
export const DARK_BEATS = Object.freeze(["secret", "rule", "details", "rules", "love", "clock", "gutpunch", "hope", "twist", "ending"]);
export const DARK_PART = Object.freeze({ secret: "rule", rule: "rule", details: "tour", rules: "me", love: "me", clock: "until", gutpunch: "until", hope: "discovery", twist: "climax", ending: "closer" });

export const DARK_TEXT = `THE DARK TWIST STYLE (owner, 2026-11-14: a quiet, creepy, emotional story that ends on a holy twist; the structure of the viral dark stories, never their rule, props, characters or twist):
- ${BANNED_TEXT}
- LINE 1 IS A SECRET + A DANGER, first person, in the narrator's mouth ("In this town, I'm the only one who ..."). Within the first 2 sentences the story also says "You see, in this town (or world), [the ONE simple rule a kid gets in 2 seconds]." The rule phrase is REQUIRED but need not be the first words.
- THE WORLD in 3 or 4 SHORT, VISUAL, "slightly wrong" details (a thing that is almost right but off: a lawn mowed all day with no grass, a loaf nobody ever bit). Each is one line a camera can show.
- THE HERO'S OWN 1 OR 2 RULES (what they do to survive, "I never ..."). They pay off later.
- ONE CHARACTER TO LOVE. Build them with 3 small, specific KINDNESSES (a thing they do for the hero, with a concrete object or action each) that look warm and SECRETLY BECOME CLUES when the twist lands.
- A TICKING CLOCK: a date, a number of days, a night that is coming ("I turn 13 in the spring", "the bell rings in three nights"), said early and counted down.
- A MID-STORY EMOTIONAL GUT PUNCH: something the hero loves is lost or betrayed, and the hero does not cry out loud.
- FALSE HOPE: it seems to work, the hero is not alone, the hero TRUSTS or REVEALS something. Then the HOLY TWIST: it changes the MEANING of earlier moments (the kindnesses were clues, the rule was a trap, the one they loved knew all along).
- THE LAST LINE is a CHILLING CALLBACK IN DIALOGUE (a line someone says, quoted, that echoes an earlier line with a new, terrible meaning), and the FINAL IMAGE shows the consequence (what we SEE in the last lines).
- At most 3 NAMED characters plus "me". EVERY line is something we can SEE or HEAR. Short sentences, 3 to 12 words. First person, past tense. Never sentimental, abstract or a moral. Sound words only from: ${SOUND_ALLOWED.slice(0, 20).join(", ")}, ...
${SETUPS_TEXT}`;

export function darkPlanSchema() {
  const s = { type: "string" };
  const obj = (props) => ({ type: "object", additionalProperties: false, required: Object.keys(props), properties: props });
  return obj({
    title: s, premise: s, secret_line: s, rule: s,
    details: { type: "array", items: s },
    hero_rules: { type: "array", items: s },
    loved: obj({ name: s, who: s, kindnesses: { type: "array", items: s }, secret_truth: s }),
    clock: s, gut_punch: s, false_hope: s, twist: s, last_line: s, final_image: s,
    names: { type: "array", items: s },
    setups: { type: "array", items: obj({ what: s, plant_idea: s, payoff_idea: s }) },
    beats: { type: "array", items: obj({ beat: { type: "string", enum: [...DARK_BEATS] }, intent: s, lines: { type: "array", items: s } }) },
  });
}

export const DARK_PLAN_SYSTEM = `You are the story planner for Blocky Worlds' DARK TWIST videos: vertical videos narrated by one kid in an original blocky toy-like town. Another writer will turn your plan into the spoken lines, so your plan carries every story decision. You do NOT write the final narration.

${DARK_TEXT}

WHAT YOUR PLAN MUST CONTAIN
- secret_line: line 1 (a secret + a danger). rule: the "You see, in this town, ..." sentence. details: 3 or 4 slightly wrong visual details. hero_rules: the hero's own 1 or 2 rules. loved: the ONE character to love (name, who, 3 small specific kindnesses, and the secret_truth those kindnesses really were). clock: the ticking clock. gut_punch: the mid-story gut punch. false_hope: how it seems to work and what the hero trusts or reveals. twist: the HOLY TWIST that changes the meaning of earlier moments. last_line: the chilling callback in dialogue. final_image: what we SEE at the end.
- setups: at least 4 setups (the kindnesses, the hero's rules, the details, the clock), each with what, the idea of its plant and the idea of its payoff; at least 3 pay off in the ending.
- names: the fresh names the request gives you (3 characters + the narrator).
- beats: in order, one entry per beat (${DARK_BEATS.join(", ")}) with a short intent and the LINE INTENTS (one note per spoken line, what it SHOWS).
RULES: the topic is the core of the world; if it is a place or a setting turn it into ONE simple rule. Original names; never a real game, platform, brand, film, book or person. PG fear only: danger suggested, no gore, no weapons. Return only the JSON object.`;

export function darkPlanPrompt({ topic, lengthSec, note = "" }) {
  const n = targetWords(lengthSec);
  return [
    `THE USER'S TOPIC: "${String(topic).slice(0, 240)}"`,
    `LENGTH: about ${lengthSec} seconds = about ${n} spoken words = about ${Math.round(n / 8)} lines of 5 to 12 words. Give that many line intents in total across the beats (the secret and the rule 2 to 3, the details 4 to 6, the hero's rules 2, the love beat 6 to 8, the clock 2, the gut punch 5 to 7, the false hope 8 to 10, the twist 8 to 10, the ending 4 to 6), the rest spread to fit.`,
    note,
  ].filter(Boolean).join("\n\n");
}

export const DARK_LINES_SYSTEM = `You write the narration of a Blocky Worlds DARK TWIST video from a story plan: ONE kid narrates in first person, past tense, in a quiet, deadpan voice. The narration is read by a text-to-speech voice at about 4.3 words a second. Write each planned line as one short spoken sentence or fragment (3 to 12 words, most 5 to 9), keep the plan's order, names, kindnesses, rules, clock, twist and last line. Contractions. No semicolons, colons, dashes, ellipses or brackets. Dialogue is short and inline in quotes.

${DARK_TEXT}

THE LENGTH IS A HARD RULE: the request gives the minimum and the maximum word count. Count your words before you answer.

${BANNED_TEXT}

SPEAKERS (the captions color each voice): when a line holds a character's spoken words, set the line's "speaker" to that character's NAME (exactly as written in the story); the words inside the double quotes get that character's color and the rest stays the narrator's white. A line the narrator says alone has speaker "". A line that is only one character's words (no narrator part) is colored in full.

Return only the JSON object: the title, the lines (each tagged with its beat and its speaker), the post (title up to 70 characters, a description of one or two sentences, 3 to 6 lowercase hashtags), and the map with the setups (a SHORT EXACT QUOTE of each plant line and of its payoff line).`;

export function darkLinesSchema() {
  const s = { type: "string" };
  const obj = (props) => ({ type: "object", additionalProperties: false, required: Object.keys(props), properties: props });
  return obj({
    title: s,
    lines: { type: "array", items: obj({ beat: { type: "string", enum: [...DARK_BEATS] }, text: s, speaker: s }) },
    post: obj({ title: s, description: s, hashtags: { type: "array", items: s } }),
    map: obj({ ...setupsSchemaProps(), loved_name: s, twist_line: s, last_line: s }),
  });
}

export function darkPlanText(plan) {
  const p = plan ?? {};
  return [
    `TITLE: ${p.title}`, `PREMISE: ${p.premise}`,
    `LINE 1 (the secret + the danger): ${p.secret_line}`,
    `THE RULE LINE ("You see, in this town, ..."): ${p.rule}`,
    `THE WORLD, slightly wrong (one line each):\n${(p.details ?? []).map((d, i) => `${i + 1}. ${d}`).join("\n")}`,
    `THE HERO'S OWN RULES: ${(p.hero_rules ?? []).join(" | ")}`,
    `THE ONE TO LOVE: ${p.loved?.name}, ${p.loved?.who}. Small kindnesses (each a concrete thing, each a secret clue):\n${(p.loved?.kindnesses ?? []).map((k, i) => `${i + 1}. ${k}`).join("\n")}\nWhat they really were: ${p.loved?.secret_truth}`,
    `THE CLOCK: ${p.clock}`, `THE GUT PUNCH: ${p.gut_punch}`, `FALSE HOPE: ${p.false_hope}`,
    `THE HOLY TWIST: ${p.twist}`, `THE LAST LINE (dialogue): ${p.last_line}`, `THE FINAL IMAGE: ${p.final_image}`,
    `SETUPS AND PAYOFFS:\n${(p.setups ?? []).map((s, i) => `${i + 1}. ${s.what}: plant ${s.plant_idea} -> payoff ${s.payoff_idea}`).join("\n")}`,
    `NAMES: ${(p.names ?? []).join(", ")}`,
    `THE BEATS, LINE BY LINE (one spoken line per intent; tag each line with its beat):\n${(p.beats ?? []).map((b) => `[${b.beat}] ${b.intent}\n${(b.lines ?? []).map((l, i) => `  ${i + 1}. ${l}`).join("\n")}`).join("\n")}`,
  ].join("\n\n");
}

export function darkLinesPrompt({ plan, topic, lengthSec, note = "" }) {
  const t = targetWords(lengthSec), lo = Math.round(t * BAND.written[0]), hi = Math.round(t);
  return [
    `THE USER'S TOPIC: "${String(topic).slice(0, 240)}"`,
    `THE PLAN\n${darkPlanText(plan)}`,
    `LENGTH: ${lengthSec} seconds. ${lo} to ${hi} words in total (under ${lo} or over ${hi} is thrown away); about ${Math.round(t / 8)} lines of 5 to 12 words.`,
    note,
  ].filter(Boolean).join("\n\n");
}

/** The three versions' angles (same plan, a different push each). */
export const DARK_VERSION_NOTES = Object.freeze([
  "",
  "VERSION ANGLE: make the kindnesses smaller and more specific (a concrete object or action each) so that the twist re-colours every one of them, and make the gut punch quieter and more painful.",
  "VERSION ANGLE: make the false hope warmer and the holy twist crueler, and make the very last line the most chilling callback you can write, with a final image we can SEE.",
]);

/** The engine parts follow from the beats; normalizeScript keeps beat. */
export const darkWithParts = (raw) => ({ ...(raw ?? {}), lines: (Array.isArray(raw?.lines) ? raw.lines : []).map((l) => ({ ...l, part: DARK_PART[l?.beat] ?? "own" })) });

const IN_TOWN = /\bin this (?:town|world)\b/i;
const sentencesOf = (lines) => lines.flatMap((l) => String(l.text ?? "").split(/(?<=[.!?])\s+/).filter(Boolean));
/**
 * The free checks of a dark-twist script: notes starting with DARK_PREFIX (HARD: the rule phrase, the banned pieces, a soft ending,
 * the length band; the rest advisory). Each names its lines like "(line 3)". topic: the customer's text (its own words are exempt).
 */
export function darkProblems(script, lengthSec = 150, { topic = "" } = {}) {
  const lines = script?.lines ?? [];
  const hard = [], advisory = [];
  if (!lines.length) return { hard: ["The script is empty."], advisory };
  const tag = (idx) => `(${idx.length === 1 ? "line" : "lines"} ${idx.slice(0, 6).map((i) => i + 1).join(", ")})`;
  const first2 = sentencesOf(lines).slice(0, 2).join(" ");
  if (!IN_TOWN.test(first2)) hard.push(`${DARK_PREFIX} "in this town" (or "in this world") must be said within the first 2 sentences: line 1 is the secret and the danger ("In this town, I'm the only one who ..."), then "You see, in this town, [the one simple rule]." ${tag([0, 1])}`);
  const total = lines.reduce((a, l) => a + wordCount(l.text), 0);
  const t = targetWords(lengthSec), lo = Math.round(t * BAND.written[0]), hi = Math.round(t * 1.05);
  if (total < lo) hard.push(`Too short: ${total} words, a ${lengthSec} s video needs at least ${lo}.`);
  if (total > hi) hard.push(`Too long: ${total} words, a ${lengthSec} s video fits ${hi} at most.`);
  const maxWords = Math.max(...lines.map((l) => wordCount(l.text)));
  if (maxWords > 18) advisory.push(`${DARK_PREFIX} a line has ${maxWords} words; keep every line short (3 to 12 words) so it can be shown. ${tag([lines.findIndex((l) => wordCount(l.text) === maxWords)])}`);
  for (const p of bannedProblems(script, topic)) hard.push(p.replace(/^Formula:/, DARK_PREFIX));
  const names = namedCharacters(lines.map((l) => l.text).join("\n"));
  if (names.size > 4) advisory.push(`${DARK_PREFIX} too many named characters (${names.size}: ${[...names].slice(0, 6).join(", ")}); at most 3 plus "me".`);
  const n = lines.length, tail = lines.slice(-3).map((l, k) => ({ i: n - 3 + k, t: l.text }));
  const soft = tail.filter((x) => SOFT_ENDING.test(x.t));
  if (soft.length) hard.push(`${DARK_PREFIX} the ending is soft or abstract ("${soft[0].t.match(SOFT_ENDING)[0]}"): end on a chilling callback in dialogue and a final image we can SEE. ${tag(soft.map((x) => x.i))}`);
  if (!/["“”]|\bsaid\b|\bwhispered\b/i.test(lines[n - 1].text)) advisory.push(`${DARK_PREFIX} the last line should be a chilling callback in DIALOGUE (someone says it, in quotes). ${tag([n - 1])}`);
  const hasBeats = lines.some((l) => l.beat);
  if (hasBeats) {
    const missing = DARK_BEATS.filter((b) => !lines.some((l) => l.beat === b));
    if (missing.length) advisory.push(`${DARK_PREFIX} missing beats: ${missing.join(", ")}.`);
  }
  return { hard, advisory };
}
