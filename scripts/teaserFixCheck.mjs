// $0: checks of the teaser fixes on the dev server (internal test account).
//   1. nothing starts by itself (fresh load, reload, Back, new tab, an old flag,
//      a flag with an existing account); exactly one start right after a sign-up
//      in the Generate box
//   2. the result screen's three plan cards (screenshots, desktop + mobile)
//   3. after paying for a plan, the full video is asked for once
// NOTHING real is started or written: every edge function except the read-only
// prices is answered here, and database writes are swallowed. The teaser shown
// is a measured run (scripts/teaserMeasure.ts) replayed, with a hand-written
// opening line that passes the hook rules.
//   node --env-file=.env.local scripts/teaserFixCheck.mjs <outDir> <measuredRunDir> [origin]
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [OUT, RUN, ORIGIN = "http://localhost:5173"] = process.argv.slice(2);
if (!OUT || !RUN) { console.error("usage: teaserFixCheck.mjs <outDir> <measuredRunDir> [origin]"); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const measured = { ...JSON.parse(readFileSync(join(RUN, "teaser.json"), "utf8")), hook: "You tighten the strap of a grain sack that has rubbed your shoulder raw since dawn, and the road has no end you can see." };
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f", TEASER_ID = "11111111-2222-4333-8444-555555555555";
const DRAFT_KEY = "zyvo:long-form:production-setup-draft:v1", FLAG = "zyvo:long-form:teaser-autostart:v2", OLD_FLAG = "zyvo:long-form:teaser-autostart";
const draft = { guest: true, topic: measured.topic, nicheId: measured.niche, visualStyleId: "classic_flat_stickman", lengthMinutes: 10, voiceId: "JBFqnCBsd6RMkjVDRZzb" };
const setup = { nicheLabel: "Military & Logistics History", visualStyleId: "classic_flat_stickman", lengthMinutes: 10, renderTier: "v3", voiceId: "JBFqnCBsd6RMkjVDRZzb", voiceName: "George" };
const PER_MINUTE = { v2: 25, v3: 75, v4: 110 }; // tool_prices longform:* (read 2026-10-04)

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const anon = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
const TOKEN_KEY = `sb-${ref}-auth-token`;
// The same session, as a brand-new account would have it (created just now).
const newAccount = () => ({ ...sess.session, user: { ...sess.session.user, created_at: new Date().toISOString() } });
const browser = await chromium.launch({ channel: "chrome" });
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });

