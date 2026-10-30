// Zyvo Studio: a per-template "how I made this with Zyvo" video (owner, 2026-10-30), e.g. M3 = AI Fruit Story.
// hook (question + the real video with its sound) -> answer -> 5 real steps (sharp cards cut from the live run, the
// real time since the first click on each) -> twist (this template's own wall + a fact-sheet number) -> objection
// (the measured time) -> payoff (the full real result with its sound) -> CTA. One continuous camera (timeline.js).
// Inputs from /work: timing.json (audio.py), wall.json (this template's outputs only), cards/cards.json (cards.py),
// phone/ (the result's frames). Checks every frame: safe zones, overlays over faces/props, edges. ?zones=1 draws them.
import * as THREE from "three";
import { makeCreator, makeZee, ZYVO } from "./cast.js";
import { W, H, setup, mainStage, giantPhone, outputWall, composer, coverFit, screenBox, zoneProblems, rbox, add } from "./world.js";
import { makeOverlay, captionChunks, YELLOW } from "./overlay.js";
import { planFor, framingsFor, easeInOut, roles } from "./timeline.js";
import { zShape } from "./cast.js";

const Q = new URLSearchParams(location.search);
const T = await (await fetch("/work/timing.json")).json();
const WALL = await (await fetch("/work/wall.json")).json();
const CARDS = await (await fetch("/work/cards/cards.json")).json();
const CFG = await (await fetch("/work/episode.json")).json();   // counter, chips, CTA (from the template config)
// the payoff, full screen: its frames upscaled 2x locally (Real-ESRGAN, $0) from the original file, lossless PNG
const HQ = await (await fetch("/work/payoff_hq.json")).json().catch(() => null);
const { renderer, scene, manager, tl } = setup();
const loaded = new Promise((r) => (manager.onLoad = r));
const out = document.getElementById("out"), ctx = out.getContext("2d");
ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
const ov = makeOverlay(ctx);

mainStage(scene);
const phone = giantPhone(scene, { y: 5.15 });
const PHONE_Y = phone.group.position.y;
const tiles = outputWall(scene, tl, WALL);
const creator = makeCreator(), zee = makeZee();
scene.add(creator.group, zee.group);
creator.group.position.set(-1.05, 0, 0.6); zee.group.position.set(1.3, 0, 0.3);

// C's desk with the Z laptop, in front of the creator (towards the phone); it rises for the steps
const desk = new THREE.Group(); desk.position.set(-1.05, 0, -0.25); scene.add(desk);
{
  const wood = new THREE.MeshStandardMaterial({ color: new THREE.Color("#d9c6a8"), roughness: 0.85 });
  add(desk, rbox(1.5, 0.09, 0.7, 0.04), wood, 0, 1.0, 0); for (const [x, z] of [[-0.65, -0.28], [0.65, -0.28], [-0.65, 0.28], [0.65, 0.28]]) add(desk, rbox(0.08, 1.0, 0.08, 0.03), wood, x, 0.5, z);
  const alu = new THREE.MeshStandardMaterial({ color: new THREE.Color("#c3c6cd"), roughness: 0.45, metalness: 0.5 });
  const lap = new THREE.Group(); lap.position.set(0, 1.05, 0); lap.rotation.y = Math.PI; desk.add(lap);   // the screen faces the creator
  add(lap, rbox(0.92, 0.035, 0.6, 0.015), alu, 0, 0.018, -0.05);
  const lid = new THREE.Group(); lid.position.set(0, 0.035, 0.25); lid.rotation.x = 0.28; lap.add(lid);
  add(lid, rbox(0.92, 0.6, 0.03, 0.02), alu, 0, 0.3, 0);
  const zl = new THREE.Mesh(new THREE.ExtrudeGeometry(zShape(0.22), { depth: 0.01, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: new THREE.Color(ZYVO.violet2).multiplyScalar(1.4), toneMapped: false })); zl.geometry.center(); zl.position.set(0, 0.3, 0.02); lid.add(zl);
  desk.userData.screen = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.54), new THREE.MeshBasicMaterial({ color: new THREE.Color("#111"), toneMapped: false }));
  desk.userData.screen.position.set(0, 0.3, -0.017); desk.userData.screen.rotation.y = Math.PI; lid.add(desk.userData.screen);
}

