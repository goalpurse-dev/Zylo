// Long Form email #2 ("ideas") — ADMIN ONLY (needs the service role + Resend keys in .env.local; run locally).
//
//   node emails/sendLongFormIdeas.js
//       DRY RUN (the default; an unknown or misspelt option is refused, never
//       guessed): sends nothing. Prints the from address, the subject and how many
//       people it would send to, and writes a preview to
//       emails/.preview/long-form-ideas.html.
//   node emails/sendLongFormIdeas.js --test you@example.com
//       Sends ONE copy to that address only.
//   node emails/sendLongFormIdeas.js --send
//       The real send. Prints the recipient count and waits for you to type
//       SEND; anything else aborts. Only works in a terminal (never when the
//       input is piped), so nothing but a person typing can confirm it.
//
// Who gets it: profiles with email_updates = true, one email per address,
// minus anyone who has already started a Long Form video (pressed Generate at
// least once). Both rules are re-checked for every batch right before it goes
// out. Resend batches of 100 with an idempotency key, about 2 batches a second.
// Safe to re-run: every sent profile is logged to emails/.sent/long-form-ideas.jsonl
// and never sent to again.
import fs from "node:fs";
import crypto from "node:crypto";
import readline from "node:readline/promises";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { LongFormIdeasEmail } from "./LongFormIdeasEmail.js";
import { unsubscribeLinks } from "./unsubscribeLink.js";

dotenv.config({ path: ".env.local" });
const FROM = "Zyvo <hello@tryzyvo.com>";
const CAMPAIGN = "long_form_ideas";
const BATCH = 100;
const LOG = "emails/.sent/long-form-ideas.jsonl";
const PREVIEW = "emails/.preview/long-form-ideas.html";
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SECRET = process.env.EMAIL_UNSUBSCRIBE_SECRET;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const n = (x) => Number(x).toLocaleString("en-US");

// ---- Mode. No flag = dry run. Anything unexpected stops here, before any key is read.
const args = process.argv.slice(2);
const known = new Set(["--test", "--send"]);
const flags = args.filter((a) => a.startsWith("--"));
const unknown = flags.filter((a) => !known.has(a));
if (unknown.length) { console.error(`Unknown option ${unknown.join(", ")}. Use no option (dry run), --test you@example.com, or --send.`); process.exit(1); }
if (flags.includes("--send") && flags.includes("--test")) { console.error("Use either --test or --send, not both."); process.exit(1); }
const mode = flags.includes("--send") ? "send" : flags.includes("--test") ? "test" : "dry";
if (mode !== "test" && args.some((a) => !a.startsWith("--"))) { console.error(`Unexpected argument "${args.find((a) => !a.startsWith("--"))}".`); process.exit(1); }

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, EMAIL_UNSUBSCRIBE_SECRET: SECRET, ...(mode !== "dry" ? { RESEND_API_KEY: process.env.RESEND_API_KEY } : {}) })) {
  if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
}
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// The dry run never creates a Resend client: it cannot send.
const resend = mode === "dry" ? null : new Resend(process.env.RESEND_API_KEY);

const messageFor = (p) => {
  const { pageUrl, oneClickUrl } = unsubscribeLinks(p.id, { secret: SECRET, supabaseUrl: SUPABASE_URL });
  const m = LongFormIdeasEmail({ name: p.full_name, unsubscribeUrl: pageUrl, oneClickUrl });
  return { from: FROM, to: p.email, subject: m.subject, html: m.html, text: m.text, headers: m.headers, tags: [{ name: "campaign", value: CAMPAIGN }] };
};

