// Blocky Worlds SIMPLE LOOK monsters (owner 2026-11-10: "the Peeker: a new blocky monster in the simple style, tall,
// dark, ONE huge glowing eye; the eye is the star"). Same API as page/kit/monsters.js (makeMonster, animateMonster,
// monsterHeight) so the engine swaps it in for timeline.look === "simple".
//   A tall dark blocky creature (~4.6 m): long legs and arms, a big head block; spec.eyes = 1 (the planner sets it when
//   the story has "one eye" / "its eye") makes the head's front ONE huge eye, else two glowing eyes.
//   The eye's own states (spec of the shot: monsterState.eye, timed by monsterState.eyeAt = shot-local seconds of the word):
//     stare  - wide open, the pupil glowing and slowly pulsing, the head still, a slow lean in
//     twitch - the lids jitter fast (a nervous flutter), the pupil darts
//     blink  - the lids slam shut at eyeAt and open again (then the eye flinches back)
//     press  - the head pushed forward, the eye squashed flat against a pane of glass (window frame + glass in front)
//   Body states as the kit: lurk (sways), reach (one arm out), reveal (rises, arms wide), flee (turns, runs off).
import * as THREE from "three";
import { mat, box, rbox } from "./common.js";

export const EYE_STATES = Object.freeze(["stare", "squint", "twitch", "blink", "press"]);
// VARIANTS (2026-11-12): the same tall body, another face; spec.variant. Each plays its SIGNATURE on the eye states:
//   peeker     one huge glowing eye (the default; the eye's own lids)
//   shadow     faceless: no eye; it stretches taller on stare, flickers out on blink, shivers on twitch
//   grin       a wide glowing grin: widens on stare, flickers on blink, jitters on twitch
//   hat        a tall hat, one dim eye: tips the hat on blink, the hat wobbles on twitch
//   many_eyes  six small eyes: they open in turn on stare, close in turn on blink, dart on twitch
export const MONSTER_VARIANTS = Object.freeze(["peeker", "shadow", "grin", "hat", "many_eyes"]);
// TALLER + THINNER (owner 2026-11-10: "it towers over the houses in wide shots"): long legs and torso, a bigger head;
// ~11.6 m, well over a two-storey roof (~9.3 m)
const LEG = 5.6, TOR = 3.4, ARM = 4.4, HEADK = 1.6;
const H = +(LEG + TOR + 1.4 * HEADK + 0.35 * HEADK).toFixed(2);

