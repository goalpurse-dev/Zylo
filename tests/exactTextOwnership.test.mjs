import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22 "FINAL stabilization pass" §8 — real Atlantis finding:
// classifyTextImportance(claim) is a pure function of the CLAIM alone, so
// EVERY GENERATE/EDIT scene attached to the same narration claim
// independently derived criticalTextRequired=true and independently
// composited the same exact string onto itself — real symptom: "9000 YEARS
// BEFORE SOLON" stamped repeatedly across many sequential scenes sharing
// one claim. Fix: exact text has exactly ONE designated owner per claim,
// determined live (never a persisted flag that could go stale after a
// replan) as the earliest-sequence_index render plan among GENERATE/EDIT/
// PROGRAMMATIC_GRAPHIC siblings sharing the claim. Source-pattern test
// (isDesignatedTextOverlayOwner is a module-local async function with no
// exported seam), matching this file's existing convention of asserting on
// the compiled source for logic gated behind live DB queries.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("§8: criticalTextRequired is gated by claim importance AND designated ownership, not claim importance alone", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  assert.match(text, /const claimRequiresExactText = classifyTextImportance\(claim\) === "CRITICAL_EXACT_TEXT";/);
  assert.match(text, /qaContext\.criticalTextRequired = claimRequiresExactText && await isDesignatedTextOverlayOwner\(admin, plan\);/);
  // The old unconditional assignment (claim alone decides every sibling)
  // must be gone, not merely supplemented.
  assert.doesNotMatch(text, /qaContext\.criticalTextRequired = classifyTextImportance\(claim\) === "CRITICAL_EXACT_TEXT";\s*\n\s*qaContext\.hasVerifiedOverlay/);
});

test("§8: ownership resolution scopes siblings to the SAME claim + contract version + visual world — never a different episode's identically-shaped claim", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const fnBlock = text.slice(text.indexOf("async function isDesignatedTextOverlayOwner"), text.indexOf("async function runQaCheckpoint"));
  assert.match(fnBlock, /\.eq\("visual_world_version_id", plan\.visual_world_version_id\)/);
  assert.match(fnBlock, /\.eq\("narration_claim_id", plan\.narration_claim_id\)/);
  assert.match(fnBlock, /\.eq\("narration_contract_version_id", plan\.narration_contract_version_id\)/);
});

test("§8: only GENERATE/EDIT/PROGRAMMATIC_GRAPHIC plans compete for ownership — REUSE/CROP/COMPOSITE never do, since they inherit already-processed pixels and never composite their own text", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const fnBlock = text.slice(text.indexOf("async function isDesignatedTextOverlayOwner"), text.indexOf("async function runQaCheckpoint"));
  assert.match(fnBlock, /\["GENERATE", "EDIT", "PROGRAMMATIC_GRAPHIC"\]\.includes\(s\.render_strategy\)/);
});

test("§8: ownership is the EARLIEST sequence_index among carriers, ties broken deterministically by plan id — never arbitrary/unstable ordering", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const fnBlock = text.slice(text.indexOf("async function isDesignatedTextOverlayOwner"), text.indexOf("async function runQaCheckpoint"));
  assert.match(fnBlock, /\(a\.sequence_index - b\.sequence_index\) \|\| String\(a\.id\)\.localeCompare\(String\(b\.id\)\)/);
});

test("§8: a plan with no narration claim at all trivially owns nothing to fight over (returns true) — never blocks legacy/claim-less beats from their existing behavior", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const fnBlock = text.slice(text.indexOf("async function isDesignatedTextOverlayOwner"), text.indexOf("async function runQaCheckpoint"));
  assert.match(fnBlock, /if \(!plan\?\.narration_claim_id \|\| !plan\?\.narration_contract_version_id\) return true;/);
});
