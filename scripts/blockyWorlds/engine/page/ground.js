// Blocky Worlds ATTACH (2026-11-07, owner: "FLOATING PEOPLE: everything on a creature must be attached to it and move
// with it when it walks. Feet always on the ground."): ground contact, shared by the engine (snap people onto the real
// walkable surface once per shot) and the free dev check (dev/groundProbe.mjs: per actor gap feet -> surface, per frame).
//   groundUnder(THREE, root, p, { above, below, maxUp, skip })  -> { y, object, point } | null
//       a ray straight down from p.y + above (never from higher: no roofs / awnings / canopies), the first walkable hit
//       at or below p.y + maxUp. Walkable: a visible opaque mesh that is not a person, a crowd, a marker, grass blades,
//       leaves or dust (userData.noGround marks anything else to skip).
//   personFeet(THREE, person)        -> [Vector3 world] the sole bottom of each foot (people.js rig)
//   giantFeet(THREE, giant)          -> [{ p: Vector3 world (lowest point of the foot block), size }]
//   crowdBases(THREE, crowd)         -> [Vector3 world] each visible crowd character's foot level (crowd.js C.base)
//   measureContact(THREE, scene, S, opts) -> { rows: [{ kind, id, gap, foot }], ... } gap > 0 floating, < 0 sinking
const SKIP_NAMES = /^(grass|dust|leaves|ferns?|fx|sky|clouds?|rain|snow|smoke|spray|splash)/i;

export function walkable(o, skip = null) {
  if (!o.isMesh || o.isPoints || o.isSprite || o.isLine) return false;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!m || m.visible === false || m.transparent || (m.alphaTest ?? 0) > 0 || m.isShaderMaterial || m.isMeshBasicMaterial) return false;
  for (let p = o; p; p = p.parent) {
    if (p.visible === false) return false;
    if (p.userData?.noGround || p.userData?.crowd || p.userData?.joints?.knee && p.userData?.joints?.pelvis) return false;
    if (SKIP_NAMES.test(p.name ?? "")) return false;
    if (skip && skip.has(p)) return false;
  }
  return true;
}

const rcCache = new WeakMap();
export function groundUnder(THREE, root, p, { above = 1.0, below = 4, maxUp = 0.45, skip = null, closest = true } = {}) {
  let rc = rcCache.get(THREE); if (!rc) { rc = new THREE.Raycaster(); rcCache.set(THREE, rc); }
  rc.set(new THREE.Vector3(p.x, p.y + above, p.z), new THREE.Vector3(0, -1, 0));
  rc.near = 0; rc.far = above + below;
  const roots = Array.isArray(root) ? root : [root];
  const hits = rc.intersectObjects(roots, true);
  let best = null;
  for (const h of hits) {
    if (h.point.y > p.y + maxUp + 1e-6) continue;
    if (!walkable(h.object, skip)) continue;
    if (h.face && h.object.isMesh) { // the top of something (a floor), not a wall's side seen edge-on
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      if (h.instanceId != null) { const m = new THREE.Matrix4(); h.object.getMatrixAt(h.instanceId, m); n.copy(h.face.normal).transformDirection(m).transformDirection(h.object.matrixWorld); }
      if (n.y < 0.35) continue;
    }
    const out = { y: h.point.y, object: h.object, point: h.point.clone(), instanceId: h.instanceId ?? null };
    if (!closest) return out;
    // the surface nearest the planned feet (a floor under a low table, not the table top; the street, not a crate)
    if (!best || Math.abs(out.y - p.y) < Math.abs(best.y - p.y)) best = out;
  }
  return best;
}

/**
 * ATTACH-2 (owner: "an actor without a valid surface under it is moved to the nearest valid spot, never left floating"):
 * a person stands at p (world) only if the ground under the centre AND under its whole footprint (both soles, heel to
 * toe: +-0.2 m across, -0.15 / +0.25 m along) is one level within tol (no wall edge, kerb, deck edge or crate corner
 * under half a foot). -> the ground height there, or null
 */
