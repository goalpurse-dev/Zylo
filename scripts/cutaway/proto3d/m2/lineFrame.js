// M2: every line's frame shows the part the line is about (the owner's rules of 2026-11-12, after the real water tower run:
// "never a neighbour's wall or a blurry close-up filling the frame. Every frame shows the part the line is about"; and
// "FIRST FRAME: always the world from above ground with the hook's action starting, never a dark underground or blurry
// close-up"). Pure math on a camera key, free, no render: the checker (m3/lineFrames.mjs) and the camera's last pass
// (compile.mjs, custom layouts only) use the same test.
//   frameIssues(layout, key, box, opts) -> { issues: [...], m }   issues, each a short word:
//     behind    the line's part is behind the camera
//     off       under 45% of the part's on-screen size is inside the frame, or it is under 10% of the width and 8% of the
//               height (a speck)
//     hidden    under half of the part can be seen past a wall, a building, a car or another part in front of it
//     wall      something in front of the part (a neighbour's wall, a building) fills 35% of the frame or more
//     close     a blurry close-up: the part is more than 1.7x the frame each way (only a fragment shows), or the whole
//               part a piece belongs to is 1.6x the frame each way, or the camera is inside it, or the shot is a narrow close-up whose focus sits far off the part
//     under     (opening only) the camera underground, or the soil face over half the frame (the world's cut-away front
//               face reads about 45% of any far view), or the hook's part all below ground
import { focusOf, union } from "./focus.js";
import { LENS, sceneryBoxes, measureKey } from "./framing.js";
import { DOF } from "./look2.js";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / (Math.hypot(...a) || 1));
const TV = Math.tan((LENS.vfov * Math.PI) / 360), TH = TV * LENS.aspect;

function basis(pos, tgt) { const f = norm(sub(tgt, pos)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f); return { f, r, u }; }
function proj(B, pos, p) { const v = sub(p, pos), z = dot(v, B.f); return { x: (dot(v, B.r) / (z * TH) + 1) / 2, y: (1 - dot(v, B.u) / (z * TV)) / 2, z }; }
function rect(B, pos, b) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, behind = false;
  for (const X of [b.min[0], b.max[0]]) for (const Y of [b.min[1], b.max[1]]) for (const Z of [b.min[2], b.max[2]]) {
    const q = proj(B, pos, [X, Y, Z]); if (q.z <= 0.1) { behind = true; continue; }
    x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
  }
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, behind };
}
function hit(o, d, b) {
  let t0 = 0, t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < b.min[i] || o[i] > b.max[i]) return Infinity; continue; }
    let a = (b.min[i] - o[i]) / d[i], c = (b.max[i] - o[i]) / d[i]; if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return Infinity;
  }
  return t0;
}
const inside = (p, b, pad = 0) => p.every((v, i) => v >= b.min[i] - pad && v <= b.max[i] + pad);
const overlap = (a, b) => { let v = 1, va = 1; for (let i = 0; i < 3; i++) { const o = Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]); if (o <= 0) return 0; v *= o; va *= Math.max(1e-6, a.max[i] - a.min[i]); } return v / va; };

// what can stand in front of a line's part: the setting (house, shop row, walls), and solid things (a building, a car,
// a machine, another designed part); never water, flows, effects, labels or the dig
const BLOCKERS = new Set(["building", "car", "machine", "canopy", "carWash", "vendingMachine", "atm", "prop", "rig", "boxPop", "tank", "box", "cabinet", "dumpTruck"]);
// (open structures, a canopy or a car wash arch on posts: only their roof hides anything; the aquarium's shade canopy
// counted as a solid block over the filter)
const ROOF_ONLY = new Set(["canopy", "carWash"]);

