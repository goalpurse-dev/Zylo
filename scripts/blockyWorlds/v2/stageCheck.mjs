// IN THIS TOWN v2, step 1: THE FREE CODE CHECK OF A STAGE (no Blender, no API).
//   node scripts/blockyWorlds/v2/stageCheck.mjs            -> prints problems, exit 1 if any
// Checks: every spot is clear of walls / props by a body; spots used together are a body apart; every camera stands in
// the open; the line from every camera to each of its subjects' heads crosses no wall, prop, other person or creature.
import { STAGE_A, BODY_R, MIN_GAP, H, CREATURE_R } from "./stageA.mjs";

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** distance from point p to an obstacle's footprint (0 inside) */
function footDist(p, o) {
  if (o.cyl) return Math.max(0, d2(p, o.cyl) - o.cyl[2]);
  const [x0, x1, y0, y1] = o.box;
  const dx = Math.max(x0 - p[0], 0, p[0] - x1), dy = Math.max(y0 - p[1], 0, p[1] - y1);
  return Math.hypot(dx, dy);
}
/** is the 3D point inside the obstacle? */
function inside(p, o, pad = 0) {
  if (o.cyl) return d2(p, o.cyl) < o.cyl[2] + pad && p[2] < o.cyl[3] && p[2] >= 0;
  const [x0, x1, y0, y1, z0, z1] = o.box;
  return p[0] > x0 - pad && p[0] < x1 + pad && p[1] > y0 - pad && p[1] < y1 + pad && p[2] > z0 && p[2] < z1;
}

// THE FRAMING (calibrated on the step-1 renders: the 9:16 frame's half-width = 8.0/lens, half-height = 14.2/lens per
// unit of depth)
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
export const FRAME = { th: 6.75, tv: 12.0 };   // the kit camera: sensor fit VERTICAL, 24 mm
export function project(c, p) {
  const f = norm(sub(c.tgt, c.loc)), r = norm(cross(f, [0, 0, 1])), u = cross(r, f);
  const d = sub(p, c.loc), z = dot(d, f);
  if (z < 0.05) return null;
  const th = FRAME.th / c.lens, tv = FRAME.tv / c.lens;
  return [0.5 + 0.5 * (dot(d, r) / z) / th, 0.5 - 0.5 * (dot(d, u) / z) / tv];
}
/** the frame span [u0, u1, v0, v1] of an upright cylinder (radius r, from at.z + z0 to at.z + z1); null if behind */
export function span(c, at, r, z0, z1) {
  const uv = [];
  for (let k = 0; k < 12; k++) for (const z of [z0, z1]) {
    const q = project(c, [at[0] + r * Math.cos(k * Math.PI / 6), at[1] + r * Math.sin(k * Math.PI / 6), at[2] + z]);
    if (!q) return null;
    uv.push(q);
  }
  return [Math.min(...uv.map((q) => q[0])), Math.max(...uv.map((q) => q[0])), Math.min(...uv.map((q) => q[1])), Math.max(...uv.map((q) => q[1]))];
}
const f2 = (a) => a.map((x) => x.toFixed(2)).join(" ");

/** the framing problems of one camera with its people and creature */
export function framing(S, ck, c) {
  const out = [];
  for (const k of c.people) {
    const at = S.spots[k].at, hz = S.spots[k].head ?? H.kid;
    const hd = span(c, at, 0.62, hz - 1.3, S.spots[k].head ? hz + 0.25 : H.adult - 0.1), bd = span(c, at, BODY_R, 0, hz);   // (measured: the head sits 0.25 below the hair top)
    if (!hd) { out.push(`camera ${ck}: ${k} is behind the lens`); continue; }
    if (hd[0] < 0.1 || hd[1] > 0.9 || hd[2] < 0.05 || hd[3] > 0.6) out.push(`camera ${ck}: ${k}'s head is cut or under the captions (u ${f2(hd.slice(0, 2))}, v ${f2(hd.slice(2))})`);
    else if (bd && bd[3] - bd[2] < 0.12 && c.shot !== "wide") out.push(`camera ${ck}: ${k} is small (${(bd[3] - bd[2]).toFixed(2)} of the frame)`);
  }
  if (c.creature) {
    const at = S.creature_spots[c.creature].at;
    const e = span(c, at, 0.8, 0.86 * H.creature, 0.97 * H.creature);   // (measured: the Shadow's eyes near its top)
    if (!e || e[0] < 0.08 || e[1] > 0.92 || e[2] < 0.08 || e[3] > 0.6) out.push(`camera ${ck}: the creature's eyes are not in frame${e ? ` (u ${f2(e.slice(0, 2))}, v ${f2(e.slice(2))})` : ""}`);
    const b = span(c, at, CREATURE_R, 0, H.creature);
    if (!["close", "low"].includes(c.shot) && b && (Math.min(1, b[1]) - Math.max(0, b[0])) * (Math.min(1, b[3]) - Math.max(0, b[2])) > 0.5) out.push(`camera ${ck}: the creature fills over half the frame`);
  }
  return out;
}

