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
