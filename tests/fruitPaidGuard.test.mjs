import test from "node:test";
import assert from "node:assert/strict";
import { openBudget, PaidCallBlocked, STAGE_CAPS_USD, PHASE3_TOTAL_USD } from "../scripts/fruit-story/paidGuard.mjs";

test("paid calls are blocked unless FRUIT_ALLOW_PAID=1", () => {
  const saved = process.env.FRUIT_ALLOW_PAID;
  delete process.env.FRUIT_ALLOW_PAID;
  try {
    assert.throws(() => openBudget("3d").reserve(0.01, "x"), PaidCallBlocked);
    process.env.FRUIT_ALLOW_PAID = "true";
    assert.throws(() => openBudget("3d").reserve(0.01, "x"), PaidCallBlocked, "only the exact value 1 unlocks");
  } finally {
    if (saved === undefined) delete process.env.FRUIT_ALLOW_PAID; else process.env.FRUIT_ALLOW_PAID = saved;
  }
});

test("reservations can't pass the stage cap; 3b has no paid budget", () => {
  const saved = process.env.FRUIT_ALLOW_PAID;
  process.env.FRUIT_ALLOW_PAID = "1";
  try {
    assert.throws(() => openBudget("3b").reserve(0.0001, "x"), /Stage 3b cap/);
    const b = openBudget("3f");
    const left = STAGE_CAPS_USD["3f"] - b.spentStage();
    assert.throws(() => b.reserve(left + 0.01, "too much"), /cap/);
    assert.equal(PHASE3_TOTAL_USD, 4, "the Phase 3 total cap is enforced on real spend in reserve()");
  } finally {
    if (saved === undefined) delete process.env.FRUIT_ALLOW_PAID; else process.env.FRUIT_ALLOW_PAID = saved;
  }
});
