// Style test (dev only, not the production engine): a realistic forest world for two target moments.
// CC0 Poly Haven assets from /assets/styletest (see the style-test report for sources and licences).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const A = "/assets/styletest";
const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
export const loadGltf = (url) => gltfLoader.loadAsync(url);

export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
export function tex(url, { srgb = false, rep = 1 } = {}) {
  const t = texLoader.load(url); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- terrain ----------
export const groundH = (x, z) => 0.9 * Math.sin(x * 0.031 + 1) * Math.sin(z * 0.027) + 0.5 * Math.sin(x * 0.09 + z * 0.07);

/** a big ground: grass (leafy_grass) and forest dirt (forest_ground_04) mixed by a noise mask + a dirt path (mask fn) */
export function makeGround(size = 700, seg = 280, dirtMask = () => 0) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, mask = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i); p.setY(i, groundH(x, z));
    const n = 0.5 + 0.5 * Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2) * Math.sin(z * 0.13 + Math.sin(x * 0.05) * 2);
    mask[i] = Math.min(1, Math.max(0, dirtMask(x, z) + (n - 0.62) * 1.6));
  }
  g.setAttribute("mask", new THREE.BufferAttribute(mask, 1)); g.computeVertexNormals();
  const rep = size / 6;
  const mat = new THREE.MeshStandardMaterial({
    map: tex("/assets/leafy_grass/diff.jpg", { srgb: true, rep }), normalMap: tex("/assets/leafy_grass/nor.jpg", { rep }), roughness: 1,
    color: new THREE.Color("#b8d08a"),
  });
  const dirt = tex(`${A}/forest_ground_04/forest_ground_04_diff_1k.jpg`, { srgb: true, rep: rep * 0.8 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.dirtMap = { value: dirt };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float mask; varying float vMask; varying vec2 vUv2;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvMask = mask; vUv2 = uv * " + (rep * 0.8).toFixed(2) + ";");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D dirtMap; varying float vMask; varying vec2 vUv2;")
      .replace("#include <map_fragment>", "#include <map_fragment>\nvec4 dc = texture2D(dirtMap, vUv2); diffuseColor.rgb = mix(diffuseColor.rgb, dc.rgb * 1.15, smoothstep(0.2, 0.8, vMask));");
  };
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.name = "ground";
  return m;
}

// ---------- models as instanced parts ----------
/** a glTF model as [{ geometry (baked to model space), material }] (alpha BLEND -> alphaTest, so shadows and sorting work) */
export function partsOf(root, fix = {}) {
  root.updateMatrixWorld(true); const parts = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    const mat = o.material.clone();
    if (mat.transparent || mat.alphaMap || /leaves|leaf|branches|twigs|fern|grass/i.test(mat.name)) { mat.transparent = false; mat.alphaTest = 0.45; mat.depthWrite = true; mat.side = THREE.DoubleSide; }
    if (fix.tint) mat.color.multiply(new THREE.Color(fix.tint));
    parts.push({ geometry: g, material: mat });
  });
  return parts;
}
export function boundsOf(parts) { const b = new THREE.Box3(); for (const p of parts) { p.geometry.computeBoundingBox(); b.union(p.geometry.boundingBox); } return b; }

/** instanced copies of a part list at mats (Matrix4[]) */
export function instanced(parts, mats, { cast = true, receive = true } = {}) {
  const grp = new THREE.Group();
  for (const p of parts) {
    const im = new THREE.InstancedMesh(p.geometry, p.material, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true;
    im.castShadow = cast; im.receiveShadow = receive; im.frustumCulled = false; grp.add(im);
  }
  return grp;
}
export function placeMat(x, z, s, rot, tilt = 0, R = Math.random) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - 0.5) * tilt, rot, (R() - 0.5) * tilt));
  return new THREE.Matrix4().compose(new THREE.Vector3(x, groundH(x, z) - 0.15 * s, z), q, new THREE.Vector3(s, s * (0.9 + R() * 0.25), s));
}

