// $0: Home at several viewport widths (dev server): What's new card count and
// widths, the content column's width, the path cards' size, and whether the
// "New here?" row is gone. Screenshots of the top and of the Long Form section.
//   node scripts/homeWidthShots.mjs <outDir> [origin]
import fs from "node:fs";
import { chromium } from "playwright";

const [OUT, ORIGIN = "http://localhost:5173"] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const rows = [];
for (const [w, h, mobile] of [[390, 844, true], [820, 1180, true], [1366, 768, false], [1536, 864, false], [1920, 1080, false], [2560, 1440, false]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: ORIGIN }]);
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  await page.waitForSelector('[data-testid="wn-tutorial"]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) }; };
    const row = document.querySelector('[data-testid="whats-new-row"]');
    const cards = [...row.querySelectorAll('[data-testid^="wn-"]')];
    const shown = cards.filter((c) => getComputedStyle(c).display !== "none");
    const grid = cards[0].parentElement;
    const pathLong = document.querySelector('[data-testid="path-long"]');
    const lf = document.querySelector('[data-testid="long-form-section"]');
    return {
      viewport: window.innerWidth,
      cardsShown: shown.map((c) => c.dataset.testid.replace("wn-", "")),
      cardWidths: shown.map((c) => box(c).w),
      rowInner: box(grid).w, rowRight: Math.round(grid.getBoundingClientRect().right), lastCardRight: Math.round(shown[shown.length - 1].getBoundingClientRect().right),
      gridDisplay: getComputedStyle(grid).display,
      pathCard: box(pathLong), pathRow: box(pathLong.parentElement),
      section: box(row), longForm: box(lf),
      newHereRow: !!document.querySelector('[data-testid="tutorial-row"]'),
      hScroll: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  rows.push(m);
  await page.screenshot({ path: `${OUT}/home-${w}-top.png` });
  await page.locator('[data-testid="long-form-section"]').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('[data-testid="niche-row"]').scrollIntoView({ block: "center" }));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/home-${w}-longform.png` });
  await ctx.close();
}
await browser.close();
for (const r of rows) console.log(JSON.stringify(r));
