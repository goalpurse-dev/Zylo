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
