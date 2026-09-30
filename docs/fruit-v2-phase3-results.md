# AI Fruit Story v2: Phase 3 results (stages 3b–3e)

Date: 2026-09-30. Everything below ran on production through the real API as the owner's
account (flagged, v2 only). Plan: [fruit-v2-phase3-plan.md](fruit-v2-phase3-plan.md).

## Spend so far

| Stage | Cap | Spent |
|---|---|---|
| 3b data + security | $0 | $0 |
| 3c ideas + planner blind test | $0.40 | $0.108 |
| 3d scene pictures | $0.40 | $0.288 |
| 3e clips + bake-off | $2.20 | $2.030 |
| 3e confirmation (Wan V2, 3 clips) | $1.00 | $0.753 |
| **Phase 3 total** | **$4.00** | **$3.18** |

## Models (in `supabase/functions/_shared/fruit/models.js`)

| Role | Model | Measured cost | How chosen |
|---|---|---|---|
| Story + series planner | Claude Sonnet 5 | $0.010–0.011 per 15 s story | Blind test vs GPT-5.6 Sol: Sonnet won 2 of 3 rounds (idea, prompt); the script round only compared staging |
| Small tasks (edit cleanup, content-policy rewrite) | gpt-5-mini | ≈ $0.0006 per call | cheaper than Haiku 4.5 |
| Scene pictures, edits, regenerations | Nano Banana 2 Lite, 768×1376 | **$0.0346 / picture** (8 measured, $0.0344–0.0350) | brief |
| V2 clips | **Wan2.6 Flash**, 720p, i2v, audio | **$0.0504 / s** | 3e bake-off: cleanest scene 3 (no cut, face to camera, full line), cheapest |
| V2 fallback | Seedance 2.0 Mini | $0.0817 / s | if a Wan clip finally fails, re-sent once on Mini (same user price) |
| V3 clips | **Seedance 2.0 Mini**, 720p, i2v, audio | **$0.0817 / s** (3 clips, $0.408 each for 5 s) | 3e |
| V4 clips | Veo 3.1 Fast, 720p, audio | **$0.15 / s** (1 clip, $0.60 for 4 s) | brief |

Seedance 2.0 Mini: the "$0.036/s at 480p" list price does **not** apply to our settings; at
720p (the size its docs list for image-to-video) Runware charged $0.0817/s.

**Later options, untested:** Seedance 2.0 Mini at 480p (skipped by the 3e budget guard) and
LTX-2.3 ($0.04/s listed; refused once by Runware for low available balance, not retried).

## What works end to end

- **Story writing:** `createStory` (planner validated by code, one repair) → `fruit_create_story`.
  The planner enforces: lines of 6–14 words that land when heard once; banned clichés; time of
  day + lighting per location; spatial placement whenever a line mentions glass, walls, doors,
  inside or outside; no wide shots for dialogue.
- **Paid steps:** `generateScenePictures` / `editScene` / `regenerateScene` / `animateAll` /
  `regenerateClip`.
  - Each step is one atomic charge priced from `tool_prices`.
  - The worker submits to Runware and the webhook stores the result in Storage.
  - A per-minute reconciler catches anything lost.
  - Failed items are refunded exactly once.
  - Every AI call is logged with its real cost.
- **Proof:** the owner's balance moved exactly with the ledger in every run (12 credits for
  pictures + edit, then 115 credits for clips). The one-job V4 test override was used once and
  expired; plan and Stripe untouched.
- **Consistency:** the same three characters and outfits in every picture and clip; edits keep
  everything else in place.

## Confirmation run (V2 = Wan2.6 Flash, no-cut rule)

- All 3 scenes of "Glass Walls Don't Lie" re-animated through `regenerateClip` on Wan2.6 Flash: 3/3 succeeded, no Seedance fallback, $0.2504 per 5 s clip ($0.0501/s), 25 credits each, balance moved exactly 75.
- 3/3 transcripts exact, 0 cuts, every speaker faces the camera (scene 2 no longer turns to profile), listeners stay silent. Saved prompt == sent prompt for all 3.

## Known issues and limits

- **Small sample:** one story, 3 scenes, 1 clip per model on scene 3. Model rankings are indicative, not proven.
- **Lip sync on profile shots:** when the speaker turns sideways (V2 scene 2 on Seedance), the
  mouth is hard to read. Only frames (2 fps) and speech-to-text were checked; lip timing needs
  a human watching with sound.
- **Seedance multi-shot cuts:** Seedance 2.0 cut to a second shot in one clip and lost the last
  word. The no-cut rule is now in every clip prompt (not yet re-tested on Seedance).
- **Framing:** the picture model sometimes ignores "waist up"; one scene came out with the
  speaker's head at ~18% of the frame height (target ≥ 25%).
- **Wan audio:** Wan's docs promise ambient audio only; in practice it spoke the dialogue in
  all 4 Wan clips so far (bake-off + confirmation), transcripts exact.
