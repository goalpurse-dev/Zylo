NEW TEMPLATE: ROBLOX-STYLE TALKING AVATAR STORIES (working name "Blocky Stories").
This message is the FULL SCOPE of the project, then Phase 0. Phase 0 is READ-ONLY:
no code changes, no paid calls. First save this whole scope, unchanged, to
docs/roblox-scope.md so every later phase can read it.

═══════════════════════════════
PART A — WHAT WE'RE BUILDING
═══════════════════════════════
A new short-form template where users make 15s-2min vertical videos of Roblox-style blocky
avatars acting out a story and TALKING (lip-synced dialogue). Think of the viral "Roblox story"
Shorts: fake admin pranks, glitches, server rules, trades gone wrong, all ending on a twist.

The competitor is Korpi AI, where users copy-paste scripts from ChatGPT/Claude by hand. We do
the whole thing in one place: ideas, script, characters, scenes, talking clips, final video,
and the YouTube upload text.

THE KEY DECISION: this is AI Fruit Story v2 with a new skin. Fruit v2 already has everything
the core flow needs (idea / describe / own script tabs, single + series, scene pictures with
edit/regenerate, V2/V3/V4 lip-sync clips, final video on Fly with captions, pricing, the
out-of-credit guard). Reuse it as much as possible. Do NOT rebuild what already works.
Fruit's behavior and tests must stay exactly the same.

═══════════════════════════════
PART B — USER FLOW (same layout as Fruit v2)
═══════════════════════════════
Top of builder: "Single video / Series" toggle.

STEP 1 — STORY, three tabs:
- Pick an idea: 5 idea cards (hook title, 2-3 sentence premise, dominant emotion, suggested
  cast from the avatar library) + "New ideas" button.
- Describe it: pick 1-3 avatars, type an idea (max 1000 chars), Zyvo writes the full script.
- My own script: pick avatars, rows of speaker + line, used exactly as written.

STEP 2 — SETTINGS: quality V2/V3/V4 (locked by plan, same as Fruit), length slider, 9:16
(and 16:9 if Fruit supports it), live cost card, "Make scene pictures" button with its price.
The user only pays for video after approving the pictures.

STEP 3 — SCENES: storyboard grid. Each card: picture, speaker + line, on-screen caption
(if any), Edit / Regenerate with price. Users can customize every scene separately.

STEP 4 — CLIPS: each clip plays inline, "Regenerate clip" with price.

STEP 5 — FINAL VIDEO: player, captions toggle, Download, plus the UPLOAD PACK (Part E).

SERIES: same as Fruit v2 (series plan with episodes and cliffhangers, episodes unlock in
order, same cast every episode).

═══════════════════════════════
PART C — WHAT'S NEW FOR ROBLOX
═══════════════════════════════
1. IDEA ENGINE. Ideas come from 10 narrative engines:
   1 forbidden power with a hidden cost
   2 a glitch/exploit that reveals something it shouldn't
   3 a prank or scheme that spirals out of control
   4 a countdown / ticking clock
   5 a hidden villain or admin abusing power on players
   6 a moral dilemma with no clean right answer
   7 a secret about the character's own avatar/account
   8 a trade/deal that costs more than expected
   9 a server rule that turns sinister if broken
   10 a transformation (avatar, skin, identity) that changes who they become
   Each batch = 5 ideas from 5 DIFFERENT engines. "New ideas" uses the other 5, then
   rotates. Keep a per-user USED IDEAS memory and pass recent ones to the writer so it never
   repeats or lightly rewords them. Banned overused plots: power-copying, the invisible-friend
   glitch, generic "prank on mom/sibling", "hacker steals everything" with no twist,
   "I played as a noob for a day" kindness lessons.
   Every idea must: hook in the first 2 seconds (open mid-action or mid-mystery), rest on ONE
   "what happens if" premise clear from the title alone, escalate every scene, end on a twist
   or gut-punch line, have ONE dominant emotion (curiosity, dread, injustice, satisfaction,
   or shock), and be doable in 1-3 locations with 2-3 characters.

