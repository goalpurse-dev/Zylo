// Blocky Worlds CAPABILITIES (2026-11-06): chains, ropes, cables and rope bridges between any two points, instanced
// (one draw call per tether), in the block look (chunky rusty links, braided-looking rope blocks, plank bridges).
//   makeTether({ kind: chain|rope|cable|bridge, thick (m), hook, maxLinks }) -> Group
//   updateTether(g, a: Vector3, b: Vector3, st (lib/caps.js tetherState), { hookPos?, seed, lat? }) every frame
//     taut / slack / swing: a catenary-like hang from a to b; fire: the line pays out from a to hookPos (the hook
//     flying on its arc), then to b; snap: two halves whip down from their anchors + flying links from the break
import * as THREE from "three";
import { tetherPoint, snapHalf, burstPiece } from "../../lib/caps.js";

const MATS = new Map();
const mat = (k, f) => (MATS.has(k) ? MATS.get(k) : (MATS.set(k, f()), MATS.get(k)));
const LOOK = {
  chain: { color: "#7a4528", rough: 0.55, metal: 0.45, pitch: 2.1 },
  rope: { color: "#b8925e", rough: 0.95, metal: 0, pitch: 1.6 },
  cable: { color: "#3a3f47", rough: 0.5, metal: 0.6, pitch: 3.0 },
  bridge: { color: "#9a6a3c", rough: 0.9, metal: 0, pitch: 1.0 },
};

function hookMesh(thick) {
  const g = new THREE.Group(); g.name = "hook";
  const m = mat("hook", () => new THREE.MeshStandardMaterial({ color: "#5d636b", roughness: 0.4, metalness: 0.7 }));
  const shank = new THREE.Mesh(new THREE.BoxGeometry(thick * 0.9, thick * 0.9, thick * 5), m); shank.position.z = -thick * 1.5; g.add(shank);
  for (let i = 0; i < 3; i++) {
    const piv = new THREE.Group(); piv.rotation.z = (i * Math.PI * 2) / 3; const q = new THREE.Mesh(new THREE.BoxGeometry(thick * 0.7, thick * 2.6, thick * 0.7), m);
    q.position.set(0, thick * 1.2, thick * 0.4); q.rotation.x = -0.7; piv.add(q); g.add(piv);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(thick * 0.5, thick * 1.4, 4), m); tip.position.set(0, thick * 2.3, -thick * 0.5); tip.rotation.x = Math.PI; piv.add(tip);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

export function makeTether({ kind = "chain", thick = 0.5, hook = false, maxLinks = 700 } = {}) {
  const L = LOOK[kind] ?? LOOK.chain;
  const g = new THREE.Group(); g.name = `tether:${kind}`;
  let geo;
  if (kind === "chain") { geo = new THREE.TorusGeometry(thick * 1.0, thick * 0.34, 8, 14); geo.rotateY(Math.PI / 2); geo.scale(1, 1, 1.45); }
  else if (kind === "bridge") geo = new THREE.BoxGeometry(thick * 6, thick * 0.35, thick * 1.6);
  else { geo = new THREE.BoxGeometry(thick, thick, 1); }
  const m = mat(`t:${kind}`, () => new THREE.MeshStandardMaterial({ color: L.color, roughness: L.rough, metalness: L.metal }));
  const im = new THREE.InstancedMesh(geo, m, maxLinks); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.name = "links";
  g.add(im);
  // a rope bridge also has two hand ropes (cable look, thin)
  let rails = null;
  if (kind === "bridge") { rails = new THREE.InstancedMesh(new THREE.BoxGeometry(thick * 0.35, thick * 0.35, 1), mat("t:rope", () => new THREE.MeshStandardMaterial({ color: LOOK.rope.color, roughness: 0.95 })), maxLinks * 2); rails.count = 0; rails.frustumCulled = false; rails.castShadow = true; g.add(rails); }
  // flying links (snap)
  const fly = new THREE.InstancedMesh(geo, m, 16); fly.count = 0; fly.frustumCulled = false; fly.castShadow = true; g.add(fly);
  const hk = hook ? hookMesh(thick) : null; if (hk) g.add(hk);
  g.userData = { kind, thick, pitch: L.pitch * thick, im, rails, fly, hook: hk, maxLinks };
  return g;
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1), _t = new THREE.Vector3();
const arr = (v) => [v.x, v.y, v.z];

/** lay instances along a polyline function f(s) -> [x,y,z], from index k0; returns the next index */
function lay(im, f, n, k0, { roll = true, ry = 0, len = null, offY = 0 } = {}) {
  let k = k0;
  for (let i = 0; i < n && k < im.instanceMatrix.count; i++) {
    const s0 = (i + 0.5) / n, p = f(s0), pa = f(Math.max(0, s0 - 0.5 / n)), pb = f(Math.min(1, s0 + 0.5 / n));
    _t.set(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]); const seg = _t.length(); if (seg < 1e-6) _t.set(0, 0, 1); _t.normalize();
    _q.setFromUnitVectors(_z, _t);
    if (roll && i % 2) _q.multiply(_q2.setFromAxisAngle(_z, Math.PI / 2));
    if (ry) _q.multiply(_q2.setFromAxisAngle(_z, ry));
    _s.set(1, 1, len ? seg * 1.04 : 1);
    _m.compose(_v.set(p[0], p[1] + offY, p[2]), _q, _s); im.setMatrixAt(k++, _m);
  }
  return k;
}

