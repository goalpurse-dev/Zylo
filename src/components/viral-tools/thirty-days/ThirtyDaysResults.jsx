import { AlertTriangle, ArrowLeft, Check, ChevronDown, Download, Image as ImageIcon, Loader2, Play, RotateCcw, Sparkles } from "lucide-react";
import { getThirtyDaysTier } from "./api/thirtyDaysApi";

// Reuse the two Lego community creations already shown on Workspace Home.
const demoVideo = "/library/lego.mp4";
const demoVideoTwo = "/library/lego2.mp4";

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);
const ACTIVE_PHASES = new Set(["planning", "references", "scenes", "voice", "stitching"]);

function counts(generation) {
  const references = generation?.visualReferences || [];
  const scenes = generation?.scenes || [];
  return {
    references,
    scenes,
    refsDone: references.filter((item) => TERMINAL.has(item.status)).length,
    imagesDone: scenes.filter((item) => TERMINAL.has(item.imageStatus)).length,
    videosDone: scenes.filter((item) => TERMINAL.has(item.videoStatus)).length,
  };
}

function groupScenesByMilestone(scenes) {
  const milestoneDays = scenes.length === 8 && scenes.every((scene) => [1, 10, 20, 30].includes(Number(scene.day)))
    ? [1, 10, 20, 30]
    : [...new Set(scenes.map((scene) => Number(scene.day)))];
  return milestoneDays.map((day) => ({
    day,
    scenes: scenes.filter((scene) => Number(scene.day) === day).sort((a, b) => Number(a.index) - Number(b.index)),
  }));
}

function getThirtyDaysProgress({ generation, phase, progressLabel, exportState }) {
  if (exportState?.status === "done") return 100;
  if (exportState?.status === "rendering") return Math.min(99, 95 + Math.max(0, Number(exportState.progress || 0)) * 0.05);
  if (phase === "planning") return /research/i.test(progressLabel || "") ? 10 : 5;
  const { references, scenes, refsDone, imagesDone, videosDone } = counts(generation);
  if (phase === "references") return 15 + (references.length ? (refsDone / references.length) * 15 : 0);
  if (["scenes", "partial", "error"].includes(phase) && scenes.length) return 30 + (imagesDone / scenes.length) * 25 + (videosDone / scenes.length) * 30;
  if (phase === "voice") return 90;
  return generation?.fullVideoUrl ? 100 : 0;
}

function statusText(scene) {
  if (scene.videoUrl && scene.videoStatus === "succeeded") return { label: "Complete", tone: "emerald" };
  // Dependency failures mark the unstarted video failed too. Show the real
  // upstream cause instead of claiming Runware attempted an animation.
  // A QA-rejected still keeps its URL for audit/download, but no video was
  // ever attempted from it.  Always identify that as an image failure rather
  // than the misleading downstream "Animation failed" state.
  if (scene.imageStatus === "failed") return { label: "Image rejected", tone: "red" };
  if (["queued", "running", "retrying"].includes(scene.videoStatus)) return { label: "Animating…", tone: "lime", loading: true };
  if (scene.videoStatus === "failed") return { label: "Animation failed", tone: "red" };
  if (scene.imageUrl && scene.imageStatus === "succeeded") return { label: "Preparing animation…", tone: "lime", loading: true };
  if (["queued", "running", "retrying"].includes(scene.imageStatus)) return { label: "Creating image…", tone: "lime", loading: true };
  if (scene.imageStatus === "failed") return { label: "Image failed", tone: "red" };
  return { label: "Reference preparation…", tone: "muted", loading: true };
}