2. SCRIPT RULES (story writer):
   - Feels native to Roblox: obbies, admin commands, servers, trades, leaderboards, NPCs,
     badges, spawn pads, kill bricks, gamepasses, lag, rejoining.
   - First line drops the viewer mid-conflict. No "hi guys", no slow setup.
   - Dialogue sounds spoken: contractions, interruptions, reactions, varied line lengths.
   - Every scene raises the stakes. The LAST line is the most quotable line in the video.
   - Word budget ~2.5 spoken words per second of video (60s = 130-155 words).
   - Scene count scales with length, using Fruit v2's existing rules.
   - Exact names: character and location names are spelled identically everywhere.
   - Max 3 characters visible per scene, max 2 speaking.

3. AVATAR LIBRARY: blocky avatars with a locked look and voice, like the 170 fruits.
   Start with ~24 that contrast strongly in color and silhouette (include a plain default
   "noob" avatar, since it's a key story archetype). Each avatar: one-word name, look
   description (skin color, hair, face decal, shirt with a simple shape and no words,
   pants, ONE signature accessory), voice describing only how it SOUNDS (the scene decides
   the emotion, same fix as Fruit), and role tags. LATER phase: users create their own
   avatar and save it to their library.

4. LOCATION LOCK: a preset library of ~12 common locations (e.g. Town Square, Spawn Area,
   Lava Obby, Obby Tower, School Hallway, Café, Trading Plaza, Admin Room), each with one
   reference picture made once. Stories use 1-3 locations. The location's reference picture
   is passed to every scene picture in that location so it looks the same every time.
   Custom locations get one reference picture made per story.

5. STYLE LOCK: one fixed style block for every picture and clip: 3D classic blocky
   Roblox-style avatars (cube heads, rectangular torsos, block arms and legs, smooth matte
   plastic, simple flat 2D face decals), chunky low-poly world built from studded bricks,
   bright clean soft-shadow lighting, playful game-world look, no morphing, no extra limbs,
   identical proportions and outfits throughout. No neon purple/cyan cyberpunk default look.

6. NO READABLE TEXT IN PICTURES OR CLIPS. AI garbles letters. If the story needs text
   (an "OWNER" tag, chat messages, a countdown), the picture shows a blank glowing shape in
   that spot, and the real words are stored as a per-scene CAPTION OVERLAY that the Fly
   final-video step draws on top. No logos at all (the Fruit test drew an Apple logo).

7. BRAND + KID SAFETY: never show the Roblox logo, real game names or logos, real YouTubers
   or real usernames. "Exploits" and "hacks" are story devices only, never real working ones.
   Kid-safe: no blood, gore, real-world weapons, romance, or dangerous real-world stunts.
   Don't use "Roblox" in the template's in-app name (trademark); the SEO page can say
   "Roblox-style animation".

═══════════════════════════════
PART D — MODELS + PRICES
═══════════════════════════════
- Scene pictures, edits, location references: Nano Banana 2 Lite (same as Fruit).
- Avatar library: Nano Banana 2 Lite unless the comparison test shows Pro is clearly better.
- Clips: same tiers as Fruit: V2 Wan2.6 Flash (Seedance 2.0 Mini fallback), V3 Seedance 2.0
  Mini, V4 Veo 3.1 Fast. Same no-cut rule and speaker-faces-camera framing.
- Prices: same as Fruit (4 credits per picture/edit, 5/9/16 credits per second for V2/V3/V4)
  unless Roblox tests show a different real cost.
- THE BIG RISK: lip sync on flat decal faces. The model may animate the mouth badly or turn
  it into a realistic mouth. This is the FIRST paid test, before any other paid work.

═══════════════════════════════
PART E — UPLOAD PACK (final screen)
═══════════════════════════════
One cheap text call after the final video:
- YouTube title: hard cap 100 chars incl. hashtags, strongest hook in the first 40 chars,
  2-4 search keywords woven in naturally, teases the twist without spoiling it. Show the count.
- Description under 500 chars: hook + keywords, a comment-bait question, 3-5 hashtags.
- Tags: comma-separated, priority order, hard cap 500 chars.
- Pinned comment: one debate question that splits viewers into two sides.
- TikTok/Reels caption under 150 chars + 3-5 hashtags.
Each with a copy button.

═══════════════════════════════
PART F — DESIGN + LAYOUT
═══════════════════════════════
- Lime visual family, same as Fruit v2 (#BEF264 and the existing tokens in
  docs/zyvo-design-tokens.md). Reuse the shared components in src/components/ui/zyvo/.
- DESKTOP: builder on the LEFT, results on the RIGHT (Recent creations when idle).
- MOBILE: Build / Your video tabs, no nested scroll areas, nothing hidden behind the bottom
  nav. Same fixes as Fruit v2.

═══════════════════════════════
PART G — WORKING RULES (every phase)
═══════════════════════════════
- Local only, never push, unless I say so. Commit in small logical steps.
- Paid calls OFF by default. Total Roblox testing budget: $5 hard cap. Every paid step
  states its estimated cost first, and the running total is reported after it.
- Stop for my input only at the checkpoints I mark.
- Fruit tests must pass after every change.

═══════════════════════════════
PHASE 0 — READ-ONLY AUDIT + PLAN
═══════════════════════════════
Write the result to docs/roblox-phase0-plan.md.

1. FRUIT V2 STATUS. Answer each:
   a) Is Fruit v2 pushed/merged, or still local? Which commit/branch?
   b) Is it live for everyone, or still behind the flag? Is v1 removed?
   c) What's left on the Fruit launch checklist (mobile QA, rollout, v1 removal, the picture
      prompt re-check for small faces and the human listener, the logo issue)?
   d) Do all fruit tests pass? Report the count.
   e) Any known bugs or open issues?
   f) Your recommendation: finish Fruit's launch first, or build Roblox on the same branch
      in parallel? Which branch should Roblox build on?
