#!/bin/bash
# M3, on the GPU machine (RunPod pod, image node:22-trixie): set up headless Chrome on the GPU, check that WebGL really
# uses it, measure the render, upload the results. Every step is timed in setup.log. The controller (m3/gpuTest.mjs)
# deletes the pod when the results arrive, or after its time limit.
# env: BUNDLE_URLS (the render bundle, in parts), UP_LOG, UP_CHECK, UP_BENCH, UP_VIDEO (signed upload URLs), PAGE_KEY, LENGTH_SEC
T0=$(date +%s)
LOG=/work/setup.log; mkdir -p /work; exec > >(tee -a $LOG) 2>&1
log() { echo "[$(( $(date +%s) - T0 ))s] $*"; }
up() { [ -f "$2" ] && curl -sS -X PUT -H "Content-Type: $3" --data-binary @"$2" "$1" >/dev/null && log "uploaded $2"; }
# the log goes last: its arrival tells the controller that everything is uploaded
finish() { set +e; trap - ERR; log "done ($1)"; up "$UP_CHECK" /work/gpucheck.json application/json; up "$UP_BENCH" /work/bench.json application/json; [ "$MODE" != "stills" ] && [ -f /work/full.mp4 ] && ffmpeg -v error -y -i /work/full.mp4 -vf scale=540:-2 -c:v libx264 -crf 30 -an /work/full_small.mp4; up "$UP_VIDEO" /work/full_small.mp4 video/mp4; up "$UP_LOG" $LOG text/plain; sleep infinity; }
trap 'finish error' ERR
set -eE

log "start epoch $T0"; nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv || log "no nvidia-smi"
log "driver capabilities: $NVIDIA_DRIVER_CAPABILITIES"
apt-get update -qq
apt-get install -y -qq --no-install-recommends ffmpeg libvulkan1 libegl1 libgl1 libgles2 vulkan-tools ca-certificates wget >/dev/null
log "packages"
wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -O /tmp/chrome.deb
apt-get install -y -qq /tmp/chrome.deb >/dev/null
log "chrome $(google-chrome --version)"

# the NVIDIA vendor files: the container gets the driver libraries but often not these, and then every loader falls back
# to software (SwiftShader / llvmpipe)
ls /usr/lib/x86_64-linux-gnu/ | grep -iE "libEGL_nvidia|libGLX_nvidia|libnvidia-glcore" | head -5 || true
mkdir -p /usr/share/glvnd/egl_vendor.d /etc/vulkan/icd.d
[ -f /usr/share/glvnd/egl_vendor.d/10_nvidia.json ] || echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libEGL_nvidia.so.0"}}' > /usr/share/glvnd/egl_vendor.d/10_nvidia.json
[ -f /etc/vulkan/icd.d/nvidia_icd.json ] || echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libGLX_nvidia.so.0","api_version":"1.3"}}' > /etc/vulkan/icd.d/nvidia_icd.json
vulkaninfo --summary 2>&1 | grep -iE "deviceName|driverName|apiVersion" | head -6 || log "vulkaninfo failed"
log "vendor files"

cd /work && for u in $BUNDLE_URLS; do curl -sSL "$u" >> bundle.tgz; done && tar xzf bundle.tgz && rm bundle.tgz
log "bundle"
npm ci --omit=dev --no-audit --no-fund >/dev/null
log "npm"
export CHROME_PATH=/usr/bin/google-chrome
node m3/gpuCheck.mjs /work/gpucheck.json
log "gpu check: $(node -e 'console.log(JSON.parse(require("fs").readFileSync("/work/gpucheck.json","utf8")).pick)')"
if [ "$MODE" = "stills" ]; then
  node m3/podStills.mjs "$PAGE_KEY" "$STILL_TIMES" /work/bench.json; cp /work/stills.tgz /work/full_small.mp4
  log "stills"
else
  node m3/podBench.mjs "$PAGE_KEY" "$LENGTH_SEC" /work/gpucheck.json /work/bench.json
  log "bench"
fi
finish ok
