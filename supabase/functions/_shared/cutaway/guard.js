// Cutaway Explainer: who may start a video now, and the caps that keep spending in hand (LAUNCH_CHECKLIST.md 3).
// The numbers live in public.cutaway_settings (the owner changes them with one row); the counts come from the
// cutaway_guard RPC, read fresh before every start. Reading fails closed: no state, no start.
// The function secret CUTAWAY_PAID_CALLS=off is a second, hard off switch (as Blocky's).

// The owner's rule (2026-10-25): a paying user with credits is never stopped by a money limit of their own. What is
// left: one emergency cap for everyone together (runaway bugs, retry loops; emails at 50 % and 80 %), two videos at
// once per user, and the starts-per-hour abuse limit.
export const DEFAULT_SETTINGS = Object.freeze({
  paid_calls: true,
  daily_cap_usd: 20,        // EMERGENCY cap: our provider spend across everyone in 24 h (the owner raises it on /admin/ops)
  user_max_running: 2,      // one user's videos being made at once
  user_starts_per_hour: 10, // abuse limit
});
/** The emergency cap's range on /admin/ops (whole dollars). */
export const DAILY_CAP_RANGE = Object.freeze({ min: 1, max: 5000 });
/** The share of the emergency cap that emails the owner (once per level per 24 h); 100 = reached. */
export const CAP_ALERT_LEVELS = Object.freeze([50, 80, 100]);
/** The highest alert level `usedUsd` has reached, or 0. */
export function capAlertLevel(usedUsd, capUsd) {
  const pct = capUsd > 0 ? (Number(usedUsd) || 0) / capUsd * 100 : 0;
  return [...CAP_ALERT_LEVELS].reverse().find((l) => pct >= l) ?? 0;
}

/** The topic rules: length and the words never charged for (the script step refuses unsafe topics too). */
export const TOPIC = Object.freeze({ min: 3, max: 80 });
const BLOCKED = /\b(bomb|explosive|weapon|gun|kill|murder|suicide|drug|meth|cocaine|porn|sex|nude|terror)\w*/i;
export function topicProblem(topic) {
  const t = String(topic ?? "").trim();
  if (t.length < TOPIC.min || t.length > TOPIC.max) return `Type a topic (${TOPIC.min} to ${TOPIC.max} characters).`;
  if (BLOCKED.test(t)) return "We can't make a video about that topic.";
  return null;
}

/**
 * The decision from the settings and the fresh counts (cutaway_guard): { ok, code, reason, retryAfterSec }.
 * code: null when ok; "BUSY" (on our side: try later), "LIMIT" (this user: two at once, or the starts per hour).
 * Never a money limit per user. addUsd: what this video is expected to cost us (the price's cost basis).
 */
export function decide(settings, counts, addUsd, { envOff = false } = {}) {
  const s = { ...DEFAULT_SETTINGS, ...(settings ?? {}) }, c = counts ?? null;
  if (envOff || s.paid_calls === false) return { ok: false, code: "BUSY", reason: "paid calls are off", message: "Video making is paused on our side right now.", retryAfterSec: 1800 };
  if (!c) return { ok: false, code: "BUSY", reason: "the spend state could not be read", retryAfterSec: 300 };
  const n = (k) => Number(c[k]) || 0;
  // a provider ran out of balance: no new videos for 10 minutes (they would fail and be refunded anyway)
  if (c.minutes_since_balance_fail != null && n("minutes_since_balance_fail") < 10) return { ok: false, code: "BUSY", reason: "a provider is out of balance", message: "Video making is paused on our side for a few minutes.", retryAfterSec: 600 };
  // the emergency cap: never worded as a limit to the user
  if (n("spent_24h") + addUsd > Number(s.daily_cap_usd)) return { ok: false, code: "BUSY", reason: "the emergency cap", message: "High demand right now, please try again shortly.", retryAfterSec: 1800 };
  if (n("user_running") >= s.user_max_running) return { ok: false, code: "LIMIT", reason: `You can make ${s.user_max_running} videos at once. Wait for one to finish.`, retryAfterSec: 120 };
  if (n("user_starts_1h") >= s.user_starts_per_hour) return { ok: false, code: "LIMIT", reason: "That's a lot of videos in an hour. Try again a little later.", retryAfterSec: 900 };
  return { ok: true, code: null, reason: null, retryAfterSec: 0 };
}

/** Beta: custom videos per user per 24 hours (the owner's rule of 2026-10-31). runs: their custom runs of the last 24 h, or null when unreadable (closed). */
export const CUSTOM_PER_DAY = 3;
export function customDayLimit(runs, now = Date.now()) {
  if (!Array.isArray(runs)) return { ok: false, code: "BUSY", message: "Video making is paused on our side right now.", retryAfterSec: 300 };
  if (runs.length < CUSTOM_PER_DAY) return { ok: true };
  const oldest = Math.min(...runs.map((r) => Date.parse(r.created_at)));
  return { ok: false, code: "LIMIT", message: `During the Beta you can make ${CUSTOM_PER_DAY} custom videos a day. Premade topics have no such limit.`, retryAfterSec: Math.max(60, Math.ceil((oldest + 86400000 - now) / 1000)) };
}
