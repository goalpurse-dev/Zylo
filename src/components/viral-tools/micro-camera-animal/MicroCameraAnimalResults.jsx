import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles, RotateCcw, Download, Share2, X, Maximize2 } from "lucide-react";
import { saveMediaToDevice } from "../../../lib/downloadMedia";

async function downloadFile(url, filename) {
  return saveMediaToDevice({ url, filename, title: "Micro Camera scene" });
}

/* ── Lightbox viewer ── */
function Viewer({ scene, index, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const url     = scene.videoUrl || scene.imageUrl;
  const isVideo = !!scene.videoUrl;
  const filename = `micro-camera-scene-${index + 1}.${isVideo ? "mp4" : "jpg"}`;

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

  const handleShare = async () => {
    try { await navigator.share({ title: `Micro Camera — Scene ${index + 1}`, url }); } catch {}
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <span className="text-white/50 text-sm truncate max-w-[70%]">Scene {index + 1}</span>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video src={scene.videoUrl} controls autoPlay playsInline preload="none" className="max-w-full max-h-full rounded-2xl object-contain" style={{ maxHeight: "calc(100dvh - 160px)" }} />
        ) : (
          <img src={scene.imageUrl} alt="" className="max-w-full max-h-full rounded-2xl object-contain" style={{ maxHeight: "calc(100dvh - 160px)" }} />
        )}
      </div>
      <div className="shrink-0 flex items-center justify-center gap-3 px-5 py-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#7A3BFF] hover:bg-[#6a30e0] text-white font-semibold text-sm transition active:scale-95 disabled:opacity-60 shadow-[0_0_20px_rgba(122,59,255,0.4)]"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {downloading ? "Downloading…" : "Download"}
        </button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button onClick={handleShare} className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition active:scale-95">
            <Share2 className="w-4 h-4" />
            Share
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

const DEMO_VIDEOS = [
  "/viral-builder/micro-camera/video.mp4",
  "/viral-builder/micro-camera/video2.mp4",
];
const BG_THUMB = "/viral-builder/micro-camera/preview1.png";

const FEATURES = [
  { icon: "📷", label: "Micro POV Camera" },
  { icon: "🐜", label: "Any Small Animal" },
  { icon: "🕳️", label: "Goes Underground" },
  { icon: "⚡", label: "Auto-Generated" },
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
  const [viewerOpen, setViewerOpen] = useState(false);
  const thumbUrl = scene.imageUrl || scene.thumbnailUrl;
  const handleClick = () => { if (onSelect) { onSelect(); return; } setViewerOpen(true); };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="group relative aspect-[9/16] overflow-hidden rounded-xl bg-black ring-1 ring-white/10 transition hover:ring-[#A87AFF]/70"
      >
        {thumbUrl && <img src={thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />}
        <div className="absolute inset-0 bg-black/20 transition group-hover:bg-black/0" />
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[9px] font-bold text-white/70">
          Preview
        </span>
      </button>
      {viewerOpen && <Viewer scene={scene} index={0} onClose={() => setViewerOpen(false)} />}
    </>
  );
}

function RecentCreationsPanel({ recentGenerations = [], onOpenRecent }) {
  const latest = recentGenerations[0];

  return (
    <div className="relative flex min-w-0 flex-1 flex-col rounded-2xl border border-white/[0.08] bg-[#111315]/95 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] h-full">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-white text-[14px] font-black leading-tight">Recent Creations</p>
          <p className="mt-1 text-white/35 text-[11px]">
            {latest
              ? `${latest.animalLabel ?? "animal"} · ${timeAgo(latest.createdAt)}`
              : "Your saved bodycam videos"}
          </p>
        </div>
        <span className="rounded-full border border-[#7A3BFF]/30 bg-[#7A3BFF]/15 px-2.5 py-1 text-[10px] font-bold text-[#C4A3FF]">
          Latest
        </span>
      </div>

      {recentGenerations.length > 0 ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent]">
          {recentGenerations.slice(0, 5).map((gen, genIndex) => {
            const scenes = (gen.scenes || []).filter((s) => s.videoUrl || s.imageUrl);
            const thumbs = scenes.slice(0, 3);
            return (
              <div
                key={gen.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenRecent?.(gen)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenRecent?.(gen); } }}
                className="cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 transition hover:border-[#A87AFF]/50 hover:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-[#A87AFF]/60"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black text-white capitalize">
                      {gen.animalLabel ?? `Bodycam Video ${genIndex + 1}`}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold text-white/35">
                      {scenes.length} scenes · {timeAgo(gen.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-bold text-white/45">
                    {thumbs.some((s) => s.videoUrl) ? "Video" : "Images"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {thumbs.map((scene, i) => (
                    <RecentThumb key={`${gen.id}-${scene.index ?? i}`} scene={scene} onSelect={() => onOpenRecent?.(gen)} />
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
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
          <p className="text-[12px] font-semibold text-white/35">Generate once and your recent bodycam videos will show here.</p>
        </div>
      )}
    </div>
  );
}

/* ── Phase label ── */
function PhaseLabel({ phase, animalLabel, viewingRecent }) {
  const map = {
    images:   { text: `Generating ${animalLabel ? animalLabel + " " : ""}scenes…`, color: "text-[#A87AFF]"   },
    retrying: { text: "Provider busy — retrying…",                                 color: "text-amber-400"   },
    videos:   { text: "Animating bodycam videos…",                                 color: "text-emerald-400" },
    done:     { text: viewingRecent ? "Done" : "All done!",                        color: "text-emerald-400" },
    error:    { text: "Something went wrong",                                       color: "text-red-400"    },
  };
  const { text, color } = map[phase] ?? map.images;
  return <span className={`text-[13px] font-semibold ${color}`}>{text}</span>;
}

/* ── Single scene result card — identical logic to Face ASMR ── */
function SceneCard({ scene, index }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [pct, setPct] = useState(0);
  const imgDone   = scene.imageStatus === "succeeded";
  const vidDone   = scene.videoStatus === "succeeded";
  const imgFailed = scene.imageStatus === "failed";
  const isLoading = !imgDone && !imgFailed;
  const isReady   = imgDone || vidDone;

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
      className="relative isolate group rounded-2xl overflow-hidden bg-[#0d0f11] border border-white/[0.08] shadow-[0_8px_40px_rgba(0,0,0,0.6)] w-full aspect-[9/16]"
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
          <div className="absolute inset-0 bg-gradient-to-br from-[#7A3BFF]/15 via-[#0d0f11] to-[#A855F7]/10" />
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "linear", repeatDelay: 0.4 }}
            className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent -skew-x-12"
          />
        </div>
      )}

      {imgFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#160808]">
          <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
            <span className="text-red-400 text-xl">✕</span>
          </div>
          <span className="text-red-400 text-[14px] font-semibold">Failed</span>
          <span className="text-white/30 text-[12px] text-center px-6 leading-relaxed">Try again</span>
        </div>
      )}

      {!vidDone && !imgFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 pointer-events-none">
          {!imgDone ? (
            <>
              <div className="relative flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-[#7A3BFF]/70 animate-spin" />
              </div>
              <span className="text-white font-black text-[22px] tabular-nums leading-none">{Math.round(pct)}%</span>
              <span className={`text-[11px] font-medium ${scene.imageStatus === "retrying" ? "text-amber-400/80" : "text-white/35"}`}>
                {scene.imageStatus === "retrying" ? "Provider busy — retrying…" : "Generating image…"}
              </span>
            </>
          ) : (
            <>
              <div className="bg-black/65 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-2 shadow-lg">
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                <span className="text-white/80 text-[12px] font-semibold">Making video…</span>
              </div>
              <span className="text-white font-black text-[22px] tabular-nums leading-none">{Math.round(pct)}%</span>
            </>
          )}
        </div>
      )}

      {isReady && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setViewerOpen(true); }}
          className="absolute right-2.5 top-2.5 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md transition hover:bg-[#7A3BFF] hover:ring-[#A87AFF]/70 active:scale-95"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      )}

      {isReady && (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/0 hover:bg-black/40 transition-all duration-200 opacity-0 hover:opacity-100 group-hover:opacity-100 cursor-pointer"
          onClick={() => setViewerOpen(true)}
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm text-white text-xs font-medium">
            <Maximize2 className="w-3.5 h-3.5" />
            {vidDone ? "Watch" : "View"}
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2 px-2.5 py-2.5 bg-gradient-to-t from-black/85 to-transparent">
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
          vidDone ? "bg-emerald-500 text-white" : imgDone ? "bg-[#7A3BFF]/80 text-white" : "bg-black/60 text-white/60"
        }`}>
          {vidDone ? "✓ Ready" : `${Math.round(pct)}%`}
        </span>
        {isReady && (
          <button
            onClick={(e) => { e.stopPropagation(); downloadFile(vidDone ? scene.videoUrl : scene.imageUrl, `micro-camera-scene-${index + 1}.${vidDone ? "mp4" : "jpg"}`); }}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-[#7A3BFF] hover:bg-[#6a30e0] text-white transition active:scale-95"
          >
            <Download className="w-3 h-3" />
            <span className="text-[10px] font-semibold">{vidDone ? "Video" : "Img"}</span>
          </button>
        )}
      </div>

      {isReady && <div className="absolute inset-0 z-20 cursor-pointer" onClick={() => setViewerOpen(true)} />}
      {viewerOpen && <Viewer scene={scene} index={index} onClose={() => setViewerOpen(false)} />}
    </motion.div>
  );
}

/* ── Main results component ── */
export default function MicroCameraAnimalResults({
  phase, jobScenes, animalLabel, error, user,
  recentGenerations = [], viewingRecent = false,
  onOpenRecent, onRequestAuth, onReset,
}) {
  const hasRecent = recentGenerations.length > 0;

  /* ══ ACTIVE GENERATION ══ */
  if (phase !== "idle") {
    const totalImages = jobScenes.length;
    const doneImages  = jobScenes.filter((s) => s.imageStatus === "succeeded").length;
    const doneVideos  = jobScenes.filter((s) => s.videoStatus === "succeeded").length;
    const cols        = Math.min(jobScenes.length, 3);

    return (
      <div className="flex flex-col w-full p-3 gap-3 lg:h-full lg:overflow-hidden">

        {/* Status bar */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#111315] border border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            {phase !== "done" && phase !== "error" && (
              <Loader2 className="w-4 h-4 text-[#A87AFF] animate-spin shrink-0" />
            )}
            <PhaseLabel phase={phase} animalLabel={animalLabel} viewingRecent={viewingRecent} />
          </div>
          <div className="flex items-center gap-3">
            {phase === "images" && <span className="text-white/35 text-[12px]">{doneImages}/{totalImages} images</span>}
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
          <div
            className="grid grid-cols-2 content-start justify-items-stretch gap-x-3.5 gap-y-4 px-3 pb-[140px] lg:pb-6 lg:gap-3 lg:px-0 lg:[grid-template-columns:repeat(var(--mc-cols),minmax(0,min(100%,280px)))]"
            style={{ "--mc-cols": cols }}
          >
            {jobScenes.map((scene, i) => (
              <SceneCard key={i} scene={scene} index={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ══ IDLE ══ */
  return (
    <div className="relative flex flex-col min-h-[500px] rounded-2xl overflow-hidden lg:h-full">
      <img src={BG_THUMB} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-25 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D0F]/70 via-[#0B0D0F]/40 to-[#0B0D0F]/85 pointer-events-none" />

      {/* Mobile: full-screen recent panel when has recents */}
      {hasRecent && (
        <div className="relative z-10 block h-full p-3 lg:hidden">
          <RecentCreationsPanel recentGenerations={recentGenerations} onOpenRecent={onOpenRecent} />
        </div>
      )}

      {/* Hero — always on desktop, only on mobile if no recents */}
      <div className={`relative z-10 flex flex-col h-full p-6 lg:p-8 gap-5 ${hasRecent ? "hidden lg:flex" : "flex"}`}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-[#A87AFF]" />
            <span className="text-[#A87AFF] text-[12px] font-bold tracking-widest uppercase">Micro Camera</span>
          </div>
          <h2 className="text-white font-black text-[26px] lg:text-[32px] leading-tight tracking-tight">
            Animal Bodycam<br />
            <span className="bg-gradient-to-r from-white via-purple-100 to-purple-400 bg-clip-text text-transparent">
              Goes Underground
            </span>
          </h2>
          <p className="text-white/55 text-[14px] mt-2.5 leading-relaxed max-w-[460px]">
            Type any small animal. AI mounts a micro-camera on its back, builds a consistent reference, then generates cinematic POV bodycam scenes as it descends underground.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {FEATURES.map((f) => (
            <span key={f.label} className="inline-flex h-7 items-center gap-1.5 rounded-[32px] border border-[rgba(214,225,255,0.08)] bg-white/[0.06] px-3 text-[#b0b4ba] text-[11.89px] font-medium leading-[19px] tracking-[-0.08px] shadow-[inset_0_0_7.1px_rgba(255,255,255,0.21)]">
              <span>{f.icon}</span>{f.label}
            </span>
          ))}
        </div>

        {/* Demo video(s) + recent panel — same pattern as Face ASMR */}
        <div className="flex items-stretch gap-3 flex-1 min-h-0" style={{ minHeight: "200px" }}>
          {(hasRecent ? DEMO_VIDEOS.slice(0, 1) : DEMO_VIDEOS).map((src, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.12 }}
              className="relative flex-1 min-w-0 rounded-2xl overflow-hidden aspect-[9/16] bg-black shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            >
              <video src={src} autoPlay muted loop playsInline preload="none" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
            </motion.div>
          ))}
          {hasRecent && <RecentCreationsPanel recentGenerations={recentGenerations} onOpenRecent={onOpenRecent} />}
        </div>

        {!user ? (
          <motion.button
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            onClick={onRequestAuth}
            className="w-full py-4 rounded-xl font-black text-white text-[16px] tracking-tight hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #7A3BFF 0%, #9F5CFF 50%, #C084FC 100%)" }}
          >
            ✦ &nbsp; Sign up to create for FREE
          </motion.button>
        ) : (
          <p className="text-center text-white/30 text-[12px]">Type your animal on the left and hit Generate</p>
        )}
      </div>
    </div>
  );
}
