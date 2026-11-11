// Kit: the token, the story's recurring prop (the owner's rule 8 of 2026-11-11, from the competitor's storm drain: a
// tennis ball sits by the curb in the first third, rides the flood into the drain, floats along the pipe and comes out
// at the river; the viewer follows one small thing through the whole build). Kind "token" (m2/parts.js):
//   type     tennisBall (default) | duck | leaf | boat | bottle | ball
//   pos      [x, y, z] where it sits (its base)
//   path     [[x, y, z], ...] the points it rides along (from pos, or from the path's first point)
//   size     its size in metres (default per type, storybook-large so it reads on a phone: a 0.35 m tennis ball)
//   float    true: it bobs and rolls a little (on water); default true for duck, boat, bottle and leaf on a path
// Channels (m2/verbs.js): show (sit: it pops in at pos), ride (0 -> 1 along the path; a ride's amp is the share of the
// path it covers, so ride amp 0.5 twice goes half way, then the rest), stop (a ride cut short: the token holds where
// it is until the next ride starts). A ball rolls (its spin matches the distance), a duck, a boat or a bottle turns
// to face where it goes, a leaf flutters. Deterministic: every pose is a function of t.
import { model } from "./models.js";
import { EASES } from "../m2/curves.js";

export const TOKEN_TYPES = Object.freeze(["tennisBall", "duck", "leaf", "boat", "bottle", "ball"]);
const SIZE = { tennisBall: 0.35, duck: 0.45, leaf: 0.4, boat: 0.6, bottle: 0.5, ball: 0.4 };
const FLOATS = new Set(["duck", "boat", "bottle", "leaf"]);
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const v3 = (a, d) => (Array.isArray(a) && a.length === 3 && a.every((x) => Number.isFinite(Number(x))) ? a.map(Number) : d);

/** the token's settings with their defaults (pure: Node) */
export function tokenSpec(p = {}) {
  const type = TOKEN_TYPES.includes(p.type) ? p.type : "tennisBall";
  const pos = v3(p.pos, null), raw = Array.isArray(p.path) ? p.path.map((q) => v3(q, null)).filter(Boolean) : [];
  const start = pos ?? raw[0] ?? [0, 0.1, -1];
  // (the ride starts where it sits: pos goes first unless the path already begins there)
  const path = raw.length ? (pos && Math.hypot(...raw[0].map((c, i) => c - pos[i])) > 0.05 ? [pos, ...raw] : raw) : [start];
  return { type, pos: start, path, size: Math.max(0.05, num(p.size, SIZE[type])), float: p.float ?? (FLOATS.has(type) && raw.length > 0) };
}
/** the point at a share u (0..1) of a path's length, and the direction there (pure) */
export function along(path, u) {
  if (path.length < 2) return { at: path[0], dir: [0, 0, 1], dist: 0 };
  const lens = path.slice(1).map((q, i) => Math.hypot(...q.map((c, k) => c - path[i][k]))), L = lens.reduce((a, b) => a + b, 0) || 1;
  let d = Math.max(0, Math.min(1, u)) * L;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) { const k = lens[i] ? Math.min(1, d / lens[i]) : 0, a = path[i], b = path[i + 1]; const dir = b.map((c, j) => (c - a[j]) / (lens[i] || 1)); return { at: a.map((c, j) => c + (b[j] - c) * k), dir, dist: Math.max(0, Math.min(1, u)) * L }; }
    d -= lens[i];
  }
  return { at: path.at(-1), dir: [0, 0, 1], dist: L };
}
/** how far along the path at t (pure): the ride ramps added up, each cut short by the first stop inside it */
export function rideShare(rides = [], stops = [], t) {
  let v = 0;
  for (const r of rides) {
    const cut = stops.map((s) => s.t0).filter((s) => s > r.t0 && s < r.t1).sort((a, b) => a - b)[0];
    const te = Math.min(t, cut ?? Infinity), u = r.t1 > r.t0 ? Math.max(0, Math.min(1, (te - r.t0) / (r.t1 - r.t0))) : te >= r.t0 ? 1 : 0;
    v += num(r.amp, 1) * (EASES[r.e] ?? EASES.inOut)(u);
  }
  return Math.max(0, Math.min(1, v));
}
/** the box the token can be in: where it sits and its whole path (the camera frames the ride; pure) */
export function tokenBox(p = {}) {
  const s = tokenSpec(p), pad = s.size;
  return { min: [0, 1, 2].map((i) => Math.min(...s.path.map((q) => q[i])) - pad), max: [0, 1, 2].map((i) => Math.max(...s.path.map((q) => q[i])) + pad * (i === 1 ? 2 : 1)) };
}

