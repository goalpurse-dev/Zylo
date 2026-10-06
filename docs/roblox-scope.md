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
