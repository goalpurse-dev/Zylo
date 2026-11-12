// Blocky Worlds music bed (AUDIO agent): synthesized in Node, our own notes, no samples, nothing copyrighted.
// An 8-bar progression per mood repeated for the whole length (deterministic from seed), a little reverb + echo done in
// code, gentle fade in/out, peak normalized to about -6 dBFS. Stereo 44.1 kHz 16-bit WAV.
//
//   import { makeMusic } from "./audio/music.mjs";
//   await makeMusic({ out: "out/x/music.wav", seconds: 98.8, mood: "horror", seed: 7 });
//
// CLI: node audio/music.mjs <outDir> [seconds=30] [mood|all] [seed]   -> <outDir>/music_<mood>.wav
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeWav } from "../lib/audioWav.mjs";
import { rng } from "../lib/rng.js";

const SR = 44100;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// 8 bars each (chord = midi offsets from root)
const MOODS = {
  horror: { bpm: 66, root: 57, chords: [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-4, 0, 3], [-7, -4, 0], [-7, -4, 0], [-5, -1, 2], [-5, -1, 2]] },
  wholesome: { bpm: 92, root: 60, chords: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0], [0, 4, 7], [-5, -1, 2], [-7, -3, 0], [-5, -1, 2]] },
  funny: { bpm: 118, root: 60, chords: [[0, 4, 7], [0, 4, 7], [-7, -3, 0], [-7, -3, 0], [-5, -1, 2], [-5, -1, 2], [0, 4, 7], [-5, -1, 2]] },
  epic: { bpm: 112, root: 50, chords: [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-4, 0, 3], [3, 7, 10], [3, 7, 10], [-2, 2, 5], [-2, 2, 5]] },
};
export const MOOD_NAMES = Object.keys(MOODS);

/** Four float buses: dry L/R and reverb send L/R. */
function buses(n) { return { L: new Float32Array(n), R: new Float32Array(n), sL: new Float32Array(n), sR: new Float32Array(n) }; }

function put(b, i, v, pan, send) {
  if (i < 0 || i >= b.L.length) return;
  const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
  b.L[i] += v * l; b.R[i] += v * r;
  if (send) { b.sL[i] += v * l * send; b.sR[i] += v * r * send; }
}

/** Additive tone: partials [[ratio, amp, decaySec|null]], attack/release envelope. */
function tone(b, t0, dur, freq, { partials = [[1, 1, null]], attack = 0.005, release = 0.1, gain = 0.2, pan = 0, send = 0.3, vibrato = 0 } = {}) {
  const i0 = Math.round(t0 * SR), n = Math.round((dur + release) * SR);
  const ph = partials.map(() => 0);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    let env = t < attack ? t / attack : 1;
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / release);
    const fm = vibrato ? 1 + vibrato * Math.sin(2 * Math.PI * 5 * t) : 1;
    let v = 0;
    for (let p = 0; p < partials.length; p++) {
      const [ratio, amp, dec] = partials[p];
      const f = freq * ratio * fm;
      if (f > SR * 0.45) continue;
      ph[p] += (2 * Math.PI * f) / SR;
      v += Math.sin(ph[p]) * amp * (dec ? Math.exp(-t / dec) : 1);
    }
    put(b, i0 + k, v * env * gain, pan, send);
  }
}

/** Karplus-Strong pluck (warm guitar/harp/pizzicato). */
function pluck(b, t0, freq, { dur = 1.2, gain = 0.25, pan = 0, send = 0.3, damp = 0.996, bright = 0.5, r }) {
  const i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  const L = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(L);
  let prev = 0;
  for (let k = 0; k < L; k++) { const w = r() * 2 - 1; prev = prev + bright * (w - prev); line[k] = prev; }
  let idx = 0;
  for (let k = 0; k < n; k++) {
    const a = line[idx], c = line[(idx + 1) % L];
    line[idx] = damp * 0.5 * (a + c);
    idx = (idx + 1) % L;
    const fade = k > n - 400 ? (n - k) / 400 : 1;
    put(b, i0 + k, a * gain * fade, pan, send);
  }
}

/** Kick / tom: sine pitch sweep. */
function kick(b, t0, { f0 = 120, f1 = 45, dur = 0.35, gain = 0.5, send = 0.05 } = {}) {
  const i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / 0.04);
    ph += (2 * Math.PI * f) / SR;
    put(b, i0 + k, Math.sin(ph) * Math.exp(-t / (dur / 4)) * gain, 0, send);
  }
}

