// Blocky Worlds sets: shared building helpers, ported from the locked look (look/scene.js): Poly Haven PBR materials,
// flat "solid" materials, boxes / rounded boxes / planes, CC0 model loading + normalising, instancing of repeated
// models, and a static-geometry merge (one draw call per material) so a whole set renders cheaply.
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PLASTIC_LOOK, makePlastic, flatFor, TILE_KIND, cleanPattern, plasticize, SURFACE_MATTE } from "../kit/plastic.js"; // PLASTIC-WORLD 2026-11-10
import { toyModelFor } from "../kit/nature.js"; // PLASTIC-WORLD: stylised trees / shrubs instead of the Poly Haven foliage

/** Loaders for when the caller's ctx has none (the dev preview passes its own, the engine passes its own). */
let _gl = null;
const _GLTF = new Map(), _TEX = new Map();
export function defaultLoaders(THREE) {
  _gl ??= new GLTFLoader();
  const texLoader = new THREE.TextureLoader();
  return {
    gltf: async (url) => {
      if (!_GLTF.has(url)) _GLTF.set(url, _gl.loadAsync(url));
      const g = await _GLTF.get(url);
      const c = g.scene.clone(true); c.scene = c; return c;
    },
    tex: (name, kind, srgb) => {
      const k = `${name}/${kind}`;
      if (!_TEX.has(k)) { const t = texLoader.load(`/assets/${name}/${kind}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; _TEX.set(k, t); }
      const t = _TEX.get(k).clone(); t.needsUpdate = true; return t;
    },
  };
}

/** A canvas texture (sRGB). draw(ctx2d, w, h). */
export function canvasTex(THREE, w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** Seeded random (for layout only; the set is built once, deterministically). */
export function lcg(seed = 1) { let s = seed >>> 0 || 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

/**
 * The building kit for one set. Everything is parented to `root` unless { parent } says otherwise.
 * Meshes made with bx/rbx/plane/mesh are marked static and merged by mergeStatic() at the end of the build.
 */
export function makeKit(ctx, root) {
  const { THREE } = ctx;
  const L = ctx.gltf && ctx.tex ? ctx : { ...ctx, ...defaultLoaders(THREE) };
  const MATS = new Map();

  function pbr(name, { repeat = [1, 1], tint = "#ffffff", rough = 1, normal = 1, ao = false } = {}) {
    const k = `${name}|${repeat}|${tint}|${rough}|${normal}`;
    if (MATS.has(k)) return MATS.get(k);
    // PLASTIC-WORLD 2026-11-10 (owner: "no photo textures, no noisy cobbles"): the Poly Haven surface becomes a flat toy
    // colour (its old tint honoured when it is a real colour); paving / bricks / planks keep a CLEAN line pattern
    if (PLASTIC_LOOK) {
      const col = flatFor(name, tint), pat = cleanPattern(THREE, TILE_KIND[name], col);
      if (pat) pat.repeat.set(...repeat);
      const m = makePlastic(THREE, pat ? "#ffffff" : col, { ...SURFACE_MATTE, ...(pat ? { map: pat } : {}), keepColour: true }); // GATE-V3: floors / walls satin-matte (a glossy floor mirrored the bright sky white at grazing angles)
      m.userData.fromPbr = name;
      MATS.set(k, m); return m;
    }
    const m = new THREE.MeshStandardMaterial({ color: tint, map: L.tex(name, "diff", true), normalMap: L.tex(name, "nor", false), roughnessMap: L.tex(name, "rough", false), roughness: rough });
    if (ao) { m.aoMap = L.tex(name, "ao", false); }
    m.normalScale.set(normal, normal);
    for (const t of [m.map, m.normalMap, m.roughnessMap, m.aoMap]) if (t) t.repeat.set(...repeat);
    MATS.set(k, m); return m;
  }
  const solid = (color, o = {}) => {
    const k = `solid|${color}|${JSON.stringify(o)}`;
    if (!MATS.has(k)) MATS.set(k, PLASTIC_LOOK ? makePlastic(THREE, color, o) : new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o })); // PLASTIC-WORLD
    return MATS.get(k);
  };
  const glass = (color = "#20303f") => new THREE.MeshPhysicalMaterial({ color, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.6, clearcoat: 1 });
  const paint = (c) => solid(c, { roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });

  function mesh(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent = root, shadow = true, cast = shadow, keep = false, block = false } = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = cast; m.receiveShadow = shadow;
    if (!keep) m.userData.static = true;
    if (block) m.userData.camBlock = true;
    parent.add(m); return m;
  }
  const bx = (w, h, d, mat, o = {}) => mesh(new THREE.BoxGeometry(w, h, d), mat, o);
  const rbx = (w, h, d, r, mat, o = {}) => mesh(r > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * 0.45)) : new THREE.BoxGeometry(w, h, d), mat, o);
  const plane = (w, d, mat, o = {}) => mesh(new THREE.PlaneGeometry(w, d), mat, { rx: -Math.PI / 2, ...o });
  const cyl = (rt, rb, h, seg, mat, o = {}) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, o);

  /** a CC0 model, normalised: origin at the bottom centre; height / length (longest side along z) in metres */
  async function model(url, { height = null, length = null, width = null, alongZ = true, first = false } = {}) {
    // PLASTIC-WORLD 2026-11-10: photo-scanned foliage (jacaranda, shrubs, island tree, fir, fern) -> a stylised toy tree /
    // bush (same normalising below); other Poly Haven models keep their shape, their photo maps become flat toy colours
    const toy = PLASTIC_LOOK ? toyModelFor(THREE, url) : null;
    const r = toy ?? await L.gltf(url);
    const g = toy ?? (r.scene ?? r).clone(true);
    if (PLASTIC_LOOK && !toy) { if (/\/assets\/(ph|styletest)\//.test(url)) g.traverse((o) => { for (const m of o.isMesh ? [o.material].flat() : []) if (m) m.userData.photo = true; }); plasticize(g); }
    if (first) { let rt = g; while (rt.children.length === 1 && rt.children[0].children.length) rt = rt.children[0]; rt.children.slice(1).forEach((c) => rt.remove(c)); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (o.material?.map) o.material.map.anisotropy = 8; } });
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3());
    const holder = new THREE.Group(); holder.add(g);
    let s = 1;
    if (height) s = height / size.y;
    if (width) s = width / size.x;
    if (length) { s = length / Math.max(size.x, size.z); if (alongZ && size.x > size.z) g.rotation.y = Math.PI / 2; }
    g.scale.multiplyScalar(s);
    g.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(g), c = b2.getCenter(new THREE.Vector3());
    g.position.x -= c.x; g.position.y -= b2.min.y; g.position.z -= c.z;
    return holder;
  }
  const place = (proto, x, y, z, ry = 0, s = 1, parent = root) => { const m = proto.clone(); m.position.set(x, y, z); m.rotation.y = ry; m.scale.multiplyScalar(s); parent.add(m); return m; };

  /** many copies of a model as InstancedMeshes (one per sub-mesh). list: [{ x, y, z, ry, s, sy }] */
  function instance(proto, list, { parent = root, shadow = true } = {}) {
    if (!list.length) return [];
    const holder = new THREE.Group(); holder.add(proto.clone()); holder.updateMatrixWorld(true);
    const out = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    holder.traverse((o) => {
      if (!o.isMesh) return;
      const local = o.matrixWorld.clone();
      const im = new THREE.InstancedMesh(o.geometry, o.material, list.length);
      list.forEach((p, i) => {
        q.setFromAxisAngle(up, p.ry ?? 0);
        const s = p.s ?? 1;
        m4.compose(new THREE.Vector3(p.x, p.y ?? 0, p.z), q, new THREE.Vector3(s, s * (p.sy ?? 1), s)).multiply(local);
        im.setMatrixAt(i, m4);
      });
      im.castShadow = shadow; im.receiveShadow = true; im.computeBoundingSphere(); im.computeBoundingBox?.();
      parent.add(im); out.push(im);
    });
    return out;
  }

  /**
   * A lighter copy of a heavy model (the jacaranda has 3.9 M triangles): keeps one of every `keep` triangle pairs per
   * material whose name matches a key of `rules` ({ leaves: 3, branches: 2, trunk: 1, ...}; 0 drops the sub-mesh).
   * New geometries; the source model is untouched.
   */
  function thin(proto, rules) {
    const c = proto.clone(true);
    const drop = [];
    c.traverse((o) => {
      if (!o.isMesh || !o.geometry.index) return;
      const name = o.material?.name ?? "";
      const rule = Object.entries(rules).find(([k]) => name.includes(k));
      if (!rule) return;
      const keep = rule[1];
      if (keep === 0) { drop.push(o); return; }
      if (keep <= 1) return;
      const src = o.geometry.index.array, tris = src.length / 3;
      const out = new (src.constructor)(Math.ceil(tris / keep) * 3 + 6);
      let n = 0;
      for (let t = 0; t < tris; t++) { if ((t >> 1) % keep) continue; out[n++] = src[t * 3]; out[n++] = src[t * 3 + 1]; out[n++] = src[t * 3 + 2]; }
      const g = new THREE.BufferGeometry();
      for (const [k, a] of Object.entries(o.geometry.attributes)) g.setAttribute(k, a);
      g.setIndex(new THREE.BufferAttribute(out.slice(0, n), 1));
      g.boundingSphere = o.geometry.boundingSphere; g.boundingBox = o.geometry.boundingBox;
      o.geometry = g;
    });
    drop.forEach((o) => o.parent.remove(o));
    return c;
  }

  /** the look's procedural fabric (B's clothing), seeded: cotton | denim | stripes | plaid | dots */
  function fabric(color, kind = "cotton", repeat = [1, 1]) {
    const k = `fabric|${color}|${kind}|${repeat}`;
    if (MATS.has(k)) return MATS.get(k);
    const rnd = lcg(color.length * 31 + kind.length * 7 + 11), base = new THREE.Color(color);
    const t = canvasTex(THREE, 128, 128, (p) => {
      p.fillStyle = color; p.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 1600; i++) { const k2 = 0.88 + rnd() * 0.24; p.fillStyle = `#${base.clone().multiplyScalar(k2).getHexString()}`; p.fillRect(rnd() * 128, rnd() * 128, 2, 2); }
      if (kind === "stripes") { p.fillStyle = "rgba(255,255,255,0.85)"; for (let y = 0; y < 128; y += 22) p.fillRect(0, y, 128, 9); }
      if (kind === "plaid") { p.fillStyle = "rgba(20,20,40,0.28)"; for (let y = 0; y < 128; y += 32) p.fillRect(0, y, 128, 12); for (let x = 0; x < 128; x += 32) p.fillRect(x, 0, 12, 128); p.fillStyle = "rgba(255,230,120,0.5)"; for (let y = 6; y < 128; y += 32) p.fillRect(0, y, 128, 2); }
      if (kind === "dots") { p.fillStyle = "rgba(255,255,255,0.9)"; for (let y = 8; y < 128; y += 24) for (let x = (y / 24) % 2 ? 8 : 20; x < 128; x += 24) { p.beginPath(); p.arc(x, y, 5, 0, Math.PI * 2); p.fill(); } }
    });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
    const m = PLASTIC_LOOK ? makePlastic(THREE, kind === "stripes" || kind === "plaid" || kind === "dots" ? "#ffffff" : color, kind === "stripes" || kind === "plaid" || kind === "dots" ? { map: t, keepColour: true, roughness: 0.55 } : { roughness: 0.55 }) : new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }); // PLASTIC-WORLD: plain cloth = flat colour
    MATS.set(k, m); return m;
  }

  return { THREE, L, root, thin, fabric, pbr, solid, glass, paint, mesh, bx, rbx, plane, cyl, model, place, instance, canvas: (w, h, d) => canvasTex(THREE, w, h, d) };
}

