// $0, READ-ONLY: how did the Long Form launch email go? Three sources:
//  - the send script's own log (emails/.sent/long-form-launch.jsonl)
//  - the database (who was marked as sent, who has unsubscribed since)
//  - Resend (GET only): the last event of every email in the log
// Prints counts only: no addresses, no names. Sends nothing.
//   node --env-file=.env.local scripts/launchEmailReport.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const LOG = "emails/.sent/long-form-launch.jsonl";
const rows = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const ids = new Set(rows.map((r) => r.id));
const resendIds = new Set(rows.map((r) => r.resendId).filter(Boolean));
const times = rows.map((r) => r.at).sort();
console.log("send log:", JSON.stringify({ lines: rows.length, profiles: ids.size, withResendId: resendIds.size, first: times[0], last: times[times.length - 1] }));

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
const marked = await all(() => admin.from("profiles").select("id, email_updates, last_email_sent_at").eq("last_email_type", "long_form_launch").order("id"));
const { count: optedInNow } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("email_updates", true);
const { count: profiles } = await admin.from("profiles").select("id", { count: "exact", head: true });
const sentProfiles = await all(() => admin.from("profiles").select("id, email_updates, created_at").in("id", [...ids].slice(0, 0).concat([])).order("id")).catch(() => []);
void sentProfiles;
// The profiles in the log, in chunks (an IN list of 6,500 ids is too long for one request).
const logged = [];
const idList = [...ids];
for (let i = 0; i < idList.length; i += 200) {
  const { data, error } = await admin.from("profiles").select("id, email_updates").in("id", idList.slice(i, i + 200));
  if (error) throw new Error(error.message);
  logged.push(...data);
}
console.log("database:", JSON.stringify({
  profilesTotal: profiles, optedInNow,
  markedAsSent: marked.length, markedAlsoInLog: marked.filter((p) => ids.has(p.id)).length,
  loggedProfilesFound: logged.length, loggedNowOptedOut: logged.filter((p) => !p.email_updates).length,
  sentAt: [marked.map((p) => p.last_email_sent_at).sort()[0], marked.map((p) => p.last_email_sent_at).sort().at(-1)],
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
// One email in full detail (no address printed): which fields does Resend report?
const one = rows.find((r) => r.resendId);
if (one) {
  const res = await fetch(`https://api.resend.com/emails/${one.resendId}`, { headers: { Authorization: `Bearer ${key}` } });
  const e = await res.json().catch(() => ({}));
  console.log("resend sample fields:", JSON.stringify({ status: res.status, keys: Object.keys(e), last_event: e.last_event, tags: e.tags }));
}
const dom = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
const domains = await dom.json().catch(() => ({}));
console.log("resend domains:", JSON.stringify((domains.data ?? []).map((d) => ({ name: d.name, status: d.status, region: d.region })), null, 0), dom.status);
