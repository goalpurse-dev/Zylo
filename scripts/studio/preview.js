// Zyvo Studio M2: the 10 s preview (hook + proof). Timeline from /work/timing.json (audio.py: lines, word times,
// mouth envelopes, events). The giant phone plays a REAL AI Fruit Story output; the wall shows real outputs only
// (/pics/wall.json, picked by eye from the active asset library). ?zones=1 draws the TikTok zones and the checked boxes.
import * as THREE from "three";
import { makeCreator, makeZee } from "./cast.js";
import { W, H, setup, mainStage, giantPhone, outputWall, composer, coverFit, screenBox, zoneProblems } from "./world.js";
import { makeOverlay, captionChunks, YELLOW } from "./overlay.js";

const Q = new URLSearchParams(location.search);
const T = await (await fetch("/work/timing.json")).json();
const WALL = await (await fetch("/pics/wall.json")).json();
const { renderer, scene, manager, tl } = setup();
const loaded = new Promise((r) => (manager.onLoad = r));   // every texture (HDRI, wall tiles) in
const out = document.getElementById("out"), ctx = out.getContext("2d");
const ov = makeOverlay(ctx);

mainStage(scene);
const phone = giantPhone(scene);
const tiles = outputWall(scene, tl, WALL.map((w) => w.file));
const creator = makeCreator(), zee = makeZee();
scene.add(creator.group, zee.group);
const CR = new THREE.Vector3(-1.0, 0, 0.6), ZE = new THREE.Vector3(1.05, 0, 0.3);
creator.group.position.copy(CR); zee.group.position.copy(ZE);

// the real output on the phone: a video drawn to a canvas after each exact seek (frame-accurate, headless-safe)
const video = document.createElement("video");
video.src = "/pics/video/the-surprise-wedding-switch.mp4"; video.muted = true; video.playsInline = true; video.preload = "auto";
const vc = document.createElement("canvas"), vx = vc.getContext("2d");
const vtex = new THREE.CanvasTexture(vc); vtex.colorSpace = THREE.SRGBColorSpace;
const videoReady = new Promise((r) => video.addEventListener("loadeddata", r, { once: true }));
await videoReady;
vc.width = video.videoWidth; vc.height = video.videoHeight;
coverFit(vtex, phone.w / phone.h, vc.width, vc.height);
const seek = (s) => new Promise((r) => { if (Math.abs(video.currentTime - s) < 0.004) return r(); video.addEventListener("seeked", r, { once: true }); video.currentTime = s; });

/* ─── the timeline ─── */
const L = T.lines, EV = Object.fromEntries(T.events.map((e) => [e.event, e.t])), END = T.total;
const lineAt = (t) => L.findIndex((l) => t >= l.start - 0.05 && t <= l.end + 0.05);
const LISTEN = { 0: { zee: "neutral" }, 1: { creator: "thinking" }, 2: { zee: "happy" }, 3: { creator: "shocked" }, 4: { creator: "happy" }, 5: { zee: "happy" } };
const lerp = (a, b, f) => a + (b - a) * f, ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// shots: camera from → to (position, look), characters facing (+1 front, -1 towards the wall), what's hidden
const SHOTS = [
  // close-ups at ~7 m: the head with its beanie is ~1.3 m tall, so the face stays inside the safe zone
  { t0: 0, name: "creator close-up", from: [V(-0.95, 1.95, 7.6), V(-0.97, 1.85, 0.6)], to: [V(-0.93, 1.95, 7.0), V(-0.97, 1.85, 0.6)], key: [] },
  { t0: L[1].start - 0.05, name: "Zee medium", from: [V(0.9, 1.6, 8.0), V(1.03, 1.45, 0.3)], to: [V(0.95, 1.6, 7.5), V(1.03, 1.45, 0.3)], key: [] },
  { t0: EV.phoneOn + 0.3, name: "push into the phone", from: [V(0.1, 3.3, 14.4), V(0.1, 3.3, -3.6)], to: [V(0.1, 3.3, 13.2), V(0.1, 3.3, -3.6)], hide: ["cast"], captionY: 1440, key: ["phone"] },
  { t0: L[2].start - 0.05, name: "creator close-up (shocked)", from: [V(-1.2, 1.85, 7.2), V(-0.97, 1.85, 0.6)], to: [V(-1.15, 1.85, 6.7), V(-0.97, 1.85, 0.6)], key: [] },
  { t0: L[3].start - 0.05, name: "wide to the wall (back view)", from: [V(0, 2.8, 12.2), V(0, 4.6, -11)], to: [V(0, 3.1, 14.2), V(0, 4.6, -11)], facing: -1, key: [] },
  { t0: EV.counterEnd + 0.3, name: "Zee medium (smug)", from: [V(0.95, 1.6, 7.8), V(1.03, 1.45, 0.3)], to: [V(0.97, 1.6, 7.4), V(1.03, 1.45, 0.3)], key: [] },
  { t0: L[5].start - 0.05, name: "creator close-up (happy)", from: [V(-0.9, 1.95, 7.4), V(-0.97, 1.85, 0.6)], to: [V(-0.95, 1.95, 6.7), V(-0.97, 1.85, 0.6)], key: [] },
];
SHOTS.forEach((s, i) => (s.t1 = SHOTS[i + 1]?.t0 ?? END));
const shotAt = (t) => SHOTS.find((s) => t >= s.t0 && t < s.t1) ?? SHOTS.at(-1);
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 400);
const comp = composer(renderer, scene, camera);
const chunks = captionChunks(L);
const BLINKS = { creator: [1.3, 4.7, 8.1, 10.6], zee: [2.2, 5.6, 9.0] };
const blinkK = (who, t) => Math.max(0, ...BLINKS[who].map((b) => 1 - Math.abs(t - b) / 0.07));

