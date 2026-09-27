import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 2026-09-20 real incident: "If the Sun Vanished Right Now" (project
// cf3ebf6e-4439-4b43-8af8-5700d2850f09) confirmed live to have 13
// already-small (single-finding, few-KB) extraction batches processed
// strictly ONE PER INVOCATION — ~12 minutes of wall clock from self-chain
// round-trip overhead alone, no individual call anywhere near the platform
// ceiling. Fix: bounded concurrency (mirroring the existing
// SEARCH_CONCURRENCY pattern already used for search), not smaller/bigger
// batches. Source-structural (this Node runtime can't resolve this file's
// own "jsr:" Deno import — a pre-existing, unrelated environment gap).

const src = fs.readFileSync(new URL("../supabase/functions/advance-long-form-research/index.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("async function runExtractionBatchStage"), src.indexOf("const MERGE_INSTRUCTIONS"));

test("extraction now processes up to EXTRACTION_CONCURRENCY batches per invocation, mirroring SEARCH_CONCURRENCY's proven pattern", () => {
  assert.match(src, /const EXTRACTION_CONCURRENCY = 3;/);
  // Phase 1b "Stickman Research-Lite" — `concurrency` is now a parameter
  // defaulting to EXTRACTION_CONCURRENCY (see the function signature itself,
  // asserted below), so every existing call site (which passes none) is
  // provably unaffected; Research-Lite is the only caller that ever passes
  // a different value (1, "one batch per invocation" per its own spec).
  assert.match(fn, /concurrency: number = EXTRACTION_CONCURRENCY/);
  assert.match(fn, /const selected = claimableIndices\.slice\(0, concurrency\);/);
  assert.match(fn, /await Promise\.all\(\s*affordable\.map\(async \(idx\) => \{/);
});

test("all selected batches are claimed (persisted running+lease) in ONE write BEFORE any provider call — crash safety unchanged", () => {
  const claimIdx = fn.indexOf("const claimedBatches = batches.map");
  const dispatchIdx = fn.indexOf("const outcomes = await Promise.all");
  const persistIdx = fn.indexOf('.update({ intermediate: { ...(row.intermediate ?? {}), extractionBatches: claimedBatches } })');
  assert.ok(claimIdx > -1 && persistIdx > -1 && dispatchIdx > -1 && claimIdx < persistIdx && persistIdx < dispatchIdx, "claim must be built, persisted, THEN dispatched — in that order");
});

test("a batch's own failure resets ONLY that batch to pending — a sibling batch in the same concurrent round is unaffected", () => {
  assert.match(fn, /if \(!o\.ok\) return \{ \.\.\.b, status: "pending" as const, leaseUntil: undefined, lastErrorCode: o\.errorCode/);
});

test("the cost ceiling is checked across the whole concurrent round, never dispatching more than the ceiling allows", () => {
  // Phase 1b — `costCeiling` defaults to MAX_ESTIMATED_COST_PER_RESEARCH_USD
  // (see the function signature), so this check is byte-for-byte the same
  // guard against the same default ceiling for every existing caller;
  // Research-Lite is the only caller that passes a different (lower) ceiling.
  assert.match(fn, /costCeiling: number = MAX_ESTIMATED_COST_PER_RESEARCH_USD/);
  const block = fn.slice(fn.indexOf("const knownSpent"), fn.indexOf("const claimedAt"));
  assert.match(block, /if \(projected \+ EXTRACTION_WORST_CASE_COST_USD > costCeiling\) break;/);
  assert.match(block, /if \(!affordable\.length\) \{\s*\n\s*throw new Error\(`research_cost_ceiling_reached/);
});

test("split-on-repeated-failure and the hard claim-exhaustion cap are both still checked before any concurrent dispatch, unchanged in spirit from the single-batch version", () => {
  assert.match(fn, /canSplitFurther\(b\.findings\)\)/);
  assert.match(fn, />= MAX_EXTRACTION_BATCH_CLAIMS\)/);
  assert.match(fn, /return \{ batches: withSplit, meta: row\.meta, done: false, progressed: true \};/);
});

test("progressed is true whenever at least one batch in the round actually succeeded — a mixed round (2 ok, 1 failed) still resets stage_attempt", () => {
  assert.match(fn, /const progressed = outcomes\.some\(\(o\) => o\.ok\);/);
});

test("the return shape (batches/meta/done/progressed) is unchanged, so all three existing callers (initial/final/repair extraction) work as drop-in", () => {
  assert.match(fn, /return \{ batches: updatedBatches, meta, done, progressed \};/);
});
