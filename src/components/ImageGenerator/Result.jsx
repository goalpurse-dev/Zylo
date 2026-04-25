import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DownloadIcon, VideoIcon, Maximize2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CREATION_TYPES } from "../../lib/creations";
import { supabase } from "../../lib/supabaseClient";

/* =============================== CONFIG =============================== */

const STUCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const STUCK_PROGRESS_MAX = 10;
const FAILED_HIDE_DELAY = 5000; // 5 seconds
const MAX_RUNTIME_MS = 5 * 60 * 1000; // hard limit
const MAX_RUNNING_TIME_MS = 60 * 1000; // UI fail after 1 min


/* =============================== HELPERS =============================== */

function isExpired(job) {
  if (!job?.created_at) return false;

  const age = Date.now() - new Date(job.created_at).getTime();

  if (job.status === "failed") return true;
  if (!job.result_url && job.progress >= 95 && age > MAX_RUNTIME_MS) return true;
  if (job.status === "running" && age > MAX_RUNTIME_MS) return true;
  if (job.status === "queued" && age > MAX_RUNTIME_MS) return true;

  return false;
}

function getAspectStyle(item) {
  const w = item?.input?.width;
  const h = item?.input?.height;

  // ✅ primary source: real dimensions
  if (Number(w) && Number(h)) {
    return { aspectRatio: `${w} / ${h}` };
  }

  // ⚠️ fallback: legacy string size
  const size = item?.settings?.size;
  if (typeof size === "string" && size.includes("x")) {
    const [sw, sh] = size.split("x").map(Number);
    if (sw && sh) {
      return { aspectRatio: `${sw} / ${sh}` };
    }
  }

  return { aspectRatio: "1 / 1" };
}

function scrollToElementWithinContainer(el, container, topOffset = 80) {
  if (!el) return;

  const c = container || window;

  // scrolling inside a div
  if (c !== window && c?.getBoundingClientRect) {
    const cRect = c.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const delta = elRect.top - cRect.top - topOffset;

    // ✅ only scroll a little (no big jumps)
    c.scrollBy({ top: delta, behavior: "smooth" });
    return;
  }

  // fallback: window scroll
  const elRect = el.getBoundingClientRect();
  const delta = elRect.top - topOffset;

  window.scrollBy({ top: delta, behavior: "smooth" });
}



/* =============================== CARD =============================== */

function ResultCard({ item, onOpen }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const [posting, setPosting] = useState(false);
const [posted, setPosted] = useState(false);
const [showToast, setShowToast] = useState(false);
const [postedImages, setPostedImages] = useState(new Set());
const [isImageLoaded, setIsImageLoaded] = useState(false);
const [viewerOpen, setViewerOpen] = useState(false);
const [displayProgress, setDisplayProgress] = useState(0);
const dpRef = useRef(0);
const rafRef = useRef(null);




useEffect(() => {
  let ignore = false;

  async function checkIfPosted() {
    if (!item?.result_url) return;

    const { data, error } = await supabase
      .from("public_images")
      .select("id")
      .or(`runware_url.eq.${item.result_url},image_url.eq.${item.result_url}`)
      .limit(1);

    if (!ignore && !error && data && data.length > 0) {
      setPosted(true);
    }
  }

  checkIfPosted();

  return () => {
    ignore = true;
  };
}, [item?.result_url]);

useEffect(() => {
  async function loadPosted() {
    const { data, error } = await supabase
      .from("public_images")
      .select("runware_url, image_url");

    if (error) {
      console.error("Failed to load posted images:", error);
      return;
    }

    const urls = new Set(
      (data || []).flatMap((d) => [d.runware_url, d.image_url])
    );

    setPostedImages(urls);
  }

  loadPosted();
}, []);
 
const handlePublish = async () => {
  if (posting || posted) return;

  setPosting(true);

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    setPosting(false);
    return;
  }

  const prompt = item.input?.subject ?? item.prompt;
  const runwareUrl = item.result_url;

  try {

    // 1️⃣ download image
   const response = await fetch(runwareUrl);
const originalBlob = await response.blob();

// convert to WEBP
const bitmap = await createImageBitmap(originalBlob);

const canvas = document.createElement("canvas");
canvas.width = bitmap.width;
canvas.height = bitmap.height;

const ctx = canvas.getContext("2d");
ctx.drawImage(bitmap, 0, 0);
bitmap.close(); // ✅ ADD THIS

const webpBlob = await new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) return reject(new Error("WEBP conversion failed"));
    resolve(blob);
  }, "image/webp", 0.82);
});

