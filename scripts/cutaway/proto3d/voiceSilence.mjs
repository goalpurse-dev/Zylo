// $0: re-time a take by its real silences (not word timestamps): every silence run in the audio is classified by
// the word boundary it sits on and shrunk (or padded) to its target. Speech is never sped up.
// Targets (the creator, measured): comma ~0, other in-sentence gaps <= 0.06 s, sentence 0.23 s, section 0.28 s.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const [ff, inFile, wordsFile, outFile] = process.argv.slice(2);
const T = { comma: 0.02, inner: 0.06, sentence: 0.23, section: 0.28 };
// words that open a new section (a slightly longer pause); SECTION_WORDS="And|Wrap" adds topic-specific ones
const SECTION = new RegExp(`^(But|So|This|Add|Congratulations|That${process.env.SECTION_WORDS ? `|${process.env.SECTION_WORDS}` : ""})\\b`);
const SR = 16000, HOP = SR / 100;
const words = JSON.parse(fs.readFileSync(wordsFile, "utf8"));
const b = execFileSync(ff, ["-v", "error", "-i", inFile, "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
const N = Math.floor(b.length / 2 / HOP), db = new Float32Array(N);
for (let i = 0; i < N; i++) { let s = 0; for (let k = 0; k < HOP; k++) { const v = b.readInt16LE((i * HOP + k) * 2) / 32768; s += v * v; } db[i] = 10 * Math.log10(s / HOP + 1e-10); }
const speech = [...db].sort((p, q) => p - q)[Math.floor(N * 0.8)];
const runs = []; let a = -1;
for (let i = 0; i <= N; i++) { const sil = i < N && db[i] < speech - 26; if (sil) { if (a < 0) a = i; } else if (a >= 0) { if (i - a >= 4) runs.push([a / 100, i / 100]); a = -1; } }
// classify each run by the boundary it is closest to (between word k and k+1)
const edits = [];
for (const [s, e] of runs) {
  if (s < words[0].s + 0.05 || s > words.at(-1).e - 0.05) continue; // leading/trailing silence handled below
  let k = -1, best = Infinity;
  for (let i = 0; i < words.length - 1; i++) { const mid = (words[i].e + words[i + 1].s) / 2, d = Math.abs(mid - (s + e) / 2); if (d < best) { best = d; k = i; } }
  if (k < 0 || best > 0.45) continue;
  const w = words[k], nx = words[k + 1];
  const kind = /[.!?]$/.test(w.w) ? (SECTION.test(nx.w) ? "section" : "sentence") : /,$/.test(w.w) ? "comma" : "inner";
  edits.push({ s, e, kind, target: T[kind] });
}
// sentence/section boundaries with no detected silence still get their pause (padding at the word gap)
for (let i = 0; i < words.length - 1; i++) {
  const w = words[i]; if (!/[.!?]$/.test(w.w)) continue;
  const mid = (w.e + words[i + 1].s) / 2;
  if (!edits.some((x) => mid > x.s - 0.3 && mid < x.e + 0.3)) edits.push({ s: mid, e: mid, kind: SECTION.test(words[i + 1].w) ? "section" : "sentence", target: SECTION.test(words[i + 1].w) ? T.section : T.sentence });
}
edits.sort((p, q) => p.s - q.s);
// keep-segments: speech up to the middle of each silence (keeping target/2 on each side), then pad if the run was short
const start = Math.max(0, words[0].s - 0.05), end = words.at(-1).e + 0.6;
const segs = []; let cur = start;
for (const x of edits) {
  const len = x.e - x.s, keep = Math.min(x.target, len), pad = Math.max(0, x.target - len);
  segs.push({ s: cur, e: x.s + keep / 2, pad }); cur = x.e - keep / 2;
}
segs.push({ s: cur, e: Math.min(end, N / 100), pad: 0.4 });
const fc = segs.map((g, i) => `[0:a]atrim=start=${g.s.toFixed(3)}:end=${g.e.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.004,afade=t=out:st=${Math.max(0, g.e - g.s - 0.006).toFixed(3)}:d=0.006,apad=pad_dur=${g.pad.toFixed(3)}[g${i}]`).join(";") + `;${segs.map((_, i) => `[g${i}]`).join("")}concat=n=${segs.length}:v=0:a=1[o]`;
execFileSync(ff, ["-v", "error", "-y", "-i", inFile, "-filter_complex", fc, "-map", "[o]", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "192k", outFile]);
// remap word times: output time = position inside its keep-segment + everything before it
const map = (t) => { let out = 0; for (const g of segs) { if (t <= g.e) return out + Math.max(0, t - g.s); out += g.e - g.s + g.pad; } return out; };
const nw = words.map((w) => ({ w: w.w, s: +map(w.s).toFixed(3), e: +map(w.e).toFixed(3) }));
fs.writeFileSync(outFile.replace(/\.mp3$/, ".words.json"), JSON.stringify(nw));
const count = (k) => edits.filter((x) => x.kind === k).length;
console.log(`${edits.length} silences re-timed (comma ${count("comma")}, inner ${count("inner")}, sentence ${count("sentence")}, section ${count("section")}); ${nw.length} words, ${nw.at(-1).e.toFixed(1)} s, ${Math.round((nw.length / nw.at(-1).e) * 60)} wpm`);
