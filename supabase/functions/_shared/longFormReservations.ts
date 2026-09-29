// Phase 0, Section B — the one place every stage/caller reaches to
// release/settle/commit against a project's credit reservation
// (long_form_project_reservations, supabase/migrations/20261002120000_...).
// Centralized so every call site gets the exact same idempotent lookup
// pattern rather than re-deriving it (and risking a subtly different one)
// at each of the several places this needs wiring.
//
// Both release/settleReservationIfActive are safe to call from more than
// one place for the same project, and safe under concurrent/duplicate
// invocation (cron re-runs, a retried request): they first look up the
// CURRENTLY 'reserved' row (there can be at most one, by the table's own
// partial unique index) and do nothing if none exists; the underlying RPCs
// (release_long_form_reservation/settle_long_form_reservation) are
// themselves idempotent — calling either on an already-settled/released
// reservation just returns it unchanged, never refunding twice.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type ReservationOutcome =
  | { found: false }
  | { found: true; ok: true; reservation: Record<string, unknown> }
  | { found: true; ok: false; error: string };

async function findActiveReservation(admin: SupabaseClient, projectId: string) {
  const { data, error } = await admin
    .from("long_form_project_reservations")
    .select("id, user_id, reserved_credits, committed_credits")
    .eq("project_id", projectId)
    .eq("status", "reserved")
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// Call when a project ends WITHOUT having produced any committed work —
// deleted before any paid stage ran, or a stage failed terminally with
// nothing yet committed against the reservation. Refunds reserved -
// committed in full (normally the full amount, since nothing committed).
export async function releaseReservationIfActive(
  admin: SupabaseClient,
  projectId: string,
  reason: string,
  logEvent?: (source: string, level: string, event: string, data: Record<string, unknown>) => Promise<void>
): Promise<ReservationOutcome> {
  const active = await findActiveReservation(admin, projectId);
  if (!active) return { found: false };
  // Phase 6a: while a Stickman autopilot is running, a stage failure is NOT
  // terminal — the autopilot re-runs it from its checkpoint (the 6a check
  // saw a draft failure release 366 credits 2 s before the retry succeeded).
  // Only deleting the project releases then; a finally-failed autopilot keeps
  // the reservation for its free Retry.
  if (reason !== "project_deleted") {
    const { data: p } = await admin.from("long_form_projects").select("autopilot").eq("id", projectId).maybeSingle();
    if ((p as any)?.autopilot?.status === "running" || (p as any)?.autopilot?.status === "failed") {
      await logEvent?.("longFormReservations", "info", "release_deferred_autopilot", { projectId, reservationId: active.id, reason });
      return { found: true, ok: true, reservation: { deferred: true } };
    }
  }
  const { data, error } = await admin.rpc("release_long_form_reservation", {
    p_reservation_id: active.id,
    p_user_id: active.user_id,
  });
  if (error) {
    await logEvent?.("longFormReservations", "error", "release_failed", { projectId, reservationId: active.id, reason, message: error.message });
    return { found: true, ok: false, error: error.message };
  }
  await logEvent?.("longFormReservations", "info", "reservation_released", { projectId, reservationId: active.id, reason, refunded: active.reserved_credits - active.committed_credits });
  return { found: true, ok: true, reservation: data };
}

// Call at the point a project's paid work FINISHES — refunds reserved -
// committed, keeping whatever was genuinely spent. Phase 5b: "finishes" is
// the final render completing (the video exists) — see
// RENDER_IS_THE_LAST_REAL_STAGE and renderBillingDecision below; narration
// no longer settles.
export async function settleReservationIfActive(
  admin: SupabaseClient,
  projectId: string,
  reason: string,
  logEvent?: (source: string, level: string, event: string, data: Record<string, unknown>) => Promise<void>,
  // Phase 7 fixed quote: `full` commits the WHOLE reservation (render completion);
  // otherwise only what was committed is kept and the rest refunded (idle settle).
  opts: { full?: boolean } = {}
): Promise<ReservationOutcome> {
  const active = await findActiveReservation(admin, projectId);
  if (!active) return { found: false };
  const { data, error } = await admin.rpc(opts.full ? "settle_long_form_reservation_full" : "settle_long_form_reservation", {
    p_reservation_id: active.id,
    p_user_id: active.user_id,
  });
  if (error) {
    await logEvent?.("longFormReservations", "error", "settle_failed", { projectId, reservationId: active.id, reason, message: error.message });
    return { found: true, ok: false, error: error.message };
  }
  await logEvent?.("longFormReservations", "info", "reservation_settled", { projectId, reservationId: active.id, reason, full: !!opts.full, charged: opts.full ? active.reserved_credits : active.committed_credits, refunded: opts.full ? 0 : active.reserved_credits - active.committed_credits });
  return { found: true, ok: true, reservation: data };
}

// Phase 6c safety rule: with the settle moved to render (LONG_FORM_SETTLE_AT_RENDER),
// a project that is abandoned before rendering would hold its credits forever.
// An active reservation with no activity for RESERVATION_IDLE_SETTLE_DAYS is
// auto-settled by the cron (keeps what was spent, refunds the rest). Deleting
// a project still releases it (delete-long-form-project, "project_deleted").
export const RESERVATION_IDLE_SETTLE_DAYS = 7;
export function lastActivityAt(times: (string | null | undefined)[]): string | null {
  const ms = times.map((t) => (t ? Date.parse(t) : NaN)).filter(Number.isFinite);
  return ms.length ? new Date(Math.max(...ms)).toISOString() : null;
}
export function isReservationIdle(lastActivity: string | null, now: string, days = RESERVATION_IDLE_SETTLE_DAYS): boolean {
  if (!lastActivity) return false;
  return Date.parse(now) - Date.parse(lastActivity) >= days * 86_400_000;
}

// Cron: settle every active reservation whose project has been idle for 7 days.
// Activity = the newest of: reservation created, project updated, autopilot
// heartbeat, any cost-ledger row. A running autopilot is never idle.
export async function settleIdleReservations(
  admin: SupabaseClient,
  now = new Date().toISOString(),
  logEvent?: (source: string, level: string, event: string, data: Record<string, unknown>) => Promise<void>,
): Promise<{ checked: number; settled: string[] }> {
  const cutoff = new Date(Date.parse(now) - RESERVATION_IDLE_SETTLE_DAYS * 86_400_000).toISOString();
  const { data: rows } = await admin.from("long_form_project_reservations").select("id, project_id, created_at").eq("status", "reserved").lt("created_at", cutoff).limit(50);
  const settled: string[] = [];
  for (const r of rows ?? []) {
    const { data: p } = await admin.from("long_form_projects").select("updated_at, autopilot").eq("id", (r as any).project_id).maybeSingle();
    if ((p as any)?.autopilot?.status === "running") continue;
    const { data: ledger } = await admin.from("long_form_cost_ledger").select("created_at").eq("project_id", (r as any).project_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const last = lastActivityAt([(r as any).created_at, (p as any)?.updated_at, (p as any)?.autopilot?.heartbeatAt, (ledger as any)?.created_at]);
    if (!isReservationIdle(last, now)) continue;
    const out = await settleReservationIfActive(admin, (r as any).project_id, "idle_7_days", logEvent);
    if (out.found && out.ok) settled.push((r as any).project_id);
  }
  return { checked: rows?.length ?? 0, settled };
}

// Draws down against an active reservation for a per-operation charge
// (scene Retry/Edit). Returns "COMMITTED" if it drew from the reservation,
// "NO_RESERVATION" if there is none (caller must fall back to a direct
// balance debit — and SHOULD log that fallback, since it means real money
// is moving outside the quoted ceiling), or throws on
// RESERVATION_CEILING_EXCEEDED (a real Postgres exception — never silently
// swallowed, since exceeding the ceiling is exactly the case the user must
// be asked to authorize more credit for, not have it silently charged).
export async function commitReservationSpend(admin: SupabaseClient, projectId: string, amount: number): Promise<"COMMITTED" | "NO_RESERVATION"> {
  const { data, error } = await admin.rpc("commit_long_form_reservation_spend", { p_project_id: projectId, p_amount: amount });
  if (error) throw error;
  return data as "COMMITTED" | "NO_RESERVATION";
}

// Phase 5b: the settle moved from narration-ready to render completion
// (finish-long-form-render). Grep this symbol to find the one settle site.
export const RENDER_IS_THE_LAST_REAL_STAGE = true;

// What a render outcome does to the project's reservation (pure, tested).
// Phase 7 FIXED QUOTE: nothing is committed before completion, so:
//   done   -> settle the FULL quote (exactly what the user was shown, never more or less)
//   failed -> keep (the render is retried free; the edit and scenes are intact —
//             a project abandoned after that is released by the 7-day idle settle,
//             a deleted one by delete-long-form-project)
export type RenderBilling = "settle" | "release" | "keep";
export function renderBillingDecision(outcome: "done" | "failed", _terminal: boolean, reservation: { committed_credits: number } | null): RenderBilling {
  if (!reservation) return "keep";
  return outcome === "done" ? "settle" : "keep";
}

export async function applyRenderBilling(
  admin: SupabaseClient,
  projectId: string,
  outcome: "done" | "failed",
  terminal: boolean,
  logEvent?: (source: string, level: string, event: string, data: Record<string, unknown>) => Promise<void>
): Promise<{ decision: RenderBilling; result?: ReservationOutcome }> {
  const decision = renderBillingDecision(outcome, terminal, await findActiveReservation(admin, projectId));
  if (decision === "settle") return { decision, result: await settleReservationIfActive(admin, projectId, "render_complete", logEvent, { full: true }) };
  if (decision === "release") return { decision, result: await releaseReservationIfActive(admin, projectId, "render_failed_before_spend", logEvent) };
  return { decision };
}
