// Publish autopilot screenshots ($0): the TEST project's editor -> "Continue to
// Publish" -> the page filling in, at t≈2 s, t≈25 s and when the thumbnails are
// ready (1920x1080), plus a phone shot. The kickoff and any render start are
// intercepted (no paid render); the YouTube text is shown as "being written"
// for the first 10 s (it already exists); thumbnails fill in for real.
//   node --env-file=.env.local scripts/publishAutopilotShots.mjs <outDir>
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
const out = { shots: [] };
const setup = async (w, h, mobile) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  const t0 = Date.now();
  const kick = [];
  await ctx.route("**/functions/v1/long-form-publish-start", (r) => { kick.push(Date.now() - t0); r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, started: true }) }); });
  await ctx.route("**/functions/v1/long-form-render", async (r) => { const b = r.request().postDataJSON?.() ?? {}; if (b.action === "start") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, blocked: "screenshot run" }) }); return r.continue(); });
  await ctx.route("**/functions/v1/long-form-edit", async (r) => { const b = r.request().postDataJSON?.() ?? {}; if (b.action === "save") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, version: b.baseVersion ?? 13 }) }); return r.continue(); });
  // The thumbnails were drawn before this run: shown as "drawing" for the first 10 s, then the real ones.
  let thumbsShown = 0;
  await ctx.route("**/functions/v1/long-form-thumbnails", async (r) => { const b = r.request().postDataJSON?.() ?? {}; if (b.action === "start" && b.regenerate) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false }) }); if ((b.action === "list" || b.action === "start") && Date.now() - (thumbsShown || (thumbsShown = Date.now())) < 10000) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, tier: "V2", regenerateCredits: 9, perImage: 3, thumbnails: [], selected: null }) }); return r.continue(); });
  let textShown = 0;
  await ctx.route("**/functions/v1/long-form-youtube-text", async (r) => { const b = r.request().postDataJSON?.() ?? {}; if (b.action === "generate") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, text: null, generating: true }) }); if (b.action === "get" && Date.now() - (textShown || (textShown = Date.now())) < 10000) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, text: null, generating: true }) }); return r.continue(); });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  return { ctx, page, errors, kick };
};
const state = async (page) => page.evaluate(() => ({
  starting: !!document.querySelector("[data-testid=render-starting]"), textSkeleton: !!document.querySelector("[data-testid=text-skeleton]"), title: document.querySelector("[data-testid=yt-title]")?.value ?? null,
  thumbSkeletons: document.querySelectorAll("[data-testid=thumb-skeleton]").length, thumbsReady: document.querySelectorAll("[data-testid=thumb] img").length, thumbsDrawing: document.querySelectorAll("[data-testid=thumb] .animate-spin").length,
  hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}));

{
  const { ctx, page, errors, kick } = await setup(1920, 1080, false);
  await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/edit`, { waitUntil: "domcontentloaded" });
  const cont = page.getByRole("button", { name: "Continue to Publish" });
  await cont.waitFor({ timeout: 90000 });
  await page.waitForTimeout(1500);
  await cont.click();
  await page.waitForURL(/\/publish$/, { timeout: 30000 });
  const t = Date.now();
  for (const [name, wait] of [["1-just-opened", 2000], ["2-filling-in", 16000]]) {
    await page.waitForTimeout(Math.max(0, wait - (Date.now() - t)));
    await page.screenshot({ path: `${OUT}/autopilot-${name}.png` });
    out.shots.push({ name, atS: Math.round((Date.now() - t) / 1000), ...(await state(page)) });
  }
  await page.waitForFunction(() => document.querySelectorAll("[data-testid=thumb] img").length === 3, null, { timeout: 400000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/autopilot-3-done.png` });
  out.shots.push({ name: "3-done", atS: Math.round((Date.now() - t) / 1000), ...(await state(page)) });
  out.desktop = { kickoffCalls: kick.length, errors };
  await ctx.close();
}
{
  const { ctx, page, errors } = await setup(390, 844, true);
  await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/publish`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("render-card").waitFor({ timeout: 60000 });
  await page.waitForTimeout(12000);
  await page.screenshot({ path: `${OUT}/autopilot-390.png`, fullPage: true });
  out.mobile = { ...(await state(page)), errors };
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