2. MAP FRUIT V2: list the files for the UI, the data contract (fruitStoryV2Api.js), story
   writer, idea generator, scene picture prompts, clip prompts, character library (schema +
   storage), series, final video (Fly), captions, pricing, and the out-of-credit guard.
   Mark each one REUSE AS-IS / NEEDS NICHE CONFIG / FRUIT-ONLY.
3. NICHE CONFIG: propose the smallest change that lets one engine serve Fruit and Roblox
   (e.g. a niche key on stories/series rows + one config module per niche: style lock, idea
   engines, writer rules, library source, voice rules, location handling, caption overlays,
   upload pack, price keys). Compare it with copying the Fruit v2 folders and recommend one.
   Fruit's behavior must not change.
4. ROBLOX GAPS: for each item in Part C and Part E, say where it lives and estimate the effort.
5. LAYOUT: confirm Fruit v2's desktop puts the builder left and results right. If not,
   say what changes.
6. TEST PLAN: the cheapest test order under the $5 cap, with the cost of each test.
   Test 1 must be the lip-sync check (3 x 5s clips on V2 Wan with blocky decal-face avatars).
   Also include: 6 avatars on Nano Banana 2 Lite vs 3 on Pro, 1 location + 4 scene pictures,
   V3/V4 single clips only if V2 fails, then one full 30s story on V2. Separately, estimate
   the one-time cost of the 24-avatar and 12-location libraries.
7. PHASES: the full phase list from here to launch, with effort and cost for each, and
   anything you'd do differently from this scope.

REPORT: a summary of 30 lines or fewer (Fruit status answers first) + the doc paths.

═══════════════════════════════
DECISIONS
═══════════════════════════════
Made on 2026-10-06, after Phase 0 (docs/roblox-phase0-plan.md). Where a decision differs
from the text above, the decision wins.

