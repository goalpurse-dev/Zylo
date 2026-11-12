// Blocky Worlds engine: the real narrator (ElevenLabs "Little Dude II", config.js NARRATOR) with word timings.
// A PAID call (~0.44 ElevenLabs credits a character on the owner's plan). One take per script: a finished take in the
// out folder (voice.mp3 + take.json) is reused, never bought twice, unless force is set.
// The pace: the voice's own pauses between words longer than MAX_GAP are cut down to GAP (config.js PACE: the 260 wpm
// comes from short lines and trimmed silences, never from speeding the audio up).
//   elevenVoice({ lines, outDir, apiKey }) -> { wav, words: [{ word, start, end }], duration, wpm, costUsd, billedChars }
//   node voice/eleven.mjs <script.json> <outDir> --yes        (reads ELEVENLABS_KEY from C:\Users\Public\Zylo\.env.local)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { NARRATOR } from "../../../../supabase/functions/_shared/blockyWorlds/config.js";
import { synthesize } from "../../../../supabase/functions/_shared/blockyWorlds/voice.js";

const FF = process.env.FFMPEG ?? "ffmpeg";
const GAP = 0.1, MAX_GAP = 0.18, EDGE = 0.04;

export function envKey(name, file = "C:/Users/Public/Zylo/.env.local") {
  const line = fs.readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : null;
}

/** The kept stretches of audio: every word, with long pauses between words cut down to GAP. */
export function keepRanges(spoken, duration) {
  const out = [];
  let a = Math.max(0, spoken[0].s - EDGE);
  for (let i = 0; i < spoken.length - 1; i++) {
    const gap = spoken[i + 1].s - spoken[i].e;
    if (gap > MAX_GAP) { out.push([a, spoken[i].e + GAP / 2]); a = spoken[i + 1].s - GAP / 2; }
  }
  out.push([a, Math.min(duration, spoken.at(-1).e + EDGE * 3)]);
  return out;
}
/** A time in the original take -> the same moment in the trimmed audio. */
export function remap(t, ranges) {
  let shift = 0, prevEnd = 0;
  for (const [a, b] of ranges) {
    shift += a - prevEnd; prevEnd = b;
    if (t <= b) return Math.max(0, Math.max(t, a) - shift);
  }
  return prevEnd - shift;
}

export async function elevenVoice({ lines, outDir, apiKey = null, force = false }) {
  fs.mkdirSync(outDir, { recursive: true });
  const mp3 = path.join(outDir, "voice.mp3"), takeJson = path.join(outDir, "take.json");
  const text = lines.map((l) => String(l.text ?? l).trim()).filter(Boolean).join("\n");
  let take = fs.existsSync(takeJson) && fs.existsSync(mp3) ? JSON.parse(fs.readFileSync(takeJson, "utf8")) : null;
  if (take && take.text !== text) throw new Error("voice.mp3 in this folder is a take of a different script; use a new out folder (no second paid take by accident)");
  if (!take || force) {
    const key = apiKey ?? envKey("ELEVENLABS_KEY");
    if (!key) throw new Error("ELEVENLABS_KEY missing");
    const r = await synthesize({ apiKey: key, text, narrator: NARRATOR });
    fs.writeFileSync(mp3, Buffer.from(r.audioBase64, "base64"));
    take = { text, spoken: r.spoken, costUsd: r.costUsd, billedChars: r.costUsd != null ? Math.round(r.costUsd / 0.0002) : null, chars: text.length, voice: NARRATOR.voiceName, model: NARRATOR.model, at: new Date().toISOString() };
    fs.writeFileSync(takeJson, JSON.stringify(take, null, 1));
  }
  // trim the long pauses, then map the timings onto the trimmed audio
  const rawDur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3]).toString());
  const ranges = keepRanges(take.spoken, rawDur);
  const parts = ranges.map(([a, b], i) => `[s${i}]atrim=${a.toFixed(3)}:${b.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.008,afade=t=out:st=${Math.max(0, b - a - 0.008).toFixed(3)}:d=0.008[p${i}]`);
  const graph = `[0:a]asplit=${ranges.length}${ranges.map((_, i) => `[s${i}]`).join("")};${parts.join(";")};${ranges.map((_, i) => `[p${i}]`).join("")}concat=n=${ranges.length}:v=0:a=1[out]`;
  const graphFile = path.join(outDir, "trim.graph");
  fs.writeFileSync(graphFile, graph);
  const wav = path.join(outDir, "voice.wav");
  execFileSync(FF, ["-v", "error", "-y", "-i", mp3, "-/filter_complex", graphFile, "-map", "[out]", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", wav]);
  const words = take.spoken.map((w) => ({ word: w.w, start: +remap(w.s, ranges).toFixed(3), end: +remap(w.e, ranges).toFixed(3) }));
  const duration = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]).toString());
  fs.writeFileSync(path.join(outDir, "words.json"), JSON.stringify(words));
  return { wav, words, duration, rawDuration: rawDur, wpm: Math.round(words.length / (duration / 60)), costUsd: take.costUsd, billedChars: take.billedChars, chars: take.chars };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [scriptPath, outDir] = process.argv.slice(2);
  if (!process.argv.includes("--yes")) { console.log("a paid ElevenLabs take: add --yes"); process.exit(1); }
  const s = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
  const r = await elevenVoice({ lines: (s.script ?? s).lines, outDir });
  console.log(JSON.stringify({ ...r, words: r.words.length }));
}
