// The real Long Form screens for Studio videos ($0, nothing is generated): the start page, its "Discover ideas" side with
// the niche chips, and a finished project's scenes board. Logged in on the live app; clicks only free, non-generating tabs.
//   node longFormScreens.mjs <out dir> [<project id> <owner|internal>]
import fs from "node:fs";
import { openApp, visibleControls, SITE } from "./session.mjs";

const [OUT, project, who = "internal"] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const { browser, page } = await openApp(who === "owner" ? { email: "upwardlift6@gmail.com" } : {});
const closeOverlays = async () => {
  for (let i = 0; i < 4; i++) {
    const blocker = await page.$("div.fixed.inset-0");
    if (!blocker) return;
    await page.keyboard.press("Escape"); await page.waitForTimeout(600);
    for (const t of ["Decline", "Skip", "Not now", "Close", "Maybe later", "×"]) { const b = page.getByRole("button", { name: t, exact: true }); if (await b.count()) { await b.first().click().catch(() => {}); await page.waitForTimeout(600); } }
  }
};
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log(`${name}.png`); };

if (!project) {
  await page.goto(SITE + "/long-form/new", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await shot("lf_start_raw");
  await closeOverlays();
  await page.getByText("Discover ideas", { exact: true }).first().click();
  await page.waitForTimeout(2000);
  await shot("lf_discover");
  await page.getByText("All topics", { exact: true }).first().click();   // opens the Category list, picks nothing
  await page.waitForTimeout(1200);
  await shot("lf_category_open");
} else {
  await page.goto(`${SITE}/long-form/project/${project}/generate`, { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);
  await closeOverlays();
  await shot("lf_generate");
  // the editor: every scene on its timeline (opening it changes nothing; nothing here is clicked)
  await page.goto(`${SITE}/long-form/project/${project}/edit`, { waitUntil: "networkidle" });
  await page.waitForTimeout(8000);
  await closeOverlays();
  await shot("lf_edit");
}
console.log((await visibleControls(page)).slice(0, 60).join("\n"));
await browser.close();
