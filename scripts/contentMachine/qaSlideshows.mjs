// Browser check of the slideshow tabs (Today, Ideas, Library) on a running dev server, with NO real backend:
// the page's API calls are answered in this process by the real handler and the real pipeline on an
// in-memory database with fake providers (tests/helpers/contentMachineFakes.mjs). $0, nothing live touched.
// "Signed" file links are served from locally rendered samples (scripts/contentMachine/renderSamples.mjs).
//   VITE_SUPABASE_URL=https://cm-fake.supabase.co VITE_SUPABASE_ANON_KEY=fake npx vite --port 5199
//   node scripts/contentMachine/qaSlideshows.mjs <outDir> <samplesDir> <zyvo-home.png> [baseUrl]
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { apiFor, depsFor, drain, fakeProviders, fakeWorld } from "../../tests/helpers/contentMachineFakes.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const { chromium } = createRequire(path.join(ROOT, "package.json"))("playwright");
const [outDir, samples, zyvoShot, base = "http://localhost:5199"] = process.argv.slice(2);
if (!zyvoShot) { console.error("usage: qaSlideshows.mjs <outDir> <samplesDir> <zyvo-home.png> [baseUrl]"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const sample = path.join(samples, "neon_tool_listicle");
const out = {};
const ok = (label, pass, extra = "") => { out[label] = pass; console.log(`${pass ? "ok  " : "FAIL"} ${label}${extra ? ` (${extra})` : ""}`); };

async function session(browser, viewport, phone) {
  const world = fakeWorld({ dry_run: true, slideshows_per_day: 2 });
  const providers = fakeProviders(world);
  const deps = depsFor(world, providers);
  // The worker, here: "Make slideshows" runs the whole pipeline at once.
  const { handle } = apiFor(world, { kick: async () => { await drain(world, deps); } });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  // Runs in every frame, the sandboxed slide previews too (no localStorage there).
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
    if (u.endsWith("/shot")) return route.fulfill({ path: zyvoShot, contentType: "image/png" });
    if (u.endsWith(".mp4")) return route.fulfill({ path: path.join(sample, "slideshow.mp4"), contentType: "video/mp4" });
    if (u.endsWith(".zip")) return route.fulfill({ path: path.join(sample, "slides.zip"), contentType: "application/zip" });
    const n = (png++ % 5) + 1;
    return route.fulfill({ path: path.join(sample, `slide-0${n}.png`), contentType: "image/png" });
  });
  await ctx.route("https://im.runware.ai/**", (route) => route.fulfill({ path: path.join(samples, "neon_tool_listicle", "slide-01.png"), contentType: "image/png" }));
  return { world, ctx };
}

