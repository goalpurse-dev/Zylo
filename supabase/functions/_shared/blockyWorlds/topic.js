// Blocky Worlds: the user's own idea ("Your topic") stays the core of the story. 2026-11-06: the topic "we live inside a
// giant turtle and a big bad wolf with an army of soldiers is hunting it" became a story about a drumbeat ticking in
// everyone's wrist: the idea writer swapped the premise for a new gimmick (formula F1 "everyone has X, except me") and the
// turtle, the wolf and his army became backdrop. This module is free and deterministic: the topic's key elements (its
// content words, with plurals, -ing/-ed forms and a few synonyms) must state the rule, run through the story and reach
// the climax. Only drafts from a typed topic carry card.topic; library ideas and pasted scripts are never checked.

/** Every topic problem starts with this (protocol.js problemSpots places them by it). */
export const TOPIC_PREFIX = "The story drifted from your idea";
/** At least this share of the lines must mention one of the topic's elements. */
export const TOPIC_MIN_SHARE = 0.2;
const MAX_ELEMENTS = 6;

const STOP = new Set(`a an the and or but nor of to in on at by for with from into onto inside outside within under over above below behind near through about around across upon
we us our ours you your i me my mine he him his she her they them their it its this that these those there here who whom which what when where why how
is are was were be been being am do does did done has have had having get gets got getting make makes made can could will would should may might must shall
live lives living lived become becomes became turn turns turned go goes went going come comes came keep keeps kept let lets
all every each everyone everybody someone somebody something anything nothing everything no not only just very really so too also then than if because while until
one two three four five some many much more most few lot lots other another same own
big bad giant huge little small tiny old new young good great tall long short whole entire real secret strange weird magic magical evil scary dark
world town place day days night nights time times thing things way people person kid kids child children family families story video
like want wants need needs say says said see sees saw find finds found try tries use uses called named`.split(/\s+/));

const IRREGULAR = Object.freeze({ wolves: "wolf", leaves: "leaf", knives: "knife", shelves: "shelf", elves: "elf", wives: "wife", thieves: "thief", calves: "calf", halves: "half", loaves: "loaf", mice: "mouse", geese: "goose", teeth: "tooth", feet: "foot", men: "man", women: "woman", children: "child", people: "person", flew: "fly", ate: "eat", stole: "steal", slept: "sleep", caught: "catch", fought: "fight" });

/** Synonym groups (base forms): a script that says "soldiers" or "troops" mentions the topic's "army". */
const GROUPS = [
  "army soldier troop guard knight warrior legion platoon battalion regiment trooper",
  "hunt hunter chase stalk track prey pursue",
  "monster beast creature", "ghost spirit phantom specter spectre", "robot bot android droid", "alien martian ufo",
  "mom mother mum mommy", "dad father daddy", "grandma granny grandmother nana", "grandpa grandfather granddad grandad",
  "dog puppy pup hound", "cat kitten kitty", "ocean sea", "house home", "school classroom", "shop store",
  "zombie undead", "eat eaten swallow", "sleep asleep", "steal stolen thief", "teacher", "dragon", "witch",
].map((g) => g.split(" "));
const GROUP_OF = new Map(GROUPS.flatMap((g) => g.map((w) => [w, g[0]])));

