// The new-user flow: the free preview's rules, the worker's cut, and the guarantees that live in code and SQL.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PREVIEW, cliffhangerLine, previewDecision, topicsForGoals } from "../supabase/functions/_shared/cutaway/freePreview.js";
import { SIGNUP_BONUS, signupBonusEmailLine, signupBonusFor, signupBonusLine, signupBonusTimeLeft } from "../supabase/functions/_shared/signupBonus.js";
import { funnelStats, hopeGroupsOf } from "../supabase/functions/_shared/funnelStats.js";
import { WELCOME_QUESTION, welcomeEmail } from "../supabase/functions/_shared/welcomeEmail.js";
import { WELCOME_SENDER } from "../supabase/functions/_shared/emailRules.js";
import { failOrRetry, isWaitingInLine, LIMITS, onDispatchFailed, onEvent, onWatch } from "../supabase/functions/_shared/cutaway/orchestrate.js";
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
  assert.match(survey, /if \(!skipped && withPlan\) setBuilding\(true\); else leave\(skipped\)/);
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

test("the funnel: distinct people of the period's sign-ups, drop-off between steps, owner and tests left out", () => {
  const t = "2026-11-02T10:00:00Z", ev = (user_id, event, props = {}, created_at = t) => ({ user_id, event, props, created_at });
  const s = funnelStats({
    from: "2026-11-02T00:00:00Z", to: "2026-11-03T00:00:00Z", excluded: ["owner"], sends: [{ id: 1 }, { id: 2 }],
    events: [
      ev("a", "signed_up"), ev("b", "signed_up"), ev("c", "signed_up"), ev("owner", "signed_up"), ev("old", "signed_up", {}, "2026-11-01T10:00:00Z"),
      ev("a", "survey_answer"), ev("b", "survey_started"), ev("a", "survey_completed"), ev("b", "survey_skipped"), ev("owner", "survey_completed"),
      ev("a", "tutorial_step_completed", { step: 1, topic: "landfill" }), ev("a", "tutorial_step_completed", { step: 2, topic: "car_wash" }), ev("a", "tutorial_step_completed", { step: 2, topic: "car_wash" }),
      ev("a", "upgrade_screen_shown"), ev("a", "upgrade_click", { button: "compare" }), ev("a", "upgrade_click", { button: "compare" }), ev("a", "compare_plan_click", { plan: "pro" }), ev("a", "checkout_opened"), ev("a", "upgraded"),
      ev("a", "welcome_email_clicked"), ev("old", "upgraded"),
    ],
    onboarding: [{ user_id: "a", goals: ["faceless", "business"], experience: "few", heard_from: "tiktok_creator", heard_creator: " SomeOne ", survey_done_at: t, email_consent_at: t }, { user_id: "b", goals: ["faceless"], survey_done_at: t }, { user_id: "old", goals: ["longform"], survey_done_at: t }],
    emailEvents: [{ resend_id: "x", type: "email.delivered" }, { resend_id: "x", type: "email.delivered" }, { resend_id: "y", type: "email.bounced" }, { resend_id: "x", type: "email.opened" }],
  });
  const step = (k) => s.steps.find((x) => x.key === k);
  assert.equal(s.total, 3);
  assert.equal(step("survey_started").users, 2);
  assert.equal(step("survey_started").lostFromPrevious, 1);
  assert.equal(step("generate_clicked").users, 1, "counted once");
  assert.equal(step("upgraded").pctOfSignups, 33);
  assert.equal(step("plan_screen_finished").notTracked, true, "no such event at all: not tracked, not a drop-off");
  assert.equal(step("tutorial_started").lostFromPrevious, 2);
  assert.equal(step("checkout_opened").notTracked, undefined);
  assert.deepEqual(s.surveyEnds, { completed: 1, skipped: 1 });
  assert.equal(s.clicks[0].label, "Compare plans"); assert.equal(s.clicks[0].n, 1);
  assert.equal(s.comparePlans[0].key, "pro");
  assert.equal(s.topics[0].key, "car_wash");
  assert.equal(s.survey.goals[0].n, 2, "old sign-ups stay out");
  assert.equal(s.survey.creators[0].key, "someone");
  assert.equal(s.survey.optInPct, 50);
  assert.deepEqual(s.email, { sent: 2, delivered: 1, opened: 1, clicked: 1, bounced: 1, spam: 0, noteShown: 0, noteFound: 0, replies: null });
});

