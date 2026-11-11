// Kit: roads, rails and bridges (scene language v2, phase 2; SCENE_LANGUAGE_V2.md section 3 "roads and paths"). A "road"
// part is a ribbon along points on the ground (asphalt with a centre line and edge lines, gravel, a rail track with
// sleepers, a path), and where it crosses a gap a bridge carries it: a beam bridge on piers, an arch, or a suspension
// bridge (two towers, main cables, hangers). Cars ride on it (their height follows its deck: deckAt). Channels: pave (the
// road is laid along its length), build (the bridge goes up: towers, cables, deck), twist and sway (the deck twists and
// sways: Tacoma Narrows). Pure functions first (Node), the builder last.
import { terrainModel } from "./terrain.js";
import { realOr } from "../m2/materials.js";

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const SURF = Object.freeze({ asphalt: "#3d4044", gravel: "#a39a8a", rail: "#7a6a58", path: "#c8b48e", track: "#8a6d4c" });

/** the road's settings with their defaults: its points [[x, z]...] (2+), width, surface, y, the bridge's span in x */
export function roadSpec(p = {}) {
  const pts = (Array.isArray(p.points) && p.points.length >= 2 ? p.points : [[-20, -3], [20, -3]]).map((q) => [num(q[0], 0), num(q[1], -3)]);
  const surface = SURF[p.surface] ? p.surface : "asphalt";
  const b = p.bridge && typeof p.bridge === "object" ? { from: num(p.bridge.from, -6), to: num(p.bridge.to, 6), height: num(p.bridge.height, 6), type: ["beam", "arch", "suspension"].includes(p.bridge.type) ? p.bridge.type : "beam", tower: num(p.bridge.tower, 10) } : null;
  return { pts, width: num(p.width, surface === "rail" ? 3 : surface === "path" ? 2 : 6), surface, y: num(p.y, 0), lines: p.lines ?? surface === "asphalt", bridge: b };
}

/** the height of the road's deck at x (on the bridge: its deck height; elsewhere the ground: the terrain or y) */
export function deckAt(spec, x, z, terrain = null) {
  const T = terrain ? terrainModel(terrain) : null, ground = T ? T.h(x, z) : spec.y;
  const b = spec.bridge;
  if (!b || x <= b.from || x >= b.to) return ground + 0.06;
  // the deck: level at its height, ramps of 3 m onto it from the ground at each end
  const g0 = T ? T.h(b.from, z) : spec.y, g1 = T ? T.h(b.to, z) : spec.y;
  const ramp = (a, c, u) => a + (c - a) * Math.max(0, Math.min(1, u));
  if (x < b.from + 3) return ramp(g0, b.height, (x - b.from) / 3) + 0.06;
  if (x > b.to - 3) return ramp(b.height, g1, (x - (b.to - 3)) / 3) + 0.06;
  return b.height + 0.06;
}

/** the box the camera frames: the road's span (the bridge's towers included) */
export function roadBox(p = {}) {
  const s = roadSpec(p), xs = s.pts.map((q) => q[0]), zs = s.pts.map((q) => q[1]);
  const top = s.bridge ? s.bridge.height + (s.bridge.type === "suspension" ? s.bridge.tower : s.bridge.type === "arch" ? 0.5 : 1) : s.y + 0.5;
  const lo = s.bridge ? Math.min(s.y, s.bridge.height - 8) : s.y - 0.2;
  return { min: [Math.min(...xs), lo, Math.min(...zs) - s.width / 2], max: [Math.max(...xs), top, Math.max(...zs) + s.width / 2] };
}

