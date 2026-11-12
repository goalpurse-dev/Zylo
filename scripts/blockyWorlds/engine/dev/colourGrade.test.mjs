// GRADE 2026-11-10: the per-mood colour grade (lib/colourGrade.js + lib/data/colourGrade.json, fitted by
// lookgate/colourFit.py; page/post.js LUT pass). Free and pure: no render, no paid call.
//   node --test dev/colourGrade.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MOODS, RIG_MOOD, moodFor, assignMoods, lutRGBA, lutLookup } from "../lib/colourGrade.js";
import { RIG_IDS } from "../lib/setThemes.js";
import { themeShots } from "../lib/worldBible.js";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const GRADE = JSON.parse(read("../lib/data/colourGrade.json"));
const REF = JSON.parse(read("../lib/data/refColour.json"));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const hsvS = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
// OKLab, for the skin check
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function oklab([r, g, b]) {
  [r, g, b] = [r, g, b].map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
// skin: its tint (OKLab a/b: hue + chroma) is protected; its lightness follows the mood (a night is darker for everyone)
const dAB = (x, y) => { const p = oklab(x), q = oklab(y); return Math.hypot(p[1] - q[1], p[2] - q[2]); };
const hueOf = (x) => { const p = oklab(x); return (Math.atan2(p[2], p[1]) * 180) / Math.PI; };

test("every rig has a mood, and the data's rig map is the page's", () => {
  for (const r of RIG_IDS) assert.ok(MOODS.includes(RIG_MOOD[r]), `rig ${r} has no mood`);
  assert.deepEqual(GRADE.rigMood, { ...RIG_MOOD });
});

test("moodFor: own mood, else rig, else light; themeShots writes shot.mood", () => {
  assert.equal(moodFor({ mood: "neon", rig: "day" }), "neon");
  assert.equal(moodFor({ mood: "bogus", rig: "golden" }), "sunset");
  assert.equal(moodFor({ rig: "interior_warm", light: "night" }), "interior");
  assert.equal(moodFor({ light: "night" }), "night");
  assert.equal(moodFor({}), "day");
  const tl = { shots: [{ set: "street", light: "night", text: "x", worldSpot: "a" }, { set: "street", light: "day", text: "the alarm went off", worldSpot: "a" }] };
  themeShots(tl, { places: [{ id: "a", theme: "suburb" }] });
  assert.deepEqual(tl.shots.map((s) => s.mood), ["night", "alarm"]);
  assert.deepEqual(assignMoods({ shots: [{ rig: "neon" }] }).shots[0].mood, "neon");
});

test("reference stats: every mood measured from enough frames, abstract numbers only", () => {
  for (const m of MOODS) {
    const r = REF.moods[m];
    assert.ok(r && r.frames >= 20, `${m}: ${r?.frames} frames`);
    assert.equal(r.palette.length, 8);
    assert.equal(r.Lq.length, 51);
    assert.ok(!JSON.stringify(r).includes(".jpg"), "no frame paths in the stats");
  }
  // the moods differ the way they should: night / neon darker than day, sunset warmer than night
  assert.ok(REF.moods.night.look.bright < REF.moods.day.look.bright - 0.1);
  assert.ok(REF.moods.neon.look.bright < REF.moods.day.look.bright);
});

for (const mood of MOODS) {
  test(`${mood} LUT: size, white / black points kept, grey ramp monotone, skin protected, beige killed`, () => {
    const L = lutRGBA(GRADE, mood);
    assert.ok(L, `no LUT for ${mood}`);
    assert.equal(L.data.length, L.size ** 3 * 4);
    const k = lutLookup(L, 0, 0, 0), w = lutLookup(L, 1, 1, 1);
    assert.ok(Math.max(...k) <= 4 / 255, `black -> ${k}`);
    assert.ok(Math.min(...w) >= 249 / 255, `white -> ${w}`);
    let prev = -1;
    for (let v = 0; v <= 1.0001; v += 1 / 32) { const y = luma(lutLookup(L, v, v, v)); assert.ok(y >= prev - 1e-3, `grey ramp not monotone at ${v}`); prev = y; }
    for (const s of ["#f3cba9", "#c98e6b", "#8a5a3c", "#e7b38e", "#f6d6bd", "#a86f4b"]) {
      const c = hex(s), o = lutLookup(L, ...c);
      assert.ok(dAB(c, o) < 0.03 && Math.abs(hueOf(c) - hueOf(o)) < 10, `${mood}: skin ${s} tint moved ${dAB(c, o).toFixed(3)}, hue ${hueOf(c).toFixed(0)} -> ${hueOf(o).toFixed(0)}`);
    }
    for (const s of ["#d8c8a8", "#e2c896", "#c8b48c"]) {
      const c = hex(s), o = lutLookup(L, ...c);
      assert.ok(hsvS(o) < hsvS(c) * 0.9, `${mood}: beige ${s} sat ${hsvS(c).toFixed(3)} -> ${hsvS(o).toFixed(3)}`);
    }
  });
}

test("post.js: the mood LUT is the chain's last pass, off with ?nolut, measured out of the auto grade", () => {
  const src = read("../page/post.js");
  assert.match(src, /new LUTPass/);
  assert.match(src, /query\.has\("nolut"\)/);
  assert.match(src, /lutPass\.enabled = false;\s*\n\s*shoot\(N\)/);
  assert.ok(src.indexOf("composer.addPass(lutPass)") > src.indexOf("composer.addPass(grade)"));
});

test("look gate swatches: palette distance, the matched reference frame is the same mood and nearest", async () => {
  const { paletteDist, matchRef, refMood, oursMood } = await import("../../lookgate/compare.mjs");
  const blue = [{ hex: "#2050c0", share: 1 }], beige = [{ hex: "#d8c8a8", share: 1 }];
  assert.equal(paletteDist(blue, blue), 0);
  assert.ok(paletteDist(blue, beige) > 100);
  assert.equal(refMood({ light: "red alarm neon" }), "alarm");
  assert.equal(oursMood({ rig: "night_practicals", light: "night" }), "night");
  const refFrames = [{ file: "a", light: "day" }, { file: "b", light: "day" }, { file: "c", light: "dark cyan neon" }];
  const pal = { a: beige, b: blue, c: blue };
  const m = matchRef({ rig: "day" }, [{ hex: "#2252c4", share: 1 }], refFrames, pal);
  assert.equal(m.r.file, "b");
});
