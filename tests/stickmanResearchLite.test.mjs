import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

// ============================================================================
// Legacy documentary research pipeline completely unchanged.
// ============================================================================

test("LEGACY UNCHANGED: RESEARCH_PLANNER_INSTRUCTIONS, RETRIEVAL_INSTRUCTIONS, EXTRACTOR_INSTRUCTIONS, CRITIC_INSTRUCTIONS keep their exact original wording", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  assert.match(text, /You are Zyvo's Research Planner for long-form 2D explainer videos\. You receive a completed Story Plan/);
  assert.match(text, /You are a fact-finding researcher for a YouTube explainer video\. You will be given a research focus and ONE specific search query/);
  assert.match(text, /You are Zyvo's Source & Fact Extractor for a long-form explainer video's Research stage\./);
  assert.match(text, /an 8-15 minute video needs perhaps 25-60 well-chosen facts, not hundreds of trivial ones\./);
  assert.match(text, /You are Zyvo's Research Coverage Critic\. You receive a Story Plan and the FactGraph built for it/);
  assert.match(text, /You are Zyvo's Fact Merge & Deduplication step\./);
});

test("LEGACY UNCHANGED: the full documentary stage machine (planning->initial_search->initial_extraction->coverage_review->gap_search->final_extraction->final_coverage_review) still calls the exact original functions, unbranched", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  assert.match(text, /case "initial_search":\s*await stageInitialSearch\(admin, row, project, storyPlan\);/);
  assert.match(text, /case "initial_extraction":\s*await stageInitialExtraction\(admin, row, project, storyPlan\);/);
  assert.match(text, /case "coverage_review":\s*await stageCoverageReview\(admin, row, project, storyPlan\);/);
  assert.match(text, /case "gap_search":\s*await stageGapSearch\(admin, row, project, storyPlan\);/);
  assert.match(text, /case "final_extraction":\s*await stageFinalExtraction\(admin, row, project, storyPlan\);/);
  assert.match(text, /case "final_coverage_review":\s*await stageFinalCoverageReview\(admin, row, project, storyPlan\);/);
  assert.match(text, /case "finalizing":\s*await stageFinalizing\(admin, row, project, storyPlan\);/);
  // The one and only fork point between the two pipelines.
  assert.match(text, /case "planning":\s*if \(isStickman\) await stageLiteClaimPlan\(admin, row, project, storyPlan, niche\);\s*else await stagePlanning\(admin, row, project, storyPlan\);/);
});

test("LEGACY UNCHANGED: every legacy budget/timeout/concurrency constant is untouched", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  assert.match(text, /const MAX_ESTIMATED_COST_PER_RESEARCH_USD = Number\(Deno\.env\.get\("LONG_FORM_MAX_COST_PER_RESEARCH_USD"\) \?\? 0\.5\);/);
  assert.match(text, /const INITIAL_QUERY_BUDGET = Number\(Deno\.env\.get\("LONG_FORM_INITIAL_QUERY_BUDGET"\) \?\? 8\);/);
  assert.match(text, /const GAP_QUERY_BUDGET = Number\(Deno\.env\.get\("LONG_FORM_GAP_QUERY_BUDGET"\) \?\? 4\);/);
  assert.match(text, /const SEARCH_CONCURRENCY = 3;/);
  assert.match(text, /const EXTRACTION_CONCURRENCY = 3;/);
  assert.match(text, /const MAX_STAGE_ATTEMPTS = 3;/);
  assert.match(text, /const MAX_FINDINGS_PER_EXTRACTION_BATCH = 2;/);
  assert.match(text, /const MAX_EXTRACTION_BATCH_CHARS = 6_000;/);
});

