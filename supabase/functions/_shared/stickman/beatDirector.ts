// deno-lint-ignore-file no-explicit-any
// stickman/beatDirector.ts — Phase 2a Beat Director (Stickman only).
//
// Turns a READY script into timed beats (~3-5 s each, split by MEANING), each
// with a visual contract the later pipeline (prompts, images, editing) builds
// on. Code owns the words and the clock; the model only chooses WHERE to cut
// (word-index ranges) and WHAT the viewer sees. The model never writes
// narration text — every beat's narrationText is copied from the word stream
// by index, so the beats always reassemble into the exact script.
//
// Everything here is pure except runBeatDirector's injected callModel, so the
// whole director is testable offline (unit tests + cassette replay).
import { eraOf, viewerEra, SENTENCE_END } from "./viewerEra.ts";

/* ============================ Word stream ============================ */

export type TimingSource = "real" | "synthetic";

export type StreamWord = {
  index: number;
  word: string;
  segmentId: string;
  startMs: number;
  endMs: number;
};

export type CutPoint = { afterWord: number; reasons: string[] };

// timingNote says why a supplied narration was NOT used (synthetic fallback).
export type WordStream = { words: StreamWord[]; timingSource: TimingSource; scriptText: string; cutPoints: CutPoint[]; timingNote?: string };

export const SYNTHETIC_WPM = 145;
const SENTENCE_PAUSE_MS = 380;
const CLAUSE_PAUSE_MS = 160;
const SEGMENT_PAUSE_MS = 250;

function tokenize(text: string): string[] {
  return (text ?? "").trim().split(/\s+/).filter(Boolean);
}

export function scriptTextOf(segments: { text: string }[]): string {
  return segments.map((s) => tokenize(s.text).join(" ")).filter(Boolean).join(" ");
}

