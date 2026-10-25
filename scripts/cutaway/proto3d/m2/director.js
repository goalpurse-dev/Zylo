// M2: the camera director. It turns a layout's shots ("frame these parts from this sentence on") into camera keys
// for the kit's monotone path, by the account's rules (ANIMATION_STUDY.md, BUILD_PLAN.md):
//  - the home angle to open, drift (a slow push-in) while a shot holds, a fast move (0.85 s, ease in, quick stop)
//    starting 0.4 s before the sentence (or word) it belongs to, and no two moves closer than MOVE.minGap;
//  - each framed part fills `width` of the frame (at least 15%) and sits in a free zone of the frame: clear of the
//    card band (25-35% of the height) and the caption band (47-57%);
//  - the end: a pull back to the calm scene until the sign pops, then a gentle push toward the sign.
// It also projects boxes to the screen, for the code checks. Pure math: runs in node and in the page.
import { boxCenter, focusOf, union } from "./focus.js";
import { LENS, CAMERA_LIMITS, measureKey, settingBoxes, subjectBox, turnBetween } from "./framing.js";

export { LENS };
// the shot vocabulary, measured on the hand-built paths (m2/shotStudy.mjs): the camera's distance as a share of the
// home distance. home 1.0; wide 0.85-0.97; mid 0.6-0.8; close 0.35-0.5 (the crack, the newspaper); detail 0.17 (the
// pipe's holes). A shot with a type is placed by it (its view direction from VIEWS, aimed at its parts' centre).
export const SHOTS = Object.freeze({ wide: 0.9, mid: 0.7, close: 0.42, detail: 0.2 });
export const BANDS = Object.freeze({ card: [0.25, 0.35], caption: [0.47, 0.57] });
export const ZONES = Object.freeze({ top: [0.06, 0.245], mid: [0.355, 0.465], bottom: [0.575, 0.95] });
// view directions (from the target toward the camera); home is the French drain's home angle
export const VIEWS = Object.freeze({ home: [15.5, 10.5, 50], high: [10, 21, 34], low: [12, 4.5, 40], front: [5, 6, 50], side: [24, 9, 40], close: [12, 9, 40] });
// minGap: a move must finish (and hold a moment) before the next; the approved videos move every 3-4 s on average
export const MOVE = Object.freeze({ lead: 0.4, settle: 0.45, drift: 0.97, minGap: 1.2 });
export const MIN_WIDTH = 0.15;
// the narrowest field of view in world units (the approved close-ups: the holes ~4 m across, the crack ~5 m)
export const MIN_FIELD = 4;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(...a));
const TV = Math.tan((LENS.vfov * Math.PI) / 360), TH = TV * LENS.aspect;

function basis(pos, tgt) {
  const f = norm(sub(tgt, pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  return { f, r, u };
}

/** a world point on screen: x, y as fractions of the frame (0,0 = top left), z = depth in front of the camera */
export function project(pos, tgt, p) {
  const { f, r, u } = basis(pos, tgt), v = sub(p, pos), z = dot(v, f);
  return { x: (dot(v, r) / (z * TH) + 1) / 2, y: (1 - dot(v, u) / (z * TV)) / 2, z };
}

/** a box on screen: its bounding rectangle in frame fractions (w, h its size); behind = a corner behind the camera */
export function projectBox(pos, tgt, b) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, behind = false;
  for (const X of [b.min[0], b.max[0]]) for (const Y of [b.min[1], b.max[1]]) for (const Z of [b.min[2], b.max[2]]) {
    const q = project(pos, tgt, [X, Y, Z]); if (q.z <= 0.1) behind = true;
    x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
  }
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, behind };
}

/** does a screen rectangle cross the card or caption band? */
export function bandHits(rect) {
  const hit = (band) => rect.y1 > band[0] && rect.y0 < band[1];
  return { card: hit(BANDS.card), caption: hit(BANDS.caption) };
}

/**
 * Frame a box: a camera looking along `view` at it, at the distance where it fills `width` of the frame, panned
 * so the box sits in a free zone ("bottom" | "top" | "mid" | "auto" | "center": no zone, e.g. the home view).
 * Returns { pos, tgt, rect, zone, ok, why }.
 */
