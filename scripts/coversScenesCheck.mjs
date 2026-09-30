// Covers + scene grid check ($0, internal test account): the Long Form lobby's
// covers (neutral title cover when a project has no picture yet — never niche
// art), and a project's scene grid: every finished scene ends up sharp (never
// left behind the blurred placeholder), including after a reload (cached images).
//   node --env-file=.env.local scripts/coversScenesCheck.mjs <projectId> <outDir>
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [PROJECT, OUT] = process.argv.slice(2);
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
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
  [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
const page = await ctx.newPage();
await page.goto("http://localhost:5173/long-form");
await page.getByTestId("create-card").waitFor({ timeout: 30000 });
await page.waitForTimeout(3500);
const covers = await page.evaluate(() => ({
  neutral: document.querySelectorAll('[data-testid="neutral-cover"]').length,
  nicheArt: [...document.querySelectorAll('[data-testid="recent-card"] img')].filter((i) => /\/niches\//.test(i.src)).length,
}));
const recent = page.getByTestId("recent-card").first();
await recent.evaluate((el) => el.parentElement.scrollIntoView({ block: "center" }));
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/lobby-covers.jpg`, type: "jpeg", quality: 84 });
const grid = async () => {
  await page.getByTestId("scene-card").first().waitFor({ timeout: 45000 });
  // Each card in turn: scroll it into view, give its (lazy) picture up to 4 s to load, then
  // judge it — a loaded picture must be shown sharp, never left behind the blurred placeholder.
  const n = await page.getByTestId("scene-card").count();
  let withImage = 0, stuckBlurred = 0, notLoaded = 0;
  for (let i = 0; i < n; i++) {
    const card = page.getByTestId("scene-card").nth(i);
    await card.scrollIntoViewIfNeeded();
    const r = await card.evaluate(async (c) => {
      const main = () => [...c.querySelectorAll("img")].find((x) => !x.getAttribute("aria-hidden"));
      for (let t = 0; t < 40 && !(main()?.complete && main()?.naturalWidth > 0); t++) await new Promise((res) => setTimeout(res, 100));
      await new Promise((res) => setTimeout(res, 800)); // the 700 ms fade-in
      const m = main();
      if (!m) return "none";
      if (!(m.complete && m.naturalWidth > 0)) return "notLoaded";
      return getComputedStyle(m).opacity === "1" ? "sharp" : "stuck";
    });
    if (r !== "none") withImage++;
    if (r === "stuck") stuckBlurred++;
    if (r === "notLoaded") notLoaded++;
  }
  return { cards: n, withImage, stuckBlurred, notLoaded };
};
await page.goto(`http://localhost:5173/long-form/project/${PROJECT}/scenes`);
const first = await grid();
await page.reload(); // now from cache: the case that used to stay blurred
const cached = await grid();
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: `${OUT}/scenes-grid.jpg`, type: "jpeg", quality: 80 });
await browser.close();
console.log(JSON.stringify({ covers, scenes: { first, afterReload: cached } }, null, 1));
