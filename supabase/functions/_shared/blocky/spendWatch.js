// Blocky Stories' spending safety (owner, 2026-10-08 and 2026-10-09). No daily cap; instead:
//
//   0. ONE limit for Blocky as a whole: WINDOW_HOURS of our real cost for all users together
//      (blocky_settings.window_cap_usd, $20 to start; the owner raises it on /admin/ops). At the limit,
//      anything NEW is refused before any charge with "High demand right now, please try again shortly",
//      the owner is emailed, and stories already in progress go on to their final video.
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
/** Blocky's one limit counts this many hours back from now, for all users together. */
export const WINDOW_HOURS = 3;
/** The limit a new project starts with; the live number is blocky_settings.window_cap_usd. */
export const WINDOW_CAP_DEFAULT_USD = 20;
export const WINDOW_ALERT = "blocky:window";
/** Every alert name this file writes. The table accepts exactly these beside the provider names (a test keeps the migration in step). */
export const ALERT_NAMES = Object.freeze([SPEND_ALERT, RETRY_ALERT, SPEND_CLEARED, WINDOW_ALERT]);

/**
 * Writes (or refreshes) one of Blocky's alert rows. True when the owner should be told now: the alert is new,
 * or the last word about it is over an hour old. A row the database refuses is logged, loudly: until
 * 2026-10-09 the table took provider names only, these rows were refused, and nothing said so.
 */
export async function raiseAlert(admin, provider, code, message, context = {}) {
  const { data, error } = await admin.rpc("blocky_raise_provider_alert", { p_provider: provider, p_code: code, p_message: message, p_context: context });
  if (error) { console.error(`[blocky] ALERT ROW NOT WRITTEN (${provider}): ${error.message}`); return false; }
  return data === true;
}

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

/* ─── Blocky's one limit: all users together, any 3 hours ─────────────── */

/**
 * Is there room under the 3-hour limit for something new that is expected to cost addUsd?
 * "Used" is what users cost us in the window plus what their running jobs are still expected to cost.
 */
export function windowBudget({ spentUsd = 0, runningUsd = 0, addUsd = 0, capUsd = WINDOW_CAP_DEFAULT_USD }) {
  const usedUsd = spentUsd + runningUsd;
  return { ok: usedUsd + Math.max(0, addUsd) <= capUsd + 1e-9, spentUsd: round(spentUsd), runningUsd: round(runningUsd), usedUsd: round(usedUsd), capUsd, leftUsd: round(Math.max(0, capUsd - usedUsd)) };
}

/** The window's numbers, read fresh: users' spend in the last WINDOW_HOURS, their running jobs, and the limit. */
export async function readWindow(admin, now = new Date()) {
  const since = new Date(now.getTime() - WINDOW_HOURS * 3600_000).toISOString();
  const calls = await allRows(() => admin.from("blocky_ai_calls").select("cost_usd, purpose, user_id").gte("created_at", since).gt("cost_usd", 0).not("user_id", "is", null).order("created_at"));
  const { data: jobs, error } = await admin.from("blocky_jobs").select("kind, tool_key, price_input").in("status", ["queued", "submitting", "submitted"]);
  if (error) throw new Error(error.message);
  const { data: settings, error: settingsError } = await admin.from("blocky_settings").select("window_cap_usd").eq("id", true).maybeSingle();
  if (settingsError) throw new Error(settingsError.message);
  const capUsd = Number(settings?.window_cap_usd);
  return { since, spentUsd: calls.filter(isUserSpend).reduce((s, c) => s + Number(c.cost_usd), 0), runningUsd: inFlightUsd(jobs), capUsd: Number.isFinite(capUsd) && capUsd > 0 ? capUsd : WINDOW_CAP_DEFAULT_USD };
}

/**
 * The limit was reached and a user was asked to wait: write the alert and email the owner (once an hour at
 * most, the same rule as every Blocky alert). Never throws: it runs beside the refusal.
 */
export async function noteWindowHit(admin, env, budget, { send = email } = {}) {
  try {
    const message = `Blocky reached its limit: $${budget.usedUsd.toFixed(2)} of our cost in the last ${WINDOW_HOURS} hours (the limit is $${Number(budget.capUsd).toFixed(2)}). New stories are asked to try again shortly; stories already in progress go on.`;
    const notify = await raiseAlert(admin, WINDOW_ALERT, "WINDOW_LIMIT", message, budget);
    console.log(`[blocky] 3-hour limit reached: ${message}`);
    if (notify) return await send(env, "Blocky Stories: the 3-hour limit was reached (users see \"High demand\")", `${message}\n\nNothing was charged for what was refused. If this is real demand, raise the limit on /admin/ops (the Blocky card): it takes effect at once.`);
    return false;
  } catch (e) {
    console.error("[blocky] window alert failed:", e?.message ?? e);
    return false;
  }
}

/** The owner sets the limit on /admin/ops. A whole-dollar sanity range; anything else is refused. */
export const WINDOW_CAP_RANGE = Object.freeze({ min: 1, max: 5000 });
export function cleanWindowCap(value) {
  const usd = Math.round(Number(value) * 100) / 100;
  return Number.isFinite(usd) && usd >= WINDOW_CAP_RANGE.min && usd <= WINDOW_CAP_RANGE.max ? usd : null;
}

