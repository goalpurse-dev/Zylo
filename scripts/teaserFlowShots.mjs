// $0: screenshots + checks of the free / logged-out Long Form flow on the dev
// server. Internal test account only. NOTHING real is started or written:
// every edge function except two read-only ones (plan-prices, the quote) is
// answered by this script, and every database write is swallowed. The teaser
// shown is a real measured one (scripts/teaserMeasure.ts), replayed.
//   node --env-file=.env.local scripts/teaserFlowShots.mjs <outDir> <measuredRunDir> [origin]
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [OUT, RUN, ORIGIN = "http://localhost:5173"] = process.argv.slice(2);
if (!OUT || !RUN) { console.error("usage: teaserFlowShots.mjs <outDir> <measuredRunDir> [origin]"); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const measured = JSON.parse(readFileSync(join(RUN, "teaser.json"), "utf8"));
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f", TEASER_ID = "11111111-2222-4333-8444-555555555555";
const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George
const DRAFT_KEY = "zyvo:long-form:production-setup-draft:v1", AUTOSTART_KEY = "zyvo:long-form:teaser-autostart";
const draft = { guest: true, topic: measured.topic, nicheId: measured.niche, visualStyleId: "classic_flat_stickman", lengthMinutes: 10, voiceId: VOICE_ID };
const setup = { nicheLabel: "Military & Logistics History", visualStyleId: "classic_flat_stickman", lengthMinutes: 10, renderTier: "v3", voiceId: VOICE_ID, voiceName: "George" };

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const anon = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
const browser = await chromium.launch({ channel: "chrome" });
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });

// One browser context with the guard: nothing reaches the server except reads.
async function context({ signedIn, plan = null, viewport = { width: 1366, height: 900 }, cookie = true, storage = {} }) {
  const ctx = await browser.newContext({ viewport });
  if (cookie) await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: ORIGIN }]);
  const seed = { ...storage, ...(signedIn ? { [`sb-${ref}-auth-token`]: JSON.stringify(sess.session) } : {}) };
  await ctx.addInitScript((entries) => { try { if (!sessionStorage.getItem("__seeded")) { for (const [k, v] of entries) localStorage.setItem(k, v); sessionStorage.setItem("__seeded", "1"); } } catch { /* ignore */ } }, Object.entries(seed));
  const log = { blocked: [], writes: [], teaser: [], phase: "writing", plan, calls: {} };
  const teaserView = () => {
    const p = log.phase, written = p !== "writing";
    const ready = p === "scene1" ? 1 : p === "done" ? 3 : 0;
    return {
      id: TEASER_ID, status: p === "done" ? "done" : written ? "drawing" : "writing", topic: measured.topic, niche: measured.niche, setup,
      title: written ? measured.title : null, hook: written ? measured.hook : null,
      scenes: written ? measured.scenes.map((s, i) => ({ n: i + 1, status: i < ready ? "ready" : i === ready ? "drawing" : "queued", imageUrl: i < ready ? `${ORIGIN}/__teaser/scene-${i + 1}.jpg` : null })) : [],
      sceneCount: 3, error: null, upgradeClicked: false, paid: false, fullStarted: false, projectId: null, createdAt: new Date().toISOString(),
    };
  };
  await ctx.route("**/__teaser/scene-*.jpg", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: readFileSync(join(RUN, route.request().url().split("/").pop())) }));
  await ctx.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.continue();
    if (req.method() !== "GET" && req.method() !== "HEAD") { log.writes.push(`${req.method()} ${new URL(req.url()).pathname.split("/").pop()}`); return json(route, [], 201); }
    if (!log.plan || !req.url().includes("/rest/v1/profiles")) return route.continue();
    // The test account is free; a paid plan is shown by changing what the page reads (never the row).
    const res = await route.fetch();
    const fix = (r) => (r && typeof r === "object" ? { ...r, ...("plan_code" in r ? { plan_code: log.plan } : {}), ...("stripe_subscription_id" in r ? { stripe_subscription_id: log.plan === "free" ? null : "sub_screenshot" } : {}) } : r);
    const body = await res.json();
    return route.fulfill({ response: res, json: Array.isArray(body) ? body.map(fix) : fix(body) });
  });
  await ctx.route("**/functions/v1/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.continue();
    const name = new URL(req.url()).pathname.split("/").pop();
    log.calls[name] = (log.calls[name] ?? 0) + 1;
    const body = req.postDataJSON?.() ?? {};
    // The test account is really free, so the server refuses it a quote. For the paid-plan views the
    // Starter price is answered here: V2, 25 credits a minute (tool_prices longform:v2), ~15 scenes a minute.
    if (name === "quote-long-form-project" && log.plan && log.plan !== "free") return json(route, { totalCredits: 25 * body.targetDurationMinutes, estimatedBeatCount: 15 * body.targetDurationMinutes });
    if (name === "plan-prices" || name === "quote-long-form-project") return route.continue(); // read-only
    if (name === "create-long-form-discovery-session") return json(route, { id: "99999999-0000-4000-8000-000000000001" });
    if (name === "long-form-teaser") {
      log.teaser.push(body.action === "event" ? `event:${body.event}` : body.action);
      if (body.action === "start") { log.startBody = body; return json(route, { ok: true, teaserId: TEASER_ID, teaser: teaserView() }); }
      if (body.action === "get") return json(route, { ok: true, teaser: teaserView() });
      return json(route, { ok: true });
    }
    log.blocked.push(name);
    if (name === "create-checkout-session") log.checkoutBody = body;
    if (name === "create-long-form-project") log.projectBody = body;
    return json(route, { error: "blocked by the screenshot script" }, 503);
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, page, log, errors };
}
const generate = (page) => page.getByRole("button", { name: /^Generate video/ }).first();
// The button's words (its <style> block is not part of the label).
const label = (page) => generate(page).evaluate((b) => { const c = b.cloneNode(true); c.querySelectorAll("style").forEach((s) => s.remove()); return c.textContent.replace(/\s+/g, " ").trim(); });
const report = {};

