// Browser check of Blocky Stories on the home page ("/"), on a running dev server ($0, read-only).
//   switch on  (Blocky's global switch answered "on" in this browser only), signed out:
//              the card in the "short form suite" row, and Blocky's own section right above Cartoon Drive By
//              (title, "Try Template", four clips playing without sound, looping); a click on either lands
//              on /workspace/blocky-stories in the signed-out view
//   switch off (the live state before launch): neither is on the page, signed out or as the owner
//              (whose own blocky_v1 switch is on: it must not count on Home)
// Screenshots at 1440 and 390 px.
//   node scripts/blocky/qaHome.mjs <outDir> [baseUrl]
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { ROOT, SUPABASE_URL, admin, userSession } from "./lib.mjs";

const require = createRequire(path.join(ROOT, "package.json"));
const { chromium } = require("playwright");
const [outDir, base = "http://localhost:5173"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const BLOCKY = "/workspace/blocky-stories";
const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
const live = (await admin().from("global_feature_flags").select("enabled").eq("key", "blocky_v1").maybeSingle()).data?.enabled === true;
const owner = await userSession();
const { data: { session } } = await owner.client.auth.getSession();
// A browser that plays the clips if this machine has one; the bundled one shows their poster pictures.
const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const out = { liveSwitch: live };

async function open({ viewport, on, signedIn = false }) {
  const phone = viewport.width < 500;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(([key, value, signedIn]) => {
    localStorage.setItem("zyvo_cookie_consent", "declined");
    if (signedIn) localStorage.setItem(key, value);
  }, [`sb-${ref}-auth-token`, JSON.stringify(session), signedIn]);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  if (on) {
    await p.route("**/rest/v1/global_feature_flags*", async (route) => {
      const res = await route.fetch();
      const rows = await res.json().catch(() => []);
      await route.fulfill({ response: res, json: [...rows.filter((r) => r.key !== "blocky_v1"), { key: "blocky_v1", enabled: true }] });
    });
  }
  await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await p.locator('[data-testid="featured-template"]').waitFor({ state: "attached", timeout: 60_000 });
  await p.waitForTimeout(2500);
  await clear(p);
  return { p, ctx, phone, errors };
}
/** Home greets a new visitor with the cookie note and the Long Form welcome popup: both are closed first. */
async function clear(p) {
  await p.getByRole("button", { name: "Decline" }).click({ timeout: 2500 }).catch(() => {});
  await p.getByRole("dialog").getByRole("button", { name: "Close" }).click({ timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(500);
}
const card = (p) => p.locator(`a[href="${BLOCKY}"]:has(img[alt="Blocky Stories"]) >> visible=true`);
/** What the page has of Blocky right now. */
const seen = async (p) => ({
  suiteCards: await card(p).count(),
  section: await p.locator('[data-testid="featured-blocky"]').count(),
  anyLink: await p.locator(`a[href="${BLOCKY}"] >> visible=true`).count(),
  wordOnPage: (await p.locator("#root").innerText()).includes("Blocky Stories"),
});
const signedOutView = async (p) => {
  await p.waitForURL((u) => u.pathname === BLOCKY, { timeout: 30_000 }).catch(() => {});
  await p.getByRole("heading", { name: "Sign up to create your own" }).waitFor({ timeout: 30_000 }).catch(() => {});
  return { path: new URL(p.url()).pathname, signUpMessage: await p.getByRole("heading", { name: "Sign up to create your own" }).count(), showcaseVideos: await p.locator('section[aria-label="Videos made with Blocky Stories"] video').count(), builder: await p.getByText("What's the story?").count() };
};

for (const [name, viewport] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
  // ── The switch on, signed out ──
  {
    const { p, ctx, errors, phone } = await open({ viewport, on: true });
    const row = (out[`on-${name}`] = {});
    Object.assign(row, await seen(p));
    // The row of templates.
    const first = card(p).first();
    await first.scrollIntoViewIfNeeded();
    await p.waitForTimeout(900);
    row.suiteCardBox = await first.evaluate((a) => { const r = a.getBoundingClientRect(); const img = a.querySelector("img"); const row = a.closest("section"); const rr = row.getBoundingClientRect(); return { inside: r.left >= -1 && r.right <= innerWidth + 1, picture: img.complete && img.naturalWidth > 0, name: img.alt, labelShown: row.innerText.includes("Blocky Stories"), isNew: /NEW/.test(a.innerText), offCentre: Math.round(Math.abs((r.left + r.right) / 2 - (rr.left + rr.right) / 2)), fromLeft: Math.round(r.left - rr.left) }; });
    // Where it stands in the row: on a phone the first card at the left; on a computer the card in the middle (the coverflow starts on the first item).
    row.suiteLeads = phone ? row.suiteCardBox.fromLeft < 40 : row.suiteCardBox.offCentre < 60;
    await p.screenshot({ path: path.join(outDir, `home-suite-${name}.png`) });
    // Its own section, right above Cartoon Drive By.
    const section = p.locator('[data-testid="featured-blocky"]');
    await section.scrollIntoViewIfNeeded();
    await p.evaluate(() => { const s = document.querySelector('[data-testid="featured-blocky"]'); (document.getElementById("workspace-scroll") ?? document.scrollingElement).scrollBy(0, s.getBoundingClientRect().top - 70); });
    await p.waitForTimeout(3500);   // the clips start once they are on screen
    row.sectionLayout = await p.evaluate(() => {
      const b = document.querySelector('[data-testid="featured-blocky"]'), c = document.querySelector('[data-testid="featured-template"]');
      const r = (el) => el.getBoundingClientRect();
      const title = b.querySelector("h2"), cta = [...b.querySelectorAll("a")].find((a) => /Try Template/.test(a.textContent));
      const tiles = [...b.querySelectorAll('a[aria-label^="Try the"]')];
      const videos = [...b.querySelectorAll("video")];
      return {
        title: title.textContent.trim(), cartoonTitle: c.querySelector("h2").textContent.trim(),
        aboveCartoon: r(b).bottom <= r(c).top + 1, nothingBetween: b.nextElementSibling === c,
        titleLeftOfButton: r(title).left < r(cta).left, sameLine: Math.abs(r(title).bottom - r(cta).bottom) < 40,
        ctaHref: cta.getAttribute("href"), tiles: tiles.length, tileLinks: tiles.every((a) => a.getAttribute("href") === "/workspace/blocky-stories"),
        tileShape: tiles.map((a) => Math.round((r(a).height / r(a).width) * 100) / 100),
        sameTileSizeAsCartoon: Math.abs(r(tiles[0]).width - r(c.querySelector('a[aria-label^="Try the"]')).width) < 1,
        videos: videos.length, muted: videos.every((v) => v.muted), loop: videos.every((v) => v.loop), playing: videos.filter((v) => !v.paused && v.readyState >= 2).length,
        posters: [...b.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth > 0).length,
      };
    });
    await p.screenshot({ path: path.join(outDir, `home-section-${name}.png`) });
    row.sideScroll = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    // "Try Template" → the signed-out Blocky view.
    await section.getByRole("link", { name: /Try Template/ }).click();
    row.fromTryTemplate = await signedOutView(p);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(outDir, `home-lands-${name}.png`) });
    // A clip in the section, and the card in the row, lead to the same place.
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await p.locator('[data-testid="featured-blocky"]').waitFor({ timeout: 60_000 });
    await clear(p);
    await p.locator('[data-testid="featured-blocky"] a[aria-label^="Try the"]').first().click();
    row.fromClip = await signedOutView(p);
    await p.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await card(p).first().waitFor({ timeout: 60_000 });
    await clear(p);
    await card(p).first().click();
    row.fromSuiteCard = await signedOutView(p);
    row.pageErrors = errors;
    await ctx.close();
  }
  // ── The switch as it is on the live site ──
  for (const who of ["signedOut", "owner"]) {
    const { p, ctx, errors } = await open({ viewport, on: false, signedIn: who === "owner" });
    out[`live-${who}-${name}`] = { ...(await seen(p)), cartoonSection: await p.locator('[data-testid="featured-template"]').count(), pageErrors: errors };
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify(out, null, 1));

const lands = (x) => x.path === BLOCKY && x.signUpMessage === 1 && x.showcaseVideos === 2 && x.builder >= 1;
const checks = [];
for (const name of ["1440", "390"]) {
  const on = out[`on-${name}`], s = on.sectionLayout;
  checks.push(
    [`${name}, switch on: Blocky Stories leads the "short form suite" row, with its picture, its name and NEW`, on.suiteCards >= 1 && on.suiteCardBox.picture && on.suiteCardBox.name === "Blocky Stories" && on.suiteCardBox.labelShown && on.suiteCardBox.isNew && on.suiteCardBox.inside && on.suiteLeads],
    [`${name}, switch on: its own section sits directly above Cartoon Drive By`, on.section === 1 && s.title === "Blocky Stories" && s.cartoonTitle === "Cartoon Drive By" && s.aboveCartoon && s.nothingBetween],
    [`${name}, switch on: the section is built like Cartoon Drive By (title left, Try Template right, a row of tall clips)`, s.titleLeftOfButton && s.sameLine && s.ctaHref === BLOCKY && s.tiles === 4 && s.tileLinks && s.tileShape.every((x) => Math.abs(x - 16 / 9) < 0.03) && s.sameTileSizeAsCartoon],
    [`${name}, switch on: four clips; the ones on screen play, without sound, looping`, s.tiles === 4 && s.posters >= 4 && s.videos >= (name === "390" ? 2 : 4) && s.muted && s.loop && s.playing === s.videos],
    [`${name}, switch on, signed out: Try Template, a clip and the card all land on the signed-out Blocky view`, lands(on.fromTryTemplate) && lands(on.fromClip) && lands(on.fromSuiteCard)],
    [`${name}, switch on: no sideways scroll, no page errors`, !on.sideScroll && on.pageErrors.length === 0],
  );
  if (!live) for (const who of ["signedOut", "owner"]) {
    const x = out[`live-${who}-${name}`];
    checks.push([`${name}, before launch, ${who === "owner" ? "the owner (own switch on)" : "signed out"}: nothing of Blocky on Home`, x.suiteCards === 0 && x.section === 0 && x.cartoonSection === 1 && (who === "owner" || (x.anyLink === 0 && !x.wordOnPage)) && x.pageErrors.length === 0]);
  }
}
for (const [label, pass] of checks) console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
const pass = checks.every(([, x]) => x);
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
