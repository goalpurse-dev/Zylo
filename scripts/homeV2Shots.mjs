// Home v2 review screenshots ($0), internal test account, local dev server:
// /home-v2 full page at 1920, 1366 and 390 (100% scale), plus the What's new
// popup at desktop and mobile (after its one-time animation settles).
//   node --env-file=.env.local scripts/homeV2Shots.mjs <outDir>
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
const browser = await chromium.launch({ channel: "chrome", headless: true });
const out = {};

async function open(w, h, mobile, path) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
  await page.goto(`http://localhost:5173${path}`, { waitUntil: "domcontentloaded" });
  return { ctx, page, errors };
}

for (const [w, h, mobile] of [[1920, 1080, false], [1366, 800, false], [390, 844, true]]) {
  const { ctx, page, errors } = await open(w, h, mobile, "/home-v2");
  await page.getByTestId("long-form-section").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  // Grow the viewport to the scroll area's full height so the whole page renders at 100%.
  const full = await page.evaluate(() => { const s = document.getElementById("workspace-scroll"); return Math.ceil(s.scrollHeight + s.getBoundingClientRect().top); });
  await page.setViewportSize({ width: w, height: full });
  await page.waitForTimeout(4000);
  const full2 = await page.evaluate(() => { const s = document.getElementById("workspace-scroll"); return Math.ceil(s.scrollHeight + s.getBoundingClientRect().top); });
  if (full2 !== full) { await page.setViewportSize({ width: w, height: full2 }); await page.waitForTimeout(2000); }
  await page.screenshot({ path: `${OUT}/home-${w}.jpg`, type: "jpeg", quality: 84 });
  out[w] = {
    height: full2,
    bar: await page.getByTestId("launch-bar").count(),
    jumpBackIn: await page.locator("[data-testid=jump-back-in] button").count(),
    niches: await page.locator("[data-testid=niche-row] button").count(),
    whatsNewCards: await page.locator("[data-testid=whats-new-row] a, [data-testid=whats-new-row] button").count(),
    hScroll: await page.evaluate(() => { const s = document.getElementById("workspace-scroll"); return s.scrollWidth > s.clientWidth; }),
    crumb: mobile ? null : await page.evaluate(() => document.body.innerText.includes("Workspace\n") ? "has Workspace" : "ok"),
    errors,
  };
  if (w === 1366) {
    const tab = page.getByRole("button", { name: "Long Form", exact: true });
    if (await tab.count()) { await tab.last().click(); await page.waitForTimeout(800); out.communityLongForm = await page.locator("[data-testid=community-long-form] a").count(); }
  }
  await ctx.close();
}
for (const [w, h, mobile] of [[1920, 1080, false], [390, 844, true]]) {
  const { ctx, page } = await open(w, h, mobile, "/home-v2?whatsnew=1");
  await page.getByTestId("whats-new").waitFor({ timeout: 60000 });
  await page.waitForTimeout(3200);
  await page.screenshot({ path: `${OUT}/popup-${w}.jpg`, type: "jpeg", quality: 88 });
  out[`popup${w}`] = await page.evaluate(() => { const p = document.querySelector("[data-testid=whats-new]").getBoundingClientRect(); return { top: Math.round(p.top), bottom: Math.round(p.bottom), fits: p.top >= 0 && p.bottom <= innerHeight }; });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