/** A word's base form: lowercase, no possessive, singular, no -ing/-ed ("hunting" -> "hunt", "wolves" -> "wolf"). */
export function baseWord(word) {
  let t = String(word ?? "").toLowerCase().replace(/[’']s$/, "").replace(/[^a-z]/g, "");
  if (IRREGULAR[t]) return IRREGULAR[t];
  let verb = false;
  if (t.length > 5 && t.endsWith("ing")) { t = t.slice(0, -3); verb = true; }
  else if (t.length > 4 && t.endsWith("ied")) t = `${t.slice(0, -3)}y`;
  else if (t.length > 4 && t.endsWith("ed")) { t = t.slice(0, -2); verb = true; }
  else if (t.length > 4 && t.endsWith("ies")) t = `${t.slice(0, -3)}y`;
  else if (t.length > 4 && /(ss|x|z|ch|sh)es$/.test(t)) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith("s") && !/(ss|us|is)$/.test(t)) t = t.slice(0, -1);
  if (verb && t.length > 3 && /([^aeiouls])\1$/.test(t)) t = t.slice(0, -1); // "running" -> "runn" -> "run"
  return t;
}
const keyOf = (word) => { const b = baseWord(word); return GROUP_OF.get(b) ?? GROUP_OF.get(`${b}e`) ?? b; };
// "chasing" -> "chas" and "chase" -> "chase" are the same word
const sameKey = (a, b) => a === b || `${a}e` === b || `${b}e` === a;
const wordsOf = (text) => String(text ?? "").replace(/[’]/g, "'").split(/[^A-Za-z']+/).map((w) => w.replace(/^'+|'+$/g, "")).filter(Boolean);
const SETTING_WORDS = new Set("inside in on under within beneath underneath aboard atop".split(" "));

/**
 * The topic's key elements, in order: [{ key, words: [as typed], label, setting }]. setting: the first element right
 * after "inside / in / on / under..." ("we live inside a giant turtle" -> turtle).
 */
export function topicElements(topic) {
  const raw = wordsOf(topic);
  const out = [];
  let settingNext = false, settingSet = false;
  for (const w of raw) {
    const low = w.toLowerCase();
    if (SETTING_WORDS.has(low)) { if (!settingSet) settingNext = true; continue; }
    const base = baseWord(w);
    if (base.length < 3 || STOP.has(low) || STOP.has(base)) continue;
    const key = keyOf(w);
    let el = out.find((e) => sameKey(e.key, key));
    if (!el) { el = { key, words: [], setting: false }; out.push(el); }
    if (!el.words.includes(low)) el.words.push(low);
    if (settingNext) { el.setting = true; settingNext = false; settingSet = true; }
  }
  return out.slice(0, MAX_ELEMENTS).map((e) => ({ ...e, label: `"${e.words.join("/")}"` }));
}

/** Whether a text mentions an element (any form or synonym of it). */
export const mentions = (text, el) => wordsOf(text).some((w) => sameKey(keyOf(w), el.key));

const list = (labels, joiner = "and") => (labels.length <= 1 ? labels.join("") : `${labels.slice(0, -1).join(", ")} ${joiner} ${labels.at(-1)}`);

/**
 * Whether a first line (or the rule part) states the topic: the setting plus one other element, or two elements when
 * there is no setting (all of them when the topic has fewer). Returns the labels it is missing ([] = fine).
 */
export function ruleMissing(els, text) {
  if (!els.length) return [];
  const setting = els.find((e) => e.setting), others = els.filter((e) => !e.setting);
  const hit = (e) => mentions(text, e);
  if (setting) {
    const miss = [];
    if (!hit(setting)) miss.push(setting.label);
    if (others.length && !others.some(hit)) miss.push(list(others.map((e) => e.label), "or"));
    return miss;
  }
  const need = Math.min(2, els.length);
  return els.filter(hit).length >= need ? [] : [list(els.filter((e) => !hit(e)).map((e) => e.label), "or")];
}

/**
 * The topic check (free, deterministic). A script from a typed topic must:
 *   1. state the topic as the rule: the rule part names its setting and one more element (ruleMissing)
 *   2. keep every element in the story after the opening (the rule part and the line after it)
 *   3. mention an element in at least TOPIC_MIN_SHARE of its lines
 *   4. bring an element other than the setting (the threat, the characters) into the climax
 * Returns the problems (sentences starting with TOPIC_PREFIX; [] = on topic).
 */
export function topicProblems(topic, script) {
  const els = topicElements(topic), lines = script?.lines ?? [];
  if (!els.length || !lines.length) return [];
  const out = [];
  let ruleIdx = lines.map((l, i) => (l.part === "rule" ? i : -1)).filter((i) => i >= 0);
  if (!ruleIdx.length) ruleIdx = [0];
  const miss = ruleMissing(els, ruleIdx.map((i) => lines[i].text).join(" "));
  if (miss.length) out.push(`${TOPIC_PREFIX}: the first line never mentions ${miss.join(" or ")}. State your idea itself as the world's rule ("In this world, ...").`);
  const openingEnd = Math.max(...ruleIdx) + 1; // the rule part and the line after it ("You see, ...")
  const later = lines.slice(openingEnd + 1).map((l) => l.text).join(" \n ");
  const absent = els.filter((e) => !mentions(later, e));
  if (absent.length) {
    const never = absent.filter((e) => !lines.some((l) => mentions(l.text, e)));
    const onlyOpening = absent.filter((e) => !never.includes(e));
    const bits = [];
    if (never.length) bits.push(`${list(never.map((e) => e.label))} never ${never.length > 1 ? "show" : "shows"} up`);
    if (onlyOpening.length) bits.push(`${list(onlyOpening.map((e) => e.label))} never ${onlyOpening.length > 1 ? "show" : "shows"} up after the opening`);
    out.push(`${TOPIC_PREFIX}: ${bits.join(", and ")}. Your idea has to drive the whole story, not just the first lines.`);
  }
  const onTopic = lines.filter((l) => els.some((e) => mentions(l.text, e))).length;
  if (onTopic / lines.length < TOPIC_MIN_SHARE) out.push(`${TOPIC_PREFIX}: only ${onTopic} of ${lines.length} lines are about it (${list(els.map((e) => e.label))}). Keep your idea at the heart of every part, not in the background.`);
  const climax = lines.filter((l) => l.part === "climax").map((l) => l.text).join(" ");
  const drivers = els.filter((e) => !e.setting).length ? els.filter((e) => !e.setting) : els;
  if (climax && !drivers.some((e) => mentions(climax, e))) out.push(`${TOPIC_PREFIX}: the climax never involves ${list(drivers.map((e) => e.label), "or")}. The ending must beat or pay off your idea.`);
  return out;
}

/** How faithful an idea card is to the topic (higher is better): elements in the opener count double. */
export function ideaFidelity(topic, idea) {
  const els = topicElements(topic);
  const rest = [idea?.premise, idea?.price, idea?.twist, idea?.closer, ...(idea?.examples ?? [])].join(" ");
  return els.reduce((a, e) => a + (mentions(idea?.opener, e) ? 2 : 0) + (mentions(rest, e) ? 1 : 0), 0);
}

/**
 * Topic ideas ranked by fidelity (best first); ideas whose opener doesn't state the topic are dropped while at least one
 * that does remains.
 */
export function rankTopicIdeas(topic, ideas) {
  const els = topicElements(topic);
  if (!els.length) return ideas;
  const scored = ideas.map((idea, i) => ({ idea, i, score: ideaFidelity(topic, idea), ok: !ruleMissing(els, idea.opener).length }));
  const keep = scored.some((s) => s.ok) ? scored.filter((s) => s.ok) : scored;
  return keep.sort((a, b) => b.score - a.score || a.i - b.i).map((s) => s.idea);
}

/** The prompt block that makes the user's idea the core (script, rewrite, part fix, beats). */
export function topicBlock(topic) {
  const els = topicElements(topic);
  if (!els.length) return "";
  const setting = els.find((e) => e.setting), others = els.filter((e) => !e.setting);
  return [
    `THE USER'S OWN IDEA (the core of the story; never replace it): "${String(topic).slice(0, 200)}"`,
    `- Its key elements (${list(els.map((e) => e.label))}) drive the plot in EVERY part: the rule comes from it, the trouble IS it, the climax beats it, the ending pays it off.`,
    `- The first line states the user's idea itself as the world's rule${setting ? `, naming ${setting.label}${others.length ? ` and ${list(others.map((e) => e.label), "or")}` : ""}` : ""}. Never swap it for an invented gimmick (a marker on everyone's wrist, a sticker, a number) that pushes the idea into the background.`,
    "- The card's examples, planted object and twist serve the user's idea. If a card piece would push the idea aside, bend that piece, never the idea.",
  ].join("\n");
}
