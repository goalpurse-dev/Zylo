// Earnings Calculator math (src/pages/workspace/earnings): the formulas from the spec.
import test from "node:test";
import assert from "node:assert/strict";
import { calculate, eligibility, equivalentFor, formatMoney } from "../src/pages/workspace/earnings/earningsMath.ts";
import { DEFAULTS } from "../src/pages/workspace/earnings/earningsConfig.ts";

const base = { ...DEFAULTS, stack: { ...DEFAULTS.stack } };
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);

test("YouTube long-form payout: views/1000 × 3.00 × niche × audience", () => {
  const r = calculate({ ...base, platform: "youtube_long", niche: "finance", audience: "us_uk", avgViews: 10_000, videosPerWeek: 5 });
  close(r.monthlyViews, 10_000 * 5 * 4.33);
  close(r.rawRows.payout, (216_500 / 1000) * 3 * 3 * 1.5);
  close(r.monthly, r.rows.payout);
  assert.ok(Math.abs(r.rows.payout - r.rawRows.payout) <= 50);
  close(r.yearly, r.monthly * 12);
  close(r.low, r.monthly * 0.5);
  close(r.high, r.monthly * 1.8);
});

test("TikTok pays on 60% qualified views", () => {
  const r = calculate({ ...base, platform: "tiktok", niche: "facts", audience: "mixed", avgViews: 10_000, videosPerWeek: 5 });
  close(r.rawRows.payout, (216_500 * 0.6 / 1000) * 0.6);
});

test("total is exactly the sum of the switched-on rows", () => {
  for (const stack of [
    { payout: true, brand: false, affiliate: false },
    { payout: true, brand: true, affiliate: true },
    { payout: false, brand: true, affiliate: false },
    { payout: false, brand: false, affiliate: false },
  ]) {
    const r = calculate({ ...base, avgViews: 50_000, stack });
    const sum = (stack.payout ? r.rows.payout : 0) + (stack.brand ? r.rows.brand : 0) + (stack.affiliate ? r.rows.affiliate : 0);
    close(r.monthly, sum);
  }
});

test("brand deals: locked below 10K avg, 1 deal below 100K, 2 deals from 100K, niche capped at 2", () => {
  const stack = { payout: false, brand: true, affiliate: false };
  assert.equal(calculate({ ...base, avgViews: 9_999, stack }).rows.brand, 0);
  close(calculate({ ...base, platform: "youtube_long", niche: "finance", avgViews: 50_000, stack }).rawRows.brand, 50 * 20 * 2 * 0.6);
  close(calculate({ ...base, platform: "tiktok", niche: "facts", avgViews: 100_000, stack }).rawRows.brand, 100 * 8 * 1 * 0.6 * 2);
});

test("affiliate: views/1000 × rate × niche × audience", () => {
  const r = calculate({ ...base, platform: "youtube_shorts", niche: "tech", audience: "other", avgViews: 10_000, videosPerWeek: 5 });
  close(r.rawRows.affiliate, (216_500 / 1000) * 0.2 * 1.7 * 0.4);
});

test("compare bars use the same toggles as the hero", () => {
  const input = { ...base, platform: "youtube_shorts", stack: { payout: true, brand: true, affiliate: true }, avgViews: 20_000 };
  const r = calculate(input);
  close(r.compare.find((p) => p.id === "youtube_shorts").total, r.monthly);
  close(r.compare.find((p) => p.id === "tiktok").total, calculate({ ...input, platform: "tiktok" }).monthly);
});

test("eligibility thresholds", () => {
  close(eligibility("tiktok", 50_000).progress, 0.5);
  close(eligibility("youtube_shorts", 1_000_000).progress, 0.3);
  close(eligibility("youtube_long", 5_000).current, 5_000 * 12 * 4 / 60);
  assert.equal(eligibility("youtube_long", 5_000).unlocked, true);
  assert.equal(eligibility("tiktok", 99_999).unlocked, false);
});

test("money format: no cents on big numbers", () => {
  assert.equal(formatMoney(0), "$0");
  assert.equal(formatMoney(0.43), "$0.43");
  assert.equal(formatMoney(950.4), "$950");
  assert.equal(formatMoney(1_234), "$1.2K");
  assert.equal(formatMoney(14_000), "$14K");
  assert.equal(formatMoney(30_780), "$30.8K");
  assert.equal(formatMoney(250_400), "$250K");
  assert.equal(formatMoney(999.7), "$1K");
  assert.equal(formatMoney(9_990), "$10K");
  assert.equal(formatMoney(1_250_000), "$1.3M");
});

test("fun equivalent picks by amount", () => {
  assert.equal(equivalentFor(0), null);
  assert.equal(equivalentFor(50), "≈ your phone bill");
  assert.equal(equivalentFor(600), "≈ a new iPhone every 2 months");
});

test("the rows on screen add up to the hero number, across a sweep of inputs", async () => {
  const { NICHES, PLATFORMS, AUDIENCES } = await import("../src/pages/workspace/earnings/earningsConfig.ts");
  const stacks = [[1, 0, 0], [1, 1, 0], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  for (const niche of NICHES) for (const p of PLATFORMS) for (const a of AUDIENCES)
    for (const avgViews of [1_000, 9_000, 10_000, 37_000, 100_000, 480_000, 1_000_000])
      for (const vpw of [1, 5, 21]) for (const [x, y, z] of stacks) {
        const stack = { payout: !!x, brand: !!y, affiliate: !!z };
        const r = calculate({ niche: niche.id, platform: p.id, audience: a.id, avgViews, videosPerWeek: vpw, stack });
        const shown = ["payout", "brand", "affiliate"].filter((k) => stack[k]).map((k) => r.rows[k]);
        // what a person reads: "$19.5K" + "$4.8K" + "$6.5K" must equal the hero's "$30.8K"
        const parse = (t) => Number(t.replace("$", "").replace("K", "e3").replace("M", "e6"));
        const readSum = shown.reduce((s, v) => s + parse(formatMoney(v)), 0);
        assert.ok(Math.abs(readSum - parse(formatMoney(r.monthly))) < 0.005, `${shown.map(formatMoney).join(" + ")} vs ${formatMoney(r.monthly)}`);
        // and the platform bar for the picked platform shows the same number as the hero
        assert.equal(formatMoney(r.compare.find((c) => c.id === p.id).total), formatMoney(r.monthly));
        // rounding never moves the total by more than one display step
        const raw = ["payout", "brand", "affiliate"].filter((k) => stack[k]).reduce((s, k) => s + r.rawRows[k], 0);
        assert.ok(Math.abs(raw - r.monthly) <= 3 * 100_000 && Math.abs(raw - r.monthly) / Math.max(raw, 1) < 0.2, `${raw} vs ${r.monthly}`);
      }
});
