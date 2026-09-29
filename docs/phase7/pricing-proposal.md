# Phase 7 — Pricing + billing rules (proposal, nothing applied)

Date: 2026-09-29. Sources: `long_form_cost_ledger` (all long-form projects), the
code, and elevenlabs.io/pricing (fetched 2026-09-29). $0 spent. The numbers are
reproducible with `node scripts/phase7PricingModel.mjs`; the constants change is
`docs/phase7/pricing-constants.diff` (applies cleanly, **not applied**).

**Target:** ~50% margin on everything we sell (price ≈ 2× real cost including
overhead), calculated at the **cheapest credit we sell**: Starter billed yearly,
$16 / 750 credits = **$0.02133 / credit**. The other options are the one-time
packs at $0.0222–0.0240 and the monthly plans at $0.0263–0.0267. Payment fees
(~2.9% + $0.30) come off on top of this. At ~50% margin they cost about 2–3
points, so treat 50% as the floor, not the goal.

## 1. Real cost

Only two projects ever ran the full pipeline (images, voice, render). **f90160bc**
is the real production reference: V3, 9.61 min, 148 scenes. The test project
f6ee3eb2 (V2) is mostly experiments (bake-offs, calibrations), so its V2 image
cost comes from the ledger's per-image rates, not its totals. Research and script
are measured across 27–28 projects.

### f90160bc as recorded (V3, 9.61 min)

| Stage | Recorded | Basis | Clean production run |
|---|---|---|---|
| Research (lite: 6 web verifies + plan) | $0.178 | estimated (backfilled from tokens) | $0.18 (27-project avg $0.375, median $0.333 — older full-research runs) |
| Script: 2 drafts, 2 claim-verify, 2 critic, 1 revision | $0.709 | estimated (backfilled) | $0.48 (one draft; the 2nd draft $0.21 is overhead) |
| Production Bible | $0.023 | estimated | $0.02 |
| Beat plan: 3 builds | $0.763 | estimated | $0.25 (one build; 2 were my dev rebuilds) |
| Scene images: 148 × Nano Banana 2 Lite | $4.99 | estimated ($0.0337 each; matches measured thumbnails) | $4.99 |
| Upscale: 148 × Real-ESRGAN | $0.089 | estimated | $0.09 |
| Scene QA: 148 × gpt-4o-mini | $0.823 | **estimated too high**: $0.0056 is the full-size (6-tile) rate; the QA sends 768 px, calibrated at $0.0022 | $0.33 |
| Voice (ElevenLabs Flash v2.5, 8,332 chars) | $0.333 | **measured** (1,666 credits from the header × $0.0002) | $0.33 |
| Render 1080p (Fly, 4 machines, 388 s wall) | $0.100 | estimated (1,047 machine-seconds × $0.0000957 list price) | $0.10 |
| Thumbnails (3 concept calls, 4 images, looks) | $0.20 | measured | $0.18 |
| YouTube text (Sonnet) | $0.018 | measured | $0.02 |
| **Story plan** | — | **missing from the ledger** | not recorded (small: one LLM call) |
| **Idea generation + idea thumbnails** | — | **missing** (not project-scoped) | not recorded |
| 1440p render | — | never run | estimated 1.7× 1080p (pixel count) |
| Dev proofs (scene redo, beat proof) | $0.56 | measured | excluded (engineering, not production) |

### Overhead on top of a clean run (per video)

| Item | Evidence | Per video |
|---|---|---|
| Extra script drafts | 1.41 drafts/project avg (max 5); $1.31 wasted across 27 projects | +$0.10 |
| Abandoned projects (reservation released, we keep the cost) | assumption: 15% of started projects × ~$1 of LLM | +$0.15 |
| Failed / re-run renders | 3 failed Fly runs during setup (all < $0.08); watchdog now fails boot-dead jobs | +$0.01 |
| Failed thumbnail concept calls | 2 of 3 on f90160bc (fixed) | +$0.005 |
| **Total** | | **+$0.27** (V2 +12%, V3 +4%, V4 +3%) |

### Normalized to a 10-min video (154 scenes, 8,670 narration chars)

| Tier | Images | Voice | Render 1080p | LLM + thumbs | Clean total | + overhead | $/min | After proven savings |
|---|---|---|---|---|---|---|---|---|
| V2 | $0.54 | $0.35 | $0.10 | $1.14 | $2.14 | $2.40 (+12%) | $0.24 | $2.33 |
| V3 | $5.90 | $0.35 | $0.10 | $1.14 | $7.49 | $7.76 (+4%) | $0.78 | $7.68 |
| V4 | $7.52 | $0.35 | $0.10 | $1.14 | $9.11 | $9.38 (+3%) | $0.94 | $9.30 |

