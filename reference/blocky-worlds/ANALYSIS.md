# Blocky Worlds: reference analysis (19 TikTok videos)

Sources: `reference/blocky-worlds/videos/` (19 files, numbered 01–19 in filename order, see `work/index.txt`).
How they were "watched":
- Every video cut into contact sheets at 1 frame per 3 s (`work/sheets/`, 55 sheets, all read).
- Full transcripts with timestamps from a local Whisper run (`work/transcripts/NN.txt`).
- Measured with ffmpeg: length, scene cuts, words per minute, and silence gaps (to detect a music bed).

Limits: stills can't show camera moves *inside* a shot or caption animation, and I can't hear the music. Each of those is marked "not verified" where it matters.

---

## 1. The 30-second version

- **The idea is the product.** Each video is one absurd world rule that fits in a single sentence, spoken in the first 3 seconds. The rule is then pushed to its most extreme consequence. Visuals and pacing are almost the same across creators; the idea is what changes.
- **Fixed opener:** 15 of 19 start with exactly "In this world, …" or "In this town, …". The other 4 are variants: "In this village" (06), "In my world" (08), "In this kingdom" (11), "In my town" (12). In 12 of 19, line 2 starts with "**You see,** …".
- **Narration:** first person, a kid or teen narrator, very fast (≈255–290 words per minute in 17 of 19; the two cartoon ones are ≈170). Constant music or ambience under the voice (zero silent gaps in all 19).
- **Visuals:** blocky avatars with sticker faces; a **new shot for nearly every sentence** (one every ~1–3 s); low angles and silhouettes for monsters. Lighting tracks the story: bright normal → dark blue/purple crisis → warm ending.
- **Captions:** one word at a time, bold white rounded font, black outline, centred about 62–74% down the frame.
- **Ending:** the final line or final shot calls back the opening, either as a reversal ("now when it rains, they call me") or as an open-loop horror sting ("So whose light is that?").
- **Length:** 66–170 s, median ≈131 s. These are **2-minute stories**, not 30-second shorts.

---

## 2. Format and style

### 2.1 Hook (first 3 s)
- **Second 0:** the rule, stated as fact, in one sentence of ≤ 15 words: "In this town, every house has a white chalk line drawn around it." (01, ends at 3.0 s). "In this world, everyone is born with wings, except me." (02, 2.6 s)
- **First frame:** already in the story, showing the rule. Examples: an aerial shot of the chalk-lined suburb, a clock at 12:00, a rule sign ("TOWN LAW – NO WHISTLING AFTER SUNSET"), crowds with numbers over their heads. **No title card, no logo, no intro.**
- **About 3 s:** "You see, …" moves into the mechanics, then **3–5 rapid concrete examples with named townsfolk**, each with its own shot:
  - "Dogs sleep in chalk circles. Cars get parked in little chalk boxes. The pizza guy stops delivering at six."
  - "Mr. Pickett wished for a brand new truck… Now he has a truck and an empty cage."
  - "Grandmas race each other to the grocery store."

  These examples carry the comedy and the world-building, and they're where the "I'm addicted" feeling starts.
- **Strongest hooks** also add the *cost* or *danger* inside the first 6 s ("…anything outside a line belongs to the collector", "…whoever is still outside when they do is gone by morning"). Video 12 front-loads the payoff: "Last month, that was my big brother, and last night, I found out where everyone goes."

### 2.2 Story structure (the same skeleton in all 19)
| Part | Share of runtime | What happens |
|---|---|---|
| 1. Rule | 0–3 s | "In this world/town, [rule]." |
| 2. World tour | 3–25 s | "You see, …" mechanics, 3–5 funny or creepy examples, the ONE rule or exception, plus a little lore ("30 years ago the Marsh family disappeared") |
| 3. Me | 25–45 s | The narrator's place in the rule: usually **the exception or underdog** (no wings, blank shirt, zero, grumpy cloud, one sad bulb, NPC). Also a key person (best friend, sibling, parent, grandparent) and a **setup prop** (chalk in pocket, rope coil, feather duster, cookies, crank flashlight) |
| 4. "Until one night…" | ~35% | The rule breaks, or the threat arrives. Escalation in 3 rising steps |
| 5. Discovery | ~60–70% | A hidden truth about the rule (mom IS the beast; the monster under the bed was protecting me; the streetlights ARE the dark; the number counts something else) |
| 6. Climax | ~75–90% | The narrator wins **using the rule itself or the "weakness"/setup prop**, never with outside help |
| 7. Closer | last 5–10 s | The world is changed, with a callback line that flips the opening, or a horror sting that reopens the loop |

### 2.3 Pacing and cut timing
- **Speech:** 247–292 words per minute (median ≈260) in 17 videos. 17 and 18 (cartoon style, comedic) run ≈165–175 words per minute. Sentences are short; fragments are common ("Heavy, soaked, stuck.").
- **Cuts:** the frame sheets show a different composition on almost every 3 s frame. ffmpeg's cut detector at a sensitive setting finds an average of 0.5–1.4 s per shot (that count includes flashes and fast moves). **Rule for us: at least one new shot per sentence, plus extra shots for listed examples; target 1.0–2.0 s per shot.**
- **The climax is cut faster:** quick face/threat/face exchanges, extreme close-ups.
- Shot for shot, visuals are **literal**: every spoken noun gets its own image (mailman → mailman with a chihuahua; "a stethoscope the size of a tuba" → that).

### 2.4 Camera vocabulary (in order of use)
1. **Medium or close-up face shot** for every emotional beat (the face sticker carries the emotion).
2. **Wide establishing shot** for each new place (aerial over the town, a canyon wall, a street of rib arches).
3. **Low angle up at the threat** (giants, lamps, golem, creature on the porch). The kid stays tiny at its feet.
4. **Top-down** for bed, fallen, stuck or "whole town" moments (asleep in bed, the hero in the fountain, a tiny figure down a cliff).
5. **Over the shoulder** for dialogue and for "the kid faces the threat".
6. **Insert close-up** of a written prop: a letter, newspaper, sign, note, phone, monitor or calendar. This is the main way text gets into the story.
7. **Silhouette or shadow reveal** before the full monster. **Extreme close-up of a giant eye or grin.**
8. **Back shot** walking into the danger or toward the ending.