async function context({ session = null, plan = null, viewport = { width: 1366, height: 900 }, local = {}, tab = {} }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: ORIGIN }]);
  const seed = { [DRAFT_KEY]: JSON.stringify(draft), ...local, ...(session ? { [TOKEN_KEY]: JSON.stringify(session) } : {}) };
  // Seeded once per context (a later page load must see what the page itself left behind).
  await ctx.addInitScript(([l, t]) => { try { if (!localStorage.getItem("__seeded")) { for (const [k, v] of l) localStorage.setItem(k, v); for (const [k, v] of t) sessionStorage.setItem(k, v); localStorage.setItem("__seeded", "1"); } } catch { /* ignore */ } }, [Object.entries(seed), Object.entries(tab)]);
  const log = { blocked: [], teaser: [], phase: "done", plan, calls: {}, signups: 0 };
  const teaserView = () => ({
    id: TEASER_ID, status: "done", topic: measured.topic, niche: measured.niche, setup, title: measured.title, hook: measured.hook,
    scenes: measured.scenes.map((s, i) => ({ n: i + 1, status: "ready", imageUrl: `${ORIGIN}/__teaser/scene-${i + 1}.jpg` })),
    sceneCount: 3, error: null, upgradeClicked: false, paid: false, fullStarted: false, projectId: null, createdAt: new Date().toISOString(),
  });
  await ctx.route("**/__teaser/scene-*.jpg", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: readFileSync(join(RUN, route.request().url().split("/").pop())) }));
  // A sign-up in the box is answered with the test account's session, dated now: no account is created.
  await ctx.route("**/auth/v1/signup*", (route) => { if (route.request().method() === "OPTIONS") return route.continue(); log.signups += 1; return json(route, newAccount()); });
  await ctx.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.continue();
    if (req.method() !== "GET" && req.method() !== "HEAD") return json(route, [], 201);
    // The stand-in setup session (answered below) is read back on a reload, as a real one would be.
    if (req.url().includes("/rest/v1/long_form_discovery_sessions") && /[?&]id=eq./.test(req.url())) return json(route, [{ id: "99999999-0000-4000-8000-000000000001", user_id: TEST_USER, ideas: [], selected_idea_id: null }]);
    if (!log.plan || !req.url().includes("/rest/v1/profiles")) return route.continue();
    const res = await route.fetch();
    const fix = (r) => (r && typeof r === "object" ? { ...r, ...("plan_code" in r ? { plan_code: log.plan } : {}), ...("stripe_subscription_id" in r ? { stripe_subscription_id: log.plan === "free" ? null : "sub_check" } : {}), ...("stripe_subscription_status" in r ? { stripe_subscription_status: log.plan === "free" ? null : "active" } : {}) } : r);
    const body = await res.json();
    return route.fulfill({ response: res, json: Array.isArray(body) ? body.map(fix) : fix(body) });
  });
  await ctx.route("**/functions/v1/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.continue();
    const name = new URL(req.url()).pathname.split("/").pop();
    log.calls[name] = (log.calls[name] ?? 0) + 1;
    const body = req.postDataJSON?.() ?? {};
    if (name === "quote-long-form-project" && log.plan && log.plan !== "free") return json(route, { totalCredits: PER_MINUTE[body.renderTier] * body.targetDurationMinutes, estimatedBeatCount: 15 * body.targetDurationMinutes });
    if (name === "plan-prices" || name === "quote-long-form-project") return route.continue(); // read-only
    if (name === "create-long-form-discovery-session") return json(route, { id: "99999999-0000-4000-8000-000000000001" });
    if (name === "long-form-teaser") {
      log.teaser.push(body.action === "event" ? `event:${body.event}` : body.action);
      if (body.action === "start") return json(route, { ok: true, teaserId: TEASER_ID, teaser: teaserView() });
      if (body.action === "get") return json(route, { ok: true, teaser: teaserView() });
      return json(route, { ok: true });
    }
    log.blocked.push(name);
    if (name === "create-checkout-session") log.checkoutBody = body;
    if (name === "create-long-form-project") log.projectBody = body;
    return json(route, { error: "blocked by the check script" }, 503);
  });
  const errors = [];
  const open = async () => { const page = await ctx.newPage(); page.on("pageerror", (e) => errors.push(e.message.slice(0, 160))); return page; };
  return { ctx, page: await open(), open, log, errors };
}
const starts = (log) => log.teaser.filter((a) => a === "start").length;
const generate = (page) => page.getByRole("button", { name: /^Generate video/ }).first();
const ready = (page) => page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /^Generate video/.test(b.textContent.trim()) && !b.disabled), null, { timeout: 30000 });
const SETTLE = 5000; // long enough for the page to finish loading the account and decide
const report = {};

// ---- 1a. A free account opens the Create page: fresh load, reload, Back, a new tab. Nothing starts.
{
  const { ctx, page, open, log, errors } = await context({ session: sess.session });
  const seen = {};
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" }); await ready(page); await page.waitForTimeout(SETTLE);
  seen.freshLoad = starts(log);
  await page.reload({ waitUntil: "load" }); await ready(page); await page.waitForTimeout(SETTLE);
  seen.reload = starts(log);
  await page.goto(`${ORIGIN}/long-form`, { waitUntil: "load" }); await page.waitForTimeout(1500);
  await page.goBack({ waitUntil: "load" }); await ready(page); await page.waitForTimeout(SETTLE);
  seen.backButton = starts(log);
  const tab = await open();
  await tab.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" }); await ready(tab); await tab.waitForTimeout(SETTLE);
  seen.newTab = starts(log);
  report.freeAccountOpensPage = { startsAfter: seen, url: tab.url().replace(ORIGIN, ""), errors };
  await ctx.close();
}

