// Phase 6a — "Writing your script": the one progress screen of the Stickman
// autopilot (story plan -> research-lite -> script, no clicks in between).
//
// Never stuck by construction:
//   - it polls SERVER state every 4 s; the elapsed clock is derived from the
//     server's start timestamp + the server's "now" (offset-corrected), so it
//     keeps counting even if a poll fails and can never freeze;
//   - the stage text is the real stage from the server (never "Wrapping up"
//     while planning), the ETA is the server's honest range from measured
//     timings, and the progress bar never goes backwards;
//   - a stalled stage is re-dispatched by the server watchdog; after 2 failed
//     resumes this shows "Something went wrong — Retry (free)".
// Every event shown is real (title chosen, facts + source, word count,
// claims checked). When the script is ready it goes straight to review.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpenCheck, Check, ChevronDown, FileText, Loader2, PenLine, RotateCw, Search, Sparkles, TriangleAlert } from "lucide-react";
import { fetchLongFormProject } from "./project";
import { LongFormCreationHeader } from "./shared";
import { AUTOPILOT_POLL_MS, fetchAutopilotStatus, formatClock, formatEta, startAutopilot, watchProject } from "./autopilot";
import { cleanUserText } from "./textClean";
import { displayTitle } from "./scriptReviewModel";

const STAGE_ICON = { plan: Sparkles, research: Search, write: PenLine, verify: BookOpenCheck, polish: FileText };

