import { useEffect, useState } from "react";
import { Check, Clapperboard, FileText, Loader2, Shapes } from "lucide-react";
import { DEMO_STEP_MS, LOADING_FRAMES, STEPS } from "./api/cutawayApi";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A clock for the generating view (20 fps while it is mounted). */
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!active) return undefined; const id = window.setInterval(() => setNow(Date.now()), 50); return () => window.clearInterval(id); }, [active]);
  return now;
}

const eta = (ms) => { const s = Math.max(1, Math.round(ms / 1000)); return s < 60 ? `about ${s} s left` : `about ${Math.round(s / 60)} min left`; };

// Loading backdrop: a heavily blurred frame from one of OUR OWN demo renders (never other users' videos),
// drifting slowly, crossfading to another frame every few seconds.
const DRIFT_CSS = `
@keyframes cutawayDriftA { 0% { transform: scale(1.32) translate3d(-4%, -2%, 0) rotate(-1.2deg); } 100% { transform: scale(1.5) translate3d(4%, 3%, 0) rotate(1.4deg); } }
@keyframes cutawayDriftB { 0% { transform: scale(1.45) translate3d(3%, 2%, 0) rotate(1deg); } 100% { transform: scale(1.3) translate3d(-3%, -3%, 0) rotate(-1deg); } }
@keyframes cutawayShimmer { 0%, 100% { opacity: .35; } 50% { opacity: .6; } }
@media (prefers-reduced-motion: reduce) { .cutaway-drift { animation: none !important; } }`;
const seedOf = (id) => [...String(id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function Backdrop({ runId, now }) {
  const n = LOADING_FRAMES.length, seed = seedOf(runId), tick = Math.floor(now / 4000);
  const frameA = LOADING_FRAMES[(seed + (tick % 2 === 0 ? tick : tick - 1)) % n];
  const frameB = LOADING_FRAMES[(seed + (tick % 2 === 1 ? tick : Math.max(0, tick - 1))) % n];
  const layer = "cutaway-drift absolute inset-[-12%] h-[124%] w-[124%] object-cover transition-opacity duration-[1800ms] ease-in-out";
  const look = { filter: "blur(26px) saturate(1.25) brightness(.55)" };
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{DRIFT_CSS}</style>
      <img src={frameA} alt="" className={layer} style={{ ...look, opacity: tick % 2 === 0 ? 1 : 0, animation: "cutawayDriftA 18s ease-in-out infinite alternate" }} />
      <img src={frameB} alt="" className={layer} style={{ ...look, opacity: tick % 2 === 1 ? 1 : 0, animation: "cutawayDriftB 23s ease-in-out infinite alternate" }} />
      <div className="cutaway-drift absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(74,222,128,.16),transparent_62%)]" style={{ animation: "cutawayShimmer 5s ease-in-out infinite" }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,transparent_30%,rgba(0,0,0,.6))]" />
    </div>
  );
}

const ICON = { script: FileText, scene: Shapes, render: Clapperboard };
const TITLE = { script: "Writing the script", scene: "Building the 3D scene", render: "Rendering one continuous shot" };

