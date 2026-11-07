// Blocky Worlds EPIC (EPIC agent): instanced crowds and armies, 1-2000 characters in about a dozen draw calls.
// One InstancedMesh per body part (legs, torso, arms, head, face, hair / helmet, shield, spear, banner pole + flag,
// wolf snout + ears), shared materials, per-instance colours (instanceColor). Every frame each character's part
// matrices are composed on the CPU from lib/epic.js crowdMotion() (pure, deterministic from t): ~2-4 ms for 500.
//
//   makeCrowd({ kind, count, formation, seed, faction, spacing, facing, scale }) -> Group (userData.crowd)
//     kind: soldier | knight | wolf_soldier | townsfolk; faction: "wolf" (dark steel + red) | "town" (blue + gold) |
//     a colour; facing: yaw (radians) of the whole formation's "forward"
//   updateCrowd(crowd, t, { action, origin: Vector3, yaw, surface(x, z) -> y | null, camera, speed })
//     places + poses every character; LOD from the camera distance (near: bevelled blocks + faces; far: plain boxes,
//     no faces / hand props detail)
// Blocky and kid-safe: helmets, shields, spears with a blunt blocky tip, banners; no blood, no gore.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { formationSlots, crowdMotion, prng } from "../../lib/epic.js";

const SKIN = ["#f3cba9", "#c98e6b", "#8a5a3c", "#e7b38e", "#5e3b28", "#f6d6bd", "#a86f4b", "#ffe0c7"];
const TOPS = ["#18b8a5", "#ff7a1a", "#ffd32a", "#c0392b", "#ff6fb5", "#273c75", "#ff3b6b", "#2e86de", "#6c5ce7", "#00b894", "#e84393", "#fdcb6e", "#0984e3", "#d63031", "#55efc4", "#a29bfe", "#f0932b", "#badc58"];
const PANTS = ["#2f4f86", "#3b5b8f", "#2d3436", "#57606f", "#c8a96a", "#1e272e", "#6d4c41", "#273c75", "#4b6584"];
const HAIR = ["#1b1410", "#2b1d14", "#3a2a1e", "#6b3e1f", "#b5651d", "#d9a441", "#8b2e16"];
const FACTIONS = {
  wolf: { tunic: ["#7a1f2b", "#8e1f2b", "#6b1a24"], pants: ["#2b2f36", "#33383f"], metal: "#6f7782", shield: "#7a1f2b", trim: "#d8b45a", flag: "#8e1f2b", fur: ["#6b7280", "#5d6470", "#7d8590", "#4f555e"] },
  town: { tunic: ["#2e86de", "#2a6fc0", "#3b8fe6"], pants: ["#3b2f25", "#4a3a2c"], metal: "#b9c2cc", shield: "#f1c40f", trim: "#ffffff", flag: "#2e86de", fur: ["#c58b4f"] },
};

// unscaled figure (people.js proportions; the crowd is scaled 0.87 like adults): hip 0.9, shoulders 1.56, head centre 1.83
const HIP = 0.9, SH_Y = 0.66, SH_X = 0.315, HEAD_Y = 0.93, SCALE = 0.87;

