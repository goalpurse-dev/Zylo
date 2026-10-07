# Blocky Stories: Phase 0 audit and plan

Date: 2026-10-06. Scope: [roblox-scope.md](roblox-scope.md). Read-only audit of AI Fruit Story v2 on branch
`laptop-transfer` (`56b2265`), and the plan for serving Fruit and Blocky Stories from one engine.
Nothing was changed and no paid call was made. Line numbers are as of that commit.

Since this plan was written:
- Decisions are in [roblox-scope.md](roblox-scope.md) under "Decisions" and win where they
  differ: test 3 no longer tries a blank shape in a picture, Blocky Stories is a separate
  template with its own route and menu entries, and ideas are limited to 30 batches per user
  per day.
- `laptop-transfer` was reset to equal `main` on 2026-10-06. Blocky Stories commits are on the
  branch `parked/blocky-stories` (built on main), not on `laptop-transfer` as section 1f says.
- Test 1 (lip sync) ran on 2026-10-06 for $0.8539 (`scripts/blocky/test1LipSync.mjs`; results
  page https://claude.ai/artifact/ThoHBEVZ7SRWRHcYSXZSqW). All 3 Wan clips animated the decal
  mouth; "admin", "banned" and "hacked" passed the filter. Best face: a solid dark open-mouth
  shape with oval eyes on a cube head. Problems found: "classic smile" + yellow head + red cap
  drew a brick-toy minifigure; "studded bricks" drew that toy's baseplate floor in all three;
  Wan drew its own subtitles in 1 clip; flat teeth appeared in 2 clips; the two-avatar picture
  came out full body. 11-word lines fill a 5 s clip to the last frame.
- Test 1b (same clip C on the other tiers, `scripts/blocky/test1bTiers.mjs`): V3 = Seedance 2.0
  Mini ran for $0.4084 and is about the same as V2 on decal faces (lip sync 3/5, flat decal 3/5),
  with a harder camera push-in. V4 = Veo 3.1 Fast has NOT run: the worker's no-charge test action
  only accepts it from commit `e1428a9` on, and that needs `fruit-worker` deployed.
- Phase 2 (niche seam) is built up to the migration, which is NOT applied:
  `supabase/migrations/20261006190000_story_niches.sql`. Order when it goes live: the migration
  first, then `fruit-story-api` and `fruit-worker` (the new API filters every list by niche, so it
  needs the columns). Fruit's prompts are pinned by `tests/fruitPromptSnapshot.test.mjs`.
  Blocky is not `ready` yet: its writer, series, editor, picture-check and upload rules are
  Phase 3, and until then the API refuses to write a Blocky story.
- 2026-10-06, later: migration `20261006190000_story_niches.sql` is APPLIED (Fruit's live API
  checked after it with `scripts/blocky/smokeFruitLive.mjs`). `blocky_v1` is on for the owner's
  account only. The new `fruit-story-api` and `fruit-worker` are NOT deployed (decision 17).
  Blocky Stories is in the Short Form menus behind the flag, with a thumbnail
  (`public/templates/BLOCKY/thumbnail.png`); its name lives in one constant
  (`supabase/functions/_shared/fruit/niches/names.js`).
- Blocky's writer, series, editor, picture-check and upload-pack rules are written
  (`niches/blockyRules.js`), with the banned real-names check (`niches/blockySafety.js`) and the
  24-avatar roster as text (`scripts/blocky/roster.mjs`). Blocky stays `ready: false` until its
  library is approved.
- Tests 2 and 3 ran for $0.3748 (`scripts/blocky/test2Looks.mjs`; review sheet
  https://claude.ai/artifact/YCL5nwSzzcicTgAhMpFyh6). "Roblox-style" wording beats "blocky toy
  figure" (which drew a brick-toy minifigure 3 times out of 3), and the classic noob came out
  right. OPEN: 5 of 6 references have claw hands and the scenes copy them; the reference prompt
  must say what the arms are, then be re-tested. The location plate keeps 3 of 4 scenes in the
  same place with no studs. Nano Banana Pro (3 pictures) and the V4 Veo clip have NOT run: each
  waits for one small deploy the owner runs (`runware-bakeoff-proxy`, `fruit-worker` from `e1428a9`).
- Second look checkpoint (2026-10-06, decisions 18 to 24): every prompt now says "blocky game
  avatar" and carries the body-construction text (`BLOCKY_BODY` in `niches/blocky.js`). Re-test
  of the reference prompt ($0.1355, 4 Lite pictures): the text fix alone gives clean hands and
  neck; the Noob body template copies the Noob's flaws and is not used. Nano Banana Pro with the
  corrected prompt ($0.4140, 3 pictures at $0.1380): clean body and right colours on all three,
  one rounded head. Lite with the same prompt painted Vex's arms and legs the wrong colour.
  OPEN: the owner approves the look and chooses Lite or Pro for the 24 references. The scene
  style block with the body text has not been tested in a scene yet. The V4 Veo clip still
  waits for `fruit-worker` from `e1428a9` to be deployed (temp copy at `%TEMP%\zyvo-veo-deploy`).
- Still Fruit-worded inside the shared UI (for the UI skin phase): the story step's heading and
  placeholders, the script examples, the series questions, openers and tones, the upgrade copy,
  and the server messages in `errors.js`. Menu entries, thumbnail and landing page: not built.
- 2026-10-06, the separation (decisions 25 to 31 win over everything above about a shared
  engine, the niche seam, `niches/` and the deploy order). Blocky Stories is its own product:
  `supabase/functions/_shared/blocky/` (a full copy of the engine under Blocky's names, with
  its own wording in `look.js`, `rules.js`, `safety.js`), `blocky-story-api`, `blocky-worker`,
  `render-worker/src/blocky*.mjs`, `src/components/viral-tools/blocky-stories/`,
  `scripts/blocky/` (own helpers and budget guard, `BLOCKY_ALLOW_PAID=1`). The niche seam is
  removed and every Fruit file is main's again (`tests/blockySeparation.test.mjs`). All 76
  Blocky prompts are byte-identical to the ones recorded before the move
  (`tests/blockyPromptSnapshot.test.mjs`).
- Database: nothing new is applied. Waiting in `supabase/pending/`: the undo of
  `20261006190000_story_niches.sql` (Fruit's tables back to what they were) and Blocky's own
  backend (11 tables, the charge / refund / complete functions, copied from Fruit's LIVE
  definitions under Blocky's names). Both pass `scripts/blocky/sql/dryRun.mjs` (36 checks in a
  throwaway Postgres). Until the undo is applied, Fruit's live tables still carry the template
  columns; the live Fruit functions (main's code) never read them.
- 2026-10-07: the Docker / local-stack plan is dropped (decision 32). Blocky runs the way
  Fruit does: the site on localhost, Blocky's own functions and tables on the real project.
  Paid calls are off by default with a $3.00 daily cap (decision 33).
- 2026-10-07, on the real project: `20261026100000_blocky_stories_backend.sql` is APPLIED (12
  `blocky_*` tables; Fruit's shape and row counts identical before and after).
  `blocky-story-api` and `blocky-worker` are DEPLOYED (new functions; no Fruit function
  redeployed). `BLOCKY_WORKER_SECRET` is set (Supabase secrets + vault, with the worker's
  address), so the 20-second sweep works. The Fly image `zyvo-render:blocky-final` is built
  (`fruit-final` untouched). Noob, Vex and Lux are loaded as temporary avatars. Paid calls are
  OFF. Checks: `scripts/blocky/chargeLocking.mjs` 9 of 9 on a throwaway account;
  `scripts/blocky/smokeBlockyLive.mjs` 14 of 14; `scripts/blocky/qaPage.mjs` PASS at 1440 and
  390 px. Not done yet on the real project: a real story end to end (the owner makes the first
  one by hand), so Runware's callbacks to `blocky-worker` and the `blocky-final` build have not
  run for real. The Fruit undo is still in `supabase/pending/`, for the owner to apply.
- 2026-10-07, later: all Blocky work is on `laptop-transfer` (the owner's working branch, where
  `npm run dev` runs). `parked/blocky-stories` was merged into it with a plain merge and then
  deleted; the earlier notes above that name `parked/blocky-stories` are history. The state of
  `laptop-transfer` before the merge is the tag `backup/laptop-transfer-before-blocky-2026-10-07`.
  A push of `laptop-transfer` builds a Vercel Preview, never Production (only `main` does).
  No separate branches, worktrees or copies from now on.
- 2026-10-07, evening: the Fruit undo (`20261026090000_story_niches_undo.sql`) is APPLIED, 19:49
  UTC, with 0 Fruit jobs in flight. Fruit's tables have no template or overlay column any more;
  `fruit_pick_ideas` and `fruit_create_story` are the originals word for word; row counts are
  unchanged; Fruit's live API and Blocky both pass their checks after it. Nothing waits in
  `supabase/pending/`.
- 2026-10-07, evening: series in Blocky is behind its own flag, `blocky_series_v1`, off for
  everyone (no row, no account). The page shows single videos only and the API refuses every
  series action. No series code is removed; it is designed properly after single stories pass
  the quality review.
- 2026-10-07, evening: main's "generation hardening" changed AI Fruit Story's `engine.js` (give up
  after 30 minutes instead of 8 / 12; a failed status read is "no news", not a failed job; a
  balance refusal waits and retries instead of refunding at once). Blocky's twin `engine.js` does
  NOT have these three changes yet (see `_shared/blocky/README.md`: a fix in one almost always
  belongs in the other).

- 2026-10-08: the first real story worked end to end ("The Fake Admin Meets The Owner", 4 scenes,
  106 credits, $1.20 at the providers, final video 17.6 s). Found and fixed in code (decisions 36
  to 39): two caption lines at once (the video model's own subtitles under ours), picture warnings
  at 20% against a 22% line and still shown while animating, the signed-out redirect to a dead
  address. The same caption fault exists in AI Fruit Story's engine (same clip prompt, same
  last-frame-only check); Fruit's files are not Blocky's to change.

## Blocky UI/UX list (not built yet)

Things to design and build in the UI phase (phase 8), kept here so none is forgotten:

- **The page needs visuals** (owner, 2026-10-07; after the real avatar library is made). It should
  not feel text-only:
  - avatar pictures in the character picker (the chips and the "Choose your characters" row, not
    only inside the library dialog);
  - example story images or a preview on the right side, instead of the text-only "Make your first
    story" box;
  - the example video on the Recent panel (`EXAMPLE_VIDEO` in the page's `constants.js` is empty
    until one is made).
- Series: its own design pass before the `blocky_series_v1` flag is switched on.
- Story ideas: the idea cards ("Pick an idea"), once the idea engine exists.
- Phase 3 (the look) stopped at the review of 2026-10-06 and continues after the separation:
  the Pro reference pilot with the head / tongue / front-view / blocky-hair fixes, the 24
  references, the scene re-test, 5 real stories from the writer. The Veo clip of test 1b runs
  on `blocky-worker`.

## 1. Fruit v2 status

- **a) Pushed and merged.** Fruit v2 is on `origin/main` (tip `c027734`, 2026-10-06), which is
  production. This folder's branch `laptop-transfer` (`56b2265`) is pushed and in sync.
  `git diff origin/main HEAD` shows no Fruit difference; the only extra work on
  `laptop-transfer` is the email outbox and Long Form emails. Branches `fruit-v2` and
  `release/fruit-v2` are fully merged and stale.
- **b) Live for everyone.** `global_feature_flags.fruit_v2` is `true` in the live database
  (read today; set 2026-09-30 22:41 UTC). `VITE_FRUIT_V2=false` is the only off switch in a
  build. **v1 is not removed**: `AIFruitStoryV1` and `src/components/viral-tools/ai-fruit-story/`
  (5,933 lines) are still in the code, reachable only if the switch is turned off.
- **c) Left on the launch checklist:**
  - Rollout: done.
  - v1 removal and retiring the v1 tool keys and three v1 edge functions: not done.
  - Small faces / human listener: fixed in the picture builder, re-checked on 3 paid pictures
    (stage 3j), and an automatic picture check with one free redraw now catches human heads.
  - Logo issue: "plain unbranded props, no logos" is in both the picture and the clip prompt.
    I found no recorded run that checked it works.
  - Mobile QA: a scripted pass at 390 px ran on 2026-09-30. No record of a hand pass on a phone.
  - `/blog/ai-fruit-story-pricing` still describes v1 costs; `TUTORIAL_URL` is unset.
- **d) Yes.** `node --test tests/fruit*.test.mjs`: 173 pass, 0 fail (19 files).
  Render worker: 32 pass, 0 fail. Run today on `laptop-transfer`.
- **e) Known issues** (none blocks Blocky Stories):
  - Wan 2.6 Flash's content filter blocks some clips (an audit script for it,
    `scripts/fruit-story/wanFilterAudit.mjs`, is uncommitted in this folder and isn't mine).
  - The first five ideas are the same on every visit (the seed counter restarts at 0), and
    nothing excludes ideas the user already made.
  - Signed-out visitors probably see error banners for ideas and the library (read from code,
    not confirmed in a browser).
  - "Make scene pictures" on a draft has no client balance check (the server refuses correctly).
  - V4 lines: the 9-word budget needs a 6 s clip on Veo, so V4 stories lean on the repair pass.
  - 16:9 has unit tests only; no paid 16:9 run is on record.
  - Six fruit test files read `data/fruit-characters/library.json`, which is not in git, so
    they fail on a fresh clone.
