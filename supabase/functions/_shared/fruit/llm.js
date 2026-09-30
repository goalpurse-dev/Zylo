// LLM calls for AI Fruit Story v2 (Deno + node: fetch only). Both providers
// get the same system prompt, user prompt and JSON schema, and return
// {data, usage, costUsd, request, response, httpStatus, latencyMs}.
// Every call is meant to be logged (fruit_ai_calls) by the caller with these
// exact request/response bodies.

// USD per 1M tokens (confirmed Sep 2026; same figures the Long Form code uses).
export const LLM_PRICES = Object.freeze({
  "claude-sonnet-5": { input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5 },
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
 *          schema:object, name:string, maxOutputTokens?:number, timeoutMs?:number}} opts
 */
export async function callLlm(opts) {
  return opts.provider === "anthropic" ? callAnthropic(opts) : callOpenAI(opts);
}

async function callAnthropic({ model, apiKey, system, user, schema, name, maxOutputTokens = 6000, timeoutMs = 90_000 }) {
  const request = {
    model,
    max_tokens: maxOutputTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],   // fixed rules: cached
    messages: [{ role: "user", content: user }],
    tools: [{ name, description: "Return the result.", input_schema: schema }],
    tool_choice: { type: "tool", name },
  };
  const { httpStatus, response, latencyMs } = await post("https://api.anthropic.com/v1/messages",
    { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, request, timeoutMs);
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
