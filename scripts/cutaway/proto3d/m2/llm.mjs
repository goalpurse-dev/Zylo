// M2: the Claude calls of the planner (fetch only, as the other templates' llm.js). JSON replies through structured
// outputs (output_config.format); the web search server tool for the fact-check (pause_turn resumed). Every call is
// priced from its usage and appended to the spend log, so the BUILD_PLAN tally can be checked against it.
import fs from "node:fs";

export const MODEL = { default: "claude-sonnet-5-5", strong: "claude-opus-5-5" };
// USD per 1M tokens; web search $10 per 1,000 searches
const PRICE = { "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.2, cacheWrite: 2.5 }, "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2, cacheWrite: 5 } };
export function costOf(model, u = {}) {
  const p = PRICE[model];
  const tok = ((u.input_tokens ?? 0) * p.in + (u.output_tokens ?? 0) * p.out + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) / 1e6;
  return +(tok + (u.server_tool_use?.web_search_requests ?? 0) * 0.01).toFixed(5);
}

/** a streamed Messages reply rebuilt into the same shape as a plain one (long calls stay alive this way) */
async function readStream(res) {
  const msg = { content: [], usage: {}, stop_reason: null, stop_details: null };
  const dec = new TextDecoder(); let buf = "";
  const blocks = [];
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const ev = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = ev.split("\n").find((x) => x.startsWith("data: "));
      if (!line) continue;
      const e = JSON.parse(line.slice(6));
      if (e.type === "message_start") Object.assign(msg.usage, e.message.usage);
      else if (e.type === "content_block_start") { blocks[e.index] = { ...e.content_block }; if (blocks[e.index].type === "server_tool_use" || blocks[e.index].type === "tool_use") blocks[e.index]._json = ""; }
      else if (e.type === "content_block_delta") {
        const b = blocks[e.index], d = e.delta;
        if (d.type === "text_delta") b.text = (b.text ?? "") + d.text;
        else if (d.type === "thinking_delta") b.thinking = (b.thinking ?? "") + d.thinking;
        else if (d.type === "signature_delta") b.signature = (b.signature ?? "") + d.signature;
        else if (d.type === "input_json_delta") b._json += d.partial_json;
        else if (d.type === "citations_delta") (b.citations ??= []).push(d.citation);
      } else if (e.type === "content_block_stop") { const b = blocks[e.index]; if (b && "_json" in b) { b.input = b._json ? JSON.parse(b._json) : {}; delete b._json; } }
      else if (e.type === "message_delta") { msg.stop_reason = e.delta.stop_reason ?? msg.stop_reason; msg.stop_details = e.delta.stop_details ?? msg.stop_details; Object.assign(msg.usage, e.usage ?? {}); }
      else if (e.type === "error") throw new Error(`stream error: ${JSON.stringify(e.error)}`);
    }
  }
  msg.content = blocks.filter(Boolean);
  return msg;
}

export function loadKey(envFile = "C:/Users/Public/Zylo/.env.local") {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.*)\s*$/); if (m) return m[1].replace(/^["']|["']$/g, ""); }
  throw new Error("no ANTHROPIC_API_KEY");
}

/**
 * One planner call with a JSON reply (schema null: a text reply). search: max web searches (0 = none). Returns { data, costUsd, usage, searches }.
 * log: the spend log file (one JSON line per call).
 */
export async function callJSON({ apiKey, model = MODEL.default, system, user, schema, search = 0, effort = "high", maxTokens = 32000, label, log, timeoutMs = 600_000 }) {
  const body = {
    model, max_tokens: maxTokens, stream: true,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: schema ? { effort, format: { type: "json_schema", schema } } : { effort },
    ...(search ? { tools: [{ type: "web_search_20260209", name: "web_search", max_uses: search }] } : {}),
  };
  let cost = 0, searches = 0, usage = null, reply = null;
  for (let turn = 0; turn < 6; turn++) {
    // a dropped connection (ECONNRESET, a timeout) is retried twice; it is logged, as it may have been billed
    // a dropped connection (ECONNRESET, a timeout, a sleeping laptop), while sending or while the reply streams in,
    // is retried twice; it is logged with an unknown cost, as a call cut off mid-reply may still be billed
    let res, r;
    for (let k = 0; ; k++) {
      try {
        res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
        r = res.ok ? await readStream(res) : await res.json().catch(() => null);
        break;
      } catch (e) {
        if (log) fs.appendFileSync(log, `${JSON.stringify({ at: new Date().toISOString(), label, model, status: "network", error: String(e.cause?.code ?? e.message), costUsd: null })}\n`);
        if (k >= 2) throw e;
        await new Promise((ok) => setTimeout(ok, 8000));
      }
    }
    const c = r?.usage ? costOf(model, r.usage) : 0;
    cost += c; searches += r?.usage?.server_tool_use?.web_search_requests ?? 0; usage = r?.usage ?? usage;
    if (log) fs.appendFileSync(log, `${JSON.stringify({ at: new Date().toISOString(), label, model, status: res.status, stop: r?.stop_reason, usage: r?.usage, costUsd: c })}\n`);
    if (!res.ok) throw Object.assign(new Error(`anthropic ${res.status} ${JSON.stringify(r?.error ?? r).slice(0, 400)}`), { costUsd: cost });
    if (r.stop_reason === "pause_turn") { body.messages = [{ role: "user", content: user }, { role: "assistant", content: r.content }]; continue; }
    if (r.stop_reason === "refusal") throw Object.assign(new Error(`refused: ${JSON.stringify(r.stop_details)}`), { costUsd: cost });
    if (r.stop_reason === "max_tokens") throw Object.assign(new Error("reply cut off (max_tokens)"), { costUsd: cost });
    reply = r; break;
  }
  if (!reply) throw Object.assign(new Error("no reply after 6 turns"), { costUsd: cost });
  const text = reply.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  const sources = reply.content.filter((b) => b.type === "web_search_tool_result" && Array.isArray(b.content)).flatMap((b) => b.content.map((x) => ({ url: x.url, title: x.title })));
  if (!schema) return { data: { text, sources }, costUsd: +cost.toFixed(5), usage, searches, sources };
  let data;
  try { data = JSON.parse(text); } catch { throw Object.assign(new Error(`reply is not JSON: ${text.slice(0, 200)}`), { costUsd: cost }); }
  return { data, costUsd: +cost.toFixed(5), usage, searches, sources };
}
