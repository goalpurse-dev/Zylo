# Blocky Worlds video engine: the MVP contract

> **PERMANENT RULE (owner, 2026-11-04): the scene always matches the narration.** Every line's key nouns, actions and
> subject (who/what it is about) are visible in its shot. `checkVisuals` + `checkSubjects` (plan.mjs) enforce it before
> any render and must never be weakened or bypassed. Missing things get added to the kit or shown by a clear fallback
> (a picture card of that thing), never a random shot. Full text: `docs/blocky-worlds-protocol.md` (top).

One complete 90 s video, end to end: script + word timings -> **timeline** -> three.js frames in headless Chrome -> mp4
with one-word captions, voice and a music bed. Free to run locally. The same code later runs on a RunPod GPU in
parallel chunks.

Everything lives in `scripts/blockyWorlds/engine/`. Run from that folder. Its `package.json` has three@0.169.0,
n8ao, postprocessing, puppeteer-core (already installed in `node_modules`). Assets (gitignored, already copied):
- `assets/kenney/<kit>/<name>.glb`: Kenney CC0 kits `car, commercial, factory, furniture, roads, suburban, survival`
- `assets/<texture>/...`: Poly Haven CC0 textures (asphalt_02, concrete_pavement, leafy_grass, painted_plaster_wall,
  brick_wall_02, beige_wall_001, roof_09, grey_roof_01, laminate_floor_02, interior_tiles, gravel, brown_mud_dry,
  coast_sand_01, dark_rock, roots, grass_path_2...) and `assets/hdri/`
- `assets/ph/<model>/<model>.gltf`: Poly Haven CC0 models (street_lamp_01, fire_hydrant, metal_trash_can,
  modular_street_seating, shrub_02, shrub_04, jacaranda_tree, planter_box_01) and `assets/ph/hdri/*.hdr`
- `assets/LilitaOne-Regular.ttf`: the caption font

The **locked look** is `scripts/blockyWorlds/look/scene.js` (read it first): A's realistic CC0 world, B's clothing
(procedural fabric: stripes, plaid, dots, belts, soles, collars), simple faces drawn bigger, elbows and knees, the punchy
grade (N8AO + UnrealBloom + the sat/contrast/warm ShaderPass), ACES tone mapping. Reference frame:
`reference/blocky-worlds/look-frames/LOCKED_bus_stop.jpg`. Everything new must look like it belongs in that frame.
Never anything from Roblox: no logos, names, UI, or its actual characters.

## Frame rules
- 1080 x 1920 (9:16), **24 fps**. Units: metres; y is up; people are about 1.6-1.8 m (kids ~1.2 m).
- Deterministic: a frame depends only on (timeline, t). No `Math.random()` without a seed, no wall clock.
  Use `rng(seed)` from `engine/lib/rng.js`.
- Browser ES modules, import map as in `look/look.html`: `three`, `three/addons/`, `postprocessing`, `n8ao`.

