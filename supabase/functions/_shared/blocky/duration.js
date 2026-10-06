// Clip length for one spoken line: estimate how long the line takes to say,
// add a short buffer, and snap UP to the nearest duration the model accepts.
// Never longer than needed, never shorter than the line.

export const WORDS_PER_SECOND = 2.6;    // natural, slightly punchy delivery
export const BUFFER_SEC = 0.8;          // breath before + reaction after
const PAUSE_SEC = { ",": 0.15, ";": 0.2, ":": 0.2, ".": 0.25, "!": 0.25, "?": 0.25, "…": 0.35, "—": 0.2 };

export function wordCount(line) {
  return String(line ?? "").trim().split(/\s+/).filter(Boolean).length;
}

/** Seconds needed to speak the line (without the buffer). */
export function estimateSpeechSec(line) {
  const text = String(line ?? "").trim();
  if (!text) return 0;
  const inner = text.replace(/[.!?…]+$/, "");           // the final stop isn't a pause
  let pauses = 0;
  for (const ch of inner) pauses += PAUSE_SEC[ch] ?? 0;
  return wordCount(text) / WORDS_PER_SECOND + pauses;
}

/**
 * Smallest allowed duration >= speech + buffer. Throws if even the longest
 * allowed clip is too short (the planner keeps lines short, so this only
 * happens with an over-long script line, which validation rejects first).
 * @param {string} line @param {number[]} allowed ascending seconds
 */
export function clipDurationSec(line, allowed) {
  const need = estimateSpeechSec(line) + BUFFER_SEC;
  const fit = allowed.find((d) => d >= need);
  if (fit === undefined) throw new Error(`LINE_TOO_LONG: needs ${need.toFixed(1)}s, max ${allowed.at(-1)}s`);
  return fit;
}

/** Longest line (in words) that still fits the model's longest clip. */
export function maxWordsFor(allowed) {
  const max = allowed.at(-1) - BUFFER_SEC;
  return Math.floor(max * WORDS_PER_SECOND);
}
