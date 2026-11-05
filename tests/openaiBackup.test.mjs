import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  backupReason, backupStats, callerFromStack, claudeCostUsd, claudeModelFor, claudeSchema, conform,
  openaiFetch, setBackupModeForTests, setClaudeTransportForTests, toClaudeRequest, toOpenAIResponse,
} from "../supabase/functions/_shared/openaiBackup.js";
import { alertGroupKey } from "../supabase/functions/_shared/adminAlert.ts";
import { SERVICES, instantAlerts, judge, summarizeBackup } from "../supabase/functions/_shared/opsHealth.js";

// Claude covers when OpenAI fails (owner, 2026-11-05). Free: every call here is answered by a stand-in.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const CHAT = "https://api.openai.com/v1/chat/completions";
const RESPONSES = "https://api.openai.com/v1/responses";

const checkSchema = {
  type: "object", additionalProperties: false, required: ["ok", "score", "issues", "note"],
  properties: {
    ok: { type: "boolean" },
    score: { type: "number", minimum: 0, maximum: 1 },
    issues: { type: "array", maxItems: 2, items: { type: "string", enum: ["text", "hands", "face"] } },
    note: { type: ["string", "null"], maxLength: 10 },
  },
};
const chatBody = {
  model: "gpt-4o-mini", temperature: 0.2, max_tokens: 400,
  messages: [
    { role: "system", content: "You check pictures." },
    { role: "user", content: [{ type: "text", text: "Check this." }, { type: "image_url", image_url: { url: "data:image/png;base64,AAAA", detail: "low" } }, { type: "image_url", image_url: { url: "https://x.supabase.co/a.png" } }] },
  ],
  response_format: { type: "json_schema", json_schema: { name: "check", strict: true, schema: checkSchema } },
};
const claudeAnswer = (text, extra = {}) => ({ id: "msg_1", type: "message", role: "assistant", content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 1000, output_tokens: 200 }, ...extra });
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// A stand-in for fetch: OpenAI answers `openai` (a Response, or an Error to throw), Claude answers `claude` (in turn).
function stub({ openai, claude = [] }) {
  const calls = [];
  const queue = [...claude];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init, body: init?.body ? JSON.parse(init.body) : null });
    if (String(url).startsWith("https://api.anthropic.com/")) return queue.shift() ?? json(500, { error: { message: "no stand-in" } });
    if (openai instanceof Error) throw openai;
    return typeof openai === "function" ? openai() : openai.clone();
  };
  return calls;
}
const realFetch = globalThis.fetch;
const setup = () => { setBackupModeForTests("on"); setClaudeTransportForTests(null); process.env.ANTHROPIC_API_KEY = "test-key"; };
const teardown = () => { globalThis.fetch = realFetch; setBackupModeForTests(null); delete process.env.ANTHROPIC_API_KEY; };

test("when Claude steps in: no answer, 5xx, rate limit, empty credit, refused key — never for our own bad request", () => {
  assert.equal(backupReason(0, "TimeoutError: Signal timed out."), "OpenAI didn't respond in time");
  assert.equal(backupReason(0, "TypeError: error sending request"), "OpenAI couldn't be reached");
  assert.equal(backupReason(503, "Service Unavailable"), "OpenAI error 503");
  assert.equal(backupReason(429, '{"error":{"code":"rate_limit_exceeded"}}'), "OpenAI rate limit");
  assert.equal(backupReason(429, '{"error":{"code":"insufficient_quota","message":"You exceeded your current quota"}}'), "OpenAI credit is empty");
  assert.equal(backupReason(401, "invalid_api_key"), "OpenAI refused our API key");
  assert.equal(backupReason(400, '{"error":{"message":"Invalid schema for response_format"}}'), null, "our own bad request: Claude would refuse it too");
  assert.equal(backupReason(404, "model not found"), null);
  assert.equal(backupReason(413, "too large"), null);
});

