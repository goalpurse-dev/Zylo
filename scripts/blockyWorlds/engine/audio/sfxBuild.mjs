// Builds the Blocky Worlds SFX set into audio/sfx/*.wav (SOUND agent). Free and local: Kenney CC0 packs from
// assets/sfx-src/ (downloaded zips, gitignored) + sounds synthesized here in code. Each file: mono 44.1 kHz 16-bit,
// silence trimmed, 5 ms fade-in / short fade-out, active-part RMS normalized to -18 dB, peak <= -1 dBFS.
// The catalog (what each file is, where it came from, its license) is audio/sfx.mjs.
//   node audio/sfxBuild.mjs            -> writes audio/sfx/*.wav and prints a table
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeWav } from "../lib/audioWav.mjs";
import { rng } from "../lib/rng.js";
import { biquadLP, biquadHP, freeverb } from "./backrooms.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ENGINE, "assets", "sfx-src");
const OUT = path.join(ENGINE, "audio", "sfx");
const SR = 44100, TAU = 2 * Math.PI;

// ---------------------------------------------------------------- helpers
/** an ElevenLabs Sound Effects take (audio/elevenSfx.mjs), decoded; null when it isn't there (then the stand-in is built) */
function eleven(name) {
  const f = path.join(SRC, "eleven", `${name}.mp3`);
  if (!fs.existsSync(f)) return null;
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", f, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`decode failed: ${f}`);
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length));
}
function kenney(rel) {
  const f = path.join(SRC, rel);
  if (!fs.existsSync(f)) throw new Error(`sfxBuild: missing ${f} (download the Kenney packs into assets/sfx-src/)`);
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", f, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`decode failed: ${f}`);
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length));
}
const zeros = (sec) => new Float32Array(Math.round(sec * SR));
function mixAt(dst, src, atSec, gain = 1) { const o = Math.round(atSec * SR); for (let k = 0; k < src.length && o + k < dst.length; k++) if (o + k >= 0) dst[o + k] += src[k] * gain; return dst; }
function resample(x, rate) { const n = Math.floor(x.length / rate), out = new Float32Array(n); for (let k = 0; k < n; k++) { const p = k * rate, i = Math.floor(p), f = p - i; out[k] = (x[i] ?? 0) * (1 - f) + (x[i + 1] ?? 0) * f; } return out; }
/** state-variable band-pass with a per-sample centre (Hz) and q */
function svfBand(x, fcAt, q = 0.7) {
  const out = new Float32Array(x.length); let low = 0, band = 0;
  for (let k = 0; k < x.length; k++) {
    const f = 2 * Math.sin(Math.PI * Math.min(fcAt(k / SR), 9000) / SR);
    low += f * band; const high = x[k] - low - q * band; band += f * high; out[k] = band;
  }
  return out;
}
/** two-pole resonator (formant) */
function reson(x, fc, bw) {
  const r = Math.exp(-Math.PI * bw / SR), a1 = -2 * r * Math.cos(TAU * fc / SR), a2 = r * r, g = 1 - r;
  const out = new Float32Array(x.length); let y1 = 0, y2 = 0;
  for (let k = 0; k < x.length; k++) { const y = g * x[k] - a1 * y1 - a2 * y2; y2 = y1; y1 = y; out[k] = y; }
  return out;
}
function formants(src, list) { const out = new Float32Array(src.length); for (const [fc, bw, g] of list) { const y = reson(src, fc, bw); for (let k = 0; k < out.length; k++) out[k] += y[k] * g; } return out; }
/** glottal-ish source: band-limited-ish saw from a per-sample f0 function, + aspiration noise */
function voiceSrc(n, f0At, { breath = 0.15, jitter = 0.01, r }) {
  const out = new Float32Array(n); let ph = 0, j = 0;
  for (let k = 0; k < n; k++) {
    if (k % 220 === 0) j = (r() * 2 - 1) * jitter;
    const f = f0At(k / SR) * (1 + j);
    ph += f / SR; if (ph >= 1) ph -= 1;
    out[k] = (2 * ph - 1) * 0.6 + (r() * 2 - 1) * breath;
  }
  biquadLP(out, 5000);
  return out;
}
const noise = (n, r) => { const o = new Float32Array(n); for (let k = 0; k < n; k++) o[k] = r() * 2 - 1; return o; };
function envApply(x, fn) { for (let k = 0; k < x.length; k++) x[k] *= fn(k / SR, x.length / SR); return x; }
function addReverb(x, mix = 0.2, size = 0.8, tail = 1.0) {
  const y = new Float32Array(x.length + Math.round(tail * SR)); y.set(x);
  const w = freeverb(y, { size });
  for (let k = 0; k < y.length; k++) y[k] += w[k] * mix * 4;
  return y;
}
const tanhDrive = (x, d) => { for (let k = 0; k < x.length; k++) x[k] = Math.tanh(x[k] * d) / Math.tanh(d); return x; };

