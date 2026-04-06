import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { CREATION_TYPES } from "../../lib/creations";

/* =========================================================
   WHY YOUR SCROLL "SNAPS" (REAL FIX)
   ---------------------------------------------------------
   You were defining <HorizontalRow /> *inside* ReferenceImageModal.
   That creates a NEW component function on every render, so React
   treats it like a new component type => unmount/mount => scrollLeft
   resets to 0 (feels like snapping back).

   Fix: define HorizontalRow at TOP LEVEL (stable identity),
   and preserve scrollLeft in a ref + restore in useLayoutEffect.
========================================================= */

/* ===============================
   HORIZONTAL ROW (TOP LEVEL)
=============================== */
function HorizontalRow({ title, items, getUrl, selected, onToggle }) {
  const rowRef = useRef(null);

  // persist scrollLeft between renders (and even data refresh)
  const savedLeft = useRef(0);

  // restore scrollLeft after render (prevents "snap back")
  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    el.scrollLeft = savedLeft.current;
  });

  // keep savedLeft updated while user scrolls
  const handleScroll = () => {
    const el = rowRef.current;
    if (!el) return;
    savedLeft.current = el.scrollLeft;
  };

  /* ===============================
     MOUSE DRAG SCROLL (does NOT hijack trackpad)
     - Only activates for left mouse button
     - Uses mouse events (not pointer capture) so trackpads won't get stuck
     - Doesn't prevent native wheel momentum
  =============================== */
  const drag = useRef({
    active: false,
    startX: 0,
    startLeft: 0,
    moved: false,
  });

  const onMouseDown = (e) => {
    if (e.button !== 0) return; // left button only
    const el = rowRef.current;
    if (!el) return;

    // prevent focus/auto-scroll-on-focus on buttons (common cause of jumps)
    e.preventDefault();

    drag.current.active = true;
    drag.current.moved = false;
    drag.current.startX = e.clientX;
    drag.current.startLeft = el.scrollLeft;

    // add listeners on window so releasing outside still ends drag
    window.addEventListener("mousemove", onMouseMove, { passive: false });
    window.addEventListener("mouseup", onMouseUp, { passive: true });
  };

  const onMouseMove = (e) => {
    if (!drag.current.active) return;
    const el = rowRef.current;
    if (!el) return;

    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 3) drag.current.moved = true;

    el.scrollLeft = drag.current.startLeft - dx;
    savedLeft.current = el.scrollLeft;
    e.preventDefault();
  };

  const onMouseUp = () => {
    drag.current.active = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  // kill listeners if row unmounts
  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Optional: vertical wheel → horizontal (NO preventDefault => no snap)
  const onWheel = (e) => {
    const el = rowRef.current;
    if (!el) return;

    // only apply when mostly vertical gesture and row can actually scroll
    const canScrollX = el.scrollWidth > el.clientWidth;
    if (!canScrollX) return;

    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      savedLeft.current = el.scrollLeft;
    }
  };

  return (
    <div className="mb-8">
      <h3 className="text-[#F4F6FB] font-semibold mb-3">{title}</h3>

      <div
        ref={rowRef}
        onScroll={handleScroll}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        className="
          flex gap-4 overflow-x-auto pb-2
          scrollbar-thin scrollbar-thumb-white/20
          select-none cursor-grab active:cursor-grabbing
        "
        style={{
          overscrollBehaviorX: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {items.map((item) => {
          const url = getUrl(item);
          const isSelected = selected.some((s) => s.id === item.id);

          return (
            <button
              key={item.id}
              type="button"
              tabIndex={-1} // prevent focus scrolling
              onMouseDown={(e) => e.preventDefault()} // prevent focus on click
              onClick={() => {
                // If user dragged, don't toggle selection on release
                if (drag.current.moved) return;
                onToggle({ id: item.id, url });
              }}
              className={`relative flex-shrink-0 rounded-xl overflow-hidden border
                ${isSelected ? "border-[#7A3BFF]" : "border-white/10"}
                outline-none
              `}
            >
             <img
  src={url}
  loading="lazy"
  decoding="async"
  draggable={false}
  className="h-[120px] w-[120px] object-cover"
 />


              {isSelected && (
                <div className="absolute inset-0 bg-black/50 border-[2px] border-[#7A3BFF] flex items-center justify-center">
                  <div className="rounded-full bg-gradient-to-bl from-[#7A3BFF] to-[#492399] px-4 py-2 text-white font-bold">
                    ✓
                  </div>
                </div>
              )}
            </button>
          );
        })}

        {items.length === 0 && (
          <p className="text-white/40 text-sm">No creations yet.</p>
        )}
      </div>
    </div>
  );
}

/* ===============================
   MAIN MODAL
=============================== */
export default function ReferenceImageModal({
  open,
  onClose,
  images,
  selected,
  onUpload,
  onToggle,
  maxSelectable,
}) {
  const [activeTab, setActiveTab] = useState("import");
  const [libraryImages, setLibraryImages] = useState([]);
  const [libraryProducts, setLibraryProducts] = useState([]);
  const [libraryRefs, setLibraryRefs] = useState([]);

  if (!open) return null;

  /* ===============================
     LOAD LIBRARY DATA (ON DEMAND)
  =============================== */
  useEffect(() => {
    if (activeTab !== "library") return;

    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;

      const { data: refs } = await supabase
        .from("reference_images")
        .select("id, file_url, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: imgs } = await supabase
        .from("jobs")
        .select("id, result_url, created_at, input, prompt")
        .eq("user_id", uid)
        .eq("type", "image")
        .eq("status", "succeeded")
        .not("result_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: prods } = await supabase
        .from("creations")
        .select("id, file_url, created_at, prompt")
        .eq("user_id", uid)
        .eq("type", CREATION_TYPES.PRODUCT_PHOTO)
        .order("created_at", { ascending: false })
        .limit(20);

      setLibraryRefs(refs ?? []);
      setLibraryImages(imgs ?? []);
      setLibraryProducts(prods ?? []);
    };

    load();
  }, [activeTab]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pb-[90px] bg-black/60 backdrop-blur-sm">
<div className="w-full max-w-[900px] h-[600px] rounded-2xl 
bg-[#191B1C]
border border-white/5
overflow-hidden
shadow-[0_20px_60px_rgba(0,0,0,0.6)]
flex flex-col">
        {/* HEADER + TABS */}
      <div className="
  px-6 pt-5 pb-4
  bg-[#16181A]
  border-b border-white/10
">
          <div className="flex items-center justify-between">
            <h2 className="text-white text-lg font-semibold tracking-tight">
              Select Images for Guidance
            </h2>
            <button onClick={onClose} className="text-[#F4F6FB] hover:text-white">
              ✕
            </button>
          </div>

          <div className="relative flex gap-6 mt-5 text-sm font-medium">
            <button
              onClick={() => setActiveTab("import")}
              className={activeTab === "import" ? "text-[#F4F6FB]" : "text-white/50"}
            >
              Import
            </button>

            <button
              onClick={() => setActiveTab("library")}
              className={activeTab === "library" ? "text-[#F4F6FB]" : "text-white/50"}
            >
              My Creations
            </button>

            <div
              className="absolute bottom-[-6px] h-[2px] bg-[#7A3BFF] transition-all duration-300"
              style={{
                width: activeTab === "import" ? "45px" : "85px",
                left: activeTab === "import" ? "0px" : "67px",
              }}
            />
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 p-6 overflow-y-auto overscroll-contain">
          {/* IMPORT */}
         {activeTab === "import" && (
  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
    
    {/* Upload Tile */}
    <label className="
      cursor-pointer
      rounded-xl
      border border-dashed border-white/20
      flex items-center justify-center
      text-center
      aspect-square
      text-white/60
      hover:border-[#7A3BFF]
    ">
      <input type="file" hidden onChange={onUpload} />
      <span className="text-sm">Upload image</span>
    </label>

    {/* Imported Images */}
    {images.map((img) => {
      const isSelected = selected.includes(img);

      return (
        <button
          key={img.id}
          type="button"
          onClick={() => onToggle(img)}
        className={`
  group relative
  rounded-xl
  overflow-hidden
  border
  aspect-square
  transition-all duration-200

  ${isSelected
    ? "border-[#7A3BFF]"
    : "border-white/10 bg-[#0F111A] hover:border-[#7A3BFF]/40 hover:shadow-[0_6px_20px_rgba(122,59,255,0.15)]"}
`}
        >
          <img
            src={img.url}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
          />

          {isSelected && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm
border-[1.5px] border-[#7A3BFF]
shadow-[0_0_25px_rgba(122,59,255,0.45)] flex items-center justify-center">
              <div className="rounded-full bg-gradient-to-bl from-[#7A3BFF] to-[#492399] px-4 py-2 text-white font-bold">
                ✓
              </div>
            </div>
          )}
        </button>
      );
    })}
  </div>
)}


          {/* LIBRARY */}
          {activeTab === "library" && (
            <>
              <HorizontalRow
                title="Images"
                items={libraryImages}
                getUrl={(i) => i.result_url}
                selected={selected}
                onToggle={onToggle}
              />

              <HorizontalRow
                title="Reference Images"
                items={libraryRefs}
                getUrl={(i) => i.file_url}
                selected={selected}
                onToggle={onToggle}
              />
                {/* 
              <HorizontalRow
                title="Product Photos"
                items={libraryProducts}
                getUrl={(i) => i.file_url}
                selected={selected}
                onToggle={onToggle}
              />
              */}
            </>
          )}
        </div>

        {/* FOOTER */}
       <div className="
  px-6 py-5
  flex items-center justify-between
 bg-[#16181A]
  border-t border-white/10
">
          <span className="text-white/60 text-sm">
            {selected.length}/{maxSelectable} selected
          </span>

          <div className="flex gap-3">
            <button onClick={onClose} className="
px-4 py-2 rounded-xl
bg-white/5
border border-white/10
text-white/80
hover:bg-white/10
transition-all
">
              Cancel
            </button>

            <button
              disabled={!selected.length}
              onClick={onClose}
className={`
  generate-btn
  px-6 py-2 rounded-xl font-medium
  transition-all duration-300 overflow-hidden

  ${
    !selected.length
      ? "bg-white/5 border border-white/10 text-white/40 cursor-not-allowed"
      : `
        generate-btn-ready
        bg-gradient-to-r from-[#7A3BFF] via-[#9D4EDD] to-[#C77DFF]
        border border-purple-400/30

        hover:scale-[1.05]
        active:scale-[0.97]

        shadow-[0_8px_25px_rgba(122,59,255,0.35)]
        hover:shadow-[0_0_40px_rgba(122,59,255,0.6)]
      `
  }
`}
            >
            <span className="relative z-10">
  Confirm
</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
