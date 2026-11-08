// Blocky Worlds: the story skeleton (owner, 2026-11-08), checked for free in code. The writer returns its script AND a
// skeleton map (short quotes of the lines that do each job); code checks that each quote really is in the script, in the
// right part, and does the job:
//   1. rule + price first: line 1 is the rule ("In this town, ..."), the price is in line 1 or 2
//   2. three named neighbours, each joked about in the world tour
//   3. the narrator is the exception (a "Me" line with an exception word)
//   4. the planted object is named in "Me" (and pays off in the climax: protocol.js propProblems)
//   5. three escalation steps in "Until one night", in order
//   6. the discovery is about the rule (it shares a word with line 1, or says "rule")
//   7. the climax wins with the rule or the planted object
//   8. the closer flips line 1 (shares a word with it, in the last two lines)
//   + the twist is set up earlier: its clue is in a line before the discovery and comes back in the discovery or
//     climax, and the climax brings no new magic (a magic word that was never used before the discovery)
import { hasOpener } from "./opener.js";
import { contentWords } from "./library.js";
import { propReference } from "./protocol.js";
import { norm } from "./antiCopy.js";

export const SKELETON_PREFIX = "Skeleton";
export const TWIST_PREFIX = "Twist";

/** The prompt block: the owner's skeleton as hard requirements, and the skeleton map the writer fills in. */
export const SKELETON_RULES = `THE STORY SKELETON (every point is checked in code; a script that misses one is thrown away)
1. Line 1 is the rule as plain fact ("In this town, ..."). The PRICE of breaking it is said in line 1 or line 2.
2. The world tour jokes about THREE NAMED neighbours (a name each, like "Mrs. Fennick" or "Dobbs the baker"), one quick joke each.
3. "Me": the narrator is the EXCEPTION or the underdog of the rule (say it plainly: "except me", "the only one", "the lowest").
4. "Me" also names the planted object, an ordinary thing the narrator has. It must win the climax (or the rule itself wins).
5. "Until one night" escalates in THREE visible steps, each bigger than the last.
6. "Discovery" reveals a hidden truth ABOUT THE RULE.
7. "Climax": the narrator wins with the rule itself or the planted object. No outside help, no new magic, no new power.
8. The closer flips or echoes line 1 (reuse its key word).
THE TWIST is crazy but SET UP EARLIER: a clue (a word, a detail, a habit) is planted in the tour, "Me" or "until", and the twist pays it off. A viewer could guess it in hindsight. Nothing new appears at the end.

THE SKELETON MAP (return it with the script): for each job, copy a SHORT EXACT QUOTE (3 to 8 words, word for word) from the line that does it:
price, neighbours (the three names, each with a quote of its joke line), exception, prop (the object's words as spoken) and prop_quote, escalation (three quotes in order), discovery, twist (the twist in one plain sentence, not a quote), clue (the planted clue word or phrase) and clue_quote (the earlier line that plants it), win (the climax line where it wins) and win_by ("rule" or "prop").`;

export function skeletonSchema() {
  const s = { type: "string" };
  return {
    type: "object", additionalProperties: false,
    required: ["price", "neighbours", "exception", "prop", "prop_quote", "escalation", "discovery", "twist", "clue", "clue_quote", "win", "win_by"],
    properties: {
      price: s, exception: s, prop: s, prop_quote: s, discovery: s, twist: s, clue: s, clue_quote: s, win: s,
      win_by: { type: "string", enum: ["rule", "prop"] },
      neighbours: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "quote"], properties: { name: s, quote: s } } },
      escalation: { type: "array", items: s },
    },
  };
}

/**
 * The index of the line a quote comes from (-1 if none): the exact words, else a line holding 80% of them. A quote that
 * spans two lines ("Money never held up the towers. Weight did.", 2026-11-08 run) is found by its first sentence that
 * matches a line.
 */
