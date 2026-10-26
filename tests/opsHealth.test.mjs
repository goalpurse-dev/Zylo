import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SERVICES, dailyReport, daysLeft, helsinkiClock, instantAlerts, judge, ownerEmails, ratePerDay } from "../supabase/functions/_shared/opsHealth.js";

// The owner's health report (2026-10-26): every outside service green or red, balance, days left,
// what to do; instant alerts only for real users failing or a balance running out within 3 days.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const svc = (id) => SERVICES.find((s) => s.id === id);

test("days left: from balance drops only (a top-up is not use), and only with enough history", () => {
  const t = (h) => new Date(Date.UTC(2026, 9, 26, 0) + h * 3600_000).toISOString();
  assert.equal(ratePerDay([{ balance: 30, at: t(0) }, { balance: 29, at: t(1) }]), null, "an hour of readings says nothing yet");
  assert.equal(ratePerDay([{ balance: 30, at: t(0) }, { balance: 24, at: t(12) }]), 12);
  assert.equal(ratePerDay([{ balance: 30, at: t(0) }, { balance: 20, at: t(6) }, { balance: 120, at: t(7) }, { balance: 110, at: t(12) }]), 40, "the top-up to 120 is ignored: 10 + 10 used in 12 hours");
  assert.equal(daysLeft(30, 15), 2);
  assert.equal(daysLeft(30, 0), null);
});

test("red only for real problems: not reachable, runs out within 3 days, real users failing; owner-only services never red", () => {
  assert.equal(judge(svc("runware"), { reachable: true, balance: 100, perDay: 10 }).red.length, 0);
  assert.match(judge(svc("runware"), { reachable: true, balance: 25, perDay: 12 }).red[0], /runs out in about 2\.1 days/);
  assert.match(judge(svc("openai"), { reachable: false, error: "401 invalid key" }).red[0], /not reachable: 401 invalid key/);
  assert.match(judge(svc("elevenlabs"), { reachable: true, balance: 50000, perDay: 2000, failures: 4, failingUsers: 2 }).red[0], /4 failures for 2 real users/);
  assert.equal(judge(svc("elevenlabs"), { reachable: true, balance: 50000, perDay: 2000, failures: 2, failingUsers: 1 }).red.length, 0, "one or two blips are not an outage");
  assert.equal(judge(svc("elevenlabs"), { reachable: true, balance: 3000, perDay: 2000, resetsInDays: 1 }).red.length, 0, "the monthly quota resets before it runs out");
  assert.equal(judge(svc("runpod"), { reachable: true, balance: 1, perDay: 5 }).red.length, 0, "Cutaway is the owner's test: shown, never red");
  assert.equal(judge(svc("runpod"), { reachable: true, balance: 1, perDay: 5 }).info.length, 1);
});

test("the daily email and the instant alerts say it in plain words, with what to do", () => {
  const results = [
    { service: svc("runware"), state: { reachable: true, balance: 25, unit: "usd", perDay: 12, perDaySource: "measured" } },
    { service: svc("anthropic"), state: { reachable: true, perDay: 2.5, unit: "usd", perDaySource: "estimate", note: "balance can't be read by API: keep auto-reload on" } },
  ].map((r) => ({ ...r, judged: judge(r.service, r.state) }));
  const rep = dailyReport(results, "2026-10-27T07:00:00Z");
  assert.equal(rep.subject, "Zyvo health: 1 RED (Runware)");
  assert.match(rep.text, /NEEDS YOU:\n- Runware: runs out in about 2\.1 days\. Top up at my\.runware\.ai/);
  assert.match(rep.text, /🔴 RED  Runware\n   working · balance \$25\.00 · uses about \$12\.00 a day · lasts about 2 days/);
  assert.match(rep.text, /🟢 GREEN  Anthropic \(Claude\)/);
  const alerts = instantAlerts(results);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].subject, "Zyvo ALERT: Runware — runs out in about 2.1 days");
  assert.equal(dailyReport([results[1]], "2026-10-27T07:00:00Z").subject, "Zyvo health: all green");
});

