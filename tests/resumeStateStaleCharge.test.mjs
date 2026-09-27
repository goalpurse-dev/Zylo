import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const resumeStateSqlSrc = fs.readFileSync(new URL("../supabase/migrations/20260930340000_long_form_resume_state_stale_charge_fix.sql", import.meta.url), "utf8");
const replanSqlSrc = fs.readFileSync(new URL("../supabase/migrations/20260930330000_long_form_replan_episode_visuals.sql", import.meta.url), "utf8");

// 2026-09-19 forensic audit — real Mars incident: after adopting a
// replanned VisualPlanVersion (v5), long_form_project_resume_state reported
// chargeExists:true/creditsCharged:220/planned:136/ready:0 because it
// trusted project.active_generation_charge_id (a real, still-'charged' row)
// as proof the CURRENT plan had started generating — even though that
// charge's own visual_plan_version_id pointed at v4, an entirely different,
// already-superseded plan with zero beat-id overlap. Zero
// long_form_scene_render_plans existed for v5 at all; the worker had
// nothing to claim. These tests pin down the exact SQL fix (source-pattern
// tests, matching this codebase's own convention — see episodeRebuildUi.
// test.mjs's rebuildSqlSrc tests) since a full DB round-trip isn't
// available in this harness.

test("long_form_project_resume_state only trusts a charge as proof the CURRENT plan is generating when the charge's OWN visual_plan_version_id matches the project's current_visual_plan_version_id", () => {
  assert.match(resumeStateSqlSrc, /charge_matches_plan := charge\.id is not null and charge\.visual_plan_version_id = proj\.current_visual_plan_version_id/);
});

// SUPERSEDED 2026-09-19 by 20260930370000 (see
// visualWorldCompatibilityAuthority.test.mjs): this gate, as written in
// THIS migration's static SQL, is no longer what actually runs — a later
// `create or replace` removed it from the routing decision entirely,
// because it was ALSO firing (wrongly) for a genuinely ready/compatible
// world that simply had no charge or scene-render-plan yet (the real Mars
// shipping-blocker: an infinite Storyboard->VisualWorld->Scenes loop). This
// test is kept only as a historical record of what 20260930340000 itself
// introduced, not as a description of current live routing behavior.
test("[historical] as originally written, a mismatched charge alone routed to visual_world in this migration's own text (later overridden)", () => {
  const gate = resumeStateSqlSrc.slice(resumeStateSqlSrc.indexOf("if not charge_matches_plan"), resumeStateSqlSrc.indexOf("if not charge_matches_plan") + 400);
  assert.match(gate, /'stage', 'visual_world', 'route', 'visual-world'/);
  assert.match(gate, /'staleChargeForDifferentPlan', charge\.id is not null/);
  assert.match(gate, /'staleChargeCreditsCharged'/);
});

test("the 'generate' stage's own chargeExists/creditsCharged fields are derived from charge_matches_plan, never the raw charge row, so a mismatched charge's credits can never leak into a truthful-looking generate-stage response", () => {
  const generateBranch = resumeStateSqlSrc.slice(resumeStateSqlSrc.indexOf("'stage', 'generate'"));
  assert.match(generateBranch, /'chargeExists', charge_matches_plan/);
  assert.match(generateBranch, /'creditsCharged', case when charge_matches_plan then charge\.credits_charged else null end/);
});

test("has_current_plans is still scoped to BOTH the current world and the current plan version (unchanged from before this fix) — this is what correctly returned 0 rows for Mars's real v5 replan", () => {
  assert.match(resumeStateSqlSrc, /where visual_world_version_id = world\.id and visual_plan_version_id = proj\.current_visual_plan_version_id/);
});

// 2026-09-19 "Replan Episode Visuals" versioning path (item 2/3/8 from the
// prior pass, re-verified here since this incident is a direct consequence
// of it): a genuine replan durably records its parent so the finalize step
// knows to hold it for review instead of auto-promoting.
test("start_visual_plan_version records parent_visual_plan_version_id only for an explicit replan of an existing plan, never for a project's first-ever plan", () => {
  assert.match(replanSqlSrc, /parent_id := case when found then v\.id else null end/);
});

test("adopt_visual_plan_version is the ONLY function that promotes an explicit replan to current_visual_plan_version_id, and it validates ownership via auth.uid() (never a client-supplied user id it can't verify)", () => {
  const fn = replanSqlSrc.slice(replanSqlSrc.indexOf("create or replace function public.adopt_visual_plan_version"));
  assert.match(fn, /where id = v\.project_id and user_id = auth\.uid\(\)/);
  assert.match(fn, /update public\.long_form_projects set current_visual_plan_version_id = v\.id/);
});

test("adopt_visual_plan_version never touches active_generation_charge_id or current_visual_world_version_id — billing history and the Visual World pointer survive a replan untouched, by design", () => {
  const fn = replanSqlSrc.slice(replanSqlSrc.indexOf("create or replace function public.adopt_visual_plan_version"));
  assert.doesNotMatch(fn, /active_generation_charge_id/);
  assert.doesNotMatch(fn, /current_visual_world_version_id\s*=/);
});