test("the survey's last question: optional, saved, every answer on the dashboard newest first, grouped by words", () => {
  const survey = read("src/components/onboarding/OnboardingSurvey.jsx");
  assert.match(survey, /const TOTAL = 5/);
  assert.match(survey, /What do you hope Zyvo will help you create\?/);
  assert.match(survey, /HOPE_PLACEHOLDER = "Faceless videos for my TikTok about history"/);
  assert.match(survey, /data-testid="survey-hope-skip"/);
  assert.match(survey, /p_hope: skipped \? null : hope\.trim\(\) \|\| null/);
  assert.ok(survey.indexOf("What do you hope Zyvo") < survey.indexOf("Get tips, templates and offers by email?"), "right before the email step");
  const sql = read("supabase/migrations/20261130130000_survey_hope_and_spam_note.sql");
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.save_onboarding_survey\(text\[\], text, text, text, boolean, text, boolean\);/, "no overload: the live page's call stays unambiguous");
  assert.match(sql, /p_hope text DEFAULT NULL/);
  assert.match(sql, /'spam_note_shown', 'spam_note_found'/);
  assert.match(read("src/pages/support/SupportPolicyArticle.jsx"), /what you hope Zyvo will help you create/);

  assert.deepEqual(hopeGroupsOf("Faceless videos for my TikTok about history"), ["short", "faceless", "history"]);
  assert.deepEqual(hopeGroupsOf("ads for my bakery"), ["business"]);
  assert.deepEqual(hopeGroupsOf("idk"), ["other"]);
  const t = (h) => `2026-11-02T${h}:00:00Z`;
  const s = funnelStats({
    from: "2026-11-02T00:00:00Z", to: "2026-11-03T00:00:00Z",
    events: ["a", "b", "c"].map((u) => ({ user_id: u, event: "signed_up", props: {}, created_at: t("01") })).concat([{ user_id: "a", event: "spam_note_shown", props: {}, created_at: t("02") }, { user_id: "a", event: "spam_note_shown", props: {}, created_at: t("03") }, { user_id: "a", event: "spam_note_found", props: {}, created_at: t("03") }]),
    onboarding: [
      { user_id: "a", goals: ["faceless"], experience: "never", heard_from: "tiktok_ad", hope: " Horror stories for TikTok ", survey_done_at: t("02") },
      { user_id: "b", goals: ["business"], hope: "Product ads", survey_done_at: t("05") },
      { user_id: "c", goals: ["longform"], hope: "   ", survey_done_at: t("04") },
    ],
  });
  assert.equal(s.survey.hopeCount, 2, "an empty answer isn't one");
  assert.deepEqual(s.survey.hopes.map((h) => h.text), ["Product ads", "Horror stories for TikTok"], "newest first");
  assert.deepEqual(s.survey.hopes[1].goals, ["Faceless TikTok, Reels or Shorts"]);
  assert.equal(s.survey.hopes[1].heard, "TikTok ad");
  assert.deepEqual(s.survey.hopeGroups.map((g) => g.key).sort(), ["business", "short", "stories"]);
  assert.equal(s.email.noteShown, 1, "people, not views");
  assert.equal(s.email.noteFound, 1);
});

test("the spam note: only after a real send, gone for good after 'I found it'; the email ends with the reply question", () => {
  const note = read("src/components/onboarding/SpamNote.jsx");
  assert.match(note, /s\?\.welcomeSent && !s\.spamNoteDismissed/);
  assert.match(note, /supabase\.rpc\("dismiss_spam_note"\)/);
  assert.match(note, /We just sent you an email at/);
  assert.match(note, /user\?\.email/);
  assert.match(note, /I found it ✓/);
  assert.match(read("src/pages/workspace/HomeV2.jsx"), /<SpamNote where="home" \/>/);
  assert.match(read("src/pages/onboarding/FirstVideo.jsx"), /<Rendering run=\{run\} spamNote \/>/);
  const fn = read("supabase/functions/send-welcome-email/index.ts");
  assert.ok(fn.indexOf("welcome_sent_at") > fn.indexOf("if (!sent)"), "marked only after the email went");
  assert.match(fn, /replyTo: REPLY_TO\.founder/);
  const mail = welcomeEmail({ html: "", text: "" });
  assert.match(mail.text, /Quick question: what do you hope Zyvo helps you with\? Just hit reply, I read every answer\.\n/);
  assert.ok(mail.html.includes(WELCOME_QUESTION));
});