## The timeline (JSON) — produced by `plan.mjs`, consumed by `page/engine.js`
```jsonc
{
  "version": 1, "fps": 24, "width": 1080, "height": 1920,
  "duration": 94.6,                       // seconds (= voice length + 0.4 s tail)
  "title": "The Listener",
  "cast": {                               // every character that appears; specs for kit/people.js makePerson()
    "me":   { "role": "kid", "name": "Pip", "seed": 3 },          // seed -> clothes/hair/skin, deterministic
    "mom":  { "role": "adult", "name": "Mom", "seed": 8 },
    "dobbs":{ "role": "adult", "name": "Mr. Dobbs", "seed": 21 }
  },
  "monster": { "type": "tall", "name": "The Listener", "glow": "#9be8ff" } ,   // or null; type "tall" | "furry"
  "shots": [{
    "start": 0.00, "end": 2.35,           // seconds; shots tile the whole duration, hard cuts
    "line": 0, "part": "rule",            // script line index and part id
    "set": "street",                      // "street" | "bedroom" | "school" | "woods"
    "light": "day",                       // "day" | "night" | "warm"
    "camera": "wide",                     // "wide" | "medium" | "closeup" | "low" | "over_shoulder" | "insert"
    "focus": "me",                        // what the camera frames: a cast id, "monster", "insert", or "group"
    "actors": [{ "id": "me", "spot": "center", "pose": "stand", "expr": "happy", "facing": "camera",
                 "hold": null }],         // hold: a prop name in the hand(s) for pose "carry" / "point", e.g. "sock"
    "monsterState": null,                 // null | { "spot": "far", "state": "lurk" | "reach" | "reveal" | "flee" }
    "insert": null,                       // null | { "kind": "sign" | "note", "text": "NO TALKING ABOVE A WHISPER" }
    "marker": null,                       // null | { "on": "me" | "all" | <cast id>, "kind": "tag" | "ring" | "icon", "text": "1¢" }
    "seed": 17                            // per-shot variety (camera drift direction, extra townsfolk)
  }],
  "captions": [{ "word": "whisper,", "start": 1.20, "end": 1.45 }],   // every spoken word, in order
  "audio": { "voice": "voice.wav", "music": "music.wav" }
}
```
- `spot` names every set provides: `"center"`, `"left"`, `"right"`, `"back"` (behind the group), `"far"` (deep
  background, where a monster lurks), `"door"` (an entrance). Kept on the set's floor, in camera-friendly places.
- `facing`: `"camera"`, `"left"`, `"right"`, `"away"`, `"monster"`, or a cast id.
- poses (`kit/people.js POSES`): `stand, walk, run, point, scared, sit, carry, wave, look_up, talk, sleep, cheer`.
  walk/run/talk/wave/cheer are cycles driven by t.
- expressions (face stickers, `kit/people.js EXPRS`): `neutral, happy, sad, scared, surprised, angry, sleepy, smirk,
  cry, excited, shush`.

## Module APIs (browser side, `page/`)
All modules take `THREE` from `import * as THREE from "three"`. Asset URLs are absolute paths on the page server:
`/assets/...`.

### `page/kit/people.js` (owner: KIT agent)
```js
export const POSES, EXPRS;
export function makePerson(spec /* cast entry + {id} */) -> THREE.Group   // origin at the feet, faces +z
export function posePerson(person, pose, t /* shot-local seconds */, opts = { hold: null }) // sets joint rotations; cycles from t
export function setFace(person, expr)                                    // swaps the face sticker (cached textures)
export function personHeight(person) -> number
```
### `page/kit/monsters.js` (owner: KIT agent)
```js
export function makeMonster(spec /* timeline.monster */) -> THREE.Group  // "tall": ~4.5 m thin, long limbs, glowing feature (eyes / ear / lamp head) in spec.glow; "furry": ~2.6 m wide, shaggy (layered blocky fur), glowing eyes
export function animateMonster(monster, state /* lurk|reach|reveal|flee */, t)
```
### `page/kit/props.js` (owner: KIT agent)
```js
export function makeInsert({ kind, text }) -> THREE.Group      // a sign board / handwritten note in the look, text drawn on a canvas texture, sized ~1.2 x 0.8 m, for camera "insert"
export function makeMarker({ kind, text }) -> THREE.Object3D    // floats above a head: "tag" (price-tag card), "ring" (glowing halo ring), "icon" (round badge with text/emoji); billboard-facing via userData.billboard = true
export function makeHeld(name) -> THREE.Object3D | null         // small hand props by keyword: sock, flashlight, candle, book, phone, bag, key, ball, box, sign, bread...; unknown -> a simple box
```
### `page/sets/index.js` (owner: SETS agent)
```js
export const SETS = ["street", "bedroom", "school", "woods"];
export async function buildSet(name, ctx /* { THREE, scene, renderer, gltf(url), tex(name, kind, srgb) } */)
  -> { root: THREE.Group, spots: { center, left, right, back, far, door } /* THREE.Vector3 on the floor */, indoor: bool,
       update?(t) }
export function applyLight(name /* day|night|warm */, ctx /* { THREE, scene, renderer, set } */) -> { dispose() }
   // sky/background, hemisphere + sun/moon, shadows, fog, exposure, and the set's own practical lights at night
   // (street lamps, a bedside lamp, hallway lights). day = the locked look; night = blue moonlight + warm practicals;
   // warm = golden-hour ending.
```
### `page/camera.js` (owner: SETS agent)
```js
export function frameShot(type /* wide|medium|closeup|low|over_shoulder|insert */, ctx /* { THREE, camera, set, focus: Vector3 (feet of the subject), focusHeight, other?: Vector3, t, dur, seed } */)
   // positions/aims the PerspectiveCamera; a slow, subtle move over the shot (push-in or drift, by seed), never a jump inside a shot
```
### `page/captions.js` (owner: AUDIO agent)
```js
export function drawCaption(ctx2d /* 1080x1920 2D canvas context */, captions, t)   // the one word spoken at t, Lilita One ("BWCaption" font-face), white with a thick dark stroke, pop-in scale over the first 80 ms, at ~62% height, never wider than 90% of the frame
```
### `page/engine.js` + `page/index.html` (owner: RENDER agent)
Loads the timeline (`?tl=<url>`), builds/caches sets and cast, `window.ready = true` when every asset is loaded,
`window.renderAt(t)` renders the frame at time t into the visible canvas (3D through the look's post chain, then the
caption composited on top), `window.frameData()` returns that frame as a JPEG data URL.

