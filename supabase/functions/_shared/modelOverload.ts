// deno-lint-ignore-file no-explicit-any
// _shared/modelOverload.ts — "serviceOverloaded" from the provider (2026-10-08).
//
// 7 Oct 2026, 17:24:27 UTC: Runware answered ten idea-thumbnail requests in the
// same second with serviceOverloaded ("temporarily unavailable due to high
// demand", retryAfter 60). All ten were sent at once, all ten failed at once,
// none was tried again; the user (two minutes old) never came back.
//
// An overloaded model is not a failed picture. The rules:
//   - the provider's own retryAfter is read and waited (+ 0-15 s jitter); an
//     overload wait is never one of a job's normal retries;
//   - a CIRCUIT BREAKER per model: one overload answer pauses ALL new requests
//     to that model until then (they wait in the queue), and it resumes
//     gradually: 1 request at a time, then 2, then normal;
//   - a batch never has more than BATCH_MAX_PER_MODEL (2) requests in flight
//     to one model for one user;
//   - a model overloaded for more than 5 minutes: new requests go to its backup
//     model and the owner is emailed;
//   - the user reads HIGH_DEMAND_COPY while waiting, never an error. Nothing is
//     charged before the image exists (images are charged on success).
// The pure rules are tested offline; the state is one row per model in
// provider_balance_guard ("overload:<model>"), so no new table.
export const OVERLOAD_DEFAULT_RETRY_S = 60;
export const OVERLOAD_MAX_RETRY_S = 300;
export const OVERLOAD_JITTER_S = 15;
export const OVERLOAD_SWITCH_AFTER_S = 300;       // overloaded this long -> the backup model
export const OVERLOAD_GIVE_UP_S = 30 * 60;        // one job waiting this long (no backup) ends, uncharged
export const RAMP_RECHECK_S = 5;
export const HIGH_DEMAND_COPY = "High demand, continuing in a moment.";
export const HIGH_DEMAND_ENDED_COPY = "High demand right now, so nothing was charged. Please try again in a few minutes.";
const envInt = (name: string, def: number) => { try { const v = Number((globalThis as any).Deno?.env?.get(name)); return Number.isFinite(v) && v > 0 ? Math.floor(v) : def; } catch { return def; } };
export const BATCH_MAX_PER_MODEL = envInt("RUNWARE_BATCH_MAX_PER_MODEL", 2);

// Backup image models. Long Form scenes: V2 (FLUX.2 klein 9B) <-> V3 (Nano Banana 2 Lite), through the
// scene worker's own tiers. The shared image pipeline: the FLUX.2 klein pair, whose request shape is
// the same there (a V3 request has never run through that pipeline, so it is not sent blind).
export const OVERLOAD_BACKUP_MODEL: Record<string, string> = { "runware:400@6": "runware:400@4", "runware:400@4": "runware:400@6" };

