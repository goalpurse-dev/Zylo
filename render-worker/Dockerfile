# Zyvo render worker — Node 22 + FFmpeg (+ Deno for the overlay drawing).
# One container renders one job at a time with all its CPUs (segments in
# parallel). Never runs on edge functions. Node 22 (exact tag) + npm ci from the
# lockfile: the same dependencies on every build. supabase-js needs the
# native WebSocket (on Node 20 createClient throws at boot).
FROM denoland/deno:bin-2.1.4 AS deno
FROM node:22.23.3-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deno /deno /usr/local/bin/deno
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
# The app's own text/caption drawing code, synced by scripts/sync-shared.mjs at
# the same relative paths as in the repo (/supabase/..., /src/lib/...).
COPY shared/ /
RUN deno cache --no-check src/draw-overlays.ts
ENV WORK_DIR=/tmp/render NODE_ENV=production DENO=/usr/local/bin/deno
# --once: claim one job, render it, exit (a per-job machine that scales to zero).
# --loop: keep polling the queue (a long-lived worker).
CMD ["node", "src/worker.mjs", "--once"]
