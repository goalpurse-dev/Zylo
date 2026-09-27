import { useEffect, useMemo, useRef, useState } from "react";
import { STAGE_DURATION_MINUTES, estimateRemainingMinutes, formatElapsed, formatEtaRange } from "./generationTiming";

// Reserve the top slice for the real-completion payoff (see the "97% rule")
// — visual progress derived from stage/time estimates alone must never
// claim more than this until the backend has actually finished.
const PRE_COMPLETE_CEILING = 97;

// Cumulative stage boundaries (0-97) derived from the SAME real observed
// timings generationTiming.js already uses for the ETA pills — one timing
// model per workflow, never a second disconnected one. Each stage's weight
// is its own mid-point estimate (average of low/high), which is exactly
// what a rolling median/p80 would produce once real telemetry replaces
// these numbers (see generationTiming.js's own note on that migration).
function computeStageBoundaries(variant, stageOrder) {
  const table = STAGE_DURATION_MINUTES[variant] ?? {};
  const rows = stageOrder.map((key) => {
    const range = table[key] ?? { low: 0.3, high: 0.6 };
    return { key, high: range.high, mid: (range.low + range.high) / 2 };
  });
  const totalMid = rows.reduce((sum, r) => sum + r.mid, 0) || 1;
  let cursor = 0;
  return rows.map((r) => {
    const width = (r.mid / totalMid) * PRE_COMPLETE_CEILING;
    const start = cursor;
    cursor += width;
    return { key: r.key, start, end: cursor, high: r.high };
  });
}

// 2026-09-20 "truthful progress" fix — real incident: a fresh research run
// showed "Phase 3 of 5" with a bar creeping to nearly full after ~10
// minutes of real wall-clock time, with no other evidence of activity. The
// PREVIOUS version of this function (see git history) advanced the fill
// WITHIN the current stage's own slice purely from elapsed minutes — an
// asymptotic curve that, by design, kept creeping toward "done" the longer
// a stage ran, regardless of whether the backend had made any real
// progress. That is exactly what "never simulate progress using elapsed
// time" forbids: a slow-but-genuinely-working stage and a stalled one
// looked identical once the curve did the elapsed-time creeping for us.
//
// The bar now shows ONLY what's durably true: the cumulative width of every
// STAGE the backend has actually, persistently completed (`current.start` —
// unchanged math, still the same real STAGE_DURATION_MINUTES-weighted
// boundaries). It sits still at that honest value for as long as the
// current stage is in flight, and only ever advances again the instant
// `currentStageKey` genuinely changes (a real backend-persisted stage
// transition) — the existing CSS transition on `.zpr-fill` still makes that
// jump read as a smooth, satisfying advance, it's just never manufactured
// between real transitions. `now`/`startedAt` are kept as parameters only
// for the (still time-grounded, still real) ETA range elsewhere in this
// file — this function itself no longer reads elapsed time at all.
function computeTargetPercent({ variant, stageOrder, currentStageKey }) {
  const boundaries = computeStageBoundaries(variant, stageOrder);
  if (!boundaries.length) return 0;
  const idx = Math.max(
    boundaries.findIndex((b) => b.key === currentStageKey),
    0
  );
  return boundaries[idx].start;
}

