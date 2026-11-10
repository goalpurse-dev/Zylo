// Blocky Worlds EPIC (EPIC agent): instanced crowds and armies, 1-2000 characters in about two dozen draw calls.
// One InstancedMesh per body part (legs, torso, arms, hands, head, face, one per hair style / helmet, shield, spear,
// banner pole + flag, wolf snout + ears), shared materials, per-instance colours (instanceColor). Every frame each
// character's part matrices are composed on the CPU from lib/epic.js crowdMotion() (pure, deterministic from t).
// CHARACTERS-V3 2026-11-10 (owner: "crowds use the same rig / hair / outfits"): the cast's blocky avatar body (hair.js
// BODY: boxy torso, chunky arms and legs, the head on the torso), the hair kit's own pieces (merged per style), skin
// hands, clean plastic, and the cast's bold decal faces (facesV2.js) - a lighter one-block-per-limb variant of people.js.
//
//   makeCrowd({ kind, count, formation, seed, faction, spacing, facing, scale }) -> Group (userData.crowd)
//     kind: soldier | knight | wolf_soldier | townsfolk; faction: "wolf" (dark steel + red) | "town" (blue + gold) |
//     a colour; facing: yaw (radians) of the whole formation's "forward"
//   updateCrowd(crowd, t, { action, origin: Vector3, yaw, surface(x, z) -> y | null, camera, speed })
//     places + poses every character; LOD from the camera distance (near: bevelled blocks + faces + hair pieces; far:
//     plain boxes, no faces)
// Blocky and kid-safe: helmets, shields, spears with a blunt blocky tip, banners; no blood, no gore.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { formationSlots, crowdMotion, prng } from "../../lib/epic.js";
import { BODY, buildHair } from "./hair.js";
import { HAIR_COLORS, hairFor } from "./outfitsData.js";
import { faceParams, faceLook, drawFaceV2 } from "./facesV2.js";

const SKIN = ["#f3cba9", "#c98e6b", "#8a5a3c", "#e7b38e", "#5e3b28", "#f6d6bd", "#a86f4b", "#ffe0c7"];
const TOPS = ["#18b8a5", "#ff7a1a", "#ffd32a", "#c0392b", "#ff6fb5", "#273c75", "#ff3b6b", "#2e86de", "#6c5ce7", "#00b894", "#e84393", "#fdcb6e", "#0984e3", "#d63031", "#55efc4", "#a29bfe", "#f0932b", "#badc58"];
const PANTS = ["#2f4f86", "#3b5b8f", "#2d3436", "#57606f", "#c8a96a", "#1e272e", "#6d4c41", "#273c75", "#4b6584"];
const FACTIONS = {
  wolf: { tunic: ["#7a1f2b", "#8e1f2b", "#6b1a24"], pants: ["#2b2f36", "#33383f"], metal: "#6f7782", shield: "#7a1f2b", trim: "#d8b45a", flag: "#8e1f2b", fur: ["#6b7280", "#5d6470", "#7d8590", "#4f555e"] },
  town: { tunic: ["#2e86de", "#2a6fc0", "#3b8fe6"], pants: ["#3b2f25", "#4a3a2c"], metal: "#b9c2cc", shield: "#f1c40f", trim: "#ffffff", flag: "#2e86de", fur: ["#c58b4f"] },
};
// the crowd's hair styles (each one InstancedMesh): the cast's own pieces from hair.js
export const CROWD_HAIR = Object.freeze(["short", "sidePart", "spiky", "messy", "buzz", "curly", "bob", "ponytail", "bun", "long", "afro"]);

// unscaled figure = people.js / hair.js BODY: hip 0.9, the spine 0.17 above it, the shoulders 0.47 up the spine, the head
// resting on the torso top (0.6 up the spine), an adult's head scale; the crowd's adults are the cast's adult height
const HIP = BODY.HIP_Y, SPY = BODY.SPINE_Y, SH_Y = SPY + BODY.SH.y, SH_X = BODY.SH.x, HEAD_Y = SPY + BODY.HEAD_Y, HS = 1.45;
const SCALE = +(1.8 / (HIP + HEAD_Y + 0.34 * HS)).toFixed(4);
const ARM_TOP = BODY.ARM.up, ARM_LEN = BODY.ARM.up + BODY.ARM.upper - BODY.ARM.handY; // shoulder top .. the wrist
const HAND_Y = -(BODY.ARM.upper - BODY.ARM.handY) - BODY.HAND.y; // the hand's centre below the shoulder pivot

