import React from "react";
import { ChevronRight } from "lucide-react";

const ModelSelector = React.memo(
  ({ selectedModel, openModel, setOpenModel }) => {
    return (
      <button
        data-ftg="model"
        onClick={() => setOpenModel((p) => !p)}
        className="
          group
          w-full
          rounded-xl

          bg-[#151719]
          border border-white/[0.09]

          px-4 py-3

          flex items-center justify-between

          transition-all duration-200

          hover:border-[#7A3BFF]/40
          hover:bg-[#181B1E]
          hover:shadow-[0_10px_35px_rgba(122,59,255,0.15)]
        "
      >
        {/* LEFT SIDE */}
<div className="flex items-center gap-3 min-w-0">
  
  {/* ICON */}
  <div className="
    w-11 h-11
    flex items-center justify-center
    rounded-xl

    bg-white/[0.06]
    border border-white/10

    overflow-hidden
    flex-shrink-0
  ">
    <img
      src={selectedModel.img}
      alt={selectedModel.label}
      className="
        w-full h-full
        object-contain
        scale-[1.35]
      "
    />
  </div>

  {/* TEXT */}
 <div className="flex flex-col items-start leading-tight pt-[2px]">
  
  <span className="text-[11px] text-white/40 pl-[2px]">
    Model
  </span>

  <span className="text-white font-semibold text-[15px] truncate">
    {selectedModel.label}
  </span>

</div>
</div>

        {/* RIGHT SIDE */}
        <ChevronRight
          className={`
            w-5 h-5 transition-all duration-200
            ${
              openModel
                ? "rotate-90 text-[#B69CFF]"
                : "text-white/40"
            }
          `}
        />
      </button>
    );
  }
);

export default ModelSelector;
