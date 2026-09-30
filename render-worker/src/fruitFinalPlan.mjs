// AI Fruit Story v2 final video — the pure parts (tested offline):
// silence → trim window, caption wrapping, and the per-clip ffmpeg arguments.

/** Seconds of quiet kept before the first word and after the last one. */
export const KEEP_SEC = 0.25;
/** A trimmed clip is never shorter than this (a one-word line still gets a beat). */
export const MIN_CLIP_SEC = 1.2;
export const FPS = 30;

/**
 * Parses `ffmpeg -af silencedetect` stderr into [{start, end}] silences.
 * A silence still open at the end of the file ends at `durationSec`.
 */
export function parseSilences(stderr, durationSec) {
  const out = [];
  let open = null;
  for (const line of String(stderr).split(/\r?\n/)) {
    const s = line.match(/silence_start:\s*(-?[\d.]+)/);
    if (s) { open = Math.max(0, Number(s[1])); continue; }
    const e = line.match(/silence_end:\s*([\d.]+)/);
    if (e && open != null) { out.push({ start: open, end: Number(e[1]) }); open = null; }
  }
  if (open != null) out.push({ start: open, end: durationSec });
  return out;
}

/**
 * The part of a clip to keep: from just before the first sound to just after
 * the last, padded by KEEP_SEC. Only leading and trailing silence is cut;
 * pauses inside the line stay. No speech found → keep the whole clip.
 */
export function trimWindow(silences, durationSec) {
  const eps = 0.05;
  const lead = silences.find((s) => s.start <= eps);
  const tail = [...silences].reverse().find((s) => s.end >= durationSec - eps);
  const soundStart = lead ? lead.end : 0;
  const soundEnd = tail && tail !== lead ? tail.start : lead && lead.end >= durationSec - eps ? null : durationSec;
  if (soundEnd == null || soundEnd <= soundStart) return { start: 0, end: durationSec, trimmedSec: 0 };
  let start = Math.max(0, soundStart - KEEP_SEC);
  let end = Math.min(durationSec, soundEnd + KEEP_SEC);
  if (end - start < MIN_CLIP_SEC) {
    const grow = (MIN_CLIP_SEC - (end - start)) / 2;
    start = Math.max(0, start - grow);
    end = Math.min(durationSec, start + MIN_CLIP_SEC);
  }
  const r = (n) => Math.round(n * 1000) / 1000;
  return { start: r(start), end: r(end), trimmedSec: r(durationSec - (end - start)) };
}

/** Wraps a caption into at most 3 balanced lines of about `maxChars`. */
export function wrapCaption(text, maxChars) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > maxChars) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  if (lines.length > 3) return wrapCaption(text, Math.ceil(maxChars * 1.25));
  return lines;
}

/** Output frame per aspect (the clips' own 720p size). */
export const FRAME = { "9:16": [720, 1280], "16:9": [1280, 720] };

/**
 * ffmpeg args for one trimmed, normalized segment (H.264 + AAC 48 kHz stereo).
 * Captions: one drawtext per line (each centered on its own; Debian's ffmpeg
 * 5.1 has no text_align), block centered at 70% of the height, read from
 * text files so no line ever needs escaping. No audio stream → silent track.
 */
export function segmentArgs({ input, output, start, end, aspect, captionFiles = [], fontFile, hasAudio = true, threads = 2 }) {
  const [w, h] = FRAME[aspect] ?? FRAME["9:16"];
  const size = Math.round(Math.min(w, h) * 0.072);
  const lineH = Math.round(size * 1.25);
  const vf = [
    `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`,
    "setsar=1",
    `fps=${FPS}`,
  ];
  const esc = (p) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  const top = Math.round(h * 0.70 - (captionFiles.length * lineH) / 2);
  captionFiles.forEach((file, i) => {
    vf.push(`drawtext=fontfile='${esc(fontFile)}':textfile='${esc(file)}':fontsize=${size}:fontcolor=white:borderw=${Math.round(size / 9)}:bordercolor=black:x=(w-text_w)/2:y=${top + i * lineH}`);
  });
  vf.push("format=yuv420p");
  const dur = (end - start).toFixed(3);
  return [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", start.toFixed(3), "-to", end.toFixed(3), "-i", input,
    ...(hasAudio ? [] : ["-f", "lavfi", "-t", dur, "-i", "anullsrc=r=48000:cl=stereo"]),
    "-map", "0:v:0", "-map", hasAudio ? "0:a:0" : "1:a:0",
    "-vf", vf.join(","),
    "-af", "aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-threads", String(threads),
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
    "-t", dur,
    output,
  ];
}