// The living macro-progress module shared by every Long Form generation
// screen with a REAL backend stage signal (Research, Script, Visual Plan —
// see each page's GenerationExperience wrapper). Deliberately dumb/
// presentational: driven entirely by props, no polling or backend
// awareness of its own, so the same component works for any workflow that
// hands it {variant, stageOrder, currentStageKey, startedAt}.
export default function GenerationProgressRail({
  variant,
  stageOrder,
  stageLabels,
  currentStageKey,
  startedAt,
  // 2026-09-20 "truthful progress" fix — the row's real, persisted
  // stage_started_at. Distinct from `startedAt` (workflow-wide) and from
  // this component's own poll cadence: it only changes when the backend
  // genuinely claims a new stage, so "time since" it is a true last-
  // checkpoint signal. Optional; omitted entirely when the caller has none.
  stageStartedAt,
  isOffline = false,
  isComplete = false,
  reducedMotion = false,
  // True only once the caller has verified, from real persisted backend
  // fields (worker_lock_until genuinely expired, not just "slower than the
  // ETA estimate"), that the worker that owned this stage is gone — see
  // GenerationExperience's own comment on where this is computed. Distinct
  // from `overrun` below: overrun just means "past our own soft ETA guess"
  // and the backend could still be genuinely working; recovering means the
  // backend's own lease says nobody is.
  recovering = false,
}) {
  const [now, setNow] = useState(() => Date.now());
  const [percent, setPercent] = useState(0);
  const maxPercentRef = useRef(0);
  const prevStageRef = useRef(currentStageKey);
  const [justAdvanced, setJustAdvanced] = useState(false);

  // Target recomputed every 1.5s, not every frame — the CSS transition on
  // the fill smooths the visual motion between updates (see 25/26: no 60fps
  // JS animation loop needed for this).
  useEffect(() => {
    if (isComplete) return;
    const id = setInterval(() => setNow(Date.now()), 1500);
    return () => clearInterval(id);
  }, [isComplete]);

  // The bar must never move backwards (see rule 7) — a stale poll, a
  // recalculated ETA, a reconnect, or a remount can only ever push the
  // clamped value up, never down, for the life of this mounted session.
  useEffect(() => {
    if (isOffline && !isComplete) return; // freeze the target; CSS shimmer still runs
    const raw = isComplete ? 100 : computeTargetPercent({ variant, stageOrder, currentStageKey, startedAt, now });
    const next = Math.max(raw, maxPercentRef.current);
    maxPercentRef.current = next;
    setPercent(next);
  }, [now, currentStageKey, isComplete, isOffline, variant, stageOrder, startedAt]);

  // Real stage-completion reward moment: a short pulse on the leading edge
  // the instant the backend-persisted stage actually advances.
  useEffect(() => {
    if (currentStageKey === prevStageRef.current) return;
    prevStageRef.current = currentStageKey;
    setJustAdvanced(true);
    const t = setTimeout(() => setJustAdvanced(false), 650);
    return () => clearTimeout(t);
  }, [currentStageKey]);

  const startedMs = typeof startedAt === "string" ? new Date(startedAt).getTime() : startedAt;
  const elapsedSeconds = startedMs ? Math.max(0, (now - startedMs) / 1000) : 0;
  // 2026-09-20 "truthful progress" fix: real time since the backend last
  // genuinely claimed a stage — never the frontend's own poll cadence.
  // Shown only once it's actually informative (a real value exists and
  // isn't recovering, which already has its own messaging for "stalled").
  const stageStartedMs = typeof stageStartedAt === "string" ? new Date(stageStartedAt).getTime() : stageStartedAt;
  const sinceCheckpointSeconds = stageStartedMs ? Math.max(0, (now - stageStartedMs) / 1000) : null;
  const showCheckpoint = !isComplete && !recovering && sinceCheckpointSeconds != null && sinceCheckpointSeconds >= 5;
  const etaRange = useMemo(() => estimateRemainingMinutes(variant, stageOrder, currentStageKey), [variant, stageOrder, currentStageKey]);
  const overrun = !isComplete && etaRange && elapsedSeconds / 60 > etaRange.high * 1.15;
  const etaLabel = isComplete ? null : recovering ? "Recovering…" : overrun ? "Taking a little longer than usual" : etaRange ? `${formatEtaRange(etaRange)} left` : null;

  const currentIndex = Math.max(stageOrder.indexOf(currentStageKey), 0);
  const phaseLabel = `Phase ${currentIndex + 1} of ${stageOrder.length}`;
  const stageLabel = isComplete ? "Wrapping up" : (stageLabels?.[currentStageKey] ?? "");

  const boundaries = useMemo(() => computeStageBoundaries(variant, stageOrder), [variant, stageOrder]);
  const markers = boundaries.slice(0, -1).map((b, i) => ({ pos: b.end, state: i < currentIndex ? "done" : i === currentIndex ? "current" : "future" }));

  return (
    <div className={`zpr-wrap ${reducedMotion ? "zpr-reduced-motion" : ""}`}>
      <div className="zpr-top-row">
        <span className="zpr-phase">{phaseLabel}</span>
        {etaLabel && (
          <span key={etaLabel} className="zpr-eta">
            {etaLabel}
          </span>
        )}
      </div>

      <div className={`zpr-track ${isOffline && !isComplete ? "zpr-track-shimmer" : ""}`}>
        <div className="zpr-track-markers">
          {markers.map((m) => (
            <span key={m.pos} className={`zpr-marker zpr-marker-${m.state}`} style={{ left: `${m.pos}%` }} />
          ))}
        </div>
        <div className={`zpr-fill ${justAdvanced ? "zpr-fill-pulse" : ""}`} style={{ transform: `scaleX(${Math.max(percent, 1.5) / 100})` }}>
          <div className="zpr-fill-edge">
            <span className="zpr-fill-edge-glow" />
            {percent > 12 && !reducedMotion && <span className="zpr-fill-sheen" />}
          </div>
        </div>
      </div>

      <div className="zpr-bottom-row">
        {/* Same real, never-reset workflow-start timestamp either way — only
            the label changes. Once recovering, a large raw duration ("Elapsed
            749:48" after an overnight stall) reads as broken rather than
            reassuring, so it's reframed as background/secondary context
            instead of the headline figure. */}
        <span className="zpr-elapsed">
          {recovering ? `Workflow started ${formatElapsed(elapsedSeconds)} ago` : `Elapsed ${formatElapsed(elapsedSeconds)}`}
          {showCheckpoint && ` · Last update ${formatElapsed(sinceCheckpointSeconds)} ago`}
        </span>
        <span className="zpr-stage-label">{stageLabel}</span>
      </div>

      <GenerationProgressRailStyles />
    </div>
  );
}

