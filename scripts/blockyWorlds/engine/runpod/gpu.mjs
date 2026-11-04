// Blocky Worlds RunPod worker: the GPU check (mirrors scripts/cutaway/proto3d/m3/gpu.mjs + flags.mjs). Finds the first
// Chrome flag set that gives WebGL on the NVIDIA GPU and sets CHROME_ARGS (and its env) for the renders that follow;
// on software rendering (SwiftShader / llvmpipe, a graphics-less MIG slice) it fails with code NO_GPU.
import http from "node:http";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const base = ["--no-sandbox", "--headless=new", "--ignore-gpu-blocklist", "--enable-gpu", "--disable-gpu-sandbox", "--enable-webgl"];
export const FLAG_SETS = {
  // EGL first: on RunPod ANGLE-on-Vulkan reports the GPU but lost the WebGL context on Cutaway's scene (black frames)
  egl: [...base, "--use-gl=angle", "--use-angle=gl-egl"],
  vulkan: [...base, "--use-angle=vulkan", "--enable-features=Vulkan", "--disable-vulkan-surface"],
  software: ["--no-sandbox", "--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-gpu"],
};

/** the WebGL renderer string Chrome gets with these flags (a tiny page, no scene) */
export async function rendererWith(args, env = {}) {
  const page0 = `<canvas id=c></canvas><script>const gl=document.getElementById("c").getContext("webgl2");const e=gl&&gl.getExtension("WEBGL_debug_renderer_info");window.r=gl?(e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)):"no webgl2";</script>`;
  const srv = http.createServer((q, s) => { s.writeHead(200, { "Content-Type": "text/html" }); s.end(page0); }).listen(0);
  try {
    const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, ignoreDefaultArgs: ["--use-angle=swiftshader-webgl", "--disable-gpu"], args, env: { ...process.env, ...env } });
    const p = await b.newPage(); await p.goto(`http://127.0.0.1:${srv.address().port}/`); await p.waitForFunction("window.r", { timeout: 15000 });
    const r = await p.evaluate(() => window.r); await b.close(); return r;
  } finally { srv.close(); }
}

export async function useGpu() {
  const NV = "/usr/share/glvnd/egl_vendor.d/10_nvidia.json";
  const ways = [["egl", FLAG_SETS.egl, {}], ["eglNvidiaOnly", FLAG_SETS.egl, { __EGL_VENDOR_LIBRARY_FILENAMES: NV }], ["vulkan", FLAG_SETS.vulkan, {}]];
  const tried = [];
  for (const [name, args, env] of ways) {
    const r = await rendererWith(args, env).catch((e) => `error: ${String(e.message).slice(0, 200)}`);
    tried.push(`${name}: ${r}`);
    if (/nvidia/i.test(r) && !/swiftshader|llvmpipe|error/i.test(r)) {
      Object.assign(process.env, env);
      process.env.CHROME_ARGS = JSON.stringify(args);
      return `${r} (via ${name})`;
    }
  }
  const sh = (c) => { try { return execFileSync("sh", ["-c", c], { encoding: "utf8" }).trim().slice(0, 300); } catch { return `(${c} failed)`; } };
  throw Object.assign(new Error(`NO_GPU: ${tried.join(" | ")}; gpus: ${sh("nvidia-smi -L 2>&1")}; egl vendors: ${sh("ls /usr/share/glvnd/egl_vendor.d 2>&1 | tr '\\n' ' '")}`), { code: "NO_GPU" });
}

/** CPU mode (tests only: a whole video in software takes an hour+) */
export function useSoftware() { process.env.CHROME_ARGS = JSON.stringify(FLAG_SETS.software); return "SwiftShader (CPU)"; }
