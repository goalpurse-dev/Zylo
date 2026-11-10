// PLASTIC-WORLD 2026-11-10 (owner: "Switch the whole engine to that style: smooth plastic everywhere, solid saturated
// colours, light specular gloss, no photo textures ... bright sun key + sky fill + rim, no haze by default, night = deep
// blue with strong coloured practicals ... Kill beige"): the free, pure checks. No render, no paid call.
//   node --test dev/plastic.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import { PLASTIC, PLASTIC_LOOK, plasticParams, makePlastic, plastic, toyColour, isBeige, hsvOf, flatFor, TEX_FLAT, plasticRough, plasticizeMaterial, isPhotoMap, capRadianceChunk, RADIANCE_MAX } from "../page/kit/plastic.js";
import { THEMES, THEME_IDS, RIGS, RIG_IDS } from "../lib/setThemes.js";
import { fogPolicy, FOG_MIN_NEAR, modeOf, LIGHT_MODES } from "../page/lighting.js";
import { toyParts, toyModelFor, TOY_GREENS, TOY_FLOWERS, TOY_GROUND } from "../page/kit/nature.js";
import { makeKit } from "../page/sets/util.js";

const src = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const MAPS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "bumpMap"];
const noMaps = (m) => MAPS.every((k) => !m[k]);
const hexOfColor = (c) => `#${c.getHexString()}`;

test("the plastic look is on and its material has no texture maps, a low roughness and a light clearcoat", () => {
  assert.equal(PLASTIC_LOOK, true);
  const p = plasticParams("#e8323c");
  assert.ok(MAPS.every((k) => !(k in p)), JSON.stringify(p));
  assert.ok(p.roughness >= 0.3 && p.roughness <= 0.55 && p.clearcoat > 0 && p.metalness === 0, JSON.stringify(p));
  for (const m of [makePlastic(THREE, "#2a6ae0"), plastic("#ffd21a"), plastic("#56c63e", { roughness: 0.95 })]) {
    assert.ok(m.isMeshPhysicalMaterial && noMaps(m), m.type);
    assert.ok(m.roughness >= PLASTIC.minRough && m.roughness <= PLASTIC.maxRough, String(m.roughness));
  }
  assert.equal(plasticRough(0.95), 0.55); assert.equal(plasticRough(0.05), 0.3);
  assert.equal(plasticParams("#000", { matte: true, roughness: 0.9 }).roughness, 0.9);
});

test("toyColour: beige never survives, weak colours get saturated, white stays white", () => {
  for (const b of ["#e6d3b0", "#f2c27e", "#cfc6b0", "#e8d6a0", "#d8cfc0", "#b89c78", "#e0c9a0", "#f4e2c8", "#8a7a52"]) {
    const t = toyColour(b);
    assert.ok(!isBeige(t), `${b} -> ${t}`);
  }
  assert.equal(toyColour("#ffffff"), "#ffffff");
  for (const c of ["#7fb8d8", "#5f9e3a", "#9a5a4a", "#6a5848", "#4a7a2a"]) { const { s, v } = hsvOf(toyColour(c)); assert.ok(s >= 0.44 && v >= 0.42, `${c} -> ${toyColour(c)}`); }
  const grey = hsvOf(toyColour("#8a8a8a")); assert.ok(grey.s < 0.12, "a grey stays neutral");
});

test("every Poly Haven surface maps to a flat toy colour: grass bright green, paths / sand never beige", () => {
  const tints = ["#ffffff", "#9fe06a", "#b8d08a", "#86c856", "#7cc24e", "#e0c9a0", "#c9a477", "#b89c78", "#d9c9a8", "#f6e6c0", "#e6e2dc", "#f2c27e", "#f4e2c8", "#bfe0ff", "#c9c4bc"];
  for (const name of Object.keys(TEX_FLAT)) for (const tint of tints) {
    const c = flatFor(name, tint);
    assert.ok(!isBeige(c), `${name} + ${tint} -> ${c} is beige`);
    if (/^leafy_grass|^forest_ground/.test(name)) { const { h, s, v } = hsvOf(c); assert.ok(h >= 85 && h <= 140 && s >= 0.55 && v >= 0.6, `${name} + ${tint} -> ${c}`); }
  }
});

