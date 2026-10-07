// Browser check of the Blocky Stories menu entries on a running dev server ($0):
//   flag ON  (signed in as the owner, whose blocky_v1 flag is on): the entry is in the desktop
//            Short Form panel and the mobile Short Form menu, right after AI Fruit Story, and the page opens;
//   flag OFF (signed out): no entry anywhere, and the route lands on the home page, "/".
// Screenshots at 1440 and 390 px.
//   node scripts/blocky/qaMenus.mjs <outDir> [baseUrl]
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { ROOT, userSession } from "./lib.mjs";
import { BLOCKY_STORIES_NAME } from "../../supabase/functions/_shared/blocky/names.js";

const require = createRequire(path.join(ROOT, "package.json"));
const { chromium } = require("playwright");
const [outDir, base = "http://localhost:5173"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const { client } = await userSession();
const { data: { session } } = await client.auth.getSession();
const ref = new URL(process.env.VITE_SUPABASE_URL).hostname.split(".")[0];
const browser = await chromium.launch();
const out = {};

async function open(viewport, signedIn) {
  const phone = viewport.width < 500;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  if (signedIn) await ctx.addInitScript(([key, value]) => { localStorage.setItem(key, value); }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  // No cookie banner or first-visit popups in the screenshots.
  await ctx.addInitScript(() => { try { localStorage.setItem("zyvo_cookie_consent", "declined"); } catch { /* ignore */ } });
  const p = await ctx.newPage();
  const dismiss = async () => {
    for (let i = 0; i < 3; i++) {
      for (const label of ["Maybe later", "Decline"]) { const b = p.getByRole("button", { name: label }); if (await b.count().catch(() => 0)) await b.first().click({ timeout: 2000 }).catch(() => {}); }
      await p.waitForTimeout(700);
    }
  };
  return { ctx, p, phone, dismiss };
}

/** The labels in the open Short Form menu, in order. */
async function menuLabels(p, phone) {
  if (phone) {
    await p.locator(".ftg-bottom-nav button", { hasText: "Short" }).first().click();
    await p.locator('section[aria-label="Short Form menu"]').waitFor({ timeout: 10_000 });
    await p.waitForTimeout(700);
    return p.locator('section[aria-label="Short Form menu"] .grid button span').allInnerTexts();
  }
  await p.locator("nav button", { hasText: "Short Form" }).first().click();
  await p.waitForTimeout(900);
  return p.locator(".zyvo-popover-panel", { hasText: "Viral Tools" }).locator("button.zyvo-panel-item span.flex-1").allInnerTexts();
}

for (const [name, viewport] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
  for (const signedIn of [true, false]) {
    const key = `${name}-${signedIn ? "flag-on" : "flag-off"}`;
    const { ctx, p, phone, dismiss } = await open(viewport, signedIn);
    await p.goto(`${base}/workspace/ai-fruit-story`, { waitUntil: "networkidle" });
    await p.waitForTimeout(2500);   // the flags load after the page
    await dismiss();
    const labels = (await menuLabels(p, phone)).map((s) => s.trim()).filter(Boolean);
    await p.screenshot({ path: path.join(outDir, `menu-${key}.png`) });
    const at = labels.indexOf(BLOCKY_STORIES_NAME);
    const row = { labels, inMenu: at >= 0, rightAfterFruit: at > 0 && labels[at - 1] === "AI Fruit Story" };
    if (at >= 0) {
      const thumb = phone
        ? p.locator('section[aria-label="Short Form menu"] .grid button', { hasText: BLOCKY_STORIES_NAME }).locator("img")
        : p.locator(".zyvo-popover-panel button.zyvo-panel-item", { hasText: BLOCKY_STORIES_NAME }).locator("img");
      row.thumbnailLoaded = await thumb.first().evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false);
      row.thumbnailSrc = await thumb.first().getAttribute("src").catch(() => null);
    }
    // The route itself.
    await p.goto(`${base}/workspace/blocky-stories`, { waitUntil: "networkidle" });
    await p.waitForTimeout(2500);
    await dismiss();
    row.routeLandsOn = new URL(p.url()).pathname;
    row.builderTitle = await p.locator('section[aria-label="Story builder"] h1').first().innerText({ timeout: 3000 }).catch(() => null);
    row.fruitCharactersShown = await p.getByText(/Mango|Peach|Pineapple/).count();
    await p.screenshot({ path: path.join(outDir, `page-${key}.png`) });
    out[key] = row;
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
const on = Object.entries(out).filter(([k]) => k.endsWith("flag-on")).map(([, v]) => v);
const off = Object.entries(out).filter(([k]) => k.endsWith("flag-off")).map(([, v]) => v);
const ok = on.every((v) => v.inMenu && v.rightAfterFruit && v.thumbnailLoaded && v.routeLandsOn === "/workspace/blocky-stories" && v.builderTitle === BLOCKY_STORIES_NAME && v.fruitCharactersShown === 0)
  && off.every((v) => !v.inMenu && v.routeLandsOn === "/" && !v.builderTitle);
console.log(ok ? "PASS" : "FAIL");
process.exitCode = ok ? 0 : 1;
