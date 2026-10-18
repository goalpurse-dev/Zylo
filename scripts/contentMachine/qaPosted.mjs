// Browser check of Part 2 + Phase 3 on a running dev server, with NO real backend (the real handler and the
// real pipeline on an in-memory database with fake providers). $0, nothing live touched.
//   VITE_SUPABASE_URL=https://cm-fake.supabase.co VITE_SUPABASE_ANON_KEY=fake npx vite --port 5199
//   node scripts/contentMachine/qaPosted.mjs <outDir> <samplesDir> <a real screenshot .png> [baseUrl]
// Checks: one Start button that follows the dropdown; Today shows every slideshow made today with status
// filters; Mark as posted moves one to Posted; a pasted screenshot fills the stats form (the fast model, faked),
// Save makes a snapshot with its screenshot; the growth chart; Analytics totals, table and formula; Let the
// agent analyze → the report → Apply the playbook; at 1440 and 390 px with no sideways scroll.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { apiFor, depsFor, drain, fakeProviders, fakeWorld } from "../../tests/helpers/contentMachineFakes.mjs";
import { costOfUsage } from "../../supabase/functions/_shared/contentMachine/providers/anthropic.js";
import { utcToLocal } from "../../supabase/functions/_shared/contentMachine/localTime.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const { chromium } = createRequire(path.join(ROOT, "package.json"))("playwright");
const [outDir, samples, shotFile, base = "http://localhost:5199"] = process.argv.slice(2);
if (!shotFile) { console.error("usage: qaPosted.mjs <outDir> <samplesDir> <screenshot.png> [baseUrl]"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const out = {};
const ok = (label, pass, extra = "") => { out[label] = pass; console.log(`${pass ? "ok  " : "FAIL"} ${label}${extra ? ` (${extra})` : ""}`); };
const sample = path.join(samples, "neon_tool_listicle");
const msg = (json, model = "claude-haiku-5-5") => { const body = { id: "m", model, usage: { input_tokens: 2000, output_tokens: 200 }, content: [{ type: "text", text: JSON.stringify(json) }] }; return { body, costUsd: costOfUsage(body.usage, body.model) }; };
const READ = { views: 12500, likes: 900, comments: 41, shares: 22, saves: 130, avg_watch_sec: 4.2, watched_full_pct: 18.5, profile_visits: 77, new_followers: 9, platform: "tiktok", note: null };
const REPORT = { summary: "Two posts so far: too little data for rules.", what_works: ["question hooks"], what_doesnt: [], playbook: "Hooks\n- Open with a question", experiments: [{ format: "quiz", style: "neon_grid", hook_type: "question", why: "untested" }, { format: "meme", style: "meme_style", hook_type: "pov", why: "untested" }], retire: [], trend_notes: "", confidence: "low" };

async function session(browser, viewport, phone) {
  const world = fakeWorld({ dry_run: false, slideshows_per_day: 2 });
  world.clock.now = new Date(Date.now() + 3 * 86_400_000);   // the server's "now": three days from today
  const providers = fakeProviders(world);
  const orig = providers.ai.createMessage;
  providers.ai.createMessage = async (t, a) => (/^You are the analyst/.test(a.request.system[0].text) ? msg(REPORT, "claude-sonnet-5-5") : orig(t, a));
  const deps = depsFor(world, providers);
  const ai = { async createMessage() { return msg(READ); } };   // the screenshot reader (in the API)
  const { handle } = apiFor(world, { kick: async () => { await drain(world, deps); }, ai, env: { ANTHROPIC_API_KEY: "k" } });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript(() => { try { localStorage.setItem("zyvo_cookie_consent", "declined"); } catch { /* a preview frame */ } });
  await ctx.route("https://cm-fake.supabase.co/**", async (route) => {
    const req = route.request();
    if (!req.url().includes("/functions/v1/content-machine-api")) return route.fulfill({ status: 404, body: "{}" });
    const res = await handle(new Request(req.url(), { method: req.method(), headers: req.headers(), body: req.method() === "POST" ? req.postData() : undefined }));
    route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() });
  });
  let png = 0;
  await ctx.route("https://signed/**", (route) => {
    const u = route.request().url();
    if (u.endsWith(".mp4")) return route.fulfill({ path: path.join(sample, "slideshow.mp4"), contentType: "video/mp4" });
    if (u.endsWith(".zip")) return route.fulfill({ path: path.join(sample, "slides.zip"), contentType: "application/zip" });
    if (/\/posts\//.test(u) || u.endsWith("/shot")) return route.fulfill({ path: shotFile, contentType: "image/png" });
    return route.fulfill({ path: path.join(sample, `slide-0${(png++ % 5) + 1}.png`), contentType: "image/png" });
  });
  await ctx.route("https://im.runware.ai/**", (route) => route.fulfill({ path: path.join(sample, "slide-01.png"), contentType: "image/png" }));
  return { world, ctx };
}

const shotB64 = fs.readFileSync(shotFile).toString("base64");
const browser = await chromium.launch();
for (const [name, viewport] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
  const phone = name === "390";
  const { world, ctx } = await session(browser, viewport, phone);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto(`${base}/admin/content-machine`, { waitUntil: "domcontentloaded" });
  await p.getByTestId("cm-make").waitFor({ timeout: 45_000 });
  await p.getByRole("button", { name: "Decline" }).click({ timeout: 3000 }).catch(() => {});

  // One button, labelled by the dropdown; no "Run now" in the top bar.
  ok(`${name}: no Run now in the top bar`, (await p.getByTestId("cm-topbar").getByRole("button", { name: "Run now" }).count()) === 0);
  await p.getByLabel("How many").selectOption("2");
  ok(`${name}: the button says "Make 2 new slideshows"`, (await p.getByTestId("cm-make-button").innerText()).trim() === "Make 2 new slideshows");
  await p.getByTestId("cm-make-button").click();
  await p.getByText(/Started 2 slideshows\./).waitFor({ timeout: 20_000 });
  await p.getByTestId("cm-idea").nth(1).waitFor({ timeout: 20_000 });
  ok(`${name}: Today lists every slideshow made today`, (await p.getByTestId("cm-idea").count()) === 2);
  ok(`${name}: status filters with counts`, /Ready 2/.test(await p.getByTestId("cm-today-filters").innerText()));

  // Mark as posted → it leaves Today.
  const card = p.getByTestId("cm-idea").first();
  const title = world.ideas.find((i) => card) && (await card.innerText()).split("\n").find((l) => /Title \d/.test(l));
  await card.getByTestId("cm-mark-posted").click();
  const form = card.getByTestId("cm-post-form");
  await form.getByPlaceholder(/tiktok\.com/).fill("https://www.tiktok.com/@zyvo/photo/7123");
  const postedLocal = utcToLocal(new Date().toISOString(), "Europe/Helsinki");
  await form.locator('input[type="datetime-local"]').fill(postedLocal);
  await form.getByRole("button", { name: "Save" }).click();
  await p.waitForTimeout(1200);
  ok(`${name}: the posted slideshow left Today`, (await p.getByTestId("cm-idea").count()) === 1 && world.ideas.some((i) => i.status === "posted"));

  // Posted: paste a screenshot → numbers read → Save → snapshot, chart.
  await p.getByRole("button", { name: "Posted", exact: true }).click();
  const post = p.getByTestId("cm-post").first();
  await post.waitFor({ timeout: 10_000 });
  ok(`${name}: Posted lists it with its platform and time`, /TikTok/.test(await post.innerText()) && (await post.innerText()).includes(postedLocal.replace("T", " ")));
  await post.click();
  await post.getByTestId("cm-add-stats").click();
  const sf = post.getByTestId("cm-stats-form");
  const taken = utcToLocal(new Date(Date.now() + 26 * 3_600_000).toISOString(), "Europe/Helsinki");
  await sf.locator('input[type="datetime-local"]').fill(taken);
  await sf.evaluate((el, b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "stats.png", { type: "image/png" }));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, shotB64);
  await sf.getByText(/Read from the screenshot/).waitFor({ timeout: 15_000 });
  ok(`${name}: the pasted screenshot filled the numbers (to be checked before saving)`, (await sf.getByLabel("Views").inputValue()) === "12500" && world.stats.length === 0);
  await sf.getByRole("button", { name: "Save snapshot" }).click();
  await p.waitForTimeout(1200);
  ok(`${name}: the snapshot is saved with its screenshot`, world.stats.length === 1 && Boolean(world.stats[0].screenshot_path) && world.stats[0].hours_since_post > 25);
  const post2 = p.getByTestId("cm-post").first();
  if (!(await post2.getByTestId("cm-growth").count())) await post2.click();
  ok(`${name}: the growth chart and the snapshot row show`, (await post2.getByTestId("cm-growth").count()) === 1 && /12,500/.test(await post2.innerText()));
  await p.screenshot({ path: path.join(outDir, `posted-${name}.png`), fullPage: true });
  ok(`${name}: no sideways scroll on Posted`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));

  // Analytics + learning.
  await p.getByRole("button", { name: "Analytics", exact: true }).click();
  await p.getByTestId("cm-posts-table").waitFor({ timeout: 10_000 });
  ok(`${name}: Analytics totals, the posts table and the score formula`, /12,500/.test(await p.getByTestId("cm-analytics").innerText()) && /score = 100/.test(await p.getByTestId("cm-analytics").innerText()));
  await p.getByTestId("cm-analyze").click();
  await p.getByTestId("cm-analysis").waitFor({ timeout: 20_000 });
  ok(`${name}: the agent's analysis shows`, /too little data for rules/.test(await p.getByTestId("cm-analysis").innerText()));
  await p.getByRole("button", { name: "Apply this playbook" }).click();
  await p.waitForTimeout(800);
  ok(`${name}: Apply puts the proposal in the playbook`, world.s.playbook === REPORT.playbook && (await p.getByTestId("cm-playbook").inputValue()) === REPORT.playbook);
  await p.screenshot({ path: path.join(outDir, `analytics-${name}.png`), fullPage: true });
  ok(`${name}: no sideways scroll on Analytics`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  ok(`${name}: no page errors`, errors.length === 0, errors.join(" | ").slice(0, 300));
  await ctx.close();
}
await browser.close();
const failed = Object.entries(out).filter(([, v]) => !v);
console.log(failed.length ? `${failed.length} checks failed.` : "All checks passed.");
fs.writeFileSync(path.join(outDir, "qa.json"), JSON.stringify(out, null, 2));
process.exit(failed.length ? 1 : 0);
