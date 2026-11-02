// The new-user flow: the free preview's rules, the worker's cut, and the guarantees that live in code and SQL.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PREVIEW, cliffhangerLine, previewDecision, topicsForGoals } from "../supabase/functions/_shared/cutaway/freePreview.js";
import { SIGNUP_BONUS, signupBonusEmailLine, signupBonusFor, signupBonusLine, signupBonusTimeLeft } from "../supabase/functions/_shared/signupBonus.js";
import { failOrRetry, onEvent } from "../supabase/functions/_shared/cutaway/orchestrate.js";
import { jobFor } from "../supabase/functions/_shared/cutaway/jobs.js";
import { previewCutSec } from "../scripts/cutaway/proto3d/m3/previewCut.mjs";

const read = (f) => readFileSync(f, "utf8");
const allowed = { switchOn: true, enrolled: true, plan: "free", existing: null, ipCount: 0, deviceCount: 0, spent24h: 0, capUsd: 10, hasPlan: true };

test("the localhost test: dev server only, a walk-through only, no real survey or welcome email", () => {
  const lib = read("src/lib/onboarding.js"), gate = read("src/components/onboarding/OnboardingGate.jsx");
  assert.match(lib, /import\.meta\.env\.DEV && import\.meta\.env\.VITE_ONBOARDING_LOCAL_TEST === "1" && \["localhost", "127\.0\.0\.1"\]/);
  assert.match(lib, /if \(localOnboardingTest\(\)\) return "demo";/);
  assert.match(lib, /if \(localOnboardingTest\(\)\) return Promise\.resolve\(\{ enrolled: true, surveyDone: true \}\)/);
  assert.match(gate, /if \(!userId \|\| loading \|\| localOnboardingTest\(\)\) return;\s+const age/);
  assert.match(read("src/pages/onboarding/FirstVideo.jsx"), /const paidReturn = !demo && /);
  assert.match(read(".gitignore"), /^\.env\.local\s*$/m);
});

test("the lock's cliffhanger is a real line of the script they haven't heard yet", () => {
  const script = "If you dig a pit and throw your trash in, you have a landfill. But dirty trash juice leaks straight down into the groundwater you drink. So you lay a thick clay base, but it is still not enough. You add a thick black plastic sheet. This is a landfill liner.";
  assert.equal(cliffhangerLine(script), "You add a thick black plastic sheet.");
  assert.equal(cliffhangerLine("Too short."), "");
  assert.equal(cliffhangerLine(null), "");
});

test("the survey has no emojis; the real logos are its only brand marks", () => {
  const survey = read("src/components/onboarding/OnboardingSurvey.jsx");
  assert.doesNotMatch(survey, /\p{Extended_Pictographic}/u);
  for (const brand of ["tiktok", "instagram", "youtube", "google"]) assert.match(survey, new RegExp(`brand: "${brand}"`));
});

