import { useMemo, useState } from "react";
import { ChevronRight, Clock3, Lock, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useProfileCredits } from "../../../hooks/useProfileCredits";
import { emitCreditSpend } from "../../../lib/creditPopEvents";
import NoCreditsModal from "../shared/NoCreditsModal";
import CartoonDriveByUpgradeModal from "./CartoonDriveByUpgradeModal";
import {
  DEFAULT_QUALITY_TIER,
  PLAN_LABELS,
  QUALITY_TIERS,
  QUALITY_TIER_MIN_PLAN,
  calcCredits,
  getAllowedQualityTiers,
} from "./api/cartoonDriveByApi";

const WORLD_EXAMPLES = [
  "A pineapple home and stone tiki house beneath the sea",
  "A cheerful yellow family's suburban cartoon neighborhood",
  "A blocky fantasy kingdom with a distant mountain castle",
  "A colorful racing-game highway approaching a mushroom castle",
];

const MOODS = [
  { id: "golden-dusk", label: "Golden Dusk", color: "#F59E0B" },
  { id: "pink-sunset", label: "Pink Sunset", color: "#F472B6" },
  { id: "purple-twilight", label: "Purple Twilight", color: "#A78BFA" },
  { id: "fiery-red", label: "Fiery Red", color: "#F87171" },
];

const VEHICLES = ["car", "bus", "train", "camper van"];

export default function CartoonDriveByBuilder({
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
  const world = values?.world ?? "";
  const vehicle = values?.vehicle ?? "car";
  const mood = values?.mood ?? "golden-dusk";
  const qualityId = values?.qualityId ?? DEFAULT_QUALITY_TIER;
  const [validationError, setValidationError] = useState("");
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const [upgradeTierId, setUpgradeTierId] = useState(null);
  const creditBalance = useProfileCredits();
  const allowedTiers = getAllowedQualityTiers(planCode);
  const selectedTier = QUALITY_TIERS[qualityId] ?? QUALITY_TIERS[DEFAULT_QUALITY_TIER];
  const totalCredits = useMemo(() => calcCredits(qualityId), [qualityId]);
  const isGenerating = phase === "image" || phase === "video";
  const isDone = phase === "done" || phase === "error";

  const updateValue = (key, value) => {
    if (historyMode) return;
    onValuesChange?.({ ...values, [key]: value });
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
    const cleanWorld = world.trim();
    if (cleanWorld.length < 8) {
      setValidationError("Describe the cartoon or game place you want to drive past.");
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
    emitCreditSpend(totalCredits, "Cartoon Drive By");
    onGenerate({ world: cleanWorld, vehicle, mood, qualityId });
  };

  return (
    <section className="relative flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-lime-300/[0.13] bg-[#0C0F0D] shadow-[inset_0_1px_0_rgba(190,242,100,.05)] lg:h-full lg:min-h-0">
      {historyMode && <div className="pointer-events-none absolute inset-x-0 bottom-[66px] top-0 z-30 bg-[radial-gradient(circle_at_55%_25%,rgba(130,135,130,.16),transparent_32%),linear-gradient(rgba(112,116,112,.16),rgba(45,48,46,.34))] backdrop-grayscale" />}
      <div className={`shrink-0 border-b border-white/[0.06] px-5 py-4 transition lg:py-2.5 ${historyMode ? "opacity-[.55] grayscale" : ""}`}>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-lime-300/20 bg-lime-300/10">
            <Sparkles className="h-4 w-4 text-lime-300" />
          </span>
          <div>
            <h1 className="text-[18px] font-black tracking-[-0.03em] text-white">Cartoon Drive By</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-lime-300/65">Lost worlds, made real</p>
          </div>
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-4 transition [scrollbar-color:rgba(255,255,255,.2)_transparent] [scrollbar-width:thin] lg:overflow-hidden lg:py-3 ${historyMode ? "pointer-events-none opacity-[.55] grayscale" : ""}`}>
        <div className="flex flex-col gap-5 pb-[150px] lg:gap-3 lg:pb-0">
          <div>
            <label htmlFor="cartoon-drive-world" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5">World to drive past</label>
            <textarea
              id="cartoon-drive-world"
              value={world}
              onChange={(event) => { updateValue("world", event.target.value); setValidationError(""); }}
              disabled={historyMode}
              maxLength={180}
              rows={4}
              placeholder="Describe an iconic cartoon or video-game place..."
              className="h-[116px] w-full resize-none rounded-2xl border border-white/[0.08] bg-[#111315] px-4 py-3 text-[14px] leading-relaxed text-white outline-none transition placeholder:text-white/20 focus:border-lime-300/35 focus:ring-1 focus:ring-lime-300/30 lg:h-[76px] lg:py-2.5"
            />
            <div className="mt-2 flex flex-wrap gap-1.5 lg:mt-1.5">
              {WORLD_EXAMPLES.map((example, index) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => { updateValue("world", example); setValidationError(""); }}
                  disabled={historyMode}
                  className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/45 transition hover:border-lime-300/25 hover:text-white/75"
                >
                  Idea {index + 1}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5">Sunset mood</p>
            <div className="grid grid-cols-2 gap-2">
              {MOODS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => updateValue("mood", option.id)}
                  disabled={historyMode}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[11px] font-bold transition lg:py-1.5 ${mood === option.id ? "border-lime-300/45 bg-lime-300/[0.09] text-white" : "border-white/[0.07] bg-white/[0.035] text-white/55 hover:text-white/80"}`}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: option.color }} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 lg:mb-1.5">Vehicle</p>
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/[0.07] bg-[#0E1012] p-1">
              {VEHICLES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateValue("vehicle", option)}
                  disabled={historyMode}
                  className={`rounded-lg px-1 py-2 text-[10px] font-bold capitalize transition lg:py-1.5 ${vehicle === option ? "bg-white text-black" : "text-white/45 hover:bg-white/[0.06] hover:text-white/75"}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-end justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">Quality</p>
              <span className="text-[10px] font-semibold text-white/25">10 sec · 9:16</span>
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
                <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />10 seconds</span>
                <span className="flex items-center gap-1">
                  {selectedTier.withSound ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                  {selectedTier.withSound ? "Natural audio" : "No audio generated"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.07] bg-[#0C0F0D]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:shrink-0 lg:bg-[#0C0F0D] lg:pb-3 lg:pt-2.5">
        {validationError && <p className="mb-2 text-center text-[11px] font-semibold text-red-400">{validationError}</p>}
        <button
          type="button"
          onClick={historyMode ? onDone : isDone ? onReset : handleGenerate}
          disabled={isGenerating}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-black transition lg:py-2.5 ${isGenerating ? "cursor-not-allowed bg-lime-300/15 text-lime-300/40" : isDone ? "border border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.08]" : "bg-lime-300 text-[#11150D] hover:bg-lime-200"}`}
        >
          {historyMode ? "Done" : isGenerating ? (phase === "image" ? "Building the world..." : "Animating the drive-by...") : isDone ? "Create another" : <>
            Generate
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

      <NoCreditsModal open={noCreditsOpen} onClose={() => setNoCreditsOpen(false)} creditsNeeded={totalCredits} creditBalance={creditBalance} />
      <CartoonDriveByUpgradeModal
        open={!!upgradeTierId}
        onClose={() => setUpgradeTierId(null)}
        modelId={upgradeTierId}
        requiredPlan={upgradeTierId ? QUALITY_TIER_MIN_PLAN[upgradeTierId] : null}
      />
    </section>
  );
}
