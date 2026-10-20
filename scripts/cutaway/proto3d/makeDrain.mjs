// Builds drain.js: R1's home world from real.js with the topic changes a French drain needs, + anim_drain.js.
//  - the cut is a trench along the front of the house (PIT reused: any box cut that opens on the face);
//  - the house moves forward so its front is 2 units behind the cut face (porch removed: the trench runs there);
//  - the road moves to the right, the landfill's static parts and truck are dropped;
//  - uniforms for a wet lawn, a wet band in the soil around the trench, and a soak spreading under the soak pit;
//  - the kit modules are imported; saturation toward the creator's 0.41, as in the landfill.
import fs from "node:fs";
const dir = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
let s = fs.readFileSync(dir + "real.js", "utf8");
const rep = (from, to) => { if (!s.includes(from)) throw new Error(`not found: ${from.slice(0, 80)}`); s = s.replace(from, to); };
const cut = (from, to) => { const a = s.indexOf(from), b = s.indexOf(to); if (a < 0 || b < 0 || b < a) throw new Error(`markers not found: ${from} / ${to}`); s = s.slice(0, a) + s.slice(b); };

rep('import { VignetteShader } from "three/addons/shaders/VignetteShader.js";', `import { VignetteShader } from "three/addons/shaders/VignetteShader.js";
import * as KV from "./kit/verbs.js";
import * as KCam from "./kit/camera.js";
import * as KDig from "./kit/digCut.js";
import * as KFill from "./kit/fill.js";
import * as KPipe from "./kit/pipe.js";
import * as KOv from "./kit/overlay.js";
import * as KW from "./kit/weather.js";
import * as KSheet from "./kit/sheet.js";
import * as KProps from "./kit/props.js";`);
rep('const R = Number(Q.get("r") ?? 1);', 'const R = 1;\nwindow.TIMES = await (await fetch("/times_drain.json")).json();');
// the cut: a trench in front of the house, open on the face
rep("const PIT = { x0: -5, x1: 5, z0: -8, depth: 6 }", "const PIT = { x0: -11.4, x1: 0.8, z0: -2.0, depth: 3.6 }");
// a wet lawn while it rains
rep("function lawnMaterial() {", "const WET_LAWN = { value: 0 };\nfunction lawnMaterial() {");
rep("  m.normalScale.set(0.8, 0.8);\n  m.onBeforeCompile = (sh) => {", "  m.normalScale.set(0.8, 0.8);\n  m.onBeforeCompile = (sh) => {\n    sh.uniforms.uWetLawn = WET_LAWN;");
rep('"#include <common>\\nvarying vec3 vW;").replace("#include <map_fragment>", `', '"#include <common>\\nvarying vec3 vW; uniform float uWetLawn;").replace("#include <map_fragment>", `');
rep("      diffuseColor.rgb = lawn;`);", "      lawn *= 1.0 - 0.34 * uWetLawn;\n      diffuseColor.rgb = lawn;`);");
// the soil: a wet band around the trench, a soak spreading down from the soak pit
rep('const u = {}; let head = "varying vec3 vW;\\n", fetch = "";',
  'const u = { uWet: { value: new THREE.Vector4(0, 0, 0, 0) }, uSoak: { value: new THREE.Vector4(0, 0, 0, 0) }, uSoakOn: { value: 0 } }; let head = "varying vec3 vW;\\nuniform vec4 uWet, uSoak; uniform float uSoakOn;\\n", fetch = "";');
rep("      diffuseColor.rgb = c;`);", `      float wetx = 1.0 - smoothstep(uWet.y, uWet.y + 1.6, abs(vW.x - uWet.x));
      float wety = smoothstep(uWet.z - 0.9, uWet.z + 0.3, vW.y) * (1.0 - smoothstep(-0.2, 0.1, vW.y));
      c = mix(c, c * vec3(0.56, 0.6, 0.74), clamp(wetx * wety * uWet.w, 0.0, 1.0));
      float spread = max(0.0, uSoak.z - vW.y) * 0.32;
      float sx = 1.0 - smoothstep(0.0, 0.9, max(uSoak.x - spread - vW.x, vW.x - uSoak.y - spread));
      float sy = smoothstep(uSoak.w - 0.6, uSoak.w + 0.3, vW.y) * (1.0 - smoothstep(uSoak.z, uSoak.z + 0.4, vW.y));
      c = mix(c, c * vec3(0.5, 0.52, 0.56) + vec3(0.0, 0.03, 0.08), clamp(sx * sy * uSoakOn * 0.85, 0.0, 1.0));
      diffuseColor.rgb = c;\`);`);
rep('m.customProgramCacheKey = () => "soil" + R;\n  return m;', 'm.customProgramCacheKey = () => "soil" + R;\n  m.userData.u = u;\n  return m;');
// roots: none in the trench, the pipe run or the soak pit (move them right of it)
rep("if (x0 > PIT.x0 - 0.5 && x0 < PIT.x1 + 0.5) x0 += 11;", "if (x0 > PIT.x0 - 0.8 && x0 < 7) x0 = 7 + (x0 - PIT.x0) * 0.6;");
// keep the stones and roots of the cut face off the pipe run and the soak pit
rep("while (x > PIT.x0 - 0.3 && x < PIT.x1 + 0.3 && y > -PIT.depth - 0.3);", "while ((x > PIT.x0 - 0.3 && x < PIT.x1 + 0.3 && y > -PIT.depth - 0.3) || (x > -12 && x < 7 && y > -7 && y < -2.4));");
// drop the landfill's static parts (liner, gravel, pipes, tank, trash, gas well) and the truck + flying bags
cut("// ---------------- the scene ----------------", "// house: R1 detailed");
cut("// dump truck tipping, two bags in the air", "// worker");
// the house: forward, its front 2.1 units behind the cut face; no porch (the trench runs along the front)
rep("const g = new THREE.Group(); g.position.set(-8, 0, -30); scene.add(g);", "const g = new THREE.Group(); g.position.set(-5.5, 0, -5.35); scene.add(g);");
rep("box(P.trim, 3.2, 0.18, 1.4, 0, 2.9, Dd / 2 + 0.7, g, 0.03); for (const x of [-1.4, 1.4]) cyl(P.trim, 0.09, 2.8, x, 1.4, Dd / 2 + 1.3, g); ", "");
// trees off the house and the mound; the road to the right, behind the yard
rep("tree(-13, -11.5); tree(14, -3.4, 0.9);", "tree(-14.5, -9.5); tree(13.5, -5.2, 0.9);");
rep("road.position.set(0, 0.01, -D - 45 + 9.5);", "road.position.set(8.5, 0.01, -57);");
// saturation toward the creator's 0.41 (same as the landfill)
rep("hemi: 0.15, sat: 1.12,", 'hemi: 0.15, sat: Number(Q.get("satR1") ?? 1.38),');
// the animated renderAt replaces the static one
rep("window.renderAt = () => { const t0 = performance.now(); composer.render(); window.lastMs = performance.now() - t0; return true; };", "");
rep("manager.onLoad = () => { window.ready = true; };", fs.readFileSync(dir + "anim_drain.js", "utf8") + "\nmanager.onLoad = () => { window.ready = true; };");
fs.writeFileSync(dir + "drain.js", s);
fs.writeFileSync(dir + "drain.html", fs.readFileSync(dir + "full.html", "utf8").replace('src="/full.js"', 'src="/drain.js"'));
console.log("drain.js", s.length, "chars");
