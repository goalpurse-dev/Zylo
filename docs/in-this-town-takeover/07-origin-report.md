# 07. Origin report: where the Blender kit came from, and what of ours depends on it

**Result first.**
- `reference/blocky-worlds/roblox-story-kit` is **another creator's "Roblox Story Kit"**, in its **earlier ElevenLabs edition**.
  It has no VERSION file; the zip's files are dated 6-7 Nov 2026, and the zip landed on this laptop on 12 Nov 2026.
- It is the same kit as the "Flashloop edition 2.2" studied in file 06. The engine files `rbx/core.py`, `chars.py`, `acting.py`,
  `tools/shotkit.py`, `render.py`, `mix.py` and `finish.py` are byte-identical. `story.py` only gained `from_sheet` in 2.2.
- **It has no licence and no copyright line.** The only "permission" is one sentence of ours in
  `scripts/blockyWorlds/blenderKit/README.md` ("used with the creator's permission"). I found nothing written from the
  creator in the repo.
- **Our whole Blender engine runs on top of that kit.** Every scene file of ours is pasted under the kit's
  `from shotkit import *` and calls its builders. The kit's renderer, mixer and finish make every frame and the final mp4.
  The kit's code and assets are baked into the RunPod image.
- **Before go-live to customers, either get a written licence from the creator, or replace the kit's runtime** (about
  4,300 lines of Python plus its face sheets and sounds) with our own. Our own code on top of it (about 11,000 lines of scene,
  stage, action and character code, plus all the JS glue) stays ours either way.

---

## (a) Origin check

### Where it came from
- The folder holds `roblox-story-kit.zip` (20 MB, 125 files, dated 2026-11-06/07 inside; the zip file itself is from 12 Nov
  19:56) and `unzipped/roblox-story-kit/` (12 Nov 20:26).
- **Git history: none.** `git log --follow` on the folder returns nothing, and `git ls-files` lists nothing. The folder is kept
  out of git on purpose by `.git/info/exclude` ("Blocky Worlds reference inbox ... reference/blocky-worlds/roblox-story-kit/").
  A test (`tests/blockyWorldsWorkerBlender.test.mjs`) asserts it stays untracked.
