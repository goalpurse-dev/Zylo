import React from "react";
import Credit from "/icons/whitecredit.png";

const GenerateButton = React.memo(
  ({ onClick, disabled, isGenerating, estimatedCredits }) => {
    const isReady = !disabled && !isGenerating;

    return (
      <button
        onClick={onClick}
        disabled={!isReady}
        className={`
          relative w-full py-4 rounded-2xl
          flex items-center justify-center gap-3
          overflow-hidden

          border border-white/10
          bg-[#16181A]

          transition-all duration-200

          ${
            isReady
              ? "hover:border-[#7A3BFF]/40 hover:bg-[#181A22]"
              : "opacity-50 cursor-not-allowed"
          }
        `}
      >
        {/* 🔥 PREMIUM GLOW (same as toggles) */}
       {isReady && (
  <>
    {/* glow */}
    <div className="absolute inset-1 rounded-xl">
      <div className="mode-glow" />
    </div>

    {/* 🔥 shine sweep */}
    <div className="generate-shine" />
  </>
)}

        {/* CONTENT */}
        <span className="relative z-10 flex items-center gap-3 text-white font-semibold text-[15px]">
          {isGenerating ? (
            <span>Generating...</span>
          ) : (
            <>
              <span>Generate</span>

              <span className="flex items-center gap-1 text-white/90">
                <img
                  src={Credit}
                  alt="credits"
                  className="h-5 w-auto object-contain scale-125 brightness-125 contrast-125"
                />
                <span>{estimatedCredits}</span>
              </span>
            </>
          )}
        </span>
      </button>
    );
  }
);

export default GenerateButton;