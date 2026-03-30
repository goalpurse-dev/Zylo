import React from "react";
import { Wand2 } from "lucide-react";

const GenerateButton = React.memo(
  ({ onClick, disabled, isGenerating, estimatedCredits }) => {
    const isReady = !disabled && !isGenerating;

    return (
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+12px)] z-[10] md:relative backdrop-blur-md">
        <div className="pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] border-t border-white/10">
          <div className="max-w-[900px] mx-auto flex flex-col gap-3">

            <button
              onClick={onClick}
              disabled={!isReady}
              className={`
                relative w-full py-4 rounded-2xl font-semibold text-[15px]
                overflow-hidden
                transition-transform duration-200

                ${
                  isReady
                    ? "bg-gradient-to-r from-[#7A3BFF] via-[#9D4EDD] to-[#C77DFF] generate-btn-ready"
                    : "bg-white/5 border border-white/10 text-white/40"
                }
              `}
            >
              {/* 🔥 SHIMMER EFFECT */}
              {isReady && (
                <span className="absolute inset-0 overflow-hidden rounded-2xl">
                  <span className="absolute top-0 left-0 w-full h-full shimmer" />
                </span>
              )}

              <span className="relative z-10 flex items-center justify-center gap-2">
                {isGenerating ? (
                  <>
                    <Wand2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 opacity-80" />
                    Generate
                  </>
                )}
              </span>
            </button>

            <div className="w-full rounded-xl border border-white/10 px-4 py-3 flex justify-between text-sm">
              <span className="text-white/50">Estimated cost</span>
              <span className="text-[#36E28F] font-medium">
                {estimatedCredits} credits
              </span>
            </div>

          </div>
        </div>
      </div>
    );
  }
);

export default GenerateButton;