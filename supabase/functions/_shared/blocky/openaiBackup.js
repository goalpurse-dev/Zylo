// openaiBackup.js — Claude covers when OpenAI fails (owner, 2026-11-05: "retry the same request with
// Claude automatically, so the user never sees a failure"). Plain JS with no imports (Deno + node: fetch
// only). The one in _shared is used by Long Form and the picture checks; Blocky's engine folder holds an
// identical copy (_shared/blocky/openaiBackup.js: Blocky imports only from its own folder). Change both
// together: a test checks they match.
//
// openaiFetch(url, init, { caller }) is a drop-in for fetch() on api.openai.com chat/completions and
// responses calls:
//   - OpenAI answers fine → that answer, untouched
//   - no answer in time, a 5xx, a rate limit, an empty balance or a refused key → the same request,
//     translated, to Claude; Claude's answer comes back in OpenAI's exact shape (same JSON fields, the
//     JSON schema's shape enforced, and the OpenAI model name kept so every caller's parsing and cost
//     code runs unchanged). Claude's real cost is in the log.
//   - our own bad request (any other 4xx) → OpenAI's answer, untouched: it would fail on Claude too
//   - a call Claude can't take the same way (web search and other tools, streaming, several answers)
//     → OpenAI's answer, untouched
// Every switch is logged (system_logs, source "openai-backup"). The owner's email comes from ops-health,
// which reads these rows every 10 minutes ("OpenAI is failing, Claude is covering"; one per 6 hours at
// most). OPENAI_BACKUP=off turns it off; =force sends straight to Claude (the owner's test switch).

const OPENAI_HOST = "https://api.openai.com/";
const ANTHROPIC_MESSAGES = "https://api.anthropic.com/v1/messages";
const CLAUDE_TIMEOUT_MS = 120_000;
const OPENAI_DOWN_MS = 60_000;   // after a switch, this instance goes straight to Claude for a minute

// USD per 1M tokens (Anthropic, Nov 2026).
export const CLAUDE_PRICES = Object.freeze({
  "claude-haiku-5-5": { input: 0.10, output: 0.50 },
  "claude-sonnet-5-5": { input: 2.0, output: 10.0 },
  "claude-opus-5-5": { input: 4.0, output: 20.0 },
});

// The Claude model of the same tier: mini/nano → Haiku 5.5, gpt-5.6-sol (OpenAI's top writer) → Opus 5.5,
// the rest (gpt-4o, gpt-4.1, gpt-5) → Sonnet 5.5. Each costs about the same as or less than the model it covers.
export function claudeModelFor(openaiModel) {
  const m = String(openaiModel ?? "");
  if (/mini|nano/.test(m)) return "claude-haiku-5-5";
  if (/^gpt-5\.[1-9]/.test(m)) return "claude-opus-5-5";
  return "claude-sonnet-5-5";
}

export function claudeCostUsd(model, usage) {
  const p = CLAUDE_PRICES[model];
  if (!p) return null;
  const input = Number(usage?.input_tokens ?? 0) + Number(usage?.cache_read_input_tokens ?? 0) + Number(usage?.cache_creation_input_tokens ?? 0);
  return Number(((input * p.input + Number(usage?.output_tokens ?? 0) * p.output) / 1e6).toFixed(6));
}

// Why OpenAI's answer calls for the backup, in plain words; null when it doesn't (our own request was
// wrong: it would fail on Claude too). status 0: no answer at all (text: the thrown error).
export function backupReason(status, text = "") {
  const t = String(text ?? "");
  if (!status) return /timed? ?out|timeout|abort/i.test(t) ? "OpenAI didn't respond in time" : "OpenAI couldn't be reached";
  if (status === 402 || /insufficient_quota|billing_hard_limit_reached|billing_not_active|exceeded your current quota/i.test(t)) return "OpenAI credit is empty";
  if (status === 429) return "OpenAI rate limit";
  if (status === 408) return "OpenAI didn't respond in time";
  if (status >= 500) return `OpenAI error ${status}`;
  if (status === 401 || status === 403) return "OpenAI refused our API key";
  return null;
}

