import { memo, useEffect, useState } from "react";
import { Check, Clapperboard, FileText, Loader2, Shapes, ShieldCheck } from "lucide-react";
import { DEMO_STEP_MS, LOADING_FRAMES, STEPS } from "./api/cutawayApi";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * A clock for the generating view: ~15 ticks a second only while the script types out (and the parts pop in),
 * 2 a second otherwise (counters and the ETA). Everything that moves smoothly is CSS on the compositor.
 */
function useNow(ms) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(id); }, [ms]);
  return now;
}

const eta = (ms) => { const s = Math.max(1, Math.round(ms / 1000)); return s < 60 ? `about ${s} s left` : `about ${Math.round(s / 60)} min left`; };
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Loading backdrop: a heavily blurred frame from one of OUR OWN demo renders (never other users' videos),
// drifting slowly, crossfading to another frame every few seconds. The files are blurred already (no CSS filter:
// a blur on a moving layer costs every frame on a phone), darkened by a plain overlay.
const DRIFT_CSS = `
@keyframes cutawayDriftA { 0% { transform: scale(1.32) translate3d(-4%, -2%, 0) rotate(-1.2deg); } 100% { transform: scale(1.5) translate3d(4%, 3%, 0) rotate(1.4deg); } }
@keyframes cutawayDriftB { 0% { transform: scale(1.45) translate3d(3%, 2%, 0) rotate(1deg); } 100% { transform: scale(1.3) translate3d(-3%, -3%, 0) rotate(-1deg); } }
@keyframes cutawayShimmer { 0%, 100% { opacity: .35; } 50% { opacity: .6; } }
@media (prefers-reduced-motion: reduce) { .cutaway-drift { animation: none !important; } }`;
const seedOf = (id) => [...String(id)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// re-renders only when its 4 s crossfade tick changes, not on every clock tick
const Backdrop = memo(function Backdrop({ runId, tick }) {
  const n = LOADING_FRAMES.length, seed = seedOf(runId);
  const frameA = LOADING_FRAMES[(seed + (tick % 2 === 0 ? tick : tick - 1)) % n];
  const frameB = LOADING_FRAMES[(seed + (tick % 2 === 1 ? tick : Math.max(0, tick - 1))) % n];
  const layer = "cutaway-drift absolute inset-[-12%] h-[124%] w-[124%] object-cover transition-opacity duration-[1800ms] ease-in-out";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{DRIFT_CSS}</style>
      <img src={frameA} alt="" className={layer} style={{ opacity: tick % 2 === 0 ? 1 : 0, animation: "cutawayDriftA 18s ease-in-out infinite alternate" }} />
      <img src={frameB} alt="" className={layer} style={{ opacity: tick % 2 === 1 ? 1 : 0, animation: "cutawayDriftB 23s ease-in-out infinite alternate" }} />
      <div className="absolute inset-0 bg-[#060807]/[0.62]" />
      {/* the blueprint grid the scene is "built on", drifting down one cell at a time */}
      {/* (no mask on it: a mask over a moving layer is redrawn every frame; the vignette below fades its edges) */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="cw-grid absolute inset-x-0 -top-8 bottom-0 bg-[linear-gradient(rgba(74,222,128,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(74,222,128,.07)_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>
      <div className="cutaway-drift absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(74,222,128,.16),transparent_62%)]" style={{ animation: "cutawayShimmer 5s ease-in-out infinite" }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_48%,transparent_25%,rgba(0,0,0,.8))]" />
    </div>
  );
});

const ICON = { queued: Loader2, script: FileText, scene: Shapes, render: Clapperboard };
const TITLE = { queued: "In line", script: "Writing the script", scene: "Building the 3D scene", render: "Rendering one continuous shot" };

function StepRail({ step }) {
  const order = STEPS.map(([k]) => k).filter((k) => k !== "done"), at = order.indexOf(step);
  return (
    <ol className="flex items-center gap-1.5" aria-label="Progress">
      {order.map((k, i) => {
        const state = i < at ? "done" : i === at ? "active" : "waiting";
        const Icon = ICON[k];
        return (
          <li key={k} className="flex items-center gap-1.5" aria-current={state === "active" ? "step" : undefined}>
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wide transition-colors duration-300 ${state === "done" ? "bg-cutaway text-cutaway-ink" : state === "active" ? "bg-white text-black" : "bg-white/[0.06] text-white/35"}`}>
              {state === "done" ? <Check key="d" className="cw-pop h-3 w-3" strokeWidth={3} /> : state === "active" ? <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" /> : <Icon className="h-3 w-3" />}
              {STEPS[i][1]}
            </span>
            {i < order.length - 1 && (
              <span className="relative h-px w-4 overflow-hidden bg-white/15 sm:w-6">
                <span className={`cw-bar absolute inset-0 bg-cutaway ${i < at ? "scale-x-100" : "scale-x-0"}`} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function QueuedStep() {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative grid h-28 w-28 place-items-center" aria-hidden="true">
        {[0, 800, 1600].map((d) => <span key={d} className="cw-ring absolute inset-0 rounded-full border border-cutaway/50" style={{ "--d": `${d}ms` }} />)}
        <span className="cw-breath h-10 w-10 rounded-full bg-cutaway/25" />
      </div>
      <p className="mt-2 max-w-[260px] text-[12px] font-medium leading-relaxed text-white/60">Your video is next in line. It starts in a moment.</p>
    </div>
  );
}

function Skeleton({ lines = 4 }) {
  return (
    <div className="w-full space-y-2.5 rounded-2xl border border-white/10 bg-black/40 p-4" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => <div key={i} className="cw-sheen h-2.5 rounded-full bg-white/[0.09]" style={{ width: `${[92, 78, 86, 54][i % 4]}%` }} />)}
    </div>
  );
}

/**
 * A local clock that ticks ~15 times a second from `from` until `from + span`, then stops. Only the component
 * using it re-renders (the typing script, the parts popping in), never the whole generating view.
 */
function useProgressClock(from, span, active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || from == null) return undefined;
    let id = 0;
    const tick = () => { const t = Date.now(); setNow(t); if (t - from < span) id = window.setTimeout(tick, 66); };
    id = window.setTimeout(tick, 66);
    return () => window.clearTimeout(id);
  }, [from, span, active]);
  return now;
}

function ScriptStep({ run }) {
  const text = run.narration ?? "";
  // the demo types over its short script step; a real script types at reading speed from when it arrived
  const span = run.demo ? DEMO_STEP_MS.script * 0.92 : clamp((text.length / 38) * 1000, 3200, 12000);
  const from = run.narrationAt ?? run.stepAt ?? null;
  const now = useProgressClock(from, span, Boolean(text) && !reducedMotion());
  if (!text) {
    return (
      <div className="w-full">
        <Skeleton />
        <p className="mt-3 text-[11px] font-semibold text-white/50">Researching the topic and the surprising facts…</p>
      </div>
    );
  }
  const p = reducedMotion() ? 1 : Math.min(1, (now - (from ?? now)) / span);
  const shown = text.slice(0, Math.floor(text.length * p));
  const words = shown.trim() ? shown.trim().split(/\s+/).length : 0;
  const cut = shown.lastIndexOf(" ");
  return (
    <div className="w-full">
      {/* the newest line stays at the bottom; older lines fade under a gradient (no mask: cheaper to repaint) */}
      <div className="relative max-h-[min(30dvh,260px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0B0E0C]/80 p-4 text-left lg:max-h-[300px]">
        <p className="flex flex-col-reverse text-[13px] leading-relaxed text-white/80">
          <span>{p < 1 ? <>{shown.slice(0, cut + 1)}<span className="font-semibold text-cutaway">{shown.slice(cut + 1)}</span><span className="cw-caret text-cutaway" /></> : shown}</span>
        </p>
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#0B0E0C] to-transparent" />
      </div>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold tabular-nums text-white/50">
        {words} words
        <span className="text-white/25">·</span>
        <ShieldCheck className="h-3.5 w-3.5 text-cutaway" />
        {p < 1 ? "fact-checking the surprises" : `${run.facts?.length || "the"} facts checked`}
      </p>
    </div>
  );
}

const initials = (name) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function SceneStep({ run }) {
  const parts = run.parts ?? [];
  const words = run.narration ? run.narration.trim().split(/\s+/).length : null;
  const span = run.demo ? DEMO_STEP_MS.scene * 0.85 : clamp(parts.length * 380, 2400, 6000);
  const from = run.partsAt ?? run.stepAt ?? null;
  const now = useProgressClock(from, span, parts.length > 0 && !reducedMotion());
  if (!parts.length) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="cw-sheen h-14 rounded-xl bg-white/[0.06]" />)}</div>
        <p className="mt-3 text-[11px] font-semibold text-white/50">Laying out the scene…</p>
      </div>
    );
  }
  const p = reducedMotion() ? 1 : Math.min(1, (now - (from ?? now)) / span);
  const count = Math.max(1, Math.ceil(parts.length * p));
  return (
    <div className="w-full">
      {words != null && <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-cutaway/25 bg-black/40 px-2.5 py-1 text-[10.5px] font-bold text-cutaway"><Check className="h-3 w-3" strokeWidth={3} />Script ready · {words} words</p>}
      <div className="grid grid-cols-3 gap-1.5">
        {parts.slice(0, count).map((name, i) => (
          <span key={name} style={{ "--d": `${(i % 3) * 40}ms` }} className="cw-assemble flex min-w-0 flex-col items-center gap-1 rounded-xl border border-cutaway/25 bg-black/50 px-1.5 py-2 text-center">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cutaway/30 to-cutaway-deep/30 text-[10px] font-black text-cutaway">{initials(name)}</span>
            <span className="w-full truncate text-[10.5px] font-bold text-white/90">{name}</span>
          </span>
        ))}
      </div>
      <p className="mt-3 text-[11px] font-semibold tabular-nums text-white/50">{count} of {parts.length} parts placed · every part timed to its word</p>
    </div>
  );
}

function RenderStep({ run, now }) {
  const pct = clamp(Math.round(run.renderPct ?? 0), 0, 100);
  const elapsed = now - (run.stepAt ?? now);
  const left = pct > 2 ? (elapsed * (100 - pct)) / pct : null;
  const frames = (run.frames ?? []).slice(0, run.framesShown ?? run.frames?.length ?? 0);
  const latest = frames[frames.length - 1];
  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative aspect-[9/16] h-[150px] overflow-hidden rounded-2xl border border-white/15 bg-black/50 shadow-[0_20px_50px_rgba(0,0,0,.5)] sm:h-[190px]">
        {latest ? <img key={latest} src={latest} alt="" className="cw-develop absolute inset-0 h-full w-full object-cover" /> : <div className="cw-sheen absolute inset-0 bg-white/[0.04]" />}
        <div className="cw-scan pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-transparent via-cutaway/30 to-transparent" style={{ animationIterationCount: "infinite", animationDelay: "0ms", animationDuration: "2.2s" }} />
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1 text-[8.5px] font-black uppercase tracking-wider text-cutaway">Preview</span>
      </div>
      <p className="mt-3 text-[44px] font-black leading-none tabular-nums text-white drop-shadow">{pct}<span className="text-[22px] text-white/60">%</span></p>
      <p className="mt-1 text-[11px] font-semibold text-white/55">{left == null ? "Starting the render…" : pct >= 100 ? "Finishing…" : eta(left)}</p>
      <div className="mx-auto mt-3 h-1.5 w-full max-w-[260px] overflow-hidden rounded-full bg-black/45">
        <div className="cw-bar cw-sheen h-full w-full rounded-full bg-cutaway" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      {frames.length > 0 && (
        <div className="mx-auto mt-4 flex max-w-[300px] justify-center gap-1 [perspective:400px]" aria-label="Frames rendered so far">
          {frames.map((src) => <img key={src} src={src} alt="" className="cw-frame-in aspect-[9/16] w-[11.5%] max-w-[34px] rounded-[5px] border border-white/15 object-cover" />)}
        </div>
      )}
    </div>
  );
}

const STEP_VIEW = { queued: QueuedStep, script: ScriptStep, scene: SceneStep, render: RenderStep };

/** The generating state: the blurred backdrop of our own renders, and each step shown as it happens. */
export default function CutawayGenerating({ run }) {
  const now = useNow(500); // the HUD clock, the ETA and the backdrop's crossfade
  const View = STEP_VIEW[run.step] ?? RenderStep;
  const Icon = ICON[run.step] ?? Clapperboard;
  const started = Date.parse(run.createdAt ?? "") || run.stepAt || now;
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
        {/* phones: a stage that fits the screen under the tabs (a full 9:16 would push the story off screen);
            desktop: the 9:16 of the video itself, as tall as the panel */}
        <div className="relative grid h-[calc(100dvh-290px)] max-h-[680px] min-h-[470px] w-full max-w-[420px] place-items-center overflow-hidden rounded-[26px] border border-cutaway/[0.15] bg-[#0D100E] py-12 shadow-[0_30px_80px_-30px_rgba(74,222,128,.25)] lg:aspect-[9/16] lg:h-full lg:max-h-[820px] lg:min-h-0 lg:w-auto lg:max-w-none">
          <Backdrop runId={run.id} tick={Math.floor(now / 4000)} />
          {/* HUD: like a camera that is recording */}
          <div className="absolute inset-x-3 top-3 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-white/70">
            <span className="flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-1"><span className="relative grid h-2 w-2 place-items-center"><span className="cw-ping absolute inset-0 rounded-full bg-cutaway" /><span className="relative h-1.5 w-1.5 rounded-full bg-cutaway" /></span>{run.step === "queued" ? "Queued" : "Live"}</span>
            <span className="rounded-full bg-black/45 px-2 py-1 tabular-nums">{clock(now - started)}</span>
          </div>
          <div key={run.step} className="cw-view relative flex w-full flex-col items-center gap-4 px-5 text-center">
            <span className="relative grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-black/35">
              <span className="cw-ring absolute inset-0 rounded-full border border-cutaway/40" />
              <Icon className={`h-5 w-5 text-cutaway ${run.step === "queued" ? "animate-spin motion-reduce:animate-none" : ""}`} />
            </span>
            <div>
              <p className="text-[16px] font-black text-white drop-shadow">{TITLE[run.step] ?? "Working"}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/45 sm:hidden">{run.topic} · {run.lengthSec} sec</p>
            </div>
            <View run={run} now={now} />
          </div>
          <p className="absolute inset-x-4 bottom-3 text-center text-[10.5px] font-medium text-white/40">You can leave this page. It lands in Recent Creations when it's done.</p>
        </div>
      </section>
    </div>
  );
}
