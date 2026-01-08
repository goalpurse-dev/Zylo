// src/pages/JobProgress.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { ArrowLeft, Copy, ThumbsUp, ThumbsDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { upsertCreation, CREATION_TYPES } from "../lib/creations";

const BRAND = "#1677FF";
const PAGE_BG = "#0c1218";
const STOP = new Set(["succeeded", "failed", "canceled"]);

/* ---------- UI helpers ---------- */
function phaseLabel(status, pct) {
  if (status === "failed") return "Failed";
  if (status === "queued") return "Waiting…";
  if (pct < 10) return "Analyzing…";
  if (pct < 90) return "Rendering…";
  if (pct < 99) return "Finalizing…";
  return "Uploading…";
}
function Spinner() {
  return (
    <div
      className="w-10 h-10 rounded-full border-4 border-white/35 border-t-white animate-spin"
      aria-label="Loading"
    />
  );
}

/* ---------- tiny utils ---------- */
const clamp01 = (n) => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

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

/* ---------- main ---------- */
export default function JobProgress() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [err, setErr] = useState(null);
  const [vote, setVote] = useState(null);
  const [copied, setCopied] = useState(false);

  // progress that never goes backwards
  const maxSeenRef = useRef(0);
  const prevStatusRef = useRef(null);
  const [uiPct, setUiPct] = useState(0); // START AT 0
  const pct = useAnimatedNumber(uiPct, 450);

  const status = job?.status ?? "running";
  const isDone = status === "succeeded";
  const isFailed = status === "failed";
  const mediaUrl = job?.result_url || job?.url || null;

  const label = useMemo(() => phaseLabel(status, pct), [status, pct]);
  const isImage = (job?.type || "").toLowerCase() === "image";
  const noun = isImage ? "image" : "video";

  const promptText =
    job?.prompt || job?.input?.prompt || job?.input?.subject || "(no prompt provided)";
  const title =
    job?.title || job?.prompt || job?.input?.subject || "Your generated result";
  const showTitle =
    !!title && title.trim().toLowerCase() !== String(promptText).trim().toLowerCase();

  const bgVideo = job?.meta?.bgVideo || job?.input?.bgVideo || null;

  const canDownload = isDone && mediaUrl;
  const onDownload = () => {
    if (!canDownload) return;
    const a = document.createElement("a");
    a.href = mediaUrl;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(String(promptText));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (_) {}
  };

  // unified progress logic with proper "queued" behavior
  const apply = (r) => {
    if (!r) return;
    setJob((prev) => {
      // ignore strictly older frames
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
        } else if (r.status === "running" || r.status === "processing") {
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
        maxSeenRef.current = targetPct;
        setUiPct(targetPct);
      }
      if (r.status === "succeeded") {
        maxSeenRef.current = 100;
        setUiPct(100);
      }
      return r;
    });
  };

  // fetch once + realtime (UPDATE only) + safety poll
  useEffect(() => {
    if (!id) return;
    let mounted = true;

    const fetchOnce = async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!mounted) return;
      if (error) setErr(error.message);
      else if (data) apply(data);
    };

    fetchOnce();

    const ch = supabase
      .channel(`job-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${id}` },
        (payload) => apply(payload.new)
      )
      .subscribe();

    const iv = setInterval(fetchOnce, 2500);

    return () => {
      mounted = false;
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
  }, [id]);

  // Save to Library after success
  const { user } = useAuth();
  const [savedToLibrary, setSavedToLibrary] = useState(false);

  // Robust classifier for Library type buckets