test("the Claude model of the same tier, at about the same price or less", () => {
  assert.equal(claudeModelFor("gpt-4o-mini"), "claude-haiku-5-5");
  assert.equal(claudeModelFor("gpt-5-mini"), "claude-haiku-5-5");
  assert.equal(claudeModelFor("gpt-4o"), "claude-sonnet-5-5");
  assert.equal(claudeModelFor("gpt-5.6-sol"), "claude-opus-5-5");
  assert.equal(claudeCostUsd("claude-haiku-5-5", { input_tokens: 1_000_000, output_tokens: 1_000_000 }), 0.6);
});

test("a chat request with pictures and a JSON schema, as Claude takes it", () => {
  const plan = toClaudeRequest(CHAT, chatBody);
  assert.equal(plan.kind, "chat");
  assert.equal(plan.request.model, "claude-haiku-5-5");
  assert.equal(plan.request.system, "You check pictures.");
  assert.deepEqual(plan.request.messages[0].content, [
    { type: "text", text: "Check this." },
    { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } },
    { type: "image", source: { type: "url", url: "https://x.supabase.co/a.png" } },
  ]);
  assert.equal(plan.request.temperature, undefined, "no sampling settings (current models refuse them)");
  assert.equal(plan.request.max_tokens, 16000);
  assert.equal(plan.request.output_config.effort, "low");
  const s = plan.request.output_config.format.schema;
  assert.equal(s.properties.score.minimum, undefined, "number ranges are enforced on the answer, not sent");
  assert.equal(s.properties.issues.maxItems, undefined);
  assert.equal(s.properties.note.maxLength, undefined);
  assert.equal(s.additionalProperties, false);
  assert.equal(plan.request.fallbacks, undefined, "Haiku has no refusal fallback");
  assert.equal(toClaudeRequest(CHAT, { ...chatBody, model: "gpt-4o" }).request.fallbacks, "default", "Sonnet and Opus: a refusal is retried on another Claude model");
});

test("a Responses request (instructions, input parts, reasoning) as Claude takes it", () => {
  const plan = toClaudeRequest(RESPONSES, {
    model: "gpt-5-mini", instructions: "Rules.", reasoning: { effort: "medium" }, max_output_tokens: 30000, store: false,
    input: [{ role: "user", content: [{ type: "input_text", text: "Is it right?" }, { type: "input_image", image_url: "https://x/y.png", detail: "high" }] }],
    text: { format: { type: "json_schema", name: "a", strict: true, schema: { type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false } } },
  });
  assert.equal(plan.kind, "responses");
  assert.equal(plan.request.system, "Rules.");
  assert.equal(plan.request.max_tokens, 30000);
  assert.equal(plan.request.output_config.effort, "medium");
  assert.equal(plan.request.messages[0].content[1].source.url, "https://x/y.png");
  assert.equal(toClaudeRequest(RESPONSES, { model: "gpt-5-mini", input: "hi" }).request.messages[0].content[0].text, "hi");
});

test("calls Claude can't take the same way stay with OpenAI: web search, streaming, several answers", () => {
  assert.match(toClaudeRequest(RESPONSES, { model: "gpt-5-mini", input: "x", tools: [{ type: "web_search" }] }).skip, /web search/);
  assert.match(toClaudeRequest(CHAT, { ...chatBody, stream: true }).skip, /streaming/);
  assert.match(toClaudeRequest(CHAT, { ...chatBody, n: 2 }).skip, /several/);
  assert.match(toClaudeRequest("https://api.openai.com/v1/audio/transcriptions", {}).skip, /not a chat/);
});

test("a schema with a dictionary goes in the prompt (Claude's JSON output can't take one)", () => {
  const plan = toClaudeRequest(CHAT, { ...chatBody, response_format: { type: "json_schema", json_schema: { name: "m", schema: { type: "object", additionalProperties: { type: "number" } } } } });
  assert.equal(plan.structured, false);
  assert.equal(plan.request.output_config.format, undefined);
  assert.match(plan.request.system, /matching this JSON schema exactly/);
  assert.equal(claudeSchema({ type: "object", properties: { a: { type: "string", format: "regex" } } }).properties.a.format, undefined);
});

