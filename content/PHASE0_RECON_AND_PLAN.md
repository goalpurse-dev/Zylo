# Content Machine: Phase 0 recon and plan

Branch `contentmachine`, branched from `laptop-transfer` at 4df900b8. Working tree: `C:\Users\Public\Zylo-contentmachine`.
Status: **waiting for the owner's approval** (spec §12). Nothing has been built, migrated or deployed.

## 1. What the repo already has

| Area | What exists | Where |
|---|---|---|
| Frontend | Vite, React 19, react-router 7 (with SSR), Tailwind, zod, sonner | routes in `src/App.jsx`; admin pages are in `src/pages/admin/` (`Ops.jsx`, `FeedbackAnalytics.jsx`) |
| Backend | About 200 Supabase Edge Functions (Deno). `api/` holds only 2 Vercel functions (OpenAI proxy, Stripe webhook) | `supabase/functions/`, helpers in `shared/` and `_shared/` |
| Auth | Supabase Auth. Server side, `requireUser(req)` calls `auth.getUser()` | `supabase/functions/shared/auth.ts:18` |
| Admin check | Copy-pasted `adminEmails()` (`ADMIN_EMAILS` + `ALERT_EMAIL` + `CONTACT_TO_EMAIL`). Returns **403**, and **does not check email verification** | `ops-status/index.ts:27-66`, `blocky-story-api/index.ts:91-94` |
| Database | Supabase Postgres with no ORM: raw SQL migrations, `YYYYMMDDHHMMSS_name.sql`, RLS on, server-only tables `revoke all` | latest is `20261106100000_cutaway_explainer.sql` |
| Audit log | None. Admin changes (for example the Blocky window cap) are only `console.log`ged | |
| Cron / jobs | pg_cron + pg_net call edge functions through `private.trigger_*()` with vault secrets. Per-feature job tables plus workers (`fruit_jobs`/`fruit-worker`, `blocky_jobs`/`blocky-worker`, `long_form_render_jobs`) | e.g. `20261026100000_blocky_stories_backend.sql:863` |
| Rendering | `render-worker/`: Node + ffmpeg on Fly.io, one machine per job. Used by Long Form, Fruit, Blocky and Cutaway finals; compute cost is logged per second | `render-worker/src/*.mjs` |
| Storage | Supabase Storage. Main bucket is `generated` (public). Private buckets exist (`long-form-renders`, `generation-references`) with signed URLs (1 h typical) | `src/lib/storage.ts:67` |
| Runware | `includeCost: true` is already sent everywhere. Costs are stored per product (`fruit_ai_calls`, `blocky_ai_calls`, `long_form_cost_ledger`, `cutaway_runs.cost_usd`). The generic `runware-image`/`runware-video` path does **not** store its cost | `_shared/{fruit,blocky,cutaway}/runware.js`, `runware-video/runware.ts` |
| LLMs | Anthropic (`ANTHROPIC_API_KEY`) and OpenAI. Model names live in per-product model maps | `_shared/{fruit,blocky}/models.js`, `_shared/cutaway/llm.js` |
| Spend guards | Blocky: paid-calls switch, $20 per 3 hours for all users, $20 per user per day, spend watch. Runware balance guard. Fruit off switch. All of these estimate and check; **none reserves spend in a row** | `blocky-story-api:103-127`, `_shared/blocky/spendWatch.js`, `_shared/runwareBalance.ts` |
| Credits | Charged per product (`charge_job_credits`, `fruit_charge_step`, `blocky_charge_step`, `deduct_credits`, ...). **There is no admin/internal bypass anywhere** | |
| Community gallery | Hard-coded clips plus curated `showcase_videos` rows. **No generation is published automatically**, so content-machine output cannot leak there | `src/components/launch/launch.js:49-62` |
| Playwright | In `node_modules` (not in package.json); about 70 QA and screenshot scripts use it | `scripts/blocky/qa*.mjs` |
| UTM | First-touch UTM goes into auth user metadata (`first_touch_*`) at signup. No server-side table | `src/lib/firstTouch.js`, `src/lib/auth.js:6-27` |
| Tests | `npm test` = `node --test tests/*.test.mjs` (with a Deno env shim) | `tests/setup.mjs` |
| Env | No `APIFY_*`, `YOUTUBE_API_KEY` (only YouTube OAuth vars) or `DRY_RUN` yet. No `.env.example` | |