function GenerationProgressRailStyles() {
  return (
    <style>{`
      .zpr-wrap { width: 100%; max-width: 500px; margin: 18px auto 0; }

      .zpr-top-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
      .zpr-phase { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.4); }
      .zpr-eta { font-size: 13.5px; font-weight: 700; color: #d9f99d; animation: zpr-eta-in 260ms ease-out; }

      .zpr-track { position: relative; width: 100%; height: 7px; border-radius: 9999px; background: rgba(255,255,255,0.07); overflow: hidden; }
      .zpr-track-markers { position: absolute; inset: 0; }
      /* Markers ahead of the fill sit exposed on the dark track (base/
         "future" state below); once the fill's own leading edge passes a
         marker's position, the opaque fill (painted after these in DOM
         order) simply covers it — that IS "completed markers become lime,"
         no separate done-state color needed. Only the upcoming ("current")
         marker, still exposed, needs its own brighter treatment. */
      .zpr-marker { position: absolute; top: 50%; width: 3px; height: 3px; border-radius: 9999px; transform: translate(-50%, -50%); background: rgba(255,255,255,0.16); z-index: 1; transition: background 0.5s; }
      .zpr-marker-current { background: rgba(190,242,100,0.65); }

      .zpr-fill { position: absolute; inset: 0; transform-origin: left center; border-radius: 9999px; background: linear-gradient(90deg, #a3e635, #bef264); transition: transform 900ms cubic-bezier(0.22, 1, 0.36, 1); will-change: transform; }
      .zpr-fill-pulse { animation: zpr-fill-pulse 600ms ease-out; }

      .zpr-fill-edge { position: absolute; top: 50%; right: 0; width: 10px; height: 10px; transform: translate(50%, -50%); }
      .zpr-fill-edge-glow { position: absolute; inset: 0; border-radius: 9999px; background: radial-gradient(circle, rgba(190,242,100,0.9), rgba(190,242,100,0.25) 55%, transparent 75%); animation: zpr-breathe 2.4s ease-in-out infinite; }
      .zpr-fill-sheen { position: absolute; top: -1px; right: 6px; width: 26px; height: 9px; border-radius: 9999px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent); animation: zpr-sheen 2.8s ease-in-out infinite; }

      .zpr-track-shimmer .zpr-fill { animation: zpr-shimmer 1.8s ease-in-out infinite; }

      .zpr-bottom-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 9px; }
      .zpr-elapsed { font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.28); }
      .zpr-stage-label { font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,0.65); text-align: right; }

      @keyframes zpr-eta-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes zpr-breathe { 0%, 100% { opacity: 0.55; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.15); } }
      @keyframes zpr-sheen { 0% { opacity: 0; transform: translateX(0); } 15% { opacity: 1; } 45% { opacity: 0; transform: translateX(-18px); } 100% { opacity: 0; } }
      @keyframes zpr-fill-pulse { 0% { filter: brightness(1); } 35% { filter: brightness(1.35); } 100% { filter: brightness(1); } }
      @keyframes zpr-shimmer { 0%, 100% { opacity: 0.75; } 50% { opacity: 1; } }

      @media (max-width: 480px) {
        .zpr-wrap { max-width: 100%; }
        .zpr-phase, .zpr-eta { font-size: 11.5px; }
      }

      @media (max-height: 680px) {
        .zpr-wrap { margin-top: 12px; }
        .zpr-bottom-row { margin-top: 6px; }
      }
      @media (max-height: 560px) {
        .zpr-wrap { margin-top: 8px; }
        .zpr-top-row { margin-bottom: 6px; }
        .zpr-bottom-row { margin-top: 4px; }
        .zpr-elapsed, .zpr-stage-label { font-size: 10.5px; }
      }

      .zpr-reduced-motion .zpr-fill-edge-glow,
      .zpr-reduced-motion .zpr-fill-sheen,
      .zpr-reduced-motion .zpr-track-shimmer .zpr-fill {
        animation: none !important;
      }
      .zpr-reduced-motion .zpr-fill { transition-duration: 400ms; }
    `}</style>
  );
}
