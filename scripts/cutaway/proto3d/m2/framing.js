// M2: what a camera key shows, measured in code (free, no render): how much of the frame the main subject covers,
// and how much is empty lawn or sky. A grid of rays from the camera is traced against the world: the soil face of
// the cut (z = 0, below ground), the house, the setting's backdrop and every part's focus box count as "something";
// a ray that lands on open lawn, or never meets the ground (sky), counts as empty. Trees and the far scenery count
// as empty: a frame of lawn with one tree in it is the shot to avoid. Pure math: runs in node and in the page.
import { focusOf, union } from "./focus.js";
import { STREET_BACK, streetRoad } from "../kit/street.js";

export const LENS = Object.freeze({ vfov: 35, aspect: 1080 / 1920 });
// the limits, measured on the hand-built paths (m2/shotStudy.mjs and the calibration in M2_PROGRESS.md): their story
// keys are at most 33% empty (40% on the last pull-back), never under 3.8% on the subject, and never turn more than
// 19.3 degrees between keys
// soilMax: the cut face's share of the frame unless the sentence is about something underground (the owner's ~35% on
// screen; this ray measure reads about a fifth low against the rendered frames, so 0.28 here)
export const CAMERA_LIMITS = Object.freeze({ emptyMax: 0.4, subjectMin: 0.03, turnMax: 20, soilMax: 0.28 });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(...a));
const TV = Math.tan((LENS.vfov * Math.PI) / 360), TH = TV * LENS.aspect;
// how far the lawn island reaches (beyond it the haze and sky): the R1 world's ground is about 120 m across
const FAR = 90;

export const cutOf = (L) => L.world?.cut ?? { x0: -5, x1: 5, z0: -8, depth: 6 };

/** a setting's solid boxes (kit/backdrops.js): what stands behind and around the cut */
export function settingBoxes(B, cut = null) {
  if (!B) return [];
  const back = B.back;
  switch (B.type) {
    case "street": {
      // with the road (kit/street.js): the shop row split either side of it, further back
      if (B.road !== false) { const R = streetRoad({ cut, road: B.road ?? {}, back: back ?? STREET_BACK }), b = R.back; return [{ min: [R.x0 - 11.4, 0, b - 6], max: [R.x0 - 0.6, 9, b] }, { min: [R.x1 + 0.6, 0, b - 6], max: [R.x1 + 24, 9, b] }]; }
      const b = back ?? -8; return [{ min: [-14, 0, b - 6], max: [14, 7.5, b] }];
    }
    case "garage": { const b = back ?? -9, x = B.x ?? 0; return [{ min: [x - 4.7, 0, b - 7], max: [x + 4.7, 4.9, b] }, { min: [x - 14.7, 0, b - 7], max: [x - 4.7, 8, b] }]; }
    case "room": { const b = back ?? -7, x0 = B.x0 ?? -9, x1 = B.x1 ?? 9, h = B.h ?? 4.2; return [{ min: [x0 - 3, 0, b - 6.2], max: [x1 + 3, h + 6, b - 2.2] }, { min: [x0, 0, b - 0.35], max: [x1, h + 0.8, b] }, { min: [x0 - 0.35, 0, b], max: [x0, h + 0.8, 0] }, { min: [x0 - 0.35, h, b - 0.35], max: [x1 + 0.4, h + 0.8, 0.4] }]; }
    case "carwash": { const b = back ?? -8, x0 = B.x0 ?? -7, x1 = B.x1 ?? 7, h = B.h ?? 5.2; return [{ min: [x0, 0, b - 0.3], max: [x1, h + 0.5, b] }, { min: [x0 - 0.4, 0, b], max: [x0, h + 0.5, 0] }, { min: [x0 - 0.3, h, b - 0.3], max: [x1 + 0.3, h + 0.5, 0.2] }]; }
    default: return [];
  }
}

