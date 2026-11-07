// Blocky Worlds: the Claude calls, one function per protocol step (docs/blocky-worlds-protocol.md). fetch only, like the
// other templates' llm.js. JSON comes back through structured outputs (output_config.format): Sonnet 5.5 refuses a forced
// tool_choice, so the other templates' forced-tool pattern is not used here.
//
// Mock mode (BLOCKY_WORLDS_LLM=mock on the server, or provider "mock"): no network, no cost. Every step answers from
// examples.js, so the whole flow and the library job can be run for free.
import { MODELS, targetWords } from "./config.js";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "./examples.js";
import { batchPrompt, ideasSchema, IDEAS_SYSTEM, REVISE_SYSTEM, revisePrompt, slotsPrompt, topicPrompt, usableIdeas, normalizeIdea } from "./ideas.js";
import { checkScript, normalizeScript, OPENER_SYSTEM, PART_FIX_SYSTEM, partFixPrompt, partFixSchema, openerOk, openerPrompt, openerSchema, paceClean, PART_IDS, partBudgets, scriptPrompt, scriptSchema, SCRIPT_SYSTEM, trimScript } from "./script.js";
import { fixOpener, hasOpener } from "./opener.js";
import { judgePrompt, judgeSchema, JUDGE_SYSTEM, RUBRIC, scoreVerdict } from "./library.js";
import { rankTopicIdeas, topicElements, topicProblems } from "./topic.js";
import { propReference, beatProblems, beatsPrompt, beatsSchema, BEATS_SYSTEM, callbackProblem, cardFromScriptPrompt, CARD_FROM_SCRIPT_SYSTEM, cardProblems, problemSpots, propProblems, shotProblems, shotsPrompt, shotsSchema, SHOTS_SYSTEM } from "./protocol.js";