function act(who, c, t) {
  const n = lineAt(t), speaking = n >= 0 && L[n].who === who;
  // expression: the speaker's line, else what a listener does, else the last one
  if (speaking) c.expr(L[n].expr);
  else if (n >= 0 && LISTEN[n]?.[who]) c.expr(LISTEN[n][who]);
  const env = speaking ? L[n].env[Math.floor((t - L[n].start) * T.fps)] ?? 0 : 0;
  c.mouth(env);
  c.blink(blinkK(who, t));
  // gesture: in over 0.25 s from the line's start, out 0.3 s after it ends
  const mine = L.map((l, i) => ({ l, i })).filter(({ l }) => l.who === who);
  let pose = "rest", k = 0;
  for (const { l } of mine) {
    const a = ease((t - l.start + 0.1) / 0.25) * (1 - ease((t - l.end - 0.25) / 0.3));
    if (a > k) { k = a; pose = l.pose ?? "rest"; }
  }
  c.poseMix("rest", pose, k);
  c.idle(t, who === "zee" ? 0.7 : 0);
}

const zoneLog = {};
window.zoneReport = () => zoneLog;
window.ready = false;

window.renderAt = async (t) => {
  const shot = shotAt(t), f = ease((t - shot.t0) / (shot.t1 - shot.t0));
  const pos = shot.from[0].clone().lerp(shot.to[0], f), look = shot.from[1].clone().lerp(shot.to[1], f);
  pos.x += Math.sin(t * 1.7) * 0.02; pos.y += Math.sin(t * 1.3) * 0.015;   // never fully still
  camera.position.copy(pos); camera.lookAt(look);
  const facing = shot.facing ?? 1;
  creator.group.rotation.y = facing > 0 ? 0.3 : Math.PI - 0.15; zee.group.rotation.y = facing > 0 ? -0.35 : Math.PI + 0.2;
  creator.group.visible = zee.group.visible = !(shot.hide ?? []).includes("cast");
  act("creator", creator, t); act("zee", zee, t);
  // a listener's head turns to the speaker
  const n = lineAt(t);
  creator.parts.head.rotation.y = n >= 0 && L[n].who === "zee" && facing > 0 ? 0.28 : 0;
  // the phone: dark until phoneOn, then the real video; it shrinks away when the wall appears
  if (t >= EV.phoneOn) {
    await seek(Math.min(video.duration - 0.05, t - EV.phoneOn + 0.4));
    vx.drawImage(video, 0, 0, vc.width, vc.height); vtex.needsUpdate = true;
    if (phone.mat.map !== vtex) { phone.mat.map = vtex; phone.mat.color.setScalar(0.9); phone.mat.needsUpdate = true; }
  }
  const shrink = ease((t - EV.wall) / 0.45);
  phone.group.scale.setScalar(Math.max(0.0001, 1 - shrink)); phone.group.position.y = 3.55 - shrink * 1.2;
  // tiles pop in from the centre outwards (an overshoot "back" ease)
  for (const tile of tiles) { const a = (t - EV.wall - 0.1 - tile.userData.dist * 0.08) / 0.32; tile.scale.setScalar(a <= 0 ? 0.0001 : a >= 1 ? 1 : 1 + 2.70158 * (a - 1) ** 3 + 1.70158 * (a - 1) ** 2); }
  comp.render();
  // 2D: the frame, then the overlays
  ctx.drawImage(renderer.domElement, 0, 0);
  const chip = t < L[1].start ? [["2:47 ", "#ffffff"], ["AM", YELLOW]] : t < EV.wall ? [["ZYVO MADE ", "#ffffff"], ["THIS", YELLOW]] : [["MADE WITH ", "#ffffff"], ["ZYVO", YELLOW]];
  const chipT0 = t < L[1].start ? 0.05 : t < EV.wall ? L[1].start : EV.wall;
  ov.chip(chip, t - chipT0);
  if (t >= EV.pill && t < L[1].start + 0.3) ov.statPill([["MY LAST SHORT · ", "#ffffff"], ["6 HOURS", YELLOW]], t - EV.pill);
  if (t >= EV.counter && t < L[5].start) ov.counter(9, "SHORT-FORM TEMPLATES", t - EV.counter, Math.max(0.5, EV.counterEnd - EV.counter));
  const chunk = chunks.find((c) => t >= c.s && t < c.e);
  if (chunk) { ctx.save(); ctx.translate(0, (shot.captionY ?? 1300) - 1300); ov.caption(chunk, t); ctx.restore(); }
  // TikTok safe zones for the 3D frame: faces and key props
  const checks = [];
  const faces = (obj) => { const q = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion())); const p = obj.getWorldPosition(new THREE.Vector3()); return q.dot(camera.position.clone().sub(p)) > 0; };
  if (creator.group.visible && faces(creator.parts.head)) checks.push(["creator face", creator.parts.head]);
  if (zee.group.visible && faces(zee.parts.head)) checks.push(["Zee face", zee.parts.head]);
  // the phone is the key prop in its own shot; once the wall appears it is leaving (the wall is decor)
  if (phone.group.scale.x > 0.5 && (shot.key ?? []).includes("phone")) checks.push(["phone screen", phone.screen]);
  for (const [name, obj] of checks) {
    const b = screenBox(obj, camera), probs = zoneProblems(b);
    for (const p of probs) { const k = `${name}: ${p}`; zoneLog[k] ??= { first: t, last: t, frames: 0, shot: shot.name }; zoneLog[k].last = t; zoneLog[k].frames++; }
    if (Q.get("zones")) ov.box(b, probs.length > 0);
  }
  if (Q.get("zones")) ov.zones();
  return true;
};
loaded.then(() => { window.ready = true; });
