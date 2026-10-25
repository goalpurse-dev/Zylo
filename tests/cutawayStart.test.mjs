// Cutaway Explainer: the start path's free checks (the owner's "traffic light" start failed instantly on 2026-10-25:
// the kit check's schema had array size limits, which structured outputs reject with a 400, so every custom topic the
// free rules could not decide failed as "Something went wrong"). All pure: no network, no keys.
import test from "node:test";
import assert from "node:assert/strict";
import { kitCheck, classifyTopic } from "../supabase/functions/_shared/cutaway/topics.js";
import { KIT_SCHEMA, kitCheckRequest, isBalanceError } from "../supabase/functions/_shared/cutaway/kitCheck.js";
import { capFreesInSec, decide, DEFAULT_SETTINGS } from "../supabase/functions/_shared/cutaway/guard.js";
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
  assert.equal(kitCheck("how does a microwave work").verdict, "no");
  assert.equal(kitCheck("lightning rod").verdict, "unsure");
});

test("Anthropic's out-of-credits reply is told apart from other errors", () => {
  assert.equal(isBalanceError(400, { error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } }), true);
  assert.equal(isBalanceError(400, { error: { message: "output_config.format.schema: maxItems is not supported" } }), false);
  assert.equal(isBalanceError(500, null), false);
});

// the owner's numbers on 2026-10-25 at 20:48 UTC
const NOW = Date.parse("2026-10-25T20:48:00Z");
const today = { spent_24h: 1.17154, spent_3h: 0, running: 0, user_spent_24h: 1.17154, user_running: 0, user_starts_1h: 0, user_fail_streak: 1, minutes_since_last_fail: 370, minutes_since_balance_fail: null };
const runs = [
  { at: Date.parse("2026-10-25T13:39:12Z"), usd: 0.3 },
  { at: Date.parse("2026-10-25T14:13:28Z"), usd: 0.17748 },
  { at: Date.parse("2026-10-25T14:29:39Z"), usd: 0.69406 },
];

test("the per-user cap refuses with a clear LIMIT and the exact wait", () => {
  assert.equal(decide(DEFAULT_SETTINGS, today, costBasisUsd("premade", 30)).ok, true);
  const g = decide(DEFAULT_SETTINGS, today, costBasisUsd("custom", 30));
  assert.equal(g.code, "LIMIT");
  assert.match(g.reason, /daily video limit/);
  // a custom 30 s video (~$0.85) fits again only once the Pond run (14:29) leaves the window
  const wait = capFreesInSec(runs, costBasisUsd("custom", 30), 1.5, NOW);
  assert.equal(wait, Math.ceil((Date.parse("2026-10-26T14:29:39Z") - NOW) / 1000));
  assert.equal(capFreesInSec(runs, costBasisUsd("premade", 30), 1.5, NOW), 0);
});

test("site-wide refusals say what happened", () => {
  assert.match(decide(DEFAULT_SETTINGS, { ...today, spent_24h: 2.9 }, 0.3).message, /today's limit/);
  assert.match(decide(DEFAULT_SETTINGS, { ...today, minutes_since_balance_fail: 3 }, 0.3).message, /paused on our side/);
  assert.match(decide(DEFAULT_SETTINGS, today, 0.3, { envOff: true }).message, /paused/);
});

test("an error reply keeps the owner's debug (step, code, message)", () => {
  const e = errorFromReply({ error: "Something went wrong on our side.", code: "SERVER", debug: { step: "kit check", code: "SERVER", message: "kit check: anthropic 400" } }, 500);
  assert.deepEqual(e.debug, { step: "kit check", code: "SERVER", message: "kit check: anthropic 400" });
  assert.equal(errorFromReply({ error: "x", code: "LIMIT" }, 429).debug, null);
});