Camera moves inside a shot are not verified (stills only). A few blurred frames suggest push-ins or whip moves.

### 2.5 World and characters
- **Settings:** a US suburb (houses, lawns, crosswalks, streetlights) is the default. Then school (hallway, cafeteria, classroom, stage) and a bedroom. Then fantasy sets: a canyon town, a town inside a whale, a castle, an underground city with a painted sky, an endless warehouse store, a submarine interior.
- **Lighting arc:** bright saturated day for the normal world → **deep blue night** (often with stars), purple fog or rain for the crisis → **warm amber or sunrise** for comfort, memories and the ending. Weather (rain, snow, fog) marks the crisis.
- **People:** blocky avatars with flat **sticker faces**. The emotion set is small: smile, frown, open "O", screaming teeth, tears, angry brows, sly sideways eyes, blush, X-eyes. Each main character has **one fixed signature item** (orange scarf, striped sweater, rope strap, fish hat). Two twists (13 and 14) depend on recognizing an outfit.
- **Recurring stock cast** (at least one creator reuses them): an orange-haired kid in a knit sweater, Mom with a red bun and gingham apron, Grandpa with white hair and glasses, a mailman, a mustached neighbour.
- **Monsters share a vocabulary:** very tall and thin, black or white, with **one glowing feature** (white eyes, a jagged grin, green eyes in the dark, a giant yellow eye). Silhouettes come before reveals. Some are *ordinary things come alive* (streetlights, store employees).
- **The rule is made visible inside the world:** numbers, stars, clouds or name tags over heads; chalk lines on the ground; text printed on shirts; signs and billboards stating the law.

### 2.6 Text on screen
- **Captions:** **one word at a time**, in sync with the voice. Bold white rounded sans with a black outline and soft shadow, centred horizontally, at **62–74% of frame height**, with no box. Horror videos colour the danger or final word red (sometimes green). Some captions put key words in ALL CAPS. Video 09 is the exception, with 2–3-word chunks in a lighter weight.
- **In-world text:** signs, letters, newspapers, monitors and the rule billboard are the "title cards".
- **Cartoon style (17, 18) adds:** speech bubbles ("WE NEED YOU GRUMPY!"), big pop numbers ("40,000"), and section cards ("NEXT YEAR").
- **One CTA:** 03 ends with "Subscribe to support my stories" and a button overlay. Nobody else asks.

### 2.7 Voice, music, sound
- **Voiceover:** first person, past tense, a kid or young teen. Conversational and wry ("She was lying, but it was nice."), with dialogue read inline ("Hey rope boy, need a lift?"). Onomatopoeia gets its own beat ("Scratch, scratch.", "Tap, tap.", "Zap!", "Ah… Ah… Choo!"). Probably one TTS-style voice per video; whether characters get separate voices is not verified.
- **Music/ambience:** there's a constant bed in all 19 (no gap under -50 dB anywhere). Its genre is not verified (I can't listen). The working assumption is a low cinematic or lo-fi bed, with stingers at reveals.
- **SFX:** implied by the onomatopoeia lines (scrape, scratch, zap, thunder, sneeze). Not verified in the audio.

### 2.7a Voice match (stock library voice only; no cloning)
- **Listening samples** (local, not in git): `reference/blocky-worlds/voice-samples/`. Clips from videos 01 (7.0 s), 04 (6.3 s) and 12 (5.3 s). Music is under the voice in all of them.
- **Measured pitch:** median ≈ 180–190 Hz in 15 of 19 videos (range 163–213 Hz). That's higher than a typical adult man (≈ 110–130 Hz) and lower than a typical adult woman (≈ 200–220 Hz), which fits a **teen boy** or a youthful male TTS voice, very likely the same stock voice in most videos. The music bed may push the number up a little.
- **ElevenLabs library shortlist.** Pitch and speed were measured from each voice's free preview clip; preview speed depends on the preview text. Our 260 words per minute comes from writing plus the speed setting, not from the voice alone.

| Voice (ID) | Preview pitch | Why it's on the list |
|---|---|---|
| Anatoly `UgMQ92GJ3C3bUAtHUKyd` | 187 Hz | "Young teenage-like male YouTube voice". Closest pitch |
| Markmont `rTOopItG6FIkKMIVxsl5` | 180 Hz | Youthful, warm, bright |
| Marcus `y0s2ExEMuum3muUnA6Zd` | 165 Hz | Bright, upbeat social-media narrator |
| Brian `UGTtbzgh3HObxRjWaSpr` | 163 Hz | Energetic storytelling, very popular |
| Brayden `3XOBzXhnDY98yeWQ3GdM` | 157 Hz | "Male teenager"; fast preview (274 words per minute) |
| Ethan `Pb8RZcHs3ga4StE7wiPM` | 154 Hz | "Older male teen", conversational, fast (255 words per minute) |
| Haven Sands `x8xv0H8Ako6Iw3cKXLoC` | 155 Hz | Youthful, energetic, sarcastic |
| Mark `WTUK291rZZ9CLPCiFTfh` | 150 Hz | Very popular natural social voice, fast |
| Penelope `tJx7PsKA0xKckfV0qHhK` (backup, female) | 211 Hz | Teen girl, in case the narrator turns out to be a girl |
| Kittie KaBoom `0luPAj5RsdhmnkZaiYcb` (backup, female) | 204 Hz | Can play child or teen |

### 2.8 Three visual styles in the set
1. **Game-engine blocky look** (01–14, 16, 19): real-time lighting, fog, bloom, sticker faces. This is the main style.
2. **Polished cartoon** (17, 18): soft gradients, light rays, speech bubbles, slower comedic read. Probably one creator.
3. **Low-poly flat-shaded** (15) with a deliberately realistic monster.

### 2.9 Writing quality: two tiers
- **A-tier** (01–10, 12, 15, 17, 18): concrete, funny examples with names; a narrator with jokes; a tight rule that pays off; callback endings. These read like one strong writer (or a few).
- **B-tier** (11, 13, 14, 16, 19): generic prose ("I was a 16-year-old boy who…", "Suddenly", "I realized something"), morals spelled out, fewer concrete examples. They have the same format but a weaker voice.
- **Our writer should be prompted, and checked, toward A-tier.** If you have per-video likes, send them and I'll check this against real numbers. (I don't have per-video stats. If the B-tier ones also did 300k, the premise matters even more than the prose.)