// Is this provider answer an overload, and how long does it ask us to wait?
export function parseOverload(status: number, payload: unknown, retryAfterHeader: string | null = null): { overloaded: boolean; retryAfterS: number } {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload ?? "");
  const overloaded = /serviceOverloaded|service.?overload|overloaded|temporarily unavailable|high demand|at capacity|too many requests/i.test(text) || status === 429 || status === 503;
  const first = (payload as any)?.errors?.[0] ?? (Array.isArray(payload) ? (payload as any)[0] : payload);
  const found = [Number((first as any)?.retryAfter), Number((payload as any)?.retryAfter), Number(/"?retry[_-]?after"?\s*[:=]\s*"?(\d+(?:\.\d+)?)/i.exec(text)?.[1]), Number(retryAfterHeader)].find((n) => Number.isFinite(n) && n > 0);
  return { overloaded, retryAfterS: Math.min(OVERLOAD_MAX_RETRY_S, Math.max(1, Math.round(found ?? OVERLOAD_DEFAULT_RETRY_S))) };
}
export const waitWithJitter = (retryAfterS: number, rand: () => number = Math.random) => retryAfterS + Math.round(rand() * OVERLOAD_JITTER_S);

// ---------------- the breaker (pure) ----------------
// until: no new request before this. since: when this run of overloads began (cleared by the first
// success). ramp: 0 normal, 1 one request at a time, 2 two at a time.
export type Breaker = { until: string | null; since: string | null; ramp: 0 | 1 | 2 };
export const CLOSED: Breaker = { until: null, since: null, ramp: 0 };

export function onOverload(b: Breaker, retryAfterS: number, nowMs: number, rand: () => number = Math.random): Breaker {
  const until = nowMs + waitWithJitter(retryAfterS, rand) * 1000;
  // Several requests refused in the same second all report: the longest wait wins.
  return { until: new Date(Math.max(until, b.until ? Date.parse(b.until) : 0)).toISOString(), since: b.since ?? new Date(nowMs).toISOString(), ramp: 1 };
}
export function onSuccess(b: Breaker): Breaker {
  if (b.ramp === 1) return { until: null, since: null, ramp: 2 };
  return CLOSED;
}
// ahead: requests to this model already in flight before this one.
export function gate(b: Breaker, nowMs: number, ahead: number): { allow: true } | { allow: false; waitS: number; why: "paused" | "ramp" } {
  if (b.until && nowMs < Date.parse(b.until)) return { allow: false, waitS: Math.max(1, Math.ceil((Date.parse(b.until) - nowMs) / 1000)), why: "paused" };
  if (b.ramp > 0 && ahead >= b.ramp) return { allow: false, waitS: RAMP_RECHECK_S, why: "ramp" };
  return { allow: true };
}
export const overloadedTooLong = (b: Breaker, nowMs: number) => !!b.since && nowMs - Date.parse(b.since) > OVERLOAD_SWITCH_AFTER_S * 1000;
// One user's batch: at most `max` requests to one model at a time.
export const overBatchCap = (ahead: number, max = BATCH_MAX_PER_MODEL) => ahead >= max;

// ---------------- the breaker's row ----------------
const key = (model: string) => `overload:${model}`;
export async function readBreaker(admin: any, model: string): Promise<Breaker> {
  try {
    const { data: row } = await admin.from("provider_balance_guard").select("checked_at, paused_since, balance_usd, paused").eq("provider", key(model)).maybeSingle();
    if (!row || !row.paused) return CLOSED;
    const ramp = Number(row.balance_usd ?? 0);
    return { until: row.checked_at ?? null, since: row.paused_since ?? null, ramp: ramp === 1 || ramp === 2 ? ramp : 0 };
  } catch { return CLOSED; }
}
export async function writeBreaker(admin: any, model: string, b: Breaker, lastError: string | null = null): Promise<void> {
  try {
    const now = new Date().toISOString();
    const open = b.ramp > 0 || !!b.until;
    await admin.from("provider_balance_guard").upsert({ provider: key(model), paused: open, checked_at: b.until, paused_since: b.since, balance_usd: b.ramp, updated_at: now, ...(lastError ? { last_error: lastError.slice(0, 300) } : {}) }, { onConflict: "provider" });
  } catch (e) { console.error("[model-overload] write", String(e)); }
}
export async function recordOverload(admin: any, model: string, retryAfterS: number, message: string): Promise<Breaker> {
  const next = onOverload(await readBreaker(admin, model), retryAfterS, Date.now());
  await writeBreaker(admin, model, next, message);
  return next;
}
export async function recordSuccess(admin: any, model: string): Promise<void> {
  const b = await readBreaker(admin, model);
  if (b.ramp === 0 && !b.until) return;
  if (b.until && Date.now() < Date.parse(b.until)) return; // a request sent before the pause finished: says nothing about now
  await writeBreaker(admin, model, onSuccess(b));
}