test("the plan screen: one number sets its length, and it fetches the real topics for their answers", () => {
  const plan = read("src/components/onboarding/BuildingPlan.jsx");
  assert.match(plan, /export const PLAN_SCREEN_SECONDS = 10;/);
  assert.match(plan, /demoStateFor\(goals\)/);
  assert.match(plan, /cutawayServer\.freePreviewState\(/);
  assert.match(plan, /if \(!s\?\.topics\?\.length\) \{ done\.current\(\); return; \}/, "no videos on offer: no pretending");
  const survey = read("src/components/onboarding/OnboardingSurvey.jsx");
  assert.match(survey, /if \(!skipped && withPlan\) setBuilding\(true\); else onDone/);
});

test("the sign-up bonus: their own 3 days, first plan only, judged by the payment time", () => {
  const paidAt = "2026-11-10T12:00:00Z", base = { billingReason: "subscription_create", planAfter: "starter", planBefore: "free", paidAt, expiresAt: "2026-11-11T12:00:00Z" };
  assert.equal(signupBonusFor(base).eligible, true);
  assert.equal(signupBonusFor({ ...base, billingReason: "subscription_update", planBefore: "free" }).eligible, true);
  assert.equal(signupBonusFor({ ...base, expiresAt: "2026-11-10T11:59:59Z" }).eligible, false, "ended before the payment");
  assert.equal(signupBonusFor({ ...base, expiresAt: paidAt }).eligible, false, "ends exactly then");
  assert.equal(signupBonusFor({ ...base, expiresAt: null }).eligible, false, "an older account has none");
  assert.equal(signupBonusFor({ ...base, planBefore: "starter" }).eligible, false, "not their first plan");
  assert.equal(signupBonusFor({ ...base, billingReason: "subscription_cycle" }).eligible, false, "a renewal");
  assert.equal(signupBonusFor({ ...base, planAfter: null }).eligible, false, "a credit pack");
});

test("the sign-up bonus line says the real time left and stops at the end", () => {
  const end = "2026-11-05T12:00:00Z", at = (h, m = 0) => Date.parse(end) - h * 3600000 - m * 60000;
  assert.equal(signupBonusLine(end, at(62)), "Your sign-up bonus: +50 credits, ends in 2 days 14 h");
  assert.equal(signupBonusTimeLeft(end, at(25)), "1 day 1 h");
  assert.equal(signupBonusTimeLeft(end, at(5, 12)), "5 h 12 min");
  assert.equal(signupBonusTimeLeft(end, at(0, 12)), "12 min");
  assert.equal(signupBonusLine(end, at(0)), null);
  assert.equal(signupBonusLine(end, at(-1)), null);
  assert.equal(signupBonusLine(null), null);
  assert.ok(signupBonusEmailLine(end, at(30)).includes("+50"));
  assert.equal(signupBonusEmailLine(end, at(-1)), null);
});

test("the sign-up bonus is stored per account, read by the webhook and never revives the old offer", () => {
  const sql = read("supabase/migrations/20261130110000_signup_bonus_and_creator_count.sql"), hook = read("supabase/functions/stripe-webhook/index.ts");
  assert.match(sql, new RegExp(`interval '${SIGNUP_BONUS.days} days'`), "the database and the shared file agree");
  assert.match(sql, /after insert on auth\.users/);
  assert.match(sql, /exception when others then/, "a problem must never stop a sign-up");
  assert.match(sql, /grant select on public\.signup_bonuses to authenticated/);
  assert.doesNotMatch(sql, /grant (all|insert|update|delete)[^;]*signup_bonuses/i, "only the server writes it");
  assert.match(hook, /sb\.from\("signup_bonuses"\)\.select\("expires_at"\)\.eq\("user_id", userId\)/);
  assert.match(hook, /p_offer_id: SIGNUP_BONUS\.id, p_credits: SIGNUP_BONUS\.credits/);
  assert.match(hook, /paidAt: paidAtIso, expiresAt: row\.data\?\.expires_at/);
  assert.equal(read("supabase/functions/_shared/offer.js").includes('endsAt: "2026-11-01T21:59:59.999Z"'), true, "the old offer stays ended");
  assert.doesNotMatch(read("src/components/onboarding/UpgradeScreen.jsx"), /useOffer/);
});

test("no VAT claims on any page: not VAT-registered", () => {
  for (const f of ["src/components/onboarding/UpgradeScreen.jsx", "src/components/onboarding/ComparePlansSheet.jsx", "src/pages/onboarding/FirstVideo.jsx", "src/pages/workspace/long-form/teaser.jsx", "src/data/stickmanLandingPages.js"]) {
    assert.doesNotMatch(read(f), /\bVAT\b|vatIncluded/, f);
  }
});

test("the survey's logos sit on the same tile as every other answer", () => {
  const survey = read("src/components/onboarding/OnboardingSurvey.jsx");
  assert.match(survey, /<IconTile icon=\{icon\} brand=\{brand\} picked=\{picked\} \/>/);
  assert.doesNotMatch(read("src/components/onboarding/brandLogos.jsx"), /bg-white/);
  assert.match(read("src/components/onboarding/BuildingPlan.jsx"), /Finding the best first video for you\.\.\./);
});

test("the sign-up panel's number is real: rounded by the database, never above what it says", () => {
  assert.match(read("supabase/migrations/20261130110000_signup_bonus_and_creator_count.sql"), /\(count\(\*\) \/ 1000\) \* 1000/);
  assert.match(read("src/lib/creatorCount.js"), /supabase\.rpc\("public_creator_count"\)/);
});

test("compare plans uses live data; phones keep one sticky button", () => {
  const sheet = read("src/components/onboarding/ComparePlansSheet.jsx"), up = read("src/components/onboarding/UpgradeScreen.jsx");
  assert.match(sheet, /useLongFormTiers\(\)/);
  assert.match(sheet, /plan\.credits/);
  assert.match(sheet, /plan\.modelAccess\[plan\.modelAccess\.length - 1\]/);
  assert.match(sheet, /prices\.prices\?\.plans\?\.\[id\]\?\.monthly/);
  assert.doesNotMatch(sheet, /€|\b(750|1,?600|3,?200)\b/, "no typed-in prices or credits");
  assert.match(up, /fixed inset-x-0 bottom-0 z-40[^"]*md:static/);
  assert.match(up, /className="ob-fade /, "a transform here would pin the sticky button to the section");
});

test("the upgrade screen: no discount or countdown, a real way out", () => {
  const up = read("src/components/onboarding/UpgradeScreen.jsx");
  assert.doesNotMatch(up, /30%|% off|countdown/i);
  assert.match(up, /Explore Zyvo first/);
  assert.match(up, /Your video finishes right after payment\./);
  assert.match(up, /choose\(RECOMMENDED_PLAN\)/);
});

test("a walk-through never reaches Stripe or a render", () => {
  const up = read("src/components/onboarding/UpgradeScreen.jsx"), page = read("src/pages/onboarding/FirstVideo.jsx");
  assert.match(up, /adminLook \? setAdminNote\(true\) : pay\.run\(/);
  assert.match(page, /<UpgradeScreen run=\{run\} adminLook=\{Boolean\(adminMode\)\}/);
  assert.match(page, /const paidReturn = !demo && /);
});

test("a free preview needs the switch and the rollout", () => {
  assert.equal(previewDecision(allowed).ok, true);
  assert.equal(previewDecision({ ...allowed, switchOn: false }).code, "OFF");
  assert.equal(previewDecision({ ...allowed, enrolled: false }).code, "OFF");
});

test("one per account; a failed one is given back; paid plans make full videos", () => {
  assert.equal(previewDecision({ ...allowed, existing: { status: "ready" } }).code, "PREVIEW_USED");
  assert.equal(previewDecision({ ...allowed, existing: { status: "reserved" } }).code, "PREVIEW_USED");
  assert.equal(previewDecision({ ...allowed, existing: { status: "failed" } }).ok, true);
  assert.equal(previewDecision({ ...allowed, plan: "starter" }).code, "UPGRADE");
});

test("2 per network or browser in the window, and its own daily cap", () => {
  assert.equal(previewDecision({ ...allowed, ipCount: PREVIEW.ipLimit - 1 }).ok, true);
  assert.equal(previewDecision({ ...allowed, ipCount: PREVIEW.ipLimit }).code, "PREVIEW_LIMIT");
  assert.equal(previewDecision({ ...allowed, deviceCount: PREVIEW.deviceLimit }).code, "PREVIEW_LIMIT");
  assert.equal(previewDecision({ ...allowed, spent24h: 9.99 }).code, "BUSY");
  assert.equal(PREVIEW.ipLimit, 2);
});

test("the survey's first answer orders the topics, three of the approved ones", () => {
  assert.deepEqual(topicsForGoals(["business"]), ["car_wash", "swimming_pool", "french_drain"]);
  assert.deepEqual(topicsForGoals([]), ["landfill", "car_wash", "swimming_pool"]);
  assert.equal(topicsForGoals(["faceless", "business"])[0], "landfill");
});

test("the clip stops at the end of a word, about 10 s in", () => {
  const words = [{ w: "a", s: 8.2, e: 8.9 }, { w: "b", s: 9, e: 10.4 }, { w: "c", s: 10.5, e: 12 }];
  assert.equal(previewCutSec(words, 10), 10.55);
  assert.equal(previewCutSec([], 10), 10.15);
  assert.ok(previewCutSec([{ e: 40 }], 10) >= 8);
});

test("a preview's job asks for the first seconds only and has no full file", () => {
  const urls = { planGet: { layout: "x" }, frames: [], final: "F", web: "W", poster: "P" };
  const run = { id: "r", user_id: "u", topic: "t", length_sec: 30, kind: "premade", plan_ready: true, free_preview: true };
  const job = jobFor(run, { role: "video", mode: "gpu", urls, callback: { url: "c", token: "t" } });
  assert.equal(job.previewSec, PREVIEW.seconds);
  assert.equal(job.out.final, undefined);
  assert.equal(job.out.web, "W");
  const full = jobFor({ ...run, free_preview: false }, { role: "video", mode: "gpu", urls, callback: { url: "c", token: "t" } });
  assert.equal(full.previewSec, undefined);
  assert.equal(full.out.final, "F");
});

test("a failed free preview never reaches the CPU fallback, and is given back", () => {
  const run = { id: "r", topic: "t", status: "render", provider: "runpod", provider_job_id: "j", attempt: 2, free_preview: true };
  const r = failOrRetry(run, { code: "NO_GPU_SLOT", message: "no GPU" });
  assert.equal(r.patch.status, "failed");
  assert.ok(r.actions.some((a) => a.type === "releasePreview"));
  assert.equal(r.patch.provider, undefined);
  const paying = failOrRetry({ ...run, free_preview: false }, { code: "NO_GPU_SLOT", message: "no GPU" });
  assert.equal(paying.patch.provider, "fly", "a paying customer's video keeps its fallback");
});

test("finishing reports to the funnel: the preview ready, and the gift video done", () => {
  const base = { id: "r", status: "render", attempt: 1, provider: "runpod" };
  assert.ok(onEvent({ ...base, free_preview: true }, { event: "done", attempt: 1 }).actions.some((a) => a.type === "previewDone"));
  assert.ok(onEvent({ ...base, gift_finish: true }, { event: "done", attempt: 1 }).actions.some((a) => a.type === "finishDone"));
  assert.ok(!onEvent(base, { event: "done", attempt: 1 }).actions.some((a) => ["previewDone", "finishDone"].includes(a.type)));
});

test("the database: one preview per account on the server, consent never turned off, events the browser can't fake", () => {
  const sql = read("supabase/migrations/20261130100000_onboarding_first_video.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.cutaway_free_previews \(\s*user_id\s+uuid PRIMARY KEY/);
  assert.match(sql, /REVOKE ALL ON public\.cutaway_free_previews FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /UPDATE public\.profiles SET email_updates = false WHERE id = v_user AND email_updates IS NULL/);
  const browserList = sql.match(/IF p_event NOT IN \(([^)]*)\)/)[1];
  for (const server of ["preview_generated", "upgraded", "full_video_completed_after_upgrade"]) assert.ok(!browserList.includes(server), `${server} comes from the server only`);
  for (const e of ["signed_up", "survey_answer", "survey_completed", "survey_skipped", "tutorial_started", "tutorial_step_completed", "preview_watched_to_end", "tutorial_skipped", "upgrade_screen_shown"]) assert.ok(browserList.includes(e), e);
  assert.match(sql, /rollout_percent\s+integer NOT NULL DEFAULT 0/);
  assert.match(sql, /free_preview_on\s+boolean NOT NULL DEFAULT false/);
});

test("the page: the free line at step 1, a tap for sound, no download on the preview", () => {
  const page = read("src/pages/onboarding/FirstVideo.jsx");
  assert.match(page, /free 10-second preview/);
  assert.match(page, /Tap for sound/);
  assert.match(page, /Your video is finished 🎉/);
  assert.match(page, /controlsList="nodownload"/);
  const runtime = read("supabase/functions/_shared/cutaway/runtime.ts");
  assert.match(runtime, /downloadUrl: done && !run\.free_preview/);
  assert.match(runtime, /credits_charged: 0/);
});

test("every sign-up route is named, the welcome email has one trigger, and consent can't turn someone off", () => {
  assert.match(read("src/components/AuthModal.jsx"), /rememberSignupRoute\(signupRoute\("google"\)\)/);
  assert.match(read("src/components/AuthModal.jsx"), /rememberSignupRoute\(signupRoute\("email"\)\)/);
  assert.match(read("src/pages/Signup.jsx"), /signup_page_email/);
  assert.match(read("src/pages/Signup.jsx"), /signup_page_google/);
  assert.match(read("src/components/onboarding/OnboardingGate.jsx"), /send-welcome-email/);
  assert.doesNotMatch(read("src/lib/auth.js"), /functions\.invoke\("send-welcome-email"/);
  assert.doesNotMatch(read("src/components/WelcomeScreen.jsx"), /update\(\{ email_updates/);
  assert.match(read("supabase/functions/send-welcome-email/index.ts"), /const WELCOME_PAUSED = true/);
  assert.match(read("supabase/functions/_shared/welcomeEmail.js"), /5 free image generations/);
});
