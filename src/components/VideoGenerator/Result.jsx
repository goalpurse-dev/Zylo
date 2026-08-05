import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, X, Share2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CREATION_TYPES } from "../../lib/creations";
import { useAuth } from "../../context/AuthContext";
import { saveMediaToDevice, shareMediaFile } from "../../lib/downloadMedia";

/* =============================== CONFIG =============================== */

const MAX_RUNTIME_MS = 10 * 60 * 1000;
const FAILED_VISIBLE_MS = 10 * 60 * 1000; // keep failed cards visible for 10 min

/* =============================== HELPERS =============================== */

function isExpired(job) {
  if (!job?.created_at) return false;
  const age = Date.now() - new Date(job.created_at).getTime();
  // Keep failed cards visible so the user sees the status; expire after FAILED_VISIBLE_MS
  if (job.status === "failed") return age > FAILED_VISIBLE_MS;
  if (!job.result_url && age > MAX_RUNTIME_MS) return true;
  if (job.status === "running" && age > MAX_RUNTIME_MS) return true;
  if (job.status === "queued" && age > MAX_RUNTIME_MS) return true;
  return false;
}

function isRateLimitError(job) {
  const msg = String(job?.error ?? "").toLowerCase();
  return msg.includes("402") || msg.includes("insufficientcredits") || msg.includes("insufficient credits");
}

/* =============================== DOWNLOAD =============================== */

