import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Clock3, Lock, Shuffle, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useProfileCredits } from "../../../hooks/useProfileCredits";
import { emitCreditSpend } from "../../../lib/creditPopEvents";
import NoCreditsModal from "../shared/NoCreditsModal";
import BehindTheScenesUpgradeModal from "./BehindTheScenesUpgradeModal";
import {
  DEFAULT_QUALITY_TIER,
  DISASTERS,
  EPISODE_IDEAS,
  PLAN_LABELS,
  QUALITY_TIERS,
  QUALITY_TIER_MIN_PLAN,
  VANTAGES,
  calcCredits,
  getAllowedQualityTiers,
  randomEpisodeIdea,
} from "./api/behindTheScenesApi";

const PLACE_EXAMPLES = [
  { label: "Harbor metropolis", value: "A dense Mediterranean-style harbor metropolis of pale stone towers" },
  { label: "Neon downtown", value: "A neon-lit futuristic downtown with tall glass megatowers" },
  { label: "Old river city", value: "A historic European river city with domed rooftops and stone bridges" },
  { label: "Desert skyline", value: "A desert skyline of sand-colored towers and wind-carved spires" },
];

const DISASTER_LIST = Object.values(DISASTERS);
const VANTAGE_LIST = Object.values(VANTAGES);

function sampleIdeas(count) {
  return [...EPISODE_IDEAS].sort(() => Math.random() - 0.5).slice(0, count);
}

