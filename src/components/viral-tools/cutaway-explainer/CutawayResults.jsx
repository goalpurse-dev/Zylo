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
    <section style={{ "--d": "80ms" }} className="cw-fade-up flex flex-col rounded-2xl border border-white/[0.08] bg-[#111315]/95 p-3 sm:p-4 lg:min-h-0 lg:flex-1">
      <h3 className="text-[14px] font-black text-white">Recent Creations</h3>
      {examples && <p className="mt-1 text-[11px] font-semibold text-white/35">Your videos will appear here. Until then, tap an example to watch it.</p>}
      {/* a grid of 9:16 posters with the full title under each (2 columns on phones, as wide as fits on desktop) */}
      <div className="mt-3 grid grid-cols-2 content-start gap-3 sm:grid-cols-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin] lg:[grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
        {shown.map((item, i) => (
          <button key={item.id} type="button" style={{ "--d": `${120 + i * 50}ms` }} onClick={() => onOpen(item.id)} className="cw-fade-up cw-press group flex min-w-0 flex-col rounded-2xl border border-white/[0.07] bg-white/[0.035] p-2 text-left hover:border-cutaway/30 hover:bg-white/[0.05]">
            <span className="relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
              {item.poster ? (
                <img src={item.poster} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
              ) : (
                <span className="grid h-full w-full place-items-center bg-cutaway/10 text-cutaway"><Layers className="h-6 w-6" /></span>
              )}
              <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 backdrop-blur-sm transition group-hover:scale-110 group-hover:bg-black/60">
                <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
              </span>
              {item.example && <ExampleBadge className="absolute left-2 top-2 !bg-black/55 backdrop-blur-sm" />}
              <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white/90">{item.lengthSec}s</span>
            </span>
            <span className="mt-2 line-clamp-2 px-0.5 text-[12.5px] font-bold leading-snug text-white/85 group-hover:text-white">{item.example ? item.title : item.topic}</span>
            <span className="mt-0.5 px-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-white/30">
              {item.example ? "Made with Cutaway" : `${item.step === "done" ? "Ready" : "In progress"}${item.demo ? " · demo" : ""} · ${timeAgo(item.createdAt)}`}
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
      <div className="cw-view relative flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-[#0B0D0F] p-4 sm:p-5 lg:h-full lg:min-h-0 lg:overflow-hidden">
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
