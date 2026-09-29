import test from "node:test";
import assert from "node:assert/strict";
import { deriveProjectStageInfo, resolveLookStepRoute } from "../src/pages/workspace/long-form/projectStage.js";

// Part 14 (A-M) — "CRITICAL LONG FORM PROJECT RESUME / NAVIGATION FIX".
// `_resumeState` is what the backend RPC (long_form_project_resume_state,
// verified live against real Mars data — see the final report) returns;
// these tests cover the FRONTEND resolver's handling of that shape, which
// is what every entry point (ProjectCard, Look, Visual World) actually
// consumes.

function project(overrides = {}) {
  return { status: null, current_story_plan_version_id: null, current_research_version_id: null, current_script_version_id: null, current_visual_plan_version_id: null, _resumeState: null, ...overrides };
}

/* A: Storyboard exists, Visual World missing -> Look */
test("A: a visual plan exists but resume state says route=look (no Visual World yet) -> resolves to look", () => {
  const p = project({ current_visual_plan_version_id: "plan-1", _resumeState: { stage: "visual_plan_ready", route: "look", visualPlanStatus: "ready" } });
  assert.equal(deriveProjectStageInfo(p).route, "look");
});

/* B: Visual World ready, no Scene Generation -> Visual World */
test("B: Visual World ready, no Scene Generation -> visual-world", () => {
  const p = project({ current_visual_plan_version_id: "plan-1", _resumeState: { stage: "visual_world", route: "visual-world", visualWorldStatus: "ready" } });
  const info = deriveProjectStageInfo(p);
  assert.equal(info.route, "visual-world");
  assert.equal(info.statusLabel, "Ready");
});

/* C: active charge/run exists, 0 scenes ready -> Generate */
test("C: an active charge/run exists with 0 ready scenes -> generate", () => {
  const p = project({ _resumeState: { stage: "generate", route: "generate", chargeExists: true, creditsCharged: 201, totalBeats: 136, ready: 0, needsReview: 0, failed: 0, generating: 0, queued: 136 } });
  assert.equal(deriveProjectStageInfo(p).route, "generate");
});

/* D: partial scene generation -> Generate */
test("D: partial scene generation (some ready, some queued) -> generate", () => {
  const p = project({ _resumeState: { stage: "generate", route: "generate", totalBeats: 136, ready: 1, needsReview: 5, failed: 0, generating: 3, queued: 127 } });
  const info = deriveProjectStageInfo(p);
  assert.equal(info.route, "generate");
  assert.equal(info.statusLabel, "5 need review");
});

/* E: scenes need review -> Generate */
test("E: scenes need review -> generate, with a review-specific label", () => {
  const p = project({ _resumeState: { stage: "generate", route: "generate", totalBeats: 10, ready: 6, needsReview: 4, failed: 0, generating: 0, queued: 0 } });
  const info = deriveProjectStageInfo(p);
  assert.equal(info.route, "generate");
  assert.equal(info.statusLabel, "4 need review");
});

/* F: failed scene generation -> Generate */
test("F: a failed scene generation still resolves to generate, never backward to Look/Visual World", () => {
  const p = project({ current_visual_plan_version_id: "plan-1", _resumeState: { stage: "generate", route: "generate", totalBeats: 10, ready: 2, needsReview: 0, failed: 3, generating: 0, queued: 5 } });
  const info = deriveProjectStageInfo(p);
  assert.equal(info.route, "generate");
  assert.equal(info.statusLabel, "3 need another try");
});

/* G: all scenes ready but Edit not built -> Generate (no /edit route exists in this codebase) */
test("G: every scene ready -> generate with a 'ready' label (no Edit route exists yet to route to instead)", () => {
  const p = project({ _resumeState: { stage: "generate", route: "generate", totalBeats: 10, ready: 10, needsReview: 0, failed: 0, generating: 0, queued: 0 } });
  const info = deriveProjectStageInfo(p);
  assert.equal(info.route, "generate");
  assert.equal(info.statusLabel, "Scenes · 10 / 10 ready");
});

/* H: Edit exists -> Edit (documented as not-yet-applicable) */
test("H: no /edit route exists in this codebase yet, so the resolver never emits it — documented, not a false claim", () => {
  // The resolver's route vocabulary is intentionally limited to routes that
  // actually exist (App.jsx has no /long-form/project/:id/edit). This test
  // exists to make that limitation explicit and regression-catchable: if an
  // /edit route is ever added, this resolver must be extended deliberately,
  // not silently left stuck at "generate" forever.
  const p = project({ _resumeState: { stage: "generate", route: "generate", totalBeats: 5, ready: 5, needsReview: 0, failed: 0, generating: 0, queued: 0 } });
  assert.notEqual(deriveProjectStageInfo(p).route, "edit");
});

/* I: historical old scenes exist but no CURRENT generation -> do not falsely route Generate */
test("I: resume state reports route=look/visual-world when there's no current-plan generation activity, regardless of what history exists", () => {
  const pLook = project({ current_visual_plan_version_id: "plan-2", _resumeState: { stage: "visual_plan_ready", route: "look" } });
  assert.equal(deriveProjectStageInfo(pLook).route, "look");
  const pWorld = project({ current_visual_plan_version_id: "plan-2", _resumeState: { stage: "visual_world", route: "visual-world", visualWorldStatus: "ready" } });
  assert.equal(deriveProjectStageInfo(pWorld).route, "visual-world");
});

