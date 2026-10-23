// Narration rhythm and energy ($0): pauses measured from the vocal track's silences (10 ms RMS frames),
// placed by the transcript (sentence ends, commas, section starts); pace inside sentences; pitch (F0 by a
// YIN-style difference function) and loudness variation. Creator: pool, toilet, road (demucs vocals). Ours: voice_A.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const [ff, outFile] = process.argv.slice(2);
const R = "C:/Users/Public/Zylo/research/seamless-niche";
const SR = 16000;
const pcm = (file) => { const b = execFileSync(ff, ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"], { maxBuffer: 1 << 28 }); const a = new Float32Array(b.length / 2); for (let i = 0; i < a.length; i++) a[i] = b.readInt16LE(i * 2) / 32768; return a; };
const SECTION = /^(but|so|this|congratulations|now|then|and that|add|that)\b/i;

function analyse(label, file, words) {
  const x = pcm(file), HOP = SR / 100, N = Math.floor(x.length / HOP);
  const db = new Float32Array(N);
  for (let i = 0; i < N; i++) { let s = 0; for (let k = 0; k < HOP; k++) { const v = x[i * HOP + k] ?? 0; s += v * v; } db[i] = 10 * Math.log10(s / HOP + 1e-10); }
  const sorted = [...db].sort((a, b) => a - b), speech = sorted[Math.floor(N * 0.8)];
  const silent = (i) => db[i] < speech - 26;
  // silence runs (>= 60 ms)
  const runs = []; let a = -1;
  for (let i = 0; i <= N; i++) { if (i < N && silent(i)) { if (a < 0) a = i; } else if (a >= 0) { if (i - a >= 6) runs.push([a / 100, i / 100]); a = -1; } }
  const gapAfter = (t) => { let best = 0; for (const [s, e] of runs) if (s < t + 0.35 && e > t - 0.15) best = Math.max(best, e - s); return best; };
  const sent = [], sect = [], comma = [], other = [];
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i], nx = words[i + 1], g = gapAfter(w.e);
    if (/[.!?]$/.test(w.w)) (SECTION.test(nx.w) ? sect : sent).push(g);
    else if (/,$/.test(w.w)) comma.push(g);
    else other.push(g);
  }
  const med = (a) => (a.length ? [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)] : 0);
  const mean = (a) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0);
  const total = words.at(-1).e - words[0].s, pauseTotal = runs.filter(([s, e]) => s > words[0].s && e < words.at(-1).e).reduce((p, [s, e]) => p + (e - s), 0);
  // pitch: YIN-style on voiced frames (loud ones), 40 ms windows, 70-400 Hz
  const W = 640, f0 = [];
  for (let i = 0; i < N - 4; i += 1) {
    if (db[i] < speech - 10) continue;
    const off = i * HOP; if (off + W + 230 > x.length) break;
    let bestTau = 0, bestD = Infinity; const d = new Float32Array(231); let run = 0;
    for (let tau = 1; tau <= 230; tau++) { let s = 0; for (let k = 0; k < W; k += 2) { const v = x[off + k] - x[off + k + tau]; s += v * v; } d[tau] = s; run += s; const cm = s * tau / run; if (tau >= 40 && cm < bestD) { bestD = cm; bestTau = tau; } }
    if (bestD < 0.25 && bestTau > 0) f0.push(SR / bestTau);
  }
  const st = f0.map((f) => 12 * Math.log2(f / 100)); const stMean = mean(st);
  const stSd = Math.sqrt(mean(st.map((v) => (v - stMean) ** 2)));
  const pct = (a, p) => [...a].sort((u, v) => u - v)[Math.floor(a.length * p)];
  const voicedDb = [...db].filter((v) => v > speech - 12); const dbMean = mean(voicedDb), dbSd = Math.sqrt(mean(voicedDb.map((v) => (v - dbMean) ** 2)));
  const r = {
    label, words: words.length, seconds: +total.toFixed(1), wpm: Math.round((words.length / total) * 60), wpmInsideSpeech: Math.round((words.length / (total - pauseTotal)) * 60),
    pauseSentence: { median: +med(sent).toFixed(2), mean: +mean(sent).toFixed(2), n: sent.length }, pauseSection: { median: +med(sect).toFixed(2), mean: +mean(sect).toFixed(2), n: sect.length },
    pauseComma: { median: +med(comma).toFixed(2), n: comma.length }, pauseInsideSentence: { share: +(other.filter((g) => g > 0.06).length / Math.max(1, other.length)).toFixed(2), median: +med(other.filter((g) => g > 0.06)).toFixed(2) },
    pitch: { medianHz: Math.round(pct(f0, 0.5)), sdSemitones: +stSd.toFixed(1), rangeSemitones10to90: +(pct(st, 0.9) - pct(st, 0.1)).toFixed(1) }, loudness: { sdDb: +dbSd.toFixed(1) },
  };
  console.log(JSON.stringify(r));
  return r;
}
const creator = (c) => JSON.parse(fs.readFileSync(`${R}/work/creator/${c}/transcript.json`, "utf8")).flatMap((s) => s.words);
const out = [
  analyse("pool (creator)", `${R}/work/creator/c01/sep/htdemucs/audio44k/vocals.wav`, creator("c01")),
  analyse("toilet (creator)", `${R}/work/creator/c02/sep/htdemucs/audio44k/vocals.wav`, creator("c02")),
  analyse("road (creator)", `${R}/work/creator/c03/sep/htdemucs/audio44k/vocals.wav`, creator("c03")),
  analyse("voice A (Eric, ours)", `${R}/test3b/voice_A.mp3`, JSON.parse(fs.readFileSync(`${R}/test3b/voice_A.words.json`, "utf8"))),
];
fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
