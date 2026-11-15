// Blender kit engine: OUR background track in the kit's finish step, at the level of our own videos (owner, 2026-11-13:
// the #2 video "The Kid Who Never Blinks"). That video's prepare (engine/runpod/worker.mjs) used the engine's bed "A"
// (audio/mix.mjs bedFromLoop -> audio/backrooms.mjs, sped to the voice's pace: AUDIO_SIMPLE.bedTempo 1.25) mixed by
// audio/mix.mjs mixV2: the bed AUDIO_SIMPLE.musicUnderVoiceDb (14) LU under the voice (its stems measure exactly that),
// a gentle dip while the narrator talks, the whole mix to -14 LUFS.
// The kit's tools/mix.py works by PEAKS instead (voice peak -1.5 dBFS, music peak at --music-db, the music 5 dB lower
// while the voice talks). kitMusicDb() picks the --music-db that puts the kit's music stem 14 LU under its voice, as in #2
// (audible under the voice). The bed is already at the voice's pace: --music-speed 1.
//   makeBed({ seconds, out })                    -> the bed wav (free, local)
//   kitMusicDb({ voice, bed })                   -> { musicDb, voiceLufs, voicePeak, bedLufs, bedPeak }
//   node music.mjs --voice <voice.wav> --out <dir> [--kit <kit root>]   -> the check: both mixes, measured stems (free)
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, "../engine");
export const OURS = Object.freeze({ bed: "A", underVoiceDb: 14, dipDb: 2.5, kitDuckDb: 5, kitVoicePeakDb: -1.5 });

const probeDur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
/** integrated loudness (LUFS) and sample peak (dBFS) by ffmpeg (ebur128 + astats), as STEREO (the kit and the engine
 *  both play the mono voice on both channels: measured mono it reads 3 LU quieter) */
export function measure(file) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "aformat=channel_layouts=stereo,ebur128=framelog=quiet,astats=metadata=0:measure_perchannel=0", "-f", "null", "-"], { encoding: "utf8" });
  const t = r.stderr;
  const lufs = Number((t.match(/I:\s+(-?[\d.]+) LUFS/g) ?? []).pop()?.match(/-?[\d.]+/)?.[0]);
  const peak = Number((t.match(/Peak level dB:\s*(-?[\d.inf]+)/g) ?? []).pop()?.match(/-?[\d.]+|-inf/)?.[0]);
  return { lufs, peak };
}

/** the engine's bed A at the voice's pace, `seconds` long (as the #2 prepare made it) */
export async function makeBed({ seconds, out }) {
  const { bedFromLoop } = await import(pathToFileURL(path.join(ENGINE, "audio", "mix.mjs")).href);
  const { AUDIO_SIMPLE } = await import(pathToFileURL(path.join(ENGINE, "lib", "audioPlan.js")).href);
  await bedFromLoop(OURS.bed, seconds, out, { tempo: AUDIO_SIMPLE.bedTempo });
  return out;
}

/** the kit's --music-db for our level: the music, after the kit's duck, 14 LU under the voice (as #2: its music stem,
 *  after its dip, measures 14 LU under its voice stem). The narration runs almost wall to wall, so the kit's 5 dB duck is
 *  counted in full (first check: without it the music came out 18.6 LU under) */
export function kitMusicDb({ voice, bed }) {
  const v = measure(voice), b = measure(bed);
  const voiceAfter = v.lufs + (OURS.kitVoicePeakDb - v.peak);              // the voice after mix.py's peak normalisation
  const musicPre = voiceAfter - OURS.underVoiceDb + OURS.kitDuckDb;            // pre-duck: after the 5 dB duck it sits 14 LU under
  const musicDb = +(musicPre - b.lufs + b.peak).toFixed(2);                // the bed's peak that gives that loudness
  return { musicDb, voiceLufs: +v.lufs.toFixed(2), voicePeak: +v.peak.toFixed(2), bedLufs: +b.lufs.toFixed(2), bedPeak: +b.peak.toFixed(2) };
}

// ---------------------------------------------------------------- the free check (laptop)
if (process.argv[1]?.endsWith("music.mjs")) {
  const argv = process.argv.slice(2), arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
  const voice = path.resolve(arg("voice")), out = path.resolve(arg("out")); fs.mkdirSync(out, { recursive: true });
  const kit = path.resolve(arg("kit", path.resolve(HERE, "../../../reference/blocky-worlds/roblox-story-kit/unzipped/roblox-story-kit")));
  const dur = probeDur(voice), bed = path.join(out, "music_bed.wav");
  await makeBed({ seconds: dur, out: bed });
  const k = kitMusicDb({ voice, bed });
  // 1. ours (#2's way): the engine's mixV2 with its stems
  const { mixAudio } = await import(pathToFileURL(path.join(ENGINE, "audio", "mix.mjs")).href);
  const stems = path.join(out, "engine_stems"); fs.mkdirSync(stems, { recursive: true });
  const eng = await mixAudio({ voice, music: bed, out: path.join(out, "engine_mix.m4a"), duration: dur, sfxCues: [], musicUnderVoiceDb: OURS.underVoiceDb, stemsDir: stems });
  const stemFiles = fs.readdirSync(stems);
  const eV = measure(path.join(stems, stemFiles.find((f) => /voice/i.test(f)))), eM = measure(path.join(stems, stemFiles.find((f) => /music/i.test(f))));
  // 2. the kit's mix.py (read-only, run from the kit's folder) with our bed at the computed --music-db; the music stem
  //    = the mix minus the same mix with a silent bed (mix.py's limiter barely acts: its report says so)
  const silent = path.join(out, "silent.wav");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", String(dur), silent]);
  const cues = path.join(out, "no_cues.json"); fs.writeFileSync(cues, "[]");
  const kmix = (music, o) => { const r = spawnSync("python", ["-P", path.join(kit, "engine", "tools", "mix.py"), "--voice", voice, "--cues", cues, "--music", music, "--music-db", String(k.musicDb), "--out", o], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-500)); return r.stdout.trim(); };
  const logA = kmix(bed, path.join(out, "kit_mix.wav")), logB = kmix(silent, path.join(out, "kit_voice_only.wav"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(out, "kit_mix.wav"), "-i", path.join(out, "kit_voice_only.wav"), "-filter_complex", "[0:a][1:a]amerge=inputs=2,pan=stereo|c0=c0-c2|c1=c1-c3[m]", "-map", "[m]", path.join(out, "kit_music_stem.wav")]);
  const kV = measure(path.join(out, "kit_voice_only.wav")), kM = measure(path.join(out, "kit_music_stem.wav")), kAll = measure(path.join(out, "kit_mix.wav"));
  const res = {
    bed: `engine bed ${OURS.bed} x1.25 (${dur.toFixed(1)} s)`, kitMusicDb: k,
    ours_like_video2: { voiceLufs: eV.lufs, musicLufs: eM.lufs, musicUnderVoiceLU: +(eV.lufs - eM.lufs).toFixed(1), mixLufs: eng.lufs },
    kit_finish_with_our_bed: { voiceLufs: kV.lufs, musicLufs: kM.lufs, musicUnderVoiceLU: +(kV.lufs - kM.lufs).toFixed(1), mixLufs: kAll.lufs, peak: kAll.peak, mixLog: logA },
  };
  fs.writeFileSync(path.join(out, "music-check.json"), JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
}
