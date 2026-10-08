// Blocky Stories: the spending safety (spendWatch.js). A cap per user, the alarm when our provider spend
// runs ahead of what users were charged (it pauses paid calls and emails the admin), and the alert for a
// job that is sent too often. No provider and no database: the numbers are given.
import test from "node:test";
import assert from "node:assert/strict";
import { AHEAD_ALARM_USD, MAX_JOB_ATTEMPTS, RETRY_ALERT, SPEND_ALERT, USER_DAILY_USD, inFlightUsd, isUserSpend, judgeSpend, runSpendWatch, usdOfCredits, userBudget } from "../supabase/functions/_shared/blocky/spendWatch.js";
import { MESSAGES } from "../supabase/functions/_shared/blocky/errors.js";

test("the cap per user: $20 of our real cost a day, counted with what is still running and what the step adds", () => {
  assert.equal(USER_DAILY_USD, 20);
  assert.equal(userBudget({ spentUsd: 12, runningUsd: 3, addUsd: 4.9 }).ok, true);
  assert.equal(userBudget({ spentUsd: 12, runningUsd: 3, addUsd: 5 }).ok, true, "exactly at the cap still goes");
  const over = userBudget({ spentUsd: 12, runningUsd: 3, addUsd: 5.01 });
  assert.deepEqual([over.ok, over.leftUsd], [false, 5]);
  assert.equal(userBudget({ spentUsd: 25 }).leftUsd, 0);
  // What running jobs are expected to cost: a picture, a clip's seconds at its tier's dearest model.
  assert.equal(Number(inFlightUsd([{ kind: "image" }, { kind: "image" }]).toFixed(2)), 0.08);
  assert.equal(Number(inFlightUsd([{ kind: "clip", tool_key: "video:blocky-story-v4", price_input: { durationSec: 6 } }]).toFixed(2)), 0.9);
  assert.ok(inFlightUsd([{ kind: "clip", tool_key: "video:something-new", price_input: {} }]) > 2, "an unknown clip is assumed long and dear");
  // The message says what happened, when it ends, and that nothing was charged.
  assert.match(MESSAGES.USER_DAILY_LIMIT, /today/i);
  assert.match(MESSAGES.USER_DAILY_LIMIT, /midnight UTC/);
  assert.match(MESSAGES.USER_DAILY_LIMIT, /Nothing was charged/);
});

test("what counts as spend: calls a user caused, not the owner's test scripts", () => {
  assert.equal(isUserSpend({ user_id: "u", purpose: "image" }), true);
  assert.equal(isUserSpend({ user_id: "u", purpose: "planner" }), true);
  assert.equal(isUserSpend({ user_id: null, purpose: "avatar_check" }), false);
  assert.equal(isUserSpend({ user_id: "u", purpose: "test:blocky-library-noob" }), false);
  assert.equal(isUserSpend({ user_id: "u", purpose: "blind_test:planner" }), false);
});

test("the alarm: a healthy day charges about twice what it spends; spend $10 ahead of charges is a bug", () => {
  // 100 stories: $135 spent, 10,300 credits charged (worth about $276).
  const healthy = judgeSpend({ spendUsd: 135, chargedCredits: 10300 });
  assert.equal(healthy.spendAlarm, false);
  assert.ok(healthy.aheadUsd < -100);
  // Free writing nobody paid for yet: a few dollars ahead is not an alarm.
  assert.equal(judgeSpend({ spendUsd: 6, chargedCredits: 0 }).spendAlarm, false);
  assert.equal(judgeSpend({ spendUsd: AHEAD_ALARM_USD, chargedCredits: 0 }).spendAlarm, false, "exactly at the line is not over it");
  // A loop that makes the same clips again and again: spend far ahead of what was charged.
  const bug = judgeSpend({ spendUsd: 40, chargedCredits: 103 });
  assert.deepEqual([bug.spendAlarm, bug.chargedUsd, bug.aheadUsd], [true, Number(usdOfCredits(103).toFixed(4)), Number((40 - usdOfCredits(103)).toFixed(4))]);
  // Refunds count against what was charged (the ledger is net).
  assert.equal(judgeSpend({ spendUsd: 12, chargedCredits: 50 }).spendAlarm, true);
});

