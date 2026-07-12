import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Music2,
  GripVertical,
  ArrowRightLeft,
  Scissors,
  Type,
  SlidersHorizontal,
  Plus,
  Trash2,
  Copy,
  Clock3,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const heavyFont = "Impact, Arial Black, Inter, sans-serif";
const boldFont = "Arial Black, Inter, sans-serif";
const cleanFont = "Inter, Arial, sans-serif";
const slabFont = "Georgia, Times New Roman, serif";
const blackStroke = "-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000,0 4px 12px rgba(0,0,0,0.55)";
const softGlow = "0 0 14px currentColor,0 6px 20px rgba(0,0,0,0.65)";
const DEFAULT_PREVIEW_TEXT = "zyvo is the best ai generating platform you can use in 2026. create viral videos in seconds.";
const LEGACY_PREVIEW_TEXTS = new Set([
  "zyvo is best",
  "zyvo is best for viral cooking videos",
]);

export const CAPTION_PRESETS = [
  {
    id: "viral-yellow",
    mode: "karaoke",
    groupSize: 2,
    maxChars: 30,
    demo: "THE QUICK",
    cardBg: "#111",
    wordStyle: { color: "#fff", fontWeight: 900, fontSize: 20, textTransform: "uppercase", fontFamily: heavyFont, textShadow: blackStroke },
    activeStyle: { color: "#FFE000", fontWeight: 900, fontSize: 22, textTransform: "uppercase", fontFamily: heavyFont, textShadow: blackStroke, transform: "scale(1.08)" },
  },
  {
    id: "white-punch",
    mode: "word-pop",
    groupSize: 1,
    demo: "QUICK",
    cardBg: "#111",
    wordStyle: { color: "rgba(255,255,255,0.25)", fontWeight: 900, fontSize: 22, textTransform: "uppercase", fontFamily: heavyFont, textShadow: blackStroke },
    activeStyle: { color: "#fff", fontWeight: 900, fontSize: 28, textTransform: "uppercase", fontFamily: heavyFont, textShadow: blackStroke, transform: "scale(1.12)" },
  },
  {
    id: "cyan-impact",
    mode: "single",
    groupSize: 1,
    demo: "FOX",
    cardBg: "#101317",
    wordStyle: { color: "rgba(255,255,255,0.18)", fontWeight: 900, fontSize: 20, textTransform: "uppercase", fontFamily: boldFont },
    activeStyle: { color: "#13D9FF", fontWeight: 900, fontSize: 30, textTransform: "uppercase", fontFamily: boldFont, textShadow: "0 0 16px rgba(19,217,255,0.95),0 4px 0 #000", transform: "scale(1.1)" },
  },
  {
    id: "lime-karaoke",
    mode: "karaoke",
    groupSize: 4,
    maxChars: 28,
    demo: "THE QUICK",
    cardBg: "#111",
    wordStyle: { color: "#fff", fontWeight: 900, fontSize: 18, textTransform: "uppercase", fontFamily: boldFont, textShadow: blackStroke },
    activeStyle: { color: "#00FF48", fontWeight: 900, fontSize: 19, textTransform: "uppercase", fontFamily: boldFont, textShadow: "0 0 12px rgba(0,255,72,0.75),-2px -2px 0 #000,2px 2px 0 #000", transform: "scale(1.07)" },
  },
  {
    id: "red-white",
    mode: "karaoke",
    groupSize: 5,
    maxChars: 30,
    demo: "BROWN FOX",
    cardBg: "#111",
    wordStyle: { color: "#fff", fontWeight: 900, fontSize: 17, textTransform: "uppercase", fontFamily: boldFont, textShadow: blackStroke },
    activeStyle: { color: "#FF3B20", fontWeight: 900, fontSize: 18, textTransform: "uppercase", fontFamily: boldFont, textShadow: blackStroke, transform: "scale(1.07)" },
  },
  {
    id: "green-stack",
    mode: "phrase",
    groupSize: 4,
    maxChars: 26,
    demo: "BROWN FOX",
    cardBg: "#101410",
    wordStyle: { color: "#fff", fontWeight: 900, fontSize: 16, textTransform: "uppercase", fontFamily: heavyFont, textShadow: blackStroke },
    activeStyle: { color: "#2DFF55", fontWeight: 900, fontSize: 18, textTransform: "uppercase", fontFamily: heavyFont, textShadow: softGlow, transform: "scale(1.08)" },
  },
  {
    id: "clean-subtitle",
    mode: "sentence",
    groupSize: 7,
    maxChars: 34,
    demo: "The quick brown",
    cardBg: "#111",
    blockStyle: { background: "rgba(0,0,0,0.58)", borderRadius: 12, padding: "8px 12px" },
    wordStyle: { color: "rgba(255,255,255,0.72)", fontWeight: 700, fontSize: 15, fontFamily: cleanFont },
    activeStyle: { color: "#FFFFFF", fontWeight: 850, fontSize: 15, fontFamily: cleanFont },
  },
  {
    id: "soft-white-glow",
    mode: "karaoke",
    groupSize: 4,
    maxChars: 30,
    demo: "THE QUICK",
    cardBg: "#151515",
    wordStyle: { color: "rgba(255,255,255,0.76)", fontWeight: 900, fontSize: 17, textTransform: "uppercase", fontFamily: boldFont, textShadow: "0 2px 9px rgba(0,0,0,0.85)" },
    activeStyle: { color: "#FFFFFF", fontWeight: 900, fontSize: 18, textTransform: "uppercase", fontFamily: boldFont, textShadow: "0 0 18px rgba(255,255,255,0.95),0 8px 24px rgba(0,0,0,0.9)", transform: "scale(1.06)" },
  },
  {
    id: "yellow-box",
    mode: "box",
    groupSize: 4,
    maxChars: 28,
    demo: "THE QUICK",
    cardBg: "#111",
    wordStyle: { color: "#fff", fontWeight: 900, fontSize: 16, textTransform: "uppercase", fontFamily: boldFont, textShadow: blackStroke, padding: "2px 3px", borderRadius: 4 },
    activeStyle: { color: "#111", fontWeight: 900, fontSize: 16, textTransform: "uppercase", fontFamily: boldFont, background: "#FFE000", padding: "2px 6px", borderRadius: 5, transform: "scale(1.06)" },
  },
  {
    id: "blue-box",
    mode: "box",
    groupSize: 5,
    maxChars: 30,
    demo: "THE QUICK",
    cardBg: "#101318",
    wordStyle: { color: "#EAF7FF", fontWeight: 850, fontSize: 15, textTransform: "uppercase", fontFamily: boldFont, textShadow: "0 3px 8px rgba(0,0,0,0.7)", padding: "2px 3px", borderRadius: 4 },
    activeStyle: { color: "#071014", fontWeight: 900, fontSize: 15, textTransform: "uppercase", fontFamily: boldFont, background: "#29D7FF", padding: "2px 6px", borderRadius: 5, transform: "scale(1.06)" },
  },
  {
    id: "typewriter-clean",
    mode: "typewriter",
    groupSize: 6,
    maxChars: 32,
    demo: "The quick",
    cardBg: "#111",
    wordStyle: { color: "rgba(255,255,255,0.35)", fontWeight: 650, fontSize: 16, fontFamily: cleanFont },
    activeStyle: { color: "#fff", fontWeight: 850, fontSize: 16, fontFamily: cleanFont, textShadow: "0 5px 14px rgba(0,0,0,0.8)" },
  },
  {
    id: "typewriter-bold",
    mode: "typewriter",
    groupSize: 5,
    maxChars: 28,
    demo: "THE QUICK",
    cardBg: "#111",
    wordStyle: { color: "rgba(255,255,255,0.22)", fontWeight: 900, fontSize: 14, textTransform: "uppercase", fontFamily: boldFont },
    activeStyle: { color: "#FFE000", fontWeight: 900, fontSize: 15, textTransform: "uppercase", fontFamily: boldFont, textShadow: blackStroke },
  },
  {
    id: "red-glitch",
    mode: "glitch",
    groupSize: 2,
    maxChars: 22,
    demo: "BROWN FOX",
    cardBg: "#160d0d",
    wordStyle: { color: "rgba(255,255,255,0.76)", fontWeight: 900, fontSize: 14, textTransform: "uppercase", fontFamily: heavyFont, textShadow: "2px 0 #0ff,-2px 0 #f00,0 4px 0 #000" },
    activeStyle: { color: "#FF1F1F", fontWeight: 900, fontSize: 16, textTransform: "uppercase", fontFamily: heavyFont, textShadow: "3px 0 #0ff,-3px 0 #fff,0 0 18px rgba(255,31,31,0.85)", transform: "translateX(1px) scale(1.08)" },
  },
  {
    id: "motion-blur",
    mode: "single",
    groupSize: 1,
    demo: "FOX",
    cardBg: "#111",
    wordStyle: { color: "rgba(255,255,255,0)", fontWeight: 900, fontSize: 14, textTransform: "uppercase", fontFamily: heavyFont },
    activeStyle: { color: "#fff", fontWeight: 900, fontSize: 26, textTransform: "uppercase", fontFamily: heavyFont, textShadow: "16px 0 12px rgba(255,255,255,0.34),-16px 0 12px rgba(255,255,255,0.18),0 5px 0 #000" },
  },
  {
    id: "pink-neon",
    mode: "single",
    groupSize: 1,
    demo: "FOX",
    cardBg: "#151019",
    wordStyle: { color: "rgba(255,255,255,0.12)", fontWeight: 900, fontSize: 20, textTransform: "uppercase", fontFamily: boldFont },
    activeStyle: { color: "#FF35EA", fontWeight: 900, fontSize: 28, textTransform: "uppercase", fontFamily: boldFont, textShadow: "0 0 14px #FF35EA,0 0 26px rgba(255,53,234,0.7)", transform: "scale(1.1)" },
  },
  {
    id: "orange-label",
    mode: "box",
    groupSize: 5,
    maxChars: 30,
    demo: "THE QUICK",
    cardBg: "#16100c",
    wordStyle: { color: "#fff", fontWeight: 900, fontSize: 13, textTransform: "uppercase", fontFamily: boldFont, textShadow: blackStroke, padding: "1px 3px" },
    activeStyle: { color: "#fff", fontWeight: 900, fontSize: 13, textTransform: "uppercase", fontFamily: boldFont, background: "#FF3B20", boxShadow: "0 0 18px rgba(255,59,32,0.55)", padding: "2px 7px", borderRadius: 4, transform: "scale(1.05)" },
  },
  {
    id: "split-cyan",
    mode: "karaoke",
    groupSize: 5,
    maxChars: 32,
    demo: "THE QUICK BROWN FOX",
    cardBg: "#111",
    wordStyle: { color: "#fff", fontWeight: 900, fontSize: 12, textTransform: "uppercase", fontStyle: "italic", fontFamily: boldFont, textShadow: blackStroke },
    activeStyle: { color: "#19E6FF", fontWeight: 900, fontSize: 14, textTransform: "uppercase", fontStyle: "italic", fontFamily: boldFont, textShadow: softGlow, transform: "scale(1.08)" },
  },
  {
    id: "white-black-bubble",
    mode: "sentence",
    groupSize: 6,
    maxChars: 28,
    demo: "QUICK",
    cardBg: "#111",
    wordStyle: { color: "#fff", fontWeight: 900, fontSize: 19, textTransform: "uppercase", fontFamily: boldFont, background: "#000", padding: "3px 9px", borderRadius: 999, textShadow: "none" },
    activeStyle: { color: "#fff", fontWeight: 900, fontSize: 20, textTransform: "uppercase", fontFamily: boldFont, background: "#000", padding: "3px 9px", borderRadius: 999, boxShadow: "0 0 0 2px rgba(255,255,255,0.25)", transform: "scale(1.06)" },
  },
  {
    id: "serif-premium",
    mode: "sentence",
    groupSize: 6,
    maxChars: 34,
    demo: "The quick",
    cardBg: "#111",
    wordStyle: { color: "#F8F4EC", fontWeight: 700, fontSize: 17, fontFamily: slabFont, textShadow: "0 4px 18px rgba(0,0,0,0.85)" },
    activeStyle: { color: "#FFFFFF", fontWeight: 900, fontSize: 18, fontFamily: slabFont, textShadow: "0 0 18px rgba(255,255,255,0.55),0 5px 20px #000" },
  },
  {
    id: "gray-italic",
    mode: "sentence",
    groupSize: 5,
    maxChars: 30,
    demo: "The quick",
    cardBg: "#111",
    wordStyle: { color: "rgba(255,255,255,0.54)", fontWeight: 850, fontSize: 18, fontFamily: cleanFont, fontStyle: "italic", textShadow: "0 3px 0 #000" },
    activeStyle: { color: "#FFFFFF", fontWeight: 900, fontSize: 19, fontFamily: cleanFont, fontStyle: "italic", textShadow: "0 5px 14px rgba(0,0,0,0.9)", transform: "scale(1.04)" },
  },
  {
    id: "keyword-badge",
    mode: "keyword",
    groupSize: 5,
    maxChars: 30,
    demo: "THE QUICK",
    cardBg: "#111",
    wordStyle: { color: "#FFFFFF", fontWeight: 900, fontSize: 14, textTransform: "uppercase", fontFamily: boldFont, textShadow: blackStroke },
    activeStyle: { color: "#FFE000", fontWeight: 900, fontSize: 16, textTransform: "uppercase", fontFamily: boldFont, textShadow: blackStroke, transform: "scale(1.1) rotate(-1deg)" },
    accentMark: "+",
  },
  {
    id: "red-streak",
    mode: "glitch",
    groupSize: 3,
    maxChars: 26,
    demo: "BROWN FOX",
    cardBg: "#170c0c",
    blockStyle: { background: "linear-gradient(90deg, rgba(255,0,0,0.08), rgba(255,0,0,0.22), rgba(255,0,0,0.08))", padding: "5px 10px", borderRadius: 4 },
    wordStyle: { color: "#fff", fontWeight: 900, fontSize: 12, textTransform: "uppercase", fontFamily: "Arial Narrow, Arial Black, sans-serif", textShadow: "0 2px 0 #000" },
    activeStyle: { color: "#FF2A2A", fontWeight: 900, fontSize: 13, textTransform: "uppercase", fontFamily: "Arial Narrow, Arial Black, sans-serif", textShadow: "0 0 14px rgba(255,42,42,0.9),0 2px 0 #000", transform: "scale(1.08)" },
  },
  {
    id: "two-line-pop",
    mode: "phrase",
    groupSize: 6,
    maxChars: 28,
    demo: "THE QUICK BROWN FOX",
    cardBg: "#131313",
    wordStyle: { color: "#fff", fontWeight: 900, fontSize: 16, textTransform: "uppercase", fontFamily: heavyFont, textShadow: blackStroke },
    activeStyle: { color: "#40FF5C", fontWeight: 900, fontSize: 17, textTransform: "uppercase", fontFamily: heavyFont, textShadow: softGlow, transform: "scale(1.07)" },
  },
  {
    id: "small-caps",
    mode: "karaoke",
    groupSize: 6,
    maxChars: 34,
    demo: "THE QUICK BROWN FOX",
    cardBg: "#111",
    wordStyle: { color: "#fff", fontWeight: 900, fontSize: 11, textTransform: "uppercase", letterSpacing: 0, fontFamily: cleanFont, textShadow: "0 3px 9px #000" },
    activeStyle: { color: "#3CEBFF", fontWeight: 900, fontSize: 12, textTransform: "uppercase", letterSpacing: 0, fontFamily: cleanFont, textShadow: softGlow, transform: "scale(1.08)" },
  },
  {
    id: "soft-pill",
    mode: "box",
    groupSize: 5,
    maxChars: 30,
    demo: "zyvo is best",
    cardBg: "#111",
    blockStyle: { background: "rgba(0,0,0,0.58)", borderRadius: 14, padding: "7px 11px" },
    wordStyle: { color: "rgba(255,255,255,0.7)", fontWeight: 760, fontSize: 15, fontFamily: cleanFont, padding: "1px 3px", borderRadius: 5 },
    activeStyle: { color: "#111", fontWeight: 900, fontSize: 15, fontFamily: cleanFont, background: "#FFFFFF", padding: "1px 7px", borderRadius: 7, transform: "scale(1.05)" },
  },
  {
    id: "shadow-depth",
    mode: "karaoke",
    groupSize: 4,
    maxChars: 30,
    demo: "The quick",
    cardBg: "#111",
    wordStyle: { color: "rgba(255,255,255,0.76)", fontWeight: 900, fontSize: 19, fontFamily: heavyFont, textShadow: "0 2px 0 #222,0 4px 0 #000,0 12px 20px rgba(0,0,0,0.8)" },
    activeStyle: { color: "#FFFFFF", fontWeight: 900, fontSize: 20, fontFamily: heavyFont, textShadow: "0 2px 0 #444,0 5px 0 #000,0 0 18px rgba(255,255,255,0.65)", transform: "scale(1.06)" },
  },
];

