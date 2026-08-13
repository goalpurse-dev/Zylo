# Behind the Scenes — Full Template Spec

**Concept:** A tiny practical-model city gets destroyed by real physical FX inside a colossal soundstage, shot as a crew member's accidental phone footage. Users pick 3 dials (disaster, place, camera); everything else is locked to keep every output recognizably the same fictional production. 20 disaster types, 3 camera vantages, 131 preset episode ideas, 3 quality tiers.

Duration: 8-second video clips, 9:16 vertical. Image: Nano Banana 2 (Gemini). Video: Seedance 1.5 Pro (V2) / Seedance 2.0 (V3-V4).

---

## 1. Locked Style Bible (identical in every generation)

> A tiny handcrafted practical miniature city model built from real physical materials — weathered foam, wood, plaster, paint and metal — sitting inside an absolutely enormous aircraft-hangar-scale film soundstage. A colossal blue chroma-key wall towers many storeys behind and around the miniature, extending far outside the top and sides of the frame. The studio floor is covered in dense small orange VFX tracking crosses. Full-size human FX crew, some in generic dark 'EFFECTS CREW' or grey 'SPECIAL EFFECTS' tees, stand or work right beside the miniature, clearly dwarfing the tiny buildings — they are visibly as tall as entire miniature towers, proving the scale through body height and posture. They read as a distant row or small working group near the rig, not close-up portraits, and their faces are never the focus: shown from behind, in profile looking away, backlit in silhouette, or obscured by headsets, safety glasses and caps — anonymous crew, not identifiable individuals. Camera cranes, dolly track, thick coiled cables, hydraulic rigs, monitor carts, sandbags and other real film-production equipment are visible around the set. Flat cool LED studio lighting, realistic sensor grain, minor exposure clipping and small handheld imperfections consistent with amateur behind-the-scenes phone footage — not a polished commercial photograph. Composition keeps the miniature and its practical disaster confined to the lower third of the frame, leaving a huge empty upper two-thirds of soundstage and towering blue wall visible above it, its top and side edges never fully contained in frame. The disaster effect itself is entirely physical and practical, rigged and operated by the visible crew — never a digital or CGI effect.

**Hard negatives (every image prompt):**
> No tabletop diorama, desk-scale model or model on a table with legs, no small room or low ceiling, no green screen, no sparse or oversized tracking crosses, no scene missing the full-size crew, no CGI, no 3D render, no game-engine or videogame look, no glossy Octane-style render sheen, no waxy or plastic skin, no HDR-overcooked highlights, no fantasy glow, no clean studio-photo look, no plastic or glossy toy appearance, no cartoon or cel-shaded style, no real full-size city presented as real, no logos, brand names or readable signage, no captions, subtitles, on-screen text, aspect-ratio labels, AI tool names or watermark, no close-up or clearly identifiable human faces looking toward camera.

*(The "no identifiable faces" negative + the anonymous-crew style bible language were added after repeated Seedance 2.0 "may contain real person" content-policy rejections on the generated stills.)*

---

## 2. Disaster Modules (20 total) — the primary creative dial

Each disaster is a data object with these fields, all fed into prompt assembly:
- `fx` — the practical rig/equipment description
- `precursor` — what's *already* happening at frame 0 (added specifically so the video never opens static)
- `motion` — how the effect crosses/develops through the miniature (main event beat)
- `hero` — the single biggest visual beat (escalation beat)
- `particles` — atmosphere/debris (aftermath beat)
- `exclusions` — negative list keeping other disasters' gear out of frame
- `soundAmbience` / `soundMachine` / `soundImpact` — audio beats

**Original 8 elemental disasters:** Giant Wave 🌊, Eruption 🌋, Explosion 💥, Tornado 🌪️, Flood 🌊, Meteor ☄️, Firestorm 🔥, Blizzard ❄️

**12 extended disasters** (added later for creature/vehicle/set-piece variety): Giant Creature 🦖, Aircraft Chase 🚁, Vehicle Chase 🚂, Structural Collapse 🏢, Ship Disaster 🚢, Avalanche 🏔️, Alien Craft 🛸, Giant Robot 🤖, Sandstorm 🏜️, Superstorm ⚡, Fire Tornado 🔥, Earthquake 🏚️

