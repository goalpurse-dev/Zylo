// Blocky Stories' paid-calls switch and daily spending cap (the one row in
// public.blocky_settings). Paid calls are OFF by default.
//
//   node scripts/blocky/paid.mjs status     the switch, the cap, today's spend
//   node scripts/blocky/paid.mjs on         allow paid calls (until the daily cap is reached); also clears a spend alarm
//   node scripts/blocky/paid.mjs off        stop every paid call now; jobs still waiting are refunded
//   node scripts/blocky/paid.mjs cap 3      set the daily cap in USD
//   node scripts/blocky/paid.mjs cap none   no daily cap (build and test only: put one back before real users get access)
//
// The same row can be changed in the Supabase dashboard: Table editor →
// blocky_settings → paid_calls (true / false) and daily_cap_usd.
// "Today" runs from 00:00 UTC. It takes effect on the next request.
import { admin } from "./lib.mjs";
import { AHEAD_ALARM_USD, MAX_JOB_ATTEMPTS, RETRY_ALERT, SPEND_ALERT, SPEND_CLEARED, USER_DAILY_USD, WATCH_HOURS, WINDOW_HOURS, judgeSpend, readSpendWatch, readWindow, windowBudget } from "../../supabase/functions/_shared/blocky/spendWatch.js";

const [command = "status", value] = process.argv.slice(2);
const NO_CAP_USD = 999999.99;
const db = admin();
const fail = (m) => { console.error(m); process.exit(1); };
const set = async (patch) => { const { error } = await db.from("blocky_settings").update(patch).eq("id", true); if (error) fail(`Couldn't change the setting: ${error.message}`); };

if (command === "on") {
  await set({ paid_calls: true });
  // Switching on by hand also clears a spend alarm: the watch looks at what is spent and charged from now on.
  const cleared = await db.rpc("blocky_raise_provider_alert", { p_provider: SPEND_CLEARED, p_code: "CLEARED", p_message: "paid calls switched on by the owner", p_context: {} });
  if (cleared.error) console.error(`The alarm could not be marked as cleared: ${cleared.error.message}`);
}
else if (command === "off") await set({ paid_calls: false });
else if (command === "cap") {
  // "none": the largest amount the column holds, which no day's spend reaches. The switch still works.
  const usd = value === "none" ? NO_CAP_USD : Number(value);
  if (value !== "none" && (!Number.isFinite(usd) || usd < 0 || usd > 100)) fail("Give the cap in USD, 0 to 100, for example: node scripts/blocky/paid.mjs cap 3");
  await set({ daily_cap_usd: usd });
} else if (command !== "status") fail(`Unknown command "${command}": status, on, off or cap <usd>.`);

const { data: s, error } = await db.rpc("blocky_paid_state", { p_add_usd: 0 });
if (error) fail(`Couldn't read the setting: ${error.message}`);
const usd = (n) => `$${Number(n).toFixed(2)}`;
console.log(`Paid calls: ${s.paid_calls ? "ON" : "OFF"}`);
const capped = Number(s.cap_usd) < NO_CAP_USD;
console.log(`Daily cap: ${capped ? usd(s.cap_usd) : "none (the 3-hour limit below is the one limit)"}. Spent today (since 00:00 UTC): ${usd(s.spent_usd)}${Number(s.in_flight_usd) > 0 ? `, plus about ${usd(s.in_flight_usd)} still running` : ""}.`);
console.log(s.on ? (capped ? `Blocky can make paid calls: ${usd(Number(s.cap_usd) - Number(s.spent_usd) - Number(s.in_flight_usd))} left today.` : "Blocky can make paid calls, with no daily limit.") : s.reason === "cap_reached" ? "Blocky is STOPPED for today: the daily cap is reached." : "Blocky makes no paid call.");

// Blocky's one limit: all users together, the last 3 hours (raised on /admin/ops).
const win = windowBudget(await readWindow(db));
console.log(`Last ${WINDOW_HOURS} hours, all users together: ${usd(win.usedUsd)} of the ${usd(win.capUsd)} limit${win.ok ? `, ${usd(win.leftUsd)} left` : ": AT THE LIMIT, new stories see \"High demand right now\""}.`);
// The spending watch (spendWatch.js): what users cost us and were charged, and any alarm.
const watch = judgeSpend(await readSpendWatch(db));
console.log(`Last ${WATCH_HOURS} hours, users only: ${usd(watch.spendUsd)} spent at providers, ${watch.chargedCredits} credits charged (worth ${usd(watch.chargedUsd)}): ${watch.aheadUsd > 0 ? `${usd(watch.aheadUsd)} AHEAD of charges` : "charges are ahead of spend, as they should be"}. The alarm goes at ${usd(AHEAD_ALARM_USD)} ahead and pauses paid calls. Cap per user: ${usd(USER_DAILY_USD)} of our cost a day.`);
const { data: alerts } = await db.from("blocky_provider_alerts").select("provider, message, last_seen_at, count").in("provider", [SPEND_ALERT, RETRY_ALERT]);
const fresh = (alerts ?? []).filter((a) => Date.now() - new Date(a.last_seen_at).getTime() < WATCH_HOURS * 3600_000);
for (const a of fresh) console.log(`ALERT (${a.provider === SPEND_ALERT ? "spend ahead of charges" : `a job sent more than ${MAX_JOB_ATTEMPTS} times`}, last seen ${a.last_seen_at}): ${a.message}`);
if (!fresh.length) console.log("No alarm in the last 24 hours.");
