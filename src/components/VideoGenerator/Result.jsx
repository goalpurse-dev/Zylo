import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, X, Share2, Loader2 } from "lucide-react";
import { CREATION_TYPES } from "../../lib/creations";

/* =============================== CONFIG =============================== */

const MAX_RUNTIME_MS = 20 * 60 * 1000;

/* =============================== HELPERS =============================== */

function isExpired(job) {
  if (!job?.created_at) return false;
  const age = Date.now() - new Date(job.created_at).getTime();
  if (job.status === "failed") return true;
  if (!job.result_url && age > MAX_RUNTIME_MS) return true;
  if (job.status === "running" && age > MAX_RUNTIME_MS) return true;
  if (job.status === "queued" && age > MAX_RUNTIME_MS) return true;
  return false;
}

/* =============================== DOWNLOAD =============================== */

async function downloadVideo(url) {
  const proxyBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-proxy`;
  try {
    const res = await fetch(proxyBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error("proxy failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "zyvo-video.mp4";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

/* =============================== VIEWER MODAL =============================== */

function Viewer({ video, onClose }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    await downloadVideo(video.result_url);
    setDownloading(false);
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* TOP BAR */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <p className="text-white/50 text-sm truncate max-w-[70%]">
          {video.prompt || "Generated video"}
        </p>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* VIDEO */}
      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        <video
          key={video.id}
          src={video.result_url}
          controls
          autoPlay
          playsInline
          className="max-w-full max-h-full rounded-2xl object-contain"
          style={{ maxHeight: "calc(100dvh - 160px)" }}
        />
      </div>

      {/* BOTTOM ACTIONS */}
      <div className="flex-shrink-0 px-4 py-4 flex items-center justify-center gap-3">
        {/* DOWNLOAD */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="
            flex items-center gap-2 px-5 py-3 rounded-2xl
            bg-[#7A3BFF] hover:bg-[#6a30e0]
            text-white font-semibold text-sm
            transition active:scale-95 disabled:opacity-60
            shadow-[0_0_20px_rgba(122,59,255,0.4)]
          "
        >
          {downloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {downloading ? "Downloading…" : "Download"}
        </button>

        {/* SHARE (native share API) */}
        {"share" in navigator && (
          <button
            onClick={() => navigator.share({ url: video.result_url, title: "My Zyvo video" }).catch(() => {})}
            className="
              flex items-center gap-2 px-5 py-3 rounded-2xl
              bg-white/10 hover:bg-white/20
              text-white font-semibold text-sm
              transition active:scale-95
            "
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

/* =============================== MAIN =============================== */

export default function Result({ results = [] }) {
  const scrollRef = useRef(null);
  const [activeVideo, setActiveVideo] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  /* =============================== FILTER =============================== */

  const videoResults = useMemo(() => {
    if (!Array.isArray(results)) return [];
    return results
      .filter(
        (r) =>
          (r?.type === "video" || r?.settings?.creation_type === CREATION_TYPES.VIDEO) &&
          !isExpired(r)
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [results]);

  /* =============================== AUTO SELECT =============================== */

  useEffect(() => {
    if (videoResults.length === 0) {
      setActiveVideo(null);
      return;
    }
    // Auto-select latest in the preview strip — never auto-open fullscreen
    setActiveVideo((prev) => prev ?? videoResults[0]);
  }, [videoResults.length]);

  /* =============================== SCROLL =============================== */

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const amount = Math.floor(scrollRef.current.clientWidth * 0.7);
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  /* =============================== RENDER =============================== */

  return (
    <div className="w-full min-h-full flex flex-col gap-4 bg-[#191B1C] rounded-[22px] p-4 md:p-6 pb-[90px] md:pb-6">

      <h1 className="text-[#F4F6FB] font-semibold text-[20px]">Recent Creations</h1>

      {/* ================= EMPTY STATE ================= */}
      {videoResults.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 select-none py-16">
          <img src="/assets/logos/sadzyvo.webp" className="w-20 h-20 opacity-50" alt="" />
          <p className="text-white/60 text-sm font-semibold">No generated content yet</p>
          <p className="text-white/25 text-xs">Your creations will appear here</p>
        </div>
      )}

      {/* ================= THUMBNAIL RAIL ================= */}
      {videoResults.length > 0 && (
        <div className="relative w-full min-w-0 overflow-hidden">

          {/* Edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#191B1C] to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#191B1C] to-transparent z-10" />

          {videoResults.length > 3 && (
            <>
              <button
                onClick={() => scroll("left")}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/55 hover:bg-black/80 backdrop-blur-md p-2 rounded-full border border-white/10"
                type="button"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <button
                onClick={() => scroll("right")}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/55 hover:bg-black/80 backdrop-blur-md p-2 rounded-full border border-white/10"
                type="button"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </>
          )}

          <div
            ref={scrollRef}
            className="w-full overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth px-2"
          >
            <div className="flex gap-3 py-2">
              {videoResults.map((item) => {
                const isActive = activeVideo?.id === item.id;
                const isDone = !!item.result_url;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveVideo(item);
                      if (isDone) setViewerOpen(true);
                    }}
                    className={`
                      relative flex-shrink-0 aspect-[9/16] w-[100px] sm:w-[120px]
                      rounded-xl overflow-hidden border transition-all
                      ${isActive
                        ? "border-[#7A3BFF] shadow-[0_0_18px_rgba(122,59,255,0.4)]"
                        : "border-white/10 hover:border-white/30"
                      }
                      bg-black
                    `}
                  >
                    {isDone ? (
                      <>
                        <video
                          src={item.result_url}
                          className="w-full h-full object-cover"
                          muted playsInline autoPlay loop preload="metadata"
                        />
                        {/* Play icon overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
                          <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-[#0D0F14]">
                        <svg className="w-8 h-8 animate-spin" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8"/>
                          <circle cx="50" cy="50" r="40" fill="none" stroke="#7A3BFF" strokeWidth="8"
                            strokeDasharray="30 220" strokeLinecap="round" className="origin-center"/>
                        </svg>
                        {typeof item.progress === "number" && (
                          <p className="text-[10px] text-white/40">{Math.floor(item.progress)}%</p>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= SELECTED PREVIEW (in-page, desktop friendly) ================= */}
      {activeVideo && (
        <div className="w-full rounded-2xl overflow-hidden bg-black/30 border border-white/5">
          {activeVideo.result_url ? (
            <div className="relative">
              <video
                key={activeVideo.id}
                src={activeVideo.result_url}
                muted playsInline autoPlay loop
                className="w-full max-h-[40vh] object-contain"
              />
              {/* Open fullscreen + download strip */}
              <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-white/60 text-xs truncate max-w-[60%]">
                  {activeVideo.prompt || "Generated video"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewerOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-medium transition active:scale-95"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                    </svg>
                    Fullscreen
                  </button>
                  <button
                    onClick={() => downloadVideo(activeVideo.result_url)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7A3BFF] hover:bg-[#6a30e0] text-white text-xs font-medium transition active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <Loader2 className="w-8 h-8 text-[#7A3BFF] animate-spin" />
              <p className="text-white/40 text-sm">
                {typeof activeVideo.progress === "number"
                  ? `Generating… ${Math.floor(activeVideo.progress)}%`
                  : "Generating…"}
              </p>
              <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#7A3BFF] to-[#C77DFF] rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(5, Math.floor(activeVideo.progress ?? 0))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= VIEWER MODAL ================= */}
      {viewerOpen && activeVideo?.result_url && (
        <Viewer video={activeVideo} onClose={() => setViewerOpen(false)} />
      )}
    </div>
  );
}
