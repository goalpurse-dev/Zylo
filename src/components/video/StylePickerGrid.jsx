// src/components/video/StylePickerGrid.jsx
import React from "react";

// Swap these with your real previews when you have them
const STYLES = [
  { id: "pixar",      label: "Pixar-ish",   img: "/styles/pixar.jpg" },
  { id: "anime",      label: "Anime",       img: "/styles/anime.jpg" },
  { id: "comic",      label: "Comic",       img: "/styles/comic.jpg" },
  { id: "lowpoly",    label: "Low-poly",    img: "/styles/lowpoly.jpg" },
  { id: "lego",       label: "Lego",        img: "/styles/lego.jpg" },
  { id: "minecraft",  label: "Minecraft",   img: "/styles/minecraft.jpg" },
  { id: "neon",       label: "Neon/Glitch", img: "/styles/neon.jpg" },
  { id: "noir",       label: "Noir",        img: "/styles/noir.jpg" },
];

export default function StylePickerGrid({
  value,              // currently selected id
  onChange,           // (id) => void
  required = false,   // show asterisk
  showError = false,  // show inline error when no selection
  setShowError,       // optional setter to hide error on pick
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-black">
          Theme {required && <span className="text-rose-600">*</span>}
        </p>
        {!value && showError && (
          <span className="text-xs font-medium text-rose-600">
            Pick a theme to continue.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {STYLES.map((s) => {
          const active = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange(s.id);
                setShowError?.(false);
              }}
              className={[
                "group relative overflow-hidden rounded-xl border transition",
                active
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : "border-black/10 hover:border-blue-300",
              ].join(" ")}
            >
              <div className="h-28 w-full bg-gradient-to-br from-black/5 to-black/20">
                {/* If you don’t have images yet, keep the gradient above.
                   When you add images, uncomment below and remove the gradient. */}
                {/* <img src={s.img} alt="" className="h-28 w-full object-cover" /> */}
              </div>

              {/* Style label chip */}
              <span className="absolute left-2 bottom-2 rounded bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
                {s.label}
              </span>

              {/* Selection dot */}
              {active && (
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
