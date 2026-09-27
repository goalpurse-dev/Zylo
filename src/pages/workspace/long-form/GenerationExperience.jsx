import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CloudCog, RotateCw, Sparkles, WifiOff } from "lucide-react";
import { estimateRemainingMinutes, formatElapsed, formatEtaRange } from "./generationTiming";
import GenerationProgressRail from "./GenerationProgressRail";

// The shared "Zyvo Core" + stage checklist that powers every Long Form
// generation screen (Story Plan, Research, targeted Research repair,
// Script, Visual Plan — see each page's own thin wrapper around this
// component). One component, one set of animations, tuned once — never
// copy/pasted per page. Everything here is driven by REAL persisted state
// (currentStageKey, startedAt) passed in by the caller; this component
// itself never invents progress, never fakes a completed stage, and never
// resets its own elapsed clock — refresh just re-renders from the same
// real startedAt timestamp.
//
// Personality (`variant`) only changes the center icon and one small
// accompanying accent animation — the core visual language (breathing
// glow, orbiting dots, sparks) stays identical across all of them so the
// whole product feels like one system, not four different loaders.
const VARIANT_ICON = { story: Sparkles, research: Sparkles, script: Sparkles, visualPlan: Sparkles };

// 2026-09-20 "truthful progress" fix — Task 1: "stop continuous loading
// animations after completion" + "a brief completion checkmark". Previously
// this core kept its infinite breathing/orbiting/spark animations running
// unconditionally even once `isComplete` was true (the caller only ever
// used `isComplete` to fill the progress rail to 100 — nothing here ever
// stopped or celebrated). `.zg-core-wrap-complete` (below) freezes every
// perpetual animation via CSS; the checkmark itself gets its own one-shot
// entrance, never a looping animation of its own.
function GenerationCore({ variant, isComplete = false }) {
  return (
    <div className={`zg-core-wrap ${isComplete ? "zg-core-wrap-complete" : ""}`}>
      <div className="zg-glow" aria-hidden="true" />
      <svg className="zg-orbits" viewBox="0 0 120 120" aria-hidden="true">
        <circle className="zg-orbit-ring zg-orbit-ring-a" cx="60" cy="60" r="46" />
        <circle className="zg-orbit-ring zg-orbit-ring-b" cx="60" cy="60" r="34" />
        <g className="zg-orbit-dot zg-orbit-dot-a">
          <circle cx="60" cy="14" r="2.4" />
        </g>
        <g className="zg-orbit-dot zg-orbit-dot-b">
          <circle cx="60" cy="26" r="1.8" />
        </g>
        <g className="zg-spark zg-spark-a">
          <circle cx="94" cy="40" r="1.3" />
        </g>
        <g className="zg-spark zg-spark-b">
          <circle cx="26" cy="88" r="1.1" />
        </g>
      </svg>
      <div className="zg-core-icon">
        {isComplete ? <CheckCircle2 className="zg-check-in h-7 w-7" strokeWidth={1.8} /> : <Sparkles className="h-7 w-7" strokeWidth={1.8} />}
      </div>
      {variant === "story" && (
        <svg className="zg-accent" viewBox="0 0 120 120" aria-hidden="true">
          <g className="zg-story-nodes">
            <circle cx="20" cy="96" r="2.2" />
            <circle cx="100" cy="96" r="2.2" />
            <circle cx="60" cy="106" r="2.2" />
            <path className="zg-story-path" d="M20 96 L60 106 L100 96" fill="none" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        </svg>
      )}
      {variant === "research" && (
        <div className="zg-particles" aria-hidden="true">
          <span className="zg-particle zg-particle-a" />
          <span className="zg-particle zg-particle-b" />
          <span className="zg-particle zg-particle-c" />
        </div>
      )}
      {variant === "script" && (
        <div className="zg-lines" aria-hidden="true">
          <span className="zg-line zg-line-a" />
          <span className="zg-line zg-line-b" />
          <span className="zg-line zg-line-c" />
        </div>
      )}
      {variant === "visualPlan" && (
        <div className="zg-frames" aria-hidden="true">
          <span className="zg-frame zg-frame-a" />
          <span className="zg-frame zg-frame-b" />
        </div>
      )}
    </div>
  );
}

