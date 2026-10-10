// A scheduled campaign from the admin's side. ADMIN ONLY (service role key in .env.local).
// This script never sends an email: it fills the queue that the campaign-sender
// function works through (one email a minute at most, the email gate on each one,
// the stop rules of _shared/campaigns.js on every tick).
//
//   node --env-file=.env.local scripts/warmupCampaign.mjs --campaign warmup_day1 --start 2026-10-11T13:00:00Z
//       The plan (default): who would get it and when. Counts only. Changes nothing.
//       --count 200 (how many) --hours 7 (the window they are spread over)
//   … --queue      write the campaign and its queue, in status "waiting": nothing is sent
//   … --approve    waiting → approved: it starts at its start time (only on the owner's go)
//   … --hold       approved → waiting (before it has started)
//   … --stop       stop it now, whatever it is doing
//   … --report     the numbers so far
// Who: the newest profiles with email_updates = true that signed up at least 24
// hours before the start (the gate refuses anyone newer), with a usable address
// that is not suppressed. The gate checks every one of them again at send time.
import { createClient } from "@supabase/supabase-js";
import { checkEmailAddress, emailFooter } from "../supabase/functions/_shared/emailRules.js";
import { CAMPAIGNS, campaignNumbers, campaignReportText } from "../supabase/functions/_shared/campaigns.js";

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const val = (k, fallback = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : fallback; };
const id = val("--campaign");
const def = CAMPAIGNS[id];
if (!def) { console.error(`Unknown --campaign. Known: ${Object.keys(CAMPAIGNS).join(", ")}`); process.exit(1); }
const admin = createClient(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const when = (d) => `${new Date(d).toISOString().slice(0, 16).replace("T", " ")} UTC (${new Date(d).toLocaleString("en-GB", { timeZone: "Europe/Helsinki", weekday: "short", hour: "2-digit", minute: "2-digit" })} in Finland)`;
const { data: existing } = await admin.from("email_campaigns").select("*").eq("id", id).maybeSingle();

if (flag("--report")) {
  if (!existing) { console.log(`${id}: not queued yet`); process.exit(0); }
  console.log(campaignReportText(id, existing, await campaignNumbers(admin, id, existing.starts_at)));
  console.log(`Window: ${when(existing.starts_at)} to ${when(existing.ends_at)}`);
  const { data: last } = await admin.from("email_campaign_queue").select("sent_at").eq("campaign", id).eq("status", "sent").order("sent_at", { ascending: false }).limit(1);
  if (last?.[0]) console.log(`Last email sent: ${when(last[0].sent_at)}`);
  const { data: why } = await admin.from("email_campaign_queue").select("reason").eq("campaign", id).in("status", ["skipped", "failed"]);
  const reasons = {};
  for (const r of why ?? []) reasons[r.reason ?? "?"] = (reasons[r.reason ?? "?"] ?? 0) + 1;
  if (why?.length) console.log("Not sent, by reason:", JSON.stringify(reasons));
  process.exit(0);
}

const move = async (from, to, extra = {}) => {
  if (!existing) { console.error(`${id} is not queued yet (run --queue first)`); process.exit(1); }
  const { data, error } = await admin.from("email_campaigns").update({ status: to, ...extra }).eq("id", id).in("status", from).select("status");
  if (error) throw new Error(error.message);
  console.log(data?.length ? `${id}: ${existing.status} → ${to}` : `${id}: not changed (it is "${existing.status}", this needs ${from.join(" or ")})`);
  process.exit(data?.length ? 0 : 1);
};
if (flag("--approve")) await move(["waiting"], "approved");
if (flag("--hold")) await move(["approved"], "waiting");
if (flag("--stop")) await move(["waiting", "approved", "sending"], "stopped", { stop_reason: "stopped by hand", finished_at: new Date().toISOString() });

// The plan.
const start = new Date(val("--start") ?? NaN);
const count = Number(val("--count", 200));
const hours = Number(val("--hours", 7));
if (Number.isNaN(start.getTime())) { console.error("Give --start as a UTC time, e.g. --start 2026-10-11T13:00:00Z"); process.exit(1); }
if (!Number.isInteger(count) || count < 1 || count > 1000 || !(hours >= 6 && hours <= 12)) { console.error("--count 1 to 1000, --hours 6 to 12"); process.exit(1); }
const cutoff = new Date(start.getTime() - 24 * 3600_000).toISOString(); // signed up at least 24 hours before the first send

const [{ data: newest, error }, { data: suppressed }] = await Promise.all([
  admin.from("profiles").select("id, email, created_at").eq("email_updates", true).not("email", "is", null).lte("created_at", cutoff).order("created_at", { ascending: false }).limit(Math.min(1000, count * 3)),
  admin.from("email_suppressions").select("email").limit(5000),
]);
if (error) throw new Error(error.message);
const never = new Set((suppressed ?? []).map((s) => s.email));
const seen = new Set(), picked = [], passed = { badAddress: 0, duplicate: 0, suppressed: 0 };
for (const p of newest) {
  if (picked.length >= count) break;
  const check = checkEmailAddress(p.email);
  if (!check.ok) { passed.badAddress++; continue; }
  if (seen.has(check.email)) { passed.duplicate++; continue; }
  seen.add(check.email);
  if (never.has(check.email)) { passed.suppressed++; continue; }
  picked.push({ profile_id: p.id, email: check.email, created_at: p.created_at });
}
// Evenly over the window, in a random order (so one mail provider doesn't get a run of them), a little off the beat.
const order = picked.map((p) => ({ p, r: Math.random() })).sort((a, b) => a.r - b.r).map((x) => x.p);
const step = (hours * 3600_000) / Math.max(1, order.length);
const rows = order.map((p, i) => ({ campaign: id, profile_id: p.profile_id, email: p.email, send_after: new Date(start.getTime() + i * step + Math.floor(Math.random() * 40_000)).toISOString() }));
const end = new Date(start.getTime() + hours * 3600_000);
const dropAfter = new Date(end.getTime() + 90 * 60_000);
const providers = {};
for (const p of picked) { const d = p.email.split("@")[1]; const k = /^(gmail|googlemail)\.com$/.test(d) ? "Gmail" : /^(outlook|hotmail|live|msn)\./.test(d) ? "Microsoft" : /^(icloud|me|mac)\.com$/.test(d) ? "Apple" : /^(yahoo|ymail|aol)\./.test(d) ? "Yahoo" : "other"; providers[k] = (providers[k] ?? 0) + 1; }
const footer = emailFooter({ unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=…&t=…", why: def.why, plain: def.plain === true });

console.log(JSON.stringify({
  campaign: id, from: def.from, replyTo: def.replyTo, subject: def.subject,
  people: picked.length, wanted: count, passedOver: passed,
  signedUpBetween: picked.length ? [picked.at(-1).created_at.slice(0, 16), picked[0].created_at.slice(0, 16)] : null,
  providers,
  firstEmail: when(start), lastEmail: when(end), oneEvery: `${Math.round(step / 1000)} seconds`, droppedIfNotSentBy: when(dropAfter),
  alreadyQueued: existing ? existing.status : false,
}, null, 1));
console.log("\n----- the email (text version) -----\n" + def.render(footer).text + "\n------------------------------------");

if (!flag("--queue")) { console.log("\nPlan only: nothing was written. Add --queue to write it (status \"waiting\": nothing is sent until --approve)."); process.exit(0); }
if (existing) { console.error(`\n${id} is already queued (status "${existing.status}"): not written again.`); process.exit(1); }
if (!picked.length) { console.error("\nNobody to send to."); process.exit(1); }
const { error: e1 } = await admin.from("email_campaigns").insert({ id, status: "waiting", planned: rows.length, starts_at: start.toISOString(), ends_at: dropAfter.toISOString() });
if (e1) throw new Error(e1.message);
const { error: e2 } = await admin.from("email_campaign_queue").insert(rows);
if (e2) { await admin.from("email_campaigns").delete().eq("id", id); throw new Error(e2.message); }
console.log(`\nQueued: ${rows.length} people for ${id}, status "waiting". Nothing is sent until --approve.`);