- **Provider balance:** a low Runware balance refuses jobs. Users would get an automatic refund,
  but there is no friendly "service busy" state or admin alert yet.

## Pricing proposal (not applied)

Rule, same as Long Form Phase 7 (`docs/phase7/pricing-proposal.md`):
- ~50% margin (the floor) at our **cheapest credit**, which is Starter billed yearly: $16 / 750 = **$0.02133**.
- Plus ~10% overhead for failed and retried work.
- So credits = real cost × 1.10 × 2 ÷ $0.02133, rounded up.

The `$0.02` in `src/lib/pricing.ts` (`CREDIT_RETAIL_USD`) is a legacy "retail" constant used
to turn dollar targets into credits. No current product sells a credit at $0.02 (packs are
$0.0222–0.0240, monthly plans $0.0263–0.0267), so **$0.02133 is the right floor**.

| Item | Real cost | Cost + 10% | Price | Revenue at $0.02133 | Margin | Today |
|---|---|---|---|---|---|---|
| Picture (new / regenerate) | $0.0346 | $0.0381 | **4 cr** | $0.0853 | **55%** | 3 cr |
| Edit (picture + gpt-5-mini) | $0.0352 | $0.0387 | **4 cr** | $0.0853 | **55%** | 3 cr |
| V2 clip, Wan2.6 Flash | $0.0504/s | $0.0554/s | **6 cr/s** | $0.128/s | **57%** | 5 cr/s |
| V3 clip, Seedance 2.0 Mini | $0.0817/s | $0.0899/s | **9 cr/s** | $0.192/s | **53%** | 8 cr/s |
| V4 clip, Veo 3.1 Fast | $0.15/s | $0.165/s | **16 cr/s** | $0.341/s | **52%** | 10 cr/s |
| Story writing, series plans | ≈ $0.011–0.02 | | free | | absorbed | free |

- V2 at 5 cr/s would be 48%, below the floor.
- A V2 clip that falls back to Seedance Mini earns 30% margin at 6 cr/s. That should be rare.

**Per 30 s story (6 scenes, no retries):**
- V2: 24 + 180 = **204 credits** ($4.35), real cost ≈ $1.74.
- V3: 24 + 270 = **294 credits** ($6.27), real cost ≈ $2.67.
- V4: 24 + 480 = **504 credits** ($10.75), real cost ≈ $4.72.

## Launch checklist (what's left before Fruit Story v2 goes live)

Phase 3 budget left after the confirmation run: $0.82 of $4.00.

| # | Task | What it is | Est. API cost | Est. time |
|---|---|---|---|---|
| 1 | Prices | Apply the pricing table above (`tool_prices` rows) after approval | $0 | 1 h |
| 2 | **3f: final video** | Join the clips, trim leading/trailing silence (keep a short pause), optional captions from the known lines, MP4 in permanent storage. On Fly.io, reusing the Long Form `render-worker` (Node 22 + ffmpeg, per-job machines; its `fly.toml` still says draft, so deploy is part of this). Test on the 3e clips | ≤ $0.10 test; ~$0.003–0.006 per final on performance-8x (≈ $5/month at 1,000 finals) | 0.5–1 day |
| 3 | **3g: series** | Series planner (title, logline, N episodes with cliffhangers, locked roles); episodes unlock in order; each episode is planned from the bible, previous summaries and its own plan. Test: a 3-episode plan + episode 1 script and pictures at 15 s | ≤ $0.30 | 0.5–1 day |
| 4 | **3h: connect the UI** | Real adapter in the v2 UI; realtime `subscribeStory`; switch UI price quotes to the `image:fruit-story` / `video:fruit-story-*` keys; drop the Preview banner for real stories; Recent = real history + old v1 stories read-only; still flag-gated | $0 | 1 day |
| 5 | Provider balance guard | Friendly "service busy, refunded" state and an admin alert when Runware refuses for low balance (seen in 3e) | $0 | 0.5 day |
| 6 | Framing follow-up | Stronger "waist up" enforcement, or the planner prefers close-ups when 3 characters are in frame | ~$0.10 to verify | 2–3 h |
| 7 | Full-length check | One real 30 s story per tier end to end, after 1–4 | ≈ $1.7 (V2) + $2.7 (V3) + $4.7 (V4) ≈ **$9**, outside the Phase 3 budget | 2 h |
| 8 | Mobile QA | v2 UI with real data on phone widths; slow-network behavior of realtime updates | $0 | 0.5 day |
| 9 | Rollout | Enable `fruit_v2` for internal testers, then everyone; remove v1 (`AIFruitStoryV1`) and retire the v1 tool keys (`image:fruit-v2`, `video:fruit-v2/v3/v4`, `video:fruitveo31lite`) once no v1 jobs remain | $0 | 0.5 day + watch period |
| 10 | Optional | Test Seedance 2.0 Mini 480p and LTX-2.3 as cheaper V2/V3 options | ≈ $0.35 | 1 h |