export function frameBox(box, { view = "home", width = 0.45, zone = "auto", fit = "zone", minField = MIN_FIELD } = {}) {
  // never closer than MIN_FIELD of world across: a thin part (a pipe, a crack) at a big width would fill the frame
  const sx = box.max[0] - box.min[0];
  if (sx < minField * width) { const c0 = (box.min[0] + box.max[0]) / 2, h = (minField * width) / 2; box = { min: [c0 - h, box.min[1], box.min[2]], max: [c0 + h, box.max[1], box.max[2]] }; }
  const dir = norm(Array.isArray(view) ? view : VIEWS[view] ?? VIEWS.home);
  const c = boxCenter(box);
  let d = Math.max(4, Math.hypot(box.max[0] - box.min[0], box.max[2] - box.min[2]) / (2 * TH * width));
  const at = (dd, shift = [0, 0, 0]) => { const tgt = add(c, shift); return { pos: add(tgt, mul(dir, dd)), tgt }; };
  for (let i = 0; i < 6; i++) { const { pos, tgt } = at(d); const r = projectBox(pos, tgt, box); if (r.behind) { d *= 1.5; continue; } d *= r.w / width; }
  let { pos, tgt } = at(d), rect = projectBox(pos, tgt, box);
  // the zone: the one the box fits best at this size (it shrinks to fit when it is too tall, down to MIN_WIDTH)
  const zones = zone === "auto" ? ["bottom", "top", "mid"] : zone === "center" ? [] : [zone];
  let chosen = zone === "center" ? "center" : null;
  for (const z of zones) { const [a, b] = ZONES[z]; if (rect.h <= b - a) { chosen = z; break; } }
  // too tall for every zone: a hero shot shrinks it into the bottom zone; a loose shot keeps its size and sits low
  let loose = false;
  if (!chosen && fit === "loose") { chosen = "bottom"; loose = true; }
  if (!chosen) { chosen = zones[0]; const [a, b] = ZONES[chosen]; const k = Math.min(rect.h / (b - a) * 1.02, rect.w / MIN_WIDTH); d *= k; ({ pos, tgt } = at(d)); rect = projectBox(pos, tgt, box); }
  // pan (camera and target together, so the view direction stays) until the box is centred in its zone
  const want = chosen === "center" ? 0.5 : loose ? Math.max(0.5, 0.96 - rect.h / 2) : (ZONES[chosen][0] + ZONES[chosen][1]) / 2;
  let shift = [0, 0, 0];
  for (let i = 0; i < 6; i++) {
    const { r, u } = basis(pos, tgt), cy = (rect.y0 + rect.y1) / 2, cx = (rect.x0 + rect.x1) / 2;
    shift = add(shift, add(mul(u, -(cy - want) * 2 * TV * d), mul(r, (cx - 0.5) * 2 * TH * d)));
    ({ pos, tgt } = at(d, shift)); rect = projectBox(pos, tgt, box);
  }
  const hits = bandHits(rect), why = [];
  if (rect.w < MIN_WIDTH - 1e-3) why.push(`${(rect.w * 100).toFixed(0)}% wide`);
  if (chosen !== "center" && !loose && (hits.card || hits.caption)) why.push(`crosses the ${hits.card ? "card" : "caption"} band`);
  if (width <= 1 && (rect.x0 < -0.01 || rect.x1 > 1.01)) why.push("off the side of the frame");
  return { pos: pos.map((v) => +v.toFixed(3)), tgt: tgt.map((v) => +v.toFixed(3)), rect, zone: loose ? "low" : chosen, ok: !why.length, why, bands: hits };
}

const drift = (k, f = MOVE.drift) => ({ pos: add(k.tgt, mul(sub(k.pos, k.tgt), f)).map((v) => +v.toFixed(3)), tgt: k.tgt });
const scaleView = (k, f) => drift(k, f);

/** a box about something underground (a tank, a pipe in the ground; not a shallow creek): its sentence may show the cut face at any size */
export const underground = (b) => !!b && b.max[1] <= 0.5 && b.min[1] < -1.5;

