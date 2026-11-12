// Blocky Worlds "backrooms" music beds (SOUND agent): five ORIGINAL plinky, looping, slightly eerie tracks in the
// feel the reference videos use (music box / celesta / bell / toy piano / chip pulse over a soft low pad or pulse,
// muffled, with tape wobble). Our own motifs, written note by note below; no samples, nothing copied.
// See reference/blocky-worlds/audio-only/NOTES.md for the measurements these follow.
//
//   import { renderLoop, renderEnding, renderBed, OPTION_IDS } from "./audio/backrooms.mjs";
//   renderLoop("A")                      -> { L, R, sr, seconds }   one exact, seamless cycle (all tails wrapped in)
//   renderEnding("A")                    -> { L, R, sr, seconds, hitAt }  starts where a cycle ends: 1 bar + final note + tail
//   await renderBed({ option: "A", seconds: 113.3, out: "music.wav" })   full-length bed: the loop + a clean ending
//
// CLI: node audio/backrooms.mjs <outDir> [A-E|all]  -> <outDir>/<id>.wav (the 10 s loop), <id>_end.wav,
//      <id>_demo.wav (loop x2 + ending) and mp3 copies of each.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeWav } from "../lib/audioWav.mjs";
import { rng } from "../lib/rng.js";

export const SR = 44100;
const TAU = 2 * Math.PI;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const R_ = null; // a rest in a pattern