test("the welcome email: off by default, new accounts only, once, offer only with opt-in", () => {
  const fn = read("supabase/functions/send-welcome-email/index.ts");
  assert.match(fn, /settings\?\.welcome_email_on !== true\) return ok\(req, \{ skipped: "paused" \}\)/);
  assert.match(fn, /onboarding\?\.enrolled !== true\) return ok\(req, \{ skipped: "not_in_new_flow" \}\)/);
  assert.match(fn, /body\?\.trigger !== "plan_finished"/);
  assert.match(fn, /eq\("welcome_email_sent", false\)/);
  assert.match(fn, /if \(onboarding\.email_consent_at\)/);
  assert.match(read("supabase/migrations/20261130120000_funnel_tracking_and_welcome_switch.sql"), /welcome_email_on boolean NOT NULL DEFAULT false/);
  const footer = { html: "<f>", text: "f" };
  const plain = welcomeEmail(footer), offer = welcomeEmail(footer, { bonusEndsAt: "2026-11-05T21:02:00Z" });
  assert.doesNotMatch(plain.html + plain.text, /bonus|credits/i, "no offer without the opt-in");
  assert.match(offer.text, /50 bonus credits/);
  assert.match(offer.text, /Thursday 5 November, 21:02 UTC/);
  assert.match(plain.html, /\/welcome\/first-video\?from=email/);
  // owner, 2026-11-03: the wording, and the welcome on its own domain (both sends: users and the owner's test)
  assert.match(plain.text, /Thanks for joining Zyvo\. Your free video preview is waiting: it only takes a minute or two\./);
  assert.doesNotMatch(plain.text + plain.html, /ready to start/);
  assert.equal(fn.match(/from: WELCOME_SENDER/g)?.length, 2);
  assert.doesNotMatch(fn, /SENDERS\./);
  assert.equal(WELCOME_SENDER, "Niko from Zyvo <niko@notify.tryzyvo.com>");
  assert.match(plain.html, /\/workspace\/image-generator\?from=email/);
  const survey = read("src/components/onboarding/OnboardingSurvey.jsx");
  assert.match(survey, /requestWelcomeEmail\(\); onDone/);
  assert.doesNotMatch(read("src/components/onboarding/OnboardingGate.jsx"), /send-welcome-email/, "not at sign-up any more");
});

