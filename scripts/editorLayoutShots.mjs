// Editor layout check ($0): the Edit page at 1366x768 and 1920x1080, seeked to
// a time, with layout measurements (timeline width vs the editor, page-level
// horizontal scroll). The internal test account opens its own TEST project;
// with --show <projectId> that project's edit document is built read-only on
// the server side of this script and served into the page (nothing written).
//   node --env-file=.env.local scripts/editorLayoutShots.mjs <outDir> <seconds> [--show <projectId>]
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const [OUT, SEC] = process.argv.slice(2);
const si = process.argv.indexOf("--show");
const SHOW = si > 0 ? process.argv[si + 1] : null;
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

let served = null;
if (SHOW) {
  const { loadEditFor } = await import("./lib/editRead.mjs");
  served = await loadEditFor(admin, SHOW);
  console.log("stale check", JSON.stringify(served._check));
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
const out = [];
for (const [w, h] of [[1366, 768], [1920, 1080]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  if (served) await ctx.route("**/functions/v1/long-form-edit", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (body.action === "get") return route.fulfill({ json: served });
    return route.fulfill({ json: { ok: true, version: served.version + 1 } }); // read-only: nothing is written
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/edit`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-preview").waitFor({ timeout: 60000 });
  await page.waitForFunction(() => document.querySelector("audio")?.readyState >= 1, null, { timeout: 60000 });
  await page.evaluate((x) => { document.querySelector("audio").currentTime = Number(x); }, SEC);
  await page.waitForFunction(() => { const i = document.querySelector("[data-testid=edit-preview] img"); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const img = document.querySelector("[data-testid=edit-preview] img");
    return { grid: r("[data-testid=edit-grid]"), left: r("[data-testid=edit-left]"), preview: r("[data-testid=edit-preview]"), timeline: r("[data-testid=edit-timeline]"), hint: r("[data-testid=edit-hint]"), clipsRendered: document.querySelectorAll("[data-testid=timeline-clip]").length,
      pageHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth, previewImage: img?.getAttribute("src") ?? null };
  });
  await page.screenshot({ path: `${OUT}/editor-${w}x${h}.png` });
  out.push({ size: `${w}x${h}`, ...m, errors });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
