// THE VOICE END CHECK (owner 2026-11-20). An ElevenLabs take can stop early: the audio ends mid-sentence while its
// timing data still lists the last words, and the pace step (pace.mjs) then squeezes those words into the file's last
// instant (the owner's first Studio voice: the last 7 words at 84.944 s, zero length, silent). Free, after the take is
// processed: the last words must each have a real length, start before the file ends, and the last word must sound.
//   voiceEndProblem({ wav, words, duration }) -> null (fine) | "why" (redo the take)
import { execFileSync } from "node:child_process";

export const END = Object.freeze({ lastWords: 3, minWordSec: 0.05, endMarginSec: 0.03, minDb: -40 });
const FF = process.env.FFMPEG ?? "ffmpeg";

/** the RMS level (dBFS) of [a, b] seconds of an audio file (mono 16 kHz, decoded here) */
export function levelDb(file, a, b) {
  const len = Math.max(0.02, b - a);
  const raw = execFileSync(FF, ["-v", "error", "-ss", a.toFixed(3), "-t", len.toFixed(3), "-i", file, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], { maxBuffer: 1 << 26 });
  const n = Math.floor(raw.length / 2);
  if (!n) return -Infinity;
  let s = 0;
  for (let i = 0; i < n; i++) { const v = raw.readInt16LE(i * 2) / 32768; s += v * v; }
  return 10 * Math.log10(s / n + 1e-12);
}

/** pure part: the word timings alone -> a reason, or null */
export function wordsEndProblem(words, duration, E = END) {
  if (!Array.isArray(words) || !words.length) return "the take has no word timings";
  const tail = words.slice(-E.lastWords);
  const squeezed = words.filter((w, i) => i >= words.length - 12 && Number(w.end) - Number(w.start) < E.minWordSec);
  if (tail.some((w) => Number(w.end) - Number(w.start) < E.minWordSec)) return `the last words have no length (${squeezed.length} squeezed into the end: the take stopped early)`;
  const last = words.at(-1);
  if (duration && Number(last.start) >= duration - E.endMarginSec) return `the last word starts at the very end of the file (${Number(last.start).toFixed(2)} of ${Number(duration).toFixed(2)} s)`;
  return null;
}

export function voiceEndProblem({ wav, words, duration, E = END }) {
  const byWords = wordsEndProblem(words, duration, E);
  if (byWords) return byWords;
  const last = words.at(-1);
  const db = levelDb(wav, Number(last.start), Number(last.end));
  if (!(db >= E.minDb)) return `the last word ("${last.word}") is silent (${Number.isFinite(db) ? db.toFixed(0) : "-inf"} dB)`;
  return null;
}
