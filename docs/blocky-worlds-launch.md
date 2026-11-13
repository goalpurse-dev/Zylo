# Blocky Worlds: soft launch of Studio mode v3 (checklist)

Prepared 2026-11-13. Nothing here is deployed, pushed or set yet: every step below is the owner's.
Code: `supabase/functions/_shared/blockyWorlds/studio.js` (the rules), `studioRuns.js` (fail + refund once, the sweeper),
`studioSupabase.ts` (tables + the ready email), `scripts/blockyWorlds/studioWorker/` (the worker),
migration `supabase/migrations/20261213100000_blocky_worlds_studio.sql`, tests `tests/blockyWorldsStudio.test.mjs`.

## What launches

```
customer: idea -> script (written, ~$0.15, free to them) -> reads + edits it (same kit checks, Fix it) -> "Make my video"
                                                                                                    | charge (one transaction)
blocky-worlds-api start: kit checks again -> a Studio worker alive? -> emergency cap -> compute_tool_price
                         -> blocky_worlds_start_run(..., p_engine 'studio')  -> run row "queued" (nothing sent anywhere)
Studio worker (Fly, CPU):  claim (oldest first, SKIP LOCKED) -> voice (Scruffy Duck, eleven_v3, 1.25x + pause cuts)
                         -> plan + mix -> ONE Sonnet director (previews on RunPod gm9eqdkuyc2ofs, ONE fixed Sonnet checker,
                            ONE fix round) -> final frames on RunPod (3 parallel jobs) -> encode + mux -> web copy + poster
                         -> upload to blocky-worlds-renders -> run "done"     (every stage written to the run row)
sweeper (pg_cron, every minute, blocky-worlds-render): dead worker / stuck run -> failed + refunded; "your video is ready"
                         emails (through the email gate); owner alerts for runs the worker failed
```

- **Fast mode stays OFF**: the storyboard path is only the pipeline engine with `BLOCKY_WORLDS_STORYBOARD=auto`. Leave it unset.
- **Limits per video** (studio.js `STUDIO`): agent cap **$3** (director + checker), run cap **$4** (everything), director clock
  25 min, whole run 45 min from the claim, no heartbeat for 6 min = worker lost, queued 45 min without a worker = refunded.
  Every paid step is checked against the caps BEFORE it is paid (the Studio ledger's `check`).
- **Any failure = one clean refund** (`blocky_worlds_refund` marks the row first; worker and sweeper both call the same
  `failRun`, a second call does nothing). Tested in `tests/blockyWorldsStudio.test.mjs` (step failure, cap, deadline,
  paid switch, SIGTERM, sweeper mid-run, empty director, empty script).
- **The customer's text is DATA**: cleaned (`sanitizeScript`: no `<` `>`, no control characters, bounded) and put only in
  the director's `<story_script>` block; the system prompt, the four tools and the shot-code whitelist validator are fixed
  in code (tested: one data block only; `process.exit`, `fetch`, `eval`, `constructor` tricks are refused).
- **Keys live only in the worker's Fly secrets.** The edge functions hold no Anthropic / ElevenLabs / RunPod key for
  Studio. The ready email goes from the sweeper through `_shared/userEmail.ts` (the one gate, category "account").

## Script approval (requirement 1): how it works and how it is charged today

Already there before this change, and kept:
- After "Write" the script shows in parts, every line editable (`ScriptStep.jsx`). An edit is saved with "Save and check"
  (`saveScript`), which runs the **same kit checks** as the writer in launch mode (`draftCheck(..., { board: true })`);
  a line the kit can't film is marked in red with **Fix it** (rewrites only that part), and "Move it to our town" for a
  whole-story miss. "Make my video" stays locked until the script is clean.
- **Writing is not charged**: scripts, rewrites and Fix it are free for paid plans within a daily limit
  (`WRITING.dailyScripts` = 15/day), logged in `blocky_worlds_ai_calls` and counted in the 24 h emergency cap. Their cost
  is inside the video price (the "writing" part below).
- **The charge happens once, at "Make my video"**: `start` re-checks the script on the server, then
  `blocky_worlds_start_run` deducts the credits and creates the run in ONE transaction. The voice and everything after it
  are bought only after that, by the worker.

Closed gaps (this change): the button says **"Make my video"**, and the script step says "Nothing is charged until you
press Make my video."

### No kit refusals with Studio (owner, 2026-11-13; `_shared/blockyWorlds/studioBuilds.js`)
With `BLOCKY_WORLDS_ENGINE=studio` "not in the kit" never blocks a story: not in the writers, the idea filter, script
approval, the customer's edits, Fix it, or quote / start. The kit is a PREFERENCE in the writers' prompts (`board:
"prefer"`); board mode (`BLOCKY_WORLDS_LAUNCH`, the pipeline) is unchanged.
- **Builds instead of refusals**: every thing the kit lacks goes on the run's `studio_builds` (written at start, in the
  same update as the idea card, before a worker can claim the run). The worker looks each one up in the Studio asset
  library (`studio/library/library.mjs` `lookup(name, kind)`: owner-approved entries only; `studioWorker/assets.mjs`) and
  hands the list to `directVideo({ builds })`, each with its approved entry when found; the director's brief lists them
  as delimited data (`<story_builds>`) plus each approved build's code. Only things go on the list: verbs, sounds and
  abstract words never (`usedAsThing`: a determiner, possessive or number before the word, plus a stop list).
  Format: `[{ name: "plane", kind: "creature" | "prop" | "set" | "vehicle", lines: [0-based], description: "the lines
  that name it, at most 240 characters" }]`.
