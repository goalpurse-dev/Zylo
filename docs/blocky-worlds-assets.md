# Blocky Worlds: the asset library (Blender kit engine)

Status 2026-11-14: 1387 CC0 assets from 15 packs, built into the RunPod image `blender-kit-6`
(`/app/zyvo_assets/zyvo_assets.blend`, 12.2 MB) and used by the world pack v3 (`scripts/blockyWorlds/blenderKit/worlds/worlds.py`).
Not deployed to the app; the Blender endpoint `sp338bavcw2gtn` points at the new image.

## 1. Licences (the owner's policy: CC0 / free for commercial use without credit or share-alike = use; CC-BY = needs credit, owner decides; GPL / CC-BY-SA = excluded; no licence text = excluded)

| Pack | Licence | Evidence | Decision |
|---|---|---|---|
| kenney_city-kit-commercial_2.1 | CC0 1.0 | `License.txt` (Kenney) | USE (41) |
| kenney_food-kit | CC0 1.0 | `License.txt` (Kenney) | USE (194) |
| kenney_fantasy-town-kit_2.0 | CC0 1.0 | `License.txt` (Kenney) | USE (167) |
| kenney_graveyard-kit_5.0 | CC0 1.0 | `License.txt` (Kenney) | USE (91) |
| kenney_tower-defense-kit | CC0 1.0 | `License.txt` (Kenney) | USE (160) |
| kenney_mini-characters_2.0 | CC0 1.0 | `License.txt` (Kenney) | USE, catalogue only (43): our characters are the kit's |
| kenney_blocky-characters_2.0 | CC0 1.0 | `License.txt` (Kenney) | USE, catalogue only (18) |
| 3D Road pack | CC0 1.0 | `License.txt` (Kenney 3D Road Tiles) | USE (302) |
| modularBuildings | CC0 1.0 | `License.txt` (Kenney 3D Modular buildings) | USE (101) |
| KayKit_City_Builder_Bits_1.0_FREE | CC0 1.0 | `License.txt` (Kay Lousberg) | USE (33; the `_withoutBase` copies skipped) |
| LandscapeAsset_v1 | CC0 1.0 | `license.txt` (eracoon) | USE (29) |
| racing_assets_v1_oga | CC0 1.0 | `license.txt` (eracoon) | USE (79; the "farara / lamba / parsche" names are invented, no logos) |
| vehicle_asset_v1 | CC0 1.0 | `license.txt` (eracoon) | USE (84) |
| multi stylized grass | CC0 1.0 | `readme.txt` (Nobiax) | USE (40; untextured after import, tint before use) |
| tiny weeds | CC0 1.0 | `readme.txt` (Nobiax) | USE (5; same) |
| chicken | CC0 | `license.txt` (Čestmír Dammer) | KEPT, NOT IMPORTED: .blend only (foreign .blend files are never opened by our build) + photo texture, not our look |
| forest-monster | CC0 | `Licenses.txt` (Čestmír Dammer) | KEPT, NOT IMPORTED: same |
| booksOGA_GPL.blend | GPL (file name), no CC0 dual licence found | none inside | EXCLUDED |
| Animals.zip (Fox.dae, ShibaInu.dae) | no licence text | none | EXCLUDED (owner 2026-11-14: skip) |
| CWU_player-spaceship.zip | no licence text | none | EXCLUDED (owner 2026-11-14: skip) |
| clouds1.zip (skybox bmp) | no licence text | none | EXCLUDED (owner 2026-11-14: skip) |
| modular_village_collection.zip | no licence text | none | EXCLUDED (owner 2026-11-14: skip) |
| pinetree0.png | no licence text | none | EXCLUDED (owner 2026-11-14: skip) |
| **V2 (owner added 2026-11-15; catalogued, the worlds NOT changed yet)** | | | |
| Downtown City MegaKit [Standard] | CC0 1.0 | `License_Standard.txt` (Quaternius) | USE (153; no per-asset previews in the pack) |
| Stylized Nature MegaKit [Standard] | CC0 1.0 | `License_Standard.txt` (Quaternius) | USE (68; no previews) |
| Ultimate House Interior Pack (June 2020) | CC0 1.0 | `License.txt` (Quaternius) | USE (123, OBJ; no previews) |
| Ultimate Nature Pack (Jun 2019) | CC0 1.0 | `License.txt` (Quaternius) | USE (150, OBJ; no previews) |
| Ultimate Space Kit (March 2023) | CC0 1.0 | `License.txt` (Quaternius) | USE (92; no previews) |
| kenney_building-kit | CC0 1.0 | `License.txt` (Kenney) | USE (79) |
| kenney_car-kit | CC0 1.0 | `License.txt` (Kenney) | USE (50) |
| kenney_city-kit-industrial_2.0 | CC0 1.0 | `License.txt` (Kenney) | USE (37) |
| kenney_city-kit-roads | CC0 1.0 | `License.txt` (Kenney) | USE (95) |
| kenney_city-kit-suburban_20 | CC0 1.0 | `License.txt` (Kenney) | USE (40) |
| kenney_cube-pets_1.0 | CC0 1.0 | `License.txt` (Kenney) | USE (24) |
| kenney_mini-shop_2.1 | CC0 1.0 | `License.txt` (Kenney) | USE (30) |
| kenney_pirate-kit | CC0 1.0 | `License.txt` (Kenney) | USE (72) |
| kenney_platformer-kit | CC0 1.0 | `License.txt` (Kenney) | USE (153) |
| kenney_retro-fantasy-kit | CC0 1.0 | `License.txt` (Kenney) | USE (105) |
| kenney_space-station-kit | CC0 1.0 | `License.txt` (Kenney) | USE (97) |
| kenney_train-kit | CC0 1.0 | `License.txt` (Kenney) | USE (103) |
| kenney_watercraft-pack | CC0 1.0 | `License.txt` (Kenney) | USE (46) |
| kenney_pattern-pack-extra, kenney_retro-textures-fantasy, kenney_skyboxes, kenney_ui-pack-space-expansion | CC0 1.0 | `License.txt` (Kenney) | KEPT, NOT IMPORTED: 2D textures / sky images / UI, not 3D models (skyboxes: a later sky option) |
| kenney_blocky-characters_20.zip, kenney_mini-characters.zip | CC0 1.0 | `License.txt` (Kenney) | SKIPPED: byte-identical to the packs already catalogued |
| Animals (Nov 15 zip), Blocks, Characters, Cube World (Aug 2023), Pixel Blocks | no licence text in the zips | none | EXCLUDED (unclear: they look like Quaternius packs; re-add with the licence file) |
V2 totals: 1517 new assets (2904 in all), 931 new previews (Kenney packs ship them; the Quaternius packs ship none).
Factors from one reference model per pack (door ~7, car ~12 long, chair seat ~2.4, pet ~2.6, our character 5.2).
No brand / logo / Roblox names found (the BRANDS filter in catalog.py runs on every name).

