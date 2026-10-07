// Blocky Stories final video — the pure parts (tested offline):
// silence → trim window and the per-clip ffmpeg arguments (captions: blockyCaptions.mjs).

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

/** How far under the voice's own loudness still counts as the voice (dB). Below that it is room noise. */
export const VOICE_DROP_DB = 14;
/** A quiet stretch may begin this long before the transcript's last word ends and still mark the end of the voice. */
const WORD_END_SLACK_SEC = 0.35;

/** The silencedetect threshold that follows the voice: VOICE_DROP_DB under its mean level, never under -35 dB. */
export const voiceThresholdDb = (meanDb) => (Number.isFinite(meanDb) ? Math.max(-35, Math.round(meanDb - VOICE_DROP_DB)) : -35);

/**
 * Where the voice stops: the start of the first stretch that is quiet AT THE
 * VOICE'S LEVEL (silences measured with voiceThresholdDb) and begins at or just
 * before the transcript's last word ends. No such stretch → the voice runs to
 * the end of the clip. Whisper's last word can end a little early or late
 * (-0.25 to +0.35 s on the first 59 clips), so the audio has the last say.
 */
export function voiceEndFrom(quiet, lastWordEnd, durationSec) {
  const next = (quiet ?? []).find((s) => s.start >= lastWordEnd - WORD_END_SLACK_SEC);
  return next ? Math.max(next.start, lastWordEnd - WORD_END_SLACK_SEC) : durationSec;
}

/**
 * The part of a clip to keep. Only the lead-in and the tail are cut; pauses
 * inside the line stay. No speech found → keep the whole clip.
 *
 * Start: just before the first sound (silence at -35 dB).
 * End, with a transcript (lastWordEnd): just after the last SPOKEN word, where
 *   "spoken" is the later of the transcript's last word and voiceEnd, never
 *   past the last sound. Room tone, a breath or a rustle after the line is cut
 *   (it used to be kept: up to 2 s of dead air in a final, and the captions
 *   were stretched across it).
 * End, without a transcript: just after the last sound, as before.
 * closingBeatSec (the last clip): keep that much after the last word instead of
 *   KEEP_SEC; when the clip is too short for it, holdSec says how long to
 *   freeze the last frame.
 */
export function trimWindow(silences, durationSec, { lastWordEnd = null, voiceEnd = null, closingBeatSec = 0 } = {}) {
  const eps = 0.05;
  const lead = silences.find((s) => s.start <= eps);
  const tail = [...silences].reverse().find((s) => s.end >= durationSec - eps);
  const soundStart = lead ? lead.end : 0;
  const soundEnd = tail && tail !== lead ? tail.start : lead && lead.end >= durationSec - eps ? null : durationSec;
  if (soundEnd == null || soundEnd <= soundStart) return { start: 0, end: durationSec, trimmedSec: 0, speech: null, holdSec: 0 };
  const byWords = Number.isFinite(lastWordEnd) && lastWordEnd > soundStart;
  const speechEnd = byWords ? Math.min(soundEnd, Math.max(lastWordEnd, Number.isFinite(voiceEnd) ? voiceEnd : lastWordEnd)) : soundEnd;
  const after = Math.max(KEEP_SEC, Number(closingBeatSec) || 0);
  let start = Math.max(0, soundStart - KEEP_SEC);
  let end = Math.min(durationSec, speechEnd + after);
  if (end - start < MIN_CLIP_SEC) {
    const grow = (MIN_CLIP_SEC - (end - start)) / 2;
    start = Math.max(0, start - grow);
    end = Math.min(durationSec, start + MIN_CLIP_SEC);
  }
  const r = (n) => Math.round(n * 1000) / 1000;
  const holdSec = closingBeatSec > 0 ? Math.max(0, closingBeatSec - (end - speechEnd)) : 0;
  return { start: r(start), end: r(end), trimmedSec: r(durationSec - (end - start)), speech: { start: r(soundStart), end: r(speechEnd) }, holdSec: r(holdSec), ...(byWords ? { by: "words" } : {}) };
}

/** Output frame per aspect (the clips' own 720p size). */
export const FRAME = { "9:16": [720, 1280], "16:9": [1280, 720] };

/**
 * ffmpeg args for one trimmed, normalized segment (H.264 + AAC 48 kHz stereo).
 * Captions: an ASS file (blockyCaptions.mjs) burned in with libass, using the
 * bundled font from `fontsDir`. No audio stream → silent track.
 */
export function segmentArgs({ input, output, start, end, aspect, assFile = null, fontsDir = null, hasAudio = true, threads = 2, holdSec = 0 }) {
  const [w, h] = FRAME[aspect] ?? FRAME["9:16"];
  const esc = (p) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  // holdSec: freeze the last frame that long after the clip ends (the closing beat), with silence under it.
  const hold = holdSec > 0.02 ? holdSec.toFixed(3) : null;
  const vf = [
    `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`,
    "setsar=1",
    `fps=${FPS}`,
    ...(hold ? [`tpad=stop_mode=clone:stop_duration=${hold}`] : []),
    ...(assFile ? [`ass='${esc(assFile)}'${fontsDir ? `:fontsdir='${esc(fontsDir)}'` : ""}`] : []),
    "format=yuv420p",
  ];
  const dur = (end - start + (hold ? Number(hold) : 0)).toFixed(3);
  return [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", start.toFixed(3), "-to", end.toFixed(3), "-i", input,
    ...(hasAudio ? [] : ["-f", "lavfi", "-t", dur, "-i", "anullsrc=r=48000:cl=stereo"]),
    "-map", "0:v:0", "-map", hasAudio ? "0:a:0" : "1:a:0",
    "-vf", vf.join(","),
    "-af", `aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11${hold ? `,apad=pad_dur=${hold}` : ""}`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-threads", String(threads),
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
    "-t", dur,
    output,
  ];
}