test("the answer is made to fit the schema: ranges, lengths and list sizes enforced, extra keys dropped", () => {
  assert.deepEqual(conform({ ok: true, score: 1.7, issues: ["text", "hands", "face"], note: "a very long note", extra: 1 }, checkSchema),
    { ok: true, score: 1, issues: ["text", "hands"], note: "a very lon" });
  assert.deepEqual(conform({ ok: false, score: -2, issues: [], note: null }, checkSchema), { ok: false, score: 0, issues: [], note: null });
  assert.throws(() => conform({ ok: true, score: 0.5, issues: ["feet"], note: null }, checkSchema), /not in the list/);
  assert.throws(() => conform({ ok: true, score: 0.5, issues: [] }, checkSchema), /note: missing/);
  assert.throws(() => conform({ a: [] }, { type: "object", properties: { a: { type: "array", minItems: 1, items: {} } } }), /at least 1/);
  const refs = { type: "object", properties: { p: { $ref: "#/$defs/P" } }, required: ["p"], $defs: { P: { type: "integer", maximum: 3 } } };
  assert.deepEqual(conform({ p: 7.2 }, refs), { p: 3 });
});

test("Claude's answer comes back in OpenAI's exact shape, the OpenAI model name kept (callers' cost code runs unchanged)", () => {
  const plan = toClaudeRequest(CHAT, chatBody);
  const chat = toOpenAIResponse(plan, chatBody, claudeAnswer('```json\n{"ok":true,"score":0.9,"issues":[],"note":null}\n```'));
  assert.equal(chat.object, "chat.completion");
  assert.equal(chat.model, "gpt-4o-mini");
  assert.deepEqual(JSON.parse(chat.choices[0].message.content), { ok: true, score: 0.9, issues: [], note: null });
  assert.equal(chat.choices[0].finish_reason, "stop");
  assert.deepEqual([chat.usage.prompt_tokens, chat.usage.completion_tokens], [1000, 200]);
  assert.deepEqual(chat.zyvo_backup, { provider: "anthropic", model: "claude-haiku-5-5", id: "msg_1", usd: 0.0002 });
  const rb = { model: "gpt-5-mini", input: "x", text: { format: { type: "json_schema", name: "a", schema: { type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false } } } };
  const resp = toOpenAIResponse(toClaudeRequest(RESPONSES, rb), rb, claudeAnswer('{"a":"b"}'));
  assert.equal(resp.status, "completed");
  assert.equal(resp.output_text, '{"a":"b"}');
  assert.equal(resp.output[0].content[0].type, "output_text");
  assert.deepEqual([resp.usage.input_tokens, resp.usage.output_tokens], [1000, 200]);
  assert.throws(() => toOpenAIResponse(plan, chatBody, claudeAnswer("{}", { stop_reason: "max_tokens" })), /cut off/);
  assert.throws(() => toOpenAIResponse(plan, chatBody, claudeAnswer("", { stop_reason: "refusal" })), /refused/);
  assert.throws(() => toOpenAIResponse(plan, chatBody, claudeAnswer("not json")), /not JSON/);
});

test("OpenAI answers fine: its answer, untouched, and Claude is never called", async () => {
  setup();
  try {
    const calls = stub({ openai: json(200, { choices: [{ message: { content: "{}" } }] }) });
    const r = await openaiFetch(CHAT, { method: "POST", body: JSON.stringify(chatBody) });
    assert.equal(r.headers.get("x-zyvo-backup"), null);
    assert.equal(calls.length, 1);
  } finally { teardown(); }
});

