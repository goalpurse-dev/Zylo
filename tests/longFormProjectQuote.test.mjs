import test from "node:test";
import assert from "node:assert/strict";
import { estimateLongFormProjectQuote } from "../supabase/functions/_shared/longFormProjectQuote.ts";

// 2026-10-02 "one project commitment" pass — the deterministic upper-bound
// estimate shown as the single "CREATE VIDEO · N credits" commitment and
// reserved verbatim by reserve_long_form_project_credits.

test("estimates a reasonable beat count from target duration and recipe pacing", () => {
  const quote = estimateLongFormProjectQuote({ targetDurationMinutes: 10, renderTier: "v3", beatsPerMinute: 15 });
  assert.equal(quote.estimatedBeatCount, 150);
});

test("splits beats into reused/programmatic (zero-cost) and fresh renders using the disclosed reuseShare", () => {
  const quote = estimateLongFormProjectQuote({ targetDurationMinutes: 10, renderTier: "v3", beatsPerMinute: 15, reuseShare: 0.12 });
  assert.equal(quote.estimatedReusedOrProgrammatic, Math.round(150 * 0.12));
  assert.equal(quote.estimatedFreshRenders, 150 - quote.estimatedReusedOrProgrammatic);
});

test("applies the bounded retry uplift only to fresh renders, never to reused/programmatic beats", () => {
  const quote = estimateLongFormProjectQuote({ targetDurationMinutes: 10, renderTier: "v3", beatsPerMinute: 15, reuseShare: 0.12, retryUpliftShare: 0.15 });
  assert.equal(quote.estimatedRetryRenders, Math.round(quote.estimatedFreshRenders * 0.15));
  assert.equal(quote.totalRenderCount, quote.estimatedFreshRenders + quote.estimatedRetryRenders);
});

test("prices visuals using the REAL confirmed per-tier credit costs (v2=2, v3=3, v4=4)", () => {
  const shared = { targetDurationMinutes: 10, beatsPerMinute: 15 };
  const v2 = estimateLongFormProjectQuote({ ...shared, renderTier: "v2" });
  const v3 = estimateLongFormProjectQuote({ ...shared, renderTier: "v3" });
  const v4 = estimateLongFormProjectQuote({ ...shared, renderTier: "v4" });
  assert.equal(v2.totalCredits, v2.totalRenderCount * 2);
  assert.equal(v3.totalCredits, v3.totalRenderCount * 3);
  assert.equal(v4.totalCredits, v4.totalRenderCount * 4);
  assert.ok(v4.totalCredits > v3.totalCredits && v3.totalCredits > v2.totalCredits, "a higher tier must always quote a higher total for the same duration");
});

test("the breakdown explicitly itemizes every stage, even ones currently absorbed at 0 credits — never a silently omitted stage", () => {
  const quote = estimateLongFormProjectQuote({ targetDurationMinutes: 10, renderTier: "v3", beatsPerMinute: 15 });
  const labels = quote.breakdown.map((l) => l.label);
  assert.ok(labels.some((l) => l.includes("Research")));
  assert.ok(labels.some((l) => l.includes("Narration")));
  assert.ok(labels.some((l) => l.includes("visuals")));
  assert.ok(labels.some((l) => l.includes("QA")));
  assert.equal(quote.totalCredits, quote.breakdown.reduce((s, l) => s + l.credits, 0), "totalCredits must always equal the sum of its own itemized breakdown");
});

test("longer target duration always quotes a higher total, all else equal", () => {
  const shared = { renderTier: "v3", beatsPerMinute: 15 };
  const short = estimateLongFormProjectQuote({ ...shared, targetDurationMinutes: 8 });
  const long = estimateLongFormProjectQuote({ ...shared, targetDurationMinutes: 15 });
  assert.ok(long.totalCredits > short.totalCredits);
});

test("rejects an invalid target duration or pacing density rather than silently producing a zero/negative quote", () => {
  assert.throws(() => estimateLongFormProjectQuote({ targetDurationMinutes: 0, renderTier: "v3", beatsPerMinute: 15 }), /INVALID_TARGET_DURATION/);
  assert.throws(() => estimateLongFormProjectQuote({ targetDurationMinutes: 10, renderTier: "v3", beatsPerMinute: 0 }), /INVALID_PACING_DENSITY/);
});