- **f) Recommendation: build Blocky Stories now, in parallel.** Fruit's launch is done; what's
  left is cleanup. Build on `laptop-transfer` in this folder, behind a new `blocky_v1` flag that
  is off for everyone. A separate branch would mean switching branches under the other sessions
  that share this folder. One caveat: anyone who pushes `laptop-transfer` also pushes the Blocky
  commits to the Vercel preview. That is harmless while the flag is off, and main only receives
  what is picked onto it.

## 2. Map of Fruit v2

Marks: **AS-IS** (reuse untouched), **CONFIG** (needs niche config), **FRUIT** (fruit-only).

UI, in `src/components/viral-tools/ai-fruit-story-v2/`:

| Area | Files | Mark |
|---|---|---|
| Page + state | `FruitStoryV2Page.jsx`, `hooks/useFruitV2Flow.js` | CONFIG (copy, niche passed down) |
| Story step | `builder/StoryStep.jsx`, `ScriptEditor.jsx`, `rules.js`, `script/parseScript.js` | CONFIG (copy only); parser AS-IS |
| Settings, pipeline | `builder/SettingsFields.jsx`, `Pipeline.jsx`, `BuilderPanel.jsx` | AS-IS logic, CONFIG for the title lines |
| Scenes + clips | `workspace/StoryBoard.jsx`, `dialogs/SceneDialogs.jsx` | CONFIG (overlay text field) |
| Final video | `workspace/FinalView.jsx` AS-IS; `FinalExtras.jsx` CONFIG (upload pack fields) |
| Series | `builder/SeriesPanels.jsx`, `workspace/SeriesViews.jsx` | AS-IS; copy from `constants.js` |
| Copy | `constants.js` | CONFIG (split generic from niche copy) |
| Data contract | `api/fruitStoryV2Api.js`, `api/supabaseAdapter.js` | CONFIG (niche on 4 calls) |
| Library | `hooks/useCharacters.js` CONFIG (cache per niche); `dialogs/CharacterLibraryDialog.jsx`, `shared/Avatar.jsx` AS-IS |
| Prices | `pricing/fruitV2Estimates.js`, `useFruitV2Prices.js` | CONFIG (tool keys) |
| Out-of-credit (client) | `hooks/useAccount.js`, `shared/NoCreditsModal.jsx` | AS-IS |
| Fruit only | `api/legacyStories.js`, `api/mock/libraryData.js`, `src/pages/workspace/AIFruitStory.jsx`, `src/data/fruitStoryPages.js`, `AIFruitStoryLanding.jsx` | FRUIT |
| Shared kit | `src/components/ui/zyvo/` (15 files, no fruit strings) | AS-IS |

