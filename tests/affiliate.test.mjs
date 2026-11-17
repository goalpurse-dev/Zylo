// The affiliate program: the rules file, the pure helpers, and the wiring the brief asks for (nav, survey,
// webhook). The money flow itself runs end to end in scripts/affiliate/e2e.mjs (real SQL, offline) and
// tests/stripe-webhook/simulate.ts (section 15).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AFFILIATE } from "../supabase/functions/_shared/affiliate/config.js";
import { activityText, ago, availableAt, cleanCode, codeCandidates, codeProblem, commissionFor, dailySeries, eur, hashIp, pct, publicName } from "../supabase/functions/_shared/affiliate/rules.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the brief's business rules are the config's defaults", () => {
  assert.equal(AFFILIATE.cashRate, 0.2);
  assert.equal(AFFILIATE.creditRate, 0.4);
  assert.equal(AFFILIATE.creditValueEur, 0.02);
  assert.equal(AFFILIATE.holdDays, 30);
  assert.equal(AFFILIATE.minCashPayoutEur, 25);
  assert.equal(AFFILIATE.signupBonusCredits, 5);
  assert.equal(AFFILIATE.refStorageDays, 60);
  assert.deepEqual([AFFILIATE.codeMinLength, AFFILIATE.codeMaxLength], [3, 20]);
  for (const w of ["zyvo", "admin", "support", "free"]) assert.ok(AFFILIATE.reservedCodes.includes(w), w);
});

test("codes: A-Z/0-9, 3-20, reserved words refused", () => {
  assert.equal(cleanCode("  Mäyä_K-99! "), "MAYAK99");
  assert.equal(cleanCode("x".repeat(30)).length, 20);
  assert.equal(codeProblem("AB"), "too_short");
  assert.equal(codeProblem("ZYVO"), "reserved");
  assert.equal(codeProblem("FREE"), "reserved");
  assert.equal(codeProblem("ZYVOFAN"), "reserved", "the brand inside a code");
  assert.equal(codeProblem("SUPPORTDESK"), "reserved");
  assert.equal(codeProblem("MAYA"), null);
  assert.equal(codeProblem("MA YA"), "invalid");
});

test("default code = the user's name, then email, then numbered, never reserved", () => {
  const c = codeCandidates({ fullName: "Maya Korhonen", email: "mk@x.com", userId: "0a1b2c3d-0000-4000-8000-000000000000" });
  assert.equal(c[0], "MAYAKORHONEN");
  assert.ok(c.includes("MAYA"));
  assert.ok(c.every((x) => !codeProblem(x)));
  const admin = codeCandidates({ fullName: "Admin", email: "admin@x.com", userId: "ff00ff00-0000-4000-8000-000000000000" });
  assert.ok(admin.length > 0 && admin.every((x) => !codeProblem(x)), "a reserved name still gets a usable code");
  assert.equal(publicName({ fullName: "maya korhonen" }, "MAYA"), "maya");
  assert.equal(publicName({ fullName: "" }, "MAYA"), "MAYA", "no name: the code, never the email");
});

test("commission math: 20% cash, 40% credits at €0.02", () => {
  assert.deepEqual(commissionFor({ amountCents: 3800, type: "cash", cashRate: 0.2 }), { type: "cash", amountCents: 760, credits: 0 });
  assert.deepEqual(commissionFor({ amountCents: 3800, type: "credits", creditRate: 0.4 }), { type: "credits", amountCents: 1520, credits: 760 });
  assert.equal(availableAt("2026-11-01T00:00:00Z"), "2026-12-01T00:00:00.000Z");
  // the page's example: 10 × Pro €38
  assert.equal(10 * 38 * AFFILIATE.cashRate, 76);
  assert.equal(10 * 38 * AFFILIATE.creditRate, 152);
});

