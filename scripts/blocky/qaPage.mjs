// Browser check of the Blocky Stories page on a running dev server, signed in
// as the owner ($0: it never presses a button that writes or makes anything).
// It checks that the page talks to the live Blocky functions: the three
// avatars load in the library, the Story step offers "Ideas", "Describe it"
// and "My own script", and the Settings step shows real prices from the server.
// Then the ideas and the three versions, with the four writing actions answered
// by this script instead of the server (no model call, nothing saved): the idea
// cards, the cards filling in one by one, and the pick buttons.
// Screenshots at 1440 and 390 px.
//   node scripts/blocky/qaPage.mjs <outDir> [baseUrl]
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { ROOT, SUPABASE_URL, userSession } from "./lib.mjs";

const require = createRequire(path.join(ROOT, "package.json"));
const { chromium } = require("playwright");
const [outDir, base = "http://localhost:5173"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const { client } = await userSession();
const { data: { session } } = await client.auth.getSession();
const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
const browser = await chromium.launch();
const out = {};

// The writing actions, answered here. Everything else goes to the live function.
const LINES = [
  ["I found the owner's badge. Now I ban whoever I want.", "That badge only works for the owner, Vex."],
  ["Watch me. Noob, you're banned in three, two...", "Read the back of it first."],
  ["It says: property of Noob. Wait.", "I made this server, Vex. Hand it over."],
];
function fakeApi(ids) {
  // ids fills in when the library has loaded: read it when asked, not now. [0] is Noob, [1] is Vex.
  const lines = () => LINES.flatMap(([x, y]) => [{ speakerId: ids[1], line: x }, { speakerId: ids[0], line: y }]);
  const version = (n, status) => ({
    n, status, vetted: n === 1,
    title: ["The Owner's Badge", "Banned in Three", "Read the Back"][n - 1],
    hook: ["Vex finds a badge that can ban anyone. It isn't Vex's.", "A countdown to a ban that hits the wrong avatar.", "The smallest print on the badge decides everything."][n - 1],
    lines: status === "ready" ? lines() : [], lengthSec: status === "ready" ? 30 : null,
    ...(status === "failed" ? { error: "We couldn't write this version. Pick another one, or write three new ones." } : {}),
  });
  const state = { 1: "writing", 2: "writing", 3: "writing" };
  const draft = () => ({ id: "00000000-0000-4000-8000-000000000001", status: "writing", picked: null, storyId: null, versions: [1, 2, 3].map((n) => version(n, state[n])), left: 4 });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  return {
    async getIdeas() {
      await wait(600);
      return ["The Owner's Badge", "One Trade Too Many", "The Glitched Door", "Ten Seconds Left", "The New Rule"].map((title, i) => ({
        id: i === 0 ? "plan:owners-badge" : `idea:0:t${i}`, vetted: i === 0, type: `t${i}`, title, castIds: i % 2 ? [ids[1], ids[0]] : [ids[0], ids[1]],
        hook: ["Vex finds a badge that can ban anyone.", "Noob trades a pet for the rarest item on the server.", "A door that only opens for avatars who lost.", "The round ends in ten seconds and nobody has the key.", "A new server rule, and only one avatar read it."][i],
        summary: "A short story with a twist in the second half and a last line the winner gets.",
      }));
    },
    async startDraft() { await wait(1500); return draft(); },
    async writeVersion(body) { await wait(body.n * 1800); state[body.n] = body.n === 3 ? "failed" : "ready"; return draft(); },
    async getDraft() { return draft(); },
    // The pick: the polishing wait, then a refusal (a real pick makes a story; this check makes nothing).
    async pickVersion() { await wait(2500); throw { code: "PLANNER_FAILED", message: "PLANNER_FAILED" }; },
  };
}

for (const [name, viewport] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
  const phone = viewport.width < 500;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(([key, value]) => { localStorage.setItem(key, value); localStorage.setItem("zyvo_cookie_consent", "declined"); }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  const p = await ctx.newPage();
  const libraryIds = [];
  let fake = null;
  const faked = [];
  await p.route("**/functions/v1/blocky-story-api", async (route) => {
    const body = route.request().postDataJSON?.() ?? {};
    if (body.action === "listCharacters") {
      const res = await route.fetch();
      const json = await res.json().catch(() => null);
      for (const c of json?.data ?? []) libraryIds.push(c.id);
      return route.fulfill({ response: res });
    }
    fake ??= fakeApi(libraryIds);
    if (!fake[body.action]) return route.continue();
    faked.push(body.action);
    const answer = await fake[body.action](body).then((data) => ({ ok: true, data }), (e) => ({ ok: false, ...e }));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(answer) });
  });
  const apiCalls = [];
  p.on("response", (r) => { if (/functions\/v1\/(blocky|fruit)/.test(r.url())) apiCalls.push(`${r.url().split("/functions/v1/")[1]} ${r.status()}`); });
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  await p.goto(`${base}/workspace/blocky-stories`, { waitUntil: "networkidle" });
  for (const label of ["Maybe later", "Decline"]) { const b = p.getByRole("button", { name: label }); if (await b.count().catch(() => 0)) await b.first().click({ timeout: 2000 }).catch(() => {}); }
  await p.waitForTimeout(1200);
  const row = { landedOn: new URL(p.url()).pathname };
  row.title = await p.locator('section[aria-label="Story builder"] h1').first().innerText().catch(() => null);
  row.methods = await p.locator('[aria-label="How do you want to start?"] button').allInnerTexts().catch(() => []);
  row.couldntLoad = await p.getByText(/couldn.t load/i).count();
  // Series is behind its own switch (off): no "Single video / Series" choice in the builder, no "Series" tab in Recent creations.
  row.builderSeriesTab = await p.locator('[aria-label="What are you making?"]').count();
  row.recentSeriesTab = await p.locator('[aria-label="Show"]').count();
  row.seriesWordOnPage = await p.getByText(/\bseries\b/i).count();
  // The page opens on Ideas, and no idea is asked for until the button is pressed.
  row.askIdeasButton = await p.getByRole("button", { name: "Give me ideas" }).count();
  // It is a main button like the others (full width of its card, room around the words), and the Ideas tab has
  // no "Next" bar: an idea leads to its three versions.
  row.askIdeasBox = await p.getByRole("button", { name: "Give me ideas" }).evaluate((b) => { const r = b.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(b); const s = range.getBoundingClientRect(); const cs = getComputedStyle(b.parentElement); const inner = b.parentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); return { width: Math.round(r.width), height: Math.round(r.height), share: Math.round((r.width / inner) * 100), sideRoom: Math.round(Math.min(s.left - r.left, r.right - s.right)) }; }).catch(() => null);
  row.nextOnIdeas = await p.getByRole("button", { name: /Next: choose length/ }).count();
  row.ideasAskedOnLoad = faked.includes("getIdeas");
  await p.screenshot({ path: path.join(outDir, `page-${name}.png`) });
  await p.locator('[aria-label="How do you want to start?"] button', { hasText: "Describe it" }).click();
  // The library: opened from "Add character".
  await p.getByRole("button", { name: /Add character/ }).first().click();
  await p.waitForTimeout(1200);
  const dialog = p.getByRole("dialog").last();
  row.libraryNames = await dialog.locator("button[aria-pressed] span.font-black").allInnerTexts().catch(() => []);
  row.libraryPictures = await dialog.locator("button[aria-pressed] img").evaluateAll((imgs) => imgs.filter((i) => i.complete && i.naturalWidth > 0).length).catch(() => 0);
  await p.screenshot({ path: path.join(outDir, `library-${name}.png`) });
  for (const who of ["Noob", "Vex"]) await dialog.locator("button[aria-pressed]", { hasText: who }).first().click().catch(() => {});
  await dialog.getByRole("button", { name: "Done" }).click().catch(() => {});
  await p.locator("#fv2-prompt").fill("Noob trades a starter pet for Vex's rarest item, and the pet turns out to be the server's owner.");
  // "Describe it" offers the three versions straight away, like Ideas; the settings are one link away.
  row.writeOnDescribe = await p.getByRole("button", { name: /Write 3 versions/ }).count();
  row.nextOnDescribe = await p.getByRole("button", { name: /Next: choose length/ }).count();
  await p.waitForTimeout(600);   // the library dialog's closing animation
  await p.screenshot({ path: path.join(outDir, `describe-${name}.png`) });
  await p.getByRole("button", { name: "Change length or quality" }).first().click();
  await p.waitForTimeout(2500);
  // Settings: prices come from the server (quote_tool_prices); nothing is charged for looking.
  row.settingsHeading = await p.getByText("How should it look?").count();
  row.shapeChoice = await p.locator('[aria-label="Video shape"]').count();
  row.writeButton = (await p.getByRole("button", { name: /Write 3 versions/ }).first().innerText().catch(() => "")).replace(/\s+/g, " ");
  row.costText = (await p.locator('section[aria-label="Story builder"]').innerText()).match(/Pictures \((\d+)\) are made after you pick a version, and the rest \(about (\d+)\)/)?.slice(1, 3) ?? null;
  await p.screenshot({ path: path.join(outDir, `settings-${name}.png`) });

  // Ideas and the three versions (answered by this script, see fakeApi).
  await p.getByRole("button", { name: "Back", exact: true }).first().click();
  await p.locator('[aria-label="How do you want to start?"] button', { hasText: "Ideas" }).click();
  await p.getByRole("button", { name: "Give me ideas" }).click();
  await p.waitForTimeout(1500);
  row.ideaCards = await p.locator('section[aria-label="Story builder"] button[aria-pressed]', { hasText: /Badge|Trade|Door|Seconds|Rule/ }).count();
  await p.screenshot({ path: path.join(outDir, `ideas-${name}.png`) });
  row.barBeforePick = await p.getByRole("button", { name: /Write 3 versions|Next: choose length/ }).count();
  await p.locator('section[aria-label="Story builder"] button[aria-pressed]', { hasText: "The Owner's Badge" }).click();
  await p.waitForTimeout(400);
  row.nextAfterPick = await p.getByRole("button", { name: /Next: choose length/ }).count();
  row.changeSettingsLink = await p.getByRole("button", { name: "Change length or quality" }).count();
  await p.screenshot({ path: path.join(outDir, `idea-picked-${name}.png`) });
  await p.getByRole("button", { name: /Write 3 versions/ }).first().click();
  await p.waitForTimeout(700);
  row.planningHeading = await p.getByText("Planning three versions…").count();
  await p.screenshot({ path: path.join(outDir, `versions-planning-${name}.png`) });
  await p.waitForTimeout(3200);   // version 1 is in, 2 and 3 are still being written
  row.readyWhileWriting = await p.getByRole("button", { name: "Use this version" }).count();
  row.writingHeading = (await p.getByText(/Writing… \d of 3 ready/).first().innerText().catch(() => null));
  await p.screenshot({ path: path.join(outDir, `versions-writing-${name}.png`), fullPage: true });
  await p.waitForTimeout(4500);
  row.pickHeading = await p.getByText("Pick your version").count();
  row.pickButtons = await p.getByRole("button", { name: "Use this version" }).count();
  row.failedCard = await p.getByText("We couldn't write this version.").count();
  row.leftToday = await p.getByText("4 free writings left today").count();
  row.namedSpeakers = await p.getByText(/^(Noob|Vex): /).count();
  row.sideScroll = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await p.screenshot({ path: path.join(outDir, `versions-${name}.png`), fullPage: true });
  if (phone) {
    // The page's own scroller: the second card, the failed one and the row under the cards.
    for (const [i, top] of [[2, 900], [3, 99999]]) {
      await p.evaluate((y) => document.getElementById("workspace-scroll")?.scrollTo(0, y), top);
      await p.waitForTimeout(300);
      await p.screenshot({ path: path.join(outDir, `versions-${name}-part${i}.png`) });
    }
    await p.evaluate(() => document.getElementById("workspace-scroll")?.scrollTo(0, 0));
  }
  await p.getByRole("button", { name: "Use this version" }).first().click();
  await p.waitForTimeout(900);
  row.polishing = await p.getByText("Polishing your pick…").count();
  await p.screenshot({ path: path.join(outDir, `versions-picking-${name}.png`) });
  await p.waitForTimeout(2600);
  row.pickRefusedText = (await p.getByText(/couldn.t finish this version/).first().innerText().catch(() => null));
  row.pickButtonsAfter = await p.getByRole("button", { name: "Use this version" }).count();
  await p.screenshot({ path: path.join(outDir, `versions-pick-failed-${name}.png`) });
  row.faked = [...new Set(faked)];
  row.apiCalls = [...new Set(apiCalls)];
  row.pageErrors = errors;
  out[name] = row;
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
const ok = Object.values(out).every((v) => v.landedOn === "/workspace/blocky-stories" && v.title === "Blocky Stories" && v.couldntLoad === 0
  && v.builderSeriesTab === 0 && v.recentSeriesTab === 0 && v.seriesWordOnPage === 0
  && JSON.stringify(v.libraryNames) === JSON.stringify(["Noob", "Vex", "Lux"]) && v.libraryPictures === 3 && v.settingsHeading === 1 && v.shapeChoice === 0
  && v.askIdeasButton === 1 && v.ideasAskedOnLoad === false && /Write 3 versions/.test(v.writeButton) && v.ideaCards === 5
  && v.writeOnDescribe === 1 && v.nextOnDescribe === 0 && v.nextOnIdeas === 0 && v.barBeforePick === 0 && v.nextAfterPick === 0 && v.changeSettingsLink === 1 && v.askIdeasBox?.share >= 95 && v.askIdeasBox?.sideRoom >= 16
  && v.polishing >= 1 && Boolean(v.pickRefusedText) && v.pickButtonsAfter === 2
  && v.planningHeading >= 1 && v.readyWhileWriting === 1 && v.pickHeading >= 1 && v.pickButtons === 2 && v.failedCard === 1 && v.leftToday === 1 && v.namedSpeakers === 12 && v.sideScroll === false
  && v.costText && v.apiCalls.some((c) => /^blocky-story-api 200/.test(c)) && !v.apiCalls.some((c) => /^fruit/.test(c)) && v.pageErrors.length === 0);
console.log(ok ? "PASS" : "FAIL");
process.exitCode = ok ? 0 : 1;