// the result on the phone: exact decoded frames (/work/phone/), its sound is in the mix
const vc = document.createElement("canvas"), vx = vc.getContext("2d"); vc.width = 720; vc.height = 1280;
const vtex = new THREE.CanvasTexture(vc); vtex.colorSpace = THREE.SRGBColorSpace; coverFit(vtex, phone.w / phone.h, vc.width, vc.height);
vtex.generateMipmaps = false; vtex.minFilter = THREE.LinearFilter; vtex.anisotropy = 16;   // no mipmap blur on the real video
phone.mat.map = vtex; phone.mat.color.setScalar(0.9); phone.mat.needsUpdate = true;
let shown = 0;
let hqShown = 0, hqBmp = null;
async function payoffFrame(vt) {
  const f = Math.min(HQ.count, Math.max(1, Math.round((vt - HQ.start) * HQ.fps) + 1));
  if (f !== hqShown) { hqBmp?.close?.(); hqBmp = await createImageBitmap(await (await fetch(`/work/payoff_hq/f${String(f).padStart(5, "0")}.png`)).blob()); hqShown = f; }
  return hqBmp;
}
/** How full-screen the payoff is at t: 0 = on the phone, 1 = full screen (it grows as the camera lands). */
const fullK = (t) => (!CL.payoff?.fullscreen && !CFG.payoffFullscreen) ? 0 : Math.min(1, Math.max(0, (t - (CL.payoff.start - 0.4)) / 0.4)) * (1 - Math.min(1, Math.max(0, (t - CL.payoff.end) / 0.35)));
const CL = Object.fromEntries((T.clips ?? []).map((c) => [c.name, c]));
const DUR = (T.phone.count - 1) / T.phone.fps;
/** Which moment of the result the phone shows at time t: the hook moment, muted run-on, then the payoff from 0. */
function videoTime(t) {
  // the payoff's own lead-in, muted, as the camera arrives: the same moment the full-screen layer grows from (no ghosting)
  if (t >= CL.payoff.start - 1.0) return Math.min(DUR, CL.payoff.in + (t - CL.payoff.start));
  return ((CL.hook.in + (t - CL.hook.start)) % DUR + DUR) % DUR;
}
async function phoneFrame(t) {
  const f = Math.min(T.phone.count, Math.max(1, Math.round(videoTime(t) * T.phone.fps) + 1));
  if (f === shown) return;
  const bmp = await createImageBitmap(await (await fetch(`/work/phone/f${String(f).padStart(5, "0")}.png`)).blob());
  vx.drawImage(bmp, 0, 0, vc.width, vc.height); bmp.close(); vtex.needsUpdate = true; shown = f;
}

// the step cards (real screens): images, and a canvas for the laptop screen
const cardImg = {};
await Promise.all(Object.values(CARDS).flatMap((c) => c.frames).map((f) => new Promise((r) => { const im = new Image(); im.onload = r; im.onerror = r; im.src = `/work/cards/${f.file}`; cardImg[f.file] = im; })));
const lc = document.createElement("canvas"); lc.width = 860; lc.height = 540; const lx = lc.getContext("2d");
const ltex = new THREE.CanvasTexture(lc); ltex.colorSpace = THREE.SRGBColorSpace; desk.userData.screen.material.map = ltex; desk.userData.screen.material.color.setScalar(0.9);

