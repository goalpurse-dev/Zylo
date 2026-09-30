// Stage 3h QA ($0): the real v2 UI signed in as the test account, on the
// local dev server (VITE_FRUIT_V2=true), at desktop and phone widths.
// Screenshots: Recent (real + earlier-version stories), a finished story,
// an earlier-version story (read-only), and the Settings cost card.
//   node scripts/fruit-story/qa3h.mjs <outDir> [baseUrl]
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { ROOT, userSession } from "./lib.mjs";

const require = createRequire(path.join(ROOT, "package.json"));
const { chromium } = require("playwright");
const [outDir, base = "http://localhost:5180"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const { client } = await userSession();
const { data: { session } } = await client.auth.getSession();
const ref = new URL(process.env.VITE_SUPABASE_URL).hostname.split(".")[0];
const browser = await chromium.launch();
const report = [];
const note = (m) => { console.log(m); report.push(m); };

async function page(viewport, name) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 500 ? 2 : 1, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  await ctx.addInitScript(([key, value]) => { localStorage.setItem(key, value); }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  p.on("response", (r) => { if (r.url().includes("fruit-story-api") && r.status() >= 400) errors.push(`fruit-story-api HTTP ${r.status()}`); });
  const shot = async (label) => {
    for (const l of ["Maybe later", "Decline"]) { const b = p.getByRole("button", { name: l }); if (await b.count().catch(() => 0)) await b.first().click({ timeout: 2000 }).catch(() => {}); }
    const file = path.join(outDir, `${name}-${label}.png`);
    await p.screenshot({ path: file, fullPage: false });
    return file;
  };
  // First-visit site popups (Creator Rewards, cookies) aren't part of Fruit: close them.
  const dismiss = async () => {
    // They can open a moment after load, so look a few times.
    for (let i = 0; i < 4; i++) {
      for (const label of ["Maybe later", "Decline"]) {
        const b = p.getByRole("button", { name: label });
        if (await b.count().catch(() => 0)) await b.first().click({ timeout: 3000 }).catch(() => {});
      }
      await p.waitForTimeout(1000);
    }
  };
  const goHome = async () => { await p.goto(`${base}/workspace/ai-fruit-story`, { waitUntil: "networkidle" }); await p.waitForTimeout(1500); await dismiss(); };
  return { ctx, p, errors, shot, goHome, dismiss };
}

for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  const { ctx, p, errors, shot, goHome, dismiss } = await page(viewport, name);
  const phone = viewport.width < 500;
  // dispatchEvent: a late site popup can cover the tab bar; the tab still gets the click.
  const resultTab = async () => { if (phone) await p.getByRole("tab").nth(1).dispatchEvent("click"); };
  const buildTab = async () => { if (phone) await p.getByRole("tab").nth(0).dispatchEvent("click"); };

  await goHome();
  await p.getByText("Recent creations").first().waitFor({ timeout: 30_000 }).catch(() => {});
  if (phone) await resultTab();
  await p.waitForTimeout(2500);
  const preview = await p.getByText("Preview mode. Nothing is charged or saved.").count();
  note(`${name}: preview banner shown: ${preview > 0 ? "YES (bad)" : "no"}`);
  const cards = await p.getByRole("button", { name: "Open" }).count();
  const earlier = await p.getByText("Earlier version", { exact: false }).count();
  note(`${name}: recent singles: ${cards} (earlier-version: ${earlier})`);
  await shot("1-recent");

  // A finished story: the 3e/3f "Glass Walls" story.
  const card = p.locator("article", { hasText: "Glass Walls" }).first();
  if (await card.count()) {
    await card.getByRole("button", { name: "Open" }).click();
    await p.waitForTimeout(4000);
    if (phone) await resultTab();
    await p.waitForTimeout(1500);
    const video = await p.locator("video").count();
    note(`${name}: Glass Walls opened; videos on screen: ${video}`);
    await shot("2-final");
    if (phone) { await buildTab(); await p.waitForTimeout(800); await shot("2b-final-build"); }
    await goHome();
    await p.waitForTimeout(2000);
  } else note(`${name}: Glass Walls card not found`);

  // An earlier-version story, read-only.
  if (phone) await resultTab();
  const old = p.locator("article", { hasText: "Earlier version" }).first();
  if (await old.count()) {
    await old.getByRole("button", { name: "Open" }).click();
    await p.waitForTimeout(4000);
    if (phone) await resultTab();
    await p.waitForTimeout(1000);
    const editButtons = await p.getByRole("button", { name: /Edit scene|Regenerate/ }).count();
    note(`${name}: earlier-version story opened; edit/regenerate buttons: ${editButtons} (want 0)`);
    await shot("3-earlier");
    await goHome();
    await p.waitForTimeout(2000);
  }

  // Settings: pick the first idea, go to settings, read the cost card (default 20 s).
  if (phone) await buildTab();
  const idea = p.locator("button[aria-pressed].grid").first();
  await idea.waitFor({ timeout: 30_000 }).catch(() => {});
  if (await idea.count()) {
    await idea.click();
    await p.getByRole("button", { name: /Next: choose length and quality/ }).click();
    await p.waitForTimeout(3000);
    const cost = await p.locator("text=Estimated total").first().locator("xpath=ancestor::div[2]").innerText().catch(() => "");
    const lengthHint = await p.locator("#fv2-length").inputValue().catch(() => "");
    note(`${name}: settings length=${lengthHint}s · cost card: ${cost.replace(/\s+/g, " ").trim()}`);
    await p.locator("text=Estimated total").first().scrollIntoViewIfNeeded().catch(() => {});
    await shot("4-settings");
  } else note(`${name}: no idea cards found`);

  // Series: list → plan/roadmap → episode 1 (pictures ready: scene actions with prices).
  await goHome();
  if (phone) await buildTab();
  await p.getByText("Episodes with cliffhangers").first().click().catch(() => {});
  await p.waitForTimeout(2500);
  const seriesBtn = p.getByRole("button", { name: /The Second Phone Next Door/ }).first();
  if (await seriesBtn.count()) {
    await seriesBtn.click();
    await p.waitForTimeout(3000);
    await shot("5-series-plan");
    if (phone) { await resultTab(); await p.waitForTimeout(1200); await shot("5b-roadmap"); }
    const make = p.getByRole("button", { name: /Make episode 1/ }).first();
    if (await make.count()) {
      await make.click();
      await p.waitForTimeout(4000);
      if (phone) await resultTab();
      await p.waitForTimeout(1500);
      const chips = await p.getByRole("button", { name: /(Edit|Regenerate) scene \d+, 4 credits/ }).count();
      note(`${name}: episode 1 storyboard: scene buttons priced at 4 credits: ${chips}`);
      await shot("6-episode-board");
      if (phone) { await buildTab(); await p.waitForTimeout(800); await shot("6b-episode-build"); }
    } else note(`${name}: no "Make episode 1" button`);
  } else note(`${name}: series not found in the list`);

  const horiz = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  note(`${name}: horizontal page scroll: ${horiz ? "YES (bad)" : "no"}`);
  note(`${name}: console/page errors: ${errors.length ? errors.join(" | ") : "none"}`);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, "report.txt"), report.join("\n"));
