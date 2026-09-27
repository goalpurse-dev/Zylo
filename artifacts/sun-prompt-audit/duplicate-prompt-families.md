# Duplicate prompt families

Non-null current compiler raster prompts are compared; actual linked provider prompts are preserved per shot in the complete dump.

## Exact duplicates

### Exact-19 — 19 shots

- Shots: 124, 125, 128, 130, 131, 134, 137, 143, 146, 149, 155, 158, 161, 167, 170, 173, 179, 182, 185
- IDs: vb6_1_shot_1, vb6_2_shot_1, vb6_5_shot_1, vb6_1_shot_2, vb6_2_shot_2, vb6_5_shot_2, vb6_2_shot_3, vb6_2_shot_4, vb6_5_shot_4, vb6_2_shot_5, vb6_2_shot_6, vb6_5_shot_6, vb6_2_shot_7, vb6_2_shot_8, vb6_5_shot_8, vb6_2_shot_9, vb6_2_shot_10, vb6_5_shot_10, vb6_2_shot_11
- References: 789d8566-b30d-4268-ba8e-fcebe2c60128
- Result URLs: none
- SHA-256: `5300e489761420283d1f698968a83df63e3a40ccfacd1caf0c39d2f6f6e09a73`

Full shared prompt:
```text
[SCENE TASK]
story scene shot. Finished 2D documentary scene; never a reference sheet, model sheet, turnaround, multi-view panel, or plain studio board.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary: Bold 2D illustrated documentary style — thick confident outlines, rounded cartoon forms, and a restrained flat-shaded palette. Do not: not hyper-realistic / photographic; not childish preschool cartoon; not generic corporate flat vector art; no 3D-render look; no anime/manga stylization.

[COMPOSITION]
Shot size: MEDIUM. Eye-level three-quarter view of the subject in its environment
Focal point: plants.

[CURRENT ACTION / CONTENT]
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.

[CHARACTERS PRESENT]
Plants (crops, forests, phytoplankton): A set of recurring plant depictions including: (a) crop row (broadleaf vegetables/cereals) with discrete leaves and sheathes, (b) a temperate-forest canopy silhouette with varied tree crowns, and (c) stylized marine phytoplankton as planktonic green chlorophyll patches in water. Visual indicators of physiological response: leaf-level chlorophyll fluorescence (brief red emission) and stomatal pore schematic on leaves. Render species with botanical realism (correct leaf venation, canopy layering) but simplified for clarity.. Match supplied isolated reference; preserve identity, not its pose.

[SEMANTIC REQUIREMENTS]
MUST SHOW: Leaf fluorescence shutdown; Crops and phytoplankton vulnerability; Satellite on battery
MUST NOT SHOW: Definitive assertion that all humans die within a fixed short time

[RENDER RULES]
Colored illustration. Blank or abstract displays; no readable text. Exact lettering is composited later.
```


### Exact-15 — 15 shots

- Shots: 59, 65, 68, 74, 77, 83, 86, 92, 95, 101, 104, 110, 113, 119, 122
- IDs: vb_ch5_02_shot_1, vb_ch5_02_shot_2, vb_ch5_05_shot_2, vb_ch5_05_shot_3, vb_ch5_02_shot_4, vb_ch5_02_shot_5, vb_ch5_05_shot_5, vb_ch5_05_shot_6, vb_ch5_02_shot_7, vb_ch5_02_shot_8, vb_ch5_05_shot_8, vb_ch5_05_shot_9, vb_ch5_02_shot_10, vb_ch5_02_shot_11, vb_ch5_05_shot_11
- References: none
- Result URLs: none
- SHA-256: `710575b227ce51eee019fe93f122bf9537fafb3f0b0e6a7072c4788b8ae46a38`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: CLOSE. Close side view centered on the narrated action and its immediate result
Focal point: atmosphere.

[CURRENT ACTION / CONTENT]
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.

[WORLD STATE]
- signal_in_transit: post-arrival
- surface_state: initial_warm

[SEMANTIC REQUIREMENTS]
MUST SHOW: Ocean mixed-layer; Atmosphere heat reservoir; Geothermal flux labeled much smaller than solar
MUST NOT SHOW: Animation of the whole planet freezing solid within seconds

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-21 — 11 shots

- Shots: 127, 133, 139, 145, 151, 157, 163, 169, 175, 181, 187
- IDs: vb6_4_shot_1, vb6_4_shot_2, vb6_4_shot_3, vb6_4_shot_4, vb6_4_shot_5, vb6_4_shot_6, vb6_4_shot_7, vb6_4_shot_8, vb6_4_shot_9, vb6_4_shot_10, vb6_4_shot_11
- References: 789d8566-b30d-4268-ba8e-fcebe2c60128
- Result URLs: none
- SHA-256: `5139e9485b84ef251a964207ba182399bcf742c8b346999a39418ba92875e876`

Full shared prompt:
```text
[SCENE TASK]
story scene shot. Finished 2D documentary scene; never a reference sheet, model sheet, turnaround, multi-view panel, or plain studio board.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary: Bold 2D illustrated documentary style — thick confident outlines, rounded cartoon forms, and a restrained flat-shaded palette. Do not: not hyper-realistic / photographic; not childish preschool cartoon; not generic corporate flat vector art; no 3D-render look; no anime/manga stylization.

[COMPOSITION]
Shot size: WIDE. Wide oblique view showing the subject and its working environment
Focal point: plants.

[CURRENT ACTION / CONTENT]
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.

[CHARACTERS PRESENT]
Plants (crops, forests, phytoplankton): A set of recurring plant depictions including: (a) crop row (broadleaf vegetables/cereals) with discrete leaves and sheathes, (b) a temperate-forest canopy silhouette with varied tree crowns, and (c) stylized marine phytoplankton as planktonic green chlorophyll patches in water. Visual indicators of physiological response: leaf-level chlorophyll fluorescence (brief red emission) and stomatal pore schematic on leaves. Render species with botanical realism (correct leaf venation, canopy layering) but simplified for clarity.. Match supplied isolated reference; preserve identity, not its pose.

[SEMANTIC REQUIREMENTS]
MUST SHOW: Leaf fluorescence shutdown; Crops and phytoplankton vulnerability; Satellite on battery
MUST NOT SHOW: Definitive assertion that all humans die within a fixed short time

[RENDER RULES]
Colored illustration. Blank or abstract displays; no readable text. Exact lettering is composited later.
```


### Exact-22 — 10 shots

- Shots: 132, 138, 144, 150, 156, 162, 168, 174, 180, 186
- IDs: vb6_3_shot_2, vb6_3_shot_3, vb6_3_shot_4, vb6_3_shot_5, vb6_3_shot_6, vb6_3_shot_7, vb6_3_shot_8, vb6_3_shot_9, vb6_3_shot_10, vb6_3_shot_11
- References: 789d8566-b30d-4268-ba8e-fcebe2c60128
- Result URLs: none
- SHA-256: `5a2353dcc5ffca416db115f183a2cf301d670060f3d257b049ed2662838d13be`

Full shared prompt:
```text
[SCENE TASK]
story scene shot. Finished 2D documentary scene; never a reference sheet, model sheet, turnaround, multi-view panel, or plain studio board.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary: Bold 2D illustrated documentary style — thick confident outlines, rounded cartoon forms, and a restrained flat-shaded palette. Do not: not hyper-realistic / photographic; not childish preschool cartoon; not generic corporate flat vector art; no 3D-render look; no anime/manga stylization.

[COMPOSITION]
Shot size: MEDIUM. Reverse three-quarter view connecting the subject to the narrated object
Focal point: plants.

[CURRENT ACTION / CONTENT]
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.

[CHARACTERS PRESENT]
Plants (crops, forests, phytoplankton): A set of recurring plant depictions including: (a) crop row (broadleaf vegetables/cereals) with discrete leaves and sheathes, (b) a temperate-forest canopy silhouette with varied tree crowns, and (c) stylized marine phytoplankton as planktonic green chlorophyll patches in water. Visual indicators of physiological response: leaf-level chlorophyll fluorescence (brief red emission) and stomatal pore schematic on leaves. Render species with botanical realism (correct leaf venation, canopy layering) but simplified for clarity.. Match supplied isolated reference; preserve identity, not its pose.

[LOCATION]
Earth (daylit hemisphere)

[SEMANTIC REQUIREMENTS]
MUST SHOW: Leaf fluorescence shutdown; Crops and phytoplankton vulnerability; Satellite on battery
MUST NOT SHOW: Definitive assertion that all humans die within a fixed short time

[RENDER RULES]
Colored illustration. Blank or abstract displays; no readable text. Exact lettering is composited later.
```


### Exact-14 — 9 shots

- Shots: 58, 70, 73, 76, 79, 82, 85, 112, 115
- IDs: vb_ch5_01_shot_1, vb_ch5_01_shot_3, vb_ch5_04_shot_3, vb_ch5_01_shot_4, vb_ch5_04_shot_4, vb_ch5_01_shot_5, vb_ch5_04_shot_5, vb_ch5_01_shot_10, vb_ch5_04_shot_10
- References: 15bd351f-9c73-4c18-9331-94ca09ef9435
- Result URLs: none
- SHA-256: `36854ec565bb171019698c859252b6b74faddd74a434b56b5d710583674d0ae1`

