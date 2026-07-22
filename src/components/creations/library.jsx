// src/pages/Library.jsx
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { Download, X, ChevronLeft, ChevronRight, Clapperboard, Images } from "lucide-react";
import { FULL_VIDEO_TOOL_KEY } from "../../lib/jobs";

/* =====================================================
   HORIZONTAL ROW
===================================================== */
function HorizontalRow({ title, items, getImageUrl, onItemClick, isVideo = false, emptyText = "No creations yet." }) {
  const rowRef = useRef(null);

  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  useEffect(() => {
    const slider = rowRef.current;
    if (!slider) return;

    const handleMouseDown = (e) => {
      isDown.current = true;
      slider.classList.add("cursor-grabbing");
      startX.current = e.pageX - slider.offsetLeft;
      scrollLeft.current = slider.scrollLeft;
    };

    const handleMouseLeave = () => {
      isDown.current = false;
      slider.classList.remove("cursor-grabbing");
    };

    const handleMouseUp = () => {
      isDown.current = false;
      slider.classList.remove("cursor-grabbing");
    };

    const handleMouseMove = (e) => {
      if (!isDown.current) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX.current) * 1.5;
      slider.scrollLeft = scrollLeft.current - walk;
    };

    slider.addEventListener("mousedown", handleMouseDown);
    slider.addEventListener("mouseleave", handleMouseLeave);
    slider.addEventListener("mouseup", handleMouseUp);
    slider.addEventListener("mousemove", handleMouseMove);

    return () => {
      slider.removeEventListener("mousedown", handleMouseDown);
      slider.removeEventListener("mouseleave", handleMouseLeave);
      slider.removeEventListener("mouseup", handleMouseUp);
      slider.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const scroll = (dir) => {
    if (!rowRef.current) return;
    rowRef.current.scrollBy({
      left: dir === "left" ? -260 : 260,
      behavior: "smooth",
    });
  };

  return (
    <div className="mt-4 px-6 lg:px-10 xl:px-12">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[#F4F6FB] text-[20px] sm:text-[22px] font-semibold">
          {title}
        </h1>

        <div className="flex gap-2 sm:hidden">
          <button onClick={() => scroll("left")} className="bg-white shadow rounded-full p-2">
            <ChevronLeft className="h-4 w-4 text-[#110829]" />
          </button>
          <button onClick={() => scroll("right")} className="bg-white shadow rounded-full p-2">
            <ChevronRight className="h-4 w-4 text-[#110829]" />
          </button>
        </div>
      </div>

      <div
        ref={rowRef}
        className="
          flex gap-4
          overflow-x-auto
          overflow-y-hidden
          pb-4
          scroll-smooth
          snap-x snap-mandatory
          scrollbar-thin
          scrollbar-thumb-[#2A2F45]
          scrollbar-track-transparent
          hover:scrollbar-thumb-[#7A3BFF]
          cursor-grab
          active:cursor-grabbing
        "
      >
        {items.map((item) => (
          <div key={item.id} className="flex-shrink-0 group snap-start">
            <button
              onClick={() => onItemClick(item)}
              className="overflow-hidden rounded-md block relative"
            >
              {isVideo ? (
                <video
                  src={getImageUrl(item)}
                  poster="/assets/video-preview.webp"
                  className="object-cover h-[140px] md:h-[160px] lg:h-[180px] w-[140px] md:w-[160px] lg:w-[180px]"
                  muted
                  playsInline
                  autoPlay
                  loop
                  preload="none"
                />
              ) : (
                <img
                  src={getImageUrl(item)}
                  alt=""
                  className="object-cover h-[140px] md:h-[160px] lg:h-[180px] w-[140px] md:w-[160px] lg:w-[180px]"
                />
              )}

              {item.prompt && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition p-3 flex items-end">
                  <p className="text-white text-xs line-clamp-4">{item.prompt}</p>
                </div>
              )}
            </button>

            <div className="bg-[#141622] border border-[#1F2230] flex items-center justify-center h-[40px] md:h-[45px] w-[140px] md:w-[160px] lg:w-[180px]">
              <p className="text-[#B7BBC6] text-[12px]">
                {new Date(item.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <p className="text-white/30 mt-2 text-sm">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   MAIN PAGE
===================================================== */

export default function Library() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const viralOnly = location.pathname.endsWith("/viral-videos");

  const [videos, setVideos] = useState([]);
  const [viralVideos, setViralVideos] = useState([]);
  const [images, setImages] = useState([]);
  const [activeItem, setActiveItem] = useState(null);

  useEffect(() => {
    if (!user || loading) return;

    const load = async () => {

      const [videoRes, viralVideoRes, imageRes] = await Promise.all([

        supabase
          .from("jobs")
          .select("id, created_at, result_url, prompt, type, tool_key")
          .eq("user_id", user.id)
          .eq("type", "video")
          .eq("status", "succeeded")
          .not("result_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(30),

        // This is intentionally the same finished-video query as Publish.
        supabase
          .from("jobs")
          .select("id, created_at, result_url, prompt, type, tool_key")
          .eq("user_id", user.id)
          .eq("type", "video")
          .eq("status", "succeeded")
          .eq("tool_key", FULL_VIDEO_TOOL_KEY)
          .not("result_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(30),

        supabase
          .from("jobs")
          .select("id, created_at, result_url, prompt, input")
          .eq("user_id", user.id)
          .eq("type", "image")
          .eq("status", "succeeded")
          .not("result_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(20)

      ]);

      const videoData = videoRes.data || [];
      const viralVideoData = viralVideoRes.data || [];
      const imageData = imageRes.data || [];

      setViralVideos(viralVideoData);
      setVideos(videoData.filter((item) => item.tool_key !== FULL_VIDEO_TOOL_KEY));

      setImages(
        imageData.map((j) => ({
          ...j,
          prompt: j.input?.subject ?? j.prompt ?? "",
        }))
      );
    };

    load();

  }, [user, loading]);

  return (
    <section>

      <div className="flex flex-col gap-3 items-center mt-10 px-5 md:px-8">
        <h1 className="text-[#F4F6FB] font-bold text-[24px]">
          Your Creations
        </h1>
        <p className="text-[#B7BBC6] text-[14px] text-center">
          Find your generated assets and finished, ready-to-publish videos.
        </p>
        <nav className="mt-2 flex items-center rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1">
          <Link
            to="/workspace/creations"
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition ${
              !viralOnly ? "bg-white text-black" : "text-white/45 hover:text-white"
            }`}
          >
            <Images className="h-4 w-4" /> All creations
          </Link>
          <Link
            to="/workspace/creations/viral-videos"
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold transition ${
              viralOnly ? "bg-gradient-to-r from-orange-500 to-red-500 text-white" : "text-white/45 hover:text-white"
            }`}
          >
            <Clapperboard className="h-4 w-4" /> Viral videos
          </Link>
        </nav>
      </div>

      {viralOnly ? (
        <HorizontalRow
          title="Viral Videos"
          items={viralVideos}
          getImageUrl={(i) => i.result_url}
          onItemClick={setActiveItem}
          isVideo
          emptyText="No finished viral videos yet. Export a video from one of the viral tools and it will appear here."
        />
      ) : (
        <>
          {viralVideos.length > 0 && (
            <HorizontalRow
              title="Viral Videos"
              items={viralVideos}
              getImageUrl={(i) => i.result_url}
              onItemClick={setActiveItem}
              isVideo
            />
          )}
          <HorizontalRow
            title="Images"
            items={images}
            getImageUrl={(i) => i.result_url}
            onItemClick={setActiveItem}
          />
          <HorizontalRow
            title="Videos"
            items={videos}
            getImageUrl={(i) => i.result_url}
            onItemClick={setActiveItem}
            isVideo
          />
        </>
      )}

      {activeItem && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
          onClick={() => setActiveItem(null)}
        >
          <div
            className="bg-[#090A0A] p-7 rounded-md w-full max-w-[800px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button onClick={() => setActiveItem(null)}>
                <X className="h-4 w-4 text-[#B7BBC6]" />
              </button>
            </div>

            {activeItem.type === "video" ? (
              <video
                src={activeItem.result_url}
                controls
                autoPlay
                preload="none"
                className="w-full max-h-[450px] object-contain bg-black rounded-md mt-3"
              />
            ) : (
              <img
                src={activeItem.result_url}
                className="w-full max-h-[450px] object-contain bg-black rounded-md mt-3"
              />
            )}

            {activeItem.prompt && (
              <p className="mt-4 text-[#B7BBC6] text-sm leading-relaxed">
                {activeItem.prompt}
              </p>
            )}

            <div className="flex justify-end mt-4">
              <a
                href={activeItem.result_url}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="h-4 w-4 text-[#B7BBC6] hover:opacity-70" />
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