test("the coming-to-life clips: small files, baked blur, still for reduced motion", () => {
  const f = read("src/components/onboarding/FloatingClips.jsx");
  assert.match(f, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(f, /blur-/, "the blur is in the files: no live filter on a phone");
  let total = 0;
  for (const k of ["landfill", "carwash", "drain", "pool"]) { const size = readFileSync(`public/onboarding/float/${k}.mp4`).length; assert.ok(size < 120 * 1024, `${k} is ${size} bytes`); total += size; }
  assert.ok(total < 400 * 1024);
});

test("sign-up on phones: no clips rendered at all", () => {
  const auth = read("src/components/auth/AuthSplit.jsx");
  assert.match(auth, /if \(!useIsDesktop\(\)\) return null;/);
  assert.match(auth, /\(min-width: 1024px\)/);
});

test("Home's Long Form card and What's new art come with the site, not from storage", () => {
  const home = read("src/components/home-v2/HomeV2Sections.jsx");
  assert.match(home, /media=\{<img src="\/home\/long-form-card\.webp"/);
  assert.match(home, /HUNT_THUMBS = \["\/home\/launch\/spear-or-patience\.jpg"/);
  for (const f of ["public/home/long-form-card.webp", "public/home/launch/spear-or-patience.jpg", "public/home/launch/how-did-this-kill.jpg", "public/home/launch/what-does-it-prove.jpg"]) assert.ok(readFileSync(f).length > 1000, f);
});

test("after the payment: the finished video and straight on to the next one", () => {
  const page = read("src/pages/onboarding/FirstVideo.jsx");
  assert.match(page, /Make your next video/);
  assert.match(page, /\$\{CUTAWAY_PATH\}\?topic=\$\{encodeURIComponent\(topic\)\}/);
  assert.match(page, /eq\("offer_id", SIGNUP_BONUS\.id\)/, "the bonus chip only when the webhook really gave it");
  assert.match(read("src/components/viral-tools/cutaway-explainer/CutawayStudio.jsx"), /get\("topic"\)/);
});

test("5 of 5 free images: the waiting video, or the plans; checkout never waits for a video that doesn't exist", () => {
  const screen = read("src/components/onboarding/ImageLimitScreen.jsx");
  assert.match(read("src/components/ImageGenerator/Generate.jsx"), /<ImageLimitScreen/);
  assert.match(screen, /s\?\.plan === "free" && s\.preview\?\.step === "done" && !s\.finish/);
  assert.match(screen, /usePlanCheckout\(demo, \{ plain: !run \}\)/);
  assert.match(screen, /Maybe later/);
  assert.match(read("src/pages/onboarding/FirstVideo.jsx"), /usePlanCheckout\(false, \{ plain: true \}\)/);
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
  const run = { id: "r", topic: "t", status: "render", provider: "runpod", provider_job_id: "j", attempt: LIMITS.previewAttempts, free_preview: true };
  const r = failOrRetry(run, { code: "NO_GPU_SLOT", message: "no GPU" });
  assert.equal(r.patch.status, "failed");
  assert.ok(r.actions.some((a) => a.type === "releasePreview"));
  assert.equal(r.patch.provider, undefined);
  const paying = failOrRetry({ ...run, free_preview: false }, { code: "NO_GPU_SLOT", message: "no GPU" });
  assert.equal(paying.patch.provider, "fly", "a paying customer's video keeps its fallback");
});

test("a free preview waits in line: 4 tries on RunPod, a longer wait for a GPU, then given back", () => {
  const NOW = Date.parse("2026-11-03T12:00:00Z"), ago = (s) => new Date(NOW - s * 1000).toISOString();
  const run = { id: "r", topic: "t", status: "queued", provider: "runpod", provider_job_id: "j", attempt: 1, free_preview: true, created_at: ago(700), dispatched_at: ago(700) };
  // the paid wait (8 min) isn't enough to give up on a preview; 10 min is: a new place in line, the old job cancelled
  assert.deepEqual(onWatch({ ...run, dispatched_at: ago(LIMITS.queueSec + 5) }, { status: "IN_QUEUE" }, NOW).actions, []);
  const requeued = onWatch(run, { status: "IN_QUEUE" }, NOW);
  assert.equal(requeued.patch.attempt, 2);
  assert.deepEqual(requeued.actions.map((a) => a.type), ["cancel", "dispatch"]);
  // a worker without graphics or a lost worker: tried again up to the 4th attempt, then failed and given back
  for (const attempt of [1, 2, 3]) {
    const held = failOrRetry({ ...run, attempt }, { code: "NO_GPU", message: "no graphics" }, NOW);
    assert.deepEqual(held.actions, [], "held back until the worker without graphics has gone");
    const resent = onWatch({ ...run, attempt, ...held.patch }, null, NOW + (LIMITS.redispatchSec + 1) * 1000);
    assert.equal(resent.patch.attempt, attempt + 1);
    assert.deepEqual(resent.actions, [{ type: "dispatch", target: "runpod", role: "video" }]);
  }
  assert.equal(failOrRetry({ ...run, attempt: 2 }, { code: "LOST", message: "worker gone" }, NOW).patch.attempt, 3, "other failures are sent again at once");
  const last = failOrRetry({ ...run, attempt: LIMITS.previewAttempts }, { code: "NO_GPU_SLOT", message: "no GPU" }, NOW);
  assert.equal(last.patch.status, "failed");
  assert.ok(last.actions.some((a) => a.type === "releasePreview"));
  assert.equal(failOrRetry({ ...run, attempt: 1 }, { code: "GATE_FAILED" }, NOW).patch.status, "failed", "the video's own failures are never retried");
  // the owner's preparation runs and paying customers keep their old path
  assert.equal(failOrRetry({ ...run, preview_pool: true, attempt: 2 }, { code: "NO_GPU" }, NOW).patch.status, "failed");
  assert.equal(failOrRetry({ ...run, free_preview: false, attempt: 2 }, { code: "NO_GPU" }, NOW).patch.provider, "fly");
});

test("a worker without graphics: the retry waits until that worker has gone, never sent straight back to it", () => {
  const NOW = Date.parse("2026-11-03T20:37:00Z"), ago = (s) => new Date(NOW - s * 1000).toISOString();
  // the paid run of 2026-11-03 (56f25b9c): both RunPod tries landed on the same MIG slice
  const run = { id: "r", topic: "t", status: "queued", provider: "runpod", provider_job_id: "j1", attempt: 1, free_preview: false, created_at: ago(60), dispatched_at: ago(55) };
  const held = onEvent(run, { event: "failed", attempt: 1, code: "NO_GPU", retryable: true, message: "NO_GPU: llvmpipe" }, NOW);
  assert.deepEqual(held.actions, []);
  assert.equal(held.patch.provider_job_id, null);
  assert.equal(held.patch.attempt, undefined, "the attempt counts up when it is sent");
  const waiting = { ...run, ...held.patch };
  // the old job's own end (RunPod's webhook) no longer moves the run
  assert.deepEqual(onEvent(waiting, { event: "runpod", jobId: "j1", status: "FAILED", output: { ok: false, code: "NO_GPU" } }, NOW + 5000), { patch: {}, actions: [] });
  assert.deepEqual(onWatch(waiting, null, NOW + 30000).actions, [], "not before a minute");
  const resent = onWatch(waiting, null, NOW + 61000);
  assert.equal(resent.patch.attempt, 2);
  assert.deepEqual(resent.actions, [{ type: "dispatch", target: "runpod", role: "video" }]);
  assert.match(resent.patch.error_message, /attempt 1: NO_GPU NO_GPU: llvmpipe/, "the first failure stays in the trail");
  // its second try without graphics: straight to the Fly fallback, as before
  const second = { ...waiting, ...resent.patch, provider_job_id: "j2" };
  assert.equal(onEvent(second, { event: "failed", attempt: 2, code: "NO_GPU", retryable: true, message: "again" }, NOW + 120000).patch.provider, "fly");
});

test("a free preview whose sending failed is sent again a minute later, not failed", () => {
  const NOW = Date.parse("2026-11-03T12:00:00Z"), ago = (s) => new Date(NOW - s * 1000).toISOString();
  const run = { id: "r", topic: "t", status: "queued", provider: null, provider_job_id: null, attempt: 1, free_preview: true, created_at: ago(5) };
  const wait = onDispatchFailed(run, "runpod", "upload URL: Service Unavailable", NOW);
  assert.equal(wait.patch.error_code, "DISPATCH_FAILED");
  assert.deepEqual(wait.actions, []);
  const waiting = { ...run, ...wait.patch };
  assert.deepEqual(onWatch(waiting, null, NOW + 30000).actions, [], "not before a minute");
  const again = onWatch(waiting, null, NOW + 61000);
  assert.equal(again.patch.attempt, 2);
  assert.deepEqual(again.actions, [{ type: "dispatch", target: "runpod", role: "video" }]);
  assert.equal(onDispatchFailed({ ...run, attempt: LIMITS.previewAttempts }, "runpod", "x", NOW), null, "out of tries: the usual end");
  assert.equal(onDispatchFailed({ ...run, free_preview: false }, "runpod", "x", NOW), null, "a paid run keeps its path");
});

test("the page's 'in line': a free preview no worker has yet, after 90 s or a retry", () => {
  const NOW = Date.parse("2026-11-03T12:00:00Z"), ago = (s) => new Date(NOW - s * 1000).toISOString();
  const run = { status: "queued", attempt: 1, free_preview: true, dispatched_at: ago(30), heartbeat_at: null };
  assert.equal(isWaitingInLine(run, NOW), false, "the first seconds are normal");
  assert.equal(isWaitingInLine({ ...run, dispatched_at: ago(LIMITS.busySec + 5) }, NOW), true);
  assert.equal(isWaitingInLine({ ...run, attempt: 2, status: "render" }, NOW), true, "a retry waits in line again");
  assert.equal(isWaitingInLine({ ...run, dispatched_at: ago(200), heartbeat_at: ago(10) }, NOW), false, "a worker has it");
  assert.equal(isWaitingInLine({ ...run, dispatched_at: ago(200), free_preview: false }, NOW), false);
  assert.equal(isWaitingInLine({ ...run, dispatched_at: ago(200), status: "failed" }, NOW), false);
  assert.match(read("src/pages/onboarding/FirstVideo.jsx"), /run\?\.inLine[\s\S]*High demand, your video is in line/);
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
  assert.match(read("src/lib/onboarding.js"), /functions\.invoke\("send-welcome-email"/);
  assert.doesNotMatch(read("src/lib/auth.js"), /functions\.invoke\("send-welcome-email"/);
  assert.doesNotMatch(read("src/components/WelcomeScreen.jsx"), /update\(\{ email_updates/);
  assert.match(read("supabase/functions/_shared/welcomeEmail.js"), /5 free images/);
});
