import { Layers, Play } from "lucide-react";
import { recentOrExamples } from "./api/cutawayApi";
import CutawayGenerating from "./CutawayGenerating";
import CutawayResultView, { ExampleBadge } from "./CutawayResultView";

export { ExampleBadge };

function timeAgo(value) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function Recents({ items, onOpen }) {
  // No videos of their own yet: our two finished examples, labelled so nobody thinks they made them.
  const shown = recentOrExamples(items);
  const examples = !items.length;
  return (
    <section style={{ "--d": "80ms" }} className="cw-fade-up flex min-h-0 flex-1 flex-col rounded-2xl border border-white/[0.08] bg-[#111315]/95 p-4">
      <h3 className="text-[14px] font-black text-white">Recent Creations</h3>
      {examples && <p className="mt-1 text-[11px] font-semibold text-white/35">Your videos will appear here. Until then, tap an example to watch it.</p>}
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {shown.map((item, i) => (
          <button key={item.id} type="button" style={{ "--d": `${120 + i * 50}ms` }} onClick={() => onOpen(item.id)} className="cw-fade-up cw-press group flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] p-2.5 text-left hover:border-cutaway/25 hover:bg-white/[0.05]">
            {item.poster ? (
              <span className="relative h-14 w-[32px] shrink-0 overflow-hidden rounded-md bg-black">
                <img src={item.poster} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-110" />
                <span className="absolute inset-0 grid place-items-center bg-black/25"><Play className="h-3.5 w-3.5 fill-white text-white" /></span>
              </span>
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cutaway/10 text-cutaway">{item.finalUrl ? <Play className="h-4 w-4 fill-current" /> : <Layers className="h-4 w-4" />}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[12px] font-bold text-white/80 group-hover:text-white">{item.example ? item.title : item.topic}</span>
                {item.example && <ExampleBadge className="shrink-0" />}
              </span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-white/30">
                {item.example ? `${item.lengthSec} sec · made with Cutaway Explainer` : `${item.lengthSec} sec · ${item.step === "done" ? "ready" : "in progress"}${item.demo ? " · demo" : ""} · ${timeAgo(item.createdAt)}`}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** The right side: the intro and Recent Creations, a video being made, or a finished video. */
export default function CutawayResults({ run, recent = [], onOpen, onBack, onMakeLike, onDelete }) {
  if (!run) {
    return (
      <div className="cw-view relative flex min-h-[620px] flex-col gap-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0B0D0F] p-5 lg:h-full lg:min-h-0">
        <div className="cw-fade-up">
          <div className="flex items-center gap-2 text-cutaway"><Layers className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Cutaway Explainer</span></div>
          <h2 className="mt-2 text-[27px] font-black leading-[1.03] tracking-[-0.045em] text-white sm:text-[34px]">See inside how it works.<br /><span className="text-cutaway">In one continuous shot.</span></h2>
          <p className="mt-2 max-w-[620px] text-[12px] font-medium leading-relaxed text-white/42">Type a topic. You get a fact-checked voiceover and a vertical 3D cutaway video: the pit is dug, every part appears on its word, and the camera never cuts.</p>
        </div>
        <Recents items={recent} onOpen={onOpen} />
      </div>
    );
  }
  if (run.step !== "done" || !run.finalUrl) return <CutawayGenerating key={run.id} run={run} />;
  // a video that has just finished gets the reveal; one opened from the list just appears
  const reveal = Boolean(run.doneAt && Date.now() - run.doneAt < 1500);
  return <CutawayResultView key={run.id} run={run} onBack={onBack} onMakeLike={onMakeLike} onDelete={onDelete} reveal={reveal} />;
}