## Node side
- `plan.mjs` (owner: PLANNER agent): `planVideo({ script, words, idea, lengthSec }) -> timeline` (no AI call: a
  rule-based shot planner for the MVP; deterministic).
- `voice/free.mjs` (owner: AUDIO agent): Windows SAPI voice -> `voice.wav` + word timings `[{ word, start, end }]`.
- `audio/music.mjs`, `audio/mix.mjs` (owner: AUDIO agent): a procedural music bed (our own, synthesized, no samples),
  and the final mix (voice + bed ducked under the voice, a soft hit on big cuts) to `mix.m4a`.
- `render.mjs` (owner: RENDER agent): render a frame range of a timeline to an mp4 chunk; `renderParallel` splits
  across N Chrome pages/processes and joins the chunks (stream copy); the page server serves `page/`, `assets/`,
  `node_modules/`.
- `make.mjs` (owner: RENDER agent, integration by the lead): script -> voice -> plan -> render -> mix -> mux ->
  `out/<name>/final.mp4`.
- `runpod/` (owner: RENDER agent): Dockerfile, handler, build-context and dispatch scripts mirroring
  `scripts/cutaway/proto3d/m3/` (prepared only: nothing is built, pushed or deployed).

## Ground rules for every agent
- **No paid calls of any kind** (no Anthropic, ElevenLabs, Runware, RunPod, Fly). No deploys, no pushes, no commits.
- **Never start a Vite / npm dev server** (the owner's runs on 5173). Your own tiny `http.createServer` on port 0 for
  headless Chrome previews is fine. Chrome: `C:/Program Files/Google/Chrome/Application/chrome.exe`, flags
  `--use-angle=default --enable-webgl --ignore-gpu-blocklist`. ffmpeg is on PATH.
- Only create/edit files you own (listed above) plus your own `dev/<yourname>*.mjs` preview scripts and
  `engine/lib/*` helpers you add (namespaced, e.g. `lib/kitUtil.js`). Do not edit `look/`, `supabase/`, `src/`.
- Write files with the Write/Edit tools (bash heredocs mangle backslashes on this laptop).
- Check your work visually: render stills to `out/dev/<yourname>/` and look at them.

## Addendum 2026-11-04: every spoken noun gets a visual

Owner's rule (from the references): every line's key nouns and actions must be visible in its shot. Never a random
unrelated shot; when the kit lacks something, a simple version of it, or the closest clear visual (a picture card).

### New timeline fields (all optional, per shot)
```jsonc
"objects": [{ "name": "ice_cream_truck", "spot": "center", "state": "mime", "facing": "camera" }],
   // scene objects from page/kit/objects.js OBJECTS (catalog below), placed on the set's floor at a spot
"focus": "object",                  // new focus value: the camera frames objects[0]
"insert": { "kind": "card", "text": "GRANDPA'S STORIES", "icon": "📖" },   // new insert kind: a picture card
"setState": { "windows": "dark" | "lit" | "open" },                         // street houses' windows
"visuals": ["football team", "cheer"]   // what the planner meant to show (for the check + the report); ignored by the engine
```
New poses: `yell` (scream: arms down and back, leaning forward, mouth wide), `sneeze` (head snaps forward, hand to
face), `blow` (a held whistle/horn at the mouth). New expressions: `yell` (mouth wide open, eyes squeezed), `sneeze`.
New cast field: `"role": "baby"` (a baby: ~0.6 m, sits/lies, round head; carried by an adult with pose carry + hold = the
baby's cast id, which the engine resolves to the baby person in the arms).

### `page/kit/objects.js` (owner: OBJECTS agent)
```js
export const OBJECTS;   // { name: { aliases: [...], height, width, place: "floor" | "street" | "wall" } }
export function makeObject(name, opts = { state }) -> THREE.Group  // origin on the floor at its front-centre, faces +z; userData.height, userData.width, userData.focus (Vector3, local)
export function animateObject(obj, state, t)                       // optional per-frame (flashing alarm lights, balloons bob, the mime's arms)
```
Catalog (MVP, simple blocky versions in the look): `ice_cream_truck` (state "mime": a mime driver at the window: white
face, striped shirt, beret, miming hands), `football_field` (goal posts, painted lines, players in jerseys, small
bleachers with a seated crowd covering mouths), `birthday_party` (table, cake with candles, balloons, party hats,
presents), `bakery` (shop front with a "BAKERY" sign, bread in the window; state "for_sale": a FOR SALE sign in the
window), `car` (state "alarm": flashing orange/red lights + sound lines), `photo_set` (a camera on a tripod + a school
photo backdrop), `crib` (a baby crib), `house_front` (a house facade with windows that can be dark/lit/open, people
leaning out when open), `stories_book` (a big open storybook on a stand), plus anything else the planner's line
review needs. Hand props added to `makeHeld`: `whistle` (brass), `baby` (handled by the engine via cast).

## Addendum 2026-11-04 (b): the coverage kit (130 library ideas)

One catalog for both sides: `lib/catalog.js` (pure data). `THINGS` (weather, town, country, home, underground scene
objects), `ANIMALS` (one object per species), `CREATURE_OBJECTS` (`<kind>_creature`: a small monster look), `item` (any
hand prop, big, on a crate: state = the prop kind), `HELD` (hand props by word), `CREATURES` (monster looks).
- `page/kit/things.js` builds every THINGS / ANIMALS / creature / item name; `page/kit/objects.js` merges them into
  `OBJECTS` (`makeObject` works the same). `page/kit/heldMore.js` builds the HELD props; `makeHeld` checks them first.
- Timeline `monster` may carry `variant` (`dragon, bird, serpent, squid, fish, goblin, stump, giant, scarecrow, beast,
  boxy, yeti, troll, ghost, mannequin`) and `species` (the very creature: "goat", "moose", "pigeon"...). `makeMonster`
  dresses the tall / furry rig (or builds a rig with the same joints), so `animateMonster` drives every look.
- Checks: `dev/coverage.mjs` (all 130 ideas as stand-in scripts -> `out/coverage/report.md`), `dev/coverage.test.mjs`,
  `dev/coverageKit.mjs` (headless Chrome: every name the planner can emit builds), `dev/coverageRender.mjs` (contact
  sheets in `out/coverage/sheets/`).

## Addendum 2026-11-05: built on demand (a missing kit object or world never fails a run)

Owner's rule: customers type endless topics, so the engine builds what a line needs in real time, from blocks.
Order for every need: **1. the kit -> 2. the shared library (things built for earlier videos) -> 3. an AI design** (a
block blueprint for an object, a world spec for a place) that the engine builds, **4. a quick still + an AI vision
check** (pass = ok and confidence >= 0.6; up to 2 retries with the vision's fix), **5. last resort: a clear picture
card** of that very thing. Never a failed run, never an unrelated shot. Everything built is saved to the library. The
PERMANENT RULE still holds: built things count as covering a noun only through their names / aliases, every change is
re-checked (checkTimeline + checkVisuals + checkSubjects) and undone if it adds a problem, and the checks run again
before any render.

### Files
| File | What |
|---|---|
| `lib/builder/spec.js` | the two schemas + `validateBlueprint` / `validateWorld` (pure; never throw; limits, clamps, colours) + `normName` |
| `page/kit/blueprint.js` | `buildBlueprint(bp) -> Group` (origin at the front-centre floor, faces +z, kit userData), `animateBlueprint(obj, t, state)` |
| `page/sets/worldspec.js` | `buildWorld(spec, ctx)` -> the buildSet shape (`root, spots, indoor, camDir, views, bounds, rig, update(t), problems`) |
| `page/still.html` + `still.js`, `lib/builder/still.mjs` | the check still: one object (768 x 768, 3/4 view on pavement) or one world (432 x 768, the engine's wide shot with a kid) |
| `lib/builder/design.js` | the style guide, 3 hand-written kit blueprints as few-shot, prompts + json_schemas, `callClaude` (llm.js's pattern), `anthropicProvider`, PRICE / worst cases |
| `lib/builder/vision.js` | the vision check (image + line -> `{ ok, confidence, reads_as, fix }`) |
| `lib/builder/cache.js` | the library: `memoryCache`, `fileCache`, `snapshotCache` (the worker), `supabaseCache` (server) |
| `lib/builder/resolve.js` | `resolveNeeds`: kit -> library -> design -> still -> vision -> retry <= 2 -> save, else card; parallel; money / time / design caps |
| `lib/builder/apply.js` | `needsFromTimeline`, `applyResolved` (built things into the timeline, each re-checked) |
| `lib/builder/index.js` | `makeBuilder` (prefetch + buildFor), `providerFromConfig` ("off" default, "mock", "anthropic") |
| `lib/builder/mock.js` | the free mock designer + vision (robot dentist, ladder, giant heart, inside a giant turtle; a labelled crate otherwise) |
| `supabase/migrations/20261203100000_blocky_worlds_assets.sql` | the library table (NOT applied) |
| `dev/builder.test.mjs`, `dev/builderRender.test.mjs`, `dev/builderDemo.mjs`, `dev/builderEstimate.mjs` | tests, the demo, the cost + wait estimate |

### Blueprint (an object)
```jsonc
{ "name": "robot dentist", "aliases": ["dentist robot"], "height": 2.1,  // m; the build is scaled to it (max 40; 200 with "giant": true)
  "width": 1.2,                                                          // m (a hint)
  "parts": [{                                                            // <= 120
    "id": "arm_r", "shape": "box | roundedBox | cylinder | cone | sphere | wedge | torus",
    "size": [x, y, z], "pos": [x, y, z], "rot": [x, y, z],              // metres, ONE shared frame (y up, +z front); degrees
    "color": "#rrggbb", "material": "matte | plastic | metal | glass | glow | fabric | wood | stone",
    "pattern": "none | stripes | dots | plaid",                          // fabric only (the people kit's procedural fabric)
    "parent": "body",                                                    // moves with that part ("" none)
    "pivot": [x, y, z] }],                                               // hinge for swing / open ([] none)
  "labels": [{ "part": "badge", "text": "DENTIST", "color": "#fff", "bg": "", "face": "front | back | left | right | top" }],
  "anims": [{ "part": "arm_r", "kind": "bob | spin | swing | blink | wobble | open", "axis": "x|y|z", "amount": 12, "speed": 1.2 }],
  "focus": [x, y, z], "footprint": [w, d] }
```
cylinder / cone / sphere: diameter = size x (z), height = size y. wedge: a ramp, tall at the back. torus: a ring in x-y,
outer diameter size x, tube size z. Labels use the Lilita font. Unknown fields are ignored; a bad part gets defaults;
parts beyond the limits, unknown parents and cycles are dropped (listed in `userData.problems`). To the engine a built
object is an ordinary kit object (userData height / width / depth / focus / detail / frameH / push / big).

### World spec (a place)
```jsonc
{ "name": "inside a giant turtle", "aliases": [], "kind": "outdoor | indoor | enclosure | creature_world",
  "ground": { "material": "grass|dirt|sand|rock|snow|tiles|wood|flesh|metal|water|moon|gravel", "color": "#..", "shape": "flat|hilly|rocky|wet" },
  "enclosure": { "type": "sky | cave | room | inside_creature | underwater | space", "color": "#..", "color2": "#..",
                 "pattern": "none|ribs|scales|flesh|rock|panels|bricks|planks", "opening": "none|mouth|hole|window|door", "glow": "#.." },
  "palette": ["#.."], "fog": { "color": "#..", "density": 0.35 }, "particles": "none|dust|bubbles|snow|spores",
  "light": { "base": "day|night|warm", "tint": "#..", "ambient": 1.1, "practicals": [{ "color": "#..", "pos": [x, y, z], "intensity": 10 }] },
  "landmark": "<blueprint>",                                             // big, behind the group, off-centre
  "props": [{ "kit": "lamp | (empty)", "blueprint": "<blueprint>", "spot": "side_left|side_right|back_left|back_right|far|scatter", "count": 1 }],
  // EPIC hooks (validated + passed through; built only by the EPIC agent's page/sets/creatureWorld.js):
  "creature": { "species": "turtle", "scale": 60, "city": "on | inside" },                 // scale <= 200 m
  "giants": [{ "kind": "giant", "blueprint": "<blueprint, giant: true>", "height": 120, "spot": "far" }],
  "crowds": [{ "kind": "knights", "count": 400, "formation": "scatter|line|block|ring|march", "action": "stand|cheer|march|run|flee|fight|wave", "spot": "far" }] }
```
Every world shares one layout: the camera at +z looking down -z, the group at the centre spot, the enclosure closing in
around a ~13 m corridor, spots `center left right back far door` (door = the opening). Light: the shot's day / night /
warm through lighting.js applyLight with the spec's rig (fog, hemisphere tint, sun scale, practicals).
`kind: "creature_world"` goes to `ctx.buildCreatureWorld(spec, ctx)` when the engine passes one (the EPIC builder);
otherwise it is built as `inside_creature`.

### Timeline fields
```jsonc
"assets": { "<id>": { "kind": "object", "name": "kazoo", "aliases": [], "blueprint": {} },
            "<id>": { "kind": "world", "name": "inside a giant turtle", "aliases": [], "spec": {} } },
"shots": [{ "set": "world:<id>", "worldBase": "street", "worldAliases": ["inside a giant turtle"],   // a built world
            "objects": [{ "name": "kazoo", "asset": "<id>", "aliases": [], "spot": "right" }] }]  // a built object
```
`worldBase` is the set the world replaced: place words that set covered ("the whole town") stay covered. The planner
marks needs before the builder runs (`timeline.needs`, a card's `need`, a shot's `world`); apply.js removes the markers.

### Models, money, time
Design: Claude Sonnet 5.5 (effort low). Vision: Claude Sonnet 5.5 (effort low); Haiku 5.5 is the alternative for the
vision check if the paid demo's side-by-side (`--compare-vision`) agrees with Sonnet. Per-video caps (resolve.js
DEFAULT_BUDGET): $0.60, 120 s, 6 new designs; a call starts only when its worst case fits under the money cap.
Estimates: `node dev/builderEstimate.mjs`. The worker's provider is "off" (kit + library + cards) unless the job says
`builder.provider: "anthropic"` and the worker has `ANTHROPIC_KEY`.