1. Lip-sync test first: yes. It runs before any building.
2. Word budget: use Fruit's rule. Try 11-word lines in the 30 s story test later.
3. Overlays: fixed screen spots only (name tag top centre, chat top left, countdown top right).
   NO blank glowing shapes in pictures at all. That test is dropped.
4. 9:16 only at first.
5. Own price rows (image:blocky-story, video:blocky-story-v2/v3/v4) with Fruit's values.
6. Ideas are free, with a rate limit of 30 batches per user per day.
7. Voices are text descriptions, same as Fruit.
8. SEPARATE TEMPLATES: Blocky Stories is its own template, not a mode inside AI Fruit Story.
   Own route, own entry in the toolshell, CreateMenu, mobile nav and home carousel (hidden
   behind the blocky_v1 flag until launch), own thumbnail, own landing/SEO page.
   Users must never see Fruit characters, ideas, series or recent creations inside Blocky,
   or the other way around: listCharacters, getIdeas, listSeries and listRecent always
   filter by niche. Only the engine underneath is shared.

Made on 2026-10-06, after the lip-sync test (Phase 1 passed: GO ON V2):

9.  Video tiers come from Fruit: V2 Wan 2.6 Flash, V3 Seedance 2.0 Mini, V4 Veo 3.1 Fast,
    same per-second prices, own price rows.
10. Library face = B: solid dark open-mouth shape that changes shape when speaking,
    oval eyes, flat decal on a cube head. Eyes and mouth shape are locked per avatar.
    Flat eyebrow lines MAY be added per scene for emotion (angry, worried, shocked).
11. Teeth: flat cartoon teeth are OK. Realistic 3D teeth, lips, tongue or nose = fail.
12. STYLE LOCK FIX (LEGO look must never appear): remove "studded bricks" and "studs" from
    every prompt. Use "smooth matte plastic blocks and simple geometric parts". Add to the
    negative list: no studs, no studded baseplates, no round minifigure heads, no neck
    studs, no claw hands, no brick-toy minifigures.
13. Noob avatar: classic noob colours (yellow cube head and arms, blue torso, green legs),
    face B, no cap. If it still comes out as a minifigure, change its colours.
14. Clip check: add "text, subtitles or captions on screen" as a fail with one free remake.
15. Two-avatar shots: carry over Fruit's picture check + one free redraw for full-body
    shots with small faces.

Made on 2026-10-06, with Phase 2 approved:

16. Blocky avatars have NO age and NO gender, anywhere: the library row leaves both empty
    (the database refuses a Blocky row that has either), and no prompt names one.
17. The new fruit-story-api and fruit-worker are deployed ONCE, at the end of Phase 3,
    followed by a Fruit check. Until then the live API does not know templates, and the
    Blocky page shows nothing rather than Fruit data.

Made on 2026-10-06, after the look checkpoint (tests 2 and 3):

18. WORDING: "a blocky game avatar", never "a blocky toy avatar", everywhere: reference
    prompts, scene prompts, clip prompts, thumbnail prompts and the "(a blocky game avatar)"
    tag after each name. "Toy" pulled in brick-toy minifigures. (This replaces "toy" in the
    EXTRA RULE below.) The style line says "Roblox-style"; "blocky toy figure" lost test 2.
19. BODY CONSTRUCTION, as a positive description, word for word in every reference prompt and
    in the scene style block:
    "Body construction: the torso is one plain rectangular box. Each arm is one straight
    rectangular block with a flat square end — no hands, no fingers, no grip. The two legs are
    two separate straight rectangular blocks side by side, each half the torso's width,
    attached flat to the bottom of the torso — no hip piece, no notch between them, no
    separate feet. The cube head sits directly on top of the torso — no neck."