const GEO = { near: null, far: null };
const headUnits = (g, y = 0) => g.applyMatrix4(new THREE.Matrix4().makeScale(HS, HS, HS)).translate(0, y, 0);
/** one geometry from a group of meshes (their transforms baked; no uvs; non-indexed so any shapes merge) */
function mergeGroup(g) {
  g.updateMatrixWorld(true);
  const list = [];
  g.traverse((m) => { if (!m.isMesh) return; const x = m.geometry.clone().applyMatrix4(m.matrixWorld); x.deleteAttribute("uv"); list.push(x.index ? x.toNonIndexed() : x); });
  return list.length ? mergeGeometries(list) : new THREE.BoxGeometry(0.001, 0.001, 0.001);
}
function geos(level) {
  if (GEO[level]) return GEO[level];
  const near = level === "near";
  const box = (w, h, d, r = 0.03) => (near ? new RoundedBoxGeometry(w, h, d, 1, r) : new THREE.BoxGeometry(w, h, d));
  // blocks with a baked vertex colour each (white = tinted by instanceColor; the shoes, pelvis and belt darker), merged
  const blocks = (list) => mergeGeometries(list.map(([g, c]) => { g.deleteAttribute("uv"); const x = g.index ? g.toNonIndexed() : g; const col = new Float32Array(x.attributes.position.count * 3); for (let i = 0; i < col.length; i += 3) col.set(c, i); x.setAttribute("color", new THREE.BufferAttribute(col, 3)); return x; }));
  const L = BODY.LEG, T = BODY.TORSO, A = BODY.ARM, H = BODY.HAND;
  const PV = BODY.PELVIS, W1 = [1, 1, 1];
  const G = {
    leg: blocks([[box(L.w, 0.78, L.d).translate(0, -0.39, 0), W1], [box(BODY.SHOE.w, BODY.SHOE.h, BODY.SHOE.d, 0.02).translate(0, -0.9 + BODY.SHOE.h / 2 + 0.002, BODY.SHOE.z), [0.25, 0.22, 0.22]]]),
    torso: blocks([[box(T.w, T.h, T.d, 0.035).translate(0, SPY + T.y, 0), W1], [box(PV.w, PV.h, PV.d, 0.03).translate(0, PV.y, 0), [0.55, 0.52, 0.5]], [new THREE.BoxGeometry(PV.w + 0.012, 0.055, PV.d + 0.012).translate(0, 0.2, 0), [0.18, 0.14, 0.12]]]),
    arm: box(A.w, ARM_LEN, A.d).translate(0, ARM_TOP - ARM_LEN / 2, 0),
    hand: box(H.w, H.h, H.d, 0.03).translate(0, HAND_Y, 0),
    head: headUnits(box(BODY.HEAD.w, BODY.HEAD.h, BODY.HEAD.d, BODY.HEAD.r).translate(0, BODY.HEAD.h / 2, 0)),
    face: headUnits(new THREE.PlaneGeometry(0.28, 0.28).translate(0, 0.15, 0.152)),
    helmet: headUnits((() => { const m = new THREE.Group(); const add = (gg, x, y, z) => { const me = new THREE.Mesh(gg); me.position.set(x, y, z); m.add(me); }; add(box(0.38, 0.2, 0.38, 0.06), 0, 0.39, 0); add(box(0.38, 0.3, 0.06, 0.02), 0, 0.19, -0.17); add(box(0.045, 0.27, 0.28, 0.015), -0.178, 0.17, -0.02); add(box(0.045, 0.27, 0.28, 0.015), 0.178, 0.17, -0.02); return mergeGroup(m); })()),
    crest: headUnits(box(0.06, 0.12, 0.34, 0.02).translate(0, 0.53, -0.02)),
    snout: headUnits(box(0.16, 0.12, 0.16, 0.02).translate(0, 0.09, 0.22)),
    ear: headUnits((() => { const g = new THREE.ConeGeometry(0.07, 0.17, 4); g.rotateY(Math.PI / 4); g.translate(0, 0.38, -0.03); return g; })()),
    pad: box(A.w + 0.12, 0.14, A.d + 0.12, 0.05).translate(0, 0.1, 0), // an armed figure's shoulder plate (the cast knight's pauldron)
    shield: box(0.08, 0.7, 0.56, 0.03),
    boss: box(0.06, 0.18, 0.18, 0.02).translate(0.05, 0, 0),
    pole: (() => { const g = new THREE.BoxGeometry(0.06, 2.4, 0.06); g.translate(0, 0.55, 0); return g; })(),
    tip: (() => { const g = new THREE.ConeGeometry(0.08, 0.24, 4); g.translate(0, 1.86, 0); return g; })(),
    flag: (() => { const g = new THREE.BoxGeometry(0.03, 0.55, 0.75); g.translate(0, 1.45, -0.4); return g; })(),
  };
  // the hair styles: the cast's pieces (near) or a plain cap (far)
  for (const k of CROWD_HAIR) {
    if (!near) { G[`hair_${k}`] = headUnits(new THREE.BoxGeometry(0.34, 0.12, 0.34).translate(0, 0.34, 0)); continue; }
    const g = new THREE.Group(); buildHair(g, { hair: k, hairColor: "#ffffff", role: "adult", tieColor: "#ffffff" }, { seed: 5 });
    G[`hair_${k}`] = headUnits(mergeGroup(g));
  }
  GEO[level] = G; return G;
}

