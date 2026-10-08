// Blocky Stories' spending safety (owner, 2026-10-08). There is no global cap on normal use; instead:
//
//   1. A cap per user: USER_DAILY_USD of OUR real cost per user per day (from 00:00 UTC). A step that would
//      pass it is refused BEFORE anything is charged, with a clear message.
//   2. A bug alarm: when what we spent at providers runs ahead of what users were charged (the last 24
//      hours), paid calls are switched off, an alert row is written and the admin is emailed. A healthy day
//      looks the other way round: users are charged about twice what we spend.
//   3. A retry alert: a job that was sent more often than the engine ever means to.
//
// What counts as "spent": every logged call with a user on it (blocky_ai_calls). The owner's own test
// scripts log without a user, or under a test purpose, and are left out. What counts as "charged": the
// credit ledger, charges minus refunds, at the credit's value (pricing.js#BASIS).
// The alarm's numbers and switches live in Blocky's own tables (blocky_provider_alerts, blocky_settings).
import { BASIS, PICTURE, tierGuardPerSec } from "./pricing.js";

/** Our real cost one user may cause in a day. */
export const USER_DAILY_USD = 20;
/** The alarm: spend this far ahead of what users were charged, over the last 24 hours. */
export const AHEAD_ALARM_USD = 10;
/** The engine sends a job at most a handful of times (three tries, a fallback or two, one remake). */
export const MAX_JOB_ATTEMPTS = 6;
export const WATCH_HOURS = 24;
/** The alert rows (blocky_provider_alerts.provider): never a real provider's name. */
export const SPEND_ALERT = "blocky:spend";
export const RETRY_ALERT = "blocky:retries";
/** Written when the owner switches paid calls back on: the alarm looks at what happened after it. */
export const SPEND_CLEARED = "blocky:spend-cleared";

const TEST_PURPOSE = /^(?:test|blind_test):/;
/** A logged call that a user caused (not one of the owner's test scripts). */
export const isUserSpend = (call) => Boolean(call?.user_id) && !TEST_PURPOSE.test(String(call?.purpose ?? ""));
/** What credits are worth in dollars. */
export const usdOfCredits = (credits) => (Number(credits) || 0) * BASIS.eurPerCredit / BASIS.eurPerUsd;

/** What jobs that are still running are expected to cost us: a picture, or a clip's seconds at its tier's dearest model. */
export function inFlightUsd(jobs) {
  let usd = 0;
  for (const j of jobs ?? []) {
    if (j.kind === "image") { usd += PICTURE.guardUsd; continue; }
    const tier = String(j.tool_key ?? "").match(/-(v[234])$/)?.[1] ?? "v4";
    usd += (Number(j.price_input?.durationSec) || 15) * tierGuardPerSec(tier);
  }
  return usd;
}

/** Is there room under the user's daily cap for a step expected to cost addUsd? */
export function userBudget({ spentUsd = 0, runningUsd = 0, addUsd = 0, capUsd = USER_DAILY_USD }) {
  const after = spentUsd + runningUsd + Math.max(0, addUsd);
  return { ok: after <= capUsd + 1e-9, spentUsd, runningUsd, capUsd, leftUsd: Math.max(0, capUsd - spentUsd - runningUsd) };
}

/**
 * The alarm's verdict from the day's numbers.
 * @param {{spendUsd: number, chargedCredits: number, jobs?: {id: string, attempt: number}[]}} n
 */
export function judgeSpend({ spendUsd = 0, chargedCredits = 0, jobs = [] }, { aheadAlarmUsd = AHEAD_ALARM_USD, maxAttempts = MAX_JOB_ATTEMPTS } = {}) {
  const chargedUsd = usdOfCredits(chargedCredits);
  const aheadUsd = spendUsd - chargedUsd;
  const retried = jobs.filter((j) => Number(j.attempt) > maxAttempts).map((j) => ({ id: j.id, attempt: Number(j.attempt) }));
  return { spendUsd: round(spendUsd), chargedCredits, chargedUsd: round(chargedUsd), aheadUsd: round(aheadUsd), spendAlarm: aheadUsd > aheadAlarmUsd, retried, retryAlarm: retried.length > 0 };
}
const round = (n) => Math.round(n * 10000) / 10000;

/** Every row of a query, a thousand at a time (a busy day has more logged calls than one page). */
async function allRows(query, max = 20000) {
  const rows = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}
const dayStart = (now) => { const d = new Date(now); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };

/** What one user has cost us today, and what their running jobs are still expected to cost. */
export async function userSpendToday(admin, userId, now = new Date()) {
  const since = dayStart(now);
  const calls = await allRows(() => admin.from("blocky_ai_calls").select("cost_usd, purpose, user_id").eq("user_id", userId).gte("created_at", since).gt("cost_usd", 0).order("created_at"));
  const { data: jobs, error } = await admin.from("blocky_jobs").select("kind, tool_key, price_input").eq("user_id", userId).in("status", ["queued", "submitting", "submitted"]);
  if (error) throw new Error(error.message);
  return { spentUsd: calls.filter(isUserSpend).reduce((s, c) => s + Number(c.cost_usd), 0), runningUsd: inFlightUsd(jobs) };
}

