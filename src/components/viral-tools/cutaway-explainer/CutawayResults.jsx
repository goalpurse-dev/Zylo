import { ArrowLeft, Check, Download, Layers, Loader2, Play, RotateCcw } from "lucide-react";
import { saveMediaToDevice } from "../../../lib/downloadMedia";
import { STEPS } from "./api/cutawayApi";

function timeAgo(value) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const DETAIL = { script: "Writing and voicing the script", scene: "Building the 3D scene and timing every part to its word", render: "Rendering one continuous shot", done: "Ready" };

function StepRow({ id, label, run }) {
  const order = STEPS.map(([k]) => k);
  const at = order.indexOf(run.step), me = order.indexOf(id);
  const state = run.step === "done" || me < at ? "done" : me === at ? "active" : "waiting";
  const detail = id === "render" && state === "active" ? `${run.renderPct ?? 0}%` : "";
  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${state === "done" ? "bg-cutaway text-cutaway-ink" : state === "waiting" ? "bg-white/[0.06] text-white/25" : "bg-cutaway/15 text-cutaway"}`}>
        {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : state === "waiting" ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[12px] font-bold ${state === "waiting" ? "text-white/35" : "text-white/85"}`}>{label}</span>
        {state === "active" && <span className="block truncate text-[10px] font-semibold text-white/40">{DETAIL[id]}</span>}
      </span>
      <span className="text-[10px] font-semibold tabular-nums text-white/40">{detail}</span>
    </li>
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

function Working({ run }) {
  const pct = run.step === "render" ? run.renderPct ?? 0 : null;
  return (
    <div className="relative mx-auto grid aspect-[9/16] h-full max-h-[min(78dvh,820px)] min-h-[360px] place-items-center overflow-hidden rounded-[26px] border border-cutaway/[0.15] bg-[radial-gradient(ellipse_at_50%_35%,rgba(74,222,128,.10),transparent_60%),#0D100E]">
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-cutaway" />
        <p className="text-[13px] font-black text-white/85">{DETAIL[run.step]}</p>
        {pct != null && (
          <div className="h-1.5 w-44 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-cutaway transition-[width]" style={{ width: `${pct}%` }} /></div>
        )}
      </div>
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
                <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-white/30">{item.lengthSec} sec · {item.step === "done" ? "ready" : "in progress"}{item.demo ? " · demo" : ""} · {timeAgo(item.createdAt)}</span>
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

export default function CutawayResults({ run, recent = [], onOpen, onReset, viewingRecent, onBack }) {
  if (!run) {
    return (
      <div className="relative flex min-h-[620px] flex-col gap-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0B0D0F] p-5 lg:h-full lg:min-h-0">
        <div>
          <div className="flex items-center gap-2 text-cutaway"><Layers className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Cutaway Explainer</span></div>
          <h2 className="mt-2 text-[27px] font-black leading-[1.03] tracking-[-0.045em] text-white sm:text-[34px]">See inside how it works.<br /><span className="text-cutaway">In one continuous shot.</span></h2>
          <p className="mt-2 max-w-[620px] text-[12px] font-medium leading-relaxed text-white/42">Type a topic. You get a fact-checked voiceover and a vertical 3D cutaway video: the pit is dug, every part appears on its word, and the camera never cuts.</p>
        </div>
        <Recents items={recent} onOpen={onOpen} />
      </div>
    );
  }

  const done = run.step === "done";
  const headline = done ? "Ready" : "Working";

  return (
    <div className="flex h-full min-h-[500px] w-full flex-col gap-3 p-3 lg:min-h-0">
      <div className="flex shrink-0 items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#111315] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {!done && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cutaway" />}
          <span className="truncate text-[12px] font-bold text-cutaway">{headline}</span>
          <span className="hidden truncate text-[11px] font-semibold text-white/35 sm:inline">· {run.topic} · {run.lengthSec} sec</span>
        </div>
        {(done || viewingRecent) && (
          <button type="button" onClick={viewingRecent ? onBack : onReset} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-white/55 transition hover:text-white">
            {viewingRecent ? <><ArrowLeft className="h-3.5 w-3.5" />Back</> : <><RotateCcw className="h-3.5 w-3.5" />Create another</>}
          </button>
        )}
      </div>

      {run.demo && (
        <div className="shrink-0 rounded-xl border border-cutaway/20 bg-cutaway/[0.06] px-4 py-2 text-[11px] font-semibold leading-snug text-cutaway/85">
          Demo: the 3D builder isn't connected yet, so this plays the hand-built landfill example{run.topic.toLowerCase() !== "landfill" ? ` instead of “${run.topic}”` : ""}. Not charged.
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:flex-row">
        <aside className="order-2 flex shrink-0 flex-col gap-3 lg:order-1 lg:w-[250px]">
          <ol className="space-y-1.5">
            {STEPS.map(([id, label]) => <StepRow key={id} id={id} label={label} run={run} />)}
          </ol>
          {run.step !== "script" && run.narration && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">Voiceover</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-white/65">{run.narration}</p>
            </div>
          )}
        </aside>
        <section className="order-1 flex h-[min(68dvh,620px)] min-w-0 shrink-0 flex-col gap-3 lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink">{/* phones: a fixed-height player above the steps */}
          {done && run.finalUrl ? <FinalVideo run={run} /> : <Working run={run} />}
        </section>
      </div>
    </div>
  );
}