/** the house's box (or null), and the setting's backdrop box (or null) */
export function sceneryBoxes(L) {
  const W = L.world ?? {}, out = [];
  if (W.house !== false) { const h = Array.isArray(W.house) ? W.house : [-8, 0, -30]; out.push({ min: [h[0] - 5.5, 0, h[2] - 3.25], max: [h[0] + 5.5, 9.4, h[2] + 3.25] }); }
  out.push(...settingBoxes(W.backdrop, W.cut ?? null));
  // the far city behind a street, garage, room or car wash (kit/backdrops.js farRow: that far behind the setting's back)
  const gap = { street: 22, garage: 24, room: 26, carwash: 22 }[W.backdrop?.type];
  if (gap) { const z = (W.backdrop.back ?? { street: W.backdrop.road === false ? -8 : STREET_BACK, garage: -9, room: -7, carwash: -8 }[W.backdrop.type]) - gap; out.push({ min: [-46, 0, z - 12], max: [46, 14, z] }); }
  for (const b of W.backdrop?.boxes ?? []) out.push(b); // a setting may list its own solid boxes (walls, a canopy)
  return out;
}

/**
 * The main subject: the part(s) marked `main`, else the cut together with the hero shots' parts (the thing named in
 * "This is a…": a tiny cut under a road is not the story, the traffic light is; a pump in a pit below the cut is).
 * Every shot must keep it in view (CAMERA_LIMITS.subjectMin of the frame).
 */
export function subjectBox(L) {
  const cut = cutOf(L), main = L.parts.filter((p) => p.main).map((p) => focusOf(p, cut)).filter(Boolean);
  if (main.length) return union(main);
  const hero = (L.beats ?? []).flatMap((b) => [b.shot, ...(b.shots ?? [])]).filter((s) => s?.hero).flatMap((s) => [].concat(s.focus ?? []));
  const heroBoxes = L.parts.filter((p) => hero.includes(p.id)).map((p) => focusOf(p, cut)).filter(Boolean);
  const cutBox = L.world?.cut !== false ? [{ min: [cut.x0, -cut.depth, cut.z0], max: [cut.x1, 0, 0] }] : [];
  return union([...cutBox, ...heroBoxes]);
}

function hitBox(o, d, b) {
  let t0 = 0, t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < b.min[i] || o[i] > b.max[i]) return Infinity; continue; }
    let a = (b.min[i] - o[i]) / d[i], c = (b.max[i] - o[i]) / d[i]; if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return Infinity;
  }
  return t0;
}

// (the end sign is left out: it is only there for the end card)
// what a part fills on screen: its focus box, except the thin side-story props (a book, a sheet, a flag), whose focus
// boxes are padded for framing and would count the lawn round them as filled
function solidOf(p, cut) {
  const q = p.params ?? {};
  if ((p.kind === "book" || p.kind === "sheet") && q.to) { const w = (q.w ?? 1.8) / 2, h = (q.h ?? 2.4) / 2; return { min: [q.to[0] - w, q.to[1] - h, q.to[2] - 0.2], max: [q.to[0] + w, q.to[1] + h, q.to[2] + 0.2] }; }
  if (p.kind === "flag" && q.at) return { min: [q.at[0], q.at[1] + (q.pole ?? 2.6) - (q.h ?? 1.2), q.at[2] - 0.1], max: [q.at[0] + (q.w ?? 1.8), q.at[1] + (q.pole ?? 2.6), q.at[2] + 0.1] };
  return focusOf(p, cut);
}

const inside = (p, b, pad = 0) => p.every((v, i) => v >= b.min[i] - pad && v <= b.max[i] + pad);

/** the rays of a camera key, n x m over the frame: [{ x, y, o, d }] */
function rays(pos, tgt, n = 18, m = 32) {
  const f = norm(sub(tgt, pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), out = [];
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n, y = (j + 0.5) / m;
    out.push({ x, y, o: pos, d: norm(add(f, add(mul(r, (2 * x - 1) * TH), mul(u, (1 - 2 * y) * TV)))) });
  }
  return out;
}