20. BODY TEMPLATE (the Lite Noob as "Image 1 shows the body construction to copy exactly;
    ignore its colours, face and outfit"): TESTED AND NOT USED. It copied the Noob's own
    flaws (rounded head, small hand blocks, the notch between the legs).
21. PICTURE CHECK: besides full-body shots, a shot whose speaker's cube head is under about
    1/5 of the frame height fails, with one free redraw (the line in code is 22%, as for Fruit).
22. KEEP AS BUILT: the location lock, thumbnail option 2, the "couldn't load" guard on the
    Blocky page.
23. UPLOAD PACK: "Roblox" is allowed as a search keyword in titles, tags and hashtags. Real
    game names, logos and creators stay banned.
24. LEAVE-OUT LIST: keep naming the minifigure parts (claw hands, brick-toy minifigures, round
    minifigure heads, neck studs). The one re-test picture without them still had the hip
    notch; the four with them did not.

Decisions of 2026-10-06 (the separation). These replace decision 8's "only the engine
underneath is shared" and decision 17's deploy order:

25. SEPARATE PRODUCT: Blocky Stories shares NO code with AI Fruit Story. Its own engine
    (`supabase/functions/_shared/blocky/`), its own functions (`blocky-story-api`,
    `blocky-worker`), its own tables and functions in the database (`blocky_*`), its own page
    folder, its own final-video builder. Deploying Blocky never needs a Fruit function to be
    redeployed. A test fails if Blocky ever imports from Fruit or Fruit from Blocky, and if any
    Fruit file differs from main. The duplicated provider files are listed in a README in
    both engine folders: a provider or model change is made in both.
26. FRUIT'S DATABASE GOES BACK: the template columns added to Fruit's tables (migration
    20261006190000) are undone, in one transaction, shown before it is applied, at a quiet
    time, with the smoke check and the rolled-back dry run before and after. The Blocky price
    rows and the `blocky_v1` switch stay.
27. (replaced by 32) SQL that waits for the owner's go lives in `supabase/pending/`, not in
    `supabase/migrations/`.
28. (replaced by 32) A commit that contains an env file with keys is refused (pre-commit hook).
29. ONE BALANCE: Blocky charges the same credit balance as Fruit, through the same
    `deduct_credits`, with the same row locking, so two charges at the same moment can never
    spend the same credits. Pinned by `tests/blockyCreditLocking.test.mjs`; the two-connection
    race is `scripts/blocky/chargeLocking.mjs` on a throwaway account (decision 35).
30. AN AVATAR HAS NO AGE AND NO GENDER COLUMN at all (`blocky_characters`): the extra rule
    below is now a property of the table, not a default.
31. VEO AND NANO BANANA PRO TESTS run on `blocky-worker`'s own test list. The Veo line in
    `fruit-worker` and the Pro line in the picture proxy are reverted on the branch (the live
    picture proxy v44 keeps its Pro line: it was deployed by the owner and is left as is).

Decisions of 2026-10-07 (how Blocky runs):

32. BLOCKY RUNS THE WAY FRUIT DOES. No Docker, no local database, no tunnel, no separate
    keys. The site runs on localhost (`npm run dev`) and calls Blocky's own functions on the real
    project, behind `blocky_v1` (on for the owner's account only). Every provider key, the Fly
    token and the Fly app are the ones Fruit already uses (Supabase secrets are project-wide).
    The one new secret is `BLOCKY_WORKER_SECRET`, a random string (not a provider key), in
    Supabase secrets and in the database vault. The final video uses the same Fly app with its
    own image tag, `blocky-final`; the `fruit-final` image is never rebuilt for Blocky.
33. PAID CALLS OFF BY DEFAULT, AND A DAILY CAP. A Blocky bug could spend real provider money,
    so Blocky makes no paid call unless `blocky_settings.paid_calls` is true, and stops for the
    day when today's spend reaches `blocky_settings.daily_cap_usd` ($3.00 to start with; the day
    runs from 00:00 UTC). A step that would pass the cap is refused before it is charged; jobs
    still waiting when the switch goes off are refunded. The owner turns it on and off:
    `node scripts/blocky/paid.mjs on | off | status | cap 3`, or the row in the Supabase table
    editor. If the state can't be read, paid calls are off.
34. TEMPORARY AVATARS: Noob, Vex and Lux from the Nano Banana Pro test pictures are loaded so a
    first story can be made (`scripts/blocky/seedTemporaryAvatars.mjs`). They are marked
    `temporary = true` in `blocky_characters` and stored under `blocky/library/temporary/`; the
    real library replaces them in place.
35. THE RACE TEST runs on the real database on a throwaway account
    (`scripts/blocky/chargeLocking.mjs`): it calls no provider, compares every other balance
    before and after, and deletes the account and its rows.

Decisions of 2026-10-08 (after the first real story):

36. PICTURE CHECK: the speaker's head must be at least 18% of the frame height (it was 22%;
    replaces the number in decision 21). A flagged picture is redrawn once automatically before
    the user ever sees it; a warning is shown only if the redraw is flagged too, and only while
    the story is at the picture step: it is gone once the scene is being animated.
