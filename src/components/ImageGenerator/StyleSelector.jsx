import React from "react";
import { ChevronRight } from "lucide-react";

const StyleSelector = React.memo(
  ({ selectedStyle, styles, openStyle, setOpenStyle, enabled, onToggleEnabled }) => {
    const current = styles[selectedStyle];

    return (
      <div
        className={`
          w-full overflow-hidden rounded-xl border
          transition-colors duration-200
          ${enabled ? "border-white/[0.09] bg-[#151719]" : "border-white/[0.07] bg-[#0e1012]"}
        `}
      >
        <div className="flex items-stretch">
          <button
            type="button"
            onClick={() => enabled && setOpenStyle((p) => !p)}
            disabled={!enabled}
            className="group relative flex-1 min-w-0 overflow-hidden flex items-stretch text-left disabled:cursor-default"
          >
            {/* 🔥 RIGHT SIDE IMAGE — only shown once a style is actually applied */}
            {enabled && current?.img && (
              <div className="absolute inset-y-0 right-0 w-[45%] overflow-hidden">
                <img
                  src={current.img}
                  alt={current.label}
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-black/30 via-black/60 to-[#151719]" />
              </div>
            )}

            {/* 🔥 CONTENT */}
            <div className="relative z-10 flex items-center justify-between w-full px-4 py-4">
              <div className="flex flex-col text-left">
                <span className="text-xs text-white/40">Style</span>
                <span className={`font-semibold text-lg ${enabled ? "text-white" : "text-white/35"}`}>
                  {enabled ? current?.label : "Image style"}
                </span>
              </div>

              {enabled && (
                <ChevronRight
                  className={`
                    w-5 h-5 transition-all duration-200
                    ${openStyle ? "rotate-90 text-[#A3E635]" : "text-white/50"}
                  `}
                />
              )}
            </div>
          </button>

          {/* 🔥 ON/OFF — when off, no style is applied to the generation at all */}
          <div className="flex shrink-0 items-center pl-1 pr-4">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleEnabled(); }}
              aria-label={enabled ? "Turn style off" : "Turn style on"}
              className="relative shrink-0 rounded-full"
              style={{ width: 34, height: 18, background: enabled ? "#A3E635" : "rgba(255,255,255,0.10)", transition: "background 120ms" }}
            >
              <div
                className="absolute top-[3px] h-3 w-3 rounded-full bg-white shadow"
                style={{ left: enabled ? 17 : 3, transition: "left 120ms" }}
              />
            </button>
          </div>
        </div>
      </div>
    );
  }
);

export default StyleSelector;
