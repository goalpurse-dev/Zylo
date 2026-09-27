import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22 "permanently separate PLAN/COMPILE from PAID GENERATION" pass
// — §6/§7/§12: the QUOTE half of "Generate Test Sample." Must be provably
// read-only: no charge, no authorization flip, no dispatch, no write of any
// kind — real Atlantis findings elsewhere this session showed how easily
// compile and paid generation can entangle, so this endpoint is tested to
// structurally never touch money or scene state.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const FN = "supabase/functions/generate-long-form-scene-sample/index.ts";

test("never writes to long_form_scenes or long_form_scene_render_plans — read-only by construction", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /\.from\("long_form_scenes"\)\.(update|insert|upsert)/);
  assert.doesNotMatch(text, /\.from\("long_form_scene_render_plans"\)\.(update|insert|upsert)/);
});

test("never touches credit balance or any *_charges table — a quote can never cost the user anything", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /credit_balance|\.from\("[a-zA-Z_]*_charges"\)|\.rpc\("charge_/);
});

test("never calls compile-long-form-scenes, advance-long-form-scene-generation, or any provider-dispatch endpoint — quote only, never compiles or dispatches", async () => {
  const text = await source(FN);
  assert.doesNotMatch(text, /functions\/v1\/(compile-long-form-scenes|advance-long-form-scene-generation|start-long-form-scene-generation)/);
});

test("returns charged:false explicitly, so a caller can never mistake a quote response for a real charge", async () => {
  const text = await source(FN);
  assert.match(text, /charged: false,/);
});

test("returns an actionable 409 (not an empty sample) when nothing has been compiled yet", async () => {
  const text = await source(FN);
  assert.match(text, /No scenes have been compiled yet.*compile scenes first/i);
  assert.match(text, /409\)/);
});

test("selection is delegated to the shared, generic resolveSampleCandidates/selectRepresentativeSampleScenes — never a bespoke/topic-specific pick here", async () => {
  const text = await source(FN);
  assert.match(text, /import \{ resolveSampleCandidates \}/);
  assert.match(text, /resolveSampleCandidates\(admin, worldId, planVersionId, tier\)/);
  // 2026-09-23 Item E: resolveSampleCandidates (sceneSampleSelection.ts) is
  // now the ONE shared implementation both this quote endpoint and
  // generate-long-form-scene-sample-dispatch's charge call, so the two can
  // never disagree about what "the sample" means — verified directly on
  // that shared module rather than requiring this endpoint to import
  // selectRepresentativeSampleScenes itself.
  const shared = await source("supabase/functions/_shared/sceneSampleSelection.ts");
  assert.match(shared, /selectRepresentativeSampleScenes\(candidates\)/);
});

test("verifies project ownership before returning anything — never leaks another user's plan", async () => {
  const text = await source(FN);
  assert.match(text, /project\.user_id !== user\.id/);
});
