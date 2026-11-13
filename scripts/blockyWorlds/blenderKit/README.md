# Blender kit engine (phase 1: does a creator's Blender story kit render on RunPod GPU?)

The kit (`reference/blocky-worlds/roblox-story-kit/`, git-excluded, used with the creator's permission) builds every
shot in Blender from Python and renders it with EEVEE. This folder is only our glue; the kit's files never enter the
repo: `buildContext.mjs` copies what the image needs into a folder outside it.
Exclusions (the owner's): no TEMPOREX music, no yt-dlp (the kit's `setup.py` / `eleven.py` / `voice.py` are not in the
image), no 1:1 copies of other creators' videos. Music = our own synthesized bed (`engine/audio/music.mjs`, "funny").

## Files
| File | What |
|---|---|
| `Dockerfile` | debian trixie-slim + Blender 5.2.4 (sha256-checked) + ffmpeg/libass + Xvfb + VirtualGL + python3 numpy/Pillow + `runpod`; NVIDIA EGL/Vulkan vendor files; user `render` |
| `buildContext.mjs` | context folder outside the repo: kit `rbx/ assets/ sfx/`, tools `render shotkit kit finish mix`, the video folder, a kit `config.json` (caption font Archivo Black, no music URL), our music, our glue |
| `handler.py` | RunPod handler, roles `probe` / `render` (kit `render.py <slug> final <shots>` -> x264 crf 12 segment) / `finish` (segments -> `frames/%04d.png` -> kit `finish.py`) |
| `boot.py`, `gpucheck.py` | Blender-side: the Python sandbox layer; the EEVEE GPU check |
| `plan.mjs` (+ test) | shot frames from the kit's `shots.py` + `words.json` (the kit's own F(t), Python rounding); contiguous K-way split by frames |
| `setup.mjs` | template + endpoint `zyvo-blender-kit` (3 workers) and Blocky `gm9eqdkuyc2ofs` workersMax 6 -> 3; `--rollback` |
| `dispatch.mjs` | `--probe` / `--render`: estimate first, cap check, jobs, finish, download, contact sheet, spend ledger |
| `contact.py` | one labelled frame per second of the real final encode |

## Build + run
```
node scripts/blockyWorlds/blenderKit/buildContext.mjs <ctx outside the repo>
cd <ctx> && fly deploy --app zyvo-cutaway-render-staging --dockerfile Dockerfile --build-only --push --image-label blender-kit-<n>
node scripts/blockyWorlds/blenderKit/setup.mjs --image registry.fly.io/zyvo-cutaway-render-staging@sha256:<digest> --yes
node scripts/blockyWorlds/blenderKit/dispatch.mjs --probe  --out <dir> --diag-root [--yes]
node scripts/blockyWorlds/blenderKit/dispatch.mjs --render --out <dir> --chunks 6 --s-per-frame <probe's> [--yes]
```

## Sandbox (Blender runs scene code: today the kit's, later generated)
1. **No secrets anywhere near it.** The image holds none and the template sets none. Jobs carry only signed storage
   URLs, and those stay in the handler: Blender never sees them.
