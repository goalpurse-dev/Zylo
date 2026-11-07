// Blocky Worlds ANIMALS (BLOCKY-ANIMALS agent, 2026-11-06): animation of the blocky animal kit. Deterministic per frame
// (chunked rendering: the pose depends on t only), every frame resets the rig to its rest pose first.
//
//   animateAnimal(g, action, t, opts)  actions (species.js ANIMAL_ACTIONS): idle walk run fly swim slither hop crawl
//                                      roar attack head_turn stomp eat sleep hit fall lurk reach dig climb flee howl
//                                      reveal carry slide float; opts: { dur, hitAt (s), at (s), landAt (s), expr,
//                                      noLift (fly without lifting the rig: the caller lifts), dir (head_turn +1/-1) }
//                                      The root's position is the caller's: walking feet are planted for a root that
//                                      moves at animalGait(g, action).speed along +z (its heading).
//   animalGait(g, action)  -> { cadence (cycles/s), stride (m per cycle), speed (m/s), beta, sweep, feet, plan }
//   setAnimalExpr(g, expr)    neutral | angry | scared | happy | sleepy (actions override it: roar -> angry...)
//   animalFeet(g)          -> rig-space ankle targets of this frame's legs (tests: planted feet)
import * as THREE from "three";
import { solveLeg, bodyToRig } from "./build.js";

const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const frac = (x) => x - Math.floor(x);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function reset(g) {
  const U = g.userData;
  for (const [o, r] of U.rest) { o.position.copy(r.p); o.rotation.copy(r.r); o.scale.copy(r.s); }
}
function info(g) {
  const U = g.userData;
  if (U._gi) return U._gi;
  reset(g);
  const J = U.joints;
  let legH = 0;
  for (const l of U.legs) legH += bodyToRig(J, l.splay.position, l.splay.parent).y - l.fh;
  const designH = U.height / U.unit, designL = U.length / U.unit;
  legH = U.legs.length ? legH / U.legs.length : designH * 0.3;
  U._gi = { legH, designH, designL, seed: [...U.species].reduce((h, c) => h + c.charCodeAt(0), 0) % 17 };
  return U._gi;
}

// ------------------------------------------------------------------------------------------------ gait
const BASE_C = { quadruped: 0.42, biped: 0.55, bird: 0.62, fish: 0.3, serpent: 0.35, insect: 0.9, mollusc: 0.25, cephalopod: 0.3, pinniped: 0.45 };
const NONLEG_STRIDE = { fish: 0.45, serpent: 0.22, insect: 0.3, mollusc: 0.08, cephalopod: 0.3, pinniped: 0.22 };
export function animalGait(g, action = "walk") {
  const U = g.userData, gi = info(g), plan = U.plan, hop = U.gaitKind === "hop";
  const k = Math.sqrt(60 / Math.max(0.05, U.size));
  const maxC = plan === "insect" ? 3.5 : hop ? 1.5 : 1.9;
  const c = clamp((hop ? 0.5 : BASE_C[plan] ?? 0.42) * k, 0.08, maxC);
  const legged = U.legs.length > 0 && plan !== "pinniped";
  const S = legged ? gi.legH * (hop ? 0.9 : plan === "bird" ? 0.62 : plan === "biped" ? 0.6 : 0.5) : 0;
  const beta = hop ? 0.45 : plan === "bird" || plan === "biped" ? 0.6 : 0.62;
  const strideD = legged ? S / beta : gi.designL * (NONLEG_STRIDE[plan] ?? 0.3);
  const walk = { plan, cadence: c, stride: strideD * U.unit, speed: strideD * U.unit * c, beta, sweep: S, feet: U.legs.length, lift: gi.legH * (hop ? 0.25 : 0.16) };
  if (action !== "run" && action !== "flee" && action !== "charge" && action !== "chase") return walk;
  const cr = c * (hop ? 1.15 : 1.25), speed = walk.speed * 2, strideR = speed / cr, br = 0.4;
  return { plan, cadence: cr, stride: strideR, speed, beta: br, sweep: legged ? br * strideR / U.unit : 0, feet: walk.feet, lift: gi.legH * (hop ? 0.3 : 0.26) };
}

// ------------------------------------------------------------------------------------------------ expressions
const EXPR = { neutral: [0.14, 0, 0, 1, 0], angry: [0.42, 0.06, 1, 0.82, 1], scared: [0, 0, 1, 0.58, -1], happy: [0.05, 0.48, 0, 1, -0.4], sleepy: [0.62, 0.14, 0, 1, 0], closed: [1, 0, 0, 1, 0] };
export function setAnimalExpr(g, expr = "neutral") { g.userData.expr = EXPR[expr] ? expr : "neutral"; }
function applyEyes(J, expr, blink, lidBase = 0) {
  const [top0, bot, browOn, pup, tilt] = EXPR[expr] ?? EXPR.neutral, top = expr === "neutral" || expr === "happy" ? Math.max(top0, lidBase) : top0;
  for (const e of J.eyes ?? []) {
    const tp = Math.max(top, blink);
    e.lidTop.scale.y = Math.max(0.001, tp); e.lidTop.visible = tp > 0.02;
    e.lidBot.scale.y = Math.max(0.001, bot); e.lidBot.visible = bot > 0.02;
    if (expr === "angry") e.lidTop.rotation.z = e.side * 0.32;
    e.brow.visible = !!(browOn || e.hasBrow) && tp < 0.95;
    e.brow.rotation.z = e.side * 0.42 * tilt;
    if (tilt < 0) e.brow.position.y += e.s * 0.14;
    if (tilt > 0) e.brow.position.y -= e.s * 0.08;
    e.pupil.scale.setScalar(pup); if (e.iris) e.iris.scale.setScalar(0.85 + 0.15 * pup);
    if (e.white && expr === "scared") e.white.scale.setScalar(1.08);
    else if (e.white) e.white.scale.setScalar(1);
  }
}
const ACTION_EXPR = { roar: "angry", attack: "angry", stomp: "angry", lurk: "angry", reveal: "angry", howl: "angry", reach: "angry", flee: "scared", hit: "scared", fall: "scared", sleep: "closed", eat: "happy" };

