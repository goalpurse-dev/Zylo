import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles, RotateCcw, Download, Share2, X, Maximize2, Wand2 } from "lucide-react";
import useFootballerStitchEditor from "./videoEditor/useFootballerStitchEditor";
import { saveMediaToDevice } from "../../../lib/downloadMedia";
// Trim/reorder timeline editor is paused for now — FootballerStitchTimeline.jsx
// is still there, just not wired into FinalVideoPanel until this comes back.

async function downloadFile(url, filename) {
  return saveMediaToDevice({ url, filename, title: "Nationality Swap scene" });
}

/* ── Lightbox viewer ── */
function Viewer({ scene, index, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const url      = scene.videoUrl || scene.imageUrl;
  const isVideo  = !!scene.videoUrl;
  const filename = `nationality-swap-scene-${index + 1}.${isVideo ? "mp4" : "jpg"}`;

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleDownload = async () => {
    setDownloading(true);
    await downloadFile(url, filename);
    setDownloading(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <span className="text-white/50 text-sm truncate">
            Scene {index + 1}{scene.localizedName ? ` — ${scene.localizedName}` : ""}
          </span>
          {scene.nationality && <span className="text-white/30 text-sm"> · {scene.nationality}</span>}
        </div>
        <button onClick={onClose} className="ml-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video
            src={scene.videoUrl} controls autoPlay playsInline preload="auto" poster={scene.imageUrl || undefined}
            className="max-w-full max-h-full rounded-2xl object-contain" style={{ maxHeight: "calc(100dvh - 160px)" }}
          />
        ) : (
          <img src={scene.imageUrl} alt="" className="max-w-full max-h-full rounded-2xl object-contain" style={{ maxHeight: "calc(100dvh - 160px)" }} />
        )}
      </div>
      <div className="shrink-0 flex items-center justify-center gap-3 px-5 py-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#F59E0B] hover:bg-[#d98a09] text-black font-semibold text-sm transition active:scale-95 disabled:opacity-60 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {downloading ? "Downloading…" : "Download"}
        </button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            onClick={async () => { try { await navigator.share({ title: `Nationality Swap — Scene ${index + 1}`, url }); } catch {} }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition active:scale-95"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

const FEATURES = [
  { icon: "🌍", label: "Any Nation" },
  { icon: "🎽", label: "Local Jersey" },
  { icon: "🗣️", label: "Local Language" },
  { icon: "🎬", label: "Talking Intro" },
];

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function RecentThumb({ scene, onSelect }) {
  const [hovering, setHovering] = useState(false);
  const videoRef = useRef(null);
  const thumbUrl = scene.imageUrl || scene.thumbnailUrl;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hovering) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [hovering]);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      className="group relative aspect-[9/16] overflow-hidden rounded-xl bg-black ring-1 ring-white/10 transition hover:ring-[#FBBF24]/70"
    >
      {thumbUrl && <img src={thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />}
      {scene.videoUrl && (
        <video
          ref={videoRef}
          src={scene.videoUrl}
          muted
          loop
          playsInline
          preload="metadata"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${hovering ? "opacity-100" : "opacity-0"}`}
        />
      )}
      <div className="absolute inset-0 bg-black/20 transition group-hover:bg-black/0" />
    </button>
  );
}

function RecentCreationsPanel({ recentGenerations = [], onOpenRecent }) {
  const latest = recentGenerations[0];
  return (
    <div className="relative flex min-w-0 flex-1 flex-col rounded-2xl border border-white/[0.08] bg-[#111315]/95 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] h-full">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-white text-[14px] font-black leading-tight">Recent Swaps</p>
          <p className="mt-1 text-white/35 text-[11px]">
            {latest ? timeAgo(latest.createdAt) : "Your saved nationality swaps"}
          </p>
        </div>
        <span className="rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/15 px-2.5 py-1 text-[10px] font-bold text-[#FBBF24]">
          Latest
        </span>
      </div>

      {recentGenerations.length > 0 ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent]">
          {recentGenerations.slice(0, 5).map((gen, genIndex) => {
            const scenes = (gen.scenes || []).filter((s) => s.videoUrl || s.imageUrl);
            const thumbs = scenes.slice(0, 3);
            const label  = scenes[0]?.footballer ? `${scenes[0].footballer} → ${scenes[0].nationality}` : `Swap ${genIndex + 1}`;
            return (
              <div
                key={gen.id}
                role="button" tabIndex={0}
                onClick={() => onOpenRecent?.(gen)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenRecent?.(gen); } }}
                className="cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 transition hover:border-[#FBBF24]/50 hover:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-[#FBBF24]/60"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black text-white">{label}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-white/35">
                      {scenes.length} scenes · {timeAgo(gen.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {thumbs.map((scene, i) => (
                    <RecentThumb key={`${gen.id}-${i}`} scene={scene} onSelect={() => onOpenRecent?.(gen)} />
                  ))}
                  {Array.from({ length: Math.max(0, 3 - thumbs.length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-[9/16] rounded-xl border border-dashed border-white/10 bg-white/[0.025]" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
          <p className="text-[12px] font-semibold text-white/35">Generate once and your swap videos appear here.</p>
        </div>
      )}
    </div>
  );
}

/* ── Scene card ── */
function SceneCard({ scene, index, onRetry }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [pct, setPct] = useState(0);
  const imgDone   = scene.imageStatus === "succeeded";
  const vidDone   = scene.videoStatus === "succeeded";
  const imgFailed = scene.imageStatus === "failed";
  const vidFailed = scene.videoStatus === "failed";
  const isLoading = !imgDone && !imgFailed;

  useEffect(() => {
    if (vidDone)   { setPct(100); return; }
    if (imgFailed) { return; }
    const target = imgDone ? 92 : 44;
    const id = setInterval(() => {
      setPct((prev) => {
        if (prev >= target) { clearInterval(id); return prev; }
        return Math.min(prev + (target - prev) * 0.07 + Math.random() * 1.5, target);
      });
    }, 280);
    return () => clearInterval(id);
  }, [imgDone, vidDone, imgFailed]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative group rounded-2xl overflow-hidden bg-[#0d0f11] border border-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.6)] w-full aspect-[9/16]"
    >

      {imgDone && scene.imageUrl && (
        <motion.img
          initial={{ opacity: 0 }} animate={{ opacity: vidDone ? 0 : 1 }} transition={{ duration: 0.5 }}
          src={scene.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {vidDone && scene.videoUrl && (
        <motion.video
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
          src={scene.videoUrl} autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover z-10"
        />
      )}

      {isLoading && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F59E0B]/15 via-[#0d0f11] to-[#FBBF24]/10" />
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "linear", repeatDelay: 0.4 }}
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent -skew-x-12"
          />
        </div>
      )}

      {imgFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#160808] px-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
            <span className="text-red-400 text-xl">✕</span>
          </div>
          <span className="text-red-400 text-[14px] font-semibold">{scene.imageError || "Failed"}</span>
        </div>
      )}

      {!vidDone && !imgFailed && !vidFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 pointer-events-none">
          {!imgDone ? (
            <>
              <Loader2 className="w-10 h-10 text-[#F59E0B]/70 animate-spin" />
              <span className="text-white font-black text-[22px] tabular-nums leading-none">{Math.round(pct)}%</span>
              <span className={`text-[11px] font-medium ${scene.imageStatus === "retrying" ? "text-amber-400/80" : "text-white/35"}`}>
                {scene.imageStatus === "retrying" ? "Provider busy — retrying…" : "Generating player…"}
              </span>
            </>
          ) : (
            <>
              <div className="bg-black/65 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="text-white/80 text-[12px] font-semibold">Animating intro…</span>
              </div>
              <span className="text-white font-black text-[22px] tabular-nums leading-none">{Math.round(pct)}%</span>
            </>
          )}
        </div>
      )}

      {/* Failed states — show retry button */}
      {(vidFailed || imgFailed) && (
        <div className="absolute inset-0 flex flex-col items-end justify-end p-3 z-30">
          <button
            onClick={(e) => { e.stopPropagation(); onRetry?.(); }}
            className="flex items-center gap-1.5 rounded-xl bg-[#F59E0B] hover:bg-[#d98a09] px-3 py-2 text-[11px] font-bold text-black shadow-lg active:scale-95 transition"
          >
            <RotateCcw className="w-3 h-3" />
            {imgFailed ? "Retry scene" : "Retry video"}
          </button>
          {vidFailed && imgDone && (
            <span className="mt-1.5 rounded-full bg-black/60 px-2.5 py-0.5 text-[9px] font-semibold text-amber-400">
              {scene.videoError || "Video timed out — image saved"}
            </span>
          )}
        </div>
      )}

      {(imgDone || vidDone) && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setViewerOpen(true); }}
            className="absolute right-2.5 top-9 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md transition hover:bg-[#F59E0B] hover:ring-[#FBBF24]/70 active:scale-95"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {(scene.localizedName || scene.jerseyNumber) && (
            <div className="absolute left-2.5 top-2.5 z-30 max-w-[75%] rounded-lg bg-black/65 backdrop-blur-md px-2 py-1">
              <p className="truncate text-[11px] font-bold text-white leading-tight">{scene.localizedName}</p>
              {scene.jerseyNumber && <p className="text-[9px] font-semibold text-[#FBBF24] leading-tight">#{scene.jerseyNumber} · {scene.nationality}</p>}
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2 px-2.5 py-2.5 bg-gradient-to-t from-black/85 to-transparent">
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
              vidDone ? "bg-emerald-500 text-white" : imgDone ? "bg-[#F59E0B]/80 text-black" : "bg-black/60 text-white/60"
            }`}>
              {vidDone ? "✓ Ready" : `${Math.round(pct)}%`}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); downloadFile(vidDone ? scene.videoUrl : scene.imageUrl, `nationality-swap-scene-${index + 1}.${vidDone ? "mp4" : "jpg"}`); }}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F59E0B] hover:bg-[#d98a09] text-black transition active:scale-95"
            >
              <Download className="w-3 h-3" />
              <span className="text-[10px] font-semibold">{vidDone ? "Video" : "Img"}</span>
            </button>
          </div>
          <div className="absolute inset-0 z-20 cursor-pointer" onClick={() => setViewerOpen(true)} />
        </>
      )}

      {viewerOpen && <Viewer scene={scene} index={index} onClose={() => setViewerOpen(false)} />}
    </motion.div>
  );
}