// ---------------------------------------------------------------------------------------------
// Request: OpenAI (chat/completions or responses) → Claude Messages. → { kind, model, request, schema, jsonMode }
// or { skip: why } when the call can't be made the same way on Claude.

const CLAUDE_UNSUPPORTED = new Set(["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength",
  "minItems", "maxItems", "uniqueItems", "pattern", "minProperties", "maxProperties", "$schema", "default", "examples", "strict"]);
const CLAUDE_FORMATS = new Set(["date-time", "time", "date", "duration", "email", "hostname", "uri", "ipv4", "ipv6", "uuid"]);

// Does the schema hold a dictionary (additionalProperties with a schema)? Claude's JSON output can't take one.
function hasOpenObjects(s) {
  if (Array.isArray(s)) return s.some(hasOpenObjects);
  if (!s || typeof s !== "object") return false;
  if (s.additionalProperties !== undefined && s.additionalProperties !== false) return true;
  return Object.values(s).some(hasOpenObjects);
}

// The schema as Claude's JSON output takes it: the limits it doesn't support are removed here and
// enforced on the answer afterwards (conform), and every object is closed.
export function claudeSchema(s) {
  if (Array.isArray(s)) return s.map(claudeSchema);
  if (!s || typeof s !== "object") return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (CLAUDE_UNSUPPORTED.has(k)) continue;
    if (k === "format" && !CLAUDE_FORMATS.has(v)) continue;
    out[k] = k === "properties" || k === "$defs" || k === "definitions" ? Object.fromEntries(Object.entries(v ?? {}).map(([pk, pv]) => [pk, claudeSchema(pv)])) : claudeSchema(v);
  }
  const isObject = out.type === "object" || (Array.isArray(out.type) && out.type.includes("object")) || out.properties;
  if (isObject) out.additionalProperties = false;
  return out;
}

function imageBlock(url) {
  const u = typeof url === "string" ? url : url?.url;
  if (!u) return null;
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(u);
  return m ? { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } } : { type: "image", source: { type: "url", url: u } };
}

// One OpenAI content (a string or a list of parts) → Claude content blocks; null when a part can't be carried over.
function claudeContent(content) {
  if (typeof content === "string") return content ? [{ type: "text", text: content }] : [];
  if (!Array.isArray(content)) return null;
  const blocks = [];
  for (const p of content) {
    if (typeof p === "string") { blocks.push({ type: "text", text: p }); continue; }
    if (["text", "input_text", "output_text"].includes(p?.type)) { if (p.text) blocks.push({ type: "text", text: p.text }); continue; }
    if (p?.type === "image_url" || p?.type === "input_image") { const b = imageBlock(p.image_url); if (!b) return null; blocks.push(b); continue; }
    return null; // audio, files, refusals: not the same request on Claude
  }
  return blocks;
}

