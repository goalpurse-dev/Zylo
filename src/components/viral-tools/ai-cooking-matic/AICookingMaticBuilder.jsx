import { useState, useRef, useEffect } from "react";
import { ChefHat, Search, X, ChevronDown } from "lucide-react";
import { useProfileCredits } from "../../../hooks/useProfileCredits";
import NoCreditsModal from "../shared/NoCreditsModal";
import {
  VIBES,
  DISH_CATEGORIES,
  ALL_DISHES,
  TOTAL_CREDITS,
} from "./api/cookingMaticApi";

const QUICK_PICKS = [
  "Crispy Shrimp", "Wagyu Beef", "Pasta Carbonara",
  "Beef Birria Tacos", "Teriyaki Salmon", "Korean Fried Chicken",
];

export default function AICookingMaticBuilder({ onGenerate, phase }) {
  const creditBalance                     = useProfileCredits();
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const [dishInput, setDishInput]         = useState("");
  const [selectedVibe, setSelectedVibe]   = useState(VIBES[0].id);
  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [validationError, setValidationError] = useState("");
  const inputRef   = useRef(null);
  const dropdownRef = useRef(null);

  const hasEnoughCredits = creditBalance >= TOTAL_CREDITS;
  const isGenerating     = phase === "images";
  const isDone           = phase === "done";

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredCategories = dishInput.trim().length < 1
    ? DISH_CATEGORIES
    : DISH_CATEGORIES.map((cat) => ({
        ...cat,
        dishes: cat.dishes.filter((d) =>
          d.toLowerCase().includes(dishInput.toLowerCase())
        ),
      })).filter((cat) => cat.dishes.length > 0);

  const selectDish = (name) => {
    setDishInput(name);
    setDropdownOpen(false);
    setValidationError("");
  };

  const handleGenerate = () => {
    const trimmed = dishInput.trim();
    if (!trimmed) { setValidationError("Enter a dish name to generate."); return; }
    if (!hasEnoughCredits) { setNoCreditsOpen(true); return; }
    setValidationError("");
    onGenerate({ dishName: trimmed, vibeId: selectedVibe });
  };

  const currentVibe = VIBES.find((v) => v.id === selectedVibe) ?? VIBES[0];

  return (
    <>
    <div className="flex flex-col h-full bg-[#0D0F11] rounded-2xl border border-white/[0.07] overflow-hidden">

      {/* ── HEADER ── */}
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500/30 to-red-600/20 border border-orange-500/20 shrink-0">
            <ChefHat className="w-5 h-5 text-orange-300" />
          </div>
          <div>
            <h1 className="text-white font-black text-[17px] leading-tight tracking-tight">
              AI Cooking Matic
            </h1>
            <p className="text-white/40 text-[12px] mt-0.5">
              10 cinematic scenes from one dish
            </p>
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] px-5 py-4 space-y-5">

        {/* ── DISH NAME ── */}
        <div>
          <label className="block text-white/60 text-[11px] font-bold uppercase tracking-widest mb-2">
            Dish Name
          </label>
          {/* Quick picks */}
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {QUICK_PICKS.map((d) => (
              <button
                key={d}
                onClick={() => selectDish(d)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition border ${
                  dishInput === d
                    ? "bg-orange-500/20 border-orange-500/40 text-orange-200"
                    : "bg-white/[0.04] border-white/10 text-white/50 hover:bg-white/[0.08] hover:text-white/80"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Combobox */}
          <div className="relative" ref={dropdownRef}>
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-white/30 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search or type any dish…"
                value={dishInput}
                onChange={(e) => { setDishInput(e.target.value); setDropdownOpen(true); setValidationError(""); }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={(e) => { if (e.key === "Enter") { setDropdownOpen(false); handleGenerate(); } if (e.key === "Escape") setDropdownOpen(false); }}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.07] transition"
              />
              {dishInput && (
                <button
                  onClick={() => { setDishInput(""); setDropdownOpen(false); inputRef.current?.focus(); }}
                  className="absolute right-3 text-white/30 hover:text-white/60 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {dropdownOpen && filteredCategories.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#161820] border border-white/10 rounded-xl shadow-2xl max-h-56 overflow-y-auto [scrollbar-width:thin]">
                {filteredCategories.map((cat) => (
                  <div key={cat.label}>
                    <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-white/30 uppercase tracking-widest">
                      {cat.label}
                    </div>
                    {cat.dishes.map((d) => (
                      <button
                        key={d}
                        onMouseDown={(e) => { e.preventDefault(); selectDish(d); }}
                        className="w-full text-left px-3 py-2 text-[13px] text-white/70 hover:bg-white/[0.06] hover:text-white transition"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {dropdownOpen && filteredCategories.length === 0 && dishInput.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#161820] border border-white/10 rounded-xl shadow-xl px-4 py-3">
                <p className="text-[13px] text-white/40">
                  Using <span className="text-white/70 font-semibold">"{dishInput.trim()}"</span> as a custom dish
                </p>
              </div>
            )}
          </div>

          {validationError && (
            <p className="text-red-400 text-[11px] font-medium mt-1.5">{validationError}</p>
          )}
        </div>

        {/* ── VISUAL VIBE ── */}
        <div>
          <label className="block text-white/60 text-[11px] font-bold uppercase tracking-widest mb-2">
            Visual Style
          </label>
          <div className="grid grid-cols-1 gap-2">
            {VIBES.map((vibe) => {
              const active = selectedVibe === vibe.id;
              return (
                <button
                  key={vibe.id}
                  onClick={() => setSelectedVibe(vibe.id)}
                  style={active ? { borderColor: vibe.accent + "55", boxShadow: `0 0 0 1px ${vibe.accent}33` } : {}}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                    active
                      ? "bg-white/[0.07] border-white/20"
                      : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-[#0D0F11] transition-all"
                    style={{
                      backgroundColor: vibe.accent,
                      ringColor: active ? vibe.accent : "transparent",
                      opacity: active ? 1 : 0.5,
                    }}
                  />
                  <div className="min-w-0">
                    <p className={`text-[13px] font-bold leading-none ${active ? "text-white" : "text-white/60"}`}>
                      {vibe.label}
                    </p>
                    <p className="text-[11px] text-white/35 mt-0.5">{vibe.desc}</p>
                  </div>
                  {active && (
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: vibe.accent + "22", color: vibe.accent }}>
                      SELECTED
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── WHAT YOU GET ── */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
          <p className="text-white/50 text-[11px] font-bold uppercase tracking-widest mb-2">What you get</p>
          <div className="space-y-1">
            {[
              "10 cinematic cooking scenes",
              "Scene-to-scene visual chaining",
              "Locked lighting & color grade",
              "3D chef character (scenes 1 & 9)",
              "Download each scene",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-orange-400/60 shrink-0" />
                <span className="text-white/45 text-[12px]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="shrink-0 px-5 pb-5 pt-3 border-t border-white/[0.06]">
        {!hasEnoughCredits && !isGenerating && (
          <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-red-300 text-[12px] font-semibold">Need {TOTAL_CREDITS} credits · you have {creditBalance}</span>
            <a href="/workspace/pricing" className="text-red-200 text-[11px] font-bold underline shrink-0">Get Credits →</a>
          </div>
        )}

        <button
          onClick={isDone ? undefined : handleGenerate}
          disabled={isGenerating}
          className={`w-full py-3 rounded-xl font-black text-[15px] flex items-center justify-center gap-2.5 transition-all duration-300 ${
            isGenerating
              ? "bg-orange-600/25 text-white/40 cursor-not-allowed"
              : isDone
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
              : "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90 shadow-lg shadow-orange-900/30"
          }`}
        >
          {isGenerating ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
              Generating…
            </>
          ) : isDone ? (
            "Generate New Story"
          ) : (
            <>
              <ChefHat className="w-4 h-4" />
              Generate 10 Scenes
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-white/20 rounded-full text-[13px] font-bold">
                <img src="/icons/whitecredit.png" alt="" className="w-3.5 h-3.5 object-contain" />
                {TOTAL_CREDITS}
              </span>
            </>
          )}
        </button>
      </div>
    </div>

    <NoCreditsModal
      open={noCreditsOpen}
      onClose={() => setNoCreditsOpen(false)}
      creditsNeeded={TOTAL_CREDITS}
      creditBalance={creditBalance}
    />
    </>
  );
}