- First use: commit **727ee8d05, 2026-11-13**, "Blender kit engine phase 1: a creator's Blender story kit renders on RunPod
  GPU (our glue only; the kit's files stay outside the repo)". `handler.py` history (8 commits) starts there; then
  c01b29477 (13 Nov, the AI director writes the kit's `shots.py`), da0691419, df56aa69d (14 Nov), 308b0a309 (15 Nov, owner-only
  launch).
- **Version:** no VERSION file. The README says "Roblox Story Kit ... gets the voice from ElevenLabs", and the folder has
  `tools/eleven.py`. That makes it the **ElevenLabs edition, before 2.2 (Flashloop)**. Compared with 2.2 (`diff`): identical
  except README, SKILL.md, PLAYBOOK.md, `story.py` (+`from_sheet`), `kit.py`; 2.2 added `options.py` and `script_text.py` and
  dropped `eleven.py`.
- **Licence / copyright / author:** a search of every .py and .md in both editions for copyright, licence, author and ©
  finds **nothing**. There is no LICENSE file. 2.2's SKILL.md calls the narrator sample "provided by the kit's author for kit
  users". 2.2's README makes the kit work "only for Flashloop subscribers". So: **all rights reserved by default.**
- Our only permission claims are in our own files: `blenderKit/README.md` line 3 ("used with the creator's permission") and
  `studioWorker/buildContext.mjs` line 67 ("a creator's kit used with permission, NEVER in git"). There is no email,
  licence text or name of the creator anywhere in the repo. **Ask the owner where that permission is written down.**
- Our free Studio kit plan (`docs/zyvo-studio-kit-plan.md` line 37) already says "clean room ... nothing is copied from
  the kits the owner shared (roblox-story-kit or others)". That applies to the Studio kit, not to the Blender engine.

### What the kit is, in lines (the borrowed code)
| Kit file | Lines | What it does for us |
|---|---|---|
| `rbx/core.py` | 692 | box / cyl / sphere / plane / card / text / mat / hexc / light / empty / instance / collection, `F(t)`, `key`, `Cam` (push, orbit, crash, whip, track, handheld), `sfx`, `setup_render` (EEVEE settings) |
| `rbx/chars.py` | 458 | `Char`: the blocky rig (body, hair, clothes, pose, walk, idle) |
| `rbx/acting.py` | 302 | faces, blinks, talk flaps, gestures (`act`), nod, look, jump, run, breathe |
| `rbx/story.py` | 396 | `S()` shot decorator, `_live`, cast presets, crowds, confetti, `facing`, `drift` ... |
| `rbx/world.py`, `world2.py`, `sets.py`, `locs.py`, `fx.py` | 1,818 | ready sets and effects (classroom, town, cockpit, poof ...) |
| `tools/shotkit.py`, `render.py`, `finish.py`, `mix.py`, `kit.py`, `contact.py` | 644 | the shot framework, the headless renderer (preview / still / final / cues), the audio mix, captions + encode, contact sheets |
| `assets/faces/*.png`, `assets/tex/*.png`, `sfx/*.wav` | (art) | the 7 face styles our `chars.Char(face=...)` calls use, the textures, the 40 sound effects the cues use |
| `SKILL.md`, `PLAYBOOK.md`, 2 example `shots.py` | (text) | sent as the director's system prompt on every run |
| **Total kit Python we run** | **≈ 4,300** | |

### Every file on the live path and in v2 that depends on it
Rough counts. "Code lines" excludes comments and blank lines. "Calls kit" means lines that call a kit function by name
(box, cyl, sphere, mat, F, Cam, light, chars.Char, story.*, W.* ...). Method calls on kit objects (`ch.pose`, `ch.face`,
`ch.walk`, `cam.key`) are counted separately.

| Our file | How it depends on the kit | Our code lines | Lines calling kit names | Kit method calls |
|---|---|---|---|---|
| `blenderKit/Dockerfile` | `COPY kit /app/kit` (rbx, assets, sfx, render / shotkit / kit / finish / mix / contact) into the RunPod image | 63 total | - | - |
| `blenderKit/buildContext.mjs` | copies the kit from `reference/.../roblox-story-kit` into the image context | 89 total | - | - |
| `blenderKit/handler.py` | runs the kit's `tools/render.py` (preview / cues / final) and `tools/finish.py`; parses the kit's render log | 463 | 0 (calls it as a program) | - |
| `blenderKit/finishx.py` | runs after the kit's finish (-14 LUFS, captions per speaker); our own code | 126 | 0 | - |
| `blenderKit/pipeline.mjs` | `KIT` dir; runs `kitmap.py` on `rbx/*.py`; builds the director prompt from the kit; tells the director only the kit's 7 face names work | 800 total | - | - |
| `blenderKit/director.mjs` | system prompt = the kit's SKILL.md + PLAYBOOK.md + toolkit map + one or both example `shots.py`; writes `shots.py` with the kit's header (`from shotkit import *`, `from rbx import story`, `from rbx.story import *`) | 1,145 total | - | - |
| `blenderKit/kitmap.py`, `shotcheck.py` | read the kit's `rbx` source / allow only kit names | 81 + 117 total | - | - |
| `blenderKit/worlds/worlds.py` | pasted after the kit header; "built from the kit's primitives"; uses `chars.Char`, `story.acting.EXPR`, patches `chars.Char` properties | 2,643 | 490 (19 %) | 27 |
| `blenderKit/worlds/acts.py` | same paste; walks, falls, grabs on kit `Char` | 429 | 101 (24 %) | 34 |
| `blenderKit/worlds/pieces.py` | props and camera recipes from kit primitives | 373 | 75 (20 %) | - |
| `blenderKit/worlds/stage.py` + `stage9*.py` (9 files) | rounds 8-9 takes, cameras, blocks on kit `Cam`/`Char` | 4,215 | 273 (6 %) | ~41 |
| `blenderKit/worlds/builder.py`, `crowds.py`, `effects.py`, `motion.py`, `town.py`, `sheet.py` | same paste | 1,877 | 123 (7 %) | ~60 |
| `blenderKit/actions/actions.py` | the catch moment; extras via `chars.Char` + `story._live` | 115 | 4 (3 %) | 7 |
| `v2/char_v2.py` | **its own character class** (`ZChar`, own face parts, poses), but built from kit primitives (box 63, empty 29, cyl 26, sphere 20, mat 17, key 14 ...) | 774 | 177 (23 %) | 1 |
| `v2/stage_v2.py` | pasted after the base engine above; `Cam`, `mat`, `light`, `F` | 184 | 4 (2 %) | - |
| `v2/*.mjs` (`castSheet`, `charSheet`, `stageTest`, `storyStills`) | write a `shots.py` with the kit header and render through the kit's `render.py` | ~520 total | - | - |
| `blenderKit/worlds/motion.mjs`, `stills.mjs` | same kit header | - | - | - |

Also: `studioWorker/buildContext.mjs` puts the kit's SKILL, PLAYBOOK, `rbx/`, `tools/*.py` and examples into the Fly
worker image (`BLOCKY_WORLDS_KIT_DIR`). `music.mjs` and `dispatch.mjs` also point at the kit folder.

**Summary of the numbers.** Our Python on top of the kit is about **11,200 code lines**, 10,600 of them scene code. About
**1,250 of those lines (≈12 %)** call kit functions directly. Every one of them only runs inside the kit's runtime (≈4,300 kit lines). Our JS glue
(director, pipeline, checks, v2 planners) is ours, but it writes code for the kit and starts the kit's tools.

### What is ours and what is not
- **Ours:** the scripts, the voice pipeline, the AI director and its prompts (our text), all checks (framing gate, shot
  check, stage check, facing, v2 shot rows), the RunPod/Fly glue and sandbox, `finishx.py`, our music bed. Also the world
  library, actions, pieces, stages, builder, the v2 character (`char_v2.py`), the stage data, and the CC0 asset library.
- **Not ours (no licence):** the runtime all of the above runs in. That is `rbx/` (primitives, materials, camera moves, the
  `Char` rig, the acting layer, the shot decorator, sets), `tools/shotkit.py` / `render.py` / `mix.py` / `finish.py`, the
  face sheets (`assets/faces`), textures, the sound pack (`sfx/`), and the kit's SKILL.md / PLAYBOOK.md / two example
  `shots.py`, which we send to the model on every run as the director's instructions.

### What needs replacing or a licence before go-live
1. **Either** a written licence from the kit's creator that covers commercial use inside a paid product, running it on our
   servers, and sending its docs to an AI model. **Or** replace the runtime:
   - (a) our own primitive and material layer (box, cyl, sphere, mat, key, light, text, `F`);
   - (b) our own camera moves;
   - (c) our own shot framework and renderer (preview / still / final / cues);
   - (d) our own mixer and finish (we already have `engine/audio/mix.mjs` and `finishx.py`);
   - (e) drop `chars.Char` and the kit faces everywhere and use `char_v2.py` only.

   v2 is already most of the way there: `char_v2.py` has its own rig and faces. It still uses kit primitives and the kit renderer.
2. **Director prompt:** stop sending the kit's SKILL.md, PLAYBOOK.md and example `shots.py`. Write our own guide (files 05
   and 06 give the knowledge, in our words).
