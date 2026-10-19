# Asset sources for the R1–R4 look frames

Every texture and the sky come from **Poly Haven**, under **CC0**: public domain, free for commercial use, no attribution required. Authors are listed below anyway. They were downloaded by `scripts/cutaway/proto3d/fetchAssets.mjs` through Poly Haven's public API. No account was needed and nothing was paid.

**No third-party 3D models were used.** Every shape is built in code: the ground, the strata, the bags, the truck, the house, the trees, the pipes, the tank, the worker, the flame, the stones and the roots. Nothing else needs a licence.

| Asset | Type | Author(s) | Used in | Link |
|---|---|---|---|---|
| excavated_soil_wall | texture (colour, normal, roughness) | Amal Kumar | R1, R2: deep soil and clay bands of the cut face | https://polyhaven.com/a/excavated_soil_wall |
| roots | texture | Dario Barresi, Dimitrios Savva | R1, R2: sod and roots band; R1 liner normal detail | https://polyhaven.com/a/roots |
| brown_mud_dry | texture | Rob Tuytel | R1, R2: topsoil band, soil covers | https://polyhaven.com/a/brown_mud_dry |
| gravel | texture | Dimitrios Savva | R1, R2: gravel band, drain layer | https://polyhaven.com/a/gravel |
| brown_mud_rocks_01 | texture | Rob Tuytel | R1, R2: the stony groundwater band (under the blue film) | https://polyhaven.com/a/brown_mud_rocks_01 |
| dark_rock | texture | Amal Kumar | R1, R2: bedrock; R1 stones, tree bark | https://polyhaven.com/a/dark_rock |
| leafy_grass | texture | Charlotte Baglioni | R1, R2: lawn detail (re-tinted green, mowing stripes in R1); leaf normal detail | https://polyhaven.com/a/leafy_grass |
| painted_plaster_wall | texture | Amal Kumar | R1, R2: house walls | https://polyhaven.com/a/painted_plaster_wall |
| roof_09 | texture | Rob Tuytel | R1: terracotta tile roof | https://polyhaven.com/a/roof_09 |
| grey_roof_01 | texture | Rob Tuytel | R2: shingle roof | https://polyhaven.com/a/grey_roof_01 |
| asphalt_02 | texture | Rob Tuytel | R1, R2: road | https://polyhaven.com/a/asphalt_02 |
| coast_sand_01 | texture | Rob Tuytel | R4: sand and foam soil of the model | https://polyhaven.com/a/coast_sand_01 |
| kloofendal_48d_partly_cloudy_puresky | HDRI sky | Greg Zaal, Jarod Guest | All four: image-based light; R1: the visible sky | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky |
| grass_path_2, beige_wall_001 | texture | Rob Tuytel; Dimitrios Savva, Rico Cilliers | Downloaded, not used | — |

R3's painted textures and R4's flock and foam grain are generated in code, so no source is needed.

For production (M2), the same ~12 textures would be bundled with the render worker (about 60 MB at 1–2k). Poly Haven's CC0 licence allows that.
