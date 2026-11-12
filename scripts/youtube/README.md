# YouTube Tutorial kit (16:9 long-form)

What it's for: "I tried…" tutorials of 6–8 minutes built around the owner's own screen recordings. The model is the SnapYT reference; `content/studio-notes/LEARNINGS.md` has its analysis. Everything below runs locally and costs $0, except the ElevenLabs voice.

## One episode, start to finish

The episode folder is `content/youtube/episodes/<slug>/`, holding `script.json`, `assets/` and `recordings/`.

1. **Script.** Write or adjust `script.json`. The chapters are: result first → proof (credited public counts + your own numbers) → the hard way (fair, no bashing) → early CTA → numbered steps on real screens → honest snag with a real time → the finished video → doing it again → honest limits + a comment question → end screen.
   - `node ytScript.mjs <ep> check` enforces the rules. Every number said needs a fact with a source. "Free" only where a fact says what is free. Public counts need their credit and the day they were checked. Every recording needs its instruction. Blanks like `[MINUTES]` must be filled from your recording.
   - `node ytScript.mjs <ep> print` writes `SCRIPT.md`, the version for approval.
2. **Shot list.** `node ytScript.mjs <ep> shotlist` writes `SHOTLIST.md`: every file to record, what to click in it, about how long, and the voice lines in case you voice it yourself.
3. **Record.** Drop the files in `recordings/` with exactly those names.
   - Your own voice (optional): `recordings/voice/<line id>.wav` (or .m4a/.mp3), one file per line. It always wins over the AI voice.
4. **Assemble.** Run `node assemble.mjs <ep> --voice sapi|eleven [--spend-ok <usd>]`. It writes `out/<slug>.mp4` (1080p, 16:9, 30 fps) and `out/timeline.json`. It does:
   - each line's voice: your file, else Windows' voice (free, preview only), else ElevenLabs (paid: refused until `--spend-ok` covers the estimate it prints, and only after the owner's yes);
   - the cards, filmed by `cards.mjs` from `cards.js`: keyword cards (one phrase + one of our own icons), STEP cards, credited proof cards with the real count rolling up, the end screen;
   - recordings inset on our background with a lime frame and a `zoom` ([x, y, w, h], 0–1 of the frame) that eases in;
   - the finished video full screen with its own sound;
   - captions from a local whisper pass on our own voice, only over the screen recordings.

   A recording that's missing becomes a labeled placeholder card. The file is then named `_PLACEHOLDERS`, and `_PREVIEW` when the voice is Windows'.
5. **Package.** `node ytScript.mjs <ep> package` writes `out/description.txt` (chapters from the real cut, the tracked link, credits for every public example), `out/titles.txt` (the search title + 2 options) and `out/thumb_1..3.png` (1280x720, from `thumbs` in the script).

## Look

Our own look: a near-black background, a violet glow, lime and yellow accents, Segoe UI Black, and icons drawn in `cards.js` (play, check, no, clock, search, rocket, mic, film, cloud, gear, bolt, chart, eye, sparkle, hourglass). It never copies another channel's look.
