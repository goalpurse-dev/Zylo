# Long Form (Stickman) — cost model

Measured per-stage costs so far, for the up-front project quote. All figures come from real runs on the
**Myth vs Reality** test project (1,038 words, 8:43 of real narration, 115–129 beats). "Estimated" means
priced from published per-token rates; ElevenLabs is reported in its own credits.

Where costs are recorded: `long_form_cost_ledger` (one row per paid call or stage run) plus the script and
research engines' own `meta.callLedger`. `long_form_project_cost_by_stage(project_id)` and
`costByStage()` (`supabase/functions/_shared/costLedger.ts`) return the total per stage per project.

| Stage | Provider / model | Measured | Notes |
|---|---|---|---|
| Story plan | OpenAI | **not tracked yet** | Gap: `generate-long-form-story-plan` records no usage; needs a ledger write. |
| Research | OpenAI (+ web search) | not measured on this project | The Myth vs Reality script was imported; research keeps its per-call ledger in `meta.callLedger`. |
| Script | Claude Sonnet 5 | **$0.237** | Stickman script run, from `meta.callLedger` (estimated). |
| Production Bible | gpt-5-mini | **$0.011–0.024** per build | Five builds: $0.0109, $0.0191, $0.0113, $0.0181 (rejected), $0.0236 (new schema, one repair). A repair roughly doubles it. |
| Beat plan | Claude Sonnet 5 | **$0.180** full plan | 115 beats, 9 calls, about $0.0016 per beat. The window-1 check was $0.074 for 30 beats; windows with many fill rewrites cost more. |
| Narration | ElevenLabs `eleven_flash_v2_5` | **1,577 credits** for 6,310 characters | About 0.25 credits per character (`character-cost` header). A 541-character pace sample cost 135 credits. USD depends on the subscription plan; the code's placeholder of $0.0003/char ($1.89 here) is probably high. |
| Images | — | **pending Phase 4** | About 115–129 images per episode at this pace. |
| Image QA | — | pending Phase 4 | |
| Render | — | pending | |

**Episode total so far (about 9 minutes, excluding images, QA and render):** about $0.44 in model calls
(script, bible and beat plan) plus about 1,600 ElevenLabs credits.

Notes
- The table the Phase 3b request referred to wasn't included in the message, so everything above is taken
  from this project's own run records.
- Beat-plan cost scales with beats (about 13–15 per minute) and with how many soft rewrites go through the
  fill call.
- Narration scales with characters: a longer script at speed 1.0 is more words per minute, not more
  characters per word.
