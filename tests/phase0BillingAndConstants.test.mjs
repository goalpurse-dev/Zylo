import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Phase 0 — Billing correctness, shared constants, and the picker-image fix.
// Source-pattern checks (this test file has no live Postgres connection —
// the actual RPC BEHAVIOR — release/settle/commit idempotency, partial
// refunds, ceiling enforcement — is verified separately by
// tests/longFormReservations.lifecycle.sql, run manually against the linked
// database wrapped in BEGIN/ROLLBACK per this repo's established
// .lifecycle.sql convention).

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

// ============================================================================
// Section C.1/C.2/C.3 — one shared source of truth for constants that used
// to be independently duplicated (and had drifted).
// ============================================================================

test("longFormPipelineConstants.ts is the one shared source for WORDS_PER_MINUTE (145), RECIPE_BEATS_PER_MINUTE (Stickman=15), and gpt-5-mini/gpt-4o-mini pricing", async () => {
  const text = await source("src/lib/longFormPipelineConstants.ts");
  assert.match(text, /export const WORDS_PER_MINUTE = 145;/);
  assert.match(text, /export const RECIPE_BEATS_PER_MINUTE: Record<string, number> = \{\s*STICKMAN_DOODLE_EXPLAINER_V1: 15,/);
  assert.match(text, /export const GPT5_MINI_INPUT_PER_M = 0\.25;/);
  assert.match(text, /export const GPT5_MINI_OUTPUT_PER_M = 2\.0;/);
  assert.match(text, /export const GPT4O_MINI_INPUT_PER_M = 0\.15;/);
  assert.match(text, /export const GPT4O_MINI_OUTPUT_PER_M = 0\.6;/);
  assert.match(text, /export const QA_CALL_ESTIMATED_COST_USD/);
});

test("WORDS_PER_MINUTE (145) is imported, never re-declared, by every file that used to hardcode its own copy (150 in three backend files, 145 separately in the frontend)", async () => {
  const files = [
    "supabase/functions/generate-long-form-story-plan/index.ts",
    "supabase/functions/advance-long-form-script/index.ts",
    "supabase/functions/_shared/visualShotPlanning.js",
    "src/pages/workspace/long-form/lengthEstimates.js",
  ];
  for (const file of files) {
    const text = await source(file);
    assert.doesNotMatch(text, /(?<!\.)\bconst WORDS_PER_MINUTE\s*=\s*1[45]0\b/, `${file} must not re-declare its own WORDS_PER_MINUTE`);
    assert.match(text, /WORDS_PER_MINUTE/, `${file} must still reference WORDS_PER_MINUTE (via import)`);
  }
  const storyPlan = await source("supabase/functions/generate-long-form-story-plan/index.ts");
  assert.match(storyPlan, /import \{ WORDS_PER_MINUTE \} from "\.\.\/\.\.\/\.\.\/src\/lib\/longFormPipelineConstants\.ts";/);
  const script = await source("supabase/functions/advance-long-form-script/index.ts");
  assert.match(script, /import \{ WORDS_PER_MINUTE, GPT5_MINI_INPUT_PER_M, GPT5_MINI_OUTPUT_PER_M \} from "\.\.\/\.\.\/\.\.\/src\/lib\/longFormPipelineConstants\.ts";/);
  const shotPlanning = await source("supabase/functions/_shared/visualShotPlanning.js");
  assert.match(shotPlanning, /import \{ WORDS_PER_MINUTE \} from "\.\.\/\.\.\/\.\.\/src\/lib\/longFormPipelineConstants\.ts";/);
  const lengthEstimates = await source("src/pages/workspace/long-form/lengthEstimates.js");
  assert.match(lengthEstimates, /import \{ WORDS_PER_MINUTE, RECIPE_BEATS_PER_MINUTE \} from "\.\.\/\.\.\/\.\.\/lib\/longFormPipelineConstants\.ts";/);
});

test("the frontend's scene-count estimate reads the SAME RECIPE_BEATS_PER_MINUTE map the real credit quote uses (dropped the independent SCENES_PER_MINUTE_ESTIMATE=16.25 guess)", async () => {
  const lengthEstimates = await source("src/pages/workspace/long-form/lengthEstimates.js");
  assert.doesNotMatch(lengthEstimates, /=\s*16\.25/, "16.25 must not be assigned as a live value anymore (comments referencing the old guess are fine)");
  assert.match(lengthEstimates, /const SCENES_PER_MINUTE_ESTIMATE = RECIPE_BEATS_PER_MINUTE\.STICKMAN_DOODLE_EXPLAINER_V1;/);
  const setup = await source("supabase/functions/create-long-form-production-setup/index.ts");
  assert.doesNotMatch(setup, /const RECIPE_BEATS_PER_MINUTE: Record<string, number> = \{/, "must import the shared map, not re-declare its own");
  assert.match(setup, /import \{ RECIPE_BEATS_PER_MINUTE \} from "\.\.\/\.\.\/\.\.\/src\/lib\/longFormPipelineConstants\.ts";/);
});

test("GPT5_MINI_INPUT_PER_M/OUTPUT_PER_M are no longer independently declared in any of the 7 files that used to duplicate them", async () => {
  const files = [
    "supabase/functions/advance-long-form-research/index.ts",
    "supabase/functions/advance-long-form-script/index.ts",
    "supabase/functions/advance-long-form-visual-plan/index.ts",
    "supabase/functions/advance-long-form-visual-world/index.ts",
    "supabase/functions/repair-long-form-visual-plan-focal-subjects/index.ts",
    "supabase/functions/repair-long-form-visual-plan-semantic-bindings/index.ts",
    "supabase/functions/_shared/narrationVisualContract.ts",
    "supabase/functions/_shared/stickman/productionBible.ts",
  ];
  for (const file of files) {
    const text = await source(file);
    assert.doesNotMatch(text, /^const GPT5_MINI_INPUT_PER_M\s*=/m, `${file} must not re-declare GPT5_MINI_INPUT_PER_M`);
    assert.doesNotMatch(text, /^const GPT5_MINI_OUTPUT_PER_M\s*=/m, `${file} must not re-declare GPT5_MINI_OUTPUT_PER_M`);
    assert.match(text, /GPT5_MINI_INPUT_PER_M/, `${file} must still import/use GPT5_MINI_INPUT_PER_M`);
  }
});

// ============================================================================
// Section C.4 — credit-price mirror drift. The REAL, live-verified values
// (confirmed via a direct query against the linked database's
// long_form_tier_generate_credits/long_form_tier_edit_credits, which are
// what actually charges users) are v2=2/v3=3/v4=4 generate, 1 for every
// tier edit — these ALREADY matched src/lib/providers.ts exactly; only the
// disclosed-non-authoritative JS mirror (sceneGenerationPricing.ts) had
// drifted (it said v4=5, edit=2 — stale relative to a later migration that
// superseded the one its own header comment cited).
// ============================================================================

test("sceneGenerationPricing.ts's mirror values match the REAL, currently-live SQL pricing functions (verified 2026 against the linked DB) and src/lib/providers.ts's registered credits for the same tools", async () => {
  const mirror = await source("supabase/functions/_shared/sceneGenerationPricing.ts");
  assert.match(mirror, /return tier === "v2" \? 2 : tier === "v4" \? 4 : 3;/, "generate credits must be v2=2, v3=3, v4=4");
  assert.match(mirror, /return 1;/, "edit credits must be 1 for every tier");

  // Cross-check against the LATEST migration that defines each SQL function
  // (only the highest-timestamp `create or replace` for each is actually
  // live) rather than an earlier, superseded one.
  const generateMigration = await source("supabase/migrations/20260930180000_long_form_dimension_policy_and_seedream_lite.sql");
  assert.match(generateMigration, /select case p_tier when 'v2' then 2 when 'v3' then 3 when 'v4' then 4 else 3 end/);
  const editMigration = await source("supabase/migrations/20260930190000_long_form_scene_operation_pricing.sql");
  assert.match(editMigration, /select 1\s*\$\$;/);

  // And against providers.ts's own registered credits for the exact 4 tools
  // Long Form scene generation actually dispatches to.
  const providers = await source("src/lib/providers.ts");
  assert.match(providers, /"image:flux2\.klein9bkv":[\s\S]{0,350}credits:\s*2,/); // v2 generate
  assert.match(providers, /"image:kling\.o3":\s*\{[\s\S]{0,350}credits:\s*3,/); // v3 generate
  assert.match(providers, /"image:seedream5lite":[\s\S]{0,350}credits:\s*4,/); // v4 generate
  assert.match(providers, /"image:qwen\.image-edit-plus":[\s\S]{0,350}credits:\s*1,/); // edit, all tiers
});

test("scene QA (sceneQA.ts) now records a real internal_cost_usd for every gpt-4o-mini vision call, computed from that call's own reported token usage", async () => {
  const text = await source("supabase/functions/_shared/sceneQA.ts");
  assert.match(text, /import \{ GPT4O_MINI_INPUT_PER_M, GPT4O_MINI_OUTPUT_PER_M, QA_CALL_ESTIMATED_COST_USD \} from "\.\.\/\.\.\/\.\.\/src\/lib\/longFormPipelineConstants\.ts";/);
  assert.match(text, /internalCostUsd\?:\s*number;/);
  assert.match(text, /const usage = payload\.usage;/);
  assert.match(text, /const internalCostUsd = usage/);
  assert.match(text, /return \{ \.\.\.rest, \.\.\.classification, internalCostUsd \};/);
});

// ============================================================================
// Section B — credit reservation lifecycle wiring. Behavior (idempotency,
// partial refunds, ceiling enforcement) is verified live by
// tests/longFormReservations.lifecycle.sql; these checks confirm the wiring
// itself exists at every required call site.
// ============================================================================

test("_shared/longFormReservations.ts exists and exports the release/settle/commit helpers every call site below uses", async () => {
  const text = await source("supabase/functions/_shared/longFormReservations.ts");
  assert.match(text, /export async function releaseReservationIfActive/);
  assert.match(text, /export async function settleReservationIfActive/);
  assert.match(text, /export async function commitReservationSpend/);
  assert.match(text, /release_long_form_reservation/);
  assert.match(text, /settle_long_form_reservation/);
});

test("delete-long-form-project releases an active reservation AFTER the soft-delete succeeds", async () => {
  const text = await source("supabase/functions/delete-long-form-project/index.ts");
  assert.match(text, /import \{ releaseReservationIfActive \} from "\.\.\/_shared\/longFormReservations\.ts";/);
  const deleteIdx = text.indexOf(".update({ deleted_at:");
  const releaseIdx = text.indexOf("releaseReservationIfActive(admin, projectId,");
  assert.ok(deleteIdx > -1 && releaseIdx > deleteIdx, "release must be called AFTER the delete update, not before");
});

test("generate-long-form-narration-audio settles the reservation on 'ready' (the current end of the real pipeline) and releases it on a genuine 'failed' — never on alignment_failed, since real usable audio exists then", async () => {
  const text = await source("supabase/functions/generate-long-form-narration-audio/index.ts");
  assert.match(text, /import \{ settleReservationIfActive, releaseReservationIfActive \} from "\.\.\/_shared\/longFormReservations\.ts";/);
  const readyBlock = text.slice(text.indexOf('status: "ready"'), text.indexOf('status: "alignment_failed"'));
  assert.match(readyBlock, /settleReservationIfActive\(admin, projectId, "narration_ready"/);
  const alignmentFailedBlock = text.slice(text.indexOf('status: "alignment_failed"'), text.indexOf("} catch (e) {"));
  assert.doesNotMatch(alignmentFailedBlock, /releaseReservationIfActive|settleReservationIfActive/, "alignment_failed preserves real audio — must not release/settle");
  const catchBlock = text.slice(text.indexOf("} catch (e) {"));
  assert.match(catchBlock, /releaseReservationIfActive\(admin, projectId, "narration_failed"/);
});

test("every terminal script-generation failure path releases the reservation (draft validation, stage-attempts-exhausted, model-call-cap, cost-ceiling, missing-prerequisites)", async () => {
  const text = await source("supabase/functions/advance-long-form-script/index.ts");
  assert.match(text, /import \{ releaseReservationIfActive \} from "\.\.\/_shared\/longFormReservations\.ts";/);
  const reasons = [
    "script_draft_validation_failed",
    "script_stage_attempts_exhausted",
    "script_model_call_cap_exceeded",
    "script_cost_ceiling_exceeded",
    "script_project_plan_or_research_missing",
  ];
  for (const reason of reasons) {
    assert.match(text, new RegExp(`releaseReservationIfActive\\(admin, row\\.project_id, "${reason}"`), `missing release call for ${reason}`);
  }
});

test("every terminal research failure path releases the reservation (stage-attempts-exhausted, missing-prerequisites)", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  assert.match(text, /import \{ releaseReservationIfActive \} from "\.\.\/_shared\/longFormReservations\.ts";/);
  assert.match(text, /releaseReservationIfActive\(admin, row\.project_id, "research_stage_attempts_exhausted"/);
  assert.match(text, /releaseReservationIfActive\(admin, row\.project_id, "research_project_or_plan_missing"/);
});

test("a Story Plan failure (which can happen AFTER Setup already reserved credits, since Story Plan runs on its own separate page) releases the reservation", async () => {
  const text = await source("supabase/functions/generate-long-form-story-plan/index.ts");
  assert.match(text, /import \{ releaseReservationIfActive \} from "\.\.\/_shared\/longFormReservations\.ts";/);
  assert.match(text, /releaseReservationIfActive\(admin, projectId, "story_plan_failed"/);
});

test("retry_long_form_scene and edit_long_form_scene draw down against an active reservation via commit_long_form_reservation_spend, falling back to a direct debit (logged to system_logs) ONLY when NO_RESERVATION is returned", async () => {
  const text = await source("supabase/migrations/20261005100000_long_form_retry_edit_commit_against_reservation.sql");
  const retryFn = text.slice(text.indexOf("function public.retry_long_form_scene"), text.indexOf("function public.edit_long_form_scene"));
  assert.match(retryFn, /commit_result := public\.commit_long_form_reservation_spend\(v\.project_id, price\);/);
  assert.match(retryFn, /if commit_result = 'NO_RESERVATION' then/);
  assert.match(retryFn, /insert into public\.system_logs/);
  const editFn = text.slice(text.indexOf("function public.edit_long_form_scene"));
  assert.match(editFn, /commit_result := public\.commit_long_form_reservation_spend\(v\.project_id, price\);/);
  assert.match(editFn, /if commit_result = 'NO_RESERVATION' then/);
  assert.match(editFn, /insert into public\.system_logs/);
  // Idempotency is unchanged/preserved from the pre-existing design in both
  // functions — the replaces_scene_id lookup happens BEFORE any pricing
  // logic runs, so a double-click never reaches the charging block twice
  // regardless of which of the two charging paths fires.
  for (const fn of [retryFn, editFn]) {
    const replacesIdx = fn.indexOf("where replaces_scene_id = sc.id;");
    const commitIdx = fn.indexOf("commit_long_form_reservation_spend");
    assert.ok(replacesIdx > -1 && replacesIdx < commitIdx, "the existing replaces_scene_id idempotency check must run before any charge");
  }
});

test("the reconciliation script defaults to a safe dry-run (requires an explicit --apply flag) and only ever mutates data through the same release/settle RPCs the live pipeline uses", async () => {
  const text = await source("scripts/reconcileLongFormReservations.mjs");
  assert.match(text, /const APPLY = process\.argv\.includes\("--apply"\);/);
  assert.match(text, /if \(!APPLY\) \{/);
  assert.match(text, /console\.log\("\\nDry run only/);
  assert.doesNotMatch(text, /credit_balance\s*[-+]?=/, "must never touch credit_balance directly — only via the RPCs");
  assert.match(text, /admin\.rpc\(rpc,/);
});

// ============================================================================
// Section A — the picker-image regression fix.
// ============================================================================

test("ImageWithFallback shows a loading skeleton (never the fallback tile) while pending, uses decoding=async, and both picker modals preload every real image URL on open — see tests/productionSetupUxRework.test.mjs for the full assertions", async () => {
  const text = await source("src/pages/workspace/long-form/ProductionSetup.jsx");
  assert.match(text, /function preloadImages\(urls\) \{/);
  assert.match(text, /decoding="async"/);
  assert.doesNotMatch(text, /(?<!`)loading="lazy"(?!`)/);
});
