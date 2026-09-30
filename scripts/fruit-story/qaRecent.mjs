// QA ($0): the Recent panel in every state, the Fruit paywall lines and the
// Pricing page's Fruit numbers, on the local dev server.
//   node scripts/fruit-story/qaRecent.mjs <outDir> [baseUrl]
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

async function open(name, url, { signedIn = false, phone = false } = {}) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  if (signedIn) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${ref}-auth-token`, JSON.stringify(session)]);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${base}${url}`, { waitUntil: "networkidle" });
  for (let i = 0; i < 4; i++) {
    for (const l of ["Maybe later", "Decline"]) { const b = p.getByRole("button", { name: l }); if (await b.count().catch(() => 0)) await b.first().click({ timeout: 2000 }).catch(() => {}); }
    await p.waitForTimeout(800);
  }
  if (phone) await p.getByRole("tab").nth(1).dispatchEvent("click").catch(() => {});
  await p.waitForTimeout(1500);
  return { ctx, p, errors, shot: (label) => p.screenshot({ path: path.join(outDir, `${name}-${label}.png`) }) };
}

const text = async (p) => (await p.locator("body").innerText()).replace(/\s+/g, " ");

// 1. Real paid account: only real stories (no mock samples), scene-picture thumbnails.
{
  const { ctx, p, errors, shot } = await open("real", "/workspace/ai-fruit-story", { signedIn: true });
  const t = await text(p);
  const mock = ["The perfect revenge dinner", "Snitches get spots", "HR has entered the chat"].filter((s) => t.includes(s));
  note(`real account: mock samples on screen: ${mock.length ? mock.join(", ") : "none"}`);
  const thumbs = await p.locator("article img").evaluateAll((els) => els.map((e) => e.src));
  note(`real account: ${thumbs.length} thumbnails, all scene pictures: ${thumbs.every((u) => /generated\/fruit\/.+\/.+\/|fruit_story|storage\/v1\/object\/public\/(generated|fruit-story)/.test(u)) ? "yes" : "CHECK"} · character refs: ${thumbs.filter((u) => /fruit-characters|characters\//.test(u)).length}`);
  await shot("1-recent");
  note(`real account errors: ${errors.length ? errors.join(" | ") : "none"}`);
  await ctx.close();
}

// 2–4. Guest, no plan, paid with no stories (dev preview switches).
for (const [name, q] of [["guest", "&viewer=guest"], ["noplan", "&viewer=noPlan"], ["empty", "&recent=empty"]]) {
  for (const phone of [false, true]) {
    const { ctx, p, errors, shot } = await open(`${name}${phone ? "-phone" : ""}`, `/workspace/ai-fruit-story?fruitV2Preview=1${q}`, { phone });
    const t = await text(p);
    const cta = ["Sign up to make your own", "Get a plan to make videos like this", "Make your first story"].find((c) => t.includes(c));
    const video = await p.locator("video").count();
    note(`${name}${phone ? " (phone)" : ""}: CTA "${cta ?? "none"}", example video: ${video ? "yes" : "no"}, mock samples: ${t.includes("The perfect revenge dinner") ? "YES" : "no"}`);
    await shot("panel");
    if (name === "noplan" && !phone) {
      await p.getByRole("button", { name: "Get a plan to make videos like this" }).click();
      await p.waitForTimeout(2500);
      const lines = (await text(p)).match(/About \d+ AI Fruit Story videos of 20 s \/ month on V2[^A-Z]*/g) ?? [];
      note(`paywall lines: ${lines.map((l) => l.trim()).join(" | ") || "none"}`);
      await shot("paywall");
    }
    if (errors.length) note(`${name} errors: ${errors.join(" | ")}`);
    await ctx.close();
  }
}

// 5. Pricing page: Fruit numbers from the v2 prices at 20 s.
{
  const { ctx, p, shot } = await open("pricing", "/workspace/pricing");
  await p.waitForTimeout(2500);
  const t = await text(p);
  note(`pricing headline: ${(t.match(/About \S+ complete 20 seconds AI Fruit Story videos \/ month/g) ?? []).join(" | ") || "not found"}`);
  note(`pricing basis: ${(t.match(/Based on AI Fruit Story V2 at \S+ credits per 20-second video/) ?? ["not found"])[0]}`);
  await shot("page");
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, "report.txt"), report.join("\n"));