// ------------------------------------------------------------------------------------------------ legs
const OFFS = { walk4: [0.25, 0.75, 0, 0.5], trot4: [0, 0.5, 0.5, 0], hop4: [0.06, 0.06, 0, 0], two: [0, 0.5] };
function restTarget(l) { return V(l.restX, l.fh, l.restZ); }
/** the legs' targets of a gait at time t (sets the body's hop arc / bob); returns { targets, toes, u0 } */
function gaitLegs(U, J, gt, t, hop, gi) {
  const n = U.legs.length, offs = hop ? OFFS.hop4 : n === 2 ? OFFS.two : gt.beta < 0.5 ? OFFS.trot4 : OFFS.walk4;
  const u0 = t * gt.cadence, S = gt.sweep, targets = [], toes = [];
  let arc = 0;
  U.legs.forEach((l, i) => {
    const u = frac(u0 + (offs[i] ?? 0));
    const tg = restTarget(l);
    if (u < gt.beta) { tg.z += S / 2 - (u / gt.beta) * S; toes.push(0); }
    else {
      const s = (u - gt.beta) / (1 - gt.beta);
      tg.z += -S / 2 + ease(s) * S; tg.y += gt.lift * Math.sin(Math.PI * s); toes.push(-0.35 * Math.sin(Math.PI * s));
      if (hop && !l.front) arc = Math.max(arc, Math.sin(Math.PI * s));
    }
    targets.push(tg);
  });
  if (hop) { const h = gi.legH * 0.45 * arc; J.body.position.y += h; targets.forEach((tg, i) => { if ((frac(u0 + (offs[i] ?? 0))) >= gt.beta) tg.y += h * 0.8; }); J.body.rotation.x += -0.15 * arc; }
  return { targets, toes, u0 };
}

