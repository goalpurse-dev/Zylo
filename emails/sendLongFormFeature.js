// "Long Form feature" email to the 200 most engaged opted-in users. ADMIN ONLY
// (needs the service role + Resend keys in .env.local; run locally). Day 1 of
// warming up the marketing domain: small, careful, once per person.
//
//   node emails/sendLongFormFeature.js [--subject 1|2|3] [--refresh]
//       DRY RUN (the default; an unknown option is refused, never guessed):
//       sends nothing. Picks the 200, says how, freezes that list in
//       emails/.sent/long-form-feature-audience.json, writes a preview to
//       emails/.preview/ and prints the confirmation code for --send.
//       --refresh reads Resend's history again instead of the local copy.
//   node emails/sendLongFormFeature.js --test you@example.com [--subject N]
//       Sends ONE copy to that address only. Not written to the send log.
//   node emails/sendLongFormFeature.js --send --confirm <code>
//       The real send, to exactly the frozen list the dry run showed. The code
//       is tied to that list, the subject and the email's text: if any of them
//       changed since the dry run, it is refused. (In a terminal, --send alone
//       asks you to type SEND instead.)
//   node emails/sendLongFormFeature.js --report
//       Reads each sent email's status from Resend: delivered, bounced,
//       complained, clicked. Sends nothing.
//
// Who gets it (exactly 200):
//   - profiles with email_updates = true (explicit marketing consent), one per address
//   - never: an address that bounced, complained or is on Resend's suppression
//     list; an address whose domain has no mail server; anyone who got the
//     "you were almost done" loop emails or the old "you’re in" emails
//   - only addresses at mainstream mail providers (Gmail, iCloud, Outlook, …):
//     school and company domains filter strictly, and a block there counts
//     against a domain on its first day
//   - order: people who clicked the 3 Oct Long Form email first, then the most
//     recently active (last sign-in, generation, Long Form project or preview)
// Sending: From "Zyvo <updates@mail.tryzyvo.com>", reply-to support@tryzyvo.com,
// one-click unsubscribe headers + a footer link, batches of 10 with a pause.
// Once per person, ever: every recipient is written to
// emails/.sent/long-form-feature.jsonl BEFORE the send is attempted and is
// never tried again, and Resend gets an idempotency key per person on top.
import fs from "node:fs";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import readline from "node:readline/promises";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { LongFormFeatureEmail, SUBJECTS } from "./LongFormFeatureEmail.js";
import { unsubscribeLinks } from "./unsubscribeLink.js";

