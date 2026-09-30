// Home scene-loop check ($0, internal test account) at 1920 / 1366 / 390:
// both cards play their baked loop (which source the browser picked, that it
// advances), the What's new section with its title, the loop pausing when
// scrolled away, and reduced motion showing the poster only.
//   node --env-file=.env.local scripts/homeLoopShots.mjs <outDir>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [OUT] = process.argv.slice(2);
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const c = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await c.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const out = {};
const video = (page, id) => page.evaluate((id) => {
  const v = document.querySelector(`[data-testid="${id}"] video`);
  return v ? { src: v.currentSrc.split("/").pop(), t: +v.currentTime.toFixed(2), paused: v.paused, ready: v.readyState } : null;
}, id);
async function session(w, h, mobile, reducedMotion = "no-preference") {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, reducedMotion });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173/workspace/home");
  await page.getByTestId("path-long").waitFor({ timeout: 30000 });
  await page.mouse.move(1, h - 1);
  return { ctx, page };
}
for (const [w, h, mobile] of [[1920, 1080, false], [1366, 768, false], [390, 844, true]]) {
  const { ctx, page } = await session(w, h, mobile);
  const r = (out[w] = {});
  await page.getByTestId("path-long").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[data-testid="path-long"] video')?.currentTime > 4.6, null, { timeout: 30000 }).catch(() => {});
  r.card = await video(page, "path-long");
  await page.getByTestId("path-long").screenshot({ path: `${OUT}/card-${w}.jpg`, type: "jpeg", quality: 86 });
  await page.getByTestId("whats-new-row").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.evaluate(() => window.scrollBy(0, -12));
  await page.getByTestId("wn-showcase").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('[data-testid="wn-showcase"] video')?.currentTime > 5.5, null, { timeout: 30000 }).catch(() => {});
  r.madeWithZyvo = await video(page, "wn-showcase");
  r.whatsNewTitle = await page.getByTestId("whats-new-row").locator("h2").isVisible();
  await page.getByTestId("whats-new-row").screenshot({ path: `${OUT}/whats-new-${w}.jpg`, type: "jpeg", quality: 86 });
  if (w === 1920) {
    // Scrolled away: the path card's loop pauses.
    const t0 = (await video(page, "path-long"))?.t;
    await page.waitForTimeout(1500);
    r.pathCardOffscreen = { ...(await video(page, "path-long")), advancedWhileOffscreen: (await video(page, "path-long"))?.t !== t0 };
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/first-screen-${w}.jpg`, type: "jpeg", quality: 84 });
  }
  await ctx.close();
}
// Reduced motion: posters only, no <video> elements.
{
  const { ctx, page } = await session(1366, 768, false, "reduce");
  await page.waitForTimeout(3000);
  out.reducedMotion = await page.evaluate(() => ({
    videos: document.querySelectorAll('[data-testid="path-long"] video, [data-testid="wn-showcase"] video').length,
    posters: [...document.querySelectorAll('[data-testid="path-long"] img, [data-testid="wn-showcase"] img')].map((i) => i.src.split("/").pop()),
  }));
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
