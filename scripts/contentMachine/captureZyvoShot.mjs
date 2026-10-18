// Captures the public tryzyvo.com home page as the Zyvo screenshot used on Zyvo's slides ($0, read-only).
//   node scripts/contentMachine/captureZyvoShot.mjs <out.png> [url]
// Upload it to the private bucket with uploadZyvoShot.mjs (content-machine/assets/zyvo-home.png).
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const { chromium } = createRequire(path.join(ROOT, "package.json"))("playwright");
const [out, url = "https://www.tryzyvo.com/"] = process.argv.slice(2);
if (!out) { console.error("usage: captureZyvoShot.mjs <out.png> [url]"); process.exit(2); }
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1180 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => localStorage.setItem("zyvo_cookie_consent", "declined"));
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
await page.getByRole("button", { name: "Decline" }).click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(1200);
// Close any announcement pop-up so the real page shows.
await page.getByRole("button", { name: /close/i }).first().click({ timeout: 3000 }).catch(() => {});
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: out });
await browser.close();
console.log(`saved ${out}`);
