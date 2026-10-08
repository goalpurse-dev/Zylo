# AI Fruit Story engine

## Fixes ported from Blocky to Fruit

Blocky Stories is a separate product with its own copy of this engine (it lives
on the `laptop-transfer` branch and shares no code with Fruit), so a fix made
in one never reaches the other on its own. Fixes that started in Blocky and
were brought here are listed below, newest first. A port into Fruit is made
only on the owner's request, and deployed only on the owner's go.

| Date ported | Blocky commit | What the fix does | In Fruit | Live on `fruit-worker` / `fruit-story-api` |
|---|---|---|---|---|
| 2026-10-08 | `2935ffa` (laptop-transfer) | ONE caption track. The video model (Wan) sometimes draws its own subtitles into a clip although the prompt forbids them; the final video then drew ours on top (two lines at once). Now: the Wan request also carries a negative prompt against drawn text; the clip check looks at two frames from the middle of the line (the model's subtitles are gone by the last frame) and a clip with drawn words is made again once at our cost; a remade clip is looked at again; a clip that still carries drawn words gets no caption of ours in the final video. | `clips.js`, `clipCheck.js`, `pictureCheck.js`, `engine.js`, `final.js`, `fruit-worker/index.ts`, `fruit-story-api/index.ts`, `tests/fruitOneCaptionTrack.test.mjs`, `tests/fruitQualityRules.test.mjs` | YES: deployed 2026-10-08 09:11 UTC on the owner's go (0 Fruit jobs in flight; Fruit's smoke check passed before and after) |
| 2026-10-08 | `cbb630b` (laptop-transfer) | The next-model step, asked for by the owner. The test clip showed the same model drawing the same subtitles again for the same line, so a clip with drawn subtitles is NOT made again on its own model: it goes straight to the tier's next clip model (V2: Wan → Seedance 2.0 Mini), once, at our cost, and that clip is checked too. If it carries them as well, the final video leaves our caption off it. A tier with no next model (V3, V4) keeps its one remake on its own model. Other clip faults are unchanged (one remake on the same model). | `engine.js`, `supabaseStore.js`, `fruit-worker/index.ts`, `tests/fruitOneCaptionTrack.test.mjs`, `tests/helpers/fruitMemoryStore.mjs` | YES: deployed with the row above, 2026-10-08 09:11 UTC |

This README is not imported by anything, so it is not part of any deployed
function.
