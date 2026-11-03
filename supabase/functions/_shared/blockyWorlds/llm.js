// Blocky Worlds: the Claude calls (ideas, topic ideas, the script, the opener repair). fetch only, like the other
// templates' llm.js. JSON comes back through structured outputs (output_config.format): Sonnet 5.5 refuses a forced
// tool_choice, so the other templates' forced-tool pattern is not used here.
//
// Mock mode (BLOCKY_WORLDS_LLM=mock on the server, or provider "mock"): no network, no cost. The ideas and the script
// come from examples.js, so the whole flow (idea -> script -> settings -> generate) can be clicked through for free.
import { MODELS } from "./config.js";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "./examples.js";
import { batchPrompt, ideasSchema, IDEAS_SYSTEM, topicPrompt, usableIdeas } from "./ideas.js";
import { checkScript, normalizeScript, OPENER_SYSTEM, openerOk, openerPrompt, openerSchema, paceClean, scriptPrompt, scriptSchema, SCRIPT_SYSTEM } from "./script.js";
import { hasOpener } from "./opener.js";

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
const mockIdeas = (slots, seed) => slots.map((slot, i) => {
  const base = EXAMPLE_IDEAS[(seed + i) % EXAMPLE_IDEAS.length];
  return { ...base, formula: slot.formula, twistType: slot.twist, mood: slot.mood };
});
const MOCK = Object.freeze({
  ideas: async ({ seed, slots }) => ({ data: { ideas: mockIdeas(slots, seed) }, costUsd: 0 }),
  script: async () => ({ data: JSON.parse(JSON.stringify(EXAMPLE_SCRIPT)), costUsd: 0 }),
  opener: async ({ line }) => ({ data: { line: hasOpener(line) ? line : `In this town, ${line.charAt(0).toLowerCase()}${line.slice(1)}` }, costUsd: 0 }),
});

/** The provider to use: "mock" (free) or "anthropic" (real). */
export const providerFrom = (env) => (String(env ?? "").trim().toLowerCase() === "mock" ? "mock" : "anthropic");

/**
 * A batch of "Pick an idea" cards: { ideas, costUsd }. Ideas that fail the checks are dropped, never shown.
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
 * "Your topic": three ideas built around the user's topic.
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
 * Rewrite only the first line so it passes the opener rule (one small call). Returns the line or null.
 * @param {{apiKey?: string, provider?: string, line: string, next?: string}} input
 */
export async function repairOpener({ apiKey = "", provider = "anthropic", line, next = "" }) {
  const reply = provider === "mock"
    ? await MOCK.opener({ line })
    : await callJson({ apiKey, model: MODELS.opener, system: OPENER_SYSTEM, user: openerPrompt(line, next), schema: openerSchema(), effort: "low", maxTokens: 2000 });
  const fixed = paceClean(String(reply.data?.line ?? ""));
  return { line: openerOk(fixed) ? fixed : null, costUsd: reply.costUsd };
}

/**
 * The script for an idea: write, check, and one rewrite when the checks find problems; the opener is repaired on its own
 * if that is all that's wrong. Returns { script, check, costUsd, attempts }. A script that still has problems after the
 * rewrite comes back with them (the page shows them; it can't be generated until they're fixed).
 * @param {{apiKey?: string, provider?: string, idea: object, lengthSec: number, previous?: {lines: {part: string, text: string}[]} | null, note?: string}} input
 */
export async function writeScript({ apiKey = "", provider = "anthropic", idea, lengthSec, previous = null, note = "" }) {
  let costUsd = 0, attempts = 0, script = null, check = null, prev = previous, extra = note;
  for (let round = 1; round <= 2; round++) {
    attempts++;
    const reply = provider === "mock"
      ? await MOCK.script()
      : await callJson({ apiKey, model: MODELS.script, system: SCRIPT_SYSTEM, user: scriptPrompt({ idea, lengthSec, previous: prev, note: extra }), schema: scriptSchema(), effort: "medium", timeoutMs: 180_000 });
    costUsd += reply.costUsd;
    script = normalizeScript(reply.data);
    check = checkScript(script, lengthSec, "written");
    if (provider === "mock") check = { ...check, warnings: [...check.warnings, ...check.problems.map((p) => `(mock) ${p}`)], problems: [] };
    const onlyOpener = check.problems.length === 1 && /^The first line must start/.test(check.problems[0]);
    if (onlyOpener) {
      const fix = await repairOpener({ apiKey, provider, line: script.lines[0].text, next: script.lines[1]?.text ?? "" });
      costUsd += fix.costUsd;
      if (fix.line) {
        script.lines[0] = { ...script.lines[0], text: fix.line };
        check = checkScript(script, lengthSec, "written");
      }
    }
    if (!check.problems.length) break;
    prev = script;
    extra = `${note ? `${note}\n` : ""}FIX THESE PROBLEMS:\n${check.problems.map((p) => `- ${p}`).join("\n")}`;
  }
  return { script, check, costUsd: Number(costUsd.toFixed(5)), attempts };
}
