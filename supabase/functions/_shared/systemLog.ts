// supabase/functions/_shared/systemLog.ts
//
// Shared error/event logger for the generation pipeline. Every edge function
// that touches a `jobs` row (job-worker, runware-video, runware-image,
// queue-worker) should route its console.log/warn/error calls through this
// so the same event also lands in public.system_logs — queryable from one
// table instead of grepping per-function logs in the dashboard.
//
// Never throws: a logging failure must never take down the generation job
// it's trying to describe.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  "";

let cachedClient: ReturnType<typeof createClient> | null = null;

function getLogClient(): ReturnType<typeof createClient> | null {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });
  }
  return cachedClient;
}

export type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  jobId?: string | null;
  userId?: string | null;
  toolKey?: string | null;
  message?: string | null;
  [key: string]: unknown;
}

/**
 * Console-logs `event` with an icon prefix (unchanged behaviour callers
 * already depend on) AND inserts one row into public.system_logs.
 * `source` should be the function name, e.g. "runware-video".
 */
export async function logEvent(
  source: string,
  level: LogLevel,
  event: string,
  ctx: LogContext = {},
): Promise<void> {
  const icon = level === "error" ? "🔴" : level === "warn" ? "🟠" : "🟢";
  const line = `${icon} [${source}] ${event}`;
  const detail = JSON.stringify({ ts: new Date().toISOString(), ...ctx });

  if (level === "error") console.error(line, detail);
  else if (level === "warn") console.warn(line, detail);
  else console.log(line, detail);

  const sb = getLogClient();
  if (!sb) return;

  const { jobId, userId, toolKey, message, ...details } = ctx;

  try {
    const { error } = await sb.from("system_logs").insert({
      source,
      level,
      event,
      job_id: jobId ?? null,
      user_id: userId ?? null,
      tool_key: toolKey ?? null,
      message: message ?? null,
      details,
    });
    if (error) {
      console.error(`[systemLog] insert failed for ${source}/${event}:`, error.message);
    }
  } catch (e) {
    console.error(`[systemLog] insert threw for ${source}/${event}:`, String((e as any)?.message ?? e));
  }
}
