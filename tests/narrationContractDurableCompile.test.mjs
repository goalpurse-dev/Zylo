import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 2026-09-20 real production incident: a fresh "What if the Moon
// disappeared?" project (id f7dc5503-7875-44de-bf9b-8dc2f122d803, visual
// plan f05c217f-49c2-4d21-8851-446ac06ba93b) got stuck at "Interpreting your
// narration into visual beats" — confirmed live via read-only DB inspection:
// TWO separate long_form_narration_contract_versions rows for the same
// script version (38003bc1-..., c1453f2e-...), both status='compiling' with
// zero saved claims. Root cause: compileNarrationVisualContract ran ALL
// chapter batches inside one uninterruptible ensureNarrationContract call,
// persisting nothing until the very end — the platform's own wall-clock
// limit killed the invocation mid-compile, and since a "compiling" row was
// never resumed (only ever replaced by inserting a brand-new one), every
// retry lost all prior progress. These tests cover the fix source-
// structurally (this codebase's established pattern for Deno edge-function
// logic a plain Node test can't import directly — see narrationContract
// MandatoryV1.test.mjs's own module comment for why: the OpenAI org's own
// credit exhaustion already made a live end-to-end run impossible before
// today, and this Node runtime additionally can't resolve this file's own
// "jsr:" Deno import at all, a pre-existing, unrelated environment gap).

const src = fs.readFileSync(new URL("../supabase/functions/advance-long-form-visual-plan/index.ts", import.meta.url), "utf8");
const migrationSql = fs.readFileSync(new URL("../supabase/migrations/20260930400000_long_form_narration_contract_durable_batches.sql", import.meta.url), "utf8");
const contractFn = src.slice(src.indexOf("export async function ensureNarrationContract"), src.indexOf("async function fetchExistingCast"));

test("migration adds the durable-batch checkpoint columns (batches/stage_attempt/worker_lock_until) to the contract table", () => {
  assert.match(migrationSql, /add column if not exists batches jsonb/);
  assert.match(migrationSql, /add column if not exists stage_attempt integer not null default 0/);
  assert.match(migrationSql, /add column if not exists worker_lock_until timestamptz/);
});

test("an in-progress compiler for the SAME (project, script_version_id, compiler_version) is looked up and reused, never re-inserted unconditionally", () => {
  assert.match(contractFn, /\.eq\("script_version_id", project\.current_script_version_id\)\s*\n\s*\.eq\("compiler_version", NARRATION_CONTRACT_COMPILER_VERSION\)\s*\n\s*\.eq\("status", "compiling"\)/);
});

test("a compiling row with a LIVE (unexpired) lease is left alone — no duplicate concurrent compiler, no reclaim", () => {
  const block = contractFn.slice(contractFn.indexOf("let contractRow = compiling;"), contractFn.indexOf("const priorLock"));
  assert.match(block, /new Date\(contractRow\.worker_lock_until\)\.getTime\(\) > Date\.now\(\)/);
  assert.match(block, /return \{ ready: false \};/);
});

test("claiming a compiling row is fenced on the exact lease value just read (optimistic concurrency) — a racing claim affects 0 rows instead of both proceeding", () => {
  const block = contractFn.slice(contractFn.indexOf("const priorLock = contractRow.worker_lock_until;"), contractFn.indexOf("} else {"));
  assert.match(block, /claimQuery = priorLock == null \? claimQuery\.is\("worker_lock_until", null\) : claimQuery\.eq\("worker_lock_until", priorLock\)/);
  assert.match(block, /if \(!claimed\) return \{ ready: false \};/, "losing the claim race must return not-ready, never proceed as if we owned the row");
});

test("an expired lease past MAX_CONTRACT_STAGE_ATTEMPTS terminally fails the contract with a real recorded reason, never retries forever", () => {
  const block = contractFn.slice(contractFn.indexOf("if ((contractRow.stage_attempt"), contractFn.indexOf("const priorLock"));
  assert.match(block, />= MAX_CONTRACT_STAGE_ATTEMPTS\)/);
  assert.match(block, /last_error_code: "NARRATION_CONTRACT_STAGE_ATTEMPTS_EXHAUSTED"/);
  assert.match(block, /throw new Error\("NARRATION_CONTRACT_COMPILE_FAILED"\);/);
});

test("reserve() is called exactly once — only when starting a brand-new compiler — never on a resumed/claimed row", () => {
  const reserveCalls = [...contractFn.matchAll(/await reserve\(\);/g)];
  assert.equal(reserveCalls.length, 1, "resuming an in-progress compiler across many chapter batches must not spend a new reservation per batch");
  const reserveIdx = contractFn.indexOf("await reserve();");
  const elseIdx = contractFn.indexOf("} else {");
  assert.ok(reserveIdx > elseIdx, "reserve() must live in the fresh-insert branch, not the resume branch");
});