// ---------------------------------------------------------------- the five options
// root: MIDI of the key's tonic (lead offsets are semitones from it). chords: one root offset per bar (pad + sub).
// chordTones: semitone offsets above the chord root for the pad. lead: per bar, `steps` entries (null = rest).
export const OPTIONS = {
  A: {
    name: "Music box, A minor, 96 bpm",
    about: "a wind-up music box playing a rocking 8th-note figure (i - VI - iv - V), warm low pad, soft sub on 1 and 3, muffled + tape wobble",
    bpm: 96, bars: 4, steps: 8, root: 57,
    chords: [0, -4, -7, -5], chordTones: [[0, 3, 7], [0, 4, 7], [0, 3, 7], [0, 4, 7]],
    lead: [
      [24, 19, 15, 19, 22, 19, 15, 19],
      [20, 15, 12, 15, 19, 15, 12, 15],
      [24, 20, 17, 20, 22, 20, 17, 15],
      [23, 19, 14, 19, 22, 21, 19, 14],
    ],
    leadVoice: "musicBox", leadGain: 0.30,
    counter: { voice: "celesta", gain: 0.10, notes: [[0, 0, 31], [2, 0, 27], [3, 4, 26]] },   // [bar, step, offset]
    pad: { gain: 0.1, octave: -12, cutoff: 700 },
    sub: { gain: 0.5, beats: [0, 2], octave: -24 },
    decay: 0.6, lowpass: 4200, wobbleCents: 7, wobbleHz: 0.45, flutterCents: 1.5, reverb: { size: 0.84, mix: 0.16 },
    echo: { beats: 0.75, fb: 0.22, mix: 0.12 }, hiss: 0.0016, drive: 1.2,
  },
  B: {
    name: "Chip pulse, D minor, 144 bpm",
    about: "a thin 12.5% pulse lead with a game-console echo, stepped triangle bass, faint noise ticks; like an old handheld left on in an empty mall",
    bpm: 144, bars: 6, steps: 8, root: 62,
    chords: [0, 0, -4, -4, -7, -5], chordTones: [[0, 3, 7], [0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 3, 7], [0, 4, 7]],
    lead: [
      [12, R_, 7, 12, 15, R_, 14, 12],
      [12, R_, 7, 12, 19, 17, 15, 14],
      [15, R_, 8, 15, 20, R_, 19, 15],
      [15, R_, 8, 15, 20, 19, 15, 12],
      [17, R_, 12, 17, 20, R_, 19, 17],
      [11, 14, 19, 14, 11, 14, 19, 23],
    ],
    leadVoice: "pulse", leadGain: 0.085, duty: 0.125,
    bass: { voice: "triangle", gain: 0.05, steps: [0, 2, 4, 6], octave: -24 },
    ticks: { gain: 0.012, steps: [2, 6] },
    sub: null, pad: null,
    lowpass: 3800, wobbleCents: 4, wobbleHz: 0.3, flutterCents: 1, reverb: { size: 0.8, mix: 0.12 },
    echo: { beats: 1.5, fb: 0.25, mix: 0.25 }, hiss: 0.0012, drive: 1.0,
  },
  C: {
    name: "Celesta + bass pulse, C# minor, 72 bpm",
    about: "a celesta tumbling in 16ths over a 3-bar cycle (odd length, so it never quite settles), a soft heartbeat sub pulse, dark pad",
    bpm: 72, bars: 3, steps: 16, root: 61,
    chords: [0, -4, -5], chordTones: [[0, 3, 7], [0, 4, 7], [0, 4, 7]],
    lead: [
      [12, R_, 7, 3, R_, 7, 12, R_, 15, R_, 7, 3, R_, 7, 10, R_],
      [20, R_, 15, 12, R_, 15, 20, R_, 19, R_, 15, 12, R_, 15, 17, R_],
      [19, R_, 14, 11, R_, 14, 19, R_, 23, R_, 19, 14, R_, 11, 7, R_],
    ],
    leadVoice: "celesta", leadGain: 0.26,
    pad: { gain: 0.1, octave: -12, cutoff: 600 },
    sub: { gain: 0.6, beats: [0, 0.75, 2, 2.75], accents: [1, 0.55, 0.85, 0.5], octave: -24 },
    decay: 0.55, lowpass: 3600, wobbleCents: 5, wobbleHz: 0.35, flutterCents: 1.2, reverb: { size: 0.86, mix: 0.2 },
    echo: { beats: 0.75, fb: 0.2, mix: 0.1 }, hiss: 0.0014, drive: 1.15,
  },
  D: {
    name: "Toy piano, G minor, 120 bpm",
    about: "a slightly out-of-tune toy piano with heavy tape wobble, note pairs that tap the same key twice, a 5-bar cycle, very lo-fi",
    bpm: 120, bars: 5, steps: 8, root: 55,
    chords: [0, -4, -7, -5, -5], chordTones: [[0, 3, 7], [0, 4, 7], [0, 3, 7], [0, 4, 7], [0, 4, 10]],
    lead: [
      [19, 19, 15, R_, 19, 19, 14, R_],
      [20, 20, 15, R_, 20, 20, 12, R_],
      [17, 17, 12, R_, 20, 17, 15, R_],
      [23, 23, 19, R_, 17, 14, 11, R_],
      [11, R_, 14, R_, 17, R_, 19, R_],
    ],
    leadVoice: "toyPiano", leadGain: 0.24,
    pad: { gain: 0.085, octave: -12, cutoff: 520 },
    sub: { gain: 0.5, beats: [0, 2.5], octave: -24 },
    decay: 0.6, lowpass: 3000, wobbleCents: 14, wobbleHz: 0.7, flutterCents: 3, reverb: { size: 0.82, mix: 0.16 },
    echo: { beats: 1, fb: 0.2, mix: 0.1 }, hiss: 0.0026, drive: 1.6,
  },
  E: {
    name: "Kalimba + glockenspiel, B minor, 96 bpm",
    about: "a kalimba ostinato in 8ths with a slow glockenspiel tune floating above it, soft sub on 1, airy and a bit sad",
    bpm: 96, bars: 4, steps: 8, root: 59,
    chords: [0, -4, 3, -5], chordTones: [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]],
    lead: [
      [12, 19, 15, 19, 12, 19, 15, 19],
      [8, 15, 12, 15, 8, 15, 12, 15],
      [15, 22, 19, 22, 15, 22, 19, 22],
      [11, 19, 14, 19, 11, 19, 14, 19],
    ],
    leadVoice: "kalimba", leadGain: 0.34,
    counter: { voice: "glock", gain: 0.085, notes: [[0, 0, 31], [0, 5, 29], [0, 6, 27], [1, 0, 27], [1, 4, 24], [2, 0, 22], [2, 3, 24], [2, 4, 27], [2, 6, 29], [3, 0, 26], [3, 4, 23], [3, 7, 19]] },
    pad: { gain: 0.09, octave: -12, cutoff: 650 },
    sub: { gain: 0.5, beats: [0, 2], octave: -24 },
    decay: 0.75, lowpass: 4600, wobbleCents: 6, wobbleHz: 0.4, flutterCents: 1.2, reverb: { size: 0.85, mix: 0.2 },
    echo: { beats: 0.75, fb: 0.22, mix: 0.12 }, hiss: 0.0014, drive: 1.1,
  },
};
export const OPTION_IDS = Object.keys(OPTIONS);