Full shared prompt:
```text
[SCENE TASK]
diagram shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: CLOSE. Eye-level three-quarter view of the subject in its environment
Focal point: atmosphere.

[CURRENT ACTION / CONTENT]
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.

[WORLD STATE]
- signal_in_transit: post-arrival
- surface_state: initial_warm

[SEMANTIC REQUIREMENTS]
MUST SHOW: Ocean mixed-layer; Atmosphere heat reservoir; Geothermal flux labeled much smaller than solar
MUST NOT SHOW: Animation of the whole planet freezing solid within seconds

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-17 — 8 shots

- Shots: 63, 69, 81, 87, 99, 105, 117, 123
- IDs: vb_ch5_06_shot_1, vb_ch5_06_shot_2, vb_ch5_06_shot_4, vb_ch5_06_shot_5, vb_ch5_06_shot_7, vb_ch5_06_shot_8, vb_ch5_06_shot_10, vb_ch5_06_shot_11
- References: none
- Result URLs: none
- SHA-256: `ca14f6b0318706511ff95c17592bc923f84883fa049bc87dbcd41d5e39e2bbf3`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: MEDIUM. Reverse three-quarter view connecting the subject to the narrated object
Focal point: atmosphere.

[CURRENT ACTION / CONTENT]
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.

[SEMANTIC REQUIREMENTS]
MUST SHOW: Ocean mixed-layer; Atmosphere heat reservoir; Geothermal flux labeled much smaller than solar
MUST NOT SHOW: Animation of the whole planet freezing solid within seconds

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-16 — 7 shots

- Shots: 60, 72, 78, 90, 96, 108, 114
- IDs: vb_ch5_03_shot_1, vb_ch5_03_shot_3, vb_ch5_03_shot_4, vb_ch5_03_shot_6, vb_ch5_03_shot_7, vb_ch5_03_shot_9, vb_ch5_03_shot_10
- References: none
- Result URLs: none
- SHA-256: `bd3a0543098306275321996936d33f417f0c322455618f6a6161259a1ab64ac4`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: MEDIUM. Reverse three-quarter view connecting the subject to the narrated object
Focal point: atmosphere.

[CURRENT ACTION / CONTENT]
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.

[WORLD STATE]
- signal_in_transit: post-arrival
- surface_state: initial_warm

[SEMANTIC REQUIREMENTS]
MUST SHOW: Ocean mixed-layer; Atmosphere heat reservoir; Geothermal flux labeled much smaller than solar
MUST NOT SHOW: Animation of the whole planet freezing solid within seconds

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-20 — 7 shots

- Shots: 126, 129, 135, 147, 159, 171, 183
- IDs: vb6_3_shot_1, vb6_6_shot_1, vb6_6_shot_2, vb6_6_shot_4, vb6_6_shot_6, vb6_6_shot_8, vb6_6_shot_10
- References: 789d8566-b30d-4268-ba8e-fcebe2c60128
- Result URLs: none
- SHA-256: `c6eae148b467744581640f78ecc262173c346d74287bc0fa29d30ebdd4798efa`

Full shared prompt:
```text
[SCENE TASK]
story scene shot. Finished 2D documentary scene; never a reference sheet, model sheet, turnaround, multi-view panel, or plain studio board.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary: Bold 2D illustrated documentary style — thick confident outlines, rounded cartoon forms, and a restrained flat-shaded palette. Do not: not hyper-realistic / photographic; not childish preschool cartoon; not generic corporate flat vector art; no 3D-render look; no anime/manga stylization.

[COMPOSITION]
Shot size: MEDIUM. Eye-level three-quarter view of the subject in its environment
Focal point: plants.

[CURRENT ACTION / CONTENT]
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.

[CHARACTERS PRESENT]
Plants (crops, forests, phytoplankton): A set of recurring plant depictions including: (a) crop row (broadleaf vegetables/cereals) with discrete leaves and sheathes, (b) a temperate-forest canopy silhouette with varied tree crowns, and (c) stylized marine phytoplankton as planktonic green chlorophyll patches in water. Visual indicators of physiological response: leaf-level chlorophyll fluorescence (brief red emission) and stomatal pore schematic on leaves. Render species with botanical realism (correct leaf venation, canopy layering) but simplified for clarity.. Match supplied isolated reference; preserve identity, not its pose.

[LOCATION]
Earth (daylit hemisphere)

[SEMANTIC REQUIREMENTS]
MUST SHOW: Leaf fluorescence shutdown; Crops and phytoplankton vulnerability; Satellite on battery
MUST NOT SHOW: Definitive assertion that all humans die within a fixed short time

[RENDER RULES]
Colored illustration. Blank or abstract displays; no readable text. Exact lettering is composited later.
```


### Exact-5 — 4 shots

- Shots: 22, 24, 25, 27
- IDs: vb_ch3_01_shot_1, vb_ch3_01_shot_3, vb_ch3_01_shot_4, vb_ch3_01_shot_6
- References: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/da398d6a-5626-4064-9b66-6436de68df04.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/8685f64f-4464-4c5c-9350-f65f100fbcbe.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/544c0dee-b27d-432f-bd6c-d89d625e41ae.jpg
- SHA-256: `4649225cd715681aa1b7388ed19b1289d26aef50ac5a50f4db232964b6ef89ef`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: MEDIUM. Eye-level three-quarter view of the subject in its environment
Focal point: PV panel.

[CURRENT ACTION / CONTENT]
Show a literal beam of sunlight cutting off, camera sensor trace and PV output falling to zero in under a second.

[WORLD STATE]
- direct_beam: on
- timeOfDay: daylight

[SEMANTIC REQUIREMENTS]
MUST SHOW: PV output trace dropping; Camera sensor response trace; Flat shading of surfaces as direct-beam disappears
MUST NOT SHOW: Gradual seconds-long dimming of direct sun (this is essentially instantaneous)

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-27 — 4 shots

- Shots: 206, 208, 210, 212
- IDs: vb_ch7_s13_01_shot_1, vb_ch7_s13_01_shot_3, vb_ch7_s13_01_shot_5, vb_ch7_s13_01_shot_7
- References: 789d8566-b30d-4268-ba8e-fcebe2c60128
- Result URLs: none
- SHA-256: `572a5041916f210fcba6971eb44554a55ffcf70477f9eba94e728879c115f4c5`

Full shared prompt:
```text
[SCENE TASK]
story scene shot. Finished 2D documentary scene; never a reference sheet, model sheet, turnaround, multi-view panel, or plain studio board.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary: Bold 2D illustrated documentary style — thick confident outlines, rounded cartoon forms, and a restrained flat-shaded palette. Do not: not hyper-realistic / photographic; not childish preschool cartoon; not generic corporate flat vector art; no 3D-render look; no anime/manga stylization.

[COMPOSITION]
Shot size: MEDIUM. Eye-level three-quarter view of the subject in its environment
Focal point: Earth.

[CURRENT ACTION / CONTENT]
Close on a calm shot of Earth half in shadow, while overlaying the three-mechanism map and a few practical takeaways about what matters first.

[CHARACTERS PRESENT]
Plants (crops, forests, phytoplankton): A set of recurring plant depictions including: (a) crop row (broadleaf vegetables/cereals) with discrete leaves and sheathes, (b) a temperate-forest canopy silhouette with varied tree crowns, and (c) stylized marine phytoplankton as planktonic green chlorophyll patches in water. Visual indicators of physiological response: leaf-level chlorophyll fluorescence (brief red emission) and stomatal pore schematic on leaves. Render species with botanical realism (correct leaf venation, canopy layering) but simplified for clarity.. Match supplied isolated reference; preserve identity, not its pose.

[LOCATION]
Earth (daylit hemisphere)

[SEMANTIC REQUIREMENTS]
MUST SHOW: Earth with terminator; Three-mechanism summary graphic
MUST NOT SHOW: Conclusive survival time claims without caveats

[RENDER RULES]
Colored illustration. Blank or abstract displays; no readable text. Exact lettering is composited later.
```


### Exact-1 — 3 shots

- Shots: 1, 3, 6
- IDs: vb1_shot_1, vb1_shot_3, vb1_shot_6
- References: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/cc7941b5-1c0b-4cbe-a53c-f5396637387c.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/e9006fec-2e66-4c81-8307-da37058f4b7f.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/9dc1f82b-2334-4318-86eb-761e8d45aea7.jpg
- SHA-256: `8ccf00cc812cd63f5c8b1bce0e4b76af75bcb4899af4591aba4b28a2178aa957`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: MEDIUM. Eye-level three-quarter view of the subject in its environment
Focal point: Earth.

[CURRENT ACTION / CONTENT]
Show Earth in daylight, then the Sun's disk suddenly missing, and present the three visceral questions to set stakes and create curiosity.

[LOCATION]
Earth (daylit hemisphere)

[WORLD STATE]
- timeOfDay: daylight_hemisphere
- sun_disk_visible: true

[SEMANTIC REQUIREMENTS]
MUST SHOW: Earth in daylight; Sun's disk visually removed; Three question captions (feel it? freeze? fly away?)
MUST NOT SHOW: Explosive or cinematic destruction of the Sun; Immediate visual of Earth being flung away

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-8 — 3 shots

- Shots: 36, 39, 42
- IDs: vb_ch3_03_shot_1, vb_ch3_03_shot_4, vb_ch3_03_shot_7
- References: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/d14adad8-e8af-4fcb-821c-1f82f1203fbd-overlay.png, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/6871bd7b-fc16-4669-b0a3-7ad626d38666.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/3c68bcb0-9091-4992-913a-66bf69b77dfa.jpg
- SHA-256: `6c15bc157b085d5727b3ba5e13493c2ed5a89e02e3af444f09820d6a3be2c5bb`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: MEDIUM. Reverse three-quarter view connecting the subject to the narrated object
Focal point: power grid.

[CURRENT ACTION / CONTENT]
Layer a short timeline graphic while showing a PV array tripping, plant leaves closing slightly, and a twilight horizon, so viewers can feel the seconds ticking.

[WORLD STATE]
- pv_output: producing
- grid_status: stable

[SEMANTIC REQUIREMENTS]
MUST SHOW: PV inverters tripping; Leaf fluorescence trace collapsing; Timeline graphic with buckets labeled
MUST NOT SHOW: Human-scale infrastructure failing instantly without intermediate seconds-scale effects

[TEXT-SAFE COMPOSITION]
Leave clear, uncluttered visual space (upper or lower third) for a text overlay to be added afterward. Do not render any title, caption or heading yourself.

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-18 — 3 shots

- Shots: 64, 91, 100
- IDs: vb_ch5_01_shot_2, vb_ch5_04_shot_6, vb_ch5_01_shot_8
- References: 15bd351f-9c73-4c18-9331-94ca09ef9435
- Result URLs: none
- SHA-256: `fffdacb65abdb178a2fd008c313d1c042a033dec131d5abe73894fb5f47f1630`

Full shared prompt:
```text
[SCENE TASK]
diagram shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: WIDE. Wide oblique view connecting the narrated subject to its environment
Focal point: atmosphere.