### How each generator in the spec actually runs

| Spec name | Real backend | Server-drivable? |
|---|---|---|
| AI Fruit Story (+ 10-episode series) | `fruit-story-api` (actions `createStory`, `buildFinal`, `createSeriesPlan`, ...) + `fruit-worker` + Fly final | **Yes** |
| Blocky Stories | `blocky-story-api` + `blocky-worker` + Fly final | **Yes** |
| Cutaway Explainer | `cutaway-api` (`start`/`advance`/`approve`) + Fly final | **Yes** |
| Long Form (stickman) | many `*-long-form-*` functions + autopilot + `long-form-render` | **Yes** (autopilot exists) |
| 2AM Worlds | `two-am-planner` (server reserves credits), images only | Mostly |
| Clay Rescue, Micro Camera, Cartoon Drive By, Behind the Scenes, Video Generator / Short Form templates | generic `jobs` + `job-worker` + `runware-*`, **orchestrated by the browser** (Clay Rescue even stitches with ffmpeg.wasm in the browser) | No, not without the UI |
| Skeleton | UI stub, no backend | No |
| Anime | not a generator, just a Short Form template plus style options | (via templates) |

## 2. Proposals that need the owner's approval

**P1. Queue and cron: reuse the existing pg_cron pattern plus a DB job table.**
No Redis/BullMQ (it would be a new service).
- Table `cm_jobs` (stage, idea_id, status, attempts, locked_until, ...) and an edge function `content-machine-worker`.
- `private.trigger_content_machine()` runs every minute with a vault secret, like the Blocky and Long Form workers.
- On every tick the worker:
  1. If the Helsinki local time is at or past `run_time_local` and no `cm_runs` row exists for today, it creates one. This gets daylight saving right without UTC cron maths.
  2. It claims due jobs with `FOR UPDATE SKIP LOCKED`.
- Every stage is a separate job and can safely run more than once, so a crash resumes on the next tick.

**P2. One migration, create-only (nothing existing is altered or dropped).**
- Tables: all spec tables (`cm_settings`, `cm_runs`, `cm_scout_reports`, `cm_ideas`, `cm_generations`, `cm_packages`, `cm_posts`, `cm_spend_ledger`, `cm_audit_log`) plus `cm_jobs` and `cm_cost_estimates` (the per-operation cost table that calibrates itself).
- Every table has RLS on with `revoke all from public, anon, authenticated`, so only the service role (edge functions) can touch them.
- Spend reservation is an RPC, `cm_reserve_spend(...)`. It locks the single `cm_settings` row, sums today, month and provider spend in Helsinki time, compares against the caps and inserts the ledger row in one transaction, so parallel workers cannot overspend.
- File: `supabase/migrations/20261107100000_content_machine.sql` (after the latest timestamp), with a rollback file in `supabase/rollbacks/`.

**P3. API: one action-routed edge function, `content-machine-api`.**
This matches the house style of `blocky-story-api` and `cutaway-api`.
- `verify_jwt = false` in `config.toml`, so even a call with no token gets **our** plain 404 instead of the gateway's 401.
- A new shared helper, `_shared/contentMachine/adminGuard.ts`:
  - The user must exist, have `email_confirmed_at` set, and their email must be in `ADMIN_EMAILS`.
  - It uses only `ADMIN_EMAILS`, not the ops-page fallbacks.
  - Anyone else gets `404 Not Found`.
- **Deviation from the spec:** the spec asks for `/api/admin/content-machine/*`, but this app's backend is Supabase, not Vercel. A Vercel rewrite could add that literal path later if wanted.

**P4. Admin page `/admin/content-machine` (SPA).**
- The page first calls `content-machine-api {action:"whoami"}`. If the reply is not admin, it renders the site's normal 404 page.
- Honest limit: in an SPA the page's JavaScript chunk is downloadable by anyone, but it contains no data and no secrets. Every byte of data comes through the guarded API.
- Files go to a **private** bucket `content-machine` with 15-minute signed URLs.

