# Blocky Worlds: the production video pipeline

> The PERMANENT RULE (`docs/blocky-worlds-protocol.md`, top) holds here: `checkVisuals`, `checkSubjects` and
> `checkTimeline` (+ the kit check: every object on screen is one the engine can build) run in the prepare job, after
> the voice and before any render job exists; the server reads the uploaded check report again before it splits the
> frames. Any miss fails the run and
> refunds it. Nothing in this pipeline can skip them: there is no flag, no owner override, no retry that passes without
> them (a check miss is a no-retry failure).

When a customer presses Generate, the whole video is made on RunPod, with no laptop. Target wait: 2-3 minutes.

## The path of one video

```
blocky-worlds-api start
  charge + create the run (blocky_worlds_start_run, one transaction)          status queued
  -> reconcile -> PREPARE job on the GPU endpoint
       voice: ElevenLabs take (key = RunPod secret), uploaded at once,
              "voiced" event (cost from the character-cost header)             status voice
       trim the pauses + word timings (voice/eleven.mjs)
       (the builder starts before the voice: the needs of a plan from estimated timings are resolved meanwhile)
       planVideo -> the builder (lib/builder: a missing object / world is taken from the kit, the shared library, or
         designed + built + still + vision-checked now; else a picture card; each change re-checked) -> checkTimeline
         + checkVisuals + checkSubjects + kit check                                 status plan
         any miss -> failed (VISUAL_CHECK / SUBJECT_CHECK / PLAN_FAILED), no retry, refund. Nothing rendered.
         A thing the kit lacks never fails the run (KIT_MISSING is left only as a guard for an engine bug).
       upload timeline.json + visual-check.json, "planned" event
         -> the server reads the timeline, splits it into K chunks            status render
         -> K CHUNK jobs at once (they render while the prepare job goes on)
       music A + SFX cues + the final mix -> mix.m4a, job done
  CHUNK job i (K in parallel): GPU check -> frames [from, to) -> seg_i.mp4 (1080p) + web_i.mp4 (720p) -> upload
  all chunks done AND the mix uploaded -> FINISH job
       join the segments by stream copy, mux the mix -> final.mp4; the same for web.mp4; poster.jpg -> upload
  -> run done (files), status shows the video                                 status done
```

The mix needs only the voice, the music and the cues, so it is made in the prepare job, while the GPUs render. The
720p web copy is made per chunk (a few seconds each) so the finish job only joins and uploads.

## Where it lives

| Piece | File |
|---|---|
| Pure logic: chunk split (frames and expected bytes), the state machine (`reconcile`), events, retries, costs | `supabase/functions/_shared/blockyWorlds/render.js` |
| The runtime: carries out reconcile's actions through adapters (db, storage, RunPod). Shared by the edge function and the free dry run | `supabase/functions/_shared/blockyWorlds/renderRuntime.js` |
| Supabase + RunPod adapters (Deno) | `supabase/functions/_shared/blockyWorlds/renderSupabase.ts` |
| Callbacks (worker events, RunPod webhook) + the sweeper (pg_cron every minute) | `supabase/functions/blocky-worlds-render/index.ts` |
| Start | `supabase/functions/blocky-worlds-api/index.ts` (start -> `runtime.start`) |
| Worker roles `prepare`, `chunk`, `finish` (+ the old staging `ranges`/`whole`) | `scripts/blockyWorlds/engine/runpod/worker.mjs`, `handler.py` |
| Tables: `blocky_worlds_jobs`, run columns `render`, `planned_at`, `voice_ready`, ledger `ref`, the cron | `supabase/migrations/20261202200000_blocky_worlds_render.sql` (NOT applied) |
| Tests (no network) / the free end-to-end dry run | `tests/blockyWorldsRender.test.mjs` / `scripts/blockyWorlds/engine/dev/pipelineDryRun.mjs` |

## How it stays correct

- **Reconcile, not event chains.** Every callback only updates its own job row, then `reconcile(run, jobs, now)` looks
  at the whole run and says what is missing: the prepare job, a chunk, a retry, the finish, done or failed. The sweeper
  runs the same function every minute, so a lost callback or webhook only delays a step, it never strands a run.
