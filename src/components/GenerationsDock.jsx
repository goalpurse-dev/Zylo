import React,
{
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  X,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Download,
  Play,
  Pause,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { upsertCreation, CREATION_TYPES } from "../lib/creations";
import GenerationLimitToast from "./GenerationLimitToast";


/* ---------- config ---------- */
const BRAND = "#7A3BFF";
const PAGE_BG = "#020509";
const STOP = new Set(["succeeded", "failed", "canceled"]);
const PLAN_LIMITS = {
  starter: 3,
  pro: 5,
  generative: 10,
  default: 3,
};
const MAX_JOBS = 15;

const GenerationsCtx = createContext(null);

/* ---------- helpers ---------- */
const clamp01 = (n) =>
  Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

function phaseLabel(status, pct) {
  if (status === "failed") return "Failed";
  if (status === "queued") return "Waiting…";
  if (pct < 10) return "Analyzing…";
  if (pct < 90) return "Rendering…";
  if (pct < 99) return "Finalizing…";
  return "Uploading…";
}

function useAnimatedNumber(target, ms = 450) {
  const [val, setVal] = useState(0);
  const raf = useRef();
  const start = useRef(0);
  const from = useRef(0);
  const to = useRef(0);

  useEffect(() => {
    const t = clamp01(target);
    cancelAnimationFrame(raf.current);
    start.current = 0;
    from.current = val;
    to.current = t;

    const step = (ts) => {
      if (!start.current) start.current = ts;
      const k = Math.min(1, (ts - start.current) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setVal(from.current + (to.current - from.current) * eased);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ms]);

  return Math.round(val);
}

/* ---------- classify for Library ---------- */

const CREATION_TYPE_VALUES = Object.values(CREATION_TYPES);

function mapJobToCreationType(j) {
  const input = j?.input || {};
  const settings = j?.settings || {};

  const fromInput = input.creation_type;
  const fromSettings = settings.creation_type;

  // 1) Prefer explicit creation_type set in jobs.ts
  if (fromInput && CREATION_TYPE_VALUES.includes(fromInput)) {
    return fromInput;
  }
  if (fromSettings && CREATION_TYPE_VALUES.includes(fromSettings)) {
    return fromSettings;
  }

  // 2) Fallback for old jobs with no creation_type

  const url = j?.result_url || j?.url || "";
  const isVideoUrl = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

  const kind = (
    j?.kind ||
    j?.input?.kind ||
    j?.meta?.kind ||
    ""
  ).toLowerCase();

  const toolKey = (
    j?.tool_key ||
    j?.input?.tool_key ||
    j?.meta?.tool_key ||
    ""
  ).toLowerCase();

  const tool = (
    j?.input?.tool ||
    j?.meta?.tool ||
    j?.tool ||
    j?.input?.source ||
    j?.meta?.source ||
    toolKey ||
    ""
  ).toLowerCase();

  const hasProduct =
    !!j?.input?.product ||
    !!j?.input?.product_id ||
    !!j?.meta?.product_id;

  const isProductPhoto =
    kind === "product_photo" ||
    kind === "product-photo" ||
    toolKey.includes("product-photo") ||
    tool.includes("product-photo") ||
    tool.includes("product-photos") ||
    tool.includes("product_photo") ||
    tool.includes("productphotos");

  const isAd =
    kind === "product_ad" ||
    kind === "ad" ||
    toolKey.includes("ad") ||
    tool.includes("ad-studio") ||
    tool.includes("adstudio") ||
    j?.input?.is_ad === true ||
    j?.meta?.is_ad === true;

  if (isAd) return CREATION_TYPES.PRODUCT_AD;
  if (!isVideoUrl && (isProductPhoto || hasProduct)) {
    return CREATION_TYPES.PRODUCT_PHOTO;
  }
  if (isVideoUrl) return CREATION_TYPES.VIDEO;
  return CREATION_TYPES.PHOTO;
}

/* ---------- where to show ---------- */

function isGenerationsVisible(pathname) {
  const p = pathname || "";

  // Library
  if (p.startsWith("/library")) return true;

  // Ad Studio (both old and new paths)
  if (p.startsWith("/ad-studio") || p.startsWith("/ad/create")) return true;

  // Text to Image
  if (p.startsWith("/tools/textimage") || p.startsWith("/textimage")) {
    return true;
  }

  // Text to Video
  if (p.startsWith("/tools/textvideo") || p.startsWith("/textvideo")) {
    return true;
  }

  // Product Photos
  if (p.startsWith("/tools/product-photos") || p.startsWith("/product-photos")) {
    return true;
  }

    // Product Photos
  if (p.startsWith("/tools/product-photos") || p.startsWith("/product-photos")) {
    return true;
  }

    if (p.startsWith("/workspace/productphoto") || p.startsWith("/productphoto")) {
    return true;
  }


  return false;
}

/* ================== PROVIDER ================== */

export function GenerationsProvider({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  const [profile, setProfile] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [jobs, setJobs] = useState([]); // [{id, status, job}]
  const [showLimitToast, setShowLimitToast] = useState(false);

  const showDock = isGenerationsVisible(location.pathname);

  // load plan
  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("plan_code")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data || null))
      .catch(() => {});
  }, [user?.id]);

  const maxConcurrent = useMemo(() => {
    const code = (profile?.plan_code || "").toLowerCase();
    if (code.includes("generative")) return PLAN_LIMITS.generative;
    if (code.includes("pro")) return PLAN_LIMITS.pro;
    if (code.includes("starter")) return PLAN_LIMITS.starter;
    return PLAN_LIMITS.default;
  }, [profile]);

  const activeCount = useMemo(
    () => jobs.filter((j) => !STOP.has(j.status || "running")).length,
    [jobs]
  );

  const canAddMore = activeCount < maxConcurrent;

  const addJob = useCallback(
    (id, meta = {}) => {
      if (!id) return { ok: false, reason: "missing-id" };

      if (!canAddMore) {
        setShowLimitToast(true);
        return { ok: false, reason: "limit" };
      }

      setIsOpen(true);
      setJobs((prev) => {
        if (prev.find((j) => j.id === id)) return prev;
        const next = [{ id, status: "queued", job: { id, ...meta } }, ...prev];
        return next.slice(0, MAX_JOBS);
      });

      return { ok: true };
    },
    [canAddMore]
  );

  const updateJobState = useCallback((id, patch) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? {
              ...j,
              ...patch,
              job: { ...(j.job || {}), ...(patch.job || {}) },
            }
          : j
      )
    );
  }, []);

  const removeJob = useCallback((id) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const value = {
    isOpen,
    setIsOpen,
    jobs,
    addJob,
    updateJobState,
    removeJob,
    maxConcurrent,
    activeCount,
    canAddMore,
  };

  return (
    <GenerationsCtx.Provider value={value}>
      {children}
      {showDock && <GenerationsDock />}
      {showLimitToast && (
        <GenerationLimitToast onClose={() => setShowLimitToast(false)} />
      )}
    </GenerationsCtx.Provider>
  );
}

