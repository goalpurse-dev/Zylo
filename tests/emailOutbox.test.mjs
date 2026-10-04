import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP, REPLY_TO, SENDERS, TEMPLATES, formatDate, renderEmail } from "../supabase/functions/_shared/emails/templates.js";
import { processRow, unsubscribeLinks } from "../supabase/functions/_shared/emails/outbox.js";
import { unsubscribeLinks as nodeUnsubscribeLinks } from "../emails/unsubscribeLink.js";

// The email outbox: events queue a row (unique key = one email), the
// email-sender function sends due rows through Resend and records the result.
// The SQL and a full sender run are executed by tests/email-outbox/simulate.ts
// (in-memory Postgres); this file covers the templates, the per-row decisions
// and the wiring.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

test("senders: transactional from tryzyvo.com, marketing from mail.tryzyvo.com, replies to support@", () => {
  assert.deepEqual(SENDERS, { transactional: "Zyvo <hello@tryzyvo.com>", marketing: "Zyvo <updates@mail.tryzyvo.com>" });
  // Click tracking is per domain in Resend (off on tryzyvo.com, on on mail.tryzyvo.com): the domain decides it.
  const domainOf = (sender) => sender.match(/@([^>]+)>$/)[1];
  assert.equal(domainOf(SENDERS.transactional), "tryzyvo.com");
  assert.equal(domainOf(SENDERS.marketing), "mail.tryzyvo.com");
  const sql = read("supabase/migrations/20261004212405_email_outbox.sql");
  assert.deepEqual([...sql.matchAll(/'from', '([^']+)'/g)].map((m) => domainOf(m[1])), ["tryzyvo.com"], "the cron alert is transactional");
  assert.equal(REPLY_TO, "support@tryzyvo.com");
  assert.equal(APP, "https://www.tryzyvo.com");
});

test("every template gives a subject, html and text, and says only what it was given", () => {
  const profile = { id: "u", email: "a@example.com", credit_balance: 1050, plan_code: "starter" };
  const cases = {
    welcome: {},
    plan_welcome: { plan: "starter", credits: 750, interval: "monthly", period_end: "2026-11-04T10:00:00Z" },
    pack_confirmation: { credits: 300 },
    plan_ended: { plan: "starter", reason: "canceled" },
  };
  assert.deepEqual(Object.keys(TEMPLATES).sort(), Object.keys(cases).sort(), "a new template needs a case here");
  for (const [name, payload] of Object.entries(cases)) {
    const mail = renderEmail(name, { payload, profile });
    assert.ok(mail.subject.length > 5 && mail.subject.length < 80, `${name} subject`);
    assert.match(mail.html, /^<!DOCTYPE html>/);
    assert.ok(mail.html.includes("tryzyvo.com") && mail.text.includes(REPLY_TO), `${name} links home and names support`);
    assert.doesNotMatch(mail.html + mail.text, /undefined|NaN|\[object|null/, `${name} has no blanks`);
    assert.doesNotMatch(mail.html + mail.text, /\/workspace\/pricing/, "pricing lives at /pricing");
  }
  const welcome = renderEmail("plan_welcome", { payload: cases.plan_welcome, profile });
  assert.equal(welcome.subject, "You're now a Zyvo partner: Starter is active");
  assert.match(welcome.text, /750 credits are in your account now, and 750 more arrive with every monthly renewal\./);
  assert.match(welcome.text, /Your plan renews on 4 Nov 2026\./);
  const yearly = renderEmail("plan_welcome", { payload: { ...cases.plan_welcome, plan: "pro", credits: 1600, interval: "yearly" }, profile });
  assert.match(yearly.text, /1,600 more arrive every month of your plan year\./);
  assert.match(renderEmail("pack_confirmation", { payload: { credits: 300 }, profile }).text, /Your balance is now 1,050 credits\./);
  assert.doesNotMatch(renderEmail("pack_confirmation", { payload: { credits: 300 }, profile: { credit_balance: 0 } }).text, /Your balance is now/, "no balance line when the balance can't be right");
  assert.match(renderEmail("plan_ended", { payload: { plan: "pro", reason: "unpaid" }, profile }).text, /ended because the last payment didn't go through/);
  assert.equal(formatDate(1793786400), "4 Nov 2026");
  assert.equal(formatDate(null), null);
});

test("a template refuses a payload it can't use (the row is then failed, not sent half-empty)", () => {
  assert.throws(() => renderEmail("pack_confirmation", { payload: {} }), /no credits/);
  assert.throws(() => renderEmail("plan_welcome", { payload: { plan: "gold" } }), /unknown plan/);
  assert.throws(() => renderEmail("nope", {}), /unknown email template/);
});

test("per-row decisions: consent, the old welcome flag, retry or fail", async () => {
  const sent = [];
  const deps = (profile, answer = { ok: true, status: 200, id: "re_1" }) => ({
    profileOf: async () => profile,
    send: async (message, key) => { sent.push({ message, key }); return answer; },
    unsubscribeLinks: (id) => unsubscribeLinks(id, { secret: "s", supabaseUrl: "https://p.supabase.co" }),
    markWelcomeSent: async () => {},
  });
  const row = (over = {}) => ({ id: 7, dedupe_key: "k", template: "welcome", category: "transactional", user_id: "u1", to_email: null, payload: {}, ...over });
  const p = { id: "u1", email: "a@example.com", email_updates: null, welcome_email_sent: false, credit_balance: 0 };

  assert.deepEqual(await processRow(row(), deps(p)), { result: "sent", providerId: "re_1" });
  assert.equal(sent.at(-1).key, "outbox-7");
  assert.equal((await processRow(row(), deps({ ...p, welcome_email_sent: true }))).result, "skipped");
  assert.equal((await processRow(row(), deps(null))).result, "canceled");
  assert.equal((await processRow(row(), deps({ ...p, email: null }))).result, "canceled");
  assert.deepEqual(await processRow(row({ category: "marketing" }), deps(p)), { result: "skipped", error: "no marketing consent" });
  assert.deepEqual(await processRow(row({ category: "marketing" }), deps({ ...p, email_updates: false })), { result: "skipped", error: "no marketing consent" });
  assert.equal((await processRow(row({ category: "marketing" }), deps({ ...p, email_updates: true }))).result, "sent");
  assert.equal(sent.at(-1).message.from, SENDERS.marketing);
  assert.equal(sent.at(-1).message.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  for (const status of [0, 401, 429, 500, 503]) assert.equal((await processRow(row(), deps(p, { ok: false, status, error: "x" }))).result, "retry", `status ${status}`);
  for (const status of [400, 422]) assert.equal((await processRow(row(), deps(p, { ok: false, status, error: "x" }))).result, "failed", `status ${status}`);
  // an email not tied to a profile goes to the address on the row
  assert.equal((await processRow(row({ user_id: null, to_email: "x@example.com" }), deps(null))).result, "sent");
  assert.deepEqual(sent.at(-1).message.to, ["x@example.com"]);
});

test("unsubscribe links are the ones the email-unsubscribe function accepts", async () => {
  const opts = { secret: "top-secret", supabaseUrl: "https://p.supabase.co" };
  assert.deepEqual(await unsubscribeLinks("11111111-1111-4111-8111-111111111111", opts), nodeUnsubscribeLinks("11111111-1111-4111-8111-111111111111", opts));
});

test("wiring: the webhook only queues, the sender is locked, nothing is scheduled by the migration", () => {
  const webhook = read("supabase/functions/stripe-webhook/index.ts");
  assert.doesNotMatch(webhook, /api\.resend\.com|resend\.emails/, "the webhook never sends email itself");
  const queue = webhook.slice(webhook.indexOf("async function queueEmail"), webhook.indexOf("async function alreadyProcessed"));
  assert.match(queue, /try \{[\s\S]*sb\.rpc\("enqueue_email"[\s\S]*\} catch \(e\) \{[\s\S]*console\.warn/, "queueing is wrapped: it can only log");
  assert.doesNotMatch(queue, /throw /);
  for (const key of ["`pack:${s.id}`", "`plan_welcome:${invoiceSubscriptionId(inv, lines) ?? inv.id}`", "`plan_ended:${sub.id}`"]) assert.ok(webhook.includes(key), `webhook queues ${key}`);

  const sender = read("supabase/functions/email-sender/index.ts");
  assert.match(sender, /req\.headers\.get\("x-email-sender-secret"\) !== SENDER_SECRET\) return json\(\{ error: "Unauthorized" \}, 401\)/);
  assert.match(sender, /if \(!SENDER_SECRET \|\|/, "an unset secret locks the function, it does not open it");
  assert.match(sender, /"Idempotency-Key": idempotencyKey/);
  assert.match(read("supabase/config.toml"), /\[functions\.email-sender\]\r?\nverify_jwt = false/);

  const sql = read("supabase/migrations/20261004212405_email_outbox.sql").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.match(sql, /dedupe_key\s+text NOT NULL UNIQUE/);
  assert.match(sql, /ON CONFLICT \(dedupe_key\) DO NOTHING/);
  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /ALTER TABLE public\.email_outbox ENABLE ROW LEVEL SECURITY;/);
  assert.doesNotMatch(sql, /cron\.schedule/, "schedules are set by hand once the secrets exist");
  assert.match(sql, /AFTER INSERT ON public\.profiles/, "welcome is queued for new profiles only");
});