/** trim leading/trailing silence (below -50 dB of peak), fades, normalize active RMS to -18 dB with peak <= -1 dBFS */
function finish(x, { fadeOut = 0.03, keepLead = false, loop = false } = {}) {
  let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v));
  if (!loop) {
    const th = pk * 10 ** (-50 / 20);
    let a = 0, b = x.length - 1;
    if (!keepLead) while (a < b && Math.abs(x[a]) < th) a++;
    while (b > a && Math.abs(x[b]) < th) b--;
    x = x.slice(Math.max(0, a - 22), Math.min(x.length, b + 1));
    const fi = Math.round(0.005 * SR), fo = Math.min(Math.round(fadeOut * SR), x.length >> 1);
    for (let k = 0; k < fi && k < x.length; k++) x[k] *= k / fi;
    for (let k = 0; k < fo; k++) x[x.length - 1 - k] *= k / fo;
  }
  // active RMS: the loudest 50 ms windows covering the top half of the energy
  const w = Math.round(0.05 * SR), rs = [];
  for (let i = 0; i + w <= x.length; i += w) { let s = 0; for (let k = i; k < i + w; k++) s += x[k] * x[k]; rs.push(s / w); }
  rs.sort((p, q) => q - p);
  const act = Math.sqrt(rs.slice(0, Math.max(1, Math.ceil(rs.length / 2))).reduce((p, q) => p + q, 0) / Math.max(1, Math.ceil(rs.length / 2)));
  pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v));
  let g = 10 ** (-18 / 20) / Math.max(act, 1e-9);
  if (pk * g > 10 ** (-1 / 20)) g = 10 ** (-1 / 20) / pk;
  for (let k = 0; k < x.length; k++) x[k] *= g;
  return x;
}
/** crossfade the end into the start so the buffer loops: returns length - xf */
function makeLoop(x, xf) {
  const n = x.length - Math.round(xf * SR), f = Math.round(xf * SR), out = x.slice(0, n);
  for (let k = 0; k < f; k++) { const t = k / f; out[k] = x[k] * Math.sqrt(t) + x[n + k] * Math.sqrt(1 - t); }
  return out;
}