37. ONE CAPTION TRACK. The video model sometimes draws its own subtitles into a clip although
    the prompt forbids them (2 of 4 clips in the first story). So: the Wan request also says it
    in its negative prompt; the clip check looks at two frames from the middle of the line and
    a clip with drawn words is made again once at our cost; and a clip that still carries drawn
    words gets no caption of ours in the final video. The download is the file the player shows.
38. LENGTH is a ceiling: the clips add up to at most the chosen length and may be a second or
    two shorter (each clip is as long as its line needs; the user pays only for the seconds
    made). 18 s for a 20 s story is as designed; the settings step says so.
39. A visitor who can't have the Blocky page (signed out, or without the switch) lands on the
    home page, "/".
40. CAPTION FALLBACK (adds to decision 37): a clip that still carries the model's drawn
    subtitles after its one remake is made once more on the NEXT clip model at our cost
    (V2 Wan → Seedance) and checked again. Only if that fails too is our caption left off for
    that clip. V3 and V4 have no next model. Worst case extra per clip, all at our cost: one
    remake (seconds × $0.0504) plus one Seedance clip (seconds × $0.0817): about $0.53 for a
    4 s clip, $0.66 for 5 s. Measured 2026-10-08: Runware accepts the negative prompt, but the
    test clip still had drawn subtitles, so the negative prompt alone is not the fix.
41. STORY QUALITY. The writer plans before it writes and returns the plan: one premise that
    starts "What happens if", ONE emotion (curiosity, dread, injustice, satisfaction, shock),
    the twist, and the scene where the twist is said or seen; each scene says what it raises.
    Code checks the plan (premise, emotion, reveal in the second half, lines that vary in
    length, no near-repeats, nobody "typed" or "wrote" anything). The title teases and never
    states the twist. Upload titles are one hook sentence with the keywords inside it, never
    keywords after a dash, a bar or a colon (checked in code, one retry).
42. THE QUALITY PASS: draft → the editor checks eleven rules → rewrite what fails → check
    again, at most two rewrites, and the version with the fewest problems is kept. The editor
    reads as a viewer: it sees the title, the lines and who is in each picture; the plan and
    the roles are shown to it as writer's notes the viewer never sees. The editor is Claude
    Sonnet (Haiku failed a script for "repeating" a role the viewer had never been told).
    Measured on seven scripts: $0.033 to $0.10 each, $0.066 on average; the user is not
    charged for the script.
43. The same caption fault is fixed in AI Fruit Story on this branch (negative prompt, the
    mid-line check, one remake, our caption left off as the last resort; not the next-model
    step). It is deployed only on the owner's go, at a quiet time with no Fruit job in flight.
