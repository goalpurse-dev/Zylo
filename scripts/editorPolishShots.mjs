// Editor polish check ($0): a real user's project served READ-ONLY into the
// internal test account's editor (nothing written). Desktop 1920: Motion and
// Audio tabs, every tab's body scrolls under a fixed tab bar, tiles are still
// at rest (two screenshots 1.2 s apart are identical) and play once on hover.
// Mobile 390: the Motion sheet and a scene's own camera sheet.
//   node --env-file=.env.local scripts/editorPolishShots.mjs <outDir> <projectId>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { loadEditFor } from "./lib/editRead.mjs";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const [OUT, SHOW] = process.argv.slice(2);
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
const served = await loadEditFor(admin, SHOW);
const browser = await chromium.launch({ channel: "chrome", headless: true });
async function open(viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  await ctx.route("**/functions/v1/long-form-edit", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (body.action === "get") return route.fulfill({ json: served });
    return route.fulfill({ json: { ok: true, version: served.version + 1 } }); // read-only
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/edit`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-preview").waitFor({ timeout: 60000 });
  await page.waitForFunction(() => document.querySelector("audio")?.readyState >= 1, null, { timeout: 60000 });
  await page.evaluate(() => { document.querySelector("audio").currentTime = 44; });
  await page.waitForTimeout(2500);
  return { ctx, page, errors };
}
const out = {};
{
  const { ctx, page, errors } = await open({ width: 1920, height: 1080 }, false);
  out.tabs = await page.locator("[data-testid^=tab-]").evaluateAll((els) => els.map((e) => e.textContent));
  // Every tab: the body scrolls, the tab bar never moves.
  out.scroll = {};
  for (const tab of ["text", "captions", "audio", "motion"]) {
    await page.getByTestId(`tab-${tab}`).click();
    await page.waitForTimeout(300);
    out.scroll[tab] = await page.evaluate(() => {
      const bar = document.querySelector("[data-testid=tab-text]").getBoundingClientRect().top;
      const body = document.querySelector("[data-testid=edit-left-body]");
      body.scrollTop = 99999;
      const after = document.querySelector("[data-testid=tab-text]").getBoundingClientRect().top;
      const bodyTop = body.getBoundingClientRect().top;
      return { overflow: body.scrollHeight > body.clientHeight, scrolled: body.scrollTop, barMoved: after - bar, bodyBelowBar: bodyTop >= after, pageScrollY: document.getElementById("workspace-scroll")?.scrollTop ?? 0 };
    });
    await page.evaluate(() => { document.querySelector("[data-testid=edit-left-body]").scrollTop = 0; });
  }
  await page.getByTestId("tab-motion").click();
  await page.waitForTimeout(600);
  // Still at rest: two shots of the tiles 1.2 s apart are byte-identical.
  const a = await page.getByTestId("motion-panel").screenshot();
  await page.waitForTimeout(1200);
  const b = await page.getByTestId("motion-panel").screenshot();
  out.tilesStillAtRest = Buffer.compare(a, b) === 0;
  await page.screenshot({ path: `${OUT}/desktop-motion-tab.png` });
  // Hover plays once: mid-play differs from rest, and it is back at rest after.
  await page.getByTestId("transition-whip").hover();
  await page.waitForTimeout(330);
  await page.getByTestId("transition-whip").screenshot({ path: `${OUT}/tile-whip-mid-hover.png` });
  const mid = await page.getByTestId("transition-whip").screenshot();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(1500);
  const rest1 = await page.getByTestId("transition-whip").screenshot();
  await page.waitForTimeout(800);
  const rest2 = await page.getByTestId("transition-whip").screenshot();
  out.hoverPlaysOnce = Buffer.compare(mid, rest1) !== 0 && Buffer.compare(rest1, rest2) === 0;
  await page.getByTestId("tab-audio").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/desktop-audio-tab.png` });
  // A scene: its own camera move.
  await page.getByTestId("timeline-clip").nth(3).click({ position: { x: 12, y: 10 } });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/desktop-scene-motion.png` });
  out.clipMotionIcons = await page.getByTestId("clip-motion").count();
  out.desktopErrors = errors;
  await ctx.close();
}
{
  const { ctx, page, errors } = await open({ width: 390, height: 844 }, true);
  out.mobileTools = await page.locator("[data-testid^=tool-]").evaluateAll((els) => els.map((e) => e.textContent));
  await page.getByTestId("tool-motion").tap();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/mobile-390-motion-sheet.png` });
  await page.getByRole("button", { name: "Close" }).last().tap();
  await page.waitForTimeout(400);
  const box = await page.getByTestId("mobile-timeline").boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2 + 3, box.y + 30);
  await page.waitForTimeout(500);
  await page.getByTestId("ctx-motion").tap();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/mobile-390-scene-motion.png` });
  out.mobileErrors = errors;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
