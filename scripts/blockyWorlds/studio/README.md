# Blocky Worlds STUDIO MODE (prototype, owner-only, 2026-11-12)

An AI director hand-directs every cut: it writes small shot code for our own three.js engine, looks at preview stills
rendered on RunPod, fixes the bad cuts, then the final renders in parallel on RunPod. Not deployed; not wired into the app.

## Flow
1. `engine/dev/studio/prepare.mjs`: the production writer (llm.js writeScript, board mode) -> the narrator take
   (Scruffy Duck on eleven_v3) re-processed by `pace.mjs`: ALWAYS 1.25x at the same pitch, pauses cut to ~0.10 s inside
   a sentence and ~0.22 s between sentences, no gap over 0.45 s (wpm reported, never a stop) -> the base plan
   (planVideo with the real word timings, the free mock director; `castFix.mjs` turns an animal the planner cast as a
   person back into a pet) -> music A + the mix. `--from <run>` reuses another run's script and paid take.
2. `engine/dev/studio/direct.mjs --model sonnet|opus --rounds N`: ONE director for the whole story (`agent.mjs`, run 1's
   setup, 2026-11-13): bible, assets and every cut in one conversation, the free checks answering each write (code,
   timing, the engine checks, the SHOT MIX of `shotMix.mjs`) -> finish -> a round: contact sheets on RunPod, the BLOCKING
   pixel check (`pixel.mjs`: black, flat wall, one colour, dark slab) and the ONE fixed Sonnet checker (`checker.mjs`) ->
   the failures + the sheets back into the conversation, at most N fix rounds (v3 1, v4 up to 3) -> the best version
   renders -> the final (`render.mjs`, parallel jobs) -> the contact sheet + the free frame check (`finalize.mjs`) ->
   report.json. `checkFinal.mjs` runs the same fixed checker on any finished run's final frames (run-to-run comparison).

## Files
| File | What |
|---|---|
| `shotApi.js` | the only API shot code can use (`api.*`, `Math.*`), poses, faces, animals, limits |
| `validate.mjs` | the whitelist validator (esprima AST): no globals, no eval / Function / import / network, no `x[expr]`, bounded loops |
| `shotCheck.mjs` | free Node pre-check, run in a SANDBOXED CHILD PROCESS (`sandbox/checkChild.mjs`: empty env, Node permission model, network off, 120 s): `shotCheckCore.mjs` runs each cut against a stub API in a vm (timeout): runtime errors, unknown ids, camera motion, frame 0 mid-move, asset sizes |
| `library/` | the STUDIO ASSET LIBRARY: built things saved PENDING (`items/<id>.json` + `thumbs/<id>.jpg`), `lookup(name, kind)` = approved only, `approve.mjs <id> [--reject]`, the owner's `review.html`, `showcase.mjs` (a build alone on RunPod for its thumbnail) |
| `assemble.mjs` | the agent's plan -> a real engine timeline (set "board", `studio: <id>`); the cuts' declarations become the engine's shot fields, so checkTimeline / checkVisuals / checkSubjects / checkProduction / the storyboard rule + action checks run unchanged |
| `page/studioBoard.js` | the page adapter shipped inside the job in place of `page/simple/board.js`: the real board stages the cut, then the validated code runs every frame; the night floor (key / rim / creature-face / sky fill at 0.12, calibrated on RunPod) and the NIGHT GRADE outdoors (dark sky, warm lamps, the lights confined to the subject; calibrated on test A2's night cuts), built things blocking the lens hidden, per-frame stats; a still camera's safety push |
| `bundle.mjs` | the page-code-in-job bundle (like `engine/dev/simple/bundle.mjs`): changed engine files + the adapter + the timeline + the code as base64 data |
| `render.mjs` | RunPod endpoint from `BLOCKY_WORLDS_STUDIO_ENDPOINT` (default `gm9eqdkuyc2ofs`; Cutaway's `f66astc0vrus92` refused), the image's `simpleStills` role: preview contact sheets; the final as 2x2 full-size frame packs over K parallel jobs, then a local encode + mux |
| `agent.mjs`, `prompt.mjs` | the one director (run 1's prompt + the shot-mix and creature rules; four tools; finish-driven rounds; every call priced worst-case first with the cached prefix at the read price and the output limit fitted to what is left; every answer saved on arrival; the best version kept) |
| `checker.mjs` | the one fixed vision checker (Sonnet 5.5, low effort) for every tier |
| `shotMix.mjs` | the shot-mix rules (75% doing something, empty wides at most 1 in 6, never the same building twice in a row, creatures with a body and a face) |
| `pixel.mjs` | the blocking frame checks (thresholds calibrated on run 1's frames) |
| `pace.mjs`, `castFix.mjs` | the voice: 1.25x + the pause cut; the cast fixes on the base plan (an animal cast as a person, a named thing cast as a person, a relation cast twice) |
| `ledger.mjs` | cost + time per step (`steps.jsonl`), the experiment cap and the agent cap |

## Security model
- The customer topic / script is delimited DATA in the user message; the system prompt and the tools are fixed.
- The model gets four tools and nothing else: no shell, no files, no network, no keys. The keys stay in the orchestrator
  (`.env.local` read by `engine/runpod/client.mjs` and the fetch headers).
- Shot code is validated before anything runs it (the pre-check runs it in a separate Node process with no env keys, no
  network, no file writes and no child processes, in a vm with a timeout; the page only after that),
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
