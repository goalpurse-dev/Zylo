import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const compatibilitySql = fs.readFileSync(new URL("../supabase/migrations/20260930370000_long_form_visual_world_compatibility_authority.sql", import.meta.url), "utf8");
const contractSql = fs.readFileSync(new URL("../supabase/migrations/20260930432000_visual_world_resume_and_retry_dispatch_contract.sql", import.meta.url), "utf8");
const readinessSql = fs.readFileSync(new URL("../supabase/migrations/20260930434000_long_form_scene_readiness_authority.sql", import.meta.url), "utf8");
const visualWorldClient = fs.readFileSync(new URL("../src/pages/workspace/long-form/visualWorld.js", import.meta.url), "utf8");
const visualWorldUi = fs.readFileSync(new URL("../src/pages/workspace/long-form/VisualWorldWorkspace.jsx", import.meta.url), "utf8");
const compatibilityFn = readinessSql.slice(readinessSql.indexOf("create or replace function public.long_form_visual_world_compatibility"), readinessSql.indexOf("create or replace function public.long_form_project_resume_state"));
const resumeFn = readinessSql.slice(readinessSql.indexOf("create or replace function public.long_form_project_resume_state"), readinessSql.indexOf("create or replace function public.charge_long_form_episode_generation"));

test("Case A: a ready plan, adopted ready world, and complete required slots are compatible", () => {
  assert.match(compatibilityFn, /plan\.status is distinct from 'ready'/);
  assert.match(compatibilityFn, /world\.status is distinct from 'ready'/);
  assert.match(compatibilityFn, /'compatible',missing_count = 0/);
});

test("compatibility still trusts the adopted pointer only for the current plan", () => {
  const fn = compatibilitySql.slice(compatibilitySql.indexOf("create or replace function public.long_form_visual_world_compatibility"), compatibilitySql.indexOf("create or replace function public.long_form_project_resume_state"));
  assert.match(fn, /where id = proj\.current_visual_world_version_id\s*\n\s*and visual_plan_version_id = proj\.current_visual_plan_version_id/);
});

test("a newer non-adopted world cannot replace the adopted pointer for readiness", () => {
  const fn = readinessSql.slice(readinessSql.indexOf("create or replace function public.long_form_visual_world_compatibility"), readinessSql.indexOf("create or replace function public.long_form_project_resume_state"));
  assert.match(fn, /where id = proj\.current_visual_world_version_id and project_id = proj\.id/);
  assert.doesNotMatch(fn, /order by version desc/);
});

test("a ready compatible world routes to Generate with no charge or scene plans", () => {
  const fn = readinessSql.slice(readinessSql.indexOf("create or replace function public.long_form_project_resume_state"));
  assert.doesNotMatch(fn, /if not charge_matches_exact and not has_current_plans then/);
  assert.match(fn, /'stage','generate','route','generate'/);
});

test("required canonical slots accept a usable predecessor while regeneration is pending", () => {
  const fn = readinessSql.slice(readinessSql.indexOf("create or replace function public.long_form_visual_world_compatibility"), readinessSql.indexOf("create or replace function public.long_form_project_resume_state"));
  assert.match(fn, /where not exists/);
  assert.match(fn, /a\.status = 'succeeded'/);
  assert.match(fn, /a\.qa_status is distinct from 'rejected'/);
  assert.doesNotMatch(fn, /not exists\s*\(select 1[^;]*replaces_asset_id/s);
});

test("Case D: a genuinely missing required slot fails closed with an exact reason", () => {
  assert.match(compatibilityFn, /where not exists/);
  assert.match(compatibilityFn, /'required_references_missing'/);
  assert.match(compatibilityFn, /'missingRequiredReferenceCount',missing_count/);
});

test("Case E: a world for an older visual plan is incompatible", () => {
  assert.match(compatibilityFn, /world\.visual_plan_version_id is distinct from plan\.id/);
  assert.match(compatibilityFn, /'world_plan_mismatch'/);
});

test("Case G: historical worlds and charges cannot change the readiness decision", () => {
  assert.doesNotMatch(compatibilityFn, /long_form_episode_generation_charges/);
  assert.doesNotMatch(compatibilityFn, /order by version/);
  assert.ok(resumeFn.indexOf("compat := public.long_form_visual_world_compatibility") < resumeFn.indexOf("select * into charge"));
});

test("billing and Edge preflight both use the compatibility authority", () => {
  assert.match(readinessSql, /compat := public\.long_form_visual_world_compatibility\(p_project_id\)/);
  const edge = fs.readFileSync(new URL("../supabase/functions/_shared/episodePreflight.ts", import.meta.url), "utf8");
  assert.match(edge, /admin\.rpc\("long_form_visual_world_compatibility"/);
});

test("provider cost lineage has durable reason and one-time accounting fields", () => {
  for (const field of ["generation_reason", "cost_accounted", "cost_accounted_at"]) assert.match(readinessSql, new RegExp(field));
  for (const reason of ["INITIAL", "REBUILD_WORLD", "USER_REGENERATE", "SYSTEM_REPAIR"]) assert.match(readinessSql, new RegExp(reason));
});

test("retry is idempotent and reactivates the exact parent world", () => {
  const fn = contractSql.slice(contractSql.indexOf("create or replace function public.retry_long_form_reference_asset"), contractSql.indexOf("create or replace function public.long_form_project_resume_state"));
  assert.match(fn, /if a\.status in \('pending','running'\) then return a\.id; end if;/);
  assert.match(fn, /set status='generating',stage='generating',stage_attempt=0/);
  assert.match(fn, /worker_lock_until=null/);
});

test("enqueue accepts the worker's current renderer contract before creating one idempotent job", () => {
  const fn = contractSql.slice(contractSql.indexOf("create or replace function public.enqueue_long_form_reference_job"), contractSql.indexOf("create or replace function public.retry_long_form_reference_asset"));
  assert.match(fn, /'celestial_reference','environment_reference'[\s\S]*then 'image:kling\.o3'/);
  assert.match(fn, /if a\.job_id is not null then return a\.job_id; end if;/);
  assert.match(fn, /insert into public\.jobs/);
  assert.match(fn, /update public\.long_form_reference_assets[\s\S]*job_id=a\.id/);
});

test("UI exposes queued, claimed, submitted, and checking progress without provider names", () => {
  assert.match(visualWorldClient, /select\("id,status,submission_state,provider_task_id"\)/);
  assert.match(visualWorldUi, /if \(status\.key === "starting"\) return "Starting\.\.\.";/);
  assert.match(visualWorldUi, /if \(status\.key === "generating"\) return "Creating reference\.\.\.";/);
  assert.match(visualWorldUi, /if \(status\.key === "checking"\) return "Checking consistency\.\.\.";/);
  assert.match(visualWorldUi, /Waiting for a worker\.\.\./);
});