// ------------------------------------------------------------------------------------------------ the main entry
export function animateAnimal(g, action = "idle", t = 0, opts = {}) {
  const U = g.userData, J = U.joints, plan = U.plan, gi = info(g);
  reset(g);
  const L = gi.legH, H = gi.designH, hop = U.gaitKind === "hop";
  let act = action;
  if (act === "chase" || act === "charge") act = "run";
  if (act === "carry") act = "walk";
  if (act === "hop") act = "walk";
  // the plans without legs walk their own way
  if ((act === "walk" || act === "run" || act === "flee") && (plan === "fish")) act = "swim";
  if ((act === "walk" || act === "run" || act === "flee") && plan === "serpent") act = "slither";
  if ((act === "walk" || act === "run" || act === "flee") && (plan === "insect" || plan === "mollusc" || plan === "cephalopod")) act = act === "walk" ? "crawl" : "crawl_fast";
  if (act === "slither" && plan !== "serpent") act = plan === "fish" ? "swim" : "walk";
  if (act === "crawl" && !["insect", "mollusc", "cephalopod"].includes(plan)) act = "walk";
  const st = { targets: null, toes: null, ik: true, expr: opts.expr ?? ACTION_EXPR[action] ?? U.expr ?? "neutral", blink: 0, headLook: 1, wingsOpen: 0 };
  // ---- idle life everywhere: breathing, a slow look round, ear flicks, the tail, blinking
  const br = Math.sin(t * TAU * 0.32 + gi.seed);
  J.body.position.y += br * H * 0.006;
  if (J.torso) J.torso.rotation.x += 0.02 * br;
  const look = 0.28 * Math.sin(t * TAU * 0.09 + gi.seed) + 0.1 * Math.sin(t * TAU * 0.23 + 1.3 * gi.seed);
  const blinkPh = frac((t + gi.seed * 0.37) / 3.6);
  st.blink = blinkPh < 0.035 ? 1 : 0;
  (J.ears ?? []).forEach((e, i) => { const tw = frac((t + i * 1.7 + gi.seed) / 4.3); e.rotation.x += tw < 0.06 ? 0.25 * Math.sin(tw / 0.06 * Math.PI) : 0; });
  (J.tail ?? []).forEach((s, i) => { s.rotation.y += 0.1 * Math.sin(t * TAU * 0.5 - i * 0.6); });
  (J.trunk ?? []).forEach((s, i) => { s.rotation.x += 0.05 * Math.sin(t * TAU * 0.35 - i * 0.5) + 0.02 * i; s.rotation.y += 0.04 * Math.sin(t * TAU * 0.2 - i * 0.4); });
  (J.stalks ?? []).forEach((s, i) => { s.rotation.x += 0.12 * Math.sin(t * 1.1 + i * 1.7); });
  (J.antennae ?? []).forEach((s, i) => { s.rotation.x += 0.15 * Math.sin(t * 2.3 + i * 2); s.rotation.z += 0.08 * Math.sin(t * 1.7 + i); });
  (J.tents ?? []).forEach((ch, k) => ch.forEach((s, j) => { s.rotation.x += 0.08 * Math.sin(t * 1.3 + k * 0.8 - j * 0.6); }));
  if (J.tongue) { const f = frac(t / 1.6); J.tongue.scale.z = f < 0.25 ? Math.sin(f / 0.25 * Math.PI) : 0.001; J.tongue.rotation.y = 0.2 * Math.sin(t * 30); }
  (J.wings ?? []).forEach((w, i) => { w.rotation.z += (i ? -1 : 1) * 0.02 * br; });
  const moving = ["walk", "run", "flee", "swim", "slither", "crawl", "crawl_fast", "fly"].includes(act);
  if (J.head && !moving && !["roar", "howl", "attack", "eat", "sleep", "dig", "head_turn"].includes(act)) { J.head.rotation.y += look; J.head.rotation.x += 0.04 * Math.sin(t * TAU * 0.13); }
  const legged = U.legs.length > 0 && plan !== "pinniped";
  const side = (i) => (U.legs[i]?.side ?? (i % 2 ? -1 : 1));

  switch (act) {
    case "idle": break;
    case "walk": case "run": case "flee": {
      if (plan === "pinniped") { galumph(J, t, animalGait(g, act), act !== "walk"); break; }
      const gt = animalGait(g, act), fast = act !== "walk";
      const r = gaitLegs(U, J, gt, t, hop, gi);
      st.targets = r.targets; st.toes = r.toes;
      const ph = r.u0 * TAU;
      if (!hop) { J.body.position.y += (fast ? 0.05 : 0.025) * L * Math.cos(ph * 2); J.body.rotation.x += (fast ? 0.035 : 0.015) * Math.sin(ph * 2) + (fast ? 0.04 : 0); }
      J.body.rotation.z += (U.gaitKind === "waddle" ? 0.13 : plan === "biped" || plan === "bird" ? 0.05 : 0.02) * Math.sin(ph);
      if (U.gaitKind === "waddle") J.body.rotation.y += 0.08 * Math.sin(ph);
      if (J.head) J.head.rotation.x += 0.05 * Math.sin(ph * 2);
      if (plan === "bird" && J.neck) J.neck.position.z += 0.18 * Math.sin(ph * 2) * (U.gaitKind === "waddle" ? 0.3 : 1);
      (J.tail ?? []).forEach((s, i) => { s.rotation.y += (fast ? 0.2 : 0.12) * Math.sin(ph - i * 0.7); if (fast) s.rotation.x += 0.1; });
      (J.ears ?? []).forEach((e) => { e.rotation.x += (fast ? -0.25 : 0) + 0.05 * Math.sin(ph * 2); });
      if (J.arms) J.arms.forEach((a, i) => { a.rotation.x += (fast ? 0.7 : 0.35) * Math.sin(ph + (i ? 0 : Math.PI)); J.elbows[i].rotation.x -= fast ? 0.7 : 0.25; });
      if (J.trunk) J.trunk.forEach((s, i) => { s.rotation.x += 0.08 * Math.sin(ph - i * 0.4); });
      if (plan === "bird" && fast) st.wingsOpen = 0.35 + 0.15 * Math.sin(ph * 3);
      if (act === "flee" && J.head) J.head.rotation.y += 0.25 * Math.sin(t * 1.5);
      break;
    }
    case "swim": {
      if (plan === "fish") { fishSwim(U, J, t, animalGait(g, "swim")); break; }
      if (plan === "serpent") { slither(J, t, animalGait(g, "walk")); break; }
      if (plan === "pinniped") { galumph(J, t, animalGait(g, "walk"), true, true); break; }
      if (plan === "cephalopod") { jet(J, t, animalGait(g, "walk")); break; }
      // legged: a paddle (feet circling under the body), head up, body low and level
      const c = animalGait(g, "walk").cadence * 1.4, ph = t * c * TAU;
      J.body.position.y -= L * 0.25; J.body.rotation.x += 0.08 + 0.03 * Math.sin(ph * 2);
      if (J.neck) J.neck.rotation.x -= 0.2;
      st.targets = U.legs.map((l, i) => { const p = restTarget(l), a = ph + (i % 2) * Math.PI + (l.front ? 0 : Math.PI / 2); p.y += L * 0.18 + L * 0.12 * Math.sin(a); p.z += L * 0.28 * Math.cos(a); return p; });
      if (plan === "bird") st.targets = U.legs.map((l, i) => { const p = restTarget(l), a = ph + i * Math.PI; p.y += L * 0.3; p.z += L * 0.35 * Math.sin(a); return p; });
      break;
    }
    case "slither": slither(J, t, animalGait(g, "walk"), action === "run" || action === "flee" ? 1.8 : 1); break;
    case "crawl": case "crawl_fast": {
      const gt = animalGait(g, act === "crawl" ? "walk" : "run");
      if (plan === "insect") insectCrawl(J, t, gt);
      else if (plan === "mollusc") snailCrawl(J, t, gt);
      else octoCrawl(J, t, gt);
      break;
    }
    case "fly": {
      const k = ease(t / 0.7), f = clamp(2.2 / Math.sqrt(U.size), 0.25, 4), ph = t * f * TAU;
      if (!opts.noLift) J.rig.position.y += H * 0.7 * k * U.unit;
      J.body.position.y += -0.04 * H * Math.sin(ph) * k;
      if (J.wings) {
        st.wingsOpen = -1; // the wings are posed here
        J.wings.forEach((w, i) => { const s = i ? -1 : 1; const r = U.rest.get(w).r; w.rotation.set(r.x * (1 - k), r.y * (1 - k) + s * 0.1 * k, r.z * (1 - k) + s * (0.2 + 0.85 * Math.sin(ph)) * k); });
        (J.wingTips ?? []).forEach((w, i) => { const s = i ? -1 : 1; w.rotation.z += s * 0.45 * Math.sin(ph - 0.9) * k; });
      }
      if (plan === "bird") { J.body.rotation.x += (U.spec.body.tilt ?? 0.3) * 0.85 * k; if (J.neck) J.neck.rotation.x += -0.2 * k; if (J.tail?.[0]) J.tail[0].rotation.x -= 0.2 * k; }
      else J.body.rotation.x += 0.05 * Math.sin(ph) * k;
      if (legged) st.targets = U.legs.map((l) => { const p = restTarget(l); p.y += L * 0.55 * k; p.z -= L * (l.front ? -0.25 : 0.55) * k; return p; });
      (J.tail ?? []).forEach((s, i) => { s.rotation.x += 0.08 * Math.sin(ph * 0.5 - i * 0.5); });
      if (plan === "cephalopod") jet(J, t, animalGait(g, "walk"));
      if (plan === "fish") fishSwim(U, J, t, animalGait(g, "swim"));
      break;
    }
    case "roar": case "howl": {
      const k = ease(t / 0.35) * (opts.dur ? ease((opts.dur - t) / 0.4) : 1), buzz = 0.025 * Math.sin(t * 38) * k;
      roar(U, J, k, buzz, act === "howl");
      st.wingsOpen = J.wings && plan !== "fish" ? 0.8 * k : 0;
      break;
    }
    case "head_turn": {
      const dir = opts.dir ?? 1, dur = opts.dur ?? 2.4;
      const k = ease(t / 0.5) * (1 - ease((t - (dur - 0.6)) / 0.5));
      if (J.neck && plan !== "bird") J.neck.rotation.y += dir * 0.35 * k;
      if (J.head) { J.head.rotation.y += dir * (plan === "bird" ? 1.2 : 0.55) * k; J.head.rotation.z += -dir * 0.08 * k; }
      if (plan === "fish" || plan === "serpent") J.body.rotation.y += dir * 0.4 * k;
      break;
    }
    case "attack": attack(U, J, t, opts, st, gi); break;
    case "stomp": stomp(U, J, t, st, gi); break;
    case "hit": {
      const at = opts.at ?? 0.3, u = t - at, k = u < 0 ? 0 : Math.exp(-u / 0.5) * Math.sin(Math.min(Math.PI / 2, u * 12));
      J.body.rotation.x -= 0.16 * k; J.body.rotation.z += 0.08 * k; J.body.position.z -= 0.12 * (L || H) * k;
      if (J.head) J.head.rotation.x -= 0.3 * k; if (J.jaw) J.jaw.rotation.x += 0.4 * k;
      (J.stalks ?? []).forEach((s) => { s.rotation.x -= 0.6 * k; });
      break;
    }
    case "fall": {
      const land = opts.landAt ?? 1.0, u = clamp(t / land, 0, 1), ang = (Math.PI / 2 - 0.1) * u * u;
      const bounce = t > land ? 0.05 * Math.exp(-(t - land) / 0.15) * Math.sin((t - land) * 30) : 0;
      J.rig.rotation.z = ang + bounce;
      if (J.jaw) J.jaw.rotation.x += 0.5 * u;
      st.ik = u < 0.05;
      break;
    }
    case "sleep": {
      const k = ease(t / 0.8);
      sleep(U, J, k, gi, st);
      J.body.scale.set(1, 1 + 0.03 * Math.sin(t * 1.3), 1);
      break;
    }
    case "eat": {
      const chomp = 0.5 + 0.5 * Math.sin(t * 7), k = ease(t / 0.5);
      if (plan === "bird") { const pk = Math.max(0, Math.sin(t * 4)); J.body.rotation.x += 0.6 * pk * k; if (J.neck) J.neck.rotation.x += 0.5 * pk * k; }
      else if (plan === "quadruped" || plan === "pinniped") { if (J.neck) J.neck.rotation.x += 0.7 * k; if (J.head) J.head.rotation.x += 0.35 * k; J.body.rotation.x += 0.08 * k; if (J.trunk) J.trunk.forEach((s, i) => { s.rotation.x -= 0.25 * k * (i < 3 ? 1 : -1); }); }
      else if (plan === "biped") { J.arms[0].rotation.x -= 1.2 * k; J.elbows[0].rotation.x -= 1.6 * k; if (J.head) J.head.rotation.x += 0.15 * k; }
      else if (plan === "cephalopod") J.tents.forEach((ch, i) => { if (i < 2) { ch[0].rotation.x -= 1.0 * k; ch[1].rotation.x -= 0.6 * k; } });
      if (J.jaw) J.jaw.rotation.x += (0.1 + 0.4 * chomp) * k;
      (J.mandibles ?? []).forEach((m, i) => { m.rotation.y += (i ? 1 : -1) * 0.3 * chomp; });
      break;
    }
    case "lurk": case "reveal": {
      const kl = act === "lurk" ? 1 : 1 - ease(t / 1.1);
      lurk(U, J, kl, t, gi);
      if (act === "reveal") { const k2 = ease((t - 0.8) / 0.4); roar(U, J, k2, 0.02 * Math.sin(t * 38) * k2, false); st.wingsOpen = J.wings ? 0.9 * k2 : 0; }
      break;
    }
    case "reach": {
      const k = ease(t / 1.0), grab = 0.5 + 0.5 * Math.sin(t * 5);
      J.body.rotation.x += 0.08 * k; J.body.position.z += 0.06 * (L || H) * k;
      if (J.neck) J.neck.rotation.x += 0.25 * k; if (J.head) J.head.rotation.x -= 0.1 * k;
      if (J.jaw) J.jaw.rotation.x += 0.35 * grab * k;
      if (legged && plan === "quadruped") st.targets = U.legs.map((l, i) => { const p = restTarget(l); if (i === 0) { p.y += L * 0.55 * k; p.z += L * 0.55 * k; } return p; });
      if (J.arms) J.arms.forEach((a, i) => { a.rotation.x -= 1.4 * k; J.elbows[i].rotation.x -= 0.3 * grab; });
      if (J.tents) J.tents.forEach((ch, i) => { if (i < 2) { ch[0].rotation.x -= 0.9 * k; ch.forEach((s, j) => { if (j) s.rotation.x = -0.05 * j * grab; }); } });
      if (J.spine && plan === "serpent") J.spine.slice(0, 4).forEach((s, i) => { s.rotation.x -= 0.15 * k * (4 - i) / 4; });
      break;
    }
    case "dig": {
      const a = Math.max(0, Math.sin(t * 6)), b2 = Math.max(0, -Math.sin(t * 6));
      J.body.rotation.x += 0.18; if (J.neck) J.neck.rotation.x += 0.45; if (J.head) J.head.rotation.x += 0.3;
      if (legged && plan === "quadruped") st.targets = U.legs.map((l, i) => { const p = restTarget(l); if (i === 0) { p.y += L * 0.3 * a; p.z -= L * 0.35 * a - L * 0.15; } if (i === 1) { p.y += L * 0.3 * b2; p.z -= L * 0.35 * b2 - L * 0.15; } return p; });
      if (J.arms) { J.torso.rotation.x += 0.6; J.arms[0].rotation.x -= 0.9 + 0.8 * a; J.arms[1].rotation.x -= 0.9 + 0.8 * b2; }
      break;
    }
    case "climb": {
      const a = Math.sin(t * 3);
      if (legged && plan === "quadruped") {
        J.body.rotation.x -= 0.55; J.body.position.y += L * 0.45;
        st.targets = U.legs.map((l, i) => { const p = restTarget(l); if (l.front) { const fp = bodyToRig(J, l.splay.position, l.splay.parent); p.y = fp.y + L * (0.1 + 0.25 * (i ? a : -a)); p.z = fp.z + L * 0.7; } return p; });
      } else { J.rig.rotation.x = -0.4; if (J.arms) J.arms.forEach((arm, i) => { arm.rotation.x -= 2.5 + 0.35 * (i ? a : -a); }); }
      break;
    }
    case "slide": {
      const k = ease(t / 0.4);
      st.ik = false;
      J.body.position.y -= (legged ? L * 0.75 : 0) * k; J.body.rotation.z += 0.05 * Math.sin(t * 9) * k;
      U.legs.forEach((l, i) => { l.splay.rotation.z += side(i) * 1.1 * k; l.hip.rotation.x += (l.front ? -0.6 : 0.6) * k; });
      if (J.head) J.head.rotation.x -= 0.35 * k; if (J.jaw) J.jaw.rotation.x += 0.3 * k;
      if (J.wings) st.wingsOpen = 0.6 * k;
      break;
    }
    case "float": {
      J.body.position.y += 0.03 * H * Math.sin(t * 1.2); J.body.rotation.z += 0.03 * Math.sin(t * 0.9);
      if (legged) st.targets = U.legs.map((l, i) => { const p = restTarget(l), a = t * 1.4 + i * 1.3; p.y += L * 0.15 + L * 0.08 * Math.sin(a); p.z += L * 0.15 * Math.cos(a); return p; });
      if (plan === "fish") fishSwim(U, J, t, animalGait(g, "swim"), 0.3);
      if (J.head) J.head.rotation.x -= 0.08;
      break;
    }
    default: break;
  }
  // wings: folded at rest; opened by actions
  if (J.wings && st.wingsOpen > 0) J.wings.forEach((w, i) => { const s = i ? -1 : 1, k = st.wingsOpen; const r = U.rest.get(w).r; w.rotation.set(r.x * (1 - k), r.y * (1 - k) + s * 0.25 * k, r.z * (1 - k) + s * 0.55 * k); });
  // legs: IK to this frame's targets (rest targets by default: planted feet)
  if (U.legs.length && plan !== "pinniped" && plan !== "insect" && st.ik) U.legs.forEach((l, i) => solveLeg(J, l, st.targets?.[i] ?? restTarget(l), st.toes?.[i] ?? 0));
  U._targets = st.targets ?? U.legs.map(restTarget);
  applyEyes(J, st.expr, act === "sleep" ? 0 : st.blink, U.spec.eyes?.lid ?? 0);
}
export function animalFeet(g) { return g.userData._targets ?? []; }

