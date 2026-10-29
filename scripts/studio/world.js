// Zyvo Studio world: the main stage (look A: night studio, lime grid floor, bokeh), the giant phone, the wall of
// real outputs (look B's wall, built into the same stage), the post chain. Shared by the previews and videos.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { N8AOPass } from "n8ao";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";
import { ZYVO, radial } from "./cast.js";

export const W = 1080, H = 1920;
const C = (h) => new THREE.Color(h);
export const rbox = (w, h, d, r = 0.05, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
export const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export function setup() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false); renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const manager = new THREE.LoadingManager();
  const pmrem = new THREE.PMREMGenerator(renderer);
  new RGBELoader(manager).load("/assets/hdri/sky.hdr", (hdr) => { hdr.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pmrem.fromEquirectangular(hdr).texture; scene.environmentIntensity = 0.28; });
  return { renderer, scene, manager, tl: new THREE.TextureLoader(manager) };
}

/** Cover-fit a texture (image or video) onto a w/h frame once its size is known. */
export function coverFit(tx, aspect, iw, ih) {
  const ia = iw / ih;
  if (ia > aspect) { tx.repeat.set(aspect / ia, 1); tx.offset.set((1 - aspect / ia) / 2, 0); } else { tx.repeat.set(1, ia / aspect); tx.offset.set(0, (1 - ia / aspect) / 2); }
}
// A screen shows a real output as it is (no tone mapping), just under the bloom threshold.
export function imageScreen(tl, file, aspect) {
  const t = tl.load(`/pics/${file}`, (tx) => coverFit(tx, aspect, tx.image.width, tx.image.height));
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.MeshBasicMaterial({ map: t, color: C("#ffffff").multiplyScalar(0.86), toneMapped: false, transparent: true });
}