/**
 * A key slid straight up (the same angle) until the cut face is at most CAMERA_LIMITS.soilMax of the frame: the
 * approved videos keep the ground and what stands on it in view, the soil below. Never so far that `keep` (the shot's
 * own parts) drops out of the bottom or the subject goes under its minimum. The approved pair (their own home view)
 * keep their framing.
 */
export function liftSoil(layout, k, keep = null) {
  if (layout.camera?.home || !k?.pos) return k;
  const m0 = measureKey(layout, k.pos, k.tgt);
  if (m0.soil <= CAMERA_LIMITS.soilMax) return k;
  // (a subject the shot holds is never lost by the lift; a shot of something else, beside the lot, has none to lose)
  const hadSubject = m0.subject >= CAMERA_LIMITS.subjectMin + 0.01;
  // what must stay in is the part above ground (a build that reaches down into its cut keeps its top)
  if (keep && keep.max[1] > 0) keep = { min: [keep.min[0], Math.max(0, keep.min[1]), keep.min[2]], max: keep.max };
  let best = k;
  for (let dy = 0.4; dy <= 14; dy += 0.4) {
    const up = (p) => [p[0], +(p[1] + dy).toFixed(3), p[2]], q = { ...k, pos: up(k.pos), tgt: up(k.tgt) };
    if (keep) { const r = projectBox(q.pos, q.tgt, keep); if (r.behind || r.y1 > 1.0) break; }
    const m = measureKey(layout, q.pos, q.tgt);
    if (hadSubject && m.subject < CAMERA_LIMITS.subjectMin) break;
    best = q;
    if (m.soil <= CAMERA_LIMITS.soilMax) break;
  }
  return best;
}

/** the home view: the whole cut with the house behind it (or layout.camera.home), the cut face at most ~35% of it */
export function homeView(layout) {
  if (layout.camera?.home) return layout.camera.home;
  const v = homeView0(layout);
  return { ...liftSoil(layout, v), ...(v.small ? { small: true } : {}) };
}
function homeView0(layout) {
  const W = layout.world ?? {}, cut = W.cut ?? { x0: -5, x1: 5, z0: -8, depth: 6 };
  const h = Array.isArray(W.house) ? W.house : [-8, 0, -30];
  // what stands behind the cut: the house, or a street's shop fronts, or (a park, no house) just the lawn around the cut
  // a room or a car wash bay: its walls and ceiling frame the cut (the whole interior in view); a garage: its door
  const inner = ["room", "carwash"].includes(W.backdrop?.type) ? union(settingBoxes(W.backdrop, W.cut ?? null)) : W.backdrop?.type === "garage" ? settingBoxes(W.backdrop, W.cut ?? null)[0] : null;
  const behind = inner ? { min: [Math.max(inner.min[0], cut.x0 - 6), 0, inner.max[2] - 1], max: [Math.min(inner.max[0], cut.x1 + 6), inner.max[1], inner.max[2]] }
    : W.backdrop?.type === "street" ? { min: [-6, 0, (W.backdrop.back ?? -8) - 0.8], max: [6, 7.5, (W.backdrop.back ?? -8)] }
    : W.house === false ? { min: [cut.x0 - 3, 0, cut.z0 - 3], max: [cut.x1 + 3, 3, 0] }
    : { min: [h[0] - 5.5, 0, h[2] - 3.25], max: [h[0] + 5.5, 9.4, h[2] + 3.25] };
  const cutBox = { min: [cut.x0, -cut.depth, cut.z0], max: [cut.x1, 0, 0] };
  const f = frameBox(union([cutBox, behind]), { view: "home", width: 0.9, zone: "center" });
  // a small subject (a road loop, a pump in its pit): the named part must be at least MIN_WIDTH of the frame in the
  // home view too; when the whole setting makes it smaller, the home view frames the cut and the named part instead
  const hero = heroBox(layout);
  // (or the subject, cut and part together, under CAMERA_LIMITS.subjectMin of the frame: a flat road loop is wide but thin)
  if (hero && (projectBox(f.pos, f.tgt, hero).w < MIN_WIDTH || measureKey(layout, f.pos, f.tgt).subject < CAMERA_LIMITS.subjectMin)) {
    const both = union([cutBox, hero]);
    for (const w of [0.9, 0.8, 0.7, 0.55, 0.45, 0.35]) {
      const g = frameBox(both, { view: "home", width: w, zone: "center", minField: 0 });
      if (projectBox(g.pos, g.tgt, hero).w >= MIN_WIDTH + 0.02 && measureKey(layout, g.pos, g.tgt).subject >= CAMERA_LIMITS.subjectMin + 0.01) return { pos: g.pos, tgt: g.tgt, small: true };
    }
    const g = frameBox(hero, { view: "home", width: 0.3, zone: "center", minField: 0 });
    return { pos: g.pos, tgt: g.tgt, small: true };
  }
  return { pos: f.pos, tgt: f.tgt };
}

