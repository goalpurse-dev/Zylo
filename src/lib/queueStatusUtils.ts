/**
 * Shared status computation for generation jobs and queue rows.
 * Used by all generation UIs to show real provider state
 * instead of fake local progress.
 */

export type StatusTone =
  | "queued"
  | "processing"
  | "retrying"
  | "completed"
  | "failed"
  | "cancelled";

export interface DisplayStatus {
  label:    string;   // Primary label shown on card
  subLabel: string;   // Secondary detail shown below
  progress: number;   // 0-100
  tone:     StatusTone;
}

/* ─── From generation_queue rows ─── */

export interface QueueJobSummary {
  id:         string;
  status:     string;
  task_type?: string;
  attempts?:  number;
  retry_after?: string | null;
}

export function getCreationDisplayStatus(queueJobs?: QueueJobSummary[] | null): DisplayStatus {
  if (!queueJobs || queueJobs.length === 0) {
    return {
      label:    "Generating",
      subLabel: "Starting up…",
      progress: 5,
      tone:     "processing",
    };
  }

  const total      = queueJobs.length;
  const completed  = queueJobs.filter(j => j.status === "completed").length;
  const failed     = queueJobs.filter(j => j.status === "failed").length;
  const cancelled  = queueJobs.filter(j => j.status === "cancelled").length;
  const processing = queueJobs.filter(j => j.status === "processing").length;
  const retrying   = queueJobs.filter(
    j => j.status === "queued" && Number(j.attempts ?? 0) > 0
  ).length;
  const queued     = queueJobs.filter(
    j => j.status === "queued" && Number(j.attempts ?? 0) === 0
  ).length;

  const progress = Math.max(5, Math.round((completed / total) * 100));

  if (completed === total) {
    return { label: "Completed", subLabel: "Ready", progress: 100, tone: "completed" };
  }

  if (cancelled > 0 && completed + failed + cancelled === total) {
    return { label: "Cancelled", subLabel: "Generation was cancelled", progress, tone: "cancelled" };
  }

  if (failed > 0 && completed + failed === total) {
    return {
      label:    "Failed",
      subLabel: "Credits refunded if provider failed",
      progress,
      tone:     "failed",
    };
  }

  if (retrying > 0) {
    return {
      label:    "Provider busy",
      subLabel: "Retrying automatically — no charge",
      progress,
      tone:     "retrying",
    };
  }

  const imagesDone  = queueJobs.filter(j => j.task_type === "image" && j.status === "completed").length;
  const videosDone  = queueJobs.filter(j => j.task_type === "video" && j.status === "completed").length;
  const videosTotal = queueJobs.filter(j => j.task_type === "video").length;

  if (processing > 0) {
    if (videosTotal > 0 && videosDone < videosTotal && imagesDone > 0) {
      return {
        label:    "Animating scenes",
        subLabel: `${videosDone}/${videosTotal} videos done`,
        progress,
        tone:     "processing",
      };
    }
    return {
      label:    "Generating",
      subLabel: `${completed}/${total} done`,
      progress,
      tone:     "processing",
    };
  }

  if (queued > 0) {
    return {
      label:    "Queued",
      subLabel: "Waiting for generation slot",
      progress: Math.max(5, progress),
      tone:     "queued",
    };
  }

  return {
    label:    "Generating",
    subLabel: `${completed}/${total} done`,
    progress,
    tone:     "processing",
  };
}

/* ─── From a single jobs table row ─── */

export interface JobRowSummary {
  status:      string;
  progress?:   number | null;
  attempts?:   number | null;
  retry_after?: string | null;
}

export function getJobDisplayStatus(job: JobRowSummary): DisplayStatus {
  const attempts = Number(job.attempts ?? 0);
  const progress = Math.min(99, Math.max(0, Math.floor(Number(job.progress ?? 0))));

  // Queued with retry attempts = provider was busy, retrying
  if (job.status === "queued" && attempts > 0) {
    return {
      label:    "Provider busy",
      subLabel: "Retrying automatically",
      progress: Math.min(progress, 10),
      tone:     "retrying",
    };
  }

  if (job.status === "queued") {
    return {
      label:    "Queued",
      subLabel: "Waiting for generation slot",
      progress: Math.min(progress, 10),
      tone:     "queued",
    };
  }

  if (job.status === "running" || job.status === "processing") {
    const label =
      progress < 35 ? "Generating"  :
      progress < 75 ? "Rendering"   :
      progress < 95 ? "Finalizing"  :
                      "Almost done" ;
    return { label, subLabel: `${progress}% complete`, progress, tone: "processing" };
  }

  if (job.status === "succeeded") {
    return { label: "Completed", subLabel: "Ready", progress: 100, tone: "completed" };
  }

  if (job.status === "failed" || job.status === "canceled" || job.status === "cancelled") {
    return { label: "Failed", subLabel: "Generation failed", progress, tone: "failed" };
  }

  // Default — something queued/pending
  return {
    label:    "Queued",
    subLabel: "Starting up…",
    progress: Math.min(progress, 10),
    tone:     "queued",
  };
}

/* ─── Colour tokens per tone ─── */

export const TONE_COLORS: Record<StatusTone, { text: string; bg: string; border: string; dot: string }> = {
  queued:     { text: "text-white/50",    bg: "bg-white/[0.05]",     border: "border-white/10",        dot: "bg-white/30"    },
  processing: { text: "text-blue-300",    bg: "bg-blue-500/10",      border: "border-blue-400/25",     dot: "bg-blue-400"    },
  retrying:   { text: "text-amber-300",   bg: "bg-amber-500/10",     border: "border-amber-400/25",    dot: "bg-amber-400"   },
  completed:  { text: "text-green-300",   bg: "bg-green-500/10",     border: "border-green-400/25",    dot: "bg-green-400"   },
  failed:     { text: "text-red-300",     bg: "bg-red-500/10",       border: "border-red-400/25",      dot: "bg-red-400"     },
  cancelled:  { text: "text-white/30",    bg: "bg-white/[0.03]",     border: "border-white/[0.06]",    dot: "bg-white/20"    },
};

/* ─── Quick helper: is this status still active (should we poll?) ─── */
export function isActiveStatus(tone: StatusTone): boolean {
  return tone === "queued" || tone === "processing" || tone === "retrying";
}
