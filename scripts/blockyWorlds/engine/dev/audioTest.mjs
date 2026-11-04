// AUDIO agent end-to-end free test: SAPI voice for EXAMPLE_SCRIPT -> horror bed -> mix, plus timing + level checks.
// node dev/audioTest.mjs [outDir=out/dev/audio]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { freeVoice, loadExampleLines } from "../voice/free.mjs";
import { makeMusic } from "../audio/music.mjs";
import { mixAudio } from "../audio/mix.mjs";

const outDir = process.argv[2] ?? "out/dev/audio";
fs.mkdirSync(outDir, { recursive: true });
const { pathToFileURL } = await import("node:url");
const { EXAMPLE_SCRIPT } = await import(pathToFileURL(path.resolve("../../../supabase/functions/_shared/blockyWorlds/examples.js")).href);
const lines = await loadExampleLines();

let t0 = Date.now();
const v = await freeVoice({ lines, out: path.join(outDir, "voice.wav"), wordsOut: path.join(outDir, "words.json") });
console.log(`voice: ${v.duration} s, ${v.wpm} wpm, SAPI rate ${v.rate}, ${v.words.length} words (${(Date.now() - t0) / 1000} s)`);
console.log("first 15:", v.words.slice(0, 15).map((w) => `${w.word}@${w.start.toFixed(2)}-${w.end.toFixed(2)}`).join("  "));

const duration = Math.round((v.duration + 0.4) * 1000) / 1000;
t0 = Date.now();
await makeMusic({ out: path.join(outDir, "music.wav"), seconds: duration, mood: "horror", seed: 7 });
console.log(`music: ${duration} s (${(Date.now() - t0) / 1000} s)`);

// fake shots: one per line, part from the script (the planner makes the real ones)
let wi = 0;
const shots = EXAMPLE_SCRIPT.lines.map((l, i) => {
  const s = v.words[wi]?.start ?? 0;
  wi += l.text.trim().split(/\s+/).length;
  return { start: i === 0 ? 0 : s, part: l.part };
});
t0 = Date.now();
const mx = await mixAudio({ voice: v.wav, music: path.join(outDir, "music.wav"), out: path.join(outDir, "mix.m4a"), duration, shots });
console.log(`mix: ${JSON.stringify(mx)} (${(Date.now() - t0) / 1000} s)`);

// timing check: speech onsets after silences vs. the first word of each line
const sd = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", v.wav, "-af", "silencedetect=noise=-38dB:d=0.06", "-f", "null", "-"], { encoding: "utf8" }).stderr;
const onsets = [...sd.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
const firsts = [];
wi = 0;
for (const l of lines) { firsts.push(v.words[wi]); wi += l.trim().split(/\s+/).length; }
const diffs = firsts.map((w) => { const o = onsets.reduce((b, x) => (Math.abs(x - w.start) < Math.abs(b - w.start) ? x : b), Infinity); return { w: w.word, start: w.start, onset: o, d: o - w.start }; });
const absd = diffs.map((d) => Math.abs(d.d)).sort((a, b) => a - b);
console.log(`line starts vs silencedetect onsets (${diffs.length} lines): median |d| ${(absd[absd.length >> 1] * 1000).toFixed(0)} ms, max ${(absd.at(-1) * 1000).toFixed(0)} ms`);
console.log(diffs.slice(0, 8).map((d) => `${d.w}: word ${d.start.toFixed(3)} onset ${d.onset.toFixed(3)} (${(d.d * 1000).toFixed(0)} ms)`).join("\n"));
// inner-line check: words that follow a comma pause in-line
const inner = [];
for (let i = 1; i < v.words.length; i++) {
  if (!/[,.!?]$/.test(v.words[i - 1].word) || firsts.includes(v.words[i])) continue;
  const w = v.words[i];
  const o = onsets.reduce((b, x) => (Math.abs(x - w.start) < Math.abs(b - w.start) ? x : b), Infinity);
  if (Math.abs(o - w.start) < 0.3) inner.push({ w: w.word, d: o - w.start });
}
console.log(`after in-line pauses: ${inner.length} matched, ${inner.slice(0, 8).map((x) => `${x.w} ${(x.d * 1000).toFixed(0)}ms`).join(", ")}`);

const lv = (f, af = "anull") => {
  const s = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", `${af},ebur128=peak=true`, "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const I = (s.match(/I:\s+(-?[\d.]+) LUFS/g) ?? []).pop(), P = (s.match(/Peak:\s+(-?[\d.]+) dBFS/g) ?? []).pop();
  return `${I?.replace(/\s+/g, " ")} / true ${P?.replace(/\s+/g, " ")}`;
};
console.log(`levels  voice: ${lv(v.wav)}   music raw: ${lv(path.join(outDir, "music.wav"))}   music at -20 dB: ${lv(path.join(outDir, "music.wav"), "volume=-20dB")}   mix: ${lv(path.join(outDir, "mix.m4a"))}`);
