// Browser check of the Blocky card on /admin/ops (the 3-hour limit and the alarm), on a running dev server,
// signed in as the owner ($0, read-only: the limit box is looked at, never saved).
// Screenshots at 1440 and 390 px, and what the card says.
//   node scripts/blocky/qaOps.mjs <outDir> [baseUrl]
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { ROOT, SUPABASE_URL, userSession } from "./lib.mjs";

const require = createRequire(path.join(ROOT, "package.json"));
const { chromium } = require("playwright");
const [outDir, base = "http://localhost:5173"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const { client } = await userSession();
const { data: { session } } = await client.auth.getSession();
const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
const browser = await chromium.launch();
const out = {};
for (const [name, viewport] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
  const phone = name === "390";
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(([key, value]) => { localStorage.setItem(key, value); localStorage.setItem("zyvo_cookie_consent", "declined"); }, [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${base}/admin/ops`, { waitUntil: "domcontentloaded" });
  const card = p.locator('[data-testid="ops-blocky"]');
  await card.waitFor({ timeout: 45_000 });
  await p.getByText("Spend ahead of charges").waitFor({ timeout: 30_000 }).catch(() => {});
  await p.getByRole("button", { name: "Decline" }).click({ timeout: 3000 }).catch(() => {});   // the cookie note blurs the page
  await p.waitForTimeout(500);
  await card.scrollIntoViewIfNeeded();
  await p.screenshot({ path: path.join(outDir, `ops-${name}.png`) });
  out[name] = {
    card: (await card.innerText()).replace(/\s+/g, " "),
    limitBox: await card.locator('[data-testid="ops-blocky-limit"]').count(),
    setButtonOffWhenEmpty: await card.getByRole("button", { name: "Set limit" }).isDisabled(),
    otherCards: await p.locator('[data-testid^="ops-"]').count() - 1,   // the limit box carries a test id too
    sideScroll: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    pageErrors: errors,
  };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
const pass = Object.values(out).every((v) => /Paid calls/.test(v.card) && /All users · last 3 hours \$[\d.,]+ of \$[\d.,]+/i.test(v.card) && /Limit per 3 hours, all Blocky users together/.test(v.card) && v.limitBox === 1 && v.setButtonOffWhenEmpty && /Spend ahead of charges/.test(v.card) && v.otherCards === 5 && !v.sideScroll && v.pageErrors.length === 0);
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