/** Filtered noise burst: hats, shakers, ticks, snares. hp: one-pole high-pass coefficient. */
function noise(b, t0, { dur = 0.05, gain = 0.1, hp = 0.9, decay = 0.015, pan = 0, send = 0.1, body = 0, bodyF = 180, r }) {
  const i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  let x1 = 0, y1 = 0, ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = r() * 2 - 1;
    const y = hp * (y1 + x - x1); x1 = x; y1 = y;
    ph += (2 * Math.PI * bodyF) / SR;
    put(b, i0 + k, (y + body * Math.sin(ph)) * Math.exp(-t / decay) * gain, pan, send);
  }
}

/** Freeverb-lite: 4 combs + 2 allpasses per channel. */
function reverb(input, { size = 0.8, damp = 0.35, offset = 0 } = {}) {
  const n = input.length, out = new Float32Array(n);
  const combs = [1116, 1188, 1277, 1356].map((l) => ({ buf: new Float32Array(l + offset), i: 0, f: 0 }));
  const aps = [556, 441].map((l) => ({ buf: new Float32Array(l + offset), i: 0 }));
  for (let k = 0; k < n; k++) {
    const x = input[k] * 0.25;
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.f = y * (1 - damp) + c.f * damp;
      c.buf[c.i] = x + c.f * size;
      c.i = (c.i + 1) % c.buf.length;
      s += y;
    }
    for (const a of aps) {
      const bo = a.buf[a.i];
      a.buf[a.i] = s + bo * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      s = bo - s;
    }
    out[k] = s;
  }
  return out;
}

/** Feedback echo on a buffer (in place, mixed). */
function echo(buf, timeSec, fb = 0.35, mix = 0.35) {
  const d = Math.round(timeSec * SR);
  const tmp = new Float32Array(buf.length);
  for (let k = 0; k < buf.length; k++) { tmp[k] = buf[k] + (k >= d ? tmp[k - d] * fb : 0); }
  for (let k = 0; k < buf.length; k++) buf[k] = buf[k] + (tmp[k] - buf[k]) * mix;
}

const BELL = [[1, 1, 1.2], [2.76, 0.35, 0.35], [5.4, 0.15, 0.12], [8.93, 0.06, 0.05]];   // music box / glock
const XYLO = [[1, 1, 0.25], [3.93, 0.3, 0.06], [9.4, 0.08, 0.02]];
const PAD = [[1, 1, null], [2, 0.35, null], [3, 0.16, null], [4, 0.08, null], [1.005, 0.6, null], [0.5, 0.25, null]];
const BRASSY = [[1, 1, null], [2, 0.5, null], [3, 0.33, null], [4, 0.22, null], [5, 0.14, null], [6, 0.08, null]];

