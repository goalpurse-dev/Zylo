// AI Fruit Story v2 captions: one short line at a time, timed to the speech.
//
// The caption TEXT is always the exact line from the story (never the
// transcript). The TIMING comes from word timestamps (speech-to-text on the
// clip) aligned to the line's words; if there are none, or they don't match,
// the line is spread over the detected speech (weighted by word length).
// Chunks of 2–4 words, each shown from its first word's start, so nothing
// appears before it's said; the word being said can be highlighted lime.
// Rendered as an ASS subtitle file (libass), centered in the lower third.

const norm = (w) => String(w).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]/g, "");
const NUMBER_WORDS = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20", thirty: "30", forty: "40", fifty: "50", hundred: "100" };
const key = (w) => { const n = norm(w); return NUMBER_WORDS[n] ?? n; };

/** The line's display words (punctuation kept on the word). */
export const lineWords = (line) => String(line).trim().split(/\s+/).filter((w) => norm(w));

/**
 * Spreads words over [start, end], each getting time in proportion to its length.
 * @returns {{text:string,start:number,end:number}[]}
 */
export function evenWords(words, start, end) {
  const weights = words.map((w) => Math.max(2, norm(w).length) + 1);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let t = start;
  return words.map((text, i) => {
    const d = ((end - start) * weights[i]) / total;
    const out = { text, start: t, end: t + d };
    t += d;
    return out;
  });
}

/**
 * Aligns the line's words to transcript words (LCS on normalized words).
 * Matched words take the transcript's times; unmatched runs are spread
 * between their matched neighbours. Returns null when fewer than half the
 * line's words matched (then the caller falls back to even timing).
 */
export function alignWords(line, transcript) {
  const L = lineWords(line);
  const T = (transcript ?? []).filter((w) => Number.isFinite(w?.start) && Number.isFinite(w?.end) && norm(w.word ?? w.text));
  if (!L.length || !T.length) return null;
  const a = L.map(key), b = T.map((w) => key(w.word ?? w.text));
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const match = new Array(a.length).fill(null);
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) { match[i] = T[j]; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  const hits = match.filter(Boolean).length;
  if (hits < Math.ceil(L.length / 2)) return null;
  const first = T[0].start, last = T[T.length - 1].end;
  const out = new Array(L.length);
  for (let i = 0; i < L.length;) {
    if (match[i]) { out[i] = { text: L[i], start: match[i].start, end: match[i].end }; i++; continue; }
    let k = i;
    while (k < L.length && !match[k]) k++;
    const from = i > 0 ? out[i - 1].end : first;
    const to = k < L.length ? match[k].start : last;
    evenWords(L.slice(i, k), from, Math.max(from + 0.05 * (k - i), to)).forEach((w, n) => { out[i + n] = w; });
    i = k;
  }
  return out;
}

/**
 * Timed words for one clip, in the clip's own time.
 * @param {string} line
 * @param {object[]|null} transcript  [{word,start,end}] from speech-to-text, or null
 * @param {{start:number,end:number}|null} speech  detected speech span (silencedetect)
 * @param {number} durationSec
 */
export function timedWords(line, transcript, speech, durationSec) {
  const aligned = alignWords(line, transcript);
  if (aligned) return { words: aligned, source: "speech-to-text" };
  const T = (transcript ?? []).filter((w) => Number.isFinite(w?.start));
  const span = T.length >= 2 ? { start: T[0].start, end: T[T.length - 1].end } : speech ?? { start: 0, end: durationSec };
  return { words: evenWords(lineWords(line), span.start, Math.max(span.start + 0.5, span.end)), source: T.length >= 2 ? "speech-span" : "silence" };
}

const ENDS_PHRASE = /[,.!?;:—–-]$/;

/** Groups timed words into chunks of 2–4 words (≤ maxChars), breaking after punctuation. */
export function chunkWords(words, { maxWords = 4, maxChars = 18 } = {}) {
  const chunks = [];
  let cur = [];
  const len = (ws) => ws.map((w) => w.text).join(" ").length;
  for (const w of words) {
    if (cur.length && (cur.length >= maxWords || len([...cur, w]) > maxChars)) { chunks.push(cur); cur = []; }
    cur.push(w);
    if (cur.length >= 2 && ENDS_PHRASE.test(w.text)) { chunks.push(cur); cur = []; }
  }
  if (cur.length) chunks.push(cur);
  // A lone trailing word joins the chunk before it when that stays within 4 words.
  for (let i = chunks.length - 1; i > 0; i--) {
    if (chunks[i].length === 1 && chunks[i - 1].length < maxWords && !ENDS_PHRASE.test(chunks[i - 1].at(-1).text)) {
      chunks[i - 1] = [...chunks[i - 1], ...chunks[i]];
      chunks.splice(i, 1);
    }
  }
  return chunks;
}

const assTime = (t) => {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
};
const assText = (s) => String(s).replace(/[{}\\]/g, "");
const LIME = "&H0064F2BE&";   // #BEF264 in ASS (BGR)
const WHITE = "&H00FFFFFF&";

/**
 * ASS subtitles for one trimmed segment. `words` are in segment time.
 * One line on screen at a time; each chunk shows from its first word's start
 * until the next chunk starts (or briefly after its last word at a pause).
 */
export function buildAss({ words, width, height, durationSec, highlight = true, font = "Lilita One" }) {
  const base = Math.round(width * 0.11);
  const x = Math.round(width / 2), y = Math.round(height * 0.78);
  const events = [];
  const chunks = chunkWords(words);
  chunks.forEach((chunk, ci) => {
    const text = chunk.map((w) => w.text).join(" ");
    const size = Math.min(base, Math.floor((width * 0.88) / (Math.max(1, text.length) * 0.5)));
    const next = chunks[ci + 1]?.[0]?.start ?? Infinity;
    const lastEnd = chunk.at(-1).end;
    const end = Math.min(durationSec, next - lastEnd > 0.6 ? lastEnd + 0.3 : Math.min(next, lastEnd + 0.6));
    const head = `{\\an5\\pos(${x},${y})\\fs${size}}`;
    if (!highlight) {
      events.push([chunk[0].start, end, head + assText(text)]);
      return;
    }
    chunk.forEach((w, wi) => {
      const from = w.start;
      const to = wi + 1 < chunk.length ? chunk[wi + 1].start : end;
      if (to - from < 0.01) return;
      const body = chunk.map((x2, k) => (k === wi ? `{\\c${LIME}}${assText(x2.text)}{\\c${WHITE}}` : assText(x2.text))).join(" ");
      events.push([from, to, head + body]);
    });
  });
  const outline = Math.max(3, Math.round(base / 11));
  return [
    "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${width}`, `PlayResY: ${height}`, "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Cap,${font},${base},${WHITE},${WHITE},&H00000000&,&H99000000&,0,0,0,0,100,100,1,0,1,${outline},2,5,20,20,0,1`, "",
    "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events.filter(([s, e]) => e > s).map(([s, e, t]) => `Dialogue: 0,${assTime(s)},${assTime(e)},Cap,,0,0,0,,${t}`),
    "",
  ].join("\n");
}