test("LEGACY UNCHANGED: runRetrieval/runQueueBatch/runExtractionBatchStage's own trailing params all default to the exact original legacy behavior; Research-Lite (Phase 1c) no longer calls any of them at all, having moved to its own merged verify call", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  assert.match(text, /async function runRetrieval\([^)]*instructions: string = RETRIEVAL_INSTRUCTIONS\)/);
  assert.match(text, /stageName: "initial_search" \| "gap_search" \| "repair_search",/);
  assert.match(text, /retrievalInstructions: string = RETRIEVAL_INSTRUCTIONS/);
  assert.match(text, /concurrency: number = EXTRACTION_CONCURRENCY, costCeiling: number = MAX_ESTIMATED_COST_PER_RESEARCH_USD/);
  assert.match(text, /runRetrieval\(entry, questionLookup, usage, retrievalInstructions\)/);
});

test("LEGACY UNCHANGED: mergeExtractedFacts, buildExtractionBatches, chunkFinding, and the extractor/merge schemas exist exactly once, used only by the legacy initial/final/repair extraction stages — Phase 1c's Research-Lite has its own merged verify call and no longer uses any of them", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  const countOccurrences = (re) => (text.match(re) ?? []).length;
  assert.equal(countOccurrences(/^async function mergeExtractedFacts\(/m), 1);
  assert.equal(countOccurrences(/^function buildExtractionBatches\(/m), 1);
  assert.equal(countOccurrences(/^function chunkFinding\(/m), 1);
  assert.equal(countOccurrences(/^function buildExtractorSchema\(/m), 1);
  assert.match(text, /const \{ facts: v1Facts, sourcesFull: v1SourcesFull \} = await mergeExtractedFacts\(row, storyPlan, updatedBatches, undefined, undefined, usage\);/);
});

// ============================================================================
// Research-Lite (Phase 1c) is wired into the handler and reads the profile
// once. Section 2 replaced the separate search-then-extraction pair with
// ONE merged verify call per question group.
// ============================================================================

test("STICKMAN: the handler fetches the active profile once and threads isStickman/niche only into the fork point and stageLiteClaimPlan", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  assert.match(text, /const profile = await fetchActiveGenerationProfile\(admin, row\.project_id\);/);
  assert.match(text, /const isStickman = isStickmanProfile\(profile\);/);
  assert.match(text, /const niche = nicheFromProfile\(profile\);/);
  for (const stage of ["lite_verify", "lite_coverage", "lite_gap_verify"]) {
    assert.match(text, new RegExp(`case "${stage}":`), `missing switch case for ${stage}`);
  }
});

test("STICKMAN: Research-Lite writes facts/sources into the exact intermediate keys stageFinalizing already reads (v1SourcesFull / finalSourcesFull) — stageFinalizing itself needs zero changes", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  assert.match(text, /const finalSourcesFull = dedupeSourcesByNormalizedUrl\(row\.intermediate\?\.finalSourcesFull \?\? row\.intermediate\?\.repairSourcesFull \?\? row\.intermediate\?\.v1SourcesFull \?\? \[\]\);/);
  assert.match(text, /intermediate = \{ \.\.\.\(row\.intermediate \?\? \{\}\), liteVerifyQueue: undefined, v1SourcesFull: sourcesFull \};/);
  assert.match(text, /finalSourcesFull: Array\.from\(mergedSourcesByUrl\.values\(\)\) \};/);
});

