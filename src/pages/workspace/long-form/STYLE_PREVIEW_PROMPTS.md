# Style Picker — preview asset generation prompts

**Status: DONE.** All 6 generated (Nano Banana 2, 2K) and wired in —
`src/assets/longform/*.png`, imported by `stylePresets.js` as each preset's
`previewAsset`, rendered by `PreviewSwatch` in `StylePicker.jsx`. This file
is kept as the historical record of exactly which prompt produced which
asset, in case a preset's artwork ever needs regenerating (e.g. a v2 prompt
revision — see PART 19 of the milestone on preset versioning).

Canonical prompt set for the 6 launch StylePresets' card preview images.
These are curated, static, one-time product assets — generated once, never
regenerated per request (see stylePresets.js's own comment on this).

**Generation settings used:** Runware, model `Nano Banana 2` (airTag
`google:4@3`, `src/lib/providers.ts`'s `image:nano.2` / `image:twoam2k` tool
key), **2K** resolution tier (`costUSD: 0.06923` each — 6 images ≈
**$0.4154** total), 16:9 aspect ratio.

---

## bold_cartoon_documentary — Classic 2D Documentary

16:9 widescreen illustration, a Viking sailor standing on the open deck of a wooden Norse longship in a freezing North Atlantic winter, rough dark-blue sea, distant icy coastline, several crew members working behind him, wool cloaks, shields fixed along the ship rail, cold wind and light sea spray, worried but determined facial expression.

STYLE: classic 2D documentary cartoon, thick confident black outlines, rounded simplified character forms, expressive but readable faces, flat natural colors, restrained cel shading, moderately detailed historical environment, strong silhouettes, clean shapes, slightly humorous but still serious educational documentary tone, highly readable YouTube explainer artwork.

Composition: medium-wide cinematic framing, main Viking clearly readable in foreground, ship and crew visible behind him, horizon in upper third, uncluttered focal hierarchy.

No text, no captions, no logos, no watermark, no photorealism, no 3D render, no anime.

---

## simple_outline_explainer — Simple Story Cartoon

**Final/replacement prompt (stick-figure framing — supersedes the original draft below):**

16:9 widescreen 2D stickman explainer illustration.

Scene: a Viking sailor standing on the open deck of a wooden Norse longship during a freezing North Atlantic winter. Rough dark-blue ocean, distant icy coastline, several simplified crew members behind him, shields attached along the ship rail, cold wind and sea spray.

STYLE: ultra-simple 2D stickman educational explainer.

Characters use extremely simple stick-figure anatomy:
round heads,
simple black line arms and legs,
very basic torso shapes,
tiny dot eyes,
minimal mouth expressions,
no realistic anatomy,
no detailed hands or fingers.

The main Viking remains clearly identifiable using only a few simple visual traits:
basic brown beard shape,
simple Viking-era wool tunic and cloak represented with flat geometric shapes,
small simplified belt,
very simple hair silhouette.

Use thin-to-medium clean dark outlines, flat colors, almost zero shading, minimal texture, simple geometric props, simplified environmental layers, highly readable silhouettes, clear visual storytelling, clean modern faceless-YouTube explainer aesthetic.

Background should also remain deliberately simple:
flat layered ocean,
basic wooden ship geometry,
simple shields,
minimal clouds and distant ice shapes.

Composition: medium-wide 16:9 shot, main stickman Viking clearly readable in foreground, crew and ship behind him, strong separation between foreground, ship, sea and sky.

Professional educational illustration, deliberately simple and highly consistent rather than childish.

No text, no captions, no typography, no logos, no watermark, no photorealism, no 3D, no anime, no detailed anatomy, no complex painterly texture.

<details>
<summary>Original draft prompt (superseded, kept for reference only)</summary>

16:9 widescreen illustration, a Viking sailor standing on the open deck of a wooden Norse longship in a freezing North Atlantic winter, rough sea, distant icy coastline, a few crew members behind him, wool clothing, simple shields along the ship rail, cold wind and sea spray.

STYLE: simple story cartoon / outline explainer, thin-to-medium black outlines, extremely simplified anatomy, basic round faces with tiny eyes and simple mouths, minimal facial detail, flat muted colors, almost no shading, very simple props, simplified layered environment, highly consistent character design, extremely clear visual storytelling, lightweight educational YouTube animation aesthetic.

Composition: medium-wide view, main character centered and immediately readable, background simplified into clean layers, strong separation between character, ship, sea and sky.

No text, no captions, no logos, no watermark, no realism, no complex textures, no 3D, no anime.

</details>

---

## polished_vector_cartoon — Bright Modern Cartoon

16:9 widescreen illustration, a Viking sailor on the open deck of a Norse longship during a brutal North Atlantic winter, icy wind, rough blue ocean, distant frozen land, crew members behind him, fur-lined wool clothing, Viking shields along the rail.

STYLE: bright polished modern YouTube cartoon, crisp clean geometric shapes, bold saturated colors, large expressive eyes, polished simplified anatomy, smooth controlled cel shading, glossy highlights, sharp silhouettes, clean vector-like edges, commercial educational animation quality, energetic high-curiosity visual language.

Composition: dynamic medium-wide camera angle, hero Viking large in foreground, dramatic ocean and ship behind him, strong visual hierarchy, thumbnail-quality clarity but without any text.

No text, no typography, no logos, no watermark, no photorealism, no anime, no gritty painterly texture.

---

## wojak_documentary_hybrid — Meme Documentary

16:9 widescreen illustration, a simple recurring Viking protagonist standing on the deck of a Norse longship in freezing North Atlantic weather, rough sea, dark winter sky, distant icy land, historically inspired ship and crew in the background.

STYLE: meme documentary / wojak-inspired hybrid, protagonist has an intentionally simple pale face, minimal black line facial features, simple eyes and mouth, flat simplified character rendering, very recognizable recurring silhouette, while the longship, ocean and environment are noticeably richer and more detailed, strong contrast between simple subject and cinematic background, dry internet-documentary visual humor without becoming childish.

Composition: protagonist clearly isolated in foreground, environment tells most of the contextual story, medium-wide 16:9 documentary framing.

No text, no speech bubbles, no memes written on image, no logos, no watermark, no anime, no photorealistic human face.

---

## painterly_storybook_documentary — Illustrated History

16:9 widescreen historical illustration, a Viking sailor standing aboard an open wooden Norse longship in a freezing North Atlantic winter, heavy wool clothing, wet timber deck, shields, rigging, rough grey-blue ocean, distant icy coastline, exhausted crew working behind him, cold mist and sea spray.

STYLE: painterly illustrated-history documentary, textured 2D brushwork, warm natural skin tones contrasted against cold blue-grey environment, semi-realistic anatomy, detailed historical clothing and timber construction, atmospheric lighting, soft painterly edges, subtle canvas texture, cinematic depth, rich but restrained color palette, premium storybook-documentary quality.

Composition: cinematic medium-wide shot, protagonist foreground, layered ship crew and rigging middle ground, cold ocean and horizon background, strong atmosphere and storytelling.

No text, no logos, no watermark, no photo-realism, no 3D CGI, no anime.

---

## documentary_collage — Documentary Collage

16:9 widescreen editorial documentary collage showing a Viking sailor on a Norse longship crossing a freezing North Atlantic sea, crew members, wooden shields, sail and rigging, icy coastline and rough water.

STYLE: documentary paper collage, layered cut-paper characters and objects, slightly imperfect paper edges, archival map fragments subtly integrated into the background, textured paper grain, flat illustrated Viking figures, overlapping documentary elements, subtle drop shadows between layers, restrained historical color palette, editorial magazine composition, intentionally assembled visual language where variation feels designed.

Composition: main Viking as prominent central paper-cut figure, longship as layered midground element, ocean and coastline built from separate paper layers, small map/document fragments used decoratively but with NO readable text.

No readable text, no captions, no logos, no watermark, no photorealistic face, no 3D render, no glossy vector style.
