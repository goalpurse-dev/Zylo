// Blocky Worlds monsters, our own designs:
//   "tall"  ~4.6 m, a very thin dark figure with long dangling arms, a small head with two tall "listening" ear-vanes
//           lit from inside and two glowing eyes (spec.glow). Matte near-black so it reads as a silhouette at night.
//   "furry" ~2.6 m, wide and shaggy (offset blocky fur slabs, two-tone), small glowing eyes, big clawed hands.
// Origin at the feet, faces +z. animateMonster(m, "lurk"|"reach"|"reveal"|"flee", t) is deterministic in t.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { rng, rbx, bx, fabric, boxGeo } from "./kitCommon.js";

const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

function glowMat(color, k) {
  return new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: color, emissiveIntensity: k, roughness: 0.4 });
}

/** matte, low-specular (scene.environment would otherwise lift dark bodies to grey under a bright sky) */
const matte = (color, map = null, spec = 0.12) => new THREE.MeshPhysicalMaterial({ color, map, roughness: 1, metalness: 0, specularIntensity: spec });

// ---------------------------------------------------------------------------------------------- tall
function buildTall(g, glow, R, o = {}) {
  const body = o.body ?? matte("#0b0a0e", null, 0.08);
  const body2 = o.body2 ?? matte("#1a1720", null, 0.1);
  const legM = o.legs ?? body, torsoM = o.torso ?? body, armM = o.arms ?? body, headM = o.head ?? body;
  const eyeM = glowMat(glow, 3.4), vaneM = glowMat(glow, 2.4);
  const j = { glows: [{ m: eyeM, k: 3.4 }, { m: vaneM, k: 2.4 }], legs: { LT: 1.15, LS: 1.15 } };
  const rig = new THREE.Group(); g.add(rig); j.rig = rig;
  const pelvis = new THREE.Group(); pelvis.position.y = 2.3; rig.add(pelvis); j.pelvis = pelvis;
  rbx(0.34, 0.2, 0.2, 0.02, body, { y: 0.04, parent: pelvis });
  j.hip = []; j.knee = [];
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const h = new THREE.Group(); h.position.x = s * 0.12; pelvis.add(h);
    const k = new THREE.Group(); k.position.y = -1.15; h.add(k);
    rbx(0.13, 1.17, 0.14, 0.02, legM, { y: -0.575, parent: h });
    rbx(0.16, 0.12, 0.16, 0.03, body2, { y: 0, parent: k }); // knobbly knee
    rbx(0.11, 1.1, 0.12, 0.02, legM, { y: -0.55, parent: k });
    rbx(0.15, 0.06, 0.36, 0.02, body, { y: -1.12, z: 0.09, parent: k });
    j.hip[i] = h; j.knee[i] = k;
  }
  const spine = new THREE.Group(); spine.position.y = 0.12; pelvis.add(spine); j.spine = spine;
  rbx(0.26, 0.62, 0.17, 0.02, torsoM, { y: 0.31, parent: spine });
  rbx(0.42, 0.66, 0.2, 0.025, torsoM, { y: 0.92, parent: spine });
  rbx(0.56, 0.14, 0.24, 0.03, torsoM, { y: 1.22, parent: spine }); // high, shrugged shoulders
  // a ragged shroud of hanging strips, front and back, past the hips
  if (o.shroud !== false) for (const zs of [1, -1]) for (let k = 0; k < 5; k++) {
    const len = 0.95 + R() * 0.55, x = (k - 2) * 0.085;
    rbx(0.075, len, 0.018, 0.005, k % 2 ? body2 : body, { x, y: 1.18 - len / 2, z: zs * (0.11 + k * 0.004), rx: zs * 0.06, rz: (R() - 0.5) * 0.08, parent: spine });
  }
  j.sh = []; j.el = []; j.hand = []; j.fingers = [];
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const a = new THREE.Group(); a.position.set(s * 0.29, 1.24, 0); spine.add(a);
    rbx(0.13, 0.1, 0.13, 0.02, body2, { parent: a });
    const e = new THREE.Group(); e.position.y = -1.0; a.add(e);
    rbx(0.09, 1.02, 0.1, 0.015, armM, { y: -0.5, parent: a });
    rbx(0.08, 0.96, 0.09, 0.015, armM, { y: -0.48, parent: e });
    const hd = new THREE.Group(); hd.position.y = -0.96; e.add(hd);
    rbx(0.11, 0.2, 0.05, 0.01, body, { y: -0.1, parent: hd });
    const fs = [];
    for (let f = 0; f < 3; f++) {
      const fp = new THREE.Group(); fp.position.set((f - 1) * 0.035, -0.19, 0); hd.add(fp);
      rbx(0.024, 0.26, 0.026, 0.006, body, { y: -0.13, parent: fp });
      fs.push(fp);
    }
    j.sh[i] = a; j.el[i] = e; j.hand[i] = hd; j.fingers[i] = fs;
  }
  const neck = new THREE.Group(); neck.position.y = 1.24; spine.add(neck); j.neck = neck;
  rbx(0.07, 0.34, 0.07, 0.01, body, { y: 0.17, parent: neck });
  const head = new THREE.Group(); head.position.y = 0.32; neck.add(head); j.head = head;
  rbx(0.26, 0.3, 0.24, 0.02, headM, { y: 0.15, parent: head });
  if (o.jaw !== false) rbx(0.2, 0.07, 0.12, 0.02, headM, { y: 0.05, z: 0.13, parent: head }); // a jutting jaw
  for (const s of [-1, 1]) {
    if (o.eyes !== false) bx(0.055, 0.032, 0.02, eyeM, { x: s * 0.058, y: 0.19, z: 0.122, parent: head, shadow: false });
    if (o.vanes === false) continue;
    // ear-vanes: tall thin slabs angled out, a lit slit inside each
    const v = new THREE.Group(); v.position.set(s * 0.13, 0.22, -0.02); v.rotation.z = -s * 0.35; head.add(v);
    rbx(0.045, 0.56, 0.24, 0.01, body, { y: 0.28, parent: v });
    bx(0.012, 0.42, 0.06, vaneM, { x: -s * 0.024, y: 0.3, z: 0.04, parent: v, shadow: false });
  }
  j.hunch = o.hunch ?? 0.32;
  j.eyeM = eyeM;
  return j;
}

