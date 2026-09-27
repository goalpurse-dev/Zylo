import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 2026-09-20 real production incident, second finding: the Moon project's
// finished "Narration Ready" script (project f7dc5503-..., script
// 49dd2f2f-...) shipped to status="ready" with two real defects, confirmed
// live via direct DB read:
//   1. Segments s1/s2/s9 contained literal internal planning ids the writer
//      leaked into spoken narration: "(ol_eject)", "(closing the ol_eject
//      question)", "(closing the ol_rotation_tilt thread ...)" — openLoops
//      bookkeeping that would be read aloud verbatim by TTS.
//   2. Chapter c6 ("Deep Time: The Moon as a Cosmic Shield...") reached
//      "ready" with segmentIds: [], actualWords: 0, estimatedSeconds: 0 — a
//      whole promised chapter with zero narration, because the
//      conservative-rewrite pass that unblocked status="ready" could only
//      soften chapter c3's EXISTING text; it had nothing to rewrite for a
//      chapter the writer never wrote at all.
// Source-pattern tests (this codebase's established convention for Deno
// edge-function logic a plain Node test can't import directly — this file's
// own "jsr:" import is unresolvable in this Node runtime, a pre-existing,
// unrelated environment gap already true of several other test files here).

const src = fs.readFileSync(new URL("../supabase/functions/advance-long-form-script/index.ts", import.meta.url), "utf8");

test("stripInternalOpenLoopMarkers strips the whole parenthetical containing an ol_* id, not just the bare token (keeps the sentence grammatical)", () => {
  assert.match(src, /const INTERNAL_OPEN_LOOP_MARKER = \/\\s\*\\\(\[\^\(\)\]\*\\bol_\[a-z0-9_\]\+\\b\[\^\(\)\]\*\\\)\/gi;/);
  const fn = src.slice(src.indexOf("function stripInternalOpenLoopMarkers"), src.indexOf("function findEmptyChapters"));
  assert.match(fn, /replace\(INTERNAL_OPEN_LOOP_MARKER, ""\)/);
});

test("stripInternalOpenLoopMarkers actually removes the real reported strings", () => {
  const re = /\s*\([^()]*\bol_[a-z0-9_]+\b[^()]*\)/gi;
  const cases = [
    ["does Earth get kicked in space (ol_eject), how big do tides become without the lunar part (ol_tide_size), and which nocturnal rhythms break (ol_nocturnal)?", "does Earth get kicked in space, how big do tides become without the lunar part, and which nocturnal rhythms break?"],
    ["we keep Earth's heliocentric motion effectively unchanged (closing the ol_eject question).", "we keep Earth's heliocentric motion effectively unchanged."],
    ["the amplitude and timing remain actively debated (closing the ol_rotation_tilt thread only at the level of 'more freedom, more uncertainty').", "the amplitude and timing remain actively debated."],
  ];
  for (const [input, expected] of cases) {
    const cleaned = input.replace(re, "").replace(/\s{2,}/g, " ").trim();
    assert.equal(cleaned, expected);
    assert.doesNotMatch(cleaned, /\bol_[a-z0-9_]+\b/);
  }
});

test("stripInternalOpenLoopMarkers is applied unconditionally to every finalized document, not only ones with flagged issues", () => {
  const block = src.slice(src.indexOf("const finalDocument ="), src.indexOf("const finalDocument =") + 400);
  assert.match(block, /const finalDocument = stripInternalOpenLoopMarkers\(\{/);
});

test("findEmptyChapters flags a chapter with no covering segments OR an explicit empty segmentIds array — the real c6 shape had both", () => {
  const fn = src.slice(src.indexOf("function findEmptyChapters"), src.indexOf("function findEmptyChapters") + 700);
  assert.match(fn, /!coveredChapterIds\.has\(c\.chapterId\) \|\| \(c\.segmentIds \?\? \[\]\)\.length === 0/);
});

test("a chapter reaching zero-narration status downgrades 'ready' to 'needs_attention' — never silently ships a hollow chapter as done", () => {
  const block = src.slice(src.indexOf("const emptyChapters ="), src.indexOf("const qualitySummary ="));
  assert.match(block, /status === "ready" \? findEmptyChapters\(doc\) : \[\]/);
  assert.match(block, /if \(emptyChapters\.length\) \{\s*\n\s*status = "needs_attention";/);
});

test("the empty-chapter downgrade check runs AFTER the conservative-rewrite/repair branches decide status, so it can catch a rewrite that left a chapter still empty", () => {
  const firstReadyIdx = src.indexOf('status = "ready";');
  const lastReadyIdx = src.indexOf('status = "ready";', firstReadyIdx + 1);
  const emptyCheckIdx = src.indexOf("const emptyChapters =");
  assert.ok(firstReadyIdx > -1 && lastReadyIdx > firstReadyIdx, "expected two status=\"ready\" assignment sites (rewrite-success branch and the clean no-issues branch)");
  assert.ok(emptyCheckIdx > lastReadyIdx, "the backstop must be evaluated after every branch that can set status to ready, not before");
});

test("an empty chapter's downgrade produces a real, specific, actionable warning naming the chapter — not a generic message", () => {
  const block = src.slice(src.indexOf("researchWarnings: emptyChapters.length"), src.indexOf("researchWarnings: emptyChapters.length") + 300);
  assert.match(block, /could not be narrated from the available evidence and needs your review/);
  assert.match(block, /\$\{c\.title\}/);
});