// ---- 1. Logged out: the button has no credit amount; Generate opens the sign-up dialog.
{
  const { ctx, page, log, errors } = await context({ signedIn: false, storage: { [DRAFT_KEY]: JSON.stringify(draft) } });
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" });
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /^Generate video/.test(b.textContent.trim()) && !b.disabled), null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  const button = await label(page);
  const note = await page.locator('[data-testid="free-preview-note"]').first().textContent();
  await page.screenshot({ path: join(OUT, "1a-logged-out-setup.png") });
  await generate(page).click();
  await page.waitForSelector('[data-zyvo-modal="auth"]', { timeout: 10000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, "1-logged-out-signup-modal.png") });
  const modal = await page.evaluate(() => { const m = document.querySelector('[data-zyvo-modal="auth"]'); return { heading: m.querySelector("h2")?.textContent.trim(), google: /Continue with Google/.test(m.textContent), email: !!m.querySelector('input[type="email"]') }; });
  const kept = await page.evaluate(([d, a]) => ({ draft: JSON.parse(localStorage.getItem(d)), autostart: !!localStorage.getItem(a) }), [DRAFT_KEY, AUTOSTART_KEY]);
  report.loggedOut = { button, hasNumber: /\d/.test(button), note, modal, draftKept: { topic: kept.draft.topic, nicheId: kept.draft.nicheId, lengthMinutes: kept.draft.lengthMinutes, voiceId: kept.draft.voiceId }, autostartSet: kept.autostart, sessionCalls: log.calls["create-long-form-discovery-session"] ?? 0, teaserCalls: log.teaser, blocked: log.blocked, errors };
  await ctx.close();
}

// ---- 2. Just signed up (free): back on the same setup, the teaser starts by itself. Loading, then result.
{
  const { ctx, page, log, errors } = await context({ signedIn: true, storage: { [DRAFT_KEY]: JSON.stringify(draft), [AUTOSTART_KEY]: String(Date.now()) } });
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" });
  await page.waitForURL(`**/long-form/teaser/${TEASER_ID}`, { timeout: 30000 });
  await page.waitForSelector('[data-testid="teaser-steps"]', { timeout: 15000 });
  await page.waitForTimeout(700);
  const stepsWriting = await page.locator('[data-testid="teaser-steps"] li').allTextContents();
  await page.screenshot({ path: join(OUT, "2a-teaser-loading-writing.png") });
  log.phase = "scene1";
  await page.waitForSelector('[data-testid="teaser-scene"][data-status="ready"] img', { timeout: 15000 });
  await page.waitForTimeout(1200);
  const stepsDrawing = await page.locator('[data-testid="teaser-steps"] li').allTextContents();
  await page.screenshot({ path: join(OUT, "2-teaser-loading.png") });
  log.phase = "done";
  await page.waitForSelector('[data-testid="teaser-upgrade"]', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="teaser-scene"] img').length === 3 && [...document.querySelectorAll('[data-testid="teaser-scene"] img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
  await page.waitForFunction(() => /\d/.test(document.querySelector('[data-testid="teaser-price"]')?.textContent ?? ""), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, "3-teaser-result-upgrade.png"), fullPage: true });
  const result = await page.evaluate(() => ({
    title: document.querySelector('[data-testid="teaser-title"]')?.textContent, hook: document.querySelector('[data-testid="teaser-hook"]')?.textContent,
    honest: document.querySelector('[data-testid="teaser-honest"]')?.textContent, card: document.querySelector('[data-testid="teaser-upgrade"] h2')?.textContent,
    cardText: document.querySelector('[data-testid="teaser-upgrade"] p')?.textContent, price: document.querySelector('[data-testid="teaser-price"]')?.textContent?.trim(),
    upgrade: document.querySelector('[data-testid="teaser-upgrade-button"]')?.textContent.trim(), otherPopups: document.querySelectorAll('[data-zyvo-modal], [data-testid="whats-new"], [role="dialog"]').length,
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "3m-teaser-result-mobile.png") });
  await page.locator('[data-testid="teaser-upgrade"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "3n-teaser-upgrade-mobile.png") });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.setViewportSize({ width: 1366, height: 900 });
  // Upgrade: the checkout call is stopped here; what it would have sent is recorded.
  await page.locator('[data-testid="teaser-upgrade-button"]').click();
  await page.waitForTimeout(2500);
  report.afterSignUp = { mobileOverflow, autoStarted: log.teaser[0] === "start", startCount: log.teaser.filter((a) => a === "start").length, startBody: { topic: log.startBody?.topic, niche: log.startBody?.niche, lengthMinutes: log.startBody?.setup?.lengthMinutes, voiceId: log.startBody?.setup?.voiceId }, stepsWriting, stepsDrawing, result, checkout: { priceId: log.checkoutBody?.priceId, successUrl: log.checkoutBody?.successUrl, cancelUrl: log.checkoutBody?.cancelUrl }, events: log.teaser.filter((a) => a.startsWith("event:")), writes: [...new Set(log.writes)], blocked: log.blocked, errors };
  await ctx.close();
}

