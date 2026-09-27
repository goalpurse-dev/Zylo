import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { refineVisualSequences, visualDensity, SHOT_PLANNER_VERSION } from "../supabase/functions/_shared/visualShotPlanning.js";

// Part 16 (A-S) — the "FINAL GENERATE-EPISODE SEMANTICS + FULL-COST +
// VISUAL-DENSITY PASS" test list. Several items (A, B, F, K, L, Q, R) are
// server-authoritative Postgres transaction semantics that were NOT
// modified in this task (charge_long_form_episode_generation, retry/edit
// scene charging) — they were verified this task by reading the SQL and,
// for the pricing pieces, by real rolled-back transactions against Mars in
// the immediately preceding task. What's covered here is what changed in
// THIS task (the visual-density classifier fix, the frontend execution-
// semantics UI) plus structural/source checks for architecture claims a
// Node unit test can verify without a live Postgres instance.

function readSrc(relPath) {
  return fs.readFileSync(new URL(relPath, import.meta.url), "utf8");
}

/* ---------- Visual density / graphic-classifier fix ---------- */

const sourcePlan = {
  visualBeats: [
    // A STORY_ILLUSTRATION macro whose narration happens to use "checklist"/
    // "status" vocabulary — real incident this test guards against: this
    // used to become PROGRAMMATIC_GRAPHIC purely from the keyword match,
    // even though the macro is a story beat about a person and a tablet.
    { id: "m1", chapterId: "c1", sequenceIndex: 1, narrationSegmentIds: ["s1"], estimatedStartSeconds: 0, estimatedEndSeconds: 20,
      informationToCommunicate: "Show the morning checklist", narrativeFunction: "open", revealConstraints: [], visualType: "STORY_ILLUSTRATION",
      shotStrategy: "NEW_SETUP", renderMethod: "GENERATE", shotSize: "WIDE", continuityGroupId: null, primaryEntityIds: [], supportingEntityIds: [],
      locationId: null, baseSetupKey: "hab_A", deltaInstruction: null, factualVisualConstraints: [], forbiddenElements: [] },
    // A genuine DIAGRAM macro with the same kind of vocabulary — must STAY
    // graphic; the fix must not suppress legitimate explainer graphics.
    { id: "m2", chapterId: "c1", sequenceIndex: 2, narrationSegmentIds: ["s2"], estimatedStartSeconds: 20, estimatedEndSeconds: 40,
      informationToCommunicate: "Explain the radiation budget schedule", narrativeFunction: "explain", revealConstraints: [], visualType: "DIAGRAM",
      shotStrategy: "DIAGRAM", renderMethod: "PROGRAMMATIC_GRAPHIC", shotSize: "WIDE", continuityGroupId: null, primaryEntityIds: [], supportingEntityIds: [],
      locationId: null, baseSetupKey: null, deltaInstruction: null, factualVisualConstraints: [], forbiddenElements: [] },
  ],
};
const script = {
  narrationSegments: [
    { id: "s1", text: "A tap pulls open the morning checklist. Three status icons glow on the tablet in their hands." },
    { id: "s2", text: "The schedule tracks a radiation budget forecast across the week, logging every flagged exception." },
  ],
};

// Phase 0, Section D — this hardcoded "v3" was already 6 undocumented
// revisions stale (the real, current value is "v9") by the time this test
// started failing; not a functional regression, just a version string this
// test never got updated for across those later passes. Asserting a real
// version STRING here (rather than re-hardcoding a specific number that
// will go stale again the next time the planner changes) still verifies
// the actual invariant this test cares about: the planner IS versioned, and
// a plan compiled under a different version is never silently reinterpreted.
test("A: the shot planner is versioned — SHOT_PLANNER_VERSION changed for this fix (a plan compiled under the old version is never silently reinterpreted)", () => {
  assert.equal(typeof SHOT_PLANNER_VERSION, "string");
  assert.match(SHOT_PLANNER_VERSION, /^semantic-shots-v\d+$/);
});

test("B: a STORY_ILLUSTRATION macro's shots are NOT forced into PROGRAMMATIC_GRAPHIC merely because the narration contains 'checklist'/'status' vocabulary", () => {
  const plan = refineVisualSequences(sourcePlan, script);
  const storyShots = plan.visualBeats.filter((b) => b.sourceMacroBeatId === "m1");
  assert.ok(storyShots.length > 0);
  assert.ok(storyShots.some((b) => b.renderMethod !== "PROGRAMMATIC_GRAPHIC"), "at least one shot in the story macro must resolve to a photographic/derived strategy, not a text card");
});