/** the boxes that may hide a line's part (not the part itself, nor anything it sits in or that sits in it) */
export function blockersFor(layout, box, skipIds = []) {
  const cut = layout.world?.cut ?? null, skip = new Set(skipIds.map((id) => String(id).split(".")[0]));
  const c = box.min.map((v, i) => (v + box.max[i]) / 2), out = [];
  const keep = (b) => b && !inside(c, b, 0.05) && overlap(box, b) < 0.3 && overlap(b, box) < 0.3;
  for (const b of sceneryBoxes(layout)) if (keep(b)) out.push(b);
  for (const p of layout.parts ?? []) {
    if (!BLOCKERS.has(p.kind) || skip.has(p.id)) continue;
    let b = null; try { b = focusOf(p, cut); } catch {}
    if (b && ROOF_ONLY.has(p.kind)) b = { min: [b.min[0], Math.max(b.min[1], b.max[1] - 0.5), b.min[2]], max: b.max };
    if (keep(b)) out.push(b);
  }
  return out;
}

/**
 * The issues of one camera key for one line's part (box). opts: { skipIds (the line's own parts), opening (the first
 * frame: the "under" test too), blockers (precomputed) }.
 */
export function frameIssues(layout, key, box, { skipIds = [], opening = false, blockers = null, outer = null } = {}) {
  const issues = [], pos = key.pos, tgt = key.tgt, B = basis(pos, tgt), r = rect(B, pos, box);
  const m = { w: 0, h: 0, vis: 1, wall: 0 };
  // the camera inside the part: a close-up of its inside
  if (inside(pos, box, -0.05)) { issues.push("close"); return { issues, m }; }
  if (r.behind && !(r.x1 > r.x0)) { issues.push("behind"); return { issues, m }; }
  const cw = Math.max(0, Math.min(1, r.x1) - Math.max(0, r.x0)), ch = Math.max(0, Math.min(1, r.y1) - Math.max(0, r.y0));
  m.w = +cw.toFixed(3); m.h = +ch.toFixed(3);
  const area = Math.max(1e-6, r.w * r.h), inFrac = (cw * ch) / Math.min(area, 1);
  if ((cw < 0.1 && ch < 0.08) || inFrac < 0.45) issues.push("off");
  if (r.w > 1.7 && r.h > 1.7) issues.push("close");
  // (a piece of a big part, the float in a water tower's tank: the whole part spilling far past the frame each way is a
  // blurry close-up of its near wall, the float behind it; outer = the whole part's box)
  // (only a big structure, over 8 m: a machine's mechanism macro, rule 13, is meant to be close)
  else if (outer && Math.max(...outer.max.map((v, i) => v - outer.min[i])) > 8) { const ro = rect(B, pos, outer); if (!ro.behind && ro.w > 1.6 && ro.h > 1.6) issues.push("close"); }
  // the focus: a narrow shot (its field under DOF.none) blurs what is off the focus distance; the part's middle far
  // off it reads as a blur
  const f = Math.hypot(...sub(tgt, pos)), field = 2 * f * TH, cz = proj(B, pos, box.min.map((v, i) => (v + box.max[i]) / 2)).z;
  if (field < DOF.none * 0.75 && cz > 0 && Math.abs(cz - f) / f > 0.45 && !issues.includes("close")) issues.push("close");
  // seen past what stands in front: rays to a 4x4x3 grid of points on the part that are in the frame
  const bl = blockers ?? blockersFor(layout, box, skipIds);
  let n = 0, seen = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 3; k++) {
    const p = [box.min[0] + ((i + 0.5) / 4) * (box.max[0] - box.min[0]), box.min[1] + ((j + 0.5) / 4) * (box.max[1] - box.min[1]), box.min[2] + ((k + 0.5) / 3) * (box.max[2] - box.min[2])];
    const q = proj(B, pos, p); if (q.z <= 0.1 || q.x < 0 || q.x > 1 || q.y < 0 || q.y > 1) continue;
    const d = sub(p, pos), L = Math.hypot(...d), dir = mul(d, 1 / L); n++;
    if (!bl.some((b) => hit(pos, dir, b) < L * 0.97)) seen++;
  }
  m.vis = n ? +(seen / n).toFixed(2) : 0;
  if (n >= 4 && seen / n < 0.5) issues.push("hidden");
  // something in front of the part filling the frame: rays over the frame that meet a blocker nearer than the part
  {
    let tot = 0, front = 0;
    const near = Math.max(0.5, cz - Math.max(...box.max.map((v, i) => v - box.min[i])) / 2);
    for (let j = 0; j < 16; j++) for (let i = 0; i < 9; i++) {
      const x = (i + 0.5) / 9, y = (j + 0.5) / 16, d = norm(add(B.f, add(mul(B.r, (2 * x - 1) * TH), mul(B.u, (1 - 2 * y) * TV)))); tot++;
      const t = Math.min(...bl.map((b) => hit(pos, d, b)));
      if (t < Infinity && t * dot(d, B.f) < near) front++;
    }
    m.wall = +(front / tot).toFixed(2);
    if (front / tot >= 0.35) issues.push("wall");
  }
  if (opening) {
    const mk = measureKey(layout, pos, tgt);
    m.soil = mk.soil;
    if (pos[1] < 0.3 || mk.soil >= 0.55 || box.max[1] < 0.05) issues.push("under");
  }
  return { issues, m };
}

