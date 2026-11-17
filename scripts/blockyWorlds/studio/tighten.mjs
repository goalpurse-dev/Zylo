// THE MILO TIGHTENING (owner 2026-11-18, the golden test's gap list: Milo's voice was tightened by hand to 96.5 s, the
// live take of the same 310 words came out at 107.8 s). FREE, after the take is processed (pace.mjs: 1.25x, the
// timestamp gaps cut): every REAL silence in the audio (ffmpeg silencedetect, -35 dB, >= 60 ms) longer than its limit is
// cut down to it: 0.10 s inside a sentence, 0.20 s between sentences of a line, 0.25 s between lines, never over 0.30 s.
// Leading and trailing silence stay; every word timing is shifted by the cuts; 6 ms fades at each join.
//   tightenTake({ wav, words, lines }) -> { wav, words, duration, removed, cuts }   (writes <wav dir>/voice.tight.wav)
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

export const TIGHT = Object.freeze({ inSentence: 0.10, sentence: 0.20, line: 0.25, max: 0.30, noise: "-35dB", min: 0.06 });
const FF = process.env.FFMPEG ?? "ffmpeg";

/** the silences of a wav: [[start, end]] */
export function silences(wav, L = TIGHT) {
  const det = spawnSync(FF, ["-hide_banner", "-i", wav, "-af", `silencedetect=noise=${L.noise}:d=${L.min}`, "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "";
  const out = []; let s0 = null;
  for (const ln of det.split("\n")) {
    const a = ln.match(/silence_start: ([\d.]+)/); if (a) s0 = Number(a[1]);
    const b = ln.match(/silence_end: ([\d.]+)/); if (b && s0 != null) { out.push([s0, Number(b[1])]); s0 = null; }
  }
  return out;
}

/** the cuts for a take (pure): silences + words + the line-end word indexes -> [[from, to]] (seconds removed) */
export function tightenCuts({ sil, words, lineEnds, total, L = TIGHT }) {
  const cuts = [];
  for (const [a, b] of sil) {
    if (a <= 0.01 || b >= total - 0.01) continue; // the edges stay
    const mid = (a + b) / 2;
    let wi = -1; for (let i = 0; i < words.length; i++) if (words[i].start < mid) wi = i;
    if (wi < 0) continue;
    const t = String(words[wi].word).trim();
    const lim = Math.min(L.max, lineEnds.has(wi) ? L.line : /[.!?…]["')\]]*$/.test(t) ? L.sentence : L.inSentence);
    if (b - a > lim) cuts.push([a + lim / 2, b - lim / 2]);
  }
  return cuts;
}
export const shiftTime = (cuts) => (t) => { let sh = 0; for (const [a, b] of cuts) { if (t >= b) sh += b - a; else if (t > a) return a - sh; } return t - sh; };

/** tighten a processed take; never fatal: any failure returns the take as it was */
export function tightenTake({ wav, words, lines, L = TIGHT, inPlace = false }) {
  try {
    const lineEnds = new Set(); let k = 0;
    for (const l of lines ?? []) { k += String(l.text ?? l).trim().split(/\s+/).filter(Boolean).length; lineEnds.add(k - 1); }
    const total = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]).toString());
    const cuts = tightenCuts({ sil: silences(wav, L), words, lineEnds, total, L });
    if (!cuts.length) return { wav, words, duration: total, removed: 0, cuts: [] };
    const keep = []; let a = 0; for (const [x, y] of cuts) { keep.push([a, x]); a = y; } keep.push([a, total]);
    const parts = keep.map(([x, y], i) => `[s${i}]atrim=${x.toFixed(4)}:${y.toFixed(4)},asetpts=PTS-STARTPTS,afade=t=in:d=0.006,afade=t=out:st=${Math.max(0, y - x - 0.006).toFixed(4)}:d=0.006[p${i}]`);
    const graph = `[0:a]asplit=${keep.length}${keep.map((_, i) => `[s${i}]`).join("")};${parts.join(";")};${keep.map((_, i) => `[p${i}]`).join("")}concat=n=${keep.length}:v=0:a=1[out]`;
    const dir = path.dirname(wav), gf = path.join(dir, "tighten.graph"), out = path.join(dir, "voice.tight.wav");
    fs.writeFileSync(gf, graph);
    execFileSync(FF, ["-v", "error", "-y", "-i", wav, "-/filter_complex", gf, "-map", "[out]", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", out]);
    const map = shiftTime(cuts);
    const nw = words.map((w) => ({ ...w, start: +map(w.start).toFixed(3), end: +map(w.end).toFixed(3) }));
    const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).toString());
    let file = out;
    // in place (the worker): the pipeline reads <voice dir>/voice.wav + words.json; the processed take stays beside them
    if (inPlace) {
      fs.renameSync(wav, path.join(dir, "voice.processed.wav"));
      const wj = path.join(dir, "words.json");
      if (fs.existsSync(wj)) fs.renameSync(wj, path.join(dir, "words.processed.json"));
      fs.renameSync(out, wav);
      fs.writeFileSync(wj, JSON.stringify(nw));
      file = wav;
    }
    return { wav: file, words: nw, duration, removed: +cuts.reduce((x, [p, q]) => x + (q - p), 0).toFixed(2), cuts };
  } catch (e) {
    return { wav, words, duration: null, removed: 0, cuts: [], error: String(e?.message ?? e).slice(0, 200) };
  }
}