3. **Assets:** take the kit's `assets/` and `sfx/` out of the RunPod and Fly images. Our sound effects come from our own pipeline.
4. Until then, keep the Blender engine owner-only (as it is today: `BLOCKY_WORLDS_BLENDER_OWNER_IDS`).

---

## (b) MIT troubleshooting fixes our free Studio kit (`kits/zyvo-roblox-story`, v1.4.0) is missing

Our kit records a live Play run (R15 statues, its own camera script) instead of rendering frame by frame. So some MIT
fixes do not apply (face cards via SurfaceGui, Motor6D poses and AvatarJointUpgrade, catalog accessories dropped on R6,
render-loop warm-up frames, crop resolution). It already has: camera never inside parts plus near-lens cover,
line-of-sight to faces, scripts / sounds / prompts / remotes stripped from models, a fixed quality level, the camera reset
to Fixed after captures, the `studio_id` choice, keep Studio visible, a framer check for the world's edge.

**Missing:**
1. **Switch off every post effect the kit did not make** (depth of field, blur, extra colour corrections, a second
   Atmosphere left by plugins). `lighting.luau` only adds its own and never disables foreign ones.
2. **Depth of field is used on purpose** (rack-focus shots turn `ZyvoFocus` on). MIT: DoF blurs characters near the camera
   and switches anti-aliasing off. Drop rack focus, or check it in a still.