[CURRENT ACTION / CONTENT]
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.

[WORLD STATE]
- signal_in_transit: post-arrival
- surface_state: initial_warm

[SEMANTIC REQUIREMENTS]
MUST SHOW: Ocean mixed-layer; Atmosphere heat reservoir; Geothermal flux labeled much smaller than solar
MUST NOT SHOW: Animation of the whole planet freezing solid within seconds

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-2 — 2 shots

- Shots: 2, 4
- IDs: vb1_shot_2, vb1_shot_4
- References: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/caf9f117-01e7-4c4b-af0a-b72d301f32d4.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/8600a99d-57fe-4bec-a75f-a5771b11144b.jpg
- SHA-256: `08acb8a065bfeee18504f8610345e218727e075b4a8d88f638e9046221effdb4`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: WIDE. Reverse three-quarter view focused on the narrated action
Focal point: Earth.

[CURRENT ACTION / CONTENT]
Show Earth in daylight, then the Sun's disk suddenly missing, and present the three visceral questions to set stakes and create curiosity.

[LOCATION]
Earth (daylit hemisphere)

[WORLD STATE]
- timeOfDay: daylight_hemisphere
- sun_disk_visible: true

[SEMANTIC REQUIREMENTS]
MUST SHOW: Earth in daylight; Sun's disk visually removed; Three question captions (feel it? freeze? fly away?)
MUST NOT SHOW: Explosive or cinematic destruction of the Sun; Immediate visual of Earth being flung away

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-3 — 2 shots

- Shots: 15, 21
- IDs: vb_ch2_01_shot_1, vb_ch2_01_shot_7
- References: 15bd351f-9c73-4c18-9331-94ca09ef9435
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/81d37b30-8cf7-4421-91bc-a74c74af1781-overlay.png
- SHA-256: `1b77f9e00b0da667d2839a938f18c7ca0be9f5b1a61f0a36c2053eba24c2e172`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: MEDIUM. Reverse three-quarter view connecting the subject to the narrated object
Focal point: Earth.

[CURRENT ACTION / CONTENT]
Show light rays and gravitational field lines propagating from the Sun to Earth with an 8:19 timer, emphasizing the causal delay.

[WORLD STATE]
- timeOfDay: not_applicable
- signal_in_transit: present

[SEMANTIC REQUIREMENTS]
MUST SHOW: Light-time label ≈8:19; Animation of signals traveling from Sun to Earth
MUST NOT SHOW: Any depiction of instantaneous change at Earth when the Sun vanishes

[TEXT-SAFE COMPOSITION]
Leave clear, uncluttered visual space (upper or lower third) for a text overlay to be added afterward. Do not render any title, caption or heading yourself.

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-4 — 2 shots

- Shots: 16, 19
- IDs: vb_ch2_01_shot_2, vb_ch2_01_shot_5
- References: 15bd351f-9c73-4c18-9331-94ca09ef9435
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/9e9a7bf0-d225-4fd0-99c0-349ceae85e66-overlay.png
- SHA-256: `db43eb1d0948d98dc763652f9ff767a83950e448586e7f1769696e53c7e651ca`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: WIDE. Wide oblique view showing the subject and its working environment
Focal point: Earth.

[CURRENT ACTION / CONTENT]
Show light rays and gravitational field lines propagating from the Sun to Earth with an 8:19 timer, emphasizing the causal delay.

[WORLD STATE]
- timeOfDay: not_applicable
- signal_in_transit: present

[SEMANTIC REQUIREMENTS]
MUST SHOW: Light-time label ≈8:19; Animation of signals traveling from Sun to Earth
MUST NOT SHOW: Any depiction of instantaneous change at Earth when the Sun vanishes

[TEXT-SAFE COMPOSITION]
Leave clear, uncluttered visual space (upper or lower third) for a text overlay to be added afterward. Do not render any title, caption or heading yourself.

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-6 — 2 shots

- Shots: 31, 34
- IDs: vb_ch3_02_shot_3, vb_ch3_02_shot_6
- References: 9278a91a-0b92-4c3d-b88b-15c413242b5b
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/b3a41cdf-a89e-430a-9664-44bbc6ae2644.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/da62ce3e-70f0-48a7-92ad-c1927e8a7852.jpg
- SHA-256: `23b08f944d3521beb8c12f180fd839c8e10290de9c3820b73cb6c63e6f1cab8b`

Full shared prompt:
```text
[SCENE TASK]
diagram shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: CLOSE. Eye-level three-quarter view of the subject in its environment
Focal point: atmosphere.

[CURRENT ACTION / CONTENT]
Show gradual dimming of sky brightness from daylight toward twilight over seconds-to-minutes with different skies (hazy, clear, polluted).

[LOCATION]
Local sky / atmosphere

[WORLD STATE]
- solar_elevation: variable
- aerosol_load: variable

[SEMANTIC REQUIREMENTS]
MUST SHOW: Animated scattering particles; Sky brightness curve over time
MUST NOT SHOW: Instant full darkness the moment direct-beam stops

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-7 — 2 shots

- Shots: 32, 35
- IDs: vb_ch3_02_shot_4, vb_ch3_02_shot_7
- References: 9278a91a-0b92-4c3d-b88b-15c413242b5b
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/2afb2459-824f-47e4-8cd0-1a52ead23d87.jpg
- SHA-256: `da839ba35e96ffada51858ae9ac2306749c2517378bcc85968531e35bcb131f1`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: CLOSE. Close side view centered on the narrated action and its immediate result
Focal point: atmosphere.

[CURRENT ACTION / CONTENT]
Show gradual dimming of sky brightness from daylight toward twilight over seconds-to-minutes with different skies (hazy, clear, polluted).

[LOCATION]
Local sky / atmosphere

[WORLD STATE]
- solar_elevation: variable
- aerosol_load: variable

[SEMANTIC REQUIREMENTS]
MUST SHOW: Animated scattering particles; Sky brightness curve over time
MUST NOT SHOW: Instant full darkness the moment direct-beam stops

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-9 — 2 shots

- Shots: 37, 43
- IDs: vb_ch3_03_shot_2, vb_ch3_03_shot_8
- References: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/f7193eb7-2e56-47f3-a874-d93dd4dd3087.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/a9b9d1bb-339d-4a6b-b0ef-31896bcaac79.jpg
- SHA-256: `fa52881b2650cc5706af2fdd6cd09e9ce674f72f36d82ec41d007b0a6cc03b81`

Full shared prompt:
```text
[SCENE TASK]
programmatic graphic shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: CLOSE. Eye-level three-quarter view of the subject in its environment
Focal point: power grid.

[CURRENT ACTION / CONTENT]
Layer a short timeline graphic while showing a PV array tripping, plant leaves closing slightly, and a twilight horizon, so viewers can feel the seconds ticking.

[WORLD STATE]
- pv_output: producing
- grid_status: stable

[SEMANTIC REQUIREMENTS]
MUST SHOW: PV inverters tripping; Leaf fluorescence trace collapsing; Timeline graphic with buckets labeled
MUST NOT SHOW: Human-scale infrastructure failing instantly without intermediate seconds-scale effects

[TEXT-SAFE COMPOSITION]
Leave clear, uncluttered visual space (upper or lower third) for a text overlay to be added afterward. Do not render any title, caption or heading yourself.

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-10 — 2 shots

- Shots: 38, 41
- IDs: vb_ch3_03_shot_3, vb_ch3_03_shot_6
- References: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/00122ac7-366e-49fb-b6ea-966b17f471d2-overlay.png, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/10df208f-89cd-4485-8a25-34281a1d9f66.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/d18f0604-72fc-4ee4-a2f4-49c0a3a2fb01.jpg
- SHA-256: `eddd8e7273b6aa7c918cb01bc6e710a9d248cd3474f4ec8f5e65cf95e67912b8`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: CLOSE. Close side view centered on the narrated action and its immediate result
Focal point: power grid.

[CURRENT ACTION / CONTENT]
Layer a short timeline graphic while showing a PV array tripping, plant leaves closing slightly, and a twilight horizon, so viewers can feel the seconds ticking.

[WORLD STATE]
- pv_output: producing
- grid_status: stable

[SEMANTIC REQUIREMENTS]
MUST SHOW: PV inverters tripping; Leaf fluorescence trace collapsing; Timeline graphic with buckets labeled
MUST NOT SHOW: Human-scale infrastructure failing instantly without intermediate seconds-scale effects

[TEXT-SAFE COMPOSITION]
Leave clear, uncluttered visual space (upper or lower third) for a text overlay to be added afterward. Do not render any title, caption or heading yourself.

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-11 — 2 shots