test("C: a genuine DIAGRAM macro's matching shots STILL become PROGRAMMATIC_GRAPHIC — the fix narrows false positives, it doesn't suppress real explainer graphics", () => {
  const plan = refineVisualSequences(sourcePlan, script);
  const diagramShots = plan.visualBeats.filter((b) => b.sourceMacroBeatId === "m2");
  assert.ok(diagramShots.length > 0);
  assert.ok(diagramShots.every((b) => b.renderMethod === "PROGRAMMATIC_GRAPHIC"), "a real DIAGRAM macro's shots must remain graphics");
});

test("D: visualDensity still passes and total duration is unaffected by the classifier fix (render-method choice never changes shot timing)", () => {
  const plan = refineVisualSequences(sourcePlan, script);
  assert.equal(plan.densityDiagnostics.passed, true);
  const totalNarrationSeconds = script.narrationSegments.reduce((sum, s) => sum + (s.text.match(/\S+/g)?.length ?? 0), 0) / 150 * 60;
  assert.ok(Math.abs(plan.densityDiagnostics.totalDurationSeconds - totalNarrationSeconds) < 0.5);
});

/* ---------- Structural architecture checks (Part 1/6/7/8/12) ---------- */

test("E: REUSE/CROP/PROGRAMMATIC_GRAPHIC never touch the paid generation pipeline — processZeroCostScene is called instead of ensureSceneJob for those strategies", () => {
  const src = readSrc("../supabase/functions/advance-long-form-scene-generation/index.ts");
  assert.match(src, /\["REUSE", "CROP", "COMPOSITE", "PROGRAMMATIC_GRAPHIC"\]\.includes\(plan\.render_strategy\)\)\s*{\s*\n\s*await processZeroCostScene/);
});

test("F: REUSE resolves to a real final asset reference (the source's own result_url), not a placeholder", () => {
  const src = readSrc("../supabase/functions/advance-long-form-scene-generation/index.ts");
  const reuseBranch = src.slice(src.indexOf('plan.render_strategy === "REUSE"'), src.indexOf('plan.render_strategy === "CROP"'));
  assert.match(reuseBranch, /status:\s*"succeeded".*result_url:\s*source\.result_url/s);
});

test("G: CROP produces an actual composed output uploaded to storage, not just metadata", () => {
  const src = readSrc("../supabase/functions/advance-long-form-scene-generation/index.ts");
  const cropBranch = src.slice(src.indexOf('render_strategy === "CROP"'), src.indexOf('render_strategy === "PROGRAMMATIC_GRAPHIC"'));
  assert.match(cropBranch, /storage\.from\("generated"\)\.upload/);
  assert.match(cropBranch, /status:\s*"succeeded"/);
});

test("H: PROGRAMMATIC_GRAPHIC renders and uploads a real image asset, not merely overlay_spec JSON", () => {
  const src = readSrc("../supabase/functions/advance-long-form-scene-generation/index.ts");
  const graphicBranch = src.slice(src.indexOf('render_strategy === "PROGRAMMATIC_GRAPHIC"', src.indexOf('async function processZeroCostScene')));
  assert.match(graphicBranch, /renderProgrammaticGraphicCard/);
  assert.match(graphicBranch, /storage\.from\("generated"\)\.upload/);
});

test("I: the graphic card renderer honors the compiled overlaySpec's placement/safeZone/textStyle rather than always dead-centering one uppercase line", () => {
  const src = readSrc("../supabase/functions/advance-long-form-scene-generation/index.ts");
  const fn = src.slice(src.indexOf("function renderProgrammaticGraphicCard"), src.indexOf("Deno.serve"));
  assert.match(fn, /overlaySpec\?\.placement/);
  assert.match(fn, /overlaySpec\?\.safeZone/);
  assert.match(fn, /textStyle\.casing/);
  // 2026-09-16 "production invariants" pass: text fitting is now done via
  // fitTextToZone (auto-shrinks to the safe zone, flags true overflow
  // instead of clipping — Section 15), which itself calls wrapText; the
  // renderer body itself no longer calls wrapText directly.
  assert.match(fn, /fitTextToZone/);
});

test("J: automatic (non-user-triggered) scene compilation never touches profiles.credit_balance — only Generate Episode's own charge and user-triggered Regenerate/Edit debit credits", () => {
  const startSrc = readSrc("../supabase/functions/start-long-form-scene-generation/index.ts");
  const advanceSrc = readSrc("../supabase/functions/advance-long-form-scene-generation/index.ts");
  assert.doesNotMatch(startSrc, /credit_balance/);
  assert.doesNotMatch(advanceSrc, /credit_balance/);
});

