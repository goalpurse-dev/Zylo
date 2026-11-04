// Blocky Worlds camera (owner: SETS agent). frameShot(type, ctx) places and aims the PerspectiveCamera for one frame.
// Vertical 9:16 rules: the subject centred horizontally, heads on the upper-third line, the lower third (where the
// caption sits, ~62 % down) kept to floor / legs. Inside each shot one slow, subtle move picked by the shot seed:
// a 3-6 % push-in or a small lateral drift (eased, so it never jumps). The camera stays inside the set's camera bounds
// (rooms for indoor sets) and in front of walls / houses (a ray check against the set's blockers); when it has to stand
// closer than planned it widens the lens to keep the framing.
//   type: wide | medium | closeup | low | over_shoulder | insert
//   ctx:  { THREE, camera, set, focus: Vector3 (feet), focusHeight, other?: Vector3, otherHeight?, t, dur, seed,
//           nudge?: { back, up, lat } (metres; the engine's head guard moves a blocked camera back / up / to its right) }

const hash = (n) => { let x = (Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return x / 4294967296; };
const ease = (p) => p * p * (3 - 2 * p);
const DEG = Math.PI / 180;

/** the camera side for a focus point: a spot's own view if the focus stands at it, else the set's default */
function sideFor(THREE, set, focus) {
  let best = null, bd = 1.8;
  for (const [k, dir] of Object.entries(set?.views ?? {})) {
    const s = set.spots?.[k]; if (!s) continue;
    const d = Math.hypot(s.x - focus.x, s.z - focus.z);
    if (d < bd) { bd = d; best = dir; }
  }
  return (best ?? set?.camDir ?? new THREE.Vector3(0, 0, 1)).clone().setY(0).normalize();
}
const inside = (bounds, p) => !bounds?.length || bounds.some((b) => b.containsPoint(p));

const _ray = new Map();
/** how far the camera can back away from `from` along `dir` before hitting a blocker (cached per shot) */
function freeDist(THREE, set, from, dir, want, key) {
  if (!set?.blockers?.length) return want;
  if (_ray.has(key)) return _ray.get(key);
  const rc = new THREE.Raycaster(from, dir, 0.05, want + 0.4);
  const hits = rc.intersectObjects(set.blockers, false);
  const d = hits.length ? Math.max(0.6, hits[0].distance - 0.35) : want;
  if (_ray.size > 4000) _ray.clear();
  _ray.set(key, d); return d;
}

export function frameShot(type, ctx) {
  const { THREE, camera, set, focus, t = 0, dur = 1, seed = 1 } = ctx;
  const H = Math.max(0.3, Number(ctx.focusHeight) || 1.7);
  const r = (i) => hash(seed * 131 + i * 977);
  const up = new THREE.Vector3(0, 1, 0);
  let side = sideFor(THREE, set, focus);
  const yawJit = (deg) => side.applyAxisAngle(up, (r(1) * 2 - 1) * deg * DEG);
  const headY = focus.y + H * 0.91;

  // the plan: aim point, where it sits on screen (ndc y), lens, camera distance (horizontal), camera height
  let aim, ndc, fov, dist, camY;
  switch (type) {
    case "wide": {
      yawJit(10);
      const indoor = !!set?.indoor;
      fov = 56; dist = Math.max(5.6, H * 1.5); camY = focus.y + (indoor ? 2.05 : 1.55) + r(2) * (indoor ? 0.2 : 0.4);
      aim = new THREE.Vector3(focus.x, headY, focus.z); ndc = indoor ? 0.3 : 0.12;
      break;
    }
    case "medium": {
      yawJit(16);
      fov = 40; const span = Math.max(1.05, H * 0.95); dist = span / 2 / Math.tan(fov * DEG / 2); camY = headY - 0.08;
      aim = new THREE.Vector3(focus.x, headY, focus.z); ndc = 0.36;
      break;
    }
    case "closeup": {
      yawJit(14);
      // head and shoulders, the whole head in frame (2026-11-04: the tighter 0.48 span cut the tops of kids' heads)
      fov = 34; const span = Math.max(1.0, H * 0.72); dist = span / 2 / Math.tan(fov * DEG / 2); camY = headY - 0.02;
      aim = new THREE.Vector3(focus.x, headY, focus.z); ndc = 0.36;
      break;
    }
    case "low": {
      yawJit(12);
      fov = 62; dist = Math.min(7, Math.max(2.4, H * 1.05)); camY = focus.y + 0.38;
      if (focus.y > 1.5) { camY = 0.45; dist = Math.max(dist, (focus.y + H) * 0.75); } // up on something (the water tower): from the ground
      aim = new THREE.Vector3(focus.x, headY, focus.z); ndc = H > 3 ? 0.5 : 0.42;
      break;
    }
    case "over_shoulder": {
      // 2026-11-04 (the paid test: a frame that was mostly the back of a head): the camera stands ~2.1 m behind the
      // near person, a little above their head and off to one side, so their head + shoulder sit low at one frame edge
      // (the head centre at ~0.6 of the half-width: at most ~25-30 % of the frame) and never over the focus' face
      const o = ctx.other ? ctx.other.clone() : focus.clone().addScaledVector(side, 2.2);
      const oh = Math.max(0.5, Number(ctx.otherHeight) || 1.6);
      const back = new THREE.Vector3(o.x - focus.x, 0, o.z - focus.z);
      if (back.lengthSq() < 0.04) back.copy(side); back.normalize();
      const lat = new THREE.Vector3(back.z, 0, -back.x).multiplyScalar(r(3) < 0.5 ? 1 : -1);
      fov = 42;
      // a tall focus (the monster): further back, aimed at its chest, so its eyes and the near head both stay in frame
      const tall = H > 2.4;
      aim = new THREE.Vector3(focus.x, tall ? focus.y + H * 0.62 : headY, focus.z); ndc = tall ? 0.12 : 0.3;
      // just above the near head (it sits low in the frame); for a tall focus the lens pitches up, so level with it
      camY = o.y + (tall ? oh * 0.95 : oh + 0.18);
      const aspect = camera.aspect || 9 / 16;
      // the near head's angle off the view axis: its centre at 0.6 of the half-width (9:16 is narrow: at 0.8 the
      // person was cut off the edge; at 0.6 their head + shoulder fill one lower corner, clear of the focus' face)
      const want = Math.atan(0.6 * Math.tan(fov * DEG / 2) * aspect);
      const B = tall ? 3.2 : 2.1, C = new THREE.Vector3();
      for (let L = 0.15; L < 2.5; L += 0.03) {
        C.copy(o).addScaledVector(back, B).addScaledVector(lat, L); C.y = 0;
        const toAim = new THREE.Vector3(aim.x - C.x, 0, aim.z - C.z).normalize(), toNear = new THREE.Vector3(o.x - C.x, 0, o.z - C.z).normalize();
        if (Math.acos(Math.min(1, toAim.dot(toNear))) >= want) break;
      }
      side = new THREE.Vector3(C.x - aim.x, 0, C.z - aim.z);
      dist = Math.max(0.8, side.length()); side.normalize();
      break;
    }
    case "insert": {
      yawJit(8);
      fov = 40; const mid = focus.y + H / 2; const span = Math.max(1.4, H * 2.4);
      dist = span / 2 / Math.tan(fov * DEG / 2); camY = mid + 0.15;
      aim = new THREE.Vector3(focus.x, mid, focus.z); ndc = 0.12;
      break;
    }
    default: return frameShot("medium", ctx);
  }

  // the engine's head guard (page/engine.js): a per-shot nudge back / up / sideways when somebody's head would block
  const nudge = ctx.nudge ?? null;
  if (nudge) { dist += nudge.back ?? 0; camY += nudge.up ?? 0; }

  // stay in bounds and in front of walls: shorten the distance, widen the lens to keep the same framing
  const want = dist;
  const key = `${set?.name}|${type}|${seed}|${focus.x.toFixed(2)},${focus.z.toFixed(2)}|${H.toFixed(2)}|${dist.toFixed(2)},${camY.toFixed(2)}`;
  const p = new THREE.Vector3();
  if (set?.bounds?.length && !inside(set.bounds, new THREE.Vector3(aim.x, Math.min(camY, 1.5), aim.z))) {
    // the subject is outside the camera's area (a monster in the yard, seen through the window): stand at the nearest
    // point inside along the camera side, at window height for indoor sets, and look out at it
    if (set.indoor) { camY = set.windowY ?? 1.5; if (type === "low") ndc = 0.25; }
    if (set.windowAt) side = new THREE.Vector3(set.windowAt.x - aim.x, 0, set.windowAt.z - aim.z).normalize(); // look in through the window
    let d = 0.5; for (; d < 40; d += 0.2) { p.set(aim.x, camY, aim.z).addScaledVector(side, d); if (inside(set.bounds, p)) break; }
    dist = Math.max(dist, d + 1.8);
  } else {
    const start = new THREE.Vector3(aim.x, camY, aim.z);
    dist = Math.min(dist, freeDist(THREE, set, start, side, dist, key));
  }
  for (let i = 0; i < 60; i++) { p.set(aim.x, camY, aim.z).addScaledVector(side, dist); if (inside(set?.bounds, p) || dist < 0.7) break; dist *= 0.95; }
  if (!inside(set?.bounds, p)) { // still outside (e.g. standing at a wall): clamp into the nearest box
    let bestB = null, bd = Infinity; for (const b of set.bounds) { const q = b.clampPoint(p, new THREE.Vector3()); const d = q.distanceTo(p); if (d < bd) { bd = d; bestB = q; } }
    if (bestB) p.copy(bestB);
  }
  if (nudge?.lat) {
    p.add(new THREE.Vector3(side.z, 0, -side.x).multiplyScalar(nudge.lat));   // camera-right
    if (set?.bounds?.length && !inside(set.bounds, p)) {
      let bestB = null, bd = Infinity; for (const b of set.bounds) { const q = b.clampPoint(p, new THREE.Vector3()); const d = q.distanceTo(p); if (d < bd) { bd = d; bestB = q; } }
      if (bestB) p.copy(bestB);
    }
  }
  if (dist < want) fov = Math.min(82, 2 * Math.atan(Math.tan(fov * DEG / 2) * want / Math.max(dist, 0.3)) / DEG);

  // the move: push-in (3-6 %) or lateral drift, eased over the shot
  const k = ease(Math.min(1, Math.max(0, t / Math.max(dur, 1e-3))));
  const mode = type === "low" || type === "insert" ? 0 : Math.floor(r(4) * 3); // 0 push, 1 drift left, 2 drift right
  const amount = 0.03 + r(5) * 0.03;
  const toAim = new THREE.Vector3().subVectors(aim, p);
  if (mode === 0) p.addScaledVector(toAim, amount * k);
  else {
    const lat = new THREE.Vector3(toAim.z, 0, -toAim.x).normalize();
    p.addScaledVector(lat, (mode === 1 ? -1 : 1) * (k - 0.5) * amount * 1.2 * toAim.length());
  }

  camera.position.copy(p);
  camera.fov = fov; camera.far = Math.max(camera.far, 3000); camera.near = Math.min(camera.near, 0.1);
  camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0);
  camera.lookAt(aim);
  camera.rotateX(-Math.atan(ndc * Math.tan(fov * DEG / 2)));
  camera.updateMatrixWorld();
  return camera;
}