// ---------------------------------------------------------------------------------------------- furry
/** shaggy shell: offset fur slabs on the 4 sides + top of a box, merged into two geometries (dark, light) */
function furShell(w, h, d, R, { step = 0.13, slab = [0.15, 0.34, 0.04], top = true, cy = 0, front = true } = {}) {
  const dark = [], light = [], q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e = new THREE.Euler(), m = new THREE.Matrix4(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), Z = new THREE.Vector3(0, 0, 1);
  const faces = [[0, 0, 1, w, h, d], [0, 0, -1, w, h, d], [1, 0, 0, d, h, w], [-1, 0, 0, d, h, w]];
  for (const [nx, , nz, fw, fh, depth] of faces) {
    if (!front && nz === 1) continue;
    const n = new THREE.Vector3(nx, 0, nz); q.setFromUnitVectors(Z, n);
    const tan = new THREE.Vector3(nz !== 0 ? nz : 0, 0, nx !== 0 ? -nx : 0); // along the face
    for (let y = fh / 2 - 0.05; y > -fh / 2; y -= step) {
      for (let u = -fw / 2 + 0.08; u <= fw / 2 - 0.02; u += step * 1.1) {
        const sw = slab[0] * (0.8 + R() * 0.5), sh = slab[1] * (0.8 + R() * 0.5);
        const geo = boxGeo(sw, sh, slab[2]).clone();
        e.set(-0.3 - R() * 0.25, 0, (R() - 0.5) * 0.35); q2.setFromEuler(e);
        p.copy(n).multiplyScalar(depth / 2 + 0.01 + R() * 0.04).addScaledVector(tan, u + (R() - 0.5) * 0.06); p.y = cy + y - sh * 0.3 + (R() - 0.5) * 0.05;
        m.compose(p, q.clone().multiply(q2), sc); geo.applyMatrix4(m);
        (R() < 0.33 ? light : dark).push(geo);
      }
    }
  }
  if (top) for (let x = -w / 2 + 0.1; x < w / 2; x += step * 1.2) for (let z = -d / 2 + 0.1; z < d / 2; z += step * 1.2) {
    const geo = boxGeo(slab[0] * (0.8 + R() * 0.4), slab[2] * 1.5, slab[0] * (0.8 + R() * 0.4)).clone();
    e.set((R() - 0.5) * 0.5, R() * 3, (R() - 0.5) * 0.5); m.compose(p.set(x, cy + h / 2 + 0.02 + R() * 0.04, z), q2.setFromEuler(e), sc); geo.applyMatrix4(m);
    (R() < 0.45 ? light : dark).push(geo);
  }
  return [dark.length ? mergeGeometries(dark) : null, light.length ? mergeGeometries(light) : null];
}
function furMesh(parent, shell, matD, matL, pos = [0, 0, 0]) {
  for (const [geo, mat] of [[shell[0], matD], [shell[1], matL]]) if (geo) { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.castShadow = m.receiveShadow = true; parent.add(m); }
}
function buildFurry(g, glow, R, o = {}) {
  const core = matte(o.core ?? "#1d1714");
  const furD = matte("#ffffff", fabric(o.furD ?? "#2b2420", "cotton").map, 0.15), furL = matte("#ffffff", fabric(o.furL ?? "#4f4034", "cotton").map, 0.15);
  const furMeshO = (parent, shell, a, b, pos) => { if (o.fur !== false) furMesh(parent, shell, a, b, pos); };
  const claw = new THREE.MeshStandardMaterial({ color: "#e8e0cc", roughness: 0.5 });
  const eyeM = glowMat(glow, 3.6);
  const j = { glows: [{ m: eyeM, k: 3.6 }], legs: { LT: 0.4, LS: 0.42 } };
  const rig = new THREE.Group(); g.add(rig); j.rig = rig;
  const pelvis = new THREE.Group(); pelvis.position.y = 0.82; rig.add(pelvis); j.pelvis = pelvis;
  j.hip = []; j.knee = [];
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const h = new THREE.Group(); h.position.x = s * 0.36; pelvis.add(h);
    const k = new THREE.Group(); k.position.y = -0.4; h.add(k);
    rbx(0.4, 0.44, 0.42, 0.04, core, { y: -0.2, parent: h });
    furMeshO(h, furShell(0.4, 0.42, 0.42, R, { top: false, slab: [0.18, 0.26, 0.05] }), furD, furL, [0, -0.2, 0]);
    rbx(0.36, 0.36, 0.38, 0.04, core, { y: -0.18, parent: k });
    rbx(0.44, 0.1, 0.6, 0.03, core, { y: -0.37, z: 0.08, parent: k });
    for (let c = 0; c < 3; c++) rbx(0.07, 0.06, 0.1, 0.01, claw, { x: (c - 1) * 0.13, y: -0.39, z: 0.41, parent: k });
    j.hip[i] = h; j.knee[i] = k;
  }
  const spine = new THREE.Group(); spine.position.y = 0.05; pelvis.add(spine); j.spine = spine;
  rbx(1.25, 1.2, 0.85, 0.08, core, { y: 0.6, parent: spine });
  furMeshO(spine, furShell(1.25, 1.2, 0.85, R), furD, furL, [0, 0.6, 0]);
  const head = new THREE.Group(); head.position.set(0, 1.2, 0.12); spine.add(head); j.head = head; j.neck = null;
  rbx(0.78, 0.55, 0.62, 0.08, core, { y: 0.24, parent: head });
  furMeshO(head, furShell(0.78, 0.5, 0.62, R, { slab: [0.13, 0.26, 0.04], step: 0.12, front: false }), furD, furL, [0, 0.26, 0]);
  const facePlate = matte(o.face ?? "#120d0b");
  rbx(0.6, 0.44, 0.06, 0.02, facePlate, { y: 0.2, z: 0.32, parent: head });
  rbx(0.7, 0.12, 0.16, 0.03, furL, { y: 0.39, z: 0.33, rx: 0.15, parent: head }); // the shaggy brow
  rbx(0.34, 0.14, 0.12, 0.03, core, { y: 0.06, z: 0.37, parent: head }); // snout
  for (const s of [-1, 1]) {
    bx(0.1, 0.06, 0.03, eyeM, { x: s * 0.15, y: 0.27, z: 0.355, parent: head, shadow: false });
    bx(0.05, 0.08, 0.05, claw, { x: s * 0.12, y: -0.02, z: 0.4, parent: head }); // two little tusks
  }
  j.sh = []; j.el = []; j.hand = []; j.fingers = [];
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const a = new THREE.Group(); a.position.set(s * 0.74, 1.02, 0); spine.add(a);
    const e = new THREE.Group(); e.position.y = -0.62; a.add(e);
    rbx(0.3, 0.64, 0.32, 0.04, core, { y: -0.3, parent: a });
    furMeshO(a, furShell(0.3, 0.62, 0.32, R, { slab: [0.16, 0.26, 0.05], step: 0.15 }), furD, furL, [0, -0.3, 0]);
    rbx(0.28, 0.6, 0.3, 0.04, core, { y: -0.3, parent: e });
    furMeshO(e, furShell(0.28, 0.55, 0.3, R, { top: false, slab: [0.15, 0.24, 0.05], step: 0.15 }), furD, furL, [0, -0.28, 0]);
    const hd = new THREE.Group(); hd.position.y = -0.62; e.add(hd);
    rbx(0.42, 0.36, 0.34, 0.06, core, { y: -0.16, parent: hd });
    const fs = [];
    for (let f = 0; f < 3; f++) {
      const fp = new THREE.Group(); fp.position.set((f - 1) * 0.13, -0.32, 0.06); hd.add(fp);
      rbx(0.1, 0.16, 0.12, 0.02, core, { y: -0.07, parent: fp });
      rbx(0.06, 0.1, 0.07, 0.01, claw, { y: -0.18, z: 0.02, rx: 0.3, parent: fp });
      fs.push(fp);
    }
    j.sh[i] = a; j.el[i] = e; j.hand[i] = hd; j.fingers[i] = fs;
  }
  j.hunch = o.hunch ?? 0.16;
  j.eyeM = eyeM; j.core = core;
  return j;
}

