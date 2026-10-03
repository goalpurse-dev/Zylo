// $0: Home at the site root, against a built dist/ served WITH the single-page
// fallback (npx vite preview --port 4322). Logged out, logged in (internal
// test account, read-only), the old address, and app routes that are served
// the root file as their fallback HTML.
//   node --env-file=.env.local scripts/homeRootCheck.mjs <outDir> [origin]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [OUT, ORIGIN = "http://localhost:4322"] = process.argv.slice(2);
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const anon = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const out = {};
const context = async ({ signedIn, mobile = false }) => {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: ORIGIN }]);
  if (signedIn) await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  return ctx;
};
const head = (page) => page.evaluate(() => ({
  path: location.pathname, title: document.title,
  canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
  robots: document.querySelector('meta[name="robots"]')?.content ?? null,
  ld: (document.getElementById("page-ld")?.textContent ?? "").includes('"Organization"'),
  h1: [...document.querySelectorAll("h1")].map((h) => h.textContent.replace(/\s+/g, " ").trim()),
  shell: document.documentElement.dataset.shell ?? null, hideStyle: !!document.getElementById("shell-hide"),
  rootVisible: getComputedStyle(document.getElementById("root")).visibility,
}));

for (const [name, opts] of [["out-desktop", { signedIn: false }], ["out-mobile", { signedIn: false, mobile: true }], ["in-desktop", { signedIn: true }], ["in-mobile", { signedIn: true, mobile: true }]]) {
  const ctx = await context(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  await page.waitForTimeout(4500);
  out[name] = {
    ...(await head(page)),
    login: await page.getByRole("button", { name: /^Login$/ }).count() + await page.getByRole("link", { name: /^Login$/ }).count(),
    startFree: await page.getByText(/Start for Free/).count(),
    credits: await page.getByText(/Upgrade/).count(),
    sidebarHomeActive: opts.mobile ? null : await page.evaluate(() => { const b = [...document.querySelectorAll("aside button, nav button, aside a")].find((el) => el.textContent.trim() === "Home"); return b ? /lime|border-lime|bg-/.test(b.className) && b.className.length > 0 ? b.className.includes("lime") : false : null; }),
    errors,
  };
  await page.screenshot({ path: `${OUT}/root-${name}.png` });
  await ctx.close();
}

// The old address, and navigation from another page to Home.
{
  const ctx = await context({ signedIn: true });
  const page = await ctx.newPage();
  await page.goto(`${ORIGIN}/workspace/home?checkout=success`, { waitUntil: "load" });
  await page.waitForTimeout(3500);
  out.oldAddress = { ...(await head(page)), search: await page.evaluate(() => location.search) };
  await page.goto(`${ORIGIN}/long-form`, { waitUntil: "load" });
  await page.waitForTimeout(3500);
  out.longFormLoaded = await head(page);
  out.homeActiveOnLongForm = await page.evaluate(() => { const b = [...document.querySelectorAll("aside button, aside a")].find((el) => el.textContent.trim() === "Home"); return b ? b.className.includes("lime") : null; });
  await page.locator("aside").getByText("Home", { exact: true }).first().click();
  await page.waitForTimeout(2500);
  out.afterSidebarHome = await head(page);
  await ctx.close();
}

// Fallback HTML on an app route: what is on screen BEFORE the app script runs?
for (const [name, path, signedIn] of [["fallback-long-form", "/long-form", true], ["fallback-project", "/long-form/project/f6ee3eb2-726b-4faa-9d25-1ed957eb46ae/scenes", true], ["fallback-unknown", "/workspace/settings", false]]) {
  const ctx = await context({ signedIn });
  const page = await ctx.newPage();
  // Hold the app script back so the pre-script state can be looked at.
  let release;
  const held = new Promise((r) => { release = r; });
  await page.route(/\/assets\/index-[^/]+\.js$/, async (route) => { await held; await route.continue(); });
  await page.goto(`${ORIGIN}${path}`, { waitUntil: "commit" }); // the held script also holds DOMContentLoaded
  await page.waitForTimeout(1500);
  const before = await head(page);
  await page.screenshot({ path: `${OUT}/${name}-before-app.png` });
  release();
  await page.waitForTimeout(5000);
  const after = await head(page);
  out[name] = { before: { title: before.title, canonical: before.canonical, ld: before.ld, shell: before.shell, rootVisible: before.rootVisible }, after: { path: after.path, title: after.title, canonical: after.canonical, ld: after.ld, h1: after.h1, hideStyle: after.hideStyle, rootVisible: after.rootVisible } };
  await page.screenshot({ path: `${OUT}/${name}-after-app.png` });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