const fileName = `${crypto.randomUUID()}.webp`;

const { error: uploadError } = await supabase.storage
  .from("public-images")
  .upload(fileName, webpBlob, {
    contentType: "image/webp"
  });

    if (uploadError) {
      console.error("UPLOAD ERROR:", uploadError);
      setPosting(false);
      return;
    }

    // 4️⃣ get public URL
    const { data } = supabase.storage
      .from("public-images")
      .getPublicUrl(fileName);

    const supabaseUrl = data.publicUrl;

    // 5️⃣ insert into DB
    const { error } = await supabase
      .from("public_images")
      .insert({
        user_id: user.id,
        image_url: supabaseUrl,
        runware_url: runwareUrl,
        prompt
      });

    if (error) {
      console.error("INSERT ERROR:", error);
      setPosting(false);
      return;
    }

    setPosted(true);
    setShowToast(true);

    setTimeout(() => setShowToast(false), 3000);

  } catch (err) {
    console.error(err);
  }

  setPosting(false);
};



const isDone = item.status === "succeeded" && !!item.result_url;

  const progress = Math.min(
  99,
  Math.floor(Number(item.progress ?? 0))
);


  const createdAt = item.created_at
    ? new Date(item.created_at).getTime()
    : 0;

 const runtimeMs =
  createdAt > 0 ? Date.now() - createdAt : 0;

