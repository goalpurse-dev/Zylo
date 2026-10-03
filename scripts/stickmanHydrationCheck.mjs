// $0: does the built landing page HYDRATE (server HTML kept) rather than get
// re-rendered? Checked as a first-time visitor (cookie banner showing) and as
// a returning one, desktop and mobile. Needs dist/ served locally.
//   node scripts/stickmanHydrationCheck.mjs [origin] [path]
import { chromium } from "playwright";

const [ORIGIN = "http://localhost:4321", PATH = "/ai-stickman-video-generator"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome" });
for (const [label, viewport, cookie] of [["desktop, first visit", { width: 1920, height: 1080 }, false], ["mobile, first visit", { width: 390, height: 844 }, false], ["mobile, returning", { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport });
  if (cookie) await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: ORIGIN }]);
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) logs.push(`${m.type()}: ${m.text().slice(0, 600)}`); });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message.slice(0, 600)}`));
  // Remember the server-rendered nodes the moment the parser creates them.
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const h1 = document.querySelector("h1");
      if (h1 && !window.__h1) { window.__h1 = h1; window.__header = document.querySelector("header"); }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto(`${ORIGIN}${PATH}`, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  const result = await page.evaluate(() => ({
    sameH1: document.querySelector("h1") === window.__h1,
    sameHeader: document.querySelector("header") === window.__header,
    reactAttached: Object.keys(document.querySelector("h1")).some((k) => k.startsWith("__react")),
    cookieBanner: [...document.querySelectorAll("button")].some((b) => /accept|decline/i.test(b.textContent)),
  }));
  console.log(label, JSON.stringify(result), logs.filter((l) => !l.includes("404")).join(" | ").slice(0, 900) || "no console errors");
  await ctx.close();
}
await browser.close();
