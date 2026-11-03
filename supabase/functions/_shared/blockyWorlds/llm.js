// Blocky Worlds: the Claude calls, one function per protocol step (docs/blocky-worlds-protocol.md). fetch only, like the
// other templates' llm.js. JSON comes back through structured outputs (output_config.format): Sonnet 5.5 refuses a forced
// tool_choice, so the other templates' forced-tool pattern is not used here.
//
// Mock mode (BLOCKY_WORLDS_LLM=mock on the server, or provider "mock"): no network, no cost. Every step answers from
// examples.js, so the whole flow and the library job can be run for free.
import { MODELS, targetWords } from "./config.js";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "./examples.js";
import { batchPrompt, ideasSchema, IDEAS_SYSTEM, slotsPrompt, topicPrompt, usableIdeas, normalizeIdea } from "./ideas.js";
import { checkScript, normalizeScript, OPENER_SYSTEM, openerOk, openerPrompt, openerSchema, paceClean, PART_IDS, partBudgets, scriptPrompt, scriptSchema, SCRIPT_SYSTEM } from "./script.js";
import { hasOpener } from "./opener.js";
import { judgePrompt, judgeSchema, JUDGE_SYSTEM, RUBRIC, scoreVerdict } from "./library.js";
import { beatProblems, beatsPrompt, beatsSchema, BEATS_SYSTEM, callbackProblem, cardFromScriptPrompt, CARD_FROM_SCRIPT_SYSTEM, cardProblems, propProblems, shotProblems, shotsPrompt, shotsSchema, SHOTS_SYSTEM } from "./protocol.js";

