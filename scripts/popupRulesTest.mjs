// "What's new" popup rules ($0), internal test account. A new browser context
// is a fresh browser session (same login). The account has Long Form
// projects, so tests 1-5 answer only the project-count check with 0; test 6
// uses the real count.
//   node --env-file=.env.local scripts/popupRulesTest.mjs <outDir>
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
const results = [];
const reset = () => admin.from("profiles").update({ seen_announcements: [] }).eq("id", TEST_USER);

async function session({ noProjects = true, w = 1920, h = 1080, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  if (noProjects) await ctx.route("**/rest/v1/long_form_projects*", (r) => r.request().method() === "HEAD"
    ? r.fulfill({ status: 200, headers: { "content-range": "*/0", "access-control-expose-headers": "Content-Range" }, body: "" }) : r.continue());
  return ctx;
}
const popupShown = async (page) => page.getByTestId("whats-new").waitFor({ timeout: 9000 }).then(() => true, () => false);
const record = (name, expect, got) => results.push({ name, expect, got, pass: expect === got });

await reset();
// 1. Fresh session on Home -> shown.  2. Reload in the same session -> not shown.
let ctx = await session();
let page = await ctx.newPage();
await page.goto("http://localhost:5173/workspace/home");
record("1 fresh session on Home", true, await popupShown(page));
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/popup-1920.jpg`, type: "jpeg", quality: 86 });
await page.getByRole("button", { name: "Close" }).click();
await page.reload();
record("2 reload, same session", false, await popupShown(page));
await ctx.close();
// 3. New session -> shown again (closed without the checkbox).
ctx = await session(); page = await ctx.newPage();
await page.goto("http://localhost:5173/workspace/home");
record("3 new session, closed without ticking", true, await popupShown(page));
// 4. Tick "Don't show this again", close; new session -> never again.
await page.getByTestId("whats-new-dont-show").click();
await page.getByRole("button", { name: "Close" }).click();
await page.waitForTimeout(1500);
await ctx.close();
ctx = await session(); page = await ctx.newPage();
await page.goto("http://localhost:5173/workspace/home");
record("4 after 'Don't show this again'", false, await popupShown(page));
const { data: prof } = await admin.from("profiles").select("seen_announcements").eq("id", TEST_USER).single();
results.at(-1).profile = prof.seen_announcements;
await ctx.close();
// 5. Other pages: never there; reaching Home later in the session shows it.
await reset();
ctx = await session(); page = await ctx.newPage();
await page.goto("http://localhost:5173/long-form");
record("5a fresh session, lands on /long-form", false, await popupShown(page));
await page.locator("aside nav").getByText("Home", { exact: true }).click();
record("5b then opens Home in the same session", true, await popupShown(page));
await ctx.close();
// Mobile 390 screenshot of the popup (fresh session).
ctx = await session({ w: 390, h: 844, mobile: true }); page = await ctx.newPage();
await page.goto("http://localhost:5173/workspace/home");
if (await popupShown(page)) { await page.waitForTimeout(2500); await page.screenshot({ path: `${OUT}/popup-390.jpg`, type: "jpeg", quality: 86 }); }
await ctx.close();
// 6. The account really has Long Form projects -> never shown.
await reset();
ctx = await session({ noProjects: false }); page = await ctx.newPage();
await page.goto("http://localhost:5173/workspace/home");
record("6 user already has a Long Form project", false, await popupShown(page));
await ctx.close();
await browser.close();
console.log(JSON.stringify({ passed: results.filter((r) => r.pass).length, of: results.length, results }, null, 1));
