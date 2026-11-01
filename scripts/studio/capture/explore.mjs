// A free look at pages as the internal account: closes announcements, a 1x screenshot, the visible controls. Never clicks a paid button.
//   node explore.mjs <out dir> <path> [<path> ...]
import { openApp, visibleControls, SITE } from "./session.mjs";
const [out, ...paths] = process.argv.slice(2);
const { browser, page } = await openApp({ scale: 1 });
for (const [i, p] of paths.entries()) {
  await page.goto(SITE + p, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.getByText("Decline", { exact: true }).click().catch(() => {});
  for (let k = 0; k < 2; k++) { const c = page.getByRole("button", { name: "Close", exact: true }).locator("visible=true").first(); if (!(await c.count())) break; await c.click().catch(() => {}); await page.waitForTimeout(500); }
  await page.locator("button", { hasText: "✕" }).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/page${i}.png` });
  console.log(`\n== ${p} -> ${page.url()}`);
  console.log((await visibleControls(page)).filter((c) => !/Home|"Short Form"|"Long Form"|Workspace|Creations|Cooking|Add Credits|"CO"|Learn more/.test(c)).join(" | ").slice(0, 1500));
}
await browser.close();
