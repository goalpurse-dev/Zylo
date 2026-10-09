// Browser check of what each kind of visitor sees on the Blocky Stories page, on a running dev server ($0:
// every action that writes or makes anything is answered here, never by the server).
//   guest       signed out: the showcase, "Sign up to create your own", and the sign-up popup on any button
//   free        the showcase, "Upgrade your plan…" with "See plans", ideas work, anything further opens the upgrade popup
//   starter     V2 open; V3 and V4 locked ("Available on Pro" / "Available on Generative") with the upgrade popup
//               (one popup everywhere: "Upgrade your plan to continue", what each plan unlocks, "See plans";
//               a locked tier highlights the plans that include it)
//   pro         V2 and V3 open; V4 locked
//   generative  all three open
// The plan views are the owner's session with the plan answered here (the page reads it from the profile);
// the signed-out view has no session, and Blocky's global switch is answered "on" in this browser only.
// Screenshots at 1440 and 390 px.
//   node scripts/blocky/qaViews.mjs <outDir> [baseUrl]
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { ROOT, SUPABASE_URL, api, userSession } from "./lib.mjs";

const require = createRequire(path.join(ROOT, "package.json"));
const { chromium } = require("playwright");
const [outDir, base = "http://localhost:5173"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const owner = await userSession();
const { data: { session } } = await owner.client.auth.getSession();
const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
const library = (await api(owner.accessToken, "listCharacters")).data;
// A browser that plays the videos if this machine has one; the bundled one shows their poster pictures.
const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const out = {};

const ideas = () => ["The Owner's Badge", "One Trade Too Many", "The Glitched Door", "Ten Seconds Left", "The New Rule"].map((title, i) => ({
  id: `idea:0:t${i}`, vetted: i === 0, type: `t${i}`, title, castIds: i % 2 ? [library[1].id, library[0].id] : [library[0].id, library[1].id],
  hook: ["Vex finds a badge that can ban anyone.", "Noob trades a pet for the rarest item on the server.", "A door that only opens for avatars who lost.", "The round ends in ten seconds and nobody has the key.", "A new server rule, and only one avatar read it."][i],
  summary: "A short story with a twist in the second half and a last line the winner gets.",
}));

async function open(view, name, viewport) {
  const phone = viewport.width < 500;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(([key, value, plan, userId, guest]) => {
    localStorage.setItem("zyvo_cookie_consent", "declined");
    localStorage.removeItem("blocky:draft");
    if (guest) return;
    localStorage.setItem(key, value);
    localStorage.setItem("zyvo_blocky_plan", JSON.stringify({ id: userId, code: plan }));
  }, [`sb-${ref}-auth-token`, JSON.stringify(session), view, session.user.id, view === "guest"]);
  const p = await ctx.newPage();
  const calls = [];
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.route("**/rest/v1/global_feature_flags*", async (route) => {
    const res = await route.fetch();
    const rows = await res.json().catch(() => []);
    await route.fulfill({ response: res, json: [...rows.filter((r) => r.key !== "blocky_v1"), { key: "blocky_v1", enabled: true }] });
  });
  // The plan this view is about (the page asks the profile for plan_code only).
  await p.route("**/rest/v1/profiles*", async (route) => {
    if (view === "guest" || !/select=plan_code(&|$)/.test(route.request().url())) return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", json: { plan_code: view } });
  });
  await p.route("**/functions/v1/blocky-story-api", async (route) => {
    const body = route.request().postDataJSON?.() ?? {};
    calls.push(body.action);
    const reply = (data) => route.fulfill({ status: 200, contentType: "application/json", json: { ok: true, data } });
    if (body.action === "listCharacters") return reply(library);   // signed out too: what the server gives once Blocky is on for everyone
    if (body.action === "getIdeas") return reply(ideas());
    if (["startDraft", "writeVersion", "pickVersion", "createStory", "generateScenePictures", "animateAll"].includes(body.action)) return route.fulfill({ status: 502, contentType: "application/json", json: { ok: false, code: "PLANNER_FAILED", message: "PLANNER_FAILED" } });
    if (view === "guest") return route.fulfill({ status: 401, contentType: "application/json", json: { ok: false, code: "UNAUTHORIZED", message: "Sign in to continue." } });
    return route.continue();
  });
  await p.goto(`${base}/workspace/blocky-stories`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await p.getByText("What's the story?").first().waitFor({ state: "attached", timeout: 45_000 });
  await p.waitForTimeout(2500);
  await p.getByRole("button", { name: "Decline" }).click({ timeout: 2500 }).catch(() => {});   // the cookie note, when it shows
  const shot = async (label) => { await p.waitForTimeout(700); await p.screenshot({ path: path.join(outDir, `${view}-${label}-${name}.png`) }); };
  const tab = async (label) => { if (phone) { await p.getByRole("tab", { name: label }).click(); await p.waitForTimeout(500); } };
  const showcase = async () => ({
    videos: await p.locator('section[aria-label="Videos made with Blocky Stories"] video').count(),
    posters: await p.locator('section[aria-label="Videos made with Blocky Stories"] video').evaluateAll((vs) => vs.filter((v) => v.poster && v.muted && v.loop).length),
    playing: await p.locator('section[aria-label="Videos made with Blocky Stories"] video').evaluateAll((vs) => vs.filter((v) => !v.paused && v.readyState >= 2).length),
    visible: await p.locator('section[aria-label="Videos made with Blocky Stories"]').isVisible(),
  });
  const tiers = () => p.locator('[aria-labelledby="bq-quality"] button').evaluateAll((bs) => bs.map((b) => `${b.innerText.replace(/\s+/g, " ").trim()}${b.getAttribute("aria-pressed") === "true" ? "*" : ""}`));
  const pickIdea = async () => {
    await p.getByRole("button", { name: "Give me ideas" }).click();
    await p.locator('section[aria-label="Story builder"] button[aria-pressed]', { hasText: "Badge" }).first().waitFor({ timeout: 15_000 });
    await p.locator('section[aria-label="Story builder"] button[aria-pressed]', { hasText: "Badge" }).first().click();
    await p.waitForTimeout(600);
  };
  const sideScroll = () => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  // The upgrade popup as it stands: its title, its three lines, which plans are highlighted, its button.
  const popup = async () => ({
    shown: await p.getByRole("heading", { name: PLANS_TITLE }).count(),
    lines: await p.locator("[data-plan]").evaluateAll((rows) => rows.map((r) => r.innerText.replace(/\s+/g, " ").replace(/, includes V\d/, "").trim())),
    highlighted: await p.locator('[data-plan][data-included="true"]').evaluateAll((rows) => rows.map((r) => r.dataset.plan)),
    button: (await p.getByRole("link", { name: "See plans" }).innerText().catch(() => "")).trim(),
    href: await p.getByRole("link", { name: "See plans" }).getAttribute("href").catch(() => null),
    notNow: await p.getByRole("button", { name: "Not now" }).count(),
    namesAPlan: await p.getByRole("link", { name: /Upgrade to/ }).count(),
    inside: await p.evaluate(() => { const d = document.querySelector('[data-testid="plans-dialog"]')?.getBoundingClientRect(); return d ? d.top >= 0 && d.bottom <= innerHeight && d.left >= 0 && d.right <= innerWidth : false; }),
  });
  return { p, ctx, phone, calls, errors, shot, tab, showcase, tiers, pickIdea, sideScroll, popup };
}

const SIGNUP = "Free to join. Your Blocky story is a few minutes away.";
const PLANS_TITLE = "Upgrade your plan to continue";
const LINES = ["Starter: V2 videos", "Pro: V2 + V3 (sharper)", "Generative: V2 + V3 + V4 (best quality)"];

for (const [name, viewport] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
  // ── Signed out ──
  {
    const v = await open("guest", name, viewport);
    const { p, phone } = v;
    const row = (out[`guest-${name}`] = {});
    row.landsOnExamples = phone ? (await p.getByRole("tab", { name: "Examples" }).getAttribute("aria-selected")) === "true" : true;
    row.showcase = await v.showcase();
    row.message = await p.getByRole("heading", { name: "Sign up to create your own" }).count();
    row.signUpButton = await p.locator('section[aria-label="Videos made with Blocky Stories"]').getByRole("button", { name: "Sign up", exact: true }).count();
    await v.shot("1-landing");
    // The button under the videos opens the sign-up popup.
    await p.locator('section[aria-label="Videos made with Blocky Stories"]').getByRole("button", { name: "Sign up", exact: true }).click();
    row.popupFromShowcase = await p.getByText(SIGNUP).count();
    await v.shot("2-signup-from-videos");
    await p.mouse.click(5, 5);
    await p.waitForTimeout(400);
    // Looking around: the builder, the avatar library.
    if (phone) { await p.getByRole("button", { name: "Look around first" }).click(); await p.waitForTimeout(500); }
    await v.shot("3-builder");
    await p.getByRole("button", { name: "Give me ideas" }).click();
    row.popupFromIdeas = await p.getByText(SIGNUP).count();
    await v.shot("4-signup-from-ideas");
    await p.mouse.click(5, 5);
    await p.waitForTimeout(400);
    await p.locator('[aria-label="How do you want to start?"] button', { hasText: "Describe it" }).click();
    await p.getByRole("button", { name: /Add character/ }).first().click();
    const dialog = p.getByRole("dialog");
    await dialog.locator("button[aria-pressed]").first().waitFor({ timeout: 15_000 });
    row.libraryAvatars = await dialog.locator("button[aria-pressed]").count();
    await p.waitForTimeout(1500);
    await v.shot("5-library");
    for (const who of ["Noob", "Vex"]) await dialog.locator("button[aria-pressed]", { hasText: who }).first().click().catch(() => {});
    await dialog.getByRole("button", { name: "Done" }).click();
    await p.locator("#fv2-prompt").fill("Noob trades a starter pet for Vex's rarest item, and the pet turns out to be the server's owner.");
    await p.waitForTimeout(600);
    row.tiers = await v.tiers();
    await p.getByRole("button", { name: /Write 3 versions/ }).click();
    row.popupFromWrite = await p.getByText(SIGNUP).count();
    await v.shot("6-signup-from-write");
    await p.mouse.click(5, 5);
    await p.waitForTimeout(400);
    // "My own script": the continue button asks too.
    await p.locator('[aria-label="How do you want to start?"] button', { hasText: "My own script" }).click();
    await p.locator("textarea").first().fill("Noob: Who gave you admin?\nVex: Nobody. I took it.\nNoob: Then I'm taking it back.");
    await p.waitForTimeout(600);
    await p.getByRole("button", { name: /Next: choose length and quality/ }).click();
    row.popupFromScript = await p.getByText(SIGNUP).count();
    row.calls = [...new Set(v.calls)];
    row.sideScroll = await v.sideScroll();
    row.pageErrors = v.errors;
    await v.ctx.close();
  }
  // ── The free plan ──
  {
    const v = await open("free", name, viewport);
    const { p, phone } = v;
    const row = (out[`free-${name}`] = {});
    await v.tab("Examples");
    row.showcase = await v.showcase();
    row.message = await p.getByRole("heading", { name: "Upgrade your plan to make videos like these" }).count();
    row.upgradeButton = await p.locator('section[aria-label="Videos made with Blocky Stories"]').getByRole("button", { name: "See plans", exact: true }).count();
    await v.shot("1-landing");
    await v.tab("Build");
    await v.pickIdea();
    row.ideasAsked = v.calls.includes("getIdeas");
    row.popupAfterIdeas = await p.getByText(PLANS_TITLE).count();
    row.tiers = await v.tiers();
    await v.shot("2-ideas-work");
    await p.getByRole("button", { name: /Write 3 versions/ }).click();
    row.popup = await v.popup();
    await v.shot("3-upgrade-popup");
    await p.getByRole("button", { name: "Not now" }).click();
    await p.waitForTimeout(400);
    await p.locator('[aria-labelledby="bq-quality"] button', { hasText: "V3" }).click();
    row.lockedPopup = await v.popup();
    await v.shot("4-v3-popup");
    await p.getByRole("button", { name: "Not now" }).click();
    row.startDraftCalled = v.calls.includes("startDraft");
    // The button under the videos goes to the pricing page.
    await v.tab("Examples");
    await p.locator('section[aria-label="Videos made with Blocky Stories"]').getByRole("button", { name: "See plans", exact: true }).click();
    await p.waitForURL(/\/pricing/, { timeout: 15_000 }).catch(() => {});
    row.upgradeGoesTo = new URL(p.url()).pathname;
    row.sideScroll = await v.sideScroll();
    row.pageErrors = v.errors;
    await v.ctx.close();
  }
  // ── Paid plans: the tiers ──
  for (const [plan, open_, locked] of [["starter", ["V2"], ["V3", "V4"]], ["pro", ["V2", "V3"], ["V4"]], ["generative", ["V2", "V3", "V4"], []]]) {
    const v = await open(plan, name, viewport);
    const { p } = v;
    const row = (out[`${plan}-${name}`] = {});
    row.showcaseForPaid = (await v.showcase()).videos;   // a paid user sees their own stories, not the showcase
    await v.pickIdea();
    row.tiers = await v.tiers();
    row.gateOnIdeas = (await p.getByText(PLANS_TITLE).count()) + (await p.getByText(SIGNUP).count());
    await v.shot("1-tiers");
    row.popups = {};
    let n = 2;
    for (const tier of locked) {
      await p.locator('[aria-labelledby="bq-quality"] button', { hasText: tier }).click();
      row.popups[tier] = await v.popup();
      await v.shot(`${n++}-${tier.toLowerCase()}-popup`);
      await p.getByRole("button", { name: "Not now" }).click();
      await p.waitForTimeout(400);
    }
    // The highest tier the plan has can be selected, and the cost follows it.
    const top = open_.at(-1);
    await p.locator('[aria-labelledby="bq-quality"] button', { hasText: top }).click();
    await p.waitForTimeout(500);
    row.selected = (await v.tiers()).find((t) => t.endsWith("*")) ?? null;
    row.cost = Number(((await p.locator('section[aria-label="Story builder"]').innerText()).match(/Full video:\s*about\s*([\d,]+)/)?.[1] ?? "").replace(",", "")) || null;
    if (top !== "V2") await v.shot(`${n++}-${top.toLowerCase()}-selected`);
    // Writing goes on to the server (answered here with a refusal: nothing is made).
    await p.getByRole("button", { name: /Write 3 versions/ }).click();
    await p.waitForTimeout(1200);
    row.writeReachedServer = v.calls.includes("startDraft");
    row.gateOnWrite = (await p.getByText(PLANS_TITLE).count()) + (await p.getByText(SIGNUP).count());
    row.sideScroll = await v.sideScroll();
    row.pageErrors = v.errors;
    await v.ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify(out, null, 1));

const tiersAre = (got, want) => JSON.stringify(got) === JSON.stringify(want);
const LOCK3 = "V3 Available on Pro", LOCK4 = "V4 Available on Generative";
// The popup is right: the title, the three lines (the user's own plan marked), the highlighted plans,
// "See plans" to the pricing page, "Not now", no plan named on a button, and all of it inside the screen.
const good = (x, highlighted, yours = null) => x.shown === 1 && JSON.stringify(x.lines).toLowerCase() === JSON.stringify(LINES.map((l) => (yours && l.startsWith(yours + ":") ? l + " Your plan" : l))).toLowerCase()
  && JSON.stringify(x.highlighted) === JSON.stringify(highlighted) && x.button === "See plans" && x.href === "/pricing" && x.notNow === 1 && x.namesAPlan === 0 && x.inside;
const checks = [];
for (const name of ["1440", "390"]) {
  const g = out[`guest-${name}`], f = out[`free-${name}`], s = out[`starter-${name}`], pr = out[`pro-${name}`], ge = out[`generative-${name}`];
  checks.push(
    [`guest ${name}: the showcase, the message and the button`, g.landsOnExamples && g.showcase.videos === 2 && g.showcase.posters === 2 && g.showcase.visible && g.message === 1 && g.signUpButton === 1],
    [`guest ${name}: every button opens the sign-up popup`, g.popupFromShowcase === 1 && g.popupFromIdeas === 1 && g.popupFromWrite === 1 && g.popupFromScript === 1],
    [`guest ${name}: looks around (the library opens), and nothing is asked of the server but the library`, g.libraryAvatars === 52 && g.calls.join() === "listCharacters"],
    [`guest ${name}: V2 open, V3 and V4 locked with where they start`, tiersAre(g.tiers, ["V2 Fast & cheap*", LOCK3, LOCK4])],
    [`free ${name}: the showcase with "Upgrade your plan…" and "See plans" to the pricing page`, f.showcase.videos === 2 && f.message === 1 && f.upgradeButton === 1 && f.upgradeGoesTo === "/pricing"],
    [`free ${name}: ideas work`, f.ideasAsked && f.popupAfterIdeas === 0],
    [`free ${name}: writing opens the upgrade popup (three plans, none pushed, "See plans"), and nothing reaches the server`, good(f.popup, []) && f.startDraftCalled === false],
    [`free ${name}: a locked tier highlights the plans that include it`, good(f.lockedPopup, ["pro", "generative"])],
    [`starter ${name}: V2 only`, tiersAre(s.tiers, ["V2 Fast & cheap*", LOCK3, LOCK4]) && good(s.popups.V3, ["pro", "generative"], "Starter") && good(s.popups.V4, ["generative"], "Starter") && s.selected === "V2 Fast & cheap*"],
    [`pro ${name}: V2 and V3`, tiersAre(pr.tiers, ["V2 Fast & cheap*", "V3 Sharper", LOCK4]) && good(pr.popups.V4, ["generative"], "Pro") && pr.selected === "V3 Sharper*" && pr.cost > s.cost],
    [`generative ${name}: all three`, tiersAre(ge.tiers, ["V2 Fast & cheap*", "V3 Sharper", "V4 Best quality"]) && ge.selected === "V4 Best quality*" && ge.cost > pr.cost && Object.keys(ge.popups).length === 0],
    [`paid plans ${name}: no gate, and writing goes on to the server`, [s, pr, ge].every((x) => x.gateOnIdeas === 0 && x.gateOnWrite === 0 && x.writeReachedServer && x.showcaseForPaid === 0)],
    [`${name}: no sideways scroll and no page errors in any view`, [g, f, s, pr, ge].every((x) => !x.sideScroll && x.pageErrors.length === 0)],
  );
}
for (const [label, pass] of checks) console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
const pass = checks.every(([, x]) => x);
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
