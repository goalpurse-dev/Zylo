// AUTO-CONTINUE (owner 2026-11-14): a writer call cut off by the output limit is resumed (priced first, at most CONTINUE.max
// times) instead of failing; the free tests fake fetch. node --test tests/blockyWorldsContinue.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { callJson, CONTINUE, HYBRID, moneyMeter, resumeUser } from "../supabase/functions/_shared/blockyWorlds/llm.js";
import { APP_HYBRID } from "../supabase/functions/_shared/blockyWorlds/hybridApp.js";

const reply = (stop, text, out = 1000) => ({ ok: true, status: 200, json: async () => ({ model: "claude-sonnet-5-5", stop_reason: stop, content: [{ type: "thinking", thinking: "" }, { type: "text", text }], usage: { input_tokens: 1000, output_tokens: out } }) });
function fakeFetch(replies) {
  const sent = [];
  const f = async (url, init) => { sent.push(JSON.parse(init.body)); return replies[Math.min(sent.length - 1, replies.length - 1)]; };
  return { f, sent };
}
const base = { apiKey: "k", model: "claude-sonnet-5-5", system: ["SYS"], user: "WRITE THE LINES", schema: { type: "object" }, maxTokens: 16000 };

test("continue: a reply cut off at the output limit is resumed with the JSON so far and 1.5x the room; the cost adds up", async (t) => {
  const { f, sent } = fakeFetch([reply("max_tokens", '{"title":"Giggle","lines":[{"text":"In this', 16000), reply("end_turn", '{"title":"Giggle","lines":[]}', 3000)]);
  t.mock.method(globalThis, "fetch", f);
  const meter = moneyMeter(1.0);
  const r = await callJson({ ...base, meter });
  assert.deepEqual(r.data, { title: "Giggle", lines: [] });
  assert.equal(r.continued, 1);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].max_tokens, 24000);
  const u = sent[1].messages.at(-1).content;
  assert.match(u, /^WRITE THE LINES\n\nRESUME: your previous answer was cut off/);
  assert.match(u, /"lines":\[\{"text":"In this/);
  assert.equal(sent[1].messages.length, 1, "a fresh request (no assistant prefill)");
  assert.ok(Math.abs(r.costUsd - ((1000 * 2 + 16000 * 10) / 1e6 + (1000 * 2 + 3000 * 10) / 1e6)) < 1e-6, String(r.costUsd));
  assert.equal(meter.calls, 2);
});

test("continue: at most CONTINUE.max resumes, then the step fails as before (output truncated) with every call's cost", async (t) => {
  const { f, sent } = fakeFetch([reply("max_tokens", '{"a":', 16000)]);
  t.mock.method(globalThis, "fetch", f);
  await assert.rejects(callJson({ ...base, meter: moneyMeter(5) }), (e) => e.message === "output truncated" && e.continued === CONTINUE.max && e.costUsd > 0.3);
  assert.equal(sent.length, 1 + CONTINUE.max);
  assert.deepEqual(sent.map((b) => b.max_tokens), [16000, 24000, 32000]);
});

test("continue: a resume is priced before it is sent; one the money cap can't fund is never sent", async (t) => {
  const { f, sent } = fakeFetch([reply("max_tokens", '{"a":', 16000), reply("end_turn", '{"a":1}')]);
  t.mock.method(globalThis, "fetch", f);
  // $0.30: the first call's worst case fits ($0.16 + input), the resume's ($0.24 + input) on top of $0.162 spent does not
  await assert.rejects(callJson({ ...base, meter: moneyMeter(0.3) }), /money cap/);
  assert.equal(sent.length, 1);
});

test("continue: a cut-off before any JSON asks for the whole object; a normal reply is untouched", async (t) => {
  assert.match(resumeUser("U", ""), /before any of the JSON was written/);
  const { f, sent } = fakeFetch([reply("end_turn", '{"ok":true}')]);
  t.mock.method(globalThis, "fetch", f);
  const r = await callJson({ ...base });
  assert.deepEqual(r.data, { ok: true });
  assert.equal(r.continued, undefined);
  assert.equal(sent.length, 1);
});

test("limits: the lines step has room for an 85 s script in three versions (16000), and the app's per-write cap covers the worst case", () => {
  assert.equal(HYBRID.lines.maxTokens, 16000);
  assert.ok(HYBRID.plan.maxTokens >= 12000 && HYBRID.fix.maxTokens >= 12000);
  assert.equal(APP_HYBRID.capUsd, 0.8);
});
