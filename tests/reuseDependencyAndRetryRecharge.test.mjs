import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22 "provider adapter transport" incident, Root Cause 3 + billing
// safety — real Atlantis finding: a REUSE scene whose GENERATE source had
// failed ONCE (still retriable, claim_attempts < 3) was claimed immediately
// and cascaded to its OWN permanent failure (REUSE_SOURCE_NOT_READY),
// because the claim function treated status IN ('succeeded','failed') as
// "source is done" regardless of whether it would still be retried. And
// retrying those GENERATE scenes would have recharged credits for work
// Runware never actually accepted (task creation rejected pre-inference).
// Both are pure-SQL migrations — source-pattern tests, same convention as
// this repo's other migration-behavior tests.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("E/F: a dependent (REUSE/CROP/COMPOSITE) scene only becomes claimable once its source has genuinely succeeded, or the source is permanently exhausted — never while the source is merely failed-but-retriable", async () => {
  const sql = await source("supabase/migrations/20261001180000_long_form_reuse_dependency_durable.sql");
  assert.match(sql, /src\.status = 'succeeded' or \(src\.status = 'failed' and src\.claim_attempts >= 3\)/);
  // The old, over-eager condition must be gone from the live function body,
  // not just superseded by a later migration that could theoretically be
  // skipped in some environment.
  assert.doesNotMatch(sql, /src\.status in \('succeeded', 'failed'\)/);
});

test("I: retrying a scene whose provider task was never accepted (job_id set, but jobs.provider_task_id still null) resets it in place for free — never a second charge", async () => {
  const sql = await source("supabase/migrations/20261001190000_long_form_retry_no_recharge_on_rejected_task.sql");
  assert.match(sql, /select exists\(select 1 from public\.jobs j where j\.id = sc\.job_id and j\.provider_task_id is not null\) into task_was_accepted/);
  assert.match(sql, /if sc\.status = 'failed' and not task_was_accepted then/);
  // The free branch must clear job_id too, or claim_long_form_scene_for_render
  // (which requires job_id is null) can never re-claim this row again.
  const freeBranch = sql.slice(sql.indexOf("if sc.status = 'failed' and not task_was_accepted then"), sql.indexOf("replacement_id := sc.id;"));
  assert.match(freeBranch, /job_id\s*=\s*null/);
  // jobs.id is ALWAYS the scene's own id (a permanent 1:1 pairing set by
  // enqueue_long_form_scene_job), regardless of what long_form_scenes.job_id
  // currently holds — the stale rejected-task row must be deleted by sc.id,
  // not sc.job_id (which is already null by the time this runs), or the
  // next enqueue collides on jobs_pkey (real incident, caught live).
  assert.match(freeBranch, /delete from public\.jobs where id = sc\.id and provider_task_id is null/);
});

test("I: idempotency is preserved — a scene that already has a replacement row returns the SAME replacement instead of creating another", async () => {
  const sql = await source("supabase/migrations/20261001190000_long_form_retry_no_recharge_on_rejected_task.sql");
  assert.match(sql, /select id into replacement_id from public\.long_form_scenes where replaces_scene_id = sc\.id;/);
  assert.match(sql, /if replacement_id is not null then return replacement_id; end if;/);
});

test("G: the user-facing 'visuals ready/complete' headline and its progress bar are driven by ready-only counts, never by processed (which includes failed)", async () => {
  const text = await source("src/pages/workspace/long-form/GenerateWorkspace.jsx");
  assert.match(text, /\{ready\} \/ \{total\} visuals ready/);
  assert.doesNotMatch(text, /\{processed\} \/ \{total\} visuals complete/);
});

test("H: episode/chapter quality diagnostics (episodeWarnings) are suppressed entirely while any scene is still queued/generating/checking/planned — never flag a shot with no output yet as a quality finding", async () => {
  const text = await source("src/pages/workspace/long-form/GenerateWorkspace.jsx");
  assert.match(text, /stillActivelyProducing \? \[\] : runEpisodeQA\(episodeQaInputs\)/);
});
