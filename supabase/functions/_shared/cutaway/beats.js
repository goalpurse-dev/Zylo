// Cutaway Explainer: beat timing from the voice's real word timings, and the
// clip lengths / speed-fit factors the stitch uses. Pure.

import { MODELS } from "./pricing.js";
import { words } from "./planner.js";

/** Target narration pace after the stitch speeds the voice up (words per minute). */
export const TARGET_WPM = 238;
/** The most the stitch will speed the voice up (atempo); above this it sounds rushed. */
export const MAX_TEMPO = 1.45;
/** Silence kept after the last word, so the end frame is seen (R3). */
export const END_HOLD_SEC = 1.0;

/**
 * The voice tempo the stitch applies: brings the measured pace up to TARGET_WPM,
 * never slows it down, never above MAX_TEMPO.
 * spoken: [{w, s, e}] word timings from the TTS (seconds).
 */
export function voiceTempo(spoken) {
  if (!spoken.length) return 1;
  const span = spoken[spoken.length - 1].e - spoken[0].s;
  const wpm = span > 0 ? (spoken.length / span) * 60 : TARGET_WPM;
  return Math.round(Math.min(MAX_TEMPO, Math.max(1, TARGET_WPM / wpm)) * 1000) / 1000;
}

/**
 * Beat start/end times on the FINAL timeline (after the tempo change).
 * Words are matched to beats by count, in order (the TTS reads exactly the
 * joined beat texts). Each beat starts where its first word starts, except the
 * first (0); a beat ends where the next starts; the last ends END_HOLD_SEC
 * after the final word. verbAt: when the beat's verb is spoken.
 */
export function placeBeats(beats, spoken, tempo = 1) {
  const counts = beats.map((b) => words(b.text).length);
  const total = counts.reduce((a, b) => a + b, 0);
  if (spoken.length < total * 0.8) throw new Error(`BEATS_UNALIGNED: ${spoken.length} spoken words for ${total} planned`);
  const t = (sec) => sec / tempo;
  let cursor = 0;
  const starts = [];
  const verbs = [];
  beats.forEach((b, i) => {
    const first = spoken[Math.min(cursor, spoken.length - 1)];
    starts.push(i === 0 ? 0 : t(first.s));
    const mine = spoken.slice(cursor, cursor + counts[i]);
    const bare = (x) => x.toLowerCase().replace(/[^a-z0-9']/g, "");
    const hit = mine.find((x) => bare(x.w) === bare(b.verb)) ?? mine[Math.floor(mine.length / 2)] ?? first;
    verbs.push(t(hit.s));
    cursor += counts[i];
  });
  const lastWord = spoken[spoken.length - 1];
  const finish = t(lastWord.e) + END_HOLD_SEC;
  return beats.map((_, i) => {
    const start = starts[i];
    const end = i + 1 < beats.length ? starts[i + 1] : finish;
    return { start: round(start), end: round(end), duration: round(end - start), verbAt: round(verbs[i] - start) };
  });
}

/**
 * The clip to ask for per beat: whole seconds within the model's range,
 * and the speed factor the stitch applies to fit it to the beat exactly
 * (factor > 1 = played faster). verbAtSec is on the clip's own clock.
 */
export function clipTimings(placed) {
  return placed.map((p) => {
    const clipSec = Math.min(MODELS.clip.maxSec, Math.max(2, Math.round(p.duration)));
    const speed = round(clipSec / p.duration, 4);
    return { clipSec, speed, verbAtSec: round(p.verbAt * speed) };
  });
}

/** Without a voice: beats get equal shares of the length (the user records the script). */
export function evenBeats(beats, lengthSec) {
  const each = lengthSec / beats.length;
  return beats.map((_, i) => ({ start: round(i * each), end: round((i + 1) * each), duration: round(each), verbAt: round(each / 2) }));
}

function round(v, digits = 3) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** 9:16 crop box (fractions) -> whole pixels inside a W x H image. */
export function cropPixels(box, W, H) {
  const w = Math.max(2, Math.floor((box.w * W) / 2) * 2);
  const h = Math.max(2, Math.min(H, Math.round((w * 16) / 9 / 2) * 2));
  const x = Math.min(W - w, Math.max(0, Math.round(box.x * W)));
  const y = Math.min(H - h, Math.max(0, Math.round(box.y * H)));
  return { x, y, w, h };
}

/** Upscale factor so a crop of height h comes back at least 1280 tall (2 or 4). */
export const upscaleFactor = (h) => (h * 2 >= 1280 ? 2 : 4);
