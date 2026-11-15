// THE BLENDER ENGINE'S PRICE (blenderPricing.js, measured 2026-11-15): not live (pricing.js unchanged until the owner's go)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLENDER_RATES, blenderFullCostUsd, blenderCredits, blenderPriceTable, blenderQuote, blenderAttemptCost } from "../supabase/functions/_shared/blockyWorlds/blenderPricing.js";
import { PRICES } from "../supabase/functions/_shared/blockyWorlds/pricing.js";

test("the table: 60 / 90 / 120 s, every part counted, 1 credit = $0.01 of our full cost", () => {
  const t = blenderPriceTable();
  assert.deepEqual(t.map((r) => r.sec), [60, 90, 120]);
  for (const r of t) {
    assert.deepEqual(Object.keys(r.parts), ["script", "voice", "director", "checker", "gpuPreviews", "gpuFinalAndFinish"]);
    assert.ok(r.allowanceUsd > 0);
    assert.equal(r.credits, Math.ceil(r.costUsd * 100 - 1e-9));
    assert.equal(r.userUsd, +(r.credits * 0.02).toFixed(4));
  }
  assert.deepEqual(t.map((r) => r.credits), [219, 313, 407]);
});

test("the model covers the measured runs (script added where the run had none; Milo's reshoot final left out)", () => {
  const runs = [
    { name: "hiccup", sec: 60.7, usd: 0.24608 + 0.1018 + 0.78332 + 0.03243 + 0.05891 + 0.22664 },
    { name: "tower", sec: 99.2, usd: 0.25 + 0.1518 + 1.33497 + 0.06232 + 0.09191 + 0.29719 },
    { name: "milo, one final", sec: 96.3, usd: 0.25 + 0.1482 + 1.57076 + 0.30877 + 0.11278 + 0.9733 / 2 },
  ];
  for (const r of runs) assert.ok(blenderFullCostUsd(r.sec) >= r.usd, `${r.name}: model $${blenderFullCostUsd(r.sec)} < measured $${r.usd.toFixed(3)}`);
  assert.ok(blenderAttemptCost(60).script === BLENDER_RATES.writingUsd);
});

test("one quote after the script: the real length rounded up to 10 s, 30-180 s", () => {
  assert.deepEqual(blenderQuote(83.2), { sec: 90, credits: blenderCredits(90) });
  assert.equal(blenderQuote(5).sec, 30);
  assert.equal(blenderQuote(400).sec, 180);
});

test("pricing.js is NOT switched yet (the patch waits for the owner's go)", () => {
  assert.notEqual(PRICES[90], blenderCredits(90));
  const patch = readFileSync(new URL("../docs/blocky-worlds-blender-pricing.patch", import.meta.url), "utf8");
  assert.match(patch, /blenderFullCostUsd/);
});
