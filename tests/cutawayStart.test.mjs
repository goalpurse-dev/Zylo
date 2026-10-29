// Cutaway Explainer: the start path's free checks (the owner's "traffic light" start failed instantly on 2026-10-25:
// the kit check's schema had array size limits, which structured outputs reject with a 400, so every custom topic the
// free rules could not decide failed as "Something went wrong"). All pure: no network, no keys.
import test from "node:test";
import assert from "node:assert/strict";
import { kitCheck, classifyTopic } from "../supabase/functions/_shared/cutaway/topics.js";
import { KIT_SCHEMA, kitCheckRequest, isBalanceError } from "../supabase/functions/_shared/cutaway/kitCheck.js";
import { capAlertLevel, decide, DEFAULT_SETTINGS } from "../supabase/functions/_shared/cutaway/guard.js";
import { costBasisUsd } from "../supabase/functions/_shared/cutaway/pricing.js";
import { errorFromReply } from "../src/components/viral-tools/cutaway-explainer/api/cutawayApi.js";

const sizeLimits = (node) => node && typeof node === "object" && (["maxItems", "minItems", "maxLength", "minLength", "minimum", "maximum"].some((k) => k in node) || Object.values(node).some(sizeLimits));

test("the kit check request has no schema constraints structured outputs reject", () => {
  assert.equal(sizeLimits(KIT_SCHEMA), false);
  assert.equal(sizeLimits(kitCheckRequest("lightning rod").output_config.format.schema), false);
});

test("a premade topic without an approved layout is buildable by the rules (no Claude call)", () => {
  for (const t of ["traffic light", "How does a traffic light work?", "fire hydrant", "septic tank"]) {
    assert.equal(classifyTopic(t).kind, "premade", t);
    assert.equal(kitCheck(t).verdict, "yes", t);
  }
  assert.equal(kitCheck("how does a microwave work").verdict, "yes", "built from building blocks (2026-10-26)");
  assert.equal(kitCheck("the human heart").verdict, "no");
});

test("Anthropic's out-of-credits reply is told apart from other errors", () => {
  assert.equal(isBalanceError(400, { error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } }), true);
  assert.equal(isBalanceError(400, { error: { message: "output_config.format.schema: maxItems is not supported" } }), false);
  assert.equal(isBalanceError(500, null), false);
});

// the owner's numbers on 2026-10-25 at 20:48 UTC: blocked by the old $1.50 cap per user; never again
const today = { spent_24h: 1.17154, spent_3h: 0, running: 0, user_spent_24h: 1.17154, user_running: 0, user_starts_1h: 0, user_fail_streak: 1, minutes_since_last_fail: 370, minutes_since_balance_fail: null };

test("no money limit per user: a user with credits starts, however much they made today", () => {
  for (const kind of ["premade", "custom"]) for (const s of [30, 60]) assert.equal(decide(DEFAULT_SETTINGS, today, costBasisUsd(kind, s)).ok, true, `${kind} ${s}`);
  assert.equal(decide(DEFAULT_SETTINGS, { ...today, user_spent_24h: 19 }, costBasisUsd("custom", 60)).ok, true);
  // nothing a user can be refused with talks about a daily limit
  for (const o of [{ user_running: 2 }, { user_starts_1h: 10 }, { spent_24h: 19.9 }, { minutes_since_balance_fail: 1 }]) {
    const g = decide(DEFAULT_SETTINGS, { ...today, ...o }, 0.85);
    assert.equal(g.ok, false);
    assert.doesNotMatch(`${g.reason} ${g.message ?? ""}`.replace(/the emergency cap/, ""), /daily|today|limit for/i, JSON.stringify(o));
  }
});

test("the emergency cap emails at 50 % and 80 %, and when it is reached", () => {
  assert.deepEqual([9.9, 10, 15.9, 16, 19.99, 20, 25].map((u) => capAlertLevel(u, 20)), [0, 50, 50, 80, 80, 100, 100]);
  assert.equal(capAlertLevel(5, 0), 0);
});