const GEO = { near: null, far: null };
function geos(level) {
  if (GEO[level]) return GEO[level];
  const near = level === "near";
  const box = (w, h, d, r = 0.03) => (near ? new RoundedBoxGeometry(w, h, d, 1, r) : new THREE.BoxGeometry(w, h, d));
  const pivotTop = (g, h) => { g.translate(0, -h / 2, 0); return g; };
  const colored = (g, fn) => { // bake a vertex colour (white = tinted by instanceColor, dark = boots / hands)
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const c = fn(pos.getX(i), pos.getY(i), pos.getZ(i)); col.set(c, i * 3); }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3)); return g;
  };
  const G = {
    leg: colored(pivotTop(box(0.19, 0.9, 0.22), 0.9), (x, y) => (y < -0.78 ? [0.22, 0.2, 0.2] : [1, 1, 1])),
    torso: colored((() => { const g = box(0.48, 0.72, 0.26); g.translate(0, 0.36 + 0.02, 0); return g; })(), (x, y) => (y < 0.2 ? [0.55, 0.5, 0.48] : [1, 1, 1])),
    arm: colored(pivotTop(box(0.15, 0.63, 0.17), 0.63), (x, y) => (y < -0.5 ? [1.6, 1.25, 1.0] : [1, 1, 1])),
    head: (() => { const g = box(0.3, 0.32, 0.3, 0.02); g.translate(0, 0.16, 0); return g; })(),
    face: (() => { const g = new THREE.PlaneGeometry(0.28, 0.28); g.translate(0, 0.15, 0.152); return g; })(),
    hair: (() => { const g = box(0.32, 0.1, 0.32, 0.02); g.translate(0, 0.35, 0); return g; })(),
    helmet: (() => { const g = box(0.36, 0.2, 0.36, 0.04); g.translate(0, 0.36, -0.005); return g; })(),
    crest: (() => { const g = box(0.06, 0.12, 0.3, 0.02); g.translate(0, 0.5, -0.02); return g; })(),
    snout: (() => { const g = box(0.16, 0.12, 0.16, 0.02); g.translate(0, 0.09, 0.22); return g; })(),
    ear: (() => { const g = new THREE.ConeGeometry(0.07, 0.17, 4); g.rotateY(Math.PI / 4); g.translate(0, 0.38, -0.03); return g; })(),
    shield: (() => { const g = box(0.08, 0.6, 0.48, 0.03); return g; })(),
    boss: (() => { const g = box(0.06, 0.16, 0.16, 0.02); g.translate(0.05, 0, 0); return g; })(),
    pole: (() => { const g = new THREE.BoxGeometry(0.05, 2.3, 0.05); g.translate(0, 0.55, 0); return g; })(),
    tip: (() => { const g = new THREE.ConeGeometry(0.07, 0.22, 4); g.translate(0, 1.8, 0); return g; })(),
    flag: (() => { const g = new THREE.BoxGeometry(0.03, 0.5, 0.7); g.translate(0, 1.4, -0.37); return g; })(),
  };
  GEO[level] = G; return G;
}

const FACE_TEX = new Map();
function faceTexture(kind) {
  if (FACE_TEX.has(kind)) return FACE_TEX.get(kind);
  const c = document.createElement("canvas"); c.width = c.height = 128; const p = c.getContext("2d");
  p.clearRect(0, 0, 128, 128); p.lineCap = "round";
  const angry = kind === "angry", wolf = kind === "wolf";
  for (const x of [42, 86]) {
    p.fillStyle = wolf ? "#ffd23a" : "#ffffff"; p.strokeStyle = "#2a1d24"; p.lineWidth = 6;
    p.beginPath(); p.ellipse(x, 62, 14, angry || wolf ? 11 : 16, 0, 0, Math.PI * 2); p.fill(); p.stroke();
    p.fillStyle = "#2a1d24"; p.beginPath(); p.ellipse(x + (x < 64 ? 2 : -2), 64, wolf ? 3 : 7, 8, 0, 0, Math.PI * 2); p.fill();
    p.lineWidth = 9; p.beginPath();
    if (angry || wolf) { p.moveTo(x - 16, x < 64 ? 38 : 48); p.lineTo(x + 16, x < 64 ? 48 : 38); } else { p.moveTo(x - 14, 38); p.quadraticCurveTo(x, 30, x + 14, 38); }
    p.stroke();
  }
  p.lineWidth = 8; p.beginPath();
  if (kind === "happy") { p.moveTo(46, 94); p.quadraticCurveTo(64, 112, 82, 94); } else if (angry) { p.moveTo(46, 100); p.lineTo(82, 100); } else if (!wolf) { p.moveTo(50, 98); p.quadraticCurveTo(64, 104, 78, 98); }
  if (!wolf) p.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  FACE_TEX.set(kind, t); return t;
}

