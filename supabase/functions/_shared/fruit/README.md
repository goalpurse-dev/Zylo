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

## Fixes ported from Blocky to Fruit

The two engines are separate copies, so a fix never travels on its own. Fixes
that started in Fruit and went to Blocky are listed in
`../blocky/README.md` ("Fixes ported from Fruit"). Fixes that started in
Blocky and came here are listed below, newest first. A port into Fruit is
made only on the owner's request, and deployed only on the owner's go.

| Date ported | Blocky commit | What the fix does | In Fruit | Live on `fruit-worker` / `fruit-story-api` |
|---|---|---|---|---|
| 2026-10-08 | `2935ffa` (laptop-transfer) | ONE caption track. The video model (Wan) sometimes draws its own subtitles into a clip although the prompt forbids them; the final video then drew ours on top (two lines at once). Now: the Wan request also carries a negative prompt against drawn text; the clip check looks at two frames from the middle of the line (the model's subtitles are gone by the last frame) and a clip with drawn words is made again once at our cost; a remade clip is looked at again; a clip that still carries drawn words gets no caption of ours in the final video. | `clips.js`, `clipCheck.js`, `pictureCheck.js`, `engine.js`, `final.js`, `fruit-worker/index.ts`, `fruit-story-api/index.ts`, `tests/fruitOneCaptionTrack.test.mjs`, `tests/fruitQualityRules.test.mjs` | YES: deployed 2026-10-08 09:11 UTC from laptop-transfer on the owner's go (0 Fruit jobs in flight; Fruit's smoke check passed before and after). Not on main yet: a deploy of Fruit's functions from main would take it out again |
| 2026-10-08 | `cbb630b` (laptop-transfer) | The next-model step, asked for by the owner. The test clip showed the same model drawing the same subtitles again for the same line, so a clip with drawn subtitles is NOT made again on its own model: it goes straight to the tier's next clip model (V2: Wan → Seedance 2.0 Mini), once, at our cost, and that clip is checked too. If it carries them as well, the final video leaves our caption off it. A tier with no next model (V3, V4) keeps its one remake on its own model. Other clip faults are unchanged (one remake on the same model). | `engine.js`, `supabaseStore.js`, `fruit-worker/index.ts`, `tests/fruitOneCaptionTrack.test.mjs`, `tests/helpers/fruitMemoryStore.mjs` | YES: deployed with the row above, 2026-10-08 09:11 UTC |

This README is not imported by anything, so it is not part of any deployed
function.