export function makeMonster(spec = {}) {
  const root = new THREE.Group(); root.name = `monster:${spec.name ?? "x"}`;
  const body = new THREE.Group(); root.add(body);
  const dark = mat("#1d2233", { rough: 0.7 }), dark2 = mat("#2a3047", { rough: 0.7 }), claw = mat("#0d0f18", { rough: 0.5 });
  const glow = spec.glow && /^#[0-9a-f]{6}$/i.test(spec.glow) ? spec.glow : "#ffe14a";
  // legs + hips
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.36, LEG, 0); body.add(p); rbox(p, [0.46, LEG, 0.52], [0, -LEG / 2, 0], dark, 0.08); rbox(p, [0.6, 0.24, 0.85], [0, -LEG + 0.02, 0.1], claw, 0.05); return p; });
  // a long narrow torso, hunched
  const torso = new THREE.Group(); torso.position.set(0, LEG, 0); body.add(torso);
  rbox(torso, [1.25, TOR, 0.78], [0, TOR / 2, 0], dark, 0.1);
  rbox(torso, [0.9, TOR * 0.55, 0.12], [0, TOR * 0.55, 0.4], dark2, 0.05); // a chest plate in a lighter shade
  // long arms to the knees, three blocky claws each
  const arms = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.82, TOR - 0.15, 0); torso.add(p); rbox(p, [0.36, ARM, 0.4], [0, -ARM / 2, 0], dark, 0.08); for (const k of [-1, 0, 1]) rbox(p, [0.12, 0.45, 0.12], [k * 0.12, -ARM - 0.18, 0.05], claw, 0.03); return p; });
  // the head: a big block; its front is the eye
  const head = new THREE.Group(); head.position.set(0, TOR + 0.02, 0.05); head.scale.setScalar(HEADK); torso.add(head);
  rbox(head, [1.5, 1.4, 1.3], [0, 0.7, 0], dark, 0.12);
  const one = Number(spec.eyes) === 1;
  const eyes = [];
  // THE EYE (owner 2026-11-10 review: "read as an EYE, not a lit window or a lamp"): ROUND parts (the town's windows are
  // square), a pale sclera, a coloured iris ring, a dark pupil, a highlight, a soft rim glow; every emissive under the
  // night bloom threshold (page/simple/post.js 1.4), so nothing blows out
  const disc = (rad) => { const g = new THREE.CylinderGeometry(rad, rad, 0.05, 40); g.rotateX(Math.PI / 2); return g; };
  const rimM = new THREE.MeshStandardMaterial({ color: glow, roughness: 0.5, emissive: glow, emissiveIntensity: 0.55 });
  const socketM = mat("#0a0c14", { rough: 0.6 });
  const sclera = new THREE.MeshStandardMaterial({ color: "#fff4cf", roughness: 0.35, emissive: "#fff4cf", emissiveIntensity: 0.38 });
  const iris = new THREE.MeshStandardMaterial({ color: "#ff8a1f", roughness: 0.35, emissive: "#ff8a1f", emissiveIntensity: 0.8 });
  const irisIn = new THREE.MeshStandardMaterial({ color: "#ffd23a", roughness: 0.35, emissive: "#ffd23a", emissiveIntensity: 0.7 });
  const pupil = mat("#050508", { rough: 0.3 });
  const shine = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.2, emissive: "#ffffff", emissiveIntensity: 1.0 });
  const lidM = mat("#56648c", { rough: 0.6 }), lashM = mat("#07080d", { rough: 0.5 });
  const mesh = (geo, mt, z, parent, x = 0, y = 0) => { const o = new THREE.Mesh(geo, mt); o.position.set(x, y, z); parent.add(o); return o; };
  const makeEye = (x, y, r) => {
    const e = new THREE.Group(); e.position.set(x, y, 0.66); head.add(e);
    // a soft halo round the eye (additive, low: it lights the night sky round the eye, never blooms)
    const halo = mesh(new THREE.PlaneGeometry(r * 4.4, r * 4.4), haloMat(glow), -0.02, e);
    mesh(disc(r * 1.2), rimM, 0.0, e); // the soft rim glow
    mesh(disc(r * 1.1), socketM, 0.02, e);
    const ball = mesh(disc(r), sclera, 0.05, e);
    const ir = new THREE.Group(); ir.position.z = 0.08; e.add(ir);
    mesh(disc(r * 0.56), iris, 0, ir); mesh(disc(r * 0.4), irisIn, 0.01, ir); mesh(disc(r * 0.26), pupil, 0.02, ir);
    mesh(disc(r * 0.1), shine, 0.03, ir, r * 0.17, r * 0.18); mesh(disc(r * 0.05), shine, 0.03, ir, -r * 0.12, -r * 0.15);
    // lids: a lighter block than the head (top lid down to just under the middle, bottom lid up to meet it) + the lash line
    const top = new THREE.Group(); top.position.set(0, r * 1.12, 0.22); e.add(top);
    box(top, [r * 2.3, r * 1.17, 0.06], [0, -r * 0.585, 0], lidM, { cast: false });
    const bot = new THREE.Group(); bot.position.set(0, -r * 1.12, 0.22); e.add(bot);
    box(bot, [r * 2.3, r * 1.07, 0.06], [0, r * 0.535, 0], lidM, { cast: false });
    const lash = new THREE.Group(); lash.position.set(0, -r * 0.05, 0.27); e.add(lash);
    box(lash, [r * 2.0, r * 0.09, 0.03], [0, 0, 0], lashM, { cast: false });
    for (const k of [-2, -1, 0, 1, 2]) box(lash, [r * 0.06, r * 0.22, 0.03], [k * r * 0.4, -r * 0.14, 0], lashM, { cast: false, rot: [0, 0, k * 0.18] });
    eyes.push({ e, ball, ir, top, bot, lash, r, halo });
  };
  const variant = MONSTER_VARIANTS.includes(spec.variant) ? spec.variant : "peeker";
  if (variant === "many_eyes") { for (const [x, y, r] of [[-0.42, 1.05, 0.2], [0.05, 1.12, 0.17], [0.45, 1.0, 0.21], [-0.3, 0.55, 0.18], [0.2, 0.5, 0.24], [0.52, 0.42, 0.13]]) makeEye(x, y, r); }
  else if (variant === "hat") makeEye(0, 0.72, 0.3);
  else if (one || variant !== "peeker") makeEye(0, 0.72, 0.58); else { makeEye(-0.36, 0.78, 0.26); makeEye(0.36, 0.78, 0.26); }
  const vparts = {};
  if (variant === "shadow" || variant === "grin") for (const e of eyes) e.e.visible = false; // faceless / the grin is the face (the eye stays as an anchor)
  if (variant === "grin") { const g = new THREE.Group(); g.position.set(0, 0.45, 0.67); head.add(g); const gm = new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.1 }); for (let i = -4; i <= 4; i++) box(g, [0.16, 0.18 - Math.abs(i) * 0.012, 0.04], [i * 0.18, -0.12 + Math.abs(i) * Math.abs(i) * 0.012, 0], gm, { cast: false }); vparts.grin = g; vparts.grinM = gm; }
  if (variant === "hat") { const h = new THREE.Group(); h.position.set(0, 1.45, 0); head.add(h); box(h, [1.6, 0.08, 1.4], [0, 0, 0], mat("#141621")); box(h, [1.0, 1.3, 0.95], [0, 0.68, 0], mat("#141621")); box(h, [1.02, 0.14, 0.97], [0, 0.2, 0], mat("#7a1f2a")); vparts.hat = h; }
  // two little horns of block
  for (const s of [-1, 1]) { const h = rbox(head, [0.2, 0.5, 0.2], [s * 0.55, 1.6, -0.1], dark2, 0.04); h.rotation.z = -s * 0.3; }
  // the pane the eye presses on (press state)
  const pane = new THREE.Group(); pane.position.set(0, 0.72, 1.05); head.add(pane); pane.visible = false;
  const frameM = mat("#fff6e6", { rough: 0.7 });
  for (const [w, h, x, y] of [[2.3, 0.2, 0, 1.0], [2.3, 0.2, 0, -1.0], [0.2, 2.2, -1.05, 0], [0.2, 2.2, 1.05, 0], [0.08, 1.85, 0, 0], [1.95, 0.08, 0, 0]]) box(pane, [w, h, 0.12], [x, y, 0], frameM);
  box(pane, [2.6, 0.14, 0.4], [0, -1.15, 0.12], frameM); // the sill
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 1.85), new THREE.MeshStandardMaterial({ color: "#cfeaff", roughness: 0.05, transparent: true, opacity: 0.16 }));
  pane.add(glass);
  // a soft light of its own (the eye lights what it looks at)
  const eyeLight = new THREE.PointLight(glow, 1.0, 10, 1.6); eyeLight.position.set(0, 0.72, 3.2); head.add(eyeLight); // well in front: it lights what the eye looks at, never the eye itself
  root.traverse((o) => { if (o.isMesh) { o.castShadow = o !== glass; o.receiveShadow = true; } });
  root.userData = { kind: "monster", variant, vparts, height: H, eyeY: LEG + TOR + 0.02 + 0.72 * HEADK, headDepth: 0.7 * HEADK, body, torso, head, arms, legs, eyes, pane, one, iris, eyeLight, simple: true };
  return root;
}
const HALO = new Map();
function haloMat(color) {
  if (HALO.has(color)) return HALO.get(color);
  const cv = document.createElement("canvas"); cv.width = cv.height = 128;
  const c = cv.getContext("2d"), g = c.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, color); g.addColorStop(0.45, color); g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const mm = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  HALO.set(color, mm); return mm;
}
export const monsterHeight = (m) => m.userData.height;
/** the torso bend that brings a kneeling Peeker's eye down to height y (page/engine.js: at a window) */
export const kneelBend = (y) => Math.acos(Math.max(0.12, Math.min(1, (y - 0.6) / (TOR + 0.02 + 0.72 * HEADK))));