/**
 * A camera key measured: { empty (share of the frame on open lawn or sky), sky, lawn, subject (share on the main
 * subject's box), inFrame (the subject's centre is in the frame) }.
 */
export function measureKey(L, pos, tgt) {
  const cut = cutOf(L), subj = subjectBox(L);
  const solids = [...sceneryBoxes(L), ...L.parts.map((p) => (["rain", "light", "sign"].includes(p.kind) ? null : solidOf(p, cut))).filter(Boolean)];
  let sky = 0, lawn = 0, onSubject = 0, soil = 0;
  const R = rays(pos, tgt);
  for (const { o, d } of R) {
    // the nearest of: a solid box, the ground (y = 0), the soil face (z = 0 below ground)
    let t = Math.min(...solids.map((b) => hitBox(o, d, b)));
    // the cross-section face (soil and the cut in it), however much of it is the subject: at most ~35% of the frame
    // unless the sentence is about something underground
    { const tf0 = d[2] < 0 && o[2] > 0 ? -o[2] / d[2] : Infinity; if (tf0 < Infinity && o[1] + d[1] * tf0 < 0 && tf0 <= t + 1e-6) soil++; }
    // the subject, or a part on it (arrows and outlines sit just in front of the cut face)
    const tS = hitBox(o, d, subj);
    if (tS < Infinity && (tS <= t + 1e-6 || inside(add(o, mul(d, t)), subj, 0.6))) { onSubject++; continue; }
    const tg = d[1] < 0 ? -o[1] / d[1] : Infinity, tf = d[2] < 0 && o[2] > 0 ? -o[2] / d[2] : Infinity;
    const yf = o[1] + d[1] * tf;
    if (tf < t && tf < tg && yf < 0) continue; // the soil face of the cross-section
    if (t < Infinity && t <= tg) continue; // a part, the house, the backdrop
    if (tg === Infinity) { sky++; continue; }
    const g = add(o, mul(d, tg));
    if (Math.hypot(g[0], g[2]) > FAR) { sky++; continue; } // past the island: haze and sky
    if (g[2] > 0) continue; // in front of the face (the cut-away front edge, soil below)
    lawn++;
  }
  const n = R.length, c = subj.min.map((v, i) => (v + subj.max[i]) / 2);
  const f = norm(sub(tgt, pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), v = sub(c, pos), z = dot(v, f);
  const cx = (dot(v, r) / (z * TH) + 1) / 2, cy = (1 - dot(v, u) / (z * TV)) / 2;
  return { empty: +((sky + lawn) / n).toFixed(3), sky: +(sky / n).toFixed(3), lawn: +(lawn / n).toFixed(3), subject: +(onSubject / n).toFixed(3), soil: +(soil / n).toFixed(3), inFrame: z > 0 && cx > 0 && cx < 1 && cy > 0 && cy < 1 };
}

/** the angle (degrees) between two keys' view directions */
export function turnBetween(a, b) {
  const u = norm(sub(a.pos, a.tgt)), v = norm(sub(b.pos, b.tgt));
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI;
}

// the props that tell a side story (a myth, a name, a year): they stand next to the action, inside the home frame
export const LIFE_KINDS = ["flag", "book", "sheet"];
const shiftPart = (p, d) => {
  const q = JSON.parse(JSON.stringify(p)), P = q.params ?? {};
  const mv = (pt) => (Array.isArray(pt) ? [pt[0] + d[0], pt[1], pt[2] + d[2]] : pt);
  for (const k of ["at", "to", "from", "pos"]) if (P[k]) P[k] = mv(P[k]);
  return q;
};
/**
 * Move each side-story prop that stands far from the subject (or out of the home frame) to a free spot beside the
 * cut, just behind its back edge. home: the home camera key. Returns { layout, moved: [ids] }.
 */
export function placeLifeProps(L, home, project) {
  const cut = cutOf(L), subj = subjectBox(L), moved = [];
  const near = (b) => b.min[0] < subj.max[0] + 6 && b.max[0] > subj.min[0] - 6 && b.max[2] > subj.min[2] - 6;
  const onScreen = (b) => { const r = project(home.pos, home.tgt, b); return !r.behind && r.x0 > 0.01 && r.x1 < 0.99 && r.y0 > 0.04; };
  // what stands above the lawn already (the parts as placed so far, but not the prop being moved)
  const taken = (id) => [...sceneryBoxes(L), ...parts.filter((p) => p.id !== id).map((p) => focusOf(p, cut)).filter((b) => b && b.max[1] > 0.2)];
  const hits = (b, list) => list.some((o) => b.min[0] < o.max[0] && b.max[0] > o.min[0] && b.min[2] < o.max[2] && b.max[2] > o.min[2] && b.max[1] > o.min[1] + 0.2);
  let parts = L.parts.slice();
  for (const [i, p] of parts.entries()) {
    if (!LIFE_KINDS.includes(p.kind)) continue;
    // a newspaper or a book dug up out of the cut is part of the action: it stays where it comes from
    const from = p.params?.from; if (from && from[0] >= cut.x0 - 0.3 && from[0] <= cut.x1 + 0.3 && from[1] <= 0.2 && from[2] >= cut.z0 - 0.3) continue;
    const b = focusOf(p, cut); if (!b || (near(b) && onScreen(b))) continue;
    const c = b.min.map((v, k) => (v + b.max[k]) / 2), others = taken(p.id);
    // candidates: a grid on the lawn behind and beside the cut; the free spot on screen nearest its back right corner
    const cands = [];
    for (let z = cut.z0 - 0.8; z >= cut.z0 - 6; z -= 0.8) for (let x = cut.x0 - 3; x <= cut.x1 + 3; x += 0.8) cands.push([x, z]);
    cands.sort((A, B) => Math.hypot(A[0] - (cut.x1 - 1), A[1] - (cut.z0 - 1)) - Math.hypot(B[0] - (cut.x1 - 1), B[1] - (cut.z0 - 1)));
    for (const [x, z] of cands) {
      const q = shiftPart(p, [x - c[0], 0, z - c[2]]), qb = focusOf(q, cut);
      if (!hits(qb, others) && onScreen(qb)) { parts[i] = q; moved.push(p.id); break; }
    }
  }
  return { layout: { ...L, parts }, moved };
}

/**
 * What the end sign may not stand in: the house, the setting (a car wash canopy over it hid its first line) and the
 * other parts. A roof overhead counts down to the ground: the camera looks down on it, so a sign under it is hidden.
 */
export function signObstacles(L, sign) {
  const cut = cutOf(L);
  return [...sceneryBoxes(L).map((b) => ({ min: [b.min[0], 0, b.min[2]], max: b.max })), ...worldTrees(L), ...L.parts.filter((p) => p !== sign).map((p) => focusOf(p, cut)).filter((b) => b && b.max[1] > 0.2)];
}
/** the world's two big trees (real.js; world.trees moves them, [] removes them): crown about 3.2 m round, 7.8 m tall */
export function worldTrees(L) {
  const T = L.world?.trees ?? [[-13, -11.5, 1], [14, -3.4, 0.9]];
  return T.map(([x, z, s = 1]) => ({ min: [x - 3.2 * s, 0, z - 3.2 * s], max: [x + 3.2 * s, 7.8 * s, z + 3.2 * s] }));
}
/**
 * What would hide the end sign (the check): the setting (a roof over it, a wall, the house) and structures (a canopy, a
 * wash arch, a machine). Low things before its posts (a fence, bushes, a pit cap) do not hide its board.
 */
const HIDERS = new Set(["canopy", "carWash", "machine", "trafficLight", "atm", "vendingMachine", "hydrant"]);
export function signBlocked(L) {
  const sign = L.parts.find((p) => p.kind === "sign"); if (!sign?.params?.at) return [];
  const cut = cutOf(L), b = focusOf(sign, cut);
  const boxes = [...sceneryBoxes(L).map((o) => ({ min: [o.min[0], 0, o.min[2]], max: o.max })), ...L.parts.filter((p) => HIDERS.has(p.kind)).map((p) => focusOf(p, cut)).filter(Boolean)];
  return boxes.filter((o) => b.min[0] < o.max[0] && b.max[0] > o.min[0] && b.min[2] < o.max[2] && b.max[2] > o.min[2] && b.max[1] > o.min[1] + 0.2 && b.min[1] < o.max[1]);
}

/**
 * The end sign beside the finished build: if, in the home view, the sign would cover more than a tenth of the build, or
 * it would stand inside something (under a car wash canopy, whose roof hid its first line),
 * it moves to the nearest free spot beside it (right first; in the home view if one is free), on the ground.
 */
export function placeSign(L, home, project) {
  const sign = L.parts.find((p) => p.kind === "sign"); if (!sign?.params?.at) return { layout: L, moved: false };
  const cut = cutOf(L), subj = subjectBox(L), sr = project(home.pos, home.tgt, subj);
  const cover = (q) => { const r = project(home.pos, home.tgt, focusOf(q, cut)); const ix = Math.max(0, Math.min(r.x1, sr.x1) - Math.max(r.x0, sr.x0)), iy = Math.max(0, Math.min(r.y1, sr.y1) - Math.max(r.y0, sr.y0)); return { share: (ix * iy) / Math.max(1e-6, sr.w * sr.h), inFrame: !r.behind && r.x0 > 0.02 && r.x1 < 0.98, r }; };
  const others = signObstacles(L, sign), hits = (b) => others.some((o) => b.min[0] < o.max[0] && b.max[0] > o.min[0] && b.min[2] < o.max[2] && b.max[2] > o.min[2] && b.max[1] > o.min[1] + 0.2 && b.min[1] < o.max[1]);
  // seen from the camera: nothing of the setting between the home view and the board (a spot behind the bay's back wall
  // was free but hidden)
  const walls = [...sceneryBoxes(L), ...worldTrees(L), ...L.parts.filter((p) => p !== sign).map((p) => { try { return focusOf(p, cut); } catch { return null; } }).filter((b) => b && b.max[1] > 1.5 && b.min[1] > -0.5)];
  const seen = (b) => { const pts = [[(b.min[0] + b.max[0]) / 2, b.max[1] - 0.5, b.max[2]], [b.min[0] + 0.4, b.max[1] - 0.5, b.max[2]], [b.max[0] - 0.4, b.max[1] - 0.5, b.max[2]]]; return pts.every((p) => { const d = sub(p, home.pos), len = Math.hypot(...d), u = mul(d, 1 / len); return !walls.some((w) => hitBox(home.pos, u, w) < len - 0.3); }); };
  if (cover(sign).share <= 0.1 && !hits(focusOf(sign, cut)) && seen(focusOf(sign, cut))) return { layout: L, moved: false };
  const [, y0, z0] = sign.params.at;
  // spots nearest the build first (1 m apart, either side), each at the sign's size, then a little smaller (1.0)
  const cands = [], dxs = Array.from({ length: 33 }, (_, i) => (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2)));
  for (const scale of [...new Set([sign.params.scale ?? 1.5, 1.0])]) for (const dx of dxs) for (const dz of [0, -2, -4, -6]) cands.push({ at: [subj.max[0] + 2 + dx, y0, Math.min(z0, -1) + dz], scale });
  // first a spot inside the home view; else the free spot nearest the build (the end views frame the sign with it)
  for (const need of [true, false]) {
    const ok = cands.map(({ at, scale }) => ({ ...sign, params: { ...sign.params, at, scale } })).filter((q) => { const c = cover(q); return c.share <= 0.1 && (c.inFrame || !need) && !hits(focusOf(q, cut)) && seen(focusOf(q, cut)); });
    // nearest: the one that widens the build's span the least (the end frame holds them both)
    const B = union([subj, ...L.parts.filter((p) => p !== sign).map((p) => focusOf(p, cut)).filter((o) => o && o.max[1] > 0.3 && o.max[0] - o.min[0] < 30)]), near = (q) => { const b = focusOf(q, cut); return Math.max(B.max[0], b.max[0]) - Math.min(B.min[0], b.min[0]); };
    if (ok.length) { const q = ok.sort((a, b) => near(a) - near(b))[0]; return { layout: { ...L, parts: L.parts.map((p) => (p === sign ? q : p)) }, moved: true }; }
  }
  return { layout: L, moved: false };
}