// the cast's decal faces (facesV2), with no skin-coloured lids so one texture suits every skin
const FACE_TEX = new Map();
function faceTexture(kind) {
  if (FACE_TEX.has(kind)) return FACE_TEX.get(kind);
  const c = document.createElement("canvas"); c.width = c.height = 256; const p = c.getContext("2d");
  p.clearRect(0, 0, 256, 256); p.lineCap = "round";
  if (kind === "wolf") { // yellow wolf eyes with slit pupils, angry brows, no mouth
    for (const x of [82, 174]) {
      p.fillStyle = "#ffd23a"; p.strokeStyle = "#24171d"; p.lineWidth = 8;
      p.beginPath(); p.ellipse(x, 120, 28, 22, 0, 0, Math.PI * 2); p.fill(); p.stroke();
      p.fillStyle = "#24171d"; p.beginPath(); p.ellipse(x + (x < 128 ? 4 : -4), 122, 6, 16, 0, 0, Math.PI * 2); p.fill();
      p.lineWidth = 14; p.beginPath(); p.moveTo(x - 30, x < 128 ? 74 : 92); p.lineTo(x + 30, x < 128 ? 92 : 74); p.stroke();
    }
  } else {
    const P = faceParams(kind === "angry" ? "determined" : "happy");
    for (const e of [P.eyeL, P.eyeR]) { e.lid = 0; e.low = 0; e.tilt = 0; }
    drawFaceV2(p, P, faceLook({ skin: "#e7b38e", hairColor: "#3a2a1e" }));
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  FACE_TEX.set(kind, t); return t;
}

const MAT = new Map();
const mat = (k, make) => { if (!MAT.has(k)) MAT.set(k, make()); return MAT.get(k); };

/** makeCrowd(opts) -> Group; see the header */
export function makeCrowd(opts = {}) {
  const kind = ["soldier", "knight", "wolf_soldier", "townsfolk"].includes(opts.kind) ? opts.kind : "townsfolk";
  const count = Math.max(1, Math.min(2000, Math.floor(opts.count ?? 50)));
  const formation = opts.formation ?? (kind === "townsfolk" ? "scatter" : "block");
  const seed = opts.seed ?? 3, R = prng(seed * 101 + count);
  const slots = formationSlots(formation, count, { spacing: opts.spacing ?? (kind === "townsfolk" ? 1.5 : 1.25), seed });
  const armed = kind !== "townsfolk", wolf = kind === "wolf_soldier";
  const F = FACTIONS[opts.faction] ?? (typeof opts.faction === "string" && /^#/.test(opts.faction) ? { ...FACTIONS.town, tunic: [opts.faction], shield: opts.faction, flag: opts.faction } : wolf ? FACTIONS.wolf : FACTIONS.town);
  const g = new THREE.Group(); g.name = `crowd:${kind}`;
  // clean plastic (CHARACTERS-V3): light gloss, flat colours
  const base = mat("vc", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }));
  const plainM = mat("plain", () => new THREE.MeshStandardMaterial({ roughness: 0.48 }));
  const metalM = mat("metal", () => new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.45 }));
  const fk = wolf ? "wolf" : armed ? "angry" : "happy";
  const faceM = mat(`face3:${fk}`, () => new THREE.MeshStandardMaterial({ map: faceTexture(fk), transparent: true, alphaTest: 0.4, roughness: 0.5 }));
  const near = geos("near");
  // per-character looks first (the hair style decides which InstancedMesh a character lives in)
  const looks = slots.map((s, i) => {
    const kid = kind === "townsfolk" && R() < 0.25;
    const gender = R() < 0.5 ? "f" : "m";
    const h = hairFor({ seed: seed * 7919 + i * 31 + 1, age: kid ? "kid" : "adult", gender });
    const hair = CROWD_HAIR.includes(h.hair) ? h.hair : h.hair === "bald" || h.hair === "receding" ? "buzz" : ["pigtails", "braids", "bangs"].includes(h.hair) ? "long" : ["wavyBob"].includes(h.hair) ? "bob" : ["topknot"].includes(h.hair) ? "bun" : ["quiff", "slicked", "curtains", "mohawk"].includes(h.hair) ? "sidePart" : "short";
    return { kid, hair, hairColor: h.hairColor ?? HAIR_COLORS.natural[0] };
  });
  const parts = {};
  const add = (name, geo, material, n, shadow = true) => { const im = new THREE.InstancedMesh(geo, material, Math.max(1, n)); im.name = name; im.frustumCulled = false; im.castShadow = shadow; im.receiveShadow = true; g.add(im); parts[name] = im; return im; };
  add("legL", near.leg, base, count); add("legR", near.leg, base, count); add("torso", near.torso, base, count);
  add("armL", near.arm, plainM, count); add("armR", near.arm, plainM, count); add("handL", near.hand, plainM, count); add("handR", near.hand, plainM, count);
  add("head", near.head, plainM, count);
  add("face", near.face, faceM, count, false);
  if (wolf) { add("snout", near.snout, plainM, count); add("earL", near.ear, plainM, count); add("earR", near.ear, plainM, count); }
  const hairIdx = new Map(); // style -> next instance index
  if (armed) { add("helmet", near.helmet, metalM, count); if (kind === "knight") add("crest", near.crest, plainM, count); add("shield", near.shield, plainM, count); add("boss", near.boss, metalM, count); add("padL", near.pad, metalM, count); add("padR", near.pad, metalM, count); }
  else for (const k of CROWD_HAIR) { const n = looks.filter((l) => l.hair === k).length; if (n) { add(`hair_${k}`, near[`hair_${k}`], plainM, n); hairIdx.set(k, 0); } }
  // weapons: spears for most, a banner every ~12th soldier (pole + flag); townsfolk carry nothing
  const banner = slots.map((s, i) => armed && (i % 12 === 5));
  const nB = banner.filter(Boolean).length;
  if (armed) { add("pole", near.pole, mat("wood", () => new THREE.MeshStandardMaterial({ color: "#8a5a32", roughness: 0.5 })), count); add("tip", near.tip, metalM, count - nB); add("flag", near.flag, plainM, Math.max(1, nB)); }
  // per-character colours + sizes
  const c = new THREE.Color(), chars = slots.map((s, i) => {
    const L = looks[i];
    const ch = { slot: s, scale: SCALE * (L.kid ? 0.72 : 0.95 + R() * 0.1), banner: banner[i], hair: armed ? null : L.hair, hairI: -1 };
    const skin = wolf ? F.fur[Math.floor(R() * F.fur.length)] : SKIN[Math.floor(R() * SKIN.length)];
    const top = armed ? F.tunic[Math.floor(R() * F.tunic.length)] : TOPS[Math.floor(R() * TOPS.length)];
    const pants = armed ? F.pants[Math.floor(R() * F.pants.length)] : PANTS[Math.floor(R() * PANTS.length)];
    parts.legL.setColorAt(i, c.set(pants)); parts.legR.setColorAt(i, c.set(pants)); parts.torso.setColorAt(i, c.set(top));
    parts.armL.setColorAt(i, c.set(top)); parts.armR.setColorAt(i, c.set(top));
    parts.handL.setColorAt(i, c.set(skin)); parts.handR.setColorAt(i, c.set(skin));
    parts.head.setColorAt(i, c.set(skin)); parts.face.setColorAt(i, c.set("#ffffff"));
    if (wolf) { parts.snout.setColorAt(i, c.set(skin).multiplyScalar(1.25)); parts.earL.setColorAt(i, c.set(skin)); parts.earR.setColorAt(i, c.set(skin)); }
    if (armed) { parts.helmet.setColorAt(i, c.set(F.metal)); parts.shield.setColorAt(i, c.set(R() < 0.85 ? F.shield : F.trim)); parts.boss.setColorAt(i, c.set(F.trim)); parts.crest?.setColorAt(i, c.set(F.flag)); parts.padL.setColorAt(i, c.set(F.metal)); parts.padR.setColorAt(i, c.set(F.metal)); }
    else { const im = parts[`hair_${L.hair}`]; ch.hairI = hairIdx.get(L.hair); hairIdx.set(L.hair, ch.hairI + 1); im.setColorAt(ch.hairI, c.set(L.hairColor)); }
    return ch;
  });
  if (armed) { let b = 0; chars.forEach((ch) => { if (ch.banner) parts.flag.setColorAt(b++, c.set(F.flag)); }); if (!nB) { parts.flag.setColorAt(0, c.set(F.flag)); parts.flag.setMatrixAt(0, ZERO); } } // no banner: the spare flag hidden (it stood at the origin)
  for (const im of Object.values(parts)) if (im.instanceColor) im.instanceColor.needsUpdate = true;
  g.userData.crowd = { kind, count, formation, slots, chars, parts, armed, wolf, level: "near", extent: slots.reduce((m, s) => Math.max(m, Math.hypot(s.x, s.z)), 0) + 1 };
  return g;
}

