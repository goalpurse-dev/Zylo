// QA ($0): the full-video price at every step, the writing storyboard, and no
// caption overlay on scene cards.
//   real account: the wedding story (final: "This video cost 189") and series
//   episode 1 (pictures ready: "Spent so far · Animating · Total")
//   dev preview: settings cost card, "Make scene pictures · N of ~M", the
//   writing storyboard right after the click (the mock takes a few seconds)
//   node scripts/fruit-story/qaPrice.mjs <outDir> [baseUrl]
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
const flat = async (p) => (await p.locator("body").innerText()).replace(/\s+/g, " ");

async function page(signedIn, phone = false) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  if (signedIn) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  const p = await ctx.newPage();
  const dismiss = async () => {
    for (let i = 0; i < 4; i++) {
      for (const l of ["Maybe later", "Decline"]) { const b = p.getByRole("button", { name: l }); if (await b.count().catch(() => 0)) await b.first().click({ timeout: 2000 }).catch(() => {}); }
      await p.waitForTimeout(700);
    }
  };
  return { ctx, p, dismiss };
}

// Real: the finished wedding story.
{
  const { ctx, p, dismiss } = await page(true);
  await p.goto(`${base}/workspace/ai-fruit-story`, { waitUntil: "networkidle" });
  await dismiss();
  const card = p.locator("article", { hasText: "The Surprise Wedding Switch" }).first();
  await card.getByRole("button", { name: "Open" }).click();
  await p.waitForTimeout(4000);
  const t = await flat(p);
  note(`wedding final: ${(t.match(/This video cost \d+ credits\./g) ?? ["(missing)"]).join(" | ")}`);
  await p.screenshot({ path: path.join(outDir, "real-final.png") });
  // Series episode 1: pictures ready.
  await p.goto(`${base}/workspace/ai-fruit-story`, { waitUntil: "networkidle" });
  await dismiss();
  await p.getByText("Episodes with cliffhangers").first().click();
  await p.waitForTimeout(2500);
  await p.getByRole("button", { name: /The Second Phone Next Door/ }).first().click();
  await p.waitForTimeout(3000);
  await p.getByRole("button", { name: /Make episode 1/ }).first().click();
  await p.waitForTimeout(4000);
  const e = await flat(p);
  note(`episode 1: ${(e.match(/Spent so far: \d+ · Animating: \d+ · Total: \d+ credits/) ?? ["(missing)"])[0]}`);
  note(`scene-card caption overlay: ${await p.locator("article p.pointer-events-none").count()} (want 0)`);
  await p.screenshot({ path: path.join(outDir, "real-episode.png") });
  await ctx.close();
}

// Dev preview: settings → start → writing storyboard.
for (const phone of [false, true]) {
  const name = phone ? "phone" : "desktop";
  const { ctx, p, dismiss } = await page(false, phone);
  await p.goto(`${base}/workspace/ai-fruit-story?fruitV2Preview=1&plan=pro&credits=2000`, { waitUntil: "networkidle" });
  await dismiss();
  await p.locator("button[aria-pressed].grid").first().click();
  await p.getByRole("button", { name: /Next: choose length and quality/ }).click();
  await p.waitForTimeout(2500);
  const t = await flat(p);
  note(`${name} settings: ${(t.match(/Full video about \S+ \d+ now for the \d+ scene pictures, about \d+ when you animate [^.]+\./) ?? t.match(/Full video[^.]{0,120}\./) ?? ["(missing)"])[0]}`);
  const btn = await p.getByRole("button", { name: /Make scene pictures/ }).first().innerText().catch(() => "");
  note(`${name} button: ${btn.replace(/\s+/g, " ")}`);
  await p.locator("text=Full video").first().scrollIntoViewIfNeeded().catch(() => {});
  await p.screenshot({ path: path.join(outDir, `${name}-settings.png`) });
  await p.getByRole("button", { name: /Make scene pictures/ }).first().click();
  await p.waitForTimeout(400);
  const w = await flat(p);
  note(`${name} right after the click: writing storyboard ${w.includes("Writing…") ? "shown" : "MISSING"}`);
  await p.screenshot({ path: path.join(outDir, `${name}-writing.png`) });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, "report.txt"), report.join("\n"));