export function timing(id) {
  const o = OPTIONS[id];
  if (!o) throw new Error(`backrooms: unknown option "${id}" (${OPTION_IDS.join(", ")})`);
  const beat = 60 / o.bpm, bar = beat * 4, stepSec = bar / o.steps;
  return { beat, bar, stepSec, loopSec: bar * o.bars, loopN: Math.round(bar * o.bars * SR) };
}

// ---------------------------------------------------------------- voices (add into a stereo bus with a reverb send)
function bus(n) { return { L: new Float32Array(n), R: new Float32Array(n), sL: new Float32Array(n), sR: new Float32Array(n), eL: new Float32Array(n), eR: new Float32Array(n) }; }
const panGains = (pan) => [Math.cos((pan + 1) * Math.PI / 4), Math.sin((pan + 1) * Math.PI / 4)];

/** Add a mono signal (Float32Array) at sample i0 into the bus. */
function place(b, i0, sig, { pan = 0, send = 0.3, echo = 0 }) {
  const [gl, gr] = panGains(pan), n = b.L.length;
  for (let k = 0; k < sig.length; k++) {
    const i = i0 + k; if (i < 0) continue; if (i >= n) break;
    const v = sig[k];
    b.L[i] += v * gl; b.R[i] += v * gr;
    if (send) { b.sL[i] += v * gl * send; b.sR[i] += v * gr * send; }
    if (echo) { b.eL[i] += v * gl * echo; b.eR[i] += v * gr * echo; }
  }
}

/** Struck/plucked additive tone. partials: [ratio, amp, decaySec]. bend: initial pitch offset (ratio) decaying in bendT. */
function strike(f, partials0, { dm = 1, attack = 0.0015, len = null, bend = 0, bendT = 0.02, noteOff = null, release = 0.06 } = {}) {
  const partials = partials0.map(([a, b, c]) => [a, b, c * dm]);
  const maxDec = Math.max(...partials.map((p) => p[2]));
  const n = Math.round(Math.min(4.5, len ?? maxDec * 5) * SR);
  const out = new Float32Array(n);
  for (const [ratio, amp, dec] of partials) {
    const fp = f * ratio; if (fp > SR * 0.45) continue;
    const d = Math.exp(-1 / (dec * SR));
    let e = amp, ph = 0;
    for (let k = 0; k < n; k++) {
      const fk = bend ? fp * (1 + bend * Math.exp(-k / (bendT * SR))) : fp;
      ph += TAU * fk / SR;
      out[k] += Math.sin(ph) * e; e *= d;
      if (e < 1e-5) break;
    }
  }
  const a = Math.max(1, Math.round(attack * SR)), off = noteOff != null ? Math.round(noteOff * SR) : null, rel = Math.round(release * SR);
  for (let k = 0; k < n; k++) {
    let g = k < a ? k / a : 1;
    if (off != null && k > off) g *= Math.max(0, 1 - (k - off) / rel);
    out[k] *= g;
  }
  return out;
}

/** a few ms of filtered noise: the mechanism's click / the hammer */
function click(len, hp, gain, r) {
  const n = Math.round(len * SR), out = new Float32Array(n);
  let x1 = 0, y1 = 0;
  for (let k = 0; k < n; k++) { const x = r() * 2 - 1; const y = hp * (y1 + x - x1); x1 = x; y1 = y; out[k] = y * gain * Math.exp(-k / (n * 0.25)); }
  return out;
}
function addInto(a, b, off = 0) { for (let k = 0; k < b.length && k + off < a.length; k++) a[k + off] += b[k]; return a; }

const VOICES = {
  // comb tine: strong fundamental, a weak octave, inharmonic upper modes that die fast, + a second tine 2.5 cents sharp (shimmer)
  musicBox(f, r, dm = 1) {
    const s = strike(f, [[1, 1, 0.9], [2.0, 0.16, 0.28], [3.0, 0.05, 0.15], [5.43, 0.11, 0.05], [8.6, 0.04, 0.025]], { attack: 0.001, dm });
    addInto(s, strike(f * 2 ** (2.5 / 1200), [[1, 0.35, 0.8]], { attack: 0.002, dm }));
    return addInto(s, click(0.004, 0.6, 0.12, r));
  },
  celesta(f, r, dm = 1) {
    const s = strike(f, [[1, 1, 1.1], [2, 0.28, 0.4], [3, 0.07, 0.22], [4.02, 0.04, 0.12], [6.9, 0.02, 0.05]], { attack: 0.002, dm });
    return addInto(s, click(0.006, 0.3, 0.05, r));
  },
  glock(f, r, dm = 1) {
    const s = strike(f, [[1, 1, 1.6], [2.76, 0.42, 0.45], [5.4, 0.18, 0.15], [8.93, 0.07, 0.06]], { attack: 0.0008, dm });
    return addInto(s, click(0.003, 0.8, 0.08, r));
  },
  kalimba(f, r, dm = 1) {
    const s = strike(f, [[1, 1, 0.65], [5.95, 0.18, 0.05], [15.2, 0.05, 0.015], [2.01, 0.06, 0.2]], { attack: 0.0015, bend: 0.012, bendT: 0.015, dm });
    return addInto(s, click(0.005, 0.4, 0.06, r));
  },
  // toy piano: metal rods, a few inharmonic partials, two strikes slightly apart in pitch; each key carries a fixed mistuning
  toyPiano(f, r, dm = 1) {
    const s = strike(f, [[1, 1, 0.7], [2.0, 0.42, 0.3], [3.02, 0.22, 0.18], [4.18, 0.16, 0.09], [6.3, 0.08, 0.04], [1.0045, 0.45, 0.6]], { attack: 0.001, dm });
    return addInto(s, click(0.006, 0.5, 0.1, r));
  },
};

