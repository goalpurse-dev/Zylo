# Blocky Worlds protocol

> **PERMANENT RULE (owner, 2026-11-04): the scene always matches the narration.**
> Every line's key nouns, its actions and its subject (who or what the line is about) must be visible on screen in
> that line's shot. This is the core of why these videos work. It is a hard requirement for every future change:
> - The pre-render check always enforces it. `checkVisuals` (nouns and actions) and `checkSubjects` (who the line is
>   about) run in `scripts/blockyWorlds/engine/plan.mjs`, and any miss stops the run before anything is rendered or
>   charged. Never weaken, skip or bypass these checks to make a video pass.
> - If an idea needs something the kit doesn't have, add it to the kit (`page/kit/objects.js`, `lib/visuals.js`) or
>   use a clear fallback that shows that very thing (a picture card with its name and icon). Never a random or
>   unrelated shot, never filler townsfolk standing in for a noun.
> - Testing focuses on it: every planner or kit change is checked against many different ideas, not just one.
> - **A missing kit object or world never fails a run** (owner, 2026-11-05). The engine builds what a line needs in
>   real time: the kit first, then the shared library of things built for earlier videos, then an AI-designed block
>   blueprint (objects) or world spec (places) that the engine builds, checked by a quick still + an AI vision check
>   (up to 2 retries). Only if that fails: a clear picture card of that thing. Everything built is saved to the shared
>   library so the kit grows with every video.

The single rulebook for how a Blocky Worlds video is made. Code follows this file; when they disagree, fix one of them in the same commit.

The research behind it is `reference/blocky-worlds/ANALYSIS.md`, a study of 19 viral videos. The code lives in `supabase/functions/_shared/blockyWorlds/`.

## 1. The hard rules

1. **Every video starts with "In this world, " or "In this town, "**. The writer is told this, and code enforces it on every script, whether generated, rewritten or the user's own (`opener.js`). A near miss ("In my town", "In this village") is fixed by code. Anything else gets one small rewrite of the first line only; if that fails, the script is refused.
2. **Original worlds and names only.** A famous premise may lend its shape, never its titles, names, places, objects or lines (`safety.js`).
3. **No game-platform words.** No Roblox, Robux, noob, obby, oof or the like, anywhere: script, card, signs or upload text.
4. **PG fear only.** Danger is suggested, never gory.
5. **The narrator** is the one config in `config.js` NARRATOR: ElevenLabs "Little Dude II" on Multilingual v2, speed 1.2 (the maximum), stability 1.0, similarity 0.7, style 0.
6. **The pace (~260 words a minute)** comes from short, punchy lines and trimmed gaps between sentences, never from speeding up the audio.
7. **No paid call without the owner's go** while the template is being built. Mock mode (`BLOCKY_WORLDS_LLM=mock`) runs every step for free.

## 2. One pipeline for every video

Every source becomes the same complete idea card first:

| Source | How it becomes a card |
|---|---|
| A library idea ("Pick an idea") | It already is one: judged and stored |
| "Your topic" | The writer builds 3 complete cards around the topic and fills any missing piece; the user picks one |
| A pasted script | It is read back into a card (`cardFromScript`); missing pieces are filled in, the script is never changed |

Then, always, in this order:

```
idea card -> beat sheet (7 parts) -> script -> shot plan -> render
```

**Each step has code checks.** A failed step is retried **on its own**, once, with the problems listed; the earlier steps are kept. If it still fails, it comes back with its problems: a script shows them to the user, who can rewrite or edit. Nothing is charged before Generate.

| Step | Code | Checks |
|---|---|---|
| 1. Idea card | `protocol.js` cardProblems | All 14 fields present; exactly 3 examples; the opener rule; known formula, twist type and mood; the originality and safety blocklist |
| 2. Beat sheet | `writeBeats`, beatProblems | The 7 parts in order. `rule` uses the rule. `tour` uses the price and all 3 examples. `me` uses the exception and plants the prop. `until` escalates in 3 steps. `discovery` reveals the truth. `climax` pays off the prop. `closer` uses the closer. Every beat says what is on screen |
| 3. Script | `writeScript`, checkScript + scriptProtocolCheck | The opener rule; the word budget for the length (±10%); lines under 16 words; the parts in order; the prop set up in tour/me and paid off in the climax; the last lines calling back line 1; the blocklist. Pausing punctuation is cleaned out by code |
| 4. Shot plan | `writeShots`, shotProblems | Every line has a shot; only the fixed vocabulary (cameras, sets, light, effects, actions, expressions); line 1 opens on a wide shot or a prop insert; the blocklist on any sign text |
| 5. Render | The renderer milestone | Built from the locked look (§6) |

**The seven parts** and their share of the words: rule 3%, world tour 17%, me 13%, until one night 22%, discovery 15%, climax 22%, closer 8%.

## 3. The idea library

Ideas are the core of the template, so "Pick an idea" serves from a **judged, growing library**, not from a live call.

- **Size:** a starting target of 500 live ideas, growing over time. Each is a full idea card plus its formula (F1–F6), twist type (T1–T6), mood and setting.
- **How ideas are made:** the batch job (`libraryJob.js`, endpoint `blocky-worlds-library`) runs in ticks of 3 calls, about 18 ideas a tick. Each tick:
  1. plans formula/twist/mood/setting slots from the learning weights (§4), with 20% drawn evenly to keep exploring;
  2. writes the ideas with Sonnet 5.5;
  3. runs the card checks;
  4. **deduplicates** against everything stored, including rejected ideas: the same key words, or a similarity of 0.42 or more on the rule and twist;
  5. sends the rest to the **AI judge**.