// rotateStages: true means there is no real backend stage signal to reflect
// (Story Plan runs as one synchronous request — see story.jsx) — in that
// mode NO stage ever gets a checkmark, since we genuinely don't know when a
// sub-step finishes; only the "current" highlight rotates on a timer, which
// is what the pre-existing StoryLoadingState already did honestly. Faking a
// checkmark here would violate the one rule every other caller relies on:
// only a truly persisted, completed backend stage ever gets one.
function StageChecklist({ stageOrder, stageLabels, currentStageKey, rotateStages, rotatingIndex }) {
  const currentIndex = rotateStages ? rotatingIndex : stageOrder.indexOf(currentStageKey);
  return (
    <div className="zg-rail">
      {stageOrder.map((key, idx) => {
        const done = !rotateStages && idx < currentIndex;
        const current = idx === currentIndex;
        const isLast = idx === stageOrder.length - 1;
        return (
          <div key={key} className="zg-rail-row">
            <div className="zg-rail-marker-col">
              <span className={`zg-rail-marker ${done ? "zg-rail-marker-done" : current ? "zg-rail-marker-active" : "zg-rail-marker-muted"}`}>
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="zg-rail-dot" />}
              </span>
              {!isLast && (
                <span
                  className={`zg-rail-line ${done ? "zg-rail-line-done" : ""} ${idx === currentIndex - 1 ? "zg-rail-line-live" : ""}`}
                />
              )}
            </div>
            <span className={`zg-rail-label ${current ? "zg-rail-label-active" : done ? "zg-rail-label-done" : "zg-rail-label-muted"}`}>{stageLabels[key]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function GenerationExperience({
  variant, // 'story' | 'research' | 'script' | 'visualPlan'
  heading,
  microCopy,
  stageOrder,
  stageLabels,
  currentStageKey,
  // true when there is no real backend stage signal to reflect (Story Plan
  // runs as one synchronous request — see story.jsx's own comment on this).
  // Disables checkmarks entirely and shows a TOTAL eta (from the start)
  // rather than a "remaining from current stage" figure, since there is no
  // real "current stage" to measure from.
  rotateStages = false,
  // Only used in rotateStages mode — {[stageKey]: string} so the
  // supporting line rotates in sync with the highlighted stage, same
  // rotation, same 2.6s cadence, single source of truth.
  stageMicroCopy,
  startedAt, // ISO string or ms timestamp — real, persisted, never reset on refresh
  // 2026-09-20 "truthful progress" fix — the row's real, persisted
  // stage_started_at (ISO string or ms timestamp, or null/undefined for a
  // caller that doesn't have one yet). Distinct from BOTH `startedAt`
  // (workflow-wide, never changes across the whole run) and this
  // component's own polling/heartbeat: it only ever changes when the
  // backend genuinely claims a NEW stage, so "time since" it is a true
  // "last meaningful checkpoint" signal, not a reflection of how often the
  // frontend happens to be asking. Optional — omitted entirely (not a
  // fabricated "just now") when the caller has no such column.
  stageStartedAt,
  failed = false,
  failedHeading = "We couldn't complete this step right now.",
  failedSubcopy,
  onRetry,
  // 2026-09-21 emergency reliability fix: an infrastructure failure with
  // real persisted progress should read as "resume," never "regenerate
  // from scratch" — but every OTHER caller (research/script) already means
  // a genuine retry-the-same-work by "Try Again," so this stays opt-in
  // (default unchanged) rather than a global relabel.
  retryLabel = "Try Again",
  reassuranceNote = "You can safely close this page — Zyvo keeps working and picks up right where it left off.",
  // 'offline' | 'syncing' | null — a CLIENT connection signal only, never a
  // backend status. The frontend is never authoritative for whether
  // generation failed (see connectionState.js), so this must only ever
  // layer a calm, non-alarming notice on top of the same real persisted
  // stage/progress already on screen — it must never itself switch this
  // component into the `failed` branch above.
  connectionStatus = null,
  // True only for the brief real-completion payoff window the caller holds
  // open after the backend reports done (see research.jsx's `completing`
  // state) — animates the rail's fill to 100 before the page switches to
  // its ready reveal. Never set from a frontend guess.
  isComplete = false,
  // True ONLY for the window between the user's click and a durable,
  // persisted workflow row actually existing — no real stage, no real
  // startedAt exist yet, so this suppresses the progress rail AND the stage
  // checklist entirely rather than showing fake Phase 1/Elapsed 00:00
  // against data that isn't real yet (see script.jsx's `starting` phase,
  // added after a bug let the UI claim generation had started before any
  // ScriptVersion row existed). Once the caller has a real persisted row,
  // it stops passing this and the normal stage UI takes over.
  pending = false,
  // The row's real, persisted worker_lock_until (ISO string or null) — NOT
  // a frontend guess. A durable async worker (Research/Script/Visual Plan)
  // takes a lease on its row for the duration of one stage attempt; while
  // that lease is in the future, some worker may genuinely still be
  // running. Once it's meaningfully in the past and the caller hasn't yet
  // observed the stage/status change, the worker that held it is gone —
  // this is what actually happened to a real Script (63c3df8b-...): a
  // critic call timed out, the failure handler correctly wrote a short
  // backoff lease, and then nothing ever came back to retry it, so the lease
  // just expired and sat there while the UI kept saying "Taking a little
  // longer than usual" for 30+ minutes. This component never dispatches
  // anything on its own to fix that (see reassuranceNote) — it only stops
  // pretending a dead worker looks like live progress. The backend recovery
  // sweep (long-form-*-advance crons) is what actually resumes the row.
  workerLockUntil = null,
}) {
  const [now, setNow] = useState(() => Date.now());
  const [rotatingIndex, setRotatingIndex] = useState(0);
  const prefersReducedMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  // First moment `recovering` was observed true, so the "Resume now" escape
  // hatch only appears after it's been persistently stale for a while —
  // never on the first poll that happens to land just past the 20s grace
  // above. Reset to null the instant recovering clears (a real claim landed),
  // so a later, unrelated stall starts its own fresh countdown.
  const recoveringSinceRef = useRef(null);

  useEffect(() => {
    if (failed) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [failed]);

  useEffect(() => {
    if (failed || !rotateStages) return;
    const id = setInterval(() => setRotatingIndex((i) => (i + 1) % stageOrder.length), 2600);
    return () => clearInterval(id);
  }, [failed, rotateStages, stageOrder.length]);

  if (failed) {
    return (
      <div className="zg-container zg-container-failed">
        <div className="zg-core-icon zg-core-icon-failed">
          <Sparkles className="h-6 w-6" strokeWidth={1.8} />
        </div>
        <h1 className="zg-heading">{failedHeading}</h1>
        {failedSubcopy && <p className="zg-microcopy">{failedSubcopy}</p>}
        <button type="button" onClick={onRetry} className="zg-retry-btn">
          <RotateCw className="h-4 w-4" />
          {retryLabel}
        </button>
        <GenerationStyles />
      </div>
    );
  }

  if (pending) {
    return (
      <div className="zg-container">
        <GenerationCore variant={variant} />
        <h1 className="zg-heading">{heading}</h1>
        {microCopy && <p className="zg-microcopy">{microCopy}</p>}
        <p className="zg-reassurance">
          <CloudCog className="h-3.5 w-3.5 shrink-0" />
          {reassuranceNote}
        </p>
        <GenerationStyles />
      </div>
    );
  }

  const startedMs = typeof startedAt === "string" ? new Date(startedAt).getTime() : startedAt;
  const elapsedSeconds = startedMs ? Math.max(0, (now - startedMs) / 1000) : 0;
  const elapsedMinutes = elapsedSeconds / 60;

  // 20s grace past the lease's own expiry — generous enough that a normal
  // in-flight call (lease still in the future) or the brief gap between one
  // stage's lease clearing and the next stage's lease being taken never
  // trips this, but small enough that a genuinely abandoned worker is
  // surfaced quickly rather than after minutes.
  const lockUntilMs = typeof workerLockUntil === "string" ? new Date(workerLockUntil).getTime() : workerLockUntil;
  const recovering = !rotateStages && Boolean(lockUntilMs) && now - lockUntilMs > 20_000;

  if (recovering && recoveringSinceRef.current === null) recoveringSinceRef.current = now;
  if (!recovering) recoveringSinceRef.current = null;
  // Real backend recovery (the long-form-*-advance cron sweeps) typically
  // reclaims a dead worker within ~1 minute of its lease expiring — giving
  // this 2 minutes of grace before offering "Resume now" means the button
  // only ever appears once that normal window has already passed, not as a
  // reflex the instant staleness is first detected.
  const showResumeNow = recovering && recoveringSinceRef.current !== null && now - recoveringSinceRef.current > 120_000;

  const etaRange = estimateRemainingMinutes(variant, stageOrder, rotateStages ? stageOrder[0] : currentStageKey);
  const etaLabel = etaRange ? formatEtaRange(etaRange) : null;
  // Only rotateStages (Story Plan) still needs this swap-the-microcopy
  // overrun treatment — the real-stage rail below carries its own
  // "Taking a little longer than usual" ETA-label swap instead, so the two
  // don't end up saying the same thing twice on the same screen.
  const runningLong = rotateStages && etaRange && elapsedMinutes > etaRange.high * 1.15;

  const activeMicroCopy = rotateStages ? stageMicroCopy?.[stageOrder[rotatingIndex]] : microCopy;

  return (
    <div className={`zg-container ${prefersReducedMotion ? "zg-reduced-motion" : ""}`}>
      <GenerationCore variant={variant} isComplete={isComplete} />

      <h1 className="zg-heading">{heading}</h1>
      {recovering ? (
        <p className="zg-microcopy">Last attempt was interrupted. Zyvo is safely resuming this step.</p>
      ) : (
        activeMicroCopy && <p className="zg-microcopy">{runningLong ? "This one is taking a little longer than usual, but Zyvo is still working." : activeMicroCopy}</p>
      )}

      {rotateStages ? (
        <div className="zg-meta-row">
          <span className="zg-meta-chip">Elapsed {formatElapsed(elapsedSeconds)}</span>
          {etaLabel && <span className="zg-meta-chip">Usually ready in {etaLabel}</span>}
        </div>
      ) : (
        <GenerationProgressRail
          variant={variant}
          stageOrder={stageOrder}
          stageLabels={stageLabels}
          currentStageKey={currentStageKey}
          startedAt={startedAt}
          stageStartedAt={stageStartedAt}
          isOffline={connectionStatus === "offline"}
          isComplete={isComplete}
          reducedMotion={prefersReducedMotion}
          recovering={recovering}
        />
      )}

      <StageChecklist stageOrder={stageOrder} stageLabels={stageLabels} currentStageKey={currentStageKey} rotateStages={rotateStages} rotatingIndex={rotatingIndex} />

      <p className="zg-reassurance">
        <CloudCog className="h-3.5 w-3.5 shrink-0" />
        {reassuranceNote}
      </p>

      {recovering && (
        <>
          <p className="zg-connection-notice zg-connection-notice-syncing">
            <RotateCw className="zg-sync-spin h-3.5 w-3.5 shrink-0" />
            Recovering your narration…
          </p>
          {/* Backend recovery (the recovery-sweep cron) remains authoritative
              and keeps trying regardless — this button only re-asks it via
              the SAME idempotent resume path onRetry already uses elsewhere
              (start-*-with-regenerate:false), which for a row that's still
              actively owned by the backend is a safe no-op, and for a row
              that has since reached a real terminal `failed` state actually
              resumes it. It can never itself start a second worker or a new
              version. */}
          {showResumeNow && onRetry && (
            <button type="button" onClick={onRetry} className="zg-resume-now-btn">
              Resume now
            </button>
          )}
        </>
      )}

      {connectionStatus === "offline" && (
        <p className="zg-connection-notice">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          Connection lost — Zyvo is still working in the background. Reconnecting…
        </p>
      )}
      {connectionStatus === "syncing" && (
        <p className="zg-connection-notice zg-connection-notice-syncing">
          <RotateCw className="zg-sync-spin h-3.5 w-3.5 shrink-0" />
          Reconnected · Syncing progress…
        </p>
      )}

      <GenerationStyles />
    </div>
  );
}

// Scoped, self-contained keyframes — no global CSS/Tailwind config changes.
// prefers-reduced-motion is handled by the .zg-reduced-motion class the
// component adds to its own root when the media query matches: orbit/drift/
// spark animations are disabled, the breathing pulse and sheen are disabled,
// but color/opacity STATE changes (muted -> active -> done) remain, since
// those carry real information, not just motion.
function GenerationStyles() {
  return (
    <style>{`
      .zg-container { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 32px 16px; max-width: 460px; max-height: 100%; margin: 0 auto; }
      .zg-container-failed { padding: 40px 16px; }

      .zg-core-wrap { position: relative; width: 96px; height: 96px; margin-bottom: 22px; display: grid; place-items: center; }
      .zg-glow { position: absolute; inset: -30px; border-radius: 9999px; background: radial-gradient(circle, rgba(190,242,100,0.22), transparent 65%); filter: blur(6px); animation: zg-breathe 3.6s ease-in-out infinite; }
      .zg-orbits { position: absolute; inset: 0; width: 100%; height: 100%; }
      .zg-orbit-ring { fill: none; stroke: rgba(190,242,100,0.14); stroke-width: 0.6; }
      .zg-orbit-ring-b { stroke: rgba(125,211,252,0.12); }
      .zg-orbit-dot { fill: #bef264; transform-origin: 60px 60px; animation: zg-spin 7s linear infinite; }
      .zg-orbit-dot-b { fill: #7dd3fc; transform-origin: 60px 60px; animation: zg-spin-reverse 10s linear infinite; }
      .zg-spark { fill: #bef264; animation: zg-spark-fade 3.2s ease-in-out infinite; }
      .zg-spark-b { fill: #f0abfc; animation-delay: 1.4s; }
      .zg-core-icon { position: relative; z-index: 1; display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; border: 1px solid rgba(190,242,100,0.28); background: rgba(190,242,100,0.07); color: #bef264; animation: zg-breathe-icon 3.6s ease-in-out infinite; }
      .zg-core-icon-failed { border-color: rgba(248,113,113,0.25); background: rgba(248,113,113,0.07); color: #fca5a5; margin-bottom: 18px; animation: none; }

      /* 2026-09-20 "truthful progress" fix: once the backend has genuinely
         finished, every perpetual animation on the core stops — a completed
         workflow must never still look like it's thinking. The checkmark
         gets one brief, non-looping entrance instead. */
      .zg-core-wrap-complete .zg-glow,
      .zg-core-wrap-complete .zg-orbit-dot,
      .zg-core-wrap-complete .zg-orbit-dot-b,
      .zg-core-wrap-complete .zg-spark,
      .zg-core-wrap-complete .zg-spark-b,
      .zg-core-wrap-complete .zg-core-icon,
      .zg-core-wrap-complete .zg-story-path,
      .zg-core-wrap-complete .zg-particle,
      .zg-core-wrap-complete .zg-line,
      .zg-core-wrap-complete .zg-frame {
        animation: none !important;
      }
      .zg-core-wrap-complete .zg-glow { opacity: 0.75; }
      .zg-core-wrap-complete .zg-core-icon { border-color: rgba(190,242,100,0.5); background: rgba(190,242,100,0.12); }
      .zg-check-in { animation: zg-check-in 480ms cubic-bezier(0.22, 1, 0.36, 1); }

      .zg-accent, .zg-particles, .zg-lines, .zg-frames { position: absolute; inset: 0; pointer-events: none; }
      .zg-story-nodes circle { fill: rgba(190,242,100,0.6); }
      .zg-story-path { stroke: rgba(190,242,100,0.45); stroke-dasharray: 90; stroke-dashoffset: 90; animation: zg-draw 3.6s ease-in-out infinite; }

      .zg-particle { position: absolute; width: 4px; height: 4px; border-radius: 9999px; background: #7dd3fc; opacity: 0; animation: zg-travel 2.8s ease-in infinite; }
      .zg-particle-a { top: 6px; left: 10px; animation-delay: 0s; }
      .zg-particle-b { top: 82px; left: 8px; animation-delay: 0.9s; }
      .zg-particle-c { top: 14px; right: 6px; left: auto; animation-delay: 1.8s; }

      .zg-line { position: absolute; left: 50%; height: 2px; border-radius: 9999px; background: rgba(190,242,100,0.35); transform: translateX(-50%); opacity: 0; animation: zg-line-in 3s ease-in-out infinite; }
      .zg-line-a { bottom: 8px; width: 30px; animation-delay: 0s; }
      .zg-line-b { bottom: 2px; width: 20px; animation-delay: 0.5s; }
      .zg-line-c { bottom: -4px; width: 24px; animation-delay: 1s; }

      .zg-frame { position: absolute; border: 1.2px solid rgba(125,211,252,0.4); border-radius: 3px; opacity: 0; animation: zg-frame-in 3.4s ease-in-out infinite; }
      .zg-frame-a { width: 24px; height: 14px; top: 4px; right: 2px; animation-delay: 0s; }
      .zg-frame-b { width: 20px; height: 12px; bottom: 6px; left: 0px; animation-delay: 1.2s; }

      .zg-heading { font-size: 21px; font-weight: 700; color: #fff; letter-spacing: -0.01em; }
      .zg-microcopy { margin-top: 6px; font-size: 12.5px; color: rgba(255,255,255,0.45); max-width: 360px; }
      .zg-retry-btn { margin-top: 22px; display: inline-flex; align-items: center; gap: 8px; border-radius: 12px; background: #bef264; padding: 12px 20px; font-size: 14px; font-weight: 600; color: #11150D; transition: background 0.15s; }
      .zg-retry-btn:hover { background: #d9f99d; }

      .zg-meta-row { margin-top: 16px; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
      .zg-meta-chip { border-radius: 9999px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); padding: 4px 11px; font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.45); }

      .zg-rail { margin-top: 22px; width: 100%; max-width: 340px; text-align: left; }
      .zg-rail-row { display: flex; align-items: flex-start; gap: 10px; }
      .zg-rail-marker-col { display: flex; flex-direction: column; align-items: center; }
      .zg-rail-marker { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 9999px; flex-shrink: 0; transition: background 0.4s, border-color 0.4s, color 0.4s; }
      .zg-rail-marker-done { color: #bef264; }
      .zg-rail-marker-active { border: 1px solid rgba(190,242,100,0.4); background: rgba(190,242,100,0.08); }
      .zg-rail-marker-muted { border: 1px solid rgba(255,255,255,0.1); }
      .zg-rail-dot { width: 6px; height: 6px; border-radius: 9999px; background: rgba(255,255,255,0.18); }
      .zg-rail-marker-active .zg-rail-dot { background: #bef264; animation: zg-pulse-dot 1.6s ease-in-out infinite; }
      .zg-rail-line { position: relative; width: 1px; flex: 1; min-height: 14px; background: rgba(255,255,255,0.08); transition: background 0.5s; margin: 2px 0; overflow: hidden; }
      .zg-rail-line-done { background: rgba(190,242,100,0.3); }
      /* Very subtle — the one connector between the last completed stage and
         the current one gets a soft light traveling down it, nothing more. */
      .zg-rail-line-live::after { content: ""; position: absolute; left: 0; top: -12px; width: 100%; height: 12px; background: linear-gradient(180deg, transparent, rgba(190,242,100,0.55), transparent); animation: zg-rail-travel 2.2s ease-in-out infinite; }
      .zg-rail-label { padding: 2px 0 14px; font-size: 12.5px; font-weight: 500; transition: color 0.4s; }
      .zg-rail-label-active { color: #fff; }
      .zg-rail-label-done { color: rgba(255,255,255,0.5); }
      .zg-rail-label-muted { color: rgba(255,255,255,0.28); }

      .zg-reassurance { margin-top: 20px; display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: rgba(255,255,255,0.3); max-width: 360px; }

      /* Client connection signal only — never the same styling as a real
         backend failure (no red). Amber = we're not sure right now, muted
         blue = we just found out for sure. */
      .zg-connection-notice { margin-top: 12px; display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: rgba(253,224,71,0.75); max-width: 360px; }
      .zg-connection-notice-syncing { color: rgba(125,211,252,0.75); }
      .zg-sync-spin { animation: zg-spin 1s linear infinite; }

      .zg-resume-now-btn { margin-top: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); padding: 8px 16px; font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,0.7); transition: background 0.15s, color 0.15s; }
      .zg-resume-now-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }

      @keyframes zg-breathe { 0%, 100% { opacity: 0.6; transform: scale(0.96); } 50% { opacity: 1; transform: scale(1.05); } }
      @keyframes zg-breathe-icon { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
      @keyframes zg-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes zg-spin-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
      @keyframes zg-spark-fade { 0%, 100% { opacity: 0; } 50% { opacity: 0.9; } }
      @keyframes zg-draw { 0% { stroke-dashoffset: 90; opacity: 0; } 20% { opacity: 1; } 70% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
      @keyframes zg-travel { 0% { opacity: 0; transform: translate(0, 0) scale(0.6); } 15% { opacity: 1; } 90% { opacity: 0.8; } 100% { opacity: 0; transform: translate(30px, 32px) scale(1); } }
      @keyframes zg-line-in { 0%, 100% { opacity: 0; transform: translateX(-50%) scaleX(0.6); } 40%, 70% { opacity: 1; transform: translateX(-50%) scaleX(1); } }
      @keyframes zg-rail-travel { 0% { top: -12px; opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
      @keyframes zg-frame-in { 0%, 100% { opacity: 0; transform: scale(0.9); } 40%, 70% { opacity: 1; transform: scale(1); } }
      @keyframes zg-pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      @keyframes zg-check-in { 0% { opacity: 0; transform: scale(0.6); } 60% { opacity: 1; transform: scale(1.12); } 100% { opacity: 1; transform: scale(1); } }

      /* Viewport-lock compression: the generation screen must never scroll
         (see the page-level wrapper's h-full/overflow-hidden), so on a
         short viewport (a laptop with browser chrome, a landscape phone) we
         shrink spacing/sizes here instead — every stage/status line stays
         visible, nothing is hidden just because the window is short. */
      @media (max-height: 680px) {
        .zg-container { padding: 20px 16px; }
        .zg-container-failed { padding: 24px 16px; }
        .zg-core-wrap { width: 76px; height: 76px; margin-bottom: 14px; }
        .zg-heading { font-size: 18px; }
        .zg-microcopy { margin-top: 4px; font-size: 12px; }
        .zg-meta-row { margin-top: 10px; }
        .zg-rail { margin-top: 14px; }
        .zg-rail-label { padding: 2px 0 10px; }
        .zg-reassurance { margin-top: 12px; }
        .zg-connection-notice { margin-top: 8px; }
      }
      @media (max-height: 560px) {
        .zg-container { padding: 12px 16px; }
        .zg-container-failed { padding: 16px 16px; }
        .zg-core-wrap { width: 56px; height: 56px; margin-bottom: 8px; }
        .zg-heading { font-size: 15px; }
        .zg-microcopy { font-size: 11px; }
        .zg-meta-row { margin-top: 8px; gap: 6px; }
        .zg-meta-chip { padding: 3px 9px; font-size: 10px; }
        .zg-rail { margin-top: 10px; }
        .zg-rail-label { padding: 1px 0 6px; font-size: 11px; }
        .zg-reassurance { margin-top: 8px; font-size: 10.5px; }
        .zg-connection-notice { margin-top: 6px; font-size: 10.5px; }
      }

      @media (prefers-reduced-motion: reduce) {
        .zg-glow, .zg-orbit-dot, .zg-orbit-dot-b, .zg-spark, .zg-spark-b, .zg-core-icon, .zg-story-path, .zg-particle, .zg-line, .zg-frame, .zg-rail-marker-active .zg-rail-dot {
          animation: none !important;
        }
        .zg-rail-line-live::after { animation: none !important; content: none; }
        .zg-story-path { opacity: 0.45; stroke-dashoffset: 0; }
        .zg-particle, .zg-line, .zg-frame { opacity: 0.5; }
        .zg-check-in { animation: zg-check-in-fade 200ms ease-out; }
      }
      @keyframes zg-check-in-fade { from { opacity: 0; } to { opacity: 1; } }
    `}</style>
  );
}
