// SETS-V2 2026-11-09 (owner D: set palettes / places, F: lighting rigs + the per-shot grade toward the reference look):
// the free, pure parts. No render, no paid call.   node --test dev/setsV2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { THEMES, THEME_IDS, RIGS, RIG_IDS, themeFor, rigFor, storyStyle, frameStats, gradeFor, onTarget, MAX_PLACE_SHARE } from "../lib/setThemes.js";
import { worldPlaceKind, placeKindOf, balancePlaces, placesOf, buildWorldBible } from "../lib/worldBible.js";
import { planScript, placeShares } from "./setsV2Places.mjs";
import * as plan from "../plan.mjs";

const src = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const img = (n, f) => { const a = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) { const [r, g, b] = f(i); a.set([r, g, b, 255], i * 4); } return a; };

test("frameStats: the look gate's measure (median V / S, beige share, p90-p10 contrast, hue entropy)", () => {
  const beige = frameStats(img(400, () => [226, 200, 150]));
  assert.ok(beige.beige > 0.99 && beige.contrast < 0.01 && beige.warm > 0.25, JSON.stringify(beige));
  const split = frameStats(img(400, (i) => (i % 2 ? [20, 40, 200] : [240, 60, 40])));
  assert.ok(split.contrast > 0.1 && split.hueEntropy > 0.9 && split.beige === 0, JSON.stringify(split));
});

test("gradeFor: overexposed day pulled down, dark night lifted, beige / orange cast cooled, flat light gets contrast; deterministic", () => {
  const over = gradeFor({ bright: 0.91, sat: 0.35, warm: 0.15, clip: 0.19, dark: 0, beige: 0.5, contrast: 0.3 }, "day");
  assert.ok(over.expo < 0.85 && over.warm < -0.04 && over.con > 1.1, JSON.stringify(over));
  assert.deepEqual(over, gradeFor({ bright: 0.91, sat: 0.35, warm: 0.15, clip: 0.19, dark: 0, beige: 0.5, contrast: 0.3 }, "day"));
  const night = gradeFor({ bright: 0.22, sat: 0.4, warm: -0.05, clip: 0, dark: 0.5, beige: 0, contrast: 0.4 }, "night_practicals");
  assert.ok(night.expo > 1.5, JSON.stringify(night));
  // saturation is not our problem: only a gentle pull either way
  const sat = gradeFor({ bright: 0.68, sat: 0.6, warm: 0, clip: 0, dark: 0, beige: 0, contrast: 0.52 }, "day");
  assert.ok(sat.sat >= 0.85 && sat.sat < 1, JSON.stringify(sat));
  // a sunset keeps its warmth unless it is one orange
  assert.equal(gradeFor({ bright: 0.62, sat: 0.42, warm: 0.15, clip: 0, dark: 0, beige: 0, contrast: 0.52 }, "golden").warm, 0);
  assert.ok(onTarget({ bright: 0.7, clip: 0 }, "day") && !onTarget({ bright: 0.9, clip: 0 }, "day"));
});

test("themes: every theme has a palette that is not beige, props the dresser can make, a rig per light; rigs have targets", async () => {
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({}) }) }) };
  const THREE = await import("three");
  const { PROP_MAKERS } = await import("../page/sets/themes.js");
  const beigeHex = (h) => { const st = frameStats(img(1, () => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)])); return st.beige > 0.5; };
  for (const id of THEME_IDS) {
    const th = THEMES[id];
    for (const p of th.props) assert.ok(PROP_MAKERS[p], `${id}: no maker for ${p}`);
    if (id !== "desert_ruins") assert.ok(th.palette.walls.filter(beigeHex).length === 0, `${id}: beige walls ${th.palette.walls}`);
    for (const l of ["day", "warm", "dusk", "dawn", "night"]) assert.ok(RIG_IDS.includes(th.rigs[l]), `${id} ${l}`);
  }
  for (const r of RIG_IDS) assert.ok(RIGS[r].target.bright >= 0.42 && RIGS[r].target.bright <= 0.72, r); // never unreadably dark
  // every prop builds (three in node; a canvas stub for the glyph wall)
  for (const [name, mk] of Object.entries(PROP_MAKERS)) { let k = 1; const g = mk(THREE, THEMES.market_square.palette, () => ((k = (k * 16807) % 2147483647) / 2147483647)); assert.ok(g.isObject3D && g.userData.r > 0, name); }
});

