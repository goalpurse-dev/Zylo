import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22 "permanently separate PLAN/COMPILE from PAID GENERATION" pass
// — §9's explicit ask: "Provider dispatch should require something
// equivalent to generation_authorized = true ... without explicit
// authorization, provider dispatch must return without creating a job."
// This is a SECOND, independent gate at the dispatch function itself
// (the PRIMARY gate is compile-long-form-scenes never producing a
// claimable status at all) — defense in depth for any scene that reaches
// claim_long_form_scene_for_render as 'pending' with no valid backing
// charge. Project/version-scoped via generation_run_id, deliberately never
// a global environment flag (§9 explicitly forbids LONG_FORM_SCENE_PAUSED
// as the mechanism here).

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const FN = "supabase/functions/advance-long-form-scene-generation/index.ts";

test("a claimed scene with NO generation_run_id at all is refused — reverted to awaiting_generation, no provider job created", async () => {
  const text = await source(FN);
  assert.match(text, /A claimed scene with NO generation_run_id at all has never been/);
  const block = text.slice(text.indexOf("if (scene.generation_run_id) {"), text.indexOf("try {\n      const { data: plan"));
  assert.match(block, /status: "awaiting_generation"/);
  assert.match(block, /return json\(\{ claimed: false, unauthorized: true \}\);/);
});

test("a claimed scene whose generation_run_id points to a charge that is NOT status='charged' (refunded/superseded/etc) is refused the same way", async () => {
  const text = await source(FN);
  const block = text.slice(text.indexOf("if (scene.generation_run_id) {"), text.indexOf("try {\n      const { data: plan"));
  assert.match(block, /run\.status !== "charged"/);
});

test("a claimed scene whose charge is currently paused is refused — the pause check is authoritative even for an otherwise-valid charge", async () => {
  const text = await source(FN);
  const block = text.slice(text.indexOf("if (scene.generation_run_id) {"), text.indexOf("try {\n      const { data: plan"));
  assert.match(block, /run\.is_paused/);
});

test("an unauthorized scene is reverted, never left stuck in a claimed/running state, and its claim_attempts is un-incremented (an unauthorized attempt must never burn the real retry budget)", async () => {
  const text = await source(FN);
  const block = text.slice(text.indexOf("if (scene.generation_run_id) {"), text.indexOf("try {\n      const { data: plan"));
  assert.match(block, /claim_attempts: Math\.max\(0, \(scene\.claim_attempts \?\? 1\) - 1\)/);
  assert.match(block, /lease_until: null, job_id: null/);
});

test("this gate is never gated by the global LONG_FORM_SCENE_PAUSED flag — it is a per-scene, per-charge check, independent of any environment variable", async () => {
  const text = await source(FN);
  const block = text.slice(text.indexOf("if (scene.generation_run_id) {"), text.indexOf("try {\n      const { data: plan"));
  assert.doesNotMatch(block, /SCENE_PAUSED/);
});
