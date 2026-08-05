import { supabase } from "./supabaseClient";
import { getPlanPriority } from "./queuePriority";
import { cleanupUploadedReferences, normalizeReferencePayload } from "./referenceImages";

/* ─── Types ─── */

export type QueueTaskType = "image" | "video";

export type QueueStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface GenerationQueueRow {
  id:                   string;
  user_id:              string;
  parent_generation_id: string | null;
  provider:             string;
  model:                string;
  task_type:            QueueTaskType;
  payload:              Record<string, any>;
  status:               QueueStatus;
  plan_code:            string;
  priority:             number;
  job_id:               string | null;
  result:               Record<string, any> | null;
  error:                Record<string, any> | null;
  attempts:             number;
  max_attempts:         number;
  retry_after:          string;
  started_at:           string | null;
  completed_at:         string | null;
  failed_at:            string | null;
  created_at:           string;
  updated_at:           string;
}

export interface QueueJobInput {
  userId:               string;
  parentGenerationId?:  string;
  provider?:            string;
  model:                string;
  taskType:             QueueTaskType;
  payload:              Record<string, any>;
  planCode:             string;
}

/* ─── Create ─── */

export async function createGenerationQueueJob(
  job: QueueJobInput
): Promise<GenerationQueueRow> {
  if (!String(job.payload?.prompt ?? "").trim()) throw new Error("MISSING_PROMPT");
  const input = job.payload?.input ?? {};
  if (!(Number(input.width) > 0 && Number(input.height) > 0) && !input.resolution && !job.payload?.settings?.size) {
    throw new Error("MISSING_DIMENSIONS");
  }
  const priority = getPlanPriority(job.planCode);
  const queueId = crypto.randomUUID();
  const normalized = await normalizeReferencePayload(job.payload, {
    userId: job.userId,
    jobId: queueId,
  });

  const { data, error } = await supabase
    .from("generation_queue")
    .insert({
      id:                   queueId,
      user_id:              job.userId,
      parent_generation_id: job.parentGenerationId ?? null,
      provider:             job.provider ?? "runware",
      model:                job.model,
      task_type:            job.taskType,
      payload:              normalized.value,
      plan_code:            job.planCode ?? "free",
      priority,
      status:               "queued",
      retry_after:          new Date().toISOString(),
      attempts:             0,
      max_attempts:         5,
    })
    .select()
    .single();

  if (error) {
    await cleanupUploadedReferences(normalized.uploads);
    throw error;
  }
  return data as GenerationQueueRow;
}

/* ─── Read ─── */

export async function getQueueJob(id: string): Promise<GenerationQueueRow> {
  const { data, error } = await supabase
    .from("generation_queue")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as GenerationQueueRow;
}

export async function getQueueJobsByParent(
  parentGenerationId: string
): Promise<GenerationQueueRow[]> {
  const { data, error } = await supabase
    .from("generation_queue")
    .select("id, task_type, model, status, priority, attempts, job_id, created_at, started_at, completed_at, failed_at")
    .eq("parent_generation_id", parentGenerationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GenerationQueueRow[];
}

/* ─── Retry helpers ─── */

/**
 * Runware sometimes returns 402 insufficientCredits when the real cause
 * is a concurrency / rate-limit guard — not an empty balance.
 * These errors MUST be retried; do not mark the job as failed.
 */
export function isRunwareRetryableConcurrencyError(error: any): boolean {
  const rawErrors: any[] = Array.isArray(error?.errors)
    ? error.errors
    : Array.isArray(error)
    ? error
    : [];

  return rawErrors.some((e: any) => {
    const code    = String(e?.code    ?? "").toLowerCase();
    const message = String(e?.message ?? "").toLowerCase();
    return (
      code    === "insufficientcredits" ||
      message.includes("insufficient credits") ||
      message.includes("concurrency") ||
      message.includes("rate limit") ||
      message.includes("too many requests")
    );
  });
}

/** Exponential back-off delays (ms) indexed by attempt number (0-based) */
export function getRetryDelayMs(attempts: number): number {
  const delays = [30_000, 90_000, 180_000, 420_000, 900_000];
  return delays[Math.min(attempts, delays.length - 1)];
}

/* ─── Status helpers ─── */

export function isQueueJobTerminal(status: QueueStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function getQueueProgressLabel(status: QueueStatus): string {
  if (status === "queued")     return "Queued";
  if (status === "processing") return "Generating";
  if (status === "completed")  return "Completed";
  if (status === "failed")     return "Failed";
  if (status === "cancelled")  return "Cancelled";
  return "Queued";
}

/* ─── Poll helper ─── */

export function watchQueueJob(
  id: string,
  onChange: (row: GenerationQueueRow) => void,
  pollMs = 2500
): () => void {
  let stopped = false;

  // Realtime subscription
  const channel = supabase
    .channel(`gq-${id}`)
    .on(
      "postgres_changes" as any,
      {
        event:  "UPDATE",
        schema: "public",
        table:  "generation_queue",
        filter: `id=eq.${id}`,
      },
      (payload: any) => {
        if (!stopped) onChange(payload.new as GenerationQueueRow);
      }
    )
    .subscribe();

  // Polling fallback
  (async () => {
    while (!stopped) {
      await new Promise((r) => setTimeout(r, pollMs));
      if (stopped) break;
      try {
        const row = await getQueueJob(id);
        if (!stopped) onChange(row);
        if (isQueueJobTerminal(row.status)) break;
      } catch { /* ignore transient errors */ }
    }
  })();

  return () => {
    stopped = true;
    supabase.removeChannel(channel);
  };
}

/* ─── Trigger queue-worker ─── */

export async function triggerQueueWorker(): Promise<void> {
  try {
    await supabase.functions.invoke("queue-worker", { body: {} });
  } catch {
    // Best-effort — queue-worker runs on cron too
  }
}
