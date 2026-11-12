// PAID (owner's go only, with a cap): each feature's real request, with the Claude backup forced on,
// sent to the real Claude API, to prove Anthropic accepts every format and the features take its answers.
//   node --import ./tests/setup.mjs scripts/openaiBackupRealCheck.mjs [capUsd=0.20]
// OpenAI is never called. Before each Claude call the worst case (every allowed output token) is reserved
// against the cap; a call that could cross it is not sent. Key: ANTHROPIC_API_KEY from .env.local.
import fs from "node:fs";
import * as shared from "../supabase/functions/_shared/openaiBackup.js";
import * as blockyCopy from "../supabase/functions/_shared/blocky/openaiBackup.js";
import { runSceneQA } from "../supabase/functions/_shared/sceneQA.ts";
import { runCanonicalReferenceQA, runCharacterPackQA, runCharacterReferenceSheetQA, runSheetQA } from "../supabase/functions/_shared/referenceQA.ts";
import { pickHeadlines, placementLook } from "../supabase/functions/_shared/stickman/headlines.ts";
import { compileContractBatch } from "../supabase/functions/_shared/narrationVisualContract.ts";
import { callLlm as fruitLlm } from "../supabase/functions/_shared/fruit/llm.js";
import { callLlm as blockyLlm } from "../supabase/functions/_shared/blocky/llm.js";

const CAP = Number(process.argv[2] ?? 0.20);
const OPUS_TEST_MAX_TOKENS = 3000;   // the one Opus call: its worst case stays small
const key = fs.readFileSync(".env.local", "utf8").split(/\r?\n/).find((l) => l.startsWith("ANTHROPIC_API_KEY="))?.slice(18).trim().replace(/^"|"$/g, "");
if (!key) throw new Error("no ANTHROPIC_API_KEY in .env.local");
process.env.ANTHROPIC_API_KEY = key;
const IMG = `data:image/jpeg;base64,${fs.readFileSync("public/blocky-worlds/clips/street.jpg").toString("base64")}`;

let spent = 0, reserved = 0;
const calls = [];
const realFetch = globalThis.fetch;
async function realClaude(plan) {
  const request = plan.request.model === "claude-opus-5-5" ? { ...plan.request, max_tokens: Math.min(plan.request.max_tokens, OPUS_TEST_MAX_TOKENS) } : plan.request;
  const p = shared.CLAUDE_PRICES[request.model];
  const images = request.messages.flatMap((m) => m.content).filter((b) => b.type === "image").length;
  const inputEst = JSON.stringify({ s: request.system, m: request.messages.map((m) => m.content.filter((b) => b.type === "text")) }).length / 3 + images * 1600;
  const worst = (inputEst * p.input + request.max_tokens * p.output) / 1e6;
  if (spent + reserved + worst > CAP) { calls.push({ model: request.model, refused: `would risk passing the $${CAP} cap (worst case $${worst.toFixed(4)})` }); return { status: 599, json: null, error: "cap", ms: 0 }; }
  reserved += worst;
  const t0 = Date.now();
  try {
    const r = await realFetch("https://api.anthropic.com/v1/messages", { method: "POST", signal: AbortSignal.timeout(120_000),
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json", ...(request.fallbacks ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}) },
      body: JSON.stringify(request) });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch { /* below */ }
    const usd = shared.claudeCostUsd(request.model, json?.usage) ?? 0;
    spent += usd;
    calls.push({ model: request.model, status: r.status, structured: !!request.output_config?.format, stop: json?.stop_reason, usd, ms: Date.now() - t0, error: r.ok ? undefined : String(json?.error?.message ?? text).slice(0, 200) });
    return { status: r.status, json, error: r.ok ? null : `${r.status} ${String(json?.error?.message ?? text).slice(0, 200)}`, ms: Date.now() - t0 };
  } finally { reserved -= worst; }
}
for (const m of [shared, blockyCopy]) { m.setBackupModeForTests("force"); m.setClaudeTransportForTests(realClaude); }
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("api.openai.com")) throw new Error("OpenAI must not be called in this check");
  if (u.startsWith("data:") || u.includes("api.anthropic.com")) return realFetch(url, init);
  return realFetch(IMG);   // a picture a feature downloads
};

const pictureSchema = { type: "object", additionalProperties: false, required: ["characters", "drawnText"], properties: {
  characters: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "visible"], properties: { name: { type: "string" }, visible: { type: "boolean" } } } },
  drawnText: { type: "string" } } };
