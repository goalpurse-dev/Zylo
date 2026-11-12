# Blocky Worlds: the locked look (scene code)

This is the scene the owner locked on 2026-11-03: a bus stop on a sunny suburban street, townsfolk waiting and a yellow bus pulling in. It is the starting point for the renderer milestone. The rules for the look are in `docs/blocky-worlds-protocol.md` §6; the reference frame is `reference/blocky-worlds/look-frames/LOCKED_bus_stop.jpg`.

The scene is rendered with three.js in headless Chrome on the GPU. It is free and runs locally.

```
node fetchPH.mjs ./ph                                   # Poly Haven CC0 models + HDRIs (~250 MB, kept out of git)
node shot.mjs <protoDir> <fontDir> <outDir> L,Ln        # L = the locked look, Ln = the same at night
```

- `<protoDir>`: a folder with `node_modules` holding three@0.169.0, puppeteer-core, n8ao and postprocessing. It also needs `assets/` with the Poly Haven textures and the Kenney kits from `scripts/cutaway/proto3d/fetchAssets.mjs` and `fetchKenney.mjs`.
- `<fontDir>`: `supabase/functions/_shared/fonts` (Lilita One).
- `?look=A|B|C` are the round-2 options, kept for reference.
- `EXTRA="&cam=x,y,z,tx,ty,tz"` moves the camera.
- `shot.mjs` prints the GPU time per frame.

## Asset sources

All are CC0: free for commercial use, with no attribution required.
- **Poly Haven:** asphalt_02, concrete_pavement, leafy_grass, painted_plaster_wall, brick_wall_02, beige_wall_001, roof_09, grey_roof_01; street_lamp_01, fire_hydrant, metal_trash_can, modular_street_seating, shrub_02, shrub_04, jacaranda_tree, planter_box_01; the HDRIs kloofendal_43d_clear_puresky and moonlit_golf. `fetchPH.mjs` writes `ph/SOURCES.json` with the authors.
- **Kenney:** Car Kit (sedan, suv, van, taxi) and City Kit Suburban (trees, and the houses of look C).
- **Built in code:** the people, faces, houses, bus, shelter, signs and posters.
