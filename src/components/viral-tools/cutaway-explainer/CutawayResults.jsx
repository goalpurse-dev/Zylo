import { ArrowLeft, Check, Download, Layers, Loader2, Play, RefreshCw, RotateCcw, X } from "lucide-react";
import { saveMediaToDevice } from "../../../lib/downloadMedia";

function timeAgo(value) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const STEP_LABELS = [
  ["script", "Script"],
  ["images", "Images"],
  ["clips", "Clips"],
  ["final", "Final video"],
];

function StepRow({ label, info }) {
  const state = info?.state ?? "waiting";
  let detail = "";
  if (label === "Images" && info?.total) detail = `${info.done}/${info.total}`;
  if (label === "Clips" && info?.total) detail = `${info.done}/${info.total}`;
  if (label === "Clips" && !info?.total && info?.keyframesTotal) detail = `frames ${info.keyframesDone}/${info.keyframesTotal}`;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${state === "done" ? "bg-cutaway text-cutaway-ink" : state === "failed" ? "bg-red-500/20 text-red-300" : state === "waiting" ? "bg-white/[0.06] text-white/25" : "bg-cutaway/15 text-cutaway"}`}>
        {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : state === "failed" ? <X className="h-3.5 w-3.5" /> : state === "waiting" ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : state === "review" ? <span className="h-2 w-2 rounded-full bg-current" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      </span>
      <span className={`flex-1 text-[12px] font-bold ${state === "waiting" ? "text-white/35" : "text-white/85"}`}>{label}</span>
      <span className="text-[10px] font-semibold tabular-nums text-white/40">{state === "review" ? "Your check" : detail}</span>
    </li>
  );
}

function ImageGrid({ run, review, busy, regenerateCredits, onRegenerate }) {
  if (!run.wide?.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {run.wide.map((w, i) => {
        const redo = run.wide.length - i;
        return (
          <figure key={w.id} className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0D0F11]">
            <div className="relative aspect-[9/16] w-full bg-black/40">
              {w.url ? <img src={w.url} alt={w.label} className="absolute inset-0 h-full w-full object-cover" /> : (
                <span className="absolute inset-0 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-cutaway/60" /></span>
              )}
              {w.vision && review && (
                <span className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${w.vision.pass ? "bg-cutaway text-cutaway-ink" : w.vision.pass === null ? "bg-white/80 text-black" : "bg-amber-300 text-black"}`}>
                  {w.vision.pass ? "Checked" : w.vision.pass === null ? "Not checked" : "Check this one"}
                </span>
              )}
            </div>
            {w.vision && w.vision.pass === false && review && <p className="px-2.5 pt-2 text-[10px] font-semibold leading-snug text-amber-200/80">{w.vision.fix}</p>}
            <figcaption className="flex items-center justify-between gap-2 px-2.5 py-2">
              <span className="min-w-0 truncate text-[10.5px] font-bold text-white/70">{i + 1}. {w.label}</span>
              {review && (
                <button
                  type="button"
                  onClick={() => onRegenerate(i)}
                  disabled={busy}
                  title={redo > 1 ? `Redoes this image and the ${redo - 1} after it (each is an edit of the one before)` : "Redo this image"}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-white/60 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
                >
                  <RefreshCw className="h-3 w-3" />Regenerate{regenerateCredits != null && <span className="text-white/35">· {regenerateCredits * redo}</span>}
                </button>
              )}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function FinalVideo({ run }) {
  const download = () => saveMediaToDevice({ url: run.finalUrl, filename: "cutaway-explainer.mp4", title: "Cutaway Explainer" });
  return (
    <div className="relative mx-auto aspect-[9/16] h-full max-h-[min(78dvh,820px)] min-h-[360px] overflow-hidden rounded-[26px] border border-white/[0.1] bg-black shadow-[0_24px_70px_rgba(0,0,0,.55)]">
      <video src={run.finalUrl} controls autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
      <button type="button" onClick={download} className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-cutaway px-3 py-2 text-[11px] font-black text-cutaway-ink transition hover:bg-cutaway-soft">
        <Download className="h-4 w-4" />Download
      </button>
    </div>
  );
}

