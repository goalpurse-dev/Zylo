# Render worker on Fly.io (Phase 6f)

You run these commands yourself, in **Windows PowerShell**. No token is ever
shown or pasted: the Fly deploy token goes straight from `fly` into a Supabase
secret.

## 0. flyctl on PATH

The installer puts `fly.exe` in `%USERPROFILE%\.fly\bin`. If `fly` isn't
found, add that folder to PATH:

```powershell
# this window only
$env:Path += ";$env:USERPROFILE\.fly\bin"
# permanently (for new windows)
[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";$env:USERPROFILE\.fly\bin", "User")
fly version
```

## 1. One time: log in and create the app

```powershell
fly auth login
Set-Location render-worker
fly apps create zyvo-render            # skip if it already exists
```

`primary_region` in `fly.toml` is `fra`. Change it to the region nearest the
Supabase project, if that's somewhere else.

## 2. Secrets: the worker's Supabase access

```powershell
fly secrets set --app zyvo-render SUPABASE_URL=https://ilpiwoxubnevmxxikyvx.supabase.co
# the service key, read from ..\.env.local and never displayed:
$key = ((Get-Content ..\.env.local | Where-Object { $_ -match '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=' }) -replace '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=', '').Trim().Trim('"').Trim()
"key length: $($key.Length)"           # must be > 20; 0 = not found (run this from render-worker\)
fly secrets set --app zyvo-render "SUPABASE_SERVICE_ROLE_KEY=$key"
Remove-Variable key
fly secrets list --app zyvo-render      # must list SUPABASE_URL AND SUPABASE_SERVICE_ROLE_KEY
```

"Staged" in that list is fine: machines started by the render function still get the secrets.

## 3. Build and push the image (redo after every worker change)

From `render-worker\`:

```powershell
node scripts/sync-shared.mjs            # copies the app's text/caption drawing code into render-worker\shared\
fly deploy --app zyvo-render --build-only --push --image-label latest | Tee-Object -Variable build
# pin the exact image: Fly hosts cache ":latest", so a new push is NOT picked up by the tag alone
$digest = ([regex]::Matches(($build -join "`n"), 'zyvo-render:latest@(sha256:[0-9a-f]{64})') | Select-Object -Last 1).Groups[1].Value
"digest: $digest"                       # must not be empty
npx supabase secrets set "FLY_RENDER_IMAGE=registry.fly.io/zyvo-render@$digest"
```

The image holds Node 22 (supabase-js needs its native WebSocket; on Node 20
the worker dies at boot), FFmpeg and Deno (for the overlay drawing).
Machines start from `FLY_RENDER_IMAGE`.

Then run the $0 health check (it starts a tiny machine and reports whether
both secrets arrived and the worker's Supabase client starts; no values are
shown): the `fly_health` action of `long-form-render`.

## 4. Let the app start machines (scale to zero: one machine per job, auto-destroyed)

```powershell
$t = fly tokens create deploy --app zyvo-render --expiry 8760h
npx supabase secrets set "FLY_API_TOKEN=$t"
Remove-Variable t
npx supabase secrets set RENDER_MODE=fly FLY_RENDER_APP=zyvo-render
```

## 5. Parallel render (up to 4 machines per video)

This needs an image built from the Phase 6f worker (chunk jobs), so do step 3 first:

```powershell
npx supabase secrets set RENDER_PARALLEL=4     # 1 = one machine per render (the safe default)
```

- Each chunk machine renders about a quarter of the timeline.
- The one that finishes last joins the chunks, mixes the audio, checks and uploads.
- The total CPU time is the same as one machine, so the cost is the same; the wall time is about 4 times shorter.

## Machine spec and cost

- Each render (or chunk) gets 1 machine: performance-8x (8 dedicated CPUs, 16 GB), `auto_destroy: true`, `restart: no`.
- It claims the job, renders, uploads, then calls `finish-long-form-render` (or finishes its chunk) and exits.
- Nothing runs between renders: the app scales to zero.
- The watchdog (pg_cron, every 2 min) starts a new machine for a job that is still queued with no machine after 150 s, or whose heartbeat is stale for over 5 min. The claim resumes the job; attempts are capped at 3.
- Cost is estimated from `MACHINE_USD_PER_SECOND` in `fly.toml` (0.0000957 $/s ≈ $0.34/h) and recorded in the ledger as stage `render`.

## Local fallback (no Fly)

Set `RENDER_MODE` to `local` (`npx supabase secrets set RENDER_MODE=local`) and run a worker on any machine:

```powershell
Set-Location render-worker
node --env-file=..\.env.local src\worker.mjs --loop
```

It needs `ffmpeg`, `ffprobe` and `deno` on PATH. Otherwise set `$env:FFMPEG`, `$env:FFPROBE` and `$env:DENO` first.
