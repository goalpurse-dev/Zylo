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

**Screens that need the running state:** `capture/cutawayProgress.mjs` photographs the Cutaway progress screens from the local dev page's built-in sample states. The screens are real, but their percent and timer are sample values.
