# Studio recipes

## Rage hook

The creator yells a real frustration on frame 0, Zee answers in two words, the real clip plays, three real steps, the real measured time, the real result, an excited last line. The owner called the first one the best video yet (2026-11-02).

To make one for another template, copy a recipe file here and change what's in it. The structure, voices, music, camera and bleep stay in `rageHook.mjs`.

```
node scripts/studio/rageHook.mjs scripts/studio/recipes/<recipe>.json script   # free: writes the two scripts
node scripts/studio/rageHook.mjs scripts/studio/recipes/<recipe>.json takes    # paid: voices, stops at cap_usd
node scripts/studio/rageHook.mjs scripts/studio/recipes/<recipe>.json render   # free: bleeped and uncensored files
```

**What a recipe needs to be honest**

- **Clips:** cut on real pauses, so each starts and ends on a full sentence. The first is 2-3 s, the result about 2 s.
- **Screens:** real ones, in `content/studio-worker/src_work/<screens>/`. `taps` are `[word, x, y]`, with x and y as 0 to 1 of the screen. A tap goes only where a real click happens. `flips` are `[word, file]`.
- **Time:** from that creation's own log. If there's no real time, cut the "How long did that take?" and answer lines.
- **Steps:** they must match the template's real flow.
- **No other company's logo.** The `messy3d` prop is a made-up window.

**Music:** a beat from frame 0, a hard stop on "Watch.", and back in when the first clip starts. Set `"music": false` for no bed; the owner took the music out of the first video after hearing it.

## Rage hook v2: the Studio tab's one-click preset (owner, 2026-11-03)

`"structure": "v2"` recipes show as buttons under **Preset · Rage hook** in the Studio tab (the laptop worker lists them). One click makes a job; the worker lays out the script ($0); it waits for the owner's approval; then 3 takes of the yell, the other lines, the render and the Queue. 20 to 25 s:

yell (mid-yell on frame 0, a desk slam) → "Watch." → 0.5 s of total silence → the real result, one full sentence of 2 to 3 s, on a beat drop and a bass hit → STEP 1/2/3, big chips and real screens as big as the safe zone allows, a whoosh each → a real number on a bass hit (`reveal.visual`: a roll or a clock) → the creator's punchline → "It's called Zyvo. Link in bio." and an easy comment question → a whip back to the raging creator, so the end runs into frame 0.

- `clip`: one clip, cut where its scene starts (check the first frames: a long video's cut can land a frame or two late). A long video's clip is a short segment file in the pool with its own frames (`creation.segment` says which part).
- `reveal`: a number from the creation itself (Long Form: its editor and publish page; Fruit: the measured 3:50 run). `claims` says where it comes from; it goes to the Queue item.
- A swear in the yell (`yell.swear`, `yell.show`): the bleeped video goes to the Queue, the uncensored one stays next to it on the laptop.
- Free layout check before anyone pays: `content/studio-worker/scratch/story/rage_preview/preview.mjs <key> [stills t1,t2,...]` uses Windows' built-in voice in place of the paid takes.

**Screens that need the running state:** `capture/cutawayProgress.mjs` photographs the Cutaway progress screens from the local dev page's built-in sample states. The screens are real, but their percent and timer are sample values.
