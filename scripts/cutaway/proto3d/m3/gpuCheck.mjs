// M3, on the GPU machine: which Chrome flags give WebGL on the real GPU. For each flag set it opens a WebGL2 page and
// reads the renderer string (WEBGL_debug_renderer_info). A set passes only when the renderer names the GPU (NVIDIA),
// never SwiftShader or llvmpipe (software). Writes gpucheck.json; the first passing set is the one to render with.
//   CHROME_PATH=/usr/bin/google-chrome node m3/gpuCheck.mjs <out.json>
import fs from "node:fs";
import http from "node:http";
import puppeteer from "puppeteer-core";
import { FLAG_SETS } from "./flags.mjs";

const out = process.argv[2] ?? "gpucheck.json";
const page0 = `<!doctype html><canvas id=c width=64 height=64></canvas><script>
const gl = document.getElementById("c").getContext("webgl2"); const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
window.result = gl ? { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), version: gl.getParameter(gl.VERSION) } : { renderer: "no webgl2" };
</script>`;
const server = http.createServer((q, r) => { r.writeHead(200, { "Content-Type": "text/html" }); r.end(page0); }).listen(0);
const port = server.address().port;
const rows = [];
for (const [name, args] of Object.entries(FLAG_SETS)) {
  let row = { name, args };
  try {
    const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH, headless: true, ignoreDefaultArgs: ["--use-angle=swiftshader-webgl", "--disable-gpu"], args });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction("window.result", { timeout: 15000 });
    row = { ...row, ...(await page.evaluate(() => window.result)) };
    await browser.close();
  } catch (e) { row.error = String(e.message).slice(0, 300); }
  row.gpu = /nvidia/i.test(row.renderer ?? "") && !/swiftshader|llvmpipe|software/i.test(row.renderer ?? "");
  rows.push(row); console.log(JSON.stringify(row));
}
server.close();
fs.writeFileSync(out, JSON.stringify({ rows, pick: rows.find((r) => r.gpu)?.name ?? null }, null, 1));
