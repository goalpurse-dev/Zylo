// Zyvo Studio short videos: the Retention Engine (owner, 2026-10-30, after the first post: 7.1 s average watch, 2%
// to the end). Everything about the structure is in the script (scripts/v*_*.json), so hook/format experiments are data:
//   A scroll-stop: frame 0 is the real result FULL SCREEN mid-action, a hit on frame 0, bold hook text (<= 7 words)
//     already on frame 0, zoom punches (pattern interrupts) in the first second
//   B open loop: a question chip in the first 3 s that only the end answers ("pays_loop" clip)
//   C re-hooks: steps with progress dashes, real screens flipping, the wall twist, clips growing out of the phone
//   D end hit: the best real moment last, the website, ONE engagement trigger
//   E loop: the last frames fade into frame 0 (TikTok replays it seamlessly)
// Inputs from /work: timing.json (audio.py; .short = the script's structure), wall.json, cards/cards.json, phone/;
// the real result's upscaled frames from /pics/<hq_dir>/ (Real-ESRGAN 2x, local). Same frame checks as episode.js.
import * as THREE from "three";
import { makeCreator, makeZee, ZYVO, zShape } from "./cast.js";
import { W, H, setup, mainStage, giantPhone, outputWall, composer, coverFit, screenBox, zoneProblems, rbox, add, SAFE } from "./world.js";
import { makeOverlay, captionChunks, YELLOW } from "./overlay.js";
import { planFor, FRAMINGS_T as FR, easeInOut, roles, shortSteps, stepFrames, anchor } from "./timeline.js";

const Q = new URLSearchParams(location.search);
const T = await (await fetch("/work/timing.json")).json();
const SH = T.short;
const WALL = await (await fetch("/work/wall.json")).json();
const CARDS = await (await fetch("/work/cards/cards.json")).json();
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

// C's desk with the Z laptop (as in episode.js): it rises for the steps
const desk = new THREE.Group(); desk.position.set(-1.05, 0, -0.25); scene.add(desk);
{
  const wood = new THREE.MeshStandardMaterial({ color: new THREE.Color("#d9c6a8"), roughness: 0.85 });
  add(desk, rbox(1.5, 0.09, 0.7, 0.04), wood, 0, 1.0, 0); for (const [x, z] of [[-0.65, -0.28], [0.65, -0.28], [-0.65, 0.28], [0.65, 0.28]]) add(desk, rbox(0.08, 1.0, 0.08, 0.03), wood, x, 0.5, z);
  const alu = new THREE.MeshStandardMaterial({ color: new THREE.Color("#c3c6cd"), roughness: 0.45, metalness: 0.5 });
  const lap = new THREE.Group(); lap.position.set(0, 1.05, 0); lap.rotation.y = Math.PI; desk.add(lap);
  add(lap, rbox(0.92, 0.035, 0.6, 0.015), alu, 0, 0.018, -0.05);
  const lid = new THREE.Group(); lid.position.set(0, 0.035, 0.25); lid.rotation.x = 0.28; lap.add(lid);
  add(lid, rbox(0.92, 0.6, 0.03, 0.02), alu, 0, 0.3, 0);
  const zl = new THREE.Mesh(new THREE.ExtrudeGeometry(zShape(0.22), { depth: 0.01, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: new THREE.Color(ZYVO.violet2).multiplyScalar(1.4), toneMapped: false })); zl.geometry.center(); zl.position.set(0, 0.3, 0.02); lid.add(zl);
  desk.userData.screen = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.54), new THREE.MeshBasicMaterial({ color: new THREE.Color("#111"), toneMapped: false }));
  desk.userData.screen.position.set(0, 0.3, -0.017); desk.userData.screen.rotation.y = Math.PI; lid.add(desk.userData.screen);
}

