import React from "react";
import QuotedCredits from "../pricing/QuotedCredits";

const GenerateButton = React.memo(
  // priceStatus (optional): "loading" | "ready" | "error" for a server-quoted
  // estimatedCredits. Loading shows a skeleton and holds the button; error
  // turns the button into "Couldn't load price — Retry" (onRetryPrice).
  ({ onClick, disabled, isGenerating, estimatedCredits, priceStatus, onRetryPrice }) => {
    const priceError = priceStatus === "error";
    const priceLoading = priceStatus === "loading";
    const isReady = priceError ? !isGenerating : !disabled && !isGenerating && !priceLoading;

    return (
      <button
        data-ftg="generate"
        onClick={priceError ? onRetryPrice : onClick}
        disabled={!isReady}
        className={`
          relative w-full py-4 rounded-xl
          flex items-center justify-center gap-3
          overflow-hidden
          transition-all duration-200
          ${
            isReady
              ? "bg-lime-300 hover:bg-lime-200 active:scale-[0.99]"
              : "border border-white/[0.08] bg-[#202224] text-white/35 cursor-not-allowed"
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
        <span className={`relative z-10 flex items-center gap-3 font-semibold text-[15px] ${isReady ? "text-[#11150D]" : "text-white/35"}`}>
          {isGenerating ? (
            <span>Generating...</span>
          ) : priceError ? (
            <span>Couldn&apos;t load price — Retry</span>
          ) : (
            <>
              <span>{priceLoading ? "Loading price…" : "Generate"}</span>

              <span className={`flex items-center gap-1 ${isReady ? "text-[#11150D]/80" : "text-white/90"}`}>
                <span
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 bg-current"
                  style={{
                    WebkitMaskImage: "url('/icons/credits.png')",
                    maskImage: "url('/icons/credits.png')",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                  }}
                />
                {priceStatus ? <QuotedCredits status={priceStatus} value={estimatedCredits} /> : <span>{estimatedCredits}</span>}
              </span>
            </>
          )}
        </span>
      </button>
    );
  }
);

export default GenerateButton;
