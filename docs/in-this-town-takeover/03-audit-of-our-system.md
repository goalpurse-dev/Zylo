# Audit of our In This Town system (round 10 traced end to end)

Read-only, $0. Branch: laptop-transfer.

## Verdict first

Round 10 did not fail because of one weak step. It failed because about ten layers each make their own guess about the same facts: who is in the scene, where they stand, what a thing is called, what the rule is, and how big things are. Nothing makes those guesses agree.

- **Honest score of round 10:** 2 of 22 cards are watchable (cards 16 and 17, a single character in a medium shot). The run reported 1.
- **What customers see:** the live site still runs the older engine. In that engine an AI writes the Blender code, and the round 8-10 work is not reachable from it at all.

## Where each visible mistake in round 10 was born

| What you see | Born in | Cause |
|---|---|---|
| The monster missing, never filmed, never leaving (lines 10-22) | Script ↔ card checker | The writer named it "Max". The card checker only knows "monster". 15 of the 21 card rejections were this one naming clash: every cut showing it was refused, and every action it had (talk, take the flashlight, run away) was dropped. In the morning scene it is still standing in the house. |
| Monster legs filling the lens (12 cards) | Card + camera | A 14-unit monster was sent to the "front" spot, the one nearest the lens. Because it was "off stage", the monster camera recipes never ran. The engine measured "covers 100%" on 11 stills, but that measurement is not one of the failing checks. |
| People missing or hidden (6 cards) | Same as above, plus fences | People stand behind porch rails and posts. The fence clearing only works on the street set. The camera keeps a blocked view and logs "clear False" (14 cuts). |
| Named things not shown (11 cards) | Plan + compiler | "Porch light" has no object; it compiles to an empty camera subject, so the camera frames everyone. "Our porch light went out" switched off a loose light bulb lying on the lawn. Street lamps were already switched on 3 lines early. |
| Grandpa wrong on all 22 cards | Plan → looks | The plan gave colours as words ("tan", "gray"). The look locker only accepts colour codes, so it fell back to a palette: dark skin, brown hair, a kid's face. The script said he wore orange; he came out yellow. |
| Grandpa's glowing eyes | Engine bug | These are his own "star eyes" from line 19. A visibility helper writes its hide key backwards, so any effect is visible from frame 1 until its real start. Every caller of that helper has the same bug. |
| People inside each other or inside walls | Engine design | Spots are 1.1 units apart, which is less than a body. Nothing tests a body against walls or other bodies. The step-back and push-away helpers move people with no wall test. |
| Props the wrong size | Compiler | Hard-coded size multipliers: rule object ×1.8, named thing ×1.5, ×2.4 if a monster is present. The flashlight changes size between scenes, and the giant glowing bucket hides the kid. |
| The same shot repeated | Card checker | Repeats are compared before the compiler changes who is in the shot. With the monster banned, the director had only two people to show for ten lines. |
| 60 "rule breaks" (all false) | Runner | The rule check is hard-coded to the chalk-line story's "stay inside at night" zones. This story's rule (keep the porch light on) is not modelled at all, and no place has zones unless a chalk line exists. |
| The props the builder made, never used | Writer | The writer's prompt is built when the code loads, before the builder's new props are added. The writer never saw the porch lantern, oil can or wheelbarrow. |
| Dim sunset, wrong light | Engine layers | Three stacked light wrappers multiply the sunset by 0.5, 0.6 and 0.7. |
| Characters standing still | Engine bug + dropped actions | The idle-life code crashes on the dot faces and the error is swallowed, so nobody breathes or blinks after that. Actions the checker could not place are silently dropped instead of failing the card. |

## Real bugs (file : cause)

1. `writer4.js:20-36` and the director prompts: built at import, so `addThings()` (storyboard10.mjs:68) never reaches them.
2. `director4.mjs:46,63,87,129-143` vs `takes.mjs:291`: the monster's identity is the literal word "monster"; any name the writer gives it breaks the checks.
3. `takes.mjs:74-85` `lockLooks`: only accepts colour codes, so the plan's colour words are thrown away.
4. `crowds.py:22-29` `zt_vis`: the "hidden from" key is written at frame 1, so effects show early (star eyes, signs and others).
5. `motion.py:424` / `pieces.py:366` `zm_blink_dots`: crashes on dot faces, and `worlds.py:3095-3099` swallows it, so idle life stops.
6. `takes.mjs:559`: lamps, windows and porch light are dropped from the camera subject list, which leaves an empty subject.
7. `storyboard10.mjs:151`: the "goes outside" regex matches "porch light goes out" and gives the narrator a rule exception on line 1.
8. `writer2.js:27`: "lantern" and "dusk" are on the banned hard-word list, yet the topic asked for a porch lantern from dusk to dawn.
9. `stage.py:145-159` `zo_state`: switching one bulb changes a shared material, so every bulb switches.
10. `storyboard10.mjs:149-150` and `stage9i.py:42`: rule zones are hard-coded, and zones exist only when there is a chalk line.

