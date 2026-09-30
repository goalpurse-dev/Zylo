// QA ($0) for the pricing follow-ups: Made with Zyvo layout (equal heights),
// Every plan includes, Free copy, no VAT line, and a paywall with live € prices.
//   node scripts/fruit-story/qaPricing2.mjs <outDir> [baseUrl]
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
    for (const l of ["Maybe later", "Decline", "Reject"]) {
      const b = p.getByRole("button", { name: l, exact: true });
      if (await b.count().catch(() => 0)) await b.first().click({ timeout: 1500 }).catch(() => {});
    }
    await p.waitForTimeout(400);
  }
}
async function scrollShot(p, selector, file, offset = 110) {
  await p.evaluate(([sel, off]) => {
    const el = document.querySelector(sel);
    if (!el) return;
    let sc = el.parentElement;
    while (sc && !(sc.scrollHeight > sc.clientHeight && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    (sc ?? window).scrollBy(0, el.getBoundingClientRect().top - off);
  }, [selector, offset]);
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(outDir, file) });
}

for (const phone of [false, true]) {
  const name = phone ? "phone" : "desktop";
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  const p = await ctx.newPage();
  await p.goto(`${base}/workspace/pricing`, { waitUntil: "networkidle" });
  await dismiss(p);
  await p.waitForFunction(() => !document.querySelector('[aria-label="Loading"]'), null, { timeout: 30000 }).catch(() => {});
  const text = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  note(`${name}: VAT mentioned: ${/VAT/.test(text) ? "YES" : "no"} · credits shown: ${(text.match(/(750|1,600|3,200) credits \/ month/g) || []).join(", ")}`);
  // Made with Zyvo: heights of the Fruit card vs the Long Form stack
  const dims = await p.evaluate(() => {
    const sec = document.querySelector("section[aria-labelledby='examples-title']");
    const figs = [...sec.querySelectorAll("figure")].map((f) => f.getBoundingClientRect());
    return figs.map((r) => ({ top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) }));
  });
  if (!phone) note(`${name}: Fruit card ${dims[0].top}→${dims[0].bottom} (h ${dims[0].h}) · Long Form stack ${dims[1].top}→${dims[2].bottom} (h ${dims[2].bottom - dims[1].top})`);
  else note(`${name}: cards stacked: ${dims.map((d) => `${d.w}×${d.h}@${d.top}`).join(", ")}`);
  await scrollShot(p, "section[aria-labelledby='examples-title']", `${name}-examples.png`);
  await scrollShot(p, "section[aria-labelledby='included-title']", `${name}-included.png`, phone ? 110 : 300);
  await p.goto(`${base}/long-form/create`, { waitUntil: "networkidle" });
  await dismiss(p);
  await p.waitForTimeout(2500);
  const sel = await p.locator('button[aria-pressed="true"]').allInnerTexts();
  note(`${name}: Long Form default tier on Pro: ${sel.filter((t) => /V[234] /.test(t)).map((t) => t.split("\n").find((l) => /V[234] /.test(l))).join(", ")}`);
  await ctx.close();
}

// A paywall with live € prices: the Fruit v2 dev preview as a signed-in user without a plan.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(`${base}/workspace/ai-fruit-story?fruitV2Preview=1&viewer=noPlan`, { waitUntil: "networkidle" });
  await dismiss(p);
  for (const label of [/Get a plan/i, /See plans/i, /Upgrade/i, /Create|Next|Write/i]) {
    const b = p.getByRole("button", { name: label }).first();
    if (await b.count()) { await b.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1200); }
    if (await p.getByText("Billed", { exact: false }).count()) break;
  }
  await p.waitForTimeout(1500);
  const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  note(`paywall: € price ${/€\d/.test(t) ? "yes" : "NO"} · $ price ${/\$\d/.test(t) ? "FOUND" : "none"} · ${(t.match(/Billed [^·]{0,20}/g) || []).slice(0, 3).join(" | ")}`);
  await p.screenshot({ path: path.join(outDir, "paywall.png") });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, "report.txt"), report.join("\n"));
