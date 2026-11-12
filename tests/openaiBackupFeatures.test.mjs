import test from "node:test";
import assert from "node:assert/strict";
import * as shared from "../supabase/functions/_shared/openaiBackup.js";
import * as blockyCopy from "../supabase/functions/_shared/blocky/openaiBackup.js";
import { runSceneQA } from "../supabase/functions/_shared/sceneQA.ts";
import { runCanonicalReferenceQA, runCharacterPackQA, runCharacterReferenceSheetQA, runSheetQA } from "../supabase/functions/_shared/referenceQA.ts";
import { pickHeadlines, placementLook } from "../supabase/functions/_shared/stickman/headlines.ts";
import { compileContractBatch } from "../supabase/functions/_shared/narrationVisualContract.ts";
import { callLlm as fruitLlm } from "../supabase/functions/_shared/fruit/llm.js";
import { callLlm as blockyLlm } from "../supabase/functions/_shared/blocky/llm.js";

// Each feature's real OpenAI call, with the Claude backup forced on (owner, 2026-11-05: "test each
// feature with the backup forced on"). OpenAI is never reached; "Claude" answers with a valid example of
// the very JSON schema the feature sent, and the feature's own code must take that answer as it takes
// OpenAI's. Free: nothing leaves the machine. (The Long Form script engine is covered the same way by the
// replay suite: npx deno test -A --no-check --preload tests/backupForced.preload.mjs tests/replay/)

// A valid example of a JSON schema: every property, the fewest list items allowed (at least one), the first
// enum value, numbers inside their range.
function example(schema, root = schema) {
  let s = schema ?? {};
  for (let i = 0; s.$ref && i < 20; i++) s = String(s.$ref).replace(/^#\/?/, "").split("/").reduce((o, k) => o?.[k], root) ?? {};
  if (s.anyOf || s.oneOf) return example((s.anyOf ?? s.oneOf).find((b) => b.type !== "null") ?? (s.anyOf ?? s.oneOf)[0], root);
  if ("const" in s) return s.const;
  if (Array.isArray(s.enum)) return s.enum[0];
  const type = Array.isArray(s.type) ? s.type.find((t) => t !== "null") ?? "null" : s.type ?? (s.properties ? "object" : "string");
  if (type === "object") return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, example(v, root)]));
  if (type === "array") return Array.from({ length: Math.max(1, s.minItems ?? 1) }, () => example(s.items ?? {}, root));
  if (type === "integer") return Math.max(s.minimum ?? 1, Math.min(s.maximum ?? 1, 1));
  if (type === "number") return Math.max(s.minimum ?? 0.5, Math.min(s.maximum ?? 0.5, 0.5));
  if (type === "boolean") return true;
  if (type === "null") return null;
  return "x".repeat(Math.max(1, s.minLength ?? 1));
}

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
async function forced(run, answer = (plan) => (plan.schema ? JSON.stringify(example(plan.schema)) : plan.jsonMode ? "{}" : "ok")) {
  const plans = [];
  const realFetch = globalThis.fetch;
  process.env.ANTHROPIC_API_KEY = "test-key";
  for (const m of [shared, blockyCopy]) {
    m.setBackupModeForTests("force");
    m.setClaudeTransportForTests(async (plan) => {
      plans.push(plan);
      return { status: 200, ms: 0, error: null, json: { id: "msg_t", type: "message", role: "assistant", stop_reason: "end_turn", content: [{ type: "text", text: answer(plan) }], usage: { input_tokens: 1200, output_tokens: 300 } } };
    });
  }
  globalThis.fetch = async (url) => {
    if (String(url).includes("api.openai.com")) throw new Error("OpenAI must not be reached with the backup forced on");
    return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });   // pictures the feature downloads
  };
  const failedBefore = shared.backupStats.backup_failed_forced + blockyCopy.backupStats.backup_failed_forced;
  try {
    const result = await run();
    assert.ok(plans.length >= 1, "the call went to Claude");
    for (const p of plans) assert.match(p.request.model, /^claude-(haiku|sonnet|opus)-5-5$/);
    assert.equal(shared.backupStats.backup_failed_forced + blockyCopy.backupStats.backup_failed_forced, failedBefore, "Claude's answer was taken (no backup failure)");
    return { result, plans };
  } finally {
    globalThis.fetch = realFetch;
    for (const m of [shared, blockyCopy]) { m.setBackupModeForTests(null); m.setClaudeTransportForTests(null); }
    delete process.env.ANTHROPIC_API_KEY;
  }
}
const images = (plan) => plan.request.messages.flatMap((m) => m.content).filter((b) => b.type === "image").length;

