// Phase 6f: the Publish page of the Myth vs Reality TEST project (the
// internal test account's own project) at 1920x1080 and 390x844. Opening it
// makes the included first 3 thumbnails and the YouTube text (paid, ~$0.01 on
// the V2 tier — stated before running). Waits for them, then screenshots.
//   node --env-file=.env.local scripts/publishShots.mjs <outDir>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const [OUT] = process.argv.slice(2);
const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const out = {};
for (const [w, h, mobile] of [[1920, 1080, false], [390, 844, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/publish`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("render-card").waitFor({ timeout: 60000 });
  // The included thumbnails + the text (first open only), then images loaded.
  await page.waitForFunction(() => document.querySelectorAll("[data-testid=thumb] img").length === 3 && document.querySelector("[data-testid=yt-title]"), null, { timeout: 240000 }).catch(() => {});
  if (!mobile && await page.locator("[data-testid=thumb] button").first().isVisible()) { await page.locator("[data-testid=thumb] button").first().click(); await page.waitForTimeout(1500); }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/publish-${w}.png`, fullPage: mobile });
  out[`${w}`] = { thumbs: await page.locator("[data-testid=thumb] img").count(), title: await page.getByTestId("yt-title").inputValue().catch(() => null), player: await page.getByTestId("publish-player").count(), download: await page.getByTestId("download-full").count(),
    hScroll: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), errors };
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
