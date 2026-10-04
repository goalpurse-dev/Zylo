// $0 live check of the teaser fixes on production (internal test account).
// A teaser start can never reach the server from this browser: the call is
// counted and answered here. Tracking inserts are swallowed, the setup session
// is a stand-in, no checkout button is pressed.
//   node --env-file=.env.local scripts/teaserFixLiveCheck.mjs <outDir> [rewards-only] [origin]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [OUT, MODE = "all", ORIGIN = "https://www.tryzyvo.com"] = process.argv.slice(2);
if (!OUT) { console.error("usage: teaserFixLiveCheck.mjs <outDir> [all|rewards-only] [origin]"); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f", LIVE_TEASER = "f66aef74-8b45-4a4a-afab-595039fa34fa"; // the test account's real teaser (2026-10-04)
const DRAFT_KEY = "zyvo:long-form:production-setup-draft:v1", OLD_FLAG = "zyvo:long-form:teaser-autostart";
const draft = { guest: true, topic: "How did Rome feed an army on the march?", nicheId: "military_logistics_history", visualStyleId: "classic_flat_stickman", lengthMinutes: 10, voiceId: "JBFqnCBsd6RMkjVDRZzb" };

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const teaserRows = async () => (await admin.from("long_form_teasers").select("id", { count: "exact", head: true }).eq("user_id", TEST_USER)).count;
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const anon = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
const browser = await chromium.launch({ channel: "chrome" });
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });

async function context({ local = {}, viewport = { width: 1366, height: 900 } }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: ORIGIN }]);
  const seed = { [DRAFT_KEY]: JSON.stringify(draft), [`sb-${ref}-auth-token`]: JSON.stringify(sess.session), ...local };
  await ctx.addInitScript((entries) => { try { if (!localStorage.getItem("__seeded")) { for (const [k, v] of entries) localStorage.setItem(k, v); localStorage.setItem("__seeded", "1"); } } catch { /* ignore */ } }, Object.entries(seed));
  const log = { starts: 0 };
  await ctx.route("**/rest/v1/marketing_events*", (route) => (route.request().method() === "POST" ? json(route, [], 201) : route.continue()));
  // Only the single-row read of the stand-in session is answered; list reads (the projects list) go to the server.
  await ctx.route("**/rest/v1/long_form_discovery_sessions*", (route) => (route.request().method() === "GET" && /[?&]id=eq./.test(route.request().url()) ? json(route, [{ id: "99999999-0000-4000-8000-000000000001", user_id: TEST_USER, ideas: [], selected_idea_id: null }]) : route.continue()));
  await ctx.route("**/functions/v1/create-long-form-discovery-session", (route) => (route.request().method() === "OPTIONS" ? route.continue() : json(route, { id: "99999999-0000-4000-8000-000000000001" })));
  await ctx.route("**/functions/v1/update-long-form-discovery-session", (route) => (route.request().method() === "OPTIONS" ? route.continue() : json(route, { ok: true })));
  await ctx.route("**/functions/v1/create-checkout-session", (route) => (route.request().method() === "OPTIONS" ? route.continue() : json(route, { error: "not in this check" }, 503)));
  // A start never leaves this browser.
  await ctx.route("**/functions/v1/long-form-teaser", (route) => {
    if (route.request().method() === "OPTIONS") return route.continue();
    if ((route.request().postDataJSON?.() ?? {}).action === "start") { log.starts += 1; return json(route, { error: "stopped by the live check" }, 503); }
    return route.continue(); // get: read-only
  });
  const errors = [];
  const open = async () => { const page = await ctx.newPage(); page.on("pageerror", (e) => errors.push(e.message.slice(0, 160))); return page; };
  return { ctx, page: await open(), open, log, errors };
}
const ready = (page) => page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /^Generate video/.test(b.textContent.trim()) && !b.disabled), null, { timeout: 30000 });
const rewardsPopup = (page) => page.evaluate(() => [...document.querySelectorAll("div.fixed.inset-0 [style]")].filter((e) => /0D0620|13, 6, 32/i.test(e.getAttribute("style") ?? "")).length);
const report = { origin: ORIGIN, mode: MODE };

