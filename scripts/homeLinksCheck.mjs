// $0: Home's cards are real links and still behave like the old buttons.
// Built dist/ served with the single-page fallback (vite preview, port 4322).
//   node scripts/homeLinksCheck.mjs <outDir> [origin]
import fs from "node:fs";
import { chromium } from "playwright";

const [OUT, ORIGIN = "http://localhost:4322"] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const out = {};
const open = async (viewport, mobile = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: ORIGIN }]);
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  await page.waitForTimeout(3500);
  return { ctx, page };
};
const path = (page) => page.evaluate(() => location.pathname + location.search);
const back = async (page) => { await page.goto(`${ORIGIN}/`, { waitUntil: "load" }); await page.waitForTimeout(2500); };

{
  const { ctx, page } = await open({ width: 1440, height: 900 });
  await page.screenshot({ path: `${OUT}/home-links-desktop.png` });
  out.tags = await page.evaluate(() => Object.fromEntries(["path-short", "path-long", "wn-long-form", "wn-showcase", "wn-tutorial", "wn-earn"].map((id) => { const el = document.querySelector(`[data-testid="${id}"]`); return [id, el ? `${el.tagName.toLowerCase()} ${el.getAttribute("href") ?? ""}`.trim() : null]; })));
  out.nicheLinks = await page.locator('[data-testid="niche-row"] a[href^="/long-form/create?niche="]').count();
  out.templateLinks = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/workspace/"]')].map((a) => a.getAttribute("href")))].length);

  await page.getByTestId("path-long").click();
  await page.waitForTimeout(1500);
  out.pathLong = await path(page);
  await back(page);

  await page.getByTestId("path-short").click();
  await page.waitForTimeout(800);
  out.pathShortStays = await path(page);
  await page.keyboard.press("Escape");
  await back(page);

  await page.getByTestId("wn-long-form").click();
  await page.waitForTimeout(1500);
  out.whatsNewLongForm = await path(page);
  await back(page);

  const niche = page.locator('[data-testid="niche-row"] a').nth(1);
  await niche.scrollIntoViewIfNeeded();
  await niche.click();
  await page.waitForTimeout(1500);
  out.nicheCard = await path(page);
  await back(page);

  // Carousel: a side card turns the carousel and does NOT navigate; the centred card navigates.
  const cards = page.locator('a[data-suite-card]');
  const centred = async () => page.evaluate(() => {
    const stage = document.querySelector("a[data-suite-card]").parentElement.getBoundingClientRect();
    const mid = stage.x + stage.width / 2; // the carousel's own centre (the sidebar shifts it off the window's)
    const all = [...document.querySelectorAll('a[data-suite-card]')].filter((a) => a.offsetParent !== null && getComputedStyle(a).pointerEvents !== "none");
    all.sort((a, b) => Math.abs(a.getBoundingClientRect().x + a.getBoundingClientRect().width / 2 - mid) - Math.abs(b.getBoundingClientRect().x + b.getBoundingClientRect().width / 2 - mid));
    return all.map((a) => a.getAttribute("href"));
  });
  await cards.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const order = await centred();
  await page.locator(`a[data-suite-card][href="${order[2]}"]`).click({ force: true });
  await page.waitForTimeout(900);
  out.sideCard = { clicked: order[2], path: await path(page), nowCentred: (await centred())[0] };
  await page.locator(`a[data-suite-card][href="${order[2]}"]`).click({ force: true });
  await page.waitForTimeout(1500);
  out.centreCard = await path(page);
  await ctx.close();
}
{
  const { ctx, page } = await open({ width: 390, height: 844 }, true);
  await page.screenshot({ path: `${OUT}/home-links-mobile.png` });
  const card = page.locator('a[href="/workspace/ai-fruit-story"]').first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/home-links-mobile-templates.png` });
  await card.click();
  await page.waitForTimeout(1500);
  out.mobileTemplate = await path(page);
  out.mobileHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