/** chip pulse (polyBLEP), duty 12.5%, a gate envelope with a little decay; length = gate */
function pulse(f, gate, duty) {
  const n = Math.round((gate + 0.03) * SR), out = new Float32Array(n);
  const dt = f / SR; let ph = 0;
  const blep = (t) => { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; };
  for (let k = 0; k < n; k++) {
    let v = ph < duty ? 1 : -1;
    v += blep(ph); let t2 = ph - duty; if (t2 < 0) t2 += 1; v -= blep(t2);
    ph += dt; if (ph >= 1) ph -= 1;
    const t = k / SR;
    let env = Math.min(1, t / 0.002) * (0.55 + 0.45 * Math.exp(-t / 0.07));
    if (t > gate) env *= Math.max(0, 1 - (t - gate) / 0.03);
    // 4-bit volume steps, like the console's envelope
    out[k] = (v - (2 * duty - 1)) * Math.round(env * 15) / 15;
  }
  return out;
}
/** 4-bit stepped triangle bass */
function triangle(f, gate) {
  const n = Math.round((gate + 0.02) * SR), out = new Float32Array(n);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    ph += f / SR; if (ph >= 1) ph -= 1;
    const tri = ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4;
    const t = k / SR, env = t > gate ? Math.max(0, 1 - (t - gate) / 0.02) : 1;
    out[k] = Math.round(tri * 7.5) / 7.5 * env;
  }
  return out;
}
/** soft sub pulse: a sine with a small pitch drop, ~0.5 s */
function subPulse(f, accent = 1) {
  const n = Math.round(0.7 * SR), out = new Float32Array(n);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph += TAU * f * (1 + 0.12 * Math.exp(-t / 0.03)) / SR;
    out[k] = (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) * (t < 0.018 ? 0.5 - 0.5 * Math.cos(Math.PI * t / 0.018) : 1) * Math.exp(-t / 0.2) * accent;
  }
  return out;
}
/** warm pad: 3 detuned saws per note, two one-pole low-passes, slow attack/release */
function pad(freqs, dur, cutoff, r) {
  const rel = 0.8, n = Math.round((dur + rel) * SR), out = new Float32Array(n);
  for (const f of freqs) {
    for (const det of [-6, 0, 6.5]) {
      const ff = f * 2 ** (det / 1200); let ph = r(), y1 = 0, y2 = 0;
      const a = 1 - Math.exp(-TAU * cutoff / SR);
      for (let k = 0; k < n; k++) {
        ph += ff / SR; if (ph >= 1) ph -= 1;
        const x = 2 * ph - 1; y1 += a * (x - y1); y2 += a * (y1 - y2);
        const t = k / SR;
        const env = Math.min(1, t / 0.5) * (t > dur ? Math.max(0, 1 - (t - dur) / rel) : 1);
        out[k] += y2 * env / 3;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- effects
export function biquadLP(x, fc, q = 0.707) {
  const w = TAU * fc / SR, al = Math.sin(w) / (2 * q), c = Math.cos(w);
  const b0 = (1 - c) / 2 / (1 + al), b1 = (1 - c) / (1 + al), a1 = -2 * c / (1 + al), a2 = (1 - al) / (1 + al);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let k = 0; k < x.length; k++) { const v = x[k], y = b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[k] = y; }
}
export function biquadHP(x, fc, q = 0.707) {
  const w = TAU * fc / SR, al = Math.sin(w) / (2 * q), c = Math.cos(w);
  const b0 = (1 + c) / 2 / (1 + al), b1 = -(1 + c) / (1 + al), a1 = -2 * c / (1 + al), a2 = (1 - al) / (1 + al);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let k = 0; k < x.length; k++) { const v = x[k], y = b0 * v + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[k] = y; }
}
/** Freeverb: 8 damped combs + 4 allpasses */
export function freeverb(input, { size = 0.84, damp = 0.3, spread = 0 } = {}) {
  const n = input.length, out = new Float32Array(n);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((l) => ({ buf: new Float32Array(l + spread), i: 0, f: 0 }));
  const aps = [556, 441, 341, 225].map((l) => ({ buf: new Float32Array(l + spread), i: 0 }));
  for (let k = 0; k < n; k++) {
    const x = input[k] * 0.015;
    let s = 0;
    for (const c of combs) { const y = c.buf[c.i]; c.f = y * (1 - damp) + c.f * damp; c.buf[c.i] = x + c.f * size; if (++c.i >= c.buf.length) c.i = 0; s += y; }
    for (const a of aps) { const bo = a.buf[a.i]; a.buf[a.i] = s + bo * 0.5; if (++a.i >= a.buf.length) a.i = 0; s = bo - s; }
    out[k] = s;
  }
  return out;
}
/** ping-pong echo with a darkening feedback path; returns the wet signal */
function echoWet(inL, inR, delaySec, fb) {
  const d = Math.round(delaySec * SR), n = inL.length;
  const wL = new Float32Array(n), wR = new Float32Array(n);
  let lpL = 0, lpR = 0; const a = 0.35;
  for (let k = 0; k < n; k++) {
    const pl = k >= d ? wR[k - d] : 0, pr = k >= d ? wL[k - d] : 0;   // cross-feed = ping-pong
    lpL += a * (pl - lpL); lpR += a * (pr - lpR);
    wL[k] = (k >= d ? inL[k - d] : 0) + lpL * fb;
    wR[k] = lpR * fb + (k >= d ? inR[k - d] * 0.3 : 0);
  }
  return [wL, wR];
}
/** tape wow + flutter: a modulated fractional delay (rates chosen to repeat exactly every `period` seconds) */
function wobble(x, { cents, hz, flutterCents, period }, phase = 0) {
  const n = x.length, out = new Float32Array(n);
  const wHz = Math.max(1, Math.round(hz * period)) / period, fHz = Math.max(1, Math.round(5.3 * period)) / period;
  // pitch deviation of a delay mod depth A at rate w: ratio ~ A*2*pi*w  -> A = (2^(c/1200)-1)/(2*pi*w)
  const Aw = (2 ** (cents / 1200) - 1) / (TAU * wHz) * SR, Af = (2 ** (flutterCents / 1200) - 1) / (TAU * fHz) * SR;
  const base = Aw + Af + 4;
  for (let k = 0; k < n; k++) {
    const t = (k + phase) / SR;
    const d = base + Aw * Math.sin(TAU * wHz * t) + Af * Math.sin(TAU * fHz * t + 1.3);
    const p = k - d; const i = Math.floor(p), fr = p - i;
    out[k] = i >= 1 ? x[i] * (1 - fr) + x[i + 1] * fr : 0;
  }
  return out;
}

// ---------------------------------------------------------------- sequencing
/**
 * Note events for `nBars` bars of the option's cycle starting at bar index `fromBar` (bar 0 = cycle start), at time t0.
 * hitAtBar: when set, bar number (relative) where the final cadence lands; nothing of the pattern plays from there on.
 */
function events(id, nBars, { hitAtBar = null } = {}) {
  const o = OPTIONS[id], { beat, bar, stepSec } = timing(id);
  const ev = [];
  const playBars = hitAtBar ?? nBars;
  for (let bi = 0; bi < playBars; bi++) {
    const b = bi % o.bars, t0 = bi * bar, chord = o.chords[b];
    o.lead[b].forEach((m, s) => { if (m != null) ev.push({ t: t0 + s * stepSec, kind: "lead", midi: o.root + m, step: s, bar: b }); });
    if (o.counter) for (const [cb, cs, m] of o.counter.notes) if (cb === b) ev.push({ t: t0 + cs * stepSec, kind: "counter", midi: o.root + m });
    if (o.pad && (b === 0 || o.chords[b] !== o.chords[b - 1] || bi === 0)) {
      let len = 1; while (b + len < o.bars && o.chords[b + len] === chord && JSON.stringify(o.chordTones[b + len]) === JSON.stringify(o.chordTones[b])) len++;
      ev.push({ t: t0, kind: "pad", midis: o.chordTones[b].map((x) => o.root + o.pad.octave + chord + x), dur: Math.min(len, playBars - bi) * bar - 0.15 });
    }
    if (o.sub) o.sub.beats.forEach((bt, j) => ev.push({ t: t0 + bt * beat, kind: "sub", midi: o.root + o.sub.octave + chord, accent: o.sub.accents?.[j] ?? (j === 0 ? 1 : 0.75) }));
    if (o.bass) o.bass.steps.forEach((s) => ev.push({ t: t0 + s * stepSec, kind: "bass", midi: o.root + o.bass.octave + chord + (s === 4 ? 7 : 0), gate: stepSec * 0.8 }));
    if (o.ticks) o.ticks.steps.forEach((s) => ev.push({ t: t0 + s * stepSec, kind: "tick" }));
  }
  if (hitAtBar != null) {
    const t = hitAtBar * bar, r = o.root;
    // the final cadence: the tonic rolled upward like a music box winding down, a low tonic, a long tail
    [12, 19, 24].forEach((m, j) => ev.push({ t: t + j * 0.045, kind: "final", midi: r + m, gainMul: [1, 0.7, 0.8][j] }));
    if (o.sub) ev.push({ t, kind: "sub", midi: r + o.sub.octave, accent: 1 });
    if (o.bass) ev.push({ t, kind: "bass", midi: r + o.bass.octave, gate: beat * 2 });
    if (o.pad) ev.push({ t, kind: "pad", midis: [0, 3, 7].map((x) => r + o.pad.octave + x), dur: beat * 3 });
  }
  return ev;
}

/** Synthesize events into a stereo buffer of n samples (everything post-processed). phase: sample offset for LFOs. */
function synth(id, ev, n, seed = 1) {
  const o = OPTIONS[id], { beat, loopSec } = timing(id);
  const b = bus(n), r = rng(seed);
  // per-key fixed mistuning for the toy piano (the same key is always the same amount off)
  const tune = (m) => (o.leadVoice === "toyPiano" ? ((m * 7919) % 23 - 11) * 1.1 : 0);
  for (const e of ev) {
    const i0 = Math.round(e.t * SR);
    if (e.kind === "lead" || e.kind === "final") {
      const pan = e.kind === "final" ? 0 : ((e.midi * 37) % 9 - 4) * 0.06;
      let sig;
      if (o.leadVoice === "pulse") sig = pulse(mtof(e.midi), e.kind === "final" ? 0.9 : timing(id).stepSec * 0.75, o.duty).map((v) => v * o.leadGain * (e.gainMul ?? 1));
      else {
        const vel = e.kind === "final" ? (e.gainMul ?? 1) : (e.step % 2 === 0 ? 1 : 0.78) * (0.92 + 0.16 * r());
        sig = VOICES[o.leadVoice](mtof(e.midi) * 2 ** (tune(e.midi) / 1200), r, e.kind === "final" ? 2.2 : (o.decay ?? 1)).map((v) => v * o.leadGain * vel);
      }
      place(b, i0, sig, { pan, send: 0.5, echo: 1 });
    } else if (e.kind === "counter") {
      place(b, i0, VOICES[o.counter.voice](mtof(e.midi), r, o.counter.decay ?? 1).map((v) => v * o.counter.gain), { pan: 0.35, send: 0.7, echo: 0.6 });
    } else if (e.kind === "pad") {
      place(b, i0, pad(e.midis.map(mtof), e.dur, o.pad.cutoff, r).map((v) => v * o.pad.gain), { pan: 0, send: 0.6 });
    } else if (e.kind === "sub") {
      { const sp = subPulse(mtof(e.midi), e.accent); biquadLP(sp, 130); biquadLP(sp, 130); place(b, i0, sp.map((v) => v * o.sub.gain), { pan: 0, send: 0.05 }); }
    } else if (e.kind === "bass") {
      place(b, i0, triangle(mtof(e.midi), e.gate).map((v) => v * o.bass.gain), { pan: 0, send: 0.08 });
    } else if (e.kind === "tick") {
      place(b, i0, click(0.03, 0.92, o.ticks.gain * 6, r), { pan: 0.4, send: 0.2 });
    }
  }
  // echo -> into dry and the reverb send
  const [wL, wR] = echoWet(b.eL, b.eR, o.echo.beats * beat, o.echo.fb);
  for (let k = 0; k < n; k++) { b.L[k] += wL[k] * o.echo.mix; b.R[k] += wR[k] * o.echo.mix; b.sL[k] += wL[k] * o.echo.mix * 0.5; b.sR[k] += wR[k] * o.echo.mix * 0.5; }
  const rvL = freeverb(b.sL, { size: o.reverb.size }), rvR = freeverb(b.sR, { size: o.reverb.size, spread: 23 });
  let L = new Float32Array(n), R = new Float32Array(n);
  for (let k = 0; k < n; k++) { L[k] = b.L[k] + rvL[k] * o.reverb.mix * 4; R[k] = b.R[k] + rvR[k] * o.reverb.mix * 4; }
  // tape: wobble, soft saturation, muffled top, rumble out
  const wob = { cents: o.wobbleCents, hz: o.wobbleHz, flutterCents: o.flutterCents, period: loopSec };
  L = wobble(L, wob); R = wobble(R, wob, 0);
  for (const ch of [L, R]) {
    const dz = o.drive * 0.4; for (let k = 0; k < n; k++) ch[k] = Math.tanh(ch[k] * dz) / dz;
    biquadLP(ch, o.lowpass, 0.6); biquadLP(ch, o.lowpass * 1.6, 0.5); biquadHP(ch, 38);
  }
  return { L, R };
}

/** periodic tape hiss of exactly `period` samples (filtered twice around so it wraps without a seam) */
function hissLoop(period, level, seed = 9) {
  const r = rng(seed), w = new Float32Array(period);
  for (let k = 0; k < period; k++) w[k] = r() * 2 - 1;
  const out = new Float32Array(period);
  let a = 0, b2 = 0, hp1 = 0, hx = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < period; k++) {
      a += 0.35 * (w[k] - a); b2 += 0.35 * (a - b2);                // soft low-pass ~4 kHz
      const h = 0.97 * (hp1 + b2 - hx); hx = b2; hp1 = h;           // high-pass ~200 Hz
      if (pass === 1) out[k] = h * level;
    }
  }
  return out;
}

