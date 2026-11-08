// Blocky Worlds: scripts on BROAD topics with reference transcripts as examples (owner, 2026-11-08). Pure: prompts,
// schemas, the example picks. llm.js makes the calls (broadTopic); skeleton.js and antiCopy.js are the free checks.
//
// The owner: "Use the references as examples: put 2-3 of the best reference transcripts into the writer's instructions
// (ones that match each topic's recipe). It's fine to start from the same premise as a reference video. What must be
// DIFFERENT: the twist, the story events, the character names and the actual lines. No 1:1 copies."
// 2026-11-04 note (references.js): quoting references made the writer copy them, so every draft goes through the
// anti-copy check, and the prompt says plainly what may and may not be taken.
import { FORMULAS, MOODS, SETTINGS, TWISTS } from "./formulas.js";
import { PART_IDS, PARTS, partBudgets, scriptSchema, SCRIPT_SYSTEM } from "./script.js";
import { USES } from "./protocol.js";
import { SKELETON_RULES, skeletonSchema } from "./skeleton.js";

/**
 * The reference videos each recipe learns from (ids in reference/blocky-worlds/analysis/<id>/transcript.json), best
 * first, from the pacing/story study (scratchpad recipes/picks.json, 2026-11-07). 2-3 per recipe.
 */
export const RECIPE_REFERENCES = Object.freeze({
  rigged_system: Object.freeze(["7703332734629924128", "7703429226372009249", "7701969278022552850"]),
  curfew_monster: Object.freeze(["7699870521722211598", "7698966230471953677", "7703557612477910305"]),
  creature_town_attack: Object.freeze(["7701115575648455950", "7699174768242642190"]),
  lost_pet_in_town: Object.freeze(["7701548589666798880", "7701004539062734088", "7702135684059909384"]),
  absurd_rule_comedy: Object.freeze(["7704068720796208406", "7703675002629000481", "7703625168987475233"]),
  everyone_except_me: Object.freeze(["7700821616963374350", "7699660040180960526", "7699012496337685774"]),
  giant_reveal: Object.freeze(["7698966230471953677", "7701548589666798880", "7699870521722211598"]),
});

/** A transcript.json as plain narration text. */
export const transcriptText = (t) => (t?.segments ?? []).map((s) => String(s.text ?? "").trim()).filter(Boolean).join(" ");

/** The examples block (first in the system prompt, so the plan and script calls share its cache). examples: [{id, text}] */
export function examplesBlock(examples) {
  return [
    `REFERENCE EXAMPLES: ${examples.length} viral videos of this kind (about 300k likes each), as narrated. Learn their SHAPE: the rule and its price up front, rapid named-neighbour jokes, the kid as the exception, the planted object, the three-step escalation, the reveal about the rule, the win with the world's own logic, the closer that flips line 1, and their pace and voice.`,
    "WHAT YOU MAY TAKE: the premise (the same kind of world rule is fine) and the shape.",
    "WHAT MUST BE YOUR OWN (checked in code; a copy is thrown away): the twist, the story events, every character name and every line. Never reuse a phrase of five words or more from them, never a name from them, never their twist or their ending.",
    ...examples.map((e, i) => `--- EXAMPLE ${i + 1} (reference ${e.id}) ---\n${e.text}`),
    "--- END OF EXAMPLES ---",
  ].join("\n\n");
}

/** Three angles: each draft of a topic takes a different road to its twist (the three drafts differ by design). */
export const ANGLES = Object.freeze([
  "ANGLE A: the twist comes from the RULE ITSELF: the rule is the weapon, or it means something else than everyone thought.",
  "ANGLE B: the twist comes from the NARRATOR'S EXCEPTION: the thing everyone mocked about the narrator is the only thing that works.",
  "ANGLE C: the twist comes from the PLANTED OBJECT and a hidden truth about who made the rule or why.",
]);

