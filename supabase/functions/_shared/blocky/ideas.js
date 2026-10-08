// Blocky Stories: "Give me ideas" (decision 68). Five idea cards a batch, each
// from a DIFFERENT one of the ten story types, written by the small model
// (well under a cent a batch). An idea is a title, a one-line hook that hints
// at a twist without stating it, and one sentence of setup, with library
// characters who fit it. The twist itself is decided later, in the plan step.
//
// Pure: prompt, schema and validation. plannerService.js makes the call.
import { STORY_TYPES, STORY_TYPE_IDS } from "./vettedPlans.js";
import { bannedNamesProblem } from "./safety.js";
import { wordCount } from "./duration.js";

export const IDEAS_PER_BATCH = 5;
export const IDEAS_PURPOSE = "ideas";
/** Free, with a limit: this many idea batches and this many "write me three versions" a user a day (UTC). */
export const DAILY_IDEA_BATCHES = 20;
export const DAILY_DRAFTS = 5;

/**
 * The five story types of batch number `seed`: the first batch takes five, "More ideas" takes the other
 * five, and after that the split moves on by one, so the pairings keep changing.
 */
export function typesForBatch(seed) {
  const n = Math.max(0, Math.floor(Number(seed) || 0));
  const shift = Math.floor(n / 2) % STORY_TYPE_IDS.length;
  const order = [...STORY_TYPE_IDS.slice(shift), ...STORY_TYPE_IDS.slice(0, shift)];
  return n % 2 === 0 ? order.slice(0, IDEAS_PER_BATCH) : order.slice(IDEAS_PER_BATCH);
}

export const IDEAS_SYSTEM = `You come up with story ideas for Blocky Stories: short vertical videos (20 to 60 seconds) where blocky game avatars act out a story inside a blocky online game world and talk, for YouTube Shorts and TikTok. Each idea becomes a story with a twist, so it must be a SETUP that a twist can turn over. You do not write the twist.

FOR EACH IDEA
- type: the story type it is asked for (given below, one idea per type).
- title: 2 to 5 words. It teases; it never tells how it ends.
- hook: ONE line of 8 to 16 words for the idea card. It drops the reader into the middle of the trouble and hints that something is not what it seems. It never says what.
- summary: ONE sentence of 12 to 28 words: who wants what from whom, and what is at stake. The setup only: no ending, no "but then", no "turns out".
- castIds: 2 or 3 characters from the library who fit the idea. Use their names in the hook and the summary.

RULES
- One idea, one "what happens if". Someone must stand to LOSE something a viewer cares about by the second line: their place on the server, their only pet, their rank, their best item.
- Nothing a viewer would have to READ: no idea may depend on a number, a countdown display, a leaderboard, a list, a name tag, a note or a message. If the type is a countdown or a rule, the countdown is a light that changes colour or a sound, and the rule is spoken.
- A character only does what their role allows. Only an admin or the owner can ban, kick, mute, reset or change the server; a player can trade, build, collect, race, report, win and lose.
- The characters are blocky game avatars whose look never changes: no idea about a haircut, a new outfit or a body changing shape. Never an age; never a kid, a child, a boy, a girl, a man or a woman: they are players.
- It happens in one to three places of a blocky game world (a spawn plaza, an obby, a trading plaza, an admin room), with only the cast.
- For a young audience: no blood, weapons, romance or stunts someone could copy. Danger is game danger: kicked, banned, reset, items lost.
- Never the real platform, a real game, a real brand, a real creator or a real username.
- Never one of these worn-out plots: copying someone's powers; the invisible-friend glitch; a prank on a mom or a sibling; a hacker who steals everything; "I played as a noob for a day".
- The five ideas are five different stories: different trouble, different stakes, different places.

Return only the JSON object.`;

export function ideasSchema() {
  const s = { type: "string" };
  const idea = { type: s, title: s, hook: s, summary: s, castIds: { type: "array", items: s } };
  return { type: "object", additionalProperties: false, required: ["ideas"], properties: { ideas: { type: "array", items: { type: "object", additionalProperties: false, required: Object.keys(idea), properties: idea } } } };
}

/** @param {object} p  {library: character rows, types: string[5], avoidTitles?: string[]} */
export function buildIdeasPrompt({ library, types, avoidTitles = [] }) {
  const label = (id) => STORY_TYPES.find((t) => t.id === id)?.label ?? id;
  const parts = [
    `THE LIBRARY (use only these ids):\n${library.map((c) => `- ${c.id}: ${c.name}. ${c.tag}: ${c.role}`).join("\n")}`,
    `Write exactly ${types.length} ideas, one for each of these story types, in this order:\n${types.map((t, i) => `${i + 1}. ${t}: ${label(t)}`).join("\n")}`,
  ];
  if (avoidTitles.length) parts.push(`This user has already seen or made these; write nothing like them:\n${avoidTitles.slice(0, 20).map((t) => `- ${t}`).join("\n")}`);
  return { system: IDEAS_SYSTEM, user: parts.join("\n\n") };
}

