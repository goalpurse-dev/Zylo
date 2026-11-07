# Cutaway handoff (written 2026-11-07, for a fresh session)

The goal from the owner: take the 40-topic scoreboard to 40/40, mostly for free. **Next step: build all the missing kit in one push, then do one check.** The owner's message of 2026-11-07 is under "The owner's current orders" below.

## Where things are
- **Working folder:** `C:\Users\Public\Zylo-cutaway`, branch `cutaway-work`, not pushed. This is the Cutaway exception to the single-folder rule. Commit only your own files.
- **Code:** `scripts/cutaway/proto3d/`
  - `m2/`: the pipeline (planner, layoutRules, director, compile, runtime, parts, rig, checks)
  - `kit/`: parts and settings (backdrops, fx, weather, overlay, ...)
  - `m3/`: tools
- **Render folder (PROTO)**, passed as `--proto` to every tool. It holds node_modules and assets.
  - Path: `C:/Users/Huhta/AppData/Local/Temp/claude/c--Users-Public-Zylo/9fd93e59-a925-49a7-beab-dadbb576d507/scratchpad/proto`
  - Every render copies `m2/` and `kit/` into it (syncProto). **Never edit kit or m2 while a render or measurement is running**: it contaminates the run.
- **Live production worker:** RunPod endpoint `f66astc0vrus92`.
  - Image `7c4d61f2` = commit `ccfaf425`: look steps A and B, the 30/60 s length fixes, crash-proofing.
  - The record is in `m3/production.json`.
  - Rollback: `node m3/runpodSetup.mjs --prod --env-keys --image registry.fly.io/zyvo-cutaway-render-staging@sha256:e6dd02e4daa5ebdffdb39afd32aa54e8615a2cf15f6e6a7e4cb42ef1cf17436f`
  - To build a new image: `git archive <commit>` into a scratch folder, then `node m3/buildContext.mjs <ctx> --proto PROTO`, then `fly deploy --build-only --push` inside `<ctx>`.
- **Commits since live (not in the worker yet):**
  - `001f0cc9`: the "This is a…" outline glows the part's real silhouette (OutlinePass), and the hook object fills half the frame.
  - `c1e81e16`: the calibration tools and verdicts.
  - `6bd93740`: readyScore.
  - `d449dd9f`: the stand-in tooling.

## Scoreboard (how it is counted, the owner's rule)
- **Customer-ready:** the topic would pass production's real gate. After salvage, only a failing hook or "This is a…" line (role `name`) stops a video. The real picture checker's verdicts are cached per line.
- **Perfect:** every line passes.
- **Opening a category:** at least 80% of its topics are customer-ready, and none of those loses more than a third of its lines to salvage. The watchdog closes a category at 30% failures.
- **Last full count (before the outline and hook fixes):** 19/40 customer-ready, 3/40 perfect.

  | Category | Customer-ready |
  |---|---|
  | Yard (open for customers) | 9/10 |
  | Utilities | 0/3 |
  | Appliances | 3/6 |
  | Vehicles | 2/6 |
  | Machines | 1/3 |
  | Buildings | 3/7 |
  | Electronics | 0/2 |
  | Body | 1/3 (heart stent stays refused) |
- **Re-check in progress at handoff:** the 95 lines that changed after `001f0cc9`, max $0.50. Results go to `<scratchpad>/realcheck2/`.
- Every report to the owner starts with the scoreboard, in plain words, and ends with "In plain terms".

## Tools (all in m3/, run from scripts/cutaway/proto3d)
- `scoreboard.mjs --proto PROTO --known --out DIR`: the free code checks on all 40 topics. **Too lenient**: it caught only 24 of the 125 lines the real checker failed. Use it only as a pre-filter.
- `realCheck.mjs --proto PROTO --out DIR --known --only <list> [--max USD] [--dry]`
  - Runs the **real** picture checker on the same frame strips a customer run sends it.
  - Verdicts are cached per line in `m3/sweep/real_verdicts/`, keyed by the hash of the frame image and the words. An unchanged line is never paid for twice.
  - `--dry` counts the unchecked lines for free.
  - The list of 39 topics: the `calib` list = one plan per BENCH topic (the first existing plan in `scoreboard.mjs`). Rebuild it from `scoreboard.mjs`.
