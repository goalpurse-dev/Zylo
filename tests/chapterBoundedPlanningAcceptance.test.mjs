import test from "node:test";
import assert from "node:assert/strict";

// ACCEPTANCE TEST for the "V1 simplification" pass — proves the
// chapter-bounded planning MECHANICS (persist-per-chapter, resume skips
// completed chapters, never replans them, restoration reads the same
// durable row) using a fresh small fixture. No provider calls, no image
// generation, no credits: the OpenAI call itself (compileContractBatch/
// runVisualDirectorForChapter, both real network calls) is stubbed out here
// with a canned in-memory response — this test proves the ORCHESTRATION
// logic (the same merge/checkpoint algorithm asserted structurally against
// the real source in v1SimplificationPass.test.mjs), not the model call
// itself. Material limitation: this Node runtime cannot import the real
// advance-long-form-visual-plan/index.ts directly (its own "jsr:" Deno
// import is unresolvable here — a pre-existing, unrelated environment gap
// already true of several other test files in this suite), so this
// reimplements the documented contract rather than calling the deployed
// function. The structural tests in v1SimplificationPass.test.mjs confirm
// the real file matches this contract line-for-line.

// A minimal in-memory "durable row" — stands in for the real
// long_form_visual_plan_versions row across "invocations."
function makeFakeRow() {
  return { visual_plan: null, meta: {}, stage: "planning", stage_attempt: 1, worker_lock_until: "2026-01-01T00:05:00Z" };
}

// Mirrors planNextChapter's real merge contract exactly (entityRegistry/
// continuityGroups deduped by id, visualBeats/visualPayoffs concatenated in
// chapter order, plannedChapterIds appended) — see
// v1SimplificationPass.test.mjs's own assertions against the real source
// for the line-for-line match.
function mergeChapterResult(accumulated, chapterPlan) {
  const mergedEntities = [...accumulated.entityRegistry];
  const entityIds = new Set(mergedEntities.map((e) => e.id));
  for (const e of chapterPlan.entityRegistry ?? []) if (!entityIds.has(e.id)) { mergedEntities.push(e); entityIds.add(e.id); }
  const mergedGroups = [...accumulated.continuityGroups];
  const groupIds = new Set(mergedGroups.map((g) => g.id));
  for (const g of chapterPlan.continuityGroups ?? []) if (!groupIds.has(g.id)) { mergedGroups.push(g); groupIds.add(g.id); }
  return {
    visualMode: chapterPlan.visualMode ?? accumulated.visualMode,
    visualMix: chapterPlan.visualMix ?? accumulated.visualMix,
    entityRegistry: mergedEntities,
    continuityGroups: mergedGroups,
    visualBeats: [...accumulated.visualBeats, ...(chapterPlan.visualBeats ?? [])],
    visualPayoffs: [...accumulated.visualPayoffs, ...(chapterPlan.visualPayoffs ?? [])],
  };
}

// Simulates ONE invocation of planNextChapter: finds the next unplanned
// chapter, calls the (stubbed) director for it, merges + persists, returns
// {done:false} — or {done:true, plan} once every chapter is covered.
function planNextChapterSim(row, chapters, directorStub, providerCalls) {
  const plannedChapterIds = row.meta.plannedChapterIds ?? [];
  const accumulated = row.visual_plan ?? { visualMode: "HYBRID", visualMix: {}, entityRegistry: [], continuityGroups: [], visualBeats: [], visualPayoffs: [] };
  const nextChapter = chapters.find((c) => !plannedChapterIds.includes(c.chapterId));
  if (!nextChapter) return { done: true, plan: accumulated };

  if (!plannedChapterIds.length) providerCalls.reserved++; // reserve() spent exactly once, on the first chapter
  providerCalls.chapterCalls++;
  const chapterPlan = directorStub(nextChapter);
  const merged = mergeChapterResult(accumulated, chapterPlan);
  const nextPlanned = [...plannedChapterIds, nextChapter.chapterId];

  // Persist immediately — this IS the checkpoint.
  row.visual_plan = merged;
  row.meta = { ...row.meta, plannedChapterIds: nextPlanned };
  row.stage_attempt = 0;
  row.worker_lock_until = null;
  return { done: false };
}

