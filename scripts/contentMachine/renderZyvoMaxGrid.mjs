// The Zyvo account's worst case (owner, 2026-10-19): every Zyvo slide kind filled to its slot limits (slotFit.js):
// the longest text, the most lines, the most pictures (portrait and landscape real outputs), a highlight. Rendered
// with the real templates, brand style and footer; every slide must pass the layout check (safe zone, overlaps
// incl. the footer and highlights, pictures inside their frames). $0, local.
//   FFMPEG=<ffmpeg> node scripts/contentMachine/renderZyvoMaxGrid.mjs <outDir> <picsDir with real outputs>
import { readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { renderSlideshow } from "../../render-worker/src/cmSlides.mjs";
import { ZYVO_SLOTS } from "../../supabase/functions/_shared/contentMachine/slotFit.js";

const [outDir, picsDir] = process.argv.slice(2);
if (!picsDir) { console.error("usage: renderZyvoMaxGrid.mjs <outDir> <picsDir>"); process.exit(2); }
const WORDS = "Turn one idea into finished videos with research script voice-over scenes thumbnails templates characters download".split(" ");
/** Text of exactly `n` visible characters from real words (wide letters: the worst case for wrapping). */
export function textOf(n, { highlight = false, seed = 0 } = {}) {
  let out = "", i = seed;
  while (out.length < n) out += (out ? " " : "") + WORDS[i++ % WORDS.length];
  out = out.slice(0, n).replace(/\s+$/, "");
  while (out.length < n) out += "W";
  if (!highlight) return out;
  const words = out.split(" ");
  if (words.length < 3) return out;
  words[1] = `*${words[1]}`; words[2] = `${words[2]}*`;
  return words.join(" ");
}

const pics = readdirSync(picsDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !/logo/i.test(f)).map((f) => pathToFileURL(path.join(picsDir, f)).href);
const logo = readdirSync(picsDir).find((f) => /logo/i.test(f));
const style = { bg: "#090A0A", fg: "#ffffff", accent: "#BEF264", highlight: "#BEF264", font: "inter", brand: true };
const report = {};
let failed = 0;
for (const [kind, L] of Object.entries(ZYVO_SLOTS)) {
  const slide = {
    kind, headline: textOf(L.headline, { highlight: true }), body: L.body ? textOf(L.body, { seed: 3 }) : null, label: ["ui_prompt", "ui_checklist", "ui_result"].includes(kind) ? "2" : null,
    callout: L.callout ? textOf(L.callout, { seed: 5 }) : null, prompt: L.prompt ? textOf(L.prompt, { seed: 7 }) : null,
    items: L.items ? Array.from({ length: L.items[1] }, (_, n) => textOf(L.itemChars, { seed: n * 2 })) : [],
    items_right: L.right ? Array.from({ length: L.right[1] }, (_, n) => textOf(L.rightChars, { seed: n * 2 + 1 })) : [],
    tool: null, image_prompt: null, asset_id: null, assets: [], fact_ids: [], is_zyvo: true,
  };
  const gallery = Array.from({ length: L.assets[1] }, (_, n) => ({ url: pics[n % pics.length], label: textOf(16, { seed: n }) }));
  // Two slides: a middle one (footer "swipe") and, for the CTA, the last one (footer "tryzyvo.com").
  const slides = [slide, { ...slide }];
  const job = { style, logos: logo ? { "tryzyvo.com": pathToFileURL(path.join(picsDir, logo)).href } : null, images: { background: null, heroes: {}, galleries: { 0: gallery, 1: gallery } }, slideshow: { slides }, secondsPerSlide: 1 };
  const dir = path.join(outDir, kind);
  mkdirSync(dir, { recursive: true });
  const out = await renderSlideshow(job, dir, { local: true, safeZones: true, keepGoing: true });
  report[kind] = { problems: out.layoutProblems, warnings: out.layoutWarnings };
  if (out.layoutProblems.length) { failed += 1; console.log(`FAIL ${kind}: ${out.layoutProblems.map((l) => l.problems.join("; ")).join(" | ")}`); } else console.log(`ok   ${kind}`);
}
writeFileSync(path.join(outDir, "max-grid.json"), JSON.stringify(report, null, 2));
const ff = process.env.FFMPEG ?? "ffmpeg";
const inputs = Object.keys(ZYVO_SLOTS).flatMap((k) => ["-i", path.join(outDir, k, "slide-01.png")]);
spawnSync(ff, ["-hide_banner", "-loglevel", "error", "-y", ...inputs, "-filter_complex", `${Object.keys(ZYVO_SLOTS).map((_, i) => `[${i}]scale=270:480[s${i}]`).join(";")};${Object.keys(ZYVO_SLOTS).map((_, i) => `[s${i}]`).join("")}hstack=${Object.keys(ZYVO_SLOTS).length}`, path.join(outDir, "max-grid.png")]);
console.log(failed ? `${failed} Zyvo slide kinds fail at their limits.` : "Every Zyvo slide kind fits at its maximum (layout check passed).");
process.exit(failed ? 1 : 0);
