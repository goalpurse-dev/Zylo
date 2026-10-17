// Makes the Cutaway Explainer chime: a short two-tone "ding" (E6 then B6 struck
// together, B6 a hair later), bell-like decay, ~0.6 s. Synthesised with ffmpeg,
// so it is ours: no licence. The same file plays in every video.
//   node scripts/cutaway/makeChime.mjs  (needs ffmpeg on PATH, or FFMPEG)
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../render-worker/assets/sfx/chime.wav");
mkdirSync(path.dirname(out), { recursive: true });
const tone = (f, delay, amp) => `${amp}*sin(2*PI*${f}*(t-${delay}))*exp(-6*(t-${delay}))*gte(t,${delay})`;
const expr = [tone(1318.5, 0, 0.5), tone(1975.5, 0.06, 0.38), tone(2637, 0, 0.08)].join("+");
execFileSync(process.env.FFMPEG ?? "ffmpeg", [
  "-v", "error", "-y", "-f", "lavfi", "-i", `aevalsrc='${expr}':s=44100:d=0.7`,
  "-af", "afade=t=in:d=0.004,afade=t=out:st=0.55:d=0.15,aformat=channel_layouts=stereo", out,
]);
console.log("wrote", out);