// ---- 1b. The flag the first version left in browsers (localStorage, valid an hour): ignored and removed.
{
  const { ctx, page, log, errors } = await context({ session: sess.session, local: { [OLD_FLAG]: String(Date.now()) } });
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" }); await ready(page); await page.waitForTimeout(SETTLE);
  report.oldFlagLeftBehind = { starts: starts(log), oldFlagStillThere: await page.evaluate((k) => localStorage.getItem(k) != null, OLD_FLAG), errors };
  await ctx.close();
}

// ---- 1c. The new flag, but the account is an existing one (signed in through the box): nothing starts, the flag is gone.
{
  const { ctx, page, log, errors } = await context({ session: sess.session, tab: { [FLAG]: String(Date.now()) } });
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" }); await ready(page); await page.waitForTimeout(SETTLE);
  report.flagWithExistingAccount = { starts: starts(log), flagStillThere: await page.evaluate((k) => sessionStorage.getItem(k) != null, FLAG), errors };
  await ctx.close();
}

// ---- 1d. Logged out: Generate opens the box; opening and closing it arms nothing.
{
  const { ctx, page, log, errors } = await context({});
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" }); await ready(page); await page.waitForTimeout(1200);
  await generate(page).click();
  await page.waitForSelector('[data-zyvo-modal="auth"]', { timeout: 10000 });
  const armedWhileOpen = await page.evaluate(([a, b]) => sessionStorage.getItem(a) != null || localStorage.getItem(b) != null, [FLAG, OLD_FLAG]);
  await page.locator('[data-zyvo-modal="auth"] button[aria-label="Close"]').click();
  await page.waitForTimeout(500);
  const armedAfterClose = await page.evaluate(([a, b]) => sessionStorage.getItem(a) != null || localStorage.getItem(b) != null, [FLAG, OLD_FLAG]);
  report.loggedOutOpensAndClosesBox = { armedWhileOpen, armedAfterClose, starts: starts(log), errors };
  await ctx.close();
}

// ---- 1e. The one case that starts by itself: a sign-up in the Generate box (email, signed in at once).
// Then reload, Back and a new tab: still exactly one.
{
  const { ctx, page, open, log, errors } = await context({});
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" }); await ready(page); await page.waitForTimeout(1200);
  await generate(page).click();
  await page.waitForSelector('[data-zyvo-modal="auth"]', { timeout: 10000 });
  await page.fill('[data-zyvo-modal="auth"] input[type="email"]', "new-person@zyvo-internal.test");
  await page.fill('[data-zyvo-modal="auth"] input[type="password"]', "a-long-password-123");
  await page.locator('[data-zyvo-modal="auth"] button[type="submit"]').click();
  const arrived = await page.waitForURL(`**/long-form/teaser/${TEASER_ID}`, { timeout: 30000 }).then(() => true, () => false);
  const afterSignUp = starts(log);
  await page.waitForTimeout(2000);
  await page.goBack({ waitUntil: "load" }); await ready(page); await page.waitForTimeout(SETTLE);
  const afterBack = starts(log);
  await page.reload({ waitUntil: "load" }); await ready(page); await page.waitForTimeout(SETTLE);
  const afterReload = starts(log);
  const tab = await open();
  await tab.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" }); await ready(tab); await tab.waitForTimeout(SETTLE);
  report.signUpInTheBox = { signupCalls: log.signups, arrivedOnTeaser: arrived, startsAfterSignUp: afterSignUp, afterBack, afterReload, afterNewTab: starts(log), flagLeft: await page.evaluate((k) => sessionStorage.getItem(k) != null, FLAG), errors };
  await ctx.close();
}

