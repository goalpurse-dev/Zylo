import { useState, useCallback } from "react";
import { Download, X, ChevronLeft, ChevronRight, AlertCircle, UtensilsCrossed } from "lucide-react";
import { SCENE_LABELS, VIBES } from "./api/cookingMaticApi";

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
function SceneCard({ scene, dishLabel, isActive, onView }) {
  const { index, imageStatus, imageUrl } = scene;
  const isLoading = imageStatus === "queued" || imageStatus === "running";
  const isFailed  = imageStatus === "failed";
  const isDone    = imageStatus === "succeeded";

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border transition-all duration-500 ${
        isActive
          ? "border-orange-500/50 shadow-lg shadow-orange-900/20"
          : isDone
          ? "border-white/10"
          : "border-white/[0.06]"
      } bg-[#111315]`}
    >
      {/* Image area */}
      <div className="relative aspect-[3/4] bg-[#0c0e10]">
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
                  <div className="w-6 h-6 border-2 border-orange-500/40 border-t-orange-400 rounded-full animate-spin" />
                  <p className="text-white/25 text-[11px] font-medium">Generating…</p>
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

        {/* Download on hover */}
        {isDone && imageUrl && (
          <button
            onClick={(e) => { e.stopPropagation(); downloadImage(imageUrl, `cooking-scene-${index + 1}.jpg`); }}
            className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-black/70 backdrop-blur-md text-white text-[10px] font-semibold px-2 py-1 rounded-full hover:bg-black/90 transition"
          >
            <Download className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Label footer */}
      <div className="px-3 py-2 border-t border-white/[0.05]">
        <p className="text-white/50 text-[11px] font-bold truncate">{SCENE_LABELS[index]}</p>
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
                <div className="flex items-center gap-2 mt-0.5">
                  {vibe && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: vibe.accent + "22", color: vibe.accent }}>
                      {vibe.label}
                    </span>
                  )}
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
  phase,
  scenes,
  dishLabel,
  error = null,
  recentGenerations = [],
  onLoadRecent,
}) {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const doneScenes   = scenes.filter((s) => s.imageStatus === "succeeded");
  const activeIndex  = scenes.findIndex((s) => s.imageStatus === "queued" || s.imageStatus === "running");
  const isGenerating = phase === "images";
  const isDone       = phase === "done";
  const progress     = doneScenes.length;

  const handleView = useCallback((index) => setLightboxIndex(index), []);

  // ── IDLE state ──
  if (phase === "idle" && scenes.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#0D0F11] rounded-2xl border border-white/[0.06] overflow-y-auto p-6">
        {/* Hero */}
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8 min-h-[300px]">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500/20 to-red-600/10 border border-orange-500/20 flex items-center justify-center mb-5 shadow-xl shadow-orange-900/20">
            <UtensilsCrossed className="w-9 h-9 text-orange-300" />
          </div>
          <h2 className="text-white text-2xl font-black mb-2">
            AI Cooking Matic
          </h2>
          <p className="text-white/40 text-[14px] max-w-xs leading-relaxed mb-6">
            Type a dish name and watch AI generate 10 cinematic cooking scenes — with consistent lighting, character, and color throughout.
          </p>
          <div className="grid grid-cols-2 gap-2 text-left w-full max-w-xs">
            {[
              ["🎬", "10 chained scenes"],
              ["🎨", "Locked visual style"],
              ["👨‍🍳", "3D chef character"],
              ["📸", "8K food photography"],
            ].map(([icon, label]) => (
              <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <span className="text-base">{icon}</span>
                <span className="text-white/50 text-[12px] font-semibold">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <RecentPanel generations={recentGenerations} onLoad={onLoadRecent} />
      </div>
    );
  }

  // ── ACTIVE / DONE state ──
  return (
    <>
    <div className="flex flex-col h-full bg-[#0D0F11] rounded-2xl border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-5 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-white font-black text-[16px] truncate">
              {dishLabel || "Cooking Story"}
            </h3>
            <p className="text-white/40 text-[12px] mt-0.5">
              {isDone ? `${doneScenes.length} scenes complete` : `Scene ${Math.min(progress + 1, 10)} / 10`}
            </p>
          </div>
          {isDone && doneScenes.length > 0 && (
            <button
              onClick={() => {
                doneScenes.forEach((s, i) => {
                  setTimeout(() => downloadImage(s.imageUrl, `cooking-${dishLabel.toLowerCase().replace(/\s+/g, "-")}-scene-${s.index + 1}.jpg`), i * 300);
                });
              }}
              className="flex items-center gap-1.5 text-white/60 hover:text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] transition shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Save All
            </button>
          )}
        </div>

        {/* Progress bar */}
        {isGenerating && (
          <div className="mt-3 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-700"
              style={{ width: `${(progress / 10) * 100}%` }}
            />
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-red-300 text-[12px] font-semibold">{error}</p>
          </div>
        )}
      </div>

      {/* Scene grid */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:thin] px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.index}
              scene={scene}
              dishLabel={dishLabel}
              isActive={scene.index === activeIndex}
              onView={handleView}
            />
          ))}
        </div>

        {isDone && <RecentPanel generations={recentGenerations} onLoad={onLoadRecent} />}
      </div>
    </div>

    {/* Lightbox */}
    {lightboxIndex !== null && (
      <Lightbox
        scenes={scenes.filter((s) => s.imageUrl)}
        startIndex={scenes.filter((s) => s.imageUrl).findIndex((s) => s.index === lightboxIndex)}
        onClose={() => setLightboxIndex(null)}
      />
    )}
    </>
  );
}
