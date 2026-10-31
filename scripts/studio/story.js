// Zyvo Studio v2: a video people actually watch (Master Prompt v2, owner 2026-10-31). The viewer's problem first, a
// bright world, a prop for every line, characters facing the camera, real screens BIG with a sticker, a headline that
// shrinks to a chip, source stamps, an early and a big real payoff. Everything is in the script (storyScripts.mjs).
// Inputs from /work: timing.json (audio.py; .short = the structure), media/ (the creation's real pictures), screens/.
// Real result frames from /pics/<hq_dir>/. Checks every frame: faces in the safe zones, nothing over a face.
import * as THREE from "three";
import { makeCreator, makeZee } from "./cast.js";
import { W, H, setup, composer, screenBox, zoneProblems, SAFE } from "./world.js";
import { makeOverlay, captionChunks, YELLOW } from "./overlay.js";
import { planFor, SETUPS as FR, easeInOut, roles } from "./timeline.js";
import { buildWorld } from "./worlds.js";
import { makeProp } from "./props.js";

const Q = new URLSearchParams(location.search);
const T = await (await fetch("/work/timing.json")).json();
const SH = T.short;
const { renderer, scene, manager, tl } = setup();
const loaded = new Promise((r) => (manager.onLoad = r));
const out = document.getElementById("out"), ctx = out.getContext("2d");
ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
const ov = makeOverlay(ctx);
const look = buildWorld(SH.world, scene);
renderer.toneMappingExposure = look.exposure;

const creator = makeCreator(), zee = makeZee();
scene.add(creator.group, zee.group);
creator.group.position.set(-0.85, 0, 0.6); zee.group.position.set(1.0, 0, 0.3);
const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 400);
const comp = composer(renderer, scene, camera, { bloom: look.bloom, sat: look.sat, con: 1.04, vig: look.vig });

