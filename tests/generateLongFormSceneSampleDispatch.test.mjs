import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-23 "systemic production stabilization" pass, Item E — the real
// DISPATCH half of "Generate Test Sample," explicitly deferred by the
// 2026-09-22 pass. Real Atlantis finding driving this: "The backend work
// previously reported a representative test sample, but THE BUTTON STILL
// DOES NOT EXIST IN THE REAL UI... this exact Chapter 1 generation would
// have revealed our remaining style/graphics bugs for a few credits instead
// of us generating the chapter." Source-pattern tests (consistent with this
// codebase's convention for verifying a Deno edge function's structural
// safety properties without a live Supabase instance).

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const FN = "supabase/functions/generate-long-form-scene-sample-dispatch/index.ts";
const MIGRATION = "supabase/migrations/20261001220000_long_form_sample_generation_charges.sql";

test("recomputes the sample selection server-side via the shared resolveSampleCandidates — never trusts a client-supplied beat list or credit total", async () => {
  const text = await source(FN);
  assert.match(text, /resolveSampleCandidates\(admin, worldId, planVersionId, tier\)/);
  assert.doesNotMatch(text, /body\?\.(beatIds|sampleScenes|estimatedSampleCredits)/, "must never read a client-supplied beat list or price");
});

test("charges via charge_long_form_sample_generation, passing the SERVER-recomputed beatIds/estimatedSampleCredits, never a client value", async () => {
  const text = await source(FN);
  assert.match(text, /\.rpc\("charge_long_form_sample_generation"/);
  assert.match(text, /p_beat_ids:\s*beatIds/);
  assert.match(text, /p_expected_credits:\s*estimatedSampleCredits/);
});

test("never writes long_form_projects.active_generation_charge_id or current_scene_generation_status — a sample must never look like a real committed chapter/episode generation", async () => {
  const text = await source(FN);
  // Narrowed to an actual table write (never the explanatory comment, which
  // necessarily names both columns to document that they're untouched).
  assert.doesNotMatch(text, /\.from\("long_form_projects"\)\.update\([^)]*(active_generation_charge_id|current_scene_generation_status)/s);
});

test("authorizes ONLY the sample's own beatIds (never the whole chapter/episode) and only on a fresh (non-replayed) charge", async () => {
  const text = await source(FN);
  assert.match(text, /authorizeCompiledScenesForDispatch\(admin, \{ visualWorldVersionId: worldId, beatIds, generationRunId \}\)/);
  assert.match(text, /charge\?\.charged && !charge\?\.alreadyCharged/);
});

test("verifies project ownership before doing anything — never operates on another user's project", async () => {
  const text = await source(FN);
  assert.match(text, /project\.user_id !== user\.id/);
});

test("GENERATION_ALREADY_ACTIVE maps to a clear, honest message — a sample can never silently cancel a real in-progress generation", async () => {
  const text = await source(FN);
  assert.match(text, /GENERATION_ALREADY_ACTIVE/);
  assert.match(text, /already in progress for this project/i);
});

/* ---- Migration structural checks ---- */

test("the sample charge RPC refuses to create a charge while a real chapter/episode charge is already active, before touching any balance", async () => {
  const sql = await source(MIGRATION);
  assert.match(sql, /where project_id = p_project_id and status = 'charged'/);
  assert.match(sql, /raise exception 'GENERATION_ALREADY_ACTIVE'/);
});

test("the sample charge insert never sets long_form_projects.active_generation_charge_id / current_scene_generation_status", async () => {
  const sql = await source(MIGRATION);
  const chargeFnStart = sql.indexOf("create or replace function public.charge_long_form_sample_generation");
  const chargeFnEnd = sql.indexOf("$$;", chargeFnStart);
  const body = sql.slice(chargeFnStart, chargeFnEnd);
  // Narrowed to an actual write (never the explanatory comment, which
  // necessarily names both columns to document that they're untouched).
  assert.doesNotMatch(body, /update\s+public\.long_form_projects\s+set[^;]*(active_generation_charge_id|current_scene_generation_status)/is);
});

test("the sample charge recomputes credits server-side and raises on any mismatch with the caller's expected total — never trusts a client price", async () => {
  const sql = await source(MIGRATION);
  assert.match(sql, /estimate_long_form_sample_credits\(p_project_id, p_tier, p_beat_ids\)/);
  assert.match(sql, /raise exception 'SAMPLE_PRICE_MISMATCH/);
});

test("a distinct 'sample_completed' status is used to release the charge slot — never reuses 'refunded', which would misleadingly imply the user's credits were returned", async () => {
  const sql = await source(MIGRATION);
  assert.match(sql, /'sample_completed'/);
  const closeFnStart = sql.indexOf("create or replace function public.close_long_form_sample_generation_if_done");
  const closeFnEnd = sql.indexOf("$$;", closeFnStart);
  assert.match(sql.slice(closeFnStart, closeFnEnd), /status = 'sample_completed'/);
});

test("the completion check only ever acts on a charge whose sample_beat_ids is set — a normal chapter/episode charge is structurally untouched", async () => {
  const sql = await source(MIGRATION);
  assert.match(sql, /sample_beat_ids is not null/);
});