/* ── Final stitched video ──
   Edit (trim/reorder timeline) is disabled for now — paused mid-build, will
   come back later. This just shows the auto-stitched result + a retry
   button if the render itself failed. */
function FinalVideoPanel({ sceneClips, generationId, existingFullVideoUrl, onSaved }) {
  const {
    finalUrl, stitching, progress, renderError,
    saving, saveError, saved,
    render, dirty,
  } = useFootballerStitchEditor(sceneClips, { generationId, existingFullVideoUrl, onSaved });

  if (!sceneClips.length) return null;

  return (
    <div className="shrink-0 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#0d0f11] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[12px] font-black uppercase tracking-widest text-[#FBBF24]">Full Swap Video</p>
          {finalUrl && !stitching && !renderError && (
            <span className="shrink-0 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#FBBF24]">
              🔥 Viral Ready
            </span>
          )}
        </div>

        {finalUrl && !stitching && (
          <button
            onClick={() => downloadFile(finalUrl, "nationality-swap-full.mp4")}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/70 hover:text-white transition"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Hero video ── */}
      <div className="relative mx-auto w-full max-w-[260px] aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-white/[0.08]">
        {finalUrl && (
          <video
            src={finalUrl}
            controls
            playsInline
            preload="auto"
            className="nationality-swap-final-video absolute inset-0 w-full h-full bg-black object-contain"
          />
        )}
        {stitching && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/70 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 text-[#FBBF24] animate-spin" />
            <span className="text-white font-black text-[18px] tabular-nums">{progress}%</span>
            <span className="text-white/50 text-[11px] font-medium">Rendering final video…</span>
          </div>
        )}
        {!finalUrl && !stitching && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
            {renderError ? (
              <span className="text-red-400 text-[12px]">{renderError}</span>
            ) : (
              <span className="text-white/30 text-[12px]">Preview appears here</span>
            )}
          </div>
        )}
      </div>

      {!renderError && finalUrl && (
        <div className="flex items-center justify-center gap-1.5 text-[11px]">
          {saving && (
            <span className="flex items-center gap-1.5 text-white/35">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving to your account…
            </span>
          )}
          {!saving && saved && (
            <span className="text-emerald-400/80">✓ Saved — ready to publish</span>
          )}
          {!saving && saveError && (
            <span className="text-amber-400/80">{saveError}</span>
          )}
        </div>
      )}

      {renderError && (
        <button
          onClick={render}
          disabled={!dirty || stitching}
          className="flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-black transition active:scale-[0.98] bg-[#F59E0B] text-black shadow-[0_0_24px_rgba(245,158,11,0.5)] hover:bg-[#d98a09] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {stitching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {stitching ? "Rendering…" : "Retry"}
        </button>
      )}
    </div>
  );
}

/* ── Main ── */
export default function FootballerNationalitySwapResults({
  phase, jobScenes, error, user,
  recentGenerations = [], viewingRecent = false,
  onOpenRecent, onRequestAuth, onReset, onRetryScene,
  generationId = null, fullVideoUrl = null, onFullVideoSaved,
}) {
  const hasRecent = recentGenerations.length > 0;

  const sceneClips = useMemo(
    () =>
      phase === "done"
        ? jobScenes
            .filter((s) => s.videoStatus === "succeeded" && s.videoUrl)
            .map((s) => ({ sceneIndex: s.index, videoUrl: s.videoUrl }))
        : [],
    [phase, jobScenes]
  );

  /* ══ ACTIVE GENERATION ══ */
  if (phase !== "idle") {
    const totalImages = jobScenes.length;
    const doneImages  = jobScenes.filter((s) => s.imageStatus === "succeeded").length;
    const doneVideos  = jobScenes.filter((s) => s.videoStatus === "succeeded").length;
    const cols        = Math.min(jobScenes.length, 3);

    const phaseText = {
      images:   { text: "Generating players…",              color: "text-[#FBBF24]"   },
      videos:   { text: "Animating the intros…",             color: "text-emerald-400" },
      done:     { text: viewingRecent ? "Done" : "All done! 🎉", color: "text-emerald-400" },
      error:    { text: "Something went wrong",               color: "text-red-400"     },
    };
    const { text: statusText, color: statusColor } = phaseText[phase] ?? phaseText.images;

    return (
      <div className="flex flex-col w-full p-3 gap-3 lg:h-full lg:overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#111315] border border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            {phase !== "done" && phase !== "error" && (
              <Loader2 className="w-4 h-4 text-[#FBBF24] animate-spin shrink-0" />
            )}
            <span className={`text-[13px] font-semibold ${statusColor}`}>{statusText}</span>
          </div>
          <div className="flex items-center gap-3">
            {phase === "images" && <span className="text-white/35 text-[12px]">{doneImages}/{totalImages} scenes</span>}
            {phase === "videos" && <span className="text-white/35 text-[12px]">{doneVideos}/{totalImages} videos</span>}
            {(phase === "done" || phase === "error") && (
              <button onClick={onReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-white/60 hover:text-white text-[12px] font-semibold transition">
                {viewingRecent ? <ArrowLeft className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                {viewingRecent ? "Back" : "New"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="shrink-0 px-4 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-[13px]">{error}</p>
          </div>
        )}

        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <div className="flex flex-col gap-4 px-3 pb-[140px] lg:pb-6 lg:px-0">
            {phase === "done" && sceneClips.length > 0 && (
              <FinalVideoPanel
                sceneClips={sceneClips}
                generationId={generationId}
                existingFullVideoUrl={fullVideoUrl}
                onSaved={onFullVideoSaved}
              />
            )}

            <div
              className="grid grid-cols-2 content-start justify-items-stretch gap-x-3.5 gap-y-4 lg:gap-3 lg:[grid-template-columns:repeat(var(--fs-cols),minmax(0,min(100%,280px)))]"
              style={{ "--fs-cols": cols }}
            >
              {jobScenes.map((scene, i) => (
                <SceneCard key={i} scene={scene} index={i} onRetry={() => onRetryScene?.(i)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ══ IDLE ══ */
  return (
    <div className="relative flex flex-col min-h-[500px] rounded-2xl overflow-hidden lg:h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-[#F59E0B]/10 via-[#0B0D0F] to-[#FBBF24]/8 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.15),transparent_60%)] pointer-events-none" />

      {/* Mobile only: show recent panel fullscreen, no video */}
      {hasRecent && (
        <div className="relative z-10 lg:hidden p-3" style={{ minHeight: 420 }}>
          <RecentCreationsPanel recentGenerations={recentGenerations} onOpenRecent={onOpenRecent} />
        </div>
      )}

      <div className={`relative z-10 flex flex-col h-full p-6 lg:p-8 gap-4 ${hasRecent ? "hidden lg:flex" : "flex"}`}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-[#FBBF24]" />
            <span className="text-[#FBBF24] text-[12px] font-bold tracking-widest uppercase">Nationality Swap</span>
          </div>
          <h2 className="text-white font-black text-[24px] lg:text-[30px] leading-tight tracking-tight">
            Any Footballer,<br />
            <span className="bg-gradient-to-r from-white via-amber-100 to-amber-400 bg-clip-text text-transparent">
              Any Nation
            </span>
          </h2>
          {!hasRecent && (
            <p className="text-white/55 text-[13px] mt-2 leading-relaxed max-w-[460px]">
              Pick a footballer and a nationality. We invent a fictional alternate-universe player, give them a
              localized name, jersey number, and a media-day introduction spoken in the local language.
            </p>
          )}
        </div>

        {/* Traits — hidden on mobile, and hidden once there are recent generations so the video + recent-gen row can grow */}
        {!hasRecent && (
          <div className="hidden sm:flex flex-wrap gap-2">
            {FEATURES.map((f) => (
              <span key={f.label} className="inline-flex h-7 items-center gap-1.5 rounded-[32px] border border-[rgba(214,225,255,0.08)] bg-white/[0.06] px-3 text-[#b0b4ba] text-[11.89px] font-medium leading-[19px] tracking-[-0.08px] shadow-[inset_0_0_7.1px_rgba(255,255,255,0.21)]">
                <span>{f.icon}</span>{f.label}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-stretch gap-3 flex-1 min-h-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 }}
            className={`relative shrink-0 rounded-2xl overflow-hidden aspect-[9/16] bg-black shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${
              hasRecent ? "h-full" : "w-full max-w-[300px]"
            }`}
          >
            <video
              src="/template/nationality-swap/nationality-swap-full.mp4"
              autoPlay muted loop playsInline preload="auto"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
          </motion.div>

          {hasRecent && (
            <div className="flex-1 min-w-0">
              <RecentCreationsPanel recentGenerations={recentGenerations} onOpenRecent={onOpenRecent} />
            </div>
          )}
        </div>

        {!user ? (
          <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            onClick={onRequestAuth}
            className="w-full py-4 rounded-xl font-black text-black text-[16px] tracking-tight hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #FDE68A 100%)" }}
          >
            ✦ &nbsp; Sign up to create for FREE
          </motion.button>
        ) : (
          <p className="text-center text-white/30 text-[12px]">Set up your scenes on the left and hit Generate</p>
        )}
      </div>
    </div>
  );
}
