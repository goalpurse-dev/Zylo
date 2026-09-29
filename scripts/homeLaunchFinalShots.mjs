// Home + Long Form lobby, production build checks ($0), internal test account,
// local dev server. Screenshots + checks: Home 1920/390 (1366 layout checks),
// lobby with projects (1920x1080, 1366x768, 390) and as a new user (project
// queries stubbed empty), all 25 niche links + an invalid id, a niche click
// from Home landing on Idea, every YouTube link incl. the popup's, reduced
// motion. YouTube is stubbed (no real page loads).
//   node --env-file=.env.local scripts/homeLaunchFinalShots.mjs <outDir>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [OUT] = process.argv.slice(2);
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const URL_ = process.env.SUPABASE_URL;
const HUNT = "https://www.youtube.com/watch?v=-4oDXegn9vw", VIKINGS = "https://www.youtube.com/watch?v=2DFxSoSB5hY";
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const out = {};
// Reuse the test account's newest discovery session (creating one per fresh
// browser would hit the 8-new-sessions-per-hour limit).
const { data: lastSession } = await admin.from("long_form_discovery_sessions").select("id").eq("user_id", TEST_USER).order("created_at", { ascending: false }).limit(1).single();
const DRAFT_KEY = "zyvo:long-form:production-setup-draft:v1";
const NICHES = JSON.parse(fs.readFileSync(new URL("../scripts/.niches.json", import.meta.url), "utf8"));

async function open(w, h, mobile, path, { newUser = false, reducedMotion = "no-preference" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b, dk, dv]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); if (!localStorage.getItem(dk)) localStorage.setItem(dk, dv); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`, DRAFT_KEY, JSON.stringify({ discoverySessionId: lastSession.id })]);
  await ctx.route(/youtube\.com/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>YouTube (stubbed)</title>" }));
  if (newUser) {
    await ctx.route("**/rest/v1/long_form_projects*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await ctx.route("**/rest/v1/rpc/long_form_project_covers*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:5173${path}`, { waitUntil: "domcontentloaded" });
  return { ctx, page, errors };
}
const scrollH = (page) => page.evaluate(() => { const s = document.getElementById("workspace-scroll"); return Math.ceil(s.scrollHeight + s.getBoundingClientRect().top); });
const hScroll = (page) => page.evaluate(() => { const s = document.getElementById("workspace-scroll"); return s.scrollWidth > s.clientWidth || document.documentElement.scrollWidth > document.documentElement.clientWidth; });
async function fullPage(page, w, file) {
  await page.setViewportSize({ width: w, height: await scrollH(page) });
  await page.waitForTimeout(3500);
  await page.setViewportSize({ width: w, height: await scrollH(page) });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: file, type: "jpeg", quality: 84 });
}

// 1. Popup (first visit after resetting the test account's seen flag): YouTube button.
await admin.from("profiles").update({ seen_announcements: [] }).eq("id", TEST_USER);
{
  const { ctx, page } = await open(1920, 1080, false, "/workspace/home");
  await page.getByTestId("whats-new").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  const btn = page.locator("[data-testid=whats-new] a", { hasText: "Watch one on YouTube" });
  out.popup = { href: await btn.getAttribute("href"), target: await btn.getAttribute("target"), rel: await btn.getAttribute("rel") };
  const [tab] = await Promise.all([ctx.waitForEvent("page", { timeout: 10000 }).catch(() => null), btn.click()]);
  out.popup.openedNewTab = tab ? tab.url() : null;
  await ctx.close();
}

// 2. Home 1920 / 1366 / 390.
for (const [w, h, mobile] of [[1920, 1080, false], [1366, 768, false], [390, 844, true]]) {
  const { ctx, page, errors } = await open(w, h, mobile, "/workspace/home");
  await page.getByTestId("long-form-section").waitFor({ timeout: 60000 });
  await page.waitForTimeout(3000);
  const videosAtLoad = await page.evaluate(() => [...document.querySelectorAll("video")].map((v) => (v.currentSrc || v.src || "").split("/").pop()).filter(Boolean));
  const side = async () => page.evaluate(() => [document.querySelector("aside")?.getBoundingClientRect().top ?? null, Math.round(document.getElementById("workspace-scroll").getBoundingClientRect().top)]);
  const before = await side();
  await page.evaluate(() => { document.getElementById("workspace-scroll").scrollTop = 1400; });
  await page.waitForTimeout(800);
  const after = await side();
  await page.evaluate(() => { document.getElementById("workspace-scroll").scrollTop = 0; });
  const r = {
    bar: await page.getByTestId("launch-bar").count(), hScroll: await hScroll(page), stickyBarsFixed: JSON.stringify(before) === JSON.stringify(after),
    madeWithZyvoRowVisible: await page.locator("#made-with-zyvo").isVisible().catch(() => false), videosAtLoad, errors,
  };
  if (w === 1920) {
    r.whatsNewShowcaseHref = await page.getByTestId("wn-showcase").getAttribute("href");
    const [tab] = await Promise.all([ctx.waitForEvent("page", { timeout: 10000 }).catch(() => null), page.getByTestId("wn-showcase").click()]);
    r.whatsNewOpened = tab ? tab.url() : null; if (tab) await tab.close();
    await page.getByRole("button", { name: "Long Form", exact: true }).last().click();
    await page.waitForTimeout(600);
    r.communityLongFormHrefs = await page.locator("[data-testid=community-long-form] a").evaluateAll((as) => as.map((a) => `${a.getAttribute("href")} ${a.target}`));
    await page.getByRole("button", { name: "All", exact: true }).first().click();
  }
  if (w !== 1366) await fullPage(page, w, `${OUT}/home-${w}.jpg`);
  if (mobile) r.mobileRowHrefs = await page.locator("#made-with-zyvo a").evaluateAll((as) => as.map((a) => `${a.getAttribute("href")} ${a.target}`));
  out[`home${w}`] = r;
  await ctx.close();
}

