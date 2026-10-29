// Zyvo Studio, M1: three looks of the cast and set (?look=A|B|C). $0, all built in code; the screens show REAL
// Zyvo outputs from the Content Machine asset library (served at /pics/, manifest.json).
//   A  Night studio  near-black stage, a lime grid floor, violet and lime bokeh, a giant phone playing a real output
//   B  Violet stage  a round glossy stage with a lime ring light, a curved wall of real outputs, a hero camera
//   C  Clay studio   a soft charcoal cyclorama, a spotlight pool, matte clay finish, a desk with a laptop
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { N8AOPass } from "n8ao";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";
import { ZYVO, makeCreator, makeZee, radial, zShape as zShapeFor } from "./cast.js";

const Q = new URLSearchParams(location.search);
const LOOK = Q.get("look") ?? "A";
const W = 1080, H = 1920;
const C = (h) => new THREE.Color(h);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = LOOK === "C" ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = LOOK === "C" ? 1.0 : 1.05;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const manager = new THREE.LoadingManager();
const tl = new THREE.TextureLoader(manager);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const rbox = (w, h, d, r = 0.05, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

// soft image-based light (CC0 HDRI from the Cutaway kit), low so the coloured lights lead
const pmrem = new THREE.PMREMGenerator(renderer);
new RGBELoader(manager).load("/assets/hdri/sky.hdr", (hdr) => { hdr.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pmrem.fromEquirectangular(hdr).texture; scene.environmentIntensity = LOOK === "C" ? 0.45 : 0.28; });

/* ─── real Zyvo outputs: a cover-fit texture for any screen ─── */
const manifest = await (await fetch("/pics/manifest.json")).json();
// Outputs only (never the UI crops or "other" pictures): the n-th of a tool's, cycling.
const OUTPUT_TOOLS = new Set(["ai_fruit_story", "blocky_stories", "clay_rescue", "long_form", "image_generator", "micro_camera", "two_am_worlds", "cooking", "cartoon_drive_by"]);
const pick = (tool, n = 0) => { const l = manifest.filter((m) => m.tool === tool); return l.length ? l[n % l.length].file : null; };
function screenTex(file, aspect) {
  const t = tl.load(`/pics/${file}`, (tx) => {
    const ia = tx.image.width / tx.image.height;
    if (ia > aspect) { tx.repeat.set(aspect / ia, 1); tx.offset.set((1 - aspect / ia) / 2, 0); } else { tx.repeat.set(1, ia / aspect); tx.offset.set(0, (1 - ia / aspect) / 2); }
  });
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// A screen shows the output as it is (no tone mapping), slightly lifted so it reads as light.
// (0.86: just under the bloom threshold, so a white output doesn't flare)
const screenMat = (file, aspect) => new THREE.MeshBasicMaterial({ map: screenTex(file, aspect), color: C("#ffffff").multiplyScalar(0.86), toneMapped: false });

/** The giant phone: a dark rounded body, a real output on the screen, a tool pill. */
function phone(parent, file, x, y, z, h = 4.6, label = null) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const w = h * 0.5;
  add(g, rbox(w + 0.22, h + 0.22, 0.2, 0.28, 6), new THREE.MeshPhysicalMaterial({ color: C("#121318"), roughness: 0.25, metalness: 0.6, clearcoat: 1 }));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat(file, w / h)); scr.position.z = 0.105; g.add(scr);
  if (label) { const p = pillPlane(label, 1.5); p.position.set(0, h / 2 - 0.35, 0.12); g.add(p); }
  return g;
}
/** A flat UI pill (canvas): "▶ Blocky Stories". Real tool names only. */
function pillPlane(text, width = 1.6, bg = "rgba(9,10,10,0.82)", fg = "#ffffff", accent = ZYVO.lime) {
  const c = document.createElement("canvas"); c.width = 640; c.height = 140; const x = c.getContext("2d");
  x.fillStyle = bg; x.beginPath(); x.roundRect(4, 4, 632, 132, 66); x.fill();
  x.font = "700 64px Segoe UI, Inter, Arial"; x.textBaseline = "middle"; x.fillStyle = accent; x.fillText("▶", 52, 72); x.fillStyle = fg; x.fillText(text, 130, 72);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, width * 140 / 640), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
}
/** A floating step card (a prop; in the videos the step chips are overlays). */
function stepCard(step, text, width = 2.2) {
  const c = document.createElement("canvas"); c.width = 900; c.height = 260; const x = c.getContext("2d");
  x.fillStyle = "rgba(14,16,18,0.88)"; x.beginPath(); x.roundRect(4, 4, 892, 252, 40); x.fill();
  x.strokeStyle = "rgba(190,242,100,0.55)"; x.lineWidth = 4; x.stroke();
  x.font = "800 58px Segoe UI, Inter, Arial"; x.textBaseline = "middle"; x.fillStyle = "#ffffff"; x.fillText(`STEP ${step} ·`, 56, 100);
  x.fillStyle = ZYVO.lime; x.fillText(text, 56 + x.measureText(`STEP ${step} · `).width, 100);
  for (let i = 0; i < 5; i++) { x.fillStyle = i < step ? ZYVO.lime : "rgba(255,255,255,0.18)"; x.beginPath(); x.roundRect(56 + i * 92, 178, 72, 14, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, width * 260 / 900), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
}
/** Bokeh: soft additive dots far behind the stage. */
function bokeh(n, colors, zr = [-22, -40], spread = 22, size = [0.4, 2.2]) {
  const tex = radial("#ffffff", 6);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: C(colors[i % colors.length]), transparent: true, opacity: 0.25 + rnd() * 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    const z = zr[0] + rnd() * (zr[1] - zr[0]); s.position.set((rnd() - 0.5) * spread, 1 + rnd() * 16, z); s.scale.setScalar(size[0] + rnd() * (size[1] - size[0])); scene.add(s);
  }
}
/** A dark floor with an anti-aliased lime grid that fades with distance. */
function gridFloor(color = "#0b0d0f", line = ZYVO.lime, cell = 1.0, strength = 0.9) {
  const m = new THREE.MeshPhysicalMaterial({ color: C(color), roughness: 0.32, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.lineCol = { value: C(line) }; sh.uniforms.cell = { value: cell }; sh.uniforms.k = { value: strength };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vW;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vW; uniform vec3 lineCol; uniform float cell; uniform float k;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        vec2 gc = vW.xz / cell; vec2 gd = abs(fract(gc - 0.5) - 0.5) / fwidth(gc);
        float ln = 1.0 - min(min(gd.x, gd.y), 1.0);
        float fade = smoothstep(26.0, 3.0, length(vW.xz - vec2(0.0, -2.0)));
        totalEmissiveRadiance += lineCol * ln * fade * k;`);
  };
  const f = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), m); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; scene.add(f); return f;
}
function lights({ key = ["#ffffff", 2.4, [4, 9, 7]], rims = [], fill = 0.25 }) {
  scene.add(new THREE.HemisphereLight("#cfd6ff", "#1a1420", fill));
  const k = new THREE.DirectionalLight(key[0], key[1]); k.position.set(...key[2]); k.castShadow = true; k.shadow.mapSize.set(4096, 4096);
  Object.assign(k.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 }); k.shadow.bias = -0.0003; k.shadow.normalBias = 0.02; k.shadow.radius = 3; scene.add(k);
  for (const [col, i, p] of rims) { const r = new THREE.DirectionalLight(col, i); r.position.set(...p); scene.add(r); }
}

/* ─── the cast ─── */
const finish = LOOK === "C" ? "clay" : "gloss";
const creator = makeCreator({ finish }), zee = makeZee({ finish });
scene.add(creator.group, zee.group);

/* ─── the three looks ─── */
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 400);
let bloom = 0.35, sat = 1.06, con = 1.06, vig = 0.6;

if (LOOK === "A") {
  scene.background = C("#07080a"); scene.fog = new THREE.Fog(C("#07080a"), 18, 60);
  gridFloor("#0b0d0f", ZYVO.lime, 1.0, 0.75);
  bokeh(150, ["#9F5CFF", "#7C4DFF", "#BEF264", "#ffffff", "#9F5CFF"]);
  lights({ key: ["#fff6ee", 2.7, [3.5, 8, 9]], rims: [[ZYVO.violet2, 1.5, [-6, 4, -5]], [ZYVO.lime, 0.9, [6, 3, -4]]] });
  phone(scene, pick("ai_fruit_story", 1), 0.1, 3.55, -3.6, 5.2, "AI Fruit Story");
  const card = stepCard(2, "SETTINGS", 2.4); card.position.set(-1.05, 6.55, -2.2); card.rotation.y = 0.12; scene.add(card);
  creator.group.position.set(-1.0, 0, 0.6); creator.group.rotation.y = 0.3; creator.expr("shocked").pose("shrug", 0.55);
  zee.group.position.set(1.08, 0, 0.3); zee.group.rotation.y = -0.35; zee.expr("happy").pose("point").mouth(0.35);
  zee.parts.arms[1].pivot.rotation.set(-0.5, 0, -1.9);   // pointing up at the phone
  camera.position.set(0, 2.9, 15.5); camera.lookAt(0, 3.05, -1);
} else if (LOOK === "B") {
  { const c = document.createElement("canvas"); c.width = 4; c.height = 512; const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#2a1260"); g.addColorStop(0.55, "#120a2a"); g.addColorStop(1, "#090A0A"); x.fillStyle = g; x.fillRect(0, 0, 4, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t; }
  // round glossy stage with a lime ring light
  add(scene, new THREE.CylinderGeometry(3.4, 3.5, 0.32, 96), new THREE.MeshPhysicalMaterial({ color: C("#16102b"), roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }), 0, 0.16, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.42, 0.04, 12, 160), new THREE.MeshBasicMaterial({ color: C(ZYVO.lime).multiplyScalar(2.4), toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; scene.add(ring);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: C("#0c0818"), roughness: 0.6 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  bokeh(90, ["#9F5CFF", "#BEF264", "#c9b5ff"], [-26, -44], 26, [0.6, 2.6]);
  // a curved wall of real outputs, three rows, mixed tools
  const tools = [...OUTPUT_TOOLS].filter((t) => pick(t));
  const files = []; for (let n = 0; files.length < 27; n++) files.push(pick(tools[n % tools.length], Math.floor(n / tools.length)));
  const tw = 1.15, th = tw * 16 / 9, R = 9.5, cols = 9;
  files.slice(0, 27).forEach((f, i) => {
    const col = i % cols, row = Math.floor(i / cols), a = (col - (cols - 1) / 2) * 0.135;
    const tile = new THREE.Group(); tile.position.set(Math.sin(a) * R, 1.6 + row * (th + 0.18), -Math.cos(a) * R + 2.2); tile.rotation.y = -a; scene.add(tile);
    add(tile, rbox(tw + 0.08, th + 0.08, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: C("#0d0b16"), roughness: 0.4 }));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), screenMat(f, tw / th)); p.position.z = 0.045; tile.add(p);
  });
  lights({ key: ["#fff1f8", 2.5, [-3, 9, 9]], rims: [[ZYVO.violet2, 2.0, [5, 5, -6]], [ZYVO.lime, 0.8, [-6, 2, -3]]], fill: 0.35 });
  creator.group.position.set(-1.0, 0.32, 0.9); creator.group.rotation.y = 0.25; creator.expr("happy").pose("wave").mouth(0.5);
  zee.group.position.set(1.05, 0.32, 0.5); zee.group.rotation.y = -0.2; zee.expr("smug").pose("rest");
  zee.parts.arms[1].pivot.rotation.set(0.6, 0, -1.6);   // pointing back at the wall
  camera.position.set(0, 1.9, 15.5); camera.lookAt(0, 3.1, -1.0); camera.fov = 32; camera.updateProjectionMatrix();
  bloom = 0.45; sat = 1.08;
} else if (LOOK === "C") {
  // a soft charcoal cyclorama: one seamless sheet, floor curving up into the wall
  const cycGeo = (width = 40, floorLen = 22, r = 5, wallH = 26, segs = 140) => {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const s = (i / segs) * (floorLen + (Math.PI / 2) * r + wallH);
      if (s < floorLen) pts.push([floorLen - s - 6, 0]);
      else if (s < floorLen + (Math.PI / 2) * r) { const a = (s - floorLen) / r; pts.push([-6 - Math.sin(a) * r, r - Math.cos(a) * r]); }
      else pts.push([-6 - r, r + (s - floorLen - (Math.PI / 2) * r)]);
    }
    const g = new THREE.PlaneGeometry(width, 1, 1, segs), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const row = Math.round((0.5 - p.getY(k)) * segs); const [z, y] = pts[Math.min(segs, Math.max(0, row))]; p.setXYZ(k, p.getX(k), y, z); }
    g.computeVertexNormals(); return g;
  };
  const cyc = new THREE.Mesh(cycGeo(), new THREE.MeshStandardMaterial({ color: C("#2b2d33"), roughness: 0.95, side: THREE.DoubleSide })); cyc.receiveShadow = true; scene.add(cyc);
  scene.background = C("#1d1e22");
  // a big violet neon Z on the wall (the brand, not a claim)
  const zn = new THREE.Mesh(new THREE.ExtrudeGeometry(zShapeFor(2.6, 0.2), { depth: 0.08, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: C(ZYVO.violet2).multiplyScalar(1.5), toneMapped: false }));
  zn.geometry.center(); zn.position.set(0.2, 6.3, -10.9); scene.add(zn);
  const znGlow = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: radial("#7C4DFF"), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); znGlow.position.set(0.2, 6.3, -10.95); scene.add(znGlow);
  scene.add(new THREE.HemisphereLight("#fff4e8", "#2a2420", 0.35));
  const spot = new THREE.SpotLight("#ffe9d2", 160, 30, 0.42, 0.7, 1.6); spot.position.set(2, 11, 6); spot.target.position.set(0, 0, 0); spot.castShadow = true; spot.shadow.mapSize.set(4096, 4096); spot.shadow.radius = 6; scene.add(spot, spot.target);
  const rim = new THREE.DirectionalLight(ZYVO.violet2, 1.8); rim.position.set(-5, 4, -6); scene.add(rim);
  const rim2 = new THREE.DirectionalLight("#ffffff", 0.6); rim2.position.set(5, 3, -5); scene.add(rim2);
  // the creator behind a small desk; the laptop's lid faces us with the Zyvo Z on it (a brand prop, no claim)
  const desk = new THREE.Group(); desk.position.set(-1.0, 0, 1.25); desk.rotation.y = 0.22; scene.add(desk);
  const wood = new THREE.MeshStandardMaterial({ color: C("#d9c6a8"), roughness: 0.85 });
  add(desk, rbox(1.7, 0.09, 0.8, 0.04), wood, 0, 1.0, 0); for (const [x, z] of [[-0.75, -0.32], [0.75, -0.32], [-0.75, 0.32], [0.75, 0.32]]) add(desk, rbox(0.08, 1.0, 0.08, 0.03), wood, x, 0.5, z);
  const alu = new THREE.MeshStandardMaterial({ color: C("#c3c6cd"), roughness: 0.45, metalness: 0.5 });
  const lap = new THREE.Group(); lap.position.set(0, 1.05, 0.0); desk.add(lap);
  add(lap, rbox(0.92, 0.035, 0.6, 0.015), alu, 0, 0.018, -0.05);
  const lid = new THREE.Group(); lid.position.set(0, 0.035, 0.25); lid.rotation.x = 0.28; lap.add(lid);
  add(lid, rbox(0.92, 0.6, 0.03, 0.02), alu, 0, 0.3, 0);
  const zl = new THREE.Mesh(new THREE.ExtrudeGeometry(zShapeFor(0.22), { depth: 0.01, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: C(ZYVO.violet2).multiplyScalar(1.4), toneMapped: false })); zl.geometry.center(); zl.position.set(0, 0.3, 0.02); lid.add(zl);
  creator.group.position.set(-1.05, 0, 0.6); creator.group.rotation.y = 0.22; creator.expr("thinking").pose("type", 0.75);
  // Zee raises a card with a real Clay Rescue output beside its head
  zee.group.position.set(1.15, 0, 0.7); zee.group.rotation.y = -0.3; zee.expr("happy").pose("rest").mouth(0.4);
  zee.parts.arms[1].pivot.rotation.set(0, 0, -2.5);
  const card = new THREE.Group(); card.position.set(-1.12, 2.35, 0.1); card.rotation.z = 0.08; zee.parts.body.add(card);
  add(card, rbox(0.86, 1.36, 0.04, 0.05), new THREE.MeshStandardMaterial({ color: C("#f4f1ea"), roughness: 0.9 }));
  const cp = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 1.26), screenMat(pick("clay_rescue", 1), 0.76 / 1.26)); cp.position.z = 0.025; card.add(cp);
  camera.position.set(0.1, 2.9, 14.5); camera.lookAt(0, 2.9, 0); camera.fov = 30; camera.updateProjectionMatrix();
  bloom = 0.3; sat = 1.0; con = 1.04; vig = 0.5;
} else {
  // E: the expression sheet. Both characters close up on a plain dark backdrop; renderAt(t) shows expression floor(t).
  scene.background = C("#101114");
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: C("#16171b"), roughness: 0.9 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; scene.add(fl);
  lights({ key: ["#fff6ee", 2.6, [3, 7, 9]], rims: [[ZYVO.violet2, 1.2, [-6, 4, -5]]], fill: 0.4 });
  creator.group.position.set(-0.62, -0.95, 0); zee.group.position.set(0.68, -0.35, 0); creator.group.rotation.y = 0.15; zee.group.rotation.y = -0.15;
  camera.position.set(0, 1.25, 7.2); camera.lookAt(0, 1.15, 0); camera.fov = 22; camera.updateProjectionMatrix();
  bloom = 0.2;
}
const SHEET = ["neutral", "happy", "sad", "shocked", "smug", "thinking"];
const SHEET_POSE = { happy: "wave", shocked: "shrug", thinking: "rest", smug: "rest", sad: "rest", neutral: "rest" };

/* ─── post: AO, bloom, grade, vignette (as the Cutaway R1 chain) ─── */
const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
const composer = new EffectComposer(renderer, rt);
const ao = new N8AOPass(scene, camera, W, H);
Object.assign(ao.configuration, { aoRadius: 0.8, distanceFalloff: 1.0, intensity: LOOK === "C" ? 3.2 : 2.4, aoSamples: 16, denoiseSamples: 8, denoiseRadius: 12, halfRes: false, gammaCorrection: false });
composer.addPass(ao);
if (bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), bloom, 0.55, 0.92));
composer.addPass(new OutputPass());
composer.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null }, sat: { value: sat }, con: { value: con } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: "uniform sampler2D tDiffuse; uniform float sat; uniform float con; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = mix(vec3(l), c.rgb, sat); c.rgb = (c.rgb - 0.5) * con + 0.5; gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a); }" }));
{ const v = new ShaderPass(VignetteShader); v.uniforms.offset.value = 0.95; v.uniforms.darkness.value = vig; composer.addPass(v); }
window.renderAt = (t = 0) => {
  if (LOOK === "E") { const e = SHEET[Math.floor(t) % SHEET.length]; for (const c of [creator, zee]) c.expr(e).pose(SHEET_POSE[e], 0.6).mouth(e === "happy" ? 0.5 : e === "shocked" ? 1 : 0); }
  creator.idle(t); zee.idle(t, 0.7); const t0 = performance.now(); composer.render(); window.lastMs = performance.now() - t0; return true; };
manager.onLoad = () => { window.ready = true; };
