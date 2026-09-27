import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 2026-09-20 real production incident: a fresh "What if the Moon
// disappeared?" project's Write Script auto-triggered a targeted research
// repair (advance-long-form-script's triggerTargetedRepair) that died
// mid-repair_extraction (last_error_code
// "stage_attempts_exhausted_via_worker_disappearance", confirmed live
// against the real project row, id f7dc5503-7875-44de-bf9b-8dc2f122d803).
// Clicking the resulting "Improve Research" action then showed the generic
// full-screen research-failure UI, hiding the still-valid parent research
// (30 sources, 18 facts). These tests cover the actual root causes found via
// live DB inspection, structurally (the same pattern longFormResumeState/
// episodeRebuildUi's tests already use for React/Deno code a plain Node test
// can't execute directly).

const researchFnSrc = fs.readFileSync(new URL("../supabase/functions/advance-long-form-research/index.ts", import.meta.url), "utf8");
const researchJsxSrc = fs.readFileSync(new URL("../src/pages/workspace/long-form/research.jsx", import.meta.url), "utf8");
const researchJsSrc = fs.readFileSync(new URL("../src/pages/workspace/long-form/research.js", import.meta.url), "utf8");
const scriptJsxSrc = fs.readFileSync(new URL("../src/pages/workspace/long-form/script.jsx", import.meta.url), "utf8");

test("B: repair search query budget scales with the number of flagged chapters, not a flat constant", () => {
  const block = researchFnSrc.slice(researchFnSrc.indexOf("async function stageRepairSearch"), researchFnSrc.indexOf("async function stageRepairSearch") + 2200);
  assert.match(block, /chapterCount\s*=\s*row\.repair_context\?\.chapters\?\.length/, "must derive chapter count from the real flagged-chapter list");
  assert.match(block, /Math\.max\(MAX_TARGETED_QUERIES,\s*chapterCount\s*\*\s*2\)/, "budget must scale with chapter count, matching the planner's own 1-2 queries/chapter instruction");
  assert.match(block, /flattenToQueue\(tasks,\s*targetedQueryBudget,\s*"repair"\)/, "the scaled budget must actually be the one passed to flattenToQueue");
});

test("flattenToQueue itself is unchanged (still fills in order and stops at budget) — only the budget computation changed", () => {
  const block = researchFnSrc.slice(researchFnSrc.indexOf("function flattenToQueue"), researchFnSrc.indexOf("function flattenToQueue") + 700);
  assert.match(block, /if \(entries\.length >= budget\) return entries;/);
});

test("D/B: a productive batch split resets stage_attempt (progressed:true), so splitting itself can never exhaust the stage retry budget", () => {
  // 2026-09-20 "extraction concurrency" pass renamed the local `priorClaims`
  // check to a `findIndex` scan (`b.claimAttempts ?? 0) >= 2`) across all
  // claimable batches — the invariant under test (a split is real progress)
  // is unchanged.
  const anchor = "canSplitFurther(b.findings));";
  const block = researchFnSrc.slice(researchFnSrc.indexOf(anchor), researchFnSrc.indexOf(anchor) + 2200);
  assert.match(block, /return \{ batches: withSplit, meta: row\.meta, done: false, progressed: true \};/, "a split must count as forward progress, not a bare failure");
});