export function lineOf(lines, quote, from = 0) {
  const one = lineOfOne(lines, quote, from);
  if (one >= 0) return one;
  const parts = String(quote ?? "").split(/(?<=[.!?,])\s+/).filter((p) => norm(p).length >= 2);
  for (const p of parts) { const i = lineOfOne(lines, p, from); if (i >= 0) return i; }
  // a quote that runs across two lines of the same part, with no stop between ("...each other and their note pulls"):
  // two lines in a row holding 80% of its words
  const q = norm(quote);
  if (q.length < 6) return -1;
  for (let i = from; i + 1 < lines.length; i++) {
    if (lines[i].part !== lines[i + 1].part) continue;
    const ws = new Set(norm(`${lines[i].text} ${lines[i + 1].text}`));
    if (q.filter((w) => ws.has(w)).length / q.length >= 0.8) return i;
  }
  return -1;
}
function lineOfOne(lines, quote, from = 0) {
  const q = norm(quote);
  if (!q.length) return -1;
  const qs = q.join(" ");
  for (let i = from; i < lines.length; i++) if (norm(lines[i].text).join(" ").includes(qs)) return i;
  let best = -1, bestShare = 0;
  for (let i = from; i < lines.length; i++) {
    const ws = new Set(norm(lines[i].text));
    const share = q.filter((w) => ws.has(w)).length / q.length;
    if (share > bestShare) { best = i; bestShare = share; }
  }
  return bestShare >= 0.8 ? best : -1;
}

const EXCEPTION = /\b(except|only (?:one|kid|person|family|house)|but me|not me|never|can't|cannot|couldn't|don't|didn't|without|no one|nobody|last|lowest|smallest|poorest|worst|weakest|bottom|tiniest|shortest|alone|different)\b/i;
/** Words of new magic or power that must not first appear in the climax. */
export const MAGIC = Object.freeze(["magic", "magical", "spell", "wizard", "witch", "potion", "enchanted", "enchant", "superpower", "power", "powers", "portal", "miracle", "teleport", "teleported", "transform", "transformed", "sparkle", "sparkled", "glow", "glowed", "glowing", "wish", "wished", "curse", "cursed", "suddenly", "zap", "zapped", "beam"]);
const MAGIC_SET = new Set(MAGIC);

/**
 * The skeleton problems of a script with its skeleton map (empty = the skeleton holds). card: its prop (fallback).
 * Every problem starts with "Skeleton" or "Twist".
 */
