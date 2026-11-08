// Blocky Worlds LOOK-FIX 2026-11-08 (owner: "the stacked tower close-up is a flat maroon wall: the camera is inside the
// object"): the min-distance guard for scene objects and set pieces, the same idea as the giants' clearGeometry
// (page/epicLayer.js) but for any box-like thing: the camera never stands inside an object's box or closer than a
// margin to it. It steps out along its own side (from the aim toward the camera, kept level), then looks at the aim again.
//   exitAlong(box, p, dir) -> t >= 0: how far p must move along dir to leave the box (0 when outside)   (pure, tested)
//   keepOut(THREE, camera, boxes, { aim, margin, maxSteps }) -> metres moved (0 = nothing to do)
//   objectMargin(userData) -> the margin for a kit object (bigger for big ones)

/** how far a point must travel along a unit direction to leave an axis-aligned box (min/max {x,y,z}); 0 if outside */
export function exitAlong(box, p, dir) {
  const inside = p.x > box.min.x && p.x < box.max.x && p.y > box.min.y && p.y < box.max.y && p.z > box.min.z && p.z < box.max.z;
  if (!inside) return 0;
  let t = Infinity;
  for (const k of ["x", "y", "z"]) {
    const d = dir[k];
    if (Math.abs(d) < 1e-6) continue;
    const tk = d > 0 ? (box.max[k] - p[k]) / d : (box.min[k] - p[k]) / d;
    if (tk >= 0) t = Math.min(t, tk);
  }
  return Number.isFinite(t) ? t : 0;
}

/** the margin around a kit object: 0.8 m, big things (towers, houses) a little more */
export function objectMargin(u = {}) {
  const h = Number(u.height) || 1;
  return u.big ? Math.max(1.5, Math.min(4, h * 0.1)) : Math.max(0.6, Math.min(1.5, h * 0.35));
}

/**
 * boxes: [{ box: Box3 (world), margin }]; aim: Vector3 the camera looks at (default: 10 m ahead).
 * The camera moves along (camera - aim) flattened to the ground plane (straight back if that is ~0) until it is outside
 * every expanded box; then it looks at the aim again. -> metres moved
 */
export function keepOut(THREE, camera, boxes, { aim = null, maxSteps = 6 } = {}) {
  if (!boxes?.length) return 0;
  camera.updateMatrixWorld();
  const p = camera.position;
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const target = aim ? aim.clone() : p.clone().addScaledVector(fwd, 10);
  const dir = p.clone().sub(target); dir.y = 0;
  if (dir.lengthSq() < 1e-6) { dir.set(-fwd.x, 0, -fwd.z); if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); }
  dir.normalize();
  let moved = 0;
  for (let s = 0; s < maxSteps; s++) {
    let step = 0;
    for (const { box, margin = 0.8 } of boxes) {
      if (!box || box.isEmpty?.()) continue;
      const b = box.clone().expandByScalar(margin);
      const t = exitAlong(b, p, dir);
      if (t > step) step = t;
    }
    if (step <= 0) break;
    p.addScaledVector(dir, step + 0.05); moved += step + 0.05;
  }
  if (moved > 0) { camera.lookAt(target); camera.updateMatrixWorld(); }
  return moved;
}
