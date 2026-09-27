import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, BookOpen, CalendarDays, Check, ChevronRight, ImagePlus, Loader2, Maximize2, Plus, RotateCcw, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import { getThirtyDaysTier } from "./api/thirtyDaysApi";
import { estimateSeriesEpisodeCredits, formatEpisodeRange, nextSeriesRange } from "./api/thirtyDaysSeriesApi";
import ThirtyDaysDeleteReferenceModal from "./ThirtyDaysDeleteReferenceModal";

function ConfirmEpisodeModal({ label, credits, onConfirm, onCancel }) {
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="thirty-days-confirm-episode-title" className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-lime-300/[0.13] bg-[#0C0F0D] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/[0.07] text-white/45 transition hover:text-white"><X className="h-4 w-4" /></button>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-lime-300/25 bg-lime-300/10"><Sparkles className="h-6 w-6 text-lime-300" /></div>
        <h2 id="thirty-days-confirm-episode-title" className="text-center text-xl font-black text-white">Generate {label}?</h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-white/50">Seven scenes, about 35–42 seconds, narrated.</p>
        <div className="mt-4 rounded-2xl border border-white/[.08] bg-white/[.03] p-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-white/35">Cost</p>
          <p className="mt-1 text-2xl font-black text-lime-200">{credits} credits</p>
          <p className="mt-1 text-[10px] text-white/30">Before any optional new references this episode adds</p>
        </div>
        <button type="button" onClick={onConfirm} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 py-3 text-sm font-black text-[#11150D] transition hover:bg-lime-200"><WandSparkles className="h-4 w-4" />Yes, generate it</button>
        <button type="button" onClick={onCancel} className="mt-3 w-full py-1 text-sm text-white/35 transition hover:text-white/60">Cancel</button>
      </div>
    </div>,
    document.body,
  );
}

function ReferencePreviewModal({ reference, credits, editing, selectingImageId, onClose, onEdit, onSelectImage }) {
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState("");
  const [selectedImageId, setSelectedImageId] = useState(reference?.selectedImageId || null);
  if (!reference?.imageUrl) return null;
  const storedVersions = Array.isArray(reference.imageHistory) ? reference.imageHistory.filter((item) => item?.id && item?.imageUrl) : [];
  const versions = storedVersions.length ? storedVersions : [{ id: "current", imageUrl: reference.imageUrl, kind: "original" }];
  const selectedVersion = versions.find((item) => item.id === selectedImageId)
    || versions.find((item) => item.id === reference.selectedImageId)
    || versions.find((item) => item.imageUrl === reference.imageUrl)
    || versions[versions.length - 1];
  const selectVersion = async (version) => {
    if (!version || version.id === selectedVersion.id || selectingImageId) return;
    setError("");
    try {
      await onSelectImage?.(reference, version);
      setSelectedImageId(version.id);
    } catch (caught) {
      setError(String(caught?.message || caught || "Could not switch reference version"));
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!instruction.trim() || editing) return;
    setError("");
    try {
      await onEdit?.({ ...reference, imageUrl: selectedVersion.imageUrl }, instruction.trim());
      onClose();
    } catch (caught) {
      setError(String(caught?.message || caught || "The reference edit could not be started"));
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${reference.label || "Reference"} preview`} className="relative flex h-full w-full max-w-6xl flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="flex min-h-0 flex-1 gap-3 pb-4">
          <aside aria-label="Reference image versions" className="w-[76px] shrink-0 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-1.5 backdrop-blur-xl sm:w-[92px]">
            <div className="space-y-2">{versions.map((version, index) => {
              const selected = version.id === selectedVersion.id;
              return <button type="button" key={version.id} onClick={() => selectVersion(version)} disabled={Boolean(selectingImageId)} title={selected ? "Active reference version" : `Use ${version.kind === "original" ? "original" : `edit ${index}`} as active reference`} className={`group relative block w-full overflow-hidden rounded-xl border transition ${selected ? "border-lime-300 ring-2 ring-lime-300/35" : "border-white/10 hover:border-lime-300/45"} disabled:opacity-55`}>
                <img src={version.imageUrl} alt={version.kind === "original" ? "Original reference" : `Reference edit ${index}`} className="aspect-[9/16] w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/75 px-1 py-1 text-[7px] font-black uppercase tracking-wide text-white/70">{version.kind === "original" ? "Original" : `Edit ${index}`}</span>
                {selected && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-lime-300 text-[#11150D] shadow-lg"><Check className="h-3 w-3" /></span>}
                {selectingImageId === version.id && <span className="absolute inset-0 grid place-items-center bg-black/55"><Loader2 className="h-4 w-4 animate-spin text-lime-200" /></span>}
              </button>;
            })}</div>
          </aside>
          <div className="flex min-w-0 flex-1 items-center justify-center rounded-2xl bg-black/20 p-1">
            <img src={selectedVersion.imageUrl} alt={reference.label || "Persistent reference"} className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl" />
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close image preview" className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/75 text-white/75 transition hover:bg-white/15 hover:text-white"><X className="h-5 w-5" /></button>
        <form onSubmit={submit} className="shrink-0 rounded-2xl border border-lime-300/25 bg-black/45 p-3 shadow-2xl backdrop-blur-2xl">
          <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="thirty-days-reference-edit" className="text-xs font-black text-lime-200">Edit this reference</label><span className="text-[10px] text-white/38">Editing the selected version · original stays saved</span></div>
          <div className="flex gap-2"><input id="thirty-days-reference-edit" value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={800} placeholder="Describe exactly what to change…" className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[.035] px-3 py-3 text-sm text-white shadow-inner outline-none placeholder:text-white/28 focus:border-lime-300/55 focus:bg-white/[.06]" /><button type="submit" disabled={!instruction.trim() || editing} className="inline-flex min-w-[124px] items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 text-sm font-black text-[#11150D] shadow-[0_0_24px_rgba(190,255,85,.16)] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40">{editing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Edit</span><span className="border-l border-[#11150D]/25 pl-2 text-xs">◈ {credits}</span></>}</button></div>
          {error && <p className="mt-2 text-[10px] text-red-200">{error}</p>}
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default function ThirtyDaysSeriesSidebar({ series, activeEpisode, busy, episodeActive, episodeGeneration, episodePartial, setupActive, setupGeneration, phase, progressLabel, planCode, unresumedEpisode, showOpenEpisode = false, onContinueEpisode, onGenerateNext, onRetryReference, onDeleteReference, deletingReferenceId = null, onRegenerateReference, regeneratingReferenceId = null, onEditReference, editingReferenceId = null, onSelectReferenceImage, selectingReferenceImageId = null, onRestoreReferences, restoringReferences = false, onAllSeries, onNewSeries }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [referencePendingDelete, setReferencePendingDelete] = useState(null);
  const [previewReference, setPreviewReference] = useState(null);
  const next = nextSeriesRange(series);
  const complete = series.currentDay >= series.totalDays || series.status === "completed";
  const pricing = estimateSeriesEpisodeCredits(series.qualityTier, planCode, 0);
  const referenceEditCredits = Number(getThirtyDaysTier(series.qualityTier).referenceCredits || 0);

  const confirmGenerate = () => { setConfirmOpen(false); onGenerateNext(); };

  const sceneCount = episodeGeneration?.scenes?.length || 7;
  const imagesDone = (episodeGeneration?.scenes || []).filter((scene) => scene.imageUrl).length;
  const videosDone = (episodeGeneration?.scenes || []).filter((scene) => scene.videoUrl).length;
  const genProgress = phase === "planning" ? 4 : phase === "references" ? 12 : phase === "scenes" ? 15 + ((imagesDone + videosDone) / Math.max(1, sceneCount * 2)) * 68 : phase === "voice" ? 88 : phase === "stitching" ? 95 : 0;

  const refCount = setupGeneration?.visualReferences?.length || 5;
  const refsDone = (setupGeneration?.visualReferences || []).filter((ref) => ref.status === "succeeded").length;
  const setupProgress = phase === "planning" ? 8 : phase === "references" ? 15 + (refsDone / Math.max(1, refCount)) * 80 : 98;
  const anyProgressActive = episodeActive || setupActive;
  // An episode can introduce a place/identity reference before it is merged
  // into the durable series library. Show that in-progress addition here too,
  // so the creator can see the exact persistent memory being built.
  const referenceCandidates = setupGeneration?.visualReferences?.length
    ? setupGeneration.visualReferences
    : [...(series.referenceLibrary || []), ...(episodeGeneration?.visualReferences || [])];
  const displayedReferences = referenceCandidates.filter((reference, index, list) =>
    list.findIndex((candidate) => (candidate?.id && candidate.id === reference?.id)
      || (candidate?.entityId && candidate.entityId === reference?.entityId)) === index,
  );
  const confirmReferenceDelete = async () => {
    if (!referencePendingDelete) return;
    const removed = await onDeleteReference?.(referencePendingDelete);
    if (removed !== false) setReferencePendingDelete(null);
  };

  return <section className="flex min-h-[520px] flex-col rounded-2xl border border-lime-300/[.13] bg-[#0C0F0D] p-5 text-white lg:h-full lg:min-h-0">
    <button type="button" onClick={onAllSeries} className="inline-flex w-fit items-center gap-1 text-[10px] font-bold text-white/32 hover:text-white/65"><ArrowLeft className="h-3.5 w-3.5" />Your Series</button>

    {/* Next episode CTA leads — this is the one action most visits are here for. */}
    <div className="mt-4 shrink-0 rounded-2xl bg-lime-300/[.035] p-4">
      {setupActive ? <><div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-lime-300" /><p className="text-[9px] font-black uppercase tracking-[.15em] text-lime-300">Building your world</p></div><h2 className="mt-1 text-xl font-black">Creating cast &amp; references</h2><p className="mt-2 text-xs text-white/45">{phase === "planning" ? "Writing the series bible…" : `${refsDone}/${refCount} persistent references ready`}</p><p className="mt-1 text-[10px] text-white/30">These 5 images are generated once and reused in every future episode — no episode has started yet.</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${Math.round(setupProgress)}%` }} /></div><p className="mt-2 text-right text-[10px] font-black text-lime-200">{Math.round(setupProgress)}%</p></>
        : episodeActive ? <><div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-lime-300" /><p className="text-[9px] font-black uppercase tracking-[.15em] text-lime-300">Generating</p></div><h2 className="mt-1 text-xl font-black">{next.label}</h2><p className="mt-2 text-xs text-white/45">{progressLabel || "Creating episode…"}</p><p className="mt-1 text-[10px] text-white/30">{imagesDone}/{sceneCount} images · {videosDone}/{sceneCount} clips</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${Math.round(genProgress)}%` }} /></div><p className="mt-2 text-right text-[10px] font-black text-lime-200">{Math.round(genProgress)}%</p></>
        : episodePartial ? <><p className="text-[9px] font-black uppercase tracking-[.15em] text-amber-300">Needs Attention</p><h2 className="mt-1 text-xl font-black">{formatEpisodeRange(activeEpisode?.startDay, activeEpisode?.endDay)}</h2><p className="mt-3 text-xs leading-5 text-white/40">{videosDone}/{sceneCount} scenes finished — one or more didn't pass visual quality checks. Retry the failed scene on the right to finish this episode; the rest are already done.</p></>
        : unresumedEpisode ? <><p className="text-[9px] font-black uppercase tracking-[.15em] text-amber-300">In Progress</p><h2 className="mt-1 text-xl font-black">{formatEpisodeRange(unresumedEpisode.startDay, unresumedEpisode.endDay)}</h2><p className="mt-3 text-xs leading-5 text-white/40">This episode hasn't finished yet — a scene may still need attention. Open it to see progress and retry anything stuck.</p><button type="button" onClick={onContinueEpisode} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-sm font-black text-[#11150D] hover:bg-lime-200"><WandSparkles className="h-4 w-4" />Continue {formatEpisodeRange(unresumedEpisode.startDay, unresumedEpisode.endDay)}</button></>
        : complete ? <><span className="grid h-10 w-10 place-items-center rounded-xl bg-lime-300 text-[#11150D]"><Check className="h-5 w-5" /></span><h2 className="mt-4 text-xl font-black">Series Complete 🎉</h2><p className="mt-2 text-xs leading-5 text-white/38">All {series.totalDays} days are finished. Every episode remains available in Recent.</p></>
        : <><p className="text-[9px] font-black uppercase tracking-[.15em] text-lime-300">Next Episode</p><h2 className="mt-1 text-xl font-black">{next.label}</h2><p className="mt-3 text-xs leading-5 text-white/40">{series.nextEpisodeTease || "The series planner will continue from the latest outcome without asking you to explain the world again."}</p><div className="mt-3 rounded-xl bg-black/20 p-3 text-[9px] leading-4 text-white/28"><CalendarDays className="mr-1 inline h-3 w-3" />Seven scenes · about 35–42 sec · <strong className="text-lime-200">{pricing.total} credits</strong> before optional new references</div><button type="button" disabled={busy || series.status === "references"} onClick={() => setConfirmOpen(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-sm font-black text-[#11150D] hover:bg-lime-200 disabled:opacity-35"><WandSparkles className="h-4 w-4" />Generate {next.label}<span className="flex items-center gap-1 text-[13px] font-semibold"><span aria-hidden="true" className="h-4 w-4 shrink-0 bg-current" style={{ WebkitMaskImage: "url('/icons/credits.png')", maskImage: "url('/icons/credits.png')", WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain" }} />{pricing.total}</span><ChevronRight className="h-4 w-4" /></button></>}
    </div>

    {/* Duplicates the bigger analytics card now shown on the Result side on desktop, where both panels are visible at once — kept for mobile, where only one panel shows at a time. Hidden while generating: the live progress card above already covers it, and this would just show a stale 0/30. */}
    {!anyProgressActive && <div className="lg:hidden">
      <p className="mt-5 text-[9px] font-black uppercase tracking-[.16em] text-lime-300">Current series</p><h1 className="mt-1 text-xl font-black">{series.title}</h1><p className="mt-1 text-xs text-white/35">{series.universe}</p>
      <div className="mt-5 rounded-2xl border border-emerald-950/75 bg-[#090D0B] p-4"><div className="flex items-center justify-between"><span className="text-[10px] font-bold text-white/40">Story progress</span><strong className="text-lime-200">{series.currentDay}/{series.totalDays}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-lime-300" style={{ width: `${series.currentDay / series.totalDays * 100}%` }} /></div><p className="mt-3 text-[10px] text-white/30"><CalendarDays className="mr-1 inline h-3 w-3" />{series.status === "completed" ? "Series complete" : `Next: ${next.label}`}</p></div>
    </div>}
    {showOpenEpisode && activeEpisode && <div className="mt-3 rounded-xl border border-lime-300/12 bg-lime-300/[.035] p-3"><p className="text-[9px] font-black uppercase tracking-wide text-lime-300">Open episode</p><p className="mt-1 text-xs font-bold">{formatEpisodeRange(activeEpisode.startDay, activeEpisode.endDay)}</p><p className="mt-1 truncate text-[9px] text-white/30">{activeEpisode.title}</p></div>}
    <div className="mt-5 flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-lime-300/70" /><p className="text-[10px] font-black uppercase tracking-wide text-white/45">Persistent references</p></div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-3 gap-2">{displayedReferences.map((ref) => {
          const awaitingRegeneration = ref.status === "awaiting_regeneration" || (!ref.imageUrl && ref.status === "deleted");
          const regenerating = regeneratingReferenceId === ref.id;
          return <div key={ref.id} className="overflow-hidden rounded-lg border border-emerald-950/70 bg-black">
            <div className="relative aspect-square">
              {ref.imageUrl ? <button type="button" onClick={() => setPreviewReference(ref)} title={`Open ${ref.label || "reference"}`} aria-label={`Open ${ref.label || "reference"}`} className="group h-full w-full cursor-zoom-in"><img src={ref.imageUrl} alt={ref.label || "Persistent reference"} loading="lazy" className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]" /><span className="absolute bottom-1 left-1 grid h-6 w-6 place-items-center rounded-md bg-black/70 text-white/65 opacity-0 transition group-hover:opacity-100"><Maximize2 className="h-3 w-3" /></span></button>
                : awaitingRegeneration ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-lime-300/[.035] p-2 text-center"><ImagePlus className="h-5 w-5 text-lime-300/65" /><p className="text-[7px] font-black uppercase tracking-wide text-white/28">{String(ref.role || "reference").replace(/_/g, " ")}</p><button type="button" disabled={busy || regenerating} onClick={() => onRegenerateReference?.(ref)} className="inline-flex items-center gap-1 rounded-md bg-lime-300 px-2 py-1 text-[8px] font-black text-[#11150D] hover:bg-lime-200 disabled:opacity-40">{regenerating ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}{regenerating ? "Generating" : "Generate"}</button></div>
                : ref.status === "failed" ? <div className="absolute inset-0 grid place-items-center gap-1 p-1 text-center"><AlertTriangle className="h-3.5 w-3.5 text-red-300" /><button type="button" onClick={() => onRetryReference?.(ref.id)} className="mt-1 inline-flex items-center gap-1 rounded-md bg-red-950/80 px-1.5 py-1 text-[7px] font-black text-red-100 hover:bg-red-900"><RotateCcw className="h-2.5 w-2.5" />Retry</button></div>
                : <Loader2 className="absolute inset-0 m-auto h-4 w-4 animate-spin text-lime-300/60" />}
              {ref.imageUrl && <button type="button" disabled={busy || deletingReferenceId === ref.id} onClick={(event) => { event.stopPropagation(); setReferencePendingDelete(ref); }} title={`Delete ${ref.label || "reference"}`} aria-label={`Delete ${ref.label || "reference"}`} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md border border-red-200/15 bg-black/75 text-red-200/75 shadow-lg backdrop-blur-sm transition hover:border-red-200/35 hover:bg-red-400/20 hover:text-red-100 disabled:opacity-35">{deletingReferenceId === ref.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}</button>}
            </div>
            <p className="truncate px-1.5 py-1 text-[8px] text-white/35">{ref.label}</p>
          </div>;
        })}</div>
        {!displayedReferences.length && <p className="rounded-xl border border-dashed border-lime-300/15 bg-lime-300/[.025] px-3 py-4 text-center text-[10px] text-white/30">No persistent references are currently attached.</p>}
        <p className="mt-2 text-[9px] leading-4 text-white/24">Generated once and reused across every future episode.</p>
        <button type="button" disabled={busy || restoringReferences} onClick={onRestoreReferences} title="Restore original persistent references" className="mt-2 inline-flex items-center gap-1 rounded-lg border border-lime-300/20 bg-lime-300/[.06] px-2 py-1.5 text-[9px] font-black text-lime-200 transition hover:border-lime-300/40 hover:bg-lime-300/[.12] disabled:opacity-40">
          {restoringReferences ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}Restore references
        </button>
      </div>
    </div>
    <button type="button" disabled={busy} onClick={onNewSeries} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-900/60 bg-emerald-950/20 px-3 py-2.5 text-[11px] font-black text-white/55 hover:border-lime-300/25 hover:text-white disabled:opacity-40"><Plus className="h-3.5 w-3.5" />Create another series</button>

    {confirmOpen && <ConfirmEpisodeModal label={next.label} credits={pricing.total} onConfirm={confirmGenerate} onCancel={() => setConfirmOpen(false)} />}
    <ThirtyDaysDeleteReferenceModal reference={referencePendingDelete} deleting={Boolean(referencePendingDelete && deletingReferenceId === referencePendingDelete.id)} onConfirm={confirmReferenceDelete} onCancel={() => setReferencePendingDelete(null)} />
    <ReferencePreviewModal key={previewReference?.id || "none"} reference={previewReference} credits={referenceEditCredits} editing={editingReferenceId === previewReference?.id} selectingImageId={selectingReferenceImageId} onEdit={onEditReference} onSelectImage={onSelectReferenceImage} onClose={() => setPreviewReference(null)} />
  </section>;
}