test("STICKMAN: the merged verify call combines web_search with strict structured output in ONE call — no separate extraction call exists anymore for this recipe", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  const fn = text.slice(text.indexOf("async function runStickmanVerify"), text.indexOf("async function runVerifyQueueBatch"));
  assert.match(fn, /tools: \[\{ type: "web_search", search_context_size: "medium" \}\]/);
  assert.match(fn, /text: \{ format: \{ type: "json_schema", name: "stickman_verify", strict: true, schema: buildStickmanVerifySchema/);
  assert.match(fn, /const citations = extractCitations\(payload\);/);
});

test("STICKMAN: a fact's URL is proven with a live fetch, not trusted from the model's own text or from citations — confirmed via a raw-API smoke test that web_search + strict json_schema output returns EMPTY annotations even on a real search, so extractCitations-based cross-checking never has anything to match against", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  const fn = text.slice(text.indexOf("async function runStickmanVerify"), text.indexOf("async function runVerifyQueueBatch"));
  assert.match(fn, /const candidates = \(parsed\?\.facts \?\? \[\]\)\.filter\(\(f: any\) => f\?\.url\);/);
  assert.match(fn, /const liveChecks = await Promise\.all\(candidates\.map\(\(f: any\) => urlIsLive\(f\.url\)\)\);/);
  assert.match(fn, /const rawFacts = candidates\.filter\(\(_: any, i: number\) => liveChecks\[i\]\);/);
  assert.doesNotMatch(fn, /validUrls\.has/, "the old citations-Set cross-check is gone — annotations are empty in this call shape, so it always filtered everything out");

  const urlIsLiveFn = text.slice(text.indexOf("async function urlIsLive"), text.indexOf("async function runStickmanVerify"));
  assert.match(urlIsLiveFn, /new URL\(url\)/);
  assert.match(urlIsLiveFn, /protocol !== "http:" && parsed\.protocol !== "https:"/);
  assert.match(urlIsLiveFn, /fetch\(url, \{ method, redirect: "follow"/);
});

test("STICKMAN: the verify fact schema matches the spec exactly (questionId, claim, sourceName, number, unit, url, quoteOrEvidence, confidence)", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  const fn = text.slice(text.indexOf("function buildStickmanVerifySchema"), text.indexOf("async function runStickmanVerify"));
  for (const field of ["questionId", "claim", "sourceName", "number", "unit", "url", "quoteOrEvidence", "confidence"]) {
    assert.match(fn, new RegExp(`"${field}"`), `missing field ${field} in the verify fact schema`);
  }
});

test("STICKMAN: mapVerifiedFactsToEvidence produces the exact same Fact shape buildExtractorSchema requires, so buildEvidencePack/Script need zero changes", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  const fn = text.slice(text.indexOf("function mapVerifiedFactsToEvidence"), text.indexOf("async function stageLiteVerify"));
  for (const field of ["classification", "confidence", "sourceIds", "chapterIds", "researchQuestionIds", "disputed", "disputeSummary", "uncertaintyNotes", "temporalScope", "geographicScope", "scriptUsable"]) {
    assert.match(fn, new RegExp(field), `missing Fact field ${field}`);
  }
});

test("STICKMAN: the research ceiling (STICKMAN_RESEARCH_CEILING_USD) is used directly by the merged verify call — no separate search/extraction split needed anymore since there's only one call type. Raised from the original $0.25 to $0.45 after a real diagnostic run (Lions topic) showed the flat web_search tool fee alone (~$0.02/verify call, 2 real tool calls each despite max_tool_calls:1) consumed the whole $0.25 ceiling in the initial round and starved out the one required gap pass, landing at 6/10 facts — reliability over cost per the Phase 1c brief.", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  assert.match(text, /const STICKMAN_RESEARCH_CEILING_USD = Number\(Deno\.env\.get\("LONG_FORM_STICKMAN_RESEARCH_CEILING_USD"\) \?\? 0\.45\);/);
  assert.doesNotMatch(text, /STICKMAN_SEARCH_COST_CEILING_USD/, "the old search/extraction budget split no longer applies — there is one merged call now");
});

test("STICKMAN: below STICKMAN_MIN_FACTS (10) even after one gap pass, research is marked needs_attention with a clear detail reason and Script is never started", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  assert.match(text, /const STICKMAN_MIN_FACTS = 10;/);
  assert.match(text, /if \(!needsGap && facts\.length < STICKMAN_MIN_FACTS\) \{/);
  assert.match(text, /reason: "insufficient_facts", factCount: facts\.length, minRequired: STICKMAN_MIN_FACTS/);
  assert.match(text, /completionReason: "insufficient_facts_below_minimum"/);
  const startScript = await source("supabase/functions/start-long-form-script/index.ts");
  assert.match(startScript, /completionReason === "insufficient_facts_below_minimum"/);
  assert.match(startScript, /INSUFFICIENT_RESEARCH_FACTS/);
});

