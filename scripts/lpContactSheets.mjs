// $0: labelled contact sheets of the candidate scenes saved by lpCandidates.ts
// (<dir>/<project8>/NNN.img + candidates.json), skipping scenes already used
// in src/data/stickmanLandingGallery.json, for curating a page's gallery.
//   node scripts/lpContactSheets.mjs <candidatesDir> <outDir>
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [DIR, OUT] = process.argv.slice(2);
const GROUP = { f90160bc: "hunt", "3f65a0c7": "rain", "2f1b7e40": "fire" };
const used = new Set(JSON.parse(fs.readFileSync("src/data/stickmanLandingGallery.json", "utf8")).map((g) => g.file.replace(/^h-/, "")));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1620, height: 900 } });
for (const [project, group] of Object.entries(GROUP)) {
  const list = JSON.parse(fs.readFileSync(path.join(DIR, project, "candidates.json"), "utf8")).filter((c) => !used.has(`${group}-${String(c.n).padStart(3, "0")}.webp`));
  for (let i = 0; i < list.length; i += 30) {
    const cells = list.slice(i, i + 30).map((c) => {
      const n = String(c.n).padStart(3, "0");
      const bytes = fs.readFileSync(path.join(DIR, project, `${n}.img`));
      const type = bytes[0] === 0xff ? "jpeg" : bytes[0] === 0x89 ? "png" : "webp";
      return `<div style="position:relative"><img src="data:image/${type};base64,${bytes.toString("base64")}" style="width:320px;height:180px;display:block"><b style="position:absolute;left:0;top:0;background:#000;color:#fff;font:bold 18px Arial;padding:2px 6px">${n}</b></div>`;
    }).join("");
    await page.setContent(`<body style="margin:0;background:#222"><div style="display:grid;grid-template-columns:repeat(5,320px);gap:4px">${cells}</div></body>`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${group}-${i / 30}.png`, fullPage: true });
  }
  console.log(group, list.length, list.map((c) => c.n).join(" "));
}
await browser.close();
