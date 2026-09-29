// Long Form launch screenshots ($0), internal test account, local dev server:
// the What's new popup (first visit), Home (banner + showcase) at 1366 and
// 390, the sidebar NEW badge, the Long Form lobby, the Short Form menu card;
// plus click tracking rows and the reduced-motion still. YouTube is stubbed.
//   node --env-file=.env.local scripts/launchShots.mjs <outDir>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [OUT] = process.argv.slice(2);
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
fs.mkdirSync(OUT, { recursive: true });
const since = new Date().toISOString();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const out = { errors: [] };

async function context(w, h, mobile, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, ...extra });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  await ctx.route(/youtube\.com/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>YouTube (stubbed)</title>" }));
  return ctx;
}
const scrollTo = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); const sc = document.getElementById("workspace-scroll"); if (el && sc) sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 16; }, sel);

// Desktop: popup on first visit, then Home, sidebar badge, lobby, Short Form card.
{
  const ctx = await context(1366, 800, false);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => out.errors.push(String(e).slice(0, 200)));
  await page.goto("http://localhost:5173/workspace/home", { waitUntil: "domcontentloaded" });
  out.popupShown = await page.getByTestId("whats-new").waitFor({ timeout: 30000 }).then(() => true, () => false);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/popup-1366.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  await page.getByTestId("showcase-home").waitFor({ timeout: 30000 });
  await page.getByTestId("new-badge").first().screenshot({ path: `${OUT}/_badge.png` }).catch(() => {});
  await page.locator("aside nav").first().screenshot({ path: `${OUT}/sidebar-badge.png` });
  await scrollTo(page, "[data-testid=lf-launch-banner]");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/home-1366.png` });
  out.homeCards = await page.locator("[data-testid=showcase-home] [data-testid=showcase-card]").count();
  const card = page.locator("[data-testid=showcase-home] [data-testid=showcase-card]").first();
  out.cardLink = { href: await card.getAttribute("href"), target: await card.getAttribute("target"), rel: await card.getAttribute("rel") };
  const [tab] = await Promise.all([ctx.waitForEvent("page", { timeout: 10000 }).catch(() => null), card.click()]);
  out.cardOpenedNewTab = !!tab; if (tab) await tab.close();
  await page.getByTestId("try-long-form").click();
  await page.waitForURL(/\/long-form$/, { timeout: 15000 });
  await page.getByTestId("showcase-long_form").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/lobby-1366.png` });
  out.tutorialCard = await page.getByTestId("tutorial-card").count();
  await page.getByRole("button", { name: "Short Form" }).first().click();
  await page.getByTestId("short-form-long-form-card").first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/short-form-card-1366.png` });
  await ctx.close();
}
// 390: Home (popup already seen -> must NOT show again), mobile nav badge.
{
  const ctx = await context(390, 844, true);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => out.errors.push(String(e).slice(0, 200)));
  await page.goto("http://localhost:5173/workspace/home", { waitUntil: "domcontentloaded" });
  await page.getByTestId("showcase-home").waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  out.popupShownAgain = await page.getByTestId("whats-new").count();
  await scrollTo(page, "[data-testid=lf-launch-banner]");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/home-390.png` });
  await scrollTo(page, "[data-testid=showcase-home]");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/home-390-showcase.png` });
  out.hScroll390 = await page.evaluate(() => { const s = document.getElementById("workspace-scroll"); return s.scrollWidth > s.clientWidth || document.documentElement.scrollWidth > document.documentElement.clientWidth; });
  out.swipeRow = await page.evaluate(() => { const r = document.querySelector("[data-testid=showcase-home] .snap-x"); return r ? { scrollable: r.scrollWidth > r.clientWidth, overflowX: getComputedStyle(r).overflowX } : null; });
  await ctx.close();
}
// Reduced motion -> a still image, never a video.
{
  const ctx = await context(1366, 800, false, { reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173/workspace/home", { waitUntil: "domcontentloaded" });
  await page.getByTestId("lf-launch-banner").waitFor({ timeout: 30000 });
  out.reducedMotion = { still: await page.getByTestId("lf-preview-still").count(), video: await page.getByTestId("lf-preview-video").count() };
  await ctx.close();
}
await browser.close();
const { data: ev } = await admin.from("marketing_events").select("event, placement, target").eq("user_id", TEST_USER).gte("created_at", since).order("created_at");
out.events = ev?.map((e) => `${e.event}/${e.placement}${e.target ? " " + e.target.slice(-22) : ""}`);
const { data: prof } = await admin.from("profiles").select("seen_announcements").eq("id", TEST_USER).single();
out.seenAnnouncements = prof.seen_announcements;
console.log(JSON.stringify(out, null, 1));
