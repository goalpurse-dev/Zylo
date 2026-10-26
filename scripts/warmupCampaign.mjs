// A scheduled campaign from the admin's side. ADMIN ONLY (service role key in .env.local).
// This script never sends an email: it fills the queue that the campaign-sender
// function works through (one email per 25 seconds at most, the email gate on
// each one, the stop rules of _shared/campaigns.js on every tick).
//
//   node --env-file=.env.local scripts/warmupCampaign.mjs --campaign warmup_day1 --start 2026-10-11T13:00:00Z
//       The plan (default): who would get it and when. Counts only. Changes nothing.
//       --count 200 (how many) --hours 7 (the window they are spread over)
//       --after warmup_day1,warmup_day2   "the next N": people who signed up before everyone in those campaigns
//       --depends-on warmup_day2          it runs only if that campaign had 0 complaints and bounces under 2%
//       --recipients-of a,b               exactly the people those campaigns were sent to
//       --signed-up-since ISO --signed-up-before ISO --exclude a,b   a sign-up window, minus anyone in those queues
//       --count all                       everyone who fits
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

// Leaving a moment after the last request: on Windows, exiting while a connection is still closing crashes Node with an assertion.
const bye = async (code) => { await new Promise((r) => setTimeout(r, 400)); process.exit(code); };
const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const val = (k, fallback = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : fallback; };
const id = val("--campaign");
const def = CAMPAIGNS[id];
if (!def) { console.error(`Unknown --campaign. Known: ${Object.keys(CAMPAIGNS).join(", ")}`); await bye(1); }
const admin = createClient(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const when = (d) => `${new Date(d).toISOString().slice(0, 16).replace("T", " ")} UTC (${new Date(d).toLocaleString("en-GB", { timeZone: "Europe/Helsinki", weekday: "short", hour: "2-digit", minute: "2-digit" })} in Finland)`;
const { data: existing } = await admin.from("email_campaigns").select("*").eq("id", id).maybeSingle();

if (flag("--report")) {
  if (!existing) { console.log(`${id}: not queued yet`); await bye(0); }
  console.log(campaignReportText(id, existing, await campaignNumbers(admin, id, existing.starts_at, { withPurchases: true })));
  console.log(`Window: ${when(existing.starts_at)} to ${when(existing.ends_at)}`);
  if (existing.depends_on) console.log(`Runs only if ${existing.depends_on} had 0 spam complaints and bounces under 2%.`);
  const { data: last } = await admin.from("email_campaign_queue").select("sent_at").eq("campaign", id).eq("status", "sent").order("sent_at", { ascending: false }).limit(1);
  if (last?.[0]) console.log(`Last email sent: ${when(last[0].sent_at)}`);
  const { data: why } = await admin.from("email_campaign_queue").select("reason").eq("campaign", id).in("status", ["skipped", "failed"]);
  const reasons = {};
  for (const r of why ?? []) reasons[r.reason ?? "?"] = (reasons[r.reason ?? "?"] ?? 0) + 1;
  if (why?.length) console.log("Not sent, by reason:", JSON.stringify(reasons));
  await bye(0);
}

const move = async (from, to, extra = {}) => {
  if (!existing) { console.error(`${id} is not queued yet (run --queue first)`); await bye(1); }
  const { data, error } = await admin.from("email_campaigns").update({ status: to, ...extra }).eq("id", id).in("status", from).select("status");
  if (error) throw new Error(error.message);
  console.log(data?.length ? `${id}: ${existing.status} → ${to}` : `${id}: not changed (it is "${existing.status}", this needs ${from.join(" or ")})`);
  await bye(data?.length ? 0 : 1);
};
if (flag("--approve")) await move(["waiting"], "approved");
if (flag("--hold")) await move(["approved"], "waiting");
if (flag("--stop")) await move(["waiting", "approved", "sending"], "stopped", { stop_reason: "stopped by hand", finished_at: new Date().toISOString() });

// The plan.
const start = new Date(val("--start") ?? NaN);
const countArg = String(val("--count", "200"));
const count = countArg === "all" ? Infinity : Number(countArg);
const hours = Number(val("--hours", 7));
if (Number.isNaN(start.getTime())) { console.error("Give --start as a UTC time, e.g. --start 2026-10-11T13:00:00Z"); await bye(1); }
if (!(count === Infinity || (Number.isInteger(count) && count >= 1 && count <= 3000)) || !(hours >= 6 && hours <= 12)) { console.error("--count 1 to 3000 or all, --hours 6 to 12"); await bye(1); }
let cutoff = new Date(start.getTime() - 24 * 3600_000).toISOString(); // signed up at least 24 hours before the first send
const list = (k) => String(val(k, "")).split(",").map((s) => s.trim()).filter(Boolean);

// Who, one of:
//   --after a,b              "the next N": people who signed up BEFORE everyone in those campaigns (and none of their recipients)
//   --recipients-of a,b      exactly the people those campaigns were sent to (still ON, not suppressed)
//   --signed-up-since ISO / --signed-up-before ISO, with --exclude a,b (nobody who is in those campaigns' queues)
const after = list("--after");
const recipientsOf = list("--recipients-of");
const exclude = list("--exclude");
const since = val("--signed-up-since");
const before = val("--signed-up-before");
const dependsOn = val("--depends-on");
for (const c of [...after, ...recipientsOf, ...exclude, ...(dependsOn ? [dependsOn] : [])]) if (!CAMPAIGNS[c]) { console.error(`Unknown campaign: ${c}`); await bye(1); }
const queueOf = async (c, onlySent) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = admin.from("email_campaign_queue").select("profile_id").eq("campaign", c);
    if (onlySent) q = q.eq("status", "sent");
    const { data, error: qe } = await q.order("id").range(from, from + 999);
    if (qe) throw new Error(qe.message);
    out.push(...data.map((r) => r.profile_id));
    if (data.length < 1000) return out;
  }
};
const earlier = new Set();
for (const c of after) {
  const q = await queueOf(c, false);
  if (!q.length) { console.error(`--after ${c}: that campaign has no queue yet`); await bye(1); }
  for (const r of q) earlier.add(r);
}
const excluded = new Set();
for (const c of exclude) for (const r of await queueOf(c, false)) excluded.add(r);
const only = new Set();
for (const c of recipientsOf) for (const r of await queueOf(c, true)) only.add(r);
if (recipientsOf.length && !only.size) { console.error("--recipients-of: nobody was sent those campaigns"); await bye(1); }
if (earlier.size) {
  const ids = [...earlier];
  let oldest = null;
  for (let i = 0; i < ids.length; i += 200) {
    const { data: ps, error: pe } = await admin.from("profiles").select("created_at").in("id", ids.slice(i, i + 200)).order("created_at").limit(1);
    if (pe) throw new Error(pe.message);
    if (ps[0] && (!oldest || ps[0].created_at < oldest)) oldest = ps[0].created_at;
  }
  if (oldest && oldest < cutoff) cutoff = oldest;
}

