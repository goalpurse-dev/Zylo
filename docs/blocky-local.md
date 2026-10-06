# Blocky Stories on this computer (local stack)

Blocky Stories is built and tested here first: a local database, sign-in,
storage and live updates in Docker, with Blocky's two functions served next to
them. Nothing in this guide writes to the real project. Blocky's tables and
functions reach the real project only when you approve them.

Status on 2026-10-06: everything below is written, and the database part has
been run in a throwaway in-process Postgres (36 of 36 checks). The Docker
stack itself has **not been started yet**: Docker is not installed on this
computer. Steps 4 to 7 are the first real run, and step 4 is the one most
likely to need a fix (see "If setup or start fails").

## 1. Install Docker Desktop (once)

1. Windows 11 Home needs WSL 2. Open PowerShell **as administrator** and run:
   ```powershell
   wsl --install
   ```
   Restart the computer when it asks.
2. Download Docker Desktop for Windows from
   https://www.docker.com/products/docker-desktop/ and run the installer.
   Keep "Use WSL 2 instead of Hyper-V" ticked.
3. Start Docker Desktop and wait until it says "Engine running". Accept the
   terms; no Docker account is needed.
4. Check it, in any terminal:
   ```powershell
   docker run --rm hello-world
   ```
   It should print "Hello from Docker!".

Docker Desktop must be running whenever you use the local stack. It uses
about 4 GB of memory while the stack is up.

## 2. One-time setup

In `C:\Users\Public\Zylo`:

```powershell
npm i --no-save @electric-sql/pglite        # only for the SQL dry run in step 8
node scripts/blocky/local.mjs setup
```

`setup` creates the folder `.blocky-local/` (git-ignored). It holds the local
Supabase's settings, a copy of Blocky's functions only, and the database
definitions: the shape of the real database (definitions only, **no rows**;
this is the one step that reads the real project, and it only reads) plus
Blocky's own backend from `supabase/pending/`.

It also creates `.env.blocky.local` from the example if it isn't there.

## 3. Local keys (never the production keys)

Open `.env.blocky.local` and fill in three keys. Make each one new, for local
use only, with a low spending limit:

| Key | Where to make it | Used for | Suggested limit |
|---|---|---|---|
| `RUNWARE_API_KEY` | Runware dashboard → API keys → new key | scene pictures, clips, location plates | the lowest prepaid amount or cap it allows, about $5 |
| `ANTHROPIC_API_KEY` | console.anthropic.com → a new workspace "blocky-local" → API key; set the workspace spend limit | the story writer and the script editor | $5 a month |
| `OPENAI_API_KEY` | platform.openai.com → a new project "blocky-local" → API key; set the project budget | the picture check, the clip word check, small rewrites, the upload text | $5 a month |

Not needed locally: Fly (the final video is joined on a Fly machine; see
"What does not work locally"), Resend (alert emails), Stripe.

The file starts with `BLOCKY_PAID_CALLS=off`: with that line no paid call can
be made at all. The file is git-ignored, and a commit that contains it (or any
other env file with keys) is refused by the pre-commit hook and by the tests.

## 4. Start it

Three terminals, all in `C:\Users\Public\Zylo`:

```powershell
# Terminal 1: the local Supabase (first start downloads about 3 GB; later starts take a minute)
node scripts/blocky/local.mjs start
node scripts/blocky/local.mjs seed
node scripts/blocky/local.mjs serve        # leave running: Blocky's functions + the job sweep
```

```powershell
# Terminal 2: the site, pointed at the local stack
npm run dev -- --mode blocky
```

Open http://localhost:5173/workspace/blocky-stories and sign in with the
account `seed` printed (default: `upwardlift6@gmail.com` / `blocky-local-1234`;
it exists only in the local database, with a Generative plan, 2,000 credits
and the Blocky switch on).

`--mode blocky` makes the site read `.env.blocky.local`, so it talks to
`http://127.0.0.1:54321` instead of the real project. Plain `npm run dev` is
the real project, as always.

## 5. Everyday use

```powershell
node scripts/blocky/local.mjs status     # what is running, which keys are set, paid calls on or off
node scripts/blocky/local.mjs stop       # stop (the local data is kept)
node scripts/blocky/local.mjs start      # start again
node scripts/blocky/local.mjs reset      # wipe the local database and rebuild it, then run seed again
node scripts/blocky/local.mjs setup --refresh   # after the real database changed shape
```

