// Long Form launch email hero ($0): the "What's new" popup's 3 fanned hunting
// thumbnails (same images, poses, borders and shadows as LaunchUI.jsx FAN /
// FAN_POSE), 1120x600 on the email's card colour, palette PNG < 300 KB ->
// public/email/long-form-hero.png (served at tryzyvo.com/email/long-form-hero.png
// once the frontend is deployed).
//   node --env-file=.env.local scripts/buildEmailHero.mjs <ffmpeg>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const STORAGE = `${process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL}/storage/v1/object/public/showcase`;
const FAN = ["spear-or-patience", "how-did-this-kill", "what-does-it-prove"].map((n) => `${STORAGE}/launch/${n}.jpg`);
// The popup's poses, a little tighter so bigger cards fit the 560 px email column.
const FAN_POSE = ["translateX(-60%) translateY(10px) rotate(-8deg)", "scale(1.14)", "translateX(60%) translateY(10px) rotate(8deg)"];
const CARD_BG = "#131518"; // the email's card colour (LongFormLaunchEmail CARD)
const [FF] = process.argv.slice(2);
const OUT = "public/email/long-form-hero.png";
const MAX_BYTES = 300 * 1024;

const html = `<!doctype html><html><body style="margin:0;background:${CARD_BG};">
<div style="position:relative;width:560px;height:300px;overflow:hidden;background:${CARD_BG};">
${FAN.map((src, k) => `<div style="position:absolute;left:50%;top:50%;width:240px;aspect-ratio:16/9;z-index:${k === 1 ? 5 : k + 1};transform:translate(-50%,-50%) ${FAN_POSE[k]};">
  <img src="${src}" style="display:block;width:100%;height:100%;object-fit:cover;border-radius:12px;border:1px solid rgba(255,255,255,.2);box-shadow:0 14px 34px rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.4);box-sizing:border-box;">
</div>`).join("")}
</div></body></html>`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 560, height: 300 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
const raw = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 560, height: 300 } });
await browser.close();

fs.mkdirSync("public/email", { recursive: true });
// Palette PNG (FFmpeg palettegen/paletteuse): fewer colours until it fits the 300 KB budget.
const tmp = path.join(os.tmpdir(), "long-form-hero-raw.png");
fs.writeFileSync(tmp, raw);
let bytes = 0;
for (const colors of [256, 192, 128, 96]) {
  execFileSync(FF, ["-y", "-loglevel", "error", "-i", tmp, "-vf", `split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a`, "-compression_level", "100", OUT]);
  bytes = fs.statSync(OUT).size;
  if (bytes <= MAX_BYTES) break;
}
fs.rmSync(tmp, { force: true });
console.log(JSON.stringify({ out: OUT, kb: Math.round(bytes / 1024), underLimit: bytes <= MAX_BYTES }));
