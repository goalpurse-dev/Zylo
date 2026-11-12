// SETS preview page (dev only): builds a set with page/sets, lights it with applyLight, frames it with page/camera.js,
// renders through the locked look's post chain (copied from look/scene.js), with simple stand-in people at
// center / left / right and a tall dark 4.5 m stand-in at "far". Driven by dev/setsShot.mjs via window.show().
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { N8AOPass } from "n8ao";
import { buildSet, applyLight } from "/page/sets/index.js";
import { frameShot } from "/page/camera.js";
import { defaultLoaders } from "/page/sets/util.js";

const Q = new URLSearchParams(location.search);
const W = Number(Q.get("w") ?? 1080), H = Math.round(W * 16 / 9);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.86;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 3000);

// ---------- the look's post chain ----------
const POST = {
  day: { ao: 2.0, bloom: [0.22, 0.45, 1.6], sat: 1.58, con: 1.24, warm: 0.035 },
  night: { ao: 1.2, bloom: [0.5, 0.45, 0.85], sat: 1.15, con: 1.08, warm: -0.02 },
  warm: { ao: 1.8, bloom: [0.3, 0.45, 1.3], sat: 1.5, con: 1.2, warm: 0.07 },
};
const composer = new EffectComposer(renderer); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const ao = new N8AOPass(scene, camera, W, H); ao.configuration.aoRadius = 1.2; ao.configuration.distanceFalloff = 1; ao.configuration.halfRes = false; composer.addPass(ao);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.22, 0.45, 1.6); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.58 }, con: { value: 1.24 }, warm: { value: 0.035 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; uniform float sat, con, warm; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb; float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, sat); col = (col - 0.5) * con + 0.5; col *= vec3(1.0 + warm, 1.0 + warm * 0.3, 1.0 - warm); gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a); }",
});
composer.addPass(grade);
const setPost = (name) => { const p = POST[name]; ao.configuration.intensity = p.ao; [bloom.strength, bloom.radius, bloom.threshold] = p.bloom; grade.uniforms.sat.value = p.sat; grade.uniforms.con.value = p.con; grade.uniforms.warm.value = p.warm; };

// ---------- loading (wait for every texture/model) ----------
const LM = THREE.DefaultLoadingManager; const pending = { done: 0, total: 0 };
LM.onStart = (u, l, t) => { pending.done = l; pending.total = t; }; LM.onProgress = (u, l, t) => { pending.done = l; pending.total = t; };
LM.onError = (u) => console.log("load error", u);
const loaders = defaultLoaders(THREE);
const waitLoads = async () => { for (let i = 0; i < 2400 && pending.done < pending.total; i++) await new Promise((r) => setTimeout(r, 50)); };

// ---------- stand-ins ----------
function standIn(h, color, { dark = false } = {}) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.14, h * 0.55, 4, 12), m); body.position.y = h * 0.42; g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(h * 0.17, h * 0.18, h * 0.17), dark ? m : new THREE.MeshStandardMaterial({ color: "#f3cba9", roughness: 0.55 })); head.position.y = h * 0.9; g.add(head);
  if (dark) for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(h * 0.012, 8, 6), new THREE.MeshBasicMaterial({ color: "#9be8ff" })); e.position.set(s * h * 0.035, h * 0.92, h * 0.086); g.add(e); }
  else { const eyes = new THREE.Mesh(new THREE.BoxGeometry(h * 0.1, h * 0.025, 0.01), new THREE.MeshBasicMaterial({ color: "#2a1d24" })); eyes.position.set(0, h * 0.92, h * 0.086); g.add(eyes); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  g.userData.h = h; scene.add(g); return g;
}
const PEOPLE = { center: standIn(1.2, "#ff8a1a"), left: standIn(1.72, "#18b8a5"), right: standIn(1.68, "#ff5c9a"), back: standIn(1.6, "#6c5ce7") };
const MON = standIn(4.5, "#14161c", { dark: true });
const SIGN = (() => {
  const c = document.createElement("canvas"); c.width = 512; c.height = 340; const p = c.getContext("2d");
  p.fillStyle = "#f4e7c8"; p.fillRect(0, 0, 512, 340); p.strokeStyle = "#5a3b24"; p.lineWidth = 18; p.strokeRect(9, 9, 494, 322);
  p.fillStyle = "#2a1d24"; p.font = "bold 54px sans-serif"; p.textAlign = "center"; p.fillText("NO TALKING", 256, 140); p.fillText("AFTER DARK", 256, 220);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.05), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })); m.position.y = 0.4; g.add(m);
  scene.add(g); return g;
})();

