// Blocky Worlds final audio mix (AUDIO agent): voice + music bed ducked under the voice + a soft whoosh on part changes,
// two-pass loudnorm to about -14 LUFS (true peak -1.5 dB), AAC 192k, exactly `duration` seconds. ffmpeg on PATH.
//
//   import { mixAudio } from "./audio/mix.mjs";
//   await mixAudio({ voice: "voice.wav", music: "music.wav", out: "mix.m4a", duration: timeline.duration, shots: timeline.shots });
//
// CLI: node audio/mix.mjs <voice.wav> <music.wav> <out.m4a> <duration> [timeline.json]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeWav } from "../lib/audioWav.mjs";
import { rng } from "../lib/rng.js";

const SR = 44100;

function ffmpeg(args) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${r.status}): ${(r.stderr || "").slice(-2000)}`);
  return r.stderr || "";
}

/** Times (s) where the story's part changes (shots[i].part !== shots[i-1].part), skipping t < 1 s. */
export function partChanges(shots = []) {
  const out = [];
  for (let i = 1; i < shots.length; i++) if (shots[i].part && shots[i].part !== shots[i - 1].part && shots[i].start > 1) out.push(shots[i].start);
  return out;
}

/** A full-length stereo sfx track: a soft filtered-noise whoosh rising into each cut + a low thump on it. */
export function writeSfxTrack(file, duration, times, { gain = 0.35, seed = 5 } = {}) {
  const n = Math.round(duration * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  const r = rng(seed);
  const pre = 0.42, post = 0.35;
  for (const tc of times) {
    const i0 = Math.round((tc - pre) * SR), len = Math.round((pre + post) * SR);
    // state-variable band-pass, centre sweeping up into the cut then down
    let low = 0, band = 0, ph = 0;
    for (let k = 0; k < len; k++) {
      const t = k / SR - pre;                           // t = 0 at the cut
      const env = t < 0 ? (1 + t / pre) ** 2.2 : Math.exp(-t / 0.09);
      const fc = t < 0 ? 300 + 2200 * (1 + t / pre) ** 2 : 2500 * Math.exp(-t / 0.15) + 300;
      const f = 2 * Math.sin(Math.PI * Math.min(fc, 8000) / SR);
      const x = r() * 2 - 1;
      low += f * band; const high = x - low - 0.6 * band; band += f * high;
      ph += 2 * Math.PI * (55 + 40 * Math.exp(-Math.max(0, t) / 0.03)) / SR;
      const thump = t >= 0 ? Math.sin(ph) * Math.exp(-t / 0.12) * 0.9 : 0;
      const v = (band * env * 0.8 + thump) * gain;
      const pan = t < 0 ? -0.3 * (1 + t / pre) : 0.3;   // a little movement across
      const idx = i0 + k;
      if (idx >= 0 && idx < n) { L[idx] += v * (1 - pan) * 0.7; R[idx] += v * (1 + pan) * 0.7; }
    }
  }
  writeWav(file, [L, R], SR);
  return file;
}

/**
 * Mix to an m4a of exactly `duration` seconds.
 * shots: timeline shots (whoosh on each part change), or cuts: explicit times. sfx: false to switch the whooshes off.
 * Returns { out, duration, lufs, truePeak }.
 */
export async function mixAudio({ voice, music, out = "mix.m4a", duration, shots = null, cuts = null, sfx = true,
  voiceGain = 0, musicGain = -20, duck = true, targetLufs = -14 } = {}) {
  if (!voice || !fs.existsSync(voice)) throw new Error(`mixAudio: voice not found: ${voice}`);
  if (!(duration > 0)) throw new Error("mixAudio: duration required");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bw-mix-"));
  try {
    const inputs = ["-i", voice];
    const hasMusic = music && fs.existsSync(music);
    if (hasMusic) inputs.push("-stream_loop", "-1", "-i", music);
    const times = sfx ? (cuts ?? partChanges(shots ?? [])) : [];
    if (times.length) inputs.push("-i", writeSfxTrack(path.join(tmp, "sfx.wav"), duration, times));
    const D = duration.toFixed(3);
    const parts = [];
    parts.push(`[0:a]aresample=${SR},aformat=sample_fmts=fltp:channel_layouts=stereo,acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=2,volume=${voiceGain}dB,apad,atrim=0:${D}[v0]`);
    let bus = "[v0]";
    if (hasMusic) {
      parts.push(`[1:a]aresample=${SR},aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:${D},volume=${musicGain}dB[m0]`);
      if (duck) {
        parts.push(`[v0]asplit=2[vm][vsc]`);
        // the bed dips ~5-6 dB while the narrator talks and breathes back up in the gaps
        parts.push(`[m0][vsc]sidechaincompress=threshold=0.02:ratio=4:attack=15:release=350:makeup=1[md]`);
        bus = "[vm]"; parts.push(`${bus}[md]amix=inputs=2:normalize=0:duration=first[vmx]`);
      } else parts.push(`[v0][m0]amix=inputs=2:normalize=0:duration=first[vmx]`);
      bus = "[vmx]";
    }
    if (times.length) {
      const si = hasMusic ? 2 : 1;
      parts.push(`[${si}:a]aresample=${SR},aformat=sample_fmts=fltp:channel_layouts=stereo,volume=-8dB[sx]`);
      parts.push(`${bus}[sx]amix=inputs=2:normalize=0:duration=first[pre]`); bus = "[pre]";
    }
    const pre = path.join(tmp, "pre.wav");
    ffmpeg(["-y", ...inputs, "-filter_complex", parts.join(";") + `;${bus}alimiter=limit=0.5:attack=3:release=60:level=false[lim]`, "-map", "[lim]", "-t", D, "-c:a", "pcm_f32le", pre]);
    // two-pass loudnorm
    const m = ffmpeg(["-i", pre, "-af", `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:print_format=json`, "-f", "null", "-"]);
    const j = JSON.parse(m.slice(m.lastIndexOf("{"), m.lastIndexOf("}") + 1));
    const ln = `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    ffmpeg(["-y", "-i", pre, "-af", `${ln},aresample=48000,apad,atrim=0:${D}`, "-t", D, "-c:a", "aac", "-b:a", "192k", out]);
    const s = ffmpeg(["-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"]);
    const lufs = Number((s.match(/I:\s+(-?[\d.]+) LUFS/g) ?? []).pop()?.match(/-?[\d.]+/)[0]);
    const truePeak = Number((s.match(/Peak:\s+(-?[\d.]+) dBFS/g) ?? []).pop()?.match(/-?[\d.]+/)[0]);
    return { out, duration, lufs, truePeak, whooshes: times.length };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [voice, music, out, dur, tl] = process.argv.slice(2);
  if (!voice || !out || !dur) { console.error("usage: node audio/mix.mjs <voice.wav> <music.wav|-> <out.m4a> <duration> [timeline.json]"); process.exit(1); }
  const shots = tl ? JSON.parse(fs.readFileSync(tl, "utf8")).shots : null;
  const r = await mixAudio({ voice, music: music === "-" ? null : music, out, duration: Number(dur), shots });
  console.log(JSON.stringify(r));
}
