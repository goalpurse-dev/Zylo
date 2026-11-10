// Blocky Worlds SIMPLE LOOK camera (production; the engine loads it instead of page/camera.js when timeline.look ===
// "simple"). page/camera.js frameShot does the work (bounds, walls, the head guard's nudge, the in-shot move); this
// module changes three things for the 6-block avatar (it is wider than the old people: ~0.69 of its height):
//   1. medium / close-up spans scaled to the approved test's framings (medium = knees up with the arms in frame,
//      close-up = head + chest, the head ~40 % of the frame width)
//   2. GROUP framing (owner 2026-11-10: "characters fill the frame, no empty road in the bottom third"): the engine
//      stands a group in a staggered formation (page/engine.js simpleFormation); here the lens fits the formation's
//      width (the outer shoulders may touch the frame edge), the frame's bottom edge sits at the front row's knees, the
//      camera at chest height looking very slightly down, so the lower two thirds are people, never the road
//   3. the ESTABLISHING view (a place shot with nobody in it): the set's high view down the street
// Every framing moves (slow push / pan / orbit: the base move + the shot's camMove, lib/camMove.js).
import { frameShot as baseFrame, headShare } from "/page/camera.js";
export { headShare };

const DEG = Math.PI / 180;
const ease = (p) => p * p * (3 - 2 * p);
const SPAN_K = { medium: 1.25, closeup: 1.75 };
const AIM_DROP = { medium: 0.05, closeup: 0.1 }; // aim a little below the head top: the hair never cut by the frame

// the angle per shot (by seed): ~1/3 straight on, the rest three-quarter / along the street / low / high
const ANGLES = [{}, { yaw: 38 }, { yaw: -38 }, { low: true }, { yaw: 62 }, {}, { yaw: -24, high: true }, { yaw: 28, low: true }, { yaw: -60 }];
function angleOf(seed) { const h = (Math.imul(((seed | 0) + 7) ^ 0x5bd1e995, 0x27d4eb2d) >>> 0) % ANGLES.length; return ANGLES[h]; }
function rotated(THREE, set, deg) {
  const s2 = Object.create(set);
  s2.camDir = (set?.camDir ?? new THREE.Vector3(0, 0, 1)).clone().setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (deg * Math.PI) / 180);
  s2.views = {};
  return s2;
}

export function frameShot(type, ctx) {
  const { THREE, camera, set, t = 0, dur = 1 } = ctx;
  if (ctx.establish && set?.establish) {
    const E = set.establish, k = ease(Math.min(1, Math.max(0, t / Math.max(dur, 1e-3))));
    camera.position.copy(E.cam).lerp(E.look, 0.05 * k); // a slow push down the street
    camera.fov = E.fov; camera.near = 0.1; camera.far = Math.max(camera.far, 3000); camera.updateProjectionMatrix();
    camera.up.set(0, 1, 0); camera.lookAt(E.look); camera.updateMatrixWorld();
    return camera;
  }
  if (ctx.group?.length >= 2 && (type === "medium" || type === "wide")) return frameGroup(type, ctx);
  if (ctx.monsterEye && ["low", "medium", "closeup"].includes(type)) return frameEye(type, ctx);
  const k = SPAN_K[type];
  if (k && ctx.focus && Number(ctx.focusHeight) > 0) {
    const H = Number(ctx.focusHeight), H2 = H * k;
    const focus = ctx.focus.clone(); focus.y -= (H2 - H) * 0.91 + AIM_DROP[type] * H; // aim just under the head top, a wider span
    // BACKGROUND VARIETY (owner 2026-11-10: "not every medium in front of the same flat wall"): per shot an angle
    // (front, three-quarter left / right = the street's depth and porches, along the street, low = sky + roofs, high)
    const A = angleOf(ctx.seed);
    const set2 = A.yaw ? rotated(THREE, set, A.yaw) : set;
    baseFrame(type, { ...ctx, set: set2, focus, focusHeight: H2 });
    if (A.low || A.high) {
      const f = ctx.focus;
      camera.position.y = A.low ? f.y + (type === "closeup" ? H * 0.5 : H * 0.32) : camera.position.y + (type === "closeup" ? 0.7 : 1.3);
      camera.up.set(0, 1, 0); camera.lookAt(f.x, f.y + H * (A.low ? (type === "closeup" ? 0.86 : 0.72) : (type === "closeup" ? 0.8 : 0.6)), f.z); camera.updateMatrixWorld();
    }
    return camera;
  }
  return baseFrame(type, ctx);
}

/** THE EYE IS THE STAR (owner 2026-11-10): a close look at a monster frames its head and eye (ctx.monsterEye = the
 *  eye's world point): low = from below the eye, the head + shoulders against the sky; medium / closeup = level with it */