test("OpenAI 503: the same request goes to Claude, and the caller gets an OpenAI-shaped answer", async () => {
  setup();
  try {
    const calls = stub({ openai: json(503, { error: { message: "overloaded" } }), claude: [json(200, claudeAnswer('{"ok":true,"score":2,"issues":["text"],"note":null}'))] });
    const before = backupStats.backup_used;
    const r = await openaiFetch(CHAT, { method: "POST", headers: { Authorization: "Bearer sk-x" }, body: JSON.stringify({ ...chatBody, model: "gpt-4o" }) });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("x-zyvo-backup"), "anthropic");
    const body = await r.json();
    assert.deepEqual(JSON.parse(body.choices[0].message.content), { ok: true, score: 1, issues: ["text"], note: null });
    const claudeCall = calls.find((c) => c.url.startsWith("https://api.anthropic.com/"));
    assert.equal(claudeCall.init.headers["x-api-key"], "test-key");
    assert.equal(claudeCall.init.headers["anthropic-beta"], "server-side-fallback-2026-07-01");
    assert.equal(claudeCall.init.headers.Authorization, undefined, "OpenAI's key never goes to Claude");
    assert.equal(claudeCall.body.model, "claude-sonnet-5-5");
    assert.equal(backupStats.backup_used, before + 1, "every switch is logged");
  } finally { teardown(); }
});

test("no answer in time, and an empty balance, both go to Claude", async () => {
  setup();
  try {
    stub({ openai: Object.assign(new Error("Signal timed out."), { name: "TimeoutError" }), claude: [json(200, claudeAnswer('{"ok":true,"score":0.5,"issues":[],"note":null}'))] });
    assert.equal((await openaiFetch(CHAT, { method: "POST", body: JSON.stringify(chatBody) })).status, 200);
    setBackupModeForTests("on");
    stub({ openai: json(429, { error: { code: "insufficient_quota", message: "You exceeded your current quota" } }), claude: [json(200, claudeAnswer('{"ok":true,"score":0.5,"issues":[],"note":null}'))] });
    const r = await openaiFetch(CHAT, { method: "POST", body: JSON.stringify(chatBody) });
    assert.equal(r.headers.get("x-zyvo-backup"), "anthropic");
  } finally { teardown(); }
});

test("our own bad request (400) is not sent to Claude: the caller gets OpenAI's answer exactly", async () => {
  setup();
  try {
    const calls = stub({ openai: json(400, { error: { message: "Invalid schema" } }) });
    const r = await openaiFetch(CHAT, { method: "POST", body: JSON.stringify(chatBody) });
    assert.equal(r.status, 400);
    assert.deepEqual(await r.json(), { error: { message: "Invalid schema" } });
    assert.equal(calls.filter((c) => c.url.includes("anthropic")).length, 0);
  } finally { teardown(); }
});

test("Claude refuses the schema: once more with the schema in the prompt", async () => {
  setup();
  try {
    const calls = stub({ openai: json(500, {}), claude: [json(400, { error: { message: "Schema is too complex" } }), json(200, claudeAnswer('{"ok":false,"score":0,"issues":[],"note":null}'))] });
    const r = await openaiFetch(CHAT, { method: "POST", body: JSON.stringify(chatBody) });
    assert.equal(r.status, 200);
    const tries = calls.filter((c) => c.url.includes("anthropic"));
    assert.equal(tries.length, 2);
    assert.ok(tries[0].body.output_config.format);
    assert.equal(tries[1].body.output_config.format, undefined);
    assert.match(tries[1].body.system, /matching this JSON schema exactly/);
  } finally { teardown(); }
});

test("Claude fails too: the caller gets OpenAI's own failure, as without the backup", async () => {
  setup();
  try {
    stub({ openai: json(503, { error: { message: "overloaded" } }), claude: [json(529, { error: { message: "overloaded" } })] });
    const before = backupStats.backup_failed;
    const r = await openaiFetch(CHAT, { method: "POST", body: JSON.stringify(chatBody) });
    assert.equal(r.status, 503);
    assert.equal(backupStats.backup_failed, before + 1);
    setBackupModeForTests("on");
    const timeout = Object.assign(new Error("Signal timed out."), { name: "TimeoutError" });
    stub({ openai: timeout, claude: [json(200, claudeAnswer("not json"))] });
    await assert.rejects(openaiFetch(CHAT, { method: "POST", body: JSON.stringify(chatBody) }), /Signal timed out/);
  } finally { teardown(); }
});

