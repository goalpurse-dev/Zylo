import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getWorkspaceRouteSeoPolicy, getNoindexWorkspaceRoutes, getPublicWorkspaceRoutes } from "../src/data/routeSeoPolicy.js";
import { canonicalFor } from "../src/data/publicSeoMetadata.js";
import { DEFAULT_APP_ORIGIN, allowedAppUrl, allowedReturnUrl, appOriginFor, isAllowedAppOrigin, withCheckoutSessionId } from "../supabase/functions/_shared/appOrigins.js";
import { purchaseArrived } from "../src/lib/purchaseArrived.js";

// The payment flow a visitor walks: /pricing (public) → sign-up if needed →
// Stripe Checkout → /billing/success or /billing/cancel, plus the billing portal.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const vercel = JSON.parse(read("vercel.json"));
const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.(jsx?|tsx?)$/.test(e.name) ? [`${dir}/${e.name}`] : []));

test("pricing lives at /pricing: a real route, and the old address 301s to it (server and client)", () => {
  assert.deepEqual(vercel.redirects.filter((r) => r.source === "/workspace/pricing"), [{ source: "/workspace/pricing", destination: "/pricing", statusCode: 301 }]);
  assert.ok(!vercel.redirects.some((r) => r.source === "/pricing"), "/pricing must be served, not redirected");
  const app = read("src/App.jsx");
  assert.match(app, /<Route path="\/pricing" element=\{<Pricing \/>\} \/>/);
  assert.match(app, /<Route path="\/workspace\/pricing" element=\{<OldPricingRedirect \/>\} \/>/);
  assert.match(app, /<Navigate to=\{\{ pathname: "\/pricing", search, hash \}\} replace \/>/);
  // Not behind a login: the route has no RequireAuth around it.
  assert.doesNotMatch(app, /<Route path="\/pricing"[^\n]*RequireAuth/);
});

