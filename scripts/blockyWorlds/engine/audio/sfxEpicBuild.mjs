// Builds the EPIC SFX (audio/sfxEpic.mjs) into audio/sfx/<name>.wav (EPIC agent). Free and local: synthesized here +
// Kenney CC0 layers from assets/sfx-src/. An ElevenLabs take in assets/sfx-src/eleven/<name>.mp3 (if the owner ever
// orders one) is preferred. Each file: mono 44.1 kHz 16-bit, exactly the catalog's dur, active RMS -18 dB, peak <= -1 dBFS.
//   node audio/sfxEpicBuild.mjs [name,name]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeWav } from "../lib/audioWav.mjs";
import { rng } from "../lib/rng.js";
import { biquadLP, biquadHP, freeverb } from "./backrooms.mjs";
import { SFX_EPIC } from "./sfxEpic.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ENGINE, "assets", "sfx-src"), OUT = path.join(ENGINE, "audio", "sfx");
const SR = 44100, TAU = 2 * Math.PI;

function decode(f) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", f, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`decode failed: ${f}`);
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length));
}
const kenney = (n) => decode(path.join(SRC, "kenney_impact-sounds", "Audio", n));
const eleven = (n) => { const f = path.join(SRC, "eleven", `${n}.mp3`); return fs.existsSync(f) ? decode(f) : null; };
const zeros = (s) => new Float32Array(Math.round(s * SR));
const noise = (n, r) => { const o = new Float32Array(n); for (let k = 0; k < n; k++) o[k] = r() * 2 - 1; return o; };
function mixAt(dst, src, at, g = 1) { const o = Math.round(at * SR); for (let k = 0; k < src.length && o + k < dst.length; k++) if (o + k >= 0) dst[o + k] += src[k] * g; return dst; }
function resample(x, rate) { const n = Math.floor(x.length / rate), out = new Float32Array(n); for (let k = 0; k < n; k++) { const p = k * rate, i = Math.floor(p), f = p - i; out[k] = (x[i] ?? 0) * (1 - f) + (x[i + 1] ?? 0) * f; } return out; }
const drive = (x, d) => { for (let k = 0; k < x.length; k++) x[k] = Math.tanh(x[k] * d) / Math.tanh(d); return x; };
function reverb(x, mix, size) { const w = freeverb(x, { size }); for (let k = 0; k < x.length; k++) x[k] += w[k] * mix * 4; return x; }
function reson(x, fc, bw) { const r = Math.exp(-Math.PI * bw / SR), a1 = -2 * r * Math.cos(TAU * fc / SR), a2 = r * r, g = 1 - r, out = new Float32Array(x.length); let y1 = 0, y2 = 0; for (let k = 0; k < x.length; k++) { const y = g * x[k] - a1 * y1 - a2 * y2; y2 = y1; y1 = y; out[k] = y; } return out; }

/** a sub boom: pitch drop f0 -> f1, decay, a noise thump */
function boom(seed, { f0 = 60, f1 = 24, len = 1.8, dec = 0.6, thump = 1.2 } = {}) {
  const r = rng(seed), n = Math.round(len * SR), x = new Float32Array(n); let ph = 0;
  for (let k = 0; k < n; k++) { const t = k / SR; ph += TAU * (f1 + (f0 - f1) * Math.exp(-t / 0.1)) / SR; x[k] = Math.sin(ph) * Math.exp(-t / dec); }
  const nz = noise(n, r); biquadLP(nz, 380); for (let k = 0; k < n; k++) x[k] += nz[k] * Math.exp(-k / SR / 0.12) * thump;
  return drive(x, 1.8);
}
/** low rumble: filtered noise with slow amplitude wobble */
function rumbleSrc(len, seed, fc = 90) { const r = rng(seed), x = noise(Math.round(len * SR), r); biquadLP(x, fc); biquadLP(x, fc * 1.3); let a = 0.5; for (let k = 0; k < x.length; k++) { if (k % 2205 === 0) a = 0.6 + r() * 0.4; x[k] *= a * 4; } return x; }
/** a growling voice: a low buzzy source through vowel formants, pitch contour f(t) */
function growlVoice(len, seed, f0At, formantsAt, { breath = 0.35, rough = 0.6 } = {}) {
  const r = rng(seed), n = Math.round(len * SR), src = new Float32Array(n); let ph = 0;
  for (let k = 0; k < n; k++) { const t = k / SR; const f = f0At(t) * (1 + rough * 0.08 * (r() * 2 - 1)); ph += f / SR; if (ph >= 1) ph -= 1; src[k] = (2 * ph - 1) * 0.7 + (r() * 2 - 1) * breath; }
  const out = new Float32Array(n);
  for (const [fc, bw, g] of formantsAt) { const y = reson(src, fc, bw); for (let k = 0; k < n; k++) out[k] += y[k] * g; }
  return out;
}
function env(x, fn) { for (let k = 0; k < x.length; k++) x[k] *= fn(k / SR, x.length / SR); return x; }
/** many voices yelling: several growl voices at kid/adult pitches, detuned, staggered */
function crowdYell(len, seed, { n = 14, base = 180, spread = 0.5, vowel = [[700, 120, 1], [1150, 140, 0.6], [2600, 220, 0.25]], shape } = {}) {
  const r = rng(seed), out = zeros(len);
  for (let i = 0; i < n; i++) {
    const f0 = base * (0.7 + r() * spread * 2), st = r() * 0.25, vib = 4 + r() * 3;
    const v = growlVoice(len - st, seed + i * 13, (t) => f0 * (1 + 0.15 * shape(t / (len - st))) * (1 + 0.02 * Math.sin(TAU * vib * t)), vowel.map(([fc, bw, g]) => [fc * (0.9 + r() * 0.2), bw, g]), { breath: 0.25, rough: 0.3 });
    env(v, (t, L) => Math.min(1, t / 0.08) * Math.min(1, (L - t) / 0.4));
    mixAt(out, v, st, 0.6 + r() * 0.4);
  }
  biquadHP(out, 120);
  return reverb(out, 0.18, 0.7);
}