dotenv.config({ path: ".env.local", quiet: true });
const FROM = "Zyvo <updates@mail.tryzyvo.com>";
const REPLY_TO = "support@tryzyvo.com";
const CAMPAIGN = "long_form_feature";
const TARGET = 200, RESERVE = 20;
const BATCH = 10, PAUSE_BETWEEN_BATCHES_MS = 20_000, PAUSE_BETWEEN_SENDS_MS = 1000;
const LOG = "emails/.sent/long-form-feature.jsonl";
const AUDIENCE = "emails/.sent/long-form-feature-audience.json";
const HISTORY = "emails/.sent/resend-history.json";
const PREVIEW = "emails/.preview/long-form-feature";
const HISTORY_MAX_AGE_MS = 6 * 3600_000;
// The removed public scripts' emails (api/send-recovery-manual.js looped; api/send-welcome-emails.js).
const EXCLUDED_SUBJECTS = new Set(["you were almost done", "you’re in", "you're in"]);
const BAD_EVENTS = new Set(["bounced", "complained", "suppressed", "failed"]);
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SECRET = process.env.EMAIL_UNSUBSCRIBE_SECRET;
const EMAIL = /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
// Mail providers people sign up to themselves (not a school's or a company's own domain).
const MAINSTREAM_DOMAINS = new Set(["gmail.com", "googlemail.com", "icloud.com", "me.com", "mac.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "ymail.com", "rocketmail.com", "aol.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net", "gmx.de", "gmx.at", "gmx.ch", "web.de", "mail.com", "zoho.com", "interia.pl", "wp.pl", "o2.pl", "seznam.cz", "orange.fr", "free.fr", "laposte.net", "libero.it", "t-online.de", "yandex.com", "yandex.ru", "mail.ru", "naver.com", "qq.com", "163.com"]);
const MAINSTREAM_FAMILY = /^(outlook|hotmail|live|yahoo)\.(com?\.)?[a-z]{2,3}$/; // outlook.fr, yahoo.co.uk, hotmail.com.br, …
const isMainstream = (email) => { const d = email.split("@")[1] ?? ""; return MAINSTREAM_DOMAINS.has(d) || MAINSTREAM_FAMILY.test(d); };
const n = (x) => Number(x).toLocaleString("en-US");
const norm =(e) => String(e ?? "").trim().toLowerCase();
const mask = (e) => norm(e).replace(/^(.)[^@]*(@.*)$/, "$1***$2");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback);
const lines = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

// ---- Mode. No flag = dry run. Anything unexpected stops here, before any key is read.
const args = process.argv.slice(2);
const VALUE_FLAGS = new Set(["--test", "--subject", "--confirm"]);
const FLAGS = new Set([...VALUE_FLAGS, "--send", "--report", "--refresh"]);
const opt = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!FLAGS.has(a)) { console.error(`Unknown option "${a}". Use no option (dry run), --test you@example.com, --send --confirm <code>, or --report.`); process.exit(1); }
  opt[a] = VALUE_FLAGS.has(a) ? args[++i] ?? "" : true;
}
const modes = ["--send", "--test", "--report"].filter((f) => f in opt);
if (modes.length > 1) { console.error("Use only one of --test, --send, --report."); process.exit(1); }
const mode = modes[0]?.slice(2) ?? "dry";
if ("--confirm" in opt && mode !== "send") { console.error("--confirm only goes with --send."); process.exit(1); }
const subjectIndex = "--subject" in opt ? Number(opt["--subject"]) : null;
if (subjectIndex != null && ![1, 2, 3].includes(subjectIndex)) { console.error("--subject takes 1, 2 or 3."); process.exit(1); }

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, EMAIL_UNSUBSCRIBE_SECRET: SECRET, RESEND_API_KEY: process.env.RESEND_API_KEY })) {
  if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(1); }
}
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// Only --test and --send get a client that can send. The dry run and the report only read.
const resend = mode === "test" || mode === "send" ? new Resend(process.env.RESEND_API_KEY) : null;

// ---- Resend, read-only (one request a second: the live site's own emails share the limit).
async function resendGet(path) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`https://api.resend.com${path}`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
    if (r.status === 429 && attempt < 5) { await sleep(2000 * (attempt + 1)); continue; }
    if (!r.ok) throw new Error(`Resend GET ${path.split("?")[0]}: ${r.status}`);
    return r.json();
  }
}
async function resendPages(path, onPage) {
  let after = null, count = 0;
  for (;;) {
    const page = await resendGet(`${path}?limit=100${after ? `&after=${after}` : ""}`);
    const rows = page.data ?? [];
    count += rows.length;
    onPage(rows, count);
    if (!page.has_more || !rows.length) return;
    after = rows[rows.length - 1].id;
    await sleep(1000);
  }
}
// Every email Resend still lists (who got what, and what happened to it) + the suppression list.
async function resendHistory(refresh) {
  const cached = readJson(HISTORY, null);
  if (!refresh && cached && Date.now() - Date.parse(cached.fetchedAt) < HISTORY_MAX_AGE_MS) return cached;
  console.log("Reading Resend's history (about a request a second)…");
  const emails = [], suppressions = [];
  await resendPages("/emails", (rows, count) => {
    for (const e of rows) emails.push({ id: e.id, to: (e.to ?? []).map(norm), subject: e.subject, at: e.created_at, event: e.last_event });
    if (count % 2000 === 0) console.log(`  ${n(count)} emails…`);
  });
  await resendPages("/suppressions", (rows) => { for (const s of rows) suppressions.push({ email: norm(s.email), origin: s.origin }); });
  const out = { fetchedAt: new Date().toISOString(), emails, suppressions };
  fs.mkdirSync("emails/.sent", { recursive: true });
  fs.writeFileSync(HISTORY, JSON.stringify(out));
  return out;
}
async function suppressedNow() {
  const set = new Set();
  await resendPages("/suppressions", (rows) => { for (const s of rows) set.add(norm(s.email)); });
  return set;
}