const textOf = (blocks) => (blocks ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n");

export function toClaudeRequest(url, body) {
  const kind = /\/v1\/responses(\?|$)/.test(url) ? "responses" : /\/v1\/chat\/completions(\?|$)/.test(url) ? "chat" : null;
  if (!kind) return { skip: "not a chat or responses call" };
  if (!body || typeof body !== "object") return { skip: "no JSON body" };
  if (body.stream) return { skip: "streaming" };
  if ((body.tools?.length ?? 0) > 0 || body.functions?.length) return { skip: "uses tools (web search or functions)" };
  if ((body.n ?? 1) > 1) return { skip: "asks for several answers" };
  if (body.previous_response_id) return { skip: "continues an earlier OpenAI response" };

  const system = [];
  const messages = [];
  const add = (role, content) => {
    const blocks = claudeContent(content);
    if (blocks == null) return false;
    if (role === "system" || role === "developer") { const t = textOf(blocks); if (t) system.push(t); return true; }
    if (role !== "user" && role !== "assistant") return false;
    if (blocks.length) messages.push({ role, content: blocks });
    return true;
  };
  if (kind === "chat") {
    for (const m of body.messages ?? []) if (!add(m?.role, m?.content)) return { skip: `a ${m?.role ?? "?"} message Claude can't take` };
  } else {
    if (body.instructions) system.push(String(body.instructions));
    if (typeof body.input === "string") messages.push({ role: "user", content: [{ type: "text", text: body.input }] });
    else for (const item of body.input ?? []) {
      if (item?.type && item.type !== "message") return { skip: `an input item of type ${item.type}` };
      if (!add(item?.role ?? "user", item?.content)) return { skip: `a ${item?.role ?? "?"} input Claude can't take` };
    }
  }
  if (!messages.length) return { skip: "no messages" };
  if (messages[0].role !== "user") messages.unshift({ role: "user", content: [{ type: "text", text: "Continue." }] });
  if (messages.at(-1).role !== "user") return { skip: "ends with an assistant message" };

  const format = kind === "chat" ? body.response_format : body.text?.format;
  const schema = format?.type === "json_schema" ? (kind === "chat" ? format.json_schema?.schema : format.schema) : null;
  const jsonMode = format?.type === "json_object";
  if (format?.type === "json_schema" && !schema) return { skip: "a JSON schema format without a schema" };

  const model = claudeModelFor(body.model);
  const effort = { minimal: "low", none: "low", low: "low", medium: "medium", high: "high", xhigh: "high" }[body.reasoning?.effort ?? body.reasoning_effort] ?? "low";
  const asked = Number(body.max_output_tokens ?? body.max_completion_tokens ?? body.max_tokens ?? 0);
  const structured = !!schema && !hasOpenObjects(schema);
  const rules = [];
  if (jsonMode) rules.push("Answer with one JSON object only: no other text, no code fences.");
  if (schema && !structured) rules.push(`Answer with JSON only (no other text, no code fences), matching this JSON schema exactly:\n${JSON.stringify(schema)}`);
  const systemText = [...system, ...rules].join("\n\n");
  const request = {
    model,
    max_tokens: Math.min(64_000, Math.max(16_000, asked)),   // Claude's thinking counts here too; a higher cap costs nothing unused
    ...(systemText ? { system: systemText } : {}),
    messages,
    output_config: { effort, ...(structured ? { format: { type: "json_schema", schema: claudeSchema(schema) } } : {}) },
    // A Sonnet or Opus refusal is retried by the API on another Claude model (Haiku has no such fallback).
    ...(model === "claude-haiku-5-5" ? {} : { fallbacks: "default" }),
  };
  return { kind, model, request, schema, jsonMode, structured };
}

// The same request with the schema written into the prompt instead of Claude's JSON output (used once
// when Claude refuses the schema itself, e.g. one too large to compile).
export function plainJsonRequest(plan) {
  const { format, ...output } = plan.request.output_config;
  const rule = `Answer with JSON only (no other text, no code fences), matching this JSON schema exactly:\n${JSON.stringify(plan.schema)}`;
  return { ...plan, structured: false, request: { ...plan.request, system: [plan.request.system, rule].filter(Boolean).join("\n\n"), output_config: output } };
}

// ---------------------------------------------------------------------------------------------
// Answer: the JSON schema's shape, enforced (Claude's JSON output can't take number ranges, lengths or
// list sizes): numbers clamped, too-long text and lists cut, extra keys of a closed object dropped;
// anything that can't be made to fit throws.

function resolveRef(s, root) {
  let cur = s;
  for (let i = 0; cur?.$ref && i < 20; i++) {
    const path = String(cur.$ref).replace(/^#\/?/, "").split("/").filter(Boolean);
    cur = path.reduce((o, k) => o?.[k.replace(/~1/g, "/").replace(/~0/g, "~")], root);
  }
  return cur ?? {};
}

const typeOk = (t, v) => t === "null" ? v === null : t === "array" ? Array.isArray(v) : t === "object" ? !!v && typeof v === "object" && !Array.isArray(v)
  : t === "integer" ? typeof v === "number" && Number.isFinite(v) : t === "number" ? typeof v === "number" && Number.isFinite(v) : typeof v === t;

export function conform(value, schema, root = schema, path = "$") {
  const s = resolveRef(schema, root);
  for (const key of ["anyOf", "oneOf"]) if (Array.isArray(s[key])) {
    let last;
    for (const branch of s[key]) { try { return conform(value, branch, root, path); } catch (e) { last = e; } }
    throw last ?? new Error(`${path}: no branch fits`);
  }
  if (Array.isArray(s.allOf)) for (const part of s.allOf) value = conform(value, part, root, path);
  if ("const" in s && JSON.stringify(value) !== JSON.stringify(s.const)) throw new Error(`${path}: not ${JSON.stringify(s.const)}`);
  if (Array.isArray(s.enum) && !s.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) throw new Error(`${path}: ${JSON.stringify(value)} not in the list`);
  const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : null;
  if (!types) return value;
  const t = types.find((x) => typeOk(x, value));
  if (!t) throw new Error(`${path}: expected ${types.join("|")}`);
  if (t === "object") {
    const out = {};
    for (const k of s.required ?? []) if (!(k in value)) throw new Error(`${path}.${k}: missing`);
    for (const [k, v] of Object.entries(value)) {
      if (s.properties?.[k]) out[k] = conform(v, s.properties[k], root, `${path}.${k}`);
      else if (s.additionalProperties === false) continue;
      else out[k] = s.additionalProperties && typeof s.additionalProperties === "object" ? conform(v, s.additionalProperties, root, `${path}.${k}`) : v;
    }
    return out;
  }
  if (t === "array") {
    let arr = value.map((v, i) => conform(v, s.items ?? {}, root, `${path}[${i}]`));
    if (Number.isFinite(s.maxItems)) arr = arr.slice(0, s.maxItems);
    if (Number.isFinite(s.minItems) && arr.length < s.minItems) throw new Error(`${path}: ${arr.length} items, at least ${s.minItems} needed`);
    return arr;
  }
  if (t === "string") {
    let str = value;
    if (Number.isFinite(s.maxLength) && str.length > s.maxLength) str = str.slice(0, s.maxLength);
    if (Number.isFinite(s.minLength) && str.length < s.minLength) throw new Error(`${path}: too short`);
    if (s.pattern) { let re = null; try { re = new RegExp(s.pattern, "u"); } catch { /* a pattern JS can't read: not checked */ } if (re && !re.test(str)) throw new Error(`${path}: doesn't match ${s.pattern}`); }
    return str;
  }
  if (t === "number" || t === "integer") {
    let n = t === "integer" ? Math.round(value) : value;
    if (Number.isFinite(s.minimum)) n = Math.max(n, s.minimum);
    if (Number.isFinite(s.maximum)) n = Math.min(n, s.maximum);
    if (Number.isFinite(s.exclusiveMinimum) && n <= s.exclusiveMinimum) n = t === "integer" ? s.exclusiveMinimum + 1 : s.exclusiveMinimum + 1e-9;
    if (Number.isFinite(s.exclusiveMaximum) && n >= s.exclusiveMaximum) n = t === "integer" ? s.exclusiveMaximum - 1 : s.exclusiveMaximum - 1e-9;
    return n;
  }
  return value;
}

function parseJsonText(text) {
  const t = String(text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch { /* below */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("Claude's answer is not JSON");
}

// Claude's answer → the body OpenAI would have sent for this request. Throws when it can't stand in.
export function toOpenAIResponse(plan, body, claude) {
  if (claude?.stop_reason === "refusal") throw new Error("Claude refused");
  if (claude?.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off");
  let text = (claude?.content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("");
  if (plan.schema || plan.jsonMode) {
    let data = parseJsonText(text);
    if (plan.schema) data = conform(data, plan.schema);
    else if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Claude's answer is not a JSON object");
    text = JSON.stringify(data);
  }
  if (!text) throw new Error("Claude's answer is empty");
  const u = claude?.usage ?? {};
  const inputTokens = Number(u.input_tokens ?? 0) + Number(u.cache_read_input_tokens ?? 0) + Number(u.cache_creation_input_tokens ?? 0);
  const outputTokens = Number(u.output_tokens ?? 0);
  const backup = { provider: "anthropic", model: plan.model, id: claude?.id ?? null, usd: claudeCostUsd(plan.model, u) };
  const created = Math.floor(Date.now() / 1000);
  if (plan.kind === "chat") {
    return { id: `chatcmpl-backup-${claude?.id ?? created}`, object: "chat.completion", created, model: body.model,
      choices: [{ index: 0, message: { role: "assistant", content: text, refusal: null }, logprobs: null, finish_reason: "stop" }],
      usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens, prompt_tokens_details: { cached_tokens: 0 }, completion_tokens_details: { reasoning_tokens: 0 } },
      zyvo_backup: backup };
  }
  return { id: `resp_backup_${claude?.id ?? created}`, object: "response", created_at: created, status: "completed", model: body.model,
    output: [{ type: "message", id: `msg_backup_${claude?.id ?? created}`, status: "completed", role: "assistant", content: [{ type: "output_text", text, annotations: [] }] }],
    output_text: text,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } },
    zyvo_backup: backup };
}

// ---------------------------------------------------------------------------------------------
// The switch.

const envGet = (k) => { try { return String(globalThis.Deno?.env?.get(k) ?? globalThis.process?.env?.[k] ?? "").trim(); } catch { return ""; } };
let modeOverride = null;
let openaiDownUntil = 0;
let claudeTransport = null;
/** Tests only: "on" | "off" | "force" (null: back to OPENAI_BACKUP). Also forgets a recent OpenAI failure. */
export function setBackupModeForTests(mode) { modeOverride = mode; openaiDownUntil = 0; }
/** Tests only: (plan, url, init) => {status, json, error, ms} in place of the real Claude call (null: the real one). */
export function setClaudeTransportForTests(fn) { claudeTransport = fn; }
/** What happened since the start (or the last reset): backup_used / backup_failed / backup_unavailable, with reasons. */
export const backupStats = { backup_used: 0, backup_failed: 0, backup_unavailable: 0, backup_used_forced: 0, backup_failed_forced: 0, notes: [] };
export function backupMode() {
  const m = (modeOverride ?? envGet("OPENAI_BACKUP")).toLowerCase();
  return m === "off" || m === "force" ? m : "on";
}

// Bookkeeping never fails the request it describes, and is not waited for where the runtime allows.
function background(p) {
  const done = Promise.resolve(p).catch((e) => console.error("[openai-backup] bookkeeping failed:", String(e?.message ?? e)));
  const er = globalThis.EdgeRuntime;
  if (er?.waitUntil) { er.waitUntil(done); return Promise.resolve(); }
  return done;
}

async function logEvent(event, level, message, details) {
  backupStats[event] = (backupStats[event] ?? 0) + 1;
  if (backupStats.notes.length < 200) backupStats.notes.push(`${event} ${details?.caller}: ${message}`);
  if (!claudeTransport) console.warn(`[openai-backup] ${event}: ${message} ${JSON.stringify(details)}`);
  const url = envGet("SUPABASE_URL"), sk = envGet("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !sk) return;
  await fetch(`${url}/rest/v1/system_logs`, { method: "POST", signal: AbortSignal.timeout(5000),
    headers: { apikey: sk, Authorization: `Bearer ${sk}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ source: "openai-backup", level, event, message: String(message).slice(0, 300), details }) }).then((r) => r.body?.cancel());
}

// Which feature called: "sceneQA.ts" or "generate-long-form-ideas/index.ts", from the first stack frame outside this file.
export function callerFromStack(stack = new Error().stack) {
  for (const line of String(stack ?? "").split("\n").slice(1)) {
    const m = /([\w.-]+\/[\w.-]+\.(?:ts|js|mjs))(?::\d+)+\)?\s*$/.exec(line);
    if (m && !m[1].endsWith("openaiBackup.js")) return m[1].replace(/^(functions|_shared)\//, "");
  }
  return "unknown";
}

async function askClaude(plan, key, timeoutMs) {
  const t0 = Date.now();
  const r = await fetch(ANTHROPIC_MESSAGES, { method: "POST", signal: AbortSignal.timeout(timeoutMs),
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json",
      ...(plan.request.fallbacks ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}) },
    body: JSON.stringify(plan.request) });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* below */ }
  return { status: r.status, json, error: r.ok ? null : `${r.status} ${String(json?.error?.message ?? text).slice(0, 200)}`, ms: Date.now() - t0 };
}

/**
 * fetch() for an OpenAI chat/completions or responses call, with Claude as the backup.
 * @param {string} url
 * @param {RequestInit} init
 * @param {{caller?: string, claudeTimeoutMs?: number}} opts caller: which feature, for the log and the email
 * @returns {Promise<Response>}
 */
export async function openaiFetch(url, init = {}, opts = {}) {
  const mode = backupMode();
  const caller = opts.caller ?? callerFromStack();
  if (mode === "off" || !String(url).startsWith(OPENAI_HOST)) return fetch(url, init);
  let body = null;
  try { body = typeof init.body === "string" ? JSON.parse(init.body) : null; } catch { /* not JSON: no backup */ }
  const plan = body ? toClaudeRequest(String(url), body) : { skip: "no JSON body" };
  const key = envGet("ANTHROPIC_API_KEY");
  const canBackUp = !plan.skip && !!key;

  // OpenAI first (unless forced, or it failed in this instance a moment ago).
  let res = null, thrown = null, status = 0, errText = "", reason;
  if (canBackUp && (mode === "force" || Date.now() < openaiDownUntil)) {
    reason = mode === "force" ? "backup forced on (OPENAI_BACKUP=force)" : "OpenAI failed moments ago";
  } else {
    try { res = await fetch(url, init); } catch (e) { thrown = e; }
    if (res?.ok) return res;
    if (res) { status = res.status; errText = await res.text(); } else errText = `${thrown?.name ?? ""} ${thrown?.message ?? thrown}`;
    reason = backupReason(status, errText);
  }
  const openaiAnswer = async () => {
    if (res) return new Response(errText, { status: res.status, statusText: res.statusText, headers: { "content-type": res.headers.get("content-type") ?? "application/json" } });
    if (thrown) throw thrown;
    return fetch(url, init);   // forced or skipped straight to Claude, and Claude failed: OpenAI after all
  };
  if (!reason) return openaiAnswer();   // our own request was wrong: Claude would refuse it too
  const details = { caller, reason, openaiStatus: status, openaiError: errText.slice(0, 200), openaiModel: body?.model ?? null };
  if (!canBackUp) {
    await background(logEvent("backup_unavailable", "warn", `${reason}; no backup: ${plan.skip ?? "no ANTHROPIC_API_KEY"}`, details));
    return openaiAnswer();
  }
  if (mode !== "force" && status !== 401 && status !== 403) openaiDownUntil = Date.now() + OPENAI_DOWN_MS;

  const timeoutMs = opts.claudeTimeoutMs ?? CLAUDE_TIMEOUT_MS;
  let p = plan, claude = null, answer = null, failure = null;
  const ask = (pl) => claudeTransport ? claudeTransport(pl, url, init) : askClaude(pl, key, timeoutMs);
  try {
    claude = await ask(p);
    // Claude refused the schema itself (one too large or too complex to compile): once more with the
    // schema in the prompt. A refused request costs nothing, and the answer is checked here either way.
    if (claude.status === 400 && p.structured) { p = plainJsonRequest(p); claude = await ask(p); }
    if (claude.status >= 400 || !claude.json) throw new Error(`Claude ${claude.error ?? "answered with no JSON"}`);
    answer = toOpenAIResponse(p, body, claude.json);
  } catch (e) { failure = String(e?.message ?? e).slice(0, 300); }

  const more = { ...details, claudeModel: p.model, claudeMs: claude?.ms ?? null, usd: claudeCostUsd(p.model, claude?.json?.usage), inputTokens: claude?.json?.usage?.input_tokens ?? null, outputTokens: claude?.json?.usage?.output_tokens ?? null, schemaInPrompt: !p.structured && !!p.schema };
  // A forced run (the owner's test) is logged as a test, so ops-health doesn't report OpenAI as failing.
  const forced = mode === "force" ? "_forced" : "";
  if (failure) {
    await background(logEvent(`backup_failed${forced}`, "error", `${reason}; Claude failed too: ${failure}`, { ...more, claudeError: failure }));
    return openaiAnswer();
  }
  await background(logEvent(`backup_used${forced}`, "warn", `${reason}; Claude answered (${caller})`, more));
  return new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json", "x-zyvo-backup": "anthropic" } });
}
