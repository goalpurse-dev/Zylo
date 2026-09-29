# Zyvo Thumbnail Pack — 50 prompts + the spec

## What we want to see in every thumbnail (the spec for the generator)

**The job of a thumbnail:** stop the scroll in under one second and create a question the viewer *needs* answered. It's judged at 120 px wide on a phone, next to 20 other thumbnails.

**1. One idea, instantly readable.** One clear situation, at most 2 main characters (crowds only as simple repeated shapes). If you can't describe it in 5 words, it's too busy.

**2. Pick one of 6 proven archetypes** (the generator makes 3 options per video, each a DIFFERENT archetype):
- **REACTION** — a character with an extreme emotion (shock, disgust, fear, confusion) reacting to something.
- **VERSUS** — a split frame: two things face off or before/after (myth vs reality, you vs X).
- **DANGER** — a character in obvious peril (predator eyes, sharks, a looming threat).
- **SCALE** — something absurdly big next to something tiny (star vs astronaut, mammoth vs person).
- **REVEAL** — a mystery or a surprising object that raises a question (an empty ship, a dashed missing moon).
- **TRANSFORMATION** — the same character in two states (rich → broke, asleep → awake).

**3. Exaggerated faces.** Thumbnails break the video's dot-eye rule on purpose: big white eyes with pupils, thick angled eyebrows, big mouths. The emotion must read at tiny size. Everything else stays stickman: circle head, stick limbs, mitten hands, torso-only clothing.

**4. Color.** A flat 2–3 tone background that contrasts strongly with the subject (warm subject on a cool background or vice versa). Saturated, no gradients, no clutter.

**5. Composition.** The top third is EMPTY flat background (the headline goes there). The subject fills the bottom two-thirds, large and centered. Nothing important at the very edges (YouTube overlays the duration in the bottom-right corner).

**6. Headline = drawn by Zyvo code, never by the model.** 1–3 words (max 4 for a question), ALL CAPS, usually a question, **never giving the answer**, and **complementing** the title instead of repeating it. Style: Lilita One, yellow fill, thick black outline, ~80% of the width, top third (white fill when the background is yellow/gold).

**7. Consistency with the video.** When the video's Production Bible exists, the thumbnail uses the video's own canonical characters and settings (the same viewer avatar, the same hero), so the thumbnail matches what people then watch.

**8. Never:** text/letters/numbers drawn by the model, real logos or brand mascots, real-person likenesses, gore or wounds, more than 2 main characters, tiny details, misleading clickbait the video doesn't pay off.

**9. How the generator should work:** the script already outputs a `thumbnailConcept`. Upgrade it to 3 concepts `{archetype, headline, scene}` with 3 different archetypes → code assembles [THUMBNAIL HEADER + scene + COMPOSITION/NO-TEXT block] exactly like the prompts below → render (use Nano Banana 2 Lite for ALL tiers: ~$0.034 each, ~$0.10 per video — thumbnails decide clicks) → upscale → code draws the headline → the user picks, downloads at 1920×1080 (and 1280×720).

**10. Auto-checks after render:** the top third is clear (low edge density), the main face is large enough (face area ≥ ~8% of the frame), strong contrast between subject and background, no stray text (OCR). One re-render if a check fails.

To test a prompt in a playground WITH text, append: `HEADLINE TEXT: exactly "<HEADLINE>" in heavy bold rounded all-caps yellow letters with a thick black outline, filling the top third, about 80% of the width.`

---

## Ancient Humans & Prehistory

### 1. FIRST WINTER?  ·  DANGER

**Headline (drawn by code):** `FIRST WINTER?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat deep navy night with a flat pale-blue snow ground band and white snowflake dots. SUBJECT: a hunter-gatherer stickman with a deep warm brown circle head, short coiled black hair, a tan hide wrap on the torso, hugging a small child stickman, both shivering with motion lines and frost on their heads, eyes huge, eyebrows angled up in terror, teeth-chattering zigzag mouths; beside them a pile of cold sticks with no flame; behind them in the dark, four pairs of glowing yellow wolf eyes. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 2. WHO HUNTED WHO?  ·  VERSUS

**Headline (drawn by code):** `WHO HUNTED WHO?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: split by a jagged vertical line: flat golden savanna yellow on the left, flat dusty orange on the right. SUBJECT: LEFT: a small hunter stickman with a deep brown circle head and a tan hide wrap, gripping a thin wooden spear, knees shaking, eyes huge. RIGHT: a giant flat orange sabre-toothed cat with two long white fangs, crouched and grinning hungrily, three times the hunter's size; they stare at each other across the line. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Dark & Brutal History