2. **Whitelisted environment.** Blender and `finish.py` start with only PATH, HOME/TMPDIR (the job folder), LANG and
   the NVIDIA variables. No `RUNPOD_*` (the worker's own job-queue key lives there) and nothing else from the handler.
3. **Unprivileged user.** `setpriv` drops to the user `render` (no groups, no-new-privs). It can't read
   `/proc/1/environ` (root's env). The kit code and assets are root-owned and read-only. Each job gets its own folder,
   `/tmp/bk/<job>`, with links to the kit and a private copy of the video folder.
4. **No network.** The worker puts the process in a network namespace with no interfaces: root `unshare --net` then
   drop to the user, else a user namespace `unshare --net --map-root-user`. The probe reports which one the
   container allows. Inside Blender's Python, `boot.py` always blocks sockets and subprocesses, and Blender runs with
   `--offline-mode`. That layer still stands if the container allows no namespace.

## Measured (2026-11-13, sneeze_teleport, 66 shots, 2149 frames, 71.6 s, kit settings: 1080x1920, EEVEE ray tracing, 24 samples, motion blur)
- Blender 5.2.4 LTS draws headless on the NVIDIA GPU over **EGL** (`blender -b`, no X server): "NVIDIA RTX A4500/PCIe/SSE2",
  OpenGL 4.6. VirtualGL on Xvfb and Vulkan also work; EGL is used (same OpenGL backend as the kit's desktop renders).
- The container allows no namespaces (`unshare: Operation not permitted`), so the network block is **seccomp**
  (`netblock.py`): NET_BLOCKED for the render user; its env holds no keys; `/proc/1/environ` is denied.
- **0.66 s per frame** on an RTX A4500 (scene builds included), 6 chunks of ~350 frames on 3 workers:
  render wall 553 s, the kit's finish (unpack + mix + captions + 3 encodes) 195 s, **12.2 min end to end**.
  Billed ~1,800 GPU-s = **$0.29** for the 71.6 s video ($0.33 including the two probes); RunPod balance moved $0.336.
- Segments are x264 crf 12 (15-24 MB each), finals 64 MB (`final.mp4`), 70 MB (no captions), 24 MB (phone): all go
  through storage in <= 45 MB parts.
- To check: shot 22 starts with ~0.6 s of black (the poof cloud over the lens in the dim comedy club: the kit's scene
  code, not the worker). Compare with the creator's own render before blaming the engine.

## Phase 2: Studio-Blender (the AI director writes the kit's shots.py), 2026-11-13
| File | What |
|---|---|
| `director.mjs` | the director: cached system prompt = the kit's SKILL.md + PLAYBOOK.md + `kitmap.py`'s toolkit map + both example shots.py; ONE conversation: plan (header code + shot list by word index) -> bodies in batches of <= 8 -> fixes; ONE output schema and ONE effort for every turn (either change rewrites the ~85k-token cache); task budget, streamed, priced worst-case first (whole input at the cache-write price, the last call's measured tokens), never resent after a network failure, every answer saved; the fixed vision checker (Sonnet low) |
| `pipeline.mjs` | one video, automatic after the script: director -> `shotcheck.py` -> previews (kit preview mode + the kit's contact sheets) -> pixel check + vision -> at most 2 fix rounds (10 shots a call; a round the caps cannot fund is skipped) -> a still-crashing shot merges into its neighbour -> the parallel final + the kit's finish (cues, OUR music, captions) -> contact sheet, black / flat scan, library. Resumable (state.json; downloaded previews are never paid again) |
| `shotcheck.py` | the static pre-check (AST): only the kit / math / random / Vector, no imports, no os (but os.path.join), sys, open, eval, getattr, dunders, bpy.ops ... (both kit examples pass). Runs on the laptop / worker AND in the GPU worker before Blender |
| `kitmap.py` | the toolkit map generated from engine/rbx/*.py (signatures + one-line purpose) |
| `trim.mjs` | fit a take to a length by dropping whole lines (free; a script-approval edit) |
| `rp.mjs` | RunPod jobs + storage parts for a run, each priced worst-case on the run's ledger first |
| `library.mjs`, `approve.mjs`, `library/` | built sets / props that passed: saved PENDING; `node approve.mjs <id> [--reject]` |
| `workerSteps.mjs` (+ test) | the Studio worker option: `BLOCKY_WORLDS_RENDER_ENGINE=blender` AND the run's user in `BLOCKY_WORLDS_BLENDER_OWNER_IDS`, else Studio as before (off by default). Same queue / stages / ledger / refund as Studio |
Worker roles added (`handler.py`): `preview` (a validated video tar: known files only, size caps, shotcheck), `render` / `finish` with `videoUrl` (finish runs the kit's `render.py cues` first).
Not done: the Fly worker image would also need the kit's docs + rbx (BLOCKY_WORLDS_KIT_DIR) and python3 + Pillow; nothing deployed.

First test (owner, "In this town, we live in a plane.", Sonnet 5.5): 69 shots, 72.9 s, $2.79 of the $5 cap. Script $0.18,
voice $0.13 (80.6 s take, 3 lines trimmed -> 72.9 s), director $2.09 (three avoidable cache rewrites: plan / batch / fix
schemas differed), vision checker $0.06, GPU previews $0.05, GPU final $0.27. Round 0: 18 crashed, 2 pixel, 18 vision; round 1
fixed every crash (14 vision issues left); round 2 skipped by the cap.

## After the first test (2026-11-13, free changes)
- MUSIC (`music.mjs`): the finish uses OUR track, the one our #2 video used: the engine's bed A (audio/backrooms.mjs via
  bedFromLoop, at the voice's 1.25x pace) at #2's level: 14 LU under the voice after ducking. The kit's mix.py works by
  peaks, so the orchestrator measures the voice and the bed (stereo) and passes `--music <bed> --music-speed 1
  --music-db <calibrated>` to finish.py (the bed travels in the video tar). Check on the plane voice:
  #2's way (engine mixV2) voice -16.0 / music -30.0 LUFS (14.0 LU), the kit with our bed voice -16.5 / music -29.6 LUFS
  (13.1 LU); the kit's mix has no loudnorm: -16.4 LUFS overall vs #2's -14. `node music.mjs --voice <wav> --out <dir>`.
  Needs an image rebuild (handler.py) before the next run.
- DIRECTOR: at least 3 locations (every shot names its location; the plan check asks once more, then stops before any
  GPU money); close-ups framed wider (medium shot with head and shoulders, small props scaled up, the camera 3.5+ units
  from the subject and 2+ from walls / seats / boxes); a FOREGROUND-SLAB pixel suspect (centre box: biggest 16-level
  share + edge density, calibrated on the first test: 8 of 12 slab flags, 3 face close-ups) that the checker is asked to
  confirm (never blocking on its own); the approved library builds that match the story go into the plan brief.
- LIBRARY: approved plane-ext, cabin-scene, belt, kite, hand-bell, oven, hat-on, rope; rejected seat-cake, sky-wind.
