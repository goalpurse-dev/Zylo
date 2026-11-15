// STUDIO MODE: the voice pace (owner 2026-11-13): ALWAYS 1.25x at the same pitch; the pace is tightened ONLY by cutting
// pauses: ~0.10 s inside a sentence, ~0.22 s between sentences, never a gap over 0.45 s (all measured in the FINAL,
// sped-up audio). The paid take (voice/eleven.mjs: take.json + voice.mp3, the raw ElevenLabs words) is re-processed here,
// free (local ffmpeg); wpm is reported (engine paceStats), never a reason to fail a run.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ELEVEN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../engine/voice/eleven.mjs");
export const PACE = Object.freeze({ speed: 1.25, inSentence: 0.10, betweenSentences: 0.22, maxGap: 0.45, edge: 0.04 });
const FF = process.env.FFMPEG ?? "ffmpeg";

/** the kept stretches of the raw take: every gap longer than its target (raw seconds = final target x speed) is cut */
export function pauseRanges(spoken, rawDuration, P = PACE) {
  const out = [];
  let a = Math.max(0, spoken[0].s - P.edge);
  for (let i = 0; i < spoken.length - 1; i++) {
    const gap = spoken[i + 1].s - spoken[i].e;
    const sentenceEnd = /[.!?…]["')\]]*$/.test(String(spoken[i].w).trim());
    const target = Math.min(P.maxGap, sentenceEnd ? P.betweenSentences : P.inSentence) * P.speed;
    if (gap > target) { out.push([a, spoken[i].e + target / 2]); a = spoken[i + 1].s - target / 2; }
  }
  out.push([a, Math.min(rawDuration, spoken.at(-1).e + P.edge * 3)]);
  return out;
}

/** re-process the take in outDir (take.json + voice.mp3) -> { wav, words, duration, pace, speed } (free) */
export async function processTake({ outDir, P = PACE }) {
  const { remap, paceStats } = await import(pathToFileURL(ELEVEN).href);
  const take = JSON.parse(fs.readFileSync(path.join(outDir, "take.json"), "utf8")), mp3 = path.join(outDir, "voice.mp3");
  const rawDur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).toString());
  const ranges = pauseRanges(take.spoken, rawDur, P);
  const parts = ranges.map(([a, b], i) => `[s${i}]atrim=${a.toFixed(3)}:${b.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.008,afade=t=out:st=${Math.max(0, b - a - 0.008).toFixed(3)}:d=0.008[p${i}]`);
  const graph = `[0:a]asplit=${ranges.length}${ranges.map((_, i) => `[s${i}]`).join("")};${parts.join(";")};${ranges.map((_, i) => `[p${i}]`).join("")}concat=n=${ranges.length}:v=0:a=1[cat];[cat]atempo=${P.speed}[out]`;
  const graphFile = path.join(outDir, "pause.graph"); fs.writeFileSync(graphFile, graph);
  const wav = path.join(outDir, "voice.wav");
  execFileSync(FF, ["-v", "error", "-y", "-i", mp3, "-/filter_complex", graphFile, "-map", "[out]", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", wav]);
  const words = take.spoken.map((w) => ({ word: w.w, start: +(remap(w.s, ranges) / P.speed).toFixed(3), end: +(remap(w.e, ranges) / P.speed).toFixed(3) }));
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]).toString());
  fs.writeFileSync(path.join(outDir, "words.json"), JSON.stringify(words));
  let maxGap = 0; for (let i = 1; i < words.length; i++) maxGap = Math.max(maxGap, words[i].start - words[i - 1].end);
  return { wav, words, duration, pace: paceStats(words), maxGap: +maxGap.toFixed(3), speed: P.speed, costUsd: take.costUsd ?? null };
}
