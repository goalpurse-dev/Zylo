import { AlertTriangle, Check, Copy, Download, Music2, RotateCcw, ThumbsDown, ThumbsUp, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FOCUS, cx } from "../../ui/zyvo";
import { RUN_STEPS, STATUS_LABELS, clock, isWorking } from "./api/blockyWorldsApi";
import LivePreview, { Clip, PreviewBoundary } from "./LivePreview";
import { ActionButton, CreditMark } from "./StepShell";
import { CLIPS, useReducedMotion } from "./clips";
import "../../onboarding/onboarding.css";
import "./blockyWorlds.css";

/**
 * The right side: the live preview (clips with the story's captions playing), the video being made (the onboarding's
 * orb and ring), or the finished video with a celebration the first time it lands, the upload text and the thumbs.
 */
export default function ResultPanel({ run, recent, onOpen, onEvent, preview, busy = null, prices = null, onRetry, onRewriteRetry }) {
  // how many times this script has failed (the newest 20 runs): the second failure also offers a rewrite
  const failures = run?.draftId ? recent.filter((r) => r.draftId === run.draftId && r.status === "failed").length : 0;
  return (
    <div className="relative flex h-full flex-col gap-4 overflow-y-auto overflow-x-hidden rounded-2xl border border-white/[0.06] bg-[#0E1012] p-5">
      <div key={run ? run.id : "preview"} className="bw-step-in">
        <PreviewBoundary resetKey={run ? `${run.id}:${run.status}` : "preview"}>
          {run ? <RunView run={run} onEvent={onEvent} retry={{ busy, price: prices?.[run.lengthSec] ?? run.credits, failures, onRetry, onRewriteRetry }} /> : <LivePreview {...preview} />}
        </PreviewBoundary>
      </div>
      {recent.length > 0 && (
        <div className="relative">
          <p className="mb-1.5 mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">Your videos</p>
          <ul className="flex flex-col gap-1">
            {recent.slice(0, 8).map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r)} className={cx("bw-lift flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[12px]", FOCUS, r.id === run?.id ? "border-lime-300/35 bg-lime-300/[0.06]" : "border-white/[0.06] bg-white/[0.03]")}>
                  <span className="truncate font-semibold text-white/85">{r.title || "Untitled"}</span>
                  <span className="shrink-0 text-[10.5px] text-white/45">{r.status === "done" ? clock(r.lengthSec) : STATUS_LABELS[r.status]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// while the world is built, a new little job comes up every couple of seconds
const BUILD_LINES = ["Laying the sidewalk, block by block", "Painting the sky", "Parking the bus", "Teaching the townsfolk their lines", "Planting the trees", "Switching on the streetlights", "Adding the captions"];
const RING = 2 * Math.PI * 92;
const SPARKS = Array.from({ length: 22 }, (_, i) => ({ a: `${(i * 360) / 22}deg`, d: `${110 + ((i * 37) % 90)}px`, size: 5 + (i % 4) * 2, delay: `${(i % 5) * 25}ms` }));
const CONFETTI = Array.from({ length: 34 }, (_, i) => ({ left: `${(i * 29) % 100}%`, x: `${((i * 53) % 120) - 60}px`, r: `${((i * 97) % 720) - 360}deg`, c: ["#BEF264", "#FFD32A", "#FF6FB5", "#18B8A5", "#FF7A1A", "#FFFFFF"][i % 6], d: `${1.3 + ((i * 7) % 9) / 10}s`, delay: `${(i % 8) * 60}ms` }));

/** How far along the whole run is, 0..1 (the render step is the long one). */
function progressOf(run) {
  const at = Math.max(0, RUN_STEPS.indexOf(run.status));
  const within = run.status === "render" ? (run.pct ?? 0) / 100 : 0.5;
  const weights = { queued: 0.05, voice: 0.15, plan: 0.15, render: 0.65 };
  let p = 0;
  RUN_STEPS.forEach((s, i) => { if (i < at) p += weights[s] ?? 0; });
  return Math.min(0.98, p + (weights[run.status] ?? 0) * within);
}

function Building({ run }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 2200); return () => clearInterval(t); }, []);
  const at = RUN_STEPS.indexOf(run.status);
  const p = progressOf(run);
  const line = run.status === "render" ? BUILD_LINES[tick % BUILD_LINES.length] : STATUS_LABELS[run.status];
  return (
    <div className="relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden px-2 py-6 text-center" aria-live="polite">
      {/* our clips drifting behind, dimmed, like the onboarding's "coming to life" */}
      <div className="pointer-events-none absolute inset-0 opacity-15" aria-hidden="true">
        {CLIPS.map((c, i) => (
          <div key={c.key} className={cx("ob-drift absolute aspect-[9/16] w-[92px] overflow-hidden rounded-2xl blur-[1px]", ["-left-6 top-0", "-right-6 top-8", "-bottom-16 -left-4", "-bottom-20 -right-6"][i])} style={{ "--ob-drift": `${38 + i * 4}s`, animationDelay: `${-i * 9}s` }}>
            <Clip clip={c.key} playing={i % 2 === tick % 2} />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-[60%] rounded-full bg-lime-300/[0.08] blur-[80px]" />
      <div className="relative h-[240px] w-[240px]">
        {[{ r: 100, s: 7, n: 5 }, { r: 118, s: 11, n: 7 }].map((o) => (
          <div key={o.r} className="ob-orbit absolute inset-0" style={{ "--ob-orbit": `${o.s}s` }}>
            {Array.from({ length: o.n }, (_, i) => (
              <span key={i} className="absolute left-1/2 top-1/2 rounded-[2px] bg-lime-200 shadow-[0_0_10px_rgba(190,242,100,0.9)]" style={{ width: 4 + (i % 3) * 2, height: 4 + (i % 3) * 2, opacity: 0.35 + (i % 3) * 0.25, transform: `rotate(${(i * 360) / o.n}deg) translateY(-${o.r}px)` }} />
            ))}
          </div>
        ))}
        <svg viewBox="0 0 200 200" className="absolute inset-[30px] -rotate-90" aria-hidden="true">
          <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
          <circle cx="100" cy="100" r="92" fill="none" stroke="#BEF264" strokeWidth="7" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - p)} style={{ filter: "drop-shadow(0 0 8px rgba(190,242,100,0.8))", transition: "stroke-dashoffset .8s ease" }} />
        </svg>
        <div className="ob-orb absolute inset-[78px] grid place-items-center rounded-[22px] bg-[radial-gradient(circle_at_35%_30%,#F4FFD6,#BEF264_45%,#65A30D)] shadow-[0_0_60px_18px_rgba(190,242,100,0.35)]">
          <span className="text-[24px] font-black tabular-nums text-[#11150D]">{Math.round(p * 100)}%</span>
        </div>
      </div>
      <p key={line} className="ob-enter relative mt-4 text-[21px] font-black leading-tight tracking-tight text-white">{line}&hellip;</p>
      <p className="relative mt-1 max-w-[300px] truncate text-[13px] font-semibold text-lime-200">&ldquo;{run.title}&rdquo;</p>
      <ol className="relative mt-5 flex flex-wrap justify-center gap-1.5">
        {RUN_STEPS.map((s, i) => (
          <li key={s} className={cx("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition", i < at ? "border-lime-300/40 bg-lime-300/10 text-lime-200" : i === at ? "border-white/40 text-white" : "border-white/10 text-white/30")}>
            {i < at ? <Check className="ob-check h-3 w-3" strokeWidth={3.5} aria-hidden="true" /> : <span className={cx("h-1.5 w-1.5 rounded-full", i === at ? "bg-lime-300" : "bg-white/25")} />}
            {STATUS_LABELS[s]}
          </li>
        ))}
      </ol>
      <p className="relative mt-4 text-[11px] text-white/40">About 3 to 4 minutes. You can leave this page; it keeps going.</p>
    </div>
  );
}

function RunView({ run, onEvent, retry }) {
  const [thumb, setThumb] = useState(null);
  const [copied, setCopied] = useState(false);
  const still = useReducedMotion();
  // the celebration only when we watched it finish (not when an old video is opened from the list)
  const sawWorking = useRef(isWorking(run));
  const [party, setParty] = useState(false);
  useEffect(() => {
    if (isWorking(run)) sawWorking.current = true;
    else if (run.status === "done" && sawWorking.current) { sawWorking.current = false; setParty(true); const t = setTimeout(() => setParty(false), 2600); return () => clearTimeout(t); }
    return undefined;
  }, [run]);

  if (isWorking(run)) return <Building run={run} />;
  if (run.status === "failed") {
    return <FailedView run={run} {...retry} />;
  }
  const post = run.post ?? {};
  const postText = [post.title, post.description, (post.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n");
  const vote = (kind) => { if (thumb) return; setThumb(kind); onEvent(kind); };
  return (
    <div className="relative mx-auto flex w-full max-w-[340px] flex-col gap-3">
      {party && !still && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[520px] overflow-hidden" aria-hidden="true">
          {CONFETTI.map((c, i) => <span key={i} className="bw-confetti" style={{ left: c.left, "--x": c.x, "--r": c.r, "--c": c.c, "--d": c.d, animationDelay: c.delay }} />)}
        </div>
      )}
      <div className="text-center">
        <p className={cx("text-[22px] font-black tracking-[-0.02em] text-white", party && "ob-done")}>{party ? "Your world is ready!" : run.title}</p>
        {party && <p className="ob-enter text-[12px] font-semibold text-lime-200">&ldquo;{run.title}&rdquo; · {clock(run.lengthSec)}</p>}
      </div>
      <div className={cx("relative aspect-[9/16] overflow-hidden rounded-[26px] border border-white/10 bg-black ", party && "ob-done")}>
        {run.finalUrl ? <video src={run.finalUrl} poster={run.poster ?? undefined} controls autoPlay={party} muted={party} loop playsInline className="h-full w-full object-contain" /> : <img src={run.poster ?? "/blocky-worlds/hero.jpg"} alt="" className="h-full w-full object-cover opacity-80" />}
        {party && !still && SPARKS.map((s, i) => <span key={i} className="ob-burst absolute left-1/2 top-1/2 rounded-[2px] bg-lime-200" style={{ "--a": s.a, "--d": s.d, width: s.size, height: s.size, animationDelay: s.delay }} />)}
      </div>
      <div className="flex gap-2">
        {run.downloadUrl && <a href={run.downloadUrl} download onClick={() => onEvent("downloaded")} className={cx("bw-press flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-lime-300 px-3 py-3 text-[14px] font-black text-[#11150D]", FOCUS)}><Download className="h-4 w-4" aria-hidden="true" />Download</a>}
        <button type="button" aria-pressed={thumb === "thumb_up"} onClick={() => vote("thumb_up")} disabled={Boolean(thumb)} className={cx("bw-press grid w-12 place-items-center rounded-2xl border border-white/10 text-white/70", FOCUS, thumb === "thumb_up" && "ob-pick border-lime-300/50 text-lime-300")} aria-label="I like this story"><ThumbsUp className="h-4 w-4" /></button>
        <button type="button" aria-pressed={thumb === "thumb_down"} onClick={() => vote("thumb_down")} disabled={Boolean(thumb)} className={cx("bw-press grid w-12 place-items-center rounded-2xl border border-white/10 text-white/70", FOCUS, thumb === "thumb_down" && "ob-pick border-rose-300/50 text-rose-300")} aria-label="I don't like this story"><ThumbsDown className="h-4 w-4" /></button>
      </div>
      {thumb && <p className="ob-enter text-[11px] text-white/45">Thanks. This helps pick better ideas.</p>}
      {postText && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
          <div className="mb-1 flex items-center justify-between"><p className="text-[10.5px] font-black uppercase tracking-[0.12em] text-white/40">Upload text</p>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(postText); setCopied(true); }} className={cx("flex items-center gap-1 text-[10.5px] font-bold text-white/55 hover:text-lime-300", FOCUS)}>{copied ? <Check className="ob-check h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? "Copied" : "Copy"}</button>
          </div>
          <p className="whitespace-pre-line text-[12px] leading-relaxed text-white/75">{postText}</p>
        </div>
      )}
      <p className="flex items-start gap-2 rounded-2xl border border-lime-300/15 bg-lime-300/[0.05] px-3 py-2.5 text-[11.5px] leading-relaxed text-white/70">
        <Music2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-300" aria-hidden="true" />
        <span><b className="font-bold text-white/85">Tip:</b> for max reach, add a trending sound in TikTok when you post.</span>
      </p>
    </div>
  );
}

/**
 * A video that didn't make it: why, in plain words (contract.js failReason), the refund, and the way forward: "Try
 * again" makes the SAME script again at the same length (it charges normally; the failed one was refunded). From the
 * second failure of the same script (or at once when the builder couldn't show something the story needs) "Rewrite and
 * try again" is offered too.
 */
function FailedView({ run, busy = null, price, failures = 1, onRetry, onRewriteRetry }) {
  const [error, setError] = useState(null);
  const canRetry = Boolean(run.draftId && onRetry);
  const offerRewrite = canRetry && onRewriteRetry && (failures >= 2 || run.failKind === "story");
  const go = async (fn) => {
    setError(null);
    const r = await fn(run);
    if (r && !r.ok && r.error && !["SIGN_IN", "UPGRADE", "CREDITS"].includes(r.error.code)) setError(r.error.message);
  };
  const credits = <span className="flex items-center gap-1 text-[13px] font-semibold"><CreditMark />{price}</span>;
  return (
    <div className="mx-auto flex max-w-[380px] flex-col items-center gap-3 px-2 pt-10 text-center" role="alert">
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-rose-300/25 bg-rose-300/10"><AlertTriangle className="h-5 w-5 text-rose-200" aria-hidden="true" /></span>
      <p className="text-[20px] font-black tracking-[-0.02em] text-white">This video didn&rsquo;t make it</p>
      <p className="max-w-[320px] truncate text-[12.5px] font-semibold text-white/45">&ldquo;{run.title}&rdquo;</p>
      <p className="text-[13.5px] leading-relaxed text-white/80">{run.reason ?? run.error}</p>
      <p className={cx("rounded-full px-3 py-1 text-[12px] font-bold", run.refunded ? "bg-lime-300/10 text-lime-300" : "bg-white/[0.05] text-white/60")}>
        {run.refunded ? `Your ${run.credits} credits are back.` : "Your credits come back within a minute."}
      </p>
      {failures >= 2 && <p className="text-[11.5px] leading-relaxed text-white/45">This script failed {failures} times. A fresh version of it usually builds.</p>}
      {canRetry && (
        <div className="mt-2 flex w-full flex-col gap-2">
          <ActionButton busy={busy === "retrying" ? "Starting…" : null} disabled={Boolean(busy)} onClick={() => go(onRetry)}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />Try again{credits}
          </ActionButton>
          {offerRewrite && (
            <ActionButton variant="secondary" busy={busy === "rewriting" ? "Rewriting…" : null} disabled={Boolean(busy)} onClick={() => go(onRewriteRetry)}>
              <Wand2 className="h-4 w-4" aria-hidden="true" />Rewrite and try again{credits}
            </ActionButton>
          )}
          <p className="text-[11px] leading-relaxed text-white/40">Try again makes the same script at the same length.{offerRewrite ? " A rewrite starts only once the new version passes every check." : ""}</p>
        </div>
      )}
      {error && <p className="text-[12px] font-semibold text-rose-200" role="status">{error}</p>}
    </div>
  );
}
