// M3: the GPU check, shared by the staging worker (worker.mjs) and the production job (videoJob.mjs). It finds the first
// Chrome flag set that gives WebGL on the NVIDIA GPU and sets CHROME_ARGS (and its env) for the renders that follow; on
// software rendering it fails with NO_GPU, listing what it found, so the dispatcher retries elsewhere.
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { FLAG_SETS } from "./flags.mjs";

const PROTO = process.env.CUTAWAY_PROTO ?? "/app/proto";

/** the renderer WebGL gets with these flags (a tiny page, no scene) */
export async function rendererWith(args, env = {}) {
  // puppeteer comes from the render folder's packages (the image has them there; so does the laptop's render folder)
  const puppeteer = (await import(pathToFileURL(createRequire(path.join(PROTO, "package.json")).resolve("puppeteer-core")).href)).default;
  const page0 = `<canvas id=c></canvas><script>const gl=document.getElementById("c").getContext("webgl2");const e=gl&&gl.getExtension("WEBGL_debug_renderer_info");window.r=gl?(e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)):"no webgl2";</script>`;
  const srv = http.createServer((q, s) => { s.writeHead(200, { "Content-Type": "text/html" }); s.end(page0); }).listen(0);
  try {
    const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, ignoreDefaultArgs: ["--use-angle=swiftshader-webgl", "--disable-gpu"], args, env: { ...process.env, ...env } });
    const p = await b.newPage(); await p.goto(`http://127.0.0.1:${srv.address().port}/`); await p.waitForFunction("window.r", { timeout: 15000 });
    const r = await p.evaluate(() => window.r); await b.close(); return r;
  } finally { srv.close(); }
}

/**
 * The GPU check: EGL as the GPU test pod had it; EGL with the vendor loader limited to NVIDIA (otherwise it falls back
 * to Mesa quietly); Vulkan last (it lost the WebGL context on our scene on the test pod). Returns the renderer string.
 */
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
  throw Object.assign(new Error(`NO_GPU: ${tried.join(" | ")}; NVIDIA_DRIVER_CAPABILITIES=${process.env.NVIDIA_DRIVER_CAPABILITIES}; devices: ${sh("ls /dev/nvidia* /dev/dri 2>&1 | tr '\\n' ' '")}; gpus: ${sh("nvidia-smi -L 2>&1")}; egl vendors: ${sh("ls /usr/share/glvnd/egl_vendor.d 2>&1 | tr '\\n' ' '")}`), { code: "NO_GPU" });
}

/** the CPU fallback: SwiftShader on purpose (a Fly machine has no GPU) */
export function useSoftware() { process.env.CHROME_ARGS = JSON.stringify(FLAG_SETS.software); return "SwiftShader (CPU)"; }
