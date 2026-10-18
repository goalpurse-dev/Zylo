// Browser check of /admin/content-machine on a running dev server, with NO real backend: every call to
// content-machine-api is answered in this process by the real handler (_shared/contentMachine/api.js)
// on a store in memory. $0, nothing live touched. Start the dev server on a fake Supabase URL:
//   VITE_SUPABASE_URL=https://cm-fake.supabase.co VITE_SUPABASE_ANON_KEY=fake npx vite --port 5199
//   node scripts/contentMachine/qaPage.mjs <outDir> [baseUrl]
// Checks: a stranger sees the site's "Page Not Found"; the admin sees the top bar, Budget and Settings
// at 1440 and 390 px with no sideways scroll; the guard test and a settings save work; the kill switch flips.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { createHandler } from "../../supabase/functions/_shared/contentMachine/api.js";
import { createBudgetGuard } from "../../supabase/functions/_shared/contentMachine/budgetGuard.js";
import { localDay } from "../../supabase/functions/_shared/contentMachine/spendSummary.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(path.join(ROOT, "package.json"));
const { chromium } = require("playwright");
const { cors } = await import(new URL("../../supabase/functions/shared/cors.ts", import.meta.url));
const [outDir, base = "http://localhost:5199"] = process.argv.slice(2);
if (!outDir) { console.error("usage: node scripts/contentMachine/qaPage.mjs <outDir> [baseUrl]"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });

function memoryStore() {
  const today = localDay(new Date(), "Europe/Helsinki");
  const s = {
    daily_budget_usd: 8, monthly_budget_usd: 150, per_provider_daily_caps: { runware: 6, anthropic: 1.5, apify: 0.5 }, lane_daily_caps: { slideshow: 2 },
    daily_video_target: 15, slideshows_per_day: 5, format_mix: { zyvo_native: 6, listicle_slideshow: 2, long_form_cutdown: 1 }, auto_produce: true, end_card: true,
    kill_switch: false, dry_run: true, run_time_local: "07:00", timezone: "Europe/Helsinki", watchlist: {}, brand_rules: "- Promote Zyvo softly and honestly.\n- No invented stats.", models: {},
  };
  const rows = [
    { id: "a", provider: "runware", operation: "runware.image.fast", lane: "slideshow", estimated_usd: 0.02, actual_usd: 0.0186, status: "settled", dry_run: false, local_day: today, created_at: new Date().toISOString() },
    { id: "b", provider: "anthropic", operation: "anthropic.messages", lane: "slideshow", estimated_usd: 1.5, actual_usd: null, status: "reserved", dry_run: false, local_day: today, created_at: new Date().toISOString() },
  ];
  const audit = [];
  const cost = (r) => r.actual_usd ?? r.estimated_usd;
  return {
    async readSettings() { return { ...s }; },
    async updateSettings(patch, by) { Object.assign(s, patch, { updated_by: by, updated_at: new Date().toISOString() }); return { ...s }; },
    async reserve({ provider, operation, estimatedUsd, lane, dryRun }) {
      const t = rows.filter((r) => r.local_day === today);
      const sum = (f) => t.filter(f).reduce((a, r) => a + cost(r), 0);
      const reason = s.kill_switch ? "kill_switch" : sum(() => true) + estimatedUsd > s.daily_budget_usd ? "daily_cap"
        : s.per_provider_daily_caps[provider] != null && sum((r) => r.provider === provider) + estimatedUsd > s.per_provider_daily_caps[provider] ? "provider_cap"
          : lane && s.lane_daily_caps[lane] != null && sum((r) => r.lane === lane) + estimatedUsd > s.lane_daily_caps[lane] ? "lane_cap" : null;
      if (reason) return { ok: false, reason };
      const row = { id: String(rows.length + 1), provider, operation, lane, estimated_usd: dryRun ? 0 : estimatedUsd, actual_usd: null, status: "reserved", dry_run: dryRun, would_cost_usd: dryRun ? estimatedUsd : null, local_day: today, created_at: new Date().toISOString() };
      rows.unshift(row);
      return { ok: true, ledger_id: row.id };
    },
    async settle({ ledgerId, actualUsd, status }) { const r = rows.find((x) => x.id === ledgerId); Object.assign(r, { actual_usd: r.dry_run ? 0 : actualUsd, status }); return true; },
    async ledgerSince() { return [...rows]; },
    async audit(email, action, payload) { audit.unshift({ id: audit.length + 1, actor_email: email, action, payload, created_at: new Date().toISOString() }); },
    async auditLog() { return [...audit]; },
  };
}

const OWNER = { id: "owner", email: "upwardlift6@gmail.com", email_confirmed_at: "2026-01-01T00:00:00Z" };
const STRANGER = { id: "x", email: "someone@else.com", email_confirmed_at: "2026-01-01T00:00:00Z" };

