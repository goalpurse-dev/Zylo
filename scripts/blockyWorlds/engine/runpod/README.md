# Blocky Worlds render worker on RunPod (prepared, NOT built / pushed / deployed)

Mirrors Cutaway's `scripts/cutaway/proto3d/m3/` (same base image, GPU check, handler, storage + RunPod dispatch).
Nothing here has been run against RunPod, Fly or Supabase. Every step below needs the owner's go.

## Files
| File | What |
|---|---|
| `Dockerfile` | node 22 + Chrome + ffmpeg + NVIDIA EGL/Vulkan vendor files + python `runpod` (Cutaway's Dockerfile.gpu without whisper) |
| `handler.py` | RunPod serverless handler: input `{ jobUrl }` or the job inline -> `node runpod/worker.mjs`; raises on failure so RunPod marks it FAILED |
| `worker.mjs` | GPU check (`gpu.mjs`: WebGL must be NVIDIA, else `NO_GPU`), downloads the timeline, renders its frame range(s) (`ranges: [{from,to,upload}]`) or the whole video (`whole: {mixUrl, upload}`), PUTs the mp4(s) to signed URLs, prints `RESULT {...}` |
| `gpu.mjs` | the flag sets (EGL first, then EGL limited to the NVIDIA vendor, then Vulkan) and the check |
| `buildContext.mjs` | assembles the docker build context: engine code (page/, lib/, render.mjs, runpod/) + the assets the page code names (~295 MB today; the jacaranda tree alone is 205 MB) |
| `dispatch.mjs` | splits a finished local run (make.mjs output) into K chunks, K RunPod jobs at once, waits, downloads, joins by stream copy, muxes the local mix. Without `--yes` it only prints the plan + estimate |

Tested locally for free: `worker.mjs` in `mode: "cpu"` with `file://` URLs (12 frames, SwiftShader, chunk written
and probed); `dispatch.mjs` dry run; `buildContext.mjs` into a scratch folder.

## Steps the owner would approve (in order)
1. `node runpod/buildContext.mjs <dir>` then `docker build -t <registry>/zyvo-blocky-render:<tag> <dir>` and push
   (Cutaway pushes to Fly's registry `registry.fly.io/zyvo-cutaway-render-staging`; a Blocky app/registry or the same
   one with a new repo name). Image ~ 1.6-1.8 GB (Cutaway's minus whisper, plus ~300 MB of assets).
2. A RunPod template + endpoint (copy `m3/runpodSetup.mjs`: 16 GB tier GPUs `RTX A4000, RTX 4000 Ada, RTX A4500,
   RTX 2000 Ada`, then A5000/3090; `workersMin 0`, `workersMax` >= the chunk count K, `idleTimeout 5`, flashboot,
   template env `NVIDIA_DRIVER_CAPABILITIES=all`). No model keys needed: the worker only renders. Write
   `runpod/endpoint.json` `{ "endpointId": "..." }`.
3. One paid test: `node make.mjs --example --out out/rp1` (free, local) then
   `node runpod/dispatch.mjs --run out/rp1 --out out/rp1/runpod --chunks 4 --yes` (~$0.05, see below). It logs
   billed seconds to `spend.jsonl` and deletes its storage test folder.

## Cost model (one 90 s video, 24 fps = ~2,170 frames incl. the 0.4 s tail)
Measured on this laptop (integrated Radeon, real look, street set, 1080x1920, capture included): **0.245 s/frame**.
Cutaway measured the same kind of page at 0.27 s/frame on this laptop and **0.0725 s/frame on a RunPod L4** (3.7x).
So the 16 GB tier (A4000 / 4000 Ada, roughly L4-class for WebGL) should do **~0.07-0.10 s/frame; 0.08 used**.
Price: the 16 GB tier $0.58/h = **$0.000161/s** (Cutaway's RATE; RunPod lists $0.00016-0.00019/s for that tier).
Each chunk also pays a cold start (~15 s; flashboot/warm workers cut it to a few s) and a page load (~10 s: models
+ textures; 11 s measured locally).

| Chunks K | GPU-seconds billed | Cost | Wall time (render) |
|---|---|---|---|
| 1 | 174 + 25 = ~199 s | **~$0.032** | ~3.3 min |
| 4 | 174 + 100 = ~274 s | **~$0.044** | ~70 s |
| 8 | 174 + 200 = ~374 s | **~$0.060** | ~47 s |

At a pessimistic 0.12 s/frame: K=4 is ~360 s = ~$0.058. Splitting never makes it cheaper, it only cuts the wait;
K=4 is the sweet spot (matches Cutaway's `workersMax: 4`). Voice, plan, music and mix stay local/free in this MVP
(make.mjs), so this is the whole render cost. Parallel pages inside one GPU (`pages: 2`) are untested on NVIDIA; on
this laptop they gave nothing (GPU-bound).

## Known gaps
- Not built: the image build, push, endpoint and a real GPU benchmark (the 0.08 s/frame is an estimate).
- The NVIDIA blank-frame guard is in render.mjs (mean brightness < 3/255 -> re-render up to 6x, then reuse the last
  good frame), tested only with a forced blank (`BW_BLANK_TEST`).
- dispatch.mjs has no Fly CPU fallback (a CPU render of 2,170 frames at ~3.2 s/frame is ~2 h on one machine).