---

## 3. All 19 videos, reconstructed

Format: what happens start to finish → **Idea** (one line) → **Why it's outrageous** → **Escalation** → **Closer**.

**01 · The chalk line (66 s, horror/heroic)**
At night, anything outside a chalk line "belongs to the collector". A storm washes the family's line away, the streetlights go out one by one, and a figure taller than the lights walks toward Dad. The kid draws the circle *around the monster*. The town builds a roof over it so rain never touches it again.
- **Idea:** a chalk line makes a house, and nothing can cross it.
- **Outrageous:** a deadly cosmic law enforced by sidewalk chalk; pizza delivery stops at six.
- **Escalation:** the line washes away → the lights die one by one → the scrape → the giant walks toward Dad.
- **Closer:** "something taller than the streetlights stands perfectly still. In a house it can never leave." (The rule used as a weapon.)

**02 · The kid with no wings (133 s, underdog)**
A canyon town where everyone flies. Rain grounds everyone. "Rope boy" climbs everywhere. On a field trip a storm hits, and his best friend Nia falls onto a cracking ledge. Hundreds of winged adults can't reach her. He climbs down and carries her up.
- **Idea:** everyone is born with wings, except me.
- **Outrageous:** babies fly before they walk; grandmas race to the grocery store in the air.
- **Escalation:** the storm → Nia falls → her dad can't lift off → the ledge cracks → the climb with her on his back.
- **Closer:** "Everyone in this town has wings, but now, when it rains, they call me." (The weakness becomes the strength.)

**03 · The town inside a whale (140 s, adventure)**
The town lives in a whale's belly: rain when it drinks, yawn poles, sunrise when it surfaces. Mom is the whale keeper; once a year she tickles its nose on Sneeze Day. A kraken drags the whale down. They jam the old harpoon into the nose and tickle it, and the sneeze fires the harpoon into the kraken's eye.
- **Idea:** our whole town lives inside a giant whale.
- **Outrageous:** a stethoscope the size of a tuba, sneeze cannons, fishermen at the throat.
- **Escalation:** the town tilts → squeezing → sinking → the lanterns die → an eye at the blowhole.
- **Closer:** "In its place, stuck deep in the rib, is a giant feather duster." (The setup prop pays off.)

**04 · The greeter in the woods (140 s, horror/folk)**
The greeter grants any wish, but takes the first thing that greets you when you get home. So nobody greets anybody. The farm is dying, and the kid wishes for rain. To protect his family he never goes home. He sleeps in the gym, a barn, a treehouse. The impatient greeter waits on the porch, greets the kid first, and has to take itself.
- **Idea:** wish for anything; pay with whoever says hello first.
- **Outrageous:** a parrot's "Hello!" costs it a truck; the whole town has gone silent.
- **Escalation:** the deal → 3 nights of running → the follower vanishes → it's waiting at the door.
- **Closer:** "And now, in this town, everybody says hi again." (Loophole twist.)

**05 · The NPC hot dog guy (131 s, game world)**
NPCs say one line forever, and players respawn. A griefer with a purple gun deletes NPCs permanently. His zap glitches the hot dog guy free. He saves the lemonade girl, breaks through the map wall, takes the admin's hammer and bans the griefer. After the server restart, the lemonade girl remembers.
- **Idea:** I'm a background character, and I just woke up.
- **Outrageous:** 10,000 "Nice day for a hot dog!" a day for 11 years, and a crush he's not allowed to speak to.
- **Escalation:** NPCs deleted one by one → he's zapped but survives → the map edge → the hammer.
- **Closer:** "If you ever play in our town, be nice to the hot dog guy."
- **Riff:** a remix of *Free Guy*.

**06 · The plate for the great beast (135 s, horror twist)**
Every porch leaves a plate for the beast. Mom sleeps at sunset, is never hungry, and her nails are always chipped. The kid forgets the plate; the green eyes come; an old photo reveals that Mom is the beast, which protects the village. The kid is 12, her "first night" age. He eats every plate on the street, transforms and drives the eyes away.
- **Idea:** we feed the monster every night, and it turns out the monster is my mom.
- **Outrageous:** meatloaf, soup, pizza and a whole cake eaten porch by porch.
- **Escalation:** a forgotten plate → scratches on Mom → torn gardens → hundreds of eyes → the photo.
- **Closer:** "every morning, Mom asks me if I want breakfast. I'm never hungry." (Hidden truth, and the narrator joins it.)

**07 · Embarrassment printed on your shirt (160 s, wholesome)**
Every night your most embarrassing moment of the day is printed on your shirt. Danny's shirt is always blank, and he's treated like a legend, because he never tries anything. Ethan's shirts are full and happy. Grandpa keeps a box of embarrassing shirts: "the days I actually lived". Danny bombs the talent show on purpose and finally has a shirt.
- **Idea:** everyone must wear yesterday's worst moment.
- **Outrageous:** "called his boss Mum"; a math teacher's shirt that reaches his knees.
- **Escalation:** status from a blank shirt → Ethan's list → "what did you do yesterday?" → Grandpa's box.
- **Closer:** "Danny's shirt wasn't blank, and neither was his life."

**08 · A superpower on your worst day (124 s, revenge/power)**
Your worst day gives you a power. The narrator's best friend becomes the celebrated hero Captain Shine. He burns down the narrator's house at the narrator's birthday party and gets a parade for "saving" it. That worst day gives the narrator an "UNKNOWN" power. At Shine's parade the whole city goes dark, Shine included.
- **Idea:** everyone gets a random superpower on the worst day of their life.
- **Outrageous:** a mailman chased by 12 dogs can outrun cars; the newspaper headline "saves party from fire".
- **Escalation:** sidekick humiliation → the fire → "Unknown" → lights die whenever he's angry → the parade.
- **Closer:** "They called me Blackout… everybody was looking at me."