// USD per 1M tokens (Anthropic list prices, checked 2026-11-03). Cache writes 1.25x input, reads 0.1x.
export const PRICE = Object.freeze({
  "claude-sonnet-5-5": Object.freeze({ input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5 }),
  "claude-haiku-5-5": Object.freeze({ input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 }),
});
export const costOf = (model, u = {}) => {
  const p = PRICE[model] ?? PRICE["claude-sonnet-5-5"];
  return Number((((u.input_tokens ?? 0) * p.input + (u.output_tokens ?? 0) * p.output + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1e6).toFixed(5));
};

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
// seed 0: the hand-written examples (the UI flow); later seeds: synthetic ideas from word lists, each its own rule, so the
// library job's dedup, judge and ranking can be exercised for free
const THINGS = ["umbrella", "mailbox", "lighthouse", "scarecrow", "fountain", "kite", "piano", "snowglobe", "lantern", "bicycle", "teapot", "clocktower", "billboard", "carousel", "weathervane", "doorbell", "treehouse", "jukebox"];
const DOINGS = ["follows the last person who laughed", "remembers every lie told near it", "swaps places with you at midnight", "grows one size for every secret", "sings the name of whoever is lost", "only works for the saddest kid in town", "eats one shadow every full moon", "rings when someone is about to move away", "keeps the town's missing socks", "points at whoever broke the rule"];
const PRICES_M = ["you lose your shadow for a week", "your house forgets your name", "every clock you own runs backwards", "your voice turns into birdsong", "you wake up on the roof", "your dog moves next door", "it follows you to school"];
const TWISTS_M = ["it was protecting the town from something worse", "the rule was written by a lonely kid long ago", "the mayor broke the rule first", "it only obeys whoever is kindest", "the narrator's grandma built it", "it was asleep the whole time", "the warning sign was upside down"];
const mockIdea = (slot, n) => {
  const thing = THINGS[n % THINGS.length], doing = DOINGS[Math.floor(n / THINGS.length) % DOINGS.length];
  const price = PRICES_M[(n * 3) % PRICES_M.length], twist = TWISTS_M[(n * 5) % TWISTS_M.length];
  return {
    opener: `In this town, the old ${thing} ${doing}.`, title: `The ${thing[0].toUpperCase()}${thing.slice(1)}`,
    premise: `A whole town plans its day around the ${thing}, and one kid is the only person it ignores.`,
    price: `Cross the ${thing} and ${price}.`,
    examples: [`Mr. Ortiz built a fence around his ${thing}.`, `The baker sings to the ${thing} at dawn.`, `School closes when the ${thing} sulks.`],
    narrator: `Remy, the one kid the ${thing} never notices.`, prop: `a chipped ${thing} key`,
    twist: `Turns out ${twist}, and the chipped ${thing} key proves it.`,
    teaser: `It noticed everyone except me.`, closer: `Now the ${thing} only listens to me.`,
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
const MOCK = Object.freeze({
  ideas: async ({ seed, slots }) => ({ data: { ideas: mockIdeas(slots, seed) }, costUsd: 0 }),
  script: async () => ({ data: JSON.parse(JSON.stringify(EXAMPLE_SCRIPT)), costUsd: 0 }),
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
  return { ideas: usableIdeas(reply.data, slots, provider === "mock" ? [] : avoid), costUsd: reply.costUsd };
}

/**
 * The library job's writer: ideas for planned slots (library.js planSlots). Returns { ideas, dropped, costUsd }: ideas that
 * fail the code checks are dropped here (dedup and the judge come after, in the job).
 * @param {{apiKey?: string, provider?: string, slots: object[], avoid?: string[], seed?: number}} input
 */
export async function writeLibraryIdeas({ apiKey = "", provider = "anthropic", slots, avoid = [], seed = 1 }) {
  const reply = provider === "mock"
    ? await MOCK.ideas({ seed, slots })
    : await callJson({ apiKey, model: MODELS.library, system: IDEAS_SYSTEM, user: slotsPrompt(slots, avoid), schema: ideasSchema(), effort: "medium", timeoutMs: 180_000 });
  const ideas = usableIdeas(reply.data, slots);
  return { ideas, dropped: Math.max(0, (reply.data?.ideas?.length ?? 0) - ideas.length), costUsd: reply.costUsd };
}

/**
 * The AI judge: one verdict per idea (library.js scoreVerdict decides). Returns { verdicts: [{score, accepted, ...}], costUsd }.
 * @param {{apiKey?: string, provider?: string, ideas: object[]}} input
 */
export async function judgeIdeas({ apiKey = "", provider = "anthropic", ideas }) {
  const reply = provider === "mock"
    ? await MOCK.judge({ ideas })
    : await callJson({ apiKey, model: MODELS.judge, system: JUDGE_SYSTEM, user: judgePrompt(ideas), schema: judgeSchema(), effort: "medium" });
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
  }
  return check;
}

/**
 * The script for a card (following its beat sheet when given): write, check, and one rewrite of this step only when the
 * checks find problems; the opener is repaired on its own if that is all that's wrong. Returns { script, check, costUsd,
 * attempts }. A script that still has problems comes back with them (it can't be generated until they're fixed).
 * @param {{apiKey?: string, provider?: string, idea: object, lengthSec: number, previous?: {lines: {part: string, text: string}[]} | null, note?: string, beats?: object[] | null}} input
 */
export async function writeScript({ apiKey = "", provider = "anthropic", idea, lengthSec, previous = null, note = "", beats = null }) {
  let costUsd = 0, attempts = 0, script = null, check = null, prev = previous, extra = note;
  for (let round = 1; round <= 2; round++) {
    attempts++;
    const reply = provider === "mock"
      ? await MOCK.script()
      : await callJson({ apiKey, model: MODELS.script, system: SCRIPT_SYSTEM, user: scriptPrompt({ idea, lengthSec, previous: prev, note: extra, beats }), schema: scriptSchema(), effort: "medium", timeoutMs: 180_000 });
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
    if (!check.problems.length) break;
    prev = script;
    extra = `${note ? `${note}\n` : ""}FIX THESE PROBLEMS:\n${check.problems.map((p) => `- ${p}`).join("\n")}`;
  }
  return { script, check, costUsd: Number(costUsd.toFixed(5)), attempts, words: targetWords(lengthSec) };
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