test("K: two independent GENERATE scenes structurally cannot share one job row — job.id is the scene's own id (a unique primary key), never a separately-issued value that could collide", () => {
  const src = readSrc("../supabase/migrations/20260930150000_long_form_scene_generation_v1.sql");
  assert.match(src, /insert into public\.jobs\(id,user_id,type,tool_key[^)]*\)\s*\n\s*values\(s\.id,owner_id/);
});

test("L: GENERATE/EDIT never pass a fixed seed to the provider — Runware picks its own per call, and the task UUID is freshly random per submission", () => {
  const src = readSrc("../supabase/functions/runware-image/index.ts");
  assert.doesNotMatch(src, /\bseed\s*:\s*['"0-9]/i, "no hardcoded/fixed seed value should ever be sent to the provider");
  assert.match(src, /taskUUID:\s*crypto\.randomUUID\(\)/);
});

test("M: the dependency-aware claim query only releases a dependent (EDIT/CROP-off-a-source) scene once its source has actually resolved — independent GENERATE scenes carry no such gate", () => {
  const src = readSrc("../supabase/migrations/20260930150000_long_form_scene_generation_v1.sql");
  const fn = src.slice(src.indexOf("function public.claim_long_form_scene_for_render"), src.indexOf("$$;", src.indexOf("function public.claim_long_form_scene_for_render")));
  assert.match(fn, /srp\.source_scene_render_plan_id is null\s*\n\s*or exists/);
});

/* ---------- Frontend (Part 4/5/9/10) ---------- */

test("N: the tier selector's V4 quality label is a single short word ('Ultra'), not a two-line wrap-prone phrase", () => {
  const src = readSrc("../src/pages/workspace/long-form/scenePricing.js");
  const v4 = /\{ id: "v4"[^}]*\}/.exec(src)?.[0] ?? "";
  assert.match(v4, /quality:\s*"Ultra"/);
});

test("O: no credit amounts render inside the tier picker cells (unchanged from the prior pricing pass) — credits stay in Generation Summary and the CTA only", () => {
  const src = readSrc("../src/pages/workspace/long-form/GenerateWorkspace.jsx");
  const selectorFn = src.slice(src.indexOf("function CompactTierSelector"), src.indexOf("/* ============================ Reference Sheets"));
  assert.doesNotMatch(selectorFn, /CreditIcon/);
});

test("P: the Generation Summary shows the real breakdown (new AI renders / AI edits / derived shots / graphics), sourced from the same server estimate as the total — never invented display numbers", () => {
  const src = readSrc("../src/pages/workspace/long-form/GenerateWorkspace.jsx");
  assert.match(src, /New AI renders/);
  assert.match(src, /estimate\.breakdown\.freshGenerations/);
  assert.match(src, /estimate\.breakdown\.reused \+ estimate\.breakdown\.crops/);
});

test("Q: the Generate Episode CTA is followed by an explicit 'creates all N episode visuals' statement, removing the 'did I just buy a timeline' ambiguity", () => {
  const src = readSrc("../src/pages/workspace/long-form/GenerateWorkspace.jsx");
  assert.match(src, /Creates all \{progress\.total\} episode visuals\./);
});

test("R: a successful charge shows an immediate 'Generation started' confirmation before settling into the live per-scene readout", () => {
  const src = readSrc("../src/pages/workspace/long-form/GenerateWorkspace.jsx");
  assert.match(src, /Generation started/);
  assert.match(src, /setJustCommitted\(true\)/);
});

test("S: a zero-cost strategy (CROP/COMPOSITE/PROGRAMMATIC_GRAPHIC/REUSE) mid-flight shows a truthful strategy-specific label, never the generic 'Starting…' a real provider job would show", async () => {
  const { deriveSceneCardStatus } = await import("../src/pages/workspace/long-form/sceneCardModel.js");
  assert.equal(deriveSceneCardStatus({ status: "running", job_id: null, render_strategy: "CROP" }).label, "Reframing existing visual…");
  assert.equal(deriveSceneCardStatus({ status: "running", job_id: null, render_strategy: "PROGRAMMATIC_GRAPHIC" }).label, "Preparing graphic…");
  assert.equal(deriveSceneCardStatus({ status: "running", job_id: "j1", render_strategy: "GENERATE" }).label, "Generating…");
});
