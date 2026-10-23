// Builds preview2.js: R1's home world from real.js (static topic parts removed, leak uniforms added to the soil
// shader, saturation toward 0.41) + anim_r1.js (animated topic parts, overlays, camera, timeline).
import fs from "node:fs";
const dir = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
let s = fs.readFileSync(dir + "real.js", "utf8");
const cut = (from, to) => { const a = s.indexOf(from), b = s.indexOf(to); if (a < 0 || b < 0 || b < a) throw new Error(`markers not found: ${from} / ${to}`); s = s.slice(0, a) + s.slice(b); };
// drop the static topic parts (liner, gravel, pipes, tank, trash, gas well) and the static truck + flying bags
cut("// ---------------- the scene ----------------", "// house: R1 detailed");
cut("// dump truck tipping, two bags in the air", "// worker");
// leak uniforms in the soil shader
s = s.replace('const u = {}; let head = "varying vec3 vW;\\n", fetch = "";',
  'const u = { uLeak: { value: new THREE.Vector4(3, 0, 0, 0) }, uLeak2: { value: new THREE.Vector4(1.4, 0, 0, 0) }, uMurk: { value: new THREE.Vector3(0, 0, 0) } }; let head = "varying vec3 vW;\\nuniform vec4 uLeak, uLeak2; uniform vec3 uMurk;\\n", fetch = "";');
s = s.replace("      diffuseColor.rgb = c;`);", `      float wmask = smoothstep(-14.2, -13.9, y) * (1.0 - smoothstep(-11.15, -10.85, y));
      float ax = abs(vW.x);
      float col1 = (1.0 - smoothstep(uLeak.x - 0.6, uLeak.x + 0.4, ax)) * step(vW.y, -5.95) * smoothstep(uLeak.y - 0.6, uLeak.y + 0.3, vW.y) * step(-6.6, vW.z) * (1.0 - wmask);
      float col2 = (1.0 - smoothstep(uLeak2.x - 0.4, uLeak2.x + 0.3, ax)) * step(vW.y, -5.95) * smoothstep(uLeak2.y - 0.5, uLeak2.y + 0.3, vW.y) * step(-6.6, vW.z) * (1.0 - wmask);
      c = mix(c, vec3(0.13, 0.09, 0.03), clamp(col1 * uLeak.z + col2 * uLeak2.z, 0.0, 0.85));
      float md = abs(vW.x - uMurk.x) + (-11.0 - vW.y) * 0.6;
      c = mix(c, vec3(0.2, 0.17, 0.05), wmask * clamp((uMurk.y - md) / 2.0, 0.0, 1.0) * uMurk.z);
      diffuseColor.rgb = c;\`);`);
s = s.replace("m.customProgramCacheKey = () => \"soil\" + R;\n  return m;", "m.customProgramCacheKey = () => \"soil\" + R;\n  m.userData.u = u;\n  return m;");
if (!s.includes("m.userData.u = u;")) throw new Error("soil uniforms not exposed");
// expose the groundwater film
s = s.replace("const water = new THREE.Mesh(g, wm); water.position.z = 0.03; scene.add(water);", "const water = new THREE.Mesh(g, wm); water.position.z = 0.03; scene.add(water); window.__water = water;");
// saturation toward the creator's 0.41
s = s.replace("hemi: 0.15, sat: 1.12,", "hemi: 0.15, sat: Number(Q.get(\"satR1\") ?? 1.38),");
// the static renderAt is replaced by the animated one
s = s.replace("window.renderAt = () => { const t0 = performance.now(); composer.render(); window.lastMs = performance.now() - t0; return true; };", "const waterMesh = window.__water;");
s = s.replace("manager.onLoad = () => { window.ready = true; };", fs.readFileSync(dir + "anim_r1.js", "utf8") + "\nmanager.onLoad = () => { window.ready = true; };");
s = s.replace('const R = Number(Q.get("r") ?? 1);', 'const R = 1;\nwindow.TIMES = await (await fetch("/times.json")).json(); const TIMES = window.TIMES;');
fs.writeFileSync(dir + "preview2.js", s);
console.log("preview2.js", s.length, "chars");