function compose(mood, seconds, seed) {
  const M = MOODS[mood];
  const beat = 60 / M.bpm, bar = beat * 4;
  const n = Math.ceil((seconds + 3) * SR);
  const dry = buses(n), mel = buses(n);       // mel = melody bus that gets the echo
  const nBars = Math.ceil(seconds / bar) + 1;
  // the 8-bar melody is fixed per seed, so the bed loops
  const mr = rng(seed * 101 + 7);
  const melody = Array.from({ length: 8 }, (_, bi) => Array.from({ length: 8 }, (_, e) => {
    const ch = M.chords[bi];
    const density = { horror: 0.22, wholesome: 0.32, funny: 0.5, epic: 0.18 }[mood];
    const strong = e % 2 === 0;
    if (mr() > density * (strong ? 1.6 : 0.6)) return null;
    return ch[mr.int(0, ch.length - 1)] + (mr() < 0.3 ? 12 : 0);
  }));
  const nr = rng(seed * 13 + 1);
  if (mood === "horror") {
    // low drone over the whole bed, slowly breathing
    const f = mtof(M.root - 12);
    for (let k = 0; k < n; k++) {
      const t = k / SR;
      const lfo = 0.75 + 0.25 * Math.sin(2 * Math.PI * t / 7.3);
      const v = (Math.sin(2 * Math.PI * f * t) * 0.5 + Math.sin(2 * Math.PI * f * 2.003 * t) * 0.35 + Math.sin(2 * Math.PI * f * 3.01 * t) * 0.12) * lfo * 0.07;
      put(dry, k, v, 0, 0.2);
    }
  }
  for (let bi = 0; bi < nBars; bi++) {
    const b8 = bi % 8, t0 = bi * bar, ch = M.chords[b8];
    const newChord = b8 === 0 || ch !== M.chords[b8 - 1];
    if (mood === "horror") {
      if (newChord) ch.forEach((o, j) => tone(dry, t0, bar * 2 - 0.3, mtof(M.root - 12 + o), { partials: PAD, attack: 1.2, release: 1.0, gain: 0.035, pan: (j - 1) * 0.5, send: 0.6, vibrato: 0.002 }));
      for (let e = 0; e < 8; e++) {
        const m = melody[b8][e];
        if (m != null) tone(mel, t0 + e * beat / 2, 0.05, mtof(M.root + 24 + m), { partials: BELL, attack: 0.002, release: 1.4, gain: 0.2, pan: (nr() - 0.5) * 0.6, send: 0.6 });
      }
      for (let q = 0; q < 4; q++) noise(dry, t0 + q * beat, { dur: 0.03, gain: q % 2 ? 0.05 : 0.07, hp: 0.97, decay: 0.004, pan: q % 2 ? 0.3 : -0.3, send: 0.25, body: 0.6, bodyF: q % 2 ? 1500 : 2100, r: nr });
      if (b8 === 7) kick(dry, t0 + 2 * beat, { f0: 70, f1: 38, dur: 0.6, gain: 0.25, send: 0.2 });   // a low thud before the loop turns
    } else if (mood === "wholesome") {
      if (newChord) ch.forEach((o, j) => tone(dry, t0, bar - 0.1, mtof(M.root + o), { partials: PAD, attack: 0.4, release: 0.6, gain: 0.025, pan: (j - 1) * 0.5, send: 0.5 }));
      pluck(dry, t0, mtof(M.root - 24 + ch[0]), { dur: 1.6, gain: 0.35, damp: 0.995, bright: 0.3, send: 0.15, r: nr });
      pluck(dry, t0 + 2 * beat, mtof(M.root - 24 + ch[0] + (ch[0] < -4 ? 7 : -5)), { dur: 1.4, gain: 0.28, damp: 0.995, bright: 0.3, send: 0.15, r: nr });
      const arp = [0, 1, 2, 1, 0, 1, 2, 1];
      for (let e = 0; e < 8; e++) pluck(dry, t0 + e * beat / 2, mtof(M.root + ch[arp[e]] + (e >= 4 && e % 2 === 0 ? 12 : 0)), { dur: 0.9, gain: 0.13, damp: 0.994, bright: 0.55, pan: e % 2 ? 0.35 : -0.35, send: 0.3, r: nr });
      for (let e = 0; e < 8; e++) {
        const m = melody[b8][e];
        if (m != null) tone(mel, t0 + e * beat / 2, 0.06, mtof(M.root + 12 + m), { partials: BELL, attack: 0.003, release: 1.0, gain: 0.09, pan: 0.15, send: 0.45 });
      }
      kick(dry, t0, { gain: 0.22 }); kick(dry, t0 + 2 * beat, { gain: 0.16 });
      for (let e = 0; e < 8; e++) noise(dry, t0 + e * beat / 2, { dur: 0.06, gain: e % 2 ? 0.035 : 0.02, hp: 0.95, decay: 0.018, pan: 0.4, send: 0.1, r: nr });
    } else if (mood === "funny") {
      for (let q = 0; q < 4; q++) {
        if (q % 2 === 0) pluck(dry, t0 + q * beat, mtof(M.root - 12 + ch[0] + (q === 2 ? 7 : 0)), { dur: 0.22, gain: 0.45, damp: 0.985, bright: 0.6, send: 0.05, r: nr });
        else ch.forEach((o, j) => pluck(dry, t0 + q * beat, mtof(M.root + o), { dur: 0.16, gain: 0.12, damp: 0.98, bright: 0.7, pan: (j - 1) * 0.5, send: 0.15, r: nr }));
      }
      for (let e = 0; e < 8; e++) {
        const m = melody[b8][e];
        if (m != null) tone(mel, t0 + e * beat / 2, 0.04, mtof(M.root + 12 + m), { partials: XYLO, attack: 0.001, release: 0.3, gain: 0.16, pan: -0.15, send: 0.2 });
      }
      kick(dry, t0, { f0: 140, gain: 0.25, dur: 0.22 });
      for (let e = 1; e < 8; e += 2) noise(dry, t0 + e * beat / 2, { dur: 0.05, gain: 0.07, hp: 0.6, decay: 0.01, pan: 0.3, send: 0.1, body: 0.9, bodyF: 820, r: nr });   // woodblock
      if (b8 === 7) for (let s = 0; s < 4; s++) tone(mel, t0 + 3 * beat + s * beat / 4, 0.05, mtof(M.root + 12 + [0, 4, 7, 12][s]), { partials: XYLO, release: 0.25, gain: 0.12, send: 0.2 });
    } else if (mood === "epic") {
      if (newChord) ch.forEach((o, j) => tone(dry, t0, bar * 2 - 0.2, mtof(M.root + o), { partials: BRASSY, attack: 0.8, release: 0.8, gain: 0.03, pan: (j - 1) * 0.6, send: 0.5, vibrato: 0.003 }));
      for (let e = 0; e < 8; e++) tone(dry, t0 + e * beat / 2, beat / 2 - 0.05, mtof(M.root - 12 + ch[0]), { partials: BRASSY, attack: 0.004, release: 0.06, gain: e % 2 ? 0.05 : 0.07, send: 0.1 });
      for (let e = 0; e < 8; e++) {
        const m = melody[b8][e];
        if (m != null) tone(mel, t0 + e * beat / 2, beat * 1.5, mtof(M.root + 24 + m), { partials: BRASSY.slice(0, 3), attack: 0.05, release: 0.4, gain: 0.04, pan: 0.1, send: 0.5, vibrato: 0.004 });
      }
      kick(dry, t0, { f0: 110, f1: 50, gain: 0.4, dur: 0.45, send: 0.15 });
      kick(dry, t0 + 1.5 * beat, { f0: 110, f1: 50, gain: 0.25, dur: 0.4, send: 0.15 });
      kick(dry, t0 + 2 * beat, { f0: 110, f1: 50, gain: 0.35, dur: 0.45, send: 0.15 });
      for (const q of [1, 3]) noise(dry, t0 + q * beat, { dur: 0.25, gain: 0.12, hp: 0.8, decay: 0.07, send: 0.4, body: 0.4, bodyF: 190, r: nr });
      if (b8 % 2 === 1) for (let s = 0; s < 4; s++) kick(dry, t0 + 3 * beat + s * beat / 4, { f0: 160 - s * 15, f1: 70, gain: 0.18, dur: 0.25, send: 0.2 });
    }
  }
  // melody echo (dotted eighth), then everything's send through the reverb
  echo(mel.L, beat * 0.75, 0.35, 0.4); echo(mel.R, beat * 0.5, 0.35, 0.4);
  const sendL = new Float32Array(n), sendR = new Float32Array(n);
  for (let k = 0; k < n; k++) { sendL[k] = dry.sL[k] + mel.sL[k]; sendR[k] = dry.sR[k] + mel.sR[k]; }
  const size = mood === "horror" ? 0.86 : mood === "epic" ? 0.82 : 0.75;
  const rvL = reverb(sendL, { size }), rvR = reverb(sendR, { size, offset: 23 });
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let k = 0; k < n; k++) { L[k] = dry.L[k] + mel.L[k] + rvL[k] * 0.9; R[k] = dry.R[k] + mel.R[k] + rvR[k] * 0.9; }
  return { L, R };
}