const FIXTURE_CHAPTERS = [
  { chapterId: "c1", title: "Chapter One" },
  { chapterId: "c2", title: "Chapter Two" },
  { chapterId: "c3", title: "Chapter Three" },
];

function directorStub(chapter) {
  return {
    visualMode: "HYBRID",
    visualMix: { storyIllustrationPct: 50, explainerGraphicsPct: 30, mapDataPct: 20 },
    entityRegistry: [{ id: `${chapter.chapterId}_ent`, name: `Entity for ${chapter.title}`, category: "CHARACTER" }],
    continuityGroups: [{ id: `${chapter.chapterId}_group`, locationId: `${chapter.chapterId}_ent` }],
    visualBeats: [
      { id: `${chapter.chapterId}_b1`, chapterId: chapter.chapterId, sequenceIndex: 1 },
      { id: `${chapter.chapterId}_b2`, chapterId: chapter.chapterId, sequenceIndex: 2 },
    ],
    visualPayoffs: [],
  };
}

test("ACCEPTANCE: chapter-bounded planning persists every chapter and completes without recovery on a normal successful run", () => {
  const row = makeFakeRow();
  row.meta = {};
  const providerCalls = { reserved: 0, chapterCalls: 0 };

  let result;
  let invocations = 0;
  do {
    result = planNextChapterSim(row, FIXTURE_CHAPTERS, directorStub, providerCalls);
    invocations++;
  } while (!result.done && invocations < 10);

  assert.equal(result.done, true, "planning must complete within a bounded number of invocations");
  // 3 invocations to plan the 3 chapters, plus 1 final invocation that finds
  // nothing left unplanned and reports done — matching the real self-chain
  // architecture (a stage keeps re-dispatching itself until a call finds no
  // more work), not an off-by-one in the simulation.
  assert.equal(invocations, 4, "one invocation per chapter, plus one final invocation that detects completion");
  assert.equal(providerCalls.reserved, 1, "the provider-call budget reservation must be spent exactly once for the whole phase, not once per chapter");
  assert.equal(providerCalls.chapterCalls, 3, "one real call per chapter");
  assert.deepEqual(result.plan.visualBeats.map((b) => b.id), ["c1_b1", "c1_b2", "c2_b1", "c2_b2", "c3_b1", "c3_b2"], "beats must appear in chapter order, one chapter's worth added per invocation");
  assert.equal(result.plan.entityRegistry.length, 3, "one new entity per chapter, deduped");
  assert.deepEqual(row.meta.plannedChapterIds, ["c1", "c2", "c3"]);
});

