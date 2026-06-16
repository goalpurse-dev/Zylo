import { useState } from "react";
import { ChevronRight, Lightbulb } from "lucide-react";
import { useProfileCredits } from "../../../hooks/useProfileCredits";
import { LENGTH_OPTIONS, calcCredits } from "./api/clayRescueApi";
import NoCreditsModal from "../shared/NoCreditsModal";

const PROBLEM_SUGGESTIONS = ["Flood", "Homeless", "Fire", "Storm", "Volcano", "Trapped", "Blizzard", "Quicksand", "Earthquake", "Landslide"];
const FIX_SUGGESTIONS     = ["Sponge", "Blanket", "Water bucket", "Umbrella", "Ladder", "Rope", "Bridge plank", "Fan", "Bandage", "Scarf"];

const MAX_CHARS = 20;

// 7 unique pre-filled scene combos — all different
const PRESETS = [
  { problem: "Flood",      fix: "Sponge"       },
  { problem: "Homeless",   fix: "Blanket"       },
  { problem: "Fire",       fix: "Water bucket"  },
  { problem: "Storm",      fix: "Umbrella"      },
  { problem: "Trapped",    fix: "Rope"          },
  { problem: "Volcano",    fix: "Ladder"        },
  { problem: "Blizzard",   fix: "Scarf"         },
];

function makeScenes(count) {
  return Array.from({ length: count }, (_, i) => ({ ...PRESETS[i % PRESETS.length] }));
}

