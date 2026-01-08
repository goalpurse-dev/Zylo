// src/pages/products/ProductPhotoBackgroundStep.jsx
import React, { useRef } from "react";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";

const cn = (...a) => a.filter(Boolean).join(" ");
const zyloGrad = "bg-gradient-to-r from-blue-600 to-purple-600";

export default function ProductPhotoBackgroundStep({
  selectedBg,
  setSelectedBg,
  bgPrompt,
  setBgPrompt,
  customBgPreview,
  onPickCustomBg,
  onBack,
  onNext,        // now: create job
  presets,
  creating = false,
  credits,
}) {
  const stripRef = useRef(null);
  const fileInputRef = useRef(null);

  function scrollStrip(dir) {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 220, behavior: "smooth" });
  }

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-semibold border border-white/15 text-white/90 hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <div className="text-sm text-white/70">Step 2 of 2</div>
      </div>

      {/* Presets */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-base font-semibold">
            2) Pick a background style
          </div>
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#7A3BFF]/18 text-[#b99bff] uppercase tracking-[0.16em]">
            Optional
          </span>
        </div>
        <div className="text-xs text-white/60 -mt-1">
          Choose a ready-made background, or upload your own.
        </div>

        <div className="relative">
          {/* left arrow */}
          <button
            type="button"
            onClick={() => scrollStrip(-1)}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full bg-black/60 border border-white/20 hover:bg-black/80"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* strip */}
          <div
            ref={stripRef}
            className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10"
          >
            {presets.map((bg) => {
              const active = selectedBg?.id === bg.id;
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setSelectedBg(active ? null : bg)}
                  className="flex-shrink-0 w-[160px] sm:w-[190px]"
                >
                  <div
                    className={cn(
                      "h-[160px] sm:h-[190px] w-full rounded-2xl overflow-hidden border bg-white/[.02]",
                      active
                        ? "border-[#7A3BFF] ring-2 ring-[#7A3BFF]/40"
                        : "border-white/15 hover:border-white/30",
                    )}
                  >
                    <img
                      src={bg.src}
                      alt={bg.label}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div
                    className={cn(
                      "mt-1.5 text-[10px] font-medium text-left",
                      active ? "text-[#c4a8ff]" : "text-white/75",
                    )}
                  >
                    {bg.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* right arrow */}
          <button
            type="button"
            onClick={() => scrollStrip(1)}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full bg-black/60 border border-white/20 hover:bg-black/80"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Prompt + optional upload */}
      <div className="mt-3 flex flex-col md:flex-row gap-4 items-stretch">
        {/* Prompt */}
        <div className="flex-1 space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#67a8ff]">
            Prompt (optional)
          </div>
          <textarea
            rows={4}
            value={bgPrompt}
            onChange={(e) => setBgPrompt(e.target.value)}
            placeholder="Describe the environment (e.g. 'soft daylight studio with reflections', 'outdoor terrace at sunset', etc.)"
            className="w-full rounded-xl border border-white/15 bg-white/[.04] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF]"
          />
        </div>

        {/* Upload custom background */}
        <div className="w-full md:w-56">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60 mb-1">
            Or upload background image
          </div>
          <label
            className={cn(
              "group relative flex h-40 w-full items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[.02] text-white/70 cursor-pointer hover:bg-white/[.04]",
              customBgPreview && "border-white/40 bg-white/[.06]",
            )}
          >
            <input
              type="file"
              accept="image/*"
              hidden
              ref={fileInputRef}
              onChange={(e) => {
                const file = (e.target.files || [])[0] || null;
                onPickCustomBg && onPickCustomBg(file);
              }}
            />
            {customBgPreview ? (
              <>
                <img
                  src={customBgPreview}
                  alt="Custom background"
                  className="h-full w-full object-cover rounded-xl"
                />
                <div className="absolute bottom-1 left-1.5 right-1.5 rounded-md bg-black/55 px-2 py-0.5 text-[9px] text-center">
                  Click to replace background
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1 text-[10px]">
                <Upload className="h-5 w-5" />
                <span>Upload custom bg</span>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* Create */}
      <div className="flex items-center justify-end pt-2">
        <button
          type="button"
          onClick={onNext}
          disabled={creating}
          className={cn(
            "inline-flex items-center gap-2 h-10 px-6 rounded-xl text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed",
            zyloGrad,
          )}
        >
          {creating
            ? "Creating..."
            : `Create product photo${
                credits ? ` (${credits} credits)` : ""
              }`}
          {!creating && <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
