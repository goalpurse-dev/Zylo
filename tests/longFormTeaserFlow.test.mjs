import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Long Form for free and logged-out visitors (2026-10-04): the Generate button
// without a credit amount, the sign-up dialog that comes back to the same
// setup, the free teaser page with its upgrade card, and the "What's new"
// popup for logged-out visitors.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n");
const setup = read("src/pages/workspace/long-form/ProductionSetup.jsx");
const teaser = read("src/pages/workspace/long-form/teaser.jsx");
const layout = read("src/pages/workspace/layout.jsx");

test("Generate button: no credit amount for free and logged-out accounts; paid plans unchanged", () => {
  assert.match(setup, /const teaserMode = !account\.loading && !account\.isPaid;/);
  assert.match(setup, /const showPrice = !account\.loading && account\.isPaid;/);
  // Both Generate surfaces (side panel, bottom bar) only pass a price for a paid plan.
  assert.equal(setup.match(/credits=\{showPrice && quote && !quoteLoading \? quote\.totalCredits : null\}/g)?.length, 2);
  assert.ok(!/credits=\{quote && !quoteLoading \? quote\.totalCredits : null\}/.test(setup), "no unconditional price on a Generate button");
  // The label stays "Generate video" for everyone.
  assert.match(setup, /label = "Generate video"/);
  // The summary shows the free-preview note instead of the price and the balance.
  assert.equal(setup.match(/\) : teaserMode \? teaserNote : account\.loading \|\| quoteLoading \|\| !quote \? \(/g)?.length, 2);
  assert.match(setup, /const projectedBalance = showPrice && quote/);
  // Paid plans: the same full generation as before, never the teaser.
  assert.match(setup, /if \(account\.isPaid\) \{ handleGenerateVideo\(\); return; \}/);
});