const BUILD = {
  giant_stomp: () => { const x = zeros(1.9); mixAt(x, boom(301), 0, 1); mixAt(x, kenney("impactMining_000.ogg"), 0.0, 0.7); mixAt(x, resample(kenney("impactSoft_heavy_001.ogg"), 0.6), 0.01, 0.8); const deb = noise(Math.round(0.9 * SR), rng(5)); biquadHP(deb, 2500); env(deb, (t) => (t < 0.15 ? 0 : 0.12 * Math.exp(-(t - 0.15) / 0.25) * (Math.sin(t * 90) > 0.6 ? 1 : 0.2))); mixAt(x, deb, 0.1); return reverb(x, 0.12, 0.8); },
  giant_steps: () => { const x = zeros(2.4); for (const at of [0, 1.2]) mixAt(x, boom(311 + at * 10, { len: 1.15, dec: 0.4 }), at, at ? 0.85 : 1); mixAt(x, resample(kenney("impactSoft_heavy_002.ogg"), 0.55), 0.01, 0.6); mixAt(x, resample(kenney("impactSoft_heavy_003.ogg"), 0.55), 1.21, 0.5); return x; },
  giant_thud: () => { const x = zeros(2.2); mixAt(x, boom(321, { f0: 50, f1: 20, len: 2.2, dec: 0.9, thump: 1.6 }), 0, 1); mixAt(x, resample(kenney("impactPlank_medium_000.ogg"), 0.5), 0.0, 0.8); mixAt(x, rumbleSrc(2.0, 7), 0.05, 0.25); return reverb(x, 0.15, 0.85); },
  impact_big: () => { const x = zeros(2.0); mixAt(x, boom(331, { f0: 75, f1: 30, len: 2.0, dec: 0.5 }), 0, 1); mixAt(x, kenney("impactPunch_heavy_002.ogg"), 0, 0.8); mixAt(x, resample(kenney("impactMetal_heavy_001.ogg"), 0.8), 0.005, 0.35); mixAt(x, rumbleSrc(1.6, 9), 0.1, 0.2); return reverb(x, 0.14, 0.8); },
  roar_big: () => eleven("roar_big") ?? (() => {
    const L = 2.6, v = growlVoice(L, 341, (t) => 62 + 30 * Math.sin(Math.PI * Math.min(1, t / L)) - 12 * Math.max(0, t - 1.8), [[420, 160, 1], [800, 200, 0.7], [1900, 300, 0.25]], { breath: 0.55, rough: 1.0 });
    const v2 = growlVoice(L, 342, (t) => 41 + 15 * Math.sin(Math.PI * Math.min(1, t / L)), [[300, 140, 1], [650, 200, 0.5]], { breath: 0.4, rough: 1.2 });
    const x = zeros(L); mixAt(x, v, 0, 1); mixAt(x, v2, 0, 0.8); env(x, (t) => Math.min(1, t / 0.2) * Math.min(1, (L - t) / 0.7)); drive(x, 2.2); return reverb(x, 0.22, 0.88);
  })(),
  army_march: () => { // 40 marchers in step at 2 steps/s, slightly spread in time; light armour clinks
    const x = zeros(2.0), r = rng(351), steps = ["footstep_concrete_000.ogg", "footstep_concrete_001.ogg", "footstep_concrete_002.ogg", "footstep_concrete_003.ogg", "footstep_concrete_004.ogg"].map((f) => kenney(f));
    for (const at of [0, 0.5, 1.0, 1.5]) for (let i = 0; i < 40; i++) mixAt(x, resample(steps[i % 5], 0.85 + r() * 0.3), at + r() * 0.045, 0.12 + r() * 0.08);
    const clink = kenney("impactMetal_light_002.ogg"); for (const at of [0.02, 0.52, 1.02, 1.52]) for (let i = 0; i < 6; i++) mixAt(x, resample(clink, 1.2 + r() * 0.6), at + r() * 0.08, 0.05);
    biquadLP(x, 6000); return x;
  },
  army_charge: () => eleven("army_charge") ?? (() => { const x = zeros(2.8); mixAt(x, crowdYell(2.6, 361, { n: 18, base: 150, shape: (u) => Math.sin(Math.PI * Math.min(1, u * 1.2)) }), 0.05, 1); mixAt(x, rumbleSrc(2.8, 11, 140), 0, 0.25); return x; })(),
  crowd_panic: () => eleven("crowd_panic") ?? (() => { const x = zeros(2.4); mixAt(x, crowdYell(2.3, 371, { n: 12, base: 260, spread: 0.7, vowel: [[900, 160, 1], [1500, 180, 0.6], [3000, 260, 0.2]], shape: (u) => Math.sin(u * 13) * 0.5 + 0.3 }), 0.05, 1); return x; })(),
  shield_clash: () => { const x = zeros(0.9); mixAt(x, kenney("impactMetal_heavy_000.ogg"), 0, 1); mixAt(x, kenney("impactPlate_heavy_002.ogg"), 0.03, 0.7); mixAt(x, kenney("impactMetal_heavy_003.ogg"), 0.11, 0.6); mixAt(x, kenney("impactWood_heavy_001.ogg"), 0.07, 0.5); return x; },
  rumble: () => { const x = rumbleSrc(3.0, 381, 70); const L = x.length, f = Math.round(0.4 * SR); for (let k = 0; k < f; k++) { const t = k / f; x[k] = x[k] * t + x[L - f + k] * (1 - t); } return x; },
  splash_big: () => { const r = rng(391), x = zeros(2.2); const n = noise(Math.round(2.0 * SR), r); biquadLP(n, 3500); env(n, (t) => (t < 0.06 ? t / 0.06 : Math.exp(-(t - 0.06) / 0.5))); mixAt(x, n, 0, 1); mixAt(x, boom(392, { f0: 70, f1: 35, len: 1.2, dec: 0.3 }), 0, 0.6); for (let i = 0; i < 40; i++) { const d = noise(Math.round(0.05 * SR), r); biquadHP(d, 1800); env(d, (t) => Math.exp(-t / 0.015)); mixAt(x, d, 0.3 + r() * 1.4, 0.3 * r()); } return reverb(x, 0.2, 0.8); },
  whale_call: () => eleven("whale_call") ?? (() => { const L = 2.8, v = growlVoice(L, 401, (t) => 140 + 90 * Math.sin(Math.PI * t / L) + 30 * Math.sin(TAU * 0.7 * t), [[500, 80, 1], [1100, 120, 0.4]], { breath: 0.05, rough: 0.05 }); env(v, (t) => Math.min(1, t / 0.5) * Math.min(1, (L - t) / 0.8)); return reverb(v, 0.35, 0.92); })(),
};