const { data: suppressed } = await admin.from("email_suppressions").select("email").limit(5000);
const never = new Set((suppressed ?? []).map((s) => s.email));
const seen = new Set(), picked = [], passed = { badAddress: 0, duplicate: 0, suppressed: 0, alreadyInExcludedCampaigns: 0, notOnAnyMore: 0 };
if (only.size) {
  const { count: total } = { count: only.size };
  let on = 0;
  const ids = [...only];
  for (let i = 0; i < ids.length; i += 200) {
    const { data: ps, error: pe } = await admin.from("profiles").select("id, email, created_at").in("id", ids.slice(i, i + 200)).eq("email_updates", true).not("email", "is", null);
    if (pe) throw new Error(pe.message);
    on += ps.length;
    for (const p of ps) {
      const check = checkEmailAddress(p.email);
      if (!check.ok) { passed.badAddress++; continue; }
      if (seen.has(check.email)) { passed.duplicate++; continue; }
      seen.add(check.email);
      if (never.has(check.email)) { passed.suppressed++; continue; }
      picked.push({ profile_id: p.id, email: check.email, created_at: p.created_at });
    }
  }
  passed.notOnAnyMore = total - on;
  picked.sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (picked.length > count) picked.length = count;
}
for (let from = 0; !only.size && picked.length < count; from += 1000) { // PostgREST returns at most 1000 rows per call
  let q = admin.from("profiles").select("id, email, created_at").eq("email_updates", true).not("email", "is", null)
    [earlier.size ? "lt" : "lte"]("created_at", cutoff);
  if (since) q = q.gte("created_at", new Date(since).toISOString());
  if (before) q = q.lt("created_at", new Date(before).toISOString());
  const { data: newest, error } = await q.order("created_at", { ascending: false }).order("id").range(from, from + 999);
  if (error) throw new Error(error.message);
  for (const p of newest) {
    if (picked.length >= count) break;
    if (earlier.has(p.id)) continue;
    if (excluded.has(p.id)) { passed.alreadyInExcludedCampaigns++; continue; }
    const check = checkEmailAddress(p.email);
    if (!check.ok) { passed.badAddress++; continue; }
    if (seen.has(check.email)) { passed.duplicate++; continue; }
    seen.add(check.email);
    if (never.has(check.email)) { passed.suppressed++; continue; }
    picked.push({ profile_id: p.id, email: check.email, created_at: p.created_at });
  }
  if (newest.length < 1000) break;
}
// Evenly over the window, in a random order (so one mail provider doesn't get a run of them), a little off the beat.
const order = picked.map((p) => ({ p, r: Math.random() })).sort((a, b) => a.r - b.r).map((x) => x.p);
const step = (hours * 3600_000) / Math.max(1, order.length);
const rows = order.map((p, i) => ({ campaign: id, profile_id: p.profile_id, email: p.email, send_after: new Date(start.getTime() + i * step + Math.floor(Math.random() * Math.min(40_000, step / 2))).toISOString() }));
const end = new Date(start.getTime() + hours * 3600_000);
const dropAfter = new Date(end.getTime() + 90 * 60_000);
const providers = {};
for (const p of picked) { const d = p.email.split("@")[1]; const k = /^(gmail|googlemail)\.com$/.test(d) ? "Gmail" : /^(outlook|hotmail|live|msn)\./.test(d) ? "Microsoft" : /^(icloud|me|mac)\.com$/.test(d) ? "Apple" : /^(yahoo|ymail|aol)\./.test(d) ? "Yahoo" : "other"; providers[k] = (providers[k] ?? 0) + 1; }
const footer = emailFooter({ unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=…&t=…", why: def.why, plain: def.plain === true });

console.log(JSON.stringify({
  campaign: id, from: def.from, replyTo: def.replyTo, subject: def.subject,
  people: picked.length, wanted: countArg, passedOver: passed,
  who: only.size ? { recipientsOf } : { after: after.length ? after : null, signedUpSince: since, signedUpBefore: before, exclude: exclude.length ? exclude : null },
  signedUpBetween: picked.length ? [picked.at(-1).created_at.slice(0, 16), picked[0].created_at.slice(0, 16)] : null,
  providers,
  after: after.length ? after : null, onlyIfThisWentWell: dependsOn ?? null,
  firstEmail: when(start), lastEmail: when(end), oneEvery: `${Math.round(step / 1000)} seconds`, droppedIfNotSentBy: when(dropAfter),
  alreadyQueued: existing ? existing.status : false,
}, null, 1));
console.log("\n----- the email (text version) -----\n" + def.render(footer).text + "\n------------------------------------"
  + (def.linkTo === "cutaway" ? "\n(The one link: the Cutaway Explainer page if CUTAWAY_ENABLED is \"true\" when each email goes out, otherwise tryzyvo.com, as shown above.)" : ""));

if (!flag("--queue")) { console.log("\nPlan only: nothing was written. Add --queue to write it (status \"waiting\": nothing is sent until --approve)."); await bye(0); }
if (existing) { console.error(`\n${id} is already queued (status "${existing.status}"): not written again.`); await bye(1); }
if (!picked.length) { console.error("\nNobody to send to."); await bye(1); }
const { error: e1 } = await admin.from("email_campaigns").insert({ id, status: "waiting", planned: rows.length, starts_at: start.toISOString(), ends_at: dropAfter.toISOString(), depends_on: dependsOn ?? null });
if (e1) throw new Error(e1.message);
const { error: e2 } = await admin.from("email_campaign_queue").insert(rows);
if (e2) { await admin.from("email_campaigns").delete().eq("id", id); throw new Error(e2.message); }
console.log(`\nQueued: ${rows.length} people for ${id}, status "waiting". Nothing is sent until --approve.`);
