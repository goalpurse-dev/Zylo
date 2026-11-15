# Blocky Worlds STUDIO WORKER (CPU only): pulls queued Studio runs from the database and runs the Studio v3 loop
# (scripts/blockyWorlds/studioWorker/worker.mjs). No GPU, no Chrome: the frames are rendered on RunPod (gm9eqdkuyc2ofs;
# the owner's Blender engine runs on the Blender endpoint sp338bavcw2gtn).
# The build context is made by scripts/blockyWorlds/studioWorker/buildContext.mjs (the repo layout under app/, plus
# build/changed-files.json, because the container has no git; and kit/, the Blender story kit's text, from outside the
# repo). Nothing secret is in the image: the keys are the app's Fly secrets (docs/blocky-worlds-launch.md).
FROM node:22-trixie-slim

ENV DEBIAN_FRONTEND=noninteractive
# ffmpeg >= 7 (studio/pace.mjs uses -/filter_complex), fonts for nothing visible (the captions are drawn on RunPod)
# THE BLENDER ENGINE (blenderKit/pipeline.mjs, owner-only): python3 as `python` (the pipeline calls python: shotcheck.py,
# kitmap.py, contact.py, the frame scan, the tars) + Pillow (the contact sheets, the black-frame scan). Blender itself
# runs on the RunPod Blender endpoint, never here.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates python3 python3-pil python-is-python3 \
 && rm -rf /var/lib/apt/lists/*

# the engine's packages (esprima for the shot-code validator comes with them); no browser download
ENV PUPPETEER_SKIP_DOWNLOAD=1
WORKDIR /app/scripts/blockyWorlds/engine
COPY app/scripts/blockyWorlds/engine/package.json app/scripts/blockyWorlds/engine/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY app/ /app/
# THE KIT (a creator's Blender story kit, used with permission; never in git): only the text the director reads (its
# guide, playbook, rbx/ toolkit, tools/, the worked examples), copied into the build context by buildContext.mjs
COPY kit/ /kit/
# the pipeline saves new builds PENDING the owner's approval here (best effort: lost on a redeploy)
RUN mkdir -p /app/scripts/blockyWorlds/blenderKit/library/items /app/scripts/blockyWorlds/blenderKit/library/thumbs \
 && chown -R node:node /app/scripts/blockyWorlds/blenderKit/library
WORKDIR /app
ENV NODE_ENV=production \
    BLOCKY_WORLDS_KEYS_FROM_ENV=1 \
    BLOCKY_WORLDS_CHANGED_FILES=/app/build/changed-files.json \
    BLOCKY_WORLDS_WORK_DIR=/tmp/blocky-studio \
    BLOCKY_WORLDS_KIT_DIR=/kit

# every module the loop can load must import, and the Blender engine's free checks must pass (python3 + PIL, the kit,
# shotcheck / kitmap / contact, ffmpeg): a missing piece fails the build, never a paid run
RUN node scripts/blockyWorlds/studioWorker/worker.mjs --smoke

USER node
CMD ["node", "scripts/blockyWorlds/studioWorker/worker.mjs"]