test("themeFor / rigFor / storyStyle: era + kind pick the theme; light + words pick the rig", () => {
  assert.equal(storyStyle("the king rode to the castle and the knights cheered"), "castle");
  assert.equal(storyStyle("robots and neon signs everywhere in the future city"), "neon");
  assert.equal(themeFor("street", { style: "castle" }), "castle");
  assert.equal(themeFor("street", { style: "neon" }), "neon_city");
  assert.equal(themeFor("square", {}), "market_square");
  assert.equal(themeFor("lane", {}), "back_lane");
  assert.equal(themeFor("home", { text: "the kitchen" }), "home_interior");
  assert.equal(themeFor("street", { weather: "snow" }), "snowy_street");
  assert.equal(rigFor({ theme: "suburb", light: "night", text: "the alarm went off" }), "alarm_red");
  assert.equal(rigFor({ theme: "bedroom", light: "night" }), "interior_warm");
  assert.equal(rigFor({ theme: "neon_city", light: "night" }), "neon");
  assert.equal(rigFor({ theme: "suburb", light: "night" }), "night_practicals");
  assert.equal(rigFor({ theme: "suburb", light: "warm" }), "golden");
});

test("#4 / #5 the belfry: a square whose description mentions the bell tower is the square; the tower world only by name", () => {
  assert.equal(worldPlaceKind({ id: "square", name: "Town square", description: "Cobbled square with fountain, town hall and the bell tower" }), "square");
  assert.equal(worldPlaceKind({ id: "tower", name: "Inside the bell tower", description: "Wooden bell tower room" }), "tower");
  assert.equal(worldPlaceKind({ id: "tobin_home", name: "Tobin's house", description: "Kitchen, stairs and Wren's bedroom" }), "home");
  assert.equal(placeKindOf("we ate breakfast in the kitchen"), "kitchen");
  assert.equal(placeKindOf("we met in the park"), "park");
});

test("balancePlaces: no place over the cap when the lines allow it; place-named and opening lines stay", () => {
  const bible = buildWorldBible({ production: { worlds: [], cast: [], lines: [] }, script: { lines: [{ text: "In this town, bells ring." }] }, title: "T" });
  const shots = Array.from({ length: 20 }, (_, i) => ({ line: i, start: i, end: i + 1, set: "street", worldSpot: "square", place: "square", text: i === 5 ? "the market square was full" : `line ${i} happened` }));
  const tl = { shots };
  const moved = balancePlaces(tl, bible);
  assert.ok(moved > 0);
  const share = (id) => shots.filter((s) => s.worldSpot === id).length / shots.length;
  assert.ok(Math.max(...["main_street", "square", "park", "lane"].map(share)) <= MAX_PLACE_SHARE + 1e-9, JSON.stringify(shots.map((s) => s.worldSpot)));
  assert.equal(shots[0].worldSpot, "square"); assert.equal(shots[1].worldSpot, "square"); assert.equal(shots[5].worldSpot, "square");
  for (const s of shots) assert.equal(s.place, bible.spots.find((x) => x.id === s.worldSpot).place);
  assert.equal(balancePlaces(tl, bible), 0, "re-runnable: nothing moves twice");
  assert.ok(placesOf(bible.spots).every((p) => THEME_IDS.includes(p.theme)));
});

test("dev scripts re-plan: checks clean, every shot a known rig, the town stories in >= 3 places", async () => {
  for (const f of ["pet_dog_bell.json", "cat_roof.json", "run707609b1.json"]) {
    const tl = await planScript(f);
    assert.deepEqual(plan.checkTimeline(tl), [], f);
    for (const s of tl.shots) { assert.ok(RIG_IDS.includes(s.rig), `${f}: rig ${s.rig}`); if (s.theme) assert.ok(THEME_IDS.includes(s.theme)); }
    const { rows } = placeShares(tl);
    if (!tl.world?.creature?.townView) assert.ok(rows.length >= 3, `${f}: ${JSON.stringify(rows)}`);
  }
});

test("page wiring: the engine measures each shot's grade at its first frame and hands post the shot; sets get the dresser", () => {
  const e = src("../page/engine.js");
  assert.match(e, /post\.needsGrade\?\.\(si\)\) renderAt\(shot\.start, \{ calib: true \}\)/);
  assert.match(e, /post\.setShot\?\.\(si, shot, S, t\)/);
  assert.match(src("../page/post.js"), /setShot, needsGrade/);
  assert.match(src("../page/sets/index.js"), /attachDresser\(set, ctx\)/);
  assert.match(src("../page/sets/creatureWorld.js"), /return attachDresser\(S, ctx\)/);
  assert.match(src("../page/sets/townPlaces.js"), /name0 === "park" \|\| name0 === "lane"/);
  assert.match(src("../page/sets/bedroom.js"), /name0 === "kitchen"/);
});