test("the retry alert: a job sent more often than the engine ever means to", () => {
  const v = judgeSpend({ spendUsd: 1, chargedCredits: 100, jobs: [{ id: "a", attempt: MAX_JOB_ATTEMPTS }, { id: "b", attempt: MAX_JOB_ATTEMPTS + 1 }] });
  assert.deepEqual([v.retryAlarm, v.retried, v.spendAlarm], [true, [{ id: "b", attempt: MAX_JOB_ATTEMPTS + 1 }], false]);
  assert.equal(judgeSpend({ spendUsd: 1, chargedCredits: 100, jobs: [] }).retryAlarm, false);
});

/** A stand-in for the service client: records what the watch writes. */
function fakeAdmin({ notify = true } = {}) {
  const log = { settings: [], alerts: [] };
  return {
    log,
    from: (table) => ({ update: (patch) => ({ eq: async () => { if (table === "blocky_settings") log.settings.push(patch); return { error: null }; } }) }),
    rpc: async (name, args) => { log.alerts.push({ name, ...args }); return { data: notify, error: null }; },
  };
}

test("a spend alarm switches paid calls off, writes the alert and emails the admin; a healthy day does nothing", async () => {
  const sent = [];
  const send = async (env, subject, text) => { sent.push({ to: env.ALERT_EMAIL, subject, text }); return true; };
  const env = { RESEND_API_KEY: "k", ALERT_EMAIL: "owner@example.test" };

  const quiet = fakeAdmin();
  const ok = await runSpendWatch(quiet, env, { read: async () => ({ since: "s", spendUsd: 135, chargedCredits: 10300, jobs: [] }), send });
  assert.deepEqual([ok.spendAlarm, ok.paused, quiet.log.settings.length, quiet.log.alerts.length, sent.length], [false, false, 0, 0, 0]);

  const admin = fakeAdmin();
  const v = await runSpendWatch(admin, env, { read: async () => ({ since: "s", spendUsd: 40, chargedCredits: 103, jobs: [] }), send });
  assert.deepEqual([v.spendAlarm, v.paused], [true, true]);
  assert.deepEqual(admin.log.settings, [{ paid_calls: false }], "paid calls are switched off");
  assert.deepEqual([admin.log.alerts[0].name, admin.log.alerts[0].p_provider, admin.log.alerts[0].p_code], ["blocky_raise_provider_alert", SPEND_ALERT, "SPEND_AHEAD"]);
  assert.match(admin.log.alerts[0].p_message, /spent \$40\.00 at providers and charged users 103 credits/);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "owner@example.test");
  assert.match(sent[0].subject, /paid calls paused/);
  assert.match(sent[0].text, /paid\.mjs status/);
  assert.match(sent[0].text, /paid\.mjs on/);

  // The same alarm a minute later: still paused, no second email (the alert is not new).
  const again = fakeAdmin({ notify: false });
  const before = sent.length;
  const v2 = await runSpendWatch(again, env, { read: async () => ({ since: "s", spendUsd: 41, chargedCredits: 103, jobs: [] }), send });
  assert.deepEqual([v2.paused, again.log.settings.length, sent.length], [true, 1, before]);
});

test("a retry alert is written and emailed, and pauses nothing; a watch that can't read never throws", async () => {
  const sent = [];
  const admin = fakeAdmin();
  const v = await runSpendWatch(admin, { RESEND_API_KEY: "k", ALERT_EMAIL: "o@example.test" }, { read: async () => ({ since: "s", spendUsd: 1, chargedCredits: 100, jobs: [{ id: "job-1", attempt: 9 }] }), send: async (_e, subject) => { sent.push(subject); return true; } });
  assert.deepEqual([v.retryAlarm, v.paused, admin.log.settings.length, admin.log.alerts[0].p_provider], [true, false, 0, RETRY_ALERT]);
  assert.match(admin.log.alerts[0].p_message, /job-1 \(9\)/);
  assert.equal(sent.length, 1);
  assert.equal(await runSpendWatch(fakeAdmin(), {}, { read: async () => { throw new Error("database down"); } }), null);
});