async function downloadVideo(url) {
  const proxyBase = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-proxy`;
  return saveMediaToDevice({
    url,
    filename: "zyvo-video.mp4",
    title: "My Zyvo video",
    proxyUrl: proxyBase,
  });
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
          preload="none"
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
            onClick={() => shareMediaFile({
              url: video.result_url,
              filename: "zyvo-video.mp4",
              title: "My Zyvo video",
              proxyUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-proxy`,
            }).catch(() => {})}
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
  const isFailed = item.status === "failed";
  const isRateLimit = isFailed && isRateLimitError(item);
  const [thumbProgress, setThumbProgress] = useState(0);
  const tpRef = useRef(0);
  const tpRafRef = useRef(null);

  useEffect(() => {
    const rawTarget = Math.min(99, Math.floor(Number(item.progress ?? 0)));
    const target = item.status === "queued" ? Math.min(rawTarget, 8) : rawTarget;
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
        ${isFailed
          ? isActive
            ? "border-amber-500/70 shadow-[0_0_18px_rgba(245,158,11,0.35)]"
            : "border-amber-500/30 hover:border-amber-500/50"
          : isActive
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
            muted playsInline autoPlay loop preload="none"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition">
            <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
              <svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        </>
      ) : isFailed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0806] gap-2">
          <div className="w-9 h-9 rounded-full bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
          </div>
          <p className="text-amber-400/80 text-[8px] font-bold tracking-wide uppercase text-center leading-tight px-1">
            {isRateLimit ? "Rate\nLimited" : "Failed"}
          </p>
        </div>
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
                  <stop offset="0%" stopColor={item.status === "queued" && Number(item.attempts ?? 0) > 0 ? "#f59e0b" : "#7A3BFF"} />
                  <stop offset="100%" stopColor={item.status === "queued" && Number(item.attempts ?? 0) > 0 ? "#fbbf24" : "#C077FF"} />
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
          {/* Real status label */}
          <p className={`text-[8px] font-semibold tracking-wide uppercase mt-1 z-10 ${
            item.status === "queued" && Number(item.attempts ?? 0) > 0 ? "text-amber-400/80" :
            item.status === "queued" ? "text-white/30" : "text-white/35"
          }`}>
            {item.status === "queued" && Number(item.attempts ?? 0) > 0
              ? "Retrying"
              : item.status === "queued"
              ? "Queued"
              : "Generating"}
          </p>
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

/* =============================== VIDEO GEN HERO =============================== */

const VID_DEMO_CLIPS = [
  "/viral-builder/micro-camera/video.mp4",
  "/viral-builder/micro-camera/video2.mp4",
];

const VID_HERO_PILLS = ["3+ AI Models", "4K Quality", "5s Avg. Gen", "Free to Start"];

const VID_PROMPTS = [
  "A lone samurai crossing a misty bridge at dawn",
  "Neon city at night, rain reflecting every light",
  "An astronaut floating through a field of flowers",
  "Cinematic drone shot over an ancient forest",
  "Deep ocean bioluminescent creatures swimming",
];

function VideoGenHero() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [promptIdx] = useState(() => Math.floor(Math.random() * VID_PROMPTS.length));

  return (
    <div className="relative w-full h-full flex flex-col rounded-[22px] overflow-hidden bg-[#0E1012] border border-white/[0.06] shadow-[0_10px_40px_rgba(0,0,0,0.32)]" style={{ minHeight: "560px" }}>
      {/* Blurred BG */}
      <img
        src="/images/thumbs/cyberpunk.webp"
        alt=""
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-15 pointer-events-none"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D0F]/88 via-[#0B0D0F]/60 to-[#0B0D0F]/92 pointer-events-none" />
      {/* Purple ambient */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-60px", left: "50%", transform: "translateX(-50%)",
          width: "400px", height: "400px",
          background: "radial-gradient(circle, rgba(122,59,255,0.14), transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative z-10 flex flex-col gap-4 p-6 h-full flex-1">
        {/* Badge */}
        <div>
          <span className="text-[#A87AFF] text-[11px] font-bold tracking-widest uppercase">
            ✦ AI Video Generator
          </span>
        </div>

        {/* Headline */}
        <div>
          <h2 className="text-white font-black text-[24px] lg:text-[28px] leading-tight tracking-tight">
            Create videos that<br />
            <span className="bg-gradient-to-r from-white via-purple-100 to-[#C084FC] bg-clip-text text-transparent">
              go viral instantly
            </span>
          </h2>
          <p className="text-white/45 text-[13px] mt-2 leading-relaxed max-w-[420px]">
            Type a prompt, pick your style, hit generate. Cinematic AI videos ready for TikTok and Reels in minutes.
          </p>
        </div>

        {/* Pills */}
        <div className="flex flex-wrap gap-1.5">
          {VID_HERO_PILLS.map((label) => (
            <span
              key={label}
              className="inline-flex h-6 items-center rounded-full border border-[rgba(168,122,255,0.25)] bg-[rgba(168,122,255,0.08)] px-2.5 text-[#c4a8ff] text-[11px] font-medium"
            >
              {label}
            </span>
          ))}
        </div>

        {/* Demo video clips side by side */}
        <div className="flex gap-3 flex-1" style={{ minHeight: "200px" }}>
          {VID_DEMO_CLIPS.map((src, i) => (
            <div
              key={src}
              className="relative flex-1 min-w-0 rounded-2xl overflow-hidden bg-black shadow-[0_8px_32px_rgba(0,0,0,0.55)]"
              style={{
                aspectRatio: "9/16",
                maxHeight: "340px",
                animation: `vidHeroFloat ${3.8 + i * 0.5}s ease-in-out ${i * 0.6}s infinite alternate`,
              }}
            >
              <video
                src={src}
                autoPlay
                muted
                loop
                playsInline
                preload="none"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent pointer-events-none" />
            </div>
          ))}

          {/* Prompt card */}
          <div className="hidden lg:flex flex-1 flex-col justify-center gap-3 pl-1">
            <div className="rounded-2xl border border-[rgba(168,122,255,0.2)] bg-[rgba(168,122,255,0.06)] p-4">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-[#A87AFF] mb-2">Example prompt</p>
              <p className="text-white/75 text-[13px] leading-snug font-medium italic">
                "{VID_PROMPTS[promptIdx]}"
              </p>
            </div>
            <div className="space-y-2">
              {["Cinematic & atmospheric", "Portrait 9:16 for TikTok", "Download in 1 click"].map((feat) => (
                <div key={feat} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[#7A3BFF]/20 border border-[#7A3BFF]/40 flex items-center justify-center shrink-0">
                    <svg className="w-2.5 h-2.5 text-[#C084FC]" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2.5">
                      <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-white/50 text-[12px]">{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        {!user ? (
          <button
            onClick={() => navigate("/signup")}
            className="w-full py-3.5 rounded-xl font-black text-white text-[15px] tracking-tight hover:opacity-90 active:scale-[0.98] transition-all select-none"
            style={{
              background: "linear-gradient(135deg, #7A3BFF 0%, #9F5CFF 50%, #C084FC 100%)",
              boxShadow: "0 0 28px rgba(122,59,255,0.38)",
            }}
          >
            ✦ &nbsp; Start generating for free
          </button>
        ) : (
          <p className="text-center text-white/30 text-[12px] py-1">
            Describe your video on the left and hit Generate
          </p>
        )}
      </div>

      <style>{`
        @keyframes vidHeroFloat {
          from { transform: translateY(0px); }
          to   { transform: translateY(-9px); }
        }
      `}</style>
    </div>
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

  /* ── Hero state: no results yet ── */
  if (videoResults.length === 0) {
    return <VideoGenHero />;
  }

  return (
    <div className="w-full flex-1 flex flex-col gap-4 bg-[#111314] border border-white/[0.08] shadow-[0_10px_40px_rgba(0,0,0,0.32)] rounded-[22px] p-4 md:p-6 pb-[90px] lg:pb-6">

      <h1 className="text-[#F4F6FB] font-semibold text-[20px]">Recent Creations</h1>

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
        <div className={`w-full rounded-2xl overflow-hidden bg-black/30 border ${activeVideo.status === "failed" ? "border-amber-500/20" : "border-white/5"}`}>
          {activeVideo.result_url ? (
            <div className="relative">
              <video
                key={activeVideo.id}
                src={activeVideo.result_url}
                muted playsInline autoPlay loop preload="none"
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
          ) : activeVideo.status === "failed" ? (
            <div className="relative flex flex-col items-center justify-center gap-4 py-14 overflow-hidden bg-[#0d0806] rounded-2xl min-h-[220px]">
              {/* Amber ambient glow */}
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: "55%", paddingBottom: "55%", top: "-10%", left: "22%",
                  background: "radial-gradient(circle, rgba(245,158,11,0.12), transparent)",
                  filter: "blur(40px)",
                }}
              />
              {/* Warning icon */}
              <div className="relative z-10 w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/35 flex items-center justify-center">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
              </div>
              {/* Label */}
              <div className="relative z-10 flex flex-col items-center gap-1">
                <p className="text-amber-400 text-[13px] font-semibold tracking-wide">
                  {isRateLimitError(activeVideo) ? "Rate Limited by Provider" : "Generation Failed"}
                </p>
                <p className="text-white/35 text-[11px] text-center max-w-[260px] leading-snug">
                  {isRateLimitError(activeVideo)
                    ? "Runware is throttling requests based on balance. The system will retry automatically."
                    : "Something went wrong. Try generating again."}
                </p>
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
