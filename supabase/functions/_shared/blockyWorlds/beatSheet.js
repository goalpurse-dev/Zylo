// Blocky Worlds: the BEAT SHEET of the hybrid writer (owner, 2026-11-10: "STORY FORMULA: switch the writer to this beat
// sheet (measured on 15 viral videos)"). Pure: the beats, their timing shares and jobs, the line counts per beat, the
// writer's map schema and the free ADVISORY checks (they never block; the hard checks stay in hybrid.js: the opener, the
// length, real copying, the premise lost, the safety words).
//
//   rule (0%) -> origin (0-6 s) -> 3 named neighbours living the rule (6-20 s) -> "then there's me": the hero is the
//   worst at the rule (~22%) -> an ally says ONE planted line the hero needs later (~30%) -> trigger (~38%) -> the
//   ADULTS TRY AND FAIL, each in a funny visible way (45-65%) -> the hero's flaw saves everyone, using the planted line
//   (70-90%) -> callback joke last line.
//
// And "THE STORY IS IN THE PICTURE": every rule is visible in the world through a parameter (friends = height, rich =
// house height, mood = a weather cloud), the RULE VISUAL, planned here and carried to the world bible and the director.
//
// Every line keeps one of the seven engine parts (script.js PARTS: the renderer, the director and the sfx read them);
// the beat is an extra field on the line (line.beat), the part follows from it (BEAT_PART).
import { targetWords } from "./config.js";
import { contentWords } from "./library.js";
import { norm } from "./antiCopy.js";
import { isException, MAGIC } from "./skeleton.js";
import { wordCount, estimateSeconds, RULE_MIN_WORDS } from "./script.js";
import { FORMULA_TEXT } from "./formula.js";

/** The beats, in order: [start, end] in % of the video, the engine part, the job (the prompts quote it). */
export const BEATS = Object.freeze([
  Object.freeze({ id: "rule", part: "rule", span: [0, 3], target: "0%", job: 'line 1: the rule as plain fact, starting with exactly "In this town, "' }),
  Object.freeze({ id: "origin", part: "tour", span: [3, 8], target: "0-6 s", job: "line 2 is the RESULT-FIRST HOOK (the craziest consequence the narrator is in right now, first person, an exclamation, inside the first 5 seconds, filmable); then how the rule works and what it costs, in one or two quick lines; the RULE VISUAL is seen here for the first time" }),
  Object.freeze({ id: "neighbours", part: "tour", span: [8, 19], target: "6-15 s", job: "two or three NAMED neighbours living the rule, one quick joke each, each in its OWN place (a kitchen, the school, the bus stop) and SHOWN by the rule visual (their height, their house, their cloud); about 70 words in the first 15 seconds" }),
  Object.freeze({ id: "me", part: "me", span: [19, 27], target: "~15 s", job: 'the "But..." PIVOT, a line that starts with "But" and puts the narrator in the worst case of the rule WITH A NUMBER ("But I had ten minutes and four hundred stairs."); "Then there\'s me." The hero is the WORST at the rule (the lowest, the smallest, the quietest), seen in the rule visual; their flaw is plain' }),
  Object.freeze({ id: "ally", part: "me", span: [27, 35], target: "~30%", job: "an ally (a friend, a grandparent, a sibling) says ONE line, quoted, that sounds like a throwaway joke or odd advice; the hero needs it later" }),
  Object.freeze({ id: "trigger", part: "until", span: [35, 42], target: "~38%", job: "the trouble arrives: the rule breaks or the threat comes, visible to everyone. The threat comes from the rule's own world (the rule, its rule visual or something already shown), never from nowhere. Open it in your own words, never \"Until one night the...\" (the references open their trouble that way; a copied phrase is thrown away)" }),
  Object.freeze({ id: "adults", part: "until", span: [42, 66], target: "45-65%", job: "the ADULTS TRY AND FAIL, the ESCALATION: two or three named grown-ups (neighbours from the tour count) each try their fix, each failing in a funny, visible way; it DOUBLES every 8 to 12 seconds (one, ten, a hundred), in short sentences of 3 to 10 words, with a SOUND WORD (Boom! Crash! Poof!) as its own short fragment on every hit, at least one every 12 seconds" }),
  Object.freeze({ id: "save", part: "climax", span: [66, 94], target: "70-90%", job: "start with the line \"Then I noticed something.\"; the hero remembers the ally's line, and the very flaw that made them the worst at the rule is what saves everyone; the planted line is said again here" }),
  Object.freeze({ id: "callback", part: "closer", span: [94, 100], target: "last line", job: "the world after, then a last line of 2 to 6 words that is a callback JOKE to something from the first half (a neighbour's joke, the ally's line, the rule) and reopens the loop" }),
]);
export const BEAT_IDS = Object.freeze(BEATS.map((b) => b.id));
export const BEAT_PART = Object.freeze(Object.fromEntries(BEATS.map((b) => [b.id, b.part])));
export const BEAT_PREFIX = "Beat sheet";