// ---------------- the page ----------------
export function buildRoad(ctx, p = {}) {
  const { THREE } = ctx, s = roadSpec(p), group = new THREE.Group(); ctx.scene.add(group);
  const terrain = ctx.terrain ? { blocks: ctx.terrain.model.blocks } : null;
  const C = (c) => new THREE.Color(c), std = (c, r = 0.8, m = 0) => ctx.std({ color: C(c), roughness: r, metalness: m });
  // (the deck and the bridge hang in a pivot on the deck's centre line, so a twist turns the deck about its own axis)
  const zMid = s.pts.reduce((a, q) => a + q[1], 0) / s.pts.length, yMid = s.bridge ? s.bridge.height : s.y;
  const pivot = new THREE.Group(); pivot.position.set(0, yMid, zMid); group.add(pivot); const inner = new THREE.Group(); inner.position.set(0, -yMid, -zMid); pivot.add(inner);
  // the path, resampled every 0.5 m, with its length so far
  const P = []; for (let i = 0; i < s.pts.length - 1; i++) { const [a, b] = [s.pts[i], s.pts[i + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5)); for (let k = 0; k < n; k++) P.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); }
  P.push(s.pts.at(-1)); const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); const total = L.at(-1);
  const ribbon = (half, off, lift, mat, dash = 0) => {
    const pos = [], idx = []; let k = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      for (const side of [-1, 1]) { const x = P[i][0] + nx * (off + side * half), z = P[i][1] + nz * (off + side * half); pos.push(x, deckAt(s, x, z, terrain) + lift, z); }
      if (i && (!dash || Math.floor(L[i] / dash) % 2 === 0)) idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
      k += 2;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    mat.side = THREE.DoubleSide; const m = new THREE.Mesh(g, mat); m.receiveShadow = true; inner.add(m); return m;
  };
  // (a custom layout's road is real asphalt at its real size that shines in the rain, a path or track packed dirt, m2/materials.js,
  // 2026-11-11; the ribbon has no UVs, so the approved asphalt texture showed as one flat colour)
  const deckOld = () => (s.surface === "asphalt" && ctx.PBR ? ctx.PBR("asphalt_02", 1, { color: C("#9a9a9a") }) : std(SURF[s.surface], 0.9));
  const deck = ribbon(s.width / 2, 0, 0, ctx.realLook === true ? realOr(ctx, s.surface === "asphalt" ? "asphalt" : s.surface === "gravel" ? "stone" : "dirt", SURF[s.surface], null, true) ?? deckOld() : deckOld());
  const extras = [];
  if (s.lines && s.surface === "asphalt") { extras.push(ribbon(0.08, 0, 0.01, std("#f2c230", 0.6), 3)); for (const e of [-1, 1]) extras.push(ribbon(0.07, e * (s.width / 2 - 0.25), 0.01, std("#f4f4f0", 0.6))); }
  if (s.surface === "rail") { const steel = std("#9aa2aa", 0.3, 0.8); for (const e of [-0.72, 0.72]) extras.push(ribbon(0.05, e, 0.16, steel)); const sl = std("#5a4632", 0.9); for (let i = 0; i < P.length; i += 2) { const [x, z] = P[i], o = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 2.4), sl); o.position.set(x, deckAt(s, x, z, terrain) + 0.05, z); inner.add(o); extras.push(o); } }
  // the bridge
  const bridge = new THREE.Group(); inner.add(bridge); const towers = [], cables = [];
  if (s.bridge) {
    const b = s.bridge, steel = realOr(ctx, "paint", "#c0503a", std("#c0503a", 0.5, 0.4), true), conc = realOr(ctx, "concrete", "#b8b2a6", std("#b8b2a6", 0.85), true), z0 = P.reduce((a, q) => a + q[1], 0) / P.length, hw = s.width / 2;
    // the deck's underside: a girder along the span
    const girder = new THREE.Mesh(new THREE.BoxGeometry(b.to - b.from - 4, 0.7, s.width), b.type === "suspension" ? steel : conc); girder.position.set((b.from + b.to) / 2, b.height - 0.35, z0); girder.castShadow = true; bridge.add(girder);
    const groundAt = (x) => (terrain ? terrainModel(terrain).h(x, z0) : s.y);
    if (b.type === "beam") for (let x = b.from + 4; x < b.to - 3; x += 6) { const g = groundAt(x), h = b.height - 0.7 - g; if (h > 0.3) { const pier = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, s.width * 0.7), conc); pier.position.set(x, g + h / 2, z0); pier.castShadow = true; bridge.add(pier); towers.push(pier); } }
    if (b.type === "arch") { const span = b.to - b.from - 2, cx = (b.from + b.to) / 2, rise = Math.min(b.height - groundAt(cx) - 1, span * 0.4); const pts = []; for (let i = 0; i <= 32; i++) { const u = i / 32, x = b.from + 1 + span * u; pts.push(new THREE.Vector3(x, b.height - 0.7 - rise * (1 - (2 * u - 1) ** 2) - 0.0 + 0, z0)); } for (const e of [-hw + 0.4, hw - 0.4]) { const c = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((v) => new THREE.Vector3(v.x, v.y - (b.height - 0.7 - v.y) * 0 , v.z + e))), 48, 0.35, 8), conc); c.castShadow = true; bridge.add(c); }
      // (the arch from the ground at each end up to the deck's underside at the crown, the spandrel columns between)
    }
    if (b.type === "suspension") {
      const tx = [b.from + 3.5, b.to - 3.5], top = b.height + b.tower;
      for (const x of tx) for (const e of [-hw - 0.3, hw + 0.3]) { const g = groundAt(x), t = new THREE.Mesh(new THREE.BoxGeometry(0.8, top - g, 0.8), steel); t.position.set(x, (top + g) / 2, z0 + e); t.castShadow = true; bridge.add(t); towers.push(t); }
      for (const x of tx) { const beam = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, s.width + 1.4), steel); beam.position.set(x, top - 0.4, z0); bridge.add(beam); towers.push(beam); }
      // the main cables: a sag between the towers, down to anchors past each end; hangers to the deck
      const sag = (x) => { const u = (x - tx[0]) / (tx[1] - tx[0]); return top - 0.6 - (b.tower - 1.5) * 4 * u * (1 - u); };
      const cm = std("#2d3136", 0.4, 0.6);
      for (const e of [-hw - 0.3, hw + 0.3]) {
        const pts = [new THREE.Vector3(b.from - 2, groundAt(b.from - 2) + 0.3, z0 + e)]; for (let i = 0; i <= 24; i++) { const x = tx[0] + ((tx[1] - tx[0]) * i) / 24; pts.push(new THREE.Vector3(x, sag(x), z0 + e)); } pts.push(new THREE.Vector3(b.to + 2, groundAt(b.to + 2) + 0.3, z0 + e));
        const c = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1), 80, 0.12, 6), cm); bridge.add(c); cables.push(c);
        for (let x = tx[0] + 1.5; x < tx[1] - 1; x += 1.5) { const yc = sag(x), h = yc - b.height; const hg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, h, 4), cm); hg.position.set(x, b.height + h / 2, z0 + e); bridge.add(hg); cables.push(hg); }
      }
    }
  }
  const deckParts = [deck, ...extras];
  return {
    group, spec: s, deckAt: (x, z) => deckAt(s, x, z, terrain),
    update(t, ch = {}) {
      // paved along its length (all of it without a pave cue)
      const k = ch.pave == null ? 1 : Math.max(0, Math.min(1, ch.pave));
      for (const m of deckParts) if (m.geometry?.index) { const n = m.geometry.index.count; m.geometry.setDrawRange(0, Math.floor((n * k) / 6) * 6); m.visible = k > 0.005; } else if (m.position) m.visible = k > 0.005 && (m.position.x - s.pts[0][0]) / Math.max(1e-6, s.pts.at(-1)[0] - s.pts[0][0]) <= k + 0.01;
      // the bridge: towers then cables rise on build (all of it without a build cue)
      const bk = ch.build == null ? 1 : Math.max(0, Math.min(1, ch.build));
      for (const o of towers) { o.visible = bk > 0.02; o.scale.y = Math.max(0.01, Math.min(1, bk * 1.6)); }
      for (const o of cables) o.visible = bk > 0.6;
      // the deck twists (about its axis) and sways (sideways), oscillating while on
      const tw = ch.twist ?? 0, sw = ch.sway ?? 0;
      pivot.rotation.x = tw * 0.22 * Math.sin(t * 2.6); pivot.position.z = zMid + sw * 0.6 * Math.sin(t * 1.4);
    },
  };
}
