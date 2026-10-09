import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_URL, COMPANY_FOOTER, REPLY_TO, SENDERS, checkEmailAddress, domainSuggestion, emailFooter, emailProblemMessage, stopReason } from "../supabase/functions/_shared/emailRules.js";
import { welcomeEmail } from "../supabase/functions/_shared/welcomeEmail.js";
import { LongFormLaunchEmail } from "../emails/LongFormLaunchEmail.js";
import { campaignBlockers, campaignMessage, DEFAULT_PER_RUN, MAX_PER_RUN } from "../emails/marketing.js";

// The email rules (2026-10-09), after one address got 23,263 emails from a
// public script and two campaigns went out as 6,500 emails in under two minutes:
//   - every email to a user passes the database gate first (claim_email_send)
//   - marketing goes only to email_updates = true, from mail.tryzyvo.com
//   - bounces and spam complaints switch the address OFF
//   - every such email carries an unsubscribe link and the shared footer
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const SKIP = new Set(["node_modules", "dist", "dist-ssr", ".git", ".vercel", "docs", "artifacts", "data", "public", "tests"]);
const walk = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  if (SKIP.has(name) || name.startsWith(".")) return [];
  const p = join(dir, name);
  return statSync(join(root, p)).isDirectory() ? walk(p) : /\.(m?js|jsx|tsx?)$/.test(name) ? [relative(".", p).replaceAll("\\", "/")] : [];
});
const code = walk(".");
// A SEND to Resend: the SDK calls, or a request to the bare /emails (or /emails/batch) URL. Reading /emails?… or /emails/<id> is not a send.
const SENDS = /resend\.(emails|batch)\.send\(|api\.resend\.com\/emails(\/batch)?["'`]|nodemailer|createTransport\(/;

test("only the two gated senders (and the owner alerts) can send email", () => {
  const senders = code.filter((f) => SENDS.test(read(f))).sort();
  assert.deepEqual(senders, [
    "emails/marketing.js",                                  // campaigns: claim_email_send, then Resend
    "supabase/functions/_shared/adminAlert.ts",             // owner alerts: ALERT_EMAIL only
    "supabase/functions/_shared/blocky/alerts.js",
    "supabase/functions/_shared/blocky/spendWatch.js",
    "supabase/functions/_shared/fruit/alerts.js",
    "supabase/functions/_shared/userEmail.ts",              // edge functions: claimEmail, then Resend
    "supabase/functions/contact-email/index.ts",            // the contact form: to our own inbox (CONTACT_TO_EMAIL)
    "supabase/functions/submit-feedback/index.ts",          // feedback: to our own inbox (CONTACT_TO_EMAIL)
  ], "a new file sends email: route it through emails/marketing.js or _shared/userEmail.ts instead");
  // The exceptions write to the owner, never to an address a request or a table names.
  for (const f of ["supabase/functions/_shared/adminAlert.ts", "supabase/functions/_shared/blocky/alerts.js", "supabase/functions/_shared/blocky/spendWatch.js", "supabase/functions/_shared/fruit/alerts.js"]) {
    assert.match(read(f), /ALERT_EMAIL/, `${f} sends to ALERT_EMAIL`);
    assert.match(read(f), /from: "Zyvo Alerts <(niko|hello)@tryzyvo\.com>"/, `${f}: alerts stay on tryzyvo.com`);
  }
  for (const f of ["supabase/functions/contact-email/index.ts", "supabase/functions/submit-feedback/index.ts"]) assert.match(read(f), /to: CONTACT_TO_EMAIL/);
});

test("both senders ask the gate before Resend, and give the claim back when the send fails", () => {
  const edge = read("supabase/functions/_shared/userEmail.ts");
  assert.match(edge, /sb\.rpc\("claim_email_send", \{ p_email: to, p_kind: kind, p_category: category \}\)/);
  assert.match(edge, /if \(error \|\| !data\) \{[\s\S]{0,200}return \{ ok: false, reason: "gate_unavailable" \}/, "no answer from the gate means no email");
  assert.match(edge, /claimId: number;/, "sendClaimedEmail cannot be called without a claim");
  assert.match(edge, /await releaseEmail\(sb, m\.claimId\);\s*return false;/);
  const node = read("emails/marketing.js");
  const claimAt = node.indexOf('admin.rpc("claim_email_send"'), sendAt = node.indexOf("resend.emails.send(");
  assert.ok(claimAt > 0 && sendAt > claimAt, "the claim comes before the send");
  assert.match(node, /if \(!claim\.ok\) return \{ sent: false, reason: claim\.reason \};/);
  assert.match(node, /p_category: test \? "test" : "marketing"/);
  assert.doesNotMatch(node, /resend\.batch\.send/, "campaigns go one email at a time, not in batches of 100");
  assert.ok(DEFAULT_PER_RUN <= 200 && MAX_PER_RUN <= 1000, "a run is a few hundred emails, never the whole list");
});

test("the gate's rules are in the database: suppressed, consent, once, 3 a day", () => {
  const sql = read("supabase/migrations/20261103100000_email_guard.sql");
  assert.match(sql, /create unique index if not exists email_sends_email_kind_key on public\.email_sends \(email, kind\)/, "the same email twice to one address cannot be stored");
  for (const reason of ["suppressed", "no_consent", "already_sent", "daily_limit", "bad_address"]) assert.match(sql, new RegExp(`'reason', '${reason}'`));
  assert.match(sql, /p_category = 'marketing' and not exists \(\s*select 1 from profiles where lower\(btrim\(email\)\) = v_email and email_updates is true/, "marketing needs email_updates = true: null and false are both a no");
  assert.match(sql, /case when p_category = 'test' then 20 else 3 end/, "the ceiling is a constant in the function, not a parameter");
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /update profiles set email_updates = false where lower\(btrim\(email\)\) = v_email and email_updates is true/, "suppress_email switches the profile OFF");
  assert.match(sql, /revoke all on function public\.claim_email_send\(text, text, text\) from public, anon, authenticated/);
  for (const t of ["email_suppressions", "email_sends"]) assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
});

test("checkout reminders: only email_updates = true, claimed as marketing, once per stage", () => {
  const src = read("supabase/functions/abandoned-checkout-processor/index.ts");
  assert.match(src, /if \(prof\?\.email_updates !== true\) \{\s*await finishWithoutEmail\("email_updates_not_on"\);\s*continue;/, "never answered (null) is not a yes");
  assert.doesNotMatch(src, /consent === false/);
  assert.match(src, /claimEmail\(sb, row\.email, reminderKind\(row\.id, nextStage\), "marketing"\)/);
  assert.ok(src.indexOf("claimEmail(sb, row.email") < src.indexOf("await resolveCtaUrl("), "the gate is asked before a Stripe session is minted");
  assert.match(src, /from: SENDERS\.founder,/);
  assert.doesNotMatch(src, /api\.resend\.com|RESEND_API_KEY/, "the function does not talk to Resend itself");
  assert.match(src, /render: \(footer\) => \(\{ html: wrap\(inner, footer\.html\) \}\)/, "every reminder carries the footer");
});

test("bounces and spam complaints switch the address OFF", () => {
  const src = read("supabase/functions/resend-webhook/index.ts");
  assert.match(src, /if \(!valid\) \{\s*return new Response\(JSON\.stringify\(\{ error: "Invalid signature" \}\), \{ status: 401 \}\);/, "unsigned requests change nothing");
  assert.match(src, /sb\.rpc\("suppress_email", \{ p_email: address, p_reason: stop, p_source: "resend-webhook" \}\)/);
  assert.match(src, /status: 500/, "a failed write answers 500 so Resend delivers the event again");
  assert.equal(stopReason("email.complained", {}), "complained");
  assert.equal(stopReason("email.bounced", { bounce: { type: "Permanent" } }), "bounced");
  assert.equal(stopReason("email.bounced", { bounce: { type: "Transient" } }), null, "a full inbox is not a dead address");
  assert.equal(stopReason("email.suppressed", {}), "bounced");
  for (const t of ["email.delivered", "email.clicked", "email.opened", "email.sent"]) assert.equal(stopReason(t, {}), null);
});

test("senders: marketing on mail.tryzyvo.com only", () => {
  for (const from of Object.values(SENDERS)) assert.match(from, /<[a-z]+@mail\.tryzyvo\.com>$/);
  for (const to of Object.values(REPLY_TO)) assert.match(to, /^[a-z]+@tryzyvo\.com$/);
  // No file outside the alerts writes a tryzyvo.com (root domain) From line.
  const rootFrom = code.filter((f) => /from: ?["'`][^"'`]*<[a-z]+@tryzyvo\.com>/i.test(read(f)) || /FROM = ["'`][^"'`]*<[a-z]+@tryzyvo\.com>/.test(read(f))).sort();
  assert.deepEqual(rootFrom, ["supabase/functions/_shared/adminAlert.ts", "supabase/functions/_shared/blocky/alerts.js", "supabase/functions/_shared/blocky/spendWatch.js", "supabase/functions/_shared/fruit/alerts.js"]);
  const sample = campaignMessage({ profile: { id: "00000000-0000-0000-0000-000000000000", email: "a@example.net", full_name: "Alex Example" }, campaign: "long_form_launch", render: LongFormLaunchEmail, env: { EMAIL_UNSUBSCRIBE_SECRET: "test-secret", SUPABASE_URL: "https://project.supabase.co" } });
  assert.equal(sample.from, "Zyvo <updates@mail.tryzyvo.com>");
  assert.match(sample.headers["List-Unsubscribe"], /^<https:\/\/project\.supabase\.co\/functions\/v1\/email-unsubscribe\?u=[^>]+&t=[^>]+>$/);
  assert.equal(sample.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(sample.html, /href="https:\/\/www\.tryzyvo\.com\/unsubscribe\?u=/);
  assert.match(sample.text, /Unsubscribe: https:\/\/www\.tryzyvo\.com\/unsubscribe\?u=/);
  // Our own links go to www (tryzyvo.com answers with a redirect) and nothing is left in [brackets].
  assert.doesNotMatch(sample.html, /https:\/\/tryzyvo\.com/);
  assert.doesNotMatch(sample.html.replace(/<[^>]+>/g, " "), /\[[A-Za-z][^\]]{2,60}\]/, "no template placeholder reaches a reader");
});

test("the footer: why, unsubscribe, and the company line when it is set; campaigns refuse without it", () => {
  const f = emailFooter({ unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=1&t=2", why: "You're getting this because you created a Zyvo account." });
  assert.match(f.html, /You&#39;re getting this because you created a Zyvo account\./);
  assert.match(f.html, /<a href="https:\/\/www\.tryzyvo\.com\/unsubscribe\?u=1&amp;t=2"[^>]*>Unsubscribe<\/a>/);
  assert.match(f.text, /Unsubscribe: https:\/\/www\.tryzyvo\.com\/unsubscribe\?u=1&t=2/);
  assert.throws(() => emailFooter({ why: "x" }), /unsubscribeUrl/);
  assert.equal(APP_URL, "https://www.tryzyvo.com");
  if (COMPANY_FOOTER) {
    assert.doesNotMatch(COMPANY_FOOTER, /[[\]]/, "a real company line, not a placeholder");
    assert.ok(f.html.includes(COMPANY_FOOTER.replace(/&/g, "&amp;")) && f.text.endsWith(COMPANY_FOOTER));
    assert.deepEqual(campaignBlockers({ EMAIL_UNSUBSCRIBE_SECRET: "s", SUPABASE_URL: "u" }), []);
  } else {
    assert.match(campaignBlockers({ EMAIL_UNSUBSCRIBE_SECRET: "s", SUPABASE_URL: "u" })[0], /COMPANY_FOOTER is empty/, "no company line, no campaign");
  }
  assert.match(read("emails/marketing.js"), /const blockers = campaignBlockers\(\);\s*if \(blockers\.length\) return \{ sent: false/);
  assert.match(welcomeEmail(f).html, /Unsubscribe<\/a>/, "the welcome email carries the footer");
});

test("sign-up address check: typos, throwaway inboxes and non-addresses are refused, real ones pass", () => {
  for (const ok of ["anna@gmail.com", "Anna.Smith+zyvo@Outlook.com ", "a@ymail.com", "a@mail.com", "a@hotmail.co.uk", "a@yahoo.fr", "a@proton.me", "a@student.tsaam.be", "a@duck.com", "a@gmx.de"]) {
    assert.equal(checkEmailAddress(ok).ok, true, ok);
  }
  assert.equal(checkEmailAddress(" Anna@Gmail.com ").email, "anna@gmail.com");
  assert.deepEqual(checkEmailAddress("anna@gmsil.com"), { ok: false, email: "anna@gmsil.com", reason: "typo", suggestion: "anna@gmail.com" });
  assert.equal(checkEmailAddress("anna@iclou.com").suggestion, "anna@icloud.com");
  assert.equal(checkEmailAddress("anna@gmail.con").suggestion, "anna@gmail.com");
  assert.equal(checkEmailAddress("anna@hotmial.com").suggestion, "anna@hotmail.com", "two swapped letters");
  assert.equal(checkEmailAddress("anna@yahoo.co").suggestion, "anna@yahoo.com");
  assert.equal(domainSuggestion("gmail.com"), null);
  for (const bad of ["", "anna", "anna@", "@gmail.com", "anna@gmail", "anna smith@gmail.com", "anna@@gmail.com", "anna@-gmail.com"]) assert.equal(checkEmailAddress(bad).reason, "format", bad);
  for (const bad of ["a@mailinator.com", "a@yopmail.com", "a@zyvo-internal.test", "a@example.com"]) assert.equal(checkEmailAddress(bad).reason, "disposable", bad);
  assert.match(emailProblemMessage(checkEmailAddress("anna@gmsil.com")), /Did you mean anna@gmail\.com\?/);
  assert.equal(emailProblemMessage({ ok: true }), "");
  // Both sign-up screens ask before creating the account.
  assert.match(read("src/lib/auth.js"), /const check = await checkSignupEmail\(email\);\s*if \(!check\.ok\) throw new Error\(check\.message\);\s*const \{ data, error \} = await supabase\.auth\.signUp/);
  assert.match(read("src/components/AuthModal.jsx"), /const check = await checkSignupEmail\(email\);\s*if \(!check\.ok\) \{ setError\(check\.message\); setLoading\(false\); return; \}/);
  assert.ok(existsSync(join(root, "supabase/functions/check-email/index.ts")));
});