// 3. Reduced motion: posters only, no videos.
{
  const { ctx, page } = await open(1920, 1080, false, "/workspace/home", { reducedMotion: "reduce" });
  await page.getByTestId("long-form-section").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  out.reducedMotionVideos = await page.locator("video").count();
  await ctx.close();
}

// 4. Lobby with projects: 1920x1080, 1366x768 (first screen), 390 full page.
for (const [w, h, mobile] of [[1920, 1080, false], [1366, 768, false], [390, 844, true]]) {
  const { ctx, page, errors } = await open(w, h, mobile, "/long-form");
  await page.locator("[data-testid=recent-card]").first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(3000);
  const box = await page.evaluate(() => ({ yourVideosTop: Math.round(document.querySelector("[data-testid=your-videos]").getBoundingClientRect().top), madeWithTop: Math.round(document.querySelector("[data-testid=made-with-zyvo]").getBoundingClientRect().top), createTop: Math.round(document.querySelector("[data-testid=create-card]").getBoundingClientRect().top) }));
  const hrefs = await page.locator("[data-testid=lobby-showcase]").evaluateAll((as) => as.map((a) => `${a.getAttribute("href")} ${a.target}`));
  const covers = await page.locator("[data-testid=recent-card] img").evaluateAll((im) => im.map((i) => i.src.split("/").slice(-2).join("/")));
  if (w !== 1366) await page.screenshot({ path: `${OUT}/lobby-${w}-first.jpg`, type: "jpeg", quality: 86 });
  if (mobile) await fullPage(page, w, `${OUT}/lobby-390.jpg`);
  out[`lobby${w}x${h}`] = { ...box, yourVideosInFirstScreen: box.yourVideosTop < h, cards: await page.locator("[data-testid=recent-card]").count(), covers, hrefs, hScroll: await hScroll(page), errors };
  await ctx.close();
}

// 5. Lobby as a new user (project queries answered with []).
for (const [w, h, mobile] of [[1920, 1080, false], [390, 844, true]]) {
  const { ctx, page } = await open(w, h, mobile, "/long-form", { newUser: true });
  await page.getByTestId("how-it-works").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  out[`newUser${w}`] = { howItWorks: await page.getByTestId("how-it-works").count(), recentCards: await page.locator("[data-testid=recent-card]").count(), allGrid: await page.locator("#all-videos").count() };
  await page.screenshot({ path: `${OUT}/lobby-newuser-${w}.jpg`, type: "jpeg", quality: 86 });
  await ctx.close();
}

// 6. Niche links: all 25 land on Idea with that niche selected and the page at step 3.
{
  const { ctx, page } = await open(1920, 1080, false, "/workspace/home");
  const bad = [];
  for (const n of NICHES) {
    await page.goto(`http://localhost:5173/long-form/create?niche=${n.id}`, { waitUntil: "domcontentloaded" });
    await page.locator("#setup-step-3").waitFor({ timeout: 60000 });
    await page.waitForFunction((label) => [...document.querySelectorAll("dd")].some((d) => d.textContent.trim() === label), n.label, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(900);
    const r = await page.evaluate((label) => ({ selected: [...document.querySelectorAll("dd")].some((d) => d.textContent.trim() === label), step3Top: Math.round(document.getElementById("setup-step-3").getBoundingClientRect().top) }), n.label);
    if (!r.selected || r.step3Top > 400) bad.push({ id: n.id, ...r });
  }
  out.nicheLinks = { tested: NICHES.length, failing: bad };
  await ctx.close();
}
{
  // Invalid id, a draft with no niche yet: Idea opens with no niche.
  const { ctx, page } = await open(1920, 1080, false, "/long-form/create?niche=not_a_niche");
  await page.locator("#setup-step-1").waitFor({ timeout: 60000 });
  await page.waitForTimeout(3000);
  out.invalidNiche = { chooseNicheShown: await page.getByText("Choose your niche").count() > 0 };
  await ctx.close();
}
{
  // A real click on Home's niche row -> Idea, niche preselected, at the Topic step.
  const { ctx, page } = await open(1920, 1080, false, "/workspace/home");
  await page.getByTestId("niche-row").waitFor({ timeout: 60000 });
  await page.getByTestId("niche-row").locator("button").nth(6).click();
  await page.waitForURL(/\/long-form\/create\?niche=/, { timeout: 20000 });
  await page.locator("#setup-step-3").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  out.nicheClick = { url: page.url().replace("http://localhost:5173", "") };
  await page.screenshot({ path: `${OUT}/niche-click-idea.jpg`, type: "jpeg", quality: 86 });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
