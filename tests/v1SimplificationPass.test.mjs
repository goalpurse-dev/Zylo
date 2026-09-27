import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 2026-09-20 "V1 simplification" pass. Source-structural tests (this
// codebase's established convention for Deno edge-function logic a plain
// Node test can't import directly — see narrationContractMandatoryV1.test
// .mjs's own module comment: this Node runtime can't resolve these files'
// own "jsr:"/"npm:" Deno imports, a pre-existing, unrelated environment gap).

const scriptSrc = fs.readFileSync(new URL("../supabase/functions/advance-long-form-script/index.ts", import.meta.url), "utf8");
const visualPlanSrc = fs.readFileSync(new URL("../supabase/functions/advance-long-form-visual-plan/index.ts", import.meta.url), "utf8");

/* ---- CORE ARCHITECTURE CHANGE: the script segment becomes the visual contract ---- */

test("the Script Engine's segment schema carries the inline visual metadata fields (the visual contract lives on the segment itself)", () => {
  const fn = scriptSrc.slice(scriptSrc.indexOf("function buildSegmentSchema"), scriptSrc.indexOf("const OPEN_LOOP_SCHEMA"));
  for (const field of ["visualIntent", "mustShow", "mustNotShow", "entities", "locationHint", "continuityEntityIds", "exactTextOverlay", "preferredVisualForm"]) {
    assert.ok(fn.includes(`${field}:`), `buildSegmentSchema is missing the ${field} property`);
    assert.ok(fn.includes(`"${field}"`), `${field} must be in the required array (strict json_schema mode)`);
  }
  assert.match(fn, /enum: \["STORY", "EXPLAINER", "GRAPHIC", "DETAIL"\]/);
});

test("ensureNarrationContract detects a new-style script (every segment has visualIntent) and synthesizes the contract deterministically — zero provider calls, zero batches", () => {
  const fn = visualPlanSrc.slice(visualPlanSrc.indexOf("export async function ensureNarrationContract"), visualPlanSrc.indexOf("An in-progress compiler for this EXACT identity"));
  assert.match(fn, /segments\.every\(\(s: any\) => s\.visualIntent != null\)/);
  assert.match(fn, /synthesizeClaimsFromSegments\(segments\)/);
  assert.match(fn, /status: "ready", compiler_version: `\$\{NARRATION_CONTRACT_COMPILER_VERSION\}-inline`/);
  assert.doesNotMatch(fn, /await reserve\(\)/, "the inline synthesis path must spend zero provider-call budget");
});

test("synthesizeClaimsFromSegments maps every inline field onto the existing NarrationClaim shape (mustShow->requiredVisualFacts, mustNotShow->forbiddenVisualFacts, entities->entityRequirements, visualIntent->visualCommunicationGoal, exactTextOverlay->textOverlayCandidate) — no new schema invented", () => {
  const fn = visualPlanSrc.slice(visualPlanSrc.indexOf("function synthesizeClaimsFromSegments"), visualPlanSrc.indexOf("function synthesizeClaimsFromSegments") + 2200);
  assert.match(fn, /requiredVisualFacts: s\.mustShow/);
  assert.match(fn, /forbiddenVisualFacts: mustNotShow/);
  assert.match(fn, /entityRequirements: entities\.map/);
  assert.match(fn, /visualCommunicationGoal: s\.visualIntent/);
  assert.match(fn, /textOverlayCandidate: \{ recommended: Boolean\(exactText\)/);
  assert.match(fn, /preferredVisualForms: PREFERRED_FORM_TO_VISUAL_FORMS/);
});

test("a legacy script (segments without visualIntent) is unaffected and still falls through to the old durable multi-batch compiler", () => {
  const fn = visualPlanSrc.slice(visualPlanSrc.indexOf("export async function ensureNarrationContract"), visualPlanSrc.indexOf("async function fetchExistingCast"));
  const inlineIdx = fn.indexOf("synthesizeClaimsFromSegments(segments)");
  const legacyIdx = fn.indexOf('.eq("status", "compiling")');
  assert.ok(inlineIdx > -1 && legacyIdx > -1 && inlineIdx < legacyIdx, "the inline fast path must be checked BEFORE falling through to the legacy compiling-row lookup");
});

/* ---- SCRIPT SAFETY hard requirement ---- */

test("META_LANGUAGE_PATTERNS now catches ol_* ids and other internal-bookkeeping shapes as hard errors, not just a post-hoc strip", () => {
  const block = scriptSrc.slice(scriptSrc.indexOf("const META_LANGUAGE_PATTERNS"), scriptSrc.indexOf("function findMetaLanguage"));
  assert.match(block, /\\bol_\[a-z0-9_\]\+\\b/i);
  assert.match(block, /\\bopen loop/i);
  assert.match(block, /\\bclaim\[\\s-\]\?id\\b/i);
});

test("stageFinalizing sanitizes internal open-loop markers BEFORE the final deterministic validation runs, not after — the common (parenthetical) case is fixed before it can ever trip the hard-error gate", () => {
  // Phase 1 "Stickman Script Mode" wrapped the direct validateScriptDocument
  // call in a thin validateWithStickmanExtras(...) — validateScriptDocument
  // ITSELF is untouched (called from inside the wrapper with the exact same
  // 3 args as before; see stickmanScriptMode.test.mjs's own "LEGACY
  // UNCHANGED" coverage of that), only the call SITE's name changed.
  const fn = scriptSrc.slice(scriptSrc.indexOf("async function stageFinalizing"), scriptSrc.indexOf("async function stageFinalizing") + 4000);
  const stripIdx = fn.indexOf("doc = stripInternalOpenLoopMarkers(doc);");
  const validateIdx = fn.indexOf("const result = validateWithStickmanExtras(doc, pack, factIdSet, isStickman);");
  assert.ok(stripIdx > -1 && validateIdx > -1 && stripIdx < validateIdx, "sanitize must run before the gate it's meant to keep clean");
});

test("a chapter reaching zero narration still downgrades ready to needs_attention (unchanged from the prior fix) — do not silently send a broken script downstream", () => {
  assert.match(scriptSrc, /const emptyChapters = status === "ready" \? findEmptyChapters\(doc\) : \[\];/);
  assert.match(scriptSrc, /status = "needs_attention";/);
});

/* ---- SIMPLIFY VISUAL PLANNING: chapter-bounded, not monolithic ---- */

test("chapter-bounded planning calls the provider ONCE PER CHAPTER, each intentionally small and well under platform wall-clock limits (never the old 240s whole-video call)", () => {
  assert.match(visualPlanSrc, /const CHAPTER_PLAN_TIMEOUT_MS = 90_000;/);
  const fn = visualPlanSrc.slice(visualPlanSrc.indexOf("async function planNextChapter"), visualPlanSrc.indexOf("function normalizeEpisodeSequencing"));
  // 2026-09-20 "bounded chapter concurrency" pass: chapters are now selected
  // as a wave (`pending.filter`/`pending.slice`), not a single `.find` —
  // concurrency is covered in full by tests/visualPlanConcurrencyAndPromotion
  // .test.mjs; this just confirms the call site itself is unchanged.
  assert.match(fn, /const pending = chapters\.filter\(\(c: any\) => !plannedChapterIds\.includes\(c\.chapterId\)\);/);
  assert.match(fn, /runVisualDirectorForChapter\(/);
});

test("if a chapter's own call fails, only that chapter is retried — completed chapters' beats are already persisted and never replanned", () => {
  // See mergeChapterIntoAccumulated (extracted by the concurrency pass) and
  // tests/visualPlanConcurrencyAndPromotion.test.mjs for the full behavior.
  const fn = visualPlanSrc.slice(visualPlanSrc.indexOf("function mergeChapterIntoAccumulated"), visualPlanSrc.indexOf("function normalizeEpisodeSequencing"));
  assert.match(fn, /visualBeats: \[\.\.\.accumulated\.visualBeats, \.\.\.\(chapterPlan\.visualBeats \?\? \[\]\)\]/, "each chapter's beats must be appended to the already-persisted accumulated plan, not replace it");
  assert.match(fn, /\.update\(\{ visual_plan: merged, meta, stage_attempt: 0, worker_lock_until: null \}\)/, "each wave's successful chapters must be durably persisted immediately");
});

test("reserve() is spent exactly once for the whole chapter-bounded planning phase (on the first chapter only) — a 7-chapter video must not burn 7x the provider-call budget", () => {
  const fn = visualPlanSrc.slice(visualPlanSrc.indexOf("async function planNextChapter"), visualPlanSrc.indexOf("async function stagePlanning"));
  const reserveCalls = [...fn.matchAll(/await reserve\(\);/g)];
  assert.equal(reserveCalls.length, 1);
  assert.match(fn, /if \(!plannedChapterIds\.length\) await reserve\(\);/);
});

test("stagePlanning branches on whether the script is chapter-bounded (new-style) or legacy (monolithic runVisualDirector), and the chapter-bounded path never falls into the whole-plan repair-call branch", () => {
  const fn = visualPlanSrc.slice(visualPlanSrc.indexOf("async function stagePlanning"), visualPlanSrc.indexOf("async function stageFinalizing"));
  assert.match(fn, /const isChapterBounded = \(scriptDocument\.narrationSegments \?\? \[\]\)\.every\(\(s: any\) => s\.visualIntent != null\);/);
  assert.match(fn, /if \(!isChapterBounded && result\.errors\.length/, "the monolithic whole-plan repair call must be gated OFF for chapter-bounded scripts");
});

test("chapter-bounded planning still reuses the exact same deterministic finalize pipeline (canonicalizePlanCast, establishFirstSetups, validateVisualPlan) — no parallel second implementation", () => {
  const start = visualPlanSrc.indexOf("if (isChapterBounded) {");
  const fn = visualPlanSrc.slice(start, visualPlanSrc.indexOf("} else {", start));
  assert.match(fn, /establishFirstSetups\(canonicalizePlanCast\(plan, existingCast\)\)/);
});

test("an empty chapter (no segments) is skipped deterministically during chapter-bounded planning rather than sent to the provider", () => {
  // 2026-09-20 "bounded chapter concurrency" pass renamed this check from a
  // single-chapter `chapterSegments.length` guard to a `pending.find`
  // lookup that runs once per invocation before any concurrent wave is
  // dispatched — the invariant (empty chapters never reach the provider)
  // is unchanged.
  const fn = visualPlanSrc.slice(visualPlanSrc.indexOf("async function planNextChapter"), visualPlanSrc.indexOf("function normalizeEpisodeSequencing"));
  assert.match(fn, /const emptyChapter = pending\.find\(\(c: any\) => !\(scriptDocument\.narrationSegments \?\? \[\]\)\.some\(\(s: any\) => s\.chapterId === c\.chapterId\)\);/);
});
