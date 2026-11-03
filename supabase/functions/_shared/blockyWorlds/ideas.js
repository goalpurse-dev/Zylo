// Blocky Worlds: the idea generator. "Pick an idea" (a batch of cards, each from a different formula/twist pair) and
// "Your topic" (anything the user types, turned into three outrageous world rules). Pure: prompts, schema, checks.
// llm.js makes the calls. The study behind it: reference/blocky-worlds/ANALYSIS.md, sections 4 and 5.
import { FORMULAS, MOODS, SETTINGS, TWISTS, slotsForBatch } from "./formulas.js";
import { hasOpener, fixOpener } from "./opener.js";
import { safetyProblems } from "./safety.js";
import { EXAMPLE_IDEAS } from "./examples.js";
import { REFERENCE_RULE } from "./references.js";

export const IDEAS_PER_BATCH = 6;
export const TOPIC_IDEAS = 3;
/** Free, with a daily limit (UTC day), like Blocky Stories: paid plans / the free plan. */
export const DAILY_IDEA_BATCHES = 20;
export const FREE_IDEA_BATCHES = 3;

const wc = (s) => String(s ?? "").trim().split(/\s+/).filter(Boolean).length;

const STUDY = `WHAT MAKES THESE STORIES GO VIRAL (from 19 videos with ~300k likes each)
- One absurd world rule, stated as plain fact in the very first line. Never "imagine if". It's just how the town works.
- The rule has a PRICE everyone has seen ("...and by morning your chair is gone", "...your house forgets your name").
- Three quick, concrete examples with named neighbours make it funny and lived-in ("Mr. Plunk stood up to sneeze. Now he teaches sitting on a bucket.", "The mailman delivers by catapult from behind the line.").
- The narrator is a kid who is the EXCEPTION or the underdog (the one-cent price tag, the only kid with no helmet, the squeakiest sneeze).
- An object is planted early (a roll of tape, a stale bagel, a fridge magnet) and wins the climax.
- It escalates in three visible steps, then the narrator wins with the world's own logic. No new magic at the end.
- The last line flips the first ("Everyone here stays in their seat. We just take the seat with us.") or, for horror, reopens it with a sting.
- Family stakes under the absurdity: a missing brother, a mom with a secret, a lonely kid.`;

export const IDEAS_SYSTEM = `You invent story ideas for Blocky Worlds: 1-2 minute vertical videos narrated by a kid, set in an original blocky toy-like world, for TikTok and YouTube Shorts.

${STUDY}

EACH IDEA HAS
- opener: THE FIRST LINE OF THE VIDEO. It MUST start with exactly "In this world, " or "In this town, " and state the rule as plain fact. 8 to 20 words. This is the hook: outrageous, instantly clear, visual.
- title: 2 to 6 words, a teaser.
- premise: one sentence, 12 to 30 words: the world, the narrator's place in it, and what goes wrong. No ending.
- price: what breaking the rule costs, 4 to 15 words.
- examples: exactly three short lines (5 to 14 words each), each a funny or creepy example of the rule with a named neighbour or a specific job.
- narrator: who tells it, a kid, and how they're the exception, 6 to 20 words.
- prop: the planted object that wins the climax, 1 to 8 words.
- twist: how it ends, 10 to 35 words. Uses the twist type asked for.
- teaser: one line for the idea card that hints at the twist without telling it, 6 to 14 words.
- closer: the very last line of the video, 5 to 18 words, quotable, calling back the opener.
- formula, twistType, mood: the ids you were asked for.
- setting: one of the settings listed below.

RULES
- Original worlds and names only. You may borrow the SHAPE of a famous premise (a sealed world that lies about the outside, a deal paid by the first greeting), never its title, characters, places, objects or lines, and never name it.
- Never a real game, platform, brand, celebrity or creator. Never the words "Roblox", "Robux", "noob", "obby", "oof".
- For a young audience: PG fear only. Danger is suggested (silhouettes, "gone by morning"). No blood, gore, weapons, romance or anything a kid could copy dangerously.
- Each idea is a different world. No two share a rule, a creature or a setting.
- Kid logic: a ten-year-old must understand the rule from the opener alone.

SETTINGS: ${SETTINGS.join("; ")}.

A STRICT JUDGE SCORES EVERY IDEA. Most ideas fail for the same few reasons; avoid them:
- The price is vague or invisible. Make it concrete and something the town has SEEN happen ("Last time the bread was late, the pigeon announced Mr. Crumb's wig size to the whole square.").
- The planted object appears from nowhere at the end. Plant it early (in the narrator line), make it ordinary, and make it the ONLY way to win.
- The twist adds new magic, a new creature or a new fact at the end. The twist must come from the rule itself or the planted object: guessable in hindsight.
- The narrator has no real reason to be the underdog. Give them a specific, visible exception to the rule.
- The idea is a reskin of the examples' formulas ("every family leaves X for Y", "we all live inside giant Z" with a new noun). Invent a NEW rule; the examples only show the shape.
- The escalation is not filmable. The middle must escalate in three visible steps.

${REFERENCE_RULE}

A STRONG IDEA (the bar; never reuse it):
${JSON.stringify(EXAMPLE_IDEAS[0])}

Return only the JSON object.`;

