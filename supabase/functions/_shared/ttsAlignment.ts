// deno-lint-ignore-file no-explicit-any
// ttsAlignment.ts — 2026-10-02 "narration-first / audio-first architecture"
// pass, Section D/F.
//
// The real audit finding this exists to fix: Long Form has NEVER had real
// per-word TTS timing — every "startSeconds"/"endSeconds" field in the
// pipeline (script segments' estimatedSeconds, VisualBeat's
// estimatedStartSeconds/estimatedEndSeconds) is derived from a fixed
// WORDS_PER_MINUTE=150 heuristic, confirmed identically in three places
// (advance-long-form-script/index.ts, generate-long-form-story-plan/
// index.ts, _shared/visualShotPlanning.js). Meanwhile TWO OTHER Zyvo
// products (thirty-days-voice-generate, cooking-voice-generate) already
// call ElevenLabs' character-level forced-alignment endpoint and convert it
// to word timings — that conversion (alignmentToWords, ported verbatim
// below) is pure, provider-agnostic, and has zero dependency on either
// product's own data model. This module extracts it once so Long Form's new
// TTS stage never re-derives its own (possibly subtly different) version.
//
// The second function here, attachWordTimingsToSegments, is genuinely new —
// neither 30 Days nor Cooking Matic needed it, since they don't have a
// pre-existing, independently-authored list of narration segments to map
// timings onto. Long Form does (script_document.narrationSegments[], each
// with its own authored `text`) — this is the deterministic bridge from a
// flat ElevenLabs word timeline onto that already-segmented structure,
// modeled on the same "coverage must be provable, never assumed" principle
// this codebase already applies elsewhere (narrationVisualContract.ts's own
// segment-coverage assertions).

export type ElevenLabsAlignment = {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
};

export type AlignedWord = { word: string; start: number; end: number };

// Ported verbatim from thirty-days-voice-generate/index.ts:40-68 (and
// cooking-voice-generate's identical copy) — walks ElevenLabs' per-CHARACTER
// alignment and collapses it into per-WORD timing by splitting on
// whitespace. No product-specific assumption anywhere in this function.
export function alignmentToWords(alignment: ElevenLabsAlignment | null | undefined): AlignedWord[] {
  const characters = Array.isArray(alignment?.characters) ? alignment!.characters! : [];
  const starts = Array.isArray(alignment?.character_start_times_seconds) ? alignment!.character_start_times_seconds! : [];
  const ends = Array.isArray(alignment?.character_end_times_seconds) ? alignment!.character_end_times_seconds! : [];
  if (!characters.length || characters.length !== starts.length || characters.length !== ends.length) return [];

  const words: AlignedWord[] = [];
  let current: { word: string; start: number; end: number } | null = null;
  const flush = () => {
    if (current?.word.trim()) {
      words.push({
        word: current.word.trim(),
        start: Number(current.start.toFixed(3)),
        end: Number(Math.max(current.end, current.start + 0.02).toFixed(3)),
      });
    }
    current = null;
  };

  characters.forEach((character, index) => {
    if (/\s/.test(character)) { flush(); return; }
    if (!current) current = { word: "", start: Number(starts[index]) || 0, end: Number(ends[index]) || 0 };
    current.word += character;
    current.end = Number(ends[index]) || current.end;
  });
  flush();
  return words;
}

// Case/punctuation-insensitive comparison key — the ElevenLabs alignment
// tokenizes the LITERAL synthesized text (which may render "9,000" or a
// trailing period differently than how a segment's own authored text reads
// it), so exact string equality would false-positive on real, harmless
// transcription artifacts. Structural word COUNT is what actually proves
// coverage; per-word text is only used for an optional diagnostic.
function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}
function tokenize(text: string): string[] {
  return String(text ?? "").split(/\s+/).map((w) => w.trim()).filter(Boolean);
}

