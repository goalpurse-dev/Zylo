import { ArrowLeft, ArrowRight, CalendarDays, Plus, Sparkles } from "lucide-react";
import { nextSeriesRange } from "./api/thirtyDaysSeriesApi";

function SeriesCard({ series, onOpen }) {
  const next = nextSeriesRange(series);
  const thumbnail = series.latestEpisode?.thumbnailUrl || series.coverUrl;
  return <button type="button" onClick={() => onOpen(series)} className="group flex w-full gap-3 rounded-2xl border border-emerald-950/70 bg-[#090D0B] p-3 text-left transition hover:border-emerald-700/45 hover:bg-[#0D130F]">
    <span className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl border border-white/[.06] bg-lime-300/[.05]">
      {thumbnail ? <img src={thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-lime-300/35" />}
    </span>
    <span className="min-w-0 flex-1 py-1">
      <strong className="block truncate text-sm text-white/85 group-hover:text-white">{series.title}</strong>
      <span className="mt-1 block truncate text-[10px] text-white/35">{series.universe}</span>
      <span className="mt-3 flex items-center gap-1.5 text-[10px] font-black text-lime-200"><CalendarDays className="h-3 w-3" />{series.status === "completed" ? "30 / 30 days · Complete" : `Next: ${next.label}`}</span>
      <span className="mt-1 block text-[9px] text-white/25">{series.episodeCount || 0} episodes · updated {series.lastActiveAt ? new Date(series.lastActiveAt).toLocaleDateString() : "recently"}</span>
    </span>
    <ArrowRight className="mt-1 h-4 w-4 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-lime-300" />
  </button>;
}

export default function ThirtyDaysSeriesHome({ series = [], busy, error, onCreate, onOpen, onBack }) {
  const empty = series.length === 0;
  return <section className="flex min-h-[520px] flex-col rounded-2xl border border-lime-300/[.13] bg-[#0C0F0D] p-5 text-white lg:h-full lg:min-h-0">
    <div className="shrink-0">
      <p className="text-[10px] font-black uppercase tracking-[.18em] text-lime-300">30 Days Series</p>
      <h1 className="mt-1 text-xl font-black">{empty ? "Your 30 Day Series" : "Your Series"}</h1>
      <p className="mt-2 text-xs leading-5 text-white/38">Build an ongoing story and generate the next episode whenever you&apos;re ready.</p>
    </div>
    {empty ? <div className="grid flex-1 place-items-center py-10 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-lime-300/15 bg-lime-300/[.06]"><CalendarDays className="h-6 w-6 text-lime-300" /></span><p className="mt-4 max-w-[260px] text-xs leading-5 text-white/35">Your universe, cast, visual references, story progress and future direction will stay ready between visits.</p></div></div>
      : <div className="mt-5 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">{series.map((item) => <SeriesCard key={item.id} series={item} onOpen={onOpen} />)}</div>}
    {error && <p className="mt-3 rounded-xl bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
    <div className="mt-4 shrink-0 space-y-2 border-t border-white/[.06] pt-4">
      <button type="button" disabled={busy} onClick={onCreate} className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-sm font-black text-[#11150D] hover:bg-lime-200 disabled:opacity-40"><Plus className="h-4 w-4" />Create New Series</button>
      <button type="button" onClick={onBack} className="flex w-full items-center justify-center gap-2 py-2 text-[11px] font-bold text-white/35 hover:text-white/65"><ArrowLeft className="h-3.5 w-3.5" />Back to Single Video</button>
    </div>
  </section>;
}
