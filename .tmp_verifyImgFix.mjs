import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:5174/long-form/create", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByText("Decline").click({ force: true }).catch(() => {});
await page.waitForTimeout(200);
await page.getByText("Choose your niche").click({ force: true });
await page.waitForTimeout(1200);
const data = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  return Array.from(dialog.querySelectorAll("img")).map((img) => ({ complete: img.complete, naturalWidth: img.naturalWidth, decoding: img.decoding }));
});
const broken = data.filter((d) => d.complete && d.naturalWidth === 0);
console.log(`total=${data.length} broken=${broken.length} decoding-async=${data.every(d=>d.decoding==="async")}`);
await page.screenshot({ path: ".tmp_verify_niche_modal.png" });
await browser.close();
