import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-10-02 "Production Bible" pass — source-pattern safety checks for the
// edge function, matching this codebase's established convention for
// verifying a Deno function's structural safety properties without a live
// Supabase instance.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const FN = "supabase/functions/build-stickman-production-bible/index.ts";

test("never calls any image/video provider endpoint — text-LLM authoring only", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /functions\/v1\/(runware-image|runware-video|job-worker)|ensureSceneJob|kickJobWorker/);
});

test("never touches credit balance or any *_charges table — Bible authoring is a planning cost, never billed to the user", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /credit_balance\s*[-+]?=|\.from\("[a-zA-Z_]*_charges"\)|\.rpc\("charge_/);
});

test("refuses to build a Bible unless the script is genuinely LOCKED for this exact profile — narration-first is enforced, not assumed (2026-10-02: locking, not just status:ready, is now the trigger)", async () => {
  const text = await source(FN);
  assert.match(text, /!scriptVersion\.locked_at \|\| scriptVersion\.locked_generation_profile_id !== profile\.id/);
});

test("is idempotent — a frozen bible already existing for this exact (project, script, profile) is returned without a second LLM call", async () => {
  const text = await source(FN);
  assert.match(text, /\.eq\("status", "frozen"\)\.maybeSingle\(\)/);
  assert.match(text, /alreadyBuilt: true/);
});

test("requires an active Production Profile naming the Stickman recipe before doing anything — settings are read from the locked snapshot, never live project columns", async () => {
  const text = await source(FN);
  assert.match(text, /profile\.visual_recipe !== "stickman_doodle_explainer"/);
  assert.match(text, /\.from\("long_form_generation_profiles"\)/);
  assert.doesNotMatch(text, /project\.visual_style_preset|project\.scene_generation_tier/);
});

test("verifies project ownership before doing anything — never operates on another user's project", async () => {
  const text = await source(FN);
  assert.match(text, /project\.user_id !== user\.id/);
});

test("persists via the versioned freeze RPC, never a direct table write to long_form_production_bibles", async () => {
  const text = await source(FN);
  assert.match(text, /\.rpc\("freeze_long_form_production_bible"/);
  assert.doesNotMatch(text, /\.from\("long_form_production_bibles"\)\.(insert|update|upsert)/);
});

test("passes only a short research digest, never a full research dump — Section 2's explicit instruction", async () => {
  const text = await source(FN);
  assert.match(text, /\.slice\(0, 1000\)/); // researchNotes truncation
});
