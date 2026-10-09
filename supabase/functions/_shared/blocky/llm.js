// LLM calls for Blocky Stories (Deno + node: fetch only). Both providers
// get the same system prompt, user prompt and JSON schema, and return
// {data, usage, costUsd, request, response, httpStatus, latencyMs}.
// Every call is meant to be logged (blocky_ai_calls) by the caller with these
// exact request/response bodies.

// USD per 1M tokens (confirmed Sep 2026; same figures the Long Form code uses).
export const LLM_PRICES = Object.freeze({
  "claude-sonnet-5": { input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5 },
  // The twist plan only (models.js#twistPlan). The figures the Long Form code records for this model.
  // Its thinking is billed as output.
  "claude-opus-5-5": { input: 4.0, output: 20.0, cacheRead: 0.4, cacheWrite: 5.0 },
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
  "gpt-5.6-sol": { input: 5.0, output: 30.0, cacheRead: 0.5, cacheWrite: 0 },
  "gpt-5-mini": { input: 0.25, output: 2.0, cacheRead: 0.025, cacheWrite: 0 },
});

/** usage: {inputTokens (uncached), outputTokens, cacheReadTokens, cacheWriteTokens} */
export function llmCostUsd(model, u) {
  const p = LLM_PRICES[model];
  if (!p) throw new Error(`no price for ${model}`);
  const usd = (u.inputTokens * p.input + u.outputTokens * p.output + (u.cacheReadTokens ?? 0) * p.cacheRead + (u.cacheWriteTokens ?? 0) * p.cacheWrite) / 1e6;
  return Number(usd.toFixed(6));
}

export class LlmError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

async function post(url, headers, body, timeoutMs) {
  const t0 = Date.now();
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep text */ }
  return { httpStatus: res.status, response: json ?? { raw: text.slice(0, 4000) }, latencyMs: Date.now() - t0 };
}

/**
 * @param {{provider:"anthropic"|"openai", model:string, apiKey:string, system:string, user:string,
 *          schema:object, name:string, maxOutputTokens?:number, timeoutMs?:number,
 *          tools?: {name:string, schema:object}[], strict?: boolean}} opts
 *   tools:  every tool the calls of one piece of work use, always in the same order; name picks the one to
 *           answer with. The cached prefix is the tools and then the system prompt, so a second call that
 *           answers with another tool still reads the cache.
 *   strict: the answer must match the schema exactly (Anthropic's strict tool use). Without it the writer
 *           left fields out or wrapped a list in a string in 2 of 5 drafts, each a paid repair.
 */
export async function callLlm(opts) {
  return opts.provider === "anthropic" ? callAnthropic(opts) : callOpenAI({ ...opts, schema: opts.tools?.find((t) => t.name === opts.name)?.schema ?? opts.schema });
}

/**
 * Models that refuse a forced tool call because their thinking is always on (the API answers 400:
 * 'tool_choice: type "tool" and "any" are not supported for this model'). They return the answer as JSON
 * text in the schema's shape instead: structured outputs, output_config.format.
 */
const JSON_OUTPUT_MODELS = /^claude-opus-5/;

/**
 * effort (JSON-output models only): how hard the model thinks before it answers ("low", "medium", "high").
 * Its thinking is billed as output and counts against maxOutputTokens.
 */