### Full example — Giant Wave
```
fx: a real in-floor water tank with a hydraulic wave machine and pressurized dump tanks
precursor: the water is already pulling back through the miniature streets in an unnatural retreating surge, pumps already rumbling under the tank and small boats or debris already rocking on the surface
motion: a towering wall of water surges horizontally across the miniature skyline, swallowing entire model blocks
hero: the wave crest rises several storeys above the tallest miniature tower before crashing down across the set
particles: heavy spray, white foam, drifting mist and floating miniature debris
exclusions: no fire, smoke, dust, wind machines or falling snow anywhere in frame
soundAmbience: a steady pump hum and distant water circulation
soundMachine: hydraulic wave-machine gears engaging as water surges into the tank
soundImpact: a deep crashing wave impact with heavy spray and rushing water
```

### Full example — Giant Creature (one of the 12 extended modules)
```
fx: a full-size FX crew operating a towering original creature rig alongside miniature toy vehicles, helicopters and debris scattered across the set
precursor: the creature rig's hydraulics are already hissing and trembling, fine dust already sifting from nearby miniature rooftops
motion: the creature rig lumbers through the miniature grid, crushing model buildings and swatting aside toy vehicles with each motion
hero: the creature towers many storeys above the miniature skyline, dwarfing both the tiny buildings and the full-size crew operating its rig
particles: falling debris, dust, snapped miniature power lines and drifting smoke
exclusions: no water tank, no wave machine, no snow cannons and no aircraft wire rigs unrelated to the creature shot
soundAmbience: a low mechanical whir from the creature rig's hydraulics idling
soundMachine: the rig's servo motors engaging as the creature begins to move
soundImpact: a heavy footstep thud shaking the set, followed by crumbling debris
```

*(All 20 modules follow this exact same shape. Happy to paste the full set of 20 if useful — trimmed here for length.)*

---

## 3. Camera Vantage Modules (3) — secondary dial

| Vantage | Sublabel | Capture | Framing |
|---|---|---|---|
| **Tank Edge** (default) | Closest to the chaos | from ground level right beside the FX tank, low next to the crew and equipment | the closest crew member's shoulder or back visible at the frame edge, face turned away from camera toward the set, tangled cables and hoses crossing the foreground, rigging carts and monitors nearby |
| **Gantry** | Full scale reveal | from an elevated gantry looking down over the entire miniature set | a metal guardrail bar low in frame, the full tank and miniature skyline spread out below, crew visible only from behind or in silhouette on the catwalk, catwalk lighting rigs visible at the edges |
| **Crane Follow** | Most cinematic | from a camera crane sweeping low over the miniature during the impact | the crane arm and cable rigging faintly visible at the frame edge, any crew glimpsed only from behind or blurred by motion, subtle motion blur on nearby equipment as the crane moves |

---

## 4. Prompt Assembly

### Image prompt template
```
A photorealistic amateur phone photograph captured {vantage.capture}, on the set of a giant blockbuster practical-effects film shoot.

The miniature under attack is a rebuild of this idea, translated into convincing tiny real-world architecture and materials — weathered stone, painted wood, aged metal, glass and terrain — while preserving its unmistakable silhouette: {user's place text}. It must read as a handcrafted physical model, not a real full-size place.

{STYLE BIBLE — section 1}

Practical disaster in progress: {disaster.fx}. {disaster.motion}. {disaster.hero}.

Visible particles and atmosphere: {disaster.particles}.

Camera framing: {vantage.framing}. {disaster.exclusions}.

Vertical 9:16 full-bleed composition for TikTok and Reels.

{HARD NEGATIVES — section 1}
```

