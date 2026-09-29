// deno-lint-ignore-file no-explicit-any
// stickman/addons.ts — Phase 7: paid add-ons (scene regenerate / split,
// thumbnail regenerate, 1440p, voice re-record) are charged at CLICK time from
// the balance (deduct_credits: never below 0), never from the video's
// reservation, and refunded exactly if the work then fails.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const NOT_ENOUGH_CREDITS = "Not enough credits — Add credits";

// 1440p: 2 credits per started minute, at least 10 — free on V4 (a perk).
export const RENDER_1440P_CREDITS_PER_MIN = 2, RENDER_1440P_MIN_CREDITS = 10;
export function render1440Credits(tier: string, durationMs: number): number {
  if (String(tier).toUpperCase() === "V4") return 0;
  return Math.max(RENDER_1440P_MIN_CREDITS, Math.ceil((Number(durationMs) || 0) / 60000) * RENDER_1440P_CREDITS_PER_MIN);
}
// Voice re-record after the included one: 4 credits per started minute.
export const VOICE_RERECORD_CREDITS_PER_MIN = 4;
export const voiceRerecordCredits = (durationMs: number) => Math.max(VOICE_RERECORD_CREDITS_PER_MIN, Math.ceil((Number(durationMs) || 0) / 60000) * VOICE_RERECORD_CREDITS_PER_MIN);

export type AddonCharge = { ok: true; charged: number } | { ok: false; status: 402 | 500; message: string };
export async function chargeAddon(admin: SupabaseClient, userId: string, credits: number, reason: string, logEvent?: (s: string, l: string, e: string, d: any) => Promise<void>, meta: Record<string, unknown> = {}): Promise<AddonCharge> {
  if (!credits) return { ok: true, charged: 0 };
  const { error } = await admin.rpc("deduct_credits", { uid: userId, amount: credits });
  if (error) {
    const short = /INSUFFICIENT/i.test(error.message);
    await logEvent?.("addons", short ? "info" : "error", short ? "addon_insufficient_credits" : "addon_charge_failed", { reason, credits, message: error.message, ...meta });
    return short ? { ok: false, status: 402, message: NOT_ENOUGH_CREDITS } : { ok: false, status: 500, message: "Couldn't charge the credits. Try again." };
  }
  await logEvent?.("addons", "info", "addon_charged", { reason, credits, ...meta });
  return { ok: true, charged: credits };
}
export async function refundAddon(admin: SupabaseClient, userId: string, credits: number, reason: string, logEvent?: (s: string, l: string, e: string, d: any) => Promise<void>, meta: Record<string, unknown> = {}) {
  if (!credits) return;
  const { error } = await admin.rpc("deduct_credits", { uid: userId, amount: -credits });
  await logEvent?.("addons", error ? "error" : "info", error ? "addon_refund_failed" : "addon_refunded", { reason, credits, message: error?.message ?? null, ...meta });
}
