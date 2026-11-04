// The follow-up reminders after sign-up (owner, 2026-11-04): who gets which, the texts, the dashboard numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REMINDER_CATEGORY, REMINDER_LINKS, reminderEmail, reminderFor, reminderStats } from "../supabase/functions/_shared/signupReminders.js";
import { emailFooter, WELCOME_SENDER } from "../supabase/functions/_shared/emailRules.js";
import { funnelStats } from "../supabase/functions/_shared/funnelStats.js";

const H = 3600000, NOW = Date.parse("2026-11-05T12:00:00Z");
const ago = (h) => new Date(NOW - h * H).toISOString();
const person = (o = {}) => ({ enrolled: true, owner: false, paid: false, unsubscribed: false, optedIn: false, preview: null, bonusEndsAt: null, lastActiveAt: null, signedUpAt: ago(2.5), sent: [], ...o });
const footer = emailFooter({ unsubscribeUrl: "https://www.tryzyvo.com/unsubscribe?u=x&t=y", why: "why", plain: true });

test("2 hours after sign-up: a finished preview and no payment gets the unlock reminder, no preview gets the start reminder", () => {
  assert.equal(reminderFor(person({ preview: { status: "ready" } }), NOW).kind, "preview_unpaid");
  assert.equal(reminderFor(person(), NOW).kind, "preview_not_made");
  assert.equal(reminderFor(person({ preview: { status: "failed" } }), NOW).kind, "preview_not_made");
  // a preview still being made: nothing
  assert.equal(reminderFor(person({ preview: { status: "reserved" } }), NOW).kind, null);
  // too early, and too late (the window closes at 6 hours)
  assert.equal(reminderFor(person({ signedUpAt: ago(1.5) }), NOW).kind, null);
  assert.equal(reminderFor(person({ signedUpAt: ago(7) }), NOW).kind, null);
});

test("never to someone who paid, unsubscribed, an owner or test account, or anyone outside the new flow", () => {
  for (const o of [{ paid: true }, { unsubscribed: true }, { owner: true }, { enrolled: false }]) {
    assert.equal(reminderFor(person({ preview: { status: "ready" }, ...o }), NOW).kind, null, JSON.stringify(o));
  }
});

test("not while they are on the site; once per kind; never two reminders within 24 hours", () => {
  assert.equal(reminderFor(person({ lastActiveAt: ago(0.2) }), NOW).why, "on the site now");
  assert.equal(reminderFor(person({ lastActiveAt: ago(0.6) }), NOW).kind, "preview_not_made");
  assert.equal(reminderFor(person({ sent: [{ kind: "preview_not_made", sentAt: ago(1) }] }), NOW).kind, null);
  // day 2: a reminder 23 hours ago blocks it, 46 hours ago doesn't
  const day2 = { signedUpAt: ago(48), optedIn: true, bonusEndsAt: new Date(NOW + 24 * H).toISOString() };
  assert.equal(reminderFor(person({ ...day2, sent: [{ kind: "preview_not_made", sentAt: ago(23) }] }), NOW).kind, null);
  assert.equal(reminderFor(person({ ...day2, sent: [{ kind: "preview_not_made", sentAt: ago(46) }] }), NOW).kind, "bonus_day2");
});

test("day 2 bonus: only with the opt-in, only while the bonus has over 12 hours left", () => {
  const day2 = { signedUpAt: ago(48), bonusEndsAt: new Date(NOW + 24 * H).toISOString() };
  assert.equal(reminderFor(person({ ...day2, optedIn: true }), NOW).kind, "bonus_day2");
  assert.equal(reminderFor(person({ ...day2, optedIn: false }), NOW).kind, null);
  assert.equal(reminderFor(person({ ...day2, optedIn: true, bonusEndsAt: new Date(NOW + 5 * H).toISOString() }), NOW).kind, null);
  assert.equal(reminderFor(person({ ...day2, optedIn: true, bonusEndsAt: null }), NOW).kind, null);
  assert.equal(reminderFor(person({ ...day2, optedIn: true, paid: true }), NOW).kind, null);
});

