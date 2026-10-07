// deno-lint-ignore-file no-explicit-any
// runwareBalance.ts — the Runware balance guard (migration 20261023100000).
// checkRunwareGuard() is called before claiming a scene to draw: it reads the
// balance (Runware accountManagement/getDetails, data[0].balance.amount, cached
// BALANCE_CACHE_S), and below provider_balance_guard.threshold_usd it PAUSES —
// the caller leaves the scene queued (it waits, it never fails). The admin is
// emailed once per pause; drawing resumes by itself once topped up.
// A provider "insufficient balance" refusal also pauses at once (markOutOfBalance).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alertAdmin as sendAdminAlert } from "./adminAlert.ts";

export const BALANCE_CACHE_S = 60;
/** Words Runware uses when OUR account can't pay (same as the Fruit guard). */
export const OUT_OF_BALANCE = /insufficient|not enough (?:credit|balance|fund)|low balance|out of credit|payment.?required|credit balance|available balance/i;

export type GuardRow = { threshold_usd: number; balance_usd: number | null; checked_at: string | null; paused: boolean; paused_since: string | null; alerted_at: string | null };

/** Pure: what a fresh balance reading means. A failed reading keeps the last state (never pause on our own API hiccup). */
export function guardDecision(row: GuardRow, balance: number | null, now: string): { paused: boolean; pausedSince: string | null; alert: boolean; resumed: boolean } {
  if (balance == null || !Number.isFinite(balance)) return { paused: row.paused, pausedSince: row.paused_since, alert: false, resumed: false };
  const paused = balance < Number(row.threshold_usd);
  return { paused, pausedSince: paused ? row.paused_since ?? now : null, alert: paused && !row.paused, resumed: !paused && row.paused };
}
/** Pure: is the cached reading still fresh? */
export const isFresh = (checkedAt: string | null, now: string, cacheS = BALANCE_CACHE_S) => !!checkedAt && Date.parse(now) - Date.parse(checkedAt) < cacheS * 1000;

export async function readRunwareBalance(apiKey: string, baseUrl = `${(Deno.env.get("RUNWARE_BASE_URL") || "https://api.runware.ai").replace(/\/+$/, "")}/v1`): Promise<number | null> {
  try {
    const r = await fetch(baseUrl, {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ taskType: "accountManagement", taskUUID: crypto.randomUUID(), operation: "getDetails" }]),
      signal: AbortSignal.timeout(8000),
    });
    const j: any = await r.json().catch(() => null);
    const amount = Number(j?.data?.[0]?.balance?.amount ?? j?.data?.[0]?.balance);
    return Number.isFinite(amount) ? amount : null;
  } catch {
    return null;
  }
}

const alertAdmin = (subject: string, text: string) => sendAdminAlert(subject, text, "runware-guard");

/** Before drawing: { paused, balance }. Never throws (a guard failure must not stop drawing). */
export async function checkRunwareGuard(admin: SupabaseClient, now = new Date().toISOString()): Promise<{ paused: boolean; balance: number | null }> {
  try {
    const { data: row } = await admin.from("provider_balance_guard").select("*").eq("provider", "runware").maybeSingle();
    if (!row) return { paused: false, balance: null };
    if (isFresh(row.checked_at, now)) return { paused: row.paused, balance: row.balance_usd };
    const key = Deno.env.get("RUNWARE_API_KEY") ?? "";
    const balance = key ? await readRunwareBalance(key) : null;
    const d = guardDecision(row as GuardRow, balance, now);
    await admin.from("provider_balance_guard").update({
      balance_usd: balance ?? row.balance_usd, checked_at: now, paused: d.paused, paused_since: d.pausedSince,
      last_error: balance == null ? "balance read failed" : null, updated_at: now, ...(d.alert ? { alerted_at: now } : {}),
    }).eq("provider", "runware");
    if (d.alert) await alertAdmin(`Zyvo: Runware balance low ($${balance?.toFixed(2)}) — drawing paused`, `The Runware balance is $${balance?.toFixed(2)}, below the $${Number(row.threshold_usd).toFixed(2)} threshold, so Long Form scene drawing is paused. Queued scenes wait (nothing fails) and users see "Drawing is paused for a moment, your video continues automatically".\n\nTop up Runware (or turn on auto-reload in the Runware dashboard). Drawing resumes by itself within about a minute of the balance going back above $${Number(row.threshold_usd).toFixed(2)}.\n\nThreshold: update public.provider_balance_guard set threshold_usd = <usd> where provider = 'runware';`);
    if (d.resumed) console.log(`[runware-guard] resumed at $${balance}`);
    return { paused: d.paused, balance: balance ?? row.balance_usd };
  } catch (e) {
    console.error("[runware-guard]", String(e));
    return { paused: false, balance: null };
  }
}

/** A Runware "insufficient balance" refusal: pause now (the next check re-reads the balance after the cache window). */
export async function markOutOfBalance(admin: SupabaseClient, message: string, now = new Date().toISOString()) {
  const { data: row } = await admin.from("provider_balance_guard").select("paused, paused_since").eq("provider", "runware").maybeSingle();
  await admin.from("provider_balance_guard").update({ paused: true, paused_since: row?.paused_since ?? now, checked_at: now, last_error: message.slice(0, 300), updated_at: now, ...(row?.paused ? {} : { alerted_at: now }) }).eq("provider", "runware");
  if (!row?.paused) await alertAdmin("Zyvo: Runware refused a scene (out of balance) — drawing paused", `Runware refused a Long Form scene: ${message.slice(0, 300)}\n\nDrawing is paused; queued scenes wait and resume by themselves once the balance is topped up.`);
}
