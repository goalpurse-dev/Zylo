// Content Machine: Claude calls (fetch only, like the rest of this repo's Claude code). Every function here
// takes a ticket from the Budget Guard (budgetGuard.js) and refuses to run without one.
//
// Cost = tokens × the model's price + $0.01 per web search (usage.server_tool_use.web_search_requests).
// Batch requests pay half for tokens. Prices are USD per 1M tokens; CM_ANTHROPIC_PRICES (JSON) overrides.
import { assertTicket } from "../budgetGuard.js";

const API = "https://api.anthropic.com/v1";
const VERSION = "2023-06-01";

export const PRICES = Object.freeze({
  "claude-sonnet-5-5": { input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 4.0 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2 },
  "claude-opus-5-5": { input: 4.0, output: 20.0, cacheRead: 0.2, cacheWrite5m: 5.0, cacheWrite1h: 8.0 },
});
// A model we have no price for (e.g. a refusal fallback) is costed at the dearest one we know.
const UNKNOWN = PRICES["claude-opus-5-5"];
export const WEB_SEARCH_USD = 0.01;
export const WEB_SEARCH_TOOL = "web_search_20260209";

export function priceFor(model, overrides = null) {
  const table = { ...PRICES, ...(overrides ?? {}) };
  const key = Object.keys(table).find((k) => String(model ?? "").startsWith(k));
  return key ? table[key] : UNKNOWN;
}

/** USD for one response's usage. batch: tokens at half price (web searches are not discounted). */
export function costOfUsage(usage, model, { batch = false, prices = null } = {}) {
  const p = priceFor(model, prices);
  const u = usage ?? {};
  const write1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const write5m = u.cache_creation?.ephemeral_5m_input_tokens ?? Math.max(0, (u.cache_creation_input_tokens ?? 0) - write1h);
  const tokensUsd = ((u.input_tokens ?? 0) * p.input + (u.output_tokens ?? 0) * p.output + (u.cache_read_input_tokens ?? 0) * p.cacheRead
    + write5m * p.cacheWrite5m + write1h * p.cacheWrite1h) / 1e6;
  const searches = u.server_tool_use?.web_search_requests ?? 0;
  return round((batch ? tokensUsd / 2 : tokensUsd) + searches * WEB_SEARCH_USD);
}

/** A ceiling for the Budget Guard's reservation, from expected token counts and searches. */
export function estimateUsd({ model, inputTokens, outputTokens, searches = 0, batch = false, prices = null }) {
  const p = priceFor(model, prices);
  const tokensUsd = (inputTokens * p.input + outputTokens * p.output) / 1e6;
  return round((batch ? tokensUsd / 2 : tokensUsd) + searches * WEB_SEARCH_USD);
}

const round = (n) => Math.round(n * 1e6) / 1e6;

function headers(apiKey, betas = []) {
  const h = { "x-api-key": apiKey, "anthropic-version": VERSION, "content-type": "application/json" };
  if (betas.length) h["anthropic-beta"] = betas.join(",");
  return h;
}

/** The JSON object from a structured-output response (the last text block). */
export function jsonFromMessage(body) {
  const text = (body?.content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("").trim();
  if (!text) throw new Error("no text in the answer");
  try { return JSON.parse(text); } catch { throw new Error(`the answer was not valid JSON: ${text.slice(0, 200)}`); }
}

/**
 * One Messages call. Returns { body, costUsd, model }. Throws with .actualUsd set whenever the provider
 * may have billed (an HTTP error after the request left has cost 0; a truncated answer still cost tokens).
 */
export async function createMessage(ticket, { apiKey, request, betas = [], timeoutMs = 240_000, fetchImpl = fetch, prices = null }) {
  assertTicket(ticket, "anthropic");
  if (!apiKey) throw Object.assign(new Error("ANTHROPIC_API_KEY is not set"), { actualUsd: 0 });
  const res = await fetchImpl(`${API}/messages`, {
    method: "POST", headers: headers(apiKey, betas), body: JSON.stringify(request), signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => null);
  const model = body?.model ?? request.model;
  const costUsd = body?.usage ? costOfUsage(body.usage, model, { prices }) : 0;
  if (!res.ok) throw Object.assign(new Error(`anthropic ${res.status}: ${JSON.stringify(body?.error ?? body).slice(0, 300)}`), { actualUsd: costUsd, status: res.status });
  if (body?.stop_reason === "refusal") throw Object.assign(new Error(`refused (${body?.stop_details?.category ?? "no category"})`), { actualUsd: costUsd, refusal: true });
  if (body?.stop_reason === "max_tokens") throw Object.assign(new Error("the answer was cut off (max_tokens)"), { actualUsd: costUsd });
  return { body, costUsd, model };
}

/* ─── Message Batches (half price, answers within 24 h, usually minutes) ─── */

/** requests: [{custom_id, params}]. Returns the batch object ({id, processing_status, ...}). */
export async function createBatch(ticket, { apiKey, requests, fetchImpl = fetch }) {
  assertTicket(ticket, "anthropic");
  const res = await fetchImpl(`${API}/messages/batches`, {
    method: "POST", headers: headers(apiKey), body: JSON.stringify({ requests }), signal: AbortSignal.timeout(60_000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(`anthropic batch ${res.status}: ${JSON.stringify(body?.error ?? body).slice(0, 300)}`), { actualUsd: 0 });
  return body;
}

/** Reading a batch's state costs nothing (no ticket). */
export async function getBatch({ apiKey, batchId, fetchImpl = fetch }) {
  const res = await fetchImpl(`${API}/messages/batches/${encodeURIComponent(batchId)}`, { headers: headers(apiKey), signal: AbortSignal.timeout(30_000) });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`anthropic batch status ${res.status}`);
  return body;
}

/** The results file (JSONL), keyed by custom_id: {type, message?, error?, costUsd}. Free to read. */
export async function batchResults({ apiKey, resultsUrl, fetchImpl = fetch, prices = null }) {
  const res = await fetchImpl(resultsUrl, { headers: headers(apiKey), signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`anthropic batch results ${res.status}`);
  const out = {};
  for (const line of (await res.text()).split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    const r = row.result ?? {};
    const message = r.type === "succeeded" ? r.message : null;
    out[row.custom_id] = { type: r.type, message, error: r.error ?? null, costUsd: message?.usage ? costOfUsage(message.usage, message.model, { batch: true, prices }) : 0 };
  }
  return out;
}
