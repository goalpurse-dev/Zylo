# In This Town: the plan (2026-11-24, approved by the owner with 9 changes)

**Goal.** A customer's custom video comes out right almost every time, at a cost of about $1.10-1.40 (hard ceiling $1.50). Approved by the owner 2026-11-24 with 9 changes.

**Background.** This plan is based on three studies in `docs/in-this-town-takeover/`:
- 01: the viral videos
- 02: the kits
- 03: the audit of our system

## 1. Scope: tested stages, not "any place, any action"

**Decision: stories are written INTO a small set of fully tested stages.** The customer's topic changes:
- the rule
- the rule object
- the characters (looks, names, one signature item each)
- the creature
- the story

The topic does not change the set, the spots or the camera.

**Why.**
- The viral videos already work this way. 1-3 sets carry 80-100% of their shots. They reuse camera setups 4-35 times, cut to people already standing, and never show contact, doors or travel.
- Our "any place, any action" engine has had 10 rounds of fixes. It still passes 1-2 of 22 cards on a new story.

**The first stage set (one place, four looks):**
- Stage A, "Our street": a suburb street, the house front with its porch and lawn, and a window seen from outside. Day, sunset, night, storm and morning.
- Stage B, "Inside our house": a living room plus a bedroom corner (bed, window, door), built as one open set.
- Later, only when A and B pass the golden set: stage C, "School hallway", and stage D, "Town square".

**Every stage ships with:**
- 12-20 named spots, each tagged (`inside`, `porch`, `lawn`, `pavement`, `road`, `window`, `bed`…), at least one body width apart, with a clear area checked in code.
- 6-10 named camera positions per spot group, each tested.
- A light table: one entry per time of day.
- A creature spot: behind the people, with a clear gap, plus a "silhouette in the dark" spot and an "eyes only" spot.
- A list of tested actions. Everything on it has been rendered and looked at; nothing else can be written.

**Stage A's tested actions (the minimum it ships with):**
- People:
  - stand (idle life on)
  - walk from spot to spot
  - run from spot to spot
  - crouch
  - point at a person or thing
  - hold up a prop
  - look at a person, thing or the sky
  - turn to face someone
  - wave
  - cheer
  - shiver
  - hands on head
  - sit on the porch step
  - knock at the door (pose at the door, no door motion)
- The creature:
  - enter from the dark (the far end of the street, or rising from the drain)
  - walk from spot to spot behind the people
  - stand and loom
  - leave into the dark
- Props: a prop changes state (light on/off, mark drawn/washed); it pops in or vanishes with an effect.
- Hand-overs stay as cuts (the holder, a cut, then the receiver holding it). Doors are never animated; the cut finds the person inside or outside.

**Stage B** ships with the same people actions plus sit on the sofa, lie in bed, sit up in bed, and look out of the window.

**A topic that needs a place we don't have.**
- The writer moves the story into the town and keeps the topic's rule, object and characters. For example, "a haunted school" becomes "our street, where the school bus stops"; "on the moon" becomes "the night our street looked like the moon".
- The writer says so in one plain line above the script: "We set this in your town because…".
- The customer always sees the script before anything is rendered, and can change it or rewrite it.
- When stage C (school hallway) or D (town square) exists, the writer picks it instead.

**Freedom later.** The builder adds props and creatures to a stage. New stages are added one at a time, each tested before customers can use it.

## 2. The simplest architecture: five steps, one file each

```
topic
 -> 1. WRITER       (1 LLM call) script + story card: stage, rule object, cast, creature,
                     and for every line: who is seen, where (spot), doing what (from the menu)
 -> 2. SHOT PLANNER (1 LLM call for the whole story) every line -> 1-3 shot rows
 -> 3. CHECKER      (code, free) names resolve, every named thing has a shot, no repeats,
                     rule obeyed, at most 2 people per shot, creature never at a front spot
 -> 4. BUILDER/RENDER (Blender) each shot built fresh from its row: stage, spots, people,
                     prop states, light, camera solved from the subject; free geometry checks
 -> 5. STILLS -> customer review/fixes -> ONE final render
```