test("the hard hard-failure ceiling for a genuinely irreducible batch is untouched", () => {
  // 2026-09-20 "extraction concurrency" pass rewrote this check to scan all
  // claimable batches (not just the first) for the same
  // claimAttempts>=MAX_EXTRACTION_BATCH_CLAIMS condition — the invariant
  // itself (an irreducible minimal unit still terminates) is unchanged.
  assert.match(researchFnSrc, /\(b\.claimAttempts \?\? 0\) >= MAX_EXTRACTION_BATCH_CLAIMS\)/);
  assert.match(researchFnSrc, /throw new Error\(`extraction_batch_too_large/, "an irreducible minimal-size failure must still terminate, independent of the split-progress fix");
});

test("A/D: settleFromVersionRow falls back to the parent research when the latest version is a failed repair attempt", () => {
  const block = researchJsxSrc.slice(researchJsxSrc.indexOf("const settleFromVersionRow"), researchJsxSrc.indexOf("const startAndWatch"));
  assert.match(block, /row\.status === "failed" && row\.parent_research_version_id/, "must specifically detect a failed REPAIR row (has a parent), not any failed row");
  assert.match(block, /fetchResearchVersionById\(row\.parent_research_version_id\)/, "must actually fetch the parent row's real content");
  assert.match(block, /setRepairFailure\(row\)/, "must record the failed repair separately from the displayed (parent) research");
  assert.match(block, /setPhase\("ready"\)/, "on a usable parent, must land on the normal ready screen, never the blank failure screen");
});

test("A/D: a failed repair whose parent is ALSO unusable still falls through to the honest failure screen (no infinite optimism)", () => {
  const block = researchJsxSrc.slice(researchJsxSrc.indexOf("const settleFromVersionRow"), researchJsxSrc.indexOf("const startAndWatch"));
  const parentBranchEnd = block.indexOf("setPhase(\"failed\");");
  assert.ok(parentBranchEnd > -1, "must still have a terminal setPhase(\"failed\") fallback");
});

test("D/E: the repair-failed banner is the only banner shown (no duplicate CTA with the blocking/nonblocking banners)", () => {
  assert.match(researchJsxSrc, /\{!repairFailure && isBlocking &&/, "blocking banner must be suppressed while a repair-failure banner is showing");
  assert.match(researchJsxSrc, /\{!repairFailure && isNonblocking &&/, "nonblocking banner must be suppressed while a repair-failure banner is showing");
});

test("D: retrying a failed repair reuses the proven resume-by-id path (startAndWatch(false)), never a brand-new repair round", () => {
  const bannerBlock = researchJsxSrc.slice(researchJsxSrc.indexOf("{repairFailure && ("), researchJsxSrc.indexOf("{!repairFailure && isBlocking"));
  assert.match(bannerBlock, /onClick=\{\(\) => startAndWatch\(false\)\}/);
  const footerBlock = researchJsxSrc.slice(researchJsxSrc.indexOf("{repairFailure ? ("), researchJsxSrc.indexOf("} : isBlocking ? ("));
  assert.match(footerBlock, /onPrimary=\{\(\) => startAndWatch\(false\)\}/);
});

test("research.js exposes fetchResearchVersionById for parent-recovery lookups", () => {
  assert.match(researchJsSrc, /export async function fetchResearchVersionById\(researchVersionId\)/);
});

test("F: duplicate 'Improve Research' CTA removed from script.jsx's needs-research screen", () => {
  const stateBlock = scriptJsxSrc.slice(scriptJsxSrc.indexOf("function NeedsMoreResearchState"), scriptJsxSrc.indexOf("function NeedsMoreResearchState") + 1600);
  assert.doesNotMatch(stateBlock, /Improve Research/, "the inline empty-state component must no longer render its own copy of the footer's primary action");
});

test("F: no remaining double-arrow labels (a literal '→' character fed into LongFormActionFooter, which already renders its own arrow icon)", () => {
  assert.doesNotMatch(scriptJsxSrc, /(primaryLabel|tertiaryLabel)=(\{[^}]*→[^}]*\}|"[^"]*→[^"]*")/);
});

test("E: RepairLoadingState (the actual ~11-minute 'Strengthening your research' screen) now passes stageStartedAt and workerLockUntil, matching research.jsx's own fix", () => {
  const block = scriptJsxSrc.slice(scriptJsxSrc.indexOf("function RepairLoadingState"), scriptJsxSrc.indexOf("function RepairLoadingState") + 700);
  assert.match(block, /stageStartedAt=\{repairRow\?\.stage_started_at\}/);
  assert.match(block, /workerLockUntil=\{repairRow\?\.worker_lock_until\}/);
});

test("E: ScriptLoadingState (narration) also passes stageStartedAt for the same last-checkpoint signal", () => {
  const block = scriptJsxSrc.slice(scriptJsxSrc.indexOf("function ScriptLoadingState"), scriptJsxSrc.indexOf("function ScriptLoadingState") + 700);
  assert.match(block, /stageStartedAt=\{row\.stage_started_at\}/);
});

test("F: script.jsx's needs-research/needs-attention screen still has exactly one primary CTA wired in the footer", () => {
  const block = scriptJsxSrc.slice(scriptJsxSrc.indexOf('if (phase === "needs-research" || phase === "needs-attention")'), scriptJsxSrc.indexOf('if (phase === "needs-research" || phase === "needs-attention")') + 1400);
  const primaryLabelMatches = block.match(/primaryLabel=/g) ?? [];
  assert.equal(primaryLabelMatches.length, 1, "exactly one LongFormActionFooter primary CTA should be wired for this screen");
});
