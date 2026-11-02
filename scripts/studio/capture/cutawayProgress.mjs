// The real Cutaway progress screens (Script, Scene, Render) as crops for Studio videos, from the local dev page's sample
// states: no account, nothing submitted, $0. The component is the real one; its percent and timer are sample values.
//   node cutawayProgress.mjs <screens dir>     needs the dev server on localhost:5173
import fs from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire("C:/Users/Public/Zylo/package.json")("playwright");
const [OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 3 });
await ctx.addInitScript(() => { try { localStorage.setItem("zyvo_cookie_consent", "declined"); } catch { /* */ } });
const page = await ctx.newPage();
for (const [state, file] of [["generating-script", "s_gen_script"], ["generating-scene", "s_gen_scene"], ["generating-render", "s_gen_render"]]) {
  await page.goto(`http://localhost:5173/workspace/cutaway-explainer?as=owner&mock=${state}`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(4000);
  // the cookie banner is not part of the screen
  await page.evaluate(() => { for (const e of document.querySelectorAll("div, section, aside")) if (/uses cookies/i.test(e.textContent) && e.textContent.length < 400 && getComputedStyle(e).position === "fixed") e.remove(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${file}.jpg`, type: "jpeg", quality: 94, clip: { x: 790, y: 300, width: 390, height: 390 } });
  console.log(file);
}
await browser.close();