### 3. WORST PUNISHMENT?  ·  REACTION

**Headline (drawn by code):** `WORST PUNISHMENT?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat deep maroon red with a flat dark-grey medieval town square band at the bottom. SUBJECT: a peasant stickman with a light peach circle head and a patched brown tunic shape, locked in a wooden pillory (head and hands through the board), eyes squeezed, mouth a wobbly wail, a flat red tomato splatting on the board beside his head, two more tomatoes flying in from the edge of the frame. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 4. SURVIVE THE PLAGUE?  ·  DANGER

**Headline (drawn by code):** `SURVIVE THE PLAGUE?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat sickly green-grey with a flat dark leaning-houses silhouette band at the bottom. SUBJECT: a medieval villager stickman with a pale circle head and a brown tunic, backing away in horror with both mitten hands raised, eyes huge, mouth a screaming oval; towering over him, a plague doctor stickman in a long flat black cloak, wide-brimmed hat and a long pale bird-beak mask with round glass eyes, holding a lantern with a flat yellow glow. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Daily Life in Past Eras

### 5. ROMAN TOILETS?  ·  REACTION

**Headline (drawn by code):** `ROMAN TOILETS?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat warm terracotta with a flat cream stone wall. SUBJECT: a long cream stone bench with a row of round holes; three Roman stickmen in white and pale-blue tunic shapes sit side by side; the middle one stares straight at the viewer, eyes huge, eyebrows high, pink blush marks, mouth a tight wavy line, while the two neighbors chat cheerfully; a sponge on a stick leans against the bench. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 6. MEDIEVAL DENTIST?  ·  DANGER

**Headline (drawn by code):** `MEDIEVAL DENTIST?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat mustard yellow with a flat brown wooden floor band. SUBJECT: a patient stickman with a pale circle head and a patched tunic, tied to a wooden chair, eyes enormous with tiny pupils, mouth wide open in a scream, sweat drops flying; in front of him a cheerful barber stickman in a stained apron holding up a giant pair of iron pliers with a grin. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Military & Logistics History

### 7. 30 KM A DAY?  ·  REACTION

**Headline (drawn by code):** `30 KM A DAY?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat bright ochre sky over a flat grey straight stone road. SUBJECT: a Roman legionary stickman with a light tan circle head, a bronze helmet with a red crest and a red tunic shape, bent almost double under a comically huge pack piled with pots, tools and a shovel on a wooden pole, tongue out, sweat drops flying, eyes huge and exhausted; tiny footprints trail behind him to the horizon. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 8. HOW DID THEY EAT?  ·  SCALE

**Headline (drawn by code):** `HOW DID THEY EAT?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat pale khaki with an endless row of flat tiny tents to the horizon. SUBJECT: a cook stickman with a stained apron standing next to one tiny cooking pot, eyes huge, mouth an open oval, staring at a gigantic line of hungry soldier stickmen with empty bowls stretching back to the horizon. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Ancient Medicine & Science

### 9. SKULL SURGERY?  ·  DANGER

**Headline (drawn by code):** `SKULL SURGERY?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat warm orange-terracotta. SUBJECT: a patient stickman with a light peach circle head sitting stiffly, eyes huge with tiny pupils, eyebrows shot up, mouth a wide horrified oval, sweat drops flying; behind him a calm ancient healer stickman with a white beard and a dark-green robe shape, holding a small flint tool near the top of the patient's head with a serene smile; no blood, no wounds. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 10. MOLD CURES?  ·  REACTION

**Headline (drawn by code):** `MOLD CURES?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat pale teal. SUBJECT: an ancient healer stickman in a brown robe shape proudly holding out a piece of bread covered in fuzzy green mold with both mitten hands, smiling; a sick patient stickman in a blanket leans back in disgust, eyes squeezed, tongue out, one hand covering his mouth. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Timeline History

### 11. ALL OF HISTORY?  ·  SCALE