// USD per 1M tokens (Anthropic list prices, checked 2026-11-03). Cache writes 1.25x input, reads 0.1x.
export const PRICE = Object.freeze({
  "claude-sonnet-5-5": Object.freeze({ input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5 }),
  "claude-haiku-5-5": Object.freeze({ input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 }),
});
export const costOf = (model, u = {}) => {
  const p = PRICE[model] ?? PRICE["claude-sonnet-5-5"];
  return Number((((u.input_tokens ?? 0) * p.input + (u.output_tokens ?? 0) * p.output + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1e6).toFixed(5));
};

/**
 * The library job's output ceilings (tokens, thinking included). They bound what one call can cost, so the job can stop
 * before any call that could pass its money cap (libraryJob.js worstCaseUsd).
 */
export const LIBRARY_MAX_TOKENS = Object.freeze({ write: 8000, judge: 6000 });
/** The most one call can cost (USD): every output token used, plus a generous input. */
export const worstCaseUsd = (model, maxTokens, inputTokens = 12000) => { const p = PRICE[model] ?? PRICE["claude-sonnet-5-5"]; return Number(((maxTokens * p.output + inputTokens * p.cacheWrite) / 1e6).toFixed(4)); };

/** One call that returns JSON matching `schema`. Thinking stays adaptive; effort keeps it short. */
async function callJson({ apiKey, model, system, user, schema, effort = "low", maxTokens = 16000, timeoutMs = 120_000 }) {
  const sonnet = model.startsWith("claude-sonnet-5-5");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json",
      // a policy decline on Sonnet 5.5 is re-run on a fallback model inside the same call (server-side)
      ...(sonnet ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { effort, format: { type: "json_schema", schema } },
      ...(sonnet ? { fallbacks: "default" } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => null);
  const costUsd = costOf(body?.model ?? model, body?.usage);
  if (!res.ok) {
    const balance = res.status === 400 && /credit balance/i.test(JSON.stringify(body?.error ?? ""));
    throw Object.assign(new Error(`anthropic ${res.status} ${JSON.stringify(body?.error ?? body).slice(0, 300)}`), { costUsd, balance });
  }
  if (body?.stop_reason === "refusal") throw Object.assign(new Error("REFUSED: the writer declined this one"), { costUsd, refused: true });
  if (body?.stop_reason === "max_tokens") throw Object.assign(new Error("output truncated"), { costUsd });
  const text = (body?.content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("");
  try {
    return { data: JSON.parse(text), costUsd };
  } catch {
    throw Object.assign(new Error("the reply was not JSON"), { costUsd });
  }
}

// ---------- the free mock provider ----------
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
// seed 0: the hand-written examples (the UI flow); later seeds: synthetic ideas, one per rule below (each its own thing
// and its own rule, never one rule with the noun swapped), repeating after the list, so the library job's dedup, judge
// and ranking can be exercised for free
const RULES = [
  ["umbrella", "opens by itself whenever somebody tells a lie"], ["mailbox", "delivers letters from next Tuesday"],
  ["lighthouse", "shines on whoever is most homesick"], ["scarecrow", "trades hats with the bravest farmer at dawn"],
  ["kite", "pulls its owner up to the clouds when they giggle"], ["piano", "plays your worst memory out loud on Sundays"],
  ["snowglobe", "shakes the real weather every time it is dropped"], ["bicycle", "pedals backwards through yesterday"],
  ["teapot", "pours whatever its holder truly wishes for"], ["clocktower", "steals one minute from every sleepy kid"],
  ["billboard", "prints the mayor's private diary each morning"], ["carousel", "turns riders into the animal they sit on"],
  ["weathervane", "points toward someone about to cry"], ["doorbell", "answers back in grandpa's voice"],
  ["treehouse", "grows another floor for each friend made"], ["jukebox", "chooses which neighbor must dance at noon"],
  ["bathtub", "drains into the ocean under the school"], ["vending machine", "only takes compliments as coins"],
  ["crosswalk", "moves to wherever the fastest runner stands"], ["trampoline", "bounces kids into tomorrow's homework"],
  ["sandbox", "buries one forgotten birthday wish each night"], ["chimney", "breathes out dreams the town had"],
  ["shopping cart", "races every shopper home after closing"], ["garden gnome", "collects the names of rude neighbors"],
];
const PRICES_M = ["you lose your shadow for a week", "your house forgets your name", "every clock you own runs backwards", "your voice turns into birdsong", "you wake up on the roof", "your dog moves next door", "it follows you to school"];
const TWISTS_M = ["it was protecting the town from something worse", "the rule was written by a lonely kid long ago", "the mayor broke the rule first", "it only obeys whoever is kindest", "the narrator's grandma built it", "it was asleep the whole time", "the warning sign was upside down"];
const mockIdea = (slot, n) => {
  const [thing, doing] = RULES[n % RULES.length];
  const price = PRICES_M[(n * 3) % PRICES_M.length], twist = TWISTS_M[(n * 5) % TWISTS_M.length];
  return {
    opener: `In this town, the old ${thing} ${doing}.`, title: `The ${thing[0].toUpperCase()}${thing.slice(1)}`,
    premise: `A whole town plans its day around the ${thing}, and one kid is the only person it ignores.`,
    price: `Cross the ${thing} and ${price}.`,
    examples: [`Mr. Ortiz built a fence around his ${thing}.`, `The baker sings to the ${thing} at dawn.`, `School closes when the ${thing} sulks.`],
    narrator: `Remy, the one kid the ${thing} never notices.`, prop: `a chipped ${thing} key`,
    twist: `Turns out ${twist}, and the chipped ${thing} key proves it.`,
    teaser: [`Nobody warned me about the ${thing}.`, `The ${thing} picked the wrong kid.`, `I was the only one it skipped.`, `Then the ${thing} looked at me.`][n % 4], closer: `Now the ${thing} only listens to me.`,
    formula: slot.formula, twistType: slot.twist, mood: slot.mood, setting: slot.setting ?? "town square",
  };
};
const mockIdeas = (slots, seed) => slots.map((slot, i) => (seed > 0
  ? mockIdea(slot, seed * slots.length + i)
  : { ...EXAMPLE_IDEAS[i % EXAMPLE_IDEAS.length], formula: slot.formula, twistType: slot.twist, mood: slot.mood, ...(slot.setting ? { setting: slot.setting } : {}) }));
const mockBeats = (card) => {
  const uses = { rule: ["rule"], tour: ["price", "example1", "example2", "example3"], me: ["exception", "prop_setup"], until: ["escalation1", "escalation2", "escalation3"], discovery: ["truth"], climax: ["prop_payoff", "twist"], closer: ["closer"] };
  const say = { rule: card.opener, tour: `${card.price} ${card.examples.join(" ")}`, me: `${card.narrator} Carries ${card.prop}.`, until: "Until one night, the rule breaks in three visible steps.", discovery: "The hidden truth about the rule.", climax: `${card.prop} wins. ${card.twist}`, closer: card.closer };
  return PART_IDS.map((part) => ({ part, summary: say[part], shows: `${card.setting}: ${say[part]}`.slice(0, 160), words: 0, uses: uses[part] }));
};
/**
 * The mock script sized to a length: the example script's lines, part by part, cycled or cut to each part's budget, so a
 * free test at any length (30 s to 3 min) gets a script that passes its own checks.
 */
export function mockScriptFor(lengthSec) {
  const budgets = partBudgets(lengthSec), target = targetWords(lengthSec);
  const count = (ls) => ls.reduce((a, l) => a + l.text.split(/\s+/).length, 0);
  const lines = [];
  for (const b of budgets) {
    const pool = EXAMPLE_SCRIPT.lines.filter((l) => l.part === b.id);
    if (b.id === "rule") { lines.push({ ...pool[0] }); continue; }
    const part = [];
    for (let i = 0; !part.length || count(part) + pool[i % pool.length].text.split(/\s+/).length <= b.words; i++) part.push({ ...pool[i % pool.length] });
    lines.push(...part);
  }
  // the total into the middle of the band: drop or repeat climax lines (a part always keeps one)
  const climax = EXAMPLE_SCRIPT.lines.filter((l) => l.part === "climax");
  for (let k = 0; count(lines) < target * 0.94 && k < 200; k++) {
    const at = lines.findLastIndex((l) => l.part === "climax");
    lines.splice(at + 1, 0, { ...climax[k % climax.length] });
  }
  while (count(lines) > target) {
    const at = lines.findLastIndex((l, i) => l.part !== "rule" && lines.filter((m) => m.part === l.part).length > 1 && i > 0);
    if (at < 0) break;
    lines.splice(at, 1);
  }
  return { ...JSON.parse(JSON.stringify(EXAMPLE_SCRIPT)), lines };
}
const MOCK = Object.freeze({
  ideas: async ({ seed, slots }) => ({ data: { ideas: mockIdeas(slots, seed) }, costUsd: 0 }),
  script: async ({ lengthSec = 90 } = {}) => ({ data: mockScriptFor(lengthSec), costUsd: 0 }),
  opener: async ({ line }) => ({ data: { line: hasOpener(line) ? line : `In this town, ${line.charAt(0).toLowerCase()}${line.slice(1)}` }, costUsd: 0 }),
  // a repeatable spread of scores: about half pass
  judge: async ({ ideas }) => ({ data: { verdicts: ideas.map((i) => { const h = hash(i.opener); return { scores: Object.fromEntries(RUBRIC.map((c, k) => [c.id, 2 + ((h >> k) % 4)])), safe: true, better: "(mock) sharpen the examples" }; }) }, costUsd: 0 }),
  card: async ({ lines }) => ({ data: { ...EXAMPLE_IDEAS[0], opener: hasOpener(lines[0]?.text ?? "") ? lines[0].text : EXAMPLE_IDEAS[0].opener, closer: lines.at(-1)?.text ?? EXAMPLE_IDEAS[0].closer }, costUsd: 0 }),
  beats: async ({ card, lengthSec }) => ({ data: { beats: mockBeats(card).map((b) => ({ ...b, words: partBudgets(lengthSec).find((p) => p.id === b.part).words })) }, costUsd: 0 }),
  shots: async ({ script }) => ({ data: { shots: script.lines.map((l, i) => ({ line: i, camera: i === 0 ? "wide_establishing" : ["medium", "closeup_face", "low_angle_threat", "over_shoulder", "insert_prop"][i % 5], set: "suburb street", light: l.part === "until" || l.part === "discovery" ? "night" : "day", fx: "none", characters: [{ who: "narrator", action: "idle", expr: "neutral" }], sign: "" })) }, costUsd: 0 }),
});

/** The provider to use: "mock" (free) or "anthropic" (real). */
export const providerFrom = (env) => (String(env ?? "").trim().toLowerCase() === "mock" ? "mock" : "anthropic");

// ---------- ideas ----------
/**
 * A batch of "Pick an idea" cards written live: { ideas, costUsd }. Used only when a user has seen the whole library.
 * @param {{apiKey?: string, provider?: string, seed?: number, mood?: string | null, avoid?: string[]}} input
 */
export async function writeIdeas({ apiKey = "", provider = "anthropic", seed = 0, mood = null, avoid = [] }) {
  const { slots, text } = batchPrompt({ seed, mood, avoid });
  const reply = provider === "mock"
    ? await MOCK.ideas({ seed, slots })
    : await callJson({ apiKey, model: MODELS.ideas, system: IDEAS_SYSTEM, user: text, schema: ideasSchema(), effort: "low" });
  return { ideas: usableIdeas(reply.data, slots, provider === "mock" ? [] : avoid), costUsd: reply.costUsd };
}

/**
 * "Your topic": three complete idea cards built around the user's topic (missing pieces are filled in by the writer).
 * @param {{apiKey?: string, provider?: string, topic: string, mood?: string | null, seed?: number, avoid?: string[]}} input
 */
export async function writeTopicIdeas({ apiKey = "", provider = "anthropic", topic, mood = null, seed = 0, avoid = [] }) {
  const { slots, text } = topicPrompt({ topic, mood, seed, avoid });
  const reply = provider === "mock"
    ? await MOCK.ideas({ seed: seed + 3, slots })
    : await callJson({ apiKey, model: MODELS.ideas, system: IDEAS_SYSTEM, user: text, schema: ideasSchema(), effort: "low" });
  // the most faithful to the topic first; each card keeps the user's own words (card.topic: the script's core and its check)
  const ideas = rankTopicIdeas(topic, usableIdeas(reply.data, slots, provider === "mock" ? [] : avoid));
  return { ideas: ideas.map((idea) => ({ ...idea, topic: String(topic).slice(0, 200) })), costUsd: reply.costUsd };
}

/**
 * The library job's writer: ideas for planned slots (library.js planSlots). Returns { ideas, dropped, costUsd }: ideas that
 * fail the code checks are dropped here (dedup and the judge come after, in the job).
 * @param {{apiKey?: string, provider?: string, slots: object[], avoid?: string[], seed?: number}} input
 */
export async function writeLibraryIdeas({ apiKey = "", provider = "anthropic", slots, avoid = [], seed = 1 }) {
  const reply = provider === "mock"
    ? await MOCK.ideas({ seed, slots })
    : await callJson({ apiKey, model: MODELS.library, system: IDEAS_SYSTEM, user: slotsPrompt(slots, avoid), schema: ideasSchema(), effort: "medium", timeoutMs: 180_000, maxTokens: LIBRARY_MAX_TOKENS.write });
  const ideas = usableIdeas(reply.data, slots);
  return { ideas, dropped: Math.max(0, (reply.data?.ideas?.length ?? 0) - ideas.length), costUsd: reply.costUsd };
}

/**
 * One revision pass for near-miss ideas (each with the judge's note). Returns { ideas, costUsd }; ideas that fail the
 * code checks come back as null in their place.
 * @param {{apiKey?: string, provider?: string, items: {idea: object, note: string}[]}} input
 */
export async function reviseIdeas({ apiKey = "", provider = "anthropic", items }) {
  const reply = provider === "mock"
    ? { data: { ideas: items.map((it) => it.idea) }, costUsd: 0 }
    : await callJson({ apiKey, model: MODELS.library, system: REVISE_SYSTEM, user: revisePrompt(items), schema: ideasSchema(), effort: "medium", timeoutMs: 180_000, maxTokens: LIBRARY_MAX_TOKENS.write });
  const slots = items.map((it) => ({ formula: it.idea.formula, twist: it.idea.twistType }));
  const raw = reply.data?.ideas ?? [];
  const ideas = items.map((_, k) => { const ok = usableIdeas({ ideas: [raw[k]] }, [slots[k]]); return ok[0] ?? null; });
  return { ideas, costUsd: reply.costUsd };
}

/**
 * The AI judge: one verdict per idea (library.js scoreVerdict decides). Returns { verdicts: [{score, accepted, ...}], costUsd }.
 * @param {{apiKey?: string, provider?: string, ideas: object[]}} input
 */
export async function judgeIdeas({ apiKey = "", provider = "anthropic", ideas }) {
  const reply = provider === "mock"
    ? await MOCK.judge({ ideas })
    : await callJson({ apiKey, model: MODELS.judge, system: JUDGE_SYSTEM, user: judgePrompt(ideas), schema: judgeSchema(), effort: "medium", maxTokens: LIBRARY_MAX_TOKENS.judge });
  const raw = reply.data?.verdicts ?? [];
  return { verdicts: ideas.map((_, i) => scoreVerdict(raw[i])), costUsd: reply.costUsd };
}

// ---------- step 1: every source becomes a complete card ----------
/**
 * A pasted script turned into a complete idea card (one retry if the card fails the checks).
 * @param {{apiKey?: string, provider?: string, lines: {part?: string, text: string}[]}} input
 */
export async function cardFromScript({ apiKey = "", provider = "anthropic", lines }) {
  let costUsd = 0, card = null, problems = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const reply = provider === "mock"
      ? await MOCK.card({ lines })
      : await callJson({ apiKey, model: MODELS.card, system: CARD_FROM_SCRIPT_SYSTEM, user: cardFromScriptPrompt(lines) + (problems.length ? `\n\nFIX: ${problems.join("; ")}` : ""), schema: ideasSchema().properties.ideas.items, effort: "low" });
    costUsd += reply.costUsd;
    card = normalizeIdea(reply.data);
    problems = cardProblems(card);
    if (!problems.length) break;
  }
  return { card, problems, costUsd: Number(costUsd.toFixed(5)) };
}

// ---------- step 2: the beat sheet ----------
/**
 * The 7-part beat sheet for a card; a sheet that fails the checks is retried once (this step only).
 * @param {{apiKey?: string, provider?: string, card: object, lengthSec: number}} input
 */
export async function writeBeats({ apiKey = "", provider = "anthropic", card, lengthSec }) {
  let costUsd = 0, beats = [], problems = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const reply = provider === "mock"
      ? await MOCK.beats({ card, lengthSec })
      : await callJson({ apiKey, model: MODELS.beats, system: BEATS_SYSTEM, user: beatsPrompt(card, lengthSec) + (problems.length ? `\n\nFIX THESE PROBLEMS:\n${problems.map((p) => `- ${p}`).join("\n")}` : ""), schema: beatsSchema(), effort: "low" });
    costUsd += reply.costUsd;
    beats = reply.data?.beats ?? [];
    problems = beatProblems(beats);
    if (!problems.length) break;
  }
  return { beats, problems, costUsd: Number(costUsd.toFixed(5)) };
}

// ---------- step 3: the script ----------
/** Rewrite only the first line so it passes the opener rule (one small call). Returns the line or null.
 * @param {{apiKey?: string, provider?: string, line: string, next?: string}} input
 */
export async function repairOpener({ apiKey = "", provider = "anthropic", line, next = "" }) {
  const reply = provider === "mock"
    ? await MOCK.opener({ line })
    : await callJson({ apiKey, model: MODELS.opener, system: OPENER_SYSTEM, user: openerPrompt(line, next), schema: openerSchema(), effort: "low", maxTokens: 2000 });
  const fixed = paceClean(String(reply.data?.line ?? ""));
  return { line: openerOk(fixed) ? fixed : null, costUsd: reply.costUsd };
}

/** Every check a written script must pass: the script checks plus the protocol's (the prop pays off, the closer calls back). */
export function scriptProtocolCheck(script, lengthSec, card) {
  const check = checkScript(script, lengthSec, "written");
  if (card) {
    check.problems.push(...propProblems(card, script));
    const cb = callbackProblem(card, script);
    if (cb) check.problems.push(cb);
    // only a card from a typed topic carries card.topic (library ideas and pasted scripts have no user premise)
    if (card.topic) check.problems.push(...topicProblems(card.topic, script));
  }
  return check;
}

/**
 * The free length fix (script.js trimScript) with the card's protocol checks: a script over its length loses filler
 * words, then whole filler lines, never a change that breaks a check; the climax lines that name the planted object are
 * kept, and the card's twist, object and topic words weigh against dropping a line. Returns trimScript's result.
 */
export function trimForLength(script, lengthSec, card = null) {
  const climaxProp = (l) => Boolean(card?.prop) && l.part === "climax" && propReference(card.prop, l.text) !== null;
  return trimScript(script, lengthSec, {
    check: (s) => scriptProtocolCheck(s, lengthSec, card),
    keep: climaxProp,
    anchors: [card?.twist, card?.prop, card?.topic].filter(Boolean).join(" "),
  });
}

/**
 * The script for a card (following its beat sheet when given): write, check, and one rewrite of this step only when the
 * checks find problems; the opener is repaired on its own if that is all that's wrong, and a script that is only too
 * long is trimmed in code (trimForLength, free) before any paid rewrite. Returns { script, check, costUsd, attempts,
 * trimmed }. A script that still has problems comes back with them (it can't be generated until they're fixed).
 * @param {{apiKey?: string, provider?: string, idea: object, lengthSec: number, previous?: {lines: {part: string, text: string}[]} | null, note?: string, beats?: object[] | null}} input
 */
export async function writeScript({ apiKey = "", provider = "anthropic", idea, lengthSec, previous = null, note = "", beats = null, failed = [] }) {
  let costUsd = 0, attempts = 0, script = null, check = null, prev = previous, extra = note, trimmed = [];
  for (let round = 1; round <= 2; round++) {
    attempts++;
    const reply = provider === "mock"
      ? await MOCK.script({ lengthSec })
      : await callJson({ apiKey, model: MODELS.script, system: SCRIPT_SYSTEM, user: scriptPrompt({ idea, lengthSec, previous: prev, note: extra, beats, failed: round === 1 ? failed : [] }), schema: scriptSchema(), effort: "medium", timeoutMs: 180_000 });
    costUsd += reply.costUsd;
    script = normalizeScript(reply.data);
    check = scriptProtocolCheck(script, lengthSec, provider === "mock" ? null : idea);
    if (provider === "mock") check = { ...check, warnings: [...check.warnings, ...check.problems.map((p) => `(mock) ${p}`)], problems: [] };
    const onlyOpener = check.problems.length === 1 && /^The first line must start/.test(check.problems[0]);
    if (onlyOpener) {
      const fix = await repairOpener({ apiKey, provider, line: script.lines[0].text, next: script.lines[1]?.text ?? "" });
      costUsd += fix.costUsd;
      if (fix.line) {
        script.lines[0] = { ...script.lines[0], text: fix.line };
        check = scriptProtocolCheck(script, lengthSec, idea);
      }
    }
    // too long: the free trim first; the rewrite (paid) only for what it can't fix
    if (provider !== "mock" && check.problems.some((p) => /^Too long:/.test(p))) {
      const t = trimForLength(script, lengthSec, idea);
      if (t.changes.length) {
        const after = scriptProtocolCheck(t.script, lengthSec, idea);
        if (after.problems.length < check.problems.length) { script = t.script; check = after; trimmed = [...trimmed, ...t.changes]; }
      }
    }
    if (!check.problems.length) break;
    prev = script;
    extra = `${note ? `${note}\n` : ""}FIX THESE PROBLEMS:\n${check.problems.map((p) => `- ${p}`).join("\n")}`;
  }
  return { script, check, costUsd: Number(costUsd.toFixed(5)), attempts, words: targetWords(lengthSec), trimmed };
}

/** The checks a saved draft gets: ours (kind "written") with the protocol's, when its card is known; the user's own. */
export function draftCheck(script, lengthSec, kind = "written", card = null) {
  return kind === "written" ? scriptProtocolCheck(script, lengthSec, card) : checkScript(script, lengthSec, "own");
}

/** The free mock part fixer: the flagged lines, changed just enough to pass (names the object, calls back, splits). */
function mockFixPart({ script, indexes, reasons, card }) {
  let out = indexes.map((i) => script.lines[i].text);
  const first = (script.lines[0]?.text ?? "").replace(/^In this (world|town),\s*/i, "").split(/\s+/).map((w) => w.replace(/[^A-Za-z]/g, "")).find((w) => w.length > 4) ?? "rule";
  for (const r of reasons) {
    if (/never pays off/.test(r) && card?.prop) out = [`I grabbed ${card.prop} and held it up high.`, ...out.slice(1)];
    else if (/never shown before/.test(r) && card?.prop) out = [...out, `I always carried ${card.prop}.`];
    else if (/call back the first line/.test(r)) out = [...out.slice(0, -1), `Now I smile at every ${first.toLowerCase()}.`];
    else if (/^The story drifted from your idea/.test(r) && card?.topic) {
      const els = topicElements(card.topic), named = els.map((e) => e.words[0]).join(", ");
      out = /the first line /.test(r)
        ? [`In this world, ${String(card.topic).replace(/[.!?]+$/, "")}.`, ...out.slice(1)]
        : [`It was all about the ${named}.`, ...out.slice(1)];
    }
    else if (/^Line \d+ has/.test(r)) out = out.flatMap((t) => { const w = t.split(/\s+/); if (w.length <= 12) return [t]; const h = Math.ceil(w.length / 2); return [`${w.slice(0, h).join(" ").replace(/[,.]$/, "")}.`, w.slice(h).join(" ").replace(/^./, (c) => c.toUpperCase())]; });
    else if (/^Uses "([^"]+)"/.test(r)) { const word = r.match(/^Uses "([^"]+)"/)[1]; out = out.map((t) => t.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "something")); }
  }
  return { data: { lines: out }, costUsd: 0 };
}

