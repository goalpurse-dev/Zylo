// Browser check of the Blocky Stories page on a running dev server, signed in
// as the owner ($0: it never presses a button that writes or makes anything).
// It checks that the page talks to the live Blocky functions: the three
// avatars load in the library, the Story step offers "Describe it" and "My own
// script", and the Settings step shows real prices from the server.
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

for (const [name, viewport] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
  const phone = viewport.width < 500;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(([key, value]) => { localStorage.setItem(key, value); localStorage.setItem("zyvo_cookie_consent", "declined"); }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  const p = await ctx.newPage();
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
  await p.screenshot({ path: path.join(outDir, `page-${name}.png`) });
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
  await p.getByRole("button", { name: /Next: choose length and quality/ }).first().click();
  await p.waitForTimeout(2500);
  // Settings: prices come from the server (quote_tool_prices); nothing is charged for looking.
  row.settingsHeading = await p.getByText("How should it look?").count();
  row.shapeChoice = await p.locator('[aria-label="Video shape"]').count();
  row.makeButton = (await p.getByRole("button", { name: /Make scene pictures/ }).first().innerText().catch(() => "")).replace(/\s+/g, " ");
  row.costText = (await p.locator('section[aria-label="Story builder"]').innerText()).match(/Pictures now \((\d+)\), the rest \(about (\d+)\)/)?.slice(1, 3) ?? null;
  await p.screenshot({ path: path.join(outDir, `settings-${name}.png`) });
  row.apiCalls = [...new Set(apiCalls)];
  row.pageErrors = errors;
  out[name] = row;
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
const ok = Object.values(out).every((v) => v.landedOn === "/workspace/blocky-stories" && v.title === "Blocky Stories" && v.couldntLoad === 0
  && JSON.stringify(v.libraryNames) === JSON.stringify(["Noob", "Vex", "Lux"]) && v.libraryPictures === 3 && v.settingsHeading === 1 && v.shapeChoice === 0
  && v.costText && v.apiCalls.some((c) => /^blocky-story-api 200/.test(c)) && !v.apiCalls.some((c) => /^fruit/.test(c)) && v.pageErrors.length === 0);
console.log(ok ? "PASS" : "FAIL");
process.exitCode = ok ? 0 : 1;