**09 · No whistling after sunset (140 s, horror)**
Whistle in the dark and something whistles back, copying voices. The narrator slips; the thing learns his dead mom's voice; Grandpa burns her tapes. Later Grandpa goes missing. The narrator answers with knocks on metal and wood (meaning, not sound) and finds him.
- **Idea:** the forest copies any sound it hears.
- **Outrageous:** it uses your dead mother's voice: "Sweetheart, open the door."
- **Escalation:** one whistle → it answers → Mom's voice at the door → Grandpa goes missing.
- **Closer:** "some voices are worth remembering, and some are better left unheard."
- **Riff:** folk superstition plus *The Mimic*.

**10 · The monster under my bed (92 s, horror twist/wholesome)**
Every kid has one. He starves Grumble with bug spray, traps and a bunk bed. The scratching stops. Then the real thing comes out of the closet, and Grumble, half-dead, defends him. Ten years of scratching was Grumble fighting it. Cookies make Grumble giant.
- **Idea:** the monster under the bed was the bodyguard all along.
- **Outrageous:** a mouse trap still stuck on the monster's paw.
- **Escalation:** the war on Grumble → silence → the closet → the ladder.
- **Closer:** "Grumble sleeps on the top bunk. I sleep under the bed… when I hear scratching, I scratch back."

**11 · The smaller you are, the stronger your magic (163 s, fantasy, B-tier writing)**
Tiny nobles rule and tall people do the labour. A tall kitchen worker wins the golden apple from a golem by pulling a crack with a rope. He wishes everyone the same size; the king twists the wish, and everyone else grows while the narrator shrinks. That makes him the most powerful.
- **Idea:** size is upside-down power.
- **Escalation:** the contest → the golem → the wish → the betrayal.
- **Closer:** "now, I was the smallest person alive." (The wording works in his favour.)
- **Riff:** Gulliver plus the monkey's paw.

**12 · Be home before the streetlights go out (139 s, horror)**
Whoever is outside when the lights go out is gone, and a new streetlight appears. 212 lamps, 212 names on the missing wall. His brother's orange scarf is caught on the new lamp outside their house. The lamps walk in the dark, and they freeze in a beam of light. He pins a lamp in a flashlight beam, smashes it, and his brother tumbles out. The whole town frees everyone with headlights.
- **Idea:** the streetlights aren't protecting us; they're the ones taking us.
- **Outrageous:** the "tap, tap, I'm home" porch-light flicker comes back *from the lamp*.
- **Escalation:** counting the lamps → looking at the dark → the lamps walk → the ladder.
- **Closer:** "this morning, there was a brand new streetlight… Nobody is missing. So whose light is that?" (Open-loop sting.)

**13 · Everyone lives underground (129 s, conspiracy, B-tier)**
The surface is said to be poison. He climbs a hidden ladder ("KEEP THE SUN OUT") and finds a green world and a tower of monitors watching the cities. A reset begins; the screens broadcast "THE SURFACE IS SAFE"; people climb up. The old man is gone, and a boy in his exact clothes says "now it's my turn".
- **Idea:** the surface isn't dangerous; it's a cover-up.
- **Closer:** a doppelganger sting.
- **Riff:** *City of Ember* (commenters said so), *Silo/Wool*, *The Truman Show*.

**14 · Everyone lives inside a supermarket (119 s, horror, B-tier)**
An endless store; when the lights go out, employees turn blank and hunt. He finds his sister and they hide under a display bed. Next morning a "new employee" walks in wearing their father's clothes.
- **Idea:** an endless store with night-shift monsters.
- **Closer:** "He was wearing my father's clothes, and he was smiling."
- **Riff:** the internet legend of the infinite furniture store with faceless staff.

**15 · The last submarine (170 s, horror)**
The last 60 people on Earth live on a sub that must never stop. A sonar dot follows them. They go dark, the dot vanishes ("sonar can't see anything touching you"), and the "snow" outside the window stops: it's an eye. Dad shoves him into the escape pod, and the sub is eaten in one bite. Drifting, the pod's sonar pings.
- **Idea:** the last humans on a sub that can't stop moving.
- **Closer:** "It's right behind me." (The same words as the lost sub's last call.)
- **Riff:** *It Follows* meets an underwater *Snowpiercer*.

**16 · A number counts who chose you (115 s, wholesome, B-tier)**
His number is 0. New girl Ren's number for him goes up while they're friends. He thinks she left him for the popular kids. She says it counts the times she chose him *when she had other options*. It ticks to 21.
- **Idea:** a public score of how wanted you are.
- **Closer:** "My number wasn't zero because nobody wanted me…"
- **Riff:** the "soulmate counter" fan trope.

**17 · Weather follows your mood (129 s, comedy, cartoon style)**
Everyone has a personal sky; he's "Drizzle", the grumpiest kid. In a 40-day heatwave the town needs him grumpy for three days: broccoli breakfast, a Saturday pop quiz, toes stepped on. Mia stays away so he can't smile. His storm saves the town.
- **Idea:** your mood is your weather.
- **Outrageous:** the mayor has a personal sun; a toddler's tantrum is a tornado.
- **Closer:** "Now everyone in town is super nice to me. It's completely ruining my weather."

**18 · Santa lands on the brightest house (110 s, holiday, cartoon style)**
An arms race of Christmas lights (stadium floodlights, laser reindeer, 40,000 strings). His house has one sad bulb. A blizzard knocks out all power, and Santa is lost. His grandpa's crank flashlight is the only light in town.
- **Idea:** the brightest house wins Christmas.
- **Closer:** "The next year everybody in town bought one sad bulb."
- **Riff:** Rudolph's guiding light.

**19 · A star when someone misses you (108 s, wholesome, B-tier)**
He has 0 stars. Quiet Celeste has 37. They become friends; she moves away. Stars appear over him, and her message says she misses lunch with him.
- **Idea:** a visible count of who misses you.
- **Closer:** "Save me a seat… I already have."

---

## 4. Ideas: what makes them hooky

### 4.1 The 19 ideas and their premise formulas
| # | Core idea | Formula | Twist type |
|---|---|---|---|
| 01 | Chalk lines are walls; the collector takes what's outside | F2 Curfew rule | T1 Rule used as a weapon |
| 02 | Everyone has wings except me | F1 Everyone except me | T3 Weakness is the strength |
| 03 | Town inside a whale | F4 Container world | T1 The world's own function (the sneeze) as weapon |
| 04 | Wishes paid with whoever greets you first | F3 Bargain/offering | T4 Wording loophole |
| 05 | I'm an NPC in a game world | F6 Two classes | T3 + T1 (the admin's hammer) |
| 06 | Every porch feeds the great beast | F3 Bargain/offering | T2 Hidden truth (Mom is the beast) |
| 07 | Worst moment printed on your shirt | F1 Everyone must show X | T6 Wholesome inversion |
| 08 | Superpower on your worst day | F5 Fate lottery | T3 + revenge |
| 09 | Whistle and something whistles back | F2 Curfew rule | T1 Exploit the rule's blind spot |
| 10 | Every kid has a monster under the bed | F3 Bargain/offering | T2 The monster is the protector |
| 11 | Smaller means stronger magic | F6 Two classes | T4 Wording loophole |
| 12 | Be home before the streetlights go out | F2 Curfew rule | T2 + T1 + T5 sting |
| 13 | Everyone lives underground | F4 Container world | T2 Cover-up + T5 sting |
| 14 | Everyone lives in a supermarket | F4 Container world + F2 | T5 Sting |
| 15 | The last humans on a sub that can't stop | F4 Container world | T5 Sting (echo of the opening) |
| 16 | A number counts who chose you | F1 Everyone has a visible X | T2 The number means something else |
| 17 | Weather follows your mood | F1 Everyone has a visible X | T3 Weakness is the strength |
| 18 | Santa lands on the brightest house | F1 + competition | T3 Weakness is the strength |
| 19 | A star when someone misses you | F1 Everyone has a visible X | T6 Wholesome |