/* ─── the real result, full screen ─── */
const CLIPS = T.clips ?? [];
const frameCache = new Map();
async function bitmap(url) {
  if (frameCache.has(url)) return frameCache.get(url);
  const b = await createImageBitmap(await (await fetch(url)).blob());
  frameCache.set(url, b);
  if (frameCache.size > 6) { const [k, old] = frameCache.entries().next().value; old.close?.(); frameCache.delete(k); }
  return b;
}
const hqUrl = (c, vt) => `/pics/${c.hq_dir ?? SH.hq_dir}/f${String(Math.max(0, Math.round(vt * 30)) + 1).padStart(5, "0")}.png`;
const clipEnd = (c) => c.freeze_end ?? c.end;
const clipVT = (c, t) => Math.min(c.out - 0.02, Math.max(c.in, c.in + (t - c.start)));
function fullK(c, t) {
  const inK = c.enter === "cut" ? (t >= c.start - 1e-3 ? 1 : 0) : Math.min(1, Math.max(0, (t - (c.start - 0.45)) / 0.45));
  return inK * (1 - Math.min(1, Math.max(0, (t - clipEnd(c)) / 0.4)));
}
function punchState(c, t) {
  let z = 1, flash = 0;
  for (const p of c.punch ?? []) { const a = t - (c.start + p); if (a >= 0) { z += 0.07 * Math.min(1, a / 0.08); flash = Math.max(flash, 0.3 * (1 - a / 0.12)); } }
  let sat = 1;
  if (c.freeze_end && t > c.end) { const k = Math.min(1, (t - c.end) / (c.freeze_end - c.end)); z += 0.05 * easeInOut(k); sat = 1 - 0.6 * Math.min(1, (t - c.end) / 0.15); }
  return { z, flash: Math.max(0, flash), sat };
}
async function drawClip(c, t, k, vtOverride = null) {
  const bmp = await bitmap(hqUrl(c, vtOverride ?? clipVT(c, t)));
  const { z, flash, sat } = vtOverride != null ? { z: 1, flash: 0, sat: 1 } : punchState(c, t);
  // it grows from the middle of the frame, over the world
  const fw = W * 1.06, fh = fw * 16 / 9, full = { x0: (W - fw) / 2, y0: -120, x1: (W + fw) / 2, y1: -120 + fh };
  const from = { x0: W * 0.28, y0: H * 0.24, x1: W * 0.72, y1: H * 0.24 + W * 0.44 * 16 / 9 };
  const e = k * k * (3 - 2 * k), r = { x0: from.x0 + (full.x0 - from.x0) * e, y0: from.y0 + (full.y0 - from.y0) * e, x1: from.x1 + (full.x1 - from.x1) * e, y1: from.y1 + (full.y1 - from.y1) * e };
  const fx = (r.x0 + r.x1) / 2, fy = r.y0 + (r.y1 - r.y0) * 0.36;
  ctx.save(); ctx.globalAlpha = Math.min(1, k * 3); ctx.beginPath(); ctx.roundRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 28 * (1 - e)); ctx.clip();
  if (sat < 1) ctx.filter = `saturate(${sat.toFixed(2)}) contrast(1.08)`;
  ctx.translate(fx, fy); ctx.scale(z, z); ctx.translate(-fx, -fy);
  ctx.drawImage(bmp, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  ctx.restore();
  if (flash > 0.01 && k > 0.99) { ctx.save(); ctx.fillStyle = `rgba(255,255,255,${flash.toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

/* ─── the plan: lines, props, screens ─── */
const L = T.lines, EV = Object.fromEntries(T.events.map((e) => [e.event, e.t])), END = T.total;
const PLAN = planFor(T);
const lineAt = (t) => L.findIndex((l) => t >= l.start - 0.05 && t <= l.end + 0.05);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const V = (a) => new THREE.Vector3(...a);
const ACTS = T.events.filter((e) => e.event.startsWith("act|")).map((e) => { const [, who, expr, dur] = e.event.split("|"); return { t: e.t, who, expr, until: e.t + Number(dur ?? 1.2) }; });

// A line's visual stays until the next line that has one (or a clip takes over)
const PROP_DIST = 11.5, PROP_UP = 0.98;
const beats = [];
L.forEach((l, i) => { if (l.visual || l.screen) beats.push({ line: l, i, t0: l.start - 0.12, visual: l.visual, screen: l.screen }); });
beats.forEach((b, i) => { b.t1 = beats[i + 1]?.t0 ?? (L.at(-1).end + 0.3); });
for (const b of beats) {
  const c = CLIPS.find((x) => x.start > b.t0 && x.start < b.t1); if (c) b.t1 = c.start - 0.45;   // out of the way of a clip
  if (b.visual) { const p = makeProp(b.visual, { tl }); b.prop = p; p.group.visible = false; scene.add(p.group); p.group.position.set(...(b.visual.pos ?? [0.2, 4.05, -0.3])); p.base = p.group.position.clone(); p.scale = b.visual.scale ?? 1; }
}
const screenImg = {};
await Promise.all(beats.filter((b) => b.screen).map((b) => new Promise((r) => { const im = new Image(); im.onload = r; im.onerror = r; im.src = `/work/screens/${b.screen.file}`; screenImg[b.screen.file] = im; })));

function cameraAt(t) {
  const s = PLAN.find((p) => t >= p.t0 && t < p.t1) ?? PLAN.at(-1);
  if (s.type === "hold") {
    const F = FR[s.at], k = Math.min(1, (t - s.t0) / Math.max(1, s.t1 - s.t0));
    const pos = V(F.pos), lk = V(F.look); pos.addScaledVector(lk.clone().sub(pos).normalize(), k * (F.creep ?? 0.2));
    return { pos, look: lk, moving: false, step: s };
  }
  const A = FR[s.from], B = FR[s.to], f = easeInOut((t - s.t0) / (s.t1 - s.t0));
  return { pos: V(A.pos).lerp(V(B.pos), f), look: V(A.look).lerp(V(B.look), f), moving: true, step: s };
}
const chunks = captionChunks(L);
const blinkK = (who, t) => { const p = who === "zee" ? 3.1 : 2.7, o = who === "zee" ? 1.3 : 0.4; const x = ((t - o) % p + p) % p; return Math.max(0, 1 - Math.abs(x - p / 2) / 0.07); };

function act(who, c, t) {
  const n = lineAt(t), l = n >= 0 ? L[n] : null, speaking = l?.who === who;
  const beat = ACTS.filter((a) => a.who === who && t >= a.t && t < a.until).at(-1);   // a reaction on a key word
  if (beat) c.expr(beat.expr);
  else if (speaking) c.expr(l.expr ?? "happy");
  else c.expr(l?.listen ?? (who === "creator" ? "thinking" : "happy"));
  c.mouth(speaking ? l.env[Math.floor((t - l.start) * T.fps)] ?? 0 : 0);
  c.blink(blinkK(who, t));
  let pose = "rest", k = 0;
  for (const x of L) if (x.who === who) { const a = ease((t - x.start + 0.1) / 0.25) * (1 - ease((t - x.end - 0.25) / 0.3)); if (a > k) { k = a; pose = x.pose ?? "rest"; } }
  c.poseMix("rest", pose, k);
  c.idle(t, who === "zee" ? 0.7 : 0);
}
function setState(ts) {
  const cam = cameraAt(ts);
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  // both face the camera; the listener leans a little towards the speaker
  for (const [who, c, other] of [["creator", creator, zee], ["zee", zee, creator]]) {
    const p = c.group.position, toCam = Math.atan2(cam.pos.x - p.x, cam.pos.z - p.z);
    const toOther = Math.atan2(other.group.position.x - p.x, other.group.position.z - p.z), n = lineAt(ts);
    const listening = n >= 0 && L[n].who !== who;
    c.group.rotation.y = toCam + (listening ? (toOther - toCam) * 0.18 : 0) + (who === "zee" ? -0.05 : 0.05);
    act(who, c, ts);
  }
  for (const b of beats) {
    if (!b.prop) continue;
    const a = ts - b.t0, on = ts >= b.t0 && ts < b.t1 + 0.2, p = b.prop;
    p.group.visible = on; if (!on) continue;
    const inK = a / 0.32, s = inK <= 0 ? 0.0001 : inK >= 1 ? 1 : 1 + 2.7 * (inK - 1) ** 3 + 1.7 * (inK - 1) ** 2, outK = 1 - ease((ts - b.t1) / 0.2);
    p.group.scale.setScalar(Math.max(0.0001, s * outK * p.scale));
    // locked to the screen, above the heads: always whole and readable whatever the camera does (a slow float)
    const fwd = cam.look.clone().sub(cam.pos).normalize(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
    p.group.position.copy(cam.pos).addScaledVector(fwd, PROP_DIST).addScaledVector(right, -0.14).addScaledVector(up, (b.visual.up ?? PROP_UP) + Math.sin(ts * 1.3) * 0.03);
    p.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(cam.pos, p.group.position, new THREE.Vector3(0, 1, 0))); p.group.rotateY(Math.sin(ts * 0.7) * 0.05);
    p.update(a);
  }
  look.update(ts);
  return cam;
}

const log = {}, obs = {};
const note = (k, t, where) => { log[k] ??= { first: +t.toFixed(2), last: 0, frames: 0, where }; log[k].last = +t.toFixed(2); log[k].frames++; };
window.zoneReport = () => ({ ...log, _observations: obs });
const SUB = Number(Q.get("blur") ?? 5);
const LOOP = SH.loop_end ? { secs: SH.loop_end.secs ?? 0.5, first: CLIPS.find((c) => c.enter === "cut") } : null;
const headlineAt = SH.headline;

window.renderAt = async (t) => {
  const full = CLIPS.map((c) => [c, fullK(c, t)]).filter(([, k]) => k > 0), covered = full.some(([, k]) => k > 0.999);
  const beat = beats.find((b) => t >= b.t0 && t < b.t1);
  let cam = cameraAt(t);
  if (!covered) {
    const nsub = cam.moving ? SUB : 1;
    for (let i = 0; i < nsub; i++) { const ts = nsub === 1 ? t : t + (i / (nsub - 1) - 0.5) * (0.5 / 30); cam = setState(ts); comp.render(); ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(renderer.domElement, 0, 0, W, H); }
    ctx.globalAlpha = 1;
  }
  cam = setState(t);
  const where = covered ? "real clip" : cam.moving ? `${cam.step.from}->${cam.step.to}` : `hold ${cam.step.at}`;
  for (const [c, k] of full) await drawClip(c, t, k);
  const inClip = full.find(([, k]) => k > 0.5)?.[0];
  const boxes = [];

  // the real screen, BIG, with its one sticker
  let shot = null;
  if (beat?.screen && !inClip) {
    const im = screenImg[beat.screen.file], sc = beat.screen;
    shot = ov.bigScreen(im, im.naturalWidth / im.naturalHeight, t - beat.t0, { outAge: t - beat.t1 + 0.25, sticker: sc.sticker });
    boxes.push(["screen", shot]);
  }
  // the headline: big for its first seconds, then a small chip
  if (headlineAt && !(inClip && !inClip.headline) && t < (EV.site ?? END)) {
    const big = headlineAt.secs;
    if (t < big) boxes.push(["headline", ov.headline(headlineAt.text, t, big)]);
    else if (!shot) boxes.push(["headline chip", ov.chip([[headlineAt.chip, YELLOW]], t - big)]);
  }
  if (beat?.line.stamp && !inClip) boxes.push(["stamp", ov.stamp(beat.line.stamp, t - beat.t0, shot ? shot.y1 + 34 : 898)]);
  if (inClip?.stamp) boxes.push(["stamp", ov.stamp(inClip.stamp, t - inClip.start, 1212)]);
  if (inClip?.freeze?.text && t >= inClip.end) boxes.push(["freeze text", ov.hook(inClip.freeze.text, t - inClip.end, { y: 1040, pop: true })]);
  // the website at the end, then ONE trigger
  if (EV.site != null && t >= EV.site && t < (EV.cta ?? END) && !inClip && !cam.moving) boxes.push(["website chip", EV.bio != null && t >= EV.bio ? ov.endChip("tryzyvo.com · link in bio", t - EV.bio) : ov.endChip("tryzyvo.com", t - EV.site)]);
  if (EV.cta != null && t >= EV.cta + 0.3 && !inClip && !cam.moving && SH.cta?.chip) boxes.push(["CTA chip", ov.endChip(SH.cta.chip, t - EV.cta - 0.3)]);
  const chunk = chunks.find((c) => t >= c.s && t < c.e);
  if (chunk && !inClip) ov.caption(chunk, t, boxes.some(([k]) => k === "website chip" || k === "CTA chip") ? 1320 : 1400);   // below the faces and any screen, above an end chip

  if (LOOP?.first && t > END - LOOP.secs) {
    const a = Math.min(1, (t - (END - LOOP.secs)) / Math.max(0.05, LOOP.secs - 1 / 30));
    ctx.save(); ctx.globalAlpha = a; await drawClip(LOOP.first, LOOP.first.start, 1, clipVT(LOOP.first, LOOP.first.start));
    if (headlineAt) ov.headline(headlineAt.text, 0, headlineAt.secs); ctx.restore();
  }

  // checks (faces, antenna; a real screen or clip is allowed over the cast: the voice carries on over it)
  if (!covered && !shot && !cam.moving && !full.length) {
    const faces = (obj) => { const q = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion())); return q.dot(camera.position.clone().sub(obj.getWorldPosition(new THREE.Vector3()))) > 0; };
    const keys = [];
    for (const [name, c] of [["creator", creator], ["Zee", zee]]) if (faces(c.parts.head)) keys.push([`${name} face`, c.parts.head]); else note(`${name} back to camera`, t, where);
    keys.push(["Zee antenna", zee.parts.antenna]);
    const speaker = L[lineAt(t)]?.who;
    for (const [name, obj] of keys) {
      const b = screenBox(obj, camera); if (!b) { if (speaker && name.toLowerCase().startsWith(speaker)) note(`${name} out of frame while speaking`, t, where); continue; }
      const onScreen = b.x1 > 0 && b.x0 < W;
      if (onScreen) for (const p of zoneProblems(b)) note(`${name}: ${p}`, t, where);
      for (const [oname, ob] of boxes) if (ob && onScreen && b.x0 < ob.x1 && b.x1 > ob.x0 && b.y0 < ob.y1 && b.y1 > ob.y0) note(`${oname} over ${name}`, t, where);
      if (Q.get("zones")) ov.box(b, false);
    }
  }
  if (Q.get("zones")) ov.zones();
  if (t < 0.01) obs.frame0 = { covered, headline: headlineAt?.text ?? null };
  return true;
};
loaded.then(() => { window.ready = true; });
void roles; void SAFE; void H;
