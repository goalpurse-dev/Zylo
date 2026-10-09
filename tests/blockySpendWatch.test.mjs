// Blocky Stories: the spending safety (spendWatch.js). A cap per user, the alarm when our provider spend
// runs ahead of what users were charged (it pauses paid calls and emails the admin), and the alert for a
// job that is sent too often. No provider and no database: the numbers are given.
import test from "node:test";
import assert from "node:assert/strict";
import { AHEAD_ALARM_USD, MAX_JOB_ATTEMPTS, RETRY_ALERT, SPEND_ALERT, USER_DAILY_USD, WINDOW_ALERT, WINDOW_CAP_DEFAULT_USD, WINDOW_HOURS, cleanWindowCap, inFlightUsd, isUserSpend, judgeSpend, noteWindowHit, opsCard, runSpendWatch, usdOfCredits, userBudget, windowBudget } from "../supabase/functions/_shared/blocky/spendWatch.js";
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

test("the alarm card on /admin/ops: the switch, the numbers, and only the alerts that are open", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const paidOn = { on: true, reason: null, spentUsd: 3.2, inFlightUsd: 0.5, capUsd: 999999.99 };
  const quiet = opsCard({ paid: paidOn, numbers: { since: "2026-10-08T12:00:00Z", spendUsd: 3.2, chargedCredits: 300 }, now });
  assert.deepEqual([quiet.paidCalls, quiet.offReason, quiet.alerts.length], [true, null, 0]);
  assert.equal("capUsd" in quiet.today, false, "there is no daily cap anymore: the 3-hour limit is the one limit");
  assert.deepEqual([quiet.watch.spendUsd, quiet.watch.chargedCredits, quiet.watch.alarmAtUsd, quiet.limits.userDailyUsd], [3.2, 300, AHEAD_ALARM_USD, USER_DAILY_USD]);
  assert.ok(quiet.watch.aheadUsd < 0, "a healthy day: charges are ahead of spend");
  // A spend alarm: open until paid calls are switched back on by hand, however old it is.
  const spend = { provider: SPEND_ALERT, message: "ahead", opened_at: "2026-10-07T10:00:00Z", last_seen_at: "2026-10-07T10:00:00Z", count: 3 };
  const retry = { provider: RETRY_ALERT, message: "job-1 (9)", opened_at: "2026-10-09T11:00:00Z", last_seen_at: "2026-10-09T11:00:00Z", count: 1 };
  const paused = opsCard({ paid: { on: false, reason: "switch_off", spentUsd: 40, inFlightUsd: 0, capUsd: 25 }, numbers: { spendUsd: 40, chargedCredits: 103, jobs: [{ id: "job-1", attempt: 9 }] }, alerts: [spend, retry], now });
  assert.deepEqual([paused.paidCalls, paused.offReason, paused.watch.retried], [false, "switch_off", 1]);
  assert.deepEqual(paused.alerts.map((a) => [a.kind, a.message, a.count]), [["spend", "ahead", 3], ["retries", "job-1 (9)", 1]]);
  // Cleared after it was last seen: gone. Seen again after the clearing: back.
  assert.deepEqual(opsCard({ paid: paidOn, numbers: {}, alerts: [spend], clearedAt: "2026-10-08T09:00:00Z", now }).alerts, []);
  assert.equal(opsCard({ paid: paidOn, numbers: {}, alerts: [{ ...spend, last_seen_at: "2026-10-09T09:00:00Z" }], clearedAt: "2026-10-08T09:00:00Z", now }).alerts.length, 1);
  // A retry alert is shown for a day.
  assert.deepEqual(opsCard({ paid: paidOn, numbers: {}, alerts: [{ ...retry, last_seen_at: "2026-10-08T11:00:00Z" }], now }).alerts, []);
});

test("Blocky's one limit: $20 of our cost for all users together in any 3 hours", () => {
  assert.deepEqual([WINDOW_HOURS, WINDOW_CAP_DEFAULT_USD], [3, 20]);
  const b = windowBudget({ spentUsd: 12, runningUsd: 3, addUsd: 0.15 });
  assert.deepEqual([b.ok, b.usedUsd, b.leftUsd, b.capUsd], [true, 15, 5, 20]);
  // What is running counts too, so three users pressing at once can't pass the limit together.
  assert.equal(windowBudget({ spentUsd: 12, runningUsd: 7.9, addUsd: 0.15 }).ok, false);
  assert.equal(windowBudget({ spentUsd: 19.85, addUsd: 0.15 }).ok, true, "exactly at the limit still passes");
  assert.equal(windowBudget({ spentUsd: 19.9, addUsd: 0.15 }).ok, false);
  // The owner's number, when one is set.
  assert.equal(windowBudget({ spentUsd: 30, addUsd: 1, capUsd: 60 }).ok, true);
  assert.deepEqual([cleanWindowCap("60"), cleanWindowCap(35.555), cleanWindowCap(0), cleanWindowCap(-5), cleanWindowCap("abc"), cleanWindowCap(999999)], [60, 35.56, null, null, null, null]);
});

