// Kit: people and hands, the life element of a scene (the owner's rule 20 of 2026-11-11: one living thing per video
// where it fits: a worker digging, a hand turning a tap or pressing a button, people walking out, a driver in a car).
// Built in code from capsules with natural skin, cloth and boot colours (no licence, no download; Poly Haven's spade
// for the digger), jointed (hips, knees, shoulders, elbows, finger knuckles) and posed every frame from t, so every
// still is deterministic. A real-proportioned, matte, faceless figure reads as the competitor's Blender-style people
// at video distance, where a toy character or a scanned face would not.
//   person {pos, rotY, action: stand | walk | dig | press | turn | drive | wave | point, path, height (1.75),
//           look: worker | casual, car (a car part's id: the driver sits in it)}   channels show, go, act
//   hand   {pos (the point it touches), from (where the arm comes from), size (0.5), action: press | turn | point | grab,
//           sleeve (colour)}                                                        channels show, press, turn
import { model } from "./models.js";

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const v3 = (a, d) => (Array.isArray(a) && a.length === 3 && a.every((x) => Number.isFinite(Number(x))) ? a.map(Number) : d);
export const PERSON_ACTIONS = Object.freeze(["stand", "walk", "dig", "press", "turn", "drive", "wave", "point"]);
export const HAND_ACTIONS = Object.freeze(["press", "turn", "point", "grab"]);
const LOOKS = {
  worker: { shirt: "#c8642c", pants: "#3d4654", hat: "#d9a92a", shoes: "#3a2f26" },
  casual: { shirt: "#5d7189", pants: "#3b3f47", hat: null, shoes: "#2c2a28" },
};
const SKIN = ["#d9ab8c", "#c08e6c", "#a8735a", "#e3bba0", "#8a5a42"];

/** a person's settings (pure: Node) */
export function personSpec(p = {}) {
  const action = PERSON_ACTIONS.includes(p.action) ? p.action : "stand";
  const pos = v3(p.pos, [0, 0, -1]), path = Array.isArray(p.path) ? p.path.map((q) => v3(q, null)).filter(Boolean) : [];
  return { action, pos, path: path.length ? [pos, ...path] : [pos], rotY: num(p.rotY, 0), height: Math.max(0.8, Math.min(2.2, num(p.height, 1.75))), look: LOOKS[p.look] ? p.look : action === "dig" ? "worker" : "casual", car: typeof p.car === "string" ? p.car : null, skin: SKIN[Math.abs(Math.round(num(p.skin, 0))) % SKIN.length] };
}
/** the box a person can be in (pure: the camera frames it) */
export function personBox(p = {}) {
  const s = personSpec(p), h = s.height;
  return { min: [0, 1, 2].map((i) => Math.min(...s.path.map((q) => q[i])) - (i === 1 ? 0 : 0.5)), max: [0, 1, 2].map((i) => Math.max(...s.path.map((q) => q[i])) + (i === 1 ? h : 0.5)) };
}
/** a hand's settings (pure) */
export function handSpec(p = {}) {
  const pos = v3(p.pos, [0, 1, 0]), from = v3(p.from, [pos[0], pos[1] + 0.25, pos[2] + 0.6]);
  return { pos, from, size: Math.max(0.1, num(p.size, 0.5)), action: HAND_ACTIONS.includes(p.action) ? p.action : "press", sleeve: typeof p.sleeve === "string" ? p.sleeve : "#5d7189" };
}
export function handBox(p = {}) { const s = handSpec(p); return { min: [0, 1, 2].map((i) => Math.min(s.pos[i], s.from[i]) - s.size * 0.4), max: [0, 1, 2].map((i) => Math.max(s.pos[i], s.from[i]) + s.size * 0.4) }; }

/** the jointed figure at 1.75 m: { root, pelvis, torso, head, sh: [L, R], el: [L, R], hip: [L, R], kn: [L, R] }
 * (it faces +z; its right side is -x) */
