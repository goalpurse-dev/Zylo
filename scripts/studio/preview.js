// Zyvo Studio M2 preview / teaser: hook + proof as ONE continuous shot (timeline.js: holds joined by eased moves,
// motion blur on moves, screen direction kept). Timeline from /work/timing.json (audio.py). The giant phone plays a
// REAL AI Fruit Story output; the wall shows real outputs only (/pics/wall.json).
// Checks on every frame: TikTok safe zones for faces and key props, overlays never over a key prop (faces, Zee's
// antenna, the phone screen in its shot), and no partial body parts at the left/right edges while the camera holds.
// ?zones=1 draws the zones and the checked boxes.
import * as THREE from "three";
import { makeCreator, makeZee } from "./cast.js";
import { W, H, setup, mainStage, giantPhone, outputWall, composer, coverFit, screenBox, zoneProblems } from "./world.js";
import { makeOverlay, captionChunks, YELLOW } from "./overlay.js";
import { plan, FRAMINGS, easeInOut } from "./timeline.js";

const Q = new URLSearchParams(location.search);
const T = await (await fetch("/work/timing.json")).json();
const WALL = await (await fetch("/pics/wall.json")).json();
const { renderer, scene, manager, tl } = setup();
const loaded = new Promise((r) => (manager.onLoad = r));
const out = document.getElementById("out"), ctx = out.getContext("2d");
const ov = makeOverlay(ctx);

mainStage(scene);
const phone = giantPhone(scene);
const PHONE_Y = phone.group.position.y;
const tiles = outputWall(scene, tl, WALL.map((w) => w.file));
const creator = makeCreator(), zee = makeZee();
scene.add(creator.group, zee.group);
creator.group.position.set(-1.05, 0, 0.6); zee.group.position.set(1.3, 0, 0.3);   // apart enough that neither pokes into the other's shot

// the real output on the phone: drawn to a canvas after each exact seek (frame-accurate, headless-safe)
const video = document.createElement("video");
video.src = "/pics/video/the-surprise-wedding-switch.mp4"; video.muted = true; video.playsInline = true; video.preload = "auto";
await new Promise((r) => video.addEventListener("loadeddata", r, { once: true }));
const vc = document.createElement("canvas"), vx = vc.getContext("2d");
vc.width = video.videoWidth; vc.height = video.videoHeight;
const vtex = new THREE.CanvasTexture(vc); vtex.colorSpace = THREE.SRGBColorSpace;
coverFit(vtex, phone.w / phone.h, vc.width, vc.height);
const seek = (s) => new Promise((r) => { if (Math.abs(video.currentTime - s) < 0.004) return r(); video.addEventListener("seeked", r, { once: true }); video.currentTime = s; });

/* ─── the plan ─── */
const L = T.lines, EV = Object.fromEntries(T.events.map((e) => [e.event, e.t])), END = T.total;
const PLAN = plan(T);
const lineAt = (t) => L.findIndex((l) => t >= l.start - 0.05 && t <= l.end + 0.05);
const LISTEN = { 0: { zee: "neutral" }, 1: { creator: "thinking" }, 2: { zee: "happy" }, 3: { creator: "shocked" }, 4: { creator: "happy" }, 5: { zee: "happy" }, 6: { creator: "happy" } };
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const V = (a) => new THREE.Vector3(...a);
// where the characters face, per framing (radians about y): towards the camera, up at the phone, at the wall
const FACE = { camera: { creator: 0.3, zee: -0.35 }, phone: { creator: Math.PI - 0.25, zee: Math.PI + 0.3 }, wall: { creator: Math.PI - 0.15, zee: Math.PI + 0.2 } };

