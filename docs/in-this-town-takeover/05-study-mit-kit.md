# 05. Study: the MIT kit "roblox-in-this-town"

**Result first.** This kit has no code, characters or maps. It is pure know-how: about 75 measured numbers and about 75 bug
fixes for narrated "In this town" shorts. It is MIT licensed, so we may use all of it. Most numbers work in any engine,
Blender included. The four that matter most for us:
1. **The player camera** (FOV 55-70, camera 2-6 studs above head height, looking down 15-30 degrees, 9-16 studs away).
   Two or more people in 40-60 % of the time, close-ups only 10-15 %.
2. **Few places, revisited.** 49-83 % of cuts stay in the same place, and the camera keeps moving within it.
3. **A big, sharp face by 1.5 s.** 11 of 12 hits did this and 0 of 5 weak videos did.
4. **Faces and reactions on timing.** Cut 0-3 frames before the word. React 6-8 frames after the event. Hold 30+ frames after a punchline.

Source: `C:\Users\Huhta\Downloads\roblox-in-this-town-main.zip`, unzipped to
`C:\Users\Huhta\AppData\Local\Temp\claude\406e5fa85684c54c\641d0220-8098-4218-a04c-812f0891bea3\scratchpad\kits\mit\roblox-in-this-town-main\`.
I read SKILL.md, README.md, LICENSE and all 10 files in `references\`.
The numbers were measured in November 2026 on small samples (at most 12 hits against 5 weak videos). The kit says to read
them as strong tendencies, not laws. "studs" are Roblox units. An R6 character is 5 studs tall, and its eyes are at ~4.65.

## Licence
- Text: **MIT License, "Copyright (c) 2026 the roblox-in-this-town contributors"**, plus the line "Roblox and Roblox Studio
  are trademarks of Roblox Corporation; this project is not affiliated with Roblox."
- What we must keep: **if we copy text or code from it (in whole or in large part), we ship the copyright line and the MIT
  permission notice with it** (for example a `THIRD_PARTY_NOTICES.md` in the kit or repo, plus a one-line "adapted from
  roblox-in-this-town (MIT)" comment in the copied file). Numbers and ideas restated in our own words need nothing.
  But naming the source is cheap and honest.
- There is no warranty. The kit asks for fair play: no copied characters or looks from other channels, and no assets we
  have no rights to.

## The rules, numbered (value, then the file it came from)

### Hook and story
1. A character is big, sharp and readable **by 1.5 s**, best from frame 0. That was 11/12 hits against 0/5 weak videos. (viral_patterns.md 2, camera_and_shots.md 2)
2. Open at medium distance (**head 10-15 % of frame height**), or open close and pull back within **~1 s**. (viral_patterns.md 2)
3. The rule shows on that character at once, so it reads with the sound off. The subject is centred, with nothing in front of it. (viral_patterns.md 2)
4. Weak openings to avoid: an empty place, a dark frame, tiny people, only an object, two close-ups in a row, an aerial shot with a tree in front. (viral_patterns.md 2)
5. Length follows the story: hits run **56-180 s, median ~100 s**. (viral_patterns.md 1, styles.md)
6. The first line is the rule said as if it were normal, often "... except me". Plant **2-3 details** early that come back at the end. (story.md, viral_patterns.md 1)
7. Story shape: rule, then an example with a number, the stakes (a small case and a huge case), town life, "and me", a person who returns, the problem, 3 failed tries, the last chance, the big moment, the twist. (story.md)
8. One sentence per line. **3.5-4.7 spoken words/s**; estimate **3.7 words/s** before recording. (story.md)
9. Write **numbers as words** ("eighteen thirty-one"): digits slow down text-to-speech and break captions. (story.md, troubleshooting.md)
10. Every sentence must be showable. If it is not, rewrite it or plan an insert (a sign, a phone, a clock). (story.md)
11. **Never add story.** You are free in *how* it looks: "show it, then top it" (a big chicken becomes one taller than the houses). (directing.md 1)
12. For each sentence, think of 2-3 ways to show it: literal and over the top, the rule in daily life, contrast, the reaction, a thing in the world (sign, clock). Pick the most surprising one that still reads on a phone with the sound off. (directing.md 2)
13. Every place needs at least one moment worth showing a friend. (directing.md 6)
14. End on a comment bait that fits the rule (example: 35 k comments on 624 k likes), or on "Part 2". (viral_patterns.md 1)

### Places, camera, shot sizes
15. **Few places, revisited**: **49-83 %** of cuts stay in the same place, against **18-33 %** in weak videos. A story needs **2-5 places**. (viral_patterns.md 3, world_and_light.md 1)
16. The camera moves **82-96 %** of the time, and **34-73 % (median 49 %)** of the time it is in moves of 3 s or longer. Motion alone does not separate hits from flops. (camera_and_shots.md 1)
17. Median shot length **1.35-2.6 s**, with at least one visible change per sentence. No static picture over **3 s** unless the stillness is the point. (camera_and_shots.md 1, 3)
18. **Base camera = player camera**: FOV **55-70**, height **7-13 studs** (2-6 above head height), pitch **-15 to -30 degrees**, distance **9-16 studs**, with the place and its people in the picture. (camera_and_shots.md 1b)
19. Measured on a test: the eye-level long-lens version had 1 person in frame 66 % of the time and close-ups 54 %, and felt dead. Re-shot with the player camera: 2+ people went from 0 to 44 %, close-ups from 70 to 7 %, and it was judged clearly better. (camera_and_shots.md 1b)
20. Shot size by sentence type: **new place / crowd / scale = wide** (head ~6 %, and a new place needs a wide within its first **2 s**); **body action / physical comedy = full** (~12 %); **normal narration, two people = medium** (~20 %); **feeling / decision = medium pushing in**, medium close-up (~30 %) only for the key reaction; **punchline / shock / twist = close-up** (~45 %), at most **1-1.5 s**, never two in a row; **a named object = insert**. (camera_and_shots.md 2)
21. Mix over a video: **45-55 % wide/full, 30-40 % medium, 10-15 % medium close/close, 5-10 % inserts**, and 2+ people **40-60 %** of the time. Drama hits use close-ups for about a third of the shots, comedy and everyday hits only 7-15 %. (camera_and_shots.md 2, styles.md)
22. Distances for a 5-unit character in 9:16 (vertical FOV): close-up FOV 30 at 5.2 / height 4.2; medium close-up 35 at 6.7 / 3.9; medium 40 at 8.7 / 3.6; full 45 at 12.1 / 3.0; wide 50 at 21 / 6-15 high; drone 60 at 52 / 25-60 high. (camera_and_shots.md 2, craft.md 3)
23. Formulas: frame height **H = 2·d·tan(FOV/2)**, frame width **= 0.5625·H**; a level camera sits at **4.65 - 0.167·H, never below ~2.2**. Lens feel: f ≈ 18 mm / tan(FOV/2). **Never FOV > 45 for medium close-ups or tighter.** (pipeline.md 3, craft.md 3)
24. **Keep moving** while the next subject is within **~30 studs**. Glide between "stations" in **1.5-3 s**. Speed never drops to zero between stations. (camera_and_shots.md 3, 6)
25. **Cut** when: the place or time changes; a punchline lands (cut on the stressed word, then hold **≥30 frames**); another character's reaction matters (**0.8-1.5 s**); an object must be read (**0.5 s + 0.25 s per word**, minimum 0.6); or the next framing needs **>90 degrees** of turn or **>3x** size change in under 1 s. (camera_and_shots.md 3, craft.md 1)
26. **The new picture lands on its word, 0-3 frames early.** (camera_and_shots.md 3)
27. Two shots of the same subject differ by **≥30 degrees** or **≥1.5x** size. A punch-in on the same axis is allowed at **≥1.6x** on a stressed word. (camera_and_shots.md 3, craft.md 1)
28. Keep the 180-degree line per scene. Cross it only with a continuous move, a shot exactly on the line, or an insert. Cut during movement, not before or after it. (camera_and_shots.md 3)
29. A state change inside a running shot (sit to stand, a prop vanishing, a teleport) pops visibly: **cut exactly on that moment**. (camera_and_shots.md 3)
30. Moves: drone in **2.5-5 s** from 25-60 high; glide lags the walker by **0.2-0.4 s**; push-in **2-4 s**, frame shrinks **20-35 %**; pull-back **1.5-3 s**, frame grows **2-4x**; orbit **20-60 degrees in 2-4 s** (never >90); whip **6-10 frames**, cut mid-blur; shake **1-3 degrees**, decays in **0.3-0.6 s**; hold **0.6-1.5 s** after a punchline; crash zoom **3-5 frames**. (camera_and_shots.md 4, craft.md 2)
31. Ease in and out over **≥8 frames** (or 20-30 % of the move), never linear. Move the camera instead of zooming; FOV zoom only for comic crash zooms. (camera_and_shots.md 4, craft.md 2)
32. Without motion blur, a pure pan between **~4 degrees/s** and whip speed strobes. Turn slowly or fast, never in between, and keep turns **<90 degrees per sentence**. (camera_and_shots.md 4, craft.md 2)
33. Between far subjects, stay on the old framing, then swing over in **~0.27 s** (whip) or **~0.6 s** (turn). A slow drift shows empty pavement. (camera_and_shots.md 4)
34. Close-ups need a nearly still camera: under **0.3 units/s** of travel, under **2 degrees/s** of rotation. (craft.md 1)
35. Shake by noise times trauma²: shock is **1-3 degrees, 0.05-0.2 units, 8-15 Hz**; a handheld idle is **0.2-0.5 degrees at 0.5-1.5 Hz**. Slow motion **0.25-0.5x** for 1-2 s, at most once per video. (craft.md 2)
36. Game-camera aim: a dead zone of the centre ~10 %, damping **0.2-0.4 s**, look-ahead **0.3-0.5 s** for walkers. (craft.md 2)
37. Blend the view as **yaw/pitch angles**, never as direction vectors (opposite vectors cancel out). Two stations on the same subject from very different angles: blend the look-at point instead, or cut. (camera_and_shots.md 6, pipeline.md 3)

### Framing in 9:16
38. Safe box for faces and important things: **x 120-900, y 240-1260 px** of 1080x1920. TikTok's UI takes the top 240, the bottom 660 and a 180 px column on the right. (camera_and_shots.md 5, craft.md 3)
39. Eyes on the upper third (medium close-up: eyes at **0.30** of the height). Look room: someone looking right sits at **x 0.38-0.42**, someone looking left at **0.52-0.56**. (camera_and_shots.md 5)
40. Two-shot = **profile, facing each other, 2.5-3 units apart** (head 13-15 %). Front-facing side by side only as a wide. Over the shoulder: the near shoulder takes **at most a third** of the width. (camera_and_shots.md 5, craft.md 3)
41. Whoever speaks or reacts faces the camera at **~45 degrees**. Groups open toward the camera in a horseshoe. Look targets stay within **~35 degrees** of where the body faces. (camera_and_shots.md 5)
42. Big things read big only when near: a giant at **40 units** looked normal-sized; at **~28 units** with a low camera looking up, it looked huge. (camera_and_shots.md 5)
43. Camera limits: never closer than **~2.5** to a head, **~1.2** to a prop, never below **~2** high. If a side is blocked, try **35, 70 and 110 degrees**, then the other side, before pulling in. Tree crowns and lamp posts do not count as blockers. (camera_and_shots.md 7)
44. Coworkers, friends and family stand **3-6 units** apart so they share a frame. Seated heads sit **~1.5 lower**, so lower the camera for them. (camera_and_shots.md 5, 6)
45. Small captions in the lower third (**55-80 %** of the height) leave faces free. Close-ups keep the chin above **0.55**. (camera_and_shots.md 5)

### Acting, faces, reactions
46. **Pose to pose: 1-3 key poses per sentence.** Anticipation **4-8 frames**, the move **4-8**, overshoot **10-20 %** for **2-4 frames**, settle **6-12**, then a moving hold of **12-36 frames** (drift **1-3 degrees**, never a dead freeze). Anything shorter than ~4 frames does not read. (animation_and_effects.md 2, craft.md 4)
47. **Reactions start 6-8 frames after the event** (human reaction time is 0.21-0.23 s). The head snaps first (3-4 frames), the body follows **3-6 frames** later. Flag a reaction under 6 or over 20 frames unless it is meant to be late. (animation_and_effects.md 2, craft.md 4)
48. Double take: first look, **12-20 frames** looking away, snap back in **3-4 frames**, hold **15-30**. A delayed realisation can wait **0.5-1.5 s**, with a moving hold. (craft.md 4)
49. Comic timing: set up in a wide or full shot, pause **0.3-0.6 s** before the payoff, hold **≥1 s** after it. A deadpan face next to chaos holds **1 s**. (directing.md 3, craft.md 4)
50. Lean the torso **5-15 degrees** with the intent (forward = interest or anger, back = shock). Tilt the head **10-20 degrees** for emotion. Arms in front of a blocky torso vanish, so lift them off the body or turn the pose three-quarter. (craft.md 4)
51. Face set: **25-30 expressions** plus talk_a/b/c (mouth only) and a blink. Eyes at **40-45 %** of the face height, mouth at **62-68 %**, all inside the middle 70 %. Check every face at **~96 px**. (characters_and_faces.md 3)
52. Dosing: a calm talking face most of the time; mouth shapes switch every **~0.12 s**; **big shock faces about 2 per video** (a test with 59 % shock faces felt traumatic). Faces switch on the beat word. (characters_and_faces.md 5, styles.md)
53. Grunts and screams: use **one strong face**, not talking-mouth swaps. Swaps reset the brows, and a screaming character ends up smiling. (animation_and_effects.md 2)
54. **Background people**: random phase, **~50 %** of the hero's movement, never in sync. At most **1-2** visibly moving *random* extras. They calm down during the hero's punchline. (craft.md 4, animation_and_effects.md 2)
55. **The place's own people are different**: customers and coworkers keep doing what the place is for, in a loop (eat, type, sweep, scroll). They react to an event together, head first, **~0.25 s** after it, slightly staggered. They never dance or cheer into the lens. (world_and_light.md 3, viral_patterns.md 4)
56. Cast: 1 hero + 1-2 partners on screen most of the time. Each main character owns one strong colour; side roles read from one piece (chef hat, police cap). No neon, no pattern mixes, no shirts with text. (characters_and_faces.md 2, viral_patterns.md 5)
57. The hero's gender reads only from hair, face and colours. A soft-featured hero without a cap was read as a woman. (characters_and_faces.md 2)

### World, light, colour
58. Saturation **0.45-0.75** inside one colour world per place. Below 0.29-0.31 reads washed out; many competing hues or neon mixed with pastels read shrill. Brightness **0.27-0.55** is normal for night, dusk and interiors. (viral_patterns.md 4, styles.md)
59. Three looks to offer as a picture: bright game **0.50-0.75**, natural **0.40-0.50**, film mood. The "toy look" (smooth plastic, flat noon light, empty places, **0.24-0.30**) reads as dead. (styles.md)
60. One mood light per place, changed only on a story turn. Day: ClockTime 13-15. Golden hour: ~17.5. Blue hour: ~18.8. Night: 0-2 plus a fill light. Danger: red-orange lights pulsing at **1-2 Hz**, or a red tint for **1-3 s**. (world_and_light.md 4)
61. **Faces readable in every mood**: a fill light (range ~16, brightness ~1, no shadows) placed each frame a few units in front of the camera. Night needs mean brightness **≥0.15** and faces **≥0.35**. Character vs background brightness should differ by **≥1.3:1**. (world_and_light.md 4, craft.md 5)
62. Key/fill: **1:1-2:1** for comedy and day, **~8:1** for drama and mystery. The key light sits **30-45 degrees** off the camera axis. (craft.md 5)
63. **No depth of field and no blur in the renderer.** They blur near characters and switch off anti-aliasing. Keep **exactly one** colour correction and one atmosphere. (world_and_light.md 4, pipeline.md 5)
64. Shiny dark objects at low reflectance (**~0.04**). A black ball at 0.22 mirrored the sky and read as blue. Night windows get dark panes. (world_and_light.md 4)
65. Crowds: clone extras and switch the whole crowd between a few states on the beats. **~100 clones** render fine. (world_and_light.md 3)

### Graphics, captions, sound
66. Comic stickers on the words ("ZZZ", "???", speed lines, "1 HOUR LATER"): **one at a time, 0.5-2 s**, never over a face. Speed lines: **15-25** thin bars, jittered **~15x/s**, starting outside the head. (animation_and_effects.md 4)
67. Captions in every hit, every word in sync: **1-3 small bold words in the lower third** (Studio-style hits) or one big word in the middle. Stressed word in yellow. (viral_patterns.md 6)
68. Narrator: **3.5-4.7 words/s**, **no pause over 0.8 s**, median pitch **170-213 Hz**. (viral_patterns.md 6)
69. Loudness **-14 to -16 LUFS** (assembly target -15, true peak -1.5). Music or room sound **8-12 dB** under the voice. Sound effects on visible events. Never silent. (viral_patterns.md 6, pipeline.md 8)
70. Output **1080x1920, 30 fps**, x264 crf ~16, plus a phone copy (crf 23-26, under ~30 MB). (pipeline.md 8, styles.md)

### Pipeline and checks (engine-independent)
71. **The voice is the clock.** Each event is anchored to a word ("vanishes#1" = the first time it is spoken), and each frame is a pure function of time t. (pipeline.md 0, 6)
72. **Common words hit the wrong occurrence** ("next" said earlier): print every anchor with its sentence, and use word#2 or word#3. (pipeline.md 6, troubleshooting.md)
73. Captions: assert in code that every spoken word appears exactly once and in sync. Refuse a words.json that does not match the voice. A recording that matches the script under **90 %** means the script must be edited to what was said. (pipeline.md 8, troubleshooting.md)
74. Composition check from the plan every **0.5 s**: people in frame (0/1/2+), the biggest head as a share of frame height (close ≥30 %, medium close 18-30 %, medium 10-18 %, full 5-10 %, wide <5 %), FOV and camera height. This was the check that explained why a clean video felt lifeless. (pipeline.md 9)
75. Quality report on the final file: first cut or strong motion by 1.5 s, median shot length, % of time moving, saturation, brightness, single-frame flashes, loudness. Use **the same method for references and for our videos**. (pipeline.md 9)
76. Automatic plan checks: a jump cut (angle <30 degrees AND size ratio <1.5), a crossed line, a move without a reason, a robotic start (an acceleration spike over 3x the median), a strobing pan, a cut <30 frames after a punch, static for >3 s, a face in the caption band, a face blocked over 20 % by a raycast, a tilted horizon, a missing wide in the first 2 s of a new place. (craft.md 6)
77. Work order: build and show **place 1 only (5-15 s)**, get the yes, then do the rest. One stills sheet per place (**8-12 frames, ~1400 px wide**). Fix everything on the sheet in one pass, then re-check only the changed frames. Measured: 74 s video, 4 places, 46 shots took 30 min to the first approval and 76 min in total. (SKILL.md)

### Troubleshooting fixes that apply in any engine (troubleshooting.md)
78. A blank or one-colour frame usually means the camera is inside a wall or a tree. Check stills at every station; keep full shots at **12-14 units**.
79. A camera at foot height means a ground point was used as a camera position: lift it to eye height.
80. Rows of characters come out mirrored: when looking along +Z, +X is screen-left.
81. Cameras filming through windows from outside: put invisible blockers in window openings for the line-of-sight check.
82. A two-shot showing empty floor: the two stand further apart than the 9:16 frame is wide.
83. After a character turns, a "front" framing flips to the other side: use a fixed camera position for that shot.
84. A prop on a counter covers the face in three-quarter shots: put props on the side away from the cameras.
85. High wides show only tree crowns: move trees near the action into an archive (a film-set trick, not deletion).
86. Someone runs through the lens: send escape paths away from the camera, to the sides.
87. A walker on a fixed lane passes through the hero: check lanes against the story marks.
88. A floating character: find the ground with a downward ray at each spot, not one height per place.
89. Heads turning to someone who vanished: after a vanish, look at fixed points. Reset look, pose and talk state when someone changes place.
90. The body jumps on arrival: end the walk before the next turn starts. Start big animations exactly on a cut. Start a walk ~0.2 s after a pose ends.
91. A vanish without flicker: 3-4 single-frame white blinks in the last 0.8 s, 0.2 s fully white, then the body is gone and bursts into small glowing cubes that shrink (size, never transparency). Keep the body until the burst starts.
92. Never use partial transparency on body parts (they flicker, and hair loses layers).
93. A sign's text is blank: its text faces the wall. Check the front face in a still.
94. Long words cut off on signs: lower the texture density until the longest word fits.
95. Render much slower than usual: switch off shadows on story lights where the shadow does not matter, and archive unused characters.
