// $0: the Long Form landing page in a real browser against a built dist/
// served locally. Screenshots at 1920 and 390, and the behaviour checks:
// no horizontal scroll, gallery 24 + "Show more", lite YouTube embed (iframe
// only after the click), hero loop, layout shift, console errors.
//   node scripts/stickmanLandingShots.mjs <outDir> [origin] [path]
import fs from "node:fs";
import { chromium } from "playwright";

const [OUT, ORIGIN = "http://localhost:4321", PATH = "/ai-stickman-video-generator"] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const report = {};
for (const [name, viewport, scale] of [["desktop-1920", { width: 1920, height: 1080 }, 1], ["mobile-390", { width: 390, height: 844 }, 1]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, isMobile: name.startsWith("mobile"), hasTouch: name.startsWith("mobile") });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: ORIGIN }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(`${ORIGIN}${PATH}`, { waitUntil: "load" });
  await page.waitForSelector("[data-landing-content] h1");
  await page.screenshot({ path: `${OUT}/${name}-top.png` });
  const r = { h1: await page.locator("h1").count(), h1Text: await page.locator("h1").innerText() };
  r.iframesBeforeClick = await page.locator("iframe").count();
  r.galleryFirst = await page.locator('[data-landing-content] img[src*="/lp/stickman/"]:not([src*="video-"]):not([src*="hero-"])').count();
  await page.waitForTimeout(4500);
  r.heroVideoPlaying = await page.evaluate(() => { const v = document.querySelector("[data-landing-content] video"); return v ? !v.paused && v.readyState >= 2 : false; });
  r.scrollWidth = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  r.horizontalScroll = r.scrollWidth[0] > r.scrollWidth[1];
  r.brokenImages = await page.evaluate(() => [...document.querySelectorAll("[data-landing-content] img")].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute("src")));
  r.displayFont = await page.evaluate(() => document.fonts.check("800 40px 'Barlow Condensed'"));
  r.cls = Number((await page.evaluate(() => window.__cls)).toFixed(4));
  // The app scrolls inside #root. For the full-page shot let the document
  // scroll instead, and pass every lazy picture once so it has loaded.
  await page.addStyleTag({ content: "html,body,#root{height:auto!important;overflow:visible!important}" });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 500) { await page.evaluate((top) => window.scrollTo(0, top), y); await page.waitForTimeout(110); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
  r.pageHeight = height;
  r.unloadedImages = await page.evaluate(() => [...document.querySelectorAll("[data-landing-content] img")].filter((i) => !i.complete || i.naturalWidth === 0).length);
  await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
  // Interactions.
  const more = page.getByRole("button", { name: /Show \d+ more scenes/ });
  if (await more.count()) await more.click();
  r.galleryAll = await page.locator('[data-landing-content] img[src*="/lp/stickman/"]:not([src*="video-"]):not([src*="hero-"])').count();
  await page.getByRole("link", { name: "Watch the tutorial" }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: /Play the video/ }).click();
  await page.waitForTimeout(600);
  r.iframeAfterClick = await page.locator("iframe").first().getAttribute("src");
  r.cta = await page.getByRole("link", { name: "Make your first video" }).first().getAttribute("href");
  r.nicheLinks = await page.locator('[data-landing-content] a[href^="/long-form/create?niche="]').count();
  r.ideas = await page.locator('[data-testid="ideas"] a').count();
  r.breadcrumb = await page.locator('nav[aria-label="Breadcrumb"] a').first().getAttribute("href").catch(() => null);
  r.subPageLinks = await page.locator('[data-landing-content] a[href^="/ai-stickman-video-generator"]').evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute("href")))]);
  r.firstNiche = await page.locator('[data-landing-content] a[href^="/long-form/create?niche="]').first().getAttribute("href");
  r.pricingLink = await page.locator('[data-landing-content] a[href="/workspace/pricing"]').count();
  r.errors = errors;
  report[name] = r;
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 1));