function mapJobToCreationType(j) {
  const url = j?.result_url || j?.url || "";
  const isVideoUrl = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

  // A reliable "tool" string from your job payloads (add more keys if you use others)
  const tool =
    (j?.input?.tool ||
     j?.meta?.tool ||
     j?.tool ||
     j?.input?.source ||
     j?.meta?.source ||
     "").toLowerCase();

  // Optional explicit flags your flows may set
  const kind = (j?.input?.kind || j?.meta?.kind || "").toLowerCase();

  // --- STRICT buckets ---
  // Ad Studio only (do NOT infer from the prompt)
  const isAd =
    tool.includes("ad-studio") ||
    tool.includes("adstudio") ||
    kind === "ad" ||
    j?.input?.is_ad === true ||
    j?.meta?.is_ad === true;

  // Product Photos (image results tied to a product)
  const hasProduct =
    !!j?.input?.product ||
    !!j?.input?.product_id ||
    !!j?.meta?.product_id;

  const isProductPhotosFlow =
    tool.includes("product-photos") ||
    tool.includes("product_photo") ||
    tool.includes("productphotos") ||
    kind === "product_photo";

  if (isAd) return CREATION_TYPES.PRODUCT_AD;
  if (!isVideoUrl && (isProductPhotosFlow || hasProduct)) {
    return CREATION_TYPES.PRODUCT_PHOTO;
  }
  if (isVideoUrl) return CREATION_TYPES.VIDEO;
  return CREATION_TYPES.PHOTO;
}

  useEffect(() => {
    if (!user?.id) return;
    if (!isDone || !mediaUrl) return;
    if (savedToLibrary) return;

    const type = mapJobToCreationType(job);
    const payload = {
      user_id: user.id,
      type,
      file_url: mediaUrl,
      prompt: job?.prompt || job?.input?.prompt || job?.input?.subject || null,
      meta: job?.settings || job?.input || null,
    };

    upsertCreation(payload)
      .then(() => setSavedToLibrary(true))
      .catch((e) => console.error("Failed to save creation:", e));
  }, [user?.id, isDone, mediaUrl, job, savedToLibrary]);

  /* ------------------- UI ------------------- */
  return (
    <>
      <div className="min-h-screen w-full flex flex-col" style={{ background: PAGE_BG }}>
        <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
          {!isDone && !isFailed && bgVideo && (
            <video
              className="absolute inset-0 w-full h-full object-cover opacity-70"
              src={bgVideo}
              autoPlay
              muted
              loop
              playsInline
            />
          )}

          {!isDone && !isFailed && (
            <>
              <div className="relative z-10 flex flex-col items-center justify-center text-center px-6">
                <Spinner />
                <div className="mt-4 text-white/90 text-lg md:text-xl">{label}</div>
                <div className="mt-1 text-white/80 text-sm md:text-base">
                  {pct}% of the {noun} is ready
                </div>
                {pct >= 10 && (
                  <div className="mt-2 text-emerald-300 text-sm font-medium">
                    ✓ Done Analyzing!
                  </div>
                )}
              </div>

              <div className="absolute left-0 right-0 bottom-6 z-10 px-6 md:px-10">
                <div className="h-3 rounded-full overflow-hidden bg-white/15 backdrop-blur-sm">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: BRAND,
                      transition: "width .45s ease",
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {isDone && mediaUrl && (
            <div className="relative z-10 w-full flex flex-col items-center">
              <div className="flex items-center justify-center w-full" style={{ background: PAGE_BG }}>
                {/\.(mp4|webm|mov|m4v)(\?|$)/i.test(mediaUrl) ? (
                  <video
                    controls
                    playsInline
                    src={mediaUrl}
                    className="block w-auto h-auto max-w-[96vw] max-h-[72vh] object-contain"
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt="result"
                    className="block w-auto h-auto max-w-[96vw] max-h-[72vh] object-contain"
                  />
                )}
              </div>

              <div className="h-3" />

              <div className="w-full max-w-6xl px-4 sm:px-6">
                {showTitle && (
                  <div className="text-white text-base sm:text-lg font-semibold truncate mb-2">
                    {title}
                  </div>
                )}

                {/* Prompt */}
                <div className="mb-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-white/55 mb-2">
                    Prompt
                  </div>

                  <div className="relative">
                    <button
                      onClick={copyPrompt}
                      className="absolute right-2 top-2 inline-flex items-center gap-1 text-xs text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-md px-2 py-1"
                      title="Copy prompt"
                    >
                      <Copy size={14} />
                      {copied ? "Copied" : "Copy"}
                    </button>

                    <div className="rounded-lg border border-white/10 bg-white/[.04] p-3 max-h-28 overflow-auto">
                      <div className="text-sm text-white/90 whitespace-pre-wrap pt-7 pr-16">
                        {promptText}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-4">
                  <button
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-white/85 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-md"
                  >
                    <ArrowLeft size={18} strokeWidth={1.75} />
                    <span className="text-sm">Back</span>
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setVote(vote === "up" ? null : "up")}
                      className={`inline-flex items-center justify-center rounded-md border px-2 py-1 transition ${
                        vote === "up"
                          ? "border-white/40 text-white"
                          : "border-white/20 text-white/70 hover:border-white/35 hover:text-white"
                      }`}
                      title="Thumbs up"
                    >
                      <ThumbsUp size={18} strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => setVote(vote === "down" ? null : "down")}
                      className={`inline-flex items-center justify-center rounded-md border px-2 py-1 transition ${
                        vote === "down"
                          ? "border-white/40 text-white"
                          : "border-white/20 text-white/70 hover:border-white/35 hover:text-white"
                      }`}
                      title="Thumbs down"
                    >
                      <ThumbsDown size={18} strokeWidth={1.75} />
                    </button>

                    <button
                      onClick={onDownload}
                      disabled={!canDownload}
                      className={`text-sm px-3 sm:px-4 py-1.5 rounded-md ${
                        canDownload
                          ? "bg-blue-600 hover:bg-blue-500 text-white"
                          : "bg-white/10 text-white/50 cursor-not-allowed"
                      }`}
                    >
                      Download
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isFailed && (
            <div className="relative z-10 text-rose-300 text-lg">
              {job?.error || "Generation failed"}
            </div>
          )}
        </div>
      </div>

      {err && <div className="fixed left-4 top-4 text-red-400 text-sm">Error: {err}</div>}
    </>
  );
}
 