// ---------------------------------------------------------------- synthesized sounds
function whoosh(len, peak, lo, hi, seed) {
  const r = rng(seed), n = Math.round(len * SR), x = noise(n, r);
  const y = svfBand(x, (t) => { const u = t / len; return u < peak ? lo + (hi - lo) * (u / peak) ** 1.6 : hi * Math.exp(-(u - peak) / (1 - peak) * 2.2); }, 0.9);
  return envApply(y, (t) => { const u = t / len; return u < peak ? (u / peak) ** 2.2 : Math.exp(-((u - peak) / (1 - peak)) * 4); });
}
function riser(len, seed) {
  const r = rng(seed), n = Math.round(len * SR);
  const y = svfBand(noise(n, r), (t) => 250 * (5000 / 250) ** (t / len), 0.5);
  let ph = 0, ph2 = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR, u = t / len;
    const f = 90 * (900 / 90) ** (u ** 1.5) * (1 + 0.01 * Math.sin(TAU * 7 * t));
    ph += TAU * f / SR; ph2 += TAU * f * 1.498 / SR;
    y[k] = y[k] * 0.9 + (Math.sin(ph) + 0.4 * Math.sin(ph2)) * 0.18;
    y[k] *= u ** 2.4 * (u > 0.985 ? (1 - u) / 0.015 : 1);
  }
  return addReverb(y, 0.12, 0.7, 0.3);
}
function boom(seed, { f0 = 75, f1 = 32, len = 1.6 } = {}) {
  const r = rng(seed), n = Math.round(len * SR), x = new Float32Array(n);
  let ph = 0;
  for (let k = 0; k < n; k++) { const t = k / SR; ph += TAU * (f1 + (f0 - f1) * Math.exp(-t / 0.08)) / SR; x[k] = Math.sin(ph) * Math.exp(-t / 0.45); }
  const nz = noise(n, r); biquadLP(nz, 500);
  for (let k = 0; k < n; k++) x[k] += nz[k] * Math.exp(-k / SR / 0.09) * 1.4;
  return tanhDrive(x, 1.5);
}
function stinger(seed) {
  const n = Math.round(2.6 * SR), x = new Float32Array(n);
  mixAt(x, boom(seed), 0, 0.9);
  // dissonant metallic cluster (a tritone + minor 2nd of inharmonic bells), slow decay
  for (const [f, g] of [[311, 0.5], [440, 0.4], [466, 0.35], [659, 0.2]]) {
    for (const [ratio, a, dec] of [[1, 1, 1.4], [2.76, 0.4, 0.4], [5.4, 0.15, 0.15]]) {
      let ph = 0; for (let k = 0; k < n; k++) { ph += TAU * f * ratio / SR; x[k] += Math.sin(ph) * a * g * 0.25 * Math.exp(-k / SR / dec); }
    }
  }
  return addReverb(x, 0.25, 0.85, 1.2);
}
function thunder(seed) {
  const r = rng(seed), n = Math.round(4.2 * SR);
  const crack = noise(n, r); biquadHP(crack, 900);
  const rumble = noise(n, r); biquadLP(rumble, 180); biquadLP(rumble, 260);
  let am = 0, tgt = 0;
  const x = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    if (k % 2205 === 0) tgt = 0.4 + r() * 0.9;
    am += (tgt - am) * 0.0006;
    x[k] = crack[k] * Math.exp(-t / 0.06) * 0.6 + rumble[k] * 6 * am * Math.min(1, t / 0.12) * Math.exp(-t / 1.4);
  }
  return addReverb(tanhDrive(x, 1.3), 0.2, 0.85, 1.0);
}
/** distant, slightly muffled scream (synth): a pitched "aah" that jumps up, wavers and breaks */
function scream(seed) {
  const r = rng(seed), len = 1.25, n = Math.round(len * SR);
  const f0 = (t) => (t < 0.08 ? 520 + 3800 * t : 820) * (1 + 0.035 * Math.sin(TAU * 6.5 * t) + 0.02 * Math.sin(TAU * 13 * t)) * (t > 0.9 ? 1 - 0.25 * (t - 0.9) : 1);
  const src = voiceSrc(n, f0, { breath: 0.35, jitter: 0.03, r });
  let y = formants(src, [[950, 160, 1], [1650, 200, 0.6], [2900, 300, 0.35], [3900, 400, 0.15]]);
  y = tanhDrive(y.map((v) => v * 3), 2.2);
  envApply(y, (t) => Math.min(1, t / 0.05) * (t > len - 0.3 ? (len - t) / 0.3 : 1));
  biquadLP(y, 4200);
  return addReverb(y, 0.22, 0.8, 0.8);
}
/** "ah... ah... CHOO" */
function sneeze(seed) {
  const r = rng(seed), x = zeros(1.6);
  const ah = (len, p0, p1) => {
    const n = Math.round(len * SR), s = voiceSrc(n, (t) => p0 + (p1 - p0) * t / len, { breath: 0.5, jitter: 0.01, r });
    return envApply(formants(s, [[800, 120, 1], [1250, 150, 0.5], [2700, 250, 0.2]]), (t) => Math.min(1, t / 0.08) * Math.min(1, (len - t) / 0.06) * (0.5 + 0.5 * t / len));
  };
  mixAt(x, ah(0.32, 260, 330), 0, 0.5);
  mixAt(x, ah(0.26, 300, 380), 0.48, 0.65);
  // CH: a sharp hiss burst; OO: rounded voiced tail
  const ch = noise(Math.round(0.12 * SR), r); biquadHP(ch, 1800); biquadLP(ch, 7000);
  envApply(ch, (t) => Math.min(1, t / 0.004) * Math.exp(-t / 0.05));
  mixAt(x, ch, 0.86, 1.6);
  const n = Math.round(0.3 * SR), oo = voiceSrc(n, (t) => 360 - 120 * t, { breath: 0.6, jitter: 0.02, r });
  mixAt(x, envApply(formants(oo, [[330, 90, 1], [800, 120, 0.4]]), (t) => Math.min(1, t / 0.01) * Math.exp(-t / 0.09)), 0.9, 1.4);
  return addReverb(x, 0.12, 0.6, 0.4);
}
function growl(seed) {
  const r = rng(seed), len = 1.9, n = Math.round(len * SR);
  const src = voiceSrc(n, (t) => 62 + 10 * Math.sin(TAU * 0.8 * t) + 6 * (r() - 0.5), { breath: 0.4, jitter: 0.08, r });
  // subharmonic roughness
  let ph = 0; for (let k = 0; k < n; k++) { ph += TAU * 31 / SR; src[k] += Math.sin(ph) * 0.3; }
  let y = formants(src, [[420, 120, 1], [900, 160, 0.6], [2300, 300, 0.12]]);
  let am = 0; for (let k = 0; k < n; k++) { if (k % 900 === 0) am = 0.55 + r() * 0.45; y[k] *= am; }
  y = tanhDrive(y.map((v) => v * 4), 2.5);
  envApply(y, (t) => Math.min(1, t / 0.35) ** 1.5 * (t > len - 0.4 ? (len - t) / 0.4 : 1));
  biquadLP(y, 2500);
  return addReverb(y, 0.2, 0.82, 0.8);
}
/** many quiet voices babbling: syllables with random vowels and pitches; loops */
function crowdMurmur(seed) {
  const r = rng(seed), len = 6, n = Math.round(len * SR), x = new Float32Array(n);
  const V = [[700, 1200], [400, 2000], [300, 900], [550, 1700], [450, 1000], [650, 1050]];
  for (let v = 0; v < 18; v++) {
    const base = 105 + r() * 150, pan = 0;
    let t = r() * 0.5;
    while (t < len - 0.3) {
      const syl = 0.11 + r() * 0.16, [f1, f2] = V[Math.floor(r() * V.length)];
      const m = Math.round(syl * SR), s = voiceSrc(m, (u) => base * (1 + 0.15 * Math.sin(TAU * u / syl)), { breath: 0.25, jitter: 0.02, r });
      const y = envApply(formants(s, [[f1, 110, 1], [f2, 150, 0.45], [2700, 250, 0.12]]), (u) => Math.sin(Math.PI * Math.min(1, u / syl)) ** 1.5);
      mixAt(x, y, t, (0.25 + r() * 0.75) * (0.5 + pan));
      t += syl + (r() < 0.25 ? 0.2 + r() * 0.6 : 0.02 + r() * 0.06);
    }
  }
  biquadLP(x, 2600);
  const y = addReverb(x, 0.3, 0.8, 0);
  return makeLoop(y.slice(0, n), 1.0);
}
/** a cheer: voices on "aay/yeah" rising together + scattered claps */
function crowdCheer(seed) {
  const r = rng(seed), len = 2.8, n = Math.round(len * SR), x = new Float32Array(n);
  for (let v = 0; v < 22; v++) {
    const p = 180 + r() * 260, st = r() * 0.25, l = 1.4 + r() * 1.0, m = Math.round(l * SR);
    const s = voiceSrc(m, (u) => p * (1 + 0.25 * Math.min(1, u / 0.25)) * (1 + 0.03 * Math.sin(TAU * (5 + r()) * u)), { breath: 0.35, jitter: 0.02, r });
    const y = envApply(formants(s, [[750 + r() * 150, 140, 1], [1600 + r() * 300, 200, 0.5], [2800, 300, 0.2]]), (u) => Math.min(1, u / 0.12) * (u > l - 0.5 ? Math.max(0, (l - u) / 0.5) : 1));
    mixAt(x, y, st, 0.4 + r() * 0.6);
  }
  for (let c = 0; c < 40; c++) {
    const cl = noise(Math.round(0.03 * SR), r); biquadHP(cl, 900); biquadLP(cl, 5000);
    envApply(cl, (u) => Math.exp(-u / 0.008));
    mixAt(x, cl, 0.1 + r() * (len - 0.6), 0.6 + r() * 0.8);
  }
  biquadLP(x, 5000);
  return addReverb(x, 0.25, 0.8, 0.6);
}
function pop() {
  const n = Math.round(0.12 * SR), x = new Float32Array(n); let ph = 0;
  for (let k = 0; k < n; k++) { const t = k / SR; ph += TAU * (300 + 900 * Math.exp(-t / 0.012)) / SR; x[k] = Math.sin(ph) * Math.exp(-t / 0.03) * Math.min(1, t / 0.001); }
  return x;
}
/** pea whistle ("tweeeet"): a ~2.9 kHz tone trilled by the pea at ~30 Hz, with breath noise; two blasts */
function whistle(seed) {
  const r = rng(seed), x = zeros(1.4);
  const blast = (len, f) => {
    const n = Math.round(len * SR), y = new Float32Array(n); let ph = 0;
    const br = noise(n, r); const b2 = svfBand(br, () => f, 0.3);
    for (let k = 0; k < n; k++) {
      const t = k / SR, tr = Math.sin(TAU * 31 * t);
      ph += TAU * f * (1 + 0.022 * tr) / SR;
      y[k] = (Math.sin(ph) * (0.75 + 0.25 * tr) + 0.12 * Math.sin(2 * ph) + b2[k] * 0.25) * Math.min(1, t / 0.015) * Math.min(1, (len - t) / 0.03);
    }
    return y;
  };
  mixAt(x, blast(0.16, 2850), 0, 0.85);
  mixAt(x, blast(0.75, 2900), 0.24, 1);
  return addReverb(x, 0.15, 0.75, 0.4);
}

