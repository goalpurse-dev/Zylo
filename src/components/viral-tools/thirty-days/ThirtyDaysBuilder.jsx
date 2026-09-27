import { useEffect, useState } from "react";
import { Sparkles, WandSparkles } from "lucide-react";
import { DEFAULT_QUALITY_TIER, DEFAULT_VISUAL_STYLE, QUALITY_TIERS, REFERENCE_COUNT, estimateTotalCredits, fetchThirtyDaysIdea, fetchThirtyDaysQualityTiers } from "./api/thirtyDaysApi";
import ThirtyDaysCreditBadge from "./ThirtyDaysCreditBadge";
import ThirtyDaysQualityPicker from "./ThirtyDaysQualityPicker";
import VisualStyleSelector from "./VisualStyleSelector";

const EXAMPLES = ["LEGO Ninjago", "Pokémon", "Hogwarts", "Naruto", "One Piece", "Minecraft"];

export default function ThirtyDaysBuilder({ busy, planCode = "free", onGenerate }) {
  const [universe, setUniverse] = useState("");
  const [premise, setPremise] = useState("");
  const [quality, setQuality] = useState(DEFAULT_QUALITY_TIER);
  const [visualStyle, setVisualStyle] = useState(DEFAULT_VISUAL_STYLE);
  const [qualityTiers, setQualityTiers] = useState(QUALITY_TIERS);
  const [ideaBusy, setIdeaBusy] = useState(false);
  const [ideaError, setIdeaError] = useState("");

  useEffect(() => {
    let active = true;
    fetchThirtyDaysQualityTiers().then((tiers) => { if (active) setQualityTiers(tiers); }).catch(() => {
      // The checked-in fallback mirrors the pending migration so the builder
      // remains usable during a coordinated local rollout.
    });
    return () => { active = false; };
  }, []);

  const createIdea = async () => {
    if (universe.trim().length < 2) {
      setIdeaError("Enter a world first, then tap AI idea.");
      return;
    }
    setIdeaBusy(true); setIdeaError("");
    try { setPremise(await fetchThirtyDaysIdea({ universe: universe.trim() })); }
    catch (error) { setIdeaError(String(error?.message || error)); }
    finally { setIdeaBusy(false); }
  };

  const submit = (event) => {
    event.preventDefault();
    if (universe.trim().length < 2) return;
    onGenerate({ universe: universe.trim(), premise: premise.trim(), aiIdeaMode: !premise.trim(), quality, visualStyle });
  };

  const disabled = busy || universe.trim().length < 2;
  const generationCredits = estimateTotalCredits(quality, REFERENCE_COUNT, planCode);

  return (
    <form onSubmit={submit} className="relative flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-lime-300/[0.13] bg-[#0C0F0D] text-white shadow-[inset_0_1px_0_rgba(190,242,100,.05)] lg:h-full lg:min-h-0">
      <div className="shrink-0 border-b border-white/[0.06] px-5 py-4 lg:py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl border border-lime-300/20 bg-lime-300/10">
            <Sparkles className="h-4 w-4 text-lime-300" />
          </span>
          <div>
            <h1 className="text-[18px] font-black tracking-[-0.03em] text-white">30 Days</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-lime-300/65">You enter any fictional world</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-color:rgba(255,255,255,.2)_transparent] [scrollbar-width:thin] lg:py-3">
        <div className="flex flex-col gap-5 pb-[150px] lg:gap-4 lg:pb-3">
          <div>
            <label htmlFor="thirty-days-universe" className="text-xs font-bold text-white/75">What world are we entering?</label>
            <input
              id="thirty-days-universe"
              value={universe}
              onChange={(event) => setUniverse(event.target.value)}
              maxLength={120}
              placeholder="LEGO Ninjago"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition focus:border-lime-300/45 focus:ring-1 focus:ring-lime-300/25"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <button key={example} type="button" onClick={() => setUniverse(example)} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/45 transition hover:border-lime-300/30 hover:text-white">
                  {example}
                </button>
              ))}
            </div>
          </div>

          <VisualStyleSelector value={visualStyle} onChange={setVisualStyle} />

          <div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="thirty-days-premise" className="text-xs font-bold text-white/75">What happens for 30 days?</label>
              <button type="button" disabled={ideaBusy} onClick={createIdea} className="rounded-full bg-lime-300 px-3 py-1 text-[10px] font-bold text-[#11150D] transition hover:bg-lime-200 disabled:cursor-wait disabled:opacity-60">
                <Sparkles className="mr-1 inline h-3 w-3" />{ideaBusy ? "Creating…" : "AI idea"}
              </button>
            </div>
            <textarea
              id="thirty-days-premise"
              value={premise}
              onChange={(event) => setPremise(event.target.value)}
              maxLength={300}
              rows={4}
              placeholder="You arrive just as the world changes…"
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-5 outline-none transition focus:border-lime-300/45 focus:ring-1 focus:ring-lime-300/25"
            />
            <p className="mt-2 text-[10px] leading-4 text-white/30">Every story keeps YOU as the protagonist, even when the premise is a world-level crisis.</p>
            {ideaError && <p className="mt-2 text-[11px] text-red-300">{ideaError}</p>}
          </div>

          <ThirtyDaysQualityPicker
            tiers={qualityTiers}
            value={quality}
            planCode={planCode}
            onChange={setQuality}
            detailForTier={(tier) => `${estimateTotalCredits(tier.id, REFERENCE_COUNT, planCode)} cr`}
          />
        </div>
      </div>

      <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[0.07] bg-[#0C0F0D]/95 px-5 pb-2 pt-3 backdrop-blur-xl lg:static lg:shrink-0 lg:bg-[#0C0F0D] lg:pb-3 lg:pt-2.5">
        <button disabled={disabled} className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3.5 text-sm font-black text-[#11150D] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:bg-lime-300/15 disabled:text-lime-300/40 lg:py-2.5">
          <WandSparkles className="h-4 w-4" />{busy ? "Creating…" : "Create 30 Days video"}
          {!busy && <ThirtyDaysCreditBadge value={generationCredits} />}
        </button>
      </div>
    </form>
  );
}