/** the token's look, built at its own size 1 (scaled later): a group whose base is at y 0 */
function tokenLook(ctx, type) {
  const { THREE } = ctx, g = new THREE.Group();
  const mesh = (geo, mat, y = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  if (type === "tennisBall" || type === "ball") {
    // a felt ball (sheen, no gloss) with its white seam curve; a baseball is white with a red seam
    const tennis = type === "tennisBall";
    const felt = new THREE.MeshPhysicalMaterial({ color: tennis ? "#c9dc3a" : "#efeae0", roughness: 0.95, sheen: 1, sheenColor: new THREE.Color(tennis ? "#f1ff9a" : "#ffffff"), sheenRoughness: 0.6 });
    const ball = mesh(new THREE.SphereGeometry(0.5, 32, 20), felt, 0.5);
    const pts = []; for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2, v = new THREE.Vector3(Math.cos(a) + 0.42 * Math.cos(3 * a), Math.sin(a) - 0.42 * Math.sin(3 * a), 0.9 * Math.sin(2 * a)).normalize().multiplyScalar(0.502); pts.push(v); }
    const seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.018, 6, true), new THREE.MeshStandardMaterial({ color: tennis ? "#f4f4ee" : "#b8322a", roughness: 0.8 }));
    ball.add(seam);
    return { g, roll: ball, r: 0.5 };
  }
  if (type === "duck") {
    // the Poly Haven rubber duck (CC0, fetchPolyModels.mjs); a simple duck of spheres until it loads (or without it)
    const yellow = new THREE.MeshPhysicalMaterial({ color: "#f2c21b", roughness: 0.35, clearcoat: 0.6 });
    const body = mesh(new THREE.SphereGeometry(0.42, 24, 16), yellow, 0.36); body.scale.set(1.15, 0.8, 0.95);
    const head = mesh(new THREE.SphereGeometry(0.25, 20, 14), yellow, 0.8); head.position.x = 0.22;
    const beak = mesh(new THREE.ConeGeometry(0.09, 0.2, 12), new THREE.MeshStandardMaterial({ color: "#e8731c", roughness: 0.5 }), 0.76); beak.rotation.z = -Math.PI / 2; beak.position.x = 0.5;
    const simple = [body, head, beak];
    if (ctx.gltf) model(ctx, "polyhaven/rubber_duck_toy/rubber_duck_toy.gltf", { parent: g, size: 1, rotY: -Math.PI / 2 }, () => { for (const m of simple) m.visible = false; });
    // (the duck model faces +z; turned so it faces +x, like the simple one: the token turns +x toward where it goes)
    return { g, face: true };
  }
  if (type === "leaf") {
    const s = new THREE.Shape(); s.moveTo(0, -0.5); s.bezierCurveTo(0.42, -0.25, 0.38, 0.25, 0, 0.5); s.bezierCurveTo(-0.38, 0.25, -0.42, -0.25, 0, -0.5);
    const leaf = mesh(new THREE.ShapeGeometry(s, 16), new THREE.MeshStandardMaterial({ color: "#b0612a", roughness: 0.75, side: THREE.DoubleSide }), 0.02);
    leaf.rotation.x = -Math.PI / 2; leaf.rotation.z = Math.PI / 2;
    mesh(new THREE.BoxGeometry(0.9, 0.012, 0.025), new THREE.MeshStandardMaterial({ color: "#7d4420", roughness: 0.8 }), 0.03);
    return { g, face: true, flutter: leaf };
  }
  if (type === "boat") {
    // a little wooden toy boat: a tapered hull, a mast and a white sail
    const s = new THREE.Shape(); s.moveTo(-0.5, 0.18); s.lineTo(0.5, 0.18); s.lineTo(0.32, 0); s.lineTo(-0.42, 0); s.lineTo(-0.5, 0.18);
    const hull = new THREE.ExtrudeGeometry(s, { depth: 0.34, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }); hull.translate(0, 0, -0.17);
    mesh(hull, new THREE.MeshStandardMaterial({ color: "#8a4b2a", roughness: 0.6 }));
    mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 8), new THREE.MeshStandardMaterial({ color: "#c9b28a", roughness: 0.6 }), 0.48);
    const sail = new THREE.Shape(); sail.moveTo(0, 0); sail.lineTo(0.3, 0); sail.lineTo(0, 0.45);
    const sm = mesh(new THREE.ShapeGeometry(sail), new THREE.MeshStandardMaterial({ color: "#f3efe6", roughness: 0.8, side: THREE.DoubleSide }), 0.24); sm.position.x = 0.02;
    return { g, face: true };
  }
  // bottle: a clear plastic bottle with a blue cap, lying on its side
  const prof = [[0, 0], [0.16, 0], [0.18, 0.04], [0.18, 0.6], [0.12, 0.72], [0.06, 0.8], [0.06, 0.9], [0, 0.9]].map(([x, y]) => new THREE.Vector2(x, y));
  const bottle = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), new THREE.MeshPhysicalMaterial({ color: "#cfe4ee", roughness: 0.08, transparent: true, opacity: 0.55, clearcoat: 1, depthWrite: false }));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 16), new THREE.MeshStandardMaterial({ color: "#2f6fb0", roughness: 0.4 })); cap.position.y = 0.93;
  const lie = new THREE.Group(); lie.add(bottle, cap); lie.rotation.z = -Math.PI / 2; lie.position.set(-0.45, 0.18, 0); g.add(lie);
  return { g, face: true };
}

