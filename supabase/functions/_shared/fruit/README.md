# AI Fruit Story engine

## Duplicated in Blocky Stories: change BOTH when a provider or model changes

Blocky Stories (`../blocky/`) started as a full copy of this engine
(2026-10-06) and shares no code with it: nothing here imports from
`../blocky/` and nothing there imports from here. These files are still the
same code under other names, so a change of provider, model, price, API shape
or a bug fix in one almost always belongs in the other too. The twin of each
is `../blocky/<same name>`.

| File | What it holds |
|---|---|
| `models.js` | Every model id and its settings (writer, script editor, small tasks, pictures, clips V2 / V3 / V4) |
| `llm.js` | The Anthropic and OpenAI calls, token prices, structured answers |
| `runware.js` | The Runware request envelope, result parsing, webhook tokens |
| `alerts.js` | The "our provider balance ran out" guard and its email |
| `engine.js` | The job runner: submit, poll, retry, refund, checks |
| `steps.js`, `storyState.js` | What each paid step charges for and when it is allowed |
| `supabaseStore.js` | Database and storage access for the engine |
| `final.js` | The final-video job for the Fly machine |
| `clipCheck.js`, `captionWords.js`, `spoken.js` | Speech-to-text check of every clip, caption timing |
| `duration.js`, `limits.js`, `shots.js`, `errors.js`, `smallTasks.js`, `plannerService.js` | Clip length rule, limits, shot list, error codes, small model tasks, the writer's retries |

Also duplicated outside this folder: `render-worker/src/fruitFinal.mjs`,
`fruitFinalPlan.mjs`, `fruitCaptions.mjs` (twins: `blockyFinal*.mjs`,
`blockyCaptions.mjs`), and the SQL functions `fruit_charge_step`,
`fruit_refund_job`, `fruit_complete_job`, `fruit_refresh_story_status`,
`fruit_create_story` (twins: `blocky_*`).

This note is the only file Blocky Stories added to this folder. It is not
imported by anything, so it is not part of any deployed function.