/**
 * Words a line of the beat-sheet writer really runs (the 2026-11-10 run: ~9 a line against a plan of 7.5, so every
 * script came back 10-20% long and the free trim cut story lines, a neighbour's name with them): the plan asks for
 * fewer, fuller lines.
 */
// LENGTH-V2 (owner, 2026-11-10: "no fix call and no trimming in normal runs"). The 7 stored drafts of rounds 1-2 ran
// 318-465 words for a 286-318 band. They kept the planned line COUNT (0 extra lines in 5 of 7) but not the line SIZE
// (8.0-10.6 words a line; 3-22 lines over 10 words), and every one overran the origin beat (22-57 words for a 13-word
// budget: it carries the price and the first rule visual). So: lines sized at 9 words, the origin at least 18 words, all
// budgets sized to the AIM (the middle of the band, so a small overshoot still fits), a hard 10-word line limit in the
// prompt, and the writer states each line's word count as it writes (schema field "words").
export const BEAT_WORDS_PER_LINE = 9;
/** The writer's word aim: the middle of the band (286-318 at 90 s -> 302). */
export const AIM_SHARE = 0.95;
export const aimWords = (lengthSec) => Math.round(targetWords(lengthSec) * AIM_SHARE);
/** The most words a line may have in the beat-sheet writer's prompt (the opener excepted). */
export const LINE_MAX_WORDS = 10;
const MIN_BEAT_WORDS = Object.freeze({ origin: 24 });

/**
 * Per-beat word budgets and line counts for a length: the rule is the opener (at least RULE_MIN_WORDS, one line), the
 * other beats share the rest by their spans (the origin at least 18 words); the budgets add up to the AIM (aimWords),
 * never over it.
 */
export function beatBudgets(lengthSec) {
  const total = aimWords(lengthSec);
  const span = (b) => b.span[1] - b.span[0];
  const rule = Math.max(RULE_MIN_WORDS, Math.round((total * span(BEATS[0])) / 100));
  const restSpan = 100 - span(BEATS[0]), rest = total - rule;
  const out = BEATS.map((b) => ({ id: b.id, words: b.id === "rule" ? rule : Math.max(MIN_BEAT_WORDS[b.id] ?? 6, Math.round((rest * span(b)) / restSpan)) }));
  for (let over = out.reduce((a, b) => a + b.words, 0) - total; over > 0; over--) out.reduce((m, b) => (b.id !== "rule" && b.words > m.words ? b : m), out[1]).words--;
  // three neighbours want a line each at least, two each when the words allow (a name line + its joke)
  const minLines = (b) => (b.id === "neighbours" ? (b.words >= 40 ? 6 : 3) : 1);
  return out.map((b) => ({ ...b, lines: b.id === "rule" ? 1 : Math.max(minLines(b), Math.round(b.words / BEAT_WORDS_PER_LINE)) }));
}

/** The beat sheet as prompt text (both system prompts quote it; the same bytes every call, so it caches). */
export const BEAT_SHEET_TEXT = `THE BEAT SHEET (measured on 15 viral videos of this format; in order, with where each beat starts):
${BEATS.map((b, i) => `${i + 1}. ${b.id} (${b.target}): ${b.job}.`).join("\n")}

${FORMULA_TEXT}`;

