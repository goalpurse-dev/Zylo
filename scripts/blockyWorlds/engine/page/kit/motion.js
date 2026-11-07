// Blocky Worlds: shared body motions for things without a limb rig (GAPS agent, 2026-11-05): the kit's animals
// (page/kit/things.js) and the builder's creatures (page/kit/blueprint.js). Called after the engine has placed the
// object for the frame (position / rotation are re-set every frame), so every motion is an offset from there:
//   walk / run / chase / charge / flee   travelling along the animal's own heading (userData.heading, radians from +z),
//                                         a bob and a waddle; flee turns away; the travel is capped (it stays in shot)
//   fly      up ~1.2 m, a slow bob and tilt            swim   a patch of water round it, a gentle roll
//   sleep    squashed down, still, "Z z z" rising      eat    the head (userData.parts.head) or the body nodding down
//   howl / roar   the head up                           carry  a crate on its back
//   climb    reared up                                  dig    nose down, a scratching jitter
//   lurk     low and swaying                            reach / attack / stomp   a lunge toward the lens
// Pure three.js, deterministic in t.
import * as THREE from "three";
import { ANIMAL_STATES } from "../../lib/catalog.js";

export const MOTION_STATES = ANIMAL_STATES;
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const mat = new Map();
const M = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mat.has(k)) mat.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o })); return mat.get(k); };

function extras(obj) {
  const u = obj.userData;
  if (u.motionExtras) return u.motionExtras;
  const w = Math.max(0.6, u.width ?? 1), h = Math.max(0.4, u.height ?? 1), d = Math.max(0.6, u.depth ?? 1);
  const X = { water: new THREE.Group(), zzz: new THREE.Group(), crate: new THREE.Group() };
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.05, 32), M("#3fa7e0", { transparent: true, opacity: 0.8, roughness: 0.15 }));
  disc.scale.set(w * 0.85, 1, d * 0.9); disc.position.set(0, h * 0.18, u.focus?.z ?? 0); X.water.add(disc);
  const zm = M("#ffffff", { emissive: "#bfe6ff", emissiveIntensity: 0.6 });
  X.zs = [0, 1, 2].map((k) => { const z = new THREE.Group(); const sc = (0.07 + k * 0.03) * Math.max(1, h / 1.2); for (const [bw, y, rz] of [[1, 0.5, 0], [1, -0.5, 0], [1.25, 0, 0.9]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(bw * sc, 0.22 * sc, 0.12 * sc), zm); m.position.y = y * sc; m.rotation.z = rz; z.add(m); } X.zzz.add(z); return z; });
  const cs = Math.max(0.25, Math.min(w, d) * 0.4);
  const box = new THREE.Mesh(new THREE.BoxGeometry(cs, cs * 0.8, cs), M("#a8743f", { roughness: 0.8 })); box.castShadow = true; X.crate.add(box);
  const band = new THREE.Mesh(new THREE.BoxGeometry(cs * 1.02, cs * 0.12, cs * 1.02), M("#5a3b24")); X.crate.add(band);
  X.crate.position.set(0, h * 0.72 + cs * 0.4, u.focus?.z ?? 0);
  for (const g of [X.water, X.zzz, X.crate]) { g.visible = false; obj.add(g); }
  u.motionExtras = X;
  return X;
}