**One shot row** (data, not code):

```
{ line, from_word, stage, time, camera: "close|medium|two|wide|low|top|insert|over_shoulder",
  people: [{ id, spot, pose, face, holds }],   // at most 2, plus the creature
  creature: { spot, show: "full|silhouette|eyes|legs_behind" } | null,
  props: { rule_object: "on|off|drawn|...", other: {...} },
  subject: ["id or prop"], move: "push_in|tilt_up|track|static", effect: null|"pop|flash|glow|rain" }
```

**What is removed (the layers that fought each other):**
- the continuous takes
- the per-line state machine with mark letters
- the zone solver
- the acting layer
- the stage9-9i wrapper chain
- the size multipliers
- the scene maps
- writer2/3/4 stacking
- the per-card paid vision check as the main judge

**What replaces them:**
- **Per-shot rows.** Each shot restates who is where, as the kits and the viral videos do.
- **Fixed spots.** People are placed on tested spots; nothing is computed.
- **The face drives the body.** A feeling word picks the pose and the face, and idle life is always on.
- **One size per prop.** Readability is the camera's job, not the prop's.

**Continuity** is one small record per story, checked in code before any render:
- each person's look, which never changes
- what each person holds
- each prop's state over the lines (light on/off, mark drawn/washed)
- **each person's spot and screen side**
  - Within one scene, a person keeps their spot between shots unless that line's words move them (a walk/run action on a moving word).
  - Two people never swap screen sides between shots of the same scene: the camera stays on one side of the line between them.

**Our checks run before the customer sees anything.**
- Any shot that fails a free check is fixed or re-planned automatically: first the camera (another tested position), then the spots, then a re-plan of that line.
- At most 2 tries. Then the line is simplified to one safe shot (one person, a close or medium shot, a tested position).
- The customer never sees a shot our own checks failed.
- **"Skip review, just make it":** customers who don't want to check stills press one button. The same automatic fixes run and the final render follows.

**Hand-overs, contact and doors are done the way the references do them:** the holder, a cut, then the receiver holding it. The engine's hand-over animation stays out of customer videos.

**Code.** New files sit beside the old ones in `scripts/blockyWorlds/v2/` and one `stage_v2.py`, which reuses the good primitives from `worlds.py` (characters, faces, the suburb set, lights). Nothing on the live path changes until go-live.

## 3. The rule object and how the rule is enforced

**The rule is data in the story card:**

```
rule: { object: "porch_light", kind: "light|line|mark|sign|over_head|creature",
        states: ["on","off"], safe_state: "on",
        applies_to: "every house|every person",
        danger: "the creature comes to a house whose light is off",
        allowed_spots_by_time: { night: ["inside","porch","window"] } | null,
        exceptions: [{ who, from_line, because_words }] }
```

**How it is enforced:**
- **The rule object is a real, tested object on the stage.** A porch light is the house's own lamp, not a loose bulb. It can be shown in close-up, and its state is a field in every shot row.
- **State changes only on a line whose words say so.** This is checked in code: "goes out", "turned off" and "drew" are words the writer must put in the script.
- **Every person in every shot is checked against `allowed_spots_by_time`,** unless an exception names that person and the line contains the exception's words. A break blocks the render. No regex guesses about English.
- **The rule object must be visible** in the first shot and in at least 30% of shots, which the checker counts before render. That matches the references' 32-70%.
- **One ID per character, the creature included** (`creature`, with a display name such as "Max"). This is the one fix that would have saved 8 of round 10's 22 cards.

## 4. Where the builder fits