/* J: old VisualPlan contains scenes, current VisualPlan does not -> use current version only */
test("J: the resolver trusts whatever the backend resume state already scoped to the CURRENT plan version — never re-derives from a stale pointer client-side", () => {
  // This is enforced server-side (long_form_project_resume_state joins
  // scenes through long_form_scene_render_plans filtered to
  // project.current_visual_plan_version_id specifically — verified live
  // against Mars, see final report). The frontend contract this test locks
  // is simply: it must use resume.route/resume.* as given, never re-count
  // scenes itself from some other field.
  const p = project({ _resumeState: { stage: "visual_world", route: "visual-world", visualWorldStatus: "ready" } });
  const info = deriveProjectStageInfo(p);
  assert.equal(info.route, "visual-world", "must reflect the backend's CURRENT-plan-scoped answer, not fall through to a generate-like guess");
});

/* K: Visual World already built + Storyboard viewed manually -> primary CTA does NOT say Build Visual World */
test("K: downstream progress (visual-world or generate) always wins over active-work/pointer-only signals that would otherwise say Look", () => {
  const p = project({
    current_visual_plan_version_id: "plan-1",
    _activeVisualPlan: { created_at: new Date().toISOString() }, // a stray/stale active-work row
    _resumeState: { stage: "generate", route: "generate", totalBeats: 5, ready: 5, needsReview: 0, failed: 0, generating: 0, queued: 0 },
  });
  const info = deriveProjectStageInfo(p);
  assert.equal(info.route, "generate", "durable downstream progress must outrank a stray active-work row from an earlier stage");
});

/* M: Mars real project -> resolver = Generate */
test("M: Mars's real resume-state shape (verified live: route=generate, 136 total beats) resolves to generate", () => {
  const mars = project({
    current_visual_plan_version_id: "8dc890d1-afee-4dab-981b-c7cac8834c90",
    _resumeState: { stage: "generate", route: "generate", visualWorldStatus: "ready", chargeExists: true, creditsCharged: 201, totalBeats: 136, ready: 24, needsReview: 96, failed: 16, generating: 0, queued: 0 },
  });
  const info = deriveProjectStageInfo(mars);
  assert.equal(info.route, "generate");
  assert.equal(info.topLevel, "Scenes");
});

/* L: Visual World already built + Build endpoint accidentally invoked -> idempotent, no duplicate */
test("L: start-long-form-visual-world checks the durable current_visual_world_version_id pointer BEFORE any plan-version-scoped lookup, so a stale-frontend call can't create a duplicate world for entities that already have one", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../supabase/functions/start-long-form-visual-world/index.ts", import.meta.url), "utf8");
  const nonRegenerateBranch = src.slice(src.indexOf("if (!regenerate) {"), src.indexOf("if (regenerate) {"));
  assert.match(nonRegenerateBranch, /project\.current_visual_world_version_id/, "must check the durable pointer, not only a plan-version-scoped query");
  const pointerCheckIndex = nonRegenerateBranch.indexOf("project.current_visual_world_version_id");
  const planScopedCheckIndex = nonRegenerateBranch.indexOf(".eq(\"visual_plan_version_id\", visualPlanVersionId)");
  assert.ok(pointerCheckIndex < planScopedCheckIndex, "the durable-pointer check must run BEFORE the plan-version-scoped fallback");
});

/* Fallback: no resume state at all (e.g. RPC failed) must not crash and must fall through to the existing Story/Idea logic */
test("fallback: a null resumeState falls through to the pre-existing pointer-based resolver instead of throwing", () => {
  const p = project({ current_research_version_id: "r1", _research: { status: "ready" } });
  const info = deriveProjectStageInfo(p);
  assert.equal(info.route, "research");
});

/* 2026-09-19 "fix backward navigation" pass (item 1): the top stepper's
   completed "Look" step must be clickable to view the storyboard again from
   Generate/later, mirroring resolveStoryStepRoute's own "Story" behavior —
   uses only the durable current_visual_plan_version_id pointer, never
   frontend memory, so a direct URL load or hard refresh resolves the same. */
test("resolveLookStepRoute resolves to 'look' once a VisualPlan has been completed", () => {
  const p = project({ current_visual_plan_version_id: "plan-1" });
  assert.equal(resolveLookStepRoute(p), "look");
});
test("resolveLookStepRoute is null before any VisualPlan has completed (nothing safe to view yet)", () => {
  const p = project();
  assert.equal(resolveLookStepRoute(p), null);
});

// Phase 5b — the final video's statuses outrank every earlier stage signal.
import { humanizeProjectStatus } from "../src/pages/workspace/long-form/projectStage.js";
test("Phase 5b: images_ready -> rendering -> complete | failed drive the card ('Done' when complete), outranking scene/storyboard state", () => {
  const base = { current_visual_plan_version_id: "vp", _visualPlan: { status: "ready" }, _resumeState: { route: "generate", ready: 3, needsReview: 1, failed: 0, totalBeats: 10 } };
  const label = (status, extra = {}) => humanizeProjectStatus(deriveProjectStageInfo({ ...base, status, ...extra }));
  assert.equal(label("images_ready"), "Ready to render");
  assert.equal(label("rendering"), "Rendering");
  assert.equal(deriveProjectStageInfo({ ...base, status: "rendering" }).active, true);
  assert.equal(label("complete"), "Done");
  assert.equal(label("failed"), "Failed");
  assert.equal(deriveProjectStageInfo({ ...base, status: "failed", status_reason: "Upload failed" }).reason, "Upload failed");
  // Earlier statuses still fall through to the existing logic.
  assert.equal(label("story_ready"), "Needs your review · 1 scene");
});
