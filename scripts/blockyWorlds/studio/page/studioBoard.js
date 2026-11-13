// STUDIO MODE page adapter (browser ES module). Shipped INSIDE a RunPod job (studio/bundle.mjs) in place of
// /page/simple/board.js: it builds the real board set (the current board.js, shipped as /page/simple/board.base.js) and
// wraps its boardShot. A shot with `studio: <id>` is first staged by the board (its houses, rooms, places, people at
// their marks, the animated actions), then the agent's VALIDATED shot code (studio/validate.mjs) runs every frame with
// the `api` below: it moves people, the creature, props, animals, its own block-built things, and sets the camera.
// The code reaches nothing but `api` and `Math` (validated on the laptop before the job is sent); it gets no network,
// no DOM, no secrets. Deterministic in t.
import * as THREE from "three";
import { buildBoard as baseBuild } from "/page/simple/board.base.js";
import { mat, BOX } from "/page/simple/common.js";
import { makeProp } from "/page/simple/boardProps.js";
import { makeAnimal, animateAnimal } from "/page/kit/animals/index.js";
import { houseInfo, roomPoint, placePoint, streetPoint } from "/studio/world.js";

const ST = window.__STUDIO ?? { shots: {}, assets: {}, homes: {} };
const dec = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
const FN = new Map();
function compiled(kind, key) {
  const k = `${kind}:${key}`;
  if (!FN.has(k)) {
    const src = (kind === "shot" ? ST.shots : ST.assets)[key];
    // the body was validated on the laptop: only api.*, Math.* and its own locals; strict mode, no `this`
    FN.set(k, src ? new Function("api", "Math", `"use strict";\n${dec(src)}`) : null);
  }
  return FN.get(k);
}
const V = (a) => new THREE.Vector3(a?.[0] ?? 0, a?.[1] ?? 0, a?.[2] ?? 0);
const arr = (v) => [v.x, v.y, v.z];
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

export function buildBoard(opts) {
  const S = baseBuild(opts);
  const orig = S.boardShot;
  S.studio = { pool: new Map(), live: new Set(), root: new THREE.Group(), errors: [] };
  S.root.add(S.studio.root);
  // THE NIGHT FLOOR (owner 2026-11-12): a key light from the lens side, a cool rim behind the subject and a fill on the
  // creature's face, plus a soft sky fill; always in the scene (intensity 0 by day: no shader recompiles between cuts)
  const L = S.studio.lights = {
    key: new THREE.PointLight("#fff0dc", 0, 70, 1.0), rim: new THREE.PointLight("#a8c8ff", 0, 60, 1.0),
    face: new THREE.PointLight("#ffe2b8", 0, 40, 1.0), sky: new THREE.HemisphereLight("#7d9cff", "#3a3046", 0),
  };
  for (const l of Object.values(L)) S.studio.root.add(l);
  window.__studioErrsList = () => S.studio.errors; // the bundle's renderSheet sends them back with the stills
  window.__studioStats = () => S.studio.stats ?? null; // the last frame's geometry stats (person size, creature share)
  S.boardShot = (ctx) => {
    const r = orig(ctx);
    for (const o of S.studio.live) o.visible = false;
    S.studio.live.clear();
    if (!ctx.shot.studio) return r;
    return studioFrame(S, ctx, r);
  };
  return S;
}

