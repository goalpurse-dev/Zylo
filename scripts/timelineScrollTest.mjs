// Timeline scroll check ($0): the internal test account's TEST project editor.
// Fast wheel, trackpad-style horizontal wheel, scrollbar drag, and scrolling
// while playing must all STAY where the user put them (no snap back); Play or
// "Follow playhead" resumes following. Plus a mobile swipe (scrubs, no snap).
//   node --env-file=.env.local scripts/timelineScrollTest.mjs
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(URL_).hostname.split(".")[0];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
async function open(viewport, mobile) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  // Read-only: autosaves are answered locally (nothing written).
  await ctx.route("**/functions/v1/long-form-edit", async (route) => { const b = JSON.parse(route.request().postData() ?? "{}"); if (b.action === "save") return route.fulfill({ json: { ok: true, version: 999 } }); return route.continue(); });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/edit`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-preview").waitFor({ timeout: 60000 });
  await page.waitForFunction(() => document.querySelector("audio")?.readyState >= 1, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}
const out = {};
{
  const { ctx, page } = await open({ width: 1600, height: 1000 }, false);
  const sl = () => page.evaluate(() => document.querySelector("[data-testid=edit-timeline] .overflow-auto").scrollLeft);
  await page.evaluate(() => { document.querySelector("audio").currentTime = 60; });
  await page.waitForTimeout(800);
  const box = await page.locator("[data-testid=edit-timeline] .overflow-auto").boundingBox(); // the visible scroll box
  // 1. fast wheel (shift = horizontal) and trackpad-style deltaX bursts
  await page.mouse.move(box.x + box.width / 2, box.y + 90);
  const s0 = await sl();
  console.log("under pointer", await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.outerHTML.slice(0, 160) : null; }, [box.x + box.width / 2, box.y + 90]), JSON.stringify(box));
  for (let i = 0; i < 12; i++) await page.mouse.wheel(900, 0);
  await page.waitForTimeout(1500);
  const s1 = await sl();
  out.fastWheel = { from: s0, to: s1, stayed: s1 > s0 + 1000, followButton: await page.getByTestId("follow-playhead").isVisible() }; console.log("fastWheel", JSON.stringify(out.fastWheel));
  // 2. scrollbar drag (bottom edge of the scroll box)
  const sc = await page.evaluate(() => { const el = document.querySelector("[data-testid=edit-timeline] .overflow-auto"); const r = el.getBoundingClientRect(); return { x: r.left + el.clientWidth * (el.scrollLeft / el.scrollWidth) + 20, y: r.top + el.clientHeight + 4 }; });
  const t0 = await page.evaluate(() => document.querySelector("audio").currentTime);
  await page.mouse.move(sc.x, sc.y); await page.mouse.down(); await page.mouse.move(sc.x - 400, sc.y, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(1500);
  const s2 = await sl();
  out.scrollbarDrag = { from: s1, to: s2, moved: Math.abs(s2 - s1) > 50, seeked: Math.abs((await page.evaluate(() => document.querySelector("audio").currentTime)) - t0) > 0.01 };
  // 3. scroll while playing: stays (no snap back), Play restarts following
  await page.evaluate(() => { document.querySelector("audio").currentTime = 300; });
  await page.getByTestId("edit-play").click();
  await page.waitForTimeout(800);
  await page.mouse.move(box.x + box.width / 2, box.y + 90);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(-1200, 0);
  const s3 = await sl(); console.log("playing?", await page.evaluate(() => !document.querySelector("audio").paused), "button", await page.getByTestId("follow-playhead").count(), "scroll", s3);
  await page.waitForTimeout(2500);
  const s4 = await sl();
  out.whilePlaying = { afterScroll: s3, after2_5s: s4, stayed: Math.abs(s4 - s3) < 2 };
  await page.getByTestId("follow-playhead").click();
  await page.waitForTimeout(1500);
  const s5 = await sl();
  out.followButton = { jumpedToPlayhead: Math.abs(s5 - s4) > 100 };
  await page.getByTestId("edit-play").click();
  await ctx.close();
}
{
  const { ctx, page } = await open({ width: 390, height: 844 }, true);
  const tBefore = await page.evaluate(() => document.querySelector("audio").currentTime);
  const box = await page.getByTestId("mobile-timeline").boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const y = box.y + 60, x0 = box.x + box.width * 0.8, x1 = box.x + box.width * 0.2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 10; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * i) / 10, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(300);
  const tAfter = await page.evaluate(() => document.querySelector("audio").currentTime);
  await page.waitForTimeout(1500);
  const tLater = await page.evaluate(() => document.querySelector("audio").currentTime);
  out.mobileSwipe = { before: tBefore, after: tAfter, later: tLater, scrubbed: tAfter - tBefore > 1, stayed: Math.abs(tLater - tAfter) < 0.05 };
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
