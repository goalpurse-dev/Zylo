// _shared/stuckJobs.ts — what the sweeper does with a generation job that is not moving (2026-10-07). Pure.
//
// Before this, nothing on the server ever came back to a job once its worker's
// polling window was over. Three Seedance clips were charged and left
// "processing" for ever (4-7 Oct); images and thumbnails span for ever unpaid.
// The rule now, for every tool on the shared `jobs` pipeline:
//   - queued and nobody is working on it (a lost dispatch, a worker that died while
//     waiting): it is dispatched again every minute;
//   - running/processing for 15 minutes: the provider is asked once more (a video
//     that did finish is delivered; one that failed is refunded);
//   - still not finished after 30 minutes: failed and refunded automatically. The
//     user reads STUCK_COPY; trying again costs nothing extra (the charge is back);
//   - while our provider balance guard has paused new work, queued jobs WAIT and
//     their clock does not run (a pause is never a failure).
export const REDISPATCH_QUEUED_AFTER_S = 120;
export const RECHECK_AFTER_S = 15 * 60;
export const REFUND_AFTER_S = 30 * 60;
// Work made BEFORE this is never touched by the sweeper. The old backlog (10 charged jobs from
// June-August, 837 unpaid ones, one 2AM story) is the owner's to decide on, not a side effect of
// turning the sweeper on. Config: SWEEPER_CREATED_AFTER (an ISO time).
export const SWEEP_CREATED_AFTER_DEFAULT = "2026-10-07T00:00:00.000Z";
export const STUCK_ERROR_CODE = "STUCK_TIMEOUT";
export const STUCK_COPY = "This took too long on our side, so nothing was charged. Please try again.";
export const PAUSED_COPY = "Paused for a moment, continues automatically.";

export type JobLite = { status: string; created_at: string; claimed_at: string | null; retry_after: string | null };
export type StuckAction = "none" | "hold" | "redispatch" | "recheck" | "recheck_then_refund" | "refund";

// paused: the balance guard has paused the provider this job runs on.
// canRecheck: the provider can still be asked about it (a video with a provider task id).
export function decideStuckJob(j: JobLite, nowMs: number, o: { paused: boolean; canRecheck: boolean }): StuckAction {
  if (j.status === "queued") {
    if (o.paused) return "hold";
    // A held or backed-off job waits from its retry time, not from its creation.
    const since = Math.max(Date.parse(j.created_at), j.retry_after ? Date.parse(j.retry_after) : 0);
    const ageS = (nowMs - since) / 1000;
    if (ageS >= REFUND_AFTER_S) return "refund";
    return ageS >= REDISPATCH_QUEUED_AFTER_S ? "redispatch" : "none";
  }
  if (j.status === "running" || j.status === "processing") {
    const ageS = (nowMs - Date.parse(j.claimed_at ?? j.created_at)) / 1000;
    if (ageS < RECHECK_AFTER_S) return "none";
    if (ageS < REFUND_AFTER_S) return o.canRecheck ? "recheck" : "none";
    return o.canRecheck ? "recheck_then_refund" : "refund";
  }
  return "none";
}

// Failures in the last window: worth an email? (enough work to mean something, and more than the share allowed)
export const FAILURE_WINDOW_S = 600;
export const FAILURE_SHARE = 0.2;
export const FAILURE_MIN_SAMPLE = 10;
export function failureRate(counts: { ok: number; failed: number }): { alert: boolean; share: number; total: number } {
  const total = counts.ok + counts.failed;
  const share = total ? counts.failed / total : 0;
  return { alert: total >= FAILURE_MIN_SAMPLE && share > FAILURE_SHARE, share, total };
}
