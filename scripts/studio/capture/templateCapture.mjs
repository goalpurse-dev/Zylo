// Studio kits (owner, 2026-11-01): a creation's REAL input re-entered on the internal account and never submitted, for
// Blocky Stories, Cutaway Explainer and Long Form. Free: no paid button is ever clicked (the last screen stops before it).
// Writes <out>/shots/*.png (3x, 1280x860 CSS px) and <out>/input.json.
//   node templateCapture.mjs <template> <out dir> "<idea text>"
import fs from "node:fs";
import { openApp, SITE } from "./session.mjs";

const [TEMPLATE, OUT, IDEA] = process.argv.slice(2);
const FLOWS = {
  blocky_stories: { path: "/workspace/blocky-stories", tab: "Describe it" },
  cutaway: { path: "/workspace/cutaway-explainer" },
  long_form: { path: "/long-form/new" },
};
const flow = FLOWS[TEMPLATE]; if (!flow || !OUT || !IDEA) { console.error("usage: templateCapture.mjs <blocky_stories|cutaway|long_form> <out> <idea>"); process.exit(2); }
fs.mkdirSync(`${OUT}/shots`, { recursive: true });
const { browser, page } = await openApp();
const steps = [];
const shot = async (name) => { const f = `shots/${String(steps.length).padStart(2, "0")}_${name}.png`; await page.screenshot({ path: `${OUT}/${f}` }); steps.push({ name, file: f }); };
await page.goto(SITE + flow.path, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.getByText("Decline", { exact: true }).click().catch(() => {});
await page.locator("button", { hasText: "✕" }).first().click().catch(() => {});
for (let i = 0; i < 2; i++) { const c = page.getByRole("button", { name: "Close", exact: true }).locator("visible=true").first(); if (!(await c.count())) break; await c.click().catch(() => {}); await page.waitForTimeout(600); }
await page.waitForTimeout(600);
await shot("start");
if (flow.tab) { await page.getByText(flow.tab, { exact: true }).locator("visible=true").first().click(); await page.waitForTimeout(900); }
const box = page.locator("textarea:visible").first();
await box.click();
await box.pressSequentially(String(IDEA).slice(0, 200), { delay: 14 });
await page.waitForTimeout(500);
await shot("typed");   // stops here: the next button is the one that starts paid work
fs.writeFileSync(`${OUT}/input.json`, JSON.stringify({ idea: IDEA, steps, how: "typed in", note: "re-entered on the internal account, nothing submitted" }, null, 1));
console.log(`captured ${steps.length} real input screens (nothing submitted)`);
await browser.close();
