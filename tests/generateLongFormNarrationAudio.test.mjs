import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-10-02 "real narration audio master timeline" pass — source-pattern
// safety checks for the durable TTS trigger+worker.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const FN = "supabase/functions/generate-long-form-narration-audio/index.ts";

test("never calls any image/video provider — voice synthesis only", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /functions\/v1\/(runware-image|runware-video|job-worker)|ensureSceneJob|kickJobWorker/);
});

test("dispatches the real synthesis work via EdgeRuntime.waitUntil — never blocks the HTTP response on the provider call (durability)", async () => {
  const text = await source(FN);
  assert.match(text, /rt\.waitUntil\(work\)/);
  assert.match(text, /const work = doGeneration\(/);
});

test("is idempotent by (project, request_hash) — an existing 'ready' row is returned without a new provider call", async () => {
  const text = await source(FN);
  assert.match(text, /existing\?\.status === "ready"/);
  assert.match(text, /alreadyGenerated: true/);
});

test("an alignment_failed row is never silently re-synthesized — the caller is told to reconcile instead", async () => {
  const text = await source(FN);
  assert.match(text, /existing\?\.status === "alignment_failed"/);
  assert.match(text, /needsReconcile: true/);
});

test("refuses to generate unless the script is locked for this exact profile — narration-first enforced", async () => {
  const text = await source(FN);
  assert.match(text, /!scriptVersion\.locked_at \|\| scriptVersion\.locked_generation_profile_id !== profile\.id/);
});

test("never commits reservation credits for narration — TTS is currently absorbed internally (documented billing policy)", async () => {
  const text = await source(FN);
  // Narrowed to an actual RPC call (never the explanatory comment, which
  // necessarily names the function to document that it's NOT called).
  assert.doesNotMatch(text, /\.rpc\("commit_long_form_reservation_spend"/);
  assert.match(text, /ABSORBED by Zyvo internally/);
});

test("manual regeneration allowance is checked and incremented ONLY when manual:true — the automatic Lock-Story trigger never consumes it", async () => {
  const text = await source(FN);
  assert.match(text, /if \(manual\) \{/);
  assert.match(text, /manual_tts_regenerations_used >= project\.included_manual_tts_regenerations/);
});

test("preserves a successful audio_url even when alignment mapping fails, and never discards the raw provider alignment", async () => {
  const text = await source(FN);
  assert.match(text, /status: "alignment_failed", audio_url: publicUrl\.publicUrl/);
});

test("verifies project ownership before doing anything", async () => {
  const text = await source(FN);
  assert.match(text, /project\.user_id !== user\.id/);
});