// ---- 2. The result screen: three plans (desktop + mobile), each with its own checkout.
{
  const { ctx, page, log, errors } = await context({ session: sess.session });
  await page.goto(`${ORIGIN}/long-form/teaser/${TEASER_ID}`, { waitUntil: "load" });
  await page.waitForSelector('[data-testid="teaser-plans"]', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="teaser-scene"] img').length === 3 && [...document.querySelectorAll('[data-testid="teaser-scene"] img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="teaser-plan-price"]')].every((p) => /\d/.test(p.textContent)) && [...document.querySelectorAll('[data-testid="teaser-plan"]')].every((p) => /\d+\s*ten-minute/.test(p.textContent)), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator('[data-testid="teaser-upgrade"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, "result-desktop-plans.png") });
  await page.evaluate(() => document.getElementById("workspace-scroll")?.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, "result-desktop-top.png") });
  const cards = await page.evaluate(() => [...document.querySelectorAll('[data-testid="teaser-plan"]')].map((c) => ({ plan: c.dataset.plan, text: c.textContent.replace(/\s+/g, " ").trim(), top: Math.round(c.getBoundingClientRect().top), left: Math.round(c.getBoundingClientRect().left) })));
  const sideBySide = new Set(cards.map((c) => c.top)).size === 1;
  const allPlans = await page.locator('[data-testid="teaser-all-plans"]').getAttribute("href");
  const hook = await page.locator('[data-testid="teaser-hook"]').textContent();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, "result-mobile-top.png") });
  await page.locator('[data-testid="teaser-upgrade"] h2').scrollIntoViewIfNeeded();
  await page.evaluate(() => { const s = document.getElementById("workspace-scroll"); const h = document.querySelector('[data-testid="teaser-upgrade"]'); if (s && h) s.scrollTo(0, s.scrollTop + h.getBoundingClientRect().top - 70); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "result-mobile-plans-1.png") });
  await page.evaluate(() => { const s = document.getElementById("workspace-scroll"); const h = document.querySelector('[data-testid="teaser-plan"][data-plan="pro"]'); if (s && h) s.scrollTo(0, s.scrollTop + h.getBoundingClientRect().top - 90); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "result-mobile-plans-2.png") });
  const mobile = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, stacked: new Set([...document.querySelectorAll('[data-testid="teaser-plan"]')].map((c) => Math.round(c.getBoundingClientRect().left))).size === 1 }));
  await page.setViewportSize({ width: 1366, height: 900 });
  // Each button asks for its own plan's checkout (the call is stopped here).
  const checkouts = [];
  for (const plan of ["starter", "pro", "generative"]) {
    log.checkoutBody = null;
    await page.locator(`[data-testid="teaser-plan-button"][data-plan="${plan}"]`).click();
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="teaser-plan-button"]')].every((b) => !b.disabled), null, { timeout: 20000 }).catch(() => {});
    checkouts.push({ plan, priceId: log.checkoutBody?.priceId ?? null, successUrl: (log.checkoutBody?.successUrl ?? "").replace(ORIGIN, ""), cancelUrl: (log.checkoutBody?.cancelUrl ?? "").replace(ORIGIN, "") });
    await page.waitForTimeout(400);
  }
  report.resultScreen = { hook, cards, sideBySide, mobile, allPlans, checkouts, upgradeEvents: log.teaser.filter((a) => a === "event:upgrade_clicked").length, errors };
  await ctx.close();
}

// ---- 3. Back from the checkout with Pro: the plan is confirmed, the full video is asked for once.
{
  const { ctx, page, log, errors } = await context({ session: sess.session, plan: "free" });
  await page.goto(`${ORIGIN}/long-form/create?start=1&teaser=${TEASER_ID}`, { waitUntil: "load" });
  await page.waitForSelector('[data-testid="after-payment"][data-state="confirming"]', { timeout: 30000 });
  await page.waitForTimeout(3500);
  const whileFree = log.calls["create-long-form-project"] ?? 0;
  log.plan = "pro";
  await page.waitForFunction(() => /Couldn't start your project/.test(document.body.textContent), null, { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(6000);
  const label = await generate(page).evaluate((b) => { const c = b.cloneNode(true); c.querySelectorAll("style").forEach((s) => s.remove()); return c.textContent.replace(/\s+/g, " ").trim(); });
  report.afterPayingPro = { projectCallsWhileFree: whileFree, projectCalls: log.calls["create-long-form-project"] ?? 0, teaserStarts: starts(log), events: log.teaser.filter((a) => a.startsWith("event:")), quality: await page.locator("dt:has-text('Quality') + dd").first().textContent().catch(() => null), button: label, url: page.url().replace(ORIGIN, ""), errors };
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 1));
