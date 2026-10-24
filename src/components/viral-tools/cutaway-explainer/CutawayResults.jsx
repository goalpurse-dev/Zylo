import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Clapperboard, Layers, Loader2, Play, RotateCcw, ShieldCheck, Smartphone } from "lucide-react";
import { FAILED_MESSAGE, isWorking, recentOrExamples } from "./api/cutawayApi";
import CutawayGenerating from "./CutawayGenerating";
import CutawayHero from "./CutawayHero";
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

/** The width of an element, kept up to date (the idle view picks its layout from the panel, not the screen). */
function useWidth() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ width: Math.round(e.contentRect.width), height: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

function statusLine(item) {
  if (item.example) return "Made with Cutaway";
  const when = timeAgo(item.createdAt);
  if (item.step === "done") return `Ready${item.demo ? " · demo" : ""} · ${when}`;
  if (item.step === "failed") return `Didn't work${item.refunded ? " · credits back" : ""}`;
  return `In progress · ${when}`;
}

function Recents({ items, onOpen, compact = false }) {
  // No videos of their own yet: our two finished examples, labelled so nobody thinks they made them.
  const shown = recentOrExamples(items);
  const examples = !items.length;
  return (
    <section style={{ "--d": "120ms" }} className={`cw-fade-up flex flex-col rounded-2xl border border-white/[0.08] bg-[#111315]/95 p-3 sm:p-4 ${compact ? "" : "lg:min-h-0 lg:flex-1"}`}>
      <h3 className="text-[14px] font-black text-white">{examples ? "Examples" : "Recent Creations"}</h3>
      {examples && <p className="mt-1 text-[11px] font-semibold text-white/35">Your videos will appear here. Until then, tap an example to watch it.</p>}
      {/* a grid of 9:16 posters with the full title under each (2 columns on phones, as wide as fits on desktop) */}
      <div className={`mt-3 grid grid-cols-2 content-start gap-3 sm:grid-cols-3 ${compact ? "lg:[grid-template-columns:repeat(auto-fill,minmax(118px,1fr))]" : "lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin] lg:[grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]"}`}>
        {shown.map((item, i) => {
          const working = isWorking(item), failed = item.step === "failed";
          return (
            <button key={item.id} type="button" style={{ "--d": `${180 + i * 60}ms` }} onClick={() => onOpen(item.id)} className="cw-fade-up cw-press group flex min-w-0 flex-col rounded-2xl border border-white/[0.07] bg-white/[0.035] p-2 text-left hover:border-cutaway/30 hover:bg-white/[0.05]">
              <span className="relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
                {item.poster ? (
                  <img src={item.poster} alt="" loading="lazy" className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${failed ? "opacity-40 grayscale" : ""}`} />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-cutaway/10 text-cutaway"><Layers className="h-6 w-6" /></span>
                )}
                <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 backdrop-blur-sm transition duration-300 group-hover:scale-110 group-hover:bg-cutaway group-hover:text-cutaway-ink">
                  {working ? <Loader2 className="h-5 w-5 animate-spin text-cutaway motion-reduce:animate-none" /> : failed ? <RotateCcw className="h-5 w-5 text-white/80" /> : <Play className="ml-0.5 h-5 w-5 fill-current text-white group-hover:text-cutaway-ink" />}
                </span>
                {item.example && <ExampleBadge className="absolute left-2 top-2 !bg-black/55 backdrop-blur-sm" />}
                <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white/90">{item.lengthSec}s</span>
              </span>
              <span className="mt-2 line-clamp-2 px-0.5 text-[12.5px] font-bold leading-snug text-white/85 group-hover:text-white">{item.example ? item.title : item.title || item.topic}</span>
              <span className={`mt-0.5 px-0.5 text-[9.5px] font-semibold uppercase tracking-wide ${failed ? "text-amber-300/60" : "text-white/30"}`}>{statusLine(item)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: ShieldCheck, title: "Fact-checked script", text: "Surprising facts, each with its sources." },
  { icon: Layers, title: "Built part by part", text: "Every part appears on its word." },
  { icon: Smartphone, title: "Ready to post", text: "9:16, captions, sound, post text." },
];

function Intro({ size = "sm", features = false }) {
  const h = { lg: "text-[42px]", md: "text-[33px]", sm: "text-[27px] sm:text-[34px]" }[size];
  return (
    <div>
      <div className="cw-fade-up flex items-center gap-2 text-cutaway"><Layers className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Cutaway Explainer</span></div>
      <h2 className={`mt-2 font-black leading-[1.02] tracking-[-0.045em] text-white ${h}`}>
        <span className="block overflow-hidden pb-[0.06em]"><span className="cw-line-up" style={{ "--d": "120ms" }}>See inside how it works.</span></span>
        <span className="block overflow-hidden pb-[0.06em]"><span className="cw-line-up text-cutaway" style={{ "--d": "240ms" }}>In one continuous shot.</span></span>
      </h2>
      <p style={{ "--d": "360ms" }} className="cw-fade-up mt-3 max-w-[560px] text-[12.5px] font-medium leading-relaxed text-white/45">Type a topic. You get a fact-checked voiceover and a vertical 3D cutaway video: the pit is dug, every part appears on its word, and the camera never cuts.</p>
      {features && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {FEATURES.map((f, i) => (
            <li key={f.title} style={{ "--d": `${440 + i * 70}ms` }} className="cw-fade-up flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.025] px-2.5 py-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cutaway/10"><f.icon className="h-3.5 w-3.5 text-cutaway" /></span>
              <span className="min-w-0 text-[11px] leading-snug"><span className="font-black text-white/85">{f.title}</span> <span className="font-medium text-white/40">{f.text}</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Nothing open: the hero (desktop) or the intro (phones, whose hero opens the builder) and the videos. */
function Idle({ recent, onOpen, onWatch, isDesktop }) {
  const [ref, { width, height }] = useWidth();
  const wide = isDesktop && width >= 640;
  return (
    <div ref={ref} className="cw-view relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0B0D0F] p-4 sm:p-5 lg:h-full lg:min-h-0">
      {isDesktop && <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(74,222,128,.10),transparent_65%)]" />}
      {wide ? (
        <div className="relative flex min-h-0 flex-1 gap-6">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto [scrollbar-width:none]">
            {/* the three feature lines only when the panel is tall enough to keep the examples in view too */}
            <Intro size={width >= 860 ? "lg" : "md"} features={height >= 820} />
            <Recents items={recent} onOpen={onOpen} compact />
          </div>
          <div className="flex h-full shrink-0 items-center justify-center pl-8 pr-1">
            <CutawayHero variant="tall" onWatch={onWatch} className="aspect-[9/16] h-full max-h-[580px]" />
          </div>
        </div>
      ) : (
        <>
          {isDesktop && <CutawayHero variant="wide" onWatch={onWatch} className="w-full shrink-0" />}
          <Intro size="sm" />
          <Recents items={recent} onOpen={onOpen} />
        </>
      )}
    </div>
  );
}

/** A run that stopped: friendly words, the credits back, and the two ways on. */
function RunFailed({ run, onBack, onRetry }) {
  const refunded = run.refunded === true && run.credits > 0;
  // the contract's words when the credits went back; otherwise the run's own message, never a refund it didn't get
  const message = run.lost ? run.error : refunded ? FAILED_MESSAGE : run.error || "We couldn't make this video. It's not your fault.";
  return (
    <div className="cw-view relative flex flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0B0D0F] p-6 text-center lg:h-full">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(245,192,66,.10),transparent_65%)]" />
      <div className="cw-pop relative grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
        <Clapperboard className="h-7 w-7 text-white/70" />
        <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#F5C042] text-[13px] font-black text-black">!</span>
      </div>
      <p style={{ "--d": "60ms" }} className="cw-fade-up relative text-[18px] font-black text-white">{run.missing ? "We can’t build this one yet" : "This one didn't work out"}</p>
      <p style={{ "--d": "100ms" }} className="cw-fade-up relative max-w-[380px] text-[13px] leading-relaxed text-white/60">{message}</p>
      {run.closest?.length > 0 && <p className="relative text-[12px] text-white/55">Try: <span className="font-semibold text-white/80">{run.closest.join(", ")}</span></p>}
      {refunded ? (
        <div style={{ "--d": "220ms" }} className="cw-pop relative mt-1 flex items-center gap-2.5 rounded-2xl border border-cutaway/30 bg-cutaway/10 px-3.5 py-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-cutaway text-cutaway-ink">
            <span aria-hidden="true" className="h-4 w-4 bg-current" style={{ WebkitMaskImage: "url('/icons/credits.png')", maskImage: "url('/icons/credits.png')", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />
          </span>
          <span className="text-left">
            <span className="block text-[15px] font-black tabular-nums text-cutaway">+{run.credits} credits</span>
            <span className="block text-[11px] font-semibold text-white/55">Back on your balance</span>
          </span>
        </div>
      ) : (
        !run.server && !run.mock && <p className="relative text-[11px] text-white/35">You weren’t charged.</p>
      )}
      <div style={{ "--d": "280ms" }} className="cw-fade-up relative mt-2 flex flex-wrap justify-center gap-2">
        {onRetry && run.topic && (
          <button type="button" onClick={() => onRetry(run)} className="cw-press flex items-center gap-1.5 rounded-full bg-cutaway px-4 py-2 text-[12.5px] font-black text-cutaway-ink hover:bg-cutaway-soft">
            <RotateCcw className="h-3.5 w-3.5" />Try again
          </button>
        )}
        <button type="button" onClick={onBack} className="cw-press flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-[12.5px] font-bold text-white/80 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" />Back
        </button>
      </div>
    </div>
  );
}

/** The right side: the hero and Recent Creations, a video being made, a failed run, or a finished video. */
export default function CutawayResults({ run, recent = [], isDesktop = true, onOpen, onBack, onMakeLike, onDelete, onApprove, onWatch }) {
  if (!run) return <Idle recent={recent} onOpen={onOpen} onWatch={onWatch} isDesktop={isDesktop} />;
  if (run.step === "failed") return <RunFailed run={run} onBack={onBack} onRetry={onMakeLike} />;
  if (run.step !== "done" || !run.finalUrl) return <CutawayGenerating key={run.id} run={run} />;
  // a video that has just finished gets the reveal; one opened from the list just appears
  const reveal = Boolean(run.doneAt && Date.now() - run.doneAt < 1500);
  return <CutawayResultView key={run.id} run={run} onBack={onBack} onMakeLike={onMakeLike} onDelete={onDelete} onApprove={onApprove} reveal={reveal} />;
}
