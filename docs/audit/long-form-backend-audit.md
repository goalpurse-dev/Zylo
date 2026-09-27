# Long Form "Classic Flat Stickman" Backend Audit

**Scope**: read-only. No code, schema, or data changes were made while producing this document; no provider/API calls were made; the one real project example below was read via SELECT-only queries.

## Executive summary

1. **Two parallel pipelines exist in this codebase, and only one is reachable from the live "Create New Video" page.** The "legacy/documentary" pipeline (Research → Script → Visual Plan → Visual World → Scene Generation → QA) is fully built and has produced real videos' worth of scene images. The newer "Stickman narration-first" pipeline (Script → real TTS with word alignment → Narration) is what `ProductionSetup.jsx` actually creates today, and it **stops after Narration** — its own `visuals.jsx` screen states in its own copy that visual planning, image generation, and rendering "are not built yet."
2. **No final video is ever assembled, in either pipeline.** No FFmpeg, no Remotion, no render API — confirmed by exhaustive grep. The product produces separate scene images and a separate narration MP3; nothing stitches them into a playable video.
3. **The frontend's only selectable visual style, "Classic Flat Stickman," has no real backend implementation.** `supabase/functions/_shared/visualRecipe.ts` says outright: *"Skeleton only — no recipe implements this yet, and nothing calls it yet."* The legacy pipeline that actually renders images uses a completely different, unrelated style catalog (`stylePresets.js`/`visualWorldStyle.ts`) that shares zero IDs with what the UI offers.
4. **There is a real, live billing bug.** "Generate video" immediately debits the user's full quoted credit balance via `reserve_long_form_project_credits`. The functions that would later settle or refund the unused portion (`settle_long_form_reservation`, `release_long_form_reservation`) are defined but **called from nowhere in the codebase**. Every reserved credit is currently permanent, contradicting the UI's own "Maximum charge — unused credits are released" copy.
5. **Scene/beat timing is a 150-words-per-minute estimate everywhere it's used**, despite real, working, tested word-level TTS alignment (`_shared/ttsAlignment.ts`) existing and being stored. The consumer that would use real timing (a "Beat Director") doesn't exist yet, so the accurate data is captured and thrown away.
6. **Niche and Visual Style have no wired effect on the actual script text.** Only the free-text Topic field and (indirectly) Length/Depth influence the script-writing prompts; niche is stored in a catch-all JSON snapshot and never read back.
7. **TTS is the single largest cost line (~$2.5+ of a ~$3.6-4.0 total per 10-minute video) and is the one number the code itself admits is a guess** — ElevenLabs returns no cost field, so Zyvo fabricates a per-character estimate.
8. **The QA/repair-ladder system for images is mature and well-engineered**, with real anti-infinite-loop bounds and calibration tuned against a real 136-shot production run — but it lives entirely in the orphaned legacy pipeline.
9. **15 pre-existing failing tests**: 8 are a fully unrelated feature (30 Days). Of the remaining 7 (Long Form/Visual World), 2 are stale tests for intentionally-changed behavior, 1 is cosmetic copy drift, and at least 3 look like genuine live bugs in shared infrastructure the current pipeline depends on.
10. **Two independently-maintained pricing tables disagree** (`src/lib/providers.ts` vs. `_shared/sceneGenerationPricing.ts` / SQL pricing functions) on V4 and EDIT tier credit costs — a real, quotable inconsistency, not a hypothetical.

---

# PART 1 — CURRENT STATE

## 1. Entry point & orchestration

### What happens on "Generate video"

`handleGenerateVideo` (`src/pages/workspace/long-form/ProductionSetup.jsx:1348-1402`) is a **two-call sequence**:

**Call 1 — `createLongFormProject`** (`src/pages/workspace/long-form/project.js:23-54` → `supabase/functions/create-long-form-project/index.ts`):
```js
{ discoverySessionId, topic, source: "custom", selectedIdea: null,
  lengthMode: "custom", customLengthMinutes: lengthMinutes,
  depthMode: "custom", customExplanationDepth: explanationDepth,
  onScreenTextDensity, initialStatus: "draft" }
```
Server validation: `discoverySessionId`/`topic` required, topic ≤2000 chars, length clamped to [5,20] minutes, depth whitelisted to `simple|balanced|deep`, text density whitelisted to `minimal|balanced|frequent`. Idempotent via a unique constraint on `discovery_session_id` — a duplicate insert just reads back the winning row. Creates the project at `status: "draft"`, invisible in the user's project list. **No credits move here.**

**Call 2 — `createProductionSetup`** (`productionProfile.js:35-63` → `supabase/functions/create-long-form-production-setup/index.ts`):
```js
{ projectId, visualRecipe: selectedStyle.visualRecipe, recipeVersion: selectedStyle.recipeVersion,
  renderTier, targetDurationMinutes: lengthMinutes, explanationDepth,
  voiceProvider: "elevenlabs", voiceId: voice.voiceId, voiceModel: voice.voiceModel, niche: nicheId }
```
`recipeVersion` must be a key in a hardcoded map — **only one is registered**:
```ts
const RECIPE_BEATS_PER_MINUTE: Record<string, number> = { STICKMAN_DOODLE_EXPLAINER_V1: 15 };
```
Any other value is rejected as "Unknown recipe version."

### Credit mechanism — a real, immediate debit, not a hold

This function computes a deterministic quote (`_shared/longFormProjectQuote.ts`: beats = minutes × 15, minus 12% assumed zero-cost reuse, plus 15% bounded-retry uplift, credits = renders × {v2:2, v3:3, v4:4}), freezes a `long_form_generation_profiles` snapshot, then calls `reserve_long_form_project_credits`, which **immediately runs `update profiles set credit_balance = credit_balance - p_reserved_credits`** and inserts a `long_form_project_reservations` row (`status='reserved'`). Idempotent per profile; a changed profile gets a clean `409` instead of double-reserving. On success the project flips `draft → planning`, which is the moment it becomes visible in the user's project list.

**Confirmed bug**: the UI tells the user "Maximum charge — unused credits are released" (`ProductionSetup.jsx:1446`). The settle/release RPCs that would make that true exist (`settle_long_form_reservation`, `release_long_form_reservation`) but a full grep of `supabase/functions` and `src/` found **zero call sites** for either. `delete-long-form-project` only sets `deleted_at`; it never touches the reservation. Every credit reserved today is permanently gone regardless of what actually gets produced.

**Second billing gap**: `commit_long_form_reservation_spend` (the mechanism that should draw down *against* the reservation) is wired into episode/sample-generation charges only — not into `retry_long_form_scene` or scene-edit charges, both of which still do a bare `update profiles set credit_balance = credit_balance - price`. Since the reservation already removed the full quoted amount up front, every Retry/Edit afterward is billed **again, on top of** the reservation.

### Orchestration technology

Not a generic job-queue-driven pipeline at the stage level — it's **chained edge-function self-invocation with a per-minute cron safety net**. Pattern, identical across Research/Script/Visual Plan/Visual World/Scene Generation: a `start-long-form-<stage>` function creates/claims a version row and fires `EdgeRuntime.waitUntil(fetch(advance-long-form-<stage>))` (fire-and-forget), then returns to the client immediately — built specifically because an earlier synchronous version hit Supabase's 150s gateway timeout on real production runs. Each `advance-*` function claims one row via `SKIP LOCKED`, does one stage's work, checkpoints, and self-dispatches again if not terminal. The client only ever polls the version row; it never calls `advance` itself.