- **Exactly once.** A new job attempt is a row insert with a unique `(run_id, role, idx, attempt)`: two callbacks that
  both decide "dispatch chunk 3, attempt 2" race on the insert and only one sends it. A job already done or failed
  ignores later events (duplicate callbacks, RunPod's webhook retries). The run's terminal update is conditional
  (`status not in done, failed`), so the refund happens once (and `blocky_worlds_refund` is itself once-only).
  "planned" is applied once (`planned_at is null`). Ledger rows carry a `ref` (`gpu:<RunPod job>`, `voice:<job>`) under
  a unique key, so a repeated webhook never bills twice.
- **Auth.** Each run has a callback token = HMAC-SHA256(`BLOCKY_WORLDS_CALLBACK_SECRET`, `blocky-worlds:<run id>`)
  (Cutaway's pattern). Worker events carry it in the body, RunPod's webhook in the URL. The sweeper needs the header
  `x-blocky-cron` = `BLOCKY_WORLDS_CRON_SECRET`. Deployed with `--no-verify-jwt`; nothing in it is public.
- **Keys.** The worker never gets the service-role key: every file goes up and down by signed URLs the edge function
  makes for that job. The ElevenLabs key is a RunPod secret in the template env:
  `ELEVENLABS_KEY = {{ RUNPOD_SECRET_blocky_elevenlabs }}`; the story director's and the builder's Anthropic key the same
  way: `ANTHROPIC_KEY = {{ RUNPOD_SECRET_blocky_anthropic }}` (runpod/setup.mjs; only templates made after 2026-11-05
  have it: without it the director uses the free mock list and the builder makes picture cards).
- **The paid voice is bought once.** The prepare job uploads `voice.mp3` + `take.json` right after the take and says
  "voiced". A retried prepare job gets them back by signed URL and never calls ElevenLabs again.

## Retries and timeouts (`render.js` RENDER)

| Failure | What happens |
|---|---|
| Check miss (VISUAL_CHECK, SUBJECT_CHECK, PRODUCTION_CHECK, KIT_MISSING, PLAN_FAILED), the engine page refusing the timeline (TIMELINE_INVALID), VOICE_CONFIG, PROVIDER_BALANCE, BAD_JOB, NOT_CONFIGURED | the run fails at once, refunded, no retry |
| NO_GPU (a worker without graphics) | handler.py returns `refresh_worker`, the same piece is sent again 20 s later (that worker is gone by then), up to 3 such retries on top of the normal tries |
| A chunk fails (crash, render error, upload error) | retried up to 3 times (4 attempts); then the run fails, every live job is cancelled, refunded |
| prepare fails (not a check) | 2 attempts; finish: 3 attempts |
| A job waits in RunPod's queue > 4 min, or runs past its limit (prepare 5, chunk 7, finish 5 min) | cancelled and counted as a failed attempt (retried as above) |
| The whole run > 25 min | failed, refunded |

## Chunks

`chunkPlan(timeline)`: K = ceil(frames / 270), at least 2, at most 12 (2,160 frames for 90 s -> 8 chunks; 60 s -> 6;
120 s -> 11), raised until every chunk's expected size is under 36 MB (the bucket upload limit is 50 MB; bytes per frame
by set and light, measured on the paid test at CRF 20). The cuts move to the nearest shot boundary within 6% of a
chunk. The worker still squeezes a chunk that comes out over 48 MB (higher CRF).

## Speed (from the first paid test: 6 chunks, RTX 4000 Ada / A4500, 85-130 ms a frame, ~30 s page load a chunk)

| Stage (90 s video) | Wall time |
|---|---|
| prepare picked up (warm / FlashBoot) | 2-15 s |
| voice (ElevenLabs, ~1,850 characters) + trim | 10-20 s |
| plan + the three checks + uploads | ~2 s |
| chunks: sent, start-up 5-15 s, GPU check 2 s, page load ~30 s, 270 frames x 0.1 s = 27 s, web copy + upload ~6 s | 70-90 s |
| (music + SFX + mix in the prepare job, 40 s, while the chunks render) | 0 |
| finish: download 16 files, join, mux, poster, upload ~200 MB | 15-25 s |
| **Generate to done** | **~2-2.5 min (worst ~3.5 min on cold starts)** |

The endpoint needs `workersMax` >= K + 1 per video in flight (12 recommended): the paid test ran with 4, so two of its
six chunks waited for a free worker. The biggest remaining cost of time is the page load (~30 s a chunk, mostly the
205 MB jacaranda tree model and the textures); halving it saves ~15 s per video and ~$0.02.

## Cost per 90 s video

| Part | Cost |
|---|---|
| Voice: ~1,850 characters x 0.44 ElevenLabs credits x $0.0002 | ~$0.16 |
| prepare job (~60 s on the GPU tier at $0.00016/s) | ~$0.01 |
| 8 chunks x ~70 s (+ ~10 s start-up each) | ~$0.10 |
| finish (~20 s) | ~$0.003 |
| Storage | ~$0.003 |
| **Total** | **~$0.28** (price: 62 credits = $0.62 of cost basis) |

Each stage writes its own ledger row (`blocky_worlds_cost_ledger`): voice from ElevenLabs' `character-cost` header,
GPU from RunPod's `executionTime` (+ up to 15 s of the start-up in `delayTime`) at $0.00016/s, the story director
(`director:<job>`) and the builder (`builder:<job>`) from the "planned" event, plus whatever they spent after it or in a
prepare try that failed before it (`director_end:<job>`, `builder_end:<job>`, from the job's end: `spend`).

## The story director and the builder (function secrets on blocky-worlds-render AND blocky-worlds-api)

| Secret | Values (default) | The prepare job gets |
|---|---|---|
| `BLOCKY_WORLDS_DIRECTOR` | off, **mock**, haiku, sonnet | `director: { provider: "off" \| "mock" \| "anthropic", model? }` |
| `BLOCKY_WORLDS_BUILDER` | **off**, on | `builder: { provider: "off" \| "anthropic", library, budget: { maxUsd } }` |
| `BLOCKY_WORLDS_BUILDER_MAX_USD` | **0.60** (clamped 0..2) | the builder's money cap per video |

Both functions dispatch jobs (api: the first prepare; render: retries) and read the same project-wide secrets. With the builder on,
the server hands the job a snapshot of the shared library (`blocky_worlds_assets`, live, most-used first, at most 150
rows / 2 MB; a missing table is an empty library) and saves each asset the job built ("built" event; once per
kind + name; the check still stays on the worker). The run's `render.production` records the settings at planning.

**What bounds the money of one video** (render.js `aiCeilingUsd`, sent to the job as `prepare.limits` and logged):
- builder: `BLOCKY_WORLDS_BUILDER_MAX_USD`, enforced by the worker's purse (each design / vision call reserves its worst
  case before it starts; at most 6 designs, 120 s). Only the first prepare try designs; a retry is kit + library only.
- director: at most 2 calls per prepare try, 2 tries: Haiku $0.0071 a call worst case (~$0.03 a video), Sonnet $0.1425
  (~$0.57 a video).
- voice ~$0.16 (bought once per run), GPU ~$0.12 (estimate()), storage.
- Two 90 s test videos with haiku + builder on at $0.60: at most ~2 x ($0.63 + $0.28) = ~$1.8 (< the $2.50 test cap).
  Sonnet + builder can pass $2.50 at its worst: use haiku for the test. The 24 h emergency cap (`daily_cap_usd`) counts
  these ledger rows too.

**Timing of real runs:** `node scripts/blockyWorlds/engine/dev/runTiming.mjs [latest N | <run id> ...] [--json]`
(read-only, service key from .env.local): Generate -> prepare (voice, director, builder, plan + checks, music, mix) ->
planned -> render (first chunk start -> last chunk done, per chunk min/max) -> finish -> total; the cost per ledger
line; picture-card fallbacks; gaps. The prepare job's row keeps `output.planned` (builder/director ms + cost, timings so
far) from the "planned" event, replaced by the whole job output (with `timing`) when it ends.