- **What still blocks** (the customer sees Fix it): a real brand or logo (`BRANDS`), a famous character / story / game
  and unsafe words (safety.js, as in every mode), and a story with nothing physical to show (`abstractOnly`, a
  rewrite). Library ideas are hidden only for the first three.

## Price (requirement 4): APPLIED locally (owner OK 2026-11-13, commit b31ff0e5; not deployed)

1 credit = $0.01 of our full cost, the user pays $0.02 a credit (2x our cost). From `studio.js studioPriceTable` (the
measured Studio runs: run1, run2, testA, testA2, testB). pricing.js now prices with it; live still charges the old rows
(60 s 47, 90 s 62) until the deploy + migration below.

| Selected length | Real video* | Cuts | Writing | Voice | Director | Checker | Previews | Final | Worker+storage | Attempt | Full cost** | **Credits** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 30 s | ~35 s | ~32 | $0.175 | $0.060 | $0.289 | $0.033 | $0.010 | $0.031 | $0.013 | $0.61 | $0.65 | **66** |
| 60 s | ~70 s | ~65 | $0.200 | $0.120 | $0.540 | $0.055 | $0.015 | $0.051 | $0.013 | $0.99 | $1.08 | **108** |
| 90 s | ~104 s | ~97 | $0.225 | $0.180 | $0.789 | $0.078 | $0.021 | $0.071 | $0.013 | $1.38 | $1.49 | **150** |

All lengths: 30 s 66, 40 s 80, 50 s 94, 60 s 108, 70 s 122, 80 s 136, 90 s 150, 100 s 164, 110 s 178, 120 s 192,
130 s 206, 140 s 220, 150 s 234, 160 s 248, 170 s 262, 180 s 276. The owner's earlier plan of ~150 for 1:30 matches.

Assumptions:
- \*Scripts are sized at 257 wpm for the selected length, but the 1.25x voice with the pause cuts reads ~222 wpm
  (measured 213 / 218 / 232), so a video runs ~16% longer than selected (a "60 s" story was 64-72 s in every test).
- Writing: ~$0.15 for the script at 60 s (hybrid writer; library writes measured $0.04-0.10), scaling a little with
  length, + $0.05 of Fix it / rewrites.
- Voice: ElevenLabs eleven_v3 ~0.44 credits a character at $0.0002 = measured **$0.000466 a word** ($0.116-0.118 for 248-254 words).
- Director: Sonnet 5.5 at $2 in / $10 out / $0.20 cache read / $2.50 cache write: **$0.04 + $0.0077 a cut**, the fix
  round included (testA $0.583 for 69 cuts, testA2 $0.545 for 68). Cuts: **56 a minute** of real video (53-58 measured).
- Checker: Sonnet low effort, two passes: **$0.01 + $0.0007 a cut** (testA $0.053, testA2 $0.066).
- RunPod 16 GB at $0.58/h: previews **~30 s + 1 s a cut** billed (71-141 s measured); final **23 s a job + 0.149 s a
  frame** at 24 fps with 3 jobs (286-343 s billed for 64-72 s videos).
- Worker CPU (Fly shared-cpu-2x, ~15 min a video) + storage: $0.013. The always-on machine itself is ~$20-25 a month,
  not in the per-video number.