/**
 * "Fix it" on a blocked script: rewrite ONLY the flagged lines (one part, or one line), keep every other line word for
 * word, re-check the whole script with the same checks, and retry once with what is still wrong. Returns { script,
 * check, fixed, costUsd, attempts }: fixed is true when no problem is left in that part and nothing new broke. The
 * caller saves the result only when it is better than before.
 * @param {{apiKey?: string, provider?: string, script: {title?: string, lines: {part: string, text: string}[], post?: object}, indexes: number[], reasons: string[], card?: object | null, lengthSec: number, kind?: string}} input
 */
export async function fixPart({ apiKey = "", provider = "anthropic", script, indexes, reasons, card = null, lengthSec, kind = "written" }) {
  // one part only: from the first flagged line to the last flagged line of that same part (never across parts)
  const from = Math.min(...indexes), part = script.lines[from].part, last = Math.max(...indexes);
  let to = from;
  while (to + 1 <= last && script.lines[to + 1]?.part === part) to++;
  const span = Array.from({ length: to - from + 1 }, (_, k) => from + k);
  const before = draftCheck(script, lengthSec, kind, card).problems;
  // the same problem with another number in it ("Too short: 280 words" -> "Too short: 290 words") is not a new one
  const key = (p) => p.replace(/\d+/g, "#"), had = new Set(before.map(key));
  let costUsd = 0, attempts = 0, best = null, why = reasons;
  for (let round = 1; round <= 2; round++) {
    attempts++;
    const reply = provider === "mock"
      ? mockFixPart({ script, indexes: span, reasons: why, card })
      : await callJson({ apiKey, model: MODELS.opener, system: PART_FIX_SYSTEM, user: partFixPrompt({ script, indexes: span, reasons: why, card }), schema: partFixSchema(), effort: "low", maxTokens: 4000, timeoutMs: 90_000 });
    costUsd += reply.costUsd;
    const fresh = (Array.isArray(reply.data?.lines) ? reply.data.lines : []).map((t) => paceClean(t)).filter((t) => t && t !== ".").slice(0, span.length + 6);
    if (!fresh.length) { why = [...reasons, "Return the replacement lines (at least one)."]; continue; }
    const lines = [...script.lines.slice(0, from), ...fresh.map((text) => ({ part, text })), ...script.lines.slice(to + 1)];
    if (from === 0) { const fixed = fixOpener(lines[0].text); if (fixed) lines[0] = { ...lines[0], text: fixed }; }
    const next = { ...script, lines };
    const check = draftCheck(next, lengthSec, kind, card);
    const here = problemSpots(next, check.problems).filter((s) => s.lines.some((i) => i >= from && i < from + fresh.length) || (s.part === part && s.fix !== "rewrite"));
    const fixed = !here.length && check.problems.length < before.length && check.problems.every((p) => had.has(key(p)));
    if (!best || check.problems.length < best.check.problems.length) best = { script: next, check, fixed };
    if (fixed) { best = { script: next, check, fixed }; break; }
    why = [...new Set([...here.map((s) => s.problem), ...check.problems.filter((p) => !had.has(key(p)))])];
    if (!why.length) why = reasons;
  }
  return { ...(best ?? { script, check: draftCheck(script, lengthSec, kind, card), fixed: false }), costUsd: Number(costUsd.toFixed(5)), attempts };
}

// ---------- step 4: the shot plan ----------
/**
 * The shot plan from the fixed vocabulary; a plan that fails the checks is retried once (this step only).
 * @param {{apiKey?: string, provider?: string, script: {lines: {part: string, text: string}[]}}} input
 */
export async function writeShots({ apiKey = "", provider = "anthropic", script }) {
  let costUsd = 0, shots = [], problems = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const reply = provider === "mock"
      ? await MOCK.shots({ script })
      : await callJson({ apiKey, model: MODELS.shots, system: SHOTS_SYSTEM, user: shotsPrompt(script) + (problems.length ? `\n\nFIX THESE PROBLEMS:\n${problems.map((p) => `- ${p}`).join("\n")}` : ""), schema: shotsSchema(), effort: "medium", timeoutMs: 180_000 });
    costUsd += reply.costUsd;
    shots = reply.data?.shots ?? [];
    problems = shotProblems(shots, script);
    if (!problems.length) break;
  }
  return { shots, problems, costUsd: Number(costUsd.toFixed(5)) };
}