test("the sets' pbr() hands out plastic: no photo texture is loaded, no map in Node, roughness in range", () => {
  let loads = 0;
  const K = makeKit({ THREE, gltf: async () => { throw new Error("no models here"); }, tex: () => { loads++; return new THREE.Texture(); } }, new THREE.Group());
  for (const [n, t] of [["leafy_grass", "#9fe06a"], ["concrete_pavement", "#f2eee8"], ["brown_mud_dry", "#c9a477"], ["painted_plaster_wall", "#bfe0ff"], ["asphalt_02", "#b8b8bc"], ["dark_rock", "#c9c4bc"]]) {
    const m = K.pbr(n, { tint: t });
    assert.ok(noMaps(m), n);
    assert.ok(m.roughness <= 0.55 && m.roughness >= 0.3, `${n}: ${m.roughness}`);
    assert.ok(!isBeige(hexOfColor(m.color)), `${n}: ${hexOfColor(m.color)}`);
  }
  assert.equal(loads, 0, "a photo texture was requested");
  const s = K.solid("#e6d3b0", { roughness: 0.9 });
  assert.ok(s.isMeshPhysicalMaterial && s.roughness <= 0.55 && !isBeige(hexOfColor(s.color)), "the kit's solid is plastic, de-beiged");
});

test("palettes: bright saturated toy palettes, no beige / brown ground or walls", () => {
  const okWall = (c) => { const { s, v } = hsvOf(c); return (s >= 0.35 && v >= 0.45) || (s < 0.14 && v >= 0.75); };
  for (const id of THEME_IDS) {
    const P = THEMES[id].palette;
    for (const w of P.walls) { assert.ok(okWall(w), `${id}: wall ${w}`); assert.ok(!isBeige(w), `${id}: beige wall ${w}`); }
    for (const a of P.accents) { const { s, v } = hsvOf(a); assert.ok((s >= 0.5 && v >= 0.55) || (s < 0.05 && v > 0.95), `${id}: accent ${a}`); }
    const g = hsvOf(P.ground);
    assert.ok(!isBeige(P.ground), `${id}: beige ground ${P.ground}`);
    assert.ok(!(g.h >= 10 && g.h <= 50 && g.s > 0.15 && g.s < 0.62 && g.v < 0.75), `${id}: brown ground ${P.ground}`);
    assert.ok(g.v >= 0.3, `${id}: ground too dark ${P.ground}`);
  }
});

test("rigs: every rig has a rim light; the night practicals are strongly coloured; neon blooms only emissives", () => {
  for (const r of RIG_IDS) assert.ok(Array.isArray(RIGS[r].rim) && RIGS[r].rim[1] > 0, r);
  for (const p of RIGS.night_practicals.points) assert.ok(hsvOf(p.colour).s >= 0.5, p.colour);
  assert.ok(RIGS.neon.post.bloomTh >= 0.8);
  for (const r of RIG_IDS) if (RIGS[r].hemi) assert.ok(!isBeige(RIGS[r].hemi[1]), `${r}: beige bounce ${RIGS[r].hemi[1]}`);
});

