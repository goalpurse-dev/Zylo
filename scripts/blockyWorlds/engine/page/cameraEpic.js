// Blocky Worlds EPIC (EPIC agent): scale cameras and camera shake. page/camera.js frameShot() hands the EPIC camera
// types here (frameEpic), and the engine calls applyShake() after any framing when a shot has a beat / shake.
//   frameEpic(type, ctx) -> camera
//     type: establish  very wide: the whole giant / creature-city, a little above, a slow orbit
//           hero_low   the tiny kid low in the frame (focus), the giant (other, otherHeight) towering behind
//           track      alongside a marching army (focus = the army's centre at t, ctx.velocity), a little lead
//           aerial     high over the city / battlefield, looking down ~50 degrees
//           giant_close low angle on a giant's head (focus = its feet, focusHeight = its height)
//           duel       side-on to two giants (focus, other) so both fit
//     ctx: { THREE, camera, focus: Vector3, focusHeight, span? (the subject's longest size, m), other?, otherHeight?,
//            velocity?: Vector3 (m/s), t, dur, seed, side?: Vector3 (the camera side, default +z) }
//   applyShake(camera, preset, t, { at, seed, scale, dur }) — deterministic, from lib/epic.js shake()
import { shake } from "../lib/epic.js";

const DEG = Math.PI / 180;
const hash = (n) => { let x = (Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return x / 4294967296; };
const ease = (p) => { p = Math.min(1, Math.max(0, p)); return p * p * (3 - 2 * p); };

export const EPIC_CAMERA_TYPES = ["establish", "hero_low", "track", "aerial", "giant_close", "duel", "behind_army"];

export function frameEpic(type, ctx) {
  const { THREE, camera, focus, t = 0, dur = 1, seed = 1 } = ctx;
  const H = Math.max(0.5, Number(ctx.focusHeight) || 10), span = Math.max(H, Number(ctx.span) || H);
  const k = ease(t / Math.max(1e-3, dur)), r = (i) => hash(seed * 131 + i * 977);
  const side = (ctx.side ?? new THREE.Vector3(0, 0, 1)).clone().setY(0).normalize();
  const up = new THREE.Vector3(0, 1, 0), aspect = camera.aspect || 9 / 16;
  let pos = new THREE.Vector3(), aim = new THREE.Vector3(), fov = 50;
  switch (type) {
    case "establish": {
      // fit the subject's span across the narrow 9:16 width (with margin), from a little above; orbit 8 degrees
      fov = 50; const hf = 2 * Math.atan(Math.tan((fov * DEG) / 2) * aspect);
      const dist = (span * (ctx.fill ?? 0.5)) / Math.tan(hf / 2) + span * 0.12;
      const orbit = ((r(1) < 0.5 ? -1 : 1) * 8 * (k - 0.5) + (r(2) - 0.5) * 30) * DEG;
      const dir = side.clone().applyAxisAngle(up, orbit);
      pos.copy(focus).addScaledVector(dir, dist * (1 - 0.04 * k)); pos.y = focus.y + H * 0.55 + dist * 0.16;
      aim.set(focus.x, focus.y + H * 0.42, focus.z);
      break;
    }
    case "hero_low": {
      // the kid near the bottom of the frame (feet just inside), the camera at shin height a few metres in front,
      // turned toward the giant and pitched up so the giant's head is in frame too
      fov = 74; const kidH = Math.max(0.6, Number(ctx.kidHeight) || 1.15);
      const o = ctx.other ?? focus.clone().addScaledVector(side, -40), oh = Number(ctx.otherHeight) || 30;
      const toG = new THREE.Vector3(o.x - focus.x, 0, o.z - focus.z); if (toG.lengthSq() < 1e-6) toG.copy(side).negate(); toG.normalize();
      const lat = new THREE.Vector3(toG.z, 0, -toG.x).multiplyScalar((r(3) < 0.5 ? -1 : 1) * 0.5);
      const d = Math.max(2.6, kidH * 2.6) - 0.2 * k;
      pos.copy(focus).addScaledVector(toG, -d).add(lat); pos.y = focus.y + 0.28;
      const halfV = (fov * DEG) / 2, feet = Math.atan2(focus.y + 0.02 - pos.y, d);
      let pitch = feet + halfV * 0.86;                                     // the kid's feet at ~7 % above the bottom
      const gd = Math.hypot(o.x - pos.x, o.z - pos.z), top = Math.atan2(o.y + oh * 0.95 - pos.y, gd);
      if (top > pitch + halfV * 0.9) pitch = Math.min(top - halfV * 0.9, feet + halfV * 1.4); // tilt up (a little) for a very tall giant
      const dir = new THREE.Vector3(o.x - pos.x, 0, o.z - pos.z).normalize();
      aim.copy(pos).addScaledVector(dir, Math.cos(pitch) * 10); aim.y = pos.y + Math.sin(pitch) * 10;
      break;
    }
    case "track": {
      // alongside the army: the camera moves with it (velocity), off to one side, a little ahead, at ~2.5 m
      fov = 46; const v = ctx.velocity ?? new THREE.Vector3(0, 0, 1.5);
      const along = v.lengthSq() > 1e-6 ? v.clone().setY(0).normalize() : new THREE.Vector3(0, 0, 1);
      let lat = new THREE.Vector3(along.z, 0, -along.x).multiplyScalar(r(4) < 0.5 ? 1 : -1);
      // a giant in the shot (the wolf leading his army): the camera on the other side, so the giant is behind the army
      if (ctx.other && lat.dot(new THREE.Vector3(ctx.other.x - focus.x, 0, ctx.other.z - focus.z)) > 0) lat.negate();
      if (ctx.giantTrack) {
        // REBUILD 2026-11-06: alongside a walking GIANT (no army): the whole animal side-on, a little ahead of it,
        // the camera at a third of its height (the army framing aimed at its feet from too close: legs only)
        fov = 50; const D = Math.max(H * 1.5, span * 0.95);
        pos.copy(focus).addScaledVector(lat, D * (1 - 0.05 * k)).addScaledVector(along, D * (0.35 + 0.1 * k)); pos.y = focus.y + H * 0.35;
        aim.copy(focus).addScaledVector(along, span * 0.1); aim.y = focus.y + H * 0.45;
        break;
      }
      const D = Math.max(6, span * 0.9);
      pos.copy(focus).addScaledVector(lat, D).addScaledVector(along, D * 0.55); pos.y = focus.y + 2.2 + span * 0.08;
      aim.copy(focus).addScaledVector(along, span * 0.12); aim.y = focus.y + 1.3;
      if (ctx.other) { fov = 62; aim.y = focus.y + Math.min(Number(ctx.otherHeight) || 20, 80) * 0.1; pos.y += span * 0.06; }
      break;
    }
    case "aerial": {
      fov = 50; const dist = span * 1.05;
      const dir = side.clone().applyAxisAngle(up, ((r(5) - 0.5) * 40 + 10 * (k - 0.5)) * DEG);
      pos.copy(focus).addScaledVector(dir, dist * 0.62); pos.y = focus.y + H * 0.5 + dist * 0.75;
      aim.set(focus.x, focus.y + H * 0.35, focus.z);
      break;
    }
    case "giant_close": {
      fov = 58;
      if (ctx.head && ctx.faceDir) {
        // REBUILD 2026-11-06: a giant beside the world (wolf, bear...): the camera in front of its FACE (3/4 view from
        // the camera side), a slow push in; the old framing measured from its feet and sat inside a long body
        const fd = ctx.faceDir.clone().setY(0).normalize();
        const dir = fd.multiplyScalar(0.8).addScaledVector(side, 0.5).normalize().applyAxisAngle(up, (r(6) - 0.5) * 20 * DEG);
        const dist = Math.max(H * 0.62, Number(ctx.headSize) || 0) * (1 - 0.08 * k);
        pos.copy(ctx.head).addScaledVector(dir, dist); pos.y = ctx.head.y - H * 0.1;
        aim.copy(ctx.head);
        break;
      }
      const dist = H * 0.55;
      const dir = side.clone().applyAxisAngle(up, (r(6) - 0.5) * 30 * DEG);
      pos.copy(focus).addScaledVector(dir, dist * (1 - 0.05 * k)); pos.y = focus.y + H * 0.3;
      aim.set(focus.x, focus.y + H * 0.82, focus.z);
      if (ctx.head) aim.copy(ctx.head);
      break;
    }
    case "duel": {
      fov = 52; const o = ctx.other ?? focus.clone().addScaledVector(side, -30), oh = Number(ctx.otherHeight) || H;
      const mid = focus.clone().add(o).multiplyScalar(0.5), apart = Math.hypot(o.x - focus.x, o.z - focus.z);
      const axis = new THREE.Vector3(o.x - focus.x, 0, o.z - focus.z).normalize();
      let perp = new THREE.Vector3(axis.z, 0, -axis.x); if (perp.dot(side) < 0) perp.negate();
      const hf = 2 * Math.atan(Math.tan((fov * DEG) / 2) * aspect), need = apart / 2 + Math.max(H, oh) * 0.6;
      const dist = need / Math.tan(hf / 2);
      pos.copy(mid).addScaledVector(perp, dist * (1 - 0.04 * k)); pos.y = Math.max(H, oh) * 0.35;
      aim.copy(mid); aim.y = Math.max(H, oh) * 0.45;
      break;
    }
    case "behind_army": {
      // behind and above a charging army, looking past it at its target (ctx.other, otherHeight): the army fills the
      // lower half, the target giant the upper half
      fov = 56; const v = ctx.velocity ?? new THREE.Vector3(0, 0, -1);
      const along = ctx.other ? new THREE.Vector3(ctx.other.x - focus.x, 0, ctx.other.z - focus.z).normalize() : v.clone().setY(0).normalize();
      const lat = new THREE.Vector3(along.z, 0, -along.x).multiplyScalar(r(7) < 0.5 ? 1 : -1);
      // 2026-11-05 (GAPS): a giant attacker leading the army (the wolf) stays whole: the camera further back and the
      // aim raised toward its head (its head was cropped off the top)
      const atk = ctx.attacker ?? null;
      const D = Math.max(10, span * 0.75, atk ? atk.h * 0.72 : 0);
      if (atk) fov = 70;
      pos.copy(focus).addScaledVector(along, -D * (1 - 0.06 * k)).addScaledVector(lat, D * 0.22); pos.y = focus.y + 4 + span * 0.18;
      const oh = Number(ctx.otherHeight) || 30;
      aim.copy(ctx.other ?? focus.clone().addScaledVector(along, span * 2)); aim.y = (ctx.other ? ctx.other.y : focus.y) + oh * 0.3;
      aim.lerp(new THREE.Vector3(focus.x, focus.y + 1, focus.z), 0.25);
      if (atk) { aim.lerp(new THREE.Vector3(atk.pos.x, atk.pos.y + atk.h * 0.7, atk.pos.z), 0.3); pos.addScaledVector(lat, D * 0.15 * (lat.dot(new THREE.Vector3(atk.pos.x - focus.x, 0, atk.pos.z - focus.z)) > 0 ? -1 : 1)); }
      break;
    }
    default: throw new Error(`cameraEpic: unknown type "${type}" (${EPIC_CAMERA_TYPES.join(", ")})`);
  }
  if ((type === "establish" || type === "aerial") && Number(ctx.radius) > 0) {
    const R = Number(ctx.radius), top = focus.y + (Number(ctx.top) || H);
    const dx = pos.x - focus.x, dz = pos.z - focus.z, hd = Math.hypot(dx, dz);
    if (hd < R + 3 && pos.y < top + 3) {
      // over the back (an "on" view): rise above the top; otherwise step out past the flank
      if (ctx.onBack || hd < R * 0.6) pos.y = top + Math.max(4, R * 0.25);
      else { const k = (R + 3) / Math.max(1e-3, hd); pos.x = focus.x + dx * k; pos.z = focus.z + dz * k; }
    }
  }
  camera.position.copy(pos); camera.fov = fov; camera.near = Math.max(0.05, Math.min(0.3, pos.distanceTo(aim) / 400)); camera.far = Math.max(camera.far, 6000);
  camera.updateProjectionMatrix(); camera.up.set(0, 1, 0); camera.lookAt(aim); camera.updateMatrixWorld();
  camera.userData.epicAim = aim.clone();
  return camera;
}

/** applyShake(camera, preset, t, opts): offsets the already-framed camera (position in its own axes + small rotations) */
export function applyShake(camera, preset, t, opts = {}) {
  const s = shake(preset, t, opts);
  if (!s.k) return s;
  // position offsets scale with the camera's distance to its subject a little (a far camera needs more to read)
  const kd = opts.distScale ?? 1;
  camera.translateX(s.x * kd); camera.translateY(s.y * kd); camera.translateZ(s.z * kd);
  camera.rotateX(s.pitch); camera.rotateY(s.yaw); camera.rotateZ(s.roll);
  camera.updateMatrixWorld();
  return s;
}