// ---- Supabase reads
async function all(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
async function lastSignIns() {
  const map = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) if (u.last_sign_in_at) map.set(u.id, Date.parse(u.last_sign_in_at));
    if (data.users.length < 1000) return map;
  }
}
// Newest rows first, page by page, each page starting where the last one ended
// (cheap for the database at any depth, unlike skipping N rows; the live site
// uses the same tables). A failed read says which table it was.
async function newestSince(table, since) {
  const rows = [];
  for (let before = null; ;) {
    let q = admin.from(table).select("user_id, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(1000);
    if (before) q = q.lt("created_at", before);
    const { data, error } = await q;
    if (error) throw new Error(`reading ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
    before = data[data.length - 1].created_at;
  }
}
// Last time each account did something: signed in, generated, started a Long Form video or preview.
// Generations of the last 30 days are enough: the list is the most recently active people.
async function lastActivity() {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [signIns, jobs, projects, teasers] = await Promise.all([
    lastSignIns(),
    newestSince("jobs", since),
    all(() => admin.from("long_form_projects").select("user_id, created_at").order("created_at", { ascending: false }).order("id")),
    all(() => admin.from("long_form_teasers").select("user_id, created_at").order("created_at", { ascending: false }).order("id")),
  ]);
  const last = new Map(signIns);
  for (const r of [...jobs, ...projects, ...teasers]) {
    const t = Date.parse(r.created_at);
    if (r.user_id && t > (last.get(r.user_id) ?? 0)) last.set(r.user_id, t);
  }
  return last;
}

// A domain that can receive mail: an MX record, or (RFC 5321) an address record.
// Asked of public resolvers, not the machine's own: a local DNS proxy that
// refuses Node's queries would make every domain "could not be checked".
const resolver = new dns.Resolver({ timeout: 4000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);
const domainCache = new Map();
async function domainCanReceive(domain) {
  if (domainCache.has(domain)) return domainCache.get(domain);
  const check = (async () => {
    const tryResolve = (fn) => Promise.race([fn(), sleep(6000).then(() => { throw Object.assign(new Error("timeout"), { code: "ETIMEOUT" }); })]);
    try {
      const mx = await tryResolve(() => resolver.resolveMx(domain));
      return mx.some((r) => r.exchange && r.exchange !== ".") ? "ok" : "none";
    } catch (e) {
      if (!["ENODATA", "ENOTFOUND"].includes(e.code)) return "unknown"; // a DNS hiccup: not proven, so not picked
      if (e.code === "ENOTFOUND") return "none";
      try { await tryResolve(() => resolver.resolve4(domain)); return "ok"; } catch { return "none"; }
    }
  })();
  domainCache.set(domain, check);
  return check;
}

// ---- The audience: who is eligible, in what order, and why not.
async function buildAudience({ refresh }) {
  const history = await resendHistory(refresh);
  const [profiles, activity] = await Promise.all([
    all(() => admin.from("profiles").select("id, email, full_name").eq("email_updates", true).not("email", "is", null).order("id")),
    lastActivity(),
  ]);
  // What Resend knows, per address and per email id.
  const eventById = new Map(history.emails.map((e) => [e.id, e.event]));
  const badAddress = new Set(history.suppressions.map((s) => s.email));
  const oldCampaign = new Set();
  for (const e of history.emails) {
    if (BAD_EVENTS.has(e.event)) for (const to of e.to) badAddress.add(to);
    if (EXCLUDED_SUBJECTS.has(String(e.subject ?? "").trim().toLowerCase())) for (const to of e.to) oldCampaign.add(to);
  }
  const undeliverableIds = new Set(readJson("emails/.sent/long-form-launch-undeliverable.json", []));
  // Clicks on the 3 Oct Long Form email (and the 1 Oct one, if any were tracked): by the id we logged per person.
  const clicked = new Set();
  for (const file of ["emails/.sent/long-form-ideas.jsonl", "emails/.sent/long-form-launch.jsonl"]) {
    for (const row of lines(file)) if (row.resendId && eventById.get(row.resendId) === "clicked") clicked.add(row.id);
  }
  const alreadyLogged = new Set(lines(LOG).map((r) => r.id));

  const how = { optedIn: profiles.length, badAddressFormat: 0, duplicate: 0, internal: 0, bouncedComplainedSuppressed: 0, loopOrYoureIn: 0, alreadySent: 0, noMailServer: 0, domainUnknown: 0 };
  const seen = new Set();
  const candidates = [];
  for (const p of profiles) {
    const email = norm(p.email);
    if (!EMAIL.test(email)) { how.badAddressFormat++; continue; }
    if (email.endsWith("@zyvo-internal.test")) { how.internal++; continue; }
    if (seen.has(email)) { how.duplicate++; continue; }
    seen.add(email);
    if (badAddress.has(email) || undeliverableIds.has(p.id)) { how.bouncedComplainedSuppressed++; continue; }
    if (oldCampaign.has(email)) { how.loopOrYoureIn++; continue; }
    if (alreadyLogged.has(p.id)) { how.alreadySent++; continue; }
    candidates.push({ id: p.id, email, full_name: p.full_name, clicked: clicked.has(p.id), lastActive: activity.get(p.id) ?? 0 });
  }
  const domains = [...new Set(candidates.map((c) => c.email.split("@")[1]))];
  for (let i = 0; i < domains.length; i += 25) await Promise.all(domains.slice(i, i + 25).map(domainCanReceive));
  const eligible = [];
  for (const c of candidates) {
    const state = await domainCanReceive(c.email.split("@")[1]);
    if (state === "none") how.noMailServer++; else if (state === "unknown") how.domainUnknown++; else eligible.push(c);
  }
  // Clickers first, then the most recently active.
  eligible.sort((a, b) => Number(b.clicked) - Number(a.clicked) || b.lastActive - a.lastActive || a.id.localeCompare(b.id));
  // Day 1 of the warm-up: mainstream providers only. Who that passes over above the cut is counted (domains only).
  const mainstream = eligible.filter((c) => isMainstream(c.email));
  const picked = mainstream.slice(0, TARGET), reserve = mainstream.slice(TARGET, TARGET + RESERVE);
  const passedOver = eligible.slice(0, eligible.indexOf(picked.at(-1)) + 1).filter((c) => !isMainstream(c.email));
  return { history, how: { ...how, eligible: eligible.length, mainstream: mainstream.length, passedOver: passedOver.length, passedOverClickers: passedOver.filter((c) => c.clicked).length, passedOverDomains: [...new Set(passedOver.map((c) => c.email.split("@")[1]))], clickersTotal: clicked.size, clickersEligible: eligible.filter((c) => c.clicked).length, oldCampaignAddresses: oldCampaign.size, suppressionList: history.suppressions.length, historyEmails: history.emails.length }, picked, reserve };
}

// ---- The message
const subjectOf = (index) => SUBJECTS[(index ?? 1) - 1];
function messageFor(p, subject) {
  const { pageUrl, oneClickUrl } = unsubscribeLinks(p.id, { secret: SECRET, supabaseUrl: SUPABASE_URL, app: "https://www.tryzyvo.com" });
  const m = LongFormFeatureEmail({ name: p.full_name, unsubscribeUrl: pageUrl, oneClickUrl, subject });
  return { from: FROM, to: p.email, replyTo: REPLY_TO, subject: m.subject, html: m.html, text: m.text, headers: m.headers, tags: [{ name: "campaign", value: CAMPAIGN }] };
}
const SAMPLE = { id: "00000000-0000-0000-0000-000000000000", email: "preview@example.com", full_name: "Alex Example" };
// The code --send must be given: the exact people, the subject and the email's words.
function confirmCode(ids, subject) {
  const body = messageFor(SAMPLE, subject);
  return crypto.createHash("sha256").update(JSON.stringify([ids, subject, body.html, body.text, FROM])).digest("hex").slice(0, 8);
}
const day = (t) => (t ? new Date(t).toISOString().slice(0, 10) : "never");

if (mode === "dry") {
  console.log("DRY RUN: nothing is sent.\n");
  const frozen = readJson(AUDIENCE, null);
  const subject = subjectOf(subjectIndex ?? frozen?.subjectIndex ?? 1);
  const { how, picked, reserve } = await buildAudience({ refresh: !!opt["--refresh"] });
  const clickers = picked.filter((p) => p.clicked).length;
  const others = picked.filter((p) => !p.clicked);
  console.log(`From:      ${FROM}`);
  console.log(`Reply-to:  ${REPLY_TO}`);
  console.log(`Subject:   ${subject}\n`);
  console.log(`Opted in (email_updates = true):                       ${n(how.optedIn)}`);
  console.log(`  address not usable, internal or a duplicate:        -${n(how.badAddressFormat + how.internal + how.duplicate)}`);
  console.log(`  bounced, complained or on Resend's suppression list: -${n(how.bouncedComplainedSuppressed)}`);
  console.log(`  got the loop email or the old "you’re in" email:    -${n(how.loopOrYoureIn)}`);
  console.log(`  domain has no mail server:                           -${n(how.noMailServer)}${how.domainUnknown ? `  (+${n(how.domainUnknown)} whose domain could not be checked)` : ""}`);
  console.log(`  already sent this email:                             -${n(how.alreadySent)}`);
  console.log(`Eligible:                                               ${n(how.eligible)}`);
  console.log(`  of them at a mainstream mail provider:                ${n(how.mainstream)}`);
  console.log(`\nPicked: ${n(picked.length)}  (mainstream providers only)`);
  console.log(`  ${n(clickers)} clicked the 3 Oct Long Form email (${n(how.clickersTotal)} clicked in all; ${n(how.clickersTotal - how.clickersEligible)} not eligible, ${n(how.passedOverClickers)} at a school or company address)`);
  console.log(`  passed over above the cut (school or company address): ${n(how.passedOver)}${how.passedOver ? `  [${how.passedOverDomains.join(", ")}]` : ""}`);
  console.log(`  ${n(others.length)} most recently active: last active between ${day(others.at(-1)?.lastActive)} and ${day(others[0]?.lastActive)}`);
  console.log(`  + ${n(reserve.length)} in reserve, used only if someone drops out at the last check`);
  console.log(`(Resend history read: ${n(how.historyEmails)} emails, ${n(how.suppressionList)} suppressed addresses, ${n(how.oldCampaignAddresses)} addresses that got the loop / "you’re in" emails)`);
  console.log("\n5 example rows:");
  const examples = [...picked.filter((p) => p.clicked).slice(0, 2), ...others.slice(0, 2), others.at(-1)].filter(Boolean);
  for (const p of examples) console.log(`  ${mask(p.email).padEnd(28)} ${p.clicked ? "clicked 3 Oct email" : "recently active  "}   last active ${day(p.lastActive)}`);
  const ids = picked.map((p) => p.id);
  const code = confirmCode(ids, subject);
  fs.mkdirSync("emails/.sent", { recursive: true });
  fs.writeFileSync(AUDIENCE, JSON.stringify({ createdAt: new Date().toISOString(), subjectIndex: SUBJECTS.indexOf(subject) + 1, subject, code, how, picked, reserve }, null, 1));
  fs.mkdirSync("emails/.preview", { recursive: true });
  const sample = messageFor(SAMPLE, subject);
  fs.writeFileSync(`${PREVIEW}.html`, sample.html);
  fs.writeFileSync(`${PREVIEW}.txt`, sample.text);
  console.log("\nSubject options:");
  SUBJECTS.forEach((s, i) => console.log(`  ${i + 1}. ${s}${s === subject ? "   <- selected" : ""}`));
  console.log(`\n----- the email (plain-text version) -----\n${sample.text}\n-----`);
  console.log(`\nPreview: ${PREVIEW}.html (and .txt). The list is frozen in ${AUDIENCE}.`);
  console.log(`One test copy:  node emails/sendLongFormFeature.js --test you@example.com`);
  console.log(`Real send:      node emails/sendLongFormFeature.js --send --confirm ${code}`);
  process.exit(0);
}

if (mode === "test") {
  const to = norm(opt["--test"]);
  if (!EMAIL.test(to)) { console.error("Usage: node emails/sendLongFormFeature.js --test you@example.com"); process.exit(1); }
  const subject = subjectOf(subjectIndex ?? readJson(AUDIENCE, null)?.subjectIndex ?? 1);
  const { data: p } = await admin.from("profiles").select("id, email, full_name").ilike("email", to).maybeSingle();
  // No profile: a link signed for a non-existent id (the page then says it isn't valid).
  const m = messageFor(p ?? { id: crypto.randomUUID(), email: to, full_name: null }, subject);
  const { data, error } = await resend.emails.send({ ...m, to });
  console.log(error ? `Test NOT sent: ${error.message}` : `One test copy sent to ${to} (subject "${subject}", Resend id ${data?.id}). Not written to the send log.`);
  process.exit(error ? 1 : 0);
}

if (mode === "report") {
  const sent = lines(LOG).filter((r) => r.step === "sent" && r.resendId);
  const attempts = new Set(lines(LOG).map((r) => r.id)).size;
  const failed = lines(LOG).filter((r) => r.step === "failed").length;
  const counts = {}, bounced = [], complained = [];
  for (const r of sent) {
    const e = await resendGet(`/emails/${r.resendId}`);
    counts[e.last_event] = (counts[e.last_event] ?? 0) + 1;
    if (e.last_event === "bounced") bounced.push(mask(e.to?.[0]));
    if (e.last_event === "complained") complained.push(mask(e.to?.[0]));
    await sleep(600);
  }
  console.log(`Long Form feature email, status at ${new Date().toISOString()}`);
  console.log(`People in the send log: ${n(attempts)}. Accepted by Resend: ${n(sent.length)}. Failed at send: ${n(failed)}. Unknown (started, no answer): ${n(attempts - sent.length - failed)}.`);
  console.log(`Last event per email: ${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`);
  if (bounced.length) console.log(`Bounced: ${bounced.join(", ")}`);
  if (complained.length) console.log(`Complained: ${complained.join(", ")}`);
  process.exit(0);
}

// ---- --send: exactly the frozen list, confirmed by its code (or by typing SEND in a terminal).
const frozen = readJson(AUDIENCE, null);
if (!frozen?.picked?.length) { console.error("No frozen list. Run the dry run first: node emails/sendLongFormFeature.js"); process.exit(1); }
if (subjectIndex != null && subjectIndex !== frozen.subjectIndex) { console.error("The subject is chosen in the dry run (--subject N), then sent as shown. Run the dry run again with that subject."); process.exit(1); }
const code = confirmCode(frozen.picked.map((p) => p.id), frozen.subject);
if (code !== frozen.code) { console.error("Refusing: the email or the list changed since the dry run. Run the dry run again and check it. Nothing was sent."); process.exit(1); }
if ("--confirm" in opt) {
  if (opt["--confirm"] !== code) { console.error("Refusing: wrong confirmation code. It is printed by the dry run. Nothing was sent."); process.exit(1); }
} else {
  if (!process.stdin.isTTY) { console.error("Refusing: --send needs --confirm <code> (from the dry run), or a terminal where you can type SEND. Nothing was sent."); process.exit(1); }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Type SEND to email these ${n(frozen.picked.length)} people now (anything else cancels): `);
  rl.close();
  if (answer !== "SEND") { console.log("Cancelled. Nothing was sent."); process.exit(1); }
}

console.log(`REAL SEND: "${frozen.subject}" from ${FROM} to ${n(frozen.picked.length)} people, in batches of ${BATCH}.\n`);
fs.mkdirSync("emails/.sent", { recursive: true });
const log = (row) => fs.appendFileSync(LOG, JSON.stringify({ ...row, at: new Date().toISOString() }) + "\n");
const logged = new Set(lines(LOG).map((r) => r.id));
const suppressed = await suppressedNow();
const queue = frozen.picked.filter((p) => !logged.has(p.id));
const reserve = frozen.reserve.filter((p) => !logged.has(p.id));
let ok = 0, failed = 0, dropped = 0, toppedUp = 0, failuresInARow = 0, batchNo = 0;
const goal = queue.length;
if (!goal) { console.log("Everyone on the list is already in the send log. Nothing to do."); process.exit(0); }

while (queue.length && ok + failed < goal) {
  const batch = queue.splice(0, Math.min(BATCH, goal - ok - failed));
  batchNo += 1;
  // Last check, right before sending: still opted in, still not suppressed.
  const { data: still, error: checkError } = await admin.from("profiles").select("id, email").in("id", batch.map((p) => p.id)).eq("email_updates", true);
  if (checkError) { console.error(`batch ${batchNo}: could not re-check the recipients, stopping. Nothing in this batch was sent.`); break; }
  const keep = new Map(still.map((r) => [r.id, norm(r.email)]));
  const sentIds = [];
  for (const p of batch) {
    if (keep.get(p.id) !== p.email || suppressed.has(p.email)) {
      dropped += 1;
      const next = reserve.shift(); // keep the number at exactly the target
      if (next) { queue.push(next); toppedUp += 1; }
      continue;
    }
    // Written BEFORE the attempt: whatever happens next, this person is never tried again.
    log({ id: p.id, step: "sending" });
    logged.add(p.id);
    // "Too many requests" means it was not sent: the same request is asked again (same idempotency key, so never twice).
    let data = null, error = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      ({ data, error } = await resend.emails.send(messageFor(p, frozen.subject), { idempotencyKey: `${CAMPAIGN}/${p.id}` }));
      if (!error || (error.name !== "rate_limit_exceeded" && error.statusCode !== 429)) break;
      await sleep(3000 * (attempt + 1));
    }
    if (error) {
      failed += 1; failuresInARow += 1;
      log({ id: p.id, step: "failed", error: String(error.message ?? error).slice(0, 200) });
      console.error(`  ${mask(p.email)}: NOT sent (${String(error.message ?? error).slice(0, 120)})`);
    } else {
      ok += 1; sentIds.push(p.id); failuresInARow = 0;
      log({ id: p.id, step: "sent", resendId: data?.id ?? null });
    }
    if (failuresInARow >= 3) break;
    await sleep(PAUSE_BETWEEN_SENDS_MS);
  }
  if (sentIds.length) await admin.from("profiles").update({ last_email_type: CAMPAIGN, last_email_sent_at: new Date().toISOString() }).in("id", sentIds);
  console.log(`batch ${batchNo}: ${sentIds.length} sent (${n(ok)} of ${n(goal)})`);
  if (failuresInARow >= 3) { console.error("Three sends in a row failed: stopping to protect the domain. Nobody in the log is tried again."); break; }
  if (queue.length && ok + failed < goal) await sleep(PAUSE_BETWEEN_BATCHES_MS);
}
console.log(`\nDone. Sent: ${n(ok)}. Failed: ${n(failed)}. Dropped at the last check (unsubscribed or suppressed meanwhile): ${n(dropped)}, replaced from the reserve: ${n(toppedUp)}.`);
console.log(`Send log: ${LOG}. Status later: node emails/sendLongFormFeature.js --report`);