const browser = await chromium.launch();
for (const [name, viewport] of [["1440", { width: 1440, height: 900 }], ["390", { width: 390, height: 844 }]]) {
  const phone = name === "390";
  const { world, ctx } = await session(browser, viewport, phone);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto(`${base}/admin/content-machine`, { waitUntil: "domcontentloaded" });
  await p.getByTestId("cm-lane-creator").waitFor({ state: "attached", timeout: 45_000 });
  await p.getByRole("button", { name: "Decline" }).click({ timeout: 3000 }).catch(() => {});
  // Desktop: one account at a time (tabs); phone: both sections stacked.
  if (!phone) await p.getByRole("tab", { name: "Creator account" }).click();
  ok(`${name}: the Queue is the first tab, with the Creator account's topic box and button`, await p.getByTestId("cm-topic-creator").isVisible());
  await p.getByTestId("cm-count-creator").selectOption("2");

  // 1. A dry run with a topic: live previews from the templates, mocked text, $0.
  await p.getByTestId("cm-topic-creator").fill("faceless YouTube niches that still work in 2026");
  await p.getByTestId("cm-make-creator").click();
  await p.getByTestId("cm-idea").first().waitFor({ timeout: 20_000 });
  const dryCards = await p.getByTestId("cm-idea").count();
  ok(`${name}: the dry run made 2 slideshows`, dryCards === 2, String(dryCards));
  ok(`${name}: the topic reached the recipes`, world.ideas.every((i) => i.recipe.topic === "faceless YouTube niches that still work in 2026"));
  const frames = await p.locator('[data-testid="cm-slides"] iframe').count();
  ok(`${name}: the first card previews its slides live (no render in a dry run)`, frames >= 3, `${frames} previews`);
  await p.waitForTimeout(2500);   // fonts and the fit script inside the previews
  await p.screenshot({ path: path.join(outDir, `today-dry-${name}.png`), fullPage: true });
  ok(`${name}: nothing was spent`, world.ledger.every((l) => l.actual_usd === 0));

  // 2. A real run (fake providers): rendered PNGs, MP4, ZIP, captions per platform.
  world.s.dry_run = false;
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.getByTestId("cm-lane-creator").waitFor({ state: "attached", timeout: 45_000 });
  if (!phone) await p.getByRole("tab", { name: "Creator account" }).click();
  await p.getByTestId("cm-count-creator").selectOption("2");
  await p.getByTestId("cm-make-creator").click();
  await p.getByText(/Started 2 Creator slideshows/).waitFor({ timeout: 20_000 });
  const card = p.getByTestId("cm-idea").first();
  await card.locator("video").waitFor({ timeout: 20_000 });
  ok(`${name}: the real run shows rendered slides, the MP4 and the ZIP download`, (await card.locator('[data-testid="cm-slides"] img').count()) >= 3 && (await card.getByRole("link", { name: "Download slides (ZIP)" }).count()) === 1);
  ok(`${name}: the cost per slideshow comes from the ledger`, /cost \$0\.\d{3}/.test(await card.innerText()));
  for (const tab of ["Instagram", "YouTube", "TikTok"]) await card.getByRole("button", { name: tab, exact: true }).click();
  await card.getByRole("button", { name: "Copy all" }).click();
  const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  ok(`${name}: Copy all puts the caption and hashtags on the clipboard`, /#aitools/.test(clip), clip.slice(0, 60));
  ok(`${name}: the posting time and the sound suggestion show`, /Post at \d\d:\d\d/.test(await card.innerText()) && /Sound: an upbeat lo-fi sound/.test(await card.innerText()));
  await card.getByRole("button", { name: "Edit" }).click();
  await card.getByLabel("Caption").fill("Which one would you try first? 👇");
  await card.getByRole("button", { name: "Save", exact: true }).click();
  await p.waitForTimeout(800);
  ok(`${name}: a caption edit is saved and audited`, world.pkgs.some((x) => x.caption === "Which one would you try first? 👇") && world.audit.some((a) => a.action === "package.edit"));
  await p.screenshot({ path: path.join(outDir, `today-real-${name}.png`), fullPage: true });
  ok(`${name}: no sideways scroll on Today`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));

  // 2b. The safe zones on the previews, and every live preview's own layout check.
  await p.getByTestId("cm-safe-zones").selectOption("tiktok_photo");
  await p.waitForTimeout(300);
  ok(`${name}: "Show safe zones" draws the TikTok zones and the avatar area over the slides`, (await p.locator('[data-testid="cm-slide"] .border-dashed').count()) > 0 && (await p.locator('[data-testid="cm-slide"] [title="the TikTok profile avatar"]').count()) > 0);
  await p.getByTestId("cm-safe-zones").selectOption("");
  // The first run's cards (dry: live previews) report their layout check; none may fail.
  await p.getByRole("button", { name: /Slideshows · .*dry run/ }).first().click().catch(() => {});
  await p.waitForTimeout(4000);
  const reported = await p.locator('[data-testid="cm-slide"][data-layout-ok]').count();
  const failedSlides = await p.locator('[data-testid="cm-slide"][data-layout-ok="false"]').count();
  const why = await p.locator('[data-testid="cm-slide"][data-layout-ok="false"] [title]').evaluateAll((els) => els.map((e) => e.getAttribute("title")));
  if (why.length) console.log("     layout problems:", JSON.stringify([...new Set(why)]).slice(0, 600));
  // A dry run generates no pictures (by design), so its previews may only miss their picture; any other
  // problem (overlap, safe zone, text too long) still fails.
  const real = why.filter((t) => !/^Slide \d+$/.test(t) && t !== "no visual element: the slide needs a picture");
  ok(`${name}: the live previews pass their own layout check`, reported > 0 && real.length === 0, `${reported} reported, ${failedSlides} only without a picture (dry run)`);

  // 3. Library (with the logo library) and Ideas.
  await p.getByRole("button", { name: "Library", exact: true }).click();
  await p.getByText(/format × style pairs tried/).waitFor({ timeout: 10_000 });
  ok(`${name}: the library shows formats, styles and hooks with coverage`, /Formats/i.test(await p.locator("body").innerText()) && /Visual styles/i.test(await p.locator("body").innerText()));
  await p.getByTestId("cm-logo").first().waitFor({ timeout: 10_000 });
  ok(`${name}: the logo library lists the tools, Zyvo approved, Descript waiting for a file`, (await p.getByTestId("cm-logo").count()) === 2
    && /Approved/.test(await p.getByTestId("cm-logo").nth(0).innerText()) && /Upload official file/.test(await p.getByTestId("cm-logo").nth(1).innerText()));
  await p.screenshot({ path: path.join(outDir, `library-${name}.png`), fullPage: true });
  ok(`${name}: no sideways scroll on Library`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  await p.getByRole("button", { name: "Ideas", exact: true }).click();
  await p.getByTestId("cm-idea").first().waitFor({ timeout: 10_000 });
  ok(`${name}: Ideas lists all 4 slideshows (dry and real)`, (await p.getByTestId("cm-idea").count()) === 4);
  ok(`${name}: no page errors`, errors.length === 0, errors.join(" | "));
  await ctx.close();
}
await browser.close();
const failed = Object.entries(out).filter(([, v]) => !v);
console.log(failed.length ? `${failed.length} check(s) failed.` : "All slideshow page checks passed.");
process.exit(failed.length ? 1 : 0);