export function useGenerations() {
  const ctx = useContext(GenerationsCtx);
  if (!ctx) {
    throw new Error("useGenerations must be used inside GenerationsProvider");
  }
  return ctx;
}

/* for non-React wiring if needed */
export function addGenerationJob() {
  console.warn(
    "addGenerationJob: call addJob from useGenerations() in React, or expose it manually."
  );
}

/* ================== SINGLE JOB ITEM ================== */
function GenerationItem({ id }) {
  const { updateJobState, removeJob } = useGenerations();
  const { user } = useAuth();

  const [job, setJob] = useState(null);
  const [err, setErr] = useState(null);

  // "up" | "down" | null
  const [vote, setVote] = useState(null);
  const [savingVote, setSavingVote] = useState(false);

  const [savedToLibrary, setSavedToLibrary] = useState(false);

  // progress
  const maxSeenRef = useRef(0);
  const prevStatusRef = useRef(null);
  const [uiPct, setUiPct] = useState(0);
  const pct = useAnimatedNumber(uiPct, 450);

  const status = job?.status || "running";
  const isDone = status === "succeeded";
  const isFailed = status === "failed";
  const mediaUrl = job?.result_url || job?.url || null;
  const label = useMemo(() => phaseLabel(status, pct), [status, pct]);

  // tool slug for analytics + video detection
  const toolSlug =
    (job?.input?.tool ||
      job?.meta?.tool ||
      job?.tool ||
      job?.input?.source ||
      job?.meta?.source ||
      "unknown") + "";

  const urlLooksLikeVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(mediaUrl || "");
  const toolLooksLikeVideo = /video|ad-studio|adstudio/i.test(toolSlug || "");
  const isVideo = !!mediaUrl && (urlLooksLikeVideo || toolLooksLikeVideo);
  const noun = isVideo ? "video" : "image";

  const promptText =
    job?.prompt ||
    job?.input?.prompt ||
    job?.input?.subject ||
    "(no prompt)";

  const bgVideo = job?.meta?.bgVideo || job?.input?.bgVideo || null;

  const canDownload = isDone && !!mediaUrl;

  // 🔊 AUDIO (tts_url in settings, plus voiceMode label)
  const adInput = job?.input?.ad || job?.meta?.ad || null;
  const ttsUrl = job?.settings?.tts_url || job?.input?.ad?.ttsUrl || null;
  const voiceMode = adInput?.voiceMode || null;
  const hasAudio = !!ttsUrl;

  // audio playback state
  const audioRef = useRef(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  useEffect(() => {
    // reset audio progress whenever job/ttsUrl changes
    if (!ttsUrl && audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }
    setAudioPlaying(false);
    setAudioProgress(0);
  }, [ttsUrl]);

  const toggleAudio = () => {
    if (!ttsUrl || !audioRef.current) return;
    const audio = audioRef.current;

    if (!audio.paused) {
      audio.pause();
      setAudioPlaying(false);
      return;
    }

    audio
      .play()
      .then(() => setAudioPlaying(true))
      .catch(() => setAudioPlaying(false));
  };

  const handleAudioTimeUpdate = (e) => {
    const { currentTime, duration } = e.target;
    if (!duration) return;
    setAudioProgress(currentTime / duration);
  };

  const handleAudioEnded = () => {
    setAudioPlaying(false);
    setAudioProgress(0);
  };

  const apply = (r) => {
    if (!r) return;

    setJob((prev) => {
      if (
        prev?.updated_at &&
        r?.updated_at &&
        new Date(r.updated_at) < new Date(prev.updated_at)
      ) {
        return prev;
      }

      const prevStatus = prevStatusRef.current;
      prevStatusRef.current = r.status;

      let targetPct = null;

      if (typeof r.progress === "number") {
        targetPct = r.progress;
      } else {
        if (r.status === "queued") {
          targetPct = Math.max(0, maxSeenRef.current);
        } else if (
          r.status === "running" ||
          r.status === "processing"
        ) {
          if (prevStatus === "queued") {
            targetPct = Math.max(12, maxSeenRef.current);
          } else {
            targetPct = Math.max(maxSeenRef.current, 12);
          }
        } else if (STOP.has(r.status)) {
          targetPct = 100;
        }
      }

      if (targetPct == null) targetPct = maxSeenRef.current;
      targetPct = clamp01(targetPct);

      if (targetPct > maxSeenRef.current) {
        // ✅ only update the ref + uiPct
        maxSeenRef.current = targetPct;
        setUiPct(targetPct);
      }
      if (r.status === "succeeded") {
        maxSeenRef.current = 100;
        setUiPct(100);
      }

      return r;
    });

    // keep context in sync (outside setJob)
    updateJobState(id, { status: r.status, job: r });
  };

  // fetch + realtime + poll
  useEffect(() => {
    let mounted = true;

    async function fetchOnce() {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        setErr(error.message);
      } else if (data) {
        apply(data);
      }
    }

    fetchOnce();

    const ch = supabase
      .channel(`job-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "jobs",
          filter: `id=eq.${id}`,
        },
        (payload) => apply(payload.new)
      )
      .subscribe();

    const iv = setInterval(fetchOnce, 2500);

    return () => {
      mounted = false;
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // load existing vote when job + user known
  useEffect(() => {
    if (!user?.id || !job) return;

    let ignore = false;
    (async () => {
      const { data, error } = await supabase
        .from("generation_feedback")
        .select("vote")
        .eq("user_id", user.id)
        .eq("job_id", id)
        .maybeSingle();

      if (!ignore && !error && data) {
        if (data.vote === 1) setVote("up");
        else if (data.vote === -1) setVote("down");
        else setVote(null);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [user?.id, id, job]);

  // auto-save to Library when done
  useEffect(() => {
    if (!user?.id) return;
    if (!isDone || !mediaUrl) return;
    if (savedToLibrary) return;

    const type = mapJobToCreationType(job);
    const payload = {
      user_id: user.id,
      type,
      file_url: mediaUrl,
      prompt: promptText || null,
      meta: job?.settings || job?.input || null,
    };

    upsertCreation(payload)
      .then(() => setSavedToLibrary(true))
      .catch(() => {});
  }, [user?.id, isDone, mediaUrl, job, promptText, savedToLibrary]);

  const handleDownload = () => {
    if (!canDownload) return;
    const a = document.createElement("a");
    a.href = mediaUrl;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownloadAudio = () => {
    if (!ttsUrl) return;
    const a = document.createElement("a");
    a.href = ttsUrl;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleCloseItem = () => {
    if (!STOP.has(status)) return;
    removeJob(id);
  };

  // --- voting -> DB ---------------------------------

  const persistVote = async (nextVote) => {
    if (!user?.id) return;

    setSavingVote(true);
    const numeric =
      nextVote === "up" ? 1 : nextVote === "down" ? -1 : 0;

    try {
      const { error } = await supabase
        .from("generation_feedback")
        .upsert(
          {
            user_id: user.id,
            job_id: id,
            tool: toolSlug || "unknown",
            vote: numeric,
          },
          { onConflict: "user_id,job_id" }
        );

      if (error) {
        console.error(error);
      }
    } finally {
      setSavingVote(false);
    }
  };

  const handleVote = async (side) => {
    if (!isDone || !mediaUrl || savingVote) return;

    const next = vote === side ? null : side;
    setVote(next);
    await persistVote(next);
  };

  return (
    <div className="generations-dock relative mb-4 rounded-3xl border border-white/12 bg-black/80 backdrop-blur-xl p-4">
      {bgVideo && !isDone && !isFailed && (
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-[0.05] pointer-events-none rounded-3xl"
          src={bgVideo}
          autoPlay
          muted
          loop
          playsInline
        />
      )}

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex flex-col">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-[#7A3BFF] uppercase">
            {label}
          </div>
          <div className="text-[11px] text-white/70">
            {isDone
              ? `Your ${noun} is ready`
              : isFailed
              ? "Something went wrong"
              : `${pct}% complete`}
          </div>
        </div>

        {STOP.has(status) && (
          <button
            onClick={handleCloseItem}
            className="text-white/40 hover:text-white/80 transition"
            aria-label="Remove from list"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {!isDone && !isFailed && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="w-5 h-5 animate-spin text-[#7A3BFF]" />
            <div className="flex-1 h-[7px] rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: BRAND,
                  boxShadow: `0 0 14px ${BRAND}`,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div className="text-[10px] text-white/70 w-[30px] text-right">
              {pct}%
            </div>
          </div>

          <div className="text-[11px] text-white/65 line-clamp-2">
            {promptText}
          </div>
        </>
      )}

      {isFailed && (
        <div className="text-[11px] text-rose-400">
          {job?.error || "Generation failed"}
        </div>
      )}

      {/* MAIN MEDIA CARD */}
      {isDone && mediaUrl && (
        <>
          <div className="relative mt-1 mb-3 rounded-2xl overflow-hidden bg-black/90 border border-white/10">
            {isVideo ? (
              <video
                src={mediaUrl}
                controls
                playsInline
                className="w-full max-h-[260px] object-contain bg-black"
              />
            ) : (
              <img
                src={mediaUrl}
                alt="Generated result"
                className="w-full max-h-[260px] object-contain bg-black"
              />
            )}

            <button
              onClick={handleDownload}
              disabled={!canDownload}
              className="absolute top-2 left-2 inline-flex items-center justify-center rounded-full bg-black/80 border border-white/30 px-2.5 py-1 gap-1.5 text-[9px] text-white/85 hover:text-white hover:bg-black"
            >
              <Download size={11} />
              <span>Save</span>
            </button>
          </div>

          <div className="text-[10px] text-white/65 mb-2 line-clamp-3">
            {promptText}
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* Votes */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleVote("up")}
                disabled={savingVote}
                className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] transition ${
                  vote === "up"
                    ? "border-[#7A3BFF] text-[#7A3BFF] bg-[#7A3BFF1a]"
                    : "border-white/20 text-white/70 hover:border-[#7A3BFF80] hover:text-[#7A3BFF]"
                }`}
              >
                <ThumbsUp size={13} />
              </button>

              <button
                onClick={() => handleVote("down")}
                disabled={savingVote}
                className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] transition ${
                  vote === "down"
                    ? "border-rose-400 text-rose-300 bg-rose-500/5"
                    : "border-white/20 text-white/70 hover:border-rose-400/70 hover:text-rose-300"
                }`}
              >
                <ThumbsDown size={13} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={!canDownload}
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] border transition ${
                  canDownload
                    ? "border-[#7A3BFFcc] text-[#7A3BFF] hover:bg-[#7A3BFF1a]"
                    : "border-white/15 text-white/30 cursor-not-allowed"
                }`}
              >
                <Download size={12} />
                <span>Download</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* 🔊 AUDIO CARD – SEPARATE FROM MEDIA, SHOWS AS SOON AS tts_url EXISTS */}
      {hasAudio && (
        <div className="mt-3 rounded-2xl border border-white/15 bg-black/70 px-3 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <div className="text-[11px] font-semibold text-white">
                Voice track ready{voiceMode ? ` · ${voiceMode}` : ""}
              </div>
              <div className="text-[10px] text-white/65">
                Download or preview the clean MP3 and drop it into your ad or
                timeline.
              </div>
            </div>

            <button
              onClick={handleDownloadAudio}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] border border-white/30 text-white/85 hover:bg-white/5"
            >
              <Download size={12} />
              <span>Audio</span>
            </button>
          </div>

          {/* play button + timeline */}
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={toggleAudio}
              className="h-8 w-8 rounded-full border border-white/30 flex items-center justify-center bg-black/70 hover:bg-white/10"
            >
              {audioPlaying ? (
                <Pause className="h-4 w-4 text-[#7A3BFF]" />
              ) : (
                <Play className="h-4 w-4 text-[#7A3BFF]" />
              )}
            </button>

            <div className="flex-1 h-1.5 rounded-full bg-white/12 overflow-hidden">
              <div
                className="h-full bg-[#7A3BFF] transition-[width] duration-100"
                style={{ width: `${Math.min(100, (audioProgress || 0) * 100)}%` }}
              />
            </div>

            <span className="text-[9px] text-white/50 w-[40px] text-right">
              {Math.round((audioProgress || 0) * 100)}%
            </span>
          </div>

          <audio
            ref={audioRef}
            src={ttsUrl || ""}
            onTimeUpdate={handleAudioTimeUpdate}
            onEnded={handleAudioEnded}
            className="hidden"
          />
        </div>
      )}

      {err && (
        <div className="mt-1 text-[9px] text-rose-400">
          {err}
        </div>
      )}
    </div>
  );
}