/** What an idea may not rest on: the pictures carry no words and no numbers. */
const TO_READ = /\b(?:numbers?|digits?|leaderboards?|scoreboards?|name ?tags?|usernames?|chat|messages?|notes?|signs?|lists?|typed?|wrote|reads?)\b/i;
const GIVES_AWAY = /\b(?:turns? out|but then|secretly is|was actually|all along|in the end)\b/i;

/**
 * Checks a batch. Returns {ideas, errors}: ideas are the usable ones (normalized, with an id); errors say
 * what was wrong with the others (the batch is asked for once more only if fewer than three are usable).
 */
export function validateIdeas(out, { library, types, seed = 0 }) {
  const ids = new Set(library.map((c) => c.id));
  const errors = [];
  const ideas = [];
  const seenTypes = new Set();
  (Array.isArray(out?.ideas) ? out.ideas : []).forEach((raw, i) => {
    const n = i + 1;
    const text = (k) => String(raw?.[k] ?? "").trim();
    const title = text("title"), hook = text("hook"), summary = text("summary"), type = text("type");
    const castIds = [...new Set(Array.isArray(raw?.castIds) ? raw.castIds : [])];
    const bad = [];
    if (!types.includes(type) || seenTypes.has(type)) bad.push(`type must be one of ${types.join(", ")}, each used once`);
    if (wordCount(title) < 2 || wordCount(title) > 7) bad.push("title: 2 to 5 words");
    if (wordCount(hook) < 5 || wordCount(hook) > 22) bad.push("hook: one line of 8 to 16 words");
    if (wordCount(summary) < 8 || wordCount(summary) > 40) bad.push("summary: one sentence of 12 to 28 words");
    if (castIds.length < 2 || castIds.length > 3 || castIds.some((id) => !ids.has(id))) bad.push("castIds: 2 or 3 ids from the library");
    const read = `${hook} ${summary}`.match(TO_READ);
    if (read) bad.push(`it depends on "${read[0]}", which a viewer would have to read; make it something seen or said`);
    const away = `${title} ${hook} ${summary}`.match(GIVES_AWAY);
    if (away) bad.push(`"${away[0]}" gives the ending away; write the setup only`);
    for (const [k, v] of [["title", title], ["hook", hook], ["summary", summary]]) { const p = bannedNamesProblem(v, k); if (p) bad.push(p); }
    if (bad.length) { errors.push(`idea ${n}: ${bad.join("; ")}`); return; }
    seenTypes.add(type);
    ideas.push({ id: `idea:${seed}:${type}`, type, title, hook, summary, castIds, vetted: false });
  });
  if (!ideas.length && !errors.length) errors.push(`write exactly ${types.length} ideas`);
  return { ideas, errors };
}

/** Words in a vetted plan's roles that point at a kind of library character. */
const FITS = [
  [/\b(?:admin|moderator|mod|owner)\b/i, /admin|owner|mod/i],
  [/\b(?:new|newcomer|noob|beginner|quiet)\b/i, /new|noob|begin/i],
  [/\b(?:collector|trader|scammer|rich|seller)\b/i, /collect|trad|rich/i],
];
/**
 * Library characters for a vetted plan's A, B and C: the one whose tag fits the role's words, else the next
 * one free. Returns the cast ids in slot order, or null when the library is too small.
 */
export function castForSlots(slots, library) {
  const free = [...library];
  const picked = [];
  for (const role of Object.values(slots)) {
    const fit = FITS.find(([words]) => words.test(role));
    const i = Math.max(0, fit ? free.findIndex((c) => fit[1].test(`${c.tag} ${c.role}`)) : 0);
    const [c] = free.splice(i, 1);
    if (!c) return null;
    picked.push(c.id);
  }
  return picked;
}

/** A vetted plan as an idea card (nothing of its twist goes to the browser). */
export function ideaFromPlan(row, library) {
  const castIds = castForSlots(row.plan?.slots ?? {}, library);
  if (!castIds) return null;
  return { id: `plan:${row.slug}`, type: row.story_type, title: row.title, hook: row.hook, summary: String(row.plan?.premise ?? "").replace(/^what happens if\s+/i, "What if ").trim(), castIds, vetted: true };
}
