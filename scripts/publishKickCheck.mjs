// $0: the Publish page starts everything itself ONLY when nothing was ever
// rendered. Internal test account, dev server. The start call is intercepted
// and answered by this script, so nothing real is started or charged.
//   node --env-file=.env.local scripts/publishKickCheck.mjs [origin]
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [ORIGIN = "http://localhost:5173"] = process.argv.slice(2);
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f", PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const anon = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
const browser = await chromium.launch({ channel: "chrome" });

for (const [name, statusStub] of [
  ["nothing rendered yet", { ok: true, job: null, lastDone: null, doneByRes: {}, price1440: 18 }],
  ["a failed render exists", null], // the project's real state: must NOT start anything
  ["an older finished render exists", { ok: true, job: null, lastDone: { id: "x", status: "done", resolution: "1080p", editVersion: 1, latestEditVersion: 2, outdated: true, videoUrl: null, previewUrl: null }, doneByRes: {}, price1440: 18 }],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: ORIGIN }]);
  await ctx.addInitScript(([k, v, a, b]) => { try { localStorage.setItem(k, v); localStorage.setItem(a, "1"); localStorage.setItem(b, "1"); } catch {} },
    [`sb-${ref}-auth-token`, JSON.stringify(sess.session), `zyvo_workspace_welcome:${TEST_USER}`, `zyvo_creator_rewards_seen:${TEST_USER}`]);
  const page = await ctx.newPage();
  let starts = 0;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  // Never let a start reach the server.
  await page.route("**/functions/v1/long-form-publish-start", (route) => { starts += 1; route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, started: true }) }); });
  await page.route("**/functions/v1/long-form-render", async (route) => {
    const body = route.request().postDataJSON?.() ?? {};
    if (body.action === "start") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, alreadyRunning: true }) });
    if (body.action === "status" && statusStub) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(statusStub) });
    return route.continue();
  });
  await page.goto(`${ORIGIN}/long-form/project/${PROJECT}/publish`, { waitUntil: "load" });
  await page.waitForSelector('[data-testid="render-card"]', { timeout: 30000 });
  await page.waitForTimeout(5000);
  const ui = await page.evaluate(() => ({ starting: !!document.querySelector('[data-testid="render-starting"]'), renderButton: document.querySelector('[data-testid="render-button"]')?.textContent?.trim() ?? null, backToEdit: [...document.querySelectorAll("button")].some((b) => /Back to Edit/.test(b.textContent) || b.getAttribute("aria-label") === "Back to Edit") }));
  console.log(name, JSON.stringify({ publishStartCalls: starts, ...ui, errors }));
  await ctx.close();
}
await browser.close();