44. Character cards are 9:16 portraits, in the library and under "Characters in this story".
45. DRAWN SUBTITLES GO STRAIGHT TO THE NEXT MODEL (replaces the order in decision 40). The test
    clip showed Wan drawing the same subtitles again for the same line, so there is no remake
    on the same model: a clip with drawn subtitles is made once more on the next clip model
    (V2 Wan → Seedance), then the "leave our caption off" guarantee. Worst case extra per clip,
    at our cost: seconds × $0.0817 ($0.33 for 4 s, $0.41 for 5 s), down from $0.53 / $0.66.
    V3 and V4 have no next model and keep one remake on their own model. The same order is in
    Fruit's copy of the fix. Words that invite drawn text are banned from every spoken line
    the writer writes and from every action line: type, typed, write, wrote, written, sign,
    read, reads, message, chat, text, screen (and their other forms). Code refuses them; the
    user's own script lines are theirs, but the action added to them is checked.
46. THE TWIST. The writer returns what the opening makes the viewer assume, THREE twists that
    flip it, and keeps the least expected. The shapes: the victim had the power, the trick
    backfires on the trickster, the reward is the trap, the quiet one is the mastermind, the
    rule was protecting them. "The villain admits it" is not a twist. A proof or an action
    forces the twist out, never a free confession. Something changes for someone by the end and
    the viewer sees or hears it. The last line belongs to whoever wins, 8 words or fewer
    (code refuses more than 10 and a last line by anyone else).
47. Characters only do what their role allows: a player can't ban, an admin can. No story
    depends on reading something on screen (a leaderboard, a countdown number, a rule list):
    it becomes an object, an event or a spoken line. The title shares no key word with the
    twist, except a word the first line already says (checked in code).
48. The writer is given four short example stories as the standard (one per twist shape) and
    must never reuse their plots, objects or lines. The editor has fourteen rules and is strict
    on three: the twist flips the assumption, a proof or action forces it out, and the ending
    changes something (a deflating ending fails).
49. 30 SECONDS is the default length (six scenes: hook, two steps up, the proof, the twist,
    the last line). 20 seconds stays as the cheaper choice.
50. A STYLE NOTE NEVER FAILS A STORY. Lines all the same length, two lines that say the same,
    a last line over 10 words, a title word from the twist, fewer than three twists drafted:
    the writer is told once; what is left goes to the editor. Only a fault that makes the story
    unusable (format, safety, timing, a word about writing, the wrong winner) can end in "We
    couldn't write this story". Found in the twist round: 2 of 5 stories were lost to "the
    lines are all about the same length".
51. THE TWIST ROUND DID NOT PASS (2026-10-08; pass mark: average 7.5, none under 6). The same
    five ideas at 30 seconds scored 7, 7, 7.5, 6.5 and 5 by my own reading: average 6.6, up
    from 5.6. Section 3 (story ideas) waits for the owner. Still failing: the twist is carried
    by a new rule of the world that appears at the reveal instead of something planted in the
    first scenes; last lines explain the twist; one story blamed someone outside the cast; the
    same speaker has three lines in a row; a premise about a number on screen lost its clarity
    once the number was taken out.
52. THE TWIST PLAN IS ITS OWN STEP, before any dialogue (`_shared/blocky/twists.js`). It locks:
    the premise, a twist pattern from the library, the CLUE the viewer sees or hears in scene 1
    or 2, the PAYOFF (the on-screen action in the reveal scene that uses the clue), who wins and
    the final line (8 words or fewer). The writer delivers the plan and cannot change it; the
    editor checks the script against it (the clue really is early, the payoff really happens).
53. THE PATTERN LIBRARY: fourteen twist patterns, each with how to plant its clue in a blocky
    game world. The plan step drafts three from different patterns and keeps one. The pattern is
    stored on the story (`planner.patternId`) and the same user's next story takes another one.
    The payoff must run on a mechanic every player already knows (owner power, admin power, a
    pet obeys its owner, a key opens its door, a hazard resets, a trade is final, the holder has
    the item) or on one the viewer is SHOWN working in scene 1 or 2; no object "decides".
54. A premise that depends on something to read (a countdown number, a leaderboard, a rule
    list) is turned into something visible at the plan step (`seenAs`): a ring of light that
    changes colour, a podium with a gold marker. A rule or a name is simply said.