function studioFrame(S, ctx, base) {
  const { shot, camera, people, monster, animateMonster, posePerson, setFace } = ctx;
  const t = Math.max(0, ctx.lt), dur = Math.max(0.05, ctx.dur);
  const night = shot.light === "night" || shot.light === "dusk";
  const sid = shot.studio, homes = shot.board?.homes ?? ST.homes ?? {};
  const SD = S.studio;
  let prims = 0, assets = 0, cam = null, shakeAmt = 0;
  const creatures = [];
  for (const l of Object.values(SD.lights)) l.intensity = 0;
  // a pooled object for this shot: created once, shown this frame
  const pooled = (key, make) => { let o = SD.pool.get(key); if (!o) { o = make(); SD.pool.set(key, o); } o.visible = true; SD.live.add(o); return o; };
  let primIdx = 0;
  const primParent = { cur: SD.root, prefix: `${sid}` };
  const placeT = (o, at, opts = {}) => {
    o.position.copy(V(at));
    if (opts.rot) o.rotation.set(opts.rot[0] ?? 0, opts.rot[1] ?? 0, opts.rot[2] ?? 0); else o.rotation.set(0, 0, 0);
  };
  const glowMat = (color, glow) => (glow ? mat(color, { emissive: color, ei: Math.min(3, glow) }) : mat(color));
  const prim = (kind, makeGeo, at, color, opts, scaleV) => {
    if (++prims > 150) throw new Error("more than 150 primitives this frame");
    const key = `${primParent.prefix}|${kind}|${primIdx++}`;
    const o = pooled(key, () => { const m = new THREE.Mesh(makeGeo(), glowMat(color, opts?.glow)); m.castShadow = true; m.receiveShadow = true; primParent.cur.add(m); return m; });
    if (o.parent !== primParent.cur) primParent.cur.add(o);
    const want = glowMat(String(color ?? "#cccccc"), opts?.glow); if (o.material !== want) o.material = want;
    placeT(o, at, opts); o.scale.copy(scaleV);
    return o;
  };
  const GEO = new Map();
  const geo = (k, f) => { if (!GEO.has(k)) GEO.set(k, f()); return GEO.get(k); };

  const api = {
    t, dur, k: Math.min(1, t / dur), night, p: {},
    ease, lerp: (a, b, k) => a + (b - a) * k, clamp: (x, a, b) => Math.min(b, Math.max(a, x)),
    mix: (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k],
    add: (p, d) => [p[0] + (d?.[0] ?? 0), p[1] + (d?.[1] ?? 0), p[2] + (d?.[2] ?? 0)],
    wave: (f, a, ph = 0) => a * Math.sin(2 * Math.PI * f * t + ph),
    orbit: (c, r, ang, h) => [c[0] + r * Math.sin(ang), (c[1] ?? 0) + h, c[2] + r * Math.cos(ang)],
    house: (o) => houseInfo(homes, o) ?? houseInfo(homes, Object.keys(homes)[0]),
    room: (o, x = 0, y = 0, z = 0) => roomPoint(homes, o, x, y, z) ?? [0, y, 0],
    place: (n, m = "center") => { const P = S.places?.[n]; const s = P?.spots?.[m] ?? P?.spots?.center; return s ? arr(s) : placePoint(n, m) ?? [0, 0, 0]; },
    street: (n) => streetPoint(n),
    pos: (id) => { const P = people[id]; return P ? arr(P.obj.position) : [0, 0, 0]; },
    head: (id) => { const P = people[id]; return P ? [P.obj.position.x, P.obj.position.y + P.headC, P.obj.position.z] : [0, 1.5, 0]; },
    person(id, o = {}) {
      const P = people[id]; if (!P) return;
      const ob = P.obj; ob.visible = true;
      if (o.at) ob.position.copy(V(o.at));
      ob.rotation.set(0, o.yaw ?? ob.rotation.y, 0);
      const pose = o.pose ?? "stand";
      posePerson(ob, pose, o.phase ?? t, { blink: !!o.blink });
      if (o.face) setFace(ob, o.face);
      const J = ob.userData.joints;
      if (J) {
        if (o.armR) J.sh[1].rotation.set(o.armR[0] ?? 0, o.armR[1] ?? 0, o.armR[2] ?? 0);
        if (o.armL) J.sh[0].rotation.set(o.armL[0] ?? 0, o.armL[1] ?? 0, o.armL[2] ?? 0);
        if (o.headTurn != null) J.head.rotation.y = o.headTurn;
        if (o.headTilt != null) J.head.rotation.x = o.headTilt;
        if (o.hold) {
          if (!o.armR && J.sh[1].rotation.x > -0.55) J.sh[1].rotation.x = -0.55;
          const g = pooled(`${sid}|hold|${id}|${o.hold}`, () => { const g = new THREE.Group(); g.userData.held = true; const p = makeProp(o.hold); if (p) { p.position.set(0, -0.16, 0.06); p.rotation.x = -Math.PI / 2; g.add(p); } return g; });
          if (g.parent !== J.hand[1]) J.hand[1].add(g);
          g.scale.setScalar(1 / Math.max(0.2, J.hand[1].getWorldScale(new THREE.Vector3()).x));
        }
      }
      ob.updateMatrixWorld(true);
    },
    hide(id) { const P = people[id]; if (P) P.obj.visible = false; },
    monster(o = {}) {
      if (!monster) return;
      const M = monster; M.visible = true;
      M.rotation.set(0, 0, 0); M.position.set(0, 0, 0);
      animateMonster(M, o.state ?? "lurk", t, { eye: o.eye ?? "stare", eyeAt: o.eyeAt ?? 0 });
      M.position.copy(V(o.at)); M.rotation.y = o.yaw ?? 0; M.scale.setScalar(o.scale ?? 1);
      M.updateMatrixWorld(true);
    },
    asset(name, params = {}) {
      if (++assets > 8) throw new Error("more than 8 assets this frame");
      const fn = compiled("asset", name); if (!fn) throw new Error(`no asset "${name}"`);
      const g = pooled(`${sid}|asset|${name}|${assets}`, () => { const g = new THREE.Group(); SD.root.add(g); return g; });
      g.position.copy(V(params.at)); g.rotation.set(0, params.yaw ?? 0, 0); g.scale.setScalar(params.scale ?? 1);
      g.userData.creature = (ST.creatures ?? []).includes(name); if (g.userData.creature) creatures.push(g);
      const saved = { cur: primParent.cur, prefix: primParent.prefix, idx: primIdx, p: api.p };
      primParent.cur = g; primParent.prefix = `${sid}|a${assets}|${name}`; primIdx = 0; api.p = params;
      try { fn(api, Math); } finally { primParent.cur = saved.cur; primParent.prefix = saved.prefix; primIdx = saved.idx; api.p = saved.p; }
    },
    prop(name, o = {}) {
      const g = pooled(`${sid}|prop|${name}|${primIdx++}`, () => { const g = new THREE.Group(); const p = makeProp(name); if (p) g.add(p); return g; });
      if (g.parent !== primParent.cur) primParent.cur.add(g);
      placeT(g, o.at, o.rot ? o : { rot: [0, o.yaw ?? 0, 0] }); g.scale.setScalar(o.scale ?? 1);
    },
    animal(species, o = {}) {
      const g = pooled(`${sid}|animal|${species}|${primIdx++}`, () => { const g = makeAnimal({ species, seed: 3 }); return g; });
      if (g.parent !== primParent.cur) primParent.cur.add(g);
      g.position.copy(V(o.at)); g.rotation.set(0, o.yaw ?? 0, 0); g.scale.setScalar(o.scale ?? 1);
      animateAnimal(g, o.action ?? "idle", t);
    },
    block(size, at, color, o = {}) { return void prim("block", () => BOX, at, color, o, V(size)); },
    ball(r, at, color, o = {}) { const s = o.scale ?? [1, 1, 1]; return void prim("ball", () => geo("ball", () => new THREE.SphereGeometry(1, 16, 12)), at, color, o, new THREE.Vector3(r * s[0], r * s[1], r * s[2])); },
    cyl(rT, rB, h, at, color, o = {}) { const k = `cyl:${(rT / Math.max(1e-3, rB)).toFixed(2)}`; return void prim(k, () => geo(k, () => new THREE.CylinderGeometry(rT / Math.max(rT, rB), rB / Math.max(rT, rB), 1, 14)), at, color, o, new THREE.Vector3(Math.max(rT, rB), h, Math.max(rT, rB))); },
    camera(c) { cam = c; },
    shake(a) { shakeAmt = Math.max(shakeAmt, Math.min(0.3, Number(a) || 0)); },
  };
  try {
    const fn = compiled("shot", sid);
    if (fn) fn(api, Math);
  } catch (e) {
    if (SD.errors.length < 50) SD.errors.push(`${sid}: ${e.message}`);
    console.warn(`studio shot ${sid}: ${e.message}`);
  }
  if (cam?.pos && cam?.look) {
    const pos = V(cam.pos), look = V(cam.look);
    // NEVER A STILL FRAME: a cut whose camera the pre-check found still gets a slow push-in, already moving at frame 0
    if (shot.studioPush) { const q = 0.25 + 0.75 * Math.min(1, t / dur); pos.lerp(look, 0.12 * q); cam = { ...cam, fov: (cam.fov ?? 50) * (1 - 0.06 * q) }; }
    if (shakeAmt) { const s = shakeAmt; pos.add(new THREE.Vector3(s * Math.sin(t * 37.1), s * Math.sin(t * 43.7 + 1), s * 0.5 * Math.sin(t * 29.3 + 2))); look.add(new THREE.Vector3(s * 0.6 * Math.sin(t * 31.3 + 3), s * 0.6 * Math.sin(t * 41.9), 0)); }
    const aim = () => { camera.position.copy(pos); camera.fov = Math.min(100, Math.max(12, cam.fov ?? 50)); camera.near = 0.05; camera.far = 3000; camera.updateProjectionMatrix(); camera.up.set(0, 1, 0); camera.lookAt(look); if (cam.roll) camera.rotateZ(cam.roll); camera.updateMatrixWorld(); };
    aim();
    // the engine monster counts as the creature when it is on screen
    if (monster?.visible) creatures.push(monster);
    // (2026-11-13: the round-2 creature frame cap is gone: it moved the director's camera. The creature's share is only
    // measured, for the stats)
    const cShare = creatures.length ? Math.max(...creatures.map((c) => screenShare(c, camera))) : 0;
    // NO BLOCKED LENS: a built thing (block, prop, a non-creature asset) with the lens inside it, or nearer than the
    // subject and covering over half the frame, is left out of this frame
    const dl = pos.distanceTo(look), fwd = camera.getWorldDirection(new THREE.Vector3()), bx = new THREE.Box3(), c = new THREE.Vector3();
    for (const o of SD.live) {
      if (!o.visible || o.userData.held || o.userData.creature || o.isLight || o.parent?.userData?.creature) continue;
      bx.setFromObject(o); if (bx.isEmpty()) continue;
      if (bx.clone().expandByScalar(0.25).containsPoint(pos)) { o.visible = false; continue; }
      bx.getCenter(c);
      if (c.distanceTo(pos) < dl - 0.8 && c.clone().sub(pos).dot(fwd) > 0 && boxShare(bx, camera) > 0.5) o.visible = false;
    }
    // THE NIGHT FLOOR: key from the lens side, rim behind the subject, a warm fill on the creature's face, a sky fill
    const Lt = SD.lights, dir = look.clone().sub(pos).normalize();
    const ls = shot.studioLight ?? ST.lightScale ?? 0.12; // the floor's strength: 0.12 calibrated on RunPod 2026-11-13 (0.25 washes out, 1 blows out)
    if (night && ls > 0) {
      Lt.key.position.copy(pos).add(new THREE.Vector3(0, 1.2, 0)); Lt.key.intensity = ls * (26 + 2.5 * dl);
      Lt.rim.position.copy(look).addScaledVector(dir, 4).add(new THREE.Vector3(0, 4, 0)); Lt.rim.intensity = ls * 45;
      Lt.sky.intensity = Math.min(0.55, ls * 2.5);
      if (creatures.length) { const cb = new THREE.Box3().setFromObject(creatures[0]), top = cb.getCenter(new THREE.Vector3()); top.y = cb.min.y + 0.8 * (cb.max.y - cb.min.y); Lt.face.position.copy(top).addScaledVector(dir, -4); Lt.face.intensity = ls * (60 + 4 * top.distanceTo(pos)); }
    }
    S.camFill?.position.copy(pos).add(new THREE.Vector3(0, 0.4, 0));
    S.weather?.update(shot.board?.weather ?? null, t, camera, night);
    S.spots.center.copy(look).setY(0);
    // the frame's geometry stats for the checks: each visible cast member's on-screen height share, the creature's share
    const ppl = {};
    for (const [id, P] of Object.entries(people)) if (P.obj.visible) { const h = heightShare(P.obj, camera); if (h > 0) ppl[id] = +h.toFixed(3); }
    SD.stats = { people: ppl, creature: +cShare.toFixed(3), camera: shot.camera };
    return { focus: pos.distanceTo(look) };
  }
  SD.stats = { people: {}, creature: 0, camera: shot.camera, noCamera: true };
  return base;
}


