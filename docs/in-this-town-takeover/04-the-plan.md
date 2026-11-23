# In This Town: the plan (2026-11-24, waiting for the owner's approval)

**Goal.** A customer's custom video comes out right almost every time, at a cost of about $1.00-1.30 (hard ceiling $1.50).

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
- each prop's state over the lines (light on/off, chalk drawn/washed)

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

**Never trusted with:**
- places or stages
- where anyone stands
- camera
- lighting
- anything inside a customer run

A customer's story uses only the library as it was when the run started. The builder runs as our own tool between customer runs, never during one. This is why the round 9 builder test failed: 9 of 10 stills had pieces missing or out of frame, which is placement and camera, not prop shape.

**Fix the bug first:** the writer's menu is read from the live library at call time, so a newly built prop is actually offered to the writer.

## 5. The golden test set

**12 fixed topics, easy to hard.** These are stored once as scripts (written once, then frozen), so a re-test costs only planning and stills:

| # | Topic (our own) | Tests |
|---|---|---|
| 1 | Every house must keep its porch light on at night | the round 10 story; light rule object, creature |
| 2 | Every kid must be inside before the streetlights blink twice | spot rule at night, window shots |
| 3 | Everyone wears a hat that changes colour with their mood | over-head/on-body rule object, faces, day only |
| 4 | Every house has a chalk circle; the thing can't cross it | ground rule object, creature |
| 5 | Every time you lie, your nose lights up | effect on a person, 2 people, comedy |
| 6 | Every family leaves a cookie on the windowsill for the night visitor | prop on house, creature as eyes |
| 7 | When it rains, everyone has to stand on one foot | storm light, pose rule, "everyone" = 6 people |
| 8 | Your shadow does what you really want to do | creature-like second figure, indoor stage B |
| 9 | Grandma's knitting decides tomorrow's weather | prop in hand, indoor, morning light |
| 10 | Every pet can talk for one minute a year | animal from library, day |
| 11 | The town clock eats one minute from whoever is late | sign/clock text prop, creature, two stages |
| 12 | A customer-style messy topic: "my brother keeps stealing my snacks" | the writer must fit an odd topic onto a stage |

**The score:** the number of the 12 that **you would post**, judged by you on the stills sheet, and on the final video for milestone rounds. **Rules for the score:**
- The automatic checks also report per shot (named thing shown, nobody hidden, rule obeyed), but they never replace your score.
- A change that lowers the score is reverted.
- The score and the sheets are saved per round in `reference/blocky-worlds/golden-v2/round-N/`.

## 6. Cost per video (a 60-75 s video, measured prices from rounds 8-10)

| Step | How | Cost |
|---|---|---|
| Writer | Sonnet, 1 call + 1 repair if the free checks fail (no Opus) | $0.05-0.10 |
| Shot planner | Sonnet, 1 call for the whole story | $0.05-0.08 |
| Voice | ElevenLabs, your voice, about 75 s | about $0.12 |
| Stills | about 50 stills on RunPod (round 10: 52 stills cost $0.07) | about $0.08 |
| Cheap AI pre-look (optional) | one Haiku look at a low-res sheet, to sort the worst shots first | about $0.01 |
| Customer fixes | 10 included (see 7) | about $0.10-0.15 if all are used |
| Final render | 1080x1920, about 75 s (replica finals cost $0.52-0.61) | about $0.55 |
| Failure allowance | a crashed chunk re-rendered once | about $0.10 |
| **Total** | | **about $1.00-1.30** |

**Where the 313 credits go**, at your rule price = 2x cost (1 credit = $0.01 of cost):
- 313 credits allows $1.56 of cost.
- The steps above use $1.00-1.30.
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

**Money:**
- **10 shot fixes + 2 line rewrites are included.** One fix costs us about $0.01; a line rewrite about $0.02 because of the voice.
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
| 6 | Fix rounds on the engine until the golden score is 10+/12 on stills | the score per round, never going down | about $1 per round, each asked first |
| 7 | Stage B (indoor) built and tested like step 1 | its test sheet | about $0.05 |
| 8 | The fix machine, as a local tool on the golden set | you fix 10 real shots by typing; I report how many came out right | about $0.20 |
| 9 | Finals for the 12 golden topics | you watch them and score "would post" | about $7 |
| 10 | The review screen on the site, behind your owner switch only | you run 3 videos as a customer | about $4 |
| 11 | Clean-up: delete the dead code listed in 03 (after the go-live only) | the tests pass | $0 |

**Total paid cost to reach the go-live checklist: about $15-20**, asked before each step.

**What I need from you:**
- Yes or no on the scope (tested stages).
- Your OK or changes to the 12 golden topics.
- About 10 minutes per golden round to score the stills sheet.
- The go for each paid step.

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