// ------------------------------------------------------------------------------------------------ the actions
function roar(U, J, k, buzz, howl) {
  if (k <= 0) return;
  const plan = U.plan, L = U._gi.legH, H = U._gi.designH;
  if (J.neck) J.neck.rotation.x -= (howl ? 0.5 : 0.3) * k;
  if (J.head) J.head.rotation.x -= (howl ? 0.55 : 0.35) * k + buzz;
  if (J.jaw) J.jaw.rotation.x += (plan === "bird" ? 0.5 : 0.85) * k;
  (J.ears ?? []).forEach((e) => { e.rotation.x -= 0.4 * k; });
  if (J.trunk) J.trunk.forEach((s, i) => { s.rotation.x -= (0.32 + i * 0.1) * k; });
  if (J.hood) J.hood.scale.set(1 + 0.5 * k, 1 + 0.4 * k, 1);
  (J.tail ?? []).forEach((s, i) => { s.rotation.x += (i ? 0.08 : 0.3) * k; });
  if (plan === "quadruped") { const reach = Math.min(1, (L * 0.45) / Math.max(0.1, (U.spec.body.len ?? 4) / 2)); J.body.rotation.x -= 0.12 * reach * k; J.body.position.y += 0.03 * L * k; }
  if (plan === "biped" && J.arms) { J.torso.rotation.x -= 0.25 * k; J.arms.forEach((a, i) => { a.rotation.z += (i ? -1 : 1) * 1.1 * k; a.rotation.x -= 0.6 * k; J.elbows[i].rotation.x -= 0.5 * k; }); }
  if (plan === "bird") J.body.rotation.x -= 0.15 * k;
  if (plan === "fish") { J.body.rotation.x -= 0.15 * k; (J.spine ?? []).forEach((s) => { s.rotation.x += 0.08 * k; }); }
  if (plan === "serpent") J.spine.slice(0, 5).forEach((s, i) => { s.rotation.x -= (i === 0 ? 0.6 : 0.12) * k; });
  if (plan === "serpent" && J.head) J.head.rotation.x += 0.5 * k;
  if (plan === "cephalopod") J.tents.forEach((ch) => { ch[0].rotation.x -= 0.6 * k; ch.forEach((s, j) => { if (j) s.rotation.x -= 0.12 * k; }); });
  if (plan === "pinniped") { if (J.neck) J.neck.rotation.x -= 0.3 * k; J.body.rotation.x -= 0.15 * k; }
  if (plan === "insect") { J.body.rotation.x -= 0.25 * k; J.body.position.y += 0.2 * H * k; (J.mandibles ?? []).forEach((m, i) => { m.rotation.y += (i ? 1 : -1) * 0.5 * k; }); }
  if (plan === "mollusc") (J.stalks ?? []).forEach((s, i) => { s.rotation.z += (i ? 1 : -1) * 0.3 * k; s.rotation.x -= 0.3 * k; });
}
function attack(U, J, t, opts, st, gi) {
  const plan = U.plan, L = gi.legH || gi.designH * 0.3, hit = opts.hitAt ?? 0.6;
  const wind = ease((t - (hit - 0.55)) / 0.35) * (t < hit ? 1 : 0), strike = Math.max(0, 1 - Math.abs(t - hit) / 0.3) * (t >= hit - 0.15 ? 1 : 0);
  const after = t > hit ? Math.exp(-(t - hit) / 0.6) : 0;
  J.body.position.z += (0.35 * strike + 0.15 * after - 0.12 * wind) * L;
  J.body.rotation.x += 0.1 * strike - 0.08 * wind;
  if (J.neck) J.neck.rotation.x += 0.3 * strike - 0.25 * wind;
  if (J.head) J.head.rotation.x += 0.15 * strike - 0.2 * wind;
  if (J.jaw) J.jaw.rotation.x += 0.85 * wind + 0.3 * after;
  if (plan === "quadruped" && U.legs.length) {
    const swipe = !!U.spec.legs?.claws;
    st.targets = U.legs.map((l, i) => { const p = restTarget(l); if (swipe && i === 0) { p.y += L * (0.7 * wind + 0.3 * strike); p.z += L * (0.6 * strike - 0.1 * wind); } return p; });
  }
  if (plan === "biped" && J.arms) { J.torso.rotation.y += -0.5 * wind + 0.6 * strike; J.arms[0].rotation.x += -2.4 * wind + 1.4 * strike; J.arms[0].rotation.z += 0.4 * wind; }
  if (plan === "bird") { st.wingsOpen = 0.9 * Math.max(wind, strike); }
  if (plan === "fish") (J.spine ?? []).forEach((s, i) => { s.rotation.y += 0.25 * wind * Math.sin(t * 9 - i); });
  if (plan === "serpent") { J.spine.slice(0, 5).forEach((s, i) => { s.rotation.x -= (i === 0 ? 0.5 : 0.1) * wind; s.rotation.y += (i % 2 ? 0.3 : -0.3) * wind; }); J.body.position.z += L * 0.4 * strike; if (J.hood) J.hood.scale.set(1.5, 1.4, 1); }
  if (plan === "cephalopod") J.tents.forEach((ch, i) => { if (i < 3) { ch[0].rotation.x -= (1.2 * wind - 0.4 * strike); } });
  if (plan === "insect") (J.mandibles ?? []).forEach((m, i) => { m.rotation.y += (i ? 1 : -1) * (0.6 * wind - 0.3 * strike); });
}
function stomp(U, J, t, st, gi) {
  const plan = U.plan, L = gi.legH || gi.designH * 0.3;
  const per = 1 / clamp(0.55 * Math.sqrt(60 / Math.max(0.05, U.size)), 0.3, 1.6), u = frac(t / per);
  const raise = u < 0.45 ? ease(u / 0.45) : u < 0.6 ? 1 - ((u - 0.45) / 0.15) ** 2 : 0;
  const dip = u >= 0.6 && u < 0.8 ? Math.sin(((u - 0.6) / 0.2) * Math.PI) : 0;
  if (plan === "quadruped" && U.legs.length) {
    J.body.rotation.x -= 0.32 * raise; J.body.position.y += 0.22 * L * raise - 0.1 * L * dip; J.body.position.z -= 0.12 * L * raise;
    st.targets = U.legs.map((l) => { const p = restTarget(l); if (l.front) { p.y += L * 0.55 * raise; p.z += L * 0.1 * raise; } return p; });
  } else if ((plan === "biped" || plan === "bird") && U.legs.length) {
    J.body.position.y -= 0.12 * L * dip;
    st.targets = U.legs.map((l, i) => { const p = restTarget(l); if (i === 0) { p.y += L * 0.5 * raise; p.z += L * 0.15 * raise; } return p; });
    if (J.arms) J.arms.forEach((a, i) => { a.rotation.z += (i ? -1 : 1) * 0.5 * raise; });
  } else { J.body.position.y += 0.15 * gi.designH * raise - 0.05 * gi.designH * dip; J.body.rotation.x -= 0.1 * raise; }
  if (J.head) J.head.rotation.x -= 0.2 * raise;
  if (J.jaw) J.jaw.rotation.x += 0.5 * raise;
}
function sleep(U, J, k, gi, st) {
  const plan = U.plan, L = gi.legH;
  if (plan === "quadruped" && U.legs.length) {
    J.body.position.y -= L * 0.62 * k;
    st.targets = U.legs.map((l) => { const p = restTarget(l); p.z += (l.front ? 0.45 : -0.1) * L * k; return p; });
    if (J.neck) J.neck.rotation.x += 0.45 * k; if (J.head) J.head.rotation.x += 0.15 * k; if (J.head) J.head.rotation.y += 0.2 * k;
    (J.tail ?? []).forEach((s) => { s.rotation.y += 0.3 * k; s.rotation.x -= 0.15 * k; });
  } else if (plan === "bird" || plan === "biped") {
    J.body.position.y -= L * (plan === "bird" ? 0.55 : 0.4) * k;
    if (J.neck) J.neck.rotation.x += 0.6 * k; if (J.head) J.head.rotation.y += 0.6 * k;
  } else if (plan === "cephalopod") J.tents.forEach((ch) => { ch[0].rotation.x += 0.3 * k; });
  else if (plan === "serpent") J.spine.forEach((s, i) => { s.rotation.y += 0.35 * k * (i ? 1 : 0); });
  else if (plan === "mollusc") { if (J.head) { J.head.position.z -= 0.8 * k; J.head.scale.y = 1 - 0.5 * k; } }
  else if (plan === "pinniped" && J.neck) J.neck.rotation.x += 0.7 * k;
}
function lurk(U, J, k, t, gi) {
  if (k <= 0) return;
  const plan = U.plan, L = gi.legH || gi.designH * 0.3;
  if (plan === "quadruped" || plan === "biped" || plan === "bird") { J.body.position.y -= L * 0.35 * k; J.body.rotation.x += 0.1 * k; }
  if (J.neck) J.neck.rotation.x += 0.35 * k; if (J.head) { J.head.rotation.x -= 0.15 * k; J.head.rotation.y += 0.25 * Math.sin(t * 0.8) * k; }
  J.body.rotation.z += 0.04 * Math.sin(t * 0.8) * k;
  (J.ears ?? []).forEach((e) => { e.rotation.x -= 0.5 * k; });
  (J.tail ?? []).forEach((s, i) => { s.rotation.x -= (i ? 0 : 0.35) * k; s.rotation.y += 0.25 * Math.sin(t * 1.5 - i) * k; });
  if (plan === "serpent") J.spine.forEach((s, i) => { s.rotation.y += 0.25 * k * Math.sin(i * 1.2); });
}
function fishSwim(U, J, t, gt, amp = 1) {
  const ph = t * gt.cadence * TAU * 1.6, cet = U.species === "whale";
  let prev = 0;
  (J.spine ?? []).forEach((s, i) => { const a = amp * 0.22 * (i + 1) / J.spine.length * Math.sin(ph - i * 0.9); if (cet) s.rotation.x += a - prev; else s.rotation.y += a - prev; prev = a; });
  if (J.tail?.[0]) { const a = amp * 0.25 * Math.sin(ph - J.spine.length * 0.9); if (cet) J.tail[0].rotation.x += a; else J.tail[0].rotation.y += a; }
  if (cet) J.body.rotation.x += -0.04 * amp * Math.sin(ph); else J.body.rotation.y += -0.05 * amp * Math.sin(ph);
  J.body.position.y += 0.02 * U._gi.designH * Math.sin(ph * 0.5);
  (J.fins ?? []).forEach((f, i) => { f.rotation.z += (i ? 1 : -1) * 0.2 * Math.sin(ph * 0.7); });
}
function slither(J, t, gt, speed = 1) {
  const ph = t * gt.cadence * TAU * 1.4 * speed, A = 0.45;
  let prev = 0;
  J.spine.forEach((s, i) => { const r = J.spine.length > 0 ? s.rotation.y : 0; void r; const a = A * Math.sin(ph - i * 0.75) * (i === 0 ? 0.5 : 1); s.rotation.y += i === 0 ? a : a - prev; prev = a; });
  if (J.head) J.head.rotation.y -= A * 0.5 * Math.sin(ph);
}
function insectCrawl(J, t, gt) {
  const ph = t * gt.cadence;
  J.insectLegs.forEach((l, i) => {
    const grp = (l.k + (l.side > 0 ? 0 : 1)) % 2, u = frac(ph + grp * 0.5);
    let sw, lift = 0;
    if (u < 0.5) sw = 1 - (u / 0.5) * 2; else { const s = (u - 0.5) / 0.5; sw = -1 + ease(s) * 2; lift = Math.sin(Math.PI * s); }
    l.lp.rotation.y = l.base - l.side * 0.32 * sw;
    l.lp.rotation.z += l.side * 0.18 * lift; l.kn.rotation.z += l.side * 0.25 * lift;
    void i;
  });
  J.body.position.y += 0.03 * Math.sin(ph * TAU * 2);
  if (J.gaster) J.gaster.rotation.x += 0.05 * Math.sin(ph * TAU * 2);
}
function snailCrawl(J, t, gt) {
  const ph = t * gt.cadence * TAU * 2;
  J.spine.forEach((s, i) => { s.scale.y = 1 + 0.1 * Math.sin(ph - i * 1.1); s.position.z += 0.12 * Math.sin(ph - i * 1.1); });
  if (J.head) { J.head.position.z += 0.18 * Math.sin(ph); J.head.rotation.x += 0.04 * Math.sin(ph); }
  if (J.shell) { J.shell.rotation.z += 0.02 * Math.sin(ph * 0.5); J.shell.position.y += 0.05 * Math.sin(ph); }
}
function octoCrawl(J, t, gt) {
  const ph = t * gt.cadence * TAU;
  J.tents.forEach((ch, k) => { const a = Math.sin(ph + k * Math.PI / 2); ch[0].rotation.x += 0.18 * a; ch[0].rotation.y += 0.15 * Math.cos(ph + k); if (ch[1]) ch[1].rotation.x += 0.15 * Math.max(0, a); });
  J.body.position.y += 0.05 * Math.sin(ph * 2);
}
function jet(J, t, gt) {
  const ph = t * gt.cadence * TAU, pulse = 0.5 + 0.5 * Math.sin(ph);
  J.tents.forEach((ch) => { ch[0].rotation.x -= 0.5 * pulse; ch.forEach((s, j) => { if (j) s.rotation.x += 0.05 * Math.sin(ph - j * 0.7); }); });
  if (J.head) J.head.scale.set(1 + 0.06 * pulse, 1 - 0.04 * pulse, 1 + 0.06 * pulse);
  J.body.position.y += 0.15 * Math.sin(ph);
}
function galumph(J, t, gt, fast, swim = false) {
  const ph = t * gt.cadence * TAU * (fast ? 1.4 : 1);
  (J.spine ?? []).forEach((s, i) => { s.rotation.x += 0.18 * Math.sin(ph - i * 1.1); });
  if (!swim) J.body.position.y += 0.15 * Math.max(0, Math.sin(ph)); else J.body.rotation.x += 0.05 * Math.sin(ph);
  J.body.rotation.x += 0.06 * Math.sin(ph + 0.5);
  if (J.neck) J.neck.rotation.x += 0.12 * Math.sin(ph + 1.2);
  (J.flippers ?? []).forEach((f, i) => { f.rotation.x += 0.45 * Math.sin(ph + (swim ? i * Math.PI : 0)); });
  if (J.tail?.[0]) J.tail[0].rotation.x += 0.25 * Math.sin(ph - 2);
}
