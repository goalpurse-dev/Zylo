// THE GRAMMAR FALLBACK (2026-11-21, llm.js callJson): a schema the API refuses as "compiled grammar is too large" is
// sent once more with the schema in the message, and the JSON is read from the reply text.
import test from "node:test";
import assert from "node:assert/strict";
import { callJson, parseJsonReply, requestBody, moneyMeter } from "../supabase/functions/_shared/blockyWorlds/llm.js";

const schema = { type: "object", additionalProperties: false, required: ["title"], properties: { title: { type: "string" } } };
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

test("a grammar-too-large 400 retries once with the schema inline, then parses the text", async () => {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const b = JSON.parse(init.body);
    sent.push(b);
    if (sent.length === 1) return reply(400, { type: "error", error: { type: "invalid_request_error", message: "The compiled grammar is too large, which would cause performance issues." } });
    return reply(200, { model: b.model, stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: "text", text: "```json\n{\"title\":\"Flowers\"}\n```" }] });
  };
  try {
    const r = await callJson({ apiKey: "k", model: "claude-opus-5-5", system: "sys", user: "plan it", schema, meter: moneyMeter(1) });
    assert.deepEqual(r.data, { title: "Flowers" });
    assert.equal(r.inlineSchema, true);
    assert.equal(sent.length, 2);
    assert.ok(sent[0].output_config.format, "the first call uses structured outputs");
    assert.equal(sent[1].output_config.format, undefined, "the retry has no structured-output format");
    assert.match(sent[1].messages[0].content, /ANSWER FORMAT: reply with ONE JSON object/);
    assert.match(sent[1].messages[0].content, /"required":\["title"\]/);
  } finally { globalThis.fetch = real; }
});

test("other 400s are not retried", async () => {
  let n = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async () => { n++; return reply(400, { error: { type: "invalid_request_error", message: "max_tokens too large" } }); };
  try {
    await assert.rejects(callJson({ apiKey: "k", model: "claude-opus-5-5", system: "s", user: "u", schema }), /anthropic 400/);
    assert.equal(n, 1);
  } finally { globalThis.fetch = real; }
});

test("parseJsonReply tolerates a fence or a sentence; requestBody inline drops the format", () => {
  assert.deepEqual(parseJsonReply("Here it is: {\"a\":1} done"), { a: 1 });
  assert.deepEqual(parseJsonReply("```\n{\"a\":2}\n```"), { a: 2 });
  assert.throws(() => parseJsonReply("no json"));
  const b = requestBody({ model: "claude-opus-5-5", system: "s", user: "u", schema, effort: "low", maxTokens: 10, inline: true });
  assert.equal(b.output_config.format, undefined);
  assert.equal(b.output_config.effort, "low");
});
