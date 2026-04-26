import React from "react";
import { ChevronRight } from "lucide-react";

const StyleSelector = React.memo(
  ({ selectedStyle, styles, openStyle, setOpenStyle }) => {
    const current = styles[selectedStyle];

    return (
      <button
        onClick={() => setOpenStyle((p) => !p)}
        className={`
          group relative w-full overflow-hidden
          rounded-xl border border-white/[0.09]
          bg-[#151719]

          flex items-stretch

          transition-colors duration-200

          hover:border-[#7A3BFF]/70
        `}
      >
        {/* 🔥 RIGHT SIDE IMAGE */}
        {current?.img && (
          <div className="absolute inset-y-0 right-0 w-[45%] overflow-hidden">
            
            <img
              src={current.img}
              alt={current.label}
              className="w-full h-full object-cover opacity-80"
            />

            {/* FADE */}
            <div
              className="
                absolute inset-0
                bg-gradient-to-l
                from-black/30
                via-black/60
                to-[#151719]
              "
            />
          </div>
        )}

        {/* 🔥 CONTENT */}
        <div className="relative z-10 flex items-center justify-between w-full px-4 py-4">
          
          <div className="flex flex-col text-left">
            <span className="text-xs text-white/40">Style</span>
            <span className="text-white font-semibold text-lg">
              {current?.label}
            </span>
          </div>

          <ChevronRight
            className={`
              w-5 h-5 transition-all duration-200
              ${openStyle ? "rotate-90 text-[#B69CFF]" : "text-white/50"}
            `}
          />
        </div>
      </button>
    );
  }
);

export default StyleSelector;
