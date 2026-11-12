// Cutaway margin per video type (owner, 2026-11-12): true cost per FINISHED video includes the failed, refunded runs;
// revenue = credits kept x what a credit really earns; red under 2x; the credits that would make a type exactly 2x.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { marginRows, marginType, EARNED_PER_CREDIT, TARGET_MULTIPLE } from "../supabase/functions/_shared/cutaway/margin.js";

const NOW = Date.parse("2026-11-12T20:00:00Z");
const ago = (d) => new Date(NOW - d * 86400e3).toISOString();
const run = (o) => ({ status: "done", kind: "premade", length_sec: 30, free_preview: false, gift_finish: false, cost_usd: 0.2, credits_charged: 25, credits_refunded: 0, created_at: ago(1), ...o });

test("types: the four priced kinds, the free preview and the gift finish", () => {
  assert.equal(marginType(run({})), "premade-30");
  assert.equal(marginType(run({ kind: "custom", length_sec: 60 })), "custom-60");
  assert.equal(marginType(run({ free_preview: true })), "free_preview");
  assert.equal(marginType(run({ gift_finish: true })), "gift_finish");
});

test("true cost per finished video carries the failed, refunded runs; revenue only the credits kept", () => {
  const runs = [
    run({ kind: "custom", length_sec: 60, cost_usd: 1.5, credits_charged: 195 }),
    run({ kind: "custom", length_sec: 60, cost_usd: 1.5, credits_charged: 195 }),
    run({ kind: "custom", length_sec: 60, status: "failed", cost_usd: 2, credits_charged: 195, credits_refunded: 195 }),
  ];
  const r = marginRows(runs, { now: NOW, earnedUsd: 0.02 }).find((x) => x.type === "custom-60" && x.days === 7);
  assert.equal(r.finished, 2); assert.equal(r.failed, 1);
  assert.equal(r.costPerFinished, 2.5); // (1.5 + 1.5 + 2) / 2
  assert.equal(r.creditsPerFinished, 195);
  assert.equal(r.revenuePerFinished, 3.9);
  assert.equal(r.multiple, 1.56);
  assert.equal(r.below, true);
  assert.equal(r.creditsForTarget, 250); // 2 x 2.5 / 0.02
  assert.equal(r.marginPct, 35.9);
});

test("windows: a run older than 7 days counts only in the 30-day row", () => {
  const rows = marginRows([run({ created_at: ago(10) }), run({})], { now: NOW });
  assert.equal(rows.find((x) => x.type === "premade-30" && x.days === 7).finished, 1);
  assert.equal(rows.find((x) => x.type === "premade-30" && x.days === 30).finished, 2);
});

test("a paid type that spent money and finished nothing is red; free types are never red", () => {
  const rows = marginRows([run({ kind: "custom", status: "failed", cost_usd: 1, credits_refunded: 25 }), run({ free_preview: true, credits_charged: 0, cost_usd: 0.013 })], { now: NOW });
  const c = rows.find((x) => x.type === "custom-30" && x.days === 7);
  assert.equal(c.costPerFinished, null); assert.equal(c.below, true);
  assert.equal(rows.find((x) => x.type === "free_preview" && x.days === 7).below, false);
});

test("above 2x is not red (premade 30 s at today's numbers: $0.196 per finished, 25 credits)", () => {
  const r = marginRows([run({ cost_usd: 0.196 })], { now: NOW }).find((x) => x.type === "premade-30" && x.days === 7);
  assert.ok(r.multiple >= TARGET_MULTIPLE); assert.equal(r.below, false);
});

test("the earned-per-credit figure is dated and explained; nothing in margin.js writes", () => {
  assert.match(EARNED_PER_CREDIT.measuredAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(EARNED_PER_CREDIT.usd > 0 && EARNED_PER_CREDIT.basis.length > 10);
  const src = fs.readFileSync(new URL("../supabase/functions/_shared/cutaway/margin.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /\.(insert|update|upsert|delete|rpc)\(/);
});

test("opsMargin is owner-only and read-only; the ops page shows the card", () => {
  const api = fs.readFileSync(new URL("../supabase/functions/cutaway-api/index.ts", import.meta.url), "utf8");
  const block = api.slice(api.indexOf('if (action === "opsMargin")'), api.indexOf('if (["opsStatus"'));
  assert.match(block, /if \(!who\.owner\) throw new ApiError\("NOT_FOUND"\)/);
  assert.doesNotMatch(block, /\.(insert|update|upsert|delete|rpc)\(/);
  const page = fs.readFileSync(new URL("../src/pages/admin/Ops.jsx", import.meta.url), "utf8");
  assert.match(page, /action: "opsMargin"/);
  assert.match(page, /<MarginCard m=\{marginData\} \/>/);
});