/** the box to frame for an opening whose part is below ground: the part with the ground above it, up to 1.6 m */
export function aboveGroundBox(box) {
  if (!box) return box;
  const w = Math.max(box.max[0] - box.min[0], 2.4), cx = (box.min[0] + box.max[0]) / 2, deep = -Math.min(1.2, 0.3 * w);
  // a part standing on the ground (or only a little into it) is framed as it is
  if (box.max[1] >= 1.2 && box.min[1] >= deep) return box;
  // (a part reaching deep into the cut, an escalator, a tunnel, a well: its part above ground and a sliver below)
  if (box.max[1] >= 1.2) return { min: [box.min[0], deep, box.min[2]], max: box.max };
  return { min: [cx - w / 2, Math.max(box.min[1], deep), Math.min(box.min[2], -1.5)], max: [cx + w / 2, Math.max(box.max[1], 1.6), Math.max(box.max[2], 0.2)] };
}

/**
 * The camera's last pass (compile.mjs, custom layouts only): every line but the opening and the end (the director's own
 * last pass frames those) is tested at the moments the picture checker sees (deps.previewTimes); a line with a failing
 * frame gets one view of its part that passes every test (its part at half the frame, from the camera's own side first,
 * then turned up to 70 degrees either way and higher), arrived at as the line starts and held through it (a second view
 * of it, 10 degrees round, halfway through a long line: no framing held over 4 s). camera {end, noend} is changed in
 * place. deps: { previewTimes, frameBox, cameraAt, lineSubject }. Returns notes.
 */