- Shots: 45, 51
- IDs: vb_ch4_01_shot_2, vb_ch4_01_shot_8
- References: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/0dff33c2-471a-4019-83b1-3992cbaf2dbb-overlay.png, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/21975954-f448-46bf-a683-f54caeb05470.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/1a120cf5-cd42-4d0a-ba9b-043cbe21d65f.jpg
- SHA-256: `cebe87d708a3307365ee45686231dd097a90aabf8e52a8af3cb0bf37ef19f6db`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: MEDIUM. Reverse three-quarter view connecting the subject to the narrated object
Focal point: Earth.

[CURRENT ACTION / CONTENT]
Show Earth's orbit path then switch to a tangent straight-line trajectory at the moment gravity change arrives, with distance labels (≈15,000 km in ~8 min).

[LOCATION]
Earth (daylit hemisphere)

[WORLD STATE]
- frame_of_reference: heliocentric_fixed

[SEMANTIC REQUIREMENTS]
MUST SHOW: Orbit-to-tangent transition; Label with Earth speed ≈29.8 km/s and distance ≈15,000 km
MUST NOT SHOW: Immediate explosion or chaotic scattering at the moment signal arrives

[TEXT-SAFE COMPOSITION]
Leave clear, uncluttered visual space (upper or lower third) for a text overlay to be added afterward. Do not render any title, caption or heading yourself.

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-12 — 2 shots

- Shots: 46, 49
- IDs: vb_ch4_01_shot_3, vb_ch4_01_shot_6
- References: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/8bdee990-295b-44e7-8ddc-87f27bf43b6d.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/b51b019a-7d8a-4fb6-a7e7-34d1ca3a3f5f-overlay.png, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/bba9d368-46da-42ae-8110-07814b74e97c-overlay.png, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/e9f0efbb-465d-4318-8497-91f9aceab203.jpg
- SHA-256: `998422c91bb3c10af7102c9a7a57976d9a4352a20057165876cababfc16e4041`

Full shared prompt:
```text
[SCENE TASK]
diagram shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: CLOSE. Eye-level three-quarter view of the subject in its environment
Focal point: Earth.

[CURRENT ACTION / CONTENT]
Show Earth's orbit path then switch to a tangent straight-line trajectory at the moment gravity change arrives, with distance labels (≈15,000 km in ~8 min).

[LOCATION]
Earth (daylit hemisphere)

[WORLD STATE]
- frame_of_reference: heliocentric_fixed

[SEMANTIC REQUIREMENTS]
MUST SHOW: Orbit-to-tangent transition; Label with Earth speed ≈29.8 km/s and distance ≈15,000 km
MUST NOT SHOW: Immediate explosion or chaotic scattering at the moment signal arrives

[TEXT-SAFE COMPOSITION]
Leave clear, uncluttered visual space (upper or lower third) for a text overlay to be added afterward. Do not render any title, caption or heading yourself.

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-13 — 2 shots

- Shots: 47, 50
- IDs: vb_ch4_01_shot_4, vb_ch4_01_shot_7
- References: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/5b272aad-9b86-49e7-b8fb-92294ae64afa.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/56011d07-419d-47dc-8886-7ef963058996.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/c5abb470-62cf-4347-a0ea-c3a7c4c26c80.jpg
- SHA-256: `889f4d4ade84c31b95f3f342bbbd2cd3cf9b3927f5d7c42a2f4518169278ec66`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: CLOSE. Close side view centered on the narrated action and its immediate result
Focal point: Earth.

[CURRENT ACTION / CONTENT]
Show Earth's orbit path then switch to a tangent straight-line trajectory at the moment gravity change arrives, with distance labels (≈15,000 km in ~8 min).

[LOCATION]
Earth (daylit hemisphere)

[WORLD STATE]
- frame_of_reference: heliocentric_fixed

[SEMANTIC REQUIREMENTS]
MUST SHOW: Orbit-to-tangent transition; Label with Earth speed ≈29.8 km/s and distance ≈15,000 km
MUST NOT SHOW: Immediate explosion or chaotic scattering at the moment signal arrives

[TEXT-SAFE COMPOSITION]
Leave clear, uncluttered visual space (upper or lower third) for a text overlay to be added afterward. Do not render any title, caption or heading yourself.

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-23 — 2 shots

- Shots: 192, 195
- IDs: vb_ch7_s11_01_shot_3, vb_ch7_s11_01_shot_6
- References: none
- Result URLs: none
- SHA-256: `0c12a233567febca608618be323c11c9bdc241ec89aa389457f680b5d4a2f95c`

Full shared prompt:
```text
[SCENE TASK]
diagram shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: CLOSE. Eye-level three-quarter view of the subject in its environment
Focal point: planets.

[CURRENT ACTION / CONTENT]
Show a montage: darkened satellites, planets drifting on new paths, and an overlay explaining that N-body simulations are needed for long-term predictions.

[WORLD STATE]
- timeOfDay: not_applicable
- signal_in_transit: present

[SEMANTIC REQUIREMENTS]
MUST SHOW: Satellites losing sunlight; Schematic of planets interacting over long timescales; Caption about N-body sensitivity
MUST NOT SHOW: A single definitive billions-of-years future trajectory

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-24 — 2 shots

- Shots: 193, 196
- IDs: vb_ch7_s11_01_shot_4, vb_ch7_s11_01_shot_7
- References: none
- Result URLs: none
- SHA-256: `6d3a6efd2e3273dc28e03e447f57ba644191dc256818453f3f1467f34977d780`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: WIDE. Wide oblique view showing the subject and its working environment
Focal point: planets.

[CURRENT ACTION / CONTENT]
Show a montage: darkened satellites, planets drifting on new paths, and an overlay explaining that N-body simulations are needed for long-term predictions.

[WORLD STATE]
- timeOfDay: not_applicable
- signal_in_transit: present

[SEMANTIC REQUIREMENTS]
MUST SHOW: Satellites losing sunlight; Schematic of planets interacting over long timescales; Caption about N-body sensitivity
MUST NOT SHOW: A single definitive billions-of-years future trajectory

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-25 — 2 shots

- Shots: 197, 200
- IDs: vb_ch7_s12_01_shot_1, vb_ch7_s12_01_shot_4
- References: none
- Result URLs: none
- SHA-256: `30505578f006967cff577c1c90df8365baac92e9c533463f2bd43772329417de`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: CLOSE. Close side view centered on the narrated action and its immediate result
Focal point: Earth.

[CURRENT ACTION / CONTENT]
Consolidate earlier visuals into a single layered timeline from 0 seconds to years, tying each timescale to its physical mechanism.

[LOCATION]
Earth (daylit hemisphere)

[SEMANTIC REQUIREMENTS]
MUST SHOW: Layered timeline from seconds → minutes → hours → days → months → years; Mechanism labels: signal speed, inertia, thermal mass, N-body sensitivity
MUST NOT SHOW: Any unsupported precise numeric freezing time for entire oceans

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-26 — 2 shots

- Shots: 202, 205
- IDs: vb_ch7_s12_01_shot_6, vb_ch7_s12_01_shot_9
- References: none
- Result URLs: none
- SHA-256: `8615382e09783680e7bed7d3d0a92a5c4c66046a5519bb90accdd688e99d9a29`

Full shared prompt:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.

[COMPOSITION]
Shot size: WIDE. Wide oblique view showing the subject and its working environment
Focal point: Earth.

[CURRENT ACTION / CONTENT]
Consolidate earlier visuals into a single layered timeline from 0 seconds to years, tying each timescale to its physical mechanism.

[LOCATION]
Earth (daylit hemisphere)

[SEMANTIC REQUIREMENTS]
MUST SHOW: Layered timeline from seconds → minutes → hours → days → months → years; Mechanism labels: signal speed, inertia, thermal mass, N-body sensitivity
MUST NOT SHOW: Any unsupported precise numeric freezing time for entire oceans

