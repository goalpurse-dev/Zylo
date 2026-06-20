import { useEffect, useState, useCallback } from "react";
import { getQueueJobsByParent, getQueueProgressLabel, isQueueJobTerminal } from "../../lib/generationQueue";
import { getQueuePriorityMessage } from "../../lib/queuePriority";

/* ─── Progress steps (shown in order) ─── */
const STEPS = ["Queued", "Generating images", "Animating scenes", "Finalizing", "Completed"];

function getStepIndex(overallStatus) {
  if (overallStatus === "completed") return 4;
  if (overallStatus === "animating") return 2;
  if (overallStatus === "generating") return 1;
  if (overallStatus === "queued")    return 0;
  return 0;
}

/* ─── Single job status pill ─── */
function JobPill({ job }) {
  const s = job.status;
  const color =
    s === "completed"  ? "border-green-400/30 bg-green-500/10 text-green-300" :
    s === "processing" ? "border-blue-400/30  bg-blue-500/10  text-blue-300"  :
    s === "failed"     ? "border-red-400/30   bg-red-500/10   text-red-300"   :
                         "border-white/10     bg-white/[0.04] text-white/40"  ;

  const label =
    s === "completed"  ? "Done"       :
    s === "processing" ? "Generating" :
    s === "failed"     ? "Failed"     :
                         "Queued"     ;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {s === "processing" && (
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
      )}
      {label}
    </span>
  );
}

/* ─── Retry-busy message ─── */
function RetryBanner() {
  return (
    <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-center">
      <p className="text-xs font-semibold text-amber-300">Provider is busy — retrying automatically</p>
      <p className="mt-0.5 text-[11px] text-amber-200/60">
        Your generation is safe. The provider is temporarily limiting requests so we're queuing retries.
      </p>
    </div>
  );
}

/* ─── Progress step bar ─── */
function StepBar({ activeIndex }) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((label, i) => {
        const done   = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`h-1 w-full rounded-full transition-all duration-500 ${
                done   ? "bg-green-400"      :
                active ? "bg-purple-400 animate-pulse" :
                         "bg-white/10"
              }`}
            />
            <span className={`text-[9px] font-semibold leading-none ${
              done ? "text-green-300" : active ? "text-purple-300" : "text-white/25"
            }`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main modal ─── */
export default function QueueStatusModal({
  open,
  parentGenerationId,   // fruit_story_generations.id — used to poll queue jobs
  planCode,             // user's plan code for priority message
  overallStatus,        // "queued" | "generating" | "animating" | "completed"
  totalScenes,          // number
  completedScenes,      // number
  hasRetryingJobs,      // bool — true when a retryable 402 is in flight
  onDismiss,            // called when user clicks "Got it" or the × button
}) {
  const [queueJobs, setQueueJobs]   = useState([]);
  const [loading,   setLoading]     = useState(false);

  const fetchJobs = useCallback(async () => {
    if (!parentGenerationId) return;
    try {
      const rows = await getQueueJobsByParent(parentGenerationId);
      setQueueJobs(rows);
    } catch { /* ignore */ }
  }, [parentGenerationId]);

  // Poll queue jobs while modal is open and not terminal
  useEffect(() => {
    if (!open || overallStatus === "completed") return;
    setLoading(true);
    fetchJobs().finally(() => setLoading(false));
    const id = setInterval(fetchJobs, 3000);
    return () => clearInterval(id);
  }, [open, overallStatus, fetchJobs]);

  if (!open) return null;

  const stepIndex     = getStepIndex(overallStatus);
  const isDone        = overallStatus === "completed";
  const priorityMsg   = getQueuePriorityMessage(planCode);
  const imageJobs     = queueJobs.filter(j => j.task_type === "image");
  const videoJobs     = queueJobs.filter(j => j.task_type === "video");
  const failedJobs    = queueJobs.filter(j => j.status === "failed");
  const showRetry     = hasRetryingJobs || failedJobs.some(j => j.attempts < j.max_attempts);

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-4 backdrop-blur-md sm:items-center">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#111315] p-5 shadow-2xl shadow-black/60">

        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">
              {isDone ? "✅ Generation complete!" : "Your generation is in the queue"}
            </h2>
            <p className="mt-1 text-xs text-white/45 leading-relaxed">
              {isDone
                ? "All scenes and videos are ready."
                : "We're generating your scenes safely in the background. Higher plans get faster queue priority."}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl text-white/30 hover:bg-white/[0.06] hover:text-white/70 transition"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>

        {/* Step bar */}
        <div className="mb-4">
          <StepBar activeIndex={stepIndex} />
        </div>

        {/* Priority message */}
        {!isDone && (
          <div className="mb-4 rounded-xl border border-purple-400/20 bg-purple-500/10 px-3 py-2.5">
            <p className="text-[11px] text-purple-200/80 leading-relaxed">{priorityMsg}</p>
          </div>
        )}

        {/* Retry warning */}
        {showRetry && !isDone && (
          <div className="mb-4">
            <RetryBanner />
          </div>
        )}

        {/* Scene progress */}
        {totalScenes > 0 && (
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-white/60">Scene images</span>
              <span className="text-xs text-white/40">{completedScenes} / {totalScenes}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-700"
                style={{ width: `${totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Queue jobs breakdown (if we have them) */}
        {queueJobs.length > 0 && (
          <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            {imageJobs.length > 0 && (
              <div className="mb-2">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Images ({imageJobs.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {imageJobs.map((j, i) => (
                    <div key={j.id} className="flex items-center gap-1">
                      <span className="text-[10px] text-white/25">#{i + 1}</span>
                      <JobPill job={j} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {videoJobs.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  Videos ({videoJobs.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {videoJobs.map((j, i) => (
                    <div key={j.id} className="flex items-center gap-1">
                      <span className="text-[10px] text-white/25">#{i + 1}</span>
                      <JobPill job={j} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={onDismiss}
          className="w-full rounded-2xl bg-gradient-to-r from-[#7A3BFF] to-[#9d4eff] py-3 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.98]"
        >
          {isDone ? "View results" : "Got it"}
        </button>

        {!isDone && (
          <p className="mt-2 text-center text-[10px] text-white/25">
            You can close this and your generation will continue in the background.
          </p>
        )}
      </div>
    </div>
  );
}
