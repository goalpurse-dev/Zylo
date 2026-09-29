# Fly.io deploy checklist: render worker (Phase 6)

The render worker is ready for Fly and still runs locally until Phase 6. At
Phase 6 it ships together with the Render button and the narration-settle
deploy. Code: `render-worker/`, which contains the `Dockerfile`, the
`fly.toml` draft, `src/worker.mjs` and `src/motion.mjs`.

## One-time setup

1. [ ] Create a Fly.io organization and set a billing card.
2. [ ] Install `flyctl` and run `fly auth login`.
3. [ ] Run `cd render-worker && fly apps create zyvo-render`. Set
   `primary_region` in `fly.toml` to the region nearest the Supabase project.
4. [ ] Set the required secrets:
   ```sh
   fly secrets set --app zyvo-render \
     SUPABASE_URL=https://<ref>.supabase.co \
     SUPABASE_SERVICE_ROLE_KEY=<service key>   # sb_secret_… keys work (TUS uses the apikey header)
   ```
   Everything else is non-secret `[env]` in `fly.toml`: `WORK_DIR`,
   `RENDER_HOST`, `RENDER_MACHINE`, `CONCURRENCY`, `CRF` and
   `MACHINE_USD_PER_SECOND`.
5. [ ] Build and push the image:
   `fly deploy --build-only --push --image-label latest`. The image is
   `registry.fly.io/zyvo-render:latest`.
6. [ ] Confirm `MACHINE_USD_PER_SECOND` against Fly's current price for a
   performance-8x machine with 16 GB. The ledger rows stay marked `estimated`
   until the rate is confirmed.

## Triggering (build with the Render button)

7. [ ] Create a Fly API token for the edge function:
   `fly tokens create deploy --app zyvo-render`. Store it as the Supabase
   secret `FLY_API_TOKEN`.
8. [ ] Add a `start-long-form-render` edge function (user-facing) with these
   steps:
   - Check that the user owns the project and that its status is
     `images_ready`, `failed` or `complete`.
   - Build the EDL from the newest approved image version of every beat, and
     refuse any beat on a superseded image.
   - Upload the inputs and insert the `long_form_render_jobs` row.
   - Start one machine by calling
     `POST https://api.machines.dev/v1/apps/zyvo-render/machines` with this body:
     ```json
     { "config": { "image": "registry.fly.io/zyvo-render:latest",
       "guest": { "cpu_kind": "performance", "cpus": 8, "memory_mb": 16384 },
       "auto_destroy": true, "restart": { "policy": "no" } } }
     ```
     The machine runs `node src/worker.mjs --once`, claims the job, renders,
     uploads, calls `finish-long-form-render` and exits.
9. [ ] Add a safety net: a pg_cron job, every 5 minutes, starts a machine
   whenever a job is `queued` with no live machine, or `rendering` with a
   stale heartbeat. The claim RPC already resumes stale jobs.
10. [ ] Deploy `generate-long-form-narration-audio` in the same release. The
    reservation now settles at render completion, not at narration
    (`RENDER_IS_THE_LAST_REAL_STAGE`).

## Verify on Fly before launch

11. [ ] Run one test render of the Myth vs Reality EDL on a performance-8x
    machine. Record the wall-clock time, the compute cost in the ledger
    (stage `render`), the file sizes, and the checks (duration, cuts, blank
    frames, sync), all of which must pass.
12. [ ] Kill the machine mid-render. A new machine must resume from the
    finished segments. Segments live in `WORK_DIR` on the machine's disk, so
    a new machine re-renders them. To keep them across machines, mount a Fly
    volume at `/tmp/render`, or accept the re-render (about 13 min).
13. [ ] Check the Supabase project-wide upload limit. It must be at least
    the final MP4 size, 70–150 MB including the 1440p master. Every other
    bucket keeps its explicit limit (migration `20261014110000`).