Server, in `supabase/functions/_shared/fruit/` unless noted:

| Area | Files | Mark |
|---|---|---|
| Story writer | `planner.js`, `plannerService.js`, `llm.js` | `planner.js` CONFIG; rest AS-IS |
| Script editor | `scriptReview.js` | CONFIG (2 sentences) |
| Idea generator | `supabase/seeds/fruit_ideas.sql` (1,065 hand-written ideas), RPC `fruit_pick_ideas` | FRUIT (no AI writes ideas today) |
| Scene pictures | `pictures.js` CONFIG; `fruitLooks.js` FRUIT; `wording.js`, `shots.js` AS-IS |
| Picture check | `pictureCheck.js` | CONFIG (hardest: the checks are about fruit heads) |
| Clips | `clips.js` CONFIG (2 words); `duration.js`, `clipCheck.js`, `spoken.js`, `captionWords.js` AS-IS |
| Character library | table `fruit_characters`, bucket `public-assets/fruit-characters/`, `scripts/fruit-characters/` | table CONFIG; scripts FRUIT |
| Series | `series.js` CONFIG; `plates.js` CONFIG (extend to single stories); `castRules.js` CONFIG |
| Final video (Fly) | `final.js`, `render-worker/src/fruitFinal.mjs`, `fruitFinalPlan.mjs` | AS-IS |
| Captions | `render-worker/src/fruitCaptions.mjs` | CONFIG (add overlay text) |
| Pricing | `tool_prices` rows, RPC `fruit_charge_step`, `steps.js`, `models.js` | AS-IS; 4 new price rows |
| Out-of-credit guard | `alerts.js`, table `fruit_provider_alerts` | AS-IS |
| Engine | `engine.js`, `storyState.js`, `supabaseStore.js`, `runware.js`, `validation.js`, `limits.js` | AS-IS |
| Upload text | `uploadPackage.js` | CONFIG |
| Entry points | `fruit-story-api/index.ts` CONFIG; `fruit-worker/index.ts` AS-IS |