// ---------------------------------------------------------------- public renders
/** One exact cycle in steady state: render 2 cycles, keep the second (tails from the first wrap in naturally). */
export function renderLoop(id, { seed = 1 } = {}) {
  const o = OPTIONS[id], { loopSec, loopN } = timing(id);
  const ev = events(id, o.bars * 2);
  const { L, R } = synth(id, ev, loopN * 2, seed);
  const outL = L.slice(loopN), outR = R.slice(loopN);
  const h = hissLoop(loopN, o.hiss), h2 = hissLoop(loopN, o.hiss, 11);
  for (let k = 0; k < loopN; k++) { outL[k] += h[k]; outR[k] += h2[k]; }
  return { L: outL, R: outR, sr: SR, seconds: loopN / SR, loopSec };
}

/** The ending: picks up exactly where a cycle ends, plays one more bar, then the final cadence and its tail. */
export function renderEnding(id, { seed = 1, tail = 3.2 } = {}) {
  const o = OPTIONS[id], { bar, loopN } = timing(id);
  const ev = events(id, o.bars * 2 + 1, { hitAtBar: o.bars * 2 + 1 });
  const total = loopN * 2 + Math.round((bar + tail) * SR);
  const { L, R } = synth(id, ev, total, seed);
  const outL = L.slice(loopN * 2), outR = R.slice(loopN * 2);
  const h = hissLoop(loopN, o.hiss), h2 = hissLoop(loopN, o.hiss, 11);
  for (let k = 0; k < outL.length; k++) { const g = Math.max(0, 1 - Math.max(0, k / SR - bar - 1.0) / (tail - 1.0)); outL[k] += h[k % loopN] * g; outR[k] += h2[k % loopN] * g; }
  fadeTail(outL, outR, 0.6);
  return { L: outL, R: outR, sr: SR, seconds: outL.length / SR, hitAt: bar };
}

