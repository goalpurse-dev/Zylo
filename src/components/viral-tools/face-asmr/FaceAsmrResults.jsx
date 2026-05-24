import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles, RotateCcw, Download, Share2, X, Maximize2 } from "lucide-react";

async function downloadFile(url, filename) {
  try {
    const res  = await fetch(url);
    const blob = await res.blob();
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank");
  }
}

/* ── Lightbox viewer (same pattern as VideoGenerator) ── */
function Viewer({ scene, index, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const url      = scene.videoUrl || scene.imageUrl;
  const isVideo  = !!scene.videoUrl;
  const filename = `face-asmr-scene-${index + 1}.${isVideo ? "mp4" : "jpg"}`;

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
    try {
      await navigator.share({ title: `Face ASMR — Scene ${index + 1}`, url });
    } catch {}
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col"
      onClick={onClose}
    >
      {/* top bar */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <span className="text-white/50 text-sm truncate max-w-[70%]">Scene {index + 1}</span>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* media */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video
            src={scene.videoUrl}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full rounded-2xl object-contain"
            style={{ maxHeight: "calc(100dvh - 160px)" }}
          />
        ) : (
          <img
            src={scene.imageUrl}
            alt=""
            className="max-w-full max-h-full rounded-2xl object-contain"
            style={{ maxHeight: "calc(100dvh - 160px)" }}
          />
        )}
      </div>

      {/* bottom actions */}
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
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

const DEMO_VIDEOS = ["/face/1.mp4", "/face/2.mp4"];
const BG_THUMB    = "/face/ronaldo.png";

const FEATURES = [
  { icon: "🎵", label: "Real ASMR Audio" },
  { icon: "🧊", label: "Tapping & Scratching" },
  { icon: "🤳", label: "Viral 9:16 Format" },
  { icon: "⚡", label: "Auto-Generated" },
];

/* ── Status label per phase ── */
function PhaseLabel({ phase, viewingRecent = false }) {
  const map = {
    images: { text: "Generating images…",   color: "text-[#A87AFF]" },
    videos: { text: "Creating ASMR videos…", color: "text-emerald-400" },
    done:   { text: viewingRecent ? "Done" : "All done!", color: "text-emerald-400" },
    error:  { text: "Something went wrong",   color: "text-red-400"    },
  };
  const { text, color } = map[phase] ?? map.images;
  return <span className={`text-[13px] font-semibold ${color}`}>{text}</span>;
}

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";

  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function RecentThumb({ scene, index, onSelect }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const isVideo = !!scene.videoUrl;
  const thumbUrl = scene.imageUrl || scene.videoPosterUrl || scene.thumbnailUrl;
  const handleClick = () => {
    if (onSelect) {
      onSelect();
      return;
    }
    setViewerOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="group relative aspect-[9/16] overflow-hidden rounded-xl bg-black ring-1 ring-white/10 transition hover:ring-[#A87AFF]/70"
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : null}
        <div className="absolute inset-0 bg-black/20 transition group-hover:bg-black/0" />
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[9px] font-bold text-white/70">
          Preview
        </span>
      </button>
      {viewerOpen && <Viewer scene={scene} index={index} onClose={() => setViewerOpen(false)} />}
    </>
  );
}