// ---------------------------------------------------------------- Kenney-based sounds
function footsteps(files, interval, count, rate = 1, seed = 3) {
  const r = rng(seed), len = interval * count, x = new Float32Array(Math.round(len * SR));
  const steps = files.map((f) => resample(kenney(f), rate));
  for (let i = 0; i < count; i++) mixAt(x, steps[i % steps.length], i * interval + (r() - 0.5) * 0.012, i % 2 ? 0.8 : 1);
  return x;   // already loops: each step finishes well before the next interval ends
}

export const BUILD = {
  whoosh_1: () => whoosh(0.7, 0.62, 300, 3200, 11),
  whoosh_2: () => whoosh(1.0, 0.5, 180, 1600, 12),
  whoosh_3: () => whoosh(0.45, 0.7, 500, 5200, 13),
  riser_short: () => riser(1.1, 21),
  riser_long: () => riser(2.0, 22),
  impact: () => { const x = zeros(1.8); mixAt(x, boom(31), 0, 1); mixAt(x, kenney("kenney_impact-sounds/Audio/impactPunch_heavy_000.ogg"), 0, 0.6); return x; },
  stinger: () => stinger(32),
  thunder: () => thunder(41),
  // ElevenLabs takes when present (owner's go, 2026-11-04), else our code-made stand-ins
  scream: () => eleven("scream") ?? scream(51),
  sneeze: () => eleven("sneeze") ?? sneeze(52),
  growl: () => eleven("growl") ?? growl(53),
  crowd_murmur: () => { const x = eleven("crowd_murmur"); return x ? makeLoop(x, 0.4) : crowdMurmur(61); },
  crowd_cheer: () => eleven("crowd_cheer") ?? crowdCheer(62),
  pop: () => pop(),
  whistle: () => whistle(71),
  knock: () => { const k = kenney("kenney_impact-sounds/Audio/impactWood_light_001.ogg"), x = zeros(0.75); mixAt(x, k, 0, 1); mixAt(x, k, 0.2, 0.85); mixAt(x, kenney("kenney_impact-sounds/Audio/impactWood_light_002.ogg"), 0.4, 0.9); return x; },
  crash: () => { const x = zeros(1.0); mixAt(x, kenney("kenney_impact-sounds/Audio/impactGlass_heavy_000.ogg"), 0, 1); mixAt(x, kenney("kenney_impact-sounds/Audio/impactPlate_heavy_000.ogg"), 0.02, 0.8); mixAt(x, boom(33, { len: 0.6 }), 0, 0.5); return x; },
  door_creak: () => resample(kenney("kenney_rpg-audio/Audio/doorOpen_2.ogg"), 0.92),
  door_slam: () => { const x = zeros(1.0); mixAt(x, kenney("kenney_rpg-audio/Audio/doorClose_4.ogg"), 0, 1); mixAt(x, boom(34, { f0: 110, f1: 50, len: 0.5 }), 0.01, 0.5); return x; },
  footsteps_walk: () => footsteps(["kenney_impact-sounds/Audio/footstep_concrete_000.ogg", "kenney_impact-sounds/Audio/footstep_concrete_001.ogg", "kenney_impact-sounds/Audio/footstep_concrete_002.ogg", "kenney_impact-sounds/Audio/footstep_concrete_003.ogg"], 0.5, 4),
  footsteps_run: () => footsteps(["kenney_rpg-audio/Audio/footstep00.ogg", "kenney_rpg-audio/Audio/footstep02.ogg", "kenney_rpg-audio/Audio/footstep05.ogg", "kenney_rpg-audio/Audio/footstep07.ogg"], 0.3, 4, 1.1),
};
const LOOPS = new Set(["crowd_murmur", "footsteps_walk", "footsteps_run"]);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv[2]?.split(",");
  for (const [name, fn] of Object.entries(BUILD)) {
    if (only && !only.includes(name)) continue;
    const x = finish(fn(), { loop: LOOPS.has(name), fadeOut: name.startsWith("riser") ? 0.01 : 0.06 });
    writeWav(path.join(OUT, `${name}.wav`), [x], SR);
    let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v));
    console.log(`${name.padEnd(15)} ${(x.length / SR).toFixed(2)} s  peak ${(20 * Math.log10(pk)).toFixed(1)} dBFS`);
  }
}
