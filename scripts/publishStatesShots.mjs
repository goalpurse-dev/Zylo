// Publish page screenshots ($0) in three render states — rendering, failed,
// done — at 1920x1080 and 390x844, on the TEST project as the internal test
// account. "failed" is the real latest job; "rendering" and "done" are the real
// status response with the job's state changed in the browser (no render runs).
//   node --env-file=.env.local scripts/publishStatesShots.mjs <outDir>
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

const shape = {
  failed: (s) => s,
  rendering: (s) => { const v = s.job.latestEditVersion; return { ...s, job: { ...s.job, status: "rendering", stage: "rendering", progress: 46, etaSeconds: [60, 140], elapsedSeconds: 95, reason: null, editVersion: v, outdated: false } }; },
  done: (s) => { const v = s.lastDone.latestEditVersion; return { ...s, job: { ...s.lastDone, editVersion: v, latestEditVersion: v, outdated: false }, lastDone: null }; },
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const out = {};
for (const [w, h, mobile] of [[1920, 1080, false], [390, 844, true]]) {
  for (const state of ["rendering", "failed", "done"]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
    await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
      [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
    await ctx.route("**/functions/v1/long-form-render", async (r) => {
      const b = r.request().postDataJSON?.() ?? {};
      if (b.action !== "status") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, blocked: "screenshot run" }) });
      const real = await (await r.fetch()).json();
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(shape[state](real)) });
    });
    await ctx.route("**/functions/v1/long-form-thumbnails", async (r) => { const b = r.request().postDataJSON?.() ?? {}; if (b.action === "start") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false }) }); return r.continue(); });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    await page.goto(`http://localhost:5173/long-form/project/${TEST_PROJECT}/publish`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("render-card").waitFor({ timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=thumb] img").length === 3 && document.querySelector("[data-testid=yt-title]"), null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/publish-${state}-${w}.png`, fullPage: mobile });
    out[`${state}-${w}`] = await page.evaluate(() => ({
      boxes: ["render-failed", "render-progress", "render-starting", "render-outdated"].filter((t) => document.querySelector(`[data-testid=${t}]`)),
      primary: document.querySelector("[data-testid=download-full]") ? "Download video" : document.querySelector("[data-testid=render-button]")?.textContent?.trim() ?? null,
      previousLink: !!document.querySelector("[data-testid=download-previous]"), make1440: !!document.querySelector("[data-testid=make-1440p]"),
      footerButtons: [...document.querySelectorAll("[data-long-form-footer] button")].map((b) => b.textContent.trim()),
      regenerateDisabled: document.querySelector("[data-testid=thumbs-regenerate]")?.disabled ?? null,
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    out[`${state}-${w}`].errors = errors;
    await ctx.close();
  }
}
console.log(JSON.stringify(out));
await browser.close();
