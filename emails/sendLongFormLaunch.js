// Long Form launch email — ADMIN ONLY (needs the service role + Resend keys in .env.local; run locally).
// All sending goes through emails/marketing.js: only email_updates = true, never
// a suppressed address, once per person, from mail.tryzyvo.com, one at a time.
//
//   node emails/sendLongFormLaunch.js
//       Dry run (the default): counts the recipients, writes a preview to
//       emails/.preview/long-form-launch.html. Sends nothing.
//   node emails/sendLongFormLaunch.js --test you@example.com
//       Sends ONE proof copy to that address (its own working unsubscribe link if
//       the address has a Zyvo profile).
//   node emails/sendLongFormLaunch.js --send --confirm long-form-launch [--count 200]
//       The real send: at most --count emails this run (200 unless given, never
//       more than 1,000), one a second. People who already got it are skipped:
//       the 6,529 of 1 October are in emails/.sent/, and the database gate
//       refuses a second copy to anyone it has let through.
import fs from "node:fs";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { LongFormLaunchEmail } from "./LongFormLaunchEmail.js";
import { campaignBlockers, campaignMessage, marketingRecipients, sendCampaign, sendMarketing, DEFAULT_PER_RUN, MAX_PER_RUN } from "./marketing.js";

dotenv.config({ path: ".env.local" });
const CAMPAIGN = "long_form_launch";
const HERO = "https://www.tryzyvo.com/email/long-form-hero.png";
const LOG = "emails/.sent/long-form-launch.jsonl";
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const mode = flag("--send") ? "send" : flag("--test") ? "test" : "dry";

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, EMAIL_UNSUBSCRIBE_SECRET: process.env.EMAIL_UNSUBSCRIBE_SECRET, ...(mode !== "dry" ? { RESEND_API_KEY: process.env.RESEND_API_KEY } : {}) })) {
  if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
}
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const resend = mode === "dry" ? null : new Resend(process.env.RESEND_API_KEY);
const alreadySent = () => new Set(fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);

if (mode === "dry") {
  const { list, skipped, optedIn } = await marketingRecipients(admin);
  const sent = alreadySent();
  fs.mkdirSync("emails/.preview", { recursive: true });
  // A made-up recipient (never a real user's name or unsubscribe link in a local file).
  const sample = { id: "00000000-0000-0000-0000-000000000000", email: "preview@example.com", full_name: "Alex Example" };
  fs.writeFileSync("emails/.preview/long-form-launch.html", campaignMessage({ profile: sample, campaign: CAMPAIGN, render: LongFormLaunchEmail }).html);
  console.log(JSON.stringify({ mode, optedIn, skipped, recipients: list.length, alreadySent: sent.size, toSend: list.filter((p) => !sent.has(p.id)).length, perRun: DEFAULT_PER_RUN, cannotSendBecause: campaignBlockers(), preview: "emails/.preview/long-form-launch.html" }, null, 1));
  process.exit(0);
}

const blockers = campaignBlockers();
if (blockers.length) { console.error(`Refusing: ${blockers.join("; ")}`); process.exit(1); }

if (mode === "test") {
  const to = String(val("--test") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { console.error("Usage: --test you@example.com"); process.exit(1); }
  const { data: p } = await admin.from("profiles").select("id, email, full_name").ilike("email", to).maybeSingle();
  // No profile: a link signed for a non-existent id (the page then says it isn't valid).
  const r = await sendMarketing({ admin, resend, campaign: CAMPAIGN, profile: { id: p?.id ?? crypto.randomUUID(), email: to, full_name: p?.full_name ?? null }, render: LongFormLaunchEmail, test: true });
  console.log(JSON.stringify({ mode, to, profile: !!p, ...r }));
  process.exit(r.sent ? 0 : 1);
}

// --send
if (val("--confirm") !== "long-form-launch") { console.error("Refusing: add --confirm long-form-launch"); process.exit(1); }
const count = val("--count") == null ? DEFAULT_PER_RUN : Number(val("--count"));
if (!Number.isInteger(count) || count < 1 || count > MAX_PER_RUN) { console.error(`Refusing: --count must be a whole number from 1 to ${MAX_PER_RUN}`); process.exit(1); }
const hero = await fetch(HERO, { method: "HEAD" }).catch(() => null);
if (!hero?.ok || !/image\//.test(hero.headers.get("content-type") ?? "")) { console.error(`Refusing: the hero image isn't live at ${HERO} (deploy the frontend first).`); process.exit(1); }

const sent = alreadySent();
const todo = (await marketingRecipients(admin)).list.filter((p) => !sent.has(p.id));
console.log(`Sending to at most ${Math.min(count, todo.length)} of ${todo.length} profiles, one a second…`);
fs.mkdirSync("emails/.sent", { recursive: true });
const sentIds = [];
const totals = await sendCampaign({
  admin, resend, campaign: CAMPAIGN, recipients: todo, render: LongFormLaunchEmail, count,
  onResult: (p, r) => {
    if (!r.sent) return;
    fs.appendFileSync(LOG, JSON.stringify({ id: p.id, resendId: r.resendId, at: new Date().toISOString() }) + "\n");
    sentIds.push(p.id);
    if (sentIds.length % 25 === 0) console.log(`${sentIds.length} sent`);
  },
});
for (let i = 0; i < sentIds.length; i += 200) {
  await admin.from("profiles").update({ last_email_type: CAMPAIGN, last_email_sent_at: new Date().toISOString() }).in("id", sentIds.slice(i, i + 200));
}
console.log(JSON.stringify({ mode, ...totals, log: LOG }));
