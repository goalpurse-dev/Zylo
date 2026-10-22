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

const here = path.dirname(fileURLToPath(import.meta.url));

export function makePage(layout) {
  const W = layout.world ?? {};
  let s = fs.readFileSync(path.join(here, "..", "real.js"), "utf8");
  const rep = (from, to) => { if (!s.includes(from)) throw new Error(`not found: ${from.slice(0, 80)}`); s = s.replace(from, to); };
  const cut = (from, to) => { const a = s.indexOf(from), b = s.indexOf(to); if (a < 0 || b < 0 || b < a) throw new Error(`markers not found: ${from} / ${to}`); s = s.slice(0, a) + s.slice(b); };
  const n = (v) => String(v);

  rep('import { VignetteShader } from "three/addons/shaders/VignetteShader.js";', 'import { VignetteShader } from "three/addons/shaders/VignetteShader.js";\nimport * as M2R from "./m2/runtime.js";\nimport * as KB from "./kit/backdrops.js";');
  rep('const R = Number(Q.get("r") ?? 1);', `const R = 1;\nconst M2_LAYOUT = await (await fetch("/m2run/${layout.key}.layout.json")).json();\nconst M2_TL = await (await fetch("/m2run/${layout.key}.timeline.json")).json();`);
  if (W.cut) rep("const PIT = { x0: -5, x1: 5, z0: -8, depth: 6 }", `const PIT = { x0: ${n(W.cut.x0)}, x1: ${n(W.cut.x1)}, z0: ${n(W.cut.z0)}, depth: ${n(W.cut.depth)} }`);
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
      c = mix(c, c * vec3(0.56, 0.6, 0.74), clamp(wetx * wety * uWet.w, 0.0, 1.0));
      float spread = max(0.0, uSoak.z - vW.y) * 0.32;
      float sx = 1.0 - smoothstep(0.0, 0.9, max(uSoak.x - spread - vW.x, vW.x - uSoak.y - spread));
      float sy = smoothstep(uSoak.w - 0.6, uSoak.w + 0.3, vW.y) * (1.0 - smoothstep(uSoak.z, uSoak.z + 0.4, vW.y));
      c = mix(c, c * vec3(0.5, 0.52, 0.56) + vec3(0.0, 0.03, 0.08), clamp(sx * sy * uSoakOn * 0.85, 0.0, 1.0));
      diffuseColor.rgb = c;\`);`);
  rep('m.customProgramCacheKey = () => "soil" + R;\n  return m;', 'm.customProgramCacheKey = () => "soil" + R;\n  m.userData.u = u;\n  return m;');
  if (W.roots) rep("if (x0 > PIT.x0 - 0.5 && x0 < PIT.x1 + 0.5) x0 += 11;", `if (x0 > PIT.x0 - ${n(W.roots.pad)} && x0 < ${n(W.roots.to)}) x0 = ${n(W.roots.to)} + (x0 - PIT.x0) * 0.6;`);
  if (W.rocksAvoid?.length) rep("while (x > PIT.x0 - 0.3 && x < PIT.x1 + 0.3 && y > -PIT.depth - 0.3);", `while ((x > PIT.x0 - 0.3 && x < PIT.x1 + 0.3 && y > -PIT.depth - 0.3)${W.rocksAvoid.map(([a, b, c, d]) => ` || (x > ${n(a)} && x < ${n(b)} && y > ${n(c)} && y < ${n(d)})`).join("")});`);
  // the static landfill parts and the static truck + flying bags
  cut("// ---------------- the scene ----------------", "// house: R1 detailed");
  cut("// dump truck tipping, two bags in the air", "// worker");
  if (W.house === false) cut("// house: R1 detailed", "// trees");
  if (W.worker === false) cut("// worker", "// R3: grass tufts");
  if (W.moreTrees === false) rep("tree(-16, -27, 1.2); tree(18, -31, 1.3); tree(-3, -44, 1.1); tree(-23, -15, 1.05);", "");
  if (W.road === false) rep("road.receiveShadow = true; scene.add(road); }", "road.receiveShadow = true; }");
  if (Array.isArray(W.house)) rep("const g = new THREE.Group(); g.position.set(-8, 0, -30); scene.add(g);", `const g = new THREE.Group(); g.position.set(${W.house.map(n).join(", ")}); scene.add(g);`);
  if (W.porch === false && W.house !== false) rep("box(P.trim, 3.2, 0.18, 1.4, 0, 2.9, Dd / 2 + 0.7, g, 0.03); for (const x of [-1.4, 1.4]) cyl(P.trim, 0.09, 2.8, x, 1.4, Dd / 2 + 1.3, g); ", "");
  if (W.trees) rep("tree(-13, -11.5); tree(14, -3.4, 0.9);", W.trees.map((a) => `tree(${a.map(n).join(", ")});`).join(" "));
  if (Array.isArray(W.road)) rep("road.position.set(0, 0.01, -D - 45 + 9.5);", `road.position.set(${W.road.map(n).join(", ")});`);
  // the groundwater film (the landfill's murk shader goes on it); saturation toward the creator's 0.41
  rep("const water = new THREE.Mesh(g, wm); water.position.z = 0.03; scene.add(water);", "const water = new THREE.Mesh(g, wm); water.position.z = 0.03; scene.add(water); window.__water = water;");
  rep("hemi: 0.15, sat: 1.12,", `hemi: 0.15, sat: Number(Q.get("satR1") ?? ${n(W.sat ?? 1.38)}),`);
  // the animated renderAt
  rep("window.renderAt = () => { const t0 = performance.now(); composer.render(); window.lastMs = performance.now() - t0; return true; };", "");
  rep("manager.onLoad = () => { window.ready = true; };", `{
  const ctx = { THREE, scene, RoundedBoxGeometry, mergeVertices, rnd, grassM, soilM, box, cyl, P, bagGeo, std, phys, PBR, tex, C, sun, hemi: scene.children.find((o) => o.isHemisphereLight), cut: PIT, soilU: soilM.userData.u, WET_LAWN, waterMesh: window.__water, sharedGeo: {} };
  if (M2_LAYOUT.world?.backdrop) KB.backdrop(ctx, M2_LAYOUT.world.backdrop);
  const look = Q.get("cam") ? Q.get("cam").split(",").map(Number) : null; // debug: ?cam=px,py,pz,tx,ty,tz
  const run = M2R.runLayout(ctx, M2_LAYOUT, M2_TL, { endCard: Q.get("endcard") !== "0", look });
  window.renderAt = (t) => { run.update(t, camera); composer.render(); return true; };
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