test("the texts: the owner's subjects, one link each with the click mark, the bonus's real end time, the plain style", () => {
  const unpaid = reminderEmail("preview_unpaid"), notMade = reminderEmail("preview_not_made");
  const bonus = reminderEmail("bonus_day2", { bonusEndsAt: "2026-11-06T21:02:00Z" });
  assert.equal(unpaid.subject, "Your video is still waiting: unlock the other 20 seconds");
  assert.equal(notMade.subject, "Your free video preview is still waiting");
  assert.equal(bonus.subject, "Your +50 bonus credits end tomorrow");
  assert.match(bonus.render(footer).text, /Friday 6 November, 21:02 UTC/);
  assert.match(notMade.render(footer).text, /it only takes a minute/);
  assert.match(unpaid.render(footer).html, /\/welcome\/first-video\?unlock=1&from=email&r=preview_unpaid/);
  assert.match(REMINDER_LINKS.bonus_day2, /\/pricing\?from=email&r=bonus_day2$/);
  assert.match(reminderEmail("bonus_day2", { bonusEndsAt: "2026-11-06T21:02:00Z", hasPreview: true }).render(footer).html, /unlock=1&from=email&r=bonus_day2/);
  for (const m of [unpaid, notMade, bonus]) {
    const { html } = m.render(footer);
    assert.equal((html.match(/<a /g) ?? []).length, 2, "one link plus the footer's unsubscribe");
    assert.doesNotMatch(html, /<img|<button|background:/);
  }
  assert.throws(() => reminderEmail("bonus_day2", {}));
  // the offer is marketing (opt-in, 1 a day); the two account reminders are like the welcome email
  assert.deepEqual(REMINDER_CATEGORY, { preview_unpaid: "account", preview_not_made: "account", bonus_day2: "marketing" });
});

test("the function sends from notify.tryzyvo.com with the plain footer, only while the switch is on, through the gate", () => {
  const src = readFileSync(new URL("../supabase/functions/signup-reminders/index.ts", import.meta.url), "utf8");
  assert.match(WELCOME_SENDER, /@notify\.tryzyvo\.com>$/);
  assert.match(src, /from: WELCOME_SENDER/);
  assert.match(src, /plain: true/);
  assert.match(src, /reminders_on !== true\) return json\(\{ skipped: "off" \}\)/);
  assert.match(src, /claimEmail\(admin, p\.email, `reminder_\$\{kind\}`, mail\.category\)/);
  assert.doesNotMatch(src, /api\.resend\.com/);
  const sql = readFileSync(new URL("../supabase/migrations/20261202100000_signup_reminders.sql", import.meta.url), "utf8");
  assert.match(sql, /reminders_on boolean not null default false/);
  assert.match(sql, /if not coalesce\(\(select reminders_on/);
});

test("dashboard: per reminder, sent / opened after 1 min / clicked / came back / made preview / paid, after each person's own email", () => {
  const sent = "2026-11-05T10:00:00Z", at = (m) => new Date(Date.parse(sent) + m * 60000).toISOString();
  const sends = [
    { user_id: "a", kind: "preview_not_made", resend_id: "r1", sent_at: sent },
    { user_id: "b", kind: "preview_not_made", resend_id: "r2", sent_at: sent },
    { user_id: "c", kind: "preview_unpaid", resend_id: "r3", sent_at: sent },
  ];
  const emailEvents = [
    { resend_id: "r1", type: "email.delivered", created_at: at(0) }, { resend_id: "r1", type: "email.opened", created_at: at(30) },
    { resend_id: "r2", type: "email.delivered", created_at: at(0) }, { resend_id: "r2", type: "email.opened", created_at: at(0.2) },
    { resend_id: "r3", type: "email.delivered", created_at: at(0) },
  ];
  const events = [
    { user_id: "a", event: "preview_generated", created_at: at(-200) }, // before the email: not counted
    { user_id: "a", event: "welcome_email_clicked", props: { email: "preview_not_made" }, created_at: at(31) },
    { user_id: "a", event: "preview_generated", created_at: at(33) },
    { user_id: "c", event: "upgraded", created_at: at(90) },
  ];
  const [unpaid, notMade, bonus] = reminderStats({ sends, emailEvents, events });
  assert.deepEqual([notMade.sent, notMade.delivered, notMade.opened, notMade.openedLater, notMade.clicked, notMade.cameBack, notMade.madePreview, notMade.paid], [2, 2, 2, 1, 1, 1, 1, 0]);
  assert.deepEqual([unpaid.sent, unpaid.opened, unpaid.paid], [1, 0, 1]);
  assert.equal(bonus.sent, 0);
  // a reminder's click is not the welcome email's
  const f = funnelStats({ events: [{ user_id: "a", event: "signed_up", created_at: at(-300) }, ...events, { user_id: "d", event: "welcome_email_clicked", props: {}, created_at: at(1) }], from: at(-400), to: at(400) });
  assert.equal(f.email.clicked, 1);
});