## 3. Niche config (recommended) vs copying the folders

**Recommended: one niche key plus one config module per niche.**

- **Database** (one additive migration): `niche text NOT NULL DEFAULT 'fruit'` on
  `fruit_stories`, `fruit_series`, `fruit_characters`, `fruit_ideas`. The unique first-name
  index becomes unique per niche. Scenes get an `overlay jsonb` column. Table names stay.
- **Server:** `_shared/fruit/niches/fruit.js` and `niches/blocky.js`. Each holds the style
  block, the "who is this character" wording, the head/body rule, the negative list, writer
  and editor rules, the picture-check spec, the idea source, location handling, overlays
  on/off, upload-pack format and price keys. Builders take the niche; the story row decides it.
- **API:** the same `fruit-story-api`. `niche` rides on `listCharacters`, `getIdeas`,
  `createStory` and `createSeriesPlan`; a missing value means `fruit`. While Blocky is in
  testing the server also checks the `blocky_v1` flag (today flags are checked in the browser only).
- **Client:** `FruitStoryV2Page` takes a niche object (copy, example video, price keys, feature
  switches). A new page `src/pages/workspace/BlockyStories.jsx` renders it on its own route.
- **Proof that Fruit doesn't change:** before any refactor, a new test records Fruit's exact
  prompts (picture, clip, writer, series, editor, upload text) for fixed inputs. It must stay
  byte-identical afterwards, along with the 173 existing tests. New story fields appear only
  for non-fruit stories, because one test asserts the exact Fruit story shape.