**Formula families**
- **F1 "Everyone has X, except me":** a visible stat, gift or marker that everyone has. The narrator lacks it or has the worst one.
- **F2 "Never do X after dark, or Y":** a curfew rule with a monster attached. The rule is simple, physical and kid-explainable.
- **F3 "Every night we give X to Y":** an offering, deal or bargain with something unseen.
- **F4 "Our whole town lives inside/on Z":** the world is a container (whale, canyon, store, sub, underground). The container's own quirks are the tools.
- **F5 "Everyone gets X when Y happens":** a lottery of fate. The narrator's draw looks useless.
- **F6 "Some are A, the rest of us are B":** a caste system (players/NPCs, small/tall) that the B narrator breaks.

**Twist types**
- **T1 Rule used as a weapon:** the monster or system is beaten by its own law (chalk circle, the greeter greets first, a lamp frozen in light, "Banned!").
- **T2 Hidden truth:** the protector is the monster, the monster is the protector, or the rule means something else.
- **T3 Weakness is the strength:** the thing they mocked is the only thing that works.
- **T4 Wording loophole / monkey's paw.**
- **T5 Open-loop sting:** it isn't over ("So whose light is that?", "It's right behind me.").
- **T6 Wholesome inversion:** the rule was about love all along.

### 4.2 What makes them hooky
1. **Absurdity stated as plain fact.** The narrator never says "imagine if"; it's just how the town works. The deadpan delivery of an insane rule is the joke and the hook. *Absurd mechanics plus mundane details* ("the pizza guy stops delivering at six") makes the world feel lived-in in 10 seconds.
2. **Three concrete examples before the story starts.** Named neighbours suffering from the rule (Mr. Pickett's parrot, Mrs. Dale's dog). Each is a mini-joke and teaches the rule without explaining it.
3. **The rule has a price, stated early.** "Belongs to the collector", "gone by morning", "one of them would be gone". Viewers stay to see the price paid or dodged.
4. **The narrator is the exception.** No wings, a blank shirt, 0, grumpy, one bulb, an NPC. Underdog plus outsider is instant sympathy, and it sets up T3.
5. **A planted prop.** Chalk in the pocket, the rope coil, the feather duster, cookies, the crank flashlight, the "Age 12" note. The payoff feels earned *and* surprising, which is why people rewatch and comment "wait…".
6. **Escalation in threes, each step physical and visible.** Lights go out one by one → a scrape → something taller than the streetlights.
7. **The climax uses the world's own logic.** No new magic at the end; the viewer could have guessed it, and that's the satisfaction.
8. **A quotable last line that flips the first.** "Now when it rains, they call me." "I scratch back." "I'm never hungry." Endings designed to be quoted in comments.
9. **Emotional core under the absurdity:** a dead mom, a missing brother, a dad who sacrifices himself, a lonely kid. The absurd premise gets the click; the family stakes get the watch time.
10. **Kid logic, PG fear:** monsters, the dark, being left out. No gore. Fear is suggested (silhouettes, an eye, "gone").

### 4.3 The "famous premise" pattern
At least 7 of 19 are remixes of famous stories, with their names changed:
- **05** = *Free Guy* (an NPC wakes up).
- **13** = *City of Ember* / *Silo* / *Truman Show* (never go up; the surface is a lie). Commenters named it.
- **14** = the internet legend of the endless furniture store with faceless staff.
- **15** = *It Follows* (something that never stops following) in an underwater *Snowpiercer*.
- **09** = folk "don't whistle at night" plus *The Mimic*.
- **11** = Gulliver's Lilliput plus *The Monkey's Paw*.
- **18** = Rudolph's guiding light.
- **06** has *The Village*'s offering-to-the-woods feel.
- **04** uses the old folk-tale "first thing that greets you" bargain.

**Why it works:** the viewer half-recognizes the shape (familiar, and therefore easy to follow), but the blocky world and new names make it feel new.

**How we use it:** the writer may borrow a *structure* ("a sealed world that lies about the outside", "a deal paid by the first greeting"). It must **never** reuse titles, character or place names, signature objects or lines from the source, and never name the source in the video. Every world, town and character name is original. A code check blocks a list of famous titles and names (plus Roblox terms, see §6.6) in the script.

---

## 5. Thirty new original ideas (same formulas)

Every one opens with the mandatory line. Each entry gives the opener line, the escalation and the closer/twist, with the formula family and twist type in brackets.

