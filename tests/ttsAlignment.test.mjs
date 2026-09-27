import test from "node:test";
import assert from "node:assert/strict";
import { alignmentToWords, attachWordTimingsToSegments, diagnosticWordSimilarity } from "../supabase/functions/_shared/ttsAlignment.ts";

// 2026-10-02 "narration-first / audio-first architecture" pass — real audit
// finding: Long Form has never had real TTS timing (WORDS_PER_MINUTE=150
// estimation everywhere); the actual, working ElevenLabs alignment code
// lives in thirty-days-voice-generate/cooking-voice-generate. This module
// extracts the pure, provider-agnostic conversion (alignmentToWords, ported
// verbatim) and adds the genuinely new piece Long Form needs: mapping a flat
// word timeline onto its own pre-authored, ordered narrationSegments.

function fakeAlignment(text, wordDurationSec = 0.3, gapSec = 0.08) {
  const characters = [];
  const starts = [];
  const ends = [];
  let t = 0;
  const words = text.split(" ");
  words.forEach((word, wi) => {
    for (const ch of word) {
      characters.push(ch);
      starts.push(t);
      const chDur = wordDurationSec / word.length;
      t += chDur;
      ends.push(t);
    }
    if (wi < words.length - 1) {
      characters.push(" ");
      starts.push(t);
      t += gapSec;
      ends.push(t);
    }
  });
  return { characters, character_start_times_seconds: starts, character_end_times_seconds: ends };
}

test("alignmentToWords converts character-level timing into word-level timing", () => {
  const alignment = fakeAlignment("you are lying on packed dirt");
  const words = alignmentToWords(alignment);
  assert.equal(words.length, 6);
  assert.equal(words[0].word, "you");
  assert.equal(words[5].word, "dirt");
  assert.ok(words[0].start < words[0].end);
  // words are in chronological order, each starting no earlier than the previous word's start
  for (let i = 1; i < words.length; i++) assert.ok(words[i].start >= words[i - 1].start);
});

test("alignmentToWords returns [] for missing/malformed alignment rather than throwing", () => {
  assert.deepEqual(alignmentToWords(null), []);
  assert.deepEqual(alignmentToWords(undefined), []);
  assert.deepEqual(alignmentToWords({}), []);
  assert.deepEqual(alignmentToWords({ characters: ["a", "b"], character_start_times_seconds: [0] }), []); // mismatched array lengths
});

test("attachWordTimingsToSegments maps a flat word timeline onto ordered narration segments", () => {
  const fullText = "You're lying on packed dirt with your back against a cold rock. Something moves in the grass behind you.";
  const alignment = fakeAlignment(fullText.replace(/[.,]/g, ""));
  const words = alignmentToWords(alignment);
  const segments = [
    { id: "seg1", text: "You're lying on packed dirt with your back against a cold rock." },
    { id: "seg2", text: "Something moves in the grass behind you." },
  ];
  const result = attachWordTimingsToSegments(segments, words);
  assert.equal(result.ok, true);
  assert.equal(result.segmentTimings.length, 2);
  assert.equal(result.segmentTimings[0].segmentId, "seg1");
  assert.equal(result.segmentTimings[1].segmentId, "seg2");
  // seg2 must start no earlier than seg1 ends (ordered, non-overlapping)
  assert.ok(result.segmentTimings[1].startSeconds >= result.segmentTimings[0].endSeconds);
  assert.equal(result.totalWordsExpected, result.totalWordsAligned);
});

test("attachWordTimingsToSegments reports a coverage mismatch honestly instead of guessing", () => {
  const alignment = fakeAlignment("you are lying on packed dirt");
  const words = alignmentToWords(alignment);
  // Segments claim MORE words than were actually aligned/synthesized.
  const segments = [{ id: "seg1", text: "you are lying on packed dirt with your back against a rock" }];
  const result = attachWordTimingsToSegments(segments, words);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "ALIGNMENT_RAN_OUT_OF_WORDS_AT_SEGMENT");
  assert.equal(result.firstMismatchSegmentId, "seg1");
});

test("attachWordTimingsToSegments flags a total-count mismatch when segments under-claim the aligned words", () => {
  const alignment = fakeAlignment("you are lying on packed dirt with your back against a rock");
  const words = alignmentToWords(alignment);
  const segments = [{ id: "seg1", text: "you are lying" }]; // far fewer words than the real audio
  const result = attachWordTimingsToSegments(segments, words);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "WORD_COUNT_MISMATCH_TOTAL");
});

test("attachWordTimingsToSegments skips empty segments without fabricating a zero-duration span", () => {
  const alignment = fakeAlignment("you are lying");
  const words = alignmentToWords(alignment);
  const segments = [{ id: "empty", text: "   " }, { id: "seg1", text: "you are lying" }];
  const result = attachWordTimingsToSegments(segments, words);
  assert.equal(result.ok, true);
  assert.equal(result.segmentTimings.length, 1);
  assert.equal(result.segmentTimings[0].segmentId, "seg1");
});

test("attachWordTimingsToSegments is tolerant of punctuation differences between segment text and synthesized text", () => {
  const alignment = fakeAlignment("nine thousand years before solon");
  const words = alignmentToWords(alignment);
  const segments = [{ id: "seg1", text: "nine thousand years before solon." }]; // trailing period, never in the audio stream
  const result = attachWordTimingsToSegments(segments, words);
  assert.equal(result.ok, true);
});

test("attachWordTimingsToSegments carries wordStartIndex/wordEndIndex and the actual per-segment words — the exact fields the Beat Director needs", () => {
  const fullText = "You are lying on packed dirt. Something moves in the grass.";
  const alignment = fakeAlignment(fullText.replace(/[.,]/g, ""));
  const words = alignmentToWords(alignment);
  const segments = [
    { id: "seg1", text: "You are lying on packed dirt." },
    { id: "seg2", text: "Something moves in the grass." },
  ];
  const result = attachWordTimingsToSegments(segments, words);
  assert.equal(result.ok, true);
  assert.equal(result.segmentTimings[0].wordStartIndex, 0);
  assert.equal(result.segmentTimings[0].wordEndIndex, 6);
  assert.equal(result.segmentTimings[0].words.length, 6);
  assert.equal(result.segmentTimings[0].words[0].word, "You");
  assert.equal(result.segmentTimings[1].wordStartIndex, 6);
  assert.equal(result.segmentTimings[1].wordEndIndex, 11);
  assert.equal(result.segmentTimings[1].words.length, 5);
  // Contiguous, non-overlapping word ranges across segments.
  assert.equal(result.segmentTimings[0].wordEndIndex, result.segmentTimings[1].wordStartIndex);
});

test("diagnosticWordSimilarity scores exact and divergent text correctly", () => {
  const alignment = fakeAlignment("you are lying on packed dirt");
  const words = alignmentToWords(alignment);
  assert.equal(diagnosticWordSimilarity("you are lying on packed dirt", words), 1);
  assert.ok(diagnosticWordSimilarity("completely different text entirely here", words) < 0.5);
});
