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
// committed, keeping whatever was genuinely spent. "Finishes" today means
// the last real stage in the currently-reachable pipeline (Narration ready)
// — see NARRATION_IS_CURRENTLY_THE_LAST_REAL_STAGE below. Once a real
// "video complete" status exists (Visuals/Edit/Render are built — see the
// backend audit's Part 2, T8), settle from THAT status instead of
// Narration's, without needing to change anything in this file.
export async function settleReservationIfActive(
  admin: SupabaseClient,
  projectId: string,
  reason: string,
  logEvent?: (source: string, level: string, event: string, data: Record<string, unknown>) => Promise<void>
): Promise<ReservationOutcome> {
  const active = await findActiveReservation(admin, projectId);
  if (!active) return { found: false };
  const { data, error } = await admin.rpc("settle_long_form_reservation", {
    p_reservation_id: active.id,
    p_user_id: active.user_id,
  });
  if (error) {
    await logEvent?.("longFormReservations", "error", "settle_failed", { projectId, reservationId: active.id, reason, message: error.message });
    return { found: true, ok: false, error: error.message };
  }
  await logEvent?.("longFormReservations", "info", "reservation_settled", { projectId, reservationId: active.id, reason, refunded: active.reserved_credits - active.committed_credits });
  return { found: true, ok: true, reservation: data };
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

// Named per the comment above settleReservationIfActive — grep this symbol
// when Visuals/Edit/Render stop being a "proof screen" (see the backend
// audit's §8) to find the one settle call site that needs to move.
export const NARRATION_IS_CURRENTLY_THE_LAST_REAL_STAGE = true;