[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```


### Exact-28 — 2 shots

- Shots: 207, 211
- IDs: vb_ch7_s13_01_shot_2, vb_ch7_s13_01_shot_6
- References: 789d8566-b30d-4268-ba8e-fcebe2c60128
- Result URLs: none
- SHA-256: `cd99f5ca3ec2e5d9c088060521f57d7e3d65d158055e2ee676763699ea59339d`

Full shared prompt:
```text
[SCENE TASK]
story scene shot. Finished 2D documentary scene; never a reference sheet, model sheet, turnaround, multi-view panel, or plain studio board.

[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary: Bold 2D illustrated documentary style — thick confident outlines, rounded cartoon forms, and a restrained flat-shaded palette. Do not: not hyper-realistic / photographic; not childish preschool cartoon; not generic corporate flat vector art; no 3D-render look; no anime/manga stylization.

[COMPOSITION]
Shot size: WIDE. Reverse three-quarter view focused on the narrated action
Focal point: Earth.

[CURRENT ACTION / CONTENT]
Close on a calm shot of Earth half in shadow, while overlaying the three-mechanism map and a few practical takeaways about what matters first.

[CHARACTERS PRESENT]
Plants (crops, forests, phytoplankton): A set of recurring plant depictions including: (a) crop row (broadleaf vegetables/cereals) with discrete leaves and sheathes, (b) a temperate-forest canopy silhouette with varied tree crowns, and (c) stylized marine phytoplankton as planktonic green chlorophyll patches in water. Visual indicators of physiological response: leaf-level chlorophyll fluorescence (brief red emission) and stomatal pore schematic on leaves. Render species with botanical realism (correct leaf venation, canopy layering) but simplified for clarity.. Match supplied isolated reference; preserve identity, not its pose.

[LOCATION]
Earth (daylit hemisphere)

[SEMANTIC REQUIREMENTS]
MUST SHOW: Earth with terminator; Three-mechanism summary graphic
MUST NOT SHOW: Conclusive survival time claims without caveats

[RENDER RULES]
Colored illustration. Blank or abstract displays; no readable text. Exact lettering is composited later.
```


## Near duplicates (normalized token Jaccard ≥ 0.88)

### Near-J — 47 shots

- Shots: 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 137, 138, 139, 143, 144, 145, 146, 147, 149, 150, 151, 155, 156, 157, 158, 159, 161, 162, 163, 167, 168, 169, 170, 171, 173, 174, 175, 179, 180, 181, 182, 183, 185, 186, 187
- IDs: vb6_1_shot_1, vb6_2_shot_1, vb6_3_shot_1, vb6_4_shot_1, vb6_5_shot_1, vb6_6_shot_1, vb6_1_shot_2, vb6_2_shot_2, vb6_3_shot_2, vb6_4_shot_2, vb6_5_shot_2, vb6_6_shot_2, vb6_2_shot_3, vb6_3_shot_3, vb6_4_shot_3, vb6_2_shot_4, vb6_3_shot_4, vb6_4_shot_4, vb6_5_shot_4, vb6_6_shot_4, vb6_2_shot_5, vb6_3_shot_5, vb6_4_shot_5, vb6_2_shot_6, vb6_3_shot_6, vb6_4_shot_6, vb6_5_shot_6, vb6_6_shot_6, vb6_2_shot_7, vb6_3_shot_7, vb6_4_shot_7, vb6_2_shot_8, vb6_3_shot_8, vb6_4_shot_8, vb6_5_shot_8, vb6_6_shot_8, vb6_2_shot_9, vb6_3_shot_9, vb6_4_shot_9, vb6_2_shot_10, vb6_3_shot_10, vb6_4_shot_10, vb6_5_shot_10, vb6_6_shot_10, vb6_2_shot_11, vb6_3_shot_11, vb6_4_shot_11
- Minimum similarity to representative: 0.948
- Meaningful dynamic intent variation: yes
- References reused: 789d8566-b30d-4268-ba8e-fcebe2c60128
- Result URLs: none

Common prompt lines:
```text
[SCENE TASK]
story scene shot. Finished 2D documentary scene; never a reference sheet, model sheet, turnaround, multi-view panel, or plain studio board.
[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary: Bold 2D illustrated documentary style — thick confident outlines, rounded cartoon forms, and a restrained flat-shaded palette. Do not: not hyper-realistic / photographic; not childish preschool cartoon; not generic corporate flat vector art; no 3D-render look; no anime/manga stylization.
[COMPOSITION]
Focal point: plants.
[CURRENT ACTION / CONTENT]
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.
[CHARACTERS PRESENT]
Plants (crops, forests, phytoplankton): A set of recurring plant depictions including: (a) crop row (broadleaf vegetables/cereals) with discrete leaves and sheathes, (b) a temperate-forest canopy silhouette with varied tree crowns, and (c) stylized marine phytoplankton as planktonic green chlorophyll patches in water. Visual indicators of physiological response: leaf-level chlorophyll fluorescence (brief red emission) and stomatal pore schematic on leaves. Render species with botanical realism (correct leaf venation, canopy layering) but simplified for clarity.. Match supplied isolated reference; preserve identity, not its pose.
[SEMANTIC REQUIREMENTS]
MUST SHOW: Leaf fluorescence shutdown; Crops and phytoplankton vulnerability; Satellite on battery
MUST NOT SHOW: Definitive assertion that all humans die within a fixed short time
[RENDER RULES]
Colored illustration. Blank or abstract displays; no readable text. Exact lettering is composited later.
```

What changes:
```text
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.: At the microscopic level photosynthesis stops almost instantly: electron transport and fluorescence collapse within milliseconds to seconds once light ends.
---
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.: Whole leaves and plants then begin slower adjustments .
---
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.: stomata respond over seconds to minutes and carbohydrate redistribution follows over hours.
---
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.: That means exposed crops and surface phytoplankton lose net productivity fastest (days to weeks),
---
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.: while large forests and soils buffer production for weeks to months.
---
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.: Electrically, satellites and spacecraft lose solar input immediately and switch to batteries.
---
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.: many small satellites can operate for hours to days before power runs out.
---
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.: Grid inverters and protection relays detect sudden solar loss in fractions of a second and trip or reconfigure within <1–5 s,
---
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.: while human operators and reserve dispatch unfold over minutes to hours.
---
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.: Whether communities survive beyond weeks or months depends on stored food, continuous power sources like nuclear or geothermal, and the resilience of supply chains .
---
Show plant leaves losing photosynthetic activity, fields wilting over days, a satellite switching to battery, and emergency power systems in a city being brought online.: outcomes that need targeted engineering and logistical analysis.
```


### Near-I — 42 shots

- Shots: 58, 59, 60, 63, 64, 65, 68, 69, 70, 72, 73, 74, 76, 77, 78, 79, 81, 82, 83, 85, 86, 87, 90, 91, 92, 95, 96, 99, 100, 101, 104, 105, 108, 110, 112, 113, 114, 115, 117, 119, 122, 123
- IDs: vb_ch5_01_shot_1, vb_ch5_02_shot_1, vb_ch5_03_shot_1, vb_ch5_06_shot_1, vb_ch5_01_shot_2, vb_ch5_02_shot_2, vb_ch5_05_shot_2, vb_ch5_06_shot_2, vb_ch5_01_shot_3, vb_ch5_03_shot_3, vb_ch5_04_shot_3, vb_ch5_05_shot_3, vb_ch5_01_shot_4, vb_ch5_02_shot_4, vb_ch5_03_shot_4, vb_ch5_04_shot_4, vb_ch5_06_shot_4, vb_ch5_01_shot_5, vb_ch5_02_shot_5, vb_ch5_04_shot_5, vb_ch5_05_shot_5, vb_ch5_06_shot_5, vb_ch5_03_shot_6, vb_ch5_04_shot_6, vb_ch5_05_shot_6, vb_ch5_02_shot_7, vb_ch5_03_shot_7, vb_ch5_06_shot_7, vb_ch5_01_shot_8, vb_ch5_02_shot_8, vb_ch5_05_shot_8, vb_ch5_06_shot_8, vb_ch5_03_shot_9, vb_ch5_05_shot_9, vb_ch5_01_shot_10, vb_ch5_02_shot_10, vb_ch5_03_shot_10, vb_ch5_04_shot_10, vb_ch5_06_shot_10, vb_ch5_02_shot_11, vb_ch5_05_shot_11, vb_ch5_06_shot_11
- Minimum similarity to representative: 0.885
- Meaningful dynamic intent variation: yes
- References reused: 15bd351f-9c73-4c18-9331-94ca09ef9435
- Result URLs: none

Common prompt lines:
```text
[SCENE TASK]
[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.
[COMPOSITION]
Focal point: atmosphere.
[CURRENT ACTION / CONTENT]
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.
[SEMANTIC REQUIREMENTS]
MUST SHOW: Ocean mixed-layer; Atmosphere heat reservoir; Geothermal flux labeled much smaller than solar
MUST NOT SHOW: Animation of the whole planet freezing solid within seconds
[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```

What changes:
```text
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.: The instant the Sun's beam stops, Earth starts losing energy to space,
---
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.: but that loss is resisted by big thermal reservoirs.
---
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.: First, the atmosphere holds heat like a blanket: radiative cooling begins immediately but the air's heat capacity and vertical mixing mean surface temperatures fall only modestly in the first hours.
---
Progressively reveal the next part of this explanation (2/2): First, the atmosphere holds heat like a blanket: radiative cooling begins immediately but the air's heat capacity and vertical mixing mean surface temperatures fall only modestly in the first hours.
---
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.: Second, land surfaces release stored warmth more slowly .
---
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.: soils and rocks radiate and conduct heat downward over days to weeks.
---
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.: Third, the ocean mixed layer (the top tens of metres that exchange heat with the atmosphere) is a very large heat bank: its heat is drawn out over months to years,
---
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.: so coastal and sea-surface temperatures lag far behind the first atmospheric dip.
---
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.: Geothermal heat exists but is tiny compared to former solar input,
---
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.: so it cannot replace the Sun and deep cooling is ultimately inevitable.
---
Layer maps and cross-sections showing atmosphere, land, and mixed-layer ocean cooling over hours, days, months with arrows indicating heat flow and insulation.: Precise regional numbers require full climate or mixed-layer model runs.
```


### Near-F — 8 shots

- Shots: 36, 37, 38, 39, 40, 41, 42, 43
- IDs: vb_ch3_03_shot_1, vb_ch3_03_shot_2, vb_ch3_03_shot_3, vb_ch3_03_shot_4, vb_ch3_03_shot_5, vb_ch3_03_shot_6, vb_ch3_03_shot_7, vb_ch3_03_shot_8
- Minimum similarity to representative: 0.931
- Meaningful dynamic intent variation: yes
- References reused: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/d14adad8-e8af-4fcb-821c-1f82f1203fbd-overlay.png, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/00122ac7-366e-49fb-b6ea-966b17f471d2-overlay.png, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/6871bd7b-fc16-4669-b0a3-7ad626d38666.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/03675734-3f1d-4d80-acbe-37bc036e3acc-overlay.png, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/d18f0604-72fc-4ee4-a2f4-49c0a3a2fb01.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/a9b9d1bb-339d-4a6b-b0ef-31896bcaac79.jpg

Common prompt lines:
```text
[SCENE TASK]
[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.
[COMPOSITION]
Focal point: power grid.
[CURRENT ACTION / CONTENT]
Layer a short timeline graphic while showing a PV array tripping, plant leaves closing slightly, and a twilight horizon, so viewers can feel the seconds ticking.
[WORLD STATE]
- pv_output: producing
- grid_status: stable
[SEMANTIC REQUIREMENTS]
MUST SHOW: PV inverters tripping; Leaf fluorescence trace collapsing; Timeline graphic with buckets labeled
MUST NOT SHOW: Human-scale infrastructure failing instantly without intermediate seconds-scale effects
[TEXT-SAFE COMPOSITION]
Leave clear, uncluttered visual space (upper or lower third) for a text overlay to be added afterward. Do not render any title, caption or heading yourself.
[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```

What changes:
```text
Layer a short timeline graphic while showing a PV array tripping, plant leaves closing slightly, and a twilight horizon, so viewers can feel the seconds ticking.: Inside a few seconds to a few minutes, machines and biological systems react.
---
Layer a short timeline graphic while showing a PV array tripping, plant leaves closing slightly, and a twilight horizon, so viewers can feel the seconds ticking.: Grid-connected inverters and protective relays that rely on solar input typically detect a sudden loss and can trip or change modes on timescales of under a handful of seconds, which can create immediate frequency and voltage excursions on the power grid.
---
Progressively reveal the next part of this explanation (2/2): Grid-connected inverters and protective relays that rely on solar input typically detect a sudden loss and can trip or change modes on timescales of under a handful of seconds, which can create immediate frequency and voltage excursions on the power grid.
---
Layer a short timeline graphic while showing a PV array tripping, plant leaves closing slightly, and a twilight horizon, so viewers can feel the seconds ticking.: At the same time, the tiny molecular machinery of photosynthesis shuts down extremely fast .
---
Layer a short timeline graphic while showing a PV array tripping, plant leaves closing slightly, and a twilight horizon, so viewers can feel the seconds ticking.: electron transport and fluorescence signals collapse in milliseconds to seconds .
---
Layer a short timeline graphic while showing a PV array tripping, plant leaves closing slightly, and a twilight horizon, so viewers can feel the seconds ticking.: while whole-leaf adjustments like stomatal movement take tens of seconds to minutes to begin responding.
---
Layer a short timeline graphic while showing a PV array tripping, plant leaves closing slightly, and a twilight horizon, so viewers can feel the seconds ticking.: Those device- and plant-level timescales give us a practical short-window timeline: 0–1 s for beam loss and detector response, 1–10 s for fast electronic and biochemical transients, 10 s–1 min for twilight and early biological adjustment, and 1–10 min for short thermal and grid stabilization steps.
---
Progressively reveal the next part of this explanation (2/2): Those device- and plant-level timescales give us a practical short-window timeline: 0–1 s for beam loss and detector response, 1–10 s for fast electronic and biochemical transients, 10 s–1 min for twilight and early biological adjustment, and 1–10 min for short thermal and grid stabilization steps.
```


### Near-M — 8 shots

- Shots: 206, 207, 208, 209, 210, 211, 212, 214
- IDs: vb_ch7_s13_01_shot_1, vb_ch7_s13_01_shot_2, vb_ch7_s13_01_shot_3, vb_ch7_s13_01_shot_4, vb_ch7_s13_01_shot_5, vb_ch7_s13_01_shot_6, vb_ch7_s13_01_shot_7, vb_ch7_s13_01_shot_9
- Minimum similarity to representative: 0.947
- Meaningful dynamic intent variation: yes
- References reused: 789d8566-b30d-4268-ba8e-fcebe2c60128
- Result URLs: none

Common prompt lines:
```text
[SCENE TASK]
story scene shot. Finished 2D documentary scene; never a reference sheet, model sheet, turnaround, multi-view panel, or plain studio board.
[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary: Bold 2D illustrated documentary style — thick confident outlines, rounded cartoon forms, and a restrained flat-shaded palette. Do not: not hyper-realistic / photographic; not childish preschool cartoon; not generic corporate flat vector art; no 3D-render look; no anime/manga stylization.
[COMPOSITION]
Focal point: Earth.
[CURRENT ACTION / CONTENT]
Close on a calm shot of Earth half in shadow, while overlaying the three-mechanism map and a few practical takeaways about what matters first.
[CHARACTERS PRESENT]
Plants (crops, forests, phytoplankton): A set of recurring plant depictions including: (a) crop row (broadleaf vegetables/cereals) with discrete leaves and sheathes, (b) a temperate-forest canopy silhouette with varied tree crowns, and (c) stylized marine phytoplankton as planktonic green chlorophyll patches in water. Visual indicators of physiological response: leaf-level chlorophyll fluorescence (brief red emission) and stomatal pore schematic on leaves. Render species with botanical realism (correct leaf venation, canopy layering) but simplified for clarity.. Match supplied isolated reference; preserve identity, not its pose.
[LOCATION]
Earth (daylit hemisphere)
[SEMANTIC REQUIREMENTS]
MUST SHOW: Earth with terminator; Three-mechanism summary graphic
MUST NOT SHOW: Conclusive survival time claims without caveats
[RENDER RULES]
Colored illustration. Blank or abstract displays; no readable text. Exact lettering is composited later.
```

What changes:
```text
Close on a calm shot of Earth half in shadow, while overlaying the three-mechanism map and a few practical takeaways about what matters first.: One last perspective: the first minutes look like almost nothing happened, and that's the point.
---
Close on a calm shot of Earth half in shadow, while overlaying the three-mechanism map and a few practical takeaways about what matters first.: The physics buys us that time because information can't travel faster than light.
---
Close on a calm shot of Earth half in shadow, while overlaying the three-mechanism map and a few practical takeaways about what matters first.: After that, darkness hits fast for direct light, machines and plants react quickly, temperatures fall more slowly because of stored heat, and orbital motion simply follows Newton's prescription once the central pull is removed.
---
Move attention to a closer detail within the same setup: After that, darkness hits fast for direct light, machines and plants react quickly, temperatures fall more slowly because of stored heat, and orbital motion simply follows Newton's prescription once the central pull is removed.
---
Close on a calm shot of Earth half in shadow, while overlaying the three-mechanism map and a few practical takeaways about what matters first.: Whether communities survive for years depends on the choices and technologies we already have .
---
Close on a calm shot of Earth half in shadow, while overlaying the three-mechanism map and a few practical takeaways about what matters first.: batteries, continuous power sources, food reserves and resilient logistics — not on any sudden miracle.
---
Close on a calm shot of Earth half in shadow, while overlaying the three-mechanism map and a few practical takeaways about what matters first.: The real takeaway is a clean mental map: timescales are set by signal speed, by inertia in motion, and by heat and biological buffers.
---
Move attention to a closer detail within the same setup: With that map you can judge for yourself what would be urgent in the first seconds, what could be managed in the first days, and what would become a long-term engineering and ecological problem.
```


### Near-A — 7 shots

- Shots: 1, 2, 3, 4, 5, 6, 7
- IDs: vb1_shot_1, vb1_shot_2, vb1_shot_3, vb1_shot_4, vb1_shot_5, vb1_shot_6, vb1_shot_7
- Minimum similarity to representative: 0.944
- Meaningful dynamic intent variation: yes
- References reused: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/cc7941b5-1c0b-4cbe-a53c-f5396637387c.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/caf9f117-01e7-4c4b-af0a-b72d301f32d4.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/e9006fec-2e66-4c81-8307-da37058f4b7f.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/8600a99d-57fe-4bec-a75f-a5771b11144b.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/44959091-08c3-45fb-b6fd-f413f0151fb7.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/9dc1f82b-2334-4318-86eb-761e8d45aea7.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/13889f90-d753-48ef-b70f-9c11cfedeaa8.jpg

Common prompt lines:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.
[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.
[COMPOSITION]
Focal point: Earth.
[CURRENT ACTION / CONTENT]
Show Earth in daylight, then the Sun's disk suddenly missing, and present the three visceral questions to set stakes and create curiosity.
[LOCATION]
Earth (daylit hemisphere)
[WORLD STATE]
- timeOfDay: daylight_hemisphere
- sun_disk_visible: true
[SEMANTIC REQUIREMENTS]
MUST SHOW: Earth in daylight; Sun's disk visually removed; Three question captions (feel it? freeze? fly away?)
MUST NOT SHOW: Explosive or cinematic destruction of the Sun; Immediate visual of Earth being flung away
[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```

What changes:
```text
Show Earth in daylight, then the Sun's disk suddenly missing, and present the three visceral questions to set stakes and create curiosity.: Picture yourself outside on a perfect, sunlit day .
---
Show Earth in daylight, then the Sun's disk suddenly missing, and present the three visceral questions to set stakes and create curiosity.: then the Sun’s disk in the sky is simply gone.
---
Show Earth in daylight, then the Sun's disk suddenly missing, and present the three visceral questions to set stakes and create curiosity.: Do we immediately drop off the planet? Freeze in an instant?
---
Show Earth in daylight, then the Sun's disk suddenly missing, and present the three visceral questions to set stakes and create curiosity.: Do the planets scatter like shrapnel? We'll follow a physical clock .
---
Show Earth in daylight, then the Sun's disk suddenly missing, and present the three visceral questions to set stakes and create curiosity.: seconds, minutes, hours, days, months and years .
---
Show Earth in daylight, then the Sun's disk suddenly missing, and present the three visceral questions to set stakes and create curiosity.: and at each tick show the mechanism that controls that timescale: the finite travel time of signals from the Sun, Earth's thermal inertia that slows cooling, and orbital inertia that governs motion once the Sun's pull no longer arrives.
---
Move attention to a closer detail within the same setup: and at each tick show the mechanism that controls that timescale: the finite travel time of signals from the Sun, Earth's thermal inertia that slows cooling, and orbital inertia that governs motion once the Sun's pull no longer arrives.
```


### Near-D — 7 shots

- Shots: 22, 23, 24, 25, 26, 27, 28
- IDs: vb_ch3_01_shot_1, vb_ch3_01_shot_2, vb_ch3_01_shot_3, vb_ch3_01_shot_4, vb_ch3_01_shot_5, vb_ch3_01_shot_6, vb_ch3_01_shot_7
- Minimum similarity to representative: 0.936
- Meaningful dynamic intent variation: yes
- References reused: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/da398d6a-5626-4064-9b66-6436de68df04.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/28c51355-0759-416e-b199-1d9610330d22.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/8685f64f-4464-4c5c-9350-f65f100fbcbe.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/abd389c9-fa93-48c0-b681-f208edc03a14.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/544c0dee-b27d-432f-bd6c-d89d625e41ae.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/868fa5d9-ba04-46ce-8d41-bcff788ed8b7.jpg

Common prompt lines:
```text
[SCENE TASK]
story scene shot for a 2D animated documentary. This is a finished cinematic scene, NOT a character reference sheet or model sheet — do not arrange multiple views/panels, do not use a plain studio background, do not compose a turnaround.
[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.
[COMPOSITION]
Focal point: PV panel.
[CURRENT ACTION / CONTENT]
Show a literal beam of sunlight cutting off, camera sensor trace and PV output falling to zero in under a second.
[WORLD STATE]
- direct_beam: on
- timeOfDay: daylight
[SEMANTIC REQUIREMENTS]
MUST SHOW: PV output trace dropping; Camera sensor response trace; Flat shading of surfaces as direct-beam disappears
MUST NOT SHOW: Gradual seconds-long dimming of direct sun (this is essentially instantaneous)
[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```

What changes:
```text
Show a literal beam of sunlight cutting off, camera sensor trace and PV output falling to zero in under a second.: Now fast forward eight minutes and nineteen seconds .
---
Show a literal beam of sunlight cutting off, camera sensor trace and PV output falling to zero in under a second.: the last photons from the Sun reach you, then stop.
---
Show a literal beam of sunlight cutting off, camera sensor trace and PV output falling to zero in under a second.: The first thing that happens is not a slow fade but an abrupt end to direct sunlight.
---
Show a literal beam of sunlight cutting off, camera sensor trace and PV output falling to zero in under a second.: That means surfaces lose the Sun’s beam and camera sensors, photovoltaic cells and the human eye's direct input all drop essentially to zero on sub‑second timescales.
---
Move attention to a closer detail within the same setup: That means surfaces lose the Sun’s beam and camera sensors, photovoltaic cells and the human eye's direct input all drop essentially to zero on sub‑second timescales.
---
Show a literal beam of sunlight cutting off, camera sensor trace and PV output falling to zero in under a second.: Electrical instruments that rely on sunlight react as fast as their electronics allow.
---
Show a literal beam of sunlight cutting off, camera sensor trace and PV output falling to zero in under a second.: to our senses, the sun's beam is effectively gone immediately when the last photons stop arriving.
```


### Near-L — 7 shots

- Shots: 197, 198, 200, 201, 202, 204, 205
- IDs: vb_ch7_s12_01_shot_1, vb_ch7_s12_01_shot_2, vb_ch7_s12_01_shot_4, vb_ch7_s12_01_shot_5, vb_ch7_s12_01_shot_6, vb_ch7_s12_01_shot_8, vb_ch7_s12_01_shot_9
- Minimum similarity to representative: 0.912
- Meaningful dynamic intent variation: yes
- References reused: none
- Result URLs: none

Common prompt lines:
```text
[SCENE TASK]
[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.
[COMPOSITION]
Focal point: Earth.
[CURRENT ACTION / CONTENT]
Consolidate earlier visuals into a single layered timeline from 0 seconds to years, tying each timescale to its physical mechanism.
[LOCATION]
Earth (daylit hemisphere)
[SEMANTIC REQUIREMENTS]
MUST SHOW: Layered timeline from seconds → minutes → hours → days → months → years; Mechanism labels: signal speed, inertia, thermal mass, N-body sensitivity
MUST NOT SHOW: Any unsupported precise numeric freezing time for entire oceans
[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```

What changes:
```text
Consolidate earlier visuals into a single layered timeline from 0 seconds to years, tying each timescale to its physical mechanism.: Here's a compact timeline to keep in your head.
---
Consolidate earlier visuals into a single layered timeline from 0 seconds to years, tying each timescale to its physical mechanism.: First: nothing changes locally for about eight minutes .
---
Consolidate earlier visuals into a single layered timeline from 0 seconds to years, tying each timescale to its physical mechanism.: Instruments and PV drop almost instantly, inverters/protections act in seconds and operator/reserve responses play out over minutes.
---
Consolidate earlier visuals into a single layered timeline from 0 seconds to years, tying each timescale to its physical mechanism.: photosynthesis collapses at molecular speed while whole plants and crops adjust over minutes to days.
---
Consolidate earlier visuals into a single layered timeline from 0 seconds to years, tying each timescale to its physical mechanism.: Thermally, temperatures begin falling immediately but do so over hours, days and then months because air, land and the ocean mixed layer store heat.
---
Consolidate earlier visuals into a single layered timeline from 0 seconds to years, tying each timescale to its physical mechanism.: The long‑term rearrangement of the Solar System — captures, escapes, collisions .
---
Consolidate earlier visuals into a single layered timeline from 0 seconds to years, tying each timescale to its physical mechanism.: is plausible but sensitive and requires N‑body modeling to predict.
```


### Near-G — 6 shots

- Shots: 45, 46, 47, 49, 50, 51
- IDs: vb_ch4_01_shot_2, vb_ch4_01_shot_3, vb_ch4_01_shot_4, vb_ch4_01_shot_6, vb_ch4_01_shot_7, vb_ch4_01_shot_8
- Minimum similarity to representative: 0.934
- Meaningful dynamic intent variation: yes
- References reused: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/0dff33c2-471a-4019-83b1-3992cbaf2dbb-overlay.png, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/b51b019a-7d8a-4fb6-a7e7-34d1ca3a3f5f-overlay.png, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/5b272aad-9b86-49e7-b8fb-92294ae64afa.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/e9f0efbb-465d-4318-8497-91f9aceab203.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/c5abb470-62cf-4347-a0ea-c3a7c4c26c80.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/1a120cf5-cd42-4d0a-ba9b-043cbe21d65f.jpg

Common prompt lines:
```text
[SCENE TASK]
[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.
[COMPOSITION]
Focal point: Earth.
[CURRENT ACTION / CONTENT]
Show Earth's orbit path then switch to a tangent straight-line trajectory at the moment gravity change arrives, with distance labels (≈15,000 km in ~8 min).
[LOCATION]
Earth (daylit hemisphere)
[WORLD STATE]
- frame_of_reference: heliocentric_fixed
[SEMANTIC REQUIREMENTS]
MUST SHOW: Orbit-to-tangent transition; Label with Earth speed ≈29.8 km/s and distance ≈15,000 km
MUST NOT SHOW: Immediate explosion or chaotic scattering at the moment signal arrives
[TEXT-SAFE COMPOSITION]
Leave clear, uncluttered visual space (upper or lower third) for a text overlay to be added afterward. Do not render any title, caption or heading yourself.
[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```

What changes:
```text
Show Earth's orbit path then switch to a tangent straight-line trajectory at the moment gravity change arrives, with distance labels (≈15,000 km in ~8 min).: remove that force and they stop curving and coast straight. Concretely, Earth moves at ≈29.8 km/s,
---
Show Earth's orbit path then switch to a tangent straight-line trajectory at the moment gravity change arrives, with distance labels (≈15,000 km in ~8 min).: so in the roughly 499‑second signal delay it travels about 15,000 km along its orbit.
---
Show Earth's orbit path then switch to a tangent straight-line trajectory at the moment gravity change arrives, with distance labels (≈15,000 km in ~8 min).: in one hour it would traverse ≈107,000 km.
---
Progressively reveal the next part of this explanation (2/2): When the gravitational change finally reaches Earth, the instantaneous acceleration toward the Sun vanishes and Earth's path becomes a straight-line tangent to its previous orbit at that location.
---
Show Earth's orbit path then switch to a tangent straight-line trajectory at the moment gravity change arrives, with distance labels (≈15,000 km in ~8 min).: That doesn't fling Earth outward in an explosion .
---
Show Earth's orbit path then switch to a tangent straight-line trajectory at the moment gravity change arrives, with distance labels (≈15,000 km in ~8 min).: it simply converts curved orbital motion into inertial straight-line motion at the velocity it already had.
```


### Near-C — 5 shots

- Shots: 15, 16, 17, 19, 21
- IDs: vb_ch2_01_shot_1, vb_ch2_01_shot_2, vb_ch2_01_shot_3, vb_ch2_01_shot_5, vb_ch2_01_shot_7
- Minimum similarity to representative: 0.932
- Meaningful dynamic intent variation: yes
- References reused: 15bd351f-9c73-4c18-9331-94ca09ef9435
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/9e9a7bf0-d225-4fd0-99c0-349ceae85e66-overlay.png, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/long-form/scenes/81d37b30-8cf7-4421-91bc-a74c74af1781-overlay.png

Common prompt lines:
```text
[SCENE TASK]
[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.
[COMPOSITION]
Focal point: Earth.
[CURRENT ACTION / CONTENT]
Show light rays and gravitational field lines propagating from the Sun to Earth with an 8:19 timer, emphasizing the causal delay.
[WORLD STATE]
- timeOfDay: not_applicable
- signal_in_transit: present
[SEMANTIC REQUIREMENTS]
MUST SHOW: Light-time label ≈8:19; Animation of signals traveling from Sun to Earth
MUST NOT SHOW: Any depiction of instantaneous change at Earth when the Sun vanishes
[TEXT-SAFE COMPOSITION]
Leave clear, uncluttered visual space (upper or lower third) for a text overlay to be added afterward. Do not render any title, caption or heading yourself.
[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```

What changes:
```text
Show light rays and gravitational field lines propagating from the Sun to Earth with an 8:19 timer, emphasizing the causal delay.: If the Sun were to vanish this instant, Earth wouldn't register it for about 499 seconds — roughly 8 minutes 19 seconds .
---
Show light rays and gravitational field lines propagating from the Sun to Earth with an 8:19 timer, emphasizing the causal delay.: because information (light or changes in gravity) has to travel here.
---
Show light rays and gravitational field lines propagating from the Sun to Earth with an 8:19 timer, emphasizing the causal delay.: Practically that means: photons already en route keep lighting our skies until that delay elapses,
---
Show light rays and gravitational field lines propagating from the Sun to Earth with an 8:19 timer, emphasizing the causal delay.: During those eight minutes nothing at the Sun can causally change what we see or feel here, so the planet carries on .
---
Show light rays and gravitational field lines propagating from the Sun to Earth with an 8:19 timer, emphasizing the causal delay.: until the trailing edge of that information finally arrives.
```


### Near-E — 5 shots

- Shots: 30, 31, 32, 34, 35
- IDs: vb_ch3_02_shot_2, vb_ch3_02_shot_3, vb_ch3_02_shot_4, vb_ch3_02_shot_6, vb_ch3_02_shot_7
- Minimum similarity to representative: 0.916
- Meaningful dynamic intent variation: yes
- References reused: 9278a91a-0b92-4c3d-b88b-15c413242b5b
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/b3a41cdf-a89e-430a-9664-44bbc6ae2644.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/2afb2459-824f-47e4-8cd0-1a52ead23d87.jpg, https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/da62ce3e-70f0-48a7-92ad-c1927e8a7852.jpg

Common prompt lines:
```text
[SCENE TASK]
[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.
[COMPOSITION]
Focal point: atmosphere.
[CURRENT ACTION / CONTENT]
Show gradual dimming of sky brightness from daylight toward twilight over seconds-to-minutes with different skies (hazy, clear, polluted).
[LOCATION]
Local sky / atmosphere
[WORLD STATE]
- solar_elevation: variable
- aerosol_load: variable
[SEMANTIC REQUIREMENTS]
MUST SHOW: Animated scattering particles; Sky brightness curve over time
MUST NOT SHOW: Instant full darkness the moment direct-beam stops
[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```

What changes:
```text
Show gradual dimming of sky brightness from daylight toward twilight over seconds-to-minutes with different skies (hazy, clear, polluted).: The atmosphere scatters sunlight .
---
Show gradual dimming of sky brightness from daylight toward twilight over seconds-to-minutes with different skies (hazy, clear, polluted).: Rayleigh scattering off molecules and Mie scattering from aerosols — so diffuse skylight persists.
---
Show gradual dimming of sky brightness from daylight toward twilight over seconds-to-minutes with different skies (hazy, clear, polluted).: That gives us a twilight-like decay that can last from tens of seconds up to many minutes, and in very clear, low‑light places it can take tens of minutes before you reach true night.
---
Show gradual dimming of sky brightness from daylight toward twilight over seconds-to-minutes with different skies (hazy, clear, polluted).: How long depends on where the Sun was in the sky, how dusty the air is, and local light pollution.
---
Show gradual dimming of sky brightness from daylight toward twilight over seconds-to-minutes with different skies (hazy, clear, polluted).: So there’s an abrupt loss of direct sun, layered on top of a slower decay of sky brightness.
```


### Near-K — 5 shots

- Shots: 191, 192, 193, 195, 196
- IDs: vb_ch7_s11_01_shot_2, vb_ch7_s11_01_shot_3, vb_ch7_s11_01_shot_4, vb_ch7_s11_01_shot_6, vb_ch7_s11_01_shot_7
- Minimum similarity to representative: 0.934
- Meaningful dynamic intent variation: yes
- References reused: none
- Result URLs: none

Common prompt lines:
```text
[SCENE TASK]
[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.
[COMPOSITION]
Focal point: planets.
[CURRENT ACTION / CONTENT]
Show a montage: darkened satellites, planets drifting on new paths, and an overlay explaining that N-body simulations are needed for long-term predictions.
[WORLD STATE]
- timeOfDay: not_applicable
- signal_in_transit: present
[SEMANTIC REQUIREMENTS]
MUST SHOW: Satellites losing sunlight; Schematic of planets interacting over long timescales; Caption about N-body sensitivity
MUST NOT SHOW: A single definitive billions-of-years future trajectory
[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```

What changes:
```text
Show a montage: darkened satellites, planets drifting on new paths, and an overlay explaining that N-body simulations are needed for long-term predictions.: batteries and thermal control then set how long systems limp on.
---
Show a montage: darkened satellites, planets drifting on new paths, and an overlay explaining that N-body simulations are needed for long-term predictions.: On planetary scales, removing the Sun's central force leaves the system in a delicate new balance: planets, moons and asteroids still interact with one another, and those mutual tugs — not a single dominant central mass — drive the long‑term evolution.
---
Progressively reveal the next part of this explanation (2/2): On planetary scales, removing the Sun's central force leaves the system in a delicate new balance: planets, moons and asteroids still interact with one another, and those mutual tugs — not a single dominant central mass — drive the long‑term evolution.
---
Show a montage: darkened satellites, planets drifting on new paths, and an overlay explaining that N-body simulations are needed for long-term predictions.: which of those plays out depends strongly on the exact geometry and timing of how the Sun's influence ended.
---
Show a montage: darkened satellites, planets drifting on new paths, and an overlay explaining that N-body simulations are needed for long-term predictions.: Trustworthy predictions require dedicated N‑body integrations because small differences in initial conditions amplify over time, and we don't present numerical long‑term forecasts here.
```


### Near-B — 3 shots

- Shots: 10, 11, 12
- IDs: vb2_shot_2, vb2_shot_3, vb2_shot_4
- Minimum similarity to representative: 0.930
- Meaningful dynamic intent variation: yes
- References reused: 15bd351f-9c73-4c18-9331-94ca09ef9435
- Result URLs: none

Common prompt lines:
```text
[SCENE TASK]
[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.
[COMPOSITION]
Focal point: Earth.
[CURRENT ACTION / CONTENT]
Contrast cinematic tropes (instant catastrophe) with the measured, finite delay of light and gravity to reframe expectations.
[SEMANTIC REQUIREMENTS]
MUST SHOW: On-screen timer ~8:19; Split-screen: movie chaos vs calm physical diagram with delay
MUST NOT SHOW: Any footage implying instantaneous gravitational effect
[TEXT-SAFE COMPOSITION]
Leave clear, uncluttered visual space (upper or lower third) for a text overlay to be added afterward. Do not render any title, caption or heading yourself.
[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```

What changes:
```text
Contrast cinematic tropes (instant catastrophe) with the measured, finite delay of light and gravity to reframe expectations.: oceans leaping off Earth, people flung into space, an immediate global freeze — but the physics disagrees.
---
Contrast cinematic tropes (instant catastrophe) with the measured, finite delay of light and gravity to reframe expectations.: The reason is concrete: light from the Sun takes about 8 minutes 19 seconds to reach us (varying by ±~9 s through the year), and changes in gravity propagate at the same finite speed.
---
Progressively reveal the next part of this explanation (2/2): The reason is concrete: light from the Sun takes about 8 minutes 19 seconds to reach us (varying by ±~9 s through the year), and changes in gravity propagate at the same finite speed.
```


### Near-H — 3 shots

- Shots: 52, 54, 56
- IDs: vb_ch4_02_shot_1, vb_ch4_02_shot_3, vb_ch4_02_shot_5
- Minimum similarity to representative: 0.925
- Meaningful dynamic intent variation: yes
- References reused: none
- Result URLs: https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/runware/images/02edac87-0b8d-42e1-b398-4e951b95d91f.jpg

Common prompt lines:
```text
[SCENE TASK]
[STYLE LOCK]
STYLE LOCK — Classic 2D Documentary. Colored 2D documentary illustration. Linework: confident black silhouette outlines, finer interior lines. Shading: flat cel shading, 1–2 tonal steps; no gradients. Texture: subtle uniform paper grain. Palette: 2–4 restrained colored hues plus neutrals, never uncolored line art. Proportions: rounded simplified adult forms, expressive economical faces, not chibi. Lighting: motivated directional light, soft shadows. Perspective: coherent one/two-point, grounded eye level. Do not: photographic realism, 3D, anime, preschool cartoon or corporate vector art.
[COMPOSITION]
Focal point: Earth.
[CURRENT ACTION / CONTENT]
Show Earth and Moon remaining bound, then pull back to a chaotic N-body cloud suggesting long-term uncertainty and the need for simulations.
[LOCATION]
Earth (daylit hemisphere)
[WORLD STATE]
- frame_of_reference: heliocentric_fixed
[SEMANTIC REQUIREMENTS]
MUST SHOW: Moon staying near Earth immediately; Graphic note about N-body sensitivity
MUST NOT SHOW: A definitive long-term trajectory for the Moon
[RENDER RULES]
Colored illustration, never uncolored line art or a monochrome technical plate. Never a character reference sheet or turnaround. Displays stay blank or abstract; exact lettering is added afterward.
```

What changes:
```text
Show Earth and Moon remaining bound, then pull back to a chaotic N-body cloud suggesting long-term uncertainty and the need for simulations.: The Moon is close enough that short-term dynamics keep it bound to Earth.
---
Show Earth and Moon remaining bound, then pull back to a chaotic N-body cloud suggesting long-term uncertainty and the need for simulations.: so immediately after the Sun's influence is gone the Moon stays in Earth orbit rather than flying away. Over longer timescales — centuries to millennia .
---
Show Earth and Moon remaining bound, then pull back to a chaotic N-body cloud suggesting long-term uncertainty and the need for simulations.: Those long-term possibilities (slow drift inward or outward, temporary capture, or eventual escape) are highly sensitive to small changes in geometry and timing.
```