// Paged read (PostgREST returns at most 1000 rows per call).
async function all(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

// Everyone who has already started a Long Form video: pressed Generate at least
// once, which is when a credit hold (reservation) is created for the project.
async function longFormCreators(ids = null) {
  if (ids) {
    const { data, error } = await admin.from("long_form_project_reservations").select("user_id").in("user_id", ids);
    if (error) throw error;
    return new Set(data.map((r) => r.user_id));
  }
  return new Set((await all(() => admin.from("long_form_project_reservations").select("user_id").order("id"))).map((r) => r.user_id));
}

// Opted-in profiles, one per address, minus the Long Form creators.
async function audience() {
  const rows = await all(() => admin.from("profiles").select("id, email, full_name").eq("email_updates", true).not("email", "is", null).order("id"));
  const seen = new Set();
  const valid = rows.filter((p) => {
    const e = String(p.email).trim().toLowerCase();
    if (!EMAIL.test(e) || e.endsWith("@zyvo-internal.test") || seen.has(e)) return false;
    seen.add(e);
    return true;
  });
  const creators = await longFormCreators();
  const list = valid.filter((p) => !creators.has(p.id));
  return { optedIn: rows.length, valid: valid.length, madeLongForm: valid.length - list.length, list };
}
const alreadySent = () => new Set(fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);

function summary({ optedIn, valid, madeLongForm, list }, sent) {
  const todo = list.filter((p) => !sent.has(p.id));
  const subject = LongFormIdeasEmail({ name: null, unsubscribeUrl: "https://tryzyvo.com/unsubscribe" }).subject;
  console.log(`From:     ${FROM}`);
  console.log(`Subject:  ${subject}`);
  console.log(`Opted in (email_updates = true):            ${n(optedIn)}`);
  console.log(`  not a usable or unique address:          -${n(optedIn - valid)}`);
  console.log(`  already started a Long Form video:       -${n(madeLongForm)}`);
  console.log(`  already sent this email (send log):      -${n(list.length - todo.length)}`);
  console.log(`Recipients:                                 ${n(todo.length)}  (${n(Math.ceil(todo.length / BATCH))} batches of ${BATCH})`);
  return todo;
}

if (mode === "dry") {
  console.log("DRY RUN: nothing is sent.\n");
  summary(await audience(), alreadySent());
  fs.mkdirSync("emails/.preview", { recursive: true });
  // A made-up recipient (never a real user's name or unsubscribe link in a local file).
  const sample = { id: "00000000-0000-0000-0000-000000000000", email: "preview@example.com", full_name: "Alex Example" };
  fs.writeFileSync(PREVIEW, messageFor(sample).html);
  console.log(`\nPreview written to ${PREVIEW} (open it in a browser).`);
  console.log("To send one test copy:  node emails/sendLongFormIdeas.js --test you@example.com");
  console.log("To send for real:       node emails/sendLongFormIdeas.js --send");
  process.exit(0);
}

if (mode === "test") {
  const to = String(args[args.indexOf("--test") + 1] ?? "").trim().toLowerCase();
  if (!EMAIL.test(to)) { console.error("Usage: node emails/sendLongFormIdeas.js --test you@example.com"); process.exit(1); }
  const { data: p } = await admin.from("profiles").select("id, email, full_name").ilike("email", to).maybeSingle();
  // No profile: a link signed for a non-existent id (the page then says it isn't valid).
  const m = messageFor(p ?? { id: crypto.randomUUID(), email: to, full_name: null });
  const { data, error } = await resend.emails.send({ ...m, to, subject: `[TEST] ${m.subject}` });
  console.log(error ? `Test NOT sent: ${error.message}` : `One test copy sent to ${to} (Resend id ${data?.id}). Not written to the send log.`);
  process.exit(error ? 1 : 0);
}

// ---- --send
if (!process.stdin.isTTY) { console.error("Refusing: --send must be run in a terminal, where you can type SEND. Nothing was sent."); process.exit(1); }
const thumb = LongFormIdeasEmail({ name: null, unsubscribeUrl: "https://tryzyvo.com/unsubscribe" }).html.match(/<img src="([^"]+)"/)?.[1];
const image = await fetch(thumb, { method: "HEAD" }).catch(() => null);
if (!image?.ok) { console.error(`Refusing: the tutorial thumbnail doesn't load (${thumb}). Nothing was sent.`); process.exit(1); }

console.log("REAL SEND\n");
const sent = alreadySent();
const todo = summary(await audience(), sent);
if (!todo.length) { console.log("\nNobody left to send to."); process.exit(0); }
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(`\nType SEND to email these ${n(todo.length)} people now (anything else cancels): `);
rl.close();
if (answer !== "SEND") { console.log("Cancelled. Nothing was sent."); process.exit(1); }

fs.mkdirSync("emails/.sent", { recursive: true });
const batches = Math.ceil(todo.length / BATCH);
let ok = 0, failed = 0, dropped = 0;
for (let i = 0; i < todo.length; i += BATCH) {
  let batch = todo.slice(i, i + BATCH);
  const label = `batch ${i / BATCH + 1}/${batches}`;
  // Re-check right before sending: still opted in, and still no Long Form video.
  const ids = batch.map((p) => p.id);
  const { data: still, error: checkError } = await admin.from("profiles").select("id").in("id", ids).eq("email_updates", true);
  let creators;
  try { creators = checkError ? null : await longFormCreators(ids); } catch { creators = null; }
  if (checkError || !creators) {
    failed += batch.length;
    console.error(`${label}: could not re-check the recipients, so it was NOT sent (a re-run retries it)`);
    continue;
  }
  const keep = new Set(still.map((r) => r.id));
  const before = batch.length;
  batch = batch.filter((p) => keep.has(p.id) && !creators.has(p.id));
  dropped += before - batch.length;
  if (!batch.length) continue;
  const key = `${CAMPAIGN}/${crypto.createHash("sha1").update(batch.map((p) => p.id).join(",")).digest("hex")}`;
  const { data, error } = await resend.batch.send(batch.map(messageFor), { idempotencyKey: key });
  if (error) {
    failed += batch.length;
    console.error(`${label}: ${error.message} (not logged, a re-run retries it)`);
  } else {
    const resendIds = data?.data ?? [];
    fs.appendFileSync(LOG, batch.map((p, k) => JSON.stringify({ id: p.id, resendId: resendIds[k]?.id ?? null, at: new Date().toISOString() })).join("\n") + "\n");
    await admin.from("profiles").update({ last_email_type: CAMPAIGN, last_email_sent_at: new Date().toISOString() }).in("id", batch.map((p) => p.id));
    ok += batch.length;
    console.log(`${label}: ${batch.length} sent (${n(ok)} of ${n(todo.length)})`);
  }
  await new Promise((r) => setTimeout(r, 600)); // Resend's default limit: 2 requests/s
}
console.log(`\nDone. Sent: ${n(ok)}. Failed: ${n(failed)}. Dropped at the last check (unsubscribed or started a video meanwhile): ${n(dropped)}.`);
console.log(`Send log: ${LOG}${failed ? "\nRun the same command again to retry the failed batches; nobody in the log is emailed twice." : ""}`);
