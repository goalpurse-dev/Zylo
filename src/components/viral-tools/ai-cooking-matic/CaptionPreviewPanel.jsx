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
  Plus,
  Trash2,
  Copy,
  Clock3,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import {
  buildAdaptiveCaptionGroups,
  CAPTION_GROUPING_VERSION,
  captionModeForStyle,
} from "./captionGrouping";

const heavyFont = "Impact, Arial Black, Inter, sans-serif";
const boldFont = "Arial Black, Inter, sans-serif";
const cleanFont = "Inter, Arial, sans-serif";
const slabFont = "Georgia, Times New Roman, serif";
const blackStroke = "-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000,0 4px 12px rgba(0,0,0,0.55)";
const softGlow = "0 0 14px currentColor,0 6px 20px rgba(0,0,0,0.65)";
const LEGACY_PREVIEW_TEXTS = new Set([
  "zyvo is best",
  "zyvo is best for viral cooking videos",
  "zyvo is the best ai generating platform you can use in 2026. create viral videos in seconds.",
]);

// eslint-disable-next-line react-refresh/only-export-components
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
    demo: "TASTE THIS",
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

// eslint-disable-next-line react-refresh/only-export-components
export const TEXT_SPEEDS = [
  { id: "fast", label: "Fast", desc: "Snappy pop", revealSec: 0.28 },
  { id: "normal", label: "Normal", desc: "Balanced", revealSec: 0.62 },
  { id: "slow", label: "Slow", desc: "Smooth reveal", revealSec: 1.1 },
];

