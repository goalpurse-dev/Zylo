// src/pages/Library.jsx
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  CREATION_TYPES,
  listCreationsByType,
  deleteCreation,
} from "../../lib/creations";
import { supabase } from "../../lib/supabaseClient";
import { Download, X, ChevronLeft, ChevronRight } from "lucide-react";

/* =====================================================
   HORIZONTAL ROW (ONE ROW ONLY, SCROLLABLE)
===================================================== */
function HorizontalRow({ title, items, getImageUrl, onItemClick }) {
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[#F4F6FB] text-[20px] sm:text-[22px] font-semibold">
          {title}
        </h1>

        {/* Mobile arrows */}
        <div className="flex gap-2 sm:hidden">
          <button onClick={() => scroll("left")} className="bg-white shadow rounded-full p-2">
            <ChevronLeft className="h-4 w-4 text-[#110829]" />
          </button>
          <button onClick={() => scroll("right")} className="bg-white shadow rounded-full p-2">
            <ChevronRight className="h-4 w-4 text-[#110829]" />
          </button>
        </div>
      </div>

      {/* Scroll row */}
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
          {title === "Videos" ? (
  <video
    src={getImageUrl(item)}
    className="object-cover h-[140px] md:h-[160px] lg:h-[180px] w-[140px] md:w-[160px] lg:w-[180px]"
    muted
    playsInline
    preload="metadata"
  />
) : (
  <img
    src={getImageUrl(item)}
    alt=""
    className="object-cover h-[140px] md:h-[160px] lg:h-[180px] w-[140px] md:w-[160px] lg:w-[180px]"
  />
)}

              

              {/* Prompt overlay */}
              {item.prompt && (
                <div className="
                  absolute inset-0
                  bg-black/60
                  opacity-0 group-hover:opacity-100
                  transition
                  p-3
                  flex items-end
                ">
                  <p className="text-white text-xs line-clamp-4">
                    {item.prompt}
                  </p>
                </div>
              )}
            </button>

            <div
              className="
                bg-[#141622] border border-[#1F2230]
                flex items-center justify-center
                h-[40px] md:h-[45px]
                w-[140px] md:w-[160px] lg:w-[180px]
              "
            >
              <p className="text-[#B7BBC6] text-[12px]">
                {new Date(item.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <p className="text-[#4A4A55] mt-2">No creations yet.</p>
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

  const [videos, setVideos] = useState([]);
  const [images, setImages] = useState([]);
  const [activeItem, setActiveItem] = useState(null);

  /* ===============================
     LOAD DATA
  =============================== */
  useEffect(() => {
    if (!user || loading) return;

    const load = async () => {
      /* -------- Product Photos (creations) -------- 
      const list = await listCreationsByType(
        user.id,
        CREATION_TYPES.PRODUCT_PHOTO
      );

      const sorted = [...list].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      const keep = sorted.slice(0, 20);
      const overflow = sorted.slice(20);
      overflow.forEach((item) => deleteCreation(item).catch(() => {}));

      setProductPhotos(keep);

      */


      /* -------- Videos (jobs) -------- */
const { data: videoData } = await supabase
  .from("jobs")
  .select("id, created_at, result_url, prompt, settings")
  .eq("user_id", user.id)
  .eq("status", "succeeded")
  .not("result_url", "is", null)
  .order("created_at", { ascending: false })
  .limit(20);

const filteredVideos =
  (videoData ?? []).filter(
    (r) => r?.settings?.creation_type === CREATION_TYPES.VIDEO
  );

setVideos(filteredVideos);

      /* -------- Images (jobs) -------- */
      const { data } = await supabase
        .from("jobs")
        .select("id, created_at, result_url, prompt, input")
        .eq("user_id", user.id)
        .eq("type", "image")
        .eq("status", "succeeded")
        .not("result_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);

      setImages(
        (data ?? []).map((j) => ({
          ...j,
          prompt: j.input?.subject ?? j.prompt ?? "",
        }))
      );
    };

    load( );
  }, [user, loading]);

  /* ===============================
     RENDER
  =============================== */
  return (
    <section>
      {/* Page Header */}
      <div className="flex flex-col gap-4 items-center mt-10 px-5 md:px-8">
        <h1 className="text-[#F4F6FB] font-semibold text-[22px]">
          Your Creations
        </h1>
        <p className="text-[#B7BBC6] text-[14px] text-center">
          Max 20 per tool. Oldest are removed automatically.
        </p>
      </div>

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
/>

      {/* MODAL */}
      {activeItem && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
          onClick={() => setActiveItem(null)}
        >
          <div
            className="bg-[#12141A] p-7 rounded-md w-full max-w-[800px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button onClick={() => setActiveItem(null)}>
                <X className="h-4 w-4 text-[#B7BBC6]" />
              </button>
            </div>

            {activeItem.settings?.creation_type === CREATION_TYPES.VIDEO ? (
  <video
    src={activeItem.result_url}
    controls
    autoPlay
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
                href={activeItem.result_url || activeItem.file_url}
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