/** the named part: the hero shots' parts or region (the "This is a…" sentence), as one box (or null) */
export function heroBox(layout) {
  const cut = layout.world?.cut, parts = new Map((layout.parts ?? []).map((p) => [p.id, p])), boxes = [];
  for (const b of layout.beats ?? []) for (const s of [b.shot, ...(b.shots ?? [])]) {
    if (!s?.hero) continue;
    if (s.box) boxes.push(s.box);
    for (const id of [].concat(s.focus ?? [])) { const p = parts.get(id); const fb = p && focusOf(p, cut); if (fb) boxes.push(fb); }
  }
  return boxes.length ? union(boxes) : null;
}

/**
 * The camera keys for a layout. shots: [{ t (s, the sentence start), focus: [partIds] | "home", box? (a region instead),
 *   view, width | type (SHOTS), zone, hero? (the named part: kept clear of the bands), scale? (home) }],
 * The first shot, when it starts the hook, is the opening frame itself (no establishing shot before it). Every shot
 * keeps the main subject in view, with little empty lawn or sky (CAMERA_LIMITS): one that does not is re-aimed
 * toward the subject, then widened to hold both, then replaced by the home view.
 * sorted; marks: the compiler's end marks. Returns { end, noend, notes, frames: [{t, ids, rect, ok, why}] }.
 */
