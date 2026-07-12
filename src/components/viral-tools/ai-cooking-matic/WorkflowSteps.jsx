// WorkflowSteps.jsx — Step 2 (Voice) and Step 3 (Captions) panels
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronUp, Loader2, Mic, Music2, Play, RefreshCw, SkipForward, Sparkles, Square, Upload, X, Zap } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { CAPTION_PRESETS, TEXT_SPEEDS } from "./CaptionPreviewPanel";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* ── ElevenLabs default-library voices with traits ────────────────────────── */
/* id = ElevenLabs voice_id — keep in sync with VALID_VOICES in the
   cooking-voice-generate / cooking-voice-preview edge functions. */
const VOICES = [
  // 🔥 Viral picks — best for TikTok/cooking content
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh",   viral: true,  traits: ["Energetic", "Youthful"], desc: "High energy — made for viral content" },
  { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi",   viral: true,  traits: ["Confident", "Bold"],     desc: "Strong, punchy delivery for hooks" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni", viral: true,  traits: ["Warm", "Engaging"],      desc: "Friendly narrator, great for cooking" },
  // Standard voices
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", viral: false, traits: ["Calm", "Clear"],         desc: "Balanced, natural narration" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella",  viral: false, traits: ["Soft", "Gentle"],        desc: "Light and approachable" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam",   viral: false, traits: ["Deep", "Authoritative"], desc: "Bold, commanding presence" },
];

const VOICE_UPDATES = {
  "TxGEqnHWrfWFTfGW9XjX": { desc: "Fast, bright delivery for viral cooking hooks", vibe: "TikTok energy" },
  "AZnzlk1XvdvUeBnXmlld": { desc: "Punchy, confident narration for satisfying recipes", vibe: "Creator favorite" },
  "ErXwobaYiN019PkySvjV": { desc: "Expressive pacing for story-style food videos", vibe: "Story mode" },
  "21m00Tcm4TlvDq8ikWAM": { vibe: "Clean" },
  "EXAVITQu4vr4xnSDxMaL": { vibe: "Soft" },
  "pNInz6obpgDQGcFmaJgB": { vibe: "Deep" },
};

const getVoice = (id) => {
  const voice = VOICES.find(v => v.id === id) ?? VOICES[0];
  return { ...voice, ...(VOICE_UPDATES[voice.id] ?? {}) };
};

const CAPTION_WORDS_PER_SECOND = 3.2;

function buildTimedCaptionScript(text, durationSec = 30) {
  const clean = String(text || "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const safeDuration = Math.max(1, Number(durationSec) || 30);
  const secondsPerWord = words.length > 0
    ? Math.max(0.18, Math.min(0.52, safeDuration / words.length))
    : 1 / CAPTION_WORDS_PER_SECOND;
  const timedWords = words.map((word, i) => ({
    word,
    start: Number((i * secondsPerWord).toFixed(2)),
    end: Number(((i + 1) * secondsPerWord).toFixed(2)),
  }));
  const segments = [];
  for (let i = 0; i < timedWords.length; i += 5) {
    const chunk = timedWords.slice(i, i + 5);
    if (chunk.length) segments.push({ text: chunk.map(w => w.word).join(" "), start: chunk[0].start, end: chunk[chunk.length - 1].end });
  }
  return { script: clean, words: timedWords, segments };
}

function transcriptFromFileName(name) {
  return String(name || "Imported speech")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const voicePreviewCache = new Map();

// Safari/WebKit throws NotSupportedError when an <audio> element plays from a
// blob: URL created via URL.createObjectURL() — a long-standing WebKit bug.
// A base64 data: URI sidesteps it and works everywhere (Chrome, Safari, iOS webviews).
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function generateVoiceAudio({ voiceId, script }) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-voice-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON,
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ voice: voiceId, script }),
  });
  if (!res.ok) throw new Error("Voice generation failed");
  const blob = await res.blob();
  return {
    audioUrl: await blobToDataUrl(blob),
    audioBlob: blob,
    audioBytes: blob.size,
    mimeType: blob.type || "audio/mpeg",
  };
}

