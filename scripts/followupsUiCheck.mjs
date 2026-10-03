// UI checks for the test-video follow-ups ($0, local dev server, internal test account):
//  - the Long Form lobby's "New here?" tutorial row (desktop, 390, logged out)
//  - the paused state (the scenes API answer is stubbed to drawingPaused + one queued scene)
//  - text layers visible on the Scenes grid thumbnails
//   node --env-file=.env.local scripts/followupsUiCheck.mjs <outDir> [origin]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [OUT, ORIGIN = "http://localhost:5173"] = process.argv.slice(2);
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae"; // the test account's Vikings video
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
const context = async ({ w = 1440, h = 900, mobile = false, signedIn = true } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies(["https://tryzyvo.com", "https://www.tryzyvo.com", ORIGIN].map((url) => ({ name: "zyvo_cookie_consent", value: "declined", url })));
  if (signedIn) await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  return ctx;
};
// 1. Tutorial row: desktop signed in, 390 signed in, desktop logged out.
for (const [name, opts] of [["lobby-1440", {}], ["lobby-390", { w: 390, h: 844, mobile: true }], ["lobby-loggedout", { signedIn: false }]]) {
  const ctx = await context(opts);
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/long-form`);
  const row = page.getByTestId("tutorial-row");
  const ok = await row.waitFor({ timeout: 30000 }).then(() => true, () => false);
  if (ok) { await row.scrollIntoViewIfNeeded(); await page.waitForTimeout(1200); }
  out[name] = ok ? await row.evaluate((el) => ({ heading: el.querySelector("p")?.textContent, title: el.querySelector("[data-testid=tutorial-card] p")?.textContent, cta: el.querySelectorAll("[data-testid=tutorial-card] p")[1]?.textContent?.trim(), href: el.querySelector("a")?.href, newTab: el.querySelector("a")?.target === "_blank", thumbLoaded: !!el.querySelector("img")?.complete && el.querySelector("img").naturalWidth > 0, under: !!el.previousElementSibling?.matches?.("[data-testid=lobby-showcase]") })) : "missing";
  const box = ok ? await page.locator("#made-with-zyvo").boundingBox() : null;
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 82, ...(box ? { clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, opts.w ?? 1440), height: box.height + 16 } } : {}) });
  await ctx.close();
}
// 2. Paused state (stubbed API answer) + 3. text layers on the grid.
{
  const ctx = await context();
  await ctx.route("**/functions/v1/get-long-form-scenes*", async (route) => {
    const r = await route.fetch();
    const j = await r.json();
    if (j?.scenes?.length) { j.drawingPaused = true; j.scenes[0] = { ...j.scenes[0], status: "queued", imageUrl: null, thumbUrl: null }; }
    await route.fulfill({ response: r, json: j });
  });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/long-form/project/${PROJECT}/scenes`);
  await page.getByTestId("scene-card").first().waitFor({ timeout: 45000 });
  await page.waitForTimeout(3000);
  out.paused = { banner: await page.getByTestId("drawing-paused").first().textContent().catch(() => null), card: await page.getByTestId("scene-paused").first().textContent().catch(() => null), anySpinningDrawingOnQueued: await page.locator("[data-testid=scene-card]").first().getByText("Drawing…").count() };
  await page.screenshot({ path: `${OUT}/paused.jpg`, type: "jpeg", quality: 80 });
  // A card whose scene has a text layer: the layer is drawn on the thumbnail.
  const withText = page.locator("[data-testid=scene-card]").filter({ has: page.locator("svg[data-text-style]") });
  out.gridTextLayers = await withText.count();
  if (out.gridTextLayers) { await withText.first().scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await withText.first().screenshot({ path: `${OUT}/grid-text-layer.jpg`, type: "jpeg", quality: 85 }); out.firstLayerText = await withText.first().locator("svg[data-text-style] text").first().textContent(); }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