export function directCamera(layout, shots, marks) {
  const parts = new Map(layout.parts.map((p) => [p.id, p]));
  const cut = layout.world?.cut ?? { x0: -5, x1: 5, z0: -8, depth: 6 };
  const home = homeView(layout);
  const keys = [[0, home.pos, home.tgt]], notes = [], frames = [];
  let cur = home, lastMove = -Infinity;
  const homeD = Math.hypot(...sub(home.pos, home.tgt)), subj = subjectBox(layout), sc = boxCenter(subj);
  // the whole finished build: the subject and everything the "Add ..." line brought (a canopy at the far end of the bay)
  const finBeat = (layout.beats ?? []).find((b) => b.s === "finish");
  const added = (finBeat?.do ?? []).map((a) => parts.get(a.p)).filter((p) => p && !["flow", "sign", "light", "rain"].includes(p.kind) && !/hide|stop|refill/.test(String((finBeat.do.find((a) => a.p === p.id) ?? {}).v)));
  const build = union([subjectBox(layout), ...added.map((p) => { try { return focusOf(p, cut); } catch { return null; } }).filter(Boolean)]);
  // the home view, or (when the finished build reaches past it) a view of the whole build from the home angle
  const holds = (k) => { const r = projectBox(k.pos, k.tgt, build); return !r.behind && r.x0 >= 0.03 && r.x1 <= 0.97; };
  const homeAll = holds(home) ? home : (() => { const f = frameBox(build, { view: sub(home.pos, home.tgt), width: 0.88, zone: "center", minField: 0 }); return { pos: f.pos, tgt: f.tgt }; })();
  const passes = (k) => { const m = measureKey(layout, k.pos, k.tgt); return { ok: m.empty <= CAMERA_LIMITS.emptyMax - 0.02 && m.subject >= CAMERA_LIMITS.subjectMin + 0.01, m }; };
  // a shot that loses the subject or shows mostly lawn and sky: re-aim it toward the subject, then hold both, then home
  const anchor = (k, box, s) => {
    let p = passes(k); if (p.ok) return { k, m: p.m, how: null };
    // a shot its own parts fill (a third of the width or more), with little open lawn or sky, is not lost: it need not
    // hold the main subject too (the soap reaching a stream beside the lot, 20 m from the car wash's cut)
    const own = projectBox(k.pos, k.tgt, box);
    if (!layout.camera?.home && !own.behind && own.w >= 0.35 && p.m.empty <= CAMERA_LIMITS.emptyMax - 0.02) return { k, m: p.m, how: null };
    // a re-aim may not push the shot's own parts out (a soap flow re-aimed away from the creek it runs into)
    const keeps = (q) => { const r = projectBox(q.pos, q.tgt, box); return !r.behind && Math.min(1, r.x1) - Math.max(0, r.x0) >= 0.8 * Math.min(1, r.x1 - r.x0); };
    for (const a of [0.25, 0.5, 0.75]) { const tgt = k.tgt.map((v, i) => v + (sc[i] - v) * a), q = { pos: add(tgt, sub(k.pos, k.tgt)), tgt }; p = passes(q); if (p.ok && keeps(q)) return { k: q, m: p.m, how: `re-aimed ${a * 100}% toward the subject` }; }
    // holding both (the subject and a creek far off to the side) may sit on the bare limits, without the safety margin
    const bare = (m) => m.empty <= CAMERA_LIMITS.emptyMax && m.subject >= CAMERA_LIMITS.subjectMin;
    for (const w of [0.7, 0.8, 0.9]) { const g = frameBox(union([box, subj]), { view: s.view ?? "home", width: w, zone: "center", minField: 0 }); p = passes(g); if (p.ok || bare(p.m)) return { k: g, m: p.m, how: "widened to hold the subject too" }; }
    return { k: home, m: passes(home).m, how: "replaced by the home view" };
  };
  const push = (t, k) => { const tt = +t.toFixed(4); if (tt - keys.at(-1)[0] < 0.05) keys.pop(); keys.push([tt, k.pos, k.tgt]); };
  // what a shot's sentence is about: its showing part (the mud on the paint), on the "Add ..." line all it adds
  const boxOf = (p) => { try { return focusOf(p, cut); } catch { return null; } };
  const subjectOf = (s, box) => {
    const role = s.at?.s;
    if (role === "finish" && added.length) return union(added.map(boxOf).filter(Boolean));
    const b = (layout.beats ?? []).find((x) => x.s === role), p = b?.shows && parts.get(b.shows.p);
    return (p && boxOf(p)) ?? box;
  };
  // the camera moves toward what the sentence is about, never away: its subject never gets smaller on screen than in the
  // shot before (unless it no longer fits the frame); a shot that would shrink it pushes in along the current view
  const pushToward = (k, s, box) => {
    const sb = subjectOf(s, box), before = projectBox(cur.pos, cur.tgt, sb), after = projectBox(k.pos, k.tgt, sb);
    if (before.behind || after.behind || before.w > 0.85 || after.w >= before.w * 0.98) return k;
    const f = frameBox(sb, { view: sub(cur.pos, cur.tgt), width: Math.min(0.85, Math.max(before.w * 1.25, 0.3)), zone: "center", minField: 0 });
    const q = underground(sb) ? { pos: f.pos, tgt: f.tgt } : liftSoil(layout, { pos: f.pos, tgt: f.tgt }, sb);
    notes.push(`shot at ${s.t.toFixed(2)} s: pushed in on ${s.at?.s ?? "its subject"} (it would have shrunk from ${(before.w * 100).toFixed(0)}% to ${(after.w * 100).toFixed(0)}% of the width)`);
    return q;
  };
  // the hook object: the biggest solid thing the hook sentence acts on (the car, not the spray on it); the opening frame
  // holds it at least a quarter of the frame wide (its box at 36%: the box is wider than the car itself), with the
  // shot's other parts (the spray) beside it
  const hookB = (() => {
    const b = (layout.beats ?? []).find((x) => x.s === "hook");
    const bs = (b?.do ?? []).map((a) => parts.get(a.p)).filter((p) => p && !["flow", "pipeRun", "pipeRunFlow", "light", "rain", "outline", "sign", "dig", "water", "arrow"].includes(p.kind)).map((p) => { try { return focusOf(p, cut); } catch { return null; } }).filter(Boolean);
    return bs.sort((a, c) => (c.max[0] - c.min[0]) * (c.max[1] - c.min[1]) - (a.max[0] - a.min[0]) * (a.max[1] - a.min[1]))[0] ?? null;
  })();
  const hookClose = (k, box, s) => {
    if (!hookB || projectBox(k.pos, k.tgt, hookB).w >= 0.36) return k;
    const both = union([hookB, box]), w = Math.min(0.9, Math.max(0.4, (0.38 * (both.max[0] - both.min[0])) / Math.max(0.5, hookB.max[0] - hookB.min[0])));
    let g = frameBox(both, { view: s.view ?? "home", width: w, zone: "center", minField: 0 });
    if (projectBox(g.pos, g.tgt, hookB).w < 0.36) g = frameBox(hookB, { view: s.view ?? "home", width: 0.4, zone: "center", minField: 0 });
    return { pos: g.pos, tgt: g.tgt };
  };
  // the whole subject in the frame (the creator's newer videos, 2026-10-25: every shot holds the thing it explains whole,
  // in its place: the full signal head on its mast arm, the open cabinet; ours, sized by width alone, cropped a tall
  // thin part to a pole against a wall). A subject cut by an edge: the camera steps back along its view and recentres
  // until it is whole. Underground subjects (a tank, a cut face) may still fill the frame.
  const WHOLE = { x: [0.04, 0.96], y: [0.06, 0.94] };
  const whole = (r) => !r.behind && r.x0 >= WHOLE.x[0] && r.x1 <= WHOLE.x[1] && r.y0 >= WHOLE.y[0] && r.y1 <= WHOLE.y[1];
  const fitWhole = (k, b, s) => {
    if (!b || !k?.pos || underground(b) || layout.camera?.home) return k;
    // a long low thing (a creek, a road, a pipe run) is meant to run out of the frame: only compact things are held whole
    const sx = b.max[0] - b.min[0], sy = b.max[1] - b.min[1], sz = b.max[2] - b.min[2];
    if (Math.max(sx, sz) > 4 * Math.max(sy, 0.3)) return k;
    const r = projectBox(k.pos, k.tgt, b);
    if (r.behind || whole(r)) return k;
    const view = sub(k.pos, k.tgt);
    // the size it may keep: as big as it was, but no wider than 0.88 and no taller than 0.84 of the frame
    let w = Math.min(0.88, r.w, (0.84 * r.w) / Math.max(1e-6, r.h));
    for (let i = 0; i < 8; i++, w *= 0.9) {
      const f = frameBox(b, { view, width: w, zone: "center", minField: 0 }), q = { pos: f.pos, tgt: f.tgt };
      if (!whole(projectBox(q.pos, q.tgt, b))) continue;
      const l = liftSoil(layout, q, b), out = whole(projectBox(l.pos, l.tgt, b)) ? l : q;
      notes.push(`shot at ${s.t.toFixed(2)} s: stepped back to hold ${s.at?.s ?? "its subject"} whole (it was cut by the frame edge)`);
      return out;
    }
    return k;
  };
  for (const s of shots) {
    const start = s.t - MOVE.lead;
    if (start - lastMove < MOVE.minGap) { notes.push(`shot at ${s.t.toFixed(2)} s dropped: ${(start - lastMove).toFixed(1)} s after the last move`); continue; }
    let k;
    // (the "Add ..." line's home shot: the whole build, so the things it adds are seen arriving)
    if (s.focus === "home") k = s.scale ? scaleView(home, s.scale) : s.at?.s === "finish" ? liftSoil(layout, homeAll, build) : home;
    else {
      const ids = s.box ? ["(box)"] : [].concat(s.focus), boxes = s.box ? [s.box] : ids.map((id) => (parts.has(id) ? focusOf(parts.get(id), cut) : null));
      if (boxes.some((b) => !b)) { notes.push(`shot at ${s.t.toFixed(2)} s: no focus box for ${ids.filter((_, i) => !boxes[i]).join(", ")}`); continue; }
      let box = union(boxes), f = frameBox(box, { view: s.view ?? "home", width: s.width ?? 0.45, zone: s.zone ?? "auto", fit: s.hero ? "zone" : "loose", minField: s.hero ? 0 : MIN_FIELD });
      // a typed shot (and no width): at its share of the home distance, aimed at the parts' centre
      if (s.type && SHOTS[s.type] && !s.width && !s.hero) { const dir = norm(VIEWS[s.view ?? "home"] ?? VIEWS.home), tgt = boxCenter(box); f = { ...f, tgt, pos: add(tgt, mul(dir, homeD * SHOTS[s.type])).map((v) => +v.toFixed(3)), ok: true, why: [] }; }
      // a hero too tall to be 15% wide clear of the bands (a well casing): frame its top part, as much as fits
      for (let k = 0; s.hero && !f.ok && k < 12; k++) { box = { min: [box.min[0], box.max[1] - (box.max[1] - box.min[1]) * 0.8, box.min[2]], max: box.max }; f = frameBox(box, { view: s.view ?? "home", width: Math.max(0.2, s.width ?? 0.45), zone: "auto", fit: "zone", minField: 0 }); }
      // the part itself on screen (the framed box may be wider: MIN_FIELD)
      const real = projectBox(f.pos, f.tgt, union(boxes));
      // the hero keeps its own frame (the bands rule); every other shot is anchored on the subject
      // the opening shot (the hook object, first frame) keeps its own aim: it only has to avoid open lawn and sky
      const opening = keys.length === 1 && start < 0.4;
      const an = s.hero || (opening && passes(f).m.empty <= CAMERA_LIMITS.emptyMax - 0.02) ? { k: f, m: passes(f).m, how: null } : anchor(f, box, s);
      if (an.how) notes.push(`shot at ${s.t.toFixed(2)} s (${ids}): ${an.how} (it was ${(passes(f).m.empty * 100).toFixed(0)}% empty, ${(passes(f).m.subject * 100).toFixed(0)}% on the subject)`);
      const realA = projectBox(an.k.pos, an.k.tgt, union(boxes));
      frames.push({ t: s.t, ids, hero: !!s.hero, rect: an.how ? realA : real, zone: f.zone, measure: an.m, anchored: an.how, ok: f.ok && real.w >= MIN_WIDTH - 1e-3, why: real.w >= MIN_WIDTH - 1e-3 ? f.why : [...f.why, `the part is ${(real.w * 100).toFixed(0)}% wide`] });
      k = an.k.pos ? { pos: an.k.pos, tgt: an.k.tgt } : an.k;
      // the opening: the hook object at least a quarter of the frame wide (the creator opens close on it)
      if (opening && !layout.camera?.home) k = hookClose(k, box, s);
      // the cut face at most ~35% of the frame, unless the sentence is about something underground
      if (!underground(box)) k = liftSoil(layout, k, box);
      if (!opening && !layout.camera?.home) k = pushToward(k, s, box);
      // last: what the sentence is about stays whole (the hook object on the opening frame)
      k = fitWhole(k, opening && hookB ? hookB : subjectOf(s, box), s);
      // the opening: a first shot on the hook is the first frame (the video opens close on the hook object)
      if (keys.length === 1 && start < 0.4) { keys[0] = [0, k.pos, k.tgt]; cur = k; lastMove = 0; frames.at(-1).opening = true; continue; }
    }
    if (turnBetween(cur, k) > CAMERA_LIMITS.turnMax) notes.push(`shot at ${s.t.toFixed(2)} s turns ${turnBetween(cur, k).toFixed(0)} degrees (the hand-built paths turn at most ${CAMERA_LIMITS.turnMax})`);
    if (start > keys.at(-1)[0] + 0.05) push(start, drift(cur, 1 - (1 - MOVE.drift) * Math.min(1, (start - keys.at(-1)[0]) / 4)));
    push(s.t + MOVE.settle, k);
    cur = k; lastMove = start;
  }
  // the first half second moves (the creator's openings never sit still): a gentle push-in onto the first frame
  if (!layout.camera?.home && keys.length) {
    const k0 = { pos: keys[0][1], tgt: keys[0][2] }, tIn = Math.min(1.4, (keys[1]?.[0] ?? marks.signPop) - 0.3);
    if (tIn > 0.8) { const wide = scaleView(k0, 1.1); keys.splice(0, 1, [0, wide.pos, wide.tgt], [+tIn.toFixed(3), k0.pos, k0.tgt]); }
  }
  // the end: hold drifting, pull back to the calm scene until the sign pops, then push gently toward the sign
  const signPart = layout.parts.find((p) => p.kind === "sign");
  const back0 = liftSoil(layout, scaleView(home, 1.18), build), back1 = holds(back0) ? back0 : liftSoil(layout, homeAll, build);
  const signC = signPart ? boxCenter(focusOf(signPart, cut)) : home.tgt;
  // the end: a gentle push that ends on the sign, readable, centred, filling about 70% of the width (the home angle)
  // the finished build stays in view with the sign beside it (the end card never hides what was built)
  let toward = liftSoil(layout, signPart ? (() => { const f = frameBox(union([focusOf(signPart, cut), build]), { view: sub(home.pos, home.tgt), width: 0.9, zone: "center" }); return { pos: f.pos, tgt: f.tgt }; })() : scaleView(home, 0.72), build);
  // the end card wholly in the frame, 5% clear of every edge, from the moment it pops to the last frame: both end keys
  // hold it (widened step by step if not)
  let back = back1;
  if (signPart) {
    const sb = focusOf(signPart, cut), clear = (k) => { const r = projectBox(k.pos, k.tgt, sb); return !r.behind && r.x0 >= 0.05 && r.x1 <= 0.95 && r.y0 >= 0.05 && r.y1 <= 0.95; };
    const holdSign = (k) => {
      if (clear(k)) return k;
      for (const w of [0.85, 0.78, 0.7, 0.62, 0.55]) { const f = frameBox(union([sb, build]), { view: sub(home.pos, home.tgt), width: w, zone: "center", minField: 0 }), q = { pos: f.pos, tgt: f.tgt }; if (clear(q)) { const l = liftSoil(layout, q, build); return clear(l) ? l : q; } }
      notes.push("the end card could not be held clear of the frame's edges");
      return k;
    };
    toward = holdSign(toward); back = holdSign(back);
  }
  const base = keys.slice();
  if (marks.signPop + 0.1 - base.at(-1)[0] < 0.05) base.pop();
  const end = [...base, [+(marks.signPop + 0.1).toFixed(4), back.pos, back.tgt], [marks.lengthEnd, toward.pos, toward.tgt]];
  const nb = keys.slice(); if (marks.lengthNoEnd - nb.at(-1)[0] < 0.05) nb.pop();
  const far = scaleView(home, 1.25);
  const noend = [...nb, [marks.lengthNoEnd, far.pos, far.tgt]];
  return { end, noend, notes, frames };
}

/** the camera at time t on a key list (the kit's monotone path), for checks in node */
export function cameraAt(keys, t) {
  const n = keys.length, T = keys.map((k) => k[0]);
  const axis = (sel) => {
    const ys = keys.map(sel), d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (T[i + 1] - T[i]));
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (T[i + 1] - T[i - 1])) / ((2 * T[i + 1] - T[i] - T[i - 1]) / d[i - 1] + (T[i + 1] + T[i] - 2 * T[i - 1]) / d[i]);
    let i = 0; while (i < n - 2 && t > T[i + 1]) i++;
    const h = T[i + 1] - T[i], u = Math.min(1, Math.max(0, (t - T[i]) / h));
    return (2 * u ** 3 - 3 * u ** 2 + 1) * ys[i] + (u ** 3 - 2 * u ** 2 + u) * h * m[i] + (-2 * u ** 3 + 3 * u ** 2) * ys[i + 1] + (u ** 3 - u ** 2) * h * m[i + 1];
  };
  return { pos: [0, 1, 2].map((a) => axis((k) => k[1][a])), tgt: [0, 1, 2].map((a) => axis((k) => k[2][a])) };
}