- Failures: 90% pass; a refunded failure costs ~voice + director + checker + previews; its share is in "Full cost".
- Not in the table: the old pipeline's estimates; the test-only `checkFinal` / vision audit calls (not in production).

**Applied** from `docs/blocky-worlds-studio-prices.patch` (kept as the record: pricing.js uses `studioFullCostUsd`, migration
`20261214100000_blocky_worlds_studio_prices.sql` with the 16 rows, the pricing test pinned to 108 / 150 / 192). To go live:
deploy `blocky-worlds-api` (the page shows PRICES) and right after it run the migration (the charge reads the rows):
`npx supabase db query --linked -f supabase/migrations/20261214100000_blocky_worlds_studio_prices.sql` and
`npx supabase migration repair --linked --status applied 20261214100000`.
Note: the prices apply to both engines (one price row per length).

## Launch checklist (owner)

### 0. Before anything (read-only)
- [ ] `npx supabase migration list --linked`: every Blocky Worlds migration up to `20261205200000` shows local + remote
      (checked 2026-11-13: yes); `20261213100000` shows local only until step 2.
- [ ] Back up the live functions before replacing them (the live ones may differ from any branch): download
      `blocky-worlds-api`, `blocky-worlds-render`, `ops-health` into a folder OUTSIDE the repo
      (`npx supabase functions download <name> --use-api`, CLI 2.80+) and diff them against this branch.
- [ ] No Studio run in progress before any worker redeploy (SQL editor):
      `select id, studio_stage, worker_id from public.blocky_worlds_runs where engine = 'studio' and status not in ('done','failed');`

