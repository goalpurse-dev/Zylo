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
  "attack raid invade siege", "capture kidnap", "haunt", "destroy smash wreck",
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

// 2026-11-07: the same turtle topic came back as "we live inside a turtle and feed the hunting wolf every night", a comedy
// where the army sits down to dinner and washes the dishes, and the check above passed it: every noun was there. What a
// premise is also lives in (a) its DESCRIPTORS ("giant" turtle, "big bad" wolf: scale and tone) and (b) its CONFLICT
// RELATION (the wolf and his army HUNT the turtle): the first line must state the relation with its threat, the hunt must
// happen in the story, and the climax must END it (the threat beaten, tricked, escaped, driven off), not cancel it with a
// gag. Funny is fine; the premise stays.
/** Adjectives that define a premise when they stand right before one of its elements (scale, tone, nature). */
const DESCRIPTORS = new Set("giant huge enormous gigantic massive colossal tiny miniature big bad evil wicked haunted invisible cursed magic magical secret scary".split(" "));
/** Words that count as the same descriptor ("a huge turtle" keeps "giant"). */
const DESCRIPTOR_GROUPS = ["giant huge enormous gigantic massive colossal titanic", "tiny miniature teeny", "evil wicked", "magic magical", "scary creepy"].map((g) => g.split(" "));
const descriptorForms = (w) => DESCRIPTOR_GROUPS.find((g) => g.includes(w)) ?? [w];
/** Words that may sit between a descriptor and its noun without breaking the link. */
const DETERMINERS = new Set("a an the our my your his her their its this that".split(" "));
/** Conflict verbs (group keys): the topic's threat does this to its target. */
const RELATION_KEYS = new Set(["hunt", "attack", "capture", "eat", "steal", "haunt", "destroy"]);
const NEGATION = /^(not|never|no|nobody|nothing|none|stop|stops|stopped|quit|cannot|can't|couldn't|won't|wouldn't|didn't|don't|doesn't|isn't|wasn't|weren't|aren't)$/i;
/** Climax words that END a conflict (the threat loses or leaves, the target is safe). */
const RESOLUTION = new Set("run ran flee fled fleeing escape escaped retreat retreated beat beaten defeat defeated trap trapped trick tricked outsmart outsmarted outran fool fooled fall fell tumble tumbled scare scared drive drove driven banish banished surrender surrendered vanish vanished gone sink sank sunk lose lost away off safe saved rescue rescued free freed".split(" "));

/**
 * The topic's key elements, in order: [{ key, words: [as typed], label, setting, descriptors?, relation? }]. setting: the
 * first element right after "inside / in / on / under..." ("we live inside a giant turtle" -> turtle). descriptors: the
 * premise adjectives right before it, as phrases ([["big", "bad"]] for "a big bad wolf"). relation: a conflict verb
 * ("hunting").
 */
export function topicElements(topic) {
  const raw = wordsOf(topic);
  const out = [];
  let settingNext = false, settingSet = false, pend = [];
  for (const w of raw) {
    const low = w.toLowerCase();
    if (SETTING_WORDS.has(low)) { if (!settingSet) settingNext = true; pend = []; continue; }
    if (DESCRIPTORS.has(low)) { pend.push(low); continue; }
    if (DETERMINERS.has(low)) continue;
    const base = baseWord(w);
    if (base.length < 3 || STOP.has(low) || STOP.has(base)) { pend = []; continue; }
    const key = keyOf(w);
    let el = out.find((e) => sameKey(e.key, key));
    if (!el) { el = { key, words: [], setting: false }; out.push(el); }
    if (!el.words.includes(low)) el.words.push(low);
    if (pend.length) { el.descriptors ??= []; if (!el.descriptors.some((d) => d.join(" ") === pend.join(" "))) el.descriptors.push(pend); pend = []; }
    if (RELATION_KEYS.has(el.key)) el.relation = true;
    if (settingNext) { el.setting = true; settingNext = false; settingSet = true; }
  }
  return out.slice(0, MAX_ELEMENTS).map((e) => ({ ...e, label: `"${e.words.join("/")}"` }));
}

/**
 * The topic's conflict: { relation, agents, target } or null when it names no conflict verb. agents: the threat (the
 * elements before the verb, never the setting); target: the setting, else the element after the verb.
 */
export function topicConflict(els) {
  const at = els.findIndex((e) => e.relation);
  if (at < 0) return null;
  const relation = els[at];
  let agents = els.slice(0, at).filter((e) => !e.setting && !e.relation);
  if (!agents.length) agents = els.filter((e) => !e.setting && !e.relation);
  const target = els.find((e) => e.setting) ?? els.slice(at + 1).find((e) => !e.relation) ?? null;
  return { relation, agents, target };
}

/** "big bad wolf", "giant turtle": an element named with its descriptors. */
const named = (e) => `${e.descriptors?.length ? `${e.descriptors[0].join(" ")} ` : ""}${e.words[0]}`;
/** The descriptor phrases a text drops: [{ phrase: "big bad", of: element }]. "huge" keeps "giant"; "big, bad" keeps "big bad". */
export function droppedDescriptors(els, text) {
  const t = String(text ?? "").toLowerCase().replace(/[’]/g, "'");
  const out = [];
  for (const e of els) for (const d of e.descriptors ?? []) {
    const re = new RegExp(`\\b${d.map((w) => `(?:${descriptorForms(w).join("|")})`).join("[\\s,]+(?:and\\s+)?")}\\b`);
    if (!re.test(t)) out.push({ phrase: d.join(" "), of: e });
  }
  return out;
}

const sentencesOf = (text) => String(text ?? "").split(/(?<=[.!?])\s+/).filter(Boolean);
/**
 * Whether a text states the conflict verb actively: "the wolf's army is hunting it" yes; "the hunting wolf" (an
 * adjective), "nobody hunts", "they couldn't hunt anyone" (negated) no. withAgent: the same sentence names the threat.
 */
export function statesRelation(conflict, text, { withAgent = false } = {}) {
  if (!conflict) return true;
  const { relation, agents } = conflict;
  return sentencesOf(text).some((s) => {
    const ws = wordsOf(s);
    const ok = ws.some((w, i) => {
      if (!sameKey(keyOf(w), relation.key)) return false;
      if (/ing$/i.test(w) && ws[i + 1] && agents.some((a) => sameKey(keyOf(ws[i + 1]), a.key))) return false; // "the hunting wolf"
      return !ws.slice(Math.max(0, i - 3), i).some((p) => NEGATION.test(p));
    });
    return ok && (!withAgent || !agents.length || agents.some((a) => mentions(s, a)));
  });
}

/**
 * Whether a climax ENDS the conflict: a resolution word (ran, fled, tricked, trapped, away, safe...) with the threat in
 * the climax, or the verb negated together with its target ("the wolf never hunted our turtle again").
 */
export function resolvesConflict(conflict, climax) {
  if (!conflict) return true;
  const { relation, agents, target } = conflict;
  const threat = !agents.length || agents.some((a) => mentions(climax, a));
  if (threat && wordsOf(climax).some((w) => RESOLUTION.has(w.toLowerCase()))) return true;
  return sentencesOf(climax).some((s) => {
    const ws = wordsOf(s);
    const negated = ws.some((w, i) => sameKey(keyOf(w), relation.key) && ws.slice(Math.max(0, i - 3), i).some((p) => NEGATION.test(p)));
    return negated && ((target && mentions(s, target)) || ws.some((w) => /^(us|our|we|me|my)$/i.test(w)));
  });
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
 *   5. keep the premise's descriptors ("giant", "big bad") in the opening
 *   6. with a conflict verb ("hunting"): state it actively with its threat in the first line, let it happen after the
 *      opening, and END it in the climax (statesRelation, resolvesConflict)
 * Returns the problems (sentences starting with TOPIC_PREFIX; [] = on topic).
 */
export function topicProblems(topic, script) {
  const els = topicElements(topic), lines = script?.lines ?? [];
  if (!els.length || !lines.length) return [];
  const out = [];
  const conflict = topicConflict(els);
  let ruleIdx = lines.map((l, i) => (l.part === "rule" ? i : -1)).filter((i) => i >= 0);
  if (!ruleIdx.length) ruleIdx = [0];
  const ruleText = ruleIdx.map((i) => lines[i].text).join(" ");
  const openingEnd = Math.max(...ruleIdx) + 1; // the rule part and the line after it ("You see, ...")
  // 1. the first line: the elements, the conflict stated actively with its threat, and the premise's descriptors
  const first = [];
  const miss = ruleMissing(els, ruleText);
  if (miss.length) first.push(`never mentions ${miss.join(" or ")}`);
  else if (conflict && !statesRelation(conflict, ruleText, { withAgent: true })) first.push(`never says that ${list(conflict.agents.map((e) => e.label), "or")} ${conflict.agents.length ? "is " : ""}${conflict.relation.label}${conflict.target ? ` the ${conflict.target.label}` : ""} (the conflict is the premise)`);
  const dropped = droppedDescriptors(els, [ruleText, lines[openingEnd]?.text ?? ""].join(" "));
  if (dropped.length) first.push(`drops ${list(dropped.map((d) => `"${d.phrase}" (${d.of.words[0]})`))}, the words that set its scale and tone`);
  if (first.length) out.push(`${TOPIC_PREFIX}: the first line ${first.join(", and ")}. State your idea itself as the world's rule ("In this town, ${String(topic).replace(/[.!?]+$/, "").slice(0, 120)}").`);
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
  if (conflict) {
    const threat = list(conflict.agents.map((e) => e.label), "and") || "the threat";
    // 2. the conflict happens in the story, not only in the opening ("nobody hunts", "they couldn't hunt" don't count)
    if (lines.length > openingEnd + 1 && !statesRelation(conflict, later)) out.push(`${TOPIC_PREFIX}: the ${conflict.relation.label} never happens after the opening. The trouble must be ${threat} actually ${conflict.relation.label}${conflict.target ? ` ${conflict.target.label}` : ""}, step by step, not a side detail.`);
    // 3. the climax ENDS the conflict instead of swapping it for a gag (dinner with the wolf, the army doing dishes)
    if (climax && !resolvesConflict(conflict, climax)) out.push(`${TOPIC_PREFIX}: the climax never ends the ${conflict.relation.label}. ${threat} must be beaten, tricked, trapped, escaped or driven off. Funny is fine, but the conflict of your idea has to end, not turn into a truce or a gag (a dinner, a deal, a chore).`);
  }
  return out;
}

/** How faithful an idea card is to the topic (higher is better): elements in the opener count double. */
export function ideaFidelity(topic, idea) {
  const els = topicElements(topic), conflict = topicConflict(els);
  const rest = [idea?.premise, idea?.price, idea?.twist, idea?.closer, ...(idea?.examples ?? [])].join(" ");
  const base = els.reduce((a, e) => a + (mentions(idea?.opener, e) ? 2 : 0) + (mentions(rest, e) ? 1 : 0), 0);
  // the conflict stated in the opener, ended by the twist; the premise's descriptors kept
  const descriptors = els.reduce((a, e) => a + (e.descriptors?.length ?? 0), 0) - droppedDescriptors(els, idea?.opener).length;
  return base + descriptors + (conflict ? (statesRelation(conflict, idea?.opener, { withAgent: true }) ? 2 : 0) + (resolvesConflict(conflict, idea?.twist ?? "") ? 1 : 0) : 0);
}

/**
 * Topic ideas ranked by fidelity (best first); ideas whose opener doesn't state the topic (its elements, and its conflict
 * with the threat) are dropped while at least one that does remains.
 */
export function rankTopicIdeas(topic, ideas) {
  const els = topicElements(topic), conflict = topicConflict(els);
  if (!els.length) return ideas;
  const scored = ideas.map((idea, i) => ({ idea, i, score: ideaFidelity(topic, idea), ok: !ruleMissing(els, idea.opener).length && statesRelation(conflict, idea.opener, { withAgent: true }) }));
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
    ...conflictLines(topic),
  ].join("\n");
}

/**
 * The premise's conflict as the story's spine (ideas, beats, script prompts): who does what to whom, its descriptors,
 * and how each part serves it. [] when the topic names no conflict verb (its descriptors still get a line).
 */
export function conflictLines(topic) {
  const els = topicElements(topic), conflict = topicConflict(els);
  const desc = els.filter((e) => e.descriptors?.length);
  const out = [];
  if (conflict) {
    const who = conflict.agents.map(named).join(" and ") || "the threat";
    const r = conflict.relation.words[0];
    out.push(`- THE CONFLICT IS THE SPINE (who: the ${who} | does: ${r} | to whom: ${conflict.target ? `the ${named(conflict.target)}` : "-"}). The first line states this conflict with the threat as the subject. The tour shows what the ${r} costs, "until" brings it to the narrator's door in three visible steps, the climax ENDS it (the threat is beaten, tricked, trapped, escaped or driven off with the planted object or the rule) and the closer shows the world after it.`);
    out.push(`- The tone may be funny, the premise stays: never turn the threat into a friend, a guest or a gag (feeding it, a dinner, a deal, a chore) that cancels the ${r} instead of ending it. The stakes stay real: if the threat wins, the ${conflict.target ? named(conflict.target) : "world"} and everyone in it are lost.`);
  }
  if (desc.length) out.push(`- Keep the idea's own descriptors: ${desc.map((e) => `"${named(e)}"`).join(", ")}. They set its scale and tone; say them in the first line.`);
  return out;
}
