// IN THIS TOWN: THE VOICE TRACK WITH CHARACTER VOICES (owner 2026-11-22, round 3). The narrator's words in the owner's
// "roblox-story" voice, every quoted part in its speaker's own voice (castVoices.js: picked once, saved with the cast).
// Each part is its own take (with timestamps), made at 1.2 and sped up to 1.25 after (pitch kept), long pauses trimmed
// like the narrator's (eleven.mjs keepRanges); the parts are joined with a short gap; the words keep their times.
// A PAID call per part (one take per part, cached in outDir/parts: never bought twice).
//   castVoice({ script, voices, outDir, apiKey }) -> { wav, words: [{ word, start, end, who }], duration, costUsd, parts }
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { synthesize } from "../../../../supabase/functions/_shared/blockyWorlds/voice.js";
import { VOICE_TYPES, voiceParts, spokenText } from "../../../../supabase/functions/_shared/blockyWorlds/castVoices.js";
import { keepRanges, remap, tempoFor } from "./eleven.mjs";

const FF = process.env.FFMPEG ?? "ffmpeg";
const GAP_S = 0.15;   // round 4: about 0.15 s between the parts (the lines)
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

/** the narrator config of a part */
export function voiceOf(who, voices = {}) {
  if (who === "narrator") return voices.narrator?.narrator ?? VOICE_TYPES.narrator;
  const v = voices[who] ?? voices[Object.keys(voices).find((k) => k.toLowerCase() === String(who).toLowerCase())];
  if (v?.narrator) return v.narrator;   // a full voice (its own model, settings and pace)
  const base = VOICE_TYPES[v?.type] ?? VOICE_TYPES.kid_boy;
  return v?.voiceId && v.voiceId !== base.voiceId ? { ...base, voiceId: v.voiceId } : base;
}

/** one part: a take (cached), trimmed + sped up -> { wav, words (local times), costUsd } */
export async function partTake({ text, narrator, dir, apiKey, pace = null }) {
  fs.mkdirSync(dir, { recursive: true });
  const mp3 = path.join(dir, "take.mp3"), tj = path.join(dir, "take.json");
  let take = fs.existsSync(tj) && fs.existsSync(mp3) ? JSON.parse(fs.readFileSync(tj, "utf8")) : null;
  if (take && (take.text !== text || take.voiceId !== narrator.voiceId || JSON.stringify(take.settings) !== JSON.stringify(narrator.settings) || (take.model ?? null) !== (narrator.model ?? null))) take = null;
  let costUsd = 0;
  if (!take) {
    const r = await synthesize({ apiKey, text, narrator });
    fs.writeFileSync(mp3, Buffer.from(r.audioBase64, "base64"));
    take = { text, spoken: r.spoken, costUsd: r.costUsd ?? text.length * 0.000088, voiceId: narrator.voiceId, voice: narrator.voiceName, settings: narrator.settings, model: narrator.model ?? null };
    fs.writeFileSync(tj, JSON.stringify(take, null, 1));
    costUsd = take.costUsd;
  }
  const ranges = keepRanges(take.spoken, dur(mp3));
  const tempo = tempoFor(pace ? { ...narrator, pace } : narrator);
  const parts = ranges.map(([a, b], i) => `[s${i}]atrim=${a.toFixed(3)}:${b.toFixed(3)},asetpts=PTS-STARTPTS[p${i}]`);
  const graph = `[0:a]asplit=${ranges.length}${ranges.map((_, i) => `[s${i}]`).join("")};${parts.join(";")};${ranges.map((_, i) => `[p${i}]`).join("")}concat=n=${ranges.length}:v=0:a=1${tempo !== 1 ? `[c];[c]atempo=${tempo}` : ""}[out]`;
  const gf = path.join(dir, "trim.graph"); fs.writeFileSync(gf, graph);
  const wav = path.join(dir, `part_${tempo}.wav`);
  execFileSync(FF, ["-v", "error", "-y", "-i", mp3, "-/filter_complex", gf, "-map", "[out]", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", wav]);
  const words = take.spoken.map((w) => ({ word: w.w, start: +(remap(w.s, ranges) / tempo).toFixed(3), end: +(remap(w.e, ranges) / tempo).toFixed(3) }));
  return { wav, words, costUsd, seconds: dur(wav), tempo };
}

export async function castVoice({ script, voices = {}, outDir, apiKey, pace = null, log = () => {} }) {
  const parts = voiceParts(script);
  let costUsd = 0, t = 0;
  const words = [], wavs = [];
  for (const [i, p] of parts.entries()) {
    const narrator = voiceOf(p.who, voices);
    const r = await partTake({ text: spokenText(p.text), narrator, dir: path.join(outDir, "parts", String(i).padStart(2, "0")), apiKey, pace: narrator.ownPace ? null : pace });
    costUsd += r.costUsd;
    for (const w of r.words) words.push({ word: w.word, start: +(t + w.start).toFixed(3), end: +(t + w.end).toFixed(3), who: p.who });
    wavs.push(r.wav);
    t += r.seconds + GAP_S;
    log(`part ${i} ${p.who} (${narrator.voiceName}): ${r.seconds.toFixed(2)} s`);
  }
  // join with the gap (a short silence between the parts)
  const list = path.join(outDir, "parts.txt");
  const gap = path.join(outDir, "gap.wav");
  execFileSync(FF, ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(GAP_S), "-c:a", "pcm_s16le", gap]);
  fs.writeFileSync(list, wavs.flatMap((w, i) => [`file '${w.replace(/\\/g, "/")}'`, ...(i + 1 < wavs.length ? [`file '${gap.replace(/\\/g, "/")}'`] : [])]).join("\n"));
  const wav = path.join(outDir, "voice.wav");
  execFileSync(FF, ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c:a", "pcm_s16le", wav]);
  fs.writeFileSync(path.join(outDir, "words.json"), JSON.stringify(words));
  return { wav, words, duration: dur(wav), costUsd: +costUsd.toFixed(5), parts: parts.map((p) => ({ who: p.who, text: p.text })) };
}
