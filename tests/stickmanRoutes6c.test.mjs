// Phase 6c/6e — Stickman routes: Idea · Scenes · Edit · Publish. Every legacy
// URL redirects to the page of the project's REAL state: the generating screen
// while anything runs (or needs a retry / a start), the Scenes home once drawn;
// Idea is always a read-only summary; Edit/Publish (and the Script / Voiceover
// panels) only once the scenes are drawn.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveStickmanPage, deriveStickmanStep, reachableStickmanSteps, LEGACY_STICKMAN_PAGES, STICKMAN_PAGE_STEP } from "../src/pages/workspace/long-form/projectStage.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const STATES = {
  writing: { autopilot: { status: "running" } },
  scriptFailed: { autopilot: { status: "failed" } },
  narrating: { autopilot: { status: "running", phase: "narration" }, current_script_version_id: "s", _scriptLocked: true },
  voiceFailed: { autopilot: { status: "failed", phase: "narration" }, _scriptLocked: true },
  drawing: { autopilot: { status: "running", phase: "scenes", scenes: { status: "running" } }, _scriptLocked: true, _narrationReady: true },
  scenesFailed: { autopilot: { status: "failed", phase: "scenes", scenes: { status: "failed" } }, _scriptLocked: true, _narrationReady: true },
  // f90160bc "How did ancient humans hunt": 148 scenes drawn.
  f90160bc: { status: "story_ready", autopilot: { status: "done", phase: "scenes", scenes: { status: "done" } }, _scriptLocked: true, _narrationReady: true, _hasScenes: true },
  regenerating: { autopilot: { status: "running", phase: "scenes", scenes: { status: "running", regenerating: true } }, _hasScenes: true },
  // A pre-6e project that stopped at the voice (narration ready, no scenes yet).
  stoppedAtVoice: { autopilot: { status: "done", phase: "narration", narration: { status: "ready" } }, _scriptLocked: true, _narrationReady: true },
  complete: { status: "complete", final_video_path: "x", _hasScenes: true },
};

test("the Stickman stepper is Idea · Scenes · Edit · Publish", () => {
  const state = read("src/pages/workspace/long-form/state.js");
  const block = state.slice(state.indexOf("LONG_FORM_STICKMAN_STAGES = ["), state.indexOf("];", state.indexOf("LONG_FORM_STICKMAN_STAGES = [")));
  assert.deepEqual([...block.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]), ["Idea", "Scenes", "Edit", "Publish"]);
});

test("every legacy page (and the old writing page) redirects to the real state's page", () => {
  const home = { writing: "generating", scriptFailed: "generating", narrating: "generating", voiceFailed: "generating", drawing: "generating", scenesFailed: "generating", f90160bc: "scenes", regenerating: "scenes", stoppedAtVoice: "generating", complete: "edit" };
  for (const [name, project] of Object.entries(STATES)) for (const page of LEGACY_STICKMAN_PAGES) assert.equal(resolveStickmanPage(page, project), home[name], `${name} /${page}`);
  assert.equal(deriveStickmanStep(STATES.writing).stage, "script");
  assert.equal(deriveStickmanStep(STATES.narrating).stage, "voice");
  assert.equal(deriveStickmanStep(STATES.drawing).stage, "scenes");
  assert.equal(deriveStickmanStep(STATES.stoppedAtVoice).needsStart, true);
});

test("pages: Idea always (read-only); generating only while generating; Scenes/Edit/Publish/panels once drawn", () => {
  for (const s of Object.values(STATES)) assert.equal(resolveStickmanPage("idea", s), "idea");
  assert.equal(resolveStickmanPage("generating", STATES.f90160bc), "scenes");
  assert.equal(resolveStickmanPage("scenes", STATES.drawing), "generating");
  for (const p of ["scenes", "edit", "publish", "narration", "script-review"]) {
    assert.equal(resolveStickmanPage(p, STATES.f90160bc), p, p);
    assert.equal(resolveStickmanPage(p, STATES.narrating), "generating", p);
  }
  // Back/Continue only between reached steps (instantly, from saved data).
  assert.deepEqual(reachableStickmanSteps(STATES.f90160bc), { idea: "idea", scenes: "scenes", edit: "edit", publish: "publish" });
  assert.deepEqual(reachableStickmanSteps(STATES.drawing), { idea: "idea", scenes: "generating", edit: null, publish: null });
});

test("wiring: project routes are guarded; Generate opens the generating screen; the guard decides from memory; no stop at the voice", () => {
  const app = read("src/App.jsx");
  for (const page of [...LEGACY_STICKMAN_PAGES.filter((p) => p !== "writing"), ...Object.keys(STICKMAN_PAGE_STEP)]) {
    assert.match(app, new RegExp(`path="/long-form/project/:id/${page.replace("-", "\\-")}"\\s+element=\\{<StickmanRouteGuard page="${page}">`), page);
  }
  assert.match(read("src/pages/workspace/long-form/ProductionSetup.jsx"), /navigate\(`\/long-form\/project\/\$\{projectId\}\/generating`\)/);
  const guard = read("src/pages/workspace/long-form/StickmanRouteGuard.jsx");
  assert.match(guard, /useState\(\(\) => \(cache\.has\(id\) \? \{ loading: false, \.\.\.cache\.get\(id\) \} : \{ loading: true \}\)\)/);
  assert.match(guard, /if \(!state\.stickman\) return children;/);
  const adv = read("supabase/functions/advance-long-form-autopilot/index.ts");
  assert.match(adv, /n\.kind === "done" && n\.narrationStatus === "ready"[\s\S]{0,500}ap\.phase = "scenes";/);
});