export default function BehindTheScenesBuilder({
  onGenerate,
  onReset,
  onRequestUpgrade,
  phase,
  planCode,
  values,
  onValuesChange,
  historyMode = false,
  onDone,
}) {
  const place = values?.place ?? "";
  const disaster = values?.disaster ?? "wave";
  const vantage = values?.vantage ?? "tank-edge";
  const qualityId = values?.qualityId ?? DEFAULT_QUALITY_TIER;
  const [validationError, setValidationError] = useState("");
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const [showMoreDisasters, setShowMoreDisasters] = useState(false);
  const [trendingIdeas, setTrendingIdeas] = useState(() => sampleIdeas(4));
  const [upgradeTierId, setUpgradeTierId] = useState(null);
  const creditBalance = useProfileCredits();
  const allowedTiers = getAllowedQualityTiers(planCode);
  const selectedTier = QUALITY_TIERS[qualityId] ?? QUALITY_TIERS[DEFAULT_QUALITY_TIER];
  const totalCredits = useMemo(() => calcCredits(qualityId), [qualityId]);
  const isGenerating = phase === "image" || phase === "video";
  const isDone = phase === "done" || phase === "error";
  const visibleDisasters = showMoreDisasters ? DISASTER_LIST : DISASTER_LIST.slice(0, 6);

  const updateValue = (key, value) => {
    if (historyMode) return;
    const next = { ...values, [key]: value };
    // Manually editing place or disaster means the user is customizing
    // beyond a selected bespoke episode preset — fall back to the generic
    // disaster+place assembly instead of silently keeping the old preset's
    // hand-written scene.
    if ((key === "place" || key === "disaster") && values?.episodeId) next.episodeId = null;
    onValuesChange?.(next);
  };

  const applyIdea = (idea) => {
    if (historyMode) return;
    onValuesChange?.({ ...values, place: idea.place, disaster: idea.disaster, vantage: idea.vantage, episodeId: idea.id });
    setValidationError("");
  };

  const selectQuality = (id) => {
    if (allowedTiers.includes(id)) {
      updateValue("qualityId", id);
      return;
    }
    // No tier at all is allowed for this plan (guest/free) — that's the
    // account-level paywall's job, not this tier-specific upgrade nudge.
    if (allowedTiers.length === 0) {
      onRequestUpgrade?.();
      return;
    }
    setUpgradeTierId(id);
  };

  const handleGenerate = () => {
    const cleanPlace = place.trim();
    if (cleanPlace.length < 8) {
      setValidationError("Describe the place we should rebuild as a miniature.");
      return;
    }
    if (!allowedTiers.includes(qualityId)) {
      if (allowedTiers.length === 0) onRequestUpgrade?.();
      else setUpgradeTierId(qualityId);
      return;
    }
    if (creditBalance < totalCredits) {
      setNoCreditsOpen(true);
      return;
    }
    setValidationError("");
    emitCreditSpend(totalCredits, "Behind the Scenes");
    onGenerate({ place: cleanPlace, disaster, vantage, qualityId, episodeId: values?.episodeId ?? null });
  };

  return (
    <section className="relative flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-lime-300/[0.13] bg-[#0C0F0D] shadow-[inset_0_1px_0_rgba(190,242,100,.05)] lg:h-full lg:min-h-0">
      {historyMode && <div className="pointer-events-none absolute inset-x-0 bottom-[66px] top-0 z-30 bg-[radial-gradient(circle_at_55%_25%,rgba(130,135,130,.16),transparent_32%),linear-gradient(rgba(112,116,112,.16),rgba(45,48,46,.34))] backdrop-grayscale" />}
      <div className={`shrink-0 border-b border-white/[0.06] px-5 py-4 transition lg:py-2.5 ${historyMode ? "opacity-[.55] grayscale" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="relative grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-lime-300/35 bg-gradient-to-br from-lime-300/15 via-[#121910] to-[#08130C] shadow-[0_0_26px_rgba(190,242,100,.14)]">
            <img src="/behind-the-scenes/poster.webp" alt="" className="h-full w-full object-cover" />
          </div>
          <div>
            <h1 className="text-[19px] font-black tracking-tight text-white">Behind the Scenes</h1>
            <p className="mt-1 max-w-[310px] text-[11px] leading-relaxed text-white/40">Turn any city into a tiny practical model and destroy it with real on-set FX.</p>
          </div>
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-4 transition [scrollbar-color:rgba(255,255,255,.2)_transparent] [scrollbar-width:thin] lg:py-3 ${historyMode ? "pointer-events-none opacity-[.55] grayscale" : ""}`}>
        <div className="flex flex-col gap-5 pb-[150px] lg:gap-3 lg:pb-0">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3 lg:mb-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">Trending episode ideas</p>
              <button
                type="button"
                onClick={() => setTrendingIdeas(sampleIdeas(4))}
                disabled={historyMode}
                className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-white/35 transition hover:text-white/65"
              >
                <Shuffle className="h-3 w-3" />
                Shuffle
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {trendingIdeas.map((idea) => (
                <button
                  key={idea.id}
                  type="button"
                  onClick={() => applyIdea(idea)}
                  disabled={historyMode}
                  className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-left transition hover:border-lime-300/25 hover:bg-white/[0.055]"
                >
                  <span className="text-[15px] leading-none">{idea.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-white/70">{idea.label}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/25" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5">What happens?</p>
            <div className="grid grid-cols-3 gap-1.5">
              {visibleDisasters.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => updateValue("disaster", option.id)}
                  disabled={historyMode}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition ${disaster === option.id ? "border-lime-300/45 bg-lime-300/[0.09] text-white" : "border-white/[0.07] bg-white/[0.035] text-white/55 hover:text-white/80"}`}
                >
                  <span className="text-[18px] leading-none">{option.icon}</span>
                  <span className="text-[10px] font-bold leading-tight">{option.label}</span>
                </button>
              ))}
            </div>
            {DISASTER_LIST.length > 6 && (
              <button
                type="button"
                onClick={() => setShowMoreDisasters((current) => !current)}
                disabled={historyMode}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg py-1 text-[10px] font-bold text-white/35 transition hover:text-white/60"
              >
                {showMoreDisasters ? "Show fewer" : "More"}
                <ChevronDown className={`h-3 w-3 transition ${showMoreDisasters ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>

          <div>
            <label htmlFor="bts-place" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5">Where should we build the set?</label>
            <p className="mb-2 -mt-1 text-[10px] font-medium leading-relaxed text-white/30">Describe a city or skyline — we'll shrink it into a tiny practical model and destroy it.</p>
            <textarea
              id="bts-place"
              value={place}
              onChange={(event) => { updateValue("place", event.target.value); setValidationError(""); }}
              disabled={historyMode}
              maxLength={180}
              rows={4}
              placeholder="Describe a city or skyline..."
              className="h-[116px] w-full resize-none rounded-2xl border border-white/[0.08] bg-[#111315] px-4 py-3 text-[14px] leading-relaxed text-white outline-none transition placeholder:text-white/20 focus:border-lime-300/35 focus:ring-1 focus:ring-lime-300/30 lg:h-[76px] lg:py-2.5"
            />
            <div className="mt-2 flex flex-wrap gap-1.5 lg:mt-1.5">
              {PLACE_EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => { updateValue("place", example.value); setValidationError(""); }}
                  disabled={historyMode}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/45 transition hover:border-lime-300/25 hover:text-white/75"
                >
                  {example.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const pool = PLACE_EXAMPLES.filter((example) => example.value !== place);
                  const pick = (pool.length ? pool : PLACE_EXAMPLES)[Math.floor(Math.random() * (pool.length ? pool.length : PLACE_EXAMPLES.length))];
                  updateValue("place", pick.value);
                  setValidationError("");
                }}
                disabled={historyMode}
                className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/45 transition hover:border-lime-300/25 hover:text-white/75"
              >
                🎲 Random
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5">Camera</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.07] bg-[#0E1012] p-1">
              {VANTAGE_LIST.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => updateValue("vantage", option.id)}
                  disabled={historyMode}
                  className={`rounded-lg px-1 py-2 text-[10px] font-bold transition lg:py-1.5 ${vantage === option.id ? "bg-white text-black" : "text-white/45 hover:bg-white/[0.06] hover:text-white/75"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-end justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">Quality</p>
              <span className="text-[10px] font-semibold text-white/25">8 sec · 9:16</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(QUALITY_TIERS).map((tier) => {
                const locked = !allowedTiers.includes(tier.id);
                const active = qualityId === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => selectQuality(tier.id)}
                    disabled={historyMode}
                    className={`relative h-[56px] rounded-xl border px-2 py-1.5 text-center transition lg:h-[48px] ${active && !locked ? "border-lime-300/50 bg-lime-300/[0.1]" : "border-white/[0.08] bg-white/[0.035] hover:border-white/15"}`}
                  >
                    <span className={`block text-[13px] font-black ${locked ? "text-white/30" : active ? "text-lime-300" : "text-white"}`}>
                      {locked && <Lock className="mr-1 inline h-3 w-3" />}{tier.label}
                    </span>
                    <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-wide text-white/30">{locked ? PLAN_LABELS[QUALITY_TIER_MIN_PLAN[tier.id]] : tier.tag}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5 lg:mt-1.5 lg:py-1.5">
              <p className="text-[11px] font-bold text-white/75">{selectedTier.description}</p>
              <div className="mt-1.5 flex items-center gap-3 text-[10px] font-semibold text-white/35">
                <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />8 seconds</span>
                <span className="flex items-center gap-1">
                  {selectedTier.withSound ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                  {selectedTier.withSound ? "Natural set audio" : "No audio generated"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.07] bg-[#0C0F0D]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:shrink-0 lg:bg-[#0C0F0D] lg:pb-3 lg:pt-2.5">
        {validationError && <p className="mb-2 text-center text-[11px] font-semibold text-red-400">{validationError}</p>}
        {historyMode ? (
          <button
            type="button"
            onClick={onDone}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-black transition lg:py-2.5 border border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.08]"
          >
            Done
          </button>
        ) : isDone ? (
          <button
            type="button"
            onClick={onReset}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-black transition lg:py-2.5 border border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.08]"
          >
            Create another
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyIdea(randomEpisodeIdea())}
              disabled={isGenerating}
              title="Surprise me"
              aria-label="Surprise me"
              className="flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3.5 text-white/70 transition hover:bg-white/[0.08] lg:py-2.5"
            >
              <Sparkles className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-black transition lg:py-2.5 ${isGenerating ? "cursor-not-allowed bg-lime-300/15 text-lime-300/40" : "bg-lime-300 text-[#11150D] hover:bg-lime-200"}`}
            >
              {isGenerating ? (phase === "image" ? "Building the set..." : "Animating the shot...") : <>
                Generate Episode
                <span className="flex items-center gap-1 text-[13px] font-semibold">
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
                  {totalCredits}
                </span>
                <ChevronRight className="h-4 w-4" />
              </>}
            </button>
          </div>
        )}
      </div>

      <NoCreditsModal open={noCreditsOpen} onClose={() => setNoCreditsOpen(false)} creditsNeeded={totalCredits} creditBalance={creditBalance} />
      <BehindTheScenesUpgradeModal
        open={!!upgradeTierId}
        onClose={() => setUpgradeTierId(null)}
        modelId={upgradeTierId}
        requiredPlan={upgradeTierId ? QUALITY_TIER_MIN_PLAN[upgradeTierId] : null}
      />
    </section>
  );
}
