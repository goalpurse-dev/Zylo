// Blocky Worlds CAPABILITIES (2026-11-06): the smaller target effects, deterministic from the shot time.
//   makeSoundRings({ size }) / updateSoundRings(g, t, from, to, { t0, t1 })   white rings travelling from a horn
//   makeShieldDome({ radius }) / updateShieldDome(g, t)                        a glassy hex dome over a shell / town
//   makeBlockTree({ height }) -> Group                                         a big blocky tree (for a giant to eat)
//   makeVignette() / updateVignette(v, camera, k)                              the flashback's soft dark-sepia edge
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { clamp01, smooth } from "../../lib/caps.js";

const MATS = new Map();
const mat = (k, f) => (MATS.has(k) ? MATS.get(k) : (MATS.set(k, f()), MATS.get(k)));

// ------------------------------------------------------------------------------------------------ sound rings
export function makeSoundRings({ size = 1, n = 5 } = {}) {
  const g = new THREE.Group(); g.name = "fx:sound_rings";
  for (let i = 0; i < n; i++) {
    const m = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 6, 40), m); r.userData.m = m; g.add(r);
  }
  g.userData = { size, n };
  return g;
}
/** rings leave `from` toward `to` every 0.22 s from t0, growing as they travel (the horn's blast) */
export function updateSoundRings(g, t, from, to, { t0 = 0.1, t1 = 99, speed = 14 } = {}) {
  const { size, n } = g.userData;
  const dir = new THREE.Vector3().subVectors(to, from); const D = dir.length() || 1; dir.normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  g.children.forEach((r, i) => {
    const age = t - t0 - i * 0.22;
    if (age < 0 || t > t1 + 1.2) { r.visible = false; return; }
    const cyc = age % (n * 0.22 + 0.3), d = cyc * speed * size;
    r.visible = d < D * 1.05;
    r.position.copy(from).addScaledVector(dir, d + 0.4 * size); r.quaternion.copy(q);
    r.scale.setScalar(size * (0.35 + cyc * 2.4));
    r.userData.m.opacity = 0.9 * (1 - clamp01(cyc / (n * 0.22 + 0.3)));
  });
}

// ------------------------------------------------------------------------------------------------ shield dome
export function makeShieldDome({ radius = 40, flatten = 0.6, color = "#7fd8ff" } = {}) {
  const g = new THREE.Group(); g.name = "fx:shield_dome";
  const glass = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.16, emissive: color, emissiveIntensity: 0.35, roughness: 0.1, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), glass); g.add(shell);
  // a hex-ish lattice: an icosahedron's wire edges on the dome (the readable "force field" pattern)
  const ico = new THREE.IcosahedronGeometry(1, 3), edges = new THREE.EdgesGeometry(ico);
  const pos = edges.attributes.position, keep = [];
  for (let i = 0; i < pos.count; i += 2) if (pos.getY(i) >= -0.01 && pos.getY(i + 1) >= -0.01) keep.push(pos.getX(i), pos.getY(i), pos.getZ(i), pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
  const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
  const lm = new THREE.LineBasicMaterial({ color: "#d8f6ff", transparent: true, opacity: 0.55, depthWrite: false });
  const lines = new THREE.LineSegments(lg, lm); lines.scale.setScalar(1.002); g.add(lines);
  g.scale.set(radius, radius * flatten, radius);
  g.userData = { glass, lm, radius };
  return g;
}
/** a slow shimmer (and a flash when struck at hitAt) */
export function updateShieldDome(g, t, { hitAt = null, appear = 0 } = {}) {
  const { glass, lm } = g.userData;
  const k = smooth((t - appear) / 0.5);
  const hit = hitAt != null && t >= hitAt ? Math.exp(-(t - hitAt) * 4) : 0;
  glass.opacity = (0.14 + 0.04 * Math.sin(t * 3)) * k + 0.25 * hit;
  glass.emissiveIntensity = 0.35 + 1.6 * hit;
  lm.opacity = (0.45 + 0.15 * Math.sin(t * 2.2 + 1)) * k + 0.4 * hit;
  g.visible = k > 0.001;
}

// ------------------------------------------------------------------------------------------------ a tree to eat
export function makeBlockTree({ height = 12 } = {}) {
  const g = new THREE.Group(); g.name = "fx:tree";
  const k = height / 12;
  const trunk = new THREE.Mesh(new RoundedBoxGeometry(1.4 * k, 6 * k, 1.4 * k, 1, 0.15 * k), mat("trunk", () => new THREE.MeshStandardMaterial({ color: "#6b4a2e", roughness: 0.9 })));
  trunk.position.y = 3 * k; g.add(trunk);
  const cols = ["#5f9e3a", "#4f8f34", "#79b347"];
  [[0, 7.2, 0, 6.4], [0, 9.8, 0, 4.6], [1.6, 6.4, 1.2, 3.4], [-1.8, 6.8, -0.8, 3.2]].forEach(([x, y, z, s], i) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(s * k, s * 0.8 * k, s * k, 1, 0.3 * k), mat(`leaf${i % 3}`, () => new THREE.MeshStandardMaterial({ color: cols[i % 3], roughness: 0.9 })));
    m.position.set(x * k, y * k, z * k); m.rotation.y = i * 0.6; g.add(m);
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { height };
  return g;
}

// ------------------------------------------------------------------------------------------------ flashback vignette
export function makeVignette() {
  const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d");
  const gr = x.createRadialGradient(128, 128, 60, 128, 128, 182); gr.addColorStop(0, "rgba(60,40,20,0)"); gr.addColorStop(0.7, "rgba(60,40,20,0.35)"); gr.addColorStop(1, "rgba(30,18,8,0.85)");
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const tint = new THREE.MeshBasicMaterial({ color: "#c9a46a", transparent: true, opacity: 0.18, depthTest: false, depthWrite: false, toneMapped: false });
  const g = new THREE.Group(); g.name = "fx:vignette";
  const a = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), tint), b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
  a.renderOrder = 998; b.renderOrder = 999; a.frustumCulled = b.frustumCulled = false; g.add(a, b);
  g.userData = { tint, m };
  return g;
}
/** glue the overlay in front of the camera, filling the frame (k: 0-1 strength) */
export function updateVignette(v, camera, k = 1) {
  const d = Math.max(camera.near * 2, 0.2);
  const h = 2 * d * Math.tan((camera.fov * Math.PI) / 360), w = h * (camera.aspect || 9 / 16);
  v.position.copy(camera.position); v.quaternion.copy(camera.quaternion); v.translateZ(-d);
  v.scale.set(w * 1.02, h * 1.02, 1);
  v.userData.tint.opacity = 0.2 * k; v.userData.m.opacity = k;
  v.visible = k > 0.001;
  v.updateMatrixWorld(true);
}