/** Camera and facing at time t: holds drift and creep in slowly; moves ease between framings. */
function cameraAt(t) {
  const s = PLAN.find((p) => t >= p.t0 && t < p.t1) ?? PLAN.at(-1);
  if (s.type === "hold") {
    const F = FRAMINGS[s.at], k = Math.min(1, (t - s.t0) / Math.max(1, s.t1 - s.t0));
    const pos = V(F.pos), look = V(F.look), dir = look.clone().sub(pos).normalize();
    pos.addScaledVector(dir, k * (F.creep ?? 0.25));            // a slow creep in: never fully still
    return { pos, look, facing: { from: F.facing, to: F.facing, f: 1 }, moving: false, step: s };
  }
  const A = FRAMINGS[s.from], B = FRAMINGS[s.to], f = easeInOut((t - s.t0) / (s.t1 - s.t0));
  const pos = V(A.pos).lerp(V(B.pos), f), look = V(A.look).lerp(V(B.look), f);
  if (s.kind === "crane" || s.kind === "push") pos.y += Math.sin(f * Math.PI) * 0.35;   // an arc, not a straight line
  // the cast turns a little after the camera starts, and lands just before it arrives
  return { pos, look, facing: { from: A.facing, to: B.facing, f: ease((t - s.t0 - 0.05) / (s.t1 - s.t0 - 0.1)) }, moving: true, step: s };
}

const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 400);
const comp = composer(renderer, scene, camera);
const chunks = captionChunks(L);
const BLINKS = { creator: [1.3, 4.7, 8.1, 10.6, 13.1], zee: [2.2, 5.6, 9.0, 12.2] };
const blinkK = (who, t) => Math.max(0, ...BLINKS[who].map((b) => 1 - Math.abs(t - b) / 0.07));

function act(who, c, t) {
  const n = lineAt(t), speaking = n >= 0 && L[n].who === who;
  if (speaking) c.expr(L[n].expr);
  else if (n >= 0 && LISTEN[n]?.[who]) c.expr(LISTEN[n][who]);
  c.mouth(speaking ? L[n].env[Math.floor((t - L[n].start) * T.fps)] ?? 0 : 0);
  c.blink(blinkK(who, t));
  let pose = "rest", k = 0;
  for (const l of L) if (l.who === who) {
    const a = ease((t - l.start + 0.1) / 0.25) * (1 - ease((t - l.end - 0.25) / 0.3));
    if (a > k) { k = a; pose = l.pose ?? "rest"; }
  }
  c.poseMix("rest", pose, k);
  c.idle(t, who === "zee" ? 0.7 : 0);
}

/** Put the whole scene at time ts (the camera, the cast, the phone, the wall). */
function setState(ts) {
  const cam = cameraAt(ts);
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  for (const [who, c] of [["creator", creator], ["zee", zee]]) c.group.rotation.y = FACE[cam.facing.from][who] + (FACE[cam.facing.to][who] - FACE[cam.facing.from][who]) * cam.facing.f;
  act("creator", creator, ts); act("zee", zee, ts);
  const n = lineAt(ts);
  creator.parts.head.rotation.y = n >= 0 && L[n].who === "zee" && cam.facing.to === "camera" ? 0.28 : 0;
  const shrink = ease((ts - EV.wall) / 0.45);
  phone.group.scale.setScalar(Math.max(0.0001, 1 - shrink)); phone.group.position.y = PHONE_Y - shrink * 1.2;
  for (const tile of tiles) { const a = (ts - EV.wall - 0.1 - tile.userData.dist * 0.08) / 0.32; tile.scale.setScalar(a <= 0 ? 0.0001 : a >= 1 ? 1 : 1 + 2.70158 * (a - 1) ** 3 + 1.70158 * (a - 1) ** 2); }
  return cam;
}

const log = {};
const note = (k, t, where) => { log[k] ??= { first: +t.toFixed(2), last: 0, frames: 0, where }; log[k].last = +t.toFixed(2); log[k].frames++; };
window.zoneReport = () => log;
window.plan = PLAN;