Five `pg_cron` jobs (each firing its stage's `advance-*` endpoint every minute with an empty body) act as a recovery sweep for anything a self-chain call dropped:
```
long-form-research-advance          */1 * * * *
long-form-visual-world-recovery     * * * * *
long-form-visual-plan-recovery      * * * * *
long-form-script-advance            */1 * * * *
long-form-scene-generation-recovery * * * * *
```

**Stage sequence as actually implemented**:
1. **Story Plan** — `generate-long-form-story-plan`, synchronous (2 AI passes in one HTTP response). Sets `status='story_ready'` or `'planning_failed'`.
2. **Research** — `start/advance-long-form-research`, stages `planning → initial_search → initial_extraction → coverage_review → gap_search → final_extraction → final_coverage_review → finalizing`.
3. **Script** — `start/advance-long-form-script`, stages `draft → critic → (revision) → finalizing`.
4. **Fork on recipe** (`script.jsx:739`: `isStickmanRecipeProfile(profile) ? handleLockStory : navigate(".../look")`):
   - **Stickman** (the only reachable path today): Lock Story → **Narration** (`generate-long-form-narration-audio`, one ElevenLabs call) → **Visuals** (a "proof screen," see §8) → **Edit** (route doesn't exist).
   - **Legacy** (orphaned from the current UI): Look (Visual Plan) → Visual World → Generate (scene compile + render + QA).

The generic `jobs`/`job-worker` system is reused only as the **leaf-level** provider dispatcher for actual Runware image calls inside scene/reference-asset generation — it is not the pipeline orchestrator.

### Retries, idempotency, partial failure

`MAX_STAGE_ATTEMPTS = 3` uniformly, linear 15s/attempt backoff, no self-dispatch on failure (waits for the next cron tick). `stage_attempt` is incremented **atomically inside the claim itself** — fixed after a real incident where a worker disappeared mid-call before its own error handler ever ran, leaving a row silently re-claimed forever. Each claim function also "reaps" zombie rows (exhausted attempts + expired lock → forced `failed`).

Double-charge protection is enforced with real constraints, not just application logic: a partial unique index (`one_active_per_project`) plus a deterministic `idempotency_key` on episode charges; a `request_hash` (script + every voice setting) on narration audio so an identical lineage never re-calls ElevenLabs. `retry_long_form_scene`'s own migration header documents a real near-miss: an early version of the "free retry" branch would have double-charged 13 real scenes for work the provider never actually attempted, fixed by distinguishing "job row exists but provider never accepted it" (free reset) from "job genuinely ran and failed" (new charge).

Partial failure surfaces via status fields, never a generic blob: version rows move to `needs_attention`/`failed` with `last_error_code`; scenes distinguish `status='failed'` (provider failure, auto-refunded) from `status='succeeded', qa_status='rejected'` (a real image was made, QA didn't like it — **charge stands**).

### Progress to the UI

**No Supabase Realtime is used anywhere in Long Form** (confirmed by grep — zero `.channel(`/`postgres_changes` usage). Every page polls plain `supabase.from(...)` on a `setTimeout` loop: `generate.jsx` uses an **adaptive** interval (4s while any scene is pending/running, 15s once settled); `research.jsx`/`script.jsx` use a fixed 3s poll with backoff on repeated errors.

The Story→Narration→Visuals→Edit stepper itself does no fetching — `deriveProjectStageInfo` (`projectStage.js:76-117`) is a pure client-side derivation over whatever `project` row is already in state, precedence: (1) the authoritative `long_form_project_resume_state` RPC if present, (2) "active work" rows from three extra bulk queries, (3) the furthest-set `current_*_version_id` pointer. `humanizeProjectStatus` collapses everything into exactly 7 user-facing labels (Writing script / Ready to review / Generating visuals / Needs your review · N / Rendering / Done / Failed).

### Status enums

All are plain `text` columns with a comment, **not enforced by a Postgres `CHECK` constraint** (except where noted) — the DB will accept a typo'd status string.

| Table.column | Values | Notes |
|---|---|---|
| `long_form_projects.status` | `draft, planning, story_ready, planning_failed` | No CHECK; **no terminal "video complete" value exists anywhere** — a project row never reflects "the video is done." |
| `long_form_research_versions.status` / `.stage` | `researching→ready\|needs_attention\|failed` / `planning→...→finalizing` | |
| `long_form_script_versions.status` / `.stage` | `drafting→ready\|needs_research\|needs_attention\|failed` / `draft→critic→revision→finalizing` | The migration's own comment lists only 3 of the 4 status values — `needs_attention` was added later in code without updating the SQL comment. |
| `long_form_visual_plan_versions.status` | `planning→ready\|failed` | Legacy-only |
| `long_form_visual_world_versions.status` | `planning→generating→ready\|needs_attention\|failed` | Legacy-only |
| `long_form_scenes.status` / `.qa_status` | `pending→running→succeeded\|failed` / `null\|approved\|rejected` | Legacy-only |
| `long_form_episode_generation_charges.status` | `charged\|refunded\|superseded` (CHECK) | Legacy-only |
| `long_form_project_reservations.status` | `reserved\|settled\|released` (CHECK) | **`settled`/`released` are dead states** — never reached (see billing bug above) |
| `long_form_generation_profiles.status` | `active\|superseded` (CHECK) | |
| `long_form_production_bibles.status` | `draft\|frozen\|superseded` (CHECK) | |
| `long_form_narration_audio_versions.status` | `generating\|ready\|alignment_failed\|failed` (CHECK) | Live, Stickman-specific |

## 2. Data model

20+ Long-Form-specific tables. ER sketch (→ = foreign key):

```
long_form_discovery_sessions ← long_form_projects
long_form_projects ← long_form_story_plan_versions
long_form_story_plan_versions ← long_form_research_versions ← long_form_research_sources
long_form_story_plan_versions, long_form_research_versions ← long_form_script_versions
  (script_document jsonb holds narrationSegments — no separate segments table)
long_form_script_versions ← long_form_visual_plan_versions              [legacy]
long_form_visual_plan_versions, long_form_script_versions ← long_form_visual_world_versions [legacy]
long_form_visual_world_versions ← long_form_reference_assets, long_form_scene_reference_bundles [legacy]
long_form_visual_world_versions, long_form_visual_plan_versions
  ← long_form_scene_render_plans ← long_form_scenes → jobs             [legacy]
long_form_projects ← long_form_generation_profiles ← long_form_project_reservations
long_form_generation_profiles, long_form_script_versions ← long_form_production_bibles
long_form_script_versions ← long_form_narration_contract_versions, long_form_narration_audio_versions
long_form_projects, long_form_visual_world_versions, long_form_visual_plan_versions
  ← long_form_episode_generation_charges ← long_form_chapter_generation_charges  [legacy]
long_form_scenes, long_form_projects ← long_form_scene_operation_charges         [legacy]
```

Key tables:
- **`long_form_projects`** — root row. `discovery_session_id` (unique, the idempotency key), `current_*_version_id` pointers for story plan / research / script / visual plan / visual world.
- **`long_form_script_versions.script_document`** (jsonb) — `{title, narrationSegments[], chapters[], openLoops[], actualWords, estimatedDurationSeconds, researchWarnings, qualitySummary}`. Each `narrationSegments[]` entry doubles as the visual contract carrier: text + `visualIntent/mustShow/mustNotShow/entities/locationHint/continuityEntityIds/exactTextOverlay/preferredVisualForm`.
- **`long_form_visual_plan_versions.visual_plan`** (jsonb) — `{entityRegistry, continuityGroups, visualBeats, visualPayoffs}`. **Entities live inside this JSON blob, never a normalized `entities` table.** *Legacy-only — unreachable from the current Stickman flow.*
- **`long_form_scenes`** — one row per render *attempt* (mirrors `long_form_reference_assets`' design), `replaces_scene_id` self-FK forms the retry/edit history chain. *Legacy-only.*
- **`long_form_narration_audio_versions`** — the real, live, Stickman-specific TTS artifact: `audio_url`, `raw_provider_alignment` (verbatim ElevenLabs payload), derived `narration` (per-segment word timings).
- **No dedicated credit ledger table exists anywhere.** `profiles.credit_balance`/`credits_spent_today` are mutated in place by four separate, not-fully-consistent tables (`long_form_project_reservations`, `..._episode_generation_charges`, `..._chapter_generation_charges`, `..._scene_operation_charges`) rather than one immutable ledger. A migration comment even references a `generation_credit_ledger`/`deduct_credits` pattern used by *other* Zyvo products that Long Form deliberately doesn't use.

A significant chunk of this schema — everything tagged **[legacy]** above (Visual Plan, Visual World, Reference Assets, Scene Render Plans, Scenes, Episode/Chapter charges) — is fully built, has real production history, and is **currently unreachable** from `ProductionSetup.jsx`, since only `STICKMAN_DOODLE_EXPLAINER_V1` is a registered recipe and the Stickman flow never invokes any of it.

## 3. Stage A — Script / Story

Two distinct AI stages, both OpenAI Responses API, `gpt-5-mini`, `store: false`, strict `json_schema` outputs:

**Story Plan** (`generate-long-form-story-plan/index.ts`) — Pass A "Topic Understanding" classifies the topic into narrative primitives (mechanism/process/mystery/lived_experience/survival/chronology/rise_and_fall/cause_effect/misconception/hypothetical/comparison/biography/...) and recommends length/depth; Pass B "Narrative Director" turns that into a title, viewer promise, hook concept, and 5-9 chapters, banning generic titles ("The Fascinating World of...") and generic chapter names ("Introduction"/"Conclusion"). Both passes are explicitly forbidden from inventing facts — anything needing verification goes into `researchNeeds` for the separate Research stage.

**Script Engine** (`advance-long-form-script/index.ts`) is what actually writes narration prose — a durable `draft → critic → (revision) → finalizing` stage machine. The Draft prompt (quoted in full in the underlying research) is unusually detailed: it demands evidence discipline (every factual claim must cite a `factId` from the supplied evidence pack; weak-coverage chapters must be flagged into `insufficientEvidenceChapterIds` rather than filled with invented material), a hard **"never expose the process"** rule (a viewer must never hear "script," "research," "sources," or any self-referential language), voice-for-speech guidance, anti-repetition rules, and per-segment visual metadata that doubles as input to later visual planning.

**Length enforcement — genuinely measured, not just trusted.** `computeActualWords()` counts real words from the generated `narrationSegments[].text` (never the model's own self-reported `estimatedSeconds`, after a real incident where a 1,252-word script's self-reported segment durations summed to a false "full 15 minutes"). A soft ±15% tolerance check feeds the Critic; a hard 75% floor (`HARD_MIN_LENGTH_RATIO`) triggers exactly one bounded length-expansion LLM call; if that still fails validation, the pipeline falls back to the last known-good document rather than looping or discarding.

**Flagged**: two independent WPM constants exist and disagree — `WORDS_PER_MINUTE = 150` (both story-plan and script-engine, the real generation target) vs. `WORDS_PER_MINUTE_ESTIMATE = 145` (frontend-only display copy in `lengthEstimates.js`, explicitly documented in a code comment as a known, deliberate, unfixed discrepancy). The 145 figure never reaches the backend.

**Quality checks — real and deterministic, plus one hard LLM gate**: `findRepeatedNGrams` (any 6-word phrase repeated), `findRepeatedOpeners` (a formulaic transition used ≥3 times), `findSlopPhrases` (an 11-phrase banned list: "have you ever wondered," "in today's video," "let's delve into," etc.), and — the strongest gate in the file — `findMetaLanguage`, a hard-error regex bank (e.g. `/\bthis script\b/i`, `/\bfact[\s-]?graph\b/i`, `/\bol_[a-z0-9_]+\b/i` for leaked internal IDs) that **blocks "ready" outright** on any match, regardless of factual quality. Chapter-set fidelity to the Story Plan is a hard, code-enforced invariant. Cold-open quality, rhetorical-question cadence, and "does the ending pay off" are **entirely LLM-judged** with no deterministic backstop; an unresolved open loop is only a warning.

**Settings' actual influence**: Topic (free text) flows straight into the Topic Understanding prompt. Length/Depth resolve into `target_words` and are named explicitly in the Story Plan prompt — but **explanation depth is never read by the Script Engine's Draft/Critic/Revision prompts at all** (confirmed by direct grep); "Brief vs. Deep" only shapes chapter count/word budget two stages earlier, never sentence-level technical density at write time. **Niche and Visual Style have zero influence on script/story-plan generation** — niche is stored only inside `long_form_generation_profiles.raw_setup_snapshot`, an explicitly-documented "everything else" bucket never read back by generation.

## 4. Stage B — Narration / Voiceover (TTS)

**Provider**: ElevenLabs, a real live call — `_shared/stickman/narrationAudio.ts:53-63`:
```ts
const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
  method: "POST",
  headers: { "xi-api-key": key, "Content-Type": "application/json" },
  body: JSON.stringify({ text, model_id: voiceModel, voice_settings: voiceSettings }),
});
```
Default voice settings: `{ stability: 0.48, similarity_boost: 0.75, style: 0.12, use_speaker_boost: true, speed: 0.92 }`. Voice catalog (`narration.js`) is 4 fixed voices, all model `eleven_flash_v2_5` (Josh/Rachel/Bella/Antoni). **The file's own comment admits the live preview/catalog feature is currently broken** — "the ELEVENLABS_KEY secret is currently invalid" — a live operational issue documented in-code, not simulated.

**One file, not per-segment**: all `narrationSegments[].text` are joined with a single space and sent as **one** ElevenLabs call — confirmed at `generate-long-form-narration-audio/index.ts:123-125`. There is no ffmpeg concatenation anywhere because nothing needs joining.

**Timestamps — real, and genuinely used, contradicting the assumption they might not be.** ElevenLabs' `/with-timestamps` endpoint returns character-level alignment (`characters[]`, `character_start_times_seconds[]`, `character_end_times_seconds[]`), which `_shared/ttsAlignment.ts` collapses into word-level timing (`{word, start, end}`) and then deterministically slices back onto the script's own segment boundaries (by word count) into `NarrationSegmentTiming { segmentId, startSeconds, endSeconds, wordCount, words[] }`. If the segments' word count doesn't exactly match the aligned total, the function fails closed with an exact error code rather than silently mis-timing. The raw provider payload is preserved verbatim in `long_form_narration_audio_versions.raw_provider_alignment`, so re-mapping never needs a new provider call.

**The catch**: this real per-word data is **not yet consumed downstream**. `get-long-form-beat-director-readiness` explicitly feeds "the (not-yet-built) Beat Director." Meanwhile `_shared/visualRecipe.ts` (from the same engineering pass) still says "Long Form has NO real per-word TTS today" — the codebase's own internal comments are already stale relative to each other. Every scene/chapter duration shown anywhere in the product today is still the 150-wpm estimate, not this real data.

**Billing**: TTS cost is absorbed internally — `credits_charged` stays 0 for narration; an *estimated* $0.0003/character cost is recorded for internal accounting only, since ElevenLabs' endpoint returns no real cost field.

## 5. Stage C — Segmentation (narration → scenes/beats)

Four layers, mixing LLM and deterministic code (this describes the **legacy** pipeline — the only one that produces scene-level records at all today):

1. **Macro segmentation (LLM, "Visual Director," `gpt-5-mini`)** — one call per chapter for long scripts. The prompt explicitly forbids a fixed "new image every N seconds" rule, asks for beats that track a `baseSetupKey` to minimize expensive re-generation, and targets roughly 3-8s cuts in high-information sections up to 12-20s holds for emotional beats.
2. **Deterministic clause splitting (regex, no LLM)** — `visualShotPlanning.js` splits each macro's narration into finer ranges at sentence/clause punctuation (`/[.!?](?:[""']?)(?=\s+[A-Z]|$)|;|\s[—–]\s|,(?=\s+(?:then|while|before|after|but|so|because|...))/g`). The module's own header documents a real prior failure — an 11-word idea chopped mid-phrase across 5 separate ranges.
3. **Deterministic timing** — `WORDS_PER_MINUTE = 150` again, the same estimate as Stage A, **not** the real TTS alignment from Stage B.
4. **Semantic claim extraction (LLM, "Narration Visual Contract," `gpt-5-mini`, mandatory)** — extracts one CLAIM per distinct idea, with first-class negation handling (anything the narration says did *not* happen populates `forbiddenVisualFacts`), and requires `narrationText` to be an exact verbatim substring, never a paraphrase.

**What a final shot-level record stores**: `id, narrationSegmentIds (always exactly one), narrationRanges [{segmentId, startChar, endChar}], shotNarrationText, narrationClaimId, primarySubject, continuityRequirement, estimatedStartSeconds/EndSeconds, informationToCommunicate, visualType, shotSize, shotStrategy, renderMethod, baseSetupKey, motionSuggestion, timingSource: "narration_estimate", requiresAudioReconciliation: true`. Persisted as a `long_form_scene_render_plans` row — but the DB row itself has **no column for the exact text/character-offset slice**; it only lives inside the parent plan's JSON blob, addressable by `visual_beat_id` — a real, if minor, normalization gap.

**Coverage guarantee — does NOT exist as specified.** The closest mechanism (`validateVisualPlan`) checks only that every narration segment *ID* is referenced by *some* beat (a **warning**, not an error) plus that total plan duration is within 10% of the script's estimated total (a **hard block** only past that threshold). Neither checks per-character exactness, gaps, or duplication within a segment. A separate fuzzy word-overlap matcher (`matchClaimToRange`, threshold 0.4) attaches semantic claims to ranges but silently falls back to a weaker heuristic on a failed match rather than blocking anything.

**`requiresAudioReconciliation: true` is stamped on every beat and never read anywhere else in the codebase** — dead intent, not a real reconciliation step.

**Typical scene count (10-min video)**: real production evidence (a 13.5-minute, ~810s episode) produced 115 visual beats — roughly 7s/beat. Extrapolated to 10 minutes: **~80-90 scenes**. Separately, the not-yet-live Stickman pipeline's own cost-quote code assumes **15 beats/minute** (`RECIPE_BEATS_PER_MINUTE`), i.e. ~150 scenes for 10 minutes — nearly double the real legacy-pipeline rate, and the two numbers are never reconciled anywhere.

## 6. Stage D — Visual planning & prompts

**This is the section with the single largest, best-evidenced finding in this audit.**

### Two completely disconnected style systems

The **live/legacy** system uses a fixed, non-LLM-authored catalog of 6 style presets (`_shared/visualWorldStyle.ts`, `STYLE_PRESETS`, default `bold_cartoon_documentary` = "Classic 2D Documentary"): `bold_cartoon_documentary` ("Classic 2D Documentary"), `simple_outline_explainer` ("Simple Story Cartoon"), `polished_vector_cartoon` ("Bright Modern Cartoon"), `wojak_documentary_hybrid` ("Meme Documentary"), `painterly_storybook_documentary` ("Illustrated History"), `documentary_collage` ("Documentary Collage"). Each is a hardcoded object of `linework`/`shading`/`texture`/`palette`/`negativeConstraints`/etc.

The **frontend** (`src/pages/workspace/long-form/visualStyles.js`) exposes exactly one production-ready style: **"Classic Flat Stickman"**, `recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1"`. Its style rules live in a *different* file, `_shared/stickman/styleContract.ts` — genuinely well-written, e.g. `illustrationStyle: "Simplified stickman/doodle explainer construction — circle heads, dot eyes, stick limbs, mitten hands"`.

**These two catalogs share zero IDs.** Confirmed by direct grep: the string "stickman" does not appear anywhere in `visualWorldStyle.ts`. Confirmed further: `ProductionSetup.jsx`'s actual `createProductionSetup(...)` call (line 1379-1390) sends `visualRecipe`/`recipeVersion` but **never sends `visualStylePreset`** — the field the legacy system's 6 real presets are selected by. And `_shared/visualRecipe.ts` (the interface `STICKMAN_DOODLE_EXPLAINER_V1` is supposed to implement) says, in its own header comment: *"Skeleton only — no recipe implements this yet, and nothing calls it yet... the existing 'legacy' documentary/cinematic path... is NOT being refactored into this shape by this pass — it keeps working completely unchanged."*

**Net effect**: selecting "Classic Flat Stickman" on the Create New Video page has **no effect whatsoever** on what would actually be rendered if the legacy pipeline ran — and the Stickman pipeline that *does* honor that recipe has no scene-generation implementation to run at all. This is directly confirmed by a real project: the Atlantis example below was generated under `"STYLE LOCK — Classic 2D Documentary"` — the legacy catalog's default — with no trace of stickman/doodle language anywhere in its real prompts.

### Production Bible / per-project cast & settings (both systems)

**Live system's "Reference Planner"** (`advance-long-form-visual-world/index.ts`, `gpt-5-mini`) writes a canonical appearance spec per entity detailed enough for consistent re-rendering, with an explicit cast-differentiation rule ("do NOT make two characters differ ONLY by hair color or shirt color... differ across MULTIPLE high-salience identity dimensions").

**Stickman system's "Production Bible"** (`build-stickman-production-bible/index.ts`, `gpt-5-mini`) does the analogous job for the unused pipeline — genuinely good, tested output (a real fixture): *"Elder woman leader: stickman-figure with a slightly hunched stance, warm medium-dark skin tone... wears layered hide tunic... She carries no metal tools — instead a simple wooden staff,"* with an explicit `forbiddenMutations` list. `mergeDraftIntoBible` deterministically injects the fixed recipe's universal traits and merges in only the LLM's episode-specific fields — the same "code owns the fixed part, LLM owns the variable part" pattern as the live system. **This whole subsystem works and is tested, and produces nothing usable today** because nothing downstream consumes a frozen Bible.

### Prompt compiler

Deterministic string-template code, `compileScenePrompt` (`_shared/sceneRenderPlan.ts:434-489`), fixed section order `[SCENE TASK] → [STYLE LOCK] → [VISUAL PURPOSE] → [SUBJECT] → [COMPOSITION] → [ACTION/STATE] → ... → [FORBIDDEN ELEMENTS]`, with a budget-aware section-dropper that fails outright past 3500 characters. Canonical character/location text is inserted **word-for-word**, never re-described per scene. A narrow "Scene Director" LLM only supplies a few per-shot fields (camera framing, focal subject, overlay text) — it never composes the prompt itself.

**Entity-ID leak prevention exists but is fragile**: `promptNeverLeaksRawEntityId.test.mjs` tests a real, documented production bug (on the Atlantis project itself) where an unresolved raw entity ID reached the `[SUBJECT]` line and the image model "invented an unrelated figure to fill the gap." The fix (`compileEpisodeBeat`'s `displaySubject` resolution) is applied in **two independent places**, not one structural guarantee — a sign the underlying data model (a field that sometimes holds a raw ID, sometimes a name) is itself fragile.

### On-screen text policy — two disconnected settings, again

The **live** setting (`project.on_screen_text_density`) genuinely changes prompt routing: `minimal` biases beats toward plain story illustration; `balanced`/`frequent` more readily route the same narration to `PROGRAMMATIC_GRAPHIC` — which **skips the image model entirely** and renders a deterministic text-overlay spec in code instead. In one real 136-scene episode, 28 of 136 "scenes" were `PROGRAMMATIC_GRAPHIC` (no provider call at all).

The **Stickman** setting (`onScreenTextGuidance.js`) shares the identical three-tier vocabulary but its own header says: *"This is guidance metadata only... Nothing here enforces anything yet"* — a second, inert copy of the same idea for a consumer that doesn't exist.

### Real example prompts (verbatim, from a real production run)

```
[SCENE TASK]
character moment shot for a 2D animated documentary. This is a finished cinematic scene, NOT a
character reference sheet or model sheet — do not arrange multiple views/panels, do not use a
plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary: Bold 2D illustrated documentary style — thick confident
outlines, rounded cartoon forms, and a restrained flat-shaded palette. Do not: not
hyper-realistic / photographic; not childish preschool cartoon; not generic corporate flat
vector art; no 3D-render look; no anime/manga stylization.

[COMPOSITION]
Shot size: CLOSE. Tight close from slightly above eye level on the bunk corner so the rising
band of blue-white light along the wall and the protagonist's sleepy silhouette are visible.
Focal point: the band of blue-white light rising along the wall and the waking bunk.
```
This exact scene was, in production, **QA-rejected** for `IDENTITY_DRIFT` ("Location does not match the habitat living module reference image") and readable on-screen text leaking into the frame despite the style lock explicitly forbidding it — real, direct evidence that prompt-compiler discipline alone does not guarantee QA success.

## 7. Stage E — Image generation

**Model per tier** (`_shared/sceneRendererTiers.ts`, legacy pipeline only):

| Tier | Model | Runware tag | costUSD | credits (product) |
|---|---|---|---|---|
| V2 Fast | FLUX.2 Klein 9B KV | `runware:400@6` | $0.00169 | 2 |
| V3 High Quality (default) | Kling IMAGE O3 | `klingai:kling-image@o3` | $0.028 | 3 |
| V4 Ultra | Seedream 5.0 Lite | `bytedance:seedream@5.0-lite` | $0.035 | 4 (see pricing drift below) |
| EDIT (all tiers) | Qwen Image Edit Plus | `runware:108@22` | $0.009 | 1 (see pricing drift below) |

The V4 model's own code comment discloses it was previously *mis-registered* as "Seedream 5.0 Pro" with a "guessed, never-verified price" before a correction. Resolution is locked to 16:9 via a per-model approved-dimensions table, built specifically after a real incident where an EDIT operation was dispatched at the GENERATE operation's dimensions and Runware rejected it outright (`"Image width must be an integer value between 512 and 2048"`).

**Reference images**: Kling (the default V3 renderer) only accepts **1** reference slot, but real scenes routinely need 2-5 canonical references — so multiple references get deterministically composited into one collage "reference board" and sent as that single slot. A real incident this caused: *"we had a real final scene literally showing the CHARACTER REFERENCE SHEET"* — the collage layout itself leaking into the output.

**Concurrency**: shared, platform-wide (not Long-Form-specific) — `RUNWARE_IMAGE_MAX_CONCURRENT=8`, `RUNWARE_VIDEO_MAX_CONCURRENT=8`, `RUNWARE_TOTAL_MAX_CONCURRENT=15`, on top of Long Form's own one-scene-per-invocation self-chaining worker.

**Storage**: bucket `generated`. Real provider output → `runware/images/{sceneId}.{ext}`; zero-cost CROP/COMPOSITE/GRAPHIC → `long-form/scenes/{sceneId}.png` / `-overlay.png` / `-geometry-fix.png`. Linked to a scene via `scene_render_plan_id`.

**QA**: a real `gpt-4o-mini` vision check on every GENERATE/EDIT scene (deterministic strategies like REUSE/CROP are auto-approved with no LLM call). The prompt checks 16 distinct fields (character/location identity consistency, reference-sheet-layout detection, cast cloning, text artifacts, style mismatch, corruption). Classification uses a 3-tier severity model (`AUTO_READY`/`SOFT_WARNING` both ship; `HARD_FAIL` blocks) — calibrated after a real over-rejection incident where 52% of a 136-shot episode's "needs review" flags were for text artifacts alone. A bounded style-drift repair ladder (attempt 1 → nothing; attempts 2-3 → reinforce with an extra style reference; attempt 4+ → forced human review) is the **one automatic** repair loop; everything else requires the user to click Regenerate — an explicit design choice to prevent infinite auto-regeneration loops.

**Pricing drift (real, confirmed)**: the SQL pricing function `long_form_tier_edit_credits()` hardcodes EDIT at **2 credits**; `src/lib/providers.ts`'s own registered entry for that same tool is **1 credit**. The authoritative billing path charges roughly 2x what the shared pricing table says the operation is worth. Similarly, `_shared/sceneGenerationPricing.ts` charges V4 at **5 credits** while `providers.ts` implies 4 — this file's own comment admits it's a hand-maintained, non-authoritative mirror of the real SQL.

## 8. Stage F — Editing / Timeline / Render

**There is no code anywhere in this repository that assembles a final video file.** This was independently confirmed by two research passes:
- No `ffmpeg`/`remotion` reference exists anywhere under `supabase/functions` or `src/pages/workspace/long-form`. The only `ffmpeg.wasm` usage in the entire codebase is client-side, in three unrelated tools (`ai-cooking-matic`, `clay-rescue`, `footballer-nationality-swap`) — none touch Long Form.
- `compile-long-form-scenes` only compiles a **render plan** (which model/prompt each scene uses); despite the name, it never touches a video's pixels.
- The route table (`src/App.jsx`) has no `/render`, `/export`, or `/download` route.
- `visuals.jsx` — the current pipeline's terminal screen — says outright: *"This is a proof screen, not the Beat Director. Scene-by-scene visual planning, image generation, and rendering are the next phase and are not built yet."*
- The legacy pipeline's own terminal UI copy is `"Episode visuals ready"` / `"All N visuals are approved and ready to edit into your episode"` — the product's own language admits the *actual editing* happens somewhere else, and that somewhere else doesn't exist in this codebase.

**On-screen duration is word-count-estimated, not audio-measured**, in the one pipeline that produces scenes (150 wpm, the same constant duplicated in three files). A documented real incident shows the resulting drift concretely: a 2,028-word/811s script had per-segment `estimatedSeconds` summing to only 585s, while the Visual Director's own macro-level timestamps summed to a third number, 570s — three different totals for one script. The real per-word TTS alignment that would fix this (§4) is captured and stored but consumed by nothing.

**Motion**: a `motion_intent` text field (e.g. "Gentle pan across the established composition toward the narrated focus") is written at compile time and **confirmed, by full-repo grep, to be read nowhere else in the codebase** — dead, write-only planning metadata. No Ken Burns, no transitions, no background music, no burned-in captions/subtitles exist anywhere in the Long Form pipeline. The only real "motion/overlay" feature is a static, deterministic text/graphic-card compositor stamped onto a still image — not a video effect.

**Output**: per-scene images only, locked 16:9, PNG/JPEG/WebP depending on path; narration is a single MP3. Both are delivered as plain public Supabase Storage URLs — there is no dedicated download/export endpoint for a finished video, because no finished video is ever produced.

## 9. Scene review UI data

Two surfaces, both legacy-pipeline-only (the Stickman flow never reaches a scene-review step):

- **Storyboard step** (pre-image-generation): each card shows shot number, chapter, a word-count-derived time range, a strategy badge, the authored description, and a **quoted narration excerpt** — closer to the target's "Scene N · time · narration text" format.
- **Generate step** (the actual post-image scene-review UI): each card shows the real generated thumbnail, a strategy badge, and a **derived, compiled summary — not the raw narration text**. Per-card time ranges are **not shown**; only sequence-group headers carry a time range.

**"N need review"** fires from an exact, quoted condition (`sceneCardModel.js`):
```js
if (scene.status === "succeeded" && scene.qa_status === "rejected") {
  return { key: "needs_review", label: scene.qa_result?.requiresReview ? "Needs review" : "Needs fix" };
}
```
i.e., generation succeeded but QA rejected it — with the label itself distinguishing an objectively-broken `HARD_FAIL` ("Needs fix") from a genuinely ambiguous human-judgment case ("Needs review"), a distinction added specifically because the UI previously implied a judgment call even when there wasn't one to make. A scene whose QA is still pending (`qa_status: null`) is deliberately *not* counted in this bucket.

## 10. Real example project

Two candidate projects exist in the live database; both were queried read-only.

**"What Really Happened to the Lost City of Atlantis?"** (`e7a6fd5e-0d3d-416e-8e44-02d52491000b`, created 2026-09-21, `status: story_ready`):
- Script title: *"Plato's Atlantis: Reading the Text, Testing the Sites, and Separating Evidence from Fantasy"* — 1,372 actual words, 549s estimated duration (implying ~150 wpm, matching the code constant exactly).
- First narration segment (verbatim, `seg01`, chapter `ch1`, "hook / set stakes"): *"Plato doesn't start with gossip — he gives a compact, vivid scene. In the Timaeus and the unfinished Critias he locates a wealthy island 'beyond the Pillars of Heracles'... Over the next sections we'll do three precise tasks: (1) read exactly what Plato supplies... (2) test which elements could plausibly come from real palaeolandscapes... (3) use a short, operational checklist..."* — genuinely matches the target's "second-person/direct address, stakes-setting, structured promise" cold-open intent.
- **126 distinct shots**, total duration **548.8s** (matches the script's estimate to one decimal place), average shot duration **4.72s** (min 1.2s, max 11.9s — the max exceeds the target's ~6.5s "never over unless a deliberate hold" guidance).
- **3 distinct plan_versions were generated for this project** — real evidence of re-planning churn, not a one-shot process.
- Scene attempt totals: 167 total render attempts, only **42 succeeded**, 14 failed, **0 pending/running** — the pipeline is not stuck, but only a third of attempted shots ever produced an accepted image; the project appears abandoned partway through, well short of a "near-complete" state.
- Real style lock text from an actual compiled prompt: `"STYLE LOCK — Classic 2D Documentary: Simplified 2D cartoon-documentary style — thick confident outlines, rounded simplified forms, and a restrained flat-shaded palette."` — **confirms §6's finding directly**: this real project used the legacy catalog's default style, with no relationship to "Classic Flat Stickman."
- Multiple shots for the same narration segment show 3 separate generated image URLs with `qa_status: "rejected"` before one finally shows `"approved"` — direct evidence of the QA/repair-retry cycle actually operating, at real cost.

**"What would happen if the sun disappeared"** (`cf3ebf6e-4439-4b43-8af8-5700d2850f09`, created 2026-09-20, also `story_ready`): 558 total scene attempts, 163 succeeded, 18 failed, and **377 pending with 0 currently running** — i.e. this project's render pipeline appears genuinely **stalled**, not merely incomplete. This is itself a notable reliability data point: a real project can end up with hundreds of scenes parked in `pending` indefinitely with nothing picking them back up.

Given the choice, **Atlantis is the cleaner "near-complete" example** (nothing left mid-flight); the sun-disappeared project is better evidence of a stuck/orphaned-pipeline failure mode.

## 11. Costs, performance & reliability

### Cost per stage, 10-minute video (see the researching agent's own REAL/ESTIMATE tagging — preserved here)

| Component | V2 | V3 | V4 | Basis |
|---|---|---|---|---|
| Research + Script + Visual Plan + World planning (LLM, `gpt-5-mini` @ $0.25/$2.00 per M tokens) | $0.53–0.71 | same | same | $0.36 REAL (a stated Research-run cap that real runs approach), rest estimated off one real per-call sample ($0.0168, confirmed to the cent against the token-rate constants) |
| TTS (ElevenLabs) | $2.50–2.60 | same | same | REAL per-character rate ($0.0003) × ESTIMATED script length — **the rate itself is code-disclosed as a guess**, since ElevenLabs returns no cost field |
| Visual World reference images (one-time/project) | $0.28–0.45 | same | same | REAL per-image cost × ESTIMATED reference count |
| Scene generation images | $0.07 | $0.20 | $0.24 | REAL per-unit cost × ESTIMATED shot-mix scaled from one real 137-shot episode |
| QA vision (`gpt-4o-mini`) | $0.01–0.02 | same | same | ESTIMATE — **no cost constant for QA calls exists in the code at all**, unlike every other LLM call |
| **Total** | **~$3.4–3.8** | **~$3.6–4.0** | **~$3.6–4.0** | |

The user-facing V2/V3/V4 toggle moves total cost by under $0.20 out of ~$3.6-4.0; the dominant cost (TTS) isn't gated by any tier the user can see, and is admittedly a guess.

### Wall-clock time

Real *observed* stage durations exist for Research/Script/Visual-Plan only (`generationTiming.js`, sourced from actual telemetry, not guesses): roughly **10-23 minutes** happy-path before a single scene is even generated. **There is no timing data at all for Visual World or Scene Generation** — the two phases that dominate real wall-clock time (dozens to ~90 image generations) have no ETA shown to the user anywhere.

Explicit timeouts are generous and stage-specific (Research extraction 140s, Visual Plan 240s — a comment admits this "already exceeds the platform's own [gateway] ceiling" as a near-miss, Script draft 120s). Worst-case time before a stage gives up and surfaces `needs_attention`: roughly `3 attempts × (own timeout + up to 60s until the next cron sweep)` — e.g. ~10 minutes for Research's extraction stage.

### Top real failure points (from the code's own incident comments)

1. **A `verify_jwt` misconfiguration silently killed the entire scene-generation recovery cron** — Supabase's gateway 401'd every cron invocation before the function's own secret check ever ran.
2. **"Viking incident" (Research, 2 rounds same day)** — a too-large extraction batch caused runaway latency; fixed by capping batch size.
3. **Real Mars project stuck in `WAITING_FOR_DEPENDENCY → PENDING` forever** — a deterministic row-construction bug, same root cause also produced stale reference sheets.
4. **A real Visual World generation silently used the wrong (cheap) renderer for 16 of 17 references** despite a High Quality project selection; a "plants" entity got persisted as a humanoid character; Earth got 6 near-duplicate camera anchors; the UI showed "Preview unavailable" for assets the DB proved had succeeded.
5. **The "Atlantis" incident cluster** — a failed-resume bug, 37 shots with garbled overlay text, 15/126 beats compiled against an already-superseded plan.
6. **A 4-round duration-calculation bug** on the "sun disappeared" project — computed shot durations were off by hundreds of seconds due to a timestamp-anchoring error; the third fix attempt wasn't even sufficient.
7. **A real billing incident**: a user was correctly charged for episode generation, then a stale-charge guard incorrectly blocked their retry.
8. **A PL/pgSQL bug** silently produced all-zero scene counts on the resume-state UI with no visible error — found live on a real project.
9. **A classic check-then-insert race** caused 3+ concurrent workers to each insert a duplicate reference-asset row for the same missing view.
10. **A provider-error-taxonomy bug** made one real Runware outage "look like 13 independent image failures instead of one root cause" — actively hampering incident triage at the time.

### The 15 pre-existing failing tests

`npm test` → 1,328 tests, 1,313 pass, **15 fail**, 0 skipped. Classification:

- **8 are a fully unrelated feature** (30 Days: `thirtyDays.test.mjs` ×6, `thirtyDaysSeries.test.mjs` ×2 — not this pipeline at all).
- Of the remaining 7 touching Long Form/Visual World (shared infrastructure the current Stickman pipeline runs on top of, even though none directly import "stickman" code):
  - 2 are **stale tests describing intentionally-changed behavior** (a character-reference-count assertion never updated after a real cost-saving fix; a hardcoded shot-planner version string 6 revisions out of date).
  - 1 is **cosmetic** (a loading-state copy string drifted by one word).
  - At least **3 read as genuine, currently-live functional bugs**: a sequence-diversity enforcement check false-flagging an already-varied 8-shot sequence; a graphic auto-repair path resolving to `undefined` where it should swap in a fallback icon (meaning the "automatic recompile" repair would still ship a broken card); and an entity-category persistence check finding the fix applied to only one of two code branches that need it.
  - 1 needs a closer read to classify with confidence (a "fail closed" quality-pass guarantee that may have gained a legitimate fallback path, or may have been quietly loosened).

None of the 15 touch the Stickman Production Bible / Style Contract code directly — those tests all pass.

## 12. Dead / legacy code

- **`settle_long_form_reservation` / `release_long_form_reservation`** — defined, granted, never called. Dead code implementing a promise the product UI makes but the backend doesn't keep (§1).
- **`/long-form/new` (`new.jsx`) and its support files** — legacy-but-still-live, not fully orphaned: the primary "Create New Video" button no longer routes here, but a "Back" button inside the current Story step still navigates to it, and `discoverIdeas.js`'s shared exports (`PREVIEW_STATUS`, `createIdea`) are reused by the live page. `previewJobs.js`'s `submitConceptPreviewJob` specifically **is** dead in the live flow — the new page's own comment says its `conceptPreview` field is "kept as-is, unused by ProductionSetup.jsx."
- **Ten successive migrations replacing the same `long_form_project_resume_state()` function body** — each is `create or replace`, so only the final one is live; the other nine exist purely as replay history. The function itself is live and heavily depended on (`project.js`, `projectStage.js`, `generateWorkspaceApi.js`, `StoryboardWorkspace.jsx`) — the ten-revision churn in roughly 4 days is itself a signal this piece of logic was unusually unstable.
- **`GPT5_MINI_INPUT_PER_M`/`GPT5_MINI_OUTPUT_PER_M` duplicated verbatim across 7 files** rather than one shared constant — one of the files' own comments admits this.
- **Two entire visual-generation pipelines (legacy Visual Plan/Visual World/Scene Generation/QA, and the unused-but-built Stickman Production Bible + `VisualRecipe` interface)** — the legacy one is fully functional but orphaned from the current UI; the Stickman one is wired to the UI but has no scene-generation implementation. Neither is "the" pipeline in active, coherent use end-to-end.
- **`motion_intent`** — written, never read (§8).
- **`requiresAudioReconciliation: true`** — written on every beat, never read (§5).

---

# PART 2 — TARGET PIPELINE COMPARISON

**T1. Script** — **PARTIAL.** A real, sophisticated evidence-grounded script engine exists with genuine hard gates (chapter fidelity, meta-language leak detection, measured-not-guessed length with a real retry ladder). It does not implement the target's *exact* structure as hard requirements — cold open, rhetorical mini-questions, planted callbacks, and closer quality are prompt-guidance only, judged subjectively by an LLM critic, with no deterministic check. Length target uses 150 wpm (not 145) and is verified within ±15% soft / 75% hard floor (not the target's ±5%). Files: `generate-long-form-story-plan/index.ts`, `advance-long-form-script/index.ts`.

**T2. Voiceover** — **PARTIAL.** Real ElevenLabs TTS with genuine word-level timestamps (derived from character-level alignment) is built, tested, and stored. It is explicitly **not** "the single source of truth for all timing downstream" as the target requires — every scene/beat timing computation in the actually-producing pipeline still uses the 150-wpm estimate; the real alignment data has no consumer. Files: `_shared/stickman/narrationAudio.ts`, `_shared/ttsAlignment.ts`, `generate-long-form-narration-audio/index.ts`.

**T3. Production Bible** — **CONFLICTS.** The Stickman Production Bible generator matches the target closely in spirit (frozen per-video cast/settings/props with canonical verbatim text, universal style rules from a versioned code recipe, not the LLM) and produces genuinely good output. But it conflicts with reality on two fronts: (a) nothing downstream consumes a frozen Bible — `visualRecipe.ts` is "skeleton only... nothing calls it yet"; (b) the pipeline that *does* actually render images uses an entirely separate, unrelated 6-preset style catalog with no relationship to `STICKMAN_DOODLE_EXPLAINER_V1` at all, confirmed against a real project's actual prompts. Files: `build-stickman-production-bible/index.ts`, `_shared/stickman/styleContract.ts`, `_shared/visualRecipe.ts`, `_shared/visualWorldStyle.ts`, `src/pages/workspace/long-form/visualStyles.js`, `stylePresets.js`.

**T4. Scene Director** — **PARTIAL / CONFLICTS.** A genuinely close structural analog exists in the legacy pipeline (4-layer segmentation producing per-shot records with narration text, timing, visual intent, treatment, cast/props references, and even a `motionIntent`-equivalent field). It conflicts with the target on two material points: durations are `TimingSource: "ESTIMATED"` everywhere in practice, never real timestamps as T4 requires; and the target's explicit "all scenes' narrationText joined together must equal the full script exactly (no gaps, overlaps, duplicates)" validation **does not exist** — only a soft segment-ID-presence warning and an aggregate 10%-duration hard block. `motionIntent`(-equivalent) is captured but never consumed by anything, so "stored for later animation" is currently a dead promise. Files: `advance-long-form-visual-plan/index.ts`, `_shared/visualShotPlanning.js`, `_shared/narrationVisualContract.ts`.

**T5. Prompt Compiler** — **EXISTS**, closely matching the target. `compileScenePrompt` is deterministic code with a fixed section order, no LLM composition, canonical text inserted word-for-word, and a real budget/lint mechanism. The one meaningful gap: entity-ID-leak prevention is patched at two independent call sites rather than structurally guaranteed by the data model, and has already recurred as a real bug once (on the Atlantis project itself). Files: `_shared/sceneRenderPlan.ts`, `_shared/episodePreflight.ts`.

**T6. Images** — **EXISTS for the legacy pipeline; MISSING for what the current UI actually produces.** Real per-tier models, resolution policy, and reference handling exist, but reference usage is materially more complex than the target's "off by default, at most one optional hero reference" — the default tier's single reference slot forces a multi-reference collage workaround that has already caused a real leak-into-output incident. Since the legacy pipeline is orphaned from `ProductionSetup.jsx`, no scene is generated at all for a project created through the live UI today. Files: `_shared/sceneRendererTiers.ts`, `_shared/sceneReferenceBundle.ts`.

**T7. QA** — **EXISTS for the legacy pipeline (well-built), MISSING for the live UI's actual output**, same orphaning caveat as T6. The real implementation matches the target closely: a vision check against the scene contract, one targeted repair ladder bounded to prevent infinite regeneration, then a fallback to human review — calibrated against real production data to avoid the over-rejection failure mode the target implicitly warns against. Files: `_shared/sceneQA.ts`, `_shared/repairLadder.ts`, `_shared/styleRepairLadder.ts`.

**T8. Edit/Render** — **MISSING**, unambiguously and completely, confirmed by exhaustive grep across the whole repository. No renderer, no timeline assembly, no motion, no captions, no export. This is the single largest gap between the current state and the target pipeline. Files: none exist; closest artifacts are `compile-long-form-scenes/index.ts` (a render *plan* compiler, not a video compiler) and the dead `motion_intent` field.

**T9. Scene Review UI** — **PARTIAL.** The legacy Storyboard step's cards come close to the target's exact format (shot number, time range, quoted narration excerpt). The actual post-generation scene-review step (Generate) does not: it shows a derived summary instead of raw narration text, and time ranges only at the sequence-group level, not per card. Per-scene regenerate exists (Retry/Edit) and matches the target. Files: `StoryboardWorkspace.jsx`, `GenerateWorkspace.jsx`, `sceneCardModel.js`.

---

# PART 3 — RECOMMENDATIONS (not implemented)

**For each gap**, in the shortest safe order to reach the target pipeline:

1. **Fix the billing bug first — before anything else ships.** Wire `settle_long_form_reservation`/`release_long_form_reservation` into project deletion and into whatever eventually becomes "video complete," and route Retry/Edit charges through `commit_long_form_reservation_spend` instead of a bare balance debit. **Effort: S.** Risk: touches money; needs a careful audit of currently-reserved-but-never-settled balances for existing users before shipping the fix (a migration to reconcile historical reservations may be needed).

2. **Make one pipeline the pipeline.** Today there are two, and the one wired to the UI is the less complete one. Two honest paths: (a) finish the Stickman `VisualRecipe` implementation (`directBeats`/`compile`) so it can actually call the already-built legacy machinery (Scene Render Plans, `compileScenePrompt`, QA, repair ladder) underneath a Stickman-flavored style contract, reusing nearly all of Stage E/QA as-is; or (b) if Stickman is meant to fully replace the legacy visual pipeline eventually, port `compileScenePrompt`'s deterministic-compiler pattern and the QA/repair-ladder logic onto Stickman's data shapes rather than rebuilding them. **Effort: L.** This is the highest-leverage single piece of work — everything past Narration currently depends on it.

3. **Build T8 (render/edit).** Nothing here can be incrementally grown from existing code — it's a net-new capability. Recommend starting server-side (an edge function invoking a render service or FFmpeg via a container/queue, given Supabase edge functions' own 150s gateway ceiling already bit this codebase once for a much lighter workload) rather than client-side `ffmpeg.wasm` (already proven fragile enough that three *other* Zyvo tools each rolled their own). **Effort: L**, and it blocks T8/T9 fully mattering until it exists.

4. **Wire the real TTS alignment into scene timing.** The hard part (capture, mapping, storage) is done and tested; the remaining work is replacing every `WORDS_PER_MINUTE` read in the timing-sensitive path with a lookup into `long_form_narration_audio_versions.narration`. **Effort: M**, high value — this alone would close the single most-cited class of incident in this audit (the three-way duration-mismatch bugs).

5. **Add the missing coverage validator.** A deterministic check that walks each beat's `narrationRanges` in sequence-index order and asserts the concatenation exactly reproduces the segment's `text` (flagging gaps/overlaps/duplicates as hard errors) is a bounded, low-risk addition on top of existing data — it doesn't need new fields, just a new validation pass alongside `validateVisualPlan`. **Effort: S-M.**

6. **Reconcile the duplicated/disagreeing constants** — one `WORDS_PER_MINUTE` (currently 150 vs. 145 vs. an implied ~15 beats/min elsewhere), one shared GPT-5-mini pricing constant instead of 7 copies, one authoritative EDIT/V4 credit price instead of two disagreeing tables. **Effort: S each**, pure cleanup, no product-behavior risk if done as a straight refactor with tests.

7. **Decide what "done" means for a project and add the status.** There is currently no terminal "video complete" state anywhere in `long_form_projects.status` — necessary before T8 exists, but worth designing now so the resume-state RPC and the 7-bucket UI labels have somewhere to land it.

**Risks called out explicitly**:
- **Data migration**: any change to the reservation lifecycle needs a one-time reconciliation for real users with money already stuck in never-settled reservations — silently "fixing" the code without addressing already-reserved balances would be its own new bug.
- **In-flight projects**: both real example projects found in this audit (Atlantis: partially rendered, no pending work; "sun disappeared": 377 scenes stuck pending with nothing processing them) show real projects can be left in inconsistent states today. Any pipeline consolidation (recommendation 2) needs an explicit decision on what happens to existing legacy-pipeline projects that can't be replayed under a new architecture.
- **Credit accounting**: recommendation 1 and recommendation 6's "one authoritative price" both touch what users are actually charged — coordinate these two changes together rather than shipping them separately, since fixing pricing drift *and* fixing reservation settlement in the same release makes the net effect on any given user's balance easier to reason about and communicate.
- **Provider limits**: Kling's single reference-image slot is a real, already-incident-causing constraint or the default tier — if recommendation 2 leans on reusing the legacy renderer for Stickman, this constraint (and its collage workaround) comes along for the ride and should be re-evaluated, not silently inherited.

**Where I think the target design itself is questionable, given what's actually in this codebase**:
- **T1's ±5% length tolerance is tighter than what the current, well-engineered validator uses (±15% soft / 25% hard).** Given the code's own incident history shows even *measuring* actual word count reliably was itself once a real bug, ±5% may be an unrealistically tight target without first proving the ±15% band is actually being hit consistently in practice — I'd validate against real script-generation data before committing to a tighter number.
- **T4's "never under ~1.8s unless a punch, never over ~6.5s unless a hold" is already being exceeded in real production** (the Atlantis example's real max shot was 11.9s) without apparent product harm — worth checking whether that's a deliberate "hold" in practice or actually invisible drift, before hard-coding a validator around the tighter number.
- **The target's implicit assumption that word-level TTS timing plus a deterministic Scene Director closes the coverage/sync problem** is sound in principle, but this codebase's own history (ten rewrites of one resume-state function, four rounds of one duration-bug fix, two independent patches for one entity-ID leak) suggests the actual risk in this system isn't picking the right algorithm — it's that stateful, self-chaining, multi-stage pipelines with JSON blobs as the source of truth are hard to get right incrementally. I'd weight recommendation 5 (an explicit, boring, deterministic coverage assertion) and comprehensive tests around it higher than any single architectural change, because most of the incidents cited in §11 were exactly the kind of silent, no-error-raised failure that only an explicit assertion would have caught earlier.