/** bodyMotion(obj, state, t): see the header. Returns true when it moved the object. */
export function bodyMotion(obj, state, t = 0) {
  if (!MOTION_STATES.includes(state) || state === "stand" || state === "idle") { if (obj.userData.motionExtras) { const X = obj.userData.motionExtras; X.water.visible = X.zzz.visible = X.crate.visible = false; } if (obj.userData.baseScale) obj.scale.copy(obj.userData.baseScale); return false; }
  const u = obj.userData, X = extras(obj);
  u.baseScale ??= obj.scale.clone(); obj.scale.copy(u.baseScale);
  X.water.visible = state === "swim"; X.zzz.visible = state === "sleep"; X.crate.visible = state === "carry";
  const h = Math.max(0.4, u.height ?? 1), head = u.parts?.head ?? null;
  const yaw0 = obj.rotation.y, hd = (u.heading ?? Math.PI / 2) + (state === "flee" ? Math.PI : 0);
  const dir = new THREE.Vector3(Math.sin(yaw0 + hd), 0, Math.cos(yaw0 + hd));
  const fast = ["run", "chase", "charge", "flee"].includes(state);
  const travel = (sp, cap) => obj.position.addScaledVector(dir, Math.min(cap, sp * t));
  if (state === "flee") obj.rotation.y = yaw0 + Math.PI;
  const step = Math.sin(t * (fast ? 14 : 8));
  // 2026-11-06 (BLOCKY-ANIMALS): a rigged animal (page/kit/animals) animates its own legs, wings, head and eyes; the
  // object only travels at the animal's own gait speed (planted feet), lifts for flying and sits in its water patch
  if (u.rigAnimal) {
    const ra = u.rigAnimal;
    if (["walk", "carry"].includes(state)) travel(ra.speed, 0.9);
    else if (fast) travel(ra.runSpeed, 2.4);
    else if (state === "fly") { const k = ease(t / 0.6); obj.position.y += (1.2 + 0.15 * Math.sin(t * 2.2)) * k; travel(0.4, 1.0); }
    else if (state === "swim") { obj.position.y -= h * 0.12; travel(0.25, 0.7); }
    else if (state === "sleep") X.zs.forEach((z, k) => { const ph = (t * 0.45 + k / 3) % 1; z.position.set(0.15 + ph * 0.4, h * 1.05 + ph * h * 0.7, u.focus?.z ?? 0); z.scale.setScalar(0.5 + ph); z.visible = ph < 0.92; });
    X.crate.visible = false;
    return true;
  }
  switch (state) {
    case "walk": case "run": case "chase": case "charge": case "flee": case "carry":
      travel(fast ? 1.1 : 0.32, fast ? 2.4 : 0.9);
      obj.position.y += h * (fast ? 0.07 : 0.035) * Math.abs(step);
      obj.rotation.z += (fast ? 0.04 : 0.05) * step;
      if (fast) obj.rotation.x += 0.06;
      if (head) head.rotation.z += 0.08 * Math.sin(t * 6);
      break;
    case "fly": {
      const k = ease(t / 0.6);
      obj.position.y += (1.2 + 0.15 * Math.sin(t * 2.2)) * k; obj.rotation.z += 0.08 * Math.sin(t * 1.7); obj.rotation.x += 0.05 * Math.sin(t * 2.2);
      travel(0.4, 1.0);
      break;
    }
    case "swim":
      obj.rotation.z += 0.06 * Math.sin(t * 2); obj.position.y += 0.03 * Math.sin(t * 2.5) - h * 0.12;
      travel(0.25, 0.7);
      break;
    case "sleep": {
      obj.scale.y *= 0.82; obj.rotation.z += 0.12;
      if (head) head.rotation.z -= 0.45;
      X.zs.forEach((z, k) => { const ph = (t * 0.45 + k / 3) % 1; z.position.set(0.15 + ph * 0.4, h * 1.05 + ph * h * 0.7, u.focus?.z ?? 0); z.scale.setScalar(0.5 + ph); z.visible = ph < 0.92; });
      break;
    }
    case "eat": {
      const chomp = Math.max(0, Math.sin(t * 5));
      if (head) head.rotation.z -= 0.55 + 0.2 * chomp; else obj.rotation.x += 0.18 + 0.1 * chomp;
      break;
    }
    case "howl": case "roar":
      if (head) head.rotation.z += 0.65; else obj.rotation.x -= 0.15;
      obj.position.y += 0.01 * Math.sin(t * 30);
      break;
    case "climb":
      obj.rotation.x -= 0.45; obj.position.y += h * 0.25;
      break;
    case "dig":
      obj.rotation.x += 0.22; obj.position.x += 0.02 * Math.sin(t * 25);
      if (head) head.rotation.z -= 0.5;
      break;
    case "lurk":
      obj.scale.y *= 0.85; obj.rotation.z += 0.04 * Math.sin(t * 0.8);
      break;
    case "reach": case "attack": case "stomp": {
      const k = ease((t % 1.6) / 0.5) * (1 - ease(((t % 1.6) - 0.9) / 0.6));
      obj.position.add(new THREE.Vector3(Math.sin(yaw0), 0, Math.cos(yaw0)).multiplyScalar(0.45 * k));
      obj.rotation.x += 0.12 * k;
      if (state === "stomp") obj.position.y += h * 0.1 * Math.max(0, Math.sin(t * 6));
      break;
    }
    default: break;
  }
  return true;
}