export function lineFramePass(layout, camera, { sentences, tracks, marks, frames = [] }, deps) {
  const notes = [], SKIP = new Set(["hook", "finish", "congrats"]);
  const DEG = Math.PI / 180, viewAt = (yaw, el) => [Math.sin(yaw) * Math.cos(el * DEG), Math.sin(el * DEG), Math.cos(yaw) * Math.cos(el * DEG)];
  for (let si = 0; si < sentences.length; si++) {
    const s = sentences[si];
    if (SKIP.has(s.role) || !(s.t1 > s.t0)) continue;
    const sb = deps.lineSubject(layout, s.role); if (!sb?.box) continue;
    const beat = (layout.beats ?? []).find((b) => b.s === s.role), skipIds = [sb.id, ...(beat?.do ?? []).map((a) => a.p), ...(beat?.shows?.p ? [beat.shows.p] : [])];
    const bl = blockersFor(layout, sb.box, skipIds);
    const tl = { sentences, tracks, marks, director: { frames } };
    const ts = deps.previewTimes(tl, layout).find((p) => p.role === s.role)?.ts ?? [];
    if (!ts.length) continue;
    const outer = deps.outerOf?.(layout, sb, s.role) ?? null;
    const test = (k) => frameIssues(layout, k, sb.box, { skipIds, blockers: bl, outer }).issues;
    const bad = ts.map((t) => ({ t, is: test(deps.cameraAt(camera.end, t)) })).filter((x) => x.is.length);
    if (!bad.length) continue;
    // the views to try: the camera's own direction at the first bad moment, then round the part and higher
    const k0 = deps.cameraAt(camera.end, bad[0].t), d0 = sub(k0.pos, k0.tgt), L0 = Math.hypot(...d0) || 1;
    const yaw0 = Math.atan2(d0[0], d0[2]), el0 = Math.max(8, Math.min(50, Math.asin(Math.max(-1, Math.min(1, d0[1] / L0))) / DEG));
    const below = sb.box.max[1] <= 0.5 && sb.box.min[1] < -1.5;
    let K = null;
    for (const dy of [0, 20, -20, 40, -40, 70, -70]) {
      for (const el of [el0, 22, 35, 50]) {
        for (const width of [0.5, 0.42, 0.58, 0.34, 0.28]) {
          const f = deps.frameBox(sb.box, { view: viewAt(yaw0 + dy * DEG, el), width, zone: "center", minField: 0 });
          const k = { pos: f.pos, tgt: f.tgt };
          // (never a camera in the soil for a part above ground, never one behind the cut face)
          if (!below && k.pos[1] < 0.3) continue;
          if (k.pos[1] < 0 && k.pos[2] < 0.4) continue;
          if (!test(k).length) { K = k; break; }
        }
        if (K) break;
      }
      if (K) break;
    }
    if (!K) { notes.push(`line frame: ${s.role} (${sb.id}) has ${bad.map((b) => b.is.join("+")).join(", ")} and no view of it passes`); continue; }
    // the window: from the travel into this line to the next line's travel
    const next = sentences[si + 1], w0 = Math.max(0.05, s.t0 - 0.45), w1 = Math.max(ts.at(-1) + 0.05, Math.min(s.t1, next ? next.t0 - 0.45 : s.t1));
    const land = Math.max(w0 + 0.4, Math.min(ts[0] - 0.05, s.t0 + 0.35));
    const long = w1 - land > 3.6;
    let K2 = null;
    if (long) {
      const d = sub(K.pos, K.tgt), L = Math.hypot(...d), yaw = Math.atan2(d[0], d[2]), el = Math.asin(d[1] / L) / DEG;
      for (const dy of [10, -10, 16, -16]) { const f = deps.frameBox(sb.box, { view: viewAt(yaw + dy * DEG, el), width: 0.52, zone: "center", minField: 0 }); const k = { pos: f.pos, tgt: f.tgt }; if (!test(k).length) { K2 = k; break; } }
    }
    for (const which of ["end", "noend"]) {
      const keys = camera[which]; if (!keys?.length) continue;
      const from = deps.cameraAt(keys, w0), to = deps.cameraAt(keys, w1);
      const kept = keys.filter((k) => k[0] < w0 - 0.02 || k[0] > w1 + 0.02);
      const add = [[+w0.toFixed(4), from.pos, from.tgt], [+land.toFixed(4), K.pos, K.tgt]];
      if (K2) add.push([+((land + w1) / 2 + 0.3).toFixed(4), K2.pos, K2.tgt]);
      const last = K2 ?? K, creep = { pos: last.pos.map((v, i) => +(last.tgt[i] + (v - last.tgt[i]) * 0.95).toFixed(3)), tgt: last.tgt };
      add.push([+w1.toFixed(4), creep.pos, creep.tgt]);
      // (a key list past w1 keeps going from where it was: nothing after the window moves)
      if (!kept.some((k) => k[0] > w1 + 0.02)) add.push([+(w1 + 0.05).toFixed(4), to.pos, to.tgt]);
      camera[which] = [...kept, ...add].sort((a, b) => a[0] - b[0]).filter((k, i, a) => i === 0 || k[0] - a[i - 1][0] > 0.03);
    }
    notes.push(`line frame: ${s.role} reframed on ${sb.id} (it had ${[...new Set(bad.flatMap((b) => b.is))].join(", ")})`);
  }
  return notes;
}

export { union };
