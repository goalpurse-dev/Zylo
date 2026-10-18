// Content Machine: the slides' own layout check, in a real browser (Chromium via Playwright, as on the
// renderer). A slide with far too much text, or a missing image, must be REFUSED before any file is made.
// The good case is covered by scripts/contentMachine/renderSamples.mjs (every format × style passes).
// Skipped where Playwright's Chromium isn't installed.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LayoutError, renderSlideshow } from "../render-worker/src/cmSlides.mjs";

let chromium = null;
try { ({ chromium } = await import("playwright")); await chromium.launch().then((b) => b.close()); } catch { chromium = null; }

const style = { bg: "#07060d", fg: "#ffffff", accent: "#a855f7", highlight: "#facc15", font: "anton", grid: true };
const PICTURE = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#7c3aed"/><circle cx="200" cy="200" r="120" fill="#facc15"/></svg>')}`;
const slide = (extra) => ({ kind: "text", headline: "A short headline", body: null, label: null, items: [], tool: null, image_prompt: null, is_zyvo: false, ...extra });

test("the layout check refuses too much text and a missing image, before any file is made", { skip: !chromium && "Playwright's Chromium is not installed" }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "cm-layout-"));
  const long = "Faceless channels that post every single day without a plan will burn out long before the algorithm ever notices them at all, honestly";
  const job = {
    style,
    // Slide 1 has a picture (a drawn SVG); slide 2 has none; slide 3 points at one that doesn't load.
    images: { background: null, heroes: { 0: PICTURE, 2: "https://127.0.0.1:9/missing.png" } },
    slideshow: { slides: [
      slide({ kind: "cover", headline: "Fine" }),
      slide({ headline: `${long} ${long}`, body: `${long} ${long} ${long}`, items: [long, long, long, long, long] }),
      slide({ headline: "Has a picture", image_prompt: "x" }),
    ] },
  };
  await assert.rejects(renderSlideshow(job, dir, { chromium }), (e) => {
    assert.ok(e instanceof LayoutError, e.message);
    const bySlide = Object.fromEntries(e.layout.map((l) => [l.slide, l.problems.join(" | ")]));
    assert.equal(bySlide[1], undefined, "slide 1 is fine");
    assert.match(bySlide[2], /shorten it/);
    assert.match(bySlide[2], /no visual element/, "the visual-richness rule");
    assert.match(bySlide[3], /didn't load/);
    return true;
  });
});

/* ─── round 5 (2026-10-18): highlights, empty space ─── */

test("highlights keep clear of the other lines, and the check catches a highlight that touches one", { skip: !chromium && "Playwright's Chromium is not installed" }, async () => {
  const { slideHtml, FONT_CSS } = await import("../supabase/functions/_shared/contentMachine/slides/templates.js");
  const { pathToFileURL } = await import("node:url");
  const fonts = FONT_CSS.local(pathToFileURL(join(process.cwd(), "render-worker/assets/fonts")).href);
  const minimal = { bg: "#f6f3ee", fg: "#111111", accent: "#2563eb", highlight: "#fde047", font: "inter" };
  const s = slide({ kind: "cover", headline: "*4 faceless looks* you can make with *long form* and *image style*", image_prompt: "x" });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    const check = async (html) => {
      await page.setContent(html, { waitUntil: "load" });
      await page.waitForSelector('body[data-ready="1"]');
      return JSON.parse(await page.evaluate(() => document.body.dataset.layout));
    };
    for (const st of [minimal, style]) {
      const ok = await check(slideHtml({ slide: s, index: 0, total: 3, style: st, images: { hero: PICTURE }, fontCss: fonts }));
      assert.ok(!ok.problems.some((p) => /highlight/.test(p)), `${st.font}: ${ok.problems.join("; ")}`);
      // The line height opens up for a highlighted headline, and the bar is shorter than one line.
      const m = await page.evaluate(() => { const h = document.querySelector(".headline"); const b = document.querySelector(".hl"); return { lh: parseFloat(getComputedStyle(h).lineHeight), fs: parseFloat(getComputedStyle(h).fontSize), band: parseFloat(getComputedStyle(b).backgroundSize.split(" ")[1]) }; });
      assert.ok(m.lh / m.fs >= 1.24, `line height ${m.lh / m.fs}`);
      assert.ok(m.band < m.lh, `bar ${m.band} < line ${m.lh}`);
    }
    // Squeezed lines: the highlights now touch the next line, and the slide fails.
    const tight = slideHtml({ slide: s, index: 0, total: 3, style: minimal, images: { hero: PICTURE }, fontCss: fonts }).replace("</head>", "<style>.headline:has(.hl){line-height:.82!important}</style></head>");
    const bad = await check(tight);
    assert.ok(bad.problems.some((p) => /a highlight in the headline touches another line/.test(p)), bad.problems.join("; "));
  } finally {
    await browser.close();
  }
});

test("free height goes to the picture; a slide with more than 25 % empty space is marked (not refused)", { skip: !chromium && "Playwright's Chromium is not installed" }, async () => {
  const { slideHtml, FONT_CSS } = await import("../supabase/functions/_shared/contentMachine/slides/templates.js");
  const { pathToFileURL } = await import("node:url");
  const fonts = FONT_CSS.local(pathToFileURL(join(process.cwd(), "render-worker/assets/fonts")).href);
  const tall = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960"><rect width="540" height="960" fill="#16a34a"/><circle cx="270" cy="400" r="200" fill="#facc15"/></svg>')}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    const check = async (s, images) => {
      await page.setContent(slideHtml({ slide: s, index: 0, total: 3, style, images, fontCss: fonts }), { waitUntil: "load" });
      await page.waitForSelector('body[data-ready="1"]');
      return { layout: JSON.parse(await page.evaluate(() => document.body.dataset.layout)), heroH: await page.evaluate(() => document.querySelector(".hero")?.offsetHeight ?? 0) };
    };
    // A tall picture: the frame grows past its start height (640) into the free height; nothing is empty.
    const a = await check(slide({ headline: "A tall picture", image_prompt: "x" }), { hero: tall });
    assert.equal(a.layout.ok, true, a.layout.problems.join("; "));
    assert.ok(a.heroH > 900, `hero ${a.heroH}px tall`);
    assert.deepEqual(a.layout.warnings, []);
    // Only a word on a photo: rendered, but marked as mostly empty.
    const b = await check(slide({ kind: "quiz_answer", headline: "Yes" }), { background: PICTURE });
    assert.equal(b.layout.ok, true);
    assert.match(b.layout.warnings.join(" "), /of the safe area is empty/);
  } finally {
    await browser.close();
  }
});