## Rules that contradict each other or that nothing checks

- **Places.** "One main place + one side place" (engineKit.js:78) and "ONE STAGE" (director3.mjs:30), against "1-3 places" (writer4.js:25).
- **Cast.** 2-3 (rules doc), 1-3 besides the narrator (writer4), up to 4 (director4).
- **Words per line.** 4-12 (prompt) against 13 (code).
- **Cuts per line.** "2-3" (prompt) against 1-3 by length (code). "Each cut shows ONE thing" against "kid + monster in one low shot" against "rule object in most shots".
- **"danger_line" means two different things** (writer3.js:72 against writer4.js:75), so it can never pass. That cost a second Opus writer try.
- **Line 1.** The writer's own good example opens "In this town, a monster lives…", but the code demands "In this town, every…".
- **Lips.** The rules doc says lips move; round 9 says no mouths move except the monster's.
- **Rules no step checks:** the push-in share and rule-object share are measured only after everything has rendered; nothing reacts to them. The monster-blocking measurement is logged and ignored.

## Checks that passed wrong pictures, and failed right ones

- **The vision check passed 7 bad stills**: backs of heads, no porch light, a porch light still on after "went out". Its "world_ok" field was never false.
- **The card code check passed 3 story errors**: lamps on too early, the wrong light switched, Grandpa switching off the light.
- **The acting check found 0 problems.** It still contained the previous story's want: "catch someone outside a line".
- **It failed a good card** (16) on continuity. It also gave wrong reasons ("flat surface") for monster-blocked frames.
- **Only stills were checked.** The preview video differs from the stills: Grandpa holds the bucket in the stills but it lies on the road in the video.

## Duplicated and dead code

- **Python.** 19 files (11,574 lines) are pasted into one script. Each later "stage9x" file wraps the earlier one by name. There are 59 functions defined more than once; the camera function `zc_cut` alone is defined 10 times, the light 8 times and the monster 7 times. Nobody can predict which version runs. **Rebuild placement, camera, light and monster as one module each.**
- **JavaScript.** writer4 runs on writer3, which runs on writer2. Messages are filtered with regexes on their text, and the plan prompt is patched with `.replace()`. **Merge each into one.**
- **About 23,000 lines are used by nothing:** round 2-7 runners, `reshoot`, `dispatch`, `cards.mjs`, shotlib, look, lookgate, golden, most of the old three.js `engine/`. **Delete after the new path works** (they cost nothing while they sit there, but they confuse every reader).
- **Things that must stay until the new engine replaces live:** the live writer (hybrid.js and its family), `director.mjs`, `worlds.py`, studioWorker, and the voice and mix parts of `engine/`.
- **Warning.** The local `worlds.py` is 643 changed lines ahead of main, so the next worker deploy would quietly change the live engine.

## Where money is wasted

- **Rewrites that cannot pass.** Contradicting rules make the writer and the card writer retry (21 card rejections; a second Opus try at about $0.12). Those retries cannot succeed.
- **Rendering stories that are already broken.** Stills, maps and a preview video ($0.19) were made after the script still had 2 open problems and the card checker had failed 13 of 22 cards.
- **Builder spend with nothing to show.** The round 9 builder test cost $3.03 for 1 good still of 10. The failures came from placement and camera, not prop shape. Round 10's three built props were never used.
- **The live engine's director.** It costs about $1.47 of an estimated $3.12 per video, because an AI writes Blender code in a long conversation with fix rounds.

## The price

313 credits comes from `blenderCredits(90)`, the old engine's 90-second estimate of **$3.12 cost** (blenderPricing.js). By your rule (price = 2x cost), 313 credits allows about $1.56 of cost. So the old estimate was either 1x margin or out of date. **The new plan targets about $1.00-1.30 per video, which fits under 313 credits at your 2x rule.**

## What is worth keeping

- The blocky look itself: characters, faces, the suburb set, lighting quality.
- The voice chain (your voice at 1.2x, word timings) and captions.
- RunPod rendering.
- The idea of state checked in code. Kept, but as a small per-shot record, not a live simulation.
- The hand-over/pocket code (but don't use it in customer videos; the references never show hand-overs).
- The builder for props, as a library tool.