export function SceneCard({ scene, index, onRetryVideo, onRetryImage, allowVideoRetry, retryCredits, retryImageCredits }) {
  const status = statusText(scene);
  const beat = scene.storyDevelopment || scene.visualGoal || scene.beat || "";
  const imageFailed = scene.imageStatus === "failed";
  return (
    <article className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#111315] shadow-lg shadow-black/10">
      <div className="relative aspect-[9/16] overflow-hidden bg-gradient-to-br from-lime-400/[.11] via-[#151915] to-emerald-500/[.06]">
        {scene.videoUrl ? <video src={scene.videoUrl} controls muted playsInline preload="metadata" className="h-full w-full object-cover" /> : scene.imageUrl ? <img src={scene.imageUrl} alt={scene.title || `Scene ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <div className="absolute inset-0 grid place-items-center p-5 text-center"><div><div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-lime-300/15 bg-lime-300/[.07]">{imageFailed ? <AlertTriangle className="h-5 w-5 text-red-300" /> : <Loader2 className="h-5 w-5 animate-spin text-lime-300" />}</div><p className="mt-3 text-[11px] font-bold text-white/55">{status.label}</p></div></div>}
        {status.loading && (scene.imageUrl || scene.videoUrl) && <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-black/40"><div className="h-full w-1/2 animate-pulse rounded-full bg-lime-300" /></div>}
        <span className="absolute left-2.5 top-2.5 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] font-black backdrop-blur">Scene {index + 1}</span>
      </div>
      <div className="p-3.5"><h3 className="text-sm font-black text-white">{scene.title || `Scene ${index + 1}`}</h3>{beat && <p className="mt-1.5 line-clamp-3 text-[11px] leading-4 text-white/40">{beat}</p>}<div className="mt-3 flex items-center justify-between gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold ${status.tone === "emerald" ? "bg-emerald-400/10 text-emerald-300" : status.tone === "red" ? "bg-red-400/10 text-red-300" : "bg-lime-300/[.08] text-lime-200"}`}>{status.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : status.tone === "emerald" ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{status.label}</span><div className="flex items-center gap-2">{scene.imageUrl && <a href={scene.imageUrl} download={`thirty-days-scene-${index + 1}.jpg`} className="text-[9px] font-bold text-white/40 hover:text-white"><Download className="mr-1 inline h-3 w-3" />Image</a>}{scene.videoUrl && <a href={scene.videoUrl} download={`thirty-days-scene-${index + 1}.mp4`} className="text-[9px] font-bold text-lime-300 hover:text-lime-200"><Download className="mr-1 inline h-3 w-3" />Clip</a>}</div></div>
      {imageFailed && onRetryImage && <div className="mt-3">{allowVideoRetry ? <button type="button" onClick={() => onRetryImage?.(scene.index)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-lime-300/25 bg-lime-300/[.08] px-3 py-2 text-[10px] font-black text-lime-200 transition hover:bg-lime-300/[.14]"><RotateCcw className="h-3.5 w-3.5" />Regenerate scene · {retryImageCredits} credits</button> : <p className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-center text-[9px] font-bold text-white/35">Waiting for the other scenes to finish before this can be retried…</p>}{scene.error && <p className="mt-1.5 line-clamp-2 text-[9px] leading-4 text-red-300/65">{scene.error}</p>}</div>}
      {!imageFailed && scene.videoStatus === "failed" && scene.imageUrl && <div className="mt-3">{allowVideoRetry ? <button type="button" onClick={() => onRetryVideo?.(scene.index)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-lime-300/25 bg-lime-300/[.08] px-3 py-2 text-[10px] font-black text-lime-200 transition hover:bg-lime-300/[.14]"><RotateCcw className="h-3.5 w-3.5" />Regenerate video · {retryCredits} credits</button> : <p className="rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 text-center text-[9px] font-bold text-white/35">Waiting for the other scenes to finish before this can be retried…</p>}{scene.videoError && <p className="mt-1.5 line-clamp-2 text-[9px] leading-4 text-red-300/65">{scene.videoError}</p>}</div>}</div>
    </article>
  );
}

function LoadingPanel({ progressLabel, progress }) {
  return <div className="mx-auto flex min-h-[520px] max-w-xl items-center justify-center px-4 py-12"><div className="w-full rounded-[28px] border border-lime-300/15 bg-gradient-to-br from-lime-400/[.08] via-white/[.025] to-emerald-400/[.04] p-7 text-center shadow-2xl shadow-black/20"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-lime-300/20 bg-lime-300/[.09]"><Sparkles className="h-6 w-6 animate-pulse text-lime-300" /></div><h2 className="mt-5 text-2xl font-black">Creating your 30-day story</h2><p className="mt-2 text-sm text-white/45">{progressLabel || "Creating a viral story…"}</p><div className="mt-7 h-2 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-lime-300 transition-[width] duration-700" style={{ width: `${Math.max(3, progress)}%` }} /></div><div className="mt-3 flex items-center justify-between text-[10px] font-bold text-white/30"><span>Planning</span><span>{Math.round(progress)}%</span><span>Final video</span></div></div></div>;
}

function ErrorPanel({ error, onRetry, onBackToSetup }) {
  return <div className="mx-auto flex min-h-[520px] max-w-xl items-center justify-center px-4 py-12"><div className="w-full rounded-[28px] border border-red-400/20 bg-red-400/[.055] p-7 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-400/10"><AlertTriangle className="h-5 w-5 text-red-300" /></div><h2 className="mt-4 text-xl font-black">We couldn’t start this story</h2><p className="mt-2 text-sm leading-6 text-red-100/65">{error}</p><div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">{onRetry && <button type="button" onClick={onRetry} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-black"><RotateCcw className="h-4 w-4" />Try again</button>}<button type="button" onClick={onBackToSetup} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-white/65"><ArrowLeft className="h-4 w-4" />Back to setup</button></div><p className="mt-4 text-[10px] text-white/25">Your world and premise are still saved in the setup form.</p></div></div>;
}

function PreviewVideo({ src, number, hiddenOnMobile = false }) {
  return <article className={`relative min-h-[360px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_16px_45px_rgba(0,0,0,.35)] ${hiddenOnMobile ? "hidden sm:block" : ""}`}><video src={src} autoPlay muted loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-lime-950/10" /><div className="absolute inset-x-0 bottom-0 p-4"><p className="text-sm font-black text-white">30 Days example {number}</p><p className="mt-1 text-[10px] font-semibold text-white/45">Vertical story preview</p></div></article>;
}

function RecentCreations({ items, onOpenRecent }) {
  return <section className="flex min-h-[360px] min-w-0 flex-1 flex-col rounded-2xl border border-white/10 bg-[#111315] p-4 shadow-[0_16px_45px_rgba(0,0,0,.35)]"><div className="mb-3"><h3 className="text-sm font-black text-white">Recent Creations</h3><p className="mt-1 text-[10px] text-white/30">Continue or reopen your 30 Days stories</p></div><div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">{items.slice(0, 8).map((item) => { const scene = (item.scenes || []).find((entry) => entry.videoUrl || entry.imageUrl); const thumbnail = scene?.imageUrl || (item.visualReferences || []).find((entry) => entry.imageUrl)?.imageUrl; return <button key={item.id} type="button" onClick={() => onOpenRecent?.(item)} className="group flex w-full items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.035] p-2 text-left transition hover:border-lime-300/25 hover:bg-white/[.06]"><span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-lime-400/20 to-emerald-400/5 ring-1 ring-white/10">{thumbnail ? <img src={thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Sparkles className="absolute inset-0 m-auto h-4 w-4 text-lime-300/50" />}{scene?.videoUrl && <span className="absolute inset-0 grid place-items-center bg-black/20"><Play className="h-4 w-4 fill-white text-white" /></span>}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-white/80 group-hover:text-white">{item.title || `30 Days in ${item.universe}`}</span><span className="mt-1 block text-[9px] font-semibold uppercase tracking-wide text-white/30">{item.status || "saved"} · {String(item.qualityTier || "v2").split("-").pop()}</span></span></button>; })}</div></section>;
}

function PreviewWorkspace({ recentGenerations, onOpenRecent, planning, progressLabel, progress }) {
  const hasRecent = recentGenerations.length > 0;
  return <section className="relative min-h-full overflow-hidden rounded-2xl border border-lime-300/[0.13] bg-[#0C0F0D] p-5 text-white"><div className="mb-5"><div className="flex items-center gap-2 text-lime-300"><Sparkles className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[.18em]">30 Days</span></div><h2 className="mt-2 text-2xl font-black sm:text-3xl">Turn one universe into a <span className="text-lime-300">four-day story.</span></h2><p className="mt-2 max-w-2xl text-xs leading-5 text-white/40">Four milestone days, two scenes per day, and one continuous narrated final video.</p></div><div className="relative flex min-h-[480px] flex-col gap-3 sm:flex-row"><PreviewVideo src={demoVideo} number={1} hiddenOnMobile={hasRecent} />{hasRecent ? <RecentCreations items={recentGenerations} onOpenRecent={onOpenRecent} /> : <PreviewVideo src={demoVideoTwo} number={2} />}{planning && <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/60 p-5 backdrop-blur-sm"><div className="w-full max-w-md"><LoadingPanel progressLabel={progressLabel} progress={progress} /></div></div>}</div></section>;
}

export default function ThirtyDaysResults({ generation, phase, progressLabel, error, finalVideoUrl, exportState, voiceTake, recentGenerations = [], onOpenRecent, onRetry, onRetryVideo, onBackToSetup }) {
  const { references, scenes, refsDone, imagesDone, videosDone } = counts(generation);
  const progress = getThirtyDaysProgress({ generation, phase, progressLabel, exportState });
  const active = ACTIVE_PHASES.has(phase) || exportState?.status === "rendering";
  const dayGroups = groupScenesByMilestone(scenes);
  const allowVideoRetry = generation?.reservationStatus !== "reserved";
  const activeReference = references.find((item) => !TERMINAL.has(item.status));
  const narrationDraft = generation?.narrationTake?.draft ? generation.narrationTake : null;
  const storyHook = narrationDraft?.hook || generation?.hook;
  const storyNarration = narrationDraft?.narration || voiceTake?.script || generation?.narrationScript;
  const retryCredits = getThirtyDaysTier(generation?.qualityTier).videoCredits;
  if (!generation && phase === "error") return <section className="min-h-full rounded-2xl border border-lime-300/[0.13] bg-[#0C0F0D] text-white"><ErrorPanel error={error} onRetry={onRetry} onBackToSetup={onBackToSetup} /></section>;
  if (!generation) return <PreviewWorkspace recentGenerations={recentGenerations} onOpenRecent={onOpenRecent} planning={phase === "planning"} progressLabel={progressLabel} progress={progress} />;
  return <section className="min-h-full rounded-2xl border border-lime-300/[0.13] bg-[#0C0F0D] p-4 text-white sm:p-5">
    <header className="mb-4 flex items-start justify-between gap-3 border-b border-white/8 pb-4"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.2em] text-lime-300">30 Days</p><h2 className="mt-1 text-xl font-black sm:text-2xl">{generation.title || `30 Days in ${generation.universe}`}</h2><p className="mt-2 max-w-3xl text-xs leading-5 text-white/45">{generation.premise}</p></div>{generation.refundedCredits > 0 && <span className="shrink-0 rounded-full bg-amber-300/10 px-2 py-1 text-[10px] text-amber-200">{generation.refundedCredits} credits refunded</span>}</header>
    {active && <div className="mb-5 rounded-2xl border border-lime-300/15 bg-lime-300/[.05] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-lime-100">{phase === "references" ? "Building your world" : phase === "scenes" ? "Creating your scenes" : phase === "voice" ? "Creating voiceover" : exportState?.status === "rendering" ? "Finalizing video" : progressLabel}</p><p className="mt-1 text-[11px] text-white/35">{phase === "references" ? `${activeReference ? `Creating ${activeReference.label}` : "Finishing references"} · ${refsDone} of ${references.length}` : phase === "scenes" ? `${imagesDone}/${scenes.length} images · ${videosDone}/${scenes.length} clips` : `${Math.round(progress)}% complete`}</p></div><span className="text-sm font-black text-lime-200">{Math.round(progress)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full rounded-full bg-lime-300 transition-[width] duration-700" style={{ width: `${progress}%` }} /></div></div>}
    {error && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/20 bg-red-400/[.06] p-4"><div><p className="text-xs font-black text-red-200">Generation needs attention</p><p className="mt-1 text-[11px] text-red-100/60">{error}</p></div><div className="flex gap-2">{onRetry && <button type="button" onClick={onRetry} className="rounded-lg bg-white px-3 py-2 text-[10px] font-black text-black">Try again</button>}<button type="button" onClick={onBackToSetup} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-white/60">Back to setup</button></div></div>}
    {finalVideoUrl && <div className="mb-6 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.04] p-4"><p className="mb-3 text-sm font-black">Final video</p><video src={finalVideoUrl} controls playsInline className="mx-auto max-h-[70vh] rounded-2xl bg-black" /><a href={finalVideoUrl} download="thirty-days.mp4" className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-xl bg-lime-300 px-4 py-2.5 text-xs font-black text-[#11150D]"><Download className="h-4 w-4" />Download Final Video</a></div>}
    <div className="mb-3 flex items-end justify-between"><div><h3 className="text-sm font-black">Story scenes</h3><p className="mt-1 text-[10px] text-white/30">Four milestone days with two connected scenes each.</p></div><span className="rounded-full border border-white/8 px-2 py-1 text-[10px] text-white/35">{videosDone}/{scenes.length} clips</span></div><div className="space-y-5">{dayGroups.map((group) => <section key={group.day} className="rounded-2xl border border-white/[.06] bg-white/[.018] p-3"><div className="mb-3 flex items-center gap-2"><span className="rounded-full bg-lime-300 px-2.5 py-1 text-[10px] font-black text-[#11150D]">Day {group.day}</span><span className="text-[10px] text-white/30">{group.scenes.length}{scenes.length === 8 ? "/2" : ""} scenes</span></div><div className="grid gap-3 sm:grid-cols-2">{group.scenes.map((scene) => <SceneCard key={scene.id || scene.index} scene={scene} index={Number(scene.index)} onRetryVideo={onRetryVideo} allowVideoRetry={allowVideoRetry} retryCredits={retryCredits} />)}</div></section>)}</div>
    {(phase === "voice" || voiceTake || generation.narrationScript) && <div className="mt-5 rounded-2xl border border-lime-300/12 bg-lime-300/[.035] p-4"><p className="text-[10px] font-black uppercase tracking-[.16em] text-lime-300">Continuous story voiceover</p><h3 className="mt-1 text-sm font-black">{voiceTake?.audioUrl ? "Narration ready" : "Your eight clips are ready for narration"}</h3>{narrationDraft && storyHook && <p className="mt-3 text-xs font-bold text-white/75">{storyHook}</p>}{storyNarration && <p className="mt-2 whitespace-pre-line text-xs leading-5 text-white/40">{storyNarration}</p>}{voiceTake?.audioUrl && <audio src={voiceTake.audioUrl} controls className="mt-3 w-full" />}{!voiceTake?.audioUrl && <p className="mt-2 text-[11px] text-white/35">Choose a voice and edit the continuous script in the voice workspace.</p>}</div>}
    {references.length > 0 && <details className="group mt-5 rounded-2xl border border-white/8 bg-white/[.02] p-4"><summary className="flex cursor-pointer list-none items-center justify-between text-xs font-black"><span>Visual references <span className="ml-2 font-normal text-white/30">{refsDone}/{references.length}</span></span><ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary><p className="mt-2 text-[10px] text-white/30">Consistency anchors used per scene across all four milestone days.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{references.map((ref) => <div key={ref.id} className="overflow-hidden rounded-xl border border-white/8 bg-black/25">{ref.imageUrl ? <img src={ref.imageUrl} alt={ref.label} className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center bg-gradient-to-br from-lime-400/[.08] to-transparent">{TERMINAL.has(ref.status) ? <ImageIcon className="h-5 w-5 text-white/15" /> : <Loader2 className="h-5 w-5 animate-spin text-lime-300" />}</div>}<div className="p-3"><p className="text-xs font-bold">{ref.label}</p><p className="mt-1 text-[10px] text-lime-200/60">{String(ref.role || "").replaceAll("_", " ")}</p><p className="mt-1 text-[9px] text-white/30">Used in: {[...new Set(scenes.filter((scene) => scene.referenceIds?.includes(ref.id)).map((scene) => `Day ${scene.day}`))].join(", ") || "—"}</p></div></div>)}</div></details>}
  </section>;
}