Range:
- **Old full research:** +$0.20.
- **A second script draft:** +$0.21.
- **Voice at the ElevenLabs list rate (0.5 credits/char) instead of the measured 0.2:** +$0.52.
- **Worst case:** V2 $3.3, V3 $8.7, V4 $10.3.

V4 = V3 plus best-of-2 on hook and SHORT_TEXT scenes (~20%) plus a strict QA
retry (~15%). This is modelled; there's no V4 video in the ledger yet.

## 2. Savings

The replay harness replays recorded answers, so it proves pipeline behaviour for
$0. Model quality can only be compared where recordings exist. **There are no
Haiku critic or Haiku beat-director recordings**, so those two can't be proven at
$0.

| Saving | Evidence | Status | Per 10-min video |
|---|---|---|---|
| Cap script drafts (max 1 retry, reuse the best) | ledger: 0.41 extra drafts/project | **proven** (ledger); the cap logic is testable in the harness | −$0.06 |
| Thumbnail "look" at 768 px (like scene QA) | scene QA calibrated at 768 px: same verdicts, $0.0022 vs $0.0056 | **proven** (same calibration) | −$0.015 |
| Fix the QA ledger estimate ($0.0056 → real) | calibration | accounting only (real cost is already $0.33) | — |
| Haiku 4.5 for the script critic | no recordings | **unproven**: needs a paid A/B on ~5 scripts (~$1.50) | −$0.07 (potential) |
| Haiku for the beat director | no recordings. The only Haiku data is scene QA, where it was worse (style 48% vs 69%, text 90% vs 93%) | **unproven, don't switch**: A/B first (~$2) | −$0.13 (potential) |
| Fact caching across same-topic projects | research is $0.18–0.37; topic repeats are rare | unproven, low value | −$0.02 (potential) |
| Images (~75% of V3 cost) | fixed model price | no no-loss saving; fewer scenes/min is a product decision | — |

**Current vs after-savings:** V2 $2.40 → $2.33 (proven) → $2.12 (all).
V3 $7.76 → $7.68 → $7.47. V4 $9.38 → $9.30 → $9.09. The real lever is price, not
savings: images dominate and have no quality-neutral cut.

## 3. Voice (ElevenLabs, elevenlabs.io/pricing, 2026-09-29)

| Plan | $/month | Credits | $ per 10-min video (0.2 cr/char, measured) | Videos/month (measured) | Videos/month (0.5 cr/char, list rate) |
|---|---|---|---|---|---|
| Starter (current) | $6 | 30,000 | $0.35 | 17 | 6 |
| Creator | $22 ($11 first month) | 121,000 | $0.32 | 69 | 27 |
| Pro | $99 | 600,000 | $0.29 | 346 | 138 |
| Scale | $299 | 1,800,000 | $0.29 | 1,038 | 415 |
| Business | $990 | 6,000,000 | $0.29 | 3,460 | 1,384 |

The pricing page lists Flash/Turbo v2.5 at "0.5–1 credit per character"; our
header measured 0.2. Budget for the list rate until it's confirmed. **Starter
covers only 6–17 ten-minute videos a month.** Move to Creator before launch and to
Pro at ~50+ videos a month. The price per video barely changes; the cap is what
matters.

## 4. Price proposal (≈2× after-savings cost, cheapest credit)

A fixed price per minute. The rates are set so the **shortest** length (8 min),
where the fixed cost weighs most, still earns 50%.

| Tier | Minutes | Credits (V2 25/min, V3 75/min, V4 90/min) | $ at $0.0213/cr | $ at biggest pack | Our cost | Margin |
|---|---|---|---|---|---|---|
| V2 | 8 | 200 | $4.27 | $4.44 | $2.13 | 50% |
| V2 | 10 | 250 | $5.33 | $5.55 | $2.33 | 56% |
| V2 | 12 | 300 | $6.40 | $6.66 | $2.53 | 61% |
| V2 | 15 | 375 | $8.00 | $8.33 | $2.82 | 65% |
| V3 | 8 | 600 | $12.80 | $13.33 | $6.41 | 50% |
| V3 | 10 | 750 | $16.00 | $16.66 | $7.68 | 52% |
| V3 | 12 | 900 | $19.20 | $19.99 | $8.96 | 53% |
| V3 | 15 | 1,125 | $24.00 | $24.99 | $10.86 | 55% |
| V4 | 8 | 720 | $15.36 | $15.99 | $7.71 | 50% |
| V4 | 10 | 900 | $19.20 | $19.99 | $9.30 | 52% |
| V4 | 12 | 1,080 | $23.04 | $23.99 | $10.90 | 53% |
| V4 | 15 | 1,350 | $28.80 | $29.98 | $13.29 | 54% |

**vs today's quote:**

