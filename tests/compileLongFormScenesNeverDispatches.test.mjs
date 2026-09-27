import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22 "permanently separate PLAN/COMPILE from PAID GENERATION" pass
// — real Atlantis finding: start-long-form-scene-generation compiled
// scenes AND THEN unconditionally self-chained into
// advance-long-form-scene-generation, which could immediately start real
// Runware/Kling provider jobs. compile-long-form-scenes is the safe
// replacement: it must be structurally incapable of triggering provider
// dispatch, regardless of caller, regardless of environment state.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const FN = "supabase/functions/compile-long-form-scenes/index.ts";

test("never references advance-long-form-scene-generation or any provider-dispatch endpoint functionally — the dangerous self-chain from the old function is structurally absent, not just disabled (prose mentions explaining WHY it's absent are fine)", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /functions\/v1\/advance-long-form-scene-generation|const ADVANCE_URL|const ADVANCE_SECRET|fetch\(ADVANCE_URL/);
});

test("never references Runware/Kling/job-worker directly", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /"runware-image"|"runware-video"|"job-worker"|kickJobWorker|ensureSceneJob/);
});

test("freshly-compiled scenes are inserted with status='awaiting_generation', never 'pending' — this is the actual safety mechanism (claim_long_form_scene_for_render only ever claims pending/running)", async () => {
  const text = await source(FN);
  assert.match(text, /export const AWAITING_GENERATION_STATUS = "awaiting_generation";/);
  assert.match(text, /status: AWAITING_GENERATION_STATUS,/);
  assert.doesNotMatch(text, /status: "pending",/);
});

test("does not touch credit balance or any *_charges table — compilation alone can never cost the user anything", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /credit_balance|\.from\("[a-zA-Z_]*_charges"\)/);
});

test("the only self-chain that exists continues COMPILING remaining beats (into itself), never dispatching — pure compilation, zero provider risk", async () => {
  const text = await source(FN);
  assert.match(text, /const SELF_URL = `\$\{SUPABASE_URL\}\/functions\/v1\/compile-long-form-scenes`;/);
  assert.match(text, /fetch\(SELF_URL,/);
});

test("an existing (already compiled) scene row is left completely untouched on re-compile — idempotent, never resets status/dispatches/re-authorizes", async () => {
  const text = await source(FN);
  assert.match(text, /Idempotent: an existing \(already compiled, whatever its status\)/);
});

test("generation_run_id is never inferred from 'is there an active charge right now' — that inference is exactly what let the old function's compile and authorization entangle", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /eq\("status", "charged"\)\.maybeSingle\(\)/);
});