/** The numbers the alarm judges: the last WATCH_HOURS, or since the alarm was last cleared if that is later. */
export async function readSpendWatch(admin, now = new Date()) {
  const { data: cleared } = await admin.from("blocky_provider_alerts").select("last_seen_at").eq("provider", SPEND_CLEARED).maybeSingle();
  const windowStart = new Date(now.getTime() - WATCH_HOURS * 3600_000);
  const since = new Date(Math.max(windowStart.getTime(), cleared?.last_seen_at ? new Date(cleared.last_seen_at).getTime() : 0)).toISOString();
  const calls = await allRows(() => admin.from("blocky_ai_calls").select("cost_usd, purpose, user_id").gte("created_at", since).gt("cost_usd", 0).not("user_id", "is", null).order("created_at"));
  const ledger = await allRows(() => admin.from("blocky_credit_ledger").select("operation, credits").gte("created_at", since).order("id"));
  const { data: jobs, error } = await admin.from("blocky_jobs").select("id, attempt").gte("created_at", since).gt("attempt", MAX_JOB_ATTEMPTS).limit(50);
  if (error) throw new Error(error.message);
  return {
    since,
    spendUsd: calls.filter(isUserSpend).reduce((s, c) => s + Number(c.cost_usd), 0),
    chargedCredits: ledger.reduce((s, r) => s + (r.operation === "refund" ? -1 : 1) * Number(r.credits), 0),
    jobs: jobs ?? [],
  };
}

async function email(env, subject, text) {
  if (!env?.RESEND_API_KEY || !env?.ALERT_EMAIL) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Zyvo Alerts <niko@tryzyvo.com>", to: env.ALERT_EMAIL, subject, text }), signal: AbortSignal.timeout(10_000),
  }).catch((e) => { console.error("[blocky] alarm email failed:", e?.message ?? e); return null; });
  return Boolean(res?.ok);
}

/**
 * Looks at the numbers and acts: on a spend alarm paid calls are switched off (every time, so they stay
 * off), and the alert is written; the admin is emailed when the alert is new (once an hour at most, the
 * same rule as the provider alerts). A retry alert is written and emailed, and pauses nothing.
 * Never throws: the watch must not break the job sweep it runs in.
 * @returns {Promise<object|null>} the verdict, with what was done
 */
export async function runSpendWatch(admin, env, { now = new Date(), read = readSpendWatch, send = email } = {}) {
  try {
    const numbers = await read(admin, now);
    const v = judgeSpend(numbers);
    const done = { paused: false, emailed: [] };
    if (v.spendAlarm) {
      const message = `In the last ${WATCH_HOURS} hours Blocky spent $${v.spendUsd.toFixed(2)} at providers and charged users ${v.chargedCredits} credits (worth $${v.chargedUsd.toFixed(2)}): $${v.aheadUsd.toFixed(2)} ahead.`;
      const { error: off } = await admin.from("blocky_settings").update({ paid_calls: false }).eq("id", true);
      done.paused = !off;
      const { data: notify } = await admin.rpc("blocky_raise_provider_alert", { p_provider: SPEND_ALERT, p_code: "SPEND_AHEAD", p_message: message, p_context: { ...v, since: numbers.since } });
      console.error(`[blocky] ALARM spend ahead of charges: ${message} Paid calls switched off.`);
      if (notify && await send(env, "Blocky Stories: spending is ahead of what users were charged (paid calls paused)", `${message}\n\nPaid calls are switched OFF, so nothing new is made. Jobs that were waiting are refunded.\n\nLook at the numbers with: node scripts/blocky/paid.mjs status\nWhen it is understood, switch back on with: node scripts/blocky/paid.mjs on (that also clears this alarm).`)) done.emailed.push(SPEND_ALERT);
    }
    if (v.retryAlarm) {
      const message = `${v.retried.length} job${v.retried.length > 1 ? "s were" : " was"} sent more than ${MAX_JOB_ATTEMPTS} times: ${v.retried.slice(0, 5).map((j) => `${j.id} (${j.attempt})`).join(", ")}.`;
      const { data: notify } = await admin.rpc("blocky_raise_provider_alert", { p_provider: RETRY_ALERT, p_code: "JOB_RETRIES", p_message: message, p_context: { retried: v.retried.slice(0, 20) } });
      console.error(`[blocky] ALERT job retries: ${message}`);
      if (notify && await send(env, "Blocky Stories: a job keeps being sent again", `${message}\n\nNothing was paused. Look at the job with: node scripts/blocky/storyStatus.mjs`)) done.emailed.push(RETRY_ALERT);
    }
    return { ...v, since: numbers.since, ...done };
  } catch (e) {
    console.error("[blocky] spend watch failed:", e?.message ?? e);
    return null;
  }
}
