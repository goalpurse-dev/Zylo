// Content Machine, Phase 1: who may use it (a plain 404 for everyone but the verified admin), the Budget
// Guard (no call without a reservation, dry runs never call the provider), the settings checks and the
// spend numbers. No provider and no database: a store in memory stands in for the SQL, whose own rules
// are tested in tests/contentMachineSpend.lifecycle.sql (node scripts/contentMachine/sqlCheck.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NOT_FOUND_BODY, adminEmailList, adminFromRequest, isAdmin } from "../supabase/functions/_shared/contentMachine/adminGuard.js";
import { BudgetStopped, createBudgetGuard } from "../supabase/functions/_shared/contentMachine/budgetGuard.js";
import { SettingsError, cleanSettingsPatch, settingsDiff } from "../supabase/functions/_shared/contentMachine/settings.js";
import { dailySeries, daysBack, localDay, summarize } from "../supabase/functions/_shared/contentMachine/spendSummary.js";
import { createHandler } from "../supabase/functions/_shared/contentMachine/api.js";
import { cors } from "../supabase/functions/shared/cors.ts";
import { findPaidCallsOutsideGuard } from "../scripts/contentMachine/checkPaidCalls.mjs";

const OWNER = "upwardlift6@gmail.com";
const EMAILS = adminEmailList(` ${OWNER.toUpperCase()} , other@example.com,`);
const verified = (email) => ({ id: "u1", email, email_confirmed_at: "2026-01-01T00:00:00Z" });

/** The SQL's rules in miniature: kill switch, daily and per-provider caps, actual else estimate. */
function memoryStore(settings = {}) {
  const s = { dry_run: false, kill_switch: false, daily_budget_usd: 8, monthly_budget_usd: 150, per_provider_daily_caps: { runware: 6 }, lane_daily_caps: { slideshow: 2 }, timezone: "Europe/Helsinki", models: {}, ...settings };
  const rows = [], auditRows = [];
  const cost = (r) => r.actual_usd ?? r.estimated_usd;
  return {
    s, rows, auditRows,
    async readSettings() { return { ...s }; },
    async updateSettings(patch, by) { Object.assign(s, patch, { updated_by: by }); return { ...s }; },
    async reserve({ provider, operation, estimatedUsd, lane, dryRun }) {
      const today = rows.reduce((a, r) => a + cost(r), 0);
      const prov = rows.filter((r) => r.provider === provider).reduce((a, r) => a + cost(r), 0);
      const cap = s.per_provider_daily_caps[provider];
      const reason = s.kill_switch ? "kill_switch" : estimatedUsd < 0 ? "bad_estimate"
        : today + estimatedUsd > s.daily_budget_usd ? "daily_cap" : cap != null && prov + estimatedUsd > cap ? "provider_cap" : null;
      if (reason) return { ok: false, reason };
      const row = { id: `L${rows.length + 1}`, provider, operation, lane, estimated_usd: dryRun ? 0 : estimatedUsd, actual_usd: null, status: "reserved", dry_run: dryRun, would_cost_usd: dryRun ? estimatedUsd : null, local_day: localDay(new Date(), s.timezone) };
      rows.push(row);
      return { ok: true, ledger_id: row.id };
    },
    async settle({ ledgerId, actualUsd, status, error }) {
      const r = rows.find((x) => x.id === ledgerId && x.status === "reserved");
      if (!r) return false;
      Object.assign(r, { actual_usd: r.dry_run ? 0 : actualUsd, status, error });
      return true;
    },
    async ledgerSince() { return [...rows]; },
    async audit(email, action, payload) { auditRows.push({ actor_email: email, action, payload }); },
    async auditLog() { return [...auditRows]; },
  };
}

function handlerWith({ user = verified(OWNER), store = memoryStore(), getUser } = {}) {
  const guard = createBudgetGuard({ store });
  const handle = createHandler({ getUser: getUser ?? (async () => ({ data: { user }, error: null })), emails: EMAILS, store, guard, cors });
  return { handle, store };
}
const call = (handle, { method = "POST", token = "t", body, origin = "https://tryzyvo.com" } = {}) => handle(new Request("https://x.supabase.co/functions/v1/content-machine-api", {
  method,
  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json", Origin: origin },
  body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
}));