// Phase 6e: embedded as the first stage of the generating screen (no header, onDone instead of navigating).
export default function LongFormWritingPage({ embedded = false, projectId: embeddedId = null, onDone = null } = {}) {
  const params = useParams();
  const projectId = embeddedId ?? params.id;
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [view, setView] = useState(null);
  const [progress, setProgress] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [planOpen, setPlanOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const offsetRef = useRef(0); // local clock - server clock
  const inFlight = useRef(false);

  useEffect(() => { fetchLongFormProject(projectId).then(setProject); }, [projectId]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      const v = await fetchAutopilotStatus(projectId);
      inFlight.current = false;
      if (!alive || !v) return;
      if (v.serverNow) offsetRef.current = Date.now() - Date.parse(v.serverNow);
      setView(v);
      setProgress((p) => Math.max(p, v.progress ?? 0)); // never backwards
      if (v.status === "done") {
        // Phase 6e: the chain goes straight on (voice, then scenes) on the same generating screen.
        if (embedded) onDone?.(); else setTimeout(() => navigate(`/long-form/project/${projectId}/generating`, { replace: true }), 600);
      }
    };
    poll();
    const t = setInterval(poll, AUTOPILOT_POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [projectId, navigate, embedded, onDone]);

  // The elapsed clock ticks every second from the SERVER start time.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (view?.status === "running") watchProject(projectId); }, [view?.status, projectId]);

  const elapsed = view?.startedAt ? (now - offsetRef.current - Date.parse(view.startedAt)) / 1000 : 0;
  const events = useMemo(() => [...(view?.events ?? [])].reverse(), [view?.events]);
  const activeStage = view?.stages?.find((s) => s.state === "active" || s.state === "failed");

  const retry = async () => {
    setRetrying(true);
    await startAutopilot(projectId, { retry: true });
    setRetrying(false);
    setView((v) => (v ? { ...v, status: "running", failed: null } : v));
  };
  const start = async () => {
    setRetrying(true);
    await startAutopilot(projectId);
    setRetrying(false);
  };

  return (
    <div className={embedded ? "" : "mx-auto max-w-[860px] px-4 py-8 pb-24 lg:px-8 lg:py-10"}>
      {!embedded && <LongFormCreationHeader current="generating" project={project ? { ...project, autopilot: project.autopilot ?? { status: "running" } } : null} stickman />}

      {view?.status === "none" ? (
        <div className="mx-auto max-w-[460px] py-20 text-center">
          <h1 className="text-[22px] font-bold text-white">Ready to write your script</h1>
          <p className="mt-2 text-[13.5px] text-white/50">We'll plan the story, find the facts and write the script in one go.</p>
          <button type="button" disabled={retrying} onClick={start} className="mt-6 rounded-xl bg-lime-300 px-5 py-2.5 text-[14px] font-bold text-black disabled:opacity-60">Write my script</button>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-bold leading-tight text-white">{view?.status === "done" ? "Your script is ready" : "Writing your script"}</h1>
              <p className="mt-1 text-[13.5px] text-white/50">
                {view?.status === "failed" ? "Stopped" : view?.status === "done" ? "Opening your script…" : activeStage?.label ?? "Starting…"}
                {view?.status === "running" && <> · <span className="tabular-nums">{formatClock(elapsed)}</span></>}
                {view?.status === "running" && formatEta(view?.etaSeconds) && <> · {formatEta(view.etaSeconds)}</>}
              </p>
            </div>
            {view?.status === "running" && <p className="text-[12.5px] text-white/40">You can leave — we'll keep going and let you know when it's ready.</p>}
          </div>

          {/* Progress bar (monotonic) */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div className="h-full rounded-full bg-lime-300" initial={false} animate={{ width: `${Math.round(progress * 100)}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
          </div>

          {/* The five real stages */}
          <ol className="mt-6 grid gap-2 sm:grid-cols-5">
            {(view?.stages ?? []).map((s) => {
              const Icon = STAGE_ICON[s.key] ?? Sparkles;
              return (
                <li key={s.key} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold ${s.state === "active" ? "border-lime-300/40 bg-lime-300/[0.07] text-white" : s.state === "done" ? "border-white/[0.08] text-white/60" : s.state === "failed" ? "border-amber-300/40 bg-amber-300/[0.06] text-amber-200" : "border-white/[0.05] text-white/30"}`}>
                  {s.state === "done" ? <Check className="h-4 w-4 text-lime-300" /> : s.state === "active" ? <Loader2 className="h-4 w-4 animate-spin text-lime-300" /> : s.state === "failed" ? <TriangleAlert className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  {s.label}
                </li>
              );
            })}
          </ol>

          {view?.status === "failed" && (
            <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-300/[0.05] p-5">
              <p className="text-[15px] font-bold text-white">Something went wrong</p>
              <p className="mt-1 text-[13px] text-white/55">Your progress is saved — retrying picks up where it stopped. It's free.</p>
              <button type="button" disabled={retrying} onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-4 py-2 text-[13.5px] font-bold text-black disabled:opacity-60">
                <RotateCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} /> Retry (free)
              </button>
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
            {/* Live events — every line is a real thing that happened */}
            <section>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">What's happening</h2>
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {events.map((e, i) => (
                    <motion.li key={`${e.kind}-${e.text}`} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, delay: i === 0 ? 0 : 0.02 }}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-[13px] text-white/80">
                      {e.kind === "fact" ? <><span className="mr-1.5 text-lime-300">Fact found:</span>{cleanUserText(e.text)}{e.detail && <span className="text-white/40"> — {cleanUserText(e.detail)}</span>}</> : cleanUserText(e.text)}
                    </motion.li>
                  ))}
                </AnimatePresence>
                {!events.length && <li className="text-[13px] text-white/35">Getting started…</li>}
              </ul>
            </section>

            {/* The plan — informational, never a gate */}
            {view?.plan && (
              <aside className="self-start rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <button type="button" onClick={() => setPlanOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                  <span className="text-[13px] font-bold text-white">Plan{view.plan.title ? ` · ${cleanUserText(view.plan.title)}` : ""}</span>
                  <ChevronDown className={`h-4 w-4 text-white/40 transition ${planOpen ? "rotate-180" : ""}`} />
                </button>
                {planOpen && (
                  <ol className="space-y-2 px-4 pb-4">
                    {view.plan.chapters.map((c, i) => (
                      <li key={i} className="text-[12.5px]">
                        <p className="font-semibold text-white/80">{i + 1}. {displayTitle(cleanUserText(c.title))}</p>
                        {c.summary && <p className="text-white/40">{cleanUserText(c.summary)}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}