1. **In this town, if you write your name in fresh snow, the Snowkeeper takes you by morning.** Kids sign everything "Bob". The narrator's little sister writes her real name. Three nights of running; the Snowkeeper always finds the name. The narrator finds the Snowkeeper's own name carved under the frozen well and writes it, huge, across the town square. *Closer:* "Now every winter, the whole town writes their names in the snow. Really big." [F2, T1]
2. **In this world, everyone has a price tag floating over their head, and mine says one cent.** A Collector buys up the town's most valuable people for his glass vault. Nobody guards a one-cent kid, so he walks straight into the vault and swaps every tag to one cent. The Collector's money is worthless. *Closer:* "My tag still says one cent. Turns out that's what a real friend costs." [F1, T3]
3. **In this town, gravity switches off for one minute every midnight, so everything is bolted down.** Beds have seatbelts; dogs wear weighted boots. One night the minute doesn't end. The town floats up toward a dark shape in the sky that's been *fishing* every midnight. Only the kid who secretly practiced floating can swim through the air to the clock tower. *Closer:* "Now at midnight, the kids fish back." [F2, T3]
4. **In this town, anything you lose ends up at the Lost and Found on Elm Street, run by a lady who never blinks.** Socks, keys, a whole dog. The narrator's little brother vanishes at the fair, and he isn't there. "He wasn't lost," she says. "He was *taken*." The only way into the place where taken things go is to get yourself lost on purpose. *Closer:* the lady blinks for the first time. [F3, T2]
5. **In this town, if you speak above a whisper, the Listener in the water tower hears your name.** Birthday parties in sign language; a silent football crowd. The narrator's baby sister is born, and babies cry. The Listener climbs down. It only hears *names*, so the whole town screams one fake name at once from the far hill. *Closer:* "Every baby here gets a secret name now. Mine? I'll whisper it." [F2, T1]
6. **In this world, you grow an inch every time someone laughs at you.** The most-mocked kid is 40 feet tall and lives in the park. Bullies start begging to be laughed at. Then the dam cracks, and only someone that tall can hold it. *Closer:* "They still laugh at me. Now it's because I'm funny." [F1, T3]
7. **In this town, every house sleepwalks to a new street each night, so you always wake up with new neighbours.** Our house starts running in its sleep, toward the cliff, away from the new house next door, which has no doors. The narrator wakes every house on the street for a stampede. *Closer:* "Now our street sleeps in a circle, all the doors facing out." [F4, T2]
8. **In this town, your echo answers one day late, so the canyon is full of yesterday.** The narrator hears tomorrow's echo: his best friend screaming. A day-long race to stop whatever causes it. *Twist:* the scream was his friend cheering after the narrator saved him. *Closer:* "Today I yelled 'thank you' into the canyon. Tomorrow I'll find out who for." [F5, T2]
9. **In this world, every kid gets a pet at birth, and it's the animal you'll turn into at 13.** Lions, eagles, sharks. The narrator's is a rock. At 13, a flood/stampede/giant threat comes, and he becomes a mountain that holds back the river. *Closer:* "My rock still sits on my desk. It's the only one who wasn't surprised." [F1/F5, T3]
10. **In this town, the map redraws itself every night, and only kids can read it.** Grown-ups get lost going to the kitchen. One morning Dad's street is gone from the map. The map erases what nobody remembers, so the narrator gets the whole town to tell stories about Dad until his street ink comes back. *Closer:* "Every night now, I tell the map one story about each of you." [F4, T2]
11. **In this town, anything stuck under a school desk comes alive at midnight.** Gum gremlins. Under the principal's desk, 40 years of gum has become a giant. The narrator is the only kid who never stuck gum, so it doesn't know him. He walks it out of the school with one fresh piece. *Closer:* "Now it's the school mascot. Don't ask where it sleeps." [F2, T1]
12. **In this town, snowmen guard your house all winter, and every family builds one the night of the first snow.** The narrator's is lopsided and laughed at. The Thaw comes, a warm wind that melts guards and lets things in. The lopsided one holds longest, because he built it in the shade. *Closer:* "Every year I build him again. He still leans. He's still the last one standing." [F1/F3, T3]
13. **In this town, every minute you're late, the Clock Tower takes from your summer vacation.** The narrator, always late, owes 40 summers. The tower comes to collect. The narrator proves the tower's own clock runs slow, so it owes everyone in town. *Closer:* "Summer lasted nine months that year." [F2, T4]
14. **In this town, there's a shop that prints a copy of you for one day, so you can skip school.** Rule: pick up your copy before midnight. The narrator forgets. His copy is nicer, smarter and more liked, and it won't give his life back. *Sting:* the copy was also too busy to pick up *its* copy. "There are three of me now. And one of us is lying." [F3, T5]
15. **In this world, pets can talk for exactly one minute a year, on New Year's.** Everyone saves questions all year. The narrator's dog spends its minute on one warning: "Don't trust the cat." Escalation: the cat's odd behaviour, missing socks, a hole in the wall. *Twist:* the cat was guarding the house from the thing in the walls all along. *Closer:* "Next New Year's I'm asking the cat." [F5, T2]
16. **In this world, every photo taken of you adds one minute to your life, so grandmas chase babies with cameras.** The new kid has zero photos and starts fading. The whole town photographs him. *Closer:* "I have 40,000 photos now. Most of them are blurry. All of them are mine." [F1, T6]
17. **In this town, when your grandparent dies, you inherit their nightmare monster.** The narrator gets Grandma's: a tiny, polite monster that knits. Everyone laughs, until the other kids' monsters go wild and every one of them is terrified of Grandma's. *Closer:* "Turns out Grandma's monster was scared of only one thing. Grandma." [F3, T2]
18. **In this town, you only hear the ice-cream truck when it's coming for you.** Its jingle means you're next. The narrator hears it. Rule found in an old menu: it can't take anyone already holding its ice cream. He buys a cone with his last coin. *Closer:* "It still drives by every summer. It never stops at my house. I think it's sulking." [F2, T1]
19. **In this world, people are born old and get younger every year.** Kids babysit their grandparents, who are toddlers now. Grandpa, now 5, is the only one who remembers how the river was stopped 70 years ago, and he can barely talk. *Closer:* "Grandpa's a baby now. I still tell him he saved the town." [F5, T3]
20. **In this town, the floor is lava every Tuesday.** Couches are bridges; school runs on tables. The narrator is the scaredy-cat who never touches the ground, even on Wednesdays. One Tuesday never ends and the lava rises. His couch-hopping routes save everyone. *Closer:* "Now every Tuesday, I'm the one leading the parade over the furniture." [F2, T3]
21. **In this world, when you sneeze, a tiny copy of you pops out and runs off.** The narrator is allergic to everything, so there are thousands of tiny hims around town. When the storm drain floods with a kid stuck inside, they form a ladder. *Closer:* "I'm still allergic to cats. I'm keeping the cat." [F1, T3]
22. **In this town, it rains something different every day: Monday spaghetti, Tuesday socks.** The weatherman's forecast for Friday: "people". The narrator traces the sky's junk to a cloud that's swallowing a town upstream, and steers it with an umbrella made of 200 Tuesday socks. *Closer:* "Today's forecast: pancakes. I'm bringing syrup." [F4, T1]
23. **In this world, your dreams arrive in the mail the next morning, sealed in an envelope.** The narrator gets someone else's nightmare by mistake, with a return address. Inside: a kid trapped in the same dream every night for a year. He mails himself into it. *Closer:* "Some mornings I get her dreams. They're the good kind now." [F3, T2]
24. **In this town, on the longest night of the year, the whole town plays hide-and-seek against the thing in the hills, and it has never lost.** Kids hide in ovens, in trees, under the river ice. The narrator volunteers to *seek* instead. Nobody ever looked for the thing, so it never hid well. *Closer:* "Found you." [F3, T1]
25. **In this town, our sun is a giant lamp on the cavern ceiling, and this year it started to flicker.** The council says don't worry. The narrator climbs the cable to change the bulb and finds a note from the last kid who tried, 50 years ago. The bulb was never meant to last; there's a door behind it. *Closer:* the narrator's hand on a handle marked "OUT". (An original-world remix of the sealed-world formula.) [F4, T2]
26. **In this world, everyone lives in one endless tower, and the elevator only goes up.** Floors come and go; nobody has seen the ground. A "down" button appears for the first time, beside the narrator's floor. Every floor below is the same family's apartment, getting older. *Sting:* the bottom floor is his own apartment, and he's never left. [F4, T5]
27. **In this town, your shadow goes to work at night while you sleep.** Shadows pay the bills. The narrator's shadow comes home tired, quits, and starts living his day life better than he does. The narrator works the night shift to win it back, and finds out what shadows have been protecting the town from. *Closer:* "We split the shifts now. He gets Mondays." [F1, T2]
28. **In this town, every kid gets one do-over, a single button that rewinds ten seconds, and you only get one for life.** Kids carry theirs in lockets. The narrator wasted his at age six on a spilled ice cream. Ten years later the bridge collapses. Dad never used his; he gives it to his son. *Closer:* "Dad still has nothing in his locket. He says he's never needed it." [F5, T6]
29. **In this world, every house has a door that opens into the house you'll live in someday.** The narrator's opens into a burning, empty house. He spends the story changing the future, one choice at a time, watching the door. *Closer:* "This morning the door opened onto a messy kitchen and someone yelling my name for breakfast." [F4, T6]
30. **In this town, every dog can see the Leftovers, the people nobody remembers, and barks at them.** Barking nights get worse. The narrator's old dog won't stop barking at the empty chair at dinner. *Twist:* it's his big sister, forgotten by everyone but the dog. Remembering her together brings her back. *Closer:* "Now every night, our dog barks twice at the dinner table. Once for each of us he's glad he didn't forget." [F3, T2]

