// $0, READ-ONLY: how did a campaign email go? Three sources:
//  - the send script's own log (emails/.sent/<campaign>.jsonl)
//  - Resend (GET only): the last event of every email in the log, and whether
//    tracking is on for the sending domain
//  - the database: who was marked as sent, who has unsubscribed since, and what
//    the recipients did afterwards (Long Form projects, Generate, new plans)
// Prints counts only: no addresses, no names. Sends nothing.
//   node --env-file=.env.local scripts/launchEmailReport.mjs [long-form-launch | long-form-ideas]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const campaign = process.argv[2] ?? "long-form-launch";
const LOG = `emails/.sent/${campaign}.jsonl`;
const TYPE = campaign.replace(/-/g, "_");
const rows = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
if (!rows.length) { console.log(`No send log at ${LOG}`); process.exit(0); }
const ids = new Set(rows.map((r) => r.id));
const resendIds = new Set(rows.map((r) => r.resendId).filter(Boolean));
const times = rows.map((r) => r.at).sort();
const sentAt = times[0];
console.log("send log:", JSON.stringify({ campaign, lines: rows.length, profiles: ids.size, withResendId: resendIds.size, first: times[0], last: times[times.length - 1] }));

const admin = createClient(process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const all = async (build) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) return out;
  }
};
const marked = await all(() => admin.from("profiles").select("id").eq("last_email_type", TYPE).order("id"));
const logged = [];
const idList = [...ids];
for (let i = 0; i < idList.length; i += 200) {
  const { data, error } = await admin.from("profiles").select("id, email_updates, plan_code").in("id", idList.slice(i, i + 200));
  if (error) throw new Error(error.message);
  logged.push(...data);
}
console.log("database:", JSON.stringify({ markedAsSent: marked.length, markedAlsoInLog: marked.filter((p) => ids.has(p.id)).length, loggedProfilesFound: logged.length, loggedNowOptedOut: logged.filter((p) => !p.email_updates).length }));

// What the recipients did after the send (not proof the email caused it).
const projects = await all(() => admin.from("long_form_projects").select("id, user_id, created_at").gte("created_at", sentAt).order("id"));
const reservations = await all(() => admin.from("long_form_project_reservations").select("user_id, created_at").gte("created_at", sentAt).order("id"));
const grants = await all(() => admin.from("credit_grants").select("user_id, reason, amount, created_at").gte("created_at", sentAt).order("created_at"));
const earlier = new Set((await all(() => admin.from("credit_grants").select("user_id, created_at").eq("reason", "plan_renewal").lt("created_at", sentAt).order("created_at"))).map((g) => g.user_id));
const mine = (list) => list.filter((x) => ids.has(x.user_id));
const users = (list) => new Set(list.map((x) => x.user_id)).size;
const planGrants = mine(grants).filter((g) => g.reason === "plan_renewal");
console.log("after the send (recipients only):", JSON.stringify({
  since: sentAt,
  longFormProjectsCreated: mine(projects).length, byUsers: users(mine(projects)),
  pressedGenerate: mine(reservations).length, generateUsers: users(mine(reservations)),
  planPayments: planGrants.length, firstEverPlanPayment: users(planGrants.filter((g) => !earlier.has(g.user_id))),
  topUps: mine(grants).filter((g) => /topup|top_up/i.test(g.reason)).length,
  allSiteWide: { longFormProjects: projects.length, pressedGenerate: reservations.length },
}));

// Resend: page through the account's sent emails and keep the ones in the log.
const key = process.env.RESEND_API_KEY;
if (!key) { console.log("resend: RESEND_API_KEY is not set"); process.exit(0); }
const events = {}, subjects = {}, bySender = {};
let matched = 0, pages = 0, after = null, scanned = 0, note = null;
for (;;) {
  const res = await fetch(`https://api.resend.com/emails?limit=100${after ? `&after=${after}` : ""}`, { headers: { Authorization: `Bearer ${key}` } });
  if (res.status === 429) { await new Promise((r) => setTimeout(r, 1500)); continue; }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { note = `list failed: ${res.status} ${body?.message ?? body?.name ?? ""}`; break; }
  pages += 1;
  for (const e of body.data ?? []) {
    scanned += 1;
    if (!resendIds.has(e.id)) continue;
    matched += 1;
    events[e.last_event ?? "unknown"] = (events[e.last_event ?? "unknown"] ?? 0) + 1;
    subjects[e.subject] = (subjects[e.subject] ?? 0) + 1;
    bySender[e.from] = (bySender[e.from] ?? 0) + 1;
  }
  if (!body.has_more || !(body.data ?? []).length || matched >= resendIds.size) break;
  after = body.data[body.data.length - 1].id;
  await new Promise((r) => setTimeout(r, 550));
}
console.log("resend:", JSON.stringify({ pages, scanned, matched, of: resendIds.size, lastEvent: events, subjects, from: bySender, note }));
const dom = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
const domains = (await dom.json().catch(() => ({}))).data ?? [];
for (const d of domains) {
  const one = await (await fetch(`https://api.resend.com/domains/${d.id}`, { headers: { Authorization: `Bearer ${key}` } })).json().catch(() => ({}));
  console.log("resend domain:", JSON.stringify({ name: one.name, status: one.status, open_tracking: one.open_tracking, click_tracking: one.click_tracking }));
}