export type NarrationSegmentTiming = {
  segmentId: string;
  startSeconds: number;
  endSeconds: number;
  wordCount: number;
  // 2026-10-02 "real Long Form TTS" pass, Section 8 — the exact fields the
  // future Beat Director needs per segment: which slice of the flat word
  // timeline this segment owns (wordStartIndex inclusive, wordEndIndex
  // exclusive — a normal JS slice range) and the words themselves, so a
  // caller never has to re-slice the flat array itself.
  wordStartIndex: number;
  wordEndIndex: number;
  words: AlignedWord[];
};

export type AttachTimingsResult =
  | { ok: true; segmentTimings: NarrationSegmentTiming[]; totalWordsExpected: number; totalWordsAligned: number }
  | { ok: false; reason: string; totalWordsExpected: number; totalWordsAligned: number; firstMismatchSegmentId: string | null };

// The deterministic bridge from a flat ElevenLabs word timeline onto an
// ALREADY-authored, ordered list of narration segments (script_document.
// narrationSegments[], each with its own exact `text`). Requires the
// segments' concatenated text to be exactly what was sent to TTS — the same
// "joined text must equal the source exactly" invariant this codebase
// already enforces for beat/claim coverage elsewhere. Never silently
// mis-times a segment: if the segment word count and the aligned word count
// disagree, this returns ok:false with the exact segment where coverage
// broke down, rather than guessing.
export function attachWordTimingsToSegments(
  segments: { id: string; text: string }[],
  words: AlignedWord[],
): AttachTimingsResult {
  const totalWordsExpected = segments.reduce((sum, s) => sum + tokenize(s.text).length, 0);
  const totalWordsAligned = words.length;

  if (totalWordsExpected === 0) {
    return { ok: false, reason: "NO_SEGMENTS_OR_EMPTY_TEXT", totalWordsExpected, totalWordsAligned, firstMismatchSegmentId: segments[0]?.id ?? null };
  }
  if (totalWordsAligned === 0) {
    return { ok: false, reason: "NO_ALIGNED_WORDS", totalWordsExpected, totalWordsAligned, firstMismatchSegmentId: segments[0]?.id ?? null };
  }

  const segmentTimings: NarrationSegmentTiming[] = [];
  let cursor = 0;
  for (const segment of segments) {
    const segmentWordCount = tokenize(segment.text).length;
    if (segmentWordCount === 0) continue; // an empty/whitespace-only segment contributes no timing span, never a fabricated zero-duration one
    const slice = words.slice(cursor, cursor + segmentWordCount);
    if (slice.length < segmentWordCount) {
      return { ok: false, reason: `ALIGNMENT_RAN_OUT_OF_WORDS_AT_SEGMENT`, totalWordsExpected, totalWordsAligned, firstMismatchSegmentId: segment.id };
    }
    segmentTimings.push({
      segmentId: segment.id,
      startSeconds: slice[0].start,
      endSeconds: slice[slice.length - 1].end,
      wordCount: segmentWordCount,
      wordStartIndex: cursor,
      wordEndIndex: cursor + segmentWordCount,
      words: slice,
    });
    cursor += segmentWordCount;
  }

  if (cursor !== totalWordsAligned) {
    // Real, provable coverage mismatch (e.g. the audio was synthesized from
    // different text than these segments claim to represent) — reported
    // honestly rather than returning partial/wrong timings.
    return { ok: false, reason: "WORD_COUNT_MISMATCH_TOTAL", totalWordsExpected, totalWordsAligned, firstMismatchSegmentId: null };
  }

  return { ok: true, segmentTimings, totalWordsExpected, totalWordsAligned };
}

// Exposed for diagnostics/tests only — not used by attachWordTimingsToSegments
// itself (which only trusts word COUNT, per the comment above), but useful
// for a human/QA pass to spot-check that the words genuinely correspond.
export function diagnosticWordSimilarity(segmentText: string, alignedWords: AlignedWord[]): number {
  const expected = tokenize(segmentText).map(normalizeWord);
  const actual = alignedWords.map((w) => normalizeWord(w.word));
  if (!expected.length) return 1;
  let matches = 0;
  for (let i = 0; i < Math.min(expected.length, actual.length); i++) if (expected[i] === actual[i]) matches++;
  return matches / expected.length;
}
