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

/* =============================== VIDEO THUMB =============================== */

function VideoThumb({ item, isActive, onClick }) {
  const isDone = !!item.result_url;
  const [thumbProgress, setThumbProgress] = useState(0);
  const tpRef = useRef(0);
  const tpRafRef = useRef(null);

  useEffect(() => {
    const target = Math.min(99, Math.floor(Number(item.progress ?? 0)));
    if (isDone) { tpRef.current = 100; setThumbProgress(100); return; }
    if (target <= tpRef.current) return;
    if (tpRafRef.current) cancelAnimationFrame(tpRafRef.current);
    const startVal = tpRef.current;
    const startTime = performance.now();
    const dist = Math.max(1, target - startVal);
    const duration = Math.max(250, dist * 18);
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const next = Math.round(startVal + dist * ease);
      tpRef.current = next;
      setThumbProgress(next);
      if (t < 1) tpRafRef.current = requestAnimationFrame(tick);
    };
    tpRafRef.current = requestAnimationFrame(tick);
    return () => { if (tpRafRef.current) cancelAnimationFrame(tpRafRef.current); };
  }, [item.progress, isDone]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative flex-shrink-0 aspect-[9/16] w-[100px] sm:w-[120px]
        rounded-xl overflow-hidden border transition-all bg-black
        ${isActive
          ? "border-[#7A3BFF] shadow-[0_0_18px_rgba(122,59,255,0.4)]"
          : "border-white/10 hover:border-white/30"
        }
      `}
    >
      {isDone ? (
        <>
          <video
            src={item.result_url}
            className="w-full h-full object-cover"
            muted playsInline autoPlay loop preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
            <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
              <svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#060912] overflow-hidden">
          {/* Orb */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: "90%", paddingBottom: "90%", top: "5%", left: "5%",
              background: "radial-gradient(circle, rgba(122,59,255,0.16), transparent)",
              filter: "blur(14px)",
              animation: "pulse 2.5s ease-in-out infinite",
            }}
          />
          {/* Mini progress ring */}
          <div className="relative w-10 h-10 z-10">
            <svg className="w-full h-full" style={{ transform: "rotate(-90deg)" }} viewBox="0 0 100 100">
              <defs>
                <linearGradient id={`thumbRing_${item.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7A3BFF" />
                  <stop offset="100%" stopColor="#C077FF" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
              <circle
                cx="50" cy="50" r="38"
                fill="none"
                stroke={`url(#thumbRing_${item.id})`}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray="238.8"
                strokeDashoffset={238.8 * (1 - thumbProgress / 100)}
                style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.4,0,0.2,1)" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/70 text-[9px] font-semibold tabular-nums">{thumbProgress}%</span>
            </div>
          </div>
          {/* Bottom bar */}
          <div className="absolute bottom-0 inset-x-0">
            <div className="h-[2px] w-full bg-white/[0.04]">
              <div
                className="h-full"
                style={{
                  width: `${Math.max(2, thumbProgress)}%`,
                  background: "linear-gradient(90deg, #7A3BFF, #C077FF)",
                  transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
                  boxShadow: "0 0 6px rgba(122,59,255,0.5)",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </button>
  );
}

/* =============================== MAIN =============================== */

export default function Result({ results = [] }) {
  const scrollRef = useRef(null);
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const ppRef = useRef(0);
  const ppRafRef = useRef(null);
  const ppCreepRef = useRef(null);

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

  /* derive activeVideo live so progress/result_url are always fresh */
  const activeVideo = useMemo(
    () => videoResults.find((v) => v.id === activeVideoId) ?? null,
    [videoResults, activeVideoId]
  );

  /* =============================== AUTO SELECT =============================== */

  useEffect(() => {
    if (videoResults.length === 0) {
      setActiveVideoId(null);
      return;
    }
    setActiveVideoId((prev) => prev ?? videoResults[0].id);
  }, [videoResults.length]);

  /* =============================== SCROLL =============================== */

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    const amount = Math.floor(scrollRef.current.clientWidth * 0.7);
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  /* reset displayed progress whenever we switch to a different video */
  useEffect(() => {
    if (ppRafRef.current) cancelAnimationFrame(ppRafRef.current);
    ppRef.current = 0;
    setPreviewProgress(0);
  }, [activeVideoId]);

  /* smooth preview progress — animates to each new DB value, then creeps forward between updates */
  useEffect(() => {
    if (!activeVideo) return;

    // Clear creep ticker on every update
    if (ppCreepRef.current) clearInterval(ppCreepRef.current);

    if (activeVideo.result_url) {
      if (ppRafRef.current) cancelAnimationFrame(ppRafRef.current);
      ppRef.current = 100;
      setPreviewProgress(100);
      return;
    }

    const target = Math.min(99, Math.floor(Number(activeVideo.progress ?? 0)));

    // Animate to new target
    const animateTo = (to) => {
      if (to <= ppRef.current) return;
      if (ppRafRef.current) cancelAnimationFrame(ppRafRef.current);
      const startVal = ppRef.current;
      const startTime = performance.now();
      const dist = Math.max(1, to - startVal);
      const duration = Math.max(300, dist * 20);
      const tick = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        const ease = 1 - Math.pow(1 - t, 3);
        const next = Math.round(startVal + dist * ease);
        ppRef.current = next;
        setPreviewProgress(next);
        if (t < 1) ppRafRef.current = requestAnimationFrame(tick);
      };
      ppRafRef.current = requestAnimationFrame(tick);
    };

    animateTo(target);

    // Creep: nudge 0.4% every 2s between DB updates so bar is never frozen
    ppCreepRef.current = setInterval(() => {
      const ceiling = Math.min(98, target + 2);
      if (ppRef.current < ceiling) animateTo(ppRef.current + 0.4);
    }, 2000);

    return () => {
      if (ppRafRef.current) cancelAnimationFrame(ppRafRef.current);
      if (ppCreepRef.current) clearInterval(ppCreepRef.current);
    };
  }, [activeVideo?.progress, activeVideo?.result_url]);

  /* =============================== RENDER =============================== */

  return (
    <div className="w-full flex-1 flex flex-col gap-4 bg-[#111314] border border-white/[0.08] shadow-[0_10px_40px_rgba(0,0,0,0.32)] rounded-[22px] p-4 md:p-6 pb-[90px] lg:pb-6">

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
              {videoResults.map((item) => (
                <VideoThumb
                  key={item.id}
                  item={item}
                  isActive={activeVideoId === item.id}
                  onClick={() => {
                    setActiveVideoId(item.id);
                    if (item.result_url) setViewerOpen(true);
                  }}
                />
              ))}
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
            <div className="relative flex flex-col items-center justify-center gap-5 py-14 overflow-hidden bg-[#060912] rounded-2xl min-h-[220px]">

              {/* Ambient orb */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: "55%", paddingBottom: "55%", top: "-10%", left: "22%",
                  background: "radial-gradient(circle, rgba(122,59,255,0.17), transparent)",
                  filter: "blur(40px)",
                  animation: "pulse 2.8s ease-in-out infinite",
                }}
              />

              {/* Video waveform bars */}
              <div className="relative z-10 flex items-end gap-[3px] h-7">
                {[0.4, 0.75, 1, 0.6, 0.9, 0.5, 1, 0.7, 0.85, 0.45].map((h, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full"
                    style={{
                      height: `${h * 100}%`,
                      background: "linear-gradient(to top, #7A3BFF, #C077FF)",
                      opacity: 0.7,
                      animation: `waveBar 1.1s ease-in-out ${i * 0.1}s infinite alternate`,
                      transformOrigin: "bottom",
                    }}
                  />
                ))}
              </div>

              {/* Progress ring */}
              <div className="relative w-[60px] h-[60px] z-10">
                <svg className="w-full h-full" style={{ transform: "rotate(-90deg)" }} viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="previewRing" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#7A3BFF" />
                      <stop offset="100%" stopColor="#C077FF" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke="url(#previewRing)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="251.3"
                    strokeDashoffset={251.3 * (1 - previewProgress / 100)}
                    style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.4,0,0.2,1)" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/80 text-[13px] font-semibold tabular-nums">{previewProgress}%</span>
                </div>
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    inset: "-6px",
                    background: "radial-gradient(circle, rgba(122,59,255,0.2), transparent 70%)",
                    filter: "blur(6px)",
                    animation: "pulse 2s ease-in-out infinite",
                  }}
                />
              </div>

              {/* Status + dots */}
              <div className="relative z-10 flex flex-col items-center gap-1.5">
                <p className="text-white/45 text-[11px] font-medium tracking-[0.1em] uppercase">
                  {previewProgress < 5
                    ? "Queuing"
                    : previewProgress < 30
                    ? "Generating frames"
                    : previewProgress < 70
                    ? "Rendering video"
                    : previewProgress < 95
                    ? "Finalizing"
                    : "Almost done"}
                </p>
                <div className="flex gap-[4px]">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="block w-[4px] h-[4px] rounded-full bg-[#7A3BFF]/55 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms`, animationDuration: "1.1s" }}
                    />
                  ))}
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative z-10 w-52 h-[2px] bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, previewProgress)}%`,
                    background: "linear-gradient(90deg, #7A3BFF, #C077FF)",
                    transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
                    boxShadow: "0 0 8px rgba(122,59,255,0.6)",
                  }}
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