**Copying the folders** means about 4,600 lines of UI plus the whole backend, including the
charging, refund and reconciler code, a second set of tables and a second cron. Fruit would be
untouched on day one, but every later fix has to be made twice and the money path exists twice.

**Recommendation: niche config**, with two exceptions that stay as separate files: the
SEO/landing pages and the library build scripts.

## 4. Blocky gaps (Part C and Part E)

| Item | Where it lives | Effort |
|---|---|---|
| C1 Idea engine: 10 engines, 5 per batch, rotation, banned plots | New `niches/blocky/ideas.js` + an AI call per batch (about $0.01) + validation in code | 1.5 days |
| C1 Used-ideas memory | New table `fruit_idea_history` (user, niche, engine, title, premise); recent rows go to the writer | 0.5 day |
| C2 Script rules | Niche block in `planner.js` and `scriptReview.js`; "max 2 speaking" already holds (one speaker per scene) | 1 day |
| C3 Avatar library (24) | `fruit_characters` rows with `niche = 'blocky'`; a roster file + the existing generator with a blocky prompt | 1.5 days + your review |
| C3 Users' own avatars | Owner column, create flow, checks | 3–4 days, later phase |
| C4 Location lock | Preset list in the niche config, one plate each; `plates.js` already passes a plate as the last reference picture for series, extend it to single stories and custom locations | 1.5 days |
| C5 Style lock | Constants in `niches/blocky.js`; blocky picture-check spec | 1 day |
| C6 No text + caption overlays | Prompts already forbid text and logos. New: `overlay` per scene from the writer, an editable field on the scene card, drawn by `fruitCaptions.mjs` on Fly (needs a Fly image deploy) | 2 days |
| C7 Brand + kid safety | Writer rules, a code check for banned names in scripts and user prompts, in-app name without "Roblox" | 0.5–1 day |
| E Upload pack | `uploadPackage.js` already writes title, caption, pinned comment and hashtags, with copy buttons in `FinalExtras.jsx`. Add: YouTube title with the 100-char cap and count, description under 500, tags capped at 500, TikTok caption under 150; caps enforced in code | 1 day |

## 5. Layout

Confirmed, no change needed. `FruitStoryV2Page.jsx:316-345`: the builder is first, 420–460 px
wide on the left; the result section fills the right; idle shows Recent creations for paid
users. Mobile has two sticky tabs, "Build" and a second one labelled "Recent" when idle and
"Your video" once a story exists; footers sit above the bottom nav.

## 6. Test plan ($5 cap)

Measured costs used: picture $0.035 (Nano Banana 2 Lite), Wan 2.6 Flash $0.0504/s, Seedance
2.0 Mini $0.0817/s, Veo 3.1 Fast $0.15/s. Nano Banana Pro is about $0.134 a picture (list
price, not yet measured on our account). One attempt per test, no automatic retries.