/** { type: "tall" | "furry", name, glow: css colour } -> Group, origin at the feet, facing +z */
export function makeMonster(spec = {}) {
  const look = VARIANTS[spec.variant] ? spec.variant : null;
  const type = look ? VARIANTS[look].base : spec.type === "furry" ? "furry" : "tall";
  const glow = spec.glow || (type === "tall" ? "#9be8ff" : "#ffb03b");
  const g = new THREE.Group(); g.name = `monster:${look ?? type}`;
  const R = rng(type === "tall" ? 41 : 77);
  const j = look ? VARIANTS[look].build(g, glow, R, String(spec.species ?? "").toLowerCase()) : type === "tall" ? buildTall(g, glow, R) : buildFurry(g, glow, R);
  if (look && VARIANTS[look].scale) g.children[0].scale.setScalar(VARIANTS[look].scale);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  g.userData = { kind: "monster", type, variant: look, name: spec.name, glow, joints: j, height: box.max.y, float: j.float ?? 0 };
  animateMonster(g, "lurk", 0);
  return g;
}
export const monsterHeight = (m) => m.userData.height;

/** poses the monster for state at shot-local time t: lurk | reach | reveal | flee (deterministic, no allocations) */
export function animateMonster(m, state = "lurk", t = 0) {
  const u = m.userData, j = u.joints, tall = u.type === "tall", H = j.hunch;
  j.rig.position.set(0, 0, 0); j.rig.rotation.set(0, 0, 0);
  j.spine.rotation.set(H, 0, 0);
  j.head.rotation.set(-H * 0.7, 0, 0);
  if (j.neck) j.neck.rotation.set(0.25, 0, 0);
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    j.sh[i].rotation.set(-H * 0.6, 0, s * 0.05); j.el[i].rotation.set(-0.12, 0, 0); j.hand[i].rotation.set(0, 0, 0);
    j.hip[i].rotation.set(-0.08, 0, 0); j.knee[i].rotation.set(0.16, 0, 0);
    const fs = j.fingers[i]; for (let f = 0; f < fs.length; f++) fs[f].rotation.set(-0.25, 0, (f - 1) * 0.08);
  }
  let glowK = 1;
  switch (state) {
    case "reach": {
      const k = smooth(0, 2.6, t), sway = Math.sin(TAU * 0.23 * t);
      j.sh[0].rotation.set(-0.15 - (tall ? 1.35 : 1.2) * k, 0.1 * k, -0.05);
      j.el[0].rotation.x = -0.25 * (1 - k);
      for (let f = 0; f < 3; f++) j.fingers[0][f].rotation.set(-0.25 + 0.15 * k + 0.05 * Math.sin(TAU * 0.7 * t + f), 0, (f - 1) * 0.4 * k);
      j.spine.rotation.x = H + 0.12 * k; j.spine.rotation.y = 0.12 * k;
      j.head.rotation.z = 0.18; j.head.rotation.x += 0.1 * k;
      j.sh[1].rotation.x += 0.05 * sway;
      glowK = 1 + 0.4 * k;
      break;
    }
    case "reveal": {
      const k = smooth(0, 1.4, t), heave = 0.03 * Math.sin(TAU * 0.8 * t) * k;
      j.spine.rotation.x = H * (1 - k) - 0.06 * k + heave;
      j.head.rotation.x = -H * 0.7 * (1 - k) + (tall ? 0.18 : 0.05) * k;
      if (j.neck) j.neck.rotation.x = 0.25 * (1 - k) + 0.05 * k;
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        j.sh[i].rotation.set(-H * 0.6 * (1 - k) - (tall ? 0.1 : 0.35) * k, 0, s * (0.05 + (tall ? 0.32 : 0.85) * k));
        j.el[i].rotation.x = -0.12 - (tall ? 0.1 : 0.5) * k;
        for (let f = 0; f < 3; f++) j.fingers[i][f].rotation.set(-0.25 + 0.2 * k, 0, (f - 1) * 0.35 * k);
        j.hip[i].rotation.x = -0.08 * (1 - k); j.knee[i].rotation.x = 0.16 * (1 - k);
      }
      glowK = 1 + 1.2 * k;
      break;
    }
    case "flee": {
      const k = smooth(0, 0.8, t), ph = TAU * 1.3 * t, sn = Math.sin(ph), cs = Math.cos(ph);
      j.rig.rotation.y = Math.PI * 0.85 * k;
      j.spine.rotation.x = H + 0.25 * k;
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1, sw = (i ? -1 : 1) * sn;
        j.hip[i].rotation.x = -0.08 + 0.45 * k * sw; j.knee[i].rotation.x = 0.16 + 0.7 * k * Math.max(0, (i ? 1 : -1) * cs);
        j.sh[i].rotation.set(-H * 0.6 + 0.45 * k - 0.3 * k * sw, 0, s * 0.12);
      }
      glowK = 1 - 0.3 * k;
      break;
    }
    default: { // lurk: still, a slight sway, the head tilting
      const sway = Math.sin(TAU * 0.23 * t);
      j.rig.rotation.z = 0.022 * sway; j.spine.rotation.z = -0.02 * sway;
      j.head.rotation.z = (tall ? 0.3 : 0.14) + 0.06 * Math.sin(TAU * 0.31 * t);
      j.head.rotation.y = 0.08 * Math.sin(TAU * 0.13 * t);
      for (let i = 0; i < 2; i++) { j.sh[i].rotation.x += 0.05 * Math.sin(TAU * 0.4 * t + i * 1.7); j.el[i].rotation.x -= 0.04 * (1 + Math.sin(TAU * 0.33 * t + i)); }
      glowK = 1 + 0.08 * Math.sin(TAU * 0.5 * t);
    }
  }
  if (j.wave) j.wave(state, t);
  // plant the lowest foot
  const { LT, LS } = j.legs;
  const h0 = j.hip[0].rotation.x, h1 = j.hip[1].rotation.x;
  j.rig.position.y += Math.max(LT * Math.cos(h0) + LS * Math.cos(h0 + j.knee[0].rotation.x), LT * Math.cos(h1) + LS * Math.cos(h1 + j.knee[1].rotation.x)) - (LT + LS);
  if (j.float) j.rig.position.y += j.float + 0.12 * Math.sin(TAU * 0.4 * t);
  for (let q = 0; q < j.glows.length; q++) j.glows[q].m.emissiveIntensity = j.glows[q].k * glowK;
}

