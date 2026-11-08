// M2: builds the render page for a layout: R1's home world from real.js with the layout's world changes, + the M2
// runtime, which builds the layout's parts and plays its compiled timeline.
//   node m2/makePage.mjs <layout.json> <outDir>   -> <outDir>/m2_<key>.js + m2_<key>.html
// The page reads /m2run/<key>.layout.json and /m2run/<key>.timeline.json (copy them next to it before rendering).
// World changes a layout may ask for (all optional; the default is the landfill's world):
//   cut {x0, x1, z0, depth}            the box cut open on the face (the ground mesh gets its hole)
//   house [x, y, z], porch: false      where the house stands; no porch (a trench runs along its front)
//   trees [[x, z, s?], ...]            the two big trees;  road [x, y, z]  where the road lies
//   roots {pad, to}                    roots in the cut's span (+ pad) move right of x = to
//   rocksAvoid [[x0, x1, y0, y1], ...] no rocks or roots of the cut face in these boxes (pipe runs, soak pits)
//   house: false, worker: false, moreTrees: false (the four far trees), road: false   leave those out
//   backdrop {type: "street" | "park", ...}  a setting other than the yard (kit/backdrops.js)
//   sat (1.38)                         the grading saturation (set by the runner when a topic measures outside 0.38-0.45)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MOODS, moodFor } from "./moods.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export function makePage(layout) {
  const W = layout.world ?? {};
  // (a Windows checkout has CRLF line endings; the replacements below are written with LF)
  let s = fs.readFileSync(path.join(here, "..", "real.js"), "utf8").replace(/\r\n/g, "\n");
  const rep = (from, to) => { if (!s.includes(from)) throw new Error(`not found: ${from.slice(0, 80)}`); s = s.replace(from, to); };
  const cut = (from, to) => { const a = s.indexOf(from), b = s.indexOf(to); if (a < 0 || b < 0 || b < a) throw new Error(`markers not found: ${from} / ${to}`); s = s.slice(0, a) + s.slice(b); };
  const n = (v) => String(v);

  rep('import { VignetteShader } from "three/addons/shaders/VignetteShader.js";', 'import { VignetteShader } from "three/addons/shaders/VignetteShader.js";\nimport * as M2R from "./m2/runtime.js";\nimport * as KB from "./kit/backdrops.js";\nimport * as KT from "./kit/terrain.js";\nimport { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";\nimport { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";');
  // the "This is a…" glow: the named part's own silhouette, thick and bright, seen through what covers it (the real
  // checker failed 13 of 40 benchmark topics on a flat rectangle beside, above or around the thing, 2026-11-06)
  rep("composer.addPass(ao);", 'composer.addPass(ao);\nconst OUTLINE = new OutlinePass(new THREE.Vector2(W, H), scene, camera);\nObject.assign(OUTLINE, { edgeStrength: 40, edgeGlow: 2.2, edgeThickness: 9, pulsePeriod: 0 });\nOUTLINE.visibleEdgeColor.set("#ffc400"); OUTLINE.hiddenEdgeColor.set("#ffb000");\ncomposer.addPass(OUTLINE);');
  rep('const R = Number(Q.get("r") ?? 1);', `const R = 1;\nconst M2_LAYOUT = await (await fetch("/m2run/${layout.key}.layout.json")).json();\nconst M2_TL = await (await fetch("/m2run/${layout.key}.timeline.json")).json();`);
  // the video's light: a mood from its topic (m2/moods.js; step B of the batch-2 look study), over the yard's look
  const mood = MOODS[moodFor(layout)] ?? MOODS.noon, { fog: moodFog, ...moodLook } = mood;
  rep("renderer.toneMapping = LOOK.tone; renderer.toneMappingExposure = LOOK.exposure;", `Object.assign(LOOK, ${JSON.stringify(moodLook)});\nrenderer.toneMapping = LOOK.tone; renderer.toneMappingExposure = LOOK.exposure;`);
  if (moodFog) rep('if (R === 3) scene.fog = new THREE.Fog(C("#ffd9a8"), 70, 300);', `if (R === 3) scene.fog = new THREE.Fog(C("#ffd9a8"), 70, 300);\nscene.fog = new THREE.Fog(C(${JSON.stringify(moodFog[0])}), ${moodFog[1]}, ${moodFog[2]});`);
  // nothing dug in a thin-slab world: no pit in the ground (one of no size), its cut kept as M2_CUT for the road and the setting
  const closed = !!W.cut && !!W.shallow && !(layout.parts ?? []).some((p) => p.kind === "dig");
  const cutLit = W.cut && `{ x0: ${n(W.cut.x0)}, x1: ${n(W.cut.x1)}, z0: ${n(W.cut.z0)}, depth: ${n(W.shallow ? Math.min(W.cut.depth, 0.6) : W.cut.depth)} }`;
  rep("const PIT = { x0: -5, x1: 5, z0: -8, depth: 6 }", closed ? `const M2_CUT = ${cutLit}, PIT = { x0: ${n(W.cut.x0)}, x1: ${n(W.cut.x0)}, z0: -0.01, depth: 0.01 }` : `const M2_CUT = null, PIT = ${cutLit ?? "{ x0: -5, x1: 5, z0: -8, depth: 6 }"}`);
  // a wet lawn (rain)
  rep("function lawnMaterial() {", "const WET_LAWN = { value: 0 };\nfunction lawnMaterial() {");
  rep("  m.normalScale.set(0.8, 0.8);\n  m.onBeforeCompile = (sh) => {", "  m.normalScale.set(0.8, 0.8);\n  m.onBeforeCompile = (sh) => {\n    sh.uniforms.uWetLawn = WET_LAWN;");
  rep('"#include <common>\\nvarying vec3 vW;").replace("#include <map_fragment>", `', '"#include <common>\\nvarying vec3 vW; uniform float uWetLawn;").replace("#include <map_fragment>", `');
  rep("      diffuseColor.rgb = lawn;`);", "      lawn *= 1.0 - 0.34 * uWetLawn;\n      diffuseColor.rgb = lawn;`);");
  // the soil: seeps and murky groundwater (landfill); a wet band round a cut and a soak under a soak pit (French drain)
  rep('const u = {}; let head = "varying vec3 vW;\\n", fetch = "";',
    'const u = { uLeak: { value: new THREE.Vector4(3, 0, 0, 0) }, uLeak2: { value: new THREE.Vector4(1.4, 0, 0, 0) }, uMurk: { value: new THREE.Vector3(0, 0, 0) }, uWet: { value: new THREE.Vector4(0, 0, 0, 0) }, uSoak: { value: new THREE.Vector4(0, 0, 0, 0) }, uSoakOn: { value: 0 } }; let head = "varying vec3 vW;\\nuniform vec4 uLeak, uLeak2; uniform vec3 uMurk;\\nuniform vec4 uWet, uSoak; uniform float uSoakOn;\\n", fetch = "";');
  rep("      diffuseColor.rgb = c;`);", `      float wmask = smoothstep(-14.2, -13.9, y) * (1.0 - smoothstep(-11.15, -10.85, y));
      float ax = abs(vW.x);
      float col1 = (1.0 - smoothstep(uLeak.x - 0.6, uLeak.x + 0.4, ax)) * step(vW.y, -5.95) * smoothstep(uLeak.y - 0.6, uLeak.y + 0.3, vW.y) * step(-6.6, vW.z) * (1.0 - wmask);
      float col2 = (1.0 - smoothstep(uLeak2.x - 0.4, uLeak2.x + 0.3, ax)) * step(vW.y, -5.95) * smoothstep(uLeak2.y - 0.5, uLeak2.y + 0.3, vW.y) * step(-6.6, vW.z) * (1.0 - wmask);
      c = mix(c, vec3(0.13, 0.09, 0.03), clamp(col1 * uLeak.z + col2 * uLeak2.z, 0.0, 0.85));
      float md = abs(vW.x - uMurk.x) + (-11.0 - vW.y) * 0.6;
      c = mix(c, vec3(0.2, 0.17, 0.05), wmask * clamp((uMurk.y - md) / 2.0, 0.0, 1.0) * uMurk.z);
      float wetx = 1.0 - smoothstep(uWet.y, uWet.y + 1.6, abs(vW.x - uWet.x));
      float wety = smoothstep(uWet.z - 0.9, uWet.z + 0.3, vW.y) * (1.0 - smoothstep(-0.2, 0.1, vW.y));
      c = mix(c, c * vec3(${layout.codeShots ? "0.46, 0.38, 0.32" : "0.56, 0.6, 0.74"}), clamp(wetx * wety * uWet.w, 0.0, 1.0));
      float spread = max(0.0, uSoak.z - vW.y) * 0.32;
      float sx = 1.0 - smoothstep(0.0, 0.9, max(uSoak.x - spread - vW.x, vW.x - uSoak.y - spread));
      float sy = smoothstep(uSoak.w - 0.6, uSoak.w + 0.3, vW.y) * (1.0 - smoothstep(uSoak.z, uSoak.z + 0.4, vW.y));
      c = mix(c, ${layout.codeShots ? "c * vec3(0.46, 0.38, 0.32)" : "c * vec3(0.5, 0.52, 0.56) + vec3(0.0, 0.03, 0.08)"}, clamp(sx * sy * uSoakOn * 0.85, 0.0, 1.0));
      diffuseColor.rgb = c;\`);`);
  rep('m.customProgramCacheKey = () => "soil" + R;\n  return m;', 'm.customProgramCacheKey = () => "soil" + R;\n  m.userData.u = u;\n  return m;');
  if (W.roots) rep("if (x0 > PIT.x0 - 0.5 && x0 < PIT.x1 + 0.5) x0 += 11;", `if (x0 > PIT.x0 - ${n(W.roots.pad)} && x0 < ${n(W.roots.to)}) x0 = ${n(W.roots.to)} + (x0 - PIT.x0) * 0.6;`);
  if (W.rocksAvoid?.length) rep("while (x > PIT.x0 - 0.3 && x < PIT.x1 + 0.3 && y > -PIT.depth - 0.3);", `while ((x > PIT.x0 - 0.3 && x < PIT.x1 + 0.3 && y > -PIT.depth - 0.3)${W.rocksAvoid.map(([a, b, c, d]) => ` || (x > ${n(a)} && x < ${n(b)} && y > ${n(c)} && y < ${n(d)})`).join("")});`);
  // no soil cut (layoutRules rule 8: nothing in the story is underground): the ground is a thin slab, like a diorama's
  // base; no stones or roots down a face that isn't there (the groundwater film is hidden below: gwOff)
  if (W.shallow) {
    rep("BOTTOM = R === 4 ? -15.5 : -26", "BOTTOM = -1.4");
    cut("// R1: real stones and roots in the cut face", "// groundwater:");
    // the slab rests on the table (no dark base block under it), a neutral tabletop: a thin model on a table, not a
    // terrace floating over a pale floor
    rep("base.position.set(0, BOTTOM - 0.6, -D / 2); scene.add(base);", "base.position.set(0, BOTTOM - 0.6, -D / 2);");
    rep('std({ map: fineNoise("#b9a58a", 0.08), roughness: 0.7 })); table.rotation.x = -Math.PI / 2; table.position.y = BOTTOM - 1.2;', 'std({ map: fineNoise("#6a655c", 0.06), roughness: 0.8 })); table.rotation.x = -Math.PI / 2; table.position.y = BOTTOM - 0.005;');
  }
  // a terrain part (kit/terrain.js, scene language v2 phase 2): the yard's ground, its stones and roots, the groundwater
  // film, the trees, the house, the road and the worker give way to the generated ground (built below, before the parts)
  const terrainPart = (layout.parts ?? []).find((p) => p.kind === "terrain");
  if (terrainPart) {
    rep("const grassM = lawnMaterial(), soilM = soilMaterial();\n{", "const grassM = lawnMaterial(), soilM = soilMaterial();\nif (false) {");
    rep("if (R === 1 || R === 3) {\n  const rockM", "if (false) {\n  const rockM");
    rep("tree(-13, -11.5); tree(14, -3.4, 0.9); tree(-16, -27, 1.2); tree(18, -31, 1.3); tree(-3, -44, 1.1); tree(-23, -15, 1.05);", "");
  }
  // the static landfill parts and the static truck + flying bags
  cut("// ---------------- the scene ----------------", "// house: R1 detailed");
  cut("// dump truck tipping, two bags in the air", "// worker");
  if (W.house === false || terrainPart) cut("// house: R1 detailed", "// trees");
  if (W.worker === false || terrainPart) cut("// worker", "// R3: grass tufts");
  if (W.moreTrees === false && !terrainPart) rep("tree(-16, -27, 1.2); tree(18, -31, 1.3); tree(-3, -44, 1.1); tree(-23, -15, 1.05);", "");
  if (W.road === false || terrainPart) rep("road.receiveShadow = true; scene.add(road); }", "road.receiveShadow = true; }");
  if (Array.isArray(W.house) && !terrainPart) rep("const g = new THREE.Group(); g.position.set(-8, 0, -30); scene.add(g);", `const g = new THREE.Group(); g.position.set(${W.house.map(n).join(", ")}); scene.add(g);`);
  if (W.porch === false && W.house !== false && !terrainPart) rep("box(P.trim, 3.2, 0.18, 1.4, 0, 2.9, Dd / 2 + 0.7, g, 0.03); for (const x of [-1.4, 1.4]) cyl(P.trim, 0.09, 2.8, x, 1.4, Dd / 2 + 1.3, g); ", "");
  if (W.trees && !terrainPart) rep("tree(-13, -11.5); tree(14, -3.4, 0.9);", W.trees.map((a) => `tree(${a.map(n).join(", ")});`).join(" "));
  if (Array.isArray(W.road)) rep("road.position.set(0, 0.01, -D - 45 + 9.5);", `road.position.set(${W.road.map(n).join(", ")});`);
  // the groundwater film (the landfill's murk shader goes on it); saturation toward the creator's 0.41
  // (hidden where a creek is the water in the story: a blue band under it reads as the creek)
  const gwOff = W.groundwater === false || W.shallow || !!terrainPart || (layout.parts ?? []).some((p) => p.kind === "creek");
  rep("const water = new THREE.Mesh(g, wm); water.position.z = 0.03; scene.add(water);", "const water = new THREE.Mesh(g, wm); water.position.z = 0.03; scene.add(water); window.__water = water;" + (gwOff ? " water.visible = false;" : ""));
  rep("hemi: 0.15, sat: 1.12,", `hemi: 0.15, sat: Number(Q.get("satR1") ?? ${n(W.sat ?? 1.38)}),`);
  // the animated renderAt
  rep("window.renderAt = () => { const t0 = performance.now(); composer.render(); window.lastMs = performance.now() - t0; return true; };", "");
  rep("manager.onLoad = () => { window.ready = true; };", `{
  const ctx = { THREE, scene, envBase: LOOK.env, outlinePass: OUTLINE, RoundedBoxGeometry, mergeVertices, rnd, grassM, soilM, box, cyl, P, bagGeo, std, phys, PBR, tex, C, sun, hemi: scene.children.find((o) => o.isHemisphereLight), cut: M2_CUT ?? PIT, soilU: soilM.userData.u, WET_LAWN, waterMesh: window.__water, sharedGeo: {}, gltf: (u, cb) => new GLTFLoader(manager).load(u, cb) };
  // a thin-slab world (no soil cut): the ground runs on toward the camera, the lawn and the setting's floor alike, so a
  // pull-back never shows an edge over the table below (the haze band of 2026-10-25)
  if (M2_LAYOUT.world?.shallow) { const ap = new THREE.Mesh(new THREE.PlaneGeometry(2 * X, 60), grassM); ap.rotation.x = -Math.PI / 2; ap.position.set(0, -0.004, 29.6); ap.receiveShadow = true; scene.add(ap); }
  // a thin slab with nothing dug (no dig part: a street topic, a barrel on the lawn) has no hole at all: the page's pit has
  // no size (M2_CUT, the layout's cut, still places the road and the setting); a turf lid showed the lawn's soil band
  const M2_CLOSED = !!M2_CUT;
  // the terrain (kit/terrain.js), before the parts: they stand on it; the world cut is one of its pits
  const M2_TP = M2_LAYOUT.parts.find((p) => p.kind === "terrain");
  if (M2_TP) { const c = M2_LAYOUT.world?.cut, blocks = [...(M2_TP.params?.blocks ?? []), ...(c && !M2_LAYOUT.world?.shallow ? [{ type: "pit", ...c }] : [])]; ctx.terrain = KT.buildTerrain(ctx, { ...M2_TP.params, blocks }); }
  if (M2_LAYOUT.world?.backdrop) KB.backdrop(ctx, { ...M2_LAYOUT.world.backdrop, apron: !!M2_LAYOUT.world?.shallow, closed: M2_CLOSED });
  const look = Q.get("cam") ? Q.get("cam").split(",").map(Number) : null; // debug: ?cam=px,py,pz,tx,ty,tz
  const run = M2R.runLayout(ctx, M2_LAYOUT, M2_TL, { endCard: Q.get("endcard") !== "0", look });
  window.renderAt = (t, camT) => { run.update(t, camera, camT ?? t); composer.render(); return true; };
  // (the look meter: the main part's real width share on screen at time t, from its meshes; measuring only)
  window.mainWidthAt = (t) => { run.update(t, camera, t); camera.updateMatrixWorld(); const m = M2_LAYOUT.parts.find((p) => p.main), o = m && run.parts.get(m.id)?.obj?.group; if (!o) return null; const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) return null; let x0 = 1, x1 = 0; for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { const v = new THREE.Vector3(x, y, z).project(camera); if (v.z > 1) continue; x0 = Math.min(x0, (v.x + 1) / 2); x1 = Math.max(x1, (v.x + 1) / 2); } return Math.max(0, Math.min(1, x1) - Math.max(0, x0)); };
}
manager.onLoad = () => { window.ready = true; };`);
  return s;
}

if (/makePage\.mjs$/.test(process.argv[1] ?? "")) {
  const [layoutFile, outDir] = process.argv.slice(2);
  const layout = JSON.parse(fs.readFileSync(layoutFile, "utf8"));
  const js = makePage(layout);
  fs.writeFileSync(path.join(outDir, `m2_${layout.key}.js`), js);
  fs.writeFileSync(path.join(outDir, `m2_${layout.key}.html`), fs.readFileSync(path.join(here, "..", "full.html"), "utf8").replace('src="/full.js"', `src="/m2_${layout.key}.js"`));
  console.log(`m2_${layout.key}.js`, js.length, "chars");
}