async function transcribeSpeechAudio(file, durationSec = 30) {
  const { data: { session } } = await supabase.auth.getSession();
  const form = new FormData();
  form.append("audio", file);
  form.append("durationSec", String(durationSec));
  const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-speech-transcribe`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON,
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: form,
  });
  if (!res.ok) throw new Error("Speech transcription failed");
  return res.json();
}

function fitCaptionCardStyle(style = {}, active = false) {
  const next = { ...style };
  if (typeof next.fontSize === "number") {
    const cap = active ? 16 : 15;
    next.fontSize = Math.max(8, Math.min(cap, Number((next.fontSize * 0.58).toFixed(1))));
  }
  if (next.padding) next.padding = active ? "1px 4px" : "1px 3px";
  next.transform = undefined;
  next.lineHeight = 0.9;
  next.maxWidth = "100%";
  return next;
}

function CaptionStyleButton({ preset, active, onClick }) {
  const words = preset.demo.split(" ");
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-[58px] min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg border transition ${
        active ? "border-orange-400 bg-orange-500/10 ring-1 ring-orange-300/35" : "border-white/[0.06] bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]"
      }`}
      style={{ background: preset.cardBg }}
    >
      <div className="flex w-full max-w-full flex-wrap items-center justify-center gap-x-0.5 gap-y-0 px-1 text-center">
        {words.map((word, index) => (
          <span
            key={`${preset.id}-${word}-${index}`}
            style={fitCaptionCardStyle(index === 0 ? preset.activeStyle : preset.wordStyle, index === 0)}
            className="inline-block max-w-full whitespace-nowrap leading-none"
          >
            {word}
          </span>
        ))}
      </div>
      {active && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-400" />}
    </button>
  );
}

