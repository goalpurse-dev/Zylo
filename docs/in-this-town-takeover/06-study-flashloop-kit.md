# 06. Study: the "Roblox Story Kit (Flashloop edition)" 2.2

**Result first.** This kit has **no licence**: we may learn from it, but we may not copy its code, faces, sounds,
textures, example videos, scripts or narrator sample. Five of its methods are worth rebuilding in our own Blender
engine, in our own code:
1. Shots tied to **script word numbers**, not seconds.
2. **Layered faces** (eyes and mouth separate, plus blinks and talk flaps).
3. A **named gesture set with overshoot**.
4. **Sound effects with a lead time**, so the hit lands on the word.
5. A **cheap preview** of every shot and a **re-preview of only the fixed shots**.

None of them is hard to write ourselves. Our v2 engine already has pieces of 1 and 2 (shot rows, separate eye, lid, brow
and mouth parts on `char_v2.py`).

Source: `C:\Users\Huhta\Downloads\Roblox Story Kit AI.zip` (the brief named it with underscores; the real file has
spaces). Unzipped to
`C:\Users\Huhta\AppData\Local\Temp\claude\406e5fa85684c54c\641d0220-8098-4218-a04c-812f0891bea3\scratchpad\kits\flashloop\roblox-story-kit\`.
`VERSION` says "2.2 (Flashloop edition)". I read its SKILL.md, README, PLAYBOOK and the files behind each method below
(shot framework, acting layer, face atlas maker, render/preview tools, mixer, sound prep, sound pack settings, one example).
I ran nothing. There is no licence file and no copyright line anywhere in it. The README says it needs a paid Flashloop
subscription, and the narrator sample is "provided by the kit's author for kit users".

The kit's own targets (PLAYBOOK, measured on 9 reference videos): 255-280 words/min after speed-up; 68-75 words in the
first 15 s; first word at 0.00 s; 50-60 cuts/min (average shot 0.9-1.3 s); 14-18 cuts in the first 15 s; a cut by
0.6 s and 3-4 cuts in the first 3 s; no pause over 0.6 s, under 6 pauses over 0.3 s; blinks every 2-4 s.
Note: this is a much faster cut rate than the MIT kit measured for Studio-style hits (median shot 1.35-2.6 s). The two
kits copy different reference styles.

---

## 1. Shots tied to script word numbers

**How it works.** Every shot says which script word it starts on and which word starts the next shot. A word list
(`words.json`) from the voice turns those numbers into seconds when the scene is built. If the voice is made again with
different timing, the edit follows the words by itself; nobody retypes times. A helper finds "the n-th time word X
is said", starting from a given word. Before any render, a check makes sure the shots cover the whole voice end to
end, with no gaps, no overlaps and no zero-length shot. The last shot runs to the end of the audio plus 0.25 s.
Inside a shot, all timing is the shot's own start and end plus small offsets. Each shot is built from scratch (scene
reset), so any shot can be rendered alone.

**Numbers.** 30 fps; frame = round(t·30) + 1. Tolerance of the coverage check: 1 ms between shots, 50 ms at the end.
Cut on the word that brings a new picture, 50-60 cuts/min. A shot whose camera moved less than 0.05 units gets a slow
0.6-unit push plus a tiny drift automatically, so no frame is ever still.

**How we do it.** Our `words.json` already exists for every voice. Give each v2 shot row a `from_word` index (and
`text` for a readable check). Our runner resolves the index to seconds at build time. Add the coverage check to our free
checks (`v2/shots.mjs`). Add a "word#n after index k" lookup that **prints every anchor with its sentence**, which also
fixes the MIT kit's common-word trap. Keep "one shot = one fresh build" (v2 already does this).

## 2. Layered faces (eyes and mouth apart, talk flaps, blinks)

**How it works.** Each face style has two images: an **eyes sheet** and a **mouth sheet**. Each sheet is a 4x4 grid,
so 16 eye states and 16 mouth shapes. The head material lays both sheets over the skin on the head's front. A key moves
which grid cell shows, switching hard with no fade in between. Because eyes and mouth are separate, any eyes work with
any mouth. A named expression is just a pair (e.g. "shock" = wide eyes + grimace). Blinks only touch the eyes, and talking
only touches the mouth, so a shocked character can still talk.
- **Blinks:** placed at random but repeatable per character (the seed comes from the name), every 1.8-3.6 s (the
  first one 0.3 s or more after the shot starts). Eyes closed for 0.1 s, i.e. 3 frames. No blink when the eyes are already
  closed, happy or winking, and no blink within 0.15 s of a planned eye change.
- **Talk flaps:** one mouth opening per spoken word, taken from the word timings. Every third word uses the wide
  shape. A word longer than 0.22 s closes at 50 % of its length and opens again at 70 %. Without word timings it cycles
  open / wide / rest / open every 0.12 s. It always ends on the rest mouth.
- **Numbers:** 16 eyes x 16 mouths, about 29 named expressions; sheets are 4x4 cells of 512 px (a 2048 px sheet).

**How we do it.** Our `char_v2.py` builds faces from geometry: separate eye, lid, brow and mouth parts, with one mouth
shown at a time. That is already "layered". What to add, in our own code:
- (a) An expression = (eyes state, brows state, mouth state) table, with hard switches.
- (b) A blink pass on the lids with the numbers above (seeded per character, skips near face changes).
- (c) A talk pass that flips between 2-3 mouth shapes per word from `words.json`, only for the character who is speaking,
  and only on real speech. Following the MIT kit, use one strong held face for shouts and grunts.
Optional later: our own drawn eye and mouth sheets as image textures, if we want 2D faces.

## 3. A named gesture set with overshoot

**How it works.** About 21 named body poses (idle, shock, hands on head, hands on face, cheer, point, point left, shrug,
recoil, lean, slump, think, arms crossed, phone, reach, push, hold, wave, fists, facepalm, brace). Each pose is a short
list of joint angles (two angles per arm, three for torso and head, sometimes a hip drop). One call "pops" into a pose:
the body passes the pose by a margin, then settles back. A strength value scales the whole pose. A face change can be
attached to the same moment. Small helpers sit on top: head snap with overshoot, nod, head shake, arm flail, hop with
crouch and landing squash, run with big arm swing and forward lean, and a breathing drift so held poses never freeze.

**Numbers.** Overshoot 18 % past the pose, reached at 45 % of the settle time; settle 0.22 s (≈7 frames; the overshoot
peak at ≈3 frames). Head snap: 15 % overshoot at half of 0.18 s. Nod: 2 dips at 6 per second, 12 degrees. Head shake: 3
swings at 7 per second, 18 degrees. Panic flail: 7 per second, the two arms half a beat apart. Hop: crouch, take off at
15 %, top at 50 %, land at 100 %, recover 0.12 s later. The MIT kit's craft numbers agree: anticipation 4-8 frames,
overshoot 10-20 % for 2-4 frames, settle 6-12 frames.

**How we do it.** v2 already has poses on `ZChar`. Add a `pose_pop(name, t, strength)` in our code that keys the
overshoot frame and the settle frame, plus an optional anticipation frame (4-8 frames the other way; the Flashloop kit
skips this, the MIT kit asks for it). Write our own pose table with our own joint names and angles. Our rig has elbows
and knees, so the poses will differ anyway. Add a reaction rule: the head moves 6-8 frames after the event and the
body 3-6 frames after the head.

## 4. Sound effects with a lead time

**How it works.** Shot code places a sound at a time ("whoosh at this word"). A separate cheap pass builds every shot
without rendering and only collects these cues into one list. The mixer then places each sound **earlier by its lead
time**. The lead time is how long the sound takes to reach its loud hit, so the hit, not the start, lands on the word.
Lead and a loudness trim are stored per sound in one small settings file. A whip pan adds its own whoosh 0.02 s before
the move. A prep tool cuts each raw sound so it starts right at its first hit, trims the dead tail, sets a common
loudness, and prints the "lead to peak" in milliseconds. That printout is where the lead number comes from.

**Numbers.** Example leads: whoosh 0.15 s, meow 0.20 s, jet 0.25 s, sneeze 0.39 s (most short hits: 0). Per-sound trims
-4 to +3 dB. Mix levels: voice peak at -1.5 dB, effects about 12 dB under it, music peak -13 dB and 5 dB lower while the
voice talks (fast attack ~20 ms, slow release ~250 ms). The same sound again within 0.35 s gets 0.8x quieter each time
(floor 0.5x). Variants (poof, poof_1, ...) rotate, so the same file never plays twice in a row. Prep: the onset is at -12 dB
below the peak, with 4 ms kept before it; the loudest 100 ms sits at -10 dBFS; the peak is capped at 0.95.

**How we do it.** Our engine already has its own sound pipeline (`engine/audio/sfx*.mjs`, `mix.mjs`). Add three things:
- (a) A per-sound `lead` and `gain` table next to our own sound files, measured by our own prep step (find the first
  loud peak; lead = the time from the file start to that peak).
- (b) Cue placement at `word_time - lead`.
- (c) The repeat-softening and the variant rotation.
The cues come from our shot rows (a `sfx` field per row or per action), so no render is needed to collect them. Use
only our own or licensed sounds, never the kit's `sfx/` folder.

## 5. Fast preview, then re-preview only the fixed shots

**How it works.** Three render modes on the same shot code:
- **Preview:** the middle frame of every shot at 25 % size, 8 samples, no motion blur.
- **Still:** one chosen time in one shot at 50 % size, 16 samples.
- **Final:** every frame at full size, 24 samples, per shot.

Previews go into one labelled contact sheet (tiles 216x384, shot number on each). After fixes, the preview runs again
**only for the listed shots** ("3,7,12" or ranges), and the final can also re-render only listed shots. Every shot is
independent, so this is safe. After the finish, a QA sheet takes 1 frame every 1.8 s of the real final file (tiles
216x384, 10x4 grid), so the shipped file is checked, not just the previews.

**Numbers.** Preview ≈ 2 min for 66 shots on a decent GPU; final 1.5-2.5 s per frame on a gaming laptop (~1 h for 80
s). The fix loop is: look at every tile; fix; re-preview only those shots; repeat until every frame reads (face
visible, subject framed, nothing in front of the lens). One more trap they list: show/hide keys less than one frame apart
merge into one, so key them a full frame apart.

**How we do it.** Our pipeline already has preview, contact sheets and fix rounds. The parts to copy as ideas:
- (a) Make "only these shot ids" a first-class option at every stage (preview, still, final) with a stable frame
  naming, so a fix never re-pays for untouched shots.
- (b) Keep the 25 % / 8-sample preview cheap and the 50 % single still for close checks.
- (c) Always run the QA sheet on the finished encode.
- (d) Have a free pre-check before any GPU time: the coverage check, the word anchors, and the MIT composition check
  (rule 74 in file 05).

---

## What we must not take from it
- No code (`rbx/`, `tools/`), no face sheets (`assets/faces/`), no textures (`assets/tex/`), no sounds (`sfx/`), no
  example stories or their `shots.py`, no narrator sample (`voice/`), and no long quotes of its SKILL.md or PLAYBOOK.
- Learning the methods and numbers above and writing our own code is fine. Copying its files or text is not, unless the
  author gives us a written licence.