export function checkStage(S) {
  const out = [];
  const walls = S.obstacles.filter((o) => !o.floor);
  const inDeck = (p, m = 0) => p[0] > S.deck.x0 + m && p[0] < S.deck.x1 - m && p[1] > S.deck.y0 + m && p[1] < S.deck.y1 - m;
  // spots: clear of walls by a body; deck spots fully on the deck, ground spots fully off it
  for (const [k, s] of Object.entries(S.spots)) {
    for (const o of walls) if ((o.box?.[4] ?? 0) < s.at[2] + H.adult && !(s.seat && o.furniture)) { const d = footDist(s.at, o); if (d < (s.seat ? 0.7 : BODY_R)) out.push(`spot ${k}: ${d.toFixed(2)} from ${o.n} (a body needs ${BODY_R})`); }
    if (s.on === "deck" && !inDeck(s.at, BODY_R)) out.push(`spot ${k}: not fully on the porch deck`);
    if (s.on !== "deck" && footDist(s.at, { box: [S.deck.x0, S.deck.x1, S.deck.y0, S.deck.y1] }) < BODY_R) out.push(`spot ${k}: its body overlaps the porch deck edge`);
  }
  for (const [k, s] of Object.entries(S.creature_spots)) for (const o of walls) { const d = footDist(s.at, o); if (d < CREATURE_R) out.push(`creature spot ${k}: ${d.toFixed(2)} from ${o.n}`); }
  // spots that a camera uses together are a body apart
  for (const [ck, c] of Object.entries(S.cameras)) {
    const ps = c.people.map((k) => S.spots[k]);
    if (ps.some((p) => !p)) { out.push(`camera ${ck}: unknown spot in ${c.people.join(", ")}`); continue; }
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (d2(ps[i].at, ps[j].at) < (c.touch ? 1.2 : MIN_GAP)) out.push(`camera ${ck}: ${c.people[i]} and ${c.people[j]} are ${d2(ps[i].at, ps[j].at).toFixed(2)} apart (< ${MIN_GAP})`);
    if (c.creature && !S.creature_spots[c.creature]) out.push(`camera ${ck}: unknown creature spot ${c.creature}`);
    // the camera stands in the open (not in a wall, not in a person it films)
    for (const o of walls) if (inside(c.loc, o, 0.3)) out.push(`camera ${ck}: inside ${o.n}`);
    for (const k of c.people) if (d2(c.loc, S.spots[k].at) < BODY_R + 0.4 && c.loc[2] < S.spots[k].at[2] + H.adult + 0.5) out.push(`camera ${ck}: inside ${k}'s body`);
    // the sightline to every subject's head: walls, props, the other people, the creature
    const bodies = c.people.map((k) => ({ k, at: S.spots[k].at, h: S.spots[k].head ?? H.kid }));
    const cr = c.creature ? { k: c.creature, at: S.creature_spots[c.creature].at, h: H.creature } : null;
    if (c.loc[0] > S.deck.x0 - 0.6 && c.loc[0] < S.deck.x1 + 0.6 && c.loc[1] > S.deck.y0 - 0.6 && c.loc[1] < S.deck.y1 && c.loc[2] < 0.6 + 1.2) out.push(`camera ${ck}: too close over the porch deck (the engine's camera guard would move it)`);
    const waist = c.shot === "wide" || c.shot === "top" ? [] : bodies.map((b) => ({ ...b, k: b.k, head: [b.at[0], b.at[1], b.at[2] + 1.1] }));
    const subjects = [...waist, ...bodies.map((b) => ({ ...b, head: [b.at[0], b.at[1], b.at[2] + 0.88 * b.h] })), ...(cr ? [{ ...cr, head: [cr.at[0], cr.at[1], cr.at[2] + 0.8 * cr.h] }] : [])];
    for (const s of subjects) {
      const hits = new Set();
      for (let t = 0.03; t < 0.97; t += 0.01) {
        const p = [0, 1, 2].map((i) => c.loc[i] + (s.head[i] - c.loc[i]) * t);
        if (d2(p, s.at) < (s.h === H.creature ? CREATURE_R : (S.spots[s.k]?.seat ? 0.7 : BODY_R)) + 0.05) break;   // reached the subject's own body
        for (const o of walls) if (inside(p, o)) hits.add(o.n);
        for (const b of [...bodies, ...(cr ? [cr] : [])]) if (b.k !== s.k && d2(p, b.at) < (b.h === H.creature ? CREATURE_R : (S.spots[b.k]?.seat ? 0.7 : BODY_R)) && p[2] < b.at[2] + b.h) hits.add(b.k);
      }
      if (hits.size) out.push(`camera ${ck}: the view of ${s.k}'s head is blocked by ${[...hits].join(", ")}`);
    }
  }
  for (const [ck, c] of Object.entries(S.cameras)) out.push(...framing(S, ck, c));
  // spots closer than a body (fine, but never used together; the shot checker enforces it)
  const close = [];
  const ks = Object.keys(S.spots);
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) if (d2(S.spots[ks[i]].at, S.spots[ks[j]].at) < MIN_GAP) close.push(`${ks[i]}~${ks[j]}`);
  return { problems: out, exclusive: close };
}

if (process.argv[1]?.endsWith("stageCheck.mjs")) {
  const r = checkStage(STAGE_A);
  console.log(`stage ${STAGE_A.id}: ${Object.keys(STAGE_A.spots).length} spots, ${Object.keys(STAGE_A.creature_spots).length} creature spots, ${Object.keys(STAGE_A.cameras).length} cameras`);
  console.log(r.problems.length ? `PROBLEMS (${r.problems.length}):\n- ${r.problems.join("\n- ")}` : "no problems");
  if (r.exclusive.length) console.log(`spots never used together (closer than ${MIN_GAP}): ${r.exclusive.join(", ")}`);
  process.exit(r.problems.length ? 1 : 0);
}