While `serve` runs, a saved edit in `supabase/functions/_shared/blocky/`,
`blocky-story-api/` or `blocky-worker/` is copied over and reloaded.
The local database's own dashboard is at http://127.0.0.1:54323.

## 6. A paid local run (pictures, clips)

1. Decide the run and its cost first (the Blocky budget and its one-attempt
   rule still apply).
2. A provider has to fetch stored pictures (a clip starts from its scene
   picture; an edit starts from the current picture), so the local storage
   needs an address the internet can reach. Install cloudflared once
   (`winget install Cloudflare.cloudflared`), then in a fourth terminal:
   ```powershell
   cloudflared tunnel --url http://127.0.0.1:54321
   ```
   Copy the `https://….trycloudflare.com` address it prints into
   `.env.blocky.local` as `BLOCKY_PUBLIC_URL=…`.
3. In `.env.blocky.local` set `BLOCKY_PAID_CALLS=on`.
4. Run `seed` again (the avatars' picture addresses must use the tunnel), then
   restart `serve`.
5. When the run is done: set `BLOCKY_PAID_CALLS=off` again, stop the tunnel,
   set `BLOCKY_PUBLIC_URL=http://127.0.0.1:54321`.

While the tunnel is open the local stack is reachable from the internet under
a random address, with the local Supabase's standard keys (they are the same
on every computer, so they are not secret). Keep it open only for the run;
the low limits on the local provider keys are the backstop.

## 7. Two products, one balance: the locking test

Blocky and Fruit charge the same credit balance. With the stack running:

```powershell
node scripts/blocky/chargeLocking.mjs
```

It fires 30 charges at once at one account that can afford 10 (15 through
Blocky's charge function, 15 through Fruit's), and then refunds one job ten
times at once. It calls no provider and spends nothing. Expected: 6 of 6.

## 8. The SQL dry run (no Docker needed)

```powershell
node scripts/blocky/sql/dryRun.mjs
```

Runs both files in `supabase/pending/` in a throwaway in-process Postgres:
Blocky's backend on a database with no Fruit object at all, and the Fruit undo
on a replica of Fruit's live tables. Expected: 36 of 36.

## What does not work locally

- **The final video.** It is joined on a Fly machine that has to download the
  clips and call back; that needs the Fly image `zyvo-render:blocky-final`
  (not built yet) and a Fly token. Stories stop at "clips ready" locally.
  The builder itself can be run by hand:
  `node render-worker/src/blockyFinal.mjs --local out.mp4 job.json`.
- **The clip last-frame check** (also a Fly machine). The picture check and
  the clip word check do run.
- **Story ideas.** The idea engine is its own phase: "Describe it" and "My own
  script" work.
- **The full avatar library.** `seed` loads the avatars that have a test
  picture on this computer; the 24 references are the next phase.
- **Webhooks from Runware** (off locally): a result is picked up by the sweep
  45 to 90 seconds after it was sent, so pictures and clips feel slower here
  than on the real project.
- Other tools' pages in the local site: only Blocky's functions run locally,
  so anything else that needs a function shows an error there.

## If setup or start fails

- `setup`: "The schema dump failed" → Docker Desktop is not running, or the
  folder is not linked (`npx supabase link`).
- `start` stops on a database error in `00000000000001_baseline.sql`: the real
  database's definitions lean on something the local one lacks (an extension,
  a schema). Send the error line; the fix goes into the small
  `00000000000000_extensions.sql` that `setup` writes.
- Port 54321 to 54323 already in use → `node scripts/blocky/local.mjs stop`,
  or close whatever holds the port.
- The page says "couldn't load" → `serve` is not running, or the site was
  started without `--mode blocky`.

## Going to the real project (only with your go)

1. `supabase/pending/20261026100000_blocky_stories_backend.sql` is applied to
   the real database (it creates Blocky's objects only; its dry run is step 8).
2. Secrets `BLOCKY_WORKER_SECRET` (and the worker's address and secret in the
   database vault, for the sweep) are set.
3. `blocky-story-api` and `blocky-worker` are deployed. No Fruit function is
   touched or redeployed.
4. The Fly image `zyvo-render:blocky-final` is built.
The page stays hidden behind `blocky_v1` the whole time.
