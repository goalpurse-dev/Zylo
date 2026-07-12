import { useState, useCallback, useEffect, useRef } from "react";
import { Download, X, ChevronLeft, ChevronRight, AlertCircle, UtensilsCrossed, RotateCcw, Play, Pause, Music2 } from "lucide-react";
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
function SceneCard({ scene, dishLabel, isActive, onView, onRedo }) {
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
  "Chef Intro + Ingredient",
  "Prep + Coating",
  "Into the Oil + Fry",
  "Wok Toss + Plating",
  "Chef Reveal + Hero",
];

function ClipCard({ clip, posterUrl, onRedo }) {
  const { index, videoStatus, videoUrl } = clip;
  const isLoading = videoStatus === "queued" || videoStatus === "running";
  const isFailed  = videoStatus === "failed";
  const isDone    = videoStatus === "succeeded";
  const [videoReady, setVideoReady] = useState(false);

  // Detect stalled jobs: if loading for > 90s without the hook updating us, show a warning
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!isLoading) { setStalled(false); return; }
    const t = setTimeout(() => setStalled(true), 90_000);
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
          </div>
        ) : isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a0b0d]">
            {stalled ? (
              <>
                <AlertCircle className="w-5 h-5 text-amber-400/60" />
                <p className="text-[11px] text-amber-400/60 text-center px-2">Taking long…<br/>may have failed</p>
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

function VoiceResultPanel({ scenes, voiceData, dishLabel, onViewScene }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const previewScenes = scenes.filter(s => s.imageUrl).slice(0, 3);
  const bars = [28, 44, 36, 64, 48, 76, 42, 58, 82, 46, 70, 38, 54, 88, 50, 66, 32, 72, 40, 60, 34, 78, 46, 56];

  const toggle = () => {
    if (!voiceData?.audioUrl) return;
    if (!audioRef.current) {
      const audio = new Audio(voiceData.audioUrl);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/[0.07] bg-[#101214] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-white/32">Voiceover</p>
          <h3 className="mt-1 truncate text-[18px] font-black text-white">{dishLabel || "Cooking Story"}</h3>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-500/10">
          <Music2 className="h-4 w-4 text-orange-300" />
        </div>
      </div>

      <div className="mt-5 flex flex-1 flex-col justify-center">
        {voiceData?.audioUrl ? (
          <div className="rounded-3xl border border-orange-400/20 bg-[linear-gradient(135deg,rgba(249,115,22,0.12),rgba(239,68,68,0.08),rgba(255,255,255,0.035))] p-4 shadow-[0_22px_70px_rgba(249,115,22,0.10)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-black text-white">{voiceData.voiceLabel || voiceData.voiceId || "Voice"} ready</p>
                <p className="mt-0.5 text-[11px] text-white/38">{voiceData.script?.length ?? 0} chars · MP3 voiceover</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = voiceData.audioUrl;
                    a.download = `${dishLabel || "voiceover"}.mp3`;
                    a.target = "_blank";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white active:scale-95"
                  title="Download MP3"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button type="button" onClick={toggle}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition active:scale-95">
                  {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                </button>
              </div>
            </div>
            <div className="flex h-20 items-center gap-1.5 overflow-hidden rounded-2xl border border-white/10 bg-black/25 px-3">
              {bars.map((height, index) => (
                <div key={index}
                  className={`w-full rounded-full transition ${playing ? "bg-orange-300/85" : "bg-white/25"}`}
                  style={{ height: `${height}%`, opacity: playing ? 0.45 + (index % 5) * 0.1 : 0.35 }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.025] px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <Music2 className="h-5 w-5 text-white/30" />
            </div>
            <h3 className="mt-4 text-[17px] font-black text-white">No sounds generated yet</h3>
            <p className="mt-1 max-w-xs text-[12px] leading-relaxed text-white/38">Choose a voice and generate speech to create the final audio track.</p>
          </div>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/28">Scene preview</p>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => {
            const scene = previewScenes[index];
            return (
              <button key={index} type="button" onClick={() => scene?.imageUrl && onViewScene(scene.index)}
                className="aspect-[9/16] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] transition hover:border-white/18">
                {scene?.imageUrl ? <img src={scene.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse bg-white/[0.04]" />}
              </button>
            );
          })}
        </div>
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
          const vibe   = VIBES.find((v) => v.id === gen.vibe_id);
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
  captionDraft = null,
  onCaptionStyleChange,
  onCaptionDraftChange,
  onChangeAudio,
  phase,
  scenes,
  clips = [],
  dishLabel,
  error = null,
  onNew,
  onRegenerate,
  recentGenerations = [],
  onLoadRecent,
}) {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const doneScenes    = scenes.filter((s) => s.imageStatus === "succeeded");
  const doneClips     = clips.filter((c) => c.videoStatus === "succeeded");
  const activeIndex   = scenes.findIndex((s) => s.imageStatus === "queued" || s.imageStatus === "running");
  const isImagePhase  = phase === "images" || phase === "retrying";
  const isVideoPhase  = phase === "videos";
  const isGenerating  = isImagePhase || isVideoPhase;
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
      <div className="flex flex-col w-full p-4 gap-6 lg:h-full lg:overflow-y-auto">
        {/* Hero — centered intro */}
        <div className="flex flex-col items-center justify-center text-center py-10">
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
      </div>
    );
  }

  if (showCaptionPreview) {
    return (
      <div className="flex w-full p-3 lg:h-full lg:overflow-hidden">
        <CaptionPreviewPanel
          clips={doneClips}
          captionDraft={captionDraft}
          voiceData={voiceData}
          onStyleChange={onCaptionStyleChange}
          onDraftChange={onCaptionDraftChange}
          onChangeAudio={onChangeAudio}
        />
      </div>
    );
  }

  if (showVoiceResults) {
    return (
      <>
        <div className="flex w-full p-3 lg:h-full lg:overflow-hidden">
          <VoiceResultPanel
            scenes={scenes}
            voiceData={voiceData}
            dishLabel={dishLabel}
            onViewScene={handleView}
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
    <div className="flex flex-col w-full p-3 gap-3 lg:h-full lg:overflow-hidden">

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
                return <ClipCard key={clip.index} clip={clip} posterUrl={posterUrl} onRedo={onRegenerate} />;
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
              <SceneCard key={scene.index} scene={scene} dishLabel={dishLabel} isActive={scene.index === activeIndex} onView={handleView} onRedo={onRegenerate} />
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
