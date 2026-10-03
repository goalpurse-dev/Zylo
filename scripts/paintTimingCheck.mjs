// $0: real paint timings of a page (first paint, first contentful paint,
// largest contentful paint, when the app script was requested), a few runs.
//   node scripts/paintTimingCheck.mjs <url> [runs]
import { chromium } from "playwright";

const [URL_, RUNS = "3"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome" });
for (let i = 0; i < Number(RUNS); i += 1) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 823 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(URL_, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  const t = await page.evaluate(() => new Promise((resolve) => {
    const paints = Object.fromEntries(performance.getEntriesByType("paint").map((e) => [e.name, Math.round(e.startTime)]));
    const nav = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource");
    const pick = (re) => res.filter((r) => re.test(r.name)).map((r) => `${Math.round(r.startTime)}-${Math.round(r.responseEnd)}`)[0] ?? null;
    new PerformanceObserver((list) => {
      const e = list.getEntries().pop();
      resolve({ ...paints, lcp: Math.round(e.startTime), lcpEl: e.element?.tagName, ttfb: Math.round(nav.responseStart), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), css: pick(/assets\/index-.*\.css/), fontsCss: pick(/googleapis.*Inter/), hero: pick(/hero-poster/), appJs: pick(/assets\/index-.*\.js/) });
    }).observe({ type: "largest-contentful-paint", buffered: true });
  }));
  console.log(JSON.stringify(t));
  await ctx.close();
}
await browser.close();
