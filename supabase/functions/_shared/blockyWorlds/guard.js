// Blocky Worlds: who may start a video now, and the caps that keep spending in hand. The same rules as Cutaway's
// (the owner's rule of 2026-10-25: no money limit per user; one emergency cap for everyone, two videos at once per user,
// a starts-per-hour abuse limit). The numbers live in public.blocky_worlds_settings; the counts come from the
// blocky_worlds_guard RPC, read fresh before every start. Reading fails closed: no state, no start.
// The writing steps (ideas, scripts) have daily limits per user instead (ideas.js, WRITING below).

export const DEFAULT_SETTINGS = Object.freeze({
  paid_calls: true,         // THE ONE SWITCH: false pauses every new In This Town video and script for everyone
  daily_cap_usd: 50,        // EMERGENCY cap (owner 2026-11-18: $50): our real spend across everyone in 24 h, writing included
  user_max_running: 3,      // owner 2026-11-18: at most 3 videos in progress per user
  user_starts_per_hour: 10,
  user_starts_per_day: 6,   // owner 2026-11-18: at most ~6 videos (Try agains included) per user in 24 h
});
/** owner 2026-11-18: an email when the real In This Town spend passes this in 24 h (the pause comes at daily_cap_usd) */
export const SPEND_ALERT_USD = 25;
/** owner 2026-11-18: free Try agains per paid script; then the script is done (its credits are all back) */
export const MAX_FREE_RETRIES = 2;
export const RETRIES_USED_UP = "We couldn't make this one, all credits are back. Try a new story.";
export const PAUSED_MESSAGE = "In This Town is taking a short break. Back soon! Nothing was charged.";

/** Script writing a user a day (UTC): writes, rewrites and opener fixes together. Paid plans only. */
export const WRITING = Object.freeze({ dailyScripts: 15 });

/**
 * The decision from the settings and the fresh counts: { ok, code, reason, message, retryAfterSec }.
 * addUsd: what this step is expected to cost us. kind: "video" (a start) or "writing" (ideas, scripts).
 */
export function decide(settings, counts, addUsd, { envOff = false, kind = "video" } = {}) {
  const s = { ...DEFAULT_SETTINGS, ...(settings ?? {}) }, c = counts ?? null;
  if (envOff || s.paid_calls === false) return { ok: false, code: "BUSY", reason: "paid calls are off", message: PAUSED_MESSAGE, retryAfterSec: 1800 };
  if (!c) return { ok: false, code: "BUSY", reason: "the spend state could not be read", retryAfterSec: 300 };
  const n = (k) => Number(c[k]) || 0;
  if (c.minutes_since_balance_fail != null && n("minutes_since_balance_fail") < 10) return { ok: false, code: "BUSY", reason: "a provider is out of balance", message: "Blocky Worlds is paused on our side for a few minutes.", retryAfterSec: 600 };
  if (n("spent_24h") + addUsd > Number(s.daily_cap_usd)) return { ok: false, code: "BUSY", reason: "the emergency cap", message: PAUSED_MESSAGE, retryAfterSec: 1800 };
  if (kind === "video") {
    if (n("user_running") >= s.user_max_running) return { ok: false, code: "LIMIT", reason: `You can make ${s.user_max_running} videos at once. Wait for one to finish.`, retryAfterSec: 120 };
    if (n("user_starts_1h") >= s.user_starts_per_hour) return { ok: false, code: "LIMIT", reason: "That's a lot of videos in an hour. Try again a little later.", retryAfterSec: 900 };
    if (c.user_starts_24h != null && n("user_starts_24h") >= s.user_starts_per_day) return { ok: false, code: "LIMIT", reason: `That's today's ${s.user_starts_per_day} videos. Come back tomorrow.`, retryAfterSec: 3600 };
  }
  return { ok: true, code: null, reason: null, retryAfterSec: 0 };
}
