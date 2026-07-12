import { useState, useEffect, useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ── Caption styles ─────────────────────────────────────────────────────────────
export const CAPTION_STYLES = [
  {
    id: "tiktok",
    label: "TikTok Bold",
    desc: "Word-by-word, yellow highlight",
    preview: { bg: "rgba(0,0,0,0.0)", textClass: "font-black text-white text-[22px] tracking-tight uppercase", highlightClass: "text-[#FFD60A]", position: "bottom-center", outline: true },
  },
  {
    id: "subtitle",
    label: "Subtitle",
    desc: "Line at bottom, dark background",
    preview: { bg: "rgba(0,0,0,0.70)", textClass: "font-semibold text-white text-[15px] tracking-wide", highlightClass: "text-yellow-300", position: "bottom-bar", outline: false },
  },
  {
    id: "word-pop",
    label: "Word Pop",
    desc: "One word at a time, large",
    preview: { bg: "rgba(0,0,0,0.0)", textClass: "font-black text-white text-[36px] tracking-tighter uppercase drop-shadow-2xl", highlightClass: "text-orange-400", position: "center", outline: true },
  },
  {
    id: "karaoke",
    label: "Karaoke",
    desc: "Full line, word turns orange",
    preview: { bg: "rgba(0,0,0,0.55)", textClass: "font-bold text-white/60 text-[18px] tracking-wide", highlightClass: "text-orange-400 font-black text-white", position: "bottom-bar", outline: false },
  },
  {
    id: "minimal",
    label: "Minimal",
    desc: "Clean, centered, no background",
    preview: { bg: "rgba(0,0,0,0.0)", textClass: "font-medium text-white text-[16px] tracking-wide", highlightClass: "text-white font-bold", position: "center", outline: false },
  },
];

// ── Animated caption preview ───────────────────────────────────────────────────
const DEMO_SEGMENTS = [
  ["You", "NEED", "to", "try", "this"],
  ["Crispy", "golden", "perfection", "right", "here"],
  ["Toss", "it", "in", "the", "oil"],
  ["Save", "this", "for", "later", "🔥"],
];

function CaptionPreview({ style }) {
  const [segIdx, setSegIdx]   = useState(0);
  const [wordIdx, setWordIdx] = useState(0);

  // Word ticker
  useEffect(() => {
    const words = DEMO_SEGMENTS[segIdx];
    if (wordIdx >= words.length) {
      const t = setTimeout(() => {
        setSegIdx((i) => (i + 1) % DEMO_SEGMENTS.length);
        setWordIdx(0);
      }, 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setWordIdx((i) => i + 1), 380);
    return () => clearTimeout(t);
  }, [segIdx, wordIdx]);

  const words   = DEMO_SEGMENTS[segIdx];
  const isWordPop = style.id === "word-pop";
  const isKaraoke = style.id === "karaoke";

  const posClass = {
    "bottom-center": "bottom-6 left-0 right-0 flex justify-center",
    "bottom-bar":    "bottom-0 left-0 right-0 px-3 py-2.5",
    "center":        "inset-0 flex items-center justify-center",
  }[style.preview.position] ?? "bottom-6 left-0 right-0 flex justify-center";

  const outline = style.preview.outline
    ? { textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 8px rgba(0,0,0,0.8)" }
    : {};

  return (
    <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-gradient-to-br from-[#1a0a05] via-[#2d1500] to-[#0d0800] flex items-center justify-center">
      {/* Fake food image backdrop */}
      <div className="absolute inset-0 opacity-40 bg-gradient-to-br from-orange-900/40 via-red-900/20 to-black" />
      <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-20 select-none pointer-events-none">
        🍗
      </div>

      {/* Caption overlay */}
      <div className={`absolute ${posClass}`} style={{ background: style.preview.bg }}>
        {isWordPop ? (
          // Single word, huge
          <span
            key={`${segIdx}-${wordIdx}`}
            className={`${style.preview.textClass} animate-[wordPop_0.2s_ease-out]`}
            style={outline}
          >
            {words[wordIdx - 1] ?? ""}
          </span>
        ) : isKaraoke ? (
          // Full line with current word highlighted
          <p className="text-center leading-snug px-2">
            {words.map((w, i) => (
              <span
                key={i}
                className={i < wordIdx ? style.preview.highlightClass : style.preview.textClass}
                style={outline}
              >
                {w}{" "}
              </span>
            ))}
          </p>
        ) : style.id === "tiktok" ? (
          // Word-by-word bold pop
          <p className="text-center leading-snug px-4">
            {words.map((w, i) => (
              <span
                key={i}
                className={i < wordIdx ? style.preview.highlightClass + " " + style.preview.textClass : "text-white font-black text-[22px] tracking-tight uppercase"}
                style={outline}
              >
                {w}{" "}
              </span>
            ))}
          </p>
        ) : (
          // Subtitle / Minimal — show full segment
          <p className={`text-center ${style.preview.textClass} leading-snug px-3`} style={outline}>
            {words.join(" ")}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CaptionPicker({ dish, selectedStyle, onSelectStyle, onScriptGenerated }) {
  const [script, setScript]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [generated, setGenerated] = useState(false);
  const [previewStyle, setPreviewStyle] = useState(selectedStyle ?? "tiktok");
  const activeStyle = CAPTION_STYLES.find(s => s.id === previewStyle) ?? CAPTION_STYLES[0];

  const generateScript = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-script-captions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON,
          ...(session ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ dish, durationSec: 30 }),
      });
      if (!res.ok) throw new Error("Script generation failed");
      const data = await res.json();
      setScript(data.script ?? "");
      setGenerated(true);
      onScriptGenerated?.(data);
    } catch (e) {
      console.error("[caption-picker]", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Style selector */}
      <div className="grid grid-cols-1 gap-1.5">
        {CAPTION_STYLES.map((s) => {
          const active = previewStyle === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => { setPreviewStyle(s.id); onSelectStyle?.(s.id); }}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-all ${
                active
                  ? "border-orange-500/50 bg-orange-500/[0.08]"
                  : "border-white/[0.07] bg-white/[0.03] hover:border-white/15"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-bold leading-none ${active ? "text-white" : "text-white/60"}`}>{s.label}</p>
                <p className="text-[11px] text-white/25 mt-0.5">{s.desc}</p>
              </div>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Live preview */}
      <div className="w-[120px] mx-auto">
        <CaptionPreview style={activeStyle} />
      </div>

      {/* Script generation */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Script</p>
          <button
            type="button"
            onClick={generateScript}
            disabled={loading}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-orange-400/80 hover:text-orange-300 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {generated ? "Regenerate" : "Generate"}
          </button>
        </div>
        {script ? (
          <p className="text-[11px] text-white/50 leading-relaxed">{script}</p>
        ) : (
          <p className="text-[11px] text-white/20 italic">
            {loading ? "Writing script…" : "Click Generate to create the voiceover script for your video"}
          </p>
        )}
      </div>
    </div>
  );
}