/* ─── the plan ─── */
const L = T.lines, EV = Object.fromEntries(T.events.map((e) => [e.event, e.t])), END = T.total;
const R = roles(L);   // lines by role (hook, answer, beat, tease, step1..5, twist, objection, time, site, cta)
const PLAN = planFor(T), FR = framingsFor(T);
const STEP_T = [1, 2, 3, 4, 5].map((n) => EV[`step${n}`]);
const stepAt = (t) => { let n = 0; STEP_T.forEach((s, i) => { if (t >= s - 0.05) n = i + 1; }); return t < (EV.wall ?? Infinity) - 0.3 ? n : 0; };
const lineAt = (t) => L.findIndex((l) => t >= l.start - 0.05 && t <= l.end + 0.05);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const V = (a) => new THREE.Vector3(...a);
const FACE = { camera: { creator: 0.15, zee: -0.35 }, phone: { creator: Math.PI - 0.25, zee: Math.PI + 0.3 }, wall: { creator: Math.PI - 0.15, zee: Math.PI + 0.2 } };

function cameraAt(t) {
  const s = PLAN.find((p) => t >= p.t0 && t < p.t1) ?? PLAN.at(-1);
  if (s.type === "hold") {
    const F = FR[s.at], k = Math.min(1, (t - s.t0) / Math.max(1, s.t1 - s.t0));
    const pos = V(F.pos), look = V(F.look); pos.addScaledVector(look.clone().sub(pos).normalize(), k * (F.creep ?? 0.25));
    return { pos, look, facing: { from: F.facing, to: F.facing, f: 1 }, moving: false, step: s };
  }
  const A = FR[s.from], B = FR[s.to], f = easeInOut((t - s.t0) / (s.t1 - s.t0));
  const pos = V(A.pos).lerp(V(B.pos), f), look = V(A.look).lerp(V(B.look), f);
  if (s.kind === "crane" || s.kind === "push") pos.y += Math.sin(f * Math.PI) * 0.3;
  return { pos, look, facing: { from: A.facing, to: B.facing, f: ease((t - s.t0 - 0.05) / (s.t1 - s.t0 - 0.1)) }, moving: true, step: s };
}

const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 400);
const comp = composer(renderer, scene, camera);
const chunks = captionChunks(L);
const blinkK = (who, t) => { const p = who === "zee" ? 3.1 : 2.7, o = who === "zee" ? 1.3 : 0.4; const x = ((t - o) % p + p) % p; return Math.max(0, 1 - Math.abs(x - p / 2) / 0.07); };

function act(who, c, t) {
  const n = lineAt(t), speaking = n >= 0 && L[n].who === who;
  if (speaking) c.expr(L[n].expr);
  else if (n >= 0) {   // listening, by what is being said
    const role = L[n].role ?? "";
    c.expr(who === "creator" ? (/^(tease|step|twist)/.test(role) ? "happy" : role === "time" ? "shocked" : "thinking") : (role === "objection" ? "smug" : "happy"));
  }
  c.mouth(speaking ? L[n].env[Math.floor((t - L[n].start) * T.fps)] ?? 0 : 0);
  c.blink(blinkK(who, t));
  let pose = who === "creator" && stepAt(t) ? "type" : "rest", k = who === "creator" && stepAt(t) ? 0.75 : 0;
  for (const l of L) if (l.who === who) { const a = ease((t - l.start + 0.1) / 0.25) * (1 - ease((t - l.end - 0.25) / 0.3)); if (a > k) { k = a; pose = l.pose ?? "rest"; } }
  c.poseMix("rest", pose, k);
  c.idle(t, who === "zee" ? 0.7 : 0);
}