/** exactly `dur` long, active RMS -18 dB, peak <= -1 dBFS, 5 ms fade in, fade out (loops: a seamless length, no fades) */
function finish(x, dur, loop) {
  const n = Math.round(dur * SR), y = new Float32Array(n); y.set(x.subarray(0, n));
  if (!loop) { const fi = Math.round(0.005 * SR), fo = Math.round(0.08 * SR); for (let k = 0; k < fi; k++) y[k] *= k / fi; for (let k = 0; k < fo; k++) y[n - 1 - k] *= k / fo; }
  const w = Math.round(0.05 * SR), rs = []; for (let i = 0; i + w <= n; i += w) { let s = 0; for (let k = i; k < i + w; k++) s += y[k] * y[k]; rs.push(s / w); }
  rs.sort((a, b) => b - a); const h = Math.max(1, Math.ceil(rs.length / 2)), act = Math.sqrt(rs.slice(0, h).reduce((a, b) => a + b, 0) / h);
  let pk = 0; for (const v of y) pk = Math.max(pk, Math.abs(v));
  let g = 10 ** (-18 / 20) / Math.max(act, 1e-9); if (pk * g > 10 ** (-1 / 20)) g = 10 ** (-1 / 20) / pk;
  for (let k = 0; k < n; k++) y[k] *= g;
  return y;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv[2]?.split(",");
  for (const [name, fn] of Object.entries(BUILD)) {
    if (only && !only.includes(name)) continue;
    const c = SFX_EPIC[name], y = finish(fn(), c.dur, !!c.loop);
    writeWav(path.join(OUT, `${name}.wav`), [y], SR);
    let pk = 0; for (const v of y) pk = Math.max(pk, Math.abs(v));
    console.log(`${name.padEnd(14)} ${(y.length / SR).toFixed(2)} s  peak ${(20 * Math.log10(pk)).toFixed(1)} dBFS  ${c.quality}${c.paid ? `  (ElevenLabs take ~$${c.paid})` : ""}`);
  }
}
export { BUILD };