// ---- The "Earn free credits" popup: an account that never saw it opens Home.
{
  const { ctx, page, errors } = await context({ local: { [`zyvo_workspace_welcome:${TEST_USER}`]: "1" } });
  await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  await page.waitForTimeout(6000);
  report.rewardsPopup = { opensByItself: await rewardsPopup(page), errors };
  await page.screenshot({ path: join(OUT, `live-home-${MODE === "all" ? "after" : "before"}.png`) });
  await ctx.close();
}
if (MODE !== "all") { await browser.close(); console.log(JSON.stringify(report, null, 1)); process.exit(0); }

// ---- Wait for the deploy: the new result screen has the three plan cards.
let live = false;
for (let i = 0; i < 20 && !live; i++) {
  const { ctx, page } = await context({});
  await page.goto(`${ORIGIN}/long-form/teaser/${LIVE_TEASER}`, { waitUntil: "load" });
  live = await page.waitForSelector('[data-testid="teaser-plans"]', { timeout: 15000 }).then(() => true, () => false);
  await ctx.close();
  if (!live) await new Promise((r) => setTimeout(r, 30000));
}
report.deployLive = live;
if (!live) { await browser.close(); console.log(JSON.stringify(report, null, 1)); process.exit(2); }
const rowsBefore = await teaserRows();

// ---- 1. A free account opens the Create page: fresh load, reload, Back, a new tab, with the old flag still in the browser.
{
  const { ctx, page, open, log, errors } = await context({ local: { [OLD_FLAG]: String(Date.now()) } });
  const seen = {};
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" }); await ready(page); await page.waitForTimeout(6000);
  seen.freshLoadWithOldFlag = log.starts;
  await page.reload({ waitUntil: "load" }); await ready(page); await page.waitForTimeout(6000);
  seen.reload = log.starts;
  await page.goto(`${ORIGIN}/long-form`, { waitUntil: "load" }); await page.waitForTimeout(1500);
  await page.goBack({ waitUntil: "load" }); await ready(page); await page.waitForTimeout(6000);
  seen.backButton = log.starts;
  const tab = await open();
  await tab.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" }); await ready(tab); await tab.waitForTimeout(6000);
  seen.newTab = log.starts;
  report.freeAccountOpensPage = { startsAfter: seen, url: tab.url().replace(ORIGIN, ""), oldFlagRemoved: await tab.evaluate((k) => localStorage.getItem(k) == null, OLD_FLAG), errors };
  await ctx.close();
}

// ---- 2. The result screen with the three plans (the test account's real teaser), desktop + mobile.
{
  const { ctx, page, errors } = await context({});
  await page.goto(`${ORIGIN}/long-form/teaser/${LIVE_TEASER}`, { waitUntil: "load" });
  await page.waitForSelector('[data-testid="teaser-plans"]', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="teaser-scene"] img')].length === 3 && [...document.querySelectorAll('[data-testid="teaser-scene"] img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="teaser-plan"]')].every((p) => /€\s?\d|\d\s?€|\$\d/.test(p.textContent) && /\d+\s*ten-minute/.test(p.textContent)), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator('[data-testid="teaser-upgrade"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "live-result-desktop.png") });
  const cards = await page.evaluate(() => [...document.querySelectorAll('[data-testid="teaser-plan"]')].map((c) => ({ text: c.textContent.replace(/\s+/g, " ").trim(), top: Math.round(c.getBoundingClientRect().top) })));
  const footer = await page.locator('[data-testid="teaser-all-plans"]').evaluate((a) => ({ href: a.getAttribute("href"), line: a.parentElement.textContent.replace(/\s+/g, " ").trim() }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const s = document.getElementById("workspace-scroll"); const h = document.querySelector('[data-testid="teaser-plans"]'); if (s && h) s.scrollTo(0, s.scrollTop + h.getBoundingClientRect().top - 110); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "live-result-mobile.png") });
  const mobile = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, stacked: new Set([...document.querySelectorAll('[data-testid="teaser-plan"]')].map((c) => Math.round(c.getBoundingClientRect().left))).size === 1 }));
  report.resultScreen = { cards: cards.map((c) => c.text), sideBySide: new Set(cards.map((c) => c.top)).size === 1, footer, mobile, errors };
  await ctx.close();
}

report.teaserRowsForTestAccount = { before: rowsBefore, after: await teaserRows() };
await browser.close();
console.log(JSON.stringify(report, null, 1));