function Recents({ items, onOpen }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/[0.08] bg-[#111315]/95 p-4">
      <h3 className="text-[14px] font-black text-white">Recent Creations</h3>
      {items.length ? (
        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] p-2.5 text-left transition hover:border-cutaway/25">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cutaway/10 text-cutaway">{item.finalUrl ? <Play className="h-4 w-4 fill-current" /> : <Layers className="h-4 w-4" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-bold text-white/80 group-hover:text-white">{item.topic}</span>
                <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-white/30">{item.lengthSec} sec · {item.step === "done" ? "ready" : item.step === "failed" ? "failed" : item.step === "approval" ? "waiting for your check" : "in progress"} · {timeAgo(item.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-[11px] font-semibold text-white/30">Your finished videos will appear here.</p>
      )}
    </section>
  );
}

export default function CutawayResults({ run, error, busy, recent = [], prices = {}, onRegenerate, onApprove, onOpen, onReset, viewingRecent, onBack }) {
  if (!run) {
    return (
      <div className="relative flex min-h-[620px] flex-col gap-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0B0D0F] p-5 lg:h-full lg:min-h-0">
        <div>
          <div className="flex items-center gap-2 text-cutaway"><Layers className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Cutaway Explainer</span></div>
          <h2 className="mt-2 text-[27px] font-black leading-[1.03] tracking-[-0.045em] text-white sm:text-[34px]">See inside how it works.<br /><span className="text-cutaway">In one seamless shot.</span></h2>
          <p className="mt-2 max-w-[620px] text-[12px] font-medium leading-relaxed text-white/42">Type a topic. You get a fact-checked voiceover and a vertical video where the camera flies through a 3D cutaway of the thing, with no visible cuts.</p>
        </div>
        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[12px] font-semibold text-red-300">{error}</div>}
        <Recents items={recent} onOpen={onOpen} />
      </div>
    );
  }

  const review = run.step === "approval";
  const failed = run.step === "failed";
  const done = run.step === "done";
  const videoCredits = prices[`video:${run.lengthSec}`];
  const headline = done ? "Your video is ready" : failed ? "Something went wrong" : review ? "Check the images" : "Working on your video";

  return (
    <div className="flex h-full min-h-[500px] w-full flex-col gap-3 p-3 lg:min-h-0">
      <div className="flex shrink-0 items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#111315] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {!done && !failed && !review && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cutaway" />}
          <span className={`truncate text-[12px] font-bold ${failed ? "text-red-400" : "text-cutaway"}`}>{headline}</span>
          <span className="truncate text-[11px] font-semibold text-white/35">· {run.title || run.topic} · {run.lengthSec} sec</span>
        </div>
        {(done || failed || viewingRecent) && (
          <button type="button" onClick={viewingRecent ? onBack : onReset} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-white/55 transition hover:text-white">
            {viewingRecent ? <><ArrowLeft className="h-3.5 w-3.5" />Back</> : <><RotateCcw className="h-3.5 w-3.5" />Create another</>}
          </button>
        )}
      </div>

      {(error || run.error) && (
        <div className="shrink-0 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[12px] font-semibold text-red-300">
          {error || run.error}{failed && run.creditsRefunded > 0 ? ` · ${run.creditsRefunded} credits returned` : ""}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:flex-row">
        <aside className="flex shrink-0 flex-col gap-3 lg:w-[250px]">
          <ol className="space-y-1.5">
            {STEP_LABELS.map(([key, label]) => <StepRow key={key} label={label} info={run.progress?.[key]} />)}
          </ol>
          {run.narration && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">{run.hasVoice ? "Voiceover" : "Script to record"}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-white/65">{run.narration}</p>
            </div>
          )}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {done && run.finalUrl ? <FinalVideo run={run} /> : (
            <>
              <ImageGrid run={run} review={review} busy={busy} regenerateCredits={prices.image} onRegenerate={onRegenerate} />
              {review && (
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={busy}
                  className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-cutaway py-3 text-[14px] font-black text-cutaway-ink transition hover:bg-cutaway-soft disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={3} />}
                  Looks good → make video{videoCredits != null && <span className="text-[12px] font-semibold opacity-70">· {videoCredits} credits</span>}
                </button>
              )}
              {!run.wide?.length && !failed && (
                <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                  <p className="text-[12px] font-semibold text-white/35">Writing and fact-checking the script…</p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
