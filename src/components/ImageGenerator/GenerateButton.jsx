import React from "react";
import Credit from "/icons/whitecredit.png";

const GenerateButton = React.memo(
  ({ onClick, disabled, isGenerating, estimatedCredits }) => {
    const isReady = !disabled && !isGenerating;

    return (
      <button
        data-ftg="generate"
        onClick={onClick}
        disabled={!isReady}
        className={`
          relative w-full py-4 rounded-xl
          flex items-center justify-center gap-3
          overflow-hidden

          border

          transition-all duration-200

          ${
            isReady
              ? "border-[#A884FF]/35 bg-gradient-to-b from-[#8B4DFF] to-[#6F2EFF] shadow-[0_12px_34px_rgba(122,59,255,0.34)] hover:brightness-110 active:scale-[0.99]"
              : "border-white/[0.08] bg-[#202224] text-white/35 cursor-not-allowed"
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
        <span className={`relative z-10 flex items-center gap-3 font-semibold text-[15px] ${isReady ? "text-white" : "text-white/35"}`}>
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
