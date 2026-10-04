// Live check of the free / logged-out Long Form flow on production.
// PAID: step 2 runs ONE real teaser for the internal test account (about
// $0.008, hard cap $0.02). Everything else is $0. Tracking inserts from this
// browser are swallowed so the funnel numbers stay clean.
//   node --env-file=.env.local scripts/teaserLiveCheck.mjs <outDir> [origin]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const [OUT, ORIGIN = "https://www.tryzyvo.com"] = process.argv.slice(2);
if (!OUT) { console.error("usage: teaserLiveCheck.mjs <outDir> [origin]"); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const DRAFT_KEY = "zyvo:long-form:production-setup-draft:v1";
const draft = { guest: true, topic: "How did Rome feed an army on the march?", nicheId: "military_logistics_history", visualStyleId: "classic_flat_stickman", lengthMinutes: 10, voiceId: "JBFqnCBsd6RMkjVDRZzb" };

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: profile } = await admin.from("profiles").select("plan_code").eq("id", TEST_USER).maybeSingle();
if (String(profile?.plan_code ?? "free") !== "free") throw new Error("the test account is not free");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const anon = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const ref = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
const browser = await chromium.launch({ channel: "chrome" });
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });

async function context({ signedIn, cookie = true, storage = {}, paidView = false }) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  if (cookie) await ctx.addCookies([{ name: "zyvo_cookie_consent", value: "declined", url: ORIGIN }]);
  const seed = { ...storage, ...(signedIn ? { [`sb-${ref}-auth-token`]: JSON.stringify(sess.session), [`zyvo_workspace_welcome:${TEST_USER}`]: "1", [`zyvo_creator_rewards_seen:${TEST_USER}`]: "1" } : {}) };
  await ctx.addInitScript((entries) => { try { if (!sessionStorage.getItem("__seeded")) { for (const [k, v] of entries) localStorage.setItem(k, v); sessionStorage.setItem("__seeded", "1"); } } catch { /* ignore */ } }, Object.entries(seed));
  const calls = {};
  await ctx.route("**/rest/v1/marketing_events*", (route) => (route.request().method() === "POST" ? json(route, [], 201) : route.continue()));
  await ctx.route("**/functions/v1/**", (route) => { const n = new URL(route.request().url()).pathname.split("/").pop(); if (route.request().method() !== "OPTIONS") calls[n] = (calls[n] ?? 0) + 1; return route.fallback(); });
  if (paidView) {
    // No paid account may be signed in to from here: the plan and the quote are
    // answered in the browser (Starter, V2 at 25 credits a minute). Nothing is written.
    await ctx.route("**/rest/v1/profiles*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const res = await route.fetch();
      const fix = (r) => (r && typeof r === "object" ? { ...r, ...("plan_code" in r ? { plan_code: "starter" } : {}), ...("stripe_subscription_id" in r ? { stripe_subscription_id: "sub_check" } : {}) } : r);
      const body = await res.json();
      return route.fulfill({ response: res, json: Array.isArray(body) ? body.map(fix) : fix(body) });
    });
    await ctx.route("**/functions/v1/quote-long-form-project", (route) => { if (route.request().method() === "OPTIONS") return route.continue(); const b = route.request().postDataJSON(); return json(route, { totalCredits: 25 * b.targetDurationMinutes, estimatedBeatCount: 15 * b.targetDurationMinutes }); });
    await ctx.route("**/functions/v1/create-long-form-discovery-session", (route) => (route.request().method() === "OPTIONS" ? route.continue() : json(route, { id: "99999999-0000-4000-8000-000000000001" })));
    await ctx.route("**/functions/v1/long-form-teaser", (route) => (route.request().method() === "OPTIONS" ? route.continue() : json(route, { error: "not in this check" }, 503)));
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, page, calls, errors };
}
const generate = (page) => page.getByRole("button", { name: /^Generate video/ }).first();
const label = (page) => generate(page).evaluate((b) => { const c = b.cloneNode(true); c.querySelectorAll("style").forEach((s) => s.remove()); return c.textContent.replace(/\s+/g, " ").trim(); });
const enabled = (page, ms) => page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /^Generate video/.test(b.textContent.trim()) && !b.disabled), null, { timeout: ms });
const report = { origin: ORIGIN };

// ---- 0. Wait for the deploy: on the old build a logged-out Generate never becomes usable.
let live = false;
for (let i = 0; i < 20 && !live; i++) {
  const { ctx, page } = await context({ signedIn: false, storage: { [DRAFT_KEY]: JSON.stringify(draft) } });
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" });
  live = await enabled(page, 15000).then(() => true, () => false);
  await ctx.close();
  if (!live) await new Promise((r) => setTimeout(r, 30000));
}
report.deployLive = live;
if (!live) { console.log(JSON.stringify(report)); await browser.close(); process.exit(2); }

// ---- 1. Logged out: Generate shows the sign-up box.
{
  const { ctx, page, calls, errors } = await context({ signedIn: false, storage: { [DRAFT_KEY]: JSON.stringify(draft) } });
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" });
  await enabled(page, 30000);
  await page.waitForTimeout(1000);
  const button = await label(page);
  await generate(page).click();
  await page.waitForSelector('[data-zyvo-modal="auth"]', { timeout: 10000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, "live-1-logged-out-signup.png") });
  report.loggedOut = { button, ...(await page.evaluate(() => { const m = document.querySelector('[data-zyvo-modal="auth"]'); return { heading: m.querySelector("h2")?.textContent.trim(), google: /Continue with Google/.test(m.textContent), email: !!m.querySelector('input[type="email"]') }; })), teaserCalls: calls["long-form-teaser"] ?? 0, errors };
  await ctx.close();
}