function frameEye(type, ctx) {
  const { THREE, camera, set, t = 0, dur = 1, seed = 1 } = ctx;
  const eye = ctx.monsterEye.clone(), fov = 40, span = type === "closeup" ? 2.2 : type === "medium" ? 3.4 : 4.6;
  const A = angleOf(seed), side = (set?.camDir ?? new THREE.Vector3(0, 0, 1)).clone().setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), ((Math.max(-30, Math.min(30, A.yaw ?? 0))) * Math.PI) / 180);
  const k = ease(Math.min(1, Math.max(0, t / Math.max(dur, 1e-3))));
  const dist = (span / 2 / Math.tan((fov * DEG) / 2)) * (1 - 0.07 * k); // a slow push into the eye
  const p = eye.clone().addScaledVector(side, dist); p.y = eye.y - (type === "low" ? 0.7 : 0.15);
  if (set?.bounds?.length && !set.bounds.some((b) => b.containsPoint(p))) { let best = null, bd = Infinity; for (const b of set.bounds) { const q = b.clampPoint(p, new THREE.Vector3()); const d = q.distanceTo(p); if (d < bd) { bd = d; best = q; } } if (best) p.copy(best); }
  camera.position.copy(p); camera.fov = fov; camera.near = 0.1; camera.far = Math.max(camera.far, 3000); camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0); camera.lookAt(eye.x, eye.y - span * 0.14, eye.z); // the eye in the upper third, the hunched body below camera.updateMatrixWorld();
  return camera;
}

/**
 * a group: ctx.group = [{ pos: Vector3 (feet), h }]. Width-driven (9:16): the horizontal span is the formation's width
 * (a little less: the outer shoulders reach the frame edge), the vertical span follows; the bottom edge at the front
 * row's knees (never the road), heads in the upper half; a slow push or a small lateral drift over the shot.
 */
function frameGroup(type, ctx) {
  const { THREE, camera, set, group, t = 0, dur = 1, seed = 1 } = ctx;
  const GA = angleOf(seed), gy = type === "wide" ? 0 : Math.max(-35, Math.min(35, GA.yaw ?? 0));
  const side = (set?.camDir ?? new THREE.Vector3(0, 0, 1)).clone().setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (gy * Math.PI) / 180);
  const lat = new THREE.Vector3(side.z, 0, -side.x);
  // the FRONT ROW decides the framing (the three nearest the lens; the rows behind fill the gaps and may be cropped)
  const byNear = [...group].sort((a, b) => b.pos.clone().dot(side) - a.pos.clone().dot(side));
  const row = byNear.slice(0, 3);
  const c = row.reduce((s, p) => s.add(p.pos), new THREE.Vector3()).divideScalar(row.length);
  let lo = Infinity, hi = -Infinity, near = -Infinity, H = 0, feet = Infinity;
  for (const p of row) {
    const l = p.pos.clone().sub(c).dot(lat), w = (p.h ?? 1.8) * 0.36;
    lo = Math.min(lo, l - w); hi = Math.max(hi, l + w);
    near = Math.max(near, p.pos.clone().sub(c).dot(side));
    H = Math.max(H, p.h ?? 1.8); feet = Math.min(feet, p.pos.y);
  }
  const wide = type === "wide";
  const aspect = camera.aspect || 9 / 16;
  const fov = wide ? 50 : 46;
  const tanV = Math.tan((fov * DEG) / 2);
  // the vertical span from the row's width (9:16: the outer shoulders may touch / leave the frame edge), clamped so the
  // people stay big: medium 1.45-1.9 x their height (knees up), wide 2.2-3.0 x (the whole people + the house behind)
  const width = (hi - lo) * (wide ? 1.0 : 0.8);
  const vspan = Math.min(H * (wide ? 2.7 : 1.9), Math.max(H * (wide ? 2.4 : 1.45), (width / aspect)));
  const front = c.clone().addScaledVector(side, near); front.y = feet;
  let dist = vspan / 2 / tanV;
  // the head tops on the upper-third line (medium) / a little higher (wide): never empty road in the bottom third
  const top = feet + H * 1.02;
  const midY = top - vspan * (wide ? 0.06 : 0.17); // wide: the whole people at the bottom, the place above them
  const camY = midY - (wide ? 0.25 : 0.12); // nearly level: no tilted verticals, no extra ground
  const mid = new THREE.Vector3(front.x + (lo + hi) / 2 * lat.x, midY, front.z + (lo + hi) / 2 * lat.z);
  // stay inside the set's bounds / in front of walls: closer + a wider lens (the same framing)
  const p = mid.clone().addScaledVector(side, dist); p.y = camY;
  let f2 = fov;
  if (set?.bounds?.length && !set.bounds.some((b) => b.containsPoint(p))) {
    let d = dist; for (; d > 1.2; d *= 0.95) { p.copy(mid).addScaledVector(side, d); p.y = camY; if (set.bounds.some((b) => b.containsPoint(p))) break; }
    f2 = Math.min(80, (2 * Math.atan((tanV * dist) / d)) / DEG); dist = d;
  }
  // the move: a slow push (2/3 of the shots) or a lateral drift, eased, by seed
  const h = ((Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0) % 1000) / 1000;
  const k = ease(Math.min(1, Math.max(0, t / Math.max(dur, 1e-3))));
  if (h < 0.66) p.addScaledVector(side, -dist * 0.06 * k);
  else p.addScaledVector(lat, (h < 0.83 ? -1 : 1) * (k - 0.5) * 0.35);
  if (ctx.nudge) { p.addScaledVector(side, ctx.nudge.back ?? 0); p.y += ctx.nudge.up ?? 0; }
  camera.position.copy(p);
  camera.fov = f2; camera.near = 0.1; camera.far = Math.max(camera.far, 3000); camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0);
  camera.lookAt(mid.x + (p.x - mid.x) * 0, midY, mid.z);
  camera.updateMatrixWorld();
  return camera;
}
