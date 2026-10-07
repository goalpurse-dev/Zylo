# Blocky Stories engine

Blocky Stories is its own product. This folder, `blocky-story-api`,
`blocky-worker`, the `blocky_*` tables and RPCs, the page in
`src/components/viral-tools/blocky-stories/` and the final-video builder in
`render-worker/src/blocky*.mjs` are Blocky's alone. Nothing here imports from
`_shared/fruit/`, and nothing in Fruit imports from here
(`tests/blockySeparation.test.mjs` fails if either ever happens). Deploying
Blocky never needs a Fruit function to be redeployed.

The only things shared with the rest of the app are the platform's: `profiles`
(the one credit balance), `tool_prices` + `compute_tool_price`, the rate
limiter, the feature flags, `../shared/cors.ts`, the `generated` storage
bucket and the Fly render app.

## Duplicated on purpose: change BOTH when a provider or model changes

The engine started as a full copy of AI Fruit Story's (2026-10-06). These
files are still the same code under other names, so a change of provider,
model, price, API shape or a bug fix in one almost always belongs in the
other too. The twin of each is `../fruit/<same name>`.

| File | What it holds |
|---|---|
| `models.js` | Every model id and its settings: the writer (Claude Sonnet), the script editor (Claude Haiku), small tasks and picture checks (gpt-5-mini), pictures (Nano Banana 2 Lite), clips V2 Wan 2.6 Flash, V3 Seedance 2.0 Mini, V4 Veo 3.1 Fast |
| `llm.js` | The Anthropic and OpenAI calls, token prices, structured answers |
| `runware.js` | The Runware request envelope, result parsing, webhook tokens |
| `alerts.js` | The "our provider balance ran out" guard and its email |
| `engine.js` | The job runner: submit, poll, retry, refund, checks, the one free redraw / remake |
| `steps.js`, `storyState.js` | What each paid step charges for and when it is allowed |
| `supabaseStore.js` | Database and storage access for the engine |
| `final.js` | The final-video job for the Fly machine |
| `clipCheck.js`, `captionWords.js`, `spoken.js` | Speech-to-text check of every clip, caption timing |
| `duration.js`, `limits.js`, `shots.js`, `errors.js`, `smallTasks.js`, `plannerService.js` | Clip length rule, limits, shot list, error codes, small model tasks, the writer's retries |

Also duplicated outside this folder: `render-worker/src/blockyFinal.mjs`,
`blockyFinalPlan.mjs`, `blockyCaptions.mjs` (twins: `fruitFinal*.mjs`,
`fruitCaptions.mjs`), and the SQL functions `blocky_charge_step`,
`blocky_refund_job`, `blocky_complete_job`, `blocky_refresh_story_status`,
`blocky_create_story` (twins: `fruit_*`).

## Fixes ported from Fruit

Standing rule (owner, 2026-10-07): whenever AI Fruit Story's engine gets a fix,
in this session or any other, check whether Blocky's copy has the same fault
and port the fix with its tests. Every one is listed here, newest first, so it
is always plain what Blocky has and what it is missing. A Fruit change that
Blocky does not need is listed too, with the reason.

| Date ported | Fruit commit | What the fix does | In Blocky | Live on `blocky-worker` / `blocky-story-api` |
|---|---|---|---|---|
| 2026-10-07 | `e1e1583` (main, 2026-10-07) | A job is given up on after 30 minutes, not 8 (picture) or 12 (clip): Runware delivered clips after we had refunded them. A status read the provider fumbles (429, 5xx, a balance refusal) is "no news yet", not a failed job: the job used to be sent again and paid twice. A balance refusal from our provider account waits and is retried every 5 minutes for 30 minutes before the refund. | `engine.js`, `tests/blockyEngine.test.mjs`, `tests/blockyProviderGuard.test.mjs` (commit `f4c5408`) | yes: both deployed 2026-10-07, 20:09 and 20:12 UTC, checked file by file against the branch |

Last compared with Fruit: 2026-10-07, Fruit at commit `f4c5408`, fingerprint `9ac0ea04aa424ab4`

How it is kept: `tests/blockySeparation.test.mjs` fails as soon as one of
Fruit's twin files differs from that fingerprint, in whatever session changed
it. Then: `node scripts/blocky/fruitFixes.mjs` lists the Fruit commits since
the last comparison; port the fix with its tests (or note why it does not
apply), add a row above, and run `node scripts/blocky/fruitFixes.mjs --mark`.
Deploying the ported fix to Blocky's functions needs the owner's go.

## Blocky's own (no twin)

`look.js` (what an avatar is and how the world looks), `rules.js` (writer,
series planner, script editor, picture check, upload pack), `safety.js` (real
names that are never allowed), `names.js`, `spendGuard.js` (paid calls off by
default, and the daily spending cap), and the Blocky wording in
`pictures.js`, `clips.js`, `planner.js`, `series.js`, `scriptReview.js`,
`uploadPackage.js`, `pictureCheck.js`, `plates.js`, `validation.js`.

Every prompt these build is pinned byte for byte in
`tests/fixtures/blockyPromptSnapshot.json`.