**Headline (drawn by code):** `ALL OF HISTORY?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: hard-edged vertical bands from dusty orange on the left to teal on the right. SUBJECT: a stickman in a mustard-yellow shirt shape sprinting left to right in panic with speed lines, eyes huge, mouth a wide open oval, along a sand-colored path lined with a tiny cave, a pyramid, a castle and a modern skyline. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 12. EVERY EMPIRE?  ·  REVEAL

**Headline (drawn by code):** `EVERY EMPIRE?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat royal purple. SUBJECT: a tall wobbling stack of seven different flat golden crowns balanced on the head of a nervous king stickman in a red robe shape, eyes huge and looking up, knees knocking, the top crowns already tipping over with motion lines. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Myth vs Reality

### 13. FAKE HORNS?  ·  VERSUS

**Headline (drawn by code):** `FAKE HORNS?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: split by a jagged vertical crack: flat glowing gold on the left, flat plain grey on the right. SUBJECT: LEFT: a heroic Viking stickman with a big orange braided beard, a red tunic shape and a helmet with two huge curved horns, chest out, smug grin, the horns crossed out by a bold flat red X. RIGHT: the same Viking with a plain round iron helmet with no horns, staring at the viewer with huge confused eyes and one eyebrow raised. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 14. FLAT EARTH?  ·  REVEAL

**Headline (drawn by code):** `FLAT EARTH?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat night-blue with small white dot stars. SUBJECT: a medieval scholar stickman in a brown robe shape smugly holding up a round blue-and-green globe with one mitten hand; in front of him a crowd of three villager stickmen stares at the globe with huge shocked eyes and dropped jaws. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Psychology & Human Behavior

### 15. OVERTHINKING?  ·  REACTION

**Headline (drawn by code):** `OVERTHINKING?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat deep violet. SUBJECT: a modern stickman with a medium brown circle head, black hair in a low ponytail, a teal hoodie shape, clutching both sides of the head, eyes huge with spiral pupils, mouth a jagged wavy line; exploding upward from the head, a huge tangled flat lavender scribble cloud of looping lines. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 16. WHY YOU PROCRASTINATE?  ·  DANGER

**Headline (drawn by code):** `WHY YOU PROCRASTINATE?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat bright orange. SUBJECT: a modern stickman in a grey t-shirt shape lying on a flat yellow couch scrolling a glowing phone with a relaxed grin, while behind the couch a gigantic flat red alarm clock with angry eyebrows and sharp teeth looms over him, about to pounce. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## The Body Explained

### 17. WHY WE YAWN?  ·  REACTION

**Headline (drawn by code):** `WHY WE YAWN?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat bright mint green. SUBJECT: a modern stickman in a grey t-shirt shape in the middle of an enormous yawn, mouth a giant open oval taking up half the head, eyes squeezed shut, arms stretched up; beside him two smaller stickmen in blue and orange shirt shapes are catching the yawn too. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 18. WHY HICCUPS?  ·  REACTION

**Headline (drawn by code):** `WHY HICCUPS?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat sky blue. SUBJECT: a modern stickman in a red t-shirt shape jolted up into the air mid-hiccup with big motion lines under his feet, eyes huge, cheeks puffed, one mitten hand over his mouth, a small flat white hiccup burst shape beside his mouth. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Sleep, Health & Habits

### 19. 3 AM AGAIN?  ·  REACTION

**Headline (drawn by code):** `3 AM AGAIN?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat dark navy bedroom with a window showing a pale-yellow crescent moon. SUBJECT: a modern stickman in a grey t-shirt shape sitting bolt upright in bed under a lavender blanket, eyes enormous and wide awake with tiny pupils, dark grey bags under the eyes, mouth a flat miserable line; on the bedside table an alarm clock whose display is a plain red glow (no digits). COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 20. TWO SLEEPS?  ·  REVEAL

**Headline (drawn by code):** `TWO SLEEPS?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: split down the middle: flat dark navy on both halves with small white stars. SUBJECT: LEFT: a medieval stickman in a white nightshirt shape asleep in bed. RIGHT: the same stickman wide awake in the middle of the night by a flickering candle, happily reading a book, eyebrows raised cheerfully. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Evolution Quirks

### 21. WHY BACK PAIN?  ·  REACTION