test("only ONE pending batch is processed per call — the single unit of checkpointed work — never the whole remaining queue", () => {
  const block = contractFn.slice(contractFn.indexOf("const idx = batches.findIndex"), contractFn.indexOf("// Every batch succeeded"));
  assert.match(block, /const idx = batches\.findIndex\(\(b: any\) => b\.status !== "succeeded"\);/);
  assert.doesNotMatch(block, /for \(const batch of batches\)/, "must not loop over all remaining batches in one call");
  assert.match(block, /compileContractBatch\(batches\[idx\]\.input, OPENAI_KEY, validSegmentIds\)/);
});

test("a batch call failure releases the lease for retry (bounded by stage_attempt) without discarding batches already succeeded", () => {
  const block = contractFn.slice(contractFn.indexOf("// A real call failure"), contractFn.indexOf("const updatedBatches = batches.map"));
  assert.match(block, /update\(\{ worker_lock_until: null \}\)/);
  assert.match(block, /return \{ ready: false \};/);
  assert.doesNotMatch(block, /status: "failed"/, "a single batch call failure must not itself terminally fail the contract — that's MAX_CONTRACT_STAGE_ATTEMPTS's job");
});

test("a successful batch persist resets stage_attempt to 0 and is itself fenced on the claimed lease — an old worker that wakes up late can't overwrite a newer attempt", () => {
  const block = contractFn.slice(contractFn.indexOf("const updatedBatches = batches.map"), contractFn.indexOf("// Every batch succeeded"));
  assert.match(block, /stage_attempt: 0, worker_lock_until: null/);
  assert.match(block, /\.eq\("worker_lock_until", contractRow\.worker_lock_until\)/);
  assert.match(block, /if \(!persisted\) return \{ ready: false \};/, "a fenced-out write (superseded by a newer attempt) must never be trusted as if it succeeded");
});

test("finalization only runs once every batch has succeeded, and marks the contract failed (never silently 'ready') on incomplete coverage", () => {
  const block = contractFn.slice(contractFn.indexOf("// Every batch succeeded"));
  assert.match(block, /if \(!claims\.length \|\| totalDropped \|\| segments\.some/);
  assert.match(block, /throw new Error\("NARRATION_CONTRACT_INCOMPLETE: repair semantic claims before planning"\);/);
  assert.match(block, /status: "ready", claims, stats/);
});

test("stagePlanning's early-return path clears the VISUAL PLAN row's own lease so the self-chain can re-claim immediately, instead of waiting out the full outer stage lease between every chapter batch", () => {
  const fn = src.slice(src.indexOf("async function stagePlanning"), src.indexOf("async function stageFinalizing"));
  const block = fn.slice(fn.indexOf("if (!contractResult.ready) {"), fn.indexOf("const contractVersionId = contractResult.id;"));
  assert.match(block, /stage_attempt: 0, worker_lock_until: null/);
});

test("compileContractBatch is exported from the shared module and used for the single-batch checkpointed call (not the old all-at-once compileNarrationVisualContract)", () => {
  const sharedSrc = fs.readFileSync(new URL("../supabase/functions/_shared/narrationVisualContract.ts", import.meta.url), "utf8");
  assert.match(sharedSrc, /export async function compileContractBatch\(/);
  assert.match(src, /import \{ compileContractBatch, batchSegmentsByChapter, NARRATION_CONTRACT_COMPILER_VERSION \} from "\.\.\/_shared\/narrationVisualContract\.ts";/);
});

test("look.jsx's visual-plan progress screen passes stageStartedAt/workerLockUntil to GenerationExperience — previously entirely absent, meaning recovery/dead-worker detection was never active for this screen (the actual '07:59 elapsed, Phase 1/2' screen from the real incident report)", () => {
  const lookSrc = fs.readFileSync(new URL("../src/pages/workspace/long-form/look.jsx", import.meta.url), "utf8");
  const fn = lookSrc.slice(lookSrc.indexOf("export function VisualPlanProgress"), lookSrc.indexOf("export default function LongFormLook"));
  assert.match(fn, /stageStartedAt=\{row\?\.stage_started_at\}/);
  assert.match(fn, /workerLockUntil=\{row\?\.worker_lock_until\}/);
});

test("compileNarrationVisualContract (the plain synchronous all-batches convenience, still used by analyze-long-form-narration-contract) delegates to compileContractBatch per batch — one behavior, not two parallel implementations", () => {
  const sharedSrc = fs.readFileSync(new URL("../supabase/functions/_shared/narrationVisualContract.ts", import.meta.url), "utf8");
  const fn = sharedSrc.slice(sharedSrc.indexOf("export async function compileNarrationVisualContract"));
  assert.match(fn, /const batchResult = await compileContractBatch\(batch, args\.openaiKey, validSegmentIds\);/);
});
