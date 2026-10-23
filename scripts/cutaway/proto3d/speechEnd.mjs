// $0: where the voice really stops, measured from the audio (ffmpeg silencedetect), not from the word timestamps.
// The aligner's last word can run ~0.4 s past the audible end, which pushed the end card too late.
import { spawnSync } from "node:child_process";

export function speechEnd(ff, file, { noiseDb = -40, minSilence = 0.3 } = {}) {
  const r = spawnSync(ff, ["-hide_banner", "-i", file, "-af", `silencedetect=n=${noiseDb}dB:d=${minSilence}`, "-f", "null", "-"], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${file}: ${String(r.stderr).slice(-300)}`);
  const starts = [...r.stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  if (!starts.length) throw new Error(`no trailing silence found in ${file}`);
  return +starts.at(-1).toFixed(3); // the trailing silence is the last one
}
