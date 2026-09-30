// QA ($0): the series page with its bible ("Two Timing Tide") and the new final
// screen (series extras, cover, post text) on "Caught at Dinner", desktop + phone.
//   node scripts/fruit-story/qaRound6.mjs <outDir> [baseUrl]
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

for (const phone of [false, true]) {
  const name = phone ? "phone" : "desktop";
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  const p = await ctx.newPage();
  const dismiss = async () => {
    for (let i = 0; i < 4; i++) {
      for (const l of ["Maybe later", "Decline"]) { const b = p.getByRole("button", { name: l }); if (await b.count().catch(() => 0)) await b.first().click({ timeout: 2000 }).catch(() => {}); }
      await p.waitForTimeout(700);
    }
  };
  const tab = async (i) => { if (phone) await p.getByRole("tab").nth(i).dispatchEvent("click"); };
  const openSeries = async (title) => {
    await p.goto(`${base}/workspace/ai-fruit-story`, { waitUntil: "networkidle" });
    await dismiss();
    await tab(0);
    await p.getByText("Episodes with cliffhangers").first().click();
    await p.waitForTimeout(2500);
    await p.getByRole("button", { name: new RegExp(title) }).first().click();
    await p.waitForTimeout(3500);
    await tab(1);
    await p.waitForTimeout(1000);
  };

  await openSeries("Two Timing Tide");
  const bible = await p.getByText("Series bible").count();
  const says = await p.getByText("Says:").count();
  note(`${name}: series bible shown: ${bible ? "yes" : "NO"} · catchphrases: ${says}`);
  await p.getByText("Series bible").first().scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(outDir, `${name}-bible.png`), fullPage: phone });

  await openSeries("Two Best Friends, One Boyfriend");
  const watch = p.getByRole("button", { name: "Watch" }).first();
  note(`${name}: Watch button on a made episode: ${(await watch.count()) ? "yes" : "NO"}`);
  if (await watch.count()) {
    await watch.click();
    await p.waitForTimeout(4500);
    await tab(1);
    await p.waitForTimeout(2500);
    const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
    note(`${name}: final screen: series extras ${t.includes("Series extras") ? "yes" : "NO"} · cover ${t.includes("Cover image") ? "yes" : "NO"} · post text ${/pinned comment/i.test(t) ? "yes" : "NO"}`);
    await p.getByText("Post it").first().scrollIntoViewIfNeeded().catch(() => {});
    await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(outDir, `${name}-final.png`), fullPage: phone });
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, "report.txt"), report.join("\n"));
