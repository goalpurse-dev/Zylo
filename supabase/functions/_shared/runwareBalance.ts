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
// 2026-10-07: after the provider REFUSED us the pause is held this long before the balance is
// read again. On 6-7 Oct the balance read $5.54 (above the threshold) while Runware refused every
// draw ("reserved for requests in progress"), so the guard resumed every minute for six hours.
export const REFUSAL_HOLD_S = 300;
// One alert email per pause reason per hour at most (a long outage is not an email every 5 minutes).
export const ALERT_EVERY_S = 3600;
/** checked_at for a held pause: the guard treats the reading as fresh until the hold is over. */
export const heldUntil = (now: string, holdS = REFUSAL_HOLD_S) => new Date(Date.parse(now) + Math.max(0, holdS - BALANCE_CACHE_S) * 1000).toISOString();
export const mayAlert = (alertedAt: string | null | undefined, now: string) => !alertedAt || Date.parse(now) - Date.parse(alertedAt) >= ALERT_EVERY_S * 1000;
/** Words Runware uses when OUR account can't pay (same as the Fruit guard). */
export const OUT_OF_BALANCE = /insufficient|not enough (?:credit|balance|fund)|low balance|out of credit|payment.?required|credit balance|available balance/i;

export type GuardRow = { threshold_usd: number; balance_usd: number | null; checked_at: string | null; paused: boolean; paused_since: string | null; alerted_at: string | null };

/** Pure: what a fresh balance reading means. A failed reading keeps the last state (never pause on our own API hiccup).
 *  reserveUsd (2026-10-07): what the work already in flight will still cost. Runware holds that back
 *  ("reserved for requests in progress"), so the money that counts is the balance MINUS it: on 6-7 Oct
 *  the balance read $5.54, above the threshold, while every new request was refused. */
