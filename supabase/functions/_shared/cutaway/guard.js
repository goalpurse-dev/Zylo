// Cutaway Explainer: who may start a video now, and the caps that keep spending in hand (LAUNCH_CHECKLIST.md 3).
// The numbers live in public.cutaway_settings (the owner changes them with one row); the counts come from the
// cutaway_guard RPC, read fresh before every start. Reading fails closed: no state, no start.
// The function secret CUTAWAY_PAID_CALLS=off is a second, hard off switch (as Blocky's).

export const DEFAULT_SETTINGS = Object.freeze({
  paid_calls: true,
  daily_cap_usd: 25,        // our provider spend across everyone in 24 h (planning, voice, checks, GPU)
  window_cap_usd: 10,       // the same in any 3 hours (a burst can't spend the whole day at once)
  user_daily_usd: 5,        // one user's videos in 24 h, at our cost (about 5 custom videos)
  user_max_running: 2,      // one user's videos being made at once
  user_starts_per_hour: 10,
  user_fail_streak: 3,      // failed in a row: a 30-minute pause, so a topic that keeps failing can't keep spending
  fail_pause_min: 30,
  max_running: 4,           // everyone's videos being made at once (the RunPod endpoint's workers)
});

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
 * code: null when ok; "OFF" (the switch), "BUSY" (everyone's caps: try later), "LIMIT" (this user's caps).
 * addUsd: what this video is expected to cost us (the price's cost basis).
 */
export function decide(settings, counts, addUsd, { envOff = false } = {}) {
  const s = { ...DEFAULT_SETTINGS, ...(settings ?? {}) }, c = counts ?? null;
  if (envOff || s.paid_calls === false) return { ok: false, code: "BUSY", reason: "paid calls are off", retryAfterSec: 1800 };
  if (!c) return { ok: false, code: "BUSY", reason: "the spend state could not be read", retryAfterSec: 300 };
  const n = (k) => Number(c[k]) || 0;
  // a provider ran out of balance: no new videos for 10 minutes (they would fail and be refunded anyway)
  if (c.minutes_since_balance_fail != null && n("minutes_since_balance_fail") < 10) return { ok: false, code: "BUSY", reason: "a provider is out of balance", retryAfterSec: 600 };
  if (n("spent_24h") + addUsd > s.daily_cap_usd) return { ok: false, code: "BUSY", reason: "the daily cap", retryAfterSec: 3600 };
  if (n("spent_3h") + addUsd > s.window_cap_usd) return { ok: false, code: "BUSY", reason: "the 3-hour cap", retryAfterSec: 1800 };
  if (n("running") >= s.max_running) return { ok: false, code: "BUSY", reason: "every render slot is busy", retryAfterSec: 300 };
  if (n("user_spent_24h") + addUsd > s.user_daily_usd) return { ok: false, code: "LIMIT", reason: "You've made a lot of videos today. Try again tomorrow.", retryAfterSec: 3600 * 6 };
  if (n("user_running") >= s.user_max_running) return { ok: false, code: "LIMIT", reason: `You can make ${s.user_max_running} videos at once. Wait for one to finish.`, retryAfterSec: 120 };
  if (n("user_starts_1h") >= s.user_starts_per_hour) return { ok: false, code: "LIMIT", reason: "That's a lot of videos in an hour. Try again a little later.", retryAfterSec: 900 };
  if (n("user_fail_streak") >= s.user_fail_streak && n("minutes_since_last_fail") < s.fail_pause_min) return { ok: false, code: "LIMIT", reason: "A few videos in a row didn't work out. Give it a few minutes and try another topic.", retryAfterSec: (s.fail_pause_min - n("minutes_since_last_fail")) * 60 };
  return { ok: true, code: null, reason: null, retryAfterSec: 0 };
}