function fadeTail(L, R, sec) {
  const n = L.length, f = Math.round(sec * SR);
  for (let k = Math.max(0, n - f); k < n; k++) { const g = ((n - k) / f) ** 2; L[k] *= g; R[k] *= g; }
}

/**
 * A full-length bed of exactly `seconds`: the option's pattern from the top, its final cadence landing on the last bar
 * line that leaves >= minTail seconds, then the tail with a short fade. Deterministic. Returns { L, R, hitAt }.
 */
export function bedBuffers(id, seconds, { seed = 1, minTail = 1.8, fadeIn = 0.25 } = {}) {
  const o = OPTIONS[id], { bar, loopN } = timing(id);
  const n = Math.round(seconds * SR);
  let hitBar = Math.floor((seconds - minTail) / bar);
  if (hitBar < 1) hitBar = null;               // too short for a cadence: just play and fade
  const ev = events(id, Math.ceil(seconds / bar) + 1, { hitAtBar: hitBar });
  const { L, R } = synth(id, ev, n, seed);
  const h = hissLoop(loopN, o.hiss), h2 = hissLoop(loopN, o.hiss, 11);
  for (let k = 0; k < n; k++) { L[k] += h[k % loopN]; R[k] += h2[k % loopN]; }
  const fi = Math.round(fadeIn * SR);
  for (let k = 0; k < fi && k < n; k++) { const g = k / fi; L[k] *= g; R[k] *= g; }
  fadeTail(L, R, hitBar == null ? 2.0 : Math.min(0.8, seconds - hitBar * bar));
  return { L, R, hitAt: hitBar == null ? null : hitBar * bar };
}

