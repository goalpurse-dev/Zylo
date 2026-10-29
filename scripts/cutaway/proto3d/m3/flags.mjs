// M3: the Chrome flag sets tried on a GPU machine, best first (m3/gpuCheck.mjs picks the first that reaches the GPU).
const base = ["--no-sandbox", "--headless=new", "--ignore-gpu-blocklist", "--enable-gpu", "--disable-gpu-sandbox", "--enable-webgl"];
export const FLAG_SETS = {
  // EGL first: on the RunPod L4 (driver 595) ANGLE-on-Vulkan reports the GPU but loses the WebGL context on our scene
  // (the frames come out black), while ANGLE-on-EGL renders it exactly (measured 2026-10-23, m3/podStills.mjs)
  egl: [...base, "--use-gl=angle", "--use-angle=gl-egl"],
  vulkan: [...base, "--use-angle=vulkan", "--enable-features=Vulkan", "--disable-vulkan-surface"],
  eglNative: [...base, "--use-gl=egl"],
  default: [...base],
};
// the CPU fallback: SwiftShader on purpose (a Fly machine has no GPU); as root in a container Chrome needs --no-sandbox
FLAG_SETS.software = ["--no-sandbox", "--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu"];
// the same with the GPU watchdog off (a heavy first frame, the sky map and a 4096 shadow map, can trip it and reset the context)
export const DIAG_SETS = { vulkan: FLAG_SETS.vulkan, egl: FLAG_SETS.egl, vulkanNoWatchdog: [...FLAG_SETS.vulkan, "--disable-gpu-watchdog", "--disable-gpu-process-crash-limit"], eglNoWatchdog: [...FLAG_SETS.egl, "--disable-gpu-watchdog", "--disable-gpu-process-crash-limit"] };
