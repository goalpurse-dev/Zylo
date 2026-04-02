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
          relative w-full py-4 rounded-2xl font-semibold text-[15px]
          flex items-center justify-center gap-3
          transition-all duration-200
          overflow-hidden
          ${
            isReady
              ? "bg-[#7A3BFF] hover:bg-[#6A32E0] text-white shadow-[0_8px_30px_rgba(122,59,255,0.35)]"
              : "bg-[#2A0E4A] text-white/60"
          }
        `}
      >
        {isReady && (
          <span className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
            <span className="absolute top-0 left-0 w-full h-full shimmer" />
          </span>
        )}

        <span className="relative z-10 flex items-center gap-3">
          {isGenerating ? (
            <span>Generating...</span>
          ) : (
            <>
              <span>Generate</span>
              <span className="flex items-center gap-1">
                <img
                  src={Credit}
                  alt="credits"
                  className="h-5 w-auto object-contain scale-125 brightness-125 contrast-125"
                />
                <span className="font-semibold text-white">
                  {estimatedCredits}
                </span>
              </span>
            </>
          )}
        </span>
      </button>
    );
  }
);

export default GenerateButton;