function figure(ctx, s) {
  const { THREE } = ctx, L = LOOKS[s.look];
  const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const M = { shirt: mat(L.shirt), pants: mat(L.pants, 0.9), skin: mat(s.skin, 0.6), shoes: mat(L.shoes, 0.7), hair: mat("#3b2b22", 0.9), hat: L.hat ? mat(L.hat, 0.45) : null };
  const cap = (r, len, m, parent, y) => { const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m); o.position.y = y; o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const grp = (parent, x, y, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const root = new THREE.Group(), body = grp(root, 0, 0), pelvis = grp(body, 0, 0.95);
  const hipBlock = cap(0.13, 0.12, M.pants, pelvis, 0); hipBlock.rotation.z = Math.PI / 2;
  const torso = grp(pelvis, 0, 0.05);
  const chest = cap(0.155, 0.36, M.shirt, torso, 0.3); chest.scale.set(1.18, 1, 0.72);
  cap(0.05, 0.06, M.skin, torso, 0.62);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 14), M.skin); head.position.y = 0.76; head.scale.set(0.92, 1.08, 1); head.castShadow = true; torso.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hat ?? M.hair); hair.position.set(0, 0.785, -0.008); hair.scale.set(0.96, 1.05, 1.04); torso.add(hair);
  if (M.hat) { const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.012, 20), M.hat); brim.position.set(0, 0.8, 0.02); torso.add(brim); }
  const sh = [], el = [], hip = [], kn = [], hands = [];
  for (const side of [1, -1]) {
    const s0 = grp(torso, side * 0.215, 0.52); cap(0.052, 0.22, M.shirt, s0, -0.14);
    const e0 = grp(s0, 0, -0.29); cap(0.044, 0.2, M.skin, e0, -0.13);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), M.skin); hd.position.y = -0.28; hd.scale.set(0.8, 1.2, 0.6); e0.add(hd);
    sh.push(s0); el.push(e0); hands.push(hd);
    const h0 = grp(pelvis, side * 0.095, -0.02); cap(0.072, 0.34, M.pants, h0, -0.22);
    const k0 = grp(h0, 0, -0.45); cap(0.058, 0.34, M.pants, k0, -0.21);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.25), M.shoes); foot.position.set(0, -0.46, 0.05); foot.castShadow = true; k0.add(foot);
    hip.push(h0); kn.push(k0);
  }
  return { root, body, pelvis, torso, sh, el, hip, kn, hands, M };
}

/** the length of a path and the point/direction at a share u (pure) */
function along(path, u) {
  if (path.length < 2) return { at: path[0], dir: null, dist: 0 };
  const lens = path.slice(1).map((q, i) => Math.hypot(q[0] - path[i][0], q[2] - path[i][2])), Lt = lens.reduce((a, b) => a + b, 0) || 1;
  let d = Math.max(0, Math.min(1, u)) * Lt; const dist = d;
  for (let i = 0; i < lens.length; i++) { if (d <= lens[i] || i === lens.length - 1) { const k = lens[i] ? Math.min(1, d / lens[i]) : 0, a = path[i], b = path[i + 1]; return { at: a.map((c, j) => c + (b[j] - c) * k), dir: [(b[0] - a[0]) / (lens[i] || 1), (b[2] - a[2]) / (lens[i] || 1)], dist }; } d -= lens[i]; }
  return { at: path.at(-1), dir: null, dist };
}

