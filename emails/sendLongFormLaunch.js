// Long Form launch email — ADMIN ONLY (needs the service role + Resend keys in .env.local; run locally).
//
//   node emails/sendLongFormLaunch.js
//       Dry run (the default): counts the recipients, writes a preview to
//       emails/.preview/long-form-launch.html. Sends nothing.
//   node emails/sendLongFormLaunch.js --test you@example.com
//       Sends ONE email to that address (its own working unsubscribe link if
//       the address has a Zyvo profile).
//   node emails/sendLongFormLaunch.js --send --confirm long-form-launch
//       The real send: ONLY profiles with email_updates = true, de-duplicated,
//       in Resend batches of 100 (idempotency key per batch, ~2 batches/s).
//       Refuses while the footer address is a placeholder or the hero image isn't
//       live. Resumable: every sent profile is logged to emails/.sent/ and skipped
//       on a re-run; each batch is re-checked against email_updates right before
//       it goes out (someone who unsubscribed meanwhile is dropped).
import fs from "node:fs";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { LongFormLaunchEmail, FOOTER_ADDRESS } from "./LongFormLaunchEmail.js";
import { unsubscribeLinks } from "./unsubscribeLink.js";

dotenv.config({ path: ".env.local" });
const FROM = "Zyvo <hello@tryzyvo.com>";
const CAMPAIGN = "long_form_launch";
const HERO = "https://tryzyvo.com/email/long-form-hero.png";
const BATCH = 100;
const LOG = "emails/.sent/long-form-launch.jsonl";
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SECRET = process.env.EMAIL_UNSUBSCRIBE_SECRET;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const mode = flag("--send") ? "send" : flag("--test") ? "test" : "dry";

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, EMAIL_UNSUBSCRIBE_SECRET: SECRET, ...(mode !== "dry" ? { RESEND_API_KEY: process.env.RESEND_API_KEY } : {}) })) {
  if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
}
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const resend = mode === "dry" ? null : new Resend(process.env.RESEND_API_KEY);

const messageFor = (p) => {
  const { pageUrl, oneClickUrl } = unsubscribeLinks(p.id, { secret: SECRET, supabaseUrl: SUPABASE_URL });
  const m = LongFormLaunchEmail({ name: p.full_name, unsubscribeUrl: pageUrl, oneClickUrl });
  return { from: FROM, to: p.email, subject: m.subject, html: m.html, text: m.text, headers: m.headers, tags: [{ name: "campaign", value: CAMPAIGN }] };
};

// Every opted-in profile (paged: PostgREST returns at most 1000 rows per call).
async function recipients() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("profiles").select("id, email, full_name").eq("email_updates", true).not("email", "is", null).order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const seen = new Set();
  return rows.filter((p) => {
    const e = String(p.email).trim().toLowerCase();
    if (!EMAIL.test(e) || e.endsWith("@zyvo-internal.test") || seen.has(e)) return false;
    seen.add(e);
    return true;
  });
}
const alreadySent = () => new Set(fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);

if (mode === "dry") {
  const list = await recipients();
  const sent = alreadySent();
  fs.mkdirSync("emails/.preview", { recursive: true });
  // A made-up recipient (never a real user's name or unsubscribe link in a local file).
  const sample = { id: "00000000-0000-0000-0000-000000000000", email: "preview@example.com", full_name: "Alex Example" };
  fs.writeFileSync("emails/.preview/long-form-launch.html", messageFor(sample).html);
  console.log(JSON.stringify({ mode, recipients: list.length, alreadySent: sent.size, toSend: list.filter((p) => !sent.has(p.id)).length, batches: Math.ceil(list.filter((p) => !sent.has(p.id)).length / BATCH), footerAddressSet: !FOOTER_ADDRESS.includes("["), preview: "emails/.preview/long-form-launch.html" }, null, 1));
  process.exit(0);
}

if (mode === "test") {
  const to = String(val("--test") ?? "").trim().toLowerCase();
  if (!EMAIL.test(to)) { console.error("Usage: --test you@example.com"); process.exit(1); }
  const { data: p } = await admin.from("profiles").select("id, email, full_name").ilike("email", to).maybeSingle();
  // No profile: a link signed for a non-existent id (the page then says it isn't valid).
  const m = messageFor(p ?? { id: crypto.randomUUID(), email: to, full_name: null });
  const { data, error } = await resend.emails.send({ ...m, to, subject: `[TEST] ${m.subject}` });
  console.log(JSON.stringify({ mode, to, profile: !!p, id: data?.id ?? null, error: error?.message ?? null }));
  process.exit(error ? 1 : 0);
}

// --send
if (val("--confirm") !== "long-form-launch") { console.error("Refusing: add --confirm long-form-launch"); process.exit(1); }
if (FOOTER_ADDRESS.includes("[")) { console.error("Refusing: set FOOTER_ADDRESS in emails/LongFormLaunchEmail.js (business name + postal address)."); process.exit(1); }
const hero = await fetch(HERO, { method: "HEAD" }).catch(() => null);
if (!hero?.ok || !/image\//.test(hero.headers.get("content-type") ?? "")) { console.error(`Refusing: the hero image isn't live at ${HERO} (deploy the frontend first).`); process.exit(1); }

const sent = alreadySent();
const todo = (await recipients()).filter((p) => !sent.has(p.id));
console.log(`Sending to ${todo.length} profiles in ${Math.ceil(todo.length / BATCH)} batches…`);
fs.mkdirSync("emails/.sent", { recursive: true });
let ok = 0, failed = 0;
for (let i = 0; i < todo.length; i += BATCH) {
  let batch = todo.slice(i, i + BATCH);
  // Re-check consent right before sending (an unsubscribe during the run wins).
  const { data: still } = await admin.from("profiles").select("id").in("id", batch.map((p) => p.id)).eq("email_updates", true);
  const keep = new Set((still ?? []).map((r) => r.id));
  batch = batch.filter((p) => keep.has(p.id));
  if (!batch.length) continue;
  const key = `${CAMPAIGN}/${crypto.createHash("sha1").update(batch.map((p) => p.id).join(",")).digest("hex")}`;
  const { data, error } = await resend.batch.send(batch.map(messageFor), { idempotencyKey: key });
  if (error) {
    failed += batch.length;
    console.error(`batch ${i / BATCH + 1}: ${error.message} — not logged, a re-run retries it`);
  } else {
    const ids = data?.data ?? [];
    fs.appendFileSync(LOG, batch.map((p, k) => JSON.stringify({ id: p.id, resendId: ids[k]?.id ?? null, at: new Date().toISOString() })).join("\n") + "\n");
    await admin.from("profiles").update({ last_email_type: CAMPAIGN, last_email_sent_at: new Date().toISOString() }).in("id", batch.map((p) => p.id));
    ok += batch.length;
    console.log(`batch ${i / BATCH + 1}: ${batch.length} sent (${ok} total)`);
  }
  await new Promise((r) => setTimeout(r, 600)); // Resend's default limit: 2 requests/s
}
console.log(JSON.stringify({ mode, sent: ok, failed, log: LOG }));