function WorkflowProgress({ current = 2 }) {
  const steps = ["Scenes", "Voice", "Captions"];
  return (
    <div className="shrink-0 border-b border-white/[0.06] px-4 py-3">
      <div className="flex items-center gap-2">
        {steps.map((label, index) => {
          const step = index + 1;
          const done = step < current;
          const active = step === current;
          return (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                done ? "bg-emerald-500 text-white" : active ? "bg-orange-500 text-white" : "bg-white/[0.08] text-white/30"
              }`}>
                {done ? <Check className="h-3.5 w-3.5" /> : step}
              </div>
              <span className={`truncate text-[11px] font-bold ${active ? "text-white" : done ? "text-emerald-300" : "text-white/28"}`}>{label}</span>
              {index < steps.length - 1 && <div className={`hidden h-px flex-1 sm:block ${done ? "bg-emerald-500/50" : "bg-white/[0.08]"}`} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Global preview coordinator ───────────────────────────────────────────────
   Only one voice preview should ever play at once. All VoicePreviewBtn
   instances share this singleton instead of managing their own <audio> —
   starting a new preview stops whatever else is currently playing, and a
   request-sequence counter drops stale responses so a slow first click can't
   steal playback back after a faster later click already won. ───────────── */
let activeAudio = null;
let activePreviewKey = null;
let previewRequestSeq = 0;
const previewListeners = new Set();

function notifyPreviewListeners() {
  previewListeners.forEach((fn) => fn(activePreviewKey));
}

function stopActivePreview() {
  previewRequestSeq++; // invalidate any in-flight request
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.onended = null;
    activeAudio.onerror = null;
  }
  activeAudio = null;
  activePreviewKey = null;
  notifyPreviewListeners();
}

function useActivePreviewKey() {
  const [key, setKey] = useState(activePreviewKey);
  useEffect(() => {
    previewListeners.add(setKey);
    return () => previewListeners.delete(setKey);
  }, []);
  return key;
}

/* ── Mini voice preview ───────────────────────────────────────────────────── */
function VoicePreviewBtn({ voiceId, dish, className = "" }) {
  const key = `${voiceId}:${dish || ""}`;
  const activeKey = useActivePreviewKey();
  const isPlaying = activeKey === key;
  const [loading, setLoading] = useState(false);

  const toggle = async (event) => {
    event?.stopPropagation();
    if (loading) return; // ignore rapid re-clicks on the same button
    if (isPlaying) { stopActivePreview(); return; }

    const mySeq = ++previewRequestSeq;
    setLoading(true);
    try {
      let url = voicePreviewCache.get(key);
      if (!url) {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-voice-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: JSON.stringify({ voice: voiceId, dish }),
        });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        url = await blobToDataUrl(blob);
        voicePreviewCache.set(key, url);
      }
      // A newer click (this voice or another) already won — drop this stale response.
      if (mySeq !== previewRequestSeq) return;

      const audio = new Audio(url);
      audio.onended = () => stopActivePreview();
      audio.onerror = () => stopActivePreview();
      if (activeAudio) { activeAudio.pause(); activeAudio.onended = null; activeAudio.onerror = null; }
      activeAudio = audio;
      activePreviewKey = key;
      notifyPreviewListeners();
      await audio.play();
    } catch {
      if (mySeq === previewRequestSeq) stopActivePreview();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" onClick={toggle}
      className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
        isPlaying ? "bg-orange-500/20 text-orange-200 border border-orange-500/30" : "bg-white/[0.07] text-white/55 hover:text-white hover:bg-white/[0.12]"
      } ${className}`}>
      {loading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : isPlaying ? <Square className="w-2.5 h-2.5 fill-current" /> : <Play className="w-2.5 h-2.5 fill-current" />}
      {loading ? "…" : isPlaying ? "Stop" : "Preview"}
    </button>
  );
}

/* ── Step 2: Voice ────────────────────────────────────────────────────────── */
function VoiceStepLegacy({ dish, onBack, onSkip, onGenerate }) {
  const [selectedVoice, setSelectedVoice] = useState("TxGEqnHWrfWFTfGW9XjX");
  const [script, setScript]               = useState("");
  const [loadingScript, setLoadingScript] = useState(false);
  const [generating, setGenerating]       = useState(false);
  const currentVoice = getVoice(selectedVoice);

  // Auto-generate script when step loads
  useEffect(() => {
    generateScript();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateScript() {
    setLoadingScript(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-script-captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ dish, durationSec: 30 }),
      });
      const data = await res.json();
      if (data.script) setScript(data.script);
    } catch { /* silent */ } finally { setLoadingScript(false); }
  }

  async function handleGenerate() {
    if (!script.trim()) return;
    setGenerating(true);
    try {
      const trimmedScript = script.trim();
      const audio = await generateVoiceAudio({ voiceId: selectedVoice, script: trimmedScript });
      await onGenerate({ voiceId: selectedVoice, voiceLabel: currentVoice.label, script: trimmedScript, ...audio });
    } finally { setGenerating(false); }
  }

  return (
    <div className="flex flex-col h-full bg-[#0D0F11] rounded-2xl border border-white/[0.07] overflow-hidden">

      {/* Back */}
      <div className="hidden">
        <button type="button" onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-white/45 hover:text-white text-[13px] font-semibold transition w-full">
          <span className="text-[16px] leading-none">←</span> Back
        </button>
      </div>

      {/* Header */}
      <div className="shrink-0 px-5 pt-4 pb-2">
        <h2 className="text-white font-black text-[16px]">Voiceover</h2>
        <p className="text-white/35 text-[11px] mt-0.5">AI-written script · choose a voice</p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] px-5 pb-4 space-y-4">

        {/* Script prompt area */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Script</label>
            <button type="button" onClick={generateScript} disabled={loadingScript}
              className="flex items-center gap-1 text-[10px] text-orange-400/70 hover:text-orange-300 transition disabled:opacity-40">
              <RefreshCw className={`w-3 h-3 ${loadingScript ? "animate-spin" : ""}`} />
              Regenerate
            </button>
          </div>
          <div className={`relative rounded-xl border transition ${loadingScript ? "border-white/[0.05]" : "border-white/[0.09] focus-within:border-orange-500/40"} bg-[#0e1012]`}>
            {loadingScript ? (
              <div className="flex items-center gap-2 px-4 py-3 text-white/30 text-[13px]">
                <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                Writing viral script…
              </div>
            ) : (
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                rows={7}
                placeholder="Your voiceover script will appear here…"
                className="w-full bg-transparent px-4 py-3 text-[13px] text-white/85 placeholder:text-white/20 outline-none resize-none leading-relaxed"
              />
            )}
          </div>
          <p className="text-[10px] text-white/20 mt-1 text-right">{script.length} chars</p>
        </div>

        {/* Voice picker */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2 block">Voice</label>

          {/* Viral picks */}
          <p className="text-[9px] font-bold uppercase tracking-widest text-orange-400/60 mb-1.5">🔥 Best for viral cooking</p>
          <div className="space-y-1.5 mb-3">
            {VOICES.filter(v => v.viral).map(v => {
              const active = selectedVoice === v.id;
              return (
                <button key={v.id} type="button" onClick={() => setSelectedVoice(v.id)}
                  className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${active ? "border-orange-500/50 bg-orange-500/[0.08]" : "border-white/[0.08] bg-white/[0.03] hover:border-white/15"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[13px] font-black ${active ? "text-white" : "text-white/70"}`}>{v.label}</span>
                      <div className="flex gap-1 flex-wrap">
                        {v.traits.map(t => (
                          <span key={t} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-orange-500/20 text-orange-300" : "bg-white/[0.07] text-white/35"}`}>{t}</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-white/30">{v.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <VoicePreviewBtn voiceId={v.id} dish={dish} />
                    {active && <span className="w-2 h-2 rounded-full bg-orange-400" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* All other voices */}
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">All voices</p>
          <div className="grid grid-cols-2 gap-1.5">
            {VOICES.filter(v => !v.viral).map(v => {
              const active = selectedVoice === v.id;
              return (
                <button key={v.id} type="button" onClick={() => setSelectedVoice(v.id)}
                  className={`flex flex-col gap-1 rounded-xl border px-3 py-2 text-left transition ${active ? "border-orange-500/40 bg-orange-500/[0.07]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/10"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[12px] font-bold ${active ? "text-white" : "text-white/55"}`}>{v.label}</span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
                  </div>
                  <div className="flex gap-1 flex-wrap mb-0.5">
                    {v.traits.map(t => (
                      <span key={t} className="text-[8px] font-semibold text-white/25">{t}</span>
                    ))}
                  </div>
                  <VoicePreviewBtn voiceId={v.id} dish={dish} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 px-5 pb-5 pt-3 border-t border-white/[0.06] space-y-2">
        <button type="button" onClick={handleGenerate} disabled={generating || loadingScript || !script.trim()}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-[14px] flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-40">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          {generating ? "Generating…" : "Generate Voice"}
        </button>
        <button type="button" onClick={onSkip}
          className="w-full py-2 text-white/30 hover:text-white/55 text-[12px] font-medium transition flex items-center justify-center gap-1.5">
          <SkipForward className="w-3.5 h-3.5" /> Skip voiceover
        </button>
      </div>
      <div className="hidden">
        <button type="button" onClick={() => {}}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-[13px] font-bold text-white/60 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-white">
          <span className="text-[16px] leading-none">←</span> New generation
        </button>
      </div>
    </div>
  );
}

/* ── Step 3: Captions ─────────────────────────────────────────────────────── */
function VoiceAvatar({ voice, active = false }) {
  return (
    <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
      active ? "border-orange-300/45" : "border-white/10"
    } bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.26),rgba(249,115,22,0.24)_38%,rgba(14,16,18,0.95)_72%)]`}>
      <div className="absolute inset-1 rounded-full border border-white/10" />
      <span className="relative text-[13px] font-black text-white">{voice.label.slice(0, 1)}</span>
    </div>
  );
}

function VoicePickerCard({ voice, active, dish, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(voice.id)}
      className={`group w-full rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
        active
          ? "border-orange-400/55 bg-orange-500/[0.10] shadow-[0_18px_45px_rgba(249,115,22,0.14)]"
          : "border-white/[0.08] bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.06]"
      }`}
    >
      <div className="flex items-center gap-3">
        <VoiceAvatar voice={voice} active={active} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-black text-white">{voice.label}</span>
            {voice.viral && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-orange-200">
                <Zap className="h-2.5 w-2.5" /> Viral
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-white/42">{voice.desc}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {voice.traits.map(t => (
              <span key={t} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                active ? "bg-orange-400/15 text-orange-100" : "bg-white/[0.06] text-white/38"
              }`}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <VoicePreviewBtn voiceId={voice.id} dish={dish} className="min-w-[34px] px-2 sm:px-3" />
          <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${
            active ? "border-orange-300/50 bg-orange-400 text-black" : "border-white/10 bg-white/[0.04] text-transparent"
          }`}>
            <Check className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </button>
  );
}

function VoicePickerModal({ dish, selectedVoice, onSelect, onClose }) {
  const viralVoices = VOICES.filter(v => v.viral).map(v => getVoice(v.id));
  const allVoices = VOICES.filter(v => !v.viral).map(v => getVoice(v.id));

  // Stop any preview that's still playing the moment this modal goes away,
  // however it closes (X, backdrop click, selecting a voice, unmount).
  useEffect(() => stopActivePreview, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center md:items-center md:px-4">
      <button type="button" aria-label="Close voice picker" className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(21,23,25,0.98),rgba(12,14,16,0.98))] shadow-[0_-18px_70px_rgba(0,0,0,0.65)] md:max-w-[720px] md:rounded-3xl md:shadow-[0_28px_90px_rgba(0,0,0,0.62)]">
        <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-white/20 md:hidden" />
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-300" />
              <h3 className="text-[17px] font-black text-white">Select voice</h3>
            </div>
            <p className="mt-0.5 text-[12px] text-white/40">ElevenLabs voices tuned for short cooking videos</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/55 transition hover:bg-white/[0.08] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 [scrollbar-width:none]">
          <div className="mb-4">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-300/80">
              <Zap className="h-3 w-3" /> Best for viral cooking
            </p>
            <div className="grid gap-2">
              {viralVoices.map(voice => (
                <VoicePickerCard
                  key={voice.id}
                  voice={voice}
                  active={selectedVoice === voice.id}
                  dish={dish}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>

          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/28">All ElevenLabs voices</p>
          <div className="grid gap-2 md:grid-cols-2">
            {allVoices.map(voice => (
              <VoicePickerCard
                key={voice.id}
                voice={voice}
                active={selectedVoice === voice.id}
                dish={dish}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function VoiceStep({ dish, scenes = [], clips = [], draft = null, onDraftChange, onBack, onSkip, onGenerate }) {
  const [selectedVoice, setSelectedVoice] = useState(draft?.voiceId ?? "TxGEqnHWrfWFTfGW9XjX");
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  const [script, setScript] = useState(draft?.script ?? "");
  const [loadingScript, setLoadingScript] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [importedFile, setImportedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const currentVoice = getVoice(selectedVoice);

  useEffect(() => {
    if (!draft?.script) generateScript();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop any preview audio when leaving this step entirely (Back/Skip/unmount).
  useEffect(() => stopActivePreview, []);

  useEffect(() => {
    onDraftChange?.({ voiceId: selectedVoice, script });
  }, [selectedVoice, script, onDraftChange]);

  async function generateScript() {
    setLoadingScript(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-script-captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ dish, durationSec: 30, scenes, clips }),
      });
      const data = await res.json();
      if (data.script) setScript(data.script);
    } catch { /* silent */ } finally { setLoadingScript(false); }
  }

  async function handleGenerate() {
    if (!script.trim()) return;
    setGenerating(true);
    try {
      const trimmedScript = script.trim();
      const audio = await generateVoiceAudio({ voiceId: selectedVoice, script: trimmedScript });
      await onGenerate({ voiceId: selectedVoice, voiceLabel: currentVoice.label, script: trimmedScript, ...audio });
    } finally { setGenerating(false); }
  }

  const handleSelectVoice = (voiceId) => {
    setSelectedVoice(voiceId);
    setVoicePickerOpen(false);
  };

  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    if (file) setImportedFile(file);
    e.target.value = ""; // allow re-picking the same file
  };

  async function handleUseImported() {
    if (!importedFile) return;
    setImporting(true);
    try {
      const audioUrl = await blobToDataUrl(importedFile);
      await onGenerate({
        voiceId: null,
        voiceLabel: importedFile.name,
        script: script.trim() || "(imported audio)",
        audioUrl,
        audioBlob: importedFile,
        audioBytes: importedFile.size,
        mimeType: importedFile.type || "audio/mpeg",
        imported: true,
      });
    } finally { setImporting(false); }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0D0F11]">
      <WorkflowProgress current={2} />
      <div className="hidden">
        <button type="button" onClick={onBack}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] font-bold text-white/55 transition hover:bg-white/[0.07] hover:text-white">
          <span className="text-[16px] leading-none">â†</span> Back
        </button>
      </div>

      <div className="shrink-0 px-5 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-500/10">
            <Mic className="h-4 w-4 text-orange-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[17px] font-black leading-tight text-white">Voiceover</h2>
            <p className="mt-0.5 text-[11px] text-white/35">Edit the script, then generate speech</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-[230px] [scrollbar-width:none] lg:pb-4">
        <div className="flex min-h-full flex-col">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Script</label>
            <button type="button" onClick={generateScript} disabled={loadingScript}
              className="flex items-center gap-1 text-[10px] text-orange-400/75 transition hover:text-orange-300 disabled:opacity-40">
              <RefreshCw className={`h-3 w-3 ${loadingScript ? "animate-spin" : ""}`} />
              Regenerate
            </button>
          </div>

          <div className={`relative flex-1 min-h-[340px] rounded-2xl border bg-[#0e1012] transition ${
            loadingScript ? "border-white/[0.05]" : "border-white/[0.09] focus-within:border-orange-500/40"
          }`}>
            {loadingScript ? (
              <div className="flex items-center gap-2 px-4 py-3 text-[13px] text-white/30">
                <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                Writing viral script…
              </div>
            ) : (
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                rows={14}
                placeholder="Your voiceover script will appear here…"
                className="h-full min-h-[340px] w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed text-white/90 outline-none placeholder:text-white/20 md:text-[13px]"
              />
            )}
          </div>
          <p className="mt-1 text-right text-[10px] text-white/20">{script.length} chars</p>

          {/* Import your own audio */}
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-white/55">Or use your own audio</p>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-orange-300 transition hover:bg-white/[0.10]">
                <Upload className="h-3 w-3" /> Import
              </button>
              <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFilePicked} />
            </div>
            {importedFile && (
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-white/[0.04] px-2.5 py-2">
                <Music2 className="h-3.5 w-3.5 shrink-0 text-orange-300" />
                <span className="flex-1 truncate text-[11px] text-white/70">{importedFile.name}</span>
                <button type="button" onClick={handleUseImported} disabled={importing}
                  className="shrink-0 rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-orange-400 disabled:opacity-50">
                  {importing ? "…" : "Use this"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-3 bottom-[72px] z-40 space-y-2.5 rounded-2xl border border-white/[0.08] bg-[#101213]/96 px-4 pb-3 pt-3 shadow-[0_-18px_55px_rgba(0,0,0,0.50)] backdrop-blur-xl lg:static lg:inset-auto lg:z-auto lg:shrink-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-[#101213]/95 lg:px-5 lg:pb-[calc(16px+env(safe-area-inset-bottom))] lg:shadow-none">
        <button type="button" onClick={() => setVoicePickerOpen(true)}
          className="group w-full rounded-2xl border border-white/[0.10] bg-white/[0.05] px-3 py-2.5 text-left transition hover:border-orange-400/35 hover:bg-white/[0.08]">
          <div className="flex items-center gap-3">
            <VoiceAvatar voice={currentVoice} active />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-black text-white">{currentVoice.label}</span>
                {currentVoice.viral && (
                  <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-orange-200">Viral</span>
                )}
              </div>
              <p className="truncate text-[11px] font-medium text-white/42">{currentVoice.vibe} - {currentVoice.traits.join(" / ")}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <VoicePreviewBtn voiceId={selectedVoice} dish={dish} className="hidden sm:flex" />
              <ChevronUp className="h-4 w-4 text-white/35 transition group-hover:text-white/70" />
            </div>
          </div>
        </button>

        <button type="button" onClick={handleGenerate} disabled={generating || loadingScript || !script.trim()}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 py-3 text-[14px] font-black text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          {generating ? "Generating…" : "Generate Voice"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onBack}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] font-bold text-white/50 transition hover:bg-white/[0.07] hover:text-white">
            Back
          </button>
          <button type="button" onClick={onSkip}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] font-bold text-white/50 transition hover:bg-white/[0.07] hover:text-white">
            <SkipForward className="h-3.5 w-3.5" /> Skip
          </button>
        </div>
      </div>

      {voicePickerOpen && createPortal(
        <VoicePickerModal
          dish={dish}
          selectedVoice={selectedVoice}
          onSelect={handleSelectVoice}
          onClose={() => setVoicePickerOpen(false)}
        />,
        document.body
      )}
    </div>
  );
}

export function CaptionStep({ dish, scenes = [], clips = [], clipPrompts = [], voiceData = null, draft = null, onDraftChange, onVoiceDataChange, onBack, onSkip, onApply }) {
  const durationSec = Math.max(1, clips.filter(c => c.videoUrl).length * 6 || 30);
  const initialScript = draft?.captionScript?.script ?? voiceData?.script ?? "";
  const speechFileInputRef = useRef(null);
  const speechAudioRef = useRef(null);
  const [captionStyle, setCaptionStyle] = useState(draft?.captionStyle ?? "viral-yellow");
  const [textSpeed, setTextSpeed]       = useState(draft?.textSpeed ?? "fast");
  const [script, setScript]             = useState(initialScript);
  const [scriptData, setScriptData]     = useState(() => draft?.captionScript ?? (initialScript ? buildTimedCaptionScript(initialScript, durationSec) : null));
  const [loading, setLoading]           = useState(false);
  const [generating, setGenerating]     = useState(false);
  const [importingSpeech, setImportingSpeech] = useState(false);
  const [speechImportNote, setSpeechImportNote] = useState("");
  const [speechPlaying, setSpeechPlaying] = useState(false);

  // Keep parent in sync for realtime right-panel preview
  useEffect(() => {
    onDraftChange?.({ ...(draft ?? {}), captionStyle, textSpeed, captionScript: scriptData });
  }, [captionStyle, textSpeed, scriptData, onDraftChange]);

  useEffect(() => {
    if (draft?.captionScript?.script || script || !voiceData?.script) return;
    const next = buildTimedCaptionScript(voiceData.script, durationSec);
    setScript(voiceData.script);
    setScriptData(next);
  }, [draft?.captionScript?.script, durationSec, script, voiceData?.script]);

  useEffect(() => {
    return () => {
      if (speechAudioRef.current) {
        speechAudioRef.current.pause();
        speechAudioRef.current = null;
      }
    };
  }, []);

  async function generateScript() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-script-captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ dish, durationSec: 30, scenes, clips, clipPrompts }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.script) {
        setScript(data.script);
        setScriptData({
          ...data,
          words: Array.isArray(data.words) && data.words.length ? data.words : buildTimedCaptionScript(data.script, durationSec).words,
          segments: Array.isArray(data.segments) && data.segments.length ? data.segments : buildTimedCaptionScript(data.script, durationSec).segments,
        });
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }

  function handleScriptChange(value) {
    setScript(value);
    setScriptData(buildTimedCaptionScript(value, durationSec));
  }

  async function toggleSpeechAudio() {
    if (!voiceData?.audioUrl) return;
    if (speechAudioRef.current && speechPlaying) {
      speechAudioRef.current.pause();
      setSpeechPlaying(false);
      return;
    }
    if (!speechAudioRef.current || speechAudioRef.current.src !== voiceData.audioUrl) {
      if (speechAudioRef.current) speechAudioRef.current.pause();
      const audio = new Audio(voiceData.audioUrl);
      speechAudioRef.current = audio;
      audio.onended = () => setSpeechPlaying(false);
      audio.onerror = () => setSpeechPlaying(false);
    }
    setSpeechPlaying(true);
    try { await speechAudioRef.current.play(); } catch { setSpeechPlaying(false); }
  }

  async function handleSpeechFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportingSpeech(true);
    setSpeechImportNote("");
    try {
      const audioUrl = await blobToDataUrl(file);
      let transcript = "";
      let timed = null;
      try {
        const data = await transcribeSpeechAudio(file, durationSec);
        transcript = String(data.script || data.text || "").trim();
        timed = transcript ? {
          script: transcript,
          words: Array.isArray(data.words) && data.words.length ? data.words : buildTimedCaptionScript(transcript, durationSec).words,
          segments: Array.isArray(data.segments) && data.segments.length ? data.segments : buildTimedCaptionScript(transcript, durationSec).segments,
        } : null;
      } catch {
        transcript = script.trim() || transcriptFromFileName(file.name);
        timed = buildTimedCaptionScript(transcript, durationSec);
        setSpeechImportNote("Speech imported. Edit the transcript if needed.");
      }

      setScript(transcript);
      setScriptData(timed);
      onVoiceDataChange?.({
        voiceId: null,
        voiceLabel: file.name,
        script: transcript,
        audioUrl,
        audioBlob: file,
        audioBytes: file.size,
        mimeType: file.type || "audio/mpeg",
        imported: true,
      });
    } finally {
      setImportingSpeech(false);
    }
  }

  async function handleGenerate() {
    if (!script.trim() && !loading) { generateScript(); return; }
    // If script exists, generate the voice using it (just close with current data)
    setGenerating(true);
    try { await onApply({ ...(draft ?? {}), captionStyle, textSpeed, captionScript: scriptData ?? buildTimedCaptionScript(script, durationSec) }); }
    finally { setGenerating(false); }
  }

  // Auto-generate on first open if no draft
  useEffect(() => {
    if (!draft?.captionScript?.script && !voiceData?.script) generateScript();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0D0F11]">
      <WorkflowProgress current={3} />

      <div className="flex-1 overflow-y-auto px-5 pb-[220px] [scrollbar-width:none] lg:pb-4">
        <div className="pt-4 space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Music2 className="h-4 w-4 shrink-0 text-sky-300" />
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/35">Generated speech</p>
                  <p className="truncate text-[12px] font-bold text-white/72">
                    {voiceData?.audioUrl ? (voiceData.voiceLabel || voiceData.voiceId || "Voiceover ready") : "No speech selected"}
                  </p>
                </div>
              </div>
              {voiceData?.audioUrl && (
                <button type="button" onClick={toggleSpeechAudio}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black transition active:scale-95">
                  {speechPlaying ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onBack}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-bold text-white/55 transition hover:bg-white/[0.08] hover:text-white">
                Change voice
              </button>
              <button type="button" onClick={() => speechFileInputRef.current?.click()} disabled={importingSpeech}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-[11px] font-black text-white transition hover:bg-orange-400 disabled:opacity-50">
                {importingSpeech ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Upload speech
              </button>
              <input ref={speechFileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleSpeechFilePicked} />
            </div>
            {speechImportNote && <p className="mt-2 text-[10px] font-semibold text-orange-200/60">{speechImportNote}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30">
                <Sparkles className="h-3 w-3 text-orange-300" /> Text style
              </p>
              <div className="flex rounded-lg bg-white/[0.04] p-0.5">
                {TEXT_SPEEDS.map(speed => (
                  <button
                    key={speed.id}
                    type="button"
                    onClick={() => setTextSpeed(speed.id)}
                    className={`rounded-md px-2 py-1 text-[10px] font-black transition ${
                      textSpeed === speed.id ? "bg-white text-black" : "text-white/38 hover:text-white"
                    }`}
                    title={speed.desc}
                  >
                    {speed.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {CAPTION_PRESETS.map(preset => (
                <CaptionStyleButton
                  key={preset.id}
                  preset={preset}
                  active={captionStyle === preset.id}
                  onClick={() => setCaptionStyle(preset.id)}
                />
              ))}
            </div>
          </div>

          {/* Script */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Transcript captions</label>
              <button type="button" onClick={generateScript} disabled={loading}
                className="flex items-center gap-1 text-[10px] text-orange-400/75 transition hover:text-orange-300 disabled:opacity-40">
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                {script ? "Regenerate" : "Generate"}
              </button>
            </div>

            <div className={`relative rounded-2xl border bg-[#0e1012] transition ${loading ? "border-white/[0.05]" : "border-white/[0.09] focus-within:border-orange-500/40"}`}>
              {loading ? (
                <div className="flex items-center gap-2 px-4 py-3 text-[13px] text-white/30">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                  Writing script…
                </div>
              ) : (
                <textarea
                  value={script}
                  onChange={e => handleScriptChange(e.target.value)}
                  rows={10}
                  placeholder="Your voiceover script will appear here…"
                  className="w-full resize-none bg-transparent px-4 py-3 text-[13px] leading-relaxed text-white/85 outline-none placeholder:text-white/20"
                />
              )}
            </div>
            <p className="mt-1 text-right text-[10px] text-white/20">{script.length} chars</p>
          </div>

          {/* Style hint */}
          {false && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
            <p className="text-[11px] text-white/40">
              <span className="font-semibold text-white/60">Caption style</span> — choose from the preview panel on the right. Drag the orange handle to reposition captions on screen.
            </p>
          </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed inset-x-3 bottom-[72px] z-40 space-y-2 rounded-2xl border border-white/[0.08] bg-[#101213]/96 px-4 pb-3 pt-3 shadow-[0_-18px_55px_rgba(0,0,0,0.50)] backdrop-blur-xl lg:static lg:inset-auto lg:z-auto lg:shrink-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-[#101213]/95 lg:px-5 lg:pb-[calc(16px+env(safe-area-inset-bottom))] lg:shadow-none">
        <button type="button" onClick={handleGenerate} disabled={generating || loading || !script.trim()}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 py-3 text-[14px] font-black text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-sm font-black">CC</span>}
          {generating ? "Applying…" : "Apply Captions"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onBack}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] font-bold text-white/50 transition hover:bg-white/[0.07] hover:text-white">
            Back
          </button>
          <button type="button" onClick={onSkip}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] font-bold text-white/50 transition hover:bg-white/[0.07] hover:text-white">
            <SkipForward className="h-3.5 w-3.5" /> Skip
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Final step ───────────────────────────────────────────────────────────── */
export function FinalStep({ clips, dishLabel, onRestart }) {
  const readyClips = clips.filter(c => c.videoUrl);

  return (
    <div className="flex flex-col h-full bg-[#0D0F11] rounded-2xl border border-white/[0.07] overflow-hidden">
      <div className="hidden">
        <button type="button" onClick={onRestart}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/15 text-white/50 hover:text-white text-[13px] font-semibold transition w-full">
          <span className="text-[16px] leading-none">←</span> New generation
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 pb-[130px] text-center lg:pb-0">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-2xl">✓</div>
        <div>
          <h2 className="text-white font-black text-[18px]">{dishLabel || "Done"}</h2>
          <p className="text-white/40 text-[13px] mt-1">{readyClips.length} clips ready</p>
        </div>
      </div>
      <div className="fixed inset-x-3 bottom-[72px] z-40 rounded-2xl border border-white/[0.08] bg-[#101213]/96 px-4 pb-3 pt-3 shadow-[0_-18px_55px_rgba(0,0,0,0.50)] backdrop-blur-xl lg:static lg:inset-auto lg:z-auto lg:shrink-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-transparent lg:px-5 lg:pb-5 lg:shadow-none">
        <button type="button" onClick={onRestart}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-[13px] font-bold text-white/60 transition hover:border-white/15 hover:bg-white/[0.07] hover:text-white">
          <span className="text-[16px] leading-none">←</span> New generation
        </button>
      </div>
    </div>
  );
}
