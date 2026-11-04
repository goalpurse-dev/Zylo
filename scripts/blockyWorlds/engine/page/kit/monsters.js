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
function buildTall(g, glow, R) {
  const body = matte("#0b0a0e", null, 0.08);
  const body2 = matte("#1a1720", null, 0.1);
  const eyeM = glowMat(glow, 3.4), vaneM = glowMat(glow, 2.4);
  const j = { glows: [{ m: eyeM, k: 3.4 }, { m: vaneM, k: 2.4 }], legs: { LT: 1.15, LS: 1.15 } };
  const rig = new THREE.Group(); g.add(rig); j.rig = rig;
  const pelvis = new THREE.Group(); pelvis.position.y = 2.3; rig.add(pelvis); j.pelvis = pelvis;
  rbx(0.34, 0.2, 0.2, 0.02, body, { y: 0.04, parent: pelvis });
  j.hip = []; j.knee = [];
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const h = new THREE.Group(); h.position.x = s * 0.12; pelvis.add(h);
    const k = new THREE.Group(); k.position.y = -1.15; h.add(k);
    rbx(0.13, 1.17, 0.14, 0.02, body, { y: -0.575, parent: h });
    rbx(0.16, 0.12, 0.16, 0.03, body2, { y: 0, parent: k }); // knobbly knee
    rbx(0.11, 1.1, 0.12, 0.02, body, { y: -0.55, parent: k });
    rbx(0.15, 0.06, 0.36, 0.02, body, { y: -1.12, z: 0.09, parent: k });
    j.hip[i] = h; j.knee[i] = k;
  }
  const spine = new THREE.Group(); spine.position.y = 0.12; pelvis.add(spine); j.spine = spine;
  rbx(0.26, 0.62, 0.17, 0.02, body, { y: 0.31, parent: spine });
  rbx(0.42, 0.66, 0.2, 0.025, body, { y: 0.92, parent: spine });
  rbx(0.56, 0.14, 0.24, 0.03, body, { y: 1.22, parent: spine }); // high, shrugged shoulders
  // a ragged shroud of hanging strips, front and back, past the hips
  for (const zs of [1, -1]) for (let k = 0; k < 5; k++) {
    const len = 0.95 + R() * 0.55, x = (k - 2) * 0.085;
    rbx(0.075, len, 0.018, 0.005, k % 2 ? body2 : body, { x, y: 1.18 - len / 2, z: zs * (0.11 + k * 0.004), rx: zs * 0.06, rz: (R() - 0.5) * 0.08, parent: spine });
  }
  j.sh = []; j.el = []; j.hand = []; j.fingers = [];
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const a = new THREE.Group(); a.position.set(s * 0.29, 1.24, 0); spine.add(a);
    rbx(0.13, 0.1, 0.13, 0.02, body2, { parent: a });
    const e = new THREE.Group(); e.position.y = -1.0; a.add(e);
    rbx(0.09, 1.02, 0.1, 0.015, body, { y: -0.5, parent: a });
    rbx(0.08, 0.96, 0.09, 0.015, body, { y: -0.48, parent: e });
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
  rbx(0.26, 0.3, 0.24, 0.02, body, { y: 0.15, parent: head });
  rbx(0.2, 0.07, 0.12, 0.02, body, { y: 0.05, z: 0.13, parent: head }); // a jutting jaw
  for (const s of [-1, 1]) {
    bx(0.055, 0.032, 0.02, eyeM, { x: s * 0.058, y: 0.19, z: 0.122, parent: head, shadow: false });
    // ear-vanes: tall thin slabs angled out, a lit slit inside each
    const v = new THREE.Group(); v.position.set(s * 0.13, 0.22, -0.02); v.rotation.z = -s * 0.35; head.add(v);
    rbx(0.045, 0.56, 0.24, 0.01, body, { y: 0.28, parent: v });
    bx(0.012, 0.42, 0.06, vaneM, { x: -s * 0.024, y: 0.3, z: 0.04, parent: v, shadow: false });
  }
  j.hunch = 0.32;
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
function buildFurry(g, glow, R) {
  const core = matte("#1d1714");
  const furD = matte("#ffffff", fabric("#2b2420", "cotton").map, 0.15), furL = matte("#ffffff", fabric("#4f4034", "cotton").map, 0.15);
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
    furMesh(h, furShell(0.4, 0.42, 0.42, R, { top: false, slab: [0.18, 0.26, 0.05] }), furD, furL, [0, -0.2, 0]);
    rbx(0.36, 0.36, 0.38, 0.04, core, { y: -0.18, parent: k });
    rbx(0.44, 0.1, 0.6, 0.03, core, { y: -0.37, z: 0.08, parent: k });
    for (let c = 0; c < 3; c++) rbx(0.07, 0.06, 0.1, 0.01, claw, { x: (c - 1) * 0.13, y: -0.39, z: 0.41, parent: k });
    j.hip[i] = h; j.knee[i] = k;
  }
  const spine = new THREE.Group(); spine.position.y = 0.05; pelvis.add(spine); j.spine = spine;
  rbx(1.25, 1.2, 0.85, 0.08, core, { y: 0.6, parent: spine });
  furMesh(spine, furShell(1.25, 1.2, 0.85, R), furD, furL, [0, 0.6, 0]);
  const head = new THREE.Group(); head.position.set(0, 1.2, 0.12); spine.add(head); j.head = head; j.neck = null;
  rbx(0.78, 0.55, 0.62, 0.08, core, { y: 0.24, parent: head });
  furMesh(head, furShell(0.78, 0.5, 0.62, R, { slab: [0.13, 0.26, 0.04], step: 0.12, front: false }), furD, furL, [0, 0.26, 0]);
  const facePlate = matte("#120d0b");
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
    furMesh(a, furShell(0.3, 0.62, 0.32, R, { slab: [0.16, 0.26, 0.05], step: 0.15 }), furD, furL, [0, -0.3, 0]);
    rbx(0.28, 0.6, 0.3, 0.04, core, { y: -0.3, parent: e });
    furMesh(e, furShell(0.28, 0.55, 0.3, R, { top: false, slab: [0.15, 0.24, 0.05], step: 0.15 }), furD, furL, [0, -0.28, 0]);
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
  j.hunch = 0.16;
  return j;
}

/** { type: "tall" | "furry", name, glow: css colour } -> Group, origin at the feet, facing +z */
export function makeMonster(spec = {}) {
  const type = spec.type === "furry" ? "furry" : "tall";
  const glow = spec.glow || (type === "tall" ? "#9be8ff" : "#ffb03b");
  const g = new THREE.Group(); g.name = `monster:${type}`;
  const R = rng(type === "tall" ? 41 : 77);
  const j = type === "tall" ? buildTall(g, glow, R) : buildFurry(g, glow, R);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  g.userData = { kind: "monster", type, name: spec.name, glow, joints: j, height: box.max.y };
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
  // plant the lowest foot
  const { LT, LS } = j.legs;
  const h0 = j.hip[0].rotation.x, h1 = j.hip[1].rotation.x;
  j.rig.position.y += Math.max(LT * Math.cos(h0) + LS * Math.cos(h0 + j.knee[0].rotation.x), LT * Math.cos(h1) + LS * Math.cos(h1 + j.knee[1].rotation.x)) - (LT + LS);
  for (let q = 0; q < j.glows.length; q++) j.glows[q].m.emissiveIntensity = j.glows[q].k * glowK;
}