No CC-BY packs arrived. Real brands / logos: none found (a name filter in `catalog.py` also drops brand-like names).
Nothing from Roblox. The raw packs stay in `reference/blocky-worlds/assets-incoming/` (git-excluded); nothing from them is
committed and nothing in them is executed (zip / 7z extraction is path-checked; the build only imports glTF / GLB / OBJ).

## 2. The catalogue
`scripts/blockyWorlds/blenderKit/assets/catalog.json` (committed): per asset `id` (`<pack>_<name>`), `name`, `pack`,
`license`, `tags` (pack tags + words in the name: vehicle, building, street, prop, food, furniture, nature, rock,
spooky, road, character), `size` (x, y, z in OUR units), `file` (the source model inside the unpacked pack) and
`preview` (`assets/previews/<id>.jpg`, 96 px, from the pack's own preview image where the pack ships one: 714 of 1387;
the rest have none yet). `packs[]` holds each pack's licence, evidence, scale factor and intended use.

## 3. How the worlds use it
- Image build: `buildContext.mjs` copies exactly the catalogued model files and the textures / buffers they reference;
  a build-only Docker stage runs `assets/build_assets.py` in Blender: import, scale, one collection `za_<id>` per asset
  (origin = bottom centre, our units, size stored on the collection), the pastel pass, textures merged and packed, one
  compressed `.blend`. Only that file reaches the final image.