test("STICKMAN: the gap pass runs at most once (no further loops) — triggered by either low answer coverage OR too few facts, and re-checked (not re-triggered) via lite_coverage's own alreadyRanGap guard", async () => {
  const text = await source("supabase/functions/advance-long-form-research/index.ts");
  assert.match(text, /const alreadyRanGap = Boolean\(row\.intermediate\?\.liteGapRoundRan\);/);
  assert.match(text, /const needsGap = !alreadyRanGap && \(unansweredRatio > STICKMAN_GAP_COVERAGE_THRESHOLD \|\| facts\.length < STICKMAN_MIN_FACTS\) && questions\.length > 0;/);
  assert.match(text, /liteGapRoundRan: true/);
  // The gap round routes back to lite_coverage (not straight to finalizing)
  // so the min-facts/ready decision is made once, in one place.
  assert.match(text, /stage: "lite_coverage", stage_attempt: 0, worker_lock_until: null \}\)\.eq\("id", row\.id\);\s*\n\}/);
});

test("STICKMAN: full detail (validators/errors/segments) is persisted on script draft failure, not just an error code", async () => {
  const scriptText = await source("supabase/functions/advance-long-form-script/index.ts");
  assert.match(scriptText, /const detail = \{\s*\n\s*errors: result\.errors,\s*\n\s*factCount: pack\.chapters\.reduce/);
  assert.match(scriptText, /status: "failed", last_error_code: "DRAFT_VALIDATION_FAILED", last_error_at: new Date\(\)\.toISOString\(\), meta, detail, worker_lock_until: null/);
});

// ============================================================================
// New pure helper functions — real behavioral unit tests, not just source
// pattern regex (these functions have no Deno-only imports and can be
// imported directly under plain Node, same convention scriptChecks.ts uses).
// ============================================================================

// advance-long-form-research/index.ts is a Deno edge-function entrypoint
// (Deno.serve at module scope) — the setup.mjs Deno shim (globalThis.Deno)
// lets it import cleanly under plain Node without actually invoking the
// handler, the same pattern already used by other tests importing real
// edge-function entrypoint files (see tests/setup.mjs's own comment).
const { groupQuestionsIntoQueries, trimToRelevantSnippets, computeLiteCoverage } = await import("../supabase/functions/advance-long-form-research/index.ts");

test("groupQuestionsIntoQueries: leaves questions ungrouped (1 query each) when the count already fits the budget", () => {
  const questions = Array.from({ length: 15 }, (_, i) => ({ id: `q${i}`, question: `Question ${i}?`, sectionId: "s1", priority: "important" }));
  const tasks = groupQuestionsIntoQueries(questions, 20, 3);
  assert.equal(tasks.length, 15);
  assert.ok(tasks.every((t) => t.queries.length === 1 && t.targetQuestionIds.length === 1));
});

test("groupQuestionsIntoQueries: groups questions (2-3 per query) to stay within the query budget when there are more questions than the budget allows", () => {
  const questions = Array.from({ length: 25 }, (_, i) => ({ id: `q${i}`, question: `Question ${i}?`, sectionId: `s${i % 5}`, priority: "important" }));
  const tasks = groupQuestionsIntoQueries(questions, 20, 3);
  assert.ok(tasks.length <= 20, `expected at most 20 tasks, got ${tasks.length}`);
  assert.ok(tasks.every((t) => t.targetQuestionIds.length <= 3));
  const coveredIds = new Set(tasks.flatMap((t) => t.targetQuestionIds));
  assert.equal(coveredIds.size, 25, "every question must still be covered by exactly one task");
});

test("groupQuestionsIntoQueries: keeps same-section questions adjacent within a group where possible", () => {
  const questions = [
    { id: "a1", question: "A1?", sectionId: "evidence1", priority: "critical" },
    { id: "a2", question: "A2?", sectionId: "evidence1", priority: "critical" },
    { id: "b1", question: "B1?", sectionId: "evidence2", priority: "important" },
  ];
  const tasks = groupQuestionsIntoQueries(questions, 1, 3);
  assert.equal(tasks.length, 1);
  assert.deepEqual(tasks[0].targetQuestionIds.sort(), ["a1", "a2", "b1"]);
});

test("trimToRelevantSnippets: returns short text unchanged", () => {
  const text = "A short answer with a keyword in it.";
  assert.equal(trimToRelevantSnippets(text, ["keyword"], 1500), text);
});

test("trimToRelevantSnippets: extracts a window around a keyword match in long text, not the whole thing", () => {
  const filler = "x".repeat(5000);
  const text = `${filler}IMPORTANT_KEYWORD_MATCH${filler}`;
  const trimmed = trimToRelevantSnippets(text, ["IMPORTANT_KEYWORD_MATCH"], 1500);
  assert.ok(trimmed.length < text.length, "trimmed text must be shorter than the original");
  assert.ok(trimmed.includes("IMPORTANT_KEYWORD_MATCH"), "the actual match must survive trimming");
});

test("trimToRelevantSnippets: falls back to a flat truncation (never empty) when no keyword matches at all", () => {
  const text = "y".repeat(5000);
  const trimmed = trimToRelevantSnippets(text, ["nomatch"], 1500);
  assert.ok(trimmed.length > 0);
  assert.ok(trimmed.length <= 3000);
});

test("computeLiteCoverage: a fully-answered set of questions across all sections reports strong coverage everywhere", () => {
  const questions = [
    { id: "q1", sectionId: "s1" },
    { id: "q2", sectionId: "s2" },
  ];
  const facts = [
    { researchQuestionIds: ["q1"] },
    { researchQuestionIds: ["q2"] },
  ];
  const sections = [{ id: "s1" }, { id: "s2" }];
  const { coverage, unansweredRatio } = computeLiteCoverage(questions, facts, sections);
  assert.equal(unansweredRatio, 0);
  assert.equal(coverage.overallCoverage, "strong");
  assert.ok(coverage.chapterCoverage.every((c) => c.status === "strong"));
  assert.deepEqual(coverage.unansweredQuestionIds, []);
});

test("computeLiteCoverage: more than 30% unanswered reports weak overall coverage and names the unanswered question ids", () => {
  const questions = Array.from({ length: 10 }, (_, i) => ({ id: `q${i}`, sectionId: "s1" }));
  // Only 5 of 10 answered = 50% unanswered, over the 30% threshold.
  const facts = questions.slice(0, 5).map((q) => ({ researchQuestionIds: [q.id] }));
  const sections = [{ id: "s1" }];
  const { coverage, unansweredRatio } = computeLiteCoverage(questions, facts, sections);
  assert.equal(unansweredRatio, 0.5);
  assert.equal(coverage.overallCoverage, "weak");
  assert.equal(coverage.unansweredQuestionIds.length, 5);
});

test("computeLiteCoverage: a section with no assigned questions at all is reported strong (nothing required, not a gap)", () => {
  const questions = [{ id: "q1", sectionId: "s1" }];
  const facts = [{ researchQuestionIds: ["q1"] }];
  const sections = [{ id: "s1" }, { id: "cold_open_section" }];
  const { coverage } = computeLiteCoverage(questions, facts, sections);
  const coldOpen = coverage.chapterCoverage.find((c) => c.chapterId === "cold_open_section");
  assert.equal(coldOpen.status, "strong");
});