/** a person: { group, update(t) } (channels show, go: along the path, act: the action's strength, default on) */
export function buildPerson(ctx, p = {}, api) {
  const { THREE } = ctx, s = personSpec(p), F = figure(ctx, s), k = s.height / 1.75;
  F.root.scale.setScalar(k); F.root.position.set(...s.pos); F.root.rotation.y = s.rotY; ctx.scene.add(F.root);
  // the digger's spade (Poly Haven CC0, fetchPolyModels.mjs), held in front of the body; a plain spade without the model
  let spade = null;
  if (s.action === "dig") {
    spade = new THREE.Group(); spade.position.set(-0.05, 0.05, 0.42); F.torso.add(spade);
    const wood = new THREE.MeshStandardMaterial({ color: "#8a6a48", roughness: 0.8 }), steel = new THREE.MeshStandardMaterial({ color: "#7c7f82", roughness: 0.45, metalness: 0.7 });
    const plain = [new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.0, 8), wood), new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.015), steel)];
    plain[0].position.y = -0.25; plain[1].position.y = -0.85; for (const m of plain) { m.castShadow = true; spade.add(m); }
    if (ctx.gltf) model(ctx, "polyhaven/rusted_spade_01/rusted_spade_01.gltf", { parent: spade, scale: 1 }, (g, inner) => {
      // (stood blade down along the handle line; the model's own size kept, about 1.1 m)
      const b = new THREE.Box3().setFromObject(inner), h = b.max.y - b.min.y;
      if (h > 0.3) { for (const m of plain) m.visible = false; g.position.y = -0.98; }
    });
    spade.rotation.x = 0.25;
  }
  const shown = !!api.cue("show"), walks = !!api.cue("go"), acts = !!api.cue("act");
  const R = 1, Lf = 0; // (index of the right and left limbs in F.sh / F.el / F.hip / F.kn)
  const pose = (t, a, moving, phase) => {
    for (const j of [...F.sh, ...F.el, ...F.hip, ...F.kn]) j.rotation.set(0, 0, 0);
    F.torso.rotation.set(0.02 * Math.sin(t * 1.6), 0, 0); F.pelvis.position.y = 0.95; F.body.position.y = 0;
    F.sh[R].rotation.x = F.sh[Lf].rotation.x = 0.04 * Math.sin(t * 1.6); F.sh[R].rotation.z = -0.06; F.sh[Lf].rotation.z = 0.06; F.el[R].rotation.x = F.el[Lf].rotation.x = -0.12;
    if (moving) {
      const sw = Math.sin(phase), sw2 = Math.sin(phase + Math.PI);
      F.hip[Lf].rotation.x = -0.42 * sw; F.hip[R].rotation.x = -0.42 * sw2;
      F.kn[Lf].rotation.x = 0.55 * Math.max(0, -Math.cos(phase)); F.kn[R].rotation.x = 0.55 * Math.max(0, Math.cos(phase));
      F.sh[Lf].rotation.x = 0.35 * sw; F.sh[R].rotation.x = 0.35 * sw2; F.el[Lf].rotation.x = F.el[R].rotation.x = -0.3;
      F.body.position.y = 0.025 * Math.abs(Math.cos(phase));
      return;
    }
    const act = s.action;
    if (act === "dig") { const u = Math.sin(t * 3.9); F.torso.rotation.x = a * (0.35 + 0.22 * u); for (const i of [R, Lf]) { F.sh[i].rotation.x = -a * (0.95 + 0.25 * u); F.el[i].rotation.x = -a * 0.55; } F.sh[R].rotation.z = -0.15; F.sh[Lf].rotation.z = 0.25; F.hip[R].rotation.x = F.hip[Lf].rotation.x = -a * (0.22 + 0.12 * u); F.kn[R].rotation.x = F.kn[Lf].rotation.x = a * (0.35 + 0.2 * u); F.body.position.y = -a * (0.05 + 0.03 * u); if (spade) spade.position.y = 0.05 - 0.12 * a * u; }
    else if (act === "press") { const u = Math.max(0, Math.sin(t * 4.5)); F.sh[R].rotation.x = -a * (1.3 + 0.08 * u); F.el[R].rotation.x = -a * (0.35 - 0.3 * u); }
    else if (act === "turn") { F.sh[R].rotation.x = -a * 1.15; F.el[R].rotation.x = -a * 0.55; F.el[R].rotation.y = a * 0.8 * Math.sin(t * 2.2); }
    else if (act === "point") { F.sh[R].rotation.x = -a * 1.45; F.el[R].rotation.x = 0; }
    else if (act === "wave") { F.sh[R].rotation.z = -a * 2.5; F.el[R].rotation.z = -a * (0.5 + 0.4 * Math.sin(t * 7)); }
    else if (act === "drive") { F.pelvis.position.y = 0.95 - a * 0.42; for (const i of [R, Lf]) { F.hip[i].rotation.x = -a * 1.45; F.kn[i].rotation.x = a * 1.35; F.sh[i].rotation.x = -a * 0.95; F.el[i].rotation.x = -a * 0.5; } F.torso.rotation.z = 0.04 * a * Math.sin(t * 0.9); }
  };
  const seat = new THREE.Vector3();
  return {
    group: F.root,
    update(t) {
      const sh = shown ? Math.max(0, Math.min(1.15, api.ch("show", t))) : 1;
      F.root.visible = sh > 0.002;
      const a = acts ? Math.max(0, Math.min(1, api.ch("act", t))) : 1;
      // a driver sits in their car (the car part's root, m2/cityParts.js: front toward +x, the driver on its -z side)
      const carRoot = s.car ? ctx.shared?.[`car:${s.car}`]?.root : null;
      if (carRoot) {
        carRoot.updateMatrixWorld(); seat.set(0.15, 0.08, -0.42).applyMatrix4(carRoot.matrixWorld);
        F.root.position.copy(seat); F.root.rotation.set(0, carRoot.rotation.y + Math.PI / 2, 0); F.root.visible = F.root.visible && carRoot.visible;
        pose(t, 1, false, 0); return;
      }
      const u = walks ? Math.max(0, Math.min(1, api.ch("go", t))) : 0, w = along(s.path, u);
      F.root.position.set(w.at[0], w.at[1], w.at[2]);
      const moving = walks && u > 0.001 && u < 0.999;
      if (moving && w.dir) F.root.rotation.y = Math.atan2(w.dir[0], w.dir[1]);
      F.root.scale.setScalar(k * Math.max(0.001, Math.min(1, sh)));
      pose(t, a, moving, (w.dist / 0.75) * Math.PI);
    },
  };
}