export const RULE_VISUAL_TEXT = `THE STORY IS IN THE PICTURE (the RULE VISUAL): the rule must be VISIBLE in the world through one concrete PARAMETER, never only explained. Examples: friends = how tall you are; rich = how high your house stands; mood = a little weather cloud over each head; luck = the colour of your front door; a score = a number on a sign above each house; loudness = how far your hat flies off. Pick ONE parameter a camera can show at a glance in a blocky toy world (height, house height, a cloud, a colour, a glow, a size, a number on a sign). Say how it looks for each of the three named neighbours (three clearly different values) and for the hero (the worst value of all). The opening and the neighbour beats show it; the climax may flip it.`;

/** Words that say an attempt failed (the adults beat, read for meaning). */
// (2026-11-10 run: "The hose snapped. Twang.", "It spat him out", "The Peeker licked the glass clean" are failures too)
const FAIL = /\b(fail\w*|didn't|did not|doesn't|wouldn't|couldn't|can't|won't|no luck|nothing happened|backfire\w*|worse|broke|broken|bounced|fell|flopped|stuck|crashed|tripped|slipped|ran away|gave up|missed|exploded|popped|splat|collapsed|blew away|flew away|floated away|landed|nope|not even|too|snapped|cracked|ripped|tore|burst|dropped|sank|sunk|spat|ate|licked|swallowed|gulped|tipped|toppled|melted|spun|rolled|squeezed|slid|wobbled|fizzled|backwards|instead|only made|made it worse|faster|louder|bigger)\b/i;
/** The hero is the worst at the rule: the exception words, or a comparison ("bigger than my house", "even my yawn"). */
const isWorst = (t) => isException(t) || /\b[a-z]{3,}er than\b|\beven my\b|\bzero\b|\bnobody else\b|\bno one else\b|\bdoesn't\b|\bdoes not\b|\bnot at all\b/i.test(String(t ?? ""));
const ADULT = /\b(mr|mrs|ms|miss|dr|mayor|captain|coach|officer|grandma|grandpa|aunt|uncle|mom|mum|dad|teacher|chief|sheriff|principal|baker|doctor|farmer|the adults|grown-?ups|parents|everyone|the council|firefighters?|guards?|the whole town)\b/i;
const TITLES = new Set(["mr", "mrs", "ms", "miss", "dr", "old", "the", "mayor", "captain", "coach", "officer", "grandma", "grandpa", "aunt", "uncle", "chief", "sheriff", "baker", "little", "big"]);
const nameWords = (name) => String(name ?? "").split(/\s+/).map((w) => w.replace(/[^A-Za-z]/g, "")).filter((w) => /^[A-Z]/.test(w) && !TITLES.has(w.toLowerCase()));
const says = (text, name) => nameWords(name).some((w) => new RegExp(`\\b${w}\\b`).test(String(text ?? "")));

/** The share (0-1) of the planted line's words in a text (meaning-level: its content words, stems). */
export function plantedShare(planted, text) {
  const p = contentWords(planted);
  if (!p.length) return 0;
  const t = new Set(contentWords(text));
  return p.filter((w) => t.has(w)).length / p.length;
}

/** Where each beat starts and ends in the script: [{ id, from, to, words, startSec, startPct, targetPct }] (beats in the lines). */
export function beatTiming(script, lengthSec = 90) {
  const lines = script?.lines ?? [];
  const total = Math.max(1, lines.reduce((a, l) => a + wordCount(l.text), 0));
  const secs = estimateSeconds(lines);
  const out = [];
  let acc = 0;
  lines.forEach((l, i) => {
    const id = l.beat ?? null;
    const last = out.at(-1);
    if (id && (!last || last.id !== id)) out.push({ id, from: i, to: i, words: 0, startPct: Math.round((acc / total) * 100), startSec: Number(((acc / total) * secs).toFixed(1)), targetPct: BEATS.find((b) => b.id === id)?.span[0] ?? null, target: BEATS.find((b) => b.id === id)?.target ?? "" });
    const cur = out.at(-1);
    if (cur && cur.id === id) { cur.to = i; cur.words += wordCount(l.text); }
    acc += wordCount(l.text);
  });
  return out.map((b) => ({ ...b, lengthSec }));
}

