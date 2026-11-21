# Blender kit engine (phase 1: does a creator's Blender story kit render on RunPod GPU?)

The kit (`reference/blocky-worlds/roblox-story-kit/`, git-excluded, used with the creator's permission) builds every
shot in Blender from Python and renders it with EEVEE. This folder is only our glue; the kit's files never enter the
repo: `buildContext.mjs` copies what the image needs into a folder outside it.
Exclusions (the owner's): no TEMPOREX music, no yt-dlp (the kit's `setup.py` / `eleven.py` / `voice.py` are not in the
image), no 1:1 copies of other creators' videos. Music = our own synthesized bed (`engine/audio/music.mjs`, "funny").

## Files
| File | What |
|---|---|
| `Dockerfile` | debian trixie-slim + Blender 5.2.4 (sha256-checked) + ffmpeg/libass + Xvfb + VirtualGL + python3 numpy/Pillow + `runpod`; NVIDIA EGL/Vulkan vendor files; user `render` |
| `buildContext.mjs` | context folder outside the repo: kit `rbx/ assets/ sfx/`, tools `render shotkit kit finish mix`, the video folder, a kit `config.json` (caption font Archivo Black, no music URL), our music, our glue |
| `handler.py` | RunPod handler, roles `probe` / `render` (kit `render.py <slug> final <shots>` -> x264 crf 12 segment) / `finish` (segments -> `frames/%04d.png` -> kit `finish.py`) |
| `boot.py`, `gpucheck.py` | Blender-side: the Python sandbox layer; the EEVEE GPU check |
| `plan.mjs` (+ test) | shot frames from the kit's `shots.py` + `words.json` (the kit's own F(t), Python rounding); contiguous K-way split by frames |
| `setup.mjs` | template + endpoint `zyvo-blender-kit` (3 workers) and Blocky `gm9eqdkuyc2ofs` workersMax 6 -> 3; `--rollback` |
| `dispatch.mjs` | `--probe` / `--render`: estimate first, cap check, jobs, finish, download, contact sheet, spend ledger |
| `contact.py` | one labelled frame per second of the real final encode |

## Build + run
```
node scripts/blockyWorlds/blenderKit/buildContext.mjs <ctx outside the repo>
cd <ctx> && fly deploy --app zyvo-cutaway-render-staging --dockerfile Dockerfile --build-only --push --image-label blender-kit-<n>
node scripts/blockyWorlds/blenderKit/setup.mjs --image registry.fly.io/zyvo-cutaway-render-staging@sha256:<digest> --yes
node scripts/blockyWorlds/blenderKit/dispatch.mjs --probe  --out <dir> --diag-root [--yes]
node scripts/blockyWorlds/blenderKit/dispatch.mjs --render --out <dir> --chunks 6 --s-per-frame <probe's> [--yes]
```

## Sandbox (Blender runs scene code: today the kit's, later generated)
1. **No secrets anywhere near it.** The image holds none and the template sets none. Jobs carry only signed storage
   URLs, and those stay in the handler: Blender never sees them.