async function contextFor(browser, user, viewport, phone) {
  const store = memoryStore();
  const handle = createHandler({ getUser: async () => ({ data: { user }, error: null }), emails: [OWNER.email], store, guard: createBudgetGuard({ store }), cors });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(() => localStorage.setItem("zyvo_cookie_consent", "declined"));
  await ctx.route("https://cm-fake.supabase.co/**", async (route) => {
    const req = route.request();
    if (!req.url().includes("/functions/v1/content-machine-api")) return route.fulfill({ status: 404, body: "{}" });
    const res = await handle(new Request(req.url(), { method: req.method(), headers: req.headers(), body: req.method() === "POST" ? req.postData() : undefined }));
    route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() });
  });
  return ctx;
}

const out = {};
const browser = await chromium.launch();
const ok = (label, pass, extra = "") => { out[label] = pass; console.log(`${pass ? "ok  " : "FAIL"} ${label}${extra ? ` (${extra})` : ""}`); };

// A stranger: the site's 404.
{
  const ctx = await contextFor(browser, STRANGER, { width: 1440, height: 900 }, false);
  const p = await ctx.newPage();
  await p.goto(`${base}/admin/content-machine`, { waitUntil: "domcontentloaded" });
  await p.getByText("Page Not Found").waitFor({ timeout: 45_000 });
  const text = await p.locator("body").innerText();
  ok("a stranger sees Page Not Found and nothing of the machine", !/content machine|kill switch|budget/i.test(text));
  await p.screenshot({ path: path.join(outDir, "stranger-1440.png") });
  await ctx.close();
}

for (const [name, viewport] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
  const phone = name === "390";
  const ctx = await contextFor(browser, OWNER, viewport, phone);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto(`${base}/admin/content-machine`, { waitUntil: "domcontentloaded" });
  await p.locator('[data-testid="cm-topbar"]').waitFor({ timeout: 45_000 });
  await p.getByText("Spend per day").waitFor();
  await p.getByRole("button", { name: "Decline" }).click({ timeout: 3000 }).catch(() => {});   // the cookie note blurs the page
  await p.waitForTimeout(400);
  const bar = (await p.locator('[data-testid="cm-topbar"]').innerText()).replace(/\s+/g, " ");
  ok(`${name}: top bar shows today against the cap and dry run`, /\$1\.52 of \$8\.00/.test(bar) && /Dry run/.test(bar), bar.slice(0, 120));
  ok(`${name}: the warning banner says Anthropic is used up (1.50 of 1.50)`, /anthropic: today.s cap is used up./.test(await p.getByTestId("cm-warning").innerText()));
  await p.screenshot({ path: path.join(outDir, `budget-${name}.png`), fullPage: true });
  ok(`${name}: no sideways scroll on Budget`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));

  // The guard test: $0.10 runware goes, $0.60 slideshow is refused by the lane cap.
  const guard = p.locator("form").filter({ hasText: "Check" });
  await guard.locator('input[aria-label="Estimated cost in dollars"]').fill("0.10");
  await guard.getByRole("button", { name: "Check" }).click();
  await p.getByText("Allowed. A $0 dry-run row").waitFor({ timeout: 10_000 });
  await guard.locator('input[aria-label="Estimated cost in dollars"]').fill("0.60");
  await guard.locator('input[aria-label="Lane"]').fill("slideshow");
  await guard.getByRole("button", { name: "Check" }).click();
  await p.getByText(/Refused: cap for this kind of work/).waitFor({ timeout: 10_000 });
  ok(`${name}: the guard test allows and refuses`, true);

  // Settings: raise slideshows per day, save, see it audited.
  await p.getByRole("button", { name: "Settings", exact: true }).click();
  await p.locator("#cm-slideshows_per_day").fill("6");
  await p.getByTestId("cm-save").click();
  await p.getByRole("status").filter({ hasText: "Saved." }).waitFor({ timeout: 10_000 });
  await p.screenshot({ path: path.join(outDir, `settings-${name}.png`), fullPage: true });
  ok(`${name}: no sideways scroll on Settings`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));

  // The kill switch.
  await p.getByTestId("cm-kill").click();
  await p.getByText("ON: nothing runs").waitFor({ timeout: 10_000 });
  await p.getByRole("button", { name: "Budget", exact: true }).click();
  await p.getByText("kill_switch.on").waitFor({ timeout: 10_000 });
  const log = await p.getByText("What you changed").locator("..").locator("..").innerText();
  ok(`${name}: settings save and kill switch are in the audit log`, /settings\.save/.test(log) && /slideshows_per_day: 5 → 6/.test(log) && /kill_switch\.on/.test(log));
  ok(`${name}: no page errors`, errors.length === 0, errors.join(" | "));
  await ctx.close();
}
await browser.close();
const failed = Object.entries(out).filter(([, v]) => !v);
console.log(failed.length ? `${failed.length} check(s) failed.` : "All page checks passed.");
process.exit(failed.length ? 1 : 0);
