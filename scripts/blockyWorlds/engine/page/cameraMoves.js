// Blocky Worlds CAPABILITIES (2026-11-06): the target's camera moves, on any subject (a giant, the world creature,
// its town, a crowd, a person). The EPIC layer hands a shot with `move` here instead of page/cameraEpic.js frameEpic;
// the same ctx (focus, focusHeight, span, head?, other?, t, dur, seed, side).
//   tilt_up   from the feet / base up to the head / the city on top (a low camera close to the subject, pitching up)
//   orbit     a circle round the subject (deg: the arc, default ~70, the side from the seed), a little above
//   flyover   high, moving across the subject from one side to the other, looking down and ahead
//   fpv       a fast first-person flight low over the subject's top (the town's street), banking a little
//   top_down  straight down on the subject (a person in bed, a fallen kid), a slow turn
//   low_hero  a worm's-eye view at the subject's feet, looking up at it (a hero shot)
import { moveSpec, smooth } from "../lib/caps.js";

const DEG = Math.PI / 180;

export function applyMove(move, ctx) {
  const { THREE, camera, focus, t = 0, dur = 1, seed = 1 } = ctx;
  const M = moveSpec(move, seed);
  const H = Math.max(0.5, Number(ctx.focusHeight) || 10), span = Math.max(H, Number(ctx.span) || H);
  const k = smooth((t / Math.max(1e-3, dur) - M.from) / Math.max(1e-3, M.to - M.from));
  const side = (ctx.side ?? new THREE.Vector3(0, 0, 1)).clone().setY(0).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3(), aim = new THREE.Vector3();
  let fov = 50, upV = up.clone();
  const top = focus.y + H;
  switch (M.type) {
    case "tilt_up": {
      // close and low: the base fills the first frame, the top the last (the camera rises a little too)
      fov = 62; const d = Math.max(H * 0.62, span * 0.42, 3.2);
      const dir = side.clone().applyAxisAngle(up, (((seed * 37) % 7) - 3) * 5 * DEG);
      pos.copy(focus).addScaledVector(dir, d); pos.y = focus.y + Math.max(0.6, H * 0.08) + H * 0.12 * k;
      const lo = focus.y + H * 0.04, hi = ctx.head ? Math.max(ctx.head.y, top * 0.92) : focus.y + H * 0.96;
      aim.set(focus.x, lo + (hi + H * 0.08 - lo) * k, focus.z);
      break;
    }
    case "orbit": {
      fov = 52; const hf = 2 * Math.atan(Math.tan((fov * DEG) / 2) * (camera.aspect || 9 / 16));
      const d = (span * 0.55) / Math.tan(hf / 2) + span * 0.1;
      const ang = (M.deg * DEG) * (k - 0.5);
      const dir = side.clone().applyAxisAngle(up, ang);
      pos.copy(focus).addScaledVector(dir, d); pos.y = focus.y + H * 0.55 + d * 0.12;
      aim.set(focus.x, focus.y + H * 0.45, focus.z);
      break;
    }
    case "flyover": {
      fov = 58; const lat = new THREE.Vector3(side.z, 0, -side.x);
      const h = M.height ?? Math.max(H * 0.6, span * 0.35);
      const x = (k - 0.5) * span * 1.3;
      pos.copy(focus).addScaledVector(lat, x).addScaledVector(side, span * 0.15); pos.y = top + h;
      aim.copy(focus).addScaledVector(lat, x + span * 0.45); aim.y = focus.y + H * 0.5;
      break;
    }
    case "fpv": {
      // along the subject's length (its heading when given: ctx.forward), low over its top, quick
      fov = 72; const fwd = (ctx.forward ?? side.clone().negate()).clone().setY(0).normalize();
      const lat = new THREE.Vector3(fwd.z, 0, -fwd.x);
      const L = span * 0.6, s = -0.5 + k;
      const h = M.height ?? Math.max(3, H * 0.06);
      pos.copy(focus).addScaledVector(fwd, s * L).addScaledVector(lat, Math.sin(k * Math.PI * 2 + seed) * span * 0.03); pos.y = top + h;
      // looking ~32 degrees down the street ahead (the roofs rush under the lens)
      aim.copy(pos).addScaledVector(fwd, span * 0.3); aim.y = pos.y - span * 0.3 * 0.62;
      upV.copy(up).applyAxisAngle(fwd, Math.sin(k * Math.PI * 2 + seed) * 6 * DEG);
      break;
    }
    case "top_down": {
      fov = 50; const h = M.height ?? Math.max(span * 1.6, H * 2.4, 3.5);
      pos.set(focus.x, focus.y + h * (1 - 0.08 * k), focus.z);
      aim.set(focus.x, focus.y, focus.z);
      upV.copy(side).negate().applyAxisAngle(up, (k - 0.5) * 16 * DEG); // screen-up = away from the usual camera side, slow turn
      break;
    }
    case "low_hero": {
      fov = 70; const d = Math.max(H * 0.45, 1.6);
      const dir = side.clone().applyAxisAngle(up, (((seed * 13) % 5) - 2) * 6 * DEG);
      pos.copy(focus).addScaledVector(dir, d * (1 - 0.06 * k)); pos.y = focus.y + Math.max(0.15, H * 0.03);
      aim.set(focus.x, focus.y + H * 0.72, focus.z);
      break;
    }
    default: throw new Error(`cameraMoves: unknown move "${M.type}"`);
  }
  camera.position.copy(pos); camera.fov = fov;
  camera.near = Math.max(0.05, Math.min(0.3, pos.distanceTo(aim) / 400)); camera.far = Math.max(camera.far, 6000);
  camera.updateProjectionMatrix(); camera.up.copy(upV); camera.lookAt(aim); camera.updateMatrixWorld();
  camera.up.set(0, 1, 0);
  camera.userData.epicAim = aim.clone();
  return camera;
}