const SUB = Number(Q.get("blur") ?? 7);   // motion-blur subframes on moves (180° shutter at 30 fps)
window.renderAt = async (t) => {
  // the phone's video frame (once per output frame)
  if (t >= EV.phoneOn) {
    await seek(Math.min(video.duration - 0.05, t - EV.phoneOn + 0.4));
    vx.drawImage(video, 0, 0, vc.width, vc.height); vtex.needsUpdate = true;
    if (phone.mat.map !== vtex) { phone.mat.map = vtex; phone.mat.color.setScalar(0.9); phone.mat.needsUpdate = true; }
  }
  // the 3D frame: one render on a hold, several averaged on a move (motion blur)
  let cam = cameraAt(t);
  const n = cam.moving ? SUB : 1;
  for (let i = 0; i < n; i++) {
    const ts = n === 1 ? t : t + (i / (n - 1) - 0.5) * (0.5 / 30);
    cam = setState(ts); comp.render();
    ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(renderer.domElement, 0, 0);
  }
  ctx.globalAlpha = 1;
  cam = setState(t);   // the checks use the frame's own time
  const where = cam.moving ? `${cam.step.kind} ${cam.step.from}->${cam.step.to}` : `hold on ${cam.step.at}`;

  // overlays (each returns its box)
  const boxes = [];
  const moveTo = (to) => PLAN.find((p) => p.type === "move" && p.to === to && p.t0 > (EV.counter ?? 0));
  const chip = t < L[1].start ? [["2:47 ", "#ffffff"], ["AM", YELLOW]] : t < EV.wall ? [["ZYVO MADE ", "#ffffff"], ["THIS", YELLOW]] : [["MADE WITH ", "#ffffff"], ["ZYVO", YELLOW]];
  const chipT0 = t < L[1].start ? 0.05 : t < EV.wall ? L[1].start : EV.wall;
  boxes.push(["chip", ov.chip(chip, t - chipT0)]);
  const firstMove = PLAN.find((q) => q.type === "move")?.t0 ?? END;
  if (t >= EV.pill && t < Math.min(L[1].start + 0.3, firstMove)) boxes.push(["hook pill", ov.statPill([["MY LAST SHORT · ", "#ffffff"], ["6 HOURS", YELLOW]], t - EV.pill)]);
  const counterOff = moveTo("creator")?.t0 ?? END;
  if (t >= EV.counter && t < counterOff) boxes.push(["counter", ov.counter(9, "SHORT-FORM TEMPLATES", t - EV.counter, Math.max(0.5, EV.counterEnd - EV.counter))]);
  if (T.end_chip && L.at(-1) && t >= L.at(-1).start + 0.4) boxes.push(["end chip", ov.endChip(T.end_chip, t - L.at(-1).start - 0.4)]);
  const chunk = chunks.find((c) => t >= c.s && t < c.e);
  const capY = !cam.moving && cam.step.at === "phone" ? 1452 : 1300;
  if (chunk) { ctx.save(); ctx.translate(0, capY - 1300); ov.caption(chunk, t); ctx.restore(); }

  // checks: safe zones (faces, key props), overlays over key props, partial body parts at the edges (holds only)
  const faces = (obj) => { const q = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion())); return q.dot(camera.position.clone().sub(obj.getWorldPosition(new THREE.Vector3()))) > 0; };
  const keys = [];
  for (const [name, c] of [["creator", creator], ["Zee", zee]]) if (faces(c.parts.head)) keys.push([`${name} face`, c.parts.head]);
  if (faces(zee.parts.head)) keys.push(["Zee antenna", zee.parts.antenna]);
  if (!cam.moving && cam.step.at === "phone") keys.push(["phone screen", phone.screen]);
  for (const [name, obj] of keys) {
    const b = screenBox(obj, camera); if (!b) continue;
    if (!cam.moving) for (const p of zoneProblems(b)) note(`${name}: ${p}`, t, where);
    for (const [oname, ob] of boxes) if (ob && b.x0 < ob.x1 && b.x1 > ob.x0 && b.y0 < ob.y1 && b.y1 > ob.y0) note(`${oname} over ${name}`, t, where);
    if (Q.get("zones")) ov.box(b, false);
  }
  if (!cam.moving) {
    const parts = [];
    for (const [name, c] of [["creator", creator], ["Zee", zee]]) { parts.push([`${name} (whole)`, c.parts.body]); /* the body only: Zee's floor glow is not a body part */ c.parts.arms.forEach((a, i) => parts.push([`${name} ${i ? "right" : "left"} arm`, a.pivot])); }
    for (const [name, obj] of parts) {
      const b = screenBox(obj, camera); if (!b) continue;
      const w = b.x1 - b.x0, inside = (Math.min(b.x1, W) - Math.max(b.x0, 0)) / (w || 1);
      if (inside > 0.02 && inside < 0.97 && (b.x0 < 0 || b.x1 > W) && b.y1 > 0 && b.y0 < H) note(`${name} cut at the ${b.x0 < 0 ? "left" : "right"} edge`, t, where);
    }
  }
  if (Q.get("zones")) ov.zones();
  return true;
};
loaded.then(() => { window.ready = true; });
