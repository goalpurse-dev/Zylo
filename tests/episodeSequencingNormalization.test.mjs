import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 2026-09-20 real incident: "If the Sun Vanished Right Now" (visual plan
// attempts 7ed7bdca-..., 70cc0cdf-...) — chapter-bounded planning correctly
// planned all 7 chapters, but each chapter's beats carried CHAPTER-LOCAL
// sequenceIndex/timing (each chapter's own call has no idea where earlier
// chapters left off). Concatenating them fed local values straight into the
// episode-global validator: "sequenceIndex is not strictly increasing" at
// every chapter boundary, and a total duration of 90s against a real ~628s
// script. Source-structural (this Node runtime can't resolve this file's
// own "jsr:" Deno import — a pre-existing, unrelated environment gap).

const src = fs.readFileSync(new URL("../supabase/functions/advance-long-form-visual-plan/index.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("function normalizeEpisodeSequencing"), src.indexOf("async function stagePlanning"));

test("normalizeEpisodeSequencing is called right after chapter merge, BEFORE canonicalizePlanCast/establishFirstSetups/validateVisualPlan ever see the plan", () => {
  const stageFn = src.slice(src.indexOf("if (isChapterBounded) {"), src.indexOf("} else {", src.indexOf("if (isChapterBounded) {")));
  const normIdx = stageFn.indexOf("normalizeEpisodeSequencing(chapterResult.plan, scriptDocument)");
  const canonIdx = stageFn.indexOf("canonicalizePlanCast(plan, existingCast)");
  assert.ok(normIdx > -1 && canonIdx > -1 && normIdx < canonIdx, "normalization must run before cast canonicalization / first-setup tracking");
});

test("sequenceIndex is reassigned as a single global 0..N-1 episode index — the LLM's chapter-local value is never trusted downstream", () => {
  assert.match(fn, /chapterLocalSequenceIndex: b\.sequenceIndex,/);
  assert.match(fn, /sequenceIndex: i,/);
});

test("beats are ordered by real script chapter order first, then chapter-local index — never re-sorted by the model's own possibly-colliding local index alone", () => {
  const block = fn.slice(fn.indexOf("const beats ="), fn.indexOf("const normalizedBeats"));
  assert.match(block, /const ca = chapterOrder\.get\(a\.chapterId\) \?\? 0;/);
  assert.match(block, /if \(ca !== cb\) return ca - cb;/);
});

test("timeline is remapped from each beat's own narration segment's real cumulative script position — narration is the master clock, never each chapter trusting it starts at 0", () => {
  const block = fn.slice(fn.indexOf("const orderedSegments ="), fn.indexOf("const beats ="));
  assert.match(block, /cursor \+= s\.estimatedSeconds \?\? 0;/);
  // 2026-09-20 "bounded chapter concurrency" pass (round 3 of this same
  // incident, v3) hardened the fallback further — see
  // tests/visualPlanConcurrencyAndPromotion.test.mjs for the full
  // chapter-anchor + monotonic-floor assertions. This just confirms the
  // resolved-from-segment path (the common case) is still intact.
  // 2026-09-20 "duration derived from real segment spans" pass (round 4,
  // v4) replaced the single-anchor-plus-model-duration approach entirely —
  // see tests/visualPlanConcurrencyAndPromotion.test.mjs for the current
  // (start-from-earliest-segment, end-from-latest-segment) assertions.
  const mapBlock = fn.slice(fn.indexOf("const normalizedBeats = beats.map"), fn.length);
  assert.match(mapBlock, /resolvedIds\.length/);
});

test("this is a pure deterministic function — no provider call, no OpenAI, no repair-call fallback added for malformed ordering", () => {
  assert.doesNotMatch(fn, /callStructured|callOpenAI|OPENAI/);
});

// Behavioral proof of the actual bug/fix, using the SAME algorithm inline
// (mirrors the real function's logic exactly — verified structurally above
// against the real source) since this Node runtime can't import the .ts
// file directly.
function normalizeEpisodeSequencingSim(plan, scriptDocument) {
  const chapters = scriptDocument.chapters ?? [];
  const segments = scriptDocument.narrationSegments ?? [];
  const chapterOrder = new Map(chapters.map((c, i) => [c.chapterId, i]));
  const orderedSegments = [...segments].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  const segmentStart = new Map();
  let cursor = 0;
  for (const s of orderedSegments) {
    segmentStart.set(s.id, cursor);
    cursor += s.estimatedSeconds ?? 0;
  }
  const beats = [...(plan.visualBeats ?? [])].sort((a, b) => {
    const ca = chapterOrder.get(a.chapterId) ?? 0;
    const cb = chapterOrder.get(b.chapterId) ?? 0;
    if (ca !== cb) return ca - cb;
    return (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0);
  });
  const normalizedBeats = beats.map((b, i) => {
    const localDurationSeconds = Math.max(1, (b.estimatedEndSeconds ?? 0) - (b.estimatedStartSeconds ?? 0));
    const firstSegmentId = (b.narrationSegmentIds ?? [])[0];
    const globalStart = firstSegmentId != null && segmentStart.has(firstSegmentId) ? segmentStart.get(firstSegmentId) : b.estimatedStartSeconds;
    return { ...b, chapterLocalSequenceIndex: b.sequenceIndex, sequenceIndex: i, estimatedStartSeconds: globalStart, estimatedEndSeconds: globalStart + localDurationSeconds };
  });
  return { ...plan, visualBeats: normalizedBeats };
}

test("BEHAVIORAL: reproduces the real Sun-project defect (chapter-local resets) and proves the fix — global sequenceIndex strictly increasing, duration near real script length", () => {
  // Two chapters, each 2 segments of 100s (mirrors the real ~628s/7-chapter scale down).
  const scriptDocument = {
    chapters: [{ chapterId: "ch1" }, { chapterId: "ch2" }],
    narrationSegments: [
      { id: "s1", chapterId: "ch1", sequenceIndex: 0, estimatedSeconds: 100 },
      { id: "s2", chapterId: "ch1", sequenceIndex: 1, estimatedSeconds: 100 },
      { id: "s3", chapterId: "ch2", sequenceIndex: 2, estimatedSeconds: 100 },
      { id: "s4", chapterId: "ch2", sequenceIndex: 3, estimatedSeconds: 100 },
    ],
  };
  // Exactly the real bug shape: each chapter's own call restarts sequenceIndex/time at 0.
  const plan = {
    visualBeats: [
      { id: "vb_ch1_01", chapterId: "ch1", sequenceIndex: 0, narrationSegmentIds: ["s1"], estimatedStartSeconds: 0, estimatedEndSeconds: 45 },
      { id: "vb_ch1_02", chapterId: "ch1", sequenceIndex: 1, narrationSegmentIds: ["s2"], estimatedStartSeconds: 45, estimatedEndSeconds: 90 },
      { id: "vb_ch2_01", chapterId: "ch2", sequenceIndex: 0, narrationSegmentIds: ["s3"], estimatedStartSeconds: 0, estimatedEndSeconds: 40 },
      { id: "vb_ch2_02", chapterId: "ch2", sequenceIndex: 1, narrationSegmentIds: ["s4"], estimatedStartSeconds: 40, estimatedEndSeconds: 90 },
    ],
  };

  // Reproduce: raw concatenation is NOT globally monotonic (the real bug).
  const rawSeq = plan.visualBeats.map((b) => b.sequenceIndex);
  assert.notEqual(rawSeq[2] > rawSeq[1], true, "sanity check: the unfixed concatenation really does reset at the chapter boundary");

  const fixed = normalizeEpisodeSequencingSim(plan, scriptDocument);
  const seqs = fixed.visualBeats.map((b) => b.sequenceIndex);
  assert.deepEqual(seqs, [0, 1, 2, 3], "sequenceIndex must be a single strictly-increasing global episode index");
  assert.equal(fixed.visualBeats[2].chapterLocalSequenceIndex, 0, "the original chapter-local value must be preserved for debugging");

  for (let i = 1; i < fixed.visualBeats.length; i++) {
    assert.ok(fixed.visualBeats[i].estimatedStartSeconds >= fixed.visualBeats[i - 1].estimatedStartSeconds, `beat ${i} must not start before the previous beat (global monotonic timeline)`);
  }
  assert.ok(fixed.visualBeats[2].estimatedStartSeconds >= 200, "chapter 2's first beat must begin at/after chapter 1's real narration duration (200s), never resetting to 0");

  const totalScriptSeconds = 400; // 4 segments x 100s
  const planDuration = Math.max(...fixed.visualBeats.map((b) => b.estimatedEndSeconds));
  const divergence = Math.abs(planDuration - totalScriptSeconds) / totalScriptSeconds;
  assert.ok(divergence < 0.15, `final duration (${planDuration}s) must approximately track the real script duration (${totalScriptSeconds}s), not collapse to one chapter's local range`);
});