test("no internal link still points at /workspace/pricing", () => {
  const allowed = new Set([
    "src/App.jsx",                                  // the redirect route
    "src/lib/api/send-abandoned-emails.js",         // old e-mail HTML with absolute URLs: the 301 carries them
    "src/pages/workspace/long-form/teaser.jsx",     // not part of this change; reaches /pricing through the redirect
  ]);
  const left = walk("src").filter((f) => !allowed.has(f) && /["'`]\/workspace\/pricing["'`?#]/.test(read(f)));
  assert.deepEqual(left, []);
  // The pages named in the audit link straight to /pricing.
  for (const f of ["src/pages/billing/Cancel.jsx", "src/components/layout/ToolShell.jsx", "src/components/Navbar.jsx", "src/components/DownFooter.jsx", "src/pages/workspace/ThirtyDays.jsx", "src/pages/viral/ViralScore.jsx", "src/components/VideoGenerator/Generate.jsx", "src/pages/brands/BrandWorkspace.jsx"]) {
    assert.match(read(f), /["'`]\/pricing["'`]/, `${f} links to /pricing`);
  }
});

test("SEO: /pricing is public, has its own title, description and canonical, is in the sitemap and not blocked", () => {
  const policy = getWorkspaceRouteSeoPolicy("/pricing");
  assert.equal(policy.seoVisibility, "public");
  assert.ok(policy.title.startsWith("Zyvo AI Pricing") && policy.title.length <= 60, policy.title);
  assert.ok(policy.description.length >= 80 && policy.description.length <= 160, String(policy.description.length));
  assert.equal(canonicalFor("/pricing"), "https://www.tryzyvo.com/pricing");
  assert.ok(getPublicWorkspaceRoutes().some((p) => p.path === "/pricing"));
  assert.equal(getWorkspaceRouteSeoPolicy("/workspace/pricing"), null);
  assert.ok(!getNoindexWorkspaceRoutes().some((p) => p.path === "/pricing" || p.path === "/workspace/pricing"));
  const sitemap = read("public/sitemap.xml");
  assert.match(sitemap, /<loc>https:\/\/www\.tryzyvo\.com\/pricing<\/loc>/);
  assert.ok(!sitemap.includes("/workspace/pricing"), "a redirect source is never in the sitemap");
  const robots = read("public/robots.txt");
  assert.ok(!/^Disallow: \/(pricing|workspace)?\/?\r?$/m.test(robots), "robots.txt must not block /pricing");
  // The page takes its title from the policy (same as the prerendered HTML).
  assert.ok(!/document\.title\s*=/.test(read("src/pages/Pricing.jsx")));
  assert.match(read("src/pages/workspace/layout.jsx"), /"\/pricing": "Pricing"/);
});

test("monthly is the default billing everywhere, and yearly shows its full total", () => {
  for (const f of ["src/pages/Pricing.jsx", "src/components/viral-tools/ai-fruit-story/FruitStoryPaywall.jsx", "src/components/viral-tools/face-asmr/FaceAsmrPaywall.jsx", "src/components/viral-tools/two-am/TwoAmPaywall.jsx"]) {
    const src = read(f);
    assert.match(src, /useState\("monthly"\)/, `${f} starts on monthly`);
    assert.doesNotMatch(src, /useState\("yearly"\)/, `${f} must not start on yearly`);
  }
  assert.match(read("src/components/pricing/useLivePlanPrices.js"), /billed yearly`/);
  const cards = read("src/components/pricing/PlanCards.jsx");
  assert.match(cards, /data-testid="yearly-total"/);
  assert.match(cards, /\{yearlyTotal && !account\.hasSub && /, "the button repeats the yearly total");
});

test("price ids come from the shared map only", () => {
  for (const f of [
    "src/components/viral-tools/ai-fruit-story/FruitStoryPaywall.jsx",
    "src/components/viral-tools/face-asmr/FaceAsmrPaywall.jsx",
    "src/components/viral-tools/two-am/TwoAmPaywall.jsx",
    "src/components/EmailConsentModal.jsx",
    "src/lib/payments.ts",
    "supabase/functions/create-checkout-session/index.ts",
  ]) assert.doesNotMatch(read(f), /price_1[A-Za-z0-9]{10,}/, `${f} has a typed price id`);
  assert.match(read("src/lib/payments.ts"), /import \{ PLAN_PRICE_IDS \} from "\.\.\/\.\.\/supabase\/functions\/_shared\/stripePlanPrices\.js"/);
});

test("every purchase button has a busy state, one lock and an error toast", () => {
  const hook = read("src/hooks/usePaymentAction.js");
  assert.match(hook, /if \(lock\.current\) return;/, "a second click is ignored");
  assert.match(hook, /toast\.error\(paymentErrorMessage\(e\)\)/);
  assert.match(hook, /pageshow/, "buttons unlock when the page is restored with Back");
  for (const f of ["src/components/pricing/PlanCards.jsx", "src/components/pricing/PricingExtras.jsx", "src/components/pricing/OutputTables.jsx", "src/components/pricing/PlanFinder.jsx"]) {
    assert.match(read(f), /pay\.run\(/, `${f} runs purchases through the page's payment lock`);
  }
  for (const f of ["src/components/viral-tools/ai-fruit-story/FruitStoryPaywall.jsx", "src/components/viral-tools/face-asmr/FaceAsmrPaywall.jsx", "src/components/viral-tools/two-am/TwoAmPaywall.jsx"]) {
    const src = read(f);
    assert.match(src, /usePaymentAction\(\)/);
    assert.equal((src.match(/disabled=\{pay\.busy != null\}/g) || []).length, 2, `${f}: both plan buttons lock`);
  }
  assert.match(read("src/components/EmailConsentModal.jsx"), /toast\.error\(paymentErrorMessage\(err\)\)/);
  // The helpers throw instead of failing quietly.
  const payments = read("src/lib/payments.ts");
  assert.match(payments, /throw new PaymentError\("PORTAL"\)/);
  assert.doesNotMatch(payments, /console\.error\("Portal error:", data\);\s*return;/);
});

test("a plan picked while logged out survives sign-up", () => {
  const payments = read("src/lib/payments.ts");
  assert.match(payments, /saveCheckoutIntent\(checked\);\s*window\.location\.href = "\/signup";/);
  const resume = read("src/components/billing/ResumeCheckout.jsx");
  assert.match(resume, /takeCheckoutIntent\(\)/);
  assert.match(resume, /startCheckout\(intent, \{ resumed: true \}\)/);
  assert.match(read("src/App.jsx"), /<ResumeCheckout \/>/);
});

test("Stripe may only return to our own site", () => {
  assert.equal(DEFAULT_APP_ORIGIN, "https://www.tryzyvo.com");
  for (const ok of ["https://www.tryzyvo.com", "https://tryzyvo.com", "http://localhost:5173", "http://127.0.0.1:4173"]) assert.equal(isAllowedAppOrigin(ok), true, ok);
  for (const bad of ["https://evil.com", "https://tryzyvo.com.evil.com", "http://tryzyvo.com", "https://zylo.ai", "https://www.tryzyvo.com.evil.io", "http://localhost.evil.com", ""]) assert.equal(isAllowedAppOrigin(bad), false, bad);
  assert.equal(isAllowedAppOrigin("https://preview.example.com", ["https://preview.example.com"]), true);

  assert.equal(allowedAppUrl("https://www.tryzyvo.com/billing/success"), "https://www.tryzyvo.com/billing/success");
  assert.equal(allowedAppUrl("https://www.tryzyvo.com/long-form/create?start=1&teaser=abc"), "https://www.tryzyvo.com/long-form/create?start=1&teaser=abc");
  for (const bad of ["https://evil.com/billing/success", "//evil.com/x", "/billing/success", "javascript:alert(1)", "https://www.tryzyvo.com@evil.com/x", undefined, null, 42]) assert.equal(allowedAppUrl(bad), null, String(bad));

  assert.equal(appOriginFor("https://tryzyvo.com"), "https://tryzyvo.com");
  assert.equal(appOriginFor("https://evil.com"), "https://www.tryzyvo.com");
  assert.equal(appOriginFor(""), "https://www.tryzyvo.com");

  assert.equal(withCheckoutSessionId("https://www.tryzyvo.com/billing/success"), "https://www.tryzyvo.com/billing/success?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(withCheckoutSessionId("https://www.tryzyvo.com/long-form/create?start=1"), "https://www.tryzyvo.com/long-form/create?start=1&session_id={CHECKOUT_SESSION_ID}");
  assert.equal(withCheckoutSessionId("https://www.tryzyvo.com/a?session_id={CHECKOUT_SESSION_ID}"), "https://www.tryzyvo.com/a?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(withCheckoutSessionId("https://www.tryzyvo.com/a#top"), "https://www.tryzyvo.com/a?session_id={CHECKOUT_SESSION_ID}#top");

  const paths = ["/settings", "/pricing", "/"];
  const o = "https://www.tryzyvo.com";
  assert.equal(allowedReturnUrl("/settings?tab=billing&from=portal", o, paths, "/settings"), `${o}/settings?tab=billing&from=portal`);
  assert.equal(allowedReturnUrl("/pricing", o, paths, "/settings"), `${o}/pricing`);
  for (const bad of ["/settings/billing?from=portal", "//evil.com/settings", "https://evil.com/settings", "/\\evil.com", "settings", undefined, null]) {
    assert.equal(allowedReturnUrl(bad, o, paths, "/settings"), `${o}/settings`, String(bad));
  }
});

test("create-checkout-session: identity from the session only, dead customer replaced, one subscription, own-site URLs", () => {
  const src = read("supabase/functions/create-checkout-session/index.ts");
  assert.match(src, /const \{ type, priceId, pack, successUrl, cancelUrl \} = await req\.json\(\)/, "no customer / userId / email read from the browser");
  assert.doesNotMatch(src, /bodyUserId|bodyEmail|customer_email/);
  assert.match(src, /PLAN_PRICES_ON_SALE\.has\(priceId\)/, "only today's plan prices are sold");
  assert.match(src, /isMissingCustomer\(session\.data\) && !customerIsNew/, "No such customer → new customer, one retry");
  assert.match(src, /code: "ALREADY_SUBSCRIBED"/);
  assert.match(src, /new Set\(\["active", "trialing", "past_due"\]\)/);
  assert.match(src, /withCheckoutSessionId\(allowedAppUrl\(successUrl, EXTRA_ORIGINS\) \?\? `\$\{appOrigin\}\/billing\/success`\)/);
  assert.match(src, /allowedAppUrl\(cancelUrl, EXTRA_ORIGINS\) \?\? `\$\{appOrigin\}\/billing\/cancel`/);
  assert.doesNotMatch(src, /details: stripeJson|abandoned_checkouts/, "no raw Stripe payload to the browser; recovery tracking is a separate deploy");
});

test("create-portal-session: no Stripe write per open, flows respected, return URL allowlisted", () => {
  const src = read("supabase/functions/create-portal-session/index.ts");
  assert.doesNotMatch(src, /enforceProductMode|billing_portal\/configurations\/|zylo\.ai/);
  assert.match(src, /change_plan: "subscription_update"/);
  assert.match(src, /payment_method: "payment_method_update"/);
  assert.match(src, /allowedReturnUrl\(returnPath, origin, RETURN_PATHS, DEFAULT_RETURN_PATH\)/);
  const billing = read("src/pages/settings/Billing.jsx");
  assert.match(billing, /openPortal\("payment_method"\)/);
  assert.match(billing, /openPortal\("home"\)/);
  assert.doesNotMatch(billing, /— \$\s/, "no hardcoded $ on invoices");
  assert.match(billing, /formatMoney\(inv\.amount_paid \/ 100, inv\.currency \|\|/);
  assert.match(read("supabase/functions/billing-summary/index.ts"), /currency: i\.currency,/);
});

test("success page: waits for the plan and the credits; cancel page says nothing was charged", () => {
  const before = { kind: "subscription", credits: 20 };
  assert.equal(purchaseArrived({ plan_code: "free", credit_balance: 20 }, before), false);
  assert.equal(purchaseArrived({ plan_code: "starter", credit_balance: 20 }, before), false, "plan set, credits still on the way");
  assert.equal(purchaseArrived({ plan_code: "starter", credit_balance: 770 }, before), true);
  assert.equal(purchaseArrived({ plan_code: "Starter", credit_balance: 770 }, { kind: "subscription", credits: null }), true);
  assert.equal(purchaseArrived({ plan_code: "free", credit_balance: 0 }, { kind: "subscription", credits: null }), false);
  const pack = { kind: "topup", credits: 100 };
  assert.equal(purchaseArrived({ plan_code: "starter", credit_balance: 100 }, pack), false);
  assert.equal(purchaseArrived({ plan_code: "starter", credit_balance: 400 }, pack), true);
  assert.equal(purchaseArrived({ plan_code: "starter", credit_balance: 400 }, { kind: "topup", credits: null }), null);
  assert.equal(purchaseArrived({ plan_code: "pro", credit_balance: 5 }, null), true);
  assert.equal(purchaseArrived({ plan_code: "free", credit_balance: 5 }, null), null);

  const success = read("src/pages/billing/Success.jsx");
  assert.match(success, /SLOW_AFTER_MS = 30000/);
  assert.match(success, /Activating your plan…/);
  assert.match(success, /SUPPORT_EMAIL/);
  assert.match(success, /params\.get\("session_id"\)/);
  const cancel = read("src/pages/billing/Cancel.jsx");
  assert.match(cancel, /you weren&apos;t charged/);
  assert.match(cancel, /<Link to="\/pricing"/);
  assert.doesNotMatch(cancel, /❌|didn’t go through|didn't go through/);
});

test("past due: a notice with an Update card button on every app page", () => {
  const notice = read("src/components/billing/PastDueNotice.jsx");
  assert.match(notice, /if \(!account\.pastDue\) return null;/);
  assert.match(notice, /openBillingPortal\(\{ flow: "payment_method"/);
  assert.match(read("src/pages/workspace/layout.jsx"), /<PastDueNotice \/>/);
  const hook = read("src/hooks/usePlanCode.js");
  assert.match(hook, /pastDue: hasSub && status === "past_due"/);
  assert.match(hook, /stripe_subscription_status/);
});
