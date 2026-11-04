// The kit check, free and local: every object / hand prop / monster look the planner can emit builds in headless Chrome.
//   node dev/coverageKit.mjs        -> prints counts + errors (exit 1 on errors)
//   import { checkKit } ...         -> { objects, held, monsters, errors, fallbackHeld }
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { startServer } from "../render.mjs";

const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
export async function checkKit() {
  const srv = await startServer(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "out"));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--use-angle=default", "--enable-webgl", "--ignore-gpu-blocklist"] });
  try {
    const page = await browser.newPage();
    const logs = [];
    page.on("pageerror", (e) => logs.push(e.message));
    await page.goto(`http://127.0.0.1:${srv.port}/dev/coverageKit.html`);
    await page.waitForFunction("window.kitCheck", { timeout: 120000 });
    const r = await page.evaluate(() => window.kitCheck);
    r.errors.push(...logs);
    return r;
  } finally { await browser.close(); srv.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await checkKit();
  console.log(`objects ${r.objects}, held ${r.held}, monsters ${r.monsters}; held drawn as the plain box: ${r.fallbackHeld.join(", ") || "none"}`);
  for (const e of r.errors) console.log("ERROR", e);
  process.exit(r.errors.length ? 1 : 0);
}