test("picture check of a Long Form scene (sceneQA): pictures and schema go to Claude, the verdict comes back", async () => {
  const { result, plans } = await forced(() => runSceneQA({ imageUrl: "https://x.supabase.co/scene.png", sceneType: "character", requiredCharacterNames: ["Ana"], locationName: "kitchen", shotSize: "medium", expectedAction: "Ana opens a jar", referenceImages: [{ url: "https://x.supabase.co/ana.png", label: "Ana" }] }));
  assert.ok(result && typeof result === "object");
  assert.ok(images(plans[0]) >= 1, "the picture is sent");
  assert.equal(plans[0].request.model, "claude-haiku-5-5");
});

test("reference sheet checks (referenceQA, all four): each goes to Claude and returns its result", async () => {
  for (const [name, run] of [
    ["runSheetQA", () => runSheetQA("identity_outfit_sheet", "https://x/sheet.png", "https://x/anchor.png")],
    ["runCharacterReferenceSheetQA", () => runCharacterReferenceSheetQA("https://x/sheet.png", "main", "flat")],
    ["runCharacterPackQA", () => runCharacterPackQA({ masterUrl: "https://x/m.png", faceUrl: "https://x/f.png", profileUrl: "https://x/p.png", backUrl: "https://x/b.png" })],
    ["runCanonicalReferenceQA", () => runCanonicalReferenceQA("https://x/c.png", { hair: "short" }, "flat")],
  ]) {
    const { result, plans } = await forced(run);
    assert.ok(result && typeof result === "object", name);
    assert.ok(images(plans[0]) >= 1, `${name} sends its pictures`);
  }
});

test("on-screen headlines (pick + placement look): Claude's answers are taken", async () => {
  const beats = Array.from({ length: 8 }, (_, i) => ({ sequence: i + 1, narrationText: `Line ${i + 1}: the jar would not open.`, contract: { textIntent: { mode: "NO_TEXT" } }, startMs: i * 4000 }));
  const picked = await forced(() => pickHeadlines("sk-test", beats, "balanced"));
  assert.ok(picked.result);
  const look = await forced(() => placementLook("sk-test", "https://x/frame.png", "Day 1"));
  assert.ok(Array.isArray(look.result.faces));
  assert.ok(images(look.plans[0]) >= 1);
});

test("narration → visual contract (Responses API): Claude's answer goes through the same parsing", async () => {
  const batch = [{ id: "s1", text: "The jar would not open." }, { id: "s2", text: "Then the lid flew off." }];
  const { result, plans } = await forced(() => compileContractBatch(batch, "sk-test", new Set(["s1", "s2"])).catch((e) => ({ error: String(e?.message ?? e) })));
  assert.equal(plans[0].kind, "responses");
  assert.ok(result, "a result (the contract's own checks may still ask for a repair: that is its job, not the backup's)");
  assert.doesNotMatch(String(result.error ?? ""), /JSON|parse|output_text|undefined/i, "no format problem");
});

for (const [product, callLlm] of [["Fruit", fruitLlm], ["Blocky", blockyLlm]]) {
  test(`${product}: the picture check and the writing calls (gpt-5-mini) are covered, cost code unchanged`, async () => {
    const schema = { type: "object", additionalProperties: false, required: ["characters", "drawnText"], properties: {
      characters: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "visible"], properties: { name: { type: "string" }, visible: { type: "boolean" } } } },
      drawnText: { type: "string" } } };
    const { result, plans } = await forced(() => callLlm({ provider: "openai", model: "gpt-5-mini", apiKey: "sk-test", system: "Check the picture.", name: "picture_check", schema,
      user: [{ type: "input_text", text: "Who is in it?" }, { type: "input_image", image_url: "https://x/frame.png" }] }));
    assert.deepEqual(result.data, { characters: [{ name: "x", visible: true }], drawnText: "x" });
    assert.ok(result.costUsd >= 0, "priced with the OpenAI model's table, as before (Claude's real cost is in the backup log)");
    assert.equal(result.response.zyvo_backup.provider, "anthropic", "the logged response says Claude answered");
    assert.equal(plans[0].request.model, "claude-haiku-5-5");
    assert.equal(images(plans[0]), 1);
    const writer = await forced(() => callLlm({ provider: "openai", model: "gpt-5.6-sol", apiKey: "sk-test", system: "Write.", user: "A story.", name: "story", schema: { type: "object", additionalProperties: false, required: ["title"], properties: { title: { type: "string" } } } }));
    assert.equal(writer.plans[0].request.model, "claude-opus-5-5");
    assert.deepEqual(writer.result.data, { title: "x" });
  });
}