### 1. The scoped merge (laptop-transfer -> main)
laptop-transfer is 29 commits ahead of main; besides Blocky Worlds it has a Cutaway margin card (`bff8b0a0`:
`src/pages/admin/Ops.jsx`, `supabase/functions/_shared/cutaway/margin.js`, `supabase/functions/cutaway-api/index.ts`,
`tests/cutawayMargin.test.mjs`) and the `cutaway-work` merge (`bef5f4c6`). Proposal: a branch off main with only the
Blocky Worlds paths (run in a clean checkout; the working folder is shared with other sessions):
```
git switch -c blocky-worlds-studio-launch main
git checkout laptop-transfer -- scripts/blockyWorlds supabase/functions/_shared/blockyWorlds \
  supabase/functions/blocky-worlds-api supabase/functions/blocky-worlds-render supabase/functions/blocky-worlds-library \
  src/components/viral-tools/blocky-worlds supabase/migrations/20261213100000_blocky_worlds_studio.sql \
  supabase/functions/_shared/opsHealth.js supabase/functions/ops-health/index.ts \
  docs/blocky-worlds-launch.md docs/blocky-worlds-studio-prices.patch \
  tests/blockyWorlds.test.mjs tests/blockyWorldsBoardFit.test.mjs tests/blockyWorldsBoardSwap.test.mjs \
  tests/blockyWorldsBoardUi.test.mjs tests/blockyWorldsBroad.test.mjs tests/blockyWorldsChecks.test.mjs \
  tests/blockyWorldsFormula.test.mjs tests/blockyWorldsHybrid.test.mjs tests/blockyWorldsLength.test.mjs \
  tests/blockyWorldsLibrary.test.mjs tests/blockyWorldsOwnerGate.test.mjs tests/blockyWorldsTopic.test.mjs \
  tests/blockyWorldsStudio.test.mjs
node --test tests/blockyWorlds*.test.mjs tests/blocky*.test.mjs tests/opsHealth.test.mjs
git commit -m "Blocky Worlds: Studio engine soft launch (scoped from laptop-transfer)"
```
Files of this change (the rest of the list is Blocky Worlds work already on laptop-transfer): `studio.js`,
`studioStages.js`, `studioRuns.js`, `studioSupabase.ts`, `renderRuntime.js`, `renderSupabase.ts`, `contract.js`,
`blocky-worlds-api/index.ts`, `blocky-worlds-render/index.ts`, the migration, `scripts/blockyWorlds/studioWorker/*`,
`engine/runpod/client.mjs`, `engine/dev/simple/bundle.mjs`, the page files (`ScriptStep.jsx`, `ResultPanel.jsx`,
`BlockyWorldsStudio.jsx`, `api/blockyWorldsApi.js`, `dev/devApi.js`), `opsHealth.js`, `ops-health/index.ts`, the tests,
this doc and the patch. Never: `scripts/blockyWorlds/engine/lib/vision/replan.js` (another session's edit), `reference/`.

### 2. The migrations (20261213100000 now; 20261214100000, the prices, right after the blocky-worlds-api deploy in step 4)
```
npx supabase db query --linked -f supabase/migrations/20261213100000_blocky_worlds_studio.sql
npx supabase migration repair --linked --status applied 20261213100000
npx supabase migration list --linked        # 20261213100000 now local + remote
```
Safe on live: additive columns with defaults (existing runs stay `pipeline`), a new table, a new claim function;
`blocky_worlds_start_run` gets `p_engine` with a default (the old call keeps working). Apply it BEFORE the functions.

### 3. The worker app (Fly), created and deployed by the owner
```
node scripts/blockyWorlds/studioWorker/buildContext.mjs            # -> <temp>/zyvo-blocky-studio-build (outside the repo)
cd <that folder>
fly apps create zyvo-blocky-studio                                  # the name in fly.toml; pick the org Cutaway uses
fly secrets import -a zyvo-blocky-studio < <a file you write and delete after: NAME=value lines>
fly deploy -a zyvo-blocky-studio --ha=false --remote-only           # the build runs `worker.mjs --smoke`
fly scale count 1 -a zyvo-blocky-studio                             # 1 machine = 1 video at a time
fly logs -a zyvo-blocky-studio                                      # "worker fly-... up; polling every 10 s"
fly ssh console -a zyvo-blocky-studio -C "node scripts/blockyWorlds/studioWorker/worker.mjs --check"
```
Worker secrets (names only): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`,
`RUNPOD_API_KEY`. Optional: `BLOCKY_WORLDS_STUDIO_ENDPOINT` (the RunPod endpoint; default gm9eqdkuyc2ofs, see step 6),
`BLOCKY_WORLDS_WORKER_VERSION` (shown in the worker table). `--check` prints which are set,
never a value. Rebuild the context for every worker deploy (it copies the Studio code as it is at that moment).
A worker redeploy fails + refunds a run in progress (SIGTERM): deploy only when step 0's query is empty.

### 4. The functions
```
npx supabase functions deploy blocky-worlds-api
npx supabase functions deploy blocky-worlds-render --no-verify-jwt
npx supabase functions deploy ops-health                              # the RunPod alert (below)
```
Download each one afterwards and diff it against the branch (the deploy-only-committed rule).

### 5. Secrets and switches (Supabase function secrets, names only)
- `BLOCKY_WORLDS_ENGINE=studio`: new videos go to the Studio worker (unset = the old pipeline).
- `BLOCKY_WORLDS_READY_EMAIL=on`: "your video is ready" (an account email through the gate, once per run). Default off.
- Must already be set (the sweeper runs in blocky-worlds-render): `BLOCKY_WORLDS_CALLBACK_SECRET`,
  `BLOCKY_WORLDS_CRON_SECRET` (+ its vault copy for pg_cron). The emails need `RESEND_MAIL_API_KEY` and
  `EMAIL_UNSUBSCRIBE_SECRET` (set for the other emails).
- Leave unset / off: `BLOCKY_WORLDS_STORYBOARD` (fast mode), `BLOCKY_WORLDS_PAID_CALLS=off` (a hard stop if ever needed).
- Optional: `BLOCKY_WORLDS_RUNPOD_API_KEY` (ops-health reads the balance with it, else with `CUTAWAY_RUNPOD_API_KEY`: one account).

### 6. RunPod
- Endpoint **gm9eqdkuyc2ofs** (`zyvo-blocky-render`, image blocky-simple29, build 20261112T203600-51dcc5bc1a2b,
  workersMax 6). Studio needs **no image rebuild**: it ships its page code in each job through the image's `simpleStills`
  role (`studio/bundle.mjs`, IMAGE_SINCE 83fe6397). Never the Cutaway endpoint f66astc0vrus92 (the worker refuses it).
- One Studio video uses 1 preview job at a time, then 3 final jobs at once: with 6 workers, 2 Studio machines fit.
  Raise workersMax before adding a third worker machine.
- **A separate production endpoint is advised before "everyone"**: today owner tests and customers share gm9eqdkuyc2ofs,
  so a test burst slows customers and a test image change reaches them. It is now a setting: create the endpoint from
  the same template / image, then `fly secrets set -a zyvo-blocky-studio BLOCKY_WORLDS_STUDIO_ENDPOINT=<its id>` (the
  setting wins over `engine/runpod/endpoint.json` in the worker's config and in `studio/render.mjs`; the Cutaway endpoint
  and a malformed id are refused; unset = gm9eqdkuyc2ofs, which `endpoint.json` must then name).
- **Low-balance alert**: ops-health's RunPod check now reads `BLOCKY_WORLDS_RUNPOD_API_KEY` or the Cutaway key (one
  account), and turns RED (instant alert + the daily email) once `BLOCKY_WORLDS_ACCESS` is allowlist or everyone, when the
  balance runs out within 3 days **or drops under $10**. Owner-only mode: shown, never red. Keep RunPod auto-pay on.

### 7. Daily spend caps
- Per video: $3 agent cap, $4 run cap (code: studio.js `STUDIO`).
- Template emergency cap (shared by both engines and the writing): `blocky_worlds_settings.daily_cap_usd`, default **$20 a
  day** (~13-18 Studio videos with their scripts). The worker also stops taking runs when it is reached or when
  `paid_calls` is false (a waiting run is refunded after 45 min). Raise it in the SQL editor, e.g. for the soft launch:
  `update public.blocky_worlds_settings set daily_cap_usd = 30, updated_at = now() where id = 1;`
- Per user: 2 videos at once, 10 starts an hour (same table).

### 8. Owner test (paid: ~$1.10 for one 60 s video; ask before running it)
- [ ] With `BLOCKY_WORLDS_ACCESS=owner`: write a script, edit a line, "Save and check", "Make my video".
- [ ] The page shows the **Beta** label and "Your video is being directed ... About 10 minutes. You can leave this page".
- [ ] Stages move: Recording the narrator, Timing every line, Directing every shot, Test-shooting, Checking, Fixing,
      Rendering, Finishing (the worker's log says the same).
- [ ] Done: video plays, download works, the ready email arrives (if switched on).
- [ ] Cost: `select stage, sum(usd) from public.blocky_worlds_cost_ledger where run_id = '<id>' group by stage;`
- [ ] Refund drill without a paid call: `update public.blocky_worlds_settings set paid_calls = false where id = 1;`, start
      a video (start refuses: nothing charged), set it back to true. A real failure's refund shows as
      "Your N credits are back." on the failed run (`refunded_at` set).

### 9. Opening it
- Testers: `BLOCKY_WORLDS_ACCESS=allowlist` + `BLOCKY_WORLDS_TEST_USERS=a@x.com,b@y.com` (their runs are env "test").
- Everyone: `BLOCKY_WORLDS_ACCESS=everyone`.
- The owner list: `BLOCKY_WORLDS_OWNER_EMAILS` (replaces the built-in list when set). Unknown values fail closed (owner).

### 10. Rollback
- **New videos back to the old pipeline** (or off): unset `BLOCKY_WORLDS_ENGINE` (pipeline, if `BLOCKY_WORLDS_RENDERER=runpod`
  is set) or set `BLOCKY_WORLDS_RENDERER` to anything else ("Video making switches on soon", nothing charged). Runs keep
  their engine: running Studio videos still finish on the worker.
- **Stop the worker**: `fly scale count 0 -a zyvo-blocky-studio`. The run in progress is failed + refunded at once; queued
  Studio runs are refunded by the sweeper after 45 min, or at once (SQL editor):
  `update public.blocky_worlds_runs set status = 'failed', error_code = 'PAUSED', error_message = 'switched off by the owner', finished_at = now() where engine = 'studio' and status not in ('done','failed');`
  then `select id, public.blocky_worlds_refund(id) from public.blocky_worlds_runs where engine = 'studio' and error_code = 'PAUSED' and refunded_at is null;`
- **Code**: redeploy the downloaded backups from step 0. The migration needs no rollback (additive; the old call works).
- **Prices** (if applied): re-run `supabase/migrations/20261205100000_blocky_worlds_lengths.sql` (the old rows) and revert the patch.

## Needed inside scripts/blockyWorlds/studio/ (the Studio session's files; not changed here)
- `shotCheck.mjs`: the vm pre-check runs the director's (validated) code in the worker's process, which holds the service
  key; running it in a child process with an empty environment would make that boundary hard.
- `render.mjs` / `client.mjs`: previews and frame packs go through the `generated` bucket's `blocky-worlds-test/` folder
  (cleaned after each job); a production folder would separate them from the owner's tests.