**P5. Admin generations without spending users' credits.**
There is no bypass today. Recommended: a **dedicated internal Supabase user** (for example `content-machine@tryzyvo.com`, not the owner's account).
- The worker tops that user's credits up from the Budget Guard and ledgers every top-up as internal.
- The generators stay **completely unchanged**, so there is zero risk to user-facing code.
- The real dollars are controlled by the Budget Guard, which wraps each generator job at the job level:
  1. Reserve the estimate.
  2. Run the job.
  3. Reconcile the actual cost from the product's own cost table (`fruit_ai_calls`, `blocky_ai_calls`, ...).
- The alternative, adding an `internal` flag to each generator's charge path, touches user-facing code, so I don't recommend it.

**P6. Which tools the machine can use in v1.**
- **Fruit Story (incl. series), Blocky Stories, Cutaway Explainer, Long Form cut-downs**, plus listicle slideshows. These are the server-drivable ones.
- The browser-only tools (Clay Rescue, Micro Camera, Cartoon Drive By, Behind the Scenes) could be driven later by the Phase 4 Playwright session, which uses the real UI anyway.
- Skeleton has no backend, so it is out.

**P7. Rendering and Playwright: the existing Fly render-worker.**
- New entry points: end card, slideshow MP4, making-of edit.
- Playwright needs Chromium, which edge functions can't run. In Phase 4 it would go in a separate Fly machine image (Fly is already in use, so no new provider). The other option is a script run on this laptop.

**P8. Models and keys.**
- `CM_MODEL_MAIN=claude-sonnet-5-5` and `CM_MODEL_FAST=claude-haiku-5-5` as the spec says, set by env. The existing `ANTHROPIC_API_KEY` and `RUNWARE_API_KEY` are reused.
- Not needed until Phase 2:
  - `YOUTUBE_API_KEY`: free quota, but a new key.
  - **Apify**: a new paid service, so I'll ask before adding it. Scouting works with Claude web search alone.

**P9. Testing.** `DRY_RUN=true` mocks every paid call at $0. I test with DRY_RUN plus unit tests only; any paid run happens only when the owner asks.

## 3. Phase 1 scope (once P1–P5 are approved)

- `adminGuard.ts`, plus tests: a non-admin, an unverified admin and a missing token all get 404.
- The migration (P2).
- `_shared/contentMachine/budgetGuard.js` (`guard.spend(provider, operation, estimatedUsd, fn)`), with the kill switch, DRY_RUN and reserve/reconcile. Tests cover every cap and the kill switch.
- A check script that fails if `api.runware.ai` or `api.anthropic.com` is called anywhere under `_shared/contentMachine/` outside the guard.
- `content-machine-api` with whoami, settings get/set, ledger list, kill switch and audit-log writes.
- Admin shell page with a top bar (spend vs caps, kill switch) and the Budget and Settings tabs.

## 4. Getting it onto laptop-transfer

- `contentmachine` starts at `laptop-transfer`'s tip (4df900b8). `laptop-transfer` is checked out in `C:\Users\Public\Zylo-cutaway`.
- To transfer: merge `contentmachine` there, or cherry-pick its commits. Content-machine files are all new (`cm_*`, `contentMachine/`, `content/`), so conflicts should be limited to `src/App.jsx` (one route) and `supabase/config.toml` (one entry).
- Deploys run from inside the folder whose code is meant to go live, because the Supabase CLI bundles from the current directory.

## 5. Decisions (owner, 2026-10-17) and the new phase order

P1–P9 approved. Notes from the owner:
- **P3:** CORS preflight (OPTIONS) must keep working. Only real requests get the 404.
- **P5:** the internal account gets a random password and no way to log in. Its credit top-ups are capped through the Budget Guard. It is kept out of analytics, signup metrics, emails, referrals and leaderboards.
- No paid run without the owner saying so.

New order:
1. **Phase 1:** foundation. Admin guard, migration, Budget Guard (kill switch, DRY_RUN), Budget and Settings tabs.
2. **Phase 2:** **slideshow MVP**.
   - A "Make slideshows" button, with an optional topic, on the Today tab.
   - Claude with web search writes the slides: a hook cover, 5 real tools with Zyvo in a varying position, and a CTA slide.
   - Runware draws backgrounds and illustrations only, with no text in the image.
   - Text is drawn by the render worker.
   - Exports: a PNG set + ZIP, and an MP4 at about 2.5 s per slide with no music.
   - Packaging per platform, plus a sound suggestion.
   - Settings: slideshows per day (default 5) and a slideshow cap (default $2/day).
3. Scout and the learn loop.
4. Fruit, Blocky and Cutaway result videos.
5. Making-of videos with Playwright.

## 6. Phase 1: built (not migrated, not deployed)

| Piece | File |
|---|---|
| Migration (create-only) + rollback | `supabase/migrations/20261107100000_content_machine.sql`, `supabase/rollbacks/20261107100000_content_machine_rollback.sql` |
| Admin check (verified email in `ADMIN_EMAILS`, plain 404 otherwise) | `supabase/functions/_shared/contentMachine/adminGuard.js` |
| Budget Guard | `_shared/contentMachine/budgetGuard.js` (+ `cm_reserve_spend` / `cm_settle_spend` in SQL) |
| Settings checks, spend numbers, DB calls, API | `_shared/contentMachine/{settings,spendSummary,store,api}.js` |
| Edge function | `supabase/functions/content-machine-api/index.ts` (`verify_jwt = false` in `config.toml`) |
| Admin page | `src/pages/admin/ContentMachine.jsx`, route in `src/App.jsx` |
| Tests | `tests/contentMachine.test.mjs` (17), `tests/contentMachineSpend.lifecycle.sql` |
| Checks | `scripts/contentMachine/sqlCheck.mjs` (PGlite), `checkPaidCalls.mjs`, `qaPage.mjs` (browser, faked API) |

Settings already carry the Phase 2 fields: `slideshows_per_day` = 5, and `lane_daily_caps` = `{"slideshow": 2}`.

Two defaults are on the safe side:
- `dry_run` = true: every paid call is mocked until the owner turns it off in Settings.
- The kill switch stops dry runs too.

The internal account (P5) is created in the phase that first uses a Zyvo generator. Slideshows don't need it.

To go live (each on the owner's word):
1. Apply the migration.
2. Deploy `content-machine-api` from inside this folder.
3. Ship the page through Vercel. That means `laptop-transfer`, then `main`.

## 7. Owner decisions, 2026-10-18

- Phase 1 is live: migration applied, `content-machine-api` deployed, dry run on.
- While only slideshows are made, the caps are $3/day and $90/month. The slideshow cap is $3 too.
- The cap covers every paid call: Runware, Anthropic tokens, Anthropic web searches ($0.01 each) and Fly render time.
- Ways to save money:
  - prompt caching on the long system prompts
  - the Batch API for the daily run
  - CM_MODEL_FAST for captions, compliance checks and reading screenshots
- Phase 2 = slideshow experiments.
- Phase 3 = the learning loop:
  - a Posted tab with stats, typed in or read from a screenshot
  - "Let the agent analyze"
  - a playbook
  - winners and experiments mixed in each day, with a 14-day half-life
  - a post counts as a winner only after it has worked 3 or more times
  - the scout
- After that: the Zyvo-tool videos and the making-of videos.

## 8. Phase 2: built and tested locally (not migrated, not deployed)

| Piece | File |
|---|---|
| Migration: library (17 formats, 5 styles, 10 hook types), recipe columns, experiment settings, job claim, minute tick | `supabase/migrations/20261108100000_content_machine_slideshows.sql` (+ rollback) |
| Experiment planner | `_shared/contentMachine/planner.js` |
| Prompts, schemas, checks, duplicate check, dry-run mocks | `_shared/contentMachine/writer.js` |
| Providers, each needing a Budget Guard ticket | `_shared/contentMachine/providers/{anthropic,runware,fly}.js` |
| Pipeline (plan → write or batch → check → rewrite → images → render) | `_shared/contentMachine/pipeline.js`, `pipelineDb.js` |
| Worker (07:00 daily run, job claims) | `_shared/contentMachine/worker.js`, `supabase/functions/content-machine-worker/` |
| Admin API: slideshow actions | `_shared/contentMachine/apiSlideshows.js` |
| Slide templates, shared by the browser preview and the renderer | `_shared/contentMachine/slides/templates.js` |
| Renderer (Chromium → PNG + ZIP, ffmpeg → MP4) | `render-worker/src/cmSlides.mjs`, `render-worker/Dockerfile.cm`, fonts (OFL) |
| Page: Today, Ideas and Library tabs; Run now; Phase 2 settings | `src/pages/admin/contentMachine/SlideshowTabs.jsx` |
| Tests | `tests/contentMachineSlideshows.test.mjs` (23), `tests/contentMachineSlideshows.lifecycle.sql`, `tests/contentMachineTick.pglite.sql` |
| Local checks ($0) | `scripts/contentMachine/{renderSamples,qaSlideshows,captureZyvoShot,uploadZyvoShot}.mjs` |

### Go-live steps (each on the owner's word)

1. Apply the migration with `supabase db query --linked -f`, then `migration repair`. Never use `db push`: production lacks history records for many older migrations.
2. Set the secret `CM_WORKER_SECRET`, and add the vault entries `cm_worker_secret` and `cm_worker_url` (the worker's function URL).
3. Deploy `content-machine-api` and `content-machine-worker` with `--no-verify-jwt`, from this folder.
4. Upload the tryzyvo.com screenshot to `content-machine/assets/zyvo-home.png`.
5. In `render-worker/`, run `node scripts/sync-shared.mjs`, then `fly deploy --app zyvo-render --build-only --push --image-label cm-slides --dockerfile Dockerfile.cm`.
6. Still in dry run: one Run now to see the whole flow in production at $0.
7. First real run: the owner switches Dry run off in Settings and presses Run now. Then report the cost per slideshow from the ledger.
8. Ship the page (laptop-transfer → main).

## 9. Fixes before the first real run (owner, 2026-10-18) and go-live

**Fixes, all built and tested:**
1. **No overlaps.**
   - Each slide is one vertical stack with fixed gaps.
   - Text is measured in the page and shrunk to its line limit.
   - A layout check inside every slide compares the boxes of all text and image elements. The renderer refuses a slide that fails.
   - A failed slide gets one shorter rewrite and a new render. If it fails again, it's flagged and failed.
2. **Safe zones.**
   - Left 90, right 160, top 190 and bottom 420 px of 1080×1920. Backgrounds may still fill the frame.
   - No text may leave the zone (part of the same check).
   - The type scale is 15–20 % smaller.
   - "Show safe zones" toggle on the admin previews.
3. **Readable on photos.** A dark scrim sits behind text on image backgrounds. Backgrounds are generated with no people, so text never crosses a face.
4. **No empty slides.**
   - Each image gets one retry; a second failure fails the slideshow.
   - The meme layout is used only with a picture, and a meme slide must ask for one.
5. **No real people.**
   - Image prompts forbid real people, celebrities and lookalikes.
   - A program check plus the compliance check back this up.
   - Real renders accept only https images, so the repo's stand-ins can never be used.
6. **Logo library** (`cm_logos`).
   - Official files only, approved one by one; a new file or a new source needs approving again.
   - Shown small next to the tool's name. Without an approved logo, the initials tile.
   - SVGs with scripts or outside links are refused.
   - Seeded with 19 tools; only Zyvo's own logo is approved.
7. **Refusal fallback.**
   - Done in our code: a second call through the Budget Guard.
   - Only to a model that costs no more than the main one: `claude-sonnet-5` by default, the same $2/$10 as Sonnet 5.5.
   - Opus can never be picked.

**Go-live, 2026-10-18, all six steps done, dry run on:**
1. Migration `20261108100000` applied and recorded in production's migration history.
2. `CM_WORKER_SECRET` set; the vault holds `cm_worker_secret` and `cm_worker_url`.
3. `content-machine-api` and `content-machine-worker` deployed; the downloaded copies match the commit.
4. `assets/zyvo-home.png` and `logos/tryzyvo.com.png` (approved) uploaded.
5. `registry.fly.io/zyvo-render:cm-slides` built and pushed.
6. One dry Run now in production: 2 slideshows done within 10 seconds, $0.

The 07:00 Helsinki daily dry run is on.

**Still to come:**
- First real run: the owner switches Dry run off in Settings.
- Shipping the page: laptop-transfer → main.
