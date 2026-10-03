// $0: the internal links into the Long Form landing page, and leaving it.
// Needs dist/ served locally.   node scripts/stickmanNavCheck.mjs [origin]
import { chromium } from "playwright";

const [ORIGIN = "http://localhost:4321"] = process.argv.slice(2);
const TARGET = "/ai-stickman-video-generator";
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: ORIGIN }]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
const viewport = () => page.evaluate(() => document.querySelector('meta[name="viewport"]').content);
const out = {};

// Prerendered pages that must link to it (crawlable <a href>).
for (const from of ["/workspace/home", "/workspace/pricing", "/blog/faceless-youtube-channel-ideas", "/blog/how-to-make-money-ai-content", "/kit-swap-ai"]) {
  const html = await (await fetch(`${ORIGIN}${from}`)).text();
  out[`link in prerendered ${from}`] = html.includes(`href="${TARGET}"`);
}

// Client-side navigation in from a blog post, then out to Long Form.
await page.goto(`${ORIGIN}/blog/faceless-youtube-channel-ideas`, { waitUntil: "load" });
await page.locator(`article a[href="${TARGET}"], main a[href="${TARGET}"]`).first().click();
await page.waitForSelector("[data-landing-content] h1");
out.clientNavIn = { url: new URL(page.url()).pathname, title: await page.title(), h1: await page.locator("h1").innerText(), viewport: await viewport(), jsonLd: await page.evaluate(() => (document.querySelector('script[type="application/ld+json"]')?.textContent ?? "").includes("SoftwareApplication")) };
await page.waitForTimeout(1500);
out.clientNavIn.displayFont = await page.evaluate(() => document.fonts.check("800 40px 'Barlow Condensed'"));
await page.getByRole("link", { name: "Make your first video" }).first().click();
await page.waitForTimeout(2500);
out.afterCta = { url: new URL(page.url()).pathname, viewport: await viewport() };

// Direct load (hydrated), then a niche card.
await page.goto(`${ORIGIN}${TARGET}`, { waitUntil: "load" });
await page.waitForTimeout(1500);
out.directViewport = await viewport();
await page.locator('[data-landing-content] a[href^="/long-form/create?niche="]').first().click();
await page.waitForTimeout(2500);
out.afterNiche = { url: page.url().replace(ORIGIN, ""), viewport: await viewport() };
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await browser.close();
