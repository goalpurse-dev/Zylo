// Publish UX screenshots + persistence check ($0), TEST project, internal test account.
// States: "real" (as the DB is), "upgrading" (1080p done + 1440p rendering), "both" (1080p + 1440p done),
// "thumbsFailed" (tiles failed → Try again). Non-real states change the real status/list response in
// the browser. Every page is refreshed once; any start/generate call is COUNTED (and blocked) — a
// refresh must never restart finished work — and the job rows in the DB are compared before/after.
//   node --env-file=.env.local scripts/publishUxShots.mjs <outDir>
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
const jobRows = async () => (await admin.from("long_form_render_jobs").select("id", { count: "exact", head: true }).eq("project_id", TEST_PROJECT)).count;
const thumbRows = async () => (await admin.from("long_form_thumbnails").select("id", { count: "exact", head: true }).eq("project_id", TEST_PROJECT)).count;

const asDone = (v, res, latest) => ({ ...v, status: "done", resolution: res, editVersion: latest, latestEditVersion: latest, outdated: false });
const shape = {
  real: (s) => s,
  upgrading: (s) => { const d = s.lastDone ?? s.job; const v = d.latestEditVersion; return { ...s, job: { ...d, id: "fake-1440", status: "rendering", stage: "rendering", resolution: "1440p", progress: 38, editVersion: v, latestEditVersion: v, reason: null }, doneByRes: { "1080p": asDone(d, "1080p", v) } }; },
  both: (s) => { const d = s.lastDone ?? s.job; const v = d.latestEditVersion; return { ...s, job: asDone(d, "1440p", v), lastDone: null, doneByRes: { "1080p": asDone(d, "1080p", v), "1440p": asDone(d, "1440p", v) } }; },
  thumbsFailed: (s) => s,
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const out = { before: { jobs: await jobRows(), thumbs: await thumbRows() }, pages: {} };
for (const [w, h, mobile] of [[1366, 768, false], [1920, 1080, false], [390, 844, true]]) {
  for (const state of ["real", "upgrading", "both", "thumbsFailed"]) {
    if (w === 1920 && state === "thumbsFailed") continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: "http://localhost:5173" }]);
    await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
      [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
    const starts = [];
    await ctx.route("**/functions/v1/long-form-render", async (r) => {
      const b = r.request().postDataJSON?.() ?? {};
      if (b.action === "start") { starts.push(`render ${b.resolution}`); return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, blocked: true }) }); }
      if (b.action !== "status") return r.continue();
      const real = await (await r.fetch()).json();
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(shape[state](real)) });
    });
    await ctx.route("**/functions/v1/long-form-thumbnails", async (r) => {
      const b = r.request().postDataJSON?.() ?? {};
      if (["start", "retry"].includes(b.action)) { starts.push(`thumbs ${b.action}`); return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, blocked: true, thumbnails: [] }) }); }
      if (state !== "thumbsFailed" || b.action !== "list") return r.continue();
      const real = await (await r.fetch()).json();
      real.thumbnails = real.thumbnails.slice(0, 3).map((t, i) => (i === 1 ? t : { ...t, status: "failed", pngUrl: null }));
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(real) });
    });
    await ctx.route("**/functions/v1/long-form-youtube-text", async (r) => { const b = r.request().postDataJSON?.() ?? {}; if (b.action === "generate") { starts.push("text generate"); return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, generating: true }) }); } return r.continue(); });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    const url = `http://localhost:5173/long-form/project/${TEST_PROJECT}/publish`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.getByTestId("render-card").waitFor({ timeout: 60000 });
    await page.waitForFunction(() => document.querySelector("[data-testid=yt-description]") && document.querySelectorAll("[data-testid=thumb]").length > 0, null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    // A refresh must never restart anything.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("render-card").waitFor({ timeout: 60000 });
    await page.waitForFunction(() => document.querySelector("[data-testid=yt-description]"), null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/publish-${state}-${w}.png`, fullPage: mobile });
    const info = await page.evaluate(() => {
      const tile = document.querySelector("[data-testid=thumb]")?.getBoundingClientRect();
      const player = document.querySelector("[data-testid=publish-player]");
      const ta = document.querySelector("[data-testid=yt-description]");
      return {
        hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth,
        tileW: tile ? Math.round(tile.width) : null, player: player ? { quality: player.dataset.quality, src: (player.getAttribute("src") ?? "").includes("proxy") ? "360p proxy" : "full" } : null,
        buttons: ["download-1440", "download-full", "make-1440p", "upgrade-progress", "render-button", "download-previous", "thumbs-retry-all", "thumbs-regenerate", "thumb-retry"].filter((t) => document.querySelector(`[data-testid=${t}]`)),
        boxes: ["render-failed", "render-progress", "render-starting", "render-outdated"].filter((t) => document.querySelector(`[data-testid=${t}]`)),
        descAutoHeight: ta ? ta.scrollHeight <= ta.clientHeight + 4 : null, descHasEndWith: ta ? /End with/.test(ta.value) : null,
      };
    });
    // The large preview modal (desktop, a ready tile).
    if (!mobile && state === "real") { const t = page.locator("[data-testid=thumb] button").first(); if (await t.count()) { await t.click(); await page.getByTestId("thumb-modal").waitFor({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(800); await page.screenshot({ path: `${OUT}/publish-modal-${w}.png` }); info.modal = await page.getByTestId("thumb-modal").count(); await page.keyboard.press("Escape"); } }
    out.pages[`${state}-${w}`] = { ...info, startCalls: starts, errors };
    await ctx.close();
  }
}
out.after = { jobs: await jobRows(), thumbs: await thumbRows() };
console.log(JSON.stringify(out, null, 1));
await browser.close();