/** The writer's map (returned with the lines): short exact quotes of the lines that do each job. */
export function beatMapSchema() {
  const s = { type: "string" };
  const obj = (props) => ({ type: "object", additionalProperties: false, required: Object.keys(props), properties: props });
  return obj({
    neighbours: { type: "array", items: obj({ name: s, quote: s }) },
    worst: s, ally_name: s, ally_line: s, payoff: s,
    adults: { type: "array", items: obj({ who: s, quote: s }) },
    flaw: s, save: s, callback_to: s,
  });
}

export const BEAT_MAP_TEXT = `THE BEAT MAP (return it with the lines): for each job a SHORT EXACT QUOTE (3 to 10 words, word for word) from the line that does it: neighbours (the three names, each with a quote of its joke line), worst (the "me" line that makes the hero the worst at the rule), ally_name and ally_line (the planted line exactly as the ally says it), payoff (the save line where the planted line comes back), adults (each grown-up who tries, with a quote of the failed attempt), flaw (the hero's flaw in a few words), save (the line where the flaw saves everyone), callback_to (what the last line calls back, in a few words).`;

/**
 * The advisory beat-sheet notes of a script (empty = every beat does its job). map: the writer's beat map ({} for a saved
 * draft); card: the plan's card (neighbourNames, plantedLine, flaw, adults, ruleVisual). Read for MEANING: a quote that is
 * off still counts when the lines do the job. Every note starts with "Beat sheet".
 */
