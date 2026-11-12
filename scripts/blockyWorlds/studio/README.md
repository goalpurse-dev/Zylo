# Blocky Worlds STUDIO MODE (prototype, owner-only, 2026-11-12)

An AI director hand-directs every cut: it writes small shot code for our own three.js engine, looks at preview stills
rendered on RunPod, fixes the bad cuts, then the final renders in parallel on RunPod. Not deployed; not wired into the app.

## Flow
1. `engine/dev/studio/prepare.mjs`: the production writer (llm.js writeScript, board mode) -> the narrator take
   (Scruffy Duck on eleven_v3, silences over 0.15 s cut) re-processed at a speed fitted to THAT take so it lands at
   255-280 wpm (`pace.mjs`, max 1.47x; reported when the narrator can't reach it) -> the base plan (planVideo with the
   real word timings, the free mock director; `castFix.mjs` turns an animal the planner cast as a person back into a
   pet) -> music A + the mix. `--from <run>` reuses another run's script and paid take.
2. `engine/dev/studio/direct.mjs --model sonnet|haiku --rounds N`: the orchestrated director (`director.mjs`):
   the world (one call) -> the scenes in parallel on one cached prefix (+ one repair from the free checks) -> each scene
   rendered as a contact sheet -> BLOCKING frame checks (`pixel.mjs`: black, flat wall, one colour, dark slab, people
   too small, the creature filling a wide / medium frame) + the vision checker (one call a round) -> at most N fix
   rounds (v3 1, Sonnet tests 2, v4 3) -> the best version renders, what still fails is logged -> the final
   (`render.mjs`) -> the contact sheet + the free frame check of the final (`finalize.mjs`) -> report.json.

## Files
| File | What |
|---|---|
| `shotApi.js` | the only API shot code can use (`api.*`, `Math.*`), poses, faces, animals, limits |
| `validate.mjs` | the whitelist validator (esprima AST): no globals, no eval / Function / import / network, no `x[expr]`, bounded loops |
| `shotCheck.mjs` | free Node pre-check: runs each cut against a stub API in a vm (timeout): runtime errors, unknown ids, camera motion, frame 0 mid-move |
| `assemble.mjs` | the agent's plan -> a real engine timeline (set "board", `studio: <id>`); the cuts' declarations become the engine's shot fields, so checkTimeline / checkVisuals / checkSubjects / checkProduction / the storyboard rule + action checks run unchanged |
| `page/studioBoard.js` | the page adapter shipped inside the job in place of `page/simple/board.js`: the real board stages the cut, then the validated code runs every frame; the night floor (key / rim / creature-face / sky fill at 0.12, calibrated on RunPod), the creature frame cap (60%: the lens backs off), built things blocking the lens hidden, per-frame geometry stats |
| `bundle.mjs` | the page-code-in-job bundle (like `engine/dev/simple/bundle.mjs`): changed engine files + the adapter + the timeline + the code as base64 data |
| `render.mjs` | RunPod endpoint `gm9eqdkuyc2ofs` only (asserted), the image's `simpleStills` role: preview contact sheets; the final as 2x2 full-size frame packs over K parallel jobs, then a local encode + mux |
| `director.mjs`, `prompt.mjs` | the orchestrated director (world, parallel scenes, look checks, capped fix rounds; every call priced worst-case first, parallel calls reserve their worst case) |
| `pixel.mjs` | the blocking frame checks (thresholds calibrated on run 1's frames) |
| `pace.mjs`, `castFix.mjs` | the fitted voice speed; the animal-cast fix on the base plan |
| `ledger.mjs` | cost + time per step (`steps.jsonl`), the experiment cap and the agent cap |

## Security model
- The customer topic / script is delimited DATA in the user message; the system prompt and the tools are fixed.
- The model gets five tools and nothing else: no shell, no files, no network, no keys. The keys stay in the orchestrator
  (`.env.local` read by `engine/runpod/client.mjs` and the fetch headers).
- Shot code is validated before anything runs it (laptop vm with a timeout for the pre-check; the page only after that),
  and in the page it can reach only `api` and `Math`. The page runs in the RunPod worker's headless Chrome, which holds no
  secrets; the job carries only signed upload URLs for its own test folder.

## Where it should run in production
The orchestrator loop is light (JSON, a few vm runs, HTTP calls), but it lives 10-30 minutes and holds the Anthropic key.
- **A Supabase edge function: no.** The wall-clock limit (a few minutes per invocation) is far below one directing session;
  it would have to be chopped into resumable steps with the conversation in the database. Possible later, not first.
- **A RunPod job: possible but wasteful.** A GPU worker would sit idle (billed ~$0.58/h) while the model thinks: 20 min =
  ~$0.19 per video for nothing, and the Anthropic key would have to live in a RunPod secret next to the page that runs
  generated code (the code is sandboxed by the validator, but keeping keys off the render boxes is the cleaner line).
- **A small CPU worker (recommended):** one container (Fly.io machine, like the existing Cutaway staging app, or a queue
  worker) that pulls a job from the render queue, runs `director.mjs`, sends the RunPod jobs and writes progress to the
  database. Cost ~$0.002-0.01 per video of CPU; the Anthropic key is a secret of that worker only; RunPod keeps doing
  only rendering. Concurrency = workers x 1 session each; the money caps (agent cap per video + the template's emergency
  cap) are enforced in the worker before every call.