/* ─── who may use it ─────────────────────────────────────────────────── */

test("the admin is a verified account whose email is in ADMIN_EMAILS, nobody else", () => {
  assert.deepEqual(EMAILS, [OWNER, "other@example.com"]);
  assert.equal(isAdmin(verified(OWNER), EMAILS), true);
  assert.equal(isAdmin(verified("Upwardlift6@Gmail.com"), EMAILS), true, "case does not matter");
  assert.equal(isAdmin({ ...verified(OWNER), email_confirmed_at: null }, EMAILS), false, "an unverified email is not enough");
  assert.equal(isAdmin(verified("someone@else.com"), EMAILS), false);
  assert.equal(isAdmin(null, EMAILS), false);
  assert.equal(isAdmin(verified(OWNER), adminEmailList("")), false, "no list, no admin");
});

test("adminFromRequest never throws: no token, a bad token or a failing auth call is just not the admin", async () => {
  const req = (h) => new Request("https://x", { headers: h });
  const ok = async () => ({ data: { user: verified(OWNER) }, error: null });
  assert.equal((await adminFromRequest(req({ Authorization: "Bearer t" }), { getUser: ok, emails: EMAILS }))?.email, OWNER);
  assert.equal(await adminFromRequest(req({}), { getUser: ok, emails: EMAILS }), null);
  assert.equal(await adminFromRequest(req({ Authorization: "Bearer t" }), { getUser: async () => ({ data: { user: null }, error: { message: "bad jwt" } }), emails: EMAILS }), null);
  assert.equal(await adminFromRequest(req({ Authorization: "Bearer t" }), { getUser: async () => { throw new Error("down"); }, emails: EMAILS }), null);
});

test("everyone but the admin gets the same plain 404, whatever the method or action", async () => {
  const cases = [
    ["a signed-in user", handlerWith({ user: verified("someone@else.com") }), {}],
    ["the owner's email, unverified", handlerWith({ user: { ...verified(OWNER), email_confirmed_at: null } }), {}],
    ["no token", handlerWith(), { token: null }],
    ["a GET from a stranger", handlerWith({ user: verified("someone@else.com") }), { method: "GET" }],
    ["auth down", handlerWith({ getUser: async () => { throw new Error("down"); } }), {}],
  ];
  for (const [label, { handle, store }, opts] of cases) {
    for (const action of ["whoami", "status", "setKillSwitch", "nonsense"]) {
      const res = await call(handle, { ...opts, body: { action, on: true } });
      assert.equal(res.status, 404, `${label} / ${action}`);
      assert.deepEqual(await res.json(), NOT_FOUND_BODY, `${label} / ${action}: nothing tells the page exists`);
    }
    assert.equal(store.s.kill_switch, false, `${label}: nothing changed`);
    assert.equal(store.auditRows.length, 0);
  }
});

