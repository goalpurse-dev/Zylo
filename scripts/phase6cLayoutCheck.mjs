// Phase 6c-polish 2 ($0): measure how scene pictures are fitted (box vs the
// image's own aspect), the player's size vs the visible area, on the Myth vs
// Reality test project. Optional screenshots.
//   node --env-file=.env.local scripts/phase6cLayoutCheck.mjs [--shots]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const SHOTS = process.argv.includes("--shots");
const URL_ = process.env.SUPABASE_URL, TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u.user.email.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
const OUT = "docs/phase6c/polish2";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
for (const [w, h] of [[1440, 900], [1920, 1080]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); }, [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:5173/long-form/project/${PROJECT}/scenes`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("stickman-player").waitFor({ timeout: 30000 });
  await page.waitForTimeout(4000);
  const m = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-testid=scene-card] img:not([aria-hidden])")].filter((i) => i.naturalWidth).slice(0, 6);
    const fit = cards.map((i) => { const box = i.parentElement.getBoundingClientRect(); return { box: +(box.width / box.height).toFixed(3), natural: +(i.naturalWidth / i.naturalHeight).toFixed(3), fit: getComputedStyle(i).objectFit }; });
    const player = document.querySelector("[data-testid=stickman-player]").getBoundingClientRect();
    const footer = [...document.querySelectorAll("div")].find((d) => d.textContent?.trim().startsWith("Continue to Edit") && getComputedStyle(d).position === "fixed");
    const footerTop = footer ? footer.getBoundingClientRect().top : innerHeight;
    return { fit, player: { top: Math.round(player.top), bottom: Math.round(player.bottom), height: Math.round(player.height), width: Math.round(player.width) }, viewport: innerHeight, footerTop: Math.round(footerTop) };
  });
  results.push({ viewport: `${w}x${h}`, ...m, errors });
  if (SHOTS && w === 1440) {
    await page.screenshot({ path: `${OUT}/2-player-fits.png` });
    await page.getByTestId("scenes-list").scrollIntoViewIfNeeded();
    await page.evaluate(() => document.getElementById("workspace-scroll")?.scrollBy(0, 200));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/1-grid-16x9.png` });
    const viewBtn = page.getByRole("button", { name: "View full size" }).nth(6);
    await viewBtn.hover().catch(() => {});
    await viewBtn.click({ force: true });
    await page.getByTestId("scene-viewer").waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/3-scene-viewer.png` });
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1200);
    results.push({ viewerAfterArrow: await page.getByTestId("scene-viewer-title").textContent().catch(() => null) });
  }
  await ctx.close();
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