### Video prompt template (rewritten for aggressive pacing — see section 5)
```
Animate this image into one continuous 8-second photorealistic vertical behind-the-scenes shot {vantage.capture}. Use the EXACT same miniature, enormous in-floor FX tank, blue chroma wall, orange tracking crosses, full-size crew, camera equipment and {disaster.fx} from the hero image — this is the same physical set, only in motion, not a new scene.

IMPORTANT PACING: motion from the FIRST FRAME — no static opening, no dead air, no long establishing shot, no delayed action. Visible precursor activity begins at 0.0s, "Action!" occurs around 0.8-1.0s, the main practical effect begins immediately after and continuously escalates, reaches its largest hero moment around 5-6s, and remains visibly active through the final frame.

0.0-0.8s — ACTIVE ESTABLISH: the rebuild of "{place}" is already alive, nothing here is static. {disaster.precursor}. The handheld phone is already slightly moving, and crew are already in motion — checking rigging, signaling to each other or bracing at their stations.

0.8-1.2s — TRIGGER: a crew member calls "Action!" almost immediately, and the practical rig fires within the same beat — {disaster.fx} engages instantly, with no pause between the call and the effect.

1.2-4.5s — MAIN EVENT: {disaster.motion}. New physical interactions keep developing roughly every half-second — debris, spray, structural failure or particles constantly changing. Crew react in real time, flinching, bracing or calling out, and the camera follows instinctively from {vantage.capture}.

4.5-6.5s — HERO ESCALATION: the effect does not plateau, it gets BIGGER. {disaster.hero}. This is the single largest visual beat of the entire clip, selling the scale contrast between the tiny model and the full-size crew and studio.

6.5-8.0s — ACTIVE AFTERMATH: the peak passes but motion never stops. {disaster.particles} keep drifting, settling and moving, damaged sections of the miniature keep shifting, crew move toward the tank to assess it, and machinery is audibly winding down as the camera resettles toward a loop-ready frame — the scene stays alive until the final frame.

{disaster.exclusions}.

Camera framing stays consistent throughout: {vantage.framing}. The camera never leaves this vantage and never cuts.

No zoom toward the miniature beyond natural crane/handheld movement already described, no scene change, no morphing architecture, no added characters beyond the established crew, no text, captions, logos, UI or watermark.

AUDIO STARTS AT 0.0s, never silence: {disaster.soundAmbience} and machinery already running under the precursor activity from the very first frame. A crew member calls "Action!" around 0.8-1.0s, and {disaster.soundMachine} immediately — no pause between the call and the sound — building straight into {disaster.soundImpact} through the hero escalation. In the final 1.5 seconds the effect decays naturally: fading machinery, settling debris, crew reactions and radio chatter — never total silence until the very last frame. No voices delivering dialogue or narration, no music, score or soundtrack — only practical set noise and crew chatter, exactly like a phone recording accidental audio.
```

### Fully rendered example (disaster: Giant Wave, place: "A neon-lit harbor metropolis of glass towers along the waterfront", vantage: Tank Edge, sound on)

```
Animate this image into one continuous 8-second photorealistic vertical behind-the-scenes shot from ground level right beside the FX tank, low next to the crew and equipment. Use the EXACT same miniature, enormous in-floor FX tank, blue chroma wall, orange tracking crosses, full-size crew, camera equipment and a real in-floor water tank with a hydraulic wave machine and pressurized dump tanks from the hero image — this is the same physical set, only in motion, not a new scene.
IMPORTANT PACING: motion from the FIRST FRAME — no static opening, no dead air, no long establishing shot, no delayed action. Visible precursor activity begins at 0.0s, "Action!" occurs around 0.8-1.0s, the main practical effect begins immediately after and continuously escalates, reaches its largest hero moment around 5-6s, and remains visibly active through the final frame.
0.0-0.8s — ACTIVE ESTABLISH: the rebuild of "A neon-lit harbor metropolis of glass towers along the waterfront" is already alive, nothing here is static. the water is already pulling back through the miniature streets in an unnatural retreating surge, pumps already rumbling under the tank and small boats or debris already rocking on the surface. The handheld phone is already slightly moving, and crew are already in motion — checking rigging, signaling to each other or bracing at their stations.
0.8-1.2s — TRIGGER: a crew member calls "Action!" almost immediately, and the practical rig fires within the same beat — a real in-floor water tank with a hydraulic wave machine and pressurized dump tanks engages instantly, with no pause between the call and the effect.
1.2-4.5s — MAIN EVENT: a towering wall of water surges horizontally across the miniature skyline, swallowing entire model blocks. New physical interactions keep developing roughly every half-second — debris, spray, structural failure or particles constantly changing. Crew react in real time, flinching, bracing or calling out, and the camera follows instinctively from from ground level right beside the FX tank, low next to the crew and equipment.
4.5-6.5s — HERO ESCALATION: the effect does not plateau, it gets BIGGER. the wave crest rises several storeys above the tallest miniature tower before crashing down across the set. This is the single largest visual beat of the entire clip, selling the scale contrast between the tiny model and the full-size crew and studio.
6.5-8.0s — ACTIVE AFTERMATH: the peak passes but motion never stops. heavy spray, white foam, drifting mist and floating miniature debris keep drifting, settling and moving, damaged sections of the miniature keep shifting, crew move toward the tank to assess it, and machinery is audibly winding down as the camera resettles toward a loop-ready frame — the scene stays alive until the final frame.
no fire, smoke, dust, wind machines or falling snow anywhere in frame.
Camera framing stays consistent throughout: the closest crew member's shoulder or back visible at the frame edge, face turned away from camera toward the set, tangled cables and hoses crossing the foreground, rigging carts and monitors nearby. The camera never leaves this vantage and never cuts.
No zoom toward the miniature beyond natural crane/handheld movement already described, no scene change, no morphing architecture, no added characters beyond the established crew, no text, captions, logos, UI or watermark.
AUDIO STARTS AT 0.0s, never silence: a steady pump hum and distant water circulation and machinery already running under the precursor activity from the very first frame. A crew member calls "Action!" around 0.8-1.0s, and hydraulic wave-machine gears engaging as water surges into the tank immediately — no pause between the call and the sound — building straight into a deep crashing wave impact with heavy spray and rushing water through the hero escalation. In the final 1.5 seconds the effect decays naturally: fading machinery, settling debris, crew reactions and radio chatter — never total silence until the very last frame. No voices delivering dialogue or narration, no music, score or soundtrack — only practical set noise and crew chatter, exactly like a phone recording accidental audio.
```

