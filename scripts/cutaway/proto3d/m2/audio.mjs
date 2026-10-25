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
  // the video with the end card has no caption once the card pops (the last word's caption sat on the sign); the one
  // without it keeps them all
  fs.writeFileSync(path.join(out, "captions.ass"), buildAss({ words, cards: A.cards }));
  fs.writeFileSync(path.join(out, "captions_end.ass"), buildAss({ words, cards: A.cards, until: M.signPop }));
  const { renderMix, loudness } = await import(pathToFileURL(path.join(wt, "render-worker/src/cutawayFinal.mjs")).href);
  const lib = (k) => path.join(wt, "render-worker/assets/sfx", `lib-${k}.mp3`);
  const sfx = A.sfx.map((s) => ({ url: lib(s.lib), start: s.start, duration: s.duration }));
  for (const s of sfx) if (!fs.existsSync(s.url)) throw new Error(`no library sound ${s.url}`);
  const voiceLufs = await loudness(path.join(out, "voice.mp3"), out);
  // a looped bed (crossfaded copies of a short file), laid `underDb` under the measured voice. Its boost is capped: a
  // near-silent room tone stays a whisper, never amplified hiss.
  const bed = async (src, name, from, len, underDb, clipLen) => {
    const CL = clipLen, STEP = CL - 0.5, n = Math.ceil(len / STEP) + 1;
    const parts = Array.from({ length: n }, (_, k) => `[0:a]atrim=0:${CL},asetpts=PTS-STARTPTS,afade=t=in:d=0.5,afade=t=out:st=${CL - 0.5}:d=0.5,adelay=${Math.round(k * STEP * 1000)}:all=1[r${k}]`);
    execFileSync(ff, ["-v", "error", "-y", "-i", src, "-filter_complex", `${parts.join(";")};${parts.map((_, k) => `[r${k}]`).join("")}amix=inputs=${n}:normalize=0,atrim=0:${len.toFixed(3)},afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, len - 1.6).toFixed(2)}:d=1.6,aformat=channel_layouts=stereo[o]`,
      "-map", "[o]", "-c:a", "libmp3lame", "-b:a", "160k", path.join(out, name)]);
    const lufs = await loudness(path.join(out, name), out);
    if (!Number.isFinite(voiceLufs) || !Number.isFinite(lufs)) return null;
    return { file: path.join(out, name), at: from, gain: +Math.min(BED_MAX_BOOST_DB, voiceLufs - underDb - lufs).toFixed(1), lufs: +lufs.toFixed(1) };
  };
  const beds = [];
  if (A.rain) { const b = await bed(lib("rain"), "rain.mp3", A.rain.from, A.rain.to - A.rain.from, A.rain.underDb, 3.5); if (!b) throw new Error("rain loudness not measured"); beds.push({ kind: "rain", ...b }); }
  const amb = A.ambience && path.join(wt, "render-worker/assets/sfx", `amb-${A.ambience.setting}.mp3`);
  const result = {};
  for (const [name, len, extra] of [["mix_end.mp3", M.lengthEnd, [M.signPop]], ["mix_noend.mp3", M.lengthNoEnd, []]]) {
    const r = await renderMix({ voice: { url: path.join(out, "voice.mp3"), tempo: 1 }, chimes: [...A.chimes, ...extra], sfx, lengthSec: len, levels: { sfxDb: -20, chimeDb: -20 } }, path.join(out, `mix-${name}`), name);
    const pre = path.join(out, `pre-${name}`);
    // the setting's ambience under the whole video (a missing file: none, as before)
    const all = [...beds];
    if (amb && fs.existsSync(amb)) { const b = await bed(amb, `amb-${name}`, 0, len, A.ambience.underDb, 8); if (b) all.push({ kind: "ambience", ...b }); }
    if (all.length) {
      const ins = all.flatMap((b) => ["-i", b.file]), fc = all.map((b, i) => `[${i + 1}:a]volume=${b.gain}dB,adelay=${Math.round(b.at * 1000)}:all=1[b${i}]`).join(";");
      execFileSync(ff, ["-v", "error", "-y", "-i", r.file, ...ins, "-filter_complex", `${fc};[0:a]${all.map((_, i) => `[b${i}]`).join("")}amix=inputs=${all.length + 1}:normalize=0:duration=first[o]`, "-map", "[o]", "-c:a", "libmp3lame", "-b:a", "192k", pre]);
    } else fs.copyFileSync(r.file, pre);
    const master = await masterTo(ff, pre, path.join(out, name), out, loudness);
    result[name] = { lengthSec: len, ...r.measured, beds: all.map(({ kind, lufs, gain }) => ({ kind, lufs, gain })), master };
  }
  return result;
}
// a bed is never boosted more than this (the room tone measures -70 LUFS: lifting it to 22 dB under the voice is hiss)
export const BED_MAX_BOOST_DB = 20;

// the finished mix's loudness: the creator's videos measure about -16 LUFS integrated (his traffic light -15.9, 2026-10-25);
// ours came out at -24.7, about 9 dB quieter on a phone. One gain to the target, the peaks held under -1 dBTP by a fast
// limiter, measured again (a second, smaller step if the limiter took it short).
export const MASTER = Object.freeze({ lufs: -16, ceilingDb: -1, maxGainDb: 14 });
async function masterTo(ff, src, dst, dir, loudness) {
  const lim = `alimiter=limit=${Math.pow(10, MASTER.ceilingDb / 20).toFixed(3)}:attack=5:release=60:level=false`;
  let cur = src, before = await loudness(src, dir), gain = 0, after = before;
  if (!Number.isFinite(before)) { fs.copyFileSync(src, dst); return { before, after, gain }; }
  for (let i = 0; i < 2; i++) {
    const g = Math.max(-6, Math.min(MASTER.maxGainDb - gain, MASTER.lufs - after));
    if (Math.abs(g) < 0.3) break;
    const next = path.join(dir, `master${i}-${path.basename(dst)}`);
    execFileSync(ff, ["-v", "error", "-y", "-i", cur, "-af", `volume=${g.toFixed(2)}dB,${lim}`, "-c:a", "libmp3lame", "-b:a", "192k", next]);
    cur = next; gain += g; after = await loudness(cur, dir);
  }
  fs.copyFileSync(cur, dst);
  return { before: +before.toFixed(1), after: +after.toFixed(1), gain: +gain.toFixed(1) };
}

if (/audio\.mjs$/.test(process.argv[1] ?? "")) {
  const [wt, ff, tlFile, voice, wordsFile, out] = process.argv.slice(2);
  const r = await buildAudio({ wt, ff, timeline: JSON.parse(fs.readFileSync(tlFile, "utf8")), voice, words: JSON.parse(fs.readFileSync(wordsFile, "utf8")), out });
  console.log(JSON.stringify(r));
}
