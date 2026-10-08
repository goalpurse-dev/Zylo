// Blocky Stories' paid-calls switch and daily spending cap (the one row in
// public.blocky_settings). Paid calls are OFF by default.
//
//   node scripts/blocky/paid.mjs status     the switch, the cap, today's spend
//   node scripts/blocky/paid.mjs on         allow paid calls (until the daily cap is reached)
//   node scripts/blocky/paid.mjs off        stop every paid call now; jobs still waiting are refunded
//   node scripts/blocky/paid.mjs cap 3      set the daily cap in USD
//   node scripts/blocky/paid.mjs cap none   no daily cap (build and test only: put one back before real users get access)
//
// The same row can be changed in the Supabase dashboard: Table editor →
// blocky_settings → paid_calls (true / false) and daily_cap_usd.
// "Today" runs from 00:00 UTC. It takes effect on the next request.
import { admin } from "./lib.mjs";

const [command = "status", value] = process.argv.slice(2);
const NO_CAP_USD = 999999.99;
const db = admin();
const fail = (m) => { console.error(m); process.exit(1); };
const set = async (patch) => { const { error } = await db.from("blocky_settings").update(patch).eq("id", true); if (error) fail(`Couldn't change the setting: ${error.message}`); };

if (command === "on") await set({ paid_calls: true });
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
console.log(`Daily cap: ${capped ? usd(s.cap_usd) : "NONE (build and test only)"}. Spent today (since 00:00 UTC): ${usd(s.spent_usd)}${Number(s.in_flight_usd) > 0 ? `, plus about ${usd(s.in_flight_usd)} still running` : ""}.`);
console.log(s.on ? (capped ? `Blocky can make paid calls: ${usd(Number(s.cap_usd) - Number(s.spent_usd) - Number(s.in_flight_usd))} left today.` : "Blocky can make paid calls, with no daily limit.") : s.reason === "cap_reached" ? "Blocky is STOPPED for today: the daily cap is reached." : "Blocky makes no paid call.");
