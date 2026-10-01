// Deliverability check ($0): gets a fresh mail-tester.com address, sends ONE
// launch email to it through the real send script (--test), waits, then reads
// the score and every deduction from the results page.
//   node --env-file=.env.local scripts/mailTesterCheck.mjs <outDir> [extra send-script args]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const [OUT, ...extra] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto("https://www.mail-tester.com/", { waitUntil: "networkidle" });
const address = await page.locator("#email").evaluate((el) => el.value || el.textContent);
const id = address.split("@")[0];
console.log("address:", address);
console.log(execFileSync("node", ["emails/sendLongFormLaunch.js", "--test", address, ...extra], { encoding: "utf8" }).trim().split("\n").pop());
await page.waitForTimeout(45000);
await page.goto(`https://www.mail-tester.com/${id}`, { waitUntil: "networkidle" });
await page.waitForTimeout(8000);
const result = await page.evaluate(() => {
  const score = document.querySelector("#score, .score, [class*=score]")?.textContent?.trim();
  const items = [...document.querySelectorAll(".test-result, li.test, .item, [class*=result]")].map((e) => e.innerText.replace(/\s+/g, " ").trim()).filter((t) => t.length > 10 && t.length < 400);
  return { title: document.title, score, items: [...new Set(items)].slice(0, 60), text: document.body.innerText.slice(0, 6000) };
});
await page.screenshot({ path: `${OUT}/mail-tester.png`, fullPage: true });
fs.writeFileSync(`${OUT}/mail-tester.json`, JSON.stringify({ address, ...result }, null, 1));
await browser.close();
console.log(JSON.stringify({ title: result.title, score: result.score }));
