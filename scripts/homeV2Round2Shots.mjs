// Home v2 round 2 + Long Form lobby screenshots ($0), internal test account:
// /home-v2 full page (1920, 390), a mid-scroll 1920x1080 frame proving the
// sidebar and top bar stay put, and /long-form first screen + full page
// (1920x1080, 390x844).
//   node --env-file=.env.local scripts/homeV2Round2Shots.mjs <outDir>
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
const scrollH = (page) => page.evaluate(() => { const s = document.getElementById("workspace-scroll"); return Math.ceil(s.scrollHeight + s.getBoundingClientRect().top); });
async function fullPage(page, w, file) {
  await page.setViewportSize({ width: w, height: await scrollH(page) });
  await page.waitForTimeout(3500);
  const h = await scrollH(page);
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: file, type: "jpeg", quality: 84 });
  return h;
}

// Home v2, full page.
for (const [w, h, mobile] of [[1920, 1080, false], [390, 844, true]]) {
  const { ctx, page, errors } = await open(w, h, mobile, "/home-v2");
  await page.getByTestId("long-form-section").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  const order = await page.evaluate(() => ["whats-new-row", "long-form-section", "jump-back-in"].map((id) => { const el = document.querySelector(`[data-testid=${id}]`); return el ? Math.round(el.getBoundingClientRect().top) : null; }));
  const height = await fullPage(page, w, `${OUT}/home-${w}.jpg`);
  out[`home${w}`] = { height, order, tools: await page.getByTestId("tools").count(), madeWithZyvo: await page.locator("#made-with-zyvo [data-testid=showcase-card]").count(), errors };
  await ctx.close();
}
// Mid-scroll: the sidebar and top bar must not move.
{
  const { ctx, page } = await open(1920, 1080, false, "/home-v2");
  await page.getByTestId("long-form-section").waitFor({ timeout: 60000 });
  await page.waitForTimeout(2500);
  const pos = () => page.evaluate(() => ({ side: Math.round(document.querySelector("aside").getBoundingClientRect().top), top: Math.round(document.getElementById("workspace-scroll").getBoundingClientRect().top), winScroll: window.scrollY }));
  const before = await pos();
  await page.evaluate(() => { document.getElementById("workspace-scroll").scrollTop = 1500; });
  await page.waitForTimeout(2500);
  const after = await pos();
  await page.screenshot({ path: `${OUT}/home-midscroll-1920.jpg`, type: "jpeg", quality: 86 });
  out.sticky = { before, after, scrolled: await page.evaluate(() => document.getElementById("workspace-scroll").scrollTop), fixed: before.side === after.side && before.top === after.top };
  await ctx.close();
}
// Long Form lobby: first screen + full page.
for (const [w, h, mobile] of [[1920, 1080, false], [390, 844, true]]) {
  const { ctx, page, errors } = await open(w, h, mobile, "/long-form");
  await page.getByTestId("create-card").waitFor({ timeout: 60000 });
  await page.locator("[data-testid=recent-row]").first().waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/lobby-${w}-first.jpg`, type: "jpeg", quality: 86 });
  const inFirst = await page.evaluate((vh) => { const r = document.querySelector("[data-testid=your-videos]").getBoundingClientRect(); const c = document.querySelector("[data-testid=create-new-video]").getBoundingClientRect(); return { createButtonVisible: c.bottom <= vh, yourVideosTop: Math.round(r.top), yourVideosBottom: Math.round(r.bottom) }; }, h);
  const height = await fullPage(page, w, `${OUT}/lobby-${w}.jpg`);
  out[`lobby${w}`] = { height, rows: await page.locator("[data-testid=recent-row]").count(), ...inFirst, errors };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
