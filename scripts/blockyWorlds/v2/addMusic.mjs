// IN THIS TOWN v2: THE ENGINE'S OWN MUSIC under a finished video (owner 2026-11-24: "use the one we had"): bed A
// (engine/audio/backrooms.mjs: our original plinky, slightly eerie music-box loop; never the kit's track), sped to the
// voice's pace, 14 LU under the voice with a gentle 2.5 dB dip while someone talks (blenderKit/music.mjs OURS, as the
// live engine), ending on the cut to black (the black is silent), -14 LUFS. Free, local; the file without music is kept.
//   node scripts/blockyWorlds/v2/addMusic.mjs --name curtains
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeBed, measure, OURS } from "../blenderKit/music.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", `story_${arg("name", "curtains")}`);
const SRC = path.join(OUT, arg("in", "final_1080p.mp4"));
const DST = path.join(OUT, arg("out", "final_1080p_music.mp4"));
const V = JSON.parse(fs.readFileSync(path.join(OUT, "voice.json"), "utf8"));
const ff = (a) => execFileSync("ffmpeg", ["-v", "error", "-y", ...a]);
const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", SRC]).toString());
const cut = +(V.words.at(-1).end + 0.6).toFixed(2);   // the cut to black (previewVideo: the last word + 0.6 s)
// the bed: the engine's bed A, to the cut (it ends on its own cadence there)
const bed = path.join(OUT, "music_bedA.wav");
await makeBed({ seconds: cut, out: bed });
// the levels: the bed OURS.underVoiceDb (14) LU under the voice, measured (integrated loudness, as the engine)
const voiceWav = path.join(OUT, "final_voice.wav");
ff(["-i", SRC, "-vn", "-ac", "2", "-c:a", "pcm_s16le", voiceWav]);
const v = measure(voiceWav), b = measure(bed);
const gain = +(v.lufs - OURS.underVoiceDb - b.lufs).toFixed(2);
// the dip while someone talks: a gentle sidechain (about OURS.dipDb), then voice + bed, -14 LUFS, silent on the black
const fc = [
  `[1:a]aformat=channel_layouts=stereo,volume=${gain}dB,afade=t=out:st=${(cut - 0.08).toFixed(2)}:d=0.08,apad,atrim=0:${dur.toFixed(2)}[bed]`,
  `[0:a]aformat=channel_layouts=stereo,asplit=2[v][sc]`,
  `[bed][sc]sidechaincompress=threshold=0.05:ratio=1.6:attack=30:release=400:makeup=1[duck]`,
  `[v][duck]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]`,
].join(";");
ff(["-i", SRC, "-i", bed, "-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", DST]);
fs.rmSync(voiceWav, { force: true });
console.log(`music: ${DST}: bed A (the engine's own), ${OURS.underVoiceDb} LU under the voice (voice ${v.lufs} LUFS, bed ${b.lufs} LUFS -> ${gain} dB), gentle dip under speech, silent from the cut at ${cut} s`);
