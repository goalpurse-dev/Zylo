# AI Fruit Story v2 — Phase 3 checklist

Phase 2 shipped the v2 UI on a mock backend. Phase 3 replaces the mock with the real one **without touching UI components**: implement the `FruitStoryV2Adapter` interface documented in `src/components/viral-tools/ai-fruit-story-v2/api/fruitStoryV2Api.js`, then install it with `setFruitStoryV2Adapter(realAdapter)` (and drop the preview banner, which reads `isMockBackend()`).

Everything below is what the mock currently fakes.

## 1. Adapter functions

| Function | Must do | Mock today |
|---|---|---|
| `listCharacters()` | Serve the character library (id, name, fruit, tag, role, gender, **locked reference image**, voiceStyle). | 20 hardcoded characters, 11 with existing art. |
| `getIdeas({seed})` | Exactly 5 ideas per call, **library characters only** (2–3 castIds each). Different `seed` → different ideas. | Two fixed pages of 5. |
| `createStory(input)` | Write the script: one scene = one character saying one line. Validate: 1–3 cast (single), prompt ≤ 1000 chars, script lines used **exactly as written** with speakers in the cast, length 15–120 s in 15 s steps, **max 3 characters present per scene**, episode must be unlocked. Returns `status: "draft"`. Nothing is charged. | Line bank; validation as described. |
| `generateScenePictures(storyId)` | Start one image job per scene (reference images = locked character refs + previous scene for continuity). Charge per picture. Status `pictures` → `pictures_ready` when every picture is terminal. | Timed placeholders painted on canvas. |
| `editScene(sceneId, instruction)` | Regenerate the picture with "keep everything, change X". Charge one picture. Only before animating. | Appends the instruction to the prompt. |
| `regenerateScene(sceneId, prompt)` | Regenerate from the edited description. Charge one picture. Only before animating. | Same as edit. |
| `animateAll(storyId)` | Refuse unless every picture is ready. One video job per scene, clip length = `scene.durationSec`, the line spoken with the character's voice. Charge per clip. `animating` → `clips_ready`. | Sample mp4s. |
| `regenerateClip(sceneId)` | Re-animate one clip. Charge one clip. | Sample mp4. |
| `buildFinal(storyId, {captions})` | **Free.** Join clips in order, trim silence between lines (report `trimmedSec` and `trimmedPerClipSec`), optional burned-in captions (speaker name + line). `building` → `final_ready`; on failure back to `clips_ready` with `final.status = "failed"`. Rebuilding with a different `captions` value must work. | Sample final mp4. |
| `getStory` / `subscribeStory` | Live updates for every scene and final status. Connect to realtime on `jobs` (and a stories table). `subscribeStory` is **synchronous** and returns an unsubscribe function. | In-memory listeners. |
| `listSeries` / `getSeries` | Series with episodes: `made` / `next` / `locked`, unlocking in order (an episode is `made` once its final is ready). | In-memory. |
| `createSeriesPlan(input)` | **Free.** Validate concept ≤ 1000 chars, cast 2–5, episodes 3–10. Write title, logline and per-episode title / what happens / cliffhanger. Roles are fixed across episodes; the tone shapes every line. | Episode templates. |
| `listRecent({type})` | Singles (with up to 3 scene thumbnails and status) and series summaries (episodeCount, madeCount). Newest first. | Seeded samples + session items. |

Errors: validation problems throw `Error` with a **plain-language `message`** (shown to the user as-is, e.g. "Pick 1 to 3 characters."). System failures set `error.code` ending in `_FAILED` (e.g. `STORY_FAILED`); the UI then shows its own copy that says what to do next ("Nothing was charged. Try again."). See `constants.js#errorText`.

## 2. Pricing

- Scene pictures, edits and regenerations already use the **exact** server quote (`image:fruit-v2`, 2 credits today).
- Clips are **estimated** in `pricing/fruitV2Estimates.js`. Today's price rows accept one clip length per tier (`video:fruit-v2`/`-v3`: 5 s, `video:fruit-v4`: 6 s), but v2 needs 4–6 s per line. To make clip prices exact:
  1. Add per-second fruit video rows that accept 3–8 s clips (and 9:16 / 16:9 sizes), keeping V2/V3/V4 plan gating.
  2. Quote each scene's clip (`tool_key`, `durationSec`, `width`, `height`, `withSound: true`) and sum them for "Animate all".
  3. Delete the rate derivation in `fruitV2Estimates.js`.
- The server must charge exactly what `quote_tool_prices` returns for the same inputs (the display-equals-charge rule).
- The mock never charges. The real adapter charges through the jobs pipeline as today (trigger-priced).

## 3. Backend limits that block v2 today

- The Fruit edge functions only accept **3/5/7/10 scenes** (security hotfix #1) and plan with a 30 s timeout. v2 needs 3–24 scenes (15 s–2 min at ~5 s per line).
- Scene-count and length rules must be enforced server-side, not only in the UI.
- No server-side final assembly exists today (no stitch, no silence trim, no captions).
- Script mode ("used exactly as written") has no backend path.
- No series, story or character-library tables exist yet.

## 4. Data model (suggested)

- `fruit_characters` (library, with locked reference image URLs; read-only to users)
- `fruit_stories` (owner, source, cast, quality, length, aspect, status, series_id, episode_number, final fields)
- `fruit_scenes` (story_id, index, speaker, line, present ids ≤ 3, duration, image/clip job ids, statuses, prompt, error)
- `fruit_series` (owner, title, logline, cast 2–5, tone, opener) + `fruit_episodes` (series_id, number, title, summary, cliffhanger, story_id)
- RLS: owner-only; status and price columns written only by the service role (jobs-style write guard).

## 5. Rollout

1. Apply `20261012100000_user_feature_flags.sql` (reviewed separately) and set `fruit_v2` for internal testers.
2. Build with `VITE_FRUIT_V2=true`.
3. Install the real adapter; remove the "Preview mode" banner path.
4. When v2 replaces v1: delete `AIFruitStoryV1` and the gate in `src/pages/workspace/AIFruitStory.jsx`.

## 6. What the UI already handles (no Phase 3 work)

Loading, empty, error and not-enough-credits states on every screen; per-scene and per-clip failures with a priced fix; plan locks and the upgrade dialog; the paywall for guests and free plans; mobile page-scroller layout; keyboard focus, focus-trapped dialogs and reduced motion.
