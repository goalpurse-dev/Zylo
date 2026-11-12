# Blocky Worlds worker (RunPod serverless GPU): prepare (voice, plan + checks, mix), chunk (render), finish (join, mux).
# Based on Cutaway's m3/Dockerfile.gpu without whisper: node 22 + Chrome + ffmpeg + the NVIDIA vendor files + runpod.
# The build context comes from runpod/buildContext.mjs. The repo layout is kept (/app/scripts/blockyWorlds/engine and
# /app/supabase/functions/_shared/blockyWorlds), so the voice code's imports of the shared config resolve as in the repo.
FROM node:22-trixie

ENV DEBIAN_FRONTEND=noninteractive \
    NVIDIA_DRIVER_CAPABILITIES=all \
    NVIDIA_VISIBLE_DEVICES=all \
    CHROME_PATH=/usr/bin/google-chrome

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg libvulkan1 libegl1 libgl1 libgles2 ca-certificates wget python3 python3-pip fonts-dejavu-core fonts-noto-color-emoji \
 && wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/chrome.deb \
 && apt-get install -y --no-install-recommends /tmp/chrome.deb \
 && rm -f /tmp/chrome.deb && rm -rf /var/lib/apt/lists/*

# the NVIDIA vendor files: the container gets the driver's libraries but often not these, and without them every
# loader falls back to software rendering
RUN mkdir -p /usr/share/glvnd/egl_vendor.d /etc/vulkan/icd.d \
 && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libEGL_nvidia.so.0"}}' > /usr/share/glvnd/egl_vendor.d/10_nvidia.json \
 && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libGLX_nvidia.so.0","api_version":"1.3"}}' > /etc/vulkan/icd.d/nvidia_icd.json

RUN pip3 install --no-cache-dir --break-system-packages "runpod>=1.7,<2"

WORKDIR /app/scripts/blockyWorlds/engine
COPY engine/package.json engine/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY engine/assets ./assets
COPY engine/lib ./lib
COPY engine/page ./page
COPY engine/audio ./audio
COPY engine/voice ./voice
COPY engine/plan.mjs engine/render.mjs ./
# the image's build id (buildContext.mjs): a worker older than a job's minBuild refuses it (STALE_WORKER)
COPY engine/BUILD_ID ./BUILD_ID
COPY engine/runpod ./runpod
COPY shared /app/supabase/functions/_shared/blockyWorlds
COPY handler.py /app/handler.py

CMD ["python3", "-u", "/app/handler.py"]