**Trusted with (data only, each piece tested on its own still next to a person for scale, then approved by the owner before customers get it):**
- props: lamp, oil can, wheelbarrow, sign, cake
- outfits and signature items on our standard character
- creatures, built from our creature parts (silhouette, eyes, size, glow)
- simple held poses

**Inside a customer run: props only.** When the story needs a rule object or prop the library doesn't have (a light-up nose, a doorbell, a flower on a head):
1. The builder makes it from data, at real size in cm.
2. It is tested alone on one still, with a person for scale, and checked automatically: the right size against the person, all parts connected, nothing floating, readable in a close-up.
3. It is attached only at tested attach points:
   - in a hand
   - on a head
   - over a head
   - on a ground spot
   - on the house's fixed points (porch lamp, door, window, mailbox, roof)
4. If it fails twice, the writer swaps it for the nearest library prop and logs the swap. The customer sees the swap in the script.

**Never inside a customer run:**
- places or stages
- where anyone stands
- camera
- lighting
- characters' bodies
- creatures

A creature the library lacks is swapped by the writer for the nearest library creature (the shadow, horns, slime, ember, frost, the eyes-in-the-dark). We build new creatures between runs, test them, and approve them before they reach the library. This is why the round 9 builder test failed: 9 of 10 stills had pieces missing or out of frame, which is placement and camera, not prop shape.

**Fix the bug first:** the writer's menu is read from the live library at call time, so a newly built prop is actually offered to the writer.

## 5. The golden test set

**12 fixed topics, easy to hard.** These are stored once as scripts (written once, then frozen), so a re-test costs only planning and stills:

| # | Topic (our own) | Tests |
|---|---|---|
| 1 | Every house must keep its porch light on at night, or the shadow comes to the door | the round 10 story; light on a house point, creature |
| 2 | Every mailbox eats one letter a night, and nobody knows where they go | prop on a house point, night, mystery |
| 3 | Every time you say sorry, a flower grows on your head | prop on a head, built in the run, faces, day |
| 4 | Every family paints a yellow footprint path from its door; the fog only takes people who step off it | our own ground-mark rule, spot rule, creature |
| 5 | Every time you lie, your nose lights up | effect on a person, prop built in the run, 2 people, comedy |
| 6 | At midnight every house must ring its own doorbell three times, or something else rings it | house point (door), creature as eyes |
| 7 | Every time someone yawns, a pillow falls from the sky | **things falling from the sky**, "everyone" = 6 people, day |
| 8 | Your shadow does what you really want to do | creature-like second figure, indoor stage B |
| 9 | Grandma's knitting decides tomorrow's weather | prop in hand, indoor, morning light, storm |
| 10 | Once a year the giant crab from the drain comes to collect lost socks | **a creature the library doesn't have**: the writer must swap it and log it |
| 11 | The town clock eats one minute from whoever is late | clock text prop, creature, two stages |
| 12 | A customer-style messy topic: "my brother keeps stealing my snacks" | the writer must fit an odd topic onto a stage |

**Checked against the references.**
- Changed: the old #2 (streetlights, the same premise as a reference), #3 (mood shown on the body, too close to the "weather follows your mood" reference), #4 (the chalk circle, a reference) and #6 (food left for a night beast, a reference). The old #7 and #10 were replaced to cover the two new needs.
- How: checked against the first lines of all 39 references and the plots of the 33 whose stories are known (19 in ANALYSIS.md plus the 14 studied shot by shot).
- The remaining 6 references are known only by their opening line. None of those lines matches a topic above.

**The score:** the number of the 12 that **you would post**, judged by you on the stills sheet, and on the final video for milestone rounds. **Rules for the score:**
- The automatic checks also report per shot (named thing shown, nobody hidden, rule obeyed), but they never replace your score.
- A change that lowers the score is reverted.
- The score and the sheets are saved per round in `reference/blocky-worlds/golden-v2/round-N/`.

## 6. Cost per video (a 60-75 s video, measured prices from rounds 8-10)