/** One revision pass for ideas that just missed: each comes with the judge's note. */
export const REVISE_SYSTEM = `${IDEAS_SYSTEM}

REVISION: you get ideas that a strict judge almost accepted, each with the judge's note. Rewrite each idea so the note is fully fixed. Keep the idea's world and rule unless the note says the rule itself is the problem; keep its formula, twistType, mood and setting ids. Return the ideas in the same order.`;
export const revisePrompt = (items) => items.map((it, k) => `IDEA ${k + 1}\nJUDGE'S NOTE: ${it.note}\n${JSON.stringify(it.idea)}`).join("\n\n");

const FIELDS = ["opener", "title", "premise", "price", "examples", "narrator", "prop", "twist", "teaser", "closer", "formula", "twistType", "mood", "setting"];

/** The tool schema (no array size limits: the API refuses maxItems in some structured-output paths). */
export function ideasSchema() {
  const s = { type: "string" };
  const idea = Object.fromEntries(FIELDS.map((k) => [k, k === "examples" ? { type: "array", items: s } : s]));
  return { type: "object", additionalProperties: false, required: ["ideas"], properties: { ideas: { type: "array", items: { type: "object", additionalProperties: false, required: FIELDS, properties: idea } } } };
}

const slotText = (slots) => slots.map((s, i) => `${i + 1}. formula ${s.formula} "${FORMULAS[s.formula].name}": ${FORMULAS[s.formula].rule} (Example opener: "${FORMULAS[s.formula].example}")\n   twist ${s.twist} "${TWISTS[s.twist].name}": ${TWISTS[s.twist].rule}\n   mood ${s.mood}: ${MOODS[s.mood].tone}`).join("\n");

/** The user message for a batch of "Pick an idea" cards. avoid: openers/titles the user has already seen. */
export function batchPrompt({ seed = 0, mood = null, avoid = [] } = {}) {
  const slots = slotsForBatch(seed, IDEAS_PER_BATCH, mood);
  return {
    slots,
    text: `Write ${slots.length} ideas, one for each slot, in this order:\n${slotText(slots)}` +
      (avoid.length ? `\n\nAlready used (never repeat or lightly reword these):\n${avoid.slice(0, 40).map((a) => `- ${a}`).join("\n")}` : ""),
  };
}