export function skeletonProblems(script, skel = {}, card = null) {
  const lines = script?.lines ?? [];
  const out = [];
  const bad = (what) => out.push(`${SKELETON_PREFIX}: ${what}`);
  const partOf = (i) => lines[i]?.part;
  const idxs = (part) => lines.map((l, i) => (l.part === part ? i : -1)).filter((i) => i >= 0);
  if (!lines.length) return [`${SKELETON_PREFIX}: the script is empty.`];
  const firstWords = contentWords(lines[0].text);
  // 1. rule + price first
  if (!hasOpener(lines[0].text)) bad('line 1 must state the rule ("In this town, ..." / "In this world, ...").');
  const price = lineOf(lines, skel.price);
  if (price < 0 || price > 1) bad(`the price of breaking the rule must be said in line 1 or 2${price > 1 ? ` (it comes in line ${price + 1})` : ""}.`);
  // 2. three named neighbours in the tour
  const names = (skel.neighbours ?? []).filter((n) => String(n?.name ?? "").trim());
  const tourHits = new Set();
  // 2026-11-08 run: the writer quotes the joke's punchline ("He says ducking is a richer person's hobby.") right after the
  // line that names the neighbour ("Captain Welk on level thirty..."), and names come as "Dobbs the baker": the name is
  // any capitalised word of it (not a title), found in the quoted line or one of the two before it, in the tour
  const TITLES = new Set(["mr", "mrs", "ms", "miss", "dr", "old", "the", "mayor", "captain", "coach", "officer", "grandma", "grandpa", "aunt", "uncle"]);
  for (const n of names) {
    const i = lineOf(lines, n.quote);
    const nameWords = String(n.name).split(/\s+/).map((w) => w.replace(/[^A-Za-z]/g, "")).filter((w) => /^[A-Z]/.test(w) && !TITLES.has(w.toLowerCase()));
    if (i < 0 || !nameWords.length) continue;
    const at = [i, i - 1, i - 2].find((k) => k >= 0 && ["tour", "rule"].includes(partOf(k)) && nameWords.some((w) => new RegExp(`\\b${w}\\b`).test(lines[k].text)));
    if (at !== undefined && ["tour", "rule"].includes(partOf(i))) tourHits.add(nameWords[0].toLowerCase());
  }
  if (tourHits.size < 3) bad(`the world tour needs three named neighbours, one joke each (found ${tourHits.size}).`);
  // 3. the narrator is the exception, in "Me"
  const ex = lineOf(lines, skel.exception);
  if (ex < 0 || partOf(ex) !== "me" || !EXCEPTION.test(lines[ex].text)) bad('"Me" must say plainly how the narrator is the exception or the underdog of the rule.');
  // 4. the planted object, named in "Me"
  const prop = String(skel.prop || card?.prop || "");
  const me = idxs("me");
  if (!prop || !me.some((i) => propReference(prop, lines[i].text, { withOwner: true }) !== null)) bad(`the planted object${prop ? ` (${prop})` : ""} must be named in "Me".`);
  // 5. three escalation steps in "until", in order
  const steps = (skel.escalation ?? []).map((q) => lineOf(lines, q));
  const inUntil = steps.filter((i) => i >= 0 && partOf(i) === "until");
  const ordered = inUntil.every((v, k) => !k || v > inUntil[k - 1]);
  if (new Set(inUntil).size < 3 || !ordered) bad(`"Until one night" needs three escalation steps, in order (found ${new Set(inUntil).size}).`);
  // 6. the discovery is about the rule
  const disc = lineOf(lines, skel.discovery);
  const discText = idxs("discovery").map((i) => lines[i].text).join(" ");
  if (disc < 0 || partOf(disc) !== "discovery") bad('"Discovery" must reveal a hidden truth about the rule (quote its line).');
  else if (!/\brules?\b/i.test(discText) && !contentWords(discText).some((w) => firstWords.includes(w))) bad("the discovery must be about the rule of line 1 (reuse its key word).");
  // 7. the climax wins with the rule or the planted object
  const win = lineOf(lines, skel.win);
  const climax = idxs("climax");
  if (win < 0 || partOf(win) !== "climax") bad("the climax must have a line where the narrator wins (quote it).");
  else {
    const near = [win - 1, win, win + 1].filter((i) => partOf(i) === "climax").map((i) => lines[i].text).join(" ");
    const byProp = prop && climax.some((i) => propReference(prop, lines[i].text) !== null);
    const byRule = contentWords(near).some((w) => firstWords.includes(w)) || /\brules?\b/i.test(near);
    if (!(skel.win_by === "prop" ? byProp : byRule) && !(byProp || byRule)) bad("the climax must be won with the rule itself or the planted object.");
  }
  // 8. the closer flips line 1
  const lastTwo = lines.slice(-2).map((l) => l.text).join(" ");
  if (!contentWords(lastTwo).some((w) => firstWords.includes(w))) bad("the last line must flip or echo line 1 (reuse its key word).");
  // the twist: set up before the discovery, paid off later, no new magic in the climax
  const firstDisc = idxs("discovery")[0] ?? lines.length;
  const clueAt = lineOf(lines, skel.clue_quote);
  const clueWords = contentWords(skel.clue);
  const before = lines.slice(0, firstDisc).map((l) => l.text).join(" ");
  const after = lines.slice(firstDisc).map((l) => l.text).join(" ");
  if (!String(skel.twist ?? "").trim()) out.push(`${TWIST_PREFIX}: the twist is missing.`);
  if (clueAt < 0 || clueAt >= firstDisc || !clueWords.length || !clueWords.some((w) => contentWords(before).includes(w))) out.push(`${TWIST_PREFIX}: the twist is not set up earlier. Plant its clue (${skel.clue || "a clue"}) in the tour, "Me" or "until", before the discovery.`);
  else if (!clueWords.some((w) => contentWords(after).includes(w))) out.push(`${TWIST_PREFIX}: the clue (${skel.clue}) never comes back in the discovery or climax, so the twist doesn't pay it off.`);
  const earlier = new Set(norm(before));
  const magicWord = (w) => (MAGIC_SET.has(w) ? w : MAGIC_SET.has(w.replace(/s$/, "")) ? w.replace(/s$/, "") : null); // "wizard's" -> wizard
  const seen = new Set([...earlier].map((w) => magicWord(w) ?? w));
  const fresh = [...new Set(climax.flatMap((i) => norm(lines[i].text)).map(magicWord).filter((w) => w && !seen.has(w)))];
  if (fresh.length) out.push(`${TWIST_PREFIX}: the climax brings new magic (${fresh.join(", ")}) that was never set up. Win with what the story already showed.`);
  return out;
}
