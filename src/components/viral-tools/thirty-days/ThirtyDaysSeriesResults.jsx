import { ArrowLeft, Download, Image as ImageIcon, Play, Sparkles, Trash2 } from "lucide-react";
import { getThirtyDaysTier } from "./api/thirtyDaysApi";
import { formatEpisodeRange, nextSeriesRange } from "./api/thirtyDaysSeriesApi";
import { SceneCard } from "./ThirtyDaysResults";

// "voice" deliberately excluded: it means every scene already finished
// rendering (clips done, narration optional) — nothing is actually
// generating anymore at that point, so it must never force the detail view
// open just from merely opening/browsing a series that happens to be
// sitting in that phase from a past visit.
const ACTIVE = new Set(["planning", "references", "scenes", "stitching"]);

function EpisodeHistory({ episodes, selectedId, generation, onOpen, onDelete, deletingEpisodeId }) {
  if (!episodes.length) return <p className="rounded-xl border border-dashed border-emerald-950/80 p-5 text-center text-xs text-white/28">Your finished episodes will appear here.</p>;
  const latestEpisodeId = [...episodes].sort((a, b) => b.episodeNumber - a.episodeNumber)[0]?.id;
  return <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{episodes.map((episode) => {
    // A thumbnail otherwise only appears once the episode fully completes.
    // While it's still generating (or just finished without narration), fall
    // back to the first scene image already sitting in the loaded
    // generation so the card isn't a blank icon the whole time.
    const liveThumb = episode.id === selectedId
      ? generation?.scenes?.find((scene) => scene.imageUrl)?.imageUrl
      : null;
    const thumb = episode.thumbnailUrl || liveThumb;
    const canDelete = episode.id === latestEpisodeId;
    return <article key={episode.id} className={`relative rounded-xl border transition ${selectedId === episode.id ? "border-lime-300/35 bg-lime-300/[.055]" : "border-emerald-950/70 bg-[#090D0B] hover:border-emerald-700/40"}`}>
      <button type="button" onClick={() => onOpen(episode)} className="flex w-full gap-3 p-2 pr-10 text-left">
        <span className="relative h-20 w-12 shrink-0 overflow-hidden rounded-lg bg-black">{thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageIcon className="absolute inset-0 m-auto h-4 w-4 text-white/15" />}{episode.finalVideoUrl && <Play className="absolute inset-0 m-auto h-4 w-4 fill-white text-white" />}</span>
        <span className="min-w-0 py-1"><strong className="block truncate text-[11px] text-white/75">{formatEpisodeRange(episode.startDay, episode.endDay)}</strong><span className="mt-1 block truncate text-[9px] text-white/28">{episode.title}</span><span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${episode.status === "completed" ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>{episode.status}</span></span>
      </button>
      {canDelete && <button type="button" disabled={deletingEpisodeId === episode.id} onClick={() => onDelete(episode)} aria-label={`Delete ${formatEpisodeRange(episode.startDay, episode.endDay)}`} title="Delete latest episode" className="absolute right-2 top-2 rounded-lg border border-red-300/10 bg-red-400/[.06] p-1.5 text-red-200/55 transition hover:border-red-300/25 hover:bg-red-400/10 hover:text-red-100 disabled:cursor-wait disabled:opacity-35"><Trash2 className="h-3.5 w-3.5" /></button>}
    </article>;
  })}</div>;
}

function PlanningSkeleton() {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 7 }, (_, index) => (
    <article key={index} className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#111315] shadow-lg shadow-black/10">
      <div className="relative aspect-[9/16] overflow-hidden bg-gradient-to-br from-lime-400/[.11] via-[#151915] to-emerald-500/[.06]">
        <div className="absolute inset-0 grid place-items-center p-5 text-center">
          <div>
            <div className="mx-auto grid h-11 w-11 animate-pulse place-items-center rounded-2xl border border-lime-300/15 bg-lime-300/[.07]" />
            <p className="mt-3 text-[11px] font-bold text-white/40">Planning story…</p>
          </div>
        </div>
        <span className="absolute left-2.5 top-2.5 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] font-black backdrop-blur">Scene {index + 1}</span>
      </div>
      <div className="h-16 animate-pulse bg-white/[.02] p-3.5" />
    </article>
  ))}</div>;
}