- `readyScore.mjs <dir containing realcheck/>`: prints customer-ready and perfect per category, and what salvage would cut. It reads `<dir>/realcheck/`; point it at the newest results (realcheck2).
- `replayPlan.mjs m3/standin/<key> [--save m3/sweep/plans/<key>.json]`: the stand-in planner. It runs the **real** planner on hand-written answers in `answers/`.
  - A missing answer stops it with "pending"; the planner's question is then in `requests/<key>.json`.
  - The 22 stand-in topics have their answers in `m3/standin/`. Re-run them after planner or layoutRules changes so the saved plans pick up the new rules.
- `lookAt.mjs --proto PROTO --plan <plan.json> --out DIR [--roles a,b]`: renders the stills at each line's moment and prints the timeline problems.
- `lookMeter.mjs`: motion, still share and fast moves, measured like the competitor study.
- `crashSweep.mjs --proto PROTO --quick --jobs 2 --out DIR`: about 15–30 min. Its "crashes" count includes start-up misses that render fine when re-run alone; the CRASH lines are the real ones.
- Tests: `node --test tests/cutaway.test.mjs tests/cutawayFailures.test.mjs` (93 pass).

## Budget
- The owner's $10 phase budget: about $4.87 left before the re-check in progress (that one is at most $0.50).
- Ask before every paid call, with the exact cost.
- A real run of a new topic in a category costs at most $1.20. Ask only for categories at 80% or more customer-ready.
- Re-checks cost about $0.003–0.005 per changed line, including per-call overhead.

## The owner's current orders (2026-11-07)
1. Re-check the 95 changed lines (running now).
2. In one push, for free, build everything that is missing:
   - coast and sea
   - river gorge
   - a two-storey interior with an escalator and an elevator shaft
   - a power station and power lines
   - treatment works
   - a volcano
   - a road cars can drive on, with steering and braking motions
   - anything else the failing topics need

   Use CC0 models (Kenney, Quaternius) where that is faster.
3. Fix every known shared problem (list below).
4. Then run one crash sweep and one real re-check of only the changed lines, and show the new scoreboard.
5. Ask for real runs only for categories at 80% or more customer-ready. Appliances come first.

## What each failing topic needs (from the stand-in planners' reports and the real checker)
**Interior camera (appliances and every room):**
- The end, home and "Add…" shot jumps to the fixed room view. The fridge, microwave and water heater end up tiny; the smoke alarm is hidden by the ceiling slab.
- Fix: frame the main subject with a margin on interior settings, and keep the room camera below the ceiling.
- The end-card check fires on any sign inside the room, because the ceiling box spans the room. Make it tolerant in rooms.

**The camera overrides the planner:**
- The hook, finish and congrats shots, and box shots, are rewritten by the code from `shows.p`.
- Counter shots push the counter to 65% of the width and cut off the main part (garden shelter, roof downspout).
- Rule: the camera never zooms past keeping the main part whole, and a stopped or hidden part never joins a shot's focus (sewage `rawOut`).

**Rig bugs:**
- Hidden, not-yet-shown pieces still count in the framing (the fridge door).
- A rig is not drawn without an explicit `show` verb, even when it has `appear` moves (road, volcano). Fix: show a rig on its first appear, or add the rule to the planner prompt.
- Spinning pivots: add a planner rule, "put a spinning node's pivot on its axle".

**FX:**
- Blast and spark debris cubes stay on the ground to the end. Clear them.
- The beam (light ray) is a pale stick even when "off", and does not glow. It needs to be emissive and additive, and invisible until lit.
- Auto-effects fire on event words inside the topic's own name ("smoke" in smoke detector, "flood" in flood light). Skip those.
- Drips and puddles need a colour (brown sewage, amber fuel).
- Smoke needs more contrast.
- Missing moves: melt, corrode/rust, erode/wash away, crack hide, torsion twist, car ride along a surface, car stuck in mud.

