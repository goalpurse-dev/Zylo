// Studio reuse (owner, 2026-10-30): the REAL input screens of a reused creation, re-entered on the internal account
// and never submitted. AI Fruit Story: "Describe it" → the creation's own idea typed in → "Next: choose length and
// quality" (free) → its length picked → stop. Never a paid button (refused by name). Free: no generation, no credits.
// Writes <out>/shots/*.png (3x) and <out>/input.json (each screen + where the click was, CSS px of 1280x860).
// A creation made from an idea card is re-entered by clicking that same card ("New ideas" until it shows, up to 8
// times); otherwise (or when it never shows) its idea is typed into "Describe it" (that screen then waits for
// characters: the card shows the typed idea, which is what was asked).
//   node inputCapture.mjs <out dir> "<idea text>" [length label, e.g. "30 sec"] [idea card title]
import fs from "node:fs";
import { openApp, SITE } from "./session.mjs";

const [OUT, IDEA, LENGTH = "30 sec", CARD = ""] = process.argv.slice(2);
if (!OUT || !IDEA) { console.error('usage: inputCapture.mjs <out dir> "<idea text>" [length]'); process.exit(2); }
const PAID = /make scene pictures|animate|make final|regenerate|redraw|buy|upgrade|checkout|make episode|write my series|generate/i;
fs.mkdirSync(`${OUT}/shots`, { recursive: true });
const { browser, page } = await openApp();
const steps = [];
const shot = async (name, tap = null) => { const f = `shots/${String(steps.length).padStart(2, "0")}_${name}.png`; await page.screenshot({ path: `${OUT}/${f}` }); steps.push({ name, file: f, tap }); };
const click = async (label) => {
  if (PAID.test(label)) throw new Error(`refused: "${label}" looks like a paid action`);
  const el = page.getByText(label, { exact: true }).locator("visible=true").first();
  await el.waitFor({ timeout: 15000 });
  const b = await el.boundingBox();
  return { el, tap: b && [Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2)] };
};

await page.goto(SITE + "/workspace/ai-fruit-story", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.getByText("Decline", { exact: true }).click().catch(() => {});
await page.locator("button", { hasText: "✕" }).first().click().catch(() => {});   // the "NEW Long Form" bar
await page.waitForTimeout(800);
for (let i = 0; i < 2; i++) {   // an announcement modal: closed like a visitor would (as in navCapture.mjs)
  const close = page.getByRole("button", { name: "Close", exact: true }).locator("visible=true").first();
  if (!(await close.count())) break;
  await close.click().catch(() => {}); await page.waitForTimeout(700);
}

// 1. the same idea card, when it is one of the offered ideas
let c;
if (CARD) {
  for (let i = 0; i < 9; i++) {
    const card = page.getByText(CARD, { exact: true }).locator("visible=true").first();
    if (await card.count()) {
      await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
      const b = await card.boundingBox();
      await shot("ideas", b && [Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2)]);
      await card.click(); await page.waitForTimeout(900);
      c = await click("Next: choose length and quality");
      await shot("picked", c.tap);
      await page.mouse.click(c.tap[0], c.tap[1]); await page.waitForTimeout(1300);
      c = await click(LENGTH).catch(() => null);
      await shot("settings", c?.tap ?? null);
      if (c) { await c.el.click(); await page.waitForTimeout(700); }
      await shot("ready");
      fs.writeFileSync(`${OUT}/input.json`, JSON.stringify({ idea: CARD, length: LENGTH, steps, how: "the same idea card", note: "re-entered on the internal account, nothing submitted" }, null, 1));
      console.log(`captured ${steps.length} real input screens: the same idea card (nothing submitted)`);
      await browser.close(); process.exit(0);
    }
    if (i < 8) { await page.getByText("New ideas", { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(2200); }
  }
  console.log(`the idea card "${CARD}" wasn't offered: typing the idea into "Describe it" instead`);
}

// 2. the ideas screen, with the tap on "Describe it"
c = await click("Describe it");
await shot("ideas", c.tap);
await c.el.click(); await page.waitForTimeout(900);
// the creation's own idea, typed like a person types it
const box = page.locator("textarea:visible").first();
await box.click();
await box.pressSequentially(IDEA, { delay: 18 });
await page.waitForTimeout(500);
await shot("typed");   // "Next" waits for characters here: the typed idea is the input re-entered
fs.writeFileSync(`${OUT}/input.json`, JSON.stringify({ idea: IDEA, length: LENGTH, steps, how: "typed into Describe it", note: "re-entered on the internal account, nothing submitted" }, null, 1));
console.log(`captured ${steps.length} real input screens (nothing submitted)`);
await browser.close();
