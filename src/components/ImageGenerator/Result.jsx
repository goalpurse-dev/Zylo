import { useEffect, useMemo, useRef, useState } from "react";
import { DownloadIcon } from "lucide-react";
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
  const [visible, setVisible] = useState(true);
  const [posting, setPosting] = useState(false);
const [posted, setPosted] = useState(false);
const [showToast, setShowToast] = useState(false);
const [postedImages, setPostedImages] = useState(new Set());
const [isImageLoaded, setIsImageLoaded] = useState(false);




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

  if (!visible) return null;

  return (
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
<img
  src={item.result_url + "?format=webp&width=800"}
  referrerPolicy="no-referrer"
  crossOrigin="anonymous"
  className="w-full h-full object-cover"
  loading="lazy"
  decoding="async"
  onClick={() => onOpen?.(item)}

/>
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
   {/* LOADING */}
{!isDone && !isFailed && (
  <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">

    {/* 🔥 Animated background glow */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#7A3BFF]/20 via-transparent to-[#9D4EDD]/20 animate-pulse" />

    {/* 🔥 Shimmer overlay */}
    <div className="absolute inset-0">
      <div className="w-full h-full bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.08),transparent)] animate-[shimmer_2s_linear_infinite]" />
    </div>

    {/* 🔥 Fake blurred preview (feels like image forming) */}
    <div className="absolute inset-0 backdrop-blur-[6px] opacity-40" />

    {/* 🔥 Center content */}
    <div className="relative z-10 flex flex-col items-center">

      {/* Spinner upgraded */}
      <div className="relative">
        <svg className="w-16 h-16" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="url(#grad)"
            strokeWidth="6"
            strokeDasharray="40 220"
            strokeLinecap="round"
            className="origin-center animate-spin"
          />
          <defs>
            <linearGradient id="grad">
              <stop offset="0%" stopColor="#7A3BFF" />
              <stop offset="100%" stopColor="#C77DFF" />
            </linearGradient>
          </defs>
        </svg>

        {/* glow pulse */}
        <div className="absolute inset-0 rounded-full bg-[#7A3BFF]/20 blur-xl animate-pulse" />
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

<div className="flex gap-3 mt-2">

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
    className="flex items-center gap-1 text-white/90 hover:text-white text-xs font-medium"
  >
    <DownloadIcon className="w-4 h-4" />
    Download
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

      {/* PROGRESS BAR */}
      {!isDone && !isFailed && (
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="text-white/70 text-xs mb-2">
           Generating… {progress}%

          </p>
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#7A3BFF] to-[#492399] transition-all duration-300"
              style={{ width: `${Math.max(5, progress)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================== MAIN =============================== */

export default function Result({ results, activeJobId, userPlan }) {
  const latestRef = useRef(null);
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  setIsMobile(window.innerWidth < 768);
}, []);
 const [activeItem, setActiveItem] = useState(null);

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

    // 1) scroll card into view inside the scroll container
    el.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });

    // 2) push it a bit higher so fixed bottom UI doesn't cover it
  const bottomUIHeight = 100; // tweak this

setTimeout(() => {
  container.scrollBy({
    top: -(bottomUIHeight - 10),
    behavior: "smooth",
  });
}, 250);
  };

  requestAnimationFrame(scrollToCard);
}, [activeJobId]);

 

  return (
<div
  ref={latestRef}
 className="
  w-full
  bg-[#191B1C]
  flex flex-col
  px-4 pt-2 pb-[calc(90px+env(safe-area-inset-bottom))] md:pb-6
  rounded-[22px]
"
>
      <h1 className="text-[#F4F6FB] font-semibold text-[20px] mb-4">
        Recent Creations
      </h1>

   {photoResults.length === 0 ? (

  /* ================= EMPTY STATE ================= */
<div className="flex-1 flex flex-col items-center justify-center gap-3">

    <div className="relative">
      <img
        src="/assets/logos/sadzyvo.webp"
        className="w-20 h-20 opacity-70"
      />

      {/* subtle glow */}
      <div className="absolute inset-0 bg-[#7A3BFF]/20 blur-xl opacity-50" />
    </div>

    <p className="text-white/40 text-sm">
      No Images Generated Yet
    </p>

    <p className="text-white/20 text-xs">
      Your creations will appear here
    </p>

  </div>

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
        <ResultCard item={item} onOpen={setActiveItem} />
      </div>
    ))}
  </div>

)}
      
      {activeItem && (
  <div className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">

    {/* CLOSE */}
    <button
      onClick={() => setActiveItem(null)}
      className="absolute top-6 right-6 text-white/60 hover:text-white"
    >
      ✕
    </button>

    {/* CONTENT */}
    <div className="w-full max-w-[1100px] grid md:grid-cols-2 gap-6 items-center">

      {/* IMAGE */}
      <div className="rounded-2xl overflow-hidden bg-black">
        <img
          src={activeItem.result_url + "?width=1200"}
          className="w-full h-auto object-contain"
        />
      </div>

      {/* SIDE PANEL */}
      <div className="flex flex-col gap-4">

        {/* PROMPT */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-white/90 text-sm leading-relaxed">
            {activeItem.input?.subject ?? activeItem.prompt}
          </p>
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3">

          {/* COPY */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                activeItem.input?.subject ?? activeItem.prompt
              )
            }}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
          >
            Copy Prompt
          </button>

          {/* DOWNLOAD */}
          <button
            onClick={async () => {
              const res = await fetch(activeItem.result_url)
              const blob = await res.blob()

              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = "zyvo-image.webp"
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="px-4 py-2 rounded-lg bg-[#7A3BFF] hover:bg-[#6A32E0] text-white text-sm"
          >
            Download
          </button>

        </div>
      </div>
    </div>
  </div>
)}
    </div>
  );
}




