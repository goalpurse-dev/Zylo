// Home + Long Form lobby first-screen screenshots ($0, internal test account)
// at 1920 / 1366 / 390, after the background clean-up. The account has Long
// Form projects, so the "What's new" popup stays away on its own.
//   node --env-file=.env.local scripts/homeBackgroundShots.mjs <outDir>
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
for (const [w, h, mobile] of [[1920, 1080, false], [1366, 768, false], [390, 844, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173/workspace/home");
  await page.getByTestId("path-long").waitFor({ timeout: 30000 });
  await page.mouse.move(1, h - 1);
  await page.waitForTimeout(3500);
  out[`home${w}`] = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="hero-spotlight"]').getBoundingClientRect();
    const cards = document.querySelector('[data-testid="path-short"]').getBoundingClientRect();
    return { spotlightTop: Math.round(s.top), spotlightBottom: Math.round(s.bottom), cardsTop: Math.round(cards.top),
      popup: !!document.querySelector('[data-testid="whats-new"]') };
  });
  await page.screenshot({ path: `${OUT}/home-${w}.jpg`, type: "jpeg", quality: 86 });
  await page.goto("http://localhost:5173/long-form");
  await page.getByTestId("create-card").waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/lobby-${w}.jpg`, type: "jpeg", quality: 86 });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