export function beatSheetProblems(script, map = {}, card = null, lengthSec = 90) {
  const lines = script?.lines ?? [];
  const out = [];
  const bad = (what) => out.push(`${BEAT_PREFIX}: ${what}`);
  if (!lines.length) return [`${BEAT_PREFIX}: the script is empty.`];
  const n = lines.length;
  const hasBeats = lines.some((l) => l.beat);
  // a beat's lines; a draft without beats (an edited one) falls back to the parts and the position
  const PCT = (i) => (i / Math.max(1, n - 1)) * 100;
  const of = (id) => {
    if (hasBeats) return lines.map((l, i) => (l.beat === id ? i : -1)).filter((i) => i >= 0);
    const b = BEATS.find((x) => x.id === id);
    return lines.map((l, i) => (l.part === b.part && PCT(i) >= b.span[0] - 8 && PCT(i) <= b.span[1] + 8 ? i : -1)).filter((i) => i >= 0);
  };
  const text = (idx) => idx.map((i) => lines[i].text).join(" ");
  // 0. every beat, in order
  if (hasBeats) {
    const seen = lines.map((l) => BEAT_IDS.indexOf(l.beat));
    const missing = BEAT_IDS.filter((id) => !lines.some((l) => l.beat === id));
    if (missing.length) bad(`missing beats: ${missing.join(", ")}.`);
    if (seen.some((k, i) => k < 0 || (i && k < seen[i - 1]))) bad("the beats are out of order.");
    // the timing: a beat that starts more than 10 points away from its target share
    for (const t of beatTiming(script, lengthSec)) if (t.targetPct !== null && t.id !== "rule" && t.id !== "callback" && Math.abs(t.startPct - t.targetPct) > 10) bad(`${t.id} starts at ${t.startPct}% (target ${t.target}, ${t.targetPct}%).`);
  }
  // 1. three named neighbours living the rule, before "me"
  const tourIdx = [...of("origin"), ...of("neighbours")];
  const before = tourIdx.length ? tourIdx : lines.map((_, i) => i).filter((i) => PCT(i) < 25);
  const names = [...(map.neighbours ?? []).map((x) => x?.name), ...(card?.neighbourNames ?? [])].filter(Boolean);
  const named = new Set(names.filter((nm) => before.some((i) => says(lines[i].text, nm))).map((nm) => nameWords(nm)[0]?.toLowerCase()).filter(Boolean));
  if (named.size < 2) bad(`two or three NAMED neighbours should live the rule before the "But" pivot (found ${named.size}).`);
  // 2. the hero is the worst at the rule
  const meIdx = of("me");
  // the map's "worst" quote counts only in the first half (the hero is the worst before the trouble starts)
  const worstQ = norm(map.worst).length ? lines.findIndex((l, i) => PCT(i) < 40 && plantedShare(map.worst, l.text) >= 0.8) : -1;
  // or by the picture: a "me" line that shows the hero's rule-visual value (round 2: "My sign says 94", "Our dented tin
  // bell goes clonk, not ding" for a hero value of the slowest tuck-time / the ugliest bell)
  const valWords = (t) => [...contentWords(t), ...(String(t ?? "").match(/\d+/g) ?? [])];
  const heroVal = new Set(valWords(card?.ruleVisual?.hero?.shows));
  const showsHero = (t) => new Set(valWords(t).filter((w) => heroVal.has(w))).size >= 2;
  if (!meIdx.some((i) => isWorst(lines[i].text) || showsHero(lines[i].text)) && !(worstQ >= 0 && isWorst(lines[worstQ].text))) bad('"Then there\'s me" should say plainly that the hero is the WORST at the rule (the lowest, the smallest, the quietest).');
  // 3. the ally's planted line: said before the trigger, and reused in the save
  const planted = String(map.ally_line || card?.plantedLine || "").trim();
  const trigger0 = of("trigger")[0] ?? Math.round(n * 0.38);
  if (!planted) bad("there is no planted ally line.");
  else {
    const at = lines.findIndex((l, i) => i < trigger0 && plantedShare(planted, l.text) >= 0.6);
    const saveIdx = of("save");
    const region = saveIdx.length ? saveIdx : lines.map((_, i) => i).filter((i) => PCT(i) >= 60);
    if (at < 0) bad(`the ally's planted line ("${planted.slice(0, 60)}") is not said before the trouble starts.`);
    else if (!region.some((i) => i > at && plantedShare(planted, lines[i].text) >= 0.5)) bad(`the ally's planted line ("${planted.slice(0, 60)}") never comes back in the save: the hero should use it (say it again).`);
  }
  // 4. the adults try and fail, visibly
  const adIdx = of("adults");
  const adRegion = adIdx.length ? adIdx : lines.map((_, i) => i).filter((i) => PCT(i) >= 40 && PCT(i) <= 70);
  const tries = new Set();
  for (const a of [...(map.adults ?? []), ...(card?.adults ?? []).map((x) => ({ who: x }))]) if (a?.who && adRegion.some((i) => says(lines[i].text, a.who) || (ADULT.test(a.who) && new RegExp(`\\b${String(a.who).split(/\s+/).pop().replace(/[^A-Za-z]/g, "")}\\b`, "i").test(lines[i].text)))) tries.add(String(a.who).toLowerCase());
  const adultLines = adRegion.filter((i) => ADULT.test(lines[i].text) || [...names, ...(card?.adults ?? [])].some((nm) => says(lines[i].text, nm)));
  if (Math.max(tries.size, Math.min(3, adultLines.length)) < 2) bad("the adults should try to fix it and fail, two or three of them, each in a funny visible way (found " + Math.max(tries.size, adultLines.length) + ").");
  else if (!FAIL.test(text(adRegion))) bad("the adults' attempts never visibly fail (say what went wrong: it bounced, it popped, he got stuck).");
  // 5. the hero's flaw saves everyone
  const saveIdx = of("save");
  const saveText = text(saveIdx.length ? saveIdx : lines.map((_, i) => i).filter((i) => PCT(i) >= 65 && PCT(i) < 95));
  const flawWords = [...new Set([...contentWords(map.flaw), ...contentWords(card?.flaw), ...contentWords(text(meIdx.length ? meIdx : []))])];
  const saveWords = new Set(contentWords(saveText));
  if (!flawWords.some((w) => saveWords.has(w))) bad("the save should come from the hero's flaw (the thing that made them the worst at the rule); the save lines never bring it back.");
  // no new magic in the save
  const earlier = new Set(norm(lines.slice(0, saveIdx[0] ?? Math.round(n * 0.68)).map((l) => l.text).join(" ")));
  const fresh = [...new Set(norm(saveText).filter((w) => MAGIC.includes(w) && !earlier.has(w)))];
  if (fresh.length) bad(`the save brings new magic (${fresh.join(", ")}) that was never set up. Win with the flaw and the planted line.`);
  // the threat comes from the rule's own world
  const threat = threatProblem(script);
  if (threat) bad(threat);
  // 6. the last line is a callback to the first half
  const lastWords = contentWords(lines[n - 1].text);
  const firstHalf = new Set(contentWords(lines.slice(0, trigger0).map((l) => l.text).join(" ")));
  if (!lastWords.some((w) => firstHalf.has(w))) bad("the last line should be a callback joke to the first half (a neighbour's joke, the ally's line, the rule).");
  return out;
}

