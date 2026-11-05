// Blocky Worlds: build an AI-designed (or hand-written) BLOCK BLUEPRINT into a three.js object in the locked look.
// The schema and its validation: lib/builder/spec.js (CONTRACT.md addendum "Built on demand").
//   buildBlueprint(bp) -> THREE.Group      origin on the floor at its front-centre, faces +z (like kit/objects.js), with
//                                          userData { kind: "blueprint", name, height, width, depth, focus, detail?,
//                                          frameH, actors: "front", push, big, problems }
//   animateBlueprint(obj, t, state)        per frame: bob / spin / swing / blink / wobble / open (state "closed" keeps
//                                          "open" parts shut)
// Never throws on a bad blueprint: what is valid is built, the rest is listed in userData.problems.
// Shared materials and geometries (kitCommon caches), bevelled boxes, the people kit's procedural fabric, Lilita labels.
import * as THREE from "three";
import { bodyMotion, MOTION_STATES } from "./motion.js";
import { cachedGeo, cachedMat, solid, fabric, boxGeo, canvasTex, loadKitFonts, kitFont, fitText, rng, hashSeed } from "./kitCommon.js";
import { validateBlueprint } from "../../lib/builder/spec.js";

await loadKitFonts();

const DEG = Math.PI / 180;
const r3 = (v) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------- materials (shared, cached by colour)
const TEX = new Map();
function texOnce(key, w, h, draw) {
  let t = TEX.get(key);
  if (!t) { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; TEX.set(key, t); }
  return t;
}
const woodTex = (color) => texOnce(`bpwood${color}`, 128, 128, (p, w, h) => {
  const R = rng(hashSeed(`wood${color}`)), base = new THREE.Color(color), c = new THREE.Color();
  p.fillStyle = color; p.fillRect(0, 0, w, h);
  for (let k = 0; k < 4; k++) { p.fillStyle = `#${c.copy(base).multiplyScalar(0.86 + R() * 0.24).getHexString()}`; p.fillRect(0, k * 32 + 1, w, 30); }
  p.strokeStyle = "rgba(40,20,10,0.22)"; p.lineWidth = 1.2;
  for (let i = 0; i < 26; i++) { const y = R() * h; p.beginPath(); p.moveTo(0, y); p.bezierCurveTo(w * 0.3, y + R() * 6 - 3, w * 0.7, y + R() * 6 - 3, w, y); p.stroke(); }
  p.fillStyle = "rgba(30,15,5,0.45)"; for (let k = 0; k < 4; k++) p.fillRect(0, k * 32, w, 2);
});
const stoneTex = (color) => texOnce(`bpstone${color}`, 128, 128, (p, w, h) => {
  const R = rng(hashSeed(`stone${color}`)), base = new THREE.Color(color), c = new THREE.Color();
  p.fillStyle = `#${c.copy(base).multiplyScalar(0.55).getHexString()}`; p.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let k = -1; k < 3; k++) {
    p.fillStyle = `#${c.copy(base).multiplyScalar(0.82 + R() * 0.3).getHexString()}`;
    p.fillRect(k * 64 + (r % 2 ? 32 : 0) + 3, r * 32 + 3, 58, 26);
  }
  for (let i = 0; i < 700; i++) { p.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.08})`; p.fillRect(R() * w, R() * h, 2, 2); }
});
export function blueprintMaterial(color, material = "matte", pattern = "none") {
  switch (material) {
    case "plastic": return solid(color, { roughness: 0.32 });
    case "metal": return solid(color, { roughness: 0.3, metalness: 0.75 });
    case "glass": return cachedMat(`bpglass${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45, depthWrite: false }));
    case "glow": return cachedMat(`bpglow${color}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.4 }));
    case "fabric": return fabric(color, pattern && pattern !== "none" ? pattern : "cotton");
    case "wood": return cachedMat(`bpwoodm${color}`, () => new THREE.MeshStandardMaterial({ map: woodTex(color), roughness: 0.8 }));
    case "stone": return cachedMat(`bpstonem${color}`, () => new THREE.MeshStandardMaterial({ map: stoneTex(color), roughness: 0.92 }));
    default: return solid(color, { roughness: 0.82 });
  }
}

// ---------------------------------------------------------------- geometries (unit shapes scaled per mesh, boxes per size)
const unitCyl = () => cachedGeo("bpcyl", () => new THREE.CylinderGeometry(0.5, 0.5, 1, 24));
const unitCone = () => cachedGeo("bpcone", () => new THREE.ConeGeometry(0.5, 1, 24));
const unitSphere = () => cachedGeo("bpsph", () => new THREE.SphereGeometry(0.5, 24, 16));
const unitWedge = () => cachedGeo("bpwedge", () => {
  // a ramp: low at the front (+z), the tall edge at the back (-z); 1 x 1 x 1 centred
  const s = new THREE.Shape([new THREE.Vector2(0.5, -0.5), new THREE.Vector2(-0.5, -0.5), new THREE.Vector2(0.5, 0.5)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5); g.rotateY(Math.PI / 2);
  return g;
});
const torusGeo = (t) => cachedGeo(`bptorus${r3(t)}`, () => { const r = t / 2; return new THREE.TorusGeometry(0.5 - r, r, 12, 36); });

/** the mesh for one part (its local frame: centred on the part; rotation applied by the caller's body group) */
function partMesh(p) {
  const [x, y, z] = p.size, mat = blueprintMaterial(p.color, p.material, p.pattern);
  let m;
  switch (p.shape) {
    case "box": m = new THREE.Mesh(boxGeo(x, y, z, Math.min(0.035, Math.min(x, y, z) * 0.08)), mat); break;
    case "roundedBox": m = new THREE.Mesh(boxGeo(x, y, z, Math.min(0.25, Math.min(x, y, z) * 0.28)), mat); break;
    case "cylinder": m = new THREE.Mesh(unitCyl(), mat); m.scale.set(x, y, z); break;
    case "cone": m = new THREE.Mesh(unitCone(), mat); m.scale.set(x, y, z); break;
    case "sphere": m = new THREE.Mesh(unitSphere(), mat); m.scale.set(x, y, z); break;
    case "wedge": m = new THREE.Mesh(unitWedge(), mat); m.scale.set(x, y, z); break;
    case "torus": { const t = Math.min(0.45, Math.max(0.02, z / Math.max(x, 1e-3))); m = new THREE.Mesh(torusGeo(t), mat); m.scale.set(x, y, x); break; }
    default: m = new THREE.Mesh(boxGeo(x, y, z, 0.02), mat);
  }
  m.castShadow = p.material !== "glass" && p.material !== "glow";
  m.receiveShadow = true;
  return m;
}

/** a text decal on one face of a part (a plane just off the face) */
function labelMesh(l, p) {
  const [x, y, z] = p.size;
  const dims = { front: [x, y], back: [x, y], left: [z, y], right: [z, y], top: [x, z] }[l.face];
  const w = Math.max(0.05, dims[0] * 0.9), h = Math.max(0.05, dims[1] * 0.85);
  const H = 256, W = Math.max(64, Math.min(2048, Math.round(H * (w / h))));
  const t = texOnce(`bplabel|${l.text}|${l.color}|${l.bg}|${W}`, W, H, (c) => {
    if (l.bg) { c.fillStyle = l.bg; c.beginPath(); c.roundRect(4, 4, W - 8, H - 8, H * 0.12); c.fill(); }
    const { lines, size } = fitText(c, l.text, W * 0.88, H * 0.8, { maxSize: 200, maxLines: 2, lineGap: 1.0 });
    c.font = kitFont(size); c.textAlign = "center"; c.textBaseline = "middle"; c.lineJoin = "round";
    const y0 = H / 2 - ((lines.length - 1) * size) / 2 + size * 0.04;
    lines.forEach((s, i) => { c.lineWidth = size * 0.14; c.strokeStyle = "rgba(20,14,24,0.85)"; if (!l.bg) c.strokeText(s, W / 2, y0 + i * size); c.fillStyle = l.color; c.fillText(s, W / 2, y0 + i * size); });
  });
  const m = new THREE.Mesh(cachedGeo(`bplplane${r3(w)},${r3(h)}`, () => new THREE.PlaneGeometry(w, h)),
    cachedMat(`bplabelm${t.uuid}`, () => new THREE.MeshStandardMaterial({ map: t, transparent: !l.bg, alphaTest: l.bg ? 0 : 0.05, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 })));
  const off = 0.004;
  if (l.face === "front") m.position.z = z / 2 + off;
  else if (l.face === "back") { m.position.z = -z / 2 - off; m.rotation.y = Math.PI; }
  else if (l.face === "left") { m.position.x = -x / 2 - off; m.rotation.y = -Math.PI / 2; }
  else if (l.face === "right") { m.position.x = x / 2 + off; m.rotation.y = Math.PI / 2; }
  else { m.position.y = y / 2 + off; m.rotation.x = -Math.PI / 2; }
  m.receiveShadow = true;
  return m;
}

/**
 * buildBlueprint(raw) -> THREE.Group. Coordinates in the blueprint are metres in ONE frame (y up, +z = the side that
 * faces the camera); a part's `parent` only makes it move with that part (animations). After building, the whole thing
 * is scaled to the blueprint's height (when given), put on the floor and centred, its front at z = 0.
 */
export function buildBlueprint(raw) {
  const { blueprint: bp, problems } = validateBlueprint(raw);
  const outer = new THREE.Group(); outer.name = `blueprint:${bp.name}`;
  const holder = new THREE.Group(); outer.add(holder);
  const nodes = new Map(); // id -> { pivot (Group), body (Group), part }
  for (const p of bp.parts) {
    try {
      const pivot = new THREE.Group(), body = new THREE.Group();
      const at = p.pivot ?? p.pos;
      pivot.position.set(...at);
      body.position.set(p.pos[0] - at[0], p.pos[1] - at[1], p.pos[2] - at[2]);
      body.rotation.set(p.rot[0] * DEG, p.rot[1] * DEG, p.rot[2] * DEG);
      body.add(partMesh(p));
      pivot.add(body); holder.add(pivot);
      pivot.name = p.id;
      nodes.set(p.id, { pivot, body, part: p });
    } catch (e) { problems.push(`part ${p.id}: ${e.message}`); }
  }
  holder.updateMatrixWorld(true);
  for (const { pivot, part } of nodes.values()) if (part.parent && nodes.has(part.parent)) nodes.get(part.parent).pivot.attach(pivot); // keeps world transforms
  for (const l of bp.labels) {
    const n = nodes.get(l.part);
    try { if (n) n.body.add(labelMesh(l, n.part)); } catch (e) { problems.push(`label "${l.text}": ${e.message}`); }
  }
  // size, ground, centre, front at z = 0
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  if (box.isEmpty()) { problems.push("nothing could be built"); box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5)); }
  const size = box.getSize(new THREE.Vector3());
  const s = bp.height ? bp.height / Math.max(size.y, 1e-3) : 1;
  holder.scale.setScalar(s);
  const c = box.getCenter(new THREE.Vector3());
  holder.position.set(-c.x * s, -box.min.y * s, -box.max.z * s);
  const H = size.y * s, W = size.x * s, D = size.z * s;
  // where the camera looks: the blueprint's focus (on the floor under it) or the footprint's centre
  const focus = bp.focus
    ? new THREE.Vector3(bp.focus[0] * s + holder.position.x, 0, bp.focus[2] * s + holder.position.z)
    : new THREE.Vector3(0, 0, -D / 2);
  // anims: the pivot groups and their rest transforms
  const anims = [];
  for (const a of bp.anims) {
    const n = nodes.get(a.part); if (!n) continue;
    anims.push({ ...a, node: n.pivot, body: n.body, pos0: n.pivot.position.clone(), rot0: n.pivot.rotation.clone() });
  }
  Object.assign(outer.userData, {
    kind: "blueprint", name: bp.name, aliases: bp.aliases, height: H, width: W, depth: D, focus,
    detail: bp.focus ? { at: focus.clone(), h: Math.min(H, Math.max(0.6, bp.focus[1] * s * 1.6 || H)) } : undefined,
    frameH: H, fitH: H, fitW: W, actors: "front", push: Math.min(2.5, D / 2 + 0.6), big: H > 3.6 || W > 4.5,
    state: "on", anims, problems, parts: nodes.size,
  });
  outer.traverse((o) => { if (o.isMesh) o.frustumCulled = true; });
  return outer;
}

/** per frame (deterministic in t): the blueprint's animations. state "closed": "open" anims stay at rest. */
export function animateBlueprint(obj, t, state = null) {
  if (obj && MOTION_STATES.includes(state)) bodyMotion(obj, state, Math.max(0, Number(t) || 0)); // 2026-11-05 (GAPS): the shared body motions
  const list = obj?.userData?.anims;
  if (!list?.length) return;
  const T = Math.max(0, Number(t) || 0);
  for (const a of list) {
    const ph = 2 * Math.PI * a.speed * T, ax = a.axis;
    a.node.position.copy(a.pos0); a.node.rotation.copy(a.rot0); a.body.visible = true;
    switch (a.kind) {
      case "bob": a.node.position[ax] = a.pos0[ax] + Math.min(2, Math.abs(a.amount)) * Math.sign(a.amount || 1) * Math.sin(ph); break;
      case "spin": a.node.rotation[ax] = a.rot0[ax] + ph; break;
      case "swing": a.node.rotation[ax] = a.rot0[ax] + a.amount * DEG * Math.sin(ph); break;
      case "wobble": a.node.rotation.x = a.rot0.x + a.amount * 0.5 * DEG * Math.sin(ph); a.node.rotation.z = a.rot0.z + a.amount * 0.5 * DEG * Math.cos(ph * 0.9); break;
      case "blink": a.body.visible = Math.sin(ph) > -0.2; break;
      case "open": { if (state === "closed") break; const k = Math.min(1, T * Math.max(0.2, a.speed)); a.node.rotation[ax] = a.rot0[ax] + a.amount * DEG * (k * k * (3 - 2 * k)); break; }
    }
  }
}
