import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deriveStickmanStep, deriveProjectStageInfo, humanizeProjectStatus } from "../src/pages/workspace/long-form/projectStage.js";
import { cleanText, cleanUserText } from "../src/pages/workspace/long-form/textClean.js";
import { sectionSeconds } from "../src/pages/workspace/long-form/scriptReviewModel.js";

const root = new URL("../", import.meta.url);
const source = (p) => readFile(new URL(p, root), "utf8");

// Phase 6a — ONE stepper for Stickman (Idea · Script · Voice · Scenes · Edit),
// derived from project state only.
test("stickman stepper: every project state maps to exactly one Stickman step (never a legacy step)", () => {
  assert.deepEqual(deriveStickmanStep({}).key, "idea");
  // Phase 6e: while anything generates the project is on the one generating screen (Scenes step).
  assert.deepEqual(deriveStickmanStep({ autopilot: { status: "running", startedAt: "t" } }), { key: "scenes", route: "generating", stage: "script", statusLabel: "Writing script", active: true, startedAt: "t" });
  assert.equal(deriveStickmanStep({ autopilot: { status: "failed" } }).route, "generating");
  assert.equal(deriveStickmanStep({ autopilot: { status: "done" }, _script: { locked_at: "x" } }).stage, "voice");
  assert.equal(deriveStickmanStep({ status: "images_ready" }).route, "scenes");
  assert.equal(deriveStickmanStep({ status: "rendering" }).key, "edit");
  assert.equal(deriveStickmanStep({ status: "complete", final_video_path: "p" }).statusLabel, "Done");
  // The lobby card for a Stickman project speaks the Stickman steps; a legacy project keeps its own.
  const info = deriveProjectStageInfo({ _stickman: true, autopilot: { status: "running" }, current_visual_plan_version_id: null });
  assert.equal(info.topLevel, "Scenes");
  assert.equal(humanizeProjectStatus(info), "Writing script");
  assert.notEqual(deriveProjectStageInfo({ current_script_version_id: "s", _script: { status: "ready" } }).topLevel, "Script");
});

test("stickman stepper is the same list on every page: Idea · Scenes · Edit · Publish; legacy list untouched", async () => {
  const state = await source("src/pages/workspace/long-form/state.js");
  const block = state.slice(state.indexOf("LONG_FORM_STICKMAN_STAGES = ["), state.indexOf("];", state.indexOf("LONG_FORM_STICKMAN_STAGES = [")));
  assert.deepEqual([...block.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]), ["Idea", "Scenes", "Edit", "Publish"]);
  const shared = await source("src/pages/workspace/long-form/shared.jsx");
  // Phase 6c: the highlighted step is the PAGE's step (the route guard keeps page == real step);
  // how far the project got (reached steps) still comes from the project's own state.
  assert.ok(shared.includes("STICKMAN_STEP_FOR_PAGE[current] ?? furthestKey"), "the highlighted step follows the page");
  assert.ok(shared.includes("deriveStickmanStep(stickmanProject).key"), "reached steps come from the project");
});

test("autopilot flow: Generate video opens the one generating screen (no Story Plan gate) and legacy pages redirect", async () => {
  const setup = await source("src/pages/workspace/long-form/ProductionSetup.jsx");
  assert.ok(setup.includes("await startAutopilot(projectId);") && setup.includes("/generating`"));
  for (const page of ["story", "research", "script"]) assert.ok((await source(`src/pages/workspace/long-form/${page}.jsx`)).includes("autopilotRedirectRoute(project)"), page);
  const repair = await source("supabase/functions/start-long-form-research-repair/index.ts");
  assert.ok(repair.includes("STICKMAN_NO_REPAIR"), "legacy repair research never runs for Stickman");
  const research = await source("supabase/functions/advance-long-form-research/index.ts");
  assert.ok(research.includes("const needsAttention = thin && !isStickman;"), "research-lite never gates Stickman");
});

test("text: encoding repairs (U+2011, cp1252 C1, mojibake) keep real typography; planner notes never reach users", () => {
  assert.equal(cleanText("Hunter‑gatherer"), "Hunter-gatherer");
  assert.equal(cleanText("You\u0092re"), "You’re");
  assert.equal(cleanText("Youâ€™re here"), "You’re here");
  assert.equal(cleanText("It’s “true” — really"), "It’s “true” — really");
  assert.equal(cleanUserText("Spears were thrown (research to confirm the range) at prey."), "Spears were thrown at prey.");
});

test("review durations are m:ss parts that add up exactly to the total shown", () => {
  const { parts, total } = sectionSeconds([60, 145, 203, 88, 301, 77, 150], 146.6);
  assert.equal(parts.reduce((a, b) => a + b, 0), total);
  assert.equal(total, Math.round((1024 / 146.6) * 60));
});

test("review sections: never slugs/roles — plan titles by position+role, slugs humanized, opening beats merged", async () => {
  const { readableSections } = await import("../src/pages/workspace/long-form/scriptReviewModel.js");
  const doc = [
    { chapterId: "s1", role: "cold_open", title: "hook_spear_in_dirt", segmentIds: ["a"] },
    { chapterId: "s2", role: "stakes", title: "why_it_matters", segmentIds: ["b"] },
    { chapterId: "s3", role: "core_question", title: "promise_question", segmentIds: ["c"] },
    { chapterId: "s4", role: "evidence", title: "persistence_hunting", segmentIds: ["d"] },
    { chapterId: "s5", role: "evidence", title: "ambush_and_thrusting", segmentIds: ["e"] },
  ];
  const plan = [{ role: "cold_open", title: "By the kill" }, { role: "stakes" }, { role: "core_question" }, { role: "evidence", title: "Running them down" }, { role: "twist", title: "x" }];
  assert.deepEqual(readableSections(doc, plan), [
    { title: "Opening", segmentIds: ["a", "b", "c"] },
    { title: "Running them down", segmentIds: ["d"] },
    { title: "Ambush and thrusting", segmentIds: ["e"] },
  ]);
  // The plan's own titles can be slugs too (the 6a run's plan was all snake_case).
  assert.equal(readableSections([doc[3]], [{ role: "evidence", title: "persistence_hunting" }])[0].title, "Persistence hunting");
});

test("billing: a stage failure never releases the reservation while the autopilot will retry it (only project deletion does)", async () => {
  const text = await source("supabase/functions/_shared/longFormReservations.ts");
  assert.ok(text.includes('if (reason !== "project_deleted")'));
  assert.ok(text.includes('autopilot?.status === "running"') && text.includes("release_deferred_autopilot"));
});