/** a hand (with its sleeve) that reaches in from `from` to touch `pos`: { group, update(t) }; channels show, press
 * (0: drawn back a little, 1: the fingertip on pos), turn (the wrist rolls a quarter turn: a tap, a knob, a valve) */
export function buildHand(ctx, p = {}, api) {
  const { THREE } = ctx, s = handSpec(p), k = s.size / 0.2;
  const skin = new THREE.MeshStandardMaterial({ color: "#d4a585", roughness: 0.55 }), cloth = new THREE.MeshStandardMaterial({ color: s.sleeve, roughness: 0.85 });
  const outer = new THREE.Group(), g = new THREE.Group(); outer.add(g); g.scale.setScalar(k); ctx.scene.add(outer);
  const capZ = (r, len, m, parent, z) => { const geo = new THREE.CapsuleGeometry(r, len, 4, 10); geo.rotateX(Math.PI / 2); const o = new THREE.Mesh(geo, m); o.position.z = z; o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const palm = new THREE.Mesh(ctx.RoundedBoxGeometry ? new ctx.RoundedBoxGeometry(0.085, 0.028, 0.095, 3, 0.012) : new THREE.BoxGeometry(0.085, 0.028, 0.095), skin); palm.position.z = 0.05; palm.castShadow = true; g.add(palm);
  capZ(0.03, 0.06, skin, g, -0.02).scale.set(1.25, 0.8, 1); // the wrist
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.42, 16), cloth); sleeve.rotation.x = Math.PI / 2; sleeve.position.z = -0.25; sleeve.castShadow = true; g.add(sleeve);
  const fingers = [];
  [[0.031, 1], [0.01, 1.08], [-0.011, 1.0], [-0.031, 0.82]].forEach(([x, l], i) => {
    const segs = []; let parent = g, z = 0.1;
    for (const [len, r] of [[0.045, 0.0105], [0.028, 0.0095], [0.022, 0.0088]]) { const j = new THREE.Group(); j.position.set(parent === g ? x : 0, 0, parent === g ? z : len0(segs)); parent.add(j); capZ(r, len * l - 2 * r > 0 ? len * l - 2 * r : 0.001, skin, j, (len * l) / 2); segs.push({ j, len: len * l }); parent = j; }
    fingers.push(segs);
  });
  function len0(segs) { return segs.at(-1).len; }
  const thumb = new THREE.Group(); thumb.position.set(0.045, -0.004, 0.03); thumb.rotation.set(0.2, 0.75, 0); g.add(thumb);
  capZ(0.013, 0.02, skin, thumb, 0.022); const t2 = new THREE.Group(); t2.position.z = 0.045; thumb.add(t2); capZ(0.0115, 0.012, skin, t2, 0.016);
  const tipLen = 0.1 + fingers[0].reduce((a, q) => a + q.len, 0);
  const dir = new THREE.Vector3(...s.pos).sub(new THREE.Vector3(...s.from)).normalize();
  if (!(dir.lengthSq() > 0)) dir.set(0, 0, -1);
  outer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  const grip = s.action === "turn" || s.action === "grab";
  const shown = !!api.cue("show");
  return {
    group: outer,
    update(t) {
      const sh = shown ? Math.max(0, Math.min(1.15, api.ch("show", t))) : 1;
      outer.visible = sh > 0.002;
      const pr = Math.max(0, Math.min(1, api.ch("press", t))), tu = api.ch("turn", t);
      // fingers: a grip curls all four round the handle; a press or a point keeps the index straight, the rest curled
      fingers.forEach((segs, i) => { const c = grip ? 0.95 : i === 0 ? 0.08 : 1.25; segs.forEach((q, n) => { q.j.rotation.x = c * (n === 0 ? 0.8 : 1.1); }); });
      t2.rotation.x = grip ? 0.6 : 0.9;
      // (a press brings the fingertip onto pos; a grip holds the palm's middle there; drawn back a quarter of the hand before)
      const reach = grip ? 0.06 * k : tipLen * k, back = grip ? 0 : (1 - pr) * 0.25 * s.size;
      outer.position.set(s.pos[0] - dir.x * (reach + back), s.pos[1] - dir.y * (reach + back), s.pos[2] - dir.z * (reach + back));
      g.rotation.z = tu * Math.PI / 2 + 0.03 * Math.sin(t * 1.3); // (a living hand is never quite still)
      g.scale.setScalar(k * Math.max(0.001, Math.min(1, sh)));
    },
  };
}