test("ACCEPTANCE: if chapter 2 fails, chapter 1's already-persisted beats are never replanned or lost — only chapter 2 is retried", () => {
  const row = makeFakeRow();
  row.meta = {};
  const providerCalls = { reserved: 0, chapterCalls: 0 };
  let chapter2Attempts = 0;

  const flakyDirector = (chapter) => {
    if (chapter.chapterId === "c2") {
      chapter2Attempts++;
      if (chapter2Attempts === 1) throw new Error("simulated transient failure — the worker dies mid-call");
    }
    return directorStub(chapter);
  };

  // Invocation 1: chapter 1 succeeds and is persisted.
  let result = planNextChapterSim(row, FIXTURE_CHAPTERS, flakyDirector, providerCalls);
  assert.equal(result.done, false);
  assert.deepEqual(row.meta.plannedChapterIds, ["c1"]);
  const chapter1BeatsAfterFirstRun = JSON.parse(JSON.stringify(row.visual_plan.visualBeats));

  // Invocation 2: chapter 2's call throws (simulated worker death) — the
  // real ensureNarrationContract/planNextChapter pattern releases the lease
  // and returns {done:false} WITHOUT touching plannedChapterIds or
  // visual_plan on failure (see planNextChapter's own catch-and-retry
  // shape); simulate that contract directly here.
  try {
    planNextChapterSim(row, FIXTURE_CHAPTERS, flakyDirector, providerCalls);
    assert.fail("expected the stubbed director to throw on its first chapter-2 attempt");
  } catch (e) {
    assert.match(String(e), /simulated transient failure/);
  }
  // Chapter 1's persisted work is untouched by the failed chapter-2 attempt.
  assert.deepEqual(row.visual_plan.visualBeats, chapter1BeatsAfterFirstRun);
  assert.deepEqual(row.meta.plannedChapterIds, ["c1"], "chapter 1 must still be the only chapter marked planned");

  // Invocation 3 (retry): chapter 2 succeeds this time.
  result = planNextChapterSim(row, FIXTURE_CHAPTERS, flakyDirector, providerCalls);
  assert.equal(result.done, false);
  assert.deepEqual(row.meta.plannedChapterIds, ["c1", "c2"]);

  // Invocation 4: chapter 3 is planned (not yet "done" — see the base
  // acceptance test's own comment on why one more invocation is needed to
  // detect completion).
  result = planNextChapterSim(row, FIXTURE_CHAPTERS, flakyDirector, providerCalls);
  assert.equal(result.done, false);
  assert.deepEqual(row.meta.plannedChapterIds, ["c1", "c2", "c3"]);

  // Invocation 5: nothing left unplanned — done.
  result = planNextChapterSim(row, FIXTURE_CHAPTERS, flakyDirector, providerCalls);
  assert.equal(result.done, true);
  assert.equal(chapter2Attempts, 2, "chapter 2 was retried exactly once after its simulated failure, never chapter 1 or 3");
  assert.equal(providerCalls.reserved, 1, "still exactly one reservation for the whole phase, despite the retry");
});

test("ACCEPTANCE: refresh/back/forward restoration reads the same durable row — never restarts planning from chapter 1", () => {
  const row = makeFakeRow();
  row.meta = {};
  const providerCalls = { reserved: 0, chapterCalls: 0 };

  // Two chapters complete, then the "browser closes" — nothing further
  // happens to `row` until it's "reopened" (read again) below.
  planNextChapterSim(row, FIXTURE_CHAPTERS, directorStub, providerCalls);
  planNextChapterSim(row, FIXTURE_CHAPTERS, directorStub, providerCalls);
  const persistedAfterClose = JSON.parse(JSON.stringify(row));

  // "Reopen": a fresh read of the exact same row (simulating a page
  // refresh/back/forward/Recent-Projects resume) must see the SAME
  // completed chapters and durable plan — restoration is a pure read here,
  // never a new planNextChapterSim call triggered by navigation itself.
  const restored = JSON.parse(JSON.stringify(persistedAfterClose));
  assert.deepEqual(restored.meta.plannedChapterIds, ["c1", "c2"]);
  assert.equal(restored.visual_plan.visualBeats.length, 4);

  // Resuming work (the worker's own self-chain, not navigation) continues
  // from chapter 3 — never replans c1/c2.
  let result = planNextChapterSim(restored, FIXTURE_CHAPTERS, directorStub, providerCalls);
  assert.equal(result.done, false);
  assert.deepEqual(restored.meta.plannedChapterIds, ["c1", "c2", "c3"]);
  result = planNextChapterSim(restored, FIXTURE_CHAPTERS, directorStub, providerCalls);
  assert.equal(result.done, true);
  assert.equal(providerCalls.chapterCalls, 3, "only 3 real chapter calls total across the whole close/reopen/resume sequence — never 4+ from replanning c1/c2 again");
});
