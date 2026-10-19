// Cutaway Explainer: beat timing from the voice's real word timings, and the
// clip lengths / speed-fit factors the stitch uses. Pure.

import { MODELS } from "./pricing.js";
import { words } from "./planner.js";
import { MAX_SFX_SEC } from "./sound.js";

/** At most one sound effect every this many seconds (chimes are separate). */
export const SFX_GAP_SEC = 6;

/** Silence kept after the last word, so the end frame is seen (R3). */
export const END_HOLD_SEC = 1.0;
/** How far past the target length the voice may run before the planner cuts words (seconds). */
export const OVERRUN_SEC = 1.0;

/**
 * The voice is never sped up (owner, 2026-10-19): tempo is always 1.
 * Kept as a function so stored runs and the stitch keep one shape.
 */
export function voiceTempo() {
  return 1;
}

/** Spoken length in seconds (first word start to last word end). */
export const spokenSeconds = (spoken) => (spoken.length ? spoken[spoken.length - 1].e - spoken[0].s : 0);

/**
 * When the voice runs longer than the target length, how many words the script may keep
 * (scaled by the measured pace, 4% margin). null = it fits.
 */
export function wordsToFit(spoken, lengthSec) {
  const room = lengthSec - END_HOLD_SEC;
  const took = spokenSeconds(spoken);
  if (took <= room + OVERRUN_SEC) return null;
  return Math.floor((spoken.length * room * 0.96) / took);
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
 * The clip to ask for per segment (framesOf): whole seconds within the model's range,
 * and the speed factor the stitch applies to fit it to its share of the beat exactly
 * (factor > 1 = played faster). verbAtSec is on the clip's own clock (the verb lands
 * in the whole clip or in part "a" of a far jump).
 */
export function clipTimings(placed, segments = placed.map((_, i) => ({ beat: i, part: "whole", frac: 1 }))) {
  return segments.map((seg) => {
    const p = placed[seg.beat];
    const d = p.duration * seg.frac;
    const clipSec = Math.min(MODELS.clip.maxSec, Math.max(seg.part === "whole" ? 2 : 1, Math.round(d)));
    const speed = round(clipSec / d, 4);
    const verbAt = seg.part === "b" ? null : Math.min(p.verbAt, d - 0.3);
    return { beat: seg.beat, part: seg.part, durationSec: round(d), clipSec, speed, verbAtSec: verbAt == null ? null : round(Math.max(0.2, verbAt) * speed) };
  });
}

/**
 * The sound, chime and card timeline on the final clock.
 * placed: beat times (placeBeats/evenBeats); finalWords: the voice's words on the final clock ([] without a voice).
 * Returns {chimes: [sec], cards: [{text, s, e}], sfx: [{key, text, start, duration|null}]}.
 */
export function cueTimeline(plan, placed, finalWords = []) {
  const bare = (x) => String(x).toLowerCase().replace(/[^a-z0-9']/g, "");
  const counts = plan.beats.map((b) => words(b.text).length);
  const beatWords = [];
  let cursor = 0;
  counts.forEach((c) => { beatWords.push(finalWords.slice(cursor, cursor + c)); cursor += c; });
  const timeOf = (i, word, fallback) => (beatWords[i] ?? []).find((w) => bare(w.w) === bare(word))?.s ?? fallback;
  const chimes = [];
  const cards = [];
  const sfx = [];
  // chime on every "This is a" / "That is a" name and on "Congratulations"
  finalWords.forEach((w, k) => {
    const a = bare(w.w), b = bare(finalWords[k + 1]?.w ?? "");
    if ((a === "this" || a === "that") && b === "is") chimes.push(w.s);
    if (a === "congratulations") chimes.push(w.s);
  });
  plan.beats.forEach((b, i) => {
    const p = placed[i];
    const verbAt = p.start + p.verbAt;
    if (b.card) {
      const s = timeOf(i, b.card.word, verbAt);
      cards.push({ text: b.card.text, s: round(s), e: round(s + 1.8) });
      chimes.push(s);
    }
    if (b.sound) {
      const start = b.sound.at === "start" ? p.start + 0.05 : timeOf(i, b.verb, verbAt);
      // Short effects only (<= 1.4 s); rain is the one long sound, fading in and out softly.
      const rain = b.sound.key === "rain";
      sfx.push({ key: b.sound.key, text: b.sound.text, start: round(start), duration: rain ? round(Math.max(1.5, p.end - start)) : MAX_SFX_SEC, soft: rain });
    }
  });
  // Sparse (owner, 2026-10-19): at most one effect every ~6 s; the earlier one wins.
  const sparse = [];
  for (const c of sfx.sort((a, b) => a.start - b.start)) if (!sparse.length || c.start - sparse.at(-1).start >= SFX_GAP_SEC) sparse.push(c);
  sfx.length = 0;
  sfx.push(...sparse);
  // without a voice: chime at the start of the naming beats and the last beat
  if (!finalWords.length) plan.beats.forEach((b, i) => { if (/\b(this|that) is\b/i.test(b.text) || /congratulations/i.test(b.text)) chimes.push(placed[i].start + 0.2); });
  const uniq = [...new Set(chimes.map((t) => round(t)))].sort((x, y) => x - y).filter((t, k, arr) => k === 0 || t - arr[k - 1] > 0.4);
  return { chimes: uniq, cards, sfx };
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
