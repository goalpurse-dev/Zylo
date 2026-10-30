// Studio: the REAL way to a template, from the tryzyvo.com home, recorded on the internal account (free: navigation
// only, never a paid button). For each click: a 3x screenshot of the screen before it, the clicked element's box (CSS px,
// for the tap ring), then the screen it leads to. The template config stores the path ("menu").
//   node navCapture.mjs <out dir> "Short Form" "AI Fruit Story"
import fs from "node:fs";
import { openApp, SITE } from "./session.mjs";

const [OUT, ...menu] = process.argv.slice(2);
const PAID = /make scene pictures|animate|make final|regenerate|generate|buy|upgrade|checkout|start a video|make episode/i;
fs.mkdirSync(`${OUT}/shots`, { recursive: true });
const { browser, page } = await openApp();
await page.goto(SITE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.getByText("Decline", { exact: true }).click().catch(() => {});
await page.waitForTimeout(600);
// an announcement modal (e.g. "NEW · LONG FORM") covers the page on a visit: close it like a visitor would
// (WhatsNewModal in src/components/launch/LaunchUI.jsx: its close button is aria-label="Close")
for (let i = 0; i < 2; i++) {
  const close = page.getByRole("button", { name: "Close", exact: true }).locator("visible=true").first();
  if (!(await close.count())) break;
  await close.click().catch(() => {}); await page.waitForTimeout(700);
}
const steps = [];
for (const [i, label] of menu.entries()) {
  if (PAID.test(label)) throw new Error(`refused: "${label}" looks like a paid action`);
  // the clickable element itself: a visible button or link whose own text is exactly the label (the sidebar item);
  // else one whose text starts with it (a template card in the opened panel: "AI Fruit Story  Messy fruit drama…")
  // of everything with that text, only what is ON SCREEN counts (the home page repeats tool names far below); the
  // left-most wins: the sidebar, then the menu panel that opens next to it
  const cands = page.locator("button, a").filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) }).or(page.getByText(label, { exact: true })).locator("visible=true");
  const vp = page.viewportSize();
  let el = null, bx = Infinity;
  for (let k = 0; k < (await cands.count()); k++) { const b = await cands.nth(k).boundingBox(); if (b && b.y >= 0 && b.y + b.height <= vp.height && b.x < bx) { bx = b.x; el = cands.nth(k); } }
  if (!el) throw new Error(`"${label}" is not on screen`);
  await el.waitFor({ timeout: 15000 });
  const box = await el.boundingBox();
  const before = `shots/nav${i + 1}_before.png`;
  await page.screenshot({ path: `${OUT}/${before}` });
  // a real click at the element's centre on screen (a sliding panel can fail Playwright's "stable" check)
  await page.waitForTimeout(700);
  const b2 = await el.boundingBox();
  console.log(`  "${label}": <${await el.evaluate((n) => n.tagName.toLowerCase())}> at ${JSON.stringify(b2 && [Math.round(b2.x), Math.round(b2.y), Math.round(b2.width), Math.round(b2.height)])}`);
  await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.waitForTimeout(2200);
  steps.push({ label, before, tap: box && [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)], url: page.url() });
  console.log(`click "${label}" at ${JSON.stringify(steps.at(-1).tap)} -> ${page.url()}`);
}
await page.screenshot({ path: `${OUT}/shots/nav_end.png` });
fs.writeFileSync(`${OUT}/nav.json`, JSON.stringify({ menu, steps, end: "shots/nav_end.png", url: page.url() }, null, 1));
await browser.close();