test("the limit is reached: the alert is written and the owner is emailed once an hour at most; it never throws", async () => {
  const sent = [];
  const admin = fakeAdmin();
  const budget = windowBudget({ spentUsd: 19.5, runningUsd: 0.6, addUsd: 0.15 });
  assert.equal(await noteWindowHit(admin, { RESEND_API_KEY: "k", ALERT_EMAIL: "o@example.test" }, budget, { send: async (env, subject, text) => { sent.push({ subject, text }); return true; } }), true);
  assert.deepEqual([admin.log.alerts[0].p_provider, admin.log.alerts[0].p_code, admin.log.settings.length], [WINDOW_ALERT, "WINDOW_LIMIT", 0], "the limit pauses nothing: the paid switch is untouched");
  assert.match(admin.log.alerts[0].p_message, /\$20\.10 of our cost in the last 3 hours \(the limit is \$20\.00\)/);
  assert.match(sent[0].subject, /3-hour limit was reached/);
  assert.match(sent[0].text, /raise the limit on \/admin\/ops/);
  // The same hour: the row is updated, no second email.
  assert.equal(await noteWindowHit(fakeAdmin({ notify: false }), {}, budget, { send: async () => { sent.push("again"); return true; } }), false);
  assert.equal(sent.length, 1);
  assert.equal(await noteWindowHit({ rpc: async () => { throw new Error("database down"); } }, {}, budget), false);
});

test("the card on /admin/ops shows the window against its limit, and a reached limit for three hours", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const paid = { on: true, reason: null, spentUsd: 30, inFlightUsd: 0 };
  const card = opsCard({ paid, numbers: {}, window: { spentUsd: 17.5, runningUsd: 1.25, capUsd: 40 }, now });
  assert.deepEqual([card.window.hours, card.window.usedUsd, card.window.capUsd, card.window.leftUsd, card.window.full], [3, 18.75, 40, 21.25, false]);
  assert.deepEqual(card.window.range, { min: 1, max: 5000 });
  const hit = { provider: WINDOW_ALERT, message: "limit", opened_at: "2026-10-09T11:00:00Z", last_seen_at: "2026-10-09T11:30:00Z", count: 4 };
  const full = opsCard({ paid, numbers: {}, window: { spentUsd: 41, capUsd: 40 }, alerts: [hit], now });
  assert.deepEqual([full.window.full, full.alerts.map((a) => a.kind).join(), full.paidCalls], [true, "window", true], "the limit asks users to wait; it does not switch paid calls off");
  assert.deepEqual(opsCard({ paid, numbers: {}, alerts: [{ ...hit, last_seen_at: "2026-10-09T08:30:00Z" }], now }).alerts, []);
});

