import { useState, useRef, useEffect } from "react";
import { Search, X, Sparkles } from "lucide-react";
import { useProfileCredits } from "../../../hooks/useProfileCredits";
import NoCreditsModal from "../shared/NoCreditsModal";
import { emitCreditSpend } from "../../../lib/creditPopEvents";
import { VIBES, DISH_CATEGORIES, ALL_DISHES } from "./api/cookingMaticApi";

function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export default function AICookingMaticBuilder({
  onGenerate,
  phase,
  recentGenerations = [],
  onLoadRecent,
  showRecentTab = true,
  totalCredits = 111,
  voiceLimit = 2,
  externalError = "",
}) {
  const creditBalance = useProfileCredits();
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const [setupTab, setSetupTab] = useState("generate"); // "generate" | "recent"
  const [aiChooses, setAiChooses] = useState(true);
  const [dishInput, setDishInput] = useState("");
  const [selectedVibe, setSelectedVibe] = useState(VIBES[0].id);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [validationError, setValidationError] = useState("");
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const TOTAL_CREDITS = totalCredits;

  const hasEnoughCredits = creditBalance >= totalCredits;
  const isGenerating = phase === "images" || phase === "videos" || phase === "retrying";
  const activeSetupTab = showRecentTab ? setupTab : "generate";

  useEffect(() => {
    const h = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filteredCategories = dishInput.trim().length < 1
    ? DISH_CATEGORIES
    : DISH_CATEGORIES.map(c => ({ ...c, dishes: c.dishes.filter(d => d.toLowerCase().includes(dishInput.toLowerCase())) })).filter(c => c.dishes.length > 0);

  const handleGenerate = () => {
    if (!hasEnoughCredits) { setNoCreditsOpen(true); return; }
    setValidationError("");
    if (aiChooses) {
      emitCreditSpend(TOTAL_CREDITS);
      onGenerate({ dishName: randomPick(ALL_DISHES), vibeId: selectedVibe });
    } else {
      const trimmed = dishInput.trim();
      if (!trimmed) { setValidationError("Enter a dish name."); return; }
      emitCreditSpend(TOTAL_CREDITS);
      onGenerate({ dishName: trimmed, vibeId: selectedVibe });
    }
  };

  return (
    <>
    <div className="flex min-h-0 flex-col rounded-2xl border border-white/[0.07] bg-[#0D0F11] lg:h-full lg:overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-5 pt-5 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden flex items-center justify-center shrink-0">
            <img
              src="/templates/AICOOKING/thumbnail.png"
              alt=""
              className="w-full h-full object-cover"
              onError={(event) => {
                event.currentTarget.src = "/templates/AICOOKING/bright.png";
              }}
            />
          </div>
          <h1 className="text-white font-black text-[16px]">AI Cooking Matic</h1>
        </div>
        {/* Small screens need the tab; desktop already has Recent on the right. */}
        {showRecentTab && (
          <div className="grid grid-cols-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-0.5">
            {["generate", "recent"].map(t => (
              <button key={t} type="button" onClick={() => setSetupTab(t)}
                className={`rounded-lg py-1.5 text-[12px] font-semibold transition capitalize ${activeSetupTab === t ? "bg-white text-black" : "text-white/45 hover:text-white/70"}`}>
                {t === "generate" ? "Generate" : `Recent${recentGenerations.length > 0 ? ` (${recentGenerations.length})` : ""}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className={`space-y-4 px-5 py-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:[scrollbar-width:none] ${
        activeSetupTab === "generate"
          ? "pb-[calc(156px+env(safe-area-inset-bottom))] lg:pb-4"
          : "pb-[calc(104px+env(safe-area-inset-bottom))] lg:pb-4"
      }`}>
      {activeSetupTab === "recent" ? (
        /* Recent generations list */
        <div className="space-y-2">
          {recentGenerations.length === 0 ? (
            <p className="text-white/25 text-[13px] text-center py-8">No generations yet</p>
          ) : recentGenerations.map(gen => {
            const thumbs = (gen.scenes ?? []).filter(s => s.imageUrl).slice(0, 3);
            const clipCount = (gen.clips ?? []).filter(c => c.videoUrl).length;
            return (
              <button key={gen.id} type="button" onClick={() => onLoadRecent(gen)}
                className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05] text-left transition">
                <div className="flex gap-1 shrink-0">
                  {thumbs.map((s, i) => (
                    <div key={i} className="w-9 h-11 rounded-lg overflow-hidden bg-white/[0.04]">
                      <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-[13px] font-bold truncate">{gen.dish_name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {gen.fullVideoUrl
                      ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-400/20">&#10003; Exported video</span>
                      : clipCount === 5 && gen.voice?.audioUrl
                      ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">✓ Voice added</span>
                      : clipCount === 5
                      ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">▶ Add Voice</span>
                      : clipCount > 0
                      ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{clipCount}/5 clips</span>
                      : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">▶ Continue</span>
                    }
                  </div>
                </div>
                <span className="text-white/20 group-hover:text-white/50 text-[16px] shrink-0">›</span>
              </button>
            );
          })}
        </div>
      ) : (
        /* Generate form — wrapped so footer still shows */
        <>

        {/* AI Chooses toggle */}
        <div
          className={`rounded-xl border px-4 py-3 flex items-center justify-between cursor-pointer select-none ${
            aiChooses ? "border-orange-500/40 bg-orange-500/[0.07]" : "border-white/[0.07] bg-white/[0.03]"
          }`}
          style={{ touchAction: "manipulation" }}
          onClick={() => setAiChooses(v => !v)}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className={`w-4 h-4 shrink-0 ${aiChooses ? "text-orange-400" : "text-white/30"}`} />
            <div>
              <p className={`text-[13px] font-bold leading-none ${aiChooses ? "text-white" : "text-white/50"}`}>AI chooses the dish</p>
              <p className="text-[11px] text-white/30 mt-0.5">{aiChooses ? "Random dish every time" : "I'll pick myself"}</p>
            </div>
          </div>
          <div className="relative shrink-0 rounded-full" style={{ width: 34, height: 18, background: aiChooses ? "#EA580C" : "rgba(255,255,255,0.10)" }}>
            <div className="absolute top-[3px] w-3 h-3 rounded-full bg-white shadow" style={{ left: aiChooses ? 17 : 3 }} />
          </div>
        </div>

        {/* Dish input — only when manual */}
        {!aiChooses && (
          <div>
            <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">Dish Name</label>
            <div className="relative" ref={dropdownRef}>
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                <input
                  ref={inputRef} type="text" placeholder="Search or type any dish…" value={dishInput}
                  onChange={e => { setDishInput(e.target.value); setDropdownOpen(true); setValidationError(""); }}
                  onFocus={() => setDropdownOpen(true)}
                  onKeyDown={e => { if (e.key === "Enter") { setDropdownOpen(false); handleGenerate(); } if (e.key === "Escape") setDropdownOpen(false); }}
                  className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl pl-9 pr-8 py-2.5 text-white text-[13px] placeholder:text-white/20 focus:outline-none focus:border-orange-500/40 transition"
                />
                {dishInput && <button onClick={() => { setDishInput(""); setDropdownOpen(false); }} className="absolute right-3 text-white/25 hover:text-white/50 transition"><X className="w-3.5 h-3.5" /></button>}
              </div>
              {dropdownOpen && filteredCategories.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#161820] border border-white/10 rounded-xl shadow-2xl max-h-52 overflow-y-auto [scrollbar-width:thin]">
                  {filteredCategories.map(cat => (
                    <div key={cat.label}>
                      <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-white/25 uppercase tracking-widest">{cat.label}</div>
                      {cat.dishes.map(d => (
                        <button key={d} onMouseDown={e => { e.preventDefault(); setDishInput(d); setDropdownOpen(false); setValidationError(""); }}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-white/65 hover:bg-white/[0.06] hover:text-white transition">{d}</button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {(validationError || externalError) && <p className="mt-1.5 text-[11px] font-medium text-red-400">{validationError || externalError}</p>}
          </div>
        )}

        {/* Visual style — always visible */}
        <div>
          <label className="block text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">Visual Style</label>
          <div className="grid grid-cols-2 gap-2.5">
            {VIBES.map(vibe => {
              const active = selectedVibe === vibe.id;
              return (
                <button key={vibe.id} type="button" onClick={() => setSelectedVibe(vibe.id)}
                  className={`group relative isolate h-[128px] w-full overflow-hidden rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5 ${
                    active
                      ? "border-transparent shadow-[0_0_0_1px_rgba(249,115,22,0.10),0_0_24px_rgba(249,115,22,0.16)]"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <img
                    src={vibe.image}
                    alt={vibe.label}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/18" />
                  <div className="absolute inset-x-0 top-0 h-[64px] bg-gradient-to-b from-black/95 via-black/78 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 h-[76px] bg-gradient-to-t from-black/95 via-black/78 to-transparent" />
                  <div className="absolute inset-y-0 left-0 w-[34%] bg-gradient-to-r from-black/30 to-transparent" />
                  {active && <div className="absolute inset-0 bg-orange-500/8" />}
                  {active && (
                    <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl">
                      <div className="absolute left-[1px] right-[1px] top-0 h-[2px] rounded-t-2xl bg-orange-500" />
                      <div className="absolute bottom-0 left-[1px] right-[1px] h-[2px] rounded-b-2xl bg-white" />
                      <div className="absolute bottom-[1px] left-0 top-[1px] w-[2px] bg-gradient-to-b from-orange-500 to-white" />
                      <div className="absolute bottom-[1px] right-0 top-[1px] w-[2px] bg-gradient-to-b from-orange-500 to-white" />
                    </div>
                  )}
                  <div className="relative z-10 flex h-full flex-col justify-between p-3">
                    <h3 className="line-clamp-1 pr-3 text-[13px] font-black leading-tight text-white [text-shadow:0_3px_14px_rgba(0,0,0,0.95)]">
                      {vibe.label}
                    </h3>
                    <p className="line-clamp-2 text-[11px] leading-snug text-white/95 [text-shadow:0_3px_14px_rgba(0,0,0,0.95)]">
                      {vibe.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        </> /* close generate tab */
      )} {/* close setupTab conditional */}
      </div>

      {/* Footer — only show on Generate tab */}
      {activeSetupTab === "generate" && <div className="fixed inset-x-3 bottom-[calc(86px+env(safe-area-inset-bottom))] z-40 shrink-0 rounded-2xl border border-white/[0.08] bg-[#101213]/96 px-4 pb-3 pt-3 shadow-[0_-18px_55px_rgba(0,0,0,0.50)] backdrop-blur-xl lg:static lg:inset-auto lg:z-auto lg:rounded-none lg:border-x-0 lg:border-b-0 lg:bg-transparent lg:px-5 lg:pb-5 lg:shadow-none">
        {!hasEnoughCredits && !isGenerating && (
          <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
            <span className="text-red-300 text-[12px] font-semibold">Need {TOTAL_CREDITS} cr · you have {creditBalance}</span>
            <a href="/workspace/pricing" className="text-red-200 text-[11px] font-bold underline shrink-0">Get Credits →</a>
          </div>
        )}
        <button type="button" onClick={handleGenerate} disabled={isGenerating}
          className={`w-full py-3 rounded-xl font-black text-[15px] flex items-center justify-center gap-2.5 transition-all ${
            isGenerating
              ? "bg-orange-600/20 text-white/35 cursor-not-allowed"
              : "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:opacity-90 shadow-lg shadow-orange-900/30 active:scale-[0.98]"
          }`}
        >
          {isGenerating ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />{phase === "videos" ? "Animating clips…" : "Generating scenes…"}</>
          ) : (
            <><Sparkles className="w-4 h-4" />Generate<span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full text-[12px] font-bold"><img src="/icons/whitecredit.png" alt="" className="w-3 h-3 object-contain" />{TOTAL_CREDITS}</span></>
          )}
        </button>
        <p className="mt-2 text-center text-[10px] text-white/25">Includes scenes, clips, AI script tools and up to {voiceLimit} generated voice takes.</p>
      </div>} {/* close generate-tab footer */}
    </div>
    <NoCreditsModal open={noCreditsOpen} onClose={() => setNoCreditsOpen(false)} creditsNeeded={TOTAL_CREDITS} creditBalance={creditBalance} />
    </>
  );
}