export function standY(THREE, root, p, { skip = null, tol = 0.03, above = 1.0, below = 0.6, maxUp = 0.45, foot = [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.25], [0.2, 0.25]] } = {}) {
  const c = groundUnder(THREE, root, p, { above, below, maxUp, skip });
  if (!c) return null;
  const q = new THREE.Vector3();
  for (const [dx, dz] of foot) {
    const h = groundUnder(THREE, root, q.set(p.x + dx, c.y, p.z + dz), { above, below: 0.3, maxUp: 0.3, skip });
    if (!h || Math.abs(h.y - c.y) > tol) return null;
  }
  return c.y;
}

/** the nearest spot (world) within maxR of p where standY holds and ok(spot) agrees: rings of 0.25 m -> Vector3 | null */
export function findStandSpot(THREE, root, p, { maxR = 2.5, ok = null, ...o } = {}) {
  const y0 = standY(THREE, root, p, o);
  if (y0 != null && (!ok || ok(new THREE.Vector3(p.x, y0, p.z)))) return new THREE.Vector3(p.x, y0, p.z);
  for (let r = 0.25; r <= maxR + 1e-6; r += 0.25) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / 0.25));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, q = new THREE.Vector3(p.x + Math.cos(a) * r, p.y, p.z + Math.sin(a) * r);
      const y = standY(THREE, root, q, o);
      if (y != null && (!ok || ok(q.setY(y)))) return q.setY(y);
    }
  }
  return null;
}

/** the bottom of each sole (people.js: knee -> shoe at -0.43, sole at -0.47, 0.035 thick, z -0.1125 .. 0.2125), world space */
export function personFeet(THREE, o) {
  const k = o.userData?.joints?.knee ?? [];
  o.updateMatrixWorld(true);
  // the lower of the heel and toe edges (people.js SOLE_Z): the point that touches the ground
  return k.map((kn) => { const h = kn.localToWorld(new THREE.Vector3(0, -0.4875, -0.1125)), t = kn.localToWorld(new THREE.Vector3(0, -0.4875, 0.2125)); return h.y < t.y ? h : t; });
}

/** each foot block's lowest world point (animal rigs: joints.feet; classic giants: the leg chains' lowest mesh) */
export function giantFeet(THREE, g) {
  const J = g.userData?.joints ?? {};
  const feet = (J.feet?.length ? J.feet : J.knees?.length ? J.knees : J.legs ?? []).filter(Boolean);
  g.updateMatrixWorld(true);
  const out = [];
  for (const f of feet) {
    const b = new THREE.Box3().setFromObject(f, true);
    if (b.isEmpty()) continue;
    const c = b.getCenter(new THREE.Vector3());
    out.push({ p: new THREE.Vector3(c.x, b.min.y, c.z), size: Math.max(b.max.x - b.min.x, b.max.z - b.min.z) });
  }
  return out;
}

/** crowd.js stores each character's ground point (formation local, the crowd group's parent space) in C.base */
export function crowdBases(THREE, grp) {
  const C = grp.userData?.crowd, base = C?.base;
  if (!base) return [];
  grp.updateMatrixWorld(true);
  const M = grp.matrixWorld, out = [];
  for (let i = 0; i < base.length; i += 4) if (base[i + 3] > 0) out.push(new THREE.Vector3(base[i], base[i + 1], base[i + 2]).applyMatrix4(M));
  return out;
}

const vis = (o) => { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; };

/**
 * measure every visible actor's contact this frame. rows: { kind: person|crowd|giant, id, gap (m, + floating,
 * - sinking), tol (m), local: the foot in the hit surface's local frame (drift across frames = sliding / not attached) }
 *   opts.crowdSample: how many crowd characters per crowd (default 12, spread evenly)
 */