function setState(ts) {
  const cam = cameraAt(ts);
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  for (const [who, c] of [["creator", creator], ["zee", zee]]) c.group.rotation.y = FACE[cam.facing.from][who] + (FACE[cam.facing.to][who] - FACE[cam.facing.from][who]) * cam.facing.f;
  act("creator", creator, ts); act("zee", zee, ts);
  // the phone: away during the steps and the twist (the cards and the wall lead), back for the payoff
  const away = ease((ts - (STEP_T[0] - 0.6)) / 0.45) * (1 - ease((ts - (CL.payoff.start - 1.4)) / 0.45));
  phone.group.scale.setScalar(Math.max(0.0001, 1 - away)); phone.group.position.y = PHONE_Y - away * 1.2;
  // the desk rises for the steps
  const d = ease((ts - (STEP_T[0] - 0.7)) / 0.4) * (1 - ease((ts - (EV.wall - 0.4)) / 0.4));
  desk.scale.setScalar(Math.max(0.0001, d)); desk.visible = d > 0.001;
  for (const tile of tiles) { const a = (ts - EV.wall - 0.1 - tile.userData.dist * 0.08) / 0.32; tile.scale.setScalar(a <= 0 ? 0.0001 : a >= 1 ? 1 : 1 + 2.70158 * (a - 1) ** 3 + 1.70158 * (a - 1) ** 2); tile.userData.update(ts); }
  return cam;
}

/** The card frame for a step at time t (steps 3–4 flip through the real progress screens over the line). */
function cardFrame(n, t) {
  const c = CARDS[`step${n}`]; if (!c) return null;
  const line = R[`step${n}`], span = Math.max(0.6, line.end - line.start + 0.3), k = Math.min(0.999, Math.max(0, (t - STEP_T[n - 1]) / span));
  const i = Math.floor(k * c.frames.length), dur = span / c.frames.length;
  // a frame's tap lands 0.35 s before the next screen (the click, then what it did); a lone frame taps at 0.45 s
  return { c, f: c.frames[i], tap: c.frames[i].tap, tapAt: c.frames.length > 1 ? (i + 1) * dur - 0.35 : 0.45 };
}

const log = {};
const note = (k, t, where) => { log[k] ??= { first: +t.toFixed(2), last: 0, frames: 0, where }; log[k].last = +t.toFixed(2); log[k].frames++; };
const obs = {};   // for the scorecard
window.zoneReport = () => ({ ...log, _observations: obs });
window.plan = PLAN;
const SUB = Number(Q.get("blur") ?? 7);
let lastLap = "";