const SOURCE_CLIP_DURATION = 6;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const fmtTime = (value) => `00:${String(Math.floor(value)).padStart(2, "0")}`;
const uid = () => `txt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const isTouchEvent = (event) => Boolean(event?.touches);
const preventMouseDefault = (event) => {
  if (!isTouchEvent(event) && event?.cancelable !== false) event.preventDefault();
};

function createTextOverlay(duration, text = "New caption") {
  return {
    id: uid(),
    text,
    start: 0,
    end: Math.min(Math.max(0.8, duration), 3),
    x: 50,
    y: 76,
    scale: 1,
    styleId: "viral-yellow",
    // "normal" (not "fast") so the very first thing anyone sees is the
    // calm, natural-speech pace — "fast" is still there to opt into.
    speed: "normal",
    previewLoop: false,
  };
}

function normalizeTextOverlays(raw, duration) {
  const safeDuration = Math.max(0.5, Number(duration) || 0.5);
  const list = Array.isArray(raw) ? raw.filter(item => {
    const cleanText = String(item?.text || "").trim().toLowerCase();
    return !item?.previewLoop && !LEGACY_PREVIEW_TEXTS.has(cleanText);
  }) : [];
  return list.map((item, index) => {
    const minDuration = item.autoCaption ? 0.04 : 0.35;
    const start = clamp(Number(item.start ?? index * 1.5), 0, Math.max(0, safeDuration - minDuration));
    const end = clamp(Number(item.end ?? start + 4), start + minDuration, safeDuration);
    return {
      id: item.id || uid(),
      text: item.text || "New caption",
      start,
      end,
      x: clamp(Number(item.x ?? 50), 8, 92),
      y: clamp(Number(item.y ?? 76), 8, 92),
      scale: clamp(Number(item.scale ?? 1), 0.55, 2.2),
      styleId: item.styleId || item.captionStyle || "viral-yellow",
      speed: item.speed || "normal",
      previewLoop: false,
      words: Array.isArray(item.words) ? item.words : null,
      autoCaption: Boolean(item.autoCaption),
      sourceSignature: item.sourceSignature || null,
      groupingVersion: Number(item.groupingVersion || 0),
    };
  });
}

function captionOverlaySignature(items) {
  return JSON.stringify((Array.isArray(items) ? items : []).map(item => ({
    id: item?.id,
    text: item?.text,
    start: Number(item?.start ?? 0),
    end: Number(item?.end ?? 0),
    x: Number(item?.x ?? 50),
    y: Number(item?.y ?? 76),
    scale: Number(item?.scale ?? 1),
    styleId: item?.styleId,
    speed: item?.speed,
    autoCaption: Boolean(item?.autoCaption),
    sourceSignature: item?.sourceSignature ?? null,
    groupingVersion: Number(item?.groupingVersion || 0),
    words: Array.isArray(item?.words)
      ? item.words.map(word => [word.word, Number(word.start ?? 0), Number(word.end ?? 0)])
      : null,
  })));
}

function distributeCaptionWords(text, start, end) {
  const parts = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const duration = Math.max(0.35, end - start);
  return parts.map((word, index) => ({
    word,
    start: start + (duration * index) / parts.length,
    end: start + (duration * (index + 1)) / parts.length,
  }));
}

function chunkCaptionWords(words, preset) {
  return buildAdaptiveCaptionGroups(words, {
    styleId: preset?.id,
    mode: preset?.mode,
    maxWords: Math.min(3, Number(preset?.groupSize ?? 3) || 3),
    maxChars: Math.min(30, Number(preset?.maxChars ?? 26) || 26),
  });
}

function buildCaptionOverlays(words, preset, duration, layout = {}) {
  if (!Array.isArray(words) || !words.length) return [];
  const signature = words.map(word => `${word.word}:${Number(word.start || 0).toFixed(2)}:${Number(word.end || 0).toFixed(2)}`).join("|");
  const editorChunks = chunkCaptionWords(words, preset);
  return editorChunks.map((chunk, index) => ({
    id: `caption-${index}-${Math.round(chunk.start * 1000)}`,
    text: chunk.words.map(word => word.word).join(" "),
    words: chunk.words,
    start: clamp(Number(chunk.start ?? 0), 0, duration),
    end: clamp(Number(chunk.end ?? chunk.start + 0.8), Number(chunk.start ?? 0) + 0.04, duration),
    x: clamp(Number(layout.x ?? 50), 8, 92),
    y: clamp(Number(layout.y ?? 76), 8, 92),
    scale: clamp(Number(layout.scale ?? 1), 0.55, 2.2),
    styleId: preset.id,
    speed: "normal",
    previewLoop: false,
    autoCaption: true,
    sourceSignature: signature,
    groupingVersion: CAPTION_GROUPING_VERSION,
  }));
}

function buildDisplayCaptionChunks(words, preset) {
  return chunkCaptionWords(words, preset).map(chunk => ({ ...chunk, stable: true }));
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
  const mode = preset?.mode ?? captionModeForStyle(preset?.id);
  if (mode === "single") {
    const active = words[Math.max(0, activeWordIdx)];
    return active ? [{ ...active, sourceIndex: Math.max(0, activeWordIdx) }] : [];
  }
  if (mode === "word-pop") {
    const current = Math.max(0, activeWordIdx);
    const start = Math.max(0, current - 1);
    return words.slice(start, current + 1).map((word, index) => ({ ...word, sourceIndex: start + index }));
  }
  if (mode === "typewriter") {
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

function ManualTextOverlay({ item, elapsed, selected, onSelect, onDragStart, onResizeStart }) {
  const preset = CAPTION_PRESETS.find(p => p.id === item.styleId) ?? CAPTION_PRESETS[0];
  const words = useMemo(
    () => Array.isArray(item.words) && item.words.length
      ? item.words
      : distributeCaptionWords(item.text, item.start, item.end),
    [item.words, item.text, item.start, item.end]
  );
  const displayChunks = useMemo(() => buildDisplayCaptionChunks(words, preset), [words, preset]);
  const chunk = displayChunks.find(part => elapsed >= part.start - 0.04 && elapsed < part.end + 0.08)
    ?? displayChunks.find(part => elapsed < part.start)
    ?? displayChunks[displayChunks.length - 1];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
      onMouseDown={(e) => { onSelect(item.id); onDragStart(e, item.id); }}
      onTouchStart={(e) => { onSelect(item.id); onDragStart(e, item.id); }}
      className="absolute group cursor-grab touch-none text-center active:cursor-grabbing"
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        width: "86%",
        transform: "translate(-50%, -50%)",
        opacity: 1,
      }}
    >
      <div
        className={`relative inline-flex max-w-full items-center justify-center gap-1 rounded-lg p-1 transition ${
        selected ? "bg-orange-500/12 outline outline-1 outline-dashed outline-orange-300/70" : "outline outline-1 outline-transparent group-hover:bg-white/[0.04] group-hover:outline-white/20"
        }`}
        style={{ transform: `scale(${item.scale ?? 1})` }}
      >
        <CaptionWordRenderer chunk={chunk} elapsed={elapsed} preset={preset} />
        {selected && <GripVertical className="ml-1 h-3.5 w-3.5 text-white/70" />}
        {selected && (
          <button
            type="button"
            aria-label="Resize caption"
            title="Drag to resize caption"
            onMouseDown={(e) => onResizeStart(e, item.id)}
            onTouchStart={(e) => onResizeStart(e, item.id)}
            className="absolute -bottom-3 -right-3 flex h-6 w-6 cursor-nwse-resize touch-none items-center justify-center rounded-full border border-orange-200/70 bg-[#111] text-orange-300 shadow-lg"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function CaptionPreviewPanel({ clips, captionDraft, voiceData, onChangeAudio, onDraftChange }) {
  const readyClips = useMemo(
    () => clips.filter(c => c.videoUrl).sort((a, b) => a.index - b.index),
    [clips]
  );
  const videoRefs = useRef([]);
  const audioRef = useRef(null);
  const containerRef = useRef(null);
  const timelineViewportRef = useRef(null);
  const timelineRef = useRef(null);
  const playheadRef = useRef(null);
  const timeLabelRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(0);
  const playingRef = useRef(false);
  const elapsedRef = useRef(0);
  const applyElapsedLatestRef = useRef(null);
  const captionRenderKeyRef = useRef("");
  const currentIdxRef = useRef(0);
  const lastDisplayedSecondRef = useRef(-1);
  const timelineAutoFollowBlockedUntilRef = useRef(0);
  const draftSignatureRef = useRef("");

  const [playing, setPlaying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [textDragId, setTextDragId] = useState(null);
  const [textResize, setTextResize] = useState(null);
  const [timelineDrag, setTimelineDrag] = useState(null);
  const [peaks, setPeaks] = useState([]);
  const [measuredAudioDuration, setMeasuredAudioDuration] = useState(null);
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
  const voicePlaybackRate = voiceData?.imported
    ? 1
    : clamp(
      Number(voiceData?.playbackRate)
        || (Number(voiceData?.durationSec) > 0 ? Number(voiceData.durationSec) / TOTAL_DURATION : 1),
      0.5,
      2,
    );
  const pxPerSecond = 38 * timelineZoom;
  const timelineWidth = Math.max(620, TOTAL_DURATION * pxPerSecond);
  const scriptWords = useMemo(() => {
    const source = Array.isArray(captionDraft?.captionScript?.words) ? captionDraft.captionScript.words : [];
    if (voiceData?.imported || captionDraft?.captionScript?.timelineNormalized || Math.abs(voicePlaybackRate - 1) < 0.001) return source;
    return source.map(word => ({
      ...word,
      start: Number(((Number(word.start) || 0) / voicePlaybackRate).toFixed(3)),
      end: Number(((Number(word.end) || 0) / voicePlaybackRate).toFixed(3)),
    }));
  }, [captionDraft?.captionScript?.timelineNormalized, captionDraft?.captionScript?.words, voiceData?.imported, voicePlaybackRate]);
  const autoPreset = CAPTION_PRESETS.find(p => p.id === captionDraft?.captionStyle) ?? CAPTION_PRESETS[0];
  const sourceSignature = useMemo(
    () => scriptWords.map(word => `${word.word}:${Number(word.start || 0).toFixed(2)}:${Number(word.end || 0).toFixed(2)}`).join("|"),
    [scriptWords]
  );
  const [textOverlays, setTextOverlays] = useState(() => {
    const saved = normalizeTextOverlays(captionDraft?.textOverlays, TOTAL_DURATION);
    return saved.length ? saved : buildCaptionOverlays(scriptWords, autoPreset, TOTAL_DURATION, captionDraft?.captionLayout);
  });
  const captionsInitializedRef = useRef(textOverlays.length > 0);
  const [selectedTextId, setSelectedTextId] = useState(() => textOverlays[0]?.id ?? null);

  const selectedText = textOverlays.find(t => t.id === selectedTextId) ?? textOverlays[0] ?? null;
  const activeTextOverlays = textOverlays.filter(item => elapsed >= item.start && elapsed < item.end);
  // Never mount an inactive selected caption on top of the active caption
  // while playback is running. Paused mode still keeps it visible for edits.
  const visibleTextOverlays = playing
    ? activeTextOverlays.slice(0, 1)
    : (selectedText && !activeTextOverlays.some(item => item.id === selectedText.id)
      ? [selectedText]
      : activeTextOverlays.slice(0, 1));

  const updateText = useCallback((id, patch) => {
    setTextOverlays(prev => prev.map(item => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      if ("text" in patch || "start" in patch || "end" in patch) {
        next.words = distributeCaptionWords(next.text, next.start, next.end);
      }
      return next;
    }));
  }, []);

  // Caption placement and size are global presentation settings. Text and
  // timing remain editable per caption, but moving/resizing any caption keeps
  // every caption visually consistent throughout the final video.
  const updateAllCaptionLayout = useCallback((patch) => {
    setTextOverlays(prev => prev.map(item => ({ ...item, ...patch })));
  }, []);

  const addText = useCallback(() => {
    const start = clamp(elapsedRef.current, 0, Math.max(0, TOTAL_DURATION - 0.5));
    const item = {
      ...createTextOverlay(TOTAL_DURATION),
      id: uid(),
      text: "New caption",
      start,
      end: clamp(start + 4, start + 0.5, TOTAL_DURATION),
      x: selectedText?.x ?? 50,
      y: selectedText?.y ?? 76,
      scale: selectedText?.scale ?? 1,
      styleId: selectedText?.styleId ?? "viral-yellow",
      speed: selectedText?.speed ?? "normal",
      previewLoop: false,
    };
    setTextOverlays(prev => [...prev, item]);
    setSelectedTextId(item.id);
    seek(start);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TOTAL_DURATION, selectedText?.styleId, selectedText?.speed, selectedText?.x, selectedText?.y, selectedText?.scale]);

  const duplicateText = useCallback(() => {
    if (!selectedText) return;
    const start = clamp(selectedText.start + 0.4, 0, Math.max(0, TOTAL_DURATION - 0.5));
    const item = {
      ...selectedText,
      id: uid(),
      start,
      end: clamp(selectedText.end + 0.4, start + 0.5, TOTAL_DURATION),
      x: selectedText.x,
      y: selectedText.y,
      scale: selectedText.scale ?? 1,
    };
    setTextOverlays(prev => [...prev, item]);
    setSelectedTextId(item.id);
  }, [selectedText, TOTAL_DURATION]);

  const deleteText = useCallback(() => {
    if (!selectedText) return;
    setTextOverlays(prev => {
      const next = prev.filter(item => item.id !== selectedText.id);
      setSelectedTextId(next[0]?.id ?? null);
      return next;
    });
  }, [selectedText]);

  useEffect(() => {
    setTextOverlays(prev => {
      const clean = normalizeTextOverlays(prev, TOTAL_DURATION);
      if (!scriptWords.length) {
        const next = clean.filter(item => !item.autoCaption);
        return captionOverlaySignature(next) === captionOverlaySignature(prev) ? prev : next;
      }
      const existingSource = clean.find(item => item.autoCaption)?.sourceSignature;
      const staleAutoGrouping = clean.some(item => item.autoCaption && item.groupingVersion < CAPTION_GROUPING_VERSION);
      if (!clean.length || staleAutoGrouping || (existingSource && existingSource !== sourceSignature)) {
        const generated = buildCaptionOverlays(scriptWords, autoPreset, TOTAL_DURATION, captionDraft?.captionLayout);
        const manual = clean.filter(item => !item.autoCaption);
        captionsInitializedRef.current = generated.length > 0;
        const next = [...generated, ...manual];
        return captionOverlaySignature(next) === captionOverlaySignature(prev) ? prev : next;
      }
      return captionOverlaySignature(clean) === captionOverlaySignature(prev) ? prev : clean;
    });
    if (elapsed > TOTAL_DURATION) seek(Math.max(0, TOTAL_DURATION - 0.05));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TOTAL_DURATION, sourceSignature]);

  useEffect(() => {
    if (!textOverlays.length) {
      if (selectedTextId !== null) setSelectedTextId(null);
      return;
    }
    if (!textOverlays.some(item => item.id === selectedTextId)) {
      setSelectedTextId(textOverlays[0].id);
    }
  }, [selectedTextId, textOverlays]);

  useEffect(() => {
    if (!selectedTextId) return;
    const styleId = captionDraft?.captionStyle;
    const speed = captionDraft?.textSpeed;
    if (!styleId && !speed) return;
    setTextOverlays(prev => {
      let changed = false;
      const nextItems = prev.map(item => {
        if (item.id !== selectedTextId && !item.autoCaption) return item;
        const next = { ...item };
        if (styleId && next.styleId !== styleId) next.styleId = styleId;
        if (speed && next.speed !== speed) next.speed = speed;
        if (next.styleId === item.styleId && next.speed === item.speed) return item;
        changed = true;
        return next;
      });
      return changed ? nextItems : prev;
    });
  }, [captionDraft?.captionStyle, captionDraft?.textSpeed, selectedTextId]);

  useEffect(() => {
    // On the first Step 3 render the preview may mount one render before the
    // transcript reaches the parent. Never let that temporary empty state
    // overwrite the real caption script supplied by CaptionStep.
    if (!captionsInitializedRef.current && textOverlays.length === 0) return;
    const editableWords = textOverlays
      .slice()
      .sort((a, b) => a.start - b.start)
      .flatMap(item => Array.isArray(item.words) && item.words.length
        ? item.words
        : distributeCaptionWords(item.text, item.start, item.end));
    const editableScript = textOverlays
      .slice()
      .sort((a, b) => a.start - b.start)
      .map(item => item.text.trim())
      .filter(Boolean)
      .join(" ");
    const nextDraft = {
      ...(captionDraft ?? {}),
      captionStyle: selectedText?.styleId ?? autoPreset.id,
      textSpeed: selectedText?.speed ?? captionDraft?.textSpeed ?? "normal",
      captionScript: {
        ...(captionDraft?.captionScript ?? {}),
        script: editableScript,
        words: editableWords,
        segments: textOverlays.map(item => ({ text: item.text, start: item.start, end: item.end })),
        playbackRate: voicePlaybackRate,
        timelineDurationSec: TOTAL_DURATION,
        timelineNormalized: !voiceData?.imported,
      },
      previewText: selectedText?.text ?? "",
      captionLayout: selectedText ? { x: selectedText.x, y: selectedText.y, scale: selectedText.scale ?? 1 } : captionDraft?.captionLayout,
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
  }, [textOverlays, selectedTextId, audioOffset, timelineClipEdits, selectedText?.styleId, selectedText?.scale, timelineZoom, voiceData?.imported, voicePlaybackRate, TOTAL_DURATION]);

  useEffect(() => {
    setMeasuredAudioDuration(null);
    if (!audioUrl) { setPeaks([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(audioUrl);
        const buf = await res.arrayBuffer();
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        const decoded = await ctx.decodeAudioData(buf.slice(0));
        if (!cancelled && Number.isFinite(decoded.duration) && decoded.duration > 0) {
          setMeasuredAudioDuration(decoded.duration);
        }
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

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = voicePlaybackRate;
    audioRef.current.preservesPitch = true;
  }, [audioUrl, voicePlaybackRate]);

  const timeToPx = useCallback((time) => time * pxPerSecond, [pxPerSecond]);

  const applyElapsed = useCallback((t, forceCommit = false) => {
    const previous = elapsedRef.current;
    const wrappedAtEnd = previous > TOTAL_DURATION - 0.35 && t < 0.35;
    if (playingRef.current && !forceCommit && !wrappedAtEnd && t + 0.035 < previous) return;
    elapsedRef.current = t;
    if (playheadRef.current) playheadRef.current.style.transform = `translateX(${timeToPx(t)}px)`;
    const wholeSecond = Math.floor(t);
    if (timeLabelRef.current && wholeSecond !== lastDisplayedSecondRef.current) {
      lastDisplayedSecondRef.current = wholeSecond;
      timeLabelRef.current.textContent = `${fmtTime(t)} / ${fmtTime(TOTAL_DURATION)}`;
    }
    const activeCaption = textOverlays.find(item => t >= item.start && t < item.end);
    const activeWords = activeCaption
      ? (Array.isArray(activeCaption.words) && activeCaption.words.length
        ? activeCaption.words
        : distributeCaptionWords(activeCaption.text, activeCaption.start, activeCaption.end))
      : [];
    let activeWordIndex = activeWords.findIndex(word => t >= word.start && t < Math.max(word.end, word.start + 0.1));
    if (activeWordIndex < 0 && activeWords.length) {
      const nextWord = activeWords.findIndex(word => t < word.start);
      activeWordIndex = nextWord < 0 ? activeWords.length - 1 : Math.max(0, nextWord - 1);
    }
    const renderKey = `${activeCaption?.id ?? "none"}:${activeWordIndex}`;
    if (forceCommit || !playingRef.current || renderKey !== captionRenderKeyRef.current) {
      captionRenderKeyRef.current = renderKey;
      setElapsed(t);
    }
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
      const audioTime = Math.max(0, t - audioOffset) * voicePlaybackRate;
      if (t < audioOffset) {
        audioRef.current.volume = 0;
        if (!audioRef.current.paused) audioRef.current.pause();
        if (audioRef.current.currentTime > 0.03) audioRef.current.currentTime = 0;
      } else {
        audioRef.current.volume = 1;
        if (Math.abs(audioRef.current.currentTime - audioTime) > 0.08) {
          audioRef.current.currentTime = audioTime;
        }
        if (playingRef.current && audioRef.current.paused && !audioRef.current.ended) {
          audioRef.current.play().catch(() => {});
        }
      }
    }
    if (clipIdx !== currentIdxRef.current) {
      currentIdxRef.current = clipIdx;
      setCurrentIdx(clipIdx);
    }

    const viewport = timelineViewportRef.current;
    if (playingRef.current && viewport && Date.now() >= timelineAutoFollowBlockedUntilRef.current) {
      const playheadPx = timeToPx(t);
      const margin = Math.min(160, viewport.clientWidth * 0.32);
      const visibleLeft = viewport.scrollLeft;
      const visibleRight = visibleLeft + viewport.clientWidth;
      if (playheadPx < visibleLeft + margin || playheadPx > visibleRight - margin) {
        viewport.scrollLeft = clamp(playheadPx - viewport.clientWidth * 0.46, 0, Math.max(0, timelineWidth - viewport.clientWidth));
      }
    }
  }, [sequenceClips, audioOffset, textOverlays, timeToPx, TOTAL_DURATION, timelineWidth, voicePlaybackRate]);

  // requestAnimationFrame schedules the same callback recursively. Route it
  // through a ref so it always sees the newest caption blocks/timings after
  // the transcript arrives or the creator edits the timeline.
  applyElapsedLatestRef.current = applyElapsed;

  const tick = useCallback(() => {
    if (!playingRef.current) return;
    const now = performance.now();
    let next = (now - startRef.current) / 1000;
    const audio = audioRef.current;
    // HTML audio starts asynchronously and can trail performance.now() by a
    // visible fraction of a second. Once the voice rail begins, use the
    // decoded audio position as the master clock so captions follow speech.
    if (audio && next >= audioOffset && !audio.ended) {
      next = audioOffset + Math.max(0, audio.currentTime / voicePlaybackRate);
    }
    if (next >= TOTAL_DURATION) {
      next = 0;
      startRef.current = now;
    }
    applyElapsedLatestRef.current?.(next);
    rafRef.current = requestAnimationFrame(tick);
  }, [TOTAL_DURATION, audioOffset, voicePlaybackRate]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    videoRefs.current.forEach(v => v?.pause());
    audioRef.current?.pause();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const play = useCallback(() => {
    if (readyClips.length === 0) return;
    startRef.current = performance.now() - elapsedRef.current * 1000;
    playingRef.current = true;
    setPlaying(true);
    videoRefs.current[currentIdxRef.current]?.play().catch(() => {});
    if (audioRef.current) {
      const shouldPlayAudio = elapsedRef.current >= audioOffset;
      const desiredAudioTime = Math.max(0, elapsedRef.current - audioOffset) * voicePlaybackRate;
      if (Math.abs(audioRef.current.currentTime - desiredAudioTime) > 0.03) {
        audioRef.current.currentTime = desiredAudioTime;
      }
      audioRef.current.volume = shouldPlayAudio ? 1 : 0;
      if (shouldPlayAudio) audioRef.current.play().catch(() => {});
      else audioRef.current.pause();
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [audioOffset, readyClips.length, tick, voicePlaybackRate]);

  const seek = useCallback((t) => {
    const clamped = clamp(t, 0, TOTAL_DURATION - 0.05);
    applyElapsed(clamped, true);
    if (playingRef.current) startRef.current = performance.now() - clamped * 1000;
  }, [TOTAL_DURATION, applyElapsed]);

  const togglePlay = useCallback(() => (playingRef.current ? pause() : play()), [pause, play]);
  const restart = () => { seek(0); if (!playing) play(); };
  const eventToTimelineTime = useCallback((event) => {
    if (!timelineRef.current) return 0;
    const point = event.touches ? event.touches[0] : event;
    const rect = timelineRef.current.getBoundingClientRect();
    return clamp((point.clientX - rect.left) / pxPerSecond, 0, TOTAL_DURATION);
  }, [TOTAL_DURATION, pxPerSecond]);

  useEffect(() => {
    if (readyClips.length > 0) {
      videoRefs.current.forEach(v => { if (v) v.muted = true; });
      // Preview opens paused. This prevents hidden/mobile panels from starting
      // playback before the creator deliberately enters Preview.
      pause();
      seek(0);
    }
    return () => pause();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyClips.length]);

  useEffect(() => {
    const handleSpace = (event) => {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target;
      const tagName = target?.tagName;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tagName)) return;
      event.preventDefault();
      togglePlay();
    };
    window.addEventListener("keydown", handleSpace);
    return () => window.removeEventListener("keydown", handleSpace);
  }, [togglePlay]);

  const startTextDrag = (e, id) => {
    preventMouseDefault(e);
    e.stopPropagation();
    if (playingRef.current) pause();
    setTextDragId(id);
  };

  const startTextResize = (e, id) => {
    preventMouseDefault(e);
    e.stopPropagation();
    if (playingRef.current) pause();
    const point = e.touches ? e.touches[0] : e;
    const item = textOverlays.find(text => text.id === id);
    if (!item) return;
    setSelectedTextId(id);
    setTextResize({ id, startX: point.clientX, startY: point.clientY, startScale: item.scale ?? 1 });
  };

  useEffect(() => {
    if (!textDragId) return;
    const move = (e) => {
      if (isTouchEvent(e) && e.cancelable) e.preventDefault();
      const point = e.touches ? e.touches[0] : e;
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      updateAllCaptionLayout({
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
  }, [textDragId, updateAllCaptionLayout]);

  useEffect(() => {
    if (!textResize) return;
    const move = (e) => {
      if (isTouchEvent(e) && e.cancelable) e.preventDefault();
      const point = e.touches ? e.touches[0] : e;
      const delta = ((point.clientX - textResize.startX) + (point.clientY - textResize.startY)) / 220;
      updateAllCaptionLayout({ scale: clamp(textResize.startScale + delta, 0.55, 2.2) });
    };
    const up = () => setTextResize(null);
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
  }, [textResize, updateAllCaptionLayout]);

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
        const nextOffset = clamp(t - timelineDrag.grabOffset, 0, Math.max(0, TOTAL_DURATION - 1));
        setAudioOffset(previousOffset => {
          const delta = nextOffset - previousOffset;
          if (Math.abs(delta) > 0.0001) {
            setTextOverlays(previous => previous.map(item => {
              if (!item.autoCaption) return item;
              const shiftedWords = (item.words ?? []).map(word => ({
                ...word,
                start: clamp(Number(word.start || 0) + delta, 0, TOTAL_DURATION),
                end: clamp(Number(word.end || 0) + delta, 0, TOTAL_DURATION),
              }));
              return {
                ...item,
                start: clamp(item.start + delta, 0, TOTAL_DURATION),
                end: clamp(item.end + delta, 0, TOTAL_DURATION),
                words: shiftedWords,
              };
            }));
          }
          return nextOffset;
        });
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

  const audioLeftPx = clamp(timeToPx(audioOffset), 0, Math.max(0, timeToPx(TOTAL_DURATION) - 40));
  const audioDuration = clamp(
    (Number(measuredAudioDuration) || Number(voiceData?.durationSec) || 0.5) / voicePlaybackRate,
    0.5,
    Math.max(0.5, TOTAL_DURATION - audioOffset),
  );
  const audioWidthPx = audioUrl ? Math.max(72, timeToPx(audioDuration)) : 0;
  const audioClipLabel = voiceData?.fileName || voiceData?.voiceLabel || "Voiceover";
  const timelineTicks = useMemo(() => {
    const step = timelineZoom > 1.7 ? 3 : 6;
    const count = Math.floor(TOTAL_DURATION / step) + 1;
    return Array.from({ length: count }, (_, i) => i * step).filter(t => t <= TOTAL_DURATION);
  }, [TOTAL_DURATION, timelineZoom]);

  return (
    <div className="flex min-h-0 w-full flex-col rounded-2xl border border-white/[0.07] bg-[#07090B] lg:h-full lg:overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2.5 px-3 pt-3 lg:overflow-hidden">
        <div
          ref={containerRef}
          onClick={() => selectedText && setSelectedTextId(selectedText.id)}
          className="relative mx-auto aspect-[9/16] h-[min(58dvh,680px)] max-h-[calc(100dvh-310px)] w-auto max-w-full shrink-0 overflow-hidden rounded-2xl bg-black shadow-[0_28px_90px_rgba(0,0,0,0.45)]"
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

              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  className="hidden"
                  onLoadedMetadata={(event) => {
                    const duration = event.currentTarget.duration;
                    event.currentTarget.playbackRate = voicePlaybackRate;
                    event.currentTarget.preservesPitch = true;
                    if (Number.isFinite(duration) && duration > 0) setMeasuredAudioDuration(duration);
                  }}
                />
              )}

              {visibleTextOverlays.map(item => (
                <ManualTextOverlay
                  key={item.id}
                  item={item}
                  elapsed={elapsed}
                  selected={item.id === selectedTextId}
                  onSelect={setSelectedTextId}
                  onDragStart={startTextDrag}
                  onResizeStart={startTextResize}
                />
              ))}

              <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2">
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
              <Plus className="h-3.5 w-3.5" /> Caption
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
            <button type="button" onClick={duplicateText} className="flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-bold text-white/58 transition hover:bg-white/[0.09] hover:text-white">
              <Copy className="h-3 w-3" /> Duplicate
            </button>
            <button type="button" onClick={deleteText} className="flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-bold text-white/58 transition hover:bg-red-500/15 hover:text-red-200">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
            <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-white/45">
              <Maximize2 className="h-3 w-3" />
              <input
                aria-label="Caption size"
                type="range"
                min="0.55"
                max="2.2"
                step="0.05"
                disabled={!selectedText}
                value={selectedText?.scale ?? 1}
                onChange={(e) => selectedText && updateAllCaptionLayout({ scale: Number(e.target.value) })}
                className="h-1 w-16 accent-orange-400"
              />
              <span>{Math.round((selectedText?.scale ?? 1) * 100)}%</span>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-white/45">
              <Clock3 className="h-3 w-3" />
              <input
                aria-label="Caption start time"
                type="number"
                min="0"
                max={selectedText ? selectedText.end - 0.35 : TOTAL_DURATION}
                step="0.1"
                disabled={!selectedText}
                value={selectedText ? selectedText.start.toFixed(1) : "0.0"}
                onChange={(e) => selectedText && updateText(selectedText.id, { start: clamp(Number(e.target.value), 0, selectedText.end - 0.35) })}
                className="w-11 bg-transparent text-center text-white/70 outline-none"
              />
              <span className="text-white/20">→</span>
              <input
                aria-label="Caption end time"
                type="number"
                min={selectedText ? selectedText.start + 0.35 : 0.35}
                max={TOTAL_DURATION}
                step="0.1"
                disabled={!selectedText}
                value={selectedText ? selectedText.end.toFixed(1) : "0.0"}
                onChange={(e) => selectedText && updateText(selectedText.id, { end: clamp(Number(e.target.value), selectedText.start + 0.35, TOTAL_DURATION) })}
                className="w-11 bg-transparent text-center text-white/70 outline-none"
              />
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
            <span ref={timeLabelRef} className="hidden shrink-0 text-[9px] font-bold text-white/25 sm:block">{fmtTime(elapsed)} / {fmtTime(TOTAL_DURATION)}</span>
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
          onWheel={() => { timelineAutoFollowBlockedUntilRef.current = Date.now() + 2200; }}
          onPointerDown={() => { timelineAutoFollowBlockedUntilRef.current = Date.now() + 2200; }}
          onTouchStart={() => { timelineAutoFollowBlockedUntilRef.current = Date.now() + 2200; }}
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

            <div className="mb-1 mt-2 flex items-center justify-between px-1 text-[8px] font-black uppercase tracking-[0.18em] text-white/25">
              <span>Captions</span>
              <span className="normal-case tracking-normal text-white/18">Drag blocks · pull white edges to retime</span>
            </div>
            <div className="relative h-10 rounded-lg border border-white/[0.04] bg-white/[0.025]">
              {textOverlays.map(item => {
                const left = timeToPx(item.start);
                const width = Math.max(56, timeToPx(item.end) - timeToPx(item.start));
                const active = item.id === selectedTextId;
                return (
                  <div
                    key={item.id}
                    data-timeline-interactive="true"
                    className={`absolute inset-y-1 cursor-grab touch-none rounded-md border px-2 transition active:cursor-grabbing ${
                      active ? "border-orange-300/70 bg-gradient-to-r from-orange-500/45 to-amber-400/25 text-white" : "border-orange-200/15 bg-orange-500/10 text-orange-50/65"
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
                    <span className="relative z-[1] block truncate text-center text-[9px] font-black leading-8">{item.text}</span>
                  </div>
                );
              })}
            </div>

            {audioUrl && (
              <div className="relative mt-2 h-14 rounded-lg bg-white/[0.025]">
                <div
                  data-timeline-interactive="true"
                  className="absolute inset-y-1 cursor-grab touch-none overflow-hidden rounded-md border border-sky-200/75 border-l-[4px] bg-[#09284b] shadow-[0_5px_18px_rgba(0,0,0,0.28)] active:cursor-grabbing"
                  style={{ left: `${audioLeftPx}px`, width: `${audioWidthPx}px` }}
                  onMouseDown={startTimelineDrag("audio", { grabOffset: Math.max(0, elapsedRef.current - audioOffset) })}
                  onTouchStart={startTimelineDrag("audio", { grabOffset: Math.max(0, elapsedRef.current - audioOffset) })}
                  title="Drag audio"
                >
                  <div className="flex h-5 items-center justify-between gap-2 border-b border-sky-100/15 bg-[#13507a] px-1.5 text-[8px] font-semibold text-sky-50/90">
                    <span className="truncate">{audioClipLabel}</span>
                    <span className="shrink-0 text-sky-100/60">{audioDuration.toFixed(1)}s</span>
                  </div>
                  <svg className="absolute bottom-1 left-1 right-1 h-7" style={{ width: "calc(100% - 8px)" }} viewBox="0 0 150 28" preserveAspectRatio="none" aria-hidden="true">
                    {(peaks.length ? peaks : Array.from({ length: 150 }, (_, i) => ((i * 37) % 80) / 80)).map((peak, index) => {
                      const x = index + 0.5;
                      const height = Math.max(2, peak * 24);
                      return <line key={index} x1={x} x2={x} y1={27} y2={27 - height} stroke="#26b9ed" strokeWidth="0.72" opacity="0.92" />;
                    })}
                  </svg>
                </div>
              </div>
            )}

            <div ref={playheadRef} className="pointer-events-none absolute bottom-2 left-0 top-2 z-20 w-px bg-orange-400 shadow-[0_0_0_1px_rgba(0,0,0,0.35)] will-change-transform" />
          </div>
        </div>
      </div>

    </div>
  );
}
