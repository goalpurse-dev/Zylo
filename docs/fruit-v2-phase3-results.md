# AI Fruit Story v2: Phase 3 results (stages 3b–3i + a full 30 s story)

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
| 3f final video on Fly.io | $0.10 | $0.001 |
| 3g series (3-episode plan + episode 1 pictures) | $0.30 | $0.127 |
| 3i framing fix check (2 pictures) | $0.10 | $0.069 |
| **Phase 3 total** | **$4.00** | **$3.37** |
| Full 30 s V2 story (approved outside the $4) | $2.00 | $1.782 |

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
- **Framing:** fixed in two steps. (1) Speaker-first staging (3i): the speaker in front,
  facing the camera, listeners behind and smaller; heads went from ~22–28% to ~33–36% of the
  frame. (2) After the 30 s story: "medium two-shot" still produced full-body shots and
  "over-the-shoulder" drew the foreground listener as a human, so the shot text now says
  "chest up, never full body" and names the listener's fruit head. (2) is tested offline only.
- **Wan audio:** Wan's docs promise ambient audio only; in practice it spoke the dialogue in
  all 4 Wan clips so far (bake-off + confirmation), transcripts exact.
- **Provider balance:** handled (see below). Not yet seen live: the guard was tested offline.

## Prices (applied 2026-09-30, migration 20260930162500)

Rule: ~50% margin at our cheapest credit (Starter yearly, $16 / 750 = **$0.02133**) after ~10%
overhead for failed work. The `$0.02` `CREDIT_RETAIL_USD` in `src/lib/pricing.ts` is a legacy
constant; no product sells a credit that cheap.

| Item | Real cost | Price | Margin at $0.02133 |
|---|---|---|---|
| Picture / edit / regenerate | $0.035 | **4 cr** | 55% |
| V2 clip, Wan2.6 Flash | $0.050/s | **5 cr/s** (owner's choice) | 48% (Seedance fallback clips: 16%) |
| V3 clip, Seedance 2.0 Mini | $0.082/s | **9 cr/s** | 53% |
| V4 clip, Veo 3.1 Fast | $0.15/s | **16 cr/s** | 52% |
| Story writing, series plans, final video | ≈ $0.001–0.02 | free | absorbed |

Default story length in the UI is 20 s (15 s–2 min, 5 s steps). The UI's cost card and every
price chip read these rows through `useToolPriceQuotes`; per-second rows make every clip price
exact (CEIL(rate × seconds)).

## Stages 3f–3i

- **3f final video (Fly.io):** `render-worker/src/fruitFinal.mjs` in the Long Form image (tag
  `zyvo-render:fruit-final`), one performance-4x machine per final, auto-destroyed. Trims each
  clip's leading/trailing silence (keeps 0.25 s), normalizes to 720p30 + loudness, burns in the
  exact lines as captions (Lilita One), joins, uploads to a one-time signed URL, reports with an
  HMAC token. Holds no Supabase key. Test: 15 s of clips → 11.1 s final in 24 s, $0.001.
  Expected: ≈ $0.001–0.002 per final, ≈ $1–2/month at 1,000 finals.
- **3g series:** `createSeriesPlan` (free, Sonnet 5, validated, one repair) writes title, logline,
  a bible with fixed roles, and N episodes with cliffhangers. Episodes unlock in order; an
  episode is written from the bible, earlier episodes, its own plan, picks up the last
  cliffhanger and lands its own. Test: 3-episode plan ($0.011) + episode 1 at 15 s with pictures.
- **3h UI:** the v2 UI runs on the real backend for flagged users (`supabaseAdapter.js`):
  realtime story updates with a poll fallback, Preview banner only on the dev mock, Recent shows
  real stories plus earlier-version (v1) stories read-only. QA: signed-in Playwright pass at 1440
  and 390 px (Recent, final, v1 story, settings cost card, series plan/roadmap/episode board).
- **Out-of-credit guard:** a provider refusal for OUR balance (Runware, Anthropic, OpenAI) is
  refunded at once (no retries or fallback) with "short break, you weren't charged"; new paid
  steps are refused before charging for 10 minutes after a refusal; one alert row per provider
  (`fruit_provider_alerts`) and an admin email when an alert opens.
- **3i framing:** see Known issues.
- **Prompt fixes:** no doubled names ("Gloria Grape Gloria freezes"); the 170 library voices now
  describe only how a voice sounds, and the clip prompt says "in her <voice> voice, delivered in
  a <emotion> tone".

## Full 30 s story on V2 (results page: https://claude.ai/artifact/MBspxtJnYFfBBqbuSh6j5H)

- Random 3-character idea ("The IT guy reads everything": Ken, Rick, Linda) → "Ken Reads
  Everything": 6 scenes, 31 s of clips → **26.2 s final** (4.9 s of silence trimmed), captions on.
- **Real cost $1.78** (script $0.017, pictures $0.207, clips $1.553, final $0.001).
  **179 credits** charged → $3.82 at the cheapest credit → **53% margin**. 3.6 min wall clock
  (script 12 s, pictures 36 s, clips 126 s, final 23 s). 6/6 clips on Wan, no fallback, no retries.
- Transcripts: 5/6 exact; the 6th is a speech-to-text homophone ("scent mail" for "sent mail").
- Weak spots, all from the pictures: scenes 1 and 6 came out full body (small faces, weak lip
  read); scene 5 (over-the-shoulder) drew a human listener and Linda's face drifted. Builder fixed
  after the run (tested offline). The clip model also drew an Apple logo on a laptop.

## Launch checklist (what's left)

| # | Task | Est. API cost | Est. time |
|---|---|---|---|
| 1 | Re-check framing on 3-character "medium two-shot" / "over-the-shoulder" scenes (builder fixed after the 30 s story, tested offline) | ≈ $0.07 | 1 h |
| 2 | Owner test by hand on the flagged account (single, series, edits, regenerate, final, download) | your usage | 1 h |
| 3 | Rollout: `fruit_v2` for internal testers, then everyone; remove v1 and its tool keys once no v1 jobs remain | $0 | 0.5 day + watch |
| 4 | Optional: V3/V4 30 s stories (≈ $2.7 / $4.7); Seedance 480p and LTX-2.3 tests (≈ $0.35) | as listed | 2 h |