test("a web-search call, or no Anthropic key: OpenAI's failure as it is (logged)", async () => {
  setup();
  try {
    const calls = stub({ openai: json(503, {}) });
    const r = await openaiFetch(RESPONSES, { method: "POST", body: JSON.stringify({ model: "gpt-5-mini", input: "x", tools: [{ type: "web_search" }] }) });
    assert.equal(r.status, 503);
    delete process.env.ANTHROPIC_API_KEY;
    assert.equal((await openaiFetch(CHAT, { method: "POST", body: JSON.stringify(chatBody) })).status, 503);
    assert.equal(calls.filter((c) => c.url.includes("anthropic")).length, 0);
  } finally { teardown(); }
});

test("after one switch, the next calls go straight to Claude for a minute (no 30 s wait each)", async () => {
  setup();
  try {
    const ok = () => json(200, claudeAnswer('{"ok":true,"score":0.5,"issues":[],"note":null}'));
    const calls = stub({ openai: json(503, {}), claude: [ok(), ok()] });
    await openaiFetch(CHAT, { method: "POST", body: JSON.stringify(chatBody) });
    await openaiFetch(CHAT, { method: "POST", body: JSON.stringify(chatBody) });
    assert.equal(calls.filter((c) => c.url.includes("openai.com")).length, 1);
  } finally { teardown(); }
});

test("force: straight to Claude (the owner's test switch); off: plain fetch", async () => {
  setup();
  try {
    setBackupModeForTests("force");
    let calls = stub({ openai: json(200, {}), claude: [json(200, claudeAnswer('{"ok":true,"score":0.5,"issues":[],"note":null}'))] });
    const before = backupStats.backup_used_forced;
    assert.equal((await openaiFetch(CHAT, { method: "POST", body: JSON.stringify(chatBody) })).headers.get("x-zyvo-backup"), "anthropic");
    assert.equal(calls.filter((c) => c.url.includes("openai.com")).length, 0);
    assert.equal(backupStats.backup_used_forced, before + 1, "logged as a test run: ops-health doesn't call OpenAI failing");
    setBackupModeForTests("off");
    calls = stub({ openai: json(503, {}) });
    assert.equal((await openaiFetch(CHAT, { method: "POST", body: JSON.stringify(chatBody) })).status, 503);
  } finally { teardown(); }
});

test("one email, not one per request: ops-health reads the log every 10 minutes and says OpenAI is failing and Claude is covering", () => {
  const openai = SERVICES.find((s) => s.id === "openai");
  const rows = (n, event, reason) => Array.from({ length: n }, () => ({ event, details: { reason } }));
  const covering = judge(openai, { reachable: true, ...summarizeBackup(rows(14, "backup_used", "OpenAI error 503")) });
  assert.deepEqual(covering.red, ["failing, Claude is covering (14 in the last 10 minutes)"]);
  assert.match(covering.todo, /Nothing breaks for users: their requests go to Claude until OpenAI answers again\. Check status\.openai\.com\./);
  const alert = instantAlerts([{ service: openai, state: {}, judged: covering }])[0];
  assert.equal(alert.subject, "Zyvo ALERT: OpenAI — failing, Claude is covering (14 in the last 10 minutes)");
  // The same email kind every time (numbers aside): adminAlert sends it at most once per 6 hours.
  const one = judge(openai, { reachable: true, ...summarizeBackup(rows(1, "backup_used", "OpenAI error 503")) });
  assert.equal(alertGroupKey(instantAlerts([{ service: openai, state: {}, judged: one }])[0].subject), alertGroupKey(alert.subject));
  // An empty balance says so; a backup that failed too says users are affected.
  assert.equal(judge(openai, { reachable: true, ...summarizeBackup(rows(2, "backup_used", "OpenAI credit is empty")) }).todo, "Add credit at platform.openai.com (Billing).");
  assert.match(judge(openai, { reachable: true, ...summarizeBackup([...rows(1, "backup_failed", "OpenAI error 503")]) }).red[0], /the Claude backup failed too .*users are seeing failures/);
  assert.equal(judge(openai, { reachable: true, ...summarizeBackup([]) }).red.length, 0);
  const fn = read("supabase/functions/ops-health/index.ts");
  assert.match(fn, /\.in\("event", \["backup_used", "backup_failed"\]\)\.gte\("created_at", hoursAgo\(10 \/ 60\)\)/, "forced test runs (backup_used_forced) never count");
  assert.equal(callerFromStack("Error\n    at openaiFetch (file:///x/_shared/openaiBackup.js:1:1)\n    at checkScene (file:///x/functions/_shared/sceneQA.ts:459:20)"), "sceneQA.ts");
});

