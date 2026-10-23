// Preview audio ($0, local): voice_A's full-script read up to "...landfill liner.", every pause longer than
// 80 ms cut down to 80 ms (no speed change: speech is kept as is, only silence is removed), new word times,
// one-word captions, and the -20 dB mix (effects and chime under the measured voice) from the committed library.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const [wt, ff, OUT] = process.argv.slice(2);
process.env.FFMPEG = ff;
const R = "C:/Users/Public/Zylo/research/seamless-niche";
const words = JSON.parse(fs.readFileSync(`${R}/test3b/voice_A.words.json`, "utf8"));
const last = words.findIndex((w) => /^liner\./.test(w.w));
const ws = words.slice(0, last + 1);
const KEEP = 0.08, HALF = KEEP / 2;
// speech segments: split wherever the gap between words is longer than 80 ms
const segs = []; let a = 0, removed = 0; const shift = [];
for (let i = 0; i < ws.length; i++) {
  if (i > 0) { const gap = ws[i].s - ws[i - 1].e; if (gap > KEEP) { segs.push([a, ws[i - 1].e + HALF]); a = ws[i].s - HALF; removed += gap - KEEP; } }
  shift.push(removed);
}
segs.push([a, ws[ws.length - 1].e + 0.45]);
const newWords = ws.map((w, i) => ({ w: w.w, s: +(w.s - shift[i]).toFixed(3), e: +(w.e - shift[i]).toFixed(3) }));
const lengthSec = +(newWords.at(-1).e + 0.45).toFixed(3);
fs.mkdirSync(OUT, { recursive: true });
const parts = segs.map(([s, e], i) => `[0:a]atrim=start=${s.toFixed(3)}:end=${e.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.006,afade=t=out:st=${(e - s - 0.006).toFixed(3)}:d=0.006[s${i}]`);
const fc = `${parts.join(";")};${segs.map((_, i) => `[s${i}]`).join("")}concat=n=${segs.length}:v=0:a=1[out]`;
execFileSync(ff, ["-v", "error", "-y", "-i", `${R}/test3b/voice_A.mp3`, "-filter_complex", fc, "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "192k", `${OUT}/voice_preview.mp3`]);
fs.writeFileSync(`${OUT}/words_preview.json`, JSON.stringify(newWords, null, 1));
const wpm = (newWords.length / newWords.at(-1).e) * 60;
console.log(`${newWords.length} words, ${segs.length} segments, ${removed.toFixed(2)} s of pause removed, length ${lengthSec} s, ${wpm.toFixed(0)} wpm`);

const at = (re) => newWords.find((w) => re.test(w.w));
const T = { dig: at(/^dig$/).s, throw: at(/^throw$/).s, landfill: at(/^landfill\.$/).s, leaks: at(/^leaks$/).s, groundwater: at(/^groundwater$/).s, drink: at(/^drink\.$/).s,
  so: at(/^So$/).s, lay: at(/^lay$/).s, clay: at(/^clay$/).s, not: at(/^not$/).s, enough: at(/^enough\.$/).s, add: at(/^add$/).s, plastic: at(/^plastic$/).s, sheet: at(/^sheet\.$/).s,
  this: newWords.findLast((w) => /^This$/.test(w.w)).s, liner: newWords.findLast((w) => /^liner\.$/.test(w.w)).s };
fs.writeFileSync(`${OUT}/times.json`, JSON.stringify({ lengthSec, ...T }, null, 1));
console.log(JSON.stringify(T));

const { buildAss } = await import(pathToFileURL(path.join(wt, "render-worker/src/cutawayFinalPlan.mjs")).href);
fs.writeFileSync(`${OUT}/captions.ass`, buildAss({ words: newWords, cards: [] }));
const { renderMix } = await import(pathToFileURL(path.join(wt, "render-worker/src/cutawayFinal.mjs")).href);
const lib = (k) => path.join(wt, "render-worker/assets/sfx", `lib-${k}.mp3`);
const sfx = [
  { url: lib("dirt"), start: T.dig + 0.05, duration: 1.2 },
  { url: lib("dirt"), start: T.throw + 0.15, duration: 1.2 },
  { url: lib("drip"), start: T.leaks, duration: 1.3 },
];
const job = { voice: { url: `${OUT}/voice_preview.mp3`, tempo: 1 }, chimes: [T.this], sfx, lengthSec, levels: { sfxDb: -20, chimeDb: -20 } };
const r = await renderMix(job, `${OUT}/mix`, "mix_preview.mp3");
fs.copyFileSync(r.file, `${OUT}/mix_preview.mp3`);
console.log("mix", JSON.stringify(r.measured));