export const TEXT_SPEEDS = [
  { id: "fast", label: "Fast", desc: "Snappy pop", revealSec: 0.28 },
  { id: "normal", label: "Normal", desc: "Balanced", revealSec: 0.62 },
  { id: "slow", label: "Slow", desc: "Smooth reveal", revealSec: 1.1 },
];

// Seconds per word for the manual-caption preview loop — this drives how
// fast the demo text cycles with no real voiceover attached yet, so it has
// to look like plausible human speech on its own. Pinned to actual speech
// rates (conversational English averages ~150 wpm; energetic/fast talkers
// top out around 190-200 wpm) rather than arbitrary numbers — the old
// "fast" value of 0.16s/word was 375 wpm, which nobody can actually speak,
// and it's the default every new text overlay starts at.
const MANUAL_WORD_SECONDS = {
  fast: 0.31,   // ~194 wpm — energetic, still humanly speakable
  normal: 0.39, // ~154 wpm — natural conversational pace
  slow: 0.5,    // ~120 wpm — deliberate, easy to follow
};

const SOURCE_CLIP_DURATION = 6;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const fmtTime = (value) => `00:${String(Math.floor(value)).padStart(2, "0")}`;
const uid = () => `txt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const isTouchEvent = (event) => Boolean(event?.touches);
const preventMouseDefault = (event) => {
  if (!isTouchEvent(event) && event?.cancelable !== false) event.preventDefault();
};

function createDefaultText(duration) {
  return {
    id: uid(),
    text: DEFAULT_PREVIEW_TEXT,
    start: 0,
    end: Math.max(2, duration),
    x: 50,
    y: 42,
    styleId: "viral-yellow",
    // "normal" (not "fast") so the very first thing anyone sees is the
    // calm, natural-speech pace — "fast" is still there to opt into.
    speed: "normal",
    previewLoop: true,
  };
}

function normalizeTextOverlays(raw, duration) {
  const safeDuration = Math.max(0.5, Number(duration) || 0.5);
  const list = Array.isArray(raw) && raw.length ? raw : [createDefaultText(duration)];
  return list.map((item, index) => {
    const start = clamp(Number(item.start ?? index * 1.5), 0, Math.max(0, safeDuration - 0.35));
    const end = clamp(Number(item.end ?? start + 4), start + 0.35, safeDuration);
    return {
      id: item.id || uid(),
      text: item.text || DEFAULT_PREVIEW_TEXT,
      start,
      end,
      x: clamp(Number(item.x ?? 50), 8, 92),
      y: clamp(Number(item.y ?? 42), 8, 92),
      styleId: item.styleId || item.captionStyle || "viral-yellow",
      speed: item.speed || "normal",
      previewLoop: Boolean(item.previewLoop),
    };
  });
}

// `groupSize` on a preset is a ceiling, not a target — the max words that
// style is ever allowed to bundle into one on-screen block (its visual
// "personality": glitch bursts stay punchy, sentence-style can go fuller).
// How many words actually land in a block is decided in chunkWords by pace,
// not by this number.
function getGroupSize(preset, words = []) {
  const configured = Array.isArray(preset?.groupSize) ? preset.groupSize[1] : preset?.groupSize;
  const base = Number(configured ?? 4);
  if (!["single", "word-pop"].includes(preset?.mode)) return base;
  const durations = words
    .map(word => Math.max(0, Number(word.end ?? 0) - Number(word.start ?? 0)))
    .filter(Boolean);
  const avg = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0.22;
  return avg < 0.11 ? Math.max(2, base) : base;
}

function chunkWords(words, presetOrSize) {
  const preset = typeof presetOrSize === "object" ? presetOrSize : { groupSize: presetOrSize };
  const sizeCeiling = getGroupSize(preset, words);
  const maxChars = Number(preset.maxChars ?? 32);
  const maxDuration = Number(preset.maxBlockDuration ?? 3.2);
  const minDuration = Number(preset.minBlockDuration ?? 0.8);
  // Adaptive grouping: aim for each block to stay on screen for roughly
  // this long, regardless of how many words that takes. Fast words (short
  // per-word duration) keep accumulating past this target for longer, so
  // more of them fit in a block; slow words hit it almost immediately, so
  // blocks shrink toward a single word. Pace decides the count — `groupSize`
  // above only stops it from exceeding a style's ceiling.
  const targetDuration = Number(preset.targetBlockDuration ?? 1.1);
  const chunks = [];
  let slice = [];
  for (const word of words) {
    const next = [...slice, word];
    const text = next.map(w => w.word).join(" ");
    const duration = next.length ? Number(next[next.length - 1].end ?? 0) - Number(next[0].start ?? 0) : 0;
    const tooLong = slice.length > 0 && (next.length > sizeCeiling || text.length > maxChars || duration > maxDuration || duration >= targetDuration);
    if (tooLong) {
      const start = Number(slice[0].start ?? 0);
      const end = Math.max(Number(slice[slice.length - 1].end ?? start), start + minDuration);
      chunks.push({ words: slice, start, end });
      slice = [word];
    } else {
      slice = next;
    }
  }
  if (slice.length) {
    const start = Number(slice[0].start ?? 0);
    const end = Math.max(Number(slice[slice.length - 1].end ?? start), start + minDuration);
    chunks.push({ words: slice, start, end });
  }
  return chunks;
}

function PresetCard({ preset, active, onClick }) {
  const words = preset.demo.split(" ");
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-[64px] w-[90px] shrink-0 snap-center flex-col items-center justify-center overflow-hidden rounded-xl transition-all ${
        active ? "scale-[1.05] ring-2 ring-orange-400" : "opacity-70 hover:opacity-100"
      }`}
      style={{ background: preset.cardBg }}
    >
      <div className="flex max-w-full flex-wrap items-center justify-center gap-x-1 px-1.5">
        {words.map((w, i) => (
          <span key={i} style={i === 0 ? preset.activeStyle : preset.wordStyle} className="whitespace-nowrap leading-tight">
            {w}
          </span>
        ))}
      </div>
      {active && <div className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-400" />}
    </button>
  );
}