export default function ThirtyDaysSeriesResults({ series, episodes = [], activeEpisode, focusedEpisodeId = null, generation, phase, planning = false, progressLabel, finalVideoUrl, onOpenEpisode, onCloseDetail, onDeleteEpisode, deletingEpisodeId = null, onRetryVideo, onRetryImage, onBack, error }) {
  if (!series) return <section className="grid min-h-[560px] place-items-center rounded-2xl border border-lime-300/[.13] bg-[#0C0F0D] p-8 text-center text-white lg:h-full lg:min-h-0"><div><Sparkles className="mx-auto h-8 w-8 text-lime-300/50" /><h2 className="mt-4 text-2xl font-black">30 Days Series</h2><p className="mt-2 text-xs text-white/35">Choose an existing series or create a new one.</p></div></section>;
  const completed = episodes.filter((episode) => episode.status === "completed");
  const active = (ACTIVE.has(phase) && generation?.generationMode?.startsWith("series")) || planning;
  // During the planner round-trip the new episode row does not exist yet,
  // so activeEpisode still points at the previously opened episode. Showing
  // that stale object under an active planning skeleton produced the exact
  // mismatch "Generating Days 3-4" + "Selected Episode Days 1-2". Until the
  // planner returns and the page focuses the newly created episode, render
  // the upcoming range from the series instead of falling back to the old
  // activeEpisode.
  const awaitingNewEpisode = planning && !focusedEpisodeId;
  // Detail view (this one episode's captions/scenes) only opens on an
  // explicit click or while a generation is actively running — merely
  // opening/browsing the series must land on the base dashboard + preview
  // grid instead, never straight into an episode.
  const selected = awaitingNewEpisode
    ? null
    : focusedEpisodeId
      ? episodes.find((episode) => episode.id === focusedEpisodeId) || activeEpisode
      : active
        ? activeEpisode
        : null;
  const showDetail = Boolean(selected) || active;
  const videoUrl = selected?.finalVideoUrl || (selected?.id === activeEpisode?.id ? finalVideoUrl : null);
  const sceneCount = generation?.scenes?.length || 0;
  const imagesDone = (generation?.scenes || []).filter((scene) => scene.imageUrl).length;
  const videosDone = (generation?.scenes || []).filter((scene) => scene.videoUrl).length;
  const progress = planning && !generation ? 4 : phase === "planning" ? 4 : phase === "references" ? 12 : phase === "scenes" ? 15 + ((imagesDone + videosDone) / Math.max(1, sceneCount * 2)) * 68 : phase === "voice" ? 88 : phase === "stitching" ? 95 : selected?.status === "completed" ? 100 : 0;
  const next = nextSeriesRange(series);
  const seriesComplete = series.currentDay >= series.totalDays || series.status === "completed";
  const tier = getThirtyDaysTier(generation?.qualityTier);
  const retryCredits = tier.videoCredits;
  const retryImageCredits = tier.imageCredits + tier.videoCredits;
  const allowVideoRetry = generation?.reservationStatus !== "reserved";
  const latestEpisodeId = [...episodes].sort((a, b) => b.episodeNumber - a.episodeNumber)[0]?.id;
  const canDeleteSelected = selected?.id && selected.id === latestEpisodeId;

  return <section className="min-h-full rounded-2xl border border-lime-300/[.13] bg-[#0C0F0D] p-4 text-white sm:p-5">
    <header className="border-b border-white/[.06] pb-4"><button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-[9px] font-bold text-white/28 hover:text-white/60"><ArrowLeft className="h-3 w-3" />All series</button><p className="text-[10px] font-black uppercase tracking-[.18em] text-lime-300">30 Days Series</p><h1 className="mt-1 text-xl font-black sm:text-2xl">{series.title}</h1><p className="mt-1 text-xs text-white/35">{series.universe}</p></header>

    {/* Base view only — the analytics summary gives way to the focused
        episode's own header once a detail view is open. */}
    {!showDetail && <div className="mt-4 rounded-2xl border border-emerald-950/75 bg-[#090D0B] p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/40">Story progress</p><p className="mt-1 text-4xl font-black text-lime-200">{series.currentDay}<span className="text-lg font-bold text-white/25"> / {series.totalDays} days</span></p></div>
        <div className="text-right"><p className="text-[10px] text-white/30">{completed.length} episode{completed.length === 1 ? "" : "s"} generated</p><p className="mt-1 text-xs font-black text-lime-300">{seriesComplete ? "Series complete" : `Next: ${next.label}`}</p></div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${Math.min(100, series.currentDay / series.totalDays * 100)}%` }} /></div>
    </div>}

    {active && <div className="mt-4 rounded-2xl border border-lime-300/15 bg-lime-300/[.045] p-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-black text-lime-100">{planning && !generation ? "Planning your episode…" : (progressLabel || "Creating episode")}</p><p className="mt-1 text-[10px] text-white/32">{planning && !generation ? "Writing the story, scenes, and continuity…" : `${imagesDone}/${sceneCount} images · ${videosDone}/${sceneCount} clips`}</p></div><span className="text-sm font-black text-lime-200">{Math.round(progress)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${progress}%` }} /></div></div>}
    {error && <p className="mt-4 rounded-xl bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}

    {showDetail ? (
      <div className="mt-5 rounded-2xl border border-emerald-950/70 bg-[#090D0B] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            {!active && <button type="button" onClick={onCloseDetail} className="mb-2 inline-flex items-center gap-1 text-[9px] font-bold text-lime-300/70 hover:text-lime-200"><ArrowLeft className="h-3 w-3" />Back to series</button>}
            <p className="text-[9px] font-black uppercase tracking-[.14em] text-lime-300">{selected ? "Selected Episode" : "Generating"}</p>
            <h2 className="mt-1 text-sm font-black">{selected ? `${formatEpisodeRange(selected.startDay, selected.endDay)} · ${selected.title}` : next.label}</h2>
          </div>
          <div className="flex items-center gap-2">
            {canDeleteSelected && <button type="button" disabled={deletingEpisodeId === selected.id} onClick={() => onDeleteEpisode(selected)} aria-label={`Delete ${formatEpisodeRange(selected.startDay, selected.endDay)}`} title="Delete latest episode" className="rounded-lg border border-red-300/10 bg-red-400/[.06] p-2 text-red-200/55 transition hover:border-red-300/25 hover:bg-red-400/10 hover:text-red-100 disabled:cursor-wait disabled:opacity-35"><Trash2 className="h-4 w-4" /></button>}
            {videoUrl && <a href={videoUrl} download className="rounded-lg border border-white/8 p-2 text-white/45 hover:text-white"><Download className="h-4 w-4" /></a>}
          </div>
        </div>
        {videoUrl ? <video key={videoUrl} src={videoUrl} controls playsInline preload="metadata" className="mx-auto max-h-[62vh] rounded-xl bg-black" /> : generation?.scenes?.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{generation.scenes.map((scene) => <SceneCard key={scene.id || scene.index} scene={scene} index={Number(scene.index)} onRetryVideo={onRetryVideo} onRetryImage={onRetryImage} allowVideoRetry={allowVideoRetry} retryCredits={retryCredits} retryImageCredits={retryImageCredits} />)}</div> : planning ? <PlanningSkeleton /> : <div className="grid aspect-video place-items-center rounded-xl border border-dashed border-emerald-950/70 text-xs text-white/25">Generate the first episode when you&apos;re ready.</div>}
      </div>
    ) : (
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">Episodes</h2><span className="text-[10px] text-white/30">{completed.length} generated</span></div>
        <EpisodeHistory episodes={episodes} selectedId={null} generation={generation} onOpen={onOpenEpisode} onDelete={onDeleteEpisode} deletingEpisodeId={deletingEpisodeId} />
      </div>
    )}
  </section>;
}