// ---------------------------------------------------------------------------------------------- creature looks
// (coverage kit, 2026-11-04) The library names its monsters: a Detention Dragon, a Fountain Pigeon, a Rumble Worm, a
// Toll Troll... Each look dresses one of the two rigs (so animateMonster drives it unchanged) or builds a rig with the
// same joints. spec.variant picks the look (plan.mjs, from the name), spec.species the very creature (goat / moose...).
const sm = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
const sph = (r, a = 14, b = 10) => new THREE.SphereGeometry(r, a, b);
const cone = (r, h, s = 10) => new THREE.ConeGeometry(r, h, s);
const add = (geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, parent }) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
const bigEyes = (j, head, glow, { y = 0.25, z = 0.33, x = 0.15, s = 0.1 } = {}) => { for (const k of [-1, 1]) { add(sph(s), sm("#ffffff", { emissive: glow, emissiveIntensity: 0.6 }), { x: k * x, y, z, parent: head }); add(sph(s * 0.5), sm("#111", {}), { x: k * x, y, z: z + s * 0.75, parent: head }); } };
/** dummy joints for rigs that have no arms / legs of their own (serpent, squid, fish) */
function dummyJoints(rig, n = 3) {
  const G = () => { const q = new THREE.Group(); rig.add(q); return q; };
  return { sh: [G(), G()], el: [G(), G()], hand: [G(), G()], fingers: [[...Array(n)].map(G), [...Array(n)].map(G)], hip: [G(), G()], knee: [G(), G()], legs: { LT: 0, LS: 0 } };
}

const SPECIES_LOOK = {
  goat: { fur: ["#e9e3d6", "#ffffff"], horns: "curl", snout: "#f5efe4" }, moose: { fur: ["#4a3220", "#6b4a30"], antlers: true, snout: "#6b4a30" },
  bear: { fur: ["#5a3a20", "#7a5230"], ears: "round", snout: "#a87a4f" }, hog: { fur: ["#e89aa8", "#f5b5c2"], ears: "point", snout: "#ff8fa8", tusks: true },
  pig: { fur: ["#e89aa8", "#f5b5c2"], ears: "point", snout: "#ff8fa8" }, cat: { fur: ["#e8781e", "#f5a04a"], ears: "point", snout: "#ffe1c2", whiskers: true },
  wolf: { fur: ["#5d636b", "#8a9099"], ears: "point", snout: "#c9ced4" }, dog: { fur: ["#9a6a3a", "#c58b4f"], ears: "point", snout: "#f1d6b0" },
  frog: { fur: ["#3f9a3f", "#5fbf4f"], frog: true }, horse: { fur: ["#f2f2f2", "#ffffff"], ears: "point", snout: "#ffffff", horn: true },
  bull: { fur: ["#3a2a20", "#5a3d2b"], horns: "small", snout: "#7a5230" }, ram: { fur: ["#e9e3d6", "#ffffff"], horns: "curl", snout: "#f5efe4" },
};
const BOXY = { refrigerator: ["#eef1f4", "FRIDGE"], fridge: ["#eef1f4", "FRIDGE"], mailbox: ["#2e5fd6", "MAIL"], vacuum: ["#d63031", ""], eraser: ["#ff9fb2", ""], drum: ["#c0392b", ""], clock: ["#8a5a32", ""], stomach: ["#ff8fa8", ""], mural: ["#f3e7c9", ""] };