export function guardDecision(row: GuardRow, balance: number | null, now: string, reserveUsd = 0): { paused: boolean; pausedSince: string | null; alert: boolean; resumed: boolean } {
  if (balance == null || !Number.isFinite(balance)) return { paused: row.paused, pausedSince: row.paused_since, alert: false, resumed: false };
  const paused = balance - Math.max(0, reserveUsd) < Number(row.threshold_usd);
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

// What the provider work in flight will still cost, in USD (an estimate, on the safe side).
// A credit we charge costs us about half the cheapest credit we sell ($0.02133): prices are ~2 x cost.
export const PROVIDER_USD_PER_CREDIT = 0.0107;
export const SCENE_USD = 0.006;           // one Long Form scene: draw + checks + upscale
export function reserveFor(inFlight: { jobCredits: number; fruitCredits: number; scenes: number }): number {
  return Number((inFlight.jobCredits * PROVIDER_USD_PER_CREDIT + inFlight.fruitCredits * PROVIDER_USD_PER_CREDIT + inFlight.scenes * SCENE_USD).toFixed(4));
}
export async function inFlightReserveUsd(admin: SupabaseClient, now = new Date().toISOString()): Promise<{ usd: number; jobs: number; fruit: number; scenes: number }> {
  try {
    const [jobs, fruit, scenes] = await Promise.all([
      admin.from("jobs").select("charge_credits").in("status", ["running", "processing"]).gt("lease_expires_at", now).limit(300),
      admin.from("fruit_jobs").select("credits").in("status", ["submitting", "submitted"]).limit(300),
      admin.from("long_form_scene_images").select("id", { count: "exact", head: true }).eq("status", "rendering").gt("lease_until", now),
    ]);
    const sum = (rows: any[] | null, k: string) => (rows ?? []).reduce((a, r) => a + Number(r?.[k] ?? 0), 0);
    const inFlight = { jobCredits: sum(jobs.data as any, "charge_credits"), fruitCredits: sum(fruit.data as any, "credits"), scenes: scenes.count ?? 0 };
    return { usd: reserveFor(inFlight), jobs: (jobs.data ?? []).length, fruit: (fruit.data ?? []).length, scenes: inFlight.scenes };
  } catch {
    return { usd: 0, jobs: 0, fruit: 0, scenes: 0 };
  }
}

/** Before drawing: { paused, balance }. Never throws (a guard failure must not stop drawing). */
export async function checkRunwareGuard(admin: SupabaseClient, now = new Date().toISOString()): Promise<{ paused: boolean; balance: number | null }> {
  try {
    const { data: row } = await admin.from("provider_balance_guard").select("*").eq("provider", "runware").maybeSingle();
    if (!row) return { paused: false, balance: null };
    if (isFresh(row.checked_at, now)) return { paused: row.paused, balance: row.balance_usd };
    const key = Deno.env.get("RUNWARE_API_KEY") ?? "";
    const balance = key ? await readRunwareBalance(key) : null;
    const reserve = await inFlightReserveUsd(admin, now);
    const d = guardDecision(row as GuardRow, balance, now, reserve.usd);
    await admin.from("provider_balance_guard").update({
      balance_usd: balance ?? row.balance_usd, checked_at: now, paused: d.paused, paused_since: d.pausedSince,
      last_error: balance == null ? "balance read failed" : null, updated_at: now, ...(d.alert ? { alerted_at: now } : {}),
    }).eq("provider", "runware");
    if (d.alert) await alertAdmin(`Zyvo: Runware balance low ($${balance?.toFixed(2)}) — new work paused`, `The Runware balance is $${balance?.toFixed(2)} with about $${reserve.usd.toFixed(2)} already needed by work in flight (${reserve.jobs} jobs, ${reserve.fruit} Fruit jobs, ${reserve.scenes} scenes): less than the $${Number(row.threshold_usd).toFixed(2)} threshold is free, so new image and video work is paused (Long Form scenes, the image and video tools). Queued scenes wait (nothing fails) and users see "Drawing is paused for a moment, your video continues automatically".\n\nTop up Runware (or turn on auto-reload in the Runware dashboard). Drawing resumes by itself within about a minute of the balance going back above $${Number(row.threshold_usd).toFixed(2)}.\n\nThreshold: update public.provider_balance_guard set threshold_usd = <usd> where provider = 'runware';`);
    if (d.resumed) console.log(`[runware-guard] resumed at $${balance}`);
    return { paused: d.paused, balance: balance ?? row.balance_usd };
  } catch (e) {
    console.error("[runware-guard]", String(e));
    return { paused: false, balance: null };
  }
}

/** A Runware "insufficient balance" refusal: pause now (the next check re-reads the balance after the cache window). */
export async function markOutOfBalance(admin: SupabaseClient, message: string, now = new Date().toISOString()) {
  const { data: row } = await admin.from("provider_balance_guard").select("paused, paused_since, alerted_at").eq("provider", "runware").maybeSingle();
  const alert = !row?.paused && mayAlert(row?.alerted_at, now);
  await admin.from("provider_balance_guard").update({ paused: true, paused_since: row?.paused_since ?? now, checked_at: heldUntil(now), last_error: message.slice(0, 300), updated_at: now, ...(alert ? { alerted_at: now } : {}) }).eq("provider", "runware");
  if (alert) await alertAdmin("Zyvo: Runware refused a scene (out of balance) — drawing paused", `Runware refused a Long Form scene: ${message.slice(0, 300)}\n\nDrawing is paused; queued scenes wait and resume by themselves once the balance is topped up (it is checked again every 5 minutes).`);
}

/** The provider is DOWN (every step of a scene failed and no scene anywhere finished lately):
 *  drawing pauses for REFUSAL_HOLD_S, scenes wait in the queue, then it tries again by itself. */
export async function markProviderDown(admin: SupabaseClient, message: string, now = new Date().toISOString()) {
  const { data: row } = await admin.from("provider_balance_guard").select("paused, paused_since, alerted_at").eq("provider", "runware").maybeSingle();
  if (!row) return;
  const alert = mayAlert(row.alerted_at, now);
  await admin.from("provider_balance_guard").update({ paused: true, paused_since: row.paused_since ?? now, checked_at: heldUntil(now), last_error: `outage: ${message}`.slice(0, 300), updated_at: now, ...(alert ? { alerted_at: now } : {}) }).eq("provider", "runware");
  if (alert) await alertAdmin("Zyvo: Runware is failing every scene — drawing paused", `Every step of a Long Form scene failed (retries, safe prompt, backup model) and no scene has finished in the last few minutes, so this looks like a Runware outage, not one bad scene.\n\nLast error: ${message.slice(0, 300)}\n\nDrawing is paused for 5 minutes at a time and tries again by itself. Scenes wait in the queue (nothing fails, nothing is charged twice). Users see "Drawing is paused for a moment, your video continues automatically".`);
}