function SceneCard({ index, scene, onChange, aiMode }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const num = index + 1;

  return (
    <div className={`rounded-xl border overflow-hidden transition ${aiMode ? "bg-[#0e1012] border-white/[0.05]" : "bg-[#111315] border-white/[0.08]"}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="w-5 h-5 rounded-full bg-[#7A3BFF]/25 border border-[#7A3BFF]/50 flex items-center justify-center shrink-0 mt-3">
          <span className="text-[#C4A3FF] text-[10px] font-black leading-none">{num}</span>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-white/25 text-[9px] font-bold uppercase tracking-widest px-0.5">Problem</span>
          {aiMode ? (
            <div className="w-full rounded-lg px-2.5 py-1.5 text-[12px] bg-[#0C0E10] border border-white/[0.05] text-white/20 italic">
              AI picks this ✦
            </div>
          ) : (
            <input
              type="text"
              value={scene.problem}
              maxLength={MAX_CHARS}
              onChange={(e) => onChange(index, "problem", e.target.value)}
              placeholder="e.g. flood"
              className="w-full rounded-lg px-2.5 py-1.5 text-[13px] bg-[#0C0E10] text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-[#7A3BFF]/60 border border-white/[0.07] focus:border-[#7A3BFF]/30 transition"
            />
          )}
        </div>

        <span className="text-white/20 text-[11px] shrink-0 mt-3">→</span>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-white/25 text-[9px] font-bold uppercase tracking-widest px-0.5">🤲 Hand drops</span>
          {aiMode ? (
            <div className="w-full rounded-lg px-2.5 py-1.5 text-[12px] bg-[#0C0E10] border border-white/[0.05] text-white/20 italic">
              AI picks this ✦
            </div>
          ) : (
            <input
              type="text"
              value={scene.fix}
              maxLength={MAX_CHARS}
              onChange={(e) => onChange(index, "fix", e.target.value)}
              placeholder="e.g. sponge"
              className="w-full rounded-lg px-2.5 py-1.5 text-[13px] bg-[#0C0E10] text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-[#7A3BFF]/60 border border-white/[0.07] focus:border-[#7A3BFF]/30 transition"
            />
          )}
        </div>

        {!aiMode && (
          <button
            onClick={() => setShowSuggestions((v) => !v)}
            className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition mt-3 ${
              showSuggestions ? "bg-[#7A3BFF]/25 text-[#C4A3FF]" : "text-white/25 hover:text-white/50 hover:bg-white/[0.06]"
            }`}
            title="Show suggestions"
          >
            <Lightbulb className="w-3.5 h-3.5" />
          </button>
        )}
        {aiMode && <div className="w-7 shrink-0 mt-3" />}
      </div>

      {/* Collapsible suggestions */}
      {showSuggestions && (
        <div className="border-t border-white/[0.05] px-3 pb-3 pt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest mb-1.5">Problems</p>
            <div className="flex flex-wrap gap-1">
              {PROBLEM_SUGGESTIONS.map((ex) => (
                <button
                  key={ex}
                  onClick={() => onChange(index, "problem", ex)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition border ${
                    scene.problem.toLowerCase() === ex.toLowerCase()
                      ? "bg-[#7A3BFF]/20 border-[#7A3BFF]/50 text-[#C4A3FF]"
                      : "bg-white/[0.04] border-white/[0.06] text-white/35 hover:text-white/60 hover:bg-white/[0.07]"
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-white/25 text-[9px] font-bold uppercase tracking-widest mb-1.5">Hand drops</p>
            <div className="flex flex-wrap gap-1">
              {FIX_SUGGESTIONS.map((ex) => (
                <button
                  key={ex}
                  onClick={() => onChange(index, "fix", ex)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition border ${
                    scene.fix.toLowerCase() === ex.toLowerCase()
                      ? "bg-[#7A3BFF]/20 border-[#7A3BFF]/50 text-[#C4A3FF]"
                      : "bg-white/[0.04] border-white/[0.06] text-white/35 hover:text-white/60 hover:bg-white/[0.07]"
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClayRescueBuilder({ onGenerate, onReset, phase }) {
  const [selectedLength, setSelectedLength] = useState("30s");
  const [scenes, setScenes]                 = useState(() => makeScenes(4));
  const [aiMode, setAiMode]                 = useState(true);
  const [validationError, setValidationError] = useState("");
  const [noCreditsOpen, setNoCreditsOpen]   = useState(false);
  const creditBalance = useProfileCredits();

  const totalCredits = calcCredits(scenes.length);
  const hasEnough    = creditBalance >= totalCredits;
  const isGenerating = phase === "images" || phase === "videos";
  const isDone       = phase === "done";

  const handleLengthChange = (val) => {
    setSelectedLength(val);
    const opt = LENGTH_OPTIONS.find((o) => o.value === val);
    const count = opt?.scenes ?? 5;
    setScenes((prev) => {
      if (prev.length === count) return prev;
      if (prev.length < count) {
        // extend with new presets
        const extra = Array.from({ length: count - prev.length }, (_, i) => ({
          ...PRESETS[(prev.length + i) % PRESETS.length],
        }));
        return [...prev, ...extra];
      }
      return prev.slice(0, count);
    });
  };

  const handleChange = (index, field, value) => {
    setScenes((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
    setValidationError("");
  };

  const handleGenerate = () => {
    if (!hasEnough) { setNoCreditsOpen(true); return; }
    const sceneInputs = aiMode
      ? scenes.map((s) => ({ problem: s.problem, fix: s.fix })) // presets still used for AI prompts
      : scenes;
    if (!aiMode) {
      const invalid = sceneInputs.find((s) => !s.problem.trim() || !s.fix.trim());
      if (invalid) { setValidationError("Fill in a problem and fix for every scene."); return; }
    }
    setValidationError("");
    onGenerate({ sceneInputs, selectedLength, aiMode });
  };

  return (
    <>
    <div className="flex flex-col bg-[#0D0F11] rounded-2xl border border-white/[0.07] lg:overflow-hidden lg:h-full">

      {/* ── HEADER (desktop only) ── */}
      <div className="shrink-0">
        <div className="hidden lg:block px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="shrink-0 w-[52px] h-[52px] rounded-2xl overflow-hidden p-[2px] shadow-[0_0_20px_rgba(122,59,255,0.5)]"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(122,59,255,0.9) 100%)" }}
            >
              <img src="/clayrescue/smallpreview.webp" alt="" className="w-full h-full object-cover rounded-[10px]" />
            </div>
            <div>
              <h1 className="text-white font-black text-[17px] leading-tight tracking-tight">Clay Rescue</h1>
              <p className="text-white/45 text-[12px] mt-0.5">Giant hand saves clay people</p>
            </div>
          </div>

          {/* Preview strip */}
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {[
              "/clayrescue/scene2problem.webp",
              "/clayrescue/scene2fix.webp",
              "/clayrescue/scene3problem.webp",
              "/clayrescue/scene3fix.webp",
            ].map((src, i) => (
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
        <div className="flex items-center gap-2 px-5 py-2 lg:py-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold bg-[#7A3BFF] text-white">
            1  Your Scenes
          </div>
        </div>
        <div className="h-px bg-white/[0.06] mx-5" />
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_rgba(255,255,255,0.04)] [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/25 [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="px-5 pt-4 pb-[160px] lg:pb-5 flex flex-col gap-3">

          {/* AI toggle */}
          <button
            onClick={() => setAiMode((v) => !v)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition ${
              aiMode
                ? "bg-[#7A3BFF]/10 border-[#7A3BFF]/40"
                : "bg-white/[0.03] border-white/[0.08] hover:border-white/15"
            }`}
          >
            <div className="text-left">
              <p className={`text-[13px] font-bold leading-tight ${aiMode ? "text-white" : "text-white/55"}`}>
                ✦ AI does the job for you
              </p>
              <p className="text-[11px] text-white/35 mt-0.5">
                {aiMode ? "AI picks the best problem & fix for each scene" : "You write each scene yourself"}
              </p>
            </div>
            {/* Toggle pill */}
            <div className={`relative shrink-0 w-10 h-5.5 rounded-full transition-colors duration-200 ${aiMode ? "bg-[#7A3BFF]" : "bg-white/10"}`}
              style={{ width: 40, height: 22 }}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${aiMode ? "left-[22px]" : "left-0.5"}`} />
            </div>
          </button>

          {/* Video length */}
          <div>
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2">Video Length</p>
            <div className="grid grid-cols-2 gap-2">
              {LENGTH_OPTIONS.map((opt) => {
                const active = selectedLength === opt.value;
                if (active) {
                  return (
                    <div key={opt.value} className="p-[1px] rounded-lg" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.85) 0%, rgba(168,85,247,0.95) 100%)" }}>
                      <button onClick={() => handleLengthChange(opt.value)}
                        className="relative block w-full px-4 py-2 rounded-[7px] bg-[#0D0F11] text-white text-[13px] font-bold text-center">
                        <div className="absolute inset-0 pointer-events-none rounded-[7px]" style={{ boxShadow: "inset 0px 2px 5px rgba(255,255,255,0.15)" }} />
                        <div className="absolute inset-0 pointer-events-none rounded-[7px]" style={{ background: "linear-gradient(to top, rgba(168,85,247,0.35) 0%, transparent 50%)" }} />
                        <span className="relative">{opt.label}</span>
                        <span className="relative text-white/40 text-[11px] font-normal ml-1.5">{opt.scenes} scenes</span>
                      </button>
                    </div>
                  );
                }
                return (
                  <button key={opt.value} onClick={() => handleLengthChange(opt.value)}
                    className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white/40 hover:text-white/80 bg-white/[0.05] hover:bg-white/[0.09] transition">
                    {opt.label}
                    <span className="text-white/25 text-[11px] font-normal ml-1.5">{opt.scenes} scenes</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scene cards */}
          <div className="flex flex-col gap-2">
            {scenes.map((scene, i) => (
              <SceneCard key={i} index={i} scene={scene} onChange={handleChange} aiMode={aiMode} />
            ))}
          </div>

        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.06] bg-[#0D0F11]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:shrink-0 lg:bg-transparent lg:backdrop-blur-0 lg:py-4">
        {!hasEnough && (
          <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-red-300 text-[12px] font-semibold">Need {totalCredits} credits · you have {creditBalance}</span>
            <a href="/workspace/pricing" className="text-red-200 text-[11px] font-bold underline shrink-0">Add Credits →</a>
          </div>
        )}
        {validationError && (
          <p className="text-red-400 text-[12px] font-medium text-center mb-2">{validationError}</p>
        )}
        <button
          onClick={isDone ? onReset : handleGenerate}
          disabled={isGenerating}
          className={`w-full py-2.5 lg:py-3.5 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2.5 transition-all duration-300 ${
            isDone
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
              : isGenerating
              ? "bg-[#7A3BFF]/25 text-white/40 cursor-not-allowed"
              : "text-white bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] hover:opacity-90"
          }`}
        >
          {isGenerating ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />Generating…</>
          ) : isDone ? "✓  All Done — Generate New" : (
            <>Generate Clay Rescue <ChevronRight className="w-4 h-4" /></>
          )}
          {!isDone && (
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[14px] font-bold ${
              isGenerating ? "bg-white/5 text-white/20" : hasEnough ? "bg-white/20 text-white" : "bg-white/5 text-white/30"
            }`}>
              <img src="/icons/whitecredit.png" alt="" className="w-4 h-4 object-contain" />
              {totalCredits}
            </span>
          )}
        </button>
      </div>
    </div>

    <NoCreditsModal
      open={noCreditsOpen}
      onClose={() => setNoCreditsOpen(false)}
      creditsNeeded={totalCredits}
      creditBalance={creditBalance}
    />
    </>
  );
}