/** The user message for "Your topic": three world rules built from the topic, from three different formulas. */
export function topicPrompt({ topic, mood = null, seed = 0, avoid = [] }) {
  const slots = slotsForBatch(seed + 101, TOPIC_IDEAS, mood);
  return {
    slots,
    text: `The user's topic: "${String(topic).slice(0, 120)}"\n\nTurn the topic into ${slots.length} different world rules that a whole town lives by, with a price, then into ideas. The topic must be at the heart of each rule (not a side detail). If the topic names a real game, film, brand or person, keep the idea behind it and drop the name.\nOne idea per slot, in this order:\n${slotText(slots)}` +
      (avoid.length ? `\n\nAlready used (never repeat these):\n${avoid.slice(0, 40).map((a) => `- ${a}`).join("\n")}` : ""),
  };
}

/** The user message for a library batch call: the slots the batch job planned (library.js planSlots), with settings. */
export function slotsPrompt(slots, avoid = []) {
  return `Write ${slots.length} ideas, one for each slot, in this order:\n${slotText(slots)}\n${slots.map((s, i) => `Slot ${i + 1} setting: ${s.setting ?? "any"}`).join("\n")}` +
    (avoid.length ? `\n\nAlready in the library (never repeat or lightly reword these rules):\n${avoid.slice(0, 60).map((a) => `- ${a}`).join("\n")}` : "");
}

/** An idea as the writer returned it, cleaned: the opener fixed when it is a near miss, words trimmed. */
export function normalizeIdea(raw) {
  const idea = Object.fromEntries(FIELDS.map((k) => [k, k === "examples" ? (Array.isArray(raw?.[k]) ? raw[k].map((x) => String(x).trim()).filter(Boolean) : []) : String(raw?.[k] ?? "").trim().replace(/\s+/g, " ")]));
  const fixed = fixOpener(idea.opener);
  if (fixed) idea.opener = fixed;
  return idea;
}

/** The problems that make an idea unusable (empty = fine). slot: the formula/twist/mood it was asked for. */
export function ideaProblems(idea, slot = null) {
  const out = [];
  if (!hasOpener(idea.opener)) out.push(`opener must start with "In this world, " or "In this town, "`);
  if (wc(idea.opener) < 6 || wc(idea.opener) > 24) out.push("opener is not 6-24 words");
  for (const k of ["title", "premise", "price", "narrator", "prop", "twist", "teaser", "closer"]) if (!idea[k]) out.push(`${k} is empty`);
  if (idea.examples.length !== 3) out.push("examples must be exactly three");
  if (!FORMULAS[idea.formula]) out.push(`unknown formula ${idea.formula}`);
  if (!TWISTS[idea.twistType]) out.push(`unknown twist ${idea.twistType}`);
  if (!MOODS[idea.mood]) out.push(`unknown mood ${idea.mood}`);
  if (slot && (idea.formula !== slot.formula || idea.twistType !== slot.twist)) out.push(`asked for ${slot.formula}/${slot.twist}, got ${idea.formula}/${idea.twistType}`);
  out.push(...safetyProblems(FIELDS.map((k) => (k === "examples" ? idea.examples.join(" ") : idea[k])).join(" \n ")));
  return out;
}

/** The usable ideas of a reply, matched to their slots in order; the rest are dropped (never shown). */
export function usableIdeas(reply, slots, avoid = []) {
  const seen = new Set(avoid.map((a) => a.toLowerCase().trim()));
  const out = [];
  (reply?.ideas ?? []).forEach((raw, i) => {
    const idea = normalizeIdea(raw);
    const key = idea.opener.toLowerCase();
    if (seen.has(key) || seen.has(idea.title.toLowerCase())) return;
    if (ideaProblems(idea, slots?.[i] ?? null).length) return;
    seen.add(key);
    out.push(idea);
  });
  return out;
}

/** What the idea card shows (the twist itself stays on the server until the script is written). */
export const cardOf = (idea, id) => ({ id, opener: idea.opener, title: idea.title, premise: idea.premise, teaser: idea.teaser, mood: idea.mood, moodLabel: MOODS[idea.mood]?.label ?? idea.mood, setting: idea.setting });