/** Render a mood bed of exactly `seconds` to a WAV. Returns { out, seconds, peakDb }. */
export async function makeMusic({ out = "music.wav", seconds = 30, mood = "horror", seed = 1, peakDb = -6, fadeIn = 1.5, fadeOut = 2.5 } = {}) {
  if (!MOODS[mood]) throw new Error(`makeMusic: unknown mood "${mood}" (${MOOD_NAMES.join(", ")})`);
  const { L, R } = compose(mood, seconds, seed);
  const n = Math.round(seconds * SR);
  const outL = L.slice(0, n), outR = R.slice(0, n);
  // gentle high-pass at ~35 Hz (phones can't play it; it only eats headroom)
  for (const ch of [outL, outR]) {
    let x1 = 0, y1 = 0; const a = 0.995;
    for (let k = 0; k < n; k++) { const x = ch[k]; const y = a * (y1 + x - x1); x1 = x; y1 = y; ch[k] = y; }
  }
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const g = Math.min(1, t / fadeIn, (seconds - t) / fadeOut);
    const s = Math.max(0, g) ** 2;
    outL[k] *= s; outR[k] *= s;
  }
  let peak = 0;
  for (let k = 0; k < n; k++) peak = Math.max(peak, Math.abs(outL[k]), Math.abs(outR[k]));
  const gain = peak > 0 ? 10 ** (peakDb / 20) / peak : 1;
  for (let k = 0; k < n; k++) { outL[k] *= gain; outR[k] *= gain; }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  writeWav(out, [outL, outR], SR);
  return { out, seconds, peakDb, mood };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [outDir = "out/dev/audio", sec = "30", which = "all", seed = "1"] = process.argv.slice(2);
  for (const mood of which === "all" ? MOOD_NAMES : [which]) {
    const t0 = Date.now();
    const r = await makeMusic({ out: path.join(outDir, `music_${mood}.wav`), seconds: Number(sec), mood, seed: Number(seed) });
    console.log(`${mood}: ${path.resolve(r.out)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
}