Coverage: F1 ×8, F2 ×7, F3 ×6, F4 ×6, F5 ×4, F6 ×0 (many cross-tag). The mood mix is about ⅓ horror, ⅓ wholesome/comedy, ⅓ adventure/twist. Moods are chosen in the generator.

---

## 6. Build plan: the "Blocky Worlds" template

### 6.1 What we can reuse (checked on `laptop-transfer`)
- **Rendering:** Cutaway already renders blocky three.js scenes in headless Chrome to mp4 (`scripts/cutaway/proto3d/render.mjs`, `kit/`). It runs on the **RunPod L4 GPU endpoint** (measured: 30 s video ≈ 82 s render ≈ **$0.024**) with a Fly CPU fallback. Its job flow (`cutaway-api` / callback / watchdog, the m3 worker image, refunds, failure-case replay, caps on /admin/ops) is in production.
- **Voice:** ElevenLabs takes plus the word-by-word voice checker (`m2/voiceCheck.mjs`, faster-whisper) and word timings → `captions.ass`.
- **Final mix:** the render worker's caption burn-in and mastering (−16 LUFS), fonts (Anton, Inter, Lilita One; Lilita is the closest match to the reference captions), SFX library.
- **UI:** Blocky Stories' **Story step**: three tabs, "Pick an idea" (idea cards + "New ideas"), "Describe it", "My own script". Also its per-user used-ideas memory and the upload pack. Plus Cutaway's **one-click Generate → progress → result/Recent Creations** flow, since nothing here needs paid pictures to approve.

**Proposal:** Blocky Worlds is its **own template** (like Blocky Stories vs Fruit: no shared code paths that could change a live product). It copies the patterns above and reuses the Cutaway render *infrastructure* (RunPod endpoint, worker image builder) with a new scene kit. Blocky Stories and Cutaway stay untouched.