| Tier | Current 10-min | Revenue | Our cost | Current margin | Proposed | Proposed margin |
|---|---|---|---|---|---|---|
| V2 | 304 cr | $6.49 | $2.40 | 63% | 250 cr | 56% |
| V3 | **456 cr** | $9.73 | $7.76 | **20%** | **750 cr** | 52% |
| V4 | 608 cr | $12.97 | $9.38 | 28% | 900 cr | 52% |

V3 and V4 are underpriced today; V2 is above target and gets cheaper. With the
voice at the list rate, V3 10-min margin drops from 52% to 49%.

### Add-ons (each ~50% margin, charged at click time)

| Add-on | Our cost | Credits | $ | Margin | Today |
|---|---|---|---|---|---|
| 1440p render (per 10 min: 2 cr/min, min 10) | $0.18 (est.) | 20 | $0.43 | 58% | free |
| Thumbnail regenerate, per image | $0.064 | 6 | $0.13 | 50% | 3 (0% margin) |
| Scene regenerate V2 | $0.004 | 1 | $0.02 | 83% | 2 |
| Scene regenerate V3 | $0.038 | 4 | $0.09 | 55% | 3 |
| Scene regenerate V4 | $0.042 | 5 | $0.11 | 61% | 4 |
| Voice re-record after the free one (4 cr/min) | $0.35 / 10 min | 40 | $0.85 | 59% | blocked, no paid path |
| Regenerate ideas / refresh idea thumbnails | not in the ledger | keep 2 | — | unknown | 2 |
| YouTube text "Rewrite" | $0.018 | keep free | — | — | free |

**1440p at ~5 credits would lose money:** 5 cr = $0.107 against about $0.18 real
cost per 10 min.

## 5. Billing rules — audit (fix plan only, nothing applied)

| Rule | Today | Verdict | Fix plan |
|---|---|---|---|
| a) Fixed quote shown upfront; never more; exact balance can finish | The quote is reserved. Scenes are then charged one by one from it, **capped at the quote**; the unused part is **refunded** at settle. Scenes past the cap render free, and render, text and thumbnails are free. | never more ✓, exact balance can finish ✓, **"fixed" ✗**: users pay less than the quote, whatever the scene count | At render completion, commit the **whole** reservation (settle = the full quote). Stop per-scene charges for the first pass (commit 0). Keep the ceiling. |
| b) Add-ons separate, priced on the button, blocked when short, never touch the reservation | Thumbnail regenerate: separate `deduct_credits`, price on the button, 402 if short ✓. **Scene regenerate/split in the editor charges the video's reservation** (via the scene worker; free once the cap is reached). **1440p is free.** **Voice re-record after the free one is blocked** (no paid path). | ✗ for scene regen, 1440p and voice | Charge add-ons with `deduct_credits` at click time (price from the diff's constants, shown on the button, 402 → a clear message), and mark those scene rows as paid add-ons so the worker never commits them to the reservation. 1440p: charge at start, refund if the render fails. Voice: a paid re-record button. |
| c) Balance can never go below 0 (DB-level) | `deduct_credits` and `reserve_*` refuse an overdraft (`balance >= amount`). No table constraint; 7 older scene-pricing functions subtract directly. No negative balances today (min 0). | partial | `alter table profiles add constraint credit_balance_nonnegative check (credit_balance >= 0)`. Safe to add today. |
| d) Failed / cancelled / deleted → reservation released; free retries stay free | Released on delete, script/research failures and exhausted attempts ✓. Scenes/render failures keep free retries ✓. Abandoned → 7-day idle settle ✓. **A release refunds only the uncommitted part.** | ✓ (with the fixed-quote change, nothing is committed before completion, so a release refunds everything) | Nothing extra once (a) is done. |
| e) Settle at render completion + 7-day idle auto-settle | `LONG_FORM_SETTLE_AT_RENDER` + `RESERVATION_IDLE_SETTLE_DAYS = 7` ✓ | ✓ | Keep. |

**Order to ship (after approval):**
1. The balance constraint (c).
2. The fixed-quote settle (a).
3. Add-on charging (b).
4. The constants diff.

The constants **must not ship before (a)**. Otherwise the new per-scene prices
(V3 4 credits) are drawn from the video's reservation and the rest of the new
quote is refunded, so a user would pay about 616 instead of 750.

## Caveats

- Most LLM, image and render rows are **estimated** from tokens × list prices.
  Voice, thumbnails and YouTube text are measured. Suggest recording the real
  `usage` for scene QA and Runware `cost` on every row.
- One real V3 video and no V4 video: re-run this model after the next 5–10
  customer videos.
- Abandonment (15%) is an assumption; the next user cohort sets it.
- Infra fixed costs (Supabase, Fly registry, storage egress) are not per-video
  and not included.
