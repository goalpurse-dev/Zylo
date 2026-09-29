# AI Fruit Story v2: Phase 3 plan (real backend)

Status: **approved 2026-09-27.** Stage 3b is built (not applied or deployed); see §6.

**Decisions (2026-09-27):**

| Topic | Decision |
|---|---|
| Clip prices | **5 / 8 / 10 cr/s** for V2 / V3 / V4, as placeholders (only the owner's account uses v2) |
| 3e measurements | Real cost/s per model. Also resolve the price-list discrepancy: "Seedance 2.0 Mini 480p $0.036/s" vs docs "$0.081/s, 720p only" for i2v + audio + 9:16. If V2 really is ~$0.08/s, propose a cheaper V2 model with native audio |
| Final prices | Set before rollout |
| 3e scope and cap | $1.80: the 15 s V2 story + one 4 s V4 clip; **no V3 test clip** |
| Blind test | Sonnet 5 vs **GPT-5.6 Sol**. Small tasks: gpt-5-mini |
| 3f (Cloud Run) | Click-by-click setup steps first, then wait for the owner before deploying |
| Tool keys | **Separate v2 keys**: `image:fruit-story`, `video:fruit-story-v2/v3/v4` |

Why separate tool keys: repointing `video:fruit-v2/v3/v4` would break live v1, which still sends 5 s / 496×864 clips on those keys. The v1 keys are retired together with v1.
Budget: $4.00 total paid API spend for all Phase 3 tests. Stage caps below sum to $3.00, leaving $1.00 of headroom that is only used if you approve it.

---

## 0. Decisions needed before 3b

Checked against Runware's model docs on 2026-09-27. Real costs are confirmed in stage 3e from `includeCost`.

### 0.1 Your clip prices lose money at Runware's listed prices

One credit brings in about **$0.0266** on a plan (Starter $20 / 750, Pro $42 / 1,600, Generative $85 / 3,200) and **$0.02** as a pack/overage credit (`src/lib/pricing.ts`).

| Item | Model (listed cost) | Your price | Revenue | Margin |
|---|---|---|---|---|
| Scene picture / edit | Nano Banana 2 Lite, $0.0337 | 3 cr | $0.06–0.08 | **+44% to +58%** ✅ |
| V2 clip, per second | Seedance 2.0 Mini 720p, $0.081/s | 3 cr/s | $0.06–0.08 | **−35% to −1%** ❌ |
| V3 clip, per second | Seedance 2.0 Fast 720p, $0.13/s | 5 cr/s | $0.10–0.133 | **−30% to +2%** ❌ |
| V4 clip, per second | Veo 3.1 Fast 720p + audio, $0.15/s | 8 cr/s | $0.16–0.21 | **+6% to +30%** ⚠️ |

For about 40% margin at plan credit value, prices would be **V2 5 cr/s, V3 8 cr/s, V4 10 cr/s**. Pictures can stay at 3.

**Recommendation:** in 3b, seed `tool_prices` with the prices you choose. Stage 3e measures the real cost per second and reports real cost against credits charged. The final price change is one row update.

Other options:
- Seedance 2.0 Fast at 480p for V2 ($0.06/s), still negative at 3 cr/s on pack credits.
- Shorter clips. The duration snap already never generates longer than needed.

### 0.2 Stage 3e's cap is too small for the test you described

At listed prices, a 15 s V2 story is about 3 clips and 13 s of video:

| Test | Cost |
|---|---|
| 15 s V2 story (≈13 s at $0.081/s) | ≈ $1.05 |
| 1 V3 clip, 4 s | ≈ $0.52 |
| 1 V4 clip, 4 s | ≈ $0.60 |
| **Total** | **≈ $2.17** |

That's over the $1.80 cap. Options:
- **(a)** Raise 3e to $2.40. The total then stays ≤ $4.00: 0.40 + 0.40 + 2.40 + 0.10 + 0.30 = $3.60.
- **(b)** Keep $1.80 and drop the V3 test clip.

### 0.3 Model facts that change the brief

| | Nano Banana 2 Lite | Seedance 2.0 Mini (V2) | Seedance 2.0 Fast (V3) | Veo 3.1 Fast (V4) |
|---|---|---|---|---|
| AIR id | `google:nano-banana@2-lite` | `bytedance:seedance@2.0-mini` | `bytedance:seedance@2.0-fast` | `google:3@3` |
| Sizes (9:16 / 16:9) | 768×1376 / 1376×768 | 720×1280 / 1280×720 (720p only) | 720×1280 / 1280×720 (also 496×864 / 864×496 at 480p) | 720×1280 / 1280×720 (also 1080p, 4K) |
| Durations | — | 4–15 s, integer | 4–15 s, integer | 4, 6, 8 s (the docs page also lists 7, so I'll confirm it with a free validation request in 3e) |
| First frame | — | `inputs.frameImages` | `inputs.frameImages` | `inputs.frameImages` |
| Reference images | up to 14 (`inputs.referenceImages`) | up to 9, **not combinable with frameImages** | up to 9, **not combinable with frameImages** | up to 3, **not combinable with frameImages** |
| Audio | — | `settings.audio` (default true) | `settings.audio` (default true) | `providerSettings.google.generateAudio` (default true) |
| Prompt limit | 45,000 chars | 10,000 | 10,000 | 3,000 |
| Seed | yes | — | — | — |

What this means for the brief:
- **No character refs in clips.** "V4 (max 3 refs)" and image-to-video can't be combined on any of the three models. Every clip uses **the scene picture as the first frame and no reference images**. Character consistency comes from the picture, which is made with the library refs.
- **Veo duration snapping.** V4 snaps to {4, 6, 8}.

### 0.4 LLMs

| Role | Candidates | Plan |
|---|---|---|
| Story + series planner | Claude Sonnet 5 vs **GPT-5.6 Sol** | Blind test in 3c |
| Small tasks (edit-instruction cleanup, content-policy rewrite) | Claude Haiku 4.5 ($1 / $5 per M tokens) vs gpt-5-mini ($0.25 / $2) | **gpt-5-mini is cheaper** |

- **Why GPT-5.6 Sol:** it's OpenAI's tier comparable to Sonnet 5, at $5 / $30 per M tokens ($4 / $20 promotional).
- **Not GPT-6 Astra:** Astra is OpenAI's new flagship at $10 / $50, about 3× the cost. Say so if you want Astra in the test instead.
- **Prompt caching:** Anthropic `cache_control` on the fixed system prompt and library block. OpenAI caches automatically.
- **One config file:** every model choice lives in `supabase/functions/_shared/fruit/models.js`.

---

## 1. Architecture

```
browser (v2 UI) ──▶ fruit-story-api (edge fn: auth, paid plan, validation, rate limit)
                        │  createStory → planner LLM → rows (status draft)
                        │  step actions → fruit_charge_step RPC (atomic) → fruit_jobs rows (queued)
                        ▼
                    fruit-worker (edge fn, service only): submits Runware tasks (async + webhook),
                        │  stores results in Storage, advances scene/story status, refunds failures
                        ▲
Runware webhook ────────┘   pg_cron every minute ──▶ fruit-reconcile: polls lost/stuck tasks,
                                                     resubmits safely, gives up + refunds
Cloud Run "fruit-final" (ffmpeg) ◀── buildFinal; uploads MP4 via a one-time signed upload URL
browser ◀── Supabase realtime on fruit_stories / fruit_story_scenes (RLS-filtered)
```

### Principles
- **Fruit has its own code path.** It doesn't use `jobs`, `job-worker`, `runware-image` or `runware-video`, so no shared behavior changes and none of the 2,000/1,450-char truncation.
- **Fruit-only keys.** New `image:fruit-story`. Repointed `video:fruit-v2/v3/v4`. `image:fruit-v2` is shared with 5 other tools and stays untouched.
- **What's saved is what's sent.** Every prompt is built once, stored in the row, and sent byte-for-byte:
  - Scene: `image_prompt`, `clip_prompt`.
  - Story and series: `planner_request`.
  - Every call: `fruit_ai_calls` records the exact request body, response, tokens, `cost_usd` and latency.
  - Nothing truncates. Builders are bounded by design, and tests fail if any builder can exceed its limit.
- **The line in the DB is the line in the video.** `scene.line` is quoted verbatim into `clip_prompt` and is the caption text. There's no vision or dialogue rewrite pass.
- **Charges.**
  - `fruit_charge_step(story, step, items)` charges the whole step in one transaction and writes one ledger row per item.
  - Each failed item is refunded automatically, exactly once (idempotency key `item:refund`).
  - Prices come only from `tool_prices`, through the existing `compute_tool_price`.
- **Dev kill switches.**
  - `FRUIT_PAID_CALLS=off` (edge secret) makes every Runware and LLM call fail fast with `PAID_CALLS_DISABLED`.
  - Test scripts refuse to run paid calls unless `FRUIT_ALLOW_PAID=1` and a `--cap` are given. Otherwise they only replay recorded responses.

---

## 2. Audit issues → where each is fixed

### Backend audit (docs/ai-fruit-backend-audit.md §11)

**Prompt layer**

| # | Issue | Fix |
|---|---|---|
| P1 | Image prompt truncated to 2,000 chars | Own builder, content first, ≤ 2,500 chars by design, sent unmodified (3d) |
| P2 | Video prompt truncated | Own builder, ≤ 1,500 chars by design (under Veo's 3,000), tested (3e) |
| P3 | Prompt rebuilt from a truncated prompt | Prompt built once, stored, re-sent as stored (3e) |
| P4, P5 | Vision "species mismatch" dialogue | **Not carried over**: no vision pass |
| P6 | Planner output fields discarded | Planner JSON has only fields we store (3c) |
| P7 | Contradictory "look at the uploaded images" text | **Not carried over**: new planner prompt |
| P8 | AI-invented casts with `"unspecified"` gender | **Not carried over**: library characters only |
| P9 | Beat context lost | Stored per scene: action, emotion, shot, location (3b/3c) |
| P10 | Retries built from different inputs | Retries re-send the stored prompt (3d/3e) |
| P11, P12 | Sanitizer bug, dead code | **Not carried over**: v1 code isn't reused |

**Security and billing**

| # | Issue | Fix |
|---|---|---|
| S1 | Browser-declared prices | Server creates all Fruit jobs; prices from `tool_prices` only (3b) |
| S2 | Open GPT-4o vision endpoint | **Not carried over**. `fruit-story-video-prompts` stays for v1 until v1 is removed (it already has auth and a rate limit since the hotfix) |
| S3 | Client-only paywall | Paid-plan check in every entry point, plus `min_plan` per tier (3b) |
| S4 | No rate limits | `consume_rate_limit` on every entry point (3b) |
| S5 | Raw provider errors reach the browser | Error codes + friendly messages; raw text only in `fruit_ai_calls` (3b) |
| S6 | Public, guessable media | Media under `generated/fruit/<user>/<story>/<uuid>`: unguessable ids, deleted with the story. **Private buckets are out of scope** (the UI needs plain URLs) |

**Reliability and races**

| # | Issue | Fix |
|---|---|---|
| R1 | Charge at completion leaves jobs stuck | Charge at step start; completion never needs money (3b) |
| R2 | Partial billing | One atomic step charge with a balance check for the whole step (3b) |
| R3, R4 | No dispatcher; reconciliation never runs | `fruit-reconcile` cron every minute: resubmit, poll, time out, refund (3b) |
| R5 | 3-minute sleep inside one invocation | No sleeping. 402/busy is re-queued with backoff, and the reconciler picks it up (3b) |
| R6 | Story runs in the browser tab | Server runs every story; closing the tab changes nothing (3b) |
| R7 | Global concurrency | Per-story concurrency (4 pictures / 3 clips) plus a Fruit-wide cap in the worker (3b) |
| R8 | LLM calls without timeouts | Every LLM call has a timeout and one repair at most (3c) |
| R9 | Reused task UUIDs | A fresh `taskUUID` per attempt, recorded in `fruit_jobs` (3b) |

**Data, config and observability**

| # | Issue | Fix |
|---|---|---|
| D1 | Runware cost never read | Real `cost` stored per job and per LLM call (3b) |
| D2 | `jobs` schema/RLS not in repo | **Not carried over**: Fruit tables are fully in migrations |
| D3 | Loose status column | CHECK-constrained statuses (3b) |
| D4 | Unmeasured V2 price | Measured in 3e (see §0.1) |
| D5 | Stale comment | Not touched (shared file) |
| D6 | Forked stitchers | **Not carried over**: server-side final on Cloud Run |

### UI audit (docs/ai-fruit-ui-audit.md §9)

The v2 UI already replaced the v1 screens. Backend-relevant items:

| UI audit issue | How v2 handles it |
|---|---|
| No final video | 3f |
| Resume, stuck scenes, late images | Server-driven + reconciler |
| Hidden costs | v2 shows quoted prices; the server charges the same |
| Failure reasons hidden | Error codes + friendly text |
| Plan loading, unknown codes | Server plan check is authoritative |
| Old v1 stories | Read-only in Recent (3h) |

---

## 3. Stages

Each stage stops for your approval before the next one. Every migration is shown before it's applied; versions are current UTC with a clash check.

### 3b. Data + security foundation ($0)

**Migration** `fruit_story_backend`:

| Table | Holds |
|---|---|
| `fruit_stories` | owner, source, input, cast, quality, length, aspect, status, series/episode, title, locations, final fields, error |
| `fruit_story_scenes` | index, speaker, line, present ids (≤ 3), location, action, emotion, shot, `duration_sec`, `image_prompt`, image status/url/job, `clip_prompt`, clip status/url/job, error |
| `fruit_series` | owner, title, logline, cast, tone, opener, bible |
| `fruit_series_episodes` | number, title, summary, cliffhanger, story_id |
| `fruit_ideas` | public read |
| `fruit_jobs` | one per provider attempt: kind, tool_key, credits, status, `task_uuid`, attempt, submitted/finished, cost_usd, raw result |
| `fruit_credit_ledger` | every charge/refund, idempotency-keyed |
| `fruit_ai_calls` | every LLM/Runware call: exact request, response, cost, tokens, latency |

Access rules:
- **RLS:** owner read only. The guard trigger blocks all browser writes to every Fruit table, so the browser writes nothing and all writes go through the API.
- **Realtime:** stories and scenes are added to the realtime publication.

Also in this migration:
- **RPCs** (service only): `fruit_charge_step`, `fruit_refund_item`.
- **Prices:**
  - `tool_prices` row `image:fruit-story` = 3 flat.
  - `video:fruit-v2/v3/v4` repointed with per-second prices from §0.1, allowed durations (Seedance 4–15, Veo 4/6/8), 720p sizes, and `min_plan` starter/pro/generative.
  - `video:fruitveo31lite` (the legacy v1 alias) stays until v1 is removed.
- **Cron:** a per-minute `pg_cron` job calls `fruit-reconcile` through the existing `private.trigger_*` pattern.

Edge functions and shared code:
- **`fruit-story-api`:** one function, action-routed, for every contract call. Each action does auth → paid plan → validation → rate limit → work.
- **`fruit-worker`:** submit, webhook, advance.
- **`fruit-reconcile`.**
- **Shared pure modules** in `_shared/fruit/`: `statusMachine`, `pricing`, `duration`, `validation`, `models`, `errors`. They're plain JS so node tests and Deno share them.

Tests (offline):
- the state machine, duration snapping, pricing (server = quote);
- refunds and idempotency against a replay of recorded provider responses;
- RLS/guard dry runs (BEGIN … ROLLBACK), as for `fruit_characters`.

### 3c. Ideas + story planner (cap $0.40)

**Ideas ($0):**
- I write ≥ 1,000 ideas into `fruit_ideas` as a seed file (no API).
- Each idea: title, one-line summary, 2–3 library cast ids.
- Balanced across the 14 story types, with ~120 uk-roadman ideas.
- `getIdeas` returns 5 random ideas per click, excluding ones this user saw recently.

**Planner:**
- **Input:** source (idea / prompt / script), cast, length, aspect, and series context.
- **Output JSON:** title, locations (short fixed descriptions, referenced by id), and scenes of `{speakerId, line, presentIds, locationId, action, emotion, shot}`.
- **Code validates:**
  - cast ⊂ library, speaker ∈ present, ≤ 3 present;
  - lines of 6–14 words (hard max 20);
  - total estimated speech within ±15% of the target;
  - script mode: lines byte-identical to the user's.
- **One repair call** that quotes the exact validation errors, then `PLANNER_FAILED`.

**Blind test:**
- Inputs: 1 idea, 1 prompt, 1 script, each at 15 s, through Sonnet 5 and GPT-5.6 Sol (6 runs, est. $0.10–0.25).
- You see the full scripts labeled A / B (randomized), with cost per script.
- The key is sealed in a local file until you choose.

### 3d. Scene pictures (cap $0.40)

**Prompt builder:**
- **Order:** scene content first (who, where, doing what, feeling what, camera), then "Image 1 is Mia Mango, the mango woman…" for each ref, location, a short style line, "no text".
- **Length:** ≤ 2,500 chars by design, with a test at max inputs.
- **Refs:** the library refs of the present characters (≤ 3) and, for continuity, the previous scene picture at the same location.

**Runs:**
- Parallel, with ≤ 4 per story.
- **Edit:** the current picture as the reference plus the user's instruction, cleaned up by the small model (logged).
- **Regenerate:** the user's edited prompt, sent exactly.

**Paid test:** one 15 s story (≈ 3 pictures, ≈ $0.10) plus 1 edit (≈ $0.034). I'll show you every picture with its exact prompt, then **stop**.

### 3e. Clips (cap per §0.2)

**Prompt builder:**
- The exact line in quotes.
- The speaker by fruit, name and frame position.
- The library `voiceStyle`, verbatim every time.
- Emotion, one small action, one camera move.
- "Only {speaker} speaks, everyone else is silent", no music, no subtitles, no text.
- Hard limit ≤ 1,500 chars.

**Duration:** estimated speech (2.6 words/s) + 0.8 s buffer, snapped **up** to the model's allowed durations (Seedance 4–15; Veo 4/6/8).

**Content policy:** one automatic safe rewrite (small model, logged), then `CLIP_BLOCKED` + refund.

**Paid test:** the 3d story on V2, plus 1 V3 clip and 1 V4 clip. For each clip you get its exact prompt, the real cost, and credits charged vs real cost.

### 3f. Final video (cap $0.10)

**Cloud Run `fruit-final`:** Node + ffmpeg container.
1. Input: ordered clip URLs + lines + captions flag, plus a signed upload URL.
2. Per clip, `silencedetect` trims leading/trailing silence, keeping 0.25 s.
3. Normalize, then concat.
4. Captions via `drawtext` from the known lines, using a bundled font (no transcription).
5. Upload the MP4 to `generated/fruit/...` and call back `fruit-worker`.

Access and hosting:
- **Auth:** shared secret header. Cloud Run holds no Supabase key.
- **Hosting:** min instances 0, 1 vCPU / 2 GB, request timeout 300 s.

**What you set up in the Google Cloud console:**
1. Create a project (e.g. `zyvo-fruit-final`).
2. Link billing.
3. Budgets & alerts: a **$5/month** budget with emails at 50 / 90 / 100%.
4. Enable the Cloud Run, Cloud Build and Artifact Registry APIs.
5. Install the gcloud CLI and run `gcloud auth login` on this machine, so I can deploy with `gcloud run deploy fruit-final --source …`.

**Expected cost:**
- A 30 s build is ~20–40 vCPU-seconds.
- The free tier is 180k vCPU-s and 360k GiB-s per month, about 3,000–4,000 builds.
- At our volume that's **$0/month**, plus about $0.10/month for Artifact Registry storage.

**Test:** on the 3e clips, no new video.

### 3g. Series (cap $0.30)

**Series planner:**
- Output: title, logline, and N episodes (title, summary, cliffhanger) respecting locked roles.
- Free for the user; rate-limited to 5 per 10 minutes.

**Episodes:**
- They unlock in order.
- The episode planner gets the series bible, previous summaries and this episode's plan.
- Scene 1 picks up the last cliffhanger; the last scene lands the new one.

**Paid test:** a 3-episode plan, plus episode 1's script and pictures at 15 s. No video.

### 3h. Connect + roll out ($0)

- **Adapter:** the real adapter replaces the mock (the mock stays for tests and `?fruitV2Preview=1`).
- **Banner:** the "Preview mode" banner is hidden for real stories.
- **Recent:** real history, plus v1 `fruit_story_generations` shown read-only.
- **Flag:** still your account only.
- **Final report:** end-to-end walkthrough, open risks, and measured cost per 30 s story per tier.

---

## 4. Error codes (all with a friendly message and next step; credits refunded automatically where charged)

| Code | Message and next step |
|---|---|
| `VALIDATION` | Plain-language message about the input |
| `PLAN_UPGRADE_REQUIRED` | Upgrade dialog |
| `INSUFFICIENT_CREDITS` | Buy-credits dialog, nothing charged |
| `RATE_LIMITED` | "Try again in Ns" |
| `PLANNER_FAILED` | "We couldn't write this story. Nothing was charged. Try again." |
| `IMAGE_FAILED` / `CLIP_FAILED` | "…refunded. Tap Retry." |
| `CLIP_BLOCKED` | "…the video model refused this line. Refunded. Edit the line or picture and try again." |
| `PROVIDER_BUSY` | Retried automatically; refunded if it gives up |
| `FINAL_FAILED` | Free, retry |
| `PAID_CALLS_DISABLED` | Dev only |

---

## 5. Budget ledger

| Stage | Cap | Spent |
|---|---|---|
| 3b | $0 | — |
| 3c | $0.40 | — |
| 3d | $0.40 | — |
| 3e | $1.80 (or $2.40, see §0.2) | — |
| 3f | $0.10 | — |
| 3g | $0.30 | — |
| **Total** | **≤ $4.00** | — |

---

## 6. Stage 3b: built, waiting for approval to apply and deploy

### Files

| Area | Files |
|---|---|
| Migration | `supabase/migrations/20260927123135_fruit_story_backend.sql` |
| Rollback | `supabase/rollbacks/20260927123135_fruit_story_backend_rollback.sql` |
| Shared logic (plain JS, used by Deno and node tests) | `supabase/functions/_shared/fruit/`: `limits.js`, `models.js` (the one model config), `errors.js`, `duration.js`, `storyState.js`, `validation.js`, `steps.js`, `runware.js`, `engine.js`, `supabaseStore.js` |
| Edge functions | `supabase/functions/fruit-story-api/index.ts` (every contract action), `supabase/functions/fruit-worker/index.ts` (webhook, kick, reconcile) |
| Function config | `supabase/config.toml`: `fruit-story-api` verify_jwt = true; `fruit-worker` verify_jwt = false (it checks its own secret or HMAC) |
| Paid-run guard | `scripts/fruit-story/paidGuard.mjs`: kill switch + stage/total budget |
| Tests | `tests/fruitBackendUnits.test.mjs`, `tests/fruitEngine.test.mjs`, `tests/fruitPaidGuard.test.mjs`, plus `tests/helpers/fruitMemoryStore.mjs` |

The reconciler lives inside `fruit-worker` (action `reconcile`) rather than as a third function: same code, one secret, one deploy.

### Deploy order (after approval)

1. **Apply the migration.** `supabase db query --linked -f …`, then `migration repair --status applied 20260927123135`.
2. **Edge secrets.**
   - `FRUIT_WORKER_SECRET`: a new random 32-byte hex value.
   - `FRUIT_PAID_CALLS=off`: stays off until stage 3d's paid test.
3. **Vault secrets** (the cron reads these):
   - `fruit_worker_url` = `https://<project>.supabase.co/functions/v1/fruit-worker`
   - `fruit_worker_secret` = the same value as `FRUIT_WORKER_SECRET`
4. **Deploy** `fruit-story-api` and `fruit-worker`.
5. **Smoke test ($0).**
   - `listCharacters` returns 170.
   - `getStory` for an unknown id returns `NOT_FOUND`.
   - `generateScenePictures` returns `STAGE_NOT_READY`.
   - The worker's `reconcile` returns ok.
   - The cron fires with no work.
