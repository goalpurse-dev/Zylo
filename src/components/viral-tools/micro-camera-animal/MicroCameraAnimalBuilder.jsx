import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useProfileCredits } from "../../../hooks/useProfileCredits";
import { LENGTH_OPTIONS, calcCredits, detectAnimal } from "./api/microCameraAnimalApi";

const EXAMPLES = ["ant", "worm", "beetle", "termite", "spider", "mole", "cricket"];

const STEP_IMAGES = [
  "/viral-builder/micro-camera/image2.webp",
  "/viral-builder/micro-camera/image.webp",
  "/viral-builder/micro-camera/image1.webp",
];

function LengthButton({ option, active, onClick, fullWidth }) {
  const widthCls = fullWidth ? "w-full" : "";
  if (active) {
    return (
      <div
        className={`p-[1px] rounded-lg ${widthCls}`}
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.85) 0%, rgba(168,85,247,0.95) 100%)" }}
      >
        <button
          onClick={onClick}
          className="relative block w-full px-4 py-2 rounded-[7px] bg-[#0D0F11] text-white text-[13px] font-bold overflow-hidden whitespace-nowrap text-center"
        >
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: "inset 0px 2px 5px rgba(255,255,255,0.15)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(168,85,247,0.35) 0%, transparent 50%)" }} />
          <span className="relative">{option.label}</span>
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-[13px] font-semibold text-white/40 hover:text-white/80 bg-white/[0.05] hover:bg-white/[0.09] transition whitespace-nowrap ${widthCls}`}
    >
      {option.label}
    </button>
  );
}

const PREVIEWS = [
  "/viral-builder/micro-camera/preview1.png",
  "/viral-builder/micro-camera/image.webp",
  "/viral-builder/micro-camera/image1.webp",
  "/viral-builder/micro-camera/image2.webp",
];

export default function MicroCameraAnimalBuilder({ onGenerate, onReset, phase }) {
  const [animalInput, setAnimalInput]         = useState("");
  const [validationError, setValidationError] = useState("");
  const [selectedLength, setSelectedLength]   = useState("15s");
  const creditBalance = useProfileCredits();

  const sceneCount       = LENGTH_OPTIONS.find((l) => l.value === selectedLength)?.scenes ?? 3;
  const totalCredits     = calcCredits(sceneCount);
  const hasEnoughCredits = creditBalance >= totalCredits;
  const isGenerating     = phase === "images" || phase === "videos";
  const isDone           = phase === "done";

  const detectedProfile = animalInput.trim() ? detectAnimal(animalInput) : null;

  const handleGenerate = () => {
    const trimmed = animalInput.trim();
    if (!trimmed) { setValidationError("Please type an animal first."); return; }
    if (/\band\b|\bor\b|\bwith\b|\bplus\b|[,&+]/i.test(trimmed) || trimmed.split(/\s+/).length > 4) {
      setValidationError("One animal at a time please.");
      return;
    }
    setValidationError("");
    onGenerate({ animalInput: trimmed, selectedLength });
  };

  return (
    <div className="flex flex-col bg-[#0D0F11] rounded-2xl border border-white/[0.07] lg:overflow-hidden lg:h-full">

      {/* ══ HEADER ══ */}
      <div className="shrink-0">
        {/* Title row */}
        <div className="hidden lg:block px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="shrink-0 w-[60px] h-[60px] rounded-2xl overflow-hidden p-[2px] shadow-[0_0_20px_rgba(122,59,255,0.5)]"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(122,59,255,0.9) 100%)" }}
            >
              <img
                src={PREVIEWS[0]}
                alt=""
                className="w-full h-full object-cover rounded-[10px]"
              />
            </div>
            <div>
              <h1 className="text-white font-black text-[18px] leading-tight tracking-tight">Micro Camera Animal</h1>
              <p className="text-white/50 text-[12px] mt-0.5">Bodycam on any animal — goes underground</p>
            </div>
          </div>

          {/* Preview strip */}
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {PREVIEWS.map((src, i) => (
              <div key={i} className="relative shrink-0 w-10 h-12 rounded-lg overflow-hidden ring-1 ring-white/10">
                <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
              </div>
            ))}
            <div className="shrink-0 w-10 h-12 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center">
              <span className="text-white/30 text-[13px] font-bold">+</span>
            </div>
          </div>
        </div>

        <div className="hidden lg:block h-px bg-white/[0.06] mx-5" />

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-5 py-2 lg:py-3.5">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold bg-[#7A3BFF] text-white">
            1  Your Animal
          </div>
        </div>

        <div className="h-px bg-white/[0.06] mx-5" />
      </div>

      {/* ══ SCROLLABLE BODY ══ */}
      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_rgba(255,255,255,0.04)] [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="px-5 pt-4 pb-[160px] lg:pb-5 flex flex-col gap-4">

          {/* Input */}
          <div className="rounded-2xl bg-[#111315] border border-white/[0.08] overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 pt-3 pb-2.5 border-b border-white/[0.05]">
              <div className="w-6 h-6 rounded-full bg-[#7A3BFF]/25 border border-[#7A3BFF]/50 flex items-center justify-center shrink-0">
                <span className="text-[#C4A3FF] text-[11px] font-black leading-none">1</span>
              </div>
              <span className="text-white font-semibold text-[14px]">Type Your Animal</span>
            </div>

            <div className="p-4 flex flex-col gap-3">
              <input
                type="text"
                value={animalInput}
                onChange={(e) => { setAnimalInput(e.target.value); setValidationError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                placeholder="e.g. ant, worm, beetle…"
                maxLength={40}
                className="w-full rounded-xl px-4 py-3.5 text-[15px] bg-[#0C0E10] text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-[#7A3BFF]/60 border border-white/[0.07] focus:border-[#7A3BFF]/30 transition"
              />

              {/* Detected animal */}
              {detectedProfile && (
                <div className="flex items-center gap-2">
                  <span className="text-white/30 text-[11px]">Detected:</span>
                  <span className="px-2.5 py-1 rounded-full bg-[#7A3BFF]/20 border border-[#7A3BFF]/40 text-[#C4A3FF] text-[11px] font-bold capitalize">
                    {detectedProfile.label}
                  </span>
                  <span className="text-white/25 text-[10px]">camera on {detectedProfile.bodyMount}</span>
                </div>
              )}

              {/* Examples */}
              <div>
                <p className="text-white/25 text-[10px] font-semibold uppercase tracking-widest mb-2">Try one</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => { setAnimalInput(ex); setValidationError(""); }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition border capitalize ${
                        animalInput.toLowerCase().trim() === ex
                          ? "bg-[#7A3BFF]/20 border-[#7A3BFF]/50 text-[#C4A3FF]"
                          : "bg-white/[0.04] border-white/[0.07] text-white/40 hover:text-white/70 hover:bg-white/[0.08]"
                      }`}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Length selector */}
          <div>
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2">Video Length</p>
            <div className="grid grid-cols-2 lg:flex items-center gap-2">
              {LENGTH_OPTIONS.map((opt) => (
                <LengthButton key={opt.value} option={opt} active={selectedLength === opt.value} onClick={() => setSelectedLength(opt.value)} fullWidth />
              ))}
            </div>
          </div>

          {/* Scene preview steps */}
          <div>
          <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2">How it works</p>
          <div className="flex gap-2">
            {STEP_IMAGES.map((src, i) => (
              <div key={i} className="relative flex-1 rounded-xl overflow-hidden aspect-[3/4]">
                <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-[#7A3BFF] flex items-center justify-center shadow-[0_0_10px_rgba(122,59,255,0.6)]">
                  <span className="text-white text-[11px] font-black leading-none">{i + 1}</span>
                </div>
              </div>
            ))}
          </div>
          </div>

        </div>
      </div>

      {/* ══ FOOTER ══ */}
      <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.06] bg-[#0D0F11]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:shrink-0 lg:bg-transparent lg:backdrop-blur-0 lg:py-4">

        {!hasEnoughCredits && (
          <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-red-300 text-[12px] font-semibold">
              Need {totalCredits} credits · you have {creditBalance}
            </span>
            <a href="/workspace/pricing" className="text-red-200 text-[11px] font-bold underline shrink-0">Add Credits →</a>
          </div>
        )}

        {validationError && (
          <p className="text-red-400 text-[12px] font-medium text-center mb-2">{validationError}</p>
        )}

        <button
          onClick={isDone ? onReset : handleGenerate}
          disabled={isGenerating || (!isDone && !hasEnoughCredits)}
          className={`w-full py-2.5 lg:py-3.5 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2.5 transition-all duration-300 ${
            isDone
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
              : isGenerating
              ? "bg-[#7A3BFF]/25 text-white/40 cursor-not-allowed"
              : hasEnoughCredits && animalInput.trim()
              ? "text-white bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] hover:opacity-90"
              : "bg-white/[0.05] text-white/20 cursor-not-allowed"
          }`}
        >
          {isGenerating ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
              Generating…
            </>
          ) : isDone ? (
            "✓  All Done — Generate New"
          ) : (
            <>Generate Bodycam Video <ChevronRight className="w-4 h-4" /></>
          )}

          {!isDone && (
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[14px] font-bold ${
              isGenerating ? "bg-white/5 text-white/20" : hasEnoughCredits ? "bg-white/20 text-white" : "bg-white/5 text-white/30"
            }`}>
              <img src="/icons/whitecredit.png" alt="" className="w-4 h-4 object-contain" />
              {totalCredits}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