const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
/** lids: 0 = open, 1 = shut */
function lids(u, k) { for (const e of u.eyes) { const s = Math.max(0.001, k); e.top.scale.y = s; e.bot.scale.y = s; e.top.visible = e.bot.visible = k > 0.01; e.lash.visible = k > 0.9; } }
/**
 * animateMonster(m, state, t, { eye, eyeAt }): the body state (lurk / reach / reveal / flee) + the eye's state.
 * Deterministic in t.
 */
export function animateMonster(m, state = "lurk", t = 0, opts = {}) {
  const u = m.userData, { torso, head, arms, legs, body } = u;
  // peering in at a room's window (opts.crisp): no halo, no eye light, no pane of its own (the room's window frames it):
  // the iris, pupil and highlight read crisp, nothing blooms
  for (const e of u.eyes) e.halo.visible = !opts.crisp;
  u.eyeLight.intensity = opts.crisp ? 0 : 1.0;
  for (const o of [torso, head, ...arms, ...legs, body]) o.rotation.set(0, 0, 0);
  body.position.set(0, 0, 0); head.position.z = 0.05; head.scale.set(1, 1, 1);
  const sway = Math.sin(t * 1.3);
  torso.rotation.x = 0.22; head.rotation.x = -0.12; // hunched, the eye toward the street
  switch (state) {
    case "reach": arms[0].rotation.x = -1.35 - 0.1 * Math.sin(t * 2); arms[1].rotation.x = -0.3; torso.rotation.x = 0.35; break;
    case "reveal": { const k = ease(t / 0.8); torso.rotation.x = 0.22 - 0.3 * k; arms[0].rotation.z = -1.1 * k; arms[1].rotation.z = 1.1 * k; head.rotation.x = -0.12 + 0.15 * k; break; }
    case "flee": { const ph = t * 7; legs[0].rotation.x = 0.6 * Math.sin(ph); legs[1].rotation.x = -0.6 * Math.sin(ph); body.rotation.y = Math.PI; body.position.z = -1.6 * t; torso.rotation.x = 0.4; break; }
    default: torso.rotation.z = 0.05 * sway; head.rotation.z = -0.04 * sway; arms[0].rotation.x = 0.1 * sway; arms[1].rotation.x = -0.1 * sway;
  }
  // KNEELING at a house window (opts.kneel = { bend }, owner 2026-11-11: "the Peeker's real eye behind the glass of a
  // real house window, its body visible outside"): the shins flat behind it on the ground, the hips low, the torso bent
  // forward so the eye comes down to the window, the head level (the eye looks straight in), the arms hanging
  if (opts.kneel) {
    const b = Math.max(0, Math.min(1.45, Number(opts.kneel.bend) || 0));
    body.position.set(0, -LEG + 0.55, 0);
    for (const l of legs) l.rotation.x = Math.PI / 2;
    torso.rotation.set(b, 0, 0.03 * sway); head.rotation.set(-b, 0, 0);
    for (const [i, a] of arms.entries()) { a.rotation.set(-b + (b > 0.8 ? 0 : 0.15), 0, (i ? 1 : -1) * (b > 0.8 ? 0.5 : 0.12)); }
  }
  // the eye
  const eye = EYE_STATES.includes(opts.eye) ? opts.eye : "stare";
  const at = Number(opts.eyeAt) || 0;
  let lid = 0;
  u.pane.visible = false;
  for (const e of u.eyes) e.ir.position.set(0, 0, 0.08);
  u.iris.emissiveIntensity = 0.8 + 0.2 * Math.sin(t * 2.4);
  switch (eye) {
    case "twitch": {
      if (t < at) { lid = 0; break; } // a wide stare until the word, then the lid flutters
      lid = 0.25 + 0.2 * Math.abs(Math.sin(t * 31)) * (Math.sin(t * 5.3) > 0 ? 1 : 0.3);
      for (const e of u.eyes) e.ir.position.x = e.r * 0.18 * Math.sin(t * 23);
      head.rotation.z += 0.03 * Math.sin(t * 27);
      break;
    }
    case "squint": { // suspicious: the lids half down, narrowing a little more now and then
      lid = 0.42 + 0.1 * Math.max(0, Math.sin(t * 1.7));
      head.position.z = 0.05 + 0.12 * ease(t / 1.5);
      break;
    }
    case "blink": {
      const d = t - at; // a SLOW blink at the word: the lids sink, hold shut, lift slowly, then it flinches back
      lid = d < 0 ? 0 : d < 0.35 ? ease(d / 0.35) : d < 0.65 ? 1 : d < 1.25 ? 1 - ease((d - 0.65) / 0.6) : 0;
      if (d > 0.65) { const f = ease((d - 0.65) / 0.6); head.position.z = 0.05 - 0.35 * f; torso.rotation.x -= 0.15 * f; }
      break;
    }
    case "press": {
      const k = ease((t - at + 0.2) / 0.5);
      if (!opts.kneel) { torso.rotation.x = 0.22 + 0.35 * k; head.rotation.x = -0.35 * k; } head.position.z = 0.05 + 0.25 * k;
      head.scale.set(1 + 0.12 * k, 1 + 0.12 * k, 1 - 0.18 * k); // squashed against the glass
      u.pane.visible = !opts.crisp && !opts.kneel; u.pane.position.z = 1.05 - 0.2 * k; // at a real window: no pane of its own
      for (const e of u.eyes) e.ir.position.z = 0.08 + 0.02 * k;
      break;
    }
    default: { // stare: wide, still, a slow lean in; the pupil holds the lens
      lid = 0;
      head.position.z = 0.05 + 0.15 * ease(t / 2);
    }
  }
  lids(u, lid);
  signature(u, eye, t, at);
}

