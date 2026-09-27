import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ensureNarrationContract } from "../supabase/functions/advance-long-form-visual-plan/index.ts";

const src = fs.readFileSync(new URL("../supabase/functions/advance-long-form-visual-plan/index.ts", import.meta.url), "utf8");
const preflightSql = fs.readFileSync(new URL("../supabase/migrations/20260930390000_long_form_generate_preflight.sql", import.meta.url), "utf8");

// Minimal fake admin client, same shape/convention as visualWorldReconciliation
// .test.mjs's own fakeAdmin — used here because a real end-to-end Mars
// verification of ensureNarrationContract's OpenAI-calling path is
// currently blocked by an EXTERNAL constraint (Zyvo's OpenAI organization
// has zero API credits remaining — confirmed live, a real 429 "no credits
// remaining" response, not a bug in this code). This proves the reuse
// fallback logic itself is correct without depending on that account.
function fakeAdmin({ selects = {}, updates = [] } = {}) {
  const builder = (table) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      update: (patch) => { updates.push({ table, patch }); return chain; },
      maybeSingle: async () => ({ data: selects[table] ?? null, error: null }),
      throwOnError: () => chain,
      then: (resolve) => resolve({ data: null, error: null }),
    };
    return chain;
  };
  return { from: (table) => builder(table) };
}

// 2026-09-19 "V1 reliability patch" Task 1 — real Mars finding: the
// narration contract compiler (analyze-long-form-narration-contract) has
// always genuinely worked but is a zero-caller, analysis-only endpoint —
// project.current_narration_contract_version_id is permanently null for
// every real project, so contract-driven render-strategy decisions and
// GRAPHIC beat claim binding never actually ran, and every GRAPHIC beat
// later threw GRAPHIC_REPLAN_REQUIRED at scene-compile time (19 planned
// graphics, 0 compiling scene rows). Source-pattern tests (this codebase's
// established convention for logic not runnable in this Node harness).

test("ensureNarrationContract is called in stagePlanning BEFORE the Visual Director's own LLM call", () => {
  const ensureIdx = src.indexOf("await ensureNarrationContract(admin, project, scriptDocument, reserve)");
  const directorIdx = src.indexOf("plan = await runVisualDirector(");
  assert.ok(ensureIdx > -1 && directorIdx > -1 && ensureIdx < directorIdx);
});