**Headline (drawn by code):** `WHY BACK PAIN?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat warm lilac. SUBJECT: an evolution-march lineup walking left to right: a brown ape, an early human with a hide wrap, an upright hunter with a spear, and at the front, largest, a modern stickman in a teal hoodie shape hunched over a glowing phone, one hand clutching his lower back with bold red pain bursts, mouth a grimacing zigzag. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 22. WHY GOOSEBUMPS?  ·  REACTION

**Headline (drawn by code):** `WHY GOOSEBUMPS?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat icy light blue. SUBJECT: a modern stickman in a tank-top shape shivering with his thin stick arms covered in dozens of tiny flat bumps, his short hair standing straight up like a startled cat's, eyes huge, mouth a wobbly line; a small flat black cat beside him is puffed up in exactly the same pose. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Why Don't We Eat X?

### 23. EAT A LION?  ·  REACTION

**Headline (drawn by code):** `EAT A LION?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat soft sage green. SUBJECT: a modern stickman with a white shirt shape sitting at a small dinner table holding a knife and fork, leaning back in horror, eyes huge, mouth a wide oval; across the table a big flat tawny lion with a dark-brown jagged mane and a white napkin tied around its neck grins slyly, holding its own fork. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 24. EAT A HORSE?  ·  REACTION

**Headline (drawn by code):** `EAT A HORSE?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat warm coral. SUBJECT: a diner stickman with a fork raised freezes mid-bite, eyes huge; a flat brown horse sitting across the small table has a napkin tucked in and giant teary eyes, lower lip trembling, looking betrayed. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Animal Behavior & Predator/Prey

### 25. WHO WINS?  ·  VERSUS

**Headline (drawn by code):** `WHO WINS?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: split: flat golden yellow on the left, flat olive green on the right, a flat white spark burst at the center line. SUBJECT: LEFT: a big flat tawny lion with a dark-brown jagged mane, crouched and snarling. RIGHT: a big flat zebra with bold black stripes rearing up with one hoof raised, eyes wide and defiant; they face each other across the line. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 26. CROWS REMEMBER?  ·  DANGER

**Headline (drawn by code):** `CROWS REMEMBER?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat stormy grey. SUBJECT: a modern stickman in a yellow raincoat shape frozen mid-step, eyes huge, sweat drops flying; on a power line above him a row of seven flat black crows all glare down at him with angry slanted eyebrows. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Survival Scenarios

### 27. 30 DAYS HERE?  ·  DANGER

**Headline (drawn by code):** `30 DAYS HERE?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat bright turquoise ocean under a flat pale-yellow sky. SUBJECT: a tiny round sand island with one green palm tree; on it a modern stickman in a torn grey t-shirt shape with a jagged hem waves both arms frantically, eyes huge, mouth a screaming oval; four dark-grey shark fins circle the island. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 28. LOST AT SEA?  ·  DANGER

**Headline (drawn by code):** `LOST AT SEA?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat deep navy ocean with big flat curling wave shapes. SUBJECT: a stickman in an orange life-jacket shape clinging to a small wooden raft tipping on a huge wave, eyes huge, mouth a wide oval; a flat grey shark fin cuts through the water right beside the raft. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Extinct Animals

### 29. MAMMOTHS RETURN?  ·  SCALE

**Headline (drawn by code):** `MAMMOTHS RETURN?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat pale-blue sky over a flat grey city street with simple building shapes. SUBJECT: a giant woolly mammoth with shaggy brown fur shapes and long white tusks stomping down the street, towering over a tiny modern stickman in a red jacket shape who drops his coffee cup and stares up with huge eyes and a screaming mouth. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 30. BIGGEST SHARK?  ·  SCALE

**Headline (drawn by code):** `BIGGEST SHARK?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat deep ocean blue. SUBJECT: the enormous open jaws of a flat grey megalodon with rows of white triangular teeth fill the bottom of the frame, rising under a tiny wooden rowboat where a stickman in a yellow raincoat shape looks down, eyes huge, oars flying out of his hands. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Space & Cosmic Scale

### 31. HOW BIG?  ·  SCALE

