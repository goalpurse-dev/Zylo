// Blender kit engine: fit a finished take to a length by dropping WHOLE LINES (free, local ffmpeg; no new paid take).
// The processed take (studio/pace.mjs: voice.wav + words.json, 1.25x, pauses 0.10 / 0.22 s) is cut at the middle of the
// sentence gap before each dropped line, the kept parts are joined with 8 ms fades, and every kept word's time moves
// back by what was cut before it. The script loses the same lines (a script-approval edit: the caller logs it).
//   node trim.mjs --run <prepare.mjs out dir> --drop 5,6,15 [--out <dir>]   -> <out>/voice.wav, words.json, script.json
//   trimTake({ wav, words, script, drop, outDir }) -> { duration, words, script, cutS }
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const FF = process.env.FFMPEG ?? "ffmpeg";
const probe = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

/** [first word index, last+1] of each line (whitespace tokens; the take's words are the script's words) */
export function lineSpans(script, words) {
  const spans = []; let k = 0;
  for (const l of script.lines) { const c = String(l.text).trim().split(/\s+/).filter(Boolean).length; spans.push([k, k + c]); k += c; }
  if (k !== words.length) throw new Error(`the script has ${k} words, the take ${words.length}: cannot trim by line`);
  return spans;
}

export function trimTake({ wav, words, script, drop, outDir }) {
  const spans = lineSpans(script, words), dur = probe(wav);
  const cutAt = (li) => (li <= 0 ? 0 : li >= spans.length ? dur : Math.max(0, words[spans[li][0]].start - Math.min(0.11, (words[spans[li][0]].start - words[spans[li][0] - 1].end) / 2)));
  const keep = spans.map((_, li) => li).filter((li) => !drop.includes(li));
  const parts = keep.map((li) => [cutAt(li), cutAt(li + 1)]);
  fs.mkdirSync(outDir, { recursive: true });
  const graph = `[0:a]asplit=${parts.length}${parts.map((_, i) => `[s${i}]`).join("")};` + parts.map(([a, b], i) => `[s${i}]atrim=${a.toFixed(4)}:${b.toFixed(4)},asetpts=PTS-STARTPTS,afade=t=in:d=0.008,afade=t=out:st=${Math.max(0, b - a - 0.008).toFixed(4)}:d=0.008[p${i}]`).join(";") + `;${parts.map((_, i) => `[p${i}]`).join("")}concat=n=${parts.length}:v=0:a=1[out]`;
  const gf = path.join(outDir, "trim.graph"); fs.writeFileSync(gf, graph);
  const out = path.join(outDir, "voice.wav");
  execFileSync(FF, ["-v", "error", "-y", "-i", wav, "-/filter_complex", gf, "-map", "[out]", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", out]);
  const nw = [], lines = [];
  let shift = 0, prevEnd = 0;
  keep.forEach((li, i) => {
    const [a, b] = parts[i];
    shift += a - prevEnd; prevEnd = b;
    for (let k = spans[li][0]; k < spans[li][1]; k++) nw.push({ word: words[k].word, start: +(words[k].start - shift).toFixed(3), end: +(words[k].end - shift).toFixed(3) });
    lines.push(script.lines[li]);
  });
  const sc = { ...script, lines };
  fs.writeFileSync(path.join(outDir, "words.json"), JSON.stringify(nw));
  fs.writeFileSync(path.join(outDir, "script.json"), JSON.stringify(sc, null, 1));
  return { duration: probe(out), words: nw, script: sc, cutS: +(dur - probe(out)).toFixed(2), dropped: drop.map((li) => script.lines[li].text) };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("trim.mjs")) {
  const argv = process.argv.slice(2), arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
  const run = path.resolve(arg("run")), outDir = path.resolve(arg("out", path.join(run, "trim")));
  const drop = String(arg("drop", "")).split(",").filter(Boolean).map(Number);
  const r = trimTake({ wav: path.join(run, "voice", "voice.wav"), words: JSON.parse(fs.readFileSync(path.join(run, "voice", "words.json"), "utf8")), script: JSON.parse(fs.readFileSync(path.join(run, "results.json"), "utf8")).results[0].script, drop, outDir });
  console.log(JSON.stringify({ duration: r.duration, cutS: r.cutS, words: r.words.length, lines: r.script.lines.length, dropped: r.dropped }, null, 1));
}
