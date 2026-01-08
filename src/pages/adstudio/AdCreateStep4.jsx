// src/pages/ads/AdCreateStep4.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  Headphones,
  Pause,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import "../../styles/adstudio.css";
import { supabase } from "../../lib/supabaseClient";

const STEP4_KEY = "ad.create.step4";
const AVATAR_KEY = "ad.create.avatar";

const MAX_TOTAL = 8;
const MIN_SCENE = 2;
const MAX_SCENE = 4;

// public-assets base for audio previews
const PUBLIC_BASE = `${supabase.storageUrl}/object/public/public-assets`;

// ------------------------------
// BG Voices (with placeholder voice_ids)
// ------------------------------
const BG_VOICES = [
  {
    id: "nova",
    label: "Nova — warm female",
    demo: `${PUBLIC_BASE}/voices/amelia.mp3`,
    voice_id: "21m00Tcm4TlvDq8ikWAM",
  },
  {
    id: "atlas",
    label: "Atlas — calm male",
    demo: `${PUBLIC_BASE}/voices/amelia.mp3`,
    voice_id: "bg_voice_id_atlas_002",
  },
  {
    id: "spark",
    label: "Spark — upbeat female",
    demo: `${PUBLIC_BASE}/voices/amelia.mp3`,
    voice_id: "bg_voice_id_spark_003",
  },
  {
    id: "ridge",
    label: "Ridge — deep male",
    demo: `${PUBLIC_BASE}/voices/amelia.mp3`,
    voice_id: "bg_voice_id_ridge_004",
  },
  {
    id: "ember",
    label: "Ember — confident female",
    demo: `${PUBLIC_BASE}/voices/amelia.mp3`,
    voice_id: "bg_voice_id_ember_005",
  },
  {
    id: "polar",
    label: "Polar — crisp male",
    demo: `${PUBLIC_BASE}/voices/amelia.mp3`,
    voice_id: "bg_voice_id_polar_006",
  },
  {
    id: "breeze",
    label: "Breeze — light female",
    demo: `${PUBLIC_BASE}/voices/amelia.mp3`,
    voice_id: "bg_voice_id_breeze_007",
  },
  {
    id: "forge",
    label: "Forge — bold male",
    demo: `${PUBLIC_BASE}/voices/amelia.mp3`,
    voice_id: "bg_voice_id_forge_008",
  },
  {
    id: "serene",
    label: "Serene — soft female",
    demo: `${PUBLIC_BASE}/voices/amelia.mp3`,
    voice_id: "bg_voice_id_serene_009",
  },
  {
    id: "urban",
    label: "Urban — casual male",
    demo: `${PUBLIC_BASE}/voices/amelia.mp3`,
    voice_id: "bg_voice_id_urban_010",
  },
];

const secondsChoices = [2, 3, 4];

