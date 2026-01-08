// src/components/VoiceAndLanguageStep.jsx
import React, { useEffect, useMemo, useState } from "react";

/** compact pill */
const Pill = ({ children }) => (
  <span className="text-xs rounded-full px-2 py-[2px] bg-gray-100 border border-gray-200 text-gray-700">
    {children}
  </span>
);

/** one voice row card */
function VoiceRow({ v, active, onSelect }) {
  return (
    <button
      onClick={() => onSelect(v.id)}
      className={`w-full text-left rounded-xl border p-4 transition grid grid-cols-[36px_1fr_auto] gap-3 items-start ${
        active
          ? "border-[#007BFF] ring-2 ring-[#007BFF]/20 bg-white"
          : "border-gray-200 hover:border-gray-300 bg-white"
      }`}
    >
      <div className="h-9 w-9 shrink-0 grid place-items-center rounded-full bg-[#EEF5FF] text-[#007BFF] font-bold">
        {v.initials}
      </div>

      <div>
        <div className="font-semibold">{v.name}</div>
        <div className="mt-1 text-sm text-gray-600">{v.desc}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {v.tags.map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
        </div>
      </div>

      {/* pretend “play” button */}
      <div className="self-center opacity-70">▶</div>
    </button>
  );
}

export default function VoiceAndLanguageStep({ onComplete }) {
  // voice list (mocked – you can swap with ElevenLabs data)
  const VOICES = useMemo(
    () => [
      {
        id: "william",
        name: "William",
        initials: "W",
        desc:
          "Default Zylo voice for professional & casual narration.",
        tags: ["Male", "Middle-aged", "English"],
      },
      {
        id: "adam",
        name: "Adam",
        initials: "A",
        desc:
          "Most recognizable TikTok-style voice. Great for punchy delivery.",
        tags: ["Male", "Young", "Multilingual"],
      },
      {
        id: "natasha",
        name: "Natasha",
        initials: "N",
        desc:
          "Soft female voice perfect for storytime and wholesome content.",
        tags: ["Female", "Young", "Multilingual"],
      },
      {
        id: "amir",
        name: "Amir",
        initials: "A",
        desc:
          "Energetic, youthful tone — strong for comedy & fast hooks.",
        tags: ["Male", "Young", "Multilingual"],
      },
      {
        id: "spongebob",
        name: "Sponge Bob (Fun)",
        initials: "S",
        desc: "Playful cartoon voice for meme/fun videos.",
        tags: ["Male", "Young", "English"],
      },
      {
        id: "dandan",
        name: "Dan Dan",
        initials: "D",
        desc:
          "Used in 100k+ channel shorts — hyper clear and upbeat.",
        tags: ["Male", "Middle-aged", "Multilingual"],
      },
      {
        id: "amy",
        name: "Amy",
        initials: "A",
        desc:
          "Bright, confident female narrator for ads & promos.",
        tags: ["Female", "Middle-aged", "English"],
      },
    ],
    []
  );

  const [voiceId, setVoiceId] = useState(null);

  // language + sliders
  const [language, setLanguage] = useState("auto");
  const [styleExaggeration, setStyleExaggeration] = useState(25);
  const [stability, setStability] = useState(30);
  const [volume, setVolume] = useState(65);
  const [speed, setSpeed] = useState(45);

  // bubble up validity + payload
  useEffect(() => {
    onComplete?.({
      isValid: Boolean(voiceId),
      voiceId,
      language,
      sliders: {
        styleExaggeration,
        stability,
        volume,
        speed,
      },
    });
  }, [
    voiceId,
    language,
    styleExaggeration,
    stability,
    volume,
    speed,
    onComplete,
  ]);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* LEFT: scrollable voice list */}
      <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3">
          <h3 className="font-semibold">Select a Voice</h3>
          <div className="text-xs text-gray-500">(scrollable)</div>
        </div>

        {/* This is the scroll container (only this section scrolls) */}
        <div
          className="max-h-[520px] overflow-y-auto p-4 space-y-3"
          style={{ overscrollBehavior: "contain" }}
        >
          {VOICES.map((v) => (
            <VoiceRow
              key={v.id}
              v={v}
              active={voiceId === v.id}
              onSelect={setVoiceId}
            />
          ))}
        </div>
      </div>

      {/* RIGHT: language + sliders */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="font-semibold mb-3">Language & Voice Settings</h3>

        <label className="text-sm text-gray-600">Language</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="mt-1 mb-4 w-full h-11 rounded-md border border-gray-300 px-3 bg-white text-black focus:outline-none focus:ring-2 focus:ring-[#007BFF]/30 focus:border-[#007BFF]"
        >
          <option value="auto">Auto Detect Language</option>
          <option>English</option>
          <option>Spanish</option>
          <option>French</option>
          <option>German</option>
          <option>Italian</option>
          <option>Portuguese</option>
          <option>Romanian</option>
          <option>Turkish</option>
          <option>Russian</option>
          <option>Chinese</option>
          <option>Japanese</option>
          <option>Korean</option>
          <option>Dutch</option>
          <option>Hindi</option>
        </select>

        {/* Sliders */}
        <div className="space-y-5">
          <div>
            <div className="flex justify-between text-sm">
              <span>Style Exaggeration</span>
              <span className="text-gray-500">
                {styleExaggeration}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={styleExaggeration}
              onChange={(e) =>
                setStyleExaggeration(Number(e.target.value))
              }
              className="w-full accent-[#007BFF]"
            />
          </div>

          <div>
            <div className="flex justify-between text-sm">
              <span>Voice Stability</span>
              <span className="text-gray-500">{stability}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={stability}
              onChange={(e) => setStability(Number(e.target.value))}
              className="w-full accent-[#007BFF]"
            />
          </div>

          <div>
            <div className="flex justify-between text-sm">
              <span>Voice Volume</span>
              <span className="text-gray-500">{volume}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-[#007BFF]"
            />
          </div>

          <div>
            <div className="flex justify-between text-sm">
              <span>Voice Speed</span>
              <span className="text-gray-500">{speed}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-[#007BFF]"
            />
          </div>
        </div>

        {/* helper */}
        <button
          type="button"
          onClick={() => {
            setStyleExaggeration(25);
            setStability(30);
            setVolume(65);
            setSpeed(45);
          }}
          className="mt-6 w-full h-10 rounded-md bg-gradient-to-r from-[#7CC4FF] to-[#59F] text-white font-semibold"
        >
          Reset To Default
        </button>
      </div>
    </div>
  );
}