/** The main stage (look A): near-black, a lime grid floor, violet + lime bokeh, a key light and two rims. */
export function mainStage(scene) {
  scene.background = C("#07080a"); scene.fog = new THREE.Fog(C("#07080a"), 22, 70);
  // rough and barely reflective: at a low camera the sky light would otherwise wash the floor grey
  const m = new THREE.MeshStandardMaterial({ color: C("#08090b"), roughness: 0.78, metalness: 0, envMapIntensity: 0.06 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.lineCol = { value: C(ZYVO.lime) };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vW;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vW; uniform vec3 lineCol;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        vec2 gc = vW.xz; vec2 gd = abs(fract(gc - 0.5) - 0.5) / fwidth(gc);
        float ln = 1.0 - min(min(gd.x, gd.y), 1.0);
        float fade = smoothstep(26.0, 3.0, length(vW.xz - vec2(0.0, -2.0)));
        totalEmissiveRadiance += lineCol * ln * fade * 0.75;`);
  };
  const f = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), m); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; scene.add(f);
  const tex = radial("#ffffff", 6), cols = ["#9F5CFF", "#7C4DFF", "#BEF264", "#ffffff", "#9F5CFF"];
  for (let i = 0; i < 160; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: C(cols[i % cols.length]), transparent: true, opacity: 0.25 + rnd() * 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set((rnd() - 0.5) * 30, 1 + rnd() * 18, -24 - rnd() * 22); s.scale.setScalar(0.4 + rnd() * 1.9); scene.add(s);
  }
  scene.add(new THREE.HemisphereLight("#cfd6ff", "#1a1420", 0.25));
  const key = new THREE.DirectionalLight("#fff6ee", 2.7); key.position.set(3.5, 8, 9); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02; key.shadow.radius = 3; scene.add(key);
  for (const [col, i, p] of [[ZYVO.violet2, 1.5, [-6, 4, -5]], [ZYVO.lime, 0.9, [6, 3, -4]], ["#ffffff", 0.8, [0, 5, -8]]]) { const r = new THREE.DirectionalLight(col, i); r.position.set(...p); scene.add(r); }
}

/** The giant phone: a dark rounded body; the screen material is returned so a video or image can go on it. */
// raised so the cast stands BELOW it in the phone shot (the camera can push in without anyone in the way)
export function giantPhone(scene, { x = 0.1, y = 4.9, z = -3.6, h = 5.2 } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  const w = h * 0.5;
  add(g, rbox(w + 0.22, h + 0.22, 0.2, 0.28, 6), new THREE.MeshPhysicalMaterial({ color: C("#121318"), roughness: 0.25, metalness: 0.6, clearcoat: 1 }));
  const mat = new THREE.MeshBasicMaterial({ color: C("#16181d"), toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); screen.position.z = 0.105; g.add(screen);
  return { group: g, screen, mat, w, h };
}

/** Look B's wall of real outputs, as an arc behind the stage. Tiles start hidden (scale 0) for the reveal.
 *  items: [{ file, loop? }]. A tile with `loop` plays a muted 2 s loop of a real output VIDEO (a 6x4 sheet of
 *  24 frames at 12 fps, cut from the video); every other tile gets a slow Ken Burns push, never a frozen frame. */
export function outputWall(scene, tl, items, { R = 10.5, cols = 9, rows = 3, cz = -1.2, y0 = 2.3, tw = 1.25 } = {}) {
  const th = tw * 16 / 9, tiles = [];
  items.slice(0, cols * rows).forEach((it, i) => {
    const col = i % cols, row = Math.floor(i / cols), a = (col - (cols - 1) / 2) * 0.128;
    const tile = new THREE.Group(); tile.position.set(Math.sin(a) * R, y0 + th / 2 + row * (th + 0.2), -Math.cos(a) * R + cz); tile.rotation.y = -a; scene.add(tile);
    add(tile, rbox(tw + 0.08, th + 0.08, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: C("#0d0b16"), roughness: 0.4 }));
    let mat, update;
    const phase = (i * 0.37) % 1;
    if (it.loop) {
      const t = tl.load(`/pics/${it.loop}`); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / 6, 1 / 4);
      mat = new THREE.MeshBasicMaterial({ map: t, color: C("#ffffff").multiplyScalar(0.86), toneMapped: false });
      update = (s) => { const f = Math.floor((s + phase * 2) * 12) % 24; t.offset.set((f % 6) / 6, 1 - (Math.floor(f / 6) + 1) / 4); };
    } else {
      mat = imageScreen(tl, it.file, tw / th);
      const base = { r: null, o: null };
      update = (s) => {
        const m = mat.map; if (!m.image) return;
        if (!base.r) { base.r = m.repeat.clone(); base.o = m.offset.clone(); }
        const z = 1.06 + 0.05 * Math.sin(s * 0.35 + phase * 6.28), dx = Math.sin(s * 0.21 + phase * 9) * 0.02;
        m.repeat.set(base.r.x / z, base.r.y / z);
        m.offset.set(base.o.x + (base.r.x - m.repeat.x) / 2 + dx * base.r.x, base.o.y + (base.r.y - m.repeat.y) / 2);
      };
    }
    const p = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), mat); p.position.z = 0.045; tile.add(p);
    tile.userData = { col, row, dist: Math.hypot(col - (cols - 1) / 2, (row - 1) * 1.4), update };
    tile.scale.setScalar(0.0001); tiles.push(tile);
  });
  return tiles;
}

export function composer(renderer, scene, camera, { bloom = 0.35, sat = 1.06, con = 1.06, vig = 0.6 } = {}) {
  const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4, type: THREE.HalfFloatType });
  const c = new EffectComposer(renderer, rt);
  const ao = new N8AOPass(scene, camera, W, H);
  Object.assign(ao.configuration, { aoRadius: 0.8, distanceFalloff: 1.0, intensity: 2.4, aoSamples: 16, denoiseSamples: 8, denoiseRadius: 12, halfRes: false, gammaCorrection: false });
  c.addPass(ao);
  if (bloom) c.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), bloom, 0.55, 0.92));
  c.addPass(new OutputPass());
  c.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null }, sat: { value: sat }, con: { value: con } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform sampler2D tDiffuse; uniform float sat; uniform float con; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = mix(vec3(l), c.rgb, sat); c.rgb = (c.rgb - 0.5) * con + 0.5; gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a); }" }));
  const v = new ShaderPass(VignetteShader); v.uniforms.offset.value = 0.95; v.uniforms.darkness.value = vig; c.addPass(v);
  return c;
}

/* ─── TikTok safe zones for the 3D frame (owner, 2026-10-30): faces and key props stay out of the top bar,
   the right icon column and the bottom caption/description area. Same numbers as the slide export zone. ─── */
export const SAFE = { top: 320, bottom: 420, left: 110, right: 170 };
const box3 = new THREE.Box3(), v3 = new THREE.Vector3();
/** Screen-space box of an object (px), or null when it isn't on screen. */
export function screenBox(obj, camera) {
  box3.setFromObject(obj, true); if (box3.isEmpty()) return null;   // precise: from the vertices, not loose child boxes
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, behind = 0;
  for (const cx of [box3.min.x, box3.max.x]) for (const cy of [box3.min.y, box3.max.y]) for (const cz of [box3.min.z, box3.max.z]) {
    v3.set(cx, cy, cz).project(camera); if (v3.z > 1) behind++;
    const px = (v3.x + 1) / 2 * W, py = (1 - v3.y) / 2 * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  if (behind === 8 || x1 < 0 || x0 > W || y1 < 0 || y0 > H) return null;
  return { x0, y0, x1, y1 };
}
/** Which safe-zone edges a box crosses (a box mostly off screen is a deliberate crop, not a problem). */
export function zoneProblems(b) {
  if (!b) return [];
  const vis = (Math.min(b.x1, W) - Math.max(b.x0, 0)) * (Math.min(b.y1, H) - Math.max(b.y0, 0)) / ((b.x1 - b.x0) * (b.y1 - b.y0) || 1);
  if (vis < 0.6) return [];
  const out = [];
  if (b.y0 < SAFE.top) out.push("top bar");
  if (b.x1 > W - SAFE.right) out.push("right icons");
  if (b.y1 > H - SAFE.bottom) out.push("bottom captions");
  if (b.x0 < SAFE.left) out.push("left edge");
  return out;
}
