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

/**
 * SHOT GRAMMAR v2 (2026-11-09, lib/shotGrammar.js): the share of the frame height a person's head takes in a framing
 * (the same lens / distance numbers as frameShot below; the head ~0.2 of an adult blocky person's height). Pure: the planner
 * reads it to keep every character shot's face readable (>= GRAMMAR.headMin). framing: a set's roomier factor.
 */
export function headShare(type, H = 1.7, { framing = 1, otherDist = 2.2, headFrac = 0.2 } = {}) {
  H = Math.max(0.3, Number(H) || 1.7);
  const head = H * headFrac, t = (deg) => Math.tan((deg * DEG) / 2);
  let span;
  switch (type) {
    case "closeup": span = Math.max(1.0, H * 0.72); break;
    case "medium": span = Math.max(1.05, H * 0.95); break;
    case "low": span = 2 * Math.min(7, Math.max(2.4, H * 1.05)) * t(62); break;
    case "over_shoulder": span = 2 * (2.1 + otherDist) * t(42); break;
    case "wide": span = 2 * Math.max(5.6, H * 1.5) * t(56); break;
    case "insert": span = Math.max(1.4, H * 2.4); break;
    default: span = 2 * 30 * t(50); break; // EPIC cameras: a person is a speck
  }
  return Math.round((head / (span * Math.max(1, Number(framing) || 1))) * 1000) / 1000;
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
      const B = Math.max(tall ? 3.2 : 2.1, (Number(ctx.otherRadius) || 0) + 1.3), C = new THREE.Vector3();
      if ((Number(ctx.otherRadius) || 0) > 0.6) camY = o.y + Math.min(oh * 0.95, 2.6);
      // a wide "other" (a furry monster): its near EDGE, not its centre, goes to the frame edge (it filled the frame)
      const OR = Number(ctx.otherRadius) || 0;
      for (let L = 0.15; L < (OR > 0 ? 7 : 2.5); L += 0.03) {
        C.copy(o).addScaledVector(back, B).addScaledVector(lat, L); C.y = 0;
        const toAim = new THREE.Vector3(aim.x - C.x, 0, aim.z - C.z).normalize(), toNear = new THREE.Vector3(o.x - C.x, 0, o.z - C.z).normalize();
        const edge = OR > 0 ? Math.atan2(OR, Math.hypot(o.x - C.x, o.z - C.z)) : 0;
        if (Math.acos(Math.min(1, toAim.dot(toNear))) - edge * 0.6 >= want) break;
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

  // WORLD-FIX 2026-11-07: a set may ask for roomier framings (set.framing[type] = distance factor): the places in the
  // creature's town show the place (deck, stairs, rooftop, school yard) with the person in it, not a face filling the frame
  const fk = Number(set?.framing?.[type]) || 1;
  if (fk !== 1) { dist *= fk; camY += Math.min(1.2, (fk - 1) * 0.45); if (type === "medium") fov = 46; }

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
  // 2026-11-05 (GAPS): a set thing within ~2.5 m of the lens between it and the subject (a lamp post filling a wide):
  // the camera moves in front of it (cached per shot), the lens widened to keep the framing
  if (set?.root && type !== "insert" && type !== "closeup") {
    const k2 = `near|${key}`;
    let d2 = _ray.get(k2);
    if (d2 === undefined) {
      // a small fan of rays (the middle, left, right, low of the view near the lens): a thin pole beside the axis counts
      const from = new THREE.Vector3(aim.x, camY, aim.z), L = p.distanceTo(from), ax = new THREE.Vector3().subVectors(p, from).normalize();
      const side = new THREE.Vector3(ax.z, 0, -ax.x).normalize(), aimTo = (q) => { const dv = new THREE.Vector3().subVectors(q, from); const l = dv.length(); return [dv.normalize(), l]; };
      let best = null;
      for (const off of [[0, 0], [0.45, 0], [-0.45, 0], [0, -0.5], [0.3, 0.4], [-0.3, 0.4]]) {
        const q = p.clone().addScaledVector(side, off[0] * Math.max(1, L * 0.12)).add(new THREE.Vector3(0, off[1] * Math.max(1, L * 0.12), 0));
        const [dir, l] = aimTo(q);
        const hit = new THREE.Raycaster(from, dir, 0.3, l).intersectObject(set.root, true).find((h) => h.object.visible !== false && h.object.isMesh && h.distance > l - 2.5 && h.distance > l * 0.45);
        if (hit) { const d = Math.max(L * 0.45, hit.distance * (L / l) - 0.35); if (best == null || d < best) best = d; }
      }
      d2 = best; _ray.set(k2, d2);
    }
    if (d2 != null && d2 < dist) { const from = new THREE.Vector3(aim.x, camY, aim.z); const dir = new THREE.Vector3().subVectors(p, from).normalize(); p.copy(from).addScaledVector(dir, d2); dist = Math.min(dist, d2 * Math.hypot(dir.x, dir.z) || d2); }
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

  if (set?.bounds?.length && !inside(set.bounds, p)) { let bestB = null, bd = Infinity; for (const b of set.bounds) { const q = b.clampPoint(p, new THREE.Vector3()); const d = q.distanceTo(p); if (d < bd) { bd = d; bestB = q; } } if (bestB) p.copy(bestB); }
  camera.position.copy(p);
  camera.fov = fov; camera.far = Math.max(camera.far, 3000); camera.near = Math.min(camera.near, 0.1);
  camera.updateProjectionMatrix();
  camera.up.set(0, 1, 0);
  camera.lookAt(aim);
  camera.rotateX(-Math.atan(ndc * Math.tan(fov * DEG / 2)));
  camera.updateMatrixWorld();
  return camera;
}
