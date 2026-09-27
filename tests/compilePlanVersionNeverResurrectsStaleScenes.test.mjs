import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22/23 "permanently separate PLAN/COMPILE from PAID GENERATION"
// pass — REAL Atlantis finding from the live compile of adopted Visual
// Plan v5: long_form_scene_render_plans has a hard unique constraint on
// (visual_world_version_id, visual_beat_id, plan_version) that deliberately
// does NOT include visual_plan_version_id (see 20260930150000's own
// comment: "a new plan_version is a full replacement, never an in-place
// mutation of a plan already used to render a scene"). The original
// compile logic (carried over verbatim from start-long-form-scene-
// generation) only ever bumped plan_version under an explicit
// forceNewPlanVersion flag (the rebuild flow) — a normal replan/repair
// left EVERY beat computing plan_version=1 forever, so re-compiling after
// a Visual Plan repair silently overwrote an old plan version's row in
// place and inherited its already-terminal (succeeded/failed) scene. Live
// evidence: 15 of Atlantis's 126 beats resurrected real pre-repair scene
// attempts (11 failed, 4 succeeded) under the newly adopted, already-fixed
// v5 plan before this fix. Source-pattern tests, this codebase's
// established convention for this Deno entrypoint.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const FN = "supabase/functions/compile-long-form-scenes/index.ts";

test("the latest existing plan row per beat is ALWAYS resolved, not only under forceNewPlanVersion", async () => {
  const text = await source(FN);
  const idx = text.indexOf("const latestPlanByBeatId = new Map");
  assert.ok(idx > -1);
  // Must not be gated behind `if (forceNewPlanVersion)` — the query block
  // right after the map declaration must be unconditional.
  const block = text.slice(idx, text.indexOf("const preflight = await loadEpisodePreflight"));
  assert.doesNotMatch(block, /if \(forceNewPlanVersion\)/);
  assert.match(block, /\.select\("visual_beat_id, plan_version, visual_plan_version_id"\)/);
});

test("a beat whose latest plan row belongs to a DIFFERENT visual_plan_version_id always gets plan_version + 1 — never reuses/overwrites the old row", async () => {
  const text = await source(FN);
  assert.match(text, /latestPlan\.visualPlanVersionId === planRow\.id\s*\n\s*\? latestPlan\.planVersion \/\/ same plan version as before/);
  assert.match(text, /: latestPlan\.planVersion \+ 1; \/\/ a DIFFERENT \(superseded\) plan version already used this plan_version/);
});

test("a beat with no existing plan row at all still starts at plan_version 1", async () => {
  const text = await source(FN);
  assert.match(text, /: !latestPlan\s*\n\s*\? 1\s*\n/);
});

test("re-compiling the SAME plan version stays idempotent (reuses the same plan_version, never bumps)", async () => {
  const text = await source(FN);
  const idx = text.indexOf("const planVersion = forceNewPlanVersion");
  const block = text.slice(idx, idx + 400);
  assert.match(block, /latestPlan\.planVersion \/\/ same plan version as before — idempotent re-compile, reuse the same row/);
});

test("forceNewPlanVersion (the rebuild path) still always increments from the latest known version, regardless of which plan version it belonged to", async () => {
  const text = await source(FN);
  assert.match(text, /forceNewPlanVersion\s*\n\s*\? \(latestPlan\?\.planVersion \?\? 0\) \+ 1/);
});