export function updateTether(g, a, b, st, { hookPos = null, seed = 1, lat = null } = {}) {
  const { im, rails, fly, hook, pitch, kind, thick } = g.userData;
  const A = arr(a), B = arr(b);
  const span = a.distanceTo(b);
  const latV = lat ? arr(lat) : (() => { const d = new THREE.Vector3().subVectors(b, a); const l = new THREE.Vector3(d.z, 0, -d.x); if (l.lengthSq() < 1e-6) l.set(1, 0, 0); l.normalize(); return arr(l); })();
  const rope = kind !== "chain" && kind !== "bridge";
  let k = 0, rk = 0;
  fly.count = 0;
  if (st.broken) {
    // the two halves whip down from their anchors; a burst of links where it broke
    const brk = tetherPoint(A, B, 0.5, { sag: 0.02, swing: 0 });
    const half = span / 2, n = Math.max(2, Math.round(half / pitch));
    k = lay(im, (s) => snapHalf(A, brk, s, st.breakK, half * 0.9), n, k, { roll: !rope, len: rope });
    k = lay(im, (s) => snapHalf(B, brk, s, st.breakK, half * 0.9), n, k, { roll: !rope, len: rope });
    const nf = kind === "chain" ? 12 : 6;
    for (let i = 0; i < nf; i++) {
      const p = burstPiece(i, nf, st.bt ?? 0, { seed, speed: Math.max(6, thick * 18), size: 1 });
      _q.setFromEuler(new THREE.Euler(p.rx, p.ry, 0)); _m.compose(_v.set(brk[0] + p.x, brk[1] + p.y, brk[2] + p.z), _q, _s.setScalar(Math.max(0.01, p.s)));
      fly.setMatrixAt(i, _m);
    }
    fly.count = nf; fly.instanceMatrix.needsUpdate = true;
    if (hook) hook.visible = false;
  } else {
    const end = hookPos ? arr(hookPos) : B;
    const reach = st.reach ?? 1;
    const L = Math.hypot(end[0] - A[0], end[1] - A[1], end[2] - A[2]);
    const n = Math.max(2, Math.min(im.instanceMatrix.count - 2, Math.round((L * (1 + st.sag * 1.5)) / pitch)));
    const f = (s) => {
      const p = tetherPoint(A, end, s, st, latV);
      if (st.tension) { const w = st.tension * thick * 0.5 * Math.sin(s * span * 0.9 + seed * 3) * Math.sin(Math.PI * s); p[1] += w; }
      return p;
    };
    if (reach > 0.001) {
      if (kind === "bridge") {
        k = lay(im, f, n, k, { roll: false });
        for (const side of [-1, 1]) { const off = thick * 2.9 * side; rk = lay(rails, (s) => { const p = f(s); return [p[0] + latV[0] * off, p[1] + thick * 3, p[2] + latV[2] * off]; }, Math.max(2, Math.round(n / 2)), rk, { roll: false, len: true }); }
      } else k = lay(im, f, n, k, { roll: !rope, len: rope });
    }
    if (hook) {
      hook.visible = reach > 0.001;
      const hp = end, prev = f(0.97);
      hook.position.set(hp[0], hp[1], hp[2]);
      _t.set(hp[0] - prev[0], hp[1] - prev[1], hp[2] - prev[2]); if (_t.lengthSq() < 1e-8) _t.set(0, 0, 1);
      hook.quaternion.setFromUnitVectors(_z, _t.normalize());
    }
  }
  im.count = k; im.instanceMatrix.needsUpdate = true;
  if (rails) { rails.count = rk; rails.instanceMatrix.needsUpdate = true; }
  return { links: k };
}
