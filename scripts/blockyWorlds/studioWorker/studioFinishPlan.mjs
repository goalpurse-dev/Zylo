// THE ZYVO CONNECTOR's finish_my_video: the pure planning (no ffmpeg): who says each word, the caption file, the
// sound cues, how the recording is fitted to the voice. Generalised from the owner-approved finish of the Studio Kit
// test ("The Town's Bedtime Story", take2/finish.mjs, 2026-11-19): Lilita One one-word captions with a small pop,
// coloured per speaker, sound effects on the script's sound words, soft whooshes on location changes.
import { sfxTags } from "../../../supabase/functions/_shared/blockyWorlds/sfxTags.js";
import { soundWordCues } from "../engine/lib/audioPlan.js";

export const FIT = Object.freeze({ maxSpeedChange: 0.08 });
export const CAPTION = Object.freeze({ font: "Lilita One", size: 140, maxWidth: 972, defaultY: 0.74, minY: 0.55, maxY: 0.92 });
/** the narrator is white; every other speaker gets the next colour (RRGGBB) */
export const SPEAKER_COLOURS = Object.freeze(["7CF08A", "FF8FC8", "C89BFF", "FFD166", "6EC8FF", "FF9F68"]);

const tokens = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean);

/** the first word index of each line (the voice gives one timed word per whitespace token, in order) */
export function lineStarts(lines) {
  const out = []; let i = 0;
  for (const l of lines ?? []) { out.push(i); i += tokens(l.text).length; }
  return out;
}

/**
 * Who says each word: a word inside double quotes belongs to the line's speaker (line.speaker, or "voice" when the
 * script names nobody), everything else to the narrator. -> [{ who, colour }] per word, plus the speaker list.
 */
