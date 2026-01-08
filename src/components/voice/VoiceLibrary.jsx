import React, { useState, useRef } from "react";
import {
  Volume2,
  User,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ---- Configure bases for your assets ----
// You can either use Supabase or local `/assets/flags/...`
const SUPABASE_VOICE_BASE =
  "https://YOUR_SUPABASE_URL/storage/v1/object/public/assets/voices";
const FLAG_BASE = "/flags"; // e.g. /public/flags/en.png etc.

/*
  VOICE_PRESETS
  - flags: up to 2 main flags shown on the card (you can add more, we slice(0,2))
  - languages: full list shown in the dark scrollable popup
*/
export const VOICE_PRESETS = [
  {
    id: "zy-amelia",
    name: "Amelia",
    tagline: "Warm, friendly narrator",
    gender: "Female",
    age: "20s",
    elevenId: "ELEVENLABS_VOICE_ID_AMELIA",
    sampleUrl: `${SUPABASE_VOICE_BASE}/amelia-preview.mp3`,
    flags: [
      { code: "en", label: "English", src: `${FLAG_BASE}/en.png` },
      { code: "es", label: "Spanish", src: `${FLAG_BASE}/es.png` },
    ],
    languages: [
      "English",
      "Spanish",
      "Italian",
      "Turkish",
      "Hindi",
      "Indonesian",
      "Slovak",
      "Romanian",
      "Croatian",
      "Portuguese",
      "Swedish",
      "Polish",
      "Tamil",
      "Japanese",
    ],
  },
  {
    id: "zy-liam",
    name: "Liam",
    tagline: "Confident, promo-ready",
    gender: "Male",
    age: "30s",
    elevenId: "ELEVENLABS_VOICE_ID_LIAM",
    sampleUrl: `${SUPABASE_VOICE_BASE}/liam-preview.mp3`,
    flags: [
      { code: "gb", label: "English (UK)", src: `${FLAG_BASE}/gb.png` },
      { code: "us", label: "English (US)", src: `${FLAG_BASE}/us.png` },
    ],
    languages: [
      "English (UK)",
      "English (US)",
      "Irish",
      "Welsh",
      "Spanish",
      "German",
      "French",
      "Portuguese",
      "Dutch",
      "Norwegian",
      "Danish",
      "Swedish",
    ],
  },
  {
    id: "zy-nova",
    name: "Nova",
    tagline: "Energetic, TikTok-style",
    gender: "Female",
    age: "Teens",
    elevenId: "ELEVENLABS_VOICE_ID_NOVA",
    sampleUrl: `${SUPABASE_VOICE_BASE}/nova-preview.mp3`,
    flags: [
      { code: "fi", label: "Finnish", src: `${FLAG_BASE}/fi.png` },
      { code: "se", label: "Swedish", src: `${FLAG_BASE}/se.png` },
    ],
    languages: [
      "Finnish",
      "English",
      "Swedish",
      "Norwegian",
      "Danish",
      "Estonian",
      "German",
      "Spanish",
    ],
  },
];

// helper: chunk into rows of up to 10 voices
const ROW_SIZE = 10;
function chunkVoices(list) {
  const rows = [];
  for (let i = 0; i < list.length; i += ROW_SIZE) {
    rows.push(list.slice(i, i + ROW_SIZE));
  }
  return rows;
}

export default function VoiceLibrary({ initialVoiceId, onBack, onUse }) {
  const [activeId, setActiveId] = useState(
    initialVoiceId || VOICE_PRESETS[0]?.id,
  );
  const [playingId, setPlayingId] = useState(null);
  const [progress, setProgress] = useState({});
  const [openLangForId, setOpenLangForId] = useState(null);

  const audioRefs = useRef({});
  const rowRefs = useRef([]); // horizontal scroll containers

  const rows = chunkVoices(VOICE_PRESETS);
  const activeVoice =
    VOICE_PRESETS.find((v) => v.id === activeId) || VOICE_PRESETS[0];

  const handlePreview = (voiceId) => {
    const audio = audioRefs.current[voiceId];
    if (!audio) return;

    // pause others
    Object.entries(audioRefs.current).forEach(([id, el]) => {
      if (id !== voiceId && !el.paused) {
        try {
          el.pause();
          el.currentTime = 0;
        } catch {}
      }
    });

    if (playingId === voiceId && !audio.paused) {
      audio.pause();
      setPlayingId(null);
      setProgress((prev) => ({ ...prev, [voiceId]: 0 }));
      return;
    }

    audio.currentTime = 0;
    audio
      .play()
      .then(() => setPlayingId(voiceId))
      .catch(() => setPlayingId(null));

    audio.onended = () => {
      setPlayingId(null);
      setProgress((prev) => ({ ...prev, [voiceId]: 0 }));
    };
  };

  const handleTimeUpdate = (voiceId, e) => {
    const { currentTime, duration } = e.target;
    if (!duration) return;
    setProgress((prev) => ({
      ...prev,
      [voiceId]: currentTime / duration,
    }));
  };

  const toggleLanguages = (voiceId) => {
    setOpenLangForId((cur) => (cur === voiceId ? null : voiceId));
  };

  const scrollRow = (rowIndex, direction) => {
    const el = rowRefs.current[rowIndex];
    if (!el) return;
    const delta = direction === "left" ? -260 : 260; // tweak for speed
    el.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="zy-card p-4 md:p-6 zy-fadeup">
      {/* header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="zy-section-title text-sm uppercase tracking-[0.16em] mb-1">
            Voice library
          </div>
          <h2 className="zy-h1 text-[20px] leading-tight">
            Choose a{" "}
            <span className="zy-gradient-text">voice that fits</span> your
            language.
          </h2>
          <p className="zy-sub mt-1">
            See supported languages for each voice. Flag icons are real image
            assets so your users instantly trust the quality.
          </p>
        </div>
        <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[11px] text-[#6b7280] font-semibold">
          <Sparkles className="h-3 w-3 text-[#7a3bff]" />
          ElevenLabs powered
        </span>
      </div>

      {/* rows */}
      <div className="zy-rows space-y-4">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="relative">
            {/* arrows */}
            {row.length > 3 && (
              <>
                <button
                  type="button"
                  onClick={() => scrollRow(rowIndex, "left")}
                  className="zy-scroll-arrow left-[-6px] hidden md:grid"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollRow(rowIndex, "right")}
                  className="zy-scroll-arrow right-[-6px] hidden md:grid"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {/* horizontal scroll container */}
            <div
              ref={(el) => {
                rowRefs.current[rowIndex] = el;
              }}
              className="flex gap-3 overflow-x-auto pb-1"
            >
              {row.map((voice) => {
                const isActive = activeId === voice.id;
                const isPlaying = playingId === voice.id;
                const p = Math.min(1, progress[voice.id] ?? 0);

                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => setActiveId(voice.id)}
                    className={`relative text-left p-3.5 rounded-2xl border transition-all flex flex-col gap-2 min-w-[230px] ${
                      isActive
                        ? "border-[#7a3bff] bg-[#f5f2ff]"
                        : "border-[#e5e7eb] bg-white hover:bg-[#fafbff]"
                    }`}
                  >
                    {/* top row: avatar + name + flags */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-[#f5f3ff] flex items-center justify-center">
                          <User className="h-4 w-4 text-[#7a3bff]" />
                        </div>
                        <div>
                          <div className="font-semibold text-[14px] text-[#0b1220]">
                            {voice.name}
                          </div>
                          <div className="text-[12px] text-[#6b7280]">
                            {voice.tagline}
                          </div>
                        </div>
                      </div>

                      {/* main flags */}
                      {voice.flags && voice.flags.length > 0 && (
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex gap-1">
                            {voice.flags.slice(0, 2).map((f) => (
                              <div
                                key={f.code}
                                className="h-6 w-6 rounded-full border border-[#e5e7eb] bg-white flex items-center justify-center overflow-hidden"
                              >
                                <img
                                  src={f.src}
                                  alt={f.label}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ))}
                          </div>

                          {/* opens scrollable language list */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLanguages(voice.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-0.5 text-[10px] font-semibold text-[#4b5563] hover:bg-[#f3f4ff]"
                          >
                            <span>Languages</span>
                            <ChevronDown className="h-3 w-3" />
                          </button>

                          {openLangForId === voice.id && (
                            <div
                              className="absolute right-2 top-[52px] min-w-[140px] rounded-xl bg-[#111827] text-white text-[11px] py-2 shadow-lg z-20 max-h-40 overflow-y-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {voice.languages.map((lang) => (
                                <div
                                  key={lang}
                                  className="px-3 py-1 hover:bg-white/10"
                                >
                                  {lang}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* preview line */}
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <div className="flex-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(voice.id);
                          }}
                          className="h-7 w-7 rounded-full border border-[#e5e7eb] flex items-center justify-center bg-[#f9fafb] hover:bg-[#f3f4ff]"
                        >
                          <Volume2 className="h-3.5 w-3.5 text-[#7a3bff]" />
                        </button>
                        <div className="flex-1 h-1.5 rounded-full bg-[#e5e7eb] overflow-hidden">
                          <div
                            className="h-full bg-[#7a3bff] transition-[width] duration-100"
                            style={{ width: `${p * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[11px] text-[#9ca3af] whitespace-nowrap">
                        {isPlaying ? "Preview playing…" : "Tap to preview"}
                      </span>
                    </div>

                    {/* audio element */}
                    <audio
                      ref={(el) => {
                        if (el) audioRefs.current[voice.id] = el;
                      }}
                      src={voice.sampleUrl}
                      onTimeUpdate={(e) => handleTimeUpdate(voice.id, e)}
                      className="hidden"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* footer actions */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="zy-btn-soft w-full sm:w-auto"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!activeVoice}
          onClick={() => onUse && onUse(activeVoice)}
          className="inline-flex items-center justify-center w-full sm:w-auto rounded-2xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg bg-[length:200%_100%] hover:opacity-95 active:scale-[.99] disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            backgroundImage:
              "linear-gradient(90deg,#7A3BFF,#5B5CE2,#FF57B2)",
          }}
        >
          Use this voice
        </button>
      </div>
    </div>
  );
}
