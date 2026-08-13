import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, Clapperboard, Dices, Download, Loader2, Maximize2, Play, RotateCcw, Shuffle, X } from "lucide-react";
import { saveMediaToDevice } from "../../../lib/downloadMedia";

// Served straight from /public/behind-the-scenes — drop real footage in there
// with these exact filenames (see the README in that folder) and it swaps in
// with no code changes needed.
const demoVideo = "/behind-the-scenes/example-1.mp4";
const demoVideoTwo = "/behind-the-scenes/example-2.mp4";
const demoImage = "/behind-the-scenes/poster.webp";

function timeAgo(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function creationDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function MediaViewer({ result, onClose }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[500] grid place-items-center bg-black/90 p-4 backdrop-blur-xl" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"><X className="h-5 w-5" /></button>
      <div className="h-[min(82dvh,760px)] overflow-hidden rounded-[24px] border border-white/15 bg-black shadow-2xl" onClick={(event) => event.stopPropagation()}>
        {result.videoUrl ? (
          <video src={result.videoUrl} autoPlay controls loop playsInline className="h-full w-auto object-contain" />
        ) : (
          <img src={result.imageUrl} alt={result.place || "Behind the Scenes"} className="h-full w-auto object-contain" />
        )}
      </div>
    </div>,
    document.body,
  );
}