/** the share (0-1) of the frame a world box covers (its projected corners, clipped to the frame) */
function boxShare(bx, camera) {
  let x0 = 1, x1 = -1, y0 = 1, y1 = -1, behind = 0;
  for (const cx of [bx.min.x, bx.max.x]) for (const cy of [bx.min.y, bx.max.y]) for (const cz of [bx.min.z, bx.max.z]) {
    const p = new THREE.Vector3(cx, cy, cz); const v = p.clone().applyMatrix4(camera.matrixWorldInverse); if (v.z > 0) { behind++; continue; }
    p.project(camera); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  if (behind === 8) return 0;
  if (behind) return 1; // the lens is inside / right at it
  return (Math.max(0, Math.min(1, x1) - Math.max(-1, x0)) * Math.max(0, Math.min(1, y1) - Math.max(-1, y0))) / 4;
}
const screenShare = (o, camera) => { const b = new THREE.Box3().setFromObject(o); return b.isEmpty() ? 0 : boxShare(b, camera); };
/** a person's visible on-screen height as a share of the frame height (0 when off screen) */
function heightShare(o, camera) {
  const b = new THREE.Box3().setFromObject(o); if (b.isEmpty()) return 0;
  let y0 = 1, y1 = -1, x0 = 1, x1 = -1, front = 0;
  for (const cx of [b.min.x, b.max.x]) for (const cy of [b.min.y, b.max.y]) for (const cz of [b.min.z, b.max.z]) {
    const p = new THREE.Vector3(cx, cy, cz); if (p.clone().applyMatrix4(camera.matrixWorldInverse).z > 0) continue; front++;
    p.project(camera); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
  }
  if (!front || x1 < -1 || x0 > 1 || y1 < -1 || y0 > 1) return 0;
  return Math.max(0, Math.min(1, y1) - Math.max(-1, y0)) / 2;
}