/** the built token: group + update(t) from api (show, ride, stop) */
export function buildToken(ctx, p = {}, api) {
  const s = tokenSpec(p), look = tokenLook(ctx, s.type), g = look.g;
  g.scale.setScalar(s.size); g.visible = false; g.position.set(...s.pos); ctx.scene.add(g);
  const shown = !!api.cue("show"), riders = api.cues("ride"), stops = api.cues("stop");
  let yaw = 0;
  return {
    group: g,
    update(t) {
      const sh = shown ? Math.max(0, Math.min(1.2, api.ch("show", t))) : riders.some((r) => t >= r.t0) ? 1 : 0;
      g.visible = sh > 0.002;
      const u = rideShare(riders, stops, t), { at, dir, dist } = along(s.path, u);
      // (a token that floats bobs on the water's surface and rocks a little; on a path only, so a sitting ball stays still)
      const bob = s.float ? 0.12 * s.size * Math.sin(t * 2.3) : 0;
      g.position.set(at[0], at[1] + bob, at[2]);
      g.scale.setScalar(s.size * Math.max(0.001, sh));
      if (look.face && Math.hypot(dir[0], dir[2]) > 1e-3 && u > 0) yaw = Math.atan2(-dir[2], dir[0]);
      g.rotation.set(s.float ? 0.08 * Math.sin(t * 1.7) : 0, look.face ? yaw : 0, s.float ? 0.06 * Math.sin(t * 2.1 + 1) : 0);
      // a ball rolls: the spin matches the distance (about the axis across its way)
      if (look.roll) { const ax = Math.atan2(dir[0], dir[2]); look.roll.rotation.set(0, 0, 0); look.roll.rotateOnWorldAxis(new ctx.THREE.Vector3(Math.cos(ax), 0, -Math.sin(ax)), dist / (look.r * s.size)); }
      if (look.flutter) look.flutter.rotation.y = 0.25 * Math.sin(t * 3.1);
    },
  };
}
