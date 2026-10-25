// Cutaway Explainer final video: the ffmpeg command and the captions. Pure (tested).
//
// One ffmpeg run joins the clips:
//   - every clip after the first drops its first frame (it is the same keyframe as
//     the previous clip's last frame, so it would show twice)
//   - each clip is sped up or slowed down to fit its share of a beat exactly (speed = clip / beat share)
//   - all clips go to 1080x1920 at 24 fps (no repeated frames: the clips are 24 fps already)
//   - the voice is sped up with atempo (pitch kept) to the planned pace
//   - one-word captions centred at 52% of the height; number cards at 30%
//     (yellow for "= 6 CARS" comparisons, white for "33 FT" / "YEAR 2", as the creator does)
//   - sound: the voice, a chime on every name / card / "Congratulations", event sound effects.
//     Clips are silent. No music, no whooshes. Levels are relative to the voice.

export const CAPTION_Y = 0.52;
export const CARD_Y = 0.3;

/** "pours," -> "Pours" (the references capitalise every caption word). */
export function captionWord(w) {
  const clean = String(w ?? "").replace(/[^\p{L}\p{N}'’-]/gu, "");
  return clean ? clean[0].toUpperCase() + clean.slice(1) : "";
}

const assTime = (sec) => {
  const total = Math.round(Math.max(0, sec) * 100); // whole centiseconds (1.2 must not become 1.19)
  const h = Math.floor(total / 360000);
  const m = Math.floor((total % 360000) / 6000);
  const s = Math.floor((total % 6000) / 100);
  const cs = total % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
};

/** ASS subtitles: each word from its start to the next word's start (or its end + 0.25 s), plus the number cards. */
// until (optional): no caption after it (the end card pops there and a caption must never sit on it)
export function buildAss({ words, cards = [], width = 1080, height = 1920, fontName = "Lilita One", until = Infinity }) {
  const x = Math.round(width / 2);
  const y = Math.round(height * CAPTION_Y);
  const cy = Math.round(height * CARD_Y);
  const lines = [];
  words.forEach((w, i) => {
    const text = captionWord(w.w);
    if (!text || w.s >= until - 0.05) return;
    const next = words[i + 1];
    const end = Math.min(until, next ? Math.max(w.e, next.s) : w.e + 0.25);
    lines.push(`Dialogue: 0,${assTime(w.s)},${assTime(end)},Word,,0,0,0,,{\\pos(${x},${y})}${text}`);
  });
  for (const c of cards) {
    const text = String(c.text).replace(/[{}\\]/g, "");
    // As on the creator's account: comparison cards ("= 6 CARS") yellow, unit/time cards ("33 FT", "YEAR 2") white.
    // a name label (compile.mjs nameCards: "SIGNAL CONTROLLER") is smaller and teal, like the creator's part labels
    const style = c.kind === "name" ? "CardName" : /^\s*=/.test(text) ? "Card" : "CardWhite";
    lines.push(`Dialogue: 1,${assTime(c.s)},${assTime(c.e)},${style},,0,0,0,,{\\pos(${x},${cy})\\fad(80,220)\\fscx70\\fscy70\\t(0,140,\\fscx112\\fscy112)\\t(140,260,\\fscx100\\fscy100)}${text}`);
  }
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 2",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Word,${fontName},${Math.round(width * 0.085)},&H00FFFFFF,&H00FFFFFF,&H00141414,&H64000000,0,0,0,0,100,100,0,0,1,${Math.round(width * 0.0065)},2,5,0,0,0,1`,
    `Style: Card,${fontName},${Math.round(width * 0.12)},&H004DE1FF,&H004DE1FF,&H00141414,&H78000000,0,0,0,0,100,100,1,0,1,${Math.round(width * 0.009)},3,5,0,0,0,1`,
    `Style: CardWhite,${fontName},${Math.round(width * 0.12)},&H00FFFFFF,&H00FFFFFF,&H00141414,&H78000000,0,0,0,0,100,100,1,0,1,${Math.round(width * 0.009)},3,5,0,0,0,1`,
    `Style: CardName,${fontName},${Math.round(width * 0.075)},&H00E6F07C,&H00E6F07C,&H00141414,&H78000000,0,0,0,0,100,100,2,0,1,${Math.round(width * 0.007)},2,5,0,0,0,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...lines,
    "",
  ].join("\n");
}

/** atempo accepts 0.5-2.0 per filter; chain for anything outside that. */
export function atempoChain(tempo) {
  const out = [];
  let t = tempo;
  while (t > 2) { out.push("atempo=2"); t /= 2; }
  while (t < 0.5) { out.push("atempo=0.5"); t /= 0.5; }
  out.push(`atempo=${t.toFixed(4)}`);
  return out.join(",");
}

const ms = (sec) => Math.max(0, Math.round(sec * 1000));

/**
 * ffmpeg arguments. Inputs in this order: clip files, the voice (optional), the chime (optional, once),
 * then one input per sound effect (looped when it has a duration).
 * assFile and fontsDir are paths relative to ffmpeg's working directory
 * (no drive letters inside the filter, so it works on Windows and Linux alike).
 */
/**
 * The gain (dB) that puts a sound `levelDb` under the voice, from measured loudness (LUFS):
 * the fix for test 3, where -12 dB was applied to each file's own level and effects came out at voice level.
 * Without a measurement it falls back to the plain level.
 */
export function gainFor({ voiceLufs, soundLufs, levelDb }) {
  if (!Number.isFinite(voiceLufs) || !Number.isFinite(soundLufs)) return levelDb;
  return Math.round((voiceLufs + levelDb - soundLufs) * 10) / 10;
}

export const SHORT_SFX_SEC = 1.4;

/**
 * ffmpeg arguments. Inputs in this order: clip files, the voice (optional), the chime (optional, once),
 * then one input per sound effect. Each effect and the chime carry `gainDb` (gainFor, measured against
 * the voice); effects are cut to SHORT_SFX_SEC with a short fade, except `soft` ones (rain) which loop
 * for their duration with a slow fade in and out. audioOnly: no clips, writes the mix alone.
 */
export function finalArgs({ clipFiles = [], speeds = [], voiceFile = null, tempo = 1, assFile = null, fontsDir = null, chimeFile = null, chimes = [], chimeGainDb = -20, sfx = [], lengthSec, width = 1080, height = 1920, fps = 24, output, audioOnly = false }) {
  const n = audioOnly ? 0 : clipFiles.length;
  const filters = [];
  if (!audioOnly) {
    clipFiles.forEach((_, i) => {
      const drop = i > 0 ? "select='gte(n\\,1)'," : "";
      filters.push(`[${i}:v]${drop}setpts=(PTS-STARTPTS)/${speeds[i].toFixed(4)},fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[v${i}]`);
    });
    const joined = `${clipFiles.map((_, i) => `[v${i}]`).join("")}concat=n=${n}:v=1:a=0,tpad=stop_mode=clone:stop_duration=2`;
    const subs = assFile ? `,subtitles=${assFile}${fontsDir ? `:fontsdir=${fontsDir}` : ""}` : "";
    filters.push(`${joined}${subs}[vout]`);
  }

  const inputs = audioOnly ? [] : clipFiles.flatMap((f) => ["-i", f]);
  const mix = [];
  let idx = n;
  if (voiceFile) {
    inputs.push("-i", voiceFile);
    const stretch = Math.abs(tempo - 1) > 0.001 ? `${atempoChain(tempo)},` : ""; // never used now: the voice is not sped up
    filters.push(`[${idx}:a]${stretch}aresample=44100,aformat=channel_layouts=stereo,apad[voice]`);
    mix.push("[voice]");
    idx += 1;
  } else if (chimes.length || sfx.length) {
    inputs.push("-f", "lavfi", "-t", lengthSec.toFixed(3), "-i", "anullsrc=r=44100:cl=stereo");
    mix.push(`[${idx}:a]`);
    idx += 1;
  }
  if (chimeFile && chimes.length) {
    inputs.push("-i", chimeFile);
    const labels = chimes.map((_, k) => `[ch${k}]`).join("");
    filters.push(`[${idx}:a]aresample=44100,aformat=channel_layouts=stereo,volume=${chimeGainDb}dB,asplit=${chimes.length}${labels}`);
    chimes.forEach((t, k) => { filters.push(`[ch${k}]adelay=${ms(t)}:all=1[chd${k}]`); mix.push(`[chd${k}]`); });
    idx += 1;
  }
  sfx.forEach((c, k) => {
    const soft = Boolean(c.soft);
    const dur = soft ? Math.max(1.5, c.duration ?? 3) : Math.min(SHORT_SFX_SEC, c.duration ?? SHORT_SFX_SEC);
    if (soft) inputs.push("-stream_loop", "-1");
    inputs.push("-i", c.file);
    const fades = soft
      ? `afade=t=in:d=${Math.min(0.8, dur / 3).toFixed(2)},afade=t=out:st=${Math.max(0, dur - Math.min(1, dur / 3)).toFixed(3)}:d=${Math.min(1, dur / 3).toFixed(2)}`
      : `afade=t=out:st=${Math.max(0, dur - 0.25).toFixed(3)}:d=0.25`;
    filters.push(`[${idx}:a]atrim=0:${dur.toFixed(3)},${fades},aresample=44100,aformat=channel_layouts=stereo,volume=${c.gainDb ?? -20}dB,adelay=${ms(c.start)}:all=1[fx${k}]`);
    mix.push(`[fx${k}]`);
    idx += 1;
  });
  const hasAudio = mix.length > 0;
  if (mix.length > 1) filters.push(`${mix.join("")}amix=inputs=${mix.length}:duration=longest:normalize=0,alimiter=limit=0.95[aout]`);
  else if (mix.length === 1) filters.push(`${mix[0]}anull[aout]`);

  if (audioOnly) return ["-y", ...inputs, "-filter_complex", filters.join(";"), "-map", "[aout]", "-t", lengthSec.toFixed(3), "-c:a", "libmp3lame", "-b:a", "192k", output];
  return [
    "-y",
    ...inputs,
    "-filter_complex", filters.join(";"),
    "-map", "[vout]",
    ...(hasAudio ? ["-map", "[aout]", "-c:a", "aac", "-b:a", "160k"] : ["-an"]),
    "-t", lengthSec.toFixed(3),
    "-r", String(fps),
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    output,
  ];
}