test("every OpenAI writing and checking call of Long Form, the picture checks, Fruit and Blocky goes through the backup", () => {
  const files = ["advance-long-form-script/index.ts", "advance-long-form-research/index.ts", "advance-long-form-visual-plan/index.ts", "advance-long-form-visual-world/index.ts",
    "generate-long-form-ideas/index.ts", "generate-long-form-story-plan/index.ts", "render-long-form-scene/index.ts", "repair-long-form-visual-plan-focal-subjects/index.ts",
    "repair-long-form-visual-plan-semantic-bindings/index.ts", "start-long-form-scene-generation/index.ts", "long-form-thumbnails/index.ts", "_shared/stickman/headlines.ts",
    "_shared/stickman/productionBible.ts", "_shared/stickman/teaser.ts", "_shared/narrationVisualContract.ts", "_shared/sceneQA.ts", "_shared/referenceQA.ts",
    "fruit-story-ideas/index.ts", "fruit-story-planner/index.ts", "fruit-story-video-prompts/index.ts", "_shared/fruit/llm.js", "_shared/blocky/llm.js"];
  for (const f of files) {
    const src = read(`supabase/functions/${f}`);
    assert.match(src, /import \{ openaiFetch \} from "\.{1,2}\/(_shared\/|\.\.\/)?openaiBackup\.js";|import \{ openaiFetch \} from "\.\.\/openaiBackup\.js";|import \{ openaiFetch \} from "\.\/openaiBackup\.js";/, `${f} imports openaiFetch`);
    assert.doesNotMatch(src, /await fetch\((OPENAI_RESPONSES|OPENAI_CHAT|"https:\/\/api\.openai\.com\/v1\/(chat\/completions|responses)")/, `${f} has no direct OpenAI call left`);
  }
  assert.match(read("supabase/functions/_shared/stickman/teaser.ts"), /post: typeof fetch = openaiFetch\)/);
  assert.match(read("supabase/functions/_shared/fruit/llm.js"), /openaiFetch\(u, init, \{ caller: "fruit\/llm\.js" \}\)/);
  assert.match(read("supabase/functions/_shared/blocky/llm.js"), /openaiFetch\(u, init, \{ caller: "blocky\/llm\.js" \}\)/);
});

test("Blocky's copy is the same file (Blocky imports only from its own folder), and the module imports nothing", () => {
  const shared = read("supabase/functions/_shared/openaiBackup.js");
  assert.equal(read("supabase/functions/_shared/blocky/openaiBackup.js"), shared, "change both copies together");
  assert.doesNotMatch(shared, /^\s*import\s|\bimport\(/m);
  assert.match(read("supabase/functions/_shared/blocky/llm.js"), /import \{ openaiFetch \} from "\.\/openaiBackup\.js";/);
});
