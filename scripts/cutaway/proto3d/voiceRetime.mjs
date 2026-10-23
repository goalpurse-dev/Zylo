// $0: re-time the three paid takes (already on disk) so their MEASURED pauses match the creator's: the gap between
// word timestamps is set smaller than the target, because a word's audible tail fades into the measured silence.
// Speech is never sped up: only silence between chunks is removed or added.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const [ff, V, SENT = "0.08", SECT = "0.16", COMMA = "0.0"] = process.argv.slice(2);
const SECTION = /^(But|So|This|Add|Congratulations|That)\b/;
const G = { sent: Number(SENT), sect: Number(SECT), comma: Number(COMMA) };
function assemble(pieces, out) {
  const inputs = [...new Set(pieces.map((p) => p.file))];
  const filt = pieces.map((p, i) => `[${inputs.indexOf(p.file)}:a]atrim=start=${p.s.toFixed(3)}:end=${p.e.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.006,afade=t=out:st=${Math.max(0, p.e - p.s - 0.008).toFixed(3)}:d=0.008,apad=pad_dur=${p.gapAfter.toFixed(3)}[p${i}]`);
  execFileSync(ff, ["-v", "error", "-y", ...inputs.flatMap((f) => ["-i", f]), "-filter_complex", `${filt.join(";")};${pieces.map((_, i) => `[p${i}]`).join("")}concat=n=${pieces.length}:v=0:a=1[o]`, "-map", "[o]", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "192k", out]);
}
for (const k of ["a", "b", "c"]) {
  const src = `${V}/voice_${k}.mp3`, words = JSON.parse(fs.readFileSync(`${V}/voice_${k}.words.json`, "utf8"));
  const pieces = [], nw = []; let a = Math.max(0, words[0].s - 0.03), T = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i], nx = words[i + 1], real = nx ? nx.s - w.e : 0;
    const target = !nx ? null : /[.!?]$/.test(w.w) ? (SECTION.test(nx.w) ? G.sect : G.sent) : /,$/.test(w.w) ? G.comma : real > 0.12 ? 0.06 : null;
    nw.push({ w: w.w, s: +(T + w.s - a).toFixed(3), e: +(T + w.e - a).toFixed(3) });
    if (!nx || target !== null) {
      const b = w.e + 0.03, gapAfter = nx ? Math.max(0, target - 0.06) : 0.6;
      pieces.push({ file: src, s: a, e: b, gapAfter }); T += b - a + gapAfter;
      if (nx) a = Math.max(w.e + 0.03, nx.s - 0.03) - (target < 0.06 ? Math.max(0, 0.06 - target) / 2 : 0);
    }
  }
  const out = `${V}/voice_${k}_v2.mp3`; assemble(pieces, out); fs.writeFileSync(out.replace(".mp3", ".words.json"), JSON.stringify(nw));
  const dur = nw.at(-1).e; console.log(k, `${nw.length} words, ${dur.toFixed(1)} s, ${Math.round((nw.length / dur) * 60)} wpm`);
}