- Shot code: `worlds.py` `za_load(ids)` links the needed collections in ONE library read per shot
  (`D.libraries.load`, no `bpy.ops`, passes `shotcheck.py`); `zw_asset(id, loc, rot, scale)` instances one;
  `zw_asset_fit(id, loc, maxw, maxh)` scales it into a footprint (food on plates and shelves). With no library (an
  older image) every helper returns None and the worlds keep their primitive versions.
- World pack v3 uses: library buildings and a skyscraper in the downtown back row, traffic lights, cafe parasols,
  market stalls with fruit and a hand cart in the plaza, 12 library cars, library trees in the suburb, boxes / trash /
  a dumpster in the brick city and its alley, food on the kitchen counter and table, cookies on the living-room table,
  a soda on the bedroom desk, food packs on every shop shelf and fruit on the stand, big rocks on the moon.
- Motion: background people WALK (legs swinging, sliding along the sidewalk), TALK in pairs (mouths, nodding arms),
  SIT on benches and stand idling; cars DRIVE along their lane during the shot (never into a tested camera spot).

## 4. How the director picks props per scene
- The plan's `dress` keeps choosing the world; for a scene's own props the director asks the catalogue by tag and size
  ("food" + "kitchen" for a breakfast scene, "vehicle" for a car chase, "spooky" for a graveyard) and writes
  `zw_asset(id, ...)` / `zw_asset_fit(...)` calls in the shot body, the hero kept in frame (director rules: giant props
  at most 40% of the frame).
- Next step (not built yet): a short tag index of the catalogue (one line per tag: ids + sizes) in the director's
  world docs, and a check that every `zw_asset` id exists in `catalog.json` before any GPU money.

## 5. Recolouring to our pastel palette
- Build time: every material gets a Hue/Saturation node (saturation x1.12, value x1.06) between its colour source and
  the BSDF: textures and flat colours alike, so all packs sit closer to our saturated pastels.
- Choice: most packs ship colour variants (eracoon cars in 7-9 colours, Kenney buildings in several palettes); the
  worlds pick variants that fit the scene. Untextured packs (Nobiax grass / weeds) need a tint before use (an appended
  copy with a multiplied base colour: planned, not built).

## 6. Scaling to our characters
One pack = one factor (pack units -> ours, a character 5.2 tall), checked against reference objects: a car about 9-10
long, a door about 5, a shop storey about 5.5, an apple about 0.6. Factors: Kenney city 13, food 3, fantasy town 7,
graveyard 6, tower defense 6, road 6, modular buildings 9, KayKit 10, eracoon landscape 2.25 / racing 4.4 /
vehicles 4.8, Nobiax grass 0.04 / weeds 0.01, Kenney mini characters 7.2 / blocky characters 1.93. `zw_asset(..., scale)`
adjusts per use (e.g. fantasy-town trees at 0.55 in a yard).

## 7. Adding a pack later
1. Put the archive in `reference/blocky-worlds/assets-incoming/`; unpack it into `_unpacked/<name>/`
   (path-checked; nothing inside is run).
2. Find its licence (file, readme, or the stated source) and add a row to the table above (policy at the top).
3. Kept: add one `PACKS` entry in `assets/catalog.py` (folder, licence, evidence, model glob: glTF / GLB / OBJ only,
   factor, tags, use), run `python -P catalog.py <_unpacked dir>`, check the sizes it prints.
4. `node buildContext.mjs <ctx>` -> `fly deploy --build-only --push --image-label blender-kit-<n>` (free, remote
   builder; the build fails loudly if under 90% of the assets import) -> `setup.mjs --image <digest> --yes`.
5. Commit `catalog.py`, `catalog.json`, the new previews; never the pack.