async function callAnthropicJson({ model, apiKey, system, user, schema, effort = null, maxOutputTokens = 8000, timeoutMs = 120_000 }) {
  const request = {
    model,
    max_tokens: maxOutputTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],   // fixed rules: cached
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema", schema }, ...(effort ? { effort } : {}) },
  };
  const { httpStatus, response, latencyMs } = await post("https://api.anthropic.com/v1/messages", { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, request, timeoutMs);
  const u = response?.usage ?? {};
  const usage = { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0, cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0 };
  const base = { request, response, httpStatus, latencyMs, usage, costUsd: llmCostUsd(model, usage) };
  if (httpStatus >= 400) throw new LlmError(`anthropic ${httpStatus}`, base);
  if (response?.stop_reason === "max_tokens") throw new LlmError("anthropic output truncated", base);
  if (response?.stop_reason === "refusal") throw new LlmError("anthropic refused", base);
  const text = (response?.content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("");
  let data;
  try { data = JSON.parse(text); } catch { throw new LlmError("anthropic returned no JSON", base); }
  return { ...base, data };
}

async function callAnthropic({ model, apiKey, system, user, schema, name, tools = null, strict = false, effort = null, maxOutputTokens = 6000, timeoutMs = 90_000 }) {
  if (JSON_OUTPUT_MODELS.test(model)) return callAnthropicJson({ model, apiKey, system, user, schema: tools?.find((t) => t.name === name)?.schema ?? schema, effort, ...(maxOutputTokens > 6000 ? { maxOutputTokens } : {}) });
  const build = (isStrict) => ({
    model,
    max_tokens: maxOutputTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],   // fixed rules: cached
    messages: [{ role: "user", content: user }],
    tools: (tools ?? [{ name, schema }]).map((t) => ({ name: t.name, description: "Return the result.", input_schema: t.schema, ...(isStrict ? { strict: true } : {}) })),
    tool_choice: { type: "tool", name },
  });
  const send = (body) => post("https://api.anthropic.com/v1/messages", { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body, timeoutMs);
  let request = build(strict);
  let { httpStatus, response, latencyMs } = await send(request);
  // The request was refused as written (a schema strict mode can't take, for one): once more without strict.
  // A refused request costs nothing, and the answer is checked in code either way.
  if (strict && httpStatus === 400) {
    console.error(`[blocky] strict tool use refused for ${name}: ${JSON.stringify(response?.error ?? response).slice(0, 300)}`);
    request = build(false);
    ({ httpStatus, response, latencyMs } = await send(request));
  }
  const u = response?.usage ?? {};
  const usage = { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0, cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0 };
  const base = { request, response, httpStatus, latencyMs, usage, costUsd: llmCostUsd(model, usage) };
  if (httpStatus >= 400) throw new LlmError(`anthropic ${httpStatus}`, base);
  if (response?.stop_reason === "max_tokens") throw new LlmError("anthropic output truncated", base);
  const block = (response?.content ?? []).find((b) => b?.type === "tool_use");
  if (!block) throw new LlmError("anthropic returned no tool_use", base);
  return { ...base, data: block.input };
}

async function callOpenAI({ model, apiKey, system, user, schema, name, maxOutputTokens = 12000, timeoutMs = 120_000, reasoningEffort = "low" }) {
  const request = {
    model,
    store: false,
    instructions: system,                     // identical prefix every call: OpenAI caches it automatically
    // user: a string, or Responses content parts (input_text + input_image for the picture check)
    input: Array.isArray(user) ? [{ role: "user", content: user }] : user,
    max_output_tokens: maxOutputTokens,
    ...(/^gpt-5/.test(model) ? { reasoning: { effort: reasoningEffort } } : {}),
    text: { format: { type: "json_schema", name, strict: true, schema } },
  };
  const { httpStatus, response, latencyMs } = await post("https://api.openai.com/v1/responses",
    { Authorization: `Bearer ${apiKey}` }, request, timeoutMs);
  const u = response?.usage ?? {};
  const cached = u.input_tokens_details?.cached_tokens ?? 0;
  const usage = { inputTokens: Math.max(0, (u.input_tokens ?? 0) - cached), outputTokens: u.output_tokens ?? 0, cacheReadTokens: cached, cacheWriteTokens: 0, reasoningTokens: u.output_tokens_details?.reasoning_tokens ?? 0 };
  const base = { request, response, httpStatus, latencyMs, usage, costUsd: llmCostUsd(model, usage) };
  if (httpStatus >= 400) throw new LlmError(`openai ${httpStatus}`, base);
  if (response?.status === "incomplete") throw new LlmError(`openai incomplete: ${response?.incomplete_details?.reason ?? "?"}`, base);
  const text = response?.output_text
    ?? (response?.output ?? []).flatMap((o) => o?.content ?? []).find((c) => c?.type === "output_text")?.text;
  let data;
  try { data = JSON.parse(text); } catch { throw new LlmError("openai returned no JSON", base); }
  return { ...base, data };
}