// Deterministic "natural" pacing: 145 wpm on average, longer words take a
// little longer, and punctuation adds pauses. No randomness, so offline
// tests and replays are reproducible.
// wordsPerMinute: the selected voice's measured pace (src/lib/voicePace.ts);
// SYNTHETIC_WPM only when unknown.
export function syntheticTimings(segments: { id: string; text: string }[], wordsPerMinute: number = SYNTHETIC_WPM): StreamWord[] {
  const flat: { word: string; segmentId: string; lastInSegment: boolean }[] = [];
  for (const s of segments) {
    const toks = tokenize(s.text);
    toks.forEach((w, i) => flat.push({ word: w, segmentId: s.id, lastInSegment: i === toks.length - 1 }));
  }
  const letters = (w: string) => Math.max(1, w.replace(/[^A-Za-z0-9]/g, "").length);
  const avgLetters = flat.reduce((sum, f) => sum + letters(f.word), 0) / Math.max(1, flat.length);
  const baseMs = 60_000 / wordsPerMinute;
  let t = 0;
  return flat.map((f, index) => {
    const dur = Math.round(baseMs * (0.7 + 0.3 * (letters(f.word) / avgLetters)));
    const startMs = t;
    const endMs = t + dur;
    let pause = 0;
    if (/[.!?]["')\]]?$/.test(f.word)) pause += SENTENCE_PAUSE_MS;
    else if (/[,;:—-]["')\]]?$/.test(f.word)) pause += CLAUSE_PAUSE_MS;
    if (f.lastInSegment) pause += SEGMENT_PAUSE_MS;
    t = endMs + pause;
    return { index, word: f.word, segmentId: f.segmentId, startMs, endMs };
  });
}

// Real timings from a ready long_form_narration_audio_versions row:
// narration = [{segmentId, startSeconds, endSeconds, words:[{word,start,end}]}].
// When a segment's aligned word count matches our tokenization the word times
// are used directly; otherwise that segment falls back to proportional
// placement inside its real [start, end] window.
export function realTimings(segments: { id: string; text: string }[], narration: any[]): StreamWord[] | null {
  const bySegment = new Map<string, any>((narration ?? []).map((n: any) => [n.segmentId, n]));
  if (!segments.every((s) => bySegment.has(s.id))) return null;
  const out: StreamWord[] = [];
  for (const s of segments) {
    const toks = tokenize(s.text);
    const seg = bySegment.get(s.id);
    const aligned = Array.isArray(seg.words) && seg.words.length === toks.length;
    const segStart = Math.round(Number(seg.startSeconds) * 1000);
    const segEnd = Math.round(Number(seg.endSeconds) * 1000);
    const totalChars = toks.reduce((sum, w) => sum + w.length + 1, 0) || 1;
    let cursor = 0;
    toks.forEach((w, i) => {
      let startMs: number;
      let endMs: number;
      if (aligned) {
        startMs = Math.round(Number(seg.words[i].start) * 1000);
        endMs = Math.round(Number(seg.words[i].end) * 1000);
      } else {
        startMs = segStart + Math.round(((segEnd - segStart) * cursor) / totalChars);
        cursor += w.length + 1;
        endMs = segStart + Math.round(((segEnd - segStart) * cursor) / totalChars);
      }
      out.push({ index: out.length, word: w, segmentId: s.id, startMs, endMs });
    });
  }
  return out;
}

const CLAUSE_WORDS = new Set(["but", "so", "then", "because", "yet", "instead", "however", "still", "except", "unless", "until"]);
const CONTRAST_WORDS = new Set(["but", "yet", "however", "instead", "actually", "except", "unlike", "although", "though"]);
const NUMBER_WORDS = /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|percent|half|dozen)\b/i;
const SOURCE_CUES = /^(historians?|archaeologists?|scientists?|researchers?|study|studies|professor|according|records?|surveys?|data)$/i;

function bare(w: string) {
  return w.toLowerCase().replace(/^[^a-z0-9$]+|[^a-z0-9%]+$/g, "");
}

export function markCutPoints(words: StreamWord[]): CutPoint[] {
  const cuts: CutPoint[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i].word;
    const next = words[i + 1].word;
    const nb = bare(next);
    const reasons: string[] = [];
    if (/[.!?]["')\]]?$/.test(w)) reasons.push(/\?["')\]]?$/.test(w) ? "question" : "sentence_end");
    if (words[i].segmentId !== words[i + 1].segmentId) reasons.push("segment_break");
    if (CLAUSE_WORDS.has(nb) && /[,;:—-]$/.test(w)) reasons.push("clause");
    if (CONTRAST_WORDS.has(nb)) reasons.push("contrast");
    if (/\d/.test(next) || NUMBER_WORDS.test(nb)) reasons.push("number");
    if (SOURCE_CUES.test(nb) || (/^[A-Z][a-z]+/.test(next) && !/[.!?]["')\]]?$/.test(w) && i > 0 && /^[A-Z][a-z]+/.test(words[i + 2]?.word ?? ""))) reasons.push("named_source");
    if ((nb === "you" || nb === "your" || nb === "you're") && (/[.!?,;:—-]$/.test(w) || reasons.length)) reasons.push("you_pivot");
    if (reasons.length) cuts.push({ afterWord: i, reasons: [...new Set(reasons)] });
  }
  return cuts;
}

// Real word timings are the default whenever a ready narration covers the
// script; synthetic timings are only the fallback (recorded as timingSource,
// with timingNote when a narration was supplied but couldn't be used).
export function buildWordStream(segments: { id: string; text: string }[], narration?: any[] | null, wordsPerMinute?: number): WordStream {
  const real = narration?.length ? realTimings(segments, narration) : null;
  const words = real ?? syntheticTimings(segments, wordsPerMinute);
  const timingNote = narration?.length && !real ? "NARRATION_DOES_NOT_COVER_SCRIPT" : undefined;
  return { words, timingSource: real ? "real" : "synthetic", scriptText: scriptTextOf(segments), cutPoints: markCutPoints(words), ...(timingNote ? { timingNote } : {}) };
}

/* ============================ Bible index ============================ */

export type BibleIndex = {
  cast: { id: string; label: string; description: string }[];
  settings: { id: string; label: string }[];
  props: { id: string; label: string }[];
};

export function slugId(prefix: string, text: string, taken: Set<string>): string {
  const base = `${prefix}_${String(text).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "x"}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
  taken.add(id);
  return id;
}

// The IDs the director may reference. Cast/props carry their own ids in the
// bible; world.settingFamilies are plain strings, so their ids are derived
// deterministically (same bible -> same ids, every run).
export function buildBibleIndex(bible: any): BibleIndex {
  const cast: BibleIndex["cast"] = [];
  if (bible?.hero?.exists) cast.push({ id: "hero", label: bible.hero.semanticIdentity || "hero", description: bible.hero.canonicalAppearance || "" });
  for (const c of bible?.recurringCharacters ?? []) cast.push({ id: String(c.id), label: c.role || c.id, description: c.canonicalAppearance || "" });
  // Role archetypes (e.g. "viewer", "viking_warrior") are castable too.
  for (const a of bible?.roleArchetypes ?? []) if (!cast.some((c) => c.id === a.id)) cast.push({ id: String(a.id), label: a.role || a.id, description: a.canonicalAppearance || "" });
  const taken = new Set<string>();
  const settings = (bible?.world?.settingFamilies ?? []).map((s: string) => ({ id: slugId("setting", s, taken), label: s }));
  const props = (bible?.objectLanguage ?? []).map((o: any) => ({ id: String(o.id), label: o.canonicalDescription || o.id }));
  return { cast, settings, props };
}

/* ============================ Windows ============================ */

export type Window = { index: number; startWord: number; endWord: number };

// ~150-250 words per window, ending on a sentence end whenever possible.
export function planWindows(stream: WordStream, minWords = 150, maxWords = 250): Window[] {
  const sentenceEnds = new Set(stream.cutPoints.filter((c) => c.reasons.includes("sentence_end") || c.reasons.includes("question")).map((c) => c.afterWord));
  const anyCut = new Set(stream.cutPoints.map((c) => c.afterWord));
  const last = stream.words.length - 1;
  const windows: Window[] = [];
  let start = 0;
  while (start <= last) {
    if (last - start + 1 <= maxWords + minWords / 2) {
      windows.push({ index: windows.length, startWord: start, endWord: last });
      break;
    }
    let end = -1;
    for (let i = start + minWords - 1; i <= Math.min(last, start + maxWords - 1); i++) if (sentenceEnds.has(i)) end = i;
    if (end === -1) for (let i = start + maxWords - 1; i >= start + minWords - 1; i--) if (anyCut.has(i)) { end = i; break; }
    if (end === -1) end = Math.min(last, start + maxWords - 1);
    windows.push({ index: windows.length, startWord: start, endWord: end });
    start = end + 1;
  }
  return windows;
}

/* ============================ Clause chunks (code, no AI) ============================ */
// Phase 2a-fix — beats are built from code-made clause chunks, never raw
// words. Reference: the tutorial video had 1,451 words -> 164 beats, ~9
// words / ~3.7 s per beat, max ~15 words, sentences routinely split at
// clauses. Two paid runs where the model cut its own word ranges produced
// whole-sentence beats (16-25 words, 7-11.7 s); now the model can only
// group 1-3 consecutive chunks, and code auto-splits anything too long.

export type Chunk = { index: number; startWord: number; endWord: number; startMs: number; endMs: number; wordCount: number; text: string };

export const CHUNK_MAX_WORDS = 12;
export const CHUNK_MIN_SPLIT_WORDS = 3;
export const CHUNK_TARGET_MAX_MS = 5000;
const SPLIT_BEFORE = new Set(["and", "but", "so", "because", "which", "that", "when", "while", "then", "until", "after", "before"]);
const MONTHS = /^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?$/i;

const isSentenceEnd = (w: string) => /[.!?]["'”’)\]]?$/.test(w);
const endsWithPause = (w: string) => /[,;:]["'”’)\]]?$/.test(w) || /[—–]$/.test(w) || w === "—" || w === "–" || w === "-";
const isNumberish = (w: string) => /\d/.test(w) || NUMBER_WORDS.test(bare(w));
const isCapitalized = (w: string) => /^["'“‘(]?[A-Z][a-z]/.test(w);

// True if cutting between words i and i+1 would break a number, a date, a
// proper name, or a quoted title.
function isProtectedBoundary(words: StreamWord[], i: number, sentStart: number, quoteDepthAfter: number[]): boolean {
  const a = words[i].word;
  const b = words[i + 1].word;
  if (quoteDepthAfter[i] > 0) return true;
  if (isNumberish(a) && isNumberish(b)) return true;
  if ((MONTHS.test(bare(a)) || /^\d{1,2}(st|nd|rd|th)?,?$/.test(a)) && isNumberish(b)) return true;
  if (i > sentStart && isCapitalized(a) && isCapitalized(b)) return true;
  return false;
}

function naturalBreaks(words: StreamWord[], from: number, to: number, quoteDepthAfter: number[], sentStart: number): number[] {
  const out: number[] = [];
  for (let i = from; i < to; i++) {
    if (isProtectedBoundary(words, i, sentStart, quoteDepthAfter)) continue;
    if (endsWithPause(words[i].word) || SPLIT_BEFORE.has(bare(words[i + 1].word))) out.push(i);
  }
  return out;
}

// Splits [from, to] into pieces of <= CHUNK_MAX_WORDS, preferring the natural
// break nearest the middle, else the midpoint word boundary.
function capPiece(words: StreamWord[], from: number, to: number, quoteDepthAfter: number[], sentStart: number): [number, number][] {
  const n = to - from + 1;
  if (n <= CHUNK_MAX_WORDS) return [[from, to]];
  const mid = from + Math.floor(n / 2) - 1;
  const nearest = (xs: number[]) => xs.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best));
  const candidates = naturalBreaks(words, from, to, quoteDepthAfter, sentStart).filter((i) => i - from + 1 >= 2 && to - i >= 2);
  // No natural break: the word boundary nearest the midpoint that doesn't cut
  // a number, date, name or quoted title (plain midpoint only as last resort).
  const unprotected = [];
  for (let i = from + 1; i < to - 1; i++) if (!isProtectedBoundary(words, i, sentStart, quoteDepthAfter)) unprotected.push(i);
  const cut = candidates.length ? nearest(candidates) : unprotected.length ? nearest(unprotected) : mid;
  return [...capPiece(words, from, cut, quoteDepthAfter, sentStart), ...capPiece(words, cut + 1, to, quoteDepthAfter, sentStart)];
}

function pieceMs(words: StreamWord[], from: number, to: number) {
  const endMs = to + 1 < words.length ? words[to + 1].startMs : words[to].endMs;
  return endMs - words[from].startMs;
}

// Real timings (Phase 2c): chunks are cut by MEASURED duration (<= 5 s), not
// word count. Long clauses may also break before these words — never inside
// a number, date, name, quoted title or a numeric range ("793 to 1066").
const EXTRA_SPLIT_BEFORE = new Set(["from", "roughly", "with", "without", "into", "across", "during", "after", "before", "about", "around"]);
const RANGE_WORDS = /^(to|and|or|through)$/i;
function insideRange(words: StreamWord[], i: number) {
  const a = words[i].word;
  const b = words[i + 1].word;
  return (isNumberish(a) && RANGE_WORDS.test(bare(b)) && isNumberish(words[i + 2]?.word ?? "")) || (RANGE_WORDS.test(bare(a)) && isNumberish(b) && isNumberish(words[i - 1]?.word ?? ""));
}
function extraBreakBefore(words: StreamWord[], i: number) {
  const next = bare(words[i + 1].word);
  return EXTRA_SPLIT_BEFORE.has(next) || (next === "in" && /^(his|her|their)$/.test(bare(words[i + 2]?.word ?? "")));
}
function capByTime(words: StreamWord[], from: number, to: number, quoteDepthAfter: number[], sentStart: number): [number, number][] {
  const ms = pieceMs(words, from, to);
  if (ms <= CHUNK_TARGET_MAX_MS || to - from + 1 < 4) return [[from, to]];
  const tMid = words[from].startMs + ms / 2;
  const legal = (i: number) => i - from + 1 >= 2 && to - i >= 2 && !isProtectedBoundary(words, i, sentStart, quoteDepthAfter) && !insideRange(words, i);
  const byTime = (xs: number[]) => xs.reduce((best, i) => (Math.abs(words[i + 1].startMs - tMid) < Math.abs(words[best + 1].startMs - tMid) ? i : best));
  const breaks: number[] = [];
  const any: number[] = [];
  for (let i = from; i < to; i++) {
    if (!legal(i)) continue;
    any.push(i);
    if (endsWithPause(words[i].word) || SPLIT_BEFORE.has(bare(words[i + 1].word)) || extraBreakBefore(words, i)) breaks.push(i);
  }
  // A natural/extra break when there is one; a plain word boundary only when
  // the piece couldn't even be a legal beat (> 6.5 s).
  const cut = breaks.length ? byTime(breaks) : ms > MAX_BEAT_MS && any.length ? byTime(any) : null;
  if (cut == null) return [[from, to]];
  return [...capByTime(words, from, cut, quoteDepthAfter, sentStart), ...capByTime(words, cut + 1, to, quoteDepthAfter, sentStart)];
}

export function buildChunks(stream: WordStream, fromWord: number, toWord: number, firstIndex = 0): Chunk[] {
  const words = stream.words;
  // Quote depth after each word (inside a quoted title -> never split).
  const quoteDepthAfter: number[] = [];
  let depth = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i].word;
    const opens = (w.match(/^["“]/) ? 1 : 0);
    const closes = (w.match(/["”][.,;:!?)\]]*$/) && !(opens && w.length === 1) ? 1 : 0);
    depth = Math.max(0, depth + opens - closes);
    quoteDepthAfter.push(depth);
  }

  // Real timings: cap by measured duration; synthetic: by word count (unchanged,
  // so recorded synthetic-timing runs keep their chunk indices).
  const real = stream.timingSource === "real";
  const cap = real ? capByTime : capPiece;
  const pieces: [number, number][] = [];
  let sentStart = fromWord;
  for (let i = fromWord; i <= toWord; i++) {
    const lastOfSentence = i === toWord || isSentenceEnd(words[i].word) || words[i].segmentId !== words[i + 1]?.segmentId;
    if (!lastOfSentence) continue;
    // Clause splits inside this sentence: both resulting sides >= 3 words.
    let pieceStart = sentStart;
    for (const b of naturalBreaks(words, sentStart, i, quoteDepthAfter, sentStart)) {
      if (real && insideRange(words, b)) continue;
      if (b - pieceStart + 1 >= CHUNK_MIN_SPLIT_WORDS && i - b >= CHUNK_MIN_SPLIT_WORDS) {
        pieces.push(...cap(words, pieceStart, b, quoteDepthAfter, sentStart));
        pieceStart = b + 1;
      }
    }
    pieces.push(...cap(words, pieceStart, i, quoteDepthAfter, sentStart));
    sentStart = i + 1;
  }

  // Synthetic only — over ~5 s (slow stretch with pauses): split once more at
  // the midpoint. Real timings were already capped by duration above.
  const sized: [number, number][] = [];
  for (const [a, b] of pieces) {
    if (!real && pieceMs(words, a, b) > CHUNK_TARGET_MAX_MS + 500 && b - a + 1 >= 6) {
      const mid = a + Math.floor((b - a + 1) / 2) - 1;
      sized.push([a, mid], [mid + 1, b]);
    } else sized.push([a, b]);
  }

  // Merge a piece under 1.8 s into a neighbour in the same sentence when the
  // result stays <= 12 words (keeps 1-chunk beats from being too short).
  const merged: [number, number][] = [];
  const sameSentence = (a: [number, number], b: [number, number]) => !isSentenceEnd(words[a[1]].word) && words[a[1]].segmentId === words[b[0]].segmentId;
  // Merged size limit: 12 words (synthetic) or a legal beat's 6.5 s (real).
  const fitsMerged = (a: number, b: number) => (real ? pieceMs(words, a, b) <= MAX_BEAT_MS : b - a + 1 <= CHUNK_MAX_WORDS);
  for (let k = 0; k < sized.length; k++) {
    const cur = sized[k];
    if (pieceMs(words, cur[0], cur[1]) < MIN_BEAT_MS) {
      const next = sized[k + 1];
      if (next && sameSentence(cur, next) && fitsMerged(cur[0], next[1])) {
        sized[k + 1] = [cur[0], next[1]];
        continue;
      }
      const prev = merged[merged.length - 1];
      if (prev && sameSentence(prev, cur) && fitsMerged(prev[0], cur[1])) {
        merged[merged.length - 1] = [prev[0], cur[1]];
        continue;
      }
    }
    merged.push(cur);
  }

  return merged.map(([a, b], k) => ({
    index: firstIndex + k,
    startWord: a,
    endWord: b,
    startMs: words[a].startMs,
    endMs: b + 1 < words.length ? words[b + 1].startMs : words[b].endMs,
    wordCount: b - a + 1,
    text: words.slice(a, b + 1).map((w) => w.word).join(" "),
  }));
}

export type ChunkedWindow = Window & { chunks: Chunk[] };

export function chunkWindows(stream: WordStream, windows: Window[]): ChunkedWindow[] {
  let next = 0;
  return windows.map((w) => {
    const chunks = buildChunks(stream, w.startWord, w.endWord, next);
    next += chunks.length;
    return { ...w, chunks };
  });
}

/* ============================ Contract ============================ */

export const TREATMENTS = ["STORY_SCENE", "REACTION", "POV", "ESTABLISHING", "OBJECT_DETAIL", "SYMBOLIC", "COMPARISON", "SPLIT", "MAP", "TIMELINE_BAR", "SCALE", "STAT_CARD", "ICON_ROW", "CROWD", "CALLBACK"] as const;
export const CAMERAS = ["EXTREME_WIDE", "WIDE", "MEDIUM", "CLOSE_UP", "EXTREME_CLOSE_UP", "OVERHEAD", "POV", "OVER_THE_SHOULDER", "LOW_ANGLE", "FLAT_GRAPHIC"] as const;
export const PRESENCE = ["full", "hands", "back", "tiny"] as const;
export const POSITIONS = ["left", "right", "center", "foreground", "background"] as const;
export const TEXT_MODES = ["NO_TEXT", "SHORT_TEXT", "PROGRAMMATIC"] as const;
export const MOTION_WEIGHTS = ["still", "light", "medium", "strong"] as const;

// Compact WIRE format (the model's output) — short keys and flattened
// camera/framing/motion, expanded to the full beat contract by normalizeBeat.
// Output tokens are the director's main cost: the long-key format ran ~160
// tokens/beat; this targets ~110. normalizeBeat also still accepts the long
// format (recorded runs, fixtures).
export function buildBeatSchema(index: BibleIndex) {
  const enumOr = (ids: string[]) => (ids.length ? ids : ["__none__"]);
  return {
    type: "object",
    additionalProperties: false,
    required: ["b"],
    properties: {
      b: {
        type: "array",
        description: "The beats, in order.",
        items: {
          type: "object",
          additionalProperties: false,
          // No motion on the wire: code writes a default per treatment
          // (defaultMotion); a later optional step writes real motion for the hook.
          required: ["s", "e", "v", "t", "c", "f"],
          properties: {
            s: { type: "integer", description: "startChunk (C-number)." },
            e: { type: "integer", description: "endChunk (inclusive). 1-3 consecutive chunks." },
            v: { type: "string", description: "visualConcept: ONE still image, a single frozen moment (max ~12 words)." },
            t: { type: "string", enum: [...TREATMENTS], description: "treatment" },
            c: { type: "string", enum: [...CAMERAS], description: "composition.camera" },
            f: { type: "string", description: "composition.framing, 2-4 words." },
            cast: {
              type: "array",
              ...(index.cast.length ? {} : { maxItems: 0 }),
              description: index.cast.length ? "subjects on screen; omit if none." : "This video has NO cast: omit.",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "a"],
                properties: {
                  id: { type: "string", enum: enumOr(index.cast.map((c) => c.id)), description: "castId" },
                  a: { type: "string", description: "action + expression, max 4 words" },
                  p: { type: "string", enum: [...PRESENCE], description: "presence; omit for full" },
                  pos: { type: "string", enum: [...POSITIONS], description: "where in the frame, when 2+ people; omit otherwise" },
                  wear: { type: "array", items: { type: "string", enum: enumOr(index.props.map((p) => p.id)) }, description: "props this person WEARS in this beat (e.g. a helmet); omit if none" },
                  hold: { type: "array", items: { type: "string", enum: enumOr(index.props.map((p) => p.id)) }, description: "props this person HOLDS in this beat; omit if none" },
                },
              },
            },
            set: { type: ["string", "null"], enum: [...enumOr(index.settings.map((_, i) => settingAlias(i))), null], description: "setting (S-number); omit for abstract graphics." },
            sv: { type: "string", description: "settingVariant; omit if none." },
            props: { type: "array", items: { type: "string", enum: enumOr(index.props.map((p) => p.id)) }, description: "propIds; omit if none." },
            txt: {
              type: "object",
              additionalProperties: false,
              required: ["m", "t"],
              description: "textIntent; omit for NO_TEXT.",
              properties: { m: { type: "string", enum: [...TEXT_MODES] }, t: { type: ["string", "null"], description: "exact on-screen text (<= 5 words) for SHORT_TEXT; what to render for PROGRAMMATIC." } },
            },
            motif: {
              type: "string",
              enum: ["plant", "payoff"],
              description: "Only on the callback's plant / payoff beat; omit otherwise.",
            },
            hold: { type: "string", description: "HOLD reason (beat may run to 9 s); omit otherwise." },
            punch: { type: "string", description: "PUNCH reason (beat may be under 1.8 s); omit otherwise." },
          },
        },
      },
    },
  };
}

export const BEAT_DIRECTOR_INSTRUCTIONS = `You are Zyvo's Beat Director for 2D stickman-doodle explainer videos. You receive the finished narration already split by code into CLAUSE CHUNKS (C-numbers, each with its duration), the video's Production Bible (the only cast, settings and props that exist, with ids), the callback plan, and a short summary of the beats already directed. You group the chunks of one window into BEATS: small scenes of about 3-4 seconds, each one visual idea.

You never write or change narration. A beat is a range of consecutive chunks: s..e (inclusive), 1-3 chunks. Cover the window exactly: the first beat starts at the window's first chunk, each next beat starts at the previous e + 1, the last beat ends at the window's last chunk.

SIZE — most chunks are 2.5-4.5 s, so MOST BEATS ARE ONE CHUNK. Pair two chunks only when the chunk line says "pairs to" a total of 6 s or less AND splitting would break one visual idea; 3 chunks only if all are tiny. Reference: a good video of this kind averages ~9 words and ~3.7 s per beat, never more than ~15 words. A beat must stay at or under 6.5 s; HOLD (a reason in "hold") may run to 9 s, about once a minute at most. Longer beats are split by code — don't rely on it. HOOK: in the first 30 seconds every beat is exactly ONE chunk (about 2.5-3.5 s each; code splits longer ones) — chunks there carry no "pairs to" note.

WHERE TO CUT — cut on MEANING: a new claim, a change of action, a question, a reveal, a statistic, a comparison, a callback, a jump in time or place.

ONE FROZEN MOMENT PER BEAT — v (visualConcept) describes ONE still image: a single frozen moment a stickman illustrator draws as one picture. No transformations, sequences, sounds or "then" — never "morphs", "turns into", "becomes", "rewrites", "spreads", "merges", "swings open", "strides", "flies", "grows", "fades", "appears", "moves", "travels", "rushes", "whistles", "you hear". All movement goes in motionIntent, which code adds later — never describe movement. Example: not "the silhouette morphs across a painting, a poster and a costume" but "three frames side by side: a painting, a movie poster and a party costume, each showing the same horned figure".

GROUNDED AND DRAWABLE — v names WHO or WHAT is visible, their action or pose, and WHERE. When the line names concrete things (flags, beer labels, football helmets, a date, a place, a person), SHOW those things — every item of a list — "on flags, beer labels, football helmets" is a flag, a beer bottle label and a football helmet, each with horns. Never an abstract restatement: no picture built on "history", "memory", "culture", "belief", "idea" or "the image in your head" — draw the concrete thing that stands for it (a history book, a museum label, a person imagining a horned helmet in a thought bubble).

WHAT THE VIEWER SEES — v is what makes THIS exact line land. Use visual rhetoric when it fits:
- threat: POV of the danger approaching the subject;
- negation or myth: the thing crossed out;
- safety vs danger: a small safe zone against a looming threat;
- a tiny share of something huge: a long bar with a tiny highlighted sliver;
- huge numbers: a crowd receding to the horizon;
- past vs present: a mirrored SPLIT;
- callbacks: re-use the EXACT composition, camera and subjects of the planted beat (treatment CALLBACK).

VARIETY — adjacent beats must differ in treatment, camera+framing, subjects or setting (unless HOLD or CALLBACK). Never more than 2 beats in a row on the same primary subject or object: vary the viewpoint across a run (the charger, then the enemy's view of the charger, then an enemy's reaction) instead of repeated close-ups of the same thing. And the same primary subject at most 3 times in any 8 consecutive beats.

PEOPLE AND BALANCE — at least 55% of beats show a cast member (hands, back or tiny count). SYMBOLIC at most 15% of beats, OBJECT_DETAIL at most 20%; an object beat should often include a character's hands holding it or a face reacting to it.

CAST — use ONLY the ids listed (never a placeholder). "you" lines use the viewer avatar whose era/context matches the line: the period avatar (e.g. viewer_viking) in the battle, viewer_modern for every present-day line (lunchbox, mascot, costume, museum, "next time you see…", "today"; chunk lines marked (present day)). The wrong era is a validation issue. Every line spoken to the viewer ("you", "your head") shows that viewer avatar (hands, back or tiny count). A CROWD beat shows a group of archetype people, never the viewer alone. Generic people use their archetype ids. A prop someone wears or holds in the beat goes in that person's wear/hold (e.g. the viewer wearing the horned helmet), not in props; with 2+ people give each a pos. Omit cast for beats with nobody on screen; omit set for abstract graphics.

TEXT — omit txt for most beats (NO_TEXT). SHORT_TEXT is exact on-screen text of at most 5 words (a year, a number, a key term), at most about 4 per minute. PROGRAMMATIC is for charts, bars and stat cards the editor renders. Never ask the image to render sentences. NO UNDECLARED TEXT: if v implies readable text (reads, labeled, says, a sign, marquee, caption, title, banner, headline, words, something crossed out, a question mark), declare txt SHORT_TEXT with the exact string — or describe the picture without text.


MOTIF — the callback's planted beat gets motif "plant"; its payoff motif "payoff" and treatment CALLBACK.

BE TERSE — every string a few words; v one sentence of at most ~12 words; settings by S-number. Omit every optional field you don't need. Return "b" as a JSON array (never a string).`;

export function directorSystemPrompt(index: BibleIndex, bible: any, callback: { key: string | null; plantSegmentId: string | null; payoffSegmentId: string | null }) {
  const brief = {
    visualPremise: bible?.visualPremise ?? "",
    visualTone: bible?.visualTone ?? "",
    cast: index.cast.map((c) => ({ id: c.id, role: c.label })),
    settings: index.settings.map((s, i) => ({ id: settingAlias(i), label: s.label })),
    props: index.props,
    graphicLanguage: bible?.graphicLanguage ? { comparisonLayouts: bible.graphicLanguage.comparisonLayouts, timelineConventions: bible.graphicLanguage.timelineConventions, symbolicMetaphorLanguage: bible.graphicLanguage.symbolicMetaphorLanguage } : {},
    factualVisualConstraints: bible?.factualVisualConstraints ?? [],
  };
  return [
    BEAT_DIRECTOR_INSTRUCTIONS,
    "",
    "PRODUCTION BIBLE INDEX (the only ids that exist):",
    JSON.stringify(brief),
    "",
    `CALLBACK PLAN: planted detail "${callback.key ?? "none"}" — plant in segment ${callback.plantSegmentId ?? "none"}, payoff in segment ${callback.payoffSegmentId ?? "none"}.`,
  ].join("\n");
}

// Each chunk line shows its start (from the window start), its length, its
// word count, and — when pairing with the next chunk would still fit — the
// pair's total, so the model can see which groupings are legal.
function chunkLines(stream: WordStream, chunks: Chunk[], t0: number) {
  let seg = "";
  const lines: string[] = [];
  chunks.forEach((c, k) => {
    const s = stream.words[c.startWord].segmentId;
    if (s !== seg) {
      lines.push(`(segment ${s})`);
      seg = s;
    }
    const next = chunks[k + 1];
    const pair = next ? (next.endMs - c.startMs) / 1000 : null;
    const pairNote = pair != null && pair <= 6 && c.startMs >= HOOK_WINDOW_MS ? `, pairs to ${pair.toFixed(1)}s` : "";
    const era = lineEra(stream, c.startWord, c.endWord) === "modern" ? " (present day)" : "";
    lines.push(`C${c.index} [${((c.startMs - t0) / 1000).toFixed(1)}s, ${((c.endMs - c.startMs) / 1000).toFixed(1)}s long, ${c.wordCount}w${pairNote}] ${c.text}${era}`);
  });
  return lines.join("\n");
}

export function windowUserPrompt(stream: WordStream, win: ChunkedWindow, previous: any[], repairNotes?: string[]) {
  const first = win.chunks[0];
  const last = win.chunks[win.chunks.length - 1];
  const prev = previous.slice(-5).map((b) => `#${b.sequence} ${b.treatment}/${b.composition?.camera} [${(b.subjects ?? []).map((s: any) => s.castId).join(",") || "no cast"}] ${b.settingId ?? "no setting"} — ${b.userSummary}`);
  return [
    `WINDOW ${win.index + 1}: chunks C${first.index}..C${last.index} (${(first.startMs / 1000).toFixed(1)}s-${(last.endMs / 1000).toFixed(1)}s of the video). Cover EXACTLY these chunks. Times are from the window start.`,
    "",
    prev.length ? `PREVIOUS BEATS (most recent last — don't repeat the last one's treatment/camera/subject/setting):\n${prev.join("\n")}` : "PREVIOUS BEATS: none — this is the opening (the hook).",
    "",
    "CHUNKS:",
    chunkLines(stream, win.chunks, first.startMs),
    ...(repairNotes?.length ? ["", "YOUR PREVIOUS ATTEMPT FOR THIS WINDOW FAILED VALIDATION — FIX EXACTLY THESE:", ...repairNotes.map((n) => `- ${n}`)] : []),
  ].join("\n");
}

// One batched call per window for (a) beats code split off a too-long beat
// and (b) beats whose concept isn't a single still image.
export function fillUserPrompt(stream: WordStream, win: ChunkedWindow, beats: any[], needFill: number[], _chunkById?: Map<number, Chunk>) {
  const describe = (b: any, i: number) => {
    const text = stream.words.slice(b.startWord, b.endWord + 1).map((w) => w.word).join(" ");
    const tag = needFill.includes(i) ? "NEEDS CONTRACT" : "context";
    const why = !needFill.includes(i) ? "" : b.fixReason ? ` (rewrite: ${b.fixReason})` : " (split from a longer beat)";
    const cast = (b.avoidSubject ? [b.avoidSubject] : (b.subjects ?? []).map((x: any) => x.castId)).join(",") || "no cast";
    const idea = b.visualConcept ? ` — ${b.treatment}/${b.composition?.camera} [${cast}]: ${b.visualConcept}` : ` — original idea: ${b.parentConcept}`;
    return `${tag} C${b.startChunk}..C${b.endChunk} "${text}"${why}${idea}`;
  };
  const lines = beats.map((b, i) => ({ b, i })).filter(({ i }) => needFill.some((n) => Math.abs(n - i) <= 1)).map(({ b, i }) => describe(b, i));
  return [
    `WINDOW ${win.index + 1}: write a fresh contract for EACH beat marked NEEDS CONTRACT, using exactly its chunk range. Split-off beats: a different composition, framing or moment from their neighbours — never duplicate the original beat's image idea; show the next moment instead. Rewrites: keep the idea but make v ONE frozen still image (no transformations, sequences, sounds or "then"; never describe movement) and fix exactly what the rewrite note says. Don't put the same primary subject in 3 beats in a row.`,
    "",
    lines.join("\n"),
    "",
    `Return "b" containing ONLY the ${needFill.length} NEEDS CONTRACT beat(s), in order.`,
  ].join("\n");
}

/* ============================ Normalisation ============================ */

export const WORST_CALL_USD = 0.1;

// Tool-use sometimes returns a large array JSON-encoded as a string (seen on
// the first paid run's repair call — and that string wasn't valid JSON).
export function parseBeatsOutput(input: any): { beats: any[]; error: string | null } {
  const b = input?.b ?? input?.beats;
  if (Array.isArray(b)) return { beats: b, error: null };
  if (typeof b === "string") {
    try {
      const parsed = JSON.parse(b);
      if (Array.isArray(parsed)) return { beats: parsed, error: null };
    } catch { /* fall through */ }
    return { beats: [], error: '"b" came back as a string that is not a valid JSON array. Return "b" as a real JSON array of beat objects, and keep every field short.' };
  }
  return { beats: [], error: 'No "b" array was returned. Return "b" as a JSON array covering the whole window.' };
}

// The UI summary is derived from the concept (saves output tokens).
function summaryOf(v: unknown) {
  const words = String(v ?? "").replace(/[.;:,]+$/, "").split(/\s+/).filter(Boolean);
  return words.slice(0, 8).join(" ") + (words.length > 8 ? "…" : "");
}

export const settingAlias = (i: number) => `S${i + 1}`;
function settingFromWire(set: any, index?: BibleIndex) {
  const m = typeof set === "string" ? set.match(/^S(\d+)$/) : null;
  return m && index ? index.settings[Number(m[1]) - 1]?.id ?? set : set;
}

// Compact wire beat -> full contract (long-format input passes through).
export function expandBeat(b: any, index?: BibleIndex) {
  if (b.startChunk != null || b.s == null) return b;
  // Recorded runs before motion was dropped still carry m/w.
  const [mc, ms, me] = String(b.m ?? "").split("|").map((x: string) => x.trim());
  const reason = b.hold || b.punch || null;
  return {
    startChunk: b.s,
    endChunk: b.e,
    visualConcept: b.v,
    userSummary: b.u ?? summaryOf(b.v),
    treatment: b.t,
    composition: { camera: b.c, framing: b.f ?? "" },
    motionIntent: b.m ? { camera: mc ?? "", subject: ms ?? "", environment: me ?? "", weight: b.w ?? "light" } : undefined,
    subjects: (b.cast ?? []).map((s: any) => ({ castId: s.id, presence: s.p ?? "full", action: s.a ?? "", expression: s.x ?? "", ...(s.pos ? { position: s.pos } : {}), ...(s.wear?.length ? { wearing: s.wear } : {}), ...(s.hold?.length ? { holding: s.hold } : {}) })),
    settingId: settingFromWire(b.set, index),
    settingVariant: b.sv,
    propIds: b.props,
    textIntent: b.txt ? { mode: b.txt.m, text: b.txt.t ?? null } : undefined,
    motif: b.motif ? { role: b.motif, id: "callback" } : undefined,
    flags: { punch: !!b.punch, hold: !!b.hold, reason },
  };
}

// Defaults for omitted optional fields; placeholder ids are never real.
export function normalizeBeat(raw: any, index?: BibleIndex) {
  const b = expandBeat(raw, index);
  return {
    ...b,
    subjects: (b.subjects ?? []).filter((s: any) => s?.castId && s.castId !== "__none__"),
    settingId: b.settingId === "__none__" || b.settingId === "" || b.settingId === undefined ? null : b.settingId,
    settingVariant: b.settingVariant ?? "",
    propIds: (b.propIds ?? []).filter((p: any) => p && p !== "__none__"),
    textIntent: b.textIntent?.mode ? b.textIntent : { mode: "NO_TEXT", text: null },
    motif: b.motif?.role ? b.motif : { role: "none", id: null },
    motionIntent: b.motionIntent?.camera != null ? b.motionIntent : defaultMotion(b.treatment),
    flags: { punch: !!b.flags?.punch, hold: !!b.flags?.hold, reason: b.flags?.reason ?? null },
  };
}

// Code-written motion per treatment (the model no longer writes motion).
// `source: "default"` marks it for the later optional hook-motion step;
// CALLBACK beats copy the plant's motion at assembly (copyPlantMotion).
const MOTION_BY_TREATMENT: Record<string, [string, string, string, string]> = {
  STAT_CARD: ["hold", "none", "none", "still"],
  TIMELINE_BAR: ["hold", "bar fills", "none", "still"],
  ICON_ROW: ["hold", "icons settle", "none", "still"],
  SCALE: ["slow pull-back", "none", "none", "light"],
  COMPARISON: ["hold", "none", "none", "still"],
  SPLIT: ["hold", "none", "none", "still"],
  POV: ["slow push-in", "none", "none", "medium"],
  ESTABLISHING: ["slow pan", "none", "ambient drift", "light"],
  MAP: ["slow pan", "none", "none", "light"],
  CROWD: ["slow pan", "subtle sway", "none", "light"],
  REACTION: ["subtle push-in", "small head move", "none", "light"],
  STORY_SCENE: ["slow push-in", "subtle action", "ambient drift", "light"],
  OBJECT_DETAIL: ["slow push-in", "none", "none", "light"],
  SYMBOLIC: ["subtle push-in", "none", "none", "light"],
  CALLBACK: ["hold", "none", "none", "still"],
};
export function defaultMotion(treatment: string) {
  const [camera, subject, environment, weight] = MOTION_BY_TREATMENT[treatment] ?? ["hold", "none", "none", "still"];
  return { camera, subject, environment, weight, source: "default" };
}
export function copyPlantMotion(beats: any[]) {
  const plant = beats.find((b) => b.motif?.role === "plant");
  if (!plant) return;
  for (const b of beats) if (b.treatment === "CALLBACK" && b.motionIntent?.source === "default") b.motionIntent = { ...plant.motionIntent, source: "plant" };
}

// WARN (and a cheap fix via the batched fill call): a concept that isn't a
// single frozen image — transformations, sequences or sound can't be drawn.
// (run 5 slipped past with rewrites / spreads / merge / swings open / strides.)
const NOT_STILL = /\b(morph(s|ed|ing)?|transform(s|ed|ing)?|turns? into|becom(e|es|ing)|then|sequence|whistl\w*|sounds?|hears?|echo(es|ing)?|rewrit(e|es|ing)|spread(s|ing)|merg(e|es|ing)|swings? open|strid(e|es|ing)|walks? through|fl(ies|ying)|grow(s|ing)|shrink(s|ing)?|fad(es|ing)|appear(s|ing)|disappear(s|ing)?|mov(es|ing)|travel(s|ling|ing)|rush(es|ing)|erupts? into)\b/i;
export function conceptNotStill(concept: string): string | null {
  const m = String(concept ?? "").match(NOT_STILL);
  return m ? m[0] : null;
}

// Readable text the image would have to render. Declared text (SHORT_TEXT, or
// PROGRAMMATIC which the editor renders) is fine; undeclared text is not.
export const TEXT_IMPLIED = /\b(reads?|reading|labell?ed|says|saying|signs?|signposts?|marquee|captions?|titled?|banners?|headlines?|words?|lettering|written|crossed[- ]out)\b/i;
// (Phase 4a: a lone "?" / "!" drawn over a head is a symbol, not text.)
// Abstract nouns a picture can't show on their own.
const ABSTRACT = /\b(histor(y|ies)|memor(y|ies)|cultures?|beliefs?|ideas?|image in (your|our|their|the viewer's) heads?|minds?|truth|legacy|concepts?|perceptions?|imagination)\b/i;

export function sentenceAround(stream: WordStream, startWord: number, endWord: number) {
  let a = startWord;
  while (a > 0 && !SENTENCE_END.test(stream.words[a - 1].word)) a--;
  let z = endWord;
  while (z < stream.words.length - 1 && !SENTENCE_END.test(stream.words[z].word)) z++;
  return stream.words.slice(a, z + 1).map((w) => w.word).join(" ");
}
export const lineEra = (stream: WordStream, startWord: number, endWord: number) => eraOf(sentenceAround(stream, startWord, endWord));
export const beatNarration = (stream: WordStream, b: any) => (Number.isInteger(b.startWord) ? stream.words.slice(b.startWord, b.endWord + 1).map((w) => w.word).join(" ") : "");

// Names and numbers the line mentions (capitalised mid-sentence words, dates).
export function namedThings(narration: string): string[] {
  const out: string[] = [];
  const words = narration.split(/\s+/).filter(Boolean);
  words.forEach((w, i) => {
    const clean = w.replace(/^[^\w]+|[^\w]+$/g, "").replace(/'s$/i, "");
    const sentenceStart = i === 0 || SENTENCE_END.test(words[i - 1]);
    if (/^\d{3,4}s?$/.test(clean) || (!sentenceStart && /^[A-Z][a-z]{2,}/.test(clean))) out.push(clean);
  });
  return [...new Set(out)];
}

// Ordinary concrete nouns listed after on/like/in ("It's on flags, beer
// labels, football helmets" -> flags, labels, helmets). Needs >= 2 items of
// 1-3 words each; prefers missing a list over inventing one.
const LIST_ARTICLES = /^(a|an|the|every|some|your|our|their|his|her)\s+/i;
export function listedNouns(narration: string): string[] {
  const m = narration.match(/\b(?:on|like|in)\s+([^.?!;:—]+)/i);
  if (!m) return [];
  const clause = m[1];
  if (!/,|\s(or|and)\s/i.test(clause)) return [];
  const heads: string[] = [];
  for (const raw of clause.split(/\s*,\s*(?:and\s+|or\s+)?|\s+(?:and|or)\s+/i)) {
    const item = raw.trim().replace(LIST_ARTICLES, "").replace(/[^\w\s'-]/g, "").trim();
    if (!item) continue;
    const words = item.split(/\s+/);
    if (words.length > 3) break;
    heads.push(words[words.length - 1].toLowerCase());
  }
  return heads.length >= 2 ? heads : [];
}

const isViewerId = (id: string) => /^viewer(_|$)/.test(id);
const SECOND_PERSON_LINE = /\byou(?:'re|'ve|'d|'ll)?\b|\byour\b/i;

// A line spoken to the viewer ("you", "your head") needs the viewer on screen
// — the avatar of the line's era when the bible has one.
export function missingViewer(b: any, stream: WordStream, index: BibleIndex): string | null {
  if (!Number.isInteger(b.startWord) || !SECOND_PERSON_LINE.test(beatNarration(stream, b))) return null;
  const viewers = index.cast.filter((c) => isViewerId(c.id));
  if (!viewers.length) return null;
  const era = lineEra(stream, b.startWord, b.endWord);
  const want = (era && viewers.find((c) => viewerEra(c.id, c.label) === era)) || null;
  const ids = (b.subjects ?? []).map((s: any) => s.castId);
  if (want ? ids.includes(want.id) : ids.some(isViewerId)) return null;
  return `the line speaks to the viewer — include "${want?.id ?? viewers[0].id}" in the cast (hands, back or tiny count)`;
}

// Per-beat content checks (all SOFT): not one still image, undeclared text,
// an abstract restatement with nothing concrete on screen, and a line that
// names things (a place, a person, a date) none of which the concept shows.
export function contentIssues(b: any, narration: string): { code: string; fix: string }[] {
  const out: { code: string; fix: string }[] = [];
  const v = String(b.visualConcept ?? "");
  const text = String(b.textIntent?.text ?? "");
  const word = conceptNotStill(v);
  if (word) out.push({ code: "concept_not_still", fix: `"${word}" — make it one frozen still image` });
  const t = v.match(TEXT_IMPLIED);
  if (t && b.textIntent?.mode !== "SHORT_TEXT" && b.textIntent?.mode !== "PROGRAMMATIC") out.push({ code: "undeclared_text", fix: `"${t[0]}" implies readable text — declare txt SHORT_TEXT with the exact string (<= 5 words), or show it without text` });
  const a = v.match(ABSTRACT);
  if (a && !(b.subjects ?? []).length && !(b.propIds ?? []).length) out.push({ code: "abstract_concept", fix: `"${a[0]}" is abstract — show who/what is visible, their pose and the setting` });
  const names = namedThings(narration);
  const seen = `${v} ${text}`.toLowerCase();
  if (names.length && !names.some((x) => seen.includes(x.toLowerCase().slice(0, 5)))) out.push({ code: "ungrounded_name", fix: `the line names ${names.slice(0, 3).join(", ")} — show it` });
  const listed = listedNouns(narration);
  const shown = listed.filter((x) => seen.includes(x.slice(0, 4)));
  if (listed.length && shown.length < Math.ceil(listed.length / 2)) out.push({ code: "ungrounded_list", fix: `the line lists ${listed.join(", ")} — show those things` });
  if (b.treatment === "CROWD" && !(b.subjects ?? []).some((s: any) => !isViewerId(s.castId))) out.push({ code: "crowd_without_group", fix: "a CROWD needs a group of people (an archetype), not just the viewer" });
  return out;
}

// A viewer avatar from the wrong era for this line, when the right one exists.
export function wrongEraViewer(b: any, stream: WordStream, index: BibleIndex): string | null {
  if (!Number.isInteger(b.startWord)) return null;
  const era = lineEra(stream, b.startWord, b.endWord);
  if (!era) return null;
  const roles = new Map(index.cast.map((c) => [c.id, c.label]));
  const right = index.cast.find((c) => viewerEra(c.id, c.label) === era);
  const wrong = (b.subjects ?? []).find((s: any) => { const e = viewerEra(s.castId, roles.get(s.castId) ?? ""); return e && e !== era; });
  return wrong && right ? `"${wrong.castId}" is the wrong era for this ${era === "modern" ? "present-day" : "period"} line — use "${right.id}"` : null;
}

// Code fixes the wrong-era viewer itself (same person, other era's avatar) —
// deterministic, no model call. Returns how many beats were corrected.
export function fixViewerEras(beats: any[], stream: WordStream, index: BibleIndex): number {
  let fixed = 0;
  const roles = new Map(index.cast.map((c) => [c.id, c.label]));
  for (const b of beats) {
    if (!Number.isInteger(b.startWord) || !(b.subjects ?? []).length) continue;
    const era = lineEra(stream, b.startWord, b.endWord);
    const right = era ? index.cast.find((c) => viewerEra(c.id, c.label) === era) : null;
    if (!right) continue;
    for (const s of b.subjects) {
      const e = viewerEra(s.castId, roles.get(s.castId) ?? "");
      if (e && e !== era) {
        s.castId = right.id;
        fixed += 1;
      }
    }
    b.subjects = b.subjects.filter((s: any, k: number) => b.subjects.findIndex((x: any) => x.castId === s.castId) === k);
  }
  return fixed;
}

// Primary subject: the first cast member, else the first prop, else none.
export function primarySubject(b: any): string | null {
  return b.subjects?.[0]?.castId ?? b.propIds?.[0] ?? null;
}

/* ============================ Validation ============================ */

export type Issue = { code: string; message: string; beat?: number };

export const MIN_BEAT_MS = 1800;
export const MAX_BEAT_MS = 6500;
export const MAX_HOLD_MS = 9000;
export const MAX_CHUNKS_PER_BEAT = 3;
export const HOOK_WINDOW_MS = 30_000;
export const SHORT_TEXT_PER_MINUTE = 4;
export const HOLDS_PER_MINUTE = 1;

export function beatTiming(stream: WordStream, startWord: number, endWord: number) {
  const startMs = stream.words[startWord].startMs;
  // A beat holds until the next beat's first word (pauses belong to the beat they follow).
  const endMs = endWord + 1 < stream.words.length ? stream.words[endWord + 1].startMs : stream.words[endWord].endMs;
  return { startMs, endMs };
}

function wordsIn(text: string | null | undefined) {
  return tokenize(text ?? "").length;
}

const validHold = (b: any, durMs: number) => !!b.flags?.hold && !!String(b.flags?.reason ?? "").trim() && durMs <= MAX_HOLD_MS;

// Chunk ranges -> word ranges; HARD issues for bad chunk coverage.
export function chunkRangesToWords(raw: any[], win: ChunkedWindow): { beats: any[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const first = win.chunks[0].index;
  const last = win.chunks[win.chunks.length - 1].index;
  const byIndex = new Map(win.chunks.map((c) => [c.index, c]));
  let expected = first;
  const beats: any[] = [];
  raw.forEach((b, i) => {
    const n = i + 1;
    if (!Number.isInteger(b.startChunk) || !Number.isInteger(b.endChunk) || !byIndex.has(b.startChunk) || !byIndex.has(b.endChunk) || b.endChunk < b.startChunk) {
      issues.push({ code: "chunk_range_invalid", message: `Beat ${n}: startChunk/endChunk must be chunk numbers C${first}..C${last} with endChunk >= startChunk.`, beat: n });
      return;
    }
    if (b.startChunk !== expected) issues.push({ code: b.startChunk > expected ? "gap" : "overlap", message: `Beat ${n} starts at C${b.startChunk}; it must start at C${expected}.`, beat: n });
    expected = b.endChunk + 1;
    beats.push({ ...b, startWord: byIndex.get(b.startChunk)!.startWord, endWord: byIndex.get(b.endChunk)!.endWord });
  });
  if (!issues.length && expected - 1 !== last) issues.push({ code: expected - 1 < last ? "gap" : "overlap", message: `The last beat must end at C${last}; it ends at C${expected - 1}.` });
  return { beats, issues };
}

// Code auto-split: a beat over the limit (or over 3 chunks) is split at its
// chunk boundaries into groups that fit. The first group keeps the parent's
// contract; the others are returned in `needFill` for a fresh contract.
// Hook rule (window-1 review): a multi-chunk beat that starts in the first
// 30 s is split into single chunks (a valid HOLD is exempt). Re-timing an
// existing plan turns it off (`hookSingleChunk: false`) — only bounds apply there.
export function autoSplitBeats(beats: any[], win: ChunkedWindow, stream: WordStream, opts: { hookSingleChunk?: boolean } = {}): { beats: any[]; needFill: number[]; splits: number; merges: number } {
  const byIndex = new Map(win.chunks.map((c) => [c.index, c]));
  const out: any[] = [];
  const needFill: number[] = [];
  let splits = 0;
  for (const b of beats) {
    const { startMs, endMs } = beatTiming(stream, b.startWord, b.endWord);
    const dur = endMs - startMs;
    const chunkCount = b.endChunk - b.startChunk + 1;
    const hookSplit = opts.hookSingleChunk !== false && chunkCount > 1 && startMs < HOOK_WINDOW_MS && !validHold(b, dur);
    if (!hookSplit && (dur <= MAX_BEAT_MS || validHold(b, dur)) && chunkCount <= MAX_CHUNKS_PER_BEAT) {
      out.push(b);
      continue;
    }
    splits += 1;
    const groups: [number, number][] = [];
    let gStart = b.startChunk;
    for (let c = b.startChunk; c <= b.endChunk; c++) {
      if (hookSplit) {
        groups.push([c, c]);
        gStart = c + 1;
        continue;
      }
      const next = c + 1;
      const g = beatTiming(stream, byIndex.get(gStart)!.startWord, byIndex.get(c)!.endWord);
      const withNext = next <= b.endChunk ? beatTiming(stream, byIndex.get(gStart)!.startWord, byIndex.get(next)!.endWord) : null;
      const groupFull = !withNext || withNext.endMs - withNext.startMs > MAX_BEAT_MS || next - gStart + 1 > 2 || g.endMs - g.startMs >= 3000;
      if (groupFull) {
        groups.push([gStart, c]);
        gStart = next;
      }
    }
    groups.forEach(([s, e], k) => {
      const sub = { startChunk: s, endChunk: e, startWord: byIndex.get(s)!.startWord, endWord: byIndex.get(e)!.endWord };
      if (k === 0) out.push({ ...b, ...sub, flags: { ...(b.flags ?? {}), hold: false, reason: null } });
      else out.push({ ...sub, parentConcept: b.visualConcept, needsFill: true });
    });
  }

  // Auto-merge (the counterpart of auto-split): a beat under 1.8 s that isn't a
  // PUNCH joins a neighbour when the result still fits (<= 6.5 s, <= 3 chunks);
  // the neighbour with a written contract keeps it. Typically a whole short
  // sentence ("So what?") — chunks never cross sentence ends, beats may.
  let merges = 0;
  const fits = (a: any, b: any) => {
    const t = beatTiming(stream, a.startWord, b.endWord);
    return t.endMs - t.startMs <= MAX_BEAT_MS && b.endChunk - a.startChunk + 1 <= MAX_CHUNKS_PER_BEAT;
  };
  const dur = (x: any) => { const t = beatTiming(stream, x.startWord, x.endWord); return t.endMs - t.startMs; };
  for (let i = 0; i < out.length; i++) {
    const b = out[i];
    if (dur(b) >= MIN_BEAT_MS || (b.flags?.punch && String(b.flags?.reason ?? "").trim())) continue;
    const prev = out[i - 1];
    const next = out[i + 1];
    const intoPrev = prev && fits(prev, b);
    const intoNext = next && fits(b, next);
    if (!intoPrev && !intoNext) continue;
    const usePrev = intoPrev && (!intoNext || dur(prev) <= dur(next));
    const [a, z] = usePrev ? [prev, b] : [b, next];
    const keeper = !a.needsFill ? a : !z.needsFill ? z : a;
    const mergedBeat = { ...keeper, startChunk: a.startChunk, endChunk: z.endChunk, startWord: a.startWord, endWord: z.endWord };
    out.splice(usePrev ? i - 1 : i, 2, mergedBeat);
    merges += 1;
    i = Math.max(-1, i - 2);
  }
  out.forEach((b, i) => { if (b.needsFill) needFill.push(i); });
  return { beats: out, needFill, splits, merges };
}

// HARD issues for one window's beats (word ranges attached). `previousBeat` is
// the last accepted beat of the previous window (adjacency across windows).
export function validateWindowBeats(raw: any[], win: Window, stream: WordStream, index: BibleIndex, previousBeat: any | null): Issue[] {
  const issues: Issue[] = [];
  if (!Array.isArray(raw) || !raw.length) return [{ code: "no_beats", message: "No beats returned for this window." }];
  const castIds = new Set(index.cast.map((c) => c.id));
  const settingIds = new Set(index.settings.map((s) => s.id));
  const propIds = new Set(index.props.map((p) => p.id));

  let expected = win.startWord;
  let holds = 0;
  raw.forEach((b, i) => {
    const n = i + 1;
    if (!Number.isInteger(b.startWord) || !Number.isInteger(b.endWord)) {
      issues.push({ code: "range_invalid", message: `Beat ${n}: startWord/endWord must be integers.`, beat: n });
      return;
    }
    if (b.startWord !== expected) issues.push({ code: b.startWord > expected ? "gap" : "overlap", message: `Beat ${n} starts at word ${b.startWord}; it must start at ${expected} (${b.startWord > expected ? "gap" : "overlap"}).`, beat: n });
    if (b.endWord < b.startWord) issues.push({ code: "range_invalid", message: `Beat ${n}: endWord ${b.endWord} is before startWord ${b.startWord}.`, beat: n });
    expected = b.endWord + 1;

    if (b.startWord >= 0 && b.endWord < stream.words.length && b.endWord >= b.startWord) {
      const { startMs, endMs } = beatTiming(stream, b.startWord, b.endWord);
      const dur = endMs - startMs;
      const reason = String(b.flags?.reason ?? "").trim();
      if (b.flags?.hold) holds += 1;
      if (dur < MIN_BEAT_MS && !(b.flags?.punch && reason)) issues.push({ code: "too_short", message: `Beat ${n} (words ${b.startWord}-${b.endWord}) lasts ${(dur / 1000).toFixed(1)}s — under ${MIN_BEAT_MS / 1000}s; merge it with a neighbour or flag PUNCH with a reason.`, beat: n });
      if (dur > MAX_BEAT_MS && !validHold(b, dur)) issues.push({ code: "too_long", message: `Beat ${n} (words ${b.startWord}-${b.endWord}) lasts ${(dur / 1000).toFixed(1)}s — over ${MAX_BEAT_MS / 1000}s (HOLD max ${MAX_HOLD_MS / 1000}s with a reason).`, beat: n });
    }

    if (!b.visualConcept?.trim()) issues.push({ code: "missing_concept", message: `Beat ${n} has no visualConcept.`, beat: n });
    for (const s of b.subjects ?? []) if (!castIds.has(s.castId)) issues.push({ code: "unknown_cast", message: `Beat ${n}: castId "${s.castId}" is not in the bible.`, beat: n });
    if (b.settingId != null && !settingIds.has(b.settingId)) issues.push({ code: "unknown_setting", message: `Beat ${n}: settingId "${b.settingId}" is not in the bible.`, beat: n });
    for (const p of b.propIds ?? []) if (!propIds.has(p)) issues.push({ code: "unknown_prop", message: `Beat ${n}: propId "${p}" is not in the bible.`, beat: n });
    if (b.textIntent?.mode === "SHORT_TEXT" && (wordsIn(b.textIntent.text) === 0 || wordsIn(b.textIntent.text) > 5)) {
      issues.push({ code: "short_text_too_long", message: `Beat ${n}: SHORT_TEXT must be 1-5 words, got "${b.textIntent.text ?? ""}".`, beat: n });
    }
  });
  if (expected - 1 !== win.endWord) issues.push({ code: expected - 1 < win.endWord ? "gap" : "overlap", message: `The last beat must end at word ${win.endWord}; it ends at ${expected - 1}.` });

  const prior = previousBeats(previousBeat);
  const all = [...prior, ...raw];
  for (let i = prior.length; i < all.length; i++) {
    const b = all[i];
    const n = i - prior.length + 1;
    const exempt = !!b.flags?.hold || b.treatment === "CALLBACK";
    if (i > 0 && sameLook(all[i - 1], b) && !exempt) {
      issues.push({ code: "adjacent_identical", message: `Beat ${n} repeats the previous beat's treatment, camera, subjects and setting — change at least one (or flag HOLD).`, beat: n });
    }
    if (subjectRunAt(all, i) && !exempt) {
      issues.push({ code: "subject_run", message: `Beat ${n} is the 3rd beat in a row on "${primarySubject(b)}" — show a different subject or viewpoint (e.g. what it faces, or someone's reaction).`, beat: n });
    }
  }

  for (let i = prior.length; i < all.length; i++) {
    const b = all[i];
    const n = i - prior.length + 1;
    const exempt = !!b.flags?.hold || b.treatment === "CALLBACK";
    if (!exempt && !subjectRunAt(all, i) && subjectRepeatAt(all, i)) issues.push({ code: "subject_repeat", message: `Beat ${n}: "${primarySubject(b)}" is the main subject for the 4th time in 8 beats — show a different subject or viewpoint.`, beat: n });
  }
  raw.forEach((b, i) => {
    for (const c of contentIssues(b, beatNarration(stream, b))) issues.push({ code: c.code, message: `Beat ${i + 1}: ${c.fix}.`, beat: i + 1 });
    const era = wrongEraViewer(b, stream, index);
    if (era) issues.push({ code: "wrong_era_viewer", message: `Beat ${i + 1}: ${era}.`, beat: i + 1 });
    const viewer = missingViewer(b, stream, index);
    if (viewer) issues.push({ code: "viewer_missing", message: `Beat ${i + 1}: ${viewer}.`, beat: i + 1 });
  });

  // Rates are reported on each beat over the allowance (per-beat warnings).
  const { text: allowedText, holds: allowedHolds } = windowAllowances(stream, win);
  const textBeats = raw.map((b, i) => (b.textIntent?.mode === "SHORT_TEXT" ? i : -1)).filter((i) => i >= 0);
  for (const i of textBeats.slice(allowedText)) issues.push({ code: "short_text_rate", message: `${textBeats.length} SHORT_TEXT beats in this window; at most ${allowedText} (~${SHORT_TEXT_PER_MINUTE}/minute). Beat ${i + 1} should be NO_TEXT or PROGRAMMATIC.`, beat: i + 1 });
  const holdBeats = raw.map((b, i) => (b.flags?.hold ? i : -1)).filter((i) => i >= 0);
  for (const i of holdBeats.slice(allowedHolds)) issues.push({ code: "hold_rate", message: `${holds} HOLD beats in this window; at most ${allowedHolds} (~${HOLDS_PER_MINUTE}/minute).`, beat: i + 1 });
  return issues;
}

export function windowAllowances(stream: WordStream, win: Window) {
  const t = beatTiming(stream, win.startWord, win.endWord);
  const minutes = (t.endMs - t.startMs) / 60_000;
  return { text: Math.max(1, Math.round(minutes * SHORT_TEXT_PER_MINUTE)), holds: Math.max(1, Math.round(minutes * HOLDS_PER_MINUTE)) };
}

// Quality rules never fail a paid run: SOFT issues get one fix via the
// window's batched fill call; whatever remains is kept as a per-beat warning
// (plan status ready_with_warnings). Everything else is HARD (coverage,
// timing bounds, unknown ids, schema) — one full-window repair, then fail.
export const SOFT_CODES = new Set([
  "subject_run", "subject_repeat", "adjacent_identical", "concept_not_still", "short_text_too_long", "short_text_rate", "hold_rate",
  "undeclared_text", "abstract_concept", "ungrounded_name", "wrong_era_viewer", "ungrounded_list", "viewer_missing", "crowd_without_group",
]);
export const isSoft = (i: Issue) => SOFT_CODES.has(i.code);

// "Composition" is camera AND framing. Comparing the camera enum alone
// flagged real progressions (pull back to profile, zoom into the bar, pan
// along the helmet) as identical — 8 false failures in the confirmation run.
function sameLook(a: any, b: any) {
  const subj = (x: any) => (x.subjects ?? []).map((s: any) => s.castId).sort().join(",");
  const framing = (x: any) => String(x.composition?.framing ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return a.treatment === b.treatment && a.composition?.camera === b.composition?.camera && framing(a) === framing(b) && subj(a) === subj(b) && (a.settingId ?? null) === (b.settingId ?? null);
}

// `previousBeat` may be one beat or the last few (subject runs cross windows).
function previousBeats(previous: any | any[] | null): any[] {
  if (!previous) return [];
  return (Array.isArray(previous) ? previous : [previous]).slice(-(REPEAT_SPAN - 1));
}

// Max 2 consecutive beats on the same primary subject/object.
function subjectRunAt(all: any[], i: number) {
  const p = primarySubject(all[i]);
  return i >= 2 && p != null && primarySubject(all[i - 1]) === p && primarySubject(all[i - 2]) === p;
}

// ...and max 3 times within any 8 consecutive beats.
export const REPEAT_SPAN = 8;
export const REPEAT_MAX = 3;
function subjectRepeatAt(all: any[], i: number) {
  const p = primarySubject(all[i]);
  if (p == null) return false;
  return all.slice(Math.max(0, i - (REPEAT_SPAN - 1)), i).filter((x) => primarySubject(x) === p).length >= REPEAT_MAX;
}

// Beats to rewrite in the window's one batched fill call (the SOFT rules'
// one repair — never a full-window repair): concepts that aren't one still
// image, the 3rd beat in a row on the same subject, a beat identical to the
// previous one, and SHORT_TEXT that's too long or over the window's
// allowance. Marks them in place; returns indices.
export function markRewrites(beats: any[], previous: any | any[] | null, allowedText = Infinity, stream?: WordStream, index?: BibleIndex): number[] {
  const prior = previousBeats(previous);
  const out: number[] = [];
  let texts = 0;
  beats.forEach((b, k) => {
    if (b.needsFill) return;
    const all = [...prior, ...beats];
    const i = prior.length + k;
    const exempt = !!b.flags?.hold || b.treatment === "CALLBACK";
    const run = !exempt && subjectRunAt(all, i);
    const repeat = !exempt && !run && subjectRepeatAt(all, i);
    const same = !exempt && i > 0 && sameLook(all[i - 1], b);
    const isText = b.textIntent?.mode === "SHORT_TEXT";
    const textWords = isText ? wordsIn(b.textIntent.text) : 0;
    const textLong = isText && (textWords === 0 || textWords > 5);
    const textOver = isText && ++texts > allowedText;
    const content = contentIssues(b, stream ? beatNarration(stream, b) : "");
    const viewer = stream && index ? missingViewer(b, stream, index) : null;
    if (viewer) content.push({ code: "viewer_missing", fix: viewer });
    if (!content.length && !run && !repeat && !same && !textLong && !textOver) return;
    b.fixReason = [
      ...content.map((c) => c.fix),
      run ? `3rd beat in a row on "${primarySubject(b)}" — its main subject must NOT be "${primarySubject(b)}": show another cast member, a prop, or nobody (what it faces, a reaction)` : "",
      repeat ? `"${primarySubject(b)}" is already the main subject ${REPEAT_MAX} times in the last ${REPEAT_SPAN} beats — its main subject must NOT be "${primarySubject(b)}"` : "",
      same ? "identical to the previous beat — change the treatment, camera/framing, subjects or setting" : "",
      textLong ? "SHORT_TEXT must be 1-5 words" : "",
      textOver ? "too many SHORT_TEXT beats in this window — use NO_TEXT or PROGRAMMATIC" : "",
    ].filter(Boolean).join("; ");
    b.needsFill = true;
    b.rewrite = true;
    // A beat rewritten for a subject run drops out of the run, so later beats
    // are checked against the rewrite, not the old subject.
    if (run || repeat) {
      b.before = { subjects: b.subjects, propIds: b.propIds };
      b.avoidSubject = primarySubject(b);
      b.subjects = [];
      b.propIds = [];
    }
    out.push(k);
  });
  return out;
}

/* ============================ Assembly ============================ */

export type Beat = {
  sequence: number;
  startWord: number;
  endWord: number;
  narrationText: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  contract: any;
  // SOFT rule violations left after the one batched fix (for the review UI).
  warnings: { code: string; message: string }[];
};

export function assembleBeats(raw: any[], stream: WordStream): Beat[] {
  return raw.map((b, i) => {
    const { startMs, endMs } = beatTiming(stream, b.startWord, b.endWord);
    const { startWord, endWord, startChunk: _s, endChunk: _e, parentConcept: _p, needsFill: _n, fixReason: _f, rewrite: _r, avoidSubject: _a, before: _b, warnings = [], ...contract } = b;
    return {
      warnings,
      sequence: i + 1,
      startWord,
      endWord,
      narrationText: stream.words.slice(startWord, endWord + 1).map((w) => w.word).join(" "),
      startMs,
      endMs,
      durationMs: endMs - startMs,
      contract: { ...contract, chunkRange: [b.startChunk, b.endChunk] },
    };
  });
}

// Plan-level HARD checks (coverage + exact text) and WARN checks (hook pace,
// callback pairing, text rate across the whole plan).
// `partial` (check runs): the beats cover only the first windows — coverage
// is checked as a prefix of the script instead of the whole.
export function validatePlan(beats: Beat[], stream: WordStream, partial = false): { hard: Issue[]; warn: Issue[] } {
  const hard: Issue[] = [];
  const warn: Issue[] = [];
  if (!beats.length) hard.push({ code: "no_beats", message: "The plan has no beats." });
  if (beats.length && beats[0].startWord !== 0) hard.push({ code: "coverage_start", message: `The first beat starts at word ${beats[0].startWord}, not 0.` });
  const lastWord = stream.words.length - 1;
  if (!partial && beats.length && beats[beats.length - 1].endWord !== lastWord) hard.push({ code: "coverage_end", message: `The last beat ends at word ${beats[beats.length - 1].endWord}, not ${lastWord}.` });
  for (let i = 1; i < beats.length; i++) {
    if (beats[i].startWord !== beats[i - 1].endWord + 1) hard.push({ code: "coverage_gap_or_overlap", message: `Beat ${beats[i].sequence} starts at ${beats[i].startWord}; expected ${beats[i - 1].endWord + 1}.`, beat: beats[i].sequence });
  }
  const joined = beats.map((b) => b.narrationText).join(" ");
  if (partial ? !stream.scriptText.startsWith(joined) : joined !== stream.scriptText) hard.push({ code: "text_mismatch", message: "The beats' joined narration does not equal the script exactly." });

  const hookBeats = beats.filter((b) => b.startMs < HOOK_WINDOW_MS);
  const offPace = hookBeats.filter((b) => b.durationMs < 2500 || b.durationMs > 3500);
  if (hookBeats.length && offPace.length > hookBeats.length / 2) warn.push({ code: "hook_pace", message: `${offPace.length} of ${hookBeats.length} beats in the first 30s fall outside ~2.5-3.5s.` });
  const hasPlant = beats.some((b) => b.contract?.motif?.role === "plant");
  const hasPayoff = beats.some((b) => b.contract?.motif?.role === "payoff");
  if (hasPlant !== hasPayoff) warn.push({ code: "callback_unpaired", message: hasPlant ? "A plant beat exists without a payoff beat." : "A payoff beat exists without a plant beat." });
  const totalMin = beats.length ? (beats[beats.length - 1].endMs - beats[0].startMs) / 60_000 : 0;
  const shortTexts = beats.filter((b) => b.contract?.textIntent?.mode === "SHORT_TEXT").length;
  if (totalMin > 0 && shortTexts > Math.ceil(totalMin * SHORT_TEXT_PER_MINUTE)) warn.push({ code: "short_text_rate_plan", message: `${shortTexts} SHORT_TEXT beats over ${totalMin.toFixed(1)} min (> ${SHORT_TEXT_PER_MINUTE}/min).` });
  warn.push(...balanceWarnings(beats));
  return { hard, warn };
}

// Plan-level SOFT targets: people on screen, and not too many SYMBOLIC /
// OBJECT_DETAIL beats (run 5: 26 of each out of 115, 42% with nobody).
export const CAST_SHARE_MIN = 0.55;
export const SYMBOLIC_SHARE_MAX = 0.15;
export const OBJECT_DETAIL_SHARE_MAX = 0.2;
export function balanceWarnings(beats: Beat[]): Issue[] {
  const warn: Issue[] = [];
  if (!beats.length) return warn;
  const share = (f: (b: Beat) => boolean) => beats.filter(f).length / beats.length;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const cast = share((b) => (b.contract?.subjects ?? []).length > 0);
  const sym = share((b) => b.contract?.treatment === "SYMBOLIC");
  const obj = share((b) => b.contract?.treatment === "OBJECT_DETAIL");
  if (cast < CAST_SHARE_MIN) warn.push({ code: "cast_share_low", message: `${pct(cast)} of beats show a cast member (target >= ${pct(CAST_SHARE_MIN)}).` });
  if (sym > SYMBOLIC_SHARE_MAX) warn.push({ code: "symbolic_share_high", message: `${pct(sym)} of beats are SYMBOLIC (max ${pct(SYMBOLIC_SHARE_MAX)}).` });
  if (obj > OBJECT_DETAIL_SHARE_MAX) warn.push({ code: "object_detail_share_high", message: `${pct(obj)} of beats are OBJECT_DETAIL (max ${pct(OBJECT_DETAIL_SHARE_MAX)}).` });
  return warn;
}

export function planStats(beats: Beat[]) {
  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
  };
  const durs = beats.map((b) => b.durationMs);
  const words = beats.map((b) => b.endWord - b.startWord + 1);
  const treatmentMix: Record<string, number> = {};
  const castUsed: Record<string, number> = {};
  for (const b of beats) {
    treatmentMix[b.contract.treatment] = (treatmentMix[b.contract.treatment] ?? 0) + 1;
    for (const s of b.contract.subjects ?? []) castUsed[s.castId] = (castUsed[s.castId] ?? 0) + 1;
  }
  const shortText = beats.filter((b) => b.contract?.textIntent?.mode === "SHORT_TEXT").length;
  return {
    beatCount: beats.length,
    wordsPerBeat: { median: med(words), max: Math.max(0, ...words) },
    durationMs: { median: med(durs), min: durs.length ? Math.min(...durs) : 0, max: durs.length ? Math.max(...durs) : 0 },
    totalMs: beats.length ? beats[beats.length - 1].endMs : 0,
    holdCount: beats.filter((b) => b.contract?.flags?.hold).length,
    treatmentMix,
    castUsed,
    shortTextPct: beats.length ? Math.round((shortText / beats.length) * 1000) / 10 : 0,
    castPct: beats.length ? Math.round((beats.filter((b) => (b.contract?.subjects ?? []).length).length / beats.length) * 1000) / 10 : 0,
  };
}

/* ============================ Re-timing onto real narration ============================ */

// Maps an existing plan (built on synthetic timings) onto the real narration
// word timings — zero model calls. Word ranges never change; durations do.
// Beats that leave 1.8-6.5 s are fixed by the same code auto-split/merge as
// the director (at the plan's original chunk boundaries); split-off parts get
// needsConcept (filled by the next director run, not here).
// boundaries "real" (default, Phase 2c): split points are the real-timing
// chunk edges plus the plan's own beat edges; "plan": the plan's original
// (synthetic) chunk boundaries only.
export function retimePlan(planBeats: { startWord: number; endWord: number; contract: any }[], segments: { id: string; text: string }[], narration: any[], opts: { boundaries?: "real" | "plan" } = {}) {
  const real = buildWordStream(segments, narration);
  if (real.timingSource !== "real") throw new Error("RETIME_NEEDS_REAL_TIMINGS: the narration does not cover these segments");
  const synth = buildWordStream(segments, null);
  const realChunks = chunkWindows(real, planWindows(real)).flatMap((w) => w.chunks);
  const usePlan = opts.boundaries === "plan";
  const lastPlanWord = planBeats[planBeats.length - 1].endWord;
  let chunks: Chunk[];
  if (usePlan) chunks = chunkWindows(synth, planWindows(synth)).flatMap((w) => w.chunks);
  else {
    const cuts = [...new Set([...planBeats.map((b) => b.endWord), ...realChunks.map((c) => c.endWord).filter((w) => w <= lastPlanWord)])].sort((a, b) => a - b);
    chunks = [];
    let start = 0;
    for (const end of cuts) {
      const t = beatTiming(real, start, end);
      chunks.push({ index: chunks.length, startWord: start, endWord: end, startMs: t.startMs, endMs: t.endMs, wordCount: end - start + 1, text: real.words.slice(start, end + 1).map((w) => w.word).join(" ") });
      start = end + 1;
    }
  }
  const chunkOf = (word: number) => chunks.find((c) => word >= c.startWord && word <= c.endWord)!.index;
  const all: ChunkedWindow = { index: 0, startWord: 0, endWord: real.words.length - 1, chunks };
  const dur = (s: WordStream, b: { startWord: number; endWord: number }) => { const t = beatTiming(s, b.startWord, b.endWord); return t.endMs - t.startMs; };

  const rows = planBeats.map((b, i) => ({ sequence: i + 1, startWord: b.startWord, endWord: b.endWord, synthMs: dur(synth, b), realMs: dur(real, b), realStartMs: beatTiming(real, b.startWord, b.endWord).startMs, contract: b.contract }));
  const outOfBounds = rows.filter((r) => (r.realMs < MIN_BEAT_MS && !(r.contract?.flags?.punch && r.contract?.flags?.reason)) || (r.realMs > MAX_BEAT_MS && !validHold(r.contract ?? {}, r.realMs)));

  const raw = planBeats.map((b) => ({ ...b.contract, startWord: b.startWord, endWord: b.endWord, startChunk: usePlan ? b.contract?.chunkRange?.[0] ?? chunkOf(b.startWord) : chunkOf(b.startWord), endChunk: usePlan ? b.contract?.chunkRange?.[1] ?? chunkOf(b.endWord) : chunkOf(b.endWord) }));
  const fixed = autoSplitBeats(raw, all, real, { hookSingleChunk: false });
  for (const b of fixed.beats) if (b.needsFill) Object.assign(b, { needsConcept: true, conceptFrom: b.parentConcept ?? null });
  const beats = assembleBeats(fixed.beats, real);

  const drift = rows.map((r) => Math.abs(r.realMs - r.synthMs)).sort((a, b) => a - b);
  const first = real.words[0];
  const last = real.words[real.words.length - 1];
  const synthLast = synth.words[synth.words.length - 1];
  return {
    beats,
    before: rows,
    outOfBounds,
    stats: {
      realWpm: Math.round((real.words.length / ((last.endMs - first.startMs) / 60_000)) * 10) / 10,
      realTotalMs: last.endMs,
      syntheticTotalMs: synthLast.endMs,
      driftMs: { median: drift[Math.floor(drift.length / 2)] ?? 0, max: drift[drift.length - 1] ?? 0 },
      boundaries: usePlan ? "plan" : "real",
      realChunks: realChunks.length,
      realChunksOver6500: realChunks.filter((c) => c.endMs - c.startMs > MAX_BEAT_MS).map((c) => ({ index: c.index, ms: c.endMs - c.startMs, text: c.text })),
      realChunkMsMedian: [...realChunks.map((c) => c.endMs - c.startMs)].sort((a, b) => a - b)[Math.floor(realChunks.length / 2)],
      splits: fixed.splits,
      merges: fixed.merges,
      needsConcept: beats.filter((b) => b.contract.needsConcept).length,
      beatsAfter: beats.length,
      stillOutOfBounds: beats.filter((b) => b.durationMs < MIN_BEAT_MS || (b.durationMs > MAX_BEAT_MS && !validHold(b.contract, b.durationMs))).map((b) => b.sequence),
    },
  };
}

/* ============================ Director loop ============================ */

export type ModelCall = (req: { system: string; user: string; schema: any; toolName: string }) => Promise<{ input: any; usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number } }>;

export type DirectorResume = { nextWindow: number; accepted: any[]; usage: any; repairs: number; autoSplits?: number; autoMerges?: number; rewrites?: number; viewerSwaps?: number; rewritesDropped?: number };

export type DirectorResult =
  | { ok: true; beats: Beat[]; validation: { hard: Issue[]; warn: Issue[] }; stats: any; windows: number; repairs: number; usage: any }
  | { ok: false; errorCode: string; window?: number; issues: Issue[]; windows: number; repairs: number; usage: any; partialBeats: any[] }
  | { ok: false; yielded: true; resume: DirectorResume; windows: number; repairs: number; usage: any };

// Worst-case price of one call, scaled by how many beats it can return
// (~110 output tokens per beat at $10/M with margin, plus prompt).
export function estimateCallUsd(beatsOut: number) {
  return beatsOut * 0.0012 + 0.006;
}

// Resumable: `shouldYield` is checked before each window after the first
// one of this invocation; when it says stop, the result carries `resume`
// so a later invocation continues exactly where this one left off.
export async function runBeatDirector(opts: {
  segments: { id: string; text: string }[];
  bible: any;
  narration?: any[] | null;
  callback: { key: string | null; plantSegmentId: string | null; payoffSegmentId: string | null };
  callModel: ModelCall;
  resume?: DirectorResume | null;
  shouldYield?: () => boolean;
  maxCostUsd?: number;
  costOf?: (usage: any) => number;
  // Check runs: direct only the first N windows (plan is partial, coverage not checked).
  maxWindows?: number;
  // Replays of recordings made before the hook single-chunk rule pass false.
  hookSingleChunk?: boolean;
  // Synthetic-timing pace when no narration exists: the voice's measured wpm.
  wordsPerMinute?: number;
}): Promise<DirectorResult & { timingSource: TimingSource; bibleIndex: BibleIndex }> {
  const stream = buildWordStream(opts.segments, opts.narration, opts.wordsPerMinute);
  const index = buildBibleIndex(opts.bible);
  const windows = chunkWindows(stream, planWindows(stream));
  const schema = buildBeatSchema(index);
  const system = directorSystemPrompt(index, opts.bible, opts.callback);
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 0, ...(opts.resume?.usage ?? {}) };
  const accepted: any[] = [...(opts.resume?.accepted ?? [])];
  let repairs = opts.resume?.repairs ?? 0;
  let autoSplits = opts.resume?.autoSplits ?? 0;
  let autoMerges = opts.resume?.autoMerges ?? 0;
  let rewrites = opts.resume?.rewrites ?? 0;
  let viewerSwaps = opts.resume?.viewerSwaps ?? 0;
  let rewritesDropped = opts.resume?.rewritesDropped ?? 0;
  const lastWindow = Math.min(windows.length, opts.maxWindows ?? windows.length);
  const partial = lastWindow < windows.length;
  const firstWindow = opts.resume?.nextWindow ?? 0;
  const fail = (errorCode: string, win: number, issues: Issue[]) =>
    ({ ok: false as const, errorCode, window: win, issues, windows: windows.length, repairs, usage, partialBeats: accepted, timingSource: stream.timingSource, bibleIndex: index });
  const call = async (user: string, beatsOut: number) => {
    if (opts.maxCostUsd != null && opts.costOf && opts.costOf(usage) + estimateCallUsd(beatsOut) > opts.maxCostUsd) return null;
    const res = await opts.callModel({ system, user, schema, toolName: "direct_beats" });
    usage.calls += 1;
    usage.inputTokens += res.usage.inputTokens;
    usage.outputTokens += res.usage.outputTokens;
    usage.cacheReadTokens += res.usage.cacheReadTokens;
    usage.cacheWriteTokens += res.usage.cacheWriteTokens;
    return res;
  };
  const costCapIssue = (): Issue[] => [{ code: "cost_cap", message: `Spent $${opts.costOf!(usage).toFixed(4)}; the next call could exceed the $${opts.maxCostUsd} cap.` }];

  for (const win of windows.slice(firstWindow, lastWindow)) {
    if (win.index > firstWindow && opts.shouldYield?.()) {
      return { ok: false, yielded: true, resume: { nextWindow: win.index, accepted, usage, repairs, autoSplits, autoMerges, rewrites, viewerSwaps, rewritesDropped }, windows: windows.length, repairs, usage, timingSource: stream.timingSource, bibleIndex: index };
    }
    const previousAssembled = assembleBeats(accepted, stream).map((b) => ({ ...b.contract, sequence: b.sequence }));
    let notes: string[] | undefined;
    let beats: any[] = [];
    let issues: Issue[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await call(windowUserPrompt(stream, win, previousAssembled, notes), win.chunks.length);
      if (!res) return fail("COST_CAP", win.index, costCapIssue());
      const parsed = parseBeatsOutput(res.input);
      const mapped = parsed.error ? { beats: [], issues: [{ code: "malformed_output", message: parsed.error }] } : chunkRangesToWords(parsed.beats.map((b) => normalizeBeat(b, index)), win);
      issues = mapped.issues;
      beats = mapped.beats;

      if (!issues.length) {
        const split = autoSplitBeats(beats, win, stream, { hookSingleChunk: opts.hookSingleChunk });
        beats = split.beats;
        autoSplits += split.splits;
        autoMerges += split.merges;
        const prev = accepted.slice(-(REPEAT_SPAN - 1));
        viewerSwaps += fixViewerEras(beats, stream, index);
        rewrites += markRewrites(beats, prev, windowAllowances(stream, win).text, stream, index).length;
        let needFill = beats.map((b, i) => (b.needsFill ? i : -1)).filter((i) => i >= 0);
        // Near the cost cap, soft rewrites are dropped from the fill (kept as
        // warnings) rather than failing the run; split parts always need a fill.
        const fits = (n: number) => opts.maxCostUsd == null || !opts.costOf || opts.costOf(usage) + estimateCallUsd(n) <= opts.maxCostUsd;
        while (needFill.length && !fits(needFill.length)) {
          const k = [...needFill].reverse().find((i) => beats[i].rewrite);
          if (k == null) break;
          const b = beats[k];
          beats[k] = { ...b, ...(b.before ?? {}), needsFill: undefined, rewrite: undefined, fixReason: undefined, avoidSubject: undefined, before: undefined };
          needFill = needFill.filter((i) => i !== k);
          rewritesDropped += 1;
        }
        if (needFill.length) {
          const fillRes = await call(fillUserPrompt(stream, win, beats, needFill), needFill.length);
          if (!fillRes) return fail("COST_CAP", win.index, costCapIssue());
          const filled = parseBeatsOutput(fillRes.input);
          const byStart = new Map(filled.beats.map((b) => normalizeBeat(b, index)).map((f: any) => [f.startChunk, f]));
          for (const idx of needFill) {
            const b = beats[idx];
            const f = byStart.get(b.startChunk);
            const range = { startChunk: b.startChunk, endChunk: b.endChunk, startWord: b.startWord, endWord: b.endWord };
            if (f) beats[idx] = { ...f, ...range, flags: b.rewrite ? b.flags : f.flags };
            else if (b.rewrite) beats[idx] = { ...b, needsFill: undefined, fixReason: undefined, rewrite: undefined };
            else issues.push({ code: "fill_missing", message: `No contract returned for split beat C${b.startChunk}..C${b.endChunk}.` });
          }
        }
        viewerSwaps += fixViewerEras(beats, stream, index);
        if (!issues.length) issues = validateWindowBeats(beats, win, stream, index, prev);
      }
      // SOFT issues already had their one fix (the fill call): keep the beats
      // and carry the rest as per-beat warnings. Only HARD issues repair/fail.
      const soft = issues.filter(isSoft);
      issues = issues.filter((i) => !isSoft(i));
      if (!issues.length) {
        for (const w of soft) {
          const b = w.beat != null ? beats[w.beat - 1] : null;
          if (b) b.warnings = [...(b.warnings ?? []), { code: w.code, message: w.message }];
        }
        break;
      }
      if (attempt === 0) {
        repairs += 1;
        notes = issues.map((i) => i.message);
      }
    }
    if (issues.length) return fail("WINDOW_VALIDATION_FAILED", win.index, issues);
    accepted.push(...beats);
  }

  copyPlantMotion(accepted);
  const assembled = assembleBeats(accepted, stream);
  const validation = validatePlan(assembled, stream, partial);
  if (validation.hard.length) return fail("PLAN_VALIDATION_FAILED", windows.length - 1, validation.hard);
  const softWarnings: Record<string, number> = {};
  for (const b of assembled) for (const w of b.warnings) softWarnings[w.code] = (softWarnings[w.code] ?? 0) + 1;
  return { ok: true, beats: assembled, validation, stats: { ...planStats(assembled), timingNote: stream.timingNote ?? null, partial, windowsDirected: lastWindow, viewerSwaps, rewritesDropped, softWarnings, beatsWithWarnings: assembled.filter((b) => b.warnings.length).length, timingSource: stream.timingSource, windows: windows.length, repairs, autoSplits, autoMerges, rewrites, chunks: windows.reduce((s, w) => s + w.chunks.length, 0) }, windows: windows.length, repairs, usage, timingSource: stream.timingSource, bibleIndex: index };
}

/* ============================ Anthropic transport ============================ */

export const BEAT_DIRECTOR_MODEL = "claude-sonnet-5";
const SONNET_5 = { input: 2.0, output: 10.0 };

// `onExchange` receives each request/response pair (per call, no global fetch
// patching) — the caller decides whether this project may be recorded.
export function anthropicModelCall(apiKey: string, model = BEAT_DIRECTOR_MODEL, timeoutMs = 150_000, onExchange?: (e: { kind: "anthropic"; key: string; request: any; status: number; response: any }) => void): ModelCall {
  return async ({ system, user, schema, toolName }) => {
    const request = {
      model,
      max_tokens: 12000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      tools: [{ name: toolName, description: "Returns the beats.", input_schema: schema }],
      tool_choice: { type: "tool", name: toolName },
    };
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let payload: any = null;
    try {
      payload = JSON.parse(text);
    } catch { /* non-JSON error body */ }
    onExchange?.({ kind: "anthropic", key: toolName, request, status: res.status, response: payload ?? text });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 400)}`);
    if (payload?.stop_reason === "max_tokens") throw new Error("Beat Director response truncated by max_tokens");
    const block = (payload?.content ?? []).find((b: any) => b?.type === "tool_use");
    if (!block) throw new Error("Beat Director response had no tool_use block");
    const u = payload.usage ?? {};
    return { input: block.input, usage: { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0, cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0 } };
  };
}

export function sonnetCostUsd(u: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }) {
  return Number(((u.inputTokens * SONNET_5.input + u.outputTokens * SONNET_5.output + u.cacheReadTokens * SONNET_5.input * 0.1 + u.cacheWriteTokens * SONNET_5.input * 1.25) / 1_000_000).toFixed(4));
}
