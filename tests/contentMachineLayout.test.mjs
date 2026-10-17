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
