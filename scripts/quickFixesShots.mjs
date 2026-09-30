// Quick-fixes check ($0), internal test account, local dev server: clicks every
// YouTube link (Home What's new, community Long Form tab, mobile Made with
// Zyvo row, lobby rows, the popup) at 1920 and 390 and records the URL that
// opens; checks the calm crossfade card; screenshots the renamed suite, the
// sidebar and the Short Form menu. YouTube is stubbed (no real page loads).
//   node --env-file=.env.local scripts/quickFixesShots.mjs <outDir>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [OUT] = process.argv.slice(2);
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const URL_ = process.env.SUPABASE_URL;
const EXPECT = { "How Did Early Humans Hunt?": "https://www.youtube.com/watch?v=-4oDXegn9vw", "Did Vikings Really Wear Horned Helmets?": "https://www.youtube.com/watch?v=2DFxSoSB5hY" };
const VALID = new Set(Object.values(EXPECT));
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const out = { clicks: [] };

async function open(w, h, mobile, path, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, ...extra });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  await ctx.route(/youtube\.com/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>YouTube (stubbed)</title>" }));
  const page = await ctx.newPage();
  await page.goto(`http://localhost:5173${path}`, { waitUntil: "domcontentloaded" });
  return { ctx, page };
}
// Click every matching link; record where it went and whether it's one of the two real videos.
async function clickAll(ctx, page, where, locator) {
  const n = await locator.count();
  for (let i = 0; i < n; i++) {
    const a = locator.nth(i);
    await a.scrollIntoViewIfNeeded().catch(() => {});
    const href = await a.getAttribute("href");
    const [tab] = await Promise.all([ctx.waitForEvent("page", { timeout: 10000 }).catch(() => null), a.click()]);
    const opened = tab ? tab.url() : null;
    if (tab) await tab.close();
    out.clicks.push({ where, href, opened, newTab: !!tab, ok: !!tab && VALID.has(opened) && opened === href });
  }
  return n;
}

// Popup (reset the seen flag first) at 1920 and 390.
for (const [w, h, mobile] of [[1920, 1080, false], [390, 844, true]]) {
  await admin.from("profiles").update({ seen_announcements: [] }).eq("id", TEST_USER);
  const { ctx, page } = await open(w, h, mobile, "/workspace/home");
  await page.getByTestId("whats-new").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  await clickAll(ctx, page, `popup ${w}`, page.locator("[data-testid=whats-new] a[href*='youtube']"));
  await ctx.close();
}

// Home at 1920 and 390: What's new card, community Long Form tab, mobile row.
for (const [w, h, mobile] of [[1920, 1080, false], [390, 844, true]]) {
  const { ctx, page } = await open(w, h, mobile, "/workspace/home");
  await page.getByTestId("long-form-section").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  await clickAll(ctx, page, `home What's new card ${w}`, page.locator("[data-testid=wn-showcase]"));
  if (mobile) await clickAll(ctx, page, `home Made with Zyvo row ${w}`, page.locator("#made-with-zyvo a"));
  // The community tab sits far down the scroll area: scroll and click it in the page.
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Long Form"); b?.scrollIntoView({ block: "center" }); b?.click(); });
  await page.waitForTimeout(700);
  await clickAll(ctx, page, `home community Long Form ${w}`, page.locator("[data-testid=community-long-form] a"));
  if (!mobile) {
    // Calm card: one image shown, switches after ~7 s, not while hovered.
    const card = page.getByTestId("wn-showcase");
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => { document.getElementById("workspace-scroll").scrollTop = 0; });
    await page.waitForTimeout(500);
    const shown = () => page.evaluate(() => [...document.querySelectorAll("[data-testid=crossfade-stills] img")].findIndex((i) => getComputedStyle(i).opacity === "1"));
    const t0 = await shown(); await page.waitForTimeout(7600); const t1 = await shown();
    await card.hover(); await page.waitForTimeout(8000); const t2 = await shown();
    out.crossfade = { first: t0, after7s: t1, afterHover8s: t2, switches: t0 !== t1, pausedOnHover: t1 === t2,
      transition: await page.evaluate(() => getComputedStyle(document.querySelector("[data-testid=crossfade-stills] img")).transitionDuration) };
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
    await page.getByTestId("whats-new-row").screenshot({ path: `${OUT}/whats-new-row-1920.jpg`, type: "jpeg", quality: 88 });
    // Renamed suite + sidebar + Short Form menu.
    // The suite title exists twice (mobile + desktop); scroll to the visible one.
    out.suiteTitleFound = await page.evaluate(() => { const h = [...document.querySelectorAll("h2")].find((x) => x.textContent.trim() === "short form suite" && x.offsetParent); h?.scrollIntoView({ block: "start" }); return !!h; });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/home-short-form-suite-1920.jpg`, type: "jpeg", quality: 86 });
    out.sidebar = { earn: await page.locator("aside nav").getByText("Earn", { exact: true }).count(), items: await page.locator("aside nav button").allInnerTexts() };
    await page.locator("aside nav").screenshot({ path: `${OUT}/sidebar-1920.jpg`, type: "jpeg", quality: 88 });
    await page.getByRole("button", { name: "Short Form" }).first().click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/short-form-menu-1920.jpg`, type: "jpeg", quality: 86 });
    out.shortFormMenu = { longFormCard: await page.getByTestId("short-form-long-form-card").count(), thirtyDays: await page.locator(".zyvo-popover-panel").getByText("30 Days", { exact: true }).count() };
  } else {
    await page.getByRole("button", { name: "Short Form" }).last().click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/short-form-menu-390.jpg`, type: "jpeg", quality: 86 });
    out.shortFormMenu390 = { longFormCard: await page.getByTestId("short-form-long-form-card").count(), thirtyDays: await page.locator("[aria-label='Short Form menu']").getByText("30 Days", { exact: true }).count() };
  }
  await ctx.close();
}
// Reduced motion: a single still.
{
  const { ctx, page } = await open(1920, 1080, false, "/workspace/home", { reducedMotion: "reduce" });
  await page.getByTestId("wn-showcase").waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  out.reducedMotionStills = await page.locator("[data-testid=crossfade-stills] img").count();
  await ctx.close();
}
// Lobby rows at 1920 and 390.
for (const [w, h, mobile] of [[1920, 1080, false], [390, 844, true]]) {
  const { ctx, page } = await open(w, h, mobile, "/long-form");
  await page.getByTestId("lobby-showcase").first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await clickAll(ctx, page, `lobby Made with Zyvo ${w}`, page.getByTestId("lobby-showcase"));
  await ctx.close();
}
await browser.close();
out.summary = { links: out.clicks.length, ok: out.clicks.filter((c) => c.ok).length, bad: out.clicks.filter((c) => !c.ok) };
console.log(JSON.stringify(out, null, 1));
