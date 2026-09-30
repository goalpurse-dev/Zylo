import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-10-02 "one project commitment" pass — source-pattern safety checks,
// matching this codebase's established convention.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const FN = "supabase/functions/create-long-form-production-setup/index.ts";

test("never calls any image/video provider endpoint — Setup only computes a quote and reserves credits", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /functions\/v1\/(runware-image|runware-video|job-worker)|ensureSceneJob|kickJobWorker/);
});

test("computes the quote via the shared, tested estimator — never an inline/duplicated calculation", async () => {
  const text = await source(FN);
  assert.match(text, /import \{ estimateLongFormProjectQuote/);
  assert.match(text, /estimateLongFormProjectQuote\(\{ targetDurationMinutes, renderTier, beatsPerMinute, creditsPerMinute \}\)/);
  // The price and plan gate come from tool_prices, checked before the profile is frozen.
  const gate = text.indexOf("loadLongFormTier(admin, user.id, renderTier)");
  assert.ok(gate > -1 && gate < text.indexOf('.rpc("create_long_form_generation_profile"'));
});

test("reserves EXACTLY the computed quote total, never a client-supplied credit amount", async () => {
  const text = await source(FN);
  assert.match(text, /p_reserved_credits:\s*quote\.totalCredits/);
  assert.doesNotMatch(text, /p_reserved_credits:\s*body/);
});

test("freezes the Production Profile before reserving — settings are locked first, reservation references that exact profile", async () => {
  const text = await source(FN);
  // Narrowed to the actual RPC-call sites (never a prose comment mentioning
  // either name, which can appear in either order and is not evidence of
  // real call order).
  const profileCallIndex = text.indexOf('.rpc("create_long_form_generation_profile"');
  const reserveCallIndex = text.indexOf('.rpc("reserve_long_form_project_credits"');
  assert.ok(profileCallIndex > -1 && reserveCallIndex > -1 && profileCallIndex < reserveCallIndex, "profile must be created before the reservation call");
  assert.match(text, /p_generation_profile_id:\s*profile\.id/);
});

test("verifies project ownership before doing anything", async () => {
  const text = await source(FN);
  assert.match(text, /project\.user_id !== user\.id/);
});

test("surfaces INSUFFICIENT_CREDITS as a clear 402 with the real quote amount, never a generic 500", async () => {
  const text = await source(FN);
  assert.match(text, /reservationError\.message\?\.includes\("INSUFFICIENT_CREDITS"\) \? 402/);
  assert.match(text, /Not enough credits/);
});
