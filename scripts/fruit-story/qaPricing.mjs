// QA ($0): screenshots of the redesigned /workspace/pricing page, desktop + phone, as a
// guest and signed in (test account), plus basic checks (no sideways scroll,
// live prices loaded, Long Form tab, plan finder answer).
//   node scripts/fruit-story/qaPricing.mjs <outDir> [baseUrl]
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

async function dismiss(p) {
  for (let i = 0; i < 3; i++) {
    for (const l of ["Maybe later", "Decline", "Reject", "Close"]) {
      const b = p.getByRole("button", { name: l, exact: true });
      if (await b.count().catch(() => 0)) await b.first().click({ timeout: 1500 }).catch(() => {});
    }
    await p.waitForTimeout(500);
  }
}

for (const signedIn of [false, true]) {
  for (const phone of [false, true]) {
    const name = `${phone ? "phone" : "desktop"}-${signedIn ? "pro" : "guest"}`;
    const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 1000 } });
    if (signedIn) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${ref}-auth-token`, JSON.stringify(session)]);
    const p = await ctx.newPage();
    await p.goto(`${base}/workspace/pricing`, { waitUntil: "networkidle" });
    await dismiss(p);
    await p.waitForFunction(() => !document.querySelector('[aria-label="Loading"]'), null, { timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(800);
    const scrollW = await p.evaluate(() => document.documentElement.scrollWidth);
    const text = (await p.locator("body").innerText()).replace(/\s+/g, " ");
    const loading = await p.locator('[aria-label="Loading"]').count();
    note(`${name}: width ${scrollW} (viewport ${phone ? 390 : 1440}) · loading placeholders left ${loading} · € prices ${/€15/.test(text) ? "yes" : "NO"} · VAT ${/Prices include VAT/.test(text) ? "yes" : "NO"} · $ ${/\$\d/.test(text) ? "FOUND" : "none"}`);
    const first = await p.locator("article h2").first().innerText();
    note(`${name}: first plan card = ${first}`);
    await p.screenshot({ path: path.join(outDir, `${name}-top.png`) });
    // Sections: scroll each into view under the sticky top bar, then a viewport shot
    // (the workspace scrolls an inner element, so full-page shots only show one screen).
    const shot = async (selector, file, offset = 120) => {
      await p.evaluate(([sel, off]) => {
        const el = document.querySelector(sel);
        if (!el) return;
        let sc = el.parentElement;
        while (sc && !(sc.scrollHeight > sc.clientHeight && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
        const top = el.getBoundingClientRect().top;
        (sc ?? window).scrollBy(0, top - off);
      }, [selector, offset]);
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(outDir, `${name}-${file}.png`) });
    };
    await shot("article[aria-labelledby=\"plan-pro\"] ul", "card-bottom", phone ? 360 : 560);
    if (phone) await shot("article[aria-labelledby=\"plan-starter\"]", "starter");
    await shot("#plan-finder", "finder");
    const fit = await p.locator("#plan-finder aside").innerText();
    note(`${name}: finder default → ${fit.replace(/s+/g, " ").slice(0, 120)}`);
    await p.getByRole("tab", { name: "Long Form" }).click();
    await p.waitForTimeout(300);
    await shot("#output-estimates", "longform");
    const lfText = (await p.locator("#output-estimates table").innerText()).replace(/s+/g, " ");
    note(`${name}: Long Form table: ${lfText.slice(0, 200)}`);
    await p.getByRole("button", { name: "View more" }).click();
    await p.waitForTimeout(300);
    await shot("section[aria-labelledby=\"compare-title\"]", "compare");
    await shot("section[aria-labelledby=\"examples-title\"]", "examples");
    await shot("section[aria-labelledby=\"included-title\"]", "included", 200);
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(outDir, "report.txt"), report.join("\n"));