/** a setting's paved floor, [x0, x1, z0, z1] (kit/backdrops.js: the slab each one lays), or null for the yard */
export function settingFloor(B) {
  if (!B) return null;
  const back = B.back;
  switch (B.type) {
    case "street": return [-26, 26, back ?? (B.road === false ? -8 : STREET_BACK), 0.04];
    case "garage": return [-7, 7, back ?? -9, 0.04];
    case "room": return [B.x0 ?? -9, B.x1 ?? 9, back ?? -7, 0.04];
    case "carwash": return [(B.x0 ?? -7) - 6, (B.x1 ?? 7) + 6, back ?? -8, 0.04];
    default: return null;
  }
}

/** creeks and surface flows lifted onto the setting's floor (the bay, the sidewalk), so no slab hides them; in those
 * settings the dug dirt is hauled away right after the dig (no spoil pile on a car wash floor) */
export function liftToFloor(L) {
  const W = L.world ?? {}, t = W.backdrop?.type, floor = W.backdrop?.walkTop ?? (t === "street" || t === "room" ? 0.12 : t === "carwash" ? 0.1 : t === "garage" ? 0.08 : 0);
  if (!floor) return L;
  const cut = cutOf(L), inCut = (q) => q[0] > cut.x0 && q[0] < cut.x1 && q[2] > cut.z0;
  // only what is on the floor (a stream on the grass beside the lot stays on the grass)
  const F = settingFloor(W.backdrop), onFloor = (x0, x1) => !F || (x1 > F[0] && x0 < F[1]);
  const parts = L.parts.map((p) => {
    if (p.kind === "dig" && p.params?.haul === undefined) return { ...p, params: { ...p.params, haul: true } };
    if (p.kind === "creek") { const b = focusOf(p, cut); return onFloor(b.min[0], b.max[0]) ? { ...p, params: { ...p.params, y: Math.max(p.params?.y ?? 0, floor + 0.02) } } : p; }
    if (p.kind === "flow" && Array.isArray(p.params?.path)) return { ...p, params: { ...p.params, path: p.params.path.map((q) => (q[1] >= -0.05 && q[1] < floor + 0.12 && !inCut(q) && onFloor(q[0], q[0]) ? [q[0], floor + 0.14, q[2]] : q)) } };
    return p;
  });
  // the world's big trees off the paved floor and off the parts (one stood on the car wash lot's edge, over the stream
  // bank and in front of the end sign): each moves outward along x to the first free spot, or goes
  const solid = parts.map((p) => { try { return focusOf(p, cut); } catch { return null; } }).filter((b) => b && b.max[1] > 0.2 && b.max[0] - b.min[0] < 40);
  const free = (b) => !(F && b.max[0] > F[0] && b.min[0] < F[1] && b.max[2] > F[2] && b.min[2] < F[3]) && !solid.some((o) => b.min[0] < o.max[0] && b.max[0] > o.min[0] && b.min[2] < o.max[2] && b.max[2] > o.min[2]);
  const trees = [];
  for (const [x, z, s = 1] of W.trees ?? [[-13, -11.5, 1], [14, -3.4, 0.9]]) {
    const side = Math.sign(x) || 1, at = [0, 2, 4, 6, 8, 10, 12].map((d) => x + side * d).find((tx) => free({ min: [tx - 3.2 * s, 0, z - 3.2 * s], max: [tx + 3.2 * s, 7.8 * s, z + 3.2 * s] }));
    if (at !== undefined) trees.push([at, z, s]);
  }
  return { ...L, world: { ...W, trees }, parts };
}
