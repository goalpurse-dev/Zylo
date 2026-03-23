import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, VideoOff } from "lucide-react";
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

export default function Result({ results = [] }) {
  const scrollRef = useRef(null);
  const [activeVideo, setActiveVideo] = useState(null);

  /* =============================== FILTER =============================== */

  const videoResults = useMemo(() => {
    if (!Array.isArray(results)) return [];

    return results
      .filter(
        (r) =>
          r?.type === "video" && // DB level safety
          r?.settings?.creation_type === CREATION_TYPES.VIDEO &&
          !isExpired(r)
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
  }, [results]);


const handleDownload = async (url) => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // 📱 MOBILE → just open the video directly
  if (isMobile) {
    window.open(url, "_blank");
    return;
  }

  // 💻 DESKTOP → force download
  try {
    const res = await fetch(url);
    const blob = await res.blob();

    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "zyvo-video.mp4";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(blobUrl);

  } catch (err) {
    console.error(err);
    window.open(url, "_blank");
  }
};

  /* =============================== AUTO SELECT =============================== */

useEffect(() => {
  if (videoResults.length === 0) {
    setActiveVideo(null);
    return;
  }

  const newest = videoResults[0];

  // Only auto select on desktop
  if (!activeVideo && window.innerWidth >= 768) {
    setActiveVideo(newest);
  }

}, [videoResults]);

  /* =============================== SCROLL =============================== */

  const scroll = (dir) => {
    if (!scrollRef.current) return;

    const amount = Math.floor(scrollRef.current.clientWidth * 0.7);

    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  /* =============================== FAIL DETECTION =============================== */

  const createdAt = activeVideo?.created_at
    ? new Date(activeVideo.created_at).getTime()
    : 0;

  const runtimeMs =
    createdAt > 0 ? Date.now() - createdAt : 0;

  const isFailed =
    activeVideo &&
    activeVideo.status === "running" &&
    runtimeMs > MAX_RUNTIME_MS;

    

  /* =============================== RENDER =============================== */

  return (
    <div className="w-full min-w-0 overflow-hidden flex flex-col gap-6 pb-24 md:pb-0">

      {/* ================= THUMBNAILS ================= */}
      <div className="relative w-full min-w-0 overflow-hidden">

        {/* Edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#12141A] to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#12141A] to-transparent z-10" />

        {/* Left arrow */}
        {videoResults.length > 0 && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/55 hover:bg-black/80 backdrop-blur-md p-2 rounded-full border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
            type="button"
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
        )}

        {/* Right arrow */}
        {videoResults.length > 0 && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/55 hover:bg-black/80 backdrop-blur-md p-2 rounded-full border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
            type="button"
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        )}

        {/* Scroll container */}
        <div
          ref={scrollRef}
          className="w-full overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth px-[30px]"
        >
          <div className="flex gap-4 py-4">

            {videoResults.length === 0 ? (
              <div className="w-full text-center text-white/30 text-sm py-8" />
            ) : (
              videoResults.map((item) => {
                const isActive = activeVideo?.id === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveVideo(item)}
                    className={`
                      flex-shrink-0
                      aspect-square
                      w-[92px] sm:w-[110px] md:w-[118px] lg:w-[128px]
                      rounded-2xl
                      overflow-hidden
                      border
                      transition-all
                      ${
                        isActive
                          ? "border-[#7A3BFF] shadow-[0_0_18px_rgba(122,59,255,0.35)]"
                          : "border-white/10 hover:border-white/30"
                      }
                      bg-black
                    `}
                  >
                   {/* SUCCESS */}
{item.result_url && (
<video
  src={item.result_url}
  poster={item.thumbnail_url || ""}
  className="w-full h-full object-cover"
  muted
  playsInline
  autoPlay
  loop
  preload="metadata"
/>
)}

{/* LOADING */}
{!item.result_url && (
  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-black">
    
    {/* Spinner */}
    <svg className="w-8 h-8" viewBox="0 0 100 100">
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="6"
      />
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="#7A3BFF"
        strokeWidth="6"
        strokeDasharray="28 260"
        strokeLinecap="round"
        className="origin-center animate-spin"
      />
    </svg>

    {/* Optional Progress */}
    {typeof item.progress === "number" && (
      <p className="text-[10px] text-white/50">
        {Math.floor(item.progress)}%
      </p>
    )}
  </div>
)}
                  </button>
                );
              })
            )}

          </div>
        </div>
      </div>

      {/* ================= BIG PLAYER ================= */}
      <div className="w-full min-w-0 overflow-hidden">
<div className="
  w-full 
  max-w-[1100px]
  mx-auto 
  rounded-2xl 
  relative 
  flex 
  items-center 
  justify-center

  p-6
">
          {isFailed && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-white/80 text-sm font-medium">
                Generation failed
              </p>
              <p className="text-white/40 text-xs">
                Try again
              </p>
            </div>
          )}

          {/* EMPTY STATE */}
          {!activeVideo && !isFailed && (
            <div className="flex flex-col items-center ">
              <img src="/assets/logos/sadzyvo.webp" className="w-20 h-20 text-white/20" />
              <p className="text-white/40 text-sm">
                No Videos Generated Yet
              </p>
            </div>
          )}

          {/* SUCCESS STATE */}
{activeVideo?.result_url && !isFailed && (
  <div className="relative w-full rounded-2xl overflow-hidden flex flex-col items-center gap-4">
    
    <video
      key={activeVideo.id}
      src={activeVideo.result_url}
      controls
      autoPlay
      playsInline
      className="w-full max-h-[70vh] object-contain"
    />

    {/* DOWNLOAD BUTTON */}
    <button
      onClick={() => handleDownload(activeVideo.result_url)}
      className="
        flex items-center gap-2
        px-4 py-2
        rounded-xl
        bg-[#7A3BFF]
        hover:bg-[#6a30e0]
        text-white text-sm font-medium
        transition-all
      "
    >
      <Download className="w-4 h-4" />
      Download Video
    </button>

 <p className="text-white/40 text-xs">
  Tap download → then press “Save video”
</p>


  </div>
)}

       
        </div>
      </div>

    </div>
  );
}