const MAT = new Map();
const mat = (k, make) => { if (!MAT.has(k)) MAT.set(k, make()); return MAT.get(k); };

/** makeCrowd(opts) -> Group; see the header */
export function makeCrowd(opts = {}) {
  const kind = ["soldier", "knight", "wolf_soldier", "townsfolk"].includes(opts.kind) ? opts.kind : "townsfolk";
  const count = Math.max(1, Math.min(2000, Math.floor(opts.count ?? 50)));
  const formation = opts.formation ?? (kind === "townsfolk" ? "scatter" : "block");
  const seed = opts.seed ?? 3, R = prng(seed * 101 + count);
  const slots = formationSlots(formation, count, { spacing: opts.spacing ?? (kind === "townsfolk" ? 1.5 : 1.25), seed });
  const armed = kind !== "townsfolk", wolf = kind === "wolf_soldier";
  const F = FACTIONS[opts.faction] ?? (typeof opts.faction === "string" && /^#/.test(opts.faction) ? { ...FACTIONS.town, tunic: [opts.faction], shield: opts.faction, flag: opts.faction } : wolf ? FACTIONS.wolf : FACTIONS.town);
  const g = new THREE.Group(); g.name = `crowd:${kind}`;
  const base = mat("vc", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }));
  const plainM = mat("plain", () => new THREE.MeshStandardMaterial({ roughness: 0.6 }));
  const metalM = mat("metal", () => new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.55 }));
  const faceM = mat(`face:${wolf ? "wolf" : armed ? "angry" : "happy"}`, () => new THREE.MeshStandardMaterial({ map: faceTexture(wolf ? "wolf" : armed ? "angry" : "happy"), transparent: true, alphaTest: 0.4, roughness: 0.6 }));
  const near = geos("near");
  const parts = {};
  const add = (name, geo, material, n, shadow = true) => { const im = new THREE.InstancedMesh(geo, material, n); im.name = name; im.frustumCulled = false; im.castShadow = shadow; im.receiveShadow = true; g.add(im); parts[name] = im; return im; };
  add("legL", near.leg, base, count); add("legR", near.leg, base, count); add("torso", near.torso, base, count);
  add("armL", near.arm, base, count); add("armR", near.arm, base, count); add("head", near.head, plainM, count);
  add("face", near.face, faceM, count, false);
  if (wolf) { add("snout", near.snout, plainM, count); add("earL", near.ear, plainM, count); add("earR", near.ear, plainM, count); }
  if (armed) { add("helmet", near.helmet, metalM, count); if (kind === "knight") add("crest", near.crest, plainM, count); add("shield", near.shield, plainM, count); add("boss", near.boss, metalM, count); }
  else add("hair", near.hair, plainM, count);
  // weapons: spears for most, a banner every ~12th soldier (pole + flag); townsfolk carry nothing
  const banner = slots.map((s, i) => armed && (i % 12 === 5));
  const nB = banner.filter(Boolean).length;
  if (armed) { add("pole", near.pole, mat("wood", () => new THREE.MeshStandardMaterial({ color: "#7a5230", roughness: 0.8 })), count); add("tip", near.tip, metalM, count - nB); add("flag", near.flag, plainM, Math.max(1, nB)); }
  // per-character colours + sizes
  const c = new THREE.Color(), chars = slots.map((s, i) => {
    const kid = kind === "townsfolk" && R() < 0.25;
    const ch = { slot: s, scale: SCALE * (kid ? 0.72 : 0.95 + R() * 0.1), banner: banner[i] };
    const skin = wolf ? F.fur[Math.floor(R() * F.fur.length)] : SKIN[Math.floor(R() * SKIN.length)];
    const top = armed ? F.tunic[Math.floor(R() * F.tunic.length)] : TOPS[Math.floor(R() * TOPS.length)];
    const pants = armed ? F.pants[Math.floor(R() * F.pants.length)] : PANTS[Math.floor(R() * PANTS.length)];
    parts.legL.setColorAt(i, c.set(pants)); parts.legR.setColorAt(i, c.set(pants)); parts.torso.setColorAt(i, c.set(top));
    // the arm's hand end is baked lighter: tint the sleeve with the top colour (hands read as a lighter top at crowd size)
    parts.armL.setColorAt(i, c.set(top)); parts.armR.setColorAt(i, c.set(top));
    parts.head.setColorAt(i, c.set(skin)); parts.face.setColorAt(i, c.set("#ffffff"));
    if (wolf) { parts.snout.setColorAt(i, c.set(skin).multiplyScalar(1.25)); parts.earL.setColorAt(i, c.set(skin)); parts.earR.setColorAt(i, c.set(skin)); }
    if (armed) { parts.helmet.setColorAt(i, c.set(F.metal)); parts.shield.setColorAt(i, c.set(R() < 0.85 ? F.shield : F.trim)); parts.boss.setColorAt(i, c.set(F.trim)); parts.crest?.setColorAt(i, c.set(F.flag)); }
    else parts.hair.setColorAt(i, c.set(HAIR[Math.floor(R() * HAIR.length)]));
    return ch;
  });
  if (armed) { let b = 0; chars.forEach((ch) => { if (ch.banner) parts.flag.setColorAt(b++, c.set(F.flag)); }); }
  for (const im of Object.values(parts)) if (im.instanceColor) im.instanceColor.needsUpdate = true;
  g.userData.crowd = { kind, count, formation, slots, chars, parts, armed, wolf, level: "near", extent: slots.reduce((m, s) => Math.max(m, Math.hypot(s.x, s.z)), 0) + 1 };
  return g;
}