**Planner instruction contradictions (in m2/planner.mjs prompts and chain.js):**
- VISIBLE lacks "brown" and "grey", although the prompt uses them as examples.
- "A car arriving" is listed as a finish prop, but the finish check refuses cars.
- Fact research is refused when searches < claims; the prompt only says "one or two searches each". State the rule.
- The narration bans "US", but the fact check copies "US Department of …".
- The dig cue must be in the hook, which conflicts with digs that happen in later lines.
- Idea lines silently create cue words; the code rewrites cue words without saying so.
- The finish-props lists conflict with the generic-decor ban.
- Young trees are refused in the "plain" setting, which is not described anywhere.
- Night returns to day on the next line, so a night-long story is impossible (lighthouse). Night also barely darkens. The new moods (m2/moods.js) help; check they apply.
- The rig size limits (16 m shape, 18 m rig) are only stated in the repair round.
- The water heater's setting is listed under garage, room and kitchen.
- Rivers: the "creek" part is a shallow strip, so a dam or gorge needs a deep water body.

**Settings and parts to build (by category, most-wanted first):**
- **Appliances:**
  - a saved microwave model (door, turntable, magnetron)
  - a fridge door that swings without taking over the framing
  - a cut-open tank shell (half-cylinder)
  - a bigger flame option
  - a speaker/horn shape (smoke detector)
  - smoke that drifts toward a part
- **Vehicles:**
  - a road bed cars drive on (asphalt, centre line, pave verb)
  - car steering and braking motions that read
  - underwater sea setting and a submarine whose ballast fills and blows
- **Buildings:**
  - a river gorge with deep water (suspension bridge, dam)
  - a torsion twist move
  - a car riding on a deck
  - a coast (cliff, sea with waves, a ship) and a volumetric emissive light beam (lighthouse)
  - a tunnel "bore" part (hollow circle in the face, lining rings) and a cave-in
  - a wedge/trapezoid shape
  - an arch-bridge build (wooden frame, wedge stones)
- **Machines:**
  - a two-storey interior (mall or station) with escalator steps that show tread and riser, and an elevator shaft with cable and counterweight parts
- **Utilities:**
  - treatment works (concrete tanks, a clarifier with a rotating arm, aeration)
  - a brown sewage flow look
  - power lines (poles, sagging wires, pole transformer, house meter)
  - a power station (reactor vessel with rods, turbine and generator, cooling tower with plume)
  - a clear "off/stalled" state
- **Electronics:** the chip factory (old plan `puddle_of_mud...`: hook fails, most lines fail); a factory floor setting.
- **Nature:** a volcano part (a cone in section with crater, magma chamber, lava that glows and hardens, layers) and a mountain backdrop. The building formula does not fit natural processes; add a planner rule.
- **Car engine:** the old hand-written plan `hand_engine` fails. Write a stand-in plan the way the 22 were written.
- **Water well:** the finish cap is out of frame.

The full stand-in reports, with stills: `<new scratchpad>/standin/<key>/`. The old session scratchpad is `C:/Users/Huhta/AppData/Local/Temp/claude/406e5fa85684c54c/9fd93e59-a925-49a7-beab-dadbb576d507/scratchpad/standin/`.

## Other open items (owner)
- **Premade 30 s scripts:** approved. The SQL `m3/premade30_2026-11-06.sql` is waiting for the owner to run it; it was blocked for me.
- **"Never cleaned for 10 years" pool premade:** the owner said build it after Step B. Not started.
  - It needs a time-label part ("Day 0 → Year 10"), cloudy and sludge water stages, floating leaves, algae, reeds, lily pads and frogs, and a story template with no "Congratulations".
  - The script is approved by the owner before any render.
- **Captions on the subject** rose to 27% after Step B; it was 17% after Step A. Small fix pending.
- **The before/after page** of look steps A and B was promised.
- **90 s** comes after appliances open.

## Rules that bite
- No paid call without asking first, with the exact cost.
- No paid reruns of the same topic; real runs use new topics.
- Fixes must help every topic.
- Heredocs on this laptop eat backslashes. Write regex code with Write or Edit, never `cat <<EOF`.
- Push or merge to main only on the owner's say. Supabase deploys are OK, but verify by downloading and diffing.
- Database writes to production may be blocked by the safety check; then hand the owner the command.
