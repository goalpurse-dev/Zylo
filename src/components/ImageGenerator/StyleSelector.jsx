import React from "react";
import { ChevronRight } from "lucide-react";

const StyleSelector = React.memo(
  ({ selectedStyle, styles, openStyle, setOpenStyle }) => {
    return (
      <button
        onClick={() => setOpenStyle((p) => !p)}
        className="rounded-xl border border-white/10 px-4 py-3 text-left"
      >
        <div className="flex justify-between items-center">
          <div>
            <span className="text-xs text-white/40">Style</span>
            <div className="text-white">
              {styles[selectedStyle]?.label}
            </div>
          </div>

          <ChevronRight
            className={`w-4 h-4 ${
              openStyle ? "rotate-90 text-purple-400" : ""
            }`}
          />
        </div>
      </button>
    );
  }
);

export default StyleSelector;