const isFailed =
  !isDone &&
  item.status === "running" &&
  runtimeMs > MAX_RUNTIME_MS;


  /* auto-hide failed card */
  useEffect(() => {
    if (!isFailed) return;
    const t = setTimeout(() => setVisible(false), FAILED_HIDE_DELAY);
    return () => clearTimeout(t);
  }, [isFailed]);

  /* smooth progress animation */
  useEffect(() => {
    const target = Math.min(99, Math.floor(Number(item.progress ?? 0)));
    if (isDone) { dpRef.current = 100; setDisplayProgress(100); return; }
    if (target <= dpRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const startVal = dpRef.current;
    const startTime = performance.now();
    const dist = Math.max(1, target - startVal);
    const duration = Math.max(250, dist * 18);
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const next = Math.round(startVal + dist * ease);
      dpRef.current = next;
      setDisplayProgress(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [item.progress, isDone]);

  if (!visible) return null;

  return (
    <>
    <div className="
  group
  relative
  rounded-2xl
  overflow-hidden
  bg-[#0B0F1A]
  border border-white/5
  hover:border-[#7A3BFF]/40
  transition-all duration-300
">
     <div className="relative w-full bg-black overflow-hidden rounded-xl">
  {/* ASPECT RATIO SPACER */}
<div
  className="w-full"
  style={{
    aspectRatio: (() => {
      const w = item?.input?.width;
      const h = item?.input?.height;
      if (w && h) return `${w} / ${h}`;
      return "1 / 1";
    })(),
  }}
/>


  {/* ABSOLUTE CONTENT */}
  <div className="absolute inset-0">
    {/* DONE */}
{isDone && (
<>
<img
  src={item.result_url + "?format=webp&width=800"}
  referrerPolicy="no-referrer"
  crossOrigin="anonymous"
  className="w-full h-full object-cover"
  loading="lazy"
  decoding="async"
/>
{/* EXPAND ICON — always visible top-right */}
<button
  onClick={(e) => { e.stopPropagation(); setViewerOpen(true); }}
  className="absolute top-2 right-2 z-20 w-7 h-7 flex items-center justify-center rounded-lg bg-black/50 hover:bg-black/80 backdrop-blur-sm text-white/80 hover:text-white transition active:scale-95"
  title="Open fullscreen"
>
  <Maximize2 className="w-3.5 h-3.5" />
</button>
</>
)}

    {/* FAILED */}
 {isFailed && (
  <div className="w-full h-full flex flex-col items-center justify-center bg-black gap-1">
    <p className="text-white/80 text-sm font-medium">
      Generation failed
    </p>
    <p className="text-white/40 text-xs">
      Try again
    </p>
  </div>
)}


{showToast && (
  <div className="
    fixed z-[9999] bottom-6 left-1/2 -translate-x-1/2
    bg-[#1a1d24] border border-white/10
    text-white text-sm px-4 py-2 rounded-lg
    shadow-lg
    animate-[fadeInUp_.3s_ease]
  ">
    ✅ Image posted to Zyvo Public Gallery
  </div>
)}



    {/* LOADING */}
{!isDone && !isFailed && (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#060912] overflow-hidden">

    {/* Ambient orbs */}
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: "65%", paddingBottom: "65%", top: "5%", left: "18%",
        background: "radial-gradient(circle, rgba(122,59,255,0.18), transparent)",
        filter: "blur(32px)",
        animation: "pulse 2.8s ease-in-out infinite",
      }}
    />
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: "40%", paddingBottom: "40%", bottom: "8%", right: "8%",
        background: "radial-gradient(circle, rgba(192,119,255,0.12), transparent)",
        filter: "blur(24px)",
        animation: "pulse 3.5s ease-in-out 1.2s infinite",
      }}
    />

    {/* Diagonal shimmer sweep */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }}>
      <div
        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.025] to-transparent"
        style={{ animation: "shimmer 3s ease-in-out infinite", transform: "skewX(-15deg)" }}
      />
    </div>

    {/* Progress ring */}
    <div className="relative z-10 flex flex-col items-center gap-3">
      <div className="relative">
        <svg
          className="w-[68px] h-[68px]"
          style={{ transform: "rotate(-90deg)" }}
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id={`imgRing_${item.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7A3BFF" />
              <stop offset="100%" stopColor="#C077FF" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke={`url(#imgRing_${item.id})`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="251.3"
            strokeDashoffset={251.3 * (1 - displayProgress / 100)}
            style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>

        {/* Percent — not rotated */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white/85 text-[12px] font-semibold tabular-nums leading-none">
            {displayProgress}%
          </span>
        </div>

        {/* Glow halo */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: "-8px",
            background: "radial-gradient(circle, rgba(122,59,255,0.22), transparent 70%)",
            filter: "blur(10px)",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
      </div>

      {/* Status label + dots */}
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-white/40 text-[10px] font-medium tracking-[0.12em] uppercase">
          {displayProgress < 5
            ? "Queuing"
            : displayProgress < 35
            ? "Generating"
            : displayProgress < 75
            ? "Rendering"
            : displayProgress < 95
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
    </div>

    {/* Bottom progress bar */}
    <div className="absolute bottom-0 inset-x-0" style={{ zIndex: 10 }}>
      <div className="h-[2px] w-full bg-white/[0.04]">
        <div
          className="h-full rounded-r-full"
          style={{
            width: `${Math.max(2, displayProgress)}%`,
            background: "linear-gradient(90deg, #7A3BFF, #C077FF)",
            transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
            boxShadow: "0 0 8px rgba(122,59,255,0.65)",
          }}
        />
      </div>
    </div>

  </div>
)}
  </div>
</div>


      {/* HOVER PROMPT */}
      {isDone && (
        <div className="
          absolute inset-0
          bg-gradient-to-t from-black/70 via-black/20 to-transparent
          opacity-0 group-hover:opacity-100
          transition-opacity duration-300
          flex flex-col justify-end
          p-4
        ">
          <p className="text-white text-sm leading-snug line-clamp-4">
            {item.input?.subject ?? item.prompt}
          </p>

<div className="flex items-center gap-2 mt-2">

  <button
    onClick={async () => {
      const res = await fetch(item.result_url + "?width=1200");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "zyvo-image.webp";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }}
    className="flex items-center justify-center w-7 h-7 rounded-md bg-white/15 hover:bg-white/25 text-white/90 hover:text-white transition active:scale-95"
    title="Download"
  >
    <DownloadIcon className="w-3.5 h-3.5" />
  </button>

  <button
    onClick={() =>
      navigate("/workspace/video-generator", {
        state: { refImage: { id: item.id, url: item.result_url } },
      })
    }
    className="flex items-center gap-1 text-white text-xs px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 transition active:scale-95"
  >
    <VideoIcon className="w-3.5 h-3.5" />
    Make Video
  </button>

  <button
    onClick={handlePublish}
    disabled={posting || posted}
    className={`text-white text-xs px-3 py-1 rounded-md transition-all duration-200
      ${posted
        ? "bg-green-500 cursor-default"
        : posting
        ? "bg-purple-400 cursor-wait"
        : "bg-[#7A3BFF] hover:bg-[#6a32e6] active:scale-95"}
    `}
  >
    {posted ? "Posted ✓" : posting ? "Posting..." : "Post"}
  </button>

</div>
        </div>
      )}

    </div>

    {/* ===== FULLSCREEN VIEWER PORTAL ===== */}
    {viewerOpen && isDone && createPortal(
      <div
        className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col"
        onClick={(e) => { if (e.target === e.currentTarget) setViewerOpen(false); }}
      >
        {/* TOP BAR */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
          <p className="text-white/40 text-xs truncate max-w-[75%]">
            {item.input?.subject ?? item.prompt}
          </p>
          <button
            onClick={() => setViewerOpen(false)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            ✕
          </button>
        </div>

        {/* IMAGE */}
        <div className="flex-1 flex items-center justify-center px-4 min-h-0">
          <img
            src={item.result_url + "?width=1200"}
            className="max-w-full max-h-full rounded-2xl object-contain"
            style={{ maxHeight: "calc(100dvh - 160px)" }}
          />
        </div>

        {/* ACTIONS */}
        <div className="flex-shrink-0 px-4 py-4 flex items-center justify-center flex-wrap gap-3">

          {/* DOWNLOAD */}
          <button
            onClick={async () => {
              try {
                const res = await fetch(item.result_url + "?width=1200");
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "zyvo-image.webp";
                document.body.appendChild(a); a.click(); a.remove();
                URL.revokeObjectURL(url);
              } catch { window.open(item.result_url, "_blank"); }
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#7A3BFF] hover:bg-[#6A32E0] text-white font-semibold text-sm transition active:scale-95 shadow-[0_0_20px_rgba(122,59,255,0.4)]"
          >
            <DownloadIcon className="w-4 h-4" />
            Save Image
          </button>

          {/* MAKE VIDEO */}
          <button
            onClick={() => {
              setViewerOpen(false);
              navigate("/workspace/video-generator", {
                state: { refImage: { id: item.id, url: item.result_url } },
              });
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition active:scale-95"
          >
            <VideoIcon className="w-4 h-4" />
            Make Video
          </button>

          {/* POST */}
          <button
            onClick={() => { handlePublish(); }}
            disabled={posting || posted}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition active:scale-95
              ${posted ? "bg-green-500 text-white cursor-default"
                : posting ? "bg-purple-400 text-white cursor-wait"
                : "bg-white/10 hover:bg-white/20 text-white"}`}
          >
            {posted ? "Posted ✓" : posting ? "Posting…" : "Post to Gallery"}
          </button>

          {/* COPY PROMPT */}
          <button
            onClick={() => navigator.clipboard.writeText(item.input?.subject ?? item.prompt)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition active:scale-95"
          >
            Copy Prompt
          </button>

          {/* SHARE */}
          {"share" in navigator && (
            <button
              onClick={() => navigator.share({ url: item.result_url, title: "My Zyvo image" }).catch(() => {})}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition active:scale-95"
            >
              Share
            </button>
          )}

        </div>
      </div>,
      document.body
    )}
    </>
  );
}

/* =============================== MAIN =============================== */

const THINKING_PHRASES = [
  "Thinking…",
  "Reading your prompt…",
  "Crafting the scene…",
  "Placing subjects…",
  "Adding light and depth…",
  "Enhancing realism…",
  "Sharpening details…",
  "Finalizing…",
];

function ThinkingBanner({ progress }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % THINKING_PHRASES.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hidden md:flex flex-col items-center justify-center gap-6 py-20 select-none">
      {/* Animated orb */}
      <div className="relative w-24 h-24">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(122,59,255,0.35), transparent 70%)",
            filter: "blur(16px)",
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
        <svg className="w-full h-full" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke="url(#thinkGrad)" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 40}`}
            strokeDashoffset={`${2 * Math.PI * 40 * (1 - (progress || 10) / 100)}`}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
          <defs>
            <linearGradient id="thinkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7A3BFF" />
              <stop offset="100%" stopColor="#C077FF" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white/70 text-[13px] font-semibold tabular-nums">{progress || 10}%</span>
        </div>
      </div>

      {/* Cycling phrase */}
      <div className="text-center">
        <p
          key={idx}
          className="text-white/60 text-[15px] font-medium"
          style={{ animation: "fadePhrase 0.4s ease" }}
        >
          {THINKING_PHRASES[idx]}
        </p>
        <div className="flex justify-center gap-1 mt-3">
          {[0,1,2].map((i) => (
            <span key={i} className="w-1 h-1 rounded-full bg-[#7A3BFF]/50 animate-bounce"
              style={{ animationDelay: `${i * 160}ms`, animationDuration: "1.1s" }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadePhrase {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default function Result({ results, activeJobId, userPlan }) {
  const latestRef = useRef(null);
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  setIsMobile(window.innerWidth < 768);
}, []);

const hasScrolledRef = useRef(false);


useEffect(() => {
  const handleResize = () => {
    setIsMobile(window.innerWidth < 768);
  };

  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);

  // ✅ filter valid photo jobs
const photoResults = useMemo(
  () =>
    Array.isArray(results)
      ? [...results]
          .filter(
            (r) =>
              r?.settings?.creation_type === CREATION_TYPES.PHOTO &&
              !isExpired(r)
          )
          .sort(
            (a, b) =>
              new Date(b.created_at || 0).getTime() -
              new Date(a.created_at || 0).getTime()
          )
          .slice(0, isMobile ? 15 : 30)
      : [],
  [results]
);

const cardRefs = useRef({});

useEffect(() => {
  if (!activeJobId) return;

  hasScrolledRef.current = false;
  let tries = 0;

  const scrollToCard = () => {
    const el = cardRefs.current[activeJobId];
    const container = document.getElementById("workspace-scroll");

    if (!el || !container) {
      if (tries < 40) {
        tries++;
        requestAnimationFrame(scrollToCard);
      }
      return;
    }

    if (hasScrolledRef.current) return;
    hasScrolledRef.current = true;

    // Scroll so card sits 20px from the top of the scroll container — single scroll, no jitter
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetTop = container.scrollTop + (elRect.top - containerRect.top) - 20;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  };

  requestAnimationFrame(scrollToCard);
}, [activeJobId]);

 

  return (
<div
  ref={latestRef}
 className="
  w-full md:min-h-full
  bg-[#191B1C]
  flex flex-col
  px-4 pt-2 md:pb-6
  rounded-[22px]
"
>
      <h1 className="text-[#F4F6FB] font-semibold text-[20px] mb-4">
        Recent Creations
      </h1>

   {photoResults.length === 0 ? (

  /* ================= EMPTY / THINKING STATE ================= */
  activeJobId ? (
    <ThinkingBanner
      progress={Math.min(99, Math.floor(Number(
        results?.find(r => r.id === activeJobId)?.progress ?? 10
      )))}
    />
  ) : (
  <div className="flex-1 flex flex-col items-center justify-center gap-3 select-none py-16 pb-[120px] md:pb-16">
    <img
      src="/assets/logos/sadzyvo.webp"
      className="w-20 h-20 opacity-50"
      alt=""
    />
    <p className="text-white/60 text-sm font-semibold">No generated content yet</p>
    <p className="text-white/25 text-xs">Your creations will appear here</p>
  </div>
  )

) : (

  /* ================= GRID ================= */
  <div
    className="
      grid
      grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4
      gap-3
    "
  >
    {photoResults.map((item) => (
      <div
        key={item.id}
        ref={(el) => {
          if (el) cardRefs.current[item.id] = el;
        }}
      >
        <ResultCard item={item} />
      </div>
    ))}
  </div>

)}
      
{/* REAL BOTTOM SPACER (NO LAG) */}
<div
  style={{
    height: "150px", // adjust to your nav + generate height
  }}
/>
    </div>
    
  );
}