test("the API: what the limit stops, what goes on, and who may ask for what", async () => {
  const fs = await import("node:fs");
  const api = fs.readFileSync(new URL("../supabase/functions/blocky-story-api/index.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const bodyOf = (name) => api.slice(api.indexOf(`  async ${name}(ctx) {`), api.indexOf("\n  },", api.indexOf(`  async ${name}(ctx) {`)));
  // Something new stops at the limit: ideas, three versions, a story from a script, a series plan.
  for (const name of ["getIdeas", "startDraft", "createStory"]) assert.doesNotMatch(bodyOf(name), /inProgress: true/, name);
  // Something under way goes on: the versions of a started draft, the pick, an edit in a story, the post text, the final video.
  for (const name of ["writeVersion", "pickVersion", "editScene"]) assert.match(bodyOf(name), /requirePaidCalls\([^\n]*\{ inProgress: true \}\)/, name);
  assert.equal(api.split("requirePaidCalls(SMALL_USD, null, { inProgress: true })").length - 1, 2, "the post text and the final video");
  // A step of a story is under way once the story has been paid for (pictures made): the first paid step is new.
  assert.match(api, /await requirePaidCalls\(estimateUsd\(plan\.items\), ctx\.userId, \{ inProgress: spent > 0 \}\);/);
  // The refusal comes before the cap per user and before any charge, with the friendly words.
  const guard = api.slice(api.indexOf("async function requirePaidCalls"), api.indexOf("/* ─── helpers"));
  assert.ok(guard.indexOf('throw blockyError("HIGH_DEMAND")') > 0 && guard.indexOf('throw blockyError("HIGH_DEMAND")') < guard.indexOf('throw blockyError("USER_DAILY_LIMIT")'));
  const { MESSAGES } = await import("../supabase/functions/_shared/blocky/errors.js");
  assert.equal(MESSAGES.HIGH_DEMAND, "High demand right now, please try again shortly. Nothing was charged.");
  assert.equal(MESSAGES.PLAN_UPGRADE_REQUIRED, "You need at least the Starter plan to continue.");
  // Tiers by plan, on the server: when a story is written (both ways in) and again before every charge.
  assert.match(api, /const PLAN_RANK: Record<string, number> = \{ starter: 1, affiliate: 1, pro: 2, generative: 3 \};/);
  assert.match(api, /const QUALITY_PLAN: Record<string, \[number, string\]> = \{ v2: \[1, "Starter"\], v3: \[2, "Pro"\], v4: \[3, "Generative"\] \};/);
  for (const name of ["startDraft", "createStory"]) assert.match(bodyOf(name), /if \(\(PLAN_RANK\[ctx\.plan\] \?\? 0\) < need\) throw blockyError\("PLAN_UPGRADE_REQUIRED"/, name);
  const step = api.slice(api.indexOf("async function runStep"), api.indexOf("blocky_charge_step", api.indexOf("async function runStep")));
  assert.match(step, /QUALITY_PLAN\[row\.quality\]/);
  assert.ok(step.indexOf("PLAN_UPGRADE_REQUIRED") > 0, "the tier is checked before the charge");
  // A signed-out visitor gets the avatar library and nothing else, and only once Blocky is on for everyone.
  assert.match(api, /if \(body\?\.action === "listCharacters" && await globallyOn\(FLAG\)\) return reply\(/);
  assert.equal(api.split("globallyOn(FLAG)").length - 1, 1);
  // The owner's limit setting is the owner's alone.
  const setCap = api.slice(api.indexOf('body?.action === "opsSetWindowCap"'), api.indexOf("const handler = ACTIONS"));
  assert.match(setCap, /adminEmails\(\)\.includes/);
  assert.match(setCap, /cleanWindowCap\(body\?\.usd\)/);
});

test("the alerts table accepts every alert name Blocky writes (it refused them all until 2026-10-09)", async () => {
  const fs = await import("node:fs");
  const { ALERT_NAMES, raiseAlert } = await import("../supabase/functions/_shared/blocky/spendWatch.js");
  assert.deepEqual([...ALERT_NAMES].sort(), [RETRY_ALERT, SPEND_ALERT, "blocky:spend-cleared", WINDOW_ALERT].sort());
  const dir = new URL("../supabase/migrations/", import.meta.url);
  // The last migration that sets the rule is the rule.
  const rule = fs.readdirSync(dir).sort().map((f) => fs.readFileSync(new URL(f, dir), "utf8")).filter((sql) => sql.includes("ADD CONSTRAINT blocky_provider_alerts_provider_check")).at(-1);
  const allowed = [...rule.slice(rule.lastIndexOf("ADD CONSTRAINT blocky_provider_alerts_provider_check")).matchAll(/'([^']+)'::text/g)].map((m) => m[1]);
  for (const name of [...ALERT_NAMES, "runware", "anthropic", "openai"]) assert.ok(allowed.includes(name), `the table must accept "${name}"`);
  // A row the database refuses is not a quiet "no need to tell anyone": it is logged and nothing is sent twice.
  const errors = [];
  const keep = console.error;
  console.error = (...a) => errors.push(a.join(" "));
  try {
    assert.equal(await raiseAlert({ rpc: async () => ({ data: null, error: { message: "violates check constraint" } }) }, SPEND_ALERT, "X", "m"), false);
  } finally { console.error = keep; }
  assert.match(errors[0], /ALERT ROW NOT WRITTEN \(blocky:spend\): violates check constraint/);
  assert.equal(await raiseAlert({ rpc: async () => ({ data: true, error: null }) }, SPEND_ALERT, "X", "m"), true);
});