**Headline (drawn by code):** `HOW BIG?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat deep indigo space with small white dot stars. SUBJECT: a tiny stickman astronaut in a white spacesuit with a round pale-blue visor showing huge shocked eyes, floating in the lower right with arms flung wide; filling most of the frame behind him, an enormous flat orange-and-yellow star curving off the edge, with a tiny blue Earth dot beside it for scale. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 32. INSIDE A BLACK HOLE?  ·  DANGER

**Headline (drawn by code):** `INSIDE A BLACK HOLE?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat black space with a bright flat orange ring swirling around a black circle. SUBJECT: a stickman astronaut in a white suit being stretched long and thin like spaghetti toward the black circle, his legs already stretched into a long wobbly line, eyes huge, mouth a stretched screaming oval. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## What If? Hypotheticals

### 33. NO MOON?  ·  REVEAL

**Headline (drawn by code):** `NO MOON?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat deep teal night sky with small white stars. SUBJECT: a modern stickman with a medium brown circle head and an orange shirt shape stands on a beach pointing up at an empty circle drawn as a thin white dashed outline where the Moon should be, eyes huge, mouth a wide oval; behind him a big flat dark-blue wave curls strangely. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 34. EARTH STOPS SPINNING?  ·  DANGER

**Headline (drawn by code):** `EARTH STOPS SPINNING?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat bright sky blue over a flat green hill. SUBJECT: three stickmen, a cow and a small car all flying sideways across the frame from left to right with big speed lines, the stickmen's eyes huge and mouths screaming, one still holding a coffee cup. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Mysteries & Unexplained Phenomena

### 35. WHO BUILT THIS?  ·  REVEAL

**Headline (drawn by code):** `WHO BUILT THIS?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat misty dark teal with dark-green pine tree shapes. SUBJECT: a stickman investigator in a mustard-yellow raincoat shape holding a flashlight and leaning back in amazement, eyes huge, mouth a wide oval; in front of him a ring of tall grey standing stones with a flat pale-green glow at the center and one pale-green beam shooting into the sky. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 36. WHERE DID THEY GO?  ·  REVEAL

**Headline (drawn by code):** `WHERE DID THEY GO?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat foggy grey sea. SUBJECT: the empty wooden deck of an old sailing ship with a still-warm cup of tea on a barrel and an abandoned hat; a stickman investigator in a navy coat shape peeks over the rail with huge eyes, one eyebrow raised, holding a lantern. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Everyday Science

### 37. WHY ICE FLOATS?  ·  REACTION

**Headline (drawn by code):** `WHY ICE FLOATS?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat bright sky blue. SUBJECT: a modern stickman in a grey t-shirt shape holding up a big clear glass of water with a white ice cube floating at the top, squinting at it through a large magnifying glass, one eye enormous behind the lens, eyebrows scrunched in confusion. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 38. MICROWAVE DANGER?  ·  DANGER

**Headline (drawn by code):** `MICROWAVE DANGER?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat warm yellow kitchen wall. SUBJECT: a modern stickman in a striped shirt shape peeking nervously around the corner of a counter at a microwave that glows flat orange with bold motion lines, eyes huge, sweat drops flying, both hands gripping the counter edge. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Money Psychology & Economics

### 39. WHY YOU'RE BROKE?  ·  REACTION

**Headline (drawn by code):** `WHY YOU'RE BROKE?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat soft mint green. SUBJECT: a modern stickman in a navy blazer shape holding a wide-open empty brown wallet with a small grey moth fluttering out, while gold coins with little white wings fly away above him; eyes huge, eyebrows angled up in despair, mouth a wobbly downward curve. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 40. LOTTERY CURSE?  ·  VERSUS

**Headline (drawn by code):** `LOTTERY CURSE?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: split: flat gold on the left, flat grey on the right. SUBJECT: LEFT: a stickman in a party hat hugging a giant pile of gold coins with a huge grin and sparkle shapes. RIGHT: the same stickman, same clothes, sitting on an empty floor in a torn shirt shape, holding an empty wallet, eyes huge and teary. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Technology & Attention Economy

### 41. ADDICTED?  ·  DANGER

**Headline (drawn by code):** `ADDICTED?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat deep teal. SUBJECT: a modern stickman with a medium brown circle head and a purple hoodie shape standing hypnotized in front of a giant black smartphone taller than himself with a glowing pale-blue screen of simple rounded app shapes; his eyes are huge with spiral pupils; a fishing line with a silver hook comes out of the screen and hooks his hoodie. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 42. IS IT LISTENING?  ·  REVEAL

**Headline (drawn by code):** `IS IT LISTENING?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat dark purple. SUBJECT: a giant smartphone with a huge flat cartoon ear growing out of its screen leans in close to a stickman in a grey t-shirt shape who is whispering behind his mitten hand, eyes sliding sideways in suspicion. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## How Systems Work