test("CORS preflight still works, so the owner's page can call the API", async () => {
  const { handle } = handlerWith({ getUser: async () => { throw new Error("a preflight never reaches the admin check"); } });
  const res = await handle(new Request("https://x/functions/v1/content-machine-api", {
    method: "OPTIONS", headers: { Origin: "https://tryzyvo.com", "Access-Control-Request-Headers": "authorization, content-type" },
  }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "https://tryzyvo.com");
  assert.match(res.headers.get("access-control-allow-headers"), /authorization/);
  assert.match(res.headers.get("access-control-allow-methods"), /POST/);
  // And the 404 itself carries the CORS headers, so the page can read it and show the site's 404.
  const denied = await call(handlerWith({ user: verified("someone@else.com") }).handle, { body: { action: "status" } });
  assert.equal(denied.headers.get("access-control-allow-origin"), "https://tryzyvo.com");
});

test("the admin gets through: whoami, status, POST only, unknown actions refused", async () => {
  const { handle } = handlerWith();
  const who = await call(handle, { body: { action: "whoami" } });
  assert.equal(who.status, 200);
  assert.deepEqual(await who.json(), { ok: true, data: { email: OWNER } });
  const st = await (await call(handle, { body: { action: "status" } })).json();
  assert.equal(st.ok, true);
  assert.equal(st.data.models.main, "claude-sonnet-5-5");
  assert.equal(st.data.spend.day.capUsd, 8);
  assert.equal((await call(handle, { method: "GET" })).status, 405);
  assert.equal((await call(handle, { body: { action: "nonsense" } })).status, 400);
});

/* ─── the Budget Guard ───────────────────────────────────────────────── */

test("a call that would exceed a cap is refused before the provider is called, and nothing is reserved", async () => {
  const store = memoryStore();
  const guard = createBudgetGuard({ store });
  let calls = 0;
  const fn = async () => { calls += 1; return { result: "img", actualUsd: 0.01, requestRef: "task-1" }; };
  const r = await guard.spend("runware", "runware.image.fast", 5, fn);
  assert.deepEqual([r.result, r.actualUsd, r.dryRun], ["img", 0.01, false]);
  assert.equal(store.rows[0].status, "settled");
  assert.equal(store.rows[0].actual_usd, 0.01, "the provider's actual replaces the estimate");
  // Daily cap $8: 0.01 spent, 8 more would be 8.01.
  await assert.rejects(guard.spend("anthropic", "anthropic.messages", 8, fn), (e) => e instanceof BudgetStopped && e.reason === "daily_cap");
  // Runware's own cap $6.
  await assert.rejects(guard.spend("runware", "runware.image.fast", 6, fn), (e) => e instanceof BudgetStopped && e.reason === "provider_cap");
  assert.equal(calls, 1, "refused calls never reach the provider");
  assert.equal(store.rows.length, 1, "and reserve nothing");
});

test("the kill switch stops everything, dry runs included", async () => {
  const store = memoryStore({ kill_switch: true });
  const guard = createBudgetGuard({ store });
  let called = false;
  await assert.rejects(guard.spend("runware", "x", 0, async () => { called = true; }), (e) => e.reason === "kill_switch");
  await assert.rejects(guard.spend("runware", "x", 0, async () => { called = true; }, { forceDryRun: true, mock: async () => { called = true; } }), (e) => e.reason === "kill_switch");
  assert.equal(called, false);
  assert.equal(store.rows.length, 0);
});

test("dry run: the provider is never called, the mock is, and the row holds $0", async () => {
  for (const [label, store, envDryRun] of [["DRY_RUN secret", memoryStore(), "true"], ["dry_run setting", memoryStore({ dry_run: true }), undefined]]) {
    const guard = createBudgetGuard({ store, envDryRun });
    let real = 0;
    const r = await guard.spend("runware", "runware.image.fast", 0.5, async () => { real += 1; }, { mock: async () => "mocked" });
    assert.equal(real, 0, label);
    assert.deepEqual([r.result, r.dryRun, r.actualUsd, r.wouldCostUsd], ["mocked", true, 0, 0.5], label);
    assert.deepEqual([store.rows[0].estimated_usd, store.rows[0].actual_usd, store.rows[0].would_cost_usd], [0, 0, 0.5], label);
  }
  // A dry run is still refused where the real call would be.
  const guard = createBudgetGuard({ store: memoryStore({ dry_run: true }) });
  await assert.rejects(guard.spend("runware", "x", 7, async () => {}), (e) => e.reason === "provider_cap");
});

test("a failed call is marked failed; its estimate keeps counting unless the error says what it cost", async () => {
  const store = memoryStore();
  const guard = createBudgetGuard({ store });
  await assert.rejects(guard.spend("runware", "x", 1, async () => { throw new Error("timeout"); }), /timeout/);
  assert.deepEqual([store.rows[0].status, store.rows[0].actual_usd], ["failed", null]);
  await assert.rejects(guard.spend("runware", "x", 1, async () => { throw Object.assign(new Error("400 bad request"), { actualUsd: 0 }); }));
  assert.deepEqual([store.rows[1].status, store.rows[1].actual_usd], ["failed", 0]);
  // No actual in the answer: the estimate stays (settled, actual unknown).
  await guard.spend("runware", "x", 0.25, async () => ({ result: 1 }));
  assert.deepEqual([store.rows[2].status, store.rows[2].actual_usd], ["settled", null]);
});

test("the guard refuses unknown providers and a missing operation outright", async () => {
  const guard = createBudgetGuard({ store: memoryStore() });
  await assert.rejects(guard.spend("stripe", "x", 0, async () => {}), /Unknown provider/);
  await assert.rejects(guard.spend("runware", "", 0, async () => {}), /operation/);
  await assert.rejects(guard.spend("runware", "x", "lots", async () => {}), (e) => e.reason === "bad_estimate");
});

test("guardTest shows the live caps at work without ever making the call, and is audited", async () => {
  const { handle, store } = handlerWith();
  const ok = await (await call(handle, { body: { action: "guardTest", provider: "runware", estimatedUsd: 1 } })).json();
  assert.equal(ok.data.allowed, true);
  assert.equal(store.rows[0].dry_run, true);
  const no = await (await call(handle, { body: { action: "guardTest", provider: "runware", estimatedUsd: 7 } })).json();
  assert.deepEqual([no.data.allowed, no.data.reason], [false, "provider_cap"]);
  assert.match(no.data.message, /provider/);
  assert.deepEqual(store.auditRows.map((a) => [a.actor_email, a.action, a.payload.allowed]), [[OWNER, "guard.test", true], [OWNER, "guard.test", false]]);
});

/* ─── settings and the kill switch through the API ───────────────────── */

test("settings: checked, saved, and every change audited with before and after", async () => {
  const { handle, store } = handlerWith();
  const res = await (await call(handle, { body: { action: "saveSettings", patch: { daily_budget_usd: "5.5", slideshows_per_day: 7, lane_daily_caps: { slideshow: 3 } } } })).json();
  assert.equal(res.ok, true);
  assert.deepEqual([store.s.daily_budget_usd, store.s.slideshows_per_day, store.s.lane_daily_caps], [5.5, 7, { slideshow: 3 }]);
  assert.equal(store.auditRows[0].action, "settings.save");
  assert.deepEqual(store.auditRows[0].payload.changes.daily_budget_usd, [8, 5.5]);
  // The same values again: nothing written, nothing audited.
  await call(handle, { body: { action: "saveSettings", patch: { slideshows_per_day: 7 } } });
  assert.equal(store.auditRows.length, 1);
  // Refusals say why and change nothing.
  for (const patch of [{ daily_budget_usd: -1 }, { daily_budget_usd: 200 }, { timezone: "Mars/Olympus" }, { kill_switch: true }, { run_time_local: "25:00" }, { format_mix: { ads: 3 } }, {}]) {
    const r = await call(handle, { body: { action: "saveSettings", patch } });
    assert.equal(r.status, 400, JSON.stringify(patch));
    assert.equal((await r.json()).code, "VALIDATION");
  }
  assert.equal(store.s.daily_budget_usd, 5.5);
});

test("the kill switch through the API: on, off, audited", async () => {
  const { handle, store } = handlerWith();
  const on = await (await call(handle, { body: { action: "setKillSwitch", on: true } })).json();
  assert.equal(on.data.settings.kill_switch, true);
  await call(handle, { body: { action: "setKillSwitch", on: false } });
  assert.deepEqual(store.auditRows.map((a) => a.action), ["kill_switch.on", "kill_switch.off"]);
  assert.equal((await call(handle, { body: { action: "setKillSwitch", on: "yes" } })).status, 400);
});

test("cleanSettingsPatch and settingsDiff on their own", () => {
  assert.deepEqual(cleanSettingsPatch({ per_provider_daily_caps: { runware: "6", anthropic: 1.499 } }), { per_provider_daily_caps: { runware: 6, anthropic: 1.5 } });
  assert.deepEqual(cleanSettingsPatch({ models: { main: "claude-sonnet-5-5", fast: "" } }), { models: { main: "claude-sonnet-5-5", fast: "" } });
  assert.throws(() => cleanSettingsPatch({ models: { main: "rm -rf /" } }), SettingsError);
  assert.throws(() => cleanSettingsPatch({ daily_budget_usd: 20, monthly_budget_usd: 10 }), /daily budget/);
  assert.deepEqual(settingsDiff({ dry_run: true, end_card: true }, { dry_run: false, end_card: true }), { dry_run: [true, false] });
});

/* ─── the numbers ────────────────────────────────────────────────────── */

test("local days are Helsinki days: 23:30 UTC on 31 Oct is already 1 Nov there", () => {
  assert.equal(localDay(new Date("2026-10-31T23:30:00Z"), "Europe/Helsinki"), "2026-11-01");
  assert.equal(localDay(new Date("2026-10-31T21:59:00Z"), "Europe/Helsinki"), "2026-10-31");
  assert.deepEqual(daysBack("2026-03-02", 3), ["2026-02-28", "2026-03-01", "2026-03-02"]);
});

test("the summary: actual else estimate, today vs this month, and warnings from 80 %", () => {
  const s = { daily_budget_usd: 8, monthly_budget_usd: 150, per_provider_daily_caps: { runware: 6, anthropic: 1.5 }, lane_daily_caps: { slideshow: 2 } };
  const rows = [
    { local_day: "2026-10-17", provider: "runware", lane: "slideshow", estimated_usd: 2, actual_usd: 1.7, status: "settled" },
    { local_day: "2026-10-17", provider: "anthropic", lane: null, estimated_usd: 0.4, actual_usd: null, status: "reserved" },
    { local_day: "2026-10-17", provider: "runware", lane: null, estimated_usd: 0, actual_usd: 0, status: "settled", dry_run: true, would_cost_usd: 0.3 },
    { local_day: "2026-10-02", provider: "runware", lane: null, estimated_usd: 50, actual_usd: 50, status: "settled" },
    { local_day: "2026-09-30", provider: "runware", lane: null, estimated_usd: 99, actual_usd: 99, status: "settled" },
  ];
  const sum = summarize(rows, s, "2026-10-17");
  assert.equal(sum.day.usedUsd, 2.1);
  assert.equal(sum.month.usedUsd, 52.1, "last month is not counted");
  assert.equal(sum.reservedUsd, 0.4);
  assert.deepEqual([sum.dryCalls, sum.dryWouldCostUsd], [1, 0.3]);
  assert.equal(sum.lane.slideshow.usedUsd, 1.7);
  assert.equal(sum.lane.slideshow.warn, true, "1.7 of 2 is 85 %");
  assert.equal(sum.provider.runware.warn, false);
  assert.deepEqual(sum.warnings, ["slideshow: 85 % of today's cap."]);
  const series = dailySeries(rows, "2026-10-17", 30);
  assert.equal(series.length, 30);
  assert.equal(series.at(-1).totalUsd, 2.1);
  assert.equal(series.find((d) => d.day === "2026-10-02").byProvider.runware, 50);
});

/* ─── no paid call outside the guard ─────────────────────────────────── */

test("no Content Machine file calls a paid provider outside the guard's provider modules", () => {
  assert.deepEqual(findPaidCallsOutsideGuard(), []);
  // And the check really catches one.
  const root = mkdtempSync(join(tmpdir(), "cm-check-"));
  mkdirSync(join(root, "supabase/functions/_shared/contentMachine/providers"), { recursive: true });
  writeFileSync(join(root, "supabase/functions/_shared/contentMachine/sneaky.js"), 'await fetch("https://api.runware.ai/v1", {});\n');
  writeFileSync(join(root, "supabase/functions/_shared/contentMachine/providers/runware.js"), 'const URL = "https://api.runware.ai/v1";\n');
  const hits = findPaidCallsOutsideGuard(root);
  assert.equal(hits.length, 1);
  assert.match(hits[0], /sneaky\.js:1/);
});
