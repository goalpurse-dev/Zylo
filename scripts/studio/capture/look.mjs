// A free look at one page of the live app as the internal account: a 3x screenshot and the visible controls.
// Clicks only what you pass (by exact visible text), in order. Never pass a paid button here.
//   node look.mjs <out.png> <path> ["click:Text"] ["fill:placeholder=value"] ...
import { openApp, visibleControls, SITE } from "./session.mjs";
const [out, path = "/workspace/ai-fruit-story", ...steps] = process.argv.slice(2);
const PAID = /make scene pictures|animate|make final|regenerate|redraw|buy|upgrade|checkout|make episode|write my series/i;
const { browser, page } = await openApp();
await page.goto(SITE + path, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
for (const st of steps) {
  const [kind, rest] = [st.slice(0, st.indexOf(":")), st.slice(st.indexOf(":") + 1)];
  if (kind === "click") {
    if (PAID.test(rest)) throw new Error(`refused: "${rest}" looks like a paid action`);
    await page.getByText(rest, { exact: true }).first().click(); await page.waitForTimeout(1500);
  } else if (kind === "fill") { const [ph, v] = rest.split("="); await page.getByPlaceholder(ph).fill(v); }
  else if (kind === "wait") await page.waitForTimeout(Number(rest));
}
await page.screenshot({ path: out, fullPage: true });
console.log((await visibleControls(page)).join("\n"));
await browser.close();
