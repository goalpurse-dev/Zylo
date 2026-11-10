// Blocky Worlds INSERT KIT (INSERTS agent, 2026-11-10; owner: "bold designed props and screens like the reference: big
// clock faces, neon screens with text, signs" + "build the music box"). REAL in-world objects for the hero inserts (not
// picture cards): clean plastic, flat bold colours, low roughness, big readable faces. lib/insertKit.js is the planner
// side (names, states, the line parsing); lib/shotGrammar.js frames them full-frame ("wide" object framing, fitY = the
// face) with a slow push in.
// Contract (kit/things.js): origin on the floor at the front-centre, faces +z (extends to -z), metres; userData
// { height, width, depth, focus, fitW, fitH, fitY, detail, push, actors }; userData.anim(t) per frame (shot time t,
// deterministic: second hands, countdown digits, the crank, the dancer, neon flicker all come from t only).
//   INSERT_BUILD[name](g, state, opts)   opts: { text, secs, look } from the shot object (page/engine.js objKey)
//   heldMusicBox(g)                      the hand-size music box (kit/heldMore.js HELD_BUILD.music_box)
import * as THREE from "three";
import { cachedGeo, cachedMat, solid, rbx, bx, addMesh, canvasTex, loadKitFonts, kitFont, fitText, darker } from "./kitCommon.js";
import { countdownText } from "../../lib/insertKit.js";

await loadKitFonts();

const TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const M = addMesh;
const cyl = (r1, r2, h, seg = 24) => cachedGeo(`icyl${r1},${r2},${h},${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg));
const sph = (r, w = 16, h = 12) => cachedGeo(`isph${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
const disc = (r, seg = 48) => cachedGeo(`idisc${r},${seg}`, () => new THREE.CircleGeometry(r, seg));
const tor = (r, t, a = TAU) => cachedGeo(`itor${r},${t},${a}`, () => new THREE.TorusGeometry(r, t, 10, 32, a));
const plane = (w, h) => cachedGeo(`iplane${w},${h}`, () => new THREE.PlaneGeometry(w, h));
/** clean plastic: a flat colour, low roughness (PLASTIC-WORLD's look; kitCommon solid underneath) */
const plastic = (c, r = 0.28) => solid(c, { roughness: r });
const metal = (c, r = 0.28) => solid(c, { metalness: 0.75, roughness: r });
const glowMat = (c, k = 1.6) => cachedMat(`iglow${c}${k}`, () => new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: c, emissiveIntensity: k, roughness: 0.35 }));
const hash = (n) => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0; x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16; return x / 4294967296; };
const strHash = (s) => { let h = 2166136261; for (const ch of String(s ?? "")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

/** framing data: the face (w x h) centred at height cy; the backdrop's depth d */
function fin(g, { w, h, cy, d = 0.5, top = null, actors = "beside", fz = -0.1 }) {
  Object.assign(g.userData, {
    height: top ?? cy + h / 2, width: w, depth: d, focus: V(0, 0, fz), fitW: w * 1.04, fitH: h * 1.04, fitY: cy,
    detail: { at: V(0, cy, fz), h: h * 1.05 }, push: 0.6, actors, designed: true,
  });
}

// ------------------------------------------------------------------------------------------------ canvases
/** a canvas texture drawn once (cached by key) */
const TEX = new Map();
function tex(key, W, H, draw) {
  let t = TEX.get(key);
  if (!t) { const c = document.createElement("canvas"); c.width = W; c.height = H; draw(c.getContext("2d"), W, H); t = canvasTex(c); TEX.set(key, t); }
  return t;
}
/** a live canvas (redrawn when its text changes): { tex, set(str) } */
function liveCanvas(W, H, draw) {
  const c = document.createElement("canvas"); c.width = W; c.height = H; const p = c.getContext("2d");
  const t = canvasTex(c); let cur = null;
  const set = (s) => { if (s === cur) return; cur = s; p.clearRect(0, 0, W, H); draw(p, W, H, s); t.needsUpdate = true; };
  return { tex: t, set };
}
/** bold centred text that fits the box */
function bold(p, text, cx, cy, maxW, maxH, { color = "#1b1b1f", maxSize = 220, maxLines = 2, stroke = null, sw = 0, glow = null } = {}) {
  const { lines, size } = fitText(p, String(text ?? ""), maxW, maxH, { maxSize, maxLines });
  p.font = kitFont(size); p.textAlign = "center"; p.textBaseline = "middle";
  const y0 = cy - ((lines.length - 1) * size) / 2;
  lines.forEach((l, i) => {
    if (glow) { p.shadowColor = glow; p.shadowBlur = size * 0.35; }
    if (stroke) { p.lineJoin = "round"; p.strokeStyle = stroke; p.lineWidth = sw; p.strokeText(l, cx, y0 + i * size); }
    p.fillStyle = color; p.fillText(l, cx, y0 + i * size);
    p.shadowBlur = 0;
  });
}
const rr = (p, x, y, w, h, r) => { p.beginPath(); p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r); p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath(); };

/** seven-segment digits (a real digital display, not a font): str of 0-9 and ":" */
const SEG = { 0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abcfgd", "-": "g" };
function sevenSeg(p, str, x, y, h, on, off) {
  const w = h * 0.5, t = h * 0.12, gap = h * 0.16;
  const seg = (s, ox, lit) => {
    p.fillStyle = lit ? on : off;
    const H2 = h / 2, R = (sx, sy, sw, sh) => { rr(p, ox + sx, y + sy, sw, sh, t * 0.45); p.fill(); };
    if (s === "a") R(t * 0.6, 0, w - t * 1.2, t); if (s === "g") R(t * 0.6, H2 - t / 2, w - t * 1.2, t); if (s === "d") R(t * 0.6, h - t, w - t * 1.2, t);
    if (s === "f") R(0, t * 0.6, t, H2 - t * 0.9); if (s === "b") R(w - t, t * 0.6, t, H2 - t * 0.9);
    if (s === "e") R(0, H2 + t * 0.3, t, H2 - t * 0.9); if (s === "c") R(w - t, H2 + t * 0.3, t, H2 - t * 0.9);
  };
  let ox = x;
  for (const ch of String(str)) {
    if (ch === ":") { p.fillStyle = on; p.beginPath(); p.arc(ox + t, y + h * 0.3, t * 0.7, 0, TAU); p.arc(ox + t, y + h * 0.7, t * 0.7, 0, TAU); p.fill(); ox += t * 2 + gap; continue; }
    p.shadowColor = on;
    for (const s of "abcdefg") { const lit = (SEG[ch] ?? "").includes(s); p.shadowBlur = lit ? h * 0.12 : 0; seg(s, ox, lit); }
    p.shadowBlur = 0;
    ox += w + gap;
  }
  return ox - x - gap;
}
const segWidth = (str, h) => { const w = h * 0.5, t = h * 0.12, gap = h * 0.16; let x = 0; for (const ch of String(str)) x += (ch === ":" ? t * 2 : w) + gap; return x - gap; };

// ------------------------------------------------------------------------------------------------ backdrops
/** a wall section behind a wall-mounted insert (fills the frame around it): wallpaper / planks / tiles + skirting */
function backdrop(g, kind, { w = 3.4, h = 4.4, z = -0.32 } = {}) {
  const key = `bd_${kind}`;
  const t = tex(key, 512, 512, (p, W, H) => {
    if (kind === "wallpaper") {
      p.fillStyle = "#f4dfb8"; p.fillRect(0, 0, W, H);
      for (let x = 0; x < W; x += 64) { p.fillStyle = "#ecd09e"; p.fillRect(x, 0, 30, H); }
      p.fillStyle = "#e3b98a"; for (let y = 32; y < H; y += 128) for (let x = 47; x < W; x += 128) { p.beginPath(); p.arc(x, y + ((x / 128) % 2) * 64, 7, 0, TAU); p.fill(); }
    } else if (kind === "planks") {
      const cols = ["#9a6a3f", "#a8774a", "#8f6238", "#a06f43"];
      for (let i = 0; i < 8; i++) { p.fillStyle = cols[i % 4]; p.fillRect(i * 64, 0, 64, H); p.fillStyle = "rgba(40,20,5,0.55)"; p.fillRect(i * 64, 0, 4, H); }
      p.fillStyle = "rgba(60,30,10,0.25)"; for (let i = 0; i < 40; i++) { const x = (hash(i * 7) * W) | 0, y = (hash(i * 13) * H) | 0; p.fillRect(x, y, 26, 3); }
      p.fillStyle = "#5c5c62"; for (let i = 0; i < 8; i++) for (const y of [40, 470]) { p.beginPath(); p.arc(i * 64 + 32, y, 5, 0, TAU); p.fill(); }
    } else { // tiles: a dark control-room wall
      p.fillStyle = "#1d2433"; p.fillRect(0, 0, W, H);
      p.strokeStyle = "#2c3750"; p.lineWidth = 6; for (let x = 0; x <= W; x += 128) { p.beginPath(); p.moveTo(x, 0); p.lineTo(x, H); p.stroke(); } for (let y = 0; y <= H; y += 128) { p.beginPath(); p.moveTo(0, y); p.lineTo(W, y); p.stroke(); }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 1.6, h / 1.6);
  const mat = cachedMat(`ibd${kind}${w}${h}`, () => new THREE.MeshStandardMaterial({ map: t, roughness: kind === "tiles" ? 0.35 : 0.7 }));
  rbx(w, h, 0.12, 0.02, mat, { y: h / 2, z: z - 0.06, parent: g });
  rbx(w + 0.02, 0.22, 0.16, 0.03, plastic(kind === "tiles" ? "#11151f" : "#6e4526", 0.4), { y: 0.11, z: z + 0.02, parent: g }); // skirting
  if (kind !== "tiles") rbx(w + 0.02, 0.08, 0.14, 0.02, plastic("#f6f0e2", 0.4), { y: 1.0, z: z + 0.01, parent: g }); // dado rail
}

// ------------------------------------------------------------------------------------------------ clocks
/** a clock face texture: bold numbers 1-12, ticks */
function faceTex({ ink = "#1b1b1f", bg = "#fffaf0", accent = "#e8443a" } = {}) {
  return tex(`face${ink}${bg}${accent}`, 512, 512, (p, W) => {
    const c = W / 2;
    p.fillStyle = bg; p.beginPath(); p.arc(c, c, c, 0, TAU); p.fill();
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * TAU, big = k % 5 === 0, r0 = c * (big ? 0.84 : 0.9), r1 = c * 0.96;
      p.strokeStyle = big ? ink : "#9a9aa2"; p.lineWidth = big ? 12 : 4; p.lineCap = "round";
      p.beginPath(); p.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0); p.lineTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1); p.stroke();
    }
    p.fillStyle = ink; p.textAlign = "center"; p.textBaseline = "middle";
    for (let n = 1; n <= 12; n++) { const a = (n / 12) * TAU, r = c * 0.68; p.font = kitFont(n % 3 ? 62 : 86); p.fillText(String(n), c + Math.sin(a) * r, c - Math.cos(a) * r + 4); }
    p.fillStyle = accent; p.font = kitFont(30); p.fillText("BLOCKY", c, c + c * 0.36);
  });
}
/** hands at "H:MM" (+ a ticking second hand): returns anim(t) */
function hands(parent, time, { r = 0.5, z = 0.02, ink = "#1b1b1f", accent = "#e8443a", start = 0 } = {}) {
  const [h, m] = String(time ?? "7:00").split(":").map(Number);
  const mk = (len, wid, mat, zz) => { const pv = new THREE.Group(); pv.position.z = zz; parent.add(pv); rbx(wid, len, 0.025, wid * 0.4, mat, { y: len * 0.38, parent: pv, shadow: false }); return pv; };
  const hh = mk(r * 0.58, r * 0.11, plastic(ink, 0.3), z), mh = mk(r * 0.86, r * 0.075, plastic(ink, 0.3), z + 0.02), sh = mk(r * 0.9, r * 0.025, plastic(accent, 0.3), z + 0.04);
  M(cyl(r * 0.07, r * 0.07, 0.04, 20), plastic(accent, 0.25), { rx: Math.PI / 2, z: z + 0.06, parent, shadow: false });
  const mins = ((h % 12) * 60 + (m || 0));
  hh.rotation.z = -(mins / 720) * TAU; mh.rotation.z = -((m || 0) / 60) * TAU;
  return (t) => { const s = (start + Math.floor(t)) % 60; sh.rotation.z = -(s / 60) * TAU; mh.rotation.z = -(((m || 0) + (start + t) / 60) / 60) * TAU; };
}

export const INSERT_BUILD = {
  /** a big round wall clock (red plastic rim, white face, bold numbers) on a wallpapered wall, at the line's time */
  wall_clock(g, state, opts = {}) {
    backdrop(g, "wallpaper", { z: -0.28 });
    const R = 0.62, cy = 1.9, c = new THREE.Group(); c.position.set(0, cy, -0.2); g.add(c);
    M(cyl(R, R, 0.16, 48), plastic("#e8443a", 0.25), { rx: Math.PI / 2, parent: c });
    M(tor(R, 0.05), plastic("#c7322a", 0.25), { z: 0.08, parent: c });
    M(disc(R * 0.9), new THREE.MeshStandardMaterial({ map: faceTex(), roughness: 0.35 }), { z: 0.085, parent: c, shadow: false });
    // a glass cover catching the light
    M(disc(R * 0.92), cachedMat("iglass", () => new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.08, roughness: 0.02, metalness: 0.2, depthWrite: false })), { z: 0.2, parent: c, shadow: false });
    const tick = hands(c, opts.text, { r: R * 0.9, z: 0.1, start: strHash(opts.text) % 50 });
    g.userData.anim = tick;
    fin(g, { w: R * 2.15, h: R * 2.15, cy, d: 0.5 });
  },
  /** a twin-bell alarm clock on a nightstand (state ring: it shakes, the hammer hits the bells) */
  alarm_clock(g, state, opts = {}) {
    backdrop(g, "wallpaper", { z: -0.56 });
    // the nightstand
    rbx(1.1, 0.08, 0.7, 0.02, plastic("#7ec8e3", 0.3), { y: 0.86, z: -0.2, parent: g });
    rbx(1.0, 0.78, 0.62, 0.04, plastic("#5aa9c9", 0.3), { y: 0.43, z: -0.22, parent: g });
    rbx(0.86, 0.26, 0.04, 0.03, plastic("#7ec8e3", 0.3), { y: 0.56, z: 0.1, parent: g });
    M(sph(0.035), plastic("#ffd23f"), { y: 0.56, z: 0.13, parent: g });
    const R = 0.36, cy = 0.9 + 0.12 + R, body = new THREE.Group(); body.position.set(0, cy, -0.2); g.add(body);
    const col = "#2fbf71";
    M(cyl(R, R, 0.22, 40), plastic(col, 0.22), { rx: Math.PI / 2, parent: body });
    M(tor(R, 0.035), metal("#e9eef2", 0.2), { z: 0.11, parent: body });
    M(disc(R * 0.9), new THREE.MeshStandardMaterial({ map: faceTex({ accent: "#2fbf71" }), roughness: 0.35 }), { z: 0.112, parent: body, shadow: false });
    const tick = hands(body, opts.text, { r: R * 0.9, z: 0.12, start: strHash(opts.text) % 50 });
    // bells, hammer, legs, the key
    const bells = [];
    for (const sx of [-1, 1]) {
      const b = M(cachedGeo("ibell", () => new THREE.SphereGeometry(0.15, 20, 10, 0, TAU, 0, Math.PI / 2)), metal("#e9eef2", 0.18), { x: sx * 0.22, y: R + 0.05, rz: sx * -0.5, parent: body }); bells.push(b);
      bx(0.03, 0.12, 0.03, metal("#c9ced4"), { x: sx * 0.16, y: R - 0.02, rz: sx * -0.5, parent: body });
      rbx(0.08, 0.14, 0.08, 0.03, plastic(darker(col, 0.7)), { x: sx * 0.22, y: -R + 0.0, rz: sx * 0.35, parent: body });
    }
    const ham = new THREE.Group(); ham.position.set(0, R + 0.02, 0); body.add(ham);
    bx(0.025, 0.2, 0.025, metal("#c9ced4"), { y: 0.1, parent: ham }); M(sph(0.04), metal("#c9ced4"), { y: 0.2, parent: ham });
    M(tor(0.07, 0.018, Math.PI), metal("#c9ced4"), { y: R + 0.17, parent: body });
    const ring = state === "ring";
    g.userData.anim = (t) => {
      tick(t);
      if (!ring) return;
      const f = Math.sin(t * 46), k = Math.round(f * 3) / 3;
      body.position.x = 0.012 * k; body.rotation.z = 0.035 * k; ham.rotation.z = 0.5 * Math.sign(f);
    };
    fin(g, { w: 1.05, h: 1.05, cy: cy + 0.06, d: 0.75, top: cy + R + 0.3 });
  },
  /** a big digital watch on a raised wrist (counting down from opts.secs, or showing opts.text time) */
  digital_watch(g, state, opts = {}) {
    backdrop(g, "tiles", { z: -0.9 });
    const look = opts.look ?? {}, skin = look.skin ?? "#f1c27d", sleeve = look.top ?? "#3d7bd9";
    const cy = 1.35;
    // the forearm up from the bottom of the frame, the fist on top, a sleeve cuff
    rbx(0.46, 1.25, 0.42, 0.08, plastic(skin, 0.45), { y: cy - 0.35, z: -0.15, parent: g });
    rbx(0.56, 0.44, 0.5, 0.1, plastic(skin, 0.45), { y: cy + 0.48, z: -0.15, parent: g });
    for (let k = 0; k < 4; k++) rbx(0.12, 0.06, 0.04, 0.02, plastic(darker(skin, 0.85), 0.45), { x: -0.18 + k * 0.12, y: cy + 0.55, z: 0.11, parent: g, shadow: false });
    rbx(0.62, 0.5, 0.56, 0.1, plastic(sleeve, 0.5), { y: cy - 0.95, z: -0.15, parent: g });
    // the watch: strap, case, LCD
    rbx(0.5, 0.36, 0.5, 0.06, plastic("#1c1c22", 0.35), { y: cy, z: -0.15, parent: g });
    rbx(0.62, 0.46, 0.14, 0.07, plastic("#26262e", 0.25), { y: cy, z: 0.14, parent: g });
    rbx(0.66, 0.5, 0.1, 0.07, metal("#c9ced4", 0.25), { y: cy, z: 0.1, parent: g });
    for (const sx of [-1, 1]) rbx(0.06, 0.08, 0.06, 0.02, metal("#c9ced4"), { x: sx * 0.35, y: cy + 0.08, z: 0.12, parent: g });
    const lcd = liveCanvas(512, 320, (p, W, H, s) => {
      p.fillStyle = "#b9c8a2"; rr(p, 0, 0, W, H, 40); p.fill();
      p.fillStyle = "#2b3324"; p.font = kitFont(40); p.textAlign = "left"; p.fillText(state === "count" ? "TIMER" : "TIME", 30, 52);
      const h = s.length > 5 ? 150 : 190, w = segWidth(s, h);
      sevenSeg(p, s, (W - w) / 2, H * 0.52 - h / 2 + 20, h, "#1e2618", "rgba(30,38,24,0.08)");
    });
    M(plane(0.52, 0.34), new THREE.MeshStandardMaterial({ map: lcd.tex, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -2 }), { y: cy, z: 0.215, parent: g, shadow: false });
    const secs = Number(opts.secs) || 0, start = secs >= 3600 ? secs - 13 : secs;
    const show = (t) => lcd.set(state === "count" ? countdownText(start, t) : String(opts.text ?? "7:00").padStart(5, "0"));
    show(0); g.userData.anim = show;
    fin(g, { w: 0.9, h: 0.9, cy, d: 0.6, top: cy + 0.7 });
  },
  /** a wall-mounted digital timer: counting down (state count) or a short message in LEDs (state text) */
  countdown_screen(g, state, opts = {}) {
    backdrop(g, "tiles", { z: -0.3, w: 5, h: 5.6 });
    const cy = 1.8, W = 2.0, H = 0.95;
    rbx(W + 0.16, H + 0.16, 0.2, 0.06, plastic("#2a2f3a", 0.25), { y: cy, z: -0.2, parent: g });
    rbx(W + 0.22, 0.06, 0.24, 0.02, plastic("#e8443a", 0.25), { y: cy + H / 2 + 0.1, z: -0.2, parent: g });
    for (const sx of [-1, 1]) bx(0.05, 0.5, 0.05, metal("#9aa3ad"), { x: sx * 0.7, y: cy + H / 2 + 0.35, z: -0.25, parent: g });
    const red = "#ff3b30", amber = "#ffb627";
    const lcd = liveCanvas(1024, 488, (p, Wc, Hc, s) => {
      p.fillStyle = "#08090c"; p.fillRect(0, 0, Wc, Hc);
      if (state === "text") { bold(p, s, Wc / 2, Hc / 2, Wc * 0.9, Hc * 0.8, { color: amber, glow: amber, maxSize: 190, maxLines: 2 }); return; }
      const h = s.length > 5 ? 250 : 320, w = segWidth(s, h);
      sevenSeg(p, s, (Wc - w) / 2, (Hc - h) / 2, h, red, "rgba(255,59,48,0.07)");
    });
    const scr = new THREE.MeshStandardMaterial({ map: lcd.tex, emissive: "#ffffff", emissiveMap: lcd.tex, emissiveIntensity: 1.25, roughness: 0.2 });
    M(plane(W, H), scr, { y: cy, z: -0.095, parent: g, shadow: false });
    const secs = Number(opts.secs) || 10, start = secs >= 3600 ? secs - 13 : secs;
    const show = (t) => lcd.set(state === "text" ? String(opts.text ?? "ONE DAY REMAINING") : countdownText(start, t));
    show(0); g.userData.anim = show;
    fin(g, { w: W + 0.3, h: H + 0.3, cy, d: 0.55 });
  },
  /** a neon sign / screen: glowing tube letters (the line's short text) on a dark panel; state flicker blinks */
  neon_screen(g, state, opts = {}) {
    backdrop(g, "tiles", { z: -0.29, w: 5, h: 5.6 });
    const text = String(opts.text ?? "OPEN"), cy = 1.8, W = 2.1, H = 1.1;
    const pal = [["#ff3ea5", "#ffd1ec"], ["#2ee6ff", "#d5fbff"], ["#9bff3a", "#efffd8"], ["#ffb627", "#fff0cf"]][strHash(text) % 4];
    rbx(W + 0.18, H + 0.18, 0.18, 0.06, plastic("#14161d", 0.3), { y: cy, z: -0.2, parent: g });
    const t = tex(`neon${text}${pal[0]}`, 1024, 536, (p, Wc, Hc) => {
      p.fillStyle = "#06070b"; p.fillRect(0, 0, Wc, Hc);
      p.strokeStyle = pal[0]; p.lineWidth = 10; p.shadowColor = pal[0]; p.shadowBlur = 30; rr(p, 26, 26, Wc - 52, Hc - 52, 40); p.stroke(); p.shadowBlur = 0;
      bold(p, text, Wc / 2, Hc / 2 + 6, Wc * 0.82, Hc * 0.66, { color: pal[1], stroke: pal[0], sw: 22, glow: pal[0], maxSize: 230 });
    });
    const scr = new THREE.MeshStandardMaterial({ map: t, emissive: "#ffffff", emissiveMap: t, emissiveIntensity: 1.4, roughness: 0.2 });
    M(plane(W, H), scr, { y: cy, z: -0.105, parent: g, shadow: false });
    // (no point light: a light that only some shots have recompiles every material between shots)
    g.userData.anim = (time) => {
      if (state !== "flicker") return;
      const f = Math.floor(time * 12), off = hash(f * 3 + 1) < 0.18;
      scr.emissiveIntensity = off ? 0.25 : 1.4;
    };
    fin(g, { w: W + 0.3, h: H + 0.3, cy, d: 0.55 });
  },
  /** a WANTED (or MISSING) poster on a plank wall: a blocky portrait of the named character, the name, REWARD */
  wanted_poster(g, state, opts = {}) {
    backdrop(g, "planks", { z: -0.245 });
    const look = opts.look ?? {}, name = String(opts.text ?? "").slice(0, 18), cy = 1.75, W = 1.05, H = 1.45;
    const head = state === "missing" ? "MISSING" : "WANTED";
    const t = tex(`poster${head}${name}${JSON.stringify(look).slice(0, 200)}`, 600, 830, (p, Wc, Hc) => {
      p.fillStyle = "#f3e2b3"; p.fillRect(0, 0, Wc, Hc);
      p.fillStyle = "rgba(150,100,40,0.18)"; for (let i = 0; i < 70; i++) { p.beginPath(); p.arc(hash(i * 5) * Wc, hash(i * 11) * Hc, 3 + hash(i * 17) * 14, 0, TAU); p.fill(); }
      p.strokeStyle = "#5b3a1a"; p.lineWidth = 10; p.strokeRect(18, 18, Wc - 36, Hc - 36);
      bold(p, head, Wc / 2, 112, Wc * 0.84, 150, { color: state === "missing" ? "#1f4e9c" : "#9c1f1f", maxSize: 150, maxLines: 1 });
      // the portrait: a blocky head + shoulders in the character's colours
      const px = 110, py = 210, pw = Wc - 220, ph = 360;
      p.fillStyle = "#e9d5a1"; p.fillRect(px, py, pw, ph); p.strokeStyle = "#5b3a1a"; p.lineWidth = 8; p.strokeRect(px, py, pw, ph);
      const skin = look.skin ?? "#f1c27d", hair = look.hairColor ?? "#3b2a1a", top = look.top ?? "#3d7bd9";
      p.fillStyle = top; rr(p, px + 40, py + ph - 110, pw - 80, 110, 18); p.fill();
      p.fillStyle = skin; p.fillRect(px + pw / 2 - 30, py + ph - 135, 60, 40);
      const hx = px + pw / 2 - 95, hy = py + 70, hs = 190;
      p.fillStyle = skin; rr(p, hx, hy, hs, hs, 22); p.fill();
      p.fillStyle = hair; rr(p, hx - 8, hy - 26, hs + 16, 70, 18); p.fill();
      if (look.ohead?.kind === "cap" || look.hat) { p.fillStyle = look.ohead?.color ?? "#c0392b"; rr(p, hx - 12, hy - 44, hs + 24, 56, 14); p.fill(); p.fillRect(hx + hs - 30, hy + 4, 90, 18); }
      p.fillStyle = "#1b1b1f"; p.fillRect(hx + 46, hy + 78, 26, 34); p.fillRect(hx + hs - 72, hy + 78, 26, 34);
      p.fillStyle = "#ffffff"; p.fillRect(hx + 52, hy + 82, 9, 10); p.fillRect(hx + hs - 66, hy + 82, 9, 10);
      p.fillStyle = "#7a2a24"; p.fillRect(hx + 62, hy + 140, hs - 124, 14);
      if (name) bold(p, name, Wc / 2, 640, Wc * 0.8, 100, { color: "#2a1d14", maxSize: 96, maxLines: 1 });
      bold(p, state === "missing" ? "HAVE YOU SEEN ME?" : "REWARD", Wc / 2, 740, Wc * 0.74, 80, { color: state === "missing" ? "#1f4e9c" : "#9c1f1f", maxSize: 80, maxLines: 1 });
    });
    M(plane(W, H), new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 }), { y: cy, z: -0.24, rz: 0.03, parent: g });
    for (const [x, y] of [[-W / 2 + 0.07, H / 2 - 0.07], [W / 2 - 0.07, H / 2 - 0.07], [-W / 2 + 0.07, -H / 2 + 0.07], [W / 2 - 0.07, -H / 2 + 0.07]]) M(sph(0.03), metal("#8a8f96"), { x: x + y * 0.03, y: cy + y, z: -0.22, parent: g, shadow: false });
    fin(g, { w: W * 1.25, h: H * 1.1, cy, d: 0.5 });
  },
  /** a cork notice board: a big notice with the line's text, smaller pinned papers */
  notice_board(g, state, opts = {}) {
    backdrop(g, "planks", { z: -0.27, w: 5, h: 5.6 });
    const text = String(opts.text ?? "NOTICE"), cy = 1.7, W = 1.9, H = 1.3;
    rbx(W + 0.16, H + 0.16, 0.1, 0.04, plastic("#7b4a22", 0.35), { y: cy, z: -0.22, parent: g });
    const cork = tex("cork", 256, 256, (p, Wc, Hc) => { p.fillStyle = "#c79a5b"; p.fillRect(0, 0, Wc, Hc); for (let i = 0; i < 900; i++) { p.fillStyle = hash(i) < 0.5 ? "#b0844a" : "#d8ae70"; p.fillRect(hash(i * 3) * Wc, hash(i * 7) * Hc, 3, 3); } });
    M(plane(W, H), cachedMat("icork", () => new THREE.MeshStandardMaterial({ map: cork, roughness: 0.9 })), { y: cy, z: -0.165, parent: g, shadow: false });
    const main = tex(`notice${text}`, 640, 480, (p, Wc, Hc) => {
      p.fillStyle = "#ffffff"; p.fillRect(0, 0, Wc, Hc);
      p.fillStyle = "#e8443a"; p.fillRect(0, 0, Wc, 92); bold(p, "NOTICE", Wc / 2, 48, Wc * 0.8, 80, { color: "#ffffff", maxSize: 76, maxLines: 1 });
      bold(p, text === "NOTICE" ? "READ ME" : text, Wc / 2, 92 + (Hc - 92) / 2, Wc * 0.86, (Hc - 92) * 0.8, { color: "#1b1b1f", maxSize: 150, maxLines: 3 });
    });
    M(plane(0.95, 0.71), new THREE.MeshStandardMaterial({ map: main, roughness: 0.7 }), { y: cy + 0.06, z: -0.15, rz: -0.02, parent: g, shadow: false });
    const papers = [["#ffe066", -0.7, 0.32, 0.36, 0.42, 0.08], ["#8ce99a", 0.72, 0.36, 0.34, 0.3, -0.06], ["#a5d8ff", -0.66, -0.36, 0.38, 0.32, -0.04], ["#ffc9de", 0.7, -0.3, 0.32, 0.4, 0.07]];
    for (const [c, x, y, w, h, r] of papers) {
      const pt = tex(`paper${c}`, 128, 160, (p, Wc, Hc) => { p.fillStyle = c; p.fillRect(0, 0, Wc, Hc); p.fillStyle = "rgba(30,30,40,0.5)"; for (let k = 0; k < 6; k++) p.fillRect(14, 24 + k * 22, Wc - 28 - (k % 3) * 18, 7); });
      M(plane(w, h), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.75 }), { x, y: cy + y, z: -0.155, rz: r, parent: g, shadow: false });
      M(sph(0.025), plastic(["#e8443a", "#2f7fe0", "#2fbf71", "#ffb627"][Math.round((x + 1) * 2) % 4], 0.25), { x, y: cy + y + h / 2 - 0.04, z: -0.13, parent: g, shadow: false });
    }
    for (const [x, y] of [[-0.42, 0.38], [0.42, 0.38]]) M(sph(0.03), plastic("#e8443a", 0.25), { x, y: cy + 0.06 + y - 0.04, z: -0.13, parent: g, shadow: false });
    fin(g, { w: W + 0.25, h: H + 0.25, cy, d: 0.5 });
  },
  /** a sign with the line's words: a painted wooden board on two posts (wood) or a carved stone slab (stone) */
  sign_board(g, state, opts = {}) {
    const text = String(opts.text ?? "KEEP OUT");
    if (state === "stone") {
      const W = 1.8, H = 1.25;
      rbx(W + 0.3, 0.28, 0.7, 0.06, plastic("#8d8f94", 0.6), { y: 0.14, z: -0.3, parent: g });
      const t = tex(`stone${text}`, 1024, 712, (p, Wc, Hc) => {
        p.fillStyle = "#a9adb3"; p.fillRect(0, 0, Wc, Hc);
        for (let i = 0; i < 500; i++) { p.fillStyle = hash(i * 3) < 0.5 ? "rgba(70,72,78,0.18)" : "rgba(255,255,255,0.14)"; p.beginPath(); p.arc(hash(i * 5) * Wc, hash(i * 9) * Hc, 2 + hash(i * 13) * 9, 0, TAU); p.fill(); }
        // carved: a dark groove with a light lower lip (the light from above)
        const { lines, size } = fitText(p, text, Wc * 0.82, Hc * 0.7, { maxSize: 230, maxLines: 3 });
        p.font = kitFont(size); p.textAlign = "center"; p.textBaseline = "middle";
        const y0 = Hc / 2 - ((lines.length - 1) * size) / 2;
        lines.forEach((l, i) => { const y = y0 + i * size; p.fillStyle = "rgba(255,255,255,0.55)"; p.fillText(l, Wc / 2 + 4, y + 6); p.fillStyle = "#3a3c42"; p.fillText(l, Wc / 2, y); });
      });
      const stone = plastic("#a9adb3", 0.65), face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.65 });
      const slab = new THREE.Mesh(cachedGeo(`istone${W}${H}`, () => new THREE.BoxGeometry(W, H, 0.34)), [stone, stone, stone, stone, face, stone]);
      slab.position.set(0, 0.28 + H / 2, -0.3); slab.castShadow = slab.receiveShadow = true; g.add(slab);
      rbx(W * 0.94, 0.16, 0.38, 0.06, plastic("#9a9da3", 0.6), { y: 0.28 + H + 0.04, z: -0.3, parent: g });
      fin(g, { w: W + 0.3, h: H + 0.45, cy: 0.28 + H / 2, d: 0.7, actors: "beside" });
      return;
    }
    const cy = 1.45, W = 1.7, H = 0.95;
    for (const sx of [-1, 1]) rbx(0.12, cy + H / 2 + 0.1, 0.12, 0.03, plastic("#7b4a22", 0.45), { x: sx * (W / 2 - 0.15), y: (cy + H / 2 + 0.1) / 2, z: -0.32, parent: g });
    const t = tex(`wsign${text}`, 1024, 572, (p, Wc, Hc) => {
      const cols = ["#c98b4f", "#bd7f45", "#c98b4f"]; for (let i = 0; i < 3; i++) { p.fillStyle = cols[i]; p.fillRect(0, (i * Hc) / 3, Wc, Hc / 3); p.fillStyle = "rgba(60,30,10,0.5)"; p.fillRect(0, (i * Hc) / 3, Wc, 5); }
      bold(p, text, Wc / 2, Hc / 2, Wc * 0.86, Hc * 0.74, { color: "#fffaf0", stroke: "#4a2a10", sw: 16, maxSize: 220 });
    });
    const wood = plastic("#a0673a", 0.45), face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
    const board = new THREE.Mesh(cachedGeo(`iwsign${W}${H}`, () => new THREE.BoxGeometry(W, H, 0.1)), [wood, wood, wood, wood, face, wood]);
    board.position.set(0, cy, -0.24); board.castShadow = true; g.add(board);
    fin(g, { w: W + 0.2, h: H + 0.2, cy, d: 0.5 });
  },
  /** the MUSIC BOX (#3's tin wind-up music box): a mint tin box with gold trim on a little table, the lid open with a
   *  mirror, a tiny dancer spinning on her disc, the brass cylinder + steel comb under glass, the crank turning, notes
   *  rising (state play); state closed: the lid shut, nothing moves */
  music_box(g, state = "play") {
    const play = state !== "closed";
    // the little table
    const top = 0.78;
    rbx(1.05, 0.06, 0.78, 0.02, plastic("#b5733e", 0.4), { y: top - 0.03, z: -0.4, parent: g });
    for (const [x, z] of [[-0.44, -0.08], [0.44, -0.08], [-0.44, -0.72], [0.44, -0.72]]) rbx(0.07, top - 0.06, 0.07, 0.02, plastic("#9a5e2f", 0.4), { x, y: (top - 0.06) / 2, z, parent: g });
    const box = new THREE.Group(); box.position.set(0, top, -0.4); g.add(box);
    musicBoxBody(box, { s: 1, play, anim: (f) => (g.userData.anim = f) });
    fin(g, { w: 1.0, h: 1.0, cy: top + 0.42, d: 0.8, top: top + 0.95, actors: "beside", fz: -0.4 });
    // the medium object framing centres at fitH / 2 from the floor: the whole table + box (fitY keeps the wide on the box)
    Object.assign(g.userData, { fitH: 1.8, height: 1.75, detail: { at: V(0, top, -0.4), h: 0.95 } });
  },
};

