import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Sparkles, WandSparkles } from "lucide-react";
import VisualStyleSelector from "./VisualStyleSelector";
import ThirtyDaysCreditBadge from "./ThirtyDaysCreditBadge";
import ThirtyDaysQualityPicker from "./ThirtyDaysQualityPicker";
import { DEFAULT_QUALITY_TIER, DEFAULT_VISUAL_STYLE, QUALITY_TIERS, fetchThirtyDaysIdea, fetchThirtyDaysQualityTiers } from "./api/thirtyDaysApi";
import { DAYS_PER_VIDEO_OPTIONS, estimateSeriesSetupCredits } from "./api/thirtyDaysSeriesApi";

const EXAMPLES = ["LEGO Ninjago", "Pokémon", "Hogwarts", "Naruto", "One Piece", "Minecraft"];

// Series creation runs in the background and can genuinely take 40-90s for
// an uncached franchise — these stages are shown live (driven by the
// series row's planning_stage, polled server-side) so that wait reads as
// visible progress instead of a frozen button, per the explicit ask: a long
// wait is fine as long as it visibly progresses; a silent wait ending in
// "Signal timed out" is not.
const PLANNING_STAGE_LABELS = {
  resolving: (universe) => `Resolving ${universe || "your world"}…`,
  researching: () => "Researching the world…",
  planning: () => "Planning your 30-day story…",
  validating: () => "Creating your recurring characters and roadmap…",
  reserving: () => "Preparing persistent references…",
};

export default function ThirtyDaysSeriesSetup({ busy, planCode, error: submitError, planningStage, onRetry, onCreate, onBack }) {
  const [universe, setUniverse] = useState("");
  const [premise, setPremise] = useState("");
  const [visualStyle, setVisualStyle] = useState(DEFAULT_VISUAL_STYLE);
  const [quality, setQuality] = useState(DEFAULT_QUALITY_TIER);
  const [daysPerEpisode, setDaysPerEpisode] = useState(1);
  const [tiers, setTiers] = useState(QUALITY_TIERS);
  const [ideaBusy, setIdeaBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { fetchThirtyDaysQualityTiers().then(setTiers).catch(() => {}); }, []);

  const createIdea = async () => {
    if (universe.trim().length < 2) {
      setError("Enter a world first, then tap AI idea.");
      return;
    }
    setIdeaBusy(true); setError("");
    try { setPremise(await fetchThirtyDaysIdea({ universe: universe.trim(), mode: "series" })); }
    catch (caught) { setError(String(caught?.message || caught)); }
    finally { setIdeaBusy(false); }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (universe.trim().length < 2) return;
    let resolvedPremise = premise.trim();
    if (resolvedPremise.length < 5) {
      setIdeaBusy(true); setError("");
      try { resolvedPremise = await fetchThirtyDaysIdea({ universe: universe.trim(), mode: "series" }); setPremise(resolvedPremise); }
      catch (caught) { setError(String(caught?.message || caught)); setIdeaBusy(false); return; }
      setIdeaBusy(false);
    }
    onCreate({ universe: universe.trim(), premise: resolvedPremise, visualStyle, quality, daysPerEpisode });
  };
  const setupCredits = estimateSeriesSetupCredits(quality, 5);
  return <form onSubmit={submit} className="relative flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-lime-300/[.13] bg-[#0C0F0D] text-white lg:h-full lg:min-h-0">
    <div className="flex shrink-0 items-center gap-3 border-b border-white/[.06] px-5 py-3"><button type="button" onClick={onBack} className="rounded-lg p-1.5 text-white/35 hover:bg-white/5 hover:text-white"><ArrowLeft className="h-4 w-4" /></button><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-lime-300">New Series</p><h1 className="text-base font-black">Build your persistent story</h1></div></div>
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4"><div className="space-y-5 pb-28 lg:pb-4">
      <div><label className="text-xs font-bold text-white/75">What world are we entering?</label><input value={universe} onChange={(event) => setUniverse(event.target.value)} maxLength={120} placeholder="LEGO Ninjago" className="mt-2 w-full rounded-xl border border-emerald-950/80 bg-[#080B09] px-4 py-3 text-sm outline-none focus:border-lime-300/40" /><div className="mt-2 flex flex-wrap gap-1.5">{EXAMPLES.map((item) => <button key={item} type="button" onClick={() => setUniverse(item)} className="rounded-full border border-emerald-950/80 px-2.5 py-1 text-[10px] text-white/38 hover:border-emerald-700/50 hover:text-white/70">{item}</button>)}</div></div>
      <VisualStyleSelector value={visualStyle} onChange={setVisualStyle} />
      <div><div className="flex items-center justify-between"><label className="text-xs font-bold text-white/75">What happens during the 30 days?</label><button type="button" disabled={ideaBusy} onClick={createIdea} className="rounded-full bg-lime-300 px-2.5 py-1 text-[9px] font-black text-[#11150D] transition hover:bg-lime-200 disabled:cursor-wait disabled:opacity-60"><Sparkles className="mr-1 inline h-3 w-3" />{ideaBusy ? "Creating…" : "AI idea"}</button></div><textarea value={premise} onChange={(event) => setPremise(event.target.value)} rows={4} maxLength={500} placeholder="AI will build a premise that can sustain all 30 days…" className="mt-2 w-full resize-none rounded-xl border border-emerald-950/80 bg-[#080B09] p-3 text-sm leading-5 outline-none focus:border-lime-300/40" /></div>
      <div><div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-lime-300" /><p className="text-xs font-bold text-white/75">How many days should each video cover?</p></div><div className="mt-2 grid grid-cols-2 gap-2">{DAYS_PER_VIDEO_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => setDaysPerEpisode(option.value)} className={`rounded-xl border p-3 text-left transition ${daysPerEpisode === option.value ? "border-lime-300/45 bg-lime-300/[.075]" : "border-emerald-950/80 bg-[#090D0B] hover:border-emerald-700/45"}`}><strong className={daysPerEpisode === option.value ? "text-lime-200" : "text-white/75"}>{option.label}</strong><span className="ml-1 text-[10px] text-white/30">· {option.episodes} episodes</span><span className="mt-1 block text-[9px] leading-4 text-white/30">{option.description}</span></button>)}</div></div>
      <div><ThirtyDaysQualityPicker tiers={tiers} value={quality} planCode={planCode} onChange={setQuality} detailForTier={(tier) => `~${estimateSeriesSetupCredits(tier.id)} cr setup`} /><p className="mt-1.5 text-[9px] leading-4 text-white/28">Only persistent setup references are charged now. Each episode is charged later when you generate it.</p></div>
      {(error || submitError) && <div className="rounded-xl bg-red-400/10 p-3 text-xs text-red-200"><p>{error || submitError}</p>{onRetry && !busy && <button type="button" onClick={onRetry} className="mt-2 rounded-lg bg-red-400/15 px-3 py-1.5 text-[11px] font-bold text-red-100 hover:bg-red-400/25">Retry — no credits were used</button>}</div>}
    </div></div>
    <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-[90] border-t border-white/[.06] bg-[#0C0F0D]/95 p-4 backdrop-blur-xl lg:static"><button disabled={busy || ideaBusy || universe.trim().length < 2} className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-sm font-black text-[#11150D] disabled:opacity-40"><WandSparkles className="h-4 w-4" />{busy ? (PLANNING_STAGE_LABELS[planningStage]?.(universe.trim()) || "Building Series Bible…") : "Create Series"}{!busy && <ThirtyDaysCreditBadge value={setupCredits} />}</button></div>
  </form>;
}