/* ================== DOCK UI ================== */

function GenerationsDock() {
  const {
    isOpen,
    setIsOpen,
    jobs,
    maxConcurrent,
    activeCount,
    canAddMore,
  } = useGenerations();

  const hasJobs = jobs.length > 0;
  const label = hasJobs
    ? `Generations (${activeCount}/${maxConcurrent})`
    : "Generations";

  const openDock = () => setIsOpen(true);
  const closeDock = () => setIsOpen(false);

  return (
    <>
      {/* Floating toggle pill */}
      <button
        type="button"
        onClick={openDock}
        className="gen-toggle-wrap hidden md:flex"
      >
        <div className="gen-toggle-btn">
          <span className="gen-dot" />
          <span>{label}</span>
        </div>
      </button>

      {/* Mobile pill */}
      <button
        type="button"
        onClick={openDock}
        className="gen-toggle-wrap md:hidden"
      >
        <div className="gen-toggle-btn">
          <span className="gen-dot" />
          <span>{label}</span>
        </div>
      </button>

      {/* Dock only rendered when open */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* backdrop */}
          <div
            className="flex-1 bg-black/40"
            onClick={closeDock}
          />
          {/* panel */}
          <div
            className="w-full sm:w-[360px] lg:w-[420px] h-full flex flex-col
                       bg-black/88 backdrop-blur-xl border-l border-white/8
                       px-4 pt-4 pb-4"
            style={{
              backgroundColor: PAGE_BG,
              boxShadow: "0 0 26px rgba(0,0,0,0.75)",
            }}
          >
            {/* header */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex flex-col">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9D7FFF]">
                  Generations
                </div>
                <div className="text-[11px] text-white/75 font-medium">
                  {hasJobs
                    ? `${activeCount}/${maxConcurrent} active • Newest on top`
                    : "Start a generation to track progress, preview & download here."}
                </div>
                {!canAddMore && (
                  <div className="text-[9px] text-amber-300/95 font-semibold mt-0.5">
                    Max parallel jobs reached for your plan.
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={closeDock}
                className="w-8 h-8 flex items-center justify-center rounded-full
                           border border-white/20 text-white/80 hover:text-white
                           hover:bg-white/5 transition"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* body */}
            <div className="flex-1 overflow-y-auto pr-1 mt-1 custom-scroll-thin">
              {hasJobs ? (
                jobs.slice(0, MAX_JOBS).map((j) => (
                  <GenerationItem key={j.id} id={j.id} />
                ))
              ) : (
                <div className="mt-10 text-[10px] text-white/40 leading-relaxed">
                  Run a generation from Product Photos— they’ll appear
                  here with live progress.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* styles */}
      <style>{`
        .gen-toggle-wrap {
          position: fixed;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 40;
        }
        .gen-toggle-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px 7px 14px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          color: #f9f5ff;
          background: rgba(2,3,10,0.98);
          border: 1px solid rgba(189,158,255,0.65);
          box-shadow: 0 4px 16px rgba(0,0,0,0.55);
          cursor: pointer;
        }
        .gen-toggle-btn::before {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 999px;
          background:
            radial-gradient(circle at 50% 50%, rgba(122,59,255,0.28), transparent);
          opacity: 0.9;
          z-index: -1;
          filter: blur(3px);
        }
        .gen-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #7A3BFF;
          box-shadow: 0 0 10px rgba(122,59,255,0.9);
        }
        @media (max-width: 768px) {
          .gen-toggle-wrap {
            right: auto;
            top: auto;
            bottom: 14px;
            left: 50%;
            transform: translateX(-50%);
          }
          .gen-toggle-btn {
            box-shadow: 0 4px 18px rgba(0,0,0,0.75);
          }
        }
      `}</style>
    </>
  );
}

export default GenerationsDock;