test("lighting: no fog / haze by default (only a far fade), deep-blue night, no beige bounce, strong sun", () => {
  assert.deepEqual(fogPolicy(["#fff", 6, 60]), ["#fff", FOG_MIN_NEAR, FOG_MIN_NEAR * 4]);
  assert.deepEqual(fogPolicy(["#fff", 6, 60], { haze: true }), ["#fff", 6, 60]); // a deliberate mood opts in
  assert.equal(fogPolicy(null), null);
  for (const n of LIGHT_MODES) {
    const M = modeOf(n);
    assert.ok(M.fog[1] >= FOG_MIN_NEAR, `${n}: fog starts at ${M.fog[1]}`);
    assert.ok(!isBeige(M.hemi[1]), `${n}: beige ground bounce ${M.hemi[1]}`);
  }
  const night = modeOf("night");
  for (const c of [night.sky.zen, night.sky.hor, night.hemi[0]]) { const { h, s } = hsvOf(c); assert.ok(h >= 205 && h <= 240 && s >= 0.5, `night ${c}`); }
  assert.ok(hsvOf(night.sky.hor).v >= 0.45, "the night horizon is a readable blue, not black");
  assert.ok(modeOf("day").sun.intensity >= 4.5 && hsvOf(modeOf("day").sun.color).s < 0.2, "a strong, near-white sun");
  // the rig layer builds a rim light; applyLight runs every fog through the policy
  const L = src("../page/lighting.js");
  assert.match(L, /rig:rim/); assert.match(L, /fogPolicy\(rig\.fog/);
});

test("toy nature: clean shapes with no texture, bright greens / flowers, no Poly Haven model in the plastic path", () => {
  for (const k of ["round", "fir", "blocky", "bush", "rock", "log", "stump", "flower"]) for (const lod of [0, 1]) {
    const parts = toyParts(THREE, k, lod);
    assert.ok(parts.length && parts.every((p) => noMaps(p.material) && p.material.roughness <= 0.55), k);
  }
  for (const g of [...TOY_GREENS, TOY_GROUND.grass, TOY_GROUND.grass2, TOY_GROUND.hills]) { const { h, s, v } = hsvOf(g); assert.ok(h >= 90 && h <= 140 && s >= 0.55 && v >= 0.6, g); }
  for (const f of TOY_FLOWERS) assert.ok(!isBeige(f), f);
  assert.ok(!isBeige(TOY_GROUND.path));
  assert.ok(toyModelFor(THREE, "/assets/ph/jacaranda_tree/jacaranda_tree.gltf")?.isObject3D);
  assert.ok(toyModelFor(THREE, "/assets/ph/shrub_04/shrub_04.gltf")?.isObject3D);
  assert.equal(toyModelFor(THREE, "/assets/kenney/car/sedan.glb"), null);
  const N = src("../page/kit/nature.js"), body = N.slice(N.indexOf("async function makeToyNature"), N.indexOf("// ---------------------------------------------------------------------------------------------- dust and leaves"));
  assert.ok(body.length > 500 && !/gltf\(|TextureLoader|\.jpg/.test(body), "the toy nature loads a model / photo texture");
});

test("the safety net: a photo-mapped material loses its maps and turns plastic; canvas patterns and signs stay", () => {
  const photo = new THREE.Texture(); photo.userData.mimeType = "image/jpeg";
  const m = new THREE.MeshStandardMaterial({ map: photo, normalMap: new THREE.Texture(), roughness: 1 });
  assert.ok(isPhotoMap(photo));
  plasticizeMaterial(m);
  assert.ok(noMaps(m) && m.roughness <= 0.55, "photo maps dropped");
  const sign = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture({ width: 4, height: 4 }), roughness: 0.9 });
  plasticizeMaterial(sign);
  assert.ok(sign.map && sign.roughness <= 0.55, "a canvas map (a sign) stays");
  const beige = new THREE.MeshStandardMaterial({ color: "#e6d3b0" });
  plasticizeMaterial(beige);
  assert.ok(!isBeige(hexOfColor(beige.color)), hexOfColor(beige.color));
});

test("winter keeps clean white plastic snow + light blue shadows; animals / giants have no fur noise", () => {
  const W = src("../page/winter.js");
  assert.match(W, /vec3\(0\.90, 0\.94, 1\.0\)/); assert.match(W, /#a8c8ff/);
  assert.match(src("../page/kit/animals/textures.js"), /PATTERN_KINDS\.includes\(kind\)/);
  assert.match(src("../page/kit/giants.js"), /PLASTIC_LOOK \? solid\(toyColour\(c\)/);
});

test("GATE-V3 radiance cap: three's opaque_fragment writes the outgoing light clamped (no Inf glint -> no black / white bloom blocks)", () => {
  const src = "gl_FragColor = vec4( outgoingLight, diffuseColor.a );";
  const out = capRadianceChunk(src, 24);
  assert.match(out, /clamp\( outgoingLight, 0\.0, 24\.0 \)/);
  assert.equal(capRadianceChunk(out, 24), out, "idempotent");
  assert.equal(capRadianceChunk("no light here"), "no light here");
  assert.ok(RADIANCE_MAX >= 8 && RADIANCE_MAX < 1000);
  assert.match(THREE.ShaderChunk.opaque_fragment, /clamp\( outgoingLight, 0\.0, /, "patched at import, before any shader compiles");
});

test("GATE-V3: no default ground / path / paving near white (it clipped under the plastic sun)", () => {
  for (const c of [TEX_FLAT.concrete_pavement, TEX_FLAT.grass_path_2, TEX_FLAT.brown_mud_dry, TOY_GROUND.path, flatFor("unknown_surface")]) assert.ok(hsvOf(c).v <= 0.86, c);
});