const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _t = new THREE.Matrix4(), _r = new THREE.Matrix4(), _a = new THREE.Matrix4(), _w = new THREE.Matrix4();
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const T = (x, y, z) => _t.makeTranslation(x, y, z), RX = (a) => _r.makeRotationX(a);

/** updateCrowd(crowd, t, opts): see the header */
export function updateCrowd(crowd, t, opts = {}) {
  const C = crowd.userData.crowd, P = C.parts;
  const action = opts.action ?? "stand", origin = opts.origin ?? new THREE.Vector3(), yaw = opts.yaw ?? 0, surf = opts.surface ?? null;
  // LOD: plain boxes and no faces past ~45 m (the bevels, hair pieces and faces are sub-pixel there)
  if (opts.camera) {
    const d = opts.camera.position.distanceTo(origin) - C.extent;
    const level = d > 45 ? "far" : "near";
    if (level !== C.level) {
      const G = geos(level);
      for (const k of Object.keys(P)) {
        const gk = k.startsWith("hair_") ? k : { legL: "leg", legR: "leg", torso: "torso", armL: "arm", armR: "arm", handL: "hand", handR: "hand", head: "head", helmet: "helmet", crest: "crest", snout: "snout", shield: "shield", boss: "boss", padL: "pad", padR: "pad" }[k];
        if (gk && G[gk]) P[k].geometry = G[gk];
      }
      P.face.visible = level === "near"; if (P.boss) P.boss.visible = level === "near";
      C.level = level;
    }
  }
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  let tipI = 0, flagI = 0;
  // ATTACH 2026-11-07: each character's ground point (x, y, z, shown) for the free ground-contact check (page/ground.js)
  if (!C.base || C.base.length !== C.chars.length * 4) C.base = new Float32Array(C.chars.length * 4);
  C.chars.forEach((ch, i) => {
    C.base[i * 4 + 3] = 0;
    const s = ch.slot, m = crowdMotion(action, t, s, { speed: opts.speed });
    // local (formation) -> world: rotate by yaw around the origin
    const lx = s.x + m.dx, lz = s.z + m.dz;
    const wx = origin.x + lx * cy + lz * sy, wz = origin.z - lx * sy + lz * cy;
    let wy = origin.y;
    if (surf) {
      const y = surf(wx, wz);
      if (y == null) { hide(P, i, ch); if (P.pole) { if (ch.banner) P.flag.setMatrixAt(flagI++, ZERO); else P.tip.setMatrixAt(tipI++, ZERO); } return; }
      wy = y;
    }
    const k = ch.scale;
    C.base[i * 4] = wx; C.base[i * 4 + 1] = wy; C.base[i * 4 + 2] = wz; C.base[i * 4 + 3] = m.jump > 0.01 ? 0 : 1;
    // the body frame: position, heading, bob/jump, then everything in unscaled figure units
    _q.setFromAxisAngle(_up, yaw + m.yaw + (s.jitter - 0.5) * (action === "stand" || action === "cheer" ? 0.5 : 0.08));
    _b.compose(_v.set(wx, wy + (m.bob + m.jump) * k, wz), _q, _s.set(k, k, k));
    // hips (the lean pivots at the hip)
    _w.copy(_b).multiply(T(0, HIP, 0)).multiply(RX(m.lean));
    P.legL.setMatrixAt(i, _m.copy(_b).multiply(T(BODY.HIP_X, HIP, 0)).multiply(RX(m.legSwing)));
    P.legR.setMatrixAt(i, _m.copy(_b).multiply(T(-BODY.HIP_X, HIP, 0)).multiply(RX(-m.legSwing)));
    P.torso.setMatrixAt(i, _w);
    const head = _m.copy(_w).multiply(T(0, HEAD_Y, 0)).multiply(RX(action === "cheer" ? -0.2 : action === "charge" ? -0.12 : 0));
    P.head.setMatrixAt(i, head); P.face.setMatrixAt(i, head);
    if (ch.hair) P[`hair_${ch.hair}`].setMatrixAt(ch.hairI, head);
    if (P.helmet) P.helmet.setMatrixAt(i, head);
    if (P.crest) P.crest.setMatrixAt(i, head);
    if (P.snout) { P.snout.setMatrixAt(i, head); P.earL.setMatrixAt(i, _a.copy(head).multiply(T(0.14, 0, 0))); P.earR.setMatrixAt(i, _a.copy(head).multiply(T(-0.14, 0, 0))); }
    // arms (the left holds the shield, the right the spear / banner); wave adds a side-to-side on the right arm
    const armL = _a.copy(_w).multiply(T(SH_X, SH_Y, 0)).multiply(RX(m.armL)); // SH_Y, HEAD_Y: measured from the hip
    P.armL.setMatrixAt(i, armL); P.handL.setMatrixAt(i, armL); P.padL?.setMatrixAt(i, armL);
    if (P.shield) { const sh = new THREE.Matrix4().copy(armL).multiply(T(0.2, HAND_Y + 0.05, 0.08)).multiply(RX(-m.armL * 0.85)); P.shield.setMatrixAt(i, sh); P.boss.setMatrixAt(i, sh); }
    const armR = _a.copy(_w).multiply(T(-SH_X, SH_Y, 0)).multiply(RX(m.armR));
    if (m.wave) armR.multiply(_r.makeRotationZ(m.wave));
    P.armR.setMatrixAt(i, armR); P.handR.setMatrixAt(i, armR); P.padR?.setMatrixAt(i, armR);
    if (P.pole) {
      // the hand, then cancel the arm's pitch (the weapon stays upright), then level it forward by m.weapon
      const w = new THREE.Matrix4().copy(armR).multiply(T(0, HAND_Y, 0.03)).multiply(RX(-m.armR - m.lean)).multiply(RX(m.weapon * 1.35));
      P.pole.setMatrixAt(i, w);
      if (ch.banner) P.flag.setMatrixAt(flagI++, w); else P.tip.setMatrixAt(tipI++, w);
    }
  });
  for (const im of Object.values(P)) im.instanceMatrix.needsUpdate = true;
}
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function hide(P, i, ch) {
  for (const [k, im] of Object.entries(P)) { if (k === "tip" || k === "flag" || k.startsWith("hair_")) continue; im.setMatrixAt(i, ZERO); }
  if (ch?.hair) P[`hair_${ch.hair}`].setMatrixAt(ch.hairI, ZERO);
}
/** the crowd's half extent (m) around its origin, for framing */
export const crowdExtent = (crowd) => crowd.userData.crowd.extent * SCALE;
/** the crowd figure's scale (an adult's root scale: the cast's adult height) */
export const CROWD_SCALE = SCALE;