/**
 * What the owner's page shows for Blocky (/admin/ops): the paid switch, the 3-hour window against its
 * limit, the alarm's own numbers, and the alerts that are open. A spend alert is open until paid calls are
 * switched back on by hand (paid.mjs on writes SPEND_CLEARED); a retry alert is shown for WATCH_HOURS and
 * a reached limit for WINDOW_HOURS. Pure: the reads are in readOpsCard.
 * @param {{paid: object, numbers: object, window?: object, alerts?: object[], clearedAt?: string|null, now?: Date}} o
 */
export function opsCard({ paid, numbers, window = {}, alerts = [], clearedAt = null, now = new Date() }) {
  const v = judgeSpend(numbers);
  const w = windowBudget(window);
  const at = (iso) => new Date(iso).getTime();
  const age = (a) => now.getTime() - at(a.last_seen_at);
  const open = (a) => (a.provider === SPEND_ALERT ? !clearedAt || at(a.last_seen_at) > at(clearedAt) : a.provider === RETRY_ALERT ? age(a) < WATCH_HOURS * 3600_000 : a.provider === WINDOW_ALERT && age(a) < WINDOW_HOURS * 3600_000);
  const KIND = { [SPEND_ALERT]: "spend", [RETRY_ALERT]: "retries", [WINDOW_ALERT]: "window" };
  return {
    at: now.toISOString(),
    paidCalls: Boolean(paid?.on),
    offReason: paid?.on ? null : paid?.reason ?? "switch_off",
    window: { hours: WINDOW_HOURS, usedUsd: w.usedUsd, spentUsd: w.spentUsd, runningUsd: w.runningUsd, capUsd: w.capUsd, leftUsd: w.leftUsd, full: !w.ok, range: WINDOW_CAP_RANGE },
    today: { spentUsd: round(Number(paid?.spentUsd) || 0), inFlightUsd: round(Number(paid?.inFlightUsd) || 0) },
    watch: { since: numbers.since ?? null, hours: WATCH_HOURS, spendUsd: v.spendUsd, chargedCredits: v.chargedCredits, chargedUsd: v.chargedUsd, aheadUsd: v.aheadUsd, alarmAtUsd: AHEAD_ALARM_USD, retried: v.retried.length },
    limits: { userDailyUsd: USER_DAILY_USD, maxJobAttempts: MAX_JOB_ATTEMPTS },
    alerts: alerts.filter(open).map((a) => ({ kind: KIND[a.provider], message: a.message, since: a.opened_at ?? null, lastSeen: a.last_seen_at, count: Number(a.count) || 0 })),
  };
}

/** Reads what opsCard needs. readPaid: () => the paid switch's state (spendGuard.js#readPaidState). */
export async function readOpsCard(admin, readPaid, now = new Date()) {
  const [paid, numbers, window, { data: rows, error }] = await Promise.all([
    readPaid(),
    readSpendWatch(admin, now),
    readWindow(admin, now),
    admin.from("blocky_provider_alerts").select("provider, message, opened_at, last_seen_at, count").in("provider", [SPEND_ALERT, RETRY_ALERT, WINDOW_ALERT, SPEND_CLEARED]),
  ]);
  if (error) throw new Error(error.message);
  return opsCard({ paid, numbers, window, alerts: (rows ?? []).filter((r) => r.provider !== SPEND_CLEARED), clearedAt: (rows ?? []).find((r) => r.provider === SPEND_CLEARED)?.last_seen_at ?? null, now });
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
      const notify = await raiseAlert(admin, SPEND_ALERT, "SPEND_AHEAD", message, { ...v, since: numbers.since });
      console.error(`[blocky] ALARM spend ahead of charges: ${message} Paid calls switched off.`);
      if (notify && await send(env, "Blocky Stories: spending is ahead of what users were charged (paid calls paused)", `${message}\n\nPaid calls are switched OFF, so nothing new is made. Jobs that were waiting are refunded.\n\nLook at the numbers with: node scripts/blocky/paid.mjs status\nWhen it is understood, switch back on with: node scripts/blocky/paid.mjs on (that also clears this alarm).`)) done.emailed.push(SPEND_ALERT);
    }
    if (v.retryAlarm) {
      const message = `${v.retried.length} job${v.retried.length > 1 ? "s were" : " was"} sent more than ${MAX_JOB_ATTEMPTS} times: ${v.retried.slice(0, 5).map((j) => `${j.id} (${j.attempt})`).join(", ")}.`;
      const notify = await raiseAlert(admin, RETRY_ALERT, "JOB_RETRIES", message, { retried: v.retried.slice(0, 20) });
      console.error(`[blocky] ALERT job retries: ${message}`);
      if (notify && await send(env, "Blocky Stories: a job keeps being sent again", `${message}\n\nNothing was paused. Look at the job with: node scripts/blocky/storyStatus.mjs`)) done.emailed.push(RETRY_ALERT);
    }
    return { ...v, since: numbers.since, ...done };
  } catch (e) {
    console.error("[blocky] spend watch failed:", e?.message ?? e);
    return null;
  }
}