// ---------- sets ----------
const SETS = {};
let lightH = null, cur = null;
async function getSet(name) {
  if (!SETS[name]) {
    const t0 = performance.now();
    SETS[name] = await buildSet(name, { THREE, scene, renderer, ...loaders });
    await waitLoads();
    SETS[name].loadMs = performance.now() - t0;
  }
  return SETS[name];
}
const hz = (v) => new THREE.Vector3(v.x, 0, v.z);
window.show = async ({ set = "street", light = "day", cam = "wide", focus = "group", t = 0, dur = 3, seed = 1, monster = true, monsterSpot = "far" } = {}) => {
  const S = await getSet(set);
  for (const [n, s] of Object.entries(SETS)) s.root.visible = n === set;
  if (cur !== `${set}|${light}`) { lightH?.dispose(); lightH = applyLight(light, { THREE, scene, renderer, set: S }); setPost(light); cur = `${set}|${light}`; }
  const sp = S.spots, depth = hz(sp.far).sub(hz(sp.center)).normalize();
  for (const [k, p] of Object.entries(PEOPLE)) { p.position.copy(sp[k]); p.visible = true; }
  PEOPLE.back.visible = cam === "wide";
  MON.position.copy(sp[monsterSpot] ?? sp.far); MON.visible = monster;
  SIGN.visible = focus === "insert";
  const ins = sp.center.clone().addScaledVector(depth, -1.4); SIGN.position.copy(ins).setY(sp.center.y + 0.9); SIGN.rotation.set(0, Math.atan2(-depth.x, -depth.z), 0);
  let f, fh, other;
  if (focus === "group") { f = ["center", "left", "right"].reduce((a, k) => a.add(sp[k]), new THREE.Vector3()).divideScalar(3); fh = 1.72; }
  else if (focus === "monster") { f = MON.position.clone(); fh = 4.5; other = sp.center.clone(); }
  else if (focus === "insert") { f = SIGN.position.clone(); fh = 0.8; }
  else if (focus === "door") { PEOPLE.back.position.copy(sp.door); PEOPLE.back.visible = true; f = sp.door.clone(); fh = 1.6; }
  else { f = sp[focus].clone(); fh = PEOPLE[focus]?.userData.h ?? 1.7; other = sp[focus === "left" ? "center" : "left"].clone(); }
  frameShot(cam, { THREE, camera, set: S, focus: f, focusHeight: fh, other, t, dur, seed });
  // everyone faces the camera
  for (const p of [...Object.values(PEOPLE), MON]) p.rotation.y = Math.atan2(camera.position.x - p.position.x, camera.position.z - p.position.z);
  const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(0, 0), camera); const hit = rc.intersectObjects(scene.children, true).find((h) => h.object.visible !== false && !h.object.isPoints);
  return { hit: hit ? `${hit.object.type}:${hit.object.material?.color?.getHexString?.()}@${hit.distance.toFixed(2)}` : null, loadMs: S.loadMs, cam: camera.position.toArray().map((v) => +v.toFixed(2)), fov: +camera.fov.toFixed(1) };
};
window.snapshot = () => { composer.render(); return renderer.domElement.toDataURL("image/jpeg", 0.9); };
window.timeFrames = (n) => {
  const gl = renderer.getContext(), px = new Uint8Array(4);
  composer.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) { composer.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  return (performance.now() - t0) / n;
};
window.info = () => {
  renderer.info.autoReset = false; renderer.info.reset(); renderer.render(scene, camera);
  const r = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, programs: renderer.info.programs?.length, geos: renderer.info.memory.geometries, texs: renderer.info.memory.textures };
  renderer.info.autoReset = true; return r;
};
window.timeParts = (n = 5) => { // ms for the bare scene render vs the full chain
  const gl = renderer.getContext(), px = new Uint8Array(4), T = (f) => { f(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const t0 = performance.now(); for (let i = 0; i < n; i++) { f(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return Math.round((performance.now() - t0) / n); };
  return { scene: T(() => renderer.render(scene, camera)), full: T(() => composer.render()) };
};
window.ready = true;
