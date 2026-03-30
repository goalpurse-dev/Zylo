import React from "react";
import { ChevronRight } from "lucide-react";

const SizeSelector = React.memo(
  ({ currentSize, openSize, setOpenSize }) => {
    return (
      <button
        onClick={() => setOpenSize((p) => !p)}
        className="rounded-xl border border-white/10 px-4 py-3 text-left"
      >
        <div className="flex justify-between items-center">
          <div>
            <span className="text-xs text-white/40">Size</span>
            <div className="text-white">{currentSize.label}</div>
          </div>

          <ChevronRight
            className={`w-4 h-4 ${
              openSize ? "rotate-90 text-purple-400" : ""
            }`}
          />
        </div>
      </button>
    );
  }
);

export default SizeSelector;