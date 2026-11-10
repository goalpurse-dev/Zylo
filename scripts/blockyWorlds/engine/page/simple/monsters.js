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

export const EYE_STATES = Object.freeze(["stare", "twitch", "blink", "press"]);
const H = 4.6;

export function makeMonster(spec = {}) {
  const root = new THREE.Group(); root.name = `monster:${spec.name ?? "x"}`;
  const body = new THREE.Group(); root.add(body);
  const dark = mat("#1d2233", { rough: 0.7 }), dark2 = mat("#2a3047", { rough: 0.7 }), claw = mat("#0d0f18", { rough: 0.5 });
  const glow = spec.glow && /^#[0-9a-f]{6}$/i.test(spec.glow) ? spec.glow : "#ffe14a";
  // legs + hips
  const legs = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.42, 2.0, 0); body.add(p); rbox(p, [0.55, 2.0, 0.6], [0, -1.0, 0], dark, 0.08); rbox(p, [0.68, 0.22, 0.85], [0, -1.98, 0.1], claw, 0.05); return p; });
  // a long narrow torso, hunched
  const torso = new THREE.Group(); torso.position.set(0, 2.0, 0); body.add(torso);
  rbox(torso, [1.45, 1.6, 0.85], [0, 0.8, 0], dark, 0.1);
  rbox(torso, [1.1, 0.9, 0.12], [0, 0.8, 0.43], dark2, 0.05); // a chest plate in a lighter shade
  // long arms to the knees, three blocky claws each
  const arms = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * 0.92, 1.45, 0); torso.add(p); rbox(p, [0.42, 2.1, 0.45], [0, -1.05, 0], dark, 0.08); for (const k of [-1, 0, 1]) rbox(p, [0.12, 0.38, 0.12], [k * 0.13, -2.25, 0.05], claw, 0.03); return p; });
  // the head: a big block; its front is the eye
  const head = new THREE.Group(); head.position.set(0, 1.62, 0.05); torso.add(head);
  rbox(head, [1.5, 1.4, 1.3], [0, 0.7, 0], dark, 0.12);
  const one = Number(spec.eyes) === 1;
  const eyes = [];
  const sclera = new THREE.MeshStandardMaterial({ color: "#f2ecd8", roughness: 0.35, emissive: "#fff2c8", emissiveIntensity: 0.12 }); // lit, never blown out: the iris is what glows
  const iris = new THREE.MeshStandardMaterial({ color: glow, roughness: 0.3, emissive: glow, emissiveIntensity: 1.3 });
  const pupil = mat("#050508", { rough: 0.3 });
  const lidM = mat("#151a28", { rough: 0.6 });
  const makeEye = (x, y, r) => {
    const e = new THREE.Group(); e.position.set(x, y, 0.66); head.add(e);
    rbox(e, [r * 2.1, r * 1.8, 0.1], [0, 0, 0], lidM, 0.06); // the socket rim
    const ball = rbox(e, [r * 1.9, r * 1.6, 0.14], [0, 0, 0.04], sclera, r * 0.5);
    const ir = new THREE.Group(); ir.position.z = 0.12; e.add(ir);
    rbox(ir, [r * 0.95, r * 0.95, 0.06], [0, 0, 0], iris, r * 0.3);
    rbox(ir, [r * 0.46, r * 0.62, 0.06], [0, 0, 0.03], pupil, r * 0.18); // a tall slit-ish pupil
    box(ir, [r * 0.16, r * 0.16, 0.02], [r * 0.18, r * 0.2, 0.065], mat("#ffffff", { rough: 0.2, emissive: "#ffffff", ei: 1.5 }), { cast: false }); // the shine
    const top = new THREE.Group(); top.position.y = r * 0.8; e.add(top); rbox(top, [r * 2.0, r * 1.6, 0.12], [0, r * 0.8, 0.22], lidM, 0.05);
    const bot = new THREE.Group(); bot.position.y = -r * 0.8; e.add(bot); rbox(bot, [r * 2.0, r * 1.0, 0.12], [0, -r * 0.5, 0.22], lidM, 0.05);
    eyes.push({ e, ball, ir, top, bot, r });
  };
  if (one) makeEye(0, 0.72, 0.58); else { makeEye(-0.36, 0.78, 0.26); makeEye(0.36, 0.78, 0.26); }
  // two little horns of block
  for (const s of [-1, 1]) { const h = rbox(head, [0.2, 0.5, 0.2], [s * 0.55, 1.6, -0.1], dark2, 0.04); h.rotation.z = -s * 0.3; }
  // the pane the eye presses on (press state)
  const pane = new THREE.Group(); pane.position.set(0, 0.72, 1.05); head.add(pane); pane.visible = false;
  const frameM = mat("#ffffff", { rough: 0.7 });
  for (const [w, h, x, y] of [[1.9, 0.12, 0, 0.85], [1.9, 0.12, 0, -0.85], [0.12, 1.8, -0.9, 0], [0.12, 1.8, 0.9, 0], [0.08, 1.7, 0, 0]]) box(pane, [w, h, 0.1], [x, y, 0], frameM);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.6), new THREE.MeshStandardMaterial({ color: "#bfe6ff", roughness: 0.1, transparent: true, opacity: 0.28 }));
  pane.add(glass);
  // a soft light of its own (the eye lights what it looks at)
  const eyeLight = new THREE.PointLight(glow, 1.4, 10, 1.6); eyeLight.position.set(0, 0.72, 3.2); head.add(eyeLight); // well in front: it lights what the eye looks at, never the eye itself
  root.traverse((o) => { if (o.isMesh) { o.castShadow = o !== glass; o.receiveShadow = true; } });
  root.userData = { kind: "monster", height: H, body, torso, head, arms, legs, eyes, pane, one, iris, eyeLight, simple: true };
  return root;
}
export const monsterHeight = (m) => m.userData.height;

