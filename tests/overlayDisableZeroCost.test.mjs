import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22 "FINAL stabilization pass" §0/§10 — overlays must be a
// user-controllable step with ZERO image-provider cost, and disabling one
// must never regenerate or touch the base image. This closes test #12 from
// the regression list ("overlay can be disabled without provider call")
// and part of #26/#27 (a failed/approved base is never re-touched; a new
// overlay version never invalidates it). PENDING: this migration has NOT
// been applied to production — supabase db push is blocked by an unrelated
// migration-history bookkeeping mismatch requiring `supabase migration
// repair`, not run without explicit user approval (see final report).

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("§10: disable_long_form_scene_overlay never touches base_result_url — only final_result_url and overlay_applied change on the NEW row", async () => {
  const sql = await source("supabase/migrations/20261001210000_long_form_scene_overlay_disable_zero_cost.sql");
  assert.match(sql, /'succeeded', sc\.result_url, sc\.base_result_url, sc\.base_result_url, false, sc\.qa_status, sc\.qa_result, 0, sc\.render_model/);
});

test("§10: the operation is always zero-cost — credits_charged and cost_usd are hardcoded 0, never derived from a tier price table", async () => {
  const sql = await source("supabase/migrations/20261001210000_long_form_scene_overlay_disable_zero_cost.sql");
  const insertBlock = sql.slice(sql.indexOf("insert into public.long_form_scenes("), sql.indexOf("returning id into replacement_id"));
  assert.match(insertBlock, /\n\s*0, sc\.input_reference_asset_ids/, "credits_charged is a literal 0");
  assert.match(insertBlock, /0, sc\.render_model/, "cost_usd is a literal 0");
});

test("§10: history is preserved via the SAME replaces_scene_id chain every retry already uses — never an update-in-place, never a delete", async () => {
  const sql = await source("supabase/migrations/20261001210000_long_form_scene_overlay_disable_zero_cost.sql");
  assert.match(sql, /scene_render_plan_id, visual_world_version_id, visual_beat_id, render_strategy, replaces_scene_id,/, "the new row is explicitly linked back via replaces_scene_id");
  assert.match(sql, /sc\.scene_render_plan_id, sc\.visual_world_version_id, sc\.visual_beat_id, sc\.render_strategy, sc\.id,/, "replaces_scene_id's value is the OLD scene's own id");
  assert.doesNotMatch(sql, /update public\.long_form_scenes set/);
  assert.doesNotMatch(sql, /delete from public\.long_form_scenes/);
});

test("§10: only an approved scene with a real base image can have its overlay disabled — never a pending/rejected/base-less scene", async () => {
  const sql = await source("supabase/migrations/20261001210000_long_form_scene_overlay_disable_zero_cost.sql");
  assert.match(sql, /if sc\.status <> 'succeeded' or sc\.qa_status <> 'approved' then raise exception 'SCENE_NOT_APPROVED'; end if;/);
  assert.match(sql, /if sc\.base_result_url is null then raise exception 'NO_BASE_IMAGE'; end if;/);
});

test("§10: disabling an already-disabled (or never-enabled) overlay is a safe no-op — returns the same scene id, never creates a spurious history row", async () => {
  const sql = await source("supabase/migrations/20261001210000_long_form_scene_overlay_disable_zero_cost.sql");
  assert.match(sql, /if not sc\.overlay_applied then return sc\.id; end if;/);
});

test("§10: double-submission is idempotent — a scene that already has a replacement row returns that SAME row rather than creating a second one", async () => {
  const sql = await source("supabase/migrations/20261001210000_long_form_scene_overlay_disable_zero_cost.sql");
  assert.match(sql, /select id into replacement_id from public\.long_form_scenes where replaces_scene_id = sc\.id;\s*\n\s*if replacement_id is not null then return replacement_id; end if;/);
});

test("§10: ownership is enforced the same way every other scene-mutating RPC in this codebase does (through the project's user_id, via the visual world version)", async () => {
  const sql = await source("supabase/migrations/20261001210000_long_form_scene_overlay_disable_zero_cost.sql");
  assert.match(sql, /if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;/);
});

test("§10: the edge function wrapper never kicks a job worker — this operation makes no provider call and has nothing to dispatch", async () => {
  const text = await source("supabase/functions/disable-long-form-scene-overlay/index.ts");
  assert.doesNotMatch(text, /kickWorker|kickJobWorker|job-worker/);
  assert.match(text, /disable_long_form_scene_overlay/);
});