/**
 * Merge every static mesh under root that shares a material into one mesh (world transforms baked, relative to root).
 * Keeps materials (so emissive toggles still work). Returns the merged meshes.
 */
export function mergeStatic(THREE, root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.userData.static || Array.isArray(o.material)) return;
    const k = `${o.material.uuid}|${o.castShadow}|${o.receiveShadow}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  });
  const merged = [];
  for (const list of groups.values()) {
    if (list.length < 2) { if (list[0].userData.camBlock) merged.push(list[0]); continue; }
    const geos = list.map((o) => {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const n of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(n)) g.deleteAttribute(n);
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(inv.clone().multiply(o.matrixWorld));
      return g;
    });
    const geo = mergeGeometries(geos, false);
    if (!geo) continue;
    geos.forEach((g) => g.dispose());
    const m = new THREE.Mesh(geo, list[0].material);
    m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow;
    m.userData.camBlock = list.some((o) => o.userData.camBlock);
    root.add(m); merged.push(m);
    for (const o of list) { o.parent.remove(o); o.geometry.dispose(); }
  }
  // drop groups left empty by the merge
  const empties = [];
  root.traverse((o) => { if (o !== root && o.isGroup && !o.children.length && !o.userData.keep) empties.push(o); });
  empties.forEach((o) => o.parent?.remove(o));
  return merged;
}

/** Glow registry: materials whose emissive changes with the light ("day" | "night" | "warm"). */
export function glowList() {
  const list = [];
  return {
    add(mat, levels /* { day, night, warm } emissiveIntensity */, colors = null /* optional { day, night, warm } color */) { list.push({ mat, levels, colors }); return mat; },
    apply(mode) { for (const g of list) { g.mat.emissiveIntensity = g.levels[mode] ?? g.levels.day ?? 0; if (g.colors?.[mode]) g.mat.color.set(g.colors[mode]); } },
  };
}
