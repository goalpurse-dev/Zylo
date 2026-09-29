// Final Publish checks ($0), TEST project, internal test account: opening the
// project lands on Publish (render done), the thumbnail + video download as
// files (no new tab) with slug names, the "Picked" badge sits bottom-left, and
// screenshots at 1366 and 390.
//   node --env-file=.env.local scripts/publishFinalCheck.mjs <outDir>
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
for (const [w, h, mobile] of [[1366, 800, false], [390, 844, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  const starts = [];
  await ctx.route("**/functions/v1/long-form-render", async (r) => { const b = r.request().postDataJSON?.() ?? {}; if (b.action === "start") { starts.push("render"); return r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }); } return r.continue(); });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  // 1. Open the project from its root: where does it land?
  await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/(publish|edit|scenes|idea|generating)$/, { timeout: 60000 }).catch(() => {});
  const landed = new URL(page.url()).pathname.split("/").pop();
  if (landed !== "publish") await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/publish`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("render-card").waitFor({ timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-testid=thumb] img").length > 0 && document.querySelector("[data-testid=yt-description]"), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  // 2. Pick a thumbnail (via its modal) if none is picked, then download it.
  if (!(await page.getByTestId("thumb-download").count())) { await page.locator("[data-testid=thumb] button").first().click(); await page.getByRole("button", { name: "Use this thumbnail" }).click(); await page.waitForTimeout(1500); }
  const pages0 = ctx.pages().length;
  const [thumbDl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }).catch(() => null), page.getByTestId("thumb-download").click()]);
  const videoBtn = (await page.getByTestId("download-full").count()) ? "download-full" : "download-previous";
  const [videoDl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }).catch(() => null), page.getByTestId(videoBtn).click()]);
  if (videoDl) await videoDl.cancel().catch(() => {});
  const badge = await page.evaluate(() => { const t = [...document.querySelectorAll("[data-testid=thumb]")].find((x) => x.textContent.includes("Picked")); if (!t) return null; const b = [...t.querySelectorAll("span")].find((s) => s.textContent === "Picked").getBoundingClientRect(), r = t.getBoundingClientRect(); return { bottomLeft: b.left - r.left < 10 && r.bottom - b.bottom < 10 }; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/publish-final-${w}.png`, fullPage: false });
  out[w] = { landedOn: landed, thumbFile: thumbDl?.suggestedFilename() ?? null, videoFile: videoDl?.suggestedFilename() ?? null, newTabs: ctx.pages().length - pages0, badge, hScroll: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), startCalls: starts, errors };
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