export function speakersOf(lines, nWords) {
  const who = new Array(nWords).fill("narrator");
  const names = [];
  const starts = lineStarts(lines);
  (lines ?? []).forEach((l, li) => {
    const speaker = String(l.speaker ?? "").trim();
    const named = speaker && !/^narrator$/i.test(speaker) ? speaker : null;
    let inQuote = false;
    tokens(l.text).forEach((t, k) => {
      const opens = /^["“]/.test(t), closes = /["”][^\w]*$/.test(t) && !(opens && t.length === 1);
      if (opens) inQuote = true;
      const i = starts[li] + k;
      if (i < nWords && (inQuote || (named && !/["“”]/.test(l.text)))) {
        const name = named ?? "voice";
        who[i] = name;
        if (!names.includes(name)) names.push(name);
      }
      if (closes) inQuote = false;
    });
  });
  const colour = Object.fromEntries(names.map((n, i) => [n, SPEAKER_COLOURS[i % SPEAKER_COLOURS.length]]));
  return { who, colour: (n) => (n === "narrator" ? "FFFFFF" : colour[n]), speakers: names };
}

/** a caption's text: the spoken word in capitals, without surrounding quotes and end punctuation (keeps ! and ?) */
export function captionWord(w) {
  let s = String(w ?? "").trim().replace(/^["'“‘(]+/, "").replace(/["'”’),.;:…]+$/, "");
  if (/[!?]$/.test(s)) s = s.replace(/[.,]+(?=[!?]+$)/, "");
  return s.toUpperCase();
}
const tc = (t) => { const x = Math.max(0, t); const h = Math.floor(x / 3600), m = Math.floor(x / 60) % 60, s = x % 60; return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`; };
const bgr = (hex) => `&H${hex.slice(4, 6)}${hex.slice(2, 4)}${hex.slice(0, 2)}&`;
const escapeAss = (s) => s.replace(/\\/g, "").replace(/[{}]/g, "");

/** the caption height (fraction from the top) for the shot playing at t: the kit's captionY, else the default */
export function captionYAt(shots, t) {
  const s = (shots ?? []).find((x) => t >= Number(x.t0) && t < Number(x.t1));
  const y = Number(s?.captionY);
  return Number.isFinite(y) ? Math.min(CAPTION.maxY, Math.max(CAPTION.minY, y)) : CAPTION.defaultY;
}

/** the ASS caption file: one word at a time, a small pop, the speaker's colour, sized to fit the 9:16 width */
export function captionsAss({ words, lines, shots = [], duration }) {
  const sp = speakersOf(lines, words.length);
  let ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Cap,${CAPTION.font},${CAPTION.size},&H00FFFFFF,&H00FFFFFF,&H00120A0B,&H73000000,0,0,0,0,100,100,0,0,1,12,7,5,0,0,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  let n = 0;
  for (let i = 0; i < words.length; i++) {
    const text = escapeAss(captionWord(words[i].word));
    if (!text) continue;
    const start = words[i].start, next = words.slice(i + 1).find((w) => captionWord(w.word));
    let end = Math.max(words[i].end, start + 0.12) + 0.25;
    if (next && next.start < end) end = next.start;
    if (duration && end > duration) end = duration;
    if (end <= start) continue;
    const y = Math.round(captionYAt(shots, start) * 1920);
    const estW = text.length * 80 + 24; // Lilita One ~0.57 em a letter at 140 px
    const fs = estW > CAPTION.maxWidth ? Math.floor((CAPTION.size * CAPTION.maxWidth) / estW) : CAPTION.size;
    ass += `Dialogue: 0,${tc(start)},${tc(end)},Cap,,0,0,0,,{\\pos(540,${y})\\fs${fs}\\1c${bgr(sp.colour(sp.who[i]))}\\fscx70\\fscy70\\t(0,54,\\fscx108\\fscy108)\\t(54,90,\\fscx100\\fscy100)}${text}\n`;
    n++;
  }
  return { ass, captions: n, speakers: sp.speakers };
}

/**
 * The sound cues: the script's sound words (sfxTags fills them from the text; our library only: CC0 Kenney, our own
 * sounds and the owner's ElevenLabs takes, audioPlan.SOUND_SFX), each on its spoken word; plus a soft whoosh just
 * before every location change of the shot plan. -> [{ t, name, gainDb, dur? }]
 */
export function soundCues({ words, lines, shots = [] }) {
  const starts = lineStarts(lines);
  const tlLines = (lines ?? []).map((l, i) => {
    const a = words[starts[i]], b = words[Math.min(words.length - 1, starts[i] + tokens(l.text).length - 1)];
    return a && b ? { start: a.start, end: b.end } : {};
  });
  const script = { lines: (lines ?? []).map((l) => ({ ...l, sfx: sfxTags(l.text) })) };
  const { cues, missing, unplaced } = soundWordCues({ captions: words, lines: tlLines }, script);
  const out = cues.map((c) => ({ t: c.t, name: c.name, gainDb: c.gainDb, ...(c.dur ? { dur: c.dur } : {}) }));
  const sorted = [...(shots ?? [])].filter((s) => Number.isFinite(Number(s.t0))).sort((a, b) => a.t0 - b.t0);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].location && sorted[i - 1].location && sorted[i].location !== sorted[i - 1].location) out.push({ t: Math.max(0, Number(sorted[i].t0) - 0.35), name: "whoosh_1", gainDb: -14 });
  }
  return { cues: out.sort((a, b) => a.t - b.t), missing, unplaced };
}

/** fit the recording to the voice: a small speed change (<= 8 %), else trim the end or hold the last frame */
export function fitPlan(footageSec, voiceSec) {
  const F = Number(footageSec), D = Number(voiceSec);
  if (!(F > 0) || !(D > 0)) throw new Error("fitPlan: both lengths are needed");
  const r = F / D;
  if (Math.abs(r - 1) < 0.005) return { kind: "same", filter: "", note: null };
  if (Math.abs(r - 1) <= FIT.maxSpeedChange) return { kind: "speed", filter: `setpts=PTS*${(D / F).toFixed(6)}`, note: `The recording was ${r > 1 ? "sped up" : "slowed down"} by ${(Math.abs(r - 1) * 100).toFixed(1)}% to match the voice.` };
  if (F > D) return { kind: "trim", filter: "", note: `The recording is ${(F - D).toFixed(1)} s longer than the voice: the end was cut.` };
  return { kind: "hold", filter: `tpad=stop_mode=clone:stop_duration=${(D - F + 0.1).toFixed(3)}`, note: `The recording is ${(D - F).toFixed(1)} s shorter than the voice: the last frame is held for that long. Record a longer take next time.` };
}

/** the 9:16 box lying on its side inside a measured landscape viewport (make_vertical.sh, in numbers) */
export function sidewaysBox({ x1, y1, x2, y2 }) {
  const W = Math.floor((x2 - x1 + 1) / 2) * 2, H = Math.floor((y2 - y1 + 1) / 2) * 2;
  let BW, BH;
  if (W * 9 >= H * 16) { BW = Math.floor((H * 16) / 9 / 2) * 2; BH = H; } else { BW = W; BH = Math.floor((W * 9) / 16 / 2) * 2; }
  return { w: BW, h: BH, x: x1 + Math.floor((W - BW) / 2), y: y1 + Math.floor((H - BH) / 2), viewport: { w: W, h: H } };
}

/** the vision check's answer -> null (fine) or the reason we can't finish it (refunded) */
export function visionProblem(v) {
  if (!v || typeof v !== "object") return null; // the check could not run: never blocks on our failure
  if (v.real_person === true) return "The recording shows a real person. We only finish blocky 3D scenes.";
  if (v.unsafe === true) return "The recording shows something we can't publish (keep it PG).";
  if (v.blocky_3d === false) return "This doesn't look like a Roblox Studio recording of a blocky 3D scene.";
  if (v.platform_ui === true) return "Roblox's own menus or logos are visible. Record with the kit's Play run (it hides them), then upload again.";
  return null;
}
