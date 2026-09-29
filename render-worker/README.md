# Zyvo render worker

Renders a long-form project's EDL into the final MP4 (1920×1080, 30 fps, H.264
CRF 23 `-preset slow -tune animation`, AAC 192 kbps, `+faststart`) plus a
640×360 proxy. Node 20 + FFmpeg in Docker. It never runs on Supabase edge
functions.

## Flow

1. `claim_long_form_render_job` (SQL, `FOR UPDATE SKIP LOCKED`). This takes the
   oldest `queued` job, or a `rendering` job whose heartbeat is older than
   5 minutes (its machine died). Attempts are capped at 3.
2. Download the job's inputs from `long-form-renders/<project>/<job>/inputs`.
   Every image is checked against the EDL's `imageSha256`, and a mismatch is a
   terminal `IMAGE_HASH_MISMATCH`. The EDL itself was built from the newest
   approved image version per beat and refused otherwise (`checkImageIntegrity`).
3. Render one segment per clip, in parallel (`CONCURRENCY`, default CPUs−1,
   max 8). Finished segments are kept on disk, so a restarted job resumes and
   renders only what's missing.
4. Concat with stream copy and add the narration, then build the proxy.
5. Run the checks:
   - Duration equals the audio length ±1 frame.
   - Every cut is within 1 frame of its beat.
   - No black or white runs.
   - Audio lag is under 1 frame at 3 spots (cross-correlated against the
     source narration).
6. Upload the output, proxy and thumbnail with TUS (resumable, 6 MB chunks).
7. Call `finish-long-form-render`. It does four things:
   - Records the job result.
   - Moves the project to `complete` or `failed` (with a user-facing reason).
   - Settles the reservation on success, or releases it only on a terminal
     failure before any spend.
   - Writes the compute cost (seconds × `MACHINE_USD_PER_SECOND`) to the cost
     ledger, stage `render`.

A transient error puts the job back in `queued`, and the next claim resumes it.
A terminal error, or the last attempt, marks it `failed`.

## Host: Fly.io Machines (recommended)

Fly.io is recommended because the worker is already a Docker image, and Fly
bills per second and scales to zero:
- An edge function can start one `performance-8x` machine per job through the
  Machines API, triggered when a `long_form_render_jobs` row is inserted.
- The machine runs `--once` and exits, so we pay only for render minutes.

Cloud Run Jobs is the runner-up. It suits a team that already uses GCP.
Railway suits long-lived services more than per-job batch work.

```sh
fly apps create zyvo-render
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... MACHINE_USD_PER_SECOND=0.0000957 RENDER_HOST=fly RENDER_MACHINE=performance-8x
fly deploy --build-only --push            # image to registry.fly.io/zyvo-render
# per job (from an edge function on insert):
#   POST https://api.machines.dev/v1/apps/zyvo-render/machines
#   { "config": { "image": "registry.fly.io/zyvo-render:latest", "guest": { "cpu_kind": "performance", "cpus": 8, "memory_mb": 16384 }, "auto_destroy": true, "restart": { "policy": "no" } } }
```

## Environment

| var | default | |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | (none, required) | service access |
| `CONCURRENCY` | CPUs−1 (max 8) | parallel segments |
| `CRF` | 23 | final encode quality |
| `MACHINE_USD_PER_SECOND` | 0.0000957 | ≈ Fly performance-8x list price (estimate); confirm on the host's pricing page |
| `FFMPEG`, `FFPROBE` | `ffmpeg`, `ffprobe` | binaries |
| `WORK_DIR` | `$TMP/zyvo-render` | segments + inputs (resume state) |

## Storage limit

Final MP4s run about 70–90 MB. The `long-form-renders` bucket allows 1 GB, but
Supabase also enforces a project-wide upload limit (Dashboard → Storage →
Settings), and that limit must be at least as large.