function StepRail({ step }) {
  const order = STEPS.map(([k]) => k).filter((k) => k !== "done"), at = order.indexOf(step);
  return (
    <ol className="flex items-center gap-1.5" aria-label="Progress">
      {order.map((k, i) => {
        const state = i < at ? "done" : i === at ? "active" : "waiting";
        const Icon = ICON[k];
        return (
          <li key={k} className="flex items-center gap-1.5">
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wide transition-colors duration-300 ${state === "done" ? "bg-cutaway text-cutaway-ink" : state === "active" ? "bg-white text-black" : "bg-white/[0.06] text-white/35"}`}>
              {state === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : state === "active" ? <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" /> : <Icon className="h-3 w-3" />}
              {STEPS[i][1]}
            </span>
            {i < order.length - 1 && <span className={`h-px w-4 transition-colors duration-300 sm:w-6 ${i < at ? "bg-cutaway" : "bg-white/15"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function ScriptStep({ run, now }) {
  const text = run.narration ?? "";
  const p = reducedMotion() ? 1 : Math.min(1, (now - (run.stepAt ?? now)) / (DEMO_STEP_MS.script * 0.92));
  const shown = text.slice(0, Math.floor(text.length * p));
  const words = shown.trim() ? shown.trim().split(/\s+/).length : 0;
  return (
    <div className="w-full">
      <div className="max-h-[42vh] overflow-hidden rounded-2xl border border-white/10 bg-black/45 p-4 text-left backdrop-blur-md [mask-image:linear-gradient(to_top,transparent,black_28%)] lg:max-h-[46%]">
        <p className="flex flex-col-reverse text-[12.5px] leading-relaxed text-white/85"><span>{shown}{p < 1 && <span className="cw-caret text-cutaway" />}</span></p>
      </div>
      <p className="mt-2 text-[10.5px] font-semibold tabular-nums text-white/45">{words} words · fact-checking the surprises</p>
    </div>
  );
}

function SceneStep({ run, now }) {
  const parts = run.parts ?? [];
  const p = reducedMotion() ? 1 : Math.min(1, (now - (run.stepAt ?? now)) / (DEMO_STEP_MS.scene * 0.85));
  const count = Math.max(1, Math.ceil(parts.length * p));
  return (
    <div className="w-full">
      <div className="flex flex-wrap justify-center gap-1.5">
        {parts.slice(0, count).map((name) => (
          <span key={name} className="cw-pop flex items-center gap-1 rounded-full border border-cutaway/30 bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-cutaway" />{name}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[10.5px] font-semibold tabular-nums text-white/45">{count} of {parts.length} parts placed · every part timed to its word</p>
    </div>
  );
}

function RenderStep({ run, now }) {
  const pct = run.renderPct ?? 0;
  const elapsed = now - (run.stepAt ?? now);
  const left = pct > 2 ? (elapsed * (100 - pct)) / pct : null;
  const frames = (run.frames ?? []).slice(0, run.framesShown ?? 0);
  return (
    <div className="w-full">
      <p className="text-[44px] font-black leading-none tabular-nums text-white drop-shadow">{pct}<span className="text-[22px] text-white/60">%</span></p>
      <p className="mt-1 text-[11px] font-semibold text-white/55">{left == null ? "Starting the render…" : pct >= 100 ? "Finishing…" : eta(left)}</p>
      <div className="cw-sheen mx-auto mt-3 h-1.5 w-full max-w-[260px] overflow-hidden rounded-full bg-black/45">
        <div className="h-full rounded-full bg-cutaway transition-[width] duration-150" style={{ width: `${pct}%` }} />
      </div>
      {frames.length > 0 && (
        <div className="mx-auto mt-4 flex max-w-[300px] justify-center gap-1" aria-label="Frames rendered so far">
          {frames.map((src) => <img key={src} src={src} alt="" className="cw-pop aspect-[9/16] w-[11.5%] max-w-[34px] rounded-[5px] border border-white/15 object-cover" />)}
        </div>
      )}
    </div>
  );
}

const STEP_VIEW = { script: ScriptStep, scene: SceneStep, render: RenderStep };

/** The generating state: the blurred backdrop of our own renders, and each step shown as it happens. */
export default function CutawayGenerating({ run }) {
  const now = useNow(true);
  const View = STEP_VIEW[run.step] ?? RenderStep;
  return (
    <div className="cw-view flex w-full flex-col gap-3 lg:h-full lg:min-h-0 lg:p-3">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/[0.07] bg-[#111315] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cutaway motion-reduce:animate-none" />
          <span className="truncate text-[12px] font-bold text-cutaway">Making your video</span>
          <span className="hidden truncate text-[11px] font-semibold text-white/35 sm:inline">· {run.topic} · {run.lengthSec} sec</span>
        </div>
        <StepRail step={run.step} />
      </header>
      <section className="flex min-h-0 flex-1 items-start justify-center lg:items-center">
        <div className="relative grid aspect-[9/16] w-full max-w-[420px] place-items-center overflow-hidden rounded-[26px] border border-cutaway/[0.15] bg-[#0D100E] lg:h-full lg:max-h-[820px] lg:w-auto lg:max-w-none">
          <Backdrop runId={run.id} now={now} />
          <div key={run.step} className="cw-view relative flex w-full flex-col items-center gap-4 px-5 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-black/30 backdrop-blur-md">
              {(() => { const Icon = ICON[run.step] ?? Clapperboard; return <Icon className="h-5 w-5 text-cutaway" />; })()}
            </span>
            <p className="text-[15px] font-black text-white drop-shadow">{TITLE[run.step] ?? "Working"}</p>
            <View run={run} now={now} />
          </div>
        </div>
      </section>
    </div>
  );
}