/* ─── the real result: on the phone (decoded frames) and full screen (upscaled frames) ─── */
const CLIPS = T.clips ?? [];
const DUR = (T.phone.count - 1) / T.phone.fps;
const vc = document.createElement("canvas"), vx = vc.getContext("2d"); vc.width = 720; vc.height = 1280;
const vtex = new THREE.CanvasTexture(vc); vtex.colorSpace = THREE.SRGBColorSpace; coverFit(vtex, phone.w / phone.h, vc.width, vc.height);
vtex.generateMipmaps = false; vtex.minFilter = THREE.LinearFilter; vtex.anisotropy = 16;
phone.mat.map = vtex; phone.mat.color.setScalar(0.9); phone.mat.needsUpdate = true;
const frameCache = new Map();
async function bitmap(url) {
  if (frameCache.has(url)) return frameCache.get(url);
  const b = await createImageBitmap(await (await fetch(url)).blob());
  frameCache.set(url, b);
  if (frameCache.size > 6) { const [k, old] = frameCache.entries().next().value; old.close?.(); frameCache.delete(k); }
  return b;
}
const hqUrl = (vt) => `/pics/${SH.hq_dir}/f${String(Math.min(Math.round((T.phone.count - 1)), Math.max(0, Math.round(vt * 30))) + 1).padStart(5, "0")}.png`;
const clipEnd = (c) => c.freeze_end ?? c.end;
/** Video time of a clip at t: its own moment (vin holds the first frame while its sound starts), the last frame in a freeze. */
const clipVT = (c, t) => Math.min(c.out - 0.02, Math.max(c.vin ?? -1e9, c.in + (t - c.start)));
/** What the phone plays at t: a growing clip's lead-in, else on (muted) from the last clip, from 0 before any. */
function phoneVT(t) {
  const next = CLIPS.find((c) => c.fullscreen && c.enter !== "cut" && t >= c.start - 1.0 && t < clipEnd(c) + 0.4);
  if (next) return Math.max(next.vin ?? next.in, clipVT(next, t));   // its first frame until it plays (no earlier moment shows)
  const last = CLIPS.filter((c) => clipEnd(c) <= t).at(-1);
  // after a clip the phone keeps looping THAT moment (playing on would show the ending before the payoff)
  let v = last ? last.in + (t - clipEnd(last)) % (last.out - last.in) : t % DUR;
  // parts of the result we never show (the line naming a third-party brand): the phone jumps over them
  for (const [a, b] of SH.phone_skip ?? []) if (v >= a && v < b) v = Math.min(DUR, b + (v - a));
  return v;
}
let shown = 0;
async function phoneFrame(t) {
  const f = Math.min(T.phone.count, Math.max(1, Math.round((phoneVT(t) - T.phone.vt0) * T.phone.fps) + 1));
  if (f === shown) return;
  const bmp = await createImageBitmap(await (await fetch(`/work/phone/f${String(f).padStart(5, "0")}.png`)).blob());
  vx.drawImage(bmp, 0, 0, vc.width, vc.height); bmp.close(); vtex.needsUpdate = true; shown = f;
}
/** How full screen clip c is at t: 0 on the phone, 1 full. "cut" is full from its first frame; "grow" comes out of the phone. */
function fullK(c, t) {
  if (!c.fullscreen) return 0;
  const inK = c.enter === "cut" ? (t >= c.start - 1e-3 ? 1 : 0) : Math.min(1, Math.max(0, (t - (c.start - 0.4)) / 0.4));
  return inK * (1 - Math.min(1, Math.max(0, (t - clipEnd(c)) / 0.35)));
}
/** Zoom punches: each one snaps in 7% more (0.08 s) and flashes; a freeze creeps in further and drains the colour. */
function punchState(c, t) {
  let z = 1, flash = 0;
  for (const p of c.punch ?? []) { const a = t - (c.start + p); if (a >= 0) { z += 0.07 * Math.min(1, a / 0.08); flash = Math.max(flash, 0.32 * (1 - a / 0.12)); } }
  let sat = 1;
  if (c.freeze_end && t > c.end) { const k = Math.min(1, (t - c.end) / (c.freeze_end - c.end)); z += 0.06 * easeInOut(k); sat = 1 - 0.65 * Math.min(1, (t - c.end) / 0.15); }
  return { z, flash: Math.max(0, flash), sat };
}
/** Draws clip c full screen (k = how far out of the phone), at its video time; returns true when it covers the frame. */
async function drawClip(c, t, k, { vtOverride = null } = {}) {
  const bmp = await bitmap(hqUrl(vtOverride ?? clipVT(c, t)));
  const { z, flash, sat } = vtOverride != null ? { z: 1, flash: 0, sat: 1 } : punchState(c, t);
  const fw = W * 1.06, fh = fw * 16 / 9, full = { x0: (W - fw) / 2, y0: -120, x1: (W + fw) / 2, y1: -120 + fh };   // its own captions land at y ~1467
  const from = (phone.group.scale.x > 0.5 && screenBox(phone.screen, camera)) || { x0: W * 0.3, y0: H * 0.3, x1: W * 0.7, y1: H * 0.7 };
  const e = k * k * (3 - 2 * k), r = { x0: from.x0 + (full.x0 - from.x0) * e, y0: from.y0 + (full.y0 - from.y0) * e, x1: from.x1 + (full.x1 - from.x1) * e, y1: from.y1 + (full.y1 - from.y1) * e };
  // the zoom centres on the faces (upper middle of the real frame)
  const fx = (r.x0 + r.x1) / 2, fy = r.y0 + (r.y1 - r.y0) * 0.36;
  ctx.save(); ctx.globalAlpha = Math.min(1, k * 3); ctx.beginPath(); ctx.roundRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, 28 * (1 - e)); ctx.clip();
  if (sat < 1) ctx.filter = `saturate(${sat.toFixed(2)}) contrast(1.08)`;
  ctx.translate(fx, fy); ctx.scale(z, z); ctx.translate(-fx, -fy);
  ctx.drawImage(bmp, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  ctx.restore();
  if (flash > 0.01 && k > 0.99) { ctx.save(); ctx.fillStyle = `rgba(255,255,255,${flash.toFixed(3)})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  return k > 0.999;
}

// the step cards (real screens): images, and the laptop screen
const cardImg = {};
await Promise.all(Object.values(CARDS).flatMap((c) => c.frames).map((f) => new Promise((r) => { const im = new Image(); im.onload = r; im.onerror = r; im.src = `/work/cards/${f.file}`; cardImg[f.file] = im; })));
const lc = document.createElement("canvas"); lc.width = 860; lc.height = 540; const lx = lc.getContext("2d");
const ltex = new THREE.CanvasTexture(lc); ltex.colorSpace = THREE.SRGBColorSpace; desk.userData.screen.material.map = ltex; desk.userData.screen.material.color.setScalar(0.9);

/* ─── the plan ─── */
const L = T.lines, EV = Object.fromEntries(T.events.map((e) => [e.event, e.t])), END = T.total;
const R = roles(L);
const PLAN = planFor(T);
const STEPS = shortSteps(T), STEPS_TOTAL = SH.steps_total ?? STEPS.length;
const stepAt = (t) => STEPS.find((s) => t >= s.t0 && t < s.t1) ?? null;
const lineAt = (t) => L.findIndex((l) => t >= l.start - 0.05 && t <= l.end + 0.05);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const V = (a) => new THREE.Vector3(...a);
const FACE = { camera: { creator: 0.15, zee: -0.35 }, phone: { creator: Math.PI - 0.25, zee: Math.PI + 0.3 }, wall: { creator: Math.PI - 0.15, zee: Math.PI + 0.2 } };
const firstStep = STEPS[0]?.t0 ?? Infinity, lastStep = STEPS.at(-1)?.t1 ?? -Infinity;
const growAfterSteps = CLIPS.find((c) => c.fullscreen && c.enter !== "cut" && c.start > lastStep);
const phoneBack = growAfterSteps ? growAfterSteps.start - 1.4 : lastStep + 0.3;
const parts = (p) => p.map(([s, c]) => [s, c === "Y" ? YELLOW : c ?? "#ffffff"]);
const CHIPS = (SH.chips ?? []).map((c) => ({ t0: anchor(T, c.from), t1: anchor(T, c.to), parts: parts(c.parts) }));

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
  else if (n >= 0) c.expr(who === "creator" ? (L[n].step != null || /^(tease|twist)/.test(L[n].role ?? "") ? "happy" : L[n].role === "time" ? "shocked" : "thinking") : (L[n].role === "objection" ? "smug" : "happy"));
  c.mouth(speaking ? L[n].env[Math.floor((t - L[n].start) * T.fps)] ?? 0 : 0);
  c.blink(blinkK(who, t));
  const typing = who === "creator" && stepAt(t);
  let pose = typing ? "type" : "rest", k = typing ? 0.75 : 0;
  for (const l of L) if (l.who === who) { const a = ease((t - l.start + 0.1) / 0.25) * (1 - ease((t - l.end - 0.25) / 0.3)); if (a > k) { k = a; pose = l.pose ?? "rest"; } }
  c.poseMix("rest", pose, k);
  c.idle(t, who === "zee" ? 0.7 : 0);
}

function setState(ts) {
  const cam = cameraAt(ts);
  camera.position.copy(cam.pos); camera.lookAt(cam.look);
  for (const [who, c] of [["creator", creator], ["zee", zee]]) c.group.rotation.y = FACE[cam.facing.from][who] + (FACE[cam.facing.to][who] - FACE[cam.facing.from][who]) * cam.facing.f;
  act("creator", creator, ts); act("zee", zee, ts);
  // the phone steps aside for the steps (the cards lead) and comes back before a clip grows out of it
  const away = ease((ts - (firstStep - 0.6)) / 0.45) * (1 - ease((ts - phoneBack) / 0.45));
  phone.group.scale.setScalar(Math.max(0.0001, 1 - away)); phone.group.position.y = PHONE_Y - away * 1.2;
  const d = ease((ts - (firstStep - 0.7)) / 0.4) * (1 - ease((ts - Math.min(lastStep, EV.wall ?? Infinity) + 0.1) / 0.4));
  desk.scale.setScalar(Math.max(0.0001, d)); desk.visible = d > 0.001;
  for (const tile of tiles) { const a = EV.wall == null ? 0 : (ts - EV.wall - 0.1 - tile.userData.dist * 0.08) / 0.32; tile.scale.setScalar(a <= 0 ? 0.0001 : a >= 1 ? 1 : 1 + 2.70158 * (a - 1) ** 3 + 1.70158 * (a - 1) ** 2); tile.userData.update(ts); }
  return cam;
}

const log = {};
const note = (k, t, where) => { log[k] ??= { first: +t.toFixed(2), last: 0, frames: 0, where }; log[k].last = +t.toFixed(2); log[k].frames++; };
const obs = {};
window.zoneReport = () => ({ ...log, _observations: obs });
window.plan = PLAN;
const SUB = Number(Q.get("blur") ?? 7);
let lastLap = "";
const LOOP = SH.loop_end ? { secs: SH.loop_end.secs ?? 0.5, clip: CLIPS.find((c) => c.enter === "cut") } : null;

window.renderAt = async (t) => {
  await phoneFrame(t);
  const st = stepAt(t), sf = st ? stepFrames(st, CARDS) : null;
  const cfi = sf ? Math.min(sf.frames.length - 1, Math.floor(Math.max(0, t - st.t0) / sf.dur)) : -1, cf = sf ? sf.frames[cfi] : null;
  if (cf && cf.f.file !== lastLap) { const im = cardImg[cf.f.file]; lx.fillStyle = "#0b0c0e"; lx.fillRect(0, 0, 860, 540); const h = 540, w = h * sf.c.aspect; lx.drawImage(im, (860 - w) / 2, 0, w, h); ltex.needsUpdate = true; lastLap = cf.f.file; }

  // a clip that covers the whole frame: no 3D needed under it
  const full = CLIPS.map((c) => [c, fullK(c, t)]).filter(([, k]) => k > 0);
  const covered = full.some(([, k]) => k > 0.999);
  let cam = cameraAt(t);
  if (!covered) {
    const nsub = cam.moving ? SUB : 1;
    for (let i = 0; i < nsub; i++) { const ts = nsub === 1 ? t : t + (i / (nsub - 1) - 0.5) * (0.5 / 30); cam = setState(ts); comp.render(); ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(renderer.domElement, 0, 0, W, H); }
    ctx.globalAlpha = 1;
  }
  cam = setState(t);
  const where = covered ? "real clip full screen" : cam.moving ? `${cam.step.kind} ${cam.step.from}->${cam.step.to}` : `hold on ${cam.step.at}`;
  for (const [c, k] of full) { await drawClip(c, t, k); if (k > 0.99) { obs.fullscreen ??= []; if (!obs.fullscreen.some((x) => x.name === c.name)) obs.fullscreen.push({ name: c.name, from: +t.toFixed(2) }); } }
  if (obs.realOutputFirst == null && full.some(([, k]) => k > 0.5)) obs.realOutputFirst = +t.toFixed(2);

  // overlays
  const boxes = [];
  const inClip = full.find(([, k]) => k > 0.5)?.[0];
  if (inClip) {
    // the hook text: on frame 0 already, whole (no entrance animation: a cold viewer reads it at once)
    if (inClip.hook && t < inClip.end + 0.05) boxes.push(["hook text", ov.hook(inClip.hook, t - inClip.start, { y: inClip.text_y, pulse: punchState(inClip, t).flash })]);
    if (inClip.freeze?.text && t >= inClip.end) boxes.push(["freeze text", ov.hook(inClip.freeze.text, t - inClip.end, { y: inClip.text_y, pop: true })]);
    if (inClip.open_loop && t >= inClip.start + inClip.open_loop.at) boxes.push(["open loop chip", ov.chip(parts(inClip.open_loop.parts), t - inClip.start - inClip.open_loop.at)]);
    if (inClip.pays_loop) boxes.push(["loop paid chip", ov.chip(parts(inClip.pays_loop.parts), t - inClip.start + 0.4)]);
  } else if (st) {
    boxes.push(["step chip", ov.stepChip(STEPS.indexOf(st) + 1, STEPS_TOTAL, [[`STEP ${STEPS.indexOf(st) + 1} · `, "#ffffff"], [st.chip.join(""), YELLOW]], t - st.t0)]);
    // the real time since the first click, only where it was measured (a reused creation's cards have none)
    const secs = st.line.badge ?? cf.f.t;
    const badge = sf.c.nav || secs == null ? null : `⏱ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    // the card waits for the camera to land (it never slides in over a face mid-move)
    if (!cam.moving) boxes.push(["step card", ov.card(cardImg[cf.f.file], sf.c.aspect, t - st.t0, { width: st.card === "step1" || st.card === "step2" ? 600 : 560, badge, tap: cf.f.tap, tapAt: cf.tapAt })]);
  } else {
    const ch = CHIPS.find((c) => t >= c.t0 && t < c.t1);
    if (ch) boxes.push(["chip", ov.chip(ch.parts, t - ch.t0)]);
  }
  if (EV.counter != null && SH.counter) {
    const off = PLAN.find((p) => p.type === "move" && p.from === "wall" && p.t0 > EV.counter)?.t0 ?? (EV.counterEnd ?? EV.counter) + 1.5;
    if (t >= EV.counter && t < off && !inClip) boxes.push(["counter", ov.counter(SH.counter.value, SH.counter.label, t - EV.counter, Math.max(0.5, (EV.counterEnd ?? EV.counter + 1) - EV.counter))]);
  }
  if (EV.timer != null && SH.timer) {
    const zeeLowAt = PLAN.find((p) => p.type === "move" && p.to === "zeeLow" && p.t1 >= EV.timer - 1.5)?.t1 ?? EV.timer, t0 = Math.max(EV.timer, zeeLowAt);
    const off = (CLIPS.find((c) => c.start > EV.timer)?.start ?? END) - 1.0;
    if (t >= t0 && t < off && !inClip) boxes.push(["timer", ov.timer(SH.timer.seconds, SH.timer.label, t - t0, Math.max(0.5, (EV.timerEnd ?? t0 + 1) - t0))]);
  }
  // the website at the end (said and shown), then ONE engagement trigger
  if (EV.site != null && t >= EV.site && t < (EV.cta ?? END) && !inClip && !cam.moving) boxes.push(["website chip", EV.bio != null && t >= EV.bio ? ov.endChip("tryzyvo.com · link in bio", t - EV.bio) : ov.endChip("tryzyvo.com", t - EV.site)]);
  if (EV.cta != null && t >= EV.cta + 0.3 && !inClip && !cam.moving) boxes.push(["CTA chip", ov.endChip(SH.cta.chip, t - EV.cta - 0.3)]);
  if (EV.teaseChip != null && t >= EV.teaseChip && t < EV.teaseChip + 2.2 && !inClip) boxes.push(["tease chip", ov.endChip("WEBSITE AT THE END 👀", t - EV.teaseChip)]);
  const chunk = chunks.find((c) => t >= c.s && t < c.e);
  const ps = !covered && phone.group.scale.x > 0.5 ? screenBox(phone.screen, camera) : null;
  const card = boxes.find(([k]) => k === "step card")?.[1];
  const blocked = inClip || (ps && ps.y0 < 1370 && ps.y1 > 1230) || (card && card.y1 > 1240);
  if (chunk && !blocked) ov.caption(chunk, t);

  // E. the loop: the last frames fade into frame 0 (the same clip moment and hook text)
  if (LOOP?.clip && t > END - LOOP.secs) {
    const a = Math.min(1, (t - (END - LOOP.secs)) / Math.max(0.05, LOOP.secs - 1 / 30));
    ctx.save(); ctx.globalAlpha = a; await drawClip(LOOP.clip, LOOP.clip.start, 1, { vtOverride: clipVT(LOOP.clip, LOOP.clip.start) });
    if (LOOP.clip.hook) ov.hook(LOOP.clip.hook, 0, { y: LOOP.clip.text_y }); ctx.restore();
  }

  // checks (the 3D cast; a full-screen real clip is the video itself)
  if (!covered) {
    const faces = (obj) => { const q = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion())); return q.dot(camera.position.clone().sub(obj.getWorldPosition(new THREE.Vector3()))) > 0; };
    const keys = [];
    for (const [name, c] of [["creator", creator], ["Zee", zee]]) if (faces(c.parts.head)) keys.push([`${name} face`, c.parts.head]);
    if (faces(zee.parts.head)) keys.push(["Zee antenna", zee.parts.antenna]);
    if (!cam.moving && cam.step.at === "phone" && !full.length) keys.push(["phone screen", phone.screen]);
    for (const [name, obj] of keys) {
      const b = screenBox(obj, camera); if (!b) continue;
      if (!cam.moving && !full.length) for (const p of zoneProblems(b)) note(`${name}: ${p}`, t, where);
      for (const [oname, ob] of boxes) if (ob && !full.length && b.x0 < ob.x1 && b.x1 > ob.x0 && b.y0 < ob.y1 && b.y1 > ob.y0) note(`${oname} over ${name}`, t, where);
      if (Q.get("zones")) ov.box(b, false);
    }
    if (!cam.moving && !full.length) {
      for (const [name, c] of [["creator", creator], ["Zee", zee]]) for (const [pn, obj] of [[`${name} (whole)`, c.parts.body], ...c.parts.arms.map((a, i) => [`${name} ${i ? "right" : "left"} arm`, a.pivot])]) {
        const b = screenBox(obj, camera); if (!b) continue;
        const w = b.x1 - b.x0, inside = (Math.min(b.x1, W) - Math.max(b.x0, 0)) / (w || 1);
        if (inside > 0.02 && inside < 0.97 && (b.x0 < 0 || b.x1 > W) && b.y1 > 0 && b.y0 < H && b.y1 <= H) note(`${pn} cut at the ${b.x0 < 0 ? "left" : "right"} edge`, t, where);
      }
    }
  }
  // overlays must stay inside the export safe zone
  for (const [oname, ob] of boxes) if (ob && (ob.x0 < SAFE.left - 1 || ob.x1 > W - SAFE.right + 1 || ob.y0 < SAFE.top - 1 || ob.y1 > H - SAFE.bottom + 1)) note(`${oname} outside the safe zone`, t, where);
  if (t < 0.01) obs.frame0 = { fullscreen: covered, hook: full[0]?.[0]?.hook ?? null, words: (full[0]?.[0]?.hook ?? "").replace(/[|*]/g, " ").split(/\s+/).filter(Boolean).length };
  if (Q.get("zones")) ov.zones();
  return true;
};
loaded.then(() => { window.ready = true; });