function getCaptionWordsForMode(chunk, activeWordIdx, preset) {
  const words = chunk.words ?? [];
  if (preset.mode === "single") {
    const active = words[Math.max(0, activeWordIdx)];
    return active ? [{ ...active, sourceIndex: Math.max(0, activeWordIdx) }] : [];
  }
  if (preset.mode === "word-pop") {
    const current = Math.max(0, activeWordIdx);
    const start = Math.max(0, current - 1);
    return words.slice(start, current + 1).map((word, index) => ({ ...word, sourceIndex: start + index }));
  }
  if (preset.mode === "typewriter") {
    return words.slice(0, Math.max(0, activeWordIdx) + 1).map((word, index) => ({ ...word, sourceIndex: index }));
  }
  return words.map((word, index) => ({ ...word, sourceIndex: index }));
}

function CaptionWordRenderer({ chunk, elapsed, preset }) {
  const words = chunk.words ?? [];
  if (!words.length) return null;
  let activeWordIdx = words.findIndex(w => elapsed >= w.start && elapsed < Math.max(w.end, w.start + 0.1));
  if (activeWordIdx < 0) {
    const nextWordIdx = words.findIndex(w => elapsed < w.start);
    activeWordIdx = nextWordIdx < 0 ? Math.max(0, words.length - 1) : Math.max(0, nextWordIdx - 1);
  }
  const visibleWords = getCaptionWordsForMode(chunk, activeWordIdx, preset);
  const showAccent = preset.mode === "keyword" && visibleWords.some(w => w.sourceIndex === activeWordIdx);
  const blockProgress = chunk.stable ? 1 : clamp((elapsed - chunk.start) / 0.12, 0, 1);
  const blockScale = 0.92 + blockProgress * 0.08;

  return (
    <div
      className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-lg px-2 py-1.5"
      style={{
        ...(preset.blockStyle ?? {}),
        transform: `scale(${preset.mode === "sentence" ? 1 : blockScale})`,
        transition: "transform 120ms ease-out, opacity 120ms ease-out",
      }}
    >
      {showAccent && <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-black">{preset.accentMark ?? "+"}</span>}
      {visibleWords.map((w, i) => {
        const active = w.sourceIndex === activeWordIdx;
        const style = active ? preset.activeStyle : preset.wordStyle;
        return (
          <span
            key={`${w.word}-${w.start}-${i}`}
            style={style}
            className={`inline-block leading-snug transition-all duration-100 ${preset.mode === "glitch" && active ? "animate-pulse" : ""}`}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
}

function buildManualCaptionLoop(text, speedId, preset) {
  const words = String(text || DEFAULT_PREVIEW_TEXT).trim().split(/\s+/).filter(Boolean);
  const wordSeconds = MANUAL_WORD_SECONDS[speedId] ?? MANUAL_WORD_SECONDS.fast;
  const timedWords = words.map((word, index) => ({
    word,
    start: Number((index * wordSeconds).toFixed(3)),
    end: Number(((index + 1) * wordSeconds).toFixed(3)),
  }));
  const chunks = chunkWords(timedWords, {
    ...(preset ?? {}),
    groupSize: Math.min(Number(preset?.groupSize ?? 5), 5),
    maxChars: Math.min(Number(preset?.maxChars ?? 28), 28),
    minBlockDuration: 0.75,
    maxBlockDuration: 1.85,
  }).map(chunk => ({ ...chunk, stable: true }));
  const loopDuration = Math.max(1.4, chunks[chunks.length - 1]?.end ?? timedWords[timedWords.length - 1]?.end ?? 1.4);
  return {
    loopDuration,
    chunks,
  };
}

function AutoCaptionOverlay({ chunks, elapsed, preset }) {
  if (!chunks?.length || !preset) return null;

  const chunk = chunks.find(c => elapsed >= c.start - 0.12 && elapsed < c.end + 0.18);
  if (!chunk) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-[76%] w-[88%] -translate-x-1/2 -translate-y-1/2 text-center">
      <CaptionWordRenderer chunk={chunk} elapsed={elapsed} preset={preset} />
    </div>
  );
}

function ManualTextOverlay({ item, elapsed, selected, onSelect, onDragStart }) {
  const preset = CAPTION_PRESETS.find(p => p.id === item.styleId) ?? CAPTION_PRESETS[0];
  const { loopDuration, chunks } = useMemo(
    () => buildManualCaptionLoop(item.text, item.speed, preset),
    [item.text, item.speed, preset]
  );
  const localElapsed = Math.max(0, elapsed - item.start);
  const loopElapsed = loopDuration > 0 ? localElapsed % loopDuration : 0;
  const chunk = chunks.find(c => loopElapsed >= c.start - 0.05 && loopElapsed < c.end + 0.08) ?? chunks[0];
  const fadeIn = clamp(localElapsed / 0.16, 0, 1);
  const fadeOut = clamp((item.end - elapsed) / 0.16, 0, 1);
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
      onMouseDown={(e) => { onSelect(item.id); onDragStart(e, item.id); }}
      onTouchStart={(e) => { onSelect(item.id); onDragStart(e, item.id); }}
      className="absolute group cursor-grab touch-none text-center active:cursor-grabbing"
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        width: "86%",
        transform: "translate(-50%, -50%)",
        opacity,
      }}
    >
      <div className={`inline-flex max-w-full items-center justify-center gap-1 rounded-lg p-1 transition ${
        selected ? "bg-orange-500/12 outline outline-1 outline-dashed outline-orange-300/70" : "outline outline-1 outline-transparent group-hover:bg-white/[0.04] group-hover:outline-white/20"
      }`}>
        {chunk && <CaptionWordRenderer chunk={chunk} elapsed={loopElapsed} preset={preset} />}
        {selected && <GripVertical className="ml-1 h-3.5 w-3.5 text-white/70" />}
      </div>
    </button>
  );
}

export default function CaptionPreviewPanel({ clips, captionDraft, voiceData, onStyleChange, onChangeAudio, onDraftChange }) {
  const readyClips = useMemo(
    () => clips.filter(c => c.videoUrl).sort((a, b) => a.index - b.index),
    [clips]
  );
  const videoRefs = useRef([]);
  const audioRef = useRef(null);
  const containerRef = useRef(null);
  const timelineViewportRef = useRef(null);
  const timelineRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const playingRef = useRef(false);
  const draftSignatureRef = useRef("");

  const [playing, setPlaying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [textDragId, setTextDragId] = useState(null);
  const [timelineDrag, setTimelineDrag] = useState(null);
  const [peaks, setPeaks] = useState([]);
  const [audioOffset, setAudioOffset] = useState(captionDraft?.audioOffset ?? 0);
  const [clipEdits, setClipEdits] = useState(() => captionDraft?.clipEdits ?? {});
  const [timelineZoom, setTimelineZoom] = useState(() => clamp(captionDraft?.timelineZoom ?? 1.25, 0.65, 2.6));

  const audioUrl = voiceData?.audioUrl ?? captionDraft?.voiceData?.audioUrl ?? null;
  const timelineClipEdits = useMemo(() => {
    const next = {};
    readyClips.forEach((clip) => {
      const saved = clipEdits[clip.index] ?? {};
      const start = clamp(saved.start ?? 0, 0, SOURCE_CLIP_DURATION - 0.5);
      const end = clamp(saved.end ?? SOURCE_CLIP_DURATION, start + 0.5, SOURCE_CLIP_DURATION);
      next[clip.index] = { start, end };
    });
    return next;
  }, [readyClips, clipEdits]);

  const sequenceClips = useMemo(() => {
    let cursor = 0;
    return readyClips.map((clip, position) => {
      const edit = timelineClipEdits[clip.index] ?? { start: 0, end: SOURCE_CLIP_DURATION };
      const duration = Math.max(0.5, edit.end - edit.start);
      const item = { clip, position, edit, sequenceStart: cursor, sequenceEnd: cursor + duration, duration };
      cursor += duration;
      return item;
    });
  }, [readyClips, timelineClipEdits]);

  const TOTAL_DURATION = Math.max(sequenceClips.reduce((sum, item) => sum + item.duration, 0), 0.1);
  const pxPerSecond = 38 * timelineZoom;
  const timelineWidth = Math.max(620, TOTAL_DURATION * pxPerSecond);
  const [textOverlays, setTextOverlays] = useState(() => normalizeTextOverlays(captionDraft?.textOverlays, TOTAL_DURATION));
  const [selectedTextId, setSelectedTextId] = useState(() => textOverlays[0]?.id ?? null);

  const selectedText = textOverlays.find(t => t.id === selectedTextId) ?? textOverlays[0] ?? null;
  const scriptWords = captionDraft?.captionScript?.words ?? [];
  const autoPreset = CAPTION_PRESETS.find(p => p.id === captionDraft?.captionStyle) ?? CAPTION_PRESETS[0];
  const autoChunks = useMemo(() => chunkWords(scriptWords, autoPreset), [scriptWords, autoPreset]);
  const activeTextOverlays = textOverlays.filter(item => elapsed >= item.start && elapsed < item.end);

  const updateText = useCallback((id, patch) => {
    setTextOverlays(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const addText = useCallback(() => {
    const start = clamp(elapsed, 0, Math.max(0, TOTAL_DURATION - 0.5));
    const item = {
      ...createDefaultText(TOTAL_DURATION),
      id: uid(),
      text: "zyvo is best",
      start,
      end: clamp(start + 4, start + 0.5, TOTAL_DURATION),
      x: 50,
      y: 42,
      styleId: selectedText?.styleId ?? "viral-yellow",
      speed: selectedText?.speed ?? "normal",
      previewLoop: false,
    };
    setTextOverlays(prev => [...prev, item]);
    setSelectedTextId(item.id);
    seek(start);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, TOTAL_DURATION, selectedText?.styleId, selectedText?.speed]);

  const duplicateText = useCallback(() => {
    if (!selectedText) return;
    const start = clamp(selectedText.start + 0.4, 0, Math.max(0, TOTAL_DURATION - 0.5));
    const item = {
      ...selectedText,
      id: uid(),
      start,
      end: clamp(selectedText.end + 0.4, start + 0.5, TOTAL_DURATION),
      y: clamp(selectedText.y + 8, 8, 92),
    };
    setTextOverlays(prev => [...prev, item]);
    setSelectedTextId(item.id);
  }, [selectedText, TOTAL_DURATION]);

  const deleteText = useCallback(() => {
    if (!selectedText) return;
    setTextOverlays(prev => {
      if (prev.length <= 1) {
        const replacement = createDefaultText(TOTAL_DURATION);
        setSelectedTextId(replacement.id);
        return [replacement];
      }
      const next = prev.filter(item => item.id !== selectedText.id);
      setSelectedTextId(next[0]?.id ?? null);
      return next;
    });
  }, [selectedText, TOTAL_DURATION]);

  useEffect(() => {
    setTextOverlays(prev => prev.map((item, index) => {
      const cleanText = String(item.text || "").trim().toLowerCase();
      const isLegacyPreviewText = LEGACY_PREVIEW_TEXTS.has(cleanText) || cleanText === DEFAULT_PREVIEW_TEXT;
      const isSeedPreview = prev.length === 1 && index === 0 && (
        item.previewLoop ||
        isLegacyPreviewText
      );
      const start = isSeedPreview ? 0 : clamp(item.start, 0, Math.max(0, TOTAL_DURATION - 0.35));
      const end = isSeedPreview ? TOTAL_DURATION : clamp(item.end, start + 0.35, TOTAL_DURATION);
      const text = isSeedPreview && isLegacyPreviewText ? DEFAULT_PREVIEW_TEXT : item.text;
      const previewLoop = isSeedPreview ? true : item.previewLoop;
      return start === item.start && end === item.end && text === item.text && previewLoop === item.previewLoop
        ? item
        : { ...item, start, end, text, previewLoop };
    }));
    if (elapsed > TOTAL_DURATION) seek(Math.max(0, TOTAL_DURATION - 0.05));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TOTAL_DURATION]);

  useEffect(() => {
    if (!selectedTextId) return;
    const styleId = captionDraft?.captionStyle;
    const speed = captionDraft?.textSpeed;
    if (!styleId && !speed) return;
    setTextOverlays(prev => prev.map(item => {
      if (item.id !== selectedTextId) return item;
      const next = { ...item };
      if (styleId && next.styleId !== styleId) next.styleId = styleId;
      if (speed && next.speed !== speed) next.speed = speed;
      return next.styleId === item.styleId && next.speed === item.speed ? item : next;
    }));
  }, [captionDraft?.captionStyle, captionDraft?.textSpeed, selectedTextId]);

  useEffect(() => {
    const nextDraft = {
      ...(captionDraft ?? {}),
      captionStyle: selectedText?.styleId ?? autoPreset.id,
      textSpeed: selectedText?.speed ?? captionDraft?.textSpeed ?? "normal",
      captionScript: captionDraft?.captionScript ?? null,
      previewText: selectedText?.text ?? DEFAULT_PREVIEW_TEXT,
      captionLayout: selectedText ? { x: selectedText.x, y: selectedText.y } : captionDraft?.captionLayout,
      textOverlays,
      selectedTextId,
      audioOffset,
      clipEdits: timelineClipEdits,
      timelineZoom,
    };
    const signature = JSON.stringify({
      captionStyle: nextDraft.captionStyle,
      textSpeed: nextDraft.textSpeed,
      textOverlays: nextDraft.textOverlays,
      selectedTextId,
      audioOffset: nextDraft.audioOffset,
      clipEdits: nextDraft.clipEdits,
      timelineZoom: nextDraft.timelineZoom,
      script: nextDraft.captionScript?.script ?? "",
      words: nextDraft.captionScript?.words?.length ?? 0,
    });
    if (signature === draftSignatureRef.current) return;
    draftSignatureRef.current = signature;
    onDraftChange?.(nextDraft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textOverlays, selectedTextId, audioOffset, timelineClipEdits, selectedText?.styleId, timelineZoom]);

  useEffect(() => {
    if (!audioUrl) { setPeaks([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(audioUrl);
        const buf = await res.arrayBuffer();
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const decoded = await ctx.decodeAudioData(buf.slice(0));
        const raw = decoded.getChannelData(0);
        const samples = 150;
        const blockSize = Math.max(1, Math.floor(raw.length / samples));
        const out = [];
        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) sum += Math.abs(raw[i * blockSize + j] ?? 0);
          out.push(sum / blockSize);
        }
        const max = Math.max(...out, 0.0001);
        if (!cancelled) setPeaks(out.map(v => v / max));
        ctx.close();
      } catch {
        if (!cancelled) setPeaks([]);
      }
    })();
    return () => { cancelled = true; };
  }, [audioUrl]);

  const applyElapsed = useCallback((t) => {
    setElapsed(t);
    const active = sequenceClips.find(item => t >= item.sequenceStart && t < item.sequenceEnd) ?? sequenceClips[sequenceClips.length - 1];
    const clipIdx = active?.position ?? 0;
    const clipTime = active ? active.edit.start + clamp(t - active.sequenceStart, 0, active.duration) : 0;
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === clipIdx && Math.abs(v.currentTime - clipTime) > 0.25) v.currentTime = clipTime;
      if (playingRef.current) {
        if (i === clipIdx && v.paused) v.play().catch(() => {});
        if (i !== clipIdx && !v.paused) v.pause();
      }
    });
    if (audioRef.current) {
      const audioTime = Math.max(0, t - audioOffset);
      if (Math.abs(audioRef.current.currentTime - audioTime) > 0.25) audioRef.current.currentTime = audioTime;
      audioRef.current.volume = t >= audioOffset ? 1 : 0;
    }
    setCurrentIdx(clipIdx);
  }, [sequenceClips, audioOffset]);

  const tick = useCallback(() => {
    if (!playingRef.current) return;
    const now = performance.now();
    let next = (now - startRef.current) / 1000;
    if (next >= TOTAL_DURATION) {
      next = 0;
      startRef.current = now;
    }
    applyElapsed(next);
    rafRef.current = requestAnimationFrame(tick);
  }, [TOTAL_DURATION, applyElapsed]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    videoRefs.current.forEach(v => v?.pause());
    audioRef.current?.pause();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const play = useCallback(() => {
    if (readyClips.length === 0) return;
    startRef.current = performance.now() - elapsed * 1000;
    playingRef.current = true;
    setPlaying(true);
    videoRefs.current[currentIdx]?.play().catch(() => {});
    audioRef.current?.play().catch(() => {});
    rafRef.current = requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyClips.length, currentIdx, tick]);

  const seek = useCallback((t) => {
    const clamped = clamp(t, 0, TOTAL_DURATION - 0.05);
    applyElapsed(clamped);
    if (playingRef.current) startRef.current = performance.now() - clamped * 1000;
  }, [TOTAL_DURATION, applyElapsed]);

  const togglePlay = () => (playing ? pause() : play());
  const restart = () => { seek(0); if (!playing) play(); };
  const timeToPx = useCallback((time) => time * pxPerSecond, [pxPerSecond]);
  const eventToTimelineTime = useCallback((event) => {
    if (!timelineRef.current) return 0;
    const point = event.touches ? event.touches[0] : event;
    const rect = timelineRef.current.getBoundingClientRect();
    return clamp((point.clientX - rect.left) / pxPerSecond, 0, TOTAL_DURATION);
  }, [TOTAL_DURATION, pxPerSecond]);

  useEffect(() => {
    if (readyClips.length > 0) {
      videoRefs.current.forEach(v => { if (v) v.muted = true; });
      play();
    }
    return () => pause();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyClips.length]);

  const startTextDrag = (e, id) => {
    preventMouseDefault(e);
    e.stopPropagation();
    setTextDragId(id);
  };

  useEffect(() => {
    if (!textDragId) return;
    const move = (e) => {
      if (isTouchEvent(e) && e.cancelable) e.preventDefault();
      const point = e.touches ? e.touches[0] : e;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      updateText(textDragId, {
        x: clamp(((point.clientX - rect.left) / rect.width) * 100, 8, 92),
        y: clamp(((point.clientY - rect.top) / rect.height) * 100, 8, 92),
      });
    };
    const up = () => setTextDragId(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [textDragId, updateText]);

  const handleTimelineClick = (e) => {
    if (timelineDrag || !timelineRef.current) return;
    if (e.target?.closest?.("[data-timeline-interactive='true']")) return;
    seek(eventToTimelineTime(e));
  };

  const startTimelineDrag = (kind, payload) => (e) => {
    preventMouseDefault(e);
    e.stopPropagation();
    setTimelineDrag({ kind, ...payload });
  };

  const startTextBlockDrag = (item) => (e) => {
    preventMouseDefault(e);
    e.stopPropagation();
    const pointerTime = eventToTimelineTime(e);
    setSelectedTextId(item.id);
    setTimelineDrag({
      kind: "text-move",
      textId: item.id,
      start: item.start,
      end: item.end,
      grabOffset: clamp(pointerTime - item.start, 0, item.end - item.start),
    });
  };

  useEffect(() => {
    if (!timelineDrag || !timelineRef.current) return;
    const move = (e) => {
      if (isTouchEvent(e) && e.cancelable) e.preventDefault();
      const t = eventToTimelineTime(e);
      if (timelineDrag.kind === "audio") {
        setAudioOffset(clamp(t - timelineDrag.grabOffset, 0, Math.max(0, TOTAL_DURATION - 1)));
        return;
      }
      if (timelineDrag.kind === "text-move") {
        const duration = timelineDrag.end - timelineDrag.start;
        const start = clamp(t - timelineDrag.grabOffset, 0, Math.max(0, TOTAL_DURATION - duration));
        updateText(timelineDrag.textId, { start, end: start + duration });
        return;
      }
      if (timelineDrag.kind === "text-start" || timelineDrag.kind === "text-end") {
        const item = textOverlays.find(txt => txt.id === timelineDrag.textId);
        if (!item) return;
        if (timelineDrag.kind === "text-start") updateText(item.id, { start: clamp(t, 0, item.end - 0.35) });
        if (timelineDrag.kind === "text-end") updateText(item.id, { end: clamp(t, item.start + 0.35, TOTAL_DURATION) });
        return;
      }
      const local = clamp((timelineDrag.sourceStart ?? 0) + (t - (timelineDrag.sequenceStart ?? 0)), 0, SOURCE_CLIP_DURATION);
      setClipEdits(prev => {
        const current = timelineClipEdits[timelineDrag.clipIndex] ?? { start: 0, end: SOURCE_CLIP_DURATION };
        const next = { ...current };
        if (timelineDrag.kind === "clip-start") next.start = clamp(local, 0, next.end - 0.5);
        if (timelineDrag.kind === "clip-end") next.end = clamp(local, next.start + 0.5, SOURCE_CLIP_DURATION);
        return { ...prev, [timelineDrag.clipIndex]: next };
      });
    };
    const up = () => setTimelineDrag(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [timelineDrag, TOTAL_DURATION, timelineClipEdits, textOverlays, updateText, eventToTimelineTime]);

  const playheadPx = timeToPx(elapsed);
  const audioLeftPx = clamp(timeToPx(audioOffset), 0, Math.max(0, timeToPx(TOTAL_DURATION) - 40));
  const audioWidthPx = audioUrl ? Math.max(40, timeToPx(TOTAL_DURATION) - audioLeftPx) : 0;
  const timelineTicks = useMemo(() => {
    const step = timelineZoom > 1.7 ? 3 : 6;
    const count = Math.floor(TOTAL_DURATION / step) + 1;
    return Array.from({ length: count }, (_, i) => i * step).filter(t => t <= TOTAL_DURATION);
  }, [TOTAL_DURATION, timelineZoom]);

  useEffect(() => {
    const viewport = timelineViewportRef.current;
    if (!viewport || timelineDrag) return;
    const visibleLeft = viewport.scrollLeft;
    const visibleRight = visibleLeft + viewport.clientWidth;
    const margin = Math.min(160, viewport.clientWidth * 0.32);
    if (playing || playheadPx < visibleLeft + margin || playheadPx > visibleRight - margin) {
      viewport.scrollLeft = clamp(playheadPx - viewport.clientWidth * 0.46, 0, Math.max(0, timelineWidth - viewport.clientWidth));
    }
  }, [elapsed, playheadPx, playing, timelineDrag, timelineWidth]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#07090B]">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 overflow-hidden px-3 pt-3">
        <div
          ref={containerRef}
          onClick={() => selectedText && setSelectedTextId(selectedText.id)}
          className="relative mx-auto aspect-[9/16] w-full max-w-[360px] shrink-0 overflow-hidden rounded-2xl bg-black shadow-[0_28px_90px_rgba(0,0,0,0.45)] xl:max-w-[400px]"
          style={{ maxHeight: "min(62vh, 680px)" }}
        >
          {readyClips.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[13px] text-white/25">No clips ready yet</div>
          ) : (
            <>
              {readyClips.map((clip, i) => (
                <video
                  key={clip.index}
                  ref={el => videoRefs.current[i] = el}
                  src={clip.videoUrl}
                  muted
                  playsInline
                  className={`absolute inset-0 h-full w-full bg-black object-contain transition-opacity duration-150 ${i === currentIdx ? "opacity-100" : "pointer-events-none opacity-0"}`}
                />
              ))}

              {audioUrl && <audio ref={audioRef} src={audioUrl} className="hidden" />}

              <AutoCaptionOverlay chunks={autoChunks} elapsed={elapsed} preset={autoPreset} />

              {activeTextOverlays.map(item => (
                <ManualTextOverlay
                  key={item.id}
                  item={item}
                  elapsed={elapsed}
                  selected={item.id === selectedTextId}
                  onSelect={setSelectedTextId}
                  onDragStart={startTextDrag}
                />
              ))}

              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2">
                <button
                  type="button"
                  onClick={restart}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white/70 backdrop-blur transition hover:text-white"
                  title="Restart"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:bg-white/90 active:scale-95"
                  title={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="w-full max-w-[560px] rounded-2xl border border-white/[0.07] bg-[#0F1215] p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Type className="h-3.5 w-3.5 shrink-0 text-orange-300" />
              <input
                value={selectedText?.text ?? ""}
                onChange={(e) => selectedText && updateText(selectedText.id, { text: e.target.value })}
                className="h-8 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/25 px-2.5 text-[12px] font-bold text-white outline-none transition placeholder:text-white/20 focus:border-orange-400/45"
                placeholder="Add text"
              />
            </div>
            <button type="button" onClick={addText}
              className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 text-[11px] font-black text-black transition active:scale-95">
              <Plus className="h-3.5 w-3.5" /> Text
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
            <button type="button" onClick={duplicateText} className="flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-bold text-white/58 transition hover:bg-white/[0.09] hover:text-white">
              <Copy className="h-3 w-3" /> Duplicate
            </button>
            <button type="button" onClick={deleteText} className="flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-bold text-white/58 transition hover:bg-red-500/15 hover:text-red-200">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-1.5 text-[10px] font-bold text-white/38">
              <SlidersHorizontal className="h-3 w-3" /> x {Math.round(selectedText?.x ?? 50)} y {Math.round(selectedText?.y ?? 42)}
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-1.5 text-[10px] font-bold text-white/38">
              <Clock3 className="h-3 w-3" /> {selectedText ? `${selectedText.start.toFixed(1)}-${selectedText.end.toFixed(1)}s` : "0.0s"}
            </div>
            {audioUrl && (
              <div className="ml-auto flex min-w-[140px] items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5">
                <Music2 className="h-3 w-3 shrink-0 text-sky-300" />
                <span className="flex-1 truncate text-[10px] text-white/55">{voiceData?.voiceLabel ?? "Voiceover"}</span>
                {onChangeAudio && (
                  <button
                    type="button"
                    onClick={onChangeAudio}
                    className="flex shrink-0 items-center gap-1 text-[9px] font-bold text-orange-300/80 transition hover:text-orange-300"
                  >
                    <ArrowRightLeft className="h-2.5 w-2.5" /> Change
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.07] bg-[#090B0D] px-3 pb-2 pt-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/28">
            <Scissors className="h-3 w-3" /> Zyvo AI editor
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden shrink-0 text-[9px] font-bold text-white/25 sm:block">{fmtTime(elapsed)} / {fmtTime(TOTAL_DURATION)}</span>
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.04] p-1">
              <button
                type="button"
                onClick={() => setTimelineZoom(z => clamp(z - 0.18, 0.65, 2.6))}
                className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition hover:bg-white/[0.08] hover:text-white"
                title="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <input
                aria-label="Timeline zoom"
                type="range"
                min="0.65"
                max="2.6"
                step="0.05"
                value={timelineZoom}
                onChange={(e) => setTimelineZoom(clamp(Number(e.target.value), 0.65, 2.6))}
                className="h-1 w-20 accent-orange-400"
              />
              <button
                type="button"
                onClick={() => setTimelineZoom(z => clamp(z + 0.18, 0.65, 2.6))}
                className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition hover:bg-white/[0.08] hover:text-white"
                title="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div
          ref={timelineViewportRef}
          className="rounded-xl border border-white/[0.06] bg-white/[0.025] overflow-x-auto overflow-y-visible [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]"
        >
          <div
            ref={timelineRef}
            onClick={handleTimelineClick}
            className="relative min-h-[148px] cursor-pointer select-none py-2"
            style={{ width: `${timelineWidth}px` }}
          >
            <div className="relative mb-1 h-4">
              {timelineTicks.map(t => (
                <div key={t} className="absolute top-0 h-full border-l border-white/[0.05]" style={{ left: `${timeToPx(t)}px` }}>
                  <span className="ml-1 text-[8px] font-bold text-white/20">{fmtTime(t)}</span>
                </div>
              ))}
            </div>

            <div className="relative h-11 overflow-visible">
              {sequenceClips.map(({ clip: c, position: i, edit, sequenceStart, duration }) => {
                const clipLeft = timeToPx(sequenceStart) + 2;
                const clipWidth = Math.max(40, duration * pxPerSecond - 4);
                return (
                  <div
                    key={c.index}
                    className={`absolute inset-y-0 flex items-center justify-center overflow-visible rounded-lg border text-[9px] font-bold transition ${
                      i === currentIdx ? "border-orange-300/55 bg-orange-500/14 text-orange-100" : "border-white/[0.06] bg-white/[0.04] text-white/34"
                    }`}
                    style={{ left: `${clipLeft}px`, width: `${clipWidth}px` }}
                  >
                    <div
                      className="absolute inset-y-1 rounded-md bg-teal-500/60 shadow-[0_0_16px_rgba(20,184,166,0.12)]"
                      style={{ left: 0, width: `${clipWidth}px` }}
                    />
                    <button
                      type="button"
                      data-timeline-interactive="true"
                      onMouseDown={startTimelineDrag("clip-start", { clipIndex: c.index, clipPosition: i, sequenceStart, sourceStart: edit.start })}
                      onTouchStart={startTimelineDrag("clip-start", { clipIndex: c.index, clipPosition: i, sequenceStart, sourceStart: edit.start })}
                      className="absolute -bottom-1 -top-1 z-10 w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-full border border-black/35 bg-white/80 shadow"
                      style={{ left: 0 }}
                      title="Trim start"
                    />
                    <button
                      type="button"
                      data-timeline-interactive="true"
                      onMouseDown={startTimelineDrag("clip-end", { clipIndex: c.index, clipPosition: i, sequenceStart, sourceStart: edit.start })}
                      onTouchStart={startTimelineDrag("clip-end", { clipIndex: c.index, clipPosition: i, sequenceStart, sourceStart: edit.start })}
                      className="absolute -bottom-1 -top-1 z-10 w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-full border border-black/35 bg-white/80 shadow"
                      style={{ left: `${clipWidth}px` }}
                      title="Trim end"
                    />
                    <span className="relative z-[1] max-w-[80%] truncate rounded bg-black/42 px-2 py-0.5">clip {i + 1} · {duration.toFixed(1)}s</span>
                  </div>
                );
              })}
            </div>

            <div className="relative mt-2 h-8 rounded-lg bg-white/[0.025]">
              {textOverlays.map(item => {
                const left = timeToPx(item.start);
                const width = Math.max(56, timeToPx(item.end) - timeToPx(item.start));
                const active = item.id === selectedTextId;
                return (
                  <div
                    key={item.id}
                    data-timeline-interactive="true"
                    className={`absolute inset-y-1 cursor-grab touch-none rounded-md border px-2 transition active:cursor-grabbing ${
                      active ? "border-orange-300/70 bg-orange-500/35 text-white shadow-[0_0_20px_rgba(249,115,22,0.18)]" : "border-fuchsia-300/25 bg-fuchsia-500/18 text-fuchsia-100/70"
                    }`}
                    style={{ left: `${left}px`, width: `${width}px` }}
                    onMouseDown={startTextBlockDrag(item)}
                    onTouchStart={startTextBlockDrag(item)}
                    onClick={(e) => { e.stopPropagation(); setSelectedTextId(item.id); seek(item.start); }}
                  >
                    <button
                      type="button"
                      data-timeline-interactive="true"
                      onMouseDown={startTimelineDrag("text-start", { textId: item.id })}
                      onTouchStart={startTimelineDrag("text-start", { textId: item.id })}
                      className="absolute bottom-0 left-0 top-0 z-10 w-2 cursor-ew-resize touch-none rounded-l-md bg-white/60"
                      title="Text start"
                    />
                    <button
                      type="button"
                      data-timeline-interactive="true"
                      onMouseDown={startTimelineDrag("text-end", { textId: item.id })}
                      onTouchStart={startTimelineDrag("text-end", { textId: item.id })}
                      className="absolute bottom-0 right-0 top-0 z-10 w-2 cursor-ew-resize touch-none rounded-r-md bg-white/60"
                      title="Text end"
                    />
                    <span className="relative z-[1] block truncate text-center text-[8px] font-black leading-6">{item.text}</span>
                  </div>
                );
              })}
            </div>

            {audioUrl && (
              <div className="relative mt-2 h-8 rounded-lg bg-white/[0.03]">
                <div
                  data-timeline-interactive="true"
                  className="absolute inset-y-1 flex cursor-grab touch-none items-center gap-px rounded-md border border-sky-300/30 bg-sky-500/18 px-1 shadow-[0_0_22px_rgba(56,189,248,0.12)] active:cursor-grabbing"
                  style={{ left: `${audioLeftPx}px`, width: `${audioWidthPx}px` }}
                  onMouseDown={startTimelineDrag("audio", { grabOffset: Math.max(0, elapsed - audioOffset) })}
                  onTouchStart={startTimelineDrag("audio", { grabOffset: Math.max(0, elapsed - audioOffset) })}
                  title="Drag audio"
                >
                  {(peaks.length ? peaks : Array.from({ length: 90 }, (_, i) => ((i * 37) % 80) / 80)).map((p, i) => (
                    <div key={i} className="flex-1 rounded-full bg-sky-300/75" style={{ height: `${Math.max(14, p * 100)}%` }} />
                  ))}
                </div>
              </div>
            )}

            {autoChunks.length > 0 && (
              <div className="relative mt-2 h-5 rounded-lg bg-white/[0.02]">
                {autoChunks.map((c, i) => (
                  <div
                    key={i}
                    className="absolute inset-y-0 flex items-center justify-center overflow-hidden border-r border-black/30 bg-rose-500/14 px-1"
                    style={{ left: `${timeToPx(c.start)}px`, width: `${Math.max(28, timeToPx(c.end) - timeToPx(c.start))}px` }}
                  >
                    <span className="truncate text-[7px] font-bold text-rose-100/55">{c.words.map(w => w.word).join(" ")}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pointer-events-none absolute bottom-2 top-2 z-20 w-px bg-orange-400 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" style={{ left: `${playheadPx}px` }} />
          </div>
        </div>
      </div>

    </div>
  );
}