3. **A minimum camera distance to heads (~2.5) and props (~1.2), and a minimum height (~2).** The framer only checks "not inside
   a part" and "above 0.6".
4. **Nearest free angle** (try 35 / 70 / 110 degrees, then the other side) before failing a blocked camera.
5. **Tree crowns and lamp posts don't block** the line-of-sight check; trees near the action go to an archive folder (film-set trick).
6. **Invisible blockers in window openings**, so cameras don't film rooms from outside through the glass.
7. **Two-shot width rule** (the 9:16 frame is only 0.5625 x its height wide; stand pairs 2.5-3 apart) and the
   "two backs of heads" staging fix (three-quarter photo pose or over the shoulder).
8. **Seated characters**: lower the camera ~1.5 for them.
9. **Look targets within ~35 degrees** of the body direction (else the back of the head shows).
10. **Fights and arguments at ~45 degrees** to the camera, not pure profile; **groups in a horseshoe**, never a closed circle.
11. **Escape paths and walker lanes** checked against the lens and the story marks (walkers through the hero).
12. **Ground height by a downward ray at each spot** (characters floating over the road).
13. **"Rows come out mirrored"** note (+X is screen-left when looking along +Z).
14. **Giant things close (~28) with a low camera looking up**, not far away.
15. **Partial transparency**: the monster mist (0.6) and shadow (0.3) are half see-through parts, which Roblox sorts wrongly
    and which can flicker. Never put partial transparency on bodies (ours are opaque). Check the mist in the recording.
16. **WeldConstraint drawn as a green square** in Studio captures: `cast_lib.luau` line 336 welds with `WeldConstraint`. MIT
    uses a classic `Weld`.
17. **Night faces**: a soft fill light that follows the camera, and **dark window panes + low Reflectance (~0.04)** so night
    rooms don't show a daytime sky. `lighting.luau` has one warm afternoon look only.
18. **Long words cut off on signs** (TextScaled stops at 100 px): the blockout sign uses TextScaled with no check of the
    longest word.
19. **BillboardGui text is missing in `screen_capture` stills**: the rule numbers over heads are BillboardGuis, so the
    contact sheet may not show them even though the Play recording does.
20. **Numbers written as words** in the narration (digits slow TTS and break captions).
21. **Word anchors hit the wrong occurrence** of common words: print each anchor with its sentence.
22. **Captions must match the voice word for word** (assert, refuse a mismatching `words.json`); a recording that matches the
    script under 90 % means the script must be edited to what was said. (`voice.md` stops on a mismatch but has no 90 % rule.)
23. **Loudness**: normalise to about -15 LUFS (true peak -1.5). `add_captions.sh` only measures the mean volume for pause
    detection.
24. **Narrator pace**: our default is ~195 words/min (3.25 words/s). The MIT hits measured 3.5-4.7 words/s with no pause over 0.8 s.
25. **Terrain pokes through roads** (4-stud terrain cells): carve terrain under roads, or use parts only.
26. **Too many lamps blow out a room**, and **shadow-casting story lights slow Studio** (dropped frames in a live Play run):
    `Shadows = false` where the shadow doesn't matter.
27. **"Failed to parse" from a `--` comment before `end`** on the same line, and **"Device removed"** (a GPU driver reset:
    let the user press OK, never force-close Studio).
28. **Module leftovers after an update** ("attempt to index function"): make modules overwrite old non-table values on load.
29. **Catalog / toolbox search HTTP 429**: wait and retry, search less at once.

Defaults that differ from the MIT measurements (not bugs, but worth a decision): our shot mix asks for **at least 25 %
close-ups** and **at least 4 locations per ~90 s**. The MIT kit measured **7-15 % close-ups** in comedy and everyday hits,
and **few places revisited** (49-83 % of cuts stay in the same place).