const FIELDS = ["opener", "title", "premise", "price", "examples", "narrator", "prop", "twist", "teaser", "closer", "formula", "twistType", "mood", "setting"];

export const PLAN_SYSTEM = `You plan a Blocky Worlds video: a 1-2 minute vertical video narrated by one kid, in an original blocky toy-like world. You get the user's topic, the recipe it follows, and an angle for the twist. Return the IDEA CARD and the 7-part BEAT SHEET.

THE PARTS (in order): ${PARTS.map((p) => `${p.id} (${p.what})`).join("; ")}.

${SKELETON_RULES.split("\nTHE SKELETON MAP")[0]}

THE CARD
- opener: the first line, starting with exactly "In this town, " (never "In this world"), stating the user's topic as the rule, 8 to 22 words.
- price: what breaking the rule costs, concrete and seen by everyone (it goes in line 1 or 2).
- examples: exactly three neighbour jokes, each with a NAME (new names, never from the reference examples).
- narrator: the kid and how they're the exception. prop: the ordinary planted object (1-8 words).
- twist: the crazy twist in one sentence, paid off by a clue planted earlier. twist_clue: that clue (a word or short phrase).
- closer: the last line, flipping line 1. title: 2-6 words. teaser: 6-14 words. premise: one sentence.
- formula (${Object.keys(FORMULAS).join(", ")}), twistType (${Object.keys(TWISTS).join(", ")}), mood (${Object.keys(MOODS).join(", ")}), setting (one of: ${SETTINGS.join("; ")}).

THE BEATS: one per part, in order. rule uses "rule"; tour uses "price", "example1", "example2", "example3"; me uses "exception" and "prop_setup"; until uses "escalation1", "escalation2", "escalation3"; discovery uses "truth"; climax uses "prop_payoff" and "twist"; closer uses "closer". shows: one sentence of what is on screen, filmable in a blocky world. words: the part's spoken words (totals given).

RULES: original names; never a real game, platform, brand, film, book or person; PG fear only (danger suggested, no gore, no weapons). The user's topic is the core of every part.
Return only the JSON object.`;

export function planSchema() {
  const s = { type: "string" };
  const card = Object.fromEntries(FIELDS.map((k) => [k, k === "examples" ? { type: "array", items: s } : s]));
  card.twist_clue = s;
  return {
    type: "object", additionalProperties: false, required: ["card", "beats"],
    properties: {
      card: { type: "object", additionalProperties: false, required: [...FIELDS, "twist_clue"], properties: card },
      beats: { type: "array", items: { type: "object", additionalProperties: false, required: ["part", "summary", "shows", "words", "uses"], properties: { part: { type: "string", enum: [...PART_IDS] }, summary: s, shows: s, words: { type: "integer" }, uses: { type: "array", items: { type: "string", enum: [...USES] } } } } },
    },
  };
}

/** The plan call's user message. recipe: { id, name, what }. */
export function planPrompt({ topic, recipe, angle, lengthSec }) {
  return [
    `THE USER'S TOPIC: "${String(topic).slice(0, 240)}"`,
    recipe?.id ? `THE RECIPE: ${recipe.id} (${recipe.what ?? recipe.name ?? ""}).` : "",
    angle,
    `LENGTH: ${lengthSec} s. Words per part: ${partBudgets(lengthSec).map((b) => `${b.id} ~${b.words}`).join(", ")}.`,
  ].filter(Boolean).join("\n\n");
}

/** The script call's system prompt (after the examples block): the writer's rules plus the skeleton and its map. */
export const BROAD_SCRIPT_SYSTEM = `${SCRIPT_SYSTEM.replace(/\n\nReturn only the JSON object\.$/, "")}

${SKELETON_RULES}

Return only the JSON object: the title, the lines, the post, and the skeleton map.`;

export function broadScriptSchema() {
  const base = scriptSchema();
  return { ...base, required: [...base.required, "skeleton"], properties: { ...base.properties, skeleton: skeletonSchema() } };
}