/** impostor: render the model's albedo from the side into a texture; crossed quads (3 planes) lit by the scene */
export function makeImpostor(renderer, parts, { res = 512 } = {}) {
  const b = boundsOf(parts), size = new THREE.Vector3(); b.getSize(size);
  const w = Math.max(size.x, size.z), h = size.y;
  const scene = new THREE.Scene();
  for (const p of parts) {
    const m = new THREE.MeshBasicMaterial({ map: p.material.map, color: p.material.color, alphaTest: 0.45, side: THREE.DoubleSide, transparent: false });
    scene.add(new THREE.Mesh(p.geometry, m));
  }
  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
  const rt = new THREE.WebGLRenderTarget(res, Math.round(res * h / w), { samples: 4 });
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, b.max.y, b.min.y, 0.1, 1000);
  cam.position.set(cx, 0, cz + 500); cam.lookAt(cx, 0, cz);
  const prevBg = scene.background; scene.background = null;
  const prevTM = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(null);
  renderer.toneMapping = prevTM; scene.background = prevBg;
  const geo = new THREE.BufferGeometry(); const planes = [];
  for (let k = 0; k < 3; k++) { const pg = new THREE.PlaneGeometry(w, h); pg.translate(0, (b.min.y + b.max.y) / 2, 0); pg.rotateY((k * Math.PI) / 3); planes.push(pg); }
  const merged = mergeGeos(planes);
  const mat = new THREE.MeshLambertMaterial({ map: rt.texture, alphaTest: 0.5, side: THREE.DoubleSide, color: new THREE.Color(0.82, 0.86, 0.8) });
  return [{ geometry: merged, material: mat }];
}
function mergeGeos(list) {
  const pos = [], nor = [], uv = [], idx = []; let off = 0;
  for (const g of list) {
    const gi = g.index ? g : g;
    pos.push(...gi.attributes.position.array); nor.push(...gi.attributes.normal.array); uv.push(...gi.attributes.uv.array);
    for (const i of gi.index.array) idx.push(i + off); off += gi.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

// ---------- grass: instanced clumps of curved blades ----------
export function grassClumpGeometry(R = rng(7)) {
  const pos = [], col = [], idx = []; let v = 0;
  const blades = 9;
  for (let b = 0; b < blades; b++) {
    const a = R() * Math.PI * 2, r = R() * 0.18, h = 0.35 + R() * 0.45, lean = 0.15 + R() * 0.35, wdt = 0.025 + R() * 0.02;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r, dir = R() * Math.PI * 2, dx = Math.cos(dir), dz = Math.sin(dir);
    const px = -dz, pz = dx; const segs = 4;
    const base = new THREE.Color().setHSL(0.22 + R() * 0.06, 0.55, 0.12 + R() * 0.05, THREE.SRGBColorSpace), tip = new THREE.Color().setHSL(0.2 + R() * 0.06, 0.5, 0.32 + R() * 0.12, THREE.SRGBColorSpace);
    for (let s = 0; s <= segs; s++) {
      const f = s / segs, w = wdt * (1 - f * 0.92), y = h * f, off = lean * f * f;
      const cx = bx + dx * off, cz = bz + dz * off, c = base.clone().lerp(tip, f);
      pos.push(cx - px * w, y, cz - pz * w, cx + px * w, y, cz + pz * w); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (s < segs) idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      v += 2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  // blades lit mostly from above (no black backsides)
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) { n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3); } g.normalizeNormals?.();
  return g;
}
export function makeGrass({ center, radius, count, seed = 3, avoid = () => false, scale = 1 }) {
  const R = rng(seed), g = grassClumpGeometry(R);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
  const im = new THREE.InstancedMesh(g, mat, count); let n = 0; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < count * 3 && n < count; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * radius, x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    if (avoid(x, z)) continue;
    const s = scale * (0.7 + R() * 0.9) * (1 + r / radius * 0.6);
    m.compose(new THREE.Vector3(x, groundH(x, z) - 0.02, z), q.setFromEuler(e.set(0, R() * 6.28, 0)), new THREE.Vector3(s, s, s)); im.setMatrixAt(n++, m);
  }
  im.count = n; im.instanceMatrix.needsUpdate = true; im.receiveShadow = true; im.castShadow = false; im.frustumCulled = false;
  return im;
}

// ---------- dust and debris (deterministic in t) ----------
function puffTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
  const R = rng(11);
  for (let i = 0; i < 26; i++) {
    const px = 64 + (R() - 0.5) * 60, py = 64 + (R() - 0.5) * 60, r = 18 + R() * 30;
    const gr = x.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, "rgba(255,255,255,0.22)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = gr; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** bursts: [{ t0, pos: Vector3, n, spread, rise, size, color }] -> { group, update(t) } */
export function makeDust(bursts, { seed = 5 } = {}) {
  const map = puffTexture(), group = new THREE.Group(), sprites = []; const R = rng(seed);
  for (const b of bursts) for (let i = 0; i < b.n; i++) {
    const mat = new THREE.SpriteMaterial({ map, color: new THREE.Color(b.color ?? "#c8b394"), transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(mat); s.visible = false; group.add(s);
    const a = R() * Math.PI * 2, sp = (0.4 + R()) * b.spread;
    sprites.push({ s, b, dt: R() * (b.dur ?? 0.8), vx: Math.cos(a) * sp + (b.dir?.x ?? 0), vz: Math.sin(a) * sp + (b.dir?.z ?? 0), vy: (0.3 + R()) * b.rise, size: b.size * (0.6 + R() * 0.8), life: 2.2 + R() * 1.8, rot: R() * 6 });
  }
  return {
    group,
    update(t) {
      for (const p of sprites) {
        const age = t - p.b.t0 - p.dt;
        if (age < 0 || age > p.life) { p.s.visible = false; continue; }
        const k = 1 - Math.exp(-age * 1.2);
        p.s.visible = true;
        p.s.position.set(p.b.pos.x + p.vx * k * 2.2, p.b.pos.y + p.vy * k * 2.2 + 0.3, p.b.pos.z + p.vz * k * 2.2);
        const sc = p.size * (0.5 + 1.6 * k); p.s.scale.set(sc, sc, 1);
        p.s.material.rotation = p.rot + age * 0.2;
        p.s.material.opacity = Math.min(1, age * 5) * (1 - age / p.life) * (p.b.alpha ?? 0.85);
      }
    },
  };
}
/** leaves and twigs flying from smashed trees */
export function makeDebris(bursts, { seed = 9 } = {}) {
  const g = new THREE.PlaneGeometry(0.35, 0.22); const total = bursts.reduce((s, b) => s + b.n, 0);
  const mat = new THREE.MeshStandardMaterial({ color: "#5d7f2e", side: THREE.DoubleSide, roughness: 0.8 });
  const im = new THREE.InstancedMesh(g, mat, total); im.frustumCulled = false; const R = rng(seed), P = [];
  for (const b of bursts) for (let i = 0; i < b.n; i++) { const a = R() * 6.28; P.push({ b, vx: Math.cos(a) * (2 + R() * 5) + (b.dir?.x ?? 0), vz: Math.sin(a) * (2 + R() * 5) + (b.dir?.z ?? 0), vy: 3 + R() * 8, y0: b.h * (0.4 + R() * 0.6), spin: R() * 10, c: new THREE.Color().setHSL(0.2 + R() * 0.1, 0.6, 0.18 + R() * 0.2, THREE.SRGBColorSpace), s: 0.6 + R() * 1.6 }); }
  P.forEach((p, i) => im.setColorAt(i, p.c));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  return {
    group: im,
    update(t) {
      P.forEach((p, i) => {
        const age = t - p.b.t0;
        if (age < 0 || age > 4) { m.makeScale(0, 0, 0); im.setMatrixAt(i, m); return; }
        const drag = 1 - Math.exp(-age * 1.5);
        v.set(p.b.pos.x + p.vx * drag / 1.5, Math.max(0.05, p.b.pos.y + p.y0 + p.vy * drag / 1.5 - 2.2 * age * age), p.b.pos.z + p.vz * drag / 1.5);
        q.setFromEuler(e.set(p.spin * age, p.spin * age * 0.7, 0)); sc.setScalar(p.s);
        m.compose(v, q, sc); im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
    },
  };
}