function RecentCreations({ items, onOpenRecent }) {
  const total = items.length;
  return (
    <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-white/[0.08] bg-[#111315]/95 p-4 shadow-[0_8px_32px_rgba(0,0,0,.45)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-black text-white">Your Series</h3>
          <p className="mt-0.5 text-[10px] font-semibold text-white/30">Every episode you've built</p>
        </div>
        <span className="rounded-full border border-lime-300/20 bg-lime-300/[0.08] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-lime-300">{total} ep{total === 1 ? "" : "s"}</span>
      </div>
      {items.length ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {items.slice(0, 8).map((item, index) => {
            const failed = !item.videoUrl;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenRecent?.(item)}
                className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] p-2 text-left transition hover:border-lime-300/25 hover:bg-white/[0.055]"
              >
                <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-white/10">
                  <img src={item.imageUrl || demoImage} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {item.videoUrl ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/15"><Play className="h-4 w-4 fill-white text-white" /></span>
                  ) : (
                    <span className="absolute inset-0 grid place-items-center bg-black/45"><AlertTriangle className="h-4 w-4 text-red-400" /></span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-white/80 group-hover:text-white">{item.place}</span>
                  <span className={`mt-1 block text-[9px] font-semibold uppercase tracking-wide ${failed ? "text-red-400/80" : "text-white/30"}`}>
                    {failed ? `Ep ${String(total - index).padStart(2, "0")} · Failed — tap to retry` : `Ep ${String(total - index).padStart(2, "0")} · ${item.disaster || "wave"} · ${timeAgo(item.createdAt)}`}
                  </span>
                  <span className="mt-0.5 block text-[9px] font-medium text-white/35">{creationDate(item.createdAt)}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid min-h-[180px] flex-1 place-items-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 text-center">
          <p className="text-[11px] font-semibold leading-relaxed text-white/30">Episode 01 will appear here the moment it's ready.</p>
        </div>
      )}
    </section>
  );
}

function ExampleVideo({ src, number, className = "" }) {
  return (
    <section className={`relative min-h-[330px] flex-1 overflow-hidden rounded-2xl border border-white/[0.1] bg-black shadow-[0_8px_32px_rgba(0,0,0,.45)] ${className}`}>
      <video src={src} autoPlay muted loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-[13px] font-black text-white">Example {number}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-white/45">Practical FX, tiny scale</p>
        </div>
        <span className="rounded-full bg-lime-300 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-black">8 sec style</span>
      </div>
    </section>
  );
}

function ResultCard({ result, phase, episodeNumber }) {
  const [progress, setProgress] = useState(4);
  const [viewerOpen, setViewerOpen] = useState(false);
  const ready = Boolean(result.videoUrl || result.imageUrl);
  const previewingImage = phase === "video" && Boolean(result.imageUrl) && !result.videoUrl;

  useEffect(() => {
    if (phase === "done") { setProgress(100); return undefined; }
    if (phase === "error") return undefined;
    const ceiling = phase === "video" ? 94 : 48;
    const timer = window.setInterval(() => setProgress((current) => Math.min(ceiling, current + Math.max(0.5, (ceiling - current) * 0.06))), 320);
    return () => window.clearInterval(timer);
  }, [phase]);

  const download = async () => {
    const url = result.videoUrl || result.imageUrl;
    if (!url) return;
    await saveMediaToDevice({ url, filename: result.videoUrl ? "behind-the-scenes.mp4" : "behind-the-scenes.jpg", title: "Behind the Scenes" });
  };

  return (
    <div className="relative mx-auto aspect-[9/16] h-full min-h-0 max-h-[min(82dvh,840px)] overflow-hidden rounded-[26px] border border-white/[0.1] bg-[#0D0F11] shadow-[0_24px_70px_rgba(0,0,0,.55)] lg:max-h-full">
      {result.imageUrl && <img src={result.imageUrl} alt={result.place || "Behind the Scenes"} className="absolute inset-0 h-full w-full object-cover" />}
      {result.videoUrl && <video src={result.videoUrl} autoPlay muted loop playsInline className="absolute inset-0 z-10 h-full w-full object-cover" />}
      {!ready && <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(190,242,100,.12),transparent_40%),linear-gradient(145deg,#151915,#090B0A_70%)]" />}
      {episodeNumber != null && !previewingImage && (
        <span className="absolute left-3 top-3 z-30 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white backdrop-blur-md">
          Episode {String(episodeNumber).padStart(2, "0")}
        </span>
      )}
      {phase !== "done" && phase !== "error" && !previewingImage && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/25 backdrop-blur-[2px]">
          <div className="text-center">
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-lime-300" />
            <p className="mt-4 text-[28px] font-black tabular-nums text-white">{Math.round(progress)}%</p>
            <p className="mt-1 text-[11px] font-bold text-white/45">{phase === "video" ? "Animating the practical FX..." : "Building the miniature set..."}</p>
          </div>
        </div>
      )}
      {previewingImage && (
        <div className="absolute inset-x-3 top-3 z-30 flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/65 px-3.5 py-2.5 shadow-lg backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime-300/15 text-lime-300">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black text-white">Set ready</p>
              <p className="truncate text-[9px] font-semibold text-white/45">Animating the 8-second shot…</p>
            </div>
          </div>
          <span className="shrink-0 text-[13px] font-black tabular-nums text-lime-300">{Math.round(progress)}%</span>
        </div>
      )}
      {ready && (
        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between bg-gradient-to-t from-black/90 via-black/45 to-transparent px-4 pb-4 pt-14">
          <div className="min-w-0 pr-3">
            <p className="truncate text-[12px] font-black text-white">{result.place}</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-white/40">8 sec · vertical · {result.disaster || "wave"}</p>
            {result.createdAt && <p className="mt-0.5 text-[9px] font-semibold text-white/45">{creationDate(result.createdAt)}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setViewerOpen(true)} className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25"><Maximize2 className="h-4 w-4" /></button>
            <button type="button" onClick={download} className="grid h-9 w-9 place-items-center rounded-full bg-lime-300 text-black transition hover:bg-lime-200"><Download className="h-4 w-4" /></button>
          </div>
        </div>
      )}
      {viewerOpen && <MediaViewer result={result} onClose={() => setViewerOpen(false)} />}
    </div>
  );
}

const NEXT_EPISODE_OPTIONS = [
  { mode: "new-disaster", label: "Same city, new disaster", icon: Shuffle },
  { mode: "new-place", label: "Same disaster, new city", icon: Shuffle },
  { mode: "surprise", label: "Surprise me", icon: Dices },
];

export default function BehindTheScenesResults({ phase, result, error, recentGenerations = [], viewingRecent, episodeNumber, onOpenRecent, onReset, onBack, onNextEpisode, onRetryVideo }) {
  if (phase !== "idle") {
    const canRetryVideo = phase === "error" && Boolean(result.imageUrl) && !result.videoUrl;
    return (
      <div className="flex h-full min-h-[500px] w-full flex-col gap-3 p-3 lg:min-h-0">
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#111315] px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            {phase !== "done" && phase !== "error" && <Loader2 className="h-4 w-4 animate-spin text-lime-300" />}
            <span className={`text-[12px] font-bold ${phase === "error" ? "text-red-400" : phase === "done" ? "text-emerald-400" : "text-lime-300"}`}>
              {phase === "image" ? "Building the set" : phase === "video" ? "Animating the shot" : phase === "error" ? "Something went wrong" : viewingRecent ? "Saved creation" : `Episode ${String(episodeNumber ?? 1).padStart(2, "0")} ready`}
            </span>
          </div>
          {(phase === "done" || phase === "error") && (
            <div className="flex shrink-0 items-center gap-2">
              {canRetryVideo && (
                <button type="button" onClick={onRetryVideo} className="flex items-center gap-1.5 rounded-xl bg-lime-300 px-3 py-1.5 text-[11px] font-bold text-[#11150D] transition hover:bg-lime-200">
                  <RotateCcw className="h-3.5 w-3.5" />Try video again
                </button>
              )}
              <button type="button" onClick={viewingRecent ? onBack : onReset} className="flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-white/55 transition hover:text-white">
                {viewingRecent ? <><ArrowLeft className="h-3.5 w-3.5" />Back</> : <><RotateCcw className="h-3.5 w-3.5" />Create another</>}
              </button>
            </div>
          )}
        </div>
        {error && <div className="shrink-0 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[12px] font-semibold text-red-300">{error}</div>}
        <div className="min-h-0 flex-1 py-1">
          <ResultCard result={result} phase={phase} episodeNumber={viewingRecent || phase === "done" ? episodeNumber : null} />
        </div>
        {phase === "done" && !viewingRecent && (
          <div className="shrink-0 rounded-2xl border border-white/[0.07] bg-[#111315] p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Make the next episode</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {NEXT_EPISODE_OPTIONS.map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => onNextEpisode?.(option.mode)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 text-[11px] font-bold text-white/70 transition hover:border-lime-300/25 hover:bg-white/[0.07] hover:text-white"
                >
                  <option.icon className="h-3.5 w-3.5 shrink-0" />
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0B0D0F] p-5 lg:h-full lg:min-h-0">
      <img src={demoImage} alt="" className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-[0.09] blur-3xl" />
      <div className={`relative z-10 mb-5 lg:mb-3 ${recentGenerations.length > 0 ? "hidden lg:block" : ""}`}>
        <div className="flex items-center gap-2 text-lime-300"><Clapperboard className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Behind the Scenes</span></div>
        <h2 className="mt-2 text-[27px] font-black leading-[1.03] tracking-[-0.045em] text-white sm:text-[34px]">Build a whole series of<br /><span className="text-lime-300">impossible miniature disasters.</span></h2>
        <p className="mt-2 max-w-[620px] text-[12px] font-medium leading-relaxed text-white/42">Endless practical-FX episode ideas for short-form video — pick a city, pick a disaster, and keep publishing.</p>
      </div>
      {recentGenerations.length > 0 ? (
        // Once there's at least one real creation, examples step aside
        // entirely — on every breakpoint — in favor of the user's own series.
        <div className="relative z-10 flex min-h-0 flex-1">
          <RecentCreations items={recentGenerations} onOpenRecent={onOpenRecent} />
        </div>
      ) : (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
          <ExampleVideo src={demoVideo} number={1} />
          {/* Second example is desktop-only — keeps the empty state to a single clip on mobile */}
          <ExampleVideo src={demoVideoTwo} number={2} className="hidden sm:block" />
        </div>
      )}
    </div>
  );
}