/** Words too common to tie a threat to the world (anything can "come to town one day"). */
const THREAT_GENERIC = new Set("town everyone everybody day night morning evening noon one then until whole giant big huge little tiny people came come started start suddenly time first last all every house houses home street sky ground over into out off just like".split(" ").flatMap((w) => contentWords(w)));
/**
 * The threat comes from the rule's own world (owner, 2026-11-10, on topic 5: "the threat must come from the rule's own
 * world"; its pollen bubble came from nowhere). The first two trigger lines must name something the story already
 * showed (a word of an earlier line, not a generic one: "the Sneeze Meter", "every curtain", "the machine"). Advisory;
 * null when it does, or when the script has no trigger beat to read.
 */
export function threatProblem(script) {
  const lines = script?.lines ?? [];
  const t0 = lines.findIndex((l) => l.beat === "trigger");
  if (t0 < 1) return null;
  const opening = lines.slice(t0, t0 + 2).filter((l) => l.beat === "trigger");
  const earlier = new Set(contentWords(lines.slice(0, t0).map((l) => l.text).join(" ")).filter((w) => !THREAT_GENERIC.has(w)));
  const own = [...new Set(opening.flatMap((l) => contentWords(l.text)).filter((w) => !THREAT_GENERIC.has(w)))];
  if (!own.length || own.some((w) => earlier.has(w))) return null;
  return `the threat seems to come from nowhere (${own.slice(0, 4).join(", ")} never appeared before the trouble): it should grow out of the rule's own world (the rule, its rule visual, something already shown).`;
}

/** What a beat-sheet plan is missing (free; notes, never a block). */
export function beatPlanNotes(plan) {
  const p = plan ?? {}, out = [];
  if ((p.neighbours ?? []).length !== 3) out.push(`the plan has ${(p.neighbours ?? []).length} neighbours, not three`);
  const rv = p.rule_visual ?? {};
  if (!String(rv.parameter ?? "").trim()) out.push("the plan has no rule visual parameter");
  if ((rv.neighbours ?? []).length < 3) out.push(`the rule visual shows ${(rv.neighbours ?? []).length} neighbours, not three`);
  if (!String(rv.hero ?? "").trim()) out.push("the rule visual has no value for the hero");
  if (!String(p.ally?.line ?? "").trim()) out.push("the plan has no planted ally line");
  if ("trigger_root" in p && !String(p.trigger_root ?? "").trim()) out.push("the plan does not say which part of the rule's world the trouble grows from");
  if ((p.adults ?? []).length < 2) out.push(`the plan has ${(p.adults ?? []).length} adult attempts, not two or three`);
  const beats = (p.beats ?? []).map((b) => b.beat);
  const missing = BEAT_IDS.filter((id) => !beats.includes(id));
  if (missing.length) out.push(`the plan's beats miss ${missing.join(", ")}`);
  return out;
}

/**
 * The rule visual as the world bible and the director take it: { parameter, description, neighbours: [{ name, shows }],
 * hero: { name, shows } } (null when the plan has none).
 */
export function ruleVisualOf(plan) {
  const rv = plan?.rule_visual;
  if (!rv || !String(rv.parameter ?? "").trim()) return null;
  const str = (v, n = 160) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  return {
    parameter: str(rv.parameter, 80),
    description: str(rv.description, 240),
    neighbours: (rv.neighbours ?? []).map((x) => ({ name: str(x?.name, 40), shows: str(x?.shows) })).filter((x) => x.name).slice(0, 6),
    hero: { name: str(plan?.hero?.name, 40), shows: str(rv.hero) },
  };
}
