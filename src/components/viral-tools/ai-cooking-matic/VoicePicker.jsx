import { useState, useRef, useCallback } from "react";
import { Play, Square, Loader2 } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const VOICES = [
  { id: "alloy",   label: "Alloy",   desc: "Neutral & balanced",    emoji: "⚡" },
  { id: "echo",    label: "Echo",    desc: "Clear & precise",       emoji: "🎙️" },
  { id: "fable",   label: "Fable",   desc: "Warm & storytelling",   emoji: "📖" },
  { id: "onyx",    label: "Onyx",    desc: "Deep & authoritative",  emoji: "🖤" },
  { id: "nova",    label: "Nova",    desc: "Bright & energetic",    emoji: "✨" },
  { id: "shimmer", label: "Shimmer", desc: "Soft & friendly",       emoji: "🌟" },
];

export default function VoicePicker({ selectedVoice, onSelect, dish = "crispy chicken" }) {
  const [loadingVoice, setLoadingVoice]   = useState(null);
  const [playingVoice, setPlayingVoice]   = useState(null);
  const audioRef = useRef(null);

  const stopCurrent = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPlayingVoice(null);
  }, []);

  const handlePreview = useCallback(async (voiceId) => {
    // Stop any playing audio
    stopCurrent();

    // If already playing this voice, just stop
    if (playingVoice === voiceId) return;

    setLoadingVoice(voiceId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/cooking-voice-preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey":        SUPABASE_ANON,
          ...(session ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ voice: voiceId, dish }),
      });

      if (!res.ok) throw new Error("Preview failed");

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingVoice(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPlayingVoice(null);
        URL.revokeObjectURL(url);
      };

      setLoadingVoice(null);
      setPlayingVoice(voiceId);
      audio.play();
    } catch (e) {
      console.error("[voice-preview]", e);
      setLoadingVoice(null);
    }
  }, [playingVoice, dish, stopCurrent]);

  return (
    <div className="grid grid-cols-2 gap-2">
      {VOICES.map((v) => {
        const isSelected = selectedVoice === v.id;
        const isLoading  = loadingVoice === v.id;
        const isPlaying  = playingVoice === v.id;

        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className={`relative flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
              isSelected
                ? "border-orange-500/50 bg-orange-500/[0.08]"
                : "border-white/[0.07] bg-white/[0.03] hover:border-white/15"
            }`}
          >
            {/* Name + emoji */}
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] leading-none">{v.emoji}</span>
              <span className={`text-[13px] font-bold leading-none ${isSelected ? "text-white" : "text-white/65"}`}>
                {v.label}
              </span>
              {isSelected && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
              )}
            </div>

            {/* Desc */}
            <p className="text-[10px] text-white/30 leading-none">{v.desc}</p>

            {/* Preview button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handlePreview(v.id); }}
              className={`mt-1 self-start flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition ${
                isPlaying
                  ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                  : "bg-white/[0.06] text-white/40 hover:text-white/70 hover:bg-white/[0.10]"
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : isPlaying ? (
                <Square className="w-2.5 h-2.5 fill-current" />
              ) : (
                <Play className="w-2.5 h-2.5 fill-current" />
              )}
              {isLoading ? "Loading…" : isPlaying ? "Stop" : "Preview"}
            </button>
          </button>
        );
      })}
    </div>
  );
}