/** normalize a stereo pair so its RMS is `rmsDb` (peak capped at -1 dBFS) */
export function normalize(L, R, rmsDb = -20) {
  let s = 0, pk = 0;
  for (let k = 0; k < L.length; k++) { s += L[k] * L[k] + R[k] * R[k]; pk = Math.max(pk, Math.abs(L[k]), Math.abs(R[k])); }
  const rms = Math.sqrt(s / (2 * L.length));
  let g = 10 ** (rmsDb / 20) / Math.max(rms, 1e-9);
  if (pk * g > 10 ** (-1 / 20)) g = 10 ** (-1 / 20) / pk;
  for (let k = 0; k < L.length; k++) { L[k] *= g; R[k] *= g; }
  return g;
}

/** The loop's gain to -20 dB RMS: the bed, loop and ending all use the same gain so they match. */
function optionGain(id) {
  const { L, R } = renderLoop(id);
  return normalize(L, R, -20);
}

/** Write a full-length bed wav for an option (A-E). Returns { out, seconds, hitAt, option }. */
export async function renderBed({ option = "A", seconds, out = "music.wav", seed = 1 }) {
  if (!OPTIONS[option]) throw new Error(`renderBed: unknown option "${option}"`);
  const { L, R, hitAt } = bedBuffers(option, seconds, { seed });
  const g = optionGain(option);
  for (let k = 0; k < L.length; k++) { L[k] *= g; R[k] *= g; }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  writeWav(out, [L, R], SR);
  return { out, seconds, hitAt, option };
}