/** the variant's own motion on the eye state (shot-local t, at = the word's time) */
function signature(u, eye, t, at) {
  const v = u.variant ?? "peeker", P = u.vparts ?? {}, d = t - at;
  if (v === "shadow") { u.body.scale.set(1, 1, 1); for (const o of [u.torso]) o.scale.set(1, 1, 1);
    if (eye === "stare") u.torso.scale.y = 1 + 0.18 * ease(t / 1.5);
    if (eye === "blink") u.body.visible = !(d > 0 && d < 0.5 && Math.floor(d * 14) % 2 === 0); else u.body.visible = true;
    if (eye === "twitch" && t > at) u.body.position.x += 0.06 * Math.sin(t * 40); }
  if (v === "grin" && P.grin) { P.grin.scale.set(1, 1, 1); P.grinM.emissiveIntensity = 1.1;
    if (eye === "stare") P.grin.scale.x = 1 + 0.35 * ease(t / 1.2);
    if (eye === "blink" && d > 0 && d < 0.6) P.grinM.emissiveIntensity = Math.floor(d * 12) % 2 ? 0.05 : 1.4;
    if (eye === "twitch" && t > at) { P.grin.position.x = 0.05 * Math.sin(t * 35); P.grin.scale.y = 1 + 0.25 * Math.abs(Math.sin(t * 20)); } else P.grin.position.x = 0; }
  if (v === "hat" && P.hat) { P.hat.rotation.set(0, 0, 0); P.hat.position.y = 1.45;
    if (eye === "blink" && d > 0) { const k = d < 0.6 ? ease(d / 0.3) - ease((d - 0.3) / 0.3) : 0; P.hat.rotation.x = -0.5 * k; P.hat.position.y = 1.45 + 0.25 * k; }
    if (eye === "twitch" && t > at) P.hat.rotation.z = 0.12 * Math.sin(t * 22); }
  if (v === "many_eyes") u.eyes.forEach((e, i) => {
    const k = eye === "stare" ? 1 - ease((t - i * 0.18) / 0.25) : eye === "blink" && d > 0 ? ease((d - i * 0.1) / 0.15) - ease((d - 0.6 - i * 0.1) / 0.2) : 0;
    const s = Math.max(0.001, Math.min(1, k)); e.top.scale.y = s; e.bot.scale.y = s; e.top.visible = e.bot.visible = s > 0.01;
    e.ir.position.x = eye === "twitch" && t > at ? e.r * 0.25 * Math.sin(t * 19 + i) : 0; });
}
