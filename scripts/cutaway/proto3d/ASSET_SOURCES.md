# Asset sources for the Cutaway renders

Every asset below is **CC0** (Creative Commons Zero): public domain, free for commercial use, no attribution required. Authors are listed anyway. Nothing was paid and no account was needed.

- **Textures and the sky** come from **Poly Haven**, downloaded through its public API by `scripts/cutaway/proto3d/fetchAssets.mjs`.
- **3D models** (cars, city buildings, street trees, traffic cones) come from **Kenney** (kenney.nl), downloaded by `scripts/cutaway/proto3d/fetchKenney.mjs`. That script refuses any kit whose `License.txt` is not CC0 and keeps each kit's licence file beside its models.

Everything else is built in code: the ground, the strata, the house of the yard world, the pipes, the tanks, the machines, the props, the signs and the bay tiles. Those need no licence.

## Textures (Poly Haven)

| Asset | Type | Author(s) | Used in | Link |
|---|---|---|---|---|
| excavated_soil_wall | texture (colour, normal, roughness) | Amal Kumar | R1, R2: deep soil and clay bands of the cut face | https://polyhaven.com/a/excavated_soil_wall |
| roots | texture | Dario Barresi, Dimitrios Savva | R1, R2: sod and roots band; R1 liner normal detail | https://polyhaven.com/a/roots |
| brown_mud_dry | texture | Rob Tuytel | R1, R2: topsoil band, soil covers | https://polyhaven.com/a/brown_mud_dry |
| gravel | texture | Dimitrios Savva | R1, R2: gravel band, drain layer | https://polyhaven.com/a/gravel |
| brown_mud_rocks_01 | texture | Rob Tuytel | R1, R2: the stony groundwater band (under the blue film) | https://polyhaven.com/a/brown_mud_rocks_01 |
| dark_rock | texture | Amal Kumar | R1, R2: bedrock; R1 stones, tree bark | https://polyhaven.com/a/dark_rock |
| leafy_grass | texture | Charlotte Baglioni | R1, R2: lawn detail (re-tinted green, mowing stripes in R1); leaf normal detail | https://polyhaven.com/a/leafy_grass |
| painted_plaster_wall | texture | Amal Kumar | R1, R2: house walls; the settings' plaster walls | https://polyhaven.com/a/painted_plaster_wall |
| roof_09 | texture | Rob Tuytel | R1: terracotta tile roof; the garage roof | https://polyhaven.com/a/roof_09 |
| grey_roof_01 | texture | Rob Tuytel | R2: shingle roof | https://polyhaven.com/a/grey_roof_01 |
| asphalt_02 | texture | Rob Tuytel | R1, R2: road; the city street | https://polyhaven.com/a/asphalt_02 |
| coast_sand_01 | texture | Rob Tuytel | R4: sand and foam soil of the model | https://polyhaven.com/a/coast_sand_01 |
| garage_floor | texture | Jenelle van Heerden | the car wash bay floor, the garage driveway | https://polyhaven.com/a/garage_floor |
| concrete_pavement | texture | Charlotte Baglioni | the street's sidewalk, the city sidewalk | https://polyhaven.com/a/concrete_pavement |
| brick_wall_02 | texture | Dimitrios Savva | the street's corner shop | https://polyhaven.com/a/brick_wall_02 |
| laminate_floor_02 | texture | Dario Barresi, Charlotte Baglioni | the room's floor | https://polyhaven.com/a/laminate_floor_02 |
| kloofendal_48d_partly_cloudy_puresky | HDRI sky | Greg Zaal, Jarod Guest | All four: image-based light; R1: the visible sky | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky |
| grass_path_2, beige_wall_001 | texture | Rob Tuytel; Dimitrios Savva, Rico Cilliers | the park path; the slabs' sides (in section) | — |
| interior_tiles | texture | Charlotte Baglioni | Downloaded, not used (its beige diagonal tiles read murky when tinted; the bay tiles are drawn in code) | https://polyhaven.com/a/interior_tiles |

## 3D models (Kenney, CC0 1.0)

| Kit | Models used | Used in | Link |
|---|---|---|---|
| Car Kit | sedan (and any car a layout names: suv, taxi, hatchback-sports…), cone | the car in car topics; a parked taxi on the street; cones by the car wash | https://kenney.nl/assets/car-kit |
| City Kit (Commercial) 2.1 | building-a, c, e, j, k, l, m, building-skyscraper-a | the far city behind the street, garage, room and car wash settings (each tinted a facade colour) | https://kenney.nl/assets/city-kit-commercial |
| City Kit (Suburban) 2.0 | tree-large, tree-small | the street trees along the city sidewalk | https://kenney.nl/assets/city-kit-suburban |
| City Kit (Roads) | — | Downloaded, not used yet | https://kenney.nl/assets/city-kit-roads |

R3's painted textures and R4's flock and foam grain are generated in code, so no source is needed.

For production, the textures (about 80 MB at 1–2k) and the Kenney models (about 14 MB) are bundled with the render worker. Both licences (CC0) allow that.
