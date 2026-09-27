import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 2026-09-21 emergency reliability fix — real Atlantis incident (project
// e7a6fd5e-..., visual plan version 0f4a7915-...): chapter-bounded Visual
// Planning worked exactly as designed (7/7 chapters planned, persisted,
// zero timeouts) but finalization hard-failed on 3 separate, genuinely
// unrelated bugs, and the ONLY user-facing retry path ("Try Again")
// silently discarded all of that persisted work and re-ran every chapter's
// paid model call from scratch instead of resuming. These are source-
// pattern tests (this codebase's established convention for Deno-only
// edge-function logic a plain Node test can't import — see
// narrationContractMandatoryV1.test.mjs's own module comment) plus direct
// unit tests for the two pieces importable from plain JS/TS.

const visualPlanSrc = fs.readFileSync(new URL("../supabase/functions/advance-long-form-visual-plan/index.ts", import.meta.url), "utf8");
const resumeMigration = fs.readFileSync(new URL("../supabase/migrations/20260930490000_long_form_visual_plan_resume.sql", import.meta.url), "utf8");
const resumeFnSrc = fs.readFileSync(new URL("../supabase/functions/resume-long-form-visual-plan/index.ts", import.meta.url), "utf8");
const startFnSrc = fs.readFileSync(new URL("../supabase/functions/start-long-form-visual-plan/index.ts", import.meta.url), "utf8");
const lookSrc = fs.readFileSync(new URL("../src/pages/workspace/long-form/look.jsx", import.meta.url), "utf8");

test("resume_long_form_visual_plan_version reopens the SAME row (never inserts a new version) and only ever acts on a status='failed' row", () => {
  assert.doesNotMatch(resumeMigration, /insert into public\.long_form_visual_plan_versions/i, "resume must never create a new version row");
  assert.match(resumeMigration, /if v\.status <> 'failed' then return v; end if;/);
  assert.match(resumeMigration, /set status = 'planning', stage_attempt = 0, worker_lock_until = null/);
  // Ownership is checked before anything else — never trusts a client-
  // supplied user id without cross-referencing the project's real owner.
  assert.match(resumeMigration, /owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'/);
});

test("the resume edge function authenticates via requireUser and re-dispatches the SAME visualPlanVersionId — never regenerate:true", () => {
  assert.match(resumeFnSrc, /requireUser\(req\)/);
  const rpcCallLine = resumeFnSrc.split("\n").find((l) => l.includes("admin.rpc(\"resume_long_form_visual_plan_version\""));
  assert.ok(rpcCallLine, "must call resume_long_form_visual_plan_version");
  assert.doesNotMatch(rpcCallLine, /regenerate/i, "the resume RPC call must never pass the creative-replan flag");
});

test("start_visual_plan_version's regenerate:true path is a genuine creative replan, distinct from resume — the frontend's failed-state retry no longer calls it", () => {
  // The Look page's failed-state button must call resumeVisualPlan, not
  // startVisualPlan({regenerate:true}) — that call must survive only for
  // the SEPARATE, intentional "Regenerate Storyboard" action on a READY plan.
  const failedRetryIdx = lookSrc.indexOf('onRetry={resume}');
  assert.ok(failedRetryIdx > -1, "the failed-state VisualPlanProgress must wire onRetry to resume(), not regenerate()");
  assert.match(lookSrc, /async function resume\(\)/);
  assert.match(lookSrc, /resumeVisualPlan\(row\.id\)/);
});

test("chapter planning namespaces every beat id with its own chapterId before merging — cross-chapter id collisions can no longer happen", () => {
  const fn = visualPlanSrc.slice(visualPlanSrc.indexOf("function namespaceChapterBeatIds"), visualPlanSrc.indexOf("function mergeChapterIntoAccumulated"));
  assert.match(fn, /`\$\{chapterId\}__\$\{b\.id\}`/);
  assert.match(fn, /setupBeatId: renameMap\.get\(p\.setupBeatId\) \?\? p\.setupBeatId/);
  assert.match(fn, /payoffBeatId: p\.payoffBeatId \? renameMap\.get\(p\.payoffBeatId\)/);
  // It must actually be called before the merge, not just defined.
  assert.match(visualPlanSrc, /mergeChapterIntoAccumulated\(merged, namespaceChapterBeatIds\(o\.chapterId, o\.chapterPlan\)\)/);
});

test("a graphic claim that can't fit any template downgrades that ONE beat to GENERATE instead of failing the whole plan's validation", () => {
  const src = fs.readFileSync(new URL("../supabase/functions/_shared/episodePreflight.ts", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export function compileEpisodeBeat"), src.indexOf("export function preflightEpisode"));
  assert.match(fn, /renderStrategy = "GENERATE";/);
  assert.match(fn, /beat\.renderMethod = "GENERATE";/);
  const reliabilitySrc = fs.readFileSync(new URL("../supabase/functions/_shared/visualDirectorReliability.js", import.meta.url), "utf8");
  assert.doesNotMatch(reliabilitySrc, /GRAPHIC_INVALID/, "the early hard-fail duplicate of the same check must be gone, or the downgrade never gets a chance to run");
});

test("a script's own start (or resume dispatch) never bypasses the reservation/lease machinery that guarantees provider calls are never duplicated", () => {
  // Both start and resume dispatch fire-and-forget with EdgeRuntime.waitUntil
  // and never await/retry a second time on failure inline — the durable
  // claim/lease row (not the HTTP call) is the source of truth for whether
  // work has actually happened, so a dropped dispatch is always safely
  // picked back up by the recovery sweep rather than silently duplicated.
  assert.match(startFnSrc, /EdgeRuntime\.waitUntil\(dispatch/);
  assert.match(resumeFnSrc, /EdgeRuntime\.waitUntil\(dispatch/);
});