test("logged out: Generate opens the sign-up dialog and the setup survives the sign-up", () => {
  assert.match(setup, /setAuthPrompt\(\{ title: "Create a free account to start your video"/);
  assert.match(setup, /<AuthModal\s+mode="signup"[\s\S]{0,200}returnTo="\/long-form\/create"/);
  // Pressing Generate remembers nothing (2026-10-04: a flag set here started teasers on plain page loads).
  const press = setup.slice(setup.indexOf("const handleGenerate = () => {"), setup.indexOf("const teaserAutoChecked = useRef(false);"));
  assert.ok(!/localStorage|sessionStorage|armTeaserAutostart/.test(press), "Generate itself must not arm the auto-start");
  assert.match(press, /teaser: true \}\);/);
  // A logged-out visitor no longer asks the server for a session (it answered 401 and the page stayed locked).
  assert.ok(setup.indexOf("if (!authSession?.user) {") < setup.indexOf("const result = await createDiscoverySession();"));
  assert.match(setup, /savePersistedDraft\(\{ guest: true \}\);/);
  assert.match(setup, /const guestDraft = saved\?\.guest \? saved : null;\n\s+if \(guestDraft\) restoreDraftFields\(guestDraft, linkedNiche\);/);
  // The auto-start is armed only by a sign-up that goes through in that box, and disarmed when the box is closed.
  assert.match(setup, /onSignUp=\{\(\) => \{ if \(authPrompt\.teaser\) armTeaserAutostart\(\); \}\}/);
  assert.match(setup, /if \(signedIn\) window\.location\.reload\(\); else disarmTeaserAutostart\(\);/);
  assert.equal(setup.match(/\barmTeaserAutostart\(\)/g)?.length, 1, "armed in exactly one place");
  // Read once per page load (and removed by the read), then the one rule decides.
  assert.match(setup, /teaserAutoChecked\.current = true;[\s\S]{0,160}const armed = takeTeaserAutostart\(\);\n\s+if \(shouldAutostartTeaser\(\{ armed, signedIn: account\.signedIn, isPaid: account\.isPaid, accountCreatedAt, setupFilled \}\)\) startTeaserNow\(\);/);
  // startTeaserNow has exactly two callers: the Generate click and that one check.
  assert.equal(setup.match(/startTeaserNow\(\)/g)?.length, 2);
  const view = read("src/pages/workspace/long-form/teaserView.js");
  assert.match(view, /window\.sessionStorage/, "this tab only: a new tab never sees the flag");
  assert.ok(!/localStorage/.test(view.replace(/\/\/.*$/gm, "")));
  // The dialog offers Google and email, and comes back through the auth callback.
  const modal = read("src/components/AuthModal.jsx");
  assert.match(modal, /Continue with Google/);
  assert.match(modal, /type="email"/);
  assert.match(modal, /localStorage\.setItem\(POST_AUTH_RETURN_KEY/);
  // onSignUp fires for Google and for a new email account that is signed in at once: never for a password sign-in.
  assert.equal(modal.match(/onSignUp\?\.\(\)/g)?.length, 2);
  assert.match(modal, /else if \(data\.session\) \{ onSignUp\?\.\(\); onClose\(true\); \}/);
  const callback = read("src/pages/AuthCallback.jsx");
  assert.match(callback, /path\.startsWith\("\/"\) && !path\.startsWith\("\/\/"\)/, "only an in-app path is followed");
});

test("free accounts: Generate starts the teaser, creates no project and charges nothing", () => {
  const start = setup.slice(setup.indexOf("const startTeaserNow = async () => {"), setup.indexOf("const handleGenerate = () => {"));
  assert.match(start, /await startTeaser\(\{/);
  assert.match(start, /navigate\(`\/long-form\/teaser\/\$\{result\.teaserId\}`\)/);
  assert.match(start, /trackLaunch\("teaser_started"/);
  for (const banned of ["createLongFormProject", "createProductionSetup", "startAutopilot", "clearPersistedDraft"]) assert.ok(!start.includes(banned), banned);
  assert.match(read("src/App.jsx"), /<Route path="\/long-form\/teaser\/:id"\s+element=\{<LongFormTeaserPage \/>\} \/>/);
});

test("teaser page: real steps, an honest result, the upgrade card, back to this video after payment", () => {
  assert.match(teaser, /teaserSteps\(teaser\)/);
  assert.match(teaser, /Your full video is ready to be made/);
  assert.match(teaser, /~\{minutes\} minutes, ~\{scenes\} scenes, voiceover, thumbnails\./);
  assert.match(teaser, /Nothing has been researched, voiced or rendered yet\./);
  // Three plans to choose from (2026-10-04), each with its own checkout button; numbers come from live prices.
  assert.match(teaser, /const TEASER_PLANS = \["starter", "pro", "generative"\];/);
  assert.match(teaser, /const POPULAR_PLAN = "pro";/);
  assert.match(teaser, /Most popular/);
  assert.match(teaser, /TEASER_PLANS\.map\(\(planId\) => <PlanCard /);
  assert.match(teaser, /sm:grid-cols-3/, "side by side on desktop, stacked on mobile");
  assert.match(teaser, /longFormOutputs\(tiers\.tiers, planId, "v2", LONG_FORM_HEADLINE_MINUTES\)/);
  assert.match(teaser, /formatMoney\(plan\.monthly, prices\.prices\.currency\)/);
  assert.match(teaser, /startCheckout\(\{\s+type: "subscription", planId, billing: "monthly",/);
  assert.match(teaser, /See all plans/);
  // Whichever plan is paid for: back to this video's setup, which starts the full video once.
  assert.match(teaser, /\/long-form\/create\?start=1&teaser=\$\{teaser\.id\}/);
  // It never says the video already exists.
  for (const lie of [/your video is ready(?! to be made)/i, /video is finished/i, /has been (made|generated|rendered)/i, /watch your video/i, /download your video/i]) assert.ok(!lie.test(teaser), String(lie));
  // A paid account opening a preview presses Generate itself (the price is on the button): no auto-start.
  assert.match(teaser, /navigate\(`\/long-form\/create\?teaser=\$\{teaser\.id\}`\)/);
});

test("after payment: the plan is confirmed first, then the normal (charged) generation starts once", () => {
  const auto = setup.slice(setup.indexOf("const fullAutoStarted = useRef(false);"), setup.indexOf("const teaserNote = ("));
  assert.match(auto, /!account\.isPaid/);
  assert.match(auto, /teaserInfo\.fullStarted/, "a preview that already became a video never starts a second one");
  assert.match(auto, /credits < quote\.totalCredits/);
  assert.match(auto, /handleGenerateVideo\(\)/);
  // Whatever plan was bought, the automatic first video is V2 (2026-10-04): never V3's price without a click.
  assert.match(setup, /const AUTO_START_TIER = "v2";/);
  assert.match(auto, /if \(renderTier !== AUTO_START_TIER \|\| !canGenerate/);
  assert.match(setup, /if \(fromTeaser\?\.autoStart && \(paymentState === "confirming" \|\| paymentState === "starting"\)\) \{\n\s+tierTouchedRef\.current = true;\n\s+if \(renderTier !== AUTO_START_TIER\) setRenderTier\(AUTO_START_TIER\);\n\s+return;/);
  assert.match(setup, /window\.history\.replaceState\(null, "", window\.location\.pathname\);/, "a refresh must not start it again");
});

test("funnel: started, finished, upgrade clicked, paid, full video started", () => {
  assert.match(setup, /trackLaunch\("teaser_started"/);
  assert.match(teaser, /trackLaunch\("teaser_finished"/);
  assert.match(teaser, /trackLaunch\("teaser_upgrade_clicked", \{ placement: "long_form_teaser", target: planId, teaserId: teaser\.id \}\);\n\s+teaserEvent\(teaser\.id, "upgrade_clicked"\)/);
  assert.match(setup, /teaserEvent\(fromTeaser\.teaserId, "paid"\);\n\s+trackLaunch\("teaser_paid"/);
  assert.match(setup, /teaserEvent\(fromTeaser\.teaserId, "full_started", \{ projectId \}\);\n\s+trackLaunch\("teaser_full_started"/);
  const fn = read("supabase/functions/long-form-teaser/index.ts");
  for (const e of ["teaser_started", "teaser_finished"]) assert.ok(fn.includes(`"${e}"`), e);
  assert.match(fn, /upgrade_clicked: "upgrade_clicked_at", paid: "paid_at", full_started: "full_started_at"/);
});

test("What's new popup: logged-out visitors too, after the cookie banner, never over another popup", () => {
  // The old rule returned before anything for a logged-out visitor.
  assert.ok(!/const user = data\?\.user;\n\s+if \(!user\) return;/.test(layout));
  assert.match(layout, /if \(!seen\) setWhatsNew\(\{ guest: true \}\);/);
  assert.match(layout, /const WHATS_NEW_GUEST_KEY = `zyvo:whats-new:seen:\$\{LONG_FORM_ANNOUNCEMENT\}`;/);
  assert.match(layout, /if \(whatsNew\.guest\) localStorage\.setItem\(WHATS_NEW_GUEST_KEY, "1"\);/);
  assert.match(layout, /if \(!whatsNew \|\| location\.pathname !== "\/" \|\| !cookieAnswered \|\| showWelcome\) return undefined;/);
  // The "Earn free credits" popup no longer opens by itself (2026-10-04); it is opened from the gift button / Home card.
  assert.ok(!/CreatorRewardsModal|showRewards/.test(layout));
  assert.match(layout, /if \(document\.querySelector\("\[data-zyvo-modal\]"\)\) return;/);
  // Logged-in rule unchanged: only without a Long Form project, and not after "Don't show this again".
  assert.match(layout, /seen_announcements \?\? \[\]\)\.includes\(LONG_FORM_ANNOUNCEMENT\)/);
  assert.match(layout, /from\("long_form_projects"\)\.select\("id", \{ count: "exact", head: true \}\)/);
  const banner = read("src/components/CookieConsent.jsx");
  assert.equal(banner.match(/window\.dispatchEvent\(new Event\(COOKIE_CONSENT_EVENT\)\);/g)?.length, 2, "accept and decline both tell the page");
  assert.match(read("src/components/AuthModal.jsx"), /data-zyvo-modal="auth"/);
});
