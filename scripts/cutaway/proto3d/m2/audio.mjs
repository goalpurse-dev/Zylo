// M2: the sound and captions for a compiled timeline ($0, local). The French drain's rules (drainAudio.mjs), for
// any layout: one-word captions and the number cards; library effects at -20 dB and chimes at -20 dB under the
// measured voice; a chime when the sign pops (end-card version only); a rain bed (the library rain, looped with
// crossfades) laid 24 dB under the voice, when the layout has rain. No music, no whooshes.
//   node m2/audio.mjs <worktree> <ffmpeg> <timeline.json> <voice.mp3> <words.json> <outDir>
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export async function buildAudio({ wt, ff, timeline: tl, voice, words, out }) {
  process.env.FFMPEG = ff;
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(voice, path.join(out, "voice.mp3"));
  const A = tl.audio, M = tl.marks;
  const { buildAss } = await import(pathToFileURL(path.join(wt, "render-worker/src/cutawayFinalPlan.mjs")).href);
  fs.writeFileSync(path.join(out, "captions.ass"), buildAss({ words, cards: A.cards }));
  const { renderMix, loudness } = await import(pathToFileURL(path.join(wt, "render-worker/src/cutawayFinal.mjs")).href);
  const lib = (k) => path.join(wt, "render-worker/assets/sfx", `lib-${k}.mp3`);
  const sfx = A.sfx.map((s) => ({ url: lib(s.lib), start: s.start, duration: s.duration }));
  for (const s of sfx) if (!fs.existsSync(s.url)) throw new Error(`no library sound ${s.url}`);
  let rain = null;
  if (A.rain) {
    const rainA = A.rain.from, rainLen = A.rain.to - A.rain.from;
    const src = lib("rain"), CL = 3.5, STEP = CL - 0.5, n = Math.ceil(rainLen / STEP) + 1;
    const parts = Array.from({ length: n }, (_, k) => `[0:a]atrim=0:${CL},asetpts=PTS-STARTPTS,afade=t=in:d=0.5,afade=t=out:st=${CL - 0.5}:d=0.5,adelay=${Math.round(k * STEP * 1000)}:all=1[r${k}]`);
    execFileSync(ff, ["-v", "error", "-y", "-i", src, "-filter_complex", `${parts.join(";")};${parts.map((_, k) => `[r${k}]`).join("")}amix=inputs=${n}:normalize=0,atrim=0:${rainLen.toFixed(3)},afade=t=in:d=0.6,afade=t=out:st=${(rainLen - 1.6).toFixed(2)}:d=1.6,aformat=channel_layouts=stereo[o]`,
      "-map", "[o]", "-c:a", "libmp3lame", "-b:a", "160k", path.join(out, "rain.mp3")]);
    const voiceLufs = await loudness(path.join(out, "voice.mp3"), out), rainLufs = await loudness(path.join(out, "rain.mp3"), out);
    if (!Number.isFinite(voiceLufs) || !Number.isFinite(rainLufs)) throw new Error(`loudness not measured (voice ${voiceLufs}, rain ${rainLufs})`);
    rain = { at: rainA, gain: +(voiceLufs - A.rain.underDb - rainLufs).toFixed(1), rainLufs };
  }
  const result = {};
  for (const [name, len, extra] of [["mix_end.mp3", M.lengthEnd, [M.signPop]], ["mix_noend.mp3", M.lengthNoEnd, []]]) {
    const r = await renderMix({ voice: { url: path.join(out, "voice.mp3"), tempo: 1 }, chimes: [...A.chimes, ...extra], sfx, lengthSec: len, levels: { sfxDb: -20, chimeDb: -20 } }, path.join(out, `mix-${name}`), name);
    if (rain) execFileSync(ff, ["-v", "error", "-y", "-i", r.file, "-i", path.join(out, "rain.mp3"), "-filter_complex", `[1:a]volume=${rain.gain}dB,adelay=${Math.round(rain.at * 1000)}:all=1[r];[0:a][r]amix=inputs=2:normalize=0:duration=first[o]`, "-map", "[o]", "-c:a", "libmp3lame", "-b:a", "192k", path.join(out, name)]);
    else fs.copyFileSync(r.file, path.join(out, name));
    result[name] = { lengthSec: len, ...r.measured, ...(rain ? { rainLufs: rain.rainLufs, rainGain: rain.gain } : {}) };
  }
  return result;
}

if (/audio\.mjs$/.test(process.argv[1] ?? "")) {
  const [wt, ff, tlFile, voice, wordsFile, out] = process.argv.slice(2);
  const r = await buildAudio({ wt, ff, timeline: JSON.parse(fs.readFileSync(tlFile, "utf8")), voice, words: JSON.parse(fs.readFileSync(wordsFile, "utf8")), out });
  console.log(JSON.stringify(r));
}
