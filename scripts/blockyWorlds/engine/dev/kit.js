// KIT preview page: a plain ground + sky + sun/hemisphere and the locked look's post chain, showing the kit.
// ?scene=lineup|poses|faces|monsters|inserts|props|busy  &light=day|night  &t=<seconds>
import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { N8AOPass } from "n8ao";
import { makePerson, posePerson, setFace, personHeight, EXPRS } from "/page/kit/people.js";
import { makeMonster, animateMonster } from "/page/kit/monsters.js";
import { makeInsert, makeMarker, animateMarker } from "/page/kit/props.js";

const Q = new URLSearchParams(location.search);
const SCENE = Q.get("scene") ?? "lineup", NIGHT = Q.get("light") === "night", T = Number(Q.get("t") ?? 0.3);
const W = 1080, H = 1920;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = NIGHT ? 0.95 : 0.86;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 2000);

// ---------- ground, sky, light ----------
const tl = new THREE.TextureLoader();
function tex(name, kind, srgb, rep) { const t = tl.load(`/assets/${name}/${kind}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
const groundMat = new THREE.MeshStandardMaterial({ map: tex("concrete_pavement", "diff", true, 12), normalMap: tex("concrete_pavement", "nor", false, 12), roughnessMap: tex("concrete_pavement", "rough", false, 12), color: "#f2eee8" });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const grass = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: "#6f9a4e", roughness: 1 })); grass.rotation.x = -Math.PI / 2; grass.position.y = -0.01; scene.add(grass);

if (!NIGHT) {
  const sky = await new RGBELoader().loadAsync("/assets/ph/hdri/kloofendal_43d_clear_puresky.hdr"); sky.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = sky; scene.environmentIntensity = 0.55;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { zen: { value: new THREE.Color("#0b52d0") }, hor: { value: new THREE.Color("#4ea6f2") } },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 zen, hor; varying vec3 vP; void main(){ vec3 d = normalize(vP); float h = clamp(d.y, 0.0, 1.0); gl_FragColor = vec4(mix(hor, zen, pow(smoothstep(0.0, 0.55, h), 0.8)), 1.0); }",
  }));
  scene.add(dome);
  scene.fog = new THREE.Fog("#6aa6e0", 220, 3200);
  const sun = new THREE.DirectionalLight("#ffe2b0", 4.3); sun.position.set(30, 40, 34); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 160 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight("#cfe6ff", "#8a7a52", 0.45));
} else {
  const env = await new RGBELoader().loadAsync("/assets/ph/hdri/moonlit_golf.hdr"); env.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = env; scene.environmentIntensity = 0.35;
  const c = document.createElement("canvas"); c.width = 2; c.height = 512; const p = c.getContext("2d");
  const gr = p.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#040817"); gr.addColorStop(0.6, "#0e1d45"); gr.addColorStop(1, "#253a6e"); p.fillStyle = gr; p.fillRect(0, 0, 2, 512);
  const bg = new THREE.CanvasTexture(c); bg.colorSpace = THREE.SRGBColorSpace; scene.background = bg;
  scene.fog = new THREE.Fog("#16244c", 30, 260);
  const moon = new THREE.DirectionalLight("#9fb6ff", 0.7); moon.position.set(-30, 50, -20);
  moon.castShadow = true; moon.shadow.mapSize.set(4096, 4096); Object.assign(moon.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 160 }); scene.add(moon, moon.target);
  scene.add(new THREE.HemisphereLight("#33457a", "#0b0a14", 0.35));
  const lamp = new THREE.SpotLight("#ffc77a", 90, 22, 0.9, 0.6, 1.6); lamp.position.set(3.5, 6, 3); lamp.target.position.set(0, 0, 0); lamp.castShadow = true; scene.add(lamp, lamp.target);
}

// ---------- the kit ----------
const people = [], monsters = [], markers = [];
function addPerson(spec, x, z, ry, pose, expr, opts = {}) {
  const p = makePerson(spec); p.position.set(x, opts.y ?? 0, z); p.rotation.y = ry; scene.add(p);
  setFace(p, expr); people.push({ p, pose, opts }); return p;
}
const grid = (i) => [i < 3 ? -1.4 + (i % 3) * 1.15 : -0.85 + (i % 3) * 1.15, i < 3 ? -1.6 : 0];
const look = (pos, target) => { camera.position.set(...pos); camera.lookAt(...target); };

if (SCENE === "lineup") {
  const row = [
    [{ id: "a", role: "kid", seed: 3 }, "walk", "happy"],
    [{ id: "b", role: "adult", seed: 8 }, "run", "scared"],
    [{ id: "c", role: "elder", seed: 21 }, "stand", "neutral"],
    [{ id: "d", role: "kid", seed: 14 }, "wave", "excited"],
    [{ id: "e", role: "adult", seed: 5 }, "talk", "smirk"],
    [{ id: "f", role: "adult", seed: 30 }, "cheer", "excited"],
  ];
  row.forEach(([s, pose, ex], i) => addPerson(s, ...grid(i), [1.25, -1.2, 0.1, 0.2, -0.3, 0][i], pose, ex));
  look([0, 1.35, 7.6], [0, 0.85, -0.8]); camera.fov = 44;
} else if (SCENE === "poses") {
  const row = [
    [{ id: "a", role: "adult", seed: 41 }, "scared", "scared"],
    [{ id: "b", role: "kid", seed: 9 }, "sit", "sad"],
    [{ id: "c", role: "adult", seed: 12 }, "point", "angry"],
    [{ id: "d", role: "kid", seed: 55 }, "look_up", "surprised"],
    [{ id: "e", role: "elder", seed: 7 }, "sit", "happy"],
    [{ id: "f", role: "adult", seed: 64 }, "carry", "neutral", { hold: "box" }],
  ];
  const bench = new THREE.MeshStandardMaterial({ color: "#8a5a34", roughness: 0.7 });
  row.forEach(([s, pose, ex, o], i) => {
    const [x, z] = grid(i);
    if (pose === "sit") { const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.5), bench); b.position.set(x, 0.225, z - 0.25); b.castShadow = b.receiveShadow = true; scene.add(b); }
    addPerson(s, x, z, 0.0, pose, ex, o);
  });
  const sleeper = addPerson({ id: "g", role: "adult", seed: 77 }, -0.6, 1.5, Math.PI / 2 + 0.2, "sleep", "sleepy");
  void sleeper;
  look([0, 1.7, 7.8], [0, 0.7, -0.4]); camera.fov = 44;
} else if (SCENE === "faces") {
  const seeds = [3, 8, 21, 14, 5, 30, 41, 9, 12, 55, 7];
  EXPRS.forEach((ex, i) => {
    const col = i % 3, rowi = Math.floor(i / 3);
    const p = addPerson({ id: ex, role: i % 4 === 0 ? "kid" : i === 6 ? "elder" : "adult", seed: seeds[i] }, (col - 1) * 0.43, rowi * 0.12, 0, "stand", ex, { y: 0 });
    p.position.y = 3.0 - rowi * 0.5 - personHeight(p); // head tops line up per row; lower rows stand in front
    const j = p.userData.joints; // heads only
    for (const o of [...j.pelvis.children, ...j.spine.children]) if (o.isMesh) o.visible = false;
    for (const o of [...j.sh, ...j.hip]) o.visible = false;
  });
  ground.visible = grass.visible = false;
  look([0, 2.12, 4.6], [0, 2.12, 0]); camera.fov = 34;
} else if (SCENE === "monsters") {
  const tall = makeMonster({ type: "tall", name: "The Listener", glow: "#9be8ff" }); tall.position.set(-1.3, 0, -1.6); tall.rotation.y = 0.25; scene.add(tall);
  const fur = makeMonster({ type: "furry", name: "Mossback", glow: "#ffb03b" }); fur.position.set(1.4, 0, -0.6); fur.rotation.y = -0.35; scene.add(fur);
  monsters.push([tall, Q.get("ms") ?? "lurk"], [fur, Q.get("ms2") ?? "reveal"]);
  addPerson({ id: "k", role: "kid", seed: 3 }, 0.2, 1.6, Math.PI - 0.2, "scared", "scared");
  look([0.3, 1.5, 8.2], [0, 2.1, 0]); camera.fov = 48;
} else if (SCENE === "inserts") {
  const sign = makeInsert({ kind: "sign", text: Q.get("text") ?? "NO TALKING ABOVE A WHISPER" }); sign.position.set(-0.75, 0, -1); sign.rotation.y = 0.15; scene.add(sign);
  const note = makeInsert({ kind: "note", text: Q.get("note") ?? "Don't open the door after dark. It knows your name." }); note.position.set(0.8, 0, -1.2); note.rotation.y = -0.15; scene.add(note);
  const ppl = [[{ id: "a", role: "kid", seed: 3 }, "tag", "1¢"], [{ id: "b", role: "adult", seed: 8 }, "ring", ""], [{ id: "c", role: "adult", seed: 21 }, "icon", "?"]];
  ppl.forEach(([s, kind, text], i) => {
    const p = addPerson(s, -1.1 + i * 1.1, 1.3, 0, "stand", i === 1 ? "happy" : "surprised");
    const m = makeMarker({ kind, text }); m.position.set(p.position.x, personHeight(p) + 0.15, p.position.z); scene.add(m); markers.push(m);
  });
  look([0, 1.5, 7.0], [0, 1.3, 0]); camera.fov = 44;
} else if (SCENE === "props") {
  const row = [
    [{ id: "a", role: "kid", seed: 3 }, "carry", "happy", { hold: "sock" }],
    [{ id: "b", role: "adult", seed: 8 }, "point", "scared", { hold: "flashlight" }],
    [{ id: "c", role: "adult", seed: 21 }, "carry", "neutral", { hold: "box" }],
    [{ id: "d", role: "kid", seed: 14 }, "point", "angry", {}],
    [{ id: "e", role: "elder", seed: 5 }, "stand", "sad", { hold: "lantern" }],
    [{ id: "f", role: "adult", seed: 30 }, "carry", "excited", { hold: "book" }],
  ];
  row.forEach(([s, pose, ex, o], i) => addPerson(s, ...grid(i), i === 1 || i === 3 ? 0.9 : 0.15, pose, ex, o));
  look([0, 1.35, 7.4], [0, 0.85, -0.8]); camera.fov = 44;
} else if (SCENE === "one") { // ?scene=one&pose=..&role=..&seed=..&expr=..&hold=..&ry=..
  const p = addPerson({ id: "one", role: Q.get("role") ?? "adult", seed: Number(Q.get("seed") ?? 1) }, 0, 0, Number(Q.get("ry") ?? 0), Q.get("pose") ?? "stand", Q.get("expr") ?? "happy", { hold: Q.get("hold") });
  const h = personHeight(p);
  if (Q.get("pose") === "sleep") { const c = new THREE.Vector3(0, 0.2, -h * 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation.y); look([c.x, 1.6, c.z + 2.4], [c.x, 0.2, c.z]); }
  else look([0, h * 0.6, h * 1.9], [0, h * 0.5, 0]);
  camera.fov = 40;
} else if (SCENE === "busy") {
  const poses = ["walk", "talk", "stand", "point", "cheer", "scared"];
  for (let i = 0; i < 6; i++) addPerson({ id: `p${i}`, role: i % 3 === 0 ? "kid" : "adult", seed: 100 + i * 7 }, -2.2 + (i % 3) * 2.2, i < 3 ? 0 : -2, 0.3 * (i - 3), poses[i], EXPRS[i]);
  const m = makeMonster({ type: Q.get("mt") ?? "tall", glow: "#9be8ff" }); m.position.set(0, 0, -6); scene.add(m); monsters.push([m, "lurk"]);
  look([0, 1.6, 7], [0, 1.4, -2]); camera.fov = 55;
}
camera.updateProjectionMatrix();

function setTime(t) {
  for (const { p, pose, opts } of people) posePerson(p, pose, t, opts);
  for (const [m, st] of monsters) animateMonster(m, st, t);
  for (const m of markers) { m.quaternion.copy(camera.quaternion); animateMarker(m, t); }
}
setTime(T);

// ---------- post: the locked look's chain ----------
const composer = new EffectComposer(renderer); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const ao = new N8AOPass(scene, camera, W, H); ao.configuration.aoRadius = 1.2; ao.configuration.intensity = NIGHT ? 1.2 : 2.0; ao.configuration.distanceFalloff = 1; ao.configuration.halfRes = false; composer.addPass(ao);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), NIGHT ? 0.5 : 0.22, 0.45, NIGHT ? 0.85 : 1.6));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null }, sat: { value: NIGHT ? 1.15 : 1.58 }, con: { value: NIGHT ? 1.08 : 1.24 }, warm: { value: NIGHT ? -0.02 : 0.035 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; uniform float sat, con, warm; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb; float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(vec3(l), col, sat); col = (col - 0.5) * con + 0.5; col *= vec3(1.0 + warm, 1.0 + warm * 0.3, 1.0 - warm); gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a); }",
}));

window.snapshot = (t) => { if (Number.isFinite(t)) setTime(t); composer.render(); return renderer.domElement.toDataURL("image/jpeg", 0.92); };
/** GPU+CPU time per frame (posing included), averaged over n frames; readPixels forces the GPU to finish */
window.timeFrames = (n) => {
  const gl = renderer.getContext(), px = new Uint8Array(4);
  setTime(0); composer.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) { setTime(i / 24); composer.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
  const total = (performance.now() - t0) / n;
  const p0 = performance.now(); for (let i = 0; i < 200; i++) setTime(i / 24); const pose = (performance.now() - p0) / 200;
  renderer.render(scene, camera); return { frameMs: total, poseMs: pose, tris: renderer.info.render.triangles, calls: renderer.info.render.calls };
};
await new Promise((r) => setTimeout(r, 1200));
for (let i = 0; i < 2; i++) composer.render();
window.ready = true;