window.renderAt = async (t) => {
  await phoneFrame(t);
  const n = stepAt(t), cf = n ? cardFrame(n, t) : null;
  if (cf && cf.f.file !== lastLap) { const im = cardImg[cf.f.file]; lx.fillStyle = "#0b0c0e"; lx.fillRect(0, 0, 860, 540); const h = 540, w = h * cf.c.aspect; lx.drawImage(im, (860 - w) / 2, 0, w, h); ltex.needsUpdate = true; lastLap = cf.f.file; }
  let cam = cameraAt(t);
  const nsub = cam.moving ? SUB : 1;
  for (let i = 0; i < nsub; i++) { const ts = nsub === 1 ? t : t + (i / (nsub - 1) - 0.5) * (0.5 / 30); cam = setState(ts); comp.render(); ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(renderer.domElement, 0, 0, W, H); }
  ctx.globalAlpha = 1; cam = setState(t);
  const where = cam.moving ? `${cam.step.kind} ${cam.step.from}->${cam.step.to}` : `hold on ${cam.step.at}`;

  // overlays
  // the payoff: the real result grows out of the phone to full screen (sharp: drawn in 2D from the upscaled frames)
  const fk = HQ ? fullK(t) : 0;
  if (fk > 0) {
    const bmp = await payoffFrame(CL.payoff.in + Math.max(0, Math.min(t, CL.payoff.end - 0.01) - CL.payoff.start));
    const sc = 1.06, fw = W * sc, fh = fw * 16 / 9, full = { x0: (W - fw) / 2, y0: -120, x1: (W + fw) / 2, y1: -120 + fh };   // its own captions land at y ~1467, inside the zone
    const from = screenBox(phone.screen, camera) ?? { x0: W * 0.3, y0: H * 0.3, x1: W * 0.7, y1: H * 0.7 };
    const e = fk * fk * (3 - 2 * fk), r = { x0: from.x0 + (full.x0 - from.x0) * e, y0: from.y0 + (full.y0 - from.y0) * e, x1: from.x1 + (full.x1 - from.x1) * e, y1: from.y1 + (full.y1 - from.y1) * e };
    ctx.save(); ctx.globalAlpha = Math.min(1, fk * 3); ctx.beginPath(); ctx.roundRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 28 * (1 - e)); ctx.clip();
    ctx.drawImage(bmp, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); ctx.restore();
    if (fk > 0.99) obs.fullscreenPayoff = obs.fullscreenPayoff ?? +t.toFixed(2);
  }
  const boxes = [], inPayoff = t >= CL.payoff.start - 1.0 && t < CL.payoff.end + 0.2;
  if (n) {
    const s = CFG.steps[n - 1];
    boxes.push(["step chip", ov.stepChip(n, 5, [[`STEP ${n} · `, "#ffffff"], [s.chip.join(""), YELLOW]], t - STEP_T[n - 1])]);
    const secs = n === 5 ? CFG.timer.seconds : cf.f.t;   // step 5: the measured "ready" time, as the clock says
    const badge = `⏱ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    // sized so the caption line (1254–1346) always stays free: muted viewers read the steps
    const navCard = cf.c.nav;   // the real menu path: no time badge (it is before the first click of the run)
    boxes.push(["step card", ov.card(cardImg[cf.f.file], cf.c.aspect, t - STEP_T[n - 1], { width: n <= 2 ? 600 : 560, badge: navCard ? null : badge, tap: cf.tap, tapAt: cf.tapAt })]);
  } else if (!inPayoff) {
    const chip = t < R.answer.start ? [["HOW DO YOU MAKE ", "#ffffff"], ["THIS?", YELLOW]] : t < (EV.lazy ?? Infinity) ? [["IT'S ", "#ffffff"], ["SIMPLE", YELLOW]] : t < STEP_T[0] ? [["MOST PEOPLE ARE ", "#ffffff"], ["TOO LAZY", YELLOW]]
      : t < R.objection.start ? [["MADE WITH ", "#ffffff"], ["ZYVO", YELLOW]] : t < CL.payoff.start ? [["FIRST CLICK → ", "#ffffff"], ["FINAL VIDEO", YELLOW]]
      : t < EV.cta ? [["MADE WITH ", "#ffffff"], ["ZYVO", YELLOW]] : [["tryzyvo.com", "#ffffff"]];   // at the CTA: the website stays, small
    const chipT0 = t < R.answer.start ? 0.05 : t < (EV.lazy ?? Infinity) ? R.answer.start : t < STEP_T[0] ? EV.lazy : t < R.objection.start ? EV.wall : t < CL.payoff.start ? R.objection.start : t < EV.cta ? CL.payoff.end : EV.cta;
    boxes.push(["chip", ov.chip(chip, t - chipT0)]);
  }
  const counterOff = PLAN.find((p) => p.type === "move" && p.from === "wall")?.t0 ?? END;
  if (t >= EV.counter && t < counterOff) boxes.push(["counter", ov.counter(CFG.counter.value, CFG.counter.label, t - EV.counter, Math.max(0.5, EV.counterEnd - EV.counter))]);
  // the clock waits for the camera to land on Zee (it sits above Zee, not over the creator)
  const zeeLowAt = PLAN.find((p) => p.type === "move" && p.to === "zeeLow")?.t1 ?? EV.timer, timerT0 = Math.max(EV.timer, zeeLowAt);
  if (t >= timerT0 && t < CL.payoff.start - 1.0) boxes.push(["timer", ov.timer(CFG.timer.seconds, CFG.timer.label, t - timerT0, Math.max(0.5, EV.timerEnd - timerT0))]);
  // the website, said and shown big (owner, 2026-10-30), then the comment CTA
  // on "link in bio" the chip grows to say so (something new every 2.5 s)
  if (EV.site != null && t >= EV.site && t < EV.cta) boxes.push(["website chip", EV.bio != null && t >= EV.bio ? ov.endChip("tryzyvo.com · link in bio", t - EV.bio) : ov.endChip("tryzyvo.com", t - EV.site)]);
  if (t >= EV.cta + 0.3) boxes.push(["CTA chip", ov.endChip(CFG.cta.chip, t - EV.cta - 0.3)]);
  // the website tease, once, during the steps (owner, 2026-10-30): the address itself only comes at the end
  if (EV.teaseChip != null && t >= EV.teaseChip && t < EV.teaseChip + 2.2) boxes.push(["tease chip", ov.endChip("WEBSITE AT THE END 👀", t - EV.teaseChip)]);
  const chunk = chunks.find((c) => t >= c.s && t < c.e);
  const ps = phone.group.scale.x > 0.5 ? screenBox(phone.screen, camera) : null;
  const card = boxes.find(([k]) => k === "step card")?.[1];
  const blocked = (ps && ps.y0 < 1370 && ps.y1 > 1230) || (card && card.y1 > 1240);
  if (chunk && !blocked) ov.caption(chunk, t);

  // checks
  const faces = (obj) => { const q = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion())); return q.dot(camera.position.clone().sub(obj.getWorldPosition(new THREE.Vector3()))) > 0; };
  const keys = [];
  for (const [name, c] of [["creator", creator], ["Zee", zee]]) if (faces(c.parts.head)) keys.push([`${name} face`, c.parts.head]);
  if (faces(zee.parts.head)) keys.push(["Zee antenna", zee.parts.antenna]);
  // the phone is a key prop in its shots; a full-screen payoff is the video itself (TikTok's own UI sits on any video)
  if (!cam.moving && (cam.step.at === "phone" || (cam.step.at === "phoneFull" && fk < 0.01))) keys.push(["phone screen", phone.screen]);
  for (const [name, obj] of keys) {
    const b = screenBox(obj, camera); if (!b) continue;
    if (!cam.moving) for (const p of zoneProblems(b)) note(`${name}: ${p}`, t, where);
    for (const [oname, ob] of boxes) if (ob && b.x0 < ob.x1 && b.x1 > ob.x0 && b.y0 < ob.y1 && b.y1 > ob.y0) note(`${oname} over ${name}`, t, where);
    if (Q.get("zones")) ov.box(b, false);
  }
  if (!cam.moving) {
    for (const [name, c] of [["creator", creator], ["Zee", zee]]) for (const [pn, obj] of [[`${name} (whole)`, c.parts.body], ...c.parts.arms.map((a, i) => [`${name} ${i ? "right" : "left"} arm`, a.pivot])]) {
      const b = screenBox(obj, camera); if (!b) continue;
      const w = b.x1 - b.x0, inside = (Math.min(b.x1, W) - Math.max(b.x0, 0)) / (w || 1);
      // a part also cut by the bottom edge is a framing crop (a body below the frame), not a poke-in at the side
      if (inside > 0.02 && inside < 0.97 && (b.x0 < 0 || b.x1 > W) && b.y1 > 0 && b.y0 < H && b.y1 <= H) note(`${pn} cut at the ${b.x0 < 0 ? "left" : "right"} edge`, t, where);
    }
  }
  // scorecard: when a real output is first visible (more than a fifth of the phone screen on screen)
  if (obs.realOutputFirst == null && ps) { const vis = (Math.min(ps.x1, W) - Math.max(ps.x0, 0)) * (Math.min(ps.y1, H) - Math.max(ps.y0, 0)) / ((ps.x1 - ps.x0) * (ps.y1 - ps.y0)); if (vis > 0.2) obs.realOutputFirst = +t.toFixed(2); }
  if (Q.get("zones")) ov.zones();
  return true;
};
loaded.then(() => { window.ready = true; });
