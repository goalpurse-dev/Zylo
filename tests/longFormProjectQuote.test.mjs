import test from "node:test";
import assert from "node:assert/strict";
import { estimateLongFormProjectQuote } from "../supabase/functions/_shared/longFormProjectQuote.ts";

// 2026-10-02 "one project commitment" pass — the deterministic upper-bound
// estimate shown as the single "CREATE VIDEO · N credits" commitment and
// reserved verbatim by reserve_long_form_project_credits.

test("estimates a reasonable beat count from target duration and recipe pacing", () => {
  const quote = estimateLongFormProjectQuote({ targetDurationMinutes: 10, renderTier: "v3", beatsPerMinute: 15, creditsPerMinute: 75 });
  assert.equal(quote.estimatedBeatCount, 150);
});

test("splits beats into reused/programmatic (zero-cost) and fresh renders using the disclosed reuseShare", () => {
  const quote = estimateLongFormProjectQuote({ targetDurationMinutes: 10, renderTier: "v3", beatsPerMinute: 15, creditsPerMinute: 75, reuseShare: 0.12 });
  assert.equal(quote.estimatedReusedOrProgrammatic, Math.round(150 * 0.12));
  assert.equal(quote.estimatedFreshRenders, 150 - quote.estimatedReusedOrProgrammatic);
});

test("applies the bounded retry uplift only to fresh renders, never to reused/programmatic beats", () => {
  const quote = estimateLongFormProjectQuote({ targetDurationMinutes: 10, renderTier: "v3", beatsPerMinute: 15, creditsPerMinute: 75, reuseShare: 0.12, retryUpliftShare: 0.15 });
  assert.equal(quote.estimatedRetryRenders, Math.round(quote.estimatedFreshRenders * 0.15));
  assert.equal(quote.totalRenderCount, quote.estimatedFreshRenders + quote.estimatedRetryRenders);
});

// Today's tool_prices rows (longform:v2/v3/v4 flat_credits = credits per minute).
const PER_MINUTE = { v2: 25, v3: 75, v4: 110 };

test("Phase 7: the video is a FIXED price per minute (V2 25, V3 75, V4 110 credits/min)", () => {
  const q = (renderTier, targetDurationMinutes) => estimateLongFormProjectQuote({ renderTier, targetDurationMinutes, beatsPerMinute: 15, creditsPerMinute: PER_MINUTE[renderTier] }).totalCredits;
  assert.deepEqual([q("v2", 10), q("v3", 10), q("v4", 10)], [250, 750, 1100]);
  assert.deepEqual([q("v3", 8), q("v3", 12), q("v3", 15)], [600, 900, 1125]);
  assert.equal(q("v2", 8.5), 213, "a partial minute rounds up, never down");
  assert.ok(q("v4", 10) > q("v3", 10) && q("v3", 10) > q("v2", 10), "a higher tier must always quote a higher total for the same duration");
});

test("the breakdown says everything the fixed price includes, and the total is its sum", () => {
  const quote = estimateLongFormProjectQuote({ targetDurationMinutes: 10, renderTier: "v3", beatsPerMinute: 15, creditsPerMinute: 75 });
  const note = quote.breakdown.map((l) => `${l.label} ${l.note}`).join(" ");
  for (const part of ["research", "script", "scenes", "QA", "voiceover", "1080p render", "thumbnails", "YouTube text"]) assert.ok(note.includes(part), part);
  assert.equal(quote.totalCredits, quote.breakdown.reduce((s, l) => s + l.credits, 0), "totalCredits must always equal the sum of its own itemized breakdown");
});

test("longer target duration always quotes a higher total, all else equal", () => {
  const shared = { renderTier: "v3", beatsPerMinute: 15, creditsPerMinute: 75 };
  const short = estimateLongFormProjectQuote({ ...shared, targetDurationMinutes: 8 });
  const long = estimateLongFormProjectQuote({ ...shared, targetDurationMinutes: 15 });
  assert.ok(long.totalCredits > short.totalCredits);
});

test("rejects an invalid target duration or pacing density rather than silently producing a zero/negative quote", () => {
  assert.throws(() => estimateLongFormProjectQuote({ targetDurationMinutes: 0, renderTier: "v3", beatsPerMinute: 15, creditsPerMinute: 75 }), /INVALID_TARGET_DURATION/);
  assert.throws(() => estimateLongFormProjectQuote({ targetDurationMinutes: 10, renderTier: "v3", beatsPerMinute: 0, creditsPerMinute: 75 }), /INVALID_PACING_DENSITY/);
  assert.throws(() => estimateLongFormProjectQuote({ targetDurationMinutes: 10, renderTier: "v3", beatsPerMinute: 15 }), /NO_SERVER_PRICE/, "no price row = no quote, never a typed-in fallback");
});

test("the tier cards read the per-minute price from tool_prices, never a typed-in copy", async () => {
  const { readFileSync } = await import("node:fs");
  const page = readFileSync(new URL("../src/pages/workspace/long-form/ProductionSetup.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /perMin: \d/);
  assert.match(page, /longform:v2/);
  const quoteTs = readFileSync(new URL("../supabase/functions/_shared/longFormProjectQuote.ts", import.meta.url), "utf8");
  assert.doesNotMatch(quoteTs, /v2: 25, v3: 75, v4: (90|110)/);
});

test("tier access: tool_prices min_plan decides; affiliates get V2 only; free gets nothing; a missing row fails closed", async () => {
  const { tierAccessFrom, planAllows } = await import("../supabase/functions/_shared/longFormTierAccess.ts");
  const rows = { v2: { flat_credits: 25, min_plan: "starter" }, v3: { flat_credits: 75, min_plan: "pro" }, v4: { flat_credits: 110, min_plan: "generative" } };
  const allowed = (plan) => ["v2", "v3", "v4"].filter((t) => tierAccessFrom(t, rows[t], plan).ok);
  assert.deepEqual(allowed("free"), []);
  assert.deepEqual(allowed("starter"), ["v2"]);
  assert.deepEqual(allowed("affiliate"), ["v2"]);
  assert.deepEqual(allowed("pro"), ["v2", "v3"]);
  assert.deepEqual(allowed("generative"), ["v2", "v3", "v4"]);
  const refused = tierAccessFrom("v3", rows.v3, "starter");
  assert.equal(refused.code, "PLAN_UPGRADE_REQUIRED");
  assert.match(refused.message, /V3 needs the Pro plan/);
  assert.equal(tierAccessFrom("v2", rows.v2, "pro").creditsPerMinute, 25);
  assert.equal(tierAccessFrom("v2", null, "generative").code, "NO_SERVER_PRICE");
  assert.equal(planAllows("PRO ", "pro"), true);
});
