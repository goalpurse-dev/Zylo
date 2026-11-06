// Blocky Worlds CAPABILITIES (2026-11-06): siege weapons as kit objects (cannon, ballista, catapult) and the shot
// effects of firing one: muzzle flash, smoke, the projectile on its arc with a trail (a ball, a bolt, a rock, or a hook
// that pulls a chain behind it: page/kit/tether.js), and the impact (debris blocks, dust, sparks). All deterministic
// from the shot time.
//   makeSiege(kind, { scale })          -> Group (origin on the ground, faces +z); userData.muzzle (local), aim(yaw, pitch)
//   animateSiege(w, t, { fireAt })      recoil (cannon), string snap (ballista), arm swing (catapult)
//   makeBurst({ kind: impact|dust|sparks|leaves, size }) -> Group; updateBurst(b, bt, { seed })  (bt: s since it began)
//   makeShotFx({ payload, size })       -> { group, update(t, { from, to, timing, seed }) } flash + smoke + projectile + trail + impact
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { burstPiece, ballistic, clamp01, hash01 } from "../../lib/caps.js";

const MATS = new Map();
const mat = (k, f) => (MATS.has(k) ? MATS.get(k) : (MATS.set(k, f()), MATS.get(k)));
const std = (c, r = 0.8, m = 0) => mat(`s:${c}:${r}:${m}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }));
const box = (w, h, d, material, x = 0, y = 0, z = 0, parent = null, r = 0.06) => { const mm = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 3, h / 3, d / 3)), material); mm.position.set(x, y, z); mm.castShadow = mm.receiveShadow = true; parent?.add(mm); return mm; };
const WOOD = "#8a5a32", WOOD2 = "#6b4423", IRON = "#2f343b", ROPE = "#c8a46a";

export function makeSiege(kind = "cannon", { scale = 1 } = {}) {
  const root = new THREE.Group(); root.name = `siege:${kind}`;
  const body = new THREE.Group(); body.scale.setScalar(scale); root.add(body);
  const yawP = new THREE.Group(); body.add(yawP);
  const pitchP = new THREE.Group(); yawP.add(pitchP);
  let muzzle = new THREE.Vector3(), recoilPart = null, arm = null, string = null;
  if (kind === "cannon") {
    box(1.5, 0.7, 2.4, std(WOOD), 0, 0.75, -0.2, yawP);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.28, 12), std(WOOD2)); w.rotation.z = Math.PI / 2; w.position.set(s * 0.86, 0.62, 0.1); w.castShadow = true; yawP.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.34, 8), std(IRON, 0.4, 0.6)); hub.rotation.z = Math.PI / 2; hub.position.copy(w.position); yawP.add(hub); }
    pitchP.position.set(0, 1.25, 0);
    recoilPart = new THREE.Group(); pitchP.add(recoilPart);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.46, 3.2, 14), std(IRON, 0.35, 0.7)); barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.9; barrel.castShadow = true; recoilPart.add(barrel);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.09, 6, 14), std(IRON, 0.35, 0.7)); lip.position.z = 2.5; recoilPart.add(lip);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 8), std(IRON, 0.35, 0.7)); back.position.z = -0.7; recoilPart.add(back);
    muzzle.set(0, 0, 2.6);
  } else if (kind === "ballista") {
    box(0.7, 1.4, 0.7, std(WOOD2), 0, 0.7, 0, yawP);
    for (const s of [-1, 1]) box(0.5, 0.25, 1.6, std(WOOD2), s * 0.6, 0.12, 0, yawP);
    pitchP.position.set(0, 1.55, 0);
    box(0.36, 0.26, 3.4, std(WOOD), 0, 0, 0.5, pitchP);
    for (const s of [-1, 1]) { const a = box(1.9, 0.22, 0.26, std(WOOD), s * 1.0, 0, 1.75, pitchP); a.rotation.y = s * -0.32; }
    string = new THREE.Group(); pitchP.add(string);
    for (const s of [-1, 1]) { const r = box(0.06, 0.06, 1.9, std(ROPE, 0.9), s * 0.95, 0, 0.95, string); r.rotation.y = s * 0.95; }
    recoilPart = string;
    muzzle.set(0, 0.2, 2.3);
  } else { // catapult
    box(2.2, 0.35, 3.6, std(WOOD2), 0, 0.5, 0, yawP);
    for (const s of [-1, 1]) { box(0.3, 2.6, 0.3, std(WOOD), s * 0.9, 1.8, 0.2, yawP); const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.25, 10), std(WOOD2)); w.rotation.z = Math.PI / 2; w.position.set(s * 1.2, 0.55, s > 0 ? 1.2 : -1.2); yawP.add(w); }
    box(2.1, 0.3, 0.3, std(WOOD), 0, 3.0, 0.2, yawP);
    arm = new THREE.Group(); arm.position.set(0, 1.1, -0.2); yawP.add(arm);
    box(0.32, 0.32, 4.2, std(WOOD), 0, 0, -1.9, arm);
    box(0.9, 0.4, 0.9, std(WOOD2), 0, 0.25, -3.9, arm);
    muzzle.set(0, 0.6, -3.9);
    pitchP.position.set(0, 3.0, 0);
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.userData = { kind, scale, yawP, pitchP, recoilPart, arm, string, muzzleLocal: muzzle, muzzleParent: arm ?? recoilPart ?? pitchP };
  return root;
}

/** aim the weapon (world yaw / pitch, radians) */
export function aimSiege(w, yaw, pitch) {
  const u = w.userData; w.rotation.set(0, yaw, 0);
  if (u.kind !== "catapult") u.pitchP.rotation.x = -Math.max(-0.2, Math.min(0.9, pitch));
}

/** the muzzle's world position (the projectile leaves here); for a catapult, the bucket at the top of its swing */
export function muzzleOf(w, target = new THREE.Vector3()) {
  const u = w.userData; w.updateMatrixWorld(true);
  return u.muzzleParent.localToWorld(target.copy(u.muzzleLocal));
}

export function animateSiege(w, t, { fireAt = 0.4 } = {}) {
  const u = w.userData, dt = t - fireAt;
  if (u.kind === "cannon" && u.recoilPart) u.recoilPart.position.z = dt >= 0 ? -0.7 * Math.exp(-dt * 6) * Math.min(1, dt * 40) : 0;
  if (u.kind === "ballista" && u.string) u.string.position.z = dt >= 0 ? 0.5 * Math.min(1, dt * 30) * Math.exp(-dt * 2) : -0.55 * clamp01((t + 0.4) / Math.max(0.4, fireAt + 0.4));
  if (u.kind === "catapult" && u.arm) u.arm.rotation.x = dt >= 0 ? Math.min(1.9, dt * 14) - 0.12 * Math.sin(dt * 18) * Math.exp(-dt * 5) : -0.2;
  if (u.kind !== "catapult") { u.yawP.position.y = dt >= 0 ? 0.05 * Math.exp(-dt * 8) * Math.sin(dt * 60) : 0; }
}

// ------------------------------------------------------------------------------------------------ bursts
const BURST = {
  impact: { n: 26, colors: ["#8a6a4a", "#9a8f80", "#c0392b", "#fff3d6", "#6d7a8a"], speed: 14, up: 0.9, g: 1, piece: 0.9 },
  dust: { n: 10, colors: ["#d8c9a8", "#cdbb96", "#e6dcc4"], speed: 4, up: 0.35, g: -0.05, piece: 2.4, puff: true },
  sparks: { n: 18, colors: ["#ffd23a", "#ffb400", "#fff1c4"], speed: 16, up: 0.8, g: 0.8, piece: 0.25, glow: true },
  leaves: { n: 30, colors: ["#5f9e3a", "#79b347", "#4f8f34", "#a3cb38"], speed: 7, up: 0.8, g: 0.35, piece: 0.7 },
  smoke: { n: 9, colors: ["#e8e8e8", "#cfcfcf", "#bdbdbd"], speed: 2.2, up: 0.7, g: -0.12, piece: 0.8, puff: true },
};
export function makeBurst({ kind = "impact", size = 1 } = {}) {
  const B = BURST[kind] ?? BURST.impact;
  const g = new THREE.Group(); g.name = `burst:${kind}`;
  const geo = new RoundedBoxGeometry(1, 1, 1, 1, 0.12);
  const m = B.glow ? mat(`b:${kind}`, () => new THREE.MeshStandardMaterial({ color: "#ffd23a", emissive: "#ffb400", emissiveIntensity: 3, roughness: 0.5 }))
    : B.puff ? mat(`b:${kind}`, () => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, transparent: true, opacity: 0.8, depthWrite: false }))
    : mat(`b:${kind}`, () => new THREE.MeshStandardMaterial({ roughness: 0.85 }));
  const im = new THREE.InstancedMesh(geo, m, B.n); im.frustumCulled = false; im.castShadow = !B.puff; im.count = 0;
  const c = new THREE.Color();
  for (let i = 0; i < B.n; i++) im.setColorAt(i, c.set(B.colors[i % B.colors.length]));
  g.add(im);
  g.userData = { kind, B, im, size };
  return g;
}
export function updateBurst(b, bt, { seed = 1 } = {}) {
  const { B, im, size } = b.userData;
  if (bt < 0 || bt > 3) { im.count = 0; b.visible = false; return; }
  b.visible = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < B.n; i++) {
    const p = burstPiece(i, B.n, bt, { seed: seed + i * 0, speed: B.speed, up: B.up, g: B.g, size });
    const k = B.puff ? (0.5 + bt * 1.6) * (1 - clamp01((bt - 1.6) / 1.2)) : p.s;
    const pc = B.piece * size * (0.6 + hash01(seed * 11 + i) * 0.8);
    e.set(p.rx, p.ry, 0); q.setFromEuler(e);
    let y = p.y; if (!B.puff && y < -0.0) y = Math.max(y, -0.2 * size); // debris lands (the ground at the burst's foot)
    m4.compose(v.set(p.x, y, p.z), q, s.setScalar(Math.max(0.001, pc * k))); im.setMatrixAt(i, m4);
  }
  im.count = B.n; im.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------------------------------------ one shot's fire effects
export function makeShotFx({ payload = "ball", size = 1, smoke: withSmoke = true } = {}) {
  const group = new THREE.Group(); group.name = "siegeFx";
  const flashM = new THREE.MeshBasicMaterial({ color: "#ffd27a", transparent: true, opacity: 1, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), flashM); group.add(flash);
  const smoke = makeBurst({ kind: "smoke", size }); smoke.userData.off = !withSmoke; group.add(smoke);
  const impact = makeBurst({ kind: "impact", size: size * 1.2 }); group.add(impact);
  const dust = makeBurst({ kind: "dust", size: size * 1.6 }); group.add(dust);
  let proj;
  if (payload === "bolt") { proj = new THREE.Group(); box(0.18 * size, 0.18 * size, 3.2 * size, std(WOOD), 0, 0, 0, proj); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3 * size, 0.7 * size, 4), std(IRON, 0.4, 0.6)); tip.rotation.x = Math.PI / 2; tip.position.z = 1.9 * size; proj.add(tip); }
  else if (payload === "rock") proj = box(1.4 * size, 1.2 * size, 1.3 * size, std("#8d8a85", 0.95), 0, 0, 0, null, 0.3);
  else if (payload === "hook") proj = new THREE.Group(); // the tether's own hook flies (page/kit/tether.js)
  else proj = new THREE.Mesh(new THREE.SphereGeometry(0.45 * size, 12, 8), std("#1e2126", 0.35, 0.6));
  proj.traverse?.((o) => { if (o.isMesh) o.castShadow = true; });
  group.add(proj);
  const trailM = mat("trail", () => new THREE.MeshStandardMaterial({ color: "#f0f0f0", roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }));
  const trail = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, 0.15), trailM, 14); trail.frustumCulled = false; trail.count = 0; group.add(trail);
  const fx = { group, flash, smoke, impact, dust, proj, trail, payload };
  fx.update = (t, { from, to, timing, seed = 1 }) => {
    const ft = t - timing.fireAt;
    flash.visible = ft >= 0 && ft < 0.18;
    if (flash.visible) { const k = 1 - ft / 0.18; flash.position.copy(from); flash.scale.setScalar(size * (1.2 + 1.6 * (1 - k))); flashM.opacity = k; }
    smoke.position.copy(from); updateBurst(smoke, smoke.userData.off ? -1 : ft, { seed: seed + 3 });
    const b = ballistic([from.x, from.y, from.z], [to.x, to.y, to.z], t, timing);
    proj.visible = !!b && !b.landed && payload !== "hook";
    trail.count = 0;
    if (b && !b.landed) {
      proj.position.set(...b.pos);
      const nxt = ballistic([from.x, from.y, from.z], [to.x, to.y, to.z], Math.min(t + 0.02, timing.fireAt + timing.flight * 0.999), timing);
      if (nxt) { const d = new THREE.Vector3(nxt.pos[0] - b.pos[0], nxt.pos[1] - b.pos[1], nxt.pos[2] - b.pos[2]); if (d.lengthSq() > 1e-9) proj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()); }
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
      for (let i = 0; i < 14; i++) {
        const tt = t - (i + 1) * 0.035; const p = ballistic([from.x, from.y, from.z], [to.x, to.y, to.z], tt, timing); if (!p) break;
        const k = 1 - i / 14; m4.compose(v.set(...p.pos), q, s.setScalar(size * 0.55 * k + 0.05)); trail.setMatrixAt(i, m4); trail.count = i + 1;
      }
      trail.instanceMatrix.needsUpdate = true;
    }
    const it = t - (timing.fireAt + timing.flight);
    impact.position.copy(to); dust.position.copy(to);
    updateBurst(impact, it, { seed: seed + 7 }); updateBurst(dust, it - 0.05, { seed: seed + 9 });
    return { landed: !!b?.landed, impactT: it, projPos: b && !b.landed ? new THREE.Vector3(...b.pos) : null };
  };
  return fx;
}