const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _t = new THREE.Matrix4(), _r = new THREE.Matrix4(), _a = new THREE.Matrix4(), _w = new THREE.Matrix4();
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const T = (x, y, z) => _t.makeTranslation(x, y, z), RX = (a) => _r.makeRotationX(a);

/** updateCrowd(crowd, t, opts): see the header */
export function updateCrowd(crowd, t, opts = {}) {
  const C = crowd.userData.crowd, P = C.parts;
  const action = opts.action ?? "stand", origin = opts.origin ?? new THREE.Vector3(), yaw = opts.yaw ?? 0, surf = opts.surface ?? null;
  // LOD: plain boxes and no faces past ~45 m (the bevels and faces are sub-pixel there)
  if (opts.camera) {
    const d = opts.camera.position.distanceTo(origin) - C.extent;
    const level = d > 45 ? "far" : "near";
    if (level !== C.level) {
      const G = geos(level);
      const map = { legL: "leg", legR: "leg", torso: "torso", armL: "arm", armR: "arm", head: "head", hair: "hair", helmet: "helmet", crest: "crest", snout: "snout", shield: "shield", boss: "boss" };
      for (const [k, gk] of Object.entries(map)) if (P[k]) P[k].geometry = G[gk];
      P.face.visible = level === "near"; if (P.boss) P.boss.visible = level === "near";
      C.level = level;
    }
  }
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  let tipI = 0, flagI = 0;
  // ATTACH 2026-11-07: each character's ground point (x, y, z, shown) for the free ground-contact check (page/ground.js)
  if (!C.base || C.base.length !== C.chars.length * 4) C.base = new Float32Array(C.chars.length * 4);
  C.chars.forEach((ch, i) => {
    C.base[i * 4 + 3] = 0;
    const s = ch.slot, m = crowdMotion(action, t, s, { speed: opts.speed });
    // local (formation) -> world: rotate by yaw around the origin
    const lx = s.x + m.dx, lz = s.z + m.dz;
    const wx = origin.x + lx * cy + lz * sy, wz = origin.z - lx * sy + lz * cy;
    let wy = origin.y;
    if (surf) {
      const y = surf(wx, wz);
      if (y == null) { hide(P, i); if (P.pole) { if (ch.banner) P.flag.setMatrixAt(flagI++, ZERO); else P.tip.setMatrixAt(tipI++, ZERO); } return; }
      wy = y;
    }
    const k = ch.scale;
    C.base[i * 4] = wx; C.base[i * 4 + 1] = wy; C.base[i * 4 + 2] = wz; C.base[i * 4 + 3] = m.jump > 0.01 ? 0 : 1;
    // the body frame: position, heading, bob/jump, then everything in unscaled figure units
    _q.setFromAxisAngle(_up, yaw + m.yaw + (s.jitter - 0.5) * (action === "stand" || action === "cheer" ? 0.5 : 0.08));
    _b.compose(_v.set(wx, wy + (m.bob + m.jump) * k, wz), _q, _s.set(k, k, k));
    // hips (the lean pivots at the hip)
    _w.copy(_b).multiply(T(0, HIP, 0)).multiply(RX(m.lean));
    P.legL.setMatrixAt(i, _m.copy(_b).multiply(T(0.11, HIP, 0)).multiply(RX(m.legSwing)));
    P.legR.setMatrixAt(i, _m.copy(_b).multiply(T(-0.11, HIP, 0)).multiply(RX(-m.legSwing)));
    P.torso.setMatrixAt(i, _w);
    const head = _m.copy(_w).multiply(T(0, HEAD_Y - 0.16 + 0.07, 0)).multiply(RX(action === "cheer" ? -0.25 : action === "charge" ? -0.15 : 0));
    P.head.setMatrixAt(i, head); P.face.setMatrixAt(i, head);
    if (P.hair) P.hair.setMatrixAt(i, head);
    if (P.helmet) P.helmet.setMatrixAt(i, head);
    if (P.crest) P.crest.setMatrixAt(i, head);
    if (P.snout) { P.snout.setMatrixAt(i, head); P.earL.setMatrixAt(i, _a.copy(head).multiply(T(0.1, 0, 0))); P.earR.setMatrixAt(i, _a.copy(head).multiply(T(-0.1, 0, 0))); }
    // arms (the left holds the shield, the right the spear / banner); wave adds a side-to-side on the right forearm
    const armL = _a.copy(_w).multiply(T(SH_X, SH_Y, 0)).multiply(RX(m.armL));
    P.armL.setMatrixAt(i, armL);
    if (P.shield) { const sh = new THREE.Matrix4().copy(armL).multiply(T(0.1, -0.42, 0.06)).multiply(RX(-m.armL * 0.85)); P.shield.setMatrixAt(i, sh); P.boss.setMatrixAt(i, sh); }
    const armR = _a.copy(_w).multiply(T(-SH_X, SH_Y, 0)).multiply(RX(m.armR));
    if (m.wave) armR.multiply(_r.makeRotationZ(m.wave));
    P.armR.setMatrixAt(i, armR);
    if (P.pole) {
      // the hand, then cancel the arm's pitch (the weapon stays upright), then level it forward by m.weapon
      const w = new THREE.Matrix4().copy(armR).multiply(T(0, -0.6, 0.02)).multiply(RX(-m.armR - m.lean)).multiply(RX(m.weapon * 1.35));
      P.pole.setMatrixAt(i, w);
      if (ch.banner) P.flag.setMatrixAt(flagI++, w); else P.tip.setMatrixAt(tipI++, w);
    }
  });
  for (const im of Object.values(P)) im.instanceMatrix.needsUpdate = true;
}
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function hide(P, i) {
  for (const [k, im] of Object.entries(P)) { if (k === "tip" || k === "flag") continue; im.setMatrixAt(i, ZERO); }
}
/** the crowd's half extent (m) around its origin, for framing */
export const crowdExtent = (crowd) => crowd.userData.crowd.extent * SCALE;