### 43. SO FAST?  ·  REACTION

**Headline (drawn by code):** `SO FAST?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat pale yellow. SUBJECT: a modern stickman in a grey t-shirt shape at his front door holding a brown cardboard package, eyes huge, mouth a wide amazed oval; behind him a looping grey conveyor belt, a red delivery truck and a small white plane race along with bold speed lines. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 44. WHERE DOES IT GO?  ·  SCALE

**Headline (drawn by code):** `WHERE DOES IT GO?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat dusty beige. SUBJECT: a tiny stickman in a green t-shirt shape holding one small black trash bag stands at the edge of an enormous mountain of trash bags stretching to the horizon, eyes huge, mouth a small shocked oval. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Countries & Cultures

### 45. ILLEGAL HERE?  ·  REACTION

**Headline (drawn by code):** `ILLEGAL HERE?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat soft sky blue over a flat pale-green park. SUBJECT: a tourist stickman in a yellow t-shirt shape with a red backpack frozen mid-chew with a pink gum bubble, eyes huge; beside him a police officer stickman in a navy uniform shape and cap points at the gum and blows a whistle. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 46. TIPPING IS RUDE?  ·  REACTION

**Headline (drawn by code):** `TIPPING IS RUDE?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat warm red restaurant wall. SUBJECT: a tourist stickman in a floral shirt shape proudly holding out a coin to a waiter stickman in a white apron shape, who leans back with a deeply offended face, eyebrows angled down, one mitten hand raised in refusal. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## Jobs & Careers

### 47. PAID FOR THIS?  ·  REACTION

**Headline (drawn by code):** `PAID FOR THIS?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat murky swamp green with darker reeds. SUBJECT: a medieval worker stickman in a patched brown tunic shape standing knee-deep in brown swamp water with several dark leeches stuck to his stick legs, holding a small bucket, eyes huge and disgusted, one hand pinching his nose. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 48. ROYAL TASTER?  ·  DANGER

**Headline (drawn by code):** `ROYAL TASTER?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: flat royal red with a gold curtain band. SUBJECT: a nervous food-taster stickman in a green tunic shape sniffing a golden goblet, sweat drops flying, eyes huge; behind him on a throne a king stickman in a crown and purple robe leans forward watching intently, eyebrows raised. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

## You vs X

### 49. COULD YOU WIN?  ·  VERSUS

**Headline (drawn by code):** `COULD YOU WIN?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: split: flat modern teal on the left, flat warm terracotta on the right, a yellow spark burst at the center. SUBJECT: LEFT: a modern stickman in a grey hoodie shape raising his fists nervously, eyes huge, sweat drop flying. RIGHT: a Roman legionary stickman with a bronze helmet, red crest, red tunic and a big red rectangular shield, glaring confidently with a smug grin. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```

### 50. YOU VS GORILLA?  ·  VERSUS

**Headline (drawn by code):** `YOU VS GORILLA?`

```
YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9, 1920×1080. Bold, simple and very high contrast so it reads instantly at 120 pixels wide on a phone. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a large perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing only as a simple flat color shape on the torso. Thumbnail faces are exaggerated for impact: large round white eyes with small black pupils, thick strongly angled eyebrows, a big expressive mouth — the emotion must be extreme and readable at tiny size. BACKGROUND: split: flat sky blue on the left, flat jungle green on the right. SUBJECT: LEFT: a modern stickman in a gym tank-top shape flexing a thin stick arm with a tiny bump, trying to look tough, eyebrows high. RIGHT: a huge flat dark-grey gorilla calmly holding a banana, one eyebrow raised, completely unimpressed. COMPOSITION: keep the TOP THIRD of the frame as plain flat background with no heads, objects or symbols (a headline is added there later by code); the main subject fills the bottom two-thirds, large and centered, at most two main characters. No text, letters, numbers, labels, logos or watermarks anywhere in the image. No boxes, panels, frames or blank rectangles.
```