/** the music box itself (s = scale: 1 = the hero box on its table, ~0.4 = in a hand) */
function musicBoxBody(box, { s = 1, play = true, anim = null } = {}) {
  const W = 0.72 * s, Hh = 0.34 * s, D = 0.48 * s, th = 0.035 * s;
  const tin = cachedMat("imbtin", () => new THREE.MeshStandardMaterial({ color: "#7fd1c7", metalness: 0.55, roughness: 0.26 }));
  const gold = metal("#e8b84a", 0.22), velvet = solid("#b3243b", { roughness: 0.95 });
  // walls (open top), floor velvet
  rbx(W, th, D, th * 0.4, tin, { y: th / 2, parent: box });
  rbx(W, Hh, th, th * 0.4, tin, { y: Hh / 2, z: D / 2 - th / 2, parent: box });
  rbx(W, Hh, th, th * 0.4, tin, { y: Hh / 2, z: -D / 2 + th / 2, parent: box });
  for (const sx of [-1, 1]) rbx(th, Hh, D, th * 0.4, tin, { x: sx * (W / 2 - th / 2), y: Hh / 2, parent: box });
  rbx(W - th * 2, th * 0.5, D - th * 2, 0, velvet, { y: Hh * 0.62, parent: box }); // the velvet shelf (the mechanism under it)
  // gold trim bands + feet
  for (const y of [th * 0.6, Hh - th * 0.4]) { rbx(W + th * 0.6, th * 0.7, th * 0.6, 0.004, gold, { y, z: D / 2, parent: box, shadow: false }); rbx(W + th * 0.6, th * 0.7, th * 0.6, 0.004, gold, { y, z: -D / 2, parent: box, shadow: false }); }
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M(sph(0.035 * s, 12, 8), gold, { x: x * (W / 2 - 0.03 * s), y: -0.01 * s, z: z * (D / 2 - 0.03 * s), parent: box });
  // the front plate: a cream oval with red notes
  const plate = tex("mbplate", 256, 160, (p, Wc, Hc) => {
    p.fillStyle = "#fff4dc"; p.beginPath(); p.ellipse(Wc / 2, Hc / 2, Wc / 2 - 6, Hc / 2 - 6, 0, 0, TAU); p.fill();
    p.strokeStyle = "#e8b84a"; p.lineWidth = 8; p.stroke();
    p.fillStyle = "#c7322a"; p.font = kitFont(92); p.textAlign = "center"; p.textBaseline = "middle"; p.fillText("♪ ♫", Wc / 2, Hc / 2 + 4);
  });
  M(plane(0.36 * s, 0.2 * s), new THREE.MeshStandardMaterial({ map: plate, transparent: true, alphaTest: 0.05, roughness: 0.4 }), { y: Hh * 0.45, z: D / 2 + 0.002, parent: box, shadow: false });
  // the mechanism, front half under a glass pane: brass pinned cylinder + steel comb
  const mech = new THREE.Group(); mech.position.set(0, Hh * 0.68, D * 0.22); box.add(mech);
  const drum = new THREE.Group(); mech.add(drum);
  M(cyl(0.05 * s, 0.05 * s, 0.4 * s, 20), metal("#d9a441", 0.2), { rz: Math.PI / 2, parent: drum });
  for (let k = 0; k < 18; k++) { const a = hash(k * 7) * TAU; bx(0.008 * s, 0.018 * s, 0.008 * s, metal("#f2f2f2"), { x: (-0.18 + 0.02 * k) * s, y: Math.cos(a) * 0.055 * s, z: Math.sin(a) * 0.055 * s, rx: a, parent: drum, shadow: false }); }
  for (let k = 0; k < 12; k++) bx(0.016 * s, 0.006 * s, 0.11 * s, metal("#c9ced4", 0.15), { x: (-0.165 + 0.03 * k) * s, y: 0.05 * s, z: 0.09 * s, parent: mech, shadow: false });
  M(plane(W - th * 2, D * 0.42), cachedMat("imbglass", () => new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0.12, roughness: 0.03, depthWrite: false })), { y: Hh * 0.98, z: D * 0.22, rx: -Math.PI / 2, parent: box, shadow: false });
  // the dancer on her disc (back half)
  const dancer = new THREE.Group(); dancer.position.set(0, Hh * 0.66, -D * 0.18); box.add(dancer);
  M(cyl(0.07 * s, 0.07 * s, 0.015 * s, 24), gold, { parent: dancer });
  const pink = plastic("#ff8fb8", 0.3), white = plastic("#fff6f0", 0.3), skin = plastic("#f1c27d", 0.4);
  bx(0.016 * s, 0.11 * s, 0.016 * s, white, { y: 0.065 * s, parent: dancer });
  bx(0.016 * s, 0.08 * s, 0.016 * s, white, { x: 0.025 * s, y: 0.1 * s, rz: 1.2, parent: dancer });
  M(cachedGeo(`itutu${s}`, () => new THREE.CylinderGeometry(0.03 * s, 0.075 * s, 0.035 * s, 16)), pink, { y: 0.13 * s, parent: dancer });
  rbx(0.04 * s, 0.07 * s, 0.03 * s, 0.008 * s, pink, { y: 0.18 * s, parent: dancer });
  rbx(0.04 * s, 0.04 * s, 0.04 * s, 0.01 * s, skin, { y: 0.24 * s, parent: dancer });
  rbx(0.044 * s, 0.018 * s, 0.044 * s, 0.006 * s, plastic("#5a3518", 0.4), { y: 0.262 * s, parent: dancer });
  M(tor(0.04 * s, 0.006 * s, Math.PI), skin, { y: 0.24 * s, parent: dancer, shadow: false });
  // the lid, hinged at the back top edge, open ~105 degrees, a mirror inside
  const hinge = new THREE.Group(); hinge.position.set(0, Hh, -D / 2); box.add(hinge);
  const lid = new THREE.Group(); hinge.add(lid);
  rbx(W + th * 0.4, th * 1.2, D + th * 0.4, th * 0.5, tin, { z: D / 2, y: th * 0.6, parent: lid });
  rbx(W * 0.7, th * 0.4, D * 0.7, 0, gold, { z: D / 2, y: th * 1.25, parent: lid, shadow: false });
  M(plane(W * 0.8, D * 0.8), metal("#eef6fb", 0.04), { z: D / 2, y: -0.002, rx: Math.PI / 2, parent: lid, shadow: false });
  hinge.rotation.x = play ? -1.83 : 0;
  dancer.visible = play;
  // the crank on the right side
  const crank = new THREE.Group(); crank.position.set(W / 2 + 0.03 * s, Hh * 0.5, 0); box.add(crank);
  M(cyl(0.015 * s, 0.015 * s, 0.07 * s, 10), gold, { rz: Math.PI / 2, x: -0.01 * s, parent: crank });
  bx(0.02 * s, 0.14 * s, 0.03 * s, gold, { x: 0.03 * s, y: 0.06 * s, parent: crank });
  M(cyl(0.022 * s, 0.022 * s, 0.07 * s, 12), plastic("#c7322a", 0.3), { rz: Math.PI / 2, x: 0.07 * s, y: 0.12 * s, parent: crank });
  // notes rising (hero size only)
  const notes = [];
  if (s >= 0.8) for (let k = 0; k < 3; k++) {
    const n = new THREE.Group(); box.add(n); notes.push(n);
    const m = glowMat(["#ffd23f", "#ff8fb8", "#7fd1c7"][k], 1.4);
    M(sph(0.035, 12, 8), m, { parent: n, shadow: false }); bx(0.012, 0.12, 0.012, m, { x: 0.03, y: 0.06, parent: n, shadow: false }); bx(0.05, 0.014, 0.012, m, { x: 0.05, y: 0.115, rz: -0.4, parent: n, shadow: false });
  }
  const f = (t) => {
    if (!play) { for (const n of notes) n.visible = false; return; }
    dancer.rotation.y = t * 2.4; drum.rotation.x = -t * 1.1; crank.rotation.x = -t * 2.2;
    notes.forEach((n, k) => { const u = ((t * 0.45 + k / 3) % 1); n.visible = true; n.position.set((k - 1) * 0.22 + Math.sin(t * 2 + k) * 0.04, Hh + 0.12 + u * 0.55, -0.05 + 0.1 * k); n.scale.setScalar(Math.sin(u * Math.PI) * 1.0 + 0.001); });
  };
  f(0); anim?.(f);
  return f;
}

/** the hand-size music box (kit/props.js makeHeld via kit/heldMore.js; origin at the grip) */
export function heldMusicBox(g) {
  const b = new THREE.Group(); b.position.set(0, -0.06, 0.02); g.add(b);
  musicBoxBody(b, { s: 0.42, play: true });
}
