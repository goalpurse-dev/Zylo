// Home polish checks ($0), internal test account: first screen at 1920x1080
// and 1366x768 (path cards + top of What's new visible), 390 with the bottom
// nav, the featured template block, and the What's new crossfade sampled
// every 40 ms around a swap (never a light frame).
//   node --env-file=.env.local scripts/homePolishShots.mjs <outDir>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [OUT] = process.argv.slice(2);
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const c = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await c.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const out = {};
async function open(w, h, mobile) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173/workspace/home", { waitUntil: "domcontentloaded" });
  await page.getByTestId("long-form-section").waitFor({ timeout: 60000 });
  await page.mouse.move(2, 2);
  await page.waitForTimeout(3000);
  return { ctx, page };
}
for (const [w, h, mobile] of [[1920, 1080, false], [1366, 768, false], [390, 844, true]]) {
  const { ctx, page } = await open(w, h, mobile);
  const r = await page.evaluate(() => {
    const top = (sel) => Math.round(document.querySelector(sel)?.getBoundingClientRect().top ?? -1);
    const bottom = (sel) => Math.round(document.querySelector(sel)?.getBoundingClientRect().bottom ?? -1);
    return { pathCardsBottom: bottom("[data-testid=path-long]"), whatsNewTop: top("[data-testid=whats-new-row]"), cardsTop: top("[data-testid=wn-long-form]"), h1: getComputedStyle(document.querySelector("h1")).fontSize, pill: document.body.innerText.includes("AI creation suite for viral content") };
  });
  out[`first${w}`] = { ...r, pathCardsVisible: r.pathCardsBottom <= h, whatsNewVisible: r.whatsNewTop < h };
  await page.screenshot({ path: `${OUT}/home-${w}-first.jpg`, type: "jpeg", quality: 86 });
  if (mobile) {
    out.nav390 = await page.evaluate(() => [...document.querySelectorAll(".ftg-nav-item")].map((b) => { const l = b.querySelector("span:last-child"); return { label: l?.textContent, lines: Math.round(l.getBoundingClientRect().height / 16) }; }));
    await page.locator(".ftg-bottom-nav").screenshot({ path: `${OUT}/bottom-nav-390.jpg`, type: "jpeg", quality: 90 });
    // full page at 390
    const full = await page.evaluate(() => { const s = document.getElementById("workspace-scroll"); return Math.ceil(s.scrollHeight + s.getBoundingClientRect().top); });
    await page.setViewportSize({ width: 390, height: full }); await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/home-390-full.jpg`, type: "jpeg", quality: 82 });
  }
  if (w === 1920) {
    // Featured block.
    await page.evaluate(() => document.querySelector("[data-testid=featured-template]")?.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(3500);
    out.featured = { examples: await page.locator("[data-testid=featured-template] button.group").count(), videos: await page.locator("[data-testid=featured-template] video").count() };
    await page.getByTestId("featured-template").screenshot({ path: `${OUT}/featured-cartoon-drive-by.jpg`, type: "jpeg", quality: 86 });
    // Crossfade: sample the card's centre brightness every 40 ms for 9 s (one swap).
    await page.evaluate(() => { document.getElementById("workspace-scroll").scrollTop = 0; });
    await page.waitForTimeout(800);
    const box = await page.getByTestId("wn-showcase").boundingBox();
    let maxJump = 0, prev = null, minL = 255, maxL = 0;
    for (let i = 0; i < 225; i++) {
      const buf = await page.screenshot({ clip: { x: box.x + box.width * 0.45, y: box.y + box.height * 0.2, width: 24, height: 24 }, type: "png" });
      // mean of the PNG bytes is a rough proxy; decode properly via canvas instead:
      const l = await page.evaluate(async (b64) => { const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode(); const cv = document.createElement("canvas"); cv.width = 24; cv.height = 24; const cx = cv.getContext("2d"); cx.drawImage(img, 0, 0); const d = cx.getImageData(0, 0, 24, 24).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; return s / (d.length / 4); }, buf.toString("base64"));
      if (prev != null) maxJump = Math.max(maxJump, Math.abs(l - prev));
      prev = l; minL = Math.min(minL, l); maxL = Math.max(maxL, l);
      await page.waitForTimeout(40);
    }
    out.crossfade = { samples: 225, maxLumaJumpPerSample: Number(maxJump.toFixed(1)), minLuma: Math.round(minL), maxLuma: Math.round(maxL), whiteFrame: maxL > 245 };
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