test("feed and chart carry no personal data; formatting", () => {
  assert.equal(activityText({ kind: "signup" }), "New sign-up");
  assert.equal(activityText({ kind: "buyer", plan: "pro", cents: 760, type: "cash", status: "pending" }), "New buyer · Pro · +€7.60 pending");
  assert.equal(activityText({ kind: "buyer", plan: "pro", credits: 760, type: "credits", status: "paid" }), "New buyer · Pro · +760 credits added");
  assert.equal(eur(2500), "€25");
  assert.equal(pct(1, 3), "33%");
  assert.equal(pct(1, 0), "–");
  const now = Date.parse("2026-11-17T12:00:00Z");
  assert.equal(ago("2026-11-17T10:00:00Z", now), "2h ago");
  assert.equal(ago("2026-11-16T10:00:00Z", now), "yesterday");
  const s = dailySeries([{ kind: "signup", at: "2026-11-17T01:00:00Z" }, { kind: "buyer", at: "2026-11-17T02:00:00Z" }, { kind: "signup", at: "2026-01-01T00:00:00Z" }], 30, now);
  assert.equal(s.length, 30);
  assert.deepEqual(s.at(-1), { day: "2026-11-17", signups: 1, buyers: 1 });
  assert.equal(s.reduce((a, d) => a + d.signups, 0), 1, "older than 30 days is left out");
});

test("IPs are hashed, never kept raw", async () => {
  const h = await hashIp("203.0.113.9", "salt");
  assert.match(h, /^[0-9a-f]{40}$/);
  assert.ok(!h.includes("203"));
  assert.notEqual(h, await hashIp("203.0.113.9", "other"));
});

test("navigation: sidebar Affiliate + Earn badge; mobile Home · Short · Long · Tools · More", () => {
  const shell = read("src/components/workspace/toolshell.jsx");
  assert.match(shell, /label="Affiliate"\s+earn/);
  const nav = read("src/components/workspace/MobileBottomNav.jsx");
  const names = [...nav.matchAll(/<NavItem\s+name="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(names, ["Home", "Short", "Long", "Tools", "More"]);
  assert.match(nav, /label: "Creations".*path: "\/workspace\/creations"/);
  assert.match(nav, /label: "Affiliate".*earn: true/);
  assert.match(nav, /active=\{moreOpen \|\| \(!anyMenuOpen && moreRouteActive\)\}/, "More is active on Creations and Affiliate");
});

test("survey: the creator-code step, skippable, prefilled from the link; typed code wins", () => {
  const step = read("src/components/onboarding/CreatorCodeStep.jsx");
  assert.match(step, /Which creator sent you\?/);
  assert.match(step, /useState\(stored\.current \?\? ""\)/, "prefilled from the ?ref link");
  assert.match(step, /data-testid="creator-code-skip"/);
  assert.match(step, /const source = stored\.current && stored\.current === code \? "link" : "code"/);
  const survey = read("src/components/onboarding/OnboardingSurvey.jsx");
  assert.match(survey, /4: <CreatorCodeStep/);
});

test("the webhook: commission on the first payment, reversal on refund/dispute, skipped if not installed", () => {
  const hook = read("supabase/functions/stripe-webhook/index.ts");
  assert.match(hook, /affiliate_record_payment/);
  assert.match(hook, /type === "charge\.refunded" \|\| type === "charge\.dispute\.created"/);
  assert.match(hook, /NOT_INSTALLED = \["42883", "PGRST202", "42P01", "PGRST205"\]/);
  const sql = read("supabase/migrations/20261217100000_affiliate_program.sql");
  assert.match(sql, /referred_user_id  uuid not null unique/, "one commission per referred user");
  assert.match(sql, /payment_id        text not null unique/, "idempotent on payment id");
  assert.match(sql, /revoke all on public\.affiliates, public\.referral_clicks, public\.referrals, public\.commissions, public\.payouts from public, anon, authenticated/);
});

test("no page links to the old Creations slot by position; /affiliate reaches the app shell", () => {
  const vercel = JSON.parse(read("vercel.json"));
  assert.ok(vercel.rewrites.some((r) => r.source === "/affiliate" && r.destination === "/app-shell"));
  assert.match(read("src/App.jsx"), /<Route path=\{AFFILIATE_PATH\}/);
  assert.match(read("src/App.jsx"), /<Route path="\/admin\/affiliates"/);
});