// 2026-09-20 durable-contract-compilation fix: stagePlanning must return
// (never throw) when the contract isn't ready yet, and must NOT proceed to
// the Visual Director call in that case — real incident this guards against:
// calling the (paid) Visual Director before the contract it depends on has
// actually finished compiling.
test("stagePlanning returns early (no Visual Director call) when ensureNarrationContract reports the contract isn't ready yet", () => {
  const fn = src.slice(src.indexOf("async function stagePlanning"), src.indexOf("async function stageFinalizing"));
  assert.match(fn, /if \(!contractResult\.ready\) \{/);
  const guardIdx = fn.indexOf("if (!contractResult.ready)");
  const returnIdx = fn.indexOf("return;", guardIdx);
  const directorIdx = fn.indexOf("plan = await runVisualDirector(");
  assert.ok(guardIdx > -1 && returnIdx > -1 && directorIdx > -1 && returnIdx < directorIdx, "the early return must come before the Visual Director call");
});

test("ensureNarrationContract short-circuits to a no-op when a READY contract for the CURRENT script version already exists — never recompiles for a replan/retry", () => {
  const fn = src.slice(src.indexOf("async function ensureNarrationContract"), src.indexOf("async function fetchExistingCast"));
  assert.match(fn, /existing\.status === "ready" && existing\.script_version_id === project\.current_script_version_id/);
  assert.match(fn, /return \{ ready: true, id: existing\.id \};/);
});

test("ensureNarrationContract falls back to any READY contract for the current script version even when the project's own pointer is null/stale — real Mars finding: a ready contract existed but the pointer was never set", () => {
  const fn = src.slice(src.indexOf("async function ensureNarrationContract"), src.indexOf("async function fetchExistingCast"));
  assert.match(fn, /eq\("status", "ready"\)\.order\("version", \{ ascending: false \}\)\.limit\(1\)\.maybeSingle\(\)/);
  assert.match(fn, /if \(readyExisting\) \{/);
  assert.match(fn, /update\(\{ current_narration_contract_version_id: readyExisting\.id/, "must backfill the pointer, not just silently use the contract");
});

// Real, isolated functional verification (not just source-pattern): the
// exact real Mars scenario found live — project.current_narration_
// contract_version_id is null, but a READY contract for the current
// script version already exists (v4, compiled 2026-09-15). Proves the
// fallback returns and backfills it WITHOUT ever calling
// compileNarrationVisualContract/OpenAI — a live end-to-end run of that
// call path is currently blocked by an unrelated external constraint (see
// module comment above), so this is the real correctness proof available
// right now.
test("REAL MARS SCENARIO: null project pointer + an existing ready contract for the script version -> reused and backfilled, zero OpenAI calls", async () => {
  const updates = [];
  const admin = fakeAdmin({ selects: { long_form_narration_contract_versions: { id: "94f119e7-9b4f-433d-8d28-529c57666365" } }, updates });
  const project = { id: "49a18b78-1d4b-4570-8113-5cd130687e1e", current_narration_contract_version_id: null, current_script_version_id: "63c3df8b-5c84-4e1b-8da4-922535064c0f" };
  const result = await ensureNarrationContract(admin, project, { narrationSegments: [{ id: "s1", text: "irrelevant, reuse path never reads this" }] }, async () => { throw new Error("reserve must never be called on the ready-contract-reuse path"); });
  assert.equal(result.ready, true);
  assert.equal(result.id, "94f119e7-9b4f-433d-8d28-529c57666365");
  const projectUpdate = updates.find((u) => u.table === "long_form_projects");
  assert.ok(projectUpdate, "the project pointer must be backfilled");
  assert.equal(projectUpdate.patch.current_narration_contract_version_id, "94f119e7-9b4f-433d-8d28-529c57666365");
});

test("ensureNarrationContract throws (routing through the exact same handleStageFailure retry/hold semantics as every other planning failure) when compilation fails, never silently continues", () => {
  const fn = src.slice(src.indexOf("async function ensureNarrationContract"), src.indexOf("async function fetchExistingCast"));
  assert.match(fn, /catch \(error\) \{[\s\S]*?throw new Error\("NARRATION_CONTRACT_COMPILE_FAILED"\);/);
});

test("ensureNarrationContract persists the pointer to project.current_narration_contract_version_id on success — the exact wiring gap the real incident report identified", () => {
  const fn = src.slice(src.indexOf("async function ensureNarrationContract"), src.indexOf("async function fetchExistingCast"));
  assert.match(fn, /update\(\{ current_narration_contract_version_id: contractRow\.id/);
});

test("stageFinalizing fails the plan BEFORE it can reach 'ready' if any PROGRAMMATIC_GRAPHIC beat still has no bound narrationClaimId", () => {
  const fn = src.slice(src.indexOf("async function stageFinalizing"));
  const throwIdx = fn.indexOf("GRAPHIC_BEATS_MISSING_CONTRACT_CLAIM");
  const readyIdx = fn.indexOf('status: "ready"');
  assert.ok(throwIdx > -1 && readyIdx > -1 && throwIdx < readyIdx, "the graphic-claim check must run before the plan is ever marked ready");
  assert.match(fn, /renderMethod === "PROGRAMMATIC_GRAPHIC" && !b\.narrationClaimId/);
});

test("the CAST BINDING instruction is present and generic (no project-specific example baked into the shared prompt)", () => {
  assert.match(src, /CAST BINDING/);
  assert.match(src, /reuse that EXACT existing entity id\/name/i);
  assert.doesNotMatch(src, /agricultural specialist|power officer|maintenance technician/i, "the instructions must stay topic-generic — real cast examples belong in project data (existingCast), never hardcoded into the shared prompt");
});

test("fetchExistingCast reuses the project's own already-adopted VisualPlanVersion entity_registry — never a separate registry — and returns [] with nothing to reuse", () => {
  const fn = src.slice(src.indexOf("async function fetchExistingCast"), src.indexOf("const GENERIC_ROLE_NAME"));
  assert.match(fn, /if \(!project\.current_visual_plan_version_id\) return \[\];/);
  assert.match(fn, /e\.category === "CHARACTER"/);
});

test("existingCast is threaded into BOTH runVisualDirector call sites (initial + repair), never only one", () => {
  const calls = [...src.matchAll(/await runVisualDirector\([^)]*\)/g)].map((m) => m[0]);
  assert.equal(calls.length, 2, "expected exactly the initial call and the repair-retry call");
  assert.ok(calls.every((c) => c.includes("existingCast")), "both call sites must pass existingCast through");
});

test("detectGenericCastReplacements is non-blocking — its result is only ever merged into meta for reporting, never thrown", () => {
  assert.doesNotMatch(src, /throw[\s\S]{0,80}genericCastWarnings/i);
  assert.match(src, /const genericCastWarnings = detectGenericCastReplacements\(plan\.entityRegistry \?\? \[\], existingCast\);/);
  assert.match(src, /existingCastSize: existingCast\.length, genericCastWarnings/);
});

test("a cast-presence ledger (per-entity distinct chapter ids) is computed and persisted on the final ready plan", () => {
  const fn = src.slice(src.indexOf("async function stageFinalizing"));
  assert.match(fn, /const castPresence: Record<string, string\[\]> = \{\};/);
  assert.match(fn, /meta: \{ \.\.\.row\.meta, validation, deterministicAdjustments: \[\.\.\.\(row\.meta\?\.deterministicAdjustments \?\? \[\]\), \.\.\.changes\], castPresence \}/);
});

/* ---- Generate preflight (SQL) ---- */
test("charge_long_form_episode_generation now checks every PROGRAMMATIC_GRAPHIC beat on the current plan has a bound narrationClaimId BEFORE pricing/debiting", () => {
  const priceIdx = preflightSql.indexOf("price := public.estimate_long_form_episode_credits");
  const checkIdx = preflightSql.indexOf("unclaimed_graphics > 0");
  assert.ok(checkIdx > -1 && priceIdx > -1 && checkIdx < priceIdx, "the preflight check must run before any pricing/debit happens");
  assert.match(preflightSql, /raise exception 'GENERATE_PREFLIGHT_FAILED_GRAPHIC_BEATS_NOT_COMPILABLE'/);
});

test("the preflight check is read-only against the plan's own persisted visual_plan JSON — no provider call, no new compile simulation", () => {
  const fn = preflightSql.slice(preflightSql.indexOf("create or replace function"));
  assert.doesNotMatch(fn, /http|fetch|openai/i);
  assert.match(fn, /jsonb_array_elements\(coalesce\(plan\.visual_plan->'visualBeats', '\[\]'::jsonb\)\)/);
});

test("the edge function maps the preflight failure to 422 with an actionable message, never the generic 500", () => {
  const edgeFnSrc = fs.readFileSync(new URL("../supabase/functions/charge-long-form-episode-generation/index.ts", import.meta.url), "utf8");
  assert.match(edgeFnSrc, /message\.includes\("GENERATE_PREFLIGHT_FAILED"\)/);
  assert.match(edgeFnSrc, /isPreflightFailure \? 422/);
  assert.match(edgeFnSrc, /can't be produced yet/);
});
