// Cutaway Explainer final video: the ffmpeg command and the captions. Pure (tested).
//
// One ffmpeg run joins the clips:
//   - every clip after the first drops its first frame (it is the same keyframe as
//     the previous clip's last frame, so it would show twice)
//   - each clip is sped up or slowed down to fit its beat exactly (speed = clip / beat)
//   - all clips go to 1080x1920 at 24 fps (no repeated frames: the clips are 24 fps already)
//   - the voice is sped up with atempo (pitch kept) to the planned pace
//   - one-word captions, centred at 52% of the height (TEST1_REVIEW.md R18)

export const CAPTION_Y = 0.52;

/** "pours," -> "Pours" (the references capitalise every caption word). */
export function captionWord(w) {
  const clean = String(w ?? "").replace(/[^\p{L}\p{N}'’-]/gu, "");
  return clean ? clean[0].toUpperCase() + clean.slice(1) : "";
}

const assTime = (sec) => {
  const t = Math.max(0, sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t - Math.floor(t)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
};

/** ASS subtitles: each word from its start to the next word's start (or its end + 0.25 s). */
export function buildAss({ words, width = 1080, height = 1920, fontName = "Lilita One" }) {
  const x = Math.round(width / 2);
  const y = Math.round(height * CAPTION_Y);
  const lines = [];
  words.forEach((w, i) => {
    const text = captionWord(w.w);
    if (!text) return;
    const next = words[i + 1];
    const end = next ? Math.max(w.e, next.s) : w.e + 0.25;
    lines.push(`Dialogue: 0,${assTime(w.s)},${assTime(end)},Word,,0,0,0,,{\\pos(${x},${y})}${text}`);
  });
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

/**
 * ffmpeg arguments. Inputs: clip files (in order), then the voice file (optional).
 * assFile and fontsDir are paths relative to ffmpeg's working directory
 * (no drive letters inside the filter, so it works on Windows and Linux alike).
 */
export function finalArgs({ clipFiles, speeds, voiceFile = null, tempo = 1, assFile = null, fontsDir = null, lengthSec, width = 1080, height = 1920, fps = 24, output }) {
  const n = clipFiles.length;
  const parts = clipFiles.map((_, i) => {
    const drop = i > 0 ? "select='gte(n\\,1)'," : "";
    return `[${i}:v]${drop}setpts=(PTS-STARTPTS)/${speeds[i].toFixed(4)},fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[v${i}]`;
  });
  const joined = `${clipFiles.map((_, i) => `[v${i}]`).join("")}concat=n=${n}:v=1:a=0,tpad=stop_mode=clone:stop_duration=2`;
  const subs = assFile ? `,subtitles=${assFile}${fontsDir ? `:fontsdir=${fontsDir}` : ""}` : "";
  const filters = [...parts, `${joined}${subs}[vout]`];
  if (voiceFile) filters.push(`[${n}:a]${atempoChain(tempo)},apad[aout]`);
  return [
    "-y",
    ...clipFiles.flatMap((f) => ["-i", f]),
    ...(voiceFile ? ["-i", voiceFile] : []),
    "-filter_complex", filters.join(";"),
    "-map", "[vout]",
    ...(voiceFile ? ["-map", "[aout]", "-c:a", "aac", "-b:a", "160k"] : ["-an"]),
    "-t", lengthSec.toFixed(3),
    "-r", String(fps),
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    output,
  ];
}