function RecentCreationsPanel({ recentGenerations = [], mobile = false, onOpenRecent }) {
  const latest = recentGenerations[0];

  return (
    <div className={`relative flex min-w-0 flex-1 flex-col rounded-2xl border border-white/[0.08] bg-[#111315]/95 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${mobile ? "h-full" : "h-full"}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-white text-[14px] font-black leading-tight">Recent Creations</p>
          <p className="mt-1 text-white/35 text-[11px]">
            {latest ? `${latest.scenes?.length ?? 0} scenes · ${timeAgo(latest.createdAt)}` : "Saved ASMR results"}
          </p>
        </div>
        <span className="rounded-full border border-[#7A3BFF]/30 bg-[#7A3BFF]/15 px-2.5 py-1 text-[10px] font-bold text-[#C4A3FF]">
          Latest
        </span>
      </div>

      {recentGenerations.length > 0 ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent]">
          {recentGenerations.slice(0, 5).map((gen, genIndex) => {
            const scenes = (gen.scenes || []).filter((scene) => scene.videoUrl || scene.imageUrl);
            const thumbs = scenes.slice(0, 3);
            return (
              <div
                key={gen.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenRecent?.(gen)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenRecent?.(gen);
                  }
                }}
                className="cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 transition hover:border-[#A87AFF]/50 hover:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-[#A87AFF]/60"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black text-white">Viral Video {genIndex + 1}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-white/35">
                      {scenes.length} scenes · {timeAgo(gen.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-bold text-white/45">
                    {thumbs.some((scene) => scene.videoUrl) ? "Video" : "Images"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {thumbs.map((scene, i) => (
                    <RecentThumb key={`${gen.id}-${scene.index}-${i}`} scene={scene} index={i} onSelect={() => onOpenRecent?.(gen)} />
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
          <p className="text-[12px] font-semibold text-white/35">Generate once and your recent ASMR clips will show here.</p>
        </div>
      )}
    </div>
  );
}

/* ── Single scene result card ── */
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
      setPct(prev => {
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
      {/* image base */}
      {imgDone && scene.imageUrl && (
        <motion.img
          initial={{ opacity: 0 }} animate={{ opacity: vidDone ? 0 : 1 }} transition={{ duration: 0.5 }}
          src={scene.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* video on top */}
      {vidDone && scene.videoUrl && (
        <motion.video
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
          src={scene.videoUrl} autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover z-10"
        />
      )}

      {/* shimmer */}
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

      {/* failed */}
      {imgFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#160808]">
          <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
            <span className="text-red-400 text-xl">✕</span>
          </div>
          <span className="text-red-400 text-[14px] font-semibold">Failed</span>
          <span className="text-white/30 text-[12px] text-center px-6 leading-relaxed">Try a different description</span>
        </div>
      )}

      {/* center spinner */}
      {!vidDone && !imgFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 pointer-events-none">
          {!imgDone ? (
            <>
              <div className="relative flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-[#7A3BFF]/70 animate-spin" />
              </div>
              <span className="text-white font-black text-[22px] tabular-nums leading-none">{Math.round(pct)}%</span>
              <span className="text-white/35 text-[11px] font-medium">Generating image…</span>
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
          title={vidDone ? "Open video fullscreen" : "Open image fullscreen"}
          onClick={(e) => {
            e.stopPropagation();
            setViewerOpen(true);
          }}
          className="absolute right-2.5 top-2.5 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-md transition hover:bg-[#7A3BFF] hover:ring-[#A87AFF]/70 active:scale-95"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      )}

      {/* hover overlay — expand + download buttons (same as VideoGenerator) */}
      {isReady && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/0 hover:bg-black/40 transition-all duration-200 opacity-0 hover:opacity-100 group-hover:opacity-100 cursor-pointer"
          onClick={() => setViewerOpen(true)}
        >
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm text-white text-xs font-medium">
            <Maximize2 className="w-3.5 h-3.5" />
            {vidDone ? "Watch" : "View"}
          </div>
        </div>
      )}

      {/* bottom strip — label + download */}
      <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-2 px-2.5 py-2.5 bg-gradient-to-t from-black/85 to-transparent">
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${vidDone ? "bg-emerald-500 text-white" : imgDone ? "bg-[#7A3BFF]/80 text-white" : "bg-black/60 text-white/60"}`}>
          {vidDone ? "✓ Ready" : `${Math.round(pct)}%`}
        </span>
        {isReady && (
          <button
            onClick={(e) => { e.stopPropagation(); downloadFile(vidDone ? scene.videoUrl : scene.imageUrl, `face-asmr-scene-${index + 1}.${vidDone ? "mp4" : "jpg"}`); }}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-[#7A3BFF] hover:bg-[#6a30e0] text-white transition active:scale-95"
          >
            <Download className="w-3 h-3" />
            <span className="text-[10px] font-semibold">{vidDone ? "Video" : "Img"}</span>
          </button>
        )}
      </div>

      {/* click anywhere on card to open viewer */}
      {isReady && (
        <div className="absolute inset-0 z-20 cursor-pointer" onClick={() => setViewerOpen(true)} />
      )}

      {viewerOpen && <Viewer scene={scene} index={index} onClose={() => setViewerOpen(false)} />}
    </motion.div>
  );
}

export default function FaceAsmrResults({ phase, jobScenes, sceneCount, error, user, recentGenerations = [], viewingRecent = false, onOpenRecent, onRequestAuth, onReset }) {

  /* ══ ACTIVE GENERATION ══ */
  if (phase !== "idle") {
    const totalImages = jobScenes.length;
    const doneImages  = jobScenes.filter((s) => s.imageStatus === "succeeded").length;
    const doneVideos  = jobScenes.filter((s) => s.videoStatus === "succeeded").length;

    // Fill as many cols as scenes, capped at 3 — so all fit in one row on desktop
    const cols = Math.min(jobScenes.length, 3);

    return (
      <div className="flex flex-col w-full h-full overflow-hidden p-3 gap-3">

        {/* status bar — fixed height */}
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#111315] border border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            {phase !== "done" && phase !== "error" && (
              <Loader2 className="w-4 h-4 text-[#A87AFF] animate-spin shrink-0" />
            )}
            <PhaseLabel phase={phase} viewingRecent={viewingRecent} />
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

        {/* scroll wrapper — keeps flex sizing separate from grid so aspect-ratio row heights calculate correctly */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div
            className="grid grid-cols-2 content-start justify-items-stretch gap-x-3.5 gap-y-4 px-3 pb-8 lg:gap-3 lg:px-0 lg:pb-0 lg:[grid-template-columns:repeat(var(--face-asmr-cols),minmax(0,min(100%,280px)))]"
            style={{ "--face-asmr-cols": cols }}
          >
            {jobScenes.map((scene, i) => (
              <SceneCard key={i} scene={scene} index={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ══ IDLE — demo + CTA ══ */
  return (
    <div className="relative flex flex-col h-full min-h-[500px] rounded-2xl overflow-hidden">
      <img src={BG_THUMB} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-25 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D0F]/70 via-[#0B0D0F]/40 to-[#0B0D0F]/85 pointer-events-none" />

      {recentGenerations.length > 0 && (
        <div className="relative z-10 block h-full p-3 lg:hidden">
          <RecentCreationsPanel recentGenerations={recentGenerations} mobile onOpenRecent={onOpenRecent} />
        </div>
      )}

      <div className={`relative z-10 flex flex-col h-full p-6 lg:p-8 gap-5 ${recentGenerations.length > 0 ? "hidden lg:flex" : ""}`}>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-[#A87AFF]" />
            <span className="text-[#A87AFF] text-[12px] font-bold tracking-widest uppercase">Face ASMR</span>
          </div>
          <h2 className="text-white font-black text-[26px] lg:text-[32px] leading-tight tracking-tight">
            Turn Any Face Into a<br />
            <span className="bg-gradient-to-r from-white via-purple-100 to-purple-400 bg-clip-text text-transparent">
              Viral ASMR Video
            </span>
          </h2>
          <p className="text-white/55 text-[14px] mt-2.5 leading-relaxed max-w-[460px]">
            Pick a celebrity, upload a photo, or describe any face. We generate a satisfying ASMR video with realistic sound triggers — ready to go viral.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {FEATURES.map((f) => (
            <span key={f.label} className="inline-flex h-7 items-center gap-1.5 rounded-[32px] border border-[rgba(214,225,255,0.08)] bg-white/[0.06] px-3 text-[#b0b4ba] text-[11.89px] font-medium leading-[19px] tracking-[-0.08px] shadow-[inset_0_0_7.1px_rgba(255,255,255,0.21)]">
              <span>{f.icon}</span>{f.label}
            </span>
          ))}
        </div>

        <div className="flex items-stretch gap-3 flex-1 min-h-0" style={{ minHeight: "200px" }}>
          {DEMO_VIDEOS.slice(0, recentGenerations.length > 0 ? 1 : 2).map((src, i) => (
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
          {recentGenerations.length > 0 && <RecentCreationsPanel recentGenerations={recentGenerations} onOpenRecent={onOpenRecent} />}
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
          <p className="text-center text-white/30 text-[12px]">Fill in the scenes on the left and hit Generate</p>
        )}
      </div>

      {/* ── Recent generations ── */}
    </div>
  );
}