| Step | How | Cost |
|---|---|---|
| Writer | Sonnet, 1 call + 1 repair if the free checks fail (no Opus) | $0.05-0.10 |
| Shot planner | Sonnet, 1 call for the whole story | $0.05-0.08 |
| Props built in the run | 0-2 props: Haiku spec + one test still + Sonnet look, 1 retry each (round 10: 3 props $0.04) | $0-0.05 |
| Automatic fixes before review | at most 2 tries on failed shots: re-plan call + re-rendered stills | about $0.05 |
| Voice | ElevenLabs, your voice, about 75 s | about $0.12 |
| Stills | about 50 stills on RunPod (round 10: 52 stills cost $0.07) | about $0.08 |
| Cheap AI pre-look (optional) | one Haiku look at a low-res sheet, to sort the worst shots first | about $0.01 |
| Customer fixes | 10 included (see 7) | about $0.10-0.15 if all are used |
| Final render | 1080x1920, about 75 s (replica finals cost $0.52-0.61) | about $0.55 |
| Failure allowance | a crashed chunk re-rendered once | about $0.10 |
| **Total** | | **about $1.10-1.40** |

**Where the 313 credits go**, at your rule price = 2x cost (1 credit = $0.01 of cost):
- 313 credits allows $1.56 of cost.
- The steps above use $1.10-1.40.
- The rest is a safety margin for retries.
- The price stays at 313. If the measured cost over 12 golden runs stays under $1.10, the price could drop to about 250.

## 7. The customer review screen

**The flow:**
1. Script, which the customer can edit.
2. Stills of every shot.
3. Fixes.
4. Approve.
5. One final render.

**The screen:**
- A vertical list of shots. Each shows its still, the words spoken during it (with the named word highlighted) and a small badge.
- **The shots our checks rated lowest come first, marked "check this".** Every free check counts toward the rating, plus the cheap AI pre-look.
- Under each shot is a text bar: "What should be different?"
- Buttons: "Looks good", "Approve all and make my video".

**The fix machine.** One small LLM call (Haiku or Sonnet, about $0.003) turns the customer's sentence into **one edit from a fixed list**, applied to that shot's row only:

| The customer says | The edit |
|---|---|
| "closer", "show his face", "I can't see the monster" | camera: preset / subject / side |
| "she should be on the porch" | person: spot (from the stage's spots) |
| "he should look scared" | person: face/pose (from the tested list) |
| "the lamp should be off", "no bucket" | prop: state / show / hide |
| "make the monster scarier", "only eyes" | creature: show mode / spot |
| "he should be running" | person: action (tested list only) |
| "change what he says" | rewrite the line: new text, new voice for that line, re-time the shots of that line |

**After the edit:**
1. The checker runs, for free. An edit that breaks the rule or hides a named thing is explained back in plain words, for example: "the rule says nobody is outside at night; shall I put her at the window?"
2. Only that shot's still is re-rendered (about $0.005), and the shot is shown again.

**Money (measured 2026-11-24, step 2):**
- **One real fix, measured end to end:** a changed camera on round 10's row 25, re-rendered alone as its own job.
  - It cost **$0.009** and took **about 56 s** from sending to the still on screen: 7 s queue, 12 s worker start, 43 s Blender (mostly loading the engine).
  - The free checks before it add 15-35 s (they re-check the whole story; checking only the changed row will cut this).
  - The worker came up in 12-16 s even after hours idle (its first job of the day in step 1), so a cold start is not a real cost on this endpoint.
- **10 shot fixes + 2 line rewrites are included.** 10 fixes cost us about $0.09.
- After that, each extra fix is 3 credits and each line rewrite is 5 credits, always shown before they confirm.
- "Start over from the script" is free once.
- A video whose final render fails our checks is refunded automatically, as today.

**The same fix machine for us.** On the golden set you (or I) type fixes the same way. Every fix is logged. When the same kind of fix shows up 3 times, it becomes a default in the planner, so the machine learns from real complaints.

## 8. The order of work (small steps, each proven, cost asked first)

**How I will work, to save your usage:**
- One step at a time, done by me directly. No big parallel helper runs.
- I read only the files the step needs.
- Free local checks first.
- One short report per step.

| Step | What | Proof it worked | Paid cost |
|---|---|---|---|
| 1 | Stage A built as data: spots, camera positions, light table, creature spots, using `worlds.py`'s set | A free code check: every spot clear and a body apart. A test sheet: every camera position × 2 dummy people × night/day | about $0.05 GPU |
| 2 | Shot rows + checker + per-shot builder (`v2/`), round 10's story converted to rows by hand | Round 10's story as stills: you judge it against the old sheet | about $0.05 |
| 3 | Camera from the subject + lens-to-face ray + refuse-if-blocked, plus geometric checks that fail (not log) | The checks catch every blocked frame on step 2's sheet | about $0.03 |
| 4 | One writer (replaces writer2/3/4): stage menu read live, rule card, one ID per character | 12 golden scripts written and frozen; the free checks pass. You read 3 of them | about $1.00 |
| 5 | Shot planner (one call per story) | Golden set round 1: stills for all 12, you score them | about $2.00 |
| 5b | **Motion early:** a low-quality preview video of 2 golden topics (movement, cuts on words, idle life) | you watch both | about $0.20 |
| 6 | Fix rounds on the engine until the golden score is 10+/12 on stills | the score per round, never going down | about $1 per round, each asked first |
| 7 | Stage B (indoor) built and tested like step 1 | its test sheet | about $0.05 |
| 8 | The fix machine, as a local tool on the golden set | you fix 10 real shots by typing; I report how many came out right | about $0.20 |
| 9 | Finals for the 12 golden topics | you watch them and score "would post" | about $7 |
| 10 | The review screen on the site, behind your owner switch only | you run 3 videos as a customer | about $4 |
| 11 | Clean-up: delete the dead code listed in 03 (after the go-live only) | the tests pass | $0 |

**Spending (the owner's rule of 2026-11-24):**
- A step under $1 runs without asking. Anything over $1 is asked first.
- The total cap is $20.
- After each step I report 3 plain lines (what I did, the golden score before and after, the cost) and the folder with the sheet to score.

## 10. Keeping the live engine safe until go-live

- **No deploys.** I don't deploy the worker, the functions or the site, and I don't push. Nothing live changes.
- **`worlds.py` is not edited.** The local `worlds.py` is 643 lines ahead of main. The live worker image was built from main, so live keeps running what main has.
  - The v2 code lives in new files (`scripts/blockyWorlds/v2/`, `stage_v2.py`).
  - It reads `worlds.py` as it is and never edits it, so v2 adds nothing to the live drift.
- **Any future worker deploy is built from main, never from laptop-transfer**, until go-live. Before any deploy, the deployed `worlds.py` is diffed against what is about to go out.
- **Go-live is one switch**, with the old engine kept as the rollback.

## 9. Checklist to switch purchases back on

- [ ] The golden set scores **11 of 12 "I would post"** on final videos, two rounds in a row, with no topic going backwards.
- [ ] 0 crashes in the last 24 golden runs. A crash refunds automatically.
- [ ] The measured cost per video is ≤ $1.30 average and ≤ $1.50 worst over the 12 finals, including fixes.
- [ ] The review screen works end to end for you as a customer: stills, at least 3 typed fixes, approve, final.
- [ ] Every free check blocks a render (none only logs), and named = shown on 100% of golden shots.
- [ ] The rule is checked in code on every shot, with 0 rule breaks in the golden finals.
- [ ] The kid-safe and no-brands checks still run on the writer.
- [ ] The cost caps and the off switch are tested.
- [ ] The new path is deployed only after your go, with the old engine kept as one-switch rollback.
