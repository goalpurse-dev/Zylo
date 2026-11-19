import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { continueLink, dealNow, nextAction, planOfPrice, reminderEmail, reminderStats } from "../supabase/functions/_shared/checkoutReminders.js";
import { LAUNCH_DEAL } from "../supabase/functions/_shared/launchDeal.js";

// The unfinished-checkout emails (owner, 2026-11-19): 1 h / 24 h / 72 h, stop on payment, never the old backlog.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const H = 3600000;
const T0 = Date.parse("2026-11-25T10:00:00Z"); // after the launch deal
const seq = (over = {}) => ({ openedAt: new Date(T0).toISOString(), lastOpenedAt: new Date(T0).toISOString(), ...over });
const footer = { html: "<p>FOOTER unsubscribe</p>", text: "FOOTER unsubscribe" };
const row = { id: "11111111-2222-3333-4444-555555555555", plan: "starter", billing: "monthly", amount: 1800, currency: "eur" };

test("timing: 1 h after they left, 24 h and 72 h after they opened, never two within 12 h", () => {
  assert.deepEqual(nextAction(seq(), [], T0 + 30 * 60000), { wait: true });
  assert.deepEqual(nextAction(seq(), [], T0 + 61 * 60000), { send: 1 });
  // they came back to checkout 50 minutes ago: wait for the hour after that visit
  assert.deepEqual(nextAction(seq({ lastOpenedAt: new Date(T0 + 70 * 60000).toISOString() }), [], T0 + 120 * 60000), { wait: true });
  const one = [{ step: 1, sentAt: new Date(T0 + H).toISOString() }];
  assert.deepEqual(nextAction(seq(), one, T0 + 23 * H), { wait: true });
  assert.deepEqual(nextAction(seq(), one, T0 + 24 * H + 1), { send: 2 });
  const two = [...one, { step: 2, sentAt: new Date(T0 + 24 * H).toISOString() }];
  assert.deepEqual(nextAction(seq(), two, T0 + 71 * H), { wait: true });
  assert.deepEqual(nextAction(seq(), two, T0 + 72 * H + 1), { send: 3 });
  const three = [...two, { step: 3, sentAt: new Date(T0 + 72 * H).toISOString() }];
  assert.deepEqual(nextAction(seq(), three, T0 + 80 * H), { done: true });
  assert.deepEqual(nextAction(seq({ stopped: true }), [], T0 + 2 * H), { done: true });
});

test("a step that comes too late is skipped, never sent late", () => {
  assert.deepEqual(nextAction(seq(), [], T0 + 21 * H), { skip: 1, why: "too late" });
  const skipped1 = [{ step: 1, skipped: "too late", sentAt: new Date(T0 + 21 * H).toISOString() }];
  assert.deepEqual(nextAction(seq(), skipped1, T0 + 25 * H), { send: 2 }); // a skipped step doesn't hold the next one
  // step 2 sent late (gate's daily limit): step 3 waits the 12-hour gap
  const late2 = [{ step: 1, sentAt: new Date(T0 + H).toISOString() }, { step: 2, sentAt: new Date(T0 + 66 * H).toISOString() }];
  assert.deepEqual(nextAction(seq(), late2, T0 + 73 * H), { wait: true });
  assert.deepEqual(nextAction(seq(), late2, T0 + 79 * H), { send: 3 });
});

test("plans: today's prices only", () => {
  assert.deepEqual(planOfPrice("price_1TmVZZHtn4q5rIncOuf5aKP4"), { plan: "starter", billing: "monthly" });
  assert.deepEqual(planOfPrice("price_1TmVlUHtn4q5rIncbtWbGyof"), { plan: "generative", billing: "yearly" });
  assert.equal(planOfPrice("price_1TGKT6Htn4q5rIncI47V5Ein"), null); // legacy
});

test("email 1: the plan, what they get, a button back to checkout for that plan, an unsubscribe footer", () => {
  const m = reminderEmail(1, row, T0);
  const { html, text } = m.render(footer);
  assert.match(m.subject, /Starter/);
  assert.match(html, /€18\.00 a month/);
  assert.match(html, /750 credits every month/);
  assert.match(html, /\/billing\/continue\?plan=starter&amp;billing=monthly&amp;t=11111111/);
  assert.match(html, /FOOTER unsubscribe/);
  assert.match(text, /FOOTER unsubscribe/);
  assert.doesNotMatch(html + text, /launch deal/i); // the deal is over at T0
});