| # | Test | Cost | Running total |
|---|---|---|---|
| 1 | Lip sync: 3 first-frame pictures of decal-face avatars + 3 × 5 s clips on V2 Wan. One line uses words like "admin", "ban", "hack" to see if Wan's filter objects | $0.86 | $0.86 |
| 1b | Only if V2 fails: one 5 s Seedance clip ($0.41) and one 4 s Veo clip ($0.60) | $1.01 | $1.87 |
| 2 | Avatars: 6 on Nano Banana 2 Lite ($0.21) vs 3 on Pro ($0.40). Half the prompts say "Roblox-style", half only "blocky toy figure", to see which avoids logos | $0.61 | $1.47 / $2.48 |
| 3 | 1 location plate + 4 scene pictures in it, using test 2's avatars | $0.18 | $1.65 / $2.66 |
| 4 | One full 30 s story on V2 (Fruit's cost $1.78; plus plates, ideas, upload pack) | $1.90 | $3.55 / $4.56 |

Total: **$3.55** if V2 passes, **$4.56** if test 1b is needed. Both are under $5.

Test 1 needs no new backend: the deployed worker already has no-charge test actions for raw
pictures and Wan clips. Tests 3 and 4 need the niche build. Test 4 creates one story on your
account; you can run it by hand instead if you prefer.

One-time libraries (outside the $5): 24 avatars on Lite about **$0.81** (about $1.05 with
redos); on Pro about $3.20 ($4.20 with redos). 12 locations in 9:16 about **$0.42** ($0.55
with redos); both shapes doubles it. The 6 Lite avatars from test 2 can count toward the 24.

## 7. Phases to launch

| # | Phase | Effort | Paid cost | Stop for you |
|---|---|---|---|---|
| 0 | This audit | done | $0 | approve plan |
| 1 | Lip-sync test (test 1, 1b if needed) | 0.5 day | $0.86–1.87 | **yes: go / no-go** |
| 2 | Niche seam: prompt snapshot test, migration, `niches/fruit.js`, API + client niche, flag, hidden route. Fruit unchanged | 2.5 days | $0 | migration shown before it's applied |
| 3 | Blocky content: style lock, writer/editor rules, safety, picture check, 24-avatar roster (text). Tests 2 and 3 | 3 days | $0.79 | **yes: Lite or Pro, look approved** |
| 4 | Libraries: 24 avatars + 12 locations | 1.5 days | ≈ $1.25–1.60 | **yes: review sheet** |
| 5 | Idea engine + used-ideas memory | 2 days | ≈ $0.05 | no |
| 6 | Location lock for single stories + caption overlays on Fly | 3.5 days | ≈ $0.10 | Fly deploy needs your OK |
| 7 | Upload pack | 1 day | ≈ $0.01 | no |
| 8 | UI skin: copy, idea cards with emotion, overlay field, mobile pass at 390 px | 2 days | $0 | no |
| 9 | Full 30 s story (test 4) | 0.5 day | $1.90 | **yes: watch it** |
| 10 | Soft launch: flag for testers, menu/home entries (about 15 files), price rows, pricing page, SEO page "Roblox-style animation", example videos | 3 days | example videos ≈ $2 each | **yes: before any push** |
| later | Users' own avatars; 16:9; V3/V4 story checks | 4+ days | as tested | |

About 20 working days. Paid tests $3.55–4.56, plus libraries about $1.25–1.60.

**What I'd do differently from the scope:**

1. **Lip-sync test before any building**, not only before other paid work. It needs no new
   backend, and a fail changes or ends the project.
2. **Word budget.** Fruit's rule gives about 9 words per 5 s scene, so 60 s is about 108 words,
   not 130–155. Reaching 130–155 needs 6 s clips, and 12 of those is 72 paid seconds for a 60 s
   video. Start with Fruit's rule; try 11-word lines in the 30 s test.
3. **Overlays in fixed spots** (name tag top centre, chat top left, countdown top right) rather
   than on a blank glowing shape in the picture. The camera pushes in during a clip, so a drawn
   shape moves and the text won't stay on it, and the clip model may fill the shape with fake
   letters. Test 3 tries one picture with a blank shape to check.
4. **9:16 only at first.** Reference pictures are portrait, series already forces 9:16, and
   16:9 has never had a paid run.
5. **Own price rows** (`image:blocky-story`, `video:blocky-story-v2/v3/v4`) with Fruit's values,
   so Blocky's price and margin can move without touching Fruit.
6. **Ideas free, with a rate limit.** Each batch costs us about $0.01; Fruit's ideas cost nothing.
7. **Voices are descriptions, not fixed voices.** The video model invents the voice in every
   clip, so an avatar can sound a little different between clips. Same as Fruit today.

---

## Appendix: details for later phases

### A. Data contract (`api/fruitStoryV2Api.js`)

Every call is a POST to the edge function `fruit-story-api` with `{ action, ...args }`
(`api/supabaseAdapter.js:12-40`). No request carries a niche or template key today.

| Call | Server side | Niche needed |
|---|---|---|
| `listCharacters()` | `fruit_characters`, active rows, 5-minute cache | yes (filter) |
| `getIdeas({seed})` | RPC `fruit_pick_ideas` over `fruit_ideas` | yes (Blocky: AI idea engine) |
| `createStory(input)` | writer, RPC `fruit_create_story` | yes (stored on the row) |
| `createSeriesPlan(input)` | series writer, `fruit_series` | yes (stored on the row) |
| `generateScenePictures`, `editScene`, `regenerateScene`, `regenerateSceneFree` | `runStep` → `fruit_charge_step` → `fruit-worker` | no (read from the story) |
| `animateAll`, `regenerateClip` | same | no |
| `buildFinal(storyId, {captions, partLabel, endCard})` | starts a Fly machine | no |
| `uploadPackage(storyId)` | small model, saved in `fruit_stories.upload_package` | no |
| `getStory`, `subscribeStory`, `getSeries`, `listSeries`, `listRecent({type})` | reads + realtime | `listSeries` / `listRecent`: yes (filter) |

Contract drift to tidy in the niche-seam phase: `regenerateSceneFree` and `uploadPackage` are
missing from the adapter typedef, and the UI reads `story.readOnly`, `item.legacy`,
`series.bible` and `character.collection`, which the typedefs don't list.

Module-level singletons that block two niches in one browser session:
`useCharacters.js:4` (one cached library), `promptHandoff.js:27` (key `zyvo_prefill_fruit_story`),
`supabaseAdapter.js:108-112` (always merges v1 stories into Recent).

### B. Database

Tables: `fruit_stories`, `fruit_story_scenes`, `fruit_jobs`, `fruit_charges`,
`fruit_credit_ledger`, `fruit_ai_calls`, `fruit_series`, `fruit_series_episodes`, `fruit_ideas`,
`fruit_characters`, `fruit_provider_alerts`, `fruit_test_overrides`. Flags:
`global_feature_flags`, `user_feature_flags` (read by the browser only; the API never checks them).

Constraints a second niche runs into:
- `fruit_characters_first_name_key`: first names are unique across the whole table
  (`20260927104458_fruit_characters.sql:46`).
- `fruit_characters`: `fruit NOT NULL`, `gender IN ('female','male')`, `age BETWEEN 19 AND 70`.
- `fruit_story_scenes.speaker_id` is a foreign key to `fruit_characters(id)`, so Blocky avatars
  must live in the same table.
- `fruit_pick_ideas` and the API's `library()` have no niche or collection filter.

Library storage: looks are text columns (`fruit`, `face`, `build`, `outfit`), the voice is the
text column `voice_style`, and the locked picture is a public file at
`public-assets/fruit-characters/<collection>/<id>-a<attempt>.jpg` (768×1376), with its URL in
`ref_image_url`. Pictures get the character references through `inputs.referenceImages`
(speaker first, then the location plate; the model accepts 14). Clips get no references, only
the scene picture as the first frame.

### C. Where the fruit wording sits

| File | Fruit-specific part | How easy to swap |
|---|---|---|
| `planner.js` `SYSTEM` :81-156 | "anthropomorphic fruit characters", fruit puns, the no-hair rule, same-fruit rule, UK roadman | one constant, fruit sentences mixed into generic rules: split into core + niche block |
| `planner.js` `characterBlock` :158-161 | `a <age> <fruit> woman/man` | one function |
| `series.js` :13-42 | intro sentence, no-hair rule, `the <fruit> woman` | constant + one line |
| `scriptReview.js` :25-69 | "fruit characters", hair/skin clause | constant + one line |
| `pictures.js` | `STYLE` :51, `NEGATIVE` :52 and :78 (ends "no human skin, no human heads, no hair"), `fruitHeads` :34-42, `who` :80, `referenceLine` :55-64, `buildEditPrompt` :137 | style and negative are constants; the rest is woven through `build` |
| `pictureCheck.js` | system prompt, `hasFruitHead`, verdict fails human heads and hair | deeply woven; give each niche its own check spec |
| `clips.js` :35, :38 | `the <fruit> woman/man` | two interpolations; `NO_CUT`, camera and audio lines are generic |
| `castRules.js` :44-53 | look-alike means same fruit | one rule |
| `uploadPackage.js` :10-15 | "anthropomorphic fruit characters", `#fruitdrama` | one constant |
| `errors.js` :17, :31; `alerts.js` :41 | "AI Fruit Story" in messages | strings |

Generic already: the voice rule (voice says how it sounds, the scene sets the emotion), the
safety rules, the banned-phrase lists, the no-text and no-logo sentences, the content-filter rewrite.

### D. Rules the scope refers to

- Scenes: `min(24, max(3, round(lengthSec / 5)))` (`planner.js:79`); lengths 15–120 s in 5 s steps.
- Speech: 2.6 words per second plus a 0.8 s buffer; each clip is rounded up to a whole second
  the model allows (`duration.js:5-34`). V4 allows only 4, 6 or 8 s.
- Line budget: 9 words per line at every length (`planner.js:27-28`); limits 3–16 words.
- Locations: 1–3 per story, each with a description, time of day and lighting. Single stories
  keep them consistent by text only. Series also make one empty-set picture per location
  (`plates.js`) and pass it as the last reference.
- 16:9 works end to end on the server; the UI forces 9:16 for series episodes.

### E. Where a new tool is registered (there is no single registry)

`src/App.jsx:25, 907`; `components/workspace/CreateMenu.jsx:11-27`; `toolshell.jsx:78-89`;
`MobileBottomNav.jsx:166-176`; `pages/workspace/layout.jsx:154-164`; `data/routeSeoPolicy.js:21`;
`components/home-v2/HomeV2Sections.jsx:129, 368`; `ZyvoSuiteCarousel.jsx:15`; `WhatsHot.jsx:42-49`;
`toprow.jsx:39-41`; `footer.jsx:56, 161`; `public-gallery/gallery.jsx:41-51`;
`seo/PublicContentLayout.jsx:9`; `pages/workspace/HomeV2.jsx:40-41`; the paywall feature lists in
`FaceAsmrPaywall.jsx:15-28` and `TwoAmPaywall.jsx:15-28`. Pricing display:
`lib/pricingOutputs.js:62-93, 185-206`, `components/pricing/OutputTables.jsx`, `PlanCards.jsx`,
`PlanFinder.jsx`. SEO: `data/publicSeoMetadata.js`, `data/structuredData.js`,
`scripts/generateSitemap.js`, `scripts/validateSeoIndexing.js`, `vercel.json`.

### F. Tests and test tooling

- Fruit tests: `node --test tests/fruit*.test.mjs` (173). Render worker:
  `cd render-worker && node --test test/*.test.mjs` (32). Everything: `npm test`.
- Tests that pin exact source text or shapes, so the niche work must add rather than rewrite:
  `fruitGlobalSwitch` (exact lines in `src/lib/featureFlags.js` and `AIFruitStory.jsx`),
  `fruitBackendUnits` (exact Fruit story shape), `fruitStoryV2` (the Fruit price keys),
  `fruitStoryPages` (reads source of `useFruitV2Flow.js`, `App.jsx`, the landing page),
  `pricingPage` (exact text in `pricingOutputs.js`).
- `scripts/fruit-characters/export.mjs` writes into the v2 folder (`api/mock/libraryData.js`),
  so that folder shouldn't move.
- Paid test guard: `scripts/fruit-story/paidGuard.mjs`. Paid calls throw unless
  `FRUIT_ALLOW_PAID=1`, and each run reserves against a stage cap. Fruit's caps are spent;
  Blocky needs its own stage keys and its own $5 ledger.
- Reusable for test 1: the worker's no-charge actions `picture_test`, `raw_test` and `raw_poll`
  (`fruit-worker/index.ts:195-280`; Wan 2.6 Flash is on the allow-list), plus
  `test3eConfirm.mjs` as the template and `frames3e.mjs` for frame strips.
- Reusable for the libraries: `scripts/fruit-characters/generate.mjs` (`--cap` required, a
  ledger per attempt), `sheet.mjs`, `retry.mjs`, `upload.mjs`, `export.mjs`. They are bound to
  fruit through `prompt.mjs` and the `data/fruit-characters/` paths.

### G. Measured costs

| Item | Cost | Source |
|---|---|---|
| Nano Banana 2 Lite picture | $0.0346 (live average $0.0368) | `fruit-v2-phase3-results.md`, `data/fruit-phase3/margins.json` |
| Nano Banana Pro picture | about $0.134, list price, not measured on our account | web list price |
| Wan 2.6 Flash, 720p with sound | $0.0504 per second | 18 clips |
| Seedance 2.0 Mini, 720p | $0.0817 per second | 3 clips |
| Veo 3.1 Fast, 720p with sound | $0.15 per second | 1 clip |
| Story script | $0.010–0.017 | measured |
| Picture check / upload text / final video | about $0.001 each | measured |
| Full 30 s V2 story | $1.78, 179 credits charged | 2026-09-30 run |
| One credit | $0.02133 (cheapest plan credit) | `docs/phase7/pricing-proposal.md` |