2. **Whitelisted environment.** Blender and `finish.py` start with only PATH, HOME/TMPDIR (the job folder), LANG and
   the NVIDIA variables. No `RUNPOD_*` (the worker's own job-queue key lives there) and nothing else from the handler.
3. **Unprivileged user.** `setpriv` drops to the user `render` (no groups, no-new-privs). It can't read
   `/proc/1/environ` (root's env). The kit code and assets are root-owned and read-only. Each job gets its own folder,
   `/tmp/bk/<job>`, with links to the kit and a private copy of the video folder.
4. **No network.** The worker puts the process in a network namespace with no interfaces: root `unshare --net` then
   drop to the user, else a user namespace `unshare --net --map-root-user`. The probe reports which one the
   container allows. Inside Blender's Python, `boot.py` always blocks sockets and subprocesses, and Blender runs with
   `--offline-mode`. That layer still stands if the container allows no namespace.

## Measured (2026-11-13, sneeze_teleport, 66 shots, 2149 frames, 71.6 s, kit settings: 1080x1920, EEVEE ray tracing, 24 samples, motion blur)
- Blender 5.2.4 LTS draws headless on the NVIDIA GPU over **EGL** (`blender -b`, no X server): "NVIDIA RTX A4500/PCIe/SSE2",
  OpenGL 4.6. VirtualGL on Xvfb and Vulkan also work; EGL is used (same OpenGL backend as the kit's desktop renders).
- The container allows no namespaces (`unshare: Operation not permitted`), so the network block is **seccomp**
  (`netblock.py`): NET_BLOCKED for the render user; its env holds no keys; `/proc/1/environ` is denied.
- **0.66 s per frame** on an RTX A4500 (scene builds included), 6 chunks of ~350 frames on 3 workers:
  render wall 553 s, the kit's finish (unpack + mix + captions + 3 encodes) 195 s, **12.2 min end to end**.
  Billed ~1,800 GPU-s = **$0.29** for the 71.6 s video ($0.33 including the two probes); RunPod balance moved $0.336.
- Segments are x264 crf 12 (15-24 MB each), finals 64 MB (`final.mp4`), 70 MB (no captions), 24 MB (phone): all go
  through storage in <= 45 MB parts.
- To check: shot 22 starts with ~0.6 s of black (the poof cloud over the lens in the dim comedy club: the kit's scene
  code, not the worker). Compare with the creator's own render before blaming the engine.

## Phase 2: Studio-Blender (the AI director writes the kit's shots.py), 2026-11-13
| File | What |
|---|---|
| `director.mjs` | the director: cached system prompt = the kit's SKILL.md + PLAYBOOK.md + `kitmap.py`'s toolkit map + both example shots.py; ONE conversation: plan (header code + shot list by word index) -> bodies in batches of <= 8 -> fixes; ONE output schema and ONE effort for every turn (either change rewrites the ~85k-token cache); task budget, streamed, priced worst-case first (whole input at the cache-write price, the last call's measured tokens), never resent after a network failure, every answer saved; the fixed vision checker (Sonnet low) |
| `pipeline.mjs` | one video, automatic after the script: director -> `shotcheck.py` -> previews (kit preview mode + the kit's contact sheets) -> pixel check + vision -> at most 2 fix rounds (10 shots a call; a round the caps cannot fund is skipped) -> a still-crashing shot merges into its neighbour -> the parallel final + the kit's finish (cues, OUR music, captions) -> contact sheet, black / flat scan, library. Resumable (state.json; downloaded previews are never paid again) |
| `shotcheck.py` | the static pre-check (AST): only the kit / math / random / Vector, no imports, no os (but os.path.join), sys, open, eval, getattr, dunders, bpy.ops ... (both kit examples pass). Runs on the laptop / worker AND in the GPU worker before Blender |
| `kitmap.py` | the toolkit map generated from engine/rbx/*.py (signatures + one-line purpose) |
| `trim.mjs` | fit a take to a length by dropping whole lines (free; a script-approval edit) |
| `rp.mjs` | RunPod jobs + storage parts for a run, each priced worst-case on the run's ledger first |
| `library.mjs`, `approve.mjs`, `library/` | built sets / props that passed: saved PENDING; `node approve.mjs <id> [--reject]` |
| `workerSteps.mjs` (+ test) | the Studio worker option: `BLOCKY_WORLDS_RENDER_ENGINE=blender` AND the run's user in `BLOCKY_WORLDS_BLENDER_OWNER_IDS`, else Studio as before (off by default). Same queue / stages / ledger / refund as Studio |
Worker roles added (`handler.py`): `preview` (a validated video tar: known files only, size caps, shotcheck), `render` / `finish` with `videoUrl` (finish runs the kit's `render.py cues` first).
Not done: the Fly worker image would also need the kit's docs + rbx (BLOCKY_WORLDS_KIT_DIR) and python3 + Pillow; nothing deployed.

First test (owner, "In this town, we live in a plane.", Sonnet 5.5): 69 shots, 72.9 s, $2.79 of the $5 cap. Script $0.18,
voice $0.13 (80.6 s take, 3 lines trimmed -> 72.9 s), director $2.09 (three avoidable cache rewrites: plan / batch / fix
schemas differed), vision checker $0.06, GPU previews $0.05, GPU final $0.27. Round 0: 18 crashed, 2 pixel, 18 vision; round 1
fixed every crash (14 vision issues left); round 2 skipped by the cap.

## After the first test (2026-11-13, free changes)
- MUSIC (`music.mjs`): the finish uses OUR track, the one our #2 video used: the engine's bed A (audio/backrooms.mjs via
  bedFromLoop, at the voice's 1.25x pace) at #2's level: 14 LU under the voice after ducking. The kit's mix.py works by
  peaks, so the orchestrator measures the voice and the bed (stereo) and passes `--music <bed> --music-speed 1
  --music-db <calibrated>` to finish.py (the bed travels in the video tar). Check on the plane voice:
  #2's way (engine mixV2) voice -16.0 / music -30.0 LUFS (14.0 LU), the kit with our bed voice -16.5 / music -29.6 LUFS
  (13.1 LU); the kit's mix has no loudnorm: -16.4 LUFS overall vs #2's -14. `node music.mjs --voice <wav> --out <dir>`.
  Needs an image rebuild (handler.py) before the next run.
- DIRECTOR: at least 3 locations (every shot names its location; the plan check asks once more, then stops before any
  GPU money); close-ups framed wider (medium shot with head and shoulders, small props scaled up, the camera 3.5+ units
  from the subject and 2+ from walls / seats / boxes); a FOREGROUND-SLAB pixel suspect (centre box: biggest 16-level
  share + edge density, calibrated on the first test: 8 of 12 slab flags, 3 face close-ups) that the checker is asked to
  confirm (never blocking on its own); the approved library builds that match the story go into the plan brief.
- LIBRARY: approved plane-ext, cabin-scene, belt, kite, hand-bell, oven, hat-on, rope; rejected seat-cake, sky-wind.

## Director upgrade (2026-11-14, free; what goes on screen, learned from a 6M-view reference, never its look)
- Prompt: the kit's look kept; every line shown LITERALLY; ~50 cuts a minute; ONE striking hero outfit + distinct colours per
  character (a style_sheet in the plan); ANCHORS (recurring places) set up early and back in the ending; reaction close-ups
  on the big beats (the twist: the hero's face); an intentional black screen (<= 2 s) only when the line says black / dark /
  lights out; the final image shows the consequence of the last line.
- Plan check (`planProblems`): 3+ locations, >= 42 cuts a minute, exactly one hero, distinct colours, an anchor set up early
  and back in the last 15% of the shots; one re-plan, then a stop before any GPU money.
- Checker: per line, the key noun / action must be on screen in one of its shots (fix_shot gets the fix); the final shot
  must show the consequence; the black-screen shots are let through (also in the pixel and the final frame checks).
- CAPTIONS PER SPEAKER (`speakers.mjs` + `finishx.py`): script.json `line.speaker = "Name"` colours the words inside double
  quotes in that line (no quotes: the whole line); `script.speakers = { Name: "#RRGGBB" }` optional; the narrator white.
  The kit's finish runs with --no-captions; finishx.py burns the kit's caption style with the colours, after normalising the
  mix to -14 LUFS (two-pass loudnorm) and remakes the phone copy. Checked on the plane run (12 s): -16.4 -> -14.1 LUFS.
  Needs an image rebuild before the next run.

## World library v1 (2026-11-14): DRESS library worlds instead of building worlds per video
- `worlds/worlds.py` holds our own base worlds, built from the kit's primitives:
  - PASTEL DOWNTOWN: a street of shops with striped awnings and story signs, trees, lamps and benches, cars, skyscrapers,
    a plaza with a fountain, and a LANDMARK slot (bank / city hall / clock tower / giant screen);
  - SUBURB: porches, fences, mailboxes, trees; inside, a living room, a bedroom and a kitchen;
  - BRICK CITY: brick apartments with balconies, bunting, a factory with smokestacks, a water tower and an alley;
  - shared interiors: a shop and a big hall;
  - the kit's own sets as library places: the classroom, hallway, plane cabin, cockpit, plane in the sky and the moon.
- The pipeline pastes it above the director's header. The DRESS covers:
  - time: day / sunset / night;
  - weather: rain / snow;
  - the landmark and its text, the shop signs and the billboard;
  - props: blimp, bunting, cars; background people.
  `zw_build(place, t0, t1, dress)` builds a place; `zw_spot(cam, place, "wide"|"street"|"close"|"skyline", t0, t1)` gives a TESTED camera spot.
- `worlds/stills.mjs` renders every place x spot plus the dressing demos (the kit's preview mode and contact sheets); `worlds/sheet.py` makes one sheet per world.
  - v1 → final: four rounds, 60 + 11 + 11 + 60 stills, about $0.10.
  - Fixed along the way: close-ups too tight; awnings, porch roofs and balconies below head height; the alley; the night light.
- The LOCATION LIBRARY is one list, `_shared/blockyWorlds/locations.js` (`worlds/locations.mjs` re-exports it). The director picks a place id per shot, and the plan check requires library ids.
- `pipeline.mjs --worlds` runs LIBRARY MODE:
  - ONE kit example plus the library docs in the instructions;
  - tighter output limits;
  - one fix round;
  - `--scene-plan` takes the owner's plan.
- WORLD PACK v2 (2026-11-14, stills $0.042 in 3 rounds, no image rebuild: worlds.py travels in the video tar):
  - LOOK: the camera sees a saturated blue gradient sky with instanced puffy clouds and far green hills; the scene is
    lit by a neutral, weaker sky (Light Path "Is Camera Ray" split in `zw_world`) and a warm 3-degree sun: no blue cast,
    deeper soft shadows; saturated pastels; brick / window grids on folded (x + y, z) coordinates (v1's bricks were
    vertical stripes on X-facing walls).
  - DENSITY: downtown (window displays, rooftop AC / tanks / antennas, 3 billboards, a back row of blocks, 24 glass
    towers, 12 cars, 24 people, hydrants / planters / bins, an enclosed plaza); suburb (18 houses with 1-2 storeys,
    garages, shutters, hedges, flowers, back tree rows, 10 people); brick city (lit windows, fire escapes, pipes, AC,
    flower boxes, posters, small shopfronts, puddles, a dressed alley); furnished living room / bedroom / kitchen; a
    shop with full shelves, gondolas, coolers, a snack wall and customers; a dressed moon (big Earth, flag, lander,
    rocks, craters, stars); a backdrop in the big hall. Every prop that repeats is an instanced source collection.
  - `worlds/stills.mjs --spots wide,close --times downtown_street,suburb_street --no-dress --jobs 1`; a free mock run
    (kit stubs with the real signatures + socket names, every place x dress, ray checks of every tested spot) caught
    the blocked spots before any render.
- DIRECTOR RULES (2026-11-14, `director.mjs`, tests in `director.test.mjs`): never the same camera spot twice in a row,
  the hero on screen in at least half the shots (plan check on the descs + the shot check on the bodies), giant props at
  most 40% of the frame (`SCREEN_SHARE_CAP`: prompt, checker, a lower-frame pixel suspect), no shot blocked by a wall (a
  literal camera inside a wall / building of a library place). `pipeline.mjs` runs `shotProblems` after the bodies and
  gives ONE writing fix before any GPU money.
- ASSET LIBRARY + WORLD PACK v3 (2026-11-14; plan, licence table and how to add a pack: `docs/blocky-worlds-assets.md`):
  - `assets/catalog.py` -> `assets/catalog.json` (1387 CC0 assets from 15 packs, sizes in our units, tags, licences)
    + `assets/previews/` (96 px, from the packs' own previews); the raw packs stay in reference/ (git-excluded).
  - `buildContext.mjs` copies the catalogued models + their textures; the Dockerfile's build-only stage runs
    `assets/build_assets.py` (import, scale, one collection per asset, pastel pass, packed textures) ->
    `/app/zyvo_assets/zyvo_assets.blend` (12.2 MB). Image `blender-kit-6` (sha256:070b337d...), endpoint re-pointed.
  - `worlds.py`: `za_load` / `zw_asset` / `zw_asset_fit` (one library read a shot, primitives when no library);
    people WALK / TALK / SIT / stand, cars DRIVE (never into a tested spot); close spots wider (lens 28, the world above
    the shoulders). `worlds/motion.mjs` renders 2 s clips (one `render` job) to show the motion.
- SCENE PLAN (owner-only), in `_shared/blockyWorlds/scenePlan.js`:
  - the API action `scenePlan` returns an automatic plan from the library words; `start` takes `scenePlan` and stores it in `run.card.scene_plan`;
  - the page's `ScenePlan.jsx` (on the script step) lets the owner change a scene's place: pick from the list, or type a place that maps to the closest one;
  - the worker passes the plan to the pipeline in library mode.

## The Milo lessons (2026-11-15, free; `director.mjs` MILO_RULES + checks, tests in `milo.test.mjs`)
Eleven permanent director rules from the owner's review of "Every Laugh, I Grow" (collision, sidewalks, grounding,
introducing named characters, vehicles push cars aside, landmarks readable from every angle, the gap close shot,
important people never tiny, at most 2 near-identical shots in a row, no tree blobs, the last line literal). Checks:
- plan (`storyPlanProblems`, with `planLines`): a named character's first line shows them (not a hand), a tiny-gap line
  gets a close "gap" shot, nothing "through the cars / crowd", an emotional beat never "tiny", 3 near-identical planned
  shots, the last shot's desc carries the last line's key words;
- bodies (`miloShotProblems` inside `shotProblems`): background walkers in a street lane (literal or ZW_INFO-relative
  coordinates; the hero is exempt), a walk path through a standing character, "on the roof / table / shelf" without
  `zw_ground`, 3 near-identical shots (same place, camera kind and action);
- checker: every rule that only shows on the frames (people in the street, floating, through, tiny, tree blob,
  unreadable landmark).
Why the lane guard missed in Milo: it only guarded the world's own background people (`zw_people`). The street crowds
came from the action library's `zx_crowd` (x across +-9 = the whole street) and from the director's own walkers
offset from `ZW_INFO['sidewalk_west']` (-8.0, 0.7 from the lane: -8 + 1 = -7 is in the street). Fixed: `zx_crowd` runs
on the sidewalks (`avoid=` parts it around the hero; `street=True` only when the line says so), the sidewalk marks
sit in the sidewalks' middle (+-9.5 downtown, +-9 brick), and the body check reads those offsets. New helpers in
`worlds.py`: `zw_top`, `zw_ground` (feet on a surface's measured top), `zw_knock` (a hit car slides and spins away).

## Upgrade round 1 (2026-11-21, owner): colour, night, monsters, faces (worlds.py + frameGate.mjs; not deployed)
Learned from the owner's downloaded kits (techniques and numbers only; their licences forbid reuse, nothing copied).
- COLOUR: the kit renders AgX + "AgX - Punchy" with per-shot exposure. The street places (downtown, suburb, brick) now
  render with the STANDARD view transform, look None, exposure 0 (set in the after-build hook, so a shot can't override
  it). Light set for Standard (`ZW_SKY_STD`): sun 2.6 at 40 degrees, sky light 0.5, two shadowless side fills 0.4, a
  deeper blue sky; bloom per time (day 0.1, night 0.35 at threshold 0.85). Interiors and the kit's sets keep AgX this
  round.
- NIGHT: a dark navy sky, moon 0.32, sky light 0.09; every street lamp is a real warm point light (1500 W, soft); shop
  sign letters glow; lit windows as before; a thin haze (a volume box, density 0.0028; a world volume would swallow the
  sky); each character near the camera gets a warm lamp/window spill and a cool moon rim (`zw_night_cast_light`).
  Character lights don't light the haze (`zw_novol`).
- MONSTERS: `zw_monster(name, loc, rot, size=2..4, style=horns|slime|ember|frost)`: a kit character scaled up in its
  own colours with glowing eyes (the only glow), brows, a mouth with teeth, horns, back spikes; `zw_monster_rim` gives
  it rim lights from behind + a soft key. `zw_monster_cam(cam, m, t0, t1, view="full"|"face")`: low camera, the whole
  outline (or head) inside the frame.
- FACES: `zw_frame(cam, chars, t0, t1, kind="close"|"two")` measures the head box (close: head ~27% of the frame,
  lens 34) or the hips-up boxes (two) and solves distance + aim so they sit in the safe area (u 0.06-0.94, v 0.05-0.64:
  above the captions at 62-76%); tries other sides when a wall blocks the view (5 sight lines).
- THE GATE (`zw_gate` in Blender -> `ZW_GATE|shot|name|kind|why` -> `frameGate.mjs` -> failing kind "framing" -> fix
  round): face_cut, face_under_captions, monster_wall (over 80% of the frame or 3+ edges crossed), monster_hidden
  (something between the lens and its head), and "every monster shown in full at least once" (monster_shown). Hint
  shots (director.mjs creatureTease) may stay partial.
- NEEDS AN IMAGE REBUILD: the gate lines come from Blender's stdout; `handler.py` now returns them as `output.gate`
  (the kit's render log keeps only "shot N ok"). worlds.py itself travels in the video tar (no rebuild for the look).
- GOLDEN LOOK STILLS: `golden/lookShots.mjs` (3 fixed stories x 3 shots, no AI call), `golden/lookGolden.mjs --variant
  before|after [--lib old worlds.py] [--gate-lib] [--reports-only]` (one preview job, ~$0.02-0.03; + free "report"
  shots that return the gate's numbers in their error text), `golden/lookCompare.py` (before | after sheet).