function mp3(wav) {
  const out = wav.replace(/\.wav$/, ".mp3");
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", "192k", out]);
  if (r.status !== 0) throw new Error(`mp3 failed: ${r.stderr}`);
  return out;
}

/** loop + ending + a 2-cycle demo (loop, loop, ending) for listening, all at the same gain */
export function writeOptionFiles(id, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const loop = renderLoop(id), end = renderEnding(id);
  const g = normalize(loop.L, loop.R, -20);
  for (let k = 0; k < end.L.length; k++) { end.L[k] *= g; end.R[k] *= g; }
  const files = {};
  files.loop = path.join(dir, `${id}.wav`); writeWav(files.loop, [loop.L, loop.R], SR);
  files.end = path.join(dir, `${id}_end.wav`); writeWav(files.end, [end.L, end.R], SR);
  const n = loop.L.length, m = end.L.length;
  const dL = new Float32Array(n * 2 + m), dR = new Float32Array(n * 2 + m);
  dL.set(loop.L, 0); dL.set(loop.L, n); dL.set(end.L, 2 * n); dR.set(loop.R, 0); dR.set(loop.R, n); dR.set(end.R, 2 * n);
  files.demo = path.join(dir, `${id}_demo.wav`); writeWav(files.demo, [dL, dR], SR);
  for (const k of Object.keys(files)) files[k + "Mp3"] = mp3(files[k]);
  return { id, ...OPTIONS[id], loopSec: loop.seconds, endSec: end.seconds, hitAt: end.hitAt, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [dir = "out/dev/sound/music", which = "all"] = process.argv.slice(2);
  for (const id of which === "all" ? OPTION_IDS : which.split(",")) {
    const t0 = Date.now();
    const r = writeOptionFiles(id, dir);
    console.log(`${id}: ${r.name} loop ${r.loopSec.toFixed(3)} s, ending ${r.endSec.toFixed(2)} s -> ${path.resolve(r.files.loop)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
}