const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
/** lids: 0 = open, 1 = shut */
function lids(u, k) { for (const e of u.eyes) { e.top.position.y = e.r * 0.8 - k * e.r * 1.12; e.bot.position.y = -e.r * 0.8 + k * e.r * 0.5; } }
/**
 * animateMonster(m, state, t, { eye, eyeAt }): the body state (lurk / reach / reveal / flee) + the eye's state.
 * Deterministic in t.
 */
export function animateMonster(m, state = "lurk", t = 0, opts = {}) {
  const u = m.userData, { torso, head, arms, legs, body } = u;
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
  // the eye
  const eye = EYE_STATES.includes(opts.eye) ? opts.eye : "stare";
  const at = Number(opts.eyeAt) || 0;
  let lid = 0;
  u.pane.visible = false;
  for (const e of u.eyes) e.ir.position.set(0, 0, 0.12);
  u.iris.emissiveIntensity = 1.3 + 0.35 * Math.sin(t * 2.4);
  switch (eye) {
    case "twitch": {
      lid = 0.25 + 0.2 * Math.abs(Math.sin(t * 31)) * (Math.sin(t * 5.3) > 0 ? 1 : 0.3);
      for (const e of u.eyes) e.ir.position.x = e.r * 0.18 * Math.sin(t * 23);
      head.rotation.z += 0.03 * Math.sin(t * 27);
      break;
    }
    case "blink": {
      const d = t - at; // shut fast at the word, hold, open slowly, then flinch back
      lid = d < 0 ? 0 : d < 0.08 ? d / 0.08 : d < 0.3 ? 1 : d < 0.55 ? 1 - (d - 0.3) / 0.25 : 0;
      if (d > 0.3) { const f = ease((d - 0.3) / 0.5); head.position.z = 0.05 - 0.35 * f; torso.rotation.x -= 0.15 * f; }
      break;
    }
    case "press": {
      const k = ease((t - at + 0.2) / 0.5);
      torso.rotation.x = 0.22 + 0.35 * k; head.rotation.x = -0.35 * k; head.position.z = 0.05 + 0.25 * k;
      head.scale.set(1 + 0.12 * k, 1 + 0.12 * k, 1 - 0.18 * k); // squashed against the glass
      u.pane.visible = true; u.pane.position.z = 1.05 - 0.28 * k;
      for (const e of u.eyes) e.ir.position.z = 0.12 + 0.05 * k;
      break;
    }
    default: { // stare: wide, still, a slow lean in; the pupil holds the lens
      lid = 0;
      head.position.z = 0.05 + 0.15 * ease(t / 2);
    }
  }
  lids(u, lid);
}