### 6.2 User flow (same layout as our templates)
1. **Story:** three tabs:
   - **Pick an idea:** 6 generated cards. Each shows the opener line in big text ("In this town, …"), a one-line premise, a mood chip (Horror / Wholesome / Funny / Epic) and a twist teaser. "New ideas" rotates formulas; a mood filter is available.
   - **Your topic:** the user types anything ("homework", "my cat", "a haunted pool"). Zyvo turns it into 3 outrageous world rules in the formula, the user picks one, then the full story is written.
   - **My own script:** pasted text. It must pass the opener rule (offer a one-click fix if it doesn't).
2. **Script review:** the full script, with beats shown (Rule / World tour / Me / Until one night / Discovery / Climax / Closer), editable. "Rewrite" (free a few times). Length picker: 60 / 90 / 120 s.
3. **Settings:** voice (2–3 narrator voices), captions on/off, live price.
4. **Generate:** progress view (Cutaway's), then the final player, Download, and the upload pack (title, description, hashtags), as in Blocky Stories.

### 6.3 The idea generator and script writer (the core)
- **Idea engine:** each card is built from **formula (F1–F6) × twist type (T1–T6) × setting × mood**. A batch of 6 uses 6 different formula/twist pairs; a per-user used-ideas memory prevents repeats (Blocky Stories pattern). Every idea must state:
  - the rule (≤ 15 words);
  - the price of breaking it;
  - 3 example jokes;
  - the narrator's exception;
  - the planted prop;
  - the twist;
  - the closer line.

  It's validated as JSON before it's shown.
- **Topic → idea:** "Turn [topic] into a world rule that everyone in a town lives by, with a price." The three options come from three different formulas.
- **Script writer:** the 7-part skeleton in §2.2 with word budgets from length × 255 words per minute (120 s ≈ 500 words). A-tier rules: named neighbours, concrete absurd details, kid voice with one wry joke per section, inline dialogue, onomatopoeia beats, 3-step escalation, the planted prop paying off, a closer that calls back line 1. Banned: "Suddenly", "I realized something", spelled-out morals, "I was a 16-year-old boy who…".
- **HARD RULE (baked in, enforced in code, not only in the prompt):**
  - `script.lines[0]` must match `^In this (world|town), ` (exact capitalization and comma).
  - The writer prompt states it, a code check rejects anything else, and one automatic rewrite of just the first line is tried before failing.
  - The idea cards show the opener too, so it's visible from the first click.
  - Own scripts are checked the same way, with a fix button.
  - Tests cover it.
- **Safety and originality check (code):**
  - a blocklist of famous titles, character and place names (from §4.3, extendable);
  - Roblox terms (Roblox, Robux, "oof", noob, Bloxburg, etc.);
  - real people;
  - gore words.

  PG fear only.

### 6.4 From script to video
1. **Voice:** one ElevenLabs narrator take per video (kid/teen voice), checked word by word, with word timings.
2. **Shot planner (LLM → JSON):** one shot per sentence, extra shots for examples. Each shot picks from a **fixed vocabulary**: set, characters + face sticker, props, camera type (§2.4), lighting state, weather, FX, and optional in-world text (sign, note, screen, newspaper). Code checks it, as Cutaway does ("AI decides WHAT, code decides HOW").
3. **Blocky Worlds kit (three.js, new):**
   - **Characters:** one original chunky rig with swappable hair, outfits, signature items and **our own face-sticker set** (≈14 emotions), with simple poses (stand, walk, run, point, cower, carry, climb, sit, lie, fall, hug, cheer). Monsters are built from parts: tall-thin, giant-furry, faceless, glowing-eye, giant-eye, "object comes alive".
   - **Sets (~12 to start):** suburb street, house interior (bedroom/kitchen/living), school (hall/cafeteria/classroom/stage), woods edge, town square, farm, canyon/cliff town, castle/throne, underground/cave, underwater/sub interior, "giant interior" (store, whale, tower), snowy town. All recolourable by lighting state.
   - **The rule made visible:** over-head markers (numbers, stars, icons, clouds), ground lines/circles, printed text on clothing, signs/billboards, glow FX.
   - **Inserts:** paper note, letter, newspaper, phone, monitor, calendar, photo, rendered as 3D planes with text.
   - **Lighting presets:** day, dusk, blue night, purple fog, storm/rain, snow, warm interior, sunrise. Each story's arc maps across them.
4. **Edit:** hard cuts on sentence or word boundaries; one-word captions (Lilita-style, white with black outline, ~70% down, danger word red); a music bed under the voice at about −20 dB, with stingers at the reveal and climax; onomatopoeia SFX.
5. **Render:** RunPod GPU (existing endpoint pattern), Fly CPU fallback, the existing callback, refund and failure-replay flow.

### 6.5 Cost per video (estimate, to be measured in M1)
| Item | 120 s video |
|---|---|
| Idea + script + shot plan (Claude) | ≈ $0.05–0.12 |
| Voice, ≈500 words (ElevenLabs, ~2,700 chars) | ≈ $0.15–0.25 |
| GPU render (≈60–80 shots, 30 fps) | ≈ $0.10–0.25 |
| Optional vision spot-check of a few frames | ≈ $0.02–0.05 |
| **Total** | **≈ $0.35–0.65** |

No AI images or video, so the look stays the same from video to video.

### 6.6 Look and originality guardrails
- **Our own blocky look:** chunky square-limbed characters, but **not** the classic yellow-head / blue-torso / green-legs palette and **not** the classic smile face. Our own sticker faces and our own font. No game UI (name tags, respawn pads, server screens, "admin" hammer). No Roblox name, logo or terms anywhere: script, UI, upload text.
- **Style target:** the "game-engine blocky look" (§2.8 style 1): saturated, foggy depth, bloom on glows, strong night blues.

### 6.7 Milestones (each ends with your review, like Cutaway)
- **M0 Look frames (free, local GPU):** 3 style frames of one of the 30 ideas (e.g. #5 "the Listener"): the characters, one set, night lighting, a monster low-angle shot and one caption. You pick a look.
- **M1 One hand-built video:** one full 90–120 s video from one new idea. The script is written by me with the new writer prompt, the shots placed by hand with the kit. The only paid step is **one voice take: ≈ $0.20, asked first**. You judge it next to the references.
- **M2 Auto pipeline:**
  - idea generator plus topic-to-idea;
  - script writer with the opener rule and its tests;
  - shot planner;
  - kit growth to ~12 sets;
  - free replay harness (Cutaway's).

  Paid checks only on your go, with exact costs.
- **M3 Template:** the UI (copied flow), API/worker, pricing (cost × our margin rule), owner-only switch, then launch steps.

Rough size: M0 1 day, M1 3–5 days, M2 1.5–2 weeks, M3 1 week. The kit (characters + sets) is the biggest piece.

### 6.8 Decisions for you
1. **Start M0 now?** It's free; I make 3 look frames.
2. **Which idea for M1?** I suggest #5 (the Listener), #20 (the floor is lava on Tuesdays) or #3 (the gravity minute). Or one of yours.
3. **Narration speed:** match the references' ≈260 words per minute (fast, as the hits are), or slower?
4. **Git:** this folder isn't committed. The videos (≈350 MB) and `work/` should stay out of git. I'd commit only `ANALYSIS.md` to `laptop-transfer` (it's 36 commits behind its remote, and the working folder is on another branch, so I'd do it without switching branches).
