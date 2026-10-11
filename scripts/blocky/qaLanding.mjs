// Browser check of Blocky Stories' public page on a server of the built site (dist/), signed out ($0,
// read-only). Screenshots of every section at 1440 and 390 px, and what a visitor gets: one H1, the hero
// clip playing without sound, the examples, live plan numbers, the questions, and the button's destination.
//   node scripts/blocky/qaLanding.mjs <outDir> [baseUrl=http://localhost:4173]
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { ROOT } from "./lib.mjs";
import { BLOCKY_LANDING_PATH, BLOCKY_LANDING_SEO, BLOCKY_NOTICE, blockyPlanRows } from "../../src/data/blockyStoryLanding.js";

const require = createRequire(path.join(ROOT, "package.json"));
const { chromium } = require("playwright");
const [outDir, base = "http://localhost:4173"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" }).catch(() => chromium.launch());
const out = {};

for (const [name, viewport] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
  const phone = viewport.width < 500;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(() => localStorage.setItem("zyvo_cookie_consent", "declined"));
  const p = await ctx.newPage();
  const errors = [];
  const videoRequests = [];
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  p.on("console", (m) => { if (m.type() === "error" && /hydrat|did not match|Minified React error/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
  p.on("request", (r) => { if (/\.mp4(\?|$)/.test(r.url())) videoRequests.push(r.url().split("/").pop()); });
  const row = (out[name] = {});
  await p.goto(`${base}${BLOCKY_LANDING_PATH}`, { waitUntil: "load", timeout: 120_000 });
  await p.waitForTimeout(1200);
  // Nothing has been touched yet: the first load is the text and the posters only.
  row.videosBeforeAnything = [...videoRequests];
  row.title = await p.title();
  row.h1 = await p.locator("h1").allInnerTexts();
  await p.screenshot({ path: path.join(outDir, `landing-0-first-visit-${name}.png`) });   // as a first visit sees it, the cookie note included
  await p.getByRole("button", { name: "Decline" }).click({ timeout: 3000 }).catch(() => {});   // the site's cookie note covers the page until it is answered
  // The first screen: the heading and the button are on it.
  row.firstScreen = await p.evaluate(() => { const r = (el) => el?.getBoundingClientRect(); const h = r(document.querySelector("h1")); const b = r([...document.querySelectorAll("a")].find((a) => /Make your first story/.test(a.textContent))); return { h1: h.top >= 0 && h.bottom <= innerHeight, button: b.top >= 0 && b.bottom <= innerHeight }; });
  await p.screenshot({ path: path.join(outDir, `landing-1-hero-${name}.png`) });
  // The hero clip starts by itself a moment after the page has loaded, without sound.
  await p.waitForTimeout(5000);
  row.hero = await p.evaluate(() => { const v = document.querySelector("figure video"); return v ? { playing: !v.paused && v.readyState >= 2, muted: v.muted, loop: v.loop } : null; });
  row.soundButton = await p.getByRole("button", { name: "Sound off" }).count();
  if (phone) { await p.locator("figure").first().scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(outDir, `landing-1b-hero-clip-${name}.png`) }); }
  // Section by section.
  const sections = [["examples", "2-examples"], ["how-it-works", "3-how-it-works"], ["features", "4-features"], ["who-its-for", "5-who-its-for"], ["plans", "6-plans"], ["faq", "7-faq"], ["more-tools", "8-more-tools"], ["start", "9-final"]];
  for (const [id, label] of sections) {
    // Whatever element scrolls the page: bring the heading to the top, then leave room for the header.
    await p.evaluate((sectionId) => document.getElementById(sectionId).scrollIntoView({ block: "start" }), id);
    await p.mouse.wheel(0, -96);
    await p.waitForTimeout(id === "examples" ? 3500 : 700);
    if (id === "examples") row.examples = await p.evaluate(() => { const list = document.getElementById("examples").closest("section"); const vs = [...list.querySelectorAll("video")]; return { clips: list.querySelectorAll("li").length, videos: vs.length, playing: vs.filter((v) => !v.paused && v.readyState >= 2).length, muted: vs.every((v) => v.muted && v.loop) }; });
    if (id === "faq") { await p.locator("details summary").first().click(); await p.waitForTimeout(300); }
    await p.screenshot({ path: path.join(outDir, `landing-${label}-${name}.png`) });
  }
  row.plans = await p.locator('[data-testid="blocky-plans"] > li').evaluateAll((items) => items.map((li) => li.innerText.replace(/\s+/g, " ").trim()));
  row.questions = await p.locator("details summary").count();
  row.notice = await p.locator('[data-testid="blocky-notice"]').innerText().catch(() => null);
  row.headerLime = await p.evaluate(() => [...document.querySelectorAll("header a, header button")].some((el) => /bg-lime-300/.test(el.className)));
  row.sideScroll = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  await p.screenshot({ path: path.join(outDir, `landing-full-${name}.png`), fullPage: true });
  // The button: the tool, where a signed-out visitor gets the signed-out view.
  row.ctaHref = await p.getByRole("link", { name: /Make your first story/ }).first().getAttribute("href");
  row.pricingLink = await p.getByRole("link", { name: "See plans and prices" }).getAttribute("href");
  row.pageErrors = errors;
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));

const expected = blockyPlanRows().map((plan) => plan.tiers.map((t) => `${t.label} · ${t.tag.toLowerCase()} about ${t.stories} stories`));
const checks = [];
for (const name of ["1440", "390"]) {
  const v = out[name];
  checks.push(
    [`${name}: the page's title and one H1`, v.title === BLOCKY_LANDING_SEO.title && v.h1.length === 1 && v.h1[0].toLowerCase() === BLOCKY_LANDING_SEO.h1.toLowerCase()],
    [`${name}: the heading and "Make your first story" are on the first screen`, v.firstScreen.h1 && v.firstScreen.button],
    [`${name}: no video file is fetched before the page has loaded`, v.videosBeforeAnything.length === 0],
    [`${name}: the hero clip plays by itself, without sound, looping, with a sound button`, v.hero?.playing && v.hero.muted && v.hero.loop && v.soundButton === 1],
    [`${name}: four example clips; the ones on screen play without sound`, v.examples.clips === 4 && v.examples.videos >= 2 && v.examples.playing === v.examples.videos && v.examples.muted],
    [`${name}: each plan shows its tiers and about how many stories (live prices; the same as the repo's)`, v.plans.length === 3 && v.plans.every((text, i) => expected[i].every((line) => text.includes(line)))],
    [`${name}: the questions, and the notice above the footer`, v.questions === 8 && v.notice === BLOCKY_NOTICE],
    [`${name}: the buttons lead to the tool and to pricing; the header is lime`, v.ctaHref === "/workspace/blocky-stories" && v.pricingLink === "/pricing" && v.headerLime],
    [`${name}: no sideways scroll, no page or hydration errors`, !v.sideScroll && v.pageErrors.length === 0],
  );
}
for (const [label, pass] of checks) console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
const pass = checks.every(([, x]) => x);
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