const beats = Array.from({ length: 8 }, (_, i) => ({ sequence: i + 1, narrationText: ["The street was empty at dawn.", "Then the first shop opened.", "Nobody knew the baker had a secret.", "Every morning he left one loaf on the step.", "On day 30 someone left a note.", "It said: thank you.", "He never found out who.", "But the loaf is still there."][i], contract: { textIntent: { mode: "NO_TEXT" } }, startMs: i * 4000 }));
const FEATURES = [
  ["Long Form scene picture check (sceneQA)", () => runSceneQA({ imageUrl: IMG, sceneType: "location", requiredCharacterNames: [], locationName: "a city street", shotSize: "wide", expectedAction: "an empty street at dawn" })],
  ["Reference sheet check (runSheetQA)", () => runSheetQA("identity_outfit_sheet", IMG, null)],
  ["Character reference sheet check", () => runCharacterReferenceSheetQA(IMG, "main", null)],
  ["Character pack check", () => runCharacterPackQA({ masterUrl: IMG, faceUrl: IMG })],
  ["Canonical reference check", () => runCanonicalReferenceQA(IMG, { setting: "street" }, null)],
  ["Headline placement look", () => placementLook("sk-unused", IMG, "Day 30")],
  ["On-screen headline picks", () => pickHeadlines("sk-unused", beats, "balanced")],
  ["Narration → visual contract (Responses API)", () => compileContractBatch(beats.slice(0, 3).map((b) => ({ id: `s${b.sequence}`, text: b.narrationText })), "sk-unused", new Set(["s1", "s2", "s3"]))],
  ["Fruit picture check (gpt-5-mini → Haiku)", () => fruitLlm({ provider: "openai", model: "gpt-5-mini", apiKey: "sk-unused", system: "List the characters you see and any drawn text.", name: "picture_check", schema: pictureSchema, user: [{ type: "input_text", text: "Who is in this picture?" }, { type: "input_image", image_url: IMG }] })],
  ["Blocky picture check (gpt-5-mini → Haiku)", () => blockyLlm({ provider: "openai", model: "gpt-5-mini", apiKey: "sk-unused", system: "List the characters you see and any drawn text.", name: "picture_check", schema: pictureSchema, user: [{ type: "input_text", text: "Who is in this picture?" }, { type: "input_image", image_url: IMG }] })],
  ["Blocky writer (gpt-5.6-sol → Opus 5.5)", () => blockyLlm({ provider: "openai", model: "gpt-5.6-sol", apiKey: "sk-unused", system: "Write a one-line story idea for kids.", name: "idea", user: "A story about a baker.", schema: { type: "object", additionalProperties: false, required: ["title", "logline"], properties: { title: { type: "string" }, logline: { type: "string" } } } })],
];

const rows = [];
for (const [name, run] of FEATURES) {
  const before = { used: shared.backupStats.backup_used_forced + blockyCopy.backupStats.backup_used_forced, failed: shared.backupStats.backup_failed_forced + blockyCopy.backupStats.backup_failed_forced };
  const from = calls.length;
  let outcome;
  try { const r = await run(); outcome = r == null ? "returned nothing" : "ok"; }
  catch (e) { outcome = `threw: ${String(e?.message ?? e).slice(0, 160)}`; }
  const used = shared.backupStats.backup_used_forced + blockyCopy.backupStats.backup_used_forced - before.used;
  const failed = shared.backupStats.backup_failed_forced + blockyCopy.backupStats.backup_failed_forced - before.failed;
  const mine = calls.slice(from);
  rows.push({ name, outcome, claudeAnswersTaken: used, backupFailed: failed, calls: mine.map((c) => c.refused ? `REFUSED: ${c.refused}` : `${c.model} ${c.status}${c.structured ? " json" : " prompt-json"} ${c.stop ?? ""} $${(c.usd ?? 0).toFixed(5)}${c.error ? ` ERR ${c.error}` : ""}`) });
}
globalThis.fetch = realFetch;
for (const r of rows) { console.log(`${r.backupFailed || r.outcome !== "ok" ? "✖" : "✔"} ${r.name}: ${r.outcome}; Claude answers taken ${r.claudeAnswersTaken}, backup failures ${r.backupFailed}`); for (const c of r.calls) console.log(`     ${c}`); }
const failures = [...shared.backupStats.notes, ...blockyCopy.backupStats.notes].filter((n) => n.startsWith("backup_failed"));
for (const f of failures) console.log("  FAILED:", f.slice(0, 300));
console.log(`spent $${spent.toFixed(4)} of the $${CAP} cap on ${calls.filter((c) => !c.refused).length} Claude calls`);
