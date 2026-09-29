# Long Form (Stickman) — cost model

Measured per-stage costs so far, for the up-front project quote. All figures come from real runs on the
**Myth vs Reality** test project (1,038 words, 8:43 of real narration, 115–129 beats). "Estimated" means
priced from published per-token rates; ElevenLabs is reported in its own credits.

Where costs are recorded: `long_form_cost_ledger` (one row per paid call or stage run) plus the script and
research engines' own `meta.callLedger`. `long_form_project_cost_by_stage(project_id)` and
`costByStage()` (`supabase/functions/_shared/costLedger.ts`) return the total per stage per project.

## Prices (Phase 7, live)

The video is a **fixed price per minute**: V2 **25** · V3 **75** · V4 **90** credits/min (rounded up). Reserved at
Generate; charged in full only when the render finishes; fully released if the project fails, is cancelled or
deleted first. That price includes research, script, scenes + QA, voiceover, the 1080p render, 3 thumbnails and
the YouTube text. The balance can never go below 0 (`credit_balance_nonnegative`).

Paid extras are charged at click time from the balance (never from the reservation):

| Extra | Credits |
|---|---|
| Scene regenerate / split | V2 1 · V3 4 · V4 5 per scene |
| Thumbnail regenerate | 6 per image |
| 1440p render | 2/min, min 10; **free on V4**; refunded if the render fails |
| Voice re-record (after the free one) | 4/min |
| Idea regenerate | 2 |
| YouTube text rewrite | free |

Ledger: rows carry `estimated` (false = the provider reported the cost or token usage). Idea generation and
idea thumbnails are account-level rows (`user_id`, no project).

## Measured costs

| Stage | Provider / model | Measured | Notes |
|---|---|---|---|
| Story plan | OpenAI | tracked (stage `story_plan`) | Recorded since Phase 7 from real token usage. |
| Research | OpenAI (+ web search) | not measured on this project | The Myth vs Reality script was imported; research keeps its per-call ledger in `meta.callLedger`. |
| Script | Claude Sonnet 5 | **$0.237** | Stickman script run, from `meta.callLedger` (estimated). |
| Production Bible | gpt-5-mini | **$0.011–0.024** per build | Five builds: $0.0109, $0.0191, $0.0113, $0.0181 (rejected), $0.0236 (new schema, one repair). A repair roughly doubles it. |
| Beat plan | Claude Sonnet 5 | **$0.180** full plan | 115 beats, 9 calls, about $0.0016 per beat. The window-1 check was $0.074 for 30 beats; windows with many fill rewrites cost more. |
| Narration | ElevenLabs `eleven_flash_v2_5` | **1,577 credits** for 6,310 characters | About 0.25 credits per character (`character-cost` header). A 541-character pace sample cost 135 credits. USD depends on the subscription plan; the code's placeholder of $0.0003/char ($1.89 here) is probably high. |
| Images | Runware (tier model) | **V2 $0.00247 (8 steps) · V3/V4 $0.0337** per image | Measured in the Phase 4a bake-off and 4b verification (Runware-reported cost). See the tier table below. |
| Image upscale | Runware Real-ESRGAN `runware:504@1` | **$0.0006** per image | 2×, then cropped to 1920×1080 in code; every tier. |
| Text overlay | code (Lilita One) | $0 | V2 always; V3/V4 only as the OCR fallback. |
| Image QA | gpt-4o-mini, detail high, 768 px | **$0.0022** per image | Text verdict from OCR in code (gating); style, cast and concept advisory. Claude Haiku 4.5 was $0.0035. |
| Render | — | pending | |
| Phase 4 test spend | — | 4a $1.70 · 4b $0.51 · 4c $0.065 | 4a: 54 renders, 54 upscales, QA. 4b: QA calibration $0.26 and verification $0.25. |

## Scene-image tiers (Phase 4b, Stickman only)

| Tier | Model | Text | Premium | Per image (render + upscale + QA) | 150-scene video* |
|---|---|---|---|---|---|
| V2 | FLUX.2 [klein] 9B KV `runware:400@6`, 1376×768, **8 steps**, CFG 3.5; "flames, fire" in the negative unless the concept mentions fire | programmatic overlay | — | $0.0053 ($0.00307 without QA: render $0.00247 + upscale $0.0006) | **$0.91** ($0.53 without QA) |
| V3 | Nano Banana 2 Lite `google:nano-banana@2-lite`, 1376×768 | model + OCR check → retry → overlay | — | $0.0365 | **$6.30** |
| V4 | as V3 | as V3 | best-of-2 for hook + SHORT_TEXT beats, strict QA + 1 retry | $0.0365 + extras | **≈ $8.00** |

*150 scenes, +15% retries. V2 steps came from the Phase 4c tuning test (KV at 4 steps $0.00229/image incl. upscale; 9B Base $0.00746, 14–29 s; native 2048×1152 $0.00338, no upscale, but filled sleeves and rougher lines). V4 adds about 31 extra renders (about 8 hook beats + about 23 SHORT_TEXT beats) and about 15 strict-QA retries.
V2 QA can be skipped (text is never model-rendered, and style QA is advisory), which halves V2’s cost. Not used for Stickman: Nano Banana 2 ($0.069), Recraft V4 ($0.04), Qwen-Image, Kling, Seedream.

**Episode total so far (about 9 minutes, excluding images, QA and render):** about $0.44 in model calls
(script, bible and beat plan) plus about 1,600 ElevenLabs credits.

Notes
- The table the Phase 3b request referred to wasn't included in the message, so everything above is taken
  from this project's own run records.
- Beat-plan cost scales with beats (about 13–15 per minute) and with how many soft rewrites go through the
  fill call.
- Narration scales with characters: a longer script at speed 1.0 is more words per minute, not more
  characters per word.