// ---- 3. A free account presses Generate itself (no auto-start key).
{
  const { ctx, page, log, errors } = await context({ signedIn: true, storage: { [DRAFT_KEY]: JSON.stringify(draft) } });
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" });
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /^Generate video/.test(b.textContent.trim()) && !b.disabled), null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const button = await label(page);
  await page.screenshot({ path: join(OUT, "1b-free-setup.png") });
  const before = log.teaser.length;
  await generate(page).click();
  await page.waitForURL(`**/long-form/teaser/${TEASER_ID}`, { timeout: 15000 });
  report.free = { button, hasNumber: /\d/.test(button), startedBeforeClick: before, startedAfterClick: log.teaser.filter((a) => a === "start").length, projectCalls: log.calls["create-long-form-project"] ?? 0, errors };
  await ctx.close();
}

// ---- 4. A paid plan: the button and the summary are as before (credits shown). Not pressed.
{
  const { ctx, page, log, errors } = await context({ signedIn: true, plan: "starter", storage: { [DRAFT_KEY]: JSON.stringify(draft) } });
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" });
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /^Generate video\s*\d/.test(b.textContent.trim()) && !b.disabled), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const button = await label(page);
  await page.screenshot({ path: join(OUT, "4-paid-button.png") });
  report.paid = { button, freeNote: await page.locator('[data-testid="free-preview-note"]').count(), balanceLine: await page.getByText(/Balance [\d,]+ → [\d,]+/).count(), teaserCalls: log.teaser, errors };
  await ctx.close();
}

// ---- 5. "What's new" for a logged-out visitor: after the cookie banner, once per browser.
{
  const { ctx, page, errors } = await context({ signedIn: false, cookie: false });
  await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Decline" }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
  const whileBanner = await page.locator('[data-testid="whats-new"]').count();
  await page.screenshot({ path: join(OUT, "5a-cookie-banner-first.png") });
  await page.getByRole("button", { name: "Decline" }).click();
  await page.waitForSelector('[data-testid="whats-new"]', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, "5-popup-logged-out.png") });
  const shown = await page.locator('[data-testid="whats-new"]').count();
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(3500);
  report.popup = { whileBannerOpen: whileBanner, afterBannerClosed: shown, afterReload: await page.locator('[data-testid="whats-new"]').count(), errors };
  await ctx.close();
}

// ---- 6. Back from the checkout: the plan is confirmed, then the normal generation is called once
// (the call itself is stopped by this script: no project, no charge).
{
  const { ctx, page, log, errors } = await context({ signedIn: true, plan: "free", storage: { [DRAFT_KEY]: JSON.stringify(draft) } });
  log.phase = "done";
  await page.goto(`${ORIGIN}/long-form/create?start=1&teaser=${TEASER_ID}`, { waitUntil: "load" });
  await page.waitForSelector('[data-testid="after-payment"][data-state="confirming"]', { timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(OUT, "6-after-payment-confirming.png") });
  const projectCallsWhileFree = log.calls["create-long-form-project"] ?? 0;
  const buttonWhileConfirming = await page.evaluate(() => [...document.querySelectorAll("button.zyvo-generate-btn")].map((b) => ({ disabled: b.disabled, starting: /Starting/.test(b.textContent) })));
  log.plan = "starter"; // Stripe's webhook lands
  await page.waitForFunction(() => /Couldn't start your project/.test(document.body.textContent), null, { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, "6b-after-payment-started.png") });
  report.afterPayment = { buttonWhileConfirming, projectCallsWhileFree, projectCalls: log.calls["create-long-form-project"] ?? 0, projectTopic: log.projectBody?.topic ?? null, url: page.url().replace(ORIGIN, ""), events: log.teaser.filter((a) => a.startsWith("event:")), button: await label(page), blocked: log.blocked, errors };
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 1));