- **The judge** (Sonnet 5.5) scores 10 criteria from the A-tier rules, each from 1 to 5, weighted to a total of 100: hook, price, examples, exception, prop, escalation, twist, closer, originality, buildability. An idea goes **live** only if it scores **72 or more**, scores at least 3 on hook, twist and closer, and is safe. Everything else is stored as **rejected** and never shown.
- **Money:** a batch needs an explicit dollar cap (`maxUsd`) and stops before the call that could pass it. Any single batch is capped at $25 regardless. Library spend counts toward the template's emergency cap.
- **Serving:** each user sees **only ideas they haven't seen** (`blocky_worlds_seen`), best rank first, with the mix forced: one per formula in turn, never two of the same formula and mood in a batch. Library ideas are free and instant, with no daily limit. If a user has seen everything that fits, a live batch is written for them, and that does count toward their daily limit.

## 4. Learning

- **Counted per library idea:** shown, picked (its first script), rewritten, generated, downloaded, thumbs up and thumbs down after the video (the `event` action), plus the owner's real TikTok likes (`addPost`).
- **The rank** (`library.js` rankOf) mixes these, weighted:

  | Signal | Weight |
  |---|---|
  | judge score (the prior) | 0.30 |
  | picks per show | 0.22 |
  | real likes (counted most; 1M likes is the maximum) | 0.18 |
  | generations per pick | 0.14 |
  | downloads | 0.08 |
  | thumbs | 0.08 |
  | exploration bonus for little-shown ideas | 0.06 |

  `rerank` recomputes it; run it daily and after entering likes.
- **The mix the batch job makes more of** (`mixWeights`): per formula, twist type and mood, from how its ideas do (generations per show plus likes), relative to the average, kept between 0.5x and 2x so nothing disappears.
- **User ideas:** a "Your topic" or pasted-script video that gets downloaded or a thumbs up joins the library as **pending**. Only its idea card is stored, with no user data. The judge decides at the start of the next tick, like any other idea.
- **The owner's real numbers:** `addPost {runId or libraryId, url, likes, views}` records them and re-ranks that idea at once. A screen for it comes with the owner pages.

## 5. Prices and limits

Prices are in `pricing.js`, at 1 credit = $0.01 of our full cost. These are estimates until the owner's paid tests:

| Length | Credits |
|---|---|
| 60 s | 47 |
| 90 s | 62 |
| 120 s | 78 |

Writing is free, with daily limits: 15 script writes per user per day; idea batches 20 a day (3 on the free plan) when written live. The free plan gets ideas only. Scripts and videos are for paid plans.

## 6. The locked look

**The world:** a realistic game-engine world.
- Ground and buildings: Poly Haven CC0 textures (asphalt, concrete, grass, plaster, brick, roofs) on code-built houses with windows, porches, garages and fences.
- Props: CC0 street lamps, hydrants, bins, benches, shrubs and trees.
- Vehicles: Kenney cars; the bus is built in code.
- Sky and distance: a deep blue sky dome with procedural clouds, distant mountains in haze.
- Light: warm sun with soft shadows, ambient occlusion, a slight bloom, and a punchy grade (saturation 1.58, contrast 1.24).

**The people:** our own blocky people at normal game-avatar proportions.
- Body: the head is about 1/6 of the height, with a blocky chest and hips, elbows and knees, and hands.
- Clothing: stripes, plaid, dots, belts with buckles, shoe soles, collars and cuffs.
- Variety: many hair, hat and accessory variants.
- Faces: simple sticker faces (whites of the eyes, pupils, brows, mouth), drawn large enough to read in a medium shot. Never the classic avatar face; no logos.

**The camera:** eye level, like a phone at street level; medium shots.

**The caption:** one word at a time, Lilita One, white with a black outline, about 70% down the frame.

The reference frame is `reference/blocky-worlds/look-frames/LOCKED_bus_stop.jpg`. The scene code is in `scripts/blockyWorlds/look/`.

## 7. Render speed (plan)

**Today, on this laptop's integrated GPU:** about 0.27 s a frame at 1080×1920 with every effect. A 90 s video at 30 fps (2,700 frames) takes about 12 minutes there.

The plan for production:
1. **Server GPUs.** The same RunPod serverless setup as Cutaway (an L4 rendered a Cutaway 30 s video in 82 s). Expected 0.05–0.1 s a frame.
2. **24 fps instead of 30.** 20% fewer frames, no visible loss for hard-cut story videos.
3. **Chunks in parallel.** The video is cut at shot boundaries into 6–8 chunks, each rendered by its own GPU worker at the same time, then joined by stream copy. Cutaway's CPU fallback already does this.
4. **Raw frame capture.** Read pixels straight into ffmpeg instead of compressing each frame to a JPEG inside the browser, and use the GPU's video encoder.
5. **Per-shot savings that don't show at phone size:** half-resolution ambient occlusion; shadows updated only when something moves; only the set in view loaded.
6. **Start rendering a chunk as soon as its shots are planned,** while the later shots are still being planned.

**Expected wait for a 90 s video:** about 3–4 minutes from Generate to the finished video. That breaks down as the voice (~15 s), the shot plan (~45 s), the parallel render (~60–90 s including GPU start-up) and the finish: captions, music and upload (~30 s). To be measured on the first paid render test.

**Expected render cost:** about 2,160 frames × ~0.08 s, plus each worker's start-up, ≈ 7–8 GPU-minutes at ~$0.00016 a GPU-second. That is **≈ $0.07–0.10** a video. The voice (~$0.22) is the biggest single cost.
