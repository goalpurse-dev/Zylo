// M3: the Chrome flag sets tried on a GPU machine, best first (m3/gpuCheck.mjs picks the first that reaches the GPU).
const base = ["--no-sandbox", "--headless=new", "--ignore-gpu-blocklist", "--enable-gpu", "--disable-gpu-sandbox", "--enable-webgl"];
export const FLAG_SETS = {
  vulkan: [...base, "--use-angle=vulkan", "--enable-features=Vulkan", "--disable-vulkan-surface"],
  egl: [...base, "--use-gl=angle", "--use-angle=gl-egl"],
  eglNative: [...base, "--use-gl=egl"],
  default: [...base],
};