export function measureContact(THREE, scene, S, opts = {}) {
  const rows = [], root = S?.root ?? scene, sample = opts.crowdSample ?? 12;
  const local = (hit, p) => (hit ? hit.object.worldToLocal(p.clone()).toArray().map((v) => +v.toFixed(3)) : null);
  const people = [], crowds = [], giants = [];
  scene.traverse((o) => {
    if (!vis(o)) return;
    if (o.userData?.joints?.knee && o.userData?.joints?.pelvis) people.push(o);
    else if (o.userData?.crowd) crowds.push(o);
    else if (/^giant:/.test(o.name ?? "") && (o.userData?.joints?.feet?.length || o.userData?.joints?.legs?.length)) giants.push(o);
  });
  for (const o of people) {
    if (o.userData.offGround) continue; // sitting / lying / riding / climbing / flying (engine marks them per frame)
    const feet = personFeet(THREE, o); if (!feet.length) continue;
    let best = null;
    for (const f of feet) {
      const hit = groundUnder(THREE, root, f, { above: 1.0, below: 4, maxUp: 0.9 });
      const gap = hit ? f.y - hit.y : Infinity;
      if (!best || Math.abs(gap) < Math.abs(best.gap) || (gap < 0 && best.gap > 0 && Math.abs(gap) <= Math.abs(best.gap))) best = { gap, hit, f };
    }
    // the set's own surface under the same foot (mount coordinates): tells a placement miss from a surface mismatch
    let sGap = null; const mnt = S?.actorMount?.();
    if (mnt && S.surface) { const f = mnt.worldToLocal(best.f.clone()), y = S.surface(f.x, f.z); sGap = y == null ? null : +(f.y - y).toFixed(3); }
    rows.push({ kind: "person", id: o.userData.id ?? o.name ?? "person", gap: best.gap, sGap, tol: 0.03, local: local(best.hit, o.getWorldPosition(new THREE.Vector3())), on: best.hit?.object.name ?? null }); // drift: the person's root (a walking foot swings)
  }
  for (const g of crowds) {
    const pts = crowdBases(THREE, g); if (!pts.length) continue;
    const step = Math.max(1, Math.floor(pts.length / sample));
    for (let i = 0; i < pts.length; i += step) {
      const hit = groundUnder(THREE, root, pts[i], { above: 1.0, below: 4, maxUp: 0.9 });
      rows.push({ kind: "crowd", id: `${g.name || "crowd"}#${i}`, gap: hit ? pts[i].y - hit.y : Infinity, tol: 0.05, local: local(hit, pts[i]), on: hit?.object.name ?? null });
    }
  }
  if (opts.giants !== false) for (const g of giants) {
    if (g === S?.giant && S?.giantView !== "outside") continue; // the world's own creature in the on / street view: the town IS on it
    const feet = giantFeet(THREE, g); if (!feet.length) continue;
    const unit = g.userData.unit ?? 1;
    let best = null;
    for (const f of feet) {
      const hit = groundUnder(THREE, root === g ? scene : [root, ...(g.parent && g.parent !== root ? [] : [])], f.p, { above: Math.max(1, f.size), below: 8 * unit, maxUp: f.size * 0.6, skip: new Set([g]) });
      const gap = hit ? f.p.y - hit.y : Infinity;
      if (!best || gap < best.gap) best = { gap, hit, f };
    }
    if (g.userData.swimming || S?.coast?.active) continue;
    rows.push({ kind: "giant", id: g.name, gap: best.gap, tol: 0.03 * unit * 2, local: null, on: best.hit?.object.name ?? null });
  }
  // the houses on the creature: a few house bases of its back town in the frame of the creature's surface joint (the
  // shell when it has its own, else the body): constant across walk frames = attached
  const g = S?.giant, town = g?.userData?.backTown;
  if (g && town && vis(town)) {
    const J = g.userData.joints, surfJ = J.shell && J.shell !== J.body ? J.shell : J.body, plan = town.userData.plan;
    town.updateMatrixWorld(true);
    const hs = (plan?.houses ?? []).filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 6)) === 0).slice(0, 6);
    hs.forEach((h, i) => {
      const w = town.localToWorld(new THREE.Vector3(h.x, h.y, h.z));
      rows.push({ kind: "house", id: `house#${i}`, gap: 0, tol: 0, local: surfJ.worldToLocal(w.clone()).multiplyScalar(g.userData.unit ?? 1).toArray().map((v) => +v.toFixed(3)), on: surfJ.name || "body" });
    });
  }
  return { rows };
}
