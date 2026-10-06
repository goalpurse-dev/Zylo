// Browser check for the niche seam, against a running dev server:
//   1. AI Fruit Story (dev preview, mock data) still shows its own name, tagline, hero and example video.
//   2. /workspace/blocky-stories is hidden: without the blocky_v1 flag it lands on Home.
//   node scripts/blocky/qaNicheSeam.mjs [baseUrl] [outDir]
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:5173";
const outDir = process.argv[3] ?? null;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const out = {};
const shot = async (name) => { if (outDir) { fs.mkdirSync(outDir, { recursive: true }); await page.screenshot({ path: path.join(outDir, `${name}.png`) }); } };

await page.goto(`${base}/workspace/ai-fruit-story?fruitV2Preview=1&viewer=noPlan`, { waitUntil: "networkidle" });
await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 20_000 });
out.fruit = {
  title: (await page.locator('section[aria-label="Story builder"] h1').innerText()).trim(),
  tagline: (await page.locator('section[aria-label="Story builder"] h1 + p').innerText()).trim(),
  hero: (await page.locator('section[aria-label="Your video"] h2').first().innerText()).replace(/\s+/g, " ").trim(),
  exampleVideo: await page.locator('section[aria-label="Your video"] video').count(),
  madeWith: await page.getByText("Made with AI Fruit Story").count(),
  builderLeftOfResult: await page.evaluate(() => document.querySelector('section[aria-label="Story builder"]').getBoundingClientRect().left < document.querySelector('section[aria-label="Your video"]').getBoundingClientRect().left),
};
await shot("fruit-1440");

await page.goto(`${base}/workspace/blocky-stories`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
out.blocky = { landedOn: new URL(page.url()).pathname, builderShown: await page.locator('section[aria-label="Story builder"]').count() };
await shot("blocky-hidden-1440");

await browser.close();
console.log(JSON.stringify(out, null, 1));
const ok = out.fruit.title === "AI Fruit Story" && out.fruit.tagline.toLowerCase() === "messy fruit drama, made in minutes" && /Messy fruit drama\. Made in minutes\./.test(out.fruit.hero)
  && out.fruit.exampleVideo === 1 && out.fruit.madeWith === 1 && out.fruit.builderLeftOfResult && out.blocky.landedOn !== "/workspace/blocky-stories" && out.blocky.builderShown === 0;
console.log(ok ? "PASS" : "FAIL");
process.exitCode = ok ? 0 : 1;
