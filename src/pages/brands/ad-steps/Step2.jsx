import React, { useEffect, useRef } from "react";
import { cn } from "./ui";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function Step2({ products = [], selectedProduct, setSelectedProduct }) {
  const rowRef = useRef(null);

  const hasProducts = Array.isArray(products) && products.length > 0;

  const nudge = (dir = 1) => {
    if (!rowRef.current) return;
    // scroll roughly one card at a time
    const cardWidth = rowRef.current.querySelector("[data-card]")?.clientWidth || 420;
    rowRef.current.scrollBy({ left: dir * (cardWidth + 16), behavior: "smooth" });
  };

  // When selection changes, snap that card into view
  useEffect(() => {
    if (!selectedProduct || !rowRef.current) return;
    const el = rowRef.current.querySelector(`[data-id="${selectedProduct.id}"]`);
    if (el) el.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [selectedProduct]);

  const Card = ({ item, selected, onClick }) => {
    const title = item.title || item.name || "Untitled product";
    const imgSrc = item._url || item.thumb || item.image_url || item.image || "";

    const clearSelection = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedProduct(null);
    };

    return (
      <button
        type="button"
        data-card
        data-id={item.id}
        onClick={onClick}
        className={cn(
          "group relative shrink-0 w-[420px] sm:w-[480px] rounded-2xl border p-3 text-left transition-all snap-center",
          selected
            ? "border-white/60 bg-white/[.06] shadow-[0_0_0_2px_rgba(255,255,255,0.06)_inset] scale-[1.01]"
            : "border-white/12 bg-white/[.035] hover:bg-white/[.06] hover:border-white/20"
        )}
      >
        {/* Clear (X) when selected */}
        {selected && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear selection"
            onClick={clearSelection}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && clearSelection(e)}
            className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/90 backdrop-blur hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/40"
            title="Remove selection"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}

        {/* Media stage */}
        <div className="w-full rounded-xl bg-black/70 overflow-hidden flex items-center justify-center">
          <div className="w-full h-[340px] sm:h-[400px] md:h-[440px] flex items-center justify-center">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={title}
                className="max-h-full max-w-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="text-xs text-white/60">No image</div>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="mt-2">
          <div className={cn("text-sm font-extrabold line-clamp-1", selected ? "text-white" : "text-white/95")}>
            {title}
          </div>
          {item.meta?.one_liner ? (
            <div className="text-[12px] mt-0.5 line-clamp-1 text-white/70">{item.meta.one_liner}</div>
          ) : null}
        </div>

        {/* Selected chip */}
        {selected && (
          <span className="absolute right-10 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-black">
            Selected
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-base font-semibold">
        <span className="mr-1">2)</span>{" "}
        <span className="font-extrabold">Use product from your brand</span>{" "}
        <span className="opacity-70">(optional)</span>
      </div>

      <p className="text-sm text-white/70">
        Choose a product so the ad matches your visuals.{" "}
        <span className="text-white font-semibold">Optional, but recommended.</span>
      </p>

      {hasProducts ? (
        <div className="relative">
          {/* edge fades */}
          <div className="pointer-events-none absolute left-0 top-0 h-full w-10 bg-gradient-to-r from-[#0B1117] to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-[#0B1117] to-transparent z-10" />

          {/* arrows (desktop) */}
          <button
            aria-label="Scroll left"
            onClick={() => nudge(-1)}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur hover:bg-black/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            aria-label="Scroll right"
            onClick={() => nudge(1)}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur hover:bg-black/60"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* arrows (mobile) */}
          <div className="flex gap-2 md:hidden justify-end mb-2">
            <button
              aria-label="Scroll left"
              onClick={() => nudge(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur hover:bg-black/60"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              aria-label="Scroll right"
              onClick={() => nudge(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 backdrop-blur hover:bg-black/60"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* scroll row */}
          <div
            ref={rowRef}
            className="flex gap-4 overflow-x-auto px-6 pb-2 snap-x snap-mandatory"
          >
            {products.map((p) => (
              <Card
                key={p.id}
                item={p}
                selected={selectedProduct?.id === p.id}
                onClick={() => setSelectedProduct(p)}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="relative rounded-2xl border border-white/12 bg-white/[.035] p-6 h-36 flex flex-col items-center justify-center text-center">
            <div className="text-sm font-semibold text-white/85">No products yet</div>
            <a
              href="/products/new"
              className="mt-3 inline-flex items-center rounded-full border border-white/15 bg-white/[.04] px-3 py-1 text-xs font-semibold text-white/90 hover:bg-white/10 hover:border-white/25 transition"
            >
              Create a product →
            </a>
            <div className="mt-3 text-xs text-white/70">
              Don’t have a brand yet?{" "}
              <a href="/brands" className="font-semibold text-white hover:underline">
                Create one now →
              </a>
            </div>
          </div>
          <div className="text-xs text-amber-300/90">Skipping may reduce accuracy.</div>
        </>
      )}
    </div>
  );
}