55. ALSO IN THE WRITER'S RULES: no speaker has more than two lines in a row; every cause is
    someone in the cast; the last line never explains the twist; an action is at most 16 words.
    The editor's "role powers" check fails only when a power really works for someone who
    can't have it. Rewriting stops as soon as a rewrite is no better than what there was.
56. FORMAT AND COST. Answers must match the schema exactly (strict tool use), so no more
    malformed drafts. A format repair and an editor's rewrite come back as a PATCH (only the
    fields that change: about $0.01 instead of $0.022). Style notes never cost a call. ONLY A
    SCRIPT OR PLAN THAT CAN'T BE USED FAILS A STORY (the wrong number of scenes, someone outside
    the cast, a clip longer than quoted, a real name); a lesser fault is sent back twice at most
    and then left to the editor. The schemas carry no cast ids, so the cached rules are shared
    by every story. Measured on five scripts at 30 seconds: $0.054 to $0.137, average $0.086
    (target: under $0.08; three of five were under).
57. THE TEST LEDGER CAP is $10 (owner, 2026-10-08; it was $5). The daily cap stays $3.
58. ROUND THREE DID NOT PASS (2026-10-08). My scores: 5, 7, 5, 6.5, 7: average 6.1, two under
    6. Planted clues and paid-off payoffs are there now; what fails: the plan step still
    reaches for a thing that enforces a rule by itself, one flip had no stakes, two lines went
    to the wrong speaker or pronoun after a repair, and four of five last lines start "Guess".
    Section 3 waits for the owner.
59. AI Fruit Story's caption fix (decision 43, with the next-model step of decision 45) is LIVE
    since 2026-10-08 09:11 UTC, deployed from this branch on the owner's go with no Fruit job
    in flight and Fruit's smoke check passing before and after. It is not on main: a deploy of
    Fruit's functions from main would take it out again. Pull request #1 (branch
    `fruit-caption-fix`, the 12 Fruit files only) brings it to main; merged on the owner's go.
60. BEST OF THREE PLANS (owner, 2026-10-08, after round three scored 5.6 / 6.1). The plan step
    writes THREE complete plans for a story, each on a different pattern, and a judge (the
    editor's model) scores each from 1 to 5 on six points: the clue is planted early, the
    payoff uses the clue, the stakes are clear, the twist flips what the viewer assumed, a
    viewer could retell it in one sentence, and nothing "decides" by itself. The fairest is
    written. A plan under 3 on the last point loses to any plan that is not; each fault code
    finds counts 2 points against a plan; a plan the writer can't work from is never picked.
    The three plans and their scores are kept on the story (`planner.judged`).
61. THE PLAN STEP RUNS ON A STRONGER MODEL: Claude Opus 5.5 (`models.js#twistPlan`), medium
    effort; everything else stays on Claude Sonnet 5. Opus refuses a forced tool call (its
    thinking is always on), so it is asked through structured outputs. If it can't be reached
    the writer's model plans instead; if the judge can't be asked, code decides. Measured on
    five scripts: the plan step costs $0.07 to $0.11 (it was $0.012 to $0.024), the judge
    $0.009; a script costs $0.16 to $0.21, average $0.175 (it was $0.086), and takes about 95
    to 110 seconds.
62. A scene goes to another speaker only together with a NEW line of their own (a repair once
    put one character's line into another's mouth). The editor has a fifteenth rule, "voice":
    would this character say this, with I, my, you and your pointing at the right one.
63. No last line starts with "Guess", and none starts with the same word as the last line of
    one of the user's last five stories (`planner.lastLine`).
64. ROUND FOUR (2026-10-08), my scores: 5.5, 7.5, 6.5, 8, 7.5: average 7.0, one under 6. The
    pass mark (7.5, none under 6) is not met; it is the best round so far. Section 3 waits.

EXTRA RULE: never describe a Blocky avatar's age or call it a kid/child. Always "a blocky toy
avatar". The age column gets a neutral default for niche 'blocky'.
