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
import { writeWav, readWav } from "../lib/audioWav.mjs";
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

/** integrated loudness (LUFS) and true peak (dBTP) of a file, by ffmpeg's ebur128 */
export function loudness(file) {
  const s = ffmpeg(["-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const pick = (re) => Number((s.match(re) ?? []).pop()?.match(/-?[\d.]+/)?.[0]);
  return { lufs: pick(/I:\s+(-?[\d.]+) LUFS/g), truePeak: pick(/Peak:\s+(-?[\d.]+) dBFS/g) };
}

/** level of the loudest half of 50 ms windows (dB): the "active" level the SFX files are normalized to (-18 dB) */
function activeDb(x) {
  const w = Math.round(0.05 * SR), rs = [];
  for (let i = 0; i + w <= x.length; i += w) { let s = 0; for (let k = i; k < i + w; k++) s += x[k] * x[k]; rs.push(s / w); }
  rs.sort((a, b) => b - a);
  const top = rs.slice(0, Math.max(1, Math.ceil(rs.length / 2)));
  return 10 * Math.log10(top.reduce((a, b) => a + b, 0) / top.length + 1e-12);
}

/**
 * The SFX track for cues from lib/sfx.js: each file placed at cue.t, at cue.gainDb relative to the voice's active
 * level (loops tiled to cue.dur with a short fade). Written 12 dB down (headroom in 16-bit); mix it at +12 dB.
 */
export async function writeCueTrack(file, duration, cues, { voiceActiveDb = -18 } = {}) {
  const base = await import("./sfx.mjs"), epic = await import("./sfxEpic.mjs");
  const SFX = { ...base.SFX, ...epic.SFX_EPIC }, sfxPath = (n) => (epic.SFX_EPIC[n] ? epic.sfxEpicPath(n) : base.sfxPath(n));
  const n = Math.round(duration * SR), L = new Float32Array(n), R = new Float32Array(n);
  const cache = new Map();
  for (const c of cues) {
    if (!SFX[c.name]) throw new Error(`writeCueTrack: unknown sfx "${c.name}"`);
    if (!cache.has(c.name)) cache.set(c.name, readWav(sfxPath(c.name)).samples);
    const src = cache.get(c.name);
    const g = 10 ** ((voiceActiveDb - -18 + c.gainDb - 12) / 20);
    const len = c.dur ? Math.round(c.dur * SR) : src.length, fade = c.dur ? Math.round(0.25 * SR) : 0;
    const pan = ({ footsteps_run: 0.15, footsteps_walk: 0.15, crowd_cheer: 0, door_creak: -0.2, knock: 0.2 })[c.name] ?? 0;
    const i0 = Math.round(c.t * SR);
    for (let k = 0; k < len; k++) {
      const i = i0 + k; if (i < 0) continue; if (i >= n) break;
      let v = src[k % src.length] * g;
      if (fade && k > len - fade) v *= (len - k) / fade;
      L[i] += v * (1 - pan) * 0.85; R[i] += v * (1 + pan) * 0.85;
    }
  }
  writeWav(file, [L, R], SR);
  return file;
}

/**
 * The bed for `musicLoop`: "A".."E" (audio/backrooms.mjs: the option's loop played to the length, ending on its final
 * cadence over the last ~2 s), or a path to a seamless loop file (tiled, 2.5 s fade at the end).
 */
export async function bedFromLoop(musicLoop, seconds, file, { tempo = 1 } = {}) {
  if (typeof musicLoop === "string" && /^[A-Za-z]$/.test(musicLoop)) {
    const { renderBed } = await import("./backrooms.mjs");
    // the bed sped up to the voice's pace (same pitch): rendered tempo x longer, then atempo back to the length
    const raw = tempo !== 1 ? file.replace(/\.wav$/i, ".raw.wav") : file;
    const r = await renderBed({ option: musicLoop.toUpperCase(), seconds: seconds * tempo, out: raw });
    if (tempo !== 1) ffmpeg(["-y", "-i", raw, "-af", `atempo=${tempo}`, "-t", seconds.toFixed(3), "-c:a", "pcm_s16le", file]);
    return { file, kind: `option ${musicLoop.toUpperCase()}${tempo !== 1 ? ` x${tempo}` : ""}`, hitAt: r.hitAt != null ? r.hitAt / tempo : null };
  }
  if (!fs.existsSync(musicLoop)) throw new Error(`mixAudio: musicLoop not found: ${musicLoop}`);
  const D = seconds.toFixed(3), fo = Math.max(0, seconds - 2.5).toFixed(3);
  ffmpeg(["-y", "-stream_loop", "-1", "-i", musicLoop, "-t", D, "-af", `aresample=${SR},aformat=channel_layouts=stereo,afade=t=in:d=0.2,afade=t=out:st=${fo}:d=2.5`, "-c:a", "pcm_s16le", file]);
  return { file, kind: `loop file ${path.basename(musicLoop)}`, hitAt: null };
}

/**
 * The v2 mix (used when sfxCues or musicLoop is given): voice + the bed `musicUnderVoiceDb` LU under the voice
 * (integrated loudness, as measured in the reference videos: 5-10 LU, bell-style tracks ~8.5) with a gentle
 * sidechain dip while the narrator talks, + SFX cues, then two-pass loudnorm to -14 LUFS / -1.5 dBTP.
 * stemsDir: also write the three post-gain stems there (voice, music after ducking, sfx) to check the balance.
 */
async function mixV2({ voice, music, out, duration, sfxCues = null, musicLoop = null, musicUnderVoiceDb = 9, duckDb = 2.5,
  targetLufs = -14, stemsDir = null }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bw-mix2-"));
  try {
    const D = duration.toFixed(3);
    // 1. the voice, compressed like before, as a stem
    const v = path.join(tmp, "voice.wav");
    ffmpeg(["-y", "-i", voice, "-af", `aresample=${SR},aformat=sample_fmts=fltp:channel_layouts=stereo,acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=2,apad,atrim=0:${D}`, "-t", D, "-c:a", "pcm_s16le", v]);
    // a silent voice (make.mjs --silent) has no loudness: set the bed and sfx against a typical narrator instead
    let vL = loudness(v).lufs, vActive = activeDb(readWav(v).samples);
    if (!Number.isFinite(vL) || vL < -60 || vActive < -60) { vL = -16.5; vActive = -18; }
    // 2. the bed, at its level under the voice (pre-duck, so after the dip it sits where the references do)
    let bed = null;
    if (musicLoop) bed = await bedFromLoop(musicLoop, duration, path.join(tmp, "bed.wav"));
    else if (music && fs.existsSync(music)) { bed = { file: path.join(tmp, "bed.wav"), kind: `file ${path.basename(music)}` }; ffmpeg(["-y", "-stream_loop", "-1", "-i", music, "-t", D, "-af", `aresample=${SR},aformat=channel_layouts=stereo`, "-c:a", "pcm_s16le", bed.file]); }
    let musicGainDb = null;
    if (bed) musicGainDb = +(vL - musicUnderVoiceDb + duckDb * 0.6 - loudness(bed.file).lufs).toFixed(2);
    // 3. the sfx
    const cues = sfxCues ?? [];
    const sx = cues.length ? await writeCueTrack(path.join(tmp, "sfx.wav"), duration, cues, { voiceActiveDb: vActive }) : null;
    // 4. graph
    const inputs = ["-i", v]; const parts = [`[0:a]anull[v0]`]; let idx = 1;
    let bus = "[v0]";
    if (bed) {
      inputs.push("-i", bed.file);
      parts.push(`[${idx}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${musicGainDb}dB[m0]`);
      parts.push(`[v0]asplit=2[vm][vsc]`);
      // a gentle dip (~2-3 dB) while the narrator talks; the references barely duck
      const thr = Math.min(1, Math.max(0.001, 10 ** ((vActive - 8) / 20)));
      parts.push(`[m0][vsc]sidechaincompress=threshold=${thr.toFixed(4)}:ratio=1.6:attack=40:release=500:knee=6[md]`);
      parts.push(`[md]asplit=2[mdx][mds]`);
      parts.push(`[vm]asplit=2[vmx][vms]`);
      parts.push(`[vmx][mdx]amix=inputs=2:normalize=0:duration=first[vmix]`);
      bus = "[vmix]"; idx++;
    }
    if (sx) {
      inputs.push("-i", sx);
      parts.push(`[${idx}:a]aformat=sample_fmts=fltp:channel_layouts=stereo,volume=12dB[s0]`, `[s0]asplit=2[sx][ss]`);
      parts.push(`${bus}[sx]amix=inputs=2:normalize=0:duration=first[pre]`); bus = "[pre]"; idx++;
    }
    const pre = path.join(tmp, "pre.wav");
    const stemDir = stemsDir ?? tmp;
    fs.mkdirSync(stemDir, { recursive: true });
    const musicStem = path.join(stemDir, "stem_music.wav");
    const renderPre = () => {
      const graph = parts.join(";") + `;${bus}alimiter=limit=0.6:attack=3:release=60:level=false[lim]`;
      const stemOuts = [];
      if (bed) stemOuts.push("-map", "[mds]", "-t", D, "-c:a", "pcm_f32le", musicStem);
      if (stemsDir && bed) stemOuts.push("-map", "[vms]", "-t", D, "-c:a", "pcm_f32le", path.join(stemDir, "stem_voice.wav"));
      if (stemsDir && sx) stemOuts.push("-map", "[ss]", "-t", D, "-c:a", "pcm_f32le", path.join(stemDir, "stem_sfx.wav"));
      let g2 = graph;
      if (!(stemsDir && bed)) g2 = g2.replace(/\[vm\]asplit=2\[vmx\]\[vms\];/, "[vm]anull[vmx];");
      if (!(stemsDir && sx)) g2 = g2.replace(/\[s0\]asplit=2\[sx\]\[ss\]/, "[s0]anull[sx]");
      ffmpeg(["-y", ...inputs, "-filter_complex", g2, "-map", "[lim]", "-t", D, "-c:a", "pcm_f32le", pre, ...stemOuts]);
    };
    renderPre();
    // the dip acts on near-continuous narration, so it is closer to a steady cut than a pump: measure where the
    // ducked bed really landed and correct its gain once
    let musicUnderVoice = null;
    if (bed) {
      musicUnderVoice = +(vL - loudness(musicStem).lufs).toFixed(1);
      const err = musicUnderVoice - musicUnderVoiceDb;
      if (Math.abs(err) > 0.5) {
        musicGainDb = +(musicGainDb + err).toFixed(2);
        parts[1] = parts[1].replace(/volume=[-\d.]+dB/, `volume=${musicGainDb}dB`);
        renderPre();
        musicUnderVoice = +(vL - loudness(musicStem).lufs).toFixed(1);
      }
    }
    // 5. two-pass loudnorm, then a true-peak check after the AAC encode (trim the gain if the encoder overshoots)
    const m = ffmpeg(["-i", pre, "-af", `loudnorm=I=${targetLufs}:TP=-2:LRA=11:print_format=json`, "-f", "null", "-"]);
    const j = JSON.parse(m.slice(m.lastIndexOf("{"), m.lastIndexOf("}") + 1));
    const ln = `loudnorm=I=${targetLufs}:TP=-2:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    let trim = 0, res;
    for (let pass = 0; pass < 3; pass++) {
      ffmpeg(["-y", "-i", pre, "-af", `${ln},volume=${trim}dB,aresample=48000,apad,atrim=0:${D}`, "-t", D, "-c:a", "aac", "-b:a", "192k", out]);
      res = loudness(out);
      if (res.truePeak <= -1.5) break;
      trim -= res.truePeak + 1.5 + 0.2;
    }
    return { out, duration, lufs: res.lufs, truePeak: res.truePeak, voiceLufs: vL, musicGainDb, musicUnderVoiceLu: musicUnderVoice, music: bed?.kind ?? null, musicHitAt: bed?.hitAt ?? null, sfxCues: cues.length, trimDb: +trim.toFixed(2) };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Mix to an m4a of exactly `duration` seconds.
 * Old form: shots (whoosh on each part change) or cuts; sfx: false switches the whooshes off; music looped as is.
 * New form (when `sfxCues` or `musicLoop` is given): musicLoop "A".."E" or a loop file, sfxCues from lib/sfx.js
 * sfxCues(timeline); see mixV2. Returns { out, duration, lufs, truePeak, ... }.
 */
export async function mixAudio({ voice, music, out = "mix.m4a", duration, shots = null, cuts = null, sfx = true,
  voiceGain = 0, musicGain = -20, duck = true, targetLufs = -14, sfxCues = null, musicLoop = null, musicUnderVoiceDb = 9, stemsDir = null } = {}) {
  if (!voice || !fs.existsSync(voice)) throw new Error(`mixAudio: voice not found: ${voice}`);
  if (!(duration > 0)) throw new Error("mixAudio: duration required");
  if (sfxCues || musicLoop) return mixV2({ voice, music, out, duration, sfxCues: sfx ? sfxCues : [], musicLoop, musicUnderVoiceDb, targetLufs, stemsDir });
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