export const VARIANTS = {
  dragon: { base: "furry", build(g, glow, R) {
    const j = buildFurry(g, glow, R, { core: "#1f5c2e", furD: "#2f8a3e", furL: "#57b84a", face: "#1f5c2e" });
    const belly = sm("#e8d27a"), horn = sm("#f2ead8"), wing = sm("#2f8a3e", { side: THREE.DoubleSide });
    rbx(0.8, 0.9, 0.1, 0.05, belly, { y: 0.55, z: 0.45, parent: j.spine });
    rbx(0.5, 0.3, 0.45, 0.06, j.core, { y: 0.15, z: 0.55, parent: j.head }); // the snout
    for (const s of [-1, 1]) { add(cone(0.07, 0.4), horn, { x: s * 0.25, y: 0.62, z: -0.05, rx: -0.5, rz: -s * 0.3, parent: j.head }); add(sph(0.04), sm("#111"), { x: s * 0.1, y: 0.22, z: 0.78, parent: j.head }); }
    for (let k = 0; k < 4; k++) add(cone(0.06, 0.12, 4), horn, { x: (k - 1.5) * 0.1, y: 0.0, z: 0.72, rx: Math.PI, parent: j.head });
    for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.45, 1.0, -0.4); w.rotation.set(0.2, -s * 0.5, s * 0.5); j.spine.add(w); const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(s * 1.6, 0.9), new THREE.Vector2(s * 1.4, 0.1), new THREE.Vector2(s * 1.1, -0.2), new THREE.Vector2(s * 0.6, -0.3)]); add(new THREE.ShapeGeometry(sh), wing, { parent: w }); bx(0.06, 0.06, 1.85, horn, { x: s * 0.8, y: 0.45, rx: 0, ry: Math.PI / 2 - s * 0.55, parent: w }); }
    let prev = j.pelvis; for (let k = 0; k < 5; k++) { const t = new THREE.Group(); t.position.set(0, k ? 0 : 0.1, k ? -0.32 : -0.4); t.rotation.x = 0.25; prev.add(t); rbx(0.4 - k * 0.06, 0.32 - k * 0.04, 0.4, 0.05, j.core, { z: -0.15, parent: t }); add(cone(0.06, 0.15, 4), horn, { y: 0.2 - k * 0.02, z: -0.15, parent: t }); prev = t; }
    return j;
  } },
  yeti: { base: "furry", build(g, glow, R) { const j = buildFurry(g, glow, R, { core: "#cfd8e3", furD: "#e9eef4", furL: "#ffffff", face: "#7fa3c7" }); for (const s of [-1, 1]) add(cone(0.06, 0.18), sm("#ffffff"), { x: s * 0.12, y: -0.05, z: 0.42, rx: Math.PI, parent: j.head }); return j; } },
  troll: { base: "furry", build(g, glow, R) { const j = buildFurry(g, glow, R, { core: "#5f7a4a", furD: "#4b6a3a", furL: "#7a9a5a", face: "#6f8f55" }); add(sph(0.14), sm("#7f9f62"), { y: 0.18, z: 0.45, parent: j.head }).scale.set(1, 0.8, 1.4); for (const s of [-1, 1]) add(cone(0.07, 0.35, 6), sm("#7f9f62"), { x: s * 0.48, y: 0.3, rz: s * 1.3, parent: j.head }); rbx(1.3, 0.25, 0.9, 0.05, sm("#7a5230"), { y: 0.0, parent: j.spine }); return j; } },
  stump: { base: "furry", build(g, glow, R) {
    const j = buildFurry(g, glow, R, { core: "#5a3d24", furD: "#4a3220", furL: "#6b4a30", face: "#3a2614" });
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 18), sm("#d9b27c"), { y: 0.68, parent: j.head });
    for (let k = 0; k < 6; k++) add(sph(0.18), sm(k % 2 ? "#3f9a3f" : "#5fbf4f"), { x: Math.cos(k) * 0.35, y: 0.75, z: Math.sin(k) * 0.3, parent: j.head });
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) bx(0.06, 0.35, 0.06, sm("#4a3220"), { x: s * 0.1 * k, y: -0.75, z: 0.05, rz: s * 0.4 * (k + 1), parent: j.hand[s < 0 ? 0 : 1] });
    return j;
  } },
  beast: { base: "furry", build(g, glow, R, species) {
    const L = SPECIES_LOOK[species] ?? SPECIES_LOOK.bear;
    const j = buildFurry(g, glow, R, { core: L.fur[0], furD: L.fur[0], furL: L.fur[1], face: L.fur[0] });
    const head = j.head, snoutM = sm(L.snout ?? L.fur[1]);
    if (L.frog) { add(sph(0.45), sm(L.fur[1]), { y: 0.15, z: 0.25, parent: head }).scale.set(1.3, 0.6, 1); for (const s of [-1, 1]) { add(sph(0.16), sm(L.fur[1]), { x: s * 0.25, y: 0.55, z: 0.15, parent: head }); add(sph(0.1), sm("#fff4a0", { emissive: glow, emissiveIntensity: 0.8 }), { x: s * 0.25, y: 0.58, z: 0.28, parent: head }); } return j; }
    rbx(0.4, 0.28, 0.35, 0.06, snoutM, { y: 0.1, z: 0.45, parent: head });
    bx(0.14, 0.08, 0.04, sm("#1b1b1f"), { y: 0.18, z: 0.63, parent: head });
    for (const s of [-1, 1]) {
      if (L.ears === "point") add(cone(0.12, 0.3, 4), sm(L.fur[0]), { x: s * 0.28, y: 0.62, parent: head });
      if (L.ears === "round") add(sph(0.14), sm(L.fur[0]), { x: s * 0.33, y: 0.55, parent: head }).scale.set(1, 1, 0.5);
      if (L.horns === "curl") add(new THREE.TorusGeometry(0.2, 0.06, 6, 12, Math.PI * 1.4), sm("#a8987a"), { x: s * 0.35, y: 0.55, ry: Math.PI / 2, parent: head });
      if (L.horns === "small") add(cone(0.07, 0.35, 6), sm("#f2ead8"), { x: s * 0.42, y: 0.5, rz: -s * 1.0, parent: head });
      if (L.tusks) add(cone(0.04, 0.16, 6), sm("#fffbe6"), { x: s * 0.14, y: 0.05, z: 0.6, rz: Math.PI, parent: head });
      if (L.whiskers) for (const r of [-0.15, 0.15]) bx(0.5, 0.012, 0.012, sm("#ffffff"), { x: s * 0.35, y: 0.08, z: 0.6, rz: r, parent: head });
      if (L.antlers) { const a = new THREE.Group(); a.position.set(s * 0.32, 0.55, 0); a.rotation.z = -s * 0.5; head.add(a); const m = sm("#d9c49a"); bx(0.1, 0.5, 0.1, m, { y: 0.25, parent: a }); rbx(0.25, 0.08, 0.9, 0.02, m, { y: 0.55, z: -0.1, rx: 0, rz: 0, parent: a }); bx(0.9, 0.08, 0.25, m, { x: s * 0.35, y: 0.6, parent: a }); for (let k = 0; k < 4; k++) bx(0.07, 0.3, 0.07, m, { x: s * (0.1 + k * 0.2), y: 0.78, parent: a }); }
    }
    if (L.horn) add(cone(0.08, 0.6, 8), sm("#ffe08a", { emissive: "#ffd23a", emissiveIntensity: 0.6 }), { y: 0.8, z: 0.2, rx: 0.3, parent: head });
    if (L.horns === "curl" && species === "goat") add(cone(0.1, 0.3, 6), sm("#ffffff"), { y: -0.2, z: 0.45, rx: Math.PI, parent: head });
    return j;
  } },
  boxy: { base: "furry", build(g, glow, R, species) {
    const [col, word] = BOXY[species] ?? ["#8e7cc3", ""];
    const j = buildFurry(g, glow, R, { core: col, fur: false, face: darker(col) });
    const body = sm(col, { roughness: 0.35 });
    rbx(1.5, 1.9, 1.0, 0.08, body, { y: 0.7, parent: j.spine });
    if (species === "mailbox") { add(new THREE.CylinderGeometry(0.75, 0.75, 1.0, 20), body, { y: 1.65, rx: Math.PI / 2, parent: j.spine }); bx(0.06, 0.8, 0.06, sm("#d32f2f"), { x: 0.8, y: 1.6, parent: j.spine }); bx(0.06, 0.25, 0.35, sm("#e53935"), { x: 0.8, y: 1.9, z: 0.15, parent: j.spine }); }
    if (species === "refrigerator" || species === "fridge") { bx(1.5, 0.04, 1.02, sm("#c8ced4"), { y: 1.2, parent: j.spine }); bx(0.06, 0.6, 0.08, sm("#b8c0c8", { metalness: 0.8 }), { x: 0.6, y: 0.75, z: 0.52, parent: j.spine }); }
    if (species === "vacuum") { add(new THREE.TorusGeometry(0.5, 0.08, 8, 20, Math.PI * 1.2), sm("#333"), { x: 0.6, y: 1.6, z: 0.3, parent: j.spine }); }
    if (species === "drum") { add(new THREE.CylinderGeometry(0.8, 0.8, 1.9, 20), body, { y: 0.7, parent: j.spine }); for (let k = 0; k < 6; k++) bx(0.04, 1.8, 0.04, sm("#f2ead8"), { x: Math.cos(k) * 0.81, y: 0.7, z: Math.sin(k) * 0.81, parent: j.spine }); }
    if (word) { const c = document.createElement("canvas"); c.width = 256; c.height = 96; const q = c.getContext("2d"); q.fillStyle = "#ffffff"; q.font = "bold 70px sans-serif"; q.textAlign = "center"; q.fillText(word, 128, 72); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; add(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: t, transparent: true }), { y: 0.3, z: 0.52, parent: j.spine }); }
    // a mouth with teeth on the front
    rbx(0.9, 0.22, 0.04, 0.05, sm("#2a0d12"), { y: 1.0, z: 0.51, parent: j.spine });
    for (let k = 0; k < 5; k++) add(cone(0.05, 0.12, 4), sm("#ffffff"), { x: -0.36 + k * 0.18, y: 1.08, z: 0.53, rx: Math.PI, parent: j.spine });
    j.head.visible = false; bigEyes(j, j.spine, glow, { y: 1.45, z: 0.52, x: 0.3, s: 0.16 });
    return j;
  } },
  bird: { base: "tall", build(g, glow, R, species) {
    const pal = { goose: ["#fbfbf8", "#e9e3d6", "#ff8f1a"], pigeon: ["#8d96a3", "#6b7685", "#ffb400"], crow: ["#22232a", "#33343c", "#3b3b3b"], raven: ["#22232a", "#33343c", "#3b3b3b"], owl: ["#8a5a32", "#a87a4f", "#ffb400"], moth: ["#cdb88f", "#a8916a", "#5a4a3a"], bat: ["#3b3442", "#4a4252", "#3b3442"] }[species] ?? ["#8d96a3", "#6b7685", "#ffb400"];
    const body = sm(pal[0], { roughness: 0.85 }), dark = sm(pal[1], { roughness: 0.85 });
    const j = buildTall(g, glow, R, { body: dark, body2: dark, legs: sm(pal[2]), torso: body, arms: dark, head: body, shroud: false, vanes: false, jaw: false, hunch: 0.15 });
    const b = add(sph(0.75, 18, 14), body, { y: 0.75, parent: j.spine }); b.scale.set(1, 1.15, 0.95);
    if (species === "pigeon") add(new THREE.TorusGeometry(0.42, 0.12, 8, 18), sm("#5aa874", { emissive: "#3a7a5a", emissiveIntensity: 0.2 }), { y: 1.38, rx: Math.PI / 2, parent: j.spine });
    add(sph(0.35, 16, 12), body, { y: 0.15, parent: j.head });
    add(cone(0.1, 0.35, 8), sm(pal[2]), { y: 0.1, z: 0.42, rx: Math.PI / 2, parent: j.head });
    for (const i of [0, 1]) { const s = i ? 1 : -1; const w = add(new THREE.BoxGeometry(0.2, 1.7, 0.7), dark, { x: s * 0.12, y: -0.8, parent: j.sh[i] }); w.scale.set(1, 1, 1); if (species === "moth") add(sph(0.7, 14, 10), dark, { x: s * 0.6, y: -0.4, parent: j.sh[i] }).scale.set(1, 1.2, 0.08); }
    if (species === "moth") for (const s of [-1, 1]) bx(0.03, 0.6, 0.03, dark, { x: s * 0.12, y: 0.65, z: 0.15, rz: -s * 0.4, parent: j.head });
    bigEyes(j, j.head, glow, { y: 0.25, z: 0.26, x: 0.17, s: 0.09 });
    return j;
  } },
  ghost: { base: "tall", build(g, glow, R) {
    const pale = sm("#eef3ff", { transparent: true, opacity: 0.82, emissive: "#9fb8ff", emissiveIntensity: 0.25, roughness: 0.9 });
    const j = buildTall(g, glow, R, { body: pale, body2: pale, shroud: true, vanes: false, jaw: false, hunch: 0.12 });
    j.hip.forEach((h) => (h.visible = false));
    const sheet = add(new THREE.CylinderGeometry(0.35, 0.9, 2.4, 18, 1, true), pale, { y: -0.6, parent: j.spine }); sheet.material.side = THREE.DoubleSide;
    add(sph(0.36, 18, 14), pale, { y: 1.55, parent: j.spine });
    for (const s of [-1, 1]) add(sph(0.08), sm("#111", { emissive: glow, emissiveIntensity: 1.5 }), { x: s * 0.13, y: 1.6, z: 0.3, parent: j.spine });
    j.head.visible = false; j.float = 0.4;
    return j;
  } },
  goblin: { base: "tall", scale: 0.55, build(g, glow, R) {
    const skin = sm("#6fbf4a"), rag = sm("#6b4a30", { roughness: 0.95 });
    const j = buildTall(g, glow, R, { body: skin, body2: skin, legs: skin, torso: rag, arms: skin, head: skin, shroud: true, vanes: false, jaw: false, hunch: 0.35 });
    add(sph(0.3, 16, 12), skin, { y: 0.18, parent: j.head }).scale.set(1.2, 1, 1);
    for (const s of [-1, 1]) add(cone(0.1, 0.6, 6), skin, { x: s * 0.45, y: 0.25, rz: s * 1.25, parent: j.head });
    add(cone(0.06, 0.2, 6), skin, { y: 0.1, z: 0.38, rx: Math.PI / 2, parent: j.head });
    bigEyes(j, j.head, glow, { y: 0.28, z: 0.26, x: 0.14, s: 0.1 });
    for (let k = 0; k < 3; k++) add(cone(0.03, 0.08, 4), sm("#fffbe6"), { x: -0.08 + k * 0.08, y: 0.0, z: 0.3, rx: Math.PI, parent: j.head });
    return j;
  } },
  giant: { base: "tall", build(g, glow, R) {
    const skin = sm("#e0ac7e"), shirt = fabric("#3a7bd5", "plaid"), jeans = fabric("#2f4f86", "denim");
    const j = buildTall(g, glow, R, { body: skin, body2: shirt, legs: jeans, torso: shirt, arms: shirt, head: skin, shroud: false, vanes: false, eyes: false, hunch: 0.12 });
    rbx(0.75, 0.75, 0.25, 0.05, shirt, { y: 0.8, parent: j.spine });
    add(sph(0.3, 16, 12), skin, { y: 0.2, parent: j.head }).scale.set(1.1, 1.2, 1);
    rbx(0.5, 0.35, 0.3, 0.1, sm("#7a5230"), { y: -0.02, z: 0.12, parent: j.head }); // the beard
    rbx(0.56, 0.18, 0.55, 0.06, sm("#7a5230"), { y: 0.5, parent: j.head }); // hair
    for (const s of [-1, 1]) { add(sph(0.05), sm("#ffffff"), { x: s * 0.12, y: 0.28, z: 0.3, parent: j.head }); add(sph(0.03), sm("#1b1b1f"), { x: s * 0.12, y: 0.28, z: 0.34, parent: j.head }); }
    return j;
  } },
  scarecrow: { base: "tall", build(g, glow, R) {
    const sack = fabric("#c9a66b", "denim"), shirt = fabric("#c0392b", "plaid"), straw = sm("#e3b94f", { roughness: 0.95 });
    const j = buildTall(g, glow, R, { body: straw, body2: straw, legs: fabric("#3b5b8f", "denim"), torso: shirt, arms: shirt, head: sack, shroud: false, vanes: false, jaw: false, hunch: 0.25 });
    add(sph(0.3, 16, 12), sack, { y: 0.18, parent: j.head });
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 20), straw, { y: 0.42, parent: j.head }); add(new THREE.CylinderGeometry(0.25, 0.3, 0.3, 16), straw, { y: 0.58, parent: j.head });
    for (let k = 0; k < 5; k++) bx(0.03, 0.03, 0.02, sm("#1b1b1f"), { x: -0.12 + k * 0.06, y: 0.02, z: 0.29, rz: k % 2 ? 0.5 : -0.5, parent: j.head });
    for (const i of [0, 1]) for (let k = 0; k < 4; k++) bx(0.03, 0.2, 0.03, straw, { x: (k - 1.5) * 0.04, y: -0.25, rz: (k - 1.5) * 0.3, parent: j.hand[i] });
    return j;
  } },
  mannequin: { base: "tall", build(g, glow, R) { const m = sm("#e8dcc8", { roughness: 0.35 }); const j = buildTall(g, glow, R, { body: m, body2: m, shroud: false, vanes: false, jaw: false, hunch: 0.05 }); add(sph(0.22, 18, 14), m, { y: 0.17, parent: j.head }).scale.set(0.9, 1.25, 1); return j; } },
  serpent: { base: "tall", build(g, glow, R, species) {
    const col = species === "worm" || species === "tickler" ? ["#c96f86", "#e889a0"] : species === "eel" ? ["#3a5a4a", "#5f8a6a"] : ["#2f6b5a", "#4fa38a"];
    const m = sm(col[0]), m2 = sm(col[1]);
    const rig = new THREE.Group(); g.add(rig);
    const j = { rig, glows: [], hunch: 0, ...dummyJoints(rig) };
    add(new THREE.CylinderGeometry(1.0, 1.1, 0.12, 22), sm("#3a2a1e"), { y: 0.06, parent: rig }); // the hole it rises from
    const pelvis = new THREE.Group(); rig.add(pelvis); j.pelvis = pelvis;
    const spine = new THREE.Group(); pelvis.add(spine); j.spine = spine;
    const segs = [];
    for (let k = 0; k < 9; k++) { const s = add(sph(0.55 - k * 0.025, 14, 10), k % 2 ? m : m2, { parent: spine }); segs.push(s); }
    const head = new THREE.Group(); spine.add(head); j.head = head;
    add(sph(0.5, 16, 12), m, { parent: head }).scale.set(1, 0.85, 1.2);
    rbx(0.7, 0.12, 0.3, 0.05, sm("#2a0d12"), { y: -0.15, z: 0.5, parent: head });
    const eyeM = glowMat(glow, 3); j.glows.push({ m: eyeM, k: 3 });
    for (const s of [-1, 1]) add(sph(0.1), eyeM, { x: s * 0.25, y: 0.2, z: 0.45, parent: head });
    j.wave = (state, t) => {
      const rise = state === "lurk" ? 0.55 : state === "flee" ? 0.4 : 1;
      segs.forEach((s, k) => { const u = k / 8; s.position.set(0.5 * Math.sin(u * 3 + t * 1.5) * u, u * 3.6 * rise, 0.4 * Math.sin(u * 2.4 + t) * u); });
      head.position.set(0.5 * Math.sin(3 + t * 1.5), 3.9 * rise, 0.4 * Math.sin(2.4 + t) + 0.2);
      j.spine.rotation.set(0, 0, 0); j.head.rotation.set(state === "reveal" ? -0.2 : 0.1, 0, 0);
    };
    j.wave("reveal", 0);
    return j;
  } },
  squid: { base: "tall", build(g, glow, R) {
    const m = sm("#b5466e"), m2 = sm("#d66a92");
    const rig = new THREE.Group(); g.add(rig);
    const j = { rig, glows: [], hunch: 0, ...dummyJoints(rig) };
    const pelvis = new THREE.Group(); pelvis.position.y = 1.6; rig.add(pelvis); j.pelvis = pelvis;
    const spine = new THREE.Group(); pelvis.add(spine); j.spine = spine;
    const head = new THREE.Group(); head.position.y = 0.8; spine.add(head); j.head = head;
    add(sph(0.9, 18, 14), m, { y: 0.5, parent: head }).scale.set(1, 1.6, 1);
    const eyeM = glowMat(glow, 2.5); j.glows.push({ m: eyeM, k: 2.5 });
    for (const s of [-1, 1]) { add(sph(0.22), sm("#ffffff"), { x: s * 0.45, y: -0.1, z: 0.65, parent: head }); add(sph(0.12), eyeM, { x: s * 0.45, y: -0.1, z: 0.84, parent: head }); }
    const arms = [];
    for (let k = 0; k < 8; k++) { const a = new THREE.Group(); const ang = (k / 8) * TAU; a.position.set(Math.cos(ang) * 0.5, 0.2, Math.sin(ang) * 0.5); spine.add(a); const segs = []; for (let i = 0; i < 7; i++) segs.push(add(sph(0.2 - i * 0.022, 10, 8), i % 2 ? m : m2, { parent: a })); arms.push({ a, ang, segs }); }
    j.wave = (state, t) => arms.forEach(({ ang, segs }, k) => segs.forEach((s, i) => { const reach = state === "reach" || state === "reveal" ? 1.4 : 0.8; const r = i * 0.22 * reach, y = -i * 0.22 + (state === "reveal" ? i * 0.3 * Math.max(0, Math.sin(ang)) : 0); s.position.set(Math.cos(ang) * r + 0.12 * Math.sin(t * 2 + k + i * 0.6), y, Math.sin(ang) * r); }));
    j.wave("lurk", 0);
    return j;
  } },
  fish: { base: "tall", build(g, glow, R) {
    const m = sm("#3a4a6a", { roughness: 0.5 }), m2 = sm("#5a6a8a");
    const rig = new THREE.Group(); g.add(rig);
    const j = { rig, glows: [], hunch: 0, ...dummyJoints(rig) };
    const pelvis = new THREE.Group(); pelvis.position.y = 2.0; rig.add(pelvis); j.pelvis = pelvis;
    const spine = new THREE.Group(); pelvis.add(spine); j.spine = spine;
    const head = new THREE.Group(); spine.add(head); j.head = head;
    add(sph(1.2, 20, 16), m, { parent: head }).scale.set(1, 0.95, 1.25);
    rbx(1.6, 0.35, 0.5, 0.1, sm("#1a0a10"), { y: -0.35, z: 1.05, parent: head });
    for (let k = 0; k < 9; k++) add(cone(0.07, 0.3, 4), sm("#fffbe6"), { x: -0.7 + k * 0.175, y: -0.18, z: 1.25, rx: Math.PI, parent: head });
    for (let k = 0; k < 9; k++) add(cone(0.06, 0.25, 4), sm("#fffbe6"), { x: -0.7 + k * 0.175, y: -0.52, z: 1.22, parent: head });
    const eyeM = glowMat(glow, 2.0); j.glows.push({ m: eyeM, k: 2 });
    for (const s of [-1, 1]) add(sph(0.16), eyeM, { x: s * 0.6, y: 0.4, z: 0.95, parent: head });
    const lureM = glowMat("#fff27a", 6); j.glows.push({ m: lureM, k: 6 });
    const stalk = new THREE.Group(); stalk.position.set(0, 1.05, 0.4); stalk.rotation.x = 0.7; head.add(stalk);
    bx(0.06, 1.0, 0.06, m2, { y: 0.5, parent: stalk }); add(sph(0.2), lureM, { y: 1.05, z: 0.25, parent: stalk });
    add(cone(0.7, 1.0, 4), m2, { z: -1.6, rx: -Math.PI / 2, parent: head }).scale.set(0.2, 1, 1);
    for (const s of [-1, 1]) add(cone(0.4, 0.6, 4), m2, { x: s * 1.1, y: -0.2, rz: s * 1.6, parent: head }).scale.set(1, 1, 0.2);
    j.wave = (state, t) => { head.rotation.y = 0.15 * Math.sin(t * 0.8); stalk.rotation.z = 0.15 * Math.sin(t * 2); pelvis.position.y = 2.0 + 0.15 * Math.sin(t * 1.2); };
    return j;
  } },
};
function darker(c) { return `#${new THREE.Color(c).multiplyScalar(0.7).getHexString()}`; }
