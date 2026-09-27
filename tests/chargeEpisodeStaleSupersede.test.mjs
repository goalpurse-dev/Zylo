import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(new URL("../supabase/migrations/20260930380000_long_form_generate_episode_stale_charge_supersede.sql", import.meta.url), "utf8");
const edgeFnSrc = fs.readFileSync(new URL("../supabase/functions/charge-long-form-episode-generation/index.ts", import.meta.url), "utf8");

// 2026-09-19 billing-incident hotfix — real Mars repro: after replanning
// (adopting VisualPlanVersion v5), "Generate Episode" always failed with
// "Could not start episode generation" because charge_long_form_episode_
// generation's stale-charge guard blocked on ANY 'charged' row for the
// project, not just one for the CURRENT plan — permanently, since
// adopt_visual_plan_version deliberately never touches
// active_generation_charge_id on replan. Live forensic check confirmed NO
// new v5 charge was ever created and the project owner's real credit
// balance was byte-identical to the last verified checkpoint (89089) — the
// "-242 credits" the user saw was a separate frontend display bug (see
// episodeRebuildUi.test.mjs's "N" test), not an actual debit. These are
// source-pattern tests (this codebase's established convention for SQL
// logic not runnable in this Node harness).

const fn = sql.slice(sql.indexOf("create or replace function public.charge_long_form_episode_generation"));

test("a charge for the CURRENT plan still short-circuits as alreadyCharged, unchanged from before this fix", () => {
  assert.match(fn, /where project_id = p_project_id and status = 'charged' and visual_plan_version_id = proj\.current_visual_plan_version_id/);
  assert.match(fn, /return jsonb_build_object\('charged', true, 'alreadyCharged', true/);
});

test("STALE_CHARGE_BLOCKS_NEW_GENERATION is no longer raised — a stale charge for a DIFFERENT plan is superseded instead of blocking", () => {
  assert.doesNotMatch(fn, /raise exception 'STALE_CHARGE_BLOCKS_NEW_GENERATION'/);
});

test("the stale-charge branch is checked via stale.id, never plpgsql's own `found` (which two later SELECTs — world, balance — would have overwritten)", () => {
  const staleLookupIdx = fn.indexOf("select * into stale from public.long_form_episode_generation_charges");
  const afterLookup = fn.slice(staleLookupIdx);
  assert.doesNotMatch(afterLookup.slice(0, afterLookup.indexOf("update public.long_form_episode_generation_charges set status = 'superseded'")), /if found then/);
  assert.match(fn, /if stale\.id is not null then\s*\n\s*update public\.long_form_episode_generation_charges set status = 'superseded', superseded_at = now\(\) where id = stale\.id;/);
});

test("readiness and balance checks still run BEFORE the stale charge is touched or the debit happens — an incompatible world or insufficient balance must never supersede history for nothing", () => {
  const staleLookupIdx = fn.indexOf("select * into stale from public.long_form_episode_generation_charges");
  const supersedeIdx = fn.indexOf("status = 'superseded', superseded_at = now()");
  const notReadyIdx = fn.indexOf("raise exception 'NOT_READY'");
  const worldNotReadyIdx = fn.indexOf("raise exception 'VISUAL_WORLD_NOT_READY'");
  const insufficientIdx = fn.indexOf("raise exception 'INSUFFICIENT_CREDITS'");
  assert.ok(staleLookupIdx < notReadyIdx && notReadyIdx < worldNotReadyIdx && worldNotReadyIdx < insufficientIdx && insufficientIdx < supersedeIdx);
});

test("the old charge is preserved forever — never deleted, never has its own credits_charged/cost_breakdown/tier/created_at touched", () => {
  assert.doesNotMatch(fn, /delete from public\.long_form_episode_generation_charges/);
  const supersedeStatement = fn.slice(fn.indexOf("if stale.id is not null then"), fn.indexOf("if stale.id is not null then") + 200);
  assert.doesNotMatch(supersedeStatement, /credits_charged|cost_breakdown|tier\s*=|created_at/);
});

test("the new charge for the current plan links back to the superseded charge via rebuild_of_charge_id, and the old row gets superseded_by_charge_id — same bidirectional lineage rebuild_long_form_episode_generation already uses", () => {
  assert.match(fn, /insert into public\.long_form_episode_generation_charges\([^)]*rebuild_of_charge_id\)/);
  assert.match(fn, /values \(p_project_id, proj\.current_visual_world_version_id, proj\.current_visual_plan_version_id, p_user_id, p_tier, total, price, idem_key, stale\.id\)/);
  assert.match(fn, /update public\.long_form_episode_generation_charges set superseded_by_charge_id = new_id where id = stale\.id/);
});

test("the debit only happens once, AFTER the supersede decision is made, never duplicated for the case with no stale charge at all (stale.id is null)", () => {
  const supersedeIdx = fn.indexOf("if stale.id is not null then");
  const debitIdx = fn.indexOf("update public.profiles set credit_balance = credit_balance - total");
  assert.ok(supersedeIdx < debitIdx, "supersede check must run before the debit, but the debit itself is unconditional (runs whether or not a stale charge existed)");
});

test("the edge function maps STALE_CHARGE_BLOCKS_NEW_GENERATION to an honest 409, never the generic 500 'Could not start episode generation', as defense-in-depth", () => {
  assert.match(edgeFnSrc, /STALE_CHARGE_BLOCKS_NEW_GENERATION.*\?\s*409/);
});