test("site-wide refusals say what happened", () => {
  assert.match(decide(DEFAULT_SETTINGS, { ...today, spent_24h: 19.9 }, 0.3).message, /High demand/);
  assert.match(decide(DEFAULT_SETTINGS, { ...today, minutes_since_balance_fail: 3 }, 0.3).message, /paused on our side/);
  assert.match(decide(DEFAULT_SETTINGS, today, 0.3, { envOff: true }).message, /paused/);
});

test("an error reply keeps the owner's debug (step, code, message)", () => {
  const e = errorFromReply({ error: "Something went wrong on our side.", code: "SERVER", debug: { step: "kit check", code: "SERVER", message: "kit check: anthropic 400" } }, 500);
  assert.deepEqual(e.debug, { step: "kit check", code: "SERVER", message: "kit check: anthropic 400" });
  assert.equal(errorFromReply({ error: "x", code: "LIMIT" }, 429).debug, null);
});

test("/admin/ops: the emergency cap is read and changed by the owner only, and the page shows it", async () => {
  const { readFileSync } = await import("node:fs");
  const api = readFileSync(new URL("../supabase/functions/cutaway-api/index.ts", import.meta.url), "utf8");
  const ops = api.slice(api.indexOf('if (["opsStatus", "opsSetDailyCap", "opsSetCustom", "opsSetBeta", "opsRetirePart"].includes(action))'));
  assert.ok(ops.indexOf('if (!who.owner) throw new ApiError("NOT_FOUND")') > 0 && ops.indexOf('if (!who.owner)') < ops.indexOf('.update({ daily_cap_usd'));
  assert.match(api, /await noteCapLevel\(/);
  assert.doesNotMatch(api, /user_daily_usd|capFreesInSec/);
  const page = readFileSync(new URL("../src/pages/admin/Ops.jsx", import.meta.url), "utf8");
  assert.match(page, /action: "opsSetDailyCap", usd/);
  assert.match(page, /<CutawayCard c=\{cutaway\}/);
});

test("launch: premade only; a customer's custom start is refused before anything is spent; custom shows Coming soon", async () => {
  const { readFileSync } = await import("node:fs");
  const { ERRORS } = await import("../supabase/functions/_shared/cutaway/contract.js");
  assert.equal(ERRORS.SOON.status, 403);
  assert.match(ERRORS.SOON.message, /coming soon/i);
  const api = readFileSync(new URL("../supabase/functions/cutaway-api/index.ts", import.meta.url), "utf8");
  const start = api.slice(api.indexOf('if (action === "quote" || action === "start")'));
  const gate = start.indexOf('throw new ApiError("SOON"');
  assert.ok(gate > 0 && gate < start.indexOf('trace.step = "kit check"') && gate < start.indexOf('admin.rpc("cutaway_start_run"'), "refused before the kit check and the charge");
  assert.match(start, /if \(action === "start" && !who\.owner\)/, "the owner can still test custom topics");
  assert.match(api, /customOpen: customOn \|\| Boolean\(who\?\.owner\)/);
  assert.match(api, /return !error && data\?\.custom_enabled === true;/, "unreadable counts as off");
  assert.match(api, /action === "opsSetCustom"/);
  const mig = readFileSync(new URL("../supabase/migrations/20261126100000_cutaway_custom_soon.sql", import.meta.url), "utf8");
  assert.match(mig, /ADD COLUMN IF NOT EXISTS custom_enabled boolean NOT NULL DEFAULT false/);
  // the page: the chip is shown and not clickable, a typed custom topic can't be generated, the price line says so
  const b = readFileSync(new URL("../src/components/viral-tools/cutaway-explainer/CutawayBuilder.jsx", import.meta.url), "utf8");
  assert.match(b, /data-testid="cutaway-custom-soon" aria-disabled="true"/);
  assert.match(b, /const customBlocked = soon && hasTopic && quote\.kind === "custom";/);
  assert.match(b, /if \(customBlocked\) return;/);
  assert.match(b, /Custom topics coming soon/);
  const hook = readFileSync(new URL("../src/components/viral-tools/cutaway-explainer/api/cutawayPremade.js", import.meta.url), "utf8");
  assert.match(hook, /export function useCutawayCustomOpen/);
  assert.ok(hook.includes("return { keys: [], customOpen: false };"), "unreadable: closed");
});
