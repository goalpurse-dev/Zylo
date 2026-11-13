# Blocky Worlds STUDIO WORKER (CPU only): pulls queued Studio runs from the database and runs the Studio v3 loop
# (scripts/blockyWorlds/studioWorker/worker.mjs). No GPU, no Chrome: the frames are rendered on RunPod (gm9eqdkuyc2ofs).
# The build context is made by scripts/blockyWorlds/studioWorker/buildContext.mjs (the repo layout under app/, plus
# build/changed-files.json, because the container has no git). Nothing secret is in the image: the keys are the app's
# Fly secrets (docs/blocky-worlds-launch.md).
FROM node:22-trixie-slim

ENV DEBIAN_FRONTEND=noninteractive
# ffmpeg >= 7 (studio/pace.mjs uses -/filter_complex), fonts for nothing visible (the captions are drawn on RunPod)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# the engine's packages (esprima for the shot-code validator comes with them); no browser download
ENV PUPPETEER_SKIP_DOWNLOAD=1
WORKDIR /app/scripts/blockyWorlds/engine
COPY app/scripts/blockyWorlds/engine/package.json app/scripts/blockyWorlds/engine/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY app/ /app/
WORKDIR /app
ENV NODE_ENV=production \
    BLOCKY_WORLDS_KEYS_FROM_ENV=1 \
    BLOCKY_WORLDS_CHANGED_FILES=/app/build/changed-files.json \
    BLOCKY_WORLDS_WORK_DIR=/tmp/blocky-studio

# every module the loop can load must import (a missing file fails the build, never a paid run)
RUN node scripts/blockyWorlds/studioWorker/worker.mjs --smoke

USER node
CMD ["node", "scripts/blockyWorlds/studioWorker/worker.mjs"]