test("the launch deal: shown only while it runs, only for Starter monthly; 'ends' only when it really does", () => {
  const during = Date.parse("2026-11-20T10:00:00Z");
  const d = dealNow(row, during);
  assert.equal(d.first, "€14.40");
  assert.equal(d.endsDay, "Sunday");
  assert.equal(dealNow({ ...row, plan: "pro", amount: 3800 }, during), null);
  assert.equal(dealNow({ ...row, billing: "yearly", amount: 18000 }, during), null);
  assert.equal(dealNow(row, Date.parse(LAUNCH_DEAL.endsAt) + 1), null);
  const two = reminderEmail(2, row, during).render(footer).html;
  assert.match(two, /€14\.40 for your first month/);
  assert.match(two, /until Sunday 23:59 Finnish time/);
  const three = reminderEmail(3, row, during);
  assert.match(three.subject, /launch deal ends Sunday/);
  const after = reminderEmail(3, row, T0);
  assert.doesNotMatch(after.subject + after.render(footer).html, /deal/i);
  const lastDay = reminderEmail(3, row, Date.parse("2026-11-22T12:00:00Z"));
  assert.match(lastDay.subject, /ends today/);
});

test("email 2 shows an example picture made with Zyvo", () => {
  const { html } = reminderEmail(2, row, T0).render(footer);
  assert.match(html, /<img src="https:\/\/www\.tryzyvo\.com\/onboarding\/demo\/landfill\.jpg"/);
  assert.match(html, /made with Zyvo/);
});

test("the button's address", () => {
  const u = new URL(continueLink({ id: row.id, plan: "pro", billing: "monthly", step: 2 }));
  assert.equal(u.pathname, "/billing/continue");
  assert.deepEqual(Object.fromEntries(u.searchParams), { plan: "pro", billing: "monthly", t: row.id, s: "2", from: "email", r: "checkout_2" });
});

test("stats: sent, opened, clicked, paid after", () => {
  const sends = [
    { reminder_id: "a", step: 1, resend_id: "r1", sent_at: "2026-11-25T11:00:00Z", clicked_at: "2026-11-25T11:05:00Z" },
    { reminder_id: "b", step: 1, resend_id: "r2", sent_at: "2026-11-25T11:00:00Z" },
    { reminder_id: "b", step: 2, resend_id: null, skipped: "too late", sent_at: "2026-11-26T11:00:00Z" },
  ];
  const s = reminderStats({
    sends,
    reminders: [{ id: "a", paid_at: "2026-11-25T12:00:00Z" }, { id: "b", paid_at: null }],
    emailEvents: [{ resend_id: "r1", type: "email.delivered", created_at: "2026-11-25T11:00:02Z" }, { resend_id: "r1", type: "email.opened", created_at: "2026-11-25T11:04:00Z" }],
  });
  assert.deepEqual([s[0].sent, s[0].opened, s[0].openedLater, s[0].clicked, s[0].paid], [2, 1, 1, 1, 1]);
  assert.equal(s[1].sent, 0); // a skipped step is not a send
});

test("the function: never the old backlog, the gate for every email, the owner's test copies never to customers", () => {
  const fn = read("supabase/functions/checkout-reminders/index.ts");
  assert.doesNotMatch(fn, /abandoned_checkouts|claim_due_abandoned_checkouts/);
  assert.match(fn, /claimEmail\(admin, r\.email, `checkout_reminder_\$\{r\.id\}_\$\{step\}`, "account"\)/);
  assert.match(fn, /email_updates === false/); // said no or unsubscribed: never emailed
  assert.match(fn, /at < startsAt/); // only checkouts opened after the switch went on
  assert.match(fn, /WELCOME_SENDER/); // notify.tryzyvo.com
  assert.doesNotMatch(fn, /api\.resend\.com/); // only _shared/userEmail.ts talks to Resend
  const sql = read("supabase/migrations/20261219100000_checkout_reminders.sql");
  assert.match(sql, /"on" boolean not null default false/);
  assert.match(sql, /if not coalesce\(\(select "on" from public\.checkout_reminder_settings/);
});