test("9:00 in Helsinki, summer and winter time", () => {
  assert.deepEqual(helsinkiClock("2026-10-27T07:05:00Z"), { date: "2026-10-27", hour: 9 }, "winter: UTC+2");
  assert.deepEqual(helsinkiClock("2026-06-01T06:05:00Z"), { date: "2026-06-01", hour: 9 }, "summer: UTC+3");
  assert.equal(helsinkiClock("2026-10-27T06:55:00Z").hour, 8);
});

test("the owner's tests never count: their accounts, their projects", () => {
  assert.deepEqual(ownerEmails("A@x.com, b@x.com", "a@x.com", undefined), ["a@x.com", "b@x.com"]);
  const fn = read("supabase/functions/ops-health/index.ts");
  assert.match(fn, /ownerEmails\(env\("ADMIN_EMAILS"\), env\("CUTAWAY_TEST_USERS"\)\)/);
  assert.match(fn, /filter\(\(l: any\) => real\(l\.details\?\.projectId\)\)/);
  assert.match(fn, /filter\(\(j: any\) => real\(null, j\.user_id\)\)/);
  assert.match(fn, /if \(!SECRET \|\| req\.headers\.get\("x-ops-secret"\) !== SECRET\) return json\(\{ error: "Unauthorized" \}, 401\);/);
  assert.doesNotMatch(fn, /\.update\(|\.delete\(|markProviderDown|postpone/, "the health check only reads (and writes its own readings and log)");
  const narr = read("supabase/functions/generate-long-form-narration-audio/index.ts");
  assert.equal(narr.split("!(await isOwnerProject(admin, projectId))").length - 1, 2, "both voice alerts skip the owner's own projects");
  const sql = read("supabase/migrations/20261108300000_ops_health.sql");
  assert.match(sql, /cron\.schedule\('ops-health', '\*\/10 \* \* \* \*'/);
  assert.match(sql, /alter table public\.provider_balance_history enable row level security/);
});

test("alerts are grouped: the same alert (numbers aside) at most once per 6 hours", async () => {
  const src = read("supabase/functions/_shared/adminAlert.ts");
  assert.match(src, /export const ALERT_GROUP_S = 6 \* 3600;/);
  assert.match(src, /if \(!gate\.send\) \{/);
  const { alertGroupKey } = await import("../supabase/functions/_shared/adminAlert.ts");
  assert.equal(alertGroupKey("Zyvo: Runware balance low ($2.98) — new work paused"), alertGroupKey("Zyvo: Runware balance low ($3.27) — new work paused"));
  assert.notEqual(alertGroupKey("Zyvo ALERT: Runware — balance is empty"), alertGroupKey("Zyvo ALERT: ElevenLabs — balance is empty"));
});

test("one failing project is put aside: a crash in our code is never a provider outage, and drawing pauses only when other projects fail too", async () => {
  const { classifyFailure, outageDecision } = await import("../supabase/functions/_shared/stickman/sceneLadder.ts");
  assert.equal(classifyFailure("TypeError: Cannot read properties of undefined (reading 'midground')"), "code");
  assert.equal(classifyFailure("backup: TypeError: x is not a function"), "code");
  assert.equal(classifyFailure("TypeError: error sending request"), "provider", "a dropped connection is the provider, not our code");
  assert.equal(classifyFailure("Runware 504 gateway timeout"), "provider");
  const base = { failures: ["Runware 504", "safe: Runware 504", "backup: Runware 504"], readyLately: 0, pendingOthers: 5, outage: null, nowMs: Date.parse("2026-10-27T12:00:00Z") };
  assert.equal(outageDecision({ ...base, otherProjectsFailing: 0 }).kind, "cover", "only this project fails: covered, nobody else waits");
  assert.equal(outageDecision({ ...base, otherProjectsFailing: 2 }).kind, "wait", "several projects fail: a real outage, drawing pauses");
  assert.equal(outageDecision({ ...base, failures: ["TypeError: Cannot read properties of undefined (reading 'midground')", "safe: TypeError: Cannot read properties of undefined (reading 'midground')", "backup: TypeError: Cannot read properties of undefined (reading 'midground')"], otherProjectsFailing: 3 }).kind, "cover", "our own bug never pauses everyone");
  assert.match(read("supabase/functions/render-long-form-scene/index.ts"), /nowMs: Date\.now\(\), otherProjectsFailing \}\)/);
});
