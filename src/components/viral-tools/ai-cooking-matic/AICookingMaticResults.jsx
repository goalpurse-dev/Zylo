import { useState, useCallback, useEffect, useRef } from "react";
import { Check, Download, X, ChevronLeft, ChevronRight, AlertCircle, UtensilsCrossed, RotateCcw, Play, Pause, Music2, Sparkles } from "lucide-react";
import { CLIP_PAIRS, SCENE_LABELS, VIBES } from "./api/cookingMaticApi";
import CaptionPreviewPanel from "./CaptionPreviewPanel";

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatAudioDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--:--";
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  return `${minutes}:${String(rounded % 60).padStart(2, "0")}`;
}

function downloadImage(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ scenes, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const scene = scenes[idx];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft")  setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(scenes.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scenes.length, onClose]);

  if (!scene?.imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/60 hover:text-white transition"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Image */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl">
          <img src={scene.imageUrl} alt={SCENE_LABELS[scene.index]} className="w-full object-cover" />
          {/* Label */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="bg-black/60 backdrop-blur-md text-white text-[11px] font-black px-2.5 py-1 rounded-full">
              {scene.index + 1} / 10
            </span>
            <span className="bg-black/60 backdrop-blur-md text-white/80 text-[11px] font-semibold px-2.5 py-1 rounded-full">
              {SCENE_LABELS[scene.index]}
            </span>
          </div>
          {/* Download */}
          <button
            onClick={() => downloadImage(scene.imageUrl, `cooking-scene-${scene.index + 1}.jpg`)}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white text-[12px] font-semibold px-3 py-1.5 rounded-full hover:bg-black/80 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Save
          </button>
        </div>

        {/* Nav */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-1.5">
            {scenes.map((s, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`w-2 h-2 rounded-full transition ${i === idx ? "bg-orange-400" : "bg-white/20 hover:bg-white/40"}`}
              />
            ))}
          </div>
          <button
            onClick={() => setIdx((i) => Math.min(scenes.length - 1, i + 1))}
            disabled={idx === scenes.length - 1}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Scene Card ────────────────────────────────────────────────────────────────
function SceneCard({ scene, isActive, onView, onRedo }) {
  const { index, imageStatus, imageUrl } = scene;
  const isLoading  = imageStatus === "queued" || imageStatus === "running";
  const isRetrying = imageStatus === "retrying";
  const isFailed   = imageStatus === "failed";
  const isDone     = imageStatus === "succeeded";

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden border transition-all duration-500 ${
        isActive
          ? "border-orange-500/50 shadow-lg shadow-orange-900/20"
          : isDone
          ? "border-white/10"
          : "border-white/[0.06]"
      } bg-[#111315]`}
    >
      {/* Image area — taller cards */}
      <div className="relative aspect-[9/16] bg-[#0c0e10]">
        {/* Skeleton */}
        {!isDone && !isFailed && (
          <div className="absolute inset-0">
            <div className={`w-full h-full ${isLoading ? "animate-pulse" : ""} bg-gradient-to-br from-white/[0.03] to-transparent`} />
            {isLoading && (
              <>
                {/* Shimmer sweep */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className={`w-6 h-6 border-2 rounded-full animate-spin ${isRetrying ? "border-amber-500/40 border-t-amber-400" : "border-orange-500/40 border-t-orange-400"}`} />
                  <p className={`text-[11px] font-medium ${isRetrying ? "text-amber-400/80" : "text-white/25"}`}>
                    {isRetrying ? "Provider busy — retrying…" : "Generating…"}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {isFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <X className="w-6 h-6 text-red-400/50" />
            <p className="text-white/25 text-[11px]">Failed</p>
            {onRedo && (
              <button type="button" onClick={onRedo}
                className="mt-1 flex items-center gap-1.5 rounded-full border border-red-300/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold text-red-200 transition hover:bg-red-500/20"
                title={scene.error || "Regenerate this scene"}>
                <RotateCcw className="h-3 w-3" /> Regenerate
              </button>
            )}
          </div>
        )}

        {isDone && imageUrl && (
          <button onClick={() => onView(index)} className="absolute inset-0 group">
            <img
              src={imageUrl}
              alt={SCENE_LABELS[index]}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
          </button>
        )}

        {/* Scene number badge */}
        <div className="absolute top-2 left-2 z-10">
          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black shadow-md ${
            isDone ? "bg-orange-500 text-white" : isActive ? "bg-orange-500/40 text-orange-200" : "bg-white/10 text-white/40"
          }`}>
            {index + 1}
          </span>
        </div>

        {/* Hover actions */}
        {isDone && imageUrl && (
          <div className="absolute bottom-2 right-2 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
            {onRedo && (
              <button
                onClick={(e) => { e.stopPropagation(); onRedo(); }}
                className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md transition hover:bg-black/90"
                title="Regenerate"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); downloadImage(imageUrl, `cooking-scene-${index + 1}.jpg`); }}
              className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md transition hover:bg-black/90"
              title="Save"
            >
              <Download className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Label footer */}
      <div className="px-3 py-2 border-t border-white/[0.05]">
        <p className="text-white/50 text-[11px] font-bold truncate">{SCENE_LABELS[index]}</p>
      </div>
    </div>
  );
}

// ── Clip Card (video) ─────────────────────────────────────────────────────────
const CLIP_LABELS = [
  "Dish Hook + Ingredients",
  "Prep + Add to Bowl",
  "Season + Start Cooking",
  "Cook + Finish & Plate",
  "Present + Food Close-Up",
];

function ClipCard({ clip, posterUrl, onRedo }) {
  const { index, videoStatus, videoUrl } = clip;
  const isLoading = videoStatus === "queued" || videoStatus === "running";
  const isFailed  = videoStatus === "failed";
  const isDone    = videoStatus === "succeeded";
  const [videoReady, setVideoReady] = useState(false);

  // Seedance commonly finishes around 1–3 minutes, then the result is copied
  // into permanent storage. At 90s show a truthful finalizing state, not a
  // false failure warning while Runware is still working normally.
  const [finalizing, setFinalizing] = useState(false);
  useEffect(() => {
    if (!isLoading) { setFinalizing(false); return; }
    const t = setTimeout(() => setFinalizing(true), 90_000);
    return () => clearTimeout(t);
  }, [isLoading, videoStatus]);

  useEffect(() => {
    setVideoReady(false);
  }, [videoUrl]);

  return (
    <div className="group relative rounded-2xl overflow-hidden bg-[#0e1012] border border-white/[0.07]">
      <div className="relative aspect-[9/16]">
        {posterUrl && (
          <img
            src={posterUrl}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${isDone && videoReady ? "opacity-0" : "opacity-100"}`}
          />
        )}
        {isDone && videoUrl ? (
          <video
            src={videoUrl}
            poster={posterUrl || undefined}
            autoPlay muted loop playsInline preload="auto"
            onLoadedData={() => setVideoReady(true)}
            onCanPlay={() => setVideoReady(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${videoReady ? "opacity-100" : "opacity-0"}`}
          />
        ) : isFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-950/20">
            <AlertCircle className="w-6 h-6 text-red-400/60" />
            <p className="text-[11px] text-red-400/60">Failed</p>
            {onRedo && (
              <button type="button" onClick={onRedo}
                className="mt-1 flex items-center gap-1.5 rounded-full border border-red-300/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold text-red-200 transition hover:bg-red-500/20"
                title={clip.error || "Regenerate this clip"}>
                <RotateCcw className="h-3 w-3" /> Regenerate
              </button>
            )}
          </div>
        ) : isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a0b0d]">
            {finalizing ? (
              <>
                <div className="w-6 h-6 border-2 rounded-full animate-spin border-orange-500/40 border-t-orange-400" />
                <p className="text-[11px] text-white/35 text-center px-3">Finalizing video…<br/>this can take a few minutes</p>
              </>
            ) : (
              <>
                <div className="w-6 h-6 border-2 rounded-full animate-spin border-orange-500/40 border-t-orange-400" />
                <p className="text-[11px] text-white/20">Animating…</p>
              </>
            )}
          </div>
        ) : null /* idle — hidden, handled by parent */}

        {/* Label overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2.5 pt-6">
          <p className="text-white/80 text-[10px] font-semibold leading-tight">{CLIP_LABELS[index]}</p>
        </div>

        {isDone && videoUrl && !videoReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-orange-300" />
          </div>
        )}

        {/* Hover actions */}
        {isDone && videoUrl && (
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
            {onRedo && (
              <button
                onClick={onRedo}
                className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md transition hover:bg-black/80"
                title="Regenerate"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => {
                const a = document.createElement("a");
                a.href = videoUrl;
                a.download = `cooking-clip-${index + 1}.mp4`;
                a.target = "_blank";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }}
              className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-md transition hover:bg-black/80"
              title="Save"
            >
              <Download className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function VoiceResultPanel({ scenes, voiceData, voiceGenerations = [], dishLabel, onViewScene, onSelectVoice, onContinue }) {
  const [playingKey, setPlayingKey] = useState(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [probedDurations, setProbedDurations] = useState({});
  const audioRefs = useRef(new Map());
  const previewScenes = scenes.filter(s => s.imageUrl);
  const sounds = voiceGenerations.length > 0 ? voiceGenerations : (voiceData?.audioUrl ? [voiceData] : []);
  const soundKeyFor = (sound, index = 0) => sound.id || sound.audioUrl || `${sound.voiceId || sound.voiceLabel || "voice"}-${index}`;
  const durationSignature = sounds.map((sound, index) => `${soundKeyFor(sound, index)}:${sound.durationSec || ""}`).join("|");
  const bars = [34, 62, 45, 78, 54, 88, 42, 68, 50, 82, 38, 72, 58, 92, 46, 76, 40, 84, 52, 70, 44, 80, 56, 66, 36, 74, 48, 86, 60, 72, 42, 64];

  useEffect(() => () => {
    audioRefs.current.forEach(audio => audio.pause());
    audioRefs.current.clear();
  }, []);

  useEffect(() => {
    const pending = [];
    let cancelled = false;
    sounds.forEach((sound, index) => {
      const soundKey = soundKeyFor(sound, index);
      if (!sound.audioUrl || Number(sound.durationSec) > 0 || Number(probedDurations[soundKey]) > 0) return;
      const audio = new Audio();
      pending.push(audio);
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        if (cancelled || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
        setProbedDurations(current => ({ ...current, [soundKey]: Number(audio.duration.toFixed(2)) }));
      };
      audio.src = sound.audioUrl;
    });
    return () => {
      cancelled = true;
      pending.forEach(audio => { audio.removeAttribute("src"); });
    };
  // The signature changes only when a take or its persisted duration changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationSignature]);

  const isSelected = (sound) => Boolean(
    voiceData && (
      (voiceData.id && sound.id === voiceData.id) ||
      (!voiceData.id && sound.audioUrl === voiceData.audioUrl)
    )
  );

  const measureDuration = (url) => new Promise((resolve) => {
    const audio = new Audio();
    const finish = (value) => {
      audio.removeAttribute("src");
      resolve(Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : null);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(null);
    audio.src = url;
  });

  const selectTake = async (sound, soundIndex = 0) => {
    if (!sound?.audioUrl) return;
    const soundKey = soundKeyFor(sound, soundIndex);
    const knownDuration = Number(sound.durationSec) || Number(probedDurations[soundKey]) || null;
    const durationSec = knownDuration || await measureDuration(sound.audioUrl);
    if (durationSec) setProbedDurations(current => ({ ...current, [soundKey]: durationSec }));
    onSelectVoice?.(durationSec ? { ...sound, durationSec } : sound);
  };

  const toggle = (sound, soundKey, soundIndex) => {
    if (!sound?.audioUrl) return;
    audioRefs.current.forEach((audio, audioKey) => {
      if (audioKey !== soundKey) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
    let audio = audioRefs.current.get(soundKey);
    if (!audio) {
      audio = new Audio(sound.audioUrl);
      audioRefs.current.set(soundKey, audio);
      audio.ontimeupdate = () => {
        const progress = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
        setPlaybackProgress(Math.max(0, Math.min(100, progress)));
      };
      audio.onended = () => { setPlayingKey(null); setPlaybackProgress(0); };
      audio.onerror = () => { setPlayingKey(null); setPlaybackProgress(0); };
    }
    void selectTake(sound, soundIndex);
    if (playingKey === soundKey) {
      audio.pause();
      setPlayingKey(null);
    } else {
      setPlaybackProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
      void audio.play();
      setPlayingKey(soundKey);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/[0.07] bg-[#101214] p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/32">Voice takes</p>
            {sounds.length > 0 && <span className="rounded-full bg-orange-500/12 px-2 py-0.5 text-[9px] font-black text-orange-300">{sounds.length}</span>}
          </div>
          <h3 className="mt-0.5 truncate text-[16px] font-black text-white">{dishLabel || "Cooking Story"}</h3>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[10px] font-bold text-white/38">
          <Sparkles className="h-3.5 w-3.5 text-orange-300" /> Latest auto-selected
        </div>
      </div>

      <div className="mt-3 shrink-0">
        {sounds.length > 0 ? (
          <div className="max-h-[202px] space-y-1 overflow-y-auto pr-1 [scrollbar-color:rgba(255,255,255,.14)_transparent] [scrollbar-width:thin]">
            {sounds.map((sound, soundIndex) => {
              const soundKey = soundKeyFor(sound, soundIndex);
              const playing = playingKey === soundKey;
              const selected = isSelected(sound);
              const progress = playing ? playbackProgress : 0;
              const durationSec = Number(sound.durationSec) || Number(probedDurations[soundKey]) || null;
              const durationState = durationSec == null ? "Checking" : durationSec < 24 ? "Too short" : durationSec > 34 ? "Too long" : "Fits video";
              const durationTone = durationState === "Fits video" ? "text-emerald-400" : durationState === "Checking" ? "text-white/25" : durationState === "Too short" ? "text-red-300" : "text-amber-300";
              return (
                <div
                  key={soundKey}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  onClick={() => { void selectTake(sound, soundIndex); }}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") void selectTake(sound, soundIndex); }}
                  className={`group relative cursor-pointer overflow-hidden rounded-xl border p-2 transition-all duration-200 active:scale-[0.995] ${selected ? "voice-take-selected border-orange-400/45 shadow-[0_8px_28px_rgba(249,115,22,0.08)]" : "border-white/[0.07] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.045]"}`}
                >
                  {selected && <div className="absolute inset-y-2 left-0 z-[2] w-0.5 rounded-full bg-gradient-to-b from-amber-200 via-orange-400 to-red-500" />}
                  <div className="relative z-[1] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); toggle(sound, soundKey, soundIndex); }}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-90 ${playing ? "bg-orange-400 text-black shadow-[0_0_18px_rgba(251,146,60,0.24)]" : selected ? "bg-white text-black" : "bg-white/[0.08] text-white/70 group-hover:bg-white group-hover:text-black"}`}
                      aria-label={playing ? "Pause voice take" : "Play voice take"}
                    >
                      {playing ? <Pause className="h-3 w-3 fill-current" /> : <Play className="ml-0.5 h-3 w-3 fill-current" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="truncate text-[12px] font-black text-white">{sound.voiceLabel || sound.voiceId || "Voice"}</span>
                        {sound.imported && sound.fileName && (
                          <span className="max-w-[220px] truncate text-[9px] font-medium text-white/38" title={sound.fileName}>· {sound.fileName}</span>
                        )}
                        <span className="text-[9px] font-semibold text-white/28">Take {sounds.length - soundIndex}</span>
                        {soundIndex === 0 && <span className="rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-orange-300">Latest</span>}
                        <span className={`ml-auto text-[8px] font-black tabular-nums sm:hidden ${durationTone}`}>{formatAudioDuration(durationSec)} · {durationState}</span>
                      </div>
                      <div className="voice-take-wave relative inline-flex h-4 max-w-full items-center gap-[2px] overflow-hidden rounded-md border border-white/[0.06] px-1.5 align-middle">
                        {bars.map((height, barIndex) => {
                          const reached = playing && ((barIndex + 1) / bars.length) * 100 <= progress;
                          return (
                            <span
                              key={barIndex}
                              className={`w-[2px] shrink-0 rounded-full transition-colors duration-150 ${reached ? "bg-amber-200" : selected ? "bg-orange-100/55" : "bg-white/30"}`}
                              style={{ height: `${Math.max(16, Math.round((height - ((soundIndex * 7 + barIndex * 3) % 16)) * 0.48))}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <div className="mr-1 hidden min-w-[68px] text-right sm:block">
                        <p className="text-[10px] font-black tabular-nums text-white/72">{formatAudioDuration(durationSec)} <span className="font-medium text-white/22">/ 0:30</span></p>
                        <p className={`text-[8px] font-black uppercase tracking-wide ${durationTone}`}>{durationState}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          const a = document.createElement("a");
                          a.href = sound.audioUrl;
                          a.download = `${dishLabel || "voiceover"}-take-${sounds.length - soundIndex}.mp3`;
                          a.target = "_blank";
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-white/28 transition hover:bg-white/[0.08] hover:text-white"
                        title="Download MP3"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${selected ? "border-orange-300 bg-orange-400 text-black" : "border-white/12 bg-white/[0.025] text-transparent"}`}>
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[104px] items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 text-left">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
              <Music2 className="h-4 w-4 text-white/30" />
            </div>
            <div>
              <h3 className="text-[13px] font-black text-white">Your voice takes appear here</h3>
              <p className="mt-0.5 text-[11px] text-white/35">Generate two or more, preview them, then select your favorite.</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/28">Scene preview</p>
        <div className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin]">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 min-[900px]:grid-cols-6">
          {previewScenes.map((scene) => {
            return (
              <button key={scene.index} type="button" onClick={() => onViewScene(scene.index)}
                className="aspect-[9/16] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.035] transition hover:border-white/18">
                {scene?.imageUrl ? <img src={scene.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-white/[0.04]" />}
              </button>
            );
          })}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-3 bottom-[calc(86px+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-white/[0.08] bg-[#101213]/96 p-3 shadow-[0_-18px_55px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:hidden">
        <p className="mb-2 text-center text-[10px] font-semibold text-white/38">
          {voiceData?.audioUrl ? "Voice selected. Continue when it sounds right." : "Select a generated or imported voice to continue."}
        </p>
        <button
          type="button"
          disabled={!voiceData?.audioUrl}
          onClick={onContinue}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-4 text-[14px] font-black text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
        >
          Continue to Captions <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Recent panel ──────────────────────────────────────────────────────────────
function RecentPanel({ generations, onLoad }) {
  if (!generations.length) return null;
  return (
    <div className="mt-8">
      <h3 className="text-white/40 text-[11px] font-bold uppercase tracking-widest mb-3">Recent Generations</h3>
      <div className="space-y-3">
        {generations.map((gen) => {
          const thumbs = (gen.scenes ?? []).filter((s) => s.imageUrl).slice(0, 3);
          return (
            <button
              key={gen.id}
              onClick={() => onLoad(gen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition text-left"
            >
              <div className="flex gap-1 shrink-0">
                {thumbs.map((s, i) => (
                  <div key={i} className="w-10 h-12 rounded-lg overflow-hidden bg-white/[0.04]">
                    <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                {thumbs.length === 0 && <div className="w-10 h-12 rounded-lg bg-white/[0.04]" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white/80 text-[13px] font-bold truncate">{gen.dish_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {(() => {
                    const clipCount = (gen.clips ?? []).filter(c => c.videoUrl).length;
                    if (gen.fullVideoUrl) return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-400/25">&#10003; Exported video</span>;
                    if (clipCount === 5 && gen.voice?.audioUrl) return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">✓ Voice added</span>;
                    if (clipCount === 5) return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">▶ Add Voice</span>;
                    if (clipCount > 0)   return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{clipCount}/5 clips</span>;
                    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">▶ Continue</span>;
                  })()}
                  <span className="text-white/30 text-[10px]">{timeAgo(gen.created_at)}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Results component ────────────────────────────────────────────────────
export default function AICookingMaticResults({
  workflowStep = "setup",
  voiceData = null,
  voiceGenerations = [],
  onSelectVoice,
  captionDraft = null,
  onCaptionStyleChange,
  onCaptionDraftChange,
  onChangeAudio,
  onVoiceContinue,
  onFinishPreview,
  phase,
  scenes,
  clips = [],
  dishLabel,
  error = null,
  onNew,
  onRegenerate,
  onRetryScene,
  onRetryClip,
  recentGenerations = [],
  onLoadRecent,
}) {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const doneScenes    = scenes.filter((s) => s.imageStatus === "succeeded");
  const doneClips     = clips.filter((c) => c.videoStatus === "succeeded");
  const activeIndex   = scenes.findIndex((s) => s.imageStatus === "queued" || s.imageStatus === "running");
  const isImagePhase  = phase === "images" || phase === "retrying";
  const isVideoPhase  = phase === "videos";
  const isRetryPhase  = phase === "retrying";
  const isDone        = phase === "done";
  const progress      = doneScenes.length;

  const handleView = useCallback((index) => setLightboxIndex(index), []);
  const lightboxScenes = scenes.filter(s => s.imageUrl);
  const lightboxStartIndex = lightboxScenes.findIndex(s => s.index === lightboxIndex);
  const showVoiceResults  = workflowStep === "step2" && phase === "done";
  const showCaptionPreview = workflowStep === "step3" && phase === "done";

  // ── IDLE state — full width, no card constraint ──
  if (phase === "idle" && scenes.length === 0) {
    return (
      <div className="flex w-full flex-col gap-4 px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-3 lg:h-full lg:gap-6 lg:overflow-y-auto lg:p-4">
        {/* Hero — centered intro */}
        <div className="hidden flex-col items-center justify-center py-10 text-center lg:flex">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-600/10 border border-orange-500/20 flex items-center justify-center mb-4">
            <UtensilsCrossed className="w-7 h-7 text-orange-300" />
          </div>
          <h2 className="text-white text-[22px] font-black mb-1.5">AI Cooking Matic</h2>
          <p className="text-white/40 text-[13px] max-w-sm leading-relaxed">
            10 cinematic scenes + 5 animated clips — from one dish name.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5 w-full max-w-lg">
            {[["🎬","10 scenes"],["🎨","Visual style"],["🎙️","Voiceover"],["CC","Captions"]].map(([i,l]) => (
              <div key={l} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.05]">
                <span className="text-sm">{i}</span>
                <span className="text-white/45 text-[12px] font-semibold">{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent generations — big cards */}
        {recentGenerations.length > 0 && (
          <div>
            <h3 className="text-white/35 text-[11px] font-bold uppercase tracking-widest mb-3">Recent Generations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentGenerations.map((gen) => {
                const thumbs = (gen.scenes ?? []).filter(s => s.imageUrl).slice(0, 4);
                const vibe = VIBES.find(v => v.id === gen.vibe_id);
                return (
                  <button key={gen.id} onClick={() => onLoadRecent(gen)}
                    className="group flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04] overflow-hidden text-left transition-all active:scale-[0.99]">
                    {/* Scene thumbnails grid */}
                    <div className="grid grid-cols-4 gap-0.5 p-1.5">
                      {thumbs.map((s, i) => (
                        <div key={i} className="aspect-[3/4] rounded-lg overflow-hidden bg-white/[0.04]">
                          <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                      {Array.from({ length: 4 - thumbs.length }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-[3/4] rounded-lg bg-white/[0.03]" />
                      ))}
                    </div>
                    {/* Info */}
                    <div className="px-3 pb-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white/80 text-[14px] font-bold truncate">{gen.dish_name}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {(() => {
                            const clipCount = (gen.clips ?? []).filter(c => c.videoUrl).length;
                            if (gen.fullVideoUrl) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-400/25">&#10003; Exported video</span>;
                            if (clipCount === 5 && gen.voice?.audioUrl) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">✓ Voice added</span>;
                            if (clipCount === 5) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">▶ Add Voice</span>;
                            if (clipCount > 0)   return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{clipCount}/5 clips</span>;
                            return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">▶ Continue</span>;
                          })()}
                          {vibe && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: vibe.accent + "22", color: vibe.accent }}>{vibe.label}</span>}
                          <span className="text-white/25 text-[11px]">{timeAgo(gen.created_at)}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 shrink-0 transition" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {recentGenerations.length === 0 && (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 text-center lg:hidden">
            <UtensilsCrossed className="h-6 w-6 text-white/20" />
            <p className="mt-3 text-[13px] font-bold text-white/55">No recent generations yet</p>
            <p className="mt-1 text-[11px] text-white/30">Open Create to make your first cooking video.</p>
          </div>
        )}
      </div>
    );
  }

  if (showCaptionPreview) {
    return (
      <div className="flex w-full px-3 pb-[calc(170px+env(safe-area-inset-bottom))] pt-3 lg:h-full lg:overflow-hidden lg:p-3">
        <CaptionPreviewPanel
          key={voiceData?.id || voiceData?.audioUrl || "no-selected-voice"}
          clips={doneClips}
          captionDraft={captionDraft}
          voiceData={voiceData}
          onStyleChange={onCaptionStyleChange}
          onDraftChange={onCaptionDraftChange}
          onChangeAudio={onChangeAudio}
        />
        <div className="fixed inset-x-3 bottom-[calc(86px+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-white/[0.08] bg-[#101213]/96 p-3 shadow-[0_-18px_55px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:hidden">
          <p className="mb-2 text-center text-[10px] font-semibold text-white/38">Check caption timing and placement, then finish your video.</p>
          <button
            type="button"
            onClick={onFinishPreview}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-4 text-[14px] font-black text-white transition active:scale-[0.98]"
          >
            Finish &amp; Export <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (showVoiceResults) {
    return (
      <>
        <div className="flex w-full px-3 pb-[calc(180px+env(safe-area-inset-bottom))] pt-3 lg:h-full lg:overflow-hidden lg:p-3">
          <VoiceResultPanel
            scenes={scenes}
            voiceData={voiceData}
            voiceGenerations={voiceGenerations}
            onSelectVoice={onSelectVoice}
            dishLabel={dishLabel}
            onViewScene={handleView}
            onContinue={onVoiceContinue}
          />
        </div>

        {lightboxIndex !== null && lightboxStartIndex >= 0 && (
          <Lightbox
            scenes={lightboxScenes}
            startIndex={lightboxStartIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </>
    );
  }

  // ── ACTIVE / DONE state ── (matches Clay Rescue layout pattern)
  return (
    <>
    <div className="flex w-full flex-col gap-3 p-3 pb-[calc(104px+env(safe-area-inset-bottom))] lg:h-full lg:overflow-hidden lg:pb-3">

      {/* Status bar — own rounded card like Clay Rescue */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#111315] border border-white/[0.07]">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {!isDone && <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />}
              <span className="text-[13px] font-semibold text-white truncate">{dishLabel || "Cooking Story"}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onNew && (
                <button onClick={onNew} className="flex items-center gap-1 text-white/40 hover:text-white text-[11px] font-semibold px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-white/15 transition">
                  + New
                </button>
              )}
              {isDone && doneScenes.length > 0 && (
                <button onClick={() => doneScenes.forEach((s, i) => setTimeout(() => downloadImage(s.imageUrl, `cooking-scene-${s.index + 1}.jpg`), i * 300))}
                  className="flex items-center gap-1 text-white/40 hover:text-white text-[11px] font-semibold px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-white/15 transition">
                  <Download className="w-3 h-3" /> Save
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {isImagePhase && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${isRetryPhase ? "bg-amber-500" : "bg-gradient-to-r from-orange-500 to-red-500"}`} style={{ width: `${(progress / 10) * 100}%` }} />
              </div>
              <span className="text-white/30 text-[11px] shrink-0">{progress}/10 scenes</span>
            </div>
          )}
          {isVideoPhase && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${(doneClips.length / 5) * 100}%` }} />
              </div>
              <span className="text-white/30 text-[11px] shrink-0">{doneClips.length}/5 clips</span>
            </div>
          )}
          {isDone && <span className="text-emerald-400 text-[12px] font-semibold">✓ {doneScenes.length} scenes · {doneClips.length} clips ready</span>}
          {error && <span className="text-red-400 text-[12px]">{error}</span>}
        </div>
      </div>

      {/* Scene grid — scrollable, takes all remaining height */}
      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto [scrollbar-width:thin] space-y-4">

        {/* Video clips — only show when at least one clip is actually in progress or done */}
        {clips.some(c => c.videoStatus !== "idle") && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-2">
              {isDone ? `${doneClips.length}/5 Clips` : "Animating…"}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {clips.map(clip => {
                const posterSceneIndex = CLIP_PAIRS[clip.index]?.[0];
                const posterUrl = scenes.find(s => s.index === posterSceneIndex)?.imageUrl ?? null;
                return <ClipCard key={clip.index} clip={clip} posterUrl={posterUrl} onRedo={onRetryClip ? () => onRetryClip(clip.index) : onRegenerate} />;
              })}
            </div>
          </div>
        )}

        {/* Scene images */}
        <div>
          {(isVideoPhase || isDone) && (
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-2">Scenes</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {scenes.map(scene => (
              <SceneCard key={scene.index} scene={scene} isActive={scene.index === activeIndex} onView={handleView} onRedo={onRetryScene ? () => onRetryScene(scene.index) : onRegenerate} />
            ))}
          </div>
        </div>

        <RecentPanel generations={recentGenerations} onLoad={onLoadRecent} />
      </div>
    </div>

    {lightboxIndex !== null && lightboxStartIndex >= 0 && (
      <Lightbox
        scenes={lightboxScenes}
        startIndex={lightboxStartIndex}
        onClose={() => setLightboxIndex(null)}
      />
    )}
    </>
  );
}
