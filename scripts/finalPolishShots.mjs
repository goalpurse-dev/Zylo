// Final polish screenshots ($0, internal test account): the "What's new"
// popup on its solid background (1920 + 390) and the Home Long Form path card.
// The account has Long Form projects, so only the popup's project-count
// check is answered with 0.
//   node --env-file=.env.local scripts/finalPolishShots.mjs <outDir>
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
await admin.from("profiles").update({ seen_announcements: [] }).eq("id", TEST_USER);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const out = {};
for (const [w, h, mobile] of [[1920, 1080, false], [390, 844, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  await ctx.route("**/rest/v1/long_form_projects*", (r) => r.request().method() === "HEAD"
    ? r.fulfill({ status: 200, headers: { "content-range": "*/0", "access-control-expose-headers": "Content-Range" }, body: "" }) : r.continue());
  const page = await ctx.newPage();
  await page.goto("http://localhost:5173/workspace/home");
  await page.getByTestId("whats-new").waitFor({ timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/popup-${w}.jpg`, type: "jpeg", quality: 86 });
  // Background: one solid colour, nothing blurred or gradient behind the content.
  out[`popup${w}`] = await page.getByTestId("whats-new").evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    backgroundImage: getComputedStyle(el).backgroundImage,
    animation: getComputedStyle(el).animationName,
    glowLayers: [...el.querySelectorAll("*")].filter((n) => { const s = getComputedStyle(n); return /blur/.test(s.filter) || /gradient/.test(s.backgroundImage) && !n.closest("a,button,label"); }).map((n) => n.className.slice(0, 60)),
  }));
  if (!mobile) {
    await page.getByRole("button", { name: "Close" }).click();
    const card = page.getByTestId("path-long");
    await card.scrollIntoViewIfNeeded();
    await page.mouse.move(5, 5);
    await page.waitForFunction(() => { const v = document.querySelector('[data-testid="path-long"] video'); return v && v.readyState >= 3 && v.currentTime > 0.8; }, null, { timeout: 30000 }).catch(() => {});
    out.cardSrc = await card.evaluate((el) => el.querySelector("video")?.currentSrc ?? el.querySelector("video")?.src);
    await card.screenshot({ path: `${OUT}/card-long.jpg`, type: "jpeg", quality: 88 });
    await page.getByTestId("path-short").evaluate((el) => el.parentElement.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: `${OUT}/cards-row.jpg`, type: "jpeg", quality: 84, clip: await page.getByTestId("path-short").evaluate((el) => { const r = el.parentElement.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });
  }
  await ctx.close();
}
await browser.close();
await admin.from("profiles").update({ seen_announcements: [] }).eq("id", TEST_USER);
console.log(JSON.stringify(out, null, 1));