export default function AdCreateStep4() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // incoming data
  const adType = (params.get("adType") || "").toLowerCase();
  const model = params.get("model") || "";
  const mode = params.get("mode") || "";
  const productId = params.get("product_id") || "";

  const isCinematic = adType.includes("cinematic");
  const allowedVoiceMode = isCinematic ? "bg" : "avatar";

  const [voiceMode, setVoiceMode] = useState("none");

  // avatar info
  const [avatarData, setAvatarData] = useState(null);
  useEffect(() => {
    const cached = sessionStorage.getItem(AVATAR_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setAvatarData(parsed);
      } catch {}
    }
  }, []);

  // scenes
  const [scenes, setScenes] = useState([
    {
      id: "s1",
      seconds: 4,
      text: "Hook the viewer with a clear promise.",
      visual: "Presenter on screen, confident opener.",
    },
    {
      id: "s2",
      seconds: 4,
      text: "Call to action and benefit reminder.",
      visual: "Close-up product / logo with motion.",
    },
  ]);

  const used = useMemo(() => scenes.reduce((a, s) => a + Number(s.seconds || 0), 0), [scenes]);
  const remaining = Math.max(0, MAX_TOTAL - used);

  // bg voice state
  const [bgVoice, setBgVoice] = useState(BG_VOICES[0].id);
  const audioRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);

  const playPreview = (voice) => {
    const el = audioRef.current;
    if (!el) return;
    if (playingId === voice.id) {
      el.pause();
      setPlayingId(null);
      return;
    }
    el.src = voice.demo;
    el.currentTime = 0;
    el.play().catch(() => {});
    setPlayingId(voice.id);
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnd = () => setPlayingId(null);
    el.addEventListener("ended", onEnd);
    return () => el.removeEventListener("ended", onEnd);
  }, []);

  // load cached
  useEffect(() => {
    const cached = sessionStorage.getItem(STEP4_KEY);
    if (!cached) return;
    try {
      const s = JSON.parse(cached);
      if (s?.voiceMode) setVoiceMode(s.voiceMode);
      if (Array.isArray(s?.scenes) && s.scenes.length) setScenes(s.scenes);
      if (s?.bgVoice) setBgVoice(s.bgVoice);
    } catch {}
  }, []);

  const updateScene = (id, patch) =>
    setScenes((xs) => xs.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const addScene = () => {
    if (remaining < MIN_SCENE) return;
    const give = Math.min(MAX_SCENE, remaining);
    setScenes((xs) => [
      ...xs,
      {
        id: `s${xs.length + 1}`,
        seconds: give,
        text: "",
        visual: "",
      },
    ]);
  };

  const removeScene = (id) => setScenes((xs) => xs.filter((s) => s.id !== id));

  const handleSeconds = (id, nextSec) => {
    const current = scenes.find((s) => s.id === id)?.seconds || 0;
    const delta = Number(nextSec) - Number(current);
    if (delta <= remaining) {
      updateScene(id, { seconds: Number(nextSec) });
    }
  };

  const canContinue = used === MAX_TOTAL;
  const NEXT_PATH = "/ad/create/step-5";

  // back path logic
  const goBack = () => {
    const q = new URLSearchParams({ adType, model, mode, product_id: productId });
    navigate(`${isCinematic ? "/ad/create/step-2" : "/ad/create/step-3"}?${q.toString()}`);
  };

  // ------------------------------
  // PROPER FINAL PAYLOAD
  // ------------------------------
  const goNext = () => {
    const chosenBGVoice = BG_VOICES.find((v) => v.id === bgVoice);

    const payload = {
      adType,
      model,
      mode,
      product_id: productId,

      voiceMode, // "none" | "avatar" | "bg"
      scenes,

      // avatar voice information
      avatar: voiceMode === "avatar" && avatarData
        ? {
            name: avatarData.display_name,
            voice_id: avatarData.voice_id, // from Step3
          }
        : null,

      // background voice information
      bgVoice:
        voiceMode === "bg"
          ? {
              id: chosenBGVoice.id,
              label: chosenBGVoice.label,
              voice_id: chosenBGVoice.voice_id,
            }
          : null,
    };

    sessionStorage.setItem(STEP4_KEY, JSON.stringify(payload));
    const q = new URLSearchParams({ adType, model, mode, product_id: productId });
    navigate(`${NEXT_PATH}?${q.toString()}`);
  };

  // ------------------------------
  // UI
  // ------------------------------

  return (
    <div className="min-h-screen bg-white">
      <audio ref={audioRef} />

      <div className="mx-auto w-full max-w-6xl px-6 pt-10">
        {/* stepper */}
        <div className="zy-stepper zy-fadeup">
          <div className="zy-step"><div className="zy-step__dot">1</div><span>Setup</span></div>
          <div className="zy-step__bar zy-step__bar--filled" />
          <div className="zy-step"><div className="zy-step__dot">2</div><span>Customize</span></div>
          <div className="zy-step__bar zy-step__bar--filled" />
          <div className="zy-step zy-step--active"><div className="zy-step__dot">3</div><span>Advanced</span></div>
          <div className="zy-step__bar zy-step__bar--filled" />
          <div className="zy-step"><div className="zy-step__dot">4</div><span>Generate</span></div>
        </div>

        <h1 className="zy-h1">Script your <span className="zy-gradient-text">scenes</span></h1>
        <p className="mt-2 zy-sub">
          Keep it tight: total runtime is limited to 8 seconds.
        </p>

        {/* Voice selector */}
        <div className="mt-6 zy-card p-6">
          <div className="zy-section-title mb-3">Voice</div>

          <div className="flex flex-wrap gap-3">
            <VoicePill
              label="No voice"
              sub="Visual only"
              active={voiceMode === "none"}
              onClick={() => setVoiceMode("none")}
            />

            <VoicePill
              label={allowedVoiceMode === "bg" ? "Background voice" : "Avatar voice"}
              sub={
                allowedVoiceMode === "bg"
                  ? "Narration over visuals"
                  : `Speaker: ${avatarData?.display_name || "Your avatar"}`
              }
              active={voiceMode === allowedVoiceMode}
              onClick={() => setVoiceMode(allowedVoiceMode)}
            />
          </div>

          {/* Avatar mode tip */}
          {voiceMode === "avatar" && (
            <p className="mt-3 text-xs text-gray-600">
              Lip-sync auto-aligns when your avatar appears.
            </p>
          )}

          {/* BG voice selector */}
          {voiceMode === "bg" && (
            <div className="mt-4">
              <div className="mb-2 zy-sub">Choose a narrator voice</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {BG_VOICES.map((v) => (
                  <button
                    key={v.id}
                    className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                      bgVoice === v.id
                        ? "border-violet-500 ring-2 ring-violet-200"
                        : "border-gray-200"
                    }`}
                    onClick={() => setBgVoice(v.id)}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#0A0F1C]">
                        {v.label}
                      </div>
                      <div className="text-[11px] text-[#5B6275]">Preview</div>
                    </div>

                    <button
                      type="button"
                      className="ml-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-white shadow"
                      onClick={(e) => {
                        e.stopPropagation();
                        playPreview(v);
                      }}
                      title="Preview"
                    >
                      {playingId === v.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Scenes */}
        <div className="mt-6 zy-card p-6">
          <div className="flex items-center justify-between">
            <div className="zy-section-title">Scenes</div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-[#0A0F1C]">
                {used}s / {MAX_TOTAL}s
              </span>
              <button
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                  remaining >= MIN_SCENE
                    ? "border-gray-300 bg-white hover:bg-gray-50"
                    : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
                onClick={addScene}
              >
                <Plus className="h-4 w-4" /> Add scene
              </button>
            </div>
          </div>

          {/* Scene list */}
          <div className="mt-4 space-y-4">
            {scenes.map((s, idx) => (
              <SceneCard
                key={s.id}
                index={idx}
                data={s}
                remaining={remaining}
                onSecondsChange={handleSeconds}
                onChange={updateScene}
                onRemove={removeScene}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center gap-3">
          <button onClick={goBack} className="zy-btn-soft">Back</button>
          <button
            onClick={goNext}
            disabled={!canContinue}
            className={`w-full rounded-xl px-5 py-3 text-white font-semibold transition ${
              canContinue
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95"
                : "bg-gradient-to-r from-indigo-300 to-violet-300 cursor-not-allowed"
            }`}
          >
            Continue <ChevronRight className="ml-1 inline h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- components --- */
function VoicePill({ label, sub, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col rounded-2xl border px-4 py-3 text-left transition ${
        active ? "border-violet-500 bg-violet-50" : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-4 w-4 rounded-full ring-2 ${
            active ? "bg-violet-600 ring-violet-600" : "bg-white ring-gray-300"
          }`}
        />
        <span className="font-semibold text-[#0A0F1C]">{label}</span>
      </div>
      <div className="pl-6 text-[12px] text-[#5B6275]">{sub}</div>
    </button>
  );
}

function SceneCard({ index, data, remaining, onChange, onSecondsChange, onRemove }) {
  const secondsChoices = [2, 3, 4];
  return (
    <div className="rounded-2xl border border-gray-200">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="inline-flex items-center gap-2">
          <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white">
            {index + 1}
          </span>
          <span className="text-sm font-extrabold text-[#0A0F1C]">
            Scene {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-[#5B6275]">Seconds</label>
          <select
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm bg-white"
            value={data.seconds}
            onChange={(e) => onSecondsChange(data.id, Number(e.target.value))}
          >
            {secondsChoices.map((sec) => (
              <option key={sec} value={sec}>
                {sec}s
              </option>
            ))}
          </select>

          <button
            onClick={() => onRemove(data.id)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-red-600 hover:bg-red-50"
            title="Delete scene"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-semibold text-[#0A0F1C]">Voice Over</div>
          <textarea
            className="zy-textarea h-28"
            placeholder="Script line for this scene"
            value={data.text}
            onChange={(e) => onChange(data.id, { text: e.target.value })}
          />
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-[#0A0F1C]">Visual</div>
          <textarea
            className="zy-textarea h-28"
            placeholder="Camera style, motion, setting..."
            value={data.visual}
            onChange={(e) => onChange(data.id, { visual: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
