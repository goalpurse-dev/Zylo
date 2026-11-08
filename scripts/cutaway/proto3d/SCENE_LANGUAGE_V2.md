# Cutaway scene language v2: one handbook, one language, generated worlds

This is the owner's direction of 2026-11-08: the customer types a topic → the AI reads ONE master handbook → it writes the story, the narration and the scene in one scene language → the kit builds everything. When a key frame fails, the video repairs itself within a cap. Every passing world, part and layout is saved and reused.

Target: 35+/40 customer-ready on the scoreboard, then pre-build 50 topics for approval.

## 1. Principles
1. **One source of truth.** A registry module (`m2/language.js`) holds everything the kit can build: world blocks, part kinds, motions, effects, shots, labels, gauges, lights. For each it gives a one-line meaning, its fields with ranges, and a worked example. The handbook (the planner's system prompt) and the validator are both generated from it. If something is not in the registry, the AI is never told about it and the validator refuses it.
2. **No silent changes.**
   - Every check returns a named, fixable error to the AI. Example: `world.water[0].level: 12 is above the terrain top (8)`.
   - Rules the code applies today without saying so become either a handbook rule the AI follows, or an explicit note in the plan's trace that the AI sees on repair:
     - camera overrides (`director.js` pushToward, closeOn, mainFill, fitWhole)
     - cue-word rewrites
     - outline retargeting
     - car moves
   - The kit never drops a part quietly.
3. **Compose, don't pick.** The world is built from generators the AI combines: terrain, water, buildings, roads, models, light. The 7 settings become saved compositions (presets) the AI may start from.
4. **Compatible.** Today's world fields (`cut`, `house`, `backdrop`, `trees`, `road`) keep working. A v1 world converts to v2 blocks, so the 40 benchmark plans and the live premades still render the same.

## 2. The scene (one reply from the planner)
```
{ title, hero, story: {chain, surprises, ideas},
  sentences: [{role, text}],            // the narration, written WITH the scene (merged words step)
  world: { terrain: [...], water: [...], buildings: [...], roads: [...], light: {...}, preset? },
  parts: [...], beats: [...], audio: {cards, sfx} }
```
- `sentences` move into the plan reply, so the separate words call goes. The writing rules (length, cue words, chain) are checked by the same free checks as today. A failing check gets one repair round on the whole reply.
- Facts: the fact research and the fact check become **one** web-search call that returns verdicts with sources. The plan is then reworded for free where a claim changed. The current rule (searches >= claims) is stated in that call's prompt.

## 3. World generators (each block is a small JSON the AI writes)
All units are metres; y is up; the camera looks at the cut face z = 0 from +z.

### terrain
`{type, x0, x1, ...}` blocks, laid left to right over the island. Each block shapes the ground surface AND the section face. The face follows the surface profile, so a cliff or a gorge reads in section.
- `flat {y}`
- `hill {peak, height, width}`
- `cliff {at, top, bottom, face: "rock" | "earth"}`
- `gorge {x0, x1, depth, walls: "rock"}`
- `coast {at, sea: "left" | "right", beach}`
- `riverbed {x0, x1, depth}`
- `pit {x0, x1, z0, depth}`: today's cut. Several are allowed.
- `tunnel {y, r, x0, x1}`: a bore through the face.
- `mountain {peak, height, crater?, chamber?}`: volcano and mountain topics.

Strata, groundwater, rocks and roots are generated on whatever face results. Implementation: a 2-D profile along x drives the ground mesh (with a heightfield) and the face polygon; pits and tunnels are subtracted from the face.

### water
- `{body: "sea" | "river" | "lake" | "pool", x0, x1, level, flow?: [dx, dz], waves?, murky?, colour?}`
- Verbs: `rise`, `fall`, `flow`, `freeze`, `dirty`, `clear`, `flood`.
- Its section shows as a transparent band in the face down to the terrain under it, so a river in a gorge or the sea against a cliff reads.

### buildings
`{at [x, z], width, depth, floors: [{h, rooms?}], shafts: [{x, w, to}], roof: "flat" | "gable" | "dome" | "none", cutaway: "front" | "half" | "none", walls: colour, use: "house" | "mall" | "station" | "plant" | "factory" | "tower"}`

- Floors are open to the camera when cut away.
- Shafts (elevator, escalator well, stairwell, chimney) go through the floors.
- Rooms take furniture from the CC0 models.
- Covers the two-storey interior, power station halls, treatment works buildings, the lighthouse tower (a 1-room tall `tower`) and factories.
- The current room, kitchen, workshop, garage and carwash backdrops become presets of this generator.

### roads and paths
- `{points: [[x, z], ...], width, surface: "asphalt" | "gravel" | "rail" | "path" | "track", bridge?: {from, to, height, type: "beam" | "arch" | "suspension"}, lines: true}`
- Vehicles (car, truck, train, boat on water) get `drive {along: road id, from, to}`, `steer {angle}`, `brake`, `stuck`, `ride` (follow a surface's height), `sink`.
- Covers the road topic, bridges, rail, a car on a bridge deck, steering and braking.

### models (objects by keyword)
- `{kind: "model", keyword, at, size}`.
- The kit finds the best CC0 model (Kenney or Quaternius, `kit/modelCatalog.json`, 429 now, to be grown) by keyword and synonyms.
- When nothing fits: the mechanism kit (rig) builds it from primitives, and the handbook teaches how. Lighthouses, cooling towers, pylons and turbines are first saved as rig recipes.

### light and weather
- `{mood: "noon" | "storm" | "dusk" | "night" | "fire", time?: "06:00" … "22:00", changes: [{w: word, to: mood}], weather: "rain" | "snow" | "wind" | "ash" | "fog"}`
- Builds on m2/moods.js. Night stays night until a line changes it.

## 4. Parts, motions, effects, camera (the current kit, cleaned)
- **Parts:** the 58 kinds stay. Verbs come from `m2/verbs.js`; mechanisms from rig (26 shapes, 19 moves).
- **New moves:** melt, corrode, erode, twist, ride, sink, crack hide.
- **Effect fixes:**
  - Debris clears.
  - Beams glow (emissive, additive) and are invisible until lit.
  - Auto-effects skip words in the topic's name.
  - Drips and puddles have a colour.
- **Camera:** the planner's shots are honoured, and the kit only reports problems.
  - The size rules (subject fill, hook object, interior home view) become handbook rules with numbers. Example: "the part a line names fills 35-70% of the width; the closing shot frames the build, not the room".
  - The director keeps only safety (nothing behind walls, never cut off the main part).
- **Labels and gauges:** counter, state label, number card. A time label ("Day 0 → Year 10") is added for the never-cleaned premade.

## 5. Self-repair (in production)
- When the real checker fails the hook or name line (or a mechanism line), its own words go to ONE targeted repair of that beat only. Example: "the fan is tiny" → the beat's shot or part size.
- Only that line is re-checked; every other line's verdict is cached by frame hash.
- Up to 2 rounds, capped at $0.25 per video, before the video fails and is refunded.

## 6. Save and reuse
- Every plan that passes the gate is saved with its topic words, world blocks and part recipes. Existing pieces: `cutaway_layouts`, `cutaway_parts_library`.
- A new topic close to a saved one starts from it: the world and parts are reused, and only the story is new.
- Each composed world is saved under a name: "coast with cliff", "two-storey station".

## 7. Test cases (the generators must handle all of these, free)
coast + lighthouse · gorge + suspension bridge · river + dam · river + tunnel under it · two-storey interior + escalator + elevator shaft · power station (reactor, turbine, cooling tower) · power lines to a house · treatment works · volcano (mountain, crater, chamber, lava) · road with cars that steer and brake · underwater + submarine · the 40 benchmark topics (customer-ready on the real checker, cached per line).

## 7b. As built (2026-11-08)
- **Generators are part kinds, not `world.*` blocks.** The camera, verbs, validator and handbook all work on parts, so a mountain can be framed, a river can rise, a bridge can twist. The kinds:
  - `terrain` (kit/terrain.js): blocks flat, hill, mountain (crater, chamber, vent), cliff, gorge, coast, riverbed, pit, tunnel; trees.
  - `waterBody` (kit/water.js): sea, river, lake, pool.
  - `building` (kit/buildings.js): floors and shafts (elevator, escalator, stairs, chimney).
  - `road` (kit/roads.js): asphalt, gravel, rail, path; bridges beam, arch, suspension.
  - `wires` (kit/wires.js): power lines.
  - `model` (m2/recipes.js): expanded into a `rig` by the plan, a recipe first, then a CC0 model.
- A layout with a terrain part swaps the yard's ground for it. Every other layout renders as before (v1 compatibility).
- Cars: road/terrain riding, brake, steer, stuck.
- Effects: beam glow, topic-name words, blast debris clears, colours, smoke contrast.
- Test cases with free stills checked: `m3/testcases/` volcano, coast, river_tunnel, gorge, station, bridge, power.
- Not yet:
  - test cases: treatment works, underwater + submarine, river + dam, road with steering;
  - snow and fog;
  - furniture in rooms;
  - saving composed worlds by name (phase 3).

## 8. Phases (about 11 days of work)
1. **Registry, handbook, validator, merged plan and fact calls** (2.5 days). Proven on the 22 stand-in topics: the planner replays their answers, so this is free.
2. **Generators** (6-7 days): terrain → water → buildings → roads and vehicles → models by keyword → light. Each is proven on its test cases with free stills, then the crash sweep.
3. **Self-repair, save and reuse** (1.5 days).
4. **Pre-build pipeline and an approval list on /admin/ops** (1 day). Run on 50 topics first.

Checkpoints: after phase 2, one crash sweep and one real re-check of changed lines (about $1). Real runs only for categories at 80% or more customer-ready, asked first.

## 9. Cost (owner-approved cheaper start)
| Item | Cost |
|---|---|
| Re-checks during the build | $2-3 |
| Pre-build of 50 topics on the real checker | about $2 |
| Real category runs (only categories at 80%+, asked first) | up to $1.20 each |
| Budget left on 2026-11-08 | $4.64 |
| Extra needed | about $7 |