// ---- 2. A free account gets the teaser (REAL, about $0.008).
{
  const { ctx, page, calls, errors } = await context({ signedIn: true, storage: { [DRAFT_KEY]: JSON.stringify(draft) } });
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" });
  await enabled(page, 30000);
  await page.waitForTimeout(2500);
  const button = await label(page);
  const t0 = Date.now();
  await generate(page).click();
  const started = await page.waitForURL(/\/long-form\/teaser\/[0-9a-f-]{36}/, { timeout: 30000 }).then(() => true, () => false);
  const out = { button, started };
  if (!started) out.message = await page.evaluate(() => [...document.querySelectorAll("p")].map((p) => p.textContent).filter((t) => /preview|email|limit|wrong|try/i.test(t)).slice(0, 3));
  else {
    const teaserId = page.url().split("/").pop();
    await page.waitForSelector('[data-testid="teaser-steps"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(4000);
    out.stepsMidway = await page.locator('[data-testid="teaser-steps"] li').allTextContents().catch(() => []);
    await page.screenshot({ path: join(OUT, "live-2-teaser-loading.png") });
    const done = await page.waitForSelector('[data-testid="teaser-page"][data-status="done"], [data-testid="teaser-page"][data-status="failed"]', { timeout: 120000 }).then(() => true, () => false);
    out.seconds = Math.round((Date.now() - t0) / 100) / 10;
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="teaser-scene"] img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => /\d/.test(document.querySelector('[data-testid="teaser-price"]')?.textContent ?? ""), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(OUT, "live-3-teaser-result.png") });
    Object.assign(out, { finished: done }, await page.evaluate(() => ({
      status: document.querySelector('[data-testid="teaser-page"]')?.dataset.status, title: document.querySelector('[data-testid="teaser-title"]')?.textContent,
      hook: document.querySelector('[data-testid="teaser-hook"]')?.textContent, images: [...document.querySelectorAll('[data-testid="teaser-scene"] img')].filter((i) => i.naturalWidth > 0).length,
      card: document.querySelector('[data-testid="teaser-upgrade"] h2')?.textContent, price: document.querySelector('[data-testid="teaser-price"]')?.textContent?.trim(), upgrade: document.querySelector('[data-testid="teaser-upgrade-button"]')?.textContent.trim(),
    })));
    // What the server recorded: the row, its real cost and the ledger lines.
    const { data: row } = await admin.from("long_form_teasers").select("status, cost_usd, cap_usd, scenes, finished_at, ip_hash").eq("id", teaserId).maybeSingle();
    const { data: ledger } = await admin.from("long_form_cost_ledger").select("provider, model, usd, estimated").eq("source_table", "long_form_teasers").eq("source_id", teaserId);
    out.server = { teaserId, status: row?.status, costUsd: Number(row?.cost_usd), capUsd: Number(row?.cap_usd), scenes: (row?.scenes ?? []).map((s) => s.status), ipHashStored: !!row?.ip_hash, ledger: (ledger ?? []).map((l) => `${l.provider} ${l.model} $${l.usd}${l.estimated ? " (est.)" : ""}`), ledgerTotal: Number((ledger ?? []).reduce((a, l) => a + Number(l.usd), 0).toFixed(6)) };
  }
  out.projectCalls = calls["create-long-form-project"] ?? 0;
  out.errors = errors;
  report.free = out;
  await ctx.close();
}

// ---- 3. A paid plan shows the credit amount (plan and quote answered in the browser; not pressed).
{
  const { ctx, page, errors } = await context({ signedIn: true, paidView: true, storage: { [DRAFT_KEY]: JSON.stringify(draft) } });
  await page.goto(`${ORIGIN}/long-form/create`, { waitUntil: "load" });
  const ok = await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /^Generate video\s*\d/.test(b.textContent.trim()) && !b.disabled), null, { timeout: 30000 }).then(() => true, () => false);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, "live-4-paid-button.png") });
  report.paid = { shown: ok, button: await label(page), freeNote: await page.locator('[data-testid="free-preview-note"]').count(), balanceLine: await page.getByText(/Balance [\d,]+ → [\d,]+/).count(), errors };
  await ctx.close();
}

// ---- 4. "What's new" for a logged-out visitor: after the cookie banner, once.
{
  const { ctx, page, errors } = await context({ signedIn: false, cookie: false });
  await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Decline" }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
  const whileBanner = await page.locator('[data-testid="whats-new"]').count();
  await page.getByRole("button", { name: "Decline" }).click();
  const shown = await page.waitForSelector('[data-testid="whats-new"]', { timeout: 10000 }).then(() => 1, () => 0);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, "live-5-popup-logged-out.png") });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(3500);
  report.popup = { whileBannerOpen: whileBanner, afterBannerClosed: shown, afterReload: await page.locator('[data-testid="whats-new"]').count(), errors };
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 1));