*(Known minor rough edge: "the camera follows instinctively from from ground level..." has a double "from" — vantage.capture already starts with "from," and it gets reused verbatim into a sentence that also says "from." Worth cleaning up.)*

---

## 5. Video Pacing Rule (recently rewritten)

Old structure was 4 static beats (0-2s Establish / 2-4s Trigger / 4-6.5s Impact / 6.5-8s Aftermath) where the first 2 seconds explicitly described the set as "quiet and still... crew wait... visibly idle." That wasted 25% of an 8-second clip on nothing happening.

New structure, rewritten from an external pacing guide:
- **0.0–0.8s ACTIVE ESTABLISH** — precursor motion already happening (unique per-disaster field), phone already moving, crew already active
- **0.8–1.2s TRIGGER** — "Action!" and the rig fires in the same beat, no pause
- **1.2–4.5s MAIN EVENT** — continuous escalating interactions, something new every ~0.5s
- **4.5–6.5s HERO ESCALATION** — explicitly "does not plateau, gets BIGGER" — the single biggest beat
- **6.5–8.0s ACTIVE AFTERMATH** — still moving: particles settling, crew approaching, machinery winding down

Sound was also moved to start at 0.0s (ambience + machinery immediately) instead of only kicking in at the trigger.

---

## 6. Quality Tiers / Pricing

| Tier | Image | Video | Credits (img+video) | Real cost (measured) | Retail multiplier |
|---|---|---|---|---|---|
| **V2** Fastest | Nano Banana 2, 2K | Seedance 1.5 Pro, 720p, with sound | 7 + 42 = 49 | $0.069 + $0.417 = $0.486 | 2.02x (50.4% margin) |
| **V3** Premium | Nano Banana 2, 4K | Seedance 2.0, 720p, with sound | 10 + 128 = 138 | $0.103 + $1.268 = $1.371 | 2.01x (50.3% margin) |
| **V4** Professional | Nano Banana 2, 4K | Seedance 2.0, 1080p, with sound | 10 + 320 = 330 | ~$0.103 + ~$3.20 (extrapolated) = ~$3.30 | ~2.0x (extrapolated) |

Plan gating: V2 requires Starter, V3 requires Pro, V4 requires Generative.

---

## 7. Episode Ideas (131 total, sample)

Preconfigured place + disaster + vantage combos powering "Trending Episode Ideas," "Surprise Me," and "make the next episode." One idea per disaster in the original 8 disasters, then 4-per-disaster (32 more), then ~99 more spanning creature/aircraft/vehicle/collapse/water/frozen/scifi/action/combo/showcase categories (deduplicated — one exact duplicate from a source list was caught and dropped).

Sample:
- 🌊 Giant Wave vs Neon Harbor — "A neon-lit harbor metropolis of glass towers along the waterfront" — Tank Edge
- 🦍 Giant Ape vs Mountain Fortress — "A mountain city crowned by a stone hilltop fortress" — Crane Follow
- 🚁 Helicopter Chase Through Neon City — "A neon-lit futuristic downtown with tall glass megatowers" — Gantry
- 🛸 Massive Alien Machine Over Downtown — "A dense futuristic downtown of tall glass megatowers" — Crane Follow
- 🎬 Everything Goes Wrong on the Movie Set — "A dense downtown of tall glass towers along the waterfront" — Crane Follow (creature)

---

## Known open questions for review

1. Video prompt has a small grammatical double-up ("from from...") when vantage.capture is interpolated into a sentence that already contains "from."
2. V4's video cost is still extrapolated, not measured from a real invoice.
3. The "hero" and "escalation" beat currently reuse the same `hero` field for both the video's HERO ESCALATION beat and the image's still-frame description — no dedicated "biggest video moment" text distinct from the image's hero shot.
4. Sound pricing for Seedance 2.0 assumes zero audio surcharge based on one 720p data point; not yet confirmed at 1080p.
5. 12 of the 20 disaster modules are new and haven't been generation-tested yet (only the original 8 elemental ones have real user-generated examples so far).
