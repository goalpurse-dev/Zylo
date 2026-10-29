// Studio M3: ONE real AI Fruit Story made live on the internal account, every screen recorded (owner's go
// 2026-10-30, about $1.90). The timer starts at the first click (the idea card) and stops when the final video is
// ready. Each paid button is clicked AT MOST ONCE, in order; the account's 250 credits are a hard ceiling.
// Every few seconds: a 3x screenshot + the visible controls (the real progress screens), and a screen recording.
//   node fruitRun.mjs <out dir> "<idea card title>" [length label, default "30 sec"]
import fs from "node:fs";
import { openApp, visibleControls, SITE } from "./session.mjs";

const [OUT, IDEA, LENGTH = "30 sec"] = process.argv.slice(2);
fs.mkdirSync(`${OUT}/shots`, { recursive: true });
const log = [];
const t0wall = Date.now();
let tFirst = null;
const now = () => (tFirst ? (Date.now() - tFirst) / 1000 : 0);
const note = (what) => { const e = { t: +now().toFixed(1), what }; log.push(e); console.log(`${e.t.toFixed(1).padStart(6)} s  ${what}`); fs.writeFileSync(`${OUT}/log.json`, JSON.stringify({ tFirstIso: tFirst && new Date(tFirst).toISOString(), log }, null, 1)); };
let shotN = 0;
const shot = async (label) => { shotN++; const f = `shots/${String(shotN).padStart(3, "0")}_${now().toFixed(0).padStart(4, "0")}s_${label}.png`; await page.screenshot({ path: `${OUT}/${f}` }); return f; };

const { browser, ctx, page } = await openApp({ video: `${OUT}/video` });
await page.goto(SITE + "/workspace/ai-fruit-story", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.getByText("Decline", { exact: true }).click().catch(() => {});
await page.locator("button", { hasText: "✕" }).first().click().catch(() => {});   // the "NEW Long Form" bar
await page.waitForTimeout(800);
await shot("story_ideas");

// ── 1. Story: the idea card (the first click: the timer starts) ──
tFirst = Date.now(); note(`click idea "${IDEA}" (timer starts)`);
await page.getByText(IDEA, { exact: true }).first().click(); await page.waitForTimeout(900); await shot("story_picked");
await page.getByText("Next: choose length and quality", { exact: true }).click(); await page.waitForTimeout(1200); note("next: settings");
// ── 2. Settings ──
await page.getByText("V2", { exact: true }).first().click().catch(() => {});
await page.getByText(LENGTH, { exact: true }).first().click(); await page.getByText("Tall 9:16", { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(800); await shot("settings"); note(`settings: V2, ${LENGTH}, Tall 9:16`);

// ── 3–5. the paid steps, each clicked once, then wait for the next one to appear ──
const PAID = ["Make scene pictures", "Animate all scenes", "Make final video"];
const clicked = new Set();
const deadline = Date.now() + 30 * 60_000;
let lastControls = "";
while (Date.now() < deadline) {
  const controls = await visibleControls(page);
  const joined = controls.join("\n");
  const ready = await page.getByText("Your video is ready").first().isVisible().catch(() => false);
  if (ready) { note("FINAL VIDEO READY (timer stops)"); await page.waitForTimeout(1500); await shot("final"); break; }
  let acted = false;
  for (const label of PAID) {
    if (clicked.has(label)) continue;
    const btn = page.locator("button:not([disabled])", { hasText: label }).first();
    if (await btn.isVisible().catch(() => false)) {
      await shot(`before_${label.replace(/\s+/g, "_").toLowerCase()}`);
      clicked.add(label); note(`click "${label}" (paid, once)`); await btn.click(); acted = true;
      await page.waitForTimeout(1500);
      // a confirm dialog, if one opens: only its own confirm button, once
      const confirm = page.locator("[role=dialog] button:not([disabled])", { hasText: new RegExp(label.split(" ")[0], "i") }).first();
      if (await confirm.isVisible().catch(() => false)) { note(`confirm dialog: "${(await confirm.innerText()).trim()}"`); await confirm.click(); }
      break;
    }
  }
  if (!acted) {
    if (joined !== lastControls) { lastControls = joined; note(`controls: ${controls.filter((c) => !/Home|Short Form|Long Form|Workspace|Creations|Cooking|Add Credits|"CO"|Single videos|Series|Try Long Form/.test(c)).slice(0, 14).join(" | ")}`); }
    await shot("progress");
    await page.waitForTimeout(6000);
  }
}
const credits = await page.locator("button", { hasText: /^\s*\d+\s*$/ }).first().innerText().catch(() => "?");
note(`credits left on screen: ${credits.trim()}; total ${now().toFixed(1)} s from the first click`);
await ctx.close(); await browser.close();
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ idea: IDEA, length: LENGTH, startedIso: new Date(tFirst).toISOString(), seconds: log.find((e) => e.what.startsWith("FINAL VIDEO READY"))?.t ?? null, clicked: [...clicked], creditsLeft: credits.trim(), wallSeconds: (Date.now() - t0wall) / 1000 }, null